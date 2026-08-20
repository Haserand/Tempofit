# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

Rien en cours actuellement — le dernier chantier livré (19/08, check-up
global, ci-dessous) est fermé, vérifié syntaxiquement/statiquement, tests à
jour. Prochaine session : partir des sections plus bas (décisions
d'architecture, contraintes, limites connues) et du code réel.

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

### Historique détaillé (13-14/08) — archivé dans `HISTORIQUE.md`, bloc 4

Récit chronologique complet déplacé le 14/08 (4e élagage — la session la
plus longue et la plus dense à ce jour, largement au-delà de celle du
10/08). Index :

- **13/08 — check-up général + couverture de tests des 11 hooks sans test
  dédié** (`usePersistentState.js`, `usePlaylistCompletions.js`,
  `useSessionAnalysis.js`, `useFavorites.js`, `useSpotifyImport.js`,
  `useDeezerSearch.js`, `useTrackSearch.js`, `useRoutines.js`,
  `useTheme.js`, `useToast.js`, `useElapsedTimer.js`) — 3 vrais bugs
  trouvés EN ÉCRIVANT ces tests, tous corrigés : `useToast.js` (un 2e
  toast rapproché effaçait le 1er avant sa propre durée), et 2 bugs de
  synchro Supabase dans `usePersistentState.js` — "push prématuré au
  montage" (`readyForPushRef`, le push partait avant que le pull ait eu la
  main) et `isApplyingRemoteRef` jamais réinitialisé quand la valeur
  distante est identique à la locale (`Object.is`, no-op React). **3
  allers-retours de build Vercel réel** pour stabiliser ces tests (piège
  "même valeur = no-op React" qui rendait un test invalide, fuite d'un
  `mockReturnValueOnce` non consommé entre 2 tests via `clearAllMocks()`
  — corrigé en passant à `resetAllMocks()`).
- **14/08 — convention infobulles (icônes seules) actée et systématisée**
  — parti d'un retour direct sur les cartes de séances/routines,
  généralisé à toute l'app par script. Trouvé et corrigé : ligne de
  métadonnées de `App.jsx`/`PlaylistHeaderMeta.jsx`, et un motif à plus
  forte valeur — libellé ABRÉGÉ de zone cardio affiché sans le libellé
  COMPLET déjà présent sur la donnée (`appConfig.js`), corrigé à 6
  endroits. 2 conventions actées dans ce README (infobulles sur icônes
  seules ; soulignement PERMANENT d'un pseudo cliquable vers un profil —
  vérifié déjà cohérent partout, rien à corriger sur ce 2e point).
- **14/08 — compteur de titres trouvés EN DIRECT pendant la génération**
  (`musicEngine.js`) — chantier en plusieurs étapes discutées avant
  d'implémenter (système à paliers de temps validé, temps indicatif
  chiffré explicitement écarté, extension au chemin catalogue
  d'artistes). **5 relectures successives demandées** ("tu vois d'autres
  trucs en creusant ?"), chacune trouvant un vrai problème de moins en
  moins grave : régression visible (compteur qui redescend) → stagnation
  (compteur figé à une transition) → surestimation (doublons non
  filtrés) → silence total (chemin de repli réseau hors radar). **Nouvelle
  habitude actée dans `CLAUDE-SANDBOX-VERIFICATION.md`** : après tout
  chantier touchant du code déjà identifié comme sensible, faire au moins
  une relecture complète et attentive dédiée AVANT de considérer la
  livraison terminée — sans attendre qu'on la redemande.
- **14/08 — compteur de clonages élargi à Découvrir** — le bouton
  "Ajouter" (Découvrir, le chemin le plus emprunté) n'incrémentait jamais
  `template_clone_counts`, contrairement au bouton "Sauvegarder" de la
  vitrine — distinction délibérée à l'origine (02/08), reconsidérée sur
  confirmation explicite : les deux chemins créditent désormais le même
  compteur.
