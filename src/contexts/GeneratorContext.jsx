import { createContext, useContext, useState } from 'react';
import { useGeneratorForm } from '../hooks/useGeneratorForm';
import { useCustomActivity } from '../hooks/useCustomActivity';
import { CustomActivityProvider } from './CustomActivityContext';

/**
 * GeneratorContext.jsx — Étape 1/2 du chantier "God Component" : sort tout
 * l'état PROPRE au wizard de génération (useGeneratorForm, useCustomActivity,
 * `workoutType`) de App.jsx, pour que GeneratorView le lise directement via
 * `useGeneratorContext()` au lieu de le recevoir en dizaines de props
 * individuelles.
 *
 * ⚠️ DEPUIS LE 08/08 : `isNaughtyMode`/l'API athlétique complète NE SONT
 * PLUS DANS LA VALEUR DE CE CONTEXTE — déplacés vers `AthleticContext.jsx`
 * (`useAthleticContext()`), à part. Raison : ce Provider re-rend à CHAQUE
 * réglage du wizard (curseur BPM, genres, structure...) puisque
 * `useGeneratorForm()`/`useCustomActivity()` sont appelés ICI MÊME — sa
 * `value` (jamais mémoïsée, et ne PEUT PAS l'être simplement : ces 2 hooks
 * renvoient un objet neuf à chaque rendu) était donc recréée en entier à
 * chaque frappe/glissement, entraînant avec elle TOUT composant qui lisait
 * ne serait-ce qu'`isNaughtyMode` sans rien lire du formulaire
 * (`AthleticProfilePanel`, `CustomActivityModal`...). Voir la docstring de
 * `AthleticContext.jsx` pour le détail complet (notamment la vérification
 * qui a permis d'isoler CE bout sans avoir à toucher `useAthleticProfile.js`
 * lui-même).
 *
 * `GeneratorProvider` reçoit toujours `isNaughtyMode` EN PROP — nécessaire en
 * interne pour `useGeneratorForm(isNaughtyMode)`. `athleticProfileApi`, en
 * revanche, a été entièrement RETIRÉ de sa signature le 25/08 (code mort
 * trouvé mécaniquement, `tsc --noUnusedLocals` — plus aucun consommateur
 * réel une fois `athleticProfile` lui-même nettoyé, voir plus bas). Tout
 * consommateur qui a besoin du profil athlétique doit appeler
 * `useAthleticContext()` EN PLUS de (ou à la place de) `useGeneratorContext()`,
 * selon ce dont il a réellement besoin.
 *
 * ⚠️ DEPUIS LE 08/08 (suite, même jour) : `customActivityApi`
 * (useCustomActivity()) et `applyProfileBpmIfUntouched` NE SONT PLUS NON
 * PLUS dans la valeur de ce Contexte — déplacés vers
 * `CustomActivityContext.jsx` (`useCustomActivityContext()`), à part, monté
 * À L'INTÉRIEUR de ce Provider (voir plus bas). Même raisonnement
 * qu'`AthleticContext.jsx` : `CustomActivityModal.jsx`, montée GLOBALEMENT
 * dans App.jsx, continuait de re-rendre à chaque réglage du wizard à cause
 * de ces champs, même après le découpage d'`AthleticContext.jsx`. Voir la
 * docstring de `CustomActivityContext.jsx` pour le détail complet
 * (notamment pourquoi `applyProfileBpmIfUntouched` a dû être rendue
 * référentiellement stable dans `useGeneratorForm.js` d'abord, sans quoi ce
 * découpage n'aurait servi à rien).
 *
 * ==========================================================================
 * DÉCISION DE PÉRIMÈTRE (héritée, toujours vraie) :
 * ==========================================================================
 * `useAthleticProfile()` n'est PAS appelé ici (ni dans AthleticContext.jsx)
 * — l'instance UNIQUE reste dans App.jsx, reçue en prop. Pourquoi : elle
 * persiste son état via `usePersistentState` — en appeler une 2e instance
 * créerait DEUX états React indépendants adossés à la même clé stockage,
 * exactement le genre de désynchronisation que ce projet évacue par
 * construction. `getProfileForWorkout`/`getProfileForWorkoutOrDefault`
 * (dérivées de cette même instance) sont aussi consommées DIRECTEMENT par
 * StatsView et PlaylistDetailView (pas seulement ici) — encore une raison
 * de garder une seule source de vérité, remontée en props des 2 côtés
 * plutôt que recréée localement.
 *
 * ⚠️ CORRECTION DU 25/08 (une 1re version de cette note, plus bas, affirmait
 * à TORT que `athleticProfile` — la donnée brute — n'avait plus aucun
 * consommateur nulle part dans le projet). Faux : `GeneratorWizard.jsx` la
 * consomme bien, directement, via `useAthleticContext()` (le Contexte
 * DÉDIÉ exposé par `AthleticContext.jsx`, PAS le chemin par props que ce
 * fichier-ci (`GeneratorContext.jsx`) utilisait). Ce qui est réellement mort
 * et retiré le 25/08, c'est UNIQUEMENT le fil de props parallèle et
 * redondant qui existait EN PLUS de ce Contexte : `athleticProfile` transmis
 * (sans jamais être lu) à `useGeneratorForm.js` via ce fichier, et à
 * `StatsView`/`PlaylistDetailView` via App.jsx. Le vrai consommateur
 * (`GeneratorWizard.jsx`, via le Contexte) n'a jamais été touché ni
 * impacté par ce nettoyage.
 *
 * `workoutType`/`setWorkoutType`, en revanche, N'A PAS cette contrainte (pas
 * de persistance, pas de consommateur hors générateur) — c'est le seul bout
 * de state réellement CRÉÉ (plutôt que reçu en prop) dans ce Contexte.
 */

