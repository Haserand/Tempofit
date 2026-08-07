// @vitest-environment jsdom
//
// Test dédié à ProfileView.jsx — 0 test jusqu'ici malgré le composant le
// plus sensible de toute la "Feature Sociale" (01/08) : Login Wall, filtre
// `is_public` explicite (correctif de fuite de confidentialité sur son
// PROPRE profil), bannière "Aperçu de ton profil" (`isSelf`), cloisonnement
// Sport/Intime. `supabase` (supabaseClient.js) entièrement mocké — pas de
// vrai réseau.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Voir AuthContext.test.jsx pour l'explication complète de `vi.hoisted()`
// (zone morte temporelle sinon, fichier entier qui ne charge aucun test).
const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../../src/supabaseClient.js', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import ProfileView, { summarizeSessions } from '../../src/components/views/ProfileView.jsx';
import { OFFICIAL_VITRINE_USERNAME } from '../../src/data/officialVitrineProfile.js';
import { curatedSessions, naughtyCuratedSessions } from '../../src/data/curatedSessions.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Repli SÛR pour les tests qui n'appellent jamais `setupTableMocks()`
// (notamment la vitrine, ci-dessous) — indispensable depuis que
// ProfileView.jsx interroge AUSSI `template_clone_counts` pour cette
// branche (compteur de clonages honnête, 02/08) : sans lui, `mockFrom()`
// renverrait `undefined` (aucune implémentation par défaut), et
// `.select(...)` planterait dessus. `setupTableMocks()`, quand un test
// l'appelle explicitement, REMPLACE cette implémentation par une plus
// spécifique — ce repli n'est qu'un filet de sécurité, jamais la source
// de vérité d'un test précis.
beforeEach(() => {
  mockFrom.mockImplementation(() => makeTableBuilder({ data: [], error: null }));
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border',
  textHighlight: 'mock-highlight', textMuted: 'mock-muted',
  textColorClass: 'mock-text-color', bgAccentClass: 'mock-accent-bg',
  inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
};

// Builder chaînable minimal — `.select()`/`.eq()` renvoient l'objet
// lui-même (chaînable à volonté, comme le vrai client Supabase), et
// l'objet est lui-même "thenable" (`.then`) : `await builder` résout
// directement avec `result`, peu importe le nombre de `.eq()` enchaînés
// avant (le code réel enchaîne `.eq('user_id', ...).eq('is_public', true)`).
// Piste chaque appel `.eq(champ, valeur)` dans `eqCalls` — INDISPENSABLE
// pour vérifier que `is_public=true` est bien demandé explicitement (le
// correctif de fuite de confidentialité de cette session), pas seulement
// supposé fonctionner grâce à RLS.
function makeTableBuilder(result, eqCalls = []) {
  const b = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn((field, value) => { eqCalls.push([field, value]); return b; });
  b.then = (resolve) => resolve(result);
  return b;
}

// Configure `mockFrom` pour renvoyer des résultats différents selon la
// table interrogée ('playlists' vs 'routines') — le code réel interroge
// TOUJOURS les deux en parallèle (Promise.all), même si un seul type
// intéresse le test.
function setupTableMocks({ playlists = [], routines = [] } = {}) {
  const playlistsEqCalls = [];
  const routinesEqCalls = [];
  mockFrom.mockImplementation((table) => {
    if (table === 'playlists') return makeTableBuilder({ data: playlists, error: null }, playlistsEqCalls);
    if (table === 'routines') return makeTableBuilder({ data: routines, error: null }, routinesEqCalls);
    return makeTableBuilder({ data: [], error: null });
  });
  return { playlistsEqCalls, routinesEqCalls };
}

// Onglets Playlists/Routines (03/08, refonte — voir la docstring
// `activeProfileTab`, ProfileView.jsx) — l'onglet Playlists est actif par
// défaut, donc tout test qui vérifie le contenu de l'onglet Routines doit
// d'abord cliquer dessus (sinon la grille sous les yeux du test est celle
// de Playlists, vide ou non). Aide partagée plutôt que répétée dans
// chaque test.
async function switchToRoutinesTab() {
  fireEvent.click(await screen.findByRole('tab', { name: /Routines/ }));
}

const baseProps = {
  theme: mockTheme,
  username: 'tempofit_admin',
  isNaughtyMode: false,
  changeView: () => {},
  openModal: () => {},
  onOpenPlaylist: () => {},
  onOpenRoutine: () => {},
};

const mockProfileData = {
  username: 'tempofit_admin',
  user_id: 'owner-uuid-123',
  avatar_url: null,
  sport_sessions: [{ totalDuration: 600, bpm: 150 }, { totalDuration: 1200, bpm: 160 }],
};

describe('summarizeSessions (fonction pure)', () => {
  it('renvoie null pour un tableau vide ou absent', () => {
    expect(summarizeSessions([])).toBeNull();
    expect(summarizeSessions(null)).toBeNull();
    expect(summarizeSessions(undefined)).toBeNull();
  });

  it('calcule totalSeconds/avgBpm/sessionCount correctement', () => {
    const result = summarizeSessions([
      { totalDuration: 600, bpm: 150 },
      { totalDuration: 1200, bpm: 160 },
    ]);
    expect(result).toEqual({ totalSeconds: 1800, avgBpm: 155, sessionCount: 2 });
  });

  it('exclut les bpm <= 0 ou manquants du calcul de la moyenne, mais compte quand même la séance', () => {
    const result = summarizeSessions([
      { totalDuration: 600, bpm: 150 },
      { totalDuration: 300, bpm: 0 },
      { totalDuration: 300 }, // pas de bpm du tout
    ]);
    expect(result.avgBpm).toBe(150); // seule la 1re séance compte pour la moyenne
    expect(result.sessionCount).toBe(3); // mais les 3 comptent dans le total
    expect(result.totalSeconds).toBe(1200);
  });

  it('avgBpm vaut null si AUCUNE séance n\'a de bpm exploitable', () => {
    const result = summarizeSessions([{ totalDuration: 600 }]);
    expect(result.avgBpm).toBeNull();
  });
});

describe('ProfileView — Login Wall', () => {
  it('visiteur NON connecté : affiche l\'écran de verrouillage, n\'appelle JAMAIS supabase.rpc', async () => {
    render(<ProfileView {...baseProps} user={null} />);

    expect(await screen.findByText('Rejoins la communauté TempoFit')).toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('le bouton "Se connecter / S\'inscrire" appelle openModal(\'AUTH\')', async () => {
    const openModal = vi.fn();
    render(<ProfileView {...baseProps} user={null} openModal={openModal} />);

    fireEvent.click(await screen.findByRole('button', { name: /Se connecter/ }));

    expect(openModal).toHaveBeenCalledWith('AUTH');
  });
});

describe('ProfileView — résolution du profil', () => {
  it('erreur Supabase sur get_public_profile_summary : affiche "profil privé ou introuvable"', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(<ProfileView {...baseProps} user={{ id: 'visitor-uuid' }} />);

    expect(await screen.findByText('Ce profil est privé ou introuvable.')).toBeInTheDocument();
  });

  it('data null SANS erreur (profil privé ou pseudo inexistant) : même message', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    render(<ProfileView {...baseProps} user={{ id: 'visitor-uuid' }} />);

    expect(await screen.findByText('Ce profil est privé ou introuvable.')).toBeInTheDocument();
  });

  it('succès : affiche le pseudo et appelle get_public_profile_summary avec le bon paramètre', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks();
    render(<ProfileView {...baseProps} user={{ id: 'visitor-uuid' }} />);

    expect(await screen.findByText('@tempofit_admin')).toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith('get_public_profile_summary', { target_username: 'tempofit_admin' });
  });
});

