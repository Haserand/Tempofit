# TempoFit — Historique détaillé, bloc 8 (22/08 suite, cloneCount x4, centrage GuestModeBar/MiniPlayerBar x3, 4 refactors de composants partagés, garde-fou automatique)

⚠️ Copie condensée (élagage du 22/08, même jour) de la longue suite de
sections "22/08" accumulées après le bloc 7 — cette fois dominée par une
série d'enchaînements "correctif → nouveau retour direct → le correctif
était insuffisant/faux → vraie mesure → correctif définitif", plus 4
extractions de composants partagés. Contenu reformulé pour la densité
habituelle de ce fichier — voir le README pour ce qui reste
actionnable/durable (Convention UI, risques non vérifiés).

### 22/08 — Génération simple d'une playlist : sauvegarde automatique dans "Mes Playlists"

Question directe, "prends du recul" : "les playlists générées ne
devraient-elles pas être ajoutées automatiquement ?". 1re réponse
(avant vérification) : plutôt non, argument "le générateur sert à
l'exploration". Argument renversé par le retour direct suivant ("je dois
de toute façon l'ajouter pour pouvoir la modifier") — vérifié dans le
code : confirmé, `TrackList.jsx`/`TrackItem.jsx` bloquent déjà TOUTE
mutation de titre tant que `!isSaved`, aucune vraie exploration
possible sur une playlist déjà générée. Corrigé
(`usePlaylistGeneration.js`, `count === 1`) : appelle désormais
`setSavedPlaylists`, exactement comme le fait déjà `count > 1` (lot
depuis une routine) — une incohérence pré-existante jamais questionnée.
Garde-fou `hasUnsavedPlaylist` pas retiré, périmètre réduit (templates
Découvrir seulement).

### 22/08 — `cloneCount` : 4 correctifs en cascade le même jour sur le même sujet

Retour direct, capture à l'appui : une playlist étrangère fraîchement
clonée affichait à tort le compteur de clonages du PARENT. Généalogie
complète du bug (remonte au 07/08→10/08, un retrait de reset généralisé
à tort à 2 chemins de sauvegarde distincts). **4 correctifs le même
jour, chacun révélant le suivant** :
1. `handleClonePlaylist` (`usePlaylistLibrary.js`) — `cloneCount:
   undefined` posé sur la copie clonée.
2. Nouveau retour direct : le MÊME bug existait aussi sur
   `handleSavePlaylist` (chemin "Ajouter" depuis Découvrir) —
   l'hypothèse "cloneCount jamais réellement défini sur ce chemin"
   était fausse (`TemplateCard.jsx` transmet bien la vraie valeur).
   Corrigé pareil.
3. Nouveau retour direct : le correctif #2 CASSE `removeSavedPlaylist`
   (restaurait le badge en réutilisant `currentPlaylist.cloneCount`,
   devenu toujours `undefined`) — effet de bord non anticipé entre 2
   fonctions modifiées le même jour, jamais revérifiées l'une contre
   l'autre. Corrigé avec un vrai fetch Supabase asynchrone, protégé
   contre une navigation concurrente.
4. Audit demandé explicitement ("ça vaut le coup d'auditer en
   profondeur ?") — tous les fichiers touchant `cloneCount` passés en
   revue, rien d'autre trouvé À CE MOMENT-LÀ (l'effet de bord #3 n'a été
   trouvé qu'après, par un retour direct, pas par cet audit — leçon
   retenue : un audit isolé par fonction ne détecte pas les dépendances
   croisées entre 2 fonctions changées le même jour).

### 22/08 — Bandeau "Génération en cours" : points de suspension trompeurs retirés

Retour direct : les "..." de fin de message laissaient croire à une
troncature alors que le texte était toujours entièrement visible.
Retirés des 8 messages plutôt que d'ajouter une infobulle inutile (le
spinner + chronomètre signalent déjà "en cours").

### 22/08 — GuestModeBar/MiniPlayerBar : 3 tentatives de correctif de centrage avant la vraie cause

