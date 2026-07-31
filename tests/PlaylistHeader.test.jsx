// @vitest-environment jsdom
//
// Palier 3 (29/07, 8/11) — PlaylistHeader. `usePlaylistDetail()` mocké.
// `appConfig.js`/`musicCatalog.js`/`coverArt.js` mockés (fonctions pures
// déjà couvertes par leurs propres tests). `TopCompletionDate`/
// `CompletionsList` mockés par des stubs légers : déjà testés dans
// tests/TopCompletionDate.test.jsx et tests/CompletionsList.test.jsx
// (Palier 2) — pas la peine de re-tester leur logique interne ici.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUsePlaylistDetail = vi.fn();
vi.mock('../src/contexts/PlaylistDetailContext.jsx', () => ({
  usePlaylistDetail: () => mockUsePlaylistDetail(),
}));

vi.mock('../src/appConfig.js', () => ({
  getActivityEmoji: vi.fn(() => '🏃'),
  getZoneForValue: vi.fn(() => null),
  getBpmBucketColor: vi.fn(() => '#123456'),
  getBpmBucketStart: vi.fn((bpm) => Math.floor(bpm / 20) * 20),
}));

vi.mock('../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((genre) => [genre]),
  genreDisplayLabel: vi.fn((genre) => genre),
}));

vi.mock('../src/utils/coverArt.js', () => ({
  buildCoverUrl: vi.fn((name) => `generated-cover://${name}`),
}));

vi.mock('../src/components/shared/TopCompletionDate.jsx', () => ({
  default: () => <div data-testid="top-completion-date-mock">TopCompletionDate (mock)</div>,
}));

vi.mock('../src/components/shared/CompletionsList.jsx', () => ({
  default: () => <div data-testid="completions-list-mock">CompletionsList (mock)</div>,
}));

import PlaylistHeader from '../src/components/views/PlaylistDetail/PlaylistHeader.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = { bgAccentClass: 'mock-accent-bg' };

const track1 = { id: 't1', bpm: 140, genre: 'Rock', duration: 200 };
const track2 = { id: 't2', bpm: 160, genre: 'Métal', duration: 210 };

function makePlaylist(overrides = {}) {
  return {
    id: 'pl1', name: 'Ma Séance', workoutType: 'Course à pied', totalDuration: 410,
    tracks: [track1, track2], completions: [], config: {}, plannedDate: null, coverUrl: null,
    ...overrides,
  };
}

