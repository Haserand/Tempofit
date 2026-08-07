import { useEffect, useState, useMemo } from 'react';
import { UserX, Loader2, Clock, Gauge, ListMusic, Heart, Lock, Eye, Zap, Search, SlidersHorizontal, ChevronDown, X, SearchX, Copy } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { formatDuration } from '../../utils/format';
import { buildCoverUrl } from '../../utils/coverArt';
import { OFFICIAL_VITRINE_USERNAME, buildOfficialVitrineProfile, buildOfficialVitrinePlaylistRows, buildOfficialVitrineRoutineRows } from '../../data/officialVitrineProfile';
import { useProfileSearchFilter } from '../../hooks/useProfileSearchFilter';
import { VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';

/**
 * ProfileView — profil PUBLIC d'un utilisateur, atteint via le paramètre
 * d'URL `?profile=pseudo` (voir App.jsx, même principe déjà en place pour
 * `?import=...` — playlistShareCode.js/useShare.js — pas de vraie route
 * `/user/:username` : ce projet n'utilise PAS react-router, voir
 * useNavigation.js, et Vercel n'a aucune règle de réécriture d'URL
 * configurée pour un chemin arbitraire, voir vercel.json) — un lien direct
 * vers `/user/pseudo` ouvert à froid (pas depuis l'app) renverrait un 404
 * AVANT même que React n'ait la moindre chance de s'exécuter. Un paramètre
 * de requête, lui, atteint toujours `index.html` normalement.
 *
 * Contrairement aux 8 autres vues listées dans la Sidebar, cette page n'est
 * accessible QUE par lien direct (comme PlaylistDetailView.jsx) — pas de
 * `<ViewHeader/>` ici pour la même raison qu'elle, voir sa propre docstring.
 *
 * "Login Wall" (01/08, retour direct : "je veux que les profils des autres
 * soient consultables uniquement si tu t'es fait un compte") — un visiteur
 * NON connecté n'atteint jamais la fonction serveur : `user` (reçu en prop,
 * depuis AuthContext.jsx) est vérifié AVANT tout appel réseau. Double
 * verrou, pas juste ce garde-fou côté client (contournable en désactivant
 * le JS) : `get_public_profile_summary` elle-même refuse désormais l'appel
 * pour la clé "anon" (droits d'exécution retirés) ET vérifie explicitement
 * `auth.uid() is null` en tout premier — voir supabase-schema.sql pour les
 * deux mécanismes.
 *
 * Tout le calcul (résolution du profil, vérification de confidentialité,
 * agrégation des statistiques) se fait CÔTÉ SERVEUR, dans la fonction
 * Postgres `get_public_profile_summary` (SECURITY DEFINER, voir
 * supabase-schema.sql) — ce composant ne fait QUE afficher ce qu'elle
 * renvoie déjà filtré. Aucune donnée brute (titres, pistes, dates de
 * complétion) ne transite jamais jusqu'ici : la fonction ne renvoie que
 * `{ totalDuration, bpm }` par séance, jamais l'objet playlist complet —
 * même en inspectant la requête réseau, un visiteur ne peut pas voir plus
 * que le résumé chiffré affiché à l'écran.
 *
 * ⚠️ Point non vérifiable ici (bac à sable sans accès à un vrai projet
 * Supabase) : la fonction `get_public_profile_summary` elle-même. Sa
 * syntaxe JSONB a été relue avec soin mais jamais EXÉCUTÉE contre une vraie
 * base — voir supabase-schema.sql pour la marche à suivre avant de compter
 * dessus en prod (`select public.get_public_profile_summary('un_pseudo_test');`
 * dans l'éditeur SQL Supabase).
 *
 * "Refonte Structurale — Round 2/2" (01/08) — les playlists/routines
 * PUBLIQUES individuelles (pas seulement le résumé chiffré ci-dessus) sont
 * maintenant affichées, grâce à la migration relationnelle du Round 1/2
 * (`playlists`/`routines`, une VRAIE ligne par élément, voir
 * supabase-schema.sql). Récupérées via une requête DIRECTE (pas de
 * fonction RPC dédiée pour celles-ci) : la policy RLS resserrée fait déjà
 * tout le filtrage nécessaire (Login Wall + profil public du propriétaire
 * + `is_public` de la ligne elle-même) — voir le 2e `useEffect` plus bas
 * pour le détail.
 *
 * Profil vitrine "@tempofit_officiel" (Feature Sociale "Cold Start", 02/08,
 * voir data/officialVitrineProfile.js) — CAS SPÉCIAL, court-circuité tout
 * en tête des 2 `useEffect` ci-dessous, AVANT même le Login Wall : jamais
 * stocké en base, entièrement reconstruit côté client, accessible à
 * n'importe qui (y compris non connecté) pour montrer le potentiel de
 * l'app avant même la création d'un compte. Voir ce fichier pour le
 * raisonnement complet.
 */

// Agrège une liste de séances `{ totalDuration, bpm }` (déjà filtrée/
// anonymisée côté serveur) en un résumé chiffré — même calcul que
// StatsView.jsx (`totalSeconds`/`avgBpm`), rejoué ici sur un sous-ensemble
// de champs volontairement réduit. Fonction PURE, testable isolément.
export function summarizeSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  let totalSeconds = 0, bpmSum = 0, bpmCount = 0;
  sessions.forEach(s => {
    totalSeconds += Number(s?.totalDuration) || 0;
    const bpm = Number(s?.bpm);
    if (bpm > 0) { bpmSum += bpm; bpmCount += 1; }
  });
  return {
    totalSeconds,
    avgBpm: bpmCount > 0 ? Math.round(bpmSum / bpmCount) : null,
    sessionCount: sessions.length,
  };
}

