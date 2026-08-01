// @vitest-environment jsdom
//
// Test dédié à useSyncedCollection.js — 0 test jusqu'ici malgré le hook le
// plus critique de la "Refonte Structurale — Round 1/2" (01/08) : c'est LUI
// qui décide quoi insérer/modifier/supprimer dans la vraie table Supabase
// à chaque `setState`, en calculant la différence entre l'ancien et le
// nouveau tableau. Une régression ici pourrait silencieusement perdre des
// playlists/routines réelles. `useAuthContext`/`supabase` entièrement
// mockés — pas de vrai réseau, pas de vrai compte.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

// Voir AuthContext.test.jsx pour l'explication complète de `vi.hoisted()`
// (zone morte temporelle sinon, fichier entier qui ne charge aucun test).
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

import { useSyncedCollection } from '../../src/hooks/useSyncedCollection.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

// Builder chaînable minimal, capture chaque appel de méthode pour
// inspection directe via `builder.select.mock.calls` etc. (vi.fn() garde
// son propre historique). `result` résout la chaîne QUELLE QUE SOIT sa
// longueur (`.select().eq()` pour un pull, `.delete().eq().eq()` pour une
// suppression...), exactement comme le vrai client Supabase (thenable).
function makeBuilder(result = { data: null, error: null }) {
  const b = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.insert = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.delete = vi.fn(() => b);
  b.then = (resolve) => resolve(result);
  return b;
}

const guestUser = null;
const loggedInUser = { id: 'user-uuid-1' };

function setAuth(user, authLoading = false) {
  mockUseAuthContext.mockReturnValue({ user, authLoading });
}

describe('useSyncedCollection — mode invité (localStorage seul, jamais Supabase)', () => {
  beforeEach(() => setAuth(guestUser));

  it('initialise depuis initialValue quand localStorage est vide', () => {
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => [{ id: 'a' }]));
    expect(result.current[0]).toEqual([{ id: 'a' }]);
  });

  it('initialise depuis localStorage si une valeur y est déjà présente (persistance hors-ligne)', () => {
    window.localStorage.setItem('tempofit:key1', JSON.stringify([{ id: 'preexistant' }]));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => [{ id: 'a' }]));
    expect(result.current[0]).toEqual([{ id: 'preexistant' }]);
  });

  it('setState met à jour le state ET localStorage, sans JAMAIS appeler supabase.from', () => {
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => []));

    act(() => { result.current[1]([{ id: 'nouvelle' }]); });

    expect(result.current[0]).toEqual([{ id: 'nouvelle' }]);
    expect(JSON.parse(window.localStorage.getItem('tempofit:key1'))).toEqual([{ id: 'nouvelle' }]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('accepte un updater fonctionnel (comme un setState classique)', () => {
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => [{ id: 'a' }]));

    act(() => { result.current[1](prev => [...prev, { id: 'b' }]); });

    expect(result.current[0]).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});

