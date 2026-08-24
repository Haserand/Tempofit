/**
 * bottomBarLayout.js — la hauteur EXACTE des barres inférieures
 * (MiniPlayerBar.jsx, GuestModeBar.jsx), en une seule source de vérité.
 *
 * ⚠️ SIMPLIFIÉ (22/08) — ce fichier exportait avant 2 constantes
 * distinctes (`MINI_PLAYER_BAR_HEIGHT_PX`/`GUEST_MODE_BAR_HEIGHT_PX`),
 * une par barre, parce que chacune écrivait alors sa PROPRE classe
 * `h-[...px]` en dur dans son propre fichier — 2 copies indépendantes du
 * même nombre, avec le risque de désynchronisation que ce module
 * documentait déjà (et qui s'est réalisé pour de vrai, voir plus bas).
 * Les 2 barres partagent désormais un conteneur commun
 * (`BottomBarShell.jsx`, même jour) qui porte l'UNIQUE classe `h-[70px]`
 * du projet pour cette hauteur — il n'y a donc plus 2 valeurs à
 * maintenir manuellement synchronisées, seulement UNE, exportée ici pour
 * les rares cas où un composant JS (pas du CSS) aurait besoin de ce
 * nombre (aucun cas de ce genre actuellement, ce module reste par
 * précaution/documentation plutôt que par nécessité immédiate).
 *
 * Historique de la duplication d'origine, pour mémoire : ces deux
 * nombres vivaient dupliqués à 3 endroits avant le 08/08 — `h-[90px]`/
 * `h-[40px]` codés en dur dans MiniPlayerBar.jsx/GuestModeBar.jsx, ET
 * recopiés une 3e fois dans `creditRowHeight` (Sidebar.jsx) pour aligner
 * la case crédit sur ces mêmes hauteurs. `creditRowHeight` retiré de
 * Sidebar.jsx le 22/08 (retour direct — "l'accessibilité de la
 * navigation du menu doit être privilégiée", voir Sidebar.jsx) : ce 3e
 * usage a disparu ce jour-là. Puis, MÊME JOUR, la duplication restante
 * (2 classes séparées) a directement causé 2 bugs de désalignement
 * distincts (`MINI_PLAYER_BAR_HEIGHT_PX` 90→70 puis
 * `GUEST_MODE_BAR_HEIGHT_PX` resté à l'ancienne valeur 72 le temps d'un
 * retour direct suivant, laissant un résidu de quelques px visible entre
 * les 2 barres) — la preuve concrète que documenter un risque de
 * duplication (ce que ce fichier faisait déjà) ne suffit pas à
 * l'éliminer, contrairement à une structure de code qui le rend
 * simplement impossible (`BottomBarShell.jsx`, extrait dans la foulée).
 * Voir la Convention UI du README ("Une recette de mise en page
 * recopiée... dérive") pour le principe général tiré de cet
 * enchaînement.
 *
 * ⚠️ PIÈGE TAILWIND CONNU sur ce projet (voir passation du 26/07,
 * `GuestModeBar.jsx` à l'époque, classe `hover:${cardBg}` jamais générée) :
 * une classe Tailwind DOIT apparaître en toutes lettres dans le code source
 * pour que le scanner JIT la génère — une classe reconstruite par
 * interpolation (`` `h-[${BOTTOM_BAR_HEIGHT_PX}px]` ``) NE FONCTIONNERAIT
 * PAS, même en important cette constante depuis ici. C'est pour ça que
 * `BottomBarShell.jsx` garde `h-[70px]` écrit en dur dans son JSX (Tailwind
 * doit le voir tel quel) — cette classe et la constante ci-dessous doivent
 * donc rester manuellement synchronisées EN VALEUR si cette hauteur change
 * un jour (voir bottomBarLayout.test.js, qui vérifie ce lien pour de vrai)
 * — mais il n'y a plus qu'UN SEUL endroit à modifier côté JSX, pas deux.
 */
export const BOTTOM_BAR_HEIGHT_PX = 70; // doit rester égal à `h-[70px]` dans BottomBarShell.jsx
