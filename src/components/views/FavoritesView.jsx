import { Star, Heart, Play, Pause, X, Plus, User, RefreshCw, Target, Search } from 'lucide-react';
import { getGenreLocalDepthWarning, getGenresForDisplay, genreDisplayLabel, EXTRA_GENRES } from '../../musicCatalog';

/**
 * FavoritesView — vue "Mes Favoris" (titres/artistes favoris + exploration BPM/genre).
 *
 * Extrait de App.jsx (bloc `view === 'favorites'`). Comme SettingsView, ne
 * détient aucun state propre : tout vient de props explicites. `favorites` et
 * `setFavorites` restent gérés dans App.jsx (même logique que les favoris
 * ajoutés depuis la recherche manuelle — voir passation, section 5) : ce
 * composant ne fait qu'afficher et déclencher les mêmes setters.
 */
export default function FavoritesView({
  theme, isNaughtyMode,
  favorites, setFavorites,
  togglePreview, playingPreviewId,
  setCurrentPlaylist, setIsBpmSearchMode, setIsSearchModalOpen, setWorldSearchResults, setNoUsableResultsHint,
  isAddingArtist, setIsAddingArtist, newFavArtist, setNewFavArtist, addFavoriteArtistValidated,
  availableGenres, favSelectedGenres, setFavSelectedGenres, showExtraGenres, setShowExtraGenres,
  favBpmTarget, setFavBpmTarget, favBpmTolerance, setFavBpmTolerance,
  searchTracksByBpm, changeView,
}) {
  const {
    cardBg, cardBorder, textHighlight, textMuted, textColorClass,
    bgAccentClass, borderAccentClass, inputBg, inputBorder,
  } = theme;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
          <Star className="text-yellow-500 fill-yellow-500/20" size={36} /> <span>Mes Favoris</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Priorité à la génération : tes titres favoris d'abord, puis tes artistes favoris, puis une recherche plus large si besoin pour compléter la playlist.</p>
      </div>

      <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h3 className={`font-bold text-xl ${textHighlight}`}>Tes Préférences Musicales</h3>
          <button onClick={() => changeView('settings')} className={`px-5 py-2.5 ${cardBg} border-2 ${borderAccentClass} rounded-xl text-sm font-bold ${textColorClass} transition-colors shadow-sm flex items-center gap-2 ${isNaughtyMode ? 'hover:bg-rose-500 dark:hover:bg-rose-600' : 'hover:bg-red-500 dark:hover:bg-red-600'} hover:text-white`}>
            <RefreshCw size={18} /> <span>Synchroniser mes comptes</span>
          </button>
        </div>
        <div className="space-y-8">
          {/* LIGNE 1 : Titres uniquement (priorité 1 de la cascade de génération) */}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-wider ${textMuted} mb-4 flex items-center`}><Heart size={16} className="mr-2"/> Titres Favoris</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {favorites.tracks.map((track, idx) => (
                <div key={track.youtubeId || idx} className={`flex items-center gap-2 p-2.5 rounded-xl border ${cardBorder} ${inputBg}`}>
                  <button
                    onClick={() => togglePreview(track)}
                    disabled={!track.preview}
                    title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                  >
                    {playingPreviewId === track.youtubeId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm truncate ${textHighlight}`}>{track.title}</div>
                    <div className={`text-xs truncate ${textMuted}`}>{track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}</div>
                  </div>
                  {track.bpm ? <span className={`font-mono text-xs font-bold shrink-0 ${textColorClass}`}>{track.bpm} BPM</span> : null}
                  <button onClick={() => setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.youtubeId !== track.youtubeId) }))} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <X size={14}/>
                  </button>
                </div>
              ))}
              <button onClick={() => { setCurrentPlaylist(null); setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed ${inputBorder} ${textMuted} hover:${textHighlight} hover:border-gray-400 transition-colors font-bold text-sm`}>
                <Plus size={16}/> Ajouter un titre
              </button>
            </div>
          </div>

          {/* LIGNE 2 : Artistes uniquement (priorité 1.5, élargissement suivant) */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
            <h4 className={`text-sm font-bold uppercase tracking-wider ${textMuted} mb-4 flex items-center`}><User size={16} className="mr-2"/> Top Artistes</h4>
            <div className="flex flex-wrap gap-2.5 items-center">
              {favorites.artists.map((artist, idx) => (
                <span key={idx} className={`px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold ${textHighlight} shadow-sm flex items-center gap-2`}>
                  {artist}
                  <button onClick={() => setFavorites(prev => ({ ...prev, artists: prev.artists.filter(a => a !== artist) }))} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={13}/>
                  </button>
                </span>
              ))}
              {isAddingArtist ? (
                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-xl pl-3 pr-1 py-1 shadow-sm">
                  <input
                    type="text" autoFocus value={newFavArtist} onChange={e => setNewFavArtist(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addFavoriteArtistValidated(newFavArtist);
                      if (e.key === 'Escape') { setNewFavArtist(""); setIsAddingArtist(false); }
                    }}
                    onBlur={() => { if (!newFavArtist.trim()) setIsAddingArtist(false); }}
                    placeholder="Nom de l'artiste..."
                    className="text-sm font-bold text-gray-900 outline-none bg-transparent w-36"
                  />
                  <button onClick={() => addFavoriteArtistValidated(newFavArtist)} className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 ${bgAccentClass}`}>
                    <Plus size={14}/>
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsAddingArtist(true)} title="Ajouter un artiste" className="w-10 h-10 rounded-full bg-white border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors shadow-sm">
                  <Plus size={18}/>
                </button>
              )}
            </div>
          </div>

          {/* Sélecteur BPM/genre : explorer et ajouter aux favoris des titres précis,
              indépendamment du wizard de génération. */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-6">
            <h3 className={`font-bold text-xl flex items-center gap-2 ${textHighlight}`}><Target className={textColorClass} size={22}/> Explorer par BPM & Genre</h3>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className={`text-sm font-bold ${textMuted}`}>Rythme cible</label>
                <span className={`text-2xl font-black ${textColorClass}`}>{favBpmTarget} <span className={`text-xs font-bold ${textMuted}`}>BPM</span></span>
              </div>
              <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={favBpmTarget} onChange={(e) => setFavBpmTarget(parseInt(e.target.value))} className={`w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className={`text-sm font-bold ${textMuted}`}>Marge d'erreur</label>
                <span className={`text-sm font-black ${textColorClass}`}>± {favBpmTolerance} BPM</span>
              </div>
              <input type="range" min="1" max="30" value={favBpmTolerance} onChange={(e) => setFavBpmTolerance(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
            </div>

            <div>
              <label className={`text-sm font-bold ${textMuted} block mb-3`}>Genres</label>
              <div className="flex flex-wrap gap-2">
                {availableGenres.map(genre => {
                  const isSelected = favSelectedGenres.includes(genre);
                  const warning = getGenreLocalDepthWarning(genre);
                  return (
                    <button key={genre} onClick={() => {
                      if (isSelected) { if (favSelectedGenres.length > 1) setFavSelectedGenres(favSelectedGenres.filter(g => g !== genre)); }
                      else setFavSelectedGenres([...favSelectedGenres, genre]);
                    }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                      {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                    </button>
                  );
                })}
                {!isNaughtyMode && (
                  <button onClick={() => setShowExtraGenres(!showExtraGenres)} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}>
                    {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                  </button>
                )}
              </div>
              {!isNaughtyMode && showExtraGenres && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {EXTRA_GENRES.map(genre => {
                    const isSelected = favSelectedGenres.includes(genre);
                    const warning = getGenreLocalDepthWarning(genre);
                    return (
                      <button key={genre} onClick={() => {
                        if (isSelected) { if (favSelectedGenres.length > 1) setFavSelectedGenres(favSelectedGenres.filter(g => g !== genre)); }
                        else setFavSelectedGenres([...favSelectedGenres, genre]);
                      }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                        {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={() => {
              setCurrentPlaylist(null); // BUG CORRIGÉ : sans ça, les ajouts partaient dans une ancienne playlist au lieu des favoris
              setIsBpmSearchMode(true);
              setWorldSearchResults([]);
              setNoUsableResultsHint(false);
              setIsSearchModalOpen(true);
              searchTracksByBpm(favBpmTarget, favBpmTolerance, favSelectedGenres);
            }} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
              <Search size={20}/> <span>Chercher des titres à {favBpmTarget} BPM</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
