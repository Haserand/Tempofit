## 4ter. Écrire un premier fichier de test pour un composant existant — vérifier les VRAIS types de props par défaut, jamais deviner

Trouvé le 02/08 (1er fichier de test de `StatsView.jsx`, chantier "compteur
de clonages") : `esbuild`/`tsc --checkJs` ne peuvent PAS attraper une
mauvaise supposition sur le TYPE d'une prop stubée dans un test — un stub
`selectedStatsGenre: null` passe la vérification syntaxique/de références
sans problème, mais plante à l'EXÉCUTION réelle si le composant appelle
`.size` dessus (`TypeError: Cannot read properties of null`) parce que la
vraie valeur par défaut, dans le composant appelant (`App.jsx`), est
`new Set()` — jamais `null`. Ni esbuild ni tsc (sans les vrais types du
projet, absents ici) ne peuvent détecter ce genre d'incompatibilité de
forme.

**Règle** : en écrivant un PREMIER fichier de test pour un composant qui
n'en avait pas encore, ne jamais deviner le type par défaut d'une prop
d'après son nom (`selectedStatsGenre` "sonne" comme si `null` était un état
initial raisonnable — ce n'est pas le cas ici). Toujours `grep` la vraie
déclaration `useState(...)` dans le composant PARENT qui la fournit (ici
`App.jsx`, `<StatsView selectedStatsGenre={selectedStatsGenre} ...>`) avant
d'écrire le stub — un aller-retour de plus à la lecture du code, mais qui
évite un aller-retour de build Vercel complet (60+ secondes) pour une
faute qui se serait vue en 10 secondes de `grep`.

## 4quinquies. `ProfileView.jsx` — tout changement doit être vérifié CONTRE la vitrine (`@tempofit_officiel`), pas seulement contre un vrai profil

Trouvé/formalisé le 03/08 (chantier "onglets Playlists/Routines" — retour
direct de l'utilisateur : "tu modifies pas la page du compte test vitrine
officiel ?"). `ProfileView.jsx` est le MÊME composant pour un vrai profil
Supabase et pour la vitrine `@tempofit_officiel` — seule la SOURCE des
données change (Supabase pour un vrai profil, `officialVitrineProfile.js`
pour la vitrine, entièrement fabriqué à la main, aucune vraie ligne). Un
changement de rendu/interaction s'applique donc automatiquement aux deux —
mais "s'applique automatiquement au rendu" ne veut PAS dire "vérifié
automatiquement" : les données de la vitrine sont fabriquées à part,
peuvent silencieusement diverger de la forme réelle d'une ligne Supabase
(voir le point 8 du chantier 02/08, README.md — `officialVitrineProfile.js`
était resté désynchronisé de `content.tracks`/`description`/`clone_count`
pendant plusieurs chantiers avant d'être remarqué).

**Règle, 3 points concrets à vérifier à CHAQUE changement dans
`ProfileView.jsx`** (ou dans un hook qu'il utilise, ex.
`useProfileSearchFilter.js`) :

1. **Impact sur les tests** — si le changement touche le rendu/l'interaction
   (nouvel onglet, nouvelle section, nouveau filtre...), le describe
   "profil vitrine officiel" de `ProfileView.test.jsx` doit avoir AU MOINS
   un test qui exerce ce changement, pas seulement les describes "vrai
   profil". Un composant partagé avec 0 test vitrine sur un nouveau
   comportement est un trou de couverture, même si le composant "devrait"
   marcher pareil pour les deux — l'exemple du 02/08 ci-dessus montre que
   "devrait" n'est pas une garantie en pratique.
2. Tout nouveau champ `content` consommé par la grille publique (recherche,
   filtres, badges, affichage de carte) doit avoir son équivalent dans
   `officialVitrineProfile.js` (`buildOfficialVitrineProfile()` pour les
   playlists, `buildOfficialVitrineRoutineRows()` pour les routines) —
   règle déjà actée au README (chantier 02/08, point 8), reformulée ici
   pour être RELUE en tout premier, pas seulement documentée après coup.
3. Toute nouvelle colonne RÉELLE (hors `content` — `clone_count`,
   `parent_user_id`, `is_public`...) lue directement sur une ligne doit
   être vérifiée contre les lignes fabriquées de la vitrine : soit présente
   avec une valeur plausible, soit absente DÉLIBÉRÉMENT (ex. `parent_user_id`
   n'a pas de sens pour une playlist vitrine qui n'a jamais été clonée
   depuis un vrai compte — absence correcte, pas un oubli). Le distinguo
   se fait en le disant explicitement dans la réponse à l'utilisateur, pas
   en laissant le silence trancher.

## 4sexies. Modifier un texte visible par l'utilisateur — `grep` le repo entier AVANT, jamais seulement le fichier où le retour a été fait
Trouvé le 04/08 (retour direct : "cette phrase se trouve aussi dans l'onglet favoris, tu as pensé à la modifier ?") : un message d'info sur les genres musicaux ("les genres les moins courants...") avait été raccourci dans `GeneratorWizard.jsx` sur demande explicite ("la phrase doit tenir en une seule ligne") — sans vérifier s'il existait ailleurs. Il était dupliqué mot pour mot dans `FavoritesView.jsx` (les deux fichiers le documentaient déjà comme volontairement synchronisés — "même reformulation que GeneratorView.jsx" — un commentaire qui aurait dû être le signal à suivre). Racine du problème : une capture d'écran ou un retour direct montre TOUJOURS un seul endroit précis de l'app, jamais "tous les endroits où ce texte apparaît" — rien dans l'énoncé de la demande n'indique qu'une copie existe ailleurs.
Règle : avant de modifier un texte utilisateur (libellé, message d'aide, tooltip, texte de bouton...), `grep` une portion suffisamment distinctive du texte ACTUEL sur tout `src/` (pas juste le fichier concerné par le retour) — même réflexe que pour un changement de comportement (voir §4quinquies sur `officialVitrineProfile.js`, même famille de bug : une correction locale qui laisse une copie non synchronisée ailleurs). Si `grep` remonte plusieurs fichiers, appliquer le même changement partout dans la même passe, pas fichier par fichier au fil des retours de l'utilisateur.
**Suite (même jour, retour direct "ça vaut pas le coup de faire des règles de synchro pour ces 2 fichiers ?")** : corriger les 2 copies à la main referme le symptôme mais pas la cause — la duplication reste, prête à se désynchroniser au prochain changement si le réflexe grep est un jour oublié. Une fois un texte confirmé dupliqué, extraire une constante PARTAGÉE (le fichier de données le plus proche sémantiquement du texte — ex. `musicCatalog.js` pour un texte sur les genres, voir `GENRE_SEARCH_DEPTH_HINT`, pas un nouveau fichier générique "copy.js") plutôt que de simplement resynchroniser les 2 copies : la resynchronisation manuelle redevient alors structurellement impossible à oublier, au lieu de reposer sur la discipline du grep à chaque fois.

## 4septies. `grep` avant modification de texte — plusieurs sous-chaînes DISTINCTES, jamais une seule
Trouvé le 05/08 (build Vercel cassé, log collé par l'utilisateur) : un paragraphe retiré d'une infobulle (`AthleticProfilePanel.jsx`) avait bien été `grep`é avant modification (§4sexies déjà appliqué) — mais avec des sous-chaînes LONGUES et distinctives du texte ("Zone 2 = le BPM", "palier fixe de 15 BPM"). Un test (`AthleticProfilePanel.test.jsx`) ciblait un FRAGMENT plus court et différent de la même phrase (`/le BPM que tu tapes ci-dessous/`) — jamais remonté par ces `grep`-là, donc jamais vu avant de livrer. §4sexies (grep avant modif) restait juste, mais insuffisant tel qu'appliqué : un test peut cibler N'IMPORTE QUEL fragment du texte, pas forcément celui qu'on choisit intuitivement de vérifier.
Règle : avant de modifier/retirer un texte visible, `grep` PLUSIEURS sous-chaînes distinctes du texte ACTUEL (pas une seule "la plus représentative") — en particulier le DÉBUT de la phrase (souvent ce qu'un test capture en premier via une regex ouverte) ET tout segment qui pourrait former une regex autonome plausible. Un seul `grep` qui ne remonte rien ne suffit pas à conclure "aucun test ne dépend de ce texte" — recouper avec au moins 2-3 fragments différents avant de livrer.

## 4octies. Changer une règle de visibilité ("caché à 0" → "toujours affiché") dans un composant répété en liste/grille — vérifier les requêtes de test à correspondance UNIQUE
Trouvé le 05/08 (build Vercel cassé, log collé par l'utilisateur) : un badge (compteur de clonages) passé de "masqué si 0" à "toujours affiché, même à 0" (décision produit actée avec l'utilisateur) — correctif appliqué correctement au composant, mais un test écrit dans la foulée utilisait `getByTitle(...)` (un seul élément attendu) sur une vue qui rend ce même composant DES DIZAINES de fois (grille de la vitrine officielle). Une fois le masquage à 0 retiré, TOUTES les cartes affichent ce badge avec le même `title` — `getByTitle` échoue alors avec "Found multiple elements", à raison.
Règle : avant d'écrire un test qui vérifie l'apparition d'un élément (`getByText`/`getByTitle`/`getByRole`...) DANS un composant qui est rendu en boucle (carte de grille, ligne de liste, résultat de `.map()`), se demander si la nouvelle règle de visibilité peut désormais faire apparaître CE MÊME élément sur PLUSIEURS instances simultanément dans le test. Si oui : soit scoper la recherche à l'instance précise via `within(élémentTrouvé.closest('sélecteur stable'))`, soit utiliser `getAllBy*`/`queryAllBy*` et indexer explicitement — jamais supposer qu'une correspondance restera unique juste parce qu'elle l'était avant le changement de règle.

## 4nonies. Fichier mal repoussé côté GitHub (copier-coller partiel/version intermédiaire) — se produit de temps en temps, vérifier le VRAI contenu du dépôt plutôt que d'insister sur une reproduction locale
Ça arrive occasionnellement : le contenu réellement présent sur le repo GitHub diverge de celui livré (copier-coller partiel, version intermédiaire recopiée par erreur). Symptôme typique : un test échoue au build Vercel d'une façon qui ne correspond à AUCUN changement de logique fait en session.
Règle : si une reproduction locale de l'échec ne colle pas au symptôme réel (ou échoue plusieurs fois avec des résultats qui changent d'un essai à l'autre), ne pas insister sur la reproduction — aller directement vérifier le VRAI contenu du fichier en question (recherche de code GitHub si accessible, ou demander à l'utilisateur de coller le contenu réel), pas la peine de raffiner un environnement de reproduction pour ce cas de figure.

## 4decies. Un état UI "à tester" peut être structurellement inatteignable ailleurs dans le même composant — et un sélecteur CSS générique peut cibler le mauvais élément

Deux pièges de test trouvés le 28/08 en écrivant les tests d'un menu unifié favori/exclusion (`SearchModal.jsx`), génériques au-delà de ce chantier précis.

**Piège 1** : un test voulait vérifier "que montre le menu pour un titre déjà favori" — mais un mécanisme de filtrage DÉJÀ existant ailleurs dans le même composant (masquer les titres déjà favoris de la liste affichée) rendait ce scénario structurellement inatteignable dans le flux réel : la ligne disparaît de l'affichage avant que quiconque puisse ouvrir son menu. Avant de forcer un test sur un état qui semble légitime en composant des props isolément, vérifier qu'il survient réellement dans le flux naturel du composant complet — pas seulement qu'il est représentable.

**Piège 2** : un test "un clic en dehors du menu le referme" utilisait un sélecteur CSS trop générique (`.fixed.inset-0`) pour cibler l'overlay de fermeture — un AUTRE élément du même rendu (le fond de la modale elle-même, `ModalShell.jsx`, avec un z-index différent) partageait les mêmes classes de base et se faisait attraper en premier par `querySelector` (premier dans l'ordre du DOM). Préférer un sélecteur qui inclut au moins une classe distinctive propre à l'élément réellement visé (ici, ajouter la classe de z-index propre à l'overlay du menu) plutôt qu'un sélecteur générique qui matche par coïncidence structurelle.

## 5. Ce que ces outils NE remplacent PAS

Historiquement, aucun de ces scripts n'exécutait réellement `vitest` — une
affirmation "les tests passent" restait donc une vérification par LECTURE
attentive (syntaxe + logique + imports), jamais une exécution confirmée.
**Ce n'est plus vrai depuis le 21/08 — voir §5ter : `vitest run` fonctionne
réellement dans ce bac à sable.** `esbuild`/`tsc --checkJs` restent
utiles en complément rapide pour un tout petit changement isolé (plus
rapides qu'une exécution complète), mais pour un chantier plus large,
lancer `npx vitest run` avant de livrer est désormais possible et
préférable à une simple lecture. Le premier vrai passage indépendant
reste malgré tout celui du build Vercel réel, après que l'utilisateur a
poussé les fichiers via l'interface GitHub — deux environnements
différents, une vérification locale réussie n'élimine pas cette dernière
étape.
