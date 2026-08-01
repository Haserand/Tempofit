// @vitest-environment jsdom
//
// Palier 4 (31/07, 4e et dernier) — PlaylistCharts. Le composant le plus
// technique du projet : courbe BPM (recharts LineChart) + 2 camemberts
// (recharts PieChart) + logique de sélection croisée.
//
// `recharts` est mocké EN INTÉGRALITÉ par des stubs très légers. Deux
// raisons : (1) recharts dépend de vraies mesures de layout (largeur/
// hauteur réelles via ResizeObserver) que jsdom ne fournit jamais
// fidèlement — un test qui "marche" contre le vrai recharts dans jsdom ne
// prouverait pas grand-chose de fiable ; (2) recharts est une bibliothèque
// tierce avec ses propres tests, ce n'est pas à ce fichier de vérifier
// qu'un LineChart sait dessiner une ligne. Ce qui nous intéresse vraiment
// — les données passées aux graphiques, la légende cliquable (de vrais
// <button> du code de CE projet, pas des éléments recharts), le mode
// Synchro, les contrôles (axe/métrique/décalage), l'encart segment — est
// testable sans jamais avoir besoin d'un vrai rendu SVG.
//
// `ResizeObserver` est quand même stubbé par précaution (si jamais un
// import transitif y touchait avant que le mock recharts ne s'applique).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

const mockUsePlaylistDetail = vi.fn();
vi.mock('../../../src/contexts/PlaylistDetailContext.jsx', () => ({
  usePlaylistDetail: () => mockUsePlaylistDetail(),
}));

vi.mock('../../../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((g) => [g]),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, onClick }) => (
    <div data-testid="line-chart" onClick={() => onClick && onClick({ activeLabel: 100 })}>{children}</div>
  ),
  CartesianGrid: () => null,
  ReferenceArea: (props) => <div data-testid="reference-area" data-x1={props.x1} data-x2={props.x2} />,
  ReferenceLine: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Line: () => null,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, onClick, children }) => (
    <div data-testid="pie">
      {data.map((entry, i) => (
        // Pas de nom en texte visible ici : la vraie légende (plus bas dans
        // PlaylistCharts.jsx, de vrais <button> du projet) affiche déjà ce
        // même texte — le doublon a cassé plusieurs tests au 1er
        // déploiement (`getByText` ambigu entre ce stub et la légende
        // réelle). Ce stub n'a besoin d'exposer les données que via
        // data-testid, jamais en tant que texte visible dupliqué.
        <button key={i} data-testid={`pie-slice-${entry.name}`} onClick={() => onClick(entry)} />
      ))}
      {children}
    </div>
  ),
  Cell: () => null,
}));

import PlaylistCharts from '../../../src/components/views/PlaylistDetail/PlaylistCharts.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight',
  textMuted: 'mock-muted', textColorClass: 'mock-text-color', bgAccentClass: 'mock-accent-bg',
  inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
};

const trackA = { id: 't1', trackId: 'd1', title: 'Titre A', artist: 'Artiste A', genre: 'Rock', bpm: 150, duration: 200 };
const trackB = { id: 't2', trackId: 'd2', title: 'Titre B', artist: 'Artiste B', genre: 'Pop', bpm: 130, duration: 180 };

const segmentA = { track: trackA, startTime: 0, endTime: 200, startDist: 0, endDist: 1 };
const segmentB = { track: trackB, startTime: 200, endTime: 380, startDist: 1, endDist: 2 };

function makePlaylist(overrides = {}) {
  return { id: 'pl1', tracks: [trackA, trackB], distanceUnit: 'km', tolerance: 10, actualDataByDate: null, ...overrides };
}

