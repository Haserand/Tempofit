// Premier fichier de test pour searchArtistsForBpm (musicEngine.js) —
// fonction historiquement hors scope (réseau, voir musicEngine.test.js :
// "toutes les fonctions testées ici sont PURES, aucun appel réseau"), mais
// le correctif du 28/08 (signal d'arrêt anticipé via `onBatch`) est un vrai
// changement de comportement, pas juste une modification de tuning —
// testable sans mock HTTP lourd en s'appuyant sur `vi.stubGlobal('fetch',
// ...)`, même technique déjà en place dans spotifyEngine.test.js (`deezerFetch`
// appelle `fetch` en interne, aucun besoin de mocker `musicEngine.js`
// lui-même puisque la fonction testée VIT dans ce fichier).
//
// RETOUR DIRECT (28/08 — "pourquoi interroger que 10 titres par artiste,
// autant en demander plus ?") : en creusant cette question, trouvé que
// `searchArtistsForBpm` ignorait TOTALEMENT le budget de vérification de
// l'appelant (`stubCap`, searchEngine.js) — une fois ce budget épuisé côté
// appelant, la fonction continuait quand même à interroger Deezer pour TOUS
// les artistes restants du catalogue, pour des résultats systématiquement
// jetés. `onBatch` peut désormais renvoyer `false` pour signaler "plus de
// place, arrête-toi" — testé ici.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchArtistsForBpm } from '../../src/engine/musicEngine.js';

// Fabrique une réponse fetch() valide (voir safeFetchJson, musicEngine.js :
// `await res.text()` puis `JSON.parse`) — un stub Deezer minimal par artiste
// interrogé, pour que chaque appel produise exactement 1 résultat brut.
function makeFetchMock() {
  return vi.fn(async (url) => ({
    text: async () => {
      // Le nom d'artiste est encodé dans l'URL (voir la requête `artist:"${artistName}"`
      // construite par searchArtistsForBpm) — extrait pour renvoyer un id
      // stable et identifiable par artiste, utile pour vérifier PRÉCISÉMENT
      // quels artistes ont réellement été interrogés (pas juste combien).
      const decoded = decodeURIComponent(url);
      const match = decoded.match(/artist:"([^"]+)"/);
      const artistName = match ? match[1] : 'inconnu';
      return JSON.stringify({ data: [{ id: `id-${artistName}`, bpm: '140', artist: { name: artistName } }] });
    },
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchArtistsForBpm — signal d\'arrêt anticipé via onBatch (régression 28/08)', () => {
  it('`onBatch` renvoyant `false` arrête la recherche NET — les artistes des lots suivants ne sont jamais interrogés', async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    // 10 artistes, BATCH_SIZE interne = 8 -> 2 lots (8 puis 2). `onBatch`
    // renvoie `false` dès le 1er lot : le 2e lot ne doit JAMAIS être
    // interrogé. `maxArtistsToTry`/`candidatesPerArtist` choisis pour que le
    // seuil d'arrêt anticipé PAR ACCUMULATION (`enoughStubs`, mécanisme
    // préexistant, indépendant de celui testé ici) ne soit pas atteint avant
    // (max(6*2, 10*6) = 60, très au-dessus des 8 stubs bruts obtenus au 1er
    // lot) — on isole bien le NOUVEAU signal, pas l'ancien mécanisme.
    const artists = Array.from({ length: 10 }, (_, i) => `Artiste ${i + 1}`);
    const onBatch = vi.fn().mockResolvedValueOnce(false);

    await searchArtistsForBpm(artists, 130, 150, [], 10, 6, onBatch);

    expect(onBatch).toHaveBeenCalledTimes(1);
    // 8 = BATCH_SIZE interne (1 requête fetch par artiste du 1er lot) — les
    // 2 artistes du 2e lot ne doivent jamais apparaître dans les appels.
    expect(fetchMock).toHaveBeenCalledTimes(8);
    const queriedArtists = fetchMock.mock.calls.map(([url]) => decodeURIComponent(url));
    expect(queriedArtists.some(u => u.includes('Artiste 9'))).toBe(false);
    expect(queriedArtists.some(u => u.includes('Artiste 10'))).toBe(false);
  });

  it('`onBatch` ne renvoyant rien (undefined, tous les appelants existants) : comportement INCHANGÉ, tous les artistes sont interrogés', async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    // Fenêtre BPM DIFFÉRENTE du test précédent (110-125 plutôt que 130-150) —
    // `_artistBpmSearchCache` (musicEngine.js) est un cache MODULE-LEVEL,
    // partagé entre tous les tests de ce fichier (jamais réinitialisé, pas
    // exporté pour pouvoir le faire) ; sa clé inclut le couple BPM
    // (`${artistName}|${minBpm}|${maxBpm}`) — une fenêtre distincte garantit
    // qu'aucun résultat mis en cache par le test précédent ne fausse le
    // compte d'appels `fetch` observé ici.
    const artists = Array.from({ length: 10 }, (_, i) => `Artiste ${i + 1}`);
    // Pas de valeur de retour explicite — reproduit exactement la forme des
    // callbacks `onBatch` déjà existants dans le projet (aucun ne renvoie
    // quoi que ce soit).
    const onBatch = vi.fn(async () => {});

    await searchArtistsForBpm(artists, 110, 125, [], 10, 6, onBatch);

    // Les 2 lots (8 + 2) sont bien traités — rétrocompatibilité confirmée.
    expect(onBatch).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('sans `onBatch` du tout (undefined) : ne plante pas, parcourt tout le catalogue normalement', async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    // Encore une fenêtre BPM distincte des 2 tests précédents, même raison.
    const artists = ['Artiste A', 'Artiste B', 'Artiste C'];
    const result = await searchArtistsForBpm(artists, 90, 100, [], 3, 6);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
  });
});
