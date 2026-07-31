// @vitest-environment jsdom
//
// Palier 4 (31/07, 1er) — AuthModal. Pas de Context à mocker : tout passe
// par des props (`signUp`/`signIn`/`resetPassword`/`checkUsernameAvailable`/
// `showToast`), comme documenté dans le fichier ("dumb" comme les autres
// vues/modales). Couverture volontairement complète (3 modes, validations,
// partage d'état showPassword, cas d'erreur) vu la criticité d'un
// formulaire d'authentification.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import AuthModal from '../src/components/modals/AuthModal.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight',
  textColorClass: 'mock-text-color', inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
  textMuted: 'mock-muted', bgAccentClass: 'mock-accent-bg',
};

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isAuthModalOpen: true,
    onClose: vi.fn(),
    signUp: vi.fn(() => Promise.resolve({ error: null })),
    signIn: vi.fn(() => Promise.resolve({ error: null })),
    resetPassword: vi.fn(() => Promise.resolve({ error: null })),
    checkUsernameAvailable: vi.fn(() => Promise.resolve({ available: true, error: null })),
    showToast: vi.fn(),
    ...overrides,
  };
}

describe('AuthModal — affichage de base', () => {
  it('ne rend rien quand isAuthModalOpen=false', () => {
    const { container } = render(<AuthModal {...baseProps({ isAuthModalOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mode par défaut "signin" : titre "Se connecter", e-mail/mot de passe visibles, pas de pseudonyme ni confirmation', () => {
    render(<AuthModal {...baseProps()} />);
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ton@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/pseudonyme/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Confirme ton mot de passe')).not.toBeInTheDocument();
    expect(screen.getByText('Mot de passe oublié ?')).toBeInTheDocument();
  });

  it('le clic sur le fond (backdrop) ferme la modale', () => {
    const onClose = vi.fn();
    const { container } = render(<AuthModal {...baseProps({ onClose })} />);
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalled();
  });

  it('le clic à l\'intérieur de la carte ne ferme pas la modale (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<AuthModal {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByPlaceholderText('ton@email.com'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('le bouton X ferme la modale', () => {
    const onClose = vi.fn();
    const { container } = render(<AuthModal {...baseProps({ onClose })} />);
    fireEvent.click(container.querySelector('svg.lucide-x').closest('button'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AuthModal — bascule entre les modes', () => {
  it('"Pas encore de compte ? S\'inscrire" passe en mode signup (pseudonyme + confirmation apparaissent)', () => {
    render(<AuthModal {...baseProps()} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));
    expect(screen.getByText('Créer un compte')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pseudonyme/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirme ton mot de passe')).toBeInTheDocument();
    expect(screen.getByText('Déjà un compte ? Se connecter')).toBeInTheDocument();
  });

  it('re-cliquer "Déjà un compte ? Se connecter" repasse en mode signin', () => {
    render(<AuthModal {...baseProps()} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));
    fireEvent.click(screen.getByText('Déjà un compte ? Se connecter'));
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/pseudonyme/)).not.toBeInTheDocument();
  });

  it('"Mot de passe oublié ?" passe en mode forgot et conserve l\'e-mail déjà saisi', () => {
    render(<AuthModal {...baseProps()} />);
    fireEvent.change(screen.getByPlaceholderText('ton@email.com'), { target: { value: 'alex@example.com' } });
    fireEvent.click(screen.getByText('Mot de passe oublié ?'));

    expect(screen.getByText('Réinitialiser le mot de passe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ton@email.com')).toHaveValue('alex@example.com');
  });

  it('en mode forgot, "Retour à la connexion" repasse en signin', () => {
    render(<AuthModal {...baseProps()} />);
    fireEvent.click(screen.getByText('Mot de passe oublié ?'));
    fireEvent.click(screen.getByText(/Retour à la connexion/));
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
  });

  it('changer de mode réinitialise le mot de passe/la confirmation (resetFields)', () => {
    render(<AuthModal {...baseProps()} />);
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));
    expect(screen.getByPlaceholderText('Mot de passe')).toHaveValue('');
  });
});

describe('AuthModal — afficher/masquer le mot de passe', () => {
  it('le bouton œil bascule le type du champ, partagé entre mot de passe et confirmation', () => {
    render(<AuthModal {...baseProps()} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));

    const passwordInput = screen.getByPlaceholderText('Mot de passe');
    const confirmInput = screen.getByPlaceholderText('Confirme ton mot de passe');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getAllByTitle('Afficher')[0]);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmInput).toHaveAttribute('type', 'text'); // état partagé
  });
});

