import { describe, it, expect } from 'vitest';
import { fetchInBatches } from '../src/engine/musicEngine.js';

/**
 * fetchInBatches.test.js — chantier signalé depuis la passation du 26/07,
 * jamais traité faute de fake timers en place. Choix assumé cette session
 * (voir node_modules/vitest/index.js) : utiliser de VRAIS timers avec des
 * tolérances plutôt qu'un faux chronomètre reconstruit à la main — un
 * premier essai de fake timers s'est révélé peu fiable (ordre
 * microtask/macrotask), donc écarté au profit de la fiabilité. Coût :
 * ~1 seconde ajoutée à la suite (les pauses de 250ms sont réellement
 * traversées), jugé acceptable pour une suite qui tourne en ~2s au total.
 *
 * Trois choses vérifiées, pas juste "ça retourne le bon résultat" :
 * 1. Le DÉCOUPAGE en lots est respecté (jamais plus de batchSize appels
 *    simultanément "en vol").
 * 2. La PAUSE de 250ms a bien lieu ENTRE les lots, jamais après le dernier.
 * 3. L'ORDRE des résultats correspond à l'ordre des items en entrée, même
 *    si les promesses d'un même lot se résolvent dans le désordre.
 */

describe('fetchInBatches', () => {
  it('retourne un tableau vide sans appeler fn si items est vide', async () => {
    let calls = 0;
    const result = await fetchInBatches([], 3, async () => { calls++; });
    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  it('un seul lot (items.length <= batchSize) : résultat dans l\'ordre, sans pause notable', async () => {
    const order = [];
    const start = Date.now();
    const result = await fetchInBatches([1, 2, 3], 5, async (n) => {
      order.push(n);
      return n * 10;
    });
    const elapsed = Date.now() - start;
    expect(result).toEqual([10, 20, 30]);
    expect(order).toEqual([1, 2, 3]);
    // Un seul lot -> pas de setTimeout(250) du tout. Large marge (100ms)
    // pour absorber la lenteur d'une machine de CI chargée.
    expect(elapsed < 100).toBe(true);
  });

  it('découpe bien en lots de taille batchSize (jamais plus de batchSize appels simultanés)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5, 6, 7];
    const result = await fetchInBatches(items, 3, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n;
    });
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // 7 items en lots de 3 -> le plus gros lot en vol simultanément est 3.
    expect(maxInFlight).toBe(3);
  });

  it('attend bien ~250ms ENTRE deux lots (pas un simple enchaînement immédiat)', async () => {
    const timestamps = [];
    const items = [1, 2, 3, 4]; // batchSize=2 -> 2 lots, 1 pause entre les deux
    await fetchInBatches(items, 2, async (n) => {
      timestamps.push(Date.now());
      return n;
    });
    // Les 2 items du 1er lot démarrent quasi en même temps ; les 2 items du
    // 2e lot démarrent après la pause. On compare le dernier timestamp du
    // 1er lot au premier du 2e lot.
    const gap = timestamps[2] - timestamps[1];
    // Tolérance large (150ms) pour absorber la variance d'un environnement
    // sandbox, tout en excluant un enchaînement quasi instantané (<50ms).
    expect(gap > 150).toBe(true);
  });

  it('ne pose PAS de pause après le tout dernier lot (pas d\'attente superflue en fin de traitement)', async () => {
    const start = Date.now();
    // 4 items, batchSize=2 -> exactement 2 lots, donc UNE SEULE pause de
    // 250ms attendue au total, pas deux.
    const result = await fetchInBatches([1, 2, 3, 4], 2, async (n) => n);
    const elapsed = Date.now() - start;
    expect(result).toEqual([1, 2, 3, 4]);
    // 1 pause (~250ms) attendue, jamais 2 (~500ms+) : la borne à 400ms
    // laisse de la marge sans risquer de valider un bug à 2 pauses.
    expect(elapsed < 400).toBe(true);
  });

  it('préserve l\'ordre des résultats même si les promesses d\'un même lot se résolvent dans le désordre', async () => {
    const delays = { 1: 5, 2: 40, 3: 1 };
    const result = await fetchInBatches([1, 2, 3], 3, (n) => new Promise((resolve) => {
      setTimeout(() => resolve(n * 100), delays[n]);
    }));
    expect(result).toEqual([100, 200, 300]);
  });

  it('propage une exception si fn rejette (aucun try/catch interne qui l\'avalerait silencieusement)', async () => {
    let threw = false;
    try {
      await fetchInBatches([1, 2], 5, async (n) => {
        if (n === 2) throw new Error('échec volontaire');
        return n;
      });
    } catch (e) {
      threw = true;
      expect(e.message).toBe('échec volontaire');
    }
    expect(threw).toBe(true);
  });
});
