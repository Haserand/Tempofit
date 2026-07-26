import { normalizeGenreForDisplay, genreDisplayLabel } from './musicCatalog';

/**
 * genreWeightDeviation.js — logique de calcul PURE autour de la pondération
 * par genre du wizard (useGeneratorForm.js) : répartition initiale à parts
 * égales (`equalSplitWeights`) et détection d'écart entre répartition visée
 * et obtenue (`checkGenreWeightDeviation`).
 *
 * Extrait de useGeneratorForm.js (qui importe React pour useState/useEffect)
 * afin que cette logique — déjà 100% pure, ne dépendant que de ses arguments
 * et de musicCatalog.js (sans React) — soit testable directement avec le
 * test runner natif de Node, sans dépendance à installer (même principe que
 * src/utils/numberInput.test.js et src/athleticZones.js). Aucun changement
 * de comportement : déplacement à l'identique, useGeneratorForm.js importe
 * maintenant ces fonctions au lieu de les définir localement.
 */

// Répartit 100% à parts égales entre les genres donnés (reste éventuel
// affecté au dernier, pour que la somme tombe toujours pile sur 100 malgré
// les arrondis — ex. 3 genres → 33/33/34, pas 33/33/33 qui ne totaliserait
// que 99).
export const equalSplitWeights = (genres) => {
  if (genres.length === 0) return {};
  const base = Math.floor(100 / genres.length);
  const result = {};
  genres.forEach(g => { result[g] = base; });
  result[genres[genres.length - 1]] += 100 - base * genres.length;
  return result;
};

/**
 * Compare la répartition RÉELLEMENT obtenue (durée par genre dans la
 * playlist) à la répartition en % DEMANDÉE (config.genreWeights) —
 * approximatif par nature, donc on ne signale que les écarts vraiment
 * significatifs (≥ 15 points de %), pas la moindre fluctuation. Retourne la
 * liste des genres trop éloignés de leur cible, ou `null` si rien à
 * signaler (pas de poids configurés, ou tout est proche).
 */
export const checkGenreWeightDeviation = (tracks, weights) => {
  if (!weights || Object.keys(weights).length <= 1) return null;
  const totalDuration = tracks.reduce((s, t) => s + t.duration, 0);
  if (totalDuration === 0) return null;
  const actualByGenre = {};
  tracks.forEach(t => {
    const g = normalizeGenreForDisplay(t.genre, t.artist, t.title);
    actualByGenre[g] = (actualByGenre[g] || 0) + t.duration;
  });
  const deviations = [];
  Object.entries(weights).forEach(([genre, targetPct]) => {
    if (!targetPct) return;
    const actualPct = Math.round(((actualByGenre[genre] || 0) / totalDuration) * 100);
    if (Math.abs(actualPct - targetPct) >= 15) {
      deviations.push(`${genreDisplayLabel(genre)} : ${actualPct}% obtenu (visé ${targetPct}%)`);
    }
  });
  return deviations.length > 0 ? deviations : null;
};
