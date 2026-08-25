## 5bis. Angle mort concret trouvé le 19/08 : matcher `jest-dom` manquant, invisible à `esbuild`/`tsc`

Ce projet n'a **aucun `setupFiles` global** dans `vite.config.js` — chaque
fichier de test qui utilise un matcher `jest-dom` (`toHaveTextContent`,
`toBeInTheDocument`, `toBeVisible`, `toHaveClass`, `toHaveValue`,
`toHaveAttribute`, `toBeChecked`, etc.) doit l'étendre lui-même via
`import '@testing-library/jest-dom/vitest';` en tête de fichier (voir
`tests/contexts/PlaylistEditContext.test.jsx` pour la convention déjà en
place). Un fichier de test qui l'omet ne plante NULLE PART avant
l'exécution réelle — ni `esbuild`, ni `tsc --checkJs` ne peuvent le
détecter (l'import est syntaxiquement valide, `expect(...).toHaveTextContent`
n'est qu'une méthode manquante sur un objet à l'exécution, pas une erreur
de type visible statiquement dans ce setup). Se manifeste au build Vercel
réel par `Error: Invalid Chai property: <nom du matcher>`.

**Vérification à faire manuellement, pour tout nouveau fichier de test**
(monté React + matcher `jest-dom`) avant de le livrer :
```bash
# Repère les matchers jest-dom utilisés SANS l'import qui les active :
grep -E "toHaveTextContent|toBeInTheDocument|toBeVisible|toBeDisabled|toHaveClass|toHaveValue|toHaveAttribute|toBeChecked" <fichier> \
  && ! grep -q "jest-dom" <fichier> \
  && echo "⚠️ import manquant"
```

## 5ter. Découverte majeure le 21/08 : `npm install`/`vite`/Playwright fonctionnent réellement en sandbox

Jusqu'ici, ce fichier affirmait (titre + intro d'origine) qu'aucun accès
réseau n'existait, rendant `npm install`/un serveur de dev réel/`vitest run`
impossibles — **faux**, jamais revérifié depuis la création de ce fichier.
Trouvé en cherchant à diagnostiquer un artefact de rendu CSS trop subtil
pour être tranché depuis la lecture du code seul (coin de carte arrondi
touchant une ligne de séparation à 0px près, wizard générateur — voir
README pour le détail du bug lui-même).

**Ce qui fonctionne, vérifié empiriquement** :
```bash
npm install --prefer-offline --no-audit --no-fund   # fonctionne (registre npm accessible)
npx playwright install chromium                      # fonctionne SANS --with-deps
npm run dev -- --port 5173 --host 127.0.0.1 &        # serveur vite réel démarre
```
Puis un script Node + Playwright peut naviguer dessus, cliquer, remplir des
formulaires, et surtout **lire les styles RÉELLEMENT calculés par le
navigateur** (`getComputedStyle`, `getBoundingClientRect()`) — la seule
façon fiable de trancher un doute sur un rendu visuel (superposition,
z-index, débordement de quelques px, artefact de `border-radius`) sans
deviner depuis les classes Tailwind seules.

**Ce qui NE fonctionne PAS** : `npx playwright install chromium
--with-deps` (installation des dépendances système Ubuntu du navigateur)
échoue — un des dépôts APT requis (`deb.nodesource.com`) est bloqué au
niveau réseau. Chromium s'installe quand même correctement SANS
`--with-deps` (les dépendances système semblent déjà présentes dans cette
image) — donc utiliser la commande sans cette option, pas avec.

**Limite qui reste réelle, VÉRIFIÉE (pas supposée)** — retour direct 22/08,
"tu en es sûr ?" : bon réflexe de l'utilisateur, ma 1re version de cette
note affirmait cette limite sans l'avoir vraiment testée. Testé pour de
vrai : `curl https://api.deezer.com/...` (bash_tool) ET
`page.goto('https://api.deezer.com/...')` (navigateur piloté par
Playwright) renvoient tous les deux `403 Host not in allowlist` —
message IDENTIQUE dans les 2 cas, confirmant que le navigateur Playwright
passe par le MÊME filtre réseau par liste blanche que le reste du bac à
sable. `supabase.co` lui-même bloqué pareil. Aucun fichier `.env` présent
dans ce projet non plus (seulement `.env.example`) — même sans ce
blocage, l'app tournerait de toute façon sans vraies clés Supabase ici.
Conséquence : ce navigateur headless N'A PAS d'accès réseau externe pour
l'app elle-même — donc seulement utilisable pour des écrans/flux qui ne
dépendent PAS d'un appel réseau externe immédiat (le wizard générateur,
étapes 1-3, fonctionne entièrement en state local). Pour un écran qui
appelle Supabase/Deezer dès le montage, cette technique ne suffira pas
telle quelle — mocker ces appels côté serveur de dev sortirait du
périmètre d'une simple vérification ponctuelle.

