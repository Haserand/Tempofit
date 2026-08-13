// @vitest-environment jsdom
//
// Palier 3 (29/07, 8/11 ; découpé 08/08). Depuis le découpage de
// PlaylistHeader.jsx en 5 sous-composants (PlaylistHeaderBadges/Cover/
// TitleBlock/Meta/Actions, chacun avec son propre fichier de test dédié),
// CE fichier ne teste plus le RENDU/l'INTERACTION de chaque bloc — il
// teste uniquement ce que PlaylistHeader.jsx lui-même fait encore :
// calculer les valeurs PARTAGÉES (ownerLabel/ownerProfileUsername/avgBpm/
// bpmZone/bpmBadgeColor/currentPlaylistRank/mostRecentCompletionIso/
// hasImportedDataForMostRecent) et les transmettre au bon sous-composant.
// Les 5 sous-composants sont donc mockés par des stubs légers qui exposent
// juste assez de props reçues pour vérifier ce que PlaylistHeader.jsx leur
// transmet — même pattern que TrackList.test.jsx qui mocke TrackItem.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

vi.mock('../../../src/components/views/PlaylistDetail/PlaylistHeaderBadges.jsx', () => ({
  default: ({ currentPlaylistRank, currentPlaylistRankStyle, isSaved, isReadOnly }) => (
    <div
      data-testid="badges-mock"
      data-rank={String(currentPlaylistRank)}
      data-rank-style={currentPlaylistRankStyle ? JSON.stringify(currentPlaylistRankStyle) : ''}
      data-is-saved={String(isSaved)}
      data-is-readonly={String(isReadOnly)}
    />
  ),
}));

vi.mock('../../../src/components/views/PlaylistDetail/PlaylistHeaderCover.jsx', () => ({
  default: ({ bgAccentClass }) => <div data-testid="cover-mock" data-bg-accent={bgAccentClass} />,
}));

vi.mock('../../../src/components/views/PlaylistDetail/PlaylistHeaderTitleBlock.jsx', () => ({
  default: () => <div data-testid="title-block-mock" />,
}));

vi.mock('../../../src/components/views/PlaylistDetail/PlaylistHeaderMeta.jsx', () => ({
  default: ({ mostRecentCompletionIso, isLocked, ownerLabel, ownerProfileUsername }) => (
    <div
      data-testid="meta-mock"
      data-most-recent-completion-iso={mostRecentCompletionIso || ''}
      data-is-locked={String(isLocked)}
      data-owner-label={ownerLabel === null ? '' : ownerLabel}
      data-owner-profile-username={ownerProfileUsername === null ? '' : ownerProfileUsername}
    />
  ),
}));

vi.mock('../../../src/components/views/PlaylistDetail/PlaylistHeaderActions.jsx', () => ({
  default: ({ hasImportedDataForMostRecent, avgBpm, bpmZone, bpmBadgeColor }) => (
    <div
      data-testid="actions-mock"
      data-has-imported-data={String(hasImportedDataForMostRecent)}
      data-avg-bpm={avgBpm === null ? '' : String(avgBpm)}
      data-bpm-zone={bpmZone ? JSON.stringify(bpmZone) : ''}
      data-bpm-badge-color={bpmBadgeColor || ''}
    />
  ),
}));

import PlaylistHeader from '../../../src/components/views/PlaylistDetail/PlaylistHeader.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = { bgAccentClass: 'mock-accent-bg' };

const track1 = { id: 't1', bpm: 140 };
const track2 = { id: 't2', bpm: 160 };

function makePlaylist(overrides = {}) {
  return {
    id: 'pl1', name: 'Ma Séance', workoutType: 'Course à pied', totalDuration: 410,
    tracks: [track1, track2], completions: [], config: {}, plannedDate: null, coverUrl: null,
    ...overrides,
  };
}

