// @vitest-environment jsdom
//
// Test dédié à AuthContext.jsx — la VRAIE logique d'inscription/connexion/
// suppression de compte/export RGPD, jamais testée directement jusqu'ici :
// AuthModal.test.jsx et SettingsView.test.jsx reçoivent toujours ces
// fonctions déjà mockées en props, donc ce qui se passe RÉELLEMENT à
// l'intérieur (appels Supabase, gestion d'erreurs, synchronisation du
// pseudonyme, cascade de suppression) n'avait aucune couverture. `supabase`
// (supabaseClient.js) est mocké en intégralité — pas de vrai réseau.
//
// Testé via `renderHook` + un wrapper `<AuthProvider>` (contrairement à
// useShare.test.js, qui n'avait pas besoin de Provider réel puisque
// ModalContext était directement mocké — ici, c'est justement CE Provider
// qu'on veut tester, donc il doit tourner pour de vrai).

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// `vi.mock()` est hissé (hoisted) tout en haut du fichier par Vitest, AVANT
// toute autre instruction — y compris de simples `const mockX = ...` placés
// plus haut dans le CODE SOURCE. Si la factory de vi.mock() référence
// directement une de ces constantes, elle n'est pas encore initialisée à ce
// stade (zone morte temporelle) → `ReferenceError: Cannot access 'mockAuth'
// before initialization`, qui fait planter le CHARGEMENT ENTIER du fichier
// (0 test collecté, pas juste un test qui échoue — piégé une 1re fois au
// déploiement). `vi.hoisted()` existe précisément pour ça : son contenu est
// lui aussi hissé, au même niveau que vi.mock(), donc disponible à temps.
const { mockAuth, mockRpc, mockFunctionsInvoke, mockFrom } = vi.hoisted(() => ({
  mockAuth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(() => Promise.resolve()),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  mockRpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  mockFunctionsInvoke: vi.fn(),
  mockFrom: vi.fn(),
}));

// `isSupabaseConfigured` est une constante figée à l'import (pas une
// fonction) — la tester à `false` demanderait de réimporter le module
// entier avec `vi.resetModules()` + un mock différent, une manip fragile
// que je préfère ne pas risquer sans pouvoir l'exécuter moi-même pour la
// vérifier (pas de node_modules ici). Ce fichier couvre donc uniquement le
// chemin `isSupabaseConfigured: true` (le cas réel en production sur
// Vercel) — le comportement "non configuré" reste correctement décrit par
// le code lui-même (`if (!isSupabaseConfigured) return { error: ... }` au
// début de chaque fonction) mais n'a pas de test dédié ici.
vi.mock('../src/supabaseClient.js', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: mockAuth, from: mockFrom, rpc: mockRpc, functions: { invoke: mockFunctionsInvoke } },
}));

import { AuthProvider, useAuthContext } from '../src/contexts/AuthContext.jsx';

// Constructeur de "query builder" chaînable minimal, assez pour couvrir
// tous les enchaînements réellement utilisés dans AuthContext.jsx
// (.select().eq().maybeSingle(), .insert(), .select().eq()).
function makeBuilder({ maybeSingleResult, insertResult, selectEqResult } = {}) {
  const b = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => (selectEqResult !== undefined ? Promise.resolve(selectEqResult) : b));
  b.maybeSingle = vi.fn(() => Promise.resolve(maybeSingleResult ?? { data: null, error: null }));
  b.insert = vi.fn(() => Promise.resolve(insertResult ?? { data: null, error: null }));
  return b;
}

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

function renderAuth() {
  return renderHook(() => useAuthContext(), { wrapper });
}

