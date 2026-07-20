/**
 * curatedSessions.js — Bibliothèque de modèles de séances "ensemencée" par
 * TempoFit (voir DiscoverView.jsx), pour éviter une page vide au lancement
 * de "Découvrir" avant qu'une vraie communauté n'existe (Cold Start
 * Problem).
 *
 * RETOUR DIRECT important avant de lire la suite : `author`/`upvotes`/
 * `isOfficial` sont bien "future-proof" pour la V2 communautaire (votes,
 * auteurs utilisateurs) comme demandé — MAIS `upvotes` reste à `0` sur
 * TOUS les modèles ci-dessous, jamais un chiffre inventé (342, 89...)
 * présenté comme un vrai vote à un vrai utilisateur. Le badge "Sélection
 * TempoFit" (`isOfficial`) sert de preuve sociale HONNÊTE en attendant de
 * vrais votes — voir DiscoverView.jsx/TemplateCard.jsx pour comment ce choix
 * se traduit à l'affichage (le nombre de votes ne s'affiche QUE si > 0).
 *
 * `payload` mappe DIRECTEMENT sur les vrais champs attendus par le
 * générateur — deux origines différentes, à respecter au moment du
 * câblage (voir DiscoverView.jsx, étape suivante) :
 *   - `workoutType` (+ `customActivity` si jamais utilisé) : géré dans
 *     App.jsx directement (`useState`), PAS dans useGeneratorForm.js.
 *   - Tout le reste (`structureMode`, `targetMode`, `hours`/`minutes` ou
 *     `distanceVal`/`distanceUnit`, `bpm`, `bpmTolerance`, `selectedGenres`,
 *     `segments`) : exposés par useGeneratorForm.js, mêmes noms exacts que
 *     ses propres `useState` (voir ce fichier) — pas de champs inventés.
 *   - `segments` (mode Fractionné/Crescendo uniquement) : même forme que
 *     `{ id, bpm, durationValue }` utilisée nativement par
 *     useGeneratorForm.js (durationValue en minutes si targetMode='time',
 *     en km si 'distance') — `id` régénéré au moment de l'application du
 *     modèle (voir DiscoverView.jsx), pas besoin de le fixer ici.
 */

export const curatedSessions = [
  {
    id: 'tpl-fractionne-10km',
    title: 'Fractionné Spécial 10km',
    description: "Alterne effort soutenu et récupération active pour préparer une course sur route.",
    category: 'Cardio Express',
    tags: ['Course à pied', 'Fractionné', '35 min'],
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    payload: {
      workoutType: 'Course à pied',
      structureMode: 'interval',
      targetMode: 'time',
      hours: 0,
      minutes: 35,
      bpm: 165,
      bpmTolerance: 8,
      selectedGenres: ['Rock', 'Électro'],
      segments: [
        { bpm: 130, durationValue: 8 },  // échauffement
        { bpm: 175, durationValue: 3 },
        { bpm: 130, durationValue: 2 },
        { bpm: 175, durationValue: 3 },
        { bpm: 130, durationValue: 2 },
        { bpm: 175, durationValue: 3 },
        { bpm: 130, durationValue: 2 },
        { bpm: 130, durationValue: 8 },  // retour au calme
      ],
    },
  },
  {
    id: 'tpl-endurance-fondamentale',
    title: 'Endurance Fondamentale 45min',
    description: "Un rythme stable et confortable pour construire ton endurance de base, sans forcer.",
    category: 'Endurance Fondamentale',
    tags: ['Course à pied', 'Allure constante', '45 min'],
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    payload: {
      workoutType: 'Course à pied',
      structureMode: 'constant',
      targetMode: 'time',
      hours: 0,
      minutes: 45,
      bpm: 140,
      bpmTolerance: 10,
      selectedGenres: ['Pop', 'Rock'],
    },
  },
  {
    id: 'tpl-crescendo-cyclisme',
    title: 'Montée en Puissance à Vélo',
    description: "Échauffement progressif, cœur de séance intense, retour au calme en douceur — la structure Crescendo classique.",
    category: 'Cardio Express',
    tags: ['Cyclisme', 'Crescendo', '50 min'],
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    payload: {
      workoutType: 'Cyclisme',
      structureMode: 'crescendo',
      targetMode: 'time',
      hours: 0,
      minutes: 50,
      bpm: 150,
      bpmTolerance: 6,
      selectedGenres: ['Électro', 'Rap'],
    },
  },
  {
    id: 'tpl-5km-quotidien',
    title: 'Mon 5km Quotidien',
    description: "Une distance fixe, un rythme soutenu — l'essentiel pour une sortie efficace au quotidien.",
    category: 'Cardio Express',
    tags: ['Course à pied', 'Distance', '5 km'],
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    payload: {
      workoutType: 'Course à pied',
      structureMode: 'constant',
      targetMode: 'distance',
      distanceVal: 5,
      distanceUnit: 'km',
      bpm: 160,
      bpmTolerance: 10,
      selectedGenres: ['Métal', 'Rock'],
    },
  },
  {
    id: 'tpl-muscu-force',
    title: 'Séance Force en Salle',
    description: "Un tempo posé et régulier, pensé pour accompagner une séance de musculation sans te presser.",
    category: 'Force & Renfo',
    tags: ['Musculation', 'Allure constante', '40 min'],
    author: 'TempoFit Officiel',
    isOfficial: true,
    upvotes: 0,
    payload: {
      workoutType: 'Musculation',
      structureMode: 'constant',
      targetMode: 'time',
      hours: 0,
      minutes: 40,
      bpm: 128,
      bpmTolerance: 12,
      selectedGenres: ['Rap', 'Électro'],
    },
  },
];
