# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

✅ **SESSION DU 10/08 — check-up général, 1 vrai bug trouvé et corrigé : `PlaylistEditContext.jsx` re-rendait `PlaylistHeaderTitleBlock.jsx` à chaque frappe, malgré ce qu'affirmait sa propre docstring.** Trouvé en relisant le chantier de mémoïsation du 08/08 (le même jour qui avait justement corrigé ce type de bug ailleurs) — ironie relevée avec l'utilisateur avant correctif.

**Le vrai problème** : `PlaylistEditContext.jsx` construisait une seule `value` (littéral, jamais dans un `useMemo`) portant à la fois `handleOpenEditPlaylistModal` (lu par `PlaylistHeaderTitleBlock.jsx`, censé rester stable) ET `editedPlaylistName`/`editedPlaylistDescription` (le brouillon, qui change à CHAQUE frappe dans `EditPlaylistModal.jsx`). Un Contexte React re-rend TOUS ses consommateurs dès qu'UN SEUL champ de sa `value` change — donc `PlaylistHeaderTitleBlock.jsx` re-rendait bien à chaque frappe, alors que sa docstring affirmait explicitement le contraire depuis le 08/08. ⚠️ Un simple `useMemo` sur la `value` n'aurait PAS suffi : `editedPlaylistName` en fait partie et change à chaque frappe, donc le memo aurait recalculé de toute façon.

**Correctif** : `PlaylistEditContext.jsx` découpé en **2 Contextes distincts** (même Provider, deux `value` séparées) — exactement le même principe déjà appliqué à `PlaylistDetailContext` → `PlaylistEditContext` le 08/08 :
- **`PlaylistEditActionsContext`** (`usePlaylistEditActions()`, nouveau) — UNIQUEMENT `handleOpenEditPlaylistModal`, stabilisée par `useCallback([currentPlaylist, openModal])` puis enveloppée seule dans son propre `useMemo`. Consommé désormais par `PlaylistHeaderTitleBlock.jsx` (changé depuis `usePlaylistEdit()`).
- **`PlaylistEditContext`** (`usePlaylistEdit()`, nom INCHANGÉ) — tout le reste, y compris le brouillon volatil. Toujours pas mémoïsé, mais sans conséquence : seul `EditPlaylistModal.jsx` le consomme, et ce composant DOIT de toute façon re-rendre à chaque frappe.

Tests : `tests/contexts/PlaylistEditContext.test.jsx` — nouveau describe "stabilité référentielle" avec un vrai compteur de rendus (`ActionsRenderProbe`/`DraftRenderProbe`, RTL) prouvant que le Contexte stable ne re-rend PAS pendant une frappe (contrôle négatif inclus : le Contexte volatil, lui, re-rend bien — sinon le test ne prouverait rien) — trou de couverture comblé, aucun test existant ne vérifiait ce point avant. `tests/views/PlaylistDetail/PlaylistHeaderTitleBlock.test.jsx` — mock basculé sur `usePlaylistEditActions()`. `tests/criticalExportsTrap.test.js` — étendu pour vérifier aussi `usePlaylistEditActions` (2e export critique de ce fichier).

⚠️ **Pas encore vérifié en conditions réelles** (build Vercel) — même limite habituelle (bac à sable sans accès réseau).

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



### Historique détaillé (08/08, signOut → check-up 07/08) — archivé dans `HISTORIQUE.md`, bloc 2

Récit chronologique complet déplacé le 08/08 (2e élagage de la journée —
la section "État d'avancement" avait regrossi au-delà de 600 lignes en une
seule journée, chantiers de mémoïsation en cascade). Index :

