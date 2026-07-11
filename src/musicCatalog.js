/**
 * musicCatalog.js — Bibliothèque musicale de TempoFit, séparée de App.jsx.
 *
 * ARCHITECTURE (remplace l'ancienne base de titres codés en dur) : au lieu de
 * lister des CHANSONS précises avec un BPM/une durée devinés à la main,
 * `ARTIST_CATALOG` liste des ARTISTES représentatifs de chaque genre. Le moteur
 * (voir App.jsx, `searchArtistsForBpm`) interroge Deezer EN DIRECT pour ces
 * artistes, dans la fenêtre BPM demandée — le BPM, la durée et l'extrait audio
 * viennent tous réellement de Deezer, rien n'est à inventer.
 *
 * Pourquoi ce changement : la classification de GENRE par Deezer, au niveau du
 * TITRE, s'est révélée peu fiable en pratique (System of a Down classé "Rock"
 * et jamais "Metal", par exemple — voir GENRE_EQUIVALENCE_GROUPS dans App.jsx).
 * Mais l'appartenance à un genre au niveau de l'ARTISTE, elle, est beaucoup
 * plus fiable et stable ("Metallica fait du Metal" ne se discute pas), et
 * n'exige aucune vérification titre par titre — on l'obtient gratuitement en
 * choisissant soigneusement quels artistes représentent chaque genre.
 *
 * Limite honnête assumée : un artiste peut avoir un titre hors de son genre
 * habituel (ballade, featuring...) — le risque existe mais reste marginal
 * comparé à celui qu'on corrigeait avant (classification Deezer peu fiable au
 * niveau du titre, qui touchait une bien plus grande proportion des résultats).
 */

