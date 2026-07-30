// @vitest-environment jsdom
//
// Palier 2 (29/07, 7/10) — AudioProgressBar, temps écoulé + barre de
// progression de l'extrait audio en cours. Ne reçoit jamais un vrai élément
// <audio> en test (jsdom ne joue pas de son) — un `EventTarget` natif
// suffit à simuler `addEventListener`/`dispatchEvent`, avec `currentTime`/
// `duration` ajoutés comme propriétés simples : ce composant ne lit/écrit
// jamais rien d'autre sur cette ref.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AudioProgressBar from '../src/components/shared/AudioProgressBar.jsx';

afterEach(() => {
  cleanup();
});

function createMockAudio({ currentTime = 0, duration = NaN } = {}) {
  const audio = new EventTarget();
  audio.currentTime = currentTime;
  audio.duration = duration;
  return audio;
}

const mockTheme = { textMuted: 'mock-muted', bgAccentClass: 'mock-accent-bg' };

describe('AudioProgressBar', () => {
  it('affiche 0:00 / 0:30 par défaut quand la durée réelle n\'est pas encore connue (duration=NaN)', () => {
    const audioRef = { current: createMockAudio({ currentTime: 0, duration: NaN }) };
    render(<AudioProgressBar audioRef={audioRef} {...mockTheme} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:30')).toBeInTheDocument();
  });

  it('adopte les valeurs déjà présentes sur la ref AU MONTAGE (ex. reprise après pause)', () => {
    const audioRef = { current: createMockAudio({ currentTime: 12, duration: 28 }) };
    render(<AudioProgressBar audioRef={audioRef} {...mockTheme} />);
    expect(screen.getByText('0:12')).toBeInTheDocument();
    expect(screen.getByText('0:28')).toBeInTheDocument();
  });

  it('met à jour le temps écoulé affiché sur l\'événement "timeupdate"', () => {
    const audio = createMockAudio({ currentTime: 0, duration: 30 });
    const audioRef = { current: audio };
    render(<AudioProgressBar audioRef={audioRef} {...mockTheme} />);

    act(() => {
      audio.currentTime = 7;
      audio.dispatchEvent(new Event('timeupdate'));
    });

    expect(screen.getByText('0:07')).toBeInTheDocument();
  });

  it('met à jour la durée affichée sur l\'événement "loadedmetadata"', () => {
    const audio = createMockAudio({ currentTime: 0, duration: NaN });
    const audioRef = { current: audio };
    render(<AudioProgressBar audioRef={audioRef} {...mockTheme} />);

    act(() => {
      audio.duration = 25;
      audio.dispatchEvent(new Event('loadedmetadata'));
    });

    expect(screen.getByText('0:25')).toBeInTheDocument();
  });

  it('ne plante pas quand audioRef.current est null (ref pas encore attachée)', () => {
    const audioRef = { current: null };
    render(<AudioProgressBar audioRef={audioRef} {...mockTheme} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:30')).toBeInTheDocument();
  });

  it('calcule la largeur de la barre de progression proportionnellement à currentTime/duration', () => {
    const audio = createMockAudio({ currentTime: 15, duration: 30 });
    const audioRef = { current: audio };
    const { container } = render(<AudioProgressBar audioRef={audioRef} {...mockTheme} />);

    const bar = container.querySelector('[style*="width"]');
    expect(bar.style.width).toBe('50%');
  });

  it('plafonne la barre de progression à 100% même si currentTime dépasse duration', () => {
    const audio = createMockAudio({ currentTime: 45, duration: 30 });
    const audioRef = { current: audio };
    const { container } = render(<AudioProgressBar audioRef={audioRef} {...mockTheme} />);

    const bar = container.querySelector('[style*="width"]');
    expect(bar.style.width).toBe('100%');
  });
});
