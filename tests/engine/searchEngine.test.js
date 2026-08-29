import { describe, it, expect } from 'vitest';
import {
  normalizeForArtistMatch,
  stripLeadingArticle,
  levenshteinDistance,
  isConfidentArtistMatch,
  dedupeAppend,
  mergeAndResortBpmResults,
} from '../../src/engine/searchEngine.js';

/**
 * searchEngine.test.js — sécurise les fonctions PURES du moteur de
 * recherche/sélection par nom d'artiste (src/engine/searchEngine.js) : aucune
 * n'était couverte jusqu'ici, malgré leur usage central dans la recherche
 * manuelle (SearchModal.jsx) et la résolution BPM par artiste. Toutes les
 * valeurs attendues ci-dessous ont été vérifiées par exécution réelle des
 * fonctions avant d'écrire les assertions.
 *
 * Hors scope ici : fetchWorldSearchResults / fetchBpmSearchResults, qui
 * parlent réellement au réseau (Deezer/GetSongBPM) — non testables sans
 * mock HTTP, un chantier plus lourd que celui-ci.
 */

describe('normalizeForArtistMatch', () => {
  it('retire les accents, met en minuscule, et coupe les espaces en trop', () => {
    expect(normalizeForArtistMatch('Beyoncé  ')).toBe('beyonce');
  });

  it('renvoie une chaîne vide pour une entrée absente', () => {
    expect(normalizeForArtistMatch(null)).toBe('');
    expect(normalizeForArtistMatch(undefined)).toBe('');
  });
});

describe('stripLeadingArticle', () => {
  it('retire "the" en tête', () => {
    expect(stripLeadingArticle('the killers')).toBe('killers');
  });

  it('retire "les" en tête', () => {
    expect(stripLeadingArticle('les rita mitsouko')).toBe('rita mitsouko');
  });

  it('retire "la" en tête', () => {
    expect(stripLeadingArticle('la femme')).toBe('femme');
  });

  it('laisse inchangé un nom sans article', () => {
    expect(stripLeadingArticle('daft punk')).toBe('daft punk');
  });
});

describe('levenshteinDistance', () => {
  it('renvoie 0 pour deux chaînes identiques', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
  });

  it('compte 1 substitution', () => {
    expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
  });

  it('cas classique kitten/sitting (3 opérations)', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('distance = longueur de l\'autre chaîne face à une chaîne vide', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });
});

describe('isConfidentArtistMatch', () => {
  it('accepte une correspondance exacte', () => {
    expect(isConfidentArtistMatch('daft punk', 'Daft Punk')).toBe(true);
  });

  it('est insensible aux accents/à la casse', () => {
    expect(isConfidentArtistMatch('beyonce', 'Beyoncé')).toBe(true);
  });

  it('accepte une saisie partielle qui commence le nom complet', () => {
    expect(isConfidentArtistMatch('daft', 'Daft Punk')).toBe(true);
  });

  it('matche via l\'article retiré ("killers" -> "The Killers")', () => {
    expect(isConfidentArtistMatch('killers', 'The Killers')).toBe(true);
  });

  it('tolère une faute de frappe légère (dans la marge d\'édition autorisée)', () => {
    expect(isConfidentArtistMatch('daft ponk', 'Daft Punk')).toBe(true);
  });

  it('refuse un nom d\'artiste totalement différent', () => {
    expect(isConfidentArtistMatch('daft punk', 'Coldplay')).toBe(false);
  });

  it('refuse une saisie vide', () => {
    expect(isConfidentArtistMatch('', 'Daft Punk')).toBe(false);
  });
});

describe('dedupeAppend', () => {
  it('reset=true : ignore les résultats précédents, ne garde que les nouveaux', () => {
    const prev = [{ trackId: 1 }, { trackId: 2 }];
    const incoming = [{ trackId: 2 }, { trackId: 3 }];
    expect(dedupeAppend(prev, incoming, true)).toEqual([{ trackId: 2 }, { trackId: 3 }]);
  });

  it('reset=false : complète les précédents, dédoublonné par trackId', () => {
    const prev = [{ trackId: 1 }, { trackId: 2 }];
    const incoming = [{ trackId: 2 }, { trackId: 3 }];
    expect(dedupeAppend(prev, incoming, false)).toEqual([
      { trackId: 1 }, { trackId: 2 }, { trackId: 3 },
    ]);
  });
});

// NOUVEAU (28/08, chantier "Charger plus" pour la recherche BPM) — dédiée à
// la fusion utilisée par `loadMoreBpmResults` (useDeezerSearch.js) :
// `dedupeAppend` seul ne suffit pas ici, il préserverait l'ordre "tout
// `prev` d'abord, puis tout `incoming` ensuite" — un nouveau titre CONFIRMÉ
// trouvé par "Charger plus" atterrirait alors sous un ANCIEN titre non
// confirmé déjà affiché, brisant la garantie "confirmé avant non confirmé".
describe('mergeAndResortBpmResults', () => {
  it('retrie l\'ENSEMBLE par _matchTier — un nouveau titre confirmé passe devant un ancien non confirmé', () => {
    const prev = [
      { trackId: 'a', _matchTier: 0 },
      { trackId: 'b', _matchTier: 2 }, // ancien, non confirmé
    ];
    const incoming = [
      { trackId: 'c', _matchTier: 0 }, // nouveau, confirmé — doit passer devant 'b'
    ];
    expect(mergeAndResortBpmResults(prev, incoming).map(t => t.trackId)).toEqual(['a', 'c', 'b']);
  });

  it('déduplique par trackId (un titre déjà présent dans prev n\'est pas dupliqué)', () => {
    const prev = [{ trackId: 'a', _matchTier: 0 }];
    const incoming = [{ trackId: 'a', _matchTier: 0 }, { trackId: 'b', _matchTier: 1 }];
    const result = mergeAndResortBpmResults(prev, incoming);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.trackId)).toEqual(['a', 'b']);
  });

  it('respecte les paliers négatifs (favoris) : toujours devant les paliers 0/1/2', () => {
    const prev = [{ trackId: 'a', _matchTier: 0 }];
    const incoming = [{ trackId: 'b', _matchTier: -2 }, { trackId: 'c', _matchTier: -1 }];
    expect(mergeAndResortBpmResults(prev, incoming).map(t => t.trackId)).toEqual(['b', 'c', 'a']);
  });

  it('gère un `_matchTier` absent comme 0 (repli neutre, ne plante pas)', () => {
    const prev = [{ trackId: 'a' /* pas de _matchTier */ }];
    const incoming = [{ trackId: 'b', _matchTier: -1 }, { trackId: 'c', _matchTier: 2 }];
    expect(mergeAndResortBpmResults(prev, incoming).map(t => t.trackId)).toEqual(['b', 'a', 'c']);
  });
});
