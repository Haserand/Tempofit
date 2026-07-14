import { useState } from 'react';
import {
  Check, Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Pause, Play,
  GripVertical, Star, MoreVertical, Plus, User, RefreshCw, X, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend, Line, PieChart, Pie, Cell,
} from 'recharts';
import { getGenresForDisplay } from '../../musicCatalog';
import { formatDuration } from '../../utils/format';

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
  currentActualData, selectedMetric, setSelectedMetric, analysisStats,
  selectedAnalysisDate, setSelectedAnalysisDate, formatCompletionDate, availableMetrics,
  dataOffset, setDataOffset,
  chartAxisType, setChartAxisType, chartDistanceUnit, setChartDistanceUnitOverride,
  selectedSegmentIdx, trackSegments, togglePreview, playingPreviewId,
  unifiedChartData, handleChartClick, chartXDomain, chartXTicks, chartYDomain, distanceDisplayFactor,
  draggedTrackIndex, handleTrackDragStart, handleTrackDragEnter, handleTrackDragEnd,
  favorites, toggleTrackFavorite, toggleArtistFavorite,
  openTrackMenuIndex, setOpenTrackMenuIndex,
  handleDuplicateTrack, handleReplaceTrackSameArtist, handleReplaceTrack, handleRemoveTrack,
  setIsBpmSearchMode, setIsSearchModalOpen,
  bpmDistributionData, genreDistributionData,
  setPlaylistPlannedDate,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, borderAccentClass, inputBg, inputBorder } = theme;
  // Replié par défaut : ce tableau ne sert qu'à vérifier ponctuellement une
  // correspondance de données (import CSV Garmin/Strava), pas à un usage courant.
  const [showRawImportTable, setShowRawImportTable] = useState(false);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={"rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0 md:space-x-8 bg-gradient-to-br " + (isNaughtyMode ? 'from-rose-50 to-rose-100 dark:from-gray-900 dark:to-rose-950/40' : 'from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800') + " " + (isNaughtyMode ? 'border-rose-200 dark:border-rose-900/50' : cardBorder)}>
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
                    <div className="flex items-center space-x-1"><Music size={16}/><span>{cfg.selectedGenres.join(', ')}</span></div>
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

          <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
            {!savedPlaylists.find(p => p.id === currentPlaylist.id) ? (
              <button
                onClick={handleSavePlaylist}
                title="Ajoute cette séance à 'Mes Séances', ton journal de séances (passées et à venir)."
                className={"flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 " + cardBorder + " " + textHighlight}
              >
                <Save size={16} /> <span>Sauvegarder la Playlist</span>
              </button>
            ) : (
              <>
                {/* Badge devenu cliquable (retour direct : un badge de confirmation
                    statique et non décochable était trompeur). Swap icône/texte au
                    survol (groupe Tailwind) pour signaler clairement que le clic
                    retire la playlist, pas juste une redite de "c'est sauvegardé". */}
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
                {/* Date optionnelle, sert uniquement de clé de tri dans "Mes
                    Séances" (section "Planifiées") — jamais obligatoire. */}
                <label
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 ${cardBorder} ${textHighlight}`}
                  title="Planifier une date pour cette séance (optionnel — sert juste à trier 'Mes Séances')"
                >
                  <Calendar size={16} />
                  <span>{currentPlaylist.plannedDate ? new Date(currentPlaylist.plannedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Planifier'}</span>
                  <input
                    type="date"
                    value={currentPlaylist.plannedDate || ''}
                    onChange={(e) => setPlaylistPlannedDate(currentPlaylist.id, e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </>
            )}
            <button onClick={() => handleShare('playlist', currentPlaylist)} className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40">
              <Share2 size={16} /> <span>Partager</span>
            </button>
          </div>
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
              {currentPlaylist.targetMode === 'distance' && (
                <button onClick={() => setChartAxisType('distance')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartAxisType === 'distance' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Distance</button>
              )}
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
            selon le segment sélectionné (piloté par selectedSegmentIdx). */}
        <div className={`mb-4 p-4 rounded-2xl border ${cardBorder} ${inputBg} flex items-center gap-4 min-h-[76px]`}>
          {selectedSegmentIdx !== null && trackSegments[selectedSegmentIdx] ? (
            <>
              <button
                onClick={() => togglePreview(trackSegments[selectedSegmentIdx].track)}
                disabled={!trackSegments[selectedSegmentIdx].track.preview}
                title={trackSegments[selectedSegmentIdx].track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${trackSegments[selectedSegmentIdx].track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
              >
                {playingPreviewId === trackSegments[selectedSegmentIdx].track.youtubeId ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm truncate ${textHighlight}`}>{trackSegments[selectedSegmentIdx].track.title}</div>
                <div className={`text-xs truncate ${textMuted}`}>{trackSegments[selectedSegmentIdx].track.artist}{trackSegments[selectedSegmentIdx].track.genre ? ` · ${getGenresForDisplay(trackSegments[selectedSegmentIdx].track.genre).join(', ')}` : ''}{trackSegments[selectedSegmentIdx].track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}</div>
              </div>
              <div className={`text-xs font-mono ${textMuted} shrink-0`}>
                Début : {formatDuration(trackSegments[selectedSegmentIdx].startTime)}<br/>
                Durée : {formatDuration(trackSegments[selectedSegmentIdx].track.duration)}
              </div>
              <div className={`px-3 py-2 rounded-lg text-sm font-bold font-mono text-white shrink-0 ${isNaughtyMode ? 'bg-rose-500' : 'bg-gray-800 dark:bg-gray-700'}`}>
                🎯 {trackSegments[selectedSegmentIdx].track.bpm} BPM
              </div>
            </>
          ) : (
            <span className={`text-sm ${textMuted}`}>Clique sur un segment du graphique pour voir le détail du titre et l'écouter.</span>
          )}
        </div>

        <div className="h-72 w-full">
          {currentPlaylist.tracks.length === 0 ? (
            <div className={`h-full flex items-center justify-center text-center px-6 ${textMuted}`}>
              Cette playlist ne contient aucun morceau (durée/distance probablement vide au moment de la génération) — regénère-la avec une distance ou une durée renseignée.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            {/* Interaction par CLIC plutôt que par survol continu : plus fiable,
                plus rapide, et le résultat reste stable tant qu'on ne clique pas
                ailleurs. */}
            <LineChart data={unifiedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colorMode === 'dark' ? '#374151' : '#e5e7eb'} vertical={false} />

              {/* Surbrillance de TOUT le segment sélectionné, déterminée via handleChartMouseMove. */}
              {selectedSegmentIdx !== null && trackSegments[selectedSegmentIdx] && (
                <ReferenceArea
                  x1={chartAxisType === 'distance' ? trackSegments[selectedSegmentIdx].startDist * distanceDisplayFactor : trackSegments[selectedSegmentIdx].startTime}
                  x2={chartAxisType === 'distance' ? trackSegments[selectedSegmentIdx].endDist * distanceDisplayFactor : trackSegments[selectedSegmentIdx].endTime}
                  fill={isNaughtyMode ? '#f43f5e' : '#ef4444'}
                  fillOpacity={0.12}
                  stroke="none"
                />
              )}

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
        <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {currentPlaylist.tracks.map((track, index) => (
            <div
              key={track.id}
              draggable
              onDragStart={handleTrackDragStart(index)}
              onDragEnter={handleTrackDragEnter(index)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={handleTrackDragEnd}
              className={`flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 group ${draggedTrackIndex === index ? 'opacity-40' : ''}`}
            >
              {/* Poignée de glisser-déposer — remplace les flèches ↑/↓. */}
              <div className={`shrink-0 cursor-grab active:cursor-grabbing px-1 ${textMuted}`} title="Glisser pour réordonner">
                <GripVertical size={16}/>
              </div>
              <div className={"w-6 text-center font-medium text-xs " + textMuted}>{index + 1}</div>
              <button
                onClick={() => togglePreview(track)}
                disabled={!track.preview}
                title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors mr-2 ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
              >
                {playingPreviewId === track.youtubeId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
              </button>
              <div className="flex-1 px-2 min-w-0">
                <div className={"font-bold text-sm truncate " + textHighlight}>{track.title}</div>
                <div className={"text-xs truncate " + textMuted}>{track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre).join(', ')}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}</div>
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

              <button onClick={() => handleRemoveTrack(index)} className={"p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors shrink-0 " + textMuted} title="Retirer de la proposition">
                <X size={16}/>
              </button>
            </div>
          ))}

          {/* BOUTON AJOUT MANUEL */}
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50">
            <button onClick={() => { setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={"w-full py-3 flex items-center justify-center gap-2 text-sm font-bold border-2 border-dashed rounded-xl transition-colors hover:border-gray-400 " + inputBorder + " " + textMuted + " hover:" + textHighlight}>
              <Plus size={18} /> <span>Ajouter un titre</span>
            </button>
          </div>
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
                >
                  {genreDistributionData.map((entry, i) => <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} />)}
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
                <div key={i} className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }}></span>
                  <span className={textHighlight}>{entry.name}</span>
                  <span className={textMuted}>{pct}%</span>
                </div>
              );
            })}
          </div>
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
                >
                  {bpmDistributionData.map((entry, i) => <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} />)}
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
                <div key={i} className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }}></span>
                  <span className={textHighlight}>{entry.name}</span>
                  <span className={textMuted}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
