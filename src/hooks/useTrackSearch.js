import { useState } from 'react';

// Message affiché pendant la recherche — tiré au sort à chaque nouvelle
// recherche, parmi une petite liste, pour rester dans le ton ludique déjà
// présent ailleurs dans l'app (trophées, Mode Intime...) plutôt qu'un
// "Recherche en cours..." neutre et répété à chaque clic. Exporté pour que
// App.jsx (qui garde `searchWorldMusicApi`, trop volumineuse et imbriquée
// pour être déplacée ce soir) puisse toujours y piocher un message au hasard.
export const SEARCH_LOADING_MESSAGES = [
  "On fouille chez Deezer...",
  "Ça arrive, promis...",
  "Un peu de patience, le rythme se cherche...",
  "On compte les BPM...",
  "On tend l'oreille...",
  "Ça chauffe les enceintes...",
  "Recherche du bon tempo en cours..."
];

/**
 * useTrackSearch — regroupe les variables d'état de la modale de recherche
 * manuelle de titre (texte tapé, résultats, pagination, mode BPM...).
 *
 * ⚠️ Contrairement aux hooks précédents, celui-ci ne contient QUE de l'état,
 * pas la logique (pas de `searchWorldMusicApi`, `searchTracksByBpm`,
 * `closeSearchModal`, `handleAddManualTrack`...). Ces fonctions sont énormes,
 * fortement imbriquées entre elles et avec d'autres domaines (favoris,
 * playlist en cours, génération...) — les y intégrer aurait été un
 * changement à bien plus haut risque qu'un simple regroupement de state.
 * Elles restent dans App.jsx, et continuent de lire/écrire les valeurs
 * renvoyées par ce hook exactement comme avant (mêmes noms de variables).
 */
export function useTrackSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isWorldSearching, setIsWorldSearching] = useState(false);
  const [worldSearchResults, setWorldSearchResults] = useState([]);
  // Libellé de contexte affiché au-dessus des résultats quand ils viennent
  // d'une recherche par artiste plutôt que par titre direct (ex. "Top titres
  // de Daft Punk").
  const [resultsContextLabel, setResultsContextLabel] = useState(null);
  // true si la recherche n'a rien donné du tout (aucun titre, aucun artiste
  // connu, ou aucun des titres trouvés n'a de BPM renseigné par Deezer).
  const [noUsableResultsHint, setNoUsableResultsHint] = useState(false);
  // true quand la modale de recherche est en mode "BPM précis" (déclenchée
  // depuis le générateur) plutôt qu'en mode recherche libre par texte.
  const [isBpmSearchMode, setIsBpmSearchMode] = useState(false);
  // Décalage (paramètre `index` de l'API Deezer) pour le PROCHAIN appel "Voir
  // plus" — pas la page actuellement affichée, mais celle qu'il reste à charger.
  const [searchResultsOffset, setSearchResultsOffset] = useState(0);
  // true tant que Deezer indique qu'il reste des résultats au-delà de ceux
  // déjà chargés.
  const [searchHasMoreResults, setSearchHasMoreResults] = useState(false);
  // Spinner dédié au bouton "Voir plus" — distinct de isWorldSearching (qui
  // vide toute la liste pendant le chargement) pour ne pas faire disparaître
  // les résultats déjà affichés pendant qu'on en charge d'autres à la suite.
  const [isLoadingMoreResults, setIsLoadingMoreResults] = useState(false);
  // Non-null seulement si la recherche initiale a identifié avec confiance un
  // artiste correspondant au texte tapé.
  const [searchActiveArtistName, setSearchActiveArtistName] = useState(null);
  // youtubeId du titre actuellement en cours de correction manuelle de BPM
  // dans la modale de recherche — null si aucune édition en cours.
  const [editingBpmId, setEditingBpmId] = useState(null);
  const [searchLoadingMessage, setSearchLoadingMessage] = useState(SEARCH_LOADING_MESSAGES[0]);
  // Réserve CACHÉE des titres qui matchent le texte tapé mais PAS l'artiste
  // identifié (ex. "Starboy" pour "daft punk", où Daft Punk n'est que
  // co-producteur). Jamais affichée tant qu'il reste de vrais titres de
  // l'artiste à montrer ou des pages Deezer non explorées ; révélée seulement
  // une fois la recherche générale épuisée.
  const [worldSearchOtherResults, setWorldSearchOtherResults] = useState([]);
  // Mémorise les paramètres (bpm, tolérance, genres) de la dernière recherche
  // par BPM lancée, quel que soit l'endroit d'où elle a été déclenchée
  // (wizard ou page Favoris) — permet à la modale d'afficher le bon contexte
  // et de relancer une recherche identique via le bouton "actualiser".
  const [bpmSearchParams, setBpmSearchParams] = useState({ bpm: 140, tolerance: 10, genres: [] });

  return {
    searchQuery, setSearchQuery,
    isWorldSearching, setIsWorldSearching,
    worldSearchResults, setWorldSearchResults,
    resultsContextLabel, setResultsContextLabel,
    noUsableResultsHint, setNoUsableResultsHint,
    isBpmSearchMode, setIsBpmSearchMode,
    searchResultsOffset, setSearchResultsOffset,
    searchHasMoreResults, setSearchHasMoreResults,
    isLoadingMoreResults, setIsLoadingMoreResults,
    searchActiveArtistName, setSearchActiveArtistName,
    editingBpmId, setEditingBpmId,
    searchLoadingMessage, setSearchLoadingMessage,
    worldSearchOtherResults, setWorldSearchOtherResults,
    bpmSearchParams, setBpmSearchParams,
  };
}