describe('AuthModal — validation du pseudonyme (signup)', () => {
  function goToSignup() {
    render(<AuthModal {...baseProps()} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));
  }

  it('pseudonyme valide et disponible : appelle checkUsernameAvailable au blur, affiche "Disponible !"', async () => {
    const checkUsernameAvailable = vi.fn(() => Promise.resolve({ available: true, error: null }));
    render(<AuthModal {...baseProps({ checkUsernameAvailable })} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));

    const usernameInput = screen.getByPlaceholderText(/pseudonyme/);
    fireEvent.change(usernameInput, { target: { value: 'alex_runner' } });
    fireEvent.blur(usernameInput);

    expect(checkUsernameAvailable).toHaveBeenCalledWith('alex_runner');
    await waitFor(() => expect(screen.getByText('Disponible !')).toBeInTheDocument());
  });

  it('pseudonyme au format invalide : affiche le message dédié SANS appeler checkUsernameAvailable', () => {
    const checkUsernameAvailable = vi.fn();
    render(<AuthModal {...baseProps({ checkUsernameAvailable })} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));

    const usernameInput = screen.getByPlaceholderText(/pseudonyme/);
    fireEvent.change(usernameInput, { target: { value: 'ab' } }); // trop court
    fireEvent.blur(usernameInput);

    expect(checkUsernameAvailable).not.toHaveBeenCalled();
    expect(screen.getByText('3 à 20 caractères : minuscules, chiffres, underscore.')).toBeInTheDocument();
  });

  it('champ pseudonyme mis en minuscules automatiquement à la saisie', () => {
    render(<AuthModal {...baseProps()} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));

    const usernameInput = screen.getByPlaceholderText(/pseudonyme/);
    fireEvent.change(usernameInput, { target: { value: 'ALEX_Runner' } });

    expect(usernameInput).toHaveValue('alex_runner');
  });

  it('pseudonyme déjà pris : affiche le message correspondant', async () => {
    const checkUsernameAvailable = vi.fn(() => Promise.resolve({ available: false, error: null }));
    render(<AuthModal {...baseProps({ checkUsernameAvailable })} />);
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));

    const usernameInput = screen.getByPlaceholderText(/pseudonyme/);
    fireEvent.change(usernameInput, { target: { value: 'alex_runner' } });
    fireEvent.blur(usernameInput);

    await waitFor(() => expect(screen.getByText('Ce pseudonyme est déjà pris.')).toBeInTheDocument());
  });
});

