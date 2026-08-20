// @vitest-environment jsdom
//
// Premier fichier de test pour useAudioPreview.js (08/08, chantier "value
// non mémoïsée re-render tout le monde" — suite de GeneratorContext.jsx,
// même principe appliqué à AudioPlayerContext.jsx). Ciblé sur le
// comportement AJOUTÉ ce jour-là (mémoïsation du retour) + un test de
// comportement de base (`togglePreview`) pour s'assurer que la
// mémoïsation n'a rien cassé — pas une couverture exhaustive des 9
// fonctions du hook (resolveAndPlay/skipToNext/skipToPrevious/
// pauseCurrentPreview/etc., déjà couvertes indirectement via les
// composants qui les utilisent).
//
// jsdom ne fournit qu'un `Audio`/`HTMLMediaElement` minimal (`.play()` n'y
// est pas implémenté et lève une exception "Not implemented") — mocké ici
// globalement, une seule fois, avec un `.play()` qui renvoie une Promise
// résolue (comme un vrai navigateur) pour que `audio.play().catch(...)`
// (voir playTrack, useAudioPreview.js) ne plante jamais dans ces tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPreview } from '../../src/hooks/useAudioPreview.js';

// NOUVEAU (19/08, check-up global) — mock nécessaire pour les tests de
// `resolveAndPlay` ajoutés ce jour-là (correctif de course, voir sa
// docstring dans useAudioPreview.js). Absent jusqu'ici, cette fonction
// n'avait aucun test dédié.
const mockResolveDeezerTrack = vi.fn();
vi.mock('../../src/engine/musicEngine.js', () => ({
  resolveDeezerTrackByTitleArtist: (...args) => mockResolveDeezerTrack(...args),
}));

class MockAudio {
  constructor() {
    this.src = '';
    this.currentTime = 0;
    this._listeners = {};
  }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener(event, cb) { this._listeners[event] = cb; }
}

beforeEach(() => {
  global.Audio = MockAudio;
});

afterEach(() => {
  // `resetAllMocks()` plutôt que `clearAllMocks()` — même convention que
  // spotifyEngine.test.js (19/08)/usePersistentState.test.js (13/08) :
  // évite toute fuite d'un `mockImplementationOnce` non consommé.
  vi.resetAllMocks();
});

function makeTrack(overrides = {}) {
  return { trackId: 't1', id: 'id1', title: 'Titre', artist: 'Artiste', preview: 'https://example.com/preview.mp3', ...overrides };
}

describe('useAudioPreview — togglePreview, comportement de base (inchangé)', () => {
  it('lance la lecture d\'un titre (playingPreviewId/currentTrack/isPlaying mis à jour)', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useAudioPreview(showToast));
    const track = makeTrack();

    await act(async () => { result.current.togglePreview(track); });

    expect(result.current.playingPreviewId).toBe('t1');
    expect(result.current.currentTrack).toEqual(track);
    expect(result.current.isPlaying).toBe(true);
  });

  it('re-cliquer le MÊME titre l\'arrête (stop & oublie)', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useAudioPreview(showToast));
    const track = makeTrack();

    await act(async () => { result.current.togglePreview(track); });
    await act(async () => { result.current.togglePreview(track); });

    expect(result.current.playingPreviewId).toBeNull();
    expect(result.current.currentTrack).toBeNull();
    expect(result.current.isPlaying).toBe(false);
  });

  it('un titre sans extrait (`preview` absent) ne fait rien', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useAudioPreview(showToast));
    const track = makeTrack({ preview: null });

    await act(async () => { result.current.togglePreview(track); });

    expect(result.current.playingPreviewId).toBeNull();
  });
});

// NOUVEAU (08/08) — la vraie raison d'être de ce fichier : vérifier que le
// retour de ce hook reste RÉFÉRENTIELLEMENT STABLE d'un rendu à l'autre
// tant qu'aucune des valeurs réactives dont il dépend n'a changé —
// condition nécessaire pour qu'`AudioPlayerContext.jsx` (qui réexpose ce
// retour tel quel comme `value` de son Provider) arrête de re-render
// `MiniPlayerBar.jsx` (montée globalement) à chaque rendu sans rapport.
describe('useAudioPreview — stabilité référentielle du retour (NOUVEAU, 08/08)', () => {
  it('renvoie le MÊME objet si le composant appelant re-rend sans que rien ici n\'ait changé', () => {
    const showToast = vi.fn();
    const { result, rerender } = renderHook(() => useAudioPreview(showToast));

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second).toBe(first);
  });

  it('renvoie un NOUVEL objet quand playingPreviewId change réellement (togglePreview)', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useAudioPreview(showToast));

    const before = result.current;
    await act(async () => { result.current.togglePreview(makeTrack()); });
    const after = result.current;

    expect(after).not.toBe(before);
    expect(after.playingPreviewId).toBe('t1');
  });

  it('togglePreview lui-même change de référence quand playingPreviewId change (dépendance réelle du useMemo englobant)', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useAudioPreview(showToast));

    const before = result.current.togglePreview;
    await act(async () => { result.current.togglePreview(makeTrack()); });
    const after = result.current.togglePreview;

    expect(after).not.toBe(before);
  });
});

function makeUnresolvedTrack(overrides = {}) {
  return { id: 'idU', title: 'Titre', artist: 'Artiste', preview: null, ...overrides };
}

