# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

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