Retour direct : "le lecteur audio ne semble pas centré sur la guest
barre" (suggestion de piste fournie : élargir la zone contrôles).
**Tentative 1** : cause identifiée comme `MiniPlayerBar.jsx` centrant à
l'intérieur de `max-w-5xl mx-auto` pendant que `GuestModeBar.jsx`
centrait sur la largeur totale — 2 repères différents. Corrigé en
donnant le même `max-w-5xl mx-auto` aux deux. **Insuffisant** — nouveau
retour direct, capture à l'appui : "ça ne paraît toujours pas centré".

**Tentative 2, la bonne mesure** : plutôt que de re-raisonner en
théorie une 3e fois, cherché un moyen de mesurer pour de vrai — trouvé
un Chromium DÉJÀ EN CACHE dans le bac à sable
(`/opt/pw-browsers/chromium-1194/`, `find / -iname "*chromium*"`),
utilisable via `executablePath` sans passer par le téléchargement
bloqué. 1re mesure (reproduction MANUELLE du composant) : 0px d'écart,
faussement rassurant — la reproduction avait omis 2 éléments réels
(bouton volume, bouton fermer). 2e mesure, avec les VRAIS composants
importés directement : 46px d'écart confirmé. Cause : ces 2 boutons
suivaient la zone "contexte playlist" sans être comptés dans son
équilibrage `flex-1` avec la zone gauche. Corrigé en les regroupant
dans un seul conteneur `flex-1` — revérifié à 0px, à 2 largeurs d'écran,
capture d'écran à l'appui.

**Tentative 3, encore un retour direct après un déploiement pourtant
réussi** : "c'est centré !! [...] par contre le texte entouré est
toujours pas centré, tu dois te planter" — un 1er correctif (`text-center`
ajouté sur le texte muted) s'est avéré FAUX, pas juste insuffisant :
mesuré à nouveau, la boîte du texte collait au bord gauche, jamais
centrée comme élément flex — `text-center` ne pouvait rien changer,
le problème n'était pas l'alignement du texte mais la position de sa
boîte. **Cause réelle, dans `BottomBarShell.jsx` lui-même** : son
conteneur interne n'avait JAMAIS de classe `flex` de base — seulement
ce que chaque appelant transmettait. `GuestModeBar.jsx` transmettait
`flex-col items-center justify-center` SANS `flex`, ces classes
n'avaient donc aucun effet. `MiniPlayerBar.jsx` n'avait jamais ce bug
car son propre `innerClassName` incluait déjà `flex` — masquant le
problème jusqu'à ce qu'un 2e appelant compte sur le composant partagé
pour le fournir. Corrigé à la racine (`flex` posé dans le template de
BASE de `BottomBarShell.jsx`, pas juste côté appelant) — revérifié :
les 3 éléments (bouton play, "Se connecter", texte muted) tombent tous
au même x, écart de 0.008px.

**Incident de livraison, distinct des bugs de code** : au milieu de
cette série, deux erreurs de PROCESSUS (pas de code) ont coûté du temps
à l'utilisateur — (1) un déploiement Vercel a échoué parce que
`ModalShell.jsx` (fichier nouveau) n'avait pas été correctement ajouté
au dépôt malgré les fichiers qui l'important ; (2) un tableau de chemins
de fichiers manquant dans une réponse a fait perdre du temps à
l'utilisateur pour ranger les fichiers livrés. Les deux corrigés par un
rappel explicite de toujours indiquer nouveau/modifié + chemin exact
pour CHAQUE fichier livré, sans exception, quelle que soit la longueur
de la conversation.

### 22/08 — 4 extractions de composants partagés, suite à "vois-tu des composants à extraire ?"

Question posée 4 fois de suite le même jour, chaque fois avec une vraie
recherche systématique (motifs Tailwind répétés identiques dans
plusieurs fichiers) plutôt qu'une réponse de principe :
- **`BottomBarShell.jsx`** — le déclencheur de toute cette série (voir
  ci-dessus) : `h-[70px]` + `max-w-5xl mx-auto` recopiés indépendamment
  dans `MiniPlayerBar.jsx`/`GuestModeBar.jsx`, cause commune de 3 bugs
  de désalignement distincts la même session.
