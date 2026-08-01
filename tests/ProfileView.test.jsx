// @vitest-environment jsdom
//
// Test dédié à ProfileView.jsx — 0 test jusqu'ici malgré le composant le
// plus sensible de toute la "Feature Sociale" (01/08) : Login Wall, filtre
// `is_public` explicite (correctif de fuite de confidentialité sur son
// PROPRE profil), bannière "Aperçu de ton profil" (`isSelf`), cloisonnement
// Sport/Intime. `supabase` (supabaseClient.js) entièrement mocké — pas de
// vrai réseau.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Voir AuthContext.test.jsx pour l'explication complète de `vi.hoisted()`
// (zone morte temporelle sinon, fichier entier qui ne charge aucun test).
const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../src/supabaseClient.js', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import ProfileView, { summarizeSessions } from '../src/components/views/ProfileView.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border',
  textHighlight: 'mock-highlight', textMuted: 'mock-muted',
  textColorClass: 'mock-text-color', bgAccentClass: 'mock-accent-bg',
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

const baseProps = {
  theme: mockTheme,
  username: 'tempofit_admin',
  isNaughtyMode: false,
  changeView: () => {},
  openModal: () => {},
  onOpenPlaylist: () => {},
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

  it('le clic sur une carte de playlist appelle onOpenPlaylist avec la ligne complète', async () => {
    const onOpenPlaylist = vi.fn();
    mockRpc.mockResolvedValue({ data: mockProfileData, error: null });
    setupTableMocks({ playlists: publicPlaylists });
    render(<ProfileView {...baseProps} user={{ id: 'visitor' }} onOpenPlaylist={onOpenPlaylist} />);

    fireEvent.click(await screen.findByText('Sortie running'));

    expect(onOpenPlaylist).toHaveBeenCalledWith(publicPlaylists[0]);
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
