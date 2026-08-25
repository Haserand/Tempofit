### Historique détaillé (21-22/08) — voir l'index `HISTORIQUE.md` → bloc 6

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


### Historique détaillé (19-20/08) — voir l'index `HISTORIQUE.md` → bloc 5

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