- **`ModalShell.jsx`** — candidat encore plus net (12 fichiers de
  modales, littéral de fond IDENTIQUE caractère pour caractère).
  Périmètre limité au fond+carte, PAS l'en-tête (2 modales sur 12 ont un
  en-tête différent, sans croix). Les 168 tests existants des 12
  modales sont passés SANS AUCUNE modification après la migration — le
  DOM produit reste identique.
- **`ModalCloseButton.jsx`** — le bouton croix précis (pas tout
  l'en-tête), littéral identique dans 10 des 12 modales.
- **`SelectablePill.jsx`** — plus nuancé, seul cas où une clarification
  a été demandée avant d'agir ("je n'ai pas compris si tu pensais utile
  de le faire") : le STYLE d'une pastille est identique dans 3 fichiers
  (6 endroits), mais le COMPORTEMENT de sélection diffère réellement
  entre eux (garde-fou "au moins 1" présent/absent, single/multi-select)
  — extraction limitée au bouton visuel seul, la logique de sélection
  différenciée reste intacte dans chaque fichier.

**Recherches complémentaires qui n'ont RIEN donné, documentées pour ne
pas les refaire** : carte générique (`rounded-2xl p-4 md:p-6 border`,
16 fichiers mais juste des tokens de thème partagés, pas une vraie
recette dupliquée), avatar rond, bouton "Annuler", bouton de
confirmation principal, champ de saisie avec icône (dupliqué mais dans
UN SEUL fichier, pas entre fichiers), boîte "chiffre+label" (dupliquée
mais interne à `StatsView.jsx` seul), toast (déjà centralisé via
`useToast.js`).

**Garde-fou automatique construit à la suite du bug BottomBarShell**
(question directe : "des pratiques à généraliser, d'autres checks à
faire ?") — `tests/flexDependentClassTrap.test.js` (nouveau, même
famille que `tailwindConcatTrap.test.js`) : scanne tout `cardClassName=`
du projet (`ModalShell.jsx`, seul composant partagé qui garde ce risque
aujourd'hui — `innerClassName`/`BottomBarShell.jsx` explicitement exclu
du scan, protégé à la source depuis le correctif) pour détecter une
classe flex-dépendante (`flex-col`/`items-*`/`justify-*`) sans son
prérequis (`flex`/`grid`) dans la même chaîne. Testé activement avant
livraison : régression simulée temporairement sur un fichier réel,
confirmé que le garde-fou l'attrape, fichier restauré immédiatement
après.

### Motifs récurrents à retenir pour la suite

**Un raisonnement théorique sur du CSS peut être faux 2-3 fois de suite
le même jour** — la vraie mesure (Playwright, même avec un
téléchargement de navigateur bloqué, un binaire est parfois déjà en
cache ailleurs sur le système — chercher avec `find` avant de conclure à
l'impossibilité) doit intervenir dès le 2e échec, pas après.

**Ne jamais reproduire un composant "à la main" pour le tester** — une
recopie manuelle a donné un faux résultat rassurant en omettant 2
éléments bien réels du fichier. Toujours importer le vrai fichier.

**Un audit de sécurité par fonction ne détecte pas les dépendances
croisées entre 2 fonctions modifiées le même jour** — le cas
`removeSavedPlaylist` cassé par le correctif de `handleSavePlaylist`
n'a été trouvé QUE par un retour direct suivant, jamais par l'audit
explicitement demandé juste avant.

**Une classe Tailwind "dépendante" (`flex-col`/`items-*`/`justify-*`)
ne fait RIEN sans sa classe "prérequise" (`flex`/`grid`) sur le même
élément** — invisible à la lecture, surtout quand la chaîne de classes
traverse une frontière entre 2 fichiers (composant partagé + appelant).
Vérifiable automatiquement, pas seulement par relecture ponctuelle.

**Livrer un fichier sans donner nouveau/modifié + son chemin exact a un
vrai coût, pas juste une gêne** — deux fois cette session, cette omission
(ou son insuffisance) a directement causé une erreur/une perte de temps
côté utilisateur. Règle non négociable désormais : CE tableau, à CHAQUE
livraison, sans exception.
