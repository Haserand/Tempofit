// @vitest-environment jsdom
//
// Premier fichier de test pour usePlaylistGeneration.js (aucun test dédié
// n'existait avant ce chantier — `createPlaylistData`/`useGeneratorContext`
// jamais mockés dans le projet jusqu'ici pour ce hook). Ciblé UNIQUEMENT sur
// le correctif de course ajouté au check-up du 10/08 (même famille que
// PlaylistDetailView.jsx/PlaylistDetailContext.jsx, mêmes jour) — pas une
// couverture exhaustive de `executeGeneration` (détection de trophées liés à
// la config, calcul de durée, historique de routine...), hors périmètre ici.
//
// `isGenerating` ne bloque QUE l'affichage d'un bandeau (voir App.jsx) —
// rien n'empêche de renommer/cloner/supprimer une AUTRE playlist, ou de
// débloquer un trophée par une autre action, PENDANT qu'une génération
// tourne encore (potentiellement plusieurs dizaines de secondes pour un gros
// lot). Les 3 tests ci-dessous simulent chacun un changement CONCURRENT
// (routines/userStats/savedPlaylists) survenant PENDANT que
// `executeGeneration` attend son appel réseau (`createPlaylistData`, mocké
// avec une promesse contrôlée manuellement), et vérifient que le résultat
// final utilise bien la version la PLUS FRAÎCHE, pas celle figée au moment
// du clic sur "Générer".

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockCreatePlaylistData = vi.fn();
vi.mock('../../src/engine/musicEngine.js', () => ({
  createPlaylistData: (...args) => mockCreatePlaylistData(...args),
}));

const mockCheckGenreWeightDeviation = vi.fn(() => null);
vi.mock('../../src/contexts/GeneratorContext.jsx', () => ({
  useGeneratorContext: () => ({ checkGenreWeightDeviation: mockCheckGenreWeightDeviation }),
}));

import { usePlaylistGeneration } from '../../src/hooks/usePlaylistGeneration.js';

afterEach(() => {
  vi.clearAllMocks();
});

function createDeferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function makeFakePlaylist(overrides = {}) {
  return { name: 'Séance test', tracks: [], fallbackTrackCount: 0, ...overrides };
}

// Config minimale valide (mode Temps, 45 minutes) — juste assez pour que
// `computedDurationSecs > 0` et que executeGeneration ne s'arrête pas
// immédiatement sur le garde-fou "distance/durée vide".
const validConfig = { targetMode: 'time', hours: 0, minutes: 45, isIntervalMode: false, selectedGenres: [] };

function renderGenerationHook(initialProps) {
  return renderHook(
    (props) => usePlaylistGeneration(
      props.showToast, props.userStats, props.checkTrophies,
      props.routines, props.setRoutines,
      props.favorites, props.spotifyTrackPool, props.isNaughtyMode,
      props.setCurrentPlaylist, props.changeView,
      props.savedPlaylists, props.setSavedPlaylists,
      props.setIsGenerating, props.setGeneratingTotal, props.setGeneratingDone, props.setIsGeneratingSlowGenre,
    ),
    { initialProps }
  );
}

function baseProps(overrides = {}) {
  return {
    showToast: vi.fn(),
    userStats: { hasMarathon: false, hasBolt: false, hasHiitMaster: false, hasRickroll: false, hasExtraGenre: false, hasUsedFavorites: false, usedStructureKinds: [] },
    checkTrophies: vi.fn(),
    routines: [{ id: 'routine-A', manualGenerations: 0, recentTrackIds: [] }],
    setRoutines: vi.fn(),
    favorites: { tracks: [], artists: [] },
    spotifyTrackPool: [],
    isNaughtyMode: false,
    setCurrentPlaylist: vi.fn(),
    changeView: vi.fn(),
    savedPlaylists: [{ id: 'existing-1' }],
    setSavedPlaylists: vi.fn(),
    setIsGenerating: vi.fn(),
    setGeneratingTotal: vi.fn(),
    setGeneratingDone: vi.fn(),
    setIsGeneratingSlowGenre: vi.fn(),
    ...overrides,
  };
}

