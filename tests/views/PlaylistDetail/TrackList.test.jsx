// @vitest-environment jsdom
//
// Palier 3 (29/07, 7/11) — TrackList. `usePlaylistDetail()` et
// `useModalContext()` mockés. `TrackItem` est mocké par un stub léger qui
// expose juste assez de props pour vérifier ce que TrackList lui transmet
// (notamment `isDimmed`/`isHighlighted`, calculés ICI) — sa propre logique
// interne est déjà couverte par tests/TrackItem.test.jsx.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUsePlaylistDetail = vi.fn();
vi.mock('../../../src/contexts/PlaylistDetailContext.jsx', () => ({
  usePlaylistDetail: () => mockUsePlaylistDetail(),
}));

const mockOpenModal = vi.fn();
vi.mock('../../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ openModal: mockOpenModal, activeModal: null, modalData: null, closeModal: vi.fn() }),
}));

vi.mock('../../../src/components/views/PlaylistDetail/TrackItem.jsx', () => ({
  default: ({ track, isDimmed, isHighlighted }) => (
    <div data-testid={`track-${track.id}`} data-dimmed={String(isDimmed)} data-highlighted={String(isHighlighted)}>
      {track.title}
    </div>
  ),
}));

import TrackList from '../../../src/components/views/PlaylistDetail/TrackList.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textMuted: 'mock-muted',
  textHighlight: 'mock-highlight',
  textColorClass: 'mock-text-color',
  inputBorder: 'mock-input-border',
};

const trackA = { id: 't1', title: 'Titre A' };
const trackB = { id: 't2', title: 'Titre B' };

function makeContextValue(overrides = {}) {
  return {
    currentPlaylist: { tracks: [trackA, trackB] },
    isSaved: true,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isLocked: false,
    favorites: { tracks: [], artists: [] },
    toggleTrackFavorite: vi.fn(),
    toggleArtistFavorite: vi.fn(),
    resolveAndTogglePreview: vi.fn(),
    getNextTrackForAutoAdvance: vi.fn(),
    setIsBpmSearchMode: vi.fn(),
    hasDetailFilter: false,
    trackMatchesDetailFilter: vi.fn(() => true),
    selectedDetailGenre: new Set(),
    selectedDetailBpmBucket: new Set(),
    setSelectedDetailGenre: vi.fn(),
    setSelectedDetailBpmBucket: vi.fn(),
    isBpmChartUsingRealProfile: false,
    ...overrides,
  };
}

describe('TrackList', () => {
  it('affiche un TrackItem par titre de la playlist', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackList {...baseProps()} />);
    expect(screen.getByTestId('track-t1')).toHaveTextContent('Titre A');
    expect(screen.getByTestId('track-t2')).toHaveTextContent('Titre B');
  });

  it('sans filtre actif (hasDetailFilter=false) : aucun titre n\'est estompé ni surligné', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackList {...baseProps({ hasDetailFilter: false })} />);
    expect(screen.getByTestId('track-t1')).toHaveAttribute('data-dimmed', 'false');
    expect(screen.getByTestId('track-t1')).toHaveAttribute('data-highlighted', 'false');
  });

  it('avec filtre actif : un titre qui matche est surligné, un titre qui ne matche pas est estompé', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    const trackMatchesDetailFilter = vi.fn((track) => track.id === 't1');
    render(<TrackList {...baseProps({ hasDetailFilter: true, trackMatchesDetailFilter })} />);

    expect(screen.getByTestId('track-t1')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('track-t1')).toHaveAttribute('data-dimmed', 'false');
    expect(screen.getByTestId('track-t2')).toHaveAttribute('data-highlighted', 'false');
    expect(screen.getByTestId('track-t2')).toHaveAttribute('data-dimmed', 'true');
  });

  it('le bandeau de filtre n\'apparaît que si hasDetailFilter=true, et "Réinitialiser" vide les 2 filtres', () => {
    const setSelectedDetailGenre = vi.fn();
    const setSelectedDetailBpmBucket = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    const { rerender } = render(<TrackList {...baseProps({ hasDetailFilter: false })} />);
    expect(screen.queryByText('Réinitialiser')).not.toBeInTheDocument();

    rerender(<TrackList {...baseProps({ hasDetailFilter: true, setSelectedDetailGenre, setSelectedDetailBpmBucket })} />);
    fireEvent.click(screen.getByText('Réinitialiser'));

    expect(setSelectedDetailGenre).toHaveBeenCalledWith(new Set());
    expect(setSelectedDetailBpmBucket).toHaveBeenCalledWith(new Set());
  });

  it('le bandeau de filtre affiche les genres et buckets BPM sélectionnés', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(
      <TrackList
        {...baseProps({
          hasDetailFilter: true,
          selectedDetailGenre: new Set(['Rock', 'Pop']),
          selectedDetailBpmBucket: new Set(['140-159']),
          isBpmChartUsingRealProfile: false,
        })}
      />
    );
    expect(screen.getByText(/Rock, Pop/)).toBeInTheDocument();
    expect(screen.getByText(/140-159 BPM/)).toBeInTheDocument();
  });

  it('suffixe "BPM" masqué quand isBpmChartUsingRealProfile=true (le bucket est déjà un vrai nom de zone)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(
      <TrackList
        {...baseProps({
          hasDetailFilter: true,
          selectedDetailBpmBucket: new Set(['Seuil']),
          isBpmChartUsingRealProfile: true,
        })}
      />
    );
    expect(screen.getByText('Seuil')).toBeInTheDocument();
    expect(screen.queryByText(/Seuil BPM/)).not.toBeInTheDocument();
  });

  it('isLocked=true : affiche le message verrouillé, pas de bouton d\'ajout', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<TrackList {...baseProps({ isLocked: true })} />);
    expect(screen.getByText(/Séance déjà réalisée/)).toBeInTheDocument();
    expect(screen.queryByText('Ajouter un titre')).not.toBeInTheDocument();
  });

  it('isSaved=false : affiche le message dédié, pas de bouton d\'ajout', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    render(<TrackList {...baseProps({ isLocked: false })} />);
    expect(screen.getByText(/pour pouvoir ajouter, dupliquer, remplacer ou retirer des titres/)).toBeInTheDocument();
    expect(screen.queryByText('Ajouter un titre')).not.toBeInTheDocument();
  });

  it('isLocked=false et isSaved=true : le bouton "Ajouter un titre" appelle setIsBpmSearchMode(false) puis openModal("SEARCH")', () => {
    const setIsBpmSearchMode = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true }));
    render(<TrackList {...baseProps({ isLocked: false, setIsBpmSearchMode })} />);

    fireEvent.click(screen.getByText('Ajouter un titre'));

    expect(setIsBpmSearchMode).toHaveBeenCalledWith(false);
    expect(mockOpenModal).toHaveBeenCalledWith('SEARCH');
  });
});
