/**
 * captureElementAsFile.js — capture un élément DOM en image PNG (File),
 * extrait de PlaylistDetailView.jsx (`generateSummaryImageFile`) pour
 * centraliser cette logique dans un seul endroit propre (règle du Boy
 * Scout) plutôt que de la laisser mélangée avec le reste d'un composant de
 * vue — tout futur appelant (Bilan de séance, futur export de trophée...)
 * passe par ici, jamais une 2e implémentation copiée-collée.
 *
 * Ne s'occupe QUE de la capture elle-même (attendre les <img>, appeler
 * html2canvas, convertir en File) — pas de la préparation des DONNÉES
 * affichées (pochettes à résoudre, etc.), qui reste au plus près du code
 * métier de chaque appelant.
 */

/**
 * Attend que toutes les <img> à l'intérieur de `element` aient fini de
 * charger (ou aient échoué) avant de continuer — html2canvas capture l'état
 * du DOM à l'instant T ; une image encore en cours de chargement à ce
 * moment-là apparaîtrait vide sur la capture finale.
 */
async function waitForImagesToLoad(element) {
  if (!element) return;
  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })));
}

/**
 * Capture `element` en image PNG et renvoie un `File` prêt à être partagé/
 * téléchargé.
 *
 * `scale` : import dynamique de html2canvas — librairie assez lourde pour
 * une fonctionnalité optionnelle, pas la peine de l'inclure dans le bundle
 * principal chargé par tout le monde dès le départ.
 *
 * `extraDelayMs` : petit délai avant capture (par défaut 50ms), pour laisser
 * le temps au DOM de re-render avec des données tout juste posées (ex.
 * pochettes résolues juste avant l'appel) avant que `waitForImagesToLoad`
 * ne cherche les <img> à surveiller.
 */
export async function captureElementAsFile(element, filename, { scale = 2, extraDelayMs = 50 } = {}) {
  if (!element) throw new Error('captureElementAsFile: élément DOM manquant');

  if (extraDelayMs > 0) await new Promise(resolve => setTimeout(resolve, extraDelayMs));
  await waitForImagesToLoad(element);

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, { scale, backgroundColor: null, useCORS: true });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Conversion en image échouée');
  return new File([blob], filename, { type: 'image/png' });
}
