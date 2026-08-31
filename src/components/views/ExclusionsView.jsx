import { Ban, X, Plus, User, Music } from 'lucide-react';
import { getGenresForDisplay, STANDARD_GENRES, NAUGHTY_GENRES, EXTRA_GENRES, genreDisplayLabel } from '../../musicCatalog';
import SelectablePill from '../shared/SelectablePill';

/**
 * ExclusionsView — CORPS SEUL de l'onglet "Exclusions" (titres/artistes/
 * genres jamais souhaités). N'inclut PLUS son propre `<ViewHeader/>` ni son
 * propre wrapper `VIEW_CONTENT_WRAPPER` — voir la FUSION du 28/08 ci-dessous.
 *
 * ⚠️ FUSIONNÉ dans FavoritesView.jsx (28/08, retour direct — "Exclusion
 * devrait être un onglet contenu dans l'onglet favoris, comme le modèle
 * playlists/routines contenu dans la vue playlists") : "Exclusions" n'est
 * plus une entrée de menu séparée dans la Sidebar — c'est maintenant un
 * ONGLET de "Mes Favoris" (FavoritesView.jsx), EXACTEMENT le même schéma
 * que l'onglet Playlists/Routines déjà en place sur PlaylistsView.jsx
 * (fusion du 20/08, voir RoutinesView.jsx pour le même raisonnement). Ce
 * fichier ne rend plus que le contenu (3 sections : titres/artistes/genres
 * exclus) ; `<ViewHeader/>`/le sélecteur d'onglet vivent maintenant UNE
 * SEULE FOIS dans FavoritesView.jsx (le titre/sous-titre y changent selon
 * l'onglet actif), pas dupliqués ici.
 *
 * RETOUR DIRECT (28/08, "mécanisme d'exclusion — artistes ou titres qu'on
 * ne souhaite jamais avoir, alimentable via d'autres points d'entrée comme
 * une playlist générée") — même structure que FavoritesView.jsx (2 lignes,
 * titres puis artistes), en négatif : le rôle de cette vue n'est PAS
 * d'ajouter de nouveaux titres exclus (ça se fait ailleurs — menu d'un
 * titre dans une playlist, recherche manuelle, voir TrackItem.jsx), mais de
 * GÉRER la liste déjà constituée (retirer une exclusion, ajouter un artiste
 * directement par son nom).
 *
 * `exclusions`/`setExclusions` restent gérés dans App.jsx (même logique que
 * `favorites`/`setFavorites`) — `toggleTrackExclusion`/`toggleArtistExclusion`
 * reçus ici sont déjà les versions COORDONNÉES avec les favoris (voir
 * App.jsx, exclusivité mutuelle) : retirer une exclusion ici ne redéclenche
 * PAS le message de transition (ce n'est qu'un simple retrait, jamais un
 * passage vers les favoris) — seul l'AJOUT déclenche potentiellement une
 * transition, et cette vue n'ajoute que des ARTISTES (par leur nom), jamais
 * de titre précis (il n'y a pas de recherche BPM/genre ici, contrairement à
 * FavoritesView.jsx — un titre s'exclut depuis là où on le RENCONTRE
 * déjà, pas depuis une recherche dédiée).
 */
