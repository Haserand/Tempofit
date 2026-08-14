// @vitest-environment jsdom
//
// Test dédié à usePersistentState.js — 0 test jusqu'ici malgré son rôle
// d'infrastructure : c'est LUI qui gère la persistance localStorage +
// synchro Supabase pour 6+ hooks du projet (useFavorites, useRoutines,
// useAthleticProfile, useUserStats, `theme`/`savedPlaylists` dans App.jsx).
// Son sibling `useSyncedCollection.js` (même rôle, pour des COLLECTIONS
// plutôt qu'une valeur unique) a déjà un fichier de test dédié — celui-ci
// comblait le vrai trou de couverture restant sur cette famille de hooks
// (check-up du 13/08). `useAuthContext`/`supabase` entièrement mockés —
// pas de vrai réseau, pas de vrai compte.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

// Voir AuthContext.test.jsx/useSyncedCollection.test.js pour l'explication
// complète de `vi.hoisted()` (zone morte temporelle sinon, fichier entier
// qui ne charge aucun test).
const { mockUseAuthContext, mockFrom } = vi.hoisted(() => ({
  mockUseAuthContext: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../../src/contexts/AuthContext.jsx', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

vi.mock('../../src/supabaseClient.js', () => ({
  isSupabaseConfigured: true,
  supabase: { from: mockFrom },
}));

import { usePersistentState } from '../../src/hooks/usePersistentState.js';

afterEach(() => {
  cleanup();
  // `resetAllMocks()` plutôt que `clearAllMocks()` (13/08, build réel cassé
  // puis corrigé) — `clearAllMocks()` vide l'historique des appels mais PAS
  // les `mockReturnValueOnce(...)` en attente, jamais consommés. Un test
  // dont le scénario avale silencieusement un appel prévu (voir plus bas,
  // "un setState APRÈS le pull initial...") laissait un `mockReturnValueOnce`
  // orphelin, consommé par erreur au TOUT PROCHAIN appel de `mockFrom()` —
  // dans le test SUIVANT, faussant sa propre valeur de pull et lui faisant
  // prendre la mauvaise branche (d'où le "3 appels au lieu de 2" observé au
  // build). `resetAllMocks()` vide aussi ces files d'attente : plus aucune
  // fuite possible d'un test vers le suivant, quel que soit le scénario.
  vi.resetAllMocks();
  window.localStorage.clear();
});

// Builder chaînable minimal, même pattern que useSyncedCollection.test.js —
// `.maybeSingle()` en plus (utilisé par le pull ici, jamais par
// useSyncedCollection.js, qui lit toujours plusieurs lignes).
function makeBuilder(result = { data: null, error: null }) {
  const b = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.upsert = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => b);
  b.then = (resolve) => resolve(result);
  return b;
}

const guestUser = null;
const loggedInUser = { id: 'user-uuid-1' };

function setAuth(user, authLoading = false) {
  mockUseAuthContext.mockReturnValue({ user, authLoading });
}

describe('usePersistentState — initialisation', () => {
  beforeEach(() => setAuth(guestUser));

  it('utilise initialValue (fonction paresseuse) quand localStorage est vide', () => {
    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));
    expect(result.current[0]).toBe('light');
  });

  it('utilise initialValue (valeur directe, pas une fonction) quand localStorage est vide', () => {
    const { result } = renderHook(() => usePersistentState('theme', 'dark'));
    expect(result.current[0]).toBe('dark');
  });

  it('lit la valeur déjà présente dans localStorage plutôt qu\'initialValue', () => {
    window.localStorage.setItem('tempofit:theme', JSON.stringify('dark'));
    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));
    expect(result.current[0]).toBe('dark');
  });

  it('JSON corrompu dans localStorage : replie silencieusement sur initialValue, ne plante pas', () => {
    window.localStorage.setItem('tempofit:theme', '{not valid json');
    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));
    expect(result.current[0]).toBe('light');
  });
});

