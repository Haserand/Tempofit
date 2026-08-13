// @vitest-environment jsdom
//
// Test dédié à useFavorites.js — 0 test jusqu'ici (check-up du 13/08).
// S'appuie sur `usePersistentState` (localStorage + AuthContext) —
// `useAuthContext()` retombe sur un `FALLBACK` sûr sans wrapper
// `<AuthProvider>` (voir AuthContext.jsx), et `isSupabaseConfigured` vaut
// `false` par défaut dans ce bac à sable (aucune variable d'environnement
// Supabase configurée) : `renderHook` direct fonctionne donc sans monter
// de Provider ni mocker AuthContext/supabaseClient, même raisonnement que
// useAthleticProfile.test.js/useUserStats.test.js. `deezerFetch`
// (musicEngine.js) mocké — pas de vrai réseau.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockDeezerFetch = vi.fn();
vi.mock('../../src/engine/musicEngine.js', () => ({
  deezerFetch: (...args) => mockDeezerFetch(...args),
}));

import { useFavorites } from '../../src/hooks/useFavorites.js';

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('useFavorites — bucket actif selon isNaughtyMode (cloisonnement Mode Intime)', () => {
  it('mode Sport (isNaughtyMode=false) : renvoie le bucket "standard" par défaut (The Killers/AC-DC)', () => {
    const { result } = renderHook(() => useFavorites(vi.fn(), false));
    expect(result.current.favorites.artists).toEqual(['The Killers', 'AC/DC']);
  });

  it('Mode Intime (isNaughtyMode=true) : renvoie le bucket "naughty" par défaut (Sade/Miguel), JAMAIS le bucket Sport', () => {
    const { result } = renderHook(() => useFavorites(vi.fn(), true));
    expect(result.current.favorites.artists).toEqual(['Sade', 'Miguel']);
    expect(result.current.favorites.tracks.every(t => t.genre === 'R&B Sensuel')).toBe(true);
  });

  it('ajouter un favori en mode Sport ne touche JAMAIS le bucket Intime, et vice-versa', () => {
    const { result, rerender } = renderHook(
      ({ isNaughty }) => useFavorites(vi.fn(), isNaughty),
      { initialProps: { isNaughty: false } },
    );

    act(() => { result.current.toggleArtistFavorite('Metallica'); });
    expect(result.current.favorites.artists).toContain('Metallica');

    rerender({ isNaughty: true });
    // Bucket Intime inchangé, "Metallica" n'y apparaît pas.
    expect(result.current.favorites.artists).not.toContain('Metallica');
    expect(result.current.favorites.artists).toEqual(['Sade', 'Miguel']);
  });

  it('bascule de mode : le genre présélectionné (favSelectedGenres) se réaligne automatiquement (Rock ↔ R&B Sensuel)', () => {
    const { result, rerender } = renderHook(
      ({ isNaughty }) => useFavorites(vi.fn(), isNaughty),
      { initialProps: { isNaughty: false } },
    );
    expect(result.current.favSelectedGenres).toEqual(['Rock']);

    rerender({ isNaughty: true });
    expect(result.current.favSelectedGenres).toEqual(['R&B Sensuel']);

    rerender({ isNaughty: false });
    expect(result.current.favSelectedGenres).toEqual(['Rock']);
  });
});

describe('useFavorites — migration défensive (ancienne forme plate)', () => {
  it('un favori déjà enregistré AVANT le cloisonnement (forme plate, sans standard/naughty) est migré vers le bucket "standard", sans perte', () => {
    window.localStorage.setItem('tempofit:favorites', JSON.stringify({
      useFavorites: true,
      artists: ['Ancien Artiste'],
      tracks: [{ id: 't1', trackId: 't1', title: 'Ancien Titre', artist: 'Ancien Artiste', bpm: 120 }],
    }));

    const { result } = renderHook(() => useFavorites(vi.fn(), false));
    expect(result.current.favorites.artists).toEqual(['Ancien Artiste']);
    expect(result.current.favorites.tracks).toHaveLength(1);
  });
});

