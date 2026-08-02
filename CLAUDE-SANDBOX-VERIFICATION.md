# Vérification de code en bac à sable Claude (sans réseau, sans `npm install`)

Ce fichier documente les outils de vérification utilisés par les sessions
Claude successives sur ce projet, quand le bac à sable n'a **aucun accès
réseau** (donc `npm install`/`vitest run` réels sont impossibles) et que
l'utilisateur travaille exclusivement via l'interface web de GitHub (pas de
terminal local pour lui non plus — voir les documents de passation pour le
contexte complet de ce workflow).

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

## 5. Ce que ces outils NE remplacent PAS

Aucun de ces scripts n'exécute réellement `vitest` — une affirmation
"les tests passent" reste donc toujours une vérification par LECTURE
attentive (syntaxe + logique + imports), jamais une exécution confirmée.
Le premier vrai passage de la suite de tests reste celui du build Vercel
réel, après que l'utilisateur a poussé les fichiers via l'interface GitHub.