## 5quinquies. ⚠️ RÉGRESSION CONSTATÉE (22/08, migration recharts) : `npx playwright install chromium` échoue, contrairement à §5ter — PUIS CONTOURNÉE (22/08, même jour, chantier suivant) : un vrai Chromium était déjà en cache, pas besoin de télécharger

⚠️ Section RÉORGANISÉE au passage (22/08) — cette section coupait
auparavant en 2 un paragraphe continu de §5ter ci-dessus (insérée en
plein milieu par erreur) ; déplacée ici, à sa place logique, contenu
inchangé.

Tentée avant de vérifier visuellement le rendu des graphiques recharts
après la migration 2→3 (voir README). Commande IDENTIQUE à celle
documentée comme fonctionnelle en §5ter (`npx playwright install
chromium`, sans `--with-deps`), MÊME session de travail globale, MÊME
jour calendaire — mais échec cette fois :
```
Error: Download failed: server returned code 403 body 'Host not in
allowlist: cdn.playwright.dev. Add this host to your network egress
settings to allow access.'
```
Différent du blocage déjà documenté en §5ter (qui bloquait uniquement
`--with-deps`/`deb.nodesource.com`, PAS le téléchargement du binaire
Chromium lui-même, qui réussissait) : cette fois c'est le téléchargement
de base qui échoue, sur un domaine différent (`cdn.playwright.dev`,
jamais mentionné avant). Conclusion (toujours valable) : **la liste des
domaines réseau autorisés en sandbox n'est pas stable dans le temps**
(ou varie selon la session/l'environnement précis) — ne JAMAIS supposer
qu'une capacité réseau documentée ici reste vraie sans la re-tester,
même documentée "vérifiée" une fois. Repli utilisé à ce moment-là :
build réel + suite de tests complète + inspection statique du bundle
recharts servi par le serveur `vite` réel — voir README pour le détail.
Contrôle visuel PIXEL RÉEL non obtenu à cette occasion, signalé
honnêtement plutôt que de laisser croire le contraire.

⚠️ **CONTOURNEMENT TROUVÉ (22/08, même jour, chantier UI suivant — retour
direct sur un problème de centrage, "ça ne parait toujours pas centré")**
— retenté malgré l'échec précédent (jamais supposer qu'un blocage reste
vrai sans re-tester, même documenté récemment) : `npx playwright install
chromium` échoue TOUJOURS de la même façon (`cdn.playwright.dev` hors
liste blanche). MAIS un vrai binaire Chromium existe déjà, pré-installé
sur ce système, PAS besoin de le télécharger :
```
/opt/pw-browsers/chromium-1194/chrome-linux/chrome
/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome
```
Trouvé par `find / -iname "*chromium*" -o -iname "*chrome*"` — réflexe à
avoir DÈS QU'`npx playwright install` échoue, avant de conclure "aucune
vérification visuelle possible cette session". Utilisable directement en
pointant `executablePath` au lancement, sans passer par `npx playwright
install` du tout :
```js
import { chromium } from 'playwright'; // npm install --no-save playwright suffit, PAS besoin d'installer de navigateur
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'], // requis dans ce bac à sable (pas de user namespaces)
});
```
Fonctionne pour de vrai — vérifié en mesurant un vrai problème de
centrage flexbox (`MiniPlayerBar.jsx`) avec `getBoundingClientRect()` sur
des composants RÉELLEMENT montés (import direct depuis `src/`, pas une
recopie manuelle des classes — voir README pour pourquoi cette nuance a
eu son importance ce jour-là) via le vrai serveur `vite` + ce Chromium.
Capture d'écran réelle prise aussi (`page.screenshot()`), confirmant
visuellement la mesure. **Ce chemin (`/opt/pw-browsers/...`) reste à
revérifier à chaque session** (rien ne garantit qu'il persiste d'une
session à l'autre, c'est un cache d'image système, pas un acquis du
projet) — mais le réflexe "chercher un binaire déjà présent avant de
conclure à l'absence de navigateur" en vaut la peine à chaque fois.

