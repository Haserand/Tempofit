import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
