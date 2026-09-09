import { useState, useEffect, useRef } from 'react';
import { Award, Share2, HelpCircle, Lock } from 'lucide-react';
import { TROPHIES_DATA, TROPHY_CATEGORIES } from '../../appConfig';
import ViewHeader from '../shared/ViewHeader';
import TabPills from '../shared/TabPills';
import TrophyShareCard from '../shared/TrophyShareCard';
import { useShareImage } from '../../contexts/ShareImageContext';
import { captureElementAsFile } from '../../utils/captureElementAsFile';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';

// Seuil de détection d'une capture ratée (01/09, voir la docstring de
// `shareTrophy` plus bas pour le récit complet) — mesuré empiriquement
// dans un bac à sable, PAS deviné : un visuel de trophée correctement
// rendu (fond dégradé + texte + icône) pèse ~366-376 Ko une fois capturé
// (`captureElementAsFile`, `scale: 2.7`), contre ~56 Ko pour le même
// visuel SANS son fond dégradé (juste l'emoji, qui a sa propre couleur
// intégrée et reste visible même quand tout le reste — en texte blanc —
// devient invisible sur un fond blanc/transparent). 150 Ko : à mi-chemin,
// avec une bonne marge de chaque côté, mesuré sur plusieurs trophées à
// texte court ET long pour écarter un faux positif sur un texte court.
const MIN_VALID_TROPHY_IMAGE_BYTES = 150000;
// Nombre de tentatives avant d'accepter le dernier résultat obtenu, même
// imparfait, plutôt que de bloquer indéfiniment — 3 tentatives avec un
// délai croissant (100ms/200ms) donnent largement le temps à un appareil
// chargé/lent de rattraper son retard sans pour autant risquer un blocage
// perceptible pour l'utilisateur (quelques centaines de ms au pire).
const MAX_CAPTURE_ATTEMPTS = 3;

/**
 * TrophiesView — vue "Mes Trophées" (mur des succès débloqués).
 *
 * Extrait de App.jsx (bloc `view === 'trophies'`). Purement affichage : la
 * logique de déblocage (`checkTrophies`) reste dans App.jsx, ce composant se
 * contente de lire `userStats.unlockedTrophies` et de déclencher `handleShare`
 * au clic sur "Partager mon exploit".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX PAGES DISTINCTES (retour direct : "avoir les trophées sur 2 pages
 * distinctes... les visibles dans un onglet spécifique et les secrets à
 * découvrir dans un autre") — remplace l'ancienne grille unique qui mélangeait
 * les deux, ce qui donnait une bonne moitié de cartes "Trophée secret"
 * identiques diluant visuellement les trophées à visée pédagogique. État
 * d'onglet purement local (`activeTab`) : éphémère, propre à cette page,
 * comme `showRawImportTable` dans PlaylistDetailView — pas besoin de le
 * remonter dans App.jsx.
 *
 * `trophy.secret` (TROPHIES_DATA, appConfig.js) fait toujours la distinction
 * entre les 2 groupes :
 * - Visibles : introduisent une FONCTIONNALITÉ (Mode Intime, import de
 *   données, Crescendo, mode clair, routines...) ou une progression/habitude
 *   — toujours affichés en entier (nom + description), même verrouillés, et
 *   maintenant groupés par catégorie (voir TROPHY_CATEGORIES) plutôt qu'en
 *   liste plate dans l'ordre historique d'ajout.
 * - Secrets : liés à un COMPORTEMENT précis (distance extrême, heure de la
 *   séance, série de jours, le rickroll...) — masqués en "easter egg" tant
 *   que non débloqués (icône générique, nom/description remplacés par "???"),
 *   affichés en une SEULE grille non catégorisée : les sous-catégoriser
 *   donnerait des indices sur leur thème avant même de les avoir débloqués,
 *   ce qui irait à l'encontre de la surprise qui fait leur intérêt.
 */
