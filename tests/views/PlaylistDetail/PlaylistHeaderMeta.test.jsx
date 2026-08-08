// @vitest-environment jsdom
//
// Test dédié pour PlaylistHeaderMeta.jsx — extrait de
// PlaylistHeader.test.jsx (08/08, découpage).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((genre) => [genre]),
  genreDisplayLabel: vi.fn((genre) => genre),
}));

vi.mock('../../../src/components/shared/TopCompletionDate.jsx', () => ({
  // Rendu inline (span, pas div) : PlaylistHeaderMeta.jsx insère ce
  // composant À L'INTÉRIEUR d'un <p> — un <div> y serait du HTML invalide.
  default: () => <span data-testid="top-completion-date-mock">TopCompletionDate (mock)</span>,
}));

vi.mock('../../../src/components/shared/CompletionsList.jsx', () => ({
  default: () => <div data-testid="completions-list-mock">CompletionsList (mock)</div>,
}));

import PlaylistHeaderMeta from '../../../src/components/views/PlaylistDetail/PlaylistHeaderMeta.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const track1 = { id: 't1', genre: 'Rock' };
const track2 = { id: 't2', genre: 'Métal' };

function makePlaylist(overrides = {}) {
  return {
    workoutType: 'Course à pied', totalDuration: 410, tracks: [track1, track2],
    completions: [], config: {},
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    theme: {},
    isLocked: false,
    isReadOnly: false,
    editingCompletion: null,
    setEditingCompletion: vi.fn(),
    editCompletionDate: vi.fn(),
    removeCompletionDate: vi.fn(),
    triggerCSVUpload: vi.fn(),
    removeImportedData: vi.fn(),
    mostRecentCompletionIso: null,
    ...overrides,
  };
}

describe('PlaylistHeaderMeta — ligne d\'infos', () => {
  it('affiche le type de séance, la durée et le nombre de titres', () => {
    render(<PlaylistHeaderMeta {...baseProps()} />);
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
    expect(screen.getByText('2 titres')).toBeInTheDocument();
  });

  it('genres : affiche cfg.selectedGenres (via genreDisplayLabel) en priorité sur les genres réels des titres', () => {
    render(<PlaylistHeaderMeta {...baseProps({ currentPlaylist: makePlaylist({ config: { selectedGenres: ['Rock', 'Pop'] } }) })} />);
    expect(screen.getByText('Rock, Pop')).toBeInTheDocument();
  });

  it('genres : sans cfg.selectedGenres, replie sur les genres réels des titres', () => {
    render(<PlaylistHeaderMeta {...baseProps({ currentPlaylist: makePlaylist({ config: {}, tracks: [{ ...track1, genre: 'Techno' }] }) })} />);
    expect(screen.getByText('Techno')).toBeInTheDocument();
  });
});

describe('PlaylistHeaderMeta — badge "séance déjà réalisée"', () => {
  it('isLocked + au moins 1 complétion : affiche TopCompletionDate, et CompletionsList seulement si >1 complétion', () => {
    const { rerender } = render(<PlaylistHeaderMeta {...baseProps({
      isLocked: true, currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }),
    })} />);
    expect(screen.getByTestId('top-completion-date-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('completions-list-mock')).not.toBeInTheDocument();

    rerender(<PlaylistHeaderMeta {...baseProps({
      isLocked: true, currentPlaylist: makePlaylist({ completions: ['2026-01-01', '2026-01-08'] }),
    })} />);
    expect(screen.getByTestId('completions-list-mock')).toBeInTheDocument();
  });

  it('sans isLocked ou sans complétion : aucun badge affiché', () => {
    render(<PlaylistHeaderMeta {...baseProps({ isLocked: false, currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }) })} />);
    expect(screen.queryByTestId('top-completion-date-mock')).not.toBeInTheDocument();
  });
});
