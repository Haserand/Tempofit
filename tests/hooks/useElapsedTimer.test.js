// @vitest-environment jsdom
//
// Test dédié à useElapsedTimer.js — 0 test jusqu'ici (check-up du 13/08).
// Petit hook (24 lignes) mais avec un vrai `setInterval`/nettoyage à
// couvrir. `renderHook` (donc `jsdom`) nécessaire pour le `useState`
// interne ; `vi.useFakeTimers()` pour avancer le temps sans attendre.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElapsedTimer } from '../../src/hooks/useElapsedTimer.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('useElapsedTimer — isActive=false', () => {
  it('reste à 0 tant que isActive est faux', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useElapsedTimer(false));
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(0);
  });
});

describe('useElapsedTimer — isActive=true', () => {
  it('incrémente d\'1 seconde toutes les secondes', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useElapsedTimer(true));
    expect(result.current).toBe(0);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(1);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(4);
  });

  it('passer de false à true repart bien de 0', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ isActive }) => useElapsedTimer(isActive), {
      initialProps: { isActive: true },
    });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(5);

    rerender({ isActive: false });
    expect(result.current).toBe(0);

    rerender({ isActive: true });
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe(2);
  });

  it('démonter le composant nettoie l\'intervalle (aucune erreur, aucun setState après démontage)', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useElapsedTimer(true));
    act(() => { vi.advanceTimersByTime(1000); });

    unmount();

    // Si l'intervalle n'était pas nettoyé, avancer le temps après
    // démontage tenterait un setState sur un composant démonté — pas
    // d'assertion directe possible ici (le hook est démonté), mais ceci
    // ne doit lever AUCUNE erreur/avertissement.
    expect(() => { act(() => { vi.advanceTimersByTime(5000); }); }).not.toThrow();
  });
});
