/**
 * isTargetValueValid — la cible d'une séance (distance OU durée) doit être
 * strictement positive pour qu'une génération ait un sens.
 *
 * BUG CORRIGÉ (04/08, retour direct, capture d'écran de EditRoutineModal.jsx :
 * "je ne trouve pas ça normal de pouvoir générer une routine avec une valeur
 * de 0 km") : aucun endroit de l'app n'empêchait ça. Les `<input type="number"
 * min="0">` concernés (TargetModeInputs.jsx — étapes 2/3 du wizard — ET sa
 * copie dans EditRoutineModal.jsx, jamais factorisées ensemble) n'ont
 * JAMAIS bloqué la saisie clavier — `min`/`max` HTML ne pilotent que les
 * flèches natives du spinner (même piège déjà documenté dans
 * `numberInput.js` pour Heures/Minutes) — et rien en aval (`executeGeneration`,
 * `applyRoutineEditOnce`/`applyRoutineEditPermanently`, voir
 * useRoutineActions.js) ne revalidait quoi que ce soit avant de lancer une
 * génération ou d'écraser la routine sauvegardée. Un 0 km (ou un champ vidé,
 * `''`, ou même une valeur négative tapée à la main) passait donc intégralement
 * jusqu'au moteur de génération.
 *
 * Choix délibéré : PAS de `clampNumericInput`/`syncClampedInput`
 * (numberInput.js) ici — ces helpers sont entiers uniquement (`parseInt`,
 * `.replace(/[^0-9]/g, '')`), ils casseraient la saisie décimale de la
 * distance (`step="0.1"`, ex. "5.5" deviendrait "55"). Cette fonction ne
 * bloque donc RIEN à la frappe (l'utilisateur reste libre de vider le champ
 * un instant pour retaper, exactement comme Heures/Minutes) — elle sert
 * uniquement de GARDE au moment de l'action (bouton désactivé), pas de
 * filtre keystroke-par-keystroke.
 *
 * Scope volontairement limité à la cible "simple" (temps OU distance,
 * modes Constant/Crescendo) — PAS aux durées par segment du mode Fractionné
 * (`segments[].durationValue`, GeneratorWizard.jsx étape 3), qui est une
 * source de données différente et mériterait sa propre validation séparée,
 * pas traitée dans ce chantier.
 */
export function isTargetValueValid({ targetMode, distanceVal, hours, minutes }) {
  if (targetMode === 'distance') {
    const val = parseFloat(distanceVal);
    return Number.isFinite(val) && val > 0;
  }
  // targetMode === 'time'
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  return (h * 60 + m) > 0;
}
