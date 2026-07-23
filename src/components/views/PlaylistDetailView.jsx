import { useState, useRef, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { genreDisplayLabel, normalizeGenreForDisplay } from '../../musicCatalog';
import { getCadenceUnitLabel, getZoneForValue } from '../../appConfig';
import { formatDuration } from '../../utils/format';
import { deezerFetch } from '../../musicEngine';
import SessionSummaryCard from '../shared/SessionSummaryCard';
import { PlaylistDetailProvider, usePlaylistDetail } from '../../contexts/PlaylistDetailContext';
import TrackList from './PlaylistDetail/TrackList';
import PlaylistHeader from './PlaylistDetail/PlaylistHeader';
import PlaylistCharts from './PlaylistDetail/PlaylistCharts';

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
  handleShare, showToast,
  summaryImageStatus, setSummaryImageStatus, summaryImageFile, setSummaryImageFile,
  summaryImagePreviewUrl, setSummaryImagePreviewUrl, includeSummaryImage, setIncludeSummaryImage,
  formatCompletionDate,
  favorites, toggleTrackFavorite, toggleArtistFavorite,
  setIsBpmSearchMode, setIsSearchModalOpen,
  setPlaylistPlannedDate,
  renderCompletionsList, renderTopCompletionDate,
  getRankStyle, triggerCSVUpload,
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
  let bpmChartActivityName, isBpmChartUsingRealProfile;
  try {
    bpmChartActivityName = isNaughtyMode
      ? (currentPlaylist.config?.workoutName || currentPlaylist.workoutType || 'Autre')
      : (currentPlaylist.workoutType || 'Autre');
    isBpmChartUsingRealProfile = !!(getProfileForWorkout && getProfileForWorkout(bpmChartActivityName)?.isConfigured);
  } catch (e) {
    // DIAGNOSTIC TEMPORAIRE (bug "page blanche" en cours d'investigation) —
    // à retirer une fois confirmé/corrigé, voir même mécanisme dans TrackItem.jsx.
    throw new Error(`[PlaylistDetailView] currentPlaylist=${JSON.stringify(currentPlaylist)?.slice(0, 500)} | isNaughtyMode=${isNaughtyMode} | erreur d'origine: ${e.message}`);
  }

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
  // aussi le symbole") — déjà affichée sur la carte dans "Mes Séances"
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
  // `includeSummaryImage` sont reçus EN PROPS (pas des useState locaux) —
  // ShareModal.jsx, qui doit les LIRE pour afficher l'aperçu, est rendu une
  // seule fois globalement dans App.jsx, PAS à l'intérieur de cette vue :
  // cet état doit donc vivre à un niveau que les deux peuvent atteindre. La
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
    setSummaryImagePreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlaylist?.id]);

  /**
   * Génération PURE de l'image (pochettes → attente du rendu → capture
   * html2canvas → File) — ne partage ni ne télécharge rien elle-même.
   * Déclenchée en arrière-plan au clic sur "Partager" (voir
   * startBackgroundImageGeneration ci-dessous) ; ShareModal.jsx affiche
   * l'aperçu et gère elle-même le partage une fois l'image prête.
   */
  const generateSummaryImageFile = async () => {
    // 1. Pochettes des 3 premiers titres — uniquement pour ceux sourcés de
    // Deezer (trackId de la forme "deezer-{id}") ; un titre favori/
    // Spotify sans équivalent n'a pas d'ID Deezer exploitable, repli sur
    // l'icône générique dans SessionSummaryCard (composant volontairement
    // pur, aucun appel réseau dedans — voir sa docstring).
    const topTracks = currentPlaylist.tracks.slice(0, 3);
    const covers = {};
    await Promise.all(topTracks.map(async (t) => {
      if (!t.trackId || !t.trackId.startsWith('deezer-')) return;
      try {
        const { data } = await deezerFetch(`https://api.deezer.com/track/${t.trackId.replace('deezer-', '')}`);
        if (data?.album?.cover_medium) covers[t.trackId] = data.album.cover_medium;
      } catch (e) { /* pas de pochette pour ce titre — repli déjà géré côté composant */ }
    }));
    setSummaryCovers(covers);

    // 2. Laisse le temps au DOM de re-render avec les pochettes, ET aux
    // <img> de réellement finir de charger, AVANT de capturer — html2canvas
    // capture l'état du DOM à l'instant T ; une image encore en cours de
    // chargement à ce moment-là apparaîtrait vide sur la capture finale.
    await new Promise(resolve => setTimeout(resolve, 50));
    if (summaryCardRef.current) {
      const imgs = Array.from(summaryCardRef.current.querySelectorAll('img'));
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })));
    }

    // 3. Capture — import dynamique : html2canvas est une librairie assez
    // lourde pour une fonctionnalité optionnelle, pas la peine de l'inclure
    // dans le bundle principal chargé par tout le monde dès le départ.
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(summaryCardRef.current, { scale: 2, backgroundColor: null, useCORS: true });

    // 4. Canvas -> Blob -> File.
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Conversion en image échouée');
    return new File([blob], 'tempofit-bilan-de-seance.png', { type: 'image/png' });
  };

  // Lance la génération en arrière-plan — ne fait rien si déjà en cours ou
  // déjà prête pour CETTE playlist (voir le useEffect de reset ci-dessus
  // pour le changement de playlist).
  const startBackgroundImageGeneration = async () => {
    if (!currentPlaylist || summaryImageStatus === 'loading' || summaryImageStatus === 'ready') return;
    setSummaryImageStatus('loading');
    try {
      const file = await generateSummaryImageFile();
      setSummaryImageFile(file);
      setSummaryImagePreviewUrl(URL.createObjectURL(file));
      setSummaryImageStatus('ready');
    } catch (e) {
      // Échec silencieux ici — cette génération est un bonus discret en
      // arrière-plan, pas une action explicitement demandée par
      // l'utilisateur : un toast d'erreur pour quelque chose qu'il n'a pas
      // lui-même déclenché serait plus perturbant qu'utile. ShareModal reste
      // pleinement utilisable en mode texte/lien si ça échoue.
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
    const b = Math.floor(t.bpm / 20) * 20;
    return `${b}-${b + 19}`;
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
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      {/* En-tête — extrait dans PlaylistHeader.jsx (chantier découpage,
          suite de TrackList/TrackItem). */}
      <PlaylistHeader
        theme={theme} isLocked={isLocked} savedPlaylists={savedPlaylists}
        resolveAndTogglePreview={resolveAndTogglePreview} getNextTrackForAutoAdvance={getNextTrackForAutoAdvance}
        setPlaylistPlannedDate={setPlaylistPlannedDate}
        renderCompletionsList={renderCompletionsList} renderTopCompletionDate={renderTopCompletionDate}
        getRankStyle={getRankStyle} triggerCSVUpload={triggerCSVUpload}
        onShare={handleShareClick}
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
        formatCompletionDate={formatCompletionDate}
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
                    <tr key={i} className={`border-b last:border-0 ${cardBorder}`}>
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
        setIsBpmSearchMode={setIsBpmSearchMode} setIsSearchModalOpen={setIsSearchModalOpen}
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
          <SessionSummaryCard playlist={currentPlaylist} topTrackCovers={summaryCovers} isNaughtyMode={isNaughtyMode} getProfileForWorkout={getProfileForWorkout} />
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
 * Reçoit encore 39 props d'AppContent : 18 pour le Provider (dont 13 dont
 * PlaylistDetailViewInner lui-même n'a plus besoin directement — ex.
 * `setSavedPlaylists`/`spotifyTrackPool`/`userStats`/`checkTrophies`, utiles
 * uniquement aux handlers internes au contexte), 26 pour la vue elle-même
 * (5 en commun avec le Provider). Ce nombre ne baissera que si ces
 * dépendances cessent elles-mêmes d'être partagées avec PlaylistsView/
 * ShareModal ailleurs dans l'app — hors périmètre de ce chantier.
 */
export default function PlaylistDetailView({
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  favorites, spotifyTrackPool, userStats, checkTrophies,
  showToast, requestRemoveSavedPlaylist, handleSavePlaylist,
  currentActualData, selectedMetric, setSelectedMetric,
  dataOffset, setDataOffset,
  selectedAnalysisDate, setSelectedAnalysisDate, availableMetrics,
  theme, colorMode, handleShare,
  summaryImageStatus, setSummaryImageStatus, summaryImageFile, setSummaryImageFile,
  summaryImagePreviewUrl, setSummaryImagePreviewUrl, includeSummaryImage, setIncludeSummaryImage,
  formatCompletionDate, toggleTrackFavorite, toggleArtistFavorite,
  setIsBpmSearchMode, setIsSearchModalOpen, setPlaylistPlannedDate,
  renderCompletionsList, renderTopCompletionDate, getRankStyle, triggerCSVUpload,
}) {
  return (
    <PlaylistDetailProvider
      currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
      savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
      favorites={favorites} spotifyTrackPool={spotifyTrackPool}
      userStats={userStats} checkTrophies={checkTrophies}
      showToast={showToast} requestRemoveSavedPlaylist={requestRemoveSavedPlaylist} handleSavePlaylist={handleSavePlaylist}
      currentActualData={currentActualData} selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric}
      dataOffset={dataOffset} setDataOffset={setDataOffset}
      selectedAnalysisDate={selectedAnalysisDate} setSelectedAnalysisDate={setSelectedAnalysisDate}
      availableMetrics={availableMetrics}
    >
      <PlaylistDetailViewInner
        theme={theme} colorMode={colorMode}
        currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist} savedPlaylists={savedPlaylists}
        handleShare={handleShare} showToast={showToast}
        summaryImageStatus={summaryImageStatus} setSummaryImageStatus={setSummaryImageStatus}
        summaryImageFile={summaryImageFile} setSummaryImageFile={setSummaryImageFile}
        summaryImagePreviewUrl={summaryImagePreviewUrl} setSummaryImagePreviewUrl={setSummaryImagePreviewUrl}
        includeSummaryImage={includeSummaryImage} setIncludeSummaryImage={setIncludeSummaryImage}
        formatCompletionDate={formatCompletionDate}
        favorites={favorites} toggleTrackFavorite={toggleTrackFavorite} toggleArtistFavorite={toggleArtistFavorite}
        setIsBpmSearchMode={setIsBpmSearchMode} setIsSearchModalOpen={setIsSearchModalOpen}
        setPlaylistPlannedDate={setPlaylistPlannedDate}
        renderCompletionsList={renderCompletionsList} renderTopCompletionDate={renderTopCompletionDate}
        getRankStyle={getRankStyle} triggerCSVUpload={triggerCSVUpload}
      />
    </PlaylistDetailProvider>
  );
}
