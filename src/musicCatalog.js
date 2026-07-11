/**
 * musicCatalog.js — Bibliothèque musicale de TempoFit, séparée de App.jsx.
 *
 * Contient uniquement de la DONNÉE et une fonction pure de lecture (pas de state,
 * pas de hooks React, pas d'appel réseau) : la base de secours hors-ligne, les
 * listes de genres proposés à l'utilisateur, et la correspondance genre → mot-clé
 * de recherche Deezer. Extrait de App.jsx pour ne pas mélanger données et logique
 * applicative dans un seul fichier — voir la discussion sur ce choix dans le suivi
 * de projet.
 */

// Base de données musicale locale (fallback hors-ligne / avant tout appel API).
// Organisée par genre → tableau de morceaux avec leur BPM connu à l'avance.
// Sert de filet de sécurité quand ni les favoris Spotify ni l'API mondiale
// ne remontent de résultat satisfaisant.
const DATABASE_MUSIQUES = {
  // Lot ajouté après un test réel révélant que Deezer classe la quasi-totalité du
  // metal en "Rock" dans son propre système de genres (System of a Down, Guns N'
  // Roses... tous résolus "Rock", jamais "Metal" — voir GENRE_EQUIVALENCE_GROUPS
  // dans App.jsx) — un vrai filet de secours local pour "Métal" a donc du sens
  // ici, puisqu'il ne dépend pas de la classification Deezer. BPM recoupés sur
  // 2-3 sources (SongBPM, GetSongBPM, Tunebat) par titre, valeur commune retenue
  // — pas une mesure officielle vérifiée par mes soins (même réserve que le reste
  // de cette base). "Iron Man" (Black Sabbath) volontairement écarté : données de
  // tempo trop contradictoires d'une source à l'autre (77 à 187 BPM selon la
  // source) pour retenir une valeur fiable.
  'Métal': [
    { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', album: 'Toxicity', bpm: 128, duration: 210, isEmbeddable: false },
    { youtubeId: 'uRyAIyq53FY', title: 'Master of Puppets', artist: 'Metallica', album: 'Master of Puppets', bpm: 212, duration: 515, isEmbeddable: false },
    { youtubeId: 'L_jWHffIx5E', title: 'Smash', artist: 'The Offspring', album: 'Smash', bpm: 180, duration: 170, isEmbeddable: false },
    { youtubeId: 'v2H4l9RpkwM', title: 'Duality', artist: 'Slipknot', album: 'Vol. 3', bpm: 145, duration: 252, isEmbeddable: false },
    { youtubeId: 'kNGNLo8K6Fk', title: 'Numb', artist: 'Linkin Park', album: 'Meteora', bpm: 108, duration: 187, isEmbeddable: false },
    { youtubeId: 'W3q8Od5qJio', title: 'Du Hast', artist: 'Rammstein', album: 'Sehnsucht', bpm: 125, duration: 234, isEmbeddable: false },
    { youtubeId: 'local-metal-01', title: 'Enter Sandman', artist: 'Metallica', album: 'Metallica (The Black Album)', bpm: 123, duration: 332, isEmbeddable: false },
    { youtubeId: 'local-metal-02', title: 'Freak On a Leash', artist: 'Korn', album: 'Follow the Leader', bpm: 103, duration: 256, isEmbeddable: false },
    { youtubeId: 'local-metal-03', title: 'Killing In The Name', artist: 'Rage Against the Machine', album: 'Rage Against the Machine', bpm: 89, duration: 314, isEmbeddable: false },
    { youtubeId: 'local-metal-04', title: 'Bodies', artist: 'Drowning Pool', album: 'Sinner', bpm: 131, duration: 202, isEmbeddable: false },
    { youtubeId: 'local-metal-05', title: 'Down with the Sickness', artist: 'Disturbed', album: 'The Sickness', bpm: 90, duration: 279, isEmbeddable: false },
    { youtubeId: 'local-metal-06', title: 'Raining Blood', artist: 'Slayer', album: 'Reign in Blood', bpm: 178, duration: 254, isEmbeddable: false },
    { youtubeId: 'local-metal-07', title: 'Walk', artist: 'Pantera', album: 'Vulgar Display of Power', bpm: 118, duration: 315, isEmbeddable: false },
    { youtubeId: 'local-metal-08', title: 'Toxicity', artist: 'System Of A Down', album: 'Toxicity', bpm: 117, duration: 219, isEmbeddable: false },
    { youtubeId: 'local-metal-09', title: 'Paranoid', artist: 'Black Sabbath', album: 'Paranoid', bpm: 163, duration: 168, isEmbeddable: false }
  ],
  'Rock': [
    { youtubeId: 'hTWKbfoikeg', title: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', bpm: 116, duration: 301, isEmbeddable: false },
    { youtubeId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', bpm: 148, duration: 222, isEmbeddable: false },
    { youtubeId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', album: 'The Razors Edge', bpm: 133, duration: 292, isEmbeddable: false }
  ],
  'Electro': [
    { youtubeId: '5NV6Rdv1a3I', title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories', bpm: 116, duration: 248, isEmbeddable: false },
    { youtubeId: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', bpm: 171, duration: 240, isEmbeddable: false },
    { youtubeId: 'YykjpeuMNEk', title: 'Animals', artist: 'Martin Garrix', album: 'Gold Skies', bpm: 128, duration: 195, isEmbeddable: false },
    { youtubeId: 'K4DyBUG242c', title: 'Cartoon - On & On', artist: 'Daniel Levi', album: 'NCS Release', bpm: 174, duration: 208, isEmbeddable: true }
  ],
  'R&B Sensuel': [
    { youtubeId: 'lbnoG2mHIes', title: 'Pony', artist: 'Ginuwine', album: 'Ginuwine...The Bachelor', bpm: 142, duration: 251, isEmbeddable: false },
    { youtubeId: 'waU75okJZq0', title: 'Earned It', artist: 'The Weeknd', album: 'Beauty Behind the Madness', bpm: 120, duration: 252, isEmbeddable: false },
    { youtubeId: 'O1OTWCd40Ls', title: 'Wicked Games', artist: 'The Weeknd', album: 'House of Balloons', bpm: 115, duration: 323, isEmbeddable: false }
  ],
  'Pop': [
    { youtubeId: 'DyDfgMOUjCI', title: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep', bpm: 135, duration: 194, isEmbeddable: false }
  ],
  // Styles ajoutés une fois la résolution du vrai genre (resolveDeezerGenre) devenue
  // fiable — juste quelques titres ici, dont le BPM est largement documenté
  // publiquement (valeurs couramment citées, pas une mesure officielle vérifiée
  // par mes soins). Le gros du travail pour ces styles repose sur Deezer, cette
  // base locale n'étant qu'un filet de secours hors-ligne, volontairement mince.
  'Techno': [
    { youtubeId: 'y6120QOlsfU', title: 'Sandstorm', artist: 'Darude', album: 'Before the Storm', bpm: 136, duration: 223, isEmbeddable: false }
  ],
  'Rap': [
    { youtubeId: '5qm8PH4xAss', title: 'In Da Club', artist: '50 Cent', album: 'Get Rich or Die Tryin\'', bpm: 90, duration: 193, isEmbeddable: false }
  ],
  'Latino': [
    { youtubeId: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi', album: 'Vida', bpm: 89, duration: 229, isEmbeddable: false }
  ],
  'Jazz': [
    { youtubeId: 'vmDDOFXSgAs', title: 'Take Five', artist: 'Dave Brubeck', album: 'Time Out', bpm: 176, duration: 324, isEmbeddable: false }
  ],
  'Reggae': [
    { youtubeId: 'a3nfmqwqrqQ', title: 'No Woman, No Cry', artist: 'Bob Marley & The Wailers', album: 'Legend', bpm: 76, duration: 259, isEmbeddable: false }
  ],
  // Lot ajouté après recherche web croisée (SongBPM + GetSongBPM + Tunebat pour
  // chaque titre, BPM retenu quand au moins 2-3 sources s'accordaient) — Country
  // n'avait jusqu'ici AUCUNE entrée locale. `youtubeId` volontairement en format
  // "local-xxx" plutôt qu'un vrai ID YouTube : je ne peux pas vérifier depuis cet
  // environnement qu'un ID mémorisé correspond bien à la bonne vidéo, et
  // `isEmbeddable: false` de toute façon pour tous (pas d'extrait audio pour ces
  // titres locaux, comme le reste de cette base) — le champ ne sert ici qu'à la
  // déduplication interne, pas à un lecteur intégré. BPM = valeur commune retenue,
  // pas une mesure officielle vérifiée par mes soins (même réserve que le reste
  // de DATABASE_MUSIQUES).
  'Country': [
    { youtubeId: 'local-country-01', title: 'Wagon Wheel', artist: 'Old Crow Medicine Show', album: 'O.C.M.S.', bpm: 145, duration: 232, isEmbeddable: false },
    { youtubeId: 'local-country-02', title: 'Before He Cheats', artist: 'Carrie Underwood', album: 'Some Hearts', bpm: 147, duration: 200, isEmbeddable: false },
    { youtubeId: 'local-country-03', title: 'Chicken Fried', artist: 'Zac Brown Band', album: 'The Foundation', bpm: 170, duration: 238, isEmbeddable: false },
    { youtubeId: 'local-country-04', title: 'Jolene', artist: 'Dolly Parton', album: 'Jolene', bpm: 111, duration: 163, isEmbeddable: false },
    { youtubeId: 'local-country-05', title: 'Friends in Low Places', artist: 'Garth Brooks', album: 'No Fences', bpm: 108, duration: 260, isEmbeddable: false },
    { youtubeId: 'local-country-06', title: 'Take Me Home, Country Roads', artist: 'John Denver', album: 'Poems, Prayers & Promises', bpm: 82, duration: 188, isEmbeddable: false },
    { youtubeId: 'local-country-07', title: 'Body Like A Back Road', artist: 'Sam Hunt', album: 'Southside', bpm: 99, duration: 164, isEmbeddable: false },
    { youtubeId: 'local-country-08', title: 'Cruise', artist: 'Florida Georgia Line', album: "Here's To The Good Times", bpm: 148, duration: 208, isEmbeddable: false }
  ],
  // Pas d'entrée locale pour "Classique" : une œuvre classique n'a en général pas
  // de BPM fixe unique (le tempo varie dans le morceau lui-même), contrairement à
  // une chanson pop/rock standard — inventer une valeur serait trompeur. Ce genre
  // repose donc entièrement sur la résolution Deezer, sans filet de secours local.
  'Autre': [
    { youtubeId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', album: 'Whenever You Need Somebody', bpm: 113, duration: 212, isEmbeddable: true }
  ]
};
// "R&B" (genre standard général) réutilise les mêmes titres que "R&B Sensuel"
// (mode Intime) plutôt que d'en dupliquer — ce sont déjà de vrais titres R&B.
DATABASE_MUSIQUES['R&B'] = DATABASE_MUSIQUES['R&B Sensuel'];

// Liste des styles proposés à la génération/aux favoris — étendue maintenant que
// la résolution du vrai genre (resolveDeezerGenre) est fiable : plus besoin de se
// limiter à une poignée de styles "sûrs", Deezer peut chercher correctement sur
// bien plus de genres. Le mode Intime garde une sélection plus restreinte et
// cohérente avec son thème (styles au tempo posé/sensuel), pas une simple copie
// de la liste standard.
// Liste alignée sur la vraie taxonomie de genres de Deezer (vérifiée via leur
// documentation officielle des catégories/genres) plutôt que sur une sélection
// choisie à la main sans vérification, comme c'était le cas avant. Deezer expose
// en réalité ~20 catégories (Musique africaine, Musique asiatique, Blues, Musique
// brésilienne, Classique, Country, Dance & EDM, Électronique, Folk, Indie, Jazz,
// K-pop, Musique latine, Métal, Pop, R&B, Rap, Reggae, Rock, Soul & Funk, Bandes
// originales) — on n'en reprend ici qu'un sous-ensemble plus large qu'avant, pour
// ne pas rendre le sélecteur illisible avec 20 chips. "Rap" remplace "Hip-Hop"
// pour coller au nom réel utilisé par Deezer.
const STANDARD_GENRES = ['Métal', 'Rock', 'Electro', 'Pop', 'Rap', 'Autre'];
const NAUGHTY_GENRES = ['R&B Sensuel', 'Pop', 'Latino', 'Jazz', 'Autre'];
// Reste de la vraie taxonomie Deezer (~20 catégories, voir commentaire ci-dessus),
// masqué par défaut derrière le bouton "Plus de genres" pour ne pas surcharger le
// sélecteur principal. Uniquement en mode standard : le mode Intime garde sa liste
// restreinte et cohérente avec son thème, pas d'extension ici.
// Critère de tri principal/secondaire : pertinence pour un usage SPORTIF (tempo
// naturellement élevé/dynamique, genres effectivement utilisés en musculation/course),
// pas juste "existait déjà dans une vieille liste écrite à la main". Techno, R&B,
// Reggae, Country, Jazz et Latino sont de vrais genres avec un filet de secours local
// (DATABASE_MUSIQUES) mais un usage sport plus marginal — d'où leur place ici plutôt
// qu'en principal.
// ⚠️ Limite honnête : contrairement à Techno/R&B/Reggae/Country/Jazz/Latino, les
// genres suivants (Musique africaine → Bandes originales) n'ont PAS d'entrée dans
// DATABASE_MUSIQUES (aucun titre de secours hors-ligne écrit à la main). Ils reposent
// donc entièrement sur Deezer/GetSongBPM ; si les deux sont hors service, le filet de
// secours retombera sur la base locale "Pop" plutôt que sur le genre demandé —
// comportement déjà existant pour tout genre absent de la base, pas une régression
// introduite ici.
const EXTRA_GENRES = ['Techno', 'R&B', 'Reggae', 'Country', 'Jazz', 'Latino', 'Musique africaine', 'Musique asiatique', 'Blues', 'Musique brésilienne', 'Classique', 'Dance & EDM', 'Folk', 'Indie', 'K-pop', 'Soul & Funk', 'Bandes originales'];

// Correspondance approximative entre les genres internes de l'app et des mots-clés
// Deezer (recherche floue) — voir le détail de cette limite dans searchTracksByBpm.
const DEEZER_GENRE_KEYWORDS = {
  'Métal': 'metal', 'Rock': 'rock', 'Electro': 'electro', 'Techno': 'techno',
  'Pop': 'pop', 'Rap': 'rap', 'Latino': 'latino', 'Jazz': 'jazz',
  'R&B': 'rnb', 'Reggae': 'reggae', 'Country': 'country',
  'R&B Sensuel': 'rnb', 'Autre': '',
  // Mots-clés pour les genres du bouton "Plus de genres" (EXTRA_GENRES) — recherche
  // floue par mot-clé, comme pour les genres standards, pas la vraie taxonomie exacte.
  'Musique africaine': 'african', 'Musique asiatique': 'asian', 'Blues': 'blues',
  'Musique brésilienne': 'brazilian', 'Classique': 'classical', 'Dance & EDM': 'dance',
  'Folk': 'folk', 'Indie': 'indie', 'K-pop': 'k-pop', 'Soul & Funk': 'soul',
  'Bandes originales': 'soundtrack'
};

/**
 * Avertissement sur la profondeur du filet de secours LOCAL (`DATABASE_MUSIQUES`)
 * pour un genre donné — affiché en infobulle sur les sélecteurs de genre. Porte
 * UNIQUEMENT sur la base locale statique, jamais sur le catalogue Deezer réel :
 * impossible de connaître la profondeur exploitable de Deezer pour un genre/BPM
 * donné sans lancer une vraie recherche (voir la discussion sur les limites de
 * l'API), donc ce texte ne prétend jamais que "Deezer manque de titres" — juste
 * que le filet de secours hors-ligne est mince ou absent pour ce style.
 */
const getGenreLocalDepthWarning = (genre) => {
  const count = (DATABASE_MUSIQUES[genre] || []).length;
  if (count === 0) return "Aucun titre de secours local pour ce genre : si Deezer est indisponible ou n'a pas de BPM fiable pour ce style, la génération peut échouer à bien remplir ce style.";
  if (count <= 2) return `Seulement ${count} titre${count > 1 ? 's' : ''} de secours local pour ce genre — filet de sécurité très limité si Deezer est indisponible.`;
  return null;
};

export {
  DATABASE_MUSIQUES,
  STANDARD_GENRES,
  NAUGHTY_GENRES,
  EXTRA_GENRES,
  DEEZER_GENRE_KEYWORDS,
  getGenreLocalDepthWarning
};