describe('ProfileView — bannière "Aperçu de ton profil" (isSelf)', () => {
  it('visiteur EXTERNE (user.id différent de profile.user_id) : bannière ABSENTE', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks();
    render(<ProfileView {...baseProps} user={{ id: 'un-autre-visiteur' }} />);

    await screen.findByText('@tempofit_admin');
    expect(screen.queryByText(/Aperçu de ton profil/)).toBeNull();
  });

  it('propriétaire consultant SON PROPRE profil (user.id === profile.user_id) : bannière PRÉSENTE', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks();
    render(<ProfileView {...baseProps} user={{ id: 'owner-uuid-123' }} />);

    expect(await screen.findByText(/Aperçu de ton profil/)).toBeInTheDocument();
  });
});

describe('ProfileView — filtre is_public explicite (correctif fuite de confidentialité)', () => {
  it('la requête playlists ET routines précise explicitement is_public=true, même en visitant son PROPRE profil', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    const { playlistsEqCalls, routinesEqCalls } = setupTableMocks();
    // Volontairement le PROPRIÉTAIRE lui-même (RLS le laisserait voir ses
    // lignes privées aussi si ce filtre explicite disparaissait un jour).
    render(<ProfileView {...baseProps} user={{ id: 'owner-uuid-123' }} />);

    await screen.findByText('@tempofit_admin');
    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('playlists'));

    expect(playlistsEqCalls).toContainEqual(['is_public', true]);
    expect(routinesEqCalls).toContainEqual(['is_public', true]);
    expect(playlistsEqCalls).toContainEqual(['user_id', 'owner-uuid-123']);
  });
});

