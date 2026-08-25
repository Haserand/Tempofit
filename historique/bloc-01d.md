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
