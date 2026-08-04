# Vérification de code en bac à sable Claude (sans réseau, sans `npm install`)

Ce fichier documente les outils de vérification utilisés par les sessions
Claude successives sur ce projet, quand le bac à sable n'a **aucun accès
réseau** (donc `npm install`/`vitest run` réels sont impossibles) et que
l'utilisateur travaille exclusivement via l'interface web de GitHub (pas de
terminal local pour lui non plus — voir les documents de passation pour le
contexte complet de ce workflow).

## 0. Instructions de session (à lire en tout premier)

### Tenir `README.md` à jour
`README.md` (racine du dépôt) est la référence stable de l'architecture du
projet — contrairement aux documents de passation (narratifs, une par
session, jetables une fois lus), il doit rester vrai en continu. **Toute
session qui ajoute ou change une décision d'architecture durable** (nouvelle
table, nouvelle contrainte, un "pourquoi X plutôt que Y" qui resservira dans
3 mois) **doit mettre à jour `README.md` avant de considérer la session
terminée** — pas seulement le documenter dans la passation de fin de
session. Une passation qui décrit une décision d'architecture sans que
`README.md` en parle est une passation incomplète.

### "Check-up complet" — ce que ça veut dire concrètement ici
Quand l'utilisateur demande un check-up complet du code (demande récurrente
en début de conversation, avec ou sans plus de précision), procéder ainsi,
dans cet ordre :

1. **Lire `README.md` en premier** — contexte d'architecture avant de juger
   quoi que ce soit "suspect".
2. **Vérifier les affirmations d'un éventuel document de passation fourni**
   contre le vrai code avant de les prendre pour acquises (voir §7 des
   passations passées — plusieurs briefs affirmaient à tort qu'une
   contrainte ou une architecture existait déjà).
3. **Utiliser les outils de ce fichier** (§1-4 ci-dessous) plutôt que de se
   fier uniquement à une lecture visuelle — la validation de syntaxe réelle
   (§1) et la résolution d'imports (§2) sont peu coûteuses et évitent de
   rater des erreurs mécaniques pendant que l'attention se porte sur la
   logique.
4. **Corriger directement les problèmes clairs et bornés** (bug logique
   isolé, commentaire devenu faux, garde-fou manquant identique à un
   correctif déjà fait ailleurs) plutôt que de se contenter de les
   signaler — cohérent avec la préférence déjà établie de corriger les
   micro-ajustements sans attendre d'y être invité. Pour un changement plus
   large ou risqué (refonte, dépendance nouvelle, décision de produit), le
   signaler et proposer plutôt que d'imposer.
5. **Ajouter un test de régression pour tout bug réel corrigé**, sauf
   décision explicitement assumée de ne pas le faire (voir la section Tests
   de `README.md` pour un exemple déjà accepté : `PlaylistDetailContext.jsx`
   n'a pas de couverture exhaustive du Provider, coût de mock jugé trop
   élevé pour ce qui restait de logique triviale).
