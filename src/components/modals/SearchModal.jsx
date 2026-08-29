import { Target, Search, RefreshCw, Loader2, ChevronDown, Play, Pause, Edit3, Check, Plus } from 'lucide-react';
import { genreDisplayLabel, getGenresForDisplay } from '../../musicCatalog';
import ModalShell from '../shared/ModalShell';
import ModalCloseButton from '../shared/ModalCloseButton';

/**
 * SearchModal — recherche manuelle d'un titre (par nom/artiste, ou par BPM
 * cible depuis un camembert "Titres à ce BPM"). Extrait de App.jsx (voir
 * CustomActivityModal.jsx pour le contexte de cette série d'extractions).
 *
 * `renderSearchResultRow` vit maintenant ICI (retour direct : "prends du
 * recul, regarde si ça vaut le coup" sur useDeezerSearch.js, puis "continue
 * avec renderSearchResultRow") plutôt que reçue en prop depuis App.jsx —
 * elle produit du JSX propre à CETTE modale (une ligne de résultat), ça n'a
 * jamais eu de sens qu'elle vive ailleurs que là où elle s'affiche. Ses
 * dépendances (favoris, playlist en cours, lecture audio, édition BPM)
 * arrivent en props individuelles, comme le reste de cette modale.
 */
export default function SearchModal({
  theme,
  isSearchModalOpen, closeSearchModal,
  isBpmSearchMode, bpmSearchParams, searchTracksByBpm,
  loadMoreBpmResults, bpmUnconfirmedReserve, bpmSearchExhausted, loadMoreElapsedSeconds,
  searchQuery, setSearchQuery, searchWorldMusicApi,
  isWorldSearching, worldSearchResults, worldSearchOtherResults,
  searchLoadingMessage, searchElapsedSeconds,
  searchHasMoreResults, isLoadingMoreResults,
  resultsContextLabel, searchActiveArtistName, noUsableResultsHint,
  currentPlaylist, favorites, setFavorites,
  editingBpmId, setEditingBpmId, commitBpmEdit,
  handleAddManualTrack, togglePreview, playingPreviewId,
  showToast,
}) {
  const { cardBg, cardBorder, textHighlight, textColorClass, textMuted, inputBg, inputBorder, bgAccentClass } = theme;

  if (!isSearchModalOpen) return null;

  // ⚠️ RÉVÉLATION DE LA RÉSERVE NON CONFIRMÉE (28/08, retour direct — "les
  // non confirmés ne devraient apparaître qu'une fois qu'on a vraiment fait
  // le tour") — voir la docstring de `loadMoreBpmResults`, useDeezerSearch.js,
  // pour le détail complet du signal `bpmSearchExhausted`. Tant qu'il est
  // faux, `bpmUnconfirmedReserve` reste invisible ; une fois vrai (un
  // "Charger plus" n'a rien trouvé de nouveau, confirmé ou non), la réserve
  // rejoint l'affichage — ajoutée EN FIN de liste sans nouveau tri, puisque
  // `worldSearchResults` (confirmé) est déjà trié en amont et que
  // `bpmUnconfirmedReserve` ne contient QUE du palier 2 (toujours en
  // dernier par construction, voir classifyGenreMatchTier).
  const displayedResults = (isBpmSearchMode && bpmSearchExhausted)
    ? [...worldSearchResults, ...bpmUnconfirmedReserve]
    : worldSearchResults;

  // Filtre les titres déjà en favoris — pas la peine de les remontrer à
  // chaque nouvelle recherche identique. Uniquement hors contexte playlist :
  // dans une playlist, un titre déjà en favoris reste pertinent à ajouter,
  // la notion de "favori" n'a rien à voir avec ce qu'on cherche à faire ici.
  // Extrait en portée partagée (28/08, chantier "compteur de résultats") —
  // auparavant recalculé localement dans l'IIFE plus bas ; réutilisé
  // maintenant aussi pour le compteur affiché sur la ligne "Cible" (voir
  // `visibleResultsCount` juste en dessous).
  const isAlreadyFav = (t) => !currentPlaylist && favorites.tracks.some(f => f.trackId === t.trackId);

  // Compteur de résultats (28/08, retour direct — "un compteur en haut à
  // droite, qui augmente ou diminue selon les ajouts et retraits") — Option
  // A retenue après discussion : compte les résultats CONFIRMÉS VISIBLES à
  // l'écran (donc `displayedResults`, qui inclut la réserve non confirmée
  // une fois révélée — à ce moment-là, elle EST ce qui s'affiche), après le
  // même filtre favoris que la liste réelle (`isAlreadyFav`) — jamais un
  // total "brut" côté serveur qui inclurait les non confirmés encore
  // cachés, ce qui aurait indirectement révélé leur existence avant l'heure
  // (voir la docstring de `bpmUnconfirmedReserve`, useTrackSearch.js).
  // Diminue naturellement quand un titre rejoint les favoris (retiré de
  // l'affichage par `isAlreadyFav` ci-dessus), augmente à chaque nouveau lot
  // reçu (recherche initiale progressive OU "Charger plus").
  const visibleResultsCount = displayedResults.filter(t => !isAlreadyFav(t)).length;

  // Texte évolutif du bouton "Charger plus" PENDANT le chargement (28/08,
  // retour direct — "faudrait avoir le texte 'chargement' qui évolue un peu
  // comme pour le reste de la génération") — même principe à paliers de
  // temps que `getGenerationBannerMessage` (GenerationProgressBanner.jsx),
  // adapté à un bouton compact plutôt qu'un bandeau flottant (messages plus
  // courts, pas de compte de titres en cours — contrairement à la
  // génération, cette recherche n'expose pas de compteur progressif fiable
  // pendant le chargement). Recherche catalogue déjà exhaustive sur tout le
  // catalogue à chaque "Charger plus" (voir loadMoreBpmResults) — peut
  // légitimement prendre du temps, d'où l'intérêt de rassurer au-delà de
  // quelques secondes plutôt que de laisser "Chargement..." statique.
  const getLoadMoreButtonText = () => {
    if (loadMoreElapsedSeconds < 8) return "Chargement...";
    if (loadMoreElapsedSeconds < 20) return "Encore un instant...";
    return "Ça prend plus de temps que prévu...";
  };

  // Une seule ligne de résultat de recherche (bouton extrait + ajout/favori) —
  // extraite en fonction réutilisable pour être partagée entre la liste
  // principale (worldSearchResults) et la réserve "autres résultats" révélée en
  // bas une fois la recherche épuisée (voir worldSearchOtherResults).
  const renderSearchResultRow = (track, key) => {
    const isEditingThisBpm = editingBpmId === track.trackId;
    const isAlreadyFavorited = !currentPlaylist && favorites.tracks.some(t => t.trackId === track.trackId);
    const addOrToggleFavorite = () => {
      // Si on est dans la vue Playlist, on l'ajoute. Sinon, ça bascule dans les Favoris !
      if (currentPlaylist) handleAddManualTrack(track);
      else if (isAlreadyFavorited) {
         setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.trackId !== track.trackId) }));
         showToast("Retiré de tes favoris.");
      } else {
         setFavorites(prev => ({
           ...prev,
           artists: Array.from(new Set([...prev.artists, track.artist])),
           tracks: [...prev.tracks, track]
         }));
         showToast("🎵 Ajouté à tes favoris !");
      }
    };
    return (
    <div key={key} className={`flex items-center gap-2 p-2 rounded-xl hover:bg-surface-hover transition-colors border border-transparent hover:border-divider`}>
      {/* Bouton lecture/pause de l'extrait audio 30s (Deezer). Désactivé si aucun extrait disponible. */}
      <button
        onClick={() => togglePreview(track)}
        disabled={!track.preview}
        title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
      >
        {playingPreviewId === track.trackId ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
      </button>

      <button onClick={addOrToggleFavorite} className="flex-1 min-w-0 text-left">
        <div className="truncate">
          <div className={"font-bold text-sm truncate " + textHighlight} title={track.title}>{track.title}</div>
          <div className={"text-xs truncate " + textMuted} title={`${track.artist}${track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}`}>{track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}{track._bpmSource === 'detected' && <span className="ml-1 text-amber-500 font-bold" title="BPM deviné par l'app, pas garanti.">⚠️ BPM estimé</span>}</div>
        </div>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        {isEditingThisBpm ? (
          <input
            type="number"
            autoFocus
            defaultValue={track.bpm}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commitBpmEdit(track, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditingBpmId(null);
            }}
            className={`w-16 text-right font-mono text-sm font-bold bg-transparent border-b outline-hidden ${textColorClass} ${inputBorder}`}
          />
        ) : (track._bpmSource === 'detected' || track._bpmSource === 'manual') ? (
          // L'édition n'est proposée QUE là où il y a un doute réel à corriger :
          // `detected` (deviné par analyse audio, ambiguïté d'octave documentée
          // plus haut) et `manual` (pour pouvoir se corriger à nouveau soi-même).
          //
          // ⚠️ Décision prise après retour utilisateur : au départ, TOUS les BPM
          // étaient éditables, y compris ceux fournis directement par Deezer —
          // ce qui n'a pas de sens ("corriger" une valeur qu'on n'a aucune
          // raison de mettre en doute), et affaiblissait le signal du crayon
          // pour les cas où il compte vraiment. Un titre `deezer`/`getsongbpm`
          // s'affiche donc maintenant en texte simple, sans bouton ni crayon —
          // le risque, sinon, est qu'un utilisateur tape un chiffre erroné sur
          // un titre déjà fiable, et fausse silencieusement le matching BPM
          // plus tard (le générateur choisirait ce titre pour un tempo qu'il
          // n'a en réalité pas, puisque seule la métadonnée aurait changé, pas
          // l'audio réel).
          //
          // Titre choisi avec soin : "~" seul (déjà présent) signale l'incertitude
          // sans expliquer quoi faire. Le texte au survol dit explicitement
          // qu'un clic permet de corriger — la seule vraie parade à une
          // détection audio par nature ambiguë (voir le long historique de
          // cette fonction plus haut) est de laisser l'utilisateur trancher
          // lui-même quand il connaît la vraie valeur.
          //
          // Icône crayon TOUJOURS visible (pas seulement au survol) : le `title`
          // (infobulle native) et un simple `hover:underline` sont tous les deux
          // invisibles sur écran tactile (pas de survol au doigt) — sans indice
          // visuel permanent, ce bouton ne se distinguait pas de texte normal
          // sur mobile. Le `title` reste en plus, pour la souris/clavier.
          <button
            onClick={() => setEditingBpmId(track.trackId)}
            title={
              track._bpmSource === 'detected'
                ? "BPM deviné, pas garanti — touche pour corriger."
                : "BPM corrigé à la main. Touche pour modifier."
            }
            className={"flex items-center gap-1 font-mono text-sm font-bold " + textColorClass}
          >
            <span>{track._bpmSource === 'detected' ? '~' : ''}{track.bpm} BPM</span>
            <Edit3 size={12} className="opacity-50"/>
          </button>
        ) : (
          // Source fiable (Deezer ou GetSongBPM) : pas d'affordance d'édition —
          // voir le commentaire ci-dessus pour le raisonnement complet.
          <span className={"font-mono text-sm font-bold " + textColorClass}>{track.bpm} BPM</span>
        )}
        <button onClick={addOrToggleFavorite} title={isAlreadyFavorited ? "Retirer des favoris" : "Ajouter"}>
          {isAlreadyFavorited ? (
            <Check size={16} className="text-green-500" />
          ) : (
            <Plus size={16} className={textMuted}/>
          )}
        </button>
      </div>
    </div>
    );
  };

  return (
    <ModalShell onClose={closeSearchModal} theme={theme} maxWidth="max-w-lg" cardClassName="p-6 md:p-8 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-1">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            {isBpmSearchMode ? <Target className={textColorClass}/> : <Search className={textColorClass}/>}
            <span>{isBpmSearchMode ? "Titres à ce BPM" : "Rechercher un titre"}</span>
          </h3>
          <ModalCloseButton onClick={closeSearchModal} />
        </div>
        {/* Disclaimer honnête : l'utilisateur n'a pas besoin de savoir qu'on passe par
            une API, mais mérite de savoir que les résultats viennent d'un service tiers
            (Deezer) et peuvent être incomplets ou approximatifs — sans jargon technique. */}
        <p className={`text-xs mb-5 ${textMuted}`}>* Connecté via Deezer — le BPM peut être approximatif, et certains titres peuvent rester introuvables.</p>

        {isBpmSearchMode ? (
          <div className={`mb-4 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg} flex items-center justify-between gap-2`}>
            <span className={`text-sm font-bold ${textMuted}`}>Cible : <span className={textColorClass}>{bpmSearchParams.bpm} BPM ± {bpmSearchParams.tolerance}</span> · {bpmSearchParams.genres.length > 0 ? bpmSearchParams.genres.map(genreDisplayLabel).join(', ') : 'tous genres'}</span>
            <div className="flex items-center gap-2 shrink-0">
              {/* Compteur de résultats (28/08, retour direct — "un compteur
                  de résultats en haut à droite") — voir la docstring de
                  `visibleResultsCount` en tête de composant pour ce qu'il
                  compte exactement (Option A retenue après discussion :
                  confirmé visible à l'écran, jamais la réserve cachée).
                  N'apparaît que s'il y a au moins 1 résultat à annoncer —
                  pas de "0 résultat" avant même d'avoir cherché quoi que ce
                  soit, ni pendant un état déjà couvert par le message "Aucun
                  résultat" plus bas. */}
              {visibleResultsCount > 0 && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${textMuted} bg-black/5 dark:bg-white/10`}>
                  {visibleResultsCount} résultat{visibleResultsCount > 1 ? 's' : ''}
                </span>
              )}
              <button onClick={() => searchTracksByBpm(bpmSearchParams.bpm, bpmSearchParams.tolerance, bpmSearchParams.genres)} disabled={isWorldSearching} className={`p-2 rounded-lg text-white ${bgAccentClass}`}>
                {isWorldSearching ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 flex gap-2">
            <div className={"flex-1 flex items-center px-4 py-3 rounded-xl border " + inputBg + " " + inputBorder + (isWorldSearching ? ' opacity-60' : '')}>
              <Search size={18} className={"mr-3 " + textMuted} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isWorldSearching && searchWorldMusicApi(true)} disabled={isWorldSearching} placeholder="Titre ou artiste (ex: One More Time, Daft Punk)..." className={"bg-transparent w-full font-bold outline-hidden disabled:cursor-not-allowed " + textHighlight} autoFocus />
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
          ) : (worldSearchResults.length > 0 || (isBpmSearchMode && bpmUnconfirmedReserve.length > 0) || (!searchHasMoreResults && worldSearchOtherResults.length > 0)) ? (
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
              {/* RIEN DE CONFIRMÉ POUR L'INSTANT (28/08, chantier "révéler le
                  non confirmé seulement si vraiment épuisé") — cas où la
                  recherche a bien trouvé quelque chose (sinon on serait dans
                  la branche "Aucun résultat" plus bas), mais UNIQUEMENT des
                  titres au genre non confirmé, tous encore cachés en
                  réserve. Message honnête plutôt qu'une liste vide sans
                  explication, avant le bouton "Charger plus" juste après.
                  ⚠️ NOMBRE EXACT AJOUTÉ (28/08, retour direct — "ça peut
                  sembler être un échec total") : le message générique
                  précédent ("Rien de confirmé...") ne distinguait pas "on
                  n'a RIEN trouvé du tout" de "on a des pistes, juste pas
                  sûres encore" — ce 2e cas mérite une formulation moins
                  décourageante. Le CHIFFRE (`bpmUnconfirmedReserve.length`)
                  change cette perception sans pour autant montrer ces
                  titres avant d'avoir vraiment épuisé la recherche —
                  toujours aucune contamination visuelle du non confirmé,
                  juste une meilleure information sur ce qui attend déjà en
                  coulisses. */}
              {isBpmSearchMode && !isWorldSearching && !bpmSearchExhausted && worldSearchResults.length === 0 && bpmUnconfirmedReserve.length > 0 && (
                <div className={`text-sm font-medium px-1 pb-2 ${textMuted}`}>
                  Rien de confirmé pour l'instant à ce BPM/genre — {bpmUnconfirmedReserve.length} titre{bpmUnconfirmedReserve.length > 1 ? 's' : ''} approximatif{bpmUnconfirmedReserve.length > 1 ? 's' : ''} trouvé{bpmUnconfirmedReserve.length > 1 ? 's' : ''} (genre non garanti), essaie "Charger plus" pour chercher mieux.
                </div>
              )}
              {(() => {
                // `isAlreadyFav`/le filtre lui-même sont maintenant calculés
                // en tête de composant (28/08, chantier "compteur de
                // résultats" — voir `visibleResultsCount`) et réutilisés ici
                // tels quels, plutôt que recalculés localement en double.
                const visibleMainResults = displayedResults.filter(t => !isAlreadyFav(t));
                return (
                  <>
                    {displayedResults.length > 0 && visibleMainResults.length === 0 && (
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
                  className={`w-full mt-1 py-2.5 rounded-xl border-2 border-dashed text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${inputBorder} ${textMuted} hover:text-main hover:border-gray-400`}
                >
                  {isLoadingMoreResults ? <Loader2 className="animate-spin" size={16}/> : <ChevronDown size={16}/>}
                  <span>{isLoadingMoreResults ? "Chargement..." : "Voir plus de résultats"}</span>
                </button>
              )}
              {/* "Charger plus" en mode BPM (28/08, retour direct — voir la
                  docstring de `loadMoreBpmResults`, useDeezerSearch.js, pour
                  le raisonnement complet) — PAS de notion de "page suivante"
                  ici contrairement au bouton texte libre ci-dessus (pas de
                  `searchHasMoreResults` équivalent, la recherche catalogue
                  explore déjà tout le catalogue dès le 1er appel) : affiché
                  dès que la recherche initiale est terminée
                  (`!isWorldSearching`) et qu'il y a déjà des résultats
                  (confirmés OU en réserve cachée) à compléter, comme une
                  action "chercher plus loin" plutôt qu'une vraie pagination.
                  ⚠️ NE DISPARAÎT JAMAIS (28/08, retour direct — "un coup de
                  malchance sur le tirage aléatoire des artistes ne devrait
                  pas fermer définitivement la porte") — `bpmSearchExhausted`
                  servait initialement à CACHER ce bouton une fois épuisé ;
                  un seul "Charger plus" sans rien trouver de nouveau n'est
                  qu'une indication, pas une preuve absolue qu'il n'y a
                  vraiment plus rien (le tirage aléatoire des artistes,
                  searchArtistsForBpm, aurait pu tomber sur un lot peu
                  chanceux). `bpmSearchExhausted` sert maintenant UNIQUEMENT
                  à révéler la réserve non confirmée (voir `displayedResults`
                  en tête de composant) et à changer le texte du bouton
                  ci-dessous — plus jamais à le faire disparaître. */}
              {isBpmSearchMode && !isWorldSearching && (worldSearchResults.length > 0 || bpmUnconfirmedReserve.length > 0) && (
                <button
                  onClick={loadMoreBpmResults}
                  disabled={isLoadingMoreResults}
                  className={`w-full mt-1 py-2.5 rounded-xl border-2 border-dashed text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${inputBorder} ${textMuted} hover:text-main hover:border-gray-400`}
                >
                  {isLoadingMoreResults ? <Loader2 className="animate-spin" size={16}/> : <ChevronDown size={16}/>}
                  <span>
                    {isLoadingMoreResults
                      ? getLoadMoreButtonText()
                      // Texte différent une fois qu'un 1er "Charger plus" n'a
                      // rien trouvé de nouveau (28/08) — signale honnêtement
                      // que la suite est moins probable, SANS fermer la porte :
                      // "chercher encore plus loin" plutôt que redonner
                      // l'impression d'une action IDENTIQUE à la 1re fois.
                      : (bpmSearchExhausted ? "Chercher encore plus loin" : "Charger plus de résultats")}
                  </span>
                </button>
              )}
              {/* Réserve "autres résultats" (titres qui matchent le texte tapé
                  mais pas l'artiste identifié, ex. Starboy pour "daft punk") —
                  révélée seulement une fois la recherche générale épuisée
                  (searchHasMoreResults = false), jamais avant : voir searchWorldMusicApi. */}
              {!searchHasMoreResults && !isBpmSearchMode && worldSearchOtherResults.length > 0 && (
                <>
                  <div className={`text-xs font-bold uppercase tracking-wider mt-4 mb-2 px-1 ${textMuted}`}>Autres résultats pour "{searchQuery}" (pas {searchActiveArtistName})</div>
                  {worldSearchOtherResults.filter(t => !(!currentPlaylist && favorites.tracks.some(f => f.trackId === t.trackId))).map((track, i) => renderSearchResultRow(track, `other-${i}`))}
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
    </ModalShell>
  );
}
