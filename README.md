# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

Rien en cours actuellement. Cinq chantiers enchaînés, mêmes 24-48h,
**+ 2 correctifs trouvés/demandés en creusant après coup** :

**14/08 — angle mort comblé sur demande explicite : progression aussi pour
le chemin catalogue d'artistes.** Signalé au check-up précédent comme
angle mort acceptable (pas corrigé sur le moment), puis demandé quand
même ("tan qu'à faire"). Le chemin de repli par catalogue d'artistes
(`ARTIST_CATALOG`, musicEngine.js) — SEUL chemin emprunté pour les genres
à mot-clé Deezer fragile (K-pop, etc.), et systématiquement en complément
pour les genres normaux — n'avait aucun signal de progression, contrairement
à la recherche généraliste Deezer. `fetchInBatches` (utilitaire partagé,
8 appels dans musicEngine.js) accepte désormais un 4e paramètre optionnel
`onBatchDone`, rétrocompatible (`null` par défaut, aucun effet sur les 7
autres appels). Utilisé sur CE chemin précis pour compter les candidats
valables lot par lot, plutôt qu'une conversion durée→titres (cette branche
n'accumule pas de durée "bon genre" comme la recherche généraliste).
⚠️ Cette 2e branche de progression tourne parfois APRÈS la recherche
généraliste dans le MÊME appel à `buildSegmentTracks`, sans être chaînée à
son compte — un vrai risque de régression visible (le compteur qui
redescend), mais déjà couvert par le clamp anti-régression posé juste
avant au niveau de l'affichage (`usePlaylistGeneration.js`) : aucun
changement nécessaire là, la protection était déjà générique. Tests
ajoutés dans `tests/engine/fetchInBatches.test.js`.

