PASSATION — session du 22/08/2026 (suite directe de la session archivée en blocs 6 et 7)

⚠️ Ce fichier est jetable (voir README.md, en tête) : narratif, une fois lu,
il n'a plus besoin d'être tenu à jour au-delà de cette session — la
prochaine conversation qui reprend le fil devrait le lire UNE FOIS puis
repartir du README (état) et de CLAUDE-SANDBOX-VERIFICATION.md (habitudes),
pas continuer à l'alimenter.

⚠️ HISTORIQUE.md restructuré le 22/08 (fin de cette session) : ce n'est
plus qu'un INDEX — le contenu réel vit désormais dans `historique/bloc-NNx.md`
(un ou plusieurs fichiers par bloc, pour rester lisibles en entier). Voir
HISTORIQUE.md lui-même pour le détail et la convention à suivre pour tout
futur bloc.

Pourquoi cette passation existe

Session EXCEPTIONNELLEMENT longue — au point d'avoir déjà motivé un 1er
élagage en cours de route (bloc 7), puis un 2e ici même (bloc 8). Après le
check-up général / migration recharts / corrections UI déjà résumés dans
la passation précédente (bloc 7), la session a continué avec une série
d'enchaînements "correctif → nouveau retour direct → le correctif était
insuffisant/faux → vraie mesure → correctif définitif", puis 4 extractions
de composants partagés. Le récit chronologique complet vit dans
HISTORIQUE.md, blocs 7 et 8 — ce fichier-ci résume et pointe dessus.

Fil chronologique (résumé — le détail complet vit dans HISTORIQUE.md, blocs 7-8)