describe('usePersistentState — cache local (actif que connecté ou non)', () => {
  beforeEach(() => setAuth(guestUser));

  it('setState met à jour le state ET localStorage', () => {
    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));

    act(() => { result.current[1]('dark'); });

    expect(result.current[0]).toBe('dark');
    expect(JSON.parse(window.localStorage.getItem('tempofit:theme'))).toBe('dark');
  });

  it('accepte un updater fonctionnel (comme un setState classique)', () => {
    const { result } = renderHook(() => usePersistentState('counter', () => 1));

    act(() => { result.current[1](prev => prev + 1); });

    expect(result.current[0]).toBe(2);
  });

  it('mode invité : setState n\'appelle JAMAIS supabase.from', () => {
    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));

    act(() => { result.current[1]('dark'); });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('échec d\'écriture localStorage (quota dépassé) : ne plante pas, le state en mémoire reste à jour', () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));
    expect(() => act(() => { result.current[1]('dark'); })).not.toThrow();
    expect(result.current[0]).toBe('dark');

    setItemSpy.mockRestore();
  });
});

describe('usePersistentState — pull initial à la connexion (stratégie serveur = source de vérité)', () => {
  it('le serveur a déjà une valeur : elle REMPLACE la valeur locale', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: { value: 'dark' }, error: null }));
    setAuth(loggedInUser);

    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));

    await waitFor(() => { expect(result.current[0]).toBe('dark'); });
  });

  it('serveur VIDE (data null) : pousse la valeur locale actuelle vers Supabase (upsert), garde la valeur locale affichée', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));
    setAuth(loggedInUser);

    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));

    await waitFor(() => {
      const builder = mockFrom.mock.results[0].value;
      expect(builder.upsert).toHaveBeenCalled();
    });

    const builder = mockFrom.mock.results[0].value;
    expect(builder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-uuid-1', key: 'theme', value: 'light',
    }));
    expect(result.current[0]).toBe('light');
  });

  it('ne relance PAS le pull une 2e fois pour le MÊME utilisateur, même si `user` est une NOUVELLE référence à chaque render', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);
    // Nouvelle référence `{ id: 'user-uuid-1' }` à CHAQUE appel — même piège
    // que useSyncedCollection.test.js, voir ce fichier pour le raisonnement
    // complet (hasSyncedForUserRef doit comparer par user.id, pas par
    // référence de l'objet `user`).
    mockUseAuthContext.mockImplementation(() => ({ user: { id: 'user-uuid-1' }, authLoading: false }));

    const { rerender } = renderHook(() => usePersistentState('theme', () => 'light'));
    // `data: null` prend la branche `else` (upsert) — DEUX appels à
    // `supabase.from('user_data')` sur ce seul montage (select ET upsert,
    // voir usePersistentState.js). On attend que les DEUX soient
    // terminés (`builder.upsert` appelé) avant de capturer le compteur de
    // référence, sinon une course entre cette assertion et le 2e appel
    // encore en vol rendrait ce test aléatoire.
    await waitFor(() => expect(builder.upsert).toHaveBeenCalled());
    const callsAfterFirstMount = mockFrom.mock.calls.length;

    rerender();
    rerender();

    expect(mockFrom.mock.calls.length).toBe(callsAfterFirstMount);
  });

  it('authLoading=true : n\'appelle PAS encore Supabase (attend la résolution de la session)', () => {
    // ⚠️ BUILD RÉEL CASSÉ PUIS CORRIGÉ (13/08) — ce test posait au départ
    // `loggedInUser` ICI, un scénario qui ne se produit JAMAIS en pratique :
    // dans AuthContext.jsx, `setUser(session.user)` et
    // `setAuthLoading(false)` sont posés dans le MÊME `.then()`, donc `user`
    // n'est JAMAIS non-null tant que `authLoading` reste `true` (voir
    // `useEffect` de `getSession()`). Avec `user` non-null, l'effet de PUSH
    // ([state], indépendant d'`authLoading`) se déclenchait quand même au
    // montage — d'où l'échec réel constaté au build. `user: null` reproduit
    // le SEUL cas réaliste.
    setAuth(null, true);
    renderHook(() => usePersistentState('theme', () => 'light'));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('déconnexion (user redevient null) : réarme hasSyncedForUserRef pour une future reconnexion', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: { value: 'dark' }, error: null }));
    setAuth(loggedInUser);

    const { result, rerender } = renderHook(() => usePersistentState('theme', () => 'light'));
    await waitFor(() => expect(result.current[0]).toBe('dark'));

    setAuth(guestUser);
    rerender();

    mockFrom.mockClear();
    mockFrom.mockReturnValue(makeBuilder({ data: { value: 'dark' }, error: null }));
    setAuth(loggedInUser);
    rerender();

    // Une reconnexion (même compte ou non) doit relancer le pull — la
    // garde `hasSyncedForUserRef` ne doit bloquer que des re-renders SANS
    // déconnexion entre-temps, jamais une vraie reconnexion.
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
  });

  it('erreur Supabase au pull : journalise en silence (pas de crash), garde la valeur locale', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
    setAuth(loggedInUser);

    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));

    // `error` truthy → la branche `else` (upsert) est prise, comme pour
    // `data: null` juste au-dessus — même chemin de code, le hook ne
    // distingue pas "vraiment vide" de "erreur réseau" à cet endroit
    // précis (voir usePersistentState.js : `if (!error && data) {...}
    // else {...}`).
    await waitFor(() => {
      const builder = mockFrom.mock.results[0].value;
      expect(builder.upsert).toHaveBeenCalled();
    });
    expect(result.current[0]).toBe('light');
  });

  it('exception levée pendant le pull (réseau down) : silencieuse, ne fait pas planter le hook', async () => {
    mockFrom.mockImplementation(() => { throw new Error('network down'); });
    setAuth(loggedInUser);

    expect(() => renderHook(() => usePersistentState('theme', () => 'light'))).not.toThrow();
  });

  it('valeur distante IDENTIQUE à la valeur locale (no-op React) : n\'empêche PAS le prochain vrai changement local de se synchroniser (correctif du 13/08)', async () => {
    // ⚠️ Documente le correctif direct de `isApplyingRemoteRef` — voir sa
    // docstring dans usePersistentState.js. Avant : `data.value === 'light'`
    // (identique à la valeur locale de départ) ne déclenchait aucun
    // re-render (bail-out React), donc `isApplyingRemoteRef` restait
    // bloqué à `true` pour toujours — le TOUT PROCHAIN `setState` réel de
    // l'utilisateur se faisait avaler silencieusement par l'effet de push,
    // qui le prenait à tort pour un pull. Ce test vérifie qu'un changement
    // local qui suit un pull "sans effet visible" se synchronise bien.
    const pullBuilder = makeBuilder({ data: { value: 'light' }, error: null }); // IDENTIQUE à l'initialValue ci-dessous
    mockFrom.mockReturnValue(pullBuilder);
    setAuth(loggedInUser);

    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));
    // Le pull a bien eu la main (readyForPushRef posé), même si `state`
    // n'a visiblement pas bougé (toujours 'light').
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    await new Promise(r => setTimeout(r, 0)); // laisse le `finally` du pull s'exécuter (readyForPushRef)
    expect(result.current[0]).toBe('light');

    mockFrom.mockClear();
    const pushBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(pushBuilder);

    // Un VRAI changement local, cette fois — ne doit PAS être avalé par un
    // `isApplyingRemoteRef` resté bloqué à `true`.
    act(() => { result.current[1]('dark'); });

    await waitFor(() => expect(pushBuilder.upsert).toHaveBeenCalled());
    expect(pushBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-uuid-1', key: 'theme', value: 'dark',
    }));
  });
});