describe('useSyncedCollection — pull initial à la connexion', () => {
  it('le serveur a déjà des lignes : elles REMPLACENT l\'état local (serveur = source de vérité)', async () => {
    const serverRows = [{ id: 'srv-1', user_id: 'user-uuid-1', content: { id: 'srv-1', name: 'Depuis le serveur' } }];
    mockFrom.mockReturnValue(makeBuilder({ data: serverRows, error: null }));
    setAuth(loggedInUser);

    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => [{ id: 'local-invite' }]));

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: 'srv-1', name: 'Depuis le serveur' }]);
    });
  });

  it('serveur VIDE mais état local invité non vide : pousse l\'état local vers Supabase (insert), garde l\'état local affiché', async () => {
    const selectBuilder = makeBuilder({ data: [], error: null });
    const insertBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);
    setAuth(loggedInUser);

    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => [{ id: 'local-invite', name: 'Séance invité', isPublic: false, isNaughty: false }]));

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());

    expect(insertBuilder.insert).toHaveBeenCalledWith([
      { id: 'local-invite', user_id: 'user-uuid-1', content: { id: 'local-invite', name: 'Séance invité', isPublic: false, isNaughty: false }, is_public: false, is_intimate: false },
    ]);
    // L'état local reste affiché tel quel — rien n'a été écrasé.
    expect(result.current[0]).toEqual([{ id: 'local-invite', name: 'Séance invité', isPublic: false, isNaughty: false }]);
  });

  it('ne relance PAS le pull une 2e fois pour le MÊME utilisateur (hasSyncedForUserRef), même si `user` est une NOUVELLE référence à chaque render (comme un vrai contexte React)', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);
    // Nouvelle référence `{ id: 'user-uuid-1' }` à CHAQUE appel — simule un
    // contexte React qui recrée son objet `user` à chaque render (cas
    // réel très courant). Sans le garde-fou `hasSyncedForUserRef`, le
    // tableau de dépendances de l'effet ([user, authLoading, tableName])
    // verrait `user` changer de référence à chaque fois et relancerait le
    // pull à CHAQUE render — ce test isole ce garde-fou spécifiquement,
    // pas seulement le fait que React ne relance pas un effet sur des
    // props strictement identiques (ce qui aurait masqué un vrai bug ici).
    mockUseAuthContext.mockImplementation(() => ({ user: { id: 'user-uuid-1' }, authLoading: false }));

    const { rerender } = renderHook(() => useSyncedCollection('key1', 'playlists', () => []));
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    const callsAfterFirstMount = mockFrom.mock.calls.length;

    rerender();
    rerender();

    expect(mockFrom.mock.calls.length).toBe(callsAfterFirstMount);
  });

  it('authLoading=true : n\'appelle PAS encore Supabase (attend la résolution de la session)', () => {
    setAuth(loggedInUser, true);
    renderHook(() => useSyncedCollection('key1', 'playlists', () => []));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('erreur Supabase au pull : journalise l\'erreur (console.error), ne fait PAS planter le hook', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
    setAuth(loggedInUser);

    renderHook(() => useSyncedCollection('key1', 'playlists', () => []));

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  // BUG CORRIGÉ (01/08, trouvé en écrivant CE test précis, pas signalé par
  // un retour utilisateur) — un flag `isApplyingRemoteRef` posé par le pull
  // n'était jamais consommé par le bon appelant (voir useSyncedCollection.js
  // pour l'historique complet) : le TOUT PREMIER `setState` suivant une
  // connexion où le serveur avait déjà des données voyait son diff
  // silencieusement sauté, sans la moindre erreur console — la
  // modification restait visible localement mais ne partait jamais vers
  // Supabase. Ce test isole ce scénario exact et explicitement, même si
  // plusieurs autres tests de ce fichier (suppression/modification/erreur,
  // qui démarrent TOUS par un pull-remplacement) l'auraient aussi détecté
  // indirectement — pour qu'un futur mainteneur comprenne IMMÉDIATEMENT
  // quel scénario précis est protégé ici, sans avoir à déduire le lien
  // avec un flag qui n'existe même plus.
  it('un setState juste APRÈS un pull qui a remplacé l\'état (serveur non vide à la connexion) synchronise normalement, PAS sauté', async () => {
    const initial = [{ id: 'depuis-serveur', name: 'Déjà en base' }];
    mockFrom.mockReturnValueOnce(makeBuilder({
      data: initial.map(item => ({ id: item.id, user_id: 'user-uuid-1', content: item, is_public: false, is_intimate: false })),
      error: null,
    }));
    setAuth(loggedInUser);

    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => []));
    await waitFor(() => expect(result.current[0]).toEqual(initial));

    const insertBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(insertBuilder);

    // 1er setState APRÈS le pull-remplacement — exactement le cas qui
    // était silencieusement cassé.
    act(() => {
      result.current[1]([...initial, { id: 'toute-nouvelle', name: 'Ajoutée juste après connexion' }]);
    });

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'toute-nouvelle' }));
  });
});

