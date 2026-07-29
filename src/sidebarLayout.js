/**
 * sidebarLayout.js — valeurs d'espacement STABILISÉES de Sidebar.jsx, en une
 * seule source de vérité (même principe que bottomBarLayout.js à côté).
 *
 * Pourquoi ce fichier existe (passation du 28/07, "chantiers en suspens") :
 * Sidebar.jsx a traversé 9 passes successives de réglage fin d'espacement le
 * même jour, avec des allers-retours dans les deux sens sur les mêmes
 * valeurs (`py-2` ↔ `py-2.5` ↔ `py-3`, `my-5` ↔ `my-6`, `mt-4` ↔ `mt-6` ↔
 * `mt-12`...). L'historique complet de CE POURQUOI reste dans Sidebar.jsx
 * lui-même (docstring au-dessus de `<nav>`) — utile pour comprendre le
 * raisonnement, mais pas un point de référence unique pour une valeur ACTUELLE.
 * Ce fichier-ci ne raconte pas cette histoire une 2e fois : il ne contient
 * QUE l'état final stabilisé, pour qu'un futur ajustement parte d'une valeur
 * documentée à un seul endroit plutôt que de la redécouvrir en lisant des
 * commentaires épars.
 *
 * ⚠️ CONTRAIREMENT à MINI_PLAYER_BAR_HEIGHT_PX/GUEST_MODE_BAR_HEIGHT_PX
 * (bottomBarLayout.js), qui ne pouvaient rester que des NOMBRES bruts (une
 * classe Tailwind du type `h-[${x}px]` construite par interpolation n'aurait
 * jamais été générée, voir ce fichier) — ici, les valeurs sont directement
 * des CLASSES TAILWIND COMPLÈTES (`py-2.5`, `mb-4`...), pas des fragments à
 * assembler. C'est la distinction qui compte pour le piège JIT documenté
 * partout dans ce projet : Tailwind scanne le texte SOURCE littéralement
 * (voir `tailwind.config.js`, `content: ["./src/**/*.{js,ts,jsx,tsx}"]`) —
 * tant que la classe complète apparaît EN TOUTES LETTRES quelque part dans
 * un fichier scanné (peu importe lequel), elle est générée, même si le
 * fichier où elle apparaît n'est pas celui où elle est réellement utilisée
 * dans un `className`. Exporter `'py-2.5'` ici puis l'interpoler dans
 * Sidebar.jsx (`` `... ${SIDEBAR_LINK_PADDING} ...` ``) fonctionne donc très
 * bien — contrairement à `hover:${variable}` (variable multi-classes, jamais
 * écrite en toutes lettres AVEC son préfixe quelque part), qui, lui, ne
 * marcherait jamais.
 *
 * Si une future session ajuste l'une de ces valeurs : la changer ICI
 * uniquement (Sidebar.jsx ne la reporte plus en dur nulle part), et ajouter
 * une ligne à l'historique ci-dessous plutôt que de laisser la raison vivre
 * uniquement dans un message de commit.
 */

// Liens de navigation dans la zone scrollable (Création / Mon Espace) —
// padding horizontal+vertical partagé par TOUS ces boutons.
export const SIDEBAR_LINK_PADDING = 'px-3 py-2.5';

// Écart vertical entre les liens d'une même section (Création entre eux,
// Mon Espace entre eux) — un seul `space-y-*` par conteneur de section.
export const SIDEBAR_LINK_GAP = 'space-y-2';

// Marge sous chaque titre de section ("Création", "Mon Espace") — les 2
// titres partagent EXACTEMENT la même valeur (vérifié explicitement lors de
// la 8e passe), sans `mt-*` sur le bouton qui suit.
export const SIDEBAR_SECTION_TITLE_MARGIN = 'mb-4';

// Séparateur physique entre "Création" et "Mon Espace" (`border-t ... my-5`
// sur une div vide) — remplace l'ancienne marge géante `mt-6`/`mt-8`/`mt-12`
// testée puis abandonnée (voir 6e passe, historique complet dans Sidebar.jsx).
export const SIDEBAR_SEPARATOR_MARGIN = 'my-5';

// Padding du conteneur scrollable LUI-MÊME (englobe Création + séparateur +
// Mon Espace) — seule source de l'espacement haut/bas de cette zone depuis
// la 7e passe ; aucun enfant ne doit plus porter sa propre marge de fin.
export const SIDEBAR_SCROLL_PADDING = 'py-4 px-4';

// Bouton "Réglages" du pied de page — délibérément DIFFÉRENT des liens de
// nav ci-dessus (`py-1.5`, pas `py-2.5`) : ce conteneur a une hauteur
// STRICTE à respecter (voir `GUEST_MODE_BAR_HEIGHT_PX`, bottomBarLayout.js,
// hauteur synchronisée via `creditRowHeight` dans Sidebar.jsx), pas la place
// disponible à volonté qu'ont les liens de la zone scrollable.
export const SIDEBAR_FOOTER_LINK_PADDING = 'px-3 py-1.5';
