import { useState, useRef } from 'react';
import {
  Check, Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Pause, Play,
  GripVertical, Star, MoreVertical, Plus, User, RefreshCw, X, Calendar, ChevronDown, ChevronUp,
  Camera, Loader2, ChevronLeft, ChevronRight, Lock, Circle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend, Line, PieChart, Pie, Cell,
} from 'recharts';
import { getGenresForDisplay, genreDisplayLabel, normalizeGenreForDisplay } from '../../musicCatalog';
import { formatDuration } from '../../utils/format';
import { deezerFetch } from '../../musicEngine';
import SessionSummaryCard from '../shared/SessionSummaryCard';

// Couleurs des 2 donuts en bas de page (répartition BPM / style) — statique,
// n'utilisée que dans ce composant.
const DISTRIBUTION_COLORS = ['#f43f5e', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

// Tooltip personnalisé affiché au survol d'un point du graphique BPM. Affiche
// le nom du morceau (si dispo), le temps écoulé, et selon les données
// disponibles le BPM cible (musique) et/ou la cadence réelle en PPM (import Garmin/Strava).
const CustomChartTooltip = ({ active, payload, isNaughtyMode, currentUnit, metric }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl min-w-[200px]">
        {data.trackName && <p className="font-black text-sm text-gray-900 dark:text-white mb-1 truncate">{data.trackName}</p>}
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
                 {metric === 'heartRate' ? `❤️ Fréquence cardiaque: ${data.realValue} pulsations/min` : `🏃 Cadence réelle: ${data.realValue} PPM`}
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
  currentPlaylist, savedPlaylists,
  isEditingPlaylistName, setIsEditingPlaylistName, editedPlaylistName, setEditedPlaylistName, handleRenamePlaylist,
  handleSavePlaylist, handleUnsavePlaylist, handleShare,
  shareImageFile, showToast,
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
  markPlaylistAsCompleted, renderCompletionsList,
  getRankStyle,
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
  // Même filet de sécurité pour "Marquer comme refaite" ci-dessous (nouvelle
  // date de complétion depuis la fiche détaillée, pas seulement depuis la
  // carte dans "Mes Séances").
  const addCompletionDateInputRef = useRef(null);

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
  const [isExportingSummary, setIsExportingSummary] = useState(false);

  const exportSessionSummaryImage = async () => {
    if (!currentPlaylist || isExportingSummary) return;
    setIsExportingSummary(true);
    try {
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

      // 4. Canvas -> Blob -> File, puis partage natif (voir shareImageFile,
      // useShare.js) — Web Share API avec fichiers si supporté, sinon repli
      // en téléchargement direct (déjà géré dans le hook).
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Conversion en image échouée');
      const file = new File([blob], 'tempofit-bilan-de-seance.png', { type: 'image/png' });
      await shareImageFile(file, currentPlaylist.name, "Mon bilan de séance sur TempoFit 💪🎧");
    } catch (e) {
      if (showToast) showToast("Impossible de générer l'image du bilan — réessaie dans un instant.", 'error');
    } finally {
      setIsExportingSummary(false);
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
  const [selectedDetailGenre, setSelectedDetailGenre] = useState(null);
  const [selectedDetailBpmBucket, setSelectedDetailBpmBucket] = useState(null);
  // Même regroupement que celui utilisé pour construire genreDistributionData/
  // bpmDistributionData (App.jsx) — recalculé ici par titre pour comparer
  // chaque titre à la part cliquée, plutôt que de dupliquer un état séparé.
  const trackGenreLabel = (t) => genreDisplayLabel(normalizeGenreForDisplay(t.genre, t.artist, t.title));
  const trackBpmBucketLabel = (t) => { const b = Math.floor(t.bpm / 20) * 20; return `${b}-${b + 19}`; };
  const hasDetailFilter = selectedDetailGenre !== null || selectedDetailBpmBucket !== null;
  const trackMatchesDetailFilter = (t) =>
    (selectedDetailGenre === null || trackGenreLabel(t) === selectedDetailGenre) &&
    (selectedDetailBpmBucket === null || trackBpmBucketLabel(t) === selectedDetailBpmBucket);

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
    setSelectedDetailGenre(prev => prev === name ? null : name);
    setSelectedSegmentIdx(null);
  };
  const selectDetailBpmBucket = (name) => {
    setSelectedDetailBpmBucket(prev => prev === name ? null : name);
    setSelectedSegmentIdx(null);
  };
  const handleChartClickAndClearZoomFilter = (state) => {
    setSelectedDetailGenre(null);
    setSelectedDetailBpmBucket(null);
    handleChartClick(state);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={"relative rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0 md:space-x-8 bg-gradient-to-br " + (isNaughtyMode ? 'from-rose-50 to-rose-100 dark:from-gray-900 dark:to-rose-950/40' : 'from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800') + " " + (currentPlaylistRankStyle ? currentPlaylistRankStyle.border : (isNaughtyMode ? 'border-rose-200 dark:border-rose-900/50' : cardBorder))}>
        {currentPlaylistRankStyle && (
          <span
            className="absolute -top-3 -right-3 text-3xl z-10"
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
          {isEditingPlaylistName ? (
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <input
                type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlaylist(); if (e.key === 'Escape') setIsEditingPlaylistName(false); }}
                className={`text-3xl md:text-5xl font-black bg-transparent outline-none border-b-2 ${borderAccentClass} ${textHighlight} w-full`}
              />
              <button onClick={handleRenamePlaylist} className={`p-2 rounded-lg text-white shrink-0 ${bgAccentClass}`}><Check size={20}/></button>
            </div>
          ) : (
            <h2 className={"text-3xl md:text-5xl font-black flex items-center gap-3 justify-center md:justify-start " + textHighlight}>
              {currentPlaylist.name}
              <button onClick={() => { setEditedPlaylistName(currentPlaylist.name); setIsEditingPlaylistName(true); }} className={`p-1.5 rounded-lg ${textMuted} hover:${textHighlight} transition-colors shrink-0`} title="Renommer la playlist">
                <Edit3 size={20}/>
              </button>
            </h2>
          )}
          <div className="flex flex-wrap items-center justify-center md:justify-between gap-4">
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

            {/* "Planifier" déplacé ici, sur la même ligne que les infos de la
                playlist (retour direct : "le bouton de planification doit être
                au même niveau que les infos de la playlist, pas dans la ligne
                du bas") — reste identique en tout point (même handler, même
                filet de sécurité showPicker, même libellé conditionnel selon
                isLocked), seul l'EMPLACEMENT change. N'apparaît que si la
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
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0 ${cardBorder} ${textHighlight}`}
                title={
                  // Une fois la séance déjà réalisée, "planifier" ne peut plus
                  // vouloir dire "prévoir sa première fois" — ça ne peut plus
                  // être qu'une intention de la refaire plus tard.
                  isLocked
                    ? "Planifier une date pour REFAIRE cette séance (optionnel — sert juste à trier 'Mes Séances')"
                    : "Planifier une date pour cette séance (optionnel — sert juste à trier 'Mes Séances')"
                }
              >
                <Calendar size={16} />
                <span>{currentPlaylist.plannedDate ? new Date(currentPlaylist.plannedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : (isLocked ? 'Planifier à nouveau' : 'Planifier')}</span>
                <input
                  ref={plannedDateInputRef}
                  type="date"
                  value={currentPlaylist.plannedDate || ''}
                  onChange={(e) => setPlaylistPlannedDate(currentPlaylist.id, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
            {!savedPlaylists.find(p => p.id === currentPlaylist.id) ? (
              <button
                onClick={handleSavePlaylist}
                title="Ajoute cette séance à 'Mes Séances', ton journal de séances (passées et à venir)."
                className={"flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 " + cardBorder + " " + textHighlight}
              >
                <Save size={16} /> <span>Ajouter à Mes Séances</span>
              </button>
            ) : (
              /* Badge devenu cliquable (retour direct : un badge de confirmation
                  statique et non décochable était trompeur). Swap icône/texte au
                  survol (groupe Tailwind) pour signaler clairement que le clic
                  retire la playlist, pas juste une redite de "c'est sauvegardé". */
              <button
                onClick={handleUnsavePlaylist}
                title="Retirer de 'Mes Séances' — si cette playlist a déjà été faite ou a des données importées, cet historique sera perdu avec elle."
                className="group flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 border border-green-200 dark:border-green-800 hover:border-red-200 dark:hover:border-red-800"
              >
                <CheckCircle size={16} className="group-hover:hidden" />
                <X size={16} className="hidden group-hover:block" />
                <span className="group-hover:hidden">Sauvegardée dans Mes Séances</span>
                <span className="hidden group-hover:block">Retirer de Mes Séances</span>
              </button>
            )}
            <button onClick={() => handleShare('playlist', currentPlaylist)} className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40">
              <Share2 size={16} /> <span>Partager</span>
            </button>
            {/* Bilan Visuel de Séance — génère une image récapitulative
                (durée, BPM moyen, zones d'intensité, top titres) et déclenche
                le partage natif du téléphone (Story Instagram, WhatsApp...),
                voir exportSessionSummaryImage plus haut et
                SessionSummaryCard.jsx pour le rendu capturé. */}
            <button
              onClick={exportSessionSummaryImage}
              disabled={isExportingSummary}
              title="Générer une image de bilan à partager (Story Instagram, WhatsApp...)"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-60 disabled:cursor-wait"
            >
              {isExportingSummary ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              <span>{isExportingSummary ? 'Génération...' : 'Bilan en image'}</span>
            </button>
          </div>

          {/* Bandeau "séance déjà réalisée" (retour direct) : dates de
              complétion + import Garmin/Strava (voir renderCompletionsList,
              App.jsx — même rendu que sur la carte dans "Mes Séances") et
              possibilité d'ajouter une NOUVELLE date pour rejouer la même
              séance plus tard. C'est la SEULE façon d'enrichir cette playlist
              une fois verrouillée : la playlist en elle-même (titres, ordre)
              ne bouge plus, seul son historique d'utilisation le peut. */}
          {isLocked && (
            <div className={`w-full mt-4 p-4 rounded-2xl border border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-900/10`}>
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-bold mb-3">
                <Lock size={15}/> Séance déjà réalisée — verrouillée pour préserver ton historique
              </div>
              {renderCompletionsList && renderCompletionsList(currentPlaylist)}
              {markPlaylistAsCompleted && (
                <label
                  onClick={(e) => {
                    e.stopPropagation();
                    if (addCompletionDateInputRef.current?.showPicker) {
                      e.preventDefault();
                      addCompletionDateInputRef.current.showPicker();
                    }
                  }}
                  className={`relative mt-2 flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-xs font-bold cursor-pointer rounded-lg transition-colors border ${inputBg} hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-600 ${inputBorder} ${textMuted}`}
                >
                  <Circle size={14}/> Marquer comme refaite (ajouter une date)
                  <input
                    ref={addCompletionDateInputRef}
                    type="date"
                    onChange={(e) => { e.stopPropagation(); if (e.target.value) markPlaylistAsCompleted(currentPlaylist.id, e.target.value); e.target.value = ''; }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={"mt-8 p-6 md:p-8 rounded-3xl border shadow-lg " + cardBg + " " + cardBorder}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div>
            <h3 className={"font-bold text-xl flex items-center space-x-2 " + textHighlight}>
              <Activity className={textColorClass}/>
              <span>{currentActualData ? (selectedMetric === 'heartRate' ? "Fréquence cardiaque de la séance" : "Analyse Cadence (PPM) vs BPM cible") : "Courbe d'intensité (BPM)"}</span>
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
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button onClick={() => setSelectedMetric('cadence')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (selectedMetric === 'cadence' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Cadence (PPM)</button>
                <button onClick={() => setSelectedMetric('heartRate')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (selectedMetric === 'heartRate' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Fréquence cardiaque</button>
              </div>
            )}
            {currentActualData && (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button onClick={() => setDataOffset(o => o - 10)} className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">-10s</button>
                <span className={"text-xs font-bold w-24 text-center " + textMuted}>Décalage: {dataOffset > 0 ? '+' : ''}{dataOffset}s</span>
                <button onClick={() => setDataOffset(o => o + 10)} className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">+10s</button>
              </div>
            )}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button onClick={() => setChartAxisType('temps')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartAxisType === 'temps' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Temps (Min)</button>
              {/* Toujours proposé, même pour une playlist générée en mode Temps (pas
                  seulement `targetMode === 'distance'`, comme c'était le cas avant —
                  régression signalée directement) : une distance est calculable pour
                  N'IMPORTE QUELLE playlist via l'allure/BPM (`startDistVal`, voir
                  App.jsx), pas seulement celles basées sur une distance cible. Pour
                  une playlist Temps, c'est une distance ESTIMÉE (déduite du rythme),
                  pas mesurée — mais l'estimation reste utile et cohérente avec le
                  reste de l'app (même logique déjà utilisée pour le trophée "100
                  Bornes au Compteur", qui cumule aussi cette distance estimée). */}
              <button onClick={() => setChartAxisType('distance')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartAxisType === 'distance' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Distance</button>
            </div>
            {/* Sélecteur km/mi : purement cosmétique, ne change jamais l'unité
                réellement utilisée pour générer la playlist. */}
            {chartAxisType === 'distance' && (
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button onClick={() => setChartDistanceUnitOverride('km')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartDistanceUnit === 'km' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>km</button>
                <button onClick={() => setChartDistanceUnitOverride('mi')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartDistanceUnit === 'mi' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>mi</button>
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
                className={`shrink-0 p-2 rounded-lg transition-colors ${textMuted} hover:${textHighlight} hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
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
                className={`shrink-0 p-2 rounded-lg transition-colors ${textMuted} hover:${textHighlight} hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
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
                <button onClick={() => setOpenTrackMenuIndex(openTrackMenuIndex === selectedSegmentIdx ? null : selectedSegmentIdx)} className={`p-2 rounded-lg transition-colors ${textMuted} hover:${textHighlight} hover:bg-gray-100 dark:hover:bg-gray-800`} title="Plus d'options">
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
                          <button onClick={() => { handleDuplicateTrack(selectedSegmentIdx); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                            <Plus size={16} className="text-green-500"/> Dupliquer ce titre
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                          <button onClick={() => { handleReplaceTrackSameArtist(selectedSegmentIdx); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                            <User size={16} className="text-purple-500"/> Remplacer (même artiste)
                          </button>
                          <button onClick={() => { handleReplaceTrack(selectedSegmentIdx); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                            <RefreshCw size={16} className="text-blue-500"/> Remplacer (recherche large)
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                        </>
                      )}
                      {(() => {
                        const seg = trackSegments[selectedSegmentIdx];
                        const artistIsFav = favorites.artists.includes(seg.track.artist);
                        return (
                          <button onClick={() => { toggleArtistFavorite(seg.track.artist); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
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
                content={(props) => <CustomChartTooltip {...props} isNaughtyMode={isNaughtyMode} currentUnit={currentPlaylist.distanceUnit} metric={selectedMetric} />}
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
                  name={selectedMetric === 'heartRate' ? "Fréquence cardiaque (pulsations/min)" : "Cadence réelle (PPM)"}
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
                    <th className="pb-2 pr-3 font-semibold">Cadence (PPM)</th>
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
              {selectedDetailGenre && <> · <span className={textColorClass}>{selectedDetailGenre}</span></>}
              {selectedDetailBpmBucket && <> · <span className={textColorClass}>{selectedDetailBpmBucket} BPM</span></>}
            </span>
            <button onClick={() => { setSelectedDetailGenre(null); setSelectedDetailBpmBucket(null); }} className={`underline ${textMuted} hover:${textHighlight}`}>
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
                          <button onClick={() => { handleDuplicateTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                            <Plus size={16} className="text-green-500"/> Dupliquer ce titre
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                          <button onClick={() => { handleReplaceTrackSameArtist(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                            <User size={16} className="text-purple-500"/> Remplacer (même artiste)
                          </button>
                          <button onClick={() => { handleReplaceTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                            <RefreshCw size={16} className="text-blue-500"/> Remplacer (recherche large)
                          </button>
                          <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                        </>
                      )}
                      {(() => {
                        const artistIsFav = favorites.artists.includes(track.artist);
                        return (
                          <button onClick={() => { toggleArtistFavorite(track.artist); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
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
                  {genreDistributionData.map((entry, i) => <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} opacity={selectedDetailGenre && selectedDetailGenre !== entry.name ? 0.35 : 1} />)}
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
                  className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedDetailGenre === entry.name ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
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
          {selectedDetailGenre && (
            <div className={`mt-4 pt-4 border-t ${cardBorder} space-y-1`}>
              <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${textMuted}`}>Titres · {selectedDetailGenre}</div>
              {currentPlaylist.tracks.filter(t => trackGenreLabel(t) === selectedDetailGenre).map((t, i) => (
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
          <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${textHighlight}`}><Activity className={textColorClass} size={20}/> Répartition par BPM</h3>
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
                  {bpmDistributionData.map((entry, i) => <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} opacity={selectedDetailBpmBucket && selectedDetailBpmBucket !== entry.name ? 0.35 : 1} />)}
                </Pie>
                <RechartsTooltip formatter={(value, name) => {
                  const total = bpmDistributionData.reduce((s, e) => s + e.value, 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return [`${formatDuration(value)} (${pct}%)`, `${name} BPM`];
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
                  className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedDetailBpmBucket === entry.name ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }}></span>
                  <span className={textHighlight}>{entry.name}</span>
                  <span className={textMuted}>{pct}%</span>
                </button>
              );
            })}
          </div>
          {selectedDetailBpmBucket && (
            <div className={`mt-4 pt-4 border-t ${cardBorder} space-y-1`}>
              <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${textMuted}`}>Titres · {selectedDetailBpmBucket} BPM</div>
              {currentPlaylist.tracks.filter(t => trackBpmBucketLabel(t) === selectedDetailBpmBucket).map((t, i) => (
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
      </div>

      {/* Rendu hors écran, en permanence — voir exportSessionSummaryImage plus
          haut pour pourquoi (pas monté/démonté à la demande). `pointer-events-
          none` par sécurité (jamais interactif, jamais censé être vu). */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={summaryCardRef}>
          <SessionSummaryCard playlist={currentPlaylist} topTrackCovers={summaryCovers} isNaughtyMode={isNaughtyMode} />
        </div>
      </div>
    </div>
  );
}