beforeEach(() => {
  // Repose un builder neutre et COMPLET avant chaque test — sans ça, un
  // `mockReturnValue` posé par un test précédent (ex: exportUserData, dont
  // le builder a `.eq()` qui renvoie directement une Promise plutôt que le
  // builder chaînable) reste actif pour tous les tests suivants qui ne le
  // reconfigurent pas eux-mêmes (`vi.clearAllMocks()` efface les APPELS
  // enregistrés, jamais les valeurs de retour déjà posées). Concrètement :
  // n'importe quel test qui pose un `user` déclenche l'effet de synchro du
  // pseudonyme (`.select().eq().maybeSingle()`) en arrière-plan — sans ce
  // reset, il tombait parfois sur un builder incomplet laissé par un AUTRE
  // test et plantait silencieusement après coup (7 "Unhandled Rejection"
  // au 1er déploiement réel de ce fichier, invisibles tant qu'on ne
  // regarde que le statut ✓/× de chaque test).
  mockFrom.mockReturnValue(makeBuilder());
});

afterEach(() => {
  vi.clearAllMocks();
  mockAuth.getSession.mockResolvedValue({ data: { session: null } });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

describe('AuthContext — checkUsernameAvailable', () => {
  it('disponible (aucune ligne trouvée)', async () => {
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: null, error: null } }));
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.checkUsernameAvailable('alex_runner'); });
    expect(outcome).toEqual({ available: true, error: null });
  });

  it('déjà pris (une ligne trouvée)', async () => {
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: { user_id: 'u2' }, error: null } }));
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.checkUsernameAvailable('alex_runner'); });
    expect(outcome).toEqual({ available: false, error: null });
  });

  it('erreur base de données : available=false avec le message', async () => {
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: null, error: { message: 'DB down' } } }));
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.checkUsernameAvailable('alex_runner'); });
    expect(outcome).toEqual({ available: false, error: 'DB down' });
  });
});

describe('AuthContext — signUp', () => {
  it('pseudonyme au format invalide : erreur, aucun appel réseau', async () => {
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.signUp('a@b.com', 'pw123456', 'ab'); });
    expect(outcome.error).toContain('Pseudonyme invalide');
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it('pseudonyme déjà pris : erreur, signUp Supabase jamais appelé', async () => {
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: { user_id: 'u2' }, error: null } }));
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.signUp('a@b.com', 'pw123456', 'alex_runner'); });
    expect(outcome.error).toBe('Ce pseudonyme est déjà pris.');
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it('Supabase auth.signUp renvoie une erreur : la propage telle quelle', async () => {
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: null, error: null } }));
    mockAuth.signUp.mockResolvedValue({ data: null, error: { message: 'Email déjà utilisé' } });
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.signUp('a@b.com', 'pw123456', 'alex_runner'); });
    expect(outcome.error).toBe('Email déjà utilisé');
  });

  it('succès AVEC session immédiate : insère le profil tout de suite', async () => {
    const builder = makeBuilder({ maybeSingleResult: { data: null, error: null }, insertResult: { data: {}, error: null } });
    mockFrom.mockReturnValue(builder);
    mockAuth.signUp.mockResolvedValue({ data: { session: { id: 's1' }, user: { id: 'u1' } }, error: null });
    const { result } = renderAuth();

    let outcome;
    await act(async () => { outcome = await result.current.signUp('a@b.com', 'pw123456', 'alex_runner'); });

    expect(outcome.error).toBeNull();
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', username: 'alex_runner' });
  });

  it('succès SANS session immédiate (confirmation e-mail requise) : n\'insère PAS le profil ici', async () => {
    const builder = makeBuilder({ maybeSingleResult: { data: null, error: null } });
    mockFrom.mockReturnValue(builder);
    mockAuth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });
    const { result } = renderAuth();

    await act(async () => { await result.current.signUp('a@b.com', 'pw123456', 'alex_runner'); });

    expect(builder.insert).not.toHaveBeenCalled();
  });
});

