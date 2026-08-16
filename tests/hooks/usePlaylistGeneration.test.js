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
      props.setIsGeneratingLongPlaylist, props.setGeneratingEstimatedTracksFound,
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
    setIsGeneratingLongPlaylist: vi.fn(),
    setGeneratingEstimatedTracksFound: vi.fn(),
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

// NOUVEAU (14/08, retour direct — "l'utilisateur a cru que ça avait planté"
// sur une séance de plus d'1h) — même principe que `isGeneratingSlowGenre`
// (déjà dans ce hook, pas testé directement ici non plus, hors périmètre de
// ce fichier avant ce chantier) : voir la docstring de `executeGeneration`
// pour le raisonnement complet (seuil, mode Fractionné hors scope).
describe('usePlaylistGeneration — isGeneratingLongPlaylist (NOUVEAU, 14/08)', () => {
  function immediateProps(overrides = {}) {
    // `createPlaylistData` résout IMMÉDIATEMENT ici (contrairement aux
    // tests de course plus haut, qui ont besoin d'une promesse contrôlée) —
    // seul le state POSÉ AU DÉBUT de `executeGeneration` nous intéresse
    // dans cette section, pas une course avec un changement concurrent.
    mockCreatePlaylistData.mockResolvedValue(makeFakePlaylist());
    return baseProps(overrides);
  }

  it('mode Temps, ≥45 minutes : pose isGeneratingLongPlaylist(true)', async () => {
    const setIsGeneratingLongPlaylist = vi.fn();
    const { result } = renderGenerationHook(immediateProps({ setIsGeneratingLongPlaylist }));

    await act(async () => {
      await result.current.executeGeneration({ targetMode: 'time', hours: 1, minutes: 0, isIntervalMode: false, selectedGenres: [] }, 1);
    });

    expect(setIsGeneratingLongPlaylist).toHaveBeenCalledWith(true);
  });

  it('mode Temps, < 45 minutes : pose isGeneratingLongPlaylist(false)', async () => {
    const setIsGeneratingLongPlaylist = vi.fn();
    const { result } = renderGenerationHook(immediateProps({ setIsGeneratingLongPlaylist }));

    await act(async () => {
      await result.current.executeGeneration({ targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: false, selectedGenres: [] }, 1);
    });

    expect(setIsGeneratingLongPlaylist).toHaveBeenCalledWith(false);
  });

  it('mode Distance, longue distance à une allure lente : convertie en minutes et comparée au même seuil', async () => {
    const setIsGeneratingLongPlaylist = vi.fn();
    const { result } = renderGenerationHook(immediateProps({ setIsGeneratingLongPlaylist }));

    // 15 km à 6:00/km (360s/km) = 90 minutes — largement au-dessus du seuil.
    await act(async () => {
      await result.current.executeGeneration({
        targetMode: 'distance', distanceVal: 15, paceMin: 6, paceSec: 0, isIntervalMode: false, selectedGenres: [],
      }, 1);
    });

    expect(setIsGeneratingLongPlaylist).toHaveBeenCalledWith(true);
  });

  it('mode Fractionné : jamais signalé comme long, quelle que soit la config (hors scope assumé)', async () => {
    const setIsGeneratingLongPlaylist = vi.fn();
    const { result } = renderGenerationHook(immediateProps({ setIsGeneratingLongPlaylist }));

    await act(async () => {
      await result.current.executeGeneration({
        targetMode: 'time', isIntervalMode: true, selectedGenres: [],
        segments: [{ durationValue: 60 }, { durationValue: 60 }],
      }, 1);
    });

    expect(setIsGeneratingLongPlaylist).toHaveBeenCalledWith(false);
  });

  it('annulation en cours de route : réinitialise isGeneratingLongPlaylist à false', () => {
    const setIsGeneratingLongPlaylist = vi.fn();
    const deferred = createDeferred();
    mockCreatePlaylistData.mockImplementationOnce(() => deferred.promise);
    const { result } = renderGenerationHook(baseProps({ setIsGeneratingLongPlaylist }));

    act(() => {
      result.current.executeGeneration({ targetMode: 'time', hours: 1, minutes: 0, isIntervalMode: false, selectedGenres: [] }, 1);
    });
    act(() => { result.current.cancelGeneration(); });

    expect(setIsGeneratingLongPlaylist).toHaveBeenLastCalledWith(false);
  });
});

