import { useState, useRef, useEffect } from 'react';
import {
  Check, Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Pause, Play,
  GripVertical, Star, MoreVertical, Plus, User, RefreshCw, X, Calendar, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Lock, Upload, Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend, Line, PieChart, Pie, Cell,
} from 'recharts';
import { getGenresForDisplay, genreDisplayLabel, normalizeGenreForDisplay } from '../../musicCatalog';
import { getCadenceUnitLabel, DISTRIBUTION_COLORS, getZoneForValue } from '../../appConfig';
import { formatDuration } from '../../utils/format';
import { deezerFetch } from '../../musicEngine';
import SessionSummaryCard from '../shared/SessionSummaryCard';

// Couleur du donut "Répartition par style" (genre musical, pas de zone
// d'intensité concernée) : `DISTRIBUTION_COLORS` (appConfig.js, partagée
// avec App.jsx), assignée par INDEX comme avant.
//
// Le donut "Répartition par BPM" ne l'utilise plus directement — RETOUR
// DIRECT (capture d'écran, couleurs/valeurs incohérentes avec le Profil
// Athlétique) : chaque entrée de `bpmDistributionData` (App.jsx) porte
// maintenant son propre `color`, déjà résolu depuis `ATHLETIC_ZONES` quand un
// profil est configuré pour cette activité (mêmes couleurs que Stats/
// Générer/le bilan de séance), avec un repli sur cette même palette générique
// uniquement si aucun profil n'est configuré — voir bpmDistributionData dans
// App.jsx pour le détail.

// Tooltip personnalisé affiché au survol d'un point du graphique BPM. Affiche
// le nom du morceau (si dispo), le temps écoulé, et selon les données
// disponibles le BPM cible (musique) et/ou la cadence réelle en PPM (import Garmin/Strava).
const CustomChartTooltip = ({ active, payload, isNaughtyMode, currentUnit, metric, cadenceUnit }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl min-w-[200px]">
        {data.trackName && <p className="font-black text-sm text-main mb-1 truncate">{data.trackName}</p>}
        {/* "Début" = position de ce titre dans la séance ; "Durée" = longueur du
            titre lui-même — deux informations distinctes, clairement étiquetées. */}
        <p className="text-xs text-gray-500 font-medium mb-1 flex items-center space-x-1">
          <Clock size={12}/> <span>{data.trackName ? 'Début' : 'Temps'} : {formatDuration(data.time)}</span>
        </p>
        {data.trackDuration !== undefined && (
          <p className="text-xs text-gray-500 font-medium mb-3 flex items-center space-x-1">
            <Clock size={12}/> <span>Durée : {formatDuration(data.trackDuration)}</span>
          </p>
        )}
        <div className="flex flex-col gap-2">
            {data.bpmTarget !== undefined && (
               <div className={`px-2 py-1.5 rounded text-xs font-bold font-mono text-white ${isNaughtyMode ? 'bg-rose-500' : 'bg-gray-800 dark:bg-gray-700'}`}>
                 🎯 Cible: {data.bpmTarget} BPM musical
               </div>
            )}
            {data.realValue !== undefined && (
               <div className="px-2 py-1.5 rounded text-xs font-bold font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                 {metric === 'heartRate' ? `❤️ Fréquence cardiaque: ${data.realValue} pulsations/min` : `🏃 Cadence réelle: ${data.realValue} ${cadenceUnit}`}
               </div>
            )}
        </div>
      </div>
    );
  }
  return null;
};

