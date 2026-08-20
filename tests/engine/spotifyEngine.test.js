// Premier fichier de test pour spotifyEngine.js — lacune de couverture
// identifiée lors du check-up global du 19/08 (159 lignes, logique réelle :
// cascade de résolution BPM, pagination, distinction 401/403). `deezerFetch`
// (musicEngine.js) mocké — même convention que useFavorites.test.js. `fetch`
// global mocké via `vi.stubGlobal` pour les appels Spotify/GetSongBPM
// directs (pas de vrai réseau).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDeezerFetch = vi.fn();
vi.mock('../../src/engine/musicEngine.js', () => ({
  deezerFetch: (...args) => mockDeezerFetch(...args),
}));

import {
  resolveRealBPM,
  fetchAllLikedTracks,
  fetchFollowedArtists,
  fetchSpotifyRawData,
  resolveTracksBpm,
  SPOTIFY_API_BASE,
} from '../../src/engine/spotifyEngine.js';

beforeEach(() => {
  // `resetAllMocks()` plutôt que `clearAllMocks()` — même convention que
  // usePersistentState.test.js (13/08) : évite toute fuite d'un
  // `mockResolvedValueOnce` resté en file d'attente vers le test suivant.
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveRealBPM — cascade Deezer → GetSongBPM → estimation mathématique', () => {
  it('Deezer trouve un BPM valide : le renvoie directement, sans jamais appeler GetSongBPM', async () => {
    mockDeezerFetch
      .mockResolvedValueOnce({ data: { data: [{ id: 42 }] } }) // recherche
      .mockResolvedValueOnce({ data: { bpm: '128.4', preview: 'https://deezer.example/preview.mp3' } }); // détail du titre
    // BUG CORRIGÉ (19/08, check-up global, rattrapé par le build Vercel réel
    // AVANT tout déploiement — voir les logs) : `vi.stubGlobal(name, value)`
    // renvoie `vi` LUI-MÊME (pour permettre le chaînage), PAS la valeur
    // stubbée passée en 2e argument. `const fetchSpy = vi.stubGlobal(...)`
    // liait donc `fetchSpy` à l'objet `vi`, jamais au mock — faisait planter
    // `expect(fetchSpy).not.toHaveBeenCalled()` ("is not a spy"). Le mock
    // doit être capturé À PART, puis seulement PASSÉ à `vi.stubGlobal`.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await resolveRealBPM('Titre Test', 'Artiste Test');

    expect(result).toEqual({ bpm: 128, preview: 'https://deezer.example/preview.mp3' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Deezer ne renvoie aucun résultat de recherche : repli sur GetSongBPM (requête titre+artiste)', async () => {
    mockDeezerFetch.mockResolvedValueOnce({ data: { data: [] } });
    const fetchMock = vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ search: [{ tempo: '140' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRealBPM('Titre Test', 'Artiste Test');

    expect(result).toEqual({ bpm: 140, preview: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/getsongbpm?type=both');
  });

  it('Deezer lève une exception réseau : repli sur GetSongBPM quand même (jamais bloquant)', async () => {
    mockDeezerFetch.mockRejectedValueOnce(new Error('network down'));
    const fetchMock = vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ search: [{ tempo: '110' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRealBPM('Titre Test', 'Artiste Test');

    expect(result).toEqual({ bpm: 110, preview: null });
  });

  it('GetSongBPM "both" (titre+artiste) échoue : repli sur la requête "titre seul"', async () => {
    mockDeezerFetch.mockResolvedValueOnce({ data: { data: [] } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ search: [] }) }) // "both" : rien
      .mockResolvedValueOnce({ json: () => Promise.resolve({ search: [{ tempo: '95' }] }) }); // "song" seul : trouvé
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRealBPM('Titre Test', 'Artiste Test');

    expect(result).toEqual({ bpm: 95, preview: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/api/getsongbpm?type=song');
  });

  it('Deezer ET GetSongBPM échouent tous les deux : repli sur l\'estimation mathématique (jamais bloquant)', async () => {
    mockDeezerFetch.mockResolvedValueOnce({ data: { data: [] } });
    const fetchMock = vi.fn(() => Promise.reject(new Error('GetSongBPM down')));
    vi.stubGlobal('fetch', fetchMock);

    const title = 'Un Titre Suffisamment Long';
    const result = await resolveRealBPM(title, 'Artiste Test');

    expect(result).toEqual({ bpm: 100 + (title.length % 80), preview: null });
  });

  it('nettoie le titre (parenthèses/crochets/tiret) et l\'artiste (virgule/esperluette) avant la recherche Deezer', async () => {
    mockDeezerFetch.mockResolvedValueOnce({ data: { data: [] } });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ search: [] }) })));

    await resolveRealBPM('Titre (Remix) [Live] - Version Radio', 'Artiste A, Artiste B & Artiste C');

    const searchUrl = decodeURIComponent(mockDeezerFetch.mock.calls[0][0]);
    expect(searchUrl).toContain('track:"Titre"');
    expect(searchUrl).toContain('artist:"Artiste A"');
  });
});

describe('fetchAllLikedTracks — pagination et distinction 401/403', () => {
  it('suit la pagination via data.next jusqu\'à épuisement', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 200, json: () => Promise.resolve({ items: [{ track: { id: 't1' } }], next: 'PAGE2' }) })
      .mockResolvedValueOnce({ status: 200, json: () => Promise.resolve({ items: [{ track: { id: 't2' } }], next: null }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAllLikedTracks('tok', 200);

    expect(result).toEqual([{ id: 't1' }, { id: 't2' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(SPOTIFY_API_BASE + '/me/tracks?limit=50');
    expect(fetchMock.mock.calls[1][0]).toBe('PAGE2');
  });

  it('respecte le plafond maxTracks (arrête de paginer, tronque le résultat final)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      status: 200,
      json: () => Promise.resolve({
        items: Array.from({ length: 50 }, (_, i) => ({ track: { id: `t${i}` } })),
        next: 'ENCORE',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAllLikedTracks('tok', 75);

    expect(result).toHaveLength(75);
    // 2 pages de 50 suffisent à dépasser 75 -> la boucle s'arrête, pas de 3e appel.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('401 : lève "Token expiré" (reconnexion pertinente)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ status: 401 })));
    await expect(fetchAllLikedTracks('tok')).rejects.toThrow('Token expiré');
  });

  it('403 : lève "Accès Spotify refusé" — BUG CORRIGÉ (boucle infinie de reconnexion évitée, voir docstring) : distinct de 401, jamais confondu avec un token expiré', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ status: 403 })));
    await expect(fetchAllLikedTracks('tok')).rejects.toThrow('Accès Spotify refusé');
  });
});

describe('fetchFollowedArtists — échec silencieux (source secondaire)', () => {
  it('renvoie les noms des artistes suivis en cas de succès', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ artists: { items: [{ name: 'Artiste A' }, { name: 'Artiste B' }] } }),
    })));

    const result = await fetchFollowedArtists('tok');

    expect(result).toEqual(['Artiste A', 'Artiste B']);
  });

  it('réponse non-ok : renvoie [] silencieusement (ne fait jamais échouer toute la synchro)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));
    const result = await fetchFollowedArtists('tok');
    expect(result).toEqual([]);
  });

  it('exception réseau : renvoie [] silencieusement', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const result = await fetchFollowedArtists('tok');
    expect(result).toEqual([]);
  });
});

