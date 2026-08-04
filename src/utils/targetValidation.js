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
 * ⚠️ ÉLARGI (04/08, même jour, 2e retour direct — capture d'écran de
 * RoutinesView.jsx : une routine SAUVEGARDÉE avec 0 km, créée AVANT ce
 * correctif, se générait encore sans blocage) : le premier passage n'avait
 * couvert que les 2 points d'ENTRÉE de la valeur (le wizard, la modale
 * d'édition) — pas le bouton "Générer" directement posé sur une carte de
 * routine déjà sauvegardée (`RoutinesView.jsx`), qui appelle
 * `executeGeneration` sur les valeurs STOCKÉES sans repasser par aucun
 * formulaire, donc sans jamais croiser la validation ajoutée. Une routine
 * mal enregistrée (par ce bug ou tout autre moyen, ex. edited via l'API
 * Supabase directement) restait donc généralement bloquée en boucle sans
 * qu'aucun signal ne l'indique. Leçon : valider à la SOURCE (formulaires)
 * ne suffit pas pour des données qui persistent et se relisent ailleurs
 * sans repasser par ce même formulaire — il faut aussi valider au moment de
 * CONSOMMER la donnée stockée, pas seulement au moment de l'écrire.
 * Seuil distance resserré à `>= 0.1` (au lieu de `> 0`) au même retour
 * ("je pense que le comportement attendu c'est que je puisse pas aller en
 * dessous de 0,1 km") — cohérent avec le `step="0.1"` déjà affiché sur le
 * champ, plutôt qu'un seuil théorique (0.01, 0.001...) sans réalité
 * physique pour une séance de course/vélo. Volontairement le MÊME seuil
 * en km ET en miles (pas de conversion selon l'unité) : 0.1 mi (~160 m) et
 * 0.1 km (100 m) sont du même ordre de grandeur, et une distinction par
 * unité ajouterait de la complexité sans bénéfice réel perceptible pour une
 * séance de sport.
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
const MIN_VALID_DISTANCE = 0.1;

export function isTargetValueValid({ targetMode, distanceVal, hours, minutes }) {
  if (targetMode === 'distance') {
    const val = parseFloat(distanceVal);
    return Number.isFinite(val) && val >= MIN_VALID_DISTANCE;
  }
  // targetMode === 'time'
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  return (h * 60 + m) > 0;
}

/**
 * snapDistanceOnBlur — à utiliser dans l'`onBlur` du champ distance (PAS
 * `onChange`, voir la docstring de isTargetValueValid ci-dessus pour
 * pourquoi rien ne doit être corrigé pendant la frappe elle-même).
 *
 * BUG CORRIGÉ (04/08, 3e retour direct sur ce même chantier, capture
 * annotée — "je pensais qu'on avait dit qu'on ne pouvait pas sélectionner
 * moins que 0,1 ?") : le blocage à l'ACTION (bouton désactivé + message)
 * fonctionnait déjà, mais le CHAMP restait affiché à 0 indéfiniment tant
 * que l'utilisateur ne le corrigeait pas lui-même à la main — aucun signal
 * actif ne le ramenait vers une valeur valide une fois la saisie terminée.
 * `onBlur` (perte de focus, donc "j'ai fini d'éditer ce champ pour
 * l'instant") est le moment sûr pour corriger : ça ne peut jamais
 * interrompre une frappe en cours (contrairement à `onChange`, qui aurait
 * pu, par exemple, remonter "0" à "0.1" AVANT que l'utilisateur ait eu la
 * chance de taper le "." et le "5" de "0.5").
 *
 * Renvoie la valeur INCHANGÉE si déjà valide (`>= MIN_VALID_DISTANCE`) —
 * ne fait rien dans le cas courant, uniquement un filet pour le cas
 * invalide (0, vide, négatif, texte).
 */
export function snapDistanceOnBlur(distanceVal) {
  const val = parseFloat(distanceVal);
  if (Number.isFinite(val) && val >= MIN_VALID_DISTANCE) return distanceVal;
  return String(MIN_VALID_DISTANCE);
}

/**
 * Validation des SEGMENTS du mode Fractionné/Crescendo (GeneratorWizard.jsx
 * étape 3, `segments[]`) — même défaut structurel que `distanceVal`/`hours`/
 * `minutes` avant ce chantier, trouvé en généralisant le correctif plutôt
 * qu'en le laissant scope-limité (04/08, retour direct : "ce comportement
 * minimal est-il celui généralisé dans toute l'app ? il le faudrait").
 * `segment.bpm`/`segment.durationValue` étaient éditables avec
 * `parseInt(...) || 0`/`parseFloat(...) || 0` — un champ vidé ou à 0
 * retombait silencieusement à 0, sans aucun garde-fou, exactement le même
 * trou que `distanceVal` avant son propre correctif.
 * MIN_VALID_BPM = 1 : un plancher volontairement minimal (pas les bornes
 * 40-220/80-220 du slider BPM principal) — ce chantier corrige "jamais
 * zéro", pas une refonte complète des bornes BPM par segment, hors scope
 * de la demande initiale.
 */
const MIN_VALID_BPM = 1;

export function isSegmentValid(segment, targetMode) {
  const bpm = parseInt(segment?.bpm, 10);
  const bpmValid = Number.isFinite(bpm) && bpm >= MIN_VALID_BPM;
  const duration = parseFloat(segment?.durationValue);
  const durationValid = targetMode === 'distance'
    ? Number.isFinite(duration) && duration >= MIN_VALID_DISTANCE
    : Number.isFinite(duration) && duration > 0;
  return bpmValid && durationValid;
}

export function areSegmentsValid(segments, targetMode) {
  return Array.isArray(segments) && segments.length > 0 && segments.every(s => isSegmentValid(s, targetMode));
}

/** Pendant de snapDistanceOnBlur pour le BPM d'un segment — mêmes raisons. */
export function snapSegmentBpmOnBlur(bpmVal) {
  const val = parseInt(bpmVal, 10);
  if (Number.isFinite(val) && val >= MIN_VALID_BPM) return String(val);
  return String(MIN_VALID_BPM);
}

/** Pendant de snapDistanceOnBlur pour la durée/distance d'un segment. */
export function snapSegmentDurationOnBlur(durationVal, targetMode) {
  const val = parseFloat(durationVal);
  if (targetMode === 'distance') {
    if (Number.isFinite(val) && val >= MIN_VALID_DISTANCE) return durationVal;
    return String(MIN_VALID_DISTANCE);
  }
  if (Number.isFinite(val) && val > 0) return durationVal;
  return '1';
}
