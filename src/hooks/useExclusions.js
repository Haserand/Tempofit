import { useState } from 'react';
import { usePersistentState } from './usePersistentState';

/**
 * useExclusions — regroupe tout ce qui concerne les artistes/titres exclus
 * ("jamais ça"), le pendant négatif de useFavorites.js ("plus souvent ça").
 *
 * RETOUR DIRECT (28/08, "un mécanisme d'exclusion — artistes ou titres qu'on
 * ne souhaite jamais avoir, alimentable depuis plusieurs points d'entrée
 * comme une playlist générée") — mécanisme miroir de useFavorites.js, mais
 * en négatif : au lieu de faire remonter en priorité, exclut totalement de
 * toute génération/recherche future. Voir `isExcludedTrack`,
 * musicCatalog.js, pour le filtre réellement appliqué dans les 2 moteurs
 * (musicEngine.js, searchEngine.js).
 *
 * ⚠️ PAS DE CLOISONNEMENT MODE INTIME (contrairement à useFavorites.js) —
 * décision délibérée, pas un oubli : les favoris sont cloisonnés parce
 * qu'un goût musical peut légitimement différer entre les 2 contextes (un
 * favori "standard" n'a pas sa place en Mode Intime, et inversement). Une
 * EXCLUSION porte un sens différent — "je ne veux JAMAIS entendre ça",
 * indépendamment du mode d'écoute au moment où le choix a été fait. Cloisonner
 * aurait signifié qu'exclure un artiste en Mode Intime ne l'empêche pas de
 * réapparaître en mode standard, ce qui va à l'encontre de l'intention même
 * du mécanisme. Une seule liste, partagée par les 2 modes.
 *
 * ⚠️ EFFET NON RÉTROACTIF (retour direct explicite, point 4 du cadrage) —
 * exclure un artiste/titre ne retire RIEN d'une playlist déjà générée et
 * sauvegardée ; ça empêche seulement son apparition dans les FUTURES
 * générations/recherches. Aucune playlist existante n'est modifiée
 * silencieusement par ce hook — cohérent avec le principe déjà appliqué
 * ailleurs sur ce projet (ex. les trophées ne sont jamais retirés
 * rétroactivement si les conditions de déblocage changent).
 *
 * ⚠️ EXCLUSIVITÉ MUTUELLE AVEC LES FAVORIS (point 5 du cadrage : "l'action
 * réalisée en dernier prime, avec un message de transition") — ce hook ne
 * connaît RIEN des favoris (aucune dépendance croisée ici, pour rester
 * découplé et testable isolément) : la coordination (retirer des favoris
 * quand on exclut, et vice versa, avec le toast de transition) vit dans
 * App.jsx, seul endroit qui a déjà accès aux DEUX hooks en même temps — même
 * principe de couche déjà appliqué pour d'autres coordinations inter-hooks
 * sur ce projet (voir la docstring de useFavorites.js sur `showToast`,
 * dépendance externe passée en paramètre plutôt que dupliquée).
 */
export function useExclusions(showToast) {
  const [exclusionsRaw, setExclusions] = usePersistentState('exclusions', () => ({
    artists: [],
    tracks: [],
    genres: [],
  }));
  // Migration défensive (28/08, chantier "exclure un style") — même principe
  // que `normalizeFavorites` (favoritesNormalize.js) : un utilisateur ayant
  // déjà des exclusions enregistrées AVANT l'ajout de `genres` (artistes/
  // titres uniquement) aurait `exclusions.genres === undefined` pour
  // toujours (l'initialiseur de `usePersistentState` ne s'exécute qu'une
  // fois, à la toute première visite jamais faite). `isExcludedTrack`
  // (musicCatalog.js) ne PLANTERAIT pas dans ce cas (`Array.isArray` vérifié
  // avant tout `.some`), mais l'exclusion par genre resterait silencieusement
  // inopérante pour ces utilisateurs sans ce filet.
  const exclusions = exclusionsRaw.genres ? exclusionsRaw : { ...exclusionsRaw, genres: [] };

  // Réglages UI de la vue "Exclusions" (ExclusionsView.jsx) — même patron
  // que `newFavArtist`/`isAddingArtist` dans useFavorites.js : préférences
  // d'affichage éphémères de la page, pas des données à conserver.
  const [newExclusionArtist, setNewExclusionArtist] = useState("");
  const [isAddingExclusionArtist, setIsAddingExclusionArtist] = useState(false);

  // Exclut/retire UNIQUEMENT l'artiste (tous ses titres avec, voir
  // `isExcludedTrack` — inutile de lister chaque titre individuellement une
  // fois l'artiste exclu). Même asymétrie assumée que
  // `toggleTrackFavorite`/`toggleArtistFavorite` (useFavorites.js) : exclure
  // un TITRE n'exclut PAS son artiste (on peut vouloir bannir un seul titre
  // précis d'un artiste qu'on apprécie par ailleurs), mais exclure un
  // ARTISTE exclut de facto tous ses titres.
  const toggleArtistExclusion = (artistName) => {
    const isExcluded = exclusions.artists.includes(artistName);
    if (isExcluded) {
      setExclusions(prev => ({ ...prev, artists: prev.artists.filter(a => a !== artistName) }));
      showToast(`"${artistName}" retiré des exclusions.`);
    } else {
      setExclusions(prev => ({ ...prev, artists: Array.from(new Set([...prev.artists, artistName])) }));
      showToast(`🚫 "${artistName}" exclu — n'apparaîtra plus dans les futures génération/recherches.`);
    }
  };

  // Exclut/retire UNIQUEMENT un titre précis (pas son artiste — voir
  // ci-dessus). Comparaison par `trackId`, même convention que
  // `toggleTrackFavorite`.
  const toggleTrackExclusion = (track) => {
    const isExcluded = exclusions.tracks.some(t => t.trackId === track.trackId);
    if (isExcluded) {
      setExclusions(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.trackId !== track.trackId) }));
      showToast("Retiré des titres exclus.");
    } else {
      setExclusions(prev => ({ ...prev, tracks: [...prev.tracks, track] }));
      showToast(`🚫 "${track.title}" exclu — n'apparaîtra plus dans les futures génération/recherches.`);
    }
  };

  // Exclut/retire un GENRE entier (28/08, retour direct — "prends du recul,
  // pouvoir exclure un style au besoin ?") — voir la docstring de
  // `isExcludedTrack`, musicCatalog.js, pour le raisonnement complet
  // (surtout utile quand aucun genre n'est demandé, ou pour une sélection
  // large "tout sauf X"). Pas de coordination avec les favoris ici,
  // contrairement à `toggleArtistExclusion`/`toggleTrackExclusion` — un
  // genre entier n'est jamais "un favori" au sens de useFavorites.js
  // (favoris = artistes/titres précis), aucune transition possible.
  const toggleGenreExclusion = (genre) => {
    const isExcluded = exclusions.genres.includes(genre);
    if (isExcluded) {
      setExclusions(prev => ({ ...prev, genres: prev.genres.filter(g => g !== genre) }));
      showToast(`"${genre}" retiré des genres exclus.`);
    } else {
      setExclusions(prev => ({ ...prev, genres: Array.from(new Set([...prev.genres, genre])) }));
      showToast(`🚫 Genre "${genre}" exclu — n'apparaîtra plus dans les futures génération/recherches.`);
    }
  };

  return {
    exclusions, setExclusions,
    newExclusionArtist, setNewExclusionArtist,
    isAddingExclusionArtist, setIsAddingExclusionArtist,
    toggleArtistExclusion, toggleTrackExclusion, toggleGenreExclusion,
  };
}
