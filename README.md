# TempoFit

Générateur de playlists musicales calées sur un BPM cible, pour l'entraînement sportif (course, cyclisme, musculation...) ou en Mode Intime. React 19 + Vite + Tailwind v4, données/comptes via Supabase, déployé sur Vercel.

## ⚠️ Ce fichier est un INDEX, pas le contenu lui-même

Restructuré le 25/08 en 2 temps : (1) découpage brut par unité logique
`##`/`###`, comme pour `HISTORIQUE.md` le 22/08 — 6 fichiers ; (2) sur
remarque directe ("pourquoi pas un seul README, l'historique clos allant
dans historique/ ?"), purge d'un vrai doublon trouvé dans "État
d'avancement" : 5 sous-sections "Historique détaillé (bloc N)" qui ne
faisaient que recopier en condensé ce qui vit déjà en entier dans
`historique/bloc-04..08.md` — jamais nettoyées au fil des sessions,
32% du poids total du README (18 215 caractères sur 57 426). Une fois
purgées (ne reste qu'1 paragraphe d'état courant), 3 fichiers
`readme/partie-0N.md` suffisent au lieu de 6 — le reste (~41 000
caractères) est de la référence vivante (conventions UI, décisions
d'architecture...), pas de l'historique, donc légitimement dans le
README, mais toujours au-dessus du seuil de lecture d'un coup
(~16 000 caractères) pour tenir en un seul fichier.

**Règle permanente ajoutée dans `readme/partie-01.md` (section "État
d'avancement")** : ce doublon ne doit plus jamais se reproduire — à la
fin de CHAQUE chantier, la version condensée de la session précédente
est supprimée d'"État d'avancement" au moment d'écrire la nouvelle,
jamais empilée à côté. Le récit complet part comme d'habitude dans
`historique/bloc-NNx.md`.

**Différence avec `HISTORIQUE.md`** : `HISTORIQUE.md` est consulté
rarement. `README.md` est presque toujours lu par section ciblée
(recherche de mot-clé, plage de lignes) plutôt que d'un seul coup — le
découpage sert avant tout à garantir qu'aucune section ne dépasse le
seuil de troncature, pas à changer la façon dont ce fichier est
consulté.

**Convention pour tout ajout futur** : si un fichier `readme/partie-
0N.md` dépasse à son tour ~13-15 000 caractères, le découper en
`readme/partie-0Nx.md` en coupant sur une frontière `##`/`###` déjà
présente — jamais au milieu d'un raisonnement — et vérifier bit à bit
après coup. Ne jamais renuméroter les fichiers déjà existants. Et
d'abord, systématiquement, se demander si le contenu qui fait grossir
le fichier est vraiment de la référence vivante, ou un doublon
d'historique à purger plutôt qu'à découper (voir ci-dessus).

## Index par partie

- `readme/partie-01.md` — présentation du projet, "⚠️ À LIRE avant de
  retoucher le code" (règles de mise à jour de ce README, convention de
  taille des fichiers), "État d'avancement" (état courant UNIQUEMENT +
  règle de purge), "Contraintes de travail", "Stack"
- `readme/partie-02.md` — "Convention UI — règles génériques accumulées
  au fil des retours directs" (pseudo cliquable, centrage flexbox
  asymétrique, élément décoratif vs fonctionnel, mesurer plutôt que
  raisonner sur du CSS, extraire un composant partagé dès le 2e cas de
  recette dupliquée)
- `readme/partie-02b.md` (01/09, extrait de partie-02.md qui dépassait le
  seuil de taille) — suite de "Convention UI" : classes Tailwind
  dépendantes (`flex-col` sans `flex`), marge fixe rendue inerte par un
  espaceur `flex-1` ajouté à côté
- `readme/partie-03.md` — "Décisions actées, pas encore implémentées —
  chantier Pulses/Leaderboard", "Décidé mais pas encore construit —
  futur champ `profile.bio`", "Tests", "À vérifier visuellement à la
  première occasion", "Autres fichiers de référence à ce niveau"
- `readme/partie-04.md` (27/08, extrait de partie-01.md qui dépassait le
  seuil de taille) — "Décisions d'architecture non évidentes en lisant
  juste le code" (identité des playlists/routines, validation source vs
  consommation, confidentialité, synchronisation Supabase, pseudos
  réservés, profil vitrine, login wall, réutilisation de
  `useProfileSearchFilter.js`, garde-fou genre sur les favoris,
  `classifyGenreMatchTier` partagé, lien Deezer externe)

## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — index vers `claude-sandbox-
  verification/partie-0N.md` (habitudes de travail attendues de Claude
  sur ce projet, restructuré le 25/08 selon la même méthode)
- `HISTORIQUE.md` — index vers `historique/bloc-NNx.md` (récit
  chronologique complet des chantiers)
