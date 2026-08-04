// @vitest-environment jsdom
//
// Premier fichier de test pour StatsView.jsx — composant énorme (voir sa
// propre docstring, "de loin le plus gros des blocs de vue"), jamais testé
// jusqu'ici. Volontairement SCOPÉ au bloc "Clonages reçus" ajouté le 02/08
// (chantier "compteur de sauvegardes/clonages") — aucune ambition de
// couvrir les graphiques/genres/BPM/records, qui restent non testés ici.
//
// `recharts` mocké EN INTÉGRALITÉ (mêmes raisons que
// PlaylistCharts.test.jsx) : dépend de vraies mesures de layout que jsdom
// ne fournit jamais fidèlement, et ce n'est de toute façon pas ce fichier
// qui doit vérifier que recharts sait dessiner une ligne.
// `GlobalStatsShareCard`/`captureElementAsFile` mockés aussi : hors scope
// (export d'image), jamais déclenchés par les tests ci-dessous, mockés
// uniquement pour éviter tout risque de crash sans rapport avec la
// fonctionnalité testée (html2canvas, canvas non fiable sous jsdom).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Line: () => null,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
}));

vi.mock('../../src/components/shared/GlobalStatsShareCard.jsx', () => ({
  default: () => <div data-testid="global-stats-share-card-mock" />,
}));

vi.mock('../../src/utils/captureElementAsFile.js', () => ({
  captureElementAsFile: vi.fn(),
}));

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { rpc: (...args) => mockRpc(...args), from: (...args) => mockFrom(...args) },
  isSupabaseConfigured: true,
}));

import StatsView from '../../src/components/views/StatsView.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border',
  textHighlight: 'mock-highlight', textMuted: 'mock-muted',
  textColorClass: 'mock-text-color', bgAccentClass: 'mock-accent-bg',
};

// Au moins une complétion — nécessaire pour dépasser la garde
// `totalSessions === 0` (état vide) et atteindre le bloc "Gros chiffres"
// sous lequel vit le nouveau bloc "Clonages reçus".
const baseSavedPlaylists = [
  { id: 'pl-1', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150, selectedGenres: ['Rock'] }, completions: ['2026-01-01'], isNaughty: false },
];

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    savedPlaylists: baseSavedPlaylists,
    userStats: {},
    changeView: vi.fn(),
    setCurrentPlaylist: vi.fn(),
    athleticProfile: {},
    getProfileForWorkout: vi.fn(),
    getProfileForWorkoutOrDefault: vi.fn(),
    shareImageFile: vi.fn(),
    showToast: vi.fn(),
    isNaughtyMode: false,
    statsMode: 'standard',
    setStatsMode: vi.fn(),
    selectedStatsGenre: new Set(), setSelectedStatsGenre: vi.fn(),
    selectedStatsBpmBucket: new Set(), setSelectedStatsBpmBucket: vi.fn(),
    showAdvancedStats: false, setShowAdvancedStats: vi.fn(),
    expandedDetailGenre: null, setExpandedDetailGenre: vi.fn(),
    expandedDetailArtist: null, setExpandedDetailArtist: vi.fn(),
    user: { id: 'user-abc' },
    ...overrides,
  };
}

// Chaîne `.select().eq().eq().eq()` — imite le vrai query builder Supabase
// (même convention que ProfileView.test.jsx/SettingsView.test.jsx pour ce
// genre de mock).
function makeQueryBuilder(resolvedValue) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve) => Promise.resolve(resolvedValue).then(resolve),
  };
  return builder;
}

