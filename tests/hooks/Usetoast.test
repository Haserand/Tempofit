// @vitest-environment jsdom
//
// Test dédié à useToast.js — 0 test jusqu'ici (check-up du 13/08) malgré
// son usage transversal (utilisé par la quasi-totalité des autres hooks
// du projet pour afficher un message). `renderHook` (donc `jsdom`)
// nécessaire pour le `useState` interne ; `vi.useFakeTimers()` pour
// contrôler les durées d'affichage sans vraiment attendre.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../../src/hooks/useToast.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('useToast — état initial', () => {
  it('toast est null tant que showToast n\'a jamais été appelé', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });
});

describe('useToast — affichage et variant par défaut', () => {
  it('showToast(message) sans variant : variant="default", disparaît après 3s', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => { result.current.showToast('Sauvegardé !'); });
    expect(result.current.toast).toEqual({ message: 'Sauvegardé !', variant: 'default' });

    act(() => { vi.advanceTimersByTime(2999); });
    expect(result.current.toast).not.toBeNull();

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.toast).toBeNull();
  });
});

describe('useToast — durées par variant', () => {
  it('variant "special" (trophée) : disparaît après 5s, pas 3s', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => { result.current.showToast('Trophée débloqué !', 'special'); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.toast).not.toBeNull(); // encore là à 3s, contrairement à 'default'

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.toast).toBeNull(); // parti à 5s
  });

  it('variant "ambiance" : même durée que "special" (5s)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => { result.current.showToast('Mode Intime activé.', 'ambiance'); });
    act(() => { vi.advanceTimersByTime(4999); });
    expect(result.current.toast).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.toast).toBeNull();
  });

  it('variant "error" : disparaît après 8s (durée la plus longue, message à lire)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => { result.current.showToast('Erreur réseau.', 'error'); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.toast).not.toBeNull(); // encore là au-delà de 5s

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.toast).toBeNull(); // parti à 8s
  });
});

describe('useToast — un nouvel appel remplace le toast précédent (BUG CORRIGÉ 13/08)', () => {
  it('un 2e showToast avant l\'expiration du 1er : le toast affiché devient le 2e, avec sa PROPRE durée respectée jusqu\'au bout', () => {
    // AVANT correctif : le minuteur du 1er appel (jamais annulé) effaçait
    // le 2e toast à SA propre échéance, même si celui-ci avait sa propre
    // durée plus longue encore en cours — voir la docstring du hook.
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => { result.current.showToast('Premier', 'default'); }); // 3s, expirerait à t=3s
    act(() => { vi.advanceTimersByTime(1000); }); // t=1s
    act(() => { result.current.showToast('Second', 'error'); }); // 8s, reparti de t=1s → expire à t=9s

    expect(result.current.toast).toEqual({ message: 'Second', variant: 'error' });

    // t=3s : le minuteur du 1er toast aurait dû s'exécuter ici — le 2e
    // toast doit rester intact, sa propre échéance (t=9s) n'est pas encore
    // atteinte.
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.toast).toEqual({ message: 'Second', variant: 'error' });

    // t=9s : cette fois la vraie échéance du 2e toast est atteinte.
    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current.toast).toBeNull();
  });
});