const GeneratorContext = createContext(null);

/**
 * @param {boolean} isNaughtyMode - mode "Intime" global de l'app (reçu, pas possédé —
 *   nécessaire ICI pour `useGeneratorForm(isNaughtyMode)`, mais plus
 *   réexposé dans la valeur de ce Contexte, voir `AthleticContext.jsx`)
 *
 * ⚠️ `athleticProfileApi` retiré de cette signature le 25/08 : plus aucun
 * consommateur réel trouvé ici après remontée complète de la chaîne (voir
 * `athleticProfile` plus bas dans le récit du même nettoyage) —
 * `AthleticProvider` (App.jsx, même niveau) le reçoit déjà séparément pour
 * qui en a réellement besoin, via `useAthleticContext()`.
 */
export function GeneratorProvider({
  isNaughtyMode,
  children,
}) {
  // Seul état réellement CRÉÉ ici (voir docstring plus haut) — déplacé tel
  // quel depuis App.jsx (`const [workoutType, setWorkoutType] = useState(...)`),
  // aucune logique changée.
  const [workoutType, setWorkoutType] = useState('Course à pied');

  const customActivityApi = useCustomActivity(setWorkoutType);
  const { customActivity } = customActivityApi;

  // `athleticProfile` (les données) N'EST PLUS transmis à useGeneratorForm
  // (check-up 25/08 — code mort trouvé mécaniquement via `tsc
  // --noUnusedLocals`, jamais lu dans le corps du hook) : la seule voie
  // RÉELLE par laquelle le profil athlétique influence le formulaire est
  // `applyProfileBpmIfUntouched(activityProfile)`, qui reçoit le profil EN
  // ARGUMENT au moment de l'appel (voir CustomActivityModal.jsx,
  // `getProfileForWorkout('Autre', tempCustomActivity)`), pas via une
  // valeur capturée à la construction du hook. Ce paramètre datait
  // probablement d'avant ce mécanisme par callback et n'avait jamais été
  // retiré. `athleticProfileApi` a été retiré dans la foulée de la
  // signature de `GeneratorProvider` (voir sa docstring) — plus aucun
  // consommateur réel trouvé une fois cette chaîne remontée jusqu'au bout.
  const generatorFormApi = useGeneratorForm(isNaughtyMode);
  // `applyProfileBpmIfUntouched` sorti du spread ci-dessous — vit désormais
  // UNIQUEMENT dans CustomActivityContext.jsx (voir docstring plus haut),
  // pas dupliqué ici pour éviter 2 sources d'accès à la même fonction.
  const { applyProfileBpmIfUntouched, ...restGeneratorFormApi } = generatorFormApi;

  // Déplacée telle quelle depuis App.jsx (n'y était jamais appelée ailleurs
  // que passée en prop à GeneratorView — sûr à relocaliser entièrement ici).
  const getActiveWorkoutName = () =>
    (workoutType === 'Autre' && customActivity.trim() !== '') ? customActivity : workoutType;

  const value = {
    workoutType, setWorkoutType,
    getActiveWorkoutName,
    ...restGeneratorFormApi,
  };

  return (
    <GeneratorContext.Provider value={value}>
      <CustomActivityProvider customActivityApi={customActivityApi} applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}>
        {children}
      </CustomActivityProvider>
    </GeneratorContext.Provider>
  );
}

// Fallback silencieux plutôt qu'un throw — même choix que AuthContext.jsx
// (évite un plantage/écran blanc si un composant venait à être rendu/testé
// hors de son Provider). Les valeurs de repli sont volontairement "inertes"
// (pas de crash, mais rien ne se passe) plutôt que des valeurs plausibles
// qui masqueraient l'oubli du Provider.
const FALLBACK = {
  workoutType: 'Course à pied', setWorkoutType: () => {},
  getActiveWorkoutName: () => '',
  bpm: 120, setBpm: () => {}, setBpmManual: () => {},
  segments: [], setSegments: () => {},
  selectedGenres: [], setSelectedGenres: () => {},
  // customActivity/tempCustomActivity/isCustomActivityModalOpen/
  // handleOpenCustomActivityModal/applyProfileBpmIfUntouched : DÉPLACÉS
  // (08/08) vers CustomActivityContext.jsx (useCustomActivityContext()) —
  // isNaughtyMode/athleticProfile/getProfileForWorkout : DÉPLACÉS (08/08)
  // vers AthleticContext.jsx (useAthleticContext()) — plus dans ce
  // Contexte ni son FALLBACK.
};

export function useGeneratorContext() {
  const ctx = useContext(GeneratorContext);
  return ctx || FALLBACK;
}
