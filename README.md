# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

## 🚧 État d'avancement — à mettre à jour à CHAQUE début/fin de chantier

Rien en cours actuellement — session très longue (22/08, suite directe de
celle du 21-22/08 qui avait déjà motivé un élagage, bloc 6), tous les
chantiers fermés et vérifiés : check-up général en 3 passes (dette de
code morte retirée, `eslint-plugin-react-hooks` utilisé pour la 1re fois
sur ce projet), migration recharts 2→3, puis une série de corrections UI
ciblées sur retours directs successifs (bouton Planifier/Refaire, date de
complétion déplacée, bannières raccourcies, hauteur du pied de page
Sidebar retirée puis les 2 barres du bas réduites en conséquence,
centrage GuestModeBar, bouton "Partager mon bilan" repositionné). Voir
"À vérifier visuellement" plus bas pour les quelques risques non mesurés
faute de navigateur cette session (Playwright bloqué), et
`HISTORIQUE.md` bloc 7 pour le récit complet.

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

## À vérifier visuellement à la première occasion — risques non mesurés faute de navigateur (22/08)

Playwright reste bloqué en sandbox depuis le 22/08
(`cdn.playwright.dev` hors liste d'autorisation réseau, voir
CLAUDE-SANDBOX-VERIFICATION.md §5quinquies) — plusieurs changements de
cette même session reposent donc sur un calcul à la main plutôt qu'une
vraie mesure, à confirmer dès qu'un navigateur redevient disponible :

- **`MiniPlayerBar.jsx`/`GuestModeBar.jsx` à `h-[70px]`** — calculé pour
  correspondre à la hauteur naturelle du pied de page de `Sidebar.jsx`
  (bordure + padding + ligne Réglages/Trophées + ligne de crédit), jamais
  mesuré en conditions réelles. Un écart de quelques pixels reste
  possible (métriques de police exactes, arrondis de rendu).
- **Migration recharts 2→3** — build/tests réels au vert, mais le rendu
  visuel des 5 `<Pie>` et des graphiques en ligne/barres n'a jamais été
  inspecté à l'œil (2 changements visuels mineurs connus côté recharts :
  plus de bordure au clic sur les sections de pie, `CartesianGrid`
  inverse l'ordre de rendu de son fond).
- **`PlaylistCharts.jsx`, glisser-déposer sur le graphique** —
  `accessibilityLayer={false}` ajouté par prudence sur ce graphique
  précis (nouveau défaut `true` en v3 côté recharts, jamais testé contre
  cette interaction maison faute d'interaction possible en sandbox).

**Cas limite connu, non traité** (`PlaylistHeaderBadges.jsx`) : le badge
"Lecture seule" (`isReadOnly`) et le badge "séance déjà réalisée"
(`isLocked`) sont conceptuellement indépendants et pourraient en théorie
apparaître ensemble (playlist publique déjà complétée par son
propriétaire) — 2 icônes Lock à la suite dans la même rangée. Jamais
rencontré dans les retours reçus jusqu'ici.

Récit complet de la session qui a produit tout ça (check-up en 3 passes,
migration recharts, corrections UI ciblées) : voir `HISTORIQUE.md`,
bloc 7.

## Génération simple d'une playlist — sauvegarde désormais automatique dans "Mes Playlists" (22/08)

Question directe, "prends du recul" : "est-ce que par défaut les
playlists que je génère ne devraient pas être enregistrées dans 'mes
playlists' sans avoir besoin de l'ajouter manuellement ?".

**1re réponse (avant vérification) : plutôt non** — l'argument avancé
était que le générateur sert à l'exploration (régénérer plusieurs fois
avant de trouver la bonne version), et qu'auto-sauvegarder polluerait
"Mes Playlists" de brouillons jetables.

**Argument renversé par un retour direct suivant, qui a motivé une
vraie vérification** : "je me dis que si je génère UNE playlist, elle
est ajoutée à mes playlists, surtout si dans tous les cas je dois
l'ajouter pour pouvoir la modifier". Vérifié dans le code
(`TrackList.jsx`/`TrackItem.jsx`) : **confirmé, aucune mutation d'un
titre (remplacer/dupliquer/retirer) n'est possible tant que la playlist
n'est pas sauvegardée** — le commentaire du code le dit explicitement
("la mutation ne serait de toute façon pas persistée"). Il n'y avait
donc PAS de vraie exploration possible sur une playlist déjà générée,
seulement la regénérer entièrement depuis le wizard — l'argument initial
ne tenait pas à l'examen.