function makeContextValue(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    isSaved: true,
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
    isEditingPlaylistName: false,
    setIsEditingPlaylistName: vi.fn(),
    editedPlaylistName: '',
    setEditedPlaylistName: vi.fn(),
    handleRenamePlaylist: vi.fn(),
    handleSavePlaylist: vi.fn(),
    handleUnsavePlaylist: vi.fn(),
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

describe('PlaylistHeader', () => {
  it('affiche le nom, le type de séance, la durée et le nombre de titres', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText(/Ma Séance/)).toBeInTheDocument();
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
    expect(screen.getByText('2 titres')).toBeInTheDocument();
  });

  it('utilise coverUrl si présent, sinon buildCoverUrl(name)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ coverUrl: 'https://real-cover.jpg' }) }));
    const { container, rerender } = render(<PlaylistHeader {...baseProps()} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('https://real-cover.jpg');

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ coverUrl: null, name: 'Ma Séance' }) }));
    rerender(<PlaylistHeader {...baseProps()} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('generated-cover://Ma Séance');
  });

  it('le clic sur la pochette lance la lecture du 1er titre', () => {
    const resolveAndTogglePreview = vi.fn();
    const getNextTrackForAutoAdvance = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps({ resolveAndTogglePreview, getNextTrackForAutoAdvance })} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(resolveAndTogglePreview).toHaveBeenCalledWith(track1, getNextTrackForAutoAdvance);
  });

  it('sans aucun titre, le clic sur la pochette n\'appelle pas resolveAndTogglePreview', () => {
    const resolveAndTogglePreview = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ tracks: [] }) }));
    render(<PlaylistHeader {...baseProps({ resolveAndTogglePreview })} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(resolveAndTogglePreview).not.toHaveBeenCalled();
  });

  it('badge "Lecture seule" affiché si isSaved=false, absent si isSaved=true', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    const { rerender } = render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Lecture seule')).toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true }));
    rerender(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByText('Lecture seule')).not.toBeInTheDocument();
  });

  it('médaille de rang affichée seulement si getRankStyle renvoie un style', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ id: 'pl1', completions: ['2026-01-01'] }) })
    );
    const savedPlaylists = [makePlaylist({ id: 'pl1', completions: ['2026-01-01'] })];
    const getRankStyle = vi.fn(() => ({ emoji: '🥇' }));
    render(<PlaylistHeader {...baseProps({ savedPlaylists, getRankStyle })} />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
  });

  it('renommer : le bouton crayon n\'apparaît que si isSaved=true, cliquer préremplit et ouvre l\'édition', () => {
    const setEditedPlaylistName = vi.fn();
    const setIsEditingPlaylistName = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, setEditedPlaylistName, setIsEditingPlaylistName }));
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByTitle('Renommer la playlist'));

    expect(setEditedPlaylistName).toHaveBeenCalledWith('Ma Séance');
    expect(setIsEditingPlaylistName).toHaveBeenCalledWith(true);
  });

  it('pas de bouton renommer quand isSaved=false', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByTitle('Renommer la playlist')).not.toBeInTheDocument();
  });

  it('en édition : Entrée valide (handleRenamePlaylist), Échap annule (setIsEditingPlaylistName(false))', () => {
    const handleRenamePlaylist = vi.fn();
    const setIsEditingPlaylistName = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ isEditingPlaylistName: true, editedPlaylistName: 'Nouveau nom', handleRenamePlaylist, setIsEditingPlaylistName })
    );
    render(<PlaylistHeader {...baseProps()} />);

    const input = screen.getByDisplayValue('Nouveau nom');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleRenamePlaylist).toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(setIsEditingPlaylistName).toHaveBeenCalledWith(false);
  });

  it('genres : affiche cfg.selectedGenres (via genreDisplayLabel) en priorité sur les genres réels des titres', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ config: { selectedGenres: ['Rock', 'Pop'] } }) })
    );
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Rock, Pop')).toBeInTheDocument();
  });

  it('genres : sans cfg.selectedGenres, replie sur les genres réels des titres', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ config: {}, tracks: [{ ...track1, genre: 'Techno' }] }) })
    );
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Techno')).toBeInTheDocument();
  });

  it('isLocked + au moins 1 complétion : affiche TopCompletionDate, et CompletionsList seulement si >1 complétion', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }) })
    );
    const { rerender } = render(<PlaylistHeader {...baseProps({ isLocked: true })} />);
    expect(screen.getByTestId('top-completion-date-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('completions-list-mock')).not.toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ completions: ['2026-01-01', '2026-01-08'] }) })
    );
    rerender(<PlaylistHeader {...baseProps({ isLocked: true })} />);
    expect(screen.getByTestId('completions-list-mock')).toBeInTheDocument();
  });

  it('import CSV : libellé et action dépendent de hasImportedDataForMostRecent', () => {
    const triggerCSVUpload = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({
        currentPlaylist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: {} }),
      })
    );
    render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload })} />);
    expect(screen.getByText('Importe tes données')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Importe tes données'));
    expect(triggerCSVUpload).toHaveBeenCalled();
  });

  it('import CSV : "Données importées" quand actualDataByDate contient déjà la date la plus récente', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({
        currentPlaylist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: { '2026-01-01': [{}] } }),
      })
    );
    render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload: vi.fn() })} />);
    expect(screen.getByText('Données importées')).toBeInTheDocument();
  });

  it('sauvegarde : isSaved=true propose "Retirer de Mes Séances" (handleUnsavePlaylist)', () => {
    const handleUnsavePlaylist = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, handleUnsavePlaylist }));
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByText('Retirer de Mes Séances'));
    expect(handleUnsavePlaylist).toHaveBeenCalled();
  });

  it('sauvegarde : isSaved=false propose "Ajouter à Mes Séances" (handleSavePlaylist)', () => {
    const handleSavePlaylist = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false, handleSavePlaylist }));
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByText('Ajouter à Mes Séances'));
    expect(handleSavePlaylist).toHaveBeenCalled();
  });

  it('"Planifier" n\'apparaît que si isSaved=true, affiche la date déjà planifiée sinon "Planifier"', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    const { rerender } = render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByText('Planifier')).not.toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ plannedDate: null }) }));
    rerender(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Planifier')).toBeInTheDocument();
  });

  it('changer la date planifiée appelle setPlaylistPlannedDate avec l\'id de la playlist', () => {
    const setPlaylistPlannedDate = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ id: 'pl1' }) }));
    const { container } = render(<PlaylistHeader {...baseProps({ setPlaylistPlannedDate })} />);

    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-02-14' } });

    expect(setPlaylistPlannedDate).toHaveBeenCalledWith('pl1', '2026-02-14');
  });

  it('le clic sur "Partager" appelle onShare', () => {
    const onShare = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps({ onShare })} />);

    fireEvent.click(screen.getByText('Partager'));

    expect(onShare).toHaveBeenCalled();
  });

  it('badge BPM : affiche le BPM moyen, avec le libellé de zone si un profil réel est configuré', async () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    const appConfig = await import('../src/appConfig.js');
    appConfig.getZoneForValue.mockReturnValueOnce({ shortLabel: 'Seuil', color: '#f59e0b' });

    render(<PlaylistHeader {...baseProps()} />);

    // avgBpm = (140+160)/2 = 150
    expect(screen.getByText('150 BPM • Seuil')).toBeInTheDocument();
  });

  it('badge BPM : sans profil configuré, affiche juste le BPM (pas de suffixe de zone)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('150 BPM')).toBeInTheDocument();
  });

  it('sans aucun titre, le badge BPM n\'est pas affiché du tout', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ tracks: [] }) }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByText(/BPM/)).not.toBeInTheDocument();
  });
});