- **14/08 — série de retouches Découvrir/`TemplateCard.jsx`** — badge
  "TempoFit" rendu cliquable vers le profil (remplace le texte auteur
  redondant avec le badge) ; **bug réel raté au 1er passage** : le clic
  était bien câblé mais jamais atteignable dans un vrai navigateur
  (empilement CSS — un overlay transparent passait au-dessus du badge
  dans l'ordre DOM, corrigé avec `z-10`) ; compteur de clonages déplacé
  en overlay sur la pochette (coin inférieur droit, symétrie diagonale
  avec le badge).
- **14/08 — bouton final du wizard ("Générer")** — texte raccourci
  ("Générer ma Playlist" → "Générer", redondant à ce stade), couleur de
  marque restaurée (`bgAccentClass`, était `bg-gray-900 dark:bg-white`
  codé en dur sans lien avec le reste du fichier).
- **14/08 — rattrapage complet des infobulles sur texte TRONQUÉ** (motif
  DISTINCT des icônes — texte coupé à l'ellipsis, `truncate`/
  `line-clamp-*`, sans `title=`) — 71 éléments recensés et passés en
  revue dans 19 fichiers, 2 exceptions assumées (tooltip de graphique déjà
  affiché au survol ; un bouton dont le `title=` décrit l'action plutôt
  que de répéter le texte). Nouvelle règle actée dans ce README.

Pour le détail complet d'un point précis (qui a demandé quoi, pourquoi
telle option plutôt qu'une autre, incidents de build et diagnostic) :
ouvrir `HISTORIQUE.md`, bloc 4, chercher la date ou le mot-clé — le
contenu y est identique à ce qui vivait ici avant l'élagage, rien n'a été
résumé.

## Contraintes de travail

- **Aucun terminal côté utilisateur** — tout passe par l'interface web de GitHub (créer/éditer des fichiers à la main) ; vérification via un vrai déploiement Vercel (logs collés dans la conversation avec Claude).
- **Déploiement automatique Vercel désactivé** (`vercel.json`,
  `"deploymentEnabled": false` — confirmé volontaire, 19/08) : un push
  GitHub ne déclenche PAS de build Vercel tout seul, contrairement au
  comportement par défaut — choix délibéré pour ne pas épuiser le quota
  gratuit Vercel. Le déploiement doit être déclenché manuellement
  (dashboard Vercel) avant de pouvoir coller les logs dans la conversation.
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

## Convention UI — infobulles (`title=`) sur les icônes seules

Actée le 14/08, après 2 allers-retours sur le même motif (retour direct
avec capture d'écran : "pourquoi seul le nombre de titres a une infobulle
au survol, pas le reste ?" — étendu ensuite à toute l'app sur demande).
Deux règles simples, à appliquer par réflexe dans tout nouveau code UI :

1. **Toute icône seule (sans mot qui l'explique déjà à côté) porte un
   `title=`.** Un chiffre nu à côté d'une icône (`<List/> 5`, `<Gauge/> 150
   BPM`) est ambigu sans légende — contrairement à une icône suivie d'un
   mot déjà explicite (`<Activity/> Course à pied`), qui n'a
   techniquement pas BESOIN d'infobulle mais en gagne une quand même si
   ses voisines directes (même ligne/groupe visuel) en ont — voir la règle
   2.
2. **Cohérence au sein d'un même groupe visuel > cas par cas.** Le vrai
   signal d'un oubli n'est presque jamais "cette icône est ambiguë dans
   l'absolu", mais "SA VOISINE a une infobulle et pas elle" (ex. le pseudo
   d'une carte a un `title=` mais pas les 4 icônes de métadonnées juste en
   dessous, dans le MÊME composant). Réflexe à avoir en touchant une carte/
   ligne d'infos : vérifier CHAQUE élément du même groupe, pas seulement
   celui qu'on modifie.
3. **Cas à plus forte valeur : un libellé ABRÉGÉ affiché alors qu'un
   libellé COMPLET existe déjà dans les données** (ex. `zone.shortLabel`
   "Seuil" affiché, `zone.label` "Seuil / Tempo" disponible sur le même
   objet, `appConfig.js`/`ATHLETIC_ZONES`) — l'infobulle n'y est alors plus
   seulement cosmétique, elle restitue une info réellement absente à
   l'écran. Prioritaire sur le reste si on doit choisir où mettre l'effort.
4. **Exception assumée, pas un oubli** : les boutons de fermeture (icône
   `X`) des modales n'ont volontairement PAS de `title="Fermer"` — motif
   uniforme sur les 11 modales du projet (vérifié le 14/08), une croix de
   fermeture est un standard UI suffisamment universel. Ne pas "corriger"
   cette exception par réflexe de cohérence si elle est repérée à nouveau —
   elle est déjà cohérente, juste sans infobulle nulle part.
5. Fonction PARTAGÉE entre plusieurs vues (ex. `renderConfigInfoLine` dans
   `App.jsx`, utilisée par `PlaylistsView`/`RoutinesView`) : corriger UNE
   FOIS à la source suffit, pas la peine de dupliquer le correctif dans
   chaque appelant — mais bien vérifier qu'aucun autre appelant n'a SA
   PROPRE copie légèrement différente de la même logique (`PlaylistCard.jsx`
   avait le sien, à côté, pas dans `App.jsx`).
6. **Motif DISTINCT, à ne pas confondre avec les 5 règles ci-dessus (icônes)
   — texte TRONQUÉ (`truncate`/`line-clamp-*`) sans `title=`.** Trouvé le
   14/08 (retour direct sur `TemplateCard.jsx` : "il manque pas les
   infobulles sur les metadata de Découvrir ?") — ici, pas d'icône du tout,
   juste du texte coupé à l'ellipsis sans aucun moyen de voir le reste au
   survol. **Rattrapage complet fait le 14/08, même session** (sur
   confirmation explicite, "on le fait maintenant") : les 71 éléments
   `truncate`/`line-clamp-*` recensés dans `src/components/` ont chacun été
   vérifiés — la plupart corrigés (`title=` avec le texte complet, souvent
   reconstruit via template literal quand le texte affiché combine
   plusieurs champs), quelques-uns déjà bons sans qu'un premier passage au
   grep simple l'ait vu (title posé sur une ligne différente du
   `className`, ou une `<div>` englobante dont l'enfant direct porte déjà
   le `title=`), 2 exceptions assumées :
   - Le tooltip d'un graphique Recharts (`PlaylistCharts.jsx`,
     `data.trackName`) — poser un `title=` HTML natif à l'intérieur d'un
     contenu qui s'affiche DÉJÀ au survol du graphique n'apporte rien (il
     faudrait déjà survoler pour le voir).
   - Un bouton dont le `title=` décrit délibérément l'ACTION plutôt que de
     répéter le texte tronqué (`MiniPlayerBar.jsx`, "Aller à cette
     playlist") — plus utile qu'une simple répétition ici, laissé tel quel.
   Réflexe à avoir pour tout NOUVEAU `truncate`/`line-clamp-*` écrit à
   partir de maintenant : poser le `title=` correspondant du premier coup,
   plutôt que de laisser un nouveau trou se former.

### Pseudo/nom d'auteur cliquable vers un profil — `underline` PERMANENT

Vérifié le 14/08 (question directe, "faudrait pas centraliser ça aussi ?")
— **déjà cohérent partout où ce motif existe**, rien à corriger, mais
documenté pour ne pas dériver à l'avenir :
- Un pseudo/nom d'auteur qui ouvre le PROFIL de quelqu'un (`onViewProfile`,
  `onViewOfficialProfile`, ou "aller à Mes Séances" pour son propre pseudo)
  est toujours souligné en PERMANENCE (`underline`, jamais seulement
  `hover:underline`) — voir `PlaylistHeaderMeta.jsx`/`TemplateCard.jsx`,
  toujours accompagné d'un `title=` explicite ("Voir le profil de X").
- Ne PAS confondre avec un lien vers un autre type de contenu (ex. le nom
  d'une PLAYLIST dans `MiniPlayerBar.jsx`) — celui-là peut légitimement se
  contenter d'un `hover:underline` (souligné seulement au survol), le
  distinguo permanent/hover marque justement "ceci mène à un PROFIL
  d'utilisateur" par rapport au reste de l'app.
- Exception légitime, pas à "corriger" par réflexe : une LISTE de
  résultats où toute la ligne est cliquable (avatar + pseudo, fond qui
  change au survol — voir `SearchUsersModal.jsx`) suit un paradigme UI
  différent (ligne entière = affordance cliquable) ; le soulignement du
  texte seul n'y a pas sa place.

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

## Limite connue, non traitée — écritures concurrentes de MÊME TYPE sur la MÊME playlist

**Constat (check-up 10/08)**, pas un chantier ouvert à trancher. Les 5 correctifs de course du 10/08 (`currentPlaylistIdRef`/`savedPlaylistsRef`/`routinesRef`/`userStatsRef`, voir "État d'avancement" plus haut) protègent contre une ANCIENNE fermeture asynchrone qui écrase un changement survenu APRÈS elle (playlist différente, action différente). Ils ne protègent PAS contre deux actions du MÊME type, sur la MÊME playlist, lancées à quelques secondes d'écart sans attendre la première (ex. cliquer "Remplacer" sur deux titres différents de la même playlist coup sur coup) — dans ce cas, "le dernier qui écrit gagne" : un des deux remplacements peut être perdu. Pas de risque de suppression/perte d'une AUTRE playlist (contrairement aux bugs corrigés), juste un remplacement à refaire.

Pas corrigé pour deux raisons :
- **Fenêtre de déclenchement étroite** — geste délibérément inhabituel (deux clics rapprochés sur la même playlist), pas un enchaînement d'actions normal comme "Partager puis naviguer ailleurs".
- **Un simple remplacement mécanique `setXxx(x...)` → `setXxx(prev => ...)` ne suffirait pas** à le régler correctement : `prev =>` protège la référence du TABLEAU (`savedPlaylists`), pas l'objet PLAYLIST à l'intérieur — `newTracks` est construit à partir de `currentPlaylist.tracks` capturé au clic, pas relu depuis `prev`. Une vraie correction demanderait de retrouver la playlist cible À L'INTÉRIEUR du `prev =>` plutôt que de se fier à un snapshot capturé au clic — un chantier à part entière sur COMMENT ces hooks lisent/écrivent leur état, pas une syntaxe à changer partout.

**À reprendre** : plutôt en même temps que la refonte de navigation que si isolément — même question de fond ("comment ces hooks lisent et écrivent leur état").



## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — outils de vérification de code pour une session Claude sans accès réseau.
- `DEEZER-CONNECT-REMOVED.md` — historique d'une intégration retirée.
- `supabase-schema.sql` — rejouable en entier sans risque (`drop if exists` systématique avant chaque `create`).
