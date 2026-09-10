### Une classe Tailwind "dépendante" (`flex-col`/`items-*`/`justify-*`) ne fait RIEN sans sa classe "prérequise" (`flex`/`grid`) — invisible à la simple lecture

Actée le 22/08, après le VRAI bug derrière le "3e symptôme" ci-dessus
(centrage interne à `MiniPlayerBar.jsx`/`GuestModeBar.jsx`, voir la
section dédiée plus bas pour le récit complet) : 2 tentatives de
correctif basées sur un raisonnement théorique se sont révélées fausses
avant qu'une vraie mesure (Playwright) ne révèle la cause réelle —
`BottomBarShell.jsx` acceptait un `innerClassName` transmis par chaque
appelant, mais son propre template de base ne posait JAMAIS `flex` —
sans lui, `flex-col`/`items-center` transmis par un appelant n'ont
LITTÉRALEMENT AUCUN EFFET. Rien de "faux" en apparence dans le JSX
final : les classes sont bien là, juste incomplètes d'une façon qu'une
relecture de code ne révèle pas — seul un rendu réel (ou une
vérification automatisée du couplage entre classes) le révèle.

**Généralisable** : toute classe qui ne prend effet que sur un conteneur
`flex`/`grid` (`flex-col`, `flex-row`, `items-*`, `justify-*`,
`content-*`...) doit TOUJOURS être accompagnée de `flex`/`grid`/
`inline-flex`/`inline-grid` sur le MÊME élément — que ce soit dans une
chaîne de classes statique (là, une relecture attentive suffit à le
voir) OU, plus insidieux, quand une chaîne de classes est transmise à un
composant partagé via une prop de personnalisation (`innerClassName`,
`cardClassName`...) : dans ce cas, la classe prérequise peut manquer
soit côté appelant, soit côté composant receveur — le bug se cache dans
l'INTERACTION entre 2 fichiers, jamais visible en lisant l'un des deux
séparément. Garde-fou automatique ajouté
(`tests/flexDependentClassTrap.test.js`, même famille que
`tailwindConcatTrap.test.js`) : scanne toute prop `cardClassName=`
(celle qui reste réellement à risque, voir sa docstring pour pourquoi
`innerClassName` en est exclu) et vérifie qu'une classe dépendante n'y
apparaît jamais sans son prérequis.

### Une marge FIXE à côté d'un espaceur `flex-1` devient un poids mort invisible — jamais visible à la simple lecture du fichier

Actée le 01/09 (voir `historique/bloc-13.md`, alignement Sidebar/bloc du
bas — 3e retour direct de ce chantier, "léger scroll" du menu de
gauche) : une fois qu'un espaceur flexible (`<div className="flex-1">`,
sans hauteur imposée, dans un conteneur `flex flex-col`) prend le
contrôle de la position d'un groupe d'éléments (en absorbant tout
l'espace disponible AVANT eux), toute marge FIXE (`mt-*`, un simple
`margin`) qui se trouvait avant ce groupe et servait auparavant à le
positionner devient **immédiatement inerte visuellement** — elle ne
déplace plus rien, l'espaceur reprend toujours le dessus. MAIS,
contrairement à l'espaceur lui-même (qui dégrade proprement à 0px sous
contrainte d'espace), cette marge fixe continue à être intégralement
consommée dans le calcul de hauteur du conteneur — un poids mort qui ne
sert plus à rien, mais qui reste bien réel pour le calcul de
débordement, et peut donc provoquer un `overflow`/scroll sur une fenêtre
courte qui n'existerait pas sans ce gaspillage.

**Généralisable** : dès qu'un espaceur `flex-1` est ajouté à côté d'une
valeur de marge fixe préexistante (que ce soit pour corriger un
alignement, un centrage, ou tout autre repositionnement), se poser
explicitement la question "cette marge sert-elle encore à quelque chose
une fois l'espaceur en place ?" — la garder par réflexe/habitude sans se
poser la question, ou "au cas où", est exactement le genre d'oubli qui
resurgit plus tard sous forme de bug d'apparence totalement différente
(ici, un scroll, pas un problème d'alignement). Si la marge ne sert plus
qu'à un cas de repli dégradé (contenu qui déborde malgré l'espaceur), la
réduire au minimum viable pour ce cas précis plutôt que de garder sa
valeur d'origine, pensée pour un contexte qui n'existe plus.

### Icônes de trophées (TrophyShareCard.jsx/TrophiesView.jsx) — vérifier l'unicité ET l'escalade thématique
- Garde-fou permanent en place (`tests/config/appConfig.test.js`) : `id` et `icon` de `TROPHIES_DATA` doivent rester uniques — un `icon` dupliqué rendrait 2 trophées visuellement indissociables, sur le mur des trophées ET sur leurs visuels partageables respectifs (la seule vraie information visuelle de la carte avec le nom). Ce garde-fou détecte le doublon, mais ne choisit pas un BON emoji à la place — ça reste au jugement.
- Repéré après coup (01/09, en ajoutant 10 paliers d'un coup) : un emoji mal choisi pour un palier supérieur peut suggérer le contraire de la progression (`📉`, "baisse", posé par erreur pour "10 imports de données" — corrigé en `🛰️`, plus juste thématiquement et cohérent avec le thème Garmin/GPS des autres trophées liés aux données). Le garde-fou d'unicité n'aurait rien détecté ici (aucun doublon), seule une relecture volontaire l'a repéré.
- **Convention pour tout futur palier d'un trophée existant** : choisir une PROGRESSION VISUELLE cohérente entre les paliers d'une même métrique plutôt que des emoji juste "différents et non dupliqués" — le trio 🥉🥈🏆 (1/5/30 séances) est le modèle à suivre : chaque palier suggère clairement "plus" que le précédent. Exemple suivi pour la distance : 🛣️ (route, 100km) → 🗺️ (carte, 300km) → 🚀 (fusée, 1000km) — une escalade lisible d'un coup d'œil, pas 3 emoji choisis indépendamment.
