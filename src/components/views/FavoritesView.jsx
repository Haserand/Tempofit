import { Star, Heart, Play, Pause, Loader2, X, Plus, User, Target, Search, Info } from 'lucide-react';
import { getGenreLocalDepthWarning, getGenresForDisplay, genreDisplayLabel, EXTRA_GENRES } from '../../musicCatalog';
import { useModalContext } from '../../contexts/ModalContext';
import ViewHeader from '../shared/ViewHeader';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../viewHeaderLayout';

/**
 * FavoritesView — vue "Mes Favoris" (titres/artistes favoris + exploration BPM/genre).
 *
 * Extrait de App.jsx (bloc `view === 'favorites'`). Comme SettingsView, ne
 * détient aucun state propre : tout vient de props explicites. `favorites` et
 * `setFavorites` restent gérés dans App.jsx (même logique que les favoris
 * ajoutés depuis la recherche manuelle — voir passation, section 5) : ce
 * composant ne fait qu'afficher et déclencher les mêmes setters.
 *
 * RETOUR DIRECT ("les favoris doivent avoir des morceaux écoutables") — le
 * bouton play utilisait `togglePreview` seul, qui exige un `track.preview`
 * DÉJÀ résolu (sinon bouton grisé, non cliquable). Un titre favori n'a
 * quasiment jamais cet aperçu déjà en mémoire à la relecture (favorisé lors
 * d'une session précédente, ou l'extrait Deezer d'origine a simplement
 * expiré — même limitation documentée pour les playlists ensemencées,
 * data/curatedSessions.js) : en pratique, TOUS les favoris se retrouvaient
 * injouables. `resolveAndToggleFavoritePreview` (ci-dessous) reproduit
 * EXACTEMENT le même mécanisme de résolution à la demande que
 * `resolveAndTogglePreview` dans PlaylistDetailView.jsx (jamais une 2e
 * implémentation) : résout l'extrait via Deezer au moment du clic si
 * absent, puis met à jour `favorites.tracks` avec le titre résolu (pour que
 * les clics suivants n'aient plus besoin de re-résoudre).
 */