// Carte d'une playlist/routine PUBLIQUE, vue par un visiteur — Feature
// Sociale — Refonte Structurale Round 2/2 (01/08). Délibérément un
// composant À PART, PAS une réutilisation de PlaylistCard.jsx : celui-ci
// est plein d'actions réservées au PROPRIÉTAIRE (supprimer, marquer comme
// faite, planifier une date, glisser-déposer...) qui n'ont aucun sens pour
// un visiteur consultant la playlist de quelqu'un d'autre — l'inclure tel
// quel aurait soit exigé de désactiver la moitié de ses props un par un,
// soit exposé par erreur des actions qui écriraient dans les données de
// quelqu'un d'autre (RLS les bloquerait côté serveur, mais autant ne
// jamais les afficher en premier lieu). `item` = une LIGNE brute de
// `playlists`/`routines` (voir supabase-schema.sql) : `item.content` porte
// l'objet complet (mêmes champs qu'un objet playlist/routine normal côté
// app, voir useSyncedCollection.js).
// `kind` distingue playlist ('playlist', par défaut) et routine ('routine')
// — Vague 2, Chantier 1 (UI publique des routines, 02/08). Les deux tables
// (`playlists`/`routines`) partagent la même structure de LIGNE
// (id/user_id/content/is_public/is_intimate, voir supabase-schema.sql),
// mais PAS la même forme de `content` : une playlist déjà générée porte de
// vrais titres + `totalDuration` + `config.bpm` (calculés une fois pour
// toutes à la génération), tandis qu'une routine n'est qu'une CONFIG
// jamais encore lancée — `bpm` à la racine (pas de `config`), pas de
// `totalDuration` (rien n'a encore été généré), pas de `coverUrl` (une
// routine n'a jamais de vraie pochette, seulement l'emoji `coverIcon`
// choisi par son propriétaire, même affichage que RoutinesView.jsx).
// AVANT ce chantier, cette carte utilisait aveuglément les champs
// playlist pour les deux — `avgBpm`/`totalMinutes` restaient donc
// silencieusement vides pour une routine (bug jamais visible tant
// qu'aucune routine n'était publique, voir la note plus bas sur
// `visibleRoutines`).
function PublicItemCard({ item, theme, onClick, kind = 'playlist' }) {
  const { cardBg, cardBorder, textHighlight, textMuted } = theme;
  const content = item.content || {};
  const isRoutine = kind === 'routine';

  const totalMinutes = !isRoutine ? Math.round((content.totalDuration || 0) / 60) : null;
  const avgBpm = isRoutine ? (content.bpm ?? null) : (content.config?.bpm ?? null);
  const distanceOrDuration = isRoutine
    ? (content.targetMode === 'distance' ? `${content.distanceVal} ${content.distanceUnit}` : `${content.hours || 0}h ${content.minutes || 0}m`)
    : null;
  const phaseLabel = isRoutine && content.isIntervalMode ? (content.isCrescendoMode ? 'Crescendo' : 'Fractionné') : null;

  // Pochette RÉELLE (01/08, relecture globale — manquait ici, présente
  // partout ailleurs dans l'app) — même pattern EXACT que TemplateCard.jsx/
  // PlaylistCard.jsx : `content.coverUrl` si déjà posé (import CSV/partage),
  // sinon générée de façon déterministe depuis le nom (utils/coverArt.js,
  // aucun appel réseau à faire pour la CALCULER, seulement pour charger
  // l'image elle-même). Uniquement pour les PLAYLISTS — une routine
  // affiche son médaillon emoji à la place (voir plus bas), jamais cette
  // pochette générée qui suggérerait à tort qu'une vraie séance existe.
  const coverUrl = !isRoutine ? (content.coverUrl || buildCoverUrl(content.name || 'Séance')) : null;

  return (
    <div
      className={`${cardBg} rounded-2xl p-4 border ${cardBorder} shadow-xs ${onClick ? 'cursor-pointer hover:border-gray-400 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-2">
        {isRoutine ? (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-black/5 dark:bg-white/5`}>
            {content.coverIcon || '⚡'}
          </div>
        ) : (
          <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/5 dark:bg-white/5 ${textMuted}`}>
            <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="min-w-0">
          <h4 className={`font-bold text-sm truncate ${textHighlight}`}>{content.name || 'Séance'}</h4>
          {content.workoutType && <p className={`text-xs truncate ${textMuted}`}>{content.workoutType}</p>}
        </div>
      </div>
      {/* Badge "Clone"/"Enfant" (02/08, discussion produit ; refonte
          03/08 — voir supabase-schema.sql) — UNIQUEMENT si
          `item.parent_user_id` existe (VRAIE colonne, jamais `content` :
          cet item fait partie d'une lignée de clonage, sinon rien à
          signaler, une création originale n'est ni Clone ni Enfant).
          "Clone" = copie fidèle, jamais modifiée depuis
          (`isModifiedSinceClone` toujours `false`, cosmétique seulement —
          reste dans `content`, un mauvais affichage de badge n'a jamais
          d'impact sur le compteur lui-même) ; "Enfant" = au moins une
          modification depuis (renommage, description...), PEU IMPORTE
          l'ampleur — la lignée ne se rompt JAMAIS, seule l'ÉTIQUETTE
          affichée change, pour rester honnête sur "copie fidèle" vs
          "dérivée". Modèle volontairement simple : un booléen, jamais un
          seuil de "modification substantielle" (arbitraire et lui-même
          contournable). */}
      {item.parent_user_id && (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1 ${textMuted} bg-black/5 dark:bg-white/10`}>
          {content.isModifiedSinceClone ? 'Enfant' : 'Clone'}
        </span>
      )}
      <div className={`flex items-center gap-3 text-xs ${textMuted}`}>
        {isRoutine
          ? distanceOrDuration && <span className="flex items-center gap-1"><Clock size={12}/>{distanceOrDuration}</span>
          : totalMinutes > 0 && <span className="flex items-center gap-1"><Clock size={12}/>{totalMinutes} min</span>
        }
        {phaseLabel
          ? <span className="flex items-center gap-1"><Zap size={12}/>{phaseLabel}</span>
          : avgBpm != null && <span className="flex items-center gap-1"><Gauge size={12}/>{avgBpm} BPM</span>
        }
        {/* Compteur de clonages (02/08) — `item.clone_count` est une VRAIE
            colonne de la ligne `playlists`/`routines` (pas un champ de
            `content`, contrairement à tout le reste affiché ici : voir
            supabase-schema.sql pour pourquoi — un compteur incrémenté par
            n'importe qui doit être atomique, ce qu'une colonne réelle
            garantit et un blob jsonb réécrit entièrement à chaque fois
            ne garantirait pas).
            ⚠️ HARMONISÉ (05/08, retour direct : "je ne vois pas le nombre
            de clones... si c'est 0 alors pas grave de laisser 0") : le
            garde `> 0` retiré — TOUJOURS affiché désormais, même
            incohérence corrigée avec TemplateCard.jsx (`cloneCount = 0`
            par défaut, jamais caché) repérée à cette occasion. Décision
            explicitement confirmée avant ce correctif plutôt que supposée :
            la raison d'origine ("un compteur vide n'apporte rien") reste
            défendable en soi, mais moins forte une fois que l'app affiche
            déjà 0 sans complexe ailleurs — 2 règles différentes pour la
            même donnée n'avait plus de justification claire. */}
        <span className="flex items-center gap-1" title="Nombre de fois où cette playlist/routine a été clonée">
          <Copy size={12}/>{item.clone_count || 0}
        </span>
      </div>
      {/* Description libre (Vague 2, Chantier 3 — "description texte libre
          sur une playlist/routine publique", 02/08) — champ COMMUN aux
          deux formes de `content` (contrairement à bpm/durée/genre plus
          haut, qui divergent selon `kind` — voir la docstring en tête de
          ce composant) : `description` est un simple texte libre, jamais
          généré, donc pas de branchement `isRoutine` nécessaire ici.
          `line-clamp-1` (05/08, resserré depuis `line-clamp-2` — retour
          direct : "je voulais UNE ligne max ; pas 2") : une carte de grille
          reste compacte même pour une description proche de
          `MAX_DESCRIPTION_LENGTH`. ⚠️ Contrairement à l'ancienne version de
          ce commentaire, le texte complet n'est PLUS consultable ailleurs
          (modale d'aperçu PublicRoutinePreviewModal.jsx, vue détail
          PlaylistHeader.jsx) — ces deux endroits sont désormais AUSSI en
          `line-clamp-1`, même décision de troncature sèche partout, sans
          exception ni "Voir plus" nulle part. */}
      {content.description && (
        <p className={`text-xs mt-2 line-clamp-1 ${textMuted}`}>{content.description}</p>
      )}
    </div>
  );
}

