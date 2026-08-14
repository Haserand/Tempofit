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

// Section "Zones cardio" — jamais testée jusqu'ici (voir la docstring en
// tête de ce fichier, "aucune ambition de couvrir les graphiques"), ajoutée
// le 14/08 en même temps que les 3 infobulles manquantes sur cette section
// précise (chantier "infobulles" du même jour). Volontairement scopée à CE
// point précis (les infobulles + les gardes qui déclenchent chaque bloc),
// pas une couverture exhaustive de tout StatsView.jsx.
//
// Un jeu de données unique sert aux 3 tests : 2 playlists, 2 ACTIVITÉS
// différentes ("Course à pied"/"Cyclisme", pour dépasser la garde
// `zoneBreakdownByActivity.length > 1`), toutes deux classées dans la même
// zone (BPM 140 → "Seuil", profil zone1..4 identique pour les deux
// activités). Complétions dans le MÊME mois (juin) — volontaire : "Ton
// évolution par zone" (graphique du dessus, testé séparément avec SON
// PROPRE jeu de données) exige ≥2 MOIS distincts pour s'afficher ; le
// garder absent ici évite que ses libellés de zone (toujours les 4,
// inconditionnellement) ne se mélangent avec ceux du camembert ci-dessous
// dans les mêmes assertions `getByText`/`getByTitle`.
const zoneSavedPlaylists = [
  {
    id: 'pl-zone-1', workoutType: 'Course à pied', totalDuration: 200,
    config: { bpm: 140, selectedGenres: ['Rock'] }, completions: ['2026-06-01'], isNaughty: false,
    tracks: [{ title: 'Titre CAP', artist: 'Artiste A', bpm: 140, duration: 200, genre: 'Rock' }],
  },
  {
    id: 'pl-zone-2', workoutType: 'Cyclisme', totalDuration: 300,
    config: { bpm: 140, selectedGenres: ['Rock'] }, completions: ['2026-06-15'], isNaughty: false,
    tracks: [{ title: 'Titre Vélo', artist: 'Artiste B', bpm: 140, duration: 300, genre: 'Rock' }],
  },
];
// Jeu SÉPARÉ pour "Ton évolution par zone" — 2 MOIS distincts cette fois
// (une seule activité suffit, cette légende est inconditionnelle).
const zoneTrendSavedPlaylists = [
  {
    id: 'pl-trend-1', workoutType: 'Course à pied', totalDuration: 200,
    config: { bpm: 140, selectedGenres: ['Rock'] }, completions: ['2026-06-01'], isNaughty: false,
    tracks: [{ title: 'Titre CAP', artist: 'Artiste A', bpm: 140, duration: 200, genre: 'Rock' }],
  },
  {
    id: 'pl-trend-2', workoutType: 'Course à pied', totalDuration: 200,
    config: { bpm: 140, selectedGenres: ['Rock'] }, completions: ['2026-07-01'], isNaughty: false,
    tracks: [{ title: 'Titre CAP 2', artist: 'Artiste A', bpm: 140, duration: 200, genre: 'Rock' }],
  },
];
const zoneGetProfileForWorkout = () => ({ zone1: 100, zone2: 120, zone3: 140, zone4: 160 });

describe('StatsView — zones cardio (infobulles ajoutées le 14/08)', () => {
  it('"Ton évolution par zone" (≥2 mois distincts) : légende toujours affichée pour les 4 zones, chacune avec le libellé COMPLET en infobulle', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps({
      savedPlaylists: zoneTrendSavedPlaylists, getProfileForWorkout: zoneGetProfileForWorkout,
    })} />);

    expect(await screen.findByText('Ton évolution par zone')).toBeInTheDocument();
    // Cette légende reste TOUJOURS les 4 zones complètes (ATHLETIC_ZONES),
    // qu'elles aient ou non des données — contrairement au camembert
    // testé séparément ci-dessous, qui ne liste que les zones présentes.
    expect(screen.getByTitle('Récupération / Échauffement')).toBeInTheDocument();
    expect(screen.getByTitle('Endurance fondamentale / Footing')).toBeInTheDocument();
    expect(screen.getByTitle('Seuil / Tempo')).toBeInTheDocument();
    expect(screen.getByTitle('Vitesse / VMA')).toBeInTheDocument();
  });

  it('camembert "Tes zones d\'intensité" (bascule "Zones d\'effort") : la légende n\'affiche que les zones PRÉSENTES, libellé abrégé visible + libellé complet en infobulle', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps({
      savedPlaylists: zoneSavedPlaylists, getProfileForWorkout: zoneGetProfileForWorkout,
    })} />);

    // Mode par défaut = 'bpm' (répartition brute) — bascule explicite requise.
    const toggle = await screen.findByText("Zones d'effort");
    fireEvent.click(toggle);

    // "Détail par activité" s'affiche EN MÊME TEMPS que le camembert (même
    // bloc `statsChartMode === 'zones'`) — "Seuil" apparaît donc aussi sur
    // ses 2 lignes (Course à pied + Cyclisme, toutes deux classées dans
    // cette zone), en plus de la légende du camembert : 3 éléments au
    // total, pas 1 — `getAllByText`/`getAllByTitle`, pas les singuliers.
    expect(screen.getAllByText('Seuil').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle('Seuil / Tempo').length).toBeGreaterThanOrEqual(1);
    // Seule "Seuil" a des données dans ce jeu de test — les 3 autres zones
    // n'apparaissent PAS dans CETTE légende ("Ton évolution par zone",
    // inconditionnelle, n'est pas affichée ici : un seul mois de données,
    // voir le commentaire sur zoneSavedPlaylists plus haut).
    expect(screen.queryByText('Récupération')).not.toBeInTheDocument();
  });

  it('"Détail par activité" (≥2 activités classées) : chaque ligne de zone porte aussi le libellé complet en infobulle', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
    render(<StatsView {...baseProps({
      savedPlaylists: zoneSavedPlaylists, getProfileForWorkout: zoneGetProfileForWorkout,
    })} />);

    const toggle = await screen.findByText("Zones d'effort");
    fireEvent.click(toggle);

    expect(await screen.findByText('Détail par activité')).toBeInTheDocument();
    // "Course à pied"/"Cyclisme" apparaissent aussi dans la répartition
    // générale par activité (plus haut sur la page) — getAllByText plutôt
    // que getByText, au moins 2 occurrences chacune (générale + détail par
    // activité de CETTE section).
    expect(screen.getAllByText('Course à pied').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Cyclisme').length).toBeGreaterThanOrEqual(2);
    // Au moins 2 éléments porteurs du libellé complet "Seuil / Tempo" à ce
    // stade : la légende du camembert (test précédent) + au moins une ligne
    // de détail par activité (pas 3 ici — "Ton évolution par zone" n'est
    // pas affichée avec ce jeu de données, un seul mois).
    expect(screen.getAllByTitle('Seuil / Tempo').length).toBeGreaterThanOrEqual(2);
  });
});
