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
//
// `category` (retour direct : "mieux les catégoriser globalement") — sert
// UNIQUEMENT à regrouper les trophées VISIBLES (`!secret`) dans TrophiesView,
// sous 3 en-têtes plutôt qu'une liste plate dans l'ordre historique d'ajout :
//   - 'progression'  : volume brut de séances (constance dans le temps)
//   - 'feature'       : inciter à ESSAYER une fonctionnalité précise de l'app
//   - 'habit'         : petites habitudes/comportements transversaux, pas
//                       rattachés à une seule fonctionnalité en particulier
// Volontairement ABSENT des trophées `secret: true` : les sous-catégoriser
// donnerait des indices sur leur thème (durée, horaire, série...) avant même
// de les avoir débloqués, ce qui irait à l'encontre de la surprise qui fait
// leur intérêt — la page qui les affiche les garde dans une seule grille non
// groupée (voir TrophiesView.jsx).
const TROPHIES_DATA = [
  { id: 't_first', name: 'Premier Pas', desc: 'Complète ta toute 1ère session d\'entraînement.', icon: '🥉', category: 'progression', requirement: { type: 'total', count: 1 } },
  { id: 't_regular', name: 'Athlète Régulier', desc: 'Complète 5 sessions. La constance est la clé !', icon: '🥈', category: 'progression', requirement: { type: 'total', count: 5 } },
  { id: 't_machine', name: 'La Machine', desc: 'Complète 30 sessions. Un mois entier d\'efforts.', icon: '🏆', category: 'progression', requirement: { type: 'total', count: 30 } },
  { id: 't_lover', name: 'Tempo Lover', desc: 'Complète une session avec le mode "Intime".', icon: '🔥', category: 'feature', requirement: { type: 'naughty', count: 1 } },
  { id: 't_data', name: 'Data Scientist', desc: 'Importe tes données réelles (cadence et/ou fréquence cardiaque, via Garmin/Strava) pour analyse.', icon: '📊', category: 'feature', requirement: { type: 'data', count: 1 } },
  { id: 't_marathon', name: 'Le Marathonien', desc: 'Génère une session de plus de 42 km ou 4 heures.', icon: '🏅', secret: true, requirement: { type: 'custom', key: 'hasMarathon' } },
  { id: 't_bolt', name: 'La Foudre', desc: 'Génère une session avec un rythme extrême (> 180 BPM ou < 4:00/km).', icon: '⚡', secret: true, requirement: { type: 'custom', key: 'hasBolt' } },
  { id: 't_hiit', name: 'Maître du HIIT', desc: 'Génère une session fractionnée complexe (5 portions ou plus).', icon: '📈', secret: true, requirement: { type: 'custom', key: 'hasHiitMaster' } },
  { id: 't_dj', name: 'Le Mixeur', desc: 'Utilise le bouton "Remplacer" 3 fois pour parfaire tes playlists.', icon: '🎛️', category: 'habit', requirement: { type: 'replace', count: 3 } },
  { id: 't_night', name: 'Oiseau de Nuit', desc: 'Complète une session entre 22h et 5h du matin.', icon: '🦉', secret: true, requirement: { type: 'custom', key: 'hasNightOwl' } },
  { id: 't_rickroll', name: 'Never Gonna Give You Up', desc: 'Tu as trouvé le secret ultime de l\'application.', icon: '🕺', secret: true, requirement: { type: 'custom', key: 'hasRickroll' } },
  // --- Ajoutés lors d'une passe de mise à jour, pour couvrir des fonctionnalités
  // (Crescendo, planification, mode clair) arrivées après le premier jeu de
  // trophées et jamais reflétées ici depuis. ---
  { id: 't_structures', name: 'Les 3 Visages de l\'Effort', desc: 'Génère au moins une fois chacune des 3 structures : Allure Constante, Crescendo et Fractionné.', icon: '🎭', category: 'feature', requirement: { type: 'custom', key: 'hasAllStructures' } },
  { id: 't_crescendo', name: 'Le Grimpeur', desc: 'Complète une séance en mode Crescendo.', icon: '⛰️', category: 'feature', requirement: { type: 'custom', key: 'hasCrescendoCompleted' } },
  { id: 't_onTime', name: 'Pile à l\'Heure', desc: 'Complète une séance exactement à la date que tu avais planifiée.', icon: '🎯', secret: true, requirement: { type: 'custom', key: 'hasOnTimeCompletion' } },
  { id: 't_allTypes', name: 'Touche-à-Tout', desc: 'Complète au moins une séance de Course à pied, Musculation ET Cyclisme.', icon: '🤹', category: 'habit', requirement: { type: 'custom', key: 'hasAllWorkoutTypes' } },
  { id: 't_100km', name: '100 Bornes au Compteur', desc: 'Cumule 100 km parcourus sur l\'ensemble de tes séances.', icon: '🛣️', secret: true, requirement: { type: 'custom', key: 'has100km' } },
  { id: 't_lightMode', name: 'Adepte de la Lumière', desc: 'Active le mode clair au moins une fois. Bienvenue de l\'autre côté.', icon: '☀️', category: 'feature', requirement: { type: 'custom', key: 'hasLightMode' } },
  { id: 't_streak', name: 'Sur ta Lancée', desc: 'Complète une séance 3 jours d\'affilée.', icon: '🔗', secret: true, requirement: { type: 'custom', key: 'hasStreak3' } },
  // --- Ajoutés lors d'une 2e passe, après clarification : la logique
  // trophées vise avant tout à inciter à ESSAYER chaque fonctionnalité de
  // l'app, pas juste à récompenser du volume. ---
  { id: 't_extraGenre', name: 'Explorateur de Genres', desc: 'Déplie "+ Plus de genres" et génère une session avec l\'un d\'eux.', icon: '🧭', category: 'feature', requirement: { type: 'custom', key: 'hasExtraGenre' } },
  { id: 't_planner', name: 'Planificateur', desc: 'Donne une date à une playlist dans "Mes Séances", pour la première fois.', icon: '📅', category: 'feature', requirement: { type: 'custom', key: 'hasPlannedSession' } },
  { id: 't_autoGen', name: 'Pilote Automatique', desc: 'Active la génération automatique sur une routine.', icon: '🤖', category: 'feature', requirement: { type: 'custom', key: 'hasAutoGen' } },
  { id: 't_firstRoutine', name: 'Ma Première Routine', desc: 'Sauvegarde ta toute première routine réutilisable.', icon: '📋', category: 'feature', requirement: { type: 'custom', key: 'hasFirstRoutine' } },
  { id: 't_sharer', name: 'Ambassadeur', desc: 'Utilise le bouton Partager, sur une playlist ou un trophée.', icon: '📣', category: 'habit', requirement: { type: 'custom', key: 'hasSharedSomething' } },
  { id: 't_favorites', name: 'Fidèle à tes Artistes', desc: 'Génère une session en utilisant tes Favoris.', icon: '⭐', category: 'feature', requirement: { type: 'custom', key: 'hasUsedFavorites' } },
];

