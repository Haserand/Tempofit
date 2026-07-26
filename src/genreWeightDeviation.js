import { normalizeGenreForDisplay, genreDisplayLabel } from './musicCatalog';

/**
 * genreWeightDeviation.js — logique de calcul PURE derrière l'avertissement
 * de répartition par genre du wizard (useGeneratorForm.js, étape résultat).
 *
 * Extrait de useGeneratorForm.js (qui importe React pour useState/useEffect)
 * afin que cette fonction — déjà 100% pure, ne dépendant que de ses
 * arguments (`tracks`, `weights`) et de musicCatalog.js (sans React) — soit
 * testable directement avec le test runner natif de Node, sans dépendance à
 * installer (même principe que src/utils/numberInput.test.js et
 * src/athleticZones.js). Aucun changement de comportement : déplacement à
 * l'identique, useGeneratorForm.js importe maintenant cette fonction au lieu
 * de la définir localement.
 *
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