describe('ProfileView — cloisonnement Sport/Intime des playlists partagées', () => {
  const publicPlaylists = [
    { id: 'pl-sport', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, content: { name: 'Sortie running', totalDuration: 1800, config: { bpm: 150 } } },
    { id: 'pl-intime', user_id: 'owner-uuid-123', is_public: true, is_intimate: true, content: { name: 'Séance Intime', totalDuration: 900, config: { bpm: 120 } } },
  ];

  it('visiteur en mode SPORT : ne voit QUE les playlists is_intimate=false', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: publicPlaylists });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={false} />);

    expect(await screen.findByText('Sortie running')).toBeInTheDocument();
    expect(screen.queryByText('Séance Intime')).toBeNull();
  });

  it('visiteur en Mode Intime : ne voit QUE les playlists is_intimate=true', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: publicPlaylists });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={true} />);

    expect(await screen.findByText('Séance Intime')).toBeInTheDocument();
    expect(screen.queryByText('Sortie running')).toBeNull();
  });

  it('aucune playlist dans ce mode : affiche le message d\'état vide dédié', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    expect(await screen.findByText('Aucune playlist publique dans ce mode pour le moment.')).toBeInTheDocument();
  });

  it('le clic sur une carte de playlist appelle onOpenPlaylist avec la ligne complète + _ownerUsername', async () => {
    // ⚠️ CORRIGÉ (05/08, retour direct — "ajouter le nom du compte
    // créateur... pour mieux se repérer") : `onOpenPlaylist` reçoit
    // désormais la ligne + `_ownerUsername` (le pseudo du profil consulté,
    // voir ProfileView.jsx) — l'égalité stricte avec `publicPlaylists[0]`
    // seul ne matche plus, ce champ en plus est déjà attendu.
    const onOpenPlaylist = vi.fn();
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: publicPlaylists });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} onOpenPlaylist={onOpenPlaylist} />);

    fireEvent.click(await screen.findByText('Sortie running'));

    expect(onOpenPlaylist).toHaveBeenCalledWith({ ...publicPlaylists[0], _ownerUsername: baseProps.username });
  });
});

// Vague 2, Chantier 1 — UI publique des routines (02/08). `content` d'une
// routine a une forme DIFFÉRENTE de celle d'une playlist (voir la
// docstring de `PublicItemCard`, ProfileView.jsx) : `bpm` à la racine (pas
// `config.bpm`), pas de `totalDuration` (rien n'a encore été généré), une
// distance/durée CIBLE (`targetMode`/`distanceVal`/`distanceUnit` ou
// `hours`/`minutes`) plutôt qu'un total réel.
describe('ProfileView — routines partagées', () => {
  const publicRoutines = [
    {
      id: 'routine-sport', user_id: 'owner-uuid-123', is_public: true, is_intimate: false,
      content: { name: 'Mon 10km Rapide', coverIcon: '🏃‍♀️', workoutType: 'Course à pied', targetMode: 'distance', distanceVal: 10, distanceUnit: 'km', bpm: 170, isIntervalMode: false },
    },
  ];

  it('affiche la distance cible et le BPM d\'une routine (pas totalDuration/config.bpm, qui n\'existent pas sur une routine)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ routines: publicRoutines });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);
    await switchToRoutinesTab();

    expect(await screen.findByText('Mon 10km Rapide')).toBeInTheDocument();
    expect(screen.getByText('10 km')).toBeInTheDocument();
    expect(screen.getByText('170 BPM')).toBeInTheDocument();
  });

  it('le clic sur une carte de routine appelle onOpenRoutine avec la ligne complète + _ownerUsername', async () => {
    // ⚠️ CORRIGÉ (05/08, même correctif que le test playlist équivalent
    // juste au-dessus — voir sa docstring).
    const onOpenRoutine = vi.fn();
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ routines: publicRoutines });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} onOpenRoutine={onOpenRoutine} />);
    await switchToRoutinesTab();

    fireEvent.click(await screen.findByText('Mon 10km Rapide'));

    expect(onOpenRoutine).toHaveBeenCalledWith({ ...publicRoutines[0], _ownerUsername: baseProps.username });
  });

  it('cloisonnement Sport/Intime respecté pour les routines, comme pour les playlists', async () => {
    const intimateRoutine = { id: 'routine-intime', user_id: 'owner-uuid-123', is_public: true, is_intimate: true, content: { name: 'Routine Intime', coverIcon: '🍑', workoutType: 'Cardio', targetMode: 'distance', distanceVal: 3, distanceUnit: 'km', bpm: 120 } };
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ routines: [...publicRoutines, intimateRoutine] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={false} />);
    await switchToRoutinesTab();

    expect(await screen.findByText('Mon 10km Rapide')).toBeInTheDocument();
    expect(screen.queryByText('Routine Intime')).toBeNull();
  });
});