export default function ExclusionsView({
  theme, isNaughtyMode,
  exclusions, toggleTrackExclusion, toggleArtistExclusion, toggleGenreExclusion,
  newExclusionArtist, setNewExclusionArtist, isAddingExclusionArtist, setIsAddingExclusionArtist,
}) {
  const {
    cardBg, cardBorder, textHighlight, textMuted, textColorClass,
    bgAccentClass, inputBg, inputBorder,
  } = theme;

  const addExclusionArtist = () => {
    const name = newExclusionArtist.trim();
    if (!name) return;
    toggleArtistExclusion(name);
    setNewExclusionArtist("");
    setIsAddingExclusionArtist(false);
  };

  return (
    <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
        <div className="space-y-8">
          {/* LIGNE 1 : Titres exclus — ajoutés uniquement depuis ailleurs
              (menu d'un titre dans une playlist, recherche manuelle) : pas
              de bouton "+" ici, contrairement aux artistes juste en dessous
              — voir la docstring du composant. */}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center ${textMuted} ${isNaughtyMode ? 'dark:text-white' : ''}`}><Ban size={16} className="mr-2"/> Titres Exclus</h4>
            {exclusions.tracks.length === 0 ? (
              <p className={`text-sm italic ${textMuted}`}>Aucun titre exclu pour l'instant — exclus-en un depuis le menu "..." d'un titre dans une playlist, ou depuis la recherche par BPM.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {exclusions.tracks.map((track, idx) => (
                  <div key={track.trackId || idx} className={`flex items-center gap-2 p-2.5 rounded-xl border ${cardBorder} ${inputBg}`}>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm truncate ${textHighlight}`} title={track.title}>{track.title}</div>
                      <div className={`text-xs truncate ${textMuted}`} title={`${track.artist}${track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}`}>{track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}</div>
                    </div>
                    {track.bpm ? <span className={`font-mono text-xs font-bold shrink-0 ${textColorClass}`}>{track.bpm} BPM</span> : null}
                    <button onClick={() => toggleTrackExclusion(track)} title="Retirer des exclusions" className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <X size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LIGNE 2 : Artistes exclus — SEUL endroit où on peut en ajouter
              un directement par son nom (pas besoin de le rencontrer
              d'abord dans une recherche/playlist) : même patron que "Top
              Artistes" dans FavoritesView.jsx, mais sans la correction
              orthographique en arrière-plan (`addFavoriteArtistValidated`)
              — pas nécessaire ici, une exclusion n'a pas besoin de
              résolution Deezer, la comparaison se fait déjà au nom tel
              quel dans `isExcludedTrack` (musicCatalog.js). */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center ${textMuted} ${isNaughtyMode ? 'dark:text-white' : ''}`}><User size={16} className="mr-2"/> Artistes Exclus</h4>
            <div className="flex flex-wrap gap-2.5 items-center">
              {exclusions.artists.map((artist) => (
                <span key={artist} className={`px-4 py-2 bg-surface-hover border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold ${textHighlight} shadow-xs flex items-center gap-2`}>
                  {artist}
                  <button onClick={() => toggleArtistExclusion(artist)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={13}/>
                  </button>
                </span>
              ))}
              {isAddingExclusionArtist ? (
                <div className={`flex items-center gap-1 ${cardBg} border ${cardBorder} rounded-xl pl-3 pr-1 py-1 shadow-xs`}>
                  <input
                    type="text" autoFocus value={newExclusionArtist} onChange={e => setNewExclusionArtist(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addExclusionArtist();
                      if (e.key === 'Escape') { setNewExclusionArtist(""); setIsAddingExclusionArtist(false); }
                    }}
                    onBlur={() => { if (!newExclusionArtist.trim()) setIsAddingExclusionArtist(false); }}
                    placeholder="Nom de l'artiste..."
                    className={`text-sm font-bold ${textHighlight} outline-hidden bg-transparent w-36`}
                  />
                  <button onClick={addExclusionArtist} className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 ${bgAccentClass}`}>
                    <Plus size={14}/>
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsAddingExclusionArtist(true)} title="Exclure un artiste" className={`w-10 h-10 rounded-full ${cardBg} border-2 border-dashed ${cardBorder} flex items-center justify-center ${textMuted} hover:text-main transition-colors shadow-xs`}>
                  <Plus size={18}/>
                </button>
              )}
            </div>
          </div>

          {/* LIGNE 3 : Genres exclus (28/08, retour direct — "prends du
              recul, pouvoir exclure un style au besoin ?") — même liste
              complète que le reste de l'app (STANDARD_GENRES + EXTRA_GENRES
              + NAUGHTY_GENRES, dédoublonnée), PAS filtrée par isNaughtyMode
              contrairement au sélecteur de FavoritesView.jsx : une
              exclusion de genre est volontairement universelle (même
              raisonnement que l'absence de cloisonnement Mode Intime pour
              artistes/titres, voir useExclusions.js) — un style qu'on ne
              veut jamais entendre ne doit pas dépendre du mode actif au
              moment où on l'a exclu. Pas de garde-fou "au moins un genre" ni
              de séparation standard/étendu : c'est une simple liste à
              cocher, pas une sélection contrainte comme dans le générateur. */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center ${textMuted} ${isNaughtyMode ? 'dark:text-white' : ''}`}><Music size={16} className="mr-2"/> Genres Exclus</h4>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...STANDARD_GENRES, ...NAUGHTY_GENRES, ...EXTRA_GENRES])).filter(g => g !== 'Autre').map(genre => {
                const isSelected = exclusions.genres.includes(genre);
                return (
                  <SelectablePill key={genre} selected={isSelected} theme={theme} onClick={() => toggleGenreExclusion(genre)}>
                    {genreDisplayLabel(genre)}
                  </SelectablePill>
                );
              })}
            </div>
          </div>
        </div>
    </div>
  );
}
