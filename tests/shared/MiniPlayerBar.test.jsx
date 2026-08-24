// @vitest-environment jsdom
//
// Premier fichier de test pour MiniPlayerBar.jsx — trouvé sans couverture
// réelle (check-up du 21/08) : seul `bottomBarLayout.test.js` le référence,
// et uniquement pour lire son code source en texte brut (vérifier qu'une
// constante CSS correspond bien à une classe Tailwind écrite en dur), pas
// pour monter/tester son comportement.
//
// AudioPlayerContext mocké dynamiquement (vi.fn() + mockReturnValue) plutôt
// qu'un mock statique — nécessaire pour piloter `currentTrack`/`isPlaying`
// différemment à chaque test (le composant retourne `null` tant que
// `currentTrack` est absent, voir sa docstring).
//
// `previewAudioRef` : un `EventTarget` natif + propriétés simples, même
// convention que AudioProgressBar.test.jsx (AudioProgressBar est monté
// RÉELLEMENT ici, en enfant de MiniPlayerBar, pas mocké — il a besoin d'un
// vrai EventTarget pour ses propres listeners `timeupdate`/`loadedmetadata`).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MiniPlayerBar from '../../src/components/shared/MiniPlayerBar.jsx';
import { useAudioPlayer } from '../../src/contexts/AudioPlayerContext.jsx';

