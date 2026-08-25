# TempoFit — Historique détaillé des chantiers (02/08 → 05/08)

⚠️ Ce fichier est un **complément d'archive** au README.md, pas un
document autonome. Il contient le récit chronologique COMPLET des
chantiers antérieurs au 07/08, extrait tel quel de la section "État
d'avancement" du README (aucun contenu réécrit ni résumé — copie exacte)
au moment de l'élagage du 08/08, quand cette section a dépassé 1100
lignes et rendait la lecture d'entrée de session trop lente.

**Pourquoi ce découpage plutôt que de tout garder dans le README** :
le README documente l'état ACTUEL du projet, pas son histoire complète —
voir sa propre règle en tête ("rester court et pointer vers le code").
Le récit détaillé (qui a demandé quoi, pourquoi telle option a été
retenue plutôt qu'une autre, quels incidents de build ont eu lieu et
comment ils ont été diagnostiqués) garde une vraie valeur — c'est
souvent la SEULE trace du "pourquoi" derrière une décision qu'on
retrouve dans le code des mois plus tard — mais n'a plus besoin d'être
relu à CHAQUE début de session, seulement quand une question précise
s'y prête (voir l'index dans le README, section "Historique").

**Ce fichier n'est PAS mis à jour en continu** — contrairement au
README, il n'y a rien à "tenir à jour" ici : c'est une photographie
figée d'une période close (02/08 → 05/08). Le prochain élagage (si la
section "État d'avancement" du README regrossit trop) ajoutera un bloc
suivant à LA SUITE de celui-ci, jamais en réécrivant ce qui y est déjà.

---

⚠️ **SESSION DU 05/08 — check-up demandé en début de conversation (lecture
PASSATION.md → README.md → CLAUDE-SANDBOX-VERIFICATION.md → code réel),
2 bugs réels trouvés et corrigés, 1 optimisation perf :**

- **Le fix `min-w-0` (04/08, `PlaylistHeader.jsx`/`RoutinesView.jsx`),
  resté "jamais vérifié en conditions réelles"** — relu en détail : la
  structure flex est correcte des deux côtés (`flex-1 min-w-0` sur le `<p>`,
  conteneur parent qui laisse la place). Sain par lecture de code, mais
  reste à confirmer par un vrai clic en prod comme toujours pour du CSS.
- **BUG CORRIGÉ — `tests/modals/EditRoutineModal.test.jsx` ne s'exécutait
  JAMAIS.** Le fichier vivait dans `src/components/modals/` au lieu de
  `tests/modals/` (viole la convention "tests/ miroir de src/") — invisible
  du build Vercel réel (`vite.config.js`, `test.include:
  ['tests/**/*.test.{js,jsx}']` ne scanne jamais `src/`), ET son import
  relatif (écrit pour l'emplacement `tests/modals/`) était cassé depuis
  l'ancien emplacement. Toute la couverture du chantier "cible à 0" du
  04/08 tournait donc dans le vide depuis sa création. Déplacé au bon
  endroit. Aucun des 3 garde-fous existants (`noDuplicateFiles.test.js`,
  `testFileIdentityTrap.test.js`, `fileExtensionTrap.test.js`) ne
  détecte ce cas précis (ils ne scannent que `tests/`) — angle mort
  accepté pour l'instant, pas traité cette session (aurait été un chantier
  à part, hors scope d'un check-up).
- **BUG CORRIGÉ — `EditRoutineModal.jsx` avait le MÊME trou de validation
  "cible à 0" que celui fermé le 04/08, sur un point d'entrée oublié.**
  Cette modale appelle `executeGeneration` directement
  (`applyRoutineEditOnce`/`applyRoutineEditPermanently`,
  `useRoutineActions.js`) — un point d'entrée de la même famille que le
  bouton "Générer" de `RoutinesView.jsx` (déjà audité le 04/08), mais elle
  ne validait que `distanceVal`/`hours`/`minutes`, jamais `segments`. Pour
  le mode Fractionné pur (`isIntervalMode && !isCrescendoMode`), c'est
  pourtant `segments[]` qui pilote réellement la durée générée (voir
  `usePlaylistGeneration.js`, `executeGeneration` — la branche
  `config.isIntervalMode` ignore `distanceVal`/`hours`/`minutes`). Une
  routine Fractionné aux portions cassées (créée avant le correctif du
  04/08) pouvait donc être éditée/régénérée depuis cette modale sans le
  moindre blocage. Corrigé : `isTargetInvalid` bascule sur
  `areSegmentsValid()` en Fractionné pur (le Crescendo n'est pas concerné,
  ses segments sont recalculés en direct depuis la cible globale — voir
  l'effet dédié dans `App.jsx`) ; le champ distance/durée global, sans
  effet dans ce mode, est désormais masqué (même condition que
  `step3ShowsTargetInputs`, `GeneratorWizard.jsx`) ; message d'erreur
  aligné sur la formulation de `RoutinesView.jsx`. Tests de régression
  ajoutés dans le fichier déplacé ci-dessus. Audit complémentaire fait sur
  les 4 points d'entrée réels de `executeGeneration` (`RoutinesView.jsx`,
  `GeneratorWizard.jsx`, `useRoutineActions.js` ×2) — le bouton final du
  wizard est protégé transitivement par le verrouillage du "Suivant" à
  l'étape 3 (aucune navigation ne permet d'atteindre l'étape 4 avec une
  cible/des segments invalides), pas de 5e trou trouvé.
