# TempoFit — Index de l'historique détaillé (suite, blocs 12+)

⚠️ **Ce fichier est un INDEX, pas le contenu lui-même** — le récit
chronologique complet vit dans `historique/`, un fichier par bloc (ou
plusieurs quand un seul bloc dépassait la taille lisible en une fois).

**Suite de `HISTORIQUE.md`** (01/09, scindé sur le même principe que le
découpage du 22/08 documenté là-bas : au-delà d'environ 16 000
caractères, l'outil de lecture de Claude tronque silencieusement un
fichier lu sans plage de lignes précisée — `HISTORIQUE.md` a dépassé ce
seuil en accueillant le bloc 22, sur la même longue session du 01/09 qui
n'en finissait pas). Voir `HISTORIQUE.md` pour les blocs 1 à 11 (02/08 →
28/08) et pour l'explication complète de la convention de découpage.

**Même règle qu'avant** : jamais réorganiser après coup les blocs déjà
numérotés (risque de casser les références "voir bloc N" déjà posées
ailleurs) — seulement ajouter proprement à la suite, dans CE fichier
désormais (pas dans `HISTORIQUE.md`, qui reste figé aux blocs 1-11).

## Index par bloc

### Bloc 12 — 01/09 (reprise de projet, sanity check + bug texte blanc récurrent)
- `historique/bloc-12.md` — lecture complète de passation, sanity check général (mécanique + audit ciblé, aucune régression trouvée), 2 corrections mineures (faux positifs testFileIdentityTrap.test.js, `key` React de SearchModal.jsx), bug "texte blanc sur fond clair" repéré par capture d'écran puis généralisé à 3 fichiers, nouveau garde-fou permanent `hoverWhiteTextTrap.test.js`

### Bloc 13 — 01/09 (suite, alignement Sidebar/bloc du bas — mesure réelle Playwright)
- `historique/bloc-13.md` — retour direct sur l'alignement de la ligne au-dessus de "Découvrir" avec le haut du bloc MiniPlayerBar+GuestModeBar, clarification du besoin (une seule ligne continue), découverte du précédent du 22/08 (`creditRowHeight`, retiré pour préserver l'espace de nav), solution par espaceur flexible n'absorbant que le vide inutilisé, vraie mesure Playwright à 5 hauteurs de fenêtre (écart réduit à 0px partout), nuance ajoutée à la Convention UI, puis 2 retours directs supplémentaires (centrage de "Découvrir", "léger scroll" sur fenêtre courte) résolus par mesure réelle à chaque fois

### Bloc 14 — 01/09 (suite, généralisation des principes du bloc 13)
- `historique/bloc-14.md` — 4 principes tirés du chantier d'alignement transformés en documentation permanente : marge fixe rendue inerte par un espaceur flexible (Convention UI), calibrer l'échelle avant de lire des pixels sur une capture, mesure en bac à sable = approximation pas garantie, vérifier une capacité réelle avant de la nier (les 3 derniers dans CLAUDE-SANDBOX-VERIFICATION.md)