describe('AuthContext — setUsername', () => {
  it('non connecté : erreur dédiée', async () => {
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.setUsername('alex_runner'); });
    expect(outcome.error).toBe('Non connecté.');
  });

  it('format invalide : erreur, aucun appel réseau', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: null, error: null } }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    let outcome;
    await act(async () => { outcome = await result.current.setUsername('ab'); });
    expect(outcome.error).toContain('3 à 20 caractères');
  });

  it('collision au moment de l\'insertion (code 23505) : message dédié', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFrom.mockReturnValue(
      makeBuilder({ maybeSingleResult: { data: null, error: null }, insertResult: { data: null, error: { code: '23505', message: 'duplicate key' } } })
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    let outcome;
    await act(async () => { outcome = await result.current.setUsername('alex_runner'); });
    expect(outcome.error).toBe("Ce pseudonyme vient d'être pris par quelqu'un d'autre.");
  });
});

describe('AuthContext — signIn / signOut / resetPassword / updateEmail / updatePassword', () => {
  it('signIn : succès → error null ; échec → message Supabase propagé', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({ error: null });
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.signIn('a@b.com', 'pw'); });
    expect(outcome).toEqual({ error: null });

    mockAuth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Identifiants invalides' } });
    await act(async () => { outcome = await result.current.signIn('a@b.com', 'wrong'); });
    expect(outcome).toEqual({ error: 'Identifiants invalides' });
  });

  it('signOut appelle bien supabase.auth.signOut', async () => {
    const { result } = renderAuth();
    await act(async () => { await result.current.signOut(); });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('resetPassword propage le message d\'erreur éventuel', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Adresse introuvable' } });
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.resetPassword('a@b.com'); });
    expect(outcome).toEqual({ error: 'Adresse introuvable' });
  });

  it('updateEmail appelle updateUser({ email })', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null });
    const { result } = renderAuth();
    await act(async () => { await result.current.updateEmail('new@b.com'); });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ email: 'new@b.com' });
  });

  it('updatePassword appelle updateUser({ password })', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null });
    const { result } = renderAuth();
    await act(async () => { await result.current.updatePassword('newpass123'); });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
  });
});

describe('AuthContext — exportUserData (RGPD)', () => {
  it('non connecté : erreur dédiée', async () => {
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.exportUserData(); });
    expect(outcome).toEqual({ data: null, error: 'Non connecté.' });
  });

  it('connecté : transforme les lignes [{key,value}] en objet {clé: valeur}', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    // Ce test déclenche AUSSI l'effet de synchro du pseudonyme (dès qu'un
    // `user` existe) — qui interroge 'profiles' via .select().eq().maybeSingle(),
    // un chaînage incompatible avec le builder "eq() résout directement"
    // dont exportUserData a besoin pour 'user_data'. D'où la distinction
    // explicite par table plutôt qu'un mockReturnValue uniforme (qui avait
    // cassé l'effet de synchro en arrière-plan au 1er déploiement réel de
    // ce fichier — 7 "Unhandled Rejection" invisibles dans le résultat
    // ✓/× de chaque test).
    mockFrom.mockImplementation((table) =>
      table === 'user_data'
        ? makeBuilder({ selectEqResult: { data: [{ key: 'favorites', value: { tracks: [] } }, { key: 'theme', value: 'dark' }], error: null } })
        : makeBuilder()
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    let outcome;
    await act(async () => { outcome = await result.current.exportUserData(); });
    expect(outcome).toEqual({ data: { favorites: { tracks: [] }, theme: 'dark' }, error: null });
  });
});

