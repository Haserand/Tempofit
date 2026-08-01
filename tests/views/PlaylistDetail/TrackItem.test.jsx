// @vitest-environment jsdom
//
// Palier 3 (29/07, 6/11) — TrackItem. `usePlaylistDetail()`
// (PlaylistDetailContext) est mocké en intégralité. `getZoneForValue`/
// `getBpmBucketColor`/`getBpmBucketStart` (appConfig.js) et
// `getGenresForDisplay` (musicCatalog.js) sont aussi mockés : ce sont des
// fonctions pures déjà couvertes par leurs propres tests
// (athleticZones.test.js, musicCatalog.test.js) — les laisser réelles ici
// coupleraient ce test de composant à leurs règles métier internes.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUsePlaylistDetail = vi.fn();
vi.mock('../../../src/contexts/PlaylistDetailContext.jsx', () => ({
  usePlaylistDetail: () => mockUsePlaylistDetail(),
}));

vi.mock('../../../src/appConfig.js', () => ({
  getZoneForValue: vi.fn(() => null),
  getBpmBucketColor: vi.fn(() => '#123456'),
  getBpmBucketStart: vi.fn((bpm) => Math.floor(bpm / 20) * 20),
}));

vi.mock('../../../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((genre) => [genre]),
}));

import TrackItem from '../../../src/components/views/PlaylistDetail/TrackItem.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-text-color',
  bgAccentClass: 'mock-accent-bg',
};

const track = {
  id: 'track-1', trackId: 'deezer-1', title: 'Blitzkrieg Bop', artist: 'The Ramones',
  genre: 'Punk', bpm: 150, duration: 132, startTimeStr: '2m 30s', preview: 'url',
};

function makeContextValue(overrides = {}) {
  return {
    currentPlaylist: { tracks: [track], workoutType: 'Course à pied', config: {} },
    isNaughtyMode: false,
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
    isSaved: true,
    draggedTrackIndex: null,
    handleTrackDragStart: vi.fn(() => vi.fn()),
    handleTrackDragEnter: vi.fn(() => vi.fn()),
    handleTrackDragEnd: vi.fn(),
    openTrackMenuIndex: null,
    setOpenTrackMenuIndex: vi.fn(),
    handleDuplicateTrack: vi.fn(),
    handleReplaceTrackSameArtist: vi.fn(),
    handleReplaceTrack: vi.fn(),
    handleRemoveTrack: vi.fn(),
    playingPreviewId: null,
    resolvingTrackId: null,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    track, index: 0,
    theme: mockTheme, isLocked: false,
    favorites: { tracks: [], artists: [] },
    toggleTrackFavorite: vi.fn(),
    toggleArtistFavorite: vi.fn(),
    resolveAndTogglePreview: vi.fn(),
    getNextTrackForAutoAdvance: vi.fn(),
    isDimmed: false, isHighlighted: false,
    ...overrides,
  };
}

