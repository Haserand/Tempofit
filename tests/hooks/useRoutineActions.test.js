// @vitest-environment jsdom
//
// Premier fichier de test pour useRoutineActions.js — jusqu'ici non testé
// directement (comme la plupart des hooks de ce projet). Volontairement
// SCOPÉ au flag "Clone" vs "Enfant" (`isModifiedSinceClone`) posé dans
// `applyRoutineEditPermanently` (chantier "compteur de sauvegardes/
// clonages", 02/08) — pas une couverture exhaustive de
// `toggleNaughtyMode`/`handleSaveRoutine`/`applyRoutineEditOnce`, qui
// restent non testées directement ici.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoutineActions } from '../../src/hooks/useRoutineActions.js';

vi.mock('../../src/contexts/GeneratorContext.jsx', () => ({
  useGeneratorContext: () => ({
    workoutType: 'Course à pied', customActivity: '', isIntervalMode: false, isCrescendoMode: false, bpm: 150,
    crescendoWarmupPct: 0, crescendoCooldownPct: 0, crescendoWarmupBpm: 0, crescendoCooldownBpm: 0,
    targetMode: 'time', distanceVal: 0, distanceUnit: 'km', paceMin: 0, paceSec: 0, hours: 0, minutes: 30,
    selectedGenres: ['Rock'], bpmTolerance: 10, crossfade: 2, allowLongTracks: false, genreWeights: {}, segments: [],
    setBpm: vi.fn(), setBpmTolerance: vi.fn(), setSelectedGenres: vi.fn(), setGenreWeights: vi.fn(), setLockedGenreWeights: vi.fn(),
    setTargetMode: vi.fn(), setCrossfade: vi.fn(),
  }),
}));

const mockCloseModal = vi.fn();
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ closeModal: mockCloseModal }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function renderActions(editingRoutine, overrides = {}) {
  const updateRoutine = overrides.updateRoutine || vi.fn();
  const { result } = renderHook(() => useRoutineActions(
    overrides.isNaughtyMode ?? false, overrides.setIsNaughtyMode || vi.fn(), overrides.showToast || vi.fn(),
    overrides.routines || [], overrides.addRoutine || vi.fn(), updateRoutine,
    editingRoutine, overrides.setEditingRoutine || vi.fn(),
    overrides.newRoutineName || '', overrides.newRoutineIcon || '⚡', overrides.newRoutineFreq || 'Manuel',
    overrides.userStats || {}, overrides.checkTrophies || vi.fn(), overrides.executeGeneration || vi.fn(),
  ));
  return { result, updateRoutine };
}

describe('useRoutineActions — applyRoutineEditPermanently, flag "Clone" vs "Enfant"', () => {
  it('pose isModifiedSinceClone à true sur une routine CLONÉE (originUserId présent), jamais modifiée avant', () => {
    const clonedRoutine = { id: 'r1', name: 'Copie clonée', originId: 'routine-A', originUserId: 'user-A', isModifiedSinceClone: false };
    const { result, updateRoutine } = renderActions(clonedRoutine);

    result.current.applyRoutineEditPermanently();

    expect(updateRoutine).toHaveBeenCalledWith(expect.objectContaining({ isModifiedSinceClone: true }));
  });

  it('ne pose PAS isModifiedSinceClone sur une routine SANS origine (jamais clonée) — rien à marquer', () => {
    const ownRoutine = { id: 'r1', name: 'Ma routine' };
    const { result, updateRoutine } = renderActions(ownRoutine);

    result.current.applyRoutineEditPermanently();

    expect(updateRoutine.mock.calls[0][0].isModifiedSinceClone).toBeUndefined();
  });

  it('ne touche pas à isModifiedSinceClone s\'il est déjà à true (pas de régression, mais pas de recalcul non plus)', () => {
    const alreadyModified = { id: 'r1', name: 'Déjà Enfant', originId: 'routine-A', originUserId: 'user-A', isModifiedSinceClone: true };
    const { result, updateRoutine } = renderActions(alreadyModified);

    result.current.applyRoutineEditPermanently();

    expect(updateRoutine).toHaveBeenCalledWith(expect.objectContaining({ isModifiedSinceClone: true }));
  });

  it('applyRoutineEditOnce ("cette séance seulement") n\'appelle JAMAIS updateRoutine — rien à marquer, la routine sauvegardée n\'est jamais touchée', () => {
    const clonedRoutine = { id: 'r1', name: 'Copie clonée', originId: 'routine-A', originUserId: 'user-A', isModifiedSinceClone: false };
    const { result, updateRoutine } = renderActions(clonedRoutine, { executeGeneration: vi.fn() });

    result.current.applyRoutineEditOnce();

    expect(updateRoutine).not.toHaveBeenCalled();
  });

  it('sans editingRoutine, ne fait rien (ni updateRoutine, ni exception)', () => {
    const { result, updateRoutine } = renderActions(null);

    expect(() => result.current.applyRoutineEditPermanently()).not.toThrow();
    expect(updateRoutine).not.toHaveBeenCalled();
  });
});
