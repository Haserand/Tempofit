import { WORKOUT_DEFAULT_BPM } from './appConfig';

/**
 * athleticZones.js — logique de calcul PURE derrière le "Profil Athlétique"
 * (useAthleticProfile.js) : dérivation des 4 zones BPM musicales à partir
 * d'un BPM de base et d'un espacement, selon l'activité et l'intention
 * (Énergie vs Synchro cadence).
 *
 * Extrait de useAthleticProfile.js (qui importe React pour useEffect) afin
 * que cette logique — déjà 100% pure, sans state ni hook — soit testable
 * directement avec le test runner natif de Node, sans dépendance à installer
 * (voir src/utils/numberInput.test.js pour le même principe). Aucun
 * changement de comportement : ce fichier est un déplacement à l'identique,
 * useAthleticProfile.js importe maintenant ces fonctions au lieu de les
 * définir localement.
 */

// Plancher bas volontairement généreux (40 BPM) : même valeur numérique que
// le plancher BPM du mode Intime ailleurs dans l'app (voir GeneratorView,
// bpmFloor) — sert seulement à éviter une Zone 1 absurde si quelqu'un saisit
// un BPM cible très bas, jamais un vrai jugement sur ce qui est "trop lent".
// Sport-agnostique volontairement : c'est une borne de sécurité sur un BPM
// MUSICAL cible (voir le pivot de modèle documenté dans useAthleticProfile.js),
// donc pas de raison d'en faire une borne différente par sport.
export const ATHLETIC_BPM_FLOOR = 40;

// Espacement (en BPM) entre 2 zones consécutives, selon l'activité — reste un
// point de départ RAISONNABLE inspiré de l'écart de cadence réel observé entre
// un footing facile et un effort proche de la VMA (20 à 45 pas/min selon
// McMillan Running/RunBikeCalc/TrainingPeaks) : ces zones décrivent un BPM
// MUSICAL cible, pas une cadence physique mesurée — mais l'écart type entre
// zones reste un repère crédible pour espacer 4 tempos progressifs, même si
// rien n'oblige à le suivre à la lettre (ajustable au BPM près via "Ajuster
// manuellement"). 5 BPM/palier pour Cyclisme (progression plus resserrée en
// pratique) contre 15 pour Course à pied.
//
// Honnêteté : pour une activité personnalisée (patin, elliptique...),
// impossible de deviner un espacement spécifique sans plus d'info sur le
// sport — la valeur par défaut (10) s'y applique, ajustable de toute façon au
// BPM près via "Ajuster manuellement".
export const ZONE_SPACING_BY_ACTIVITY = {
  'Course à pied': 15,
  'Cyclisme': 5,
};
export const DEFAULT_ZONE_SPACING = 10;

// Espacement resserré utilisé UNIQUEMENT si `cadenceIntent === 'sync'` pour
// cette activité — sinon `ZONE_SPACING_BY_ACTIVITY` ci-dessus reste la
// référence, comportement 100% inchangé par défaut.
export const SYNC_ZONE_SPACING_BY_ACTIVITY = {
  'Course à pied': 6,
  'Cyclisme': 3,
};
export const DEFAULT_SYNC_ZONE_SPACING = 4;

// Activités où la notion même de "cadence" (un rythme de mouvement répété,
// pas/pédalage) n'a pas de sens — Musculation n'a pas de rythme cyclique
// comparable, donc pas de mode Synchro proposé pour elle. Toute activité
// personnalisée reste éligible par défaut.
export const CADENCE_INTENT_INELIGIBLE_ACTIVITIES = ['Musculation'];
export const isCadenceIntentEligible = (activityKey) =>
  !CADENCE_INTENT_INELIGIBLE_ACTIVITIES.includes(activityKey);

export const emptyProfile = () => ({
  isConfigured: false,
  targetBpm: null,
  zone1: null,
  zone2: null,
  zone3: null,
  zone4: null,
  cadenceIntent: 'energy',
});

export const computeZonesFromBaseBpm = (base, spacing = DEFAULT_ZONE_SPACING) => ({
  zone1: Math.max(ATHLETIC_BPM_FLOOR, base - spacing),
  zone2: Math.max(ATHLETIC_BPM_FLOOR, base),
  zone3: Math.max(ATHLETIC_BPM_FLOOR, base + spacing),
  zone4: Math.max(ATHLETIC_BPM_FLOOR, base + spacing * 2),
});

// BPM cible CRÉDIBLE par activité, utilisée uniquement pour PRÉ-REMPLIR
// l'Assistant Rapide et les champs "Ajuster manuellement" avant toute vraie
// saisie — jamais pour décider `isConfigured`. Réutilise volontairement
// `WORKOUT_DEFAULT_BPM` (appConfig.js) plutôt que d'inventer de nouveaux
// chiffres : ce sont déjà les BPM par défaut du wizard pour ces mêmes
// activités (160 Course à pied, 140 Cyclisme). "Autre"/repli pour toute
// activité personnalisée, faute d'un chiffre spécifique par discipline.
export const getDefaultBaseBpm = (activityKey) =>
  WORKOUT_DEFAULT_BPM.standard[activityKey] ?? WORKOUT_DEFAULT_BPM.standard['Autre'];

// Profil "aperçu" complet (BPM de base + 4 zones déjà calculées) pour une
// activité qui n'a JAMAIS été configurée — `isConfigured` reste `false` :
// ceci sert de valeur d'AFFICHAGE par défaut, pas une vraie configuration
// silencieuse. Sert aussi de bloc de départ dans setZoneForActivity/
// setZoneForCustom (useAthleticProfile.js) : si la personne ajuste UNE SEULE
// zone à la main sans être jamais passée par l'Assistant Rapide, les 3
// AUTRES zones doivent se retrouver enregistrées avec ces mêmes valeurs par
// défaut déjà affichées à l'écran — jamais `null` en douce.
export const buildDefaultPreviewProfile = (activityKey, cadenceIntent = 'energy') => {
  const base = getDefaultBaseBpm(activityKey);
  const spacing = cadenceIntent === 'sync'
    ? (SYNC_ZONE_SPACING_BY_ACTIVITY[activityKey] ?? DEFAULT_SYNC_ZONE_SPACING)
    : (ZONE_SPACING_BY_ACTIVITY[activityKey] ?? DEFAULT_ZONE_SPACING);
  return { isConfigured: false, targetBpm: base, cadenceIntent, ...computeZonesFromBaseBpm(base, spacing) };
};

// Espacement RÉEL utilisé pour une activité donnée — exposé pour que l'UI
// (infobulle "méthode de calcul", GeneratorView.jsx) puisse afficher le vrai
// chiffre plutôt que de deviner/dupliquer les tables d'espacement.
// `cadenceIntent` optionnel (repli 'energy', comportement historique
// inchangé si l'appelant ne sait rien du mode Synchro).
export const getZoneSpacingForActivity = (activityKey, cadenceIntent = 'energy') =>
  cadenceIntent === 'sync'
    ? (SYNC_ZONE_SPACING_BY_ACTIVITY[activityKey] ?? DEFAULT_SYNC_ZONE_SPACING)
    : (ZONE_SPACING_BY_ACTIVITY[activityKey] ?? DEFAULT_ZONE_SPACING);
