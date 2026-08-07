/**
 * localCache.js — clé commune du cache localStorage de TempoFit.
 *
 * `STORAGE_PREFIX` vivait avant (07/08) dupliquée à l'IDENTIQUE dans
 * `usePersistentState.js` ET `useSyncedCollection.js` — centralisée ici,
 * même raisonnement que les autres constantes déjà extraites du projet
 * une fois une duplication confirmée (voir CLAUDE-SANDBOX-VERIFICATION.md
 * §4sexies : "extraire une constante PARTAGÉE... plutôt que de simplement
 * resynchroniser les 2 copies") plutôt que de continuer à les maintenir
 * en double.
 *
 * `clearLocalCache()` — vide tout le cache localStorage de TempoFit sur CET
 * appareil (toute clé qui commence par `STORAGE_PREFIX`, jamais une clé
 * étrangère au même domaine — même garde-fou que la raison d'être du
 * préfixe lui-même). Appelée au `signOut()` (AuthContext.jsx) pour combler
 * une dette connue et documentée de longue date (voir la docstring de
 * `usePersistentState.js`) : sans ça, les données de l'utilisateur
 * restaient dans localStorage de CET appareil après déconnexion — sur un
 * appareil PARTAGÉ, le compte suivant les verrait (et pourrait les
 * MODIFIER) tant qu'il ne se connecte pas lui-même à son propre compte,
 * potentiellement indéfiniment s'il reste en mode invité plutôt que
 * "juste un court instant" comme le décrivait la doc jusqu'ici. Safe par
 * construction : au moment du `signOut()`, tout changement local a déjà
 * été poussé vers Supabase en tâche de fond (voir
 * `usePersistentState.js`/`useSyncedCollection.js`) — vider le cache ne
 * perd rien, ça oblige juste un vrai re-pull réseau à la prochaine
 * connexion (même compte ou un autre).
 */
export const STORAGE_PREFIX = 'tempofit:';

export function clearLocalCache() {
  try {
    Object.keys(window.localStorage)
      .filter(key => key.startsWith(STORAGE_PREFIX))
      .forEach(key => window.localStorage.removeItem(key));
  } catch (e) {
    // Échec silencieux volontaire — même philosophie que le reste de la
    // persistance locale (navigation privée qui bloque localStorage,
    // quota dépassé...) : ne jamais faire échouer la déconnexion
    // elle-même pour ça, voir usePersistentState.js.
  }
}
