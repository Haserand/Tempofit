/**
 * debugLog.js — console.log gaté derrière `import.meta.env.DEV`.
 *
 * Contexte : les logs `[BPM search]` de searchEngine.js/musicEngine.js
 * (diagnostics du moteur de génération — utiles en dev pour comprendre
 * pourquoi tel BPM/genre ne remonte pas de résultat) étaient de vrais
 * `console.log` inconditionnels, donc visibles dans la console de N'IMPORTE
 * QUEL visiteur en production (assez verbeux : détail artiste par artiste).
 * `import.meta.env.DEV` est injecté par Vite lui-même (true en `vite dev`,
 * false dans un build `vite build`, donc sur Vercel en prod) — rien à
 * configurer, aucune variable d'env à poser côté Vercel.
 *
 * Les `console.error` (erreurs API Deezer/Spotify, ErrorBoundary...) ne sont
 * PAS concernés par ce fichier : ceux-là restent utiles même en prod pour
 * diagnostiquer un souci remonté par un·e utilisateur·rice.
 *
 * Usage : remplacer `console.log(...)` par `debugLog(...)` — même signature.
 */
export function debugLog(...args) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
