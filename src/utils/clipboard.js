/**
 * clipboard.js — copie robuste dans le presse-papier (08/08, nouveau).
 *
 * Trouvé en implémentant le bouton "Copier le lien" du profil public
 * (SettingsView.jsx, retour direct) : DEUX implémentations différentes de
 * "copier dans le presse-papier" coexistaient déjà dans le projet, l'une
 * nettement plus fiable que l'autre —
 * - `copyRedirectUri` (SettingsView.jsx) : `navigator.clipboard` SEUL,
 *   échec silencieux (`.catch(() => {})`) — aucun repli, aucun retour
 *   utilisateur si la copie échoue réellement.
 * - `copyToClipboard` (useShare.js) : `navigator.clipboard` en priorité,
 *   repli sur l'ancienne API `execCommand` si indisponible (contexte non
 *   sécurisé / navigateur ancien) — ET vérifie la VALEUR DE RETOUR
 *   d'`execCommand('copy')`, qui peut renvoyer `false` sans lever
 *   d'exception dans la plupart des navigateurs (un vrai bug avait été
 *   corrigé là-dessus le 31/07 : le toast de succès s'affichait avant
 *   même que ça ne soit vérifié).
 *
 * `copyTextToClipboard(text)` centralise la version ROBUSTE (celle de
 * `useShare.js`, éprouvée), pour que tout futur bouton "copier" du projet
 * en hérite par défaut plutôt que de repartir de la version la plus
 * fragile par accident. `useShare.js` n'a volontairement PAS été
 * retouché dans la foulée (couplé à `shareData`/`closeModal`/`showToast`,
 * un vrai refactor, pas juste un remplacement d'appel) — signalé à
 * l'utilisateur, pas fait sans validation.
 *
 * @param {string} text - Le texte à copier.
 * @returns {Promise<boolean>} - `true` si la copie a réellement réussi.
 */
export async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Repli sur execCommand ci-dessous (ex : permission refusée).
    }
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.top = '0'; textArea.style.left = '0'; textArea.style.position = 'fixed';
  document.body.appendChild(textArea);
  textArea.focus(); textArea.select();
  let succeeded = false;
  try { succeeded = document.execCommand('copy'); } catch (err) { succeeded = false; }
  document.body.removeChild(textArea);
  return succeeded;
}
