/**
 * curatedSessions.js — Bibliothèque de PLAYLISTS STATIQUES ensemencées par
 * TempoFit (voir DiscoverView.jsx), pour éviter une page vide au lancement
 * de "Découvrir" avant qu'une vraie communauté n'existe (Cold Start
 * Problem).
 *
 * Passage à 30 playlists (6 par catégorie × 5 catégories) — même schéma que
 * la version précédente (5 playlists), juste plus de contenu :
 *   - `payload` (paramètres de génération) : toujours absent — voir le pivot
 *     produit déjà expliqué plus bas, un vote doit porter sur un contenu
 *     IDENTIQUE pour tout le monde, jamais une recette qui regénère
 *     différemment à chaque fois.
 *   - `tracks[].youtubeId`/`preview` : toujours absents des données sources
 *     — résolus à la demande au clic (voir resolveDeezerTrackByTitleArtist,
 *     musicEngine.js, et resolveAndTogglePreview, PlaylistDetailView.jsx),
 *     jamais figés ici (les URLs d'extrait Deezer expirent).
 *   - `upvotes: 0` partout, aucun chiffre inventé présenté comme un vrai
 *     vote (voir TemplateCard.jsx).
 *   - Le tag discret affiché sous l'auteur ("Course à pied • 18 min") N'EST
 *     PAS un champ stocké ici, volontairement — il est CALCULÉ dans
 *     TemplateCard.jsx depuis `workoutType` + la somme réelle des durées de
 *     `tracks`, pour ne jamais pouvoir se désynchroniser de la vraie liste
 *     de titres. `workoutType` reste donc un champ obligatoire par
 *     playlist, c'est de lui que ce calcul dépend.
 *
 * ⚠️ Sur les BPM/titres eux-mêmes : ce sont de VRAIS titres/artistes existants
 * (pas des noms inventés), choisis pour que la résolution à la demande (une
 * recherche Deezer par titre+artiste) ait de bonnes chances d'aboutir — mais
 * les BPM affichés restent des estimations approximatives pour ce mock
 * (impossible de les vérifier avec précision sans accès réseau au moment de
 * la rédaction), pas des mesures de studio certifiées.
 */

