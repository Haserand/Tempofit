// @vitest-environment jsdom
//
// Premier fichier de test pour AudioPlayerContext.jsx — jusqu'ici couvert
// seulement indirectement (via les tests des composants qui le mockent).
// Ajouté lors du check-up global du 19/08. `useAudioPreview` mocké — ce
// fichier vérifie que ce Provider est bien un simple PASSE-PLAT transparent
// (voir sa docstring : "ne fait QUE réexposer tel quel le retour du hook,
// rien à combiner") — pas de logique propre à tester au-delà de ça,
// contrairement à GeneratorContext.jsx.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const mockUseAudioPreview = vi.fn();
vi.mock('../../src/hooks/useAudioPreview.js', () => ({
  useAudioPreview: (...args) => mockUseAudioPreview(...args),
}));

import { AudioPlayerProvider, useAudioPlayer } from '../../src/contexts/AudioPlayerContext.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeAudioPlayerApi(overrides = {}) {
  return {
    playingPreviewId: null, togglePreview: vi.fn(),
    currentTrack: null, isPlaying: false,
    pauseCurrentPreview: vi.fn(), resumeCurrentPreview: vi.fn(), stopCurrentPreview: vi.fn(),
    resolveAndPlay: vi.fn(), resolvingTrackId: null,
    skipToNext: vi.fn(), skipToPrevious: vi.fn(),
    previewAudioRef: { current: null },
    ...overrides,
  };
}

const captured = [];
function Probe() {
  captured.push(useAudioPlayer());
  return null;
}

describe('AudioPlayerContext — comportement de base', () => {
  it('useAudioPlayer() hors Provider renvoie un repli inerte (pas de crash)', () => {
    captured.length = 0;
    render(<Probe />);
    expect(captured[0].playingPreviewId).toBeNull();
    expect(captured[0].isPlaying).toBe(false);
    expect(typeof captured[0].togglePreview).toBe('function');
  });

  it('transmet bien showToast (prop) à useAudioPreview(showToast)', () => {
    captured.length = 0;
    mockUseAudioPreview.mockReturnValue(makeAudioPlayerApi());
    const showToast = vi.fn();
    render(
      <AudioPlayerProvider showToast={showToast}>
        <Probe />
      </AudioPlayerProvider>
    );
    expect(mockUseAudioPreview).toHaveBeenCalledWith(showToast);
  });

  it('réexpose TOUS les champs du retour de useAudioPreview() tels quels (passe-plat, voir la docstring)', () => {
    captured.length = 0;
    const api = makeAudioPlayerApi({ currentTrack: { trackId: 't1' }, isPlaying: true, playingPreviewId: 't1' });
    mockUseAudioPreview.mockReturnValue(api);
    render(
      <AudioPlayerProvider showToast={vi.fn()}>
        <Probe />
      </AudioPlayerProvider>
    );
    expect(captured[0]).toBe(api); // MÊME référence, pas une copie/un nouvel objet
  });
});

// La raison d'être documentée de ce Contexte (voir sa docstring "DEPUIS LE
// 08/08") : ne PAS ajouter de `useMemo` séparé ici, puisque
// `useAudioPreview.js` renvoie déjà un objet mémoïsé — un `useMemo`
// supplémentaire serait redondant, pas incorrect, mais la vraie garantie à
// tester est que ce Provider ne CASSE PAS la stabilité déjà obtenue côté
// hook en la enveloppant dans quoi que ce soit.
describe('AudioPlayerContext — ne casse pas la stabilité référentielle déjà garantie par le hook', () => {
  it('si useAudioPreview() renvoie la MÊME référence entre 2 rendus, la value du Contexte reste la MÊME référence', () => {
    captured.length = 0;
    const api = makeAudioPlayerApi();
    mockUseAudioPreview.mockReturnValue(api); // même référence à chaque appel
    const { rerender } = render(
      <AudioPlayerProvider showToast={vi.fn()}>
        <Probe />
      </AudioPlayerProvider>
    );
    rerender(
      <AudioPlayerProvider showToast={vi.fn()}>
        <Probe />
      </AudioPlayerProvider>
    );
    expect(captured.length).toBe(2);
    expect(captured[1]).toBe(captured[0]);
  });
});