describe('AuthModal — soumission signin', () => {
  it('e-mail ou mot de passe manquant : erreur affichée, signIn jamais appelé', () => {
    const signIn = vi.fn();
    render(<AuthModal {...baseProps({ signIn })} />);
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByText('Renseigne un e-mail et un mot de passe.')).toBeInTheDocument();
  });

  it('e-mail/mot de passe valides : appelle signIn(email trimé, password), puis showToast et close en cas de succès', async () => {
    const signIn = vi.fn(() => Promise.resolve({ error: null }));
    const showToast = vi.fn();
    const onClose = vi.fn();
    render(<AuthModal {...baseProps({ signIn, showToast, onClose })} />);

    fireEvent.change(screen.getByPlaceholderText('ton@email.com'), { target: { value: '  alex@example.com  ' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('alex@example.com', 'secret123'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Connecté')));
    expect(onClose).toHaveBeenCalled();
  });

  it('signIn renvoie une erreur : affiche le message, ne ferme pas la modale', async () => {
    const signIn = vi.fn(() => Promise.resolve({ error: 'Identifiants invalides.' }));
    const onClose = vi.fn();
    render(<AuthModal {...baseProps({ signIn, onClose })} />);

    fireEvent.change(screen.getByPlaceholderText('ton@email.com'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    await waitFor(() => expect(screen.getByText('Identifiants invalides.')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('le bouton de soumission est désactivé pendant l\'envoi', async () => {
    let resolveSignIn;
    const signIn = vi.fn(() => new Promise(res => { resolveSignIn = res; }));
    render(<AuthModal {...baseProps({ signIn })} />);

    fireEvent.change(screen.getByPlaceholderText('ton@email.com'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeDisabled();
    resolveSignIn({ error: null });
    await waitFor(() => expect(screen.getByRole('button', { name: /Se connecter/ })).not.toBeDisabled());
  });
});

describe('AuthModal — soumission signup', () => {
  function fillSignupBase({ email = 'alex@example.com', password = 'secret123', confirm = 'secret123', username = 'alex_runner' } = {}) {
    fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));
    if (username !== undefined) fireEvent.change(screen.getByPlaceholderText(/pseudonyme/), { target: { value: username } });
    fireEvent.change(screen.getByPlaceholderText('ton@email.com'), { target: { value: email } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: password } });
    fireEvent.change(screen.getByPlaceholderText('Confirme ton mot de passe'), { target: { value: confirm } });
  }

  it('mots de passe différents : erreur, signUp jamais appelé', () => {
    const signUp = vi.fn();
    render(<AuthModal {...baseProps({ signUp })} />);
    fillSignupBase({ confirm: 'autreChose' });
    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Les 2 mots de passe ne correspondent pas.')).toBeInTheDocument();
  });

  it('pseudonyme vide : erreur dédiée, signUp jamais appelé', () => {
    const signUp = vi.fn();
    render(<AuthModal {...baseProps({ signUp })} />);
    fillSignupBase({ username: '' });
    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Choisis un pseudonyme.')).toBeInTheDocument();
  });

  it('pseudonyme au format invalide, jamais quitté au blur : bloqué quand même à la soumission', () => {
    const signUp = vi.fn();
    render(<AuthModal {...baseProps({ signUp })} />);
    fillSignupBase({ username: 'ab' }); // trop court, pas de blur déclenché
    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText(/Pseudonyme invalide/)).toBeInTheDocument();
  });

  it('pseudonyme marqué "taken" (via blur) : bloque la soumission même si on retape ensuite sans re-quitter le champ', async () => {
    const checkUsernameAvailable = vi.fn(() => Promise.resolve({ available: false, error: null }));
    const signUp = vi.fn();
    render(<AuthModal {...baseProps({ signUp, checkUsernameAvailable })} />);
    fillSignupBase();
    fireEvent.blur(screen.getByPlaceholderText(/pseudonyme/));
    await waitFor(() => expect(screen.getByText('Ce pseudonyme est déjà pris.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Ce pseudonyme est déjà pris.')).toBeInTheDocument();
  });

  it('tout est valide : appelle signUp(email trimé, password, username), showToast et close en cas de succès', async () => {
    const signUp = vi.fn(() => Promise.resolve({ error: null }));
    const showToast = vi.fn();
    const onClose = vi.fn();
    render(<AuthModal {...baseProps({ signUp, showToast, onClose })} />);
    fillSignupBase({ email: '  alex@example.com  ' });

    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith('alex@example.com', 'secret123', 'alex_runner'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Compte créé')));
    expect(onClose).toHaveBeenCalled();
  });

  it('signUp renvoie une erreur : affiche le message, ne ferme pas la modale', async () => {
    const signUp = vi.fn(() => Promise.resolve({ error: 'Cette adresse est déjà utilisée.' }));
    const onClose = vi.fn();
    render(<AuthModal {...baseProps({ signUp, onClose })} />);
    fillSignupBase();

    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    await waitFor(() => expect(screen.getByText('Cette adresse est déjà utilisée.')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AuthModal — mot de passe oublié (forgot)', () => {
  it('e-mail vide : erreur, resetPassword jamais appelé', () => {
    const resetPassword = vi.fn();
    render(<AuthModal {...baseProps({ resetPassword })} />);
    fireEvent.click(screen.getByText('Mot de passe oublié ?'));
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le lien/ }));

    expect(resetPassword).not.toHaveBeenCalled();
    expect(screen.getByText('Renseigne ton e-mail.')).toBeInTheDocument();
  });

  it('e-mail valide : appelle resetPassword, affiche la confirmation, NE ferme PAS la modale', async () => {
    const resetPassword = vi.fn(() => Promise.resolve({ error: null }));
    const onClose = vi.fn();
    render(<AuthModal {...baseProps({ resetPassword, onClose })} />);
    fireEvent.click(screen.getByText('Mot de passe oublié ?'));
    fireEvent.change(screen.getByPlaceholderText('ton@email.com'), { target: { value: 'alex@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le lien/ }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('alex@example.com'));
    await waitFor(() => expect(screen.getByText(/E-mail envoyé/)).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('resetPassword renvoie une erreur : affiche le message, pas de confirmation de succès', async () => {
    const resetPassword = vi.fn(() => Promise.resolve({ error: 'Adresse introuvable.' }));
    render(<AuthModal {...baseProps({ resetPassword })} />);
    fireEvent.click(screen.getByText('Mot de passe oublié ?'));
    fireEvent.change(screen.getByPlaceholderText('ton@email.com'), { target: { value: 'alex@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le lien/ }));

    await waitFor(() => expect(screen.getByText('Adresse introuvable.')).toBeInTheDocument());
    expect(screen.queryByText(/E-mail envoyé/)).not.toBeInTheDocument();
  });
});
