// @vitest-environment jsdom
//
// Palier 3 (29/07, 10/11) — PlaylistDetailView. `PlaylistDetailContext` est
// mocké EN INTÉGRALITÉ (à la fois `PlaylistDetailProvider`, réduit à un
// simple passe-plat qui rend ses enfants, ET `usePlaylistDetail()`) — la
// vraie logique du Provider (drag-and-drop, mutations de titres, calculs de
// graphique...) est hors périmètre de CE test et déjà couverte ailleurs
// (TrackItem/TrackList/PlaylistHeader la consomment déjà via ce même
// contexte). `PlaylistHeader`/`PlaylistCharts`/`TrackList`/
// `SessionSummaryCard` sont mockés par des stubs légers : chacun a déjà (ou
// aura, pour PlaylistCharts, Palier 4) son propre fichier de test — ici, on
// vérifie seulement qu'ils REÇOIVENT les bonnes props.
//
// Décision prise avec l'utilisateur avant d'écrire ce fichier : pas de
// découpage supplémentaire de PlaylistDetailView.jsx (594 lignes, déjà
// réduit depuis 1656 par un chantier précédent — TrackList/TrackItem/
// PlaylistHeader/PlaylistCharts déjà extraits). Ce qui reste est de la vraie
// orchestration (état de filtre partagé, génération d'image, avance
// automatique) plus un seul bloc isolable (tableau CSV brut, ~40 lignes,
// aucune logique complexe à en extraire) — un découpage de plus aurait
// déplacé la complexité sans la réduire.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUsePlaylistDetail = vi.fn();
vi.mock('../src/contexts/PlaylistDetailContext.jsx', () => ({
  PlaylistDetailProvider: ({ children }) => <>{children}</>,
  usePlaylistDetail: () => mockUsePlaylistDetail(),
}));

vi.mock('../src/components/views/PlaylistDetail/PlaylistHeader.jsx', () => ({
  default: ({ isLocked, onShare, resolveAndTogglePreview, getNextTrackForAutoAdvance }) => (
    <div data-testid="playlist-header-mock" data-locked={String(isLocked)}>
      <button onClick={onShare}>trigger-share</button>
      <button onClick={() => resolveAndTogglePreview({ id: 't1', preview: 'has-preview' }, getNextTrackForAutoAdvance)}>
        trigger-resolve-with-preview
      </button>
      <button onClick={() => resolveAndTogglePreview({ id: 't2', preview: null }, getNextTrackForAutoAdvance)}>
        trigger-resolve-without-preview
      </button>
      <button onClick={() => window.__lastNextTrack = getNextTrackForAutoAdvance({ id: 't1' })}>
        trigger-get-next-track
      </button>
    </div>
  ),
}));

vi.mock('../src/components/views/PlaylistDetail/PlaylistCharts.jsx', () => ({
  default: ({ isLocked, hasDetailFilter }) => (
    <div data-testid="playlist-charts-mock" data-locked={String(isLocked)} data-has-filter={String(hasDetailFilter)} />
  ),
}));

vi.mock('../src/components/views/PlaylistDetail/TrackList.jsx', () => ({
  default: ({ isLocked, hasDetailFilter, trackMatchesDetailFilter }) => (
    <div
      data-testid="track-list-mock"
      data-locked={String(isLocked)}
      data-has-filter={String(hasDetailFilter)}
      data-matches-first-track={String(trackMatchesDetailFilter ? trackMatchesDetailFilter({ genre: 'Rock', artist: 'X', title: 'Y', bpm: 140 }) : null)}
    />
  ),
}));

vi.mock('../src/components/shared/SessionSummaryCard.jsx', () => ({
  default: () => <div data-testid="session-summary-card-mock" />,
}));

vi.mock('../src/utils/captureElementAsFile.js', () => ({
  captureElementAsFile: vi.fn(() => Promise.resolve(new File(['x'], 'bilan.png'))),
  fetchImageAsDataUri: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
}));

vi.mock('../src/musicEngine.js', () => ({
  deezerFetch: vi.fn(() => Promise.resolve({ data: { album: { cover_medium: 'https://cover.jpg' } } })),
}));

vi.mock('../src/appConfig.js', () => ({
  getCadenceUnitLabel: vi.fn(() => 'PPM'),
  getZoneForValue: vi.fn(() => null),
  getBpmBucketLabel: vi.fn(() => '140-159'),
}));

vi.mock('../src/musicCatalog.js', () => ({
  genreDisplayLabel: vi.fn((g) => g),
  normalizeGenreForDisplay: vi.fn((g) => g),
}));

