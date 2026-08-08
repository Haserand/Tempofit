// @vitest-environment jsdom
//
// Test dédié pour PlaylistHeaderCover.jsx — extrait de
// PlaylistHeader.test.jsx (08/08, découpage) : ces 3 tests testaient déjà
// exactement ce périmètre via le composant parent, simplement déplacés
// pour rendre CE composant directement (props à la main, plus besoin de
// passer par usePlaylistDetail() ni par PlaylistHeader.jsx).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../src/utils/coverArt.js', () => ({
  buildCoverUrl: vi.fn((name) => `generated-cover://${name}`),
}));

import PlaylistHeaderCover from '../../../src/components/views/PlaylistDetail/PlaylistHeaderCover.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const track1 = { id: 't1', bpm: 140 };

function makePlaylist(overrides = {}) {
  return { name: 'Ma Séance', tracks: [track1], coverUrl: null, ...overrides };
}

function baseProps(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    bgAccentClass: 'mock-accent-bg',
    resolveAndTogglePreview: vi.fn(),
    getNextTrackForAutoAdvance: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistHeaderCover', () => {
  it('utilise coverUrl si présent, sinon buildCoverUrl(name)', () => {
    const { container, rerender } = render(<PlaylistHeaderCover {...baseProps({ currentPlaylist: makePlaylist({ coverUrl: 'https://real-cover.jpg' }) })} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('https://real-cover.jpg');

    rerender(<PlaylistHeaderCover {...baseProps({ currentPlaylist: makePlaylist({ coverUrl: null, name: 'Ma Séance' }) })} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('generated-cover://Ma Séance');
  });

  it('le clic sur la pochette lance la lecture du 1er titre', () => {
    const resolveAndTogglePreview = vi.fn();
    const getNextTrackForAutoAdvance = vi.fn();
    render(<PlaylistHeaderCover {...baseProps({ resolveAndTogglePreview, getNextTrackForAutoAdvance })} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(resolveAndTogglePreview).toHaveBeenCalledWith(track1, getNextTrackForAutoAdvance);
  });

  it('sans aucun titre, le clic sur la pochette n\'appelle pas resolveAndTogglePreview', () => {
    const resolveAndTogglePreview = vi.fn();
    render(<PlaylistHeaderCover {...baseProps({ currentPlaylist: makePlaylist({ tracks: [] }), resolveAndTogglePreview })} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(resolveAndTogglePreview).not.toHaveBeenCalled();
  });
});
