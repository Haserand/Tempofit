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
  'Métal': ['Metallica', 'Slipknot', 'System Of A Down', 'Rammstein', 'Pantera', 'Slayer', 'Black Sabbath', 'Judas Priest', 'Iron Maiden', 'Megadeth', 'Motörhead', 'Disturbed', 'Korn', 'Drowning Pool', 'Rage Against the Machine', 'Dio', 'Alice in Chains', 'Ozzy Osbourne', 'Deep Purple', 'Van Halen', 'Trivium', 'Lamb of God', 'Machine Head', 'Sepultura', 'Anthrax', 'Testament', 'Exodus', 'Death', 'Cannibal Corpse', 'Behemoth', 'Gojira', 'Mastodon', 'Opeth', 'Tool', 'Type O Negative', 'Danzig', 'Misfits', 'Ministry', 'Fear Factory', 'Nine Inch Nails', 'Marilyn Manson', 'White Zombie', 'Rob Zombie', 'Static-X', 'Mudvayne', 'Godsmack', 'Chevelle', 'Breaking Benjamin', 'Three Days Grace', 'Shinedown', 'Five Finger Death Punch', 'Bullet For My Valentine', 'Avenged Sevenfold', 'Killswitch Engage', 'As I Lay Dying', 'All That Remains', 'Whitechapel', 'Suicide Silence', 'Job for a Cowboy', 'Meshuggah', 'Between the Buried and Me', 'Periphery', 'Animals as Leaders', 'Deftones', 'Coal Chamber', 'Sevendust', 'Papa Roach', 'Limp Bizkit', 'P.O.D.', 'Yngwie Malmsteen', 'Dream Theater', 'Symphony X', 'Nightwish', 'Within Temptation', 'Epica', 'Kamelot', 'Blind Guardian', 'Helloween', 'Gamma Ray', 'Stratovarius', 'Sonata Arctica', 'Rhapsody of Fire', 'Amon Amarth', 'Arch Enemy', 'In Flames', 'Dark Tranquillity', 'At the Gates', 'Soilwork', 'Children of Bodom', 'Bring Me the Horizon', 'Architects', 'Parkway Drive', 'The Ghost Inside', 'Every Time I Die', 'Underoath', 'Norma Jean', 'Converge', 'The Dillinger Escape Plan', 'Cradle of Filth', 'Dimmu Borgir', 'Emperor', 'Mayhem', 'Immortal', 'Venom', 'Celtic Frost', 'Bathory', 'Kreator', 'Sodom', 'Destruction', 'Overkill', 'Death Angel', 'Suicidal Tendencies', 'Corrosion of Conformity', 'Down', 'Crowbar', 'Eyehategod', 'High on Fire', 'Kyuss', 'Clutch', 'Baroness'],
  'Rock': ['Nirvana', 'The Killers', 'AC/DC', 'Guns N\' Roses', 'Bon Jovi', 'Foo Fighters', 'Green Day', 'Red Hot Chili Peppers', 'Led Zeppelin', 'The White Stripes', 'Pearl Jam', 'Creed', 'Scorpions', 'Aerosmith', 'The Clash', 'Lynyrd Skynyrd', 'Bruce Springsteen', 'Survivor', 'Blur', 'Lenny Kravitz', 'Queen', 'The Rolling Stones', 'The Beatles', 'Pink Floyd', 'The Who', 'David Bowie', 'Fleetwood Mac', 'Eagles', 'Def Leppard', 'Journey', 'Boston', 'Foreigner', 'Kansas', 'Styx', 'Rush', 'Yes', 'Genesis', 'The Doors', 'Creedence Clearwater Revival', 'The Beach Boys', 'Simon & Garfunkel', 'Eric Clapton', 'Jimi Hendrix Experience', 'Cream', 'Traffic', 'The Allman Brothers Band', 'ZZ Top', 'The Cars', 'Talking Heads', 'Devo', 'The Police', 'U2', 'R.E.M.', 'INXS', 'The Cure', 'Depeche Mode', 'Duran Duran', 'Tears for Fears', 'Oasis', 'Radiohead', 'Coldplay', 'Muse', 'Arctic Monkeys', 'Kasabian', 'The Vaccines', 'Kings of Leon', 'Weezer', 'Third Eye Blind', 'Matchbox Twenty', 'Train', 'OneRepublic', 'Fall Out Boy', 'Panic! at the Disco', 'My Chemical Romance', 'Paramore', 'All Time Low', 'blink-182', 'Sum 41', 'Good Charlotte', 'Simple Plan', 'Yellowcard', 'New Found Glory', 'Jimmy Eat World', 'Taking Back Sunday', 'The All-American Rejects', 'Stone Temple Pilots', 'Soundgarden', 'Alice in Chains', 'Audioslave', 'Rage Against the Machine', 'Chili Peppers', 'Jane\'s Addiction', 'Faith No More', 'Living Colour', 'Extreme', 'Mr. Big', 'Whitesnake', 'Europe', 'Toto', 'Asia', 'The Cult', 'The Black Crowes', 'Tom Petty and the Heartbreakers', 'Bob Seger', 'John Mellencamp', 'Steve Miller Band'],
  'Electro': ['Daft Punk', 'The Weeknd', 'Martin Garrix', 'Avicii', 'David Guetta', 'Zedd', 'Swedish House Mafia', 'DJ Snake', 'Calvin Harris', 'Krewella', 'DVBBS', 'Skrillex', 'Deadmau5', 'Diplo', 'Marshmello', 'Kygo', 'Alan Walker', 'Martin Solveig', 'Steve Aoki', 'Hardwell', 'Afrojack', 'Nicky Romero', 'Don Diablo', 'Oliver Heldens', 'R3HAB', 'Tiësto', 'Armin van Buuren', 'Above & Beyond', 'Paul van Dyk', 'Ferry Corsten', 'Eric Prydz', 'deadmau5', 'Disclosure', 'Flume', 'ODESZA', 'Rufus Du Sol', 'Bonobo', 'Jamie xx', 'Four Tet', 'Caribou', 'Justice', 'Moby', 'The Chemical Brothers', 'Fatboy Slim', 'Basement Jaxx', 'Groove Armada', 'Underworld', 'Orbital', 'Aphex Twin', 'Boys Noize', 'Duke Dumont', 'Gorgon City', 'Route 94', 'MK', 'Solardo', 'Chris Lake', 'Fisher', 'Claptone', 'Camelphat', 'Black Coffee', 'Bicep', 'Peggy Gou', 'Charlotte de Witte', 'Amelie Lens', 'Chemical Brothers', 'Prodigy', 'Leftfield', 'Massive Attack', 'Portishead', 'Röyksopp', 'Ladytron', 'Metric', 'CHVRCHES', 'Purity Ring', 'Grimes', 'Crystal Castles', 'Kavinsky', 'M83', 'Cut Copy', 'Chromeo', 'Toro y Moi', 'Washed Out', 'Foster the People', 'MGMT', 'Passion Pit', 'Empire of the Sun', 'Zhu', 'Rezz', 'Illenium', 'Slander', 'Seven Lions', 'Excision', 'Getter', 'Ekali', 'San Holo', 'Whethan', 'Bob Sinclar', 'Cassius', 'Modjo', 'Stardust', 'Cerrone', 'Air', 'Booka Shade', 'Yuksek', 'Breakbot', 'Polo & Pan', 'L\'Impératrice', 'Fakear', 'Petit Biscuit', 'Videoclub', 'Vitalic', 'Etienne de Crécy', 'Laurent Garnier', 'Gesaffelstein', 'Superpoze', 'FKJ', 'Ofenbach', 'Feder', 'Mercer'],
  'R&B Sensuel': ['Ginuwine', 'The Weeknd', 'Beyoncé', 'TLC', 'Destiny\'s Child', 'Rihanna', 'Miguel', 'Khalid', 'Daniel Caesar', 'Alicia Keys', 'Drake', 'Mariah Carey', 'Usher', 'Chris Brown', 'Trey Songz', 'Ne-Yo', 'R. Kelly', 'Brian McKnight', 'Jodeci', 'Boyz II Men', 'Toni Braxton', 'Aaliyah', 'SZA', 'Jhené Aiko', 'H.E.R.', 'Summer Walker', 'Kehlani', 'Bryson Tiller', '6LACK', 'PARTYNEXTDOOR', 'Tank', 'Jagged Edge', '112', 'Dru Hill', 'Musiq Soulchild', 'Anthony Hamilton', 'Maxwell', 'D\'Angelo', 'Erykah Badu', 'Lauryn Hill', 'Mary J. Blige', 'Monica', 'Brandy', 'Ashanti', 'Faith Evans', 'Keyshia Cole', 'Jazmine Sullivan', 'Ella Mai', 'Teyana Taylor', 'Tinashe', 'Kelela', 'FKA twigs', 'Frank Ocean', 'The-Dream', 'Ty Dolla Sign', 'Jeremih', 'Giveon', 'Snoh Aalegra', 'Blxst', 'Muni Long', 'Lucky Daye', 'Emotional Oranges', 'Jorja Smith', 'Sampha', 'Sault', 'Amber Mark', 'Ravyn Lenae', 'Baby Rose', 'Yebba', 'Victoria Monét', 'Coco Jones', 'Sinéad Harnett', 'VanJess', 'Xavier Omar', 'dvsn', 'BJ the Chicago Kid', 'Eric Bellinger', 'Jacquees', 'August Alsina', 'Marvin Gaye', 'Al Green', 'Luther Vandross', 'Whitney Houston', 'Sade', 'Anita Baker', 'Chaka Khan', 'Patti LaBelle', 'Gladys Knight', 'Roberta Flack', 'Deniece Williams', 'Angela Bofill', 'Freddie Jackson', 'Peabo Bryson', 'Regina Belle', 'Vanessa Williams', 'Karyn White', 'Alexander O\'Neal', 'Cherrelle', 'Klymaxx', 'Ready for the World', 'Cameo', 'Zapp & Roger', 'The SOS Band', 'Atlantic Starr', 'Cheryl Lynn', 'Evelyn Champagne King', 'Stephanie Mills'],
  'Pop': ['Billie Eilish', 'Ed Sheeran', 'Bruno Mars', 'Justin Timberlake', 'Dua Lipa', 'Harry Styles', 'Taylor Swift', 'Katy Perry', 'Pharrell Williams', 'Post Malone', 'Lady Gaga', 'Miley Cyrus', 'Adele', 'Pitbull', 'Michael Jackson', 'Madonna', 'Whitney Houston', 'Mariah Carey', 'Celine Dion', 'Britney Spears', 'Christina Aguilera', 'Justin Bieber', 'Ariana Grande', 'Selena Gomez', 'Shawn Mendes', 'Camila Cabello', 'Sam Smith', 'Charlie Puth', 'Lorde', 'Sia', 'Rihanna', 'Beyoncé', 'Jennifer Lopez', 'Kylie Minogue', 'Robbie Williams', 'George Michael', 'Elton John', 'Cyndi Lauper', 'Cher', 'Tina Turner', 'Prince', 'George Ezra', 'James Bay', 'Jonas Brothers', 'One Direction', 'Backstreet Boys', 'NSYNC', 'Spice Girls', 'Take That', 'Westlife', 'Little Mix', 'Fifth Harmony', 'Meghan Trainor', 'Demi Lovato', 'Kesha', 'P!nk', 'Avril Lavigne', 'Gwen Stefani', 'No Doubt', 'Maroon 5', 'OneRepublic', 'Imagine Dragons', 'The 1975', 'Halsey', 'Olivia Rodrigo', 'Doja Cat', 'Lizzo', 'JoJo', 'Hilary Duff', 'Vanessa Hudgens', 'Skylar Grey', 'Bebe Rexha', 'Zara Larsson', 'Tove Lo', 'Anne-Marie', 'Jess Glynne', 'Mabel', 'Rita Ora', 'Girls Aloud', 'Sugababes', 'All Saints', 'S Club 7', 'Steps', 'Boyzone', '5 Seconds of Summer', 'The Vamps', 'McFly', 'McBusted', 'Busted', 'Hanson', 'Jesse McCartney', 'Aaron Carter', 'Nick Jonas', 'Joe Jonas', 'Cody Simpson', 'Austin Mahone', 'Bazzi', 'Alec Benjamin', 'Lauv', 'Jeremy Zucker', 'Conan Gray', 'Stromae', 'Christine and the Queens', 'Angèle', 'Zaz', 'Louane', 'Vianney', 'Julien Doré', 'Amir', 'Slimane', 'Vitaa', 'Kendji Girac', 'Aya Nakamura', 'Camélia Jordana', 'Jain', 'Clara Luciani', 'Pomme', 'Eddy de Pretto', 'Grand Corps Malade', 'M Pokora', 'Shy\'m', 'Tal', 'Yannick Noah', 'Patrick Bruel', 'Calogero', 'Christophe Maé', 'Zazie', 'Jenifer', 'Nolwenn Leroy', 'Cœur de Pirate'],
  'Techno': ['Darude', 'Deadmau5', 'Fatboy Slim', 'Robert Miles', 'Tiësto', 'Benny Benassi', 'Faithless', 'Gigi D\'Agostino', 'Alice Deejay', 'Scooter', 'Stardust', 'Robin S', 'Carl Cox', 'Richie Hawtin', 'Jeff Mills', 'Adam Beyer', 'Charlotte de Witte', 'Amelie Lens', 'Nina Kraviz', 'Sven Väth', 'Paul Kalkbrenner', 'Booka Shade', 'Marco Carola', 'Joseph Capriati', 'Chris Liebing', 'Ben Klock', 'Marcel Dettmann', 'Recondite', 'Dixon', 'Solomun', 'Tale Of Us', 'Maceo Plex', 'Bicep', 'Four Tet', 'Jamie Jones', 'Loco Dice', 'Seth Troxler', 'Green Velvet', 'Josh Wink', 'Laurent Garnier', 'Danny Tenaglia', 'Sasha', 'John Digweed', 'Kraftwerk', 'Aphex Twin', 'Squarepusher', 'Autechre', 'Boards of Canada', 'Plaid', 'The Prodigy', 'Underworld', 'Orbital', '808 State', 'LFO', 'Chemical Brothers', 'Leftfield', 'Basement Jaxx', 'Groove Armada', 'Fluke', 'Way Out West', 'BT', 'Paul Oakenfold', 'Sasha & Digweed', 'Danny Howells', 'Hernan Cattaneo', 'Nick Warren', 'James Zabiela', 'Eats Everything', 'Patrick Topping', 'Denney', 'wAFF', 'Hot Since 82', 'Speedy J', 'Dave Clarke', 'Surgeon', 'Regis', 'Blawan', 'Objekt', 'Helena Hauff', 'DVS1', 'Function', 'Truncate', 'Oscar Mulero', 'Reeko', 'Exium', 'Perc', 'Sunil Sharpe', 'Rrose', 'Donato Dozzy', 'Neel', 'Voices from the Lake', 'Marcel Fengler', 'Answer Code Request', 'SHXCXCHCXSH', 'Kobosil', 'I Hate Models', '999999999', 'Anetha', 'Farrago', 'Deborah De Luca', 'Ricardo Villalobos', 'Marco Faraone'],
  'Rap': ['50 Cent', 'Eminem', 'Kendrick Lamar', 'Travis Scott', 'Drake', 'Lil Nas X', 'Jay-Z', 'Future', 'Post Malone', 'Dr. Dre', '2Pac', 'The Notorious B.I.G.', 'Kanye West', 'Linkin Park', 'Snoop Dogg', 'Ice Cube', 'N.W.A', 'Wu-Tang Clan', 'Nas', 'Method Man', 'Redman', 'Busta Rhymes', 'LL Cool J', 'Run-D.M.C.', 'Public Enemy', 'A Tribe Called Quest', 'De La Soul', 'Outkast', 'Missy Elliott', 'Lil Wayne', 'T.I.', 'Rick Ross', 'Young Jeezy', 'Gucci Mane', 'Migos', '21 Savage', 'Lil Baby', 'DaBaby', 'Cardi B', 'Nicki Minaj', 'Megan Thee Stallion', 'J. Cole', 'Big Sean', 'Wale', 'Meek Mill', 'French Montana', 'Tyga', 'YG', 'Schoolboy Q', 'ASAP Rocky', 'ASAP Ferg', 'Playboi Carti', 'Juice WRLD', 'XXXTENTACION', 'Lil Peep', 'Mac Miller', 'Logic', 'NF', 'Tech N9ne', 'Xzibit', 'Warren G', 'Nate Dogg', 'Ludacris', 'Chamillionaire', 'Fat Joe', 'Big Pun', 'Common', 'Talib Kweli', 'Mos Def', 'Kid Cudi', 'Chance the Rapper', 'Vince Staples', 'Denzel Curry', 'Tyler, The Creator', 'Earl Sweatshirt', 'Odd Future', 'Lil Uzi Vert', 'Gunna', 'Lil Durk', 'Polo G', 'Roddy Ricch', 'G Herbo', 'Moneybagg Yo', 'Blueface', 'YoungBoy Never Broke Again', 'Rod Wave', 'NBA YoungBoy', 'Yeat', 'Ken Carson', 'Destroy Lonely', 'Trippie Redd', 'Lil Skies', 'Comethazine', '6ix9ine', 'Fivio Foreign', 'Pop Smoke', 'Dave East', 'Benny the Butcher', 'Griselda', 'Westside Gunn', 'Conway the Machine', 'Freddie Gibbs', 'Pusha T', 'Clipse', 'Danny Brown', 'Action Bronson', 'Joey Bada$$', 'Pro Era', 'Flatbush Zombies', 'Immortal Technique', 'Aesop Rock', 'MF DOOM', 'Madlib', 'J Dilla', 'DJ Premier', 'Booba', 'Jul', 'Nekfeu', 'Orelsan', 'PNL', 'Soprano', 'Maître Gims', 'Dadju', 'Vald', 'Damso', 'Niska', 'SCH', 'Freeze Corleone', 'Ninho', 'Naps', 'Gazo', 'Alpha Wann', 'Kaaris', 'La Fouine', 'Sexion d\'Assaut', 'Sniper', 'IAM', 'NTM', 'Diam\'s', 'MC Solaar', 'Bigflo & Oli', 'Lomepal', 'Hatik', 'Hamza', 'Josman'],
  'Latino': ['Luis Fonsi', 'Enrique Iglesias', 'Don Omar', 'Daddy Yankee', 'Marc Anthony', 'Shakira', 'Ricky Martin', 'J Balvin', 'Maluma', 'Romeo Santos', 'DJ Snake', 'Bad Bunny', 'Rosalía', 'Ozuna', 'Anuel AA', 'Karol G', 'Nicky Jam', 'Wisin & Yandel', 'Zion & Lennox', 'Farruko', 'Rauw Alejandro', 'Sech', 'Myke Towers', 'Peso Pluma', 'Grupo Firme', 'Christian Nodal', 'Los Tigres del Norte', 'Vicente Fernández', 'Juan Gabriel', 'Julio Iglesias', 'Chayanne', 'Alejandro Sanz', 'Juanes', 'Carlos Vives', 'Fonseca', 'Manu Chao', 'Gipsy Kings', 'Buena Vista Social Club', 'Celia Cruz', 'Tito Puente', 'Gloria Estefan', 'Jennifer Lopez', 'Thalía', 'Paulina Rubio', 'RBD', 'Belinda', 'CNCO', 'Prince Royce', 'Aventura', 'Feid', 'Ryan Castro', 'Jhayco', 'Arcangel', 'De La Ghetto', 'Cosculluela', 'Kendo Kaponi', 'Tego Calderon', 'Wisin', 'Yandel', 'Zion', 'Lennox', 'Plan B', 'Alexis y Fido', 'Ivy Queen', 'La India', 'Milly Quezada', 'Elvis Crespo', 'Grupo Niche', 'Frankie Ruiz', 'Victor Manuelle', 'Gilberto Santa Rosa', 'Willie Colon', 'Hector Lavoe', 'Ruben Blades', 'Oscar D\'Leon', 'Los Van Van', 'Juan Luis Guerra', 'Xtreme', 'Toby Love', 'Grupo Extra', 'Silvestre Dangond', 'Diomedes Diaz', 'Los Ángeles Azules', 'Selena', 'La Arrolladora Banda El Limón', 'Banda MS', 'Calibre 50', 'Camilo', 'Sebastián Yatra', 'Manuel Turizo', 'Reik', 'Piso 21', 'Morat', 'Kali Uchis', 'Jay Wheeler', 'Lunay', 'Rvssian', 'Nio Garcia', 'Casper Magico', 'Bryant Myers', 'Darell', 'Cazzu', 'Nathy Peluso', 'Duki', 'Bizarrap', 'Trueno', 'Paulo Londra', 'Nicki Nicole', 'Maria Becerra', 'Tini', 'Emilia', 'Lali', 'Marama'],
  'Jazz': ['Dave Brubeck', 'Miles Davis', 'Frank Sinatra', 'Nina Simone', 'Duke Ellington', 'Herbie Hancock', 'Weather Report', 'Glenn Miller', 'Sonny Rollins', 'Cannonball Adderley', 'Dizzy Gillespie', 'Art Blakey', 'Horace Silver', 'John Coltrane', 'Charlie Parker', 'Louis Armstrong', 'Ella Fitzgerald', 'Billie Holiday', 'Thelonious Monk', 'Chet Baker', 'Bill Evans', 'Charles Mingus', 'Ornette Coleman', 'Wayne Shorter', 'Stan Getz', 'Art Tatum', 'Oscar Peterson', 'Count Basie', 'Benny Goodman', 'Django Reinhardt', 'Stéphane Grappelli', 'Chick Corea', 'Pat Metheny', 'Keith Jarrett', 'McCoy Tyner', 'Ron Carter', 'Wynton Marsalis', 'Branford Marsalis', 'Diana Krall', 'Norah Jones', 'Esperanza Spalding', 'Robert Glasper', 'Kamasi Washington', 'Gregory Porter', 'Jamie Cullum', 'Michael Bublé', 'Harry Connick Jr.', 'Nat King Cole', 'Sarah Vaughan', 'Dinah Washington', 'Fats Waller', 'Lionel Hampton', 'Stan Kenton', 'Woody Herman', 'Tommy Dorsey', 'Artie Shaw', 'Cab Calloway', 'Fats Domino', 'Erroll Garner', 'Bud Powell', 'Dexter Gordon', 'Coleman Hawkins', 'Lester Young', 'Ben Webster', 'Johnny Hodges', 'Roy Eldridge', 'Clifford Brown', 'Freddie Hubbard', 'Lee Morgan', 'Woody Shaw', 'Donald Byrd', 'Jackie McLean', 'Eric Dolphy', 'Yusef Lateef', 'Pharoah Sanders', 'Albert Ayler', 'Sun Ra', 'Charles Lloyd', 'Joe Henderson', 'Grover Washington Jr.', 'David Sanborn', 'Kenny G', 'Chuck Mangione', 'Spyro Gyra', 'Return to Forever', 'Mahavishnu Orchestra', 'Herbie Hancock\'s Headhunters', 'Steely Dan', 'Blood Sweat & Tears', 'Wes Montgomery', 'Grant Green', 'Joe Pass', 'Jim Hall', 'George Benson', 'Pat Martino', 'Kenny Burrell', 'Barney Kessel', 'Tal Farlow', 'Django Reinhardt Quintet', 'Stephane Grappelli Trio', 'Bill Frisell', 'John Scofield', 'Mike Stern', 'Al Di Meola', 'John McLaughlin', 'Larry Carlton', 'Lee Ritenour', 'Earl Klugh', 'Bob James', 'Ramsey Lewis', 'Vince Guaraldi', 'Ahmad Jamal', 'Erroll Garner Trio', 'Red Garland', 'Wynton Kelly', 'Tommy Flanagan', 'Barry Harris', 'Cedar Walton', 'Mulgrew Miller'],
  'Reggae': ['Bob Marley & The Wailers', 'UB40', 'Boney M.', 'Musical Youth', 'Desmond Dekker & The Aces', 'Jimmy Cliff', 'Althea & Donna', 'Junior Murvin', 'Toots and the Maytals', 'Peter Tosh', 'Burning Spear', 'Black Uhuru', 'Steel Pulse', 'Third World', 'Culture', 'Israel Vibration', 'Gregory Isaacs', 'Dennis Brown', 'Sizzla', 'Capleton', 'Buju Banton', 'Beenie Man', 'Shaggy', 'Sean Paul', 'Damian Marley', 'Stephen Marley', 'Ziggy Marley', 'Ky-Mani Marley', 'Chronixx', 'Protoje', 'Koffee', 'Popcaan', 'Vybz Kartel', 'Alborosie', 'Inner Circle', 'Maxi Priest', 'Eddy Grant', 'Aswad', 'The Wailers', 'Lee Scratch Perry', 'King Tubby', 'Augustus Pablo', 'Horace Andy', 'Barrington Levy', 'Toots & the Maytals', 'The Skatalites', 'Prince Buster', 'Desmond Dekker', 'U-Roy', 'I-Roy', 'Big Youth', 'Yellowman', 'Eek-A-Mouse', 'Half Pint', 'Cocoa Tea', 'Frankie Paul', 'Freddie McGregor', 'Beres Hammond', 'Marcia Griffiths', 'Judy Mowatt', 'Rita Marley', 'Etana', 'Queen Ifrica', 'Tarrus Riley', 'Jah Cure', 'Anthony B', 'Luciano', 'Morgan Heritage', 'Julian Marley', 'Kymani Marley', 'J Boog', 'Katchafire', 'Rebelution', 'Slightly Stoopid', 'SOJA', 'Gyptian', 'I-Octane', 'Konshens', 'Iba Mahr', 'Kabaka Pyramid', 'Jesse Royal', 'Jah9', 'Lila Iké', 'Sevana', 'Naomi Cowan', 'Runkus', 'Christopher Martin', 'Romain Virgo', 'Richie Spice', 'Turbulence', 'Sizzla Kalonji', 'Norris Man', 'Anthony Cruz', 'General Degree', 'Bounty Killer', 'Mavado', 'Aidonia', 'Busy Signal', 'Elephant Man', 'Sean Kingston', 'Collie Buddz', 'Wayne Wonder', 'Baby Cham'],
  'Country': ['Old Crow Medicine Show', 'Carrie Underwood', 'Zac Brown Band', 'Dolly Parton', 'Garth Brooks', 'John Denver', 'Sam Hunt', 'Florida Georgia Line', 'Billy Ray Cyrus', 'Brooks & Dunn', 'Shania Twain', 'Steve Earle', 'The Charlie Daniels Band', 'Keith Urban', 'Jason Aldean', 'George Strait', 'Alan Jackson', 'Toby Keith', 'Tim McGraw', 'Faith Hill', 'Kenny Chesney', 'Brad Paisley', 'Rascal Flatts', 'Lady A', 'Reba McEntire', 'Trisha Yearwood', 'Martina McBride', 'Miranda Lambert', 'Kacey Musgraves', 'Maren Morris', 'Kelsea Ballerini', 'Luke Combs', 'Morgan Wallen', 'Chris Stapleton', 'Eric Church', 'Blake Shelton', 'Darius Rucker', 'Cole Swindell', 'Thomas Rhett', 'Luke Bryan', 'Dan + Shay', 'Old Dominion', 'Little Big Town', 'The Chicks', 'Alabama', 'Waylon Jennings', 'Willie Nelson', 'Merle Haggard', 'Johnny Cash', 'Hank Williams', 'Patsy Cline', 'Loretta Lynn', 'Tammy Wynette', 'Kenny Rogers', 'Glen Campbell', 'Charley Pride', 'Conway Twitty', 'George Jones', 'Randy Travis', 'Vince Gill', 'Clint Black', 'Tracy Lawrence', 'Trace Adkins', 'Gary Allan', 'Dwight Yoakam', 'Travis Tritt', 'Marty Stuart', 'Ricky Skaggs', 'Emmylou Harris', 'Rosanne Cash', 'k.d. lang', 'Lyle Lovett', 'Nanci Griffith', 'Mary Chapin Carpenter', 'Suzy Bogguss', 'Pam Tillis', 'Wynonna Judd', 'The Judds', 'Sara Evans', 'Jo Dee Messina', 'Deana Carter', 'Lee Ann Womack', 'Chely Wright', 'Terri Clark', 'The SteelDrivers', 'Union Station', 'Alison Krauss', 'Ricky Van Shelton', 'Collin Raye', 'Tracy Byrd', 'Neal McCoy', 'John Michael Montgomery', 'Diamond Rio', 'Sawyer Brown', 'Restless Heart', 'Exile', 'The Bellamy Brothers', 'Oak Ridge Boys', 'Statler Brothers', 'Charlie Rich', 'Ronnie Milsap', 'Don Williams', 'Jim Reeves'],
  // "Classique" volontairement absent d'ARTIST_CATALOG (pas juste laissé vide) —
  // voir le commentaire détaillé au-dessus d'EXTRA_GENRES pour les deux raisons :
  // le BPM n'a pas de sens sur une œuvre classique, et le concept même
  // d'"artiste" ne s'applique pas de la même façon (compositeur ≠ interprète ≠
  // orchestre). Genre entièrement retiré de la sélection possible, pas juste
  // laissé sans filet de secours.
  'Autre': ['Rick Astley', 'Toto', 'a-ha', 'Whitney Houston', 'ABBA', 'The Black Eyed Peas', 'Katrina and the Waves', 'Earth, Wind & Fire', 'Village People', 'Gloria Gaynor', 'Coldplay', 'Adele', 'Ed Sheeran', 'Sam Smith', 'Norah Jones', 'Jack Johnson', 'Colbie Caillat', 'John Mayer', 'Jason Mraz', 'OneRepublic', 'James Blunt', 'Christina Perri', 'Sara Bareilles', 'Gavin DeGraw', 'Michael Bublé', 'Il Divo', 'Andrea Bocelli', 'Josh Groban', 'Lionel Richie', 'Phil Collins', 'Billy Joel', 'Elton John', 'Simon & Garfunkel', 'Fleetwood Mac', 'Bee Gees', 'Chic', 'KC and the Sunshine Band', 'Boney M.', 'Johnny Hallyday', 'Mylène Farmer', 'France Gall', 'Serge Gainsbourg', 'Édith Piaf', 'Charles Aznavour', 'Jacques Brel', 'Michel Sardou', 'Francis Cabrel', 'Jean-Jacques Goldman', 'Indochine', 'Téléphone', 'Noir Désir', 'Louise Attaque', 'Alain Souchon', 'Renaud', 'Véronique Sanson', 'Barbara', 'Georges Brassens', 'Dalida', 'Sylvie Vartan', 'Claude François', 'Michel Berger', 'Étienne Daho', 'Vanessa Paradis', 'Patricia Kaas', 'Florent Pagny', 'Garou', 'Céline Dion', 'Roch Voisine', 'Loreen', 'Måneskin', 'Conchita Wurst', 'Sandra', 'Ace of Base', 'Roxette', 'Alphaville', 'Modern Talking', 'Milli Vanilli', 'Dschinghis Khan', 'Vengaboys', 'Eiffel 65', 'Aqua', 'Culture Beat', 'La Bouche', 'Haddaway', '2 Unlimited', 'Snap!', 'Corona', 'Whigfield', 'Nena', 'Eros Ramazzotti', 'Laura Pausini', 'Tiziano Ferro', 'Il Volo', 'Julio Iglesias', 'Enrique Iglesias'],
  // Artistes pour les genres du bouton "Plus de genres" (EXTRA_GENRES) —
  // profondeur volontairement plus légère (genres moins centraux à l'usage
  // sportif), mais couvre chacun au moins quelques artistes représentatifs.
  'Musique africaine': ['Master KG', 'Fela Kuti', '2Baba', 'Wizkid', 'Burna Boy', 'Davido', 'Rema', 'Youssou N\'Dour', 'Salif Keita', 'Angelique Kidjo', 'Miriam Makeba', 'Hugh Masekela', 'Femi Kuti', 'Seun Kuti', 'Manu Dibango', 'Toto Bona Lokua', 'Baaba Maal', 'Ismael Lo', 'Oumou Sangare', 'Amadou & Mariam', 'Tiwa Savage', 'Yemi Alade', 'Diamond Platnumz', 'Sauti Sol', 'Fally Ipupa', 'Koffi Olomide', 'Franco Luambo', 'Papa Wemba', 'Werrason', 'Innoss\'B', 'Mr Eazi', 'Tekno', 'Simi', 'Adekunle Gold', 'Naira Marley', 'Olamide', 'Falz', 'Runtown'],
  'Musique asiatique': ['PSY', 'Kenshi Yonezu', 'Official HIGE DANdism', 'YOASOBI', 'GReeeeN', 'Utada Hikaru', 'Ayumi Hamasaki', 'Namie Amuro', 'Arashi', 'Mr. Children', 'Southern All Stars', 'B\'z', 'L\'Arc-en-Ciel', 'One OK Rock', 'Radwimps', 'King Gnu', 'Aimyon', 'Vaundy', 'Fujii Kaze', 'Ado', 'Eve', 'Zutomayo', 'Teresa Teng', 'Jay Chou', 'Faye Wong', 'Eason Chan', 'G.E.M.', 'Coco Lee', 'Jolin Tsai', 'Show Lo', 'Jam Hsiao', 'Wang Leehom', 'Mayday'],
  'Blues': ['B.B. King', 'The Blues Brothers', 'Stevie Ray Vaughan', 'John Lee Hooker', 'Muddy Waters', 'Howlin\' Wolf', 'The Animals', 'Jimi Hendrix', 'Robert Johnson', 'Elmore James', 'Albert King', 'Freddie King', 'T-Bone Walker', 'Buddy Guy', 'John Mayall', 'Etta James', 'Koko Taylor', 'Bessie Smith', 'Ma Rainey', 'Sonny Boy Williamson', 'Lightnin\' Hopkins', 'Blind Lemon Jefferson', 'Son House', 'Skip James', 'Willie Dixon', 'Otis Rush', 'Magic Sam', 'Junior Wells', 'James Cotton', 'Taj Mahal', 'Bonnie Raitt', 'Susan Tedeschi', 'Joe Bonamassa', 'Gary Clark Jr.', 'Robert Cray', 'Kenny Wayne Shepherd'],
  'Musique brésilienne': ['Sergio Mendes & Brasil \'66', 'Michel Teló', 'Anitta', 'MC Fioti', 'Léo Santana', 'Caetano Veloso', 'Gilberto Gil', 'Chico Buarque', 'Gal Costa', 'Jorge Ben Jor', 'Elis Regina', 'João Gilberto', 'Antônio Carlos Jobim', 'Vinicius de Moraes', 'Ivete Sangalo', 'Daniela Mercury', 'Alcione', 'Zeca Pagodinho', 'Beth Carvalho', 'Roberto Carlos', 'Djavan', 'Marisa Monte', 'Seu Jorge', 'Ana Carolina', 'Maria Bethânia', 'Jorge & Mateus', 'Henrique & Juliano', 'Marília Mendonça', 'Wesley Safadão', 'Ludmilla', 'Pabllo Vittar', 'Alok', 'Vintage Culture', 'KVSH'],
  'Dance & EDM': ['Dimitri Vegas & Like Mike', 'Skrillex', 'Deadmau5', 'Swedish House Mafia', 'Porter Robinson', 'Avicii', 'Calvin Harris', 'David Guetta', 'Martin Garrix', 'Tiësto', 'Zedd', 'Steve Aoki', 'Marshmello', 'Kygo', 'Alan Walker', 'Hardwell', 'Afrojack', 'Nicky Romero', 'Don Diablo', 'R3HAB', 'Alesso', 'Axwell /\\ Ingrosso', 'Sebastian Ingrosso', 'Otto Knows', 'Fedde Le Grand', 'Sander van Doorn', 'W&W', 'Blasterjaxx', 'Vini Vici', 'Armin van Buuren', 'Paul van Dyk', 'Ferry Corsten', 'Above & Beyond', 'ATB', 'Cosmic Gate'],
  'Folk': ['Bob Dylan', 'The Byrds', 'The Lumineers', 'Of Monsters and Men', 'Mumford & Sons', 'Edward Sharpe & the Magnetic Zeros', 'Simon & Garfunkel', 'Joni Mitchell', 'Neil Young', 'James Taylor', 'Cat Stevens', 'Leonard Cohen', 'Joan Baez', 'Pete Seeger', 'Woody Guthrie', 'Nick Drake', 'Fleet Foxes', 'Bon Iver', 'Iron & Wine', 'The Avett Brothers', 'First Aid Kit', 'The Head and the Heart', 'Local Natives', 'Vance Joy', 'City and Colour', 'Damien Rice', 'Glen Hansard', 'Ray LaMontagne', 'Jose Gonzalez', 'Sufjan Stevens', 'Beirut', 'The Decemberists', 'Gregory Alan Isakov'],
  'Indie': ['Franz Ferdinand', 'The Strokes', 'The Killers', 'MGMT', 'Modest Mouse', 'Florence + the Machine', 'Phoenix', 'Vampire Weekend', 'Arcade Fire', 'The National', 'Bon Iver', 'Fleet Foxes', 'Tame Impala', 'Alt-J', 'Foster the People', 'Two Door Cinema Club', 'Wolf Alice', 'The 1975', 'Glass Animals', 'Cage the Elephant', 'Portugal. The Man', 'Local Natives', 'Grizzly Bear', 'Beach House', 'Real Estate', 'Deerhunter', 'Interpol', 'Yeah Yeah Yeahs', 'Spoon', 'Wilco', 'Death Cab for Cutie', 'Bright Eyes', 'Sufjan Stevens', 'Beirut', 'The Shins', 'Broken Social Scene', 'Bloc Party'],
  'K-pop': ['BLACKPINK', 'BTS', 'TWICE', 'Girls\' Generation', 'EXO', 'NCT', 'Stray Kids', 'SEVENTEEN', 'ATEEZ', 'ENHYPEN', 'TXT', 'ITZY', 'aespa', 'NewJeans', 'IVE', 'LE SSERAFIM', '(G)I-DLE', 'Red Velvet', 'MAMAMOO', '2NE1', 'Big Bang', 'SHINee', 'Super Junior', 'Wonder Girls', 'Sistar', 'f(x)', 'INFINITE', 'Monsta X', 'GOT7', 'iKON', 'WINNER', 'Apink', 'Oh My Girl', 'Loona'],
  'Soul & Funk': ['Stevie Wonder', 'KC and the Sunshine Band', 'Chic', 'James Brown', 'Wild Cherry', 'Parliament', 'Commodores', 'Prince', 'Marvin Gaye', 'Aretha Franklin', 'Otis Redding', 'Sam Cooke', 'Al Green', 'Curtis Mayfield', 'Isaac Hayes', 'Wilson Pickett', 'The Temptations', 'The Supremes', 'Smokey Robinson', 'The Four Tops', 'Gladys Knight', 'Diana Ross', 'Earth Wind & Fire', 'Sly and the Family Stone', 'Bootsy Collins', 'George Clinton', 'Rick James', 'The Isley Brothers', 'Roy Ayers', 'Kool & the Gang', 'The Gap Band', 'Cameo', 'Zapp', 'Betty Wright', 'Ann Peebles', 'Bill Withers', 'Donny Hathaway', 'Teddy Pendergrass'],
  'Bandes originales': ['Kenny Loggins', 'Ray Parker Jr.', 'Klaus Badelt', 'Carl Douglas', 'Joe Esposito', 'Paul Engemann', 'Bill Conti', 'Irene Cara', 'Bonnie Tyler', 'John Williams', 'Hans Zimmer', 'Ennio Morricone', 'Danny Elfman', 'Alan Silvestri', 'James Horner', 'Howard Shore', 'Michael Giacchino', 'Alexandre Desplat', 'Thomas Newman', 'Randy Newman', 'John Barry', 'Vangelis', 'Jerry Goldsmith', 'Basil Poledouris', 'James Newton Howard', 'Harry Gregson-Williams', 'Ramin Djawadi', 'Trent Reznor', 'Lorne Balfe', 'Junkie XL', 'Ludwig Göransson', 'Nick Cave', 'Clint Mansell', 'Cliff Martinez'],
  // Ajouté après un constat concret (pas une supposition) : Deezer classe
  // certains titres "Alternative" sans qu'aucun genre existant ne corresponde
  // (ex. Baby Lasagna) — contrairement à "Rock"/"Métal", ce n'est pas juste une
  // variante d'écriture du même genre (voir isDirectGenreMatch), c'est un vrai
  // genre à part chez Deezer. Baby Lasagna volontairement inclus, l'artiste qui
  // a déclenché cet ajout. Beaucoup de recoupement avec Rock/Métal/Indie ci-dessus
  // (même logique que le reste du catalogue : un artiste peut représenter
  // plusieurs genres à la fois, ex. Bring Me the Horizon déjà dans Métal).
  'Alternative': ['Radiohead', 'Nirvana', 'R.E.M.', 'The Smashing Pumpkins', 'Weezer', 'Pixies', 'Sonic Youth', 'Beck', 'Placebo', 'Garbage', 'No Doubt', 'Bush', 'Live', 'Silverchair', 'Incubus', 'Twenty One Pilots', 'Cage the Elephant', 'Portugal. The Man', 'Wolf Alice', 'IDLES', 'Fontaines D.C.', 'girl in red', 'beabadoobee', 'Baby Lasagna', 'Yungblud', 'Nova Twins', 'Bring Me the Horizon', 'grandson', 'Waterparks', 'PVRIS', 'The Neighbourhood', 'Two Door Cinema Club', 'Glass Animals', 'AJR', 'X Ambassadors', 'American Authors', 'The Wombats', 'alt-J', 'Foals', 'Everything Everything', 'Bastille']
};
// "R&B" (genre standard général) réutilise les mêmes artistes que "R&B Sensuel"
// (mode Intime) plutôt que d'en dupliquer.
ARTIST_CATALOG['R&B'] = ARTIST_CATALOG['R&B Sensuel'];