import PlaylistDetailView from '../src/components/views/PlaylistDetailView.jsx';

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = { cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight', textMuted: 'mock-muted', textColorClass: 'mock-text-color' };

const trackA = { id: 't1', trackId: 'deezer-1', title: 'Titre A', artist: 'Artiste A', bpm: 140, preview: 'url-a' };
const trackB = { id: 't2', trackId: 'fav-2', title: 'Titre B', artist: 'Artiste B', bpm: 150, preview: null };

function makePlaylist(overrides = {}) {
  return { id: 'pl1', workoutType: 'Course à pied', tracks: [trackA, trackB], completions: [], config: {}, ...overrides };
}

function makeContextValue(overrides = {}) {
  return {
    isNaughtyMode: false,
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
    currentActualData: null,
    togglePreview: vi.fn(),
    resolveAndPlay: vi.fn(() => Promise.resolve(null)),
    setSelectedSegmentIdx: vi.fn(),
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    setCurrentPlaylist: vi.fn(),
    savedPlaylists: [],
    setSavedPlaylists: vi.fn(),
    favorites: { tracks: [], artists: [] },
    spotifyTrackPool: [],
    userStats: {},
    checkTrophies: vi.fn(),
    showToast: vi.fn(),
    requestRemoveSavedPlaylist: vi.fn(),
    handleSavePlaylist: vi.fn(),
    currentActualData: null,
    selectedMetric: 'cadence',
    setSelectedMetric: vi.fn(),
    dataOffset: 0,
    setDataOffset: vi.fn(),
    selectedAnalysisDate: null,
    setSelectedAnalysisDate: vi.fn(),
    availableMetrics: [],
    theme: mockTheme,
    colorMode: 'light',
    handleShare: vi.fn(),
    summaryImageStatus: 'idle',
    setSummaryImageStatus: vi.fn(),
    summaryImageFile: null,
    setSummaryImageFile: vi.fn(),
    summaryImagePreviewUrl: null,
    setSummaryImagePreviewUrl: vi.fn(),
    includeSummaryImage: true,
    setIncludeSummaryImage: vi.fn(),
    toggleTrackFavorite: vi.fn(),
    toggleArtistFavorite: vi.fn(),
    setIsBpmSearchMode: vi.fn(),
    setPlaylistPlannedDate: vi.fn(),
    editingCompletion: null,
    setEditingCompletion: vi.fn(),
    editCompletionDate: vi.fn(),
    removeCompletionDate: vi.fn(),
    getRankStyle: vi.fn(() => null),
    triggerCSVUpload: vi.fn(),
    changeView: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistDetailView', () => {
  it('isLocked=false sans complétion : transmis à PlaylistHeader/PlaylistCharts/TrackList', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps({ currentPlaylist: makePlaylist({ completions: [] }) })} />);
    expect(screen.getByTestId('playlist-header-mock')).toHaveAttribute('data-locked', 'false');
    expect(screen.getByTestId('playlist-charts-mock')).toHaveAttribute('data-locked', 'false');
    expect(screen.getByTestId('track-list-mock')).toHaveAttribute('data-locked', 'false');
  });

  it('isLocked=true dès qu\'au moins une complétion existe', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps({ currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }) })} />);
    expect(screen.getByTestId('playlist-header-mock')).toHaveAttribute('data-locked', 'true');
  });

  it('le bouton "← Retour" appelle changeView("playlists")', () => {
    const changeView = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps({ changeView })} />);
    fireEvent.click(screen.getByText('← Retour'));
    expect(changeView).toHaveBeenCalledWith('playlists');
  });

  it('cliquer sur "Partager" (via PlaylistHeader) déclenche la génération d\'image ET handleShare', async () => {
    const handleShare = vi.fn();
    const setSummaryImageStatus = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps({ handleShare, setSummaryImageStatus, summaryImageStatus: 'idle' })} />);

    fireEvent.click(screen.getByText('trigger-share'));

    expect(handleShare).toHaveBeenCalledWith('playlist', expect.objectContaining({ id: 'pl1' }));
    await waitFor(() => expect(setSummaryImageStatus).toHaveBeenCalledWith('loading'));
    await waitFor(() => expect(setSummaryImageStatus).toHaveBeenCalledWith('ready'));
  });

  it('ne relance pas la génération d\'image si déjà "loading" ou "ready"', () => {
    const setSummaryImageStatus = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps({ setSummaryImageStatus, summaryImageStatus: 'ready' })} />);
    // L'effet de reset (currentPlaylist.id) se déclenche AUSSI au tout 1er
    // montage (undefined → l'id réel) — on vide les appels d'abord pour
    // n'observer que ceux causés par le clic ci-dessous, pas celui du montage.
    setSummaryImageStatus.mockClear();

    fireEvent.click(screen.getByText('trigger-share'));

    expect(setSummaryImageStatus).not.toHaveBeenCalled();
  });

  it('changer de playlist réinitialise l\'état de l\'image de bilan (et révoque l\'ancienne URL si présente)', () => {
    const setSummaryImageStatus = vi.fn();
    const setSummaryImageFile = vi.fn();
    const setIncludeSummaryImage = vi.fn();
    const setSummaryImagePreviewUrl = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    const { rerender } = render(
      <PlaylistDetailView
        {...baseProps({
          currentPlaylist: makePlaylist({ id: 'pl1' }),
          setSummaryImageStatus, setSummaryImageFile, setIncludeSummaryImage, setSummaryImagePreviewUrl,
        })}
      />
    );
    vi.clearAllMocks();
    global.URL.revokeObjectURL = vi.fn();

    rerender(
      <PlaylistDetailView
        {...baseProps({
          currentPlaylist: makePlaylist({ id: 'pl2' }),
          setSummaryImageStatus, setSummaryImageFile, setIncludeSummaryImage, setSummaryImagePreviewUrl,
        })}
      />
    );

    expect(setSummaryImageStatus).toHaveBeenCalledWith('idle');
    expect(setSummaryImageFile).toHaveBeenCalledWith(null);
    expect(setIncludeSummaryImage).toHaveBeenCalledWith(true);
    expect(setSummaryImagePreviewUrl).toHaveBeenCalledWith(expect.any(Function));
    const updater = setSummaryImagePreviewUrl.mock.calls[0][0];
    expect(updater('blob:previous-url')).toBeNull();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:previous-url');
  });

  it('tableau CSV brut : absent sans currentActualData, présent et repliable sinon', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentActualData: null }));
    const { rerender } = render(<PlaylistDetailView {...baseProps({ currentActualData: null })} />);
    expect(screen.queryByText(/Données brutes importées/)).not.toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentActualData: [{ timeSec: 30, cadenceReelle: 170, heartRate: 140, circuit: 1 }] })
    );
    rerender(<PlaylistDetailView {...baseProps({ currentActualData: [{ timeSec: 30, cadenceReelle: 170, heartRate: 140, circuit: 1 }] })} />);
    expect(screen.getByText(/Données brutes importées \(1 points\)/)).toBeInTheDocument();
    expect(screen.queryByText('170')).not.toBeInTheDocument(); // replié par défaut

    fireEvent.click(screen.getByText(/Données brutes importées/));
    expect(screen.getByText('170')).toBeInTheDocument();
  });

  it('filtre croisé genre/BPM : hasDetailFilter=false par défaut, transmis à TrackList et PlaylistCharts', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps()} />);
    expect(screen.getByTestId('track-list-mock')).toHaveAttribute('data-has-filter', 'false');
    expect(screen.getByTestId('playlist-charts-mock')).toHaveAttribute('data-has-filter', 'false');
  });

  it('getNextTrackForAutoAdvance : trouve le prochain titre exploitable (saute ceux sans preview) et met à jour setSelectedSegmentIdx', () => {
    const setSelectedSegmentIdx = vi.fn();
    const t1 = { id: 't1', preview: 'p1' };
    const t2 = { id: 't2', preview: null };
    const t3 = { id: 't3', preview: 'p3' };
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ setSelectedSegmentIdx }));
    render(<PlaylistDetailView {...baseProps({ currentPlaylist: makePlaylist({ tracks: [t1, t2, t3] }) })} />);

    fireEvent.click(screen.getByText('trigger-get-next-track'));

    expect(window.__lastNextTrack).toEqual(t3);
    expect(setSelectedSegmentIdx).toHaveBeenCalledWith(2);
  });

  it('getNextTrackForAutoAdvance : renvoie null si aucun titre de la playlist n\'a de preview', () => {
    const setSelectedSegmentIdx = vi.fn();
    const t1 = { id: 't1', preview: null };
    const t2 = { id: 't2', preview: null };
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ setSelectedSegmentIdx }));
    render(<PlaylistDetailView {...baseProps({ currentPlaylist: makePlaylist({ tracks: [t1, t2] }) })} />);

    fireEvent.click(screen.getByText('trigger-get-next-track'));

    expect(window.__lastNextTrack).toBeNull();
    expect(setSelectedSegmentIdx).not.toHaveBeenCalled();
  });

  it('resolveAndTogglePreview : titre avec preview appelle togglePreview directement (pas resolveAndPlay)', () => {
    const togglePreview = vi.fn();
    const resolveAndPlay = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ togglePreview, resolveAndPlay }));
    render(<PlaylistDetailView {...baseProps()} />);

    fireEvent.click(screen.getByText('trigger-resolve-with-preview'));

    expect(togglePreview).toHaveBeenCalled();
    expect(resolveAndPlay).not.toHaveBeenCalled();
  });

  it('resolveAndTogglePreview : titre sans preview appelle resolveAndPlay puis remplace ce titre (par id) dans currentPlaylist', async () => {
    const resolvedTrack = { id: 't2', preview: 'resolved-url', trackId: 'deezer-99' };
    const resolveAndPlay = vi.fn(() => Promise.resolve(resolvedTrack));
    const setCurrentPlaylist = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ resolveAndPlay }));
    render(<PlaylistDetailView {...baseProps({ setCurrentPlaylist })} />);

    fireEvent.click(screen.getByText('trigger-resolve-without-preview'));
    await waitFor(() => expect(setCurrentPlaylist).toHaveBeenCalled());

    const updater = setCurrentPlaylist.mock.calls[0][0];
    const result = updater({ tracks: [trackA, trackB] });
    expect(result.tracks).toEqual([trackA, resolvedTrack]);
  });
});