describe('toggleTrackFavorite', () => {
  it('titre pas encore favori : l\'ajoute (titre ET artiste), toast de confirmation', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useFavorites(showToast, false));

    act(() => {
      result.current.toggleTrackFavorite({ trackId: 'new-1', artist: 'Muse', title: 'Uprising' });
    });

    expect(result.current.favorites.tracks.some(t => t.trackId === 'new-1')).toBe(true);
    expect(result.current.favorites.artists).toContain('Muse');
    expect(showToast).toHaveBeenCalledWith('⭐ Ajouté à tes favoris !');
  });

  it('titre déjà favori : le retire (mais garde l\'artiste dans les favoris — asymétrie assumée)', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useFavorites(showToast, false));
    const existingTrack = result.current.favorites.tracks[0]; // 'Mr. Brightside', The Killers

    act(() => { result.current.toggleTrackFavorite(existingTrack); });

    expect(result.current.favorites.tracks.some(t => t.trackId === existingTrack.trackId)).toBe(false);
    expect(result.current.favorites.artists).toContain('The Killers'); // artiste toujours favori
    expect(showToast).toHaveBeenCalledWith('Retiré de tes favoris.');
  });
});

describe('toggleArtistFavorite', () => {
  it('artiste pas encore favori : l\'ajoute, sans doublon si déjà présent (Set)', () => {
    const { result } = renderHook(() => useFavorites(vi.fn(), false));
    act(() => { result.current.toggleArtistFavorite('The Killers'); }); // déjà présent par défaut
    expect(result.current.favorites.artists.filter(a => a === 'The Killers')).toHaveLength(1);
  });

  it('artiste déjà favori : le retire', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useFavorites(showToast, false));
    act(() => { result.current.toggleArtistFavorite('AC/DC'); });
    expect(result.current.favorites.artists).not.toContain('AC/DC');
    expect(showToast).toHaveBeenCalledWith('"AC/DC" retiré des artistes favoris.');
  });
});

describe('addFavoriteArtistValidated — ajout optimiste + correction discrète en arrière-plan', () => {
  it('texte vide ou seulement des espaces : ne fait rien', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useFavorites(showToast, false));
    act(() => { result.current.addFavoriteArtistValidated('   '); });
    expect(showToast).not.toHaveBeenCalled();
    expect(mockDeezerFetch).not.toHaveBeenCalled();
  });

  it('ajoute IMMÉDIATEMENT le nom tapé, sans attendre la résolution Deezer', () => {
    mockDeezerFetch.mockReturnValue(new Promise(() => {})); // jamais résolue
    const showToast = vi.fn();
    const { result } = renderHook(() => useFavorites(showToast, false));

    act(() => { result.current.addFavoriteArtistValidated('daft punk'); });

    expect(result.current.favorites.artists).toContain('daft punk');
    expect(showToast).toHaveBeenCalledWith('🎵 daft punk ajouté à tes artistes favoris !');
    expect(result.current.newFavArtist).toBe('');
    expect(result.current.isAddingArtist).toBe(false);
  });

  it('Deezer trouve une orthographe différente : corrige discrètement le nom, sans 2e toast', async () => {
    mockDeezerFetch.mockResolvedValue({ data: { data: [{ name: 'Daft Punk' }] } });
    const showToast = vi.fn();
    const { result } = renderHook(() => useFavorites(showToast, false));

    act(() => { result.current.addFavoriteArtistValidated('daft punk'); });
    expect(result.current.favorites.artists).toContain('daft punk');

    await waitFor(() => {
      expect(result.current.favorites.artists).toContain('Daft Punk');
    });
    expect(result.current.favorites.artists).not.toContain('daft punk');
    expect(showToast).toHaveBeenCalledTimes(1); // toujours un seul toast, l'immédiat
  });

  it('Deezer renvoie EXACTEMENT le même nom (casse identique) : ne déclenche pas de correction inutile', async () => {
    mockDeezerFetch.mockResolvedValue({ data: { data: [{ name: 'daft punk' }] } });
    const { result } = renderHook(() => useFavorites(vi.fn(), false));

    await act(async () => {
      result.current.addFavoriteArtistValidated('daft punk');
      await new Promise(r => setTimeout(r, 0)); // laisse la micro-tâche Deezer se résoudre
    });

    expect(result.current.favorites.artists.filter(a => a === 'daft punk')).toHaveLength(1);
  });

  it('Deezer ne répond rien (aucun résultat) : le nom tapé reste tel quel, aucun crash', async () => {
    mockDeezerFetch.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useFavorites(vi.fn(), false));

    await act(async () => {
      result.current.addFavoriteArtistValidated('artiste obscur');
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.favorites.artists).toContain('artiste obscur');
  });

  it('échec réseau Deezer : échec silencieux, le nom tapé reste, aucun crash', async () => {
    mockDeezerFetch.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useFavorites(vi.fn(), false));

    await act(async () => {
      result.current.addFavoriteArtistValidated('artiste');
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.favorites.artists).toContain('artiste');
  });
});