export default function FavoritesView({
  theme, isNaughtyMode,
  favorites, setFavorites,
  togglePreview, playingPreviewId,
  resolveAndPlay, resolvingTrackId,
  setCurrentPlaylist, setIsBpmSearchMode, setWorldSearchResults, setNoUsableResultsHint,
  isAddingArtist, setIsAddingArtist, newFavArtist, setNewFavArtist, addFavoriteArtistValidated,
  availableGenres, favSelectedGenres, setFavSelectedGenres, showExtraGenres, setShowExtraGenres,
  favBpmTarget, setFavBpmTarget, favBpmTolerance, setFavBpmTolerance,
  searchTracksByBpm, changeView,
}) {
  const { openModal } = useModalContext();
  const {
    cardBg, cardBorder, textHighlight, textMuted, textColorClass,
    bgAccentClass, borderAccentClass, inputBg, inputBorder,
  } = theme;

  // Comparaison par `trackId` (pas par référence d'objet) pour retrouver ce
  // titre précis dans `favorites.tracks` — c'est justement le champ qui
  // change lors de cette résolution (repli `curated-`/`imported-` remplacé
  // par le vrai `deezer-{id}`), donc jamais ce sur quoi on compare pour le
  // retrouver ensuite ; ici la clé de la liste (`track.trackId || idx`) et
  // l'identité fonctionnelle du titre favori sont une seule et même chose,
  // contrairement à `id` vs `trackId` dans une playlist (voir
  // musicEngine.js) — un favori n'a pas de 2e identifiant d'occurrence.
  const resolveAndToggleFavoritePreview = async (track) => {
    if (track.preview) { togglePreview(track); return; }
    const updatedTrack = await resolveAndPlay(track);
    if (updatedTrack) {
      setFavorites(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.trackId === track.trackId ? updatedTrack : t),
      }));
    }
  };

  return (
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-8`}>
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<Star className="text-yellow-500 fill-yellow-500/20" size={VIEW_HEADER_ICON_SIZE} />}
        title="Mes Favoris"
        subtitle="Priorité à la génération : favoris d'abord, puis artistes favoris, puis recherche élargie si besoin."
      />

      <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-2">
          <h3 className={`font-bold text-xl ${textHighlight} ${isNaughtyMode ? 'dark:text-white' : ''}`}>Tes Préférences Musicales</h3>
          {/* Icône RefreshCw retirée (25/07, retour direct : "ce bouton
              laisse imaginer qu'une action va se faire immédiatement si je
              clique dessus") — un rond avec deux flèches évoque une action
              exécutée sur place (rafraîchir, synchroniser maintenant), alors
              que ce lien ne fait QUE naviguer vers "Options & Comptes" ;
              rien ne se passe ici tant qu'on n'a pas cliqué "Lier mon
              compte" sur cette page-là. Remplacée par une flèche `→` en fin
              de texte, même code visuel que "Configure →" dans
              GeneratorView.jsx (bannière Profil Athlétique) — cohérence
              d'un même signal "ce lien t'emmène ailleurs" à travers l'app.
              Infobulle reformulée dans le même esprit : "Ouvre" plutôt
              qu'une formulation qui pourrait laisser croire à une action
              déjà en cours. */}
          <button
            onClick={() => changeView('settings')}
            title="Ouvre la page Comptes pour lier Spotify et élargir le catalogue de titres disponibles."
            className={`text-sm font-bold underline ${textColorClass}`}
          >
            Synchroniser mes comptes →
          </button>
        </div>

        <div className="space-y-8">
          {/* LIGNE 1 : Titres uniquement (priorité 1 de la cascade de génération) */}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center ${textMuted} ${isNaughtyMode ? 'dark:text-white' : ''}`}><Heart size={16} className="mr-2"/> Titres Favoris</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {favorites.tracks.map((track, idx) => (
                <div key={track.trackId || idx} className={`flex items-center gap-2 p-2.5 rounded-xl border ${cardBorder} ${inputBg}`}>
                  <button
                    onClick={() => resolveAndToggleFavoritePreview(track)}
                    title="Écouter un extrait"
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${bgAccentClass} text-white hover:brightness-110`}
                  >
                    {resolvingTrackId === track.id
                      ? <Loader2 size={14} className="animate-spin"/>
                      : playingPreviewId === track.trackId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm truncate ${textHighlight}`}>{track.title}</div>
                    <div className={`text-xs truncate ${textMuted}`}>{track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}</div>
                  </div>
                  {track.bpm ? <span className={`font-mono text-xs font-bold shrink-0 ${textColorClass}`}>{track.bpm} BPM</span> : null}
                  <button onClick={() => setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.trackId !== track.trackId) }))} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <X size={14}/>
                  </button>
                </div>
              ))}
              <button onClick={() => { setCurrentPlaylist(null); setIsBpmSearchMode(false); openModal('SEARCH'); }} className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed ${inputBorder} ${textMuted} hover:text-main hover:border-gray-400 transition-colors font-bold text-sm`}>
                <Plus size={16}/> Ajouter un titre
              </button>
            </div>
          </div>

          {/* LIGNE 2 : Artistes uniquement (priorité 1.5, élargissement suivant) */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center ${textMuted} ${isNaughtyMode ? 'dark:text-white' : ''}`}><User size={16} className="mr-2"/> Top Artistes</h4>
            <div className="flex flex-wrap gap-2.5 items-center">
              {favorites.artists.map((artist, idx) => (
                <span key={idx} className={`px-4 py-2 bg-surface-hover border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold ${textHighlight} shadow-xs flex items-center gap-2`}>
                  {artist}
                  <button onClick={() => setFavorites(prev => ({ ...prev, artists: prev.artists.filter(a => a !== artist) }))} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={13}/>
                  </button>
                </span>
              ))}
              {isAddingArtist ? (
                <div className={`flex items-center gap-1 ${cardBg} border ${cardBorder} rounded-xl pl-3 pr-1 py-1 shadow-xs`}>
                  <input
                    type="text" autoFocus value={newFavArtist} onChange={e => setNewFavArtist(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addFavoriteArtistValidated(newFavArtist);
                      if (e.key === 'Escape') { setNewFavArtist(""); setIsAddingArtist(false); }
                    }}
                    onBlur={() => { if (!newFavArtist.trim()) setIsAddingArtist(false); }}
                    placeholder="Nom de l'artiste..."
                    className={`text-sm font-bold ${textHighlight} outline-hidden bg-transparent w-36`}
                  />
                  <button onClick={() => addFavoriteArtistValidated(newFavArtist)} className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 ${bgAccentClass}`}>
                    <Plus size={14}/>
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsAddingArtist(true)} title="Ajouter un artiste" className={`w-10 h-10 rounded-full ${cardBg} border-2 border-dashed ${cardBorder} flex items-center justify-center ${textMuted} hover:text-main transition-colors shadow-xs`}>
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
              {/* BUG CORRIGÉ (retour direct : "je devrais pouvoir sélectionner
                  aucun genre, ça veut dire recherche globale") — les 2 gardes
                  `favSelectedGenres.length > 1` ci-dessous (celle-ci et celle
                  des genres étendus juste plus bas) empêchaient de désélectionner
                  le tout dernier genre coché, alors que le mécanisme de
                  recherche (searchTracksByBpm → fetchBpmSearchResults,
                  searchEngine.js) sait déjà très bien traiter un tableau de
                  genres VIDE : `genresToQuery = genres.length > 0 ? genres :
                  ['Autre']`, et 'Autre' = aucune restriction de genre (voir
                  isDirectGenreMatch, musicCatalog.js). Le wizard principal
                  (`toggleGenre`, useGeneratorForm.js) n'a d'ailleurs jamais eu
                  cette garde — recalé ici pour être cohérent avec lui. */}
              <div className="flex flex-wrap gap-2">
                {availableGenres.map(genre => {
                  const isSelected = favSelectedGenres.includes(genre);
                  const warning = getGenreLocalDepthWarning(genre);
                  return (
                    <button key={genre} onClick={() => {
                      if (isSelected) setFavSelectedGenres(favSelectedGenres.filter(g => g !== genre));
                      else setFavSelectedGenres([...favSelectedGenres, genre]);
                    }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                      {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                    </button>
                  );
                })}
                {!isNaughtyMode && (
                  <button
                    onClick={() => setShowExtraGenres(!showExtraGenres)}
                    title="Certains genres ci-dessous : génération un peu plus longue."
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:text-main`}
                  >
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
                        if (isSelected) setFavSelectedGenres(favSelectedGenres.filter(g => g !== genre));
                        else setFavSelectedGenres([...favSelectedGenres, genre]);
                      }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                        {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Confirmation explicite une fois à zéro genre sélectionné — la
                  question posée en retour direct montre que ce n'était pas
                  évident sans ce message : le comportement existait déjà côté
                  recherche, seule la possibilité d'y arriver manquait côté UI. */}
              {favSelectedGenres.length === 0 && (
                <p className={`text-sm flex items-start gap-1.5 pt-2 font-semibold ${textColorClass}`}>
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <span>Aucun genre sélectionné : la recherche portera sur n'importe quel style, sans restriction.</span>
                </p>
              )}
              {/* Même logique que le wizard de génération (GeneratorView.jsx) : infobulle
                  sur le bouton AVANT le clic (title ci-dessus), rappel plus visible une
                  fois le panneau ouvert, message dédié pendant la recherche déplacé dans
                  le bandeau de la modale de résultats (voir searchTracksByBpm, App.jsx). */}
              {!isNaughtyMode && showExtraGenres && (
                <p className={`text-sm flex items-start gap-1.5 pt-2 font-semibold ${textColorClass}`}>
                  <Info size={16} className="shrink-0 mt-0.5" />
                  {/* Retour direct (même reformulation que GeneratorView.jsx) :
                      ne plus nommer explicitement WEAK_DEEZER_KEYWORD_GENRES,
                      qui n'est qu'une liste de convenance interne, pas une
                      couverture exhaustive de "tout ce qui peut être lent". */}
                  <span>Les genres les moins courants dans le catalogue peuvent demander une recherche plus approfondie : la génération prend alors un peu plus de temps.</span>
                </p>
              )}
            </div>

            <button onClick={() => {
              setCurrentPlaylist(null); // BUG CORRIGÉ : sans ça, les ajouts partaient dans une ancienne playlist au lieu des favoris
              setIsBpmSearchMode(true);
              setWorldSearchResults([]);
              setNoUsableResultsHint(false);
              openModal('SEARCH');
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