// Liste des styles proposés à la génération/aux favoris.
// Ordre du plus simple au plus difficile à satisfaire correctement (constaté en
// pratique cette session, pas une hiérarchie théorique) : Pop/Rap/Electro ont une
// bonne couverture Deezer directe (genre_id fiable, beaucoup de BPM renseignés).
// Rock vient ensuite — large, mais c'est aussi le genre qui "absorbe" une bonne
// partie de ce qu'on appellerait Métal chez Deezer (voir GENRE_EQUIVALENCE_GROUPS
// dans musicCatalog.js), donc lui-même reste assez simple à remplir. Métal est le
// plus dur : Deezer classe la quasi-totalité du metal en "Rock", jamais "Metal" —
// d'où le renfort du catalogue d'artistes sur ce genre précis. Autre en dernier,
// catch-all sans mot-clé de recherche (DEEZER_GENRE_KEYWORDS['Autre'] est vide).
const STANDARD_GENRES = ['Pop', 'Rap', 'Electro', 'Rock', 'Métal', 'Autre'];
const NAUGHTY_GENRES = ['R&B Sensuel', 'Pop', 'Latino', 'Jazz', 'Autre'];
// "Classique" volontairement absent de cette liste (retiré, pas juste laissé
// vide) : une œuvre classique n'a en général pas de BPM fixe unique (le tempo
// varie dans le morceau lui-même, contrairement à une chanson pop/rock
// standard), donc le filtrage par BPM n'a structurellement pas de sens ici. Pire
// que juste "peu fiable" : ARTIST_CATALOG['Classique'] étant vide, le repli de
// dernier recours substituait silencieusement des artistes Pop dès que la
// recherche Deezer générique échouait — quelqu'un demandant du Classique
// pouvait se retrouver avec un résultat totalement hors sujet, sans le savoir.
const EXTRA_GENRES = ['Techno', 'R&B', 'Reggae', 'Country', 'Jazz', 'Latino', 'Musique africaine', 'Musique asiatique', 'Blues', 'Musique brésilienne', 'Dance & EDM', 'Folk', 'Indie', 'K-pop', 'Soul & Funk', 'Bandes originales', 'Alternative'];

