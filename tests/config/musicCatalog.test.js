import { describe, it, expect } from 'vitest';
import {
  isDirectGenreMatch,
  genreRoughlyMatches,
  classifyGenreMatchTier,
  isLiveOrPerformanceVersion,
  detectTitleStyleConflict,
  detectLanguageVersionConflict,
  findCatalogGenreForArtist,
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

// NOUVEAU (28/08, retour direct — capture à l'appui : recherche "Pop" à
// 140±10 après le chantier "favoris en premier", "War Machine (Live at
// River Plate Stadium...)" d'AC/DC — artiste favori — remonté en tête
// étiqueté "Pop" sans le moindre avertissement, alors qu'AC/DC n'existe
// QUE dans ARTIST_CATALOG['Rock']). Fonction PURE, testable sans réseau —
// son usage réel (croiser le genre résolu par Deezer PAR TITRE avec le
// genre catalogué PAR ARTISTE) vit dans searchEngine.js/musicEngine.js,
// hors scope ici (réseau, voir leurs propres fichiers de test).
describe('findCatalogGenreForArtist', () => {
  it("trouve le genre catalogué d'un artiste connu (comparaison exacte)", () => {
    expect(findCatalogGenreForArtist('AC/DC')).toBe('Rock');
  });

  it('insensible à la casse', () => {
    expect(findCatalogGenreForArtist('ac/dc')).toBe('Rock');
    expect(findCatalogGenreForArtist('Ac/Dc')).toBe('Rock');
  });

  it('insensible aux espaces superflus en début/fin', () => {
    expect(findCatalogGenreForArtist('  AC/DC  ')).toBe('Rock');
  });

  it('renvoie null pour un artiste absent de tout catalogue', () => {
    expect(findCatalogGenreForArtist('Un Groupe Totalement Inconnu')).toBeNull();
  });

  it('renvoie null pour une entrée vide/absente, sans planter', () => {
    expect(findCatalogGenreForArtist(null)).toBeNull();
    expect(findCatalogGenreForArtist(undefined)).toBeNull();
    expect(findCatalogGenreForArtist('')).toBeNull();
  });

  it("ne matche PAS une correspondance partielle (contrairement à isDirectGenreMatch) — un nom d'artiste doit être EXACT", () => {
    // "The Killers" est catalogué, mais pas "Killers" seul ni "The Killers Band" —
    // contrairement à la correspondance de GENRE (substring tolérée), un nom
    // d'ARTISTE doit matcher exactement pour éviter les faux positifs.
    expect(findCatalogGenreForArtist('Killers')).toBeNull();
    expect(findCatalogGenreForArtist('The Killers Band')).toBeNull();
    expect(findCatalogGenreForArtist('The Killers')).toBe('Rock');
  });
});

// NOUVEAU (27/08, retour direct — "pourquoi ne pas améliorer les 2 moteurs
// d'un coup ?") — extrait de musicEngine.js/searchEngine.js, qui
// réécrivaient chacun indépendamment cette même décision à 3 paliers. Les
// 2 fichiers appelants ne sont PAS re-testés ici (déjà hors du périmètre
// testable pour l'un — réseau, voir searchEngine.test.js — et déjà couvert
// par ses propres tests d'intégration pour l'autre) : seule la fonction
// PURE, partagée, est visée.
describe('classifyGenreMatchTier', () => {
  it('palier 0 : correspondance directe', () => {
    expect(classifyGenreMatchTier('Rock', ['Rock'])).toBe(0);
  });

  it('palier 1 : équivalence uniquement (ex. Rock accepté pour Métal)', () => {
    expect(classifyGenreMatchTier('Rock', ['Métal'])).toBe(1);
  });

  it('palier 2 : aucune correspondance ("genre non confirmé")', () => {
    expect(classifyGenreMatchTier('Jazz', ['Métal'])).toBe(2);
  });

  it('palier 2 pour un genre réel absent, SAUF si "Autre" est demandé (aucune restriction)', () => {
    expect(classifyGenreMatchTier(null, ['Rock'])).toBe(2);
    expect(classifyGenreMatchTier(null, ['Autre'])).toBe(0);
  });

  it('accepte PLUSIEURS genres demandés à la fois — le meilleur palier parmi eux l\'emporte', () => {
    // "Rock" est un match direct pour 'Rock' (palier 0), même si 'Jazz'
    // (l'autre genre demandé) ne matche pas du tout — le meilleur des deux
    // doit l'emporter, jamais le pire.
    expect(classifyGenreMatchTier('Rock', ['Jazz', 'Rock'])).toBe(0);
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