describe('AuthContext — deleteAccount', () => {
  it('non connecté : erreur dédiée, functions.invoke jamais appelé', async () => {
    const { result } = renderAuth();
    let outcome;
    await act(async () => { outcome = await result.current.deleteAccount(); });
    expect(outcome.error).toBe('Non connecté.');
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('succès : appelle signOut, renvoie error:null', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    let outcome;
    await act(async () => { outcome = await result.current.deleteAccount(); });

    expect(outcome).toEqual({ error: null });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('la fonction renvoie { data: { error } } (échec métier, pas HTTP) : propage ce message', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFunctionsInvoke.mockResolvedValue({ data: { error: 'Suppression refusée côté serveur.' }, error: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    let outcome;
    await act(async () => { outcome = await result.current.deleteAccount(); });
    expect(outcome.error).toBe('Suppression refusée côté serveur.');
  });

  it('erreur HTTP avec un vrai message JSON récupérable (error.context.json()) : relit ce message', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: () => Promise.resolve({ error: 'Compte introuvable côté serveur.' }) } },
    });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    let outcome;
    await act(async () => { outcome = await result.current.deleteAccount(); });
    expect(outcome.error).toBe('Compte introuvable côté serveur.');
  });

  it('erreur HTTP dont le corps n\'est pas lisible (context.json() échoue) : repli sur le message générique', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: () => Promise.reject(new Error('not json')) } },
    });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    let outcome;
    await act(async () => { outcome = await result.current.deleteAccount(); });
    expect(outcome.error).toBe('Edge Function returned a non-2xx status code');
  });
});