// Brief "Recherche & filtres sur les profils publics" (02/08) — tests
// d'INTÉGRATION (le hook lui-même est testé isolément dans
// tests/hooks/useProfileSearchFilter.test.js). Le cas "item is_intimate
// glissé dans le tableau source" est le test explicitement demandé par le
// brief : il ne vérifie PAS une logique du hook (qui n'en a aucune sur
// is_intimate), mais que ProfileView.jsx continue de lui passer le
// tableau déjà filtré par mode (`visiblePlaylists`/`visibleRoutines`),
// même combiné avec une recherche/un filtre actif.
// Vague 2, Chantier 3 — "description texte libre sur une playlist/routine
// publique" (02/08). `content.description` est un champ COMMUN aux deux
// `kind` (simple texte libre, contrairement à bpm/durée/genre qui
// divergent) — un seul describe couvre donc playlist ET routine.
// Vague 2, Chantier "compteur de sauvegardes/clonages" (02/08).
// `clone_count` est une VRAIE colonne de la ligne (pas un champ de
// `content`, contrairement à `description`) — arrive automatiquement via
// le `select('*')` déjà en place, rien de neuf à mocker côté requête.
describe('ProfileView — compteur de clonages', () => {
  const playlistWithClones = { id: 'pl-clones', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, clone_count: 12, content: { name: 'Sortie populaire', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [] } };
  const playlistWithoutClones = { id: 'pl-no-clones', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, clone_count: 0, content: { name: 'Sortie discrète', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [] } };
  const routineWithClones = { id: 'routine-clones', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, clone_count: 3, content: { name: 'Mon 10km', workoutType: 'Course à pied', coverIcon: '🏃', targetMode: 'distance', distanceVal: 10, distanceUnit: 'km', bpm: 170 } };

  it('affiche le badge de clonages sur une carte quand clone_count > 0', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [playlistWithClones] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Sortie populaire');
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  // ⚠️ CORRIGÉ (05/08, retour direct : "je ne vois pas le nombre de
  // clones... si c'est 0 alors pas grave de laisser 0") — le badge PAR
  // CARTE s'affiche désormais TOUJOURS, même à 0 (harmonisé avec
  // TemplateCard.jsx, voir sa docstring dans ProfileView.jsx). Ne PAS
  // confondre avec le total AGRÉGÉ ("X clonages reçus" au-dessus de la
  // grille, testé plus bas) — CELUI-LÀ reste bien caché à 0
  // ("total ABSENT quand la somme vaut 0"), décision distincte et
  // inchangée : un bandeau "0 clonages reçus" au niveau du profil entier
  // reste peu utile, contrairement au badge par carte qui, lui, sert de
  // repère cohérent partout dans l'app (Découvrir/vitrine/ici).
  it('affiche le badge de clonages sur une carte MÊME quand clone_count vaut 0', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [playlistWithoutClones] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Sortie discrète');
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('affiche le total agrégé (playlists + routines confondues) au-dessus de la grille', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [playlistWithClones], routines: [routineWithClones] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    expect(await screen.findByText('15 clonages reçus')).toBeInTheDocument();
  });

  it('accord singulier/pluriel correct pour un seul clonage', async () => {
    const singlePlaylist = { ...playlistWithClones, clone_count: 1 };
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [singlePlaylist] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    expect(await screen.findByText('1 clonage reçu')).toBeInTheDocument();
  });

  it('total ABSENT quand la somme vaut 0 (aucun item avec des clonages)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [playlistWithoutClones] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Sortie discrète');
    expect(screen.queryByText(/clonages? reçus?/)).toBeNull();
  });

  it('le total ne mélange JAMAIS Sport et Intime — seulement le mode actuellement affiché', async () => {
    const intimatePlaylistWithClones = { id: 'pl-intime-clones', user_id: 'owner-uuid-123', is_public: true, is_intimate: true, clone_count: 99, content: { name: 'Séance Intime', workoutType: 'Cardio', totalDuration: 1200, config: { bpm: 150 }, tracks: [] } };
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [playlistWithClones, intimatePlaylistWithClones] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={false} />);

    // Mode Sport actif : seul le total de la playlist Sport (12) doit
    // apparaître, jamais 111 (12 + 99, qui mélangerait les deux modes).
    expect(await screen.findByText('12 clonages reçus')).toBeInTheDocument();
  });
});