const ARTIST_CATALOG = {
  'Métal': [
    'Metallica', 'Slipknot', 'System Of A Down', 'Rammstein', 'Pantera', 'Slayer',
    'Black Sabbath', 'Judas Priest', 'Iron Maiden', 'Megadeth', 'Motörhead',
    'Disturbed', 'Korn', 'Drowning Pool', 'Rage Against the Machine', 'Dio',
    'Alice in Chains', 'Ozzy Osbourne', 'Deep Purple', 'Van Halen'
  ],
  'Rock': [
    'Nirvana', 'The Killers', 'AC/DC', "Guns N' Roses", 'Bon Jovi', 'Foo Fighters',
    'Green Day', 'Red Hot Chili Peppers', 'Led Zeppelin', 'The White Stripes',
    'Pearl Jam', 'Creed', 'Scorpions', 'Aerosmith', 'The Clash', 'Lynyrd Skynyrd',
    'Bruce Springsteen', 'Survivor', 'Blur', 'Lenny Kravitz'
  ],
  'Electro': [
    'Daft Punk', 'The Weeknd', 'Martin Garrix', 'Avicii', 'David Guetta', 'Zedd',
    'Swedish House Mafia', 'DJ Snake', 'Calvin Harris', 'Krewella', 'DVBBS'
  ],
  'R&B Sensuel': [
    'Ginuwine', 'The Weeknd', 'Beyoncé', 'TLC', "Destiny's Child", 'Rihanna',
    'Miguel', 'Khalid', 'Daniel Caesar', 'Alicia Keys', 'Drake', 'Mariah Carey'
  ],
  'Pop': [
    'Billie Eilish', 'Ed Sheeran', 'Bruno Mars', 'Justin Timberlake', 'Dua Lipa',
    'Harry Styles', 'Taylor Swift', 'Katy Perry', 'Pharrell Williams',
    'Post Malone', 'Lady Gaga', 'Miley Cyrus', 'Adele', 'Pitbull'
  ],
  'Techno': [
    'Darude', 'Deadmau5', 'Fatboy Slim', 'Robert Miles', 'Tiësto',
    'Benny Benassi', 'Faithless', "Gigi D'Agostino", 'Alice Deejay',
    'Scooter', 'Stardust', 'Robin S'
  ],
  'Rap': [
    '50 Cent', 'Eminem', 'Kendrick Lamar', 'Travis Scott', 'Drake', 'Lil Nas X',
    'Jay-Z', 'Future', 'Post Malone', 'Dr. Dre', '2Pac', 'The Notorious B.I.G.',
    'Kanye West', 'Linkin Park'
  ],
  'Latino': [
    'Luis Fonsi', 'Enrique Iglesias', 'Don Omar', 'Daddy Yankee', 'Marc Anthony',
    'Shakira', 'Ricky Martin', 'J Balvin', 'Maluma', 'Romeo Santos', 'DJ Snake'
  ],
  'Jazz': [
    'Dave Brubeck', 'Miles Davis', 'Frank Sinatra', 'Nina Simone', 'Duke Ellington',
    'Herbie Hancock', 'Weather Report', 'Glenn Miller', 'Sonny Rollins',
    'Cannonball Adderley', 'Dizzy Gillespie', 'Art Blakey', 'Horace Silver'
  ],
  'Reggae': [
    'Bob Marley & The Wailers', 'UB40', 'Boney M.', 'Musical Youth',
    'Desmond Dekker & The Aces', 'Jimmy Cliff', 'Althea & Donna', 'Junior Murvin',
    'Toots and the Maytals'
  ],
  'Country': [
    'Old Crow Medicine Show', 'Carrie Underwood', 'Zac Brown Band', 'Dolly Parton',
    'Garth Brooks', 'John Denver', 'Sam Hunt', 'Florida Georgia Line',
    'Billy Ray Cyrus', 'Brooks & Dunn', 'Shania Twain', 'Steve Earle',
    'The Charlie Daniels Band', 'Keith Urban', 'Jason Aldean'
  ],
  // Pas d'entrée pour "Classique" : une œuvre classique n'a en général pas de
  // BPM fixe unique (le tempo varie dans le morceau lui-même), et le concept
  // même d'"artiste" ne s'applique pas de la même façon (compositeur ≠
  // interprète ≠ orchestre). Une recherche par artiste/BPM serait trompeuse ici.
  'Classique': [],
  'Autre': [
    'Rick Astley', 'Toto', 'a-ha', 'Whitney Houston', 'ABBA',
    'The Black Eyed Peas', 'Katrina and the Waves', 'Earth, Wind & Fire',
    'Village People', 'Gloria Gaynor'
  ],
  // Artistes pour les genres du bouton "Plus de genres" (EXTRA_GENRES) —
  // profondeur volontairement plus légère (genres moins centraux à l'usage
  // sportif), mais couvre chacun au moins quelques artistes représentatifs.
  'Musique africaine': ['Master KG', 'Fela Kuti', '2Baba', 'Wizkid', 'Burna Boy', 'Davido', 'Rema'],
  'Musique asiatique': ['PSY', 'Kenshi Yonezu', 'Official HIGE DANdism', 'YOASOBI', 'GReeeeN'],
  'Blues': ['B.B. King', 'The Blues Brothers', 'Stevie Ray Vaughan', 'John Lee Hooker', 'Muddy Waters', "Howlin' Wolf", 'The Animals', 'Jimi Hendrix'],
  'Musique brésilienne': ["Sergio Mendes & Brasil '66", 'Michel Teló', 'Anitta', 'MC Fioti', 'Léo Santana'],
  'Dance & EDM': ['Dimitri Vegas & Like Mike', 'Skrillex', 'Deadmau5', 'Swedish House Mafia', 'Porter Robinson'],
  'Folk': ['Bob Dylan', 'The Byrds', 'The Lumineers', 'Of Monsters and Men', 'Mumford & Sons', 'Edward Sharpe & the Magnetic Zeros'],
  'Indie': ['Franz Ferdinand', 'The Strokes', 'The Killers', 'MGMT', 'Modest Mouse', 'Florence + the Machine', 'Phoenix'],
  'K-pop': ['BLACKPINK', 'BTS', 'TWICE', "Girls' Generation", 'EXO'],
  'Soul & Funk': ['Stevie Wonder', 'KC and the Sunshine Band', 'Chic', 'James Brown', 'Wild Cherry', 'Parliament', 'Commodores', 'Prince'],
  'Bandes originales': ['Kenny Loggins', 'Ray Parker Jr.', 'Klaus Badelt', 'Carl Douglas', 'Joe Esposito', 'Paul Engemann', 'Bill Conti', 'Irene Cara', 'Bonnie Tyler']
};
// "R&B" (genre standard général) réutilise les mêmes artistes que "R&B Sensuel"
// (mode Intime) plutôt que d'en dupliquer.
ARTIST_CATALOG['R&B'] = ARTIST_CATALOG['R&B Sensuel'];