// Point personnalisé de la courbe "réelle" (Cadence PPM OU Fréquence cardiaque,
// selon `metric`). La coloration "feu tricolore" n'a de sens QUE pour la
// cadence, comparable au BPM musical cible ("1 pas = 1 temps"). La fréquence
// cardiaque n'a pas de cible équivalente dans TempoFit — point neutre unique.
const RealDataDot = (props) => {
  const { cx, cy, payload, tolerance, metric } = props;
  if (payload.realValue === undefined) return null;
  if (metric !== 'cadence' || payload.targetAtTime === undefined) {
    return <circle cx={cx} cy={cy} r={4} fill="#ec4899" stroke="white" strokeWidth={1} />;
  }
  const target = payload.targetAtTime;
  const real = payload.realValue;
  const tol = tolerance || 10;
  let fill = "#3b82f6";
  if (real >= target - tol && real <= target + tol) fill = "#22c55e";
  else if (real < target - tol) fill = "#f59e0b";
  else fill = "#ef4444";
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="white" strokeWidth={1} />;
};

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
export default function PlaylistDetailView({
  theme, colorMode, isNaughtyMode,
  currentPlaylist, savedPlaylists, getProfileForWorkout, getProfileForWorkoutOrDefault,
  isEditingPlaylistName, setIsEditingPlaylistName, editedPlaylistName, setEditedPlaylistName, handleRenamePlaylist,
  handleSavePlaylist, handleUnsavePlaylist, handleShare,
  showToast,
  summaryImageStatus, setSummaryImageStatus, summaryImageFile, setSummaryImageFile,
  summaryImagePreviewUrl, setSummaryImagePreviewUrl, includeSummaryImage, setIncludeSummaryImage,
  currentActualData, selectedMetric, setSelectedMetric, analysisStats,
  selectedAnalysisDate, setSelectedAnalysisDate, formatCompletionDate, availableMetrics,
  dataOffset, setDataOffset,
  chartAxisType, setChartAxisType, chartDistanceUnit, setChartDistanceUnitOverride,
  selectedSegmentIdx, setSelectedSegmentIdx, trackSegments, togglePreview, playingPreviewId,
  unifiedChartData, handleChartClick, chartXDomain, chartXTicks, chartYDomain, distanceDisplayFactor,
  handleChartMouseDown, handleChartMouseMove, handleChartMouseUp, isDraggingChartSegment,
  draggedTrackIndex, handleTrackDragStart, handleTrackDragEnter, handleTrackDragEnd,
  favorites, toggleTrackFavorite, toggleArtistFavorite,
  openTrackMenuIndex, setOpenTrackMenuIndex,
  handleDuplicateTrack, handleReplaceTrackSameArtist, handleReplaceTrack, handleRemoveTrack,
  setIsBpmSearchMode, setIsSearchModalOpen,
  bpmDistributionData, genreDistributionData,
  setPlaylistPlannedDate,
  renderCompletionsList, renderTopCompletionDate,
  getRankStyle, triggerCSVUpload,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, borderAccentClass, inputBg, inputBorder } = theme;
  // Replié par défaut : ce tableau ne sert qu'à vérifier ponctuellement une
  // correspondance de données (import CSV Garmin/Strava), pas à un usage courant.
  const [showRawImportTable, setShowRawImportTable] = useState(false);
  // Filet de sécurité multi-navigateurs pour le bouton "Planifier" (voir plus
  // bas) : un <input type="date"> rendu invisible et superposé à un <label>
  // s'ouvre au clic dans la plupart des navigateurs, mais pas de façon fiable
  // partout (Safari en particulier peut ignorer ce clic précis, sans aucune
  // erreur visible) — d'où le retour "le bouton Planifier ne fonctionne pas".
  const plannedDateInputRef = useRef(null);

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

  // --- CTA "Importer mes données" (retour direct : maquette UI/UX complète) ---
  // Cible la date de complétion la plus RÉCENTE (celle qu'on vient de
  // marquer/refaire est la plus probable à vouloir enrichir) plutôt que
  // d'exiger que la personne choisisse elle-même laquelle dans le cas
  // fréquent d'une seule date. Les dates plus anciennes restent gérables
  // individuellement via la liste détaillée (renderCompletionsList).
  const mostRecentCompletionIso = isLocked ? currentPlaylist.completions[currentPlaylist.completions.length - 1] : null;
  const hasImportedDataForMostRecent = !!(mostRecentCompletionIso && currentPlaylist.actualDataByDate && currentPlaylist.actualDataByDate[mostRecentCompletionIso]);

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
  const bpmChartProfile = getProfileForWorkoutOrDefault ? getProfileForWorkoutOrDefault(bpmChartActivityName) : null;
  const isSyncMode = bpmChartProfile?.cadenceIntent === 'sync';
  const syncTarget = bpmChartProfile?.targetBpm ?? null;
  const syncTrackGaps = (isSyncMode && syncTarget)
    ? currentPlaylist.tracks.filter(t => t.bpm).map(t => ({ title: t.title, artist: t.artist, bpm: t.bpm, gap: t.bpm - syncTarget }))
    : [];
  const syncAvgGap = syncTrackGaps.length > 0
    ? Math.round(syncTrackGaps.reduce((s, t) => s + Math.abs(t.gap), 0) / syncTrackGaps.length)
    : null;

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
  const playlistRanks = [...savedPlaylists.filter(p => p.completions && p.completions.length > 0)]
    .sort((a, b) => b.completions.length - a.completions.length)
    .map(p => p.id);
  const currentPlaylistRank = playlistRanks.indexOf(currentPlaylist.id);
  const currentPlaylistRankStyle = getRankStyle ? getRankStyle(currentPlaylistRank) : null;

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
  // Comparaison par `.id` plutôt que `.youtubeId` : un titre dupliqué (voir
  // handleDuplicateTrack) partage le même youtubeId que l'original, mais a
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
    // Deezer (youtubeId de la forme "deezer-{id}") ; un titre favori/
    // Spotify sans équivalent n'a pas d'ID Deezer exploitable, repli sur
    // l'icône générique dans SessionSummaryCard (composant volontairement
    // pur, aucun appel réseau dedans — voir sa docstring).
    const topTracks = currentPlaylist.tracks.slice(0, 3);
    const covers = {};
    await Promise.all(topTracks.map(async (t) => {
      if (!t.youtubeId || !t.youtubeId.startsWith('deezer-')) return;
      try {
        const { data } = await deezerFetch(`https://api.deezer.com/track/${t.youtubeId.replace('deezer-', '')}`);
        if (data?.album?.cover_medium) covers[t.youtubeId] = data.album.cover_medium;
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
  // faire, ça ne le faisait pas) — ce camembert classe maintenant SOIT par
  // zone d'effort (`bpmDistributionData` en mode zone, `isBpmChartUsingRealProfile`)
  // SOIT par tranche brute de 20 BPM (repli), voir plus haut. Mais cette
  // fonction calculait TOUJOURS la tranche brute, même en mode zone — un clic
  // sur "Seuil" mettait `selectedDetailBpmBucket` à `{'Seuil'}`, alors que
  // chaque titre était comparé à sa tranche "140-159" : aucune correspondance
  // possible, la sélection dans le camembert n'avait donc jamais d'effet sur
  // la liste des titres ni sur la courbe. Corrigé en calculant le MÊME type
  // de label que celui affiché dans le camembert, selon le mode actif.
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
  const activeDetailFilterLabel = [
    selectedDetailGenre.size > 0 ? [...selectedDetailGenre].join(', ') : null,
    selectedDetailBpmBucket.size > 0 ? `${[...selectedDetailBpmBucket].join(', ')}${!isBpmChartUsingRealProfile ? ' BPM' : ''}` : null,
  ].filter(Boolean).join(' · ');

  // BUG CORRIGÉ (retour direct) : le clic direct sur la courbe (surbrillance
  // ROUGE d'UN segment précis, `selectedSegmentIdx`, pré-existant) et le clic
  // sur une part de camembert (surbrillance AMBRE de TOUS les segments
  // correspondants, ajouté ensuite) sont 2 mécanismes indépendants qui
  // pouvaient rester actifs EN MÊME TEMPS sans lien entre eux — un clic sur la
  // courbe fait quelques temps plus tôt restait affiché (carte du haut +
  // surbrillance rouge) pendant qu'un filtre camembert différent était
  // sélectionné, donnant l'impression trompeuse qu'un titre hors de la
  // tranche BPM demandée faisait pourtant partie du résultat. Rendus
  // mutuellement exclusifs : sélectionner l'un efface l'autre, un seul
  // "pourquoi c'est en surbrillance" possible à la fois.
  const selectDetailGenre = (name) => {
    setSelectedDetailGenre(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
    setSelectedSegmentIdx(null);
  };
  const selectDetailBpmBucket = (name) => {
    setSelectedDetailBpmBucket(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
    setSelectedSegmentIdx(null);
  };
  const handleChartClickAndClearZoomFilter = (state) => {
    setSelectedDetailGenre(new Set());
    setSelectedDetailBpmBucket(new Set());
    handleChartClick(state);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={"relative rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0 md:space-x-8 bg-gradient-to-br " + (isNaughtyMode ? 'from-rose-50 to-rose-100 dark:from-gray-900 dark:to-rose-950/40' : 'from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800') + " " + (currentPlaylistRankStyle ? currentPlaylistRankStyle.border : (isNaughtyMode ? 'border-rose-200 dark:border-rose-900/50' : cardBorder))}>
        {/* RETOUR DIRECT ("prends du recul — si la séance est faite, elle
            est de base sauvegardée, l'utilisateur le sait déjà ; juste
            besoin d'une option pour SUPPRIMER, une corbeille comme celle
            déjà utilisée sur les cartes de Mes Séances ; et l'icône doit
            être dans la ligne des infos de date, pas ici dans ce coin") —
            l'icône check/X ajoutée au tour précédent ici, à côté du badge de
            rang, est retirée : ce coin redevient réservé au SEUL badge de
            rang (le check vert présumait qu'il fallait CONFIRMER que la
            séance est sauvegardée, alors que pour une séance déjà réalisée
            c'est un fait acquis, pas une info à afficher). Voir plus bas
            (ligne date/statut) pour la corbeille, désormais au bon endroit
            et avec la bonne icône. */}
        {currentPlaylistRankStyle && (
          <span
            className="absolute -top-2 -right-2 text-xl z-10"
            title={`${currentPlaylist.completions.length} fois — la ${currentPlaylistRank === 0 ? 'plus' : currentPlaylistRank === 1 ? '2e plus' : '3e plus'} utilisée`}
          >
            {currentPlaylistRankStyle.emoji}
          </span>
        )}
        <div className="relative group/cover">
          <div className={"w-32 h-32 md:w-48 md:h-48 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner text-5xl md:text-7xl " + inputBg}>
            <div className={"absolute inset-0 opacity-10 dark:opacity-20 " + (isNaughtyMode ? 'bg-rose-500' : 'bg-red-500')}></div>
            {currentPlaylist.coverIcon}
          </div>
        </div>
        <div className="flex-1 text-center md:text-left space-y-4 w-full">
          {/* RETOUR DIRECT (maquette UI/UX complète) : "isole et remonte la
              date tout en haut de la carte, au-dessus du titre, avec un style
              discret" — sur-titre propre, avant même le nom de la playlist.
              Reprend la même donnée que l'ancien emplacement (juste retiré de
              la ligne meta-infos plus bas, voir plus loin) — pas une 2e
              source de vérité, juste déplacée. */}
          {/* RETOUR DIRECT (capture d'écran à l'appui, 2 tours de suite) :
              "la notion de séance déjà réalisée ne doit pas être un gros
              bouton vert en fin d'encart — en haut, rouge, plus fin, sans
              encart. Le vert renvoie du positif, pas le fait qu'on ne puisse
              plus modifier." Distinction importante entre 2 messages
              différents qui partageaient avant le même vert "succès" comme
              s'ils disaient la même chose :
              - "Sauvegardée dans Mes Séances" (icône verte en haut à droite
                de la carte, retour direct suivant — voir plus haut) :
                une vraie bonne nouvelle, reste vert.
              - "Verrouillée" : une RESTRICTION (plus aucune modification
                possible), pas un accomplissement — le vert lui prêtait à
                tort le même ton positif. Remonté à côté de la date (même
                niveau d'information : "quand" + "peut-on encore y toucher"),
                dans `textColorClass` (le rouge/rose D'ACCENT déjà utilisé
                partout ailleurs dans l'app pour ce qui mérite l'attention —
                pas une couleur d'alarme inventée pour l'occasion), en texte
                fin (text-xs) plutôt qu'un gros encart à fond coloré.
              La liste des dates supplémentaires (séance rejouée) reste
              affichée juste en dessous si besoin — plus de carte/bordure
              autour, elle redevient un simple prolongement discret de cette
              ligne de statut plutôt qu'un bloc à part avec son propre poids
              visuel. */}
          {/* RETOUR DIRECT ("le planifier à nouveau devrait être en haut,
              avec les infos relatives aux dates") — "Planifier"/"Planifier à
              nouveau" rejoint la ligne date + statut verrouillé : les 2
              parlent de "quand" (déjà fait / prévu ensuite), ça n'avait pas
              de sens de les séparer en 2 lignes distinctes. Reste visible
              même AVANT toute complétion (`!isLocked`, libellé "Planifier"
              tout court) — seule la partie date/verrouillé reste
              conditionnée à `isLocked`, la logique d'origine n'a pas changé,
              seul l'EMPLACEMENT du bouton. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              {isLocked && currentPlaylist.completions.length > 0 && (
                <>
                  {/* RETOUR DIRECT ("le cadenas me semble suffisant, et
                      faudrait le mettre avant la date : on a fait (verrou),
                      à une date donnée (la date)") — 2 changements : le mot
                      "Verrouillée" retiré (l'icône + le tooltip "Séance déjà
                      réalisée" suffisent déjà, même logique que la corbeille
                      plus loin, déjà icône seule sans texte) ; et le cadenas
                      passe AVANT la date pour suivre l'ordre de lecture
                      naturel du fait ("c'est verrouillé") puis de son détail
                      ("depuis quand"). */}
                  {/* RETOUR DIRECT ("essaie de resserrer le lien visuel
                      entre le cadenas et la date, plutôt que de les empiler")
                      — groupés dans leur propre conteneur `gap-1.5` (plus
                      serré que le `gap-3` du reste de la ligne, qui sépare
                      des éléments plus indépendants comme le bouton
                      "Planifier") : le cadenas qualifie directement la date
                      ("cette date est verrouillée"), les rapprocher rend ce
                      lien plus lisible sans empiler ni casser l'alignement
                      horizontal du reste de la ligne (cadenas/calendrier/
                      corbeille, tous côte à côte). */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold flex items-center ${textColorClass}`}
                      title="Séance déjà réalisée"
                    >
                      <Lock size={12}/>
                    </span>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${textMuted}`}>
                      {renderTopCompletionDate ? renderTopCompletionDate(currentPlaylist) : new Date(currentPlaylist.completions[0].slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </>
              )}
              {/* "Planifier" déplacé ici (retour direct, 2 tours de suite :
                  d'abord "au même niveau que les infos de la playlist", puis
                  "avec les infos relatives aux dates") — reste identique en
                  tout point (même handler, même filet de sécurité showPicker,
                  même libellé conditionnel selon isLocked), seul
                  l'EMPLACEMENT change à nouveau. N'apparaît que si la
                  playlist est déjà sauvegardée (même condition qu'avant),
                  puisque planifier une séance qui n'est pas encore dans "Mes
                  Séances" n'a pas de sens. */}
              {savedPlaylists.find(p => p.id === currentPlaylist.id) && (
                <label
                  onClick={(e) => {
                    // showPicker() force l'ouverture explicitement là où l'API existe
                    // (Chrome/Edge récents) — sans ce filet, le clic pouvait ne
                    // simplement rien faire dans certains navigateurs. Sur les
                    // navigateurs sans showPicker (Safari plus anciens, Firefox),
                    // on laisse le comportement natif label→input inchangé.
                    if (plannedDateInputRef.current?.showPicker) {
                      e.preventDefault();
                      plannedDateInputRef.current.showPicker();
                    }
                  }}
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0 ${cardBorder} ${textHighlight}`}
                  title={
                    // Une fois la séance déjà réalisée, "planifier" ne peut plus
                    // vouloir dire "prévoir sa première fois" — ça ne peut plus
                    // être qu'une intention de la refaire plus tard.
                    //
                    // RETOUR DIRECT ("'Refaire cette séance' me semble
                    // suffisant avec l'icône calendrier") — raccourci : le
                    // bouton affiche déjà "Planifier"/"Planifier à nouveau"
                    // (le QUOI est visible), le tooltip n'a plus qu'à ajouter
                    // le POURQUOI, pas réexpliquer le mécanisme de tri déjà
                    // sous-entendu par l'icône calendrier.
                    isLocked ? "Refaire cette séance" : "Planifier cette séance"
                  }
                >
                  {/* RETOUR DIRECT ("le calendrier pour 'planifier à
                      nouveau' me semble suffisant") — nuance par rapport aux
                      simplifications précédentes (Verrouillée, corbeille) :
                      là où "Planifier"/"Planifier à nouveau" est un label
                      GÉNÉRIQUE sans info propre (l'icône + le tooltip
                      suffisent, retiré ci-dessous), la DATE effectivement
                      planifiée (`plannedDate`) est une vraie donnée, pas un
                      simple libellé — la garder affichée évite d'avoir à
                      cliquer pour savoir QUAND c'est planifié. */}
                  <Calendar size={14} />
                  {currentPlaylist.plannedDate && (
                    <span>{new Date(currentPlaylist.plannedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  )}
                  <input
                    ref={plannedDateInputRef}
                    type="date"
                    value={currentPlaylist.plannedDate || ''}
                    onChange={(e) => setPlaylistPlannedDate(currentPlaylist.id, e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              )}
              {/* RETOUR DIRECT ("prends du recul — si la séance est faite,
                  elle est de base sauvegardée, l'utilisateur le sait ; juste
                  besoin d'une option pour supprimer, une corbeille comme
                  celle déjà utilisée sur les cartes de Mes Séances ; l'icône
                  dans la bulle, tout à droite des options de date, pas sur
                  la ligne du coin") — remplace l'ancien check/X du coin
                  supérieur droit. Une séance verrouillée EST forcément déjà
                  sauvegardée (les complétions vivent directement sur l'objet
                  playlist dans `savedPlaylists`) — plus besoin de le
                  CONFIRMER visuellement, juste de permettre de la retirer.
                  `ml-auto` pousse la corbeille tout à droite de cette ligne
                  (au lieu de rester collée aux autres badges) ; même icône
                  (`Trash2`) et même teinte au survol (gris → rouge) que la
                  corbeille des cartes dans "Mes Séances" (PlaylistCard.jsx)
                  — un seul vocabulaire visuel pour "supprimer" dans toute
                  l'app. `handleUnsavePlaylist` reste la même fonction
                  qu'avant (confirmation déjà intégrée si historique à
                  perdre). Repli "Ajouter à Mes Séances" si la playlist n'est
                  pas encore sauvegardée (seul cas où cette ligne serait sinon
                  vide, puisque date/verrouillé/planifier ne s'affichent que
                  pour une playlist déjà sauvegardée).
                  RETOUR DIRECT SUIVANT ("pas la peine de mettre un texte au
                  survol quand il y a déjà un message d'avertissement qui
                  arrive au clic") — le `title` du bouton corbeille répétait
                  MOT POUR MOT l'avertissement de la modale de confirmation
                  (`requestUnsavePlaylist`/`handleUnsavePlaylist`, voir
                  App.jsx) : la même phrase lue 2 fois, une fois de trop.
                  Retiré ici — l'icône poubelle seule suffit à communiquer
                  l'intention (convention universelle), et la modale reste le
                  SEUL endroit où le détail ("historique perdu") s'affiche,
                  au moment où il compte vraiment (juste avant de confirmer),
                  pas en survolant. */}
              {savedPlaylists.find(p => p.id === currentPlaylist.id) ? (
                <button
                  onClick={handleUnsavePlaylist}
                  className={`ml-auto p-1.5 rounded-lg transition-colors shrink-0 ${textMuted} hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                >
                  <Trash2 size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSavePlaylist}
                  title="Ajoute cette séance à 'Mes Séances', ton journal de séances (passées et à venir)."
                  className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0 ${cardBorder} ${textHighlight}`}
                >
                  <Save size={14} /> <span>Ajouter à Mes Séances</span>
                </button>
              )}
            </div>
            {/* N'affiche cette liste que s'il reste au moins UNE date au-delà
                de `completions[0]` (déjà montrée, éditable, juste au-dessus) :
                sur une séance jamais rejouée (le cas le plus courant), il
                n'y aurait plus rien à montrer ici. */}
            {isLocked && renderCompletionsList && currentPlaylist.completions.length > 1 && (
              <div className="pt-0.5">
                {renderCompletionsList(currentPlaylist, mostRecentCompletionIso, [currentPlaylist.completions[0]])}
              </div>
            )}
          </div>

          {/* RETOUR DIRECT ("le titre doit être sur une seule ligne") — à
              text-5xl, ce titre passait sur 2 lignes dès qu'il dépassait
              ~20 caractères (ex. "Exemple : Session Rock/Métal"). Taille
              réduite (text-2xl/text-4xl) pour que la plupart des titres
              tiennent sur une ligne SANS jamais être coupés — et `truncate`
              en filet de sécurité pour les noms vraiment longs (renommage
              libre par l'utilisateur, aucune limite de longueur imposée à la
              saisie) : mieux vaut "Un très long nom de séan…" que de
              re-passer sur 2 lignes. Le texte doit être dans son PROPRE
              `<span>` avec `min-w-0` pour que `truncate` fonctionne dans un
              parent `flex` (sur l'élément flex lui-même, `truncate` seul ne
              suffit pas — un flex-item ne rétrécit pas sous son contenu par
              défaut). */}
          {isEditingPlaylistName ? (
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <input
                type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlaylist(); if (e.key === 'Escape') setIsEditingPlaylistName(false); }}
                className={`text-2xl md:text-4xl font-black bg-transparent outline-none border-b-2 ${borderAccentClass} ${textHighlight} w-full`}
              />
              <button onClick={handleRenamePlaylist} className={`p-2 rounded-lg text-white shrink-0 ${bgAccentClass}`}><Check size={20}/></button>
            </div>
          ) : (
            <h2 className={"text-2xl md:text-4xl font-black flex items-center gap-3 justify-center md:justify-start " + textHighlight}>
              <span className="truncate min-w-0" title={currentPlaylist.name}>{currentPlaylist.name}</span>
              <button onClick={() => { setEditedPlaylistName(currentPlaylist.name); setIsEditingPlaylistName(true); }} className={`p-1.5 rounded-lg ${textMuted} hover:text-main transition-colors shrink-0`} title="Renommer la playlist">
                <Edit3 size={20}/>
              </button>
            </h2>
          )}
          {/* Ligne 1 : infos de la playlist SEULES (retour direct : "aère le
              contenu central" — plus mélangée avec la date/les actions, qui
              ont chacune leur propre ligne ci-dessous). */}
          <div className={"flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium " + textMuted}>
            <div className="flex items-center space-x-1"><Activity size={16}/><span>{currentPlaylist.workoutType}</span></div><span>•</span>
            <div className="flex items-center space-x-1"><Clock size={16}/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div><span>•</span>
            <div className="flex items-center space-x-1"><Music size={16}/><span>{currentPlaylist.tracks.length} titres</span></div>
            {(() => {
              const cfg = currentPlaylist.config || {};
              // Les genres SÉLECTIONNÉS (cfg.selectedGenres) sont déjà des noms
              // canoniques de l'app (ex. "K-pop") — ne JAMAIS les repasser dans
              // normalizeGenreForDisplay (prévu pour nettoyer un genre BRUT venu
              // de Deezer). Bug rencontré : "K-pop" contient le mot "pop", donc
              // normalizeGenreForDisplay('K-pop') matchait "Pop" en premier et
              // affichait le mauvais genre. Seul le repli (genres réels des
              // titres, quand aucun genre n'a été explicitement sélectionné) a
              // besoin de cette normalisation.
              if (cfg.selectedGenres && cfg.selectedGenres.length > 0) {
                return (
                  <>
                    <span>•</span>
                    <div className="flex items-center space-x-1"><Music size={16}/><span>{cfg.selectedGenres.map(genreDisplayLabel).join(', ')}</span></div>
                  </>
                );
              }
              const genres = Array.from(new Set(currentPlaylist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
              return genres.length > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1"><Music size={16}/><span>{Array.from(new Set(genres.flatMap(getGenresForDisplay))).join(', ')}</span></div>
                </>
              );
            })()}
          </div>

          {/* Ligne 3 : badges secondaires (retour direct : "aère... entre le
              bloc titre/métadonnées, les actions principales et les badges
              secondaires") — mt-2 en plus du space-y-4 du parent pour bien
              les détacher visuellement du bloc d'actions juste au-dessus.
              Le bouton "Sauvegardée dans Mes Séances"/"Ajouter à Mes
              Séances" qui vivait ici a été retiré (retour direct : "prend
              trop de place") — remplacé par l'icône compacte en haut à
              droite de la carte (voir plus haut). */}
          <div className="flex items-center flex-wrap justify-center md:justify-start gap-3 mt-2">
            {/* RETOUR DIRECT ("j'imagine le bouton d'import de données et le
                bouton de partage sur la même ligne : d'abord importer, puis
                partager") — l'ancien bouton pleine largeur (voir plus bas
                dans ce fichier pour l'historique de ce bouton) rejoint cette
                ligne, réduit d'un CTA "phare" (px-6 py-5, texte base) à la
                taille d'un bouton inline (px-4 py-2, texte sm) pour tenir à
                côté de "Partager" — garde son fond blanc/texte noir forcé et
                son animation `animate-pulse` (seules dérogations à la règle
                "ne toucher aucune couleur", toujours d'actualité : ce bouton
                doit rester visuellement distinct/prioritaire même réduit).
                Positionné AVANT "Partager" (ordre demandé : importer d'abord,
                partager ensuite).
                RETOUR DIRECT SUIVANT ("redonne-lui un peu plus de poids,
                peut-être un peu plus large, mais surtout pas plus haut") —
                `px-4` → `px-6` (plus large) et `font-black` (plus gras,
                undistinguishable en HAUTEUR) — `py-2` INCHANGÉ exprès : ne
                touche à rien qui joue sur la hauteur de la ligne, uniquement
                la largeur/le poids visuel du texte. */}
            {isLocked && triggerCSVUpload && (
              <button
                onClick={(e) => triggerCSVUpload(e, currentPlaylist, mostRecentCompletionIso)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-sm shrink-0 bg-white text-black shadow-lg transition-transform hover:scale-[1.02] ${hasImportedDataForMostRecent ? 'animate-in fade-in zoom-in duration-500' : 'animate-pulse'}`}
              >
                {hasImportedDataForMostRecent ? (
                  <>
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <span>Données importées</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} className="shrink-0" />
                    <span>Importe tes données</span>
                  </>
                )}
              </button>
            )}
            {/* RETOUR DIRECT ("plus besoin des 2 boutons si l'image est déjà
                dans le 1er") — les 2 options de l'ancien menu déroulant
                ("Partager le lien" vs "Bilan en image") ont fusionné en UN
                SEUL bouton : depuis le chantier précédent, ShareModal génère
                déjà l'image en arrière-plan et l'inclut directement dans
                l'aperçu du partage (avec une croix pour la retirer si on ne
                la veut pas) — les 2 chemins distincts n'avaient plus de
                raison d'exister séparément. `startBackgroundImageGeneration`
                lance la génération au clic (avant, au clic sur "Partager"
                pour OUVRIR le menu — même déclencheur, juste plus besoin du
                menu intermédiaire). */}
            <button
              onClick={() => { startBackgroundImageGeneration(); handleShare('playlist', currentPlaylist); }}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            >
              <Share2 size={16} /> <span>Partager</span>
            </button>
          </div>

          {/* L'ancien bandeau "Séance déjà réalisée" (gros encart vert avec
              cadenas) a été retiré d'ici — retour direct : "ne doit pas être
              un gros bouton vert en fin d'encart, il doit être en haut,
              rouge et plus fin, sans encart, le vert renvoie du positif pas
              le fait qu'on ne puisse plus modifier". Son contenu (statut
              verrouillé + dates de complétion supplémentaires) vit
              maintenant tout en haut de la carte, à côté de la date — voir
              plus haut. */}

          {/* Le bouton "Complète ta séance : importe tes données sportives !"
              qui vivait ici en CTA pleine largeur a rejoint la ligne
              Partager juste au-dessus (retour direct : "sur la même ligne,
              importer d'abord, partager ensuite") — il n'est plus ici. */}
        </div>
      </div>

      <div className={"mt-8 p-6 md:p-8 rounded-3xl border shadow-lg " + cardBg + " " + cardBorder}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div>
            <h3 className={"font-bold text-xl flex items-center space-x-2 " + textHighlight}>
              <Activity className={textColorClass}/>
              <span>{currentActualData ? (selectedMetric === 'heartRate' ? "Fréquence cardiaque de la séance" : `Analyse Cadence (${playlistCadenceUnit}) vs BPM cible`) : "Courbe d'intensité (BPM)"}</span>
            </h3>
            {/* Les stats de "match %" ne s'affichent qu'en mode Cadence : la FC
                n'a pas de cible équivalente dans TempoFit (voir analysisStats). */}
            {currentActualData && selectedMetric === 'cadence' && analysisStats && (
              <div className="flex items-center gap-3 mt-3 text-xs font-bold bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                <span className="text-green-600 dark:text-green-400">🎯 Match: {analysisStats.matchPct}%</span>
                <span className="text-red-500">⬆ Rapide: {analysisStats.abovePct}%</span>
                <span className="text-yellow-600 dark:text-yellow-500">⬇ Lent: {analysisStats.belowPct}%</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Sélecteur de séance à analyser — n'apparaît que si au moins 2 dates
                de complétion ont des données réelles importées. */}
            {currentPlaylist.actualDataByDate && Object.keys(currentPlaylist.actualDataByDate).length > 1 && (
              <select
                value={selectedAnalysisDate || ''}
                onChange={(e) => setSelectedAnalysisDate(e.target.value)}
                className={`px-3 py-2 rounded-lg text-xs font-bold ${inputBg} border ${inputBorder} ${textHighlight}`}
              >
                {Object.keys(currentPlaylist.actualDataByDate).sort().reverse().map(iso => (
                  <option key={iso} value={iso}>Séance du {formatCompletionDate(iso)}</option>
                ))}
              </select>
            )}
            {/* Sélecteur cadence/FC — n'apparaît que si les DEUX métriques sont
                présentes pour cette séance précise. */}
            {availableMetrics.cadence && availableMetrics.heartRate && (
              <div className="flex items-center bg-surface-hover rounded-lg p-1">
                <button onClick={() => setSelectedMetric('cadence')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (selectedMetric === 'cadence' ? 'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted)}>Cadence ({playlistCadenceUnit})</button>
                <button onClick={() => setSelectedMetric('heartRate')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (selectedMetric === 'heartRate' ? 'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted)}>Fréquence cardiaque</button>
              </div>
            )}
            {currentActualData && (
              <div className="flex items-center gap-2 bg-surface-hover p-1 rounded-lg">
                <button onClick={() => setDataOffset(o => o - 10)} className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">-10s</button>
                <span className={"text-xs font-bold w-24 text-center " + textMuted}>Décalage: {dataOffset > 0 ? '+' : ''}{dataOffset}s</span>
                <button onClick={() => setDataOffset(o => o + 10)} className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">+10s</button>
              </div>
            )}
            <div className="flex items-center bg-surface-hover rounded-lg p-1">
              <button onClick={() => setChartAxisType('temps')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartAxisType === 'temps' ? 'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted)}>Temps (Min)</button>
              {/* Toujours proposé, même pour une playlist générée en mode Temps (pas
                  seulement `targetMode === 'distance'`, comme c'était le cas avant —
                  régression signalée directement) : une distance est calculable pour
                  N'IMPORTE QUELLE playlist via l'allure/BPM (`startDistVal`, voir
                  App.jsx), pas seulement celles basées sur une distance cible. Pour
                  une playlist Temps, c'est une distance ESTIMÉE (déduite du rythme),
                  pas mesurée — mais l'estimation reste utile et cohérente avec le
                  reste de l'app (même logique déjà utilisée pour le trophée "100
                  Bornes au Compteur", qui cumule aussi cette distance estimée). */}
              <button onClick={() => setChartAxisType('distance')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartAxisType === 'distance' ? 'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted)}>Distance</button>
            </div>
            {/* Sélecteur km/mi : purement cosmétique, ne change jamais l'unité
                réellement utilisée pour générer la playlist. */}
            {chartAxisType === 'distance' && (
              <div className="flex items-center bg-surface-hover rounded-lg p-1">
                <button onClick={() => setChartDistanceUnitOverride('km')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartDistanceUnit === 'km' ? 'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted)}>km</button>
                <button onClick={() => setChartDistanceUnitOverride('mi')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartDistanceUnit === 'mi' ? 'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted)}>mi</button>
              </div>
            )}
          </div>
        </div>

        {/* Encart fixe pour le segment sélectionné — remplace la bulle flottante
            de Recharts qui suivait la souris et se repositionnait de façon
            instable. Ici, la position ne bouge jamais : seul le contenu change
            selon le segment sélectionné (piloté par selectedSegmentIdx).
            Retour direct : flèches précédent/suivant (changer de titre sans
            viser un point précis sur la courbe) + les mêmes actions de base
            que dans la liste plus bas (dupliquer/remplacer/supprimer/favori) —
            réutilise EXACTEMENT les mêmes handlers, pas une 2e implémentation. */}
        <div className={`mb-4 p-4 rounded-2xl border ${cardBorder} ${inputBg} flex items-center gap-3 min-h-[76px]`}>
          {selectedSegmentIdx !== null && trackSegments[selectedSegmentIdx] ? (
            <>
              <button
                onClick={() => setSelectedSegmentIdx(Math.max(0, selectedSegmentIdx - 1))}
                disabled={selectedSegmentIdx === 0}
                title="Titre précédent"
                className={`shrink-0 p-2 rounded-lg transition-colors ${textMuted} hover:text-main hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
              >
                <ChevronLeft size={18}/>
              </button>
              <button
                onClick={() => togglePreview(trackSegments[selectedSegmentIdx].track, getNextTrackForAutoAdvance)}
                disabled={!trackSegments[selectedSegmentIdx].track.preview}
                title={trackSegments[selectedSegmentIdx].track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${trackSegments[selectedSegmentIdx].track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
              >
                {playingPreviewId === trackSegments[selectedSegmentIdx].track.youtubeId ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}
              </button>
              {/* Retour direct : "la flèche pour passer au titre suivant est
                  trop à gauche [comprendre : trop loin du bouton play], je
                  l'imaginais plus à côté du bouton play/pause" — déplacée ici,
                  juste après lecture/pause, pour former un vrai groupe de
                  contrôles (précédent / lecture / suivant) au lieu d'être
                  isolée à l'autre bout de l'encart, à côté du BPM et du menu. */}
              <button
                onClick={() => setSelectedSegmentIdx(Math.min(trackSegments.length - 1, selectedSegmentIdx + 1))}
                disabled={selectedSegmentIdx === trackSegments.length - 1}
                title="Titre suivant"
                className={`shrink-0 p-2 rounded-lg transition-colors ${textMuted} hover:text-main hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
              >
                <ChevronRight size={18}/>
              </button>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm truncate ${textHighlight}`}>{trackSegments[selectedSegmentIdx].track.title}</div>
                <div className={`text-xs truncate ${textMuted}`}>{trackSegments[selectedSegmentIdx].track.artist}{trackSegments[selectedSegmentIdx].track.genre ? ` · ${getGenresForDisplay(trackSegments[selectedSegmentIdx].track.genre, trackSegments[selectedSegmentIdx].track.artist, trackSegments[selectedSegmentIdx].track.title).join(', ')}` : ''}{trackSegments[selectedSegmentIdx].track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}</div>
              </div>
              <div className={`text-xs font-mono ${textMuted} shrink-0 hidden md:block`}>
                Début : {formatDuration(trackSegments[selectedSegmentIdx].startTime)}<br/>
                Durée : {formatDuration(trackSegments[selectedSegmentIdx].track.duration)}
              </div>
              <div className={`px-3 py-2 rounded-lg text-sm font-bold font-mono text-white shrink-0 ${isNaughtyMode ? 'bg-rose-500' : 'bg-gray-800 dark:bg-gray-700'}`}>
                🎯 {trackSegments[selectedSegmentIdx].track.bpm} BPM
              </div>

              {/* Actions de base — mêmes handlers que le menu "⋮" de la liste
                  plus bas (voir openTrackMenuIndex, partagé avec la liste : ouvrir
                  ce menu ici ouvre aussi le menu de la ligne correspondante dans
                  la liste, cohérent puisque c'est le même titre). */}
              <div className="relative shrink-0">
                <button onClick={() => setOpenTrackMenuIndex(openTrackMenuIndex === selectedSegmentIdx ? null : selectedSegmentIdx)} className={`p-2 rounded-lg transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`} title="Plus d'options">
                  <MoreVertical size={16}/>
                </button>
                {openTrackMenuIndex === selectedSegmentIdx && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenTrackMenuIndex(null)}></div>
                    <div className={`absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border shadow-2xl ${cardBg} ${cardBorder} overflow-hidden`}>
                      {/* Même règle que le menu de la liste plus bas : contenu
                          verrouillé une fois la séance déjà réalisée, seul
                          "favoriser l'artiste" reste possible (voir isLocked). */}
                      {!isLocked && (
                        <>
                          <button onClick={() => { handleDuplicateTrack(selectedSegmentIdx); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <Plus size={16} className="text-green-500"/> Dupliquer ce titre
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                          <button onClick={() => { handleReplaceTrackSameArtist(selectedSegmentIdx); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <User size={16} className="text-purple-500"/> Remplacer (même artiste)
                          </button>
                          <button onClick={() => { handleReplaceTrack(selectedSegmentIdx); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <RefreshCw size={16} className="text-blue-500"/> Remplacer (recherche large)
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                        </>
                      )}
                      {(() => {
                        const seg = trackSegments[selectedSegmentIdx];
                        const artistIsFav = favorites.artists.includes(seg.track.artist);
                        return (
                          <button onClick={() => { toggleArtistFavorite(seg.track.artist); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <Star size={16} className="text-amber-500" fill={artistIsFav ? 'currentColor' : 'none'}/> {artistIsFav ? `Retirer ${seg.track.artist} des favoris` : `Favoriser l'artiste (${seg.track.artist})`}
                          </button>
                        );
                      })()}
                      {!isLocked && (
                        <>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                          <button
                            onClick={() => {
                              const removedIdx = selectedSegmentIdx;
                              handleRemoveTrack(removedIdx);
                              setOpenTrackMenuIndex(null);
                              // Reste sur un titre valide après suppression plutôt que
                              // de laisser l'encart retomber sur "aucun segment
                              // sélectionné" — le titre qui prenait la place occupe
                              // maintenant cet index (ou le précédent si on supprimait
                              // le dernier).
                              setSelectedSegmentIdx(Math.min(removedIdx, trackSegments.length - 2 >= 0 ? trackSegments.length - 2 : 0));
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                          >
                            <X size={16}/> Retirer de la playlist
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <span className={`text-sm ${textMuted}`}>Clique sur un segment du graphique pour voir le détail du titre et l'écouter.</span>
          )}
        </div>

        <div className="h-72 w-full relative">
          {/* Repère flottant pendant un glissement actif — en plus de la
              surbrillance ambre sur la courbe, un texte explicite qui ne
              laisse aucun doute sur ce qui se passe. */}
          {isDraggingChartSegment && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg pointer-events-none animate-in fade-in zoom-in duration-200">
              ↔ Déplacement en cours...
            </div>
          )}
          {currentPlaylist.tracks.length === 0 ? (
            <div className={`h-full flex items-center justify-center text-center px-6 ${textMuted}`}>
              Cette playlist ne contient aucun morceau (durée/distance probablement vide au moment de la génération) — regénère-la avec une distance ou une durée renseignée.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            {/* Interaction par CLIC plutôt que par survol continu : plus fiable,
                plus rapide, et le résultat reste stable tant qu'on ne clique pas
                ailleurs. */}
            <LineChart
              data={unifiedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              onClick={handleChartClickAndClearZoomFilter}
              // Glisser-déposer directement sur la courbe désactivé une fois la
              // séance verrouillée (voir isLocked) — le simple clic (sélection/
              // consultation d'un segment, géré par onClick ci-dessus) reste lui
              // toujours possible, ce n'est pas une modification de contenu.
              onMouseDown={isLocked ? undefined : handleChartMouseDown} onMouseMove={isLocked ? undefined : handleChartMouseMove}
              onMouseUp={isLocked ? undefined : handleChartMouseUp} onMouseLeave={isLocked ? undefined : handleChartMouseUp}
              style={{ cursor: isDraggingChartSegment ? 'grabbing' : 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colorMode === 'dark' ? '#374151' : '#e5e7eb'} vertical={false} />

              {/* Surbrillance de TOUT le segment sélectionné, déterminée via handleChartMouseMove.
                  Retour direct ("ça manque d'indication visuelle quand je déplace un
                  morceau via le graphique") : style DISTINCT pendant un glissement actif
                  (ambre, contour en pointillés, plus opaque) — sinon rien ne distingue
                  visuellement "je fais glisser ce titre" d'un simple clic de sélection
                  (les 2 utilisaient la même surbrillance rouge fine). */}
              {selectedSegmentIdx !== null && trackSegments[selectedSegmentIdx] && (
                <ReferenceArea
                  x1={chartAxisType === 'distance' ? trackSegments[selectedSegmentIdx].startDist * distanceDisplayFactor : trackSegments[selectedSegmentIdx].startTime}
                  x2={chartAxisType === 'distance' ? trackSegments[selectedSegmentIdx].endDist * distanceDisplayFactor : trackSegments[selectedSegmentIdx].endTime}
                  fill={isDraggingChartSegment ? '#f59e0b' : (isNaughtyMode ? '#f43f5e' : '#ef4444')}
                  fillOpacity={isDraggingChartSegment ? 0.28 : 0.12}
                  stroke={isDraggingChartSegment ? '#f59e0b' : 'none'}
                  strokeWidth={isDraggingChartSegment ? 2 : 0}
                  strokeDasharray={isDraggingChartSegment ? '6 4' : undefined}
                />
              )}

              {/* Surbrillance de TOUS les segments correspondant au filtre actif d'un
                  des 2 camemberts plus bas (Répartition par style/BPM) — distincte de
                  la surbrillance rouge ci-dessus (un clic direct sur la courbe), en
                  ambre pour ne pas les confondre visuellement. */}
              {hasDetailFilter && trackSegments.map((seg, i) => trackMatchesDetailFilter(seg.track) && (
                <ReferenceArea
                  key={`filter-${i}`}
                  x1={chartAxisType === 'distance' ? seg.startDist * distanceDisplayFactor : seg.startTime}
                  x2={chartAxisType === 'distance' ? seg.endDist * distanceDisplayFactor : seg.endTime}
                  fill="#f59e0b"
                  fillOpacity={0.18}
                  stroke="none"
                />
              ))}

              {/* Repère vertical fin à chaque début de morceau. */}
              {trackSegments.map((seg, i) => (
                <ReferenceLine
                  key={i}
                  x={chartAxisType === 'distance' ? seg.startDist * distanceDisplayFactor : seg.startTime}
                  stroke="#3b82f6"
                  strokeOpacity={0.5}
                  strokeDasharray="2 2"
                />
              ))}

              <XAxis
                dataKey={chartAxisType === 'distance' ? (d) => parseFloat(d.startDistVal) * distanceDisplayFactor : 'time'}
                type="number"
                domain={chartXDomain}
                ticks={chartXTicks}
                stroke={colorMode === 'dark' ? '#9ca3af' : '#6b7280'}
                tick={{fontSize: 12}}
                tickFormatter={chartAxisType === 'distance' ? (val) => (Number.isInteger(val) ? `${val} ${chartDistanceUnit}` : `${val.toFixed(2)} ${chartDistanceUnit}`) : formatDuration}
                allowDuplicatedCategory={false}
              />
              <YAxis domain={chartYDomain} stroke={colorMode === 'dark' ? '#9ca3af' : '#6b7280'} tick={{fontSize: 12}} width={40} />

              <RechartsTooltip
                content={(props) => <CustomChartTooltip {...props} isNaughtyMode={isNaughtyMode} currentUnit={currentPlaylist.distanceUnit} metric={selectedMetric} cadenceUnit={playlistCadenceUnit} />}
                isAnimationActive={false}
              />
              <Legend wrapperStyle={{fontSize: '12px', paddingTop: '15px'}}/>

              <Line
                dataKey="bpmTarget"
                name="Cible (BPM musical)"
                type="stepAfter"
                stroke={isNaughtyMode ? '#f43f5e' : '#ef4444'}
                strokeWidth={3}
                connectNulls
                dot={{ r: 3, fill: isNaughtyMode ? '#f43f5e' : '#ef4444', strokeWidth: 0 }}
              />

              {currentActualData && (
                <Line
                  dataKey="realValue"
                  name={selectedMetric === 'heartRate' ? "Fréquence cardiaque (pulsations/min)" : `Cadence réelle (${playlistCadenceUnit})`}
                  type="monotone"
                  stroke={selectedMetric === 'heartRate' ? '#ec4899' : '#3b82f6'}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  connectNulls
                  dot={<RealDataDot tolerance={currentPlaylist.tolerance} metric={selectedMetric} />}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

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

      {/* Liste des musiques AVEC BOUTON AJOUT MANUEL */}
      <div className={"rounded-3xl border overflow-hidden shadow-md " + cardBg + " " + cardBorder}>
        {/* Bandeau de filtre actif — apparaît uniquement après un clic sur une part
            d'un des 2 camemberts plus bas (voir selectedDetailGenre/
            selectedDetailBpmBucket) : indique clairement quel filtre est appliqué
            à la liste ci-dessous, avec un moyen explicite de le lever plutôt que de
            devoir re-cliquer la part exacte dans le graphique. */}
        {hasDetailFilter && (
          <div className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold border-b ${cardBorder} bg-black/5 dark:bg-white/5 ${textHighlight}`}>
            <span>
              Titres associés
              {selectedDetailGenre.size > 0 && <> · <span className={textColorClass}>{[...selectedDetailGenre].join(', ')}</span></>}
              {selectedDetailBpmBucket.size > 0 && <> · <span className={textColorClass}>{[...selectedDetailBpmBucket].join(', ')}{!isBpmChartUsingRealProfile ? ' BPM' : ''}</span></>}
            </span>
            <button onClick={() => { setSelectedDetailGenre(new Set()); setSelectedDetailBpmBucket(new Set()); }} className={`underline ${textMuted} hover:text-main`}>
              Réinitialiser
            </button>
          </div>
        )}
        <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {currentPlaylist.tracks.map((track, index) => (
            <div
              key={track.id}
              draggable={!isLocked}
              onDragStart={isLocked ? undefined : handleTrackDragStart(index)}
              onDragEnter={isLocked ? undefined : handleTrackDragEnter(index)}
              onDragOver={isLocked ? undefined : (e) => e.preventDefault()}
              onDragEnd={isLocked ? undefined : handleTrackDragEnd}
              className={`flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 group transition-opacity ${draggedTrackIndex === index ? 'opacity-40' : ''} ${hasDetailFilter && !trackMatchesDetailFilter(track) ? 'opacity-30' : ''} ${hasDetailFilter && trackMatchesDetailFilter(track) ? `${isNaughtyMode ? 'bg-rose-50 dark:bg-rose-950/20' : 'bg-red-50 dark:bg-red-950/20'}` : ''}`}
            >
              {/* Poignée de glisser-déposer — remplace les flèches ↑/↓. Grisée et
                  non interactive sur une séance déjà réalisée : on ne réordonne
                  plus un historique (voir isLocked). */}
              <div
                className={`shrink-0 px-1 ${textMuted} ${isLocked ? 'opacity-20 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                title={isLocked ? "Verrouillé — impossible de réordonner une séance déjà réalisée" : "Glisser pour réordonner"}
              >
                <GripVertical size={16}/>
              </div>
              <div className={"w-6 text-center font-medium text-xs " + textMuted}>{index + 1}</div>
              <button
                onClick={() => togglePreview(track, getNextTrackForAutoAdvance)}
                disabled={!track.preview}
                title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors mr-2 ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
              >
                {playingPreviewId === track.youtubeId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
              </button>
              <div className="flex-1 px-2 min-w-0">
                <div className={"font-bold text-sm truncate " + textHighlight}>{track.title}</div>
                <div className={"text-xs truncate " + textMuted}>{track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}</div>
              </div>
              <div className="w-28 text-center shrink-0">
                <div className={"font-mono font-bold text-sm " + textColorClass}>{track.bpm} <span className={`text-[10px] font-normal ${textMuted}`}>BPM</span></div>
                <div className={`text-[11px] font-mono ${textMuted}`} title="Moment où ce titre démarre dans la séance">
                  Début : {track.startTimeStr || '0m 00s'}
                </div>
                <div
                  className={`text-[11px] font-mono ${textMuted}`}
                  title="Durée réelle du morceau dans la séance — l'extrait écoutable reste toujours limité à 30 secondes, quelle que soit cette durée."
                >
                  Durée : {formatDuration(track.duration)}
                </div>
              </div>

              {/* Bouton favori — n'affecte que la liste de favoris, jamais la
                  playlist en cours (contrairement au X ci-dessous). */}
              {(() => {
                const isFav = favorites.tracks.some(t => t.youtubeId === track.youtubeId);
                return (
                  <button
                    onClick={() => toggleTrackFavorite(track)}
                    className={`p-2 rounded-lg transition-colors shrink-0 ${isFav ? 'text-amber-500' : textMuted + ' hover:text-amber-500'}`}
                    title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <Star size={16} fill={isFav ? 'currentColor' : 'none'}/>
                  </button>
                );
              })()}

              {/* Menu d'options unique (Dupliquer / Remplacer large / Remplacer même artiste). */}
              <div className="relative shrink-0">
                <button onClick={() => setOpenTrackMenuIndex(openTrackMenuIndex === index ? null : index)} className={"p-2 rounded-lg transition-colors " + textMuted + " hover:" + textHighlight} title="Plus d'options">
                  <MoreVertical size={16}/>
                </button>
                {openTrackMenuIndex === index && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenTrackMenuIndex(null)}></div>
                    {/* Menu ouvert vers le HAUT pour les derniers titres de la liste (sinon
                        coupé par l'overflow-hidden du conteneur arrondi). */}
                    <div className={`absolute right-0 z-20 w-64 rounded-xl border shadow-2xl ${cardBg} ${cardBorder} overflow-hidden ${
                      index >= currentPlaylist.tracks.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}>
                      {/* Dupliquer/Remplacer changent le CONTENU de la playlist —
                          masqués une fois la séance verrouillée (voir isLocked) :
                          modifier des titres après coup fausserait un historique
                          déjà réel. Favoriser un artiste n'affecte que les
                          favoris globaux, jamais cette playlist : reste possible. */}
                      {!isLocked && (
                        <>
                          <button onClick={() => { handleDuplicateTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <Plus size={16} className="text-green-500"/> Dupliquer ce titre
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                          <button onClick={() => { handleReplaceTrackSameArtist(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <User size={16} className="text-purple-500"/> Remplacer (même artiste)
                          </button>
                          <button onClick={() => { handleReplaceTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <RefreshCw size={16} className="text-blue-500"/> Remplacer (recherche large)
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                        </>
                      )}
                      {(() => {
                        const artistIsFav = favorites.artists.includes(track.artist);
                        return (
                          <button onClick={() => { toggleArtistFavorite(track.artist); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                            <Star size={16} className="text-amber-500" fill={artistIsFav ? 'currentColor' : 'none'}/> {artistIsFav ? `Retirer ${track.artist} des favoris` : `Favoriser l'artiste (${track.artist})`}
                          </button>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>

              {isLocked ? (
                <div className={"p-2 shrink-0 opacity-20 " + textMuted} title="Verrouillé — impossible de retirer un titre d'une séance déjà réalisée">
                  <Lock size={16}/>
                </div>
              ) : (
                <button onClick={() => handleRemoveTrack(index)} className={"p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors shrink-0 " + textMuted} title="Retirer de la proposition">
                  <X size={16}/>
                </button>
              )}
            </div>
          ))}

          {/* BOUTON AJOUT MANUEL — remplacé par un message explicite une fois la
              séance verrouillée (voir isLocked) : ajouter un titre à une
              playlist déjà réalisée changerait rétroactivement ce qui a été
              effectivement écouté. */}
          {isLocked ? (
            <div className={"p-3 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center gap-2 text-xs font-bold " + textMuted}>
              <Lock size={14}/> Séance déjà réalisée — plus aucun titre ne peut être ajouté, dupliqué, remplacé ou retiré
            </div>
          ) : (
            <div className="p-2 bg-gray-50 dark:bg-gray-900/50">
              <button onClick={() => { setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={"w-full py-3 flex items-center justify-center gap-2 text-sm font-bold border-2 border-dashed rounded-xl transition-colors hover:border-gray-400 " + inputBorder + " " + textMuted + " hover:" + textHighlight}>
                <Plus size={18} /> <span>Ajouter un titre</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Répartition BPM et style musical — pondérées par la durée de chaque
          titre, pas juste un compte de titres. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} shadow-xl`}>
          <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${textHighlight}`}><Music className={textColorClass} size={20}/> Répartition par style</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genreDistributionData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} cornerRadius={4} stroke="none"
                  onClick={(entry) => selectDetailGenre(entry.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {genreDistributionData.map((entry, i) => <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} opacity={selectedDetailGenre.size > 0 && !selectedDetailGenre.has(entry.name) ? 0.35 : 1} />)}
                </Pie>
                <RechartsTooltip formatter={(value, name) => {
                  const total = genreDistributionData.reduce((s, e) => s + e.value, 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return [`${formatDuration(value)} (${pct}%)`, name];
                }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
            {genreDistributionData.map((entry, i) => {
              const total = genreDistributionData.reduce((s, e) => s + e.value, 0);
              const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
              return (
                <button
                  key={i}
                  onClick={() => selectDetailGenre(entry.name)}
                  className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedDetailGenre.has(entry.name) ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }}></span>
                  <span className={textHighlight}>{entry.name}</span>
                  <span className={textMuted}>{pct}%</span>
                </button>
              );
            })}
          </div>
          {/* Récap des titres associés à la part sélectionnée — retour direct :
              la mise en évidence dans la liste plus haut (voir hasDetailFilter/
              trackMatchesDetailFilter) ne suffisait pas, il fallait aussi voir
              CES titres directement sous le camembert, sans remonter la page. */}
          {hasDetailFilter && (
            <div className={`mt-4 pt-4 border-t ${cardBorder} space-y-1`}>
              <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${textMuted}`}>Titres · {activeDetailFilterLabel}</div>
              {currentPlaylist.tracks.filter(trackMatchesDetailFilter).map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm py-1">
                  <div className="min-w-0">
                    <div className={`font-semibold truncate ${textHighlight}`}>{t.title}</div>
                    <div className={`text-xs truncate ${textMuted}`}>{t.artist}</div>
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${textColorClass}`}>{t.bpm} BPM</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} shadow-xl`}>
          {/* RETOUR DIRECT ("le jargon 'effort' a-t-il un sens avec une
              estimation par défaut, ou tranches de BPM brutes dans ce cas ?")
              — revient à un titre CONDITIONNEL (comme avant le pivot "profil
              fictif") : "Tes zones d'intensité" seulement si un vrai profil
              est configuré (`isBpmChartUsingRealProfile`, déjà strict —
              `getProfileForWorkout`, pas `getProfileForWorkoutOrDefault`),
              sinon "Répartition par BPM" — le nom doit refléter CE QUI EST
              VRAIMENT affiché (des tranches de BPM génériques, jamais TES
              zones tant que tu n'as rien configuré). Même règle que le mode
              Synchro, qui ne s'active déjà que sur un vrai profil. */}
          <h3 className={`font-bold text-lg flex items-center gap-2 ${textHighlight}`}>
            <Activity className={textColorClass} size={20}/> {isSyncMode ? 'Ta synchro cadence' : (isBpmChartUsingRealProfile ? 'Tes zones d\'intensité' : 'Répartition par BPM')}
          </h3>
          <p className={`text-xs mb-4 ${textMuted}`}>
            {isSyncMode
              ? 'Mode Synchro — la musique doit suivre ta cadence, pas ton intensité.'
              : (isBpmChartUsingRealProfile
                  ? 'Basé sur ton Profil Athlétique.'
                  : 'Répartition brute des titres écoutés — indépendante de ton profil.')}
          </p>
          {isSyncMode ? (
            /* RETOUR DIRECT ("indicateur d'écart : un chiffre + les points
                autour d'une ligne cible, ça te convient ?" → "oui") — pas de
                camembert ici : en Synchro, ce qui compte c'est "est-ce que la
                musique est restée proche de MA cadence", pas une répartition
                par zone (les 4 zones sont volontairement resserrées, un
                camembert y serait presque unicolore). `syncTarget` = le BPM
                de base entré dans le Profil Athlétique (zone2/targetBpm) —
                LA cible de synchro pour cette activité. */
            syncTrackGaps.length > 0 ? (
              <div>
                <div className={`text-2xl font-black mb-1 ${textHighlight}`}>
                  Écart moyen : <span className={textColorClass}>{syncAvgGap} BPM</span>
                </div>
                <p className={`text-xs mb-4 ${textMuted}`}>Cible : {syncTarget} BPM — chaque point est un titre, positionné selon son écart à la cible.</p>
                {/* Axe horizontal simple (pas Recharts, ce n'est pas vraiment un
                    "chart" au sens graphique de données — juste une frise) : la
                    cible est TOUJOURS au centre (50%), l'écart max observé fixe
                    l'échelle des bords, jamais une valeur arbitraire qui
                    écraserait ou exagérerait les écarts réels. */}
                {(() => {
                  const maxAbsGap = Math.max(10, ...syncTrackGaps.map(t => Math.abs(t.gap)));
                  return (
                    <div className="relative h-16 mt-2">
                      <div className={`absolute left-0 right-0 top-1/2 h-px ${cardBorder} border-t`}></div>
                      <div className={`absolute left-1/2 top-0 bottom-0 w-px ${isNaughtyMode ? 'bg-rose-500' : 'bg-red-500'}`}></div>
                      {syncTrackGaps.map((t, i) => {
                        const pct = 50 + (t.gap / maxAbsGap) * 45; // 45% de marge de chaque côté, jamais collé au bord
                        return (
                          <div
                            key={i}
                            title={`${t.title} — ${t.bpm} BPM (${t.gap > 0 ? '+' : ''}${t.gap})`}
                            className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 shadow ${isNaughtyMode ? 'bg-rose-400' : 'bg-red-400'}`}
                            style={{ left: `${pct}%`, top: `${8 + (i % 3) * 14}px` }}
                          ></div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className={`flex justify-between text-[10px] mt-1 ${textMuted}`}>
                  <span>Plus lent</span>
                  <span>Cible ({syncTarget})</span>
                  <span>Plus rapide</span>
                </div>
              </div>
            ) : (
              <p className={`text-sm ${textMuted}`}>Aucun titre avec BPM exploitable pour cette séance.</p>
            )
          ) : (
          <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bpmDistributionData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} cornerRadius={4} stroke="none"
                  onClick={(entry) => selectDetailBpmBucket(entry.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {bpmDistributionData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={selectedDetailBpmBucket.size > 0 && !selectedDetailBpmBucket.has(entry.name) ? 0.35 : 1} />)}
                </Pie>
                <RechartsTooltip formatter={(value, name) => {
                  const total = bpmDistributionData.reduce((s, e) => s + e.value, 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return [`${formatDuration(value)} (${pct}%)`, isBpmChartUsingRealProfile ? name : `${name} BPM`];
                }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
            {bpmDistributionData.map((entry, i) => {
              const total = bpmDistributionData.reduce((s, e) => s + e.value, 0);
              const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
              return (
                <button
                  key={i}
                  onClick={() => selectDetailBpmBucket(entry.name)}
                  className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedDetailBpmBucket.has(entry.name) ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                  <span className={textHighlight}>{entry.name}</span>
                  <span className={textMuted}>{pct}%</span>
                </button>
              );
            })}
          </div>
          {hasDetailFilter && (
            <div className={`mt-4 pt-4 border-t ${cardBorder} space-y-1`}>
              <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${textMuted}`}>Titres · {activeDetailFilterLabel}</div>
              {currentPlaylist.tracks.filter(trackMatchesDetailFilter).map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm py-1">
                  <div className="min-w-0">
                    <div className={`font-semibold truncate ${textHighlight}`}>{t.title}</div>
                    <div className={`text-xs truncate ${textMuted}`}>{t.artist}</div>
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${textColorClass}`}>{t.bpm} BPM</span>
                </div>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </div>

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
