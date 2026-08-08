// @vitest-environment jsdom
//
// Premier fichier de test pour pendingWrites.js (nouveau, 08/08 — voir sa
// docstring pour le raisonnement complet : `signOut()` doit pouvoir
// attendre les écritures Supabase encore en vol avant de couper la session
// et vider le cache local).
//
// ⚠️ État MODULE-LEVEL (pendingCount/waiters), pas remis à zéro entre les
// `it()` de ce fichier par défaut (même registre de module tant qu'aucun
// `vi.resetModules()` n'est appelé) — chaque test ci-dessous résout donc
// TOUJOURS toute écriture qu'il a lui-même enregistrée avant de se
// terminer, pour ne rien laisser fuiter vers le test suivant. Vérifié en
// plus explicitement via `_getPendingWriteCountForTests()` en fin de
// fichier (describe dédié) plutôt que supposé silencieusement.

import { describe, it, expect } from 'vitest';
import { trackWrite, waitForPendingWrites, _getPendingWriteCountForTests } from '../../src/utils/pendingWrites.js';

describe('trackWrite / waitForPendingWrites — comportement de base', () => {
  it('waitForPendingWrites se résout immédiatement quand rien n\'est en cours', async () => {
    expect(_getPendingWriteCountForTests()).toBe(0);
    await expect(waitForPendingWrites()).resolves.toBeUndefined();
  });

  it('waitForPendingWrites attend qu\'une écriture en cours se termine (succès)', async () => {
    let resolveWrite;
    const write = new Promise((resolve) => { resolveWrite = resolve; });
    trackWrite(write);
    expect(_getPendingWriteCountForTests()).toBe(1);

    let waitSettled = false;
    const waitPromise = waitForPendingWrites().then(() => { waitSettled = true; });

    await Promise.resolve(); await Promise.resolve();
    expect(waitSettled).toBe(false);

    resolveWrite({ error: null });
    await waitPromise;
    expect(waitSettled).toBe(true);
    expect(_getPendingWriteCountForTests()).toBe(0);
  });

  it('waitForPendingWrites attend aussi une écriture qui ÉCHOUE (rejet) — ne bloque jamais indéfiniment sur un échec réseau', async () => {
    let rejectWrite;
    const write = new Promise((_, reject) => { rejectWrite = reject; });
    // Le rejet est volontairement intercepté par trackWrite lui-même (voir
    // sa docstring) — jamais de unhandled rejection ici.
    trackWrite(write).catch(() => {});
    expect(_getPendingWriteCountForTests()).toBe(1);

    let waitSettled = false;
    const waitPromise = waitForPendingWrites().then(() => { waitSettled = true; });

    rejectWrite(new Error('réseau indisponible'));
    await waitPromise;
    expect(waitSettled).toBe(true);
    expect(_getPendingWriteCountForTests()).toBe(0);
  });

  it('waitForPendingWrites n\'attend que la retombée à ZÉRO — 2 écritures en parallèle, résolues à des moments différents', async () => {
    let resolveA, resolveB;
    trackWrite(new Promise((resolve) => { resolveA = resolve; }));
    trackWrite(new Promise((resolve) => { resolveB = resolve; }));
    expect(_getPendingWriteCountForTests()).toBe(2);

    let waitSettled = false;
    const waitPromise = waitForPendingWrites().then(() => { waitSettled = true; });

    resolveA();
    await Promise.resolve(); await Promise.resolve();
    // Une seule des deux résolue : toujours pas prêt.
    expect(waitSettled).toBe(false);
    expect(_getPendingWriteCountForTests()).toBe(1);

    resolveB();
    await waitPromise;
    expect(waitSettled).toBe(true);
    expect(_getPendingWriteCountForTests()).toBe(0);
  });

  it('onSettled reçoit le résultat en cas de succès, même contrat que les .then(({ error }) => ...) déjà utilisés par les appelants', async () => {
    let received = null;
    await trackWrite(Promise.resolve({ error: 'oups' }), (result) => { received = result; });
    expect(received).toEqual({ error: 'oups' });
  });

  it('onSettled n\'est PAS appelé en cas de rejet — même comportement que le code appelant existant (aucun callback d\'erreur réseau avant ce chantier)', async () => {
    let called = false;
    // `.catch(() => {})` chaîné sur la valeur DE RETOUR (pas sur ce qui est
    // passé à trackWrite) — le rejet doit bien arriver tel quel à
    // trackWrite pour exercer sa branche d'échec.
    await trackWrite(Promise.reject(new Error('boom')), () => { called = true; }).catch(() => {});
    expect(called).toBe(false);
  });

  it('trackWrite renvoie une vraie Promise utilisable avec await (usePersistentState.js) tout en restant valide en fire-and-forget (useSyncedCollection.js)', async () => {
    const result = await trackWrite(Promise.resolve('valeur'));
    expect(result).toBe('valeur');
  });

  it('fonctionne avec un thenable non-Promise (query builder Supabase mocké, .then(resolve) sans 2e argument)', async () => {
    const fakeBuilder = { then: (resolve) => resolve({ data: [1, 2, 3], error: null }) };
    let received = null;
    await trackWrite(fakeBuilder, (result) => { received = result; });
    expect(received).toEqual({ data: [1, 2, 3], error: null });
    expect(_getPendingWriteCountForTests()).toBe(0);
  });
});
