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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPreview } from '../../src/hooks/useAudioPreview.js';

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