describe('useSyncedCollection — diff de setState (insert/update/delete individuels)', () => {
  beforeEach(() => setAuth(loggedInUser));

  // Construit les lignes SERVEUR correspondant exactement à un état local
  // de départ donné — le pull initial "retrouve" alors ces mêmes données
  // (branche `data.length > 0`, remplace le state par lui-même via
  // `rowToItem`) plutôt que de les considérer comme de nouvelles données
  // invité à POUSSER (branche `else`, qui appellerait `.insert()` — un
  // appel PARASITE qui aurait pu, selon le timing, consommer par erreur le
  // mock prévu pour l'action réellement testée juste après). Isole ainsi
  // proprement CHAQUE test sur la seule action qui l'intéresse.
  function serverRowsFor(items, userId = 'user-uuid-1') {
    return items.map(item => ({ id: item.id, user_id: userId, content: item, is_public: !!item.isPublic, is_intimate: !!item.isNaughty }));
  }

  it('ajout d\'un élément : appelle .insert() avec la ligne construite via itemToRow', async () => {
    mockFrom.mockReturnValueOnce(makeBuilder({ data: serverRowsFor([]), error: null }));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => []));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));

    const insertBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(insertBuilder);

    act(() => {
      result.current[1]([{ id: 'nouvelle-1', name: 'Ma séance', isPublic: true, isNaughty: false }]);
    });

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      id: 'nouvelle-1', user_id: 'user-uuid-1',
      content: { id: 'nouvelle-1', name: 'Ma séance', isPublic: true, isNaughty: false },
      is_public: true, is_intimate: false,
    });
  });

  it('suppression d\'un élément : appelle .delete().eq(\'id\',...).eq(\'user_id\',...)', async () => {
    const initial = [{ id: 'a-supprimer' }];
    mockFrom.mockReturnValueOnce(makeBuilder({ data: serverRowsFor(initial), error: null }));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => initial));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current[0]).toEqual(initial));

    const deleteBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteBuilder);

    act(() => { result.current[1]([]); });

    await waitFor(() => expect(deleteBuilder.delete).toHaveBeenCalled());
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'a-supprimer');
    expect(deleteBuilder.eq).toHaveBeenCalledWith('user_id', 'user-uuid-1');
  });

  it('modification d\'un élément EXISTANT (même id, contenu différent) : appelle .update(), pas .insert()', async () => {
    const initial = [{ id: 'x', name: 'Ancien nom' }];
    mockFrom.mockReturnValueOnce(makeBuilder({ data: serverRowsFor(initial), error: null }));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => initial));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current[0]).toEqual(initial));

    const updateBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(updateBuilder);

    act(() => { result.current[1]([{ id: 'x', name: 'Nouveau nom' }]); });

    await waitFor(() => expect(updateBuilder.update).toHaveBeenCalled());
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ content: { id: 'x', name: 'Nouveau nom' } }));
    expect(updateBuilder.insert).not.toHaveBeenCalled();
  });

  it('élément INCHANGÉ (même id, contenu strictement identique) : n\'appelle NI insert NI update NI delete', async () => {
    const initial = [{ id: 'x', name: 'Toujours pareil' }];
    mockFrom.mockReturnValueOnce(makeBuilder({ data: serverRowsFor(initial), error: null }));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => initial));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current[0]).toEqual(initial));

    mockFrom.mockClear();

    // Nouveau tableau, mais avec un objet STRICTEMENT identique (même
    // valeurs) — le diff compare par JSON.stringify, pas par référence.
    act(() => { result.current[1]([{ id: 'x', name: 'Toujours pareil' }]); });

    // Laisse le temps à un éventuel appel non désiré de se produire avant
    // de vérifier son absence.
    await new Promise(r => setTimeout(r, 0));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('itemToRow : is_public reflète item.isPublic, is_intimate reflète item.isNaughty (pas l\'inverse, pas un autre champ)', async () => {
    mockFrom.mockReturnValueOnce(makeBuilder({ data: serverRowsFor([]), error: null }));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => []));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));

    const insertBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(insertBuilder);

    act(() => {
      result.current[1]([{ id: 'y', isPublic: false, isNaughty: true }]);
    });

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());
    const rowSent = insertBuilder.insert.mock.calls[0][0];
    expect(rowSent.is_public).toBe(false);
    expect(rowSent.is_intimate).toBe(true);
  });

  it('champs isPublic/isNaughty absents (undefined) : is_public/is_intimate valent false (jamais undefined en base)', async () => {
    mockFrom.mockReturnValueOnce(makeBuilder({ data: serverRowsFor([]), error: null }));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => []));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));

    const insertBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(insertBuilder);

    act(() => { result.current[1]([{ id: 'z' }]); });

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());
    const rowSent = insertBuilder.insert.mock.calls[0][0];
    expect(rowSent.is_public).toBe(false);
    expect(rowSent.is_intimate).toBe(false);
  });

  it('erreur Supabase sur une suppression : journalise l\'erreur, ne fait pas planter le hook', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const initial = [{ id: 'a' }];
    mockFrom.mockReturnValueOnce(makeBuilder({ data: serverRowsFor(initial), error: null }));
    const { result } = renderHook(() => useSyncedCollection('key1', 'playlists', () => initial));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current[0]).toEqual(initial));

    mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'échec suppression' } }));

    act(() => { result.current[1]([]); });

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });
});