function makeContextValue(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    isNaughtyMode: false,
    getProfileForWorkout: vi.fn(() => null),
    currentActualData: null,
    selectedMetric: 'cadence',
    setSelectedMetric: vi.fn(),
    analysisStats: null,
    selectedAnalysisDate: null,
    setSelectedAnalysisDate: vi.fn(),
    availableMetrics: { cadence: true, heartRate: false },
    dataOffset: 0,
    setDataOffset: vi.fn(),
    chartAxisType: 'temps',
    setChartAxisType: vi.fn(),
    chartDistanceUnit: 'km',
    setChartDistanceUnitOverride: vi.fn(),
    selectedSegmentIdx: null,
    setSelectedSegmentIdx: vi.fn(),
    trackSegments: [segmentA, segmentB],
    playingPreviewId: null,
    resolvingTrackId: null,
    unifiedChartData: [],
    handleChartClick: vi.fn(),
    chartXDomain: [0, 400],
    chartXTicks: [],
    chartYDomain: [0, 200],
    distanceDisplayFactor: 1,
    handleChartMouseDown: vi.fn(),
    handleChartMouseMove: vi.fn(),
    handleChartMouseUp: vi.fn(),
    isDraggingChartSegment: false,
    openTrackMenuIndex: null,
    setOpenTrackMenuIndex: vi.fn(),
    handleDuplicateTrack: vi.fn(),
    handleReplaceTrackSameArtist: vi.fn(),
    handleReplaceTrack: vi.fn(),
    handleRemoveTrack: vi.fn(),
    bpmDistributionData: [{ name: '140-159', value: 200, color: '#f59e0b' }],
    bpmDistributionIsZoneBased: false,
    genreDistributionData: [{ name: 'Rock', value: 200 }, { name: 'Pop', value: 180 }],
    isSaved: true,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    colorMode: 'light',
    isLocked: false,
    favorites: { tracks: [], artists: [] },
    toggleArtistFavorite: vi.fn(),
    resolveAndTogglePreview: vi.fn(),
    getNextTrackForAutoAdvance: vi.fn(),
    playlistCadenceUnit: 'PPM',
    bpmChartActivityName: 'Course à pied',
    hasDetailFilter: false,
    trackMatchesDetailFilter: vi.fn(() => false),
    selectedDetailGenre: new Set(),
    selectedDetailBpmBucket: new Set(),
    setSelectedDetailGenre: vi.fn(),
    setSelectedDetailBpmBucket: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistCharts — en-tête et contrôles du graphique', () => {
  it('titre "Courbe d\'intensité (BPM)" sans données réelles importées', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentActualData: null }));
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText("Courbe d'intensité (BPM)")).toBeInTheDocument();
  });

  it('avec données réelles (cadence) : titre dédié + stats de match affichées', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentActualData: [{}], selectedMetric: 'cadence', analysisStats: { matchPct: 70, abovePct: 20, belowPct: 10 } })
    );
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText(/Analyse Cadence \(PPM\) vs BPM cible/)).toBeInTheDocument();
    expect(screen.getByText(/Match: 70%/)).toBeInTheDocument();
  });

  it('métrique fréquence cardiaque : pas de stats de match (pas de cible équivalente)', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentActualData: [{}], selectedMetric: 'heartRate', analysisStats: { matchPct: 70, abovePct: 20, belowPct: 10 } })
    );
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText('Fréquence cardiaque de la séance')).toBeInTheDocument();
    expect(screen.queryByText(/Match:/)).not.toBeInTheDocument();
  });

  it('sélecteur de date de séance affiché seulement si >1 date de données réelles', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ actualDataByDate: { '2026-01-01': [], '2026-01-08': [] } }) }));
    const { rerender } = render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ actualDataByDate: { '2026-01-01': [] } }) }));
    rerender(<PlaylistCharts {...baseProps()} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('toggle cadence/FC affiché seulement si les 2 métriques dispo ; le clic appelle setSelectedMetric', () => {
    const setSelectedMetric = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ availableMetrics: { cadence: true, heartRate: true }, setSelectedMetric }));
    render(<PlaylistCharts {...baseProps()} />);

    fireEvent.click(screen.getByText('Fréquence cardiaque'));
    expect(setSelectedMetric).toHaveBeenCalledWith('heartRate');
  });

  it('les boutons -10s/+10s appellent setDataOffset avec le bon décalage', () => {
    const setDataOffset = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentActualData: [{}], dataOffset: 5, setDataOffset }));
    render(<PlaylistCharts {...baseProps()} />);

    expect(screen.getByText('Décalage: +5s')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+10s'));
    const updater = setDataOffset.mock.calls[0][0];
    expect(updater(5)).toBe(15);
  });

  it('axe Temps/Distance : le clic appelle setChartAxisType, le sélecteur km/mi n\'apparaît qu\'en mode distance', () => {
    const setChartAxisType = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ chartAxisType: 'temps', setChartAxisType }));
    const { rerender } = render(<PlaylistCharts {...baseProps()} />);
    expect(screen.queryByText('km')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Distance'));
    expect(setChartAxisType).toHaveBeenCalledWith('distance');

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ chartAxisType: 'distance' }));
    rerender(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText('km')).toBeInTheDocument();
    expect(screen.getByText('mi')).toBeInTheDocument();
  });
});

