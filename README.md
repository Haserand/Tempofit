# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

Rien en cours actuellement — session très longue (21-22/08), tous les
chantiers fermés et vérifiés. Découpage `App.jsx` clos (StatsView,
`ShareImageContext.jsx`, `GenerationProgressBanner.jsx` extraits ;
"Navigation" audité puis délibérément pas extrait ; bug `isScrolled`
trouvé puis le header qu'il pilotait entièrement retiré, pas juste
réparé — voir plus bas). Depuis : bio du profil vitrine affinée en
plusieurs passes (style "notice" rejeté au profit d'un vrai style "bio",
texte raccourci) ; composant partagé `TabPills.jsx` créé et les 5 vues à
onglets de l'app alignées dessus ; Sidebar réorganisée ("Découvrir" isolé
de "Création") puis son espacement en Mode Intime resserré en 3 passes
successives ; **découverte majeure que `npm install`/un vrai serveur
`vite`/Playwright/`vitest run` fonctionnent réellement dans ce bac à
sable** (voir CLAUDE-SANDBOX-VERIFICATION.md, §5ter/§5quater — change la
donne pour toute vérification future, y compris une leçon apprise à la
dure sur comment mesurer un alignement visuel correctement) ; plusieurs
corrections visuelles fines sur l'en-tête de playlist et le wizard
générateur, certaines corrigées une 2e fois après une 1re vérification
erronée de ma part (voir README, sections dédiées, et CLAUDE-SANDBOX-
VERIFICATION.md §5quater pour la leçon retenue).

**22/08 (check-up général) — dette de code morte retirée d'`App.jsx`**,
voir section dédiée plus bas : le bloc de destructuration de
`useGeneratorContext()` dans `AppContent` est passé de ~55 variables à 5
réellement utilisées (`setWizardStep`, `showExtraGenres`/
`setShowExtraGenres`, `CRESCENDO_MIN_MAIN_PCT`, `availableGenres`) + 2
imports morts retirés (`React` par défaut, `DualRangeSlider`). Vérifié
via ESLint (analyse de portée réelle) puis chaque occurrence relue à la
main, build + suite de tests complète (1507 tests) confirmés après coup.

### Historique détaillé (21-22/08) — archivé dans `HISTORIQUE.md`, bloc 6