function makeContextValue(overrides = {}) {
  return {
    // `isEditingPlaylistDetails`/`editedPlaylistName`/
    // `editedPlaylistDescription`/`handleSavePlaylistDetails` : DÉPLACÉS
    // (08/08) vers `usePlaylistEdit()` (PlaylistEditContext.jsx) —
    // `PlaylistHeader.jsx` ne les lit plus via `usePlaylistDetail()`, plus
    // besoin de les fournir ici (voir la docstring de
    // PlaylistEditContext.jsx pour le raisonnement).
    currentPlaylist: makePlaylist(),
    isSaved: true,
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
    handleSavePlaylist: vi.fn(),
    handleUnsavePlaylist: vi.fn(),
    handleTogglePlaylistPublic: vi.fn(),
    handleClonePlaylist: vi.fn(),
    isReadOnly: false,
    username: null,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isLocked: false,
    savedPlaylists: [],
    resolveAndTogglePreview: vi.fn(),
    getNextTrackForAutoAdvance: vi.fn(),
    setPlaylistPlannedDate: vi.fn(),
    bpmChartActivityName: 'Course à pied',
    editingCompletion: null,
    setEditingCompletion: vi.fn(),
    editCompletionDate: vi.fn(),
    removeCompletionDate: vi.fn(),
    getRankStyle: vi.fn(() => null),
    triggerCSVUpload: vi.fn(),
    onShare: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistHeader — composition (les 5 sous-composants sont bien rendus)', () => {
  it('rend PlaylistHeaderBadges/Cover/TitleBlock/Meta/Actions', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByTestId('badges-mock')).toBeInTheDocument();
    expect(screen.getByTestId('cover-mock')).toBeInTheDocument();
    expect(screen.getByTestId('title-block-mock')).toBeInTheDocument();
    expect(screen.getByTestId('meta-mock')).toBeInTheDocument();
    expect(screen.getByTestId('actions-mock')).toBeInTheDocument();
  });

  it('transmet theme.bgAccentClass à PlaylistHeaderCover', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps({ theme: { bgAccentClass: 'accent-xyz' } })} />);
    expect(screen.getByTestId('cover-mock')).toHaveAttribute('data-bg-accent', 'accent-xyz');
  });
});

// Voir la docstring d'`ownerLabel`/`ownerProfileUsername` dans
// PlaylistHeader.jsx pour le raisonnement complet des branches testées ici.
// ⚠️ CIBLE `meta-mock`, PAS `title-block-mock` (10/08, retour direct avec
// capture d'écran) — `ownerLabel`/`ownerProfileUsername` transmis à
// PlaylistHeaderMeta.jsx désormais (pseudo+compteur de clonages déplacés
// là-bas, voir sa docstring) ; le CALCUL de ces 2 valeurs, testé ici,
// reste strictement inchangé — seule la CIBLE du mock a bougé.
describe('PlaylistHeader — calcul d\'ownerLabel/ownerProfileUsername', () => {
  it('isSaved=true + username : ownerLabel=username, ownerProfileUsername=null (jamais cliquable sur soi-même)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, username: 'mon_pseudo' }));
    render(<PlaylistHeader {...baseProps()} />);
    const el = screen.getByTestId('meta-mock');
    expect(el).toHaveAttribute('data-owner-label', 'mon_pseudo');
    expect(el).toHaveAttribute('data-owner-profile-username', '');
  });

  it('isSaved=true SANS username (mode invité) : ownerLabel="Invité"', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, username: null }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByTestId('meta-mock')).toHaveAttribute('data-owner-label', 'Invité');
  });

  it('isSaved=false + sourceTemplateId : ownerLabel="TempoFit Officiel", ownerProfileUsername="tempofit_officiel"', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isSaved: false, username: null, currentPlaylist: makePlaylist({ sourceTemplateId: 'tpl-cardio' }),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    const el = screen.getByTestId('meta-mock');
    expect(el).toHaveAttribute('data-owner-label', 'TempoFit Officiel');
    expect(el).toHaveAttribute('data-owner-profile-username', 'tempofit_officiel');
  });

  it('isSaved=false + ownerUsername (playlist d\'un autre utilisateur) : ownerLabel/ownerProfileUsername = SON pseudo', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isSaved: false, username: null, currentPlaylist: makePlaylist({ ownerUsername: 'un_autre_coureur' }),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    const el = screen.getByTestId('meta-mock');
    expect(el).toHaveAttribute('data-owner-label', 'un_autre_coureur');
    expect(el).toHaveAttribute('data-owner-profile-username', 'un_autre_coureur');
  });

  it('isSaved=false, ni sourceTemplateId ni ownerUsername (génération fraîche) : ownerLabel=null', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false, username: null, currentPlaylist: makePlaylist() }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByTestId('meta-mock')).toHaveAttribute('data-owner-label', '');
  });
});

