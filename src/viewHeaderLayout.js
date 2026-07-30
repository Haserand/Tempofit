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
 * 2e ITÉRATION (même jour, retour direct : "ça n'a rien changé du tout") —
 * corriger le SEUL padding-top ne suffisait pas : le vrai problème est
 * STRUCTUREL. Le bloc logo de la Sidebar tient sur UNE seule ligne (logo +
 * texte), alors que l'en-tête de chaque vue empile DEUX lignes (titre H1 +
 * sous-titre) avant sa bordure — mécaniquement plus haut, quel que soit le
 * padding. Nouvelle demande, plus précise : le liseret sous le sous-titre
 * de chaque page doit venir se caler EXACTEMENT sur le liseret sous le logo
 * (référence FIXE, jamais l'inverse) — ce qui impose un vrai BUDGET de
 * hauteur au contenu (icône + titre + sous-titre), pas juste un padding à
 * ajuster.
 *
 * Calcul du budget (approximatif — aucun navigateur réel dans cet
 * environnement de dev, valeurs à confirmer/affiner sur un vrai
 * déploiement) :
 * - Bloc logo Sidebar, du haut jusqu'à sa bordure : pt-6 (24px) + hauteur de
 *   la ligne logo (badge icône `size=28` + padding `p-1.5` ≈ 40px, le plus
 *   haut élément de cette ligne) + pb-6 (24px) = 88px.
 * - `<main>` partage déjà le même pt-6 (24px, voir VIEW_HEADER_TOP_PADDING)
 *   — il reste donc 88 − 24 − 24(pb-6 de ViewHeader, INCHANGÉ) = 40px pour
 *   loger icône + titre + espacement + sous-titre AVANT la bordure de
 *   ViewHeader.jsx.
 * Répartition retenue dans ViewHeader.jsx (voir ce fichier) : icône +
 * titre `text-base` ≈ 20px de ligne, `mt-1` (4px), sous-titre `text-xs` ≈
 * 15px de ligne → total ≈ 39px, sous la barre des 40px avec une petite
 * marge de sécurité face à l'approximation des métriques de police.
 *
 * Ce module exporte 2 valeurs, de nature différente :
 * - `VIEW_HEADER_ICON_SIZE` : un NOMBRE (prop `size` des icônes lucide-
 *   react) — aucune contrainte Tailwind ici, c'est une simple constante JS,
 *   importable et utilisable telle quelle partout. Valeur RÉDUITE (28→20)
 *   lors de cette 2e itération : à 28px, l'icône à elle seule occupait déjà
 *   70% du budget total de 40px, ne laissant presque rien au sous-titre —
 *   la contrainte "même taille que le logo" de la 1re itération est
 *   devenue secondaire face à la contrainte "tenir dans le budget de
 *   hauteur partagé", plus stricte et plus prioritaire ici.
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
 * Si un futur ajustement change l'une de ces 2 valeurs — ou la typographie
 * du titre/sous-titre dans ViewHeader.jsx, qui doit rester dans le budget
 * documenté ci-dessus — la changer ICI uniquement — ni App.jsx, ni
 * Sidebar.jsx, ni aucun fichier de vue ne la répète en dur ailleurs.
 */

// Icône du titre H1 de chaque vue (Zap, Compass, Star, Activity...) —
// dimensionnée pour tenir dans le budget de hauteur de 40px partagé avec
// ViewHeader.jsx (voir calcul ci-dessus), PAS pour égaler la taille brute
// de l'icône du logo Sidebar (`size=28`, contrainte de la 1re itération,
// devenue secondaire).
export const VIEW_HEADER_ICON_SIZE = 20;

// Padding-top de `<main>` (App.jsx) — DOIT rester une valeur FIXE (pas de
// variante `sm:`/`md:` qui l'escalade à un breakpoint donné) puisque le
// bloc logo de la Sidebar qu'elle doit égaler (`Sidebar.jsx`, `p-6` sur son
// conteneur logo) n'a lui-même aucune variante responsive.
export const VIEW_HEADER_TOP_PADDING = 'pt-6';