**Conséquence pratique pour la suite** : avant de deviner un bug de rendu
CSS depuis le code seul (surtout après plusieurs allers-retours de
capture d'écran sans certitude), envisager cette technique — mesurer
plutôt que deviner. Toujours nettoyer après usage (`pkill -f vite`,
supprimer les scripts/captures temporaires du `/tmp`, ET tout fichier de
test ajouté dans le projet lui-même comme des points d'entrée HTML/JSX
temporaires — jamais les laisser traîner jusqu'à la livraison), et
reverter tout export/changement fait UNIQUEMENT pour faciliter la mesure
(ex. un `export` ajouté temporairement sur un module pour l'importer
depuis un harnais de test, sans quoi il resterait un changement invisible
mais bien réel dans le code livré).

⚠️ **`vitest run` RÉEL fonctionne AUSSI** — vérifié le même jour,
immédiatement après la découverte ci-dessus : `npx vitest run` exécute la
suite ENTIÈRE, pas juste un fichier isolé. Résultat à cette date : **113
fichiers de test, 1506 tests, TOUS passent**, en ~140s. Ça change la
donne la plus fondamentale de tout ce document : "les tests passent"
n'a plus besoin de rester une simple lecture attentive quand du temps est
disponible pour le vérifier — une exécution réelle est possible avant de
livrer, pas seulement au moment du build Vercel. À utiliser en priorité
sur un chantier qui touche des fichiers sensibles ou beaucoup de fichiers
à la fois (comme ce fut le cas plus tôt dans cette session) — reste
cependant plus lent qu'une lecture attentive pour un tout petit
changement isolé, donc ne remplace pas systématiquement `esbuild`/
`tsc --checkJs` pour les cas simples, s'ajoute en confirmation finale
avant de livrer un chantier conséquent.

## 5quater. Mesurer un alignement visuel avec Playwright — mesurer la BOÎTE d'un bouton-icône ne suffit PAS, il faut mesurer le GLYPHE

Erreur réelle commise le 22/08 (voir README, section "En-tête de playlist
— badge Lecture seule mal aligné", suite) — CONTESTÉE à raison par
l'utilisateur ("menteur"), qui avait vu juste : un 1er diagnostic Playwright
avait conclu à tort qu'un correctif d'alignement s'appliquait déjà à un 2e
bouton (Corbeille) simplement parce que
`trashButton.getBoundingClientRect()` tombait à 0px du badge de référence.
**Faux** : un bouton-icône SEUL (pas de bordure/fond visible par défaut,
juste `p-2` autour d'un SVG pour agrandir la zone de survol) a une boîte
cliquable PLUS GRANDE que son contenu visuellement perçu — la boîte peut
être parfaitement alignée pendant que l'icône, elle, reste visuellement en
retrait du padding (ici 8px, `p-2`).

**Règle à appliquer désormais pour tout alignement visuel vérifié via
Playwright** : ne JAMAIS s'arrêter à la boîte de l'élément le plus
extérieur si son contenu visuel (icône SVG, texte) peut être plus petit
que cette boîte. Mesurer le SVG/texte lui-même :
```js
const svg = button.querySelector('svg');
svg.getBoundingClientRect(); // PAS button.getBoundingClientRect() seul
```
Un élément avec une bordure/un fond VISIBLE remplissant toute sa boîte
(ex. un badge avec `border`+`bg-*` opaque) n'a PAS ce problème — sa boîte
EST son contenu visuel, la mesurer directement suffit. Le doute se lève en
inspectant le `className` : présence de `border`/`bg-*` opaque → boîte =
contenu, mesure directe fiable ; icône/texte seul dans du `padding` sans
fond → mesurer le contenu interne, jamais le conteneur seul.
