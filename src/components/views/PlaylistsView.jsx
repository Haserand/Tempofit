import { List, Plus } from 'lucide-react';
import PlaylistCard from './PlaylistCard';

/**
 * PlaylistsView — vue "Mes Playlists" (toutes les playlists sauvegardées,
 * terminées ou non). Distincte de HistoryView, qui ne montre que celles déjà
 * marquées comme faites — voir le commentaire d'origine dans App.jsx.
 *
 * Le rendu de chaque carte est délégué à PlaylistCard (partagé avec
 * HistoryView, voir ce fichier pour le détail des différences entre les deux
 * usages).
 */
export default function PlaylistsView({
  theme, isNaughtyMode, savedPlaylists, setSavedPlaylists, getRankStyle,
  setCurrentPlaylist, changeView, renderConfigInfoLine, renderCompletionsList, markPlaylistAsCompleted,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;

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
            <PlaylistCard
              key={playlist.id}
              theme={theme} isNaughtyMode={isNaughtyMode} playlist={playlist} rankStyle={rankStyle} rank={rank}
              onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}
              onDelete={(id) => setSavedPlaylists(savedPlaylists.filter(p => p.id !== id))}
              showActions={true}
              renderConfigInfoLine={renderConfigInfoLine} renderCompletionsList={renderCompletionsList}
              markPlaylistAsCompleted={markPlaylistAsCompleted}
            />
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
