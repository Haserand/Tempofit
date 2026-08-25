# TempoFit — Historique détaillé, bloc 6 (21-22/08, découpage App.jsx, TabPills, Sidebar/Mode Intime, découverte Playwright/vitest, corrections visuelles)

⚠️ Copie exacte de la section "État d'avancement" du README au moment de
l'élagage du 22/08 (session exceptionnellement longue et dense — reprise
du découpage `App.jsx`, standardisation des onglets, plusieurs passes sur
la Sidebar, et surtout la découverte que le bac à sable Claude a en
réalité accès à `npm install`/un vrai serveur `vite`/Playwright/`vitest
run`, jamais vérifié depuis la création de ce projet). Aucun contenu
réécrit ni résumé au-delà de cette copie d'ouverture.

### 21/08 — check-up initial, sans chantier précis en tête

Check-up demandé en début de session ("vois-tu des choses à corriger ou
optimiser ?"). Un bug réel trouvé et corrigé : `ImportSharedPlaylistModal.jsx`
avait survécu au renommage "séance"→"playlist" du 20/08 sur UNE phrase
("tu peux l'ajouter à tes propres Séances" — nom propre de destination,
resté en l'état alors que le bouton juste en dessous disait déjà "Ajouter
à Mes Playlists"). Corrigé, grep multi-sous-chaînes pour confirmer
l'absence d'autre copie. 2 vrais trous de couverture de test comblés
(`TrophiesView.jsx`/`MiniPlayerBar.jsx`, 0 test avant malgré une logique
non triviale — masquage des trophées secrets, mute-par-clic avec mémoire
du niveau précédent).

### 21/08 — Découpage `App.jsx` repris et CONCLU (3 extractions : StatsView, Image de partage, rendu du bandeau Génération)

**Repoussé volontairement le 08/08** (retour direct) — voir le découpage
déjà fait de `PlaylistHeader.jsx` (836 → 254 lignes, même famille de
chantier) pour le précédent. Raison du report à l'époque : refonte
intégrale du menu de navigation + nouvelles fonctionnalités prévues dans
les prochains jours — découper avant aurait obligé à deviner des
frontières qui allaient de toute façon bouger. Approche retenue en
attendant : écrire toute nouvelle fonctionnalité directement dans son
PROPRE hook/context dédié plutôt que comme un `useState` de plus dans
`AppContent` — le découpage se fait ainsi organiquement, au fil de l'eau
(voir tous les `Context.jsx` déjà extraits : `GeneratorContext`/
`AthleticContext`/`AudioPlayerContext`/`CustomActivityContext`/
`ModalContext`/`PlaylistDetailContext`/`PlaylistEditContext`).

**Repris le 20/08** — "les modifs de navigation auxquelles je pensais"
jugées faites. Avant d'agir : inventaire complet des `useState` restants
dans `AppContent` (28 → 22 après ce 1er lot), classés par cluster, plutôt
que de redécouper au hasard.

**1er lot fait (20/08) : cluster StatsView** (6 `useState` rapatriés —
`showAdvancedStats`/`statsMode`/`selectedStatsGenre`/
`selectedStatsBpmBucket`/`expandedDetailGenre`/`expandedDetailArtist`).
Vivaient dans `AppContent` pour une raison devenue **obsolète** : à
l'époque, `StatsView` était rendue en IIFE directement dans le JSX
d'`AppContent` (`view === 'stats' && (() => {...})()`), un `useState`
local aurait violé les règles des Hooks. Depuis l'extraction de
`StatsView.jsx` en vrai composant séparé, cette contrainte ne s'applique
plus. Vérifié AVANT de bouger quoi que ce soit : tous les 6 n'étaient
utilisés QUE comme props de `<StatsView/>`, nulle part ailleurs dans
`App.jsx` — extraction sûre en `useState` local. **Changement de
comportement assumé, pas caché** : ce state ne persiste plus en naviguant
hors de "Mes Statistiques" puis en y revenant (ex. un genre déplié dans
la vue détaillée se replie) — aucun commentaire n'affirmait cette
persistance volontaire, simple effet de bord de la contrainte technique
ci-dessus, jamais corrigé après coup. Tests : 2 tests qui pilotaient
`statsMode` DIRECTEMENT par prop réécrits pour piloter `isNaughtyMode` à
la place (la vraie prop restante, qui déclenche l'effet interne de
synchronisation).

**2e lot fait (21/08) : cluster "Image de partage"** (4 `useState` →
`ShareImageContext.jsx`, nouveau). Confirmé génuinement partagé entre
`PlaylistDetailView.jsx` (génère l'image en arrière-plan) et
`ShareModal.jsx` (l'affiche/laisse la retirer) — extrait en un vrai
Contexte dédié plutôt qu'une redescente. `summaryImageStatus`/
`summaryImageFile`/`summaryImagePreviewUrl`/`includeSummaryImage` + leurs
4 setters ne sont plus prop-drillés (2 niveaux vers
`PlaylistDetailViewInner`, 1 niveau vers `ShareModal`) — les deux
composants appellent maintenant `useShareImage()` directement. Toute la
LOGIQUE (génération, protection contre un changement de playlist en
cours de route via `currentPlaylistIdRef`, reset au changement de
playlist) reste entièrement dans `PlaylistDetailView.jsx`, inchangée —
ce Contexte ne fait qu'exposer le state. `value` mémoïsée (`useMemo`),
même convention que les autres Contexts depuis le correctif AuthContext
du 19/08.

**3e lot fait (21/08) : rendu du bandeau "Génération en cours" extrait**
— `GenerationProgressBanner.jsx` (nouveau) : le JSX du bandeau flottant +
`getGenerationBannerMessage` (message à 3 paliers de temps, 14/08)
déplacés tels quels depuis `App.jsx`, en composant présentationnel
recevant tout en props. ⚠️ **PAS un Contexte** — les 6 `useState`
sous-jacents (`isGenerating`/`generatingTotal`/`generatingDone`/
`isGeneratingSlowGenre`/`isGeneratingLongPlaylist`/
`generatingEstimatedTracksFound`) restent dans `AppContent`, pour la même
raison que "Navigation" ci-dessous : leurs setters sont des arguments
directs de `usePlaylistGeneration(...)`, un hook appelé avant le `return`
d'`AppContent` — extraire le JSX seul, sans toucher au state, contourne
cette contrainte. 1er fichier de test pour ce bandeau (12 tests) — 0
couverture avant (JSX inline dans `App.jsx`, lui-même sans test miroir).

**Cluster "Navigation" AUDITÉ le 21/08, PAS extrait** (`view`/
`viewingProfileUsername`/`isMobileMenuOpen`/`isUserMenuOpen`/
`settingsInitialTab`/`playlistsInitialTab`/`isScrolled`/
`isGuestBarDismissed`, 8 `useState`) — contrairement à ce que l'inventaire
initial du 20/08 laissait penser ("également partagé", une supposition,
pas un audit réel) : **3 des 8 ne sont PAS partagés du tout**
(`isUserMenuOpen`/`isScrolled`/`isGuestBarDismissed`, entièrement locaux
à `AppContent`) — un Contexte n'aurait donné AUCUN bénéfice sur ces 3-là.
Les 5 restants sont bien partagés avec 1 enfant chacun, mais **aucun ne
vaut le coup d'extraire en Contexte**, pour 2 raisons distinctes et
vérifiées : (1) `view`/`isMobileMenuOpen` sont bloqués par une vraie
contrainte d'ordre entre hooks (`openCuratedPlaylist`/`changeView`
passés en ARGUMENT DIRECT à `usePlaylistLibrary`/`usePlaylistGeneration`,
appelés plus bas dans `AppContent` — `useNavigation()` ne peut donc pas
être déplacé dans un Provider sans casser cet ordre) ; (2)
`viewingProfileUsername`/`settingsInitialTab`/`playlistsInitialTab` n'ont
pas ce blocage mais ne sont transmis qu'à UN SEUL enfant à UN SEUL
niveau — un Contexte n'aurait rien à simplifier.

⚠️ **`isScrolled` — trouvé "cassé" en cours d'audit, PUIS RETIRÉ le jour
même, pas juste réparé** : `setIsScrolled` n'était appelé NULLE PART dans
tout le projet, ce header flottant desktop (opacité conditionnelle au
scroll) ne pouvait donc jamais apparaître, resté à `false` depuis sa
création. 1er réflexe : combler le trou, listener de scroll ajouté. Une
fois VRAIMENT visible pour la première fois (retour direct, capture
d'écran), 2 problèmes de fond sont apparus qu'aucun audit de code seul
n'aurait révélés : (1) son seul commentaire d'origine dit lui-même qu'il
"dupliquait le comportement du logo Sidebar" — logo qui, sur desktop, est
déjà TOUJOURS visible (sidebar fixe, ne scrolle jamais) ; (2) son
sous-titre (`displaySubtitleGen`) est câblé en dur sur le tagline du
GÉNÉRATEUR, jamais contextuel à la vue réellement affichée. Retiré
intégralement (JSX + `isScrolled`/`mainScrollRef`/le listener +
`displaySubtitleGen` de la déstructuration d'`AppContent`). Le vrai
enseignement : un `useState` "cassé" trouvé en audit n'est pas
automatiquement un bug à réparer — vérifier D'ABORD si la fonctionnalité
qu'il pilote a encore sa place, avant d'investir dans sa remise en marche.

**Conclusion de ce chantier** : le cluster StatsView était
vraisemblablement LE candidat "dette oubliée, extraction sûre" disponible
dans ce fichier. Des 2 autres clusters identifiés au départ, "Image de
partage" s'est avéré un vrai candidat à un Contexte et a été extrait ;
"Génération" avait la MÊME contrainte d'ordre entre hooks que
"Navigation" — pas de Contexte possible pour son state, mais son JSX a
quand même pu être extrait en composant présentationnel, sans toucher à
cette contrainte ; "Navigation", une fois vérifié en détail plutôt que
supposé, s'avère volontairement NON déplaçable pour la moitié de son
périmètre (même contrainte d'ordre) et sans bénéfice réel pour l'autre
moitié (déjà de simples props à 1 niveau) — laissé tel quel. Ce chantier
se conclut ici avec 3 extractions réelles sur 3 clusters envisagés (2 en
Contexte, 1 en simple composant de rendu) — chaque décision (extraire,
extraire partiellement, ou laisser tel quel) vérifiée au cas par cas
plutôt que supposée.

### 21/08 — Bio du profil vitrine, 3 essais avant la bonne version

Retour direct : ajouter un texte expliquant que `@tempofit_officiel` est
un compte de démonstration. 3 essais successifs, chacun rejeté pour une
raison précise avant d'arriver à la bonne version :
1. Bandeau séparé façon alerte (même style que "Aperçu de ton profil") —
   rejeté : "pas du tout, je pensais un encart façon bio".
2. Ligne repliée DANS la carte d'en-tête mais encore traitée comme une
   notice système (icône, texte `textMuted`, séparateur `border-t`) —
   rejeté : toujours pas le ton "bio" voulu.
3. **Version retenue** : texte en `textHighlight` (blanc en mode sombre,
   vérifié dans `index.css`), sans icône ni séparateur, sous-titre changé
   en "Compte vitrine TempoFit". Comportement ensuite aligné sur le
   pattern déjà en place pour la description de playlist
   (`whitespace-pre-line line-clamp-3` + `title=` tooltip), PAS la couleur
   (`textHighlight` gardé, pas le `text-slate-300` codé en dur de
   l'original — verdict explicite de l'utilisateur avant de coder : "aligne
   les 2, ça me semble plus pertinent, toi aussi ?"). Texte lui-même
   raccourci une dernière fois (retrait de la répétition "Compte vitrine
   officiel de TempoFit —", déjà dite par le sous-titre juste au-dessus).
   **Décision actée pour plus tard** : cette carte sert de banc d'essai
   volontaire pour une future vraie bio éditable par tous les
   utilisateurs — documenté en tant que tel dans une nouvelle section
   README dédiée ("Décidé mais pas encore construit").

### 21/08 — `TabPills.jsx` : standardisation des onglets (5 vues)

Retour direct : "pourquoi c'est pas le même modèle pour Routines et pour
Réglages ?" — `SettingsView.jsx` avait dérivé vers un style soulignement
pendant ~3 semaines sans que personne ne s'en aperçoive. En creusant pour
répondre à "ça vaut le coup de standardiser ?" (réponse : oui), 2e dérive
trouvée : `TrophiesView.jsx` avait SON PROPRE style ("contrôle segmenté",
fond+ombre), différent du style plat déjà majoritaire ailleurs (4 vues
contre 1). Composant `TabPills.jsx` extrait (contrôlé, aucun state
interne, `label` accepte un `ReactNode` pour couvrir compteurs/icônes sans
props dédiées) et les 5 vues migrées dessus
(`PlaylistsView`/`ProfileView`/`DiscoverView`/`SettingsView`/
`TrophiesView`) — `TrophiesView.jsx` perd son fond/ombre au profit de la
cohérence, changement visuel assumé. 1er fichier de test pour ce
composant.

### 21/08 — Sidebar : "Découvrir" isolé, puis Mode Intime resserré en 3 passes

- **"Découvrir" déplacé hors de "Création"** — ce n'est ni créer pour soi
  ni consulter ce qui est à soi, une 3e intention distincte. D'abord avec
  un titre de section "Découverte" — retiré le jour même (retour direct :
  un en-tête pour un seul lien au nom quasi-identique ne groupait rien,
  contrairement à "Création"/"Mon Espace" qui groupent chacun 2 liens
  distincts). Titre cliquable envisagé puis écarté (aurait cassé la
  convention "titres jamais interactifs" du reste de la Sidebar).
- **Espacement Mode Intime resserré en 3 passes successives**, toutes sur
  les 5 mêmes écarts marqués par capture annotée : -2px, encore -2px, puis
  -3px (total -25px cumulé). Chaque passe a dû trouver un nouveau levier
  une fois le précédent épuisé (padding du bouton "Quitter le Mode
  Intime" → `scrollPadding` compact jamais touché avant → séparateurs
  compacts créés pour la 1re fois). Un levier explicitement REFUSÉ malgré
  la tentation : `SIDEBAR_LINK_PADDING_COMPACT`/`SIDEBAR_LINK_GAP_COMPACT`,
  déjà testés plus serrés le 29/07 et explicitement rejetés à l'époque
  ("trop agressif, tasse trop la navigation") — signalé à l'utilisateur
  plutôt que retouché sans consultation.

### 21/08 — Découverte majeure : `npm install`/`vite`/Playwright/`vitest run` fonctionnent réellement en sandbox
