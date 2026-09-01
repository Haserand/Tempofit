### SESSION DU 01/09 (suite) — Généralisation des principes tirés du chantier d'alignement (bloc 13)

**Demande** : une fois le chantier d'alignement Sidebar/bloc du bas
définitivement résolu (retour direct : "enfin c'est bon !!"), retour
direct demandant si des principes méritaient d'être approfondis et
généralisés plutôt que de rester de simples anecdotes dans
`historique/bloc-13.md`.

**4 principes identifiés et proposés** :
1. Une marge fixe à côté d'un espaceur flexible devient un poids mort
   invisible (cause réelle du "léger scroll" du bloc 13).
2. Ne jamais lire des pixels bruts sur une capture d'écran sans calibrer
   l'échelle d'abord (cause de la sur-correction 15px vs 5px réels).
3. Une mesure en bac à sable est une approximation, jamais une garantie
   identique à la prod (résidu de 5px découvert après déploiement).
4. Vérifier une capacité réelle avant de la nier à l'utilisateur — même
   déjà documentée dans `CLAUDE-SANDBOX-VERIFICATION.md` (Claude avait
   affirmé à tort ne pas pouvoir mesurer, alors que Playwright/Chromium
   étaient déjà répertoriés comme disponibles).

**Choix de répartition demandé et suivi** : les 3 principes de
méthodologie (2, 3, 4) dans `CLAUDE-SANDBOX-VERIFICATION.md`, le principe
CSS (1) dans la Convention UI (`README.md`).

**Mise en œuvre** :
- `claude-sandbox-verification/partie-06.md` avait atteint 12029
  caractères (au-dessus du seuil ~12 000 documenté dans l'index de
  `CLAUDE-SANDBOX-VERIFICATION.md`) — nouveau fichier
  `claude-sandbox-verification/partie-06b.md` créé (pas une extraction,
  du contenu neuf) avec 3 nouvelles sous-sections poursuivant la
  numérotation latine déjà en place (§5ter/5quater/5quinquies existants
  → §5sexies/5septies/5octies) : calibration d'échelle, bac à sable vs
  prod, vérifier avant de nier une capacité. Index `CLAUDE-SANDBOX-
  VERIFICATION.md` mis à jour en conséquence.
- `readme/partie-02.md` (Convention UI) avait atteint 16173 caractères
  (au-dessus du seuil ~13-15 000 documenté dans l'index `README.md`) —
  sa dernière section ("classe Tailwind dépendante sans son prérequis
  `flex`/`grid`") extraite vers un nouveau `readme/partie-02b.md`,
  reconstitution bit à bit vérifiée (concaténation des 2 morceaux = taille
  identique à l'original, 16173 caractères, avant toute modification) —
  PUIS le nouveau principe (marge fixe rendue inerte par un espaceur
  `flex-1`) ajouté à la SUITE de la section déplacée dans ce nouveau
  fichier (thématiquement proche : les deux sont des pièges CSS/Tailwind
  invisibles à la simple lecture). Index `README.md` mis à jour.
- Nouveau bloc `historique/bloc-14.md` (ce fichier) plutôt que d'allonger
  encore `bloc-13.md` (déjà à 15243 caractères, proche du seuil) — cette
  généralisation est une activité distincte (réflexion/documentation) du
  reste du chantier de débogage, même si elle en découle directement.

**Aucun changement de code** — chantier purement documentaire, aucune
suite de tests à relancer (aucun fichier `src/`/`tests/` touché).
