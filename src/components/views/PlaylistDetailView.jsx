import { useState, useRef, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { genreDisplayLabel, normalizeGenreForDisplay } from '../../musicCatalog';
import { getCadenceUnitLabel, getZoneForValue, getBpmBucketLabel } from '../../appConfig';
import { formatDuration } from '../../utils/format';
import { captureElementAsFile, fetchImageAsDataUri } from '../../utils/captureElementAsFile';
import { buildCoverUrlPng } from '../../utils/coverArt';
import { deezerFetch } from '../../engine/musicEngine';
import SessionSummaryCard from '../shared/SessionSummaryCard';
import { PlaylistDetailProvider, usePlaylistDetail } from '../../contexts/PlaylistDetailContext';
import { useShareImage } from '../../contexts/ShareImageContext';
import { PlaylistEditProvider } from '../../contexts/PlaylistEditContext';
import EditPlaylistModal from '../modals/EditPlaylistModal';
import TrackList from './PlaylistDetail/TrackList';
import PlaylistHeader from './PlaylistDetail/PlaylistHeader';
import PlaylistCharts from './PlaylistDetail/PlaylistCharts';
import { VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';

/**
 * PlaylistDetailView — détail d'UNE playlist générée (nom, graphique BPM
 * cible vs réalité, liste des titres, répartitions BPM/style).
 *
 * ⚠️ Ne pas confondre avec PlaylistsView (`view === 'playlists'`, la liste de
 * toutes les playlists sauvegardées) : celui-ci correspond à `view ===
 * 'playlist'` (singulier), affiché quand on clique sur une carte.
 *
 * Extrait de App.jsx. Tous les calculs dérivés du graphique (unifiedChartData,
 * trackSegments, chartXDomain/Ticks/YDomain, analysisStats...) restent
 * calculés dans App.jsx via useMemo et arrivent ici déjà prêts, en props —
 * ce composant reste un composant d'affichage, pas de calcul.
 */
function PlaylistDetailViewInner({
  // Chantier God Component (suite) : ne reçoit plus QUE ce qui est
  // génuinement hors du périmètre de PlaylistDetailContext — soit partagé
  // avec d'autres vues (PlaylistsView, ShareModal), soit infra globale
  // (recherche, toast). Tout le reste (édition du nom, drag-and-drop,
  // graphique, distributions, remplacement/duplication de titres...) vient
  // de usePlaylistDetail() ci-dessous. Passé de 78 à 26 props.
  theme, colorMode,
  currentPlaylist, setCurrentPlaylist, savedPlaylists,
  handleShare,
  favorites, toggleTrackFavorite, toggleArtistFavorite,
  setIsBpmSearchMode,
  setPlaylistPlannedDate,
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate,
  getRankStyle, triggerCSVUpload, removeImportedData,
  changeView, onViewProfile,
}) {
  // Chantier découpage (suite) : ce composant ne fait plus QUE l'orchestration
  // (état de filtre partagé entre TrackList/PlaylistCharts, génération du
  // bilan image, table de vérification CSV brute) — tout le reste vient
  // directement de usePlaylistDetail() dans PlaylistHeader/PlaylistCharts/
  // TrackList eux-mêmes, plutôt que d'être lu ici puis redescendu en props.
  const {
    isNaughtyMode, getProfileForWorkout,
    currentActualData,
    togglePreview, resolveAndPlay,
    setSelectedSegmentIdx,
  } = usePlaylistDetail();
  // RATTRAPÉ (21/08, découpage App.jsx, cluster "Image de partage") —
  // summaryImage*/includeSummaryImage venaient en props depuis App.jsx (2
  // niveaux de prop-drilling, via PlaylistDetailView ci-dessous) ; lus
  // maintenant directement via le Contexte dédié (voir ShareImageContext.jsx
  // pour le détail complet — génération/logique de course inchangées, reste
  // entièrement ici).
  // ⚠️ Getters `summaryImageFile`/`summaryImagePreviewUrl`/`includeSummaryImage`
  // retirés de cette destructuration (check-up 22/08) : ce composant est le
  // PRODUCTEUR de ces valeurs (génère l'image de bilan, voir les appels
  // setSummaryImage*/setIncludeSummaryImage plus bas), jamais leur lecteur —
  // `ShareModal.jsx` les lit via sa PROPRE copie de `useShareImage()` pour
  // l'affichage/le partage. Setters conservés, seuls les getters étaient
  // morts ici.
  const {
    summaryImageStatus, setSummaryImageStatus, setSummaryImageFile,
    setSummaryImagePreviewUrl, setIncludeSummaryImage,
  } = useShareImage();
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass } = theme;
  // Replié par défaut : ce tableau ne sert qu'à vérifier ponctuellement une
  // correspondance de données (import CSV Garmin/Strava), pas à un usage courant.
  const [showRawImportTable, setShowRawImportTable] = useState(false);
  // --- Verrouillage d'une séance déjà réalisée (retour direct) ---
  // Une fois qu'AU MOINS une date de complétion existe, cette playlist devient
  // un historique réel, pas un brouillon : on ne doit plus pouvoir en modifier
  // le contenu (ajouter/dupliquer/remplacer/retirer un titre, le déplacer) sans
  // fausser silencieusement ce qui a été réellement écouté pendant la séance.
  // Seules restent possibles les actions qui NE changent PAS le contenu :
  // écouter un extrait, favoriser un artiste/titre, consulter/partager les
  // stats, importer des données réelles (Garmin/Strava) ou ajouter une
  // NOUVELLE date de complétion (rejouer la même séance plus tard).
  const isLocked = !!(currentPlaylist.completions && currentPlaylist.completions.length > 0);

  // RETOUR DIRECT : "parler de PPM pour du cyclisme n'est pas adapté" — même
  // correction que sur la page Profil Athlétique (GeneratorView.jsx), reprise
  // ici pour l'analyse de données réelles (Garmin/Strava) : PPM pour une
  // séance de course à pied, RPM pour du vélo, repli générique sinon (voir
  // getCadenceUnitLabel, appConfig.js — même helper partagé, pas une 2e
  // logique dupliquée). Même convention "Autre" + activité personnalisée que
  // partout ailleurs (getProfileForWorkout, useAthleticProfile.js).
  const playlistCadenceUnit = getCadenceUnitLabel(currentPlaylist.workoutType === 'Autre' ? (currentPlaylist.config?.customActivity || '__custom__') : currentPlaylist.workoutType);

  // RETOUR DIRECT ("je veux que par défaut il y ait un profil fictif et que
  // ça se base dessus") — "Répartition par BPM" (plus bas) classe maintenant
  // TOUJOURS par zone (voir bpmDistributionData, App.jsx —
  // getProfileForWorkoutOrDefault), avec repli sur un profil par défaut si
  // rien n'est configuré pour l'activité de CETTE séance. Calculé ici pour
  // savoir lequel des 2 cas afficher dans le sous-titre (même distinction
  // honnête que "Tes zones d'intensité" dans StatsView.jsx) — même
  // résolution d'activité qu'ailleurs (Mode Intime : le vrai nom est dans
  // `config.workoutName`, pas `workoutType`, qui vaut toujours "Ambiance").
  const bpmChartActivityName = isNaughtyMode
    ? (currentPlaylist.config?.workoutName || currentPlaylist.workoutType || 'Autre')
    : (currentPlaylist.workoutType || 'Autre');
  const isBpmChartUsingRealProfile = !!(getProfileForWorkout && getProfileForWorkout(bpmChartActivityName)?.isConfigured);

  // RETOUR DIRECT ("en course à pied, la cadence de pas varie peu selon la
  // zone — proposer une visualisation Synchro uniquement si l'utilisateur
  // active l'option") — si l'activité de CETTE séance est réglée sur
  // `cadenceIntent: 'sync'`, remplace le camembert par zone par un indicateur
  // d'écart : un chiffre ("Écart moyen") + les titres positionnés sur un axe
  // BPM autour de la cible. Un camembert par ZONE n'aurait presque aucun
  // intérêt en sync — les 4 zones sont volontairement resserrées (voir
  // SYNC_ZONE_SPACING_BY_ACTIVITY, useAthleticProfile.js), donc la quasi-
  // totalité des titres tomberaient dans la même part.
  // Médaille "la plus/2e plus/3e plus utilisée" (retour direct : "quand je
  // suis dans la playlist d'une session que je fais le plus... faudrait
  // aussi le symbole") — déjà affichée sur la carte dans "Mes Playlists"
  // (PlaylistCard.jsx) mais jamais reprise ici. Même logique de classement
  // recalculée localement (mêmes filtre + tri que PlaylistsView.jsx), plutôt
  // qu'un classement centralisé transmis en prop — cohérent avec la
  // convention déjà en place ailleurs dans l'app pour ce même genre de
  // classement (RoutinesView.jsx fait exactement pareil pour ses routines) :
  // un seul helper de STYLE partagé (`getRankStyle`, App.jsx), mais le
  // classement lui-même recalculé localement par chaque vue à partir de ce
  // qu'elle a déjà sous la main (ici `savedPlaylists`, déjà reçu en prop).
  // --- Enchaînement automatique au titre suivant (retour direct : "que ce
  // soit via le graph ou via la sélection musique playlist, quand je finis
  // un morceau ça doit passer au suivant" — confirmé ensuite : "ça doit
  // reboucler sur la première" une fois le dernier titre terminé) ---
  // Fourni comme 2e argument à `togglePreview` (voir useAudioPreview.js) :
  // appelé UNIQUEMENT quand un extrait se termine naturellement, jamais sur
  // une pause manuelle. Reçoit le titre qui vient de se terminer, renvoie le
  // titre juste après lui dans `currentPlaylist.tracks` — ou le TOUT PREMIER
  // titre de la playlist si c'était le dernier (boucle continue, comme un
  // "lire tout en boucle" classique), jamais `null` tant qu'au moins un titre
  // de la playlist a un extrait exploitable. Ne s'arrête donc plus jamais
  // toute seule une fois lancée — comportement voulu, confirmé explicitement.
  //
  // Cas d'une playlist à un seul titre : boucle sur lui-même indéfiniment,
  // ce qui est la conséquence logique et attendue d'une "boucle sur tout"
  // avec un seul élément dans "tout" — pas un cas particulier à gérer à part.
  //
  // Comparaison par `.id` plutôt que `.trackId` : un titre dupliqué (voir
  // handleDuplicateTrack) partage le même trackId que l'original, mais a
  // toujours un `.id` propre — indispensable ici pour retrouver la BONNE
  // occurrence dans la liste, pas systématiquement la première qui matche.
  //
  // Recalculée à CHAQUE fin d'extrait (pas figée au clic initial, voir la
  // docstring de useAudioPreview.js) : reste juste même si la playlist est
  // réordonnée pendant la lecture.
  //
  // Fait AUSSI suivre `selectedSegmentIdx` sur le nouveau titre en cours —
  // sans ça, l'encart resterait affiché sur l'ancien titre (bouton figé sur
  // "lecture", plus en phase avec ce qui joue réellement) une fois l'audio
  // passé au suivant tout seul. Effet de bord assumé dans ce "getter" plutôt
  // qu'un 2e callback séparé : reste plus simple pour un seul point d'usage.
  //
  // BUG CORRIGÉ (retour direct : "traite la aussi", à propos du cas signalé
  // juste avant) : la version précédente ne tentait qu'UN SEUL titre suivant
  // et abandonnait purement et simplement si celui-là précisément n'avait pas
  // d'extrait exploitable (`t.preview` absent — titre favori/Spotify sans
  // équivalent Deezer, par exemple), même si d'autres titres plus loin dans
  // la playlist en avaient un. Balaie maintenant vers l'avant (avec retour au
  // début, jusqu'à `tracks.length` essais au maximum pour ne jamais tourner
  // en rond indéfiniment si AUCUN titre de la playlist n'a d'extrait) et
  // renvoie le PREMIER titre exploitable rencontré, pas juste le tout
  // prochain de la liste. `null` désormais réservé au seul cas où vraiment
  // aucun titre de la playlist n'a d'extrait du tout.
  const getNextTrackForAutoAdvance = (endedTrack) => {
    const tracks = currentPlaylist.tracks;
    if (tracks.length === 0) return null;
    const startIdx = tracks.findIndex(t => t.id === endedTrack.id);
    // `base` : point de départ du balayage, AVANT le "+1" de la boucle —
    // -1 si le titre qui vient de finir est introuvable (ex. retiré entre-
    // temps), pour que le tout 1er essai (step=1) retombe bien sur l'index 0.
    const base = startIdx === -1 ? -1 : startIdx;
    for (let step = 1; step <= tracks.length; step++) {
      const candidateIdx = (base + step) % tracks.length;
      if (tracks[candidateIdx].preview) {
        setSelectedSegmentIdx(candidateIdx);
        return tracks[candidateIdx];
      }
    }
    return null;
  };

  /**
   * RETOUR DIRECT ("boutons précédent/suivant depuis le mini-lecteur") —
   * `resolveAndPlay`/`resolvingTrackId` viennent maintenant de
   * useAudioPreview.js (reçus en props depuis App.jsx, qui possède le
   * hook) — la résolution à la demande vivait avant ICI en copie locale,
   * déplacée pour que le mini-lecteur GLOBAL (visible sur toutes les vues)
   * puisse s'en servir aussi, pas seulement cette page. Ce wrapper ne fait
   * plus que la partie SPÉCIFIQUE à cette vue : mettre à jour le titre
   * résolu dans `currentPlaylist.tracks` (pour que les clics suivants
   * n'aient plus besoin de re-résoudre, et que favoris/graphiques voient
   * aussi le nouvel identifiant Deezer) — la résolution et la lecture
   * elles-mêmes restent dans le hook, partagées.
   *
   * Comparaison par `id` (pas par référence d'objet `===`, ni par
   * `trackId` qui change justement lors de cette résolution) pour
   * retrouver ce titre précis dans `currentPlaylist.tracks` : `id` est LE
   * champ stable par occurrence dans la liste (distinct de `trackId`, qui
   * identifie la chanson — voir musicEngine.js, createPlaylistData), jamais
   * modifié ici.
   */
  const resolveAndTogglePreview = async (track, getNextTrack) => {
    if (track.preview) { togglePreview(track, getNextTrack); return; }
    const updatedTrack = await resolveAndPlay(track, getNextTrack);
    if (updatedTrack) {
      setCurrentPlaylist(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id === track.id ? updatedTrack : t),
      }));
    }
  };

  // --- Bilan Visuel de Séance (export image) ---
  // Carte rendue HORS ÉCRAN en permanence (voir le rendu tout en bas de ce
  // composant, `position: fixed; left: -9999px`) plutôt que montée/démontée à
  // la demande : évite d'avoir à attendre un premier rendu avant de pouvoir
  // capturer, l'essentiel du délai d'attente vient de toute façon de la
  // résolution des pochettes (réseau) et du chargement des <img>, pas du
  // montage du composant lui-même.
  const summaryCardRef = useRef(null);
  const [summaryCovers, setSummaryCovers] = useState({});
  const [summarySessionCover, setSummarySessionCover] = useState(null);

  // `currentPlaylistIdRef` (check-up 10/08 — voir le correctif de course
  // "Partager"/"Cloner" plus bas) — TOUJOURS la valeur la PLUS RÉCENTE de
  // `currentPlaylist?.id`, mise à jour à CHAQUE rendu (simple assignation,
  // pas un Hook) — même pattern que `structureModeRef`/`setStructureModeRef`
  // dans useGeneratorForm.js (`applyProfileBpmIfUntouched`). Sert de
  // référence "vivante" à laquelle comparer un id capturé au DÉBUT d'une
  // chaîne asynchrone longue (`generateSummaryImageFile` ci-dessous), pour
  // détecter si l'utilisateur a changé de playlist EN COURS DE ROUTE — ce
  // composant reste volontairement monté d'une playlist à l'autre (voir le
  // `useEffect` de reset juste en dessous), donc une simple fermeture sur
  // `currentPlaylist` au moment du clic ne suffit pas à le détecter.
  const currentPlaylistIdRef = useRef(currentPlaylist?.id);
  currentPlaylistIdRef.current = currentPlaylist?.id;

  // RETOUR DIRECT ("insérer le bilan image directement dans l'option de
  // partage, avec une croix pour le retirer") — DEUXIÈME évolution de ce
  // chantier (voir le commentaire juste au-dessus pour la 1re, qui a fusionné
  // 2 boutons en 1 menu). Cette fois, l'image se génère TOUTE SEULE en
  // arrière-plan dès l'ouverture du menu "Partager" (voir
  // startBackgroundImageGeneration, déclenché par le clic sur le bouton
  // "Partager" plus bas), PUIS s'affiche en aperçu dans ShareModal — plutôt
  // que d'exiger un clic dédié sur "Bilan en image" pour la voir.
  //
  // Volontairement PAS bloquant pour le partage texte/lien : générer cette
  // image coûte cher (pochettes Deezer + capture html2canvas, potentiellement
  // lent sur un téléphone modeste) — qui veut juste copier un lien n'a
  // aucune raison d'attendre que cette génération se termine.
  //
  // `summaryImageStatus`/`summaryImageFile`/`summaryImagePreviewUrl`/
  // `includeSummaryImage` vivent dans `ShareImageContext.jsx` (lu ici via
  // `useShareImage()`, voir plus haut — ⚠️ ce commentaire disait encore
  // "reçus EN PROPS (pas des useState locaux)", vrai avant le 21/08, plus
  // depuis ; corrigé au check-up 22/08, mais le RAISONNEMENT reste valable
  // tel quel) — ShareModal.jsx, qui doit les LIRE pour afficher l'aperçu,
  // est rendu une seule fois globalement dans App.jsx, PAS à l'intérieur de
  // cette vue : cet état doit donc vivre à un niveau que les deux peuvent
  // atteindre (d'où le Contexte, pas un simple useState local ici). La
  // génération elle-même (qui a besoin de `summaryCardRef`, une réf DOM sur
  // la carte hors-écran rendue plus bas dans CE composant) reste en revanche
  // ici, où vit cette réf.

  // Réinitialise tout si on change de playlist (navigation vers une autre
  // séance sans démonter ce composant) — sinon l'aperçu d'une AUTRE séance
  // pourrait rester affiché par erreur. Révoque l'URL d'objet précédente
  // (évite une fuite mémoire, même principe que pour les autres previews
  // blob de l'app).
  useEffect(() => {
    setSummaryImageStatus('idle');
    setSummaryImageFile(null);
    setIncludeSummaryImage(true);
    setSummarySessionCover(null);
    setSummaryImagePreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlaylist?.id]);

  /**
   * Génération PURE de l'image (pochettes → capture via captureElementAsFile,
   * utils/, voir ce fichier) — ne partage ni ne télécharge rien elle-même.
   * Déclenchée en arrière-plan au clic sur "Partager" (voir
   * startBackgroundImageGeneration ci-dessous) ; ShareModal.jsx affiche
   * l'aperçu et gère elle-même le partage une fois l'image prête.
   *
   * ⚠️ COURSE CORRIGÉE (check-up 10/08 — voir la docstring de
   * `currentPlaylistIdRef` plus haut) : ce composant reste MONTÉ d'une
   * playlist à l'autre (`handleClonePlaylist`, usePlaylistLibrary.js :
   * "on reste sur la même vue détail, seul l'objet affiché change" — même
   * chose pour toute autre ouverture de playlist en place). Cliquer
   * "Partager" PUIS "Cloner" avant la fin des allers-retours réseau
   * ci-dessous écrivait auparavant les pochettes de l'ANCIENNE playlist
   * (`setSummarySessionCover`/`setSummaryCovers`) dans le state PARTAGÉ,
   * APRÈS que le `useEffect` de reset ait déjà remis ce state à zéro pour
   * la NOUVELLE — `<SessionSummaryCard playlist={currentPlaylist} .../>`
   * (qui lit `currentPlaylist` en direct) capturait alors un bilan
   * mélangeant les données de la NOUVELLE playlist avec les pochettes de
   * l'ANCIENNE, marqué "prêt" malgré tout par `startBackgroundImageGeneration`
   * — un bilan potentiellement FAUX, partageable publiquement tel quel.
   * `isStale()` capture l'id de playlist au tout début de CET appel
   * (fermeture sur `currentPlaylist`, fixe pour toute la durée de cette
   * fonction) et le compare à `currentPlaylistIdRef.current` (toujours à
   * jour) à CHAQUE point d'écriture — dès qu'ils divergent, on abandonne
   * silencieusement (aucun setState de ce côté) plutôt que d'écrire une
   * donnée obsolète. Vérifié aussi AVANT de lancer les appels réseau
   * suivants (pas seulement avant chaque `setState`) : pas la peine de
   * continuer à interroger Deezer pour une playlist qu'on ne regarde déjà
   * plus.
   */
  const generateSummaryImageFile = async () => {
    const playlistIdAtStart = currentPlaylist.id;
    const isStale = () => currentPlaylistIdRef.current !== playlistIdAtStart;

    // 1. Pochette de LA SÉANCE (celle affichée en en-tête de la carte) —
    // résolue en data URI comme les pochettes de titres ci-dessous, pour
    // la même raison (voir fetchImageAsDataUri). Sans ça, la pochette de
    // repli (DiceBear, un SVG) faisait planter la capture à elle seule,
    // même quand aucun titre Deezer n'était concerné.
    // Pochette de LA SÉANCE, en PNG (jamais en SVG ici — voir
    // buildCoverUrlPng, coverArt.js) : que `currentPlaylist.coverUrl` soit
    // déjà posé (playlist ensemencée) ou non, les deux proviennent de la
    // MÊME fonction déterministe seed→image (`buildCoverUrl`/
    // `buildCoverUrlPng`, même seed = même pochette) — on régénère
    // directement en PNG plutôt que de convertir une URL SVG existante.
    const sessionCoverSourceUrl = buildCoverUrlPng(currentPlaylist.name);
    const sessionCoverDataUri = await fetchImageAsDataUri(sessionCoverSourceUrl);
    if (isStale()) return null;
    setSummarySessionCover(sessionCoverDataUri);

    // 2. Pochettes des 3 premiers titres — uniquement pour ceux sourcés de
    // Deezer (trackId de la forme "deezer-{id}") ; un titre favori/
    // Spotify sans équivalent n'a pas d'ID Deezer exploitable, repli sur
    // l'icône générique dans SessionSummaryCard (composant volontairement
    // pur, aucun appel réseau dedans — voir sa docstring).
    //
    // BUG CORRIGÉ (01/08, "la préparation des bilans visuels plante") —
    // ces pochettes étaient jusqu'ici de simples URLs Deezer directes,
    // chargées cross-origin par le <img> de SessionSummaryCard.jsx au
    // moment de la capture html2canvas. Rien ne garantit que le CDN Deezer
    // renvoie les en-têtes CORS nécessaires pour un <img crossOrigin=
    // "anonymous"> (contrairement à l'appel JSON ci-dessous, déjà proxyé
    // via /api/deezer.js) — un canvas "tainted" par une image cross-origin
    // mal chargée fait échouer `canvas.toBlob()` avec une SecurityError,
    // qui remontait jusqu'ici (voir aussi la pochette de séance ci-dessus,
    // même cause, encore plus systématique : DiceBear renvoie du SVG,
    // réputé pour "tainted" un canvas même avec les bons en-têtes CORS).
    // Résolues maintenant en data URI ICI, AVANT le rendu — une data URI
    // n'a par définition aucune notion de "cross-origin", donc plus aucun
    // risque de taint, quel que soit le comportement CORS réel du CDN.
    const topTracks = currentPlaylist.tracks.slice(0, 3);
    const covers = {};
    await Promise.all(topTracks.map(async (t) => {
      if (!t.trackId || !t.trackId.startsWith('deezer-')) return;
      try {
        const { data } = await deezerFetch(`https://api.deezer.com/track/${t.trackId.replace('deezer-', '')}`);
        if (data?.album?.cover_medium) {
          const dataUri = await fetchImageAsDataUri(data.album.cover_medium);
          if (dataUri) covers[t.trackId] = dataUri;
        }
      } catch (e) { /* pas de pochette pour ce titre — repli déjà géré côté composant */ }
    }));
    if (isStale()) return null;
    setSummaryCovers(covers);

    // 3-4. Attente du re-render + capture — entièrement centralisées dans
    // captureElementAsFile (utils/, règle du Boy Scout) plutôt qu'inlinées
    // ici avec l'import html2canvas. `scale: 2.7` sur une carte de 400px de
    // large vise exactement 1080px de sortie (format Story Instagram,
    // 1080×1920 — voir la largeur/hauteur fixées dans SessionSummaryCard.jsx).
    if (isStale()) return null;
    return captureElementAsFile(summaryCardRef.current, 'tempofit-bilan-de-seance.png', { scale: 2.7 });
  };

  // Lance la génération en arrière-plan — ne fait rien si déjà en cours ou
  // déjà prête pour CETTE playlist (voir le useEffect de reset ci-dessus
  // pour le changement de playlist).
  //
  // ⚠️ COURSE CORRIGÉE (check-up 10/08, voir la docstring complète de
  // `generateSummaryImageFile` ci-dessus) — 2e couche de la même défense,
  // en plus de celle DANS `generateSummaryImageFile` : même si un fichier a
  // malgré tout été produit (aucun `isStale()` déclenché à temps, cas
  // limite), on vérifie ICI ENCORE une fois avant de l'appliquer comme
  // "prêt" — défense en profondeur, 2 couches indépendantes plutôt qu'une
  // seule (même principe que `lock_parent_lineage`/l'omission de
  // `parent_id` côté client, useSyncedCollection.js).
  const startBackgroundImageGeneration = async () => {
    if (!currentPlaylist || summaryImageStatus === 'loading' || summaryImageStatus === 'ready') return;
    const playlistIdAtStart = currentPlaylist.id;
    setSummaryImageStatus('loading');
    try {
      const file = await generateSummaryImageFile();
      if (!file || currentPlaylistIdRef.current !== playlistIdAtStart) return;
      setSummaryImageFile(file);
      setSummaryImagePreviewUrl(URL.createObjectURL(file));
      setSummaryImageStatus('ready');
    } catch (e) {
      // Une playlist déjà abandonnée (voir ci-dessus) qui échoue en route
      // ne doit PAS marquer 'error' sur la NOUVELLE playlist actuellement
      // affichée — son propre statut (déjà remis à 'idle' par le
      // `useEffect` de reset au moment du changement) ne doit pas être
      // écrasé par un échec qui ne la concerne plus.
      if (currentPlaylistIdRef.current !== playlistIdAtStart) return;
      // Erreur maintenant JOURNALISÉE (console.error, pas debugLog — utile
      // aussi en prod pour diagnostiquer, même convention que les erreurs
      // API Deezer/Spotify ailleurs dans le projet) — jusqu'ici totalement
      // avalée, ce qui a rendu ce bug impossible à diagnostiquer à distance
      // (01/08 : plusieurs allers-retours pour deviner la cause faute de
      // pouvoir simplement LIRE l'erreur réelle). Reste un échec SILENCIEUX
      // pour l'utilisateur (pas de toast) — ce choix Produit reste
      // inchangé, seul le diagnostic devient possible.
      console.error('Génération du bilan visuel de séance échouée :', e);
      setSummaryImageStatus('error');
    }
  };

  // Callback passé à PlaylistHeader (`onShare`) : combine le déclenchement de
  // la génération d'image en arrière-plan (ce composant possède
  // `summaryCardRef`, pas déplaçable dans l'en-tête) et l'ouverture du menu
  // de partage lui-même (`handleShare`, reçu en prop depuis App.jsx).
  const handleShareClick = () => {
    startBackgroundImageGeneration();
    handleShare('playlist', currentPlaylist);
  };

  // Même logique de clic-pour-filtrer que StatsView (voir selectedStatsGenre/
  // selectedStatsBpmBucket) : cliquer une part du donut "Répartition par
  // style"/"Répartition par BPM" met en évidence les titres correspondants
  // dans la liste ci-dessous ET le segment correspondant sur la courbe
  // d'intensité au-dessus — jusqu'ici, ces 2 graphiques étaient purement
  // décoratifs (aucune interaction), contrairement à leurs équivalents dans
  // Stats. Indépendants l'un de l'autre (comme dans StatsView) : rien n'empêche
  // de combiner un filtre genre ET un filtre BPM à la fois si les deux sont
  // actifs. Un re-clic sur la même part la désélectionne (toggle).
  // RETOUR DIRECT ("faut pouvoir sélectionner plusieurs zones graphiques à
  // la fois, pas juste une, partout où y a les camemberts") — passés d'une
  // valeur unique (`useState(null)`) à un `Set` : plusieurs parts du MÊME
  // camembert peuvent être sélectionnées ensemble (ex. "Rock" ET "Métal" en
  // même temps sur "Répartition par style"). Toujours indépendants l'un de
  // l'autre entre les 2 camemberts (style vs BPM) — rien n'empêche de
  // combiner un filtre style ET un filtre BPM en plus de la multi-sélection
  // à l'intérieur de chacun. Un re-clic sur une part déjà sélectionnée la
  // retire du Set (toggle), comme avant.
  const [selectedDetailGenre, setSelectedDetailGenre] = useState(() => new Set());
  const [selectedDetailBpmBucket, setSelectedDetailBpmBucket] = useState(() => new Set());
  // Même regroupement que celui utilisé pour construire genreDistributionData/
  // bpmDistributionData (App.jsx) — recalculé ici par titre pour comparer
  // chaque titre à la part cliquée, plutôt que de dupliquer un état séparé.
  const trackGenreLabel = (t) => genreDisplayLabel(normalizeGenreForDisplay(t.genre, t.artist, t.title));
  // BUG CORRIGÉ (retour direct : "quand j'ai le graphique par type d'effort,
  // ça devrait aussi sélectionner les musiques ?" — ça AURAIT dû déjà le
  // faire, ça ne le faisait pas) — cette fonction doit calculer EXACTEMENT
  // le même type de label que celui affiché dans le camembert
  // (bpmDistributionData, PlaylistDetailContext.jsx), sinon un clic sur une
  // part n'y trouve jamais de titre correspondant.
  //
  // REVERT (décision Produit : l'app reste neutre par défaut) —
  // bpmDistributionData utilise à nouveau `getProfileForWorkout` STRICT (pas
  // OrDefault, essayé puis abandonné entre-temps) : zones d'effort SEULEMENT
  // si un vrai profil est configuré, tranches de BPM brutes sinon. Cette
  // fonction suit le même résolveur — `isBpmChartUsingRealProfile` (déjà
  // strict lui aussi) redevient donc la bonne condition ici.
  const trackBpmBucketLabel = (t) => {
    if (isBpmChartUsingRealProfile) return getZoneForValue(t.bpm, bpmChartActivityName, getProfileForWorkout)?.shortLabel || null;
    return getBpmBucketLabel(t.bpm);
  };
  const hasDetailFilter = selectedDetailGenre.size > 0 || selectedDetailBpmBucket.size > 0;
  // OR à l'intérieur d'un même camembert (n'importe laquelle des parts
  // sélectionnées suffit à matcher), ET entre les 2 camemberts (style ET BPM
  // si les deux ont une sélection) — même logique qu'avant, juste `.has()`
  // sur un Set au lieu d'une égalité stricte sur une seule valeur.
  const trackMatchesDetailFilter = (t) =>
    (selectedDetailGenre.size === 0 || selectedDetailGenre.has(trackGenreLabel(t))) &&
    (selectedDetailBpmBucket.size === 0 || selectedDetailBpmBucket.has(trackBpmBucketLabel(t)));
  // RETOUR DIRECT ("croiser les données des graphiques : voir les morceaux
  // Metal dans les 2 catégories, pas juste Rock ET Metal dans les 2
  // catégories") — jusqu'ici les 2 mini-listes "Titres" sous les camemberts
  // ne regardaient QUE leur propre axe (`selectedDetailGenre.has(...)` seul
  // pour celle du style, `selectedDetailBpmBucket.has(...)` seul pour celle
  // du BPM), en ignorant complètement une sélection active sur l'AUTRE
  // camembert — alors que `trackMatchesDetailFilter` ci-dessus fait déjà ce
  // croisement (ET) correctement pour la liste principale de titres plus
  // haut sur la page. Réutilisé tel quel ci-dessous : les 2 mini-listes
  // affichent maintenant le même sous-ensemble croisé (Metal ET 140-159 BPM,
  // pas Metal seul d'un côté et 140-159 BPM seul de l'autre), avec un même
  // libellé combiné dans les 2 en-têtes.
  // activeDetailFilterLabel/selectDetailGenre/selectDetailBpmBucket/
  // handleChartClickAndClearZoomFilter : déplacés dans PlaylistCharts.jsx
  // (seuls consommateurs restants après le découpage) — setSelectedDetailGenre/
  // setSelectedDetailBpmBucket restent ICI (source de vérité partagée avec
  // TrackList), simplement transmis en props aux deux.

  return (
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-8`}>
      {/* max-w-5xl → VIEW_CONTENT_WRAPPER (Refactor UI "harmoniser la
          distance horizontale à la Sidebar", 29/07, 7e itération, retour
          direct : "tu as la manie d'oublier certaines vues, comme quand
          je rentre dans une playlist") — cette vue n'utilise pas
          `<ViewHeader/>` (pas de titre H1 comparable aux 8 autres, elle
          affiche directement la carte de la séance via PlaylistHeader.jsx)
          donc elle n'était jamais apparue dans les recherches précédentes
          ciblant spécifiquement les usages de `<ViewHeader/>` — mais son
          conteneur englobant souffrait du même défaut structurel que
          DiscoverView.jsx (une 3e valeur différente, `max-w-5xl`, ni
          `max-w-4xl` ni l'ancien `max-w-7xl`). */}
      {/* Bouton Retour — Fix UI (27/07, "nettoyage global") : navigation
          interne à l'app (state `view`, PAS react-router — ce projet n'en
          utilise pas), via `changeView` (useNavigation.js) déjà utilisé
          partout ailleurs. Pas de vraie pile d'historique dans l'app (voir
          useNavigation.js — `changeView` prend toujours une vue EXPLICITE,
          jamais "la précédente") : cette page peut être atteinte depuis Mes
          Playlists, Découvrir, Stats, le mini-lecteur ou un import CSV (voir
          tous les appels à `changeView('playlist')`) — aucune de ces
          origines n'est retenue. 'Mes Playlists' choisi comme destination
          par défaut, cohérent avec le fait que c'est la vue "bibliothèque"
          dont celle-ci est un zoom. Si un jour un vrai "retour à l'origine"
          est
          nécessaire, il faudra une pile d'historique dédiée — hors périmètre
          ici.

          BUG CORRIGÉ (01/08, retour direct : "le bouton retour marche pas,
          ça dépend de la localisation du bouton" — diagnostiqué en
          confirmant que le clic redevenait fonctionnel une fois la fenêtre
          rétrécie via les DevTools) — la pastille flottante desktop
          d'App.jsx ("Header desktop flottant... isScrolled", `hidden md:flex
          absolute top-0 left-0 right-0 ... z-30 ... pointer-events-auto`)
          se superposait exactement à ce bouton une fois la page scrollée,
          sur desktop uniquement (breakpoint `md:`, d'où le clic qui
          redevenait possible dès que la fenêtre passait sous ce seuil).
          Cette pastille avait déjà été rendue non cliquable une 1re fois le
          29/07 pour un souci similaire (lien fantôme superposé à un titre de
          page `<ViewHeader/>`) — mais `pointer-events-auto` reste posé sur
          elle pour rester visible/lisible, ce qui suffit à avaler
          SILENCIEUSEMENT tout clic en dessous, gestionnaire ou pas.
          PlaylistDetailView.jsx n'utilise pas `<ViewHeader/>` (voir plus
          haut) et n'avait donc jamais été couvert par ce correctif de 29/07.
          `relative z-40` place ce bouton AU-DESSUS de la pastille (z-30),
          sous la Sidebar (z-50) et les modales (z-70) — cohérent avec
          l'échelle de z-index déjà en place ailleurs dans l'app. */}
      <button
        onClick={() => changeView('playlists')}
        className="relative z-40 mb-4 text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
      >
        ← Retour
      </button>


      {/* En-tête — extrait dans PlaylistHeader.jsx (chantier découpage,
          suite de TrackList/TrackItem). Le coin supérieur droit global n'a
          plus qu'UN SEUL élément potentiellement flottant ici (Thème
          déménagé dans Sidebar.jsx ; "Se connecter" conditionné à
          `!isGuestBarVisible`, voir App.jsx) — et sur CETTE vue précise, une
          playlist affichée implique toujours au moins une donnée
          sauvegardée, donc GuestModeBar est déjà visible et ce bouton déjà
          masqué : plus besoin de "Safe Zone" ici, la carte respire sur
          toute sa largeur — voir PlaylistHeader.jsx. */}
      <PlaylistHeader
        theme={theme} isLocked={isLocked} savedPlaylists={savedPlaylists}
        resolveAndTogglePreview={resolveAndTogglePreview} getNextTrackForAutoAdvance={getNextTrackForAutoAdvance}
        setPlaylistPlannedDate={setPlaylistPlannedDate} bpmChartActivityName={bpmChartActivityName}
        editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
        editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
        getRankStyle={getRankStyle} triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
        onShare={handleShareClick} onViewProfile={onViewProfile} changeView={changeView}
      />

      {/* Bloc d'analyse (courbe BPM + les 2 camemberts) — extrait dans
          PlaylistCharts.jsx. Réorganisation assumée : les camemberts sont
          désormais rendus juste après la courbe (voir la docstring de
          PlaylistCharts.jsx), donc AVANT la table de vérification CSV et
          TrackList — contrairement à l'ordre précédent. */}
      <PlaylistCharts
        theme={theme} colorMode={colorMode} isLocked={isLocked}
        favorites={favorites} toggleArtistFavorite={toggleArtistFavorite}
        resolveAndTogglePreview={resolveAndTogglePreview} getNextTrackForAutoAdvance={getNextTrackForAutoAdvance}
        playlistCadenceUnit={playlistCadenceUnit} bpmChartActivityName={bpmChartActivityName}
        hasDetailFilter={hasDetailFilter} trackMatchesDetailFilter={trackMatchesDetailFilter}
        selectedDetailGenre={selectedDetailGenre} selectedDetailBpmBucket={selectedDetailBpmBucket}
        setSelectedDetailGenre={setSelectedDetailGenre} setSelectedDetailBpmBucket={setSelectedDetailBpmBucket}
      />

      {/* Données brutes importées (CSV Garmin/Strava) — permet de vérifier
          ligne par ligne que ce que l'app a extrait correspond bien au
          fichier d'origine, plutôt que de devoir faire confiance au graphique
          seul. Repliée par défaut (voir showRawImportTable) : usage ponctuel
          de vérification, pas un affichage courant. */}
      {currentActualData && currentActualData.length > 0 && (
        <div className={`rounded-3xl border shadow-md ${cardBg} ${cardBorder} overflow-hidden`}>
          <button
            onClick={() => setShowRawImportTable(!showRawImportTable)}
            className={`w-full flex items-center justify-between p-4 md:p-6 text-left ${textHighlight}`}
          >
            <span className="font-bold text-lg flex items-center gap-2">
              <Activity className={textColorClass} size={20} />
              Données brutes importées ({currentActualData.length} points)
            </span>
            {showRawImportTable ? <ChevronUp size={20} className={textMuted} /> : <ChevronDown size={20} className={textMuted} />}
          </button>
          {showRawImportTable && (
            <div className="px-4 md:px-6 pb-6 overflow-x-auto max-h-96 overflow-y-auto">
              <p className={`text-xs mb-3 ${textMuted}`}>
                Chaque ligne correspond à un point du fichier CSV importé — compare ces valeurs à ton export Garmin/Strava d'origine pour vérifier que rien ne s'est perdu ou décalé à l'import.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left border-b ${cardBorder} ${textMuted} sticky top-0 ${cardBg}`}>
                    <th className="pb-2 pr-3 font-semibold">#</th>
                    <th className="pb-2 pr-3 font-semibold">Temps</th>
                    <th className="pb-2 pr-3 font-semibold">Cadence ({playlistCadenceUnit})</th>
                    <th className="pb-2 font-semibold">Fréquence cardiaque</th>
                  </tr>
                </thead>
                <tbody>
                  {currentActualData.map((point, i) => (
                    <tr key={point.timeSec} className={`border-b last:border-0 ${cardBorder}`}>
                      <td className={`py-1.5 pr-3 ${textMuted}`}>{point.circuit ?? i + 1}</td>
                      <td className={`py-1.5 pr-3 font-mono ${textHighlight}`}>{formatDuration(point.timeSec)}</td>
                      <td className={`py-1.5 pr-3 font-mono ${textHighlight}`}>{point.cadenceReelle !== undefined ? point.cadenceReelle : '—'}</td>
                      <td className={`py-1.5 font-mono ${textHighlight}`}>{point.heartRate !== undefined ? point.heartRate : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Liste des musiques — extraite dans TrackList.jsx (chantier
          découpage + refonte design "Coaching"). Voir TrackList.jsx pour le
          détail de ce qui reste passé en prop (partagé avec les camemberts
          de répartition, l'en-tête, la recherche globale) vs ce qui vient
          de usePlaylistDetail(). */}
      <TrackList
        theme={theme} isLocked={isLocked}
        favorites={favorites} toggleTrackFavorite={toggleTrackFavorite} toggleArtistFavorite={toggleArtistFavorite}
        resolveAndTogglePreview={resolveAndTogglePreview} getNextTrackForAutoAdvance={getNextTrackForAutoAdvance}
        setIsBpmSearchMode={setIsBpmSearchMode}
        hasDetailFilter={hasDetailFilter} trackMatchesDetailFilter={trackMatchesDetailFilter}
        selectedDetailGenre={selectedDetailGenre} selectedDetailBpmBucket={selectedDetailBpmBucket}
        setSelectedDetailGenre={setSelectedDetailGenre} setSelectedDetailBpmBucket={setSelectedDetailBpmBucket}
        isBpmChartUsingRealProfile={isBpmChartUsingRealProfile}
      />


      {/* Rendu hors écran, en permanence — voir generateSummaryImageFile plus
          haut pour pourquoi (pas monté/démonté à la demande). `pointer-events-
          none` par sécurité (jamais interactif, jamais censé être vu). */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={summaryCardRef}>
          <SessionSummaryCard playlist={currentPlaylist} topTrackCovers={summaryCovers} sessionCoverUrl={summarySessionCover} isNaughtyMode={isNaughtyMode} getProfileForWorkout={getProfileForWorkout} />
        </div>
      </div>
    </div>
  );
}

/**
 * PlaylistDetailView — Wrapper, chantier God Component étape 2/2. Seul
 * export par défaut de ce fichier (le tag JSX `<PlaylistDetailView/>` dans
 * App.jsx n'a donc rien à changer) : pose `<PlaylistDetailProvider>` — qui
 * n'enveloppe QUE le contenu de cette page, pas toute l'app, contrairement à
 * GeneratorProvider/AudioPlayerProvider (voir contexts/PlaylistDetailContext.jsx,
 * cette vue existe pour une "route" précise, pas de raison de la monter
 * globalement) — puis rend le vrai composant d'affichage
 * (`PlaylistDetailViewInner`, ci-dessus) à l'intérieur.
 *
 * Reçoit encore un paquet de props d'AppContent, réparties entre le Provider
 * (dont plusieurs dont PlaylistDetailViewInner lui-même n'a plus besoin
 * directement — ex. `setSavedPlaylists`/`spotifyTrackPool`/`userStats`/
 * `checkTrophies`, utiles uniquement aux handlers internes au contexte) et
 * la vue elle-même. RÉDUIT de 8 (21/08, extraction ShareImageContext.jsx —
 * summaryImageStatus/summaryImageFile/summaryImagePreviewUrl/
 * includeSummaryImage + leurs 4 setters, plus prop-drillés du tout) — ce
 * nombre ne baissera encore que si les dépendances restantes cessent
 * elles-mêmes d'être partagées avec PlaylistsView/ShareModal ailleurs dans
 * l'app — hors périmètre de ce chantier.
 */
export default function PlaylistDetailView({
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  favorites, spotifyTrackPool, userStats, checkTrophies,
  showToast, requestRemoveSavedPlaylist, handleSavePlaylist, handleClonePlaylist,
  currentActualData, selectedMetric, setSelectedMetric,
  dataOffset, setDataOffset,
  selectedAnalysisDate, setSelectedAnalysisDate, availableMetrics,
  theme, colorMode, handleShare,
  toggleTrackFavorite, toggleArtistFavorite,
  setIsBpmSearchMode, setPlaylistPlannedDate,
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate,
  getRankStyle, triggerCSVUpload, removeImportedData,
  username,
  // `onViewProfile` (07/08, retour direct : "cliquer sur le pseudo devrait
  // amener à sa vue statistiques") — reçu depuis App.jsx (`handleViewProfile`),
  // transmis tel quel à PlaylistHeader.jsx (seul consommateur réel ici,
  // pour rendre "TempoFit Officiel"/le pseudo du propriétaire cliquable).
  changeView, onViewProfile,
}) {
  return (
    // `PlaylistEditProvider` MONTÉ EN FRÈRE de `PlaylistDetailProvider`
    // (08/08, chantier "value non mémoïsée re-render tout le monde à
    // chaque frappe" — voir la docstring de PlaylistEditContext.jsx) —
    // PAS à l'intérieur, pas englobant dans l'autre sens : les deux
    // Providers sont indépendants, chacun reçoit séparément les 4 mêmes
    // props (`currentPlaylist`/`setCurrentPlaylist`/`savedPlaylists`/
    // `setSavedPlaylists`) dont il a besoin pour sa propre raison. Ordre
    // d'imbrication arbitraire (aucune dépendance entre eux).
    <PlaylistEditProvider
      currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
      savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
    >
      {/* Édition passée en modale (retour direct, captures à l'appui — voir
          la docstring de EditPlaylistModal.jsx). Montée ICI (à l'intérieur
          de PlaylistEditProvider, EN FRÈRE de PlaylistDetailProvider, pas
          dedans — n'a besoin d'aucun de ses champs) plutôt que dans
          ModalContainer.jsx (monté globalement dans App.jsx, sans accès à
          ce Contexte scopé à la vue détail d'une playlist) — même logique
          de placement que CustomActivityModal.jsx dans App.jsx. Ne reçoit
          que `theme` en prop, tout le reste vient de usePlaylistEdit(). */}
      <EditPlaylistModal theme={theme} />

      <PlaylistDetailProvider
        currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
        savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
        favorites={favorites} spotifyTrackPool={spotifyTrackPool}
        userStats={userStats} checkTrophies={checkTrophies}
        showToast={showToast} requestRemoveSavedPlaylist={requestRemoveSavedPlaylist} handleSavePlaylist={handleSavePlaylist}
        handleClonePlaylist={handleClonePlaylist}
        currentActualData={currentActualData} selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric}
        dataOffset={dataOffset} setDataOffset={setDataOffset}
        selectedAnalysisDate={selectedAnalysisDate} setSelectedAnalysisDate={setSelectedAnalysisDate}
        availableMetrics={availableMetrics}
        username={username}
      >
        <PlaylistDetailViewInner
          theme={theme} colorMode={colorMode}
          currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist} savedPlaylists={savedPlaylists}
          handleShare={handleShare}
          favorites={favorites} toggleTrackFavorite={toggleTrackFavorite} toggleArtistFavorite={toggleArtistFavorite}
          setIsBpmSearchMode={setIsBpmSearchMode}
          setPlaylistPlannedDate={setPlaylistPlannedDate}
          editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
          editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
          getRankStyle={getRankStyle} triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
          changeView={changeView} onViewProfile={onViewProfile}
        />
      </PlaylistDetailProvider>
    </PlaylistEditProvider>
  );
}
