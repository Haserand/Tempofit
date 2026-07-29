import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 5 → 8 (chantier "dernières versions majeures", 29/07) — CE fichier
// n'a presque rien à changer : aucune des options désormais retirées entre
// v5 et v8 (`legacy.proxySsrExternalModules`, `css.preprocessorOptions.
// sass.api`, `splitVendorChunkPlugin`...) n'était utilisée ici. Le vrai
// changement est ailleurs :
// - Node.js 20.19+/22.12+ désormais REQUIS par Vite (voir `engines` dans
//   package.json, ajouté pour ce chantier) — à vérifier aussi côté Vercel
//   (Project Settings → Node.js Version) si le déploiement échoue.
// - Vite 8 remplace ENTIÈREMENT Rollup (prod) + esbuild (dev) par Rolldown,
//   un bundler unique écrit en Rust — dev et prod tournent enfin sur le
//   même moteur. `@vitejs/plugin-react` bumpé en v6 en conséquence (Babel
//   n'est plus une dépendance par défaut, le Fast Refresh passe par Oxc).
// - L'ancien `overrides.vite.rollup: "npm:@rollup/wasm-node"` de
//   package.json a été RETIRÉ : Vite 8 ne dépend plus du tout du package
//   `rollup`, cet override ne ciblait donc plus rien. ⚠️ Si ce contournement
//   avait été ajouté pour une vraie raison (ex. binaires natifs
//   indisponibles dans un environnement de build donné), Rolldown pourrait
//   être exposé au même type de problème SANS échappatoire WASM connue à ce
//   jour — à surveiller en particulier sur le tout premier déploiement
//   Vercel après cette bascule.
// - Vitest bumpé en v4 (exige Vite >= 6, donc de toute façon nécessaire
//   avec Vite 8) — aucun usage de `vi.fn`/`vi.mock`/`vi.spyOn` dans
//   `tests/`, donc aucun des changements de comportement des mocks
//   (le plus gros morceau de la migration Vitest 4) ne concerne ce projet.

export default defineConfig({
  plugins: [react()],
  // Vitest lit ce même fichier de config (pas de vitest.config.js séparé,
  // donc pas de 2e source de vérité à tenir à jour). `environment: 'node'`
  // (pas 'jsdom') volontairement : les tests visent des fonctions pures
  // (musicEngine.js, musicCatalog.js...), aucun composant React monté, donc
  // aucune simulation de navigateur nécessaire — plus rapide, zéro dépendance
  // supplémentaire (jsdom n'est même pas installé).
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