describe('PlaylistCharts — encart segment sélectionné', () => {
  it('aucune sélection : affiche le texte d\'invite', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ selectedSegmentIdx: null }));
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText(/Clique sur un segment du graphique/)).toBeInTheDocument();
  });

  it('segment sélectionné : affiche titre/artiste/BPM, navigation précédent/suivant', () => {
    const setSelectedSegmentIdx = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ selectedSegmentIdx: 0, setSelectedSegmentIdx }));
    render(<PlaylistCharts {...baseProps()} />);

    expect(screen.getByText('Titre A')).toBeInTheDocument();
    expect(screen.getByTitle('Titre précédent')).toBeDisabled(); // 1er titre

    fireEvent.click(screen.getByTitle('Titre suivant'));
    expect(setSelectedSegmentIdx).toHaveBeenCalledWith(1);
  });

  it('bouton lecture de l\'encart appelle resolveAndTogglePreview avec le bon titre', () => {
    const resolveAndTogglePreview = vi.fn();
    const getNextTrackForAutoAdvance = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ selectedSegmentIdx: 0 }));
    render(<PlaylistCharts {...baseProps({ resolveAndTogglePreview, getNextTrackForAutoAdvance })} />);

    fireEvent.click(screen.getByTitle('Écouter un extrait'));

    expect(resolveAndTogglePreview).toHaveBeenCalledWith(trackA, getNextTrackForAutoAdvance);
  });

  it('menu du segment : canEditTracks=true propose Dupliquer/Remplacer, "Retirer de la playlist" recalcule un index valide', () => {
    const handleRemoveTrack = vi.fn();
    const setSelectedSegmentIdx = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ selectedSegmentIdx: 1, openTrackMenuIndex: 1, isSaved: true, handleRemoveTrack, setSelectedSegmentIdx })
    );
    render(<PlaylistCharts {...baseProps({ isLocked: false })} />);

    expect(screen.getByText('Dupliquer ce titre')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retirer de la playlist'));

    expect(handleRemoveTrack).toHaveBeenCalledWith(1);
    expect(setSelectedSegmentIdx).toHaveBeenCalledWith(0); // trackSegments.length - 2 = 0
  });

  it('menu du segment : canEditTracks=false (verrouillé) masque Dupliquer/Remplacer/Retirer', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ selectedSegmentIdx: 0, openTrackMenuIndex: 0, isSaved: true }));
    render(<PlaylistCharts {...baseProps({ isLocked: true })} />);

    expect(screen.queryByText('Dupliquer ce titre')).not.toBeInTheDocument();
    expect(screen.queryByText('Retirer de la playlist')).not.toBeInTheDocument();
  });

  it('"Favoriser l\'artiste" (menu segment) appelle toggleArtistFavorite', () => {
    const toggleArtistFavorite = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ selectedSegmentIdx: 0, openTrackMenuIndex: 0 }));
    render(<PlaylistCharts {...baseProps({ toggleArtistFavorite })} />);

    fireEvent.click(screen.getByText(/Favoriser l'artiste/));

    expect(toggleArtistFavorite).toHaveBeenCalledWith('Artiste A');
  });
});

describe('PlaylistCharts — graphique et playlist vide', () => {
  it('playlist sans titre : affiche un message, aucun graphique rendu', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ tracks: [] }) }));
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText(/Cette playlist ne contient aucun morceau/)).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('indicateur de glissement affiché seulement pendant isDraggingChartSegment', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isDraggingChartSegment: true }));
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText(/Déplacement en cours/)).toBeInTheDocument();
  });

  it('le clic sur le graphique (LineChart) réinitialise les 2 filtres ET appelle handleChartClick', () => {
    const setSelectedDetailGenre = vi.fn();
    const setSelectedDetailBpmBucket = vi.fn();
    const handleChartClick = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ handleChartClick }));
    render(<PlaylistCharts {...baseProps({ setSelectedDetailGenre, setSelectedDetailBpmBucket })} />);

    fireEvent.click(screen.getByTestId('line-chart'));

    expect(setSelectedDetailGenre).toHaveBeenCalledWith(new Set());
    expect(setSelectedDetailBpmBucket).toHaveBeenCalledWith(new Set());
    expect(handleChartClick).toHaveBeenCalledWith({ activeLabel: 100 });
  });
});

