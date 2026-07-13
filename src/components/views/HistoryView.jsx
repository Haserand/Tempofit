import { History, Music, CheckCircle, List, Activity } from 'lucide-react';

/**
 * HistoryView — vue "Historique" (journal des séances marquées comme terminées).
 *
 * Extrait de App.jsx (bloc `view === 'history'`). Distincte de "Mes Playlists"
 * (PlaylistsView, à extraire ensuite) qui liste TOUTES les playlists
 * sauvegardées, terminées ou non — voir le commentaire d'origine dans
 * App.jsx sur la raison d'être de cette vue séparée.
 *
 * Le tri (par date de dernière complétion) et le classement (par nombre de
 * complétions, pour la médaille or/argent/bronze) sont calculés ici à partir
 * de `savedPlaylists`, sans dupliquer d'état.
 */
export default function HistoryView({
  theme, isNaughtyMode, savedPlaylists, getRankStyle,
  setCurrentPlaylist, changeView, renderConfigInfoLine, renderCompletionsList,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;

  // Triées par utilisation la PLUS RÉCENTE (pas par ordre de création).
  const completedPlaylists = savedPlaylists
    .filter(p => p.completions && p.completions.length > 0)
    .sort((a, b) => {
      const lastA = a.completions[a.completions.length - 1];
      const lastB = b.completions[b.completions.length - 1];
      return lastB.localeCompare(lastA);
    });
  // Classement par NOMBRE d'utilisations (indépendant du tri par récence
  // ci-dessus) — sert uniquement à la bordure or/argent/bronze.
  const completionRanks = [...completedPlaylists]
    .sort((a, b) => b.completions.length - a.completions.length)
    .map(p => p.id);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><History className={textColorClass} size={36} /> <span>Historique</span></h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Le journal de tes séances effectuées.</p>
      </div>

      {completedPlaylists.length === 0 ? (
        <div className={`py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
          <History size={48} className={`mx-auto mb-4 text-gray-300 dark:text-gray-700`} />
          {savedPlaylists.length === 0 ? (
            <>
              <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune séance pour l'instant</h3>
              <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère ta première playlist, fais ta séance, puis marque-la comme terminée pour la voir apparaître ici.</p>
              <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                Générer ma première playlist
              </button>
            </>
          ) : (
            <>
              <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune séance terminée pour l'instant</h3>
              <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Tu as déjà des playlists sauvegardées — marque-en une comme "faite" pour qu'elle apparaisse dans ton historique.</p>
              <button onClick={() => changeView('playlists')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                Voir mes playlists
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {completedPlaylists.map(playlist => {
            const rank = completionRanks.indexOf(playlist.id);
            const rankStyle = getRankStyle(rank);
            return (
            <div key={playlist.id} className={`${cardBg} rounded-2xl p-4 border ${rankStyle ? rankStyle.border : 'border-green-500/30'} bg-green-50/30 dark:bg-green-900/10 shadow-sm flex flex-col hover:border-gray-400 transition-colors cursor-pointer select-none relative`} onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}>
              {rankStyle && <span className="absolute -top-2 -right-2 text-xl" title={`${playlist.completions.length} fois — la ${rank === 0 ? 'plus' : rank === 1 ? '2e plus' : '3e plus'} utilisée`}>{rankStyle.emoji}</span>}
              <div className="flex items-start justify-between mb-3">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${isNaughtyMode ? 'from-rose-400 to-rose-600' : 'from-gray-800 to-black dark:from-gray-200 dark:to-white'} shrink-0 text-2xl`}>
                  {playlist.coverIcon || <Music size={20} className={isNaughtyMode ? 'text-white' : 'text-white dark:text-black'} />}
                </div>
                <div className="flex items-center text-green-600 dark:text-green-400 text-xs font-bold bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                  <CheckCircle size={14} className="mr-1.5"/> Terminée
                </div>
              </div>
              <h3 className={`font-bold text-lg flex items-center gap-2 ${textHighlight}`}>
                {playlist.name}
                {playlist.config?.isIntervalMode && (
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white shrink-0 ${bgAccentClass}`}>
                    Fractionné
                  </span>
                )}
              </h3>
              {(() => {
                const cfg = playlist.config || {};
                const genres = cfg.selectedGenres && cfg.selectedGenres.length > 0
                  ? cfg.selectedGenres
                  : Array.from(new Set(playlist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
                const infoSource = {
                  workoutType: playlist.workoutType, customActivity: cfg.customActivity,
                  targetMode: cfg.targetMode,
                  distanceVal: playlist.avgPace ? Math.round((playlist.totalDuration / playlist.avgPace) * 10) / 10 : 0,
                  distanceUnit: playlist.distanceUnit || cfg.distanceUnit,
                  hours: Math.floor(playlist.totalDuration / 3600),
                  minutes: Math.round((playlist.totalDuration % 3600) / 60),
                  bpm: cfg.bpm, isIntervalMode: cfg.isIntervalMode, segments: cfg.segments,
                  selectedGenres: genres
                };
                return renderConfigInfoLine(infoSource, (
                  <div className="flex items-center space-x-1"><List size={14}/><span>{playlist.tracks.length} titres</span></div>
                ));
              })()}
              {playlist.actualDataByDate && Object.keys(playlist.actualDataByDate).length > 0 && (
                <div className="flex items-center justify-center w-full py-2 mt-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold">
                  <Activity size={14} className="mr-2"/> {Object.keys(playlist.actualDataByDate).length} séance{Object.keys(playlist.actualDataByDate).length > 1 ? 's' : ''} avec données Garmin importées (cadence/FC)
                </div>
              )}
              <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${textMuted}`}>Créée le {playlist.createdAt}</div>
                {renderCompletionsList(playlist)}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