// Correspondance approximative entre les genres internes de l'app et des mots-clés
// Deezer (recherche floue) — voir le détail de cette limite dans searchTracksByBpm.
const DEEZER_GENRE_KEYWORDS = {
  'Métal': 'metal', 'Rock': 'rock', 'Electro': 'electro', 'Techno': 'techno',
  'Pop': 'pop', 'Rap': 'rap', 'Latino': 'latino', 'Jazz': 'jazz',
  'R&B': 'rnb', 'Reggae': 'reggae', 'Country': 'country',
  'R&B Sensuel': 'rnb', 'Autre': '',
  'Musique africaine': 'african', 'Musique asiatique': 'asian', 'Blues': 'blues',
  'Musique brésilienne': 'brazilian', 'Dance & EDM': 'dance',
  'Folk': 'folk', 'Indie': 'indie', 'K-pop': 'k-pop', 'Soul & Funk': 'soul',
  // Plusieurs mots-clés possibles : Deezer renvoie "Films/Games" en anglais pour
  // ce genre (constaté en pratique, voir commentaire sur isDirectGenreMatch),
  // jamais littéralement "soundtrack" — gardé en plus au cas où une autre partie
  // du catalogue Deezer utilise cette forme.
  'Bandes originales': ['soundtrack', 'films/games', 'film', 'games'],
  'Alternative': 'alternative'
};