describe('PlaylistHeader — calcul du badge BPM/Zone', () => {
  it('avgBpm = moyenne réelle des BPM des titres', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps()} />);
    // (140+160)/2 = 150
    expect(screen.getByTestId('actions-mock')).toHaveAttribute('data-avg-bpm', '150');
  });

  it('bpmZone provient de getZoneForValue (profil réel configuré)', async () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    const appConfig = await import('../../../src/appConfig.js');
    appConfig.getZoneForValue.mockReturnValueOnce({ shortLabel: 'Seuil', color: '#f59e0b' });
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByTestId('actions-mock')).toHaveAttribute('data-bpm-badge-color', '#f59e0b');
  });

  it('sans aucun titre : avgBpm=null, bpmBadgeColor=null', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ tracks: [] }) }));
    render(<PlaylistHeader {...baseProps()} />);
    const el = screen.getByTestId('actions-mock');
    expect(el).toHaveAttribute('data-avg-bpm', '');
    expect(el).toHaveAttribute('data-bpm-badge-color', '');
  });
});

describe('PlaylistHeader — calcul du classement (médaille de rang)', () => {
  it('appelle getRankStyle avec le rang réel (tri par nombre de complétions), transmis à PlaylistHeaderBadges', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ id: 'pl1', completions: ['2026-01-01'] }) }));
    const savedPlaylists = [
      makePlaylist({ id: 'pl0', completions: ['a', 'b', 'c'] }),
      makePlaylist({ id: 'pl1', completions: ['2026-01-01'] }),
    ];
    const getRankStyle = vi.fn(() => ({ emoji: '🥈' }));
    render(<PlaylistHeader {...baseProps({ savedPlaylists, getRankStyle })} />);
    expect(getRankStyle).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('badges-mock')).toHaveAttribute('data-rank-style', JSON.stringify({ emoji: '🥈' }));
  });
});

describe('PlaylistHeader — calcul de mostRecentCompletionIso/hasImportedDataForMostRecent', () => {
  it('isLocked=false : mostRecentCompletionIso=null (transmis à PlaylistHeaderMeta)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }) }));
    render(<PlaylistHeader {...baseProps({ isLocked: false })} />);
    expect(screen.getByTestId('meta-mock')).toHaveAttribute('data-most-recent-completion-iso', '');
  });

  it('isLocked=true : mostRecentCompletionIso = dernière date de completions', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ completions: ['2026-01-01', '2026-01-08'] }) }));
    render(<PlaylistHeader {...baseProps({ isLocked: true })} />);
    expect(screen.getByTestId('meta-mock')).toHaveAttribute('data-most-recent-completion-iso', '2026-01-08');
  });

  it('hasImportedDataForMostRecent=true seulement si actualDataByDate contient la date la plus récente', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      currentPlaylist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: { '2026-01-01': [{}] } }),
    }));
    render(<PlaylistHeader {...baseProps({ isLocked: true })} />);
    expect(screen.getByTestId('actions-mock')).toHaveAttribute('data-has-imported-data', 'true');
  });

  it('hasImportedDataForMostRecent=false si actualDataByDate est vide', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      currentPlaylist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: {} }),
    }));
    render(<PlaylistHeader {...baseProps({ isLocked: true })} />);
    expect(screen.getByTestId('actions-mock')).toHaveAttribute('data-has-imported-data', 'false');
  });
});

describe('PlaylistHeader — plomberie isSaved/isReadOnly vers PlaylistHeaderBadges', () => {
  it('transmet isSaved/isReadOnly tels que reçus de usePlaylistDetail()', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false, isReadOnly: true }));
    render(<PlaylistHeader {...baseProps()} />);
    const el = screen.getByTestId('badges-mock');
    expect(el).toHaveAttribute('data-is-saved', 'false');
    expect(el).toHaveAttribute('data-is-readonly', 'true');
  });
});