vi.mock('../../src/contexts/AudioPlayerContext.jsx', () => ({
  useAudioPlayer: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function createMockAudioEl({ currentTime = 0, duration = NaN, volume = 1 } = {}) {
  const audio = new EventTarget();
  audio.currentTime = currentTime;
  audio.duration = duration;
  audio.volume = volume;
  return audio;
}

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  cardBorderStrong: 'mock-border-strong',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-accent',
  bgAccentClass: 'mock-accent-bg',
};

const baseTrack = { id: 'track-1', trackId: 'track-1', title: 'Midnight Runner', artist: 'Test Artist', bpm: 160 };

function mockAudioPlayer(overrides = {}) {
  return {
    currentTrack: null,
    isPlaying: false,
    pauseCurrentPreview: vi.fn(),
    resumeCurrentPreview: vi.fn(),
    stopCurrentPreview: vi.fn(),
    skipToNext: vi.fn(),
    skipToPrevious: vi.fn(),
    previewAudioRef: { current: createMockAudioEl() },
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    currentPlaylist: null,
    changeView: vi.fn(),
    ...overrides,
  };
}

describe('MiniPlayerBar', () => {
  it('ne rend RIEN (pas une barre vide) quand currentTrack est null', () => {
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: null }));
    const { container } = render(<MiniPlayerBar {...baseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche titre/artiste/BPM du titre en cours', () => {
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack }));
    render(<MiniPlayerBar {...baseProps()} />);
    expect(screen.getByText('Midnight Runner')).toBeInTheDocument();
    expect(screen.getByText('Test Artist · 160 BPM')).toBeInTheDocument();
  });

  it('n\'affiche pas le BPM si le titre n\'en a pas', () => {
    useAudioPlayer.mockReturnValue(mockAudioPlayer({
      currentTrack: { ...baseTrack, bpm: null },
    }));
    render(<MiniPlayerBar {...baseProps()} />);
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('bouton lecture/pause : affiche "Reprendre la lecture" si en pause, clic appelle resumeCurrentPreview', () => {
    const resumeCurrentPreview = vi.fn();
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack, isPlaying: false, resumeCurrentPreview }));
    render(<MiniPlayerBar {...baseProps()} />);
    const btn = screen.getByTitle('Reprendre la lecture');
    fireEvent.click(btn);
    expect(resumeCurrentPreview).toHaveBeenCalledTimes(1);
  });

  it('bouton lecture/pause : affiche "Mettre en pause" si en lecture, clic appelle pauseCurrentPreview', () => {
    const pauseCurrentPreview = vi.fn();
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack, isPlaying: true, pauseCurrentPreview }));
    render(<MiniPlayerBar {...baseProps()} />);
    const btn = screen.getByTitle('Mettre en pause');
    fireEvent.click(btn);
    expect(pauseCurrentPreview).toHaveBeenCalledTimes(1);
  });

  it('précédent/suivant transmettent les tracks de currentPlaylist (pas ceux d\'une autre playlist)', () => {
    const skipToPrevious = vi.fn();
    const skipToNext = vi.fn();
    const playlist = { id: 'pl-1', name: 'Ma Playlist', tracks: [baseTrack, { ...baseTrack, id: 'track-2', trackId: 'track-2' }] };
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack, skipToPrevious, skipToNext }));
    render(<MiniPlayerBar {...baseProps({ currentPlaylist: playlist })} />);

    fireEvent.click(screen.getByTitle('Titre précédent'));
    expect(skipToPrevious).toHaveBeenCalledWith(playlist.tracks);

    fireEvent.click(screen.getByTitle('Titre suivant'));
    expect(skipToNext).toHaveBeenCalledWith(playlist.tracks);
  });

  it('clic sur le bouton fermer appelle stopCurrentPreview', () => {
    const stopCurrentPreview = vi.fn();
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack, stopCurrentPreview }));
    render(<MiniPlayerBar {...baseProps()} />);
    fireEvent.click(screen.getByTitle('Fermer le lecteur'));
    expect(stopCurrentPreview).toHaveBeenCalledTimes(1);
  });

  it('contexte playlist affiché SEULEMENT si le titre en cours appartient VRAIMENT à currentPlaylist', () => {
    const playlist = { id: 'pl-1', name: 'Ma Playlist', tracks: [{ ...baseTrack, id: 'other-track' }] };
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack }));
    render(<MiniPlayerBar {...baseProps({ currentPlaylist: playlist })} />);
    // baseTrack.id ('track-1') n'est PAS dans playlist.tracks → pas de contexte affiché.
    expect(screen.queryByTitle('Aller à cette playlist')).not.toBeInTheDocument();
    expect(screen.queryByText(/Titre \d+\//)).not.toBeInTheDocument();
  });

  it('affiche le nom de playlist + position "Titre X/Y" quand le titre appartient bien à currentPlaylist, et le clic navigue', () => {
    const changeView = vi.fn();
    const trackB = { ...baseTrack, id: 'track-2', trackId: 'track-2' };
    const playlist = { id: 'pl-1', name: 'Ma Playlist', tracks: [baseTrack, trackB] };
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: trackB }));
    render(<MiniPlayerBar {...baseProps({ currentPlaylist: playlist, changeView })} />);

    expect(screen.getByText('Titre 2/2')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Aller à cette playlist'));
    expect(changeView).toHaveBeenCalledWith('playlist');
  });

  it('mute par clic : coupe le son (previewAudioRef.current.volume → 0) puis restaure le niveau précédent au 2e clic', () => {
    const audioEl = createMockAudioEl({ volume: 1 });
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack, previewAudioRef: { current: audioEl } }));
    render(<MiniPlayerBar {...baseProps()} />);

    const muteBtn = screen.getByTitle('Couper le son');
    fireEvent.click(muteBtn);
    expect(audioEl.volume).toBe(0);
    expect(screen.getByTitle('Réactiver le son')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Réactiver le son'));
    expect(audioEl.volume).toBe(1);
    expect(screen.getByTitle('Couper le son')).toBeInTheDocument();
  });

  it('curseur de volume (popup) : modifier la valeur applique le niveau sur previewAudioRef.current.volume', () => {
    const audioEl = createMockAudioEl({ volume: 1 });
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack, previewAudioRef: { current: audioEl } }));
    const { container } = render(<MiniPlayerBar {...baseProps()} />);

    // Popup non ouvert par défaut : le curseur n'est pas encore dans le DOM.
    expect(container.querySelector('input[type="range"]')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTitle('Couper le son').closest('div'));
    const slider = container.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '40' } });
    expect(audioEl.volume).toBeCloseTo(0.4);
  });

  it('popup de volume se ferme au mouseLeave', () => {
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack }));
    const { container } = render(<MiniPlayerBar {...baseProps()} />);
    const zone = screen.getByTitle('Couper le son').closest('div');

    fireEvent.mouseEnter(zone);
    expect(container.querySelector('input[type="range"]')).toBeInTheDocument();

    fireEvent.mouseLeave(zone);
    expect(container.querySelector('input[type="range"]')).not.toBeInTheDocument();
  });

  // ⚠️ NOUVEAU (22/08, MÊME JOUR, encore un retour direct — "ça ne paraît
  // toujours pas centré", capture d'écran à l'appui APRÈS un 1er correctif
  // déjà fait — voir Sidebar.jsx/GuestModeBar.jsx pour ce 1er correctif) :
  // mesuré en conditions réelles cette fois (Playwright avec un vrai
  // Chromium déjà en cache dans ce bac à sable, voir CLAUDE-SANDBOX-
  // VERIFICATION.md) — le bouton volume et le bouton fermer étaient des
  // FRÈRES de la zone "contexte playlist" plutôt que ses enfants,
  // décalant de 46px le vrai centre visuel des contrôles (les 2 zones
  // `flex-1` d'origine s'équilibraient entre elles, mais pas par rapport
  // au VRAI centre de la barre une fois volume+fermer comptés). Ce test
  // vérifie la STRUCTURE du correctif (regroupés dans un seul conteneur
  // flex-1), pas juste que ces éléments existent quelque part — une
  // assertion `getByTitle(...)` seule serait restée verte même avec
  // l'ancienne structure cassée.
  it('contexte playlist + volume + fermer sont regroupés dans UN SEUL conteneur flex-1 (régression centrage 22/08)', () => {
    const playlist = { id: 'pl-1', name: 'Ma Playlist', tracks: [baseTrack, { id: 'track-2', trackId: 'track-2', title: 'Autre titre' }] };
    useAudioPlayer.mockReturnValue(mockAudioPlayer({ currentTrack: baseTrack }));
    const { container } = render(<MiniPlayerBar {...baseProps({ currentPlaylist: playlist })} />);

    const rightZone = container.querySelector('.md\\:flex.items-center.justify-end.gap-2.min-w-0.flex-1');
    expect(rightZone).toBeInTheDocument();

    const playlistNameButton = screen.getByTitle('Aller à cette playlist');
    const volumeButton = screen.getByTitle('Couper le son');
    const closeButton = screen.getByTitle('Fermer le lecteur');

    expect(rightZone.contains(playlistNameButton)).toBe(true);
    expect(rightZone.contains(volumeButton)).toBe(true);
    expect(rightZone.contains(closeButton)).toBe(true);
  });
});