// Liste des styles proposés à la génération/aux favoris.
const STANDARD_GENRES = ['Métal', 'Rock', 'Electro', 'Pop', 'Rap', 'Autre'];
const NAUGHTY_GENRES = ['R&B Sensuel', 'Pop', 'Latino', 'Jazz', 'Autre'];
const EXTRA_GENRES = ['Techno', 'R&B', 'Reggae', 'Country', 'Jazz', 'Latino', 'Musique africaine', 'Musique asiatique', 'Blues', 'Musique brésilienne', 'Classique', 'Dance & EDM', 'Folk', 'Indie', 'K-pop', 'Soul & Funk', 'Bandes originales'];

// Correspondance approximative entre les genres internes de l'app et des mots-clés
// Deezer (recherche floue) — voir le détail de cette limite dans searchTracksByBpm.
const DEEZER_GENRE_KEYWORDS = {
  'Métal': 'metal', 'Rock': 'rock', 'Electro': 'electro', 'Techno': 'techno',
  'Pop': 'pop', 'Rap': 'rap', 'Latino': 'latino', 'Jazz': 'jazz',
  'R&B': 'rnb', 'Reggae': 'reggae', 'Country': 'country',
  'R&B Sensuel': 'rnb', 'Autre': '',
  'Musique africaine': 'african', 'Musique asiatique': 'asian', 'Blues': 'blues',
  'Musique brésilienne': 'brazilian', 'Classique': 'classical', 'Dance & EDM': 'dance',
  'Folk': 'folk', 'Indie': 'indie', 'K-pop': 'k-pop', 'Soul & Funk': 'soul',
  'Bandes originales': 'soundtrack'
};

/**
 * Avertissement sur la profondeur du CATALOGUE D'ARTISTES pour un genre donné —
 * affiché en infobulle sur les sélecteurs de genre. Porte sur le nombre
 * d'artistes représentatifs listés, pas sur le nombre de titres (qui dépend
 * maintenant de la vraie discographie Deezer de ces artistes, pas d'une liste
 * figée) — un seul artiste avec une grande discographie peut suffire à couvrir
 * beaucoup de BPM différents, donc ce seuil est plus tolérant qu'avant.
 */
const getGenreLocalDepthWarning = (genre) => {
  const count = (ARTIST_CATALOG[genre] || []).length;
  if (count === 0) return "Aucun artiste de secours listé pour ce genre : si Deezer est indisponible ou n'a pas de BPM fiable pour ce style, la génération peut échouer à bien remplir ce style.";
  if (count <= 2) return `Seulement ${count} artiste${count > 1 ? 's' : ''} de secours listé${count > 1 ? 's' : ''} pour ce genre — filet de sécurité limité si la recherche généraliste ne suffit pas.`;
  return null;
};

/**
 * Genres traités comme équivalents pour la VÉRIFICATION uniquement (pas pour la
 * sélection dans l'UI, qui reste séparée) — constaté en pratique via les logs de
 * diagnostic : Deezer classe la quasi-totalité de ce qu'on appellerait "metal"
 * sous "Rock" dans son propre système de genres (System of a Down, Guns N'
 * Roses... tous résolus "Rock" chez Deezer, jamais "Metal"). Sans cette
 * équivalence, "Métal" seul devenait un genre presque impossible à satisfaire
 * strictement via Deezer, peu importe le nombre de pages explorées — pas un bug,
 * une vraie limite de la taxonomie Deezer par rapport à la nôtre. Choix assumé :
 * l'utilisateur garde de toute façon le contrôle via le BPM et le remplacement
 * manuel d'un titre si le résultat ne lui convient pas.
 */
const GENRE_EQUIVALENCE_GROUPS = {
  'Métal': ['metal', 'rock'],
  'Rock': ['rock', 'metal'],
};

/**
 * Correspondance DIRECTE entre le VRAI genre Deezer d'un titre (résolu via
 * resolveDeezerGenre) et le genre interne demandé (ex. "Métal", "Rap").
 * Comparaison tolérante (accents/casse ignorés, correspondance partielle dans un
 * sens ou l'autre) car les noms Deezer ne correspondent pas toujours exactement
 * aux nôtres (ex. Deezer catégorise parfois "Rap/Hip Hop" en un seul intitulé).
 * Ne tient PAS compte de GENRE_EQUIVALENCE_GROUPS — voir `genreRoughlyMatches`
 * pour la version élargie. Séparée pour permettre de prioriser les vrais matchs
 * (ceux-ci, ou le catalogue d'artistes) sur les matchs d'équivalence uniquement
 * (voir la sélection dans buildSegmentTracks, App.jsx).
 */