export default function TrophiesView({ theme, userStats, handleShare, isNaughtyMode, markTrophiesSeen }) {
  const { cardBg, cardBorder, textHighlight, textMuted } = theme;

  // Badge de notification "vu/pas vu" (03/08, retour direct, capture
  // d'écran — voir la docstring complète de `markTrophiesSeen`,
  // useUserStats.js) — appelé UNE FOIS à l'ouverture de cette page,
  // jamais à chaque re-render (tableau de dépendances vide, `[]`) : le
  // badge doit se vider dès qu'on MET LES YEUX sur la page, pas seulement
  // après une action précise dessus. Idempotent si rappelé (repose juste
  // `trophiesSeenCount` à la même valeur) — pas de garde-fou nécessaire
  // contre un double appel.
  useEffect(() => {
    markTrophiesSeen();
  }, []);
  const [activeTab, setActiveTab] = useState('visible');

  // Visuel partageable d'un trophée (01/09, voir la docstring de tête de
  // fichier) — MÊME principe que le Bilan Visuel de Séance
  // (PlaylistDetailView.jsx) : état partagé globalement via
  // ShareImageContext (ShareModal.jsx, rendu ailleurs dans App.jsx, doit
  // pouvoir le LIRE), carte hors écran capturée via `captureElementAsFile`
  // (réf DOM qui, elle, reste locale à CE composant). Contrairement au
  // Bilan de Séance (préparation asynchrone : pochettes à résoudre AVANT
  // capture), un trophée n'a qu'un emoji statique (`trophy.icon`,
  // appConfig.js) — la capture peut suivre le clic immédiatement, sans
  // étape de préparation réseau intermédiaire.
  const { setSummaryImageStatus, setSummaryImageFile, setSummaryImagePreviewUrl, setIncludeSummaryImage, summaryImageStatus, summaryImageContextKey, setSummaryImageContextKey } = useShareImage();
  const [sharingTrophy, setSharingTrophy] = useState(null);
  const trophyCardRef = useRef(null);
  // TOUJOURS le trophée du DERNIER clic sur "Partager mon exploit" (pas
  // celui capturé au moment où CETTE invocation de `shareTrophy` a
  // démarré) — même rôle que `currentPlaylistIdRef` dans
  // PlaylistDetailView.jsx : une `ref`, jamais un `state`, car lue APRÈS un
  // point d'attente asynchrone dans une fonction qui a pu être appelée une
  // 2e fois entre-temps (fermeture sur une valeur de state y serait
  // périmée, voir le même piège documenté ailleurs dans ce projet pour
  // `checkTrophies`/`userStatsRef`).
  const sharingTrophyIdRef = useRef(null);

  const shareTrophy = async (trophy) => {
    const contextKey = `trophy:${trophy.id}`;
    // Même clé de contexte que PlaylistDetailView.jsx (voir
    // ShareImageContext.jsx) — évite de régénérer inutilement si CE MÊME
    // trophée est déjà prêt (ex. double-clic, ou modale refermée puis
    // rouverte sans rien changer entre-temps), tout en régénérant
    // correctement si le "ready" en cache appartient à un AUTRE sujet
    // (une playlist, ou un trophée différent).
    if (summaryImageStatus === 'ready' && summaryImageContextKey === contextKey) {
      handleShare('trophy', trophy);
      return;
    }
    // Réinitialise tout AVANT de démarrer (même principe que le useEffect
    // de reset de PlaylistDetailView.jsx au changement de playlist) — sinon
    // l'aperçu d'un AUTRE partage précédent (playlist ou trophée différent)
    // pourrait rester affiché un court instant. Révoque l'URL d'objet
    // précédente pour éviter une fuite mémoire, même principe que les
    // autres previews blob de l'app.
    setSummaryImageStatus('loading');
    setSummaryImageContextKey(contextKey);
    setSummaryImageFile(null);
    setIncludeSummaryImage(true);
    setSummaryImagePreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    handleShare('trophy', trophy);
    setSharingTrophy(trophy);
    sharingTrophyIdRef.current = trophy.id;

    try {
      // ⚠️ BUG RÉEL EN PROD (01/09, capture d'écran envoyée par
      // l'utilisateur : 2e trophée partagé capturé quasi vierge — pas de
      // fond, pas de texte, juste les 2 emoji flottant à leur taille
      // naturelle, comme si le CSS/la mise en page n'avaient pas eu le
      // temps d'être appliqués avant la capture) — CAUSE : un simple
      // `setTimeout(resolve, 0)` planifie une TÂCHE, pas un PEINT ; rien ne
      // garantit qu'un repaint ait eu lieu entre le `setState` et
      // l'exécution de ce callback (fonctionnait au 1er essai par pure
      // chance de timing, pas par garantie — cassé dès qu'un 2e clic
      // arrivait pendant que le navigateur avait encore du travail en
      // attente). CORRIGÉ par un double `requestAnimationFrame` : le 1er
      // s'exécute juste AVANT le prochain repaint programmé, le 2e (posé
      // DEPUIS le 1er) s'exécute seulement APRÈS que ce repaint a eu lieu —
      // technique standard pour garantir qu'un changement de style/mise en
      // page a réellement été peint à l'écran avant de continuer,
      // nettement plus fiable qu'un délai fixe arbitraire (`captureElementAsFile`
      // ajoute lui-même encore 50ms par défaut ENSUITE, voir sa docstring —
      // les deux se cumulent plutôt que de se remplacer).
      //
      // ⚠️ 2e BUG RÉEL EN PROD, APRÈS ce 1er correctif (01/09, nouvelles
      // captures d'écran envoyées) : le double rAF a bien réglé le cas déjà
      // vu, mais un AUTRE trophée reste capturé quasi vierge ensuite. Point
      // commun révélateur entre les 2 échecs observés : SEULS les emoji
      // restent visibles (le logo 🏆 et l'icône du trophée) — jamais aucun
      // texte, jamais le fond. Un emoji a sa propre couleur intégrée
      // (ignore la couleur CSS) ; TOUT LE RESTE de ce composant est en
      // texte BLANC (`color: '#ffffff'`/`rgba(255,255,255,X)`) — si le
      // FOND DÉGRADÉ échoue spécifiquement à se capturer, ce texte blanc
      // devient invisible sur un fond blanc/transparent, exactement le
      // symptôme observé. Un double rAF garantit qu'un PEINT a eu lieu,
      // mais pas que le moteur de style ait fini de committer une
      // propriété `background` posée via `style={{...}}` React (valeur
      // recalculée à chaque rendu, contrairement à une classe Tailwind
      // statique déjà présente dans la feuille de style compilée) au
      // moment où html2canvas lit les styles calculés — d'où l'ajout d'un
      // reflow forcé (`element.offsetHeight`) juste avant chaque capture,
      // PLUS une vérification a posteriori avec nouvelle tentative
      // (ci-dessous) en toute dernière ligne de défense : mesuré
      // empiriquement (bac à sable, plusieurs trophées différents) qu'un
      // fichier PNG "vierge" (fond blanc + emoji seul) pèse ~56 Ko, contre
      // ~370 Ko pour un visuel correctement rendu (fond dégradé + texte +
      // icône) — un écart net et fiable, largement suffisant pour détecter
      // une capture ratée sans jamais faussement rejeter une capture
      // correcte. `MIN_VALID_TROPHY_IMAGE_BYTES` fixé à 150 Ko, à mi-chemin
      // avec une bonne marge des deux côtés.
      let file = null;
      for (let attempt = 1; attempt <= MAX_CAPTURE_ATTEMPTS; attempt++) {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        // Défense en profondeur, 2e couche (même esprit que
        // `startBackgroundImageGeneration`, PlaylistDetailView.jsx) : si un
        // AUTRE trophée a été cliqué entre-temps (double-clic rapide),
        // abandonner plutôt que de capturer un contenu déjà périmé — la
        // carte hors écran est UNIQUE et PARTAGÉE, capturer maintenant
        // montrerait de toute façon le trophée le plus récent, pas celui
        // demandé par CET appel.
        if (sharingTrophyIdRef.current !== trophy.id) return;
        void trophyCardRef.current.offsetHeight; // reflow forcé, voir ci-dessus
        const attemptFile = await captureElementAsFile(trophyCardRef.current, 'tempofit-trophee.png', { scale: 2.7 });
        if (sharingTrophyIdRef.current !== trophy.id) return;
        if (attemptFile.size >= MIN_VALID_TROPHY_IMAGE_BYTES) {
          file = attemptFile;
          break;
        }
        // Capture visiblement incomplète (fond manquant) — retente après un
        // délai croissant (100ms, 200ms...), laissant plus de temps au
        // navigateur si celui-ci était simplement chargé/lent. Garde quand
        // même le dernier résultat (même imparfait) en dernier recours
        // plutôt que d'abandonner tout visuel après MAX_CAPTURE_ATTEMPTS
        // tentatives — un visuel imparfait reste un partage possible,
        // l'utilisateur peut toujours voir/écarter l'aperçu avant d'envoyer.
        file = attemptFile;
        if (attempt < MAX_CAPTURE_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, attempt * 100));
        }
      }
      if (sharingTrophyIdRef.current !== trophy.id) return;
      setSummaryImageFile(file);
      setSummaryImagePreviewUrl(URL.createObjectURL(file));
      setSummaryImageStatus('ready');
    } catch (e) {
      // Échec silencieux (voir startBackgroundImageGeneration,
      // PlaylistDetailView.jsx, même choix) — le partage texte/lien reste
      // utilisable normalement, c'est un bonus discret, pas une action
      // explicitement demandée.
      setSummaryImageStatus('error');
    }
  };

  const visibleTrophies = TROPHIES_DATA.filter(t => !t.secret);
  const secretTrophies = TROPHIES_DATA.filter(t => t.secret);
  const unlockedSecretCount = secretTrophies.filter(t => userStats.unlockedTrophies.includes(t.id)).length;

  const renderTrophyCard = (trophy) => {
    const isUnlocked = userStats.unlockedTrophies.includes(trophy.id);
    // Masqué seulement si SECRET ET encore verrouillé — une fois débloqué,
    // un trophée secret se révèle en entier comme les autres (rien à cacher
    // après coup, la surprise est dans la découverte, pas dans le mur).
    const isMasked = trophy.secret && !isUnlocked;
    return (
      <div key={trophy.id} className={`${cardBg} rounded-2xl p-6 border ${isUnlocked ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : isMasked ? `border-dashed ${cardBorder}` : cardBorder} flex items-start space-x-4 transition-all`}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 ${isUnlocked ?
          'bg-linear-to-br from-yellow-100 to-yellow-300 dark:from-yellow-900/40 dark:to-yellow-700/40' : 'bg-surface-hover grayscale opacity-40'}`}>
          {isMasked ? <HelpCircle size={28} className={textMuted} /> : trophy.icon}
        </div>
        <div className="flex-1">
          <h3 className={`font-bold text-lg ${isUnlocked ? textHighlight : textMuted}`}>{isMasked ? 'Trophée secret' : trophy.name}</h3>
          <p className={`text-sm mt-1 ${isUnlocked ? textMuted : 'text-gray-400 dark:text-gray-600'}`}>
            {isMasked ? 'Un comportement précis dans l\'appli débloque ce trophée — à toi de le découvrir.' : trophy.desc}
          </p>
          {isUnlocked && (
            <button onClick={() => shareTrophy(trophy)} className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center space-x-1">
              <Share2 size={12}/> <span>Partager mon exploit</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-8`}>
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<Award className="text-yellow-500" size={VIEW_HEADER_ICON_SIZE} />}
        title="Mes Trophées"
        subtitle="Le mur des légendes. Accomplis tes sessions pour débloquer ces succès."
      />

      {/* Onglets — standardisé sur TabPills.jsx (21/08, retour direct),
          même composant partagé désormais avec PlaylistsView.jsx/
          ProfileView.jsx/DiscoverView.jsx/SettingsView.jsx. Perd son style
          "contrôle segmenté" propre (fond `bg-surface-hover`, boutons
          `shadow-xs`) au profit du style plat majoritaire ailleurs — voir
          TabPills.jsx pour le raisonnement complet de cette décision.
          L'icône `Lock` devient un `<span>` inline-flex DANS le label
          plutôt qu'un `flex` sur le bouton lui-même (TabPills.jsx n'en
          propose pas, chaque appelant compose son propre label). */}
      <TabPills
        theme={theme}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'visible', label: `Trophées (${visibleTrophies.filter(t => userStats.unlockedTrophies.includes(t.id)).length}/${visibleTrophies.length})` },
          {
            value: 'secret',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Lock size={13}/> Secrets ({unlockedSecretCount}/{secretTrophies.length})
              </span>
            ),
          },
        ]}
      />

      {activeTab === 'visible' ? (
        <div className="space-y-10">
          {TROPHY_CATEGORIES.map(cat => {
            const trophiesInCat = visibleTrophies.filter(t => t.category === cat.key);
            if (trophiesInCat.length === 0) return null;
            return (
              <div key={cat.key}>
                <div className="mb-4">
                  <h3 className={`font-bold text-lg ${textHighlight}`}>{cat.label}</h3>
                  <p className={`text-sm ${textMuted}`}>{cat.desc}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {trophiesInCat.map(renderTrophyCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p className={`text-sm mb-4 flex items-center gap-1.5 ${textMuted}`}>
            <Lock size={14}/> Un comportement précis dans l'appli débloque chacun de ces trophées — pas de liste, la surprise fait partie du jeu.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {secretTrophies.map(renderTrophyCard)}
          </div>
        </div>
      )}

      <div className={`text-center ${textMuted} text-sm font-medium bg-gray-100 dark:bg-gray-900 p-6 rounded-2xl`}>
        <div className="flex justify-center items-center space-x-8">
          <div>Sessions totales : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.totalCompleted}</span></div>
          <div>Fichiers analysés : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.dataImports}</span></div>
        </div>
      </div>

      {/* Rendu hors écran, en permanence — voir shareTrophy plus haut pour
          la logique d'export une fois câblée (même principe que
          PlaylistDetailView.jsx/StatsView.jsx : `captureElementAsFile` a
          besoin d'un élément DOM réellement monté, `fixed left:-9999px`
          plutôt que monté/démonté à la volée). `sharingTrophy` vaut `null`
          tant qu'aucun partage n'a encore été lancé cette session — la
          carte affiche alors simplement rien (`TrophyShareCard` gère ce
          cas, voir sa garde `if (!trophy) return null`). */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={trophyCardRef}>
          <TrophyShareCard trophy={sharingTrophy} isNaughtyMode={isNaughtyMode} />
        </div>
      </div>
    </div>
  );
}