6. **Donner un avis global honnête à la fin**, y compris s'il n'y a rien de
   plus à corriger — ne pas inventer des problèmes pour justifier le temps
   passé. Dire explicitement ce qui a été couvert en profondeur vs juste
   survolé (utile pour la session suivante, voir #7).
7. **Mettre à jour `README.md` avant de conclure** : (a) si une décision d'architecture a été touchée (voir la section précédente) ; (b) **systématiquement si un chantier a démarré, avancé ou terminé** — la section "🚧 État d'avancement" en tête du README doit toujours refléter où en est réellement le projet, sinon une session future repart à l'aveugle en croyant qu'aucun chantier n'est en cours.
8. **Tenir `PASSATION.md` à jour (créé le 02/08)** — un résumé CHRONOLOGIQUE et NARRATIF de la session en cours, distinct du README (qui documente l'ÉTAT technique actuel, pas le RÉCIT de comment on y est arrivé). Utile pour une future conversation qui reprendrait ce fil après que celui-ci soit devenu trop long pour rester dans le même historique — se relire soi-même y est plus rapide que de reconstituer le fil depuis des dizaines d'échanges. Mettre à jour à la fin de CHAQUE chantier terminé dans la même session, pas seulement une fois à la toute fin (le risque d'oubli grandit avec la longueur de la conversation).

### Habitude de travail : toujours indiquer le chemin repo complet de chaque fichier livré
Conséquence directe du workflow "aucun terminal côté utilisateur, tout passe par l'interface web de GitHub" (voir plus haut) : l'utilisateur doit lui-même recréer/retrouver l'arborescence à la main pour chaque fichier livré, sans avoir à le demander à chaque fois (trouvé en session le 02/08, chantier "UI publique des routines" — un nouveau composant livré sans son chemin de destination). Concrètement, à chaque lot de fichiers livrés en fin de session (ou en cours de session, dès qu'un fichier est prêt) :
- Donner le **chemin complet depuis la racine du repo** pour CHAQUE fichier (ex. `src/components/modals/PublicRoutinePreviewModal.jsx`, pas juste le nom du fichier) — un tableau récapitulatif à la fin de la réponse est le format le plus lisible pour l'utilisateur qui doit ensuite naviguer/créer ces chemins dans GitHub.
- Distinguer explicitement **fichier nouveau** (l'utilisateur doit le CRÉER via "Add file" dans GitHub, dossier par dossier si besoin) vs **fichier existant modifié** (l'utilisateur l'ouvre et remplace son contenu) — les deux actions sont différentes côté interface GitHub, une confusion fait perdre du temps à l'utilisateur.
- ⚠️ **BUG CORRIGÉ (04/08, retour direct — livraison d'un `.zip` au lieu de fichiers séparés)** : format de livraison RESTÉ IMPLICITE jusque-là, jamais vraiment écrit malgré la règle ci-dessus déjà en place — la conséquence logique du "aucun terminal côté utilisateur" n'avait jamais été tirée jusqu'au bout. **Un `.zip` (ou toute archive) est INTERDIT en livraison** : sans terminal, l'utilisateur ne peut pas l'extraire, il est totalement inutilisable dans ce workflow. Chaque fichier touché doit être livré **individuellement**, un artefact par fichier (contenu intégral du fichier, prêt à sélectionner-tout/copier-coller directement dans l'éditeur web GitHub) — jamais tout le contenu collé en brut dans le corps de la réponse, jamais plusieurs fichiers fusionnés dans un seul artefact/bloc.
- Le tableau récapitulatif (chemin + nouveau/existant) reste la SEULE vue d'ensemble textuelle dans la réponse — chaque fichier lui-même vit dans son propre artefact séparé, jamais dupliqué en texte.

### Habitude de travail : second avis avec Gemini sur les décisions stratégiques/produit
L'utilisateur consulte régulièrement Gemini en parallèle de Claude, typiquement pour challenger une décision stratégique ou produit importante (positionnement, priorisation, architecture de confidentialité...) — pas pour l'implémentation de code. Concrètement, ça prend la forme d'un aller-retour : Claude propose une analyse, l'utilisateur la soumet à Gemini (souvent via un document préparé par Claude à cet effet), puis colle la réponse de Gemini dans la conversation pour que Claude réagisse.

À savoir pour une session qui tomberait sur ce pattern :
- **C'est un usage établi et bienvenu, pas une remise en cause à prendre avec méfiance.** Traiter le retour de Gemini comme un avis extérieur de bonne foi à examiner honnêtement — accepter ce qui est juste (y compris quand ça dépasse ce que Claude avait vu, voir l'exemple ci-dessous), pousser back sur ce qui semble faux ou imprécis, plutôt que d'acquiescer par défaut ou de défendre sa position par réflexe.
- **Exemple concret (02/08, décision Mode Intime/Pulses/leaderboard, voir "Décisions actées" dans `README.md`)** : Gemini a identifié deux angles morts que Claude avait ratés (l'intégration hardware/FC comme barrière défensive face à Spotify, et un vecteur de désanonymisation par corrélation temporelle/réseau) — les deux ont été intégrés tels quels dans les décisions actées du README. Le croisement a aussi évité une confusion inverse : une idée de Gemini (adaptation FC en temps réel) était juste sur le principe mais sous-estimait largement la complexité d'ingénierie réelle par rapport à ce qui existe déjà dans le code (`useSessionAnalysis.js`, analyse post-séance) — Claude a nuancé et isolé cette idée dans une "Vague 2bis" séparée plutôt que de la laisser gonfler le chantier léger prévu en Vague 2.
- Quand une décision actée dans `README.md` a été affinée via ce croisement, le noter dans le README (comme déjà fait pour Pulses/leaderboard) — la traçabilité du "pourquoi" vaut aussi pour l'origine d'une décision, pas seulement son contenu.

## 1. Validation de syntaxe RÉELLE — `esbuild` (recommandé)

Un vrai parseur JS/JSX est **déjà présent** dans le bac à sable Claude, caché
dans les dépendances globales de `tsx` (installé pour d'autres besoins,
sans lien avec ce projet) :

```bash
ESBUILD=/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/bin/esbuild

# Un seul fichier :
$ESBUILD chemin/vers/fichier.jsx --jsx=automatic --outfile=/dev/null

# Tout le projet (src/ + tests/), ne remonte que les VRAIES erreurs :
for f in $(find src tests -name "*.js" -o -name "*.jsx" | grep -v node_modules); do
  out=$($ESBUILD "$f" --jsx=automatic --log-level=silent --outfile=/dev/null 2>&1)
  if [ -n "$out" ]; then echo "=== $f ==="; echo "$out"; fi
done
```

⚠️ Piège rencontré (02/08) : ajouter `--loader=jsx` en plus de l'extension
`.jsx` fait renvoyer un code de sortie 1 à esbuild même sur un fichier
parfaitement valide (avertissement "loader without extension only applies
when reading from stdin"), MAIS ne produit **aucune sortie** sur stdout/
stderr quand `--log-level=silent` est présent — se fier au **contenu**
capturé (`$out`), jamais au seul code de sortie, avec cette combinaison de
flags. Plus simple : ne PAS passer `--loader=jsx` du tout, l'extension
`.jsx` suffit à elle seule à faire deviner le bon loader à esbuild.

Bien plus fiable que compter les accolades/parenthèses à la main (voir §2) :
0 faux positif sur ce projet, contrairement au script maison qui en produit
une ~27aine (essentiellement à cause des apostrophes françaises dans le
texte JSX, qui perturbent une détection naïve des chaînes de caractères).

⚠️ **Angle mort trouvé le 02/08** (chantier "Recherche & filtres sur les
profils publics", passé en build Vercel réel avant d'être détecté) :
`esbuild` valide la SYNTAXE, pas les RÉFÉRENCES — `inputBorder`/`inputBg`
utilisés dans `ProfileView.jsx` sans jamais être destructurés de `theme`
(variable syntaxiquement valide, juste jamais déclarée dans le scope) sont
passés par `esbuild` sans un seul avertissement, plantant uniquement à
l'exécution réelle (`ReferenceError: inputBorder is not defined`, 21 tests
en échec). Voir §1bis juste en dessous pour l'outil qui AURAIT attrapé ça.

## 1bis. Détection de variables non déclarées — `tsc --checkJs` (complète esbuild, ne le remplace pas)

`typescript` est installé globalement dans le bac à sable (`tsc`, pour
d'autres besoins, sans lien avec ce projet — même situation qu'esbuild via
`tsx`). `--checkJs` sur un fichier `.jsx`/`.js` fait remonter les
identifiants utilisés sans être déclarés dans leur scope (`TS2304`/
`TS2552`) — exactement la classe de bug qu'esbuild ne voit PAS (voir
l'angle mort ci-dessus). Aucun vrai `node_modules` installé dans ce bac à
sable : `tsc` échoue à résoudre les packages externes (`react`,
`lucide-react`...), ce qui génère du bruit (`TS2307`) à ignorer — mais suit
correctement les imports RELATIFS locaux (`../../contexts/...`), donc reste
fiable pour ce diagnostic précis. Toujours filtrer sur `TS2304`/`TS2552`
uniquement, jamais lire la sortie brute :

```bash
TSC=/home/claude/.npm-global/lib/node_modules/typescript/bin/tsc

# Un seul fichier :
$TSC --allowJs --checkJs --noEmit --jsx react-jsx --target es2020 \
  --moduleResolution bundler --skipLibCheck chemin/vers/fichier.jsx \
  2>&1 | grep -E "TS2304|TS2552"

# Tout le projet, ne remonte que les VRAIES variables non déclarées :
for f in $(find src -name "*.jsx" -o -name "*.js" | grep -v node_modules); do
  out=$($TSC --allowJs --checkJs --noEmit --jsx react-jsx --target es2020 \
    --moduleResolution bundler --skipLibCheck "$f" 2>&1 | grep -E "TS2304|TS2552")
  if [ -n "$out" ]; then echo "=== $f ==="; echo "$out"; fi
done
```

À lancer systématiquement en plus d'esbuild dès qu'un fichier `.jsx`/`.js`
est créé ou modifié — les deux outils sont COMPLÉMENTAIRES (syntaxe vs
références), ni l'un ni l'autre ne remplace l'exécution réelle du build
Vercel (voir §5).

⚠️ Faux positif connu, sans rapport avec ce diagnostic : quelques fichiers
de test (`useShare.test.js`, `PlaylistDetailView.test.jsx`,
`SettingsView.test.jsx`) utilisent `global` (l'objet global Node, légitime
sous Vitest) — `tsc` le signale en `TS2304` faute de `@types/node`
installé (même cause que le bruit `TS2307` sur `react`/`lucide-react` :
aucun vrai `node_modules` dans ce bac à sable). Un `TS2304` sur `global`
précisément est donc à ignorer ; sur n'importe quel autre identifiant, à
prendre au sérieux.

## 2. Résolution mécanique des imports relatifs

```python
import re, os

def resolve(base_dir, imp):
    candidate = os.path.normpath(os.path.join(base_dir, imp))
    for ext in ['', '.js', '.jsx', '.json', '/index.js', '/index.jsx']:
        if os.path.isfile(candidate + ext):
            return True
    return False

pattern = re.compile(r"""(?:from\s+|vi\.mock\(\s*|import\(\s*)['"](\.[^'"]+)['"]""")
# Parcourir src/ + tests/, chercher chaque import relatif, vérifier qu'il
# résout vers un vrai fichier sur disque.
```

## 3. Équilibre syntaxique grossier (dépassé par §1, gardé pour mémoire)

Utile UNIQUEMENT si `esbuild` (ou un autre vrai parseur) n'était pas
disponible — génère des faux positifs connus à cause des apostrophes
françaises en JSX, des regex, et des commentaires contenant des caractères
isolés. Ne plus utiliser comme méthode principale depuis que le point 1
ci-dessus a été découvert (02/08) — gardé seulement en dernier recours.

## 4. Piège Tailwind (classe dynamique jamais scannée)

```bash
grep -nE "(hover|focus|dark|active|disabled):['\"\`]\s*\+" <fichiers>
grep -nE "(hover|focus|dark|active|disabled):\$\{" <fichiers>
```

## 4bis. Vérification de `supabase-schema.sql` — aucun Postgres réel disponible

Trouvé le 02/08 (chantier fondations SQL de la persona intime — le premier
à toucher ce fichier depuis que ce protocole existe) : **aucun outil de ce
bac à sable ne peut exécuter ou valider réellement du SQL** — pas de
Postgres installé, pas d'accès réseau vers Supabase, `sqlparse` (Python)
indisponible sans réseau pour l'installer. La vérification reste donc
purement MÉCANIQUE et MANUELLE :

- Delimiteurs `$$` en nombre pair sur tout le fichier (`grep -c '\$\$'
  supabase-schema.sql`) — chaque fonction en ouvre puis ferme exactement
  une paire ; un total impair signale à coup sûr une fonction mal fermée.
- Parenthèses/crochets équilibrés sur le bloc ajouté (compter manuellement
  ou via un petit script Python `text.count('(') == text.count(')')`) —
  nécessaire mais pas suffisant (un déséquilibre prouve une erreur, un
  équilibre ne prouve rien d'autre que "au moins pas CETTE catégorie
  d'erreur").
- Toute constante numérique utilisée pour indexer un tableau SQL (ex. `%
  20` pour piocher dans un `array[...]` de 20 éléments) doit être
  recomptée EXPLICITEMENT contre la vraie longueur du tableau — un
  décalage silencieux ne produit pas une erreur SQL, juste un `NULL`
  discret en sortie.
- Préférer systématiquement une fonction Postgres NATIVE et bien connue
  (`hashtext()`, `gen_random_uuid()`, `md5()`) à un idiome plus exotique
  (ex. cast `('x' || ...)::bit(32)::int` pour convertir un hex en entier —
  syntaxe réellement valide mais invérifiable ici avec certitude) —
  choisir la fonction dont la signature est connue sans le moindre doute,
  plutôt que la plus élégante.
- Respecter la convention DÉJÀ établie dans ce fichier (voir son en-tête) :
  `create table if not exists` / `create or replace function` sont
  idempotents nativement, mais `create policy` ne l'est PAS — toujours le
  faire précéder d'un `drop policy if exists` avec le nom EXACT, sous
  peine de casser la ré-exécutabilité complète du fichier (`ERROR: 42710`
  dès la 2e exécution).
- Toujours ajouter, en commentaire juste avant toute nouvelle fonction, une
  requête `select` prête à copier-coller dans l'éditeur SQL Supabase —
  c'est la SEULE vérification qui compte réellement, et elle ne peut être
  faite que par l'utilisateur, jamais par Claude dans ce bac à sable.
- Le premier build Vercel après un changement de `supabase-schema.sql` ne
  suffit PAS à valider le SQL lui-même (Vercel ne l'exécute jamais — ce
  fichier est copié-collé à la main par l'utilisateur dans Supabase,
  totalement hors du pipeline de build) : un chantier SQL qui touche ce
  fichier reste NON vérifié tant que l'utilisateur n'a pas confirmé
  explicitement avoir exécuté le script et testé les requêtes suggérées.
- ⚠️ **`auth.uid()` vaut TOUJOURS `null` dans l'éditeur SQL Supabase** —
  aucune fonction qui en dépend (`if auth.uid() is null then return; end
  if;`, garde quasi systématique sur toute RPC touchant à un compte
  utilisateur) ne peut être vérifiée de cette façon, même en copiant-collant
  la requête suggérée exactement. Confirmé À RÉPÉTITION sur ce projet
  (`get_or_create_intimate_persona()`, puis `increment_playlist_clone_count`/
  `clone_ledger`) — un appel direct dans l'éditeur s'exécute SANS ERREUR
  (rien à corriger côté SQL), mais ne fait STRICTEMENT rien, silencieusement,
  dès sa 1re ligne. **Prévenir l'utilisateur de cette limite AVANT de lui
  faire lancer une longue séquence de requêtes de test** sur ce genre de
  fonction — pas seulement en aparté après plusieurs tours d'aller-retour
  (voir la session du 02/08, chantier "compteur de clonages" : 6 échanges
  d'images/requêtes avant d'arriver à cette conclusion, alors que la
  réserve était déjà connue et documentée pour `get_or_create_intimate_persona()`
  quelques chantiers plus tôt — aurait dû être répétée d'emblée). La SEULE
  vérification valable pour ce type de fonction est un vrai geste dans
  l'app déployée, avec une vraie session authentifiée.

## 4quater. Supprimer un fichier côté sandbox ≠ le supprimer côté repo de l'utilisateur

Trouvé le 02/08 (chantier "compteur de clonage honnête", `fakeCloneCountForId`
retirée de `curatedSessions.js`) : `bash_tool` peut supprimer un fichier dans
CE bac à sable (`rm ...`), mais l'utilisateur, lui, ne voit et n'applique QUE
ce qui est explicitement livré via `present_files` — un fichier supprimé
côté sandbox reste tel quel sur son repo GitHub tant que Claude ne le lui dit
PAS explicitement. `tests/data/curatedSessions.test.js` (testant uniquement
cette fonction retirée) a ainsi continué à planter le build Vercel pendant
plusieurs tours, invisible dans les sweeps esbuild/tsc de ce bac à sable
puisqu'il n'y existait déjà plus.

**Règle** : dès qu'un fichier est supprimé (ou qu'une fonction/un export est
retiré et qu'un fichier de test ne teste plus QUE cette chose), lister
EXPLICITEMENT dans la réponse à l'utilisateur les fichiers à supprimer
côté GitHub — un chemin par ligne, aussi visible que le tableau des fichiers
à pousser. Ne jamais supposer qu'un `rm` local suffit à répercuter la
suppression chez l'utilisateur.

## 4ter. Écrire un premier fichier de test pour un composant existant — vérifier les VRAIS types de props par défaut, jamais deviner

Trouvé le 02/08 (1er fichier de test de `StatsView.jsx`, chantier "compteur
de clonages") : `esbuild`/`tsc --checkJs` ne peuvent PAS attraper une
mauvaise supposition sur le TYPE d'une prop stubée dans un test — un stub
`selectedStatsGenre: null` passe la vérification syntaxique/de références
sans problème, mais plante à l'EXÉCUTION réelle si le composant appelle
`.size` dessus (`TypeError: Cannot read properties of null`) parce que la
vraie valeur par défaut, dans le composant appelant (`App.jsx`), est
`new Set()` — jamais `null`. Ni esbuild ni tsc (sans les vrais types du
projet, absents ici) ne peuvent détecter ce genre d'incompatibilité de
forme.

**Règle** : en écrivant un PREMIER fichier de test pour un composant qui
n'en avait pas encore, ne jamais deviner le type par défaut d'une prop
d'après son nom (`selectedStatsGenre` "sonne" comme si `null` était un état
initial raisonnable — ce n'est pas le cas ici). Toujours `grep` la vraie
déclaration `useState(...)` dans le composant PARENT qui la fournit (ici
`App.jsx`, `<StatsView selectedStatsGenre={selectedStatsGenre} ...>`) avant
d'écrire le stub — un aller-retour de plus à la lecture du code, mais qui
évite un aller-retour de build Vercel complet (60+ secondes) pour une
faute qui se serait vue en 10 secondes de `grep`.

## 4quinquies. `ProfileView.jsx` — tout changement doit être vérifié CONTRE la vitrine (`@tempofit_officiel`), pas seulement contre un vrai profil

Trouvé/formalisé le 03/08 (chantier "onglets Playlists/Routines" — retour
direct de l'utilisateur : "tu modifies pas la page du compte test vitrine
officiel ?"). `ProfileView.jsx` est le MÊME composant pour un vrai profil
Supabase et pour la vitrine `@tempofit_officiel` — seule la SOURCE des
données change (Supabase pour un vrai profil, `officialVitrineProfile.js`
pour la vitrine, entièrement fabriqué à la main, aucune vraie ligne). Un
changement de rendu/interaction s'applique donc automatiquement aux deux —
mais "s'applique automatiquement au rendu" ne veut PAS dire "vérifié
automatiquement" : les données de la vitrine sont fabriquées à part,
peuvent silencieusement diverger de la forme réelle d'une ligne Supabase
(voir le point 8 du chantier 02/08, README.md — `officialVitrineProfile.js`
était resté désynchronisé de `content.tracks`/`description`/`clone_count`
pendant plusieurs chantiers avant d'être remarqué).

**Règle, 3 points concrets à vérifier à CHAQUE changement dans
`ProfileView.jsx`** (ou dans un hook qu'il utilise, ex.
`useProfileSearchFilter.js`) :

1. **Impact sur les tests** — si le changement touche le rendu/l'interaction
   (nouvel onglet, nouvelle section, nouveau filtre...), le describe
   "profil vitrine officiel" de `ProfileView.test.jsx` doit avoir AU MOINS
   un test qui exerce ce changement, pas seulement les describes "vrai
   profil". Un composant partagé avec 0 test vitrine sur un nouveau
   comportement est un trou de couverture, même si le composant "devrait"
   marcher pareil pour les deux — l'exemple du 02/08 ci-dessus montre que
   "devrait" n'est pas une garantie en pratique.
2. Tout nouveau champ `content` consommé par la grille publique (recherche,
   filtres, badges, affichage de carte) doit avoir son équivalent dans
   `officialVitrineProfile.js` (`buildOfficialVitrineProfile()` pour les
   playlists, `buildOfficialVitrineRoutineRows()` pour les routines) —
   règle déjà actée au README (chantier 02/08, point 8), reformulée ici
   pour être RELUE en tout premier, pas seulement documentée après coup.
3. Toute nouvelle colonne RÉELLE (hors `content` — `clone_count`,
   `parent_user_id`, `is_public`...) lue directement sur une ligne doit
   être vérifiée contre les lignes fabriquées de la vitrine : soit présente
   avec une valeur plausible, soit absente DÉLIBÉRÉMENT (ex. `parent_user_id`
   n'a pas de sens pour une playlist vitrine qui n'a jamais été clonée
   depuis un vrai compte — absence correcte, pas un oubli). Le distinguo
   se fait en le disant explicitement dans la réponse à l'utilisateur, pas
   en laissant le silence trancher.

## 4sexies. Modifier un texte visible par l'utilisateur — `grep` le repo entier AVANT, jamais seulement le fichier où le retour a été fait
Trouvé le 04/08 (retour direct : "cette phrase se trouve aussi dans l'onglet favoris, tu as pensé à la modifier ?") : un message d'info sur les genres musicaux ("les genres les moins courants...") avait été raccourci dans `GeneratorWizard.jsx` sur demande explicite ("la phrase doit tenir en une seule ligne") — sans vérifier s'il existait ailleurs. Il était dupliqué mot pour mot dans `FavoritesView.jsx` (les deux fichiers le documentaient déjà comme volontairement synchronisés — "même reformulation que GeneratorView.jsx" — un commentaire qui aurait dû être le signal à suivre). Racine du problème : une capture d'écran ou un retour direct montre TOUJOURS un seul endroit précis de l'app, jamais "tous les endroits où ce texte apparaît" — rien dans l'énoncé de la demande n'indique qu'une copie existe ailleurs.
Règle : avant de modifier un texte utilisateur (libellé, message d'aide, tooltip, texte de bouton...), `grep` une portion suffisamment distinctive du texte ACTUEL sur tout `src/` (pas juste le fichier concerné par le retour) — même réflexe que pour un changement de comportement (voir §4quinquies sur `officialVitrineProfile.js`, même famille de bug : une correction locale qui laisse une copie non synchronisée ailleurs). Si `grep` remonte plusieurs fichiers, appliquer le même changement partout dans la même passe, pas fichier par fichier au fil des retours de l'utilisateur.

## 5. Ce que ces outils NE remplacent PAS

Aucun de ces scripts n'exécute réellement `vitest` — une affirmation
"les tests passent" reste donc toujours une vérification par LECTURE
attentive (syntaxe + logique + imports), jamais une exécution confirmée.
Le premier vrai passage de la suite de tests reste celui du build Vercel
réel, après que l'utilisateur a poussé les fichiers via l'interface GitHub.
