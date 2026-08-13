// @vitest-environment jsdom
//
// Test dédié à useRoutines.js — 0 test jusqu'ici (check-up du 13/08).
// S'appuie sur `useSyncedCollection` (localStorage + AuthContext +
// supabaseClient) — même raisonnement que useFavorites.test.js/
// useAthleticProfile.test.js : `useAuthContext()` retombe sur son
// `FALLBACK` sûr et `isSupabaseConfigured` vaut `false` par défaut dans ce
// bac à sable, donc `renderHook` direct fonctionne sans mocker
// AuthContext/supabaseClient. Seul `useModalContext()` est mocké
// (`activeModal`/`closeModal`, dépendance directe de ce hook).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let mockActiveModal = null;
const mockCloseModal = vi.fn();
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ activeModal: mockActiveModal, closeModal: mockCloseModal }),
}));

import { useRoutines } from '../../src/hooks/useRoutines.js';

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mockActiveModal = null;
});

describe('useRoutines — état initial', () => {
  it('routines démarre avec la routine de démonstration par défaut', () => {
    const { result } = renderHook(() => useRoutines(false, vi.fn()));
    expect(result.current.routines).toHaveLength(1);
    expect(result.current.routines[0].id).toBe('routine-1');
  });

  it('isSavingRoutineModalOpen/isEditRoutineModalOpen dérivés de activeModal (ModalContext), pas d\'état local dupliqué', () => {
    mockActiveModal = 'SAVING_ROUTINE';
    const { result, rerender } = renderHook(() => useRoutines(false, vi.fn()));
    expect(result.current.isSavingRoutineModalOpen).toBe(true);
    expect(result.current.isEditRoutineModalOpen).toBe(false);

    mockActiveModal = 'EDIT_ROUTINE';
    rerender();
    expect(result.current.isSavingRoutineModalOpen).toBe(false);
    expect(result.current.isEditRoutineModalOpen).toBe(true);
  });
});

describe('addRoutine', () => {
  it('ajoute la routine EN TÊTE de la liste, réinitialise le formulaire, ferme la modale, toast', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useRoutines(false, showToast));

    act(() => {
      result.current.setNewRoutineName('Ma routine');
      result.current.setNewRoutineIcon('🔥');
    });

    const newRoutine = { id: 'routine-new', name: 'Ma routine', coverIcon: '🔥' };
    act(() => { result.current.addRoutine(newRoutine); });

    expect(result.current.routines[0].id).toBe('routine-new');
    expect(result.current.routines).toHaveLength(2); // + la routine de démo déjà présente
    expect(result.current.newRoutineName).toBe('');
    expect(result.current.newRoutineIcon).toBe('⚡');
    expect(result.current.newRoutineFreq).toBe('Manuel');
    expect(mockCloseModal).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Routine sauvegardée avec succès !');
  });
});

describe('updateRoutine', () => {
  it('remplace la routine correspondante par la version modifiée (même id)', () => {
    const { result } = renderHook(() => useRoutines(false, vi.fn()));
    const updated = { ...result.current.routines[0], name: 'Nom modifié' };

    act(() => { result.current.updateRoutine(updated); });

    expect(result.current.routines[0].name).toBe('Nom modifié');
    expect(result.current.routines).toHaveLength(1); // pas de doublon créé
  });

  it('id inconnu : ne modifie rien, ne plante pas', () => {
    const { result } = renderHook(() => useRoutines(false, vi.fn()));
    act(() => { result.current.updateRoutine({ id: 'inconnu', name: 'x' }); });
    expect(result.current.routines).toHaveLength(1);
    expect(result.current.routines[0].id).toBe('routine-1');
  });
});

describe('getDisplayRoutineName / getDisplayRoutineIcon — cosmétique Mode Intime, ne modifie JAMAIS les vraies données', () => {
  it('mode Sport : renvoie le vrai nom/icône de la routine, tels quels', () => {
    const { result } = renderHook(() => useRoutines(false, vi.fn()));
    const routine = result.current.routines[0];
    expect(result.current.getDisplayRoutineName(routine)).toBe(routine.name);
    expect(result.current.getDisplayRoutineIcon(routine)).toBe(routine.coverIcon);
  });

  it('Mode Intime : renvoie un nom/icône "coquin" DÉTERMINISTE (même routine → toujours le même résultat), sans jamais toucher routine.name', () => {
    const { result } = renderHook(() => useRoutines(true, vi.fn()));
    const routine = result.current.routines[0];

    const name1 = result.current.getDisplayRoutineName(routine);
    const icon1 = result.current.getDisplayRoutineIcon(routine);
    const name2 = result.current.getDisplayRoutineName(routine);

    expect(name1).toBe(name2); // stable, pas aléatoire à chaque appel
    expect(name1).not.toBe(routine.name); // nom coquin, pas le vrai nom
    expect(routine.name).toBe('Mon 5km Quotidien'); // la vraie donnée n'a jamais été mutée
    expect(typeof icon1).toBe('string');
    expect(icon1.length).toBeGreaterThan(0);
  });

  it('Mode Intime : le nom affiché ne contient PAS l\'emoji en double (retiré du texte, laissé seul dans l\'icône)', () => {
    const { result } = renderHook(() => useRoutines(true, vi.fn()));
    const routine = result.current.routines[0];
    const icon = result.current.getDisplayRoutineIcon(routine);
    const name = result.current.getDisplayRoutineName(routine);
    expect(name.startsWith(icon)).toBe(false);
  });
});
