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

Rien en cours actuellement — 2 chantiers le 01/09, même session. (1)
**Check-up de reprise** : sanity check complet (mécanique + audit ciblé,
rien à corriger côté architecture), 2 petites corrections (faux positifs
`testFileIdentityTrap.test.js`, `key` React de `SearchModal.jsx`), bug
"texte blanc sur fond clair" trouvé et généralisé à 3 fichiers
(`StatsView.jsx`/`ProfileView.jsx`/`PlaylistDetailView.jsx`), nouveau
garde-fou permanent `hoverWhiteTextTrap.test.js` — voir bloc 12. (2)
**Alignement Sidebar/bloc du bas** : la ligne au-dessus de "Découvrir"
est désormais ANCRÉE (espaceur `flex-1` + `h-full` sur `<nav>`,
`Sidebar.jsx`) au haut du bloc MiniPlayerBar+GuestModeBar, quelle que soit
la hauteur de fenêtre — vérifié par une vraie mesure Playwright (Chromium
en cache, écart de 0px à 5 hauteurs testées), pas au calcul à la main.
Découverte en cours de route d'un précédent du 22/08 (`creditRowHeight`,
retiré pour préserver l'espace de nav) — présenté à l'utilisateur avant
d'implémenter, solution retenue compatible (n'absorbe que le vide déjà
inutilisé, ne force jamais rien à grandir) — voir bloc 13. Suite complète :
123 fichiers, 1702 tests au vert. Voir l'index `HISTORIQUE.md` → blocs 12
et 13 pour le récit complet.

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
