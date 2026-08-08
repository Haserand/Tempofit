# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

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

⚠️ **SESSION DU 08/08 — description libre RETIRÉE pour les routines, conservée pour les playlists (retour direct, capture à l'appui : "finalement pas emballé par la fonctionnalité description sur les routines... on conserve juste pour les playlists").** Contexte du retrait : contrairement à une playlist (vraie page détail dédiée, `PlaylistHeader.jsx`, où la description a la place de respirer), une routine n'a AUCUNE vue détail séparée — la description finissait compressée sur la carte elle-même, tronquée à 1 ligne sans échappatoire, exactement ce que montrait la capture jointe au retour direct (texte "CV V" illisible, à peine visible). Chantier d'origine : Vague 2, Chantier 3, 02/08 — voir plus bas dans ce README pour l'historique complet, gardé pour le récit mais PLUS À JOUR pour la partie routines.

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
  désormais bien le badge de clonages sur sa fiche détail, une fois
  `PlaylistHeader.jsx` correctement repoussé (un 1er build avait échoué —
  1 test sur 1047 en échec, `cloneCount défini MAIS isReadOnly=false...` —
  cause : un copier-coller partiel côté GitHub avait laissé une version
  intermédiaire du fichier ; recopié en entier, build reconfirmé vert).
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

✅ **Incident RÉSOLU (02/08)** — `tests/views/PlaylistDetailView.test.jsx` signalé en échec par `testFileIdentityTrap.test.js` sur un build Vercel, alors qu'aucune session n'avait touché ce fichier récemment. Vérifié : la copie de référence (jamais modifiée dans ce fil) passait le test sans problème — le fichier RÉELLEMENT présent sur le repo GitHub avait donc dû diverger d'une manière ou d'une autre (cause exacte jamais identifiée avec certitude — mauvaise casse, ou contenu écrasé lors d'une manipulation manuelle, exactement le type d'incident que ce garde-fou existe pour attraper). Copie de référence repoussée par l'utilisateur, build reconfirmé vert depuis.

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

## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — outils de vérification de code pour une session Claude sans accès réseau.
- `DEEZER-CONNECT-REMOVED.md` — historique d'une intégration retirée.
- `supabase-schema.sql` — rejouable en entier sans risque (`drop if exists` systématique avant chaque `create`).
