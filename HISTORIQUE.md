# TempoFit — Index de l'historique détaillé

⚠️ **Ce fichier est un INDEX, pas le contenu lui-même** — le récit
chronologique complet vit dans `historique/`, un fichier par bloc (ou
plusieurs quand un seul bloc dépassait la taille lisible en une fois).
Restructuré une 1re fois le 22/08 (découpage brut par compteur de
caractères), puis une 2e fois le même jour sur remarque directe ("tu
penses utile de segmenter en autant de fichiers ou prise de tête ?") :
le découpage privilégie désormais les vraies frontières de session
(`SESSION DU JJ/MM`, `**JJ/MM — sujet**`) déjà présentes dans le texte,
pas un simple comptage aveugle — 24 fichiers au lieu de 25, et surtout
des coupures qui tombent à des endroits qui ont un sens.

**Pourquoi une restructuration a été nécessaire** : `HISTORIQUE.md`
était un seul fichier de 2824 lignes / 258 Ko, cumulant 8 blocs
chronologiques. Au-delà d'une certaine taille, l'outil de lecture de
Claude tronque silencieusement (sans erreur, juste en montrant le début
et la fin) tout fichier dépassant ~16 000 caractères lu sans plage de
lignes précisée. Vérifié après coup : 6 des 8 blocs dépassaient déjà ce
seuil, certains massivement (bloc 1 : 62 Ko, ~4x la limite).

**Convention retenue pour la suite** : chaque fichier de ce dossier doit
rester lisible en entier par Claude en un seul appel — cible interne
d'environ 13 000 caractères par fichier, marge sous la limite réelle de
16 000. Si le récit d'une session dépasse ce budget, le découper en
plusieurs fichiers `bloc-NNx.md` (x = a, b, c...) EN PRIVILÉGIANT une
coupure à une frontière de session/date déjà présente dans le texte —
jamais couper au milieu d'un raisonnement pour gagner quelques
caractères. Jamais réorganiser après coup les blocs déjà numérotés
(risque de casser les nombreuses références "voir bloc N" déjà posées
ailleurs) — seulement ajouter proprement à la suite.

Reconstruction vérifiée BIT À BIT à chaque restructuration : la
concaténation exacte de tous les fichiers de `historique/`, dans
l'ordre, redonne caractère pour caractère le contenu d'origine — aucun
contenu perdu ni dupliqué dans ces opérations.

## Index par bloc

### Bloc 1 — 02/08 → 05/08 (fondations, système de clonage/lignée, vitrine publique)
- `historique/bloc-01a.md` — en-tête d'archive + SESSION DU 05/08 (suites tardives), profil vitrine
- `historique/bloc-01b.md` — SESSION DU 05/08 (suites 2-7), étiquette créateur cliquable, petits correctifs UI
- `historique/bloc-01c.md` — SESSION DU 04/08, `targetValidation.js` (validation centralisée cible de séance)
- `historique/bloc-01d.md` — SESSION DU 03/08 (2e moitié), petits chantiers UI/perf groupés, onglets profil public
- `historique/bloc-01e.md` — 02/08, synchronisation des descriptions de templates (3 sources différentes unifiées)
- `historique/bloc-01f.md` — 02/08 (suite), système de comptage de clonages v1, décisions de scope

### Bloc 2 — 08/08 (sessions memoization/UX)
- `historique/bloc-02a.md` — ouverture du bloc, contexte de l'élagage
- `historique/bloc-02b.md` — SESSION DU 07/08, check-up général + bug `handleClonePlaylist` (user_id/ownerUsername/cloneCount hérités à tort)
- `historique/bloc-02c.md` — 07/08, étiquette "propriétaire actuel" cliquable vers le profil
- `historique/bloc-02d.md` — 08/08, harmonisation des 2 implémentations "copier le lien"

### Bloc 3 — 08/08 fin + 10/08 (chantiers UI/perf/bugs)
- `historique/bloc-03a.md` — ouverture du bloc
- `historique/bloc-03b.md` — SESSION DU 10/08, redondance étape 2/étape 3 du GeneratorWizard
- `historique/bloc-03c.md` — 10/08, bug de mélange de données entre 2 playlists (Partager/Cloner)
- `historique/bloc-03d.md` — 08/08, validation du titre + émoji baké en dur dans le nom des playlists
- `historique/bloc-03e.md` — 08/08, `GeneratorContext.jsx` découpé (`AthleticContext.jsx` extrait)
- `historique/bloc-03f.md` — 08/08, `PlaylistHeader.jsx` découpé (836 → 254 lignes, 5 sous-composants)

### Bloc 4 — 13-14/08 (hooks/tests, infobulles, moteur de génération)
- `historique/bloc-04a.md` — dix chantiers enchaînés, ouverture du bloc
- `historique/bloc-04b.md` — 14/08, check-up post-chantier, clamp anti-régression

### Bloc 5 — 19-20/08 (check-up, bugs récurrents, renommage, fusion navigation, écritures concurrentes)
- `historique/bloc-05a.md` — ouverture, check-up général
- `historique/bloc-05b.md` — `PlaylistsView.jsx` devient un shell à onglets (Séances/Routines)

### Bloc 6 — 21-22/08 (découpage App.jsx, TabPills, Sidebar/Mode Intime, découverte Playwright/vitest)
- `historique/bloc-06a.md` — découpage App.jsx, TabPills.jsx
- `historique/bloc-06b.md` — diagnostic d'un artefact de rendu, découverte que npm/Playwright fonctionnent réellement en sandbox

### Bloc 7 — 22/08 suite (check-up dette de code, migration recharts, corrections UI ciblées)
- `historique/bloc-07.md` — bloc complet (sous la limite, pas de découpe nécessaire)

### Bloc 8 — 22/08 suite (cloneCount x4, centrage GuestModeBar/MiniPlayerBar x3, 4 refactors de composants partagés, garde-fou automatique)
- `historique/bloc-08.md` — bloc complet (sous la limite, pas de découpe nécessaire)

## Blocs futurs

Le prochain bloc (9) doit suivre la même convention : un ou plusieurs
fichiers `historique/bloc-09x.md`, chacun sous ~13 000 caractères,
la coupure tombant sur une frontière de session/date plutôt qu'un
comptage aveugle de caractères — ajoutés à l'index ci-dessus au moment
de leur création.
