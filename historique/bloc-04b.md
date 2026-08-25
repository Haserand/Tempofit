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