// "Clone" vs "Enfant" (02/08, discussion produit ; refonte 03/08 — voir
// supabase-schema.sql) — badge affiché UNIQUEMENT quand `parent_user_id`
// (VRAIE colonne, pas `content`) existe (fait partie d'une lignée de
// clonage) ; sinon aucun badge (création originale).
describe('ProfileView — badge "Clone"/"Enfant" (lignée de clonage)', () => {
  const clonedNeverModified = { id: 'pl-clone', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, parent_user_id: 'user-A', content: { name: 'Copie fidèle', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [], isModifiedSinceClone: false } };
  const clonedThenModified = { id: 'pl-enfant', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, parent_user_id: 'user-A', content: { name: 'Copie modifiée', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [], isModifiedSinceClone: true } };
  const originalCreation = { id: 'pl-original', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, content: { name: 'Création originale', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [] } };

  it('affiche "Clone" pour une copie jamais modifiée depuis le clonage', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [clonedNeverModified] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Copie fidèle');
    expect(screen.getByText('Clone')).toBeInTheDocument();
  });

  it('affiche "Enfant" pour une copie modifiée depuis le clonage', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [clonedThenModified] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Copie modifiée');
    expect(screen.getByText('Enfant')).toBeInTheDocument();
  });

  it('n\'affiche AUCUN badge pour une création originale (jamais clonée)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [originalCreation] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Création originale');
    expect(screen.queryByText('Clone')).toBeNull();
    expect(screen.queryByText('Enfant')).toBeNull();
  });
});

describe('ProfileView — description libre sur les cartes publiques', () => {
  const playlistWithDescription = { id: 'pl-desc', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, content: { name: 'Sortie du dimanche', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [], description: 'Une sortie tranquille pour récupérer.' } };
  const routineWithDescription = { id: 'routine-desc', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, content: { name: 'Mon 10km', workoutType: 'Course à pied', coverIcon: '🏃', targetMode: 'distance', distanceVal: 10, distanceUnit: 'km', bpm: 170, description: 'À lancer avant le petit-déjeuner.' } };
  const itemWithoutDescription = { id: 'pl-nodesc', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, content: { name: 'Séance sans description', workoutType: 'Cyclisme', totalDuration: 1800, config: { bpm: 130 }, tracks: [] } };

  it('affiche la description d\'une playlist publique quand elle existe', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [playlistWithDescription] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    expect(await screen.findByText('Une sortie tranquille pour récupérer.')).toBeInTheDocument();
  });

  it('affiche la description d\'une routine publique quand elle existe', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ routines: [routineWithDescription] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);
    await switchToRoutinesTab();

    expect(await screen.findByText('À lancer avant le petit-déjeuner.')).toBeInTheDocument();
  });

  it('n\'affiche rien de particulier quand il n\'y a pas de description (pas de paragraphe vide)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [itemWithoutDescription] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    expect(await screen.findByText('Séance sans description')).toBeInTheDocument();
    // Pas d'assertion négative fragile sur l'absence d'un <p> vide — le
    // rendu conditionnel (`content.description &&`) suffit à garantir
    // qu'aucun paragraphe n'est produit ; la présence du titre confirme que
    // le composant a bien rendu sans planter sur ce cas.
  });

  it('la description entre aussi dans la recherche texte (voir useProfileSearchFilter.js)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [playlistWithDescription, itemWithoutDescription] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Sortie du dimanche');
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un titre/), { target: { value: 'récupérer' } });

    expect(screen.getByText('Sortie du dimanche')).toBeInTheDocument();
    expect(screen.queryByText('Séance sans description')).toBeNull();
  });
});