Récit chronologique complet déplacé le 22/08 (6e élagage — session
exceptionnellement longue et dense : reprise du découpage `App.jsx`,
bio du profil vitrine affinée en 3 essais, standardisation des onglets
via `TabPills.jsx`, Sidebar réorganisée puis son Mode Intime resserré en
3 passes, découverte majeure que le bac à sable a accès à `npm install`/
`vite`/Playwright/`vitest run`, et plusieurs corrections visuelles fines
sur l'en-tête de playlist et le wizard générateur). Index :

- **21/08 — check-up sans chantier précis en tête** : 1 bug réel corrigé
  (`ImportSharedPlaylistModal.jsx`, oubli du renommage "séance"→"playlist"
  du 20/08 sur une seule phrase) + 2 trous de couverture de test comblés
  (`TrophiesView.jsx`, `MiniPlayerBar.jsx`, 0 test avant malgré une
  logique non triviale).
- **21/08 — découpage `App.jsx` clos**, 3 extractions : `ShareImageContext.jsx`
  (Contexte complet), `GenerationProgressBanner.jsx` (rendu seul extrait,
  le state reste dans `AppContent` — contrainte d'ordre entre hooks), et
  un audit complet du cluster "Navigation" débouchant sur la décision de
  NE RIEN extraire (raisons vérifiées, pas supposées — voir la section
  dédiée plus bas, pas archivée). Bug réel trouvé en cours d'audit
  (`isScrolled`, header mort depuis sa création) puis le header entier
  RETIRÉ plutôt que réparé, une fois sa justification invalidée par une
  vraie capture d'écran.
- **21/08 — bio du profil vitrine** (`@tempofit_officiel`) — 3 essais
  avant la bonne version (bandeau d'alerte → notice repliée → vrai style
  "bio", texte blanc sans bordure), comportement aligné sur le pattern
  déjà existant pour les descriptions de playlist (troncature 3 lignes +
  tooltip), pas la couleur. Décision actée pour plus tard : banc d'essai
  volontaire pour une future bio éditable par tous les utilisateurs (voir
  section dédiée plus bas, pas archivée).
- **21/08 — `TabPills.jsx` créé**, 5 vues à onglets alignées dessus, suite
  à la découverte que 2 vues avaient dérivé indépendamment de la
  convention majoritaire (`SettingsView.jsx` vers un style soulignement,
  `TrophiesView.jsx` vers un style "contrôle segmenté") sans que personne
  ne s'en aperçoive avant une comparaison directe.
- **21/08 — Sidebar : "Découvrir" isolé de "Création"** (3e intention
  distincte), puis son espacement en Mode Intime resserré en 3 passes
  successives sur les mêmes 5 écarts marqués par capture annotée (-25px
  cumulé) — un levier tentant explicitement écarté (padding des liens
  compacts, déjà rejeté trop serré le 29/07).
- **21/08 — DÉCOUVERTE MAJEURE** : le bac à sable Claude a en réalité
  accès à `npm install`/un vrai serveur `vite`/Playwright — jamais vérifié
  depuis l'origine du projet, qui affirmait le contraire. `vitest run`
  RÉEL fonctionne aussi (113 fichiers, 1506 tests, tous passent). Voir
  `CLAUDE-SANDBOX-VERIFICATION.md`, §5ter/§5quater — à lire avant toute
  prochaine session touchant du rendu visuel ou une livraison conséquente.
- **21/08 — bug de rendu du wizard générateur** (coin de carte arrondi
  touchant la ligne du pied de page à 0px près) diagnostiqué et corrigé
  grâce à cette découverte — 1er correctif (ajouter de la place) reçu un
  retour direct immédiat ("ça fait quand même scroller, autant retirer la
  ligne inutile") : 2e version, plus simple et height-neutre, retenue.
- **22/08 — en-tête de playlist, badge "Lecture seule" puis Corbeille mal
  alignés avec le badge BPM** — 1er corrigé sans souci (décalage fixe →
  padding réel de la carte). 2e (Corbeille) a révélé une VRAIE erreur de
  vérification de ma part : 1re mesure (boîte du bouton) faussement
  rassurante, contestée à raison par l'utilisateur avec le fichier exact
  déployé — 2e mesure (SVG lui-même) a trouvé la vraie cause (padding
  invisible du bouton-icône). Leçon ajoutée à `CLAUDE-SANDBOX-
  VERIFICATION.md` (§5quater) : toujours mesurer le glyphe visible, jamais
  seulement la boîte cliquable, pour un alignement visuel.
- **22/08 — retouches finales** : `MiniPlayerBar.jsx` (préfixe "Playlist :"
  retiré, redondant) ; suggestion de l'utilisateur (stats sportives dans
  l'espace vide de l'en-tête de profil) discutée puis écartée après
  vérification qu'un 2e bloc de stats symétrique existe et ne pourrait pas
  y tenir aussi.


### Historique détaillé (19-20/08) — archivé dans `HISTORIQUE.md`, bloc 5

Récit chronologique complet déplacé le 20/08 (5e élagage — session
particulièrement dense : check-up global, plusieurs vagues de correctifs
de bugs récurrents, renommage terminologique complet, fusion Routines/
Playlists en onglet, réorganisation Sidebar/Découvrir, correctif
d'écritures concurrentes différé depuis le 10/08). Index :

- **19/08 — check-up global** (demandé sans chantier précis en tête) : 2
  bugs réels trouvés (`ModalContext.jsx` fermait la mauvaise modale après
  un `await` ; `AuthContext.jsx` seul des 8 Contexts sans `value`
  mémoïsée) + couverture de tests comblée (`spotifyEngine.js`,
  `src/layout/*.js`, `GeneratorContext`/`AudioPlayerContext`). Généralisé
  ensuite au même motif ailleurs : `useCsvImport.js`/`useAudioPreview.js`
  avaient la MÊME classe de bug ("clear inconditionnel après un `await`").
- **19-20/08 — 4 allers-retours de build Vercel réel**, tous corrigés :
  1er correctif `closeModal(name)` cassait tout `onClick={closeModal}`
  direct (React y passe l'événement) — corrigé en 2 fonctions séparées
  (`closeModal()`/`closeModalIfActive(name)`) plutôt qu'un paramètre
  optionnel ambigu ; ref de timing non synchrone dans
  `useAudioPreview.js` ; bug `vi.stubGlobal` (renvoie `vi`, pas le mock) ;
  import `jest-dom` manquant (ce projet n'a pas de `setupFiles` global —
  nouvelle habitude actée dans `CLAUDE-SANDBOX-VERIFICATION.md`, §5bis).
- **20/08 — "Mes Routines" fusionnée en onglet de "Mes Playlists"**
  (retour direct, comparé à la vue profil public déjà en onglets) —
  `RoutinesView.jsx` réduite à son seul corps, `PlaylistsView.jsx` devient
  le shell avec sélecteur d'onglet et en-tête dynamique. Cassait
  `viewHeaderLayout.test.js` (garde-fou du 19/08 qui a fait son travail),
  ajusté en conséquence.
- **20/08 — renommage complet "séance" → "playlist"** (retour terrain :
  "la notion de séance parle au cœur de cible mais pas aux curieux, ils
  ne savent pas qu'il y a une playlist") — "Nouvelle Playlist"/"Mes
  Playlists" sur ~30 fichiers, en distinguant strictement le nom propre de
  destination (renommé) de l'usage générique du mot "séance" (conservé).
  2 citations verbatim de retours utilisateurs historiques préservées
  intactes malgré un remplacement automatique trop large. "Mes
  Statistiques" ajoutée ensuite par cohérence (pas "Mes Réglages",
  convention universelle "Réglages" seul).
- **20/08 — recherche de profils fusionnée dans "Découvrir"** — pastille
  séparée retirée, remplacée par un vrai onglet Séances/Profils sur la
  même barre de recherche. Décision de sécurité assumée : la recherche
  reste verrouillée aux comptes connectés côté serveur (même verrou que la
  consultation de profil), message incitatif pour les invités plutôt
  qu'un simple masquage.
- **20/08 — écritures concurrentes corrigées** (chantier différé depuis le
  10/08, repris une fois la navigation stabilisée) — `applyPlaylistUpdate`
  accepte une fonction de transformation appliquée sur le state le plus
  frais ; recherche par ID stable plutôt que par index pour les 2
  remplacements async. Voir la section "Corrigé (20/08)" plus bas pour le
  détail technique complet (pas archivée, reste à jour).
- **20/08 — bouton "Précédent" du wizard incohérent entre les étapes**
  (retour direct, capture annotée) — dérive de style non documentée entre
  2 boutons faisant la même chose, alignés + extraits en constante locale
  partagée pour rendre la dérive future impossible.
- **20/08 — découpage `App.jsx` repris** — voir la section dédiée
  "Découpage App.jsx" plus bas (pas archivée, reste à jour) pour le détail
  complet du 1er lot fait (cluster StatsView) et l'inventaire vérifié des
  clusters restants.


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

## Décidé mais pas encore construit — futur champ `profile.bio` éditable

Retour direct (21/08) : l'utilisateur veut, un jour, permettre à CHAQUE
utilisateur de se poser une courte phrase de description sur son profil
public (une vraie "bio", comme un réseau social classique) — pas construit
pour l'instant (aucun champ `bio` dans `get_public_profile_summary`,
supabase-schema.sql, ni dans le formulaire de `SettingsView.jsx`).

En attendant, la carte d'en-tête de `ProfileView.jsx` affiche déjà cette
mise en forme précise — mais SEULEMENT pour `@tempofit_officiel` (voir
"Profil vitrine" plus haut), texte câblé en dur dans
`officialVitrineProfile.js`. Décision explicite : le compte vitrine sert de
banc d'essai visuel pour ce futur champ, AVANT que la vraie fonctionnalité
existe — 2 essais de mise en forme rejetés avant d'arriver à la bonne
(bandeau séparé façon alerte, puis ligne repliée dans la carte mais encore
traitée comme une notice système avec icône/texte muted/séparateur) : ce
qui restait attendu depuis le début était un vrai encart façon bio, texte
`textHighlight` (blanc en mode sombre — `--color-main: 255 255 255`,
`src/index.css`) plutôt que `textMuted`, sans icône ni séparateur — pour
qu'il se lise comme un compte qui se présente, pas comme un avertissement
de l'appli.

Quand ce chantier démarrera pour de vrai : reprendre EXACTEMENT ce style
(`<p className="text-sm mt-3 ${textHighlight}">`, sans bordure ni icône)
pour le vrai champ `profile.bio`, conditionné sur sa présence plutôt que
sur `isOfficialVitrine` — et retirer alors le texte en dur de
`officialVitrineProfile.js` au profit d'une vraie valeur (ou continuer de
lui donner une bio écrite à la main, cohérente avec son rôle de vitrine).

## En-tête de playlist — badge "Lecture seule" mal aligné avec le badge BPM (22/08)

Retour direct avec capture annotée : "la ligne droite de fin du cadenas
doit être sur la même verticale que la fin du badge BPM, là y a un
décalage". Trouvé dans `PlaylistHeaderBadges.jsx` : le badge "Lecture
seule" (icône `Lock`) est positionné en `absolute top-4 right-4` — un
décalage FIXE de 16px depuis le bord de la carte, qui ignorait purement et
simplement le vrai padding de cette carte (`p-6 md:p-8`, soit 24px/32px,
`PlaylistHeader.jsx`). Le badge BPM (`PlaylistHeaderActions.jsx`), lui,
s'arrête déjà pile à ce padding réel via son flux normal (`ml-auto`) —
d'où un écart de 8px (mobile) à 16px (desktop) entre les deux, jamais
remarqué avant cette capture.

**Correctif** : `right-4` → `right-6 md:right-8`, reprenant exactement le
padding réel de la carte. `top-4` inchangé (jamais mentionné, aligner
verticalement avec un badge d'une tout autre rangée n'aurait aucun sens —
seul l'axe horizontal était en cause). Vérifié en conditions réelles
(serveur de dev + Playwright, voir §5ter de CLAUDE-SANDBOX-
VERIFICATION.md) sur la playlist EXACTE de la capture ("Midnight Runner
160", 169 BPM) : écart mesuré à 0px pile après correctif (`getBoundingClientRect`),
confirmé aussi visuellement par capture de contrôle. Les 13 tests de
`PlaylistHeaderBadges.test.jsx` passent toujours (`vitest run` réel).

### Suite — même écart signalé sur le bouton Corbeille (22/08, même jour) : ma 1re vérification était fausse

Retour direct suivant, avec le MÊME constat sur le bouton Corbeille
(Globe/Trash2, cas `isSaved && !isReadOnly` — playlist déjà sauvegardée).
**Mon 1er diagnostic était erroné** : j'avais mesuré l'alignement de la
BOÎTE CLIQUABLE du bouton (`getBoundingClientRect()` sur le `<button>`
lui-même) et trouvé 0px d'écart avec le badge BPM — concluant à tort que
le correctif du cadenas s'appliquait déjà. Sur contestation justifiée de
l'utilisateur ("menteur"), reprise plus rigoureuse : mesuré le SVG de
l'icône LUI-MÊME (pas son bouton englobant) → **8px d'écart réel**. Cause :
`Trash2`/`Globe` sont des icônes SEULES (14px) centrées dans un bouton de
30px (`p-2`, 8px de remplissage invisible de chaque côté, pour une zone de
survol confortable) — contrairement au badge BPM ou au badge "Lecture
seule" (`Lock`), qui ont tous deux une bordure/un fond VISIBLE remplissant
toute leur boîte jusqu'au bord. La boîte DOM du bouton Corbeille était
donc bien alignée avec le badge BPM, mais son GLYPHE VISIBLE, lui,
s'arrêtait 8px avant — un écart purement optique qu'une mesure de boîte
seule ne peut jamais détecter.

**Correctif** : `-mr-2` ajouté au bouton Corbeille (`p-2 -mr-2`), annulant
exactement son propre padding droit — le glyphe touche désormais le vrai
bord, sans réduire le cercle de survol (qui déborde légèrement du bord,
invisible tant qu'on ne survole pas). Vérifié à nouveau, cette fois sur le
bon repère (`trashSvg.getBoundingClientRect()`, pas le bouton) : 0px pile.
Badge "Lecture seule" (`Lock`) revérifié pour comparaison — confirmé SAIN
sans y toucher (sa propre boîte, bordure comprise, est déjà à 0px du badge
BPM ; seul son glyphe interne est en retrait, ce qui ne compte pas ici
puisque c'est la bordure qui porte le poids visuel, pas l'icône seule).
1 test de non-régression ajouté (`PlaylistHeaderBadges.test.jsx`, classe
`-mr-2` présente) — 14 tests passent (`vitest run` réel).

**Leçon retenue** (ajoutée à CLAUDE-SANDBOX-VERIFICATION.md, §5ter) : pour
un alignement visuel, mesurer le GLYPHE/CONTENU VISIBLE réel
(`element.querySelector('svg').getBoundingClientRect()`), jamais
seulement la boîte du conteneur cliquable — un bouton-icône avec padding
invisible peut être parfaitement aligné en boîte tout en étant décalé à
l'œil nu.

## Wizard générateur — coin de carte qui touchait la ligne du pied de page (21/08)

Retour direct avec capture zoomée : "barre quasi invisible mais présente
en dessous des 2 boutons du bas du générateur, et dans d'autres fenêtres" —
diagnostic impossible à trancher avec certitude en lisant le code seul,
alors **serveur de dev lancé en sandbox (`npm install` + `vite` + Playwright
fonctionnent ici, contrairement à ce qu'affirmait CLAUDE-SANDBOX-
VERIFICATION.md — à mettre à jour)** pour inspecter le rendu réel et les
styles calculés.

**Cause confirmée par mesure réelle** : le retrait de `min-h-[450px]`
(03/08, chantier "suppression du scroll résiduel") avait bien réglé le
débordement visé, mais un effet de bord jamais repéré depuis — sans
hauteur minimale forcée sur la carte du wizard, `mt-auto` (pied de page
Précédent/Suivant) ne crée plus AUCUN espace excédentaire à distribuer
quand une étape a peu de contenu (ex. "Structure de l'effort", 3 boutons
seulement, ou "Qu'est-ce qu'on fait aujourd'hui ?", 4 boutons). Mesuré au
pixel près via `getBoundingClientRect()` : le bas de la carte "Crescendo"
tombait à `684.5px`, le haut du `border-t` du pied de page À EXACTEMENT
`684.5px` — zéro pixel d'écart. Ces boutons ayant un coin arrondi
(`rounded-2xl`, 16px), sans la moindre marge pour finir sa courbe avant de
percuter la ligne droite juste en dessous, le rendu du navigateur produit
un artefact visuel (un "crochet" à l'intersection courbe/droite) —
quasi invisible à l'œil nu, mais bien réel et visible en zoomant, exactement
ce que montrait la capture.

**1er correctif tenté (abandonné)** : `<div className="flex-1">` (englobe
les 4 étapes du wizard) était devenu `<div className="flex-1 pb-3">` — 12px
de plancher minimal avant le pied de page. Fonctionnait pour l'artefact,
revérifié à l'époque (nouvel écart mesuré à 12px pile), MAIS retour
utilisateur juste après avec 2 nouvelles captures : "pourtant j'ai du
scroll... j'aurais plus supprimé ta ligne qui sert à rien" — ces 12px
ajoutés contribuaient bien au scroll résiduel observé en conditions
réelles (viewport de navigateur réel, jamais identique à un viewport
Playwright nu).

**Correctif final retenu** : retirer la ligne `border-t border-gray-100
dark:border-gray-800` elle-même plutôt que de lui laisser de la place —
elle était déjà établie comme quasi invisible dès le constat d'origine de
cette conversation, donc son retrait ne perd presque rien visuellement, et
sans ligne à éviter, plus besoin du `pb-3` du tout. `pt-6` seul suffit à
séparer visuellement le contenu du pied de page — résultat : **gain net
de hauteur par rapport à l'état d'avant tout ce chantier** (0px ajouté,
au lieu de +12px avec le 1er correctif), tout en éliminant l'artefact à
la racine plutôt qu'en le contournant. Revérifié en conditions réelles
après ce changement : capture de contrôle prise (Étape 1 ET Étape 2 en
Crescendo, le pire cas de hauteur), 0px de dépassement de page à 800px ET
700px de hauteur de viewport, layout visuellement identique à l'original
minus la ligne et son artefact.

Note en passant, hors périmètre de ce correctif : le MÊME code en dur
(`border-gray-100 dark:border-gray-800`, au lieu du token sémantique
`cardBorder`) apparaît aussi dans `EditRoutineModal.jsx`/
`EditPlaylistModal.jsx`/`PlaylistCard.jsx`/`RoutinesView.jsx`/
`FavoritesView.jsx` (8 occurrences restantes) — pas touchées, cette
question portait sur l'artefact du coin de carte à CET endroit précis,
pas sur l'harmonisation des couleurs de bordure partout où ce code
apparaît. En dark mode les 2 valeurs sont numériquement identiques
(`gray-800` = `--color-divider` dark), donc pas de bug visuel actuel côté
couleur ailleurs — mais en mode clair elles divergent (`gray-100` vs le
`--color-divider`/gray-200 sémantique), une incohérence latente qui reste
à traiter séparément si besoin.

## Sidebar — "Découvrir" isolé hors de "Création" (21/08)

Retour direct : "Découvrir" vivait dans CRÉATION depuis la refonte du
25/07 — mais par défaut, faute d'un meilleur endroit à l'époque, pas par
un vrai choix. Ce n'est ni créer pour soi (CRÉATION), ni consulter ce qui
est à soi (MON ESPACE) : c'est parcourir ce que D'AUTRES ont fait (modèles
du catalogue, profils publics) — une 3e intention distincte. Sidebar
passe donc de 3 à 4 groupes CONCEPTUELS : CRÉATION / MON ESPACE /
**DÉCOUVERTE** (nouveau, juste "Découvrir") / RÉGLAGES (pied de page fixe,
inchangé). Positionné en dernière section de la zone scrollable —
visuellement adjacent à Réglages sans toucher à son budget de hauteur
strict (`creditRowHeight`).
⚠️ **Titre "Découverte" retiré le même jour** (retour direct suite à
capture) — contrairement à CRÉATION/MON ESPACE, qui groupent chacun 2
liens aux noms DISTINCTS, un en-tête au-dessus d'un unique bouton au nom
quasi-identique ne groupait rien. Rendre le titre lui-même cliquable a été
envisagé puis écarté : les titres de section sont purement typographiques
partout ailleurs dans cette Sidebar, en faire une exception ici aurait
cassé cette convention sans qu'aucun visiteur ne s'y attende. Séparateur
au-dessus conservé (isole toujours visuellement de "Mon Espace"), seul le
texte disparaît.
2 tests ajoutés (`Sidebar.test.jsx`) — le bouton "Découvrir" n'avait
jusqu'ici AUCUNE couverture (ni sa présence hors de "Création", ni son
clic), comblé au passage. Un test vérifie explicitement l'ABSENCE du
texte "Découverte" (non-régression si quelqu'un le réintroduit un jour
sans repasser par ce raisonnement).

**Espacement resserré (même jour, retour direct suite à capture)** :
-10px en haut et en bas de "Découvrir" — 2 constantes distinctes dans
`sidebarLayout.js` : `SIDEBAR_DISCOVER_SEPARATOR_MARGIN` (`mt-5 mb-2.5`,
séparateur DÉDIÉ, distinct de `SIDEBAR_SEPARATOR_MARGIN` partagé avec
Création/Mon Espace — jamais mentionné, resté inchangé à `my-5`) pour le
haut, et `SIDEBAR_SCROLL_PADDING` désormais asymétrique (`pt-4 pb-1.5`,
au lieu de `py-4` symétrique) pour le bas. Variante COMPACTE (Mode Intime)
volontairement NON touchée — son budget est calculé main dans la main
avec le centrage du bouton "Quitter le Mode Intime", la modifier sans y
retoucher aussi l'aurait décalé, hors périmètre de cette demande.
`sidebarLayout.test.js` mis à jour (10 constantes désormais, au lieu de
9) — valeurs figées + vérification structurelle que le séparateur dédié
reste bien MOINS espacé que le partagé (pas juste différent).

**Asymétrie Mode Intime corrigée (même jour, retour direct suite à
2e capture)** — "pour le mode intime c'est tout cassé" : le conteneur du
bouton "Quitter le Mode Intime" a un `border-b` (la barre juste au-dessus
de "Création") mais AUCUNE marge après cette bordure — "Création" collait
dessus (0px), contre 20px (`my-5`, `SIDEBAR_SEPARATOR_MARGIN`) pour "Mon
Espace". Nouvelle constante `SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM` (`mb-5`,
21/08) ajoutée EN PLUS du padding `pt-0.5`/`pb-3.5` déjà en place (PAS en
remplacement) — une MARGE (hors bordure) n'a aucun effet sur le calcul de
centrage du bouton, qui ne dépend que du PADDING (dans la bordure) : les
deux réglages coexistent sans interférence. Valeur choisie délibérément
égale à la moitié basse de `SIDEBAR_SEPARATOR_MARGIN` — les 2 écarts
(Création vs Mon Espace) doivent rester identiques, donc les changer
ENSEMBLE si l'un bouge un jour ; pas fusionnées en une seule constante
pour autant, ce sont 2 besoins distincts. Tests ajoutés aux deux niveaux :
`sidebarLayout.test.js` (comparaison structurelle des 2 valeurs, pas juste
une égalité de chaînes — le point de cette constante EST qu'elles
matchent à l'époque) et `Sidebar.test.jsx` (classe présente sur le
conteneur réel en Mode Intime).

**Resserrement -2px par trait, 3e passe le même jour** (retour direct
avec capture annotée de 5 traits rouges : "supprime 2 pixels à chaque
trait rouge pour que je puisse voir le bouton découvrir dans la vue
intime sans scroll") — désynchronise DÉLIBÉRÉMENT
`SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM` de `SIDEBAR_SEPARATOR_MARGIN`
(`mb-5` → `mb-[18px]`, l'égalité testée dans le correctif précédent
n'était vraie qu'à ce moment précis, pas un invariant à vie) ; 2 NOUVELLES
variantes Mode Intime pour des constantes qui n'en avaient jamais eu
(`SIDEBAR_SEPARATOR_MARGIN_COMPACT` = `mt-[18px] mb-5`,
`SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT` = `mt-[18px] mb-2.5` — seul le
HAUT de chacune bouge, le bas n'était pas marqué) ; et le padding du
bouton "Quitter le Mode Intime" recalculé (`pt-0.5 pb-3.5` → `pt-0 pb-3`)
en conservant l'égalité qui le centre (12=12, contre 14=14 avant) — 2
traits marqués touchaient précisément ce couple. Mode normal totalement
épargné : les 2 séparateurs distinguent enfin normal/compact comme les 4
autres constantes du fichier le faisaient déjà.

**4e passe, même jour** (retour direct : "il manque encore quelques
pixels, à peu près autant que pour la précédente passe") — encore -2px
sur les 5 mêmes écarts : `SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM`
(`mb-[18px]`→`mb-[16px]`), `SIDEBAR_SEPARATOR_MARGIN_COMPACT`/
`SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT` (`mt-[18px]`→`mt-[16px]`
chacune, bas inchangé). Nouveauté cette passe : le `pt` du bouton
"Quitter" était déjà tombé à `pt-0` (minimum atteignable, pas de padding
négatif) à la passe précédente — impossible de resserrer encore l'espace
AU-DESSUS du bouton sans toucher `SIDEBAR_SCROLL_PADDING_COMPACT`,
épargnée jusqu'ici. Devient asymétrique (`py-3` symétrique →
`pt-[10px] pb-3`, -2px sur le haut uniquement, le bas — après "Découvrir"
— n'était pas concerné). Bouton recentré en conséquence :
`pb-3`→`pb-2.5` (10px, égal au nouveau haut effectif 10+0=10). Mode
normal toujours épargné.

**5e passe, même jour** (retour direct : "il manque encore quelques
pixels", sans traits précis cette fois) — ⚠️ vérifié AVANT d'agir : les 3
constantes compactes restantes (`SIDEBAR_LINK_PADDING_COMPACT`/
`SIDEBAR_LINK_GAP_COMPACT`/`SIDEBAR_SECTION_TITLE_MARGIN_COMPACT`) avaient
déjà été testées plus serrées le 29/07 (`py-1.5`/`space-y-1`/`mb-1`) puis
EXPLICITEMENT desserrées le même jour ("trop agressif, tasse trop la
navigation") — les retoucher aurait rouvert une décision déjà tranchée et
rejetée, donc volontairement laissées de côté SANS consultation
préalable, à signaler plutôt qu'à faire silencieusement. Seul levier
restant : le BAS de `SIDEBAR_SCROLL_PADDING_COMPACT` (jamais touché,
contrairement au haut) — `pb-3`(12px) → `pb-[10px]` (-2px), l'espace
après "Découvrir" avant le pied de page. N'affecte PAS le centrage du
bouton "Quitter" (qui ne dépend que du HAUT de cette constante + son
propre padding, tous deux inchangés cette passe).

**6e passe, même jour** (retour direct, nouvelle capture avec 5 traits
marqués comme la toute 1re fois : "en gros manque une quinzaine de
pixels") — retour aux 5 MÊMES écarts que les 2 premières passes, -3px
chacun cette fois (5×3=15px, cumul des 3 passes : -25px) :
`SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM` (`mb-[16px]`→`mb-[13px]`),
`SIDEBAR_SEPARATOR_MARGIN_COMPACT`/`SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT`
(`mt-[16px]`→`mt-[13px]` chacune), et le couple bouton "Quitter"/haut de
`SIDEBAR_SCROLL_PADDING_COMPACT` (`pt-[10px]`→`pt-[7px]`,
`pb-2.5`→`pb-[7px]`, toujours égaux donc bouton recentré). Le BAS de
`SIDEBAR_SCROLL_PADDING_COMPACT` (après "Découvrir", touché à la passe
précédente) n'était pas marqué cette fois — resté à `pb-[10px]`.
⚠️ Retour utilisateur explicite : "je vais y aller par étape" — d'autres
ajustements Mode Intime à prévoir dans une session future, celui-ci n'est
qu'un 1er correctif ciblé, pas une passe de stabilisation complète comme
celle du 28-29/07.

## Composant partagé `TabPills.jsx` (21/08) — standardisation des onglets

Retour direct : "pourquoi c'est pas le même modèle pour Routines et pour
Réglages ?" — trouvé que `SettingsView.jsx` avait dérivé vers un style
soulignement (`border-b-2`) pendant ~3 semaines (28/07 → 21/08) sans que
personne ne s'en aperçoive, faute d'un point d'entrée commun entre les
vues. En creusant pour répondre à "ça vaut le coup de standardiser ?",
2e dérive trouvée : `TrophiesView.jsx` utilisait un style "contrôle
segmenté" (fond `bg-surface-hover rounded-xl p-1`, boutons `rounded-lg`+
`shadow-xs`), visuellement proche mais structurellement différent du style
plat (`flex gap-1`, pas de fond) déjà majoritaire ailleurs (4 vues contre
1 — `PlaylistsView.jsx`/`ProfileView.jsx`/`DiscoverView.jsx` +
`SettingsView.jsx` une fois réaligné).

**Extrait en `src/components/shared/TabPills.jsx`** — composant contrôlé
(aucun state interne, `activeTab`/`onChange` pilotés par le parent), style
plat retenu (majoritaire), migré dans les 5 vues :
`PlaylistsView.jsx`/`ProfileView.jsx`/`DiscoverView.jsx`/
`SettingsView.jsx`/`TrophiesView.jsx`. `TrophiesView.jsx` perd son fond/
ombre au profit de la cohérence — vrai changement visuel assumé, pas un
simple refactor interne. `label` accepte un `ReactNode` (pas seulement une
chaîne) — couvre déjà tous les cas réels (compteur en opacité réduite,
icône `Lock`+texte) sans props dédiées `count`/`icon` : chaque appelant
compose son propre label, le composant se contente de le rendre.

Masquage conditionnel d'onglets (ex. `SettingsView.jsx` : "Profil
Athlétique" caché en Mode Intime, "Mon Compte" caché sans connexion) géré
par `.filter(Boolean)` sur le tableau `tabs` AVANT de le passer au
composant — `TabPills.jsx` ne connaît jamais la logique de masquage
elle-même, juste la liste finale à afficher.

Aucun test existant cassé (vérifié un par un) — tous ciblaient déjà le
texte affiché ou `role="tab"`/`aria-selected` plutôt que les classes CSS
brutes, robustes à ce refactor par construction. 1er fichier de test pour
`TabPills.jsx` lui-même (`tests/shared/TabPills.test.jsx`, 7 tests) —
rendu de base, `aria-selected`, clic → `onChange`, composant bien contrôlé
(aucun state interne), labels `ReactNode`.

## Tests

- `tests/` en miroir de `src/` (`views/`, `modals/`, `shared/`, `contexts/`, `hooks/`, `engine/`, `utils/`, `config/`, `data/`).
- 6 fichiers restés volontairement à la racine (`fileExtensionTrap.test.js`, `noDuplicateFiles.test.js`, `tailwindConcatTrap.test.js`, `testFileIdentityTrap.test.js`, `testLocationTrap.test.js`, `criticalExportsTrap.test.js` — ces 2 derniers ajoutés le 05/08, voir "État d'avancement") — des garde-fous qui scannent tout le projet via leur propre `__dirname`, les déplacer casserait leur scan. (Le compte était déjà erroné avant le 05/08 — `testFileIdentityTrap.test.js` manquait à la liste, corrigé au passage.)
- `PlaylistDetailContext.jsx` (Provider) n'a **pas** de couverture exhaustive — juste un test ciblé sur `isSaved`/`isReadOnly` (`tests/contexts/PlaylistDetailContext.test.jsx`). Le monter en entier exigerait de mocker `GeneratorContext` + `AudioPlayerContext` + le moteur de recalcul de timeline ; jugé disproportionné pour ce qui reste, à part ce point précis, de la logique triviale déjà couverte indirectement ailleurs.
- Aucune exécution réelle de `vitest` n'est possible dans le bac à sable Claude — voir `CLAUDE-SANDBOX-VERIFICATION.md`.

## Découpage `App.jsx` — chantier CONCLU le 21/08 (3 extractions : StatsView, Image de partage, rendu du bandeau Génération)

**Repoussé volontairement le 08/08** (retour direct) — voir plus haut, section "État d'avancement", pour le découpage déjà fait de `PlaylistHeader.jsx` (836 → 254 lignes, même famille de chantier). Raison du report à l'époque : refonte intégrale du menu de navigation + nouvelles fonctionnalités prévues dans les prochains jours — découper avant aurait obligé à deviner des frontières qui allaient de toute façon bouger. Approche retenue en attendant : écrire toute nouvelle fonctionnalité directement dans son PROPRE hook/context dédié plutôt que comme un `useState` de plus dans `AppContent` — le découpage se fait ainsi organiquement, au fil de l'eau (voir tous les `Context.jsx` déjà extraits : `GeneratorContext`/`AthleticContext`/`AudioPlayerContext`/`CustomActivityContext`/`ModalContext`/`PlaylistDetailContext`/`PlaylistEditContext`).

**Repris le 20/08** — "les modifs de navigation auxquelles je pensais" jugées faites. Avant d'agir : inventaire complet des `useState` restants dans `AppContent` (28 → 22 après ce 1er lot), classés par cluster, plutôt que de redécouper au hasard.

### 1er lot fait : cluster StatsView (6 `useState` rapatriés)

`showAdvancedStats`/`statsMode`/`selectedStatsGenre`/`selectedStatsBpmBucket`/
`expandedDetailGenre`/`expandedDetailArtist` vivaient dans `AppContent` pour
une raison devenue **obsolète** : à l'époque, `StatsView` était rendue en
IIFE directement dans le JSX d'`AppContent` (`view === 'stats' &&
(() => {...})()`), un `useState` local aurait violé les règles des Hooks.
Depuis l'extraction de `StatsView.jsx` en vrai composant séparé, cette
contrainte ne s'applique plus. Vérifié AVANT de bouger quoi que ce soit :
tous les 6 n'étaient utilisés QUE comme props de `<StatsView/>`, nulle part
ailleurs dans `App.jsx` — extraction sûre en `useState` local.

**Changement de comportement assumé, pas caché** : ce state ne persiste
plus en naviguant hors de "Mes Statistiques" puis en y revenant (ex. un
genre déplié dans la vue détaillée se replie). Aucun commentaire n'affirmait
cette persistance volontaire — un simple effet de bord de la contrainte
technique ci-dessus, jamais corrigé après coup.

Tests : `StatsView.test.jsx` — 2 tests qui pilotaient `statsMode`
DIRECTEMENT par prop (`re-fetch quand statsMode change`, `en Mode Intime`)
réécrits pour piloter `isNaughtyMode` à la place (la vraie prop restante,
qui déclenche l'effet interne de synchronisation `[isNaughtyMode]` —
vérifié dans le code avant de faire confiance au test). `baseProps()`
nettoyée des 6 props mortes.

### 2e lot fait : cluster "Image de partage" (4 `useState` → `ShareImageContext.jsx`, 21/08)

Confirmé génuinement partagé (voir le 20/08 ci-dessus) entre `PlaylistDetailView.jsx`
(génère l'image en arrière-plan) et `ShareModal.jsx` (l'affiche/laisse la
retirer) — extrait en un vrai Contexte dédié plutôt qu'une redescente, comme
prévu. `ShareImageProvider` monté dans `<App/>` au même niveau que
`<ModalProvider>` (même raisonnement de placement : rien en dehors
d'`AppContent` n'y accède). `summaryImageStatus`/`summaryImageFile`/
`summaryImagePreviewUrl`/`includeSummaryImage` + leurs 4 setters ne sont
plus prop-drillés (2 niveaux vers `PlaylistDetailViewInner`, 1 niveau vers
`ShareModal`) — les deux composants appellent maintenant `useShareImage()`
directement. Toute la LOGIQUE (génération, protection contre un changement
de playlist en cours de route via `currentPlaylistIdRef`, reset au
changement de playlist) reste entièrement dans `PlaylistDetailView.jsx`,
inchangée — ce Contexte ne fait qu'exposer le state, comme `ModalContext.jsx`
le fait pour `activeModal`/`modalData`. `value` mémoïsée (`useMemo`), même
convention que les autres Contexts depuis le correctif AuthContext du 19/08.
2 fichiers de test existants adaptés (`ShareModal.test.jsx`/
`PlaylistDetailView.test.jsx`) — `useShareImage()` mocké dynamiquement
(`vi.fn()` + `mockReturnValue`), même pattern que `MiniPlayerBar.test.jsx`
pour `AudioPlayerContext`.

### 3e lot fait : rendu du bandeau "Génération en cours" extrait (21/08)

`GenerationProgressBanner.jsx` (nouveau, `src/components/shared/`) — le JSX
du bandeau flottant + `getGenerationBannerMessage` (message à 3 paliers de
temps, 14/08) déplacés tels quels depuis `App.jsx`, en composant
présentationnel recevant tout en props. ⚠️ **PAS un Contexte** — les 6
`useState` sous-jacents restent dans `AppContent`, pour la même raison que
`view`/`isMobileMenuOpen` (cluster Navigation, voir plus bas) : leurs
setters sont des arguments directs de `usePlaylistGeneration(...)`, un hook
appelé avant le `return` d'`AppContent`. Extraire le JSX seul, sans toucher
au state, contourne cette contrainte — c'est ce que le README anticipait
depuis le 20/08 ("sortir le bandeau LUI-MÊME dans un composant... dédié").
1er fichier de test pour ce bandeau (`GenerationProgressBanner.test.jsx`,
12 tests) — 0 couverture avant (JSX inline dans `App.jsx`, lui-même sans
test miroir). Import `X` (icône) retiré d'`App.jsx`, devenu inutilisé après
le déplacement.

### Clusters restants dans `AppContent` — VÉRIFIÉS le 20/08, aucun n'est un candidat aussi simple que StatsView

Contrairement à ce que l'inventaire initial laissait penser, les 2 autres
clusters "petits" ont été vérifiés individuellement — et ni l'un ni
l'autre n'est un simple oubli comme StatsView l'était :

- ~~**Génération**~~ **Rendu extrait (21/08)** — `GenerationProgressBanner.jsx`
  (`isGenerating`/`generatingTotal`/`generatingDone`/`isGeneratingSlowGenre`/
  `isGeneratingLongPlaylist`/`generatingEstimatedTracksFound`, 6 `useState`).
  ⚠️ Contrairement à "Image de partage", **le STATE lui-même reste dans
  AppContent** — pas déplaçable en Contexte, `usePlaylistGeneration.js` le
  documente déjà depuis le 25/07 : ses 4 setters sont passés en ARGUMENT
  DIRECT à `usePlaylistGeneration(...)`, un hook appelé plus bas dans le
  corps d'`AppContent`, avant son `return` — même contrainte d'ordre entre
  hooks que celle qui bloque `view`/`isMobileMenuOpen` (voir "Navigation"
  plus bas). Ce qui A pu être extrait, c'est le JSX du bandeau flottant
  LUI-MÊME (`getGenerationBannerMessage` incluse, message à 3 paliers de
  temps, 14/08) — un composant présentationnel qui reçoit tout en props
  simples, sans Contexte, sans toucher à la contrainte d'ordre. `App.jsx`
  n'a donc PAS moins de `useState` après ce chantier (contrairement à
  StatsView/Image de partage), mais son JSX est plus court et le message du
  bandeau a enfin son propre fichier de test (`GenerationProgressBanner.test.jsx`
  — 0 couverture avant, le JSX vivait inline dans un fichier lui-même sans
  test miroir).
- ~~**Image de partage**~~ **Fait (21/08)** — voir "2e lot fait" plus haut,
  extrait en `ShareImageContext.jsx`.
- **Navigation** (`view`/`viewingProfileUsername`/`isMobileMenuOpen`/
  `isUserMenuOpen`/`settingsInitialTab`/`playlistsInitialTab`/`isScrolled`/
  `isGuestBarDismissed`, 8 `useState`) — **AUDITÉ le 21/08** (pas vérifié en
  détail au 20/08, l'affirmation "également partagé" plus haut était une
  supposition, pas un audit réel) : contrairement à ce que l'inventaire
  initial laissait penser, **3 des 8 ne sont PAS partagés du tout** —
  `isUserMenuOpen` (menu avatar, entièrement local à `AppContent`, jamais lu
  par Sidebar/aucun enfant), `isScrolled` (idem, n'affecte que le header
  flottant desktop rendu dans le JSX propre d'`AppContent`) et
  `isGuestBarDismissed` (seule sa forme DÉRIVÉE, `isGuestBarVisible`, est
  transmise en prop — le booléen brut reste local). Un Contexte n'aurait
  donné AUCUN bénéfice sur ces 3-là (rien à qui les partager) — les
  déplacer aurait ajouté de l'indirection pour rien, même erreur que
  d'avoir supposé "Génération"/"Image de partage" déplaçables sans vérifier
  au 20/08.
  ⚠️ **`isScrolled` — trouvé "cassé" en cours d'audit (21/08), PUIS RETIRÉ
  le jour même, pas juste réparé** : `setIsScrolled` n'était appelé NULLE
  PART dans tout le projet, ce header flottant desktop (opacité
  conditionnelle au scroll) ne pouvait donc jamais apparaître, resté à
  `false` depuis sa création. 1er réflexe (même jour) : combler le trou,
  listener de scroll ajouté sur `#main-scroll-area`. Une fois VRAIMENT
  visible pour la première fois (retour direct, capture d'écran), 2
  problèmes de fond sont apparus qu'aucun audit de code seul n'aurait
  révélés : (1) son seul commentaire d'origine dit lui-même qu'il
  "dupliquait le comportement du logo Sidebar" — logo qui, sur desktop,
  est déjà TOUJOURS visible (sidebar fixe, ne scrolle jamais) ; sa
  justification "rappel de marque au scroll" n'a donc jamais eu de sens
  dans CE layout précis ; (2) son sous-titre (`displaySubtitleGen`,
  `useGeneratorForm.js`) est câblé en dur sur le tagline du GÉNÉRATEUR,
  jamais contextuel à la vue réellement affichée — scroller dans
  Réglages/Stats/une playlist aurait affiché un texte sans rapport. Retiré
  intégralement (JSX + `isScrolled`/`mainScrollRef`/le listener +
  `displaySubtitleGen` de la déstructuration d'`AppContent`, resté utilisé
  par `GeneratorView.jsx` lui-même, inchangé). Le vrai enseignement : un
  `useState` "cassé" trouvé en audit n'est pas automatiquement un bug à
  réparer — vérifier D'ABORD si la fonctionnalité qu'il pilote a encore sa
  place, avant d'investir dans sa remise en marche.
  Les 5 restants (`view`/`viewingProfileUsername`/`isMobileMenuOpen`/
  `settingsInitialTab`/`playlistsInitialTab`) sont bien partagés avec 1
  enfant chacun, mais **AUDIT COMPLET le 21/08 : AUCUN vaut le coup
  d'extraire en Contexte**, pour deux raisons distinctes et vérifiées (pas
  supposées) :
  1. `view`/`isMobileMenuOpen` (+ `changeView`/`hasUnsavedPlaylist`/
     `openCuratedPlaylist`, sortie de `useNavigation()`) sont **bloqués par
     une vraie contrainte d'ordre entre hooks** : `openCuratedPlaylist` et
     `changeView` sont passés en ARGUMENT DIRECT (évaluation immédiate, pas
     une fermeture différée) à `usePlaylistLibrary(...)` et
     `usePlaylistGeneration(...)` respectivement, tous deux appelés PLUS
     BAS dans le corps d'`AppContent`, avant le `return`. `useNavigation()`
     (et donc `view`/`setView`/`setIsMobileMenuOpen`, ses paramètres) ne
     peut donc PAS être déplacé dans un Provider monté au niveau du JSX
     (comme `ShareImageProvider`) sans casser cet ordre — il doit rester
     appelé directement dans `AppContent`, exactement où il est. Même
     famille de contrainte que celle déjà documentée dans
     `useNavigation.js` lui-même pour `resolvePendingNavigation` (cycle
     hook → valeur → hook).
  2. `viewingProfileUsername`/`settingsInitialTab`/`playlistsInitialTab`
     n'ont PAS ce blocage (vérifié : jamais passés en argument à un autre
     hook) — mais chacun n'est transmis qu'à **UN SEUL enfant, à UN SEUL
     niveau** (`<ProfileView username=.../>`, `<SettingsView
     initialTab=.../>`, `<PlaylistsView initialTab=.../>` — direct depuis
     `AppContent`, aucun intermédiaire). Contrairement à "Image de
     partage" (2 niveaux de prop-drilling via `PlaylistDetailView` →
     `PlaylistDetailViewInner`), un Contexte ici n'aurait RIEN à
     simplifier — juste un fichier de plus pour un passage de prop déjà
     aussi simple que possible.

**Conclusion de ce chantier (20/08, conclu le 21/08)** : le cluster
StatsView était vraisemblablement LE candidat "dette oubliée, extraction
sûre" disponible dans ce fichier. Des 2 autres clusters identifiés au
départ, "Image de partage" s'est avéré un vrai candidat à un Contexte et a
été extrait (`ShareImageContext.jsx`) ; "Génération" avait la MÊME
contrainte d'ordre entre hooks que "Navigation" (voir juste en dessous) —
pas de Contexte possible pour son state, mais son JSX a quand même pu être
extrait en composant présentationnel (`GenerationProgressBanner.jsx`), sans
toucher à cette contrainte ; "Navigation", une fois vérifié en détail
plutôt que supposé, s'avère volontairement NON déplaçable pour la moitié de
son périmètre (même contrainte d'ordre) et sans bénéfice réel pour l'autre
moitié (déjà de simples props à 1 niveau) — laissé tel quel, aucune
extraction possible ou utile. Ce chantier se conclut ici avec 3
extractions réelles sur 3 clusters envisagés (2 en Contexte, 1 en simple
composant de rendu) — chaque décision (extraire, extraire partiellement,
ou laisser tel quel) vérifiée au cas par cas plutôt que supposée.

## Nettoyage (22/08, check-up général) — destructuration morte de `useGeneratorContext()` dans `AppContent`

Repéré en check-up général, sans chantier précis en tête. Le bloc qui lit
`useGeneratorContext()` au sommet d'`AppContent` (juste avant `ModalContext`
plus haut) contenait ~55 variables destructurées ; **~50 d'entre elles
n'étaient en réalité utilisées NULLE PART ailleurs dans `App.jsx`** —
lisibles uniquement dans leur propre ligne de déclaration. Le commentaire
qui justifiait ce bloc ("AppContent les lit ici pour ses propres besoins,
handleSaveRoutine...") était lui-même déjà faux : `handleSaveRoutine` vit
dans `useRoutineActions.js`, qui appelle sa PROPRE copie du contexte —
exactement la même famille d'erreur que celle déjà trouvée et corrigée sur
`customActivity` dans ce même bloc le 08/08, mais l'audit n'avait pas été
étendu au reste à l'époque.

**Piège méthodologique rencontré en vérifiant** : un premier passage au
simple `grep` sur ces noms de variables a donné un résultat FAUX-VIVANT
pour la plupart d'entre elles (`bpm`, `workoutType`, `distanceVal`,
`paceMin`...) — parce que ce fichier contient de nombreux objets littéraux
(configs de routine/playlist) avec des clés portant EXACTEMENT les mêmes
noms (`workoutType: 'Course à pied'`, `editingRoutine.paceMin`,
`preview.workoutType`...). `grep` ne distingue pas une clé d'objet ou un
accès de propriété d'un usage réel de la variable locale. Seul un outil à
vraie analyse de portée (ESLint, règle `no-unused-vars`) donne un résultat
fiable ici — confirmé ensuite occurrence par occurrence à la main avant de
toucher au fichier, étant donné sa sensibilité.

**Gardé (5 variables, usage réel vérifié)** : `setWizardStep` (reset du
wizard sur résolution d'une navigation en attente), `showExtraGenres`/
`setShowExtraGenres` et `CRESCENDO_MIN_MAIN_PCT` (props de
`<EditRoutineModal/>`), `availableGenres` (prop de `<FavoritesView/>`).

**2 imports morts retirés au passage**, trouvés par le même balayage
ESLint : l'import par défaut `React` (JSX transform automatique de
`@vitejs/plugin-react`, confirmé dans `vite.config.js` — plus nécessaire
depuis longtemps) et `DualRangeSlider` (importé mais jamais rendu dans ce
fichier ; le composant lui-même n'est pas orphelin, toujours utilisé
ailleurs dans le projet).

Build réel + suite de tests complète (1507 tests) revérifiés après coup,
rien de cassé — changement purement de lecture (aucune valeur, aucun
comportement modifié), donc risque de régression minimal malgré la taille
du diff.

**Suite du même check-up, sur demande explicite ("continuer")** — le même
balayage ESLint étendu à tout `src/` (pas seulement `App.jsx`) a révélé 2
autres blocs de destructuration morte dans `App.jsx`, du même type que
celui ci-dessus, plus plusieurs cas isolés dans d'autres fichiers :

- **`App.jsx`, bloc `athleticProfileApi`** : réduit de 15 à 3 variables
  (`athleticProfile`, `getProfileForWorkout`, `getProfileForWorkoutOrDefault`).
- **`App.jsx`, bloc `search`** (recherche musicale) : 9 setters retirés
  (`setIsWorldSearching`, `setSearchResultsOffset`/`searchResultsOffset`,
  `setSearchHasMoreResults`, `setIsLoadingMoreResults`,
  `setSearchActiveArtistName`, `setSearchLoadingMessage`,
  `setWorldSearchOtherResults`, `setBpmSearchParams`) — sans impact sur
  `useDeezerSearch(search, ...)`, qui reçoit l'objet `search` COMPLET, pas
  ces noms courts déstructurés localement.
- **`App.jsx`, variables isolées** : `setUserStats` (le hook continue de le
  générer en interne), `setSpotifyTrackPool`/`syncSpotifyFavorites`
  (vérifié : `useSpotifyImport.js` synchronise déjà tout seul via un
  `useEffect` interne, rien n'était cassé), `hasUnsavedPlaylist` (son effet
  `beforeunload` vit dans `useNavigation.js`), `playlistHasHistory` (utilisée
  en interne par `usePlaylistLibrary.js`, jamais ici), `borderAccentClass`/
  `inputBg`/`inputBorder` (l'objet `themeTokens` complet reste transmis aux
  vues enfants via `theme={themeTokens}`, sans impact).
- **`AthleticProfilePanel.jsx`** : import mort `getZoneForValue` et
  variable morte `getDefaultBaseBpm` retirés (utilisée seulement à
  l'intérieur de `buildDefaultPreviewProfile`, jamais directement ici).
- **`TrackItem.jsx`** et **`RoutinesView.jsx`** : `textColorClass` mort
  retiré dans les deux — coïncidence de nom, pas un pattern systémique
  (la variable est bien vivante ailleurs, notamment dans `App.jsx`).
- **`PlaylistDetailView.jsx`** : 3 getters retirés
  (`summaryImageFile`/`summaryImagePreviewUrl`/`includeSummaryImage`,
  issus du tout récent `ShareImageContext.jsx` du 21/08) — ce composant est
  le PRODUCTEUR de ces valeurs (génère l'image de bilan via les setters,
  conservés), `ShareModal.jsx` en est le CONSOMMATEUR (lit sa propre copie
  du contexte pour l'affichage). Un commentaire adjacent, resté sur
  l'ancienne architecture ("reçus EN PROPS depuis App.jsx", vrai avant le
  21/08), corrigé au passage.
- **`StatsView.jsx`** : 6 champs retirés de la déstructuration de
  `statsAggregation` (`bpmBucketArtistCounts`, `bpmBucketTrackCounts`,
  `bpmBucketGenreCounts`, `nowForZones`, `classifyIntoZone`,
  `trackGenreLabel`) — bien calculés et utilisés à l'intérieur de
  l'agrégation elle-même, jamais consommés après coup dans le reste du
  composant. Le calcul interne n'a pas changé.
- **`PlaylistDetailContext.jsx`** : import mort `supabase` retiré (jamais
  appelé dans ce fichier — contrairement à `App.jsx`/`SettingsView.jsx`/
  etc., qui l'utilisent réellement).

**Piège méthodologique confirmé une 2e fois pendant cette suite** :
plusieurs faux-vivants supplémentaires détectés par un premier passage au
`grep` (avant de se souvenir qu'ESLint est la source fiable ici) —
`checkGenreWeightDeviation` semblait "utilisée" à cause d'un simple
COMMENTAIRE mentionnant son nom, et `crescendoWarmupPct`/`paceMin`/
`distanceUnit` etc. semblaient "utilisées" à cause d'accès de propriété sur
un AUTRE objet (`editingRoutine.paceMin`) ou de clés d'objet littéral
(`distanceUnit: 'km'`). Confirme la leçon déjà tirée plus haut : sur ce
fichier dense en configs/objets literals, seule une vraie analyse de
portée (ESLint) est fiable, jamais un simple texte-matching.

Quelques `no-useless-assignment` supplémentaires repérés par le même
balayage (`PlaylistCharts.jsx`, `musicEngine.js`, `searchEngine.js`,
`clipboard.js`) vérifiés et écartés : dans chaque cas, une valeur par
défaut réécrite dans CHAQUE branche d'un if/else (couverture exhaustive),
motif défensif volontaire, pas un bug. `catch (e)`/`catch (err)` non
utilisés (des dizaines d'occurrences dans tout le projet) écartés de la
même façon : style volontaire et cohérent du projet, pas une dette
oubliée.

**3e passe du même check-up ("continuer" une 2e fois)** — cette fois
`eslint-plugin-react-hooks` (`rules-of-hooks` + `exhaustive-deps`), jamais
utilisé jusqu'ici dans ce projet. **`rules-of-hooks` : 0 erreur** (aucun
hook appelé conditionnellement ou hors composant/hook). `exhaustive-deps` :
13 avertissements, tous vérifiés au cas par cas (pas de confiance aveugle,
même leçon que pour `no-unused-vars`) :

- La quasi-totalité sont des omissions VOLONTAIRES déjà correctement
  gérées : `App.jsx` (bloc `editingRoutine`, déjà annoté d'un
  `eslint-disable-next-line` explicite), `TrophiesView.jsx`
  (`markTrophiesSeen`, appel volontaire "une fois à l'ouverture", déjà
  documenté en prose), `useAudioPreview.js` (9 fonctions volontairement
  hors dépendances, déjà documenté en détail : elles ne ferment que sur des
  refs stables + les mêmes deps déjà listées), `App.jsx` (effet
  `fillDemoPreviews`, déjà annoté "une seule fois au montage").
- **2 vrais trous de DOCUMENTATION comblés dans `useSessionAnalysis.js`**
  (pas des bugs, vérifié en détail avant de conclure) : l'effet de
  pré-sélection de date et l'effet d'auto-bascule de métrique manquaient
  tous les deux d'une explication sur pourquoi leurs dépendances sont
  volontairement incomplètes, contrairement à la convention du reste du
  projet. Vérifié que ce sont bien des choix sûrs : le 1er est déjà couvert
  par `handleCSVUpload` (`useCsvImport.js`), qui met à jour
  `selectedAnalysisDate` directement après un import réussi ; le 2e est
  structurellement sûr car `availableMetrics` est recalculé à chaque rendu
  depuis `currentActualData` (déjà en dépendance) et le sélecteur de
  métrique dans l'UI n'apparaît que si les deux métriques sont disponibles.
  Commentaires + `eslint-disable-next-line` ajoutés aux deux, aucun
  changement de comportement.

Vérifications complémentaires sans trouvaille : aucun
`dangerouslySetInnerHTML` (pas de risque XSS de ce type), aucun secret/clé
API codé en dur trouvé par balayage de motifs, aucun `.map()` JSX sans prop
`key` détecté.

## Migration recharts 2.15 → 3.10.1 (22/08, sur demande explicite après recommandation du check-up)

Recommandée à l'issue du check-up général : la branche 2.x n'a plus reçu
de release depuis plus d'un an et le mainteneur a déprécié tout ce qui
précède la v3. Avant de migrer, guide de migration officiel lu en entier
puis chaque point de rupture vérifié CONTRE l'usage réel du projet (pas
supposé) :

- Exigences minimales v3 (React 16.8+, Node 18+) : largement dépassées
  (React 19, Node ≥20.19 dans `engines`).
- Aucune trace dans tout le projet de `activeIndex`, `CategoricalChartState`,
  `<Customized/>`, `blendStroke`, `alwaysShow`, `isFront`, `ref.current.current`
  (ResponsiveContainer), ni d'axes multiples avec `yAxisId`/`xAxisId`
  personnalisés (les 2 `<YAxis>` du projet sont dans 2 graphiques SÉPARÉS,
  un seul axe Y chacun) — aucune des API supprimées/modifiées par la v3
  n'est utilisée ici.
- **1 vrai point d'attention trouvé et corrigé PRÉVENTIVEMENT** (sûr aussi
  en v2, donc appliqué avant même de changer la version) :
  `PlaylistCharts.jsx` déclarait `<RechartsTooltip/>` AVANT `<Legend/>`
  dans le JSX. Le guide v3 précise que l'ordre de rendu SVG suit désormais
  strictement l'ordre du JSX (v2 "trichait" en interne sur cet ordre) — la
  Legend, déclarée après, serait passée AU-DESSUS du Tooltip en cas de
  chevauchement visuel. Inversé (`Legend` puis `Tooltip`), conforme à la
  recommandation officielle. `StatsView.jsx` n'importe même pas `Legend`,
  aucun risque de ce type là-bas.

**Exécuté** : `package.json`/`package-lock.json` mis à jour vers
`recharts@3.10.1`, `npm install` propre (plus aucun warning de
dépréciation). Build réel + suite de tests complète (1507 tests)
revérifiés après coup : tout passe, aucune régression détectée par les
tests.

**Vérification visuelle réelle NON obtenue cette fois — à signaler
honnêtement** : tentative d'utiliser Playwright (capacité découverte le
21/08, voir CLAUDE-SANDBOX-VERIFICATION.md §5ter) pour comparer
visuellement le rendu des graphiques avant/après. Échec : le
téléchargement du binaire Chromium lui-même échoue maintenant
(`cdn.playwright.dev` hors liste d'autorisation réseau), alors que §5ter
documentait cette même commande comme fonctionnelle le jour même — **la
liste des domaines réseau autorisés en sandbox n'est visiblement pas
stable dans le temps**, détail important ajouté à
CLAUDE-SANDBOX-VERIFICATION.md (§5quinquies) pour que la prochaine session
re-teste plutôt que de supposer. Repli utilisé à la place : le serveur
`vite` réel démarre et sert tous les fichiers concernés sans erreur, et le
module `recharts` pré-bundlé par Vite (curl direct sur le chunk
`.vite/deps/recharts.js`, 5 Mo) contient bien tous les exports attendus
(`PieChart`, `LineChart`, `Legend`, `CartesianGrid`...) sans la moindre
erreur de résolution de module. Bonne indication indirecte, mais **pas un
substitut à une vraie inspection visuelle** — recommandé de garder un œil
sur le rendu des 5 `<Pie>` et des graphiques en ligne/barres à la première
occasion d'ouvrir l'app réellement (les 2 changements visuels connus de la
v3 — plus de bordure au clic sur les sections de pie, `CartesianGrid`
inverse l'ordre de rendu de son fond — sont mineurs et n'entrent en
conflit avec aucun style personnalisé trouvé dans ce projet, mais restent
à confirmer à l'œil).

**Suite (22/08, après confirmation que le déploiement réel fonctionne)**
— 2 vérifications supplémentaires liées directement à cette migration :

- **`accessibilityLayer` (nouveau défaut `true` en v3, `false` en v2)** :
  ajoute des contrôles clavier internes à recharts sur CHAQUE graphique.
  Sans risque identifié pour 7 des 8 graphiques du projet (affichage pur,
  aucune interaction personnalisée). MAIS `PlaylistCharts.jsx` a un
  `<LineChart>` avec un glisser-déposer maison pour éditer les pistes
  (`handleChartMouseDown/Move/Up`, `isDraggingChartSegment`) — jamais
  testable interactivement cette session (pas de navigateur). Par
  prudence, `accessibilityLayer={false}` ajouté explicitement à CE
  graphique précis pour garantir un comportement identique à avant la
  migration ; les 7 autres gardent le nouveau défaut (améliore
  l'accessibilité clavier sans risque connu pour eux).
- **Fausse piste explorée et écartée, pour référence future** : un script
  a signalé ~70 fonctions `async` contenant un `await` sans `try/catch`
  visible dans leur propre corps. 3 vérifications individuelles dans 3
  fichiers différents (`App.jsx`, `AuthContext.jsx`, `musicEngine.js`) ont
  toutes révélé la même explication : la fonction AWAITÉE gère déjà
  entièrement ses propres erreurs en interne et ne rejette jamais
  (`shareImageFile`/`detectBpmFromPreview` retournent un statut ou `null`
  au lieu de lever une exception ; le client Supabase renvoie `{ data,
  error }` au lieu de rejeter). Motif défensif cohérent et déjà établi
  dans ce projet, pas une dette oubliée — les 67 cas restants non
  vérifiés individuellement suivent vraisemblablement le même motif, mais
  ne pas les avoir tous vérifiés un par un reste une limite honnête de
  cette passe.

## Corrigé (20/08) — anciennement "Limite connue, non traitée : écritures concurrentes de MÊME TYPE sur la MÊME playlist"

**Constat d'origine (check-up 10/08)** : les 5 correctifs de course du 10/08
(`currentPlaylistIdRef`/`savedPlaylistsRef`/`routinesRef`/`userStatsRef`,
voir "État d'avancement" plus haut) protègent contre une ANCIENNE fermeture
asynchrone qui écrase un changement survenu APRÈS elle (playlist
différente, action différente). Ils ne protégeaient PAS contre deux
actions du MÊME type, sur la MÊME playlist, lancées à quelques secondes
d'écart sans attendre la première (ex. cliquer "Remplacer" sur deux titres
différents de la même playlist coup sur coup) — "le dernier qui écrit
gagne" pouvait perdre un des deux remplacements.

**Repoussé le 10/08** pour deux raisons, toutes deux devenues obsolètes le
20/08 :
- Fenêtre de déclenchement étroite (reste vrai, mais plus un obstacle).
- Un simple `setXxx(x...)` → `setXxx(prev => ...)` n'aurait pas suffi :
  `prev =>` protège la référence du TABLEAU (`savedPlaylists`), pas
  l'objet PLAYLIST à l'intérieur — corriger correctement demandait de
  retrouver la playlist cible À L'INTÉRIEUR du `prev =>`, pas juste
  ajouter une flèche partout.

**Corrigé le 20/08** (`PlaylistDetailContext.jsx`, `applyPlaylistUpdate`)
— repoussé jusqu'ici volontairement "en même temps que la refonte de
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



## Bouton "Planifier" — libellé visible incohérent avec son propre tooltip une fois la séance déjà réalisée (22/08)

Signalé par retour direct, capture d'écran à l'appui : une playlist déjà
verrouillée (séance réalisée, badge "🔒 22 août 2026" affiché) montrait
quand même un bouton "Planifier" tant qu'aucune date n'avait été
explicitement choisie via le sélecteur — trompeur, "planifier" n'a plus
vraiment de sens une fois la séance déjà faite.

En creusant (`PlaylistHeaderActions.jsx`) : la distinction existait déjà,
mais SEULEMENT dans le `title` (tooltip invisible au survol) —
`isLocked ? "Refaire cette séance" : "Planifier cette séance"` — jamais
répercutée dans le `<span>` visible du bouton lui-même, qui ne regardait
que `currentPlaylist.plannedDate` (affiche la date si elle existe, sinon
toujours "Planifier", sans jamais consulter `isLocked`). Corrigé pour que
le libellé VISIBLE suive la même logique que le tooltip : "Refaire" si
`isLocked` et pas de date planifiée, sinon comportement inchangé (date
choisie affichée en priorité, "Planifier" par défaut si la séance n'a
jamais été faite). 2 tests de régression ajoutés
(`PlaylistHeaderActions.test.jsx`) : `isLocked=true` sans date → "Refaire"
affiché, pas "Planifier" ; `isLocked=true` AVEC une date déjà planifiée →
la date garde la priorité sur "Refaire" (comportement déjà correct,
vérifié qu'il n'a pas été cassé par ce changement).

## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — outils de vérification de code pour une session Claude sans accès réseau.
- `DEEZER-CONNECT-REMOVED.md` — historique d'une intégration retirée.
- `supabase-schema.sql` — rejouable en entier sans risque (`drop if exists` systématique avant chaque `create`).
