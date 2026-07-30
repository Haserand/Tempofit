/**
 * viewHeaderLayout.js — valeurs partagées entre l'en-tête de chaque vue
 * (`<ViewHeader/>`, dans les 8 fichiers `views/*.jsx` qui l'utilisent) et le
 * bloc logo de la Sidebar, en une seule source de vérité.
 *
 * Pourquoi ce fichier existe (Refactor UI "Harmonisation de la ligne de
 * flottaison", 29/07) : avant lui, deux réglages vivaient dupliqués SANS
 * aucun lien qui les rattache entre eux :
 * - `size={36}` codé en dur dans CHACUN des 8 fichiers de vue (icône du
 *   titre H1), sans rapport avec `size={28}` de l'icône du logo Sidebar.jsx
 *   — d'où un vrai décalage d'échelle entre les deux, jamais remarqué
 *   avant une relecture visuelle attentive.
 * - Le padding-top de `<main>` (App.jsx, `pt-6 sm:pt-8`, ESCALADAIT avec le
 *   breakpoint) contre celui du bloc logo de la Sidebar (`p-6`, FIXE, sans
 *   variante responsive) — dès `sm:` (exactement la disposition desktop où
 *   Sidebar et contenu principal sont visibles côte à côte), le titre de
 *   page démarrait 8px plus bas que le logo, sans qu'aucune erreur ni
 *   avertissement ne le signale.
 * Modifier l'un des deux côtés sans se souvenir de reporter le même
 * changement à l'autre aurait recassé cette même grille en silence — même
 * classe de problème que celle déjà documentée dans bottomBarLayout.js
 * (hauteurs de barres dupliquées à 3 endroits sans lien entre eux).
 *
 * Ce module exporte 2 valeurs, de nature différente :
 * - `VIEW_HEADER_ICON_SIZE` : un NOMBRE (prop `size` des icônes lucide-
 *   react) — aucune contrainte Tailwind ici, c'est une simple constante JS,
 *   importable et utilisable telle quelle partout.
 * - `VIEW_HEADER_TOP_PADDING` : une classe Tailwind COMPLÈTE (`'pt-6'`),
 *   pas un nombre — à la différence de bottomBarLayout.js (qui ne pouvait
 *   rester qu'en pixels bruts, une classe `h-[${x}px]` construite par
 *   interpolation n'étant jamais générée par Tailwind, voir ce fichier),
 *   ici la classe EST le token : `pt-6` est un nom de classe complet et
 *   autonome, qui peut être exporté puis interpolé ailleurs (dans un
 *   template literal, App.jsx) sans jamais être fragmenté ni reconstruit à
 *   partir d'un nombre — Tailwind la voit écrite en toutes lettres ICI (ce
 *   fichier fait partie de `content` dans tailwind.config.js), donc la
 *   génère, même utilisée par interpolation ailleurs. Utilisée par
 *   `<main>` (App.jsx, EN ENTIER : c'est déjà sa seule classe de
 *   padding-top) ET par le bloc logo de la Sidebar (Sidebar.jsx, seulement
 *   le CÔTÉ HAUT — son padding gauche/droite/bas reste un raccourci
 *   `px-6 pb-6` local, non partagé, puisque rien ailleurs n'a besoin de
 *   s'y aligner).
 *
 * Si un futur ajustement change l'une de ces 2 valeurs : la changer ICI
 * uniquement — ni App.jsx, ni Sidebar.jsx, ni aucun fichier de vue ne la
 * répète en dur ailleurs.
 */

// Icône du titre H1 de chaque vue (Zap, Compass, Star, Activity...) — même
// dimension que l'icône du logo TempoFit dans la Sidebar (Activity/Heart,
// `size={28}`, voir Sidebar.jsx), pour une échelle visuelle cohérente entre
// le logo et les titres de page.
export const VIEW_HEADER_ICON_SIZE = 28;

// Padding-top de `<main>` (App.jsx) — DOIT rester une valeur FIXE (pas de
// variante `sm:`/`md:` qui l'escalade à un breakpoint donné) puisque le
// bloc logo de la Sidebar qu'elle doit égaler (`Sidebar.jsx`, `p-6` sur son
// conteneur logo) n'a lui-même aucune variante responsive.
export const VIEW_HEADER_TOP_PADDING = 'pt-6';
