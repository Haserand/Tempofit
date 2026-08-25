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