### Bloc 15 — 01/09 (suite, ShareModal.jsx — texte à côté du Bilan Visuel plutôt qu'au-dessus)
- `historique/bloc-15.md` — retour direct avec capture annotée ("la localisation du texte serait pas meilleure à gauche de l'image ?") : diagnostic confirmé (image du Bilan Visuel en format portrait, ~63px de large affichée à `h-28`, isolée dans sa propre ligne loin du texte au-dessus), mockup de comparaison avant/après présenté puis validé, implémentation en un seul encart flex (image + texte, uniquement quand l'image est prête — sinon texte pleine largeur inchangé), vérifié par capture d'écran réelle des 2 états (avec/sans image) ; puis "Télécharger le visuel" remonté juste sous le visuel (2e retour direct — le bouton "Copier le lien" s'était intercalé entre ce lien et sa justification d'origine)

### Bloc 16 — 01/09 (suite, vrai partage Instagram Stories sur iOS)
- `historique/bloc-16.md` — retour direct ("es-tu sûr que les boutons de partage ouvrent bien les réseaux sociaux ? ça ne me semble pas être le cas pour Instagram") : confirmé, le bouton "Story / IG" n'appelait que le partage générique de l'OS, sans intégration Instagram réelle — nouvelle fonction `shareToInstagramStories` (schéma d'URL `instagram-stories://share`, documenté par Meta, iOS uniquement, écrit l'image dans le presse-papier général puis navigue, avec repli automatique si la page reste visible), câblée en préservant le trophée "hasSharedSomething" existant, 5 nouveaux tests. ⚠️ Jamais testé sur un vrai iPhone (aucun disponible dans ce bac à sable) — implémentation basée sur la documentation Meta et des retours publics, à reconfirmer sur un vrai appareil

### Bloc 17 — 01/09 (suite, visuel partageable pour un trophée débloqué)
- `historique/bloc-17.md` — retour direct ("et pour les trophées ?" puis "oui, crée un visuel pour les trophées") : jusqu'ici un trophée ne partageait que du texte, jamais de visuel — nouveau `TrophyShareCard.jsx` (doré/ambre, rose en Mode Intime), câblé dans `TrophiesView.jsx` (capture immédiate au clic, pas de résolution réseau nécessaire) et `ShareModal.jsx` (`hasReadyImage` accepte désormais aussi `type === 'trophy'`). Vrai bug potentiel trouvé et corrigé AVANT qu'il n'existe en prod : nouvelle clé de contexte `summaryImageContextKey` (ShareImageContext.jsx) pour empêcher qu'un "ready" laissé par un partage de trophée soit réutilisé par erreur pour une playlist (ou l'inverse). 2 nouveaux fichiers de test (ShareImageContext.jsx et TrophyShareCard.jsx n'en avaient jamais eu), 3 fichiers de test existants mis à jour. Addendum : vrai bug trouvé en PROD cette fois (capture d'écran) — 2e trophée capturé quasi vierge, `setTimeout(0)` insuffisant pour garantir un repaint + aucune protection contre un double-clic rapide — corrigé (double `requestAnimationFrame` + `sharingTrophyIdRef`), les 2 autres visuels partageables du projet audités sur demande (aucun aussi exposé)

### Bloc 18 — 01/09 (suite, 3e correctif du visuel de trophée — fond dégradé manquant à la capture)
- `historique/bloc-18.md` — 2 nouvelles captures d'écran envoyées par l'utilisateur ("tu te trompes, oui tu as corrigé un visuel mais tous les autres ne le sont pas encore correctement") : le bug persistait sur d'autres trophées malgré le correctif du bloc 17. Diagnostic affiné (point commun entre les 2 échecs : SEULS les emoji restent visibles, jamais le fond ni le texte — un emoji garde sa couleur propre, le reste du texte est blanc et devient invisible si le fond dégradé échoue à se capturer) — corrigé par un reflow forcé (`element.offsetHeight`) avant chaque capture, PLUS une vérification a posteriori avec nouvelle tentative automatique (taille de fichier PNG mesurée empiriquement : ~370 Ko pour un visuel correct contre ~56 Ko pour un fond manquant — seuil de 150 Ko, jusqu'à 3 tentatives). 2 nouveaux tests, 1 test existant corrigé (comparaison d'objets `File` par égalité profonde non fiable, comparée par nom de fichier à la place)

### Bloc 19 — 01/09 (suite, audit des trophées manquants)
- `historique/bloc-19.md` — retour direct ("je pense qu'il en manque plein ayant ajouté plein de nouvelles fonctionnalités, comme cloner une playlist ou recevoir un compteur de clonage") : audit complet des 24 trophées existants contre toutes les fonctionnalités du code — 6 fonctions entièrement instrumentées mais jamais reliées à un trophée. 6 nouveaux trophées ajoutés (Deuxième Vie/cloner, Source d'Inspiration/recevoir un clonage, Le Trieur/exclusions, Sur Mesure/profil athlétique, Curieux de Nature/consulter un profil, Grand Ouvert/rendre public), câblés à travers 8 fichiers source (dont 3 implémentations indépendantes pour la bascule publique/privée). 13 nouveaux tests ; 4 des 6 trophées vivent uniquement dans App.jsx (aucun test dédié possible, App.jsx n'a pas de fichier de test dans ce projet — cohérent avec les flags de trophée déjà présents là)

### Bloc 20 — 01/09 (suite, paliers Garmin-style pour 5 métriques)
- `historique/bloc-20.md` — retour direct ("souvent sur les applications type Garmin il y a plusieurs itérations des trophées... faudrait-il en dupliquer certains ? ajoute les tous sans me demander") : audit des 30 trophées pour repérer les métriques cumulatives à un seul palier — 5 retenues (sessions totales déjà à 3 paliers +1 quatrième, sessions Mode Intime, remplacements de titres, distance cumulée, imports de données, clonages reçus), 10 nouveaux trophées ajoutés. La moitié (total/naughty/replace/data) ne nécessitait AUCUN changement de code au-delà d'appConfig.js (mécanisme de seuil déjà générique dans checkTrophies) ; l'autre moitié (distance, clonages reçus) a nécessité 2 nouveaux flags chacune, par le même mécanisme ad-hoc que l'existant plutôt qu'une refonte architecturale. 6 nouveaux tests. Bilan complet des métriques retenues ET délibérément écartées (trophées "découverte" à un seul coup) présenté à l'utilisateur

### Bloc 21 — 01/09 (suite, généralisation de principes — design des trophées + paliers futurs)
- `historique/bloc-21.md` — retour direct ("vois-tu des principes à généraliser... si oui fais-le") : audit du propre travail du bloc 20, 1 erreur trouvée (icône 📉 pour "10 imports" suggérant une baisse, corrigée en 🛰️) et 3 principes généralisés — garde-fou permanent d'unicité `id`/`icon` sur `TROPHIES_DATA` (4 nouveaux tests), convention d'escalade visuelle thématique entre paliers d'une même métrique (`readme/partie-02b.md`), et préférence pour un seuil générique plutôt qu'un flag ad-hoc pour toute future métrique tierable (`readme/partie-04b.md`, nouveau — 04.md dépassait le seuil)

### Bloc 22 — 01/09 (suite, descriptions de trophées qui débordent sur 2 lignes)
- `historique/bloc-22.md` — 2 captures d'écran envoyées ("pourquoi les descriptions tiennent pas sur une ligne comme demandé") : 34 descriptions sur 40 raccourcies, après une vraie mesure Playwright (pas une estimation en caractères) qui a révélé un facteur ignoré au 1er essai — la Sidebar (256px, permanente à partir de 768px) réduit bien plus l'espace réel que ne le laissait supposer un harnais isolé sans elle. Cible retenue : 0 débordement à partir de 1024px de largeur de fenêtre réelle (un point mort pathologique à exactement 768px, où la grille passe à 2 colonnes ET la Sidebar apparaît en même temps, rendrait toute description illisible même à 20 caractères — signalé à l'utilisateur comme piste d'amélioration séparée, pas corrigé par du texte)

## Blocs futurs

Le prochain bloc (23) doit suivre la même convention : un ou plusieurs
fichiers `historique/bloc-23x.md`, chacun sous ~13 000 caractères,
la coupure tombant sur une frontière de session/date plutôt qu'un
comptage aveugle de caractères — ajoutés à l'index ci-dessus au moment
de leur création.