/**
 * Avertissement sur la profondeur du CATALOGUE D'ARTISTES pour un genre donné —
 * affiché en infobulle sur les sélecteurs de genre. Porte sur le nombre
 * d'artistes représentatifs listés, pas sur le nombre de titres (qui dépend
 * maintenant de la vraie discographie Deezer de ces artistes, pas d'une liste
 * figée) — un seul artiste avec une grande discographie peut suffire à couvrir
 * beaucoup de BPM différents, donc ce seuil est plus tolérant qu'avant.
 * SEUIL AJUSTÉ (l'ancien "≤ 2" ne se déclenchait plus jamais en pratique — le
 * catalogue le plus mince, K-pop/Musique brésilienne, a 4 artistes minimum
 * depuis les gros lots ajoutés cette session) : relevé à 5 pour redevenir utile.
 */
const getGenreLocalDepthWarning = (genre) => {
  const count = (ARTIST_CATALOG[genre] || []).length;
  if (count === 0) return "Aucun artiste de secours listé pour ce genre : si Deezer est indisponible ou n'a pas de BPM fiable pour ce style, la génération peut échouer à bien remplir ce style.";
  if (count <= 5) return `Seulement ${count} artistes de secours listés pour ce genre — filet de sécurité plus limité si la recherche généraliste ne suffit pas.`;
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
  // Un genre peut avoir PLUSIEURS mots-clés Deezer possibles (voir DEEZER_GENRE_
  // KEYWORDS, "Bandes originales" par exemple) — cas découvert en pratique :
  // Deezer renvoie littéralement "Films/Games" en anglais pour ce qu'on appelle
  // "Bandes originales", qui ne contient jamais le mot "soundtrack" utilisé
  // jusqu'ici comme unique mot-clé, donc le rapprochement échouait toujours.
  // Rétrocompatible : une entrée simple (chaîne) continue de fonctionner comme avant.
  const rawKeywords = DEEZER_GENRE_KEYWORDS[requestedGenre];
  const keywordList = Array.isArray(rawKeywords) ? rawKeywords : [rawKeywords || requestedGenre];
  const keywordMatch = keywordList.some(k => { const kw = normalize(k); return kw && (real.includes(kw) || kw.includes(real)); });
  return keywordMatch || real.includes(requested) || requested.includes(real);
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
  // "Classique" n'est plus un genre sélectionnable (voir plus haut), mais ces
  // deux entrées restent utiles TELLES QUELLES : puisque 'Classique' n'apparaîtra
  // plus jamais dans les genres demandés, le test de recoupement échouera
  // toujours pour ces mots-clés — ce qui revient à dire "un titre en version
  // piano/orchestrale est un conflit de style, quel que soit le genre demandé"
  // (comportement identique à un mot-clé associé à une liste vide, comme
  // "a cappella" ci-dessus). Correct : une version piano/orchestrale EST une
  // vraie déviation de style par rapport à n'importe quel autre genre demandé.
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

/**
 * Harmonise l'AFFICHAGE d'un genre — trouvé après un test réel : "Métal"
 * apparaissait deux fois dans le graphique de répartition (une fois pour les
 * titres du catalogue d'artistes, étiquetés avec notre nom interne "Métal"
 * accentué, une fois pour les titres résolus en direct via Deezer, étiquetés
 * avec le nom BRUT renvoyé par Deezer lui-même — "Metal" sans accent, ou
 * parfois un nom composé comme "Rap/Hip Hop" au lieu de "Rap" tout court, vu
 * concrètement dans les logs de diagnostic de cette session). Réutilise
 * `isDirectGenreMatch` (déjà éprouvée pour la génération) plutôt qu'une
 * comparaison dédiée, pour n'avoir qu'un seul endroit à corriger si un autre
 * cas de nommage apparaît. Volontairement PAS `genreRoughlyMatches` (qui
 * inclut l'équivalence Rock/Métal) : un titre accepté par équivalence doit
 * continuer à s'AFFICHER sous son VRAI genre Deezer — utile de voir la vraie
 * proportion — seules les variantes d'ÉCRITURE du même genre fusionnent ici.
 * Utilisée PARTOUT où un genre est affiché dans l'app (liste de titres,
 * graphiques...), pas seulement à un endroit, pour un affichage cohérent.
 */
const normalizeGenreForDisplay = (rawGenre) => {
  if (!rawGenre) return 'Genre inconnu';
  const allKnownGenres = [...new Set([...STANDARD_GENRES, ...NAUGHTY_GENRES, ...EXTRA_GENRES])];
  const match = allKnownGenres.find(g => isDirectGenreMatch(rawGenre, g));
  return match || rawGenre;
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
  detectTitleStyleConflict,
  normalizeGenreForDisplay
};
