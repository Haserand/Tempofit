import { ListOrdered, Music, ChevronUp, ChevronDown, X, PlaySquare } from 'lucide-react';

/**
 * QueueView — "Ma file d'attente" : liste ORDONNÉE de playlists déjà
 * générées et sauvegardées, prêtes à être faites dans cet ordre. Le premier
 * élément est "la prochaine séance" — pas de date, juste un ordre logique
 * (voir useQueue.js pour le raisonnement complet).
 *
 * Composant volontairement séparé de PlaylistCard : les actions ici sont
 * différentes (réordonner, retirer DE LA FILE sans supprimer la playlist)
 * plutôt que celles d'une carte de playlist classique (supprimer
 * définitivement, marquer comme faite...).
 */
export default function QueueView({
  theme, isNaughtyMode, queue, savedPlaylists,
  removeFromQueue, moveInQueue, setCurrentPlaylist, changeView,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;

  // Une playlist de la file peut avoir été supprimée entre-temps par ailleurs
  // (page "Mes Playlists") — on l'ignore simplement ici plutôt que de planter
  // sur une référence qui n'existe plus.
  const queuedPlaylists = queue
    .map(id => savedPlaylists.find(p => p.id === id))
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
          <ListOrdered className={textColorClass} size={36} /> <span>Ma file d'attente</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          L'ordre dans lequel tu comptes faire tes prochaines séances — pas de date, juste l'ordre qui compte.
        </p>
      </div>

      {queuedPlaylists.length === 0 ? (
        <div className={`py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
          <ListOrdered size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
          <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Ta file d'attente est vide</h3>
          <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>
            Depuis "Mes Playlists" ou le détail d'une playlist, ajoute-la à la file pour planifier l'ordre de tes prochaines séances.
          </p>
          <button onClick={() => changeView('playlists')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
            Voir mes playlists
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {queuedPlaylists.map((playlist, index) => (
            <div
              key={playlist.id}
              className={`${cardBg} rounded-2xl p-4 border ${index === 0 ? `border-2 ${isNaughtyMode ? 'border-rose-500' : 'border-red-500'}` : cardBorder} shadow-sm flex items-center gap-4`}
            >
              <div className="flex flex-col items-center gap-1 shrink-0">
                <button
                  onClick={() => moveInQueue(playlist.id, -1)}
                  disabled={index === 0}
                  className={`p-1 rounded transition-colors ${index === 0 ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' : `${textMuted} hover:${textHighlight} hover:bg-gray-100 dark:hover:bg-gray-800`}`}
                  title="Avancer dans la file"
                >
                  <ChevronUp size={18} />
                </button>
                <span className={`text-xs font-black w-6 text-center ${index === 0 ? textColorClass : textMuted}`}>#{index + 1}</span>
                <button
                  onClick={() => moveInQueue(playlist.id, 1)}
                  disabled={index === queuedPlaylists.length - 1}
                  className={`p-1 rounded transition-colors ${index === queuedPlaylists.length - 1 ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' : `${textMuted} hover:${textHighlight} hover:bg-gray-100 dark:hover:bg-gray-800`}`}
                  title="Reculer dans la file"
                >
                  <ChevronDown size={18} />
                </button>
              </div>

              <div
                className="flex-1 flex items-center gap-4 min-w-0 cursor-pointer"
                onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${isNaughtyMode ? 'from-rose-400 to-rose-600' : 'from-gray-800 to-black dark:from-gray-200 dark:to-white'} shrink-0 text-2xl`}>
                  {playlist.coverIcon || <Music size={20} className={isNaughtyMode ? 'text-white' : 'text-white dark:text-black'} />}
                </div>
                <div className="min-w-0">
                  {index === 0 && (
                    <div className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${textColorClass}`}>Prochaine séance</div>
                  )}
                  <div className={`font-bold text-lg truncate ${textHighlight}`}>{playlist.name}</div>
                  <div className={`text-xs truncate ${textMuted}`}>{playlist.workoutType} · {playlist.tracks.length} titres</div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}
                  className={`p-2 rounded-lg transition-colors ${textMuted} hover:${textHighlight} hover:bg-gray-100 dark:hover:bg-gray-800`}
                  title="Ouvrir la playlist"
                >
                  <PlaySquare size={18} />
                </button>
                <button
                  onClick={() => removeFromQueue(playlist.id)}
                  className={`p-2 rounded-lg transition-colors ${textMuted} hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                  title="Retirer de la file (la playlist reste sauvegardée)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
