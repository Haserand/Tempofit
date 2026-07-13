import { List, Plus, Music, Trash2, CheckCircle, Circle, Activity } from 'lucide-react';

/**
 * PlaylistsView — vue "Mes Playlists" (toutes les playlists sauvegardées,
 * terminées ou non). Distincte de HistoryView, qui ne montre que celles déjà
 * marquées comme faites — voir le commentaire d'origine dans App.jsx.
 *
 * Extrait de App.jsx (bloc `view === 'playlists'`). Partage une bonne partie
 * de sa logique d'affichage de carte avec HistoryView (même bloc infoSource,
 * même rendu de complétions) — un composant `PlaylistCard` commun serait la
 * suite logique si on veut éviter la duplication actuelle entre les deux,
 * mais pas fait ici pour rester sur un changement à risque limité.
 */
export default function PlaylistsView({
  theme, isNaughtyMode, savedPlaylists, setSavedPlaylists, getRankStyle,
  setCurrentPlaylist, changeView, renderConfigInfoLine, renderCompletionsList, markPlaylistAsCompleted,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, inputBg, inputBorder } = theme;

  // Triées par utilisation la plus récente d'abord ; celles jamais encore
  // faites restent après, par ordre de création (comportement inchangé pour elles).
  const sortedPlaylists = [...savedPlaylists].sort((a, b) => {
    const lastA = a.completions && a.completions.length > 0 ? a.completions[a.completions.length - 1] : null;
    const lastB = b.completions && b.completions.length > 0 ? b.completions[b.completions.length - 1] : null;
    if (lastA && lastB) return lastB.localeCompare(lastA);
    if (lastA) return -1;
    if (lastB) return 1;
    return 0;
  });
  // Classement par nombre d'utilisations, uniquement parmi celles ayant déjà
  // été faites au moins une fois — sert à la bordure or/argent/bronze.
  const playlistRanks = savedPlaylists
    .filter(p => p.completions && p.completions.length > 0)
    .sort((a, b) => b.completions.length - a.completions.length)
    .map(p => p.id);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><List className={textColorClass} size={36} /> <span>Mes Playlists</span></h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Retrouve tes sessions sauvegardées. N'oublie pas de les marquer comme terminées !</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savedPlaylists.length > 0 && (
          <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed ${cardBorder} flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400`}>
            <Plus size={28} />
            <span>Générer une nouvelle playlist</span>
          </button>
        )}
        {sortedPlaylists.map(playlist => {
          const rank = playlistRanks.indexOf(playlist.id);
          const rankStyle = getRankStyle(rank);
          return (
        <div key={playlist.id} className={`${cardBg} rounded-2xl p-4 border ${rankStyle ? rankStyle.border : (playlist.completions && playlist.completions.length > 0 ?
          'border-green-500/30 bg-green-50/30 dark:bg-green-900/10' : cardBorder)} shadow-sm flex flex-col group hover:border-gray-400 transition-colors cursor-pointer select-none relative`} onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}>
          {rankStyle && <span className="absolute -top-2 -right-2 text-xl" title={`${playlist.completions.length} fois — la ${rank === 0 ? 'plus' : rank === 1 ? '2e plus' : '3e plus'} utilisée`}>{rankStyle.emoji}</span>}
            <div className="flex items-start justify-between mb-3">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br ${isNaughtyMode ? 'from-rose-400 to-rose-600' : 'from-gray-800 to-black dark:from-gray-200 dark:to-white'} shrink-0 text-3xl`}>
                {playlist.coverIcon || <Music size={24} className={isNaughtyMode ? 'text-white' : 'text-white dark:text-black'} />}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setSavedPlaylists(savedPlaylists.filter(p => p.id !== playlist.id)); }} className={`p-2 rounded-lg text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100`}>
                <Trash2 size={18} />
              </button>
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

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              {playlist.completions && playlist.completions.length > 0 ? (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-green-600 dark:text-green-400 text-xs font-bold bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                      <CheckCircle size={14} className="mr-1.5"/> Faite {playlist.completions.length}x
                    </div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {playlist.createdAt}</span>
                  </div>
                  {renderCompletionsList(playlist)}
                  <button onClick={(e) => markPlaylistAsCompleted(e, playlist.id)} className={`flex items-center justify-center w-full py-2 text-xs font-bold ${inputBg} hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-600 rounded-lg transition-colors border ${inputBorder}`}>
                    <Circle size={14} className="mr-1.5"/> Marquer comme refaite aujourd'hui
                  </button>
                  {playlist.actualDataByDate && Object.keys(playlist.actualDataByDate).length > 0 && (
                    <div className="flex items-center justify-center w-full py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold">
                      <Activity size={14} className="mr-2"/> {Object.keys(playlist.actualDataByDate).length} séance{Object.keys(playlist.actualDataByDate).length > 1 ? 's' : ''} avec données Garmin importées (cadence/FC)
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={(e) => markPlaylistAsCompleted(e, playlist.id)} className={`flex items-center text-gray-500 hover:text-green-600 text-xs font-bold ${inputBg} hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors border ${inputBorder}`}>
                    <Circle size={14} className="mr-1.5"/> Marquer comme faite
                  </button>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {playlist.createdAt}</span>
                </>
              )}
            </div>
          </div>
          );
        })}
        {savedPlaylists.length === 0 && (
          <div className={`col-span-full py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
            <List size={48} className={`mx-auto mb-4 text-gray-300 dark:text-gray-700`} />
            <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune playlist sauvegardée</h3>
            <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère une playlist et sauvegarde-la pour la retrouver ici.</p>
            <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
              Générer ma première playlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