export const curatedSessions = [
  // ───────────────────────── CARDIO EXPRESS ─────────────────────────
  // Séances courtes et intenses (fractionné, HIIT, sprints) — BPM variables,
  // généralement soutenus.
  {
    id: 'tpl-midnight-runner-160',
    title: 'Midnight Runner 160',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-red-500 to-orange-500',
    tracks: [
      { title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292 },
      { title: 'Du Hast', artist: 'Rammstein', genre: 'Métal', bpm: 120, duration: 235 },
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
    ],
  },
  {
    id: 'tpl-sprint-zone-180',
    title: 'Sprint Zone 180',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-orange-500 to-amber-500',
    tracks: [
      { title: 'Bodies', artist: 'Drowning Pool', genre: 'Métal', bpm: 130, duration: 190 },
      { title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210 },
      { title: 'Feuer Frei', artist: 'Rammstein', genre: 'Métal', bpm: 132, duration: 214 },
    ],
  },
  {
    id: 'tpl-neon-run-5k',
    title: 'Neon Run 5K',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-pink-500 to-fuchsia-600',
    tracks: [
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: 'Titanium', artist: 'David Guetta', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Animals', artist: 'Martin Garrix', genre: 'Electro', bpm: 128, duration: 185 },
    ],
  },
  {
    id: 'tpl-interval-overdrive',
    title: 'Interval Overdrive',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-rose-500 to-red-600',
    tracks: [
      { title: 'Killing In The Name', artist: 'Rage Against The Machine', genre: 'Rock', bpm: 118, duration: 313 },
      { title: 'Bulls On Parade', artist: 'Rage Against The Machine', genre: 'Rock', bpm: 106, duration: 197 },
      { title: 'Break Stuff', artist: 'Limp Bizkit', genre: 'Métal', bpm: 109, duration: 163 },
    ],
  },
  {
    id: 'tpl-turbo-cardio',
    title: 'Turbo Cardio',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Cyclisme',
    coverGradient: 'from-amber-500 to-red-500',
    tracks: [
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Remember The Name', artist: 'Fort Minor', genre: 'Rap', bpm: 148, duration: 224 },
    ],
  },
  {
    id: 'tpl-hiit-frenzy-170',
    title: 'HIIT Frenzy 170',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-red-600 to-rose-500',
    tracks: [
      { title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170 },
      { title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252 },
      { title: 'Guerrilla Radio', artist: 'Rage Against The Machine', genre: 'Rock', bpm: 103, duration: 205 },
    ],
  },

  // ─────────────────────── ENDURANCE FONDAMENTALE ───────────────────────
  // Séances longues et régulières (Zone 2, footing, vélo longue distance) —
  // BPM stables, modérés.
  {
    id: 'tpl-deep-focus-run',
    title: 'Deep Focus Run',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Course à pied',
    coverGradient: 'from-emerald-500 to-teal-600',
    tracks: [
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
      { title: 'Somebody Told Me', artist: 'The Killers', genre: 'Rock', bpm: 141, duration: 197 },
      { title: 'Mr. Jones', artist: 'Counting Crows', genre: 'Rock', bpm: 140, duration: 275 },
    ],
  },
  {
    id: 'tpl-steady-state-cruise',
    title: 'Steady State Cruise',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Cyclisme',
    coverGradient: 'from-teal-500 to-cyan-500',
    tracks: [
      { title: 'Dog Days Are Over', artist: 'Florence + The Machine', genre: 'Pop', bpm: 149, duration: 253 },
      { title: 'Pumped Up Kicks', artist: 'Foster The People', genre: 'Indie', bpm: 128, duration: 240 },
      { title: 'Shut Up And Dance', artist: 'Walk The Moon', genre: 'Pop', bpm: 128, duration: 199 },
    ],
  },
  {
    id: 'tpl-horizon-miles',
    title: 'Horizon Miles',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Course à pied',
    coverGradient: 'from-green-500 to-emerald-600',
    tracks: [
      { title: 'Time To Dance', artist: 'The Sounds', genre: 'Rock', bpm: 140, duration: 200 },
      { title: 'Reptilia', artist: 'The Strokes', genre: 'Rock', bpm: 148, duration: 208 },
      { title: 'Last Nite', artist: 'The Strokes', genre: 'Rock', bpm: 116, duration: 193 },
    ],
  },
  {
    id: 'tpl-long-haul-groove',
    title: 'Long Haul Groove',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Cyclisme',
    coverGradient: 'from-lime-500 to-green-600',
    tracks: [
      { title: 'Electric Feel', artist: 'MGMT', genre: 'Indie', bpm: 111, duration: 229 },
      { title: 'Home', artist: 'Edward Sharpe & The Magnetic Zeros', genre: 'Folk', bpm: 146, duration: 302 },
      { title: 'Little Talks', artist: 'Of Monsters and Men', genre: 'Indie', bpm: 143, duration: 267 },
    ],
  },
  {
    id: 'tpl-sunday-long-run',
    title: 'Sunday Long Run',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Course à pied',
    coverGradient: 'from-cyan-500 to-blue-500',
    tracks: [
      { title: 'Feel Good Inc', artist: 'Gorillaz', genre: 'Alternative', bpm: 138, duration: 222 },
      { title: 'Seven Nation Army', artist: 'The White Stripes', genre: 'Rock', bpm: 124, duration: 232 },
      { title: 'Float On', artist: 'Modest Mouse', genre: 'Indie', bpm: 140, duration: 210 },
    ],
  },
  {
    id: 'tpl-base-building-beat',
    title: 'Base Building Beat',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Course à pied',
    coverGradient: 'from-teal-600 to-emerald-500',
    tracks: [
      { title: 'Are You Gonna Be My Girl', artist: 'Jet', genre: 'Rock', bpm: 146, duration: 213 },
      { title: 'When You Were Young', artist: 'The Killers', genre: 'Rock', bpm: 138, duration: 224 },
      { title: 'Take Me Out', artist: 'Franz Ferdinand', genre: 'Rock', bpm: 104, duration: 237 },
    ],
  },

  // ─────────────────────────── FORCE & RENFO ───────────────────────────
  // Musculation, haltérophilie, crossfit — tempos lourds et puissants.
  {
    id: 'tpl-iron-pump-anthem',
    title: 'Iron Pump Anthem',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-slate-500 to-gray-700',
    tracks: [
      { title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292 },
      { title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210 },
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
    ],
  },
  {
    id: 'tpl-heavy-lift-sessions',
    title: 'Heavy Lift Sessions',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-zinc-500 to-neutral-700',
    tracks: [
      { title: 'Break Stuff', artist: 'Limp Bizkit', genre: 'Métal', bpm: 109, duration: 163 },
      { title: 'Bodies', artist: 'Drowning Pool', genre: 'Métal', bpm: 130, duration: 190 },
      { title: 'HUMBLE.', artist: 'Kendrick Lamar', genre: 'Rap', bpm: 150, duration: 177 },
    ],
  },
  {
    id: 'tpl-crossfit-crusher',
    title: 'Crossfit Crusher',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-stone-500 to-gray-600',
    tracks: [
      { title: 'Remember The Name', artist: 'Fort Minor', genre: 'Rap', bpm: 148, duration: 224 },
      { title: 'Stronger', artist: 'Kanye West', genre: 'Rap', bpm: 104, duration: 312 },
      { title: 'Power', artist: 'Kanye West', genre: 'Rap', bpm: 130, duration: 292 },
    ],
  },
  {
    id: 'tpl-powerlifters-anthem',
    title: "Powerlifter's Anthem",
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-gray-600 to-slate-800',
    tracks: [
      { title: 'Du Hast', artist: 'Rammstein', genre: 'Métal', bpm: 120, duration: 235 },
      { title: 'Feuer Frei', artist: 'Rammstein', genre: 'Métal', bpm: 132, duration: 214 },
      { title: 'Bulls On Parade', artist: 'Rage Against The Machine', genre: 'Rock', bpm: 106, duration: 197 },
    ],
  },
  {
    id: 'tpl-barbell-beats',
    title: 'Barbell Beats',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-neutral-500 to-zinc-700',
    tracks: [
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170 },
      { title: 'Killing In The Name', artist: 'Rage Against The Machine', genre: 'Rock', bpm: 118, duration: 313 },
    ],
  },
  {
    id: 'tpl-grind-mode-activated',
    title: 'Grind Mode Activated',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-slate-600 to-zinc-800',
    tracks: [
      { title: 'Sicko Mode', artist: 'Travis Scott', genre: 'Rap', bpm: 155, duration: 312 },
      { title: 'DNA.', artist: 'Kendrick Lamar', genre: 'Rap', bpm: 140, duration: 185 },
      { title: 'Mask Off', artist: 'Future', genre: 'Rap', bpm: 150, duration: 205 },
    ],
  },

  // ───────────────────── RÉCUPÉRATION & FLOW ─────────────────────
  // Étirements, yoga, décrassage lent — BPM bas, musiques calmes.
  {
    id: 'tpl-sunday-recovery',
    title: 'Sunday Recovery',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Récupération & Flow',
    workoutType: 'Autre',
    coverGradient: 'from-sky-500 to-indigo-500',
    tracks: [
      { title: 'Holocene', artist: 'Bon Iver', genre: 'Folk', bpm: 82, duration: 337 },
      { title: 'Skinny Love', artist: 'Bon Iver', genre: 'Folk', bpm: 79, duration: 238 },
      { title: 'The Night We Met', artist: 'Lord Huron', genre: 'Folk', bpm: 87, duration: 210 },
    ],
  },
  {
    id: 'tpl-slow-flow-yoga',
    title: 'Slow Flow Yoga',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Récupération & Flow',
    workoutType: 'Autre',
    coverGradient: 'from-violet-500 to-purple-600',
    tracks: [
      { title: 'Banana Pancakes', artist: 'Jack Johnson', genre: 'Folk', bpm: 74, duration: 191 },
      { title: 'Better Together', artist: 'Jack Johnson', genre: 'Folk', bpm: 90, duration: 207 },
      { title: 'Ho Hey', artist: 'The Lumineers', genre: 'Folk', bpm: 78, duration: 163 },
    ],
  },
  {
    id: 'tpl-gentle-stretch-session',
    title: 'Gentle Stretch Session',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Récupération & Flow',
    workoutType: 'Autre',
    coverGradient: 'from-indigo-500 to-blue-500',
    tracks: [
      { title: 'Photograph', artist: 'Ed Sheeran', genre: 'Pop', bpm: 108, duration: 258 },
      { title: 'Thinking Out Loud', artist: 'Ed Sheeran', genre: 'Pop', bpm: 79, duration: 281 },
      { title: 'Perfect', artist: 'Ed Sheeran', genre: 'Pop', bpm: 95, duration: 263 },
    ],
  },
  {
    id: 'tpl-wind-down-wednesday',
    title: 'Wind Down Wednesday',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Récupération & Flow',
    workoutType: 'Autre',
    coverGradient: 'from-purple-500 to-violet-600',
    tracks: [
      { title: "Ain't No Sunshine", artist: 'Bill Withers', genre: 'Soul & Funk', bpm: 78, duration: 125 },
      { title: 'Lean On Me', artist: 'Bill Withers', genre: 'Soul & Funk', bpm: 100, duration: 257 },
      { title: 'Valerie', artist: 'Amy Winehouse', genre: 'Jazz', bpm: 106, duration: 231 },
    ],
  },
  {
    id: 'tpl-mellow-mobility',
    title: 'Mellow Mobility',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Récupération & Flow',
    workoutType: 'Autre',
    coverGradient: 'from-blue-500 to-violet-500',
    tracks: [
      { title: 'Re: Stacks', artist: 'Bon Iver', genre: 'Folk', bpm: 85, duration: 328 },
      { title: 'I Will Follow You Into The Dark', artist: 'Death Cab For Cutie', genre: 'Indie', bpm: 78, duration: 199 },
      { title: 'The Scientist', artist: 'Coldplay', genre: 'Pop', bpm: 73, duration: 309 },
    ],
  },
  {
    id: 'tpl-deep-breath-decompress',
    title: 'Deep Breath Decompress',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Récupération & Flow',
    workoutType: 'Autre',
    coverGradient: 'from-indigo-600 to-purple-500',
    tracks: [
      { title: 'Yellow', artist: 'Coldplay', genre: 'Pop', bpm: 87, duration: 269 },
      { title: 'Landslide', artist: 'Fleetwood Mac', genre: 'Folk', bpm: 105, duration: 199 },
      { title: 'Both Sides Now', artist: 'Joni Mitchell', genre: 'Folk', bpm: 90, duration: 251 },
    ],
  },

  // ───────────────────── RACE DAY / PERFORMANCE ─────────────────────
  // Séances pour battre des records (10km, semi, CLM vélo) — BPM élevés,
  // énergie maximale.
  {
    id: 'tpl-personal-best-170',
    title: 'Personal Best 170',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Race Day / Performance',
    workoutType: 'Course à pied',
    coverGradient: 'from-red-500 to-pink-600',
    tracks: [
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: 'Master Of Puppets', artist: 'Metallica', genre: 'Métal', bpm: 212, duration: 515 },
      { title: 'One', artist: 'Metallica', genre: 'Métal', bpm: 165, duration: 456 },
    ],
  },
  {
    id: 'tpl-finish-line-fury',
    title: 'Finish Line Fury',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Race Day / Performance',
    workoutType: 'Course à pied',
    coverGradient: 'from-rose-600 to-orange-500',
    tracks: [
      { title: 'Painkiller', artist: 'Judas Priest', genre: 'Métal', bpm: 166, duration: 366 },
      { title: 'Down With The Sickness', artist: 'Disturbed', genre: 'Métal', bpm: 140, duration: 320 },
      { title: 'B.Y.O.B.', artist: 'System Of A Down', genre: 'Métal', bpm: 155, duration: 255 },
    ],
  },
  {
    id: 'tpl-record-breaker-180',
    title: 'Record Breaker 180',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Race Day / Performance',
    workoutType: 'Cyclisme',
    coverGradient: 'from-orange-600 to-red-500',
    tracks: [
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Sicko Mode', artist: 'Travis Scott', genre: 'Rap', bpm: 155, duration: 312 },
    ],
  },
  {
    id: 'tpl-podium-push',
    title: 'Podium Push',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Race Day / Performance',
    workoutType: 'Cyclisme',
    coverGradient: 'from-red-600 to-yellow-500',
    tracks: [
      { title: 'Du Hast', artist: 'Rammstein', genre: 'Métal', bpm: 120, duration: 235 },
      { title: 'Feuer Frei', artist: 'Rammstein', genre: 'Métal', bpm: 132, duration: 214 },
      { title: 'Bulls On Parade', artist: 'Rage Against The Machine', genre: 'Rock', bpm: 106, duration: 197 },
    ],
  },
  {
    id: 'tpl-marathon-kick-175',
    title: 'Marathon Kick 175',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Race Day / Performance',
    workoutType: 'Course à pied',
    coverGradient: 'from-pink-600 to-red-500',
    tracks: [
      { title: 'Bodies', artist: 'Drowning Pool', genre: 'Métal', bpm: 130, duration: 190 },
      { title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210 },
      { title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170 },
    ],
  },
  {
    id: 'tpl-full-send-finale',
    title: 'Full Send Finale',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Race Day / Performance',
    workoutType: 'Course à pied',
    coverGradient: 'from-orange-500 to-rose-600',
    tracks: [
      { title: 'HUMBLE.', artist: 'Kendrick Lamar', genre: 'Rap', bpm: 150, duration: 177 },
      { title: 'DNA.', artist: 'Kendrick Lamar', genre: 'Rap', bpm: 140, duration: 185 },
      { title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252 },
    ],
  },
];
