// @vitest-environment jsdom
//
// Test dédié à useSpotifyImport.js — 0 test jusqu'ici (check-up du 13/08).
// `spotifyEngine.js` (fetchSpotifyRawData/resolveTracksBpm) entièrement
// mocké — pas de vrai réseau. `loginSpotify` (PKCE : crypto.subtle.digest,
// redirection window.location.href) est délibérément HORS SCOPE de ce
// fichier — pure plomberie d'API navigateur (aucune branche métier propre
// à ce projet), fragile à simuler fidèlement en jsdom sans gain réel de
// couverture ; focus mis sur `syncSpotifyFavorites` (la vraie logique de
// fusion/dédup/gestion d'erreurs) et l'auto-synchro au montage.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockFetchSpotifyRawData = vi.fn();
const mockResolveTracksBpm = vi.fn();
vi.mock('../../src/engine/spotifyEngine.js', () => ({
  fetchSpotifyRawData: (...args) => mockFetchSpotifyRawData(...args),
  resolveTracksBpm: (...args) => mockResolveTracksBpm(...args),
}));

import { useSpotifyImport } from '../../src/hooks/useSpotifyImport.js';

function baseFavorites() {
  return { useFavorites: true, artists: ['Existant'], tracks: [{ trackId: 'existant-1', artist: 'Existant' }] };
}

// `setFavorites` réel du projet accepte un updater fonctionnel — ce faux
// state minimal reproduit ce contrat pour vérifier la fusion réellement
// appliquée par `syncSpotifyFavorites`, sans dépendre de useFavorites.js.
function makeSetFavorites(initial = baseFavorites()) {
  let current = initial;
  const setFavorites = vi.fn((updater) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  });
  return { setFavorites, get: () => current };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSpotifyImport — état initial', () => {
  it('spotifyToken vaut null si rien dans localStorage', () => {
    const { result } = renderHook(() => useSpotifyImport(vi.fn(), vi.fn()));
    expect(result.current.spotifyToken).toBeNull();
  });

  it('lit un token déjà présent dans localStorage au montage', () => {
    window.localStorage.setItem('spotify_token', 'existing-token-abc');
    mockFetchSpotifyRawData.mockReturnValue(new Promise(() => {})); // ne jamais résoudre, on ne teste que l'état initial ici
    const { result } = renderHook(() => useSpotifyImport(vi.fn(), vi.fn()));
    expect(result.current.spotifyToken).toBe('existing-token-abc');
  });
});

describe('useSpotifyImport — auto-synchro au montage si un token valide est déjà présent', () => {
  it('token valide en localStorage : déclenche automatiquement syncSpotifyFavorites', async () => {
    window.localStorage.setItem('spotify_token', 'real-token');
    mockFetchSpotifyRawData.mockResolvedValue({ rawTracks: [], followedArtistNames: [] });
    const showToast = vi.fn();

    renderHook(() => useSpotifyImport(vi.fn(), showToast));

    await waitFor(() => expect(mockFetchSpotifyRawData).toHaveBeenCalledWith('real-token'));
  });

  it('token vaut la CHAÎNE "undefined" ou "null" (déjà rencontré en pratique) : ne déclenche PAS de synchro', () => {
    window.localStorage.setItem('spotify_token', 'undefined');
    renderHook(() => useSpotifyImport(vi.fn(), vi.fn()));
    expect(mockFetchSpotifyRawData).not.toHaveBeenCalled();
  });

  it('aucun token : aucune synchro déclenchée', () => {
    renderHook(() => useSpotifyImport(vi.fn(), vi.fn()));
    expect(mockFetchSpotifyRawData).not.toHaveBeenCalled();
  });
});

describe('syncSpotifyFavorites — garde-fous d\'entrée', () => {
  it('aucun token disponible (ni en argument, ni en state) : ne fait rien', async () => {
    const { result } = renderHook(() => useSpotifyImport(vi.fn(), vi.fn()));
    await act(async () => { await result.current.syncSpotifyFavorites(); });
    expect(mockFetchSpotifyRawData).not.toHaveBeenCalled();
  });

  it('token littéralement "undefined"/"null" passé en argument : ne fait rien', async () => {
    const { result } = renderHook(() => useSpotifyImport(vi.fn(), vi.fn()));
    await act(async () => { await result.current.syncSpotifyFavorites('undefined'); });
    await act(async () => { await result.current.syncSpotifyFavorites('null'); });
    expect(mockFetchSpotifyRawData).not.toHaveBeenCalled();
  });
});