**Corrigé** (`usePlaylistGeneration.js`, branche `count === 1`) : appelle
désormais `setSavedPlaylists` en plus de `setCurrentPlaylist`, exactement
comme le fait déjà la branche `count > 1` (génération en lot depuis une
routine) depuis toujours — une incohérence pré-existante dans le code
que cette question a fait remonter, jamais questionnée jusqu'ici. Le
bouton "Ajouter" (`PlaylistHeaderActions.jsx`) disparaît naturellement
pour ce cas (`isSaved` devient vrai dès la génération, aucun changement
nécessaire dans ce fichier) — il reste nécessaire et inchangé pour les
autres cas où une playlist affichée n'est pas encore sauvegardée (ex. un
template ouvert directement depuis Découvrir).

Garde-fou existant (`hasUnsavedPlaylist`, `useNavigation.js` — modale de
confirmation + avertissement natif du navigateur à la fermeture d'onglet)
**pas retiré, son périmètre est simplement réduit** : une génération
simple n'est plus jamais dans cet état, mais un template ouvert depuis
Découvrir l'est toujours. Commentaire mis à jour pour refléter ce
périmètre plus étroit.

2 tests ajoutés (`usePlaylistGeneration.test.js`) : `setSavedPlaylists`
bien appelé pour `count=1` avec la playlist générée + les playlists
existantes préservées ; même protection contre un changement concurrent
(`savedPlaylistsRef.current`, pas le tableau figé au début) déjà
vérifiée pour le lot, maintenant aussi pour la génération simple.

## Clonage d'une playlist étrangère — la copie héritait à tort du compteur de clonages du parent (22/08)

Retour direct, capture d'écran à l'appui : "logiquement la playlist que
j'ai créée, elle, ne devrait pas avoir ce 1 tant qu'elle n'a pas été
clonée à son tour, non ?" — une playlist étrangère fraîchement clonée
depuis Découvrir affichait le badge de clonages du PARENT ("⧉ 1") sur la
copie elle-même, qui n'a par définition encore jamais été clonée par
personne.

**Ce correctif en annule un autre, lui-même déjà un revirement** —
généalogie complète, pour ne pas revenir en arrière une 3e fois sans
comprendre pourquoi : `cloneCount` réinitialisé une 1re fois le 07/08,
ce retrait généralisé à tort à un 2e chemin de sauvegarde le 10/08
(retour direct, 4 captures — "il n'y a plus le compteur de clones ?"),
cette généralisation elle-même corrigée aujourd'hui. La cause de
l'erreur du 10/08 : `usePlaylistLibrary.js` a 2 chemins de sauvegarde
distincts, traités à tort comme équivalents sur ce point précis —
`handleSavePlaylist` (template ouvert depuis Découvrir, garde le MÊME
`id`) où `cloneCount` n'est quasiment jamais réellement défini au départ
(le compteur d'un template vit dans une table séparée,
`template_clone_counts`), et `handleClonePlaylist` (playlist étrangère
RÉELLE, NOUVEL `id` généré) où `cloneCount` PEUT réellement porter la
vraie valeur du parent (`row.clone_count` depuis Supabase). Le retrait
du 10/08 ne changeait donc rien d'observable sur le 1er chemin (déjà
`undefined` avant et après), mais laissait le 2e chemin propager à tort
le compteur du parent sur une copie flambant neuve — jamais remarqué
jusqu'à cette capture.

**Corrigé** : `cloneCount: undefined` explicitement posé sur l'objet
`cloned` dans `handleClonePlaylist` (`usePlaylistLibrary.js`) —
`handleSavePlaylist` n'est pas concerné, pas retouché. `undefined`
plutôt que `0` : cohérent avec le garde-fou déjà en place
(`PlaylistHeaderBadges.jsx`, badge gaté sur `cloneCount !== undefined`)
— aucun badge sur une copie jamais clonée, plutôt qu'un badge à 0 qui
laisserait croire que le compteur a un sens avant la 1re vraie
occurrence. `removeSavedPlaylist` (restauration de la prévisualisation
du template original après retrait) vérifié à part et laissé inchangé —
scénario différent (revenir à l'aperçu du template, pas créer une
nouvelle copie), où afficher le vrai compteur du template reste
légitime.

2 tests mis à jour dans `usePlaylistLibrary.test.js` (remplacent les 2
tests du 10/08 qui vérifiaient le comportement inverse) : la copie
clonée réinitialise `cloneCount` quelle que soit la valeur du parent ;
un `cloneCount` déjà `undefined` sur le parent reste `undefined` sur la
copie (cas déjà couvert, comportement inchangé).

## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — outils de vérification de code pour une session Claude sans accès réseau.
- `DEEZER-CONNECT-REMOVED.md` — historique d'une intégration retirée.
- `supabase-schema.sql` — rejouable en entier sans risque (`drop if exists` systématique avant chaque `create`).
