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

  // Vague 2, Chantier 3 — "description texte libre sur une playlist/routine
  // publique" (02/08). Champ COMMUN aux deux `kind` (texte libre, pas de
  // divergence de forme comme genre/durée) — pas d'extraction adaptative
  // nécessaire, contrairement au test des genres juste au-dessus.
  it('recherche textuelle sur content.description, insensible à la casse', () => {
    const playlistWithDescription = { ...playlistA, content: { ...playlistA.content, description: 'Une sortie tranquille pour bien RÉCUPÉRER après une grosse semaine.' } };
    const { result } = renderFilter([playlistWithDescription, playlistB]);
    act(() => result.current.setSearchText('récupérer'));
    expect(result.current.filteredItems).toEqual([playlistWithDescription]);
  });

  // RETIRÉ pour les routines (08/08, retour direct : "finalement pas
  // emballé par la fonctionnalité description sur les routines... on
  // conserve juste pour les playlists") — voir RoutinesView.jsx pour
  // l'historique complet. Reproduit le cas d'une ANCIENNE routine qui
  // porterait encore une description en base (jamais nettoyée
  // rétroactivement, voir la docstring du champ `description` dans
  // useProfileSearchFilter.js) : elle ne doit plus être trouvable par
  // recherche texte, cohérent avec le fait qu'elle n'est plus affichée
  // nulle part.
  it('une description de ROUTINE n\'entre PLUS dans la recherche texte, même une ancienne encore en base (retiré le 08/08, non-régression)', () => {
    const routineWithOldDescription = { ...routineDistance, content: { ...routineDistance.content, description: 'Une sortie tranquille pour bien RÉCUPÉRER après une grosse semaine.' } };
    const { result } = renderFilter([routineWithOldDescription, playlistB]);
    act(() => result.current.setSearchText('récupérer'));
    expect(result.current.filteredItems).toEqual([]);
  });


  // ⚠️ RETIRÉ (03/08, refonte onglets Playlists/Routines) — `typeFilter`
  // n'existe plus sur ce hook, voir sa docstring en tête de fichier
  // source : filtrer par `kind` est désormais la responsabilité de
  // l'APPELANT (ProfileView.jsx passe déjà `itemsForActiveTab`, un
  // tableau à un seul `kind`, jamais mélangé). Le test "recherche vide :
  // retourne tous les items, tels quels" plus haut couvre déjà
  // implicitement le fait que ce hook ne filtre PAS par `kind` lui-même
  // — un tableau mixte lui est passé et ressort intact.

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

  it('filtres combinés (texte + sport à la fois)', () => {
    const { result } = renderFilter([playlistA, playlistB, routineDistance, routineTime]);
    act(() => {
      // "sortie" matche playlistA ("Sortie Running Rapide") ET playlistB
      // ("Longue Sortie Vélo") sur le NOM seul — routineDistance/routineTime
      // n'ont pas "sortie" dans leur nom, déjà exclues par le texte.
      result.current.setSearchText('sortie');
      // Le filtre sport narrove ENSUITE ce qui reste : seule playlistB
      // (Cyclisme) passe, playlistA (Course à pied) est exclue à SON tour
      // — la preuve que les 2 filtres s'appliquent bien ensemble, pas
      // juste l'un après l'autre sans effet du second.
      result.current.setSportFilter('Cyclisme');
    });
    expect(result.current.filteredItems).toEqual([playlistB]);
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