// Métadonnées d'affichage des 3 catégories de trophées visibles (voir
// `category` ci-dessus) — un seul endroit pour le libellé/l'ordre affiché,
// dans TrophiesView. L'ordre de ce tableau EST l'ordre d'affichage des
// sections (progression d'abord, la plus immédiatement gratifiante pour un
// nouvel utilisateur ; habitudes en dernier, plus anecdotiques).
const TROPHY_CATEGORIES = [
  { key: 'progression', label: 'Progression', desc: 'Ta constance dans le temps, séance après séance.' },
  { key: 'feature', label: 'Fonctionnalités à découvrir', desc: 'Une récompense pour avoir essayé chaque recoin de l\'app.' },
  { key: 'habit', label: 'Habitudes & Défis', desc: 'De petits réflexes transversaux, pas liés à une seule fonctionnalité.' },
];

const NAUGHTY_ROUTINE_NAMES = ["🍑 Cardio Horizontal", "🔥 Entraînement au lit", "💦 Session Sous la Couette", "😈 Sprint Nocturne"];

// Zones d'intensité de CADENCE musicale (BPM) du "Profil Athlétique" — voir
// useAthleticProfile.js pour les valeurs propres à l'utilisateur (ce tableau-
// ci ne contient que les métadonnées d'AFFICHAGE, partagées par SettingsView,
// GeneratorView et StatsView : un seul endroit à modifier si l'ordre, les
// libellés ou les couleurs doivent changer).
// ⚠️ "Cadence" (en PPM, pas par minute), jamais "Cardio" NI "BPM" (voir
// useAthleticProfile.js) : une zone de fréquence CARDIAQUE réelle existe déjà
// ailleurs dans l'app (import Garmin/Strava, voir useSessionAnalysis.js), et
// "BPM" (battements par minute) est une unité MUSICALE — les 3 ne doivent
// jamais se confondre dans le vocabulaire affiché à l'écran.
const ATHLETIC_ZONES = [
  { key: 'zone1', label: 'Récupération / Échauffement', shortLabel: 'Récupération', color: '#3b82f6' },
  { key: 'zone2', label: 'Endurance fondamentale / Footing', shortLabel: 'Endurance', color: '#22c55e' },
  { key: 'zone3', label: 'Seuil / Tempo', shortLabel: 'Seuil', color: '#f59e0b' },
  { key: 'zone4', label: 'Vitesse / VMA', shortLabel: 'Vitesse', color: '#ef4444' },
];

