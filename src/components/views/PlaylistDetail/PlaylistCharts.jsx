import {
  Activity, Clock, Music, Pause, Play, Star, MoreVertical, Plus, User, RefreshCw, X,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend, Line, PieChart, Pie, Cell,
} from 'recharts';
import { getGenresForDisplay } from '../../../musicCatalog';
import { DISTRIBUTION_COLORS } from '../../../appConfig';
import { formatDuration } from '../../../utils/format';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';

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
 * PlaylistCharts.jsx — bloc d'analyse complet de PlaylistDetailView : courbe
 * d'intensité BPM cible vs réalité + encart segment sélectionné, et les 2
 * camemberts de répartition (style musical, zone/BPM). Extrait de
 * PlaylistDetailView.jsx (chantier découpage, suite de TrackList/
 * PlaylistHeader).
 *
 * RÉORGANISATION VISUELLE ASSUMÉE : dans la version précédente, les 2
 * camemberts venaient APRÈS la liste des titres (TrackList) ; ici, les 2
 * blocs de ce composant sont rendus CONSÉCUTIVEMENT (courbe puis camemberts),
 * donc les camemberts remontent avant TrackList dans l'ordre d'affichage de
 * la page. Décision délibérée pour que "l'analyse" reste un bloc visuel
 * cohérent plutôt que coupé en 2 par la liste — pas un effet de bord caché.
 *
 * Props reçues : ce qui est partagé avec TrackList/PlaylistHeader (favoris,
 * verrouillage, résolution de lecture) ou possédé par PlaylistDetailView
 * (theme, colorMode, le filtre croisé style/BPM — sa source de vérité reste
 * le parent, ce composant ne fait que LIRE/déclencher, jamais recréer, même
 * principe que documenté dans TrackList.jsx). `bpmChartActivityName` : reçu
 * en prop plutôt que recalculé ici car le PARENT en a aussi besoin (pour
 * trackBpmBucketLabel, partagé avec TrackList) — une seule résolution
 * d'activité, pas 2 implémentations.
 *
 * Tout le reste (courbe, segments, distributions déjà résolues,
 * drag-and-drop sur le graphique, menu par titre) vient de
 * usePlaylistDetail() — dont `bpmDistributionIsZoneBased`, LA seule source
 * de vérité pour "ce camembert affiche-t-il des zones d'effort ou des
 * tranches de BPM brutes ?" (décision Produit : zones seulement si un vrai
 * profil est configuré — pas de prop `isBpmChartUsingRealProfile` séparée
 * ici, ce composant se fie uniquement à ce que le contexte dit réellement
 * afficher).
 */