const isDirectGenreMatch = (realGenre, requestedGenre) => {
  if (!realGenre) return false;
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const real = normalize(realGenre);
  const requested = normalize(requestedGenre);
  const keyword = normalize(DEEZER_GENRE_KEYWORDS[requestedGenre] || requestedGenre);
  return real.includes(keyword) || keyword.includes(real) || real.includes(requested) || requested.includes(real);
};

/**
 * Version élargie de isDirectGenreMatch, qui accepte aussi les équivalences
 * définies dans GENRE_EQUIVALENCE_GROUPS (ex. Rock accepté pour une demande
 * Métal, vu que Deezer classe la quasi-totalité du metal en "Rock"). À utiliser
 * pour la validation finale (accepter/rejeter un candidat), PAS pour décider
 * quels candidats prioriser entre eux — voir buildSegmentTracks (App.jsx), où
 * les matchs directs sont préférés aux matchs d'équivalence quand les deux sont
 * disponibles.
 */
const genreRoughlyMatches = (realGenre, requestedGenre) => {
  if (isDirectGenreMatch(realGenre, requestedGenre)) return true;
  if (!realGenre) return false;
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const real = normalize(realGenre);
  const equivalents = GENRE_EQUIVALENCE_GROUPS[requestedGenre];
  return equivalents ? equivalents.some(eq => real.includes(eq) || eq.includes(real)) : false;
};

/**
 * Mots-clés dans le TITRE qui trahissent un style différent du genre demandé,
 * même si le genre_id Deezer de l'ALBUM dit le contraire (trouvé après un test
 * réel : "Let Her Go (Selecta Hardstyle Remix Edit)" accepté comme Métal/Rock
 * parce que l'album/artiste d'origine était classé ainsi chez Deezer — alors
 * que le titre indique explicitement un remix hardstyle, un style totalement
 * différent). Le genre_id d'album ne descend pas toujours au niveau du titre
 * précis ; le titre, lui, le dit souvent explicitement quand un remix/une
 * reprise change radicalement de style. Volontairement composé de mots-clés
 * SPÉCIFIQUES et univoques (pas juste "remix" seul, trop générique — un remix
 * peut très bien rester dans le même genre) pour éviter les faux positifs.
 */
const TITLE_STYLE_OVERRIDE_KEYWORDS = {
  'hardstyle': ['Techno', 'Electro', 'Dance & EDM'],
  'dubstep': ['Electro', 'Dance & EDM'],
  'gabber': ['Techno'],
  'acoustic': ['Folk'],
  'unplugged': ['Folk'],
  'a cappella': [],
  'piano version': ['Classique'],
  'orchestral version': ['Classique'],
  'salsa version': ['Latino'],
  'bachata version': ['Latino'],
  'reggae version': ['Reggae'],
  'reggae remix': ['Reggae'],
  'trap remix': ['Rap'],
  'jazz version': ['Jazz'],
  'lo-fi': [],
  'bluegrass version': ['Country', 'Folk']
};

/**
 * Détecte un conflit entre le TITRE d'un morceau et les genres demandés — voir
 * TITLE_STYLE_OVERRIDE_KEYWORDS. Retourne le mot-clé trouvé (pour le log) ou
 * `null` si aucun conflit. Un mot-clé associé à une liste VIDE (ex. "a cappella",
 * "lo-fi") signale toujours un conflit, quel que soit le genre demandé — ce sont
 * des styles qui ne collent structurellement à aucun de nos genres internes.
 */
const detectTitleStyleConflict = (title, requestedGenres) => {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const [keyword, impliedGenres] of Object.entries(TITLE_STYLE_OVERRIDE_KEYWORDS)) {
    if (t.includes(keyword)) {
      if (impliedGenres.length === 0) return keyword;
      const overlap = requestedGenres.some(rg => impliedGenres.some(ig => genreRoughlyMatches(ig, rg) || ig === rg));
      if (!overlap) return keyword;
    }
  }
  return null;
};

export {
  ARTIST_CATALOG,
  STANDARD_GENRES,
  NAUGHTY_GENRES,
  EXTRA_GENRES,
  DEEZER_GENRE_KEYWORDS,
  getGenreLocalDepthWarning,
  GENRE_EQUIVALENCE_GROUPS,
  isDirectGenreMatch,
  genreRoughlyMatches,
  TITLE_STYLE_OVERRIDE_KEYWORDS,
  detectTitleStyleConflict
};
