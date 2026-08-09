import { createContext, useContext, useMemo } from 'react';

/**
 * AthleticContext.jsx — extrait de `GeneratorContext.jsx` (08/08, suite du
 * chantier "value non mémoïsée re-render tout le monde").
 *
 * CONTEXTE — `isNaughtyMode`/`athleticProfileApi` vivaient dans
 * `GeneratorContext.jsx`, RECOMBINÉS dans le même `value` que l'état du
 * formulaire du générateur (`useGeneratorForm()`, dizaines de `useState` qui
 * changent à CHAQUE interaction dans le wizard — curseur BPM, genres,
 * structure...). Conséquence : `GeneratorProvider` re-rend à chaque réglage
 * du wizard (state possédé DIRECTEMENT par ce Provider, pas par un ancêtre),
 * recréant `value` en entier — et tout composant qui ne lisait QUE
 * `isNaughtyMode`/l'API athlétique (sans rien lire du formulaire) re-rendait
 * quand même, pour rien.
 *
 * ⚠️ VÉRIFIÉ AVANT DE DÉCOUPER (pas supposé) — où vit réellement
 * `useAthleticProfile()` : appelé UNE SEULE FOIS dans le composant racine
 * `App()` (App.jsx), PAS dans `AppContent` ni dans `GeneratorProvider`
 * lui-même. `athleticProfileApi` (le retour de ce hook) est donc déjà
 * RÉFÉRENTIELLEMENT STABLE tant que `App()` ne re-rend pas pour une autre
 * raison (bascule Mode Intime, toast, ou l'profil athlétique change
 * réellement) — jamais à cause d'un réglage dans le wizard, qui vit 2 étages
 * plus bas. Ce fichier n'avait donc PAS besoin de toucher
 * `useAthleticProfile.js` (383 lignes, consommé aussi DIRECTEMENT par
 * StatsView/PlaylistDetailView — bien plus gros chantier, hors périmètre
 * ici) : `isNaughtyMode`/`athleticProfileApi` sont déjà stables À LA SOURCE,
 * il suffisait de leur donner un Contexte à eux qui ne les mélange plus
 * avec l'état du formulaire.
 *
 * Monté dans `App.jsx`, au même niveau que `<GeneratorProvider>`/
 * `<AudioPlayerProvider>` (isNaughtyMode/athleticProfileApi possédés par
 * `App()`, comme avant — ce fichier ne fait que les exposer via un
 * Contexte DÉDIÉ plutôt que mélangés dans celui du générateur).
 */

const AthleticContext = createContext(null);

/**
 * @param {boolean} isNaughtyMode - mode "Intime" global de l'app (reçu, pas possédé)
 * @param {object} athleticProfileApi - retour COMPLET et INCHANGÉ de useAthleticProfile()
 *   côté App.jsx (l'instance unique).
 */
export function AthleticProvider({ isNaughtyMode, athleticProfileApi, children }) {
  // `useMemo` — SÛR ici (contrairement à GeneratorContext.jsx pour la
  // partie formulaire) : `athleticProfileApi` est déjà stable à la source
  // (voir docstring plus haut), donc ce `useMemo` ne recalcule QUE quand
  // l'un des deux change réellement, jamais à cause d'un re-render de
  // `App()` pour une raison sans rapport (il n'y en a d'ailleurs quasiment
  // aucune, `App()` étant volontairement minimal).
  const value = useMemo(
    () => ({ isNaughtyMode, ...athleticProfileApi }),
    [isNaughtyMode, athleticProfileApi],
  );

  return <AthleticContext.Provider value={value}>{children}</AthleticContext.Provider>;
}

// Fallback silencieux — même convention que les autres contexts du projet.
const FALLBACK = {
  isNaughtyMode: false,
  athleticProfile: { activities: {}, custom: [] }, setAthleticProfile: () => {},
  computeZonesFromBaseBpm: () => ({}), getDefaultBaseBpm: () => 120, buildDefaultPreviewProfile: () => ({}), getZoneSpacingForActivity: () => 0,
  setBaseBpmForActivity: () => {}, setZoneForActivity: () => {}, resetActivityProfile: () => {},
  addCustomActivity: () => {}, removeCustomActivity: () => {}, setBaseBpmForCustom: () => {}, setZoneForCustom: () => {},
  setCadenceIntentForActivity: () => {}, setCadenceIntentForCustom: () => {}, isCadenceIntentEligible: () => false,
  getProfileForWorkout: () => ({ isConfigured: false }), getProfileForWorkoutOrDefault: () => ({ isConfigured: false }),
  resetAthleticProfile: () => {},
};

export function useAthleticContext() {
  const ctx = useContext(AthleticContext);
  return ctx || FALLBACK;
}