// NOUVEAU (14/08, même retour direct — chantier plus lourd validé
// explicitement après discussion sur le rapport effort/risque) : `createPlaylistData` accepte désormais un callback
// `onProgress`, appelé par le VRAI moteur (musicEngine.js, mocké ici) au
// fil de sa recherche — ces tests vérifient seulement que
// `usePlaylistGeneration.js` relaie correctement ce que le moteur lui
// envoie, PAS le calcul d'estimation lui-même (couvert séparément dans
// musicEngine.test.js).
describe('usePlaylistGeneration — generatingEstimatedTracksFound (NOUVEAU, 14/08)', () => {
  it('relaie chaque appel du onProgress du moteur vers setGeneratingEstimatedTracksFound', async () => {
    const setGeneratingEstimatedTracksFound = vi.fn();
    mockCreatePlaylistData.mockImplementationOnce(async (config, exclude, favorites, pool, naughty, onProgress) => {
      onProgress(3);
      onProgress(7);
      return makeFakePlaylist();
    });
    const { result } = renderGenerationHook(baseProps({ setGeneratingEstimatedTracksFound }));

    await act(async () => {
      await result.current.executeGeneration({ targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: false, selectedGenres: [] }, 1);
    });

    expect(setGeneratingEstimatedTracksFound).toHaveBeenCalledWith(3);
    expect(setGeneratingEstimatedTracksFound).toHaveBeenCalledWith(7);
  });

  // Trouvé en RELECTURE après coup (14/08, pas au premier passage) — voir le
  // commentaire "Clamp anti-régression" dans usePlaylistGeneration.js pour le
  // raisonnement complet (genres pondérés multiples, marge de pool 1.5x).
  it('clamp anti-régression : une estimation qui redescend (transition entre genres pondérés) n\'est PAS relayée telle quelle', async () => {
    const setGeneratingEstimatedTracksFound = vi.fn();
    mockCreatePlaylistData.mockImplementationOnce(async (config, exclude, favorites, pool, naughty, onProgress) => {
      onProgress(8); // estimation haute pendant la recherche du 1er genre
      onProgress(5); // le genre suivant démarre sur le compte RÉEL, plus bas
      onProgress(9); // puis remonte normalement
      return makeFakePlaylist();
    });
    const { result } = renderGenerationHook(baseProps({ setGeneratingEstimatedTracksFound }));

    await act(async () => {
      await result.current.executeGeneration({ targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: false, selectedGenres: [] }, 1);
    });

    expect(setGeneratingEstimatedTracksFound).toHaveBeenCalledWith(8);
    expect(setGeneratingEstimatedTracksFound).not.toHaveBeenCalledWith(5); // avalé par le clamp, jamais affiché
    expect(setGeneratingEstimatedTracksFound).toHaveBeenCalledWith(9);
  });

  it('clamp anti-régression : repart bien de zéro pour CHAQUE playlist d\'un lot (pas de fuite entre elles)', async () => {
    const setGeneratingEstimatedTracksFound = vi.fn();
    mockCreatePlaylistData
      .mockImplementationOnce(async (config, exclude, favorites, pool, naughty, onProgress) => {
        onProgress(10); // 1ère playlist du lot : monte haut
        return makeFakePlaylist();
      })
      .mockImplementationOnce(async (config, exclude, favorites, pool, naughty, onProgress) => {
        onProgress(2); // 2e playlist : recherche indépendante, repart bas — doit quand même passer
        return makeFakePlaylist();
      });
    const { result } = renderGenerationHook(baseProps({ setGeneratingEstimatedTracksFound }));

    await act(async () => {
      await result.current.executeGeneration({ targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: false, selectedGenres: [] }, 2);
    });

    expect(setGeneratingEstimatedTracksFound).toHaveBeenCalledWith(10);
    expect(setGeneratingEstimatedTracksFound).toHaveBeenCalledWith(2); // pas avalé par le clamp de la 1ère playlist
  });

  it('réinitialisé à 0 au tout début de chaque génération, avant le 1er appel du moteur', async () => {
    const setGeneratingEstimatedTracksFound = vi.fn();
    mockCreatePlaylistData.mockResolvedValueOnce(makeFakePlaylist());
    const { result } = renderGenerationHook(baseProps({ setGeneratingEstimatedTracksFound }));

    await act(async () => {
      await result.current.executeGeneration({ targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: false, selectedGenres: [] }, 1);
    });

    expect(setGeneratingEstimatedTracksFound.mock.calls[0]).toEqual([0]);
  });

  it('réinitialisé à 0 par cancelGeneration', () => {
    const setGeneratingEstimatedTracksFound = vi.fn();
    const deferred = createDeferred();
    mockCreatePlaylistData.mockImplementationOnce(() => deferred.promise);
    const { result } = renderGenerationHook(baseProps({ setGeneratingEstimatedTracksFound }));

    act(() => {
      result.current.executeGeneration({ targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: false, selectedGenres: [] }, 1);
    });
    setGeneratingEstimatedTracksFound.mockClear(); // ne garder que les appels APRÈS l'annulation
    act(() => { result.current.cancelGeneration(); });

    expect(setGeneratingEstimatedTracksFound).toHaveBeenCalledWith(0);
  });

  it('un appel du onProgress APRÈS une annulation n\'est PAS relayé (state déjà remis à 0 par cancelGeneration, pas réécrasé après coup)', async () => {
    const setGeneratingEstimatedTracksFound = vi.fn();
    let capturedOnProgress;
    const deferred = createDeferred();
    mockCreatePlaylistData.mockImplementationOnce((config, exclude, favorites, pool, naughty, onProgress) => {
      capturedOnProgress = onProgress;
      return deferred.promise;
    });
    const { result } = renderGenerationHook(baseProps({ setGeneratingEstimatedTracksFound }));

    act(() => {
      result.current.executeGeneration({ targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: false, selectedGenres: [] }, 1);
    });
    act(() => { result.current.cancelGeneration(); });
    setGeneratingEstimatedTracksFound.mockClear();

    // Appel réseau "encore en vol" au moment de l'annulation, qui ne s'est
    // résolu qu'après — sans le garde-fou `cancelToken.cancelled`, ceci
    // réécraserait le 0 déjà posé par cancelGeneration.
    act(() => { capturedOnProgress(5); });

    expect(setGeneratingEstimatedTracksFound).not.toHaveBeenCalled();
  });
});
