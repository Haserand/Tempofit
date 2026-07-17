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
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN SYSTEM SÉMANTIQUE (retour direct : centraliser fonds/textes/accent
 * dans des noms logiques plutôt que des classes Tailwind brutes éparpillées)
 * — les variables CSS (`:root`/`.dark`/`.naughty`, voir src/index.css) portent
 * maintenant TOUTE la logique clair/sombre ET Mode Intime pour ces tokens :
 * `bg-primary`/`text-main`/etc. changent automatiquement selon les classes
 * posées sur la racine (`.dark`, `.naughty` — voir App.jsx), donc plus besoin
 * de ternaire `isNaughtyMode ? ... : ...` ni de variante `dark:` séparée ici
 * pour CES tokens précis. Un seul endroit à modifier (index.css) si la charte
 * change un jour, plutôt que de repasser sur chaque hook/composant.
 *
 * Pas encore migrés, volontairement (pas d'équivalent 1:1 sans changement
 * visuel non validé) :
 * - `textColorClass` : ses nuances exactes (dark:red-500, dark:rose-400) ne
 *   correspondent pas aux valeurs choisies pour `--color-primary` en mode
 *   sombre (red-600/rose-600) — le migrer décalerait la couleur du texte
 *   accent en mode sombre, jamais validé.
 * - `textMain` : légèrement plus doux que `textHighlight` (dark:gray-100 vs
 *   dark:white) — un vrai 2e ton de texte, pas un doublon à fusionner sans
 *   trancher lequel des deux garder.
 * - `inputBg`/`inputBorder` : `inputBg` a la même valeur que `base` (fusion
 *   possible plus tard), mais `inputBorder` (gray-300/700) diffère de
 *   `divider` (gray-200/800) — un 2e ton de bordure distinct aujourd'hui,
 *   pas fusionné pour ne rien changer visuellement sans validation.
 *
 * Usage :
 *   const theme = useTheme(isNaughtyMode);
 *   <div className={theme.cardBg}>...
 */
export function useTheme(isNaughtyMode) {
  const themeColor = isNaughtyMode ? 'rose' : 'red';
  const bgMainApp = isNaughtyMode
    ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-50 to-white dark:from-gray-900 dark:via-rose-950/20 dark:to-black'
    : 'bg-base';
  const textMain = 'text-gray-900 dark:text-gray-100';
  const textColorClass = isNaughtyMode ? 'text-rose-500 dark:text-rose-400' : 'text-red-500 dark:text-red-500';
  const bgAccentClass = 'bg-primary';
  const borderAccentClass = 'border-primary';

  const cardBg = "bg-surface";
  const cardBorder = "border-divider";
  const inputBg = "bg-gray-50 dark:bg-gray-950";
  const inputBorder = "border-gray-300 dark:border-gray-700";

  // Contraste renforcé en clair + Intime (fond plus pâle dans ce mode) déjà
  // encodé dans `.naughty` (index.css) — `text-muted` seul suffit maintenant,
  // plus besoin du ternaire ici (le mode sombre n'était de toute façon pas
  // concerné par cette nuance, voir note d'origine).
  const textMuted = "text-muted";
  const textHighlight = "text-main";

  return {
    themeColor, bgMainApp, textMain, textColorClass, bgAccentClass, borderAccentClass,
    cardBg, cardBorder, inputBg, inputBorder, textMuted, textHighlight,
  };
}
