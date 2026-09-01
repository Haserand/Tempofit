## Convention UI — règles génériques accumulées au fil des retours directs

Actée le 14/08 (infobulles sur icônes seules, après 2 allers-retours sur
le même motif — retour direct avec capture d'écran : "pourquoi seul le
nombre de titres a une infobulle au survol, pas le reste ?"), élargie le
22/08 après une nouvelle série d'ajustements ponctuels dont plusieurs se
sont révélés être le MÊME motif structurel répété (voir points 7-8 et les
2 nouvelles sous-sections plus bas). Règles à appliquer par réflexe dans
tout nouveau code UI, pas seulement à retrouver après coup sur retour
direct :

1. **Toute icône seule (sans mot qui l'explique déjà à côté) porte un
   `title=`.** Un chiffre nu à côté d'une icône (`<List/> 5`, `<Gauge/> 150
   BPM`) est ambigu sans légende — contrairement à une icône suivie d'un
   mot déjà explicite (`<Activity/> Course à pied`), qui n'a
   techniquement pas BESOIN d'infobulle mais en gagne une quand même si
   ses voisines directes (même ligne/groupe visuel) en ont — voir la règle
   2.
2. **Cohérence au sein d'un même groupe visuel > cas par cas.** Le vrai
   signal d'un oubli n'est presque jamais "cette icône est ambiguë dans
   l'absolu", mais "SA VOISINE a une infobulle et pas elle" (ex. le pseudo
   d'une carte a un `title=` mais pas les 4 icônes de métadonnées juste en
   dessous, dans le MÊME composant). Réflexe à avoir en touchant une carte/
   ligne d'infos : vérifier CHAQUE élément du même groupe, pas seulement
   celui qu'on modifie.
3. **Cas à plus forte valeur : un libellé ABRÉGÉ affiché alors qu'un
   libellé COMPLET existe déjà dans les données** (ex. `zone.shortLabel`
   "Seuil" affiché, `zone.label` "Seuil / Tempo" disponible sur le même
   objet, `appConfig.js`/`ATHLETIC_ZONES`) — l'infobulle n'y est alors plus
   seulement cosmétique, elle restitue une info réellement absente à
   l'écran. Prioritaire sur le reste si on doit choisir où mettre l'effort.
4. **Exception assumée, pas un oubli** : les boutons de fermeture (icône
   `X`) des modales n'ont volontairement PAS de `title="Fermer"` — motif
   uniforme sur les 11 modales du projet (vérifié le 14/08), une croix de
   fermeture est un standard UI suffisamment universel. Ne pas "corriger"
   cette exception par réflexe de cohérence si elle est repérée à nouveau —
   elle est déjà cohérente, juste sans infobulle nulle part.
5. Fonction PARTAGÉE entre plusieurs vues (ex. `renderConfigInfoLine` dans
   `App.jsx`, utilisée par `PlaylistsView`/`RoutinesView`) : corriger UNE
   FOIS à la source suffit, pas la peine de dupliquer le correctif dans
   chaque appelant — mais bien vérifier qu'aucun autre appelant n'a SA
   PROPRE copie légèrement différente de la même logique (`PlaylistCard.jsx`
   avait le sien, à côté, pas dans `App.jsx`).
6. **Motif DISTINCT, à ne pas confondre avec les 5 règles ci-dessus (icônes)
   — texte TRONQUÉ (`truncate`/`line-clamp-*`) sans `title=`.** Trouvé le
   14/08 (retour direct sur `TemplateCard.jsx` : "il manque pas les
   infobulles sur les metadata de Découvrir ?") — ici, pas d'icône du tout,
   juste du texte coupé à l'ellipsis sans aucun moyen de voir le reste au
   survol. **Rattrapage complet fait le 14/08, même session** (sur
   confirmation explicite, "on le fait maintenant") : les 71 éléments
   `truncate`/`line-clamp-*` recensés dans `src/components/` ont chacun été
   vérifiés — la plupart corrigés (`title=` avec le texte complet, souvent
   reconstruit via template literal quand le texte affiché combine
   plusieurs champs), quelques-uns déjà bons sans qu'un premier passage au
   grep simple l'ait vu (title posé sur une ligne différente du
   `className`, ou une `<div>` englobante dont l'enfant direct porte déjà
   le `title=`), 2 exceptions assumées :
   - Le tooltip d'un graphique Recharts (`PlaylistCharts.jsx`,
     `data.trackName`) — poser un `title=` HTML natif à l'intérieur d'un
     contenu qui s'affiche DÉJÀ au survol du graphique n'apporte rien (il
     faudrait déjà survoler pour le voir).
   - Un bouton dont le `title=` décrit délibérément l'ACTION plutôt que de
     répéter le texte tronqué (`MiniPlayerBar.jsx`, "Aller à cette
     playlist") — plus utile qu'une simple répétition ici, laissé tel quel.
   Réflexe à avoir pour tout NOUVEAU `truncate`/`line-clamp-*` écrit à
   partir de maintenant : poser le `title=` correspondant du premier coup,
   plutôt que de laisser un nouveau trou se former.
7. **Généralisé (22/08) : ne se limite plus au texte tronqué ou aux icônes
   seules — une PHRASE COMPLÈTE affichée en clair peut, elle aussi, passer
   partiellement en infobulle** si elle fait déborder son conteneur sur 2
   lignes alors qu'une version courte suffit comme accroche (ex.
   `TrackList.jsx` : "Séance déjà réalisée — plus aucun titre ne peut être
   ajouté, dupliqué, remplacé ou retiré" → "Séance déjà réalisée" affiché,
   le reste en `title=`). Découpage à faire : garder visible la partie
   ACTIONNABLE ou la plus courte à comprendre d'un coup d'œil, déplacer en
   infobulle le POURQUOI/le détail. Retour direct qui a motivé cette
   généralisation : capture d'écran d'une bannière sur 2 lignes, "garder
   que [texte court] et le reste en infobulle ?".
8. **Le texte VISIBLE d'un élément doit porter la même logique
   conditionnelle que son propre `title=` — jamais moins.** Repéré le
   22/08 (`PlaylistHeaderActions.jsx`, bouton "Planifier") : le `title=`
   distinguait déjà correctement `isLocked ? "Refaire cette séance" :
   "Planifier cette séance"`, mais le `<span>` visible ne regardait QUE
   si une date était choisie, ignorant complètement `isLocked` — un
   tooltip plus riche que le libellé affiché est le signal qu'une
   distinction déjà pensée quelque part n'a pas été répercutée partout.
   Audit fait ce jour-là sur les 34 `title={...ternaire...}` du projet à
   la recherche du même écart : aucun autre cas trouvé — mais réflexe à
   garder pour tout NOUVEAU `title=` conditionnel écrit désormais, vérifier
   que le texte/état visible suit la MÊME condition, pas une condition plus
   pauvre.
9. **`text-white`/`hover:text-white` écrit EN DUR (hors `dark:text-white`,
   cantonné au thème sombre) n'est sans risque QUE sur un fond TOUJOURS
   coloré/opaque — jamais sur `bg-base`/`cardBg`/aucun fond (adaptatifs,
   clairs en thème clair). Motif récurrent, corrigé séparément au moins 4
   fois sans qu'un garde-fou ne survive entre deux (`RoutinesView.jsx`
   29/07, `GeneratorWizard.jsx`, puis `StatsView.jsx`/`ProfileView.jsx`/
   `PlaylistDetailView.jsx` le 01/09). `text-main`/`${textHighlight}`
   (useTheme.js) est l'équivalent adaptatif à utiliser à la place. Garde-fou
   permanent depuis le 01/09 : `tests/hoverWhiteTextTrap.test.js`.

### Pseudo/nom d'auteur cliquable vers un profil — `underline` PERMANENT

Vérifié le 14/08 (question directe, "faudrait pas centraliser ça aussi ?")
— **déjà cohérent partout où ce motif existe**, rien à corriger, mais
documenté pour ne pas dériver à l'avenir :
- Un pseudo/nom d'auteur qui ouvre le PROFIL de quelqu'un (`onViewProfile`,
  `onViewOfficialProfile`, ou "aller à Mes Séances" pour son propre pseudo)
  est toujours souligné en PERMANENCE (`underline`, jamais seulement
  `hover:underline`) — voir `PlaylistHeaderMeta.jsx`/`TemplateCard.jsx`,
  toujours accompagné d'un `title=` explicite ("Voir le profil de X").
- Ne PAS confondre avec un lien vers un autre type de contenu (ex. le nom
  d'une PLAYLIST dans `MiniPlayerBar.jsx`) — celui-là peut légitimement se
  contenter d'un `hover:underline` (souligné seulement au survol), le
  distinguo permanent/hover marque justement "ceci mène à un PROFIL
  d'utilisateur" par rapport au reste de l'app.
- Exception légitime, pas à "corriger" par réflexe : une LISTE de
  résultats où toute la ligne est cliquable (avatar + pseudo, fond qui
  change au survol — voir `SearchUsersModal.jsx`) suit un paradigme UI
  différent (ligne entière = affordance cliquable) ; le soulignement du
  texte seul n'y a pas sa place.

### Centrage flexbox d'une rangée ASYMÉTRIQUE (bouton principal + petit bouton icône seule)

Actée le 22/08, retour direct avec capture d'écran sur `GuestModeBar.jsx`
("pourquoi les 2 ne sont pas parfaitement centrés ?") — **piège CSS
structurel à connaître, pas spécifique à ce composant précis** :
`justify-center` centre le GROUPE entier de la rangée, pas le contenu
qu'on perçoit intuitivement comme "principal". Si ce groupe associe un
élément large (ex. bouton texte+icône, "Se connecter") et un élément
nettement plus étroit (ex. bouton icône seule, croix de fermeture), le
centre géométrique du groupe tombe mécaniquement DÉCALÉ vers le côté
large — l'œil perçoit alors le texte principal comme "pas centré", alors
que la rangée l'est bel et bien, au sens strict.
- **Correctif type** : ajouter un espaceur INVISIBLE (`invisible`, pas
  `hidden` — doit garder sa place dans la mise en page) de la même boîte
  exacte que le petit élément (mêmes classes de padding/taille, copiées
  plutôt que devinées en pixels), du côté opposé. Équilibre les 2 côtés
  sans dépendre d'une valeur magique à resynchroniser si l'élément change
  un jour. `aria-hidden="true"` sur cet espaceur — purement visuel, rien à
  annoncer aux lecteurs d'écran.
- **Pas un problème SI les 2 éléments flanquants sont déjà de taille
  identique** (ex. pagination `‹ Page X/Y ›` dans `PlaylistsView.jsx` —
  2 boutons flèche strictement identiques de chaque côté du texte) :
  `justify-center` centre alors correctement le texte par construction,
  aucun espaceur nécessaire. Vérifié le 22/08 sur les 16 rangées du
  projet combinant `justify-center` + 2 boutons ou plus dans le même
  conteneur : `GuestModeBar.jsx` était le seul cas réellement asymétrique
  trouvé — mais réflexe à avoir pour toute NOUVELLE rangée de ce type.

### Élément décoratif vs espace fonctionnel — la fonction prime

Retour direct du 22/08 sur `Sidebar.jsx` ("l'accessibilité de la
navigation du menu doit être privilégiée") — principe général derrière le
retrait de `creditRowHeight` (voir la section dédiée plus bas pour le
détail complet) : un ajustement purement COSMÉTIQUE (ex. aligner deux
bordures au pixel près entre 2 zones indépendantes de l'écran) ne doit
JAMAIS forcer un élément à grandir au détriment de l'espace réellement
disponible pour un contenu FONCTIONNEL (navigation, action, information
consultée activement) qui partage le même conteneur. En cas de conflit
entre les deux, la fonction gagne — quitte à accepter un léger défaut
visuel (ici, un désalignement de bordure) comme compromis assumé plutôt
que corrigé.

### Vérifier un alignement CSS par le raisonnement seul est risqué — mesurer dès que possible

Actée le 22/08, après le chantier `MiniPlayerBar.jsx`/`GuestModeBar.jsx`
(voir la section dédiée plus bas pour le détail complet) : un
raisonnement THÉORIQUE sur une question de centrage flexbox s'est révélé
FAUX deux fois de suite le même jour, avant qu'une vraie mesure (un
navigateur réel piloté par Playwright, trouvé utilisable via un binaire
déjà en cache dans le bac à sable malgré l'échec habituel du
téléchargement — voir CLAUDE-SANDBOX-VERIFICATION.md §5quinquies) ne
tranche pour de bon. Deux leçons distinctes retenues :
1. **Ne pas re-raisonner une 3e fois dans le vide après 2 échecs** —
   chercher activement un moyen de mesurer (ex. chercher un navigateur
   déjà en cache avec `find` avant de conclure à l'impossibilité) plutôt
   que de refaire le même calcul mental en espérant un résultat
   différent.
2. **Ne jamais reproduire un composant "à la main" pour le tester —
   toujours importer le vrai fichier.** Une 1re mesure basée sur une
   reproduction manuelle des 3 zones "principales" de `MiniPlayerBar.jsx`
   donnait 0px d'écart, faussement rassurant : elle avait tout simplement
   OMIS 2 éléments bien réels du fichier (bouton volume, bouton fermer)
   en les recopiant de mémoire. Une 2e mesure avec le VRAI composant
   importé directement a révélé l'écart réel (46px). Une reproduction
   manuelle ne teste que ce dont on se souvient d'un fichier, jamais ce
   qui y existe vraiment.

### Une "recette" de mise en page recopiée dans plusieurs fichiers dérive — extraire un composant partagé dès le 2e cas

Constat du 22/08 : `MiniPlayerBar.jsx` et `GuestModeBar.jsx` ont accumulé
3 bugs de désalignement DISTINCTS la même session (hauteur forcée sur la
Sidebar, centrage `GuestModeBar` vs `MiniPlayerBar`, centrage interne à
`MiniPlayerBar` lui-même) — pas 3 problèmes indépendants avec 3 causes
différentes, mais 3 symptômes de LA MÊME fragilité : les deux fichiers
recopiaient indépendamment la même "recette" de conteneur
(`h-[70px]` + `max-w-5xl mx-auto` + padding), avec de petites divergences
de détail à chaque copie (`px-4` vs `px-6`, `justify-center` présent ou
non sur le conteneur externe). Une convention maintenue par la mémoire
humaine ("se souvenir de recopier le même motif partout") dérive
inévitablement avec le temps, contrairement à une convention imposée par
la STRUCTURE du code. Extrait en composant partagé
(`BottomBarShell.jsx`, voir la section dédiée plus bas) dès ce 2e cas —
pas besoin d'attendre un 3e ou 4e fichier pour que la duplication devienne
un vrai risque : 2 fichiers qui doivent visuellement s'aligner et
partagent déjà une recette identique suffisent.

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
