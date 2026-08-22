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
 * classes Tailwind (`h-[70px]`/`h-[72px]`, MiniPlayerBar.jsx/
 * GuestModeBar.jsx) restent, elles, bien réelles et toujours à synchroniser
 * entre elles si l'une change — seul le consommateur JS de ces valeurs a
 * disparu, pas le risque de désynchronisation entre les 2 classes
 * elles-mêmes.
 *
 * ⚠️ MINI_PLAYER_BAR_HEIGHT_PX 90 → 70 (22/08, MÊME JOUR, retour direct
 * suivant — "diminuer la hauteur de l'audio player pour que la taille
 * soit identique à celle de la zone Réglages") : 70px calculé pour
 * correspondre à la hauteur NATURELLE du pied de page de Sidebar.jsx
 * (Réglages+Trophées + ligne de crédit), désormais que celle-ci n'est
 * plus forcée par `creditRowHeight` (voir juste au-dessus) — voir
 * MiniPlayerBar.jsx pour le détail du calcul (aucun navigateur disponible
 * en sandbox pour mesurer réellement, échelle Tailwind par défaut
 * utilisée à la place).
 *
 * ⚠️ GUEST_MODE_BAR_HEIGHT_PX 72 → 70 (22/08, MÊME JOUR, retour direct
 * suivant — "je te demandais de réduire la barre du bas initialement") :
 * MiniPlayerBar.jsx avait déjà été réduite à 70px (voir juste au-dessus),
 * mais GuestModeBar.jsx était resté à l'ancienne valeur 72px — l'ancien
 * target commun QUAND Sidebar.jsx forçait ENCORE sa hauteur sur les 2
 * barres. Résidu de quelques px de désalignement encore visible entre les
 * 2 pieds de page (retour direct avec capture d'écran) tant que cette 2e
 * barre n'avait pas suivi. Voir GuestModeBar.jsx pour le détail.
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
 * MiniPlayerBar.jsx/GuestModeBar.jsx gardent `h-[70px]` écrits en dur dans
 * leur JSX (Tailwind doit les voir tels quels, les 2 valent maintenant la
 * même chose) — ces 2 classes et les constantes ci-dessous doivent donc
 * rester manuellement synchronisées EN VALEUR (70 ↔ h-[70px] pour les 2
 * barres — MiniPlayerBar 90→70 puis GuestModeBar 72→70, MÊME JOUR 22/08,
 * voir plus haut) — ce fichier ne peut pas éliminer complètement la
 * duplication à cause de cette contrainte Tailwind, mais documente
 * explicitement le lien à respecter si l'une des deux valeurs change un
 * jour (voir bottomBarLayout.test.js, qui vérifie ce lien pour de vrai).
 */
export const MINI_PLAYER_BAR_HEIGHT_PX = 70; // doit rester égal à `h-[70px]` dans MiniPlayerBar.jsx (90→70, 22/08, voir docstring)
export const GUEST_MODE_BAR_HEIGHT_PX = 70;  // doit rester égal à `h-[70px]` dans GuestModeBar.jsx (72→70, 22/08, voir docstring — même valeur que MiniPlayerBar désormais)
