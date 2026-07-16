/**
 * appConfig.js — Configuration applicative de TempoFit, séparée de App.jsx.
 *
 * Contient uniquement de la DONNÉE (pas de state, pas de hooks React, pas
 * d'appel réseau) : définitions des trophées, types d'activité, libellés et
 * icônes du mode Intime, valeurs par défaut du wizard, icônes de routine, et
 * fréquences de génération automatique. Même logique d'extraction que
 * musicCatalog.js — ne pas mélanger données et logique applicative dans un
 * seul fichier.
 */

import { Footprints, Dumbbell, Bike, MoreHorizontal, Wind, Heart, Flame } from 'lucide-react';

// Définition des trophées débloquables et de leur condition de déblocage.
// `requirement.type` détermine comment `checkTrophies` évalue la condition :
//   - 'total'   : nombre total de sessions terminées >= count
//   - 'naughty' : nombre de sessions "mode intime" terminées >= count
//   - 'data'    : nombre d'imports CSV (Garmin/Strava) >= count
//   - 'replace' : nombre de remplacements de titres >= count
//   - 'custom'  : un flag booléen arbitraire dans userStats (ex. hasMarathon)
const TROPHIES_DATA = [
  { id: 't_first', name: 'Premier Pas', desc: 'Complète ta toute 1ère session d\'entraînement.', icon: '🥉', requirement: { type: 'total', count: 1 } },
  { id: 't_regular', name: 'Athlète Régulier', desc: 'Complète 5 sessions. La constance est la clé !', icon: '🥈', requirement: { type: 'total', count: 5 } },
  { id: 't_machine', name: 'La Machine', desc: 'Complète 30 sessions. Un mois entier d\'efforts.', icon: '🏆', requirement: { type: 'total', count: 30 } },
  { id: 't_lover', name: 'Tempo Lover', desc: 'Complète une session avec le mode "Intime".', icon: '🔥', requirement: { type: 'naughty', count: 1 } },
  { id: 't_data', name: 'Data Scientist', desc: 'Importe tes données réelles (cadence PPM et/ou fréquence cardiaque, via Garmin/Strava) pour analyse.', icon: '📊', requirement: { type: 'data', count: 1 } },
  { id: 't_marathon', name: 'Le Marathonien', desc: 'Génère une session de plus de 42 km ou 4 heures.', icon: '🏅', secret: true, requirement: { type: 'custom', key: 'hasMarathon' } },
  { id: 't_bolt', name: 'La Foudre', desc: 'Génère une session avec un rythme extrême (> 180 BPM ou < 4:00/km).', icon: '⚡', secret: true, requirement: { type: 'custom', key: 'hasBolt' } },
  { id: 't_hiit', name: 'Maître du HIIT', desc: 'Génère une session fractionnée complexe (5 portions ou plus).', icon: '📈', secret: true, requirement: { type: 'custom', key: 'hasHiitMaster' } },
  { id: 't_dj', name: 'Le Mixeur', desc: 'Utilise le bouton "Remplacer" 3 fois pour parfaire tes playlists.', icon: '🎛️', requirement: { type: 'replace', count: 3 } },
  { id: 't_night', name: 'Oiseau de Nuit', desc: 'Complète une session entre 22h et 5h du matin.', icon: '🦉', secret: true, requirement: { type: 'custom', key: 'hasNightOwl' } },
  { id: 't_rickroll', name: 'Never Gonna Give You Up', desc: 'Tu as trouvé le secret ultime de l\'application.', icon: '🕺', secret: true, requirement: { type: 'custom', key: 'hasRickroll' } },
  // --- Ajoutés lors d'une passe de mise à jour, pour couvrir des fonctionnalités
  // (Crescendo, planification, mode clair) arrivées après le premier jeu de
  // trophées et jamais reflétées ici depuis. ---
  { id: 't_structures', name: 'Les 3 Visages de l\'Effort', desc: 'Génère au moins une fois chacune des 3 structures : Allure Constante, Crescendo et Fractionné.', icon: '🎭', requirement: { type: 'custom', key: 'hasAllStructures' } },
  { id: 't_crescendo', name: 'Le Grimpeur', desc: 'Complète une séance en mode Crescendo.', icon: '⛰️', requirement: { type: 'custom', key: 'hasCrescendoCompleted' } },
  { id: 't_onTime', name: 'Pile à l\'Heure', desc: 'Complète une séance exactement à la date que tu avais planifiée.', icon: '🎯', secret: true, requirement: { type: 'custom', key: 'hasOnTimeCompletion' } },
  { id: 't_allTypes', name: 'Touche-à-Tout', desc: 'Complète au moins une séance de Course à pied, Musculation ET Cyclisme.', icon: '🤹', requirement: { type: 'custom', key: 'hasAllWorkoutTypes' } },
  { id: 't_100km', name: '100 Bornes au Compteur', desc: 'Cumule 100 km parcourus sur l\'ensemble de tes séances.', icon: '🛣️', secret: true, requirement: { type: 'custom', key: 'has100km' } },
  { id: 't_lightMode', name: 'Adepte de la Lumière', desc: 'Active le mode clair au moins une fois. Bienvenue de l\'autre côté.', icon: '☀️', requirement: { type: 'custom', key: 'hasLightMode' } },
  { id: 't_streak', name: 'Sur ta Lancée', desc: 'Complète une séance 3 jours d\'affilée.', icon: '🔗', secret: true, requirement: { type: 'custom', key: 'hasStreak3' } },
  // --- Ajoutés lors d'une 2e passe, après clarification : la logique
  // trophées vise avant tout à inciter à ESSAYER chaque fonctionnalité de
  // l'app, pas juste à récompenser du volume. ---
  { id: 't_extraGenre', name: 'Explorateur de Genres', desc: 'Déplie "+ Plus de genres" et génère une session avec l\'un d\'eux.', icon: '🧭', requirement: { type: 'custom', key: 'hasExtraGenre' } },
  { id: 't_planner', name: 'Planificateur', desc: 'Donne une date à une playlist dans "Mes Séances", pour la première fois.', icon: '📅', requirement: { type: 'custom', key: 'hasPlannedSession' } },
  { id: 't_autoGen', name: 'Pilote Automatique', desc: 'Active la génération automatique sur une routine.', icon: '🤖', requirement: { type: 'custom', key: 'hasAutoGen' } },
  { id: 't_firstRoutine', name: 'Ma Première Routine', desc: 'Sauvegarde ta toute première routine réutilisable.', icon: '📋', requirement: { type: 'custom', key: 'hasFirstRoutine' } },
  { id: 't_sharer', name: 'Ambassadeur', desc: 'Utilise le bouton Partager, sur une playlist ou un trophée.', icon: '📣', requirement: { type: 'custom', key: 'hasSharedSomething' } },
  { id: 't_favorites', name: 'Fidèle à tes Artistes', desc: 'Génère une session en utilisant tes Favoris.', icon: '⭐', requirement: { type: 'custom', key: 'hasUsedFavorites' } },
];

