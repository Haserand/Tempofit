import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
//
// Tailwind v3 → v4 (29/07, même session) — `tailwindcss()` ajouté aux
// plugins Vite : v4 recommande le plugin Vite DÉDIÉ (`@tailwindcss/vite`)
// plutôt que l'ancienne voie PostCSS. `postcss.config.js` et les
// devDependencies `postcss`/`autoprefixer` sont donc SUPPRIMÉS (voir
// package.json) — v4 gère lui-même le préfixage vendor et l'import CSS en
// interne (moteur Lightning CSS), ces 2 dépendances ne servent plus à rien
// ici. Voir src/index.css pour le reste de cette bascule (nouvelle syntaxe
// d'import, classes renommées, choix de garder tailwind.config.js via
// `@config` plutôt que de tout migrer vers `@theme`).

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vitest lit ce même fichier de config (pas de vitest.config.js séparé,
  // donc pas de 2e source de vérité à tenir à jour). `environment: 'node'`
  // (pas 'jsdom') par défaut, VOLONTAIREMENT INCHANGÉ (chantier "premier
  // test de composant React", 29/07, retour direct : "je me moque que ça
  // bloque le déploiement") — les 163 tests existants visent des fonctions
  // pures (musicEngine.js, musicCatalog.js...), aucun composant React monté,
  // donc `node` reste le bon environnement pour EUX (plus rapide, zéro
  // dépendance supplémentaire). Le nouveau test de composant
  // (`tests/ViewHeader.test.jsx`) a besoin de `jsdom` — plutôt que de
  // changer cet `environment` global (ce qui ralentirait TOUS les tests,
  // même ceux qui n'en ont pas besoin), Vitest permet un override PAR
  // FICHIER via un commentaire pragma `// @vitest-environment jsdom` en
  // tête de fichier — voir ce fichier pour ce mécanisme en action. Les 163
  // tests existants restent donc intégralement en `node`, ce nouveau seul
  // bascule en `jsdom`.
  // `include` élargi à `.jsx` (en plus de `.js`) : ce nouveau test contient
  // du JSX (il monte `<ViewHeader/>` pour de vrai via
  // `@testing-library/react`) — nécessite l'extension `.jsx` pour que
  // `@vitejs/plugin-react` lui applique sa transformation JSX (comme pour
  // n'importe quel autre fichier `.jsx` du projet).
  //
  // `pool: 'threads'` (01/08, "chaque déploiement Vercel prend une minute,
  // y a pas moyen de réduire ?") — décision prise à partir des VRAIS
  // chiffres du log Vercel, pas d'une supposition : `vitest run` pèse à lui
  // seul 45,7s sur 52s de build total (88%), et là-dedans le sous-poste
  // "environment" (initialisation de jsdom, pour chacun des ~35 fichiers de
  // test qui montent un composant React) pèse 20,37s — PLUS que
  // l'exécution réelle des 614 tests (11,03s). La machine de build Vercel
  // n'a que 2 cœurs (voir le log : "Build machine configuration: 2 cores,
  // 8 GB") : le pool par défaut de Vitest 4 (`'forks'`, de vrais processus
  // enfants — le plus isolé, mais aussi le plus lourd à démarrer) fait
  // donc surtout la queue plutôt que du vrai parallélisme. `'threads'`
  // (worker_threads natifs Node, démarrage nettement plus léger) vise
  // directement ce poste, sans toucher à la logique d'aucun test.
  //
  // ⚠️ Seul point que je n'ai pas pu vérifier ici (bac à sable sans accès
  // réseau, donc pas de vrai `vitest run` possible) : le pool `'threads'`
  // partage un contexte V8 plus léger entre fichiers que `'forks'`, ce qui
  // pourrait en théorie exposer une pollution d'état entre 2 fichiers de
  // test si l'un d'eux modifiait un objet global sans le nettoyer
  // correctement dans son `afterEach` (voir les pièges déjà documentés en
  // passation sur `cleanup()`/`clearAllMocks()`). Aucun cas de ce genre
  // repéré dans l'audit du projet à ce jour, mais c'est LE point à
  // surveiller sur le prochain déploiement : si un test devient
  // instable/aléatoire qui ne l'était pas avant, revenir à `pool: 'forks'`
  // (ou juste supprimer cette ligne, `'forks'` est le défaut) et me le
  // signaler avec le nom du test concerné plutôt que d'insister.
  //
  // `isolate: false` TENTÉ puis RETIRÉ (01/08) — gain espéré pour cibler le
  // poste "environment" (20,37s, le plus gros poste de `vitest run`), audit
  // de sécurité fait AVANT d'activer (voir tests/ShareModal.test.jsx, seul
  // vrai risque trouvé, corrigé et gardé — bonne pratique indépendamment du
  // reste). Mesuré sur un vrai déploiement Vercel ensuite : AUCUN gain
  // (environment 18,95s → 19,19s, dans le bruit de mesure). Cherché
  // pourquoi plutôt que de re-deviner à l'aveugle une 3e fois : c'est une
  // limitation CONNUE de Vitest lui-même, pas un souci de config ici —
  // l'environnement jsdom est recréé à chaque fichier MÊME sous
  // `--no-isolate` (voir vitest-dev/vitest#8478, signalé par l'équipe MUI
  // exactement sur ce symptôme). Gain nul + risque de fuite d'état entre
  // fichiers de test conservé pour rien = pas justifié, retiré. Si Vitest
  // corrige un jour cette limitation, ça vaudra le coup de retenter.
  //
  // Seul gain confirmé et gardé sur ce chantier "vitesse de build" (01/08) :
  // `pool: 'threads'` ci-dessus (-4,6% sur `vitest run`, 0 régression sur 3
  // déploiements réels). Le reste du temps de `vitest run` (~44s, dominé
  // par la création répétée de jsdom, 1 fois par fichier) semble être un
  // plancher structurel de Vitest sur ce projet en l'état — la seule vraie
  // marge de manœuvre restante serait côté infra (plus de cœurs sur la
  // machine de build Vercel), pas côté config.
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    pool: 'threads',
  },
})