describe('AuthContext — session (montage, changements, nettoyage)', () => {
  it('récupère la session existante au montage', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('aucune session : user reste null, authLoading passe à false', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('onAuthStateChange met à jour user en direct (ex: déconnexion externe)', async () => {
    let capturedCallback;
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    act(() => { capturedCallback('SIGNED_OUT', null); });
    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it('se désabonne (unsubscribe) au démontage', async () => {
    const unsubscribe = vi.fn();
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
    const { unmount } = renderAuth();
    await waitFor(() => expect(mockAuth.onAuthStateChange).toHaveBeenCalled());
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('AuthContext — synchronisation du pseudonyme (username)', () => {
  it('profil déjà existant côté serveur : le récupère tel quel', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: { username: 'deja_la' }, error: null } }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.username).toBe('deja_la'));
  });

  it('aucun profil, mais un pseudonyme en attente (user_metadata) : le synchronise', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', user_metadata: { username: 'en_attente' } } } } });
    const builder = makeBuilder({ maybeSingleResult: { data: null, error: null }, insertResult: { data: {}, error: null } });
    mockFrom.mockReturnValue(builder);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.username).toBe('en_attente'));
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', username: 'en_attente' });
  });

  it('pseudonyme en attente mais déjà pris entre-temps (insertion échoue) : reste null', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', user_metadata: { username: 'en_attente' } } } } });
    mockFrom.mockReturnValue(
      makeBuilder({ maybeSingleResult: { data: null, error: null }, insertResult: { data: null, error: { code: '23505' } } })
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.usernameLoading).toBe(false));
    expect(result.current.username).toBeNull();
  });

  it('aucun user : username reste null sans appel réseau', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.username).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('AuthContext — userCount', () => {
  it('récupéré uniquement une fois connecté', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockFrom.mockReturnValue(makeBuilder({ maybeSingleResult: { data: null, error: null } }));
    mockRpc.mockResolvedValue({ data: 42, error: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.userCount).toBe(42));
  });

  it('sans utilisateur connecté : reste null, aucun appel RPC', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.userCount).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('AuthContext — utilisation hors <AuthProvider> (repli FALLBACK)', () => {
  it('renvoie des valeurs de repli sûres plutôt que de planter', async () => {
    const { result } = renderHook(() => useAuthContext());
    expect(result.current.user).toBeNull();
    expect(result.current.isSupabaseConfigured).toBe(false);
    const outcome = await result.current.signIn('a@b.com', 'pw');
    expect(outcome.error).toBe('AuthProvider manquant.');
  });
});

describe('AuthContext — isSupabaseConfigured=false (no-op silencieux, sans dépendance Supabase)', () => {
  // Placé en DERNIER dans ce fichier, volontairement : `vi.resetModules()`
  // vide le registre de modules de Vitest pour les FUTURS `import()`
  // dynamiques, mais n'invalide pas les références déjà capturées plus
  // haut (`AuthProvider`/`useAuthContext` importés en haut de fichier,
  // utilisés par tous les describe précédents) — aucun risque de perturber
  // les tests déjà écrits, mais on évite quand même tout ordre ambigu en
  // le mettant à la fin.
  it('toutes les fonctions renvoient une erreur dédiée, sans jamais appeler Supabase', async () => {
    vi.resetModules();
    vi.doMock('../src/supabaseClient.js', () => ({
      isSupabaseConfigured: false,
      supabase: { auth: mockAuth, from: mockFrom, rpc: mockRpc, functions: { invoke: mockFunctionsInvoke } },
    }));

    const { AuthProvider: UnconfiguredProvider, useAuthContext: useUnconfiguredAuthContext } =
      await import('../src/contexts/AuthContext.jsx');
    const localWrapper = ({ children }) => <UnconfiguredProvider>{children}</UnconfiguredProvider>;
    const { result } = renderHook(() => useUnconfiguredAuthContext(), { wrapper: localWrapper });

    // authLoading initialisé via useState(isSupabaseConfigured) : doit
    // être `false` D'EMBLÉE (pas besoin d'attendre getSession(), qui ne
    // doit même jamais être appelé — voir plus bas).
    expect(result.current.authLoading).toBe(false);

    let outcome;
    await act(async () => { outcome = await result.current.signUp('a@b.com', 'pw123456', 'alex_runner'); });
    expect(outcome.error).toBe('Les comptes ne sont pas encore configurés côté serveur.');

    await act(async () => { outcome = await result.current.signIn('a@b.com', 'pw123456'); });
    expect(outcome.error).toBe('Les comptes ne sont pas encore configurés côté serveur.');

    await act(async () => { outcome = await result.current.resetPassword('a@b.com'); });
    expect(outcome.error).toBe('Les comptes ne sont pas encore configurés côté serveur.');

    await act(async () => { outcome = await result.current.updateEmail('a@b.com'); });
    expect(outcome.error).toBe('Les comptes ne sont pas encore configurés côté serveur.');

    await act(async () => { outcome = await result.current.updatePassword('newpass123'); });
    expect(outcome.error).toBe('Les comptes ne sont pas encore configurés côté serveur.');

    await act(async () => { outcome = await result.current.checkUsernameAvailable('alex_runner'); });
    expect(outcome).toEqual({ available: false, error: 'Les comptes ne sont pas encore configurés côté serveur.' });

    await act(async () => { outcome = await result.current.exportUserData(); });
    // exportUserData()/deleteAccount() combinent isSupabaseConfigured ET
    // user dans UNE SEULE condition (`if (!isSupabaseConfigured || !user)`)
    // — le message reste "Non connecté." dans les 2 cas, pas de message
    // dédié "pas configuré" spécifique à ces 2 fonctions précises.
    expect(outcome).toEqual({ data: null, error: 'Non connecté.' });

    await act(async () => { outcome = await result.current.deleteAccount(); });
    expect(outcome.error).toBe('Non connecté.');

    // Aucune de ces fonctions n'a dû toucher Supabase, ni au montage ni
    // via les appels ci-dessus.
    expect(mockAuth.getSession).not.toHaveBeenCalled();
    expect(mockAuth.onAuthStateChange).not.toHaveBeenCalled();
    expect(mockAuth.signUp).not.toHaveBeenCalled();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('signOut reste un no-op silencieux (pas d\'erreur, mais n\'appelle pas Supabase non plus)', async () => {
    vi.resetModules();
    vi.doMock('../src/supabaseClient.js', () => ({
      isSupabaseConfigured: false,
      supabase: { auth: mockAuth, from: mockFrom, rpc: mockRpc, functions: { invoke: mockFunctionsInvoke } },
    }));
    const { AuthProvider: UnconfiguredProvider, useAuthContext: useUnconfiguredAuthContext } =
      await import('../src/contexts/AuthContext.jsx');
    const localWrapper = ({ children }) => <UnconfiguredProvider>{children}</UnconfiguredProvider>;
    const { result } = renderHook(() => useUnconfiguredAuthContext(), { wrapper: localWrapper });

    await act(async () => { await result.current.signOut(); });

    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });
});
