import { createContext, useContext, useState } from 'react';
import { useGeneratorForm } from '../hooks/useGeneratorForm';
import { useCustomActivity } from '../hooks/useCustomActivity';

/**
 * GeneratorContext.jsx — Étape 1/2 du chantier "God Component" : sort tout
 * l'état PROPRE au wizard de génération (useGeneratorForm, useCustomActivity,
 * `workoutType`) de App.jsx, pour que GeneratorView le lise directement via
 * `useGeneratorContext()` au lieu de le recevoir en dizaines de props
 * individuelles. Objectif de cette étape : livrer le Contexte seul, sans
 * toucher à App.jsx/GeneratorView.jsx — le branchement réel est l'étape 2.
 *
 * ==========================================================================
 * DÉCISION DE PÉRIMÈTRE IMPORTANTE (vérifiée dans le code réel, pas supposée) :
 * ==========================================================================
 * Le brief initial proposait d'y regrouper aussi `useAthleticProfile` en
 * entier. Après audit de App.jsx, ce n'est PAS possible sans risque :
 *
 * - `athleticProfile` (+ `getProfileForWorkout`, `getProfileForWorkoutOrDefault`,
 *   et tous les setters de zones/activités) est aussi consommé DIRECTEMENT
 *   par StatsView et PlaylistDetailView (pas seulement GeneratorView) — voir
 *   App.jsx lignes ~2551 et ~2607.
 * - `isNaughtyMode` et `showAthleticProfile` sont utilisés dans Sidebar.jsx
 *   en plus de GeneratorView (~29 usages de isNaughtyMode dans tout App.jsx).
 * - `useAthleticProfile()` persiste son état via `usePersistentState` : en
 *   appeler une 2e instance ICI, à côté de celle d'App.jsx, créerait DEUX
 *   états React indépendants adossés à la même clé stockage → exactement le
 *   genre de désynchronisation que ce projet s'est donné pour règle d'évacuer
 *   par construction (voir passation, "donnée calculée > donnée stockée
 *   redondante"). Une modif de profil faite depuis le générateur ne se
 *   répercuterait pas sur StatsView tant que la page ne serait pas rechargée.
 *
 * Donc : `isNaughtyMode` et l'API athlétique complète (`athleticProfileApi`,
 * le retour intact de `useAthleticProfile()` côté App.jsx) sont reçus en
 * PROPS du Provider — jamais recréés ici — et simplement re-exposés dans la
 * valeur du contexte pour que GeneratorView (et CustomActivityModal, à
 * l'étape 2) n'aient plus qu'UN SEUL point d'entrée (`useGeneratorContext()`)
 * au lieu de deux. La source de vérité reste 100% dans App.jsx, inchangée.
 *
 * `workoutType`/`setWorkoutType`, en revanche, N'A PAS cette contrainte (pas
 * de persistance, pas de consommateur hors générateur SAUF deux fonctions
 * internes à App.jsx elles-mêmes — `addRoutine` et l'ancien
 * `getActiveWorkoutName` — qui devront lire le contexte au lieu d'une
 * variable locale à l'étape 2). C'est donc l'unique bout de state réellement
 * déplacé (plutôt que reçu en prop) dans ce Contexte.
 */

const GeneratorContext = createContext(null);

/**
 * @param {boolean} isNaughtyMode - mode "Intime" global de l'app (reçu, pas possédé)
 * @param {object} athleticProfileApi - retour COMPLET et INCHANGÉ de useAthleticProfile()
 *   côté App.jsx (l'instance unique) : { athleticProfile, getProfileForWorkout,
 *   getDefaultBaseBpm, buildDefaultPreviewProfile, getZoneSpacingForActivity,
 *   setBaseBpmForActivity, setZoneForActivity, resetActivityProfile,
 *   addCustomActivity, removeCustomActivity, setBaseBpmForCustom, setZoneForCustom,
 *   setCadenceIntentForActivity, setCadenceIntentForCustom, isCadenceIntentEligible, ... }
 * @param {boolean} showAthleticProfile - état d'affichage du panneau profil (partagé avec Sidebar, reçu)
 * @param {function} setShowAthleticProfile
 */
export function GeneratorProvider({
  isNaughtyMode,
  athleticProfileApi,
  showAthleticProfile,
  setShowAthleticProfile,
  children,
}) {
  const { athleticProfile } = athleticProfileApi;

  // Seul état réellement CRÉÉ ici (voir docstring plus haut) — déplacé tel
  // quel depuis App.jsx (`const [workoutType, setWorkoutType] = useState(...)`),
  // aucune logique changée.
  const [workoutType, setWorkoutType] = useState('Course à pied');

  const customActivityApi = useCustomActivity(setWorkoutType);
  const { customActivity } = customActivityApi;

  // `athleticProfile` (les données, pas l'API) est le seul bout de l'API
  // athlétique dont useGeneratorForm a besoin en dépendance — exactement ce
  // qu'App.jsx lui passait déjà avant ce chantier.
  const generatorFormApi = useGeneratorForm(isNaughtyMode, athleticProfile);

  // Déplacée telle quelle depuis App.jsx (n'y était jamais appelée ailleurs
  // que passée en prop à GeneratorView — sûr à relocaliser entièrement ici).
  const getActiveWorkoutName = () =>
    (workoutType === 'Autre' && customActivity.trim() !== '') ? customActivity : workoutType;

  const value = {
    // --- Réellement possédé par ce Provider ---
    workoutType, setWorkoutType,
    getActiveWorkoutName,
    ...customActivityApi,
    ...generatorFormApi,

    // --- Reçu en props, simplement re-exposé (source de vérité = App.jsx) ---
    isNaughtyMode,
    showAthleticProfile, setShowAthleticProfile,
    ...athleticProfileApi,
  };

  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>;
}

// Fallback silencieux plutôt qu'un throw — même choix que AuthContext.jsx
// (évite un plantage/écran blanc si un composant venait à être rendu/testé
// hors de son Provider). Les valeurs de repli sont volontairement "inertes"
// (pas de crash, mais rien ne se passe) plutôt que des valeurs plausibles
// qui masqueraient l'oubli du Provider.
const FALLBACK = {
  workoutType: 'Course à pied', setWorkoutType: () => {},
  getActiveWorkoutName: () => '',
  customActivity: '', setCustomActivity: () => {},
  tempCustomActivity: '', setTempCustomActivity: () => {},
  isCustomActivityModalOpen: false, setIsCustomActivityModalOpen: () => {},
  handleOpenCustomActivityModal: () => {},
  bpm: 120, setBpm: () => {}, setBpmManual: () => {},
  segments: [], setSegments: () => {},
  selectedGenres: [], setSelectedGenres: () => {},
  isNaughtyMode: false,
  showAthleticProfile: false, setShowAthleticProfile: () => {},
  athleticProfile: { activities: {}, custom: [] },
  getProfileForWorkout: () => ({ isConfigured: false }),
  applyProfileBpmIfUntouched: () => {},
};

export function useGeneratorContext() {
  const ctx = useContext(GeneratorContext);
  return ctx || FALLBACK;
}