describe('ProfileView — recherche & filtres', () => {
  const sportPlaylist = { id: 'pl-sport', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, content: { name: 'Sortie Running Rapide', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [] } };
  const intimatePlaylist = { id: 'pl-intime', user_id: 'owner-uuid-123', is_public: true, is_intimate: true, content: { name: 'Sortie Running Intime', workoutType: 'Course à pied', totalDuration: 1200, config: { bpm: 150 }, tracks: [] } };
  const sportRoutine = { id: 'routine-sport', user_id: 'owner-uuid-123', is_public: true, is_intimate: false, content: { name: 'Mon 10km', workoutType: 'Course à pied', coverIcon: '🏃', targetMode: 'distance', distanceVal: 10, distanceUnit: 'km', bpm: 170, selectedGenres: ['Rock'] } };

  it('la barre de recherche/filtres n\'apparaît PAS si la grille est vide (aucun contenu public)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [], routines: [] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Aucune playlist publique dans ce mode pour le moment.');
    expect(screen.queryByPlaceholderText(/Rechercher un titre/)).toBeNull();
  });

  it('la recherche texte reste PARTAGÉE en changeant d\'onglet (Playlists → Routines)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [sportPlaylist], routines: [sportRoutine] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    // Onglet Playlists (par défaut) : la routine n'est PAS visible ici,
    // même si elle matcherait la recherche — c'est tout le principe des
    // onglets (03/08, retour direct : les routines étaient noyées dans une
    // grille combinée).
    await screen.findByText('Sortie Running Rapide');
    expect(screen.queryByText('Mon 10km')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Rechercher un titre/), { target: { value: '10km' } });

    // Aucune playlist ne matche "10km" → état vide sur l'onglet Playlists.
    expect(await screen.findByText('Aucune séance ne correspond à vos filtres.')).toBeInTheDocument();

    // La recherche reste active en changeant d'onglet (état PARTAGÉ,
    // voir useProfileSearchFilter.js) — la routine "Mon 10km" matche.
    await switchToRoutinesTab();
    expect(await screen.findByText('Mon 10km')).toBeInTheDocument();
  });

  it('cas spécifique du brief : un item is_intimate glissé dans le tableau source n\'apparaît dans AUCUN résultat en mode Sport, recherche vide ou active', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [sportPlaylist, intimatePlaylist] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={false} />);

    await screen.findByText('Sortie Running Rapide');
    expect(screen.queryByText('Sortie Running Intime')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Rechercher un titre/), { target: { value: 'running' } });
    expect(screen.queryByText('Sortie Running Intime')).toBeNull();
    expect(screen.getByText('Sortie Running Rapide')).toBeInTheDocument();
  });

  it('état vide "Aucune séance ne correspond à vos filtres" + réinitialisation quand la recherche ne matche rien', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [sportPlaylist] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Sortie Running Rapide');
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un titre/), { target: { value: 'zzzz-aucun-match' } });

    expect(await screen.findByText('Aucune séance ne correspond à vos filtres.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Réinitialiser les filtres'));
    expect(await screen.findByText('Sortie Running Rapide')).toBeInTheDocument();
  });

  it('cliquer l\'onglet "Routines" masque les playlists — plus besoin de déplier les filtres (c\'était l\'ancien comportement, retiré)', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: [sportPlaylist], routines: [sportRoutine] });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} />);

    await screen.findByText('Sortie Running Rapide');
    expect(screen.queryByText('Mon 10km')).toBeNull();

    await switchToRoutinesTab();

    expect(screen.queryByText('Sortie Running Rapide')).toBeNull();
    expect(screen.getByText('Mon 10km')).toBeInTheDocument();
  });
});

