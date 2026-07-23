/**
 * curatedSessions.js — Bibliothèque de PLAYLISTS STATIQUES ensemencées par
 * TempoFit (voir DiscoverView.jsx), pour éviter une page vide au lancement
 * de "Découvrir" avant qu'une vraie communauté n'existe (Cold Start
 * Problem).
 *
 * RETOUR DIRECT ("pas d'estimation sur les BPM, même pour un mock") — les
 * BPM ci-dessous ne sont utilisés QUE pour des titres où j'ai une vraie
 * confiance (ceux cités de façon constante dans les listes "musique de
 * sport par BPM", comme Mr. Brightside 148, Titanium 126, Lose Yourself
 * 171). Conséquence assumée : ce pool de titres à confiance réelle est
 * FORCÉMENT limité (il n'existe pas des centaines de tubes mondiaux à
 * 175 BPM sans ambiguïté), donc certains titres reviennent d'une playlist à
 * l'autre — préférable à inventer un BPM pour un titre que je ne connais
 * pas avec certitude. Les DURÉES, elles, restent des approximations
 * raisonnables (pas la même exigence que pour le BPM).
 *
 * Longueurs de playlist volontairement variées (Cardio Express : 5-6 titres
 * ~15-20 min ; Endurance Fondamentale/Race Day : 10-14 titres ~45min-1h ;
 * Force & Renfo/Récupération : 6-8 titres) — mais plafonnées un peu en
 * dessous de l'extrême demandé (20) pour ne pas être forcé de "compléter"
 * avec des titres dont le BPM est moins certain juste pour atteindre un
 * chiffre.
 *
 * Mêmes principes déjà établis : pas de `payload` (contenu figé, pas une
 * recette de génération), pas de `trackId`/`preview` stockés (résolus à la
 * demande au clic, voir resolveDeezerTrackByTitleArtist/
 * resolveAndTogglePreview), `upvotes: 0` partout, tag discret calculé
 * dynamiquement dans TemplateCard.jsx (pas stocké ici).
 */

