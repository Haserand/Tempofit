// @vitest-environment jsdom
//
// Test dédié à useProfileSearchFilter.js — recherche/filtres 100%
// client-side sur la grille combinée playlists+routines de
// ProfileView.jsx. Rien à mocker (aucune dépendance à un Context React,
// `getGenresForDisplay`/`genreDisplayLabel` sont des fonctions pures de
// musicCatalog.js) — seul `renderHook`/`act` (@testing-library/react) sont
// nécessaires, même convention que useShare.test.js.
//
// Le cas "item intime glissé dans le tableau source" (voir le brief) N'EST
// PAS testé ici : ce hook n'a lui-même aucune connaissance de
// `is_intimate`, le verrou est testé à l'intégration dans
// ProfileView.test.jsx.

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useProfileSearchFilter } from '../../src/hooks/useProfileSearchFilter.js';

afterEach(() => {
  cleanup();
});

// `kind` posé à la main sur chaque item, comme le fait ProfileView.jsx en
// combinant `visiblePlaylists`/`visibleRoutines` avant de les passer à ce
// hook — les lignes brutes `playlists`/`routines` n'ont pas ce champ.
const playlistA = {
  id: 'pl-a', kind: 'playlist',
  content: {
    name: 'Sortie Running Rapide', workoutType: 'Course à pied', totalDuration: 1200, // 20 min
    tracks: [{ genre: 'metal', artist: 'X', title: 'Y' }],
  },
};
const playlistB = {
  id: 'pl-b', kind: 'playlist',
  content: {
    name: 'Longue Sortie Vélo', workoutType: 'Cyclisme', totalDuration: 5400, // 90 min
    tracks: [{ genre: 'electro', artist: 'X', title: 'Y' }],
  },
};
const routineDistance = {
  id: 'routine-a', kind: 'routine',
  content: {
    name: 'Mon 10km', workoutType: 'Course à pied', targetMode: 'distance',
    distanceVal: 10, distanceUnit: 'km', bpm: 170, selectedGenres: ['Rock'],
  },
};
const routineTime = {
  id: 'routine-b', kind: 'routine',
  content: {
    name: 'HIIT Express', workoutType: 'Fractionné', targetMode: 'time',
    hours: 0, minutes: 20, bpm: 175, selectedGenres: ['Hip-Hop'],
  },
};

function renderFilter(items) {
  return renderHook(({ items }) => useProfileSearchFilter(items), { initialProps: { items } });
}

describe('useProfileSearchFilter', () => {
  it('recherche vide : retourne tous les items, tels quels', () => {
    const { result } = renderFilter([playlistA, playlistB, routineDistance, routineTime]);
    expect(result.current.filteredItems).toEqual([playlistA, playlistB, routineDistance, routineTime]);
  });

  it('recherche textuelle insensible à la casse, sur le nom', () => {
    const { result } = renderFilter([playlistA, playlistB]);
    act(() => result.current.setSearchText('RUNNING'));
    expect(result.current.filteredItems).toEqual([playlistA]);
  });

  it('recherche textuelle sur workoutType', () => {
    const { result } = renderFilter([playlistA, playlistB]);
    act(() => result.current.setSearchText('cyclisme'));
    expect(result.current.filteredItems).toEqual([playlistB]);
  });

  it('recherche textuelle sur les genres — extraction adaptative : tracks pour une playlist, selectedGenres direct pour une routine', () => {
    const { result } = renderFilter([playlistA, routineDistance]);
    act(() => result.current.setSearchText('rock'));
    // playlistA a un genre "metal" (via getGenresForDisplay sur son unique
    // titre) — ne matche PAS "rock". routineDistance a selectedGenres:
    // ['Rock'] — matche directement, sans aucun titre à parcourir.
    expect(result.current.filteredItems).toEqual([routineDistance]);
  });

  it('filtre par type (kind) : "routine" n\'affiche que les routines', () => {
    const { result } = renderFilter([playlistA, routineDistance, routineTime]);
    act(() => result.current.setTypeFilter('routine'));
    expect(result.current.filteredItems).toEqual([routineDistance, routineTime]);
  });

  it('filtre par sport, valeurs disponibles générées dynamiquement à partir des items affichés', () => {
    const { result } = renderFilter([playlistA, playlistB, routineDistance]);
    expect(result.current.availableSports.sort()).toEqual(['Course à pied', 'Cyclisme'].sort());
    act(() => result.current.setSportFilter('Cyclisme'));
    expect(result.current.filteredItems).toEqual([playlistB]);
  });

  it('filtre par durée : une playlist utilise totalDuration réel', () => {
    const { result } = renderFilter([playlistA, playlistB]);
    act(() => result.current.setDurationFilter('short')); // < 30 min
    expect(result.current.filteredItems).toEqual([playlistA]);
  });

  it('filtre par durée : une routine en mode "time" convertit hours/minutes en minutes', () => {
    const { result } = renderFilter([playlistB, routineTime]);
    act(() => result.current.setDurationFilter('short')); // < 30 min
    expect(result.current.filteredItems).toEqual([routineTime]);
  });

  it('filtre par durée : une routine en mode "distance" est exclue de TOUT bucket précis (pas de conversion approximative)', () => {
    const { result } = renderFilter([routineDistance]);
    act(() => result.current.setDurationFilter('short'));
    expect(result.current.filteredItems).toEqual([]);
    act(() => result.current.setDurationFilter('medium'));
    expect(result.current.filteredItems).toEqual([]);
    act(() => result.current.setDurationFilter('long'));
    expect(result.current.filteredItems).toEqual([]);
    // Mais reste visible tant que le filtre est sur "Toutes".
    act(() => result.current.setDurationFilter('all'));
    expect(result.current.filteredItems).toEqual([routineDistance]);
  });

  it('filtres combinés (texte + sport + type à la fois)', () => {
    const { result } = renderFilter([playlistA, playlistB, routineDistance, routineTime]);
    act(() => {
      result.current.setSearchText('course');
      result.current.setTypeFilter('routine');
    });
    expect(result.current.filteredItems).toEqual([routineDistance]);
  });

  it('hasActiveFilters reflète l\'état réel des filtres', () => {
    const { result } = renderFilter([playlistA]);
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => result.current.setSearchText('x'));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('resetFilters remet tout à zéro et retourne l\'ensemble complet des items', () => {
    const { result } = renderFilter([playlistA, playlistB]);
    act(() => {
      result.current.setSearchText('running');
      result.current.setSportFilter('Course à pied');
    });
    expect(result.current.filteredItems).toEqual([playlistA]);
    act(() => result.current.resetFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredItems).toEqual([playlistA, playlistB]);
  });
});
