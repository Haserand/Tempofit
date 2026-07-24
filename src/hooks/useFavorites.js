import { useState, useEffect } from 'react';
import { deezerFetch } from '../musicEngine';
import { usePersistentState } from './usePersistentState';
import { normalizeFavorites } from '../utils/favoritesNormalize';

/**
 * useFavorites — regroupe tout ce qui concerne les favoris (titres, artistes,
 * et les réglages BPM/genre propres à la page "Mes Favoris").
 *
 * Avant ce hook, ces ~10 `useState` et leurs 3 fonctions vivaient éparpillés
 * dans App.jsx, mélangés avec tout le reste. Regroupés ici : App.jsx n'a plus
 * qu'à appeler `useFavorites(showToast, isNaughtyMode)` et redistribuer le
 * résultat aux vues qui en ont besoin (FavoritesView, PlaylistDetailView,
 * GeneratorView...).
 *
 * `showToast` est une dépendance externe (définie dans App.jsx, utilisée par
 * beaucoup d'autres fonctions ailleurs dans l'app) — elle est passée en
 * paramètre plutôt que dupliquée ici, pour garder un seul système de toast.
 *
 * `favorites` (les vraies données) est persistant via usePersistentState —
 * les réglages du sélecteur BPM/genre juste en dessous restent de simples
 * `useState` volontairement : ce sont des préférences d'affichage éphémères
 * de la page, pas des données à conserver d'une session à l'autre.
 *
 * CLOISONNEMENT MODE INTIME (retour direct : "les titres hard-rock comme
 * AC/DC s'affichent même en Mode Intime, ça casse l'immersion") — même
 * principe que le pare-feu déjà appliqué aux playlists/routines/Découvrir :
 * DEUX listes séparées (`standard`/`naughty`), jamais une seule liste
 * partagée filtrée après coup (une liste plate n'a ici aucun champ
 * `isNaughty` par titre à filtrer, contrairement aux playlists — la
 * distinction doit donc vivre au niveau du STOCKAGE, pas du rendu).
 * `favorites` (retourné plus bas) reste un objet PLAT `{useFavorites,
 * artists, tracks}` comme avant, dérivé du bucket actif : aucun des
 * nombreux consommateurs existants (TrackItem.jsx, Sidebar.jsx,
 * GeneratorView.jsx...) n'a besoin de changer, ils continuent de lire
 * `favorites.tracks`/`favorites.artists` exactement comme avant.
 */
export function useFavorites(showToast, isNaughtyMode) {
  // RETOUR DIRECT ("par défaut, est-ce pertinent de pousser vers Métal, plutôt
  // dur à identifier ?") — 'Métal' est explicitement documenté dans
  // musicCatalog.js (`GENRES_NEEDING_DEEP_CATALOG_SEARCH`) comme un genre
  // fragile à rechercher : Deezer classe la quasi-totalité des titres Metal
  // réels sous "Rock" dans son propre système de genres, jamais "Metal" — la
  // recherche pour ce genre dépend donc d'un renfort par catalogue d'artistes,
  // plus lent et plus sujet aux erreurs de correspondance (voir le bug
  // "Infected Rain"/"Mental Crush" de la passation précédente). Basculé sur
  // Rock, qui n'a pas ce problème — mêmes titres déjà validés que la playlist
  // de démo (voir App.jsx, `ex-track-1`/`ex-track-4`), pas de nouvel ID
  // YouTube inventé ici.
  const [allFavorites, setAllFavorites] = usePersistentState('favorites', () => ({
    useFavorites: true,
    standard: {
      artists: ['The Killers', 'AC/DC'],
      tracks: [
        { trackId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', bpm: 148, duration: 222, preview: null, genre: 'Rock' },
        { trackId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', bpm: 133, duration: 292, preview: null, genre: 'Rock' }
      ]
    },
    // Mêmes titres exactement que "Late Night R&B" (App.jsx, playlist
    // d'exemple Mode Intime) — continuité du contenu factice plutôt que
    // d'inventer un 3e jeu de titres pour la même ambiance. Genre canonique
    // de NAUGHTY_GENRES (musicCatalog.js), pas inventé.
    naughty: {
      artists: ['Sade', 'Miguel'],
      tracks: [
        { trackId: 'nex1-2', title: 'No Ordinary Love', artist: 'Sade', bpm: 68, duration: 293, preview: null, genre: 'R&B Sensuel' },
        { trackId: 'nex1-1', title: 'Adorn', artist: 'Miguel', bpm: 65, duration: 205, preview: null, genre: 'R&B Sensuel' }
      ]
    }
  }));

  // Migration défensive — voir la docstring de normalizeFavorites
  // (utils/favoritesNormalize.js, extraite d'ici pour être testable
  // isolément). Jamais de perte des favoris déjà enregistrés par un
  // utilisateur existant.
  const normalized = normalizeFavorites(allFavorites);

  const bucketKey = isNaughtyMode ? 'naughty' : 'standard';
  const favorites = { useFavorites: normalized.useFavorites, ...normalized[bucketKey] };
  const setFavorites = (updater) => {
    setAllFavorites(prev => {
      const prevNormalized = normalizeFavorites(prev);
      const currentBucket = { useFavorites: prevNormalized.useFavorites, ...prevNormalized[bucketKey] };
      const updated = typeof updater === 'function' ? updater(currentBucket) : updater;
      const { useFavorites: newUseFavorites, ...bucketFields } = updated;
      return { ...prevNormalized, useFavorites: newUseFavorites, [bucketKey]: bucketFields };
    });
  };

  // Réglages du sélecteur BPM/genre propre à la page Cœur & Favoris (indépendant
  // de ceux du wizard de génération, qui a son propre contexte bpm/selectedGenres).
  const [favBpmTarget, setFavBpmTarget] = useState(140);
  const [favBpmTolerance, setFavBpmTolerance] = useState(10);
  const [favSelectedGenres, setFavSelectedGenres] = useState(['Rock']);
  const [newFavArtist, setNewFavArtist] = useState("");
  const [isAddingArtist, setIsAddingArtist] = useState(false);

  // Le genre par défaut ('Rock') n'existe pas dans NAUGHTY_GENRES — sans ce
  // filet, basculer en Mode Intime laissait un genre sélectionné invisible
  // dans la liste de pilules proposée (ni vraiment sélectionné à l'écran, ni
  // vraiment vide). Réaligné sur le mode actif à chaque bascule, même
  // principe que la synchronisation `statsMode`/`isNaughtyMode` de
  // StatsView.jsx.
  useEffect(() => {
    setFavSelectedGenres(isNaughtyMode ? ['R&B Sensuel'] : ['Rock']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNaughtyMode]);

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
    const isFav = favorites.tracks.some(t => t.trackId === track.trackId);
    if (isFav) {
      setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.trackId !== track.trackId) }));
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
