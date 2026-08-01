// @vitest-environment jsdom
//
// Test dédié à SearchUsersModal.jsx — 0 test jusqu'ici. `supabase`
// (supabaseClient.js) mocké — pas de vrai réseau. Fake timers (même
// pattern que GeneratorWizard.test.jsx) pour contrôler précisément le
// debounce de 350ms sans dépendre du vrai temps qui passe.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../src/supabaseClient.js', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: mockRpc },
}));

import SearchUsersModal from '../src/components/modals/SearchUsersModal.jsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border',
  textHighlight: 'mock-highlight', textMuted: 'mock-muted',
  inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
};

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isOpen: true,
    onClose: vi.fn(),
    user: { id: 'visitor-uuid' },
    onViewProfile: vi.fn(),
    ...overrides,
  };
}

// Fait avancer le debounce de 350ms ET laisse le temps à l'appel RPC
// (async, dans le setTimeout) de se résoudre — `advanceTimersByTimeAsync`
// (pas la version synchrone) est nécessaire ici précisément parce que le
// callback du setTimeout est lui-même une fonction async qui `await`
// supabase.rpc(...) avant de poser le state.
async function runDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });
}

describe('SearchUsersModal — affichage de base', () => {
  it('isOpen=false : ne rend rien du tout', () => {
    const { container } = render(<SearchUsersModal {...baseProps({ isOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('user=null : affiche le message "Connecte-toi", pas de champ de recherche, jamais d\'appel RPC', async () => {
    render(<SearchUsersModal {...baseProps({ user: null })} />);
    expect(screen.getByText('Connecte-toi pour rechercher d\'autres profils.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Pseudo/)).not.toBeInTheDocument();

    await runDebounce();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('le clic sur X ou le fond appelle onClose, le clic À L\'INTÉRIEUR de la modale ne le déclenche PAS', () => {
    const onClose = vi.fn();
    const { container } = render(<SearchUsersModal {...baseProps({ onClose })} />);

    fireEvent.click(container.querySelector('svg.lucide-x').closest('button'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Trouver un profil'));
    expect(onClose).toHaveBeenCalledTimes(1); // toujours 1, pas 2 — clic interne stoppé
  });
});

describe('SearchUsersModal — reset à chaque ouverture', () => {
  it('fermer puis rouvrir efface la recherche et les résultats précédents', async () => {
    mockRpc.mockResolvedValue({ data: [{ username: 'alex_runner', avatar_url: null }], error: null });
    const { rerender } = render(<SearchUsersModal {...baseProps({ isOpen: true })} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'alex' } });
    await runDebounce();
    expect(screen.getByText('@alex_runner')).toBeInTheDocument();

    rerender(<SearchUsersModal {...baseProps({ isOpen: false })} />);
    rerender(<SearchUsersModal {...baseProps({ isOpen: true })} />);

    expect(screen.getByPlaceholderText(/Pseudo/).value).toBe('');
    expect(screen.queryByText('@alex_runner')).not.toBeInTheDocument();
  });
});

describe('SearchUsersModal — debounce et recherche', () => {
  it('moins de 2 caractères : jamais d\'appel RPC, message "Encore un caractère..." dès 1 caractère', async () => {
    render(<SearchUsersModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'a' } });
    expect(screen.getByText('Encore un caractère...')).toBeInTheDocument();

    await runDebounce();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('2 caractères ou plus : appelle search_public_profiles APRÈS le délai, pas avant', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    render(<SearchUsersModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'al' } });

    // Avant le délai complet : pas encore d'appel.
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(mockRpc).not.toHaveBeenCalled();

    // Après le délai complet : l'appel a eu lieu.
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(mockRpc).toHaveBeenCalledWith('search_public_profiles', { search_query: 'al' });
  });

  it('la saisie est convertie en minuscules automatiquement', () => {
    render(<SearchUsersModal {...baseProps()} />);
    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'ALEX' } });
    expect(screen.getByPlaceholderText(/Pseudo/).value).toBe('alex');
  });

  it('espaces en trop retirés avant l\'appel RPC (trim)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    render(<SearchUsersModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: '  alex  ' } });
    await runDebounce();

    expect(mockRpc).toHaveBeenCalledWith('search_public_profiles', { search_query: 'alex' });
  });

  it('une nouvelle frappe avant la fin du délai ANNULE la recherche précédente (un seul appel RPC au final)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    render(<SearchUsersModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'al' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'ale' } });
    await runDebounce();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('search_public_profiles', { search_query: 'ale' });
  });
});

describe('SearchUsersModal — résultats', () => {
  it('affiche avatar_url si présent, sinon l\'initiale du pseudo', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { username: 'avec_avatar', avatar_url: 'https://real.jpg' },
        { username: 'sans_avatar', avatar_url: null },
      ],
      error: null,
    });
    render(<SearchUsersModal {...baseProps()} />);
    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'av' } });
    await runDebounce();

    expect(screen.getByText('@avec_avatar')).toBeInTheDocument();
    const img = document.querySelector('img[src="https://real.jpg"]');
    expect(img).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument(); // initiale de "sans_avatar"
  });

  it('le clic sur un résultat appelle onViewProfile(username) PUIS onClose()', async () => {
    const onViewProfile = vi.fn();
    const onClose = vi.fn();
    mockRpc.mockResolvedValue({ data: [{ username: 'alex_runner', avatar_url: null }], error: null });
    render(<SearchUsersModal {...baseProps({ onViewProfile, onClose })} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'al' } });
    await runDebounce();

    fireEvent.click(screen.getByText('@alex_runner'));

    expect(onViewProfile).toHaveBeenCalledWith('alex_runner');
    expect(onClose).toHaveBeenCalled();
  });

  it('aucun résultat : affiche le message dédié avec le terme recherché', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    render(<SearchUsersModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'zzzintrouvable' } });
    await runDebounce();

    expect(screen.getByText(`Aucun profil public trouvé pour "zzzintrouvable".`)).toBeInTheDocument();
  });

  it('erreur RPC : traitée comme "aucun résultat", pas de plantage', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(<SearchUsersModal {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText(/Pseudo/), { target: { value: 'al' } });
    await runDebounce();

    expect(screen.getByText(`Aucun profil public trouvé pour "al".`)).toBeInTheDocument();
  });
});