- **Optimisation perf — `RoutinesView.jsx`, tri des routines.** Les 2 tris
  (`sortedRoutines`/rang par générations) tournaient sur CHAQUE rendu du
  composant, y compris un rendu déclenché par une frappe dans le brouillon
  de description (state local à ce même composant, sans rapport avec
  `routines`) — enveloppés dans `useMemo([routines])`. `routineRanks
  .indexOf(routine.id)` (O(n) par carte dans la boucle `.map()`, donc O(n²)
  sur toute la grille) remplacé par une `Map` id→rang (O(1) par carte).
  Sans impact perceptible au nombre de routines réaliste pour un compte,
  mais correct par principe et cohérent avec les 3 optimisations perf déjà
  faites le 03/08 (voir plus bas).

⚠️ **SESSION DU 05/08 (suite 12) — build Vercel cassé (1 test), corrigé.**
Mon propre test ajouté au tour précédent (`ProfileView.test.jsx`, "un
template jamais cloné... affiche bien 0") utilisait `getByTitle(...)` —
un seul élément attendu. Une fois le badge de clonages passé en "toujours
affiché, même à 0" (même chantier), la grille de la vitrine (35+ cartes)
en affiche désormais AUTANT avec ce même `title`, donc `getByTitle`
échouait ("Found multiple elements"). Corrigé : recherche depuis le titre
de la carte concernée puis `.closest('.shadow-xs')` (classe unique à
`PublicItemCard`, vérifiée) pour cibler précisément SA carte, plutôt
qu'une recherche globale sur toute la page. `within` importé (manquant).
Reste de la suite déjà vert à ce moment-là (1038/1039) — un seul test à
corriger.

⚠️ **SESSION DU 05/08 (suite 11) — retour direct : "je ne vois pas le
nombre de clones dans une playlist... il me semble que c'est la demande de
base".** Le compteur de clonages existait déjà (vraie table
`template_clone_counts`, chantier des sessions précédentes) mais
s'arrêtait aux CARTES de listing (`TemplateCard.jsx`/`ProfileView.jsx`) —
jamais transmis à la page détail (`PlaylistHeader.jsx`), qui n'avait donc
littéralement aucun moyen de l'afficher. Corrigé, 2 décisions actées
avant implémentation :
- **Toujours afficher, même à 0** (confirmé) — incohérence repérée entre
  les 2 endroits existants (`TemplateCard.jsx` montrait 0, `ProfileView.jsx`
  le cachait) et harmonisée dans ce sens.
- **Près du titre, pas dans la ligne d'infos** (confirmé) — même logique
  déjà appliquée au badge BPM (sorti à part) : la ligne d'infos décrit la
  COMPOSITION de la séance, le compteur de clonages décrit son ACCUEIL
  social, catégories différentes.
Câblage : `TemplateCard.jsx` transmet désormais `cloneCount` (déjà reçu en
prop) à `onPlayTemplate` ; `App.jsx` (`handleOpenPublicPlaylist`) lit
`row.clone_count` (vraie colonne déjà là pour une playlist étrangère réelle
ET pour un template de la vitrine, `templateToVitrineRow`,
officialVitrineProfile.js) et le reporte sur `currentPlaylist.cloneCount`.
Badge gaté sur `isReadOnly` (seul contexte où l'info a un sens — jamais
câblé pour une playlist déjà sauvegardée ou une génération fraîche, hors
périmètre de ce retour direct). 7 tests mis à jour/ajoutés au total
(`TemplateCard.test.jsx` ×3, `DiscoverView.test.jsx` ×1,
`ProfileView.test.jsx` ×2, `PlaylistHeader.test.jsx` ×3 nouveaux).