const NAUGHTY_ROUTINE_NAMES = ["🍑 Cardio Horizontal", "🔥 Entraînement au lit", "💦 Session Sous la Couette", "😈 Sprint Nocturne"];

// Zones d'intensité de CADENCE musicale (BPM) du "Profil Athlétique" — voir
// useAthleticProfile.js pour les valeurs propres à l'utilisateur (ce tableau-
// ci ne contient que les métadonnées d'AFFICHAGE, partagées par SettingsView,
// GeneratorView et StatsView : un seul endroit à modifier si l'ordre, les
// libellés ou les couleurs doivent changer).
// ⚠️ "Cadence"/"Allure musicale", jamais "Cardio" (voir useAthleticProfile.js) :
// une zone de fréquence CARDIAQUE réelle existe déjà ailleurs dans l'app
// (import Garmin/Strava, voir useSessionAnalysis.js) — les deux ne doivent
// jamais se confondre dans le vocabulaire affiché à l'écran.
const ATHLETIC_ZONES = [
  { key: 'zone1', label: 'Récupération / Échauffement', shortLabel: 'Récupération', color: '#3b82f6' },
  { key: 'zone2', label: 'Endurance fondamentale / Footing', shortLabel: 'Endurance', color: '#22c55e' },
  { key: 'zone3', label: 'Seuil / Tempo', shortLabel: 'Seuil', color: '#f59e0b' },
  { key: 'zone4', label: 'Vitesse / VMA', shortLabel: 'Vitesse', color: '#ef4444' },
];

const WORKOUT_TYPES = [
  { id: 'Course à pied', icon: Footprints },
  { id: 'Musculation', icon: Dumbbell },
  { id: 'Cyclisme', icon: Bike },
  { id: 'Autre', icon: MoreHorizontal } 
];

