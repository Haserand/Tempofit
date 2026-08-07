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

vi.mock('../../src/components/views/AthleticProfilePanel.jsx', () => ({
  default: () => <div data-testid="athletic-profile-panel-mock">AthleticProfilePanel (mock)</div>,
}));

const mockRpc = vi.fn();
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { rpc: (...args) => mockRpc(...args) },
  isSupabaseConfigured: true,
}));

import SettingsView from '../../src/components/views/SettingsView.jsx';

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
    profilePrivacy: null,
    updatePrivacySettings: vi.fn(() => Promise.resolve({ error: null })),
    onViewOwnProfile: vi.fn(),
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

  // `initialTab` (03/08, retour direct : "cliquer sur mon compte devrait
  // ouvrir mes réglages dans la partie mon compte") — 2e point d'entrée
  // vers cette vue, voir sa docstring dans le composant source.
  it('initialTab="account" ouvre directement sur "Mon Compte", sans avoir à cliquer l\'onglet', () => {
    render(<SettingsView {...baseProps({ user: loggedInUser, initialTab: 'account' })} />);
    expect(screen.getByText('Informations & Sécurité')).toBeInTheDocument();
  });

  it('initialTab absent (undefined/null) préserve le comportement par défaut inchangé — "Profil Athlétique" en mode normal', () => {
    render(<SettingsView {...baseProps({ user: loggedInUser })} />);
    expect(screen.getByTestId('athletic-profile-panel-mock')).toBeInTheDocument();
    expect(screen.queryByText('Informations & Sécurité')).not.toBeInTheDocument();
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

  // NOUVEAU (08/08, harmonisation "faut pas que tout soit le même ?") —
  // AVANT ce chantier, cette fonction n'avait aucun retour d'échec du tout
  // (`.catch(() => {})` silencieux) — jamais testé non plus. Migrée sur
  // `copyTextToClipboard` (même mécanique que `copyProfileLink` juste en
  // dessous dans ce même fichier de test), ce test vérifie que le message
  // d'erreur, désormais présent, s'affiche bien en cas d'échec réel.
  it('"Copier cette URL" : en cas d\'échec réel de la copie, affiche un message d\'erreur (nouveau, AVANT échec silencieux)', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) } });
    document.execCommand = vi.fn(() => false);
    const showToast = vi.fn();
    renderOnMusicTab({ spotifyRedirectUri: 'https://x/callback', showToast });
    fireEvent.click(screen.getByTitle('Copier cette URL'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Impossible de copier'), 'error'));
    delete document.execCommand;
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

  // Correctif UX — pseudos réservés (02/08) — 0 test jusqu'ici.
  it('quitter le champ avec un pseudo réservé ("admin_test") : message dédié, SANS appeler checkUsernameAvailable', () => {
    const checkUsernameAvailable = vi.fn();
    renderOnAccountTab({ username: null, checkUsernameAvailable });

    fireEvent.change(screen.getByPlaceholderText('alex_runner'), { target: { value: 'admin_test' } });
    fireEvent.blur(screen.getByPlaceholderText('alex_runner'));

    expect(checkUsernameAvailable).not.toHaveBeenCalled();
    expect(screen.getByText('Ce pseudo est réservé ou invalide.')).toBeInTheDocument();
  });

  it('valider le formulaire avec un pseudo réservé, jamais quitté au blur : bloqué quand même, setUsername jamais appelé', () => {
    const setUsername = vi.fn();
    renderOnAccountTab({ username: null, setUsername });

    fireEvent.change(screen.getByPlaceholderText('alex_runner'), { target: { value: 'system' } });
    fireEvent.click(screen.getByText('Valider'));

    expect(setUsername).not.toHaveBeenCalled();
    expect(screen.getByText('Ce pseudo est réservé ou invalide.')).toBeInTheDocument();
  });

  it('exception "tempofit_admin" : passe la vérification réservée, appelle bien checkUsernameAvailable', async () => {
    const checkUsernameAvailable = vi.fn(() => Promise.resolve({ available: true, error: null }));
    renderOnAccountTab({ username: null, checkUsernameAvailable });

    fireEvent.change(screen.getByPlaceholderText('alex_runner'), { target: { value: 'tempofit_admin' } });
    fireEvent.blur(screen.getByPlaceholderText('alex_runner'));

    expect(checkUsernameAvailable).toHaveBeenCalledWith('tempofit_admin');
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

// Feature Sociale (01/08) — 0 test jusqu'ici pour toute cette section
// malgré 4 bascules + 1 lien, sur l'onglet "Mon Compte".
describe('SettingsView — Confidentialité & Profil Public', () => {
  function renderOnAccountTab(overrides = {}) {
    const utils = render(<SettingsView {...baseProps({ user: loggedInUser, username: 'alex_runner', usernameLoading: false, ...overrides })} />);
    fireEvent.click(screen.getByText('Mon Compte'));
    return utils;
  }

  it('section absente sans username résolu (usernameLoading=true)', () => {
    renderOnAccountTab({ usernameLoading: true });
    expect(screen.queryByText('Confidentialité & Profil Public')).not.toBeInTheDocument();
  });

  it('affiche le pseudo dans l\'adresse de profil, le toggle maître "Rendre mon profil public" toujours visible', () => {
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: false } });
    expect(screen.getByText('tempofit.app/?profile=alex_runner')).toBeInTheDocument();
    expect(screen.getByText('Rendre mon profil public')).toBeInTheDocument();
  });

  // NOUVEAU (07/08, retour direct, capture annotée : "pour simplifier le
  // partage il faut que le texte du lien de partage de profil soit
  // sélectionnable à la souris") — voir la docstring de `.selectable-text`
  // dans index.css : sans cette classe, `body { user-select: none }` rend
  // ce texte insélectionnable malgré les apparences (aucune classe
  // Tailwind seule ne peut l'emporter dessus).
  it('le lien de profil porte la classe .selectable-text (sélection à la souris réactivée malgré body { user-select: none })', () => {
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: false } });
    expect(screen.getByText('tempofit.app/?profile=alex_runner')).toHaveClass('selectable-text');
  });

  // NOUVEAU (08/08, retour direct : "je regrette que tu aies pas décelé
  // avant cette meilleure option" — un bouton "Copier le lien" plutôt que
  // du texte à sélectionner manuellement, même pattern déjà en place dans
  // ce même fichier pour l'URL Spotify). `navigator.clipboard.writeText`
  // mocké globalement dans ce fichier (voir en tête) — vérifie que le
  // TEXTE EXACT du lien de profil (pas un fragment, pas un autre lien) est
  // bien celui transmis à l'API presse-papier.
  it('le clic sur "Copier le lien de profil" copie le bon lien dans le presse-papier, puis affiche une coche temporaire', async () => {
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: false } });
    fireEvent.click(screen.getByTitle('Copier le lien de profil'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('tempofit.app/?profile=alex_runner');
    // Vérifie la classe du BOUTON lui-même (`text-green-500`, posée
    // explicitement dans SettingsView.jsx) plutôt que le nom de classe
    // interne de l'icône Check (lucide-react) — plus robuste, ne dépend
    // que de code qu'on contrôle directement ici.
    await waitFor(() => expect(screen.getByTitle('Copier le lien de profil')).toHaveClass('text-green-500'));
  });

  it('isProfilePublic=false : les 3 autres bascules et le lien d\'aperçu sont ABSENTS', () => {
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: false } });
    expect(screen.queryByText('Afficher mes statistiques sportives')).not.toBeInTheDocument();
    expect(screen.queryByText(/statistiques du Mode Intime/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rendre mes nouvelles playlists publiques par défaut')).not.toBeInTheDocument();
    expect(screen.queryByText('Voir l\'aperçu de mon profil public')).not.toBeInTheDocument();
  });

  it('isProfilePublic=true, mode Sport : stats sportives + playlists par défaut visibles, stats Intime ABSENTES', () => {
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: true }, isNaughtyMode: false });
    expect(screen.getByText('Afficher mes statistiques sportives')).toBeInTheDocument();
    expect(screen.getByText('Rendre mes nouvelles playlists publiques par défaut')).toBeInTheDocument();
    expect(screen.queryByText(/statistiques du Mode Intime/)).not.toBeInTheDocument();
  });

  it('isProfilePublic=true ET Mode Intime actif : les 4 bascules sont TOUTES visibles', () => {
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: true }, isNaughtyMode: true });
    expect(screen.getByText('Rendre mon profil public')).toBeInTheDocument();
    expect(screen.getByText('Afficher mes statistiques sportives')).toBeInTheDocument();
    expect(screen.getByText(/statistiques du Mode Intime/)).toBeInTheDocument();
    expect(screen.getByText('Rendre mes nouvelles playlists publiques par défaut')).toBeInTheDocument();
  });

  it('le clic sur une bascule appelle updatePrivacySettings avec le champ inversé', () => {
    const updatePrivacySettings = vi.fn(() => Promise.resolve({ error: null }));
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: false }, updatePrivacySettings });

    fireEvent.click(screen.getByText('Rendre mon profil public').closest('div').parentElement.querySelector('button'));

    expect(updatePrivacySettings).toHaveBeenCalledWith({ is_profile_public: true });
  });

  it('le clic sur le toggle playlists par défaut appelle updatePrivacySettings({ default_playlist_public: true })', () => {
    const updatePrivacySettings = vi.fn(() => Promise.resolve({ error: null }));
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: true, defaultPlaylistPublic: false }, updatePrivacySettings });

    fireEvent.click(screen.getByText('Rendre mes nouvelles playlists publiques par défaut').closest('div').parentElement.querySelector('button'));

    expect(updatePrivacySettings).toHaveBeenCalledWith({ default_playlist_public: true });
  });

  it('en cas d\'erreur, affiche le message renvoyé par updatePrivacySettings', async () => {
    const updatePrivacySettings = vi.fn(() => Promise.resolve({ error: 'Échec réseau, réessaie.' }));
    renderOnAccountTab({ profilePrivacy: { isProfilePublic: false }, updatePrivacySettings });

    fireEvent.click(screen.getByText('Rendre mon profil public').closest('div').parentElement.querySelector('button'));

    expect(await screen.findByText('Échec réseau, réessaie.')).toBeInTheDocument();
  });

  describe('lien "Voir l\'aperçu de mon profil public"', () => {
    it('absent si isProfilePublic=false, même avec onViewOwnProfile fourni (éviterait un lien mort — get_public_profile_summary refuse même le propriétaire tant que le profil n\'est pas public)', () => {
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: false }, onViewOwnProfile: vi.fn() });
      expect(screen.queryByText('Voir l\'aperçu de mon profil public')).not.toBeInTheDocument();
    });

    it('absent si onViewOwnProfile n\'est pas fourni, même avec isProfilePublic=true', () => {
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: true }, onViewOwnProfile: undefined });
      expect(screen.queryByText('Voir l\'aperçu de mon profil public')).not.toBeInTheDocument();
    });

    it('visible et cliquable quand isProfilePublic=true ET onViewOwnProfile fourni', () => {
      const onViewOwnProfile = vi.fn();
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: true }, onViewOwnProfile });

      fireEvent.click(screen.getByText('Voir l\'aperçu de mon profil public'));

      expect(onViewOwnProfile).toHaveBeenCalled();
    });
  });

  // Chantier "Pulses/Leaderboard", 1re UI branchée sur
  // get_or_create_intimate_persona() (fondations SQL posées le 02/08,
  // voir README + supabase-schema.sql). PAS gaté sur isProfilePublic
  // (contrairement aux 4 bascules ci-dessus) — voir la docstring dans
  // SettingsView.jsx pour le raisonnement.
  describe('Ma persona intime', () => {
    it('absente en mode Sport (isNaughtyMode=false), quel que soit isProfilePublic', () => {
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: true }, isNaughtyMode: false });
      expect(screen.queryByText('Ma persona intime')).not.toBeInTheDocument();
    });

    it('visible en Mode Intime MÊME si isProfilePublic=false (indépendant du profil public)', () => {
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: false }, isNaughtyMode: true });
      expect(screen.getByText('Ma persona intime')).toBeInTheDocument();
      expect(screen.getByText('Découvrir mon pseudonyme')).toBeInTheDocument();
    });

    it('le clic appelle supabase.rpc(\'get_or_create_intimate_persona\') et affiche le pseudonyme renvoyé', async () => {
      mockRpc.mockResolvedValue({ data: { intimate_id: 'abc-123', pseudonym: 'Marée Mystère' }, error: null });
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: false }, isNaughtyMode: true });

      fireEvent.click(screen.getByText('Découvrir mon pseudonyme'));

      expect(mockRpc).toHaveBeenCalledWith('get_or_create_intimate_persona');
      expect(await screen.findByText('Tu apparaîtrais sous : Marée Mystère')).toBeInTheDocument();
      // Le bouton disparaît une fois la persona affichée — plus besoin de
      // recliquer pour la voir tant que le composant reste monté.
      expect(screen.queryByText('Découvrir mon pseudonyme')).not.toBeInTheDocument();
    });

    it('affiche un message d\'erreur si la RPC renvoie une erreur, sans planter', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: false }, isNaughtyMode: true });

      fireEvent.click(screen.getByText('Découvrir mon pseudonyme'));

      expect(await screen.findByText('Une erreur est survenue, réessaie dans un instant.')).toBeInTheDocument();
      // Le bouton reste disponible pour réessayer.
      expect(screen.getByText('Découvrir mon pseudonyme')).toBeInTheDocument();
    });

    it('affiche un message d\'erreur si la RPC lève une exception (panne réseau)', async () => {
      mockRpc.mockRejectedValue(new Error('network down'));
      renderOnAccountTab({ profilePrivacy: { isProfilePublic: false }, isNaughtyMode: true });

      fireEvent.click(screen.getByText('Découvrir mon pseudonyme'));

      expect(await screen.findByText('Une erreur est survenue, réessaie dans un instant.')).toBeInTheDocument();
    });
  });
});
