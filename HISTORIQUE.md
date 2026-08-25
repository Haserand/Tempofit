# TempoFit — Index de l'historique détaillé

⚠️ **Ce fichier est un INDEX, pas le contenu lui-même** — restructuré le
22/08 en fichiers séparés dans `historique/`, un par bloc (ou plusieurs
par bloc quand un seul bloc dépassait la taille lisible en une fois).

**Pourquoi cette restructuration** : `HISTORIQUE.md` était jusqu'ici un
seul fichier de 2824 lignes / 258 Ko, cumulant 8 blocs chronologiques.
Au-delà d'une certaine taille, un outil de lecture (dont celui de Claude,
qui tronque tout fichier dépassant ~16 000 caractères lu sans plage de
lignes précisée) ne peut plus lire le fichier EN ENTIER en un seul appel
— silencieusement, sans erreur, juste en montrant le début et la fin et
en sautant le milieu. Vérifié après coup : 6 des 8 blocs existants
dépassaient déjà ce seuil, certains massivement (bloc 1 : 62 Ko, ~4x la
limite) — un problème déjà réel, pas seulement à venir.

**Convention retenue pour la suite** (à respecter pour tout nouveau
bloc) : **chaque fichier de ce dossier doit rester lisible en entier par
Claude en un seul appel** — cible interne d'environ 12 000 caractères
par fichier, avec marge sous la limite réelle de 16 000. Si le récit
d'une session dépasse ce budget, le découper en plusieurs fichiers
`bloc-NNx.md` (x = a, b, c...) plutôt que de laisser un seul fichier
grossir sans limite — jamais réorganiser après coup les blocs déjà
numérotés (risque de casser les nombreuses références "voir bloc N"
déjà posées ailleurs), seulement ajouter proprement à la suite.

Reconstruction vérifiée BIT À BIT lors de la découpe du 22/08 : la
concaténation exacte de tous les fichiers de `historique/`, dans l'ordre
ci-dessous, redonne caractère pour caractère l'ancien fichier unique —
aucun contenu perdu ni dupliqué dans cette opération.

## Index par bloc

### Bloc 1 — 02/08 → 05/08 (fondations, système de clonage/lignée, vitrine publique)
- `historique/bloc-01a.md` — mise en place initiale, système de clonage v1
- `historique/bloc-01b.md` — étiquette propriétaire cliquable, itérations UI profil
- `historique/bloc-01c.md` — `targetValidation.js`, validation centralisée
- `historique/bloc-01d.md` — lignée de clonage réécrite (colonnes réelles, `clone_ledger`, anti-abus)
- `historique/bloc-01e.md` — tests cassés trouvés et réparés, vitrine publique
- `historique/bloc-01f.md` — UI publique des routines, fin du bloc

### Bloc 2 — 08/08 (sessions memoization/UX)
- `historique/bloc-02a.md` — ouverture du bloc, contexte
- `historique/bloc-02b.md` — bug `handleClonePlaylist` (user_id/ownerUsername/cloneCount hérités à tort)
- `historique/bloc-02c.md` — étiquette "propriétaire actuel" cliquable
- `historique/bloc-02d.md` — bouton "Copier le lien" du profil

### Bloc 3 — 08/08 fin + 10/08 (chantiers UI/perf/bugs)
- `historique/bloc-03a.md` — ouverture du bloc
- `historique/bloc-03b.md` — `TargetModeInputs` dupliqué entre étapes 2/3
- `historique/bloc-03c.md` — `useAthleticProfile.js`, mutations enveloppées `useCallback`
- `historique/bloc-03d.md` — généralisation d'une recherche répétée 4 fois
- `historique/bloc-03e.md` — `useAudioPreview.js`, retour memoïsé
- `historique/bloc-03f.md` — `PlaylistDetailContext.jsx` découpé en 2 Contextes (perf re-render)

### Bloc 4 — 13-14/08 (hooks/tests, infobulles, moteur de génération)
- `historique/bloc-04a.md` — dix chantiers enchaînés, ouverture
- `historique/bloc-04b.md` — check-up "titres au fur et à mesure", clamp anti-régression

### Bloc 5 — 19-20/08 (check-up, bugs récurrents, renommage, fusion navigation, écritures concurrentes)
- `historique/bloc-05a.md` — ouverture, check-up général
- `historique/bloc-05b.md` — `PlaylistsView.jsx` devient un shell à onglets (Séances/Routines)

### Bloc 6 — 21-22/08 (découpage App.jsx, TabPills, Sidebar/Mode Intime, découverte Playwright/vitest)
- `historique/bloc-06a.md` — découpage App.jsx, TabPills.jsx
- `historique/bloc-06b.md` — Sidebar réorganisée, "Découvrir" isolé de "Création"

### Bloc 7 — 22/08 suite (check-up dette de code, migration recharts, corrections UI ciblées)
- `historique/bloc-07a.md` — check-up en 3 passes, migration recharts 2→3
- `historique/bloc-07b.md` — bouton "Partager mon bilan" déplacé 2 fois, élagage README/HISTORIQUE

### Bloc 8 — 22/08 suite (cloneCount x4, centrage GuestModeBar/MiniPlayerBar x3, 4 refactors de composants partagés, garde-fou automatique)
- `historique/bloc-08.md` — bloc complet (sous la limite, pas de découpe nécessaire)

## Blocs futurs

Le prochain bloc (9) doit suivre la même convention : un ou plusieurs
fichiers `historique/bloc-09x.md`, chacun sous ~12 000 caractères,
ajoutés à l'index ci-dessus au moment de leur création — jamais un
fichier unique qui regrossit sans limite.
