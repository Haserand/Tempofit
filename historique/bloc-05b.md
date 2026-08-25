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
lancé volontairement APRÈS elles, comme annoncé le 10/08.

**Constat d'origine (check-up 10/08)** : les 5 correctifs de course du
10/08 (`currentPlaylistIdRef`/`savedPlaylistsRef`/`routinesRef`/
`userStatsRef`) protègent contre une ANCIENNE fermeture asynchrone qui
écrase un changement survenu APRÈS elle (playlist différente, action
différente). Ils ne protégeaient PAS contre deux actions du MÊME type,
sur la MÊME playlist, lancées à quelques secondes d'écart sans attendre
la première (ex. cliquer "Remplacer" sur deux titres différents de la
même playlist coup sur coup) — "le dernier qui écrit gagne" pouvait
perdre un des deux remplacements.

**Repoussé le 10/08** pour deux raisons, toutes deux devenues obsolètes
le 20/08 : fenêtre de déclenchement étroite (reste vrai, mais plus un
obstacle) ; un simple `setXxx(x...)` → `setXxx(prev => ...)` n'aurait pas
suffi (`prev =>` protège la référence du TABLEAU `savedPlaylists`, pas
l'objet PLAYLIST à l'intérieur — corriger correctement demandait de
retrouver la playlist cible À L'INTÉRIEUR du `prev =>`, pas juste ajouter
une flèche partout).

**Corrigé** (`PlaylistDetailContext.jsx`, `applyPlaylistUpdate`) —
repoussé jusqu'ici volontairement "en même temps que la refonte de
navigation" (même question de fond, "comment ces hooks lisent et écrivent
leur état"), lancé une fois cette dernière stabilisée. `applyPlaylistUpdate`
accepte maintenant une fonction de TRANSFORMATION
(`prevTracks => newTracks`) plutôt qu'un tableau déjà construit,
appliquée à l'intérieur de `setCurrentPlaylist(prev => ...)` — toujours
sur le tableau le plus FRAIS au moment où React traite réellement la mise
à jour. Les 2 fonctions async (`handleReplaceTrack`/
`handleReplaceTrackSameArtist`) retrouvent en plus le titre à remplacer
par son ID STABLE (pas sa position brute) dans ce tableau frais — ferme
aussi, en prime, les cas croisés (un remplacement qui résout après un
retrait/une duplication concurrents sur un index différent). Les 3
mutations synchrones (`handleRemoveTrack`/`handleDuplicateTrack`/
`moveTrackTo`) routées par la même API pour rester cohérentes, même si
elles n'en avaient pas strictement besoin entre elles (JS mono-thread,
aucune interruption possible entre 2 clics synchrones). 2 tests de
régression ajoutés avec du VRAI state React (`useState`, pas des mocks
inertes) — 2 remplacements concurrents sur 2 titres différents, dans les
2 ordres de résolution possibles, aucun perdu dans les deux cas.

Chantier de découpage d'`App.jsx` — l'autre moitié de ce qui était
différé au même titre — PAS entrepris dans la foulée : plus gros, plus
risqué, volontairement laissé pour une session séparée plutôt que
d'enchaîner deux chantiers structurels d'affilée.
