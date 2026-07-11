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
    { youtubeId: 'local-metal-09', title: 'Paranoid', artist: 'Black Sabbath', album: 'Paranoid', bpm: 163, duration: 168, isEmbeddable: false },
    // Deuxième lot, ciblé cette fois sur la zone 140-210 BPM — sous-représentée
    // dans le premier lot (volontairement étalé sur toute la plage), alors que
    // c'est la zone la plus testée en pratique (course à pied rapide/HIIT).
    { youtubeId: 'local-metal-10', title: 'Cochise', artist: 'Audioslave', album: 'Audioslave', bpm: 160, duration: 222, isEmbeddable: false },
    { youtubeId: 'local-metal-11', title: 'B.Y.O.B.', artist: 'System Of A Down', album: 'Mezmerize', bpm: 204, duration: 257, isEmbeddable: false },
    { youtubeId: 'local-metal-12', title: 'Cult of Personality', artist: 'Living Colour', album: 'Vivid', bpm: 184, duration: 293, isEmbeddable: false },
    { youtubeId: 'local-metal-13', title: 'Wait and Bleed', artist: 'Slipknot', album: 'Slipknot', bpm: 186, duration: 148, isEmbeddable: false }
  ],
  // Lot dense ajouté sur demande explicite ("le catalogue le plus dense possible
  // en un message") — méthode DIFFÉRENTE des lots précédents (Country, Métal) :
  // pas de recherche web croisée titre par titre ici, ce qui aurait pris des
  // dizaines de recherches et rendu un gros lot en un seul message impossible.
  // À la place : connaissance générale (genre + tempo approximatif), avec le
  // nouveau filet de vérification Deezer (`verifyAndEnrichLocalTrack`) comme
  // garde-fou — un titre dont le BPM est trop éloigné de la réalité sera écarté
  // à la génération plutôt qu'utilisé à tort. Le GENRE, en revanche, n'est PAS
  // revérifié automatiquement (les titres locaux sont considérés comme "genre de
  // confiance" par construction) — classification sur laquelle j'ai une vraie
  // confiance, contrairement aux valeurs de BPM précises à la décimale près.
  'Rock': [
    { youtubeId: 'hTWKbfoikeg', title: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', bpm: 116, duration: 301, isEmbeddable: false },
    { youtubeId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', bpm: 148, duration: 222, isEmbeddable: false },
    { youtubeId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', album: 'The Razors Edge', bpm: 133, duration: 292, isEmbeddable: false },
    { youtubeId: 'local-rock-01', title: "Sweet Child O' Mine", artist: "Guns N' Roses", album: 'Appetite for Destruction', bpm: 125, duration: 356, isEmbeddable: false },
    { youtubeId: 'local-rock-02', title: "Livin' on a Prayer", artist: 'Bon Jovi', album: 'Slippery When Wet', bpm: 123, duration: 249, isEmbeddable: false },
    { youtubeId: 'local-rock-03', title: 'Should I Stay or Should I Go', artist: 'The Clash', album: 'Combat Rock', bpm: 112, duration: 184, isEmbeddable: false },
    { youtubeId: 'local-rock-04', title: 'Highway to Hell', artist: 'AC/DC', album: 'Highway to Hell', bpm: 116, duration: 208, isEmbeddable: false },
    { youtubeId: 'local-rock-05', title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', album: 'Second Helping', bpm: 98, duration: 284, isEmbeddable: false },
    { youtubeId: 'local-rock-06', title: 'Born to Run', artist: 'Bruce Springsteen', album: 'Born to Run', bpm: 147, duration: 271, isEmbeddable: false },
    { youtubeId: 'local-rock-07', title: 'Eye of the Tiger', artist: 'Survivor', album: "Eye of the Tiger", bpm: 109, duration: 245, isEmbeddable: false },
    { youtubeId: 'local-rock-08', title: 'Jump', artist: 'Van Halen', album: '1984', bpm: 129, duration: 241, isEmbeddable: false },
    { youtubeId: 'local-rock-09', title: 'Dream On', artist: 'Aerosmith', album: 'Aerosmith', bpm: 84, duration: 267, isEmbeddable: false },
    { youtubeId: 'local-rock-10', title: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions', bpm: 136, duration: 186, isEmbeddable: false },
    { youtubeId: 'local-rock-11', title: 'Seven Nation Army', artist: 'The White Stripes', album: 'Elephant', bpm: 124, duration: 231, isEmbeddable: false },
    { youtubeId: 'local-rock-12', title: 'Basket Case', artist: 'Green Day', album: 'Dookie', bpm: 170, duration: 181, isEmbeddable: false },
    { youtubeId: 'local-rock-13', title: 'American Idiot', artist: 'Green Day', album: 'American Idiot', bpm: 189, duration: 174, isEmbeddable: false },
    { youtubeId: 'local-rock-14', title: 'Song 2', artist: 'Blur', album: 'Blur', bpm: 149, duration: 122, isEmbeddable: false },
    { youtubeId: 'local-rock-15', title: 'Are You Gonna Go My Way', artist: 'Lenny Kravitz', album: 'Are You Gonna Go My Way', bpm: 121, duration: 227, isEmbeddable: false }
  ],
  'Electro': [
    { youtubeId: '5NV6Rdv1a3I', title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories', bpm: 116, duration: 248, isEmbeddable: false },
    { youtubeId: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', bpm: 171, duration: 240, isEmbeddable: false },
    { youtubeId: 'YykjpeuMNEk', title: 'Animals', artist: 'Martin Garrix', album: 'Gold Skies', bpm: 128, duration: 195, isEmbeddable: false },
    { youtubeId: 'K4DyBUG242c', title: 'Cartoon - On & On', artist: 'Daniel Levi', album: 'NCS Release', bpm: 174, duration: 208, isEmbeddable: true },
    { youtubeId: 'local-electro-01', title: 'Levels', artist: 'Avicii', album: 'Levels', bpm: 126, duration: 203, isEmbeddable: false },
    { youtubeId: 'local-electro-02', title: 'Titanium', artist: 'David Guetta ft. Sia', album: 'Nothing but the Beat', bpm: 126, duration: 245, isEmbeddable: false },
    { youtubeId: 'local-electro-03', title: 'Wake Me Up', artist: 'Avicii', album: 'True', bpm: 124, duration: 247, isEmbeddable: false },
    { youtubeId: 'local-electro-04', title: 'One More Time', artist: 'Daft Punk', album: 'Discovery', bpm: 123, duration: 320, isEmbeddable: false },
    { youtubeId: 'local-electro-05', title: 'Clarity', artist: 'Zedd ft. Foxes', album: 'Clarity', bpm: 128, duration: 271, isEmbeddable: false },
    { youtubeId: 'local-electro-06', title: "Don't You Worry Child", artist: 'Swedish House Mafia', album: 'Until Now', bpm: 129, duration: 213, isEmbeddable: false },
    { youtubeId: 'local-electro-07', title: 'Turn Down for What', artist: 'DJ Snake & Lil Jon', album: 'Turn Down for What', bpm: 100, duration: 213, isEmbeddable: false },
    { youtubeId: 'local-electro-08', title: 'This Is What You Came For', artist: 'Calvin Harris ft. Rihanna', album: 'This Is What You Came For', bpm: 121, duration: 222, isEmbeddable: false },
    { youtubeId: 'local-electro-09', title: 'Summer', artist: 'Calvin Harris', album: 'Motion', bpm: 128, duration: 224, isEmbeddable: false },
    { youtubeId: 'local-electro-10', title: 'Feel So Close', artist: 'Calvin Harris', album: ' 18 Months', bpm: 128, duration: 217, isEmbeddable: false },
    { youtubeId: 'local-electro-11', title: 'Alive', artist: 'Krewella', album: 'Get Wet', bpm: 128, duration: 210, isEmbeddable: false },
    { youtubeId: 'local-electro-12', title: 'Tsunami', artist: 'DVBBS & Borgeous', album: 'Tsunami', bpm: 128, duration: 243, isEmbeddable: false }
  ],
  'R&B Sensuel': [
    { youtubeId: 'lbnoG2mHIes', title: 'Pony', artist: 'Ginuwine', album: 'Ginuwine...The Bachelor', bpm: 142, duration: 251, isEmbeddable: false },
    { youtubeId: 'waU75okJZq0', title: 'Earned It', artist: 'The Weeknd', album: 'Beauty Behind the Madness', bpm: 120, duration: 252, isEmbeddable: false },
    { youtubeId: 'O1OTWCd40Ls', title: 'Wicked Games', artist: 'The Weeknd', album: 'House of Balloons', bpm: 115, duration: 323, isEmbeddable: false },
    { youtubeId: 'local-rnb-01', title: 'Crazy In Love', artist: 'Beyoncé ft. Jay-Z', album: 'Dangerously in Love', bpm: 99, duration: 236, isEmbeddable: false },
    { youtubeId: 'local-rnb-02', title: 'No Scrubs', artist: 'TLC', album: 'FanMail', bpm: 82, duration: 214, isEmbeddable: false },
    { youtubeId: 'local-rnb-03', title: 'Say My Name', artist: "Destiny's Child", album: 'The Writing\'s on the Wall', bpm: 138, duration: 271, isEmbeddable: false },
    { youtubeId: 'local-rnb-04', title: 'Rude Boy', artist: 'Rihanna', album: 'Rated R', bpm: 105, duration: 223, isEmbeddable: false },
    { youtubeId: 'local-rnb-05', title: 'Adorn', artist: 'Miguel', album: 'Kaleidoscope Dream', bpm: 96, duration: 244, isEmbeddable: false }
  ],
  'Pop': [
    { youtubeId: 'DyDfgMOUjCI', title: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep', bpm: 135, duration: 194, isEmbeddable: false },
    { youtubeId: 'local-pop-01', title: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)', bpm: 96, duration: 233, isEmbeddable: false },
    { youtubeId: 'local-pop-02', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', album: 'Uptown Special', bpm: 115, duration: 270, isEmbeddable: false },
    { youtubeId: 'local-pop-03', title: "Can't Stop the Feeling!", artist: 'Justin Timberlake', album: 'Trolls Soundtrack', bpm: 113, duration: 236, isEmbeddable: false },
    { youtubeId: 'local-pop-04', title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', bpm: 103, duration: 203, isEmbeddable: false },
    { youtubeId: 'local-pop-05', title: 'Watermelon Sugar', artist: 'Harry Styles', album: 'Fine Line', bpm: 95, duration: 174, isEmbeddable: false },
    { youtubeId: 'local-pop-06', title: "Don't Start Now", artist: 'Dua Lipa', album: 'Future Nostalgia', bpm: 124, duration: 183, isEmbeddable: false },
    { youtubeId: 'local-pop-07', title: 'As It Was', artist: 'Harry Styles', album: "Harry's House", bpm: 174, duration: 167, isEmbeddable: false },
    { youtubeId: 'local-pop-08', title: 'Blank Space', artist: 'Taylor Swift', album: '1989', bpm: 96, duration: 231, isEmbeddable: false },
    { youtubeId: 'local-pop-09', title: 'Shake It Off', artist: 'Taylor Swift', album: '1989', bpm: 160, duration: 219, isEmbeddable: false },
    { youtubeId: 'local-pop-10', title: 'Firework', artist: 'Katy Perry', album: 'Teenage Dream', bpm: 124, duration: 227, isEmbeddable: false },
    { youtubeId: 'local-pop-11', title: 'Happy', artist: 'Pharrell Williams', album: 'G I R L', bpm: 160, duration: 233, isEmbeddable: false },
    { youtubeId: 'local-pop-12', title: 'Sunflower', artist: 'Post Malone & Swae Lee', album: 'Spider-Man: Into the Spider-Verse', bpm: 90, duration: 158, isEmbeddable: false }
  ],
  'Techno': [
    { youtubeId: 'y6120QOlsfU', title: 'Sandstorm', artist: 'Darude', album: 'Before the Storm', bpm: 136, duration: 223, isEmbeddable: false },
    { youtubeId: 'local-techno-01', title: "Ghosts 'n' Stuff", artist: 'Deadmau5', album: 'For Lack of a Better Name', bpm: 128, duration: 234, isEmbeddable: false },
    { youtubeId: 'local-techno-02', title: 'Da Funk', artist: 'Daft Punk', album: 'Homework', bpm: 108, duration: 337, isEmbeddable: false },
    { youtubeId: 'local-techno-03', title: 'Children', artist: 'Robert Miles', album: 'Dreamland', bpm: 138, duration: 320, isEmbeddable: false },
    { youtubeId: 'local-techno-04', title: 'Adagio for Strings', artist: 'Tiësto', album: 'In Search of Sunrise', bpm: 138, duration: 340, isEmbeddable: false },
    { youtubeId: 'local-techno-05', title: 'The Rockafeller Skank', artist: 'Fatboy Slim', album: "You've Come a Long Way, Baby", bpm: 118, duration: 331, isEmbeddable: false },
    { youtubeId: 'local-techno-06', title: 'One (Your Name)', artist: 'Swedish House Mafia', album: 'One', bpm: 128, duration: 337, isEmbeddable: false },
    { youtubeId: 'local-techno-07', title: 'Satisfaction', artist: 'Benny Benassi', album: 'Hypnotica', bpm: 128, duration: 224, isEmbeddable: false }
  ],
  'Rap': [
    { youtubeId: '5qm8PH4xAss', title: 'In Da Club', artist: '50 Cent', album: 'Get Rich or Die Tryin\'', bpm: 90, duration: 193, isEmbeddable: false },
    { youtubeId: 'local-rap-01', title: 'Lose Yourself', artist: 'Eminem', album: '8 Mile Soundtrack', bpm: 171, duration: 326, isEmbeddable: false },
    { youtubeId: 'local-rap-02', title: 'HUMBLE.', artist: 'Kendrick Lamar', album: 'DAMN.', bpm: 150, duration: 177, isEmbeddable: false },
    { youtubeId: 'local-rap-03', title: 'SICKO MODE', artist: 'Travis Scott', album: 'Astroworld', bpm: 155, duration: 312, isEmbeddable: false },
    { youtubeId: 'local-rap-04', title: "God's Plan", artist: 'Drake', album: 'Scorpion', bpm: 77, duration: 198, isEmbeddable: false },
    { youtubeId: 'local-rap-05', title: 'Old Town Road', artist: 'Lil Nas X', album: '7', bpm: 136, duration: 113, isEmbeddable: false },
    { youtubeId: 'local-rap-06', title: 'Empire State of Mind', artist: 'Jay-Z ft. Alicia Keys', album: 'The Blueprint 3', bpm: 90, duration: 276, isEmbeddable: false },
    { youtubeId: 'local-rap-07', title: 'Mask Off', artist: 'Future', album: 'FUTURE', bpm: 150, duration: 205, isEmbeddable: false },
    { youtubeId: 'local-rap-08', title: 'rockstar', artist: 'Post Malone ft. 21 Savage', album: "Beerbongs & Bentleys", bpm: 80, duration: 218, isEmbeddable: false }
  ],
  'Latino': [
    { youtubeId: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi', album: 'Vida', bpm: 89, duration: 229, isEmbeddable: false },
    { youtubeId: 'local-latino-01', title: 'Bailando', artist: 'Enrique Iglesias', album: 'Sex and Love', bpm: 130, duration: 243, isEmbeddable: false },
    { youtubeId: 'local-latino-02', title: 'Danza Kuduro', artist: 'Don Omar ft. Lucenzo', album: 'Meet the Orphans', bpm: 130, duration: 200, isEmbeddable: false },
    { youtubeId: 'local-latino-03', title: 'Gasolina', artist: 'Daddy Yankee', album: 'Barrio Fino', bpm: 96, duration: 195, isEmbeddable: false },
    { youtubeId: 'local-latino-04', title: 'Vivir Mi Vida', artist: 'Marc Anthony', album: '3.0', bpm: 130, duration: 240, isEmbeddable: false },
    { youtubeId: 'local-latino-05', title: 'La Tortura', artist: 'Shakira ft. Alejandro Sanz', album: 'Fijación Oral, Vol. 1', bpm: 100, duration: 216, isEmbeddable: false },
    { youtubeId: 'local-latino-06', title: "Hips Don't Lie", artist: 'Shakira ft. Wyclef Jean', album: 'Oral Fixation, Vol. 2', bpm: 100, duration: 218, isEmbeddable: false },
    { youtubeId: 'local-latino-07', title: 'Livin\' la Vida Loca', artist: 'Ricky Martin', album: 'Ricky Martin', bpm: 100, duration: 241, isEmbeddable: false },
    { youtubeId: 'local-latino-08', title: 'Mi Gente', artist: 'J Balvin & Willy William', album: 'Mi Gente', bpm: 105, duration: 187, isEmbeddable: false }
  ],
  'Jazz': [
    { youtubeId: 'vmDDOFXSgAs', title: 'Take Five', artist: 'Dave Brubeck', album: 'Time Out', bpm: 176, duration: 324, isEmbeddable: false },
    { youtubeId: 'local-jazz-01', title: 'So What', artist: 'Miles Davis', album: 'Kind of Blue', bpm: 136, duration: 545, isEmbeddable: false },
    { youtubeId: 'local-jazz-02', title: 'Fly Me to the Moon', artist: 'Frank Sinatra', album: 'It Might as Well Be Swing', bpm: 120, duration: 148, isEmbeddable: false },
    { youtubeId: 'local-jazz-03', title: 'Feeling Good', artist: 'Nina Simone', album: "I Put a Spell on You", bpm: 80, duration: 176, isEmbeddable: false },
    { youtubeId: 'local-jazz-04', title: 'Take the A Train', artist: 'Duke Ellington', album: 'The Blanton-Webster Band', bpm: 190, duration: 197, isEmbeddable: false },
    { youtubeId: 'local-jazz-05', title: 'Cantaloupe Island', artist: 'Herbie Hancock', album: 'Empyrean Isles', bpm: 106, duration: 335, isEmbeddable: false },
    { youtubeId: 'local-jazz-06', title: 'Sing, Sing, Sing', artist: 'Benny Goodman', album: 'Live at Carnegie Hall', bpm: 176, duration: 542, isEmbeddable: false }
  ],
  'Reggae': [
    { youtubeId: 'a3nfmqwqrqQ', title: 'No Woman, No Cry', artist: 'Bob Marley & The Wailers', album: 'Legend', bpm: 76, duration: 259, isEmbeddable: false },
    { youtubeId: 'local-reggae-01', title: 'Three Little Birds', artist: 'Bob Marley & The Wailers', album: 'Exodus', bpm: 144, duration: 180, isEmbeddable: false },
    { youtubeId: 'local-reggae-02', title: 'Jamming', artist: 'Bob Marley & The Wailers', album: 'Exodus', bpm: 107, duration: 219, isEmbeddable: false },
    { youtubeId: 'local-reggae-03', title: 'Buffalo Soldier', artist: 'Bob Marley & The Wailers', album: 'Confrontation', bpm: 85, duration: 258, isEmbeddable: false },
    { youtubeId: 'local-reggae-04', title: 'Red Red Wine', artist: 'UB40', album: 'Labour of Love', bpm: 84, duration: 188, isEmbeddable: false },
    { youtubeId: 'local-reggae-05', title: 'Is This Love', artist: 'Bob Marley & The Wailers', album: 'Kaya', bpm: 68, duration: 231, isEmbeddable: false }
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
    { youtubeId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', album: 'Whenever You Need Somebody', bpm: 113, duration: 212, isEmbeddable: true },
    { youtubeId: 'local-autre-01', title: 'Sweet Caroline', artist: 'Neil Diamond', album: 'Brother Love\'s Travelling Salvation Show', bpm: 128, duration: 201, isEmbeddable: false },
    { youtubeId: 'local-autre-02', title: "Don't Stop Believin'", artist: 'Journey', album: 'Escape', bpm: 119, duration: 251, isEmbeddable: false },
    { youtubeId: 'local-autre-03', title: 'Mr. Blue Sky', artist: 'Electric Light Orchestra', album: 'Out of the Blue', bpm: 90, duration: 303, isEmbeddable: false }
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
