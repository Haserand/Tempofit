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