**14/08 — check-up post-chantier "titres au fur et à mesure" : clamp
anti-régression.** Pas un retour direct cette fois — trouvé en relisant
en détail la logique juste livrée (habitude actée : "vérifier son propre
travail avant de le considérer terminé", surtout sur du code sensible).
Cas limite réel : avec PLUSIEURS genres pondérés ensemble
(`config.genreWeights`), le moteur enchaîne une sous-recherche par genre —
chacune vise un pool à 1.5x la durée réellement nécessaire (marge pour la
sélection finale). L'estimation affichée pendant la recherche d'UN genre
pouvait donc dépasser le compte RÉEL finalement retenu pour ce même
genre ; au passage au genre suivant, la progression reprenait sur ce
compte réel (souvent plus bas) — le compteur du bandeau pouvait
visiblement REDESCENDRE d'un coup, l'air buggé plutôt qu'indicatif.
Corrigé par un clamp au niveau de l'affichage (`usePlaylistGeneration.js`,
PAS retouché dans musicEngine.js — la source du problème n'a pas besoin
d'être touchée pour le corriger, plus sûr) : le compteur affiché
n'accepte plus qu'une valeur strictement supérieure à la dernière
affichée, réinitialisé proprement à chaque nouvelle playlist d'un lot. 3
tests dédiés ajoutés.

**14/08 (suite) — bandeau de génération, système à paliers de temps +
compte de titres en direct.** Suite directe du chantier précédent
(`isGeneratingSlowGenre`/`isGeneratingLongPlaylist`) — l'utilisateur a
validé le principe d'un système à 3 paliers de temps (0-15s inchangé,
15-45s "un peu plus long que d'habitude", 45s+ normalise explicitement),
PUIS demandé si un temps indicatif selon la config était possible malgré
tout, PUIS si le nombre de titres pouvait évoluer EN DIRECT plutôt qu'une
simple estimation statique — 2 réflexions successives données avant
d'implémenter quoi que ce soit (temps chiffré réaffirmé écarté ; chantier
"live" évalué comme plus lourd — touche musicEngine.js — et validé
explicitement seulement après ça).
- **`musicEngine.js`** — `buildSegmentTracks`/`createPlaylistData`
  acceptent désormais un callback `onProgress(estimatedCount)`, threadé à
  travers la boucle de pages Deezer, la branche récursive des genres
  pondérés (cumul par compte RÉEL entre sous-appels, pas une estimation
  qui s'additionnerait sur elle-même), et les segments multiples en mode
  Fractionné (offset = titres déjà confirmés par les segments
  précédents). ⚠️ C'est une ESTIMATION du pool de candidats, PAS le
  décompte des titres FINAUX (la sélection réelle se fait d'un coup, une
  fois le pool construit) — voir la docstring complète dans le fichier.
  Calcul d'estimation extrait en fonction pure
  `estimateTrackCountFromDuration` (exportée, testée en isolation — même
  réflexe que `buildGeneratedPlaylistName`, 08/08, ces fonctions moteur
  n'étant pas testables directement, appels réseau réels).
- **`usePlaylistGeneration.js`** — nouveau paramètre
  `setGeneratingEstimatedTracksFound`, relayé depuis le callback du
  moteur avec garde-fou contre une mise à jour APRÈS annulation
  (`cancelToken.cancelled`, même principe que pour jeter le résultat
  final d'une génération annulée), réinitialisé à 0 au début, à
  l'annulation, et à la fin.
- **`App.jsx`** — nouvelle fonction `getGenerationBannerMessage()`
  (remplace un ternaire imbriqué devenu difficile à lire) : paliers 15-45s
  et 45s+ affichent le compte de titres réunis dès qu'il est disponible,
  sinon retombent sur le message de réassurance générique par palier.
- Tests dédiés dans `tests/engine/musicEngine.test.js` (la fonction pure
  extraite) et `tests/hooks/usePlaylistGeneration.test.js` (relais correct
  du callback, réinitialisations, garde-fou post-annulation).

**14/08 (suite) — bandeau de génération, séance longue.** Retour direct :
"passé la minute de génération, l'utilisateur a cru que ça avait planté"
sur une séance de plus d'1h. Réflexion faite AVANT d'implémenter (temps
"indicatif" chiffré écarté — pas de vraie donnée de timing pour le
calibrer, un chiffre inventé pourrait devenir une source d'inquiétude
supplémentaire s'il est dépassé) : la durée cible d'une séance est un
signal PRÉVISIBLE à l'avance, contrairement à un genre lent. Étendu le
mécanisme déjà existant pour les genres à mot-clé Deezer fragile
(`isGeneratingSlowGenre`) avec un 2e flag symétrique
(`isGeneratingLongPlaylist`, seuil ≥45 min, modes Temps/Distance — mode
Fractionné hors scope assumé, segments à sommer différemment). Le bandeau
combine désormais les deux raisons possibles (genre lent, séance longue,
ou les deux à la fois) plutôt qu'un message générique statique. Tests
dédiés ajoutés dans `tests/hooks/usePlaylistGeneration.test.js`.

**14/08 (suite) — compteur de clonages élargi à Découvrir.** Retour direct
avec 4 captures : "pourquoi je vois quand même le compteur de clonage à 0
pour la playlist que j'ai pourtant clonée ?". Diagnostic : `template_clone_counts`
ne s'incrémentait QUE via `handleClonePlaylist` (bouton "Sauvegarder" d'un
template ouvert depuis la vitrine `@tempofit_officiel`, chemin peu
emprunté) — jamais via `handleSavePlaylist` (bouton "Ajouter" d'un
template ouvert directement depuis Découvrir, LE chemin le plus emprunté
de très loin). Distinction délibérée à l'origine (02/08, voir
`TemplateCard.jsx`), reconsidérée sur confirmation explicite de
l'utilisateur : les deux chemins créditent désormais le même compteur, même
garde-fou (`sourceTemplateId`) et même philosophie fire-and-forget que
`handleClonePlaylist`. Tests dédiés ajoutés dans
`tests/hooks/usePlaylistLibrary.test.js`.

**13/08 — couverture de tests des hooks, suite du check-up du même jour.**
Les 11 hooks de `src/hooks/` sans fichier de test dédié en ont désormais
un (`usePersistentState.js`, `usePlaylistCompletions.js`,
`useSessionAnalysis.js`, `useFavorites.js`, `useSpotifyImport.js`,
`useDeezerSearch.js`, `useTrackSearch.js`, `useRoutines.js`, `useTheme.js`,
`useToast.js`, `useElapsedTimer.js`) — voir `tests/hooks/`. 3 vrais bugs
trouvés en écrivant ces tests, tous corrigés :
- `useToast.js` — un 2e `showToast()` rapproché ne annulait pas le
  minuteur du 1er (`clearTimeout` manquant) : un toast pouvait s'effacer
  avant sa propre durée écoulée. Corrigé (`useRef` + annulation).
- `usePersistentState.js`, **"push prématuré au montage"** — avec un
  compte déjà connecté, l'effet de push partait AVANT que le pull ait eu
  la main sur le réseau (2 appels systématiques au montage, dont un
  parfaitement inutile — et un vrai risque d'écraser une valeur distante
  plus récente avec la valeur locale de départ). Corrigé avec
  `readyForPushRef`, qui bloque le push tant que le pull n'a pas fini
  d'essayer pour l'utilisateur courant.
- `usePersistentState.js`, **`isApplyingRemoteRef` jamais réinitialisé
  si le pull ramène une valeur IDENTIQUE à la locale** — no-op React
  (aucun re-render), donc le flag restait bloqué à `true`, avalant
  silencieusement le TOUT PROCHAIN changement local légitime. Corrigé en
  n'armant le flag que si la valeur diffère réellement (`Object.is`).
- `useSpotifyImport.js` — scope volontairement réduit : `loginSpotify`
  (OAuth PKCE, `crypto.subtle.digest`) laissé hors test, pure plomberie
  navigateur sans branche métier, fragile à simuler en `jsdom`.
- **3 allers-retours de build Vercel réel** sur ce chantier (tous
  corrigés) — plusieurs erreurs de logique fine (piège "même valeur =
  no-op React", fuite d'un `mockReturnValueOnce` non consommé entre 2
  tests via `clearAllMocks()`) n'ont pu être détectées qu'au build réel,
  jamais à la seule lecture. `afterEach` de `usePersistentState.test.js`
  utilise désormais `resetAllMocks()` (pas `clearAllMocks()`), pour éviter
  toute fuite similaire à l'avenir.

**14/08 — infobulles manquantes, généralisé à toute l'app.** Parti d'un
retour direct avec capture d'écran (Mes Séances/Mes Routines), généralisé
en script de recherche sur tout `src/`. Trouvé et corrigé : ligne de
métadonnées de `App.jsx`/`PlaylistHeaderMeta.jsx` (4 icônes sans
infobulle), et un motif à plus forte valeur — un libellé ABRÉGÉ de zone
cardio affiché (`zone.shortLabel`, ex. "Seuil") sans jamais restituer le
libellé COMPLET déjà présent sur la donnée (`zone.label`, ex.
"Seuil / Tempo") — corrigé à 6 endroits
(`TrackItem.jsx`/`AthleticProfilePanel.jsx`/`StatsView.jsx`(×3)/
`PlaylistHeaderActions.jsx`/`SessionSummaryCard.jsx`, ce dernier
nécessitant de restructurer `bars` pour porter un `title` distinct du
`label` affiché). 2 nouvelles conventions actées dans ce README (section
dédiée plus bas) : infobulles sur icônes seules, soulignement permanent
d'un pseudo cliquable vers un profil (déjà cohérent partout, rien à
corriger sur ce 2e point — juste documenté). Couverture de tests comblée
en même temps : `tests/shared/SessionSummaryCard.test.jsx` (nouveau, 0
test avant), nouvelle section dans `tests/views/StatsView.test.jsx` pour
les 3 infobulles de zones cardio de cette page.

Prochaine session : partir des sections plus bas (décisions
d'architecture, contraintes, limites connues) et du code réel.

### Historique détaillé (08/08 fin + 10/08) — archivé dans `HISTORIQUE.md`, bloc 3

Récit chronologique complet déplacé le 10/08 (3e élagage — la section
"État d'avancement" avait de nouveau dépassé 300 lignes, la session la
plus longue et la plus dense à ce jour : une vingtaine de chantiers
enchaînés sans interruption). Index :

- **Chantier "course asynchrone" (10/08, 7 occurrences trouvées et corrigées)** — un motif de bug récurrent (fermeture JS figée sur un state/une collection partagée, capturée avant un point d'attente async) trouvé 7 fois dans des endroits différents : re-render inutile (`PlaylistEditContext.jsx`/`AthleticContext.jsx`), puis 5 vraies races avec risque de perte de données (`PlaylistDetailView.jsx` "Partager"/"Cloner", `PlaylistDetailContext.jsx` "Remplacer un titre" — la plus sérieuse, DELETE Supabase possible —, `usePlaylistGeneration.js`, `useCsvImport.js`, `shareImageFileWithTrophy` App.jsx). Nouvelle habitude de travail actée dans `CLAUDE-SANDBOX-VERIFICATION.md` suite à ce chantier : généraliser la recherche d'un motif de bug dès sa 2e occurrence, pas continuer à corriger au coup par coup.
- **Chantier compteur de clonages (10/08, ~10 itérations, retours directs successifs avec captures d'écran)** — badge disparaissant après retrait d'un template de "Mes Séances" (`openCuratedPlaylist` sans `extraFields`), déplacé 2 fois (titre → métadonnées, puis séparé du pseudo vers la rangée d'icônes en haut à droite), fond gris retiré, alignement vertical avec les boutons d'action corrigé en 2 passes, préservé lors du clonage (`handleClonePlaylist`, 2e chemin de sauvegarde qui l'effaçait), rendu systématique pour toute playlist sauvegardée (changement de philosophie assumé, "0" honnête plutôt qu'absence), étendu à `PlaylistCard.jsx` (vue "Mes Séances") et `TemplateCard.jsx` (soulignement permanent du pseudo cliquable, cohérent avec la fiche détail).
- **Chantier "GeneratorWizard, redondance étape 2/étape 3" (10/08, 2 passes, découpé volontairement pour rester sécurisé)** — 1re passe : bloc durée/distance dupliqué entre l'étape 2 et l'étape 3 retiré. 2e passe : pour l'Allure Constante, le slider BPM fusionné avec la sélection de genre (étape 4) — ce mode ne visite plus l'étape 3 du tout (navigation adaptée, `wizardStep` garde ses valeurs habituelles). 2 échecs RÉELS détectés par le build Vercel après coup (tests sélectionnant un slider par index, décalé par le nouveau slider BPM) — corrigés, seul incident de build de toute la session malgré ~20 chantiers.
- **Pseudo cliquable vers "Mes Séances"** quand c'est le sien (`isSaved`, connecté ou invité) — décidé après discussion explicite : aucun avertissement, ni pour un compte connecté ni pour l'invité (le rappel mode invité est déjà permanent via `GuestModeBar.jsx`).
- **Petites retouches de texte** — 2 boutons de sauvegarde raccourcis ("Sauvegarder"/"Ajouter", redondants avec leur contexte), toast de bascule publique/privée raccourci + `whitespace-nowrap` (garde-fou technique en plus du texte court), infobulles manquantes ajoutées sur 2 boutons à icône seule (`PlaylistCard.jsx` Supprimer, `AthleticProfilePanel.jsx` Confirmer/Annuler).
- **08/08 (fin de journée, suite du bloc 2 ci-dessus)** — validation du titre de playlist (3 caractères min) + émoji d'activité baké en texte littéral dans le nom, édition titre+description passée d'inline à une modale dédiée (`EditPlaylistModal.jsx`), `AudioPlayerContext.jsx` mémoïsé, `GeneratorContext.jsx` découpé (`AthleticContext.jsx` isolé, `CustomActivityModal.jsx` découplée du wizard), `PlaylistHeader.jsx` découpé en 5 sous-composants (836 → 254 lignes) avec leurs propres tests dédiés, `PlaylistDetailContext.jsx` découpé en 2 Contextes (re-render à chaque frappe éliminé).
- **Incident de build Vercel réel (10/08, distinct du chantier GeneratorWizard ci-dessus)** — mauvais contenu (`PlaylistHeaderMeta.jsx`) commité sous le nom `PlaylistHeaderTitleBlock.test.jsx` lors d'une copie manuelle vers le repo, attrapé par `testFileIdentityTrap.test.js` — fichier correct redonné, aucun bug côté code généré.

Pour le détail complet d'un point précis (qui a demandé quoi, pourquoi
telle option plutôt qu'une autre, incidents de build et diagnostic) :
ouvrir `HISTORIQUE.md`, bloc 3, chercher la date ou le mot-clé — le
contenu y est identique à ce qui vivait ici avant l'élagage, rien n'a été
résumé.


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
