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
 * ⚠️ CORRIGÉ (10/08, check-up) — l'affirmation ci-dessous était FAUSSE
 * telle quelle depuis le 08/08 : `athleticProfileApi` n'était PAS stable à
 * la source (les 10 fonctions de mutation retournées par
 * `useAthleticProfile()` étaient de simples `const` recréées à CHAQUE
 * appel, jamais dans un `useCallback`), et `App()` re-rend en réalité
 * assez souvent — `toast` (state possédé par `App()`, `useToast()`) change
 * à chaque appel `showToast(...)`, ~73 endroits dans tout le projet
 * (favoris, routines, trophées, partage, import CSV...), sans rapport avec
 * le profil athlétique. Conséquence réelle avant correctif : le `useMemo`
 * ci-dessous recalculait sa `value` à quasiment chaque interaction
 * utilisateur ayant un retour visuel n'importe où dans l'app — pas
 * seulement quand le profil changeait vraiment — re-rendant tous les
 * consommateurs de `useAthleticContext()` (dont `CustomActivityModal.jsx`,
 * montée GLOBALEMENT dans App.jsx) à chaque fois. `useAthleticProfile.js`
 * stabilise maintenant ses 10 fonctions de mutation via `useCallback([])`
 * et sa propre `value` de retour via `useMemo` (voir sa docstring) — donc
 * l'affirmation ci-dessous, VRAIE maintenant, ne l'était pas avant ce
 * correctif :
 *
 * ⚠️ VÉRIFIÉ AVANT DE DÉCOUPER (pas supposé) — où vit réellement
 * `useAthleticProfile()` : appelé UNE SEULE FOIS dans le composant racine
 * `App()` (App.jsx), PAS dans `AppContent` ni dans `GeneratorProvider`
 * lui-même. `athleticProfileApi` (le retour de ce hook) est donc désormais
 * RÉFÉRENTIELLEMENT STABLE tant que le profil athlétique lui-même ne
 * change pas réellement (`useAthleticProfile.js`, 10/08) — jamais à cause
 * d'un réglage dans le wizard (2 étages plus bas) ni d'un toast affiché
 * ailleurs dans l'app (même composant, `App()`, mais state indépendant).
 * Ce fichier n'avait donc PAS besoin de toucher `useAthleticProfile.js`
 * lui-même le 08/08 pour le découpage de Contexte — mais EN A eu besoin le
 * 10/08 pour que la stabilité supposée à l'époque devienne réelle.
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
