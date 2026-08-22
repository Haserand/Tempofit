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
 * (voir `tailwind.config.js`, la liste `content`, qui couvre tous les
 * fichiers .js/.ts/.jsx/.tsx sous `src`) —
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

// Variantes COMPACTES (Refactor UI "Compression du menu en Mode Intime",
// 29/07, retour direct : "Statistiques passe sous la ligne de flottaison,
// scroll indésirable") — le bouton "Quitter le Mode Intime" (visible
// SEULEMENT en Mode Intime, en plus des liens habituels) ajoute une
// hauteur que le menu normal n'a jamais à absorber ; plutôt que de
// compacter TOUT le temps (ce qui aurait resserré le mode normal sans
// raison, contraire à la demande explicite de préserver TempoFit intact),
// ces 3 variantes ne s'appliquent QUE quand `isNaughtyMode` est vrai — voir
// Sidebar.jsx, 3 variables locales (`linkPadding`/`linkGap`/
// `sectionTitleMargin`) qui choisissent entre normal et compact UNE SEULE
// FOIS, réutilisées à chaque usage plutôt que de répéter le ternaire à
// chaque bouton.
// 2e ITÉRATION (même jour, retour direct : "trop agressif, tasse trop la
// navigation, on a de la marge au-dessus de Statistiques") — valeurs
// desserrées vers un compromis intermédiaire (`py-1.5`→`py-2`,
// `space-y-1`→`space-y-1.5`, `mb-1`→`mb-2.5`), toujours sous les valeurs
// normales mais moins radicales que le 1er passage.
export const SIDEBAR_LINK_PADDING_COMPACT = 'px-3 py-2';
export const SIDEBAR_LINK_GAP_COMPACT = 'space-y-1.5';
export const SIDEBAR_SECTION_TITLE_MARGIN_COMPACT = 'mb-2.5';

// Séparateur physique entre "Création" et "Mon Espace" (`border-t ... my-5`
// sur une div vide) — remplace l'ancienne marge géante `mt-6`/`mt-8`/`mt-12`
// testée puis abandonnée (voir 6e passe, historique complet dans Sidebar.jsx).
export const SIDEBAR_SEPARATOR_MARGIN = 'my-5';

// Variante Mode Intime (21/08, retour direct : "supprime 2 pixels à chaque
// trait rouge pour voir Découvrir sans scroll") — AVANT ce correctif,
// cette constante n'avait JAMAIS de variante COMPACT (contrairement à
// SIDEBAR_LINK_PADDING/SIDEBAR_LINK_GAP/SIDEBAR_SECTION_TITLE_MARGIN
// juste au-dessus), donc le Mode Intime héritait de la même valeur que le
// mode normal pour ce séparateur précis. `mb-5` (20px) INCHANGÉ tout du
// long (l'écart entre la ligne et "Mon Espace" n'a jamais été marqué).
// HAUT (`mt`) — seul écart marqué, l'écart entre "Mes Playlists" et la
// ligne elle-même : 3 passes successives (même jour) — `mt-5`(20px) →
// `mt-[18px]` (1re) → `mt-[16px]` (2e) → `mt-[13px]` (3e, retour direct :
// "en gros manque une quinzaine de pixels" — -3px cette fois, pour un
// total de -15px répartis sur les 5 écarts marqués de la capture). Valeur
// arbitraire, pas une valeur d'échelle Tailwind standard — écrite en
// toutes lettres ici, donc scannée par le JIT sans piège (voir la
// docstring en tête de fichier).
export const SIDEBAR_SEPARATOR_MARGIN_COMPACT = 'mt-[13px] mb-5';

