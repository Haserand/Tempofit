import { useEffect, useState } from 'react';
import { UserX, Loader2, Clock, Gauge, ListMusic, Heart, Lock, Music2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { formatDuration } from '../../utils/format';
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
function PublicItemCard({ item, theme, onClick }) {
  const { cardBg, cardBorder, textHighlight, textMuted } = theme;
  const content = item.content || {};
  const totalMinutes = Math.round((content.totalDuration || 0) / 60);
  const avgBpm = content.config?.bpm ?? null;

  return (
    <div
      className={`${cardBg} rounded-2xl p-4 border ${cardBorder} shadow-xs ${onClick ? 'cursor-pointer hover:border-gray-400 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-black/5 dark:bg-white/5 ${textMuted}`}>
          <Music2 size={20} />
        </div>
        <div className="min-w-0">
          <h4 className={`font-bold text-sm truncate ${textHighlight}`}>{content.name || 'Séance'}</h4>
          {content.workoutType && <p className={`text-xs truncate ${textMuted}`}>{content.workoutType}</p>}
        </div>
      </div>
      <div className={`flex items-center gap-3 text-xs ${textMuted}`}>
        {totalMinutes > 0 && <span className="flex items-center gap-1"><Clock size={12}/>{totalMinutes} min</span>}
        {avgBpm != null && <span className="flex items-center gap-1"><Gauge size={12}/>{avgBpm} BPM</span>}
      </div>
    </div>
  );
}

export default function ProfileView({ theme, username, isNaughtyMode, changeView, user, openModal, onOpenPlaylist }) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;

  const [status, setStatus] = useState('loading'); // 'loading' | 'login_wall' | 'not_found' | 'ready'
  const [profile, setProfile] = useState(null);
  // Playlists/routines publiques du profil consulté — récupérées
  // SÉPARÉMENT du résumé chiffré ci-dessus (2e effet, ci-dessous), une fois
  // `profile.user_id` connu. `itemsLoaded` distingue "pas encore chargé"
  // de "chargé, 0 résultat" — indispensable pour ne pas afficher l'état
  // vide un court instant avant que la vraie réponse n'arrive.
  const [publicItems, setPublicItems] = useState({ playlists: [], routines: [] });
  const [itemsLoaded, setItemsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setProfile(null);

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
    if (status !== 'ready' || !profile?.user_id) { setItemsLoaded(false); return; }

    let cancelled = false;
    setItemsLoaded(false);

    (async () => {
      const [playlistsResult, routinesResult] = await Promise.all([
        supabase.from('playlists').select('*').eq('user_id', profile.user_id),
        supabase.from('routines').select('*').eq('user_id', profile.user_id),
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
  }, [status, profile?.user_id]);

  // Cloisonnement contextuel (brief, tâche 2) — même règle EXACTE que les
  // blocs de stats plus haut : `!!` normalise `is_intimate` (colonne
  // Postgres, toujours un vrai booléen, mais `!!` reste une garde peu
  // coûteuse et cohérente avec le reste du fichier) avant comparaison à
  // `isNaughtyMode`.
  const visiblePlaylists = publicItems.playlists.filter(row => !!row.is_intimate === !!isNaughtyMode);
  const visibleRoutines = publicItems.routines.filter(row => !!row.is_intimate === !!isNaughtyMode);

  // Résumés chiffrés — `null` si la fonction serveur n'a pas renvoyé ce
  // tableau du tout (bascule de confidentialité désactivée côté
  // propriétaire), DISTINCT de "renvoyé mais vide" (aucune séance
  // enregistrée dans ce mode — un résumé à 0 reste un résumé à afficher,
  // pas une raison de masquer toute la section).
  const sportSummary = profile?.sport_sessions !== undefined ? summarizeSessions(profile.sport_sessions) : null;
  const intimateSummary = profile?.intimate_sessions !== undefined ? summarizeSessions(profile.intimate_sessions) : null;

  // Double condition pour les stats Intime — le consentement du
  // PROPRIÉTAIRE (`intimate_sessions` renvoyé par le serveur seulement si
  // `show_intimate_stats` est vrai) ET le mode actuel du VISITEUR
  // (`isNaughtyMode`, purement local à cette session de navigation) :
  // les deux sont nécessaires, voir la docstring du brief pour le
  // raisonnement complet (ne jamais révéler une facette Intime à un
  // visiteur qui n'a pas lui-même activé ce mode, écran partagé ou non).
  const showIntimateBlock = isNaughtyMode && profile?.intimate_sessions !== undefined;
  const showSportBlock = !isNaughtyMode && profile?.sport_sessions !== undefined;

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
              Structurale Round 2/2, 01/08) — indépendant des 2 blocs de
              stats ci-dessus (pas de garde `showSportBlock`/
              `showIntimateBlock` ici) : la confidentialité d'une playlist
              individuelle est un consentement SÉPARÉ (`playlists.is_public`
              + le réglage global `is_profile_public`, voir
              supabase-schema.sql), jamais lié aux bascules
              `show_sport_stats`/`show_intimate_stats` qui, elles, ne
              concernent que les CHIFFRES agrégés plus haut. Les routines
              sont récupérées/affichées elles aussi (brief, tâche 1) mais
              resteront très probablement TOUJOURS vides en pratique pour
              l'instant : aucun toggle "rendre publique" n'existe encore
              pour une routine dans l'app (contrairement aux playlists,
              voir PlaylistHeader.jsx/PlaylistCard.jsx) — prêt pour une
              future fonctionnalité, pas branché aujourd'hui. */}
          <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
            <h3 className={`font-bold text-lg mb-4 ${textHighlight}`}>Playlists partagées</h3>
            {!itemsLoaded ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className={`animate-spin ${textMuted}`} />
              </div>
            ) : (visiblePlaylists.length === 0 && visibleRoutines.length === 0) ? (
              <p className={`text-sm text-center py-4 ${textMuted}`}>Aucune playlist publique dans ce mode pour le moment.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {visiblePlaylists.map(row => (
                  <PublicItemCard key={row.id} item={row} theme={theme} onClick={() => onOpenPlaylist(row)} />
                ))}
                {/* Routines PAS cliquables (contrairement aux playlists
                    juste au-dessus) — la Consultation/Clonage (01/08) ne
                    couvre que les playlists (brief explicite : "playlists
                    publiques"), et il n'existe de toute façon encore
                    aucun toggle "rendre publique" pour une routine dans
                    l'app (voir la note plus haut) — en pratique cette
                    liste reste vide, mais si elle contenait un jour
                    quelque chose, mieux vaut une carte simplement
                    informative qu'un clic qui ne mène nulle part. */}
                {visibleRoutines.map(row => <PublicItemCard key={row.id} item={row} theme={theme} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
