## 5sexies. Ne jamais lire des pixels bruts sur une capture d'écran sans calibrer l'échelle d'abord

Erreur réelle commise le 01/09 (voir `historique/bloc-13.md`, alignement
Sidebar/bloc du bas) : une 1re lecture directe des pixels d'une capture
d'écran envoyée par l'utilisateur a conclu à un écart de ~15px entre deux
lignes — **faux d'un facteur ~3**. L'écran de l'utilisateur tournait à une
résolution/zoom d'environ 3,1x (retina ou équivalent), jamais mentionné ni
visible autrement que par calcul : le pixel affiché dans le PNG n'est pas
le pixel CSS réel.

**Méthode à appliquer systématiquement avant de conclure quoi que ce soit
d'un écart mesuré en pixels sur une capture d'écran** : d'abord calibrer
l'échelle via une référence de taille CONNUE et présente dans l'image
(une largeur de composant fixe en CSS — ici, `w-64` de la Sidebar = 256px
— comparée à sa largeur réelle en pixels dans le fichier PNG) :
```python
from PIL import Image
img = Image.open('capture.png').convert('RGB')
# repérer la bordure verticale (ou tout autre repère de taille connue)
# par un scan de luminosité, PUIS calculer l'échelle :
scale = position_mesuree_en_px_image / taille_connue_en_px_css
# ENSUITE seulement, diviser tout écart mesuré par cette échelle
# pour obtenir la vraie valeur en px CSS.
```
Sans cette étape, un écart lu brut sur l'image mène à une correction
sur-dimensionnée (ici, une tentative de corriger 15px alors que le vrai
écart CSS n'était que d'environ 5px) — le correctif suivant doit alors
lui-même être annulé/réduit, doublant le nombre d'allers-retours pour
rien.

## 5septies. Une mesure en bac à sable est une TRÈS bonne approximation, jamais une garantie identique à la prod

Constaté 2 fois dans le même chantier (01/09, `historique/bloc-13.md`) :
une mesure Playwright dans ce bac à sable donnant un écart de 0.0px exact
(alignement Sidebar/bloc du bas) ne s'est PAS reproduite à l'identique
une fois déployée en vrai — un résidu d'environ 5px restait visible sur
une capture d'écran de l'app réellement en ligne. Cause probable : une
différence fine de rendu de police entre ce bac à sable et l'environnement
réel de déploiement (jamais isolée avec certitude — l'écart était trop
petit pour valoir une investigation plus poussée que la mesure elle-même).

**Conséquence pratique** : toute valeur pixel-perfect (marge, position)
obtenue par une mesure Playwright locale doit être présentée à
l'utilisateur comme "mesuré ici, à confirmer une fois déployé pour de
vrai" — jamais comme un résultat définitif clos. Prévoir d'emblée qu'un
petit résidu (quelques px) puisse nécessiter un 2e passage après un vrai
déploiement, et le dire avant qu'on vous le signale.

## 5octies. Vérifier la capacité réelle avant de la nier à l'utilisateur — même déjà documentée dans CE fichier

Erreur réelle commise le 01/09 (`historique/bloc-13.md`) : en réponse à
une demande d'alignement pixel-perfect, Claude a répondu "je n'ai pas de
vrai navigateur ici pour mesurer l'écart exact" — **faux**, et déjà
démenti par ce document lui-même (§5ter/5quater/5quinquies ci-dessus,
présents dans ce même fichier AVANT cette session). L'utilisateur a dû
demander explicitement "tu as accès au fait de voir/simuler le visuel de
l'application ?" pour que la vérification soit faite.

**Cause** : une capacité mentionnée plus tôt dans l'historique du projet
(même documentée noir sur blanc) n'est pas automatiquement "présente à
l'esprit" au moment de répondre à une nouvelle demande — surtout si la
question initiale ("peux-tu ajuster ce pixel ?") ne mentionne pas
explicitement "mesure"/"vérifie visuellement". Le réflexe "je n'ai pas
accès à X" doit toujours être précédé d'une vérification RÉELLE (tenter
la commande, ou au minimum relire ce fichier) — jamais affirmé depuis la
mémoire générale de ce qu'un assistant IA "peut" ou "ne peut pas" faire
par défaut. Ce fichier existe précisément pour court-circuiter ce genre
de supposition par défaut ; le consulter avant de répondre "je ne peux
pas" est plus rapide que de laisser l'utilisateur le découvrir et le
signaler à sa place.
