// @vitest-environment jsdom
//
// Palier 3 (29/07, 4/11) — SettingsView. Le plus gros composant testé
// jusqu'ici (648 lignes, 3 onglets, 2 garde-fous d'onglet actif, export
// RGPD, suppression de compte). `AthleticProfilePanel` est mocké
// ENTIÈREMENT (pas juste son Context) : il lit lui-même `useGeneratorContext()`
// en interne pour tout son fonctionnement propre, ce qui est hors du
// périmètre d'un test de SettingsView — seul le fait qu'il soit monté (ou
// pas) selon l'onglet actif nous intéresse ici.
//
// jsdom n'implémente pas `URL.createObjectURL`/`revokeObjectURL` (utilisés
// par l'export RGPD) ni `navigator.clipboard` (utilisé par le copier-coller
// de l'URL de redirection Spotify) — les deux sont stubbés en haut de
// fichier, sinon les tests correspondants crashent pour une raison sans
// rapport avec le composant lui-même.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../src/components/views/AthleticProfilePanel.jsx', () => ({
  default: () => <div data-testid="athletic-profile-panel-mock">AthleticProfilePanel (mock)</div>,
}));

import SettingsView from '../src/components/views/SettingsView.jsx';

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
  Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-text-color',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
  borderAccentClass: 'mock-border-accent',
};

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    spotifyToken: null,
    loginSpotify: vi.fn(),
    setSpotifyToken: vi.fn(),
    spotifyRedirectUri: 'https://tempofit.example/callback',
    user: null,
    updateEmail: vi.fn(() => Promise.resolve({ error: null })),
    updatePassword: vi.fn(() => Promise.resolve({ error: null })),
    exportUserData: vi.fn(() => Promise.resolve({ data: { favorites: [] }, error: null })),
    deleteAccount: vi.fn(() => Promise.resolve({ error: null })),
    isSupabaseConfigured: true,
    userCount: 42,
    isNaughtyMode: false,
    showToast: vi.fn(),
    changeView: vi.fn(),
    username: null,
    usernameLoading: false,
    checkUsernameAvailable: vi.fn(() => Promise.resolve({ available: true, error: null })),
    setUsername: vi.fn(() => Promise.resolve({ error: null })),
    ...overrides,
  };
}

const loggedInUser = { email: 'alex@example.com' };

describe('SettingsView — onglets', () => {
  it('mode normal, sans compte : onglet "Profil Athlétique" actif par défaut, "Mon Compte" absent', () => {
    render(<SettingsView {...baseProps()} />);
    expect(screen.getByTestId('athletic-profile-panel-mock')).toBeInTheDocument();
    expect(screen.queryByText('Mon Compte')).not.toBeInTheDocument();
  });

  it('Mode Intime : l\'onglet "Profil Athlétique" n\'existe pas, "Services Musicaux" est actif par défaut', () => {
    render(<SettingsView {...baseProps({ isNaughtyMode: true })} />);
    expect(screen.queryByText('Profil Athlétique')).not.toBeInTheDocument();
    expect(screen.queryByTestId('athletic-profile-panel-mock')).not.toBeInTheDocument();
    expect(screen.getByText('Comptes connectés')).toBeInTheDocument();
  });

  it('avec un compte : l\'onglet "Mon Compte" est disponible et cliquable', () => {
    render(<SettingsView {...baseProps({ user: loggedInUser })} />);
    fireEvent.click(screen.getByText('Mon Compte'));
    expect(screen.getByText('Informations & Sécurité')).toBeInTheDocument();
  });

  it('garde-fou Mode Intime : si Mode Intime s\'active pendant que "Profil Athlétique" est ouvert, bascule vers "Services Musicaux"', () => {
    const { rerender } = render(<SettingsView {...baseProps({ isNaughtyMode: false })} />);
    expect(screen.getByTestId('athletic-profile-panel-mock')).toBeInTheDocument();

    rerender(<SettingsView {...baseProps({ isNaughtyMode: true })} />);

    expect(screen.queryByTestId('athletic-profile-panel-mock')).not.toBeInTheDocument();
    expect(screen.getByText('Comptes connectés')).toBeInTheDocument();
  });

  it('garde-fou invité : si l\'utilisateur se déconnecte pendant que "Mon Compte" est ouvert, bascule vers "Services Musicaux"', () => {
    const { rerender } = render(<SettingsView {...baseProps({ user: loggedInUser })} />);
    fireEvent.click(screen.getByText('Mon Compte'));
    expect(screen.getByText('Informations & Sécurité')).toBeInTheDocument();

    rerender(<SettingsView {...baseProps({ user: null })} />);

    expect(screen.getByText('Comptes connectés')).toBeInTheDocument();
    expect(screen.queryByText('Mon Compte')).not.toBeInTheDocument();
  });
});

