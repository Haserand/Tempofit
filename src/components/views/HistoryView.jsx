import { History } from 'lucide-react';
import PlaylistCard from './PlaylistCard';

/**
 * HistoryView — vue "Historique" (journal des séances marquées comme terminées).
 *
 * Distincte de "Mes Playlists" (PlaylistsView) qui liste TOUTES les playlists
 * sauvegardées, terminées ou non — voir le commentaire d'origine dans
 * App.jsx sur la raison d'être de cette vue séparée.
 *
 * Le tri (par date de dernière complétion) et le classement (par nombre de
 * complétions, pour la médaille or/argent/bronze) sont calculés ici à partir
 * de `savedPlaylists`, sans dupliquer d'état. Le rendu de chaque carte est
 * délégué à PlaylistCard (partagé avec PlaylistsView).
 */
export default function HistoryView({
  theme, isNaughtyMode, savedPlaylists, getRankStyle,
  setCurrentPlaylist, changeView, renderConfigInfoLine, renderCompletionsList,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;

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
              <PlaylistCard
                key={playlist.id}
                theme={theme} isNaughtyMode={isNaughtyMode} playlist={playlist} rankStyle={rankStyle} rank={rank}
                onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}
                showActions={false}
                renderConfigInfoLine={renderConfigInfoLine} renderCompletionsList={renderCompletionsList}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
