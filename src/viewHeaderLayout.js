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
 * 4e ITÉRATION (même jour, retour direct : "je tiens à 2 lignes" — la 3e
 * itération avait fusionné titre+sous-titre sur 1 seule ligne pour
 * contourner le problème d'alignement, refusé) — retour à 2 lignes
 * empilées dans ViewHeader.jsx (titre puis sous-titre, comme à l'origine),
 * mais avec un vrai calcul de budget cette fois plutôt qu'une réduction à
 * l'aveugle du titre (2e itération) ou un changement de structure (3e) :
 * - Sidebar (référence FIXE) : pt-6 (24px) + ligne logo (badge icône 28px
 *   + padding ≈ 40px) + pb-6 (24px) = 88px jusqu'à sa bordure.
 * - `<main>` partage déjà pt-6 (24px) — reste 88 − 24 = 64px pour
 *   (icône + titre + espacement + sous-titre + pb de ViewHeader.jsx).
 * - Retenu : icône 28px (= logo) + titre `text-2xl leading-none` (ligne
 *   dominée par l'icône, 28px) + `mt-1` (4px) + sous-titre `text-sm
 *   leading-tight` (≈18px) = 50px de contenu → pb nécessaire = 64 − 50 =
 *   14px = `pb-3.5` (0.875rem, un palier STANDARD de l'échelle Tailwind,
 *   pas une valeur arbitraire bricolée pour l'occasion).
 * Reste une ESTIMATION (aucun navigateur réel dans cet environnement de
 * dev) mais un calcul complet, documenté, reproductible si les métriques
 * réelles imposent un ajustement fin après déploiement — voir
 * ViewHeader.jsx pour le détail.
 *
 * Ce module exporte 2 valeurs, de nature différente :
 * - `VIEW_HEADER_ICON_SIZE` : un NOMBRE (prop `size` des icônes lucide-
 *   react) — aucune contrainte Tailwind ici, c'est une simple constante JS,
 *   importable et utilisable telle quelle partout. Valeur 28px (4e
 *   itération) : égale à l'icône du logo Sidebar, le budget recalculé
 *   ci-dessus laisse maintenant la place nécessaire pour cette égalité
 *   stricte (contrairement à la 2e itération, où 28px seul occupait déjà
 *   70% d'un budget bien plus serré, calculé pour un TITRE réduit).
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
// EXACTEMENT la même taille que l'icône du logo Sidebar (4e itération,
// voir plus haut) : le budget recalculé pour 2 lignes empilées laisse
// maintenant la place nécessaire à cette égalité stricte.
export const VIEW_HEADER_ICON_SIZE = 28;

// Padding-top de `<main>` (App.jsx) — DOIT rester une valeur FIXE (pas de
// variante `sm:`/`md:` qui l'escalade à un breakpoint donné) puisque le
// bloc logo de la Sidebar qu'elle doit égaler (`Sidebar.jsx`, `p-6` sur son
// conteneur logo) n'a lui-même aucune variante responsive.
export const VIEW_HEADER_TOP_PADDING = 'pt-6';
