# TempoFit — Historique détaillé des chantiers (02/08 → 05/08)

⚠️ Ce fichier est un **complément d'archive** au README.md, pas un
document autonome. Il contient le récit chronologique COMPLET des
chantiers antérieurs au 07/08, extrait tel quel de la section "État
d'avancement" du README (aucun contenu réécrit ni résumé — copie exacte)
au moment de l'élagage du 08/08, quand cette section a dépassé 1100
lignes et rendait la lecture d'entrée de session trop lente.

**Pourquoi ce découpage plutôt que de tout garder dans le README** :
le README documente l'état ACTUEL du projet, pas son histoire complète —
voir sa propre règle en tête ("rester court et pointer vers le code").
Le récit détaillé (qui a demandé quoi, pourquoi telle option a été
retenue plutôt qu'une autre, quels incidents de build ont eu lieu et
comment ils ont été diagnostiqués) garde une vraie valeur — c'est
souvent la SEULE trace du "pourquoi" derrière une décision qu'on
retrouve dans le code des mois plus tard — mais n'a plus besoin d'être
relu à CHAQUE début de session, seulement quand une question précise
s'y prête (voir l'index dans le README, section "Historique").

**Ce fichier n'est PAS mis à jour en continu** — contrairement au
README, il n'y a rien à "tenir à jour" ici : c'est une photographie
figée d'une période close (02/08 → 05/08). Le prochain élagage (si la
section "État d'avancement" du README regrossit trop) ajoutera un bloc
suivant à LA SUITE de celui-ci, jamais en réécrivant ce qui y est déjà.

---

⚠️ **SESSION DU 05/08 — check-up demandé en début de conversation (lecture
PASSATION.md → README.md → CLAUDE-SANDBOX-VERIFICATION.md → code réel),
2 bugs réels trouvés et corrigés, 1 optimisation perf :**

- **Le fix `min-w-0` (04/08, `PlaylistHeader.jsx`/`RoutinesView.jsx`),
  resté "jamais vérifié en conditions réelles"** — relu en détail : la
  structure flex est correcte des deux côtés (`flex-1 min-w-0` sur le `<p>`,
  conteneur parent qui laisse la place). Sain par lecture de code, mais
  reste à confirmer par un vrai clic en prod comme toujours pour du CSS.
- **BUG CORRIGÉ — `tests/modals/EditRoutineModal.test.jsx` ne s'exécutait
  JAMAIS.** Le fichier vivait dans `src/components/modals/` au lieu de
  `tests/modals/` (viole la convention "tests/ miroir de src/") — invisible
  du build Vercel réel (`vite.config.js`, `test.include:
  ['tests/**/*.test.{js,jsx}']` ne scanne jamais `src/`), ET son import
  relatif (écrit pour l'emplacement `tests/modals/`) était cassé depuis
  l'ancien emplacement. Toute la couverture du chantier "cible à 0" du
  04/08 tournait donc dans le vide depuis sa création. Déplacé au bon
  endroit. Aucun des 3 garde-fous existants (`noDuplicateFiles.test.js`,
  `testFileIdentityTrap.test.js`, `fileExtensionTrap.test.js`) ne
  détecte ce cas précis (ils ne scannent que `tests/`) — angle mort
  accepté pour l'instant, pas traité cette session (aurait été un chantier
  à part, hors scope d'un check-up).
- **BUG CORRIGÉ — `EditRoutineModal.jsx` avait le MÊME trou de validation
  "cible à 0" que celui fermé le 04/08, sur un point d'entrée oublié.**
  Cette modale appelle `executeGeneration` directement
  (`applyRoutineEditOnce`/`applyRoutineEditPermanently`,
  `useRoutineActions.js`) — un point d'entrée de la même famille que le
  bouton "Générer" de `RoutinesView.jsx` (déjà audité le 04/08), mais elle
  ne validait que `distanceVal`/`hours`/`minutes`, jamais `segments`. Pour
  le mode Fractionné pur (`isIntervalMode && !isCrescendoMode`), c'est
  pourtant `segments[]` qui pilote réellement la durée générée (voir
  `usePlaylistGeneration.js`, `executeGeneration` — la branche
  `config.isIntervalMode` ignore `distanceVal`/`hours`/`minutes`). Une
  routine Fractionné aux portions cassées (créée avant le correctif du
  04/08) pouvait donc être éditée/régénérée depuis cette modale sans le
  moindre blocage. Corrigé : `isTargetInvalid` bascule sur
  `areSegmentsValid()` en Fractionné pur (le Crescendo n'est pas concerné,
  ses segments sont recalculés en direct depuis la cible globale — voir
  l'effet dédié dans `App.jsx`) ; le champ distance/durée global, sans
  effet dans ce mode, est désormais masqué (même condition que
  `step3ShowsTargetInputs`, `GeneratorWizard.jsx`) ; message d'erreur
  aligné sur la formulation de `RoutinesView.jsx`. Tests de régression
  ajoutés dans le fichier déplacé ci-dessus. Audit complémentaire fait sur
  les 4 points d'entrée réels de `executeGeneration` (`RoutinesView.jsx`,
  `GeneratorWizard.jsx`, `useRoutineActions.js` ×2) — le bouton final du
  wizard est protégé transitivement par le verrouillage du "Suivant" à
  l'étape 3 (aucune navigation ne permet d'atteindre l'étape 4 avec une
  cible/des segments invalides), pas de 5e trou trouvé.
- **Optimisation perf — `RoutinesView.jsx`, tri des routines.** Les 2 tris
  (`sortedRoutines`/rang par générations) tournaient sur CHAQUE rendu du
  composant, y compris un rendu déclenché par une frappe dans le brouillon
  de description (state local à ce même composant, sans rapport avec
  `routines`) — enveloppés dans `useMemo([routines])`. `routineRanks
  .indexOf(routine.id)` (O(n) par carte dans la boucle `.map()`, donc O(n²)
  sur toute la grille) remplacé par une `Map` id→rang (O(1) par carte).
  Sans impact perceptible au nombre de routines réaliste pour un compte,
  mais correct par principe et cohérent avec les 3 optimisations perf déjà
  faites le 03/08 (voir plus bas).

⚠️ **SESSION DU 05/08 (suite 12) — build Vercel cassé (1 test), corrigé.**
Mon propre test ajouté au tour précédent (`ProfileView.test.jsx`, "un
template jamais cloné... affiche bien 0") utilisait `getByTitle(...)` —
un seul élément attendu. Une fois le badge de clonages passé en "toujours
affiché, même à 0" (même chantier), la grille de la vitrine (35+ cartes)
en affiche désormais AUTANT avec ce même `title`, donc `getByTitle`
échouait ("Found multiple elements"). Corrigé : recherche depuis le titre
de la carte concernée puis `.closest('.shadow-xs')` (classe unique à
`PublicItemCard`, vérifiée) pour cibler précisément SA carte, plutôt
qu'une recherche globale sur toute la page. `within` importé (manquant).
Reste de la suite déjà vert à ce moment-là (1038/1039) — un seul test à
corriger.

⚠️ **SESSION DU 05/08 (suite 11) — retour direct : "je ne vois pas le
nombre de clones dans une playlist... il me semble que c'est la demande de
base".** Le compteur de clonages existait déjà (vraie table
`template_clone_counts`, chantier des sessions précédentes) mais
s'arrêtait aux CARTES de listing (`TemplateCard.jsx`/`ProfileView.jsx`) —
jamais transmis à la page détail (`PlaylistHeader.jsx`), qui n'avait donc
littéralement aucun moyen de l'afficher. Corrigé, 2 décisions actées
avant implémentation :
- **Toujours afficher, même à 0** (confirmé) — incohérence repérée entre
  les 2 endroits existants (`TemplateCard.jsx` montrait 0, `ProfileView.jsx`
  le cachait) et harmonisée dans ce sens.
- **Près du titre, pas dans la ligne d'infos** (confirmé) — même logique
  déjà appliquée au badge BPM (sorti à part) : la ligne d'infos décrit la
  COMPOSITION de la séance, le compteur de clonages décrit son ACCUEIL
  social, catégories différentes.
Câblage : `TemplateCard.jsx` transmet désormais `cloneCount` (déjà reçu en
prop) à `onPlayTemplate` ; `App.jsx` (`handleOpenPublicPlaylist`) lit
`row.clone_count` (vraie colonne déjà là pour une playlist étrangère réelle
ET pour un template de la vitrine, `templateToVitrineRow`,
officialVitrineProfile.js) et le reporte sur `currentPlaylist.cloneCount`.
Badge gaté sur `isReadOnly` (seul contexte où l'info a un sens — jamais
câblé pour une playlist déjà sauvegardée ou une génération fraîche, hors
périmètre de ce retour direct). 7 tests mis à jour/ajoutés au total
(`TemplateCard.test.jsx` ×3, `DiscoverView.test.jsx` ×1,
`ProfileView.test.jsx` ×2, `PlaylistHeader.test.jsx` ×3 nouveaux).

