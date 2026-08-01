import { describe, it, expect } from 'vitest';
import {
  isDirectGenreMatch,
  genreRoughlyMatches,
  isLiveOrPerformanceVersion,
  detectTitleStyleConflict,
  detectLanguageVersionConflict,
} from '../../src/musicCatalog.js';

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

/**
 * detectTitleStyleConflict — utilisée à 4 endroits du pipeline de sélection
 * dans musicEngine.js (recherche par genre, résolution de candidats,
 * filtrage de la timeline finale, remplacement même-artiste) : un titre dont
 * le TEXTE trahit un style différent du genre_id d'album Deezer (ex. un
 * remix hardstyle catalogué Rock/Métal côté album) doit être exclu, même si
 * le genre_id dit le contraire. Non couverte jusqu'ici malgré son usage
 * central dans la sélection réelle des morceaux.
 */
describe('detectTitleStyleConflict', () => {
  it('signale un conflit quand le mot-clé du titre ne recoupe aucun genre demandé', () => {
    expect(detectTitleStyleConflict('Let Her Go (Hardstyle Remix)', ['Rock'])).toBe('hardstyle');
  });

  it('ne signale rien si le genre impliqué par le mot-clé est justement demandé', () => {
    expect(detectTitleStyleConflict('Let Her Go (Hardstyle Remix)', ['Techno'])).toBeNull();
  });

  it('ne signale rien sans mot-clé de conflit dans le titre', () => {
    expect(detectTitleStyleConflict('Thunderstruck', ['Rock'])).toBeNull();
  });

  it('un mot-clé associé à une liste de genres VIDE (ex. "a cappella") est TOUJOURS un conflit', () => {
    expect(detectTitleStyleConflict('Yesterday (A Cappella Version)', ['Pop'])).toBe('a cappella');
  });

  it('est insensible à la casse', () => {
    expect(detectTitleStyleConflict('SONG (HARDSTYLE MIX)', ['Rock'])).toBe('hardstyle');
  });

  it('renvoie null pour un titre absent', () => {
    expect(detectTitleStyleConflict('', ['Rock'])).toBeNull();
    expect(detectTitleStyleConflict(null, ['Rock'])).toBeNull();
  });
});

/**
 * detectLanguageVersionConflict — même rôle que detectTitleStyleConflict,
 * spécifique à la désambiguïsation K-pop / Musique asiatique (J-pop & C-pop)
 * quand le titre indique explicitement une version dans une langue/un
 * marché donné. Zone du code avec un historique de bugs réels documentés
 * (ex. "MONSTA X" vs "Monsta X" mal comparé) — jusqu'ici non couverte.
 */
describe('detectLanguageVersionConflict', () => {
  it('signale un conflit : titre "(Japanese Ver.)" mais K-pop demandé', () => {
    expect(detectLanguageVersionConflict('Hero (Japanese Ver.)', ['K-pop'])).toBe('Musique asiatique');
  });

  it('ne signale rien si le genre du marché indiqué est justement demandé', () => {
    expect(detectLanguageVersionConflict('Hero (Japanese Ver.)', ['Musique asiatique'])).toBeNull();
  });

  it('ne signale rien sans marqueur de langue explicite dans le titre', () => {
    expect(detectLanguageVersionConflict('Hero', ['K-pop'])).toBeNull();
  });

  it('ne signale rien sans aucun genre demandé', () => {
    expect(detectLanguageVersionConflict('Hero (Japanese Ver.)', [])).toBeNull();
  });

  it('renvoie null pour un titre absent', () => {
    expect(detectLanguageVersionConflict('', ['K-pop'])).toBeNull();
  });
});