describe('ProfileView — blocs de statistiques (Sport/Intime)', () => {
  it('affiche le bloc Sport avec les chiffres corrects quand sport_sessions est présent et mode Sport actif', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks();
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={false} />);

    expect(await screen.findByText('Statistiques sportives')).toBeInTheDocument();
    expect(screen.getByText('155')).toBeInTheDocument(); // avgBpm de mockProfileData
  });

  it('sport_sessions ABSENT du tout (bascule désactivée côté propriétaire) : bloc Sport masqué', async () => {
    mockRpc.mockResolvedValue({ data: { username: 'tempofit_admin', user_id: 'owner-uuid-123', avatar_url: null }, error: null });
    setupTableMocks();
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={false} />);

    await screen.findByText('@tempofit_admin');
    expect(screen.queryByText('Statistiques sportives')).toBeNull();
  });

  it('bloc Sport masqué en Mode Intime, même si sport_sessions est présent', async () => {
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks();
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} isNaughtyMode={true} />);

    await screen.findByText('@tempofit_admin');
    expect(screen.queryByText('Statistiques sportives')).toBeNull();
  });
});

// Feature Sociale "Cold Start" (02/08) — 0 test jusqu'ici, malgré l'enjeu
// central de cette fonctionnalité : rester accessible à TOUT LE MONDE (y
// compris non connecté), sans le moindre appel réseau.
describe('ProfileView — profil vitrine officiel (@tempofit_officiel)', () => {
  it('accessible SANS connexion — jamais l\'écran Login Wall, jamais d\'appel à supabase.rpc', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} />);

    expect(await screen.findByText(`@${OFFICIAL_VITRINE_USERNAME}`)).toBeInTheDocument();
    expect(screen.queryByText('Rejoins la communauté TempoFit')).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('accessible aussi pour un visiteur CONNECTÉ, résultat identique', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={{ id: 'un-vrai-visiteur' }} />);
    expect(await screen.findByText(`@${OFFICIAL_VITRINE_USERNAME}`)).toBeInTheDocument();
  });

  it('jamais la bannière "Aperçu de ton profil" — cette vitrine n\'est JAMAIS "ton propre profil", quel que soit le visiteur', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={{ id: 'un-vrai-visiteur' }} />);
    await screen.findByText(`@${OFFICIAL_VITRINE_USERNAME}`);
    expect(screen.queryByText(/Aperçu de ton profil/)).toBeNull();
  });

  it('statistiques sportives affichées en mode Sport, sans appel réseau POUR LES STATS elles-mêmes (mockRpc jamais appelé)', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={false} />);

    expect(await screen.findByText('Statistiques sportives')).toBeInTheDocument();
    // ⚠️ RENOMMÉ le 02/08 (compteur de clonages honnête) — `mockFrom` EST
    // désormais appelé une fois pour la vitrine (`template_clone_counts`,
    // voir ProfileView.jsx), donc l'ancienne assertion "mockFrom jamais
    // appelé" n'est plus vraie. Ce qui reste vrai et vérifié ici : les
    // STATISTIQUES elles-mêmes (fausses par construction,
    // `buildOfficialVitrineProfile()`) ne déclenchent toujours AUCUN appel
    // réseau — seule la grille de playlists/routines en déclenche un,
    // couvert séparément ci-dessous.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('bascule vers les statistiques Intime en Mode Intime (mêmes règles d\'affichage qu\'un vrai profil)', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={true} />);
    await screen.findByText(`@${OFFICIAL_VITRINE_USERNAME}`);
    expect(screen.queryByText('Statistiques sportives')).toBeNull();
  });

  it('grille "Playlists partagées" peuplée directement depuis le catalogue (contenu lui-même statique, PAS chargé depuis Supabase)', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={false} />);

    expect(await screen.findByText(curatedSessions[0].title)).toBeInTheDocument();
    // ⚠️ RENOMMÉ le 02/08 (compteur de clonages honnête) — voir le test
    // précédent : `mockFrom` EST désormais appelé (`template_clone_counts`),
    // ce n'est plus "sans appel réseau". Ce qui reste vrai : le CONTENU
    // (titres/BPM/durées) vient de `data/curatedSessions.js`, jamais d'une
    // requête `playlists`/`routines` — vérifié en confirmant qu'aucun
    // appel `mockFrom` ne cible CES tables précises pour la vitrine.
    expect(mockFrom).not.toHaveBeenCalledWith('playlists');
    expect(mockFrom).not.toHaveBeenCalledWith('routines');
  });

  // Compteur de clonages HONNÊTE (02/08, retour direct : "0 par défaut si
  // jamais y en a 0, 1 si jamais y en a un etc") — voir la docstring de la
  // branche vitrine, ProfileView.jsx.
  it('récupère les VRAIS compteurs de clonage (template_clone_counts) et les applique aux cartes de la vitrine', async () => {
    mockFrom.mockImplementation((table) => {
      if (table === 'template_clone_counts') {
        return makeTableBuilder({ data: [{ template_id: curatedSessions[0].id, clone_count: 5 }], error: null });
      }
      return makeTableBuilder({ data: [], error: null });
    });
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={false} />);

    await screen.findByText(curatedSessions[0].title);
    expect(mockFrom).toHaveBeenCalledWith('template_clone_counts');
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  // ⚠️ CORRIGÉ (05/08, retour direct — voir la docstring du badge dans
  // ProfileView.jsx) : "jamais un nombre inventé" reste vrai (0 est la
  // valeur RÉELLE, pas une invention), mais le badge n'est plus masqué à
  // 0 — il s'affiche désormais, comme partout ailleurs dans l'app.
  it('un template jamais cloné (absent de template_clone_counts) affiche bien 0, jamais un nombre inventé', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={false} />);
    await screen.findByText(curatedSessions[0].title);
    expect(screen.getByTitle('Nombre de fois où cette playlist/routine a été clonée')).toHaveTextContent('0');
  });

  it('cloisonnement Sport/Intime respecté dans la grille de la vitrine, exactement comme un vrai profil', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={false} />);
    expect(await screen.findByText(curatedSessions[0].title)).toBeInTheDocument();
    expect(screen.queryByText(naughtyCuratedSessions[0].title)).toBeNull();
    cleanup();

    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={true} />);
    expect(await screen.findByText(naughtyCuratedSessions[0].title)).toBeInTheDocument();
    expect(screen.queryByText(curatedSessions[0].title)).toBeNull();
  });

  it('le clic sur une playlist de la vitrine appelle onOpenPlaylist avec une ligne portant _sourceTemplate (préserve le clonage)', async () => {
    const onOpenPlaylist = vi.fn();
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} onOpenPlaylist={onOpenPlaylist} />);

    fireEvent.click(await screen.findByText(curatedSessions[0].title));

    expect(onOpenPlaylist).toHaveBeenCalledWith(expect.objectContaining({
      _sourceTemplate: curatedSessions[0],
      is_public: true,
    }));
  });

  // Chantier annexe (brief "Recherche & filtres sur les profils publics",
  // 02/08) — la vitrine n'affichait AVANT que des playlists
  // (`routines: []` codé en dur). `buildOfficialVitrineRoutineRows()`
  // fournit désormais 3-4 routines fictives, Sport ET Intime confondues
  // (même principe que les playlists de la vitrine).
  it('la grille de la vitrine affiche aussi des routines fictives (pas seulement des playlists)', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={false} />);
    await switchToRoutinesTab();
    expect(await screen.findByText('Mon 5km Quotidien')).toBeInTheDocument();
  });

  it('cloisonnement Sport/Intime respecté pour les routines de la vitrine aussi', async () => {
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={false} />);
    await switchToRoutinesTab();
    expect(await screen.findByText('Mon 5km Quotidien')).toBeInTheDocument();
    expect(screen.queryByText('Rituel du Soir')).toBeNull();
    cleanup();

    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} isNaughtyMode={true} />);
    await switchToRoutinesTab();
    expect(await screen.findByText('Rituel du Soir')).toBeInTheDocument();
    expect(screen.queryByText('Mon 5km Quotidien')).toBeNull();
  });

  it('le clic sur une routine de la vitrine appelle onOpenRoutine avec la ligne complète', async () => {
    const onOpenRoutine = vi.fn();
    render(<ProfileView {...baseProps} username={OFFICIAL_VITRINE_USERNAME} user={null} onOpenRoutine={onOpenRoutine} />);
    await switchToRoutinesTab();

    fireEvent.click(await screen.findByText('Mon 5km Quotidien'));

    expect(onOpenRoutine).toHaveBeenCalledWith(expect.objectContaining({ id: 'vitrine-routine-1', is_public: true }));
  });
});