⚠️ **SESSION DU 05/08 (suite 10) — retour direct, capture montrant l'espace
vide sous la pochette : "je suis en mode invité, par défaut mets 'Guest
Mode' plutôt que rien".** BUG CORRIGÉ dans `ownerLabel`
(`PlaylistHeader.jsx`) — en mode invité, `username` vaut `null`
(`AuthContext.jsx`, aucun compte), donc l'étiquette "propriétaire actuel"
retombait aussi sur `null` dans la branche `isSaved` : silencieusement
invisible plutôt que d'expliquer l'état. Repli sur **"Invité"** (pas
l'anglais "Guest Mode" proposé dans le retour direct) — réutilise le mot
déjà en place ailleurs pour ce même état (Sidebar.jsx, "Mon Espace •
Invité"), cohérence avec le vocabulaire existant plutôt qu'un 2e terme
pour la même notion. 1 test de régression ajouté.

⚠️ **SESSION DU 05/08 (suite 9) — retour direct : "règles à harmoniser dans
un fichier ?" (suite au correctif "TempoFit Officiel" en dur du tour
précédent).** Nouvelle constante **`OFFICIAL_VITRINE_DISPLAY_NAME`**
('TempoFit Officiel', avec majuscules) centralisée dans
`curatedSessions.js` — remplace 36 copies en dur du même littéral (35
`author: 'TempoFit Officiel'` dans ce fichier + la copie fraîchement
ajoutée dans `PlaylistHeader.jsx`). Posée DANS `curatedSessions.js`
précisément (pas dans `officialVitrineProfile.js`, l'endroit a priori plus
"logique" pour une donnée de branding) : ce fichier n'importe rien du
tout, alors qu'`officialVitrineProfile.js` importe déjà `curatedSessions`/
`naughtyCuratedSessions` DEPUIS `curatedSessions.js` — l'inverse aurait
créé un import circulaire. DISTINCTE de `OFFICIAL_VITRINE_USERNAME`
(officialVitrineProfile.js, `'tempofit_officiel'`, tout en minuscules) —
celle-là reste le pseudo TECHNIQUE (URL/mentions @, contraint par
`USERNAME_REGEX`), celle-ci le nom d'AFFICHAGE, jamais utilisé pour une
URL ou une comparaison. Commentaire de `TemplateCard.jsx` qui citait
encore l'ancien littéral mis à jour au passage. Aucun test cassé — la
VALEUR résolue reste identique, seule sa source a changé (tests qui lisent
`template.author` dynamiquement à l'exécution, jamais un littéral figé
côté test).

⚠️ **SESSION DU 05/08 (suite 8) — retour direct, capture annotée : le
chevauchement avec la pochette redouté au tour précédent (noté "à vérifier
en conditions réelles") s'est bien produit. 3 corrections sur l'étiquette
"propriétaire actuel" (`PlaylistHeader.jsx`) :**
- **Repositionnée SOUS la pochette** (plus au-dessus en position absolue)
  — élimine le risque de chevauchement par construction (suit le flux
  normal du DOM, n'ignore plus l'espace déjà occupé par l'image), plutôt
  que de deviner un décalage qui aurait pu re-casser sur une autre largeur
  d'écran.
- **Centrée** (`text-center`, largeur calée sur celle de la pochette).
- **Arobase retirée** ("on perd un caractère") — juste le nom nu
  désormais, le `title` HTML natif au survol reste plus explicite si
  besoin.
- **"TempoFit Officiel" (majuscules)** au lieu du pseudo technique
  `tempofit_officiel` (tout en minuscules, `OFFICIAL_VITRINE_USERNAME`) —
  chaîne en dur, mêmes majuscules que `author: 'TempoFit Officiel'` déjà
  utilisé partout ailleurs (curatedSessions.js/TemplateCard.jsx). Un vrai
  pseudo utilisateur (`username`/`ownerUsername`), lui, reste inchangé :
  toujours en minuscules par construction (`USERNAME_REGEX`,
  `/^[a-z0-9_]{3,20}$/`), rien à "corriger" de ce côté.
4 tests de `PlaylistHeader.test.jsx` mis à jour en conséquence (textes
attendus sans arobase, "TempoFit Officiel" avec majuscules) + le test
"aucune étiquette" reformulé (son ancienne assertion `/^@/` ne pouvait
plus matcher quoi que ce soit après le retrait de l'arobase — passait
toujours "vrai" par construction, plus un vrai test).

⚠️ **SESSION DU 05/08 (suite 7) — retour direct, capture annotée : "ajouter
le nom du compte créateur/dans lequel on voit la playlist où on est, pour
mieux se repérer" — clarifié ensuite : le CRÉATEUR d'origine quand la
playlist est encore en aperçu (vitrine `@tempofit_officiel` ou playlist
d'un autre utilisateur), TON PROPRE pseudo une fois qu'elle est dans "Mes
Séances".** Nouvelle étiquette `@pseudo` dans `PlaylistHeader.jsx`, même
hauteur que le bloc d'actions en coin (`top-4`, comme demandé), côté
gauche.
- **Câblage `username`** (le pseudo du visiteur connecté, déjà dans
  `AuthContext.jsx`/App.jsx) — ajouté au `value` de
  `PlaylistDetailContext.jsx` (Provider), plutôt que prop-drillé sur 3
  couches supplémentaires (`PlaylistDetailView.jsx`/`PlaylistDetailViewInner`)
  : `PlaylistHeader.jsx` le lit directement via `usePlaylistDetail()`,
  déjà consommé partout ailleurs dans ce fichier.
- **Câblage `ownerUsername`** (le pseudo du PROPRIÉTAIRE, pour une vraie
  playlist étrangère) — `ProfileView.jsx` est le SEUL endroit qui connaît
  le pseudo du profil consulté ; `handleOpenPublicPlaylist` (App.jsx) n'a
  lui que `row.user_id`, un UUID sans valeur d'affichage. Posé sur la ligne
  (`_ownerUsername`, préfixé `_` comme `kind` juste à côté — un champ ajouté
  par ce composant, pas un vrai champ des tables `playlists`/`routines`)
  au clic sur une carte publique, lu par `handleOpenPublicPlaylist` et
  reporté sur `currentPlaylist.ownerUsername`.
- **Templates du catalogue** (vitrine OU Découvrir direct — les deux
  passent par `sourceTemplateId`, `openCuratedPlaylist`,
  useNavigation.js) : toujours `OFFICIAL_VITRINE_USERNAME`
  ('tempofit_officiel'), pas besoin de câblage supplémentaire.
⚠️ **À vérifier en conditions réelles sur mobile** (noté explicitement en
commentaire dans le code) : la pochette est centrée horizontalement en
`flex-col` (mobile) — risque de chevauchement avec cette nouvelle étiquette
en position absolue, pas vérifiable depuis ce bac à sable (pas de vrai
navigateur).
2 tests exacts de `ProfileView.test.jsx` mis à jour (le payload transmis à
`onOpenPlaylist`/`onOpenRoutine` porte désormais `_ownerUsername` en plus),
4 nouveaux tests dans `PlaylistHeader.test.jsx` pour les 4 branches
d'`ownerLabel`.

⚠️ **SESSION DU 05/08 (suite 6) — retour direct : "je vais dans Découvrir,
j'ajoute une playlist, j'y retourne, je l'ajoute une 2e fois → je me
retrouve avec 2 copies identiques... pas logique".** BUG CORRIGÉ dans
`usePlaylistLibrary.js` — `handleSavePlaylist`/`handleClonePlaylist`
créaient toujours une NOUVELLE entrée dans `savedPlaylists`, sans jamais
vérifier si une copie de la MÊME source existait déjà. Concerne 3 chemins
distincts, tous corrigés :
- Template ouvert **directement depuis Découvrir** (`handleSavePlaylist`)
  — obtient un id FRAIS à chaque ouverture (`pl-curated-{id}-${Date.now()}`,
  useNavigation.js), donc le garde existant (comparaison par `id`) ne
  matchait jamais 2 ouvertures du même template. Nouveau garde par
  `sourceTemplateId` (stable, lui).
- Template ouvert via la **vitrine `@tempofit_officiel`**
  (`handleClonePlaylist`, `isReadOnly: true` forcé) — même correctif, même
  clé (`sourceTemplateId`).
- **Vraie playlist d'un autre utilisateur** (`handleClonePlaylist`) —
  nouveau garde par `parentId`+`parentUserId` (la lignée déjà posée par un
  clonage précédent, jusque-là utilisée uniquement pour créditer les
  compteurs, jamais pour détecter un doublon).
Dans les 3 cas, un doublon détecté bascule directement sur la copie
existante (`setCurrentPlaylist`) + toast "Déjà dans Mes Séances — retour
sur ta copie.", sans créer de nouvelle entrée ni appeler la RPC de
comptage de clonages. Option retenue après discussion (redirection
silencieuse, pas une modale de confirmation) — une playlist fraîchement
générée par le wizard n'est PAS concernée (`sourceTemplateId` absent,
aucune raison d'empêcher 2 générations distinctes même si leur contenu
se ressemble). 6 tests de régression ajoutés dans
`usePlaylistLibrary.test.js` (3 par fonction), y compris un test de
non-régression vérifiant que 2 templates DIFFÉRENTS ne se confondent
jamais.

⚠️ **SESSION DU 05/08 (suite 5) — incident réel de build, long diagnostic
(voir les échanges autour des logs Vercel collés dans cette session pour le
détail complet) : `src/contexts/PlaylistDetailContext.jsx` — le VRAI
fichier du composant — avait été accidentellement écrasé par le CONTENU de
son fichier de test (`tests/contexts/PlaylistDetailContext.test.jsx`),
collé au mauvais endroit vu que les deux portent presque le même nom.
`PlaylistDetailProvider`/`usePlaylistDetail` valaient donc `undefined` à
l'import — d'où "Element type is invalid... got: undefined" sur les 25
tests de ce fichier, une erreur React générique qui ne pointait jamais
vers la vraie cause. Trouvé via une recherche de code GitHub (le dépôt
étant privé, invisible depuis ce bac à sable) — PAS via les garde-fous
existants, qui vérifient tous l'EMPLACEMENT/le NOM d'un fichier, jamais si
son CONTENU correspond à ce que son nom promet.**
Nouveau garde-fou **`tests/criticalExportsTrap.test.js`**, sur demande
explicite après cet incident : (1) aucun fichier de `src/` ne doit
importer `vitest`/`@testing-library/*` — un composant réel n'en a jamais
besoin, la présence de cet import est un signal quasi certain qu'un
fichier de TEST a été collé au mauvais endroit ; (2) les 3 vrais Context
Providers de l'app (`GeneratorContext`/`AudioPlayerContext`/
`PlaylistDetailContext`) sont importés pour de vrai et leurs exports
attendus vérifiés comme étant bien des fonctions — 2e filet pour le cas où
le contenu substitué ne serait pas un fichier de test (donc sans import
`vitest`) mais un contenu tout aussi invalide pour ce rôle précis. Les 2
vérifications testées "à blanc" (simulation de l'incident exact + état
propre) avant livraison. Ajouté à la liste blanche `NO_SINGLE_SUBJECT` de
`testFileIdentityTrap.test.js`, même famille que les autres garde-fous
globaux.

⚠️ **SESSION DU 05/08 (suite 4) — retour direct, capture annotée : 1er
paragraphe de l'infobulle "BPM cibles par zone" (`AthleticProfilePanel.jsx`,
onglet Profil Athlétique) retiré ("Zone 2 = le BPM que tu tapes ci-dessous.
Les 3 autres s'en écartent par palier fixe de 15 BPM..."). Import
`getZoneSpacingForActivity` retiré de la déstructuration
`useGeneratorContext()` du même fichier (n'était utilisé que dans ce
paragraphe) — reste utilisé normalement ailleurs dans le projet
(`useAthleticProfile.js`, `App.jsx`), fonction non touchée.**
⚠️ **BUILD VERCEL CASSÉ PUIS CORRIGÉ** (logs collés par l'utilisateur) :
`tests/views/AthleticProfilePanel.test.jsx` avait un test qui ciblait
littéralement ce paragraphe (`getByText(/le BPM que tu tapes ci-dessous/)`)
— le `grep` de pré-modification n'avait cherché que des portions de
phrase plus longues/distinctives (`Zone 2 = le BPM`, `palier fixe de 15
BPM`...), pas CETTE portion précise, donc rien remonté. Reformulation du
piège pour la suite : `grep` avant de modifier un texte visible doit
couvrir plusieurs sous-chaînes DISTINCTES du texte visé, pas une seule —
un test peut cibler n'importe quel fragment, pas forcément celui qu'on a
choisi de vérifier. Test retargeté sur un fragment toujours présent
("niveau d'effort", 2e paragraphe, inchangé) plutôt que réintroduire du
texte supprimé exprès. Mock `getZoneSpacingForActivity` (devenu inutile
dans ce fichier de test) retiré au passage.

⚠️ **SESSION DU 05/08 (suite 3) — retour direct, capture d'écran : clic sur
"Réglages" en vue invité → en-tête "Mon Compte", aucun onglet actif,
contenu totalement vide.** BUG CORRIGÉ dans `Sidebar.jsx` :
`onClick={onOpenSettings}` transmettait le bouton directement à `onClick`
SANS l'envelopper — React appelle alors le handler avec le SyntheticEvent
du clic comme 1er argument. `handleOpenSettings = (tab = null) => ...`
(App.jsx) recevait donc cet event comme `tab` (un objet, toujours
"truthy" — un paramètre par défaut ne s'applique QUE si l'appelant ne
passe rien du tout, pas juste une valeur fausse), jamais `null`.
`SettingsView.jsx` initialisait alors `activeTab` à cet event, qui ne
correspondait à AUCUNE des 3 valeurs attendues (`'profile'`/`'music'`/
`'account'`) — d'où l'en-tête replié sur son "else" ("Mon Compte"), aucun
onglet visuellement actif, et un contenu vide (aucune branche ne
matchait). Le comportement par défaut VOULU (Profil Athlétique en premier,
hors Mode Intime — voir `SettingsView.jsx`, `useState(() => initialTab ||
(isNaughtyMode ? 'music' : 'profile'))`) était déjà correct dans le code ;
seul ce câblage cassait la chaîne. Corrigé (`() => onOpenSettings()`),
même pattern que partout ailleurs dans le projet pour ce type de callback
— audit fait sur les autres callbacks à paramètre optionnel du projet,
c'était le seul endroit concerné. Test existant (`Sidebar.test.jsx`)
renforcé : il ne vérifiait que le NOMBRE d'appels, jamais les arguments —
exactement pourquoi ce bug était passé inaperçu ; nouveau test dédié qui
vérifie `onOpenSettings` appelé sans aucun argument.

⚠️ **SESSION DU 05/08 (suite 2) — retour direct : "y aurait pas besoin d'un
test pour vérifier que les fichiers sont rangés au bon endroit au
déploiement de Vercel ?" (en référence à l'incident `EditRoutineModal.test.jsx`
plus haut).** Nouveau garde-fou **`tests/testLocationTrap.test.js`** :
scanne tout le dépôt (hors `node_modules`/`dist`) à la recherche de tout
fichier `*.test.js(x)` posé HORS de `tests/` — exactement le cas qui avait
laissé la couverture du chantier "cible à 0" tourner dans le vide sans
qu'aucun signal ne le révèle. Comble un angle mort explicitement identifié
plus haut : aucun des 3 garde-fous existants à ce moment-là
(`noDuplicateFiles.test.js`, `testFileIdentityTrap.test.js`,
`fileExtensionTrap.test.js`) ne scanne en dehors de `tests/`, donc aucun ne
pouvait détecter ce cas précis. Ajouté à la liste blanche
`NO_SINGLE_SUBJECT` de `testFileIdentityTrap.test.js` (garde-fou global,
même famille que les 3 autres). Au passage : la ligne de la section Tests
qui comptait "3 fichiers restés à la racine" était déjà fausse avant cette
session (`testFileIdentityTrap.test.js` manquait au compte) — corrigée,
5 fichiers désormais listés avec ce nouveau.

⚠️ **SESSION DU 05/08 (suite) — retour direct : "je voulais UNE ligne max ;
pas 2" (clarification de la demande du 04/08, mal interprétée sur le
moment — voir le commentaire de MAX_DESCRIPTION_LENGTH, appConfig.js, qui
citait pourtant l'énoncé d'origine "sur plus de 2 lignes").**
`line-clamp-2` → `line-clamp-1` sur les 5 endroits qui affichent
`content.description`/la description par catégorie d'un template
(`PlaylistHeader.jsx`, `RoutinesView.jsx`, `ProfileView.jsx`,
`PublicRoutinePreviewModal.jsx`, `TemplateCard.jsx`) — même décision de
troncature sèche partout, sans "Voir plus" nulle part, juste 1 ligne au
lieu de 2. `MAX_DESCRIPTION_LENGTH` (150) volontairement INCHANGÉ : déjà
pensé comme une marge de sécurité généreuse au-dessus de ce qui tient
visuellement, ce raisonnement tient tout autant à 1 ligne qu'à 2. Tous les
commentaires qui documentaient l'ancien choix (2 lignes) mis à jour en
conséquence, y compris un commentaire de `ProfileView.jsx` qui affirmait à
tort que "le texte complet reste consultable ailleurs" (plus vrai
maintenant que PlaylistHeader.jsx/PublicRoutinePreviewModal.jsx sont
eux-mêmes clampés à 1 ligne).

⚠️ **SESSION DU 04/08 — vérification en conditions réelles du bloc 03/08 ci-
dessous (toutes confirmées bonnes, guest bar + badge Trophées), puis une
longue chaîne de correctifs en cascade. Voir `PASSATION.md` (généré en fin
de session, hors repo) pour le récit complet — résumé technique ici :**

- **`src/utils/targetValidation.js`** (nouveau) — centralise toute la
  validation "cible de séance" (distance ou durée, jamais 0/vide/négatif).
  `isTargetValueValid`/`isSegmentValid`/`areSegmentsValid` (blocage à
  l'action) + `snapDistanceOnBlur`/`snapSegmentBpmOnBlur`/
  `snapSegmentDurationOnBlur` (correction automatique au blur du champ,
  jamais pendant la frappe — casserait la saisie décimale). Câblé dans
  `GeneratorWizard.jsx` (étapes 2/3, y compris les segments du mode
  Fractionné), `EditRoutineModal.jsx`, `TargetModeInputs.jsx` (indices
  visuels) ET `RoutinesView.jsx` (bouton "Générer" d'une routine déjà
  sauvegardée — point d'entrée distinct des formulaires, trouvé en
  généralisant après coup). Seuil distance : `>= 0.1` (`MIN_VALID_DISTANCE`),
  pas juste `> 0` — cohérent avec `step="0.1"` déjà affiché sur les champs,
  qui portent aussi `min="0.1"` (bloque les flèches natives du spinner).
  ⚠️ Limite assumée : `EditRoutineModal.jsx` n'offre aucune édition des
  segments du mode Fractionné — une routine Fractionné cassée ne peut être
  réparée qu'en la recréant, pas de vraie UI de correction pour ce cas
  précis actuellement.
- **`src/layout/inlineLinkLayout.js`** (nouveau) — `INLINE_NAV_LINK_CLASS`
  (`'font-bold underline'`), convention centralisée pour les liens texte
  "ce lien t'emmène ailleurs dans l'app" (texte finissant par `→`, jamais
  d'icône) — 6 occurrences alignées (`StatsView.jsx` ×4, `FavoritesView.jsx`,
  `GeneratorWizard.jsx`).
- **Troncature des descriptions** — `line-clamp-2` généralisé aux 5 endroits
  qui affichent `content.description` (`ProfileView.jsx`/`TemplateCard.jsx`
  l'avaient déjà ; `PlaylistHeader.jsx`/`PublicRoutinePreviewModal.jsx`/
  `RoutinesView.jsx` corrigés). `MAX_DESCRIPTION_LENGTH` (`appConfig.js`)
  resserré **280 → 150** — décision produit explicite : troncature SÈCHE,
  sans "Voir plus" nulle part (pas de vrais utilisateurs actuellement).
  ⚠️ Piège CSS rencontré deux fois (`PlaylistHeader.jsx`/`RoutinesView.jsx`) :
  `line-clamp-2` seul ne suffit pas sur un `<p>` qui est item flex sans
  largeur propre (`min-width: auto` par défaut) — `flex-1 min-w-0`
  nécessaire en plus, même piège déjà documenté dans `ViewHeader.jsx`.
- **`GuestModeBar.jsx`** — état de fermeture (`isGuestBarDismissed`) remonté
  dans `AppContent` (était local au composant, invisible du spacer de
  `<main>` et de `Sidebar.jsx`) ; spacer dédié corrigé `h-10`→`h-[72px]`
  (désynchronisé depuis le passage de la barre à 72px le 29/07). Vérifié en
  conditions réelles, confirmé bon.
- **`GeneratorWizard.jsx`, étape 3** — hauteur `h-[300px]`/scroll interne
  désormais conditionnelle (Crescendo/Fractionné seulement, plus Constant
  qui n'en a jamais eu besoin).
- **`StatsView.jsx`, état vide** — hauteur calée sur la carte de l'étape 1
  du wizard ; écart `space-y-8`/`space-y-4` avec l'en-tête corrigé
  (conditionnel à l'état vide, la vue remplie garde `space-y-8`).
- **5 nouvelles habitudes de travail actées** dans
  `CLAUDE-SANDBOX-VERIFICATION.md` (section en tête) — cadrer l'utilité de
  chaque demande, format de livraison (jamais de zip), vérifier le test
  miroir de chaque fichier touché, `grep` avant de modifier un texte
  visible, généraliser/auditer spontanément à chaque bug trouvé.
- ⚠️ **Le fix `min-w-0` (dernier correctif de la session) n'a PAS été
  vérifié en conditions réelles** — priorité n°1 de la prochaine session.

⚠️ **SESSION DU 03/08 (2e moitié) — plusieurs petits chantiers UI/perf,
listés ici en bloc plutôt qu'un par un (chacun assez petit pour ne pas
mériter sa propre section) :**

- **Profil public : onglets Playlists/Routines**, remplace la grille
  combinée décrite plus bas (retour direct : "les routines sont noyées en
  bas d'une grille de playlists"). `ProfileView.jsx` — `activeProfileTab`
  ('playlist'/'routine' par défaut), recherche/filtres restent
  **partagés** entre les 2 onglets (même state, seul l'ensemble d'items
  filtré change). Le filtre "Type" de `useProfileSearchFilter.js`
  (`typeFilter`) est **retiré** — redondant avec les onglets. Toute
  référence à `typeFilter`/grille combinée plus bas dans ce README décrit
  l'ANCIENNE architecture (02/08), périmée depuis.
- **`src/layout/iconButtonLayout.js`** (nouveau) — `ICON_BUTTON_ROUNDING`
  ('rounded-full'), convention centralisée pour tout bouton **icône
  seule** (sans libellé) : Thème, connexion/avatar, Trophées, hamburger
  mobile, MiniPlayerBar (×4), les 9 boutons de fermeture de modale.
  Un bouton icône+libellé (Réglages, nav Sidebar) reste en `rounded-xl`,
  inchangé. Règle : tout nouveau bouton icône-seule doit importer et
  utiliser cette constante, jamais un rayon en dur.
- **Trophées déménagé** du header (à côté du logo) vers le pied de page de
  la Sidebar, juste à côté de "Réglages" (`mr-2` compense un écart de
  padding entre les deux conteneurs — voir Sidebar.jsx). Thème reste seul
  dans le header, position désormais FIXE peu importe l'état de connexion
  (avant : se décalait selon que Trophées était affiché ou non).
- **Badge de notification Trophées "vu/pas vu"** — `useUserStats.js`
  (`trophiesSeenCount`, persistant ; `unseenTrophyCount`, `markTrophiesSeen()`
  appelée au montage de `TrophiesView.jsx`). Un COMPTEUR, pas un booléen :
  un nouveau trophée débloqué après consultation refait apparaître le
  badge, avec seulement le delta (pas le total).
  ✅ **Vérifié en conditions réelles le 04/08** (retour direct : "je valide
  aussi que tout marche pour les trophées").
- **`SettingsView.jsx` — prop `initialTab`** (nouveau 2e point d'entrée) :
  le bloc pseudo/e-mail du dropdown avatar (App.jsx) est désormais
  cliquable → ouvre directement l'onglet "Mon Compte". `App.jsx` centralise
  ça dans `handleOpenSettings(tab = null)` — LA seule fonction qui
  navigue vers Réglages (Sidebar l'appelle aussi, sans argument =
  comportement par défaut inchangé), pour ne jamais hériter d'un onglet
  périmé d'une visite précédente.
- **`StatsView.jsx` — nouvelle carte "Vue publique de ton profil"** (2
  états : public → lien vers l'aperçu ; pas public → lien vers
  Réglages > Mon Compte via `handleOpenSettings('account')`). Masquée en
  Mode Intime (délibéré — pas le bon endroit pour inciter à l'exposition).
- **`GuestModeBar.jsx` — fermeture SESSION-ONLY** (pas persistée — voir sa
  docstring pour le raisonnement produit complet) : bouton X → confirmation
  inline dans la même barre → si confirmé, disparaît jusqu'au prochain
  rechargement de page.
  ⚠️ **04/08, retour direct — 2 bugs corrigés, jamais vérifiés en conditions
  réelles jusque-là** : (1) l'état "masqué" vivait en `useState` LOCAL au
  composant, invisible du spacer de `<main>` et de `Sidebar.jsx`
  (`guestBarVisible`) — fermer la barre ne libérait donc jamais l'espace
  réservé ailleurs. Remonté dans `AppContent` (`isGuestBarDismissed`),
  `GuestModeBar` ne fait plus que déclencher `onDismiss()`. (2) le spacer
  dédié à cette barre (`App.jsx`) était resté à `h-10` (40px) depuis
  l'ancien design 1-ligne du 28/07, jamais mis à jour quand la barre est
  passée à 72px le 29/07 — corrigé en `h-[72px]`. Exigence produit
  clarifiée à cette occasion : scroll acceptable/attendu tant que la barre
  est visible (elle prend de la place), zéro scroll résiduel une fois
  masquée.
  ✅ **Vérifié en conditions réelles le 04/08, sur l'app déployée** (retour
  direct : "déploiement réalisé, le comportement est le bon") — les 2 bugs
  ci-dessus sont bien résolus en pratique, pas seulement en théorie.
- **`GeneratorWizard.jsx` — `min-h-[450px]` retiré** de la carte du wizard
  (partagé par les 4 étapes, poussait le bouton "Suivant" en bas d'une
  hauteur fixe même sur l'étape 1, la plus courte — un vrai espace mort,
  pas juste "quelques px"). Chaque étape prend maintenant la hauteur de
  son propre contenu. Plusieurs passes de padding resserré en cascade
  (`<main>`, en-tête de page, barre de progression, étape 1, pied de
  page) — **confirmé visuellement par l'utilisateur, captures à l'appui**
  (rare dans ce projet : la plupart des chantiers ci-dessus n'ont PAS
  cette confirmation). Tentative de compensation pour la barre "Mode
  invité" **essayée puis annulée** (surcompensait, rendait le bouton
  inaccessible) — voir git blame si quelqu'un est tenté de retenter.
- **`TargetModeInputs.jsx`** (nouveau, `src/components/views/`) — bloc
  distance/allure + durée, extrait de `GeneratorWizard.jsx` où il était
  dupliqué mot pour mot entre l'étape 2 et l'étape 3. Comportement
  identique, juste un seul endroit à maintenir désormais.
- **Perf — `StatsView.jsx`** : l'agrégation complète (boucle imbriquée
  playlists × complétions × titres, ~40 variables) était recalculée à
  CHAQUE rendu, même pour un état sans rapport — enveloppée dans un seul
  `useMemo` (`statsAggregation`). Compagnon nécessaire pour que ça serve à
  quelque chose en pratique : `getProfileForWorkout`/
  `getProfileForWorkoutOrDefault` (`useAthleticProfile.js`) stabilisées en
  `useCallback` — sans ça, elles changeaient de référence à chaque rendu
  du composant propriétaire, annulant le bénéfice du `useMemo` en aval.
- **Perf — `musicEngine.js`** : un `.includes()` (recherche linéaire)
  dans une boucle de sélection de titres remplacé par un `Set` (O(1)).
- **`ARTIST_CATALOG` (musicCatalog.js) — DÉLIBÉRÉMENT laissé dans le
  bundle principal**, après investigation (suite à une suggestion externe
  de le déplacer vers Supabase, puis vers un `import()` paresseux) — voir
  le commentaire juste au-dessus de sa définition dans le fichier pour le
  raisonnement complet : 2 fonctions de CE fichier l'utilisent de façon
  SYNCHRONE en plein rendu React (info-bulle étape 4 du wizard,
  désambiguïsation K-pop/J-pop), impossible à rendre asynchrone sans
  casser ces 2 mécanismes.

⚠️ **La majorité de ce bloc reste non vérifiée en conditions réelles.**
✅ Confirmés le 04/08 : la fermeture de `GuestModeBar` (scroll/spacer) et le
badge de notification Trophées. Restent à vérifier : les onglets
Playlists/Routines du profil public, `SettingsView`/`StatsView` (points
d'entrée croisés), la chasse au scroll résiduel du wizard (au-delà du seul
cas guest bar), et les 3 optimisations de perf (`StatsView.jsx`,
`musicEngine.js`, `TargetModeInputs.jsx`) — build Vercel vert (942 tests)
au moment d'écrire ceci, mais un test qui passe ne garantit pas qu'un
onglet s'affiche correctement, qu'un badge se comporte comme prévu au
clic, etc. **Prochaine étape avant tout nouveau chantier : parcourir
chaque point restant ci-dessus dans l'app déployée.**

---

⚠️ **REFONTE (03/08) — traçabilité de lignée désormais résolue CÔTÉ
SERVEUR, remplace le mécanisme du 02/08 décrit plus bas (`originId`/
`originUserId` propagés par le client).** Ce mécanisme s'est révélé
fragile PAR CONSTRUCTION (un futur bug de spread client aurait pu casser
la lignée silencieusement) — voir `supabase-schema.sql` pour le détail
complet. **Tout ce qui, dans les paragraphes ci-dessous, mentionne
`originId`/`originUserId`/`originCreditClaimed`/`willClaimOriginCredit`/
`willClaimTemplateCredit` décrit l'ANCIENNE architecture, gardé comme
récit historique — ne plus s'y fier comme référence technique actuelle.**

Ce qui change concrètement :
- Le client ne pose plus que le maillon IMMÉDIAT (`parentId`/
  `parentUserId` — triviaux, `id`/`user_id` de l'objet cloné, lus
  directement, rien à dériver) et fait **UN SEUL appel RPC** au clonage
  (`increment_playlist_clone_count`/`increment_routine_clone_count`).
- Postgres résout lui-même l'origine réelle de la chaîne, EN INTERNE,
  via une marche récursive (`resolve_playlist_origin`/
  `resolve_routine_origin`, `WITH RECURSIVE` sur `parent_id`/
  `parent_user_id`) — plus rien à calculer ni propager côté client.
- `parent_id`/`parent_user_id` : colonnes RÉELLES, **immuables après
  l'insertion** — protégées par un trigger SQL (`lock_parent_lineage`)
  ET par `useSyncedCollection.js` (`itemToInsertRow`/`itemToUpdateRow`
  séparées, ces 2 champs ne transitent JAMAIS dans un `update`). Deux
  couches indépendantes, une seule aurait suffi mais coûtait peu de plus.
- Le mécanisme "republier une copie alimente le compteur de son origine"
  (`originCreditClaimed`, dupliqué sur 3 fichiers) est **retiré
  entièrement** — retracé, il s'est avéré être du CODE MORT dans tous les
  cas réels : le clonage crédite déjà l'origine inconditionnellement, donc
  la clé du `clone_ledger` était toujours déjà prise avant qu'une
  republication ne tente le même appel. Ça résout au passage le point
  ouvert "logique de republication dupliquée entre 3 fichiers" (plus rien
  à dupliquer). `handleTogglePlaylistPublic`/`handleToggleRoutinePublic`
  sont redevenus de simples flips locaux, sans aucun appel réseau.
- Badge "Clone"/"Enfant" (`ProfileView.jsx`) : lit désormais la vraie
  colonne `parent_user_id` plutôt que `content.originUserId` — même
  raisonnement de robustesse, moins de surface pour un futur bug
  d'affichage (`isModifiedSinceClone` reste cosmétique dans `content`,
  aucun changement là).
- Tests mis à jour en conséquence : `usePlaylistLibrary.test.js`,
  `useRoutineActions.test.js`, `PlaylistsView.test.jsx`,
  `RoutinesView.test.jsx`, `ProfileView.test.jsx`,
  `PlaylistDetailContext.test.jsx`.

⚠️ **Nouveau SQL à exécuter manuellement dans Supabase avant que quoi que
ce soit ne fonctionne** (voir `supabase-schema.sql`) : colonnes
`parent_id`/`parent_user_id` (playlists/routines), trigger
`lock_parent_lineage`, fonctions `resolve_playlist_origin`/
`resolve_routine_origin`, `_claim_ledger_credit`, et les 3 fonctions
d'incrément réécrites. **Non vérifié en conditions réelles** — même
limite que d'habitude (`auth.uid()` vaut `null` dans l'éditeur SQL
Supabase, voir `CLAUDE-SANDBOX-VERIFICATION.md` §4bis) : la vérification
réelle (clic sur "Cloner" dans l'app déployée, avec une vraie session)
reste à faire, comme pour le chantier précédent.

**Chantier en cours : vérification en conditions réelles de TOUT le bloc "session du 03/08 (2e moitié)" en tête de cette section — rien n'y a encore été cliqué dans l'app déployée, à l'exception du chantier hauteur du wizard.** Une fois fait : retour à l'ordre de priorité normal (Vague 2, Chantier 2 — renforcement post-hoc, moteur BPM/structuration + analyse post-séance, `useSessionAnalysis.js`). **Voir aussi `PASSATION.md`** — résumé chronologique de toute cette session de dev, pour une future conversation qui reprendrait ce fil sans tout ce contexte.

---

**Historique (02/08) — ANCIENNE architecture, remplacée le 03/08 ci-dessus, gardée pour le récit :**


⚠️ **Tentative de vérification manuelle via l'éditeur SQL Supabase — retombée sur la même limite connue** (comme `get_or_create_intimate_persona()` avant elle) : `increment_playlist_clone_count(...)` appelée directement dans l'éditeur SQL s'exécute sans erreur mais `auth.uid()` y vaut `null` (pas de session utilisateur réelle), donc la fonction retourne dès sa 1re ligne — **aucun incrément, ni de `clone_count`, ni du nouveau `clone_ledger`, n'a pu être observé de cette façon**. Confirmé par test : `clone_count` reste à `0` sur `playlist-example-1` après 2 appels directs. Ce n'est PAS un bug — la fonction se comporte exactement comme prévu, elle bloque un appelant non authentifié — mais ça veut dire que **ni l'incrément de base, ni le nouvel anti-abus `clone_ledger`, n'ont encore été vérifiés en conditions réelles** (avec une vraie session connectée, via un vrai clic sur "Cloner" dans l'app déployée). Parcours de vérification suggéré, à faire dans l'app : cloner une playlist publique → vérifier `clone_count` +1 sur le profil de son auteur → supprimer sa copie locale → recloner la même playlist → vérifier que `clone_count` reste identique (pas +2, c'est le vrai test de l'anti-abus).

✅ **Incident RÉSOLU (02/08)** — `tests/views/PlaylistDetailView.test.jsx` signalé en échec par `testFileIdentityTrap.test.js` sur un build Vercel (fichier réellement présent sur GitHub divergé de la copie de référence). Corrigé, build reconfirmé vert depuis.

⚠️ **Correctif supplémentaire (02/08) — synchronisation des descriptions "partout dans l'app"**, retour direct après une capture d'écran montrant une description Lorem ipsum sur la carte "Découvrir" mais RIEN du tout une fois la playlist réellement ouverte. Vérifié : il existait 3 sources DIFFÉRENTES pour la description d'un même template selon l'endroit regardé — `CATEGORY_DESCRIPTIONS` (réelle, par catégorie, utilisée seulement par la vitrine), un texte Lorem ipsum générique (utilisé seulement par `TemplateCard.jsx`/Découvrir), et RIEN DU TOUT (`openCuratedPlaylist`, qui reconstruit la playlist réellement ouverte depuis le template brut, n'avait jamais eu de champ description). `CATEGORY_DESCRIPTIONS` déplacée dans `curatedSessions.js` (source unique, partagée) — Découvrir et l'ouverture réelle de la playlist utilisent désormais la MÊME description que la vitrine, plus de version isolée. Toujours PAS de vraie description par template (juste par catégorie, un pis-aller réel mais générique) — en attente que l'utilisateur réécrive les templates en profondeur.

⚠️ **2 correctifs supplémentaires le même jour**, après une conversation générale sur les limites du système ("tu penses que c'est le meilleur système ?") — discussion volontairement tenue SANS implémenter en même temps, puis actée une fois les points clarifiés :

3. **"Si A clone B, puis C clone la copie de B, ça doit augmenter A ET B"** (pas seulement l'origine A) — le clonage incrémente désormais **2 cibles distinctes** : le maillon immédiat (B, qui vient de se faire cloner) ET l'origine de la chaîne (A, si différente). Un seul appel réel si les deux sont identiques (1er clonage, jamais de doublon). La republication, elle, ne cible toujours QUE l'origine — republier son propre contenu n'est pas "se faire cloner".
4. **Anti-abus "toggle spam"** — rien n'empêchait avant de faire public→privé→public en boucle pour réincrémenter le compteur de l'origine à chaque fois. `originCreditClaimed` (booléen, posé une seule fois, jamais réinitialisé) bloque ça : une copie ne peut contribuer son crédit de republication qu'UNE SEULE FOIS dans toute sa vie.
5. **"Clone" vs "Enfant"** — la lignée de clonage ne se rompt JAMAIS, même après des modifications substantielles (retour direct explicite : un seuil de "modification substantielle" serait arbitraire et lui-même contournable). À la place, une ÉTIQUETTE change : `isModifiedSinceClone` (booléen, jamais réinitialisé) passe à `true` dès la 1re modification (renommage, description, ou "Toujours pour cette routine" côté routines — PAS "Cette séance seulement", qui ne modifie jamais la routine sauvegardée). Affiché comme badge "Clone"/"Enfant" sur `PublicItemCard` (ProfileView.jsx) — compte pour 1 dans les deux cas, aucun impact sur le compteur lui-même.

✅ **Implémenté (02/08, sur demande explicite)** : l'abus "cloner puis supprimer sa copie en boucle" est désormais bloqué — nouvelle table `clone_ledger` (`supabase-schema.sql`), permanente, jamais nettoyée : une ligne = "ce compte a déjà obtenu un crédit de clonage pour cette cible précise, un jour", **survit à la suppression locale de la copie** (contrairement à `originCreditClaimed`, un flag côté client qui ne pouvait structurellement pas survivre à la suppression de l'objet qui le porte). Les 3 fonctions d'incrément (`increment_playlist_clone_count`/`increment_routine_clone_count`/`increment_template_clone_count`) consultent ce registre en premier (idiome `insert ... on conflict do nothing` + `if not found`) — si le crédit a déjà été accordé, la fonction s'arrête là, avant tout incrément. `target_key` (texte unique, PAS une paire `(id, user_id)` séparée) : `target_id || ':' || target_user_id` pour une playlist/routine réelle, `'template:' || template_id` pour un template — un seul registre partagé pour les 3 mécanismes, sans risque de collision entre les espaces de noms. Aucune policy de lecture/écriture côté client sur cette table — jamais interrogée directement, seulement en interne par les fonctions `security definer`. **Nouveau SQL à exécuter manuellement dans Supabase.**

Fichiers touchés par ces 2 correctifs (3e et 4e passages sur ce chantier) : `usePlaylistLibrary.js`, `App.jsx` (clonage — dual increment + init des 2 flags), `PlaylistDetailContext.jsx`/`PlaylistsView.jsx`/`RoutinesView.jsx` (republication — anti-spam), `PlaylistDetailContext.jsx` (rename/description — flag Clone/Enfant), `useRoutineActions.js` (`applyRoutineEditPermanently` — flag Clone/Enfant), `ProfileView.jsx` (badge affiché). `useRoutineActions.js` a désormais son 1er fichier de test (`tests/hooks/useRoutineActions.test.js`, 02/08) — scopé au flag Clone/Enfant, pas une couverture exhaustive du hook.

⚠️ **Ce chantier a été revu 2 fois après la 1re implémentation** (vérifiée par le build Vercel du 02/08, voir plus bas) — les 2 retours suivants ont changé l'architecture, pas juste le réglage :

1. **"Je veux que le compteur de clonage soit honnête, 0 par défaut"** — les nombres "ambitieux mais faux" (`fakeCloneCountForId`, vitrine ET Découvrir) sont retirés, remplacés par une VRAIE table (`template_clone_counts`, supabase-schema.sql — clé `template_id`, lecture publique même sans compte, alimentée par une RPC dédiée). Découvrir et la vitrine lisent maintenant la même donnée réelle — un template jamais cloné affiche `0`, jamais un nombre inventé.
2. **"Ce n'est pas juste le clic sur Cloner qui alimente le compteur — si A clone B, puis C clone la copie d'A, ça doit compter pour B, pas pour A. Et si je republie ma copie, ça alimente aussi le compteur de l'original."** — introduit une vraie **traçabilité de lignée** : `originId`/`originUserId`, posés sur CHAQUE copie au moment du clonage (repli sur soi-même si jamais clonée avant), propagés automatiquement à travers toute la chaîne, aussi loin qu'elle s'étende. **Aucune nouvelle colonne SQL nécessaire** — ces 2 champs vivent dans `content` (comme `description`), synchronisés par le mécanisme déjà en place.
   - ⚠️ **Corrigé une 3e fois le même jour** — retour direct : "si A fait une playlist, B la clone, et C clone la copie de B, ça doit augmenter le compteur de A ET de B". Le clonage incrémente donc **2 cibles distinctes** : le maillon immédiat (celui qu'on vient concrètement de cloner) ET l'origine de la chaîne (si différente) — jamais un seul incrément "tout ou rien" vers la racine. Les deux sont identiques (donc un seul appel réel) quand la copie clonée n'avait jamais été clonée avant. La republication (rendre public une copie déjà issue d'un clonage), elle, ne cible QUE l'origine — republier son propre contenu n'est pas "se faire cloner", pas de double incrément à faire là.

Fichiers touchés par ce 2e passage : `usePlaylistLibrary.js` (`handleClonePlaylist`), `PlaylistDetailContext.jsx`/`PlaylistsView.jsx` (2 implémentations séparées de "rendre publique" — détail ET liste, toutes deux mises à jour), `App.jsx` (`handleClonePublicRoutine` — ⚠️ lit `row.content.originId`, PAS `row.originId` : une routine est une ligne Supabase brute, tous ses champs personnalisés vivent dans `content`, contrairement à `currentPlaylist` côté playlists qui est déjà l'objet aplati), `RoutinesView.jsx` (`handleToggleRoutinePublic`).

Résidu du 1er passage, toujours vrai : SQL exécuté avec succès dans Supabase (`template_clone_counts` + RPC), mais le clonage lui-même ne s'incrémente QUE via "Cloner" sur un profil/la vitrine — jamais via "Utiliser ce modèle" dans Découvrir (action différente : générer sa propre séance, pas copier). Ce chiffre reste donc probablement bas en pratique pour la plupart des templates — c'est le prix d'un compteur honnête.

⚠️ **2 tests existants trouvés CASSÉS en cours de route** (`tests/views/ProfileView.test.jsx`) — affirmaient "mockFrom jamais appelé" pour la grille de la vitrine, plus vrai depuis que la branche vitrine fait un vrai fetch (`template_clone_counts`). Corrigés, renommés pour refléter ce qui reste réellement vrai (les STATS et le CONTENU restent statiques, seul le compteur de clonage fait un appel réseau).

⚠️ **Correctif rétroactif (02/08, retour direct "la vitrine ne montre pas toutes les fonctionnalités")** — `officialVitrineProfile.js` n'avait jamais été mis à jour au fil des chantiers "description libre" et "compteur de clonages" : `templateToVitrineRow` (playlists) ne portait ni `content.tracks` (donc 0 genre extrait par `useProfileSearchFilter.js` — silencieusement, jamais une erreur), ni `content.description`, ni `clone_count` ; `FAKE_VITRINE_ROUTINES` n'avait ni description ni clone_count non plus. Corrigé — voir `src/data/officialVitrineProfile.js` pour le détail (nouvelle table `CATEGORY_DESCRIPTIONS`, `fakeCloneCountForId` déterministe). **Règle à retenir pour la suite** : toute nouvelle fonctionnalité touchant `content` d'une playlist/routine doit aussi être vérifiée contre `officialVitrineProfile.js` — cette vitrine est censée démontrer TOUTES les fonctionnalités à un visiteur non connecté, une régression y est silencieuse (aucun test ne l'aurait signalée avant celui-ci, maintenant ajouté à `tests/data/officialVitrineProfile.test.js`).

**`DiscoverView.jsx`/`TemplateCard.jsx` — décision RENVERSÉE le 02/08, à la demande explicite de l'utilisateur** (après lui avoir signalé le "PIVOT DESIGN" antérieur qui avait retiré la description/les tags) : le compteur de clonages **est** ajouté à `TemplateCard.jsx`, partagé avec la vitrine via `fakeCloneCountForId` (nouvellement déplacée dans `curatedSessions.js`, importée par les deux — un même template affiche donc TOUJOURS le même nombre, qu'on le consulte depuis Découvrir ou depuis le profil `@tempofit_officiel`). ⚠️ Piège trouvé en écrivant les tests : le fixture existant de `TemplateCard.test.jsx` n'avait jamais eu besoin d'un `id` avant cette fonction — `fakeCloneCountForId(undefined)` aurait fait planter `undefined.length`. Corrigé par une garde défensive dans la fonction (renvoie `8` si `id` n'est pas une vraie chaîne non vide) + fixture de test mis à jour avec un `id` réaliste.

⚠️ **TODO — description PLACEHOLDER, pas la version finale** : ajoutée le 02/08 (2e retour direct : "mets les descriptions aussi, pour voir à quoi ça ressemble visuellement — même texte de base partout si ça économise des tokens") — `TemplateCard.jsx` affiche désormais une description sur chaque carte, mais **le même texte de remplissage (Lorem ipsum) partout**, pas une vraie description par template. `curatedSessions.js` n'a toujours aucun champ `description` réel. **Une fois le nouveau contenu de `curatedSessions.js` acté** (l'utilisateur prévoit de réécrire ces templates en profondeur prochainement) : (1) ajouter un vrai champ `description` par template dans `curatedSessions.js` (remplacerait alors avantageusement `CATEGORY_DESCRIPTIONS`, officialVitrineProfile.js, qui n'est qu'un repli générique par catégorie faute de mieux, et le `PLACEHOLDER_DESCRIPTION` de `TemplateCard.jsx`) ; (2) remplacer le placeholder par ce vrai champ aux deux endroits.

⚠️ **Requiert une action manuelle Supabase avant que quoi que ce soit ne fonctionne** — voir `supabase-schema.sql` : nouvelle colonne `clone_count` (`playlists`/`routines`) + 2 fonctions d'incrément (`increment_playlist_clone_count`/`increment_routine_clone_count`).

