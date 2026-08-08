// @vitest-environment jsdom
//
// Test dédié pour PlaylistHeaderBadges.jsx — extrait de
// PlaylistHeader.test.jsx (08/08, découpage). `currentPlaylistRank`/
// `currentPlaylistRankStyle` sont reçus ici en props DIRECTES (le calcul
// du classement lui-même reste testé côté PlaylistHeader.test.jsx, qui
// vérifie que la bonne valeur est transmise).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import PlaylistHeaderBadges from '../../../src/components/views/PlaylistDetail/PlaylistHeaderBadges.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makePlaylist(overrides = {}) {
  return { completions: [], isPublic: false, ...overrides };
}

function baseProps(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    currentPlaylistRank: -1,
    currentPlaylistRankStyle: null,
    isSaved: true,
    isReadOnly: false,
    handleTogglePlaylistPublic: vi.fn(),
    handleUnsavePlaylist: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistHeaderBadges', () => {
  it('médaille de rang affichée seulement si currentPlaylistRankStyle est fourni', () => {
    const { rerender } = render(<PlaylistHeaderBadges {...baseProps({ currentPlaylistRankStyle: null })} />);
    expect(screen.queryByText('🥇')).not.toBeInTheDocument();

    rerender(<PlaylistHeaderBadges {...baseProps({ currentPlaylistRankStyle: { emoji: '🥇' }, currentPlaylistRank: 0 })} />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
  });

  it('badge "Lecture seule" (icône + title) affiché si isSaved=false, absent si isSaved=true', () => {
    const { rerender } = render(<PlaylistHeaderBadges {...baseProps({ isSaved: false })} />);
    expect(screen.getByTitle(/Lecture seule/)).toBeInTheDocument();

    rerender(<PlaylistHeaderBadges {...baseProps({ isSaved: true })} />);
    expect(screen.queryByTitle(/Lecture seule/)).not.toBeInTheDocument();
  });

  it('bouton "Retirer" : présent si isSaved=true, le clic appelle handleUnsavePlaylist', () => {
    const handleUnsavePlaylist = vi.fn();
    render(<PlaylistHeaderBadges {...baseProps({ isSaved: true, handleUnsavePlaylist })} />);

    fireEvent.click(screen.getByTitle("Retirer cette séance de 'Mes Séances'"));
    expect(handleUnsavePlaylist).toHaveBeenCalled();
  });

  describe('toggle publique/privée', () => {
    it('absent quand isSaved=false', () => {
      render(<PlaylistHeaderBadges {...baseProps({ isSaved: false })} />);
      expect(screen.queryByTitle('Rendre cette playlist visible sur ton profil public')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Visible sur ton profil public — clique pour la rendre privée')).not.toBeInTheDocument();
    });

    it('title dépend de currentPlaylist.isPublic', () => {
      const { rerender } = render(<PlaylistHeaderBadges {...baseProps({ currentPlaylist: makePlaylist({ isPublic: false }) })} />);
      expect(screen.getByTitle('Rendre cette playlist visible sur ton profil public')).toBeInTheDocument();

      rerender(<PlaylistHeaderBadges {...baseProps({ currentPlaylist: makePlaylist({ isPublic: true }) })} />);
      expect(screen.getByTitle('Visible sur ton profil public — clique pour la rendre privée')).toBeInTheDocument();
      expect(screen.queryByTitle('Rendre cette playlist visible sur ton profil public')).not.toBeInTheDocument();
    });

    it('le clic appelle handleTogglePlaylistPublic', () => {
      const handleTogglePlaylistPublic = vi.fn();
      render(<PlaylistHeaderBadges {...baseProps({ handleTogglePlaylistPublic })} />);
      fireEvent.click(screen.getByTitle('Rendre cette playlist visible sur ton profil public'));
      expect(handleTogglePlaylistPublic).toHaveBeenCalled();
    });
  });

  // Défense en profondeur (`isSaved && !isReadOnly` sur les 2 boutons) —
  // reste absent même si isSaved=true dès que isReadOnly=true.
  it('isReadOnly=true masque toggle publique/privée ET "Retirer", même si isSaved=true', () => {
    render(<PlaylistHeaderBadges {...baseProps({ isReadOnly: true, isSaved: true, currentPlaylist: makePlaylist({ isPublic: true }) })} />);
    expect(screen.queryByTitle('Visible sur ton profil public — clique pour la rendre privée')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Rendre cette playlist visible sur ton profil public')).not.toBeInTheDocument();
    expect(screen.queryByTitle("Retirer cette séance de 'Mes Séances'")).not.toBeInTheDocument();
  });
});