// getZoneForValue — "règle d'or d'ergonomie" (retour direct : associer une
// couleur immuable à chaque zone et la réutiliser dans TOUS les graphiques,
// plutôt qu'une palette différente par écran) : LE point d'entrée unique
// pour "à quelle zone appartient cette valeur (BPM/PPM/RPM), et de quelle
// couleur la peindre ?". Généralise `classifyIntoZone`, jusqu'ici une copie
// privée à StatsView.jsx, pour la rendre réutilisable aussi par
// GeneratorView.jsx (visuel Crescendo) et SessionSummaryCard.jsx (export
// image) — un seul endroit à corriger si la logique de classification change
// un jour, plutôt que 3 implémentations qui pourraient diverger.
//
// Classification par PLUS PROCHE VOISIN (comme l'existant dans StatsView) —
// pas des bornes fixes calculées à la main : reste correct même si les zones
// ne sont pas régulièrement espacées (ex. ajustées à la main en mode Expert
// plutôt que via l'Assistant Rapide).
//
// `activityNameOrType` = le nom déjà résolu de l'activité, même convention
// que `useAthleticProfile.getProfileForWorkout` (id WORKOUT_TYPES ou nom
// d'activité personnalisée déjà résolu par l'appelant).
// `getProfileForWorkout` = la fonction exposée par le hook useAthleticProfile,
// passée en paramètre plutôt qu'importée ici (ce fichier de config n'a pas
// accès aux hooks React).
//
// Renvoie `null` si aucun profil n'est configuré pour cette activité (ou si
// `value`/`getProfileForWorkout` sont absents) — à l'appelant de décider du
// repli visuel (couleur neutre, palette générique...), jamais une couleur
// inventée silencieusement ici.
const getZoneForValue = (value, activityNameOrType, getProfileForWorkout, customActivityName = '') => {
  if (value == null || !getProfileForWorkout) return null;
  const profile = getProfileForWorkout(activityNameOrType, customActivityName);
  if (!profile || !profile.isConfigured) return null;
  let best = null, bestDist = Infinity;
  ATHLETIC_ZONES.forEach(z => {
    const zoneVal = profile[z.key];
    if (zoneVal == null) return;
    const dist = Math.abs(value - zoneVal);
    if (dist < bestDist) { bestDist = dist; best = z; }
  });
  return best; // { key, label, shortLabel, color } ou null
};

// RETOUR DIRECT : "parler de PPM pour du cyclisme n'est pas adapté" — PPM
// (Pas Par Minute) compte des FOULÉES, ça n'a de sens qu'en course à pied. À
// vélo, la cadence se mesure en tours de pédalier par minute (RPM, unité déjà
// universellement utilisée par les compteurs vélo/Garmin/Wahoo, y compris en
// français) — PAS en "pas". Centralisé ici (un seul endroit à corriger si une
// 3e unité s'avère nécessaire un jour) plutôt que codé en dur "PPM" à chaque
// endroit qui affiche une cadence (Profil Athlétique ET analyse de données
// réelles Garmin/Strava, voir PlaylistDetailView.jsx/useSessionAnalysis.js —
// les deux avaient la même confusion). "cad/min" en repli générique pour une
// activité personnalisée (patin, aviron, elliptique...) : impossible de
// deviner à l'avance la bonne unité physique pour un sport inconnu au moment
// d'écrire ce code — plutôt avouer l'incertitude qu'afficher une unité fausse.
const CADENCE_UNIT_BY_ACTIVITY = {
  'Course à pied': 'PPM',
  'Cyclisme': 'RPM',
};
const DEFAULT_CADENCE_UNIT = 'cad/min';
const getCadenceUnitLabel = (activityKeyOrName) => CADENCE_UNIT_BY_ACTIVITY[activityKeyOrName] ?? DEFAULT_CADENCE_UNIT;

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

// Palette générique par INDEX (pas sémantique — pas de lien avec une zone
// précise) pour des répartitions qui n'ont rien à voir avec l'intensité
// d'effort : genre musical (PlaylistDetailView.jsx, "Répartition par style"),
// et repli du camembert BPM d'une séance quand aucun Profil Athlétique n'est
// configuré pour son activité (voir bpmDistributionData, App.jsx — celui-là
// utilise `ATHLETIC_ZONES`/`getZoneForValue` en priorité, cette palette n'est
// qu'un filet de sécurité). Partagée ici plutôt que dupliquée dans les 2
// fichiers qui l'utilisaient chacun leur propre copie identique.
const DISTRIBUTION_COLORS = ['#f43f5e', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

export {
  TROPHIES_DATA,
  TROPHY_CATEGORIES,
  NAUGHTY_ROUTINE_NAMES,
  ATHLETIC_ZONES,
  getZoneForValue,
  getCadenceUnitLabel,
  WORKOUT_TYPES,
  NAUGHTY_WORKOUT_LABELS,
  NAUGHTY_WORKOUT_ICONS,
  NAUGHTY_WORKOUT_ORDER,
  WORKOUT_DEFAULT_BPM,
  WORKOUT_DEFAULT_TARGET,
  AVAILABLE_ICONS,
  AUTO_GEN_OPTIONS,
  DISTRIBUTION_COLORS
};