describe('usePersistentState — push vers Supabase à chaque changement LOCAL', () => {
  // ⚠️ Cette section testait, jusqu'au 13/08, un comportement RÉEL mais NON
  // VOULU : au montage avec un compte déjà connecté, l'effet de push
  // partait AVANT que le pull ait eu la main (2 appels systématiques),
  // risquant d'écraser une valeur distante avec la valeur locale de départ.
  // Corrigé dans usePersistentState.js le même jour (voir la docstring de
  // `readyForPushRef`) — le push attend désormais que le pull ait fini
  // d'essayer pour l'utilisateur courant avant de pouvoir partir. Les tests
  // ci-dessous vérifient le comportement CORRIGÉ : un seul appel au
  // montage (le pull), le push n'entrant en jeu que pour un changement
  // local qui survient une fois le pull réglé.
  it('ne pousse RIEN au montage tant que le pull n\'a pas eu la main (correctif du 13/08)', async () => {
    // Le test qui documente directement le correctif : avant, au montage
    // avec un compte déjà connecté, le push partait AVANT même que le pull
    // ait pu contacter le serveur — 2 appels systématiques, dont un
    // parfaitement inutile (voire risqué : la valeur locale de départ
    // pouvait écraser une valeur distante plus récente). Le pull ne se
    // résout JAMAIS dans ce test (`.then` qui n'appelle jamais `resolve`) —
    // n'importe quel appel à `mockFrom` au-delà du premier (le pull
    // lui-même) prouverait que le push est bien parti prématurément.
    const neverResolvingBuilder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), then: () => {} };
    neverResolvingBuilder.select.mockReturnValue(neverResolvingBuilder);
    neverResolvingBuilder.eq.mockReturnValue(neverResolvingBuilder);
    neverResolvingBuilder.maybeSingle.mockReturnValue(neverResolvingBuilder);
    mockFrom.mockReturnValue(neverResolvingBuilder);
    setAuth(loggedInUser);

    renderHook(() => usePersistentState('theme', () => 'light'));

    // Un seul appel (le pull) — jamais un 2e (le push, qui devrait rester
    // bloqué puisque le pull, ici, ne se résout jamais).
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });


  it('un setState APRÈS le pull initial pousse la nouvelle valeur vers Supabase (upsert)', async () => {
    const initialBuilder = makeBuilder({ data: { value: 'dark' }, error: null });
    mockFrom.mockReturnValue(initialBuilder);
    setAuth(loggedInUser);

    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));
    // Un seul appel au montage — le push est bloqué tant que le pull n'a
    // pas fini d'essayer pour cet utilisateur (voir readyForPushRef).
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current[0]).toBe('dark')); // le pull a bien pris la main

    mockFrom.mockClear();
    const pushBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(pushBuilder);

    act(() => { result.current[1]('blue'); });

    await waitFor(() => expect(pushBuilder.upsert).toHaveBeenCalled());
    expect(pushBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-uuid-1', key: 'theme', value: 'blue',
    }));
  });

  it('le setState déclenché PAR le pull lui-même (isApplyingRemoteRef) ne repousse PAS un 2e appel', async () => {
    // Le pull applique `data.value` via `setState` — sans le garde-fou
    // `isApplyingRemoteRef`, cette écriture locale serait interprétée comme
    // un changement UTILISATEUR et repoussée aussitôt vers Supabase (un
    // aller-retour inutile, potentiellement une valeur périmée si le
    // serveur a changé entre-temps).
    const builder = makeBuilder({ data: { value: 'dark' }, error: null });
    mockFrom.mockReturnValue(builder);
    setAuth(loggedInUser);

    renderHook(() => usePersistentState('theme', () => 'light'));

    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    // Laisse le temps à un éventuel 2e appel non désiré de se produire.
    await new Promise(r => setTimeout(r, 0));
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('mode invité (jamais connecté) : setState ne pousse jamais vers Supabase', () => {
    setAuth(guestUser);
    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));

    act(() => { result.current[1]('dark'); });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('erreur Supabase au push : journalise en silence, ne fait pas planter le hook', async () => {
    const initialBuilder = makeBuilder({ data: { value: 'dark' }, error: null });
    mockFrom.mockReturnValue(initialBuilder);
    setAuth(loggedInUser);

    const { result } = renderHook(() => usePersistentState('theme', () => 'light'));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current[0]).toBe('dark'));

    mockFrom.mockClear();
    const errorBuilder = makeBuilder({ data: null, error: { message: 'échec upsert' } });
    mockFrom.mockReturnValueOnce(errorBuilder);

    expect(() => act(() => { result.current[1]('blue'); })).not.toThrow();
    await waitFor(() => expect(errorBuilder.upsert).toHaveBeenCalled());
    expect(result.current[0]).toBe('blue');
  });
});

describe('usePersistentState — isSupabaseConfigured=false (aucune dépendance Supabase)', () => {
  // Placé en DERNIER dans ce fichier, volontairement (même raisonnement que
  // AuthContext.test.jsx) : `vi.resetModules()` + `vi.doMock()` + import
  // dynamique, pour ne pas perturber les describes précédents qui utilisent
  // déjà `usePersistentState` importé en haut de fichier.
  it('reste utilisable en localStorage seul, même avec un user connecté, sans jamais toucher supabase.from', async () => {
    vi.resetModules();
    vi.doMock('../../src/supabaseClient.js', () => ({
      isSupabaseConfigured: false,
      supabase: { from: mockFrom },
    }));

    const { usePersistentState: useUnconfiguredPersistentState } = await import('../../src/hooks/usePersistentState.js');
    setAuth(loggedInUser);

    const { result } = renderHook(() => useUnconfiguredPersistentState('theme', () => 'light'));
    act(() => { result.current[1]('dark'); });

    expect(result.current[0]).toBe('dark');
    expect(JSON.parse(window.localStorage.getItem('tempofit:theme'))).toBe('dark');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
