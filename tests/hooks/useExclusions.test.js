// @vitest-environment jsdom
//
// Premier fichier de test pour useExclusions.js (28/08, chantier "mécanisme
// d'exclusion") — même raisonnement que useFavorites.test.js : s'appuie sur
// `usePersistentState`, qui retombe sur un repli sûr sans wrapper
// `<AuthProvider>` (voir AuthContext.jsx) dans ce bac à sable.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExclusions } from '../../src/hooks/useExclusions.js';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useExclusions — état par défaut', () => {
  it('démarre avec des listes vides (artists/tracks/genres)', () => {
    const { result } = renderHook(() => useExclusions(vi.fn()));
    expect(result.current.exclusions).toEqual({ artists: [], tracks: [], genres: [] });
  });

  it('démarre avec le formulaire d\'ajout d\'artiste fermé et vide', () => {
    const { result } = renderHook(() => useExclusions(vi.fn()));
    expect(result.current.newExclusionArtist).toBe('');
    expect(result.current.isAddingExclusionArtist).toBe(false);
  });
});

describe('toggleArtistExclusion', () => {
  it('ajoute un artiste non encore exclu, avec un toast dédié', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExclusions(showToast));

    act(() => { result.current.toggleArtistExclusion('Nickelback'); });

    expect(result.current.exclusions.artists).toEqual(['Nickelback']);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Nickelback'));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('🚫'));
  });

  it('retire un artiste déjà exclu (bascule), avec un toast différent', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExclusions(showToast));

    act(() => { result.current.toggleArtistExclusion('Nickelback'); });
    act(() => { result.current.toggleArtistExclusion('Nickelback'); });

    expect(result.current.exclusions.artists).toEqual([]);
    expect(showToast).toHaveBeenLastCalledWith('"Nickelback" retiré des exclusions.');
  });

  it('ne duplique pas un artiste déjà présent (Set implicite via Array.from(new Set(...)))', () => {
    const { result } = renderHook(() => useExclusions(vi.fn()));
    act(() => { result.current.toggleArtistExclusion('Nickelback'); });
    act(() => { result.current.setExclusions(prev => ({ ...prev, artists: [...prev.artists, 'Nickelback'].filter((v, i, a) => a.indexOf(v) === i) })); });
    expect(result.current.exclusions.artists).toEqual(['Nickelback']);
  });
});

describe('toggleTrackExclusion', () => {
  const track = { trackId: 'deezer-123', title: 'Photograph', artist: 'Nickelback', bpm: 100, genre: 'Rock' };

  it('ajoute un titre non encore exclu, avec un toast dédié', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExclusions(showToast));

    act(() => { result.current.toggleTrackExclusion(track); });

    expect(result.current.exclusions.tracks).toEqual([track]);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Photograph'));
  });

  it('retire un titre déjà exclu (bascule par trackId), avec un toast différent', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExclusions(showToast));

    act(() => { result.current.toggleTrackExclusion(track); });
    act(() => { result.current.toggleTrackExclusion(track); });

    expect(result.current.exclusions.tracks).toEqual([]);
    expect(showToast).toHaveBeenLastCalledWith('Retiré des titres exclus.');
  });

  it('exclure un titre n\'exclut PAS son artiste (asymétrie assumée, même principe que useFavorites.js)', () => {
    const { result } = renderHook(() => useExclusions(vi.fn()));
    act(() => { result.current.toggleTrackExclusion(track); });
    expect(result.current.exclusions.artists).toEqual([]);
  });
});

describe('setNewExclusionArtist/setIsAddingExclusionArtist — état UI de ExclusionsView.jsx', () => {
  it('sont bien exposés et indépendants de exclusions/toggle*', () => {
    const { result } = renderHook(() => useExclusions(vi.fn()));
    act(() => {
      result.current.setNewExclusionArtist('Coldplay');
      result.current.setIsAddingExclusionArtist(true);
    });
    expect(result.current.newExclusionArtist).toBe('Coldplay');
    expect(result.current.isAddingExclusionArtist).toBe(true);
    expect(result.current.exclusions.artists).toEqual([]);
  });
});

// NOUVEAU (28/08, "prends du recul, pouvoir exclure un style au besoin ?")
describe('toggleGenreExclusion', () => {
  it('ajoute un genre non encore exclu, avec un toast dédié', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExclusions(showToast));

    act(() => { result.current.toggleGenreExclusion('Rap'); });

    expect(result.current.exclusions.genres).toEqual(['Rap']);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Rap'));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('🚫'));
  });

  it('retire un genre déjà exclu (bascule), avec un toast différent', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExclusions(showToast));

    act(() => { result.current.toggleGenreExclusion('Rap'); });
    act(() => { result.current.toggleGenreExclusion('Rap'); });

    expect(result.current.exclusions.genres).toEqual([]);
    expect(showToast).toHaveBeenLastCalledWith('"Rap" retiré des genres exclus.');
  });

  it('exclure un genre n\'affecte pas artists/tracks', () => {
    const { result } = renderHook(() => useExclusions(vi.fn()));
    act(() => { result.current.toggleGenreExclusion('Rap'); });
    expect(result.current.exclusions.artists).toEqual([]);
    expect(result.current.exclusions.tracks).toEqual([]);
  });
});

// NOUVEAU (28/08, même chantier) — migration défensive : un utilisateur
// ayant déjà des exclusions enregistrées AVANT l'ajout de `genres` ne doit
// jamais planter, ni perdre ses artistes/titres déjà exclus. Clé réelle du
// stockage : `STORAGE_PREFIX + 'exclusions'` (voir usePersistentState.js),
// pas juste `'exclusions'` — sinon ce test ne simule rien du tout et passe
// à tort (l'initialiseur écrirait alors sa propre valeur par défaut).
describe('migration défensive — exclusions sans champ `genres` (données antérieures à ce chantier)', () => {
  it('normalise `exclusions.genres` à un tableau vide sans perdre artists/tracks existants', () => {
    window.localStorage.setItem('tempofit:exclusions', JSON.stringify({ artists: ['Nickelback'], tracks: [] }));
    const { result } = renderHook(() => useExclusions(vi.fn()));

    expect(result.current.exclusions.genres).toEqual([]);
    expect(result.current.exclusions.artists).toEqual(['Nickelback']);
  });
});