describe('PlaylistCharts — camembert "Répartition par style" (genres)', () => {
  it('la légende reflète genreDistributionData avec les pourcentages', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistCharts {...baseProps()} />);
    // total = 200 + 180 = 380 → Rock 53%, Pop 47%
    expect(screen.getByText('53%')).toBeInTheDocument();
    expect(screen.getByText('47%')).toBeInTheDocument();
  });

  it('cliquer un genre dans la légende bascule le filtre ET réinitialise la sélection de segment', () => {
    const setSelectedDetailGenre = vi.fn();
    const setSelectedSegmentIdx = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ setSelectedSegmentIdx }));
    render(<PlaylistCharts {...baseProps({ setSelectedDetailGenre })} />);

    fireEvent.click(screen.getByText('Rock'));

    const updater = setSelectedDetailGenre.mock.calls[0][0];
    expect(updater(new Set())).toEqual(new Set(['Rock']));
    expect(setSelectedSegmentIdx).toHaveBeenCalledWith(null);
  });

  it('mini-liste des titres du filtre actif affichée uniquement si hasDetailFilter=true', () => {
    const trackMatchesDetailFilter = vi.fn((t) => t.genre === 'Rock');
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    const { rerender } = render(<PlaylistCharts {...baseProps({ hasDetailFilter: false })} />);
    expect(screen.queryByText(/^Titres ·/)).not.toBeInTheDocument();

    rerender(<PlaylistCharts {...baseProps({ hasDetailFilter: true, trackMatchesDetailFilter, selectedDetailGenre: new Set(['Rock']) })} />);
    // hasDetailFilter est un état PARTAGÉ entre les 2 camemberts (genre et
    // BPM) — les 2 panneaux affichent donc légitimement le même rappel
    // "Titres · Rock" simultanément ici (pas un bug : le camembert BPM n'a
    // pas de filtre BPM actif, mais reste soumis au même hasDetailFilter
    // global). D'où getAllByText (2 occurrences attendues) plutôt que
    // getByText.
    expect(screen.getAllByText(/Titres · Rock/)).toHaveLength(2);
    expect(screen.getAllByText('Titre A').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Titre B')).not.toBeInTheDocument();
  });
});

describe('PlaylistCharts — camembert BPM/zones/synchro', () => {
  it('sans profil configuré : titre "Répartition par BPM", camembert affiché', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ bpmDistributionIsZoneBased: false }));
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText('Répartition par BPM')).toBeInTheDocument();
    expect(screen.getByText('140-159')).toBeInTheDocument();
  });

  it('profil configuré (zones) : titre "Tes zones d\'intensité"', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ bpmDistributionIsZoneBased: true }));
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText("Tes zones d'intensité")).toBeInTheDocument();
  });

  it('cliquer un bucket BPM dans la légende bascule setSelectedDetailBpmBucket', () => {
    const setSelectedDetailBpmBucket = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistCharts {...baseProps({ setSelectedDetailBpmBucket })} />);

    fireEvent.click(screen.getByText('140-159'));

    const updater = setSelectedDetailBpmBucket.mock.calls[0][0];
    expect(updater(new Set())).toEqual(new Set(['140-159']));
  });

  it('mode Synchro (cadenceIntent="sync") : pas de camembert, affiche l\'écart moyen', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ getProfileForWorkout: vi.fn(() => ({ cadenceIntent: 'sync', targetBpm: 140 })) })
    );
    render(<PlaylistCharts {...baseProps()} />);

    expect(screen.getByText('Ta synchro cadence')).toBeInTheDocument();
    // Écarts : trackA 150-140=+10, trackB 130-140=-10 → moyenne des |écarts| = 10
    expect(screen.getByText('10 BPM', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('140-159')).not.toBeInTheDocument();
  });

  it('mode Synchro sans titre exploitable (aucun BPM) : message dédié', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({
        currentPlaylist: makePlaylist({ tracks: [{ ...trackA, bpm: null }] }),
        getProfileForWorkout: vi.fn(() => ({ cadenceIntent: 'sync', targetBpm: 140 })),
      })
    );
    render(<PlaylistCharts {...baseProps()} />);
    expect(screen.getByText('Aucun titre avec BPM exploitable pour cette séance.')).toBeInTheDocument();
  });
});
