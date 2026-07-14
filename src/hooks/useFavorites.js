import { useState } from 'react';
import { deezerFetch } from '../musicEngine';
import { usePersistentState } from './usePersistentState';

/**
 * useFavorites — regroupe tout ce qui concerne les favoris (titres, artistes,
 * et les réglages BPM/genre propres à la page "Mes Favoris").
 *
 * Avant ce hook, ces ~10 `useState` et leurs 3 fonctions vivaient éparpillés
 * dans App.jsx, mélangés avec tout le reste. Regroupés ici : App.jsx n'a plus
 * qu'à appeler `useFavorites(showToast)` et redistribuer le résultat aux vues
 * qui en ont besoin (FavoritesView, PlaylistDetailView, GeneratorView...).
 *
 * `showToast` est une dépendance externe (définie dans App.jsx, utilisée par
 * beaucoup d'autres fonctions ailleurs dans l'app) — elle est passée en
 * paramètre plutôt que dupliquée ici, pour garder un seul système de toast.
 *
 * `favorites` (les vraies données) est persistant via usePersistentState —
 * les réglages du sélecteur BPM/genre juste en dessous restent de simples
 * `useState` volontairement : ce sont des préférences d'affichage éphémères
 * de la page, pas des données à conserver d'une session à l'autre.
 */
export function useFavorites(showToast) {
  const [favorites, setFavorites] = usePersistentState('favorites', () => ({
    useFavorites: true,
    artists: ['Metallica', 'System Of A Down'],
    tracks: [
      { youtubeId: 'uRyAIyq53FY', title: 'Master of Puppets', artist: 'Metallica', bpm: 212, duration: 515, preview: null, genre: 'Métal' },
      { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', bpm: 128, duration: 210, preview: null, genre: 'Métal' }
    ]
  }));
  // Réglages du sélecteur BPM/genre propre à la page Cœur & Favoris (indépendant
  // de ceux du wizard de génération, qui a son propre contexte bpm/selectedGenres).
  const [favBpmTarget, setFavBpmTarget] = useState(140);
  const [favBpmTolerance, setFavBpmTolerance] = useState(10);
  const [favSelectedGenres, setFavSelectedGenres] = useState(['Métal']);
  const [newFavArtist, setNewFavArtist] = useState("");
  const [isAddingArtist, setIsAddingArtist] = useState(false);

  /**
   * Ajoute un artiste aux favoris de façon OPTIMISTE : le nom tapé apparaît
   * immédiatement (aucune latence perçue, aucun blocage possible), puis une
   * recherche Deezer tourne en arrière-plan pour corriger discrètement
   * l'orthographe si un artiste correspondant est trouvé sous un nom
   * légèrement différent (ex. casse, accents). Si Deezer ne répond pas ou ne
   * trouve rien, le nom tapé reste tel quel — jamais de blocage, jamais
   * d'attente visible.
   */
  const addFavoriteArtistValidated = (rawName) => {
    const query = rawName.trim();
    if (!query) return;

    // 1. Ajout immédiat, sans attendre quoi que ce soit.
    setFavorites(prev => ({ ...prev, artists: Array.from(new Set([...prev.artists, query])) }));
    showToast(`🎵 ${query} ajouté à tes artistes favoris !`);
    setNewFavArtist("");
    setIsAddingArtist(false);

    // 2. Correction discrète en arrière-plan (ne bloque plus rien, pas de toast
    // supplémentaire pour rester discret — juste le nom qui se corrige si besoin).
    (async () => {
      try {
        const { data } = await deezerFetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=1`);
        const match = data && Array.isArray(data.data) ? data.data[0] : null;
        if (match && match.name && match.name.toLowerCase() !== query.toLowerCase()) {
          setFavorites(prev => ({
            ...prev,
            artists: Array.from(new Set(prev.artists.map(a => a === query ? match.name : a)))
          }));
        }
      } catch (e) {
        // Échec silencieux : le nom tapé reste tel quel (voir docstring).
      }
    })();
  };

  // Favorise titre + artiste ensemble, depuis une playlist générée — distinct de
  // "Retirer de la proposition" (qui enlève le titre de CETTE playlist) : ici
  // on ne touche pas à la playlist en cours, seulement à la liste de favoris.
  // Asymétrie assumée : ajouter un titre ajoute aussi son artiste aux artistes
  // favoris, mais retirer un titre NE retire PAS l'artiste (on peut très bien
  // vouloir garder l'artiste en favori tout en retirant un titre précis qui ne
  // convient pas).
  const toggleTrackFavorite = (track) => {
    const isFav = favorites.tracks.some(t => t.youtubeId === track.youtubeId);
    if (isFav) {
      setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.youtubeId !== track.youtubeId) }));
      showToast("Retiré de tes favoris.");
    } else {
      setFavorites(prev => ({
        ...prev,
        artists: Array.from(new Set([...prev.artists, track.artist])),
        tracks: [...prev.tracks, track]
      }));
      showToast("⭐ Ajouté à tes favoris !");
    }
  };

  // Ajoute/retire UNIQUEMENT l'artiste des favoris (pas le titre) — complète
  // toggleTrackFavorite ci-dessus, qui lui favorise toujours titre+artiste
  // ensemble. Cas réel visé : un artiste qui plaît globalement, sans que CE
  // titre précis de la playlist soit un coup de cœur.
  const toggleArtistFavorite = (artistName) => {
    const isFav = favorites.artists.includes(artistName);
    if (isFav) {
      setFavorites(prev => ({ ...prev, artists: prev.artists.filter(a => a !== artistName) }));
      showToast(`"${artistName}" retiré des artistes favoris.`);
    } else {
      setFavorites(prev => ({ ...prev, artists: Array.from(new Set([...prev.artists, artistName])) }));
      showToast(`⭐ "${artistName}" ajouté aux artistes favoris.`);
    }
  };

  return {
    favorites, setFavorites,
    favBpmTarget, setFavBpmTarget,
    favBpmTolerance, setFavBpmTolerance,
    favSelectedGenres, setFavSelectedGenres,
    newFavArtist, setNewFavArtist,
    isAddingArtist, setIsAddingArtist,
    addFavoriteArtistValidated, toggleTrackFavorite, toggleArtistFavorite,
  };
}