Ce qui a été posé (02/08) :
- **SQL** : `clone_count` (colonne, les 2 tables) + les 2 fonctions d'incrément, atomiques, avec garde anti-abus (`target_user_id = auth.uid()` bloque l'auto-incrémentation). ⚠️ Piège retrouvé en écrivant ce SQL — DÉJÀ rencontré une fois sur ce projet : la clé primaire de `playlists`/`routines` est **composite `(id, user_id)`**, jamais `id` seul (2 comptes peuvent partager le même id, ex. la playlist démo) — les 2 fonctions prennent donc `target_user_id` en paramètre OBLIGATOIRE, jamais une simplification par `id` seul qui répéterait la collision déjà corrigée dans `PlaylistDetailContext.jsx`.
- **Client** : `handleClonePlaylist` (`usePlaylistLibrary.js`) et `handleClonePublicRoutine` (`App.jsx`) appellent la bonne fonction après un clonage réussi — fire-and-forget, jamais bloquant (un échec réseau sur ce compteur de vanité ne doit jamais faire échouer le clonage lui-même, déjà effectif localement). `handleOpenPublicPlaylist` modifié pour transporter `user_id` jusqu'à `currentPlaylist`, sans quoi `handleClonePlaylist` n'aurait pas eu l'info nécessaire pour cibler le bon compte.
- **Affichage** : badge par item (`PublicItemCard`, ProfileView.jsx, masqué si 0) + total agrégé Sport/Intime **jamais mélangés** sur le profil public (calculé côté client depuis ce qui est déjà chargé — pas de requête supplémentaire) + un nouveau bloc dans `StatsView.jsx` pour ses propres stats, **volontairement une requête FRAÎCHE dédiée** plutôt que lue depuis `savedPlaylists` (le cache local synchronisé ne reflète jamais un changement provoqué par quelqu'un D'AUTRE clonant le contenu — resterait périmé jusqu'à la prochaine reconnexion).
- **Décision de scope actée avec l'utilisateur** : uniquement un compteur par item, pas de classement (leaderboard) des créateurs — ce serait le chantier "Pulses/Leaderboard" (fondations déjà posées séparément), pas celui-ci. Compte UNIQUEMENT les clonages (copier le contenu de quelqu'un d'autre), jamais les sauvegardes de ses propres créations (`handleSavePlaylist` — concept différent, vérifié dans le code avant de trancher).
- Tests ajoutés : `tests/hooks/usePlaylistLibrary.test.js` (nouveau — 1er test de ce hook, scopé au compteur), `tests/views/StatsView.test.jsx` (nouveau — 1er test de cette vue, scopé au nouveau bloc), extension de `tests/views/ProfileView.test.jsx`. ⚠️ `handleClonePublicRoutine` (App.jsx) reste NON testé directement — App.jsx n'a aucun fichier de test dédié dans ce projet (composant volontairement pas testé unitairement, voir sa taille), créer un fichier juste pour cette fonction aurait été disproportionné.

Chantier précédent ("Pulses/Leaderboard" — fondations SQL de la persona intime + première UI "Ma persona intime") terminé et **vérifié de bout en bout en conditions réelles** le 02/08 (voir plus bas, section dédiée). Toujours aucun pulse, aucun leaderboard construits — seulement un bouton qui révèle son propre pseudonyme stable. Suite logique quand on y reviendra : opt-in au leaderboard + affichage du classement lui-même — à brief séparément le moment venu.

⚠️ **Ce chantier requiert une action manuelle avant de continuer** : contrairement à tous les précédents (uniquement du frontend/JS), celui-ci ajoute une vraie table + 2 fonctions SQL (`supabase-schema.sql`) — **à exécuter dans l'éditeur SQL Supabase avant que quoi que ce soit ne fonctionne**, pousser sur GitHub ne suffit pas. Requêtes de vérification suggérées incluses en commentaire juste au-dessus de `generate_intimate_pseudonym` dans le fichier.

Ce qui est posé (02/08) — voir `supabase-schema.sql` pour le détail commenté :
- Table `intimate_personas` (`user_id` → `intimate_id`/`pseudonym`), RLS activée, **aucune policy de lecture publique** (volontaire — seule la RPC ci-dessous expose quoi que ce soit).
- `generate_intimate_pseudonym(seed uuid)` — déterministe, basé sur `hashtext()` (fonction Postgres native, pas de dépendance à un idiome plus difficile à vérifier sans exécution réelle), jamais dérivé du username ni de `user_id`.
- `get_or_create_intimate_persona()` — RPC dédiée (`security definer`, `auth.uid()` uniquement, jamais de paramètre client), idempotente, ne renvoie **jamais** `user_id`.
- Conforme aux règles déjà tranchées plus bas ("Décisions actées, pas encore implémentées") : pseudonyme stable, indépendant du username, aucune fuite de `user_id`, aucune policy publique sur la table.
- Limite assumée, pas un oubli : ~400 combinaisons de pseudonymes (20×20), donc collisions possibles entre utilisateurs à grande échelle — sans risque de sécurité (`intimate_id` reste unique), juste une limite UX à revisiter si le Mode Intime grossit beaucoup.
- Prochaine étape logique (pas commencée) : une UI qui appelle `get_or_create_intimate_persona()` — un toggle "partager en Mode Intime" quelque part, probablement `SettingsView.jsx` ou `ProfileView.jsx`, à brief séparément.
- ✅ **Vérifié dans l'éditeur SQL Supabase le 02/08** : `generate_intimate_pseudonym('00000000-0000-0000-0000-000000000000'::uuid)` renvoie systématiquement `"Marée Mystère"` — confirmé stable sur plusieurs appels d'affilée.
- ✅ **Vérifiée de bout en bout en conditions réelles le 02/08** : build Vercel vert (tests mockés OK) PUIS clic réel sur "Découvrir mon pseudonyme" dans l'app déployée, en Mode Intime, avec un vrai compte connecté — persona générée avec succès (`"Aigle Secret"`, `Aigle`/`Secret` bien issus des 2 listes attendues). Confirme l'insert, l'idempotence et le `security definer` en conditions réelles, pas seulement en théorie. Ce chantier ("Pulses/Leaderboard", fondations + 1re UI) est maintenant COMPLET et validé — aucun point en suspens.

Première UI branchée dessus (02/08) — **"Ma persona intime"**, `SettingsView.jsx`, onglet "Mon Compte", visible en Mode Intime uniquement, **indépendante de `isProfilePublic`** (voir README plus haut : les pulses restent possibles sans opt-in au leaderboard). Bouton "Découvrir mon pseudonyme" → appelle `get_or_create_intimate_persona()` → affiche le résultat. **Volontairement manuel, jamais automatique au montage** : un `useEffect` qui déclencherait la création silencieusement dès l'ouverture de cet onglet contredirait le "fermé par défaut, l'utilisateur CHOISIT de partager" du README, même si la ligne créée reste inerte (aucune policy de lecture publique). Conséquence acceptée : `intimatePersona` n'est pas persisté côté client, redemande un clic à chaque nouvelle visite de la page (la RPC étant idempotente, ça renvoie toujours la même persona, aucune perte).

Chantier annexe terminé le 02/08 — **description texte libre sur une playlist/routine publique** (point 3 de l'ordre de priorité ci-dessous, traité isolément, sans besoin d'attendre son tour) : `content.description` (simple champ texte dans le `jsonb` déjà existant, **aucune migration SQL** — même logique que `plannedDate`/`coverUrl`, ajoutés avant sans jamais toucher au schéma). `MAX_DESCRIPTION_LENGTH` (`appConfig.js`, **150** — resserré depuis 280 le 04/08, voir bloc "SESSION DU 04/08" plus haut) partagée entre édition et affichage. Playlists : édition inline dans `PlaylistHeader.jsx`/`PlaylistDetailContext.jsx`, même schéma que le renommage déjà existant. Routines : **décision volontaire** de ne PAS l'ajouter à `EditRoutineModal.jsx` — cette modale force un choix "cette séance seulement/toujours" qui déclenche une génération à chaque sauvegarde (`applyRoutineEditOnce`/`applyRoutineEditPermanently`), une friction absurde pour un simple texte ; édition inline directement sur la carte de `RoutinesView.jsx` à la place (`setRoutines` local, même pattern que la bascule publique/privée du chantier 1). Affiché publiquement dans `PublicItemCard`/`PublicRoutinePreviewModal.jsx`, et intégré à la recherche texte de `useProfileSearchFilter.js` (explicitement prévu par le brief du chantier précédent une fois ce champ construit).

Chantier précédent (**Vague 2, Chantier 1 — UI publique des routines**) terminé le 02/08 : le SQL/RLS existait déjà (`routines.is_public`/`is_intimate`), il ne manquait que l'intégration frontend, transposée du mécanisme déjà en prod pour les playlists — voir `RoutinesView.jsx` (bascule publique/privée par routine, même pattern que `PlaylistCard.jsx`), `PublicRoutinePreviewModal.jsx` (nouvelle modale : aperçu + clonage — une routine n'a pas de vue détail dédiée contrairement à une playlist, donc pas de navigation possible comme `handleOpenPublicPlaylist`, juste une modale légère sur le modèle d'`ImportSharedPlaylistModal.jsx`) et `handleOpenPublicRoutine`/`handleClonePublicRoutine` (App.jsx). Bug réel trouvé et corrigé au passage dans `ProfileView.jsx` : `PublicItemCard` lisait aveuglément les champs *playlist* (`content.config.bpm`, `content.totalDuration`, `content.coverUrl`) même pour une routine — resté invisible jusqu'ici car aucune routine n'avait jamais été publique en pratique. `content` d'une routine a une forme différente (`bpm` à la racine, pas de `totalDuration` car rien n'a encore été généré, `coverIcon` emoji plutôt que pochette) — `PublicItemCard` prend maintenant un prop `kind` ('playlist'/'routine') pour lire les bons champs.

Chantier annexe (hors de l'ordre de priorité numéroté ci-dessous, traité sur brief dédié) — **Recherche & filtres sur les profils publics** — terminé le 02/08 : `useProfileSearchFilter.js` (nouveau hook, `src/hooks/`), recherche texte + filtres type/sport/genre/durée sur la grille COMBINÉE playlists+routines de `ProfileView.jsx` (pas d'onglets séparés — écarté du scope, voir le brief). Extraction genre/durée **adaptative selon `kind`** (même divergence de forme `content` que le chantier précédent) : genre via `getGenresForDisplay` sur les titres réels pour une playlist, `content.selectedGenres` direct pour une routine ; durée via `content.totalDuration` pour une playlist, uniquement si `targetMode === 'time'` pour une routine (une routine en mode distance est exclue de tout bucket précis, jamais de conversion distance→temps approximative). Annexe à ce chantier : la vitrine `@tempofit_officiel` affiche désormais aussi des routines fictives (`buildOfficialVitrineRoutineRows()`, `officialVitrineProfile.js`) — codées à la main (aucun template de routine dans `curatedSessions.js`), genres adaptés aux valeurs canoniques réelles du catalogue (`Electro` sans accent, `R&B Sensuel` pour l'Intime — le brief proposait des noms qui n'existent pas tels quels dans `musicCatalog.js`). ⚠️ 2 régressions réelles livrées puis corrigées le 02/08, toutes deux trouvées par le vrai build Vercel (jamais par la sandbox) : (1) `inputBorder`/`inputBg` utilisés dans la nouvelle barre de recherche sans être destructurés de `theme` — angle mort d'esbuild, voir `CLAUDE-SANDBOX-VERIFICATION.md` §1bis, `tsc --checkJs` ajouté au protocole en conséquence ; (2) l'étiquette interne `kind` (posée pour combiner playlists/routines dans une seule grille) fuyait dans le payload transmis à `onOpenPlaylist`/`onOpenRoutine`, cassant leur contrat "ligne brute" — sans impact fonctionnel réel (App.jsx ignore les champs qu'il ne lit pas) mais détecté par les tests existants, corrigé en dépouillant `kind` juste avant l'appel. Build Vercel vert depuis.

**Règle** : dès qu'un chantier démarre, remplacer cette ligne par son nom + son état d'avancement réel (pas juste "en cours" — assez précis pour qu'une session qui n'a pas participé sache où reprendre). Dès qu'il se termine, revenir ici et pointer vers le suivant dans l'ordre de priorité (section "Décisions actées" plus bas). Une session qui termine un chantier sans mettre à jour cette section laisse la suivante repartir à l'aveugle.

---

# TempoFit — Historique détaillé, bloc 2 (08/08, sessions memoization/UX)

⚠️ Même principe que le bloc précédent : contenu copié tel quel depuis la
section "État d'avancement" du README au moment de son 2e élagage (08/08,
fin de session — le premier élagage datait du même jour, plus tôt),
quand elle a regrossi au-delà de 600 lignes en une seule journée
(chantiers de mémoïsation des Contexts en cascade + UX playlist). Aucun
contenu réécrit ni résumé.

Couvre, dans l'ordre chronologique d'origine : `signOut()` qui attend les
écritures Supabase en vol, la fusion inline titre+description (remplacée
depuis par une modale, voir le README actuel), le retrait de la
description libre sur les routines, et le check-up du 07/08.

---

✅ **SESSION DU 08/08 (suite) — `signOut()` attend désormais les écritures Supabase encore en vol AVANT de couper la session, pas seulement de vider le cache local après coup.** Suite à l'audit du 08/08 (check-up général demandé en début de session) : `clearLocalCache()` (07/08, voir plus bas) reposait sur l'hypothèse "tout changement local a déjà été poussé vers Supabase au moment du signOut" — vraie la plupart du temps (chaque `setState` déclenche déjà son upsert/insert/delete immédiatement, aucun debounce), mais jamais GARANTIE : une frappe ou un clic juste avant de cliquer sur Déconnexion peut très bien laisser une écriture encore en vol au moment où `signOut()` s'exécute.

Nouveau fichier — **`src/utils/pendingWrites.js`** — compteur global (module-level, singleton partagé par toutes les instances des deux hooks de persistance) des écritures Supabase en tâche de fond : `trackWrite(thenable, onSettled?)` l'incrémente à l'appel, le décrémente à la fin (succès ou échec) ; `waitForPendingWrites(timeoutMs = 5000)` renvoie une Promise qui se résout dès que le compteur retombe à zéro, avec un timeout pour ne JAMAIS bloquer une déconnexion indéfiniment (réseau down, requête bloquée). Voir sa docstring pour le raisonnement complet.

Fichiers touchés (3) :
- **`useSyncedCollection.js`** — les 4 écritures en tâche de fond (delete/insert/update par diff de `setState`, + la poussée initiale à la 1re connexion d'un compte qui avait déjà des données invité) passent désormais par `trackWrite`. Comportement observable strictement identique — `trackWrite` ne fait qu'envelopper la Promise/le thenable Supabase, les callbacks de journalisation d'erreur reçoivent exactement le même `{ error }` qu'avant.
- **`usePersistentState.js`** — même traitement sur ses 2 upserts (poussée initiale à la connexion + push à chaque changement local).
- **`AuthContext.jsx`** — `signOut()` appelle `await waitForPendingWrites()` en tout premier, AVANT `supabase.auth.signOut()` (pas après) : le but est que les dernières écritures partent avec une session ENCORE valide, plutôt que de risquer un échec côté RLS une fois la session coupée. `clearLocalCache()` reste ensuite au même endroit qu'avant (07/08).

Tests : nouveau `tests/utils/pendingWrites.test.js` (comportement du compteur/timeout, isolé de React) + 1 nouveau test dans `tests/contexts/AuthContext.test.jsx` (`signOut` bloque tant qu'une écriture trackée n'est pas résolue, puis appelle `supabase.auth.signOut` et vide le cache une fois celle-ci terminée). Logique du module vérifiée par une exécution Node réelle en plus de la relecture (pas de `node_modules` dans ce bac à sable pour lancer `vitest` lui-même, voir `CLAUDE-SANDBOX-VERIFICATION.md` §5).

⚠️ **SESSION DU 08/08 (suite) — édition titre + description FUSIONNÉE sur les playlists, un seul crayon plutôt que deux affordances séparées (retour direct, capture annotée : "que modifier le titre ou la description vienne un seul crayon plutôt que via chacune une option individuelle").** Avis donné avant d'exécuter (idée franchement bonne, précédent cité : Spotify "Modifier les détails" fait exactement ça) — 2 façons de le faire proposées, tranchées par retour direct : **inline**, pas une modale.

Fichiers touchés (4) :
- **`PlaylistDetailContext.jsx`** — `isEditingPlaylistName`/`isEditingPlaylistDescription` (2 booléens) fusionnés en **`isEditingPlaylistDetails`** (1 seul) ; `handleRenamePlaylist`/`handleEditPlaylistDescription` (2 handlers) fusionnés en **`handleSavePlaylistDetails`** (1 seul, un seul `updatedPlaylist`, un seul `setCurrentPlaylist`/`setSavedPlaylists`).
  ⚠️ **Piège identifié AVANT d'implémenter, pas après coup** : les 2 anciens handlers lisaient chacun `currentPlaylist` depuis la MÊME fermeture de rendu — les appeler l'un après l'autre (au lieu de fusionner en un seul objet) aurait fait perdre le 1er changement, le 2e handler construisant son `updatedPlaylist` à partir de l'ancien `currentPlaylist` (React ne reflète un `setState` qu'au rendu SUIVANT, jamais dans le même tick synchrone). Un seul objet, un seul appel : ce risque n'existe pas dans la version livrée.
  Nom **jamais vide** (une playlist sans nom n'aurait aucun sens, même garde que l'ancien `handleRenamePlaylist`) — mais contrairement à l'ancien comportement (avorter TOUTE la sauvegarde si le nom était vidé, description tapée à côté comprise), un nom vidé PAR MÉGARDE replie désormais sur l'ANCIEN nom (`|| currentPlaylist.name`) sans perdre la description modifiée en même temps — plus indulgent, jamais de perte de données silencieuse pour un champ non fautif.
- **`PlaylistHeader.jsx`** — un SEUL crayon (sur le titre, `isSaved && !isReadOnly`, même garde qu'avant) ouvre l'édition des deux champs ensemble (pré-remplit les 2 brouillons avant de basculer l'état). L'ancienne invite "+ Ajouter une description" (bouton dédié, séparé) et le crayon dédié à la description ont disparu — découvrir qu'on peut ajouter une description passe désormais par LE crayon, comme pour le titre. Import `Check` (lucide-react) devenu inutile, retiré.
- **`tests/views/PlaylistDetail/PlaylistHeader.test.jsx`** — suites "renommer"/"description" séparées fusionnées en une seule série de tests sur l'édition combinée ; tests de non-régression pour l'invite retirée.
- **`tests/contexts/PlaylistDetailContext.test.jsx`** — sonde `DescriptionProbe` remplacée par `DetailsProbe` (nom + description ensemble) ; **nouveau test dédié** qui reproduit précisément le scénario du risque de course identifié avant implémentation (modifier nom ET description dans la même édition, sauvegarder en un clic, vérifier que les deux survivent) — ce n'est pas un test après-coup sur un bug trouvé, c'est la preuve que le bug anticipé n'existe pas dans la version livrée.

⚠️ **AJUSTEMENT (08/08, même jour, retour direct après relecture honnête de
la fusion) — indice discret "Aucune description" réintroduit.** En
répondant franchement à "c'était la bonne solution ?", un vrai compromis
identifié : "+ Ajouter une description" disait littéralement ce qu'il
faisait (texte cliquable, explicite) — la fusion en un seul crayon
générique sur le titre a fait perdre cette découvrabilité, un visiteur
du code découvrant l'app ne devine pas forcément que LE crayon couvre
aussi la description. Corrigé sans revenir à un 2e point d'entrée
cliquable (qui recréerait la duplication d'origine, tout l'objet de ce
chantier) : `PlaylistHeader.jsx` affiche désormais **"Aucune
description"** en texte discret (`text-xs text-slate-600 italic`),
PUREMENT informatif — jamais un `<button>`, jamais de `cursor-pointer`,
jamais d'état hover. Le crayon du titre reste le SEUL point d'entrée pour
éditer ; ce texte ne fait que signaler que le champ existe. Même
périmètre que l'ancienne invite (`isSaved && !isReadOnly` uniquement — un
visiteur n'a rien à éditer, le lui signaler n'apporterait rien
d'actionnable). 4 nouveaux tests ajoutés
(`tests/views/PlaylistDetail/PlaylistHeader.test.jsx`) : affichage +
non-cliquable, absence si `isSaved=false`, absence pour un visiteur,
absence dès qu'une vraie description existe.

⚠️ **Pas encore vérifié en conditions réelles** — même limite habituelle (bac à sable sans accès réseau), à confirmer au prochain build/clic réel.

⚠️ **SESSION DU 08/08 — description libre RETIRÉE pour les routines, conservée pour les playlists (retour direct, capture à l'appui : "finalement pas emballé par la fonctionnalité description sur les routines... on conserve juste pour les playlists").** Contexte du retrait : contrairement à une playlist (vraie page détail dédiée, `PlaylistHeader.jsx`, où la description a la place de respirer), une routine n'a AUCUNE vue détail séparée — la description finissait compressée sur la carte elle-même, tronquée à 1 ligne sans échappatoire, exactement ce que montrait la capture jointe au retour direct (texte "CV V" illisible, à peine visible). Chantier d'origine : Vague 2, Chantier 3, 02/08 — voir `HISTORIQUE.md` pour l'historique complet (archivé le 08/08, voir plus bas dans ce README), gardé pour le récit mais PLUS À JOUR pour la partie routines.

Fichiers source touchés (5) :
- **`RoutinesView.jsx`** — édition inline entièrement retirée (`editingDescriptionId`/`descriptionDraft`, `startEditingDescription`/`handleSaveRoutineDescription`, le bloc JSX, les imports `MessageSquarePlus`/`Check`/`X`/`MAX_DESCRIPTION_LENGTH` devenus inutiles).
- **`PublicRoutinePreviewModal.jsx`** — affichage retiré.
- **`ProfileView.jsx`** (`PublicItemCard`) — gaté sur `!isRoutine` désormais ; la description reste affichée pour les playlists uniquement, sur la même carte partagée entre les deux `kind`.
- **`officialVitrineProfile.js`** — descriptions retirées des 4 routines fictives de la vitrine (`FAKE_VITRINE_ROUTINES`) ; `templateToVitrineRow` (playlists) inchangée, la fonctionnalité reste active pour les playlists de la vitrine aussi.
- **`useProfileSearchFilter.js`** — la recherche texte ne matche plus sur `content.description` d'une routine (`row.kind === 'routine' ? '' : ...`), même si une ANCIENNE routine en garde une en base (jamais nettoyée rétroactivement, aucune migration de données faite) — cohérent avec le fait qu'elle n'est plus affichée nulle part : matcher sur un texte devenu invisible aurait été déroutant.

⚠️ **Aucune migration de données côté Supabase** — les routines qui portaient déjà une description avant ce retrait la GARDENT en base (`content.description`, toujours dans le `jsonb`), simplement plus jamais lue ni affichée par le code. Choix délibéré (cohérent avec la philosophie déjà en place sur ce projet pour ce genre de champ, voir `content.description` dans les décisions d'architecture plus bas) : un champ non lu ne coûte rien à laisser trainer, et supprimer activement une donnée utilisateur pour un simple retrait de fonctionnalité UI aurait été disproportionné. Si la fonctionnalité revient un jour pour les routines, ces anciennes descriptions réapparaîtraient telles quelles.

Tests : suites obsolètes retirées et remplacées par des tests de non-régression (même esprit que pour le retrait du pseudo sur `PlaylistCard.jsx`, voir plus bas) dans **7 fichiers** — `RoutinesView.test.jsx`, `PublicRoutinePreviewModal.test.jsx`, `ProfileView.test.jsx` (2 tests, affichage + recherche), `officialVitrineProfile.test.js`, `useProfileSearchFilter.test.js` — plus 2 commentaires historiques imprécis corrigés en passant (`PlaylistHeader.test.jsx`/`PlaylistDetailContext.test.jsx`, mentionnaient encore "playlist/routine" dans le nom du chantier d'origine).

⚠️ **SESSION DU 07/08 — check-up demandé en début de conversation (lecture
README.md → CLAUDE-SANDBOX-VERIFICATION.md → code réel, esbuild + tsc
--checkJs + résolution d'imports sur tout le projet, 0 anomalie), 1 bug
réel trouvé et corrigé, 1 optimisation de dette technique appliquée :**

- **BUG CORRIGÉ — `usePlaylistLibrary.js`, `handleClonePlaylist` : la
  copie clonée gardait le `user_id`/`ownerUsername`/`cloneCount` du
  PROPRIÉTAIRE D'ORIGINE.** `cloned = { ...currentPlaylist, ... }` reporte
  aussi les champs D'AFFICHAGE posés par `handleOpenPublicPlaylist`
  (App.jsx) pour la playlist ÉTRANGÈRE consultée — `user_id` (l'UUID de
  l'ANCIEN propriétaire), `ownerUsername`, `cloneCount` (figé au moment du
  clonage) — jamais remis à `undefined`, contrairement à
  `completions`/`actualDataByDate`/`plannedDate`/`isPublic`/`isReadOnly`,
  qui eux le sont explicitement juste à côté. Résultat : la copie,
  désormais possédée par l'utilisateur, gardait pour toujours dans son
  `content` (donc synchronisé tel quel vers Supabase) l'UUID et le pseudo
  de l'ancien propriétaire. Aucun symptôme visible en pratique (les 2
  seuls endroits qui lisent ces champs — bouton Cloner et badge de
  clonages, `PlaylistHeader.jsx` — sont gatés sur `isReadOnly`, qui
  redevient `false` après clonage) mais un vrai risque latent : tout futur
  code qui lirait `currentPlaylist.user_id` sans vérifier
  `isReadOnly`/`isSaved` en premier traiterait à tort cette copie,
  pourtant possédée, comme une playlist étrangère — même famille de piège
  que celui déjà documenté plus bas sur la clé composite `(id, user_id)`
  ("toujours filtrer par les deux ensemble"). Corrigé : `user_id:
  undefined, ownerUsername: undefined, cloneCount: undefined` posés
  explicitement dans `cloned`, même endroit que les autres remises à zéro.
  Point relevé au passage, pas un bug : `handleClonePublicRoutine`
  (App.jsx), l'équivalent côté routines, n'a jamais eu ce problème — il
  part de `{ ...row.content }` (le contenu brut, sans `user_id`) plutôt
  que de l'objet aplati. Divergence entre les deux implémentations, pas un
  choix voulu, mais sans conséquence pratique côté routines. 1 test de
  régression ajouté (`usePlaylistLibrary.test.js`).
- **Dette technique — `.substr()` déprécié remplacé par `.slice()`** sur
  les 6 générateurs d'id du projet qui l'utilisaient encore
  (`usePlaylistLibrary.js`, `App.jsx` ×2, `musicEngine.js` ×3,
  `PlaylistDetailContext.jsx`) — comportement strictement identique
  (`substr(2, N)` ≡ `slice(2, N+1)`), aucun test cassé (aucun ne dépend du
  format exact d'un id généré, seulement de son unicité/préfixe).
- **Optimisation — `useSyncedCollection.js`, court-circuit par RÉFÉRENCE
  avant le `JSON.stringify` du diff de modification.** La comparaison
  `JSON.stringify(old) !== JSON.stringify(item)` (une par item, à CHAQUE
  `setState`) tournait pour TOUS les items de la collection à chaque
  changement, même pour ceux structurellement inchangés. Précédée
  maintenant d'un `old === item` (référence stricte) : audité sur les 27
  appels de `setSavedPlaylists`/`setRoutines` du projet — TOUS suivent le
  même pattern `.map(x => x.id === id ? {...x,...} : x)` (ou équivalent),
  qui préserve STRICTEMENT la référence de chaque item non modifié.
  Concrètement : une frappe dans le brouillon de description d'UNE
  playlist ne sérialise plus les N-1 AUTRES playlists de la collection.
  Le `JSON.stringify` en second temps reste inchangé, en filet de
  sécurité — un item reconstruit avec une NOUVELLE référence mais un
  contenu identique (cas qui ne se produit nulle part aujourd'hui, mais
  pourrait un jour venir d'un code qui ne préserve pas les références)
  continue d'être reconnu correctement comme "pas de changement réel",
  aucun contrat retiré. 1 test ajouté pour isoler le mécanisme lui-même
  (espionne `JSON.stringify`, vérifie qu'un item à référence inchangée ne
  lui est jamais passé) — `tests/hooks/useSyncedCollection.test.js`.
  ⚠️ Limite assumée, pas un oubli : une mutation EN PLACE d'un objet déjà
  en state (jamais fait par le vrai code du projet, voir l'audit) serait
  invisible au diff — mais c'était DÉJÀ le cas avant ce changement (par
  construction du hook, `prevById`/`nextById` sont dérivés de `prev`/
  `next` tels que reçus par `setState`, jamais d'un instantané pris
  séparément avant une éventuelle mutation) — pas une régression
  introduite ici.
- **Optimisation — `PlaylistsView.jsx` : même piège perf déjà corrigé dans
  `RoutinesView.jsx` (05/08), jamais généralisé à l'époque.** Trouvé en
  auditant le reste de l'app après le correctif `useSyncedCollection.js`
  du 07/08, exactement comme le veut l'habitude de travail établie sur ce
  projet ("à chaque bug trouvé, se demander où d'autre dans l'app"). Les
  filtres/tris (`visiblePlaylists`/`toPlan`/`planned`/`completedPlaylists`)
  tournaient sur CHAQUE rendu du composant (pas de `useMemo`) — y compris
  un rendu déclenché par `draggedId`/`plannedPage`/`completedPage` (state
  local sans rapport avec le CONTENU de `savedPlaylists`). Pire : le
  classement or/argent/bronze utilisait `playlistRanks.indexOf(playlist.id)`
  DANS la boucle `.map()` de `renderCard` — O(n) par carte, donc O(n²) sur
  toute la grille. Corrigé exactement comme `RoutinesView.jsx` :
  regroupés dans un seul `useMemo([savedPlaylists, isNaughtyMode])`,
  `playlistRanks` (tableau) remplacé par `playlistRankMap` (`Map` id →
  rang, O(1) par carte). Comportement strictement identique (même filtres,
  mêmes tris) — `getRankStyle`/`PlaylistCard.jsx` traitent déjà
  `undefined` (nouveau repli de `Map#get` pour une playlist non classée)
  exactement comme l'ancien `-1` d'`indexOf` (`rank >= 0 && rank < 3` :
  faux dans les deux cas), vérifié avant de livrer. Aucun test cassé
  (`getRankStyle` déjà mocké à `null` dans `PlaylistsView.test.jsx`,
  aucune assertion n'y dépend de la valeur exacte de `rank`) — même
  proportion d'effort de test que le correctif original de
  `RoutinesView.jsx`, qui n'avait pas non plus ajouté de test dédié pour
  ce mécanisme précis ("sans impact perceptible... mais correct par
  principe").
- **Optimisation (mineure) — `PlaylistHeader.jsx` : 3e occurrence du même
  pattern, trouvée en auditant `musicEngine.js` en profondeur (rien à y
  corriger, moteur déjà audité perf le 03/08) puis en continuant la
  recherche ailleurs comme demandé.** Calibrage honnête avant tout : ce
  cas-ci est nettement MOINS grave que les 2 précédents — un seul tri
  O(n log n), pas une boucle O(n²) sur une grille de cartes — mais le
  même gaspillage à chaque frappe. `currentPlaylistRank` retriait TOUTE
  la collection `savedPlaylists` à CHAQUE rendu de ce composant, y
  compris chaque frappe en train de renommer la playlist affichée ou
  d'éditer sa description (`editedPlaylistName`/`editedPlaylistDescription`,
  state local au Provider `PlaylistDetailContext.jsx`, inclus dans la
  valeur du Contexte — chaque frappe re-render donc TOUS les
  consommateurs, dont `PlaylistHeader.jsx` lui-même) — pour ne lire au
  final qu'UN SEUL rang. Corrigé : `useMemo([savedPlaylists,
  currentPlaylist.id])` — `savedPlaylists` (reçu en prop depuis App.jsx)
  reste référentiellement stable pendant la frappe (seul le state
  d'édition change, jamais la collection elle-même tant que l'édition
  n'est pas soumise), donc ce `useMemo` élimine bien tout recalcul
  pendant la frappe. Comportement strictement identique. Aucun test cassé
  (`PlaylistHeader.test.jsx`, "médaille de rang" : rendu simple, un seul
  passage, comportement du `useMemo` indiscernable de l'ancien calcul
  direct sur un premier rendu) — aucun test dédié ajouté, même
  proportion que les 2 correctifs précédents de cette famille.
- **Audit complémentaire (07/08, sur demande explicite : "les 3" —
  `musicEngine.js`, `useGeneratorForm.js`, `ProfileView.jsx`).**
  `musicEngine.js` relu en entier une 2e fois : rien à corriger — le seul
  point CPU-bound (boucle de sélection locale par segment) était déjà
  audité et corrigé le 03/08 ; tout le reste est dominé par la latence
  réseau Deezer (centaines de ms par appel), convertir les `.includes()`
  restants en `Set` n'aurait gagné que des microsecondes invisibles.
  `useGeneratorForm.js` lu en entier : aucun problème trouvé — état de
  formulaire, petites collections (genres, segments), rien qui opère sur
  des données volumineuses. `ProfileView.jsx` : déjà TRÈS bien mémoïsé
  avant cette session (cascade `useMemo` explicitement commentée pour
  protéger `useProfileSearchFilter.js` d'un recalcul à chaque frappe,
  lui-même déjà correctement scindé "enrichissement one-shot" vs "filtre
  reroulé à chaque frappe") — un seul point manqué : `sportSummary`/
  `intimateSummary` (via `summarizeSessions`, fonction pure exportée et
  testée isolément, volontairement pas touchée elle-même) recalculés en
  direct dans le corps du rendu à CHAQUE frappe de recherche, alors que
  `profile.sport_sessions`/`profile.intimate_sessions` ne changent
  jamais pendant la frappe. Corrigé (`useMemo` sur ces 2 champs précis,
  pas sur `profile` entier). Sévérité honnêtement calibrée : encore plus
  mineur que le correctif `PlaylistHeader.jsx` juste au-dessus — un seul
  passage `.forEach()` sur un tableau de séances, pas une boucle
  imbriquée. Aucun test cassé (`summarizeSessions` reste testée en
  isolation, indépendante de React).
- **BUG CORRIGÉ — retour direct, capture d'écran : "pourquoi je ne vois
  pas le compteur de clones sur les playlists de la vue Discover ?"**
  Sur la GRILLE Découvrir elle-même (`TemplateCard.jsx`), le compteur
  s'affiche déjà correctement — le trou était sur la fiche DÉTAIL d'un
  template ouvert DIRECTEMENT depuis Découvrir (pas via la vitrine
  `@tempofit_officiel`) : le badge de `PlaylistHeader.jsx` était gaté sur
  `isReadOnly`, posé sur l'hypothèse (05/08) que `cloneCount` ne serait
  JAMAIS défini quand `isReadOnly` est faux. Fausse : `TemplateCard.jsx`
  transmet bien un `cloneCount` réel à `onPlayTemplate` pour CE chemin
  aussi (`openCuratedPlaylist`, useNavigation.js) — seul le chemin
  vitrine (`handleOpenPublicPlaylist`, App.jsx) posait `isReadOnly: true`
  À CÔTÉ. Le nombre était donc déjà calculé et transporté jusqu'à
  `currentPlaylist.cloneCount`, juste jamais affiché sur ce chemin précis.
  ⚠️ Correctif naïf évité : forcer `isReadOnly: true` côté Découvrir
  direct aurait AUSSI fait basculer le bouton d'action principal vers
  "Sauvegarder"/`handleClonePlaylist` (au lieu de "Ajouter à Mes
  Séances"/`handleSavePlaylist`) — cassant la distinction VOLONTAIRE déjà
  documentée plus haut ("le clonage ne s'incrémente QUE via 'Cloner' sur
  un profil/la vitrine — jamais via 'Utiliser ce modèle' dans Découvrir").
  Corrigé en gatant le badge directement sur `currentPlaylist.cloneCount
  !== undefined` plutôt que sur `isReadOnly` — précis, ne touche à rien
  d'autre. Vérifié que `cloneCount` reste bien TOUJOURS `undefined` pour
  une génération fraîche ou une playlist déjà sauvegardée (y compris une
  copie clonée, voir le correctif `usePlaylistLibrary.js` plus haut qui
  le remet explicitement à `undefined`) — le nouveau gardien ne fait donc
  apparaître le badge que dans les cas où il a un sens. 1 test existant
  corrigé (encodait l'ancienne hypothèse fausse), 1 nouveau test ajouté
  qui reproduit exactement le chemin Découvrir direct.
  ✅ **Confirmé en conditions réelles (07/08)** — capture d'écran à
  l'appui : "Midnight Runner 160" (vrai template Découvrir) affiche
  désormais bien le badge de clonages sur sa fiche détail (build
  reconfirmé vert après un 1er repoussé incomplet).
- **NOUVELLE FONCTIONNALITÉ — étiquette "propriétaire actuel" cliquable,
  navigue vers le profil (07/08, retour direct, capture "TempoFit
  Officiel" à l'appui) : "cliquer sur le pseudo devrait amener à sa vue
  statistiques".** Précédent exact déjà en place ailleurs dans l'app
  (`TemplateCard.jsx`, auteur cliquable sur les cartes Découvrir,
  `hover:underline cursor-pointer`) — repris à l'IDENTIQUE ici plutôt que
  d'inventer une nouvelle convention visuelle, pour que "ceci est
  cliquable" porte la même signature partout. Nouveau champ
  `ownerProfileUsername` (PlaylistHeader.jsx), DISTINCT d'`ownerLabel` —
  ce dernier ne porte que la valeur D'AFFICHAGE ("TempoFit Officiel", en
  majuscules, jamais un vrai pseudo utilisable pour la navigation) ; le
  nouveau champ porte le pseudo TECHNIQUE réel (`OFFICIAL_VITRINE_USERNAME`,
  minuscules — importé d'`officialVitrineProfile.js`, PAS
  `OFFICIAL_VITRINE_DISPLAY_NAME` — ou `currentPlaylist.ownerUsername`
  tel quel pour une vraie playlist étrangère). Cliquable UNIQUEMENT dans
  la branche `!isSaved` (quelqu'un D'AUTRE a fait cette playlist) — le
  cas `isSaved` (TON PROPRE pseudo sur ta propre playlist sauvegardée)
  reste un simple texte inerte, ni demandé ni évidemment utile de le
  rendre cliquable. Nouvelle prop `onViewProfile`, câblée depuis
  `handleViewProfile` (App.jsx, déjà existante — même fonction que
  `SearchUsersModal.jsx`) à travers `PlaylistDetailView.jsx` →
  `PlaylistDetailViewInner` (2 niveaux de composants distincts dans ce
  fichier, chacun avec sa PROPRE destructuration de props — piège réel
  rencontré en implémentant : `tsc --checkJs` a immédiatement attrapé la
  variable manquante dans le mauvais scope) → `PlaylistHeader.jsx`.
  Défense en profondeur : sans `onViewProfile` fourni, l'étiquette reste
  un texte inerte plutôt qu'un clic mort (même raisonnement que
  `onViewOfficialProfile` dans TemplateCard.jsx). 4 tests ajoutés
  (`PlaylistHeader.test.jsx`) : clic sur la vitrine → pseudo technique
  correct ; clic sur un vrai propriétaire → son pseudo ; `isSaved=true` →
  jamais cliquable même si `onViewProfile` fourni ; `onViewProfile`
  absent → reste un `<p>`, pas un `<button>`.
  ⚠️ **Pas encore vérifié en conditions réelles** — même limite que
  d'habitude (bac à sable sans accès réseau), à confirmer au prochain
  build/clic réel.
- **`PublicRoutinePreviewModal.jsx` — message raccourci (07/08, retour
  direct, capture montrant 3 lignes : "tienne en 2 lignes max").**
  "Cette routine est partagée publiquement — tu peux la cloner dans tes
  propres Routines pour la relancer à ta façon, sans jamais modifier
  celle de son propriétaire." → "Routine partagée publiquement —
  clone-la dans tes Routines pour la relancer à ta façon, sans y
  toucher." (103 caractères). Même idée conservée (partage public,
  clonage = copie indépendante, jamais de modification de l'originale),
  longueur calée sur le message équivalent côté playlists
  (`ImportSharedPlaylistModal.jsx`, ~105 caractères) plutôt qu'une
  estimation à l'aveugle — cette modale-sœur n'avait jamais posé ce
  problème de débordement, donc viser la même longueur. Aucun test
  cassé (`PublicRoutinePreviewModal.test.jsx` ne dépend pas du texte
  exact).
- **REFONTE UI — pseudo + compteur de clonages regroupés au-dessus du
  titre, sur les 3 endroits concernés (07/08, retour direct, capture
  annotée : "mettre les pseudos avant le nom de la playlist, et le
  compteur de clones, sur la même ligne" — puis confirmation explicite
  pour étendre aux cartes Découvrir ET à Mes Séances).** AVANT : pseudo et
  compteur de clonages vivaient à 2 endroits physiquement déconnectés
  (pseudo sous la pochette/après le titre, compteur à côté du titre/sur
  une 3e ligne) alors qu'ils décrivent la même famille d'info (qui a fait
  cette séance, quel accueil elle a eu). Pattern déjà éprouvé ailleurs
  (Spotify, "Playlist par X" au-dessus du gros titre) — appliqué de façon
  cohérente aux 3 surfaces concernées :
  - **`PlaylistHeader.jsx`** (fiche détail) — étiquette propriétaire
    (`ownerLabel`) déplacée de sous la pochette vers une nouvelle ligne
    "chapeau" au-dessus du titre, fusionnée avec le compteur de clonages
    (retiré de son ancien emplacement à côté du titre). Logique
    inchangée (cliquable ou non, gating `cloneCount !== undefined`,
    historique du bug `isReadOnly` du même jour) — seul l'EMPLACEMENT
    bouge, conservé dans les commentaires de la nouvelle ligne pour ne
    pas perdre ce contexte.
  - **`TemplateCard.jsx`** (cartes Découvrir) — même déplacement (auteur
    + compteur au-dessus du titre). `avgBpm` (qui vivait sur l'ancienne
    ligne auteur) déménagé sur la ligne de métadonnées (avec
    workoutType/durée) — même distinction "composition de la séance" vs
    "accueil social" déjà appliquée dans PlaylistHeader.jsx. ⚠️ Piège
    trouvé en implémentant : envelopper l'auteur NON cliquable dans un
    `<span>` (comme la 1re version de ce correctif le faisait) aurait créé
    une collision avec le badge "officiel" en coin (lui aussi un `<span>`
    au texte EXACT "TempoFit" pour un template officiel) — 2 éléments
    identiques, ambigu pour les tests ET pour tout outil d'accessibilité
    qui s'appuierait sur le texte. Corrigé : l'auteur non cliquable reste
    en texte brut (comme avant ce chantier), seul le cas CLIQUABLE
    (`<button>`) a besoin d'un élément dédié. 2 tests existants réécrits
    (le BPM n'est plus "à côté de l'auteur" ; le `<p>` auteur contient
    désormais aussi le compteur, cassant un match exact), 1 nouveau test
    qui vérifie l'ordre réel dans le DOM (la vraie demande, pas juste "les
    deux existent quelque part sur la carte").
  - **`PlaylistCard.jsx`** (Mes Séances, TES PROPRES playlists) — nouvelle
    ligne "chapeau" avec TON pseudo (`username`, repli "Invité" — même mot
    que PlaylistHeader.jsx pour ce même état), pour la cohérence visuelle
    (confirmé explicitement, alors que ce n'était pas la demande
    d'origine). PAS cliquable (naviguer vers son propre profil depuis sa
    propre carte n'a pas de sens évident, même raisonnement déjà appliqué
    au pseudo dans PlaylistHeader.jsx) et PAS de compteur de clonages
    (`cloneCount` n'existe conceptuellement que pour un aperçu en lecture
    seule — TOUJOURS `undefined` une fois la playlist dans "Mes Séances",
    voir le correctif `usePlaylistLibrary.js` plus haut). `username`
    câblé App.jsx → PlaylistsView.jsx → PlaylistCard.jsx (nouvelle prop,
    3 fichiers touchés). 3 nouveaux tests ajoutés.
  **Exception délibérée, PAS traitée** : `PublicItemCard`
  (`ProfileView.jsx`, grille du profil de quelqu'un) — pas de byline
  ajoutée là, l'en-tête de la page dit déjà "@pseudo" en haut, un rappel
  par carte serait redondant. Vérifié avec l'utilisateur avant de ne rien
  faire plutôt que supposé.
  ✅ **Build Vercel corrigé (07/08)** — 1er build cassé (2 tests sur 1055 en
  échec, `PlaylistHeader.test.jsx`) : la balise du pseudo NON cliquable
  était passée de `<p>` à `<span>` pendant ce chantier (plus logique dans
  la ligne flex qui regroupe désormais pseudo + compteur), mais 2 tests
  vérifiaient encore l'ancienne balise (`tagName).toBe('P')`). Corrigés
  (`tagName).toBe('SPAN')`) — vrai oubli de ma part en écrivant ces tests,
  pas un bug du composant lui-même (déjà correctement `<span>` dans le
  code livré). Build reconfirmé vert depuis. Toujours PAS vérifié en
  conditions réelles au-delà des tests (même limite habituelle, bac à
  sable sans accès réseau) — à confirmer au prochain clic réel sur l'app
  déployée.
  ✅ **AJUSTEMENT (07/08, retour direct après essai réel, capture à
  l'appui) — pseudo RETIRÉ de `PlaylistCard.jsx` (Mes Séances).** "Pas la
  peine de mettre le nom d'utilisateur" — en conditions réelles, la ligne
  "chapeau" ajoutée plus tôt dans cette même session s'est révélée
  redondante par construction (TOUJOURS le même pseudo, sur CHAQUE carte
  de cette vue) et tronquait en plus visuellement le titre juste à côté
  ("tempofit_..." répété identique sur toutes les cartes, capture à
  l'appui). Retiré proprement : `username` déplombé (`App.jsx` →
  `PlaylistsView.jsx` → `PlaylistCard.jsx`, 3 fichiers), 3 tests obsolètes
  supprimés, 1 test de non-régression ajouté (même si `username` est
  repassé par erreur, la carte ne doit plus jamais l'afficher). La
  convention "pseudo au-dessus du titre" reste appliquée aux 2 autres
  endroits où le pseudo identifie un propriétaire potentiellement
  DIFFÉRENT de soi (`PlaylistHeader.jsx`, `TemplateCard.jsx`) — inchangés,
  ce chantier ne concernait QUE la vue "Mes Séances".
- **BUG CORRIGÉ — retour direct, capture annotée : "pour simplifier le
  partage il faut que le texte du lien de partage de profil soit
  sélectionnable à la souris"** (`SettingsView.jsx`, bloc "Confidentialité
  & Profil Public"). Cause : `body { user-select: none }` (`index.css`,
  décision globale VOLONTAIRE, déjà documentée — l'app se veut "native",
  pas un document qu'on sélectionne) désactive la sélection PARTOUT par
  défaut, réactivée jusqu'ici seulement sur les champs de saisie
  (`input`/`textarea`/`[contenteditable]`). Le texte du lien
  (`tempofit.app/?profile={username}`) n'est ni l'un ni l'autre — texte
  d'AFFICHAGE, jamais un champ de saisie — donc restait insélectionnable
  malgré les apparences. ⚠️ Piège déjà documenté ailleurs dans ce même
  fichier CSS (curseur de `<input type="range">`, 04/08) et retrouvé ici à
  l'identique : une classe Tailwind seule (`select-text`) posée
  directement sur l'élément n'aurait RIEN changé — la règle `body` vit
  hors de tout `@layer` Tailwind, donc bat toujours les classes Tailwind
  par les règles des Cascade Layers CSS, quelle que soit leur spécificité.
  Corrigé à la racine, pas contourné composant par composant : nouvelle
  classe **`.selectable-text`** (`index.css`, même règle non-layée que le
  correctif input déjà en place) — réutilisable ailleurs si un futur
  besoin similaire apparaît (un autre lien/code technique à copier), sans
  affaiblir le comportement "app native" pour tout le reste du texte de
  l'app. Appliquée à ce lien précis. 1 test ajouté
  (`SettingsView.test.jsx`) vérifiant la classe.
- **AMÉLIORATION — bouton "Copier le lien" ajouté au lien de profil
  (08/08, retour direct : "je regrette que tu aies pas décelé avant cette
  meilleure option, je veux que tu le fasses systématiquement en
  proposant mieux si tu as en me demandant validation").** Nouvelle
  **habitude de travail actée** suite à ce retour — voir
  `CLAUDE-SANDBOX-VERIFICATION.md`, section dédiée en tête du fichier.
  Le correctif "texte sélectionnable" ci-dessus répondait littéralement à
  la demande, mais le vrai besoin ("simplifier le partage") est mieux
  servi par un vrai bouton copier — un clic, confirmation visuelle
  immédiate, bien plus fiable sur mobile qu'une sélection manuelle de
  texte étroit collé dans une phrase.
  ⚠️ **Incohérence trouvée en implémentant** : DEUX versions différentes
  de "copier dans le presse-papier" coexistaient déjà dans le projet —
  `copyRedirectUri` (SettingsView.jsx, existant) : `navigator.clipboard`
  SEUL, échec silencieux, aucun repli ; `copyToClipboard` (`useShare.js`,
  existant) : `navigator.clipboard` en priorité, repli `execCommand` SI
  indisponible, ET vérifie la valeur de retour d'`execCommand` (un vrai
  bug avait déjà été corrigé là-dessus le 31/07 — peut échouer
  silencieusement sans lever d'exception). Nouveau **`src/utils/clipboard.js`**
  (`copyTextToClipboard`) — centralise la version ROBUSTE de `useShare.js`
  plutôt que de repartir sur la version fragile de `copyRedirectUri` par
  accident, ou d'ajouter une 3e implémentation différente. `useShare.js`
  **volontairement PAS retouché** dans la foulée (couplé à
  `shareData`/`closeModal`/`showToast`, un vrai refactor, pas juste un
  remplacement d'appel) ni `copyRedirectUri` (même raison — les deux
  restent signalés comme candidats à une future harmonisation, PAS faits
  sans validation explicite, conformément à la nouvelle habitude
  ci-dessus).
  Bouton posé dans une boîte `<code>` + icône copier/coche, MÊME
  signature visuelle que le bloc "URL Spotify" déjà présent plus bas dans
  ce même fichier — pas un style inventé pour la même idée. Le texte
  reste `selectable-text` EN PLUS du bouton (la sélection manuelle
  continue de marcher pour qui la préfère). State `profileLinkCopied`
  DÉDIÉ, séparé de `copied`/`copyRedirectUri` (2 boutons "copier"
  indépendants sur cette même page — partager le state aurait fait
  clignoter le mauvais bouton). Tests ajoutés :
  `tests/utils/clipboard.test.js` (nouveau, 1er fichier de test de cet
  utilitaire — 5 cas dont le repli `execCommand` et son piège de retour
  silencieux) + 1 test dans `SettingsView.test.jsx` (clic → bon texte
  copié → coche affichée).
- **HARMONISATION — les 2 implémentations "copier dans le presse-papier"
  signalées ci-dessus, mais volontairement pas touchées, ONT FINALEMENT
  ÉTÉ unifiées (08/08, retour direct immédiat : "faut pas que tout soit
  le même ?").** En revérifiant les tests existants avant de trancher,
  le refactor s'est révélé bien MOINS risqué que redouté au moment du
  1er correctif — les deux suites de tests concernées vérifient déjà un
  comportement OBSERVABLE (toast affiché, modale fermée, `<textarea>`
  bien retiré du DOM, texte transmis au presse-papier), jamais un détail
  d'implémentation interne — un vrai signal que le refactor était sûr,
  vérifié avant d'agir plutôt que supposé.
  - **`useShare.js`, `copyToClipboard`** — la logique presse-papier
    elle-même (essai `navigator.clipboard`, repli `execCommand`,
    vérification de sa valeur de retour) déléguée à
    `copyTextToClipboard` (`clipboard.js`) ; ce qui reste ICI est
    seulement ce qui est spécifique à ce hook (construction du texte
    depuis `shareData`, fermeture de la modale, message exact du toast).
    Les 5 tests existants de `useShare.test.js` passent sans
    modification — confirmé AVANT de livrer, pas après coup.
  - **`SettingsView.jsx`, `copyRedirectUri`** — migré sur
    `copyTextToClipboard` (avant : `navigator.clipboard` seul, échec
    silencieux `.catch(() => {})`, aucun repli, aucun retour utilisateur
    en cas d'échec réel — exactement la version FRAGILE identifiée dans
    le correctif précédent). Message d'erreur ajouté au passage (absent
    avant, jamais aucun retour possible en cas d'échec) — cohérence avec
    `copyProfileLink` et `useShare.js`. 1 nouveau test ajouté
    (`SettingsView.test.jsx`) qui vérifie précisément ce nouveau message
    d'erreur, absent avant ce chantier.
  Résultat : **une seule implémentation** de "copier dans le
  presse-papier" dans tout le projet (`src/utils/clipboard.js`), utilisée
  par les 3 boutons "copier" existants (redirect URI Spotify, lien de
  profil public, partage de playlist/trophée) — plus aucune version
  fragile qui traîne, plus aucun risque d'en copier une par accident pour
  un futur 4e bouton.
  ⚠️ **Correctif PAS ENCORE vérifié en conditions réelles** — trouvé et
  livré dans cette session, mais pas encore déployé/testé sur l'app en
  prod au moment d'écrire ceci (retour direct de l'utilisateur : "je
  vérifie d'abord ton correctif" avant d'aller plus loin). Prochaine
  étape avant tout nouveau chantier sur ce sujet : confirmer qu'un VRAI
  template Découvrir (ex. "Midnight Runner 160", capture d'écran à
  l'appui dans cette session) affiche bien le badge une fois ce fichier
  poussé sur GitHub.
  ⚠️ **Question ouverte, mise en pause à la demande explicite de
  l'utilisateur ("note-toi la question pour plus tard")** : la playlist
  de démo locale (`playlist-example-1`, "Exemple : Session Rock/Métal",
  définie en dur dans `App.jsx`) devrait-elle AUSSI donner l'illusion
  d'avoir été générée par le faux compte vitrine "TempoFit Officiel", et
  afficher un compteur de clonages ? Contrairement aux vrais templates
  Découvrir corrigés ci-dessus, cette playlist n'est PAS backée par
  `curatedSessions.js`/`template_clone_counts` — elle est déjà "à
  l'utilisateur" dès l'inscription (renommable/supprimable, voir
  `App.jsx`). Tension identifiée avec le principe déjà acté ailleurs dans
  ce fichier ("le compteur de clonage doit être honnête, 0 par défaut,
  jamais un nombre inventé" — décision qui avait déjà fait annuler une
  1re implémentation avec des chiffres "ambitieux mais faux", voir plus
  bas dans ce README). 3 pistes proposées à l'utilisateur, aucune tranchée
  pour l'instant : (1) lier cette playlist à un VRAI template Découvrir
  existant/à créer (compteur honnête, mais demande plus de travail) ;
  (2) une entrée dédiée dans `template_clone_counts` pour ce cas précis,
  réelle mais qui démarrerait à 0 ; (3) afficher honnêtement 0 sans rien
  changer côté données. **À reprendre une fois le point ci-dessus (badge
  sur un vrai template) confirmé en conditions réelles** — pas commencé.
- **Dette corrigée — les données restaient dans localStorage après
  déconnexion, sur un appareil partagé le compte suivant pouvait les VOIR
  ET LES MODIFIER.** Connue et documentée de longue date (voir la
  docstring historique de `usePersistentState.js`), mais sous-estimée :
  la doc parlait d'un compte suivant qui verrait ces données "un court
  instant avant que son propre pull ne les remplace" — ça suppose qu'il
  se CONNECTE. S'il reste en mode invité (plausible sur un appareil
  partagé), il voyait — et pouvait modifier — les données de la personne
  précédente **indéfiniment**, jamais juste un instant. Corrigé :
  `signOut()` (AuthContext.jsx) appelle désormais `clearLocalCache()`
  (nouveau, `src/utils/localCache.js`) — vide tout le cache localStorage
  TempoFit (`tempofit:*`) de cet appareil, APRÈS
  `supabase.auth.signOut()` (si la déconnexion réseau échoue, le cache
  local n'est pas vidé pour rien). Safe par construction, aucune perte de
  donnée : au moment du `signOut()`, tout changement local a déjà été
  poussé vers Supabase en tâche de fond (`usePersistentState.js`/
  `useSyncedCollection.js`) — vider le cache oblige juste un vrai re-pull
  réseau à la prochaine connexion. `deleteAccount` en bénéficie
  automatiquement (il appelle déjà `signOut()` en interne) — logique,
  supprimer son compte doit *a fortiori* nettoyer le cache local.
  Occasion prise de centraliser `STORAGE_PREFIX` (`'tempofit:'`), trouvée
  dupliquée à l'identique dans `usePersistentState.js` ET
  `useSyncedCollection.js` — même raisonnement que les autres constantes
  déjà extraites du projet une fois une duplication confirmée (voir
  CLAUDE-SANDBOX-VERIFICATION.md §4sexies). Tests ajoutés :
  `tests/utils/localCache.test.js` (nouveau, 1er fichier de test de cet
  utilitaire) + 1 test dans `tests/contexts/AuthContext.test.jsx` (vrai
  `window.localStorage` de jsdom, vérifie qu'une clé étrangère au même
  domaine n'est jamais touchée).

# TempoFit — Historique détaillé, bloc 3 (08/08 fin + 10/08, chantiers UI/perf/bugs)

⚠️ Complément d'archive au bloc 2 ci-dessus — même principe (voir l'en-tête
de ce fichier) : récit chronologique COMPLET extrait tel quel de la
section "État d'avancement" du README, aucun contenu réécrit, au moment de
l'élagage du 10/08, quand cette section a de nouveau dépassé la longueur
raisonnable pour une lecture d'entrée de session (une vingtaine de
chantiers enchaînés en une seule session, la plus longue à ce jour).

---

✅ **SESSION DU 10/08 (suite) — retour direct, MÊME SESSION que les chantiers précédents sur ce compteur : "par cohérence on devrait aussi voir le même compteur dans Mes Séances, à côté du bouton Marquer comme faite".**

**Ajouté à `PlaylistCard.jsx`** (utilisée par les 3 sections de "Mes Séances") — même badge, même philosophie que `PlaylistHeaderBadges.jsx` (toujours affiché, `|| 0` en repli honnête). Pas de condition `isSaved` à vérifier ici contrairement à la fiche détail : cette carte n'est utilisée QUE pour des playlists déjà sauvegardées, par construction.

**Généralisation faite avant de livrer** : cette carte a 2 mises en page JSX INDÉPENDANTES selon `isCompleted` (bouton "Marquer comme faite" vs pilule "Faite Nx") — le badge a été ajouté aux DEUX, pas seulement à celle demandée dans le retour direct, sinon il aurait disparu dès qu'une séance est marquée comme faite.

Tests : nouveau describe dédié dans `tests/views/PlaylistCard.test.jsx` (aucun test n'existait avant pour ce badge) — 4 tests couvrant les 2 mises en page, une vraie valeur, et le cas `cloneCount` jamais défini (doit quand même afficher "0").

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite) — retour direct, MÊME SESSION que les chantiers précédents sur ce compteur : "j'ai changé d'avis, il faut le compteur de clonages pour les séances même en mode invité, pas grave si ce sera toujours à 0 — cohérence visuelle + les invités voient que la fonctionnalité existe".**

**Changement de philosophie assumé** : jusqu'ici, le badge était gaté sur `cloneCount !== undefined` — absent pour toute playlist où cette valeur n'avait jamais été posée (typiquement une playlist générée puis sauvegardée directement, jamais passée par Découvrir). Désormais : `(isSaved || cloneCount !== undefined)` — toute playlist "à toi" (Mes Séances, connecté OU invité) affiche SYSTÉMATIQUEMENT le badge, avec `|| 0` en repli honnête plutôt qu'un calcul. Le cas "pas encore sauvegardé" (template/playlist étrangère en lecture seule) garde l'ancienne condition, inchangé — ces cas ont de toute façon presque toujours `cloneCount` déjà posé à l'ouverture.

Tests : 1 test devenu obsolète par ce changement VOLONTAIRE (dépendait implicitement du défaut `isSaved: true` de son helper pour tester "rien affiché" — `isSaved: false` ajouté explicitement pour continuer à tester le vrai cas visé). 1 nouveau test confirmant le cœur du retour direct : `isSaved` + `cloneCount` jamais défini → affiche "0" quand même.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite) — retour direct avec 4 captures d'écran, MÊME SESSION que les chantiers précédents sur ce compteur : "quand je l'ajoute à Mes Séances il n'y a plus le compteur de clones ?" — 2e chemin de sauvegarde qui l'effaçait, distinct de celui déjà corrigé.**

**2 chemins de sauvegarde différents dans `PlaylistHeaderActions.jsx`**, pas un seul : `handleSavePlaylist` ("Ajouter à Mes Séances", playlist pas en lecture seule) préservait déjà `cloneCount` (spread simple). `handleClonePlaylist` ("Sauvegarder dans mes séances", playlist en VRAIE lecture seule — `isReadOnly: true`) l'effaçait explicitement (`cloneCount: undefined`), décision prise le 07/08 EN MÊME TEMPS que le reset de `user_id`/`ownerUsername` — les 3 traités à tort comme la même famille de champ à l'époque.

**Pourquoi c'était une fausse bonne idée** : `user_id`/`ownerUsername` sont des identifiants de PROPRIÉTÉ — les garder ferait traiter à tort la copie comme encore possédée par quelqu'un d'autre, un vrai risque de logique. `cloneCount` n'est qu'un chiffre d'affichage (déjà établi 2 fois aujourd'hui, `removeSavedPlaylist`/`PlaylistHeaderBadges.jsx`) — le réinitialiser ne protégeait rien, ça faisait juste disparaître le badge sur la copie fraîchement créée.

**Correctif** : `cloneCount: undefined` retiré de l'objet `cloned` — hérite désormais du spread `...currentPlaylist`, comme `handleSavePlaylist` le fait déjà. `user_id`/`ownerUsername` restent réinitialisés (correctif du 07/08 toujours valide, sans rapport).

Tests : le test existant (07/08) qui vérifiait `cloneCount === undefined` après clonage a été scindé en 2 nouveaux tests reflétant le nouveau comportement voulu — `cloneCount` survit (valeur réelle) ET `cloneCount` `undefined` sur l'original se propage tel quel (pas de faux 0 inventé) — le test original conservé pour `user_id`/`ownerUsername` seuls.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite) — retour direct, MÊME SESSION que les 2 déplacements précédents du pseudo/compteur de clonages : "quand c'est mon propre pseudo, ramener vers Mes Séances, connecté ou invité, avec un avertissement avant".**

**Discussion AVANT implémentation** (le chantier touchait 3 fichiers avec câblage de prop sur 3 niveaux — plus gros que les retouches CSS précédentes) : l'avertissement envisagé au départ a été discuté puis abandonné, des deux côtés (connecté ET invité) — voir la docstring de `PlaylistHeaderMeta.jsx` pour le raisonnement complet ("aucun risque réel pour un compte connecté ; pour l'invité, le seul vrai risque — données non synchronisées — est déjà rappelé en PERMANENCE par `GuestModeBar.jsx`, pas la peine de le répéter sur ce clic précis alors qu'aucune autre navigation de l'app ne le fait, y compris '← Retour' qui fait exactement le même trajet").

**Implémentation** : `changeView` (déjà disponible dans `PlaylistDetailView.jsx`) enfilé à travers `PlaylistHeader.jsx` jusqu'à `PlaylistHeaderMeta.jsx`. Le pseudo affiché en `<span>` (ton PROPRE pseudo, connecté ou "Invité") devient un `<button>` — même style que le pseudo cliquable vers le profil d'un AUTRE utilisateur (souligné en permanence, pas juste au survol — voir l'entrée juste en dessous). 3 branches désormais : profil d'un autre utilisateur (inchangé) → ton propre pseudo (`isSaved`, nouveau : `changeView('playlists')`) → texte simple non cliquable (cas défensif résiduel, `onViewProfile` manquant).

Tests : 2 tests existants mis à jour — l'un testait explicitement "PAS cliquable" (comportement inversé, réécrit), l'autre dépendait IMPLICITEMENT de la valeur par défaut d'`isSaved` dans son helper de test pour atteindre la bonne branche (cassé par le nouveau découpage en 3 branches, corrigé en fixant `isSaved: false` explicitement — le vrai edge case qu'il visait ne peut de toute façon se produire qu'à `isSaved: false` en pratique). 2 nouveaux tests (pseudo réel + "Invité", les deux vérifiant l'absence de tout avertissement).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle. Identité des fichiers de test touchés vérifiée explicitement (suite à l'incident du build précédent).

✅ **SESSION DU 10/08 (suite) — retour direct avec capture d'écran, MÊME SESSION que le déplacement précédent : "le compteur de clonages, je le veux davantage sur la même ligne que le bouton public/corbeille, à leur gauche ; laisse le pseudo où il est, dans les métadonnées c'est très bien".**

**2e déplacement du compteur de clonages en une session** — d'abord sorti de `PlaylistHeaderTitleBlock.jsx` vers `PlaylistHeaderMeta.jsx` (avec le pseudo, voir l'entrée juste en dessous), maintenant SÉPARÉ du pseudo pour rejoindre `PlaylistHeaderBadges.jsx` (rangée d'icônes flottante en haut à droite : cadenas "Lecture seule" OU boutons publique/retirer, selon `isSaved`). Le pseudo, lui, reste bien dans les métadonnées, inchangé.

**Point technique important** : le cadenas et les boutons publique/retirer étaient jusqu'ici 2 conteneurs `absolute top-4 right-4` SÉPARÉS, mutuellement exclusifs sur `isSaved`. Fusionnés en UN SEUL conteneur flex ici — nécessaire pour que le compteur de clonages (INDÉPENDANT de `isSaved`, peut apparaître aux 2 côtés) se positionne proprement à gauche de celui des deux qui s'affiche, sans dupliquer sa propre position.

Tests : les 3 tests cloneCount + le test "gaté sur ownerLabel" (devenu obsolète, cloneCount n'est plus attaché à ownerLabel du tout) déplacés de `PlaylistHeaderMeta.test.jsx` vers `PlaylistHeaderBadges.test.jsx`, remplacés par 2 nouveaux tests plus ciblés couvrant le vrai point de ce déplacement : le compteur reste affiché aussi bien à côté du cadenas (isSaved=false) qu'à côté de Globe/Trash2 (isSaved=true), et reste seul si isReadOnly masque les 2 autres. 1 test de non-régression ajouté à `PlaylistHeaderMeta.test.jsx` (cloneCount n'a plus aucun effet là-bas).

⚠️ **Retouche visuelle immédiate (retour direct, capture à l'appui)** : le fond gris (`bg-slate-800/80 border border-slate-700 rounded-full`) hérité de son ancien emplacement retiré du badge compteur de clonages — texte + icône seuls désormais, cohérent avec le style "juste une info" plutôt que "bouton/statut" des badges Lecture seule/Globe/Trash2 juste à côté.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle. Vérification supplémentaire faite cette fois (suite à l'incident du build précédent, contenu erroné sous le nom `PlaylistHeaderTitleBlock.test.jsx`) : chaque fichier de test touché importe bien le sujet correspondant exactement à son propre nom de fichier.

✅ **SESSION DU 10/08 (suite) — retour direct avec capture d'écran : "supprimer la ligne pseudo au-dessus du titre de playlist, l'intégrer comme 1re info de la ligne de métadonnées à la place".**

**Déplacé, pas juste retiré** : la ligne pseudo + compteur de clonages vivait dans `PlaylistHeaderTitleBlock.jsx`, sur sa propre ligne au-dessus du titre — déplacée dans `PlaylistHeaderMeta.jsx`, en 1er élément de la ligne d'infos (icône `User`, séparateur "•" avant "Course à pied"). Le compteur de clonages (icône `Copy` + nombre) a suivi le pseudo au même endroit — **la consigne ne parlait QUE du pseudo, mais les deux vivaient dans le même bloc conditionnel `ownerLabel &&` : les dissocier aurait fait disparaître le compteur de l'écran**, signalé explicitement à l'utilisateur avant d'implémenter plutôt que tranché silencieusement.

Le calcul d'`ownerLabel`/`ownerProfileUsername` (branches isSaved/username/sourceTemplateId/ownerUsername) reste identique, dans `PlaylistHeader.jsx` — seule la CIBLE à qui ces valeurs sont transmises a changé (Meta au lieu de TitleBlock).

Tests : 6 tests déplacés de `PlaylistHeaderTitleBlock.test.jsx` vers `PlaylistHeaderMeta.test.jsx` (comportement identique, nouveau composant hôte) + 1 nouveau test (`cloneCount` défini mais `ownerLabel=null` : le compteur reste caché, tout le 1er item est gaté sur `ownerLabel`). `PlaylistHeader.test.jsx` mis à jour : le stub `title-block-mock` ne reçoit plus `ownerLabel`/`ownerProfileUsername`, `meta-mock` les reçoit désormais — les 5 assertions de calcul déplacées vers ce mock, le calcul lui-même non re-testé (déjà couvert, inchangé).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite) — chantier "GeneratorWizard, redondance étape 2/étape 3" DÉCOUPÉ EN PLUSIEURS PASSES (retour direct, "je veux le truc le plus sécurisé possible") — 1re passe livrée : retrait du bloc durée/distance dupliqué à l'étape 3.**

**Constat de départ** (captures à l'appui) : `<TargetModeInputs>` (durée/distance) était affiché À L'IDENTIQUE à l'étape 2 ET à l'étape 3 (Constant/Crescendo) — même composant, mêmes champs, éditable aux deux endroits, sur le MÊME state (`hours`/`minutes`/`distanceVal`...). Vérifié avant de toucher au code : pour Crescendo/Fractionné, la durée totale reste lisible indirectement via la durée concrète de chaque segment affiché — aucun trou d'info. Pour Allure Constante (aucun segment), l'étape 3 ne montre plus AUCUN repère de durée après ce retrait — **compromis accepté explicitement avec l'utilisateur**, pas découvert après coup.

**1re passe livrée** :
- `<TargetModeInputs>` retiré de l'étape 3 (reste uniquement à l'étape 2, où la cible se règle désormais UNE SEULE fois).
- `isTopLevelTargetInvalid` simplifié : ne vérifie plus QUE `wizardStep === 2` — la cible ne pouvant plus jamais changer après cette étape, la revalider à l'étape 3 n'avait plus de sens. `step3ShowsTargetInputs` (son unique usage) supprimée avec.
- 1 test existant, devenu obsolète par ce changement de comportement VOLONTAIRE (`tests/views/GeneratorWizard.test.jsx`, "Suivant... est aussi désactivé si la cible redevient invalide"), mis à jour pour vérifier le NOUVEAU comportement plutôt que contourné ou supprimé. 3 nouveaux tests ajoutés (Constant Temps/Distance + Crescendo) confirmant le retrait.

**2e passe LIVRÉE (10/08, même jour)** : pour l'Allure Constante spécifiquement (seule concernée — Crescendo/Fractionné inchangés), le slider BPM (`renderTargetBpmBlock()`, extrait en fonction partagée pour éviter de le dupliquer entre les 2 emplacements où il vit maintenant — même souci que celui corrigé à la 1re passe pour `<TargetModeInputs>`) fusionné avec la sélection de genre de l'étape 4. Ce mode compte désormais **3 étapes, pas 4** — l'étape 3 n'existe plus DU TOUT pour lui.

Implémentation : `wizardStep` GARDE ses valeurs numériques habituelles (1/2/3/4, pas de renumérotation interne) — seule la NAVIGATION change : `goToNextWizardStep()` saute directement de 2 à 4 en Allure Constante (`wizardStep + 1` sinon, inchangé pour Crescendo/Fractionné) ; `goToPreviousWizardStepFromStep4()` revient à 2 pour ce mode (à 3 sinon, inchangé). Seul l'AFFICHAGE traduit ce saut en un compte cohérent pour l'utilisateur : `totalWizardSteps` (3 ou 4) et `displayWizardStep` (recale `wizardStep === 4` en "3" pour ce mode uniquement) pilotent la barre de progression et le libellé "Étape X / N" — sans ces 2 valeurs calculées séparément, l'utilisateur aurait vu "Étape 4 / 3" à l'écran final, incohérent.

Tests : 3 tests existants devenus obsolètes par ce changement VOLONTAIRE de comportement (`tests/views/GeneratorWizard.test.jsx` — "Étape 1 / 4", "Suivant (étape 2) → setWizardStep(3)", "Retour aux réglages → setWizardStep(3)"), mis à jour pour vérifier le NOUVEAU comportement en Allure Constante, chacun accompagné d'un test JUMEAU confirmant explicitement que Crescendo/Fractionné restent inchangés (pas juste supposé). 4 nouveaux tests sur le bloc BPM à l'étape 4 (présent en Constant, absent en Crescendo/Fractionné, interaction du slider).

✅ **CONFIRMÉ EN CONDITIONS RÉELLES (build Vercel)** — 2 échecs RÉELS détectés (les seuls de toute cette session, malgré tous les correctifs précédents "vérifiés" par lecture + outils statiques uniquement) : `tests/views/GeneratorWizard.test.jsx`, "déplacer la marge d'erreur (tolérance BPM)" et "le curseur Fondu enchaîné" — tous deux à l'étape 4, contexte de test par défaut (`structureMode: 'constant'`).

**Cause** : ces 2 tests sélectionnaient leur slider par INDEX BRUT (`sliders[0]`/`sliders[1]`, via `querySelectorAll`) — avant la 2e passe du jour, l'étape 4 ne contenait que 2 sliders (tolérance BPM, fondu enchaîné), donc sans ambiguïté. Depuis, en Allure Constante (le mode par défaut de ces tests), un 3e slider (BPM, `renderTargetBpmBlock()`) est apparu EN PREMIER dans le DOM — décalant les 2 index d'un cran. Repéré uniquement par le build réel : ma propre recherche généralisée avant livraison n'avait vérifié QUE les assertions basées sur du texte (`getByText`/`queryByText`), pas les sélections par index positionnel — angle mort réel, pas anticipé.

**Correctif** : plutôt que de corriger les index en dur (fragile — recasserait pareil au prochain slider ajouté à cette étape), les 2 tests basculent sur `structureMode: 'crescendo'` — tolérance BPM/fondu enchaîné existent quel que soit le mode de structure (réglages génériques), donc tester avec un mode où le nouveau slider BPM ne s'affiche PAS à l'étape 4 restaure les index d'origine, sans dépendre d'un compte de sliders qui varie désormais selon le mode.

⚠️ **Leçon pour la suite** : quand un nouvel élément est inséré dans une étape déjà couverte par des tests, généraliser la recherche de régression aux sélecteurs POSITIONNELS (`querySelectorAll(...)[n]`, `container.children[n]`...) de cette même étape, pas seulement au texte affiché — les deux catégories peuvent casser indépendamment l'une de l'autre.

✅ **SESSION DU 10/08 (suite, 8e trouvaille — retour direct avec captures à l'appui, bug DIFFÉRENT de la famille "course asynchrone" des 7 précédentes) — le badge de compteur de clonages disparaissait après avoir retiré une playlist-template de "Mes Séances".**

**Le mécanisme** : le badge (`PlaylistHeaderTitleBlock.jsx`) est gaté sur `currentPlaylist.cloneCount !== undefined` — pas recalculé dynamiquement, juste un champ posé explicitement au bon moment. `openCuratedPlaylist` (`useNavigation.js`) accepte un 2e paramètre `extraFields` pour ça — 3 appelants dans tout le projet, 2 corrects (`App.jsx`/`TemplateCard.jsx`, tous deux fusionnent déjà `{ isReadOnly: true, isPublic: true, cloneCount }`), un seul oublié : `removeSavedPlaylist` (`usePlaylistLibrary.js`), qui restaure le template pristine après un retrait de "Mes Séances" en appelant `openCuratedPlaylist(originalTemplate)` SANS 2e argument — le template restauré repartait d'un objet flambant neuf, sans `cloneCount`/`isReadOnly`/`isPublic`.

**Correctif** : `cloneCount` repris directement depuis `currentPlaylist.cloneCount` (la copie qu'on retire l'a elle-même hérité au moment de sa sauvegarde, `handleSavePlaylist` spreads `{...currentPlaylist}` — jamais perdu depuis, aucune mutation de playlist du projet ne le supprime du spread) plutôt qu'une nouvelle requête Supabase à `template_clone_counts` — potentiellement légèrement périmé (quelqu'un a pu cloner entre-temps) mais suffisant pour un chiffre de vanité, largement mieux que l'absence totale actuelle.

**Généralisation vérifiée AVANT de corriger** (nouvelle habitude actée ce même jour, voir CLAUDE-SANDBOX-VERIFICATION.md) : les 3 appelants de `openCuratedPlaylist` du projet entier recensés — seul celui corrigé ici était fautif, les 2 autres déjà corrects.

Tests : `tests/hooks/usePlaylistLibrary.test.js` — nouveau describe dédié à `removeSavedPlaylist` (aucun test n'existait avant pour cette fonction). 3 scénarios : restauration avec les 3 champs corrects (vrai template `tpl-midnight-runner-160`, le même que les captures), `cloneCount` absent sur la copie retirée se propage tel quel (pas de faux 0 inventé), playlist sans `sourceTemplateId` (générée/importée) — pas de restauration du tout, comportement inchangé.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 — check-up général, 1 vrai bug trouvé et corrigé : `PlaylistEditContext.jsx` re-rendait `PlaylistHeaderTitleBlock.jsx` à chaque frappe, malgré ce qu'affirmait sa propre docstring.** Trouvé en relisant le chantier de mémoïsation du 08/08 (le même jour qui avait justement corrigé ce type de bug ailleurs) — ironie relevée avec l'utilisateur avant correctif.

**Le vrai problème** : `PlaylistEditContext.jsx` construisait une seule `value` (littéral, jamais dans un `useMemo`) portant à la fois `handleOpenEditPlaylistModal` (lu par `PlaylistHeaderTitleBlock.jsx`, censé rester stable) ET `editedPlaylistName`/`editedPlaylistDescription` (le brouillon, qui change à CHAQUE frappe dans `EditPlaylistModal.jsx`). Un Contexte React re-rend TOUS ses consommateurs dès qu'UN SEUL champ de sa `value` change — donc `PlaylistHeaderTitleBlock.jsx` re-rendait bien à chaque frappe, alors que sa docstring affirmait explicitement le contraire depuis le 08/08. ⚠️ Un simple `useMemo` sur la `value` n'aurait PAS suffi : `editedPlaylistName` en fait partie et change à chaque frappe, donc le memo aurait recalculé de toute façon.

**Correctif** : `PlaylistEditContext.jsx` découpé en **2 Contextes distincts** (même Provider, deux `value` séparées) — exactement le même principe déjà appliqué à `PlaylistDetailContext` → `PlaylistEditContext` le 08/08 :
- **`PlaylistEditActionsContext`** (`usePlaylistEditActions()`, nouveau) — UNIQUEMENT `handleOpenEditPlaylistModal`, stabilisée par `useCallback([currentPlaylist, openModal])` puis enveloppée seule dans son propre `useMemo`. Consommé désormais par `PlaylistHeaderTitleBlock.jsx` (changé depuis `usePlaylistEdit()`).
- **`PlaylistEditContext`** (`usePlaylistEdit()`, nom INCHANGÉ) — tout le reste, y compris le brouillon volatil. Toujours pas mémoïsé, mais sans conséquence : seul `EditPlaylistModal.jsx` le consomme, et ce composant DOIT de toute façon re-rendre à chaque frappe.

Tests : `tests/contexts/PlaylistEditContext.test.jsx` — nouveau describe "stabilité référentielle" avec un vrai compteur de rendus (`ActionsRenderProbe`/`DraftRenderProbe`, RTL) prouvant que le Contexte stable ne re-rend PAS pendant une frappe (contrôle négatif inclus : le Contexte volatil, lui, re-rend bien — sinon le test ne prouverait rien) — trou de couverture comblé, aucun test existant ne vérifiait ce point avant. `tests/views/PlaylistDetail/PlaylistHeaderTitleBlock.test.jsx` — mock basculé sur `usePlaylistEditActions()`. `tests/criticalExportsTrap.test.js` — étendu pour vérifier aussi `usePlaylistEditActions` (2e export critique de ce fichier).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle (bac à sable sans accès réseau).

✅ **SESSION DU 10/08 (suite) — 2e bug trouvé et corrigé, même famille, rayon d'impact plus large : `AthleticContext.jsx` recalculait sa `value` à quasiment chaque toast affiché N'IMPORTE OÙ dans l'app.**

**Le vrai problème** : la docstring d'`AthleticContext.jsx` (08/08) justifiait son `useMemo([isNaughtyMode, athleticProfileApi])` par "`athleticProfileApi` est déjà stable à la source... `App()` ne re-rend quasiment jamais". Aucune des deux affirmations ne tenait : (1) `useAthleticProfile.js` déclarait ses 10 fonctions de mutation (`setBaseBpmForActivity`, `addCustomActivity`...) en `const` brutes, jamais dans un `useCallback` — donc un nouvel objet à CHAQUE appel du hook ; (2) `App()` possède aussi `toast` (`useToast()`), mis à jour par **73 appels `showToast(...)` répartis dans tout le projet** (favoris, routines, trophées, partage, CSV...) — donc `App()` re-rend très fréquemment, bien plus que ce que supposait la docstring. Résultat réel : le `useMemo` d'`AthleticContext.jsx` recalculait à quasiment chaque interaction utilisateur ayant un retour visuel, re-rendant tous ses consommateurs (dont `CustomActivityModal.jsx`, montée GLOBALEMENT dans App.jsx — le cas le plus sensible du projet, `AthleticProfilePanel.jsx`, `GeneratorView.jsx`, `GeneratorWizard.jsx`, `SettingsView.jsx`, `PlaylistDetailContext.jsx`).

**Correctif** : les 10 fonctions de mutation de `useAthleticProfile.js` enveloppées dans `useCallback([setAthleticProfile])` — sûr, aucune ne lit `athleticProfile` directement (toutes via `prev =>`), et `setAthleticProfile` (retour de `usePersistentState`, un vrai `useState`) est garanti stable par React. La `value` retournée par le hook lui-même enveloppée dans un `useMemo` (dépend réellement de `athleticProfile` + `getProfileForWorkout`/`getProfileForWorkoutOrDefault`, déjà stabilisées le 03/08). Le `useMemo` d'`AthleticContext.jsx` (inchangé) devient donc réellement efficace, plutôt que décoratif. Docstrings des deux fichiers corrigées pour ne plus affirmer une stabilité qui n'était pas garantie.

Tests : nouveau fichier `tests/hooks/useAthleticProfile.test.js` (aucun test dédié n'existait avant — tous les consommateurs mockent `useAthleticContext()` entièrement) — stabilité référentielle des 10 fonctions + de l'objet retourné entre deux rendus sans changement, changement réel de référence quand le profil change vraiment, contrôle négatif sur `getProfileForWorkout` (doit, lui, changer).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite, 3e trouvaille) — course "Partager"/"Cloner" dans `PlaylistDetailView.jsx` : un bilan de séance partageable pouvait mélanger les données de deux playlists différentes.**

**Genre différent des 2 précédents** : pas une histoire de re-render inutile, une vraie course entre deux actions utilisateur. `startBackgroundImageGeneration()` (déclenchée au clic sur "Partager") lance une chaîne asynchrone en plusieurs allers-retours réseau (pochette de séance, jusqu'à 3 pochettes de titres Deezer, capture `html2canvas`) qui écrit dans `summarySessionCover`/`summaryCovers`, tous deux fermés sur le `currentPlaylist` du moment de l'appel. Le composant reste volontairement MONTÉ en passant d'une playlist à l'autre (`handleClonePlaylist`, usePlaylistLibrary.js : *"on reste sur la même vue détail, seul l'objet affiché change"*) — rien n'empêchait de cliquer "Cloner" (juste à côté du bouton "Partager") PENDANT que la génération d'image tournait encore : `currentPlaylist` changeait alors vers la nouvelle playlist, le `useEffect` de reset remettait `summarySessionCover`/`summaryCovers` à zéro pour ELLE, mais la chaîne asynchrone de l'ANCIENNE playlist continuait d'écrire dans ce même state partagé une fois résolue — `<SessionSummaryCard playlist={currentPlaylist} .../>` (qui lit `currentPlaylist` en direct) pouvait alors capturer un bilan mélangeant les données de la NOUVELLE playlist avec les pochettes de l'ANCIENNE, marqué "prêt" malgré tout.

**Correctif** : `currentPlaylistIdRef` (pattern déjà utilisé ailleurs dans le projet — `structureModeRef`/`setStructureModeRef`, useGeneratorForm.js) — toujours l'id le plus récent, mis à jour à chaque rendu. `generateSummaryImageFile` capture l'id au début de son propre appel et vérifie `isStale()` à 3 points (avant chaque écriture d'état ET avant la capture finale) — abandon silencieux dès que ça diverge, sans même poursuivre les appels réseau suivants. `startBackgroundImageGeneration` revérifie une 2e fois avant d'appliquer le résultat final (défense en profondeur, 2 couches indépendantes — même principe que `lock_parent_lineage`/l'omission de `parent_id` côté client, useSyncedCollection.js).

Tests : `tests/views/PlaylistDetailView.test.jsx`, nouveau describe dédié — 2 scénarios (changement de playlist pendant la résolution des pochettes, et pendant la capture elle-même), tous deux vérifient que le résultat obsolète n'est jamais appliqué (`setSummaryImageStatus` jamais `'ready'`/`'error'`, `captureElementAsFile` jamais appelé dans le 1er cas).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite, 4e trouvaille, la plus sérieuse) — même famille de course que "Partager"/"Cloner" ci-dessus, mais dans `handleReplaceTrack`/`handleReplaceTrackSameArtist` (`PlaylistDetailContext.jsx`) : pouvait entraîner une VRAIE suppression de playlist côté Supabase, pas juste un affichage incohérent.**

**Le mécanisme** : `await getSingleMatchingTrack(...)` (recherche Deezer + résolution BPM/genre) peut prendre plusieurs secondes. Rien n'empêchait de cliquer "Cloner" (juste à côté du menu "Remplacer un titre") pendant que cette recherche tournait. Une fois la recherche résolue, le code reprenait avec `currentPlaylist`/`savedPlaylists` FIGÉS au moment du clic (fermeture JS classique, comme pour "Partager") : `setCurrentPlaylist` ramenait l'affichage sur l'ANCIENNE playlist par-dessus la NOUVELLE ; pire, `setSavedPlaylists(savedPlaylists.map(...))` utilisait un tableau `savedPlaylists` obsolète — s'il manquait la playlist tout juste clonée (créée APRÈS la fermeture de la fonction), ce tableau amputé remplaçait le VRAI state courant, et `useSyncedCollection.js` interprétait cette absence comme une SUPPRESSION, envoyant un vrai `DELETE` vers Supabase pour cette playlist.

**Correctif** : même schéma que "Partager"/"Cloner" (`currentPlaylistIdRef`, toujours à jour, comparé à un id capturé au début de chaque fonction). Vérifié juste avant chaque écriture — dans `handleReplaceTrackSameArtist`, aux DEUX points possibles (avant de lancer la recherche élargie ET avant d'appliquer son résultat). Abandon avec un toast informatif ("Remplacement annulé : tu as changé de playlist entre-temps.") plutôt qu'un échec silencieux — contrairement à "Partager" (génération en arrière-plan sans attente explicite de l'utilisateur), "Remplacer" est une action directe qui mérite un retour.

Tests : `tests/contexts/PlaylistDetailContext.test.jsx` — `musicEngine.js` mocké pour la première fois dans ce fichier (aucun test n'existait avant pour ces 2 fonctions). 3 scénarios : changement de playlist pendant la recherche principale (annulation, aucune écriture), comportement inchangé sans changement de playlist, et changement de playlist pendant le repli élargi de `handleReplaceTrackSameArtist` (2e point de vérification).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite, 5e trouvaille — App.jsx, périmètre volontairement limité à des correctifs ciblés, PAS une refonte de la navigation, reportée à plus tard) — 3e occurrence de la même famille de course, cette fois dans `usePlaylistGeneration.js` (`executeGeneration`), appelée depuis `App.jsx`.**

**Le mécanisme, une nouvelle fois le même** : `executeGeneration` peut tourner plusieurs dizaines de secondes pour un gros lot (le bandeau de progression d'App.jsx le dit lui-même : "+1s de pause volontaire entre chaque playlist"). `isGenerating` ne bloque QUE l'affichage d'un bandeau (confirmé en lisant le rendu — un simple `<div>` flottant, aucune modale/overlay), donc rien n'empêche de renommer/cloner/supprimer une AUTRE playlist ou routine, ou de débloquer un trophée par une autre action, PENDANT qu'une génération tourne encore. Trois écritures finales utilisaient `savedPlaylists`/`routines`/`userStats` FIGÉS au moment du clic sur "Générer" : `setSavedPlaylists([...generatedPlaylists, ...savedPlaylists])` (lot de plusieurs playlists) et `setRoutines(routines.map(...))` risquaient le même DELETE Supabase que la trouvaille précédente si une entrée avait été ajoutée entre-temps ; `checkTrophies(newStats)` (moins grave, `userStats` n'est qu'un blob local) pouvait silencieusement écraser un trophée débloqué par une action concurrente.

**Correctif** : même schéma une 3e fois — `savedPlaylistsRef`/`routinesRef`/`userStatsRef`, toujours à jour. Pour `checkTrophies`, correctif légèrement différent des deux précédents (abandon complet n'aurait pas de sens ici, cette génération a bien un trophée réel à créditer) : seuls les champs RÉELLEMENT modifiés par CETTE génération (comparés au `userStats` de départ) sont réappliqués par-dessus le `userStats` le plus frais, plutôt que d'écraser l'objet entier — un vrai patch, pas juste une lecture fraîche.

Tests : nouveau fichier `tests/hooks/usePlaylistGeneration.test.js` (aucun test dédié n'existait avant — 1er mock de `createPlaylistData`/`useGeneratorContext` pour ce hook). 3 scénarios, un par écriture corrigée : `setRoutines` avec une routine ajoutée ailleurs pendant la génération, `checkTrophies` avec un trophée débloqué ailleurs (vérifie que les deux trophées — le concurrent ET celui de cette génération — survivent), `setSavedPlaylists` (lot de 2) avec une playlist sauvegardée ailleurs pendant la 1re playlist du lot.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite, 6e trouvaille) — 4e occurrence de la même famille, cette fois dans `useCsvImport.js` (`handleCSVUpload`) : un `FileReader`, pas un appel réseau.**

**Trouvé en balayant systématiquement** tous les appels directs `setSavedPlaylists(savedPlaylists...)`/`setRoutines(routines...)` (sans `prev =>`) du projet, pour vérifier s'il en restait d'autres après les 3 corrections précédentes — la quasi-totalité des résultats se sont avérés sûrs (handlers strictement synchrones, aucun `await`/callback asynchrone entre la lecture et l'écriture, donc aucune fenêtre de course possible) : `usePlaylistLibrary.js`, `usePlaylistCompletions.js`, `PlaylistsView.jsx`, `RoutinesView.jsx`. Un seul candidat réel : `FileReader.readAsText()` est asynchrone (lecture en arrière-plan, `onload` se déclenche une fois terminée) — fenêtre de course plus petite que les 3 précédentes (souvent quasi instantané pour un petit CSV) mais pas nulle (gros fichier, appareil lent). Même risque : `setCurrentPlaylist` ramenant l'affichage sur l'ancienne playlist, `setSavedPlaylists` avec un tableau obsolète pouvant faire disparaître une playlist ajoutée entre-temps.

**Correctif** : même schéma une 4e fois — `currentPlaylistIdRef`/`savedPlaylistsRef`, abandon avec toast si divergence détectée à l'intérieur de `onload`, avant toute écriture.

Tests : nouveau fichier `tests/hooks/useCsvImport.test.js` (aucun test dédié n'existait avant). `FileReader` remplacé par un faux constructeur contrôlable manuellement (`onload` déclenché explicitement par le test) — seul moyen fiable d'insérer un point de pause exact entre le déclenchement de l'import et la fin de la lecture pour simuler la course. 2 scénarios : changement de playlist pendant la lecture (annulation), comportement inchangé sans changement.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 10/08 (suite, 7e trouvaille, App.jsx — même périmètre limité qu'à la 5e trouvaille, pas de refonte navigation) — 5e occurrence de la même famille, `shareImageFileWithTrophy` : la fenêtre de course la plus longue de toutes.**

**Trouvée en généralisant enfin la recherche** (retour direct : "pourquoi 4 occurrences plutôt que de généraliser d'un coup ?" — question légitime, voir plus bas) plutôt qu'en repartant des seuls noms `setSavedPlaylists`/`setRoutines` comme les 4 fois précédentes : recherche large de tout `setXxx(identifiant...)` (pas `prev =>`) dans un fichier contenant de l'async, ~300 résultats, quasi tous inoffensifs (state local à un composant — champs de formulaire, booléens de chargement — jamais un problème). Recoupé ensuite avec tous les appels `checkTrophies(...)` du projet pour vérifier lesquels vivaient après un `await` : un seul vrai candidat, `shareImageFileWithTrophy` (App.jsx) — `await shareImageFile(...)` attend `navigator.share()` avec un fichier, la feuille de partage NATIVE du système, qui reste ouverte tant que l'utilisateur ne l'a pas fermée — potentiellement plusieurs MINUTES s'il se laisse distraire, largement plus long que n'importe quel appel réseau des 4 corrections précédentes. `checkTrophies({ ...userStats, hasSharedSomething: true })` utilisait le `userStats` figé au clic sur "Partager", écrasant tout changement concurrent survenu avant que l'utilisateur referme enfin la feuille de partage.

**Correctif** : même schéma que `usePlaylistGeneration.js` (patch d'un seul champ par-dessus `userStatsRef.current`, le plus frais) — plus simple ici, un seul flag booléen à appliquer, pas besoin de la logique de "champs réellement modifiés" (rien d'autre n'est calculé avant ce point).

⚠️ **Pas de test ajouté ici, assumé** — `App.jsx` n'a AUCUN fichier de test dédié (convention déjà établie : les hooks EXTRAITS sont testés, pas le composant racine lui-même), et créer un scaffold de test juste pour cette fonction isolée aurait demandé d'inventer un pattern de test non utilisé ailleurs dans le projet pour ce fichier — hors du périmètre "correctifs ciblés, pas de refonte" demandé. Vérifié par lecture attentive + les outils statiques habituels, comme le reste d'App.jsx.

**Sur le "pourquoi pas généralisé dès le départ"** : les 4 premières fois, je suis reparti du POINT D'IMPACT déjà connu (un composant/fichier précis que je venais de lire en détail) plutôt que de la CAUSE RACINE (le motif "écriture différée sur une collection/state partagé, closure figée") — ça a marché à chaque fois mais seulement parce que je relisais un fichier voisin par hasard, pas par méthode. Le tour généralisé (grep large + recoupement par point d'entrée `checkTrophies`/setters de collections partagées) aurait dû être fait dès la 2e trouvaille, pas la 5e.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle.

✅ **SESSION DU 08/08 (suite, 3e passe) — validation du titre + émoji baké en texte littéral dans le nom des playlists.** Deux chantiers distincts décidés dans la même discussion (captures d'écran de la modale à l'appui) — traités ensemble ici.

**1. Validation du titre (jamais optionnel, contrairement à la description)** — nouvelle constante `MIN_PLAYLIST_NAME_LENGTH = 3` (`appConfig.js`). `PlaylistEditContext.jsx` : `isEditedNameValid` (titre `.trim()` ≥ 3 caractères) calculé et réexposé, le repli silencieux sur l'ancien nom (`|| currentPlaylist.name`) est retiré — `handleSavePlaylistDetails` refuse maintenant explicitement de sauvegarder si invalide (garde défensive, en plus du bouton déjà désactivé côté modale). `EditPlaylistModal.jsx` : bouton "Enregistrer" `disabled` + message d'erreur sous le champ titre tant que c'est invalide, même pattern que `EditRoutineModal.jsx` sur cible invalide. La **description**, elle, reste sans AUCUNE contrainte de longueur minimale (confirmé explicitement par l'utilisateur après un 1er malentendu de ma part sur quel champ portait la règle) — n'importe quel contenu est valide, y compris un seul caractère.

**2. Émoji baké en texte littéral dans `name`** (retour direct : "faudrait que l'emoji corresponde à un truc présent dans le titre et que l'internaute puisse le supprimer ou le remettre à loisir") — auparavant purement décoratif, recalculé à CHAQUE affichage via `getActivityEmoji(workoutType)` (`PlaylistHeaderTitleBlock.jsx`/`PlaylistCard.jsx`), jamais stocké dans `name`, donc jamais éditable. Désormais un caractère ordinaire DANS `name`, posé UNE SEULE FOIS à la création, éditable/supprimable librement depuis `EditPlaylistModal.jsx` comme n'importe quel texte — plus aucun lien avec `workoutType` une fois posé.

Deux points de création identifiés et vérifiés avant d'agir (pas supposés) : `createPlaylistData` (musicEngine.js — génération wizard ET routines, même moteur) et `openCuratedPlaylist` (useNavigation.js — ouverture d'un template). Clonage/import partagé n'ont pas eu besoin d'être touchés (copient l'objet playlist existant tel quel, l'émoji suit automatiquement). Chaque logique de nommage extraite en fonction PURE dédiée et EXPORTÉE (`buildGeneratedPlaylistName`/`buildCuratedPlaylistName`) — les fonctions d'origine (`createPlaylistData` async, `openCuratedPlaylist` a besoin de Contextes React) n'étaient pas testables directement en isolation, ces extractions le sont.

Affichage dérivé de l'émoji retiré des 2 seuls endroits qui l'utilisaient (`PlaylistHeaderTitleBlock.jsx`/`PlaylistCard.jsx`) — sinon double affichage (une fois depuis le texte stocké, une fois recalculé). `TemplateCard.jsx` (aperçu d'un template AVANT ouverture, sur Découvrir) vérifié propre — n'a jamais dérivé d'émoji, rien à y changer.

⚠️ **Playlists déjà existantes : n'auront JAMAIS cet émoji rétroactivement, aucune migration prévue.** Nouvelle habitude actée dans `CLAUDE-SANDBOX-VERIFICATION.md` : tant qu'il n'y a pas d'utilisateurs réels sur ce projet, ce genre d'incohérence ancien/nouveau contenu n'a plus besoin d'être présenté comme un choix produit à trancher avant d'implémenter — un simple constat suffit.

Tests : `musicEngine.test.js` (nouveau describe pour `buildGeneratedPlaylistName`, 6 scénarios — vérifiés réellement exécutés en Node avant d'être posés, pas juste relus), nouveau `tests/hooks/useNavigation.test.js` (1er fichier de test pour ce hook, scopé à `buildCuratedPlaylistName` — le hook complet a besoin de trop de Contextes pour ce besoin précis), `PlaylistEditContext.test.jsx` (nouveau describe validation + piège trouvé en le réécrivant : `editedPlaylistName` démarre vide, donc TOUS les tests de sauvegarde existants auraient silencieusement échoué sans "open-edit" d'abord — corrigé), `EditPlaylistModal.test.jsx` (nouveau describe validation), `PlaylistCard.test.jsx`/`PlaylistHeaderTitleBlock.test.jsx` (mock `getActivityEmoji` devenu inutile, retiré).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle (bac à sable sans accès réseau, `vitest run` jamais exécuté pour de vrai ici).

✅ **SESSION DU 08/08 (suite) — édition titre+description passée d'inline à une modale dédiée (`EditPlaylistModal.jsx`).** Retour direct, captures à l'appui : "le mode édition inline crée un layout shift désagréable qui décale les stats/boutons vers le bas — remplacer par une modale dédiée, standardiser l'UX comme `EditRoutineModal.jsx`".

**Vérifié avant d'implémenter** (pas supposé) : ce projet a un schéma déjà établi pour ce genre de modale — voir `ModalContainer.jsx` : "Share, Search, EditRoutine et SavingRoutine... rendues ailleurs qu'ici : leur booléen d'ouverture est dérivé directement dans le hook qui possède déjà le reste de leur état" (ex. `isEditRoutineModalOpen = activeModal === 'EDIT_ROUTINE'`, dans `useRoutines.js`). `PlaylistEditContext.jsx` (créé le même jour, chantier mémoïsation) est EXACTEMENT ce hook pour l'édition de playlist — même schéma appliqué ici plutôt qu'inventé.

`PlaylistEditContext.jsx` : `isEditingPlaylistDetails` (booléen local) remplacé par `isEditPlaylistModalOpen = activeModal === 'EDIT_PLAYLIST'` (dérivé de `useModalContext()`). Nouveau point d'entrée unique `handleOpenEditPlaylistModal()` — préremplit les 2 brouillons ET ouvre la modale ensemble (même raisonnement que `handleSavePlaylistDetails` déjà en place : éviter qu'un appelant fasse les 3 étapes séparément, dans le mauvais ordre ou en en oubliant une). `handleSavePlaylistDetails` ferme désormais la modale lui-même (`closeModal()`) une fois la sauvegarde faite.

Nouveau fichier — **`src/components/modals/EditPlaylistModal.jsx`** — sur le modèle d'`EditRoutineModal.jsx` (même gabarit de fenêtre : overlay, carte `rounded-3xl`, en-tête icône+titre+croix, pied de page 2 boutons). Lit tout son état via `usePlaylistEdit()` (comme `CustomActivityModal.jsx` lit `useCustomActivityContext()`) — ne reçoit que `theme` en prop. Montée dans `PlaylistDetailView.jsx`, à l'intérieur de `<PlaylistEditProvider>` (PAS dans `ModalContainer.jsx`, monté globalement et sans accès à ce Contexte scopé à la vue détail d'une playlist).

`PlaylistHeaderTitleBlock.jsx` : formulaire d'édition inline entièrement retiré (input, textarea, compteur de caractères, boutons Enregistrer/Annuler) — le crayon appelle maintenant `handleOpenEditPlaylistModal()`, un seul appel, plus aucun état d'édition géré localement dans ce composant.

Tests : nouveau `tests/modals/EditPlaylistModal.test.jsx` (1er fichier de test — ouverture/fermeture, édition des champs, Entrée/backdrop/Annuler/Enregistrer). `PlaylistEditContext.test.jsx` réécrit — `renderWithProvider` enveloppe désormais avec un VRAI `<ModalProvider>` (sans quoi `openModal`/`closeModal` seraient des no-op, rendant le cycle ouverture/fermeture impossible à observer), nouveaux tests pour `handleOpenEditPlaylistModal`/`closeEditPlaylistModal`. `PlaylistHeaderTitleBlock.test.jsx` — tout le bloc "édition fusionnée" (formulaire inline) remplacé par un test resserré sur l'appel de `handleOpenEditPlaylistModal` + une non-régression confirmant qu'aucun formulaire n'est plus rendu ici.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle (bac à sable sans accès réseau, `vitest run` jamais exécuté pour de vrai ici).

✅ **SUITE (08/08, même jour) — `AudioPlayerContext.jsx` mémoïsé (via `useAudioPreview.js`).** Après avoir évalué `AuthContext.jsx` (state qui ne change que rarement — connexion/déconnexion — donc `AuthProvider` re-rend déjà peu même sans mémoïsation ; corriger demanderait d'envelopper une quinzaine de fonctions dans `useCallback` pour un gain marginal, **pas fait**, priorité jugée trop basse) et `AudioPlayerContext.jsx` (retenu — voir plus bas).

Vérifié avant d'agir : `useAudioPreview.js` documentait déjà lui-même pourquoi la progression audio n'est PAS suivie en state React (`AudioProgressBar` s'abonne à `timeupdate` directement sur l'élément `<audio>`, en dehors de React) — sa fréquence de changement réelle est donc bien plus basse que celle du formulaire du wizard (`playingPreviewId`/`currentTrack`/`isPlaying`/`resolvingTrackId` changent sur des actions discrètes — jouer/pause/changer de titre — jamais en continu). Le vrai bénéfice reste réel : `MiniPlayerBar.jsx` est montée GLOBALEMENT dans `App.jsx` (comme l'était `CustomActivityModal.jsx`), et `PlaylistDetailContext.jsx` consomme aussi ce Contexte — sans mémoïsation, les deux re-rendaient à chaque rendu d'`AudioPlayerProvider`, même sans rapport avec une action de lecture réelle.

`useAudioPreview.js` : retour enveloppé dans un `useMemo`, dépendances = exactement les valeurs réactives dont les fonctions du hook ont besoin (`playingPreviewId`/`currentTrack`/`isPlaying`/`resolvingTrackId`/`showToast`) — PAS les 9 fonctions elles-mêmes (`playTrack`/`togglePreview`/`resolveAndPlay`/etc.), volontairement pas individuellement stabilisées via `useCallback` (chantier à part, disproportionné ici vu qu'elles ne ferment que sur des refs — identité stable, toujours lues à jour — et sur ces mêmes dépendances : le `useMemo` englobant reste donc correct sans ce travail supplémentaire). `AudioPlayerContext.jsx` n'a besoin d'AUCUNE modification propre — sa `value` est directement le retour de ce hook, la mémoïsation s'y répercute automatiquement (docstring mise à jour pour l'expliquer).

Tests : nouveau `tests/hooks/useAudioPreview.test.js` (1er fichier de test pour ce hook — comportement de base de `togglePreview` inchangé + nouvelle stabilité référentielle du retour, mock minimal de `window.Audio` pour jsdom).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle (bac à sable sans accès réseau, `vitest run` jamais exécuté pour de vrai ici).

✅ **SESSION DU 08/08 (suite) — `GeneratorContext.jsx` découpé : `isNaughtyMode`/l'API athlétique isolés dans `AthleticContext.jsx`.** Suite du chantier "value non mémoïsée re-render tout le monde" (`PlaylistDetailContext`/`ModalContext` d'abord, voir plus bas) — chantier complet plutôt qu'un correctif ciblé, sur décision explicite de l'utilisateur ("tant que j'ai pas d'utilisateur je suis ok pour chantier les plus risqués et complets", enregistré comme habitude par défaut dans `CLAUDE-SANDBOX-VERIFICATION.md`).

**Bonne surprise en vérifiant AVANT de découper** (pas supposé) : `useAthleticProfile()` est appelé UNE SEULE FOIS dans le composant racine `App()`, PAS dans `AppContent` ni dans `GeneratorProvider` — `athleticProfileApi` était donc déjà référentiellement stable à la source, tant que `App()` ne re-rend pas pour une autre raison (bascule Mode Intime, toast, ou le profil qui change réellement). Chantier plus petit et moins risqué que redouté : pas besoin de toucher `useAthleticProfile.js` (383 lignes, consommé aussi directement par StatsView/PlaylistDetailView).

**Le vrai problème identifié** : `GeneratorProvider` re-rend à CHAQUE réglage du wizard (`useGeneratorForm()`/`useCustomActivity()` appelés en interne, dizaines de `useState`) — sa `value` (jamais mémoïsée, et ne PEUT pas l'être simplement, ces hooks renvoient un objet neuf à chaque rendu) était recréée en entier à chaque frappe/glissement, entraînant avec elle tout composant qui lisait ne serait-ce qu'`isNaughtyMode` sans rien lire du formulaire.

⚠️ **Découverte en cours de route qui a réduit la portée initialement annoncée** : les vues de l'app sont en rendu conditionnel classique (`{view === 'generator' && (...)}`), donc démontées, pas juste cachées — `AthleticProfilePanel`/`SettingsView` ne sont JAMAIS montés en même temps que le wizard actif, donc ce cas précis ne se produisait pas réellement en pratique. Le vrai bénéfice concret restant : `CustomActivityModal.jsx`, monté GLOBALEMENT dans `App.jsx` (pas conditionné à une vue), qui re-rendait bien à chaque réglage du wizard même fermé.

Nouveau fichier — **`src/contexts/AthleticContext.jsx`** — `isNaughtyMode`/l'API athlétique complète, `value` mémoïsée (`useMemo`, sûr ici puisque déjà stable à la source). Monté dans `App.jsx` au même niveau que `<GeneratorProvider>`/`<AudioPlayerProvider>`.

`GeneratorContext.jsx` : ces 2 éléments retirés de sa `value`/son `FALLBACK`, docstring mise à jour — garde toujours `isNaughtyMode`/`athleticProfileApi` EN PROPS (nécessaires en interne pour `useGeneratorForm`), seule sa valeur de contexte ne les réexpose plus.

Consommateurs mis à jour (vérifiés un par un avant de changer quoi que ce soit, pas supposés) : `PlaylistDetailContext.jsx`, `CustomActivityModal.jsx` (limite documentée honnêtement — reste partiellement couplé au générateur via `applyProfileBpmIfUntouched`, qui fait partie de l'état du formulaire ; l'isoler complètement demanderait de stabiliser cette fonction dans `useGeneratorForm.js` lui-même, chantier distinct, pas entrepris ici), `AthleticProfilePanel.jsx` (entièrement découplé du générateur), `GeneratorView.jsx`, `GeneratorWizard.jsx`. Vérifiés SANS modification nécessaire : `useNavigation.js`/`usePlaylistGeneration.js`/`useRoutineActions.js`/`Sidebar.jsx` (reçoivent `isNaughtyMode` en paramètre/prop direct, jamais via ce Contexte).

Tests : `GeneratorView.test.jsx`/`CustomActivityModal.test.jsx`/`PlaylistDetailContext.test.jsx` mis à jour (mock séparé pour `useAthleticContext()`). `GeneratorWizard.test.jsx` (803 lignes, 60 appels au même helper `makeContextValue()`) — plutôt que de retoucher les 60 sites d'appel, `makeContextValue()` elle-même sépare maintenant les champs athlétiques en interne et alimente les 2 mocks ; aucun appel existant changé. `AthleticProfilePanel.test.jsx` — renommage complet du mock (100% de ses champs sont athlétiques). `criticalExportsTrap.test.js` — élargi : `AthleticContext.jsx` (nouveau) ajouté, et au passage `ModalContext.jsx`/`PlaylistEditContext.jsx` (chantiers précédents, jamais ajoutés à ce garde-fou) aussi couverts désormais — le titre "les 3 Context Providers" n'était déjà plus vrai avant même l'ajout d'`AthleticContext.jsx`.

Bug de formatage trouvé et corrigé au passage dans `CLAUDE-SANDBOX-VERIFICATION.md` (titre "## 1. Validation de syntaxe RÉELLE" perdu lors d'une édition précédente).

✅ **SUITE (08/08, même jour) — `CustomActivityModal.jsx` entièrement découplée du wizard (2e passe sur `GeneratorContext.jsx`).** Répond à une limite documentée honnêtement dans la passe précédente : `applyProfileBpmIfUntouched` restait accrochée au formulaire du wizard (donc à son re-render à chaque frappe), rendant le découplage d'`AthleticContext.jsx` incomplet pour ce composant précis, monté GLOBALEMENT dans `App.jsx`.

**Le vrai obstacle** : `applyProfileBpmIfUntouched` (useGeneratorForm.js) lit `structureMode`/`setStructureMode` — impossible de la rendre stable avec un simple `useCallback([structureMode, setStructureMode])`, ça l'aurait recréée à chaque frappe (exactement le problème à résoudre). Corrigé avec le pattern "callback stable via ref" : deux `useRef`, mis à jour à CHAQUE rendu (simple assignation, pas un Hook), que la fonction (elle, `useCallback([])`, jamais recréée) lit à travers eux au moment de l'appel — référence stable pour toujours, tout en lisant l'état le plus récent.

Deuxième condition nécessaire, réglée dans la foulée : `useCustomActivity.js` renvoyait un objet neuf à chaque rendu (aucune mémoïsation) — `handleOpenCustomActivityModal` passée en `useCallback`, le retour entier enveloppé dans `useMemo`.

Nouveau fichier — **`src/contexts/CustomActivityContext.jsx`** — isole `customActivityApi` + `applyProfileBpmIfUntouched` (désormais stables), `value` mémoïsée en toute sécurité. Monté À L'INTÉRIEUR de `GeneratorProvider` (pas en frère dans `App.jsx` comme `AthleticContext.jsx` — ces 2 valeurs n'existent que dans son corps).

`GeneratorContext.jsx` : ces 2 éléments retirés de sa `value`. `CustomActivityModal.jsx` : ne consomme plus `useGeneratorContext()` DU TOUT désormais — objectif initial pleinement atteint. `GeneratorWizard.jsx`/`useRoutineActions.js` mis à jour pour lire `customActivity`/`handleOpenCustomActivityModal` via le nouveau Contexte.

**Bonus trouvé en cours de route** : `AppContent` (App.jsx) déstructurait encore `customActivity`/`handleOpenCustomActivityModal` depuis `useGeneratorContext()` — vérifié avant de rediriger, et découvert que ces 2 variables étaient en réalité du CODE MORT dans ce fichier (jamais utilisées ailleurs, commentaire déjà obsolète prétendant le contraire). Retirées plutôt que redirigées pour rien.

Tests : nouveaux `tests/hooks/useGeneratorForm.test.js`/`useCustomActivity.test.js` (1ers fichiers de test pour ces 2 hooks — scopés au comportement touché ici : correction métier d'`applyProfileBpmIfUntouched` inchangée + sa nouvelle stabilité référentielle, mémoïsation du retour de `useCustomActivity`). Nouveaux `tests/contexts/AthleticContext.test.jsx`/`CustomActivityContext.test.jsx` (1ers tests dédiés pour ces 2 Contextes — celui d'`AthleticContext.jsx` manquait depuis la 1re passe, ajouté maintenant par cohérence avec l'habitude "après un découpage, test dédié"). `CustomActivityModal.test.jsx`/`GeneratorWizard.test.jsx`/`useRoutineActions.test.js` adaptés. `criticalExportsTrap.test.js` élargi à `CustomActivityContext.jsx`.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle (bac à sable sans accès réseau, `vitest run` jamais exécuté pour de vrai ici).

✅ **SESSION DU 08/08 (suite) — `PlaylistHeader.jsx` découpé (836 → 254 lignes) en 5 sous-composants.** Suite du chantier "simplicité" (`useSyncedCollection`/`usePersistentState` d'abord, README élagué ensuite) : `PlaylistHeader.jsx` était devenu le plus gros fichier du dossier `PlaylistDetail/`, largement au-dessus de ses voisins (`TrackItem.jsx`/`TrackList.jsx`/`PlaylistCharts.jsx`).

Nouveaux fichiers, tous dans `src/components/views/PlaylistDetail/` — composants "dumb" (rendu seul, aucun état/calcul propre), reçoivent tout en props :
- **`PlaylistHeaderBadges.jsx`** (78 lignes) — médaille de rang, badge "Lecture seule", boutons publique/privée+retirer (overlay en coin).
- **`PlaylistHeaderCover.jsx`** (38 lignes) — pochette cliquable.
- **`PlaylistHeaderTitleBlock.jsx`** (134 lignes) — ligne pseudo+compteur de clonages, titre/description (édition fusionnée).
- **`PlaylistHeaderMeta.jsx`** (93 lignes) — badge "séance déjà réalisée"+dates, ligne d'infos (type/durée/titres/genres).
- **`PlaylistHeaderActions.jsx`** (139 lignes) — import CSV, action principale (sauvegarder/cloner), planifier, partager, badge BPM.

`PlaylistHeader.jsx` (254 lignes) reste le seul à posséder `usePlaylistDetail()` et à calculer les valeurs partagées entre plusieurs sous-composants (`ownerLabel`/`ownerProfileUsername`/`avgBpm`/`bpmZone`/`bpmBadgeColor`/`currentPlaylistRank`/`mostRecentCompletionIso`/`plannedDateInputRef`) — orchestrateur, plus aucune logique dupliquée entre fichiers.

**Rendu strictement identique, aucun changement de comportement** — vérifié par recoupement systématique (pas juste relu) : correspondance exacte props déclarées/props passées sur les 5 sous-composants (script dédié), présence unique de toutes les chaînes/`title`/classes distinctives de l'original (aucune perte, aucun doublon de markup — seuls doublons trouvés = mention en commentaire + code réel, attendu), `esbuild` + `tsc --checkJs` sur les 6 fichiers (0 variable non déclarée). `tests/views/PlaylistDetail/PlaylistHeader.test.jsx` (755 lignes, existant) **non modifié** — les `vi.mock(...)` qu'il pose sur `appConfig.js`/`musicCatalog.js`/`coverArt.js`/`TopCompletionDate.jsx`/`CompletionsList.jsx` interceptent par chemin de module résolu, pas par "qui importe quoi" : ils s'appliquent de façon transparente aux nouveaux sous-composants qui importent désormais ces mêmes modules à la place de `PlaylistHeader.jsx`.

✅ **SUITE (08/08, même jour) — `PlaylistDetailContext.jsx` découpé en 2 Contextes pour éliminer un re-render sur chaque frappe.** Suite de l'audit "d'autres optimisations ?" : la `value` du Provider n'était jamais mémoïsée (littéral d'objet neuf à chaque rendu) — taper un seul caractère dans le champ titre/description (`editedPlaylistName`/`editedPlaylistDescription`) recréait donc ce `value` en entier, et React re-rendait TOUS les consommateurs de `usePlaylistDetail()` (TrackList/TrackItem, PlaylistCharts, les 5 sous-composants de PlaylistHeader) à chaque frappe — pas seulement le champ de saisie. Les calculs lourds restaient protégés par leurs propres `useMemo` individuels (pas de recalcul), mais le re-render React lui-même a un coût, payé à chaque frappe par des composants sans rapport avec l'édition en cours.

Nouveau fichier — **`src/contexts/PlaylistEditContext.jsx`** — isole `isEditingPlaylistDetails`/`editedPlaylistName`/`editedPlaylistDescription`/`handleSavePlaylistDetails` dans son propre Contexte (`usePlaylistEdit()`), monté EN FRÈRE de `<PlaylistDetailProvider>` (pas imbriqué, aucune dépendance entre les deux — voir `PlaylistDetailView.jsx`). Seul `PlaylistHeaderTitleBlock.jsx` le consomme, et le lit **directement** (pas reçu en props depuis `PlaylistHeader.jsx`) — point important : si le parent lisait ces valeurs pour les redescendre en props, LUI-MÊME re-render à chaque frappe, entraînant avec lui ses 4 autres enfants (Badges/Cover/Meta/Actions), ce qui aurait annulé le bénéfice.

`PlaylistDetailContext.jsx` : ces 4 éléments retirés (état + handler + `value` + `FALLBACK`), import `MAX_DESCRIPTION_LENGTH` devenu inutile retiré, docstring mise à jour. `PlaylistDetailProvider` lui-même n'a donc plus cet état interne — il ne re-rend plus DU TOUT pendant une frappe, donc sa propre `value` (toujours pas mémoïsée, mais ça n'a plus d'importance ici) garde la même référence pendant l'édition.

**`ModalContext.jsx`** — gain plus modeste mais complet, dans la foulée : `value` enveloppée dans un `useMemo` correctement dépendancé. Sûr ici (contrairement à `PlaylistDetailContext.jsx`, qui a eu besoin d'un vrai découpage) : les 4 champs sont soit du state à faible fréquence de changement (`activeModal`/`modalData`), soit déjà stables (`openModal`/`closeModal`, `useCallback([])`).

**Volontairement PAS touchés maintenant** — `GeneratorContext.jsx`/`AuthContext.jsx`/`AudioPlayerContext.jsx` ont le même symptôme (`value` non mémoïsée) mais un `useMemo` superficiel n'y résoudrait rien : leurs valeurs proviennent de hooks (`useGeneratorForm`/`useCustomActivity`/`useAthleticProfile`/`useAudioPreview`/etc.) qui renvoient eux-mêmes un objet neuf à chaque rendu — un `useMemo` sur le Contexte recalculerait donc de toute façon à chaque fois (dépendances jamais stables). Les corriger correctement demanderait de mémoïser CES hooks en amont d'abord — chantier plus large, plus risqué, distinct de celui-ci. Noté ici pour ne pas l'oublier, pas implémenté.

Tests : nouveau `tests/contexts/PlaylistEditContext.test.jsx` (scénarios déplacés depuis `PlaylistDetailContext.test.jsx`, setup simplifié — plus besoin de mocker GeneratorContext/AudioPlayerContext/supabase, ce Contexte n'en dépend pas). `PlaylistHeaderTitleBlock.test.jsx` réécrit pour mocker `usePlaylistEdit()` au lieu de recevoir ces champs en props. `PlaylistHeader.test.jsx` nettoyé des champs devenus inutiles dans son mock.

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle (bac à sable sans accès réseau, `vitest run` jamais exécuté pour de vrai ici).

✅ **SUITE (08/08, même jour, retour direct) — tests dédiés ajoutés pour les 5 sous-composants, `PlaylistHeader.test.jsx` allégé en conséquence pour ne plus dupliquer.** Même pattern que `TrackList.test.jsx`/`TrackItem.jsx` (précédent déjà en place dans ce dossier) : chaque sous-composant a désormais son propre fichier de test (`PlaylistHeaderBadges.test.jsx`/`Cover.test.jsx`/`TitleBlock.test.jsx`/`Meta.test.jsx`/`Actions.test.jsx`), rendu directement avec des props à la main — plus besoin de passer par `usePlaylistDetail()` ni par `PlaylistHeader.jsx` pour tester leur rendu/interaction.

`PlaylistHeader.test.jsx` (279 lignes, contre 756 avant) ne teste plus QUE ce que `PlaylistHeader.jsx` lui-même fait encore : le calcul des valeurs partagées (`ownerLabel`/`ownerProfileUsername`/`avgBpm`/`bpmZone`/`bpmBadgeColor`/`currentPlaylistRank`/`mostRecentCompletionIso`/`hasImportedDataForMostRecent`) et leur transmission au bon sous-composant — les 5 sous-composants sont mockés par des stubs légers qui exposent juste les props reçues (en attributs `data-*`), jamais leur rendu réel.

Aucun test perdu — chaque scénario de l'ancien fichier a soit migré vers le fichier du sous-composant concerné (rendu/interaction), soit est resté dans `PlaylistHeader.test.jsx` sous forme de vérification de calcul/plomberie (ex. "isSaved=false + sourceTemplateId → ownerLabel='TempoFit Officiel'" reste ici, "le clic sur le pseudo cliquable appelle onViewProfile" part dans `PlaylistHeaderTitleBlock.test.jsx`).


# TempoFit — Historique détaillé, bloc 4 (13-14/08, hooks/tests, infobulles, moteur de génération)

Rien en cours actuellement. Dix chantiers enchaînés, mêmes 24-48h,
**+ 6 correctifs trouvés/demandés en creusant après coup, et une nouvelle
habitude actée à l'issue de cette série** :

**14/08 — rattrapage complet des infobulles sur texte tronqué.** Suite
directe du chantier précédent (`TemplateCard.jsx` seul, motif plus large
signalé sans être traité) — confirmé explicitement ("on le fait
maintenant"). Les 71 éléments `truncate`/`line-clamp-*` recensés dans
`src/components/` passés en revue un par un, dans 19 fichiers :
`StatsView.jsx` (12), `SettingsView.jsx` (6), `ProfileView.jsx` (4),
`PlaylistCharts.jsx` (5/6, 1 exception), `ViewHeader.jsx`,
`PlaylistHeaderTitleBlock.jsx`, `MiniPlayerBar.jsx` (1/2, 1 exception),
`TrackItem.jsx` (2), `SessionSummaryCard.jsx` (2), `SearchModal.jsx` (2),
`PublicRoutinePreviewModal.jsx` (2), `ImportSharedPlaylistModal.jsx` (2),
`RoutinesView.jsx`, `PlaylistCard.jsx`, `FavoritesView.jsx` (2),
`AthleticProfilePanel.jsx`, `Sidebar.jsx`, `SearchUsersModal.jsx` — plus
`PlaylistHeaderMeta.jsx`, déjà entièrement bon (le comptage initial au
grep simple n'avait pas vu les `title=` déjà posés sur une ligne
différente du `className`). 2 exceptions assumées, détaillées dans la
règle 6 du README (tooltip de graphique déjà affiché au survol ; un
bouton dont le `title=` décrit l'action plutôt que de répéter le texte).
Vérifié : aucune collision avec un `getByTitle`/`getAllByTitle` déjà
testé dans les fichiers à risque (croisement des valeurs mock utilisées).
Règle 6 du README mise à jour (ne mentionne plus "66 restants").

**14/08 — Découvrir : infobulles sur le texte tronqué (motif DISTINCT des
icônes).** Retour direct : "il manque pas les infobulles sur les metadata
de Découvrir ? je pensais qu'on les avait systématisées partout" — bonne
occasion de clarifier : la convention actée jusqu'ici portait sur les
ICÔNES seules, pas sur le texte TRONQUÉ (`truncate`, ellipsis) sans
`title=`, un motif différent bien que lié. `TemplateCard.jsx` corrigé (3
éléments : titre, ligne de métadonnées, description). Ampleur du motif
plus large constatée en vérifiant (71 éléments au total, voir le
rattrapage complet ci-dessus). Test dédié ajouté dans
`TemplateCard.test.jsx`.

**14/08 — bouton final du wizard : texte raccourci + couleur de marque
restaurée.** Retour direct : "Générer suffit pas ? et pourquoi le bouton
est blanc ?". "Générer ma Playlist" → "Générer" (redondant à ce stade,
plusieurs étapes de configuration déjà faites). Couleur : c'était
`bg-gray-900 dark:bg-white` codé en dur, sans lien avec `bgAccentClass`
(rouge Sport/rose Intime) utilisé PARTOUT ailleurs dans ce même fichier —
la CTA la plus importante de tout le wizard était la seule à ne pas
porter la couleur de marque, aucune trace d'un raisonnement voulu dans
l'historique du projet. Passé à `bgAccentClass`, qui bascule déjà
automatiquement rouge/rose via CSS (`--color-primary`, index.css) — plus
besoin du ternaire `isNaughtyMode` local, supprimé. Test mis à jour dans
`GeneratorWizard.test.jsx`.

**14/08 — Découvrir : compteur de clonages déplacé sur la pochette.**
Retour direct : "pour gagner de la place, le compteur en bas à droite de
la pochette ?". Complète le badge "TempoFit" en haut à gauche par une
symétrie diagonale — la ligne "chapeau" sous la pochette, qui ne
contenait plus que ce compteur depuis le retrait de l'auteur (chantier
précédent), est retirée entièrement : le titre suit désormais directement
la pochette. `z-10` posé DIRECTEMENT sur ce nouveau badge dès l'écriture
(pas après coup) — leçon tirée du bug juste précédent (badge "TempoFit"
inatteignable au clic, empilement CSS) appliquée immédiatement à ce badge
non cliquable, pour une cohérence purement esthétique (éviter qu'il
s'assombrisse au survol contrairement au badge "TempoFit"). Toujours
affiché même à 0 (comportement inchangé, juste déplacé). Tests réécrits
dans `TemplateCard.test.jsx` (le compteur est vérifié DANS le conteneur
de la pochette, plus "précédant le titre dans un `<p>`" — cet élément
n'existe plus).

**14/08 — bug réel raté au 1er passage : badge cliquable inatteignable
(empilement CSS).** Retour direct après déploiement : "TEMPOFIT est pas
cliquable". Le câblage (`onClick`+`stopPropagation`) était correct, mais
JAMAIS atteint dans un vrai navigateur — l'overlay du bouton play
(`absolute inset-0`, transparent hors survol) vient APRÈS le badge dans
le DOM ; sans z-index explicite, 2 éléments `position: absolute`
s'empilent selon leur ordre DOM, celui d'après passe AU-DESSUS même
invisible. Cet overlay couvre toute la carte, recouvrait donc le coin du
badge et interceptait le clic avant qu'il n'atteigne le bouton en dessous
— remontant jusqu'au clic de la carte entière (ouvrir la playlist) au
lieu du badge (voir profil). Corrigé avec `z-10` sur le badge. **Limite
honnêtement notée dans le test existant** : `fireEvent.click()` en jsdom
cible l'élément directement, sans aucun test de recouvrement visuel réel
— ce test passait DÉJÀ avant le correctif, il vérifie le câblage, pas
l'atteignabilité réelle au clic dans un navigateur, que jsdom ne peut pas
simuler. Recherche du même motif ailleurs dans le projet (badge cliquable
en coin + overlay plein cadre après lui dans le DOM) — aucune autre
occurrence trouvée, cas isolé à ce fichier.

**14/08 — Découvrir : badge "TempoFit" cliquable, auteur redondant
retiré.** Retour direct avec capture : "on a déjà TEMPOFIT sur la
pochette ET TempoFit Officiel en dessous, le 2e est redondant — est-ce
qu'on peut pas juste rendre le badge cliquable ?" (repris de la question
"le premier suffirait pas ?" — avis donné avant d'agir : oui redondant
aujourd'hui, mais raison documentée le 02/08 pour garder l'auteur
cliquable — anticipation d'un contenu non-officiel futur, jamais planifié
concrètement). Le clic vers le profil (Feature Sociale "Cold Start",
02/08) vit désormais sur le badge de la pochette (`TemplateCard.jsx`) —
même garde `isOfficial && onViewOfficialProfile`, même `stopPropagation`
— plus sur un texte auteur séparé (retiré). Si du contenu non-officiel
apparaît un jour, réintroduire l'affichage différencié de l'auteur sera
un changement naturel à ce moment-là, pas une régression de celui-ci.
Tests réécrits dans `TemplateCard.test.jsx` (section renommée "badge
cliquable") et `DiscoverView.test.jsx` (nom accessible du bouton changé :
"TempoFit", le texte du badge, plus "TempoFit Officiel", l'ancien
`template.author`).


**14/08 — dernier angle mort : silence total pendant le repli réseau
final.** Trouvé à la 5e relecture demandée ("continue à creuser au cas
où"). La boucle de repli final (`getSingleMatchingTrack`, quand le pool
ne suffit pas — rare, "BPM/genre très restrictif") fait ses PROPRES
appels réseau, entièrement APRÈS la construction du pool où `onProgress`
s'arrêtait jusqu'ici — pas juste une stagnation temporaire comme les
correctifs précédents, un silence total tant qu'elle tournait. Corrigé en
basculant, à ce stade, du compte de pool ESTIMÉ au compte RÉEL de titres
déjà retenus pour le segment (`selected.length`) — le clamp anti-régression
déjà en place gère la transition si ce compte réel démarre plus bas que
la dernière estimation affichée. Même traitement appliqué au filet de
sécurité ultime (segment resté vide) pour cohérence, fenêtre de silence
plus courte mais réelle.

**Nouvelle habitude actée dans `CLAUDE-SANDBOX-VERIFICATION.md`** : après
5 relectures demandées sur le même chantier, chacune trouvant quelque
chose de réel mais de moins en moins grave, l'utilisateur a fait
remarquer que ça vaudrait le coup de systématiser ce réflexe plutôt que
de compter sur lui pour insister à chaque fois. Actée : après tout
chantier touchant un fichier déjà identifié comme sensible dans ce projet
(`musicEngine.js`, la logique de synchro Supabase, ou plus généralement
du code à plusieurs branches/boucles alimentant une même valeur
affichée/partagée), faire au moins une relecture complète et attentive
dédiée AVANT de considérer la livraison terminée — pas seulement vérifier
que ça compile.

**14/08 — anti-doublon dans le comptage catalogue.** Trouvé en creusant
encore ("continue à creuser au cas où, même la cosmétique a de
l'importance") : le comptage en direct du bloc catalogue ne dédoublonnait
pas contre les titres déjà retenus par les sources précédentes (favoris,
Spotify, recherche généraliste) — un même titre trouvé par deux sources
pouvait compter deux fois, gonflant légèrement le chiffre affiché au-delà
de la réalité du pool. Corrigé en réutilisant `seenIds` (déjà tenu à jour
par `addIfValid` pour TOUTES les sources, pas seulement la recherche
généraliste) dans le filtre de comptage — bénéfice plus large que prévu
au départ (dédoublonne aussi contre favoris/Spotify, pas seulement contre
la recherche généraliste). Pas de test dédié ajouté : logique trop
imbriquée dans l'accumulation de `seenIds` sur toute la fonction pour
être extraite proprement en fonction pure, comme les autres morceaux déjà
testés de ce chantier — cohérent avec la convention déjà actée pour cette
fonction (non testable en isolation, appels réseau réels).

**14/08 — chaînage de la progression entre recherche généraliste et
catalogue d'artistes.** Trouvé en re-creusant après le correctif
précédent (question ouverte "tu vois d'autres trucs ?", pas de retour
direct cette fois) : le chemin catalogue tourne SOUVENT en complément de
la recherche généraliste, dans le MÊME appel de fonction — mais sa
progression repartait de `progressBaseCount` tout court, sans tenir
compte de ce que la recherche généraliste avait déjà trouvé. Pas une
régression visible (déjà couverte par le clamp du correctif précédent),
mais un compteur qui aurait pu sembler STAGNER un moment à la transition
entre les deux sources, le temps que le catalogue "rattrape" le niveau
déjà atteint. Corrigé en hissant `generalSearchEstimate` en variable de
PORTÉE FONCTION (pas juste le bloc où vivait `genreValidDurationSoFar`
avant ce correctif), pour que le bloc catalogue puisse chaîner sa propre
progression à la suite plutôt que de repartir à zéro.

**14/08 — angle mort comblé sur demande explicite : progression aussi pour
le chemin catalogue d'artistes.** Signalé au check-up précédent comme
angle mort acceptable (pas corrigé sur le moment), puis demandé quand
même ("tan qu'à faire"). Le chemin de repli par catalogue d'artistes
(`ARTIST_CATALOG`, musicEngine.js) — SEUL chemin emprunté pour les genres
à mot-clé Deezer fragile (K-pop, etc.), et systématiquement en complément
pour les genres normaux — n'avait aucun signal de progression, contrairement
à la recherche généraliste Deezer. `fetchInBatches` (utilitaire partagé,
8 appels dans musicEngine.js) accepte désormais un 4e paramètre optionnel
`onBatchDone`, rétrocompatible (`null` par défaut, aucun effet sur les 7
autres appels). Utilisé sur CE chemin précis pour compter les candidats
valables lot par lot, plutôt qu'une conversion durée→titres (cette branche
n'accumule pas de durée "bon genre" comme la recherche généraliste).
⚠️ Cette 2e branche de progression tourne parfois APRÈS la recherche
généraliste dans le MÊME appel à `buildSegmentTracks`, sans être chaînée à
son compte — un vrai risque de régression visible (le compteur qui
redescend), mais déjà couvert par le clamp anti-régression posé juste
avant au niveau de l'affichage (`usePlaylistGeneration.js`) : aucun
changement nécessaire là, la protection était déjà générique. Tests
ajoutés dans `tests/engine/fetchInBatches.test.js`.

**14/08 — check-up post-chantier "titres au fur et à mesure" : clamp
anti-régression.** Pas un retour direct cette fois — trouvé en relisant
en détail la logique juste livrée (habitude actée : "vérifier son propre
travail avant de le considérer terminé", surtout sur du code sensible).
Cas limite réel : avec PLUSIEURS genres pondérés ensemble
(`config.genreWeights`), le moteur enchaîne une sous-recherche par genre —
chacune vise un pool à 1.5x la durée réellement nécessaire (marge pour la
sélection finale). L'estimation affichée pendant la recherche d'UN genre
pouvait donc dépasser le compte RÉEL finalement retenu pour ce même
genre ; au passage au genre suivant, la progression reprenait sur ce
compte réel (souvent plus bas) — le compteur du bandeau pouvait
visiblement REDESCENDRE d'un coup, l'air buggé plutôt qu'indicatif.
Corrigé par un clamp au niveau de l'affichage (`usePlaylistGeneration.js`,
PAS retouché dans musicEngine.js — la source du problème n'a pas besoin
d'être touchée pour le corriger, plus sûr) : le compteur affiché
n'accepte plus qu'une valeur strictement supérieure à la dernière
affichée, réinitialisé proprement à chaque nouvelle playlist d'un lot. 3
tests dédiés ajoutés.

**14/08 (suite) — bandeau de génération, système à paliers de temps +
compte de titres en direct.** Suite directe du chantier précédent
(`isGeneratingSlowGenre`/`isGeneratingLongPlaylist`) — l'utilisateur a
validé le principe d'un système à 3 paliers de temps (0-15s inchangé,
15-45s "un peu plus long que d'habitude", 45s+ normalise explicitement),
PUIS demandé si un temps indicatif selon la config était possible malgré
tout, PUIS si le nombre de titres pouvait évoluer EN DIRECT plutôt qu'une
simple estimation statique — 2 réflexions successives données avant
d'implémenter quoi que ce soit (temps chiffré réaffirmé écarté ; chantier
"live" évalué comme plus lourd — touche musicEngine.js — et validé
explicitement seulement après ça).
- **`musicEngine.js`** — `buildSegmentTracks`/`createPlaylistData`
  acceptent désormais un callback `onProgress(estimatedCount)`, threadé à
  travers la boucle de pages Deezer, la branche récursive des genres
  pondérés (cumul par compte RÉEL entre sous-appels, pas une estimation
  qui s'additionnerait sur elle-même), et les segments multiples en mode
  Fractionné (offset = titres déjà confirmés par les segments
  précédents). ⚠️ C'est une ESTIMATION du pool de candidats, PAS le
  décompte des titres FINAUX (la sélection réelle se fait d'un coup, une
  fois le pool construit) — voir la docstring complète dans le fichier.
  Calcul d'estimation extrait en fonction pure
  `estimateTrackCountFromDuration` (exportée, testée en isolation — même
  réflexe que `buildGeneratedPlaylistName`, 08/08, ces fonctions moteur
  n'étant pas testables directement, appels réseau réels).
- **`usePlaylistGeneration.js`** — nouveau paramètre
  `setGeneratingEstimatedTracksFound`, relayé depuis le callback du
  moteur avec garde-fou contre une mise à jour APRÈS annulation
  (`cancelToken.cancelled`, même principe que pour jeter le résultat
  final d'une génération annulée), réinitialisé à 0 au début, à
  l'annulation, et à la fin.
- **`App.jsx`** — nouvelle fonction `getGenerationBannerMessage()`
  (remplace un ternaire imbriqué devenu difficile à lire) : paliers 15-45s
  et 45s+ affichent le compte de titres réunis dès qu'il est disponible,
  sinon retombent sur le message de réassurance générique par palier.
- Tests dédiés dans `tests/engine/musicEngine.test.js` (la fonction pure
  extraite) et `tests/hooks/usePlaylistGeneration.test.js` (relais correct
  du callback, réinitialisations, garde-fou post-annulation).

**14/08 (suite) — bandeau de génération, séance longue.** Retour direct :
"passé la minute de génération, l'utilisateur a cru que ça avait planté"
sur une séance de plus d'1h. Réflexion faite AVANT d'implémenter (temps
"indicatif" chiffré écarté — pas de vraie donnée de timing pour le
calibrer, un chiffre inventé pourrait devenir une source d'inquiétude
supplémentaire s'il est dépassé) : la durée cible d'une séance est un
signal PRÉVISIBLE à l'avance, contrairement à un genre lent. Étendu le
mécanisme déjà existant pour les genres à mot-clé Deezer fragile
(`isGeneratingSlowGenre`) avec un 2e flag symétrique
(`isGeneratingLongPlaylist`, seuil ≥45 min, modes Temps/Distance — mode
Fractionné hors scope assumé, segments à sommer différemment). Le bandeau
combine désormais les deux raisons possibles (genre lent, séance longue,
ou les deux à la fois) plutôt qu'un message générique statique. Tests
dédiés ajoutés dans `tests/hooks/usePlaylistGeneration.test.js`.

**14/08 (suite) — compteur de clonages élargi à Découvrir.** Retour direct
avec 4 captures : "pourquoi je vois quand même le compteur de clonage à 0
pour la playlist que j'ai pourtant clonée ?". Diagnostic : `template_clone_counts`
ne s'incrémentait QUE via `handleClonePlaylist` (bouton "Sauvegarder" d'un
template ouvert depuis la vitrine `@tempofit_officiel`, chemin peu
emprunté) — jamais via `handleSavePlaylist` (bouton "Ajouter" d'un
template ouvert directement depuis Découvrir, LE chemin le plus emprunté
de très loin). Distinction délibérée à l'origine (02/08, voir
`TemplateCard.jsx`), reconsidérée sur confirmation explicite de
l'utilisateur : les deux chemins créditent désormais le même compteur, même
garde-fou (`sourceTemplateId`) et même philosophie fire-and-forget que
`handleClonePlaylist`. Tests dédiés ajoutés dans
`tests/hooks/usePlaylistLibrary.test.js`.

**13/08 — couverture de tests des hooks, suite du check-up du même jour.**
Les 11 hooks de `src/hooks/` sans fichier de test dédié en ont désormais
un (`usePersistentState.js`, `usePlaylistCompletions.js`,
`useSessionAnalysis.js`, `useFavorites.js`, `useSpotifyImport.js`,
`useDeezerSearch.js`, `useTrackSearch.js`, `useRoutines.js`, `useTheme.js`,
`useToast.js`, `useElapsedTimer.js`) — voir `tests/hooks/`. 3 vrais bugs
trouvés en écrivant ces tests, tous corrigés :
- `useToast.js` — un 2e `showToast()` rapproché ne annulait pas le
  minuteur du 1er (`clearTimeout` manquant) : un toast pouvait s'effacer
  avant sa propre durée écoulée. Corrigé (`useRef` + annulation).
- `usePersistentState.js`, **"push prématuré au montage"** — avec un
  compte déjà connecté, l'effet de push partait AVANT que le pull ait eu
  la main sur le réseau (2 appels systématiques au montage, dont un
  parfaitement inutile — et un vrai risque d'écraser une valeur distante
  plus récente avec la valeur locale de départ). Corrigé avec
  `readyForPushRef`, qui bloque le push tant que le pull n'a pas fini
  d'essayer pour l'utilisateur courant.
- `usePersistentState.js`, **`isApplyingRemoteRef` jamais réinitialisé
  si le pull ramène une valeur IDENTIQUE à la locale** — no-op React
  (aucun re-render), donc le flag restait bloqué à `true`, avalant
  silencieusement le TOUT PROCHAIN changement local légitime. Corrigé en
  n'armant le flag que si la valeur diffère réellement (`Object.is`).
- `useSpotifyImport.js` — scope volontairement réduit : `loginSpotify`
  (OAuth PKCE, `crypto.subtle.digest`) laissé hors test, pure plomberie
  navigateur sans branche métier, fragile à simuler en `jsdom`.
- **3 allers-retours de build Vercel réel** sur ce chantier (tous
  corrigés) — plusieurs erreurs de logique fine (piège "même valeur =
  no-op React", fuite d'un `mockReturnValueOnce` non consommé entre 2
  tests via `clearAllMocks()`) n'ont pu être détectées qu'au build réel,
  jamais à la seule lecture. `afterEach` de `usePersistentState.test.js`
  utilise désormais `resetAllMocks()` (pas `clearAllMocks()`), pour éviter
  toute fuite similaire à l'avenir.

**14/08 — infobulles manquantes, généralisé à toute l'app.** Parti d'un
retour direct avec capture d'écran (Mes Séances/Mes Routines), généralisé
en script de recherche sur tout `src/`. Trouvé et corrigé : ligne de
métadonnées de `App.jsx`/`PlaylistHeaderMeta.jsx` (4 icônes sans
infobulle), et un motif à plus forte valeur — un libellé ABRÉGÉ de zone
cardio affiché (`zone.shortLabel`, ex. "Seuil") sans jamais restituer le
libellé COMPLET déjà présent sur la donnée (`zone.label`, ex.
"Seuil / Tempo") — corrigé à 6 endroits
(`TrackItem.jsx`/`AthleticProfilePanel.jsx`/`StatsView.jsx`(×3)/
`PlaylistHeaderActions.jsx`/`SessionSummaryCard.jsx`, ce dernier
nécessitant de restructurer `bars` pour porter un `title` distinct du
`label` affiché). 2 nouvelles conventions actées dans ce README (section
dédiée plus bas) : infobulles sur icônes seules, soulignement permanent
d'un pseudo cliquable vers un profil (déjà cohérent partout, rien à
corriger sur ce 2e point — juste documenté). Couverture de tests comblée
en même temps : `tests/shared/SessionSummaryCard.test.jsx` (nouveau, 0
test avant), nouvelle section dans `tests/views/StatsView.test.jsx` pour
les 3 infobulles de zones cardio de cette page.

Prochaine session : partir des sections plus bas (décisions
d'architecture, contraintes, limites connues) et du code réel.

# TempoFit — Historique détaillé, bloc 5 (19-20/08, check-up, bugs récurrents, renommage, fusion navigation, écritures concurrentes)

⚠️ Copie exacte de la section "État d'avancement" du README au moment de
l'élagage du 20/08 (5e élagage — session particulièrement dense : check-up
global, plusieurs vagues de correctifs de bugs récurrents, renommage
terminologique complet, fusion Routines/Playlists en onglet, réorganisation
de la Sidebar et de "Découvrir", et enfin le correctif d'écritures
concurrentes différé depuis le 10/08). Aucun contenu réécrit ni résumé.

⚠️ Note ajoutée à l'archivage (PAS dans le texte original ci-dessous,
resté intact) — la toute dernière ligne de ce bloc affirme que le
découpage d'`App.jsx` n'a "pas été entrepris dans la foulée" : c'était
vrai au moment où c'était écrit, mais un 1er lot (cluster StatsView) a
finalement été fait plus tard dans cette même session, une fois cette
phrase déjà actée. Voir la section "Découpage App.jsx" du README (pas
archivée, reste à jour) pour l'état réel.

### 19/08 — check-up global du projet, 2 bugs réels corrigés + couverture de tests comblée

Check-up demandé sans chantier précis en tête ("vois-tu des erreurs ou des
optimisations à réaliser ?") — méthode : README/HISTORIQUE d'abord, puis
`esbuild`+`tsc --checkJs` sur 100% de `src/`+`tests/`, résolution des
imports, piège Tailwind, vérification mécanique de `supabase-schema.sql`
(tout propre, 0 régression), puis lecture ciblée des zones à risque.

- **`ModalContext.jsx` — `closeModal()` fermait TOUJOURS sans condition,
  même appelé tardivement après un `await`.** Un commentaire affirmait à
  tort qu'un filet de sécurité existait déjà. Risque réel identifié :
  `shareNative()`/`copyToClipboard()` (`useShare.js`) attendent une
  opération asynchrone avant de fermer — si l'utilisateur ouvrait une AUTRE
  modale entre-temps, l'ancien `closeModal()` la fermait par erreur.
  **Corrigé** : `closeModal(name)` accepte désormais un nom de modale
  optionnel et ne ferme que si c'est bien elle qui est active ; seuls les 2
  points d'appel réellement asynchrones (`useShare.js`) passent ce nom, les
  8 autres appelants (synchrones, sans risque) restent inchangés. Tests :
  `tests/contexts/ModalContext.test.jsx` (nouveau, jusqu'ici 0 test dédié)
  + assertions renforcées dans `useShare.test.js`.
- **`AuthContext.jsx` — seul des 8 Contexts du projet où le correctif
  "value non mémoïsée" (08/08) n'avait jamais été appliqué.** Plus important
  qu'il n'y paraît ici : `usePersistentState.js`/`useSyncedCollection.js`
  (appelés une fois PAR CLÉ persistée dans toute l'app) lisent tous les deux
  `useAuthContext()` en interne — un changement d'état interne sans rapport
  avec `user`/`authLoading` (ex. `usernameLoading`) re-rendait indirectement
  tous ces hooks à travers toute l'app. **Corrigé** : les 11 fonctions
  stabilisées via `useCallback` (dépendances vérifiées une à une), `value`
  mémoïsée via `useMemo`. Tests de stabilité référentielle ajoutés dans
  `tests/contexts/AuthContext.test.jsx`.
- **Couverture de tests comblée** (aucun bug trouvé dans ces fichiers,
  simple lacune) : `spotifyEngine.js` (159 lignes, jamais testé — cascade de
  résolution BPM, pagination, distinction 401/403), les 5 fichiers
  `src/layout/*.js` (constantes pures, mais testées avec de VRAIES
  vérifications de synchronisation contre le code source consommateur —
  pas de simples assertions de valeur), `GeneratorContext.jsx` et
  `AudioPlayerContext.jsx` (les 2 derniers Contexts sans test dédié).
- **Repéré, pas corrigé (hors scope du check-up)** : `AuthContext.jsx`
  n'est pas couvert par le garde-fou `criticalExportsTrap.test.js` (qui
  vérifie que les Providers exportent bien ce qu'ils promettent) —
  contrairement aux 6 autres Contexts du projet. À ajouter si une session
  future touche ce garde-fou.
- `vercel.json` (`"deploymentEnabled": false`) — confirmé volontaire par
  l'utilisateur (19/08), maintenant documenté dans "Contraintes de travail"
  plus bas plutôt que redit ici.

### 19/08 (suite) — généralisation du motif "clear inconditionnel après un `await`", 2 bugs réels de plus trouvés et corrigés

Après le check-up ci-dessus, retour à l'habitude "un bug trouvé =
généraliser sa recherche" (voir `CLAUDE-SANDBOX-VERIFICATION.md`) : le motif
exact du bug `ModalContext.jsx` corrigé plus haut (un state "ressource
active actuelle" remis à `null` SANS CONDITION après un `await`, sans
revérifier qu'il s'agit toujours de la bonne ressource) cherché ailleurs
dans le projet.

- **`useCsvImport.js` — `csvUploadTargetDate` effacé sans condition** dans le
  `finally` de `handleCSVUpload` (qui lit un fichier CSV de façon
  asynchrone). Scénario réel : import CSV pour une date A lancé, lecture en
  vol ; l'utilisateur lance un 2e import pour une date B avant que A ne
  finisse ; la lecture de A se termine et efface la date de B par erreur —
  le 2e import échoue SILENCIEUSEMENT dès que l'utilisateur sélectionne son
  fichier, sans le moindre message. **Corrigé** avec un `Ref`
  (`csvUploadTargetDateRef`), même convention que les 2 refs déjà en place
  dans ce fichier pour le correctif de course du 10/08. 2 tests de
  régression ajoutés.
- **`useAudioPreview.js` — `resolveAndPlay`, même famille mais plus
  consé­quente.** Le garde-fou existant (`resolvingTrackId === track.id`)
  ne bloquait qu'un double-clic sur LE MÊME titre — rien n'empêchait de
  cliquer un titre B pendant que la résolution Deezer (réseau) d'un titre A
  était encore en vol. Si A se résolvait APRÈS que B ait été demandé,
  `playTrack` lançait quand même la lecture de A, alors que l'utilisateur
  ne l'avait plus demandé. Décision tranchée (19/08, utilisateur) : une
  résolution devenue obsolète doit être **ignorée entièrement**, jamais
  jouée après coup. **Corrigé** avec `resolvingTrackIdRef`, même
  convention — la résolution la plus ancienne se voit ignorée en silence
  (pas de toast, pas de lecture) si une plus récente a pris sa place entre
  temps ; son `finally` ne clairé plus non plus l'indicateur de chargement
  d'une résolution plus récente. Tests de régression ajoutés (course A/B
  complète, + les 3 cas de base qui n'avaient encore aucun test).

### 19/08 (suite 2) — build Vercel réel cassé, 3 bugs distincts rattrapés AVANT déploiement

Le build a échoué sur 4 tests dans 3 fichiers — aucun n'était un faux
positif, les 3 étaient de VRAIS bugs, dont un a nécessité de revenir sur le
design du correctif `ModalContext.jsx` ci-dessus.

- **`ModalContext.jsx` — le 1er correctif ("closeModal(name) optionnel")
  cassait tout branchement JSX direct.** `onClick={closeModal}` /
  `onClose={closeModal}` (12 endroits : `ModalContainer.jsx`, `App.jsx`,
  `EditPlaylistModal.jsx`) font que React appelle la fonction avec l'OBJET
  ÉVÉNEMENT comme 1er argument — qui devenait `name`, empêchant la modale de
  se fermer (l'événement n'est jamais `undefined`, ni égal au nom de la
  modale active). Détecté par un test PRÉEXISTANT
  (`PlaylistEditContext.test.jsx`), pas un nouveau test — preuve que la
  couverture existante suffisait à l'attraper. **Corrigé en profondeur** :
  `closeModal()` redevient une fonction à ZÉRO paramètre déclaré (donc
  totalement insensible à ce qu'on lui passe, sûre en JSX direct), la
  version scopée devient une fonction au nom DISTINCT,
  `closeModalIfActive(name)` — jamais branchée directement en JSX, plus
  aucune ambiguïté possible. `useShare.js` mis à jour en conséquence. Un
  test de régression DIRECTE de ce piège ajouté (monte un vrai
  `onClick={closeModal}` et simule un vrai clic).
- **`useAudioPreview.js` — le ref `resolvingTrackIdRef` du correctif
  précédent pouvait être PÉRIMÉ même SANS aucune course réelle.** Il n'était
  réassigné qu'au RENDU suivant (`resolvingTrackIdRef.current =
  resolvingTrackId`, en haut du hook) — jamais de façon synchrone au moment
  de l'appel. Comme un `setState` ne déclenche un re-rendu qu'au tour
  suivant de la boucle d'événements, rien ne garantissait que React ait
  re-rendu avant que l'`await` réseau de `resolveAndPlay` ne se résolve : la
  comparaison pouvait échouer sur une résolution parfaitement seule.
  Détecté par les tests ajoutés la veille (mock résolu quasi
  instantanément). **Corrigé** en écrivant ce ref DIRECTEMENT, de façon
  SYNCHRONE, au moment même de chaque `setResolvingTrackId` — la ligne au
  rendu reste en complément, mais n'est plus la seule source de vérité. Même
  correctif défensif appliqué à `csvUploadTargetDateRef`
  (`useCsvImport.js`, `triggerCSVUpload`) par cohérence, même si sa fenêtre
  de risque réelle est plus large (délai OS/FileReader) et n'avait pas
  encore été prise en défaut.
- **`spotifyEngine.test.js` — bug de test pur (pas de code source).**
  `const fetchSpy = vi.stubGlobal('fetch', vi.fn())` — `vi.stubGlobal`
  renvoie `vi` lui-même (chaînage), jamais la valeur stubbée. Corrigé en
  capturant le mock à part avant de le passer à `stubGlobal`.

**Motif à retenir** : ajouter un paramètre optionnel à une fonction déjà
branchée ailleurs en JSX (`onClick={fn}`) est dangereux — React y passe
toujours l'événement comme 1er argument. Dans ce genre de cas, mieux vaut
une fonction au nom DISTINCT qu'un paramètre optionnel ambigu.

### 19/08 (suite 3) — 2e passage du build Vercel réel, 1 dernier bug (import manquant)

Sur 1444 tests, 1 seul en échec : `tests/contexts/ModalContext.test.jsx`
(le test qui reproduit le piège `onClick={closeModal}` avec un vrai clic
JSX) plantait avec `Invalid Chai property: toHaveTextContent`. Cause :
**ce projet n'a PAS de `setupFiles` global** dans `vite.config.js` — chaque
fichier de test qui utilise un matcher `jest-dom` (`toHaveTextContent`,
`toBeInTheDocument`...) doit l'étendre lui-même via
`import '@testing-library/jest-dom/vitest';` (voir
`PlaylistEditContext.test.jsx` pour la convention déjà en place). Oublié
dans ce nouveau fichier de test. **Corrigé** — import ajouté. Vérifié
qu'aucun autre fichier créé/modifié le même jour n'a le même oubli (grep
sur les matchers `jest-dom` usuels croisé avec la présence de cet import).

**Motif à retenir (2)** : ce projet n'a pas de `setupFiles` vitest — TOUJOURS
vérifier qu'un nouveau fichier de test qui monte un composant React ET
utilise un matcher `jest-dom` importe bien `@testing-library/jest-dom/vitest`
lui-même, une convention facile à oublier puisqu'aucune erreur ne se
manifeste avant l'exécution réelle (jamais vue dans ce bac à sable, esbuild/tsc
ne peuvent pas la détecter).

### 20/08 — "Mes Routines" fusionnée en onglet de "Mes Séances" (retour direct + suite d'un échange de position)

Retour direct, capture à l'appui : "j'imagine la partie routines comme un
onglet spécifique du menu séance ; un peu comme quand on voit la vue d'un
profil utilisateur où les 2 sont présents dans la même page" — précédé le
même jour d'un simple échange de position Séances/Routines entre les 2
sections de la Sidebar (devenu sans objet suite à cette fusion complète).
Même pattern d'onglets EXACTEMENT que celui déjà en place sur
`ProfileView.jsx` (visite du profil de quelqu'un d'autre) — visiter SON
PROPRE espace suit désormais la même logique que visiter celui d'un autre.

- **`RoutinesView.jsx`** réduit à son seul CORPS (grille de cartes) — plus
  de `<ViewHeader/>` ni de wrapper propres, devient un sous-composant
  monté directement (import statique, pas lazy) par `PlaylistsView.jsx`.
- **`PlaylistsView.jsx`** devient le shell : titre/sous-titre/icône du
  `<ViewHeader/>` changent selon l'onglet actif (`activeTab`), sélecteur
  d'onglets Séances/Routines (même markup que `ProfileView.jsx`, avec
  compteur). `initialTab` — MÊME mécanisme exact que
  `initialTab`/`handleOpenSettings` de `SettingsView.jsx` (lazy init via
  `useState`, jamais une valeur périmée d'une visite précédente). Derniers
  textes visibles "playlist" → "séance" alignés au passage dans cette vue
  (cohérent avec le renommage StatsView.jsx du même jour) — le bouton CTA
  "Générer ma première playlist" lui-même volontairement PAS touché, pas
  explicitement validé.
- **`App.jsx`** : nouveau point d'entrée unique `handleOpenPlaylists(tab)`
  (même schéma que `handleOpenSettings`), remplace les 2 anciens
  `changeView('routines')` (clonage d'une routine publique + consultation
  de sa propre routine publique depuis son profil). Bloc de rendu séparé
  `view === 'routines'` retiré ; import `lazy()` mort de `RoutinesView`
  retiré (n'est plus une route de premier niveau).
- **`Sidebar.jsx`** : bouton "Mes Routines" retiré de "Mon Espace" (plus
  qu'un seul lien, "Mes Séances", dans "Création") ; import `ListPlus`
  mort retiré.
- Tests : `RoutinesView.test.jsx` n'a eu besoin d'AUCUNE modification
  (aucune de ses assertions ne portait sur l'en-tête retiré) — juste sa
  docstring mise à jour. `PlaylistsView.test.jsx` enrichi (`baseProps`
  avec le jeu minimal de props routines, nouvelle section dédiée à la
  bascule d'onglet — compteurs, changement d'en-tête, contenu réel de
  `RoutinesView.jsx` non mocké, `initialTab`).

### 20/08 (suite) — build Vercel réel cassé par la fusion, 1 garde-fou à ajuster (pas un bug)

`tests/layout/viewHeaderLayout.test.js` (écrit la veille, check-up global)
a fait exactement son travail : `RoutinesView.jsx` a gardé son nom en
"*View.jsx" (continuité historique, extraite de App.jsx le 25/07) mais
n'est PLUS une vraie vue de premier niveau depuis la fusion ci-dessus — le
garde-fou l'a détecté (`VIEW_CONTENT_WRAPPER`/`VIEW_HEADER_ICON_SIZE`
absents). Pas un bug de la fusion elle-même : `RoutinesView.jsx` ne DOIT
plus les utiliser (c'est `PlaylistsView.jsx` qui les possède pour les 2
onglets désormais) — c'est le garde-fou qui devait être mis à jour pour
refléter cette nouvelle réalité. **Corrigé** : `RoutinesView.jsx` exclue
explicitement du filtre `viewFiles()` (commentaire détaillé sur le
pourquoi), les 2 seuils numériques ajustés au compte réel actuel (10 → 9
fichiers de vue, 8 → 7 utilisant l'icône standard). Chaque assertion
rejouée manuellement en Node avant livraison (aucun `vitest` réel
disponible dans ce bac à sable).

### 20/08 (suite 4) — retour terrain, renommage complet "séance" → "playlist" sur les 2 destinations principales

Retour direct, capture à l'appui : "la notion de 'séance' parle aux
utilisateurs qui font du sport régulièrement (cœur de cible) mais beaucoup
moins à ceux qui testent juste par curiosité, ils se disent pas qu'il y a
une playlist même si on fait bien plus." Décision : "Nouvelle séance" →
"**Nouvelle Playlist**", "Mes Séances" → "**Mes Playlists**" — assumée
réversible par l'utilisateur.

**Ce que ça referme, en creusant** : "Mes Playlists" est en fait le nom
D'ORIGINE de cette vue (avant le renommage du 25/07 vers "Mes Séances",
lui-même motivé par la cohérence avec le reste de l'app à l'époque). Pas
une hésitation : deux signaux différents à 3 semaines d'écart, chacun
valide en soi (cohérence terminologique interne le 25/07, clarté pour un
public élargi le 20/08).

**Portée du renommage** : les 2 labels de la Sidebar + TOUT le texte
utilisateur qui référence "Mes Séances" comme nom de destination
(boutons, toasts, tooltips) dans ~15 fichiers — mais PAS les usages
génériques du mot "séance" (une playlist/un entraînement individuel,
ex. "cette séance déjà réalisée"), non demandés et non touchés. Onglet
"Mes Routines" (2e onglet de la même vue fusionnée) non concerné.

**2 citations verbatim historiques rattrapées** (`usePlaylistLibrary.js`)
— un remplacement global (`sed`) avait d'abord altéré à tort 2 retours
utilisateur cités entre guillemets, datés du 10/08 (époque où la
destination s'appelait encore "Mes Séances") : restaurées pour rester
fidèles à ce qui a vraiment été dit à l'époque, plutôt que de réécrire
l'histoire avec le vocabulaire d'aujourd'hui.

**1 vrai oubli rattrapé avant livraison** : 4 assertions de
`PlaylistsView.test.jsx` (écrites la veille pour la fusion en onglet)
vérifiaient encore l'ancien titre "Mes Séances" — auraient fait planter
le prochain build si non corrigées. Trouvé par un grep de vérification
systématique sur `tests/`, pas par une exécution réelle (toujours
indisponible dans ce bac à sable).

### 20/08 (suite 5) — recherche de profils fusionnée dans "Découvrir" (retour direct)

Retour direct : "pouvoir chercher un compte utilisateur directement depuis
l'onglet découvrir, via un onglet dans la barre de recherche." Investigation
avant d'implémenter : la fonction serveur `search_public_profiles` a le
MÊME double verrou (`revoke ... from anon`) que la consultation de profil
(`get_public_profile_summary`) — ouvrir la recherche aux invités aurait
défait une décision de sécurité délibérée du 01/08 (énumération de pseudos
existants par un visiteur anonyme, sujet différent de "peut-on consulter un
profil déjà trouvé"). Décision retenue après échange : déplacer la
recherche pour les connectés maintenant, message incitatif pour les
invités à la place de la recherche elle-même (pas juste un masquage comme
avant).

- **`DiscoverView.jsx`** — l'ancienne pastille "Profils" séparée (01/08,
  masquée pour un invité, ouvrait `SearchUsersModal.jsx`) est retirée,
  remplacée par un VRAI sélecteur de mode ("Séances"/"Profils", même
  markup que les onglets déjà en place sur `PlaylistsView.jsx`/
  `ProfileView.jsx`) juste au-dessus de la barre de recherche — la MÊME
  barre sert aux deux, seul ce qu'elle interroge change. Logique de
  recherche de profils (debounce 350ms, `search_public_profiles`) reprise
  À L'IDENTIQUE de `SearchUsersModal.jsx` (toujours d'actualité,
  accessible aussi depuis le menu avatar — 2 chemins vers la même
  fonctionnalité, pas dupliquée en profondeur). Invité sur l'onglet
  "Profils" : message incitatif ("Rejoins la communauté TempoFit...")
  avec CTA vers `AUTH`, pas de champ de recherche actif.
- **`App.jsx`** — nouvelle prop `onViewProfile={handleViewProfile}`
  passée à `DiscoverView` (callback générique déjà utilisé par
  `SearchUsersModal`/`handleOpenPublicRoutine`, pas dupliqué).
- Tests : bloc "pastille Profils" entièrement réécrit
  (`DiscoverView.test.jsx`) — mock `supabase.rpc` ajouté (absent
  jusqu'ici, aurait planté au 1er test touchant l'onglet), fake timers
  SCOPÉS au nouveau bloc de tests uniquement (pas globaux : un test
  existant plus bas utilise `waitFor` avec de vrais timers pour le
  compteur de clonages, les mélanger l'aurait cassé).

### 20/08 (suite 6) — écritures concurrentes corrigées (chantier différé depuis le 10/08)

"Les modifs de navigation auxquelles je pensais" jugées faites — chantier
lancé volontairement APRÈS elles, comme annoncé le 10/08. Voir la
section dédiée plus bas ("Corrigé (20/08)", anciennement "Limite connue,
non traitée") pour le détail technique complet du correctif
(`applyPlaylistUpdate`, recherche par ID stable). Chantier de découpage
d'`App.jsx` — l'autre moitié de ce qui était différé au même titre —
PAS entrepris dans la foulée : plus gros, plus risqué, volontairement
laissé pour une session séparée plutôt que d'enchaîner deux chantiers
structurels d'affilée.

# TempoFit — Historique détaillé, bloc 6 (21-22/08, découpage App.jsx, TabPills, Sidebar/Mode Intime, découverte Playwright/vitest, corrections visuelles)

⚠️ Copie exacte de la section "État d'avancement" du README au moment de
l'élagage du 22/08 (session exceptionnellement longue et dense — reprise
du découpage `App.jsx`, standardisation des onglets, plusieurs passes sur
la Sidebar, et surtout la découverte que le bac à sable Claude a en
réalité accès à `npm install`/un vrai serveur `vite`/Playwright/`vitest
run`, jamais vérifié depuis la création de ce projet). Aucun contenu
réécrit ni résumé au-delà de cette copie d'ouverture.

### 21/08 — check-up initial, sans chantier précis en tête

Check-up demandé en début de session ("vois-tu des choses à corriger ou
optimiser ?"). Un bug réel trouvé et corrigé : `ImportSharedPlaylistModal.jsx`
avait survécu au renommage "séance"→"playlist" du 20/08 sur UNE phrase
("tu peux l'ajouter à tes propres Séances" — nom propre de destination,
resté en l'état alors que le bouton juste en dessous disait déjà "Ajouter
à Mes Playlists"). Corrigé, grep multi-sous-chaînes pour confirmer
l'absence d'autre copie. 2 vrais trous de couverture de test comblés
(`TrophiesView.jsx`/`MiniPlayerBar.jsx`, 0 test avant malgré une logique
non triviale — masquage des trophées secrets, mute-par-clic avec mémoire
du niveau précédent).

### 21/08 — Découpage `App.jsx` repris, 3 extractions

Chantier repris après le 1er lot (StatsView, 20/08) :
- **`ShareImageContext.jsx`** (nouveau) — cluster "Image de partage" (4
  `useState`, prop-drillés sur 2 niveaux vers `PlaylistDetailViewInner`)
  extrait en Contexte dédié, `value` mémoïsée. `PlaylistDetailView.jsx`/
  `ShareModal.jsx` migrés dessus.
- **`GenerationProgressBanner.jsx`** (nouveau) — cluster "Génération" :
  contrairement à "Image de partage", le STATE (6 `useState`) ne peut PAS
  suivre en Contexte (ses setters sont des arguments directs de
  `usePlaylistGeneration()`, un hook appelé avant le `return` d'AppContent
  — contrainte d'ordre entre hooks). Seul le RENDU (JSX du bandeau + le
  calcul du message à 3 paliers) extrait en composant présentationnel,
  recevant tout en props. 1er fichier de test pour ce bandeau (0 couverture
  avant, JSX inline dans un fichier lui-même sans test miroir).
- **"Navigation" audité, PAS extrait** — 8 `useState`. Audit révèle que
  l'affirmation "tous partagés" du 20/08 était une supposition, pas un
  audit réel : 3 sont en fait purement locaux (`isUserMenuOpen`,
  `isScrolled`, `isGuestBarDismissed`) — Contexte inutile pour eux. Des 5
  restants, `view`/`isMobileMenuOpen` sont bloqués par la MÊME contrainte
  d'ordre entre hooks que "Génération" (`changeView`/`openCuratedPlaylist`
  passés en argument direct à `usePlaylistLibrary`/`usePlaylistGeneration`).
  Les 3 derniers (`viewingProfileUsername`/`settingsInitialTab`/
  `playlistsInitialTab`) n'ont pas ce blocage mais n'apportent aucun gain
  réel (déjà de simples props à 1 niveau, pas de prop-drilling profond à
  éliminer). Conclusion : ni "Génération" ni "Navigation" ne sont de bons
  candidats à un Contexte — chacun pour sa propre raison précise, vérifiée,
  pas des oublis.
- **Bug réel trouvé PUIS le composant entièrement retiré** — `isScrolled`
  était déclaré et lu (header flottant desktop) mais son setter n'était
  appelé NULLE PART : ce header n'avait jamais pu apparaître depuis sa
  création. 1er réflexe : réparer (listener de scroll ajouté). Une fois le
  header VRAIMENT visible pour la première fois (retour direct avec
  capture), 2 problèmes de fond sont apparus qu'aucune lecture de code
  seule n'aurait révélés : (1) son seul commentaire d'origine dit lui-même
  qu'il "dupliquait le comportement du logo Sidebar" — logo qui, sur
  desktop, est déjà TOUJOURS visible ; (2) son sous-titre
  (`displaySubtitleGen`) est câblé en dur sur le tagline du GÉNÉRATEUR,
  jamais contextuel à la vue réellement affichée. Retiré intégralement
  (JSX + `isScrolled`/`mainScrollRef`/le listener + `displaySubtitleGen` de
  la déstructuration d'AppContent). Leçon retenue : un `useState` "cassé"
  trouvé en audit n'est pas automatiquement un bug à réparer — vérifier
  D'ABORD si la fonctionnalité qu'il pilote a encore sa place.

### 21/08 — Bio du profil vitrine, 3 essais avant la bonne version

Retour direct : ajouter un texte expliquant que `@tempofit_officiel` est
un compte de démonstration. 3 essais successifs, chacun rejeté pour une
raison précise avant d'arriver à la bonne version :
1. Bandeau séparé façon alerte (même style que "Aperçu de ton profil") —
   rejeté : "pas du tout, je pensais un encart façon bio".
2. Ligne repliée DANS la carte d'en-tête mais encore traitée comme une
   notice système (icône, texte `textMuted`, séparateur `border-t`) —
   rejeté : toujours pas le ton "bio" voulu.
3. **Version retenue** : texte en `textHighlight` (blanc en mode sombre,
   vérifié dans `index.css`), sans icône ni séparateur, sous-titre changé
   en "Compte vitrine TempoFit". Comportement ensuite aligné sur le
   pattern déjà en place pour la description de playlist
   (`whitespace-pre-line line-clamp-3` + `title=` tooltip), PAS la couleur
   (`textHighlight` gardé, pas le `text-slate-300` codé en dur de
   l'original — verdict explicite de l'utilisateur avant de coder : "aligne
   les 2, ça me semble plus pertinent, toi aussi ?"). Texte lui-même
   raccourci une dernière fois (retrait de la répétition "Compte vitrine
   officiel de TempoFit —", déjà dite par le sous-titre juste au-dessus).
   **Décision actée pour plus tard** : cette carte sert de banc d'essai
   volontaire pour une future vraie bio éditable par tous les
   utilisateurs — documenté en tant que tel dans une nouvelle section
   README dédiée ("Décidé mais pas encore construit").

### 21/08 — `TabPills.jsx` : standardisation des onglets (5 vues)

Retour direct : "pourquoi c'est pas le même modèle pour Routines et pour
Réglages ?" — `SettingsView.jsx` avait dérivé vers un style soulignement
pendant ~3 semaines sans que personne ne s'en aperçoive. En creusant pour
répondre à "ça vaut le coup de standardiser ?" (réponse : oui), 2e dérive
trouvée : `TrophiesView.jsx` avait SON PROPRE style ("contrôle segmenté",
fond+ombre), différent du style plat déjà majoritaire ailleurs (4 vues
contre 1). Composant `TabPills.jsx` extrait (contrôlé, aucun state
interne, `label` accepte un `ReactNode` pour couvrir compteurs/icônes sans
props dédiées) et les 5 vues migrées dessus
(`PlaylistsView`/`ProfileView`/`DiscoverView`/`SettingsView`/
`TrophiesView`) — `TrophiesView.jsx` perd son fond/ombre au profit de la
cohérence, changement visuel assumé. 1er fichier de test pour ce
composant.

### 21/08 — Sidebar : "Découvrir" isolé, puis Mode Intime resserré en 3 passes

- **"Découvrir" déplacé hors de "Création"** — ce n'est ni créer pour soi
  ni consulter ce qui est à soi, une 3e intention distincte. D'abord avec
  un titre de section "Découverte" — retiré le jour même (retour direct :
  un en-tête pour un seul lien au nom quasi-identique ne groupait rien,
  contrairement à "Création"/"Mon Espace" qui groupent chacun 2 liens
  distincts). Titre cliquable envisagé puis écarté (aurait cassé la
  convention "titres jamais interactifs" du reste de la Sidebar).
- **Espacement Mode Intime resserré en 3 passes successives**, toutes sur
  les 5 mêmes écarts marqués par capture annotée : -2px, encore -2px, puis
  -3px (total -25px cumulé). Chaque passe a dû trouver un nouveau levier
  une fois le précédent épuisé (padding du bouton "Quitter le Mode
  Intime" → `scrollPadding` compact jamais touché avant → séparateurs
  compacts créés pour la 1re fois). Un levier explicitement REFUSÉ malgré
  la tentation : `SIDEBAR_LINK_PADDING_COMPACT`/`SIDEBAR_LINK_GAP_COMPACT`,
  déjà testés plus serrés le 29/07 et explicitement rejetés à l'époque
  ("trop agressif, tasse trop la navigation") — signalé à l'utilisateur
  plutôt que retouché sans consultation.

### 21/08 — Découverte majeure : `npm install`/`vite`/Playwright/`vitest run` fonctionnent réellement en sandbox

En cherchant à diagnostiquer une "barre quasi invisible" trop subtile pour
être tranchée à la lecture du code seul (artefact de rendu : un coin de
carte arrondi touchant à 0px près une ligne de séparation du wizard
générateur), tentative de `npm install` — **succès**, alors que
`CLAUDE-SANDBOX-VERIFICATION.md` affirmait depuis l'origine du projet que
le bac à sable n'avait aucun accès réseau. Corrigé aussitôt (titre +
intro du fichier, nouvelle section §5ter). Un vrai serveur `vite` + un
navigateur Playwright permettent désormais de mesurer des positions RÉELLES
(`getBoundingClientRect`) plutôt que de deviner depuis les classes
Tailwind. Immédiatement après, `npx vitest run` testé sur la suite
ENTIÈRE : **113 fichiers, 1506 tests, tous passent** — "les tests
passent" n'a donc plus besoin de rester une simple lecture attentive
quand le temps le permet. Limite qui reste réelle : ce navigateur n'a
toujours aucun accès réseau EXTERNE (pas de vrai Supabase/Deezer), donc
seulement utilisable pour des écrans qui fonctionnent en state local.

Correctif du bug d'origine (coin de carte touchant la ligne du pied de
page, `GeneratorWizard.jsx`) : 1er réflexe (ajouter un `pb-3`, 12px de
plancher) fonctionnait mais coûtait de la hauteur — retour direct
immédiat avec 2 nouvelles captures : "pourtant j'ai du scroll, j'aurais
plus supprimé ta ligne qui sert à rien". Meilleure solution retenue :
retirer la ligne (`border-t border-gray-100 dark:border-gray-800`)
elle-même plutôt que lui laisser de la place — déjà quasi invisible,
donc rien perdu visuellement, et plus rien à toucher pour l'artefact.
Gain NET de hauteur par rapport à l'état d'avant tout ce chantier (0px
ajouté, contre +12px avec le 1er correctif). Revérifié en conditions
réelles sur le pire cas (mode Crescendo, viewports 800px et 700px) : 0px
de dépassement de page.

### 22/08 — En-tête de playlist : badge "Lecture seule" puis Corbeille mal alignés avec le badge BPM — 1re vérification erronée corrigée

Retour direct avec capture annotée : le badge "Lecture seule" (`Lock`)
utilisait un décalage FIXE (`right-4`, 16px) qui ignorait le vrai padding
de la carte (`p-6 md:p-8`) — corrigé en `right-6 md:right-8`, vérifié à
0px d'écart en conditions réelles (serveur de dev + Playwright).

Retour direct suivant, MÊME constat sur le bouton Corbeille (cas
`isSaved`, Globe+Trash2 au lieu de Lock) — **1er diagnostic erroné** :
mesuré la boîte cliquable du bouton (`button.getBoundingClientRect()`),
trouvé 0px d'écart, conclu à tort que le correctif précédent suffisait
déjà. Contesté à raison par l'utilisateur ("menteur") avec le fichier
exact + une nouvelle capture. Reprise rigoureuse : mesuré le SVG de
l'icône LUI-MÊME, pas son bouton englobant → 8px d'écart réel. Cause :
Trash2/Globe sont des icônes seules (14px) centrées dans un bouton de
30px (`p-2`, padding invisible pour la zone de survol) — contrairement au
badge BPM ou au badge Lock, qui ont une bordure/un fond VISIBLE remplissant
toute leur boîte. Corrigé (`-mr-2` sur le bouton Corbeille, annule
exactement son padding droit), revérifié sur le bon repère cette fois
(SVG, pas bouton) : 0px pile. Leçon ajoutée à `CLAUDE-SANDBOX-
VERIFICATION.md` (§5quater) : pour un alignement visuel, toujours mesurer
le glyphe/contenu visible réel, jamais seulement la boîte du conteneur
cliquable.

### 22/08 — Petits retouches finales

- `MiniPlayerBar.jsx` : préfixe "Playlist :" retiré devant le nom de la
  playlist (retour direct — redondant, le nom suit déjà et le tooltip/la
  ligne "Titre X/Y" en dessous donnent déjà le contexte).
- Suggestion de mettre les stats sportives du profil dans l'espace vide
  de l'en-tête (à côté de l'avatar) discutée et écartée : cette section
  n'est pas spécifique à la vitrine (vraie fonctionnalité pour tous les
  profils), et un 2e bloc symétrique existe ("Statistiques Mode Intime")
  qui ne pourrait pas suivre dans le même espace réduit — incohérence
  potentielle si un profil affiche les deux. Laissé tel quel après
  discussion, décision explicitement actée comme "pas du pinaillage".