describe('usePlaylistGeneration — course "Générer" / changement concurrent en cours de route (régression 10/08)', () => {
  it('setRoutines utilise routinesRef.current (le plus FRAIS), pas le tableau figé au début de la génération', async () => {
    const setRoutines = vi.fn();
    const deferred = createDeferred();
    mockCreatePlaylistData.mockImplementationOnce(() => deferred.promise);

    const { result, rerender } = renderGenerationHook(
      baseProps({ setRoutines, routines: [{ id: 'routine-A', manualGenerations: 0, recentTrackIds: [] }] })
    );

    let generationPromise;
    act(() => {
      generationPromise = result.current.executeGeneration(validConfig, 1, 'routine-A');
    });

    // Une AUTRE routine est ajoutée ailleurs (ex. "Créer une routine" sur un
    // autre écran) PENDANT que la recherche réseau de CETTE génération
    // tourne encore — rerender avec un `routines` différent, sans que ça
    // affecte la génération en cours.
    const routinesWithConcurrentAdd = [
      { id: 'routine-A', manualGenerations: 0, recentTrackIds: [] },
      { id: 'routine-B-added-concurrently', manualGenerations: 0, recentTrackIds: [] },
    ];
    rerender(baseProps({ setRoutines, routines: routinesWithConcurrentAdd }));

    deferred.resolve(makeFakePlaylist());
    await act(async () => { await generationPromise; });

    expect(setRoutines).toHaveBeenCalledTimes(1);
    const applied = setRoutines.mock.calls[0][0];
    // routine-B, ajoutée APRÈS le début de cette génération, doit survivre —
    // sans le correctif, elle aurait disparu (tableau reconstruit à partir
    // du `routines` figé au clic, qui ne la contenait pas encore).
    expect(applied.some(r => r.id === 'routine-B-added-concurrently')).toBe(true);
    // routine-A, la cible réelle de cette génération, doit bien porter la
    // mise à jour attendue.
    expect(applied.find(r => r.id === 'routine-A').manualGenerations).toBe(1);
  });

  it('checkTrophies est rebasé sur userStatsRef.current (le plus FRAIS), sans écraser un changement de stats concurrent', async () => {
    const checkTrophies = vi.fn();
    const deferred = createDeferred();
    mockCreatePlaylistData.mockImplementationOnce(() => deferred.promise);

    const { result, rerender } = renderGenerationHook(
      baseProps({ checkTrophies, userStats: { hasMarathon: false, hasBolt: false, hasHiitMaster: false, hasRickroll: false, hasExtraGenre: false, hasUsedFavorites: false, usedStructureKinds: [] } })
    );

    let generationPromise;
    // "Rick Astley" dans le nom déclenche le trophée hasRickroll — trophée
    // RÉELLEMENT lié à CETTE génération, doit être appliqué.
    act(() => {
      generationPromise = result.current.executeGeneration({ ...validConfig, workoutName: 'Session Rick Astley' }, 1);
    });

    // Un AUTRE trophée (hasBolt) est débloqué ailleurs PENDANT cette
    // génération (ex. une séance différente terminée à un rythme très
    // rapide) — n'a AUCUN rapport avec cette génération-ci.
    const userStatsWithConcurrentUnlock = { hasMarathon: false, hasBolt: true, hasHiitMaster: false, hasRickroll: false, hasExtraGenre: false, hasUsedFavorites: false, usedStructureKinds: [] };
    rerender(baseProps({ checkTrophies, userStats: userStatsWithConcurrentUnlock }));

    deferred.resolve(makeFakePlaylist());
    await act(async () => { await generationPromise; });

    expect(checkTrophies).toHaveBeenCalledTimes(1);
    const applied = checkTrophies.mock.calls[0][0];
    // Les deux doivent être vrais : hasBolt (changement concurrent, ne doit
    // PAS être écrasé) ET hasRickroll (le trophée réellement débloqué par
    // CETTE génération).
    expect(applied.hasBolt).toBe(true);
    expect(applied.hasRickroll).toBe(true);
  });

  it('setSavedPlaylists (lot de plusieurs playlists) utilise savedPlaylistsRef.current (le plus FRAIS), pas le tableau figé au début', async () => {
    const setSavedPlaylists = vi.fn();
    const deferred = createDeferred();
    mockCreatePlaylistData
      .mockImplementationOnce(() => deferred.promise) // 1re playlist du lot — en attente
      .mockResolvedValue(makeFakePlaylist()); // 2e playlist du lot — résolution immédiate

    const { result, rerender } = renderGenerationHook(
      baseProps({ setSavedPlaylists, savedPlaylists: [{ id: 'existing-1' }] })
    );

    let generationPromise;
    act(() => {
      generationPromise = result.current.executeGeneration(validConfig, 2); // lot de 2
    });

    // Une AUTRE playlist est sauvegardée ailleurs PENDANT que la 1re playlist
    // de ce lot est encore en cours de recherche réseau.
    const savedPlaylistsWithConcurrentAdd = [{ id: 'existing-1' }, { id: 'concurrent-add' }];
    rerender(baseProps({ setSavedPlaylists, savedPlaylists: savedPlaylistsWithConcurrentAdd }));

    deferred.resolve(makeFakePlaylist());
    // Pause volontaire de 1s entre 2 playlists d'un même lot
    // (executeGeneration, voir sa docstring) — bien réelle ici, pas de faux
    // timers utilisés dans ce fichier (risque d'interaction fragile avec les
    // micro-tâches des promesses non résolu de façon fiable sans exécution
    // réelle pour vérifier) : ce test attend donc ~1s pour de vrai.
    await act(async () => { await generationPromise; });

    expect(setSavedPlaylists).toHaveBeenCalledTimes(1);
    const applied = setSavedPlaylists.mock.calls[0][0];
    // "concurrent-add", ajoutée APRÈS le début de ce lot, doit survivre.
    expect(applied.some(p => p.id === 'concurrent-add')).toBe(true);
    // Les 2 playlists fraîchement générées par ce lot doivent bien être là
    // — nom suffixé "(Session N)" pour count > 1, voir executeGeneration.
    expect(applied.filter(p => p.name && p.name.startsWith('Séance test'))).toHaveLength(2);
  }, 10000);
});
