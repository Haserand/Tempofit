import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import './index.css'

// React 18 → 19 (chantier "dernières versions majeures", 29/07) — ce fichier
// n'a RIEN eu à changer : `ReactDOM.createRoot(...).render(...)` était déjà
// le pattern React 18+ recommandé (pas l'ancien `ReactDOM.render`, retiré en
// React 19). Audit complet du reste de `src/` avant cette bascule : aucun
// usage de refs en chaîne, `defaultProps` sur composant fonction, Context
// API historique (`contextTypes`/`getChildContext`), `PropTypes`, ni
// `forwardRef` — les APIs que React 19 retire ou dont il change le
// comportement. Le JSX runtime automatique (déjà configuré par défaut via
// `@vitejs/plugin-react`, voir vite.config.js) est également le pré-requis
// de React 19 pour `ref` en tant que prop normal — déjà en place, rien à
// changer là non plus.
// Dépendances tierces à bumper EN MÊME TEMPS que React (sinon `npm install`
// échoue ou l'app tourne mais rend des graphiques invisibles) — voir
// package.json :
// - `recharts` → 2.15.0 minimum ("Final 2.x React 19 support" côté
//   mainteneurs) + `overrides.react-is` forcé à la même version que React :
//   sans cet override, recharts ne PLANTE PAS mais n'affiche plus aucun
//   graphique, silencieusement (piège documenté par l'équipe recharts
//   elle-même, lié à un décalage de version de `react-is`, une dépendance
//   interne). Résolu nativement en recharts 3.x, mais rester sur la lignée
//   2.x évite d'absorber une 2e migration (API des composants) en plus de
//   celle de React.
// - `lucide-react` → dernière version (1.x) : l'ancienne (0.383.0) ne
//   déclare pas React 19 comme peer dependency compatible. Changements de
//   la v1.0 (suppression des icônes de marques, ESM/CJS only) vérifiés sans
//   impact ici — aucune icône de marque utilisée dans ce projet (Spotify/
//   Deezer sont des textes/logos maison, pas des icônes lucide), déjà 100%
//   ESM via Vite. ⚠️ Vérification VISUELLE recommandée après déploiement :
//   comparer que toutes les icônes s'affichent toujours (survol rapide de
//   chaque vue) — un renommage d'icône entre versions se voit tout de
//   suite (case vide) mais n'aurait pas été détectable autrement sans
//   `npm install` réel.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