// Séparateur entre "Mon Espace" et "Découvrir" (21/08, retour direct :
// "réduire l'espace Découvrir de 10px en haut et 10px en bas") — DISTINCT
// de SIDEBAR_SEPARATOR_MARGIN ci-dessus : seul CET écart précis devait être
// resserré, pas celui entre Création/Mon Espace (jamais mentionné, resté
// inchangé). `mt-5` conservé (même écart qu'avant entre "Mes Statistiques"
// et la ligne elle-même, 20px) ; `mb-2.5` (10px, contre `mb-5`/20px avant)
// pour l'écart entre la ligne et "Découvrir" — les -10px demandés en haut
// de "Découvrir" viennent d'ici. Voir aussi `SIDEBAR_SCROLL_PADDING`
// ci-dessous pour les -10px en BAS (après "Découvrir", avant le pied de
// page).
export const SIDEBAR_DISCOVER_SEPARATOR_MARGIN = 'mt-5 mb-2.5';

// Variante Mode Intime (21/08, retour direct : "supprime 2 pixels à chaque
// trait rouge pour voir Découvrir sans scroll") — même principe que
// SIDEBAR_SEPARATOR_MARGIN_COMPACT juste au-dessus, 3 passes successives
// (même jour) sur le HAUT (`mt`) — seul écart marqué, entre "Mes
// Statistiques" et la ligne : `mt-5`(20px) → `mt-[18px]` (1re) →
// `mt-[16px]` (2e) → `mt-[13px]` (3e, retour direct : "en gros manque une
// quinzaine de pixels"). `mb-2.5` (10px) INCHANGÉ tout du long, déjà
// resserré par le correctif "Découvrir" initial, jamais remarqué depuis.
export const SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT = 'mt-[13px] mb-2.5';

// Padding du conteneur scrollable LUI-MÊME (englobe Création + séparateur +
// Mon Espace + Découvrir) — seule source de l'espacement haut/bas de cette
// zone depuis la 7e passe ; aucun enfant ne doit plus porter sa propre
// marge de fin.
// ⚠️ HAUT/BAS SÉPARÉS (21/08, retour direct : "réduire l'espace Découvrir
// de 10px en haut et 10px en bas") — `pt-4` (haut, au-dessus de Création,
// inchangé, jamais mentionné) / `pb-1.5` (bas, après Découvrir, 6px contre
// 16px avant — les -10px demandés en BAS de "Découvrir" viennent d'ici,
// combinés à `SIDEBAR_DISCOVER_SEPARATOR_MARGIN` ci-dessus pour le HAUT).
// Variante COMPACT (Mode Intime, juste en dessous) volontairement NON
// touchée : son budget `py-3` est calculé main dans la main avec le
// centrage du bouton "Quitter le Mode Intime" plus bas dans Sidebar.jsx
// (`pt-0.5 pb-3.5`) — la modifier sans retoucher aussi ce calcul décalerait
// ce bouton, hors périmètre de cette demande.
export const SIDEBAR_SCROLL_PADDING = 'pt-4 pb-1.5 px-4';

