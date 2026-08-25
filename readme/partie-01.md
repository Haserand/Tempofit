# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ À LIRE avant de retoucher le code (Claude ou humain)

Ce fichier n'est **pas** un document de passation — les passations (narratives, une par session, jetables une fois lues) documentent *ce qui a été fait et pourquoi, pendant une session donnée*. Ce README documente *l'état actuel*, en continu. Il doit rester vrai en permanence, pas seulement au moment où il a été écrit.

**Règle pour toute session qui termine avec un changement d'architecture durable** (une nouvelle table, une nouvelle contrainte, une décision "pourquoi X plutôt que Y" qui sera utile à quelqu'un dans 3 mois) : la mise à jour va **ici**, pas seulement dans la passation de fin de session. Une passation qui décrit une décision d'architecture sans que ce fichier en parle est une passation incomplète.

Objectif explicite : rester **court et pointer vers le code** plutôt que de le paraphraser en détail — moins de texte dupliqué entre ce fichier et les commentaires du code source, moins de risque que les deux divergent avec le temps (voir `CLAUDE-SANDBOX-VERIFICATION.md` pour un exemple concret de commentaire devenu faux, trouvé et corrigé le 02/08).

**Convention de taille de fichier (22/08)** : tout fichier de documentation
créé sur ce projet (README, historique, passation...) doit rester lisible
EN ENTIER par Claude en un seul appel de son outil de lecture — celui-ci
tronque silencieusement (sans erreur, juste en montrant début+fin) tout
fichier dépassant ~16 000 caractères lu sans plage de lignes précisée.
Cible interne : ~12 000 caractères par fichier, marge de sécurité
incluse. `HISTORIQUE.md` a dû être restructuré en plusieurs fichiers
(`historique/bloc-NNx.md`) pour cette raison précise le 22/08 — voir ce
fichier pour le détail complet et la convention à suivre pour tout futur
bloc.

✅ **Corrigé le 25/08** : `README.md` (~57 000 caractères) et
`CLAUDE-SANDBOX-VERIFICATION.md` (~66 000 caractères) dépassaient
LARGEMENT ce même seuil — jamais remarqué avant car ces 2 fichiers sont
presque toujours lus par section ciblée (recherche de mot-clé, plage de
lignes), jamais d'un coup. Volontairement PAS restructurés le 22/08
(risque de casser le flux de travail d'une session déjà très longue sans
bénéfice immédiat) — traité au tout début de la session suivante, à tête
reposée, avec la même méthode que celle qui a fonctionné sur
`HISTORIQUE.md` (découpage par unité logique — sections `##`/`###`
existantes plutôt que des paragraphes — puis vérification bit à bit que
rien n'est perdu). `README.md` est désormais lui-même un INDEX, son
contenu réel vit dans `readme/partie-0N.md` — voir tout en tête de ce
fichier pour l'index détaillé. Même chose pour `CLAUDE-SANDBOX-
VERIFICATION.md`, restructuré en `claude-sandbox-verification/partie-
0N.md`.

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
bas pour les risques encore non mesurés, et l'index `HISTORIQUE.md` → blocs 7-8
pour le récit complet.

### Historique détaillé (22/08, suite du bloc 7) — voir l'index `HISTORIQUE.md` → bloc 8

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

### Historique détaillé (22/08 suite) — voir l'index `HISTORIQUE.md` → bloc 7

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
