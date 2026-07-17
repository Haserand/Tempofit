/** @type {import('tailwindcss').Config} */
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
      },
    },
  },
  plugins: [],
}
