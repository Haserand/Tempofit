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
 * `tracks[].youtubeId` (PAS `id`) : nom du champ délibérément gardé
 * identique à celui utilisé PARTOUT AILLEURS dans l'app pour identifier un
 * titre (favoris, mini-lecteur, graphiques BPM — voir PlaylistDetailView.jsx,
 * useAudioPreview.js) — un champ `id` à la place casserait silencieusement
 * toutes ces fonctionnalités une fois la playlist ouverte.
 *
 * ⚠️ `preview: null` partout ici — les URLs d'extrait Deezer EXPIRENT (déjà
 * documenté ailleurs dans ce projet, voir App.jsx) : les coder en dur dans
 * ce fichier statique les ferait casser silencieusement tôt ou tard. Les
 * titres réutilisés ci-dessous (Mr. Brightside, Duality...) sont les MÊMES
 * déjà validés et utilisés comme démo ailleurs dans App.jsx — pas de
 * nouveaux identifiants inventés dans ce mock.
 */

export const curatedSessions = [
  {
    id: 'tpl-fractionne-10km',
    title: 'Fractionné Spécial 10km',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-red-500 to-orange-500',
    tracks: [
      { youtubeId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222, preview: null },
      { youtubeId: 'L_jWHffIx5E', title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170, preview: null },
      { youtubeId: 'v2H4l9RpkwM', title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252, preview: null },
      { youtubeId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292, preview: null },
      { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210, preview: null },
    ],
  },
  {
    id: 'tpl-endurance-fondamentale',
    title: 'Endurance Fondamentale',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Endurance Fondamentale',
    workoutType: 'Course à pied',
    coverGradient: 'from-emerald-500 to-teal-600',
    tracks: [
      { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210, preview: null },
      { youtubeId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292, preview: null },
      { youtubeId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222, preview: null },
    ],
  },
  {
    id: 'tpl-crescendo-cyclisme',
    title: 'Montée en Puissance à Vélo',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Cyclisme',
    coverGradient: 'from-purple-500 to-indigo-500',
    tracks: [
      { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210, preview: null },
      { youtubeId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222, preview: null },
      { youtubeId: 'L_jWHffIx5E', title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170, preview: null },
      { youtubeId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292, preview: null },
    ],
  },
  {
    id: 'tpl-5km-quotidien',
    title: 'Mon 5km Quotidien',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Cardio Express',
    workoutType: 'Course à pied',
    coverGradient: 'from-rose-500 to-red-600',
    tracks: [
      { youtubeId: 'v2H4l9RpkwM', title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252, preview: null },
      { youtubeId: 'L_jWHffIx5E', title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170, preview: null },
      { youtubeId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222, preview: null },
    ],
  },
  {
    id: 'tpl-muscu-force',
    title: 'Séance Force en Salle',
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    category: 'Force & Renfo',
    workoutType: 'Musculation',
    coverGradient: 'from-slate-500 to-gray-700',
    tracks: [
      { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210, preview: null },
      { youtubeId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292, preview: null },
    ],
  },
];
