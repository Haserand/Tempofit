/** @type {import('tailwindcss').Config} */
// Tailwind v3 → v4 (29/07) — ce fichier n'est PLUS chargé automatiquement
// (v4 ne scanne plus tailwind.config.js par défaut) : il est désormais
// explicitement importé via `@config "../tailwind.config.js"` dans
// src/index.css. Voir ce fichier pour pourquoi le système de couleurs
// ci-dessous est resté en JS plutôt que migré vers `@theme` (CSS natif v4).
// Contenu INCHANGÉ sinon — `content`/`darkMode`/`theme.extend.colors`
// continuent de fonctionner à l'identique via `@config`.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      // Design System sémantique — chaque couleur pointe vers une variable
      // CSS (voir src/index.css) plutôt qu'une valeur figée : `.dark` (mode
      // sombre, déjà existant) et `.naughty` (Mode Intime, accent seulement)
      // réécrivent ces variables, donc `bg-primary`/`text-main`/etc. changent
      // automatiquement selon le thème actif — une seule classe à écrire dans
      // les composants, jamais de variante `dark:` séparée pour ces tokens.
      // Format `rgb(var(--x) / <alpha-value>)` : permet l'opacité Tailwind
      // (ex. `bg-primary/80`), impossible avec un simple hex en variable CSS.
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        base: 'rgb(var(--color-base) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',
        main: 'rgb(var(--color-main) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        divider: 'rgb(var(--color-divider) / <alpha-value>)',
        'divider-strong': 'rgb(var(--color-divider-strong) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
