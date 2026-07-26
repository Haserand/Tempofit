/**
 * numberInput.js — nettoyage des <input type="number"> contrôlés par React.
 *
 * BUG CORRIGÉ (signalé par capture d'écran, champ "Minutes" de la durée de
 * session affichant "041") : les attributs HTML `min`/`max` d'un
 * `<input type="number">` ne bloquent PAS la saisie clavier — ils ne pilotent
 * que les flèches natives du spinner et un état CSS `:invalid`, jamais
 * exploité ici. Rien n'empêchait donc de taper "041", "999", etc., car les
 * onChange stockaient `e.target.value` brut sans aucune validation.
 *
 * `clampNumericInput` :
 * - retire tout caractère non numérique (protège aussi contre un copier-
 *   coller de texte arbitraire),
 * - convertit en entier (ce qui élimine mécaniquement les zéros de tête :
 *   parseInt("041") === 41),
 * - borne le résultat entre `min` et `max`,
 * - laisse passer la chaîne vide telle quelle, pour que l'utilisateur
 *   puisse effacer le champ et retaper sans qu'il se fasse immédiatement
 *   re-remplir à `min`.
 *
 * Fonctionne bien à la saisie caractère par caractère (testé pour les cas
 * de ce projet : max à 2 chiffres comme 12, 59, 100, 220 — le seul cas où
 * un premier chiffre isolé peut se faire recadrer avant la frappe du
 * second est quand ce premier chiffre, à lui seul, dépasse déjà `max`
 * multiplié par 10 dans le pire des cas ; non applicable ici puisque tous
 * les `max` de ce projet acceptent un premier chiffre de 0 à 9 tel quel).
 */
export function clampNumericInput(rawValue, { min = -Infinity, max = Infinity } = {}) {
  if (rawValue === '') return '';

  const digitsOnly = rawValue.replace(/[^0-9]/g, '');
  if (digitsOnly === '') return '';

  const parsed = parseInt(digitsOnly, 10);
  if (Number.isNaN(parsed)) return '';

  const clamped = Math.min(max, Math.max(min, parsed));
  return String(clamped);
}
