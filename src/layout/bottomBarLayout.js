/**
 * bottomBarLayout.js — les hauteurs EXACTES des barres inférieures
 * (MiniPlayerBar.jsx, GuestModeBar.jsx), en une seule source de vérité.
 *
 * Avant ce fichier, ces deux nombres vivaient dupliqués à 3 endroits :
 * `h-[90px]`/`h-[40px]` codés en dur dans MiniPlayerBar.jsx/GuestModeBar.jsx,
 * ET recopiés une 3e fois dans `creditRowHeight` (Sidebar.jsx) pour aligner
 * la case crédit sur ces mêmes hauteurs — sans qu'aucun lien ne les
 * rattache entre eux (retour direct : "rien ne les relie automatiquement
 * pour l'instant"). Modifier une hauteur sans se souvenir de reporter le
 * même changement aux 2 autres endroits aurait cassé l'alignement de la
 * grille en silence, sans erreur ni avertissement.
 *
 * ⚠️ `creditRowHeight` RETIRÉ DE Sidebar.jsx (22/08, retour direct —
 * "l'accessibilité de la navigation du menu doit être privilégiée") : ce
 * 3e usage n'existe plus, Sidebar.jsx n'importe donc plus ce module du
 * tout désormais — voir sa docstring pour le détail complet du compromis
 * choisi (hauteur naturelle du pied de page plutôt que forcée, quitte à
 * légèrement désaligner sa bordure). Fichier conservé tel quel : les 2
 * classes Tailwind (`h-[90px]`/`h-[72px]`, MiniPlayerBar.jsx/
 * GuestModeBar.jsx) restent, elles, bien réelles et toujours à synchroniser
 * entre elles si l'une change — seul le consommateur JS de ces valeurs a
 * disparu, pas le risque de désynchronisation entre les 2 classes
 * elles-mêmes.
 *
 * Ce module ne fait qu'exporter les nombres — pas de JSX, pas de dépendance
 * React, importable par les composants pour leur propre `h-[...px]` (voir
 * la note plus bas sur le piège Tailwind).
 *
 * ⚠️ PIÈGE TAILWIND CONNU sur ce projet (voir passation du 26/07,
 * `GuestModeBar.jsx` à l'époque, classe `hover:${cardBg}` jamais générée) :
 * une classe Tailwind DOIT apparaître en toutes lettres dans le code source
 * pour que le scanner JIT la génère — une classe reconstruite par
 * interpolation (`` `h-[${GUEST_BAR_HEIGHT_PX}px]` ``) NE FONCTIONNERAIT
 * PAS, même en important la constante depuis ici. C'est pour ça que
 * MiniPlayerBar.jsx/GuestModeBar.jsx gardent `h-[90px]`/`h-[64px]` écrits en
 * dur dans leur JSX (Tailwind doit les voir tels quels) — ces 2 classes et
 * les constantes ci-dessous doivent donc rester manuellement synchronisées
 * EN VALEUR (90 ↔ h-[90px], 72 ↔ h-[72px] — bumpé de 64 à 72px le 29/07,
 * "aération footer/GuestBar", avant ça 40→64px le 28/07, voir passations de
 * ces dates) — ce fichier ne peut pas éliminer complètement la duplication
 * à cause de cette contrainte Tailwind, mais documente explicitement le
 * lien à respecter si l'une des deux valeurs change un jour (voir
 * bottomBarLayout.test.js, qui vérifie ce lien pour de vrai).
 */
export const MINI_PLAYER_BAR_HEIGHT_PX = 90; // doit rester égal à `h-[90px]` dans MiniPlayerBar.jsx
export const GUEST_MODE_BAR_HEIGHT_PX = 72;  // doit rester égal à `h-[72px]` dans GuestModeBar.jsx (64→72, +8px, Refactor UI "aération footer/GuestBar", 29/07)
