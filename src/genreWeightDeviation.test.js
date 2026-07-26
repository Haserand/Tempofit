// genreWeightDeviation.test.js — tests pour checkGenreWeightDeviation
// (src/genreWeightDeviation.js).
//
// Utilise le test runner NATIF de Node (`node:test` + `node:assert`), même
// modèle que src/utils/numberInput.test.js et src/athleticZones.test.js.
// Exécutable directement avec `node --test src/genreWeightDeviation.test.js`.
//
// Toutes les valeurs attendues ci-dessous ont été vérifiées par exécution
// réelle de la fonction avant d'écrire les assertions — aucune n'est
// devinée. Genres volontairement non-ambigus (Rock/Pop) dans ces tests :
// la désambiguïsation K-pop/J-pop-C-pop de normalizeGenreForDisplay est déjà
// couverte séparément (voir musicCatalog).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkGenreWeightDeviation } from './genreWeightDeviation.js';

describe('checkGenreWeightDeviation', () => {
  test('ne signale rien avec un seul genre pondéré (rien à comparer)', () => {
    const tracks = [{ duration: 100, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' }];
    assert.strictEqual(checkGenreWeightDeviation(tracks, { Rock: 100 }), null);
  });

  test('ne signale rien sans aucun poids configuré', () => {
    const tracks = [{ duration: 100, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' }];
    assert.strictEqual(checkGenreWeightDeviation(tracks, null), null);
  });

  test('ne signale rien avec une playlist vide (division par zéro évitée)', () => {
    assert.strictEqual(checkGenreWeightDeviation([], { Rock: 50, Pop: 50 }), null);
  });

  test('signale les genres avec un écart significatif (≥ 15 points), triés genre par genre', () => {
    const tracks = [
      { duration: 600, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' },
      { duration: 200, genre: 'Pop', artist: 'Dua Lipa', title: 'Levitating' },
    ];
    assert.deepStrictEqual(checkGenreWeightDeviation(tracks, { Rock: 50, Pop: 50 }), [
      'Rock : 75% obtenu (visé 50%)',
      'Pop : 25% obtenu (visé 50%)',
    ]);
  });

  test('ne signale rien si l\'écart reste sous le seuil de 15 points', () => {
    const tracks = [
      { duration: 520, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' },
      { duration: 480, genre: 'Pop', artist: 'Dua Lipa', title: 'Levitating' },
    ];
    assert.strictEqual(checkGenreWeightDeviation(tracks, { Rock: 50, Pop: 50 }), null);
  });

  test('ignore un genre dont le poids demandé est 0 (pas de cible à comparer)', () => {
    const tracks = [
      { duration: 600, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' },
      { duration: 200, genre: 'Pop', artist: 'Dua Lipa', title: 'Levitating' },
    ];
    assert.deepStrictEqual(checkGenreWeightDeviation(tracks, { Rock: 50, Pop: 0 }), [
      'Rock : 75% obtenu (visé 50%)',
    ]);
  });
});
