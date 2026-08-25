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
