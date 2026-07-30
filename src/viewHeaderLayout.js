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
 * Calcul du budget (2e itération, APPROCHE ABANDONNÉE en 3e itération —
 * conservé ici pour comprendre pourquoi le titre a été réduit avant de
 * remonter en taille, voir plus bas) : à l'époque, `<main>`+la Sidebar
 * partageaient déjà le même `pt-6`, mais l'en-tête de chaque vue empilait
 * 2 lignes (titre+sous-titre) contre 1 seule pour le logo — ce qui avait
 * mené à réduire le TITRE lui-même (`text-base`, ~20px) pour tenir dans un
 * budget de 40px calculé à la main.
 *
 * 3e ITÉRATION (même jour, retours directs : "le titre doit faire la même
 * taille que le logo" + "même niveau/ligne horizontale que le logo" +
 * "trop d'espace avant le liseret" + "fais un truc joli avec les sous-
 * titres") — CHANGEMENT D'APPROCHE : plutôt que de réduire le titre pour
 * le faire tenir à côté d'un sous-titre empilé en dessous, ViewHeader.jsx
 * fait maintenant tenir titre ET sous-titre SUR LA MÊME LIGNE (dès `sm:`,
 * séparés par un point médian, alignés sur la ligne de base) — le titre
 * peut alors reprendre EXACTEMENT la typographie du logo (`text-2xl
 * font-bold tracking-tight leading-none`, voir Sidebar.jsx et
 * ViewHeader.jsx) sans calcul de budget à 2 lignes : les deux blocs (logo
 * et en-tête de vue) sont maintenant CHACUN à une seule ligne, avec le
 * même `pt-6` partagé — leur "niveau" se correspond directement, sans
 * arithmétique. Voir ViewHeader.jsx pour le détail de cette fusion sur 1
 * ligne (et son repli en 2 lignes empilées sur mobile, où la comparaison
 * avec la Sidebar n'est de toute façon pas visible).
 *
 * Ce module exporte 2 valeurs, de nature différente :
 * - `VIEW_HEADER_ICON_SIZE` : un NOMBRE (prop `size` des icônes lucide-
 *   react) — aucune contrainte Tailwind ici, c'est une simple constante JS,
 *   importable et utilisable telle quelle partout. Valeur 24px (3e
 *   itération) : proportionnée au nouveau titre `text-2xl` (24px) —
 *   légèrement SOUS les 28px de l'icône du logo Sidebar (qui, elle, vit
 *   dans un badge coloré avec son propre padding, un contexte visuel
 *   différent d'une icône nue à côté du texte) plutôt qu'une égalité
 *   stricte à l'aveugle.
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
 * du titre/sous-titre dans ViewHeader.jsx — la changer ICI (et dans
 * ViewHeader.jsx pour la typographie) uniquement — ni App.jsx, ni
 * Sidebar.jsx, ni aucun fichier de vue ne la répète en dur ailleurs.
 */

// Icône du titre H1 de chaque vue (Zap, Compass, Star, Activity...) —
// proportionnée au titre `text-2xl` (3e itération, voir plus haut) : même
// typographie que le logo, icône légèrement sous sa taille brute (28px)
// puisqu'elle n'a ici aucun badge coloré autour pour "gonfler" sa présence
// visuelle comme celle du logo.
export const VIEW_HEADER_ICON_SIZE = 24;

// Padding-top de `<main>` (App.jsx) — DOIT rester une valeur FIXE (pas de
// variante `sm:`/`md:` qui l'escalade à un breakpoint donné) puisque le
// bloc logo de la Sidebar qu'elle doit égaler (`Sidebar.jsx`, `p-6` sur son
// conteneur logo) n'a lui-même aucune variante responsive.
export const VIEW_HEADER_TOP_PADDING = 'pt-6';
