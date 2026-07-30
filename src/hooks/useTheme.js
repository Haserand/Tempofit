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
 * - `inputBorder` (gray-300/700) diffère de `divider` (gray-200/800) — un 2e
 *   ton de bordure distinct aujourd'hui, pas fusionné pour ne rien changer
 *   visuellement sans validation. (`inputBg` a été fusionné dans `base` cette
 *   session : valeur hex identique, zéro changement visuel.)
 *
 * Usage :
 *   const theme = useTheme(isNaughtyMode);
 *   <div className={theme.cardBg}>...
 */
export function useTheme(isNaughtyMode) {
  const themeColor = isNaughtyMode ? 'rose' : 'red';
  // Dégradé Mode Intime — CASSÉ SILENCIEUSEMENT par la bascule Tailwind v4
  // (29/07), corrigé ici (retour direct : "le dégradé rose du Mode Intime a
  // disparu"). L'ancienne classe `bg-[radial-gradient(ellipse_at_top,
  // _var(--tw-gradient-stops))]` était un bricolage manuel datant d'avant
  // l'existence d'un utilitaire radial natif dans Tailwind (v3 n'en avait
  // pas) : elle référence directement `--tw-gradient-stops`, une variable
  // interne que `from-*`/`via-*`/`to-*` suffisaient à peupler en v3. En v4,
  // le moteur de dégradés a été entièrement réécrit (interpolation OKLCH
  // par défaut, nouvelles classes `bg-linear-*`/`bg-radial-*`/`bg-conic-*`)
  // et introduit une variable compagnon, `--tw-gradient-position`, que SEULES
  // ces nouvelles classes natives posent correctement — jamais posée par
  // l'ancien bricolage, resté à `initial`, ce qui invalide tout le dégradé
  // composé malgré `from-*`/`to-*` toujours présents. Remplacé par
  // `bg-radial-[at_top]`, l'équivalent natif v4 (le mot-clé CSS `top` est
  // valide dans la syntaxe `at <position>` d'un radial-gradient standard,
  // `ellipse` reste la forme par défaut si non précisée — rendu identique à
  // l'original, juste par le bon mécanisme).
  const bgMainApp = isNaughtyMode
    ? 'bg-radial-[at_top] from-rose-50 to-white dark:from-gray-900 dark:via-rose-950/20 dark:to-black'
    : 'bg-base';
  const textMain = 'text-gray-900 dark:text-gray-100';
  const textColorClass = isNaughtyMode ? 'text-rose-500 dark:text-rose-400' : 'text-red-500 dark:text-red-500';
  const bgAccentClass = 'bg-primary';
  const borderAccentClass = 'border-primary';

  const cardBg = "bg-surface";
  const cardBorder = "border-divider";
  // cardBorderStrong — bordures de structure "macro" (2px : bord de la
  // Sidebar, barres inférieures, sous le logo — voir "Refonte Layout" du
  // 26-27/07), par opposition à cardBorder (1px, contenu interne). Remplace
  // 5 occurrences codées en dur de `border-slate-200 dark:border-white/20`
  // (chantier noté dans la passation du 27/07 : "si ce cadrage à 2px devient
  // une vraie convention durable, vaut le coup de la remonter en token").
  const cardBorderStrong = "border-divider-strong";
  const inputBg = "bg-base"; // valeur identique à `base` (gray-50/gray-950) — fusion actée cette session
  const inputBorder = "border-gray-300 dark:border-gray-700";

  // Contraste renforcé en clair + Intime (fond plus pâle dans ce mode) déjà
  // encodé dans `.naughty` (index.css) — `text-muted` seul suffit maintenant,
  // plus besoin du ternaire ici (le mode sombre n'était de toute façon pas
  // concerné par cette nuance, voir note d'origine).
  const textMuted = "text-muted";
  const textHighlight = "text-main";

  return {
    themeColor, bgMainApp, textMain, textColorClass, bgAccentClass, borderAccentClass,
    cardBg, cardBorder, cardBorderStrong, inputBg, inputBorder, textMuted, textHighlight,
  };
}