export default function ProfileView({ theme, username, isNaughtyMode, changeView, user, openModal, onOpenPlaylist, onOpenRoutine }) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, inputBg, inputBorder } = theme;

  const [status, setStatus] = useState('loading'); // 'loading' | 'login_wall' | 'not_found' | 'ready'
  const [profile, setProfile] = useState(null);
  // Playlists/routines publiques du profil consulté — récupérées
  // SÉPARÉMENT du résumé chiffré ci-dessus (2e effet, ci-dessous), une fois
  // `profile.user_id` connu. `itemsLoaded` distingue "pas encore chargé"
  // de "chargé, 0 résultat" — indispensable pour ne pas afficher l'état
  // vide un court instant avant que la vraie réponse n'arrive.
  const [publicItems, setPublicItems] = useState({ playlists: [], routines: [] });
  const [itemsLoaded, setItemsLoaded] = useState(false);
  // Barre de filtres pliable sur mobile (brief "Recherche & filtres sur
  // les profils publics", 02/08, ergonomie point 6) — repliée par défaut :
  // la recherche texte seule (toujours visible) couvre déjà le cas d'usage
  // le plus courant, les filtres avancés sont une option, pas une étape
  // obligatoire.
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setProfile(null);

    // Profil vitrine "@tempofit_officiel" (Feature Sociale "Cold Start",
    // 02/08) — VÉRIFIÉ EN TOUT PREMIER, avant même `isSupabaseConfigured`/
    // le Login Wall ci-dessous : contrairement à un vrai profil, celui-ci
    // doit rester accessible à TOUT LE MONDE, y compris un visiteur NON
    // connecté (voire sans Supabase configuré du tout) — l'objectif même
    // de cette vitrine ("inspirer les nouveaux utilisateurs", brief) serait
    // manqué si elle exigeait justement ce qu'un nouvel utilisateur n'a pas
    // encore : un compte. Entièrement synchrone, aucun appel réseau.
    if (username === OFFICIAL_VITRINE_USERNAME) {
      setProfile(buildOfficialVitrineProfile());
      setStatus('ready');
      return;
    }

    if (!isSupabaseConfigured || !username) { setStatus('not_found'); return; }
    // Login Wall — vérifié ICI, avant même de construire l'appel réseau :
    // pas la peine de solliciter Supabase pour un appel qu'on sait déjà
    // voué à être refusé côté serveur (voir la docstring plus haut, double
    // verrou). Dépend de `user` dans le tableau de deps ci-dessous : si la
    // personne se connecte PENDANT qu'elle est sur cet écran verrouillé
    // (via le bouton "Se connecter" plus bas), le profil se charge alors
    // automatiquement, sans avoir à recharger la page.
    if (!user) { setStatus('login_wall'); return; }

    (async () => {
      // BUG CORRIGÉ (01/08, "profil figé sur d'anciennes données") —
      // c'était en réalité un cache navigateur, pas un bug de données/
      // logique : confirmé via une journalisation complète temporaire (voir
      // historique), retirée ici puisqu'elle a rempli son rôle. Reste
      // uniquement `console.error` sur une vraie erreur Supabase — cohérent
      // avec le reste du projet (jamais d'échec totalement silencieux),
      // sans bruit de succès à chaque visite de profil.
      const { data, error } = await supabase.rpc('get_public_profile_summary', { target_username: username });
      if (cancelled) return;
      if (error) {
        console.error('[ProfileView] get_public_profile_summary a renvoyé une erreur :', error);
        setStatus('not_found');
        return;
      }
      if (!data) { setStatus('not_found'); return; }
      setProfile(data);
      setStatus('ready');
    })();

    return () => { cancelled = true; };
  }, [username, user]);

  // Récupération des playlists/routines publiques (Feature Sociale —
  // Refonte Structurale Round 2/2, 01/08) — DÉCLENCHÉE UNIQUEMENT une fois
  // `status === 'ready'` (profil résolu, `profile.user_id` connu — voir
  // l'ajout de ce champ dans get_public_profile_summary,
  // supabase-schema.sql). Requête DIRECTE sur `playlists`/`routines`
  // (`.select('*').eq('user_id', ...)`, pas de fonction RPC dédiée) : la
  // policy RLS resserrée (Login Wall + `is_profile_public` du propriétaire
  // + `is_public` de la ligne elle-même, voir supabase-schema.sql) fait
  // déjà tout le travail de filtrage — un visiteur authentifié qui
  // interroge directement cette table ne reçoit QUE ce qu'il a le droit de
  // voir, RLS oblige, quelle que soit la requête envoyée.
  //
  // Filtrage par MODE (`is_intimate`) fait ICI, côté client, APRÈS la
  // requête plutôt que dans le `.eq(...)` — `isNaughtyMode` change en
  // direct si le visiteur bascule de mode SANS recharger la page (bouton
  // Sidebar), un `.eq('is_intimate', isNaughtyMode)` dans la requête
  // réseau aurait demandé de relancer un fetch à chaque bascule ; filtrer
  // un tableau déjà en mémoire est instantané, aucun aller-retour réseau
  // nécessaire pour ce cas précis.
  useEffect(() => {
    if (status !== 'ready') { setItemsLoaded(false); return; }

    // Vitrine — playlists injectées directement depuis le catalogue
    // (data/curatedSessions.js), jamais depuis Supabase (`profile.user_id`
    // vaut `null` pour ce profil mocké, ne déclencherait de toute façon
    // jamais le vrai fetch ci-dessous — mais mieux vaut un court-circuit
    // explicite qu'un `itemsLoaded` qui resterait bloqué à `false` pour
    // toujours faute de condition remplie). Catalogue Sport ET Intime
    // CONFONDUS ici aussi, pour les playlists ET pour les routines (voir
    // buildOfficialVitrinePlaylistRows/buildOfficialVitrineRoutineRows) —
    // le filtrage par mode reste le même code EXISTANT juste en dessous
    // (`visiblePlaylists`/`visibleRoutines`), aucune duplication de cette
    // logique.
    //
    // ⚠️ Devenu ASYNCHRONE le 02/08 (retour direct : "je veux que le
    // compteur de clonage soit honnête, 0 par défaut") — auparavant
    // entièrement synchrone (nombres "ambitieux mais faux",
    // `fakeCloneCountForId`, RETIRÉE). Récupère maintenant les VRAIS
    // totaux (`template_clone_counts`, supabase-schema.sql — table
    // PUBLIQUE en lecture, accessible même sans compte, cohérent avec le
    // reste de cette vitrine) avant de construire les lignes — `cancelled`
    // local à cette branche (distinct de celui plus bas, propre au chemin
    // "vrai profil") : si le visiteur navigue ailleurs pendant ce court
    // fetch, `setPublicItems` ne s'exécute jamais sur un composant démonté.
    if (username === OFFICIAL_VITRINE_USERNAME) {
      let cancelled = false;
      (async () => {
        let realCloneCounts = {};
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('template_clone_counts').select('template_id, clone_count');
          if (error) {
            console.error('[ProfileView] échec de la récupération des compteurs de clonage réels (vitrine) :', error);
          } else if (data) {
            realCloneCounts = Object.fromEntries(data.map(row => [row.template_id, row.clone_count]));
          }
        }
        if (cancelled) return;
        setPublicItems({
          playlists: buildOfficialVitrinePlaylistRows(realCloneCounts),
          routines: buildOfficialVitrineRoutineRows(realCloneCounts),
        });
        setItemsLoaded(true);
      })();
      return () => { cancelled = true; };
    }

    if (!profile?.user_id) { setItemsLoaded(false); return; }

    let cancelled = false;
    setItemsLoaded(false);

    (async () => {
      // `.eq('is_public', true)` EXPLICITE (01/08, relecture globale, trouvé
      // en vérifiant le cas "je consulte mon PROPRE profil") — sans ce
      // filtre, RLS (voir supabase-schema.sql) laisse passer TOUTES les
      // lignes d'un propriétaire qui consulte SES PROPRES données
      // (`auth.uid() = user_id`, la 1re branche du `using(...)`) — ce qui
      // est le comportement VOULU pour l'app normale (Mes Séances doit
      // montrer TOUT, public ou privé), mais PAS ici : la vue Profil se
      // veut un APERÇU de ce qu'un visiteur externe verrait, y compris
      // pour son propre propriétaire (voir `isSelf`/bannière plus bas) —
      // sans ce filtre, se visiter soi-même aurait montré ses playlists
      // PRIVÉES aussi, résultat trompeur et un vrai souci de
      // confidentialité si l'écran était partagé/projeté.
      const [playlistsResult, routinesResult] = await Promise.all([
        supabase.from('playlists').select('*').eq('user_id', profile.user_id).eq('is_public', true),
        supabase.from('routines').select('*').eq('user_id', profile.user_id).eq('is_public', true),
      ]);
      if (cancelled) return;

      if (playlistsResult.error) {
        console.error('[ProfileView] Récupération des playlists publiques échouée :', playlistsResult.error);
      }
      if (routinesResult.error) {
        console.error('[ProfileView] Récupération des routines publiques échouée :', routinesResult.error);
      }

      setPublicItems({
        playlists: playlistsResult.data || [],
        routines: routinesResult.data || [],
      });
      setItemsLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [status, profile?.user_id, username]);

  // Cloisonnement contextuel (brief, tâche 2) — même règle EXACTE que les
  // blocs de stats plus haut : `!!` normalise `is_intimate` (colonne
  // Postgres, toujours un vrai booléen, mais `!!` reste une garde peu
  // coûteuse et cohérente avec le reste du fichier) avant comparaison à
  // `isNaughtyMode`.
  const visiblePlaylists = useMemo(
    () => publicItems.playlists.filter(row => !!row.is_intimate === !!isNaughtyMode),
    [publicItems.playlists, isNaughtyMode]
  );
  const visibleRoutines = useMemo(
    () => publicItems.routines.filter(row => !!row.is_intimate === !!isNaughtyMode),
    [publicItems.routines, isNaughtyMode]
  );

  // Recherche & filtres (brief "Recherche & filtres sur les profils
  // publics", 02/08) — `kind` posé ICI, au moment de combiner les deux
  // tableaux — ni `playlists` ni `routines` (supabase-schema.sql) n'ont de
  // colonne équivalente en base, ce n'est qu'une étiquette d'affichage
  // locale à ce composant. `combinedVisibleItems` sert encore au total de
  // clonages reçus juste en dessous (calculé sur les 2 types à la fois) —
  // mais plus à la grille elle-même, voir `itemsForActiveTab` plus bas.
  //
  // `useMemo` en cascade (`visiblePlaylists`/`visibleRoutines` ci-dessus
  // ET `combinedVisibleItems` ici) : sans ça, une NOUVELLE référence de
  // tableau serait produite à CHAQUE rendu (y compris ceux déclenchés par
  // une frappe dans le champ de recherche lui-même), invalidant le
  // `useMemo` interne de `useProfileSearchFilter` pour rien à chaque
  // caractère tapé.
  const combinedVisibleItems = useMemo(() => [
    ...visiblePlaylists.map(row => ({ ...row, kind: 'playlist' })),
    ...visibleRoutines.map(row => ({ ...row, kind: 'routine' })),
  ], [visiblePlaylists, visibleRoutines]);

  // Onglets Playlists/Routines — REFONTE (03/08, retour direct : "les
  // routines sont invisibles, noyées en bas d'une grille de playlists" —
  // capture d'écran à l'appui, 27 cartes de playlists avant la 1re
  // routine). Remplace la grille combinée du 02/08 (voir git blame de ce
  // fichier et de useProfileSearchFilter.js pour l'ancienne version) —
  // les onglets Playlists/Routines avaient été explicitement écartés du
  // scope à l'époque (remplacés par le filtre "Type" ci-dessous, retiré
  // avec cette refonte), pas rejetés sur le fond. `'playlist'` par défaut
  // (cohérent avec le libellé de section historique "Playlists
  // partagées").
  const [activeProfileTab, setActiveProfileTab] = useState('playlist'); // 'playlist' | 'routine'

  // Recherche/filtres restent PARTAGÉS entre les 2 onglets (même state,
  // voir la docstring de useProfileSearchFilter.js) — seul l'ENSEMBLE
  // d'items passé au hook change selon l'onglet actif, ce qui recalcule
  // aussi `availableSports`/`availableGenres` pour ne proposer QUE ce qui
  // existe réellement dans l'onglet affiché.
  const itemsForActiveTab = useMemo(
    () => combinedVisibleItems.filter(item => item.kind === activeProfileTab),
    [combinedVisibleItems, activeProfileTab]
  );

  // Total de clonages reçus (02/08) — calculé côté CLIENT à partir de ce
  // qui est DÉJÀ chargé (`combinedVisibleItems`), pas une nouvelle requête
  // Supabase : `visiblePlaylists`/`visibleRoutines` viennent d'un
  // `select('*')` frais à chaque visite de ce profil (voir plus haut),
  // `clone_count` y est donc déjà présent et à jour sans rien faire de
  // plus. Toujours dans le mode affiché (Sport OU Intime, jamais les
  // deux mélangés — `combinedVisibleItems` est déjà filtré par mode via
  // `visiblePlaylists`/`visibleRoutines`), cohérent avec la séparation
  // stricte Sport/Intime appliquée partout ailleurs dans ce composant.
  // Volontairement calculé sur les 2 onglets À LA FOIS (pas juste l'actif)
  // — c'est un total de réputation globale, pas une stat propre à un
  // onglet, il ne doit pas changer selon l'onglet consulté.
  const totalCloneCount = useMemo(
    () => combinedVisibleItems.reduce((sum, item) => sum + (item.clone_count || 0), 0),
    [combinedVisibleItems]
  );

  const {
    searchText, setSearchText,
    durationFilter, setDurationFilter,
    sportFilter, setSportFilter,
    genreFilter, setGenreFilter,
    availableSports, availableGenres,
    filteredItems, hasActiveFilters, resetFilters,
  } = useProfileSearchFilter(itemsForActiveTab);

  // Résumés chiffrés — `null` si la fonction serveur n'a pas renvoyé ce
  // tableau du tout (bascule de confidentialité désactivée côté
  // propriétaire), DISTINCT de "renvoyé mais vide" (aucune séance
  // enregistrée dans ce mode — un résumé à 0 reste un résumé à afficher,
  // pas une raison de masquer toute la section).
  //
  // ⚠️ OPTIMISATION (audit perf, 07/08) — `summarizeSessions` (fonction
  // PURE, exportée et testée isolément, voir ProfileView.test.jsx —
  // volontairement PAS touchée elle-même) tournait sur CHAQUE rendu de ce
  // composant, y compris chaque frappe dans le champ de recherche
  // (`searchText`, state du hook `useProfileSearchFilter` appelé plus bas
  // dans CE composant — chaque frappe re-render donc `ProfileView`
  // lui-même), alors que `profile.sport_sessions`/`profile.intimate_sessions`
  // ne changent JAMAIS pendant la frappe (seulement au chargement initial
  // du profil). `useMemo` sur ces 2 tableaux précis, pas sur `profile`
  // entier (qui contient d'autres champs sans rapport, voir `isSelf` plus
  // bas) — évite tout recalcul inutile pendant la frappe, sans changer le
  // résultat.
  const sportSummary = useMemo(
    () => profile?.sport_sessions !== undefined ? summarizeSessions(profile.sport_sessions) : null,
    [profile?.sport_sessions]
  );
  const intimateSummary = useMemo(
    () => profile?.intimate_sessions !== undefined ? summarizeSessions(profile.intimate_sessions) : null,
    [profile?.intimate_sessions]
  );

  // Double condition pour les stats Intime — le consentement du
  // PROPRIÉTAIRE (`intimate_sessions` renvoyé par le serveur seulement si
  // `show_intimate_stats` est vrai) ET le mode actuel du VISITEUR
  // (`isNaughtyMode`, purement local à cette session de navigation) :
  // les deux sont nécessaires, voir la docstring du brief pour le
  // raisonnement complet (ne jamais révéler une facette Intime à un
  // visiteur qui n'a pas lui-même activé ce mode, écran partagé ou non).
  const showIntimateBlock = isNaughtyMode && profile?.intimate_sessions !== undefined;
  const showSportBlock = !isNaughtyMode && profile?.sport_sessions !== undefined;

  // isSelf (01/08, relecture globale, retour direct : "j'ai l'impression
  // que tu as pas imaginé le cas où je visite mon propre profil") — vrai
  // uniquement quand le VISITEUR connecté est le PROPRIÉTAIRE du profil
  // consulté. Sert à 2 choses : (1) la bannière "Aperçu de ton profil"
  // ci-dessous, (2) implicitement, `handleOpenPublicPlaylist` (App.jsx)
  // fait sa PROPRE vérification équivalente pour éviter de proposer de
  // cloner/republier une playlist déjà sienne — pas dupliquée ici, ce
  // composant n'a pas besoin de le savoir pour lui-même.
  const isSelf = !!(user && profile?.user_id === user.id);

  return (
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-6`}>
      <button
        onClick={() => changeView('generator')}
        className="mb-2 text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
      >
        ← Retour
      </button>

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center text-center py-24 gap-3">
          <Loader2 size={32} className={`animate-spin ${textMuted}`} />
        </div>
      )}

      {status === 'login_wall' && (
        <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bgAccentClass} text-white`}>
            <Lock size={28} />
          </div>
          <p className={`font-bold text-xl ${textHighlight}`}>Rejoins la communauté TempoFit</p>
          <p className={`text-sm max-w-sm ${textMuted}`}>
            Connecte-toi ou crée un compte pour découvrir les statistiques et les playlists de @{username}.
          </p>
          <button
            onClick={() => openModal('AUTH')}
            className={`mt-2 px-6 py-3 rounded-xl font-bold text-white shadow-md hover:brightness-110 transition-all ${bgAccentClass}`}
          >
            Se connecter / S'inscrire
          </button>
        </div>
      )}

      {status === 'not_found' && (
        <div className="flex flex-col items-center justify-center text-center py-24 gap-3">
          <UserX size={40} className={textMuted} />
          <p className={`font-bold text-lg ${textHighlight}`}>Ce profil est privé ou introuvable.</p>
          <p className={`text-sm ${textMuted}`}>Vérifie le lien, ou demande à la personne concernée si son profil est bien public.</p>
        </div>
      )}

      {status === 'ready' && profile && (
        <>
          {/* Bannière "Aperçu de ton profil" (01/08, relecture globale,
              retour direct de l'utilisateur) — visible UNIQUEMENT quand le
              visiteur EST le propriétaire (`isSelf`). Rappelle explicitement
              que cette page montre exactement ce qu'un VISITEUR externe
              verrait (voir le filtre `is_public=true` explicite plus haut) —
              sans ce rappel, se voir soi-même sur cette page pourrait
              laisser croire à tort qu'il s'agit de la vue normale "Mes
              Séances" plutôt que d'un aperçu délibérément restreint. */}
          {isSelf && (
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${cardBorder} ${cardBg}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bgAccentClass} text-white`}>
                <Eye size={16} />
              </div>
              <p className={`text-sm font-medium ${textHighlight}`}>
                Aperçu de ton profil — c'est exactement ce qu'une personne connectée verrait en visitant ton profil.
              </p>
            </div>
          )}

          <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl flex items-center gap-4`}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${bgAccentClass} text-white font-black text-2xl`}>
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className={`text-2xl font-black truncate ${textHighlight}`}>@{username}</h1>
              <p className={`text-sm ${textMuted}`}>Profil TempoFit</p>
            </div>
          </div>

          {showSportBlock && (
            <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
              <h3 className={`font-bold text-lg mb-4 ${textHighlight}`}>Statistiques sportives</h3>
              {sportSummary ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className={`rounded-2xl p-4 border ${cardBorder} bg-black/5 dark:bg-white/5`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${textMuted}`}><Clock size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">Temps total</span></div>
                    <p className={`text-xl font-black ${textHighlight}`}>{formatDuration(sportSummary.totalSeconds)}</p>
                  </div>
                  <div className={`rounded-2xl p-4 border ${cardBorder} bg-black/5 dark:bg-white/5`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${textMuted}`}><Gauge size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">BPM moyen</span></div>
                    <p className={`text-xl font-black ${textHighlight}`}>{sportSummary.avgBpm ?? '—'}</p>
                  </div>
                  <div className={`rounded-2xl p-4 border ${cardBorder} bg-black/5 dark:bg-white/5`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${textMuted}`}><ListMusic size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">Séances</span></div>
                    <p className={`text-xl font-black ${textHighlight}`}>{sportSummary.sessionCount}</p>
                  </div>
                </div>
              ) : (
                <p className={`text-sm ${textMuted}`}>Aucune séance sportive enregistrée pour l'instant.</p>
              )}
            </div>
          )}

          {showIntimateBlock && (
            <div className="rounded-3xl p-6 md:p-8 border shadow-xl" style={{ background: 'linear-gradient(160deg, #1a0b12 0%, #0d0509 100%)', borderColor: 'rgba(244,63,94,0.3)' }}>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: '#ffffff' }}><Heart size={18} className="text-rose-500 fill-rose-500"/> Statistiques Mode Intime</h3>
              {intimateSummary ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' }}>
                    <div className="flex items-center gap-1.5 mb-1" style={{ color: 'rgba(255,255,255,0.60)' }}><Clock size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">Temps total</span></div>
                    <p className="text-xl font-black" style={{ color: '#ffffff' }}>{formatDuration(intimateSummary.totalSeconds)}</p>
                  </div>
                  <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' }}>
                    <div className="flex items-center gap-1.5 mb-1" style={{ color: 'rgba(255,255,255,0.60)' }}><Gauge size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">BPM moyen</span></div>
                    <p className="text-xl font-black" style={{ color: '#ffffff' }}>{intimateSummary.avgBpm ?? '—'}</p>
                  </div>
                  <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' }}>
                    <div className="flex items-center gap-1.5 mb-1" style={{ color: 'rgba(255,255,255,0.60)' }}><ListMusic size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">Séances</span></div>
                    <p className="text-xl font-black" style={{ color: '#ffffff' }}>{intimateSummary.sessionCount}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>Aucune séance enregistrée pour l'instant.</p>
              )}
            </div>
          )}

          {/* Playlists/routines partagées (Feature Sociale — Refonte
              Structurale Round 2/2, 01/08 ; routines cliquables/clonables
              depuis Vague 2, Chantier 1 — UI publique des routines, 02/08)
              — indépendant des 2 blocs de stats ci-dessus (pas de garde
              `showSportBlock`/`showIntimateBlock` ici) : la confidentialité
              d'une playlist/routine individuelle est un consentement
              SÉPARÉ (`playlists.is_public`/`routines.is_public` + le
              réglage global `is_profile_public`, voir
              supabase-schema.sql), jamais lié aux bascules
              `show_sport_stats`/`show_intimate_stats` qui, elles, ne
              concernent que les CHIFFRES agrégés plus haut. */}
          <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
              {/* Onglets Playlists/Routines (03/08, refonte — voir la
                  docstring de `activeProfileTab` plus haut). Remplace le
                  titre statique "Playlists partagées" : chaque onglet
                  affiche son propre compte, un visiteur qui veut
                  spécifiquement les routines n'a plus à scroller une
                  grille de playlists pour les trouver. */}
              <div className="flex items-center gap-1" role="tablist">
                {[
                  { value: 'playlist', label: 'Playlists', count: visiblePlaylists.length },
                  { value: 'routine', label: 'Routines', count: visibleRoutines.length },
                ].map(tab => (
                  <button
                    key={tab.value}
                    role="tab"
                    aria-selected={activeProfileTab === tab.value}
                    onClick={() => setActiveProfileTab(tab.value)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${
                      activeProfileTab === tab.value ? `${bgAccentClass} text-white` : `${textMuted} hover:text-main`
                    }`}
                  >
                    {tab.label} <span className="opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>
              {/* Total de clonages reçus — seulement si > 0 (même
                  raisonnement que le badge par item, voir PublicItemCard :
                  "0 clonage" n'est pas une information à mettre en avant).
                  Volontairement global aux 2 onglets (voir la docstring de
                  `totalCloneCount` plus haut) — ne change pas selon
                  l'onglet actif. */}
              {totalCloneCount > 0 && (
                <span className={`flex items-center gap-1.5 text-sm font-bold shrink-0 ${textMuted}`} title="Total des clonages reçus sur tes playlists/routines publiques, dans ce mode">
                  <Copy size={14}/> {totalCloneCount} clonage{totalCloneCount > 1 ? 's' : ''} reçu{totalCloneCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Recherche & filtres (brief "Recherche & filtres sur les
                profils publics", 02/08 ; onglets Playlists/Routines,
                03/08) — affichés dès qu'il y a au moins un item à filtrer
                DANS L'ONGLET ACTIF (`itemsForActiveTab.length > 0`, pas
                `combinedVisibleItems` — inutile de montrer une barre de
                recherche pour l'onglet Routines si seul l'onglet
                Playlists a du contenu). Champ de recherche TOUJOURS
                visible ; le reste (sport/genre/durée) est derrière
                `filtersExpanded` — repliable, cohérent avec l'ergonomie
                "compacte, pliable sur mobile" du brief d'origine. Le
                filtre "Type" (Toutes/Playlists/Routines) a été RETIRÉ ici
                — les onglets ci-dessus remplissent désormais ce rôle,
                les deux auraient fait doublon. */}
            {itemsLoaded && itemsForActiveTab.length > 0 && (
              <div className="mb-4 space-y-3">
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${inputBorder} ${inputBg}`}>
                  <Search size={18} className={textMuted} />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Rechercher un titre, un sport, un style..."
                    className={`flex-1 bg-transparent outline-hidden text-sm ${textHighlight}`}
                  />
                  <button
                    onClick={() => setFiltersExpanded(v => !v)}
                    className={`flex items-center gap-1 text-xs font-bold shrink-0 ${filtersExpanded ? textColorClass : textMuted} hover:text-main transition-colors`}
                    title={filtersExpanded ? "Masquer les filtres" : "Plus de filtres"}
                  >
                    <SlidersHorizontal size={15} />
                    <ChevronDown size={14} className={`transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {filtersExpanded && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Sport/genre/durée — dropdowns natifs, valeurs
                        générées DYNAMIQUEMENT à partir des items
                        réellement affichés (brief, points 4/5) — jamais
                        une liste figée qui listerait des sports/genres
                        absents de ce profil précis. */}
                    {availableSports.length > 0 && (
                      <select
                        value={sportFilter}
                        onChange={(e) => setSportFilter(e.target.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cardBorder} ${inputBg} ${textMuted} outline-hidden cursor-pointer`}
                      >
                        <option value="all">Tous les sports</option>
                        {availableSports.map(sport => <option key={sport} value={sport}>{sport}</option>)}
                      </select>
                    )}

                    {availableGenres.length > 0 && (
                      <select
                        value={genreFilter}
                        onChange={(e) => setGenreFilter(e.target.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cardBorder} ${inputBg} ${textMuted} outline-hidden cursor-pointer`}
                      >
                        <option value="all">Tous les genres</option>
                        {availableGenres.map(genre => <option key={genre} value={genre}>{genre}</option>)}
                      </select>
                    )}

                    {/* Durée — UNIQUEMENT significative pour une playlist
                        générée (`totalDuration`) ou une routine ciblant
                        une DURÉE (`targetMode: 'time'`) : voir
                        useProfileSearchFilter.js. Toujours affiché (pas
                        de garde conditionnelle ici) — sélectionner une
                        tranche exclut simplement de ses résultats les
                        items où la durée n'a pas de sens (ex. une routine
                        en mode distance), plutôt que de faire disparaître
                        le contrôle lui-même. */}
                    <select
                      value={durationFilter}
                      onChange={(e) => setDurationFilter(e.target.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cardBorder} ${inputBg} ${textMuted} outline-hidden cursor-pointer`}
                    >
                      <option value="all">Toutes durées</option>
                      <option value="short">Moins de 30 min</option>
                      <option value="medium">30-60 min</option>
                      <option value="long">Plus de 60 min</option>
                    </select>

                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${textMuted} hover:text-red-500 transition-colors`}
                      >
                        <X size={13} /> Réinitialiser
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {!itemsLoaded ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className={`animate-spin ${textMuted}`} />
              </div>
            ) : itemsForActiveTab.length === 0 ? (
              <p className={`text-sm text-center py-4 ${textMuted}`}>
                {activeProfileTab === 'routine'
                  ? 'Aucune routine publique dans ce mode pour le moment.'
                  : 'Aucune playlist publique dans ce mode pour le moment.'}
              </p>
            ) : filteredItems.length === 0 ? (
              // État vide DISTINCT de "aucun contenu public du tout" —
              // brief, section Ergonomie : un profil peut avoir du contenu
              // public, juste rien qui corresponde aux filtres actifs.
              <div className="text-center py-8">
                <SearchX size={28} className={`mx-auto mb-2 ${textMuted}`} />
                <p className={`text-sm mb-3 ${textMuted}`}>Aucune séance ne correspond à vos filtres.</p>
                <button onClick={resetFilters} className={`text-xs font-bold ${textColorClass} hover:underline`}>
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Routines cliquables (Vague 2, Chantier 1 — UI publique
                    des routines, 02/08) — ouvre PublicRoutinePreviewModal
                    (App.jsx, `handleOpenPublicRoutine`) plutôt qu'une
                    navigation directe : contrairement à une playlist, une
                    routine n'a pas de vue détail dédiée à afficher en
                    lecture seule. `item.kind` (posé au moment de combiner
                    les 2 tableaux, voir `combinedVisibleItems` plus haut)
                    détermine à la fois le rendu de la carte et le bon
                    gestionnaire de clic. */}
                {filteredItems.map(item => (
                  <PublicItemCard
                    key={item.id}
                    item={item}
                    theme={theme}
                    kind={item.kind}
                    onClick={() => {
                      // `kind` est une étiquette PUREMENT interne à ce
                      // composant (posée dans `combinedVisibleItems`, plus
                      // haut, pour combiner playlists/routines dans une
                      // seule grille) — jamais un champ réel des tables
                      // `playlists`/`routines` (supabase-schema.sql).
                      // BUG CORRIGÉ (02/08, build Vercel réel) : `item`
                      // était transmis TEL QUEL à `onOpenPlaylist`/
                      // `onOpenRoutine`, qui reçoivent normalement la ligne
                      // BRUTE (voir `handleOpenPublicPlaylist`/
                      // `handleOpenPublicRoutine`, App.jsx) — `kind`
                      // s'invitait donc dans leur payload sans jamais y
                      // avoir sa place. Inoffensif en pratique (ces
                      // fonctions ignorent les champs qu'elles ne lisent
                      // pas), mais un détail d'implémentation de CE
                      // composant n'a rien à faire dans un contrat partagé
                      // avec App.jsx — la ligne repart donc ici exactement
                      // comme elle est arrivée.
                      // `_ownerUsername` (05/08, retour direct : "ajouter le
                      // nom du compte créateur... pour mieux se repérer")
                      // AJOUTÉ, lui, volontairement — seul cet endroit
                      // connaît le pseudo du profil consulté (`username`,
                      // prop de CE composant) ; `handleOpenPublicPlaylist`
                      // (App.jsx) n'a lui que `row.user_id`, un UUID sans
                      // valeur d'affichage. Préfixé `_` comme `kind` juste
                      // au-dessus, même raison : un champ ajouté par CE
                      // composant, pas un vrai champ des tables
                      // `playlists`/`routines`.
                      const { kind, ...rawRow } = item;
                      const rowWithOwner = { ...rawRow, _ownerUsername: username };
                      return kind === 'routine' ? onOpenRoutine(rowWithOwner) : onOpenPlaylist(rowWithOwner);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