describe('TrackItem', () => {
  it('affiche titre, artiste, BPM et durée', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackItem {...baseProps()} />);
    expect(screen.getByText('Blitzkrieg Bop')).toBeInTheDocument();
    expect(screen.getByText(/The Ramones/)).toBeInTheDocument();
    expect(screen.getByText('150 BPM')).toBeInTheDocument();
  });

  it('le clic sur le bouton play appelle resolveAndTogglePreview avec le titre et le callback d\'auto-avance', () => {
    const resolveAndTogglePreview = vi.fn();
    const getNextTrackForAutoAdvance = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackItem {...baseProps({ resolveAndTogglePreview, getNextTrackForAutoAdvance })} />);

    fireEvent.click(screen.getByTitle('Écouter un extrait'));

    expect(resolveAndTogglePreview).toHaveBeenCalledWith(track, getNextTrackForAutoAdvance);
  });

  it('resolvingTrackId === track.id : affiche le loader plutôt que play/pause', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ resolvingTrackId: 'track-1' }));
    const { container } = render(<TrackItem {...baseProps()} />);
    expect(container.querySelector('.lucide-loader-circle, .animate-spin')).toBeTruthy();
  });

  it('playingPreviewId === track.trackId : affiche pause plutôt que play', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ playingPreviewId: 'deezer-1' }));
    const { container } = render(<TrackItem {...baseProps()} />);
    expect(container.querySelector('.lucide-pause')).toBeTruthy();
  });

  it('titre pas en favoris : clic sur l\'étoile appelle toggleTrackFavorite', () => {
    const toggleTrackFavorite = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackItem {...baseProps({ toggleTrackFavorite, favorites: { tracks: [], artists: [] } })} />);

    fireEvent.click(screen.getByTitle('Ajouter aux favoris'));

    expect(toggleTrackFavorite).toHaveBeenCalledWith(track);
  });

  it('titre déjà en favoris : affiche "Retirer des favoris"', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackItem {...baseProps({ favorites: { tracks: [{ trackId: 'deezer-1' }], artists: [] } })} />);
    expect(screen.getByTitle('Retirer des favoris')).toBeInTheDocument();
  });

  it('canEditTracks=true (sauvé, non verrouillé) : le titre est glissable et le bouton retirer appelle handleRemoveTrack', () => {
    const handleRemoveTrack = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, handleRemoveTrack }));
    const { container } = render(<TrackItem {...baseProps({ isLocked: false, index: 2 })} />);

    expect(container.firstChild).toHaveAttribute('draggable', 'true');
    fireEvent.click(screen.getByTitle('Retirer de la proposition'));
    expect(handleRemoveTrack).toHaveBeenCalledWith(2);
  });

  it('isLocked=true : affiche un cadenas, pas de bouton de suppression, pas glissable', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true }));
    const { container } = render(<TrackItem {...baseProps({ isLocked: true })} />);

    expect(container.firstChild).toHaveAttribute('draggable', 'false');
    expect(screen.queryByTitle('Retirer de la proposition')).not.toBeInTheDocument();
    // "Verrouillé" apparaît 2 fois (poignée de drag ET zone de suppression,
    // chacune avec son propre message) — on cible ici précisément celui du
    // cadenas de suppression, celui que ce test veut vérifier.
    expect(screen.getByTitle("Verrouillé — impossible de retirer un titre d'une séance déjà réalisée")).toBeInTheDocument();
  });

  it('isSaved=false (pas encore dans "Mes Séances") : pas de bouton de suppression, message dédié', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    render(<TrackItem {...baseProps({ isLocked: false })} />);
    expect(screen.queryByTitle('Retirer de la proposition')).not.toBeInTheDocument();
    expect(screen.getByTitle(/Ajoute cette séance à "Mes Séances" pour pouvoir retirer/)).toBeInTheDocument();
  });

  it('menu d\'options : canEditTracks=true propose Dupliquer/Remplacer, clic sur Dupliquer appelle handleDuplicateTrack et referme le menu', () => {
    const handleDuplicateTrack = vi.fn();
    const setOpenTrackMenuIndex = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, handleDuplicateTrack, setOpenTrackMenuIndex, openTrackMenuIndex: 0 }));
    render(<TrackItem {...baseProps({ index: 0 })} />);

    fireEvent.click(screen.getByText('Dupliquer ce titre'));

    expect(handleDuplicateTrack).toHaveBeenCalledWith(0);
    expect(setOpenTrackMenuIndex).toHaveBeenCalledWith(null);
  });

  it('menu d\'options : canEditTracks=false masque Dupliquer/Remplacer mais garde "Favoriser l\'artiste"', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false, openTrackMenuIndex: 0 }));
    render(<TrackItem {...baseProps({ index: 0 })} />);

    expect(screen.queryByText('Dupliquer ce titre')).not.toBeInTheDocument();
    expect(screen.getByText(/Favoriser l'artiste/)).toBeInTheDocument();
  });

  it('"Favoriser l\'artiste" appelle toggleArtistFavorite avec le nom de l\'artiste', () => {
    const toggleArtistFavorite = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ openTrackMenuIndex: 0 }));
    render(<TrackItem {...baseProps({ index: 0, toggleArtistFavorite })} />);

    fireEvent.click(screen.getByText(/Favoriser l'artiste/));

    expect(toggleArtistFavorite).toHaveBeenCalledWith('The Ramones');
  });

  it('le clic sur le fond du menu ouvert le referme (setOpenTrackMenuIndex(null))', () => {
    const setOpenTrackMenuIndex = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ openTrackMenuIndex: 0, setOpenTrackMenuIndex }));
    const { container } = render(<TrackItem {...baseProps({ index: 0 })} />);

    fireEvent.click(container.querySelector('.fixed.inset-0.z-10'));

    expect(setOpenTrackMenuIndex).toHaveBeenCalledWith(null);
  });

  it('zone configurée : affiche le libellé court de la zone', async () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ getProfileForWorkout: vi.fn(() => ({ isConfigured: true })) })
    );
    // getZoneForValue est mocké au niveau module : on le fait renvoyer une
    // zone concrète pour CE test uniquement.
    const appConfig = await import('../../../src/appConfig.js');
    appConfig.getZoneForValue.mockReturnValue({ key: 'zone3', shortLabel: 'Seuil', color: '#f59e0b' });

    render(<TrackItem {...baseProps()} />);
    expect(screen.getByText('Seuil')).toBeInTheDocument();
  });

  it('affiche l\'avertissement "Genre non confirmé" quand _genreMismatch est vrai', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackItem {...baseProps({ track: { ...track, _genreMismatch: true } })} />);
    expect(screen.getByText(/Genre non confirmé/)).toBeInTheDocument();
  });
});
