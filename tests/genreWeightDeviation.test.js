import { describe, it, expect } from 'vitest';
import { checkGenreWeightDeviation, equalSplitWeights } from '../src/genreWeightDeviation.js';

/**
 * genreWeightDeviation.test.js — sécurise checkGenreWeightDeviation
 * (src/genreWeightDeviation.js), extraite de useGeneratorForm.js.
 *
 * Converti depuis une version node:test (session du 26/07/2026) — même
 * noms de tests, mêmes valeurs attendues, déjà vérifiées par exécution
 * réelle de la fonction avant d'écrire les assertions. Cette conversion
 * elle-même n'a PAS pu être exécutée dans le sandbox où elle a été écrite
 * (pas d'accès npm) — à faire tourner ici via `npm run test:run` avant de
 * s'y fier.
 *
 * Genres volontairement non-ambigus (Rock/Pop) dans ces tests : la
 * désambiguïsation K-pop/J-pop-C-pop de normalizeGenreForDisplay est déjà
 * couverte séparément (voir tests/musicCatalog.test.js).
 */

describe('checkGenreWeightDeviation', () => {
  it('ne signale rien avec un seul genre pondéré (rien à comparer)', () => {
    const tracks = [{ duration: 100, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' }];
    expect(checkGenreWeightDeviation(tracks, { Rock: 100 })).toBeNull();
  });

  it('ne signale rien sans aucun poids configuré', () => {
    const tracks = [{ duration: 100, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' }];
    expect(checkGenreWeightDeviation(tracks, null)).toBeNull();
  });

  it('ne signale rien avec une playlist vide (division par zéro évitée)', () => {
    expect(checkGenreWeightDeviation([], { Rock: 50, Pop: 50 })).toBeNull();
  });

  it('signale les genres avec un écart significatif (≥ 15 points), triés genre par genre', () => {
    const tracks = [
      { duration: 600, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' },
      { duration: 200, genre: 'Pop', artist: 'Dua Lipa', title: 'Levitating' },
    ];
    expect(checkGenreWeightDeviation(tracks, { Rock: 50, Pop: 50 })).toEqual([
      'Rock : 75% obtenu (visé 50%)',
      'Pop : 25% obtenu (visé 50%)',
    ]);
  });

  it('ne signale rien si l\'écart reste sous le seuil de 15 points', () => {
    const tracks = [
      { duration: 520, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' },
      { duration: 480, genre: 'Pop', artist: 'Dua Lipa', title: 'Levitating' },
    ];
    expect(checkGenreWeightDeviation(tracks, { Rock: 50, Pop: 50 })).toBeNull();
  });

  it('ignore un genre dont le poids demandé est 0 (pas de cible à comparer)', () => {
    const tracks = [
      { duration: 600, genre: 'Rock', artist: 'AC/DC', title: 'Thunderstruck' },
      { duration: 200, genre: 'Pop', artist: 'Dua Lipa', title: 'Levitating' },
    ];
    expect(checkGenreWeightDeviation(tracks, { Rock: 50, Pop: 0 })).toEqual([
      'Rock : 75% obtenu (visé 50%)',
    ]);
  });
});

describe('equalSplitWeights', () => {
  it('répartit 100% également entre 2 genres', () => {
    expect(equalSplitWeights(['Rock', 'Pop'])).toEqual({ Rock: 50, Pop: 50 });
  });

  it('affecte le reste de l\'arrondi au DERNIER genre (3 genres -> 33/33/34, pas 33/33/33)', () => {
    expect(equalSplitWeights(['Rock', 'Pop', 'Jazz'])).toEqual({ Rock: 33, Pop: 33, Jazz: 34 });
  });

  it('un seul genre reçoit 100%', () => {
    expect(equalSplitWeights(['Rock'])).toEqual({ Rock: 100 });
  });

  it('renvoie un objet vide sans aucun genre', () => {
    expect(equalSplitWeights([])).toEqual({});
  });

  it('la somme des poids fait toujours exactement 100, quel que soit le nombre de genres', () => {
    const weights = equalSplitWeights(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    const sum = Object.values(weights).reduce((s, v) => s + v, 0);
    expect(sum).toBe(100);
  });
});
