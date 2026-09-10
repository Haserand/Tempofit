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

Rien en cours actuellement — session très longue le 01/09, 13 chantiers
enchaînés (blocs 12 à 24 — anciens blocs 18/20/23 fusionnés dans
17/19/21, voir `HISTORIQUE-2.md` pour le récit complet
de chacun — `HISTORIQUE.md` s'arrête au bloc 11, scindé en 2 fichiers
le 01/09 en dépassant son propre seuil de taille). Résumé très bref :
alignement Sidebar, principes UI généralisés, refonte du partage
(ShareModal.jsx texte+visuel fusionnés, Instagram Stories réel sur iOS
⚠️ jamais testé sur un vrai iPhone), visuel de trophée partageable (2
correctifs après bugs réels en prod), audit complet des trophées
manquants (6 nouveaux) puis paliers Garmin-style (10 nouveaux), 3
principes de design/architecture généralisés pour les trophées, 34
descriptions de trophées raccourcies (0 débordement à partir de 1024px
de largeur réelle — un point mort à 768px signalé séparément, pas
corrigé par du texte), et enfin un audit sémantique des 40 icônes (2
vraies incohérences corrigées — famille sessions totales décalée d'un
cran, HIIT — plus 2 nouveaux principes généralisés : justesse
sémantique littérale d'une icône, garde-fou automatique approximatif de
longueur de description). Enfin, consolidation de l'historique lui-même
(9 fichiers → 6, anciens blocs 18/20/23 fusionnés dans 17/19/21, toutes
les références corrigées) — nouvelle règle permanente ci-dessous.
Suite complète : 125 fichiers, 1756 tests au vert.

### ⚠️ Règle permanente (25/08) — cette section ne contient QUE le chantier en cours, jamais l'historique clos

**Ne JAMAIS laisser une version condensée d'un chantier CLOS s'accumuler
ici.** Cette section a longtemps contenu, en plus de l'état courant, une
sous-section "### Historique détaillé (bloc N)" par ancien bloc de
session — un pur DOUBLON de ce qui vit déjà en entier dans
`historique/bloc-NNx.md`, jamais purgé au fil du temps. Constaté le
25/08 : ce doublon représentait 32% du poids total du README (18 215
caractères sur 57 426) — cause directe du dépassement du seuil de
lecture d'un coup (~16 000 caractères) qui a forcé le découpage de ce
fichier en plusieurs parties (voir tout en tête de `README.md`).