22/08 — Génération simple d'une playlist : passée à la sauvegarde
automatique dans "Mes Playlists". Un 1er avis ("ça pollue la
bibliothèque") renversé par la question "prends du recul" une fois
vérifié que modifier une playlist non sauvegardée est de toute façon
bloqué ailleurs dans le code — aucune vraie exploration perdue.

22/08 — `cloneCount` : 4 correctifs EN CASCADE le même jour, chacun
révélant le suivant. Une copie clonée/sauvegardée héritait à tort du
compteur de clonages du PARENT plutôt que de repartir à zéro. Corrigé sur
`handleClonePlaylist`, PUIS le même bug trouvé sur `handleSavePlaylist`
(hypothèse de départ fausse, pas assez vérifiée), PUIS ce 2e correctif a
CASSÉ `removeSavedPlaylist` (effet de bord non anticipé entre 2 fonctions
modifiées le même jour), PUIS un audit explicitement demandé n'a PAS
trouvé ce 3e problème avant qu'un retour direct suivant ne le révèle.
Leçon retenue : un audit par fonction ne détecte pas les dépendances
croisées entre 2 fonctions changées le même jour.

22/08 — Centrage `GuestModeBar.jsx`/`MiniPlayerBar.jsx` : 3 TENTATIVES
avant la vraie cause. 1re (repères `max-w-5xl` différents entre les 2
barres) insuffisante. 2e, la bonne mesure : un Chromium trouvé DÉJÀ EN
CACHE dans le bac à sable (`/opt/pw-browsers/chromium-1194/`, cherché
avec `find` après l'échec habituel du téléchargement) a permis de
mesurer pour de vrai — révélé un bug de 46px (bouton volume/fermer non
comptés dans l'équilibrage flex des zones). 3e, après un déploiement
pourtant réussi, un nouveau retour direct ("tu dois te planter") a
révélé que `BottomBarShell.jsx` LUI-MÊME n'avait jamais de `flex` de
base sur son conteneur interne — corrigé à la racine du composant
partagé. **Leçon la plus importante de cette session** : un raisonnement
théorique sur du CSS peut être faux 2-3 fois de suite le même jour ;
dès le 2e échec, chercher activement un moyen de MESURER plutôt que de
re-raisonner dans le vide.

22/08 — Incident de livraison (pas un bug de code, un problème de
PROCESSUS) : un déploiement Vercel cassé parce qu'un fichier nouveau
(`ModalShell.jsx`) n'avait pas été ajouté au dépôt malgré les fichiers
qui l'importaient déjà. Puis, séparément, un tableau de chemins de
fichiers absent d'une réponse a fait perdre du temps réel à
l'utilisateur pour ranger les fichiers livrés. Règle non négociable
retenue : donner nouveau/modifié + chemin exact pour CHAQUE fichier
livré, sans exception, quelle que soit la longueur de la conversation.

22/08 — 4 extractions de composants partagés, à la question "vois-tu
des composants à extraire ?" posée 4 fois de suite (toujours avec une
vraie recherche de motifs Tailwind répétés, pas une réponse de
principe) : `BottomBarShell.jsx` (le déclencheur de toute la série de
bugs de centrage ci-dessus), `ModalShell.jsx` (12 fichiers de modales,
littéral de fond identique caractère pour caractère — les 168 tests
existants sont passés SANS AUCUNE modification après migration),
`ModalCloseButton.jsx` (10 des 12 modales), `SelectablePill.jsx` (seul
cas où une clarification a été demandée avant d'agir — le style d'une
pastille est identique dans 3 fichiers mais le COMPORTEMENT de
sélection diffère réellement entre eux, extraction limitée au bouton
visuel seul). Plusieurs pistes cherchées et NE menant à rien
(documentées pour ne pas les refaire) : carte générique, avatar, bouton
Annuler, champ de saisie, boîte chiffre+label — voir le récit complet
pour la liste exacte.

22/08 — Garde-fou automatique construit à la question "des pratiques à
généraliser, d'autres checks à faire ?" : `flexDependentClassTrap.test.js`
(même famille que `tailwindConcatTrap.test.js`), qui détecte
automatiquement une classe Tailwind flex-dépendante (`flex-col`,
`items-*`, `justify-*`) posée sans son prérequis (`flex`/`grid`) dans les
props de personnalisation des composants partagés. Testé activement
avant livraison (régression simulée, confirmée détectée, fichier
restauré).

Motifs récurrents à retenir pour la suite

**Mesurer, pas re-raisonner.** Sur cette session, un raisonnement
théorique sur du CSS a été faux 2 fois de suite sur le MÊME composant
avant qu'une vraie mesure (Playwright) ne tranche. Dès qu'un 2e
correctif basé sur un raisonnement échoue, chercher activement un moyen
de mesurer (y compris chercher un binaire déjà en cache avec `find`
avant de conclure qu'aucune vérification n'est possible) plutôt que de
retenter un 3e raisonnement.

**Ne jamais reproduire un composant "à la main" pour le tester.** Une
recopie manuelle a donné un résultat faussement rassurant en omettant 2
éléments bien réels du fichier source. Toujours importer le vrai
composant, même pour un test diagnostique jetable.

**Un audit par fonction ne détecte pas les dépendances croisées entre
2 fonctions modifiées le même jour.** Vérifier chaque fonction
isolément ne suffit pas quand 2 modifications du même jour interagissent
— penser à revérifier les fonctions modifiées LES UNES CONTRE LES
AUTRES, pas seulement chacune séparément.

**Une "recette" de mise en page recopiée dans plusieurs fichiers dérive
avec le temps — extraire un composant partagé dès le 2e cas.** Confirmé
2 fois cette session (`BottomBarShell.jsx`, `ModalShell.jsx`) : ne pas
attendre un 3e ou 4e fichier avant d'agir.

**Une classe Tailwind "dépendante" (`flex-col`/`items-*`/`justify-*`) ne
fait RIEN sans sa classe "prérequise" (`flex`/`grid`) sur le même
élément.** Invisible à la lecture, surtout quand la chaîne de classes
traverse une frontière entre 2 fichiers (composant partagé + appelant).
Un garde-fou automatique existe désormais pour ce motif précis
(`flexDependentClassTrap.test.js`).

**Livrer un fichier sans donner nouveau/modifié + son chemin exact a un
coût réel, pas juste une gêne.** Deux fois cette session, ne pas le
faire (ou pas assez clairement) a directement coûté du temps à
l'utilisateur.

Où reprendre

⚠️ **Chantier en attente, priorité HAUTE pour cette prochaine session** :
`README.md` (~57 000 caractères) et `CLAUDE-SANDBOX-VERIFICATION.md`
(~66 000 caractères) dépassent tous les deux, largement, le seuil de
lecture complète en un appel (~16 000 caractères — voir la convention
posée dans README.md, section "À LIRE", et `HISTORIQUE.md` pour un
exemple déjà traité). Constaté le 22/08 en corrigeant ce même problème
sur `HISTORIQUE.md` (déjà réglé, restructuré en `historique/bloc-NNx.md`),
mais volontairement PAS traité dans la foulée pour ces 2 fichiers-ci : ce
sont des fichiers lus À CHAQUE tour de conversation, les découper en fin
d'une session déjà très longue comportait un risque de casser le flux de
travail sans bénéfice immédiat. À faire en tout DÉBUT de cette prochaine
session, à tête reposée — méthode qui a fonctionné sur `HISTORIQUE.md` :
découper par unité logique (les sections `##`/`###` déjà présentes
plutôt que des paragraphes), vérifier bit à bit après coup que la
concaténation des morceaux redonne exactement l'original, mettre à jour
les références croisées qui pointent vers ces fichiers.

Rien en cours — chaque chantier de cette session est fermé, vérifié
(1556 tests passent réellement en fin de session, plusieurs mesures
Playwright réelles obtenues malgré un accès réseau instable), testé.
2 risques non mesurés à ce jour, voir README section "À vérifier
visuellement" : le rendu visuel des graphiques recharts après la
migration 2→3 (jamais inspecté à l'œil, seulement build/tests), et le
glisser-déposer sur `PlaylistCharts.jsx` avec `accessibilityLayer`
désactivé (jamais testable interactivement). Un cas limite UI identifié
et documenté mais pas traité (aucun retour dessus) : le badge "Lecture
seule" et le badge "séance déjà réalisée" pourraient en théorie
apparaître ensemble dans la même rangée de l'en-tête de playlist.

Détail technique utile pour la prochaine session : un binaire Chromium
fonctionnel a été trouvé à `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
dans CE bac à sable précis, utilisable via `executablePath` sans passer
par `npx playwright install` (bloqué). Ce chemin n'est PAS garanti
persister d'une session à l'autre (cache d'image système, pas un acquis
du projet) — re-tester avec `find / -iname "*chromium*"` avant de
supposer qu'il est toujours là.