describe('PlaylistDetailView — génération d\'image, résolution des pochettes en data URI (01/08)', () => {
  // Test de non-régression pour le plantage réel signalé le 01/08 (voir
  // captureElementAsFile.js/fetchImageAsDataUri) : jsdom n'a pas de vrai
  // moteur de canvas ni de notion de CORS/"tainting", donc impossible de
  // PROUVER ici qu'une vraie SecurityError ne se produira plus dans un
  // navigateur — ce qu'on peut vérifier, c'est que le nouveau chemin de
  // code (résolution en data URI AVANT la capture) est bien câblé comme
  // prévu, ce qui est le cœur du correctif.

  it('résout la pochette de séance en data URI (fetchImageAsDataUri), même sans coverUrl déjà posé', async () => {
    const captureUtils = await import('../src/utils/captureElementAsFile.js');
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps({ currentPlaylist: makePlaylist({ name: 'Ma Séance', coverUrl: null }) })} />);

    fireEvent.click(screen.getByText('trigger-share'));

    // currentPlaylist.coverUrl est absent → repli sur buildCoverUrl(name),
    // une URL DiceBear (SVG) — c'est justement la source du plantage
    // d'origine, elle doit passer par la résolution en data URI comme
    // n'importe quelle autre pochette.
    await waitFor(() => expect(captureUtils.fetchImageAsDataUri).toHaveBeenCalledWith(expect.stringContaining('dicebear.com')));
  });

  it('résout UNIQUEMENT les pochettes des titres sourcés Deezer (pas les favoris/Spotify sans trackId "deezer-")', async () => {
    const captureUtils = await import('../src/utils/captureElementAsFile.js');
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps()} />); // trackA = deezer-1, trackB = fav-2 (voir fixtures en tête de fichier)

    fireEvent.click(screen.getByText('trigger-share'));

    await waitFor(() => expect(captureUtils.fetchImageAsDataUri).toHaveBeenCalledWith('https://cover.jpg')); // cover_medium mocké de deezerFetch
    // trackB (fav-2) n'a pas de trackId Deezer exploitable : jamais interrogé.
    expect(captureUtils.fetchImageAsDataUri.mock.calls.filter(c => c[0] === 'https://cover.jpg')).toHaveLength(1);
  });

  it('si la résolution d\'une pochette échoue (renvoie null) : la génération continue quand même, jusqu\'à "ready"', async () => {
    const captureUtils = await import('../src/utils/captureElementAsFile.js');
    captureUtils.fetchImageAsDataUri.mockResolvedValue(null); // simule un échec réseau/CORS pour TOUTES les pochettes de ce test
    const setSummaryImageStatus = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistDetailView {...baseProps({ setSummaryImageStatus, summaryImageStatus: 'idle' })} />);

    fireEvent.click(screen.getByText('trigger-share'));

    // Le plantage d'origine venait justement d'une pochette qui faisait
    // échouer TOUTE la capture — la garantie centrale de ce correctif est
    // qu'un échec de résolution d'UNE pochette (renvoyant proprement
    // `null`, jamais une exception) n'empêche plus la génération
    // d'aboutir : la capture elle-même (mockée séparément) n'a besoin
    // d'aucune de ces données pour réussir.
    await waitFor(() => expect(setSummaryImageStatus).toHaveBeenCalledWith('ready'));

    // Restaure le comportement par défaut — vi.clearAllMocks() (afterEach
    // global) n'efface pas un mockResolvedValue déjà posé, seulement les
    // appels enregistrés.
    captureUtils.fetchImageAsDataUri.mockResolvedValue('data:image/png;base64,mock');
  });
});
