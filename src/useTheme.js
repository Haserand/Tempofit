/**
 * useTheme.js — Tokens de couleur Tailwind partagés par toutes les vues.
 *
 * Extrait de App.jsx (bloc "Tokens de thème" en fin de composant). Tout dépend
 * uniquement de `isNaughtyMode` (mode Intime) — aucun state interne, aucun
 * effet de bord. Chaque vue extraite doit consommer ce hook plutôt que de
 * redéfinir ses propres classes, pour garder une seule source de vérité sur
 * les couleurs (sinon on retombe dans le problème qu'on essaie de résoudre :
 * de la logique dupliquée à plusieurs endroits).
 *
 * Usage :
 *   const theme = useTheme(isNaughtyMode);
 *   <div className={theme.cardBg}>...
 */
export function useTheme(isNaughtyMode) {
  const themeColor = isNaughtyMode ? 'rose' : 'red';
  const bgMainApp = isNaughtyMode
    ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-50 to-white dark:from-gray-900 dark:via-rose-950/20 dark:to-black'
    : 'bg-gray-50 dark:bg-gray-950';
  const textMain = 'text-gray-900 dark:text-gray-100';
  const textColorClass = isNaughtyMode ? 'text-rose-500 dark:text-rose-400' : 'text-red-500 dark:text-red-500';
  const bgAccentClass = isNaughtyMode ? 'bg-rose-500 dark:bg-rose-600' : 'bg-red-500 dark:bg-red-600';
  const borderAccentClass = isNaughtyMode ? 'border-rose-500' : 'border-red-500';

  const cardBg = "bg-white dark:bg-gray-900";
  const cardBorder = "border-gray-200 dark:border-gray-800";
  const inputBg = "bg-gray-50 dark:bg-gray-950";
  const inputBorder = "border-gray-300 dark:border-gray-700";

  // Voir note d'origine dans App.jsx : contraste renforcé en clair + Intime
  // uniquement (fond plus pâle dans ce mode), le mode sombre n'est pas concerné.
  const textMuted = isNaughtyMode ? "text-gray-500 dark:text-gray-500" : "text-gray-400 dark:text-gray-500";
  const textHighlight = "text-gray-900 dark:text-white";

  return {
    themeColor, bgMainApp, textMain, textColorClass, bgAccentClass, borderAccentClass,
    cardBg, cardBorder, inputBg, inputBorder, textMuted, textHighlight,
  };
}