describe('StatsView — clonages reçus', () => {
  it('interroge playlists ET routines avec user_id/is_public/is_intimate corrects (mode Sport)', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps({ statsMode: 'standard' })} />);

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('playlists'));
    expect(mockFrom).toHaveBeenCalledWith('routines');
  });

  it('affiche le total (playlists + routines confondues) une fois chargé', async () => {
    mockFrom.mockImplementation((table) => makeQueryBuilder({
      data: table === 'playlists' ? [{ clone_count: 5 }, { clone_count: 2 }] : [{ clone_count: 1 }],
      error: null,
    }));
    render(<StatsView {...baseProps()} />);

    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(screen.getByText('Clonages reçus sur tes playlists/routines publiques')).toBeInTheDocument();
  });

  it('n\'affiche RIEN quand le total vaut 0 (pas de bloc vide à montrer)', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps()} />);

    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(screen.queryByText('Clonages reçus sur tes playlists/routines publiques')).not.toBeInTheDocument();
  });

  it('sans utilisateur connecté (user=null), aucune requête n\'est déclenchée', () => {
    render(<StatsView {...baseProps({ user: null })} />);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('en cas d\'erreur réseau, le total reste à 0 sans planter l\'affichage', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }));
    render(<StatsView {...baseProps()} />);

    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(screen.queryByText('Clonages reçus sur tes playlists/routines publiques')).not.toBeInTheDocument();
  });

  it('re-fetch quand statsMode change (Sport → Intime), avec is_intimate ajusté', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    const { rerender } = render(<StatsView {...baseProps({ statsMode: 'standard' })} />);
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    mockFrom.mockClear();

    rerender(<StatsView {...baseProps({ statsMode: 'naughty' })} />);
    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('playlists'));
  });
});

// Vue publique du profil (03/08, retour direct : "la page statistiques
// devrait permettre d'accéder à une vue publique de notre profil, avec un
// message incitant à gérer ses options de visibilité si rien n'est
// activé"). `mockFrom` neutralisé sur `{ data: [], error: null }` dans
// tout ce describe — hors scope (compteur de clonages, describe
// précédent), juste là pour que le composant ne plante pas sur son propre
// fetch.
describe('StatsView — vue publique du profil', () => {
  it('profil PUBLIC : affiche "Vue publique de ton profil" + le lien appelle onViewOwnProfile', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    const onViewOwnProfile = vi.fn();
    render(<StatsView {...baseProps({
      username: 'alex', profilePrivacy: { isProfilePublic: true }, onViewOwnProfile,
    })} />);

    expect(await screen.findByText('Vue publique de ton profil')).toBeInTheDocument();
    expect(screen.queryByText('Ton profil n\'est pas encore public')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Voir l\'aperçu de mon profil public →'));
    expect(onViewOwnProfile).toHaveBeenCalledTimes(1);
  });

  it('profil PAS public : affiche "Ton profil n\'est pas encore public" + le lien appelle onManageProfilePrivacy', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    const onManageProfilePrivacy = vi.fn();
    render(<StatsView {...baseProps({
      username: 'alex', profilePrivacy: { isProfilePublic: false }, onManageProfilePrivacy,
    })} />);

    expect(await screen.findByText('Ton profil n\'est pas encore public')).toBeInTheDocument();
    expect(screen.queryByText('Vue publique de ton profil')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Gérer ma visibilité →'));
    expect(onManageProfilePrivacy).toHaveBeenCalledTimes(1);
  });

  // `profilePrivacy` absent/`null` (pas encore chargé) — MÊME état que
  // "pas public" (repli sûr, jamais un lien vers un profil qui refuserait
  // l'accès), pas un 3e état distinct.
  it('profilePrivacy absent (pas encore chargé) : traité comme "pas public", jamais comme "public"', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps({ username: 'alex', profilePrivacy: null })} />);

    expect(await screen.findByText('Ton profil n\'est pas encore public')).toBeInTheDocument();
  });

  it('SANS username défini : le bloc entier reste absent, peu importe profilePrivacy', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps({ username: null, profilePrivacy: { isProfilePublic: true } })} />);

    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(screen.queryByText('Vue publique de ton profil')).not.toBeInTheDocument();
    expect(screen.queryByText('Ton profil n\'est pas encore public')).not.toBeInTheDocument();
  });

  // Jamais en Mode Intime (03/08, discussion : "le mauvais endroit pour ce
  // rappel, pas le bon message au bon moment") — même si le profil est
  // déjà public.
  it('en Mode Intime (statsMode="naughty") : le bloc reste absent, même profil public', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps({
      statsMode: 'naughty', username: 'alex', profilePrivacy: { isProfilePublic: true },
    })} />);

    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(screen.queryByText('Vue publique de ton profil')).not.toBeInTheDocument();
  });
});
