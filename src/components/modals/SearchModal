import { X, Target, Search, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import { genreDisplayLabel } from '../../musicCatalog';

/**
 * SearchModal — recherche manuelle d'un titre (par nom/artiste, ou par BPM
 * cible depuis un camembert "Titres à ce BPM"). Extrait de App.jsx (voir
 * CustomActivityModal.jsx pour le contexte de cette série d'extractions).
 *
 * La plus grosse des modales extraites, et la plus "à plat" en props —
 * volontairement laissée telle quelle dans cette passe (extraction pure,
 * mécanique, sans rien réorganiser en plus) plutôt que d'en profiter pour
 * réinventer sa gestion d'état : `renderSearchResultRow` reste défini dans
 * App.jsx et arrive ici en prop, comme les autres fonctions de rendu déjà
 * partagées avec les vues (ex. `renderCompletionsList`, PlaylistDetailView).
 * Un futur découpage de cette modale (ex. en sous-composants "mode texte" vs
 * "mode BPM") est un chantier à part, plus risqué, pas fait ici.
 */
export default function SearchModal({
  theme,
  isSearchModalOpen, closeSearchModal,
  isBpmSearchMode, bpmSearchParams, searchTracksByBpm,
  searchQuery, setSearchQuery, searchWorldMusicApi,
  isWorldSearching, worldSearchResults, worldSearchOtherResults,
  searchLoadingMessage, searchElapsedSeconds,
  searchHasMoreResults, isLoadingMoreResults,
  resultsContextLabel, searchActiveArtistName, noUsableResultsHint,
  currentPlaylist, favorites,
  renderSearchResultRow,
}) {
  const { cardBg, cardBorder, textHighlight, textColorClass, textMuted, inputBg, inputBorder, bgAccentClass } = theme;

  if (!isSearchModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeSearchModal}>
      <div className={"p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            {isBpmSearchMode ? <Target className={textColorClass}/> : <Search className={textColorClass}/>}
            <span>{isBpmSearchMode ? "Titres à ce BPM" : "Rechercher un titre"}</span>
          </h3>
          <button onClick={closeSearchModal} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>
        {/* Disclaimer honnête : l'utilisateur n'a pas besoin de savoir qu'on passe par
            une API, mais mérite de savoir que les résultats viennent d'un service tiers
            (Deezer) et peuvent être incomplets ou approximatifs — sans jargon technique. */}
        <p className={`text-xs mb-5 ${textMuted}`}>* Connecté via Deezer — le BPM peut être approximatif, et certains titres peuvent rester introuvables.</p>

        {isBpmSearchMode ? (
          <div className={`mb-4 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg} flex items-center justify-between`}>
            <span className={`text-sm font-bold ${textMuted}`}>Cible : <span className={textColorClass}>{bpmSearchParams.bpm} BPM ± {bpmSearchParams.tolerance}</span> · {bpmSearchParams.genres.length > 0 ? bpmSearchParams.genres.map(genreDisplayLabel).join(', ') : 'tous genres'}</span>
            <button onClick={() => searchTracksByBpm(bpmSearchParams.bpm, bpmSearchParams.tolerance, bpmSearchParams.genres)} disabled={isWorldSearching} className={`p-2 rounded-lg text-white ${bgAccentClass}`}>
              {isWorldSearching ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
            </button>
          </div>
        ) : (
          <div className="mb-4 flex gap-2">
            <div className={"flex-1 flex items-center px-4 py-3 rounded-xl border " + inputBg + " " + inputBorder}>
              <Search size={18} className={"mr-3 " + textMuted} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchWorldMusicApi(true)} placeholder="Titre ou artiste (ex: One More Time, Daft Punk)..." className={"bg-transparent w-full font-bold outline-none " + textHighlight} autoFocus />
            </div>
            <button onClick={() => searchWorldMusicApi(true)} disabled={isWorldSearching} className={"px-4 rounded-xl text-white font-bold transition-transform active:scale-95 flex items-center justify-center " + bgAccentClass}>
              {isWorldSearching ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 min-h-[200px]">
          {isWorldSearching && worldSearchResults.length === 0 ? (
            // Standardisé sur le même visuel "pilule" que l'indicateur de génération
            // (voir plus haut, "Génération en cours...") — retour utilisateur : les
            // indicateurs de chargement de l'app étaient trop différents d'un endroit
            // à l'autre (ici, un gros bloc vertical centré vs une pilule horizontale
            // ailleurs). Même structure exacte reprise : icône + texte + puce
            // chronomètre au format M:SS, plutôt qu'un simple "Xs" comme avant.
            <div className="flex justify-center py-8">
              <div className={`${cardBg} border ${cardBorder} shadow-2xl px-6 py-3 rounded-full flex items-center space-x-3`}>
                <Loader2 size={18} className={`animate-spin ${textColorClass}`} />
                <span className={`font-medium text-sm ${textHighlight}`}>{searchLoadingMessage}</span>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${textMuted} bg-black/5 dark:bg-white/10`}>
                  {Math.floor(searchElapsedSeconds / 60)}:{String(searchElapsedSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
          ) : (worldSearchResults.length > 0 || (!searchHasMoreResults && worldSearchOtherResults.length > 0)) ? (
            <>
              {/* RETOUR DIRECT (affichage progressif) : indicateur discret que la
                  recherche continue en arrière-plan même une fois les premiers
                  résultats déjà affichés — sans ça, rien ne distingue "la recherche
                  est terminée" de "encore en cours, potentiellement d'autres titres
                  à venir". Uniquement en mode BPM (seul chemin concerné par la
                  recherche progressive, voir fetchBpmSearchResults). */}
              {isBpmSearchMode && isWorldSearching && worldSearchResults.length > 0 && (
                <div className={`flex items-center gap-2 text-xs font-semibold px-1 pb-2 ${textMuted}`}>
                  <Loader2 size={12} className="animate-spin"/>
                  <span>Recherche toujours en cours — d'autres titres peuvent encore apparaître...</span>
                </div>
              )}
              {resultsContextLabel && !isBpmSearchMode && worldSearchResults.length > 0 && (
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${textMuted}`}>{resultsContextLabel}</div>
              )}
              {(() => {
                // Filtre les titres déjà en favoris — pas la peine de les
                // remontrer à chaque nouvelle recherche identique. Uniquement
                // hors contexte playlist : dans une playlist, un titre déjà
                // en favoris reste pertinent à ajouter, la notion de
                // "favori" n'a rien à voir avec ce qu'on cherche à faire ici.
                const isAlreadyFav = (t) => !currentPlaylist && favorites.tracks.some(f => f.youtubeId === t.youtubeId);
                const visibleMainResults = worldSearchResults.filter(t => !isAlreadyFav(t));
                return (
                  <>
                    {worldSearchResults.length > 0 && visibleMainResults.length === 0 && (
                      <div className={`text-xs italic px-1 pb-1 ${textMuted}`}>Tous les titres trouvés ici sont déjà dans tes favoris.</div>
                    )}
                    {visibleMainResults.map((track, i) => renderSearchResultRow(track, i))}
                  </>
                );
              })()}
              {searchHasMoreResults && !isBpmSearchMode && (
                <button
                  onClick={() => searchWorldMusicApi(false)}
                  disabled={isLoadingMoreResults}
                  className={"w-full mt-1 py-2.5 rounded-xl border-2 border-dashed text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 " + inputBorder + " " + textMuted + " hover:" + textHighlight + " hover:border-gray-400"}
                >
                  {isLoadingMoreResults ? <Loader2 className="animate-spin" size={16}/> : <ChevronDown size={16}/>}
                  <span>{isLoadingMoreResults ? "Chargement..." : "Voir plus de résultats"}</span>
                </button>
              )}
              {/* Réserve "autres résultats" (titres qui matchent le texte tapé
                  mais pas l'artiste identifié, ex. Starboy pour "daft punk") —
                  révélée seulement une fois la recherche générale épuisée
                  (searchHasMoreResults = false), jamais avant : voir searchWorldMusicApi. */}
              {!searchHasMoreResults && !isBpmSearchMode && worldSearchOtherResults.length > 0 && (
                <>
                  <div className={`text-xs font-bold uppercase tracking-wider mt-4 mb-2 px-1 ${textMuted}`}>Autres résultats pour "{searchQuery}" (pas {searchActiveArtistName})</div>
                  {worldSearchOtherResults.filter(t => !(!currentPlaylist && favorites.tracks.some(f => f.youtubeId === t.youtubeId))).map((track, i) => renderSearchResultRow(track, `other-${i}`))}
                </>
              )}
            </>
          ) : (
            (isBpmSearchMode || searchQuery.length > 0) && !isWorldSearching ? (
              noUsableResultsHint ? (
                <div className={`text-center py-8 px-4 font-medium ${textMuted}`}>
                  {isBpmSearchMode
                    ? <>Aucun titre trouvé pile à {bpmSearchParams.bpm} BPM (± {bpmSearchParams.tolerance}) pour ces genres.<br/>Essaie d'élargir la marge d'erreur.</>
                    : <>Aucun titre avec un BPM connu trouvé pour "{searchQuery}".<br/>Essaie une orthographe différente, ou un titre plus précis.</>
                  }
                </div>
              ) : (
                <div className={`text-center py-8 font-medium ${textMuted}`}>Aucun résultat.</div>
              )
            ) : (
              <div className={`text-center py-8 font-medium ${textMuted}`}>Tape un titre ou un nom d'artiste pour chercher son BPM.</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