describe('SettingsView — onglet Services Musicaux (Spotify)', () => {
  function renderOnMusicTab(overrides = {}) {
    const utils = render(<SettingsView {...baseProps(overrides)} />);
    fireEvent.click(screen.getByText('Services Musicaux'));
    return utils;
  }

  it('non connecté : affiche "Lier mon compte", clic appelle loginSpotify', () => {
    const loginSpotify = vi.fn();
    renderOnMusicTab({ loginSpotify });
    fireEvent.click(screen.getByText('Lier mon compte'));
    expect(loginSpotify).toHaveBeenCalled();
  });

  it('connecté : affiche "Déconnecter", clic vide le localStorage et appelle setSpotifyToken(null)', () => {
    const setSpotifyToken = vi.fn();
    window.localStorage.setItem('spotify_token', 'abc123');
    renderOnMusicTab({ spotifyToken: 'abc123', setSpotifyToken });

    fireEvent.click(screen.getByText('Déconnecter'));

    expect(window.localStorage.getItem('spotify_token')).toBeNull();
    expect(setSpotifyToken).toHaveBeenCalledWith(null);
  });

  it('affiche l\'aide "redirect_uri" uniquement si non connecté ET qu\'une redirectUri existe', () => {
    const { rerender } = renderOnMusicTab({ spotifyToken: null, spotifyRedirectUri: 'https://x/callback' });
    expect(screen.getByText('https://x/callback')).toBeInTheDocument();

    rerender(<SettingsView {...baseProps({ spotifyToken: 'abc', spotifyRedirectUri: 'https://x/callback' })} />);
    expect(screen.queryByText('https://x/callback')).not.toBeInTheDocument();
  });

  it('le clic sur "Copier cette URL" copie la redirectUri dans le presse-papier', () => {
    renderOnMusicTab({ spotifyRedirectUri: 'https://x/callback' });
    fireEvent.click(screen.getByTitle('Copier cette URL'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://x/callback');
  });
});

describe('SettingsView — onglet Mon Compte (Informations & Sécurité)', () => {
  function renderOnAccountTab(overrides = {}) {
    const utils = render(<SettingsView {...baseProps({ user: loggedInUser, ...overrides })} />);
    fireEvent.click(screen.getByText('Mon Compte'));
    return utils;
  }

  it('isSupabaseConfigured=false : message "pas encore configurés"', () => {
    renderOnAccountTab({ isSupabaseConfigured: false });
    expect(screen.getByText('Comptes pas encore configurés côté serveur.')).toBeInTheDocument();
  });

  it('sans pseudonyme : affiche le formulaire de définition (une seule fois)', () => {
    renderOnAccountTab({ username: null });
    expect(screen.getByText('Choisis ton pseudonyme')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('alex_runner')).toBeInTheDocument();
  });

  it('avec pseudonyme déjà défini : badge "Non modifiable", pas de formulaire', () => {
    renderOnAccountTab({ username: 'alex_runner' });
    expect(screen.getByText('@alex_runner')).toBeInTheDocument();
    expect(screen.getByText('Non modifiable')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('alex_runner')).not.toBeInTheDocument();
  });

  it('usernameLoading=true : n\'affiche ni le formulaire ni le badge (évite le flash trompeur)', () => {
    renderOnAccountTab({ username: null, usernameLoading: true });
    expect(screen.queryByText('Choisis ton pseudonyme')).not.toBeInTheDocument();
    expect(screen.queryByText('Non modifiable')).not.toBeInTheDocument();
  });

  it('quitter le champ pseudonyme déclenche checkUsernameAvailable et affiche "Disponible !"', async () => {
    const checkUsernameAvailable = vi.fn(() => Promise.resolve({ available: true, error: null }));
    renderOnAccountTab({ username: null, checkUsernameAvailable });

    fireEvent.change(screen.getByPlaceholderText('alex_runner'), { target: { value: 'nouveau_pseudo' } });
    fireEvent.blur(screen.getByPlaceholderText('alex_runner'));

    expect(checkUsernameAvailable).toHaveBeenCalledWith('nouveau_pseudo');
    await waitFor(() => expect(screen.getByText('Disponible !')).toBeInTheDocument());
  });

  it('valider le formulaire pseudonyme appelle setUsername', async () => {
    const setUsername = vi.fn(() => Promise.resolve({ error: null }));
    renderOnAccountTab({ username: null, setUsername });

    fireEvent.change(screen.getByPlaceholderText('alex_runner'), { target: { value: 'nouveau_pseudo' } });
    fireEvent.click(screen.getByText('Valider'));

    await waitFor(() => expect(setUsername).toHaveBeenCalledWith('nouveau_pseudo'));
  });

  it('e-mail : soumettre avec la même adresse affiche une erreur, sans appeler updateEmail', () => {
    const updateEmail = vi.fn();
    renderOnAccountTab({ updateEmail, username: 'alex' });

    fireEvent.click(screen.getAllByText('Modifier')[0]);
    fireEvent.click(screen.getByText('Enregistrer'));

    expect(screen.getByText('C\'est déjà ton adresse actuelle.')).toBeInTheDocument();
    expect(updateEmail).not.toHaveBeenCalled();
  });

  it('e-mail : soumettre une nouvelle adresse valide appelle updateEmail puis affiche la confirmation', async () => {
    const updateEmail = vi.fn(() => Promise.resolve({ error: null }));
    renderOnAccountTab({ updateEmail, username: 'alex' });

    fireEvent.click(screen.getAllByText('Modifier')[0]);
    fireEvent.change(screen.getByDisplayValue('alex@example.com'), { target: { value: 'nouveau@example.com' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => expect(updateEmail).toHaveBeenCalledWith('nouveau@example.com'));
    await waitFor(() => expect(screen.getByText(/e-mail de confirmation a été envoyé/)).toBeInTheDocument());
  });

  it('mot de passe : 2 valeurs différentes affichent une erreur, sans appeler updatePassword', () => {
    const updatePassword = vi.fn();
    renderOnAccountTab({ updatePassword, username: 'alex' });

    fireEvent.click(screen.getAllByText('Modifier')[1]); // 2e carte = mot de passe
    fireEvent.change(screen.getByPlaceholderText('Nouveau mot de passe'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByPlaceholderText('Confirme le nouveau mot de passe'), { target: { value: 'ghijkl' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    expect(screen.getByText('Les 2 mots de passe ne correspondent pas.')).toBeInTheDocument();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('mot de passe : 2 valeurs identiques (≥6 caractères) appelle updatePassword puis confirme', async () => {
    const updatePassword = vi.fn(() => Promise.resolve({ error: null }));
    renderOnAccountTab({ updatePassword, username: 'alex' });

    fireEvent.click(screen.getAllByText('Modifier')[1]);
    fireEvent.change(screen.getByPlaceholderText('Nouveau mot de passe'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByPlaceholderText('Confirme le nouveau mot de passe'), { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('abcdef'));
    await waitFor(() => expect(screen.getByText('Mot de passe mis à jour.')).toBeInTheDocument());
  });

  it('export RGPD : le clic sur "Exporter mes données" appelle exportUserData', async () => {
    const exportUserData = vi.fn(() => Promise.resolve({ data: { favorites: [] }, error: null }));
    renderOnAccountTab({ exportUserData, username: 'alex' });

    fireEvent.click(screen.getByText('Exporter mes données (JSON)'));

    await waitFor(() => expect(exportUserData).toHaveBeenCalled());
  });

  it('suppression de compte : ouvre la modale de confirmation, "Annuler" la ferme sans appeler deleteAccount', () => {
    const deleteAccount = vi.fn();
    renderOnAccountTab({ deleteAccount, username: 'alex' });

    fireEvent.click(screen.getByText('Supprimer mon compte'));
    expect(screen.getByText('Confirmer la suppression')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Annuler'));

    expect(screen.queryByText('Confirmer la suppression')).not.toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('suppression de compte : confirmer appelle deleteAccount et ferme la modale en cas de succès', async () => {
    const deleteAccount = vi.fn(() => Promise.resolve({ error: null }));
    renderOnAccountTab({ deleteAccount, username: 'alex' });

    fireEvent.click(screen.getByText('Supprimer mon compte'));
    fireEvent.click(screen.getByText('Oui, supprimer mon compte'));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Confirmer la suppression')).not.toBeInTheDocument());
  });

  it('suppression de compte : en cas d\'erreur, la modale reste ouverte avec le message d\'erreur', async () => {
    const deleteAccount = vi.fn(() => Promise.resolve({ error: 'Erreur serveur, réessaie plus tard.' }));
    renderOnAccountTab({ deleteAccount, username: 'alex' });

    fireEvent.click(screen.getByText('Supprimer mon compte'));
    fireEvent.click(screen.getByText('Oui, supprimer mon compte'));

    await waitFor(() => expect(screen.getByText('Erreur serveur, réessaie plus tard.')).toBeInTheDocument());
    expect(screen.getByText('Confirmer la suppression')).toBeInTheDocument();
  });
});
