/**
 * curatedSessions.js — Bibliothèque de PLAYLISTS STATIQUES ensemencées par
 * TempoFit (voir DiscoverView.jsx), pour éviter une page vide au lancement
 * de "Découvrir" avant qu'une vraie communauté n'existe (Cold Start
 * Problem).
 *
 * PIVOT PRODUIT (retour direct) — ancienne version : chaque carte
 * contenait un `payload` de PARAMÈTRES DE GÉNÉRATION, appliqué au
 * formulaire du générateur. Problème identifié : si le contenu doit pouvoir
 * être VOTÉ, il doit être IDENTIQUE pour tout le monde — un payload de
 * génération peut produire des titres différents à chaque fois (le
 * générateur interroge le catalogue Deezer en direct). Remplacé par une
 * vraie liste de titres FIGÉE (`tracks`) : ce ne sont plus des "recettes",
 * ce sont des playlists complètes, prêtes à écouter.
 *
 * `author`/`upvotes`/`isOfficial` : mêmes principes que la version
 * précédente — `upvotes` reste à `0` sur tous les modèles ci-dessous, aucun
 * chiffre inventé présenté comme un vrai vote (voir TemplateCard.jsx).
 *
 * `coverGradient` : pochette de secours (dégradé Tailwind) — ces playlists
 * n'ont pas de vraie pochette dédiée pour l'instant.
 *
 * RETOUR DIRECT ("pas de bruit dans l'app, ne pas appeler ça un id YouTube
 * si ça n'en est pas un") — la version précédente donnait à chaque titre un
 * `youtubeId` qui était en fait un ANCIEN identifiant YouTube recyclé d'une
 * démo ailleurs dans l'app (jamais un vrai identifiant Deezer). Retiré ici :
 * `title`/`artist` suffisent à IDENTIFIER un titre dans ce catalogue. Le
 * vrai identifiant Deezer et l'extrait audio ne sont RÉSOLUS qu'à la
 * demande, au moment du clic sur "écouter" (voir
 * resolveDeezerTrackByTitleArtist, musicEngine.js, et
 * resolveAndTogglePreview, PlaylistDetailView.jsx) — jamais stockés en dur
 * ici. Ce choix règle aussi, par construction, le souci des URLs d'extrait
 * Deezer qui EXPIRENT : rien de figé à faire expirer.
 */

export const curatedSessions = [
  {
    id: 'tpl-fractionne-10km',
    title: "Runner's High 165",
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-red-500 to-orange-500',
    tracks: [
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
      { title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170 },
      { title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252 },
      { title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292 },
      { title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210 },
    ],
  },
  {
    id: 'tpl-endurance-fondamentale',
    title: 'Deep Focus Run',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Course à pied',
    coverGradient: 'from-emerald-500 to-teal-600',
    tracks: [
      { title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210 },
      { title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
    ],
  },
  {
    id: 'tpl-crescendo-cyclisme',
    title: 'Power Climb Anthem',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Cyclisme',
    coverGradient: 'from-purple-500 to-indigo-500',
    tracks: [
      { title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
      { title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170 },
      { title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292 },
    ],
  },
  {
    id: 'tpl-5km-quotidien',
    title: 'Neon Run 5K',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-rose-500 to-red-600',
    tracks: [
      { title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252 },
      { title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170 },
      { title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222 },
    ],
  },
  {
    id: 'tpl-muscu-force',
    title: 'Iron Pump Anthem',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-slate-500 to-gray-700',
    tracks: [
      { title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210 },
      { title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292 },
    ],
  },
];
