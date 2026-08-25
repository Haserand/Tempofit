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