export default function PlaylistCharts({
  theme, colorMode, isLocked,
  favorites, toggleArtistFavorite,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  formatCompletionDate,
  playlistCadenceUnit, bpmChartActivityName,
  hasDetailFilter, trackMatchesDetailFilter,
  selectedDetailGenre, selectedDetailBpmBucket, setSelectedDetailGenre, setSelectedDetailBpmBucket,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const {
    currentPlaylist, isNaughtyMode, getProfileForWorkout,
    currentActualData, selectedMetric, setSelectedMetric, analysisStats,
    selectedAnalysisDate, setSelectedAnalysisDate, availableMetrics,
    dataOffset, setDataOffset,
    chartAxisType, setChartAxisType, chartDistanceUnit, setChartDistanceUnitOverride,
    selectedSegmentIdx, setSelectedSegmentIdx, trackSegments, playingPreviewId, resolvingTrackId,
    unifiedChartData, handleChartClick, chartXDomain, chartXTicks, chartYDomain, distanceDisplayFactor,
    handleChartMouseDown, handleChartMouseMove, handleChartMouseUp, isDraggingChartSegment,
    openTrackMenuIndex, setOpenTrackMenuIndex,
    handleDuplicateTrack, handleReplaceTrackSameArtist, handleReplaceTrack, handleRemoveTrack,
    bpmDistributionData, bpmDistributionIsZoneBased, genreDistributionData,
  } = usePlaylistDetail();

  // RETOUR DIRECT ("en course à pied, la cadence de pas varie peu selon la
  // zone — proposer une visualisation Synchro uniquement si l'utilisateur
  // active l'option") — si l'activité de CETTE séance est réglée sur
  // `cadenceIntent: 'sync'`, remplace le camembert par zone par un indicateur
  // d'écart : un chiffre ("Écart moyen") + les titres positionnés sur un axe
  // BPM autour de la cible.
  // REVERT (même décision Produit que bpmDistributionData/TrackItem.jsx,
  // appliquée ici pour rester cohérent) : `getProfileForWorkout` STRICT, pas
  // OrDefault — le mode Synchro est un réglage explicite du profil
  // athlétique (`cadenceIntent: 'sync'`), il ne doit jamais se déclencher à
  // partir d'un profil par défaut fabriqué pour quelqu'un qui n'a rien
  // configuré. Sans profil réel, `bpmChartProfile` vaut `null`, `isSyncMode`
  // reste `false`, et le camembert retombe normalement sur "Répartition par
  // BPM" (bpmDistributionIsZoneBased, lui aussi `false` dans ce cas).
  let bpmChartProfile, isSyncMode, syncTarget, syncTrackGaps;
  try {
    bpmChartProfile = getProfileForWorkout ? getProfileForWorkout(bpmChartActivityName) : null;
    isSyncMode = bpmChartProfile?.cadenceIntent === 'sync';
    syncTarget = bpmChartProfile?.targetBpm ?? null;
    syncTrackGaps = (isSyncMode && syncTarget)
      ? currentPlaylist.tracks.filter(t => t.bpm).map(t => ({ title: t.title, artist: t.artist, bpm: t.bpm, gap: t.bpm - syncTarget }))
      : [];
  } catch (e) {
    // DIAGNOSTIC TEMPORAIRE (bug "page blanche" en cours d'investigation) —
    // à retirer une fois confirmé/corrigé, voir même mécanisme dans TrackItem.jsx.
    throw new Error(`[PlaylistCharts] tracks=${JSON.stringify(currentPlaylist?.tracks)?.slice(0, 800)} | bpmChartActivityName=${bpmChartActivityName} | erreur d'origine: ${e.message}`);
  }
  const syncAvgGap = syncTrackGaps.length > 0
    ? Math.round(syncTrackGaps.reduce((s, t) => s + Math.abs(t.gap), 0) / syncTrackGaps.length)
    : null;

  // Libellé combiné du filtre actif (croisement style ET BPM), affiché sous
  // chaque camembert au-dessus de la mini-liste "Titres" correspondante.
  const activeDetailFilterLabel = [
    selectedDetailGenre.size > 0 ? [...selectedDetailGenre].join(', ') : null,
    selectedDetailBpmBucket.size > 0 ? `${[...selectedDetailBpmBucket].join(', ')}${!bpmDistributionIsZoneBased ? ' BPM' : ''}` : null,
  ].filter(Boolean).join(' · ');

  // Clic sur une part de camembert = surbrillance croisée (liste + courbe),
  // mutuellement exclusive avec la sélection directe d'un segment sur la
  // courbe (voir handleChartClickAndClearZoomFilter plus bas).
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
    <>
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
                className={`px-3 py-2 rounded-lg text-xs font-bold ${theme.inputBg} border ${theme.inputBorder} ${textHighlight}`}
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
              {/* Toujours proposé, même pour une playlist générée en mode Temps —
                  une distance est calculable pour N'IMPORTE QUELLE playlist via
                  l'allure/BPM (startDistVal), pas seulement celles basées sur une
                  distance cible. Pour une playlist Temps, c'est une distance
                  ESTIMÉE (déduite du rythme), pas mesurée. */}
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
            selon le segment sélectionné (piloté par selectedSegmentIdx). */}
        <div className={`mb-4 p-4 rounded-2xl border ${cardBorder} ${theme.inputBg} flex items-center gap-3 min-h-[76px]`}>
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
                onClick={() => resolveAndTogglePreview(trackSegments[selectedSegmentIdx].track, getNextTrackForAutoAdvance)}
                title="Écouter un extrait"
                className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${bgAccentClass} text-white hover:brightness-110`}
              >
                {resolvingTrackId === trackSegments[selectedSegmentIdx].track.id
                  ? <Loader2 size={18} className="animate-spin"/>
                  : playingPreviewId === trackSegments[selectedSegmentIdx].track.trackId ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}
              </button>
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
                  (voir openTrackMenuIndex, partagé avec TrackList/TrackItem :
                  ouvrir ce menu ici ouvre aussi le menu de la ligne
                  correspondante dans la liste, cohérent puisque c'est le même
                  titre). */}
              <div className="relative shrink-0">
                <button onClick={() => setOpenTrackMenuIndex(openTrackMenuIndex === selectedSegmentIdx ? null : selectedSegmentIdx)} className={`p-2 rounded-lg transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`} title="Plus d'options">
                  <MoreVertical size={16}/>
                </button>
                {openTrackMenuIndex === selectedSegmentIdx && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenTrackMenuIndex(null)}></div>
                    <div className={`absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border shadow-2xl ${cardBg} ${cardBorder} overflow-hidden`}>
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

              {/* Surbrillance de TOUT le segment sélectionné, déterminée via
                  handleChartMouseMove. Style DISTINCT pendant un glissement actif
                  (ambre, contour en pointillés, plus opaque). */}
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

              {/* Surbrillance de TOUS les segments correspondant au filtre actif
                  d'un des 2 camemberts plus bas — distincte de la surbrillance
                  rouge ci-dessus (un clic direct sur la courbe), en ambre pour
                  ne pas les confondre visuellement. */}
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
          {/* Récap des titres associés à la part sélectionnée — la mise en
              évidence dans TrackList ne suffisait pas, il fallait aussi voir
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
          {/* Titre CONDITIONNEL : "Tes zones d'intensité" seulement si le
              camembert affiche VRAIMENT des zones (bpmDistributionIsZoneBased,
              contexte — reflète directement bpmDistributionData) — décision
              Produit : l'app reste neutre par défaut, "Répartition par BPM"
              tant qu'aucun profil athlétique n'est configuré pour cette
              activité. Même règle que le mode Synchro. */}
          <h3 className={`font-bold text-lg flex items-center gap-2 ${textHighlight}`}>
            <Activity className={textColorClass} size={20}/> {isSyncMode ? 'Ta synchro cadence' : (bpmDistributionIsZoneBased ? 'Tes zones d\'intensité' : 'Répartition par BPM')}
          </h3>
          <p className={`text-xs mb-4 ${textMuted}`}>
            {isSyncMode
              ? 'Mode Synchro — la musique doit suivre ta cadence, pas ton intensité.'
              : (bpmDistributionIsZoneBased
                  ? 'Basé sur ton Profil Athlétique.'
                  : 'Répartition brute des titres écoutés — indépendante de ton profil.')}
          </p>
          {isSyncMode ? (
            /* Pas de camembert ici : en Synchro, ce qui compte c'est "est-ce que
                la musique est restée proche de MA cadence", pas une répartition
                par zone (les 4 zones sont volontairement resserrées, un
                camembert y serait presque unicolore). `syncTarget` = le BPM
                de base entré dans le Profil Athlétique (zone2/targetBpm). */
            syncTrackGaps.length > 0 ? (
              <div>
                <div className={`text-2xl font-black mb-1 ${textHighlight}`}>
                  Écart moyen : <span className={textColorClass}>{syncAvgGap} BPM</span>
                </div>
                <p className={`text-xs mb-4 ${textMuted}`}>Cible : {syncTarget} BPM — chaque point est un titre, positionné selon son écart à la cible.</p>
                {/* Axe horizontal simple (pas Recharts) : la cible est TOUJOURS
                    au centre (50%), l'écart max observé fixe l'échelle des
                    bords, jamais une valeur arbitraire qui écraserait ou
                    exagérerait les écarts réels. */}
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
                  return [`${formatDuration(value)} (${pct}%)`, bpmDistributionIsZoneBased ? name : `${name} BPM`];
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
    </>
  );
}