describe('fetchSpotifyRawData — combine titres likés + artistes suivis en parallèle', () => {
  it('renvoie rawTracks et followedArtistNames ensemble', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/me/tracks')) {
        return Promise.resolve({ status: 200, json: () => Promise.resolve({ items: [{ track: { id: 't1' } }], next: null }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ artists: { items: [{ name: 'Artiste A' }] } }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSpotifyRawData('tok');

    expect(result.rawTracks).toEqual([{ id: 't1' }]);
    expect(result.followedArtistNames).toEqual(['Artiste A']);
  });
});

describe('resolveTracksBpm — pure, aucun setState/lecture de state React', () => {
  it('résout chaque titre et garde la priorité à l\'extrait Spotify natif sur celui trouvé via Deezer', async () => {
    mockDeezerFetch.mockResolvedValueOnce({ data: { data: [{ id: 1 }] } })
      .mockResolvedValueOnce({ data: { bpm: '130', preview: 'https://deezer.example/preview.mp3' } });

    const rawTracks = [{
      id: 'sp1', name: 'Titre', artists: [{ name: 'Artiste' }],
      album: { name: 'Album' }, duration_ms: 210000,
      preview_url: 'https://spotify.example/preview.mp3',
    }];

    const result = await resolveTracksBpm(rawTracks);

    expect(result).toEqual([{
      trackId: 'sp1', title: 'Titre', artist: 'Artiste', album: 'Album',
      bpm: 130, duration: 210, isFromPlatform: 'Spotify',
      preview: 'https://spotify.example/preview.mp3', // priorité à l'extrait Spotify natif
    }]);
  });

  it('sans artiste ni preview Spotify : "Artiste inconnu", extrait Deezer utilisé en repli', async () => {
    mockDeezerFetch.mockResolvedValueOnce({ data: { data: [{ id: 1 }] } })
      .mockResolvedValueOnce({ data: { bpm: '100', preview: 'https://deezer.example/x.mp3' } });

    const rawTracks = [{
      id: 'sp2', name: 'Titre 2', artists: [],
      album: null, duration_ms: 180000, preview_url: null,
    }];

    const result = await resolveTracksBpm(rawTracks);

    expect(result[0].artist).toBe('Artiste inconnu');
    expect(result[0].album).toBe('Album');
    expect(result[0].preview).toBe('https://deezer.example/x.mp3');
  });
});