describe('useAudioPreview — resolveAndPlay, comportement de base', () => {
  it('titre déjà résolu (preview présent) : joue directement, sans appeler resolveDeezerTrackByTitleArtist', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useAudioPreview(showToast));
    const track = makeTrack();

    let returned;
    await act(async () => { returned = await result.current.resolveAndPlay(track); });

    expect(mockResolveDeezerTrack).not.toHaveBeenCalled();
    expect(returned).toBe(track);
    expect(result.current.playingPreviewId).toBe('t1');
  });

  it('titre non résolu : appelle resolveDeezerTrackByTitleArtist puis joue le titre mis à jour', async () => {
    const showToast = vi.fn();
    mockResolveDeezerTrack.mockResolvedValue({ id: 'deezer1', preview: 'https://deezer.example/x.mp3' });
    const { result } = renderHook(() => useAudioPreview(showToast));
    const track = makeUnresolvedTrack();

    let returned;
    await act(async () => { returned = await result.current.resolveAndPlay(track); });

    expect(mockResolveDeezerTrack).toHaveBeenCalledWith('Titre', 'Artiste');
    expect(returned).toEqual({ ...track, trackId: 'deezer-deezer1', preview: 'https://deezer.example/x.mp3' });
    expect(result.current.playingPreviewId).toBe('deezer-deezer1');
    expect(result.current.resolvingTrackId).toBeNull(); // effacé normalement, sans course
  });

  it('aucun extrait trouvé : toast d\'erreur, resolvingTrackId effacé, rien ne joue', async () => {
    const showToast = vi.fn();
    mockResolveDeezerTrack.mockResolvedValue(null);
    const { result } = renderHook(() => useAudioPreview(showToast));

    let returned;
    await act(async () => { returned = await result.current.resolveAndPlay(makeUnresolvedTrack()); });

    expect(returned).toBeNull();
    expect(showToast).toHaveBeenCalledWith("Extrait audio introuvable pour ce titre.", 'error');
    expect(result.current.playingPreviewId).toBeNull();
    expect(result.current.resolvingTrackId).toBeNull();
  });

  it('double-clic sur LE MÊME titre pendant sa résolution : renvoie null immédiatement, ne relance pas de résolution', async () => {
    const showToast = vi.fn();
    let resolveNetwork;
    mockResolveDeezerTrack.mockImplementationOnce(() => new Promise((r) => { resolveNetwork = r; }));
    const { result } = renderHook(() => useAudioPreview(showToast));
    const track = makeUnresolvedTrack();

    let firstCallPromise;
    act(() => { firstCallPromise = result.current.resolveAndPlay(track); });
    expect(result.current.resolvingTrackId).toBe('idU');

    let secondCallResult;
    await act(async () => { secondCallResult = await result.current.resolveAndPlay(track); });
    expect(secondCallResult).toBeNull();
    expect(mockResolveDeezerTrack).toHaveBeenCalledTimes(1); // pas de 2e appel réseau

    await act(async () => { resolveNetwork({ id: 'd1', preview: 'https://deezer.example/x.mp3' }); await firstCallPromise; });
  });
});

// RÉGRESSION (19/08, check-up global) — le vrai bug corrigé : le garde-fou
// ci-dessus ne bloque qu'un double-clic sur LE MÊME titre. Rien n'empêchait
// de cliquer un titre B pendant que la résolution d'un titre A était encore
// en vol — voir la docstring de `resolveAndPlay` (useAudioPreview.js) pour
// le détail complet du scénario et de la décision ("ignorer entièrement une
// résolution devenue obsolète").
describe('useAudioPreview — resolveAndPlay, course entre 2 titres DIFFÉRENTS (correctif du 19/08)', () => {
  it('la résolution de A, terminée APRÈS que B ait été demandé, est ignorée ENTIÈREMENT (ne joue pas, n\'efface pas resolvingTrackId de B)', async () => {
    const showToast = vi.fn();
    let resolveA, resolveB;
    mockResolveDeezerTrack
      .mockImplementationOnce(() => new Promise((r) => { resolveA = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolveB = r; }));
    const { result } = renderHook(() => useAudioPreview(showToast));
    const trackA = makeUnresolvedTrack({ id: 'idA', title: 'Titre A' });
    const trackB = makeUnresolvedTrack({ id: 'idB', title: 'Titre B' });

    // A demandé, résolution réseau en vol.
    let promiseA;
    act(() => { promiseA = result.current.resolveAndPlay(trackA); });
    expect(result.current.resolvingTrackId).toBe('idA');

    // B demandé AVANT que A n'ait fini — le garde-fou existant laisse passer
    // (id différent), résolution réseau de B également en vol.
    let promiseB;
    act(() => { promiseB = result.current.resolveAndPlay(trackB); });
    expect(result.current.resolvingTrackId).toBe('idB'); // écrasé par B, comportement voulu

    // La résolution de A se termine enfin, APRÈS B.
    let returnedA;
    await act(async () => {
      resolveA({ id: 'deezerA', preview: 'https://deezer.example/a.mp3' });
      returnedA = await promiseA;
    });

    // Ignorée entièrement : ni lecture de A, ni toast, ni valeur utile.
    expect(returnedA).toBeNull();
    expect(showToast).not.toHaveBeenCalled();
    expect(result.current.playingPreviewId).toBeNull(); // rien ne joue encore
    // Le `finally` de A ne doit PAS avoir effacé resolvingTrackId de B.
    expect(result.current.resolvingTrackId).toBe('idB');

    // B se résout à son tour — DOIT jouer normalement.
    let returnedB;
    await act(async () => {
      resolveB({ id: 'deezerB', preview: 'https://deezer.example/b.mp3' });
      returnedB = await promiseB;
    });

    expect(returnedB).toEqual({ ...trackB, trackId: 'deezer-deezerB', preview: 'https://deezer.example/b.mp3' });
    expect(result.current.playingPreviewId).toBe('deezer-deezerB');
    expect(result.current.resolvingTrackId).toBeNull();
  });
});
