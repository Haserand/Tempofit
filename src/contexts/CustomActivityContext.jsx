import { createContext, useContext, useMemo } from 'react';

/**
 * CustomActivityContext.jsx — extrait de `GeneratorContext.jsx` (08/08,
 * suite du chantier "value non mémoïsée re-render tout le monde" —
 * `AthleticContext.jsx` d'abord, ce fichier ensuite pour finir de résoudre
 * la limite documentée à l'époque : `CustomActivityModal.jsx`, montée
 * GLOBALEMENT dans App.jsx (pas conditionnée à une vue), continuait de
 * re-rendre à chaque réglage du wizard à cause d'`applyProfileBpmIfUntouched`
 * — un champ de `useGeneratorForm()`, donc du même `value` très haute
 * fréquence que `bpm`/`selectedGenres`/etc.
 *
 * DEUX CONDITIONS étaient nécessaires pour que ce découplage serve à
 * quelque chose, toutes deux réglées AVANT ce fichier (pas ici) :
 * 1. `applyProfileBpmIfUntouched` (useGeneratorForm.js) rendue
 *    RÉFÉRENTIELLEMENT STABLE — via `useRef`+`useCallback([])`, elle lit
 *    `structureMode`/`setStructureMode` à travers des refs mises à jour à
 *    chaque rendu, plutôt que de les fermer directement (ce qui aurait
 *    exigé de la recréer à chaque frappe). Voir sa docstring pour le détail.
 * 2. Le retour de `useCustomActivity()` mémoïsé (`useMemo`) — sinon ce
 *    hook renvoie un objet neuf à chaque rendu de `GeneratorProvider`
 *    (peu importe si SES PROPRES champs n'ont pas changé), rendant toute
 *    mémoïsation en aval inutile.
 *
 * Sans CES DEUX préalables, un simple `useMemo` sur la `value` de CE
 * Contexte n'aurait servi à rien : ses 2 dépendances auraient de toute
 * façon été de nouvelles références à chaque rendu, recalculant le
 * `useMemo` à chaque fois — exactement le piège déjà documenté dans
 * GeneratorContext.jsx pour expliquer pourquoi il n'a jamais été mémoïsé
 * lui-même.
 *
 * Monté à l'INTÉRIEUR de `GeneratorProvider` (pas en frère dans App.jsx,
 * contrairement à `AthleticContext.jsx`) : `customActivityApi`/
 * `applyProfileBpmIfUntouched` n'existent QUE dans le corps de
 * `GeneratorProvider` (retours de `useCustomActivity()`/
 * `useGeneratorForm()`, appelés là), pas question de les recréer une 2e
 * fois ailleurs.
 */

const CustomActivityContext = createContext(null);

/**
 * @param {object} customActivityApi - retour MÉMOÏSÉ de useCustomActivity()
 *   (voir sa docstring)
 * @param {function} applyProfileBpmIfUntouched - retour STABLE de
 *   useGeneratorForm() (voir sa docstring)
 */
export function CustomActivityProvider({ customActivityApi, applyProfileBpmIfUntouched, children }) {
  // `useMemo` — SÛR ici (contrairement à GeneratorContext.jsx) : les 2
  // dépendances sont maintenant stables à la source (voir docstring plus
  // haut) — ce `useMemo` ne recalcule QUE quand l'une d'elles change
  // réellement, jamais à cause d'un réglage du wizard sans rapport
  // (bpm/genres/structure...).
  const value = useMemo(
    () => ({ ...customActivityApi, applyProfileBpmIfUntouched }),
    [customActivityApi, applyProfileBpmIfUntouched],
  );

  return <CustomActivityContext.Provider value={value}>{children}</CustomActivityContext.Provider>;
}

// Fallback silencieux — même convention que les autres contexts du projet.
const FALLBACK = {
  customActivity: '', setCustomActivity: () => {},
  tempCustomActivity: '', setTempCustomActivity: () => {},
  isCustomActivityModalOpen: false, setIsCustomActivityModalOpen: () => {},
  handleOpenCustomActivityModal: () => {},
  applyProfileBpmIfUntouched: () => {},
};

export function useCustomActivityContext() {
  const ctx = useContext(CustomActivityContext);
  return ctx || FALLBACK;
}