⚠️ **SESSION DU 05/08 (suite 10) — retour direct, capture montrant l'espace
vide sous la pochette : "je suis en mode invité, par défaut mets 'Guest
Mode' plutôt que rien".** BUG CORRIGÉ dans `ownerLabel`
(`PlaylistHeader.jsx`) — en mode invité, `username` vaut `null`
(`AuthContext.jsx`, aucun compte), donc l'étiquette "propriétaire actuel"
retombait aussi sur `null` dans la branche `isSaved` : silencieusement
invisible plutôt que d'expliquer l'état. Repli sur **"Invité"** (pas
l'anglais "Guest Mode" proposé dans le retour direct) — réutilise le mot
déjà en place ailleurs pour ce même état (Sidebar.jsx, "Mon Espace •
Invité"), cohérence avec le vocabulaire existant plutôt qu'un 2e terme
pour la même notion. 1 test de régression ajouté.

⚠️ **SESSION DU 05/08 (suite 9) — retour direct : "règles à harmoniser dans
un fichier ?" (suite au correctif "TempoFit Officiel" en dur du tour
précédent).** Nouvelle constante **`OFFICIAL_VITRINE_DISPLAY_NAME`**
('TempoFit Officiel', avec majuscules) centralisée dans
`curatedSessions.js` — remplace 36 copies en dur du même littéral (35
`author: 'TempoFit Officiel'` dans ce fichier + la copie fraîchement
ajoutée dans `PlaylistHeader.jsx`). Posée DANS `curatedSessions.js`
précisément (pas dans `officialVitrineProfile.js`, l'endroit a priori plus
"logique" pour une donnée de branding) : ce fichier n'importe rien du
tout, alors qu'`officialVitrineProfile.js` importe déjà `curatedSessions`/
`naughtyCuratedSessions` DEPUIS `curatedSessions.js` — l'inverse aurait
créé un import circulaire. DISTINCTE de `OFFICIAL_VITRINE_USERNAME`
(officialVitrineProfile.js, `'tempofit_officiel'`, tout en minuscules) —
celle-là reste le pseudo TECHNIQUE (URL/mentions @, contraint par
`USERNAME_REGEX`), celle-ci le nom d'AFFICHAGE, jamais utilisé pour une
URL ou une comparaison. Commentaire de `TemplateCard.jsx` qui citait
encore l'ancien littéral mis à jour au passage. Aucun test cassé — la
VALEUR résolue reste identique, seule sa source a changé (tests qui lisent
`template.author` dynamiquement à l'exécution, jamais un littéral figé
côté test).

⚠️ **SESSION DU 05/08 (suite 8) — retour direct, capture annotée : le
chevauchement avec la pochette redouté au tour précédent (noté "à vérifier
en conditions réelles") s'est bien produit. 3 corrections sur l'étiquette
"propriétaire actuel" (`PlaylistHeader.jsx`) :**
- **Repositionnée SOUS la pochette** (plus au-dessus en position absolue)
  — élimine le risque de chevauchement par construction (suit le flux
  normal du DOM, n'ignore plus l'espace déjà occupé par l'image), plutôt
  que de deviner un décalage qui aurait pu re-casser sur une autre largeur
  d'écran.
- **Centrée** (`text-center`, largeur calée sur celle de la pochette).
- **Arobase retirée** ("on perd un caractère") — juste le nom nu
  désormais, le `title` HTML natif au survol reste plus explicite si
  besoin.
- **"TempoFit Officiel" (majuscules)** au lieu du pseudo technique
  `tempofit_officiel` (tout en minuscules, `OFFICIAL_VITRINE_USERNAME`) —
  chaîne en dur, mêmes majuscules que `author: 'TempoFit Officiel'` déjà
  utilisé partout ailleurs (curatedSessions.js/TemplateCard.jsx). Un vrai
  pseudo utilisateur (`username`/`ownerUsername`), lui, reste inchangé :
  toujours en minuscules par construction (`USERNAME_REGEX`,
  `/^[a-z0-9_]{3,20}$/`), rien à "corriger" de ce côté.
4 tests de `PlaylistHeader.test.jsx` mis à jour en conséquence (textes
attendus sans arobase, "TempoFit Officiel" avec majuscules) + le test
"aucune étiquette" reformulé (son ancienne assertion `/^@/` ne pouvait
plus matcher quoi que ce soit après le retrait de l'arobase — passait
toujours "vrai" par construction, plus un vrai test).
