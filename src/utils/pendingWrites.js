/**
 * pendingWrites.js — compteur global des écritures Supabase "en tâche de
 * fond" encore en vol (déclenchées par `useSyncedCollection.js` et
 * `usePersistentState.js` à chaque `setState`), pour pouvoir les ATTENDRE
 * explicitement avant une déconnexion plutôt que de supposer qu'elles sont
 * "déjà parties" au moment où l'utilisateur clique sur Déconnexion.
 *
 * CONTEXTE (08/08) — jusqu'ici, `signOut()` (AuthContext.jsx) videait le
 * cache local juste après `supabase.auth.signOut()`, en partant du principe
 * que "tout changement local a déjà été poussé vers Supabase" : vrai la
 * plupart du temps (chaque `setState` déclenche déjà son upsert/insert/
 * delete immédiatement, pas de debounce), mais pas garanti — une frappe ou
 * un clic juste avant la déconnexion peut très bien avoir une requête
 * encore EN VOL (réseau lent, notamment) au moment où `signOut()`
 * s'exécute. Rien ne la reliait à la déconnexion : la requête pouvait
 * échouer silencieusement APRÈS l'invalidation de la session (`auth.uid()`
 * ne correspondant plus à personne côté RLS), sans que rien ne le
 * signale ni ne la rejoue.
 *
 * Design volontairement minimal : un compteur MODULE-LEVEL (singleton,
 * partagé par TOUTES les instances des deux hooks confondues — playlists,
 * routines, favoris, profil athlétique, thème, stats...), pas de file de
 * promesses individuelles à tracker une par une. Suffisant ici : le seul
 * besoin réel est "est-ce que tout est retombé à zéro", jamais "laquelle
 * de ces écritures précises est encore en cours".
 *
 * `trackWrite(thenable, onSettled?)` — enregistre une écriture en cours.
 * Incrémente le compteur immédiatement, le décrémente quand `thenable` se
 * termine (succès OU échec confondus — un échec réseau ne doit jamais
 * bloquer le compteur indéfiniment). `onSettled` (optionnel) reçoit le
 * résultat en cas de succès uniquement — même contrat que les callbacks
 * `.then(({ error }) => ...)` déjà utilisés par les appelants, pour ne
 * rien changer à leur logique de journalisation d'erreur existante.
 * Renvoie `thenable` converti en vraie Promise (utilisable avec `await`,
 * ex. `usePersistentState.js`) — mais reste tout aussi valide en usage
 * "fire and forget" (ex. `useSyncedCollection.js`, valeur de retour
 * ignorée) : `.then()` peut être attaché plusieurs fois indépendamment sur
 * la même Promise sans effet de bord entre les deux.
 *
 * `waitForPendingWrites(timeoutMs)` — utilisée par `AuthContext.jsx`
 * AVANT `supabase.auth.signOut()` (pas après) : le but est de laisser les
 * dernières écritures partir avec une session ENCORE valide, avant de
 * l'invalider puis de vider le cache local juste ensuite. Timeout par
 * défaut (5s) : ne JAMAIS bloquer une déconnexion indéfiniment si le
 * réseau est down ou qu'une requête reste bloquée — mieux vaut risquer de
 * perdre UNE écriture (déjà le risque, pour TOUTES, avant ce correctif)
 * que de coincer l'utilisateur hors de son propre bouton Déconnexion.
 */

let pendingCount = 0;
let waiters = [];

export function trackWrite(thenable, onSettled) {
  pendingCount += 1;
  const promise = Promise.resolve(thenable);

  const settle = () => {
    pendingCount = Math.max(0, pendingCount - 1);
    if (pendingCount === 0) {
      const toNotify = waiters;
      waiters = [];
      toNotify.forEach((resolve) => resolve());
    }
  };

  promise.then(
    (result) => { settle(); if (onSettled) onSettled(result); },
    () => { settle(); },
  );

  return promise;
}

export function waitForPendingWrites(timeoutMs = 5000) {
  if (pendingCount === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    waiters.push(() => { clearTimeout(timer); resolve(); });
  });
}

// Exposé UNIQUEMENT pour les tests (vérifier le compteur sans dépendre du
// timing réel d'une vraie Promise) — jamais utilisé par du code applicatif.
export function _getPendingWriteCountForTests() {
  return pendingCount;
}
