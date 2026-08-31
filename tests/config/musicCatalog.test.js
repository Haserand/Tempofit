import { describe, it, expect } from 'vitest';
import {
  isDirectGenreMatch,
  genreRoughlyMatches,
  classifyGenreMatchTier,
  isLiveOrPerformanceVersion,
  detectTitleStyleConflict,
  detectLanguageVersionConflict,
  findCatalogGenreForArtist,
  isExcludedTrack,
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

// NOUVEAU (28/08, chantier "mécanisme d'exclusion") — fonction PURE,
// testable sans réseau ; son usage réel (filtrer les candidats dans
// musicEngine.js/searchEngine.js) est hors scope ici (réseau, voir leurs
// propres fichiers de test).
describe('isExcludedTrack', () => {
  const exclusions = { artists: ['AC/DC'], tracks: [{ trackId: 'deezer-123' }] };

  it('exclut un titre dont le trackId est explicitement dans exclusions.tracks', () => {
    expect(isExcludedTrack({ trackId: 'deezer-123', artist: 'Inconnu' }, exclusions)).toBe(true);
  });

  it('exclut TOUS les titres d\'un artiste exclu, même un trackId jamais listé', () => {
    expect(isExcludedTrack({ trackId: 'deezer-999', artist: 'AC/DC' }, exclusions)).toBe(true);
  });

  it('insensible à la casse pour la comparaison d\'artiste', () => {
    expect(isExcludedTrack({ trackId: 'deezer-999', artist: 'ac/dc' }, exclusions)).toBe(true);
  });

  it('n\'exclut PAS un titre non listé d\'un artiste non exclu', () => {
    expect(isExcludedTrack({ trackId: 'deezer-999', artist: 'The Killers' }, exclusions)).toBe(false);
  });

  it('renvoie false sans planter si exclusions est null/undefined (appelant qui ne gère pas encore ce mécanisme)', () => {
    expect(isExcludedTrack({ trackId: 'deezer-123', artist: 'AC/DC' }, null)).toBe(false);
    expect(isExcludedTrack({ trackId: 'deezer-123', artist: 'AC/DC' }, undefined)).toBe(false);
  });

  it('renvoie false sans planter si le titre est null/undefined', () => {
    expect(isExcludedTrack(null, exclusions)).toBe(false);
    expect(isExcludedTrack(undefined, exclusions)).toBe(false);
  });

  it('renvoie false si exclusions.artists/tracks sont absents ou mal formés', () => {
    expect(isExcludedTrack({ trackId: 'x', artist: 'AC/DC' }, {})).toBe(false);
  });
});

// NOUVEAU (28/08, "prends du recul, pouvoir exclure un style au besoin ?")
describe('isExcludedTrack — exclusion par genre', () => {
  it('exclut un titre dont le genre correspond exactement à un genre exclu', () => {
    const exclusions = { artists: [], tracks: [], genres: ['Rap'] };
    expect(isExcludedTrack({ trackId: 'deezer-1', artist: 'Inconnu', genre: 'Rap' }, exclusions)).toBe(true);
  });

  it('respecte les équivalences de genre (genreRoughlyMatches), pas une égalité stricte — Rock exclu écarte aussi un titre catalogué Métal', () => {
    const exclusions = { artists: [], tracks: [], genres: ['Rock'] };
    expect(isExcludedTrack({ trackId: 'deezer-1', artist: 'Inconnu', genre: 'Métal' }, exclusions)).toBe(true);
  });

  it('n\'exclut pas un titre d\'un genre différent, sans rapport', () => {
    const exclusions = { artists: [], tracks: [], genres: ['Rap'] };
    expect(isExcludedTrack({ trackId: 'deezer-1', artist: 'Inconnu', genre: 'Jazz' }, exclusions)).toBe(false);
  });

  it('sans genre exclu configuré (tableau vide), n\'exclut jamais par genre', () => {
    const exclusions = { artists: [], tracks: [], genres: [] };
    expect(isExcludedTrack({ trackId: 'deezer-1', artist: 'Inconnu', genre: 'Rap' }, exclusions)).toBe(false);
  });

  it('renvoie false sans planter si track.genre est absent', () => {
    const exclusions = { artists: [], tracks: [], genres: ['Rap'] };
    expect(isExcludedTrack({ trackId: 'deezer-1', artist: 'Inconnu' }, exclusions)).toBe(false);
  });

  it('renvoie false sans planter si exclusions.genres est absent (ancienne forme sans ce champ)', () => {
    const exclusions = { artists: [], tracks: [] };
    expect(isExcludedTrack({ trackId: 'deezer-1', artist: 'Inconnu', genre: 'Rap' }, exclusions)).toBe(false);
  });

  it('les 3 critères (trackId, artiste, genre) restent indépendants — un seul suffit à exclure', () => {
    const exclusions = { artists: [], tracks: [], genres: ['Jazz'] };
    // Ni trackId ni artiste exclu, mais le genre l'est.
    expect(isExcludedTrack({ trackId: 'deezer-1', artist: 'Miles Davis', genre: 'Jazz' }, exclusions)).toBe(true);
  });
});
