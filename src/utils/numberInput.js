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

/**
 * syncClampedInput — à utiliser DIRECTEMENT dans le `onChange` d'un
 * `<input type="number">`, à la place de `clampNumericInput` seule.
 *
 * BUG CORRIGÉ (25/07, retour direct : "je tape 0 devant 145, ça reste
 * affiché 0145 même après avoir cliqué ailleurs") : piège classique des
 * champs contrôlés React. Scénario exact : le champ affiche déjà "145"
 * (state React = "145"). L'utilisateur tape "0" tout au début → le DOM du
 * champ affiche "0145" → `onChange` se déclenche → `clampNumericInput`
 * calcule bien la valeur correcte, "145" → mais c'est EXACTEMENT la même
 * chaîne que le state actuel. React compare l'ancienne et la nouvelle
 * valeur de la prop `value` du champ : comme rien n'a changé de son point
 * de vue, il ne réapplique jamais `value="145"` sur le DOM réel — qui reste
 * donc affiché "0145", alors que l'état interne est bien correct (145).
 * Le bug est donc purement visuel (l'app génère quand même avec 145), mais
 * trompeur et source de perte de confiance.
 *
 * Parade standard pour ce piège React : forcer la synchronisation du DOM
 * en écrivant directement sur `e.target.value`, EN PLUS de faire remonter
 * la valeur calculée au state — un accès impératif au vrai nœud DOM
 * (`e.target` reste valide de façon synchrone dans un gestionnaire
 * d'évènement React), qui court-circuite le mécanisme de diff de React
 * plutôt que de dépendre de lui pour corriger l'affichage.
 *
 * Usage : `onChange={(e) => setHours(syncClampedInput(e, { min: 0, max: 12 }))}`
 * — remplace un `clampNumericInput(e.target.value, {...})` existant par
 * `syncClampedInput(e, {...})`, le reste de l'appel ne change pas.
 */
export function syncClampedInput(e, options) {
  const clamped = clampNumericInput(e.target.value, options);
  e.target.value = clamped;
  return clamped;
}