// Libellés affichés à la place des noms d'activité classiques quand le mode Intime
// est actif — purement cosmétique : la valeur `id` ci-dessus (utilisée par toute la
// logique de génération/sauvegarde) ne change jamais, seul le texte affiché à l'écran
// est substitué. Construits comme un vrai gradient d'intensité (pas juste des noms
// rigolos indépendants) : Douceur (Cyclisme) → Passion (Course à pied) → Intensité
// (Musculation). "Autre" reste neutre, car c'est la porte d'entrée du mode Intime
// lui-même (via l'icône flamme), pas un échelon de cette échelle.
const NAUGHTY_WORKOUT_LABELS = {
  'Cyclisme': 'Douceur',
  'Course à pied': 'Passion',
  'Musculation': 'Intensité',
  'Autre': 'Autre'
};
// Icônes assorties au même gradient (vent doux → cœur → flamme), remplaçant les
// icônes de sport classiques (vélo/course/haltère) qui n'évoquaient rien de ce thème.
const NAUGHTY_WORKOUT_ICONS = {
  'Cyclisme': Wind,
  'Course à pied': Heart,
  'Musculation': Flame,
  'Autre': MoreHorizontal
};
// Ordre d'affichage spécifique au mode Intime, pour que la grille se lise de gauche
// à droite / haut en bas comme une progression douceur → intensité. Le mode standard
// garde l'ordre d'origine de WORKOUT_TYPES, inchangé.
const NAUGHTY_WORKOUT_ORDER = ['Cyclisme', 'Course à pied', 'Musculation', 'Autre'];

// BPM proposé par défaut selon l'activité choisie à l'étape 1 — avant, choisir
// Course à pied, Musculation ou Cyclisme n'avait strictement aucun effet sur le
// BPM proposé ensuite (toujours la même valeur par défaut, peu importe le choix).
// Deux jeux de valeurs : un pour le mode standard, un pour le mode Intime (dont la
// plage de BPM utilisable est différente — 40-130 contre 80-200 en standard, voir
// le slider de l'étape 3). "Autre" garde une valeur neutre dans les deux cas,
// puisque l'activité réelle est alors définie librement par l'utilisateur.
const WORKOUT_DEFAULT_BPM = {
  standard: { 'Course à pied': 160, 'Musculation': 120, 'Cyclisme': 140, 'Autre': 140 },
  naughty: { 'Cyclisme': 70, 'Course à pied': 95, 'Musculation': 115, 'Autre': 85 }
};

// Mode (temps/distance) et durée ou distance proposés par défaut selon l'activité
// et le mode actif — même logique que WORKOUT_DEFAULT_BPM ci-dessus, appliquée
// cette fois à l'étape 2/3 du wizard plutôt qu'au BPM. La distance ne fait sens
// qu'en mode standard (le mode Intime force déjà le temps, voir toggleNaughtyMode) :
// Course à pied et Cyclisme y sont donc en distance, avec des kilométrages réalistes
// différents (le vélo couvre naturellement plus de distance que la course à pied
// pour un effort comparable). En mode Intime, la durée varie avec l'intensité :
// plus longue et détendue pour "Douceur", plus courte et intense pour "Intensité".
const WORKOUT_DEFAULT_TARGET = {
  standard: {
    'Course à pied': { targetMode: 'distance', distanceVal: 5, distanceUnit: 'km' },
    'Cyclisme':      { targetMode: 'distance', distanceVal: 20, distanceUnit: 'km' },
    'Musculation':   { targetMode: 'time', hours: 0, minutes: 45 },
    'Autre':         { targetMode: 'time', hours: 0, minutes: 45 }
  },
  naughty: {
    'Cyclisme':      { targetMode: 'time', hours: 0, minutes: 45 },
    'Course à pied': { targetMode: 'time', hours: 0, minutes: 30 },
    'Musculation':   { targetMode: 'time', hours: 0, minutes: 20 },
    'Autre':         { targetMode: 'time', hours: 0, minutes: 30 }
  }
};

// Icônes proposées pour personnaliser une routine sauvegardée, et fréquences de
// génération automatique disponibles (voir routine.autoGenFreq).
const AVAILABLE_ICONS = ["🏃‍♂️", "🚴‍♀️", "🏋️‍♂️", "🧘‍♀️", "🔥", "⚡", "🎵", "🏆", "🎧", "🎸", "🥁", "🎹", "🍑", "🍆", "🕺"];
const AUTO_GEN_OPTIONS = ["Manuel", "1 fois / jour", "2 fois / jour", "1 fois / semaine"];

export {
  TROPHIES_DATA,
  NAUGHTY_ROUTINE_NAMES,
  ATHLETIC_ZONES,
  WORKOUT_TYPES,
  NAUGHTY_WORKOUT_LABELS,
  NAUGHTY_WORKOUT_ICONS,
  NAUGHTY_WORKOUT_ORDER,
  WORKOUT_DEFAULT_BPM,
  WORKOUT_DEFAULT_TARGET,
  AVAILABLE_ICONS,
  AUTO_GEN_OPTIONS
};
