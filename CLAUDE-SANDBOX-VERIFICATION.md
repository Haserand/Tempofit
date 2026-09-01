# Vérification de code en bac à sable Claude — INDEX

⚠️ Ce fichier est un INDEX, pas le contenu lui-même. Restructuré le
25/08 en même temps que `README.md` et selon la même méthode (voir
`README.md` pour le détail de la convention) : `CLAUDE-SANDBOX-
VERIFICATION.md` (~66 000 caractères) dépassait largement le seuil de
lecture complète en un appel (~16 000 caractères). Le contenu réel vit
désormais dans `claude-sandbox-verification/partie-0N.md` (six
fichiers, tous sous ~12 000 caractères), dans l'ordre du document
d'origine. Concaténation vérifiée bit à bit le 25/08 : aucun contenu
perdu ni dupliqué.

Documente les habitudes de travail attendues de Claude sur ce projet et
les outils de vérification réels disponibles en bac à sable (⚠️ npm
install/vite/Playwright fonctionnent réellement — voir `partie-01.md`,
correction du 21/08).

**Convention pour tout ajout futur** : même règle que pour `README.md`
— si une section grossit au point de faire dépasser ~12 000 caractères
le fichier `partie-0N.md` qui la contient, la découper à son tour en
`partie-0Nx.md` en coupant sur une frontière `##`/`###` déjà présente,
jamais au milieu d'un raisonnement, puis revérifier bit à bit. Ne jamais
renuméroter les fichiers déjà existants.

## Index par partie

- `claude-sandbox-verification/partie-01.md` — intro (correction du
  21/08 sur les capacités réelles du bac à sable), section "0.
  Instructions de session à lire en tout premier" : tenir `README.md`
  à jour, ce que veut dire un "check-up complet", habitude de relecture
  approfondie après un chantier sur du code sensible, cadrer chaque
  demande avant d'itérer
- `claude-sandbox-verification/partie-02.md` — suite des "habitudes de
  travail" : se demander seul "où d'autre dans l'app ?", toujours
  indiquer le chemin repo complet de chaque fichier livré, traiter un
  motif de bug répété comme une classe de bug, vérifier le fichier de
  test miroir pour chaque fichier `src/` touché
- `claude-sandbox-verification/partie-03.md` — fin des "habitudes de
  travail" : second avis avec Gemini, proposer spontanément une
  meilleure option, généraliser une correction en règle, tests dédiés
  après découpage de fichier, chantiers risqués acceptés par défaut tant
  qu'il n'y a pas d'utilisateurs réels
- `claude-sandbox-verification/partie-04.md` — "1. Validation de
  syntaxe RÉELLE (esbuild)", "1bis. tsc --checkJs", "2. Résolution
  mécanique des imports relatifs", "3. Équilibre syntaxique grossier",
  "4. Piège Tailwind", "4bis. Vérification de supabase-schema.sql"
- `claude-sandbox-verification/partie-05.md` — "4ter. Premier fichier
  de test pour un composant existant", "4quater. Suppression sandbox ≠
  suppression repo", "4quinquies. ProfileView.jsx vs vitrine",
  "4sexies/4septies. grep avant modification de texte",
  "4octies/4nonies. règle de visibilité en liste, fichier mal poussé",
  "4decies. état UI inatteignable / sélecteur CSS générique dans un test"
- `claude-sandbox-verification/partie-06.md` — "5. Ce que ces outils ne
  remplacent pas", "5bis. matcher jest-dom manquant", "5ter. npm
  install/vite/Playwright fonctionnent réellement en sandbox",
  "5quinquies. régression puis contournement Playwright/Chromium
  (22/08)", "5quater. mesurer le GLYPHE d'un bouton-icône, pas juste sa
  boîte"

## Autres fichiers de référence à ce niveau

- `README.md` — index vers `readme/partie-0N.md` (état actuel du
  projet, architecture, conventions UI)
- `HISTORIQUE.md` — index vers `historique/bloc-NNx.md` (récit
  chronologique complet des chantiers)