- **`signOut()` attend les écritures Supabase en vol** avant de couper la session (`src/utils/pendingWrites.js`, nouveau).
- **Édition inline titre+description fusionnée** (un seul crayon) — historique uniquement, ce comportement est REMPLACÉ depuis par une modale dédiée (`EditPlaylistModal.jsx`, voir plus haut dans ce README).
- **Description libre retirée pour les routines**, conservée pour les playlists (retour direct, capture à l'appui — texte tronqué illisible sur une carte de routine).
- **Check-up du 07/08** (lecture passation → README → habitudes → code réel) — plusieurs corrections mineures, détail dans l'archive.

Pour le détail complet d'un point précis : ouvrir `HISTORIQUE.md`, chercher la date ou le mot-clé (contenu identique à ce qui vivait ici, rien résumé).


### Historique détaillé (02/08 → 05/08) — archivé dans `HISTORIQUE.md`

Le récit chronologique complet de cette période (627 lignes, une
quinzaine de chantiers) a été déplacé dans `HISTORIQUE.md` le 08/08 pour
garder cette section rapide à relire en début de session — voir l'en-tête
de ce fichier pour le raisonnement. Index ci-dessous, un lien par
chantier :

- **05/08 (check-up + suites 1 à 12)** — check-up initial (2 bugs + 1 optim), badge "compteur de clones" clarifié, mode invité affiché sur la pochette (`Guest Mode`), constantes "TempoFit Officiel" harmonisées, chevauchement pochette/texte corrigé, pseudo du créateur ajouté sur une playlist ouverte, doublon de clonage empêché (Découvrir → 2 clics), incident de build (fichier écrasé par son propre test, diagnostic long — voir `CLAUDE-SANDBOX-VERIFICATION.md` §4nonies), infobulle BPM raccourcie (2 incidents de build en cascade sur un `grep` insuffisant, voir §4sexies/§4septies), page Réglages vide en mode invité corrigée, garde-fou "fichiers rangés au bon endroit" ajouté (`testFileIdentityTrap.test.js`), reformulation description resserrée à 1 ligne.
- **04/08** — vérification en conditions réelles du bloc du 03/08 (confirmée bonne), puis chaîne de correctifs en cascade (détail dans `HISTORIQUE.md`).
- **03/08 (2e moitié)** — plusieurs petits chantiers UI/perf groupés (liste détaillée dans `HISTORIQUE.md`).
- **03/08 — refonte traçabilité de lignée** (`parent_id`/`parent_user_id` résolus côté serveur, `supabase-schema.sql`, action manuelle Supabase requise) et **anti-abus clonage** (`clone_ledger`, permanent, survit à la suppression locale de la copie).
- **02/08** — compteur de clonages honnête (`clone_count` réel, remplace un compteur simulé), vitrine `@tempofit_officiel` resynchronisée avec les fonctionnalités réelles, description texte libre sur playlists/routines publiques, UI publique des routines (Vague 2 Chantier 1), recherche & filtres sur les profils publics (`useProfileSearchFilter.js`).

Pour le détail complet d'un point précis (qui a demandé quoi, pourquoi
telle option plutôt qu'une autre, incidents de build et diagnostic) :
ouvrir `HISTORIQUE.md` et chercher la date ou le mot-clé — le contenu y
est identique à ce qui vivait ici avant l'élagage, rien n'a été résumé.


## Contraintes de travail

- **Aucun terminal côté utilisateur** — tout passe par l'interface web de GitHub (créer/éditer des fichiers à la main) ; vérification via un vrai déploiement Vercel (logs collés dans la conversation avec Claude).
- **Bac à sable Claude sans accès réseau** — `npm install`/`vitest run` réels impossibles. Voir `CLAUDE-SANDBOX-VERIFICATION.md` pour les outils de vérification disponibles quand même (validation de syntaxe réelle via `esbuild`, résolution d'imports).
- Le build Vercel (`npm run build`) lance `vitest run` avant `vite build` (voir `package.json`, script `build`) — un test qui échoue bloque le déploiement.

## Stack

- React 19, Vite 8, Tailwind v4 (design tokens custom, voir `src/index.css`)
- Supabase : auth (email/mot de passe), Postgres + RLS, Edge Function (`supabase/functions/delete-account`)
- Déploiement Vercel, 2 fonctions serverless (`api/deezer.js`, `api/getsongbpm.js`) — proxys pour contourner l'absence de CORS de ces API tierces, gardent leurs clés côté serveur
- Tests : Vitest + Testing Library, `tests/` en miroir de `src/` (voir la section Tests plus bas)

## Décisions d'architecture non évidentes en lisant juste le code

### Identité des playlists/routines
- `playlists.id`/`routines.id` sont du **texte**, générés côté client (`pl-...`, `routine-1`) — **jamais un UUID**.
- Clé primaire **composite** `(id, user_id)`, pas `id` seul — voir `supabase-schema.sql`, table `playlists`. Nécessaire parce que la playlist de démonstration par défaut (`'playlist-example-1'`) est **identique pour chaque nouveau compte** tant que personne n'a encore sauvegardé sa propre séance.
- ⚠️ Piège déjà rencontré à cause de ça : comparer une playlist par `id` seul (sans tenir compte de `user_id`/`isReadOnly`) peut faire correspondre à tort la playlist d'un visiteur avec celle de quelqu'un d'autre. Voir `src/contexts/PlaylistDetailContext.jsx`, calcul de `isSaved` (corrigé le 02/08, testé dans `tests/contexts/PlaylistDetailContext.test.jsx`) — **toujours filtrer par les deux ensemble** dans du nouveau code qui touche à cette zone.
- ⚠️ Piège trouvé pendant "UI publique des routines" (02/08) : `playlists.content` et `routines.content` ont la MÊME table/colonne (`jsonb`), mais PAS la même forme malgré la doc de `supabase-schema.sql` qui les présente comme structurellement identiques — une routine n'a jamais été générée, donc pas de `content.totalDuration`, pas de `content.coverUrl`, et le BPM vit à la racine (`content.bpm`) plutôt que sous `content.config.bpm`. Tout code qui affiche les deux types côte à côte (voir `PublicItemCard`, `ProfileView.jsx`) doit lire ces champs conditionnellement — jamais supposer qu'un helper écrit pour une playlist fonctionne tel quel sur une routine. Même piège retrouvé une 2e fois le même jour (`useProfileSearchFilter.js`, chantier "Recherche & filtres sur les profils publics") pour l'extraction du genre (`getGenresForDisplay` sur `content.tracks` pour une playlist vs `content.selectedGenres` direct pour une routine) et de la durée (`content.totalDuration` vs `content.hours`/`minutes` uniquement si `targetMode === 'time'`) — **pattern maintenant établi** : tout nouveau code qui lit `content` d'un item potentiellement playlist OU routine doit brancher sur un `kind`/`row.kind` explicite, jamais une formule unique.
- ⚠️ Catalogue de genres CANONIQUE (`musicCatalog.js`, `STANDARD_GENRES`/`NAUGHTY_GENRES`/`EXTRA_GENRES`) — trouvé en écrivant les routines fictives de la vitrine (02/08) : la clé interne réelle est `Electro` **sans accent**, `genreDisplayLabel` ne la retraduit pas (elle ne remappe que `'Autre'`→`'Divers'` et `'Musique asiatique'`→`'J-pop & C-pop'`) — l'accent affiché ailleurs dans l'UI ("Électro") n'existe QUE dans du texte libre, jamais comme valeur stockée. `Hip-Hop` et `Lo-fi` n'existent PAS dans le catalogue — pas de fourre-tout "genre urbain/ambiance" disponible, le plus proche est `Rap`/`R&B Sensuel` (variante Intime de `R&B`, dans `NAUGHTY_GENRES`). Toute nouvelle donnée (fictive ou non) qui référence un genre doit être vérifiée contre ces 3 constantes, jamais un nom "qui sonne juste".
- `content.description` (chantier "description texte libre", 02/08) : ajouté SANS migration SQL, simple nouvelle clé dans le `jsonb` déjà existant — précédent déjà établi par `plannedDate`/`coverUrl`. Un nouveau champ sur `playlists`/`routines` ne justifie une vraie colonne (`alter table`) que s'il doit être filtrable/indexable côté RLS (comme `is_public`/`is_intimate`) ; un simple texte d'affichage n'a aucune raison de sortir de `content`.
  ⚠️ **RETIRÉ pour les routines le 08/08** (retour direct : "finalement pas emballé par la fonctionnalité description sur les routines... on conserve juste pour les playlists" — voir "État d'avancement" en tête de ce README) — `content.description` reste une fonctionnalité ACTIVE uniquement côté `playlists` désormais. Aucune migration de données faite : une routine créée avant ce retrait peut encore porter une valeur dans `content.description`, simplement plus jamais lue ni affichée par le code (`RoutinesView.jsx`, `PublicRoutinePreviewModal.jsx`, `PublicItemCard`/`ProfileView.jsx`, `useProfileSearchFilter.js` l'ignorent tous désormais côté routine).

### Valider une donnée persistée : à la SOURCE ne suffit pas, il faut aussi valider à la CONSOMMATION
Leçon du chantier "cible à 0" (`targetValidation.js`, 04/08) : valider un formulaire d'ENTRÉE (le wizard, `EditRoutineModal.jsx`) empêche de CRÉER une donnée invalide, mais ne protège pas contre une donnée invalide déjà en base (créée avant le correctif, ou par tout autre moyen) qui serait relue ailleurs SANS repasser par ce formulaire — ici, le bouton "Générer" d'une routine déjà sauvegardée (`RoutinesView.jsx`), qui consomme `routine.distanceVal`/`.segments` directement. Tout nouveau champ avec une contrainte de validité mérite qu'on se pose la question aux DEUX endroits : où est-il écrit, et partout où il est relu sans repasser par l'écriture.

### Deux systèmes de confidentialité, volontairement séparés
- **Niveau profil** (table `profiles`) : `is_profile_public`, `show_sport_stats`, `show_intimate_stats`, `default_playlist_public` — interrupteurs globaux.
- **Niveau item** : `playlists.is_public` par playlist individuelle.
- Une playlist publique n'est visible que si **les deux** sont vrais. Les stats agrégées (temps total/BPM moyen), elles, ne dépendent QUE de `show_sport_stats`/`show_intimate_stats` — pas de `playlists.is_public` : une playlist privée compte quand même dans les stats globales si le propriétaire a activé "Afficher mes statistiques". **Voulu, pas un bug.**

### Synchronisation Supabase
- `usePersistentState.js` : hook générique `[state, setState]`, synchronise vers la table `user_data` (blob JSON par clé). Utilisé pour tout ce qui n'est pas playlists/routines (thème, favoris, profil athlétique...).
- `useSyncedCollection.js` : même signature `[state, setState]`, mais synchronise un TABLEAU d'objets vers une vraie table relationnelle (une ligne par élément), en calculant le diff en interne. Utilisé uniquement pour `savedPlaylists`/`routines`.
- ✅ **CORRIGÉ (07/08)** : à la déconnexion, `signOut()` (AuthContext.jsx) vide désormais tout le cache localStorage TempoFit de l'appareil (`clearLocalCache()`, `src/utils/localCache.js`) — voir "État d'avancement" plus haut pour le détail complet. Avant ce correctif, un compte suivant sur un appareil partagé pouvait voir (et modifier) les données de la personne précédente, potentiellement indéfiniment s'il restait en mode invité — pas juste "un court instant" comme le disait cette note.

### Pseudos réservés
- `src/utils/username.js` (`isReservedUsername`, garde-fou UX) **et** la contrainte SQL `profiles_username_not_reserved` (`supabase-schema.sql`) existent tous les deux et doivent rester identiques — c'est la contrainte SQL qui constitue la vraie garantie de sécurité.
- Exception unique : `tempofit_admin`, comparaison stricte sensible à la casse (contrairement au reste du motif, insensible à la casse).

### Profil vitrine `@tempofit_officiel`
- Jamais stocké en base, entièrement reconstruit côté client (`src/data/officialVitrineProfile.js`) — accessible même sans compte, court-circuite le Login Wall des profils volontairement. Le pseudo est structurellement bloqué à l'inscription par le système de pseudos réservés ci-dessus.

### Login Wall des profils publics
- Double verrou : droits d'exécution SQL retirés à `anon` sur `get_public_profile_summary`/`search_public_profiles` (`revoke ... from anon`) **et** vérification explicite `auth.uid() is null` en tout premier dans chaque fonction — voir `supabase-schema.sql`.

## Décisions actées, pas encore implémentées — chantier Pulses/Leaderboard

Suite à l'arrivée de "Running Mode" chez Spotify (juillet 2026) : **pas de pivot**. Le positionnement reste Sport + Mode Intime, on renforce l'existant plutôt que de reconstruire une couche sociale généraliste (feed 24h, avatars, follow) — décision explicitement actée, pas un oubli. Si ça change un jour, ce paragraphe doit changer avec.

Décisions initiales prises avec Claude, puis raffinées via un second avis (Gemini, 02/08) sur deux points précis : les garde-fous anti-corrélation temporelle/réseau du Mode Intime, et la distinction Vague 2/Vague 2bis ci-dessous.

Les règles ci-dessous sont **tranchées avant tout schéma SQL**, précisément pour éviter la situation "on verra à l'implémentation" sur un sujet où le schéma détermine la garantie de confidentialité :

- **Interactions classiques (Sport)** : tout est **full opt-in**, comme le reste de l'app — aucune exception "public par défaut", y compris pour le leaderboard. Cohérent avec `is_profile_public`/`show_sport_stats`/`show_intimate_stats`/`default_playlist_public`, tous `default false` (voir plus haut) — pas de rupture de philosophie.
- **Mode Intime** : fermé par défaut. L'utilisateur peut choisir de partager, mais alors :
  - Il apparaît sous un **pseudonyme anonymisé**, jamais son vrai pseudo/profil.
  - Ce pseudonyme est **stable** (pas généré à la volée à chaque partage) — nécessite une vraie table d'identité dédiée (`ex: intimate_personas`, `intimate_id -> user_id`), RLS verrouillée au propriétaire uniquement, **jamais jointe dans une requête publique**.
  - Généré par un algorithme **indépendant du vrai username** (pas un hash tronqué, pas une variante dérivée) — un pattern reconnaissable casserait l'anonymat aussi sûrement qu'un vrai lien en base.
  - **Leaderboard strictement séparé** de celui du Sport — deux classements distincts, jamais fusionnés ni sommés, même sous forme d'un total caché quelque part (dashboard créateur compris). Objectif : aucun agrégat visible ne mélange jamais intime et non-intime, nulle part.
  - Les pulses reçus sur du contenu intime restent possibles même sans opt-in au leaderboard (envoi anonyme indépendant du choix d'apparaître classé).
  - Si des avatars sont ajoutés un jour : l'avatar de la persona intime ne peut **jamais** être dérivé de façon déterministe du même id que l'avatar réel (même algorithme, même seed) — sinon l'image redevient l'indice qui recolle les deux identités.
  - **Pas d'horodatage précis affiché publiquement** pour une action liée à la persona intime (pas de "il y a 2 minutes") — une fenêtre floue ("cette semaine", "récemment") uniquement. Un horodatage précis permettrait une corrélation temporelle avec l'activité publique du même utilisateur sous son vrai profil (ex: une routine générée à 21h15 sous le vrai profil + une action intime à 21h16 sous la persona = recoupement trivial), même sans aucun lien technique direct entre les deux identités.
  - **Le vrai `user_id` (UUID `auth.users`) ne doit JAMAIS transiter dans un payload API lié à la persona intime**, même si le pseudo affiché à l'écran est bien anonymisé — un utilisateur inspectant l'onglet Network de son navigateur ferait sinon le rapprochement immédiatement. Prévoir une fonction RPC Supabase DÉDIÉE au Mode Intime (même principe que `get_public_profile_summary`/`search_public_profiles`, qui renvoient déjà des résumés construits à la main plutôt que les lignes brutes) — jamais un simple `select *` sur une table jointe à `auth.users`.

Ordre de priorité retenu (voir aussi les passations pour le détail du raisonnement) :
1. ~~UI publique pour les routines — le SQL existe déjà (`is_public`/`is_intimate`), juste l'UI manque.~~ **Fait (02/08)** — voir plus haut, section "État d'avancement".
2. **Renforcement post-hoc** (léger, valorise l'existant) : moteur BPM/structuration (crescendo, fractionné), et approfondissement de l'analyse post-séance déjà en place (`useSessionAnalysis.js` — comparaison de la cadence/FC réelle importée via CSV Garmin/Strava à la courbe de BPM musical cible).
3. ~~Description texte libre sur une playlist publique (aucun risque nouveau, faisable dès maintenant).~~ **Fait (02/08)** — étendu aux routines aussi, voir plus haut, section "État d'avancement".
4. ~~Compteur de sauvegardes/clonages.~~ **Fait (02/08), en attente de confirmation Vercel** — voir plus haut, section "État d'avancement". Décision actée avec l'utilisateur : uniquement un compteur par item, PAS de classement par créateur (ça, c'est le futur chantier "Pulses/Leaderboard" round 2 — la persona intime n'est donc PAS utilisée ici, un simple total ne révèle jamais qui a cloné quoi).
5. Follow — repoussé, c'est la pièce la plus "réseau social" du lot, contredirait la décision "pas de pivot" si avancée trop tôt.

**Vague 2bis — Futur / à l'étude, PAS confondue avec la Vague 2 ci-dessus** : adaptation dynamique en temps réel à la fréquence cardiaque (ex. "monte le tempo si ma FC dépasse 155, ralentis si je sors de Zone 2"), via connexion Web Bluetooth à un capteur/montre pendant l'effort, avec re-séquençage du flux audio en direct. Axe de différenciation réel (Spotify, application de streaming généraliste, n'a structurellement aucune raison de construire une intégration matérielle aussi spécifique) — mais un chantier d'ingénierie d'un tout autre ordre que le point 2 ci-dessus (gestion des déconnexions Bluetooth en pleine course, re-séquençage sans coupure audio, pas juste une comparaison a posteriori). À ne surtout pas sous-estimer en la fondant dans la Vague 2 "légère" — étiquetée à part exprès pour ça.

## Tests

- `tests/` en miroir de `src/` (`views/`, `modals/`, `shared/`, `contexts/`, `hooks/`, `engine/`, `utils/`, `config/`, `data/`).
- 6 fichiers restés volontairement à la racine (`fileExtensionTrap.test.js`, `noDuplicateFiles.test.js`, `tailwindConcatTrap.test.js`, `testFileIdentityTrap.test.js`, `testLocationTrap.test.js`, `criticalExportsTrap.test.js` — ces 2 derniers ajoutés le 05/08, voir "État d'avancement") — des garde-fous qui scannent tout le projet via leur propre `__dirname`, les déplacer casserait leur scan. (Le compte était déjà erroné avant le 05/08 — `testFileIdentityTrap.test.js` manquait à la liste, corrigé au passage.)
- `PlaylistDetailContext.jsx` (Provider) n'a **pas** de couverture exhaustive — juste un test ciblé sur `isSaved`/`isReadOnly` (`tests/contexts/PlaylistDetailContext.test.jsx`). Le monter en entier exigerait de mocker `GeneratorContext` + `AudioPlayerContext` + le moteur de recalcul de timeline ; jugé disproportionné pour ce qui reste, à part ce point précis, de la logique triviale déjà couverte indirectement ailleurs.
- Aucune exécution réelle de `vitest` n'est possible dans le bac à sable Claude — voir `CLAUDE-SANDBOX-VERIFICATION.md`.

## Décisions actées, pas encore implémentées — découpage `App.jsx`

**Repoussé volontairement (08/08, retour direct)** — voir plus haut, section "État d'avancement", pour le découpage déjà fait de `PlaylistHeader.jsx` (836 → 254 lignes, même famille de chantier). `App.jsx` (2227 lignes, `AppContent` avec 40+ `useState` interdépendants) reste le plus gros fichier du projet, mais N'EST PAS découpé maintenant :

- **Raison du report** : refonte intégrale du menu de navigation + nouvelles fonctionnalités prévues dans les prochains jours. La navigation vit au cœur d'`App.jsx` et irrigue presque tout le reste (quelle vue est affichée, quel state est visible à quel moment) — découper maintenant obligerait à deviner des frontières qui vont de toute façon bouger avec la refonte, avec un vrai risque de devoir refaire une partie du travail une 2e fois.
- **Approche retenue à la place** : laisser `App.jsx` tel quel pour l'instant, mais écrire la refonte de la navigation ET toute nouvelle fonctionnalité directement dans leur PROPRE hook/context dédié, plutôt que comme des `useState` de plus ajoutés dans `AppContent`. Le découpage se fait ainsi organiquement, au fil de l'eau, sans gros chantier de refactoring risqué à un instant T — et une fois la navigation isolée, ce qui reste dans `App.jsx` sera plus facile à lire pour identifier les bonnes frontières pour la suite.
- **À reprendre** : une fois la refonte de navigation stabilisée (et si le rythme des nouvelles fonctionnalités ralentit), revisiter le découpage du reste d'`App.jsx` — évaluer alors ce qui reste vraiment à extraire, plutôt que de refaire ce raisonnement depuis zéro.



## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — outils de vérification de code pour une session Claude sans accès réseau.
- `DEEZER-CONNECT-REMOVED.md` — historique d'une intégration retirée.
- `supabase-schema.sql` — rejouable en entier sans risque (`drop if exists` systématique avant chaque `create`).
