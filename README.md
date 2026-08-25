# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

Rien en cours actuellement — session exceptionnellement longue (22/08,
suite directe de celle du 21-22/08, bloc 6, elle-même suivie d'un 1er
élagage le même jour, bloc 7), tous les chantiers fermés et vérifiés.
Après le check-up/migration recharts/corrections UI du bloc 7 : une
série de corrections en cascade sur `cloneCount` (4 correctifs le même
jour, chacun révélant le suivant) et sur le centrage
`GuestModeBar.jsx`/`MiniPlayerBar.jsx` (3 tentatives avant la vraie
cause, trouvée dans `BottomBarShell.jsx` lui-même), puis 4 extractions
de composants partagés (`BottomBarShell.jsx`/`ModalShell.jsx`/
`ModalCloseButton.jsx`/`SelectablePill.jsx`) et un garde-fou automatique
(`flexDependentClassTrap.test.js`). Voir "À vérifier visuellement" plus
bas pour les risques encore non mesurés, et `HISTORIQUE.md` blocs 7 et 8
pour le récit complet.

### Historique détaillé (22/08, suite du bloc 7) — archivé dans `HISTORIQUE.md`, bloc 8

Récit chronologique complet déplacé le 22/08 (8e élagage, même jour et
même session que le 7e — cette fois dominée par des enchaînements
"correctif → nouveau retour direct → le correctif était insuffisant/faux
→ vraie mesure → correctif définitif"). Index :

- **Génération simple → sauvegarde automatique** — "prends du recul" a
  renversé un 1er avis ("ça pollue Mes Playlists") une fois vérifié que
  la modification d'une playlist non sauvegardée est de toute façon
  bloquée par le code.
- **`cloneCount`, 4 correctifs en cascade le même jour** —
  `handleClonePlaylist` puis `handleSavePlaylist` (même bug, hypothèse
  de départ fausse) puis `removeSavedPlaylist` (cassé par le correctif
  précédent, effet de bord non anticipé entre 2 fonctions modifiées le
  même jour) puis un audit explicite qui n'a PAS trouvé ce 3e problème
  (trouvé seulement par un retour direct suivant).
- **Bandeau "Génération en cours"** — "..." trompeurs retirés des 8
  messages, remplacés par rien (le spinner suffit déjà).
- **Centrage GuestModeBar/MiniPlayerBar, 3 tentatives** — 1re (repères
  `max-w-5xl` différents) insuffisante ; 2e, la bonne mesure : un
  Chromium trouvé DÉJÀ EN CACHE dans le bac à sable a révélé un vrai
  bug de 46px (bouton volume/fermer non comptés dans l'équilibrage
  `flex-1`) ; 3e, un nouveau retour direct après déploiement réussi a
  révélé que `BottomBarShell.jsx` lui-même n'avait jamais de `flex` de
  base — corrigé à la racine du composant partagé, pas juste côté
  appelant.
- **Incident de livraison** (pas un bug de code) : un déploiement cassé
  par un fichier nouveau non ajouté au dépôt, puis un tableau de chemins
  de fichiers manquant dans une réponse — les deux ont coûté du temps
  réel à l'utilisateur, réglés par une règle non négociable désormais
  (nouveau/modifié + chemin exact, à CHAQUE livraison).
- **4 extractions de composants partagés** — `BottomBarShell.jsx` (le
  déclencheur), `ModalShell.jsx` (12 fichiers, littéral identique),
  `ModalCloseButton.jsx` (10 fichiers), `SelectablePill.jsx` (seul cas
  où une clarification a été demandée avant d'agir, comportement de
  sélection différent entre les 3 fichiers concernés). Plusieurs autres
  pistes cherchées et écartées, documentées pour ne pas les refaire.
- **Garde-fou automatique** (`flexDependentClassTrap.test.js`) —
  détecte une classe Tailwind flex-dépendante sans son prérequis,
  testé activement (régression simulée puis détectée) avant livraison.

### Historique détaillé (22/08 suite) — archivé dans `HISTORIQUE.md`, bloc 7

Récit chronologique complet déplacé le 22/08 (7e élagage, même jour que
la session elle-même — check-up général en 3 passes, migration recharts,
puis une longue série de corrections UI ciblées, chacune sur un retour
direct avec capture d'écran). Index :

- **Check-up général en 3 passes** ("continuer" x2) — dette de code
  morte massive retirée d'`App.jsx` et de plusieurs autres fichiers
  (destructurations de ~55 variables réduites à 5-10 réellement
  utilisées, imports morts), piège méthodologique du `grep` trompé par
  des collisions de noms avec des clés d'objets littéraux (seul ESLint,
  vraie analyse de portée, est fiable sur ce fichier) ; 3e passe avec
  `eslint-plugin-react-hooks` (jamais utilisé avant), 0 erreur
  `rules-of-hooks`, 2 vrais trous de documentation comblés dans
  `useSessionAnalysis.js`.
- **Migration recharts 2.15 → 3.10.1**, recommandée par Claude puis
  confirmée par retour direct — guide de migration lu en entier, 1 point
  de rupture corrigé préventivement (ordre Tooltip/Legend), vérification
  visuelle réelle échouée (Playwright bloqué ce jour-là, alors que
  fonctionnel la veille — liste des domaines réseau autorisés pas stable
  dans le temps, voir CLAUDE-SANDBOX-VERIFICATION.md §5quinquies).
- **Bouton "Planifier"/"Refaire"** — le texte visible d'un bouton
  ignorait une distinction déjà présente dans son propre tooltip ; audit
  des 34 tooltips conditionnels du projet, aucun autre cas trouvé.
- **Date de complétion déplacée** à gauche du compteur de clonages dans
  l'en-tête de playlist, pour gagner une ligne.
- **2 bannières raccourcies** ("Séance déjà réalisée", "Ajoute cette
  séance à Mes Playlists") — détail déplacé en infobulle, généralisation
  actée dans la Convention UI du README.
- **4 règles de design généralisées** dans la Convention UI, à la
  question directe "des règles à généraliser suite à nos ajustements ?" —
  chacune vérifiée par un audit réel du reste du projet avant d'être
  actée (34 tooltips, 16 rangées `justify-center`).
- **Sidebar — hauteur du pied de page forcée retirée** (retour direct :
  "l'accessibilité de la navigation doit être privilégiée"), PUIS un
  malentendu sur la direction du correctif clarifié ("je te demandais de
  réduire la barre du bas initialement") — `MiniPlayerBar.jsx`/
  `GuestModeBar.jsx` réduites de 90/72px à 70px en conséquence.
- **GuestModeBar — centrage asymétrique corrigé** (espaceur invisible,
  piège `justify-center` qui centre le groupe pas le contenu perçu comme
  principal).
- **StatsView — bouton "Partager mon bilan" déplacé 2 fois le même jour**
  (carte CSV abandonnée presque aussitôt au profit d'un emplacement sous
  la grille de chiffres qu'il partage réellement) — tests réécrits pour
  détecter réellement ce 2e déplacement, pas juste retouchés.

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

## Convention UI — règles génériques accumulées au fil des retours directs

Actée le 14/08 (infobulles sur icônes seules, après 2 allers-retours sur
le même motif — retour direct avec capture d'écran : "pourquoi seul le
nombre de titres a une infobulle au survol, pas le reste ?"), élargie le
22/08 après une nouvelle série d'ajustements ponctuels dont plusieurs se
sont révélés être le MÊME motif structurel répété (voir points 7-8 et les
2 nouvelles sous-sections plus bas). Règles à appliquer par réflexe dans
tout nouveau code UI, pas seulement à retrouver après coup sur retour
direct :

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
7. **Généralisé (22/08) : ne se limite plus au texte tronqué ou aux icônes
   seules — une PHRASE COMPLÈTE affichée en clair peut, elle aussi, passer
   partiellement en infobulle** si elle fait déborder son conteneur sur 2
   lignes alors qu'une version courte suffit comme accroche (ex.
   `TrackList.jsx` : "Séance déjà réalisée — plus aucun titre ne peut être
   ajouté, dupliqué, remplacé ou retiré" → "Séance déjà réalisée" affiché,
   le reste en `title=`). Découpage à faire : garder visible la partie
   ACTIONNABLE ou la plus courte à comprendre d'un coup d'œil, déplacer en
   infobulle le POURQUOI/le détail. Retour direct qui a motivé cette
   généralisation : capture d'écran d'une bannière sur 2 lignes, "garder
   que [texte court] et le reste en infobulle ?".
8. **Le texte VISIBLE d'un élément doit porter la même logique
   conditionnelle que son propre `title=` — jamais moins.** Repéré le
   22/08 (`PlaylistHeaderActions.jsx`, bouton "Planifier") : le `title=`
   distinguait déjà correctement `isLocked ? "Refaire cette séance" :
   "Planifier cette séance"`, mais le `<span>` visible ne regardait QUE
   si une date était choisie, ignorant complètement `isLocked` — un
   tooltip plus riche que le libellé affiché est le signal qu'une
   distinction déjà pensée quelque part n'a pas été répercutée partout.
   Audit fait ce jour-là sur les 34 `title={...ternaire...}` du projet à
   la recherche du même écart : aucun autre cas trouvé — mais réflexe à
   garder pour tout NOUVEAU `title=` conditionnel écrit désormais, vérifier
   que le texte/état visible suit la MÊME condition, pas une condition plus
   pauvre.

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

### Centrage flexbox d'une rangée ASYMÉTRIQUE (bouton principal + petit bouton icône seule)

Actée le 22/08, retour direct avec capture d'écran sur `GuestModeBar.jsx`
("pourquoi les 2 ne sont pas parfaitement centrés ?") — **piège CSS
structurel à connaître, pas spécifique à ce composant précis** :
`justify-center` centre le GROUPE entier de la rangée, pas le contenu
qu'on perçoit intuitivement comme "principal". Si ce groupe associe un
élément large (ex. bouton texte+icône, "Se connecter") et un élément
nettement plus étroit (ex. bouton icône seule, croix de fermeture), le
centre géométrique du groupe tombe mécaniquement DÉCALÉ vers le côté
large — l'œil perçoit alors le texte principal comme "pas centré", alors
que la rangée l'est bel et bien, au sens strict.
- **Correctif type** : ajouter un espaceur INVISIBLE (`invisible`, pas
  `hidden` — doit garder sa place dans la mise en page) de la même boîte
  exacte que le petit élément (mêmes classes de padding/taille, copiées
  plutôt que devinées en pixels), du côté opposé. Équilibre les 2 côtés
  sans dépendre d'une valeur magique à resynchroniser si l'élément change
  un jour. `aria-hidden="true"` sur cet espaceur — purement visuel, rien à
  annoncer aux lecteurs d'écran.
- **Pas un problème SI les 2 éléments flanquants sont déjà de taille
  identique** (ex. pagination `‹ Page X/Y ›` dans `PlaylistsView.jsx` —
  2 boutons flèche strictement identiques de chaque côté du texte) :
  `justify-center` centre alors correctement le texte par construction,
  aucun espaceur nécessaire. Vérifié le 22/08 sur les 16 rangées du
  projet combinant `justify-center` + 2 boutons ou plus dans le même
  conteneur : `GuestModeBar.jsx` était le seul cas réellement asymétrique
  trouvé — mais réflexe à avoir pour toute NOUVELLE rangée de ce type.

### Élément décoratif vs espace fonctionnel — la fonction prime

Retour direct du 22/08 sur `Sidebar.jsx` ("l'accessibilité de la
navigation du menu doit être privilégiée") — principe général derrière le
retrait de `creditRowHeight` (voir la section dédiée plus bas pour le
détail complet) : un ajustement purement COSMÉTIQUE (ex. aligner deux
bordures au pixel près entre 2 zones indépendantes de l'écran) ne doit
JAMAIS forcer un élément à grandir au détriment de l'espace réellement
disponible pour un contenu FONCTIONNEL (navigation, action, information
consultée activement) qui partage le même conteneur. En cas de conflit
entre les deux, la fonction gagne — quitte à accepter un léger défaut
visuel (ici, un désalignement de bordure) comme compromis assumé plutôt
que corrigé.

### Vérifier un alignement CSS par le raisonnement seul est risqué — mesurer dès que possible

Actée le 22/08, après le chantier `MiniPlayerBar.jsx`/`GuestModeBar.jsx`
(voir la section dédiée plus bas pour le détail complet) : un
raisonnement THÉORIQUE sur une question de centrage flexbox s'est révélé
FAUX deux fois de suite le même jour, avant qu'une vraie mesure (un
navigateur réel piloté par Playwright, trouvé utilisable via un binaire
déjà en cache dans le bac à sable malgré l'échec habituel du
téléchargement — voir CLAUDE-SANDBOX-VERIFICATION.md §5quinquies) ne
tranche pour de bon. Deux leçons distinctes retenues :
1. **Ne pas re-raisonner une 3e fois dans le vide après 2 échecs** —
   chercher activement un moyen de mesurer (ex. chercher un navigateur
   déjà en cache avec `find` avant de conclure à l'impossibilité) plutôt
   que de refaire le même calcul mental en espérant un résultat
   différent.
2. **Ne jamais reproduire un composant "à la main" pour le tester —
   toujours importer le vrai fichier.** Une 1re mesure basée sur une
   reproduction manuelle des 3 zones "principales" de `MiniPlayerBar.jsx`
   donnait 0px d'écart, faussement rassurant : elle avait tout simplement
   OMIS 2 éléments bien réels du fichier (bouton volume, bouton fermer)
   en les recopiant de mémoire. Une 2e mesure avec le VRAI composant
   importé directement a révélé l'écart réel (46px). Une reproduction
   manuelle ne teste que ce dont on se souvient d'un fichier, jamais ce
   qui y existe vraiment.

### Une "recette" de mise en page recopiée dans plusieurs fichiers dérive — extraire un composant partagé dès le 2e cas

Constat du 22/08 : `MiniPlayerBar.jsx` et `GuestModeBar.jsx` ont accumulé
3 bugs de désalignement DISTINCTS la même session (hauteur forcée sur la
Sidebar, centrage `GuestModeBar` vs `MiniPlayerBar`, centrage interne à
`MiniPlayerBar` lui-même) — pas 3 problèmes indépendants avec 3 causes
différentes, mais 3 symptômes de LA MÊME fragilité : les deux fichiers
recopiaient indépendamment la même "recette" de conteneur
(`h-[70px]` + `max-w-5xl mx-auto` + padding), avec de petites divergences
de détail à chaque copie (`px-4` vs `px-6`, `justify-center` présent ou
non sur le conteneur externe). Une convention maintenue par la mémoire
humaine ("se souvenir de recopier le même motif partout") dérive
inévitablement avec le temps, contrairement à une convention imposée par
la STRUCTURE du code. Extrait en composant partagé
(`BottomBarShell.jsx`, voir la section dédiée plus bas) dès ce 2e cas —
pas besoin d'attendre un 3e ou 4e fichier pour que la duplication devienne
un vrai risque : 2 fichiers qui doivent visuellement s'aligner et
partagent déjà une recette identique suffisent.

### Une classe Tailwind "dépendante" (`flex-col`/`items-*`/`justify-*`) ne fait RIEN sans sa classe "prérequise" (`flex`/`grid`) — invisible à la simple lecture

Actée le 22/08, après le VRAI bug derrière le "3e symptôme" ci-dessus
(centrage interne à `MiniPlayerBar.jsx`/`GuestModeBar.jsx`, voir la
section dédiée plus bas pour le récit complet) : 2 tentatives de
correctif basées sur un raisonnement théorique se sont révélées fausses
avant qu'une vraie mesure (Playwright) ne révèle la cause réelle —
`BottomBarShell.jsx` acceptait un `innerClassName` transmis par chaque
appelant, mais son propre template de base ne posait JAMAIS `flex` —
sans lui, `flex-col`/`items-center` transmis par un appelant n'ont
LITTÉRALEMENT AUCUN EFFET. Rien de "faux" en apparence dans le JSX
final : les classes sont bien là, juste incomplètes d'une façon qu'une
relecture de code ne révèle pas — seul un rendu réel (ou une
vérification automatisée du couplage entre classes) le révèle.

**Généralisable** : toute classe qui ne prend effet que sur un conteneur
`flex`/`grid` (`flex-col`, `flex-row`, `items-*`, `justify-*`,
`content-*`...) doit TOUJOURS être accompagnée de `flex`/`grid`/
`inline-flex`/`inline-grid` sur le MÊME élément — que ce soit dans une
chaîne de classes statique (là, une relecture attentive suffit à le
voir) OU, plus insidieux, quand une chaîne de classes est transmise à un
composant partagé via une prop de personnalisation (`innerClassName`,
`cardClassName`...) : dans ce cas, la classe prérequise peut manquer
soit côté appelant, soit côté composant receveur — le bug se cache dans
l'INTERACTION entre 2 fichiers, jamais visible en lisant l'un des deux
séparément. Garde-fou automatique ajouté
(`tests/flexDependentClassTrap.test.js`, même famille que
`tailwindConcatTrap.test.js`) : scanne toute prop `cardClassName=`
(celle qui reste réellement à risque, voir sa docstring pour pourquoi
`innerClassName` en est exclu) et vérifie qu'une classe dépendante n'y
apparaît jamais sans son prérequis.

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

## Tests

- `tests/` en miroir de `src/` (`views/`, `modals/`, `shared/`, `contexts/`, `hooks/`, `engine/`, `utils/`, `config/`, `data/`).
- 6 fichiers restés volontairement à la racine (`fileExtensionTrap.test.js`, `noDuplicateFiles.test.js`, `tailwindConcatTrap.test.js`, `testFileIdentityTrap.test.js`, `testLocationTrap.test.js`, `criticalExportsTrap.test.js` — ces 2 derniers ajoutés le 05/08, voir "État d'avancement") — des garde-fous qui scannent tout le projet via leur propre `__dirname`, les déplacer casserait leur scan. (Le compte était déjà erroné avant le 05/08 — `testFileIdentityTrap.test.js` manquait à la liste, corrigé au passage.)
- `PlaylistDetailContext.jsx` (Provider) n'a **pas** de couverture exhaustive — juste un test ciblé sur `isSaved`/`isReadOnly` (`tests/contexts/PlaylistDetailContext.test.jsx`). Le monter en entier exigerait de mocker `GeneratorContext` + `AudioPlayerContext` + le moteur de recalcul de timeline ; jugé disproportionné pour ce qui reste, à part ce point précis, de la logique triviale déjà couverte indirectement ailleurs.
- ⚠️ **Corrigé (22/08)** — cette ligne affirmait encore "aucune exécution réelle de `vitest` n'est possible dans le bac à sable" : faux depuis la découverte du 21/08 (`npm install`/un vrai serveur `vite`/Playwright/`vitest run` fonctionnent réellement, voir CLAUDE-SANDBOX-VERIFICATION.md §5ter) — `npx vitest run` tourne pour de vrai sur la suite complète à chaque session depuis, résultat cité à chaque chantier de ce README.

## À vérifier visuellement à la première occasion — risques non mesurés

⚠️ Mise à jour (22/08, plus tard la même session) — Playwright a fini
par être débloqué : le téléchargement via `npx playwright install`
reste bloqué (`cdn.playwright.dev` hors liste d'autorisation), MAIS un
binaire Chromium était déjà en cache sur le système
(`/opt/pw-browsers/chromium-1194/`, trouvé par `find / -iname
"*chromium*"`), utilisable directement via `executablePath` — voir
CLAUDE-SANDBOX-VERIFICATION.md §5quinquies pour la commande exacte. Ce
chemin n'est PAS garanti persister d'une session à l'autre (cache
d'image système, pas un acquis du projet) — à re-tester, jamais
supposer acquis.

- **`MiniPlayerBar.jsx`/`GuestModeBar.jsx` à `h-[70px]`** — ✅ CONFIRMÉ
  par mesure réelle (Playwright) : bouton play, "Se connecter" et texte
  muted tombent tous au même x, écart de 0.008px (arrondi de rendu,
  négligeable). Plus un risque.
- **Migration recharts 2→3** — toujours PAS vérifié visuellement (le
  Chromium retrouvé a servi aux bugs de centrage, pas encore réutilisé
  pour un contrôle visuel des graphiques). Build/tests réels au vert,
  mais le rendu visuel des 5 `<Pie>` et des graphiques en ligne/barres
  reste à inspecter à l'œil (2 changements visuels mineurs connus côté
  recharts : plus de bordure au clic sur les sections de pie,
  `CartesianGrid` inverse l'ordre de rendu de son fond).
- **`PlaylistCharts.jsx`, glisser-déposer sur le graphique** —
  `accessibilityLayer={false}` ajouté par prudence sur ce graphique
  précis, jamais testé contre cette interaction maison en conditions
  réelles (nécessiterait de simuler un vrai glisser-déposer souris, pas
  fait lors des mesures de centrage).

**Cas limite connu, non traité** (`PlaylistHeaderBadges.jsx`) : le badge
"Lecture seule" (`isReadOnly`) et le badge "séance déjà réalisée"
(`isLocked`) sont conceptuellement indépendants et pourraient en théorie
apparaître ensemble (playlist publique déjà complétée par son
propriétaire) — 2 icônes Lock à la suite dans la même rangée. Jamais
rencontré dans les retours reçus jusqu'ici.

Récit complet de la session qui a produit tout ça (check-up en 3 passes,
migration recharts, corrections UI ciblées, cloneCount x4, centrage
GuestModeBar/MiniPlayerBar x3, 4 refactors de composants partagés,
garde-fou automatique) : voir `HISTORIQUE.md`, blocs 7 et 8.

## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — outils de vérification de code pour une session Claude sans accès réseau.
- `DEEZER-CONNECT-REMOVED.md` — historique d'une intégration retirée.
- `supabase-schema.sql` — rejouable en entier sans risque (`drop if exists` systématique avant chaque `create`).