**Procédure à appliquer désormais, systématiquement, à la fin de
CHAQUE chantier/session** :
1. Le récit chronologique complet part (comme d'habitude) dans
   `historique/bloc-NNx.md`.
2. Cette section "État d'avancement" ne garde QUE 1 paragraphe : l'état
   courant (quoi est fait, quoi reste ouvert) + un pointeur "voir
   l'index `HISTORIQUE.md` → bloc N pour le récit complet".
3. Le paragraphe d'état courant de la session précédente est ALORS
   supprimé d'ici (pas archivé ailleurs — il fait double emploi avec le
   bloc historique qui vient d'être créé). Une seule version courante
   existe à un instant donné dans cette section, jamais un empilement
   de anciennes.
4. Si une décision d'architecture ou une convention UI doit survivre
   au-delà de la session (pas juste "ce qui a été fait" mais "ce qui
   est vrai en permanence"), elle va dans les sections dédiées plus bas
   (`Décisions d'architecture`, `Convention UI`...), PAS ici.

### ⚠️ Règle permanente (01/09) — fusionner un bloc dans un bloc RÉCENT plutôt que d'en ouvrir un nouveau par réflexe

Constaté le 01/09 (retour direct : "depuis le début tu as créé plein de
fichiers pour l'historique, sont-ils tous vraiment utiles ? j'ai
l'impression que tu pourrais largement en synthétiser") : 9 fichiers
créés en une seule session, dont 3 racontaient en réalité LE MÊME fil
qu'un bloc tout juste écrit — un bug redécouvert 2-3 fois de suite sur
LE MÊME correctif, ou un "prends du recul, généralise" répété à 2
moments différents sur LE MÊME sujet. Chacun avait ouvert un nouveau
numéro par réflexe plutôt que de se demander s'il prolongeait un fil
déjà en cours.

**Vérification à faire À CHAQUE fois qu'un nouveau chantier commence,
AVANT d'écrire le moindre mot dans un nouveau `historique/bloc-NNx.md`**
— se poser la question, pas juste au moment de rédiger mais dès la
1re lecture du nouveau retour direct :
- Ce chantier revient-il sur EXACTEMENT le même sujet/la même
  fonctionnalité qu'un bloc écrit dans les dernières heures (même
  session) ? (ex. "le bug persiste" sur un correctif qui vient d'être
  livré, "regarde encore" après un audit qui vient d'être fait sur le
  même thème.)
- Si OUI → **fusionner dans le bloc existant** (nouvelle section
  "**Addendum**" ou "**2e passe**" à l'intérieur du MÊME fichier,
  exactement comme d'habitude pour un correctif supplémentaire),
  jamais un nouveau fichier séparé pour la suite du même fil.
- Si le fichier existant dépasserait le seuil de taille une fois
  l'addendum ajouté → condenser en fusionnant (raccourcir les parties
  les plus verbeuses, garder l'essentiel du raisonnement) plutôt que de
  scinder automatiquement en un 2e fichier — un fil unique mérite de
  rester un seul fichier tant que c'est possible sous le seuil.
- Si NON (sujet vraiment différent) → nouveau bloc, comme d'habitude.

**Si un oubli est repéré APRÈS COUP** (plusieurs blocs déjà écrits pour
le même fil, comme le 01/09) : fusionner quand même, à condition de
corriger TOUTES les références externes au(x) fichier(s) supprimé(s)
(recherche `bloc-NN.md` dans `src/`, `tests/`, `readme/`, et l'index lui-
même) — jamais laisser une référence pointer vers un fichier qui n'existe
plus. Documenté comme exception délibérée à la règle "jamais réorganiser
les blocs déjà numérotés" (`HISTORIQUE.md`/`HISTORIQUE-2.md`) : cette
règle protège contre une réorganisation AVEUGLE qui casserait des
références sans les corriger, pas contre une fusion PROPRE où toutes les
références sont vérifiées et mises à jour dans la même opération.

### ⚠️ Règle permanente (01/09) — TOUJOURS signaler explicitement les fichiers à supprimer côté utilisateur, sans attendre qu'on le demande

Constaté le 01/09, juste après la fusion ci-dessus (retour direct :
"je veux que tu notes dans tes instructions qu'à l'avenir tu dois me
dire quand je dois supprimer des fichiers... là j'ai dû te demander") :
Claude a supprimé `bloc-18.md`/`bloc-20.md`/`bloc-23.md` de SON PROPRE
bac à sable, livré les fichiers fusionnés qui les remplacent, mais n'a
JAMAIS dit explicitement "supprime ces 3 fichiers de ton côté" — laissant
l'utilisateur découvrir le problème seul puis le demander.

**Raison structurelle à ne pas oublier** : Claude et l'utilisateur ont
CHACUN leur propre copie du dépôt (le bac à sable de Claude ≠ le vrai
dépôt de l'utilisateur) — livrer un fichier de remplacement ne supprime
JAMAIS automatiquement l'ancien fichier chez l'utilisateur. Une
suppression côté Claude qui n'est jamais traduite en instruction
explicite reste invisible pour l'utilisateur jusqu'à ce qu'il tombe
dessus par hasard (comme ici, en repérant les 5 fichiers "Update"/"Create"
dans son historique Git sans voir de suppression correspondante).

**Procédure à appliquer désormais, systématiquement, dans le MÊME
message que la livraison** — dès qu'un chantier supprime, renomme, ou
déplace un fichier (pas seulement lors d'une restructuration de
l'historique — toute suppression/renommage de fichier `src/`, `tests/`,
`readme/`, peu importe le contexte) :
1. Lister EXPLICITEMENT, en clair, les fichiers à supprimer côté
   utilisateur — pas juste "les fichiers fusionnés remplacent les
   anciens" en sous-entendu, une vraie liste avec les chemins exacts et
   la commande `rm` prête à copier-coller si plusieurs fichiers.
2. Pour un renommage (A.md devient B.md, contenu inchangé) : préciser
   qu'il faut supprimer A.md APRÈS avoir bien enregistré B.md, pas juste
   livrer B.md en silence.
3. Ce rappel va DANS la même réponse que la livraison des fichiers
   modifiés — jamais différé à "si l'utilisateur demande", jamais
   supposé "évident depuis le contexte de la conversation".

## Contraintes de travail

- **Aucun terminal côté utilisateur** — tout passe par l'interface web de GitHub (créer/éditer des fichiers à la main) ; vérification via un vrai déploiement Vercel (logs collés dans la conversation avec Claude).
- **Déploiement automatique Vercel désactivé** (`vercel.json`,
  `"deploymentEnabled": false` — confirmé volontaire, 19/08) : un push
  GitHub ne déclenche PAS de build Vercel tout seul, contrairement au
  comportement par défaut — choix délibéré pour ne pas épuiser le quota
  gratuit Vercel. Le déploiement doit être déclenché manuellement
  (dashboard Vercel) avant de pouvoir coller les logs dans la conversation.
- **Bac à sable Claude sans accès réseau** — `npm install`/`vitest run` réels impossibles. Voir `CLAUDE-SANDBOX-VERIFICATION.md` pour les outils de vérification disponibles quand même (validation de syntaxe réelle via `esbuild`, résolution d'imports).
- Le build Vercel (`npm run build`) lance `vitest run` avant `vite build` (voir `package.json`, script `build`) — un test qui échoue bloque le déploiement.

## Stack

- React 19, Vite 8, Tailwind v4 (design tokens custom, voir `src/index.css`)
- Supabase : auth (email/mot de passe), Postgres + RLS, Edge Function (`supabase/functions/delete-account`)
- Déploiement Vercel, 2 fonctions serverless (`api/deezer.js`, `api/getsongbpm.js`) — proxys pour contourner l'absence de CORS de ces API tierces, gardent leurs clés côté serveur
- Tests : Vitest + Testing Library, `tests/` en miroir de `src/` (voir la section Tests plus bas)