export const curatedSessions = [
  // ───────────────────────── CARDIO EXPRESS ─────────────────────────
  {
    id: 'tpl-midnight-runner-160',
    title: 'Midnight Runner 160',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    tracks: [
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
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
    tracks: [
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
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
    tracks: [
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
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
    tracks: [
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
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
    tracks: [
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
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
    tracks: [
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
    ],
  },

  // ─────────────────────── ENDURANCE FONDAMENTALE ───────────────────────
  {
    id: 'tpl-deep-focus-run',
    title: 'Deep Focus Run',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Course à pied',
    tracks: [
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock', bpm: 117, duration: 301 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: 'One More Time', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 320 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: 'Walking On Sunshine', artist: 'Katrina & The Waves', genre: 'Pop', bpm: 109, duration: 238 },
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
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
    tracks: [
      { title: 'Every Breath You Take', artist: 'The Police', genre: 'Rock', bpm: 87, duration: 254 },
      { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock', bpm: 87, duration: 258 },
      { title: 'Africa', artist: 'Toto', genre: 'Pop', bpm: 93, duration: 295 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: 'Wannabe', artist: 'Spice Girls', genre: 'Pop', bpm: 109, duration: 173 },
      { title: 'Walking On Sunshine', artist: 'Katrina & The Waves', genre: 'Pop', bpm: 109, duration: 238 },
      { title: 'Eye Of The Tiger', artist: 'Survivor', genre: 'Rock', bpm: 109, duration: 245 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
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
    tracks: [
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock', bpm: 117, duration: 301 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: 'Eye Of The Tiger', artist: 'Survivor', genre: 'Rock', bpm: 109, duration: 245 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: 'One More Time', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 320 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: 'Wannabe', artist: 'Spice Girls', genre: 'Pop', bpm: 109, duration: 173 },
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
    tracks: [
      { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock', bpm: 87, duration: 258 },
      { title: 'Every Breath You Take', artist: 'The Police', genre: 'Rock', bpm: 87, duration: 254 },
      { title: 'Africa', artist: 'Toto', genre: 'Pop', bpm: 93, duration: 295 },
      { title: 'Walking On Sunshine', artist: 'Katrina & The Waves', genre: 'Pop', bpm: 109, duration: 238 },
      { title: 'Wannabe', artist: 'Spice Girls', genre: 'Pop', bpm: 109, duration: 173 },
      { title: 'Eye Of The Tiger', artist: 'Survivor', genre: 'Rock', bpm: 109, duration: 245 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
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
    tracks: [
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock', bpm: 117, duration: 301 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: 'Wannabe', artist: 'Spice Girls', genre: 'Pop', bpm: 109, duration: 173 },
      { title: 'Eye Of The Tiger', artist: 'Survivor', genre: 'Rock', bpm: 109, duration: 245 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
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
    tracks: [
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: 'One More Time', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 320 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock', bpm: 117, duration: 301 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: 'Wannabe', artist: 'Spice Girls', genre: 'Pop', bpm: 109, duration: 173 },
      { title: 'Eye Of The Tiger', artist: 'Survivor', genre: 'Rock', bpm: 109, duration: 245 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
    ],
  },

  // ─────────────────────────── FORCE & RENFO ───────────────────────────
  // Musculation, haltérophilie, crossfit — BPM 105-130, tempos lourds/puissants.
  {
    id: 'tpl-iron-pump-anthem',
    title: 'Iron Pump Anthem',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    tracks: [
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: 'One More Time', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 320 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
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
    tracks: [
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock', bpm: 117, duration: 301 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
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
    tracks: [
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: 'One More Time', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 320 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: 'Eye Of The Tiger', artist: 'Survivor', genre: 'Rock', bpm: 109, duration: 245 },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock', bpm: 117, duration: 301 },
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
    tracks: [
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
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
    tracks: [
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: 'One More Time', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 320 },
      { title: 'Eye Of The Tiger', artist: 'Survivor', genre: 'Rock', bpm: 109, duration: 245 },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock', bpm: 117, duration: 301 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
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
    tracks: [
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: "Don't Stop Believin'", artist: 'Journey', genre: 'Rock', bpm: 119, duration: 251 },
      { title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', bpm: 115, duration: 270 },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', bpm: 117, duration: 294 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
    ],
  },

  // ───────────────────── RÉCUPÉRATION & FLOW ─────────────────────
  // Étirements, yoga, décrassage lent — BPM 70-95, musiques calmes.
  {
    id: 'tpl-sunday-recovery',
    title: 'Sunday Recovery',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Récupération & Flow',
    workoutType: 'Autre',
    tracks: [
      { title: 'The Scientist', artist: 'Coldplay', genre: 'Pop', bpm: 73, duration: 309 },
      { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock', bpm: 87, duration: 258 },
      { title: 'Every Breath You Take', artist: 'The Police', genre: 'Rock', bpm: 87, duration: 254 },
      { title: 'Africa', artist: 'Toto', genre: 'Pop', bpm: 93, duration: 295 },
      { title: 'Yellow', artist: 'Coldplay', genre: 'Pop', bpm: 87, duration: 269 },
      { title: 'Someone Like You', artist: 'Adele', genre: 'Pop', bpm: 67, duration: 285 },
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
    tracks: [
      { title: 'Someone Like You', artist: 'Adele', genre: 'Pop', bpm: 67, duration: 285 },
      { title: 'The Scientist', artist: 'Coldplay', genre: 'Pop', bpm: 73, duration: 309 },
      { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock', bpm: 87, duration: 258 },
      { title: 'Yellow', artist: 'Coldplay', genre: 'Pop', bpm: 87, duration: 269 },
      { title: 'Every Breath You Take', artist: 'The Police', genre: 'Rock', bpm: 87, duration: 254 },
      { title: 'Africa', artist: 'Toto', genre: 'Pop', bpm: 93, duration: 295 },
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
    tracks: [
      { title: 'Yellow', artist: 'Coldplay', genre: 'Pop', bpm: 87, duration: 269 },
      { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock', bpm: 87, duration: 258 },
      { title: 'The Scientist', artist: 'Coldplay', genre: 'Pop', bpm: 73, duration: 309 },
      { title: 'Every Breath You Take', artist: 'The Police', genre: 'Rock', bpm: 87, duration: 254 },
      { title: 'Someone Like You', artist: 'Adele', genre: 'Pop', bpm: 67, duration: 285 },
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
    tracks: [
      { title: 'Africa', artist: 'Toto', genre: 'Pop', bpm: 93, duration: 295 },
      { title: 'Yellow', artist: 'Coldplay', genre: 'Pop', bpm: 87, duration: 269 },
      { title: 'The Scientist', artist: 'Coldplay', genre: 'Pop', bpm: 73, duration: 309 },
      { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock', bpm: 87, duration: 258 },
      { title: 'Someone Like You', artist: 'Adele', genre: 'Pop', bpm: 67, duration: 285 },
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
    tracks: [
      { title: 'Every Breath You Take', artist: 'The Police', genre: 'Rock', bpm: 87, duration: 254 },
      { title: 'Someone Like You', artist: 'Adele', genre: 'Pop', bpm: 67, duration: 285 },
      { title: 'Africa', artist: 'Toto', genre: 'Pop', bpm: 93, duration: 295 },
      { title: 'The Scientist', artist: 'Coldplay', genre: 'Pop', bpm: 73, duration: 309 },
      { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock', bpm: 87, duration: 258 },
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
    tracks: [
      { title: 'Yellow', artist: 'Coldplay', genre: 'Pop', bpm: 87, duration: 269 },
      { title: 'Someone Like You', artist: 'Adele', genre: 'Pop', bpm: 67, duration: 285 },
      { title: 'The Scientist', artist: 'Coldplay', genre: 'Pop', bpm: 73, duration: 309 },
      { title: 'Africa', artist: 'Toto', genre: 'Pop', bpm: 93, duration: 295 },
      { title: 'Every Breath You Take', artist: 'The Police', genre: 'Rock', bpm: 87, duration: 254 },
    ],
  },

  // ───────────────────── RACE DAY / PERFORMANCE ─────────────────────
  // Records (10km, semi, CLM vélo) — BPM 150-215, énergie maximale.
  {
    id: 'tpl-personal-best-170',
    title: 'Personal Best 170',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Race Day / Performance',
    workoutType: 'Course à pied',
    tracks: [
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
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
    tracks: [
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
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
    tracks: [
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: "Livin' On A Prayer", artist: 'Bon Jovi', genre: 'Rock', bpm: 122, duration: 249 },
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
    tracks: [
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', genre: 'Electro', bpm: 123, duration: 224 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
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
    tracks: [
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 297 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'Electro', bpm: 126, duration: 245 },
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
    tracks: [
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Rap', bpm: 171, duration: 326 },
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Electro', bpm: 171, duration: 200 },
      { title: 'Blitzkrieg Bop', artist: 'Ramones', genre: 'Rock', bpm: 177, duration: 132 },
      { title: "Don't Stop Me Now", artist: 'Queen', genre: 'Rock', bpm: 156, duration: 211 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', genre: 'Rap', bpm: 146, duration: 258 },
      { title: 'Levels', artist: 'Avicii', genre: 'Electro', bpm: 126, duration: 203 },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: 'Rock', bpm: 125, duration: 356 },
    ],
  },
];

/**
 * naughtyCuratedSessions — même principe EXACTEMENT que curatedSessions
 * ci-dessus (Cold Start Problem), catalogue dédié au Mode Intime (pare-feu
 * signalé : "Découvrir mélange les contenus des deux modes"). Même forme de
 * données à l'identique (aucun champ en plus/en moins) : `DiscoverView.jsx`
 * peut donc afficher l'un OU l'autre catalogue sans aucune logique de rendu
 * différente entre les deux.
 *
 * `workoutType` reste une VRAIE activité canonique (Cyclisme/Course à pied/
 * Musculation — jamais "Ambiance" ici) : ce champ sert à pré-remplir le
 * générateur au moment d'ouvrir le template (voir `openCuratedPlaylist`,
 * App.jsx), qui se charge LUI de basculer sur "Ambiance" au moment de créer
 * la vraie playlist si le Mode Intime est actif — exactement la même
 * mécanique que pour une génération manuelle, un template n'est jamais
 * qu'un point de départ, pas encore une playlist. Genres limités aux
 * valeurs canoniques de `NAUGHTY_GENRES` (musicCatalog.js).
 *
 * ÉPURATION ("less is more") — UNE SEULE catégorie ("Rythmes Sensuels"),
 * volontairement pas de découpage par sous-thème (Chill & Détente/Montée en
 * Température, essayées puis retirées) : exactement 5 templates pour
 * remplir une seule ligne complète de la grille (5 colonnes en xl, voir
 * DiscoverView.jsx) sans ligne partielle disgracieuse. `workoutType` garde
 * sa diversité (Cyclisme/Course à pied/Musculation) d'un template à l'autre
 * malgré la catégorie unique — ce champ reste utile à la génération, il
 * n'a juste plus besoin de structurer l'affichage en plusieurs sections.
 */
export const naughtyCuratedSessions = [
  {
    id: 'ntpl-soft-sunset',
    title: 'Soft Sunset',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Rythmes Sensuels',
    workoutType: 'Cyclisme',
    tracks: [
      { title: 'Smooth Operator', artist: 'Sade', genre: 'R&B Sensuel', bpm: 90, duration: 292 },
      { title: 'Put Your Records On', artist: 'Corinne Bailey Rae', genre: 'Jazz', bpm: 92, duration: 238 },
      { title: 'All of Me', artist: 'John Legend', genre: 'R&B Sensuel', bpm: 63, duration: 269 },
      { title: "Can't Help Falling in Love", artist: 'Elvis Presley', genre: 'Jazz', bpm: 82, duration: 181 },
    ],
  },
  {
    id: 'ntpl-slow-hours',
    title: 'Slow Hours',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Rythmes Sensuels',
    workoutType: 'Cyclisme',
    tracks: [
      { title: 'La Vie en Rose', artist: 'Édith Piaf', genre: 'Jazz', bpm: 88, duration: 200 },
      { title: 'Feeling Good', artist: 'Nina Simone', genre: 'Jazz', bpm: 96, duration: 176 },
      { title: 'Best Part', artist: 'Daniel Caesar ft. H.E.R.', genre: 'R&B Sensuel', bpm: 79, duration: 195 },
    ],
  },
  {
    id: 'ntpl-slow-burn',
    title: 'Slow Burn',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Rythmes Sensuels',
    workoutType: 'Course à pied',
    tracks: [
      { title: 'Adorn', artist: 'Miguel', genre: 'R&B Sensuel', bpm: 65, duration: 205 },
      { title: 'Pink + White', artist: 'Frank Ocean', genre: 'R&B Sensuel', bpm: 85, duration: 184 },
      { title: 'Often', artist: 'The Weeknd', genre: 'R&B Sensuel', bpm: 74, duration: 269 },
      { title: 'No Ordinary Love', artist: 'Sade', genre: 'R&B Sensuel', bpm: 68, duration: 293 },
    ],
  },
  {
    id: 'ntpl-midnight-latino',
    title: 'Midnight Latino',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Rythmes Sensuels',
    workoutType: 'Course à pied',
    tracks: [
      { title: 'Bailando', artist: 'Enrique Iglesias', genre: 'Latino', bpm: 100, duration: 243 },
      { title: 'Danza Kuduro', artist: 'Don Omar ft. Lucenzo', genre: 'Latino', bpm: 130, duration: 199 },
      { title: 'Vivir Mi Vida', artist: 'Marc Anthony', genre: 'Latino', bpm: 98, duration: 240 },
    ],
  },
  {
    id: 'ntpl-heat-rising',
    title: 'Heat Rising',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Rythmes Sensuels',
    workoutType: 'Musculation',
    tracks: [
      { title: 'Nice & Slow', artist: 'Usher', genre: 'R&B Sensuel', bpm: 75, duration: 246 },
      { title: 'Pony', artist: 'Ginuwine', genre: 'R&B Sensuel', bpm: 68, duration: 254 },
      { title: 'Neighbors Know My Name', artist: 'Trey Songz', genre: 'R&B Sensuel', bpm: 100, duration: 220 },
      { title: 'Rock the Boat', artist: 'Aaliyah', genre: 'R&B Sensuel', bpm: 92, duration: 251 },
    ],
  },
];