describe('syncSpotifyFavorites — succès', () => {
  it('bibliothèque vide (aucun titre liké, aucun artiste suivi) : toast dédié, ne touche pas les favoris', async () => {
    mockFetchSpotifyRawData.mockResolvedValue({ rawTracks: [], followedArtistNames: [] });
    const { setFavorites } = makeSetFavorites();
    const showToast = vi.fn();
    const { result } = renderHook(() => useSpotifyImport(setFavorites, showToast));

    await act(async () => { await result.current.syncSpotifyFavorites('tok'); });

    expect(showToast).toHaveBeenCalledWith('Synchro terminée (Aucun titre liké ni artiste suivi trouvé).');
    expect(setFavorites).not.toHaveBeenCalled();
  });

  it('fusionne les titres/artistes Spotify avec les favoris EXISTANTS, sans les écraser', async () => {
    mockFetchSpotifyRawData.mockResolvedValue({
      rawTracks: [{ trackId: 'sp-1', artist: 'Justice' }],
      followedArtistNames: ['Justice', 'SebastiAn'],
    });
    mockResolveTracksBpm.mockResolvedValue([{ trackId: 'sp-1', artist: 'Justice', bpm: 128 }]);
    const { setFavorites, get } = makeSetFavorites();
    const showToast = vi.fn();
    const { result } = renderHook(() => useSpotifyImport(setFavorites, showToast));

    await act(async () => { await result.current.syncSpotifyFavorites('tok'); });

    const merged = get();
    expect(merged.tracks.some(t => t.trackId === 'existant-1')).toBe(true); // ancien titre gardé
    expect(merged.tracks.some(t => t.trackId === 'sp-1')).toBe(true); // nouveau titre ajouté
    expect(merged.artists).toEqual(expect.arrayContaining(['Existant', 'Justice', 'SebastiAn']));
    expect(merged.useFavorites).toBe(true);
    expect(result.current.spotifyTrackPool).toEqual([{ trackId: 'sp-1', artist: 'Justice', bpm: 128 }]);
  });

  it('ne duplique JAMAIS un titre déjà présent dans les favoris (même trackId)', async () => {
    mockFetchSpotifyRawData.mockResolvedValue({
      rawTracks: [{ trackId: 'existant-1', artist: 'Existant' }],
      followedArtistNames: [],
    });
    mockResolveTracksBpm.mockResolvedValue([{ trackId: 'existant-1', artist: 'Existant', bpm: 100 }]);
    const { setFavorites, get } = makeSetFavorites();
    const { result } = renderHook(() => useSpotifyImport(setFavorites, vi.fn()));

    await act(async () => { await result.current.syncSpotifyFavorites('tok'); });

    expect(get().tracks.filter(t => t.trackId === 'existant-1')).toHaveLength(1);
  });

  it('plafonne la liste d\'artistes fusionnée à 40', async () => {
    const manyArtists = Array.from({ length: 60 }, (_, i) => `Artiste ${i}`);
    mockFetchSpotifyRawData.mockResolvedValue({ rawTracks: [], followedArtistNames: manyArtists });
    mockResolveTracksBpm.mockResolvedValue([]);
    const { setFavorites, get } = makeSetFavorites();
    const { result } = renderHook(() => useSpotifyImport(setFavorites, vi.fn()));

    await act(async () => { await result.current.syncSpotifyFavorites('tok'); });

    expect(get().artists.length).toBeLessThanOrEqual(40);
  });
});

describe('syncSpotifyFavorites — gestion d\'erreurs (3 messages distincts, jamais confondus)', () => {
  it('"Token expiré" : vide le token (localStorage + state), toast dédié — jamais de re-tentative automatique', async () => {
    window.localStorage.setItem('spotify_token', 'stale-token');
    mockFetchSpotifyRawData.mockRejectedValue(new Error('Token expiré'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const showToast = vi.fn();

    const { result } = renderHook(() => useSpotifyImport(vi.fn(), showToast));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('❌ Ta session Spotify a expiré. Reconnecte-toi !', 'error'));

    expect(window.localStorage.getItem('spotify_token')).toBeNull();
    expect(result.current.spotifyToken).toBeNull();
    consoleSpy.mockRestore();
  });

  it('"Accès Spotify refusé" (403) : toast dédié, mais NE vide PAS le token (se reconnecter ne changerait rien)', async () => {
    window.localStorage.setItem('spotify_token', 'valid-but-refused-token');
    mockFetchSpotifyRawData.mockRejectedValue(new Error('Accès Spotify refusé'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const showToast = vi.fn();

    const { result } = renderHook(() => useSpotifyImport(vi.fn(), showToast));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      '❌ Spotify refuse l\'accès — pas ta session, vérifie le compte développeur de l\'app.', 'error',
    ));

    expect(result.current.spotifyToken).toBe('valid-but-refused-token'); // PAS effacé
    consoleSpy.mockRestore();
  });

  it('erreur générique (ni token expiré, ni 403) : toast générique, token laissé intact', async () => {
    window.localStorage.setItem('spotify_token', 'valid-token');
    mockFetchSpotifyRawData.mockRejectedValue(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const showToast = vi.fn();

    const { result } = renderHook(() => useSpotifyImport(vi.fn(), showToast));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('❌ Erreur lors de l\'importation.', 'error'));

    expect(result.current.spotifyToken).toBe('valid-token');
    consoleSpy.mockRestore();
  });
});
