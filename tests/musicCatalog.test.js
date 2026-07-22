import { describe, it, expect } from 'vitest';
import { isDirectGenreMatch, genreRoughlyMatches, isLiveOrPerformanceVersion } from '../src/musicCatalog.js';

describe('isDirectGenreMatch', () => {
  it('accepte toujours "Autre" (absence de restriction de genre)', () => {
    expect(isDirectGenreMatch('Rock', 'Autre')).toBe(true);
    expect(isDirectGenreMatch(null, 'Autre')).toBe(true);
  });

  it('refuse un genre vide/absent (hors cas "Autre")', () => {
    expect(isDirectGenreMatch(null, 'Pop')).toBe(false);
    expect(isDirectGenreMatch('', 'Pop')).toBe(false);
  });

  it('accepte un match direct sur le mot-clé', () => {
    expect(isDirectGenreMatch('Pop', 'Pop')).toBe(true);
  });

  it('est insensible à la casse et aux accents', () => {
    expect(isDirectGenreMatch('MÉTAL', 'Métal')).toBe(true);
  });

  // Non-régression : bug réel documenté dans musicCatalog.js. Avant fix, la
  // comparaison directe contre `requestedGenre` faisait que "K-pop" (contient
  // "pop" comme sous-chaîne) matchait n'importe quel titre au genre réel
  // "Pop" (Rihanna, Katy Perry...), AVANT que le catalogue K-pop réel ait sa
  // chance. Le fix : ne comparer que contre le(s) mot-clé(s) Deezer dédiés
  // (ici 'asian' pour K-pop), plus jamais contre le nom du genre lui-même.
  it('NE PAS matcher K-pop sur un titre au genre réel "Pop" (non-régression)', () => {
    expect(isDirectGenreMatch('Pop', 'K-pop')).toBe(false);
  });

  it('matche K-pop sur le mot-clé Deezer réel ("asian")', () => {
    expect(isDirectGenreMatch('Asian Music', 'K-pop')).toBe(true);
  });
});

describe('genreRoughlyMatches', () => {
  it('inclut tout ce qu\'accepte déjà isDirectGenreMatch', () => {
    expect(genreRoughlyMatches('Pop', 'Pop')).toBe(true);
  });

  it('accepte Rock pour une demande Métal via les groupes d\'équivalence', () => {
    // Documenté dans musicCatalog.js : Deezer classe la quasi-totalité du
    // metal en "Rock", d'où l'équivalence explicite.
    expect(genreRoughlyMatches('Rock', 'Métal')).toBe(true);
  });

  it('refuse un genre totalement sans rapport', () => {
    expect(genreRoughlyMatches('Jazz', 'Métal')).toBe(false);
  });
});

describe('isLiveOrPerformanceVersion', () => {
  it('détecte une mention "(Live)" dans le titre', () => {
    expect(isLiveOrPerformanceVersion('Bohemian Rhapsody (Live)')).toBe(true);
  });

  it('ne signale pas un titre studio ordinaire', () => {
    expect(isLiveOrPerformanceVersion('Blinding Lights')).toBe(false);
  });
});