// Variante COMPACTE (Refactor UI "Assouplissement du mode compact", 29/07,
// 3e itération, retour direct : "supprimer le léger mouvement de scroll
// restant") — `py-3` (au lieu de `py-4`) UNIQUEMENT en Mode Intime : -4px
// en haut ET en bas du conteneur scrollable, un dernier coup de pouce
// après le relâchement des 3 constantes COMPACT ci-dessus (2e itération),
// qui avait réintroduit un tout petit débordement.
// ⚠️ HAUT/BAS SÉPARÉS (21/08, retour direct, 2e passe : "il manque encore
// quelques pixels, à peu près autant que pour la précédente passe") —
// jusqu'ici volontairement NON touchée (1re passe du même jour), car son
// `py-3` symétrique était calculé main dans la main avec le padding du
// bouton "Quitter le Mode Intime" (`pt-0.5 pb-3.5` à l'époque) pour le
// centrer. Après la 1re passe, ce padding est descendu à `pt-0` — déjà au
// minimum atteignable (pas de padding négatif) — donc la SEULE façon de
// resserrer encore l'espace AU-DESSUS de "Quitter" est de toucher CETTE
// constante. `pt-[10px]` (haut, 12px→10px, -2px).
// ⚠️ BAS RÉDUIT À SON TOUR (même jour, 3e passe, retour direct : "il
// manque encore quelques pixels" — sans traits précis) — `pb-3`(12px) →
// `pb-[10px]` (-2px), l'espace après "Découvrir" avant le pied de page.
// Seul levier restant qui NE rouvre PAS une décision déjà tranchée :
// contrairement à SIDEBAR_LINK_PADDING_COMPACT/SIDEBAR_LINK_GAP_COMPACT/
// SIDEBAR_SECTION_TITLE_MARGIN_COMPACT (juste au-dessus), déjà resserrées
// puis EXPLICITEMENT desserrées le 29/07 ("trop agressif, tasse trop la
// navigation") — les retoucher referait remonter ce même problème déjà
// signalé une fois, donc volontairement laissées de côté sans
// consultation préalable.
// ⚠️ HAUT RÉDUIT UNE 3e FOIS (même jour, 4e passe, retour direct : "en
// gros manque une quinzaine de pixels") — `pt-[10px]` → `pt-[7px]` (-3px,
// cette fois avec un trait rouge précis dessus, contrairement à la passe
// juste au-dessus). Le BAS (`pb-[10px]`) n'était PAS marqué cette fois
// (pas de trait entre "Découvrir" et "Réglages" sur cette capture) —
// laissé inchangé.
export const SIDEBAR_SCROLL_PADDING_COMPACT = 'pt-[7px] pb-[10px] px-4';

// Bouton "Réglages" du pied de page — délibérément DIFFÉRENT des liens de
// nav ci-dessus (`py-1.5`, pas `py-2.5`) : ce conteneur a une hauteur
// STRICTE à respecter (voir `GUEST_MODE_BAR_HEIGHT_PX`, bottomBarLayout.js,
// hauteur synchronisée via `creditRowHeight` dans Sidebar.jsx), pas la place
// disponible à volonté qu'ont les liens de la zone scrollable.
export const SIDEBAR_FOOTER_LINK_PADDING = 'px-3 py-1.5';

// Marge APRÈS la bordure du bouton "Quitter le Mode Intime" (Mode Intime
// uniquement — 21/08, retour direct : "je veux entre Création et la barre
// juste au-dessus le même espace qu'entre Mes Favoris et la barre juste
// au-dessus"). AVANT ce correctif, le conteneur de ce bouton (`pt-0.5
// pb-3.5 border-b`, Sidebar.jsx) n'avait AUCUNE marge après sa bordure :
// "Création" collait directement dessus (0px), contre 20px (`my-5`,
// SIDEBAR_SEPARATOR_MARGIN) pour "Mon Espace" — d'où l'asymétrie remontée
// (capture à l'appui). `mb-5` reprenait délibérément la MÊME valeur que la
// moitié basse de SIDEBAR_SEPARATOR_MARGIN.
// ⚠️ 3 PASSES DE RESSERREMENT (même jour, retours directs successifs :
// "supprime 2 pixels à chaque trait rouge...", "il manque encore quelques
// pixels, à peu près autant que pour la précédente passe", puis "en gros
// manque une quinzaine de pixels") — `mb-5`(20px) → `mb-[18px]` (1re) →
// `mb-[16px]` (2e) → `mb-[13px]` (3e, -3px). Reste
// UNIQUEMENT en Mode Intime (pas besoin d'une variante _COMPACT séparée,
// cette constante entière n'existe déjà que pour ce mode). Désynchronisée
// DÉLIBÉRÉMENT de SIDEBAR_SEPARATOR_MARGIN (restée à 20px, jamais
// mentionnée dans ces 2 demandes) — l'égalité d'origine n'était vraie
// qu'au moment du tout 1er correctif, pas un invariant à vie.
export const SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM = 'mb-[13px]';
