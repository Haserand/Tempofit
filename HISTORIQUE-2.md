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

### Bloc 17 — 01/09 (suite, visuel partageable pour un trophée débloqué, + 3 correctifs successifs — inclut l'ancien bloc 18)
- `historique/bloc-17.md` — retour direct ("et pour les trophées ?" puis "oui, crée un visuel pour les trophées") : jusqu'ici un trophée ne partageait que du texte, jamais de visuel — nouveau `TrophyShareCard.jsx` (doré/ambre, rose en Mode Intime), câblé dans `TrophiesView.jsx` et `ShareModal.jsx`. Vrai bug potentiel trouvé et corrigé AVANT qu'il n'existe en prod (`summaryImageContextKey`, ShareImageContext.jsx). 2 nouveaux fichiers de test, 3 fichiers de test existants mis à jour. Addendum : vrai bug trouvé en PROD (2e trophée capturé quasi vierge) — corrigé (double `requestAnimationFrame` + `sharingTrophyIdRef`), les 2 autres visuels partageables audités (aucun aussi exposé). 2e addendum : audit visuel des 24 trophées, tous corrects. **3e correctif (fusionné depuis l'ancien bloc 18, 2 nouvelles captures — "tu te trompes")** : le bug persistait sur d'AUTRES trophées — diagnostic affiné (fond dégradé qui échoue à se capturer, texte blanc invisible dessus) — corrigé par un reflow forcé + une vérification a posteriori avec nouvelle tentative automatique (taille de fichier PNG mesurée empiriquement, seuil de 150 Ko)

### Bloc 19 — 01/09 (suite, audit des trophées manquants, puis paliers Garmin-style — inclut l'ancien bloc 20)
- `historique/bloc-19.md` — retour direct ("je pense qu'il en manque plein... comme cloner une playlist ou recevoir un compteur de clonage") : audit complet des 24 trophées existants contre toutes les fonctionnalités du code — 6 fonctions instrumentées mais jamais reliées à un trophée. 6 nouveaux trophées ajoutés, câblés à travers 8 fichiers source. 13 nouveaux tests ; 4 des 6 trophées vivent uniquement dans App.jsx (pas de fichier de test dédié pour ce fichier dans ce projet). **2e passe (fusionnée depuis l'ancien bloc 20, retour direct sur les paliers Garmin-style)** : audit des 30 trophées pour repérer les métriques cumulatives à un seul palier — 5 retenues, 10 nouveaux trophées ajoutés (moitié sans changement de code, mécanisme déjà générique ; moitié avec 2 nouveaux flags chacune). 6 nouveaux tests. Bilan complet des métriques retenues ET délibérément écartées présenté à l'utilisateur

### Bloc 21 — 01/09 (suite, généralisation de principes — design des trophées + paliers futurs, puis audit sémantique des icônes — inclut l'ancien bloc 23)
- `historique/bloc-21.md` — retour direct ("vois-tu des principes à généraliser... si oui fais-le") : audit du propre travail du chantier précédent, 1 erreur trouvée (icône 📉 pour "10 imports" suggérant une baisse, corrigée en 🛰️) et 3 principes généralisés — garde-fou permanent d'unicité `id`/`icon` (4 nouveaux tests), convention d'escalade visuelle thématique entre paliers, préférence pour un seuil générique plutôt qu'un flag ad-hoc (`readme/partie-04b.md`, nouveau — 04.md dépassait le seuil). **2e passe (fusionnée depuis l'ancien bloc 23, capture d'écran — "un chiffre '3' pour Premier Pas fait-il sens ?")** : audit sémantique complet des 40 icônes — la famille sessions totales décalée d'un cran (👣🥉🥈🏆 pour 1/5/30/100, au lieu de commencer directement par une médaille bronze), HIIT (💓 au lieu de 📈, qui suggérait l'inverse), Marathonien (🏃 au lieu d'une médaille générique). 2 nouveaux principes généralisés : justesse sémantique littérale d'une icône, garde-fou automatique approximatif de longueur de description (48 caractères, jsdom ne mesure pas de vrai rendu)

### Bloc 22 — 01/09 (suite, descriptions de trophées qui débordent sur 2 lignes)
- `historique/bloc-22.md` — 2 captures d'écran envoyées ("pourquoi les descriptions tiennent pas sur une ligne comme demandé") : 34 descriptions sur 40 raccourcies, après une vraie mesure Playwright (pas une estimation en caractères) qui a révélé un facteur ignoré au 1er essai — la Sidebar (256px, permanente à partir de 768px) réduit bien plus l'espace réel que ne le laissait supposer un harnais isolé sans elle. Cible retenue : 0 débordement à partir de 1024px de largeur de fenêtre réelle (un point mort pathologique à exactement 768px, où la grille passe à 2 colonnes ET la Sidebar apparaît en même temps, rendrait toute description illisible même à 20 caractères — signalé à l'utilisateur comme piste d'amélioration séparée, pas corrigé par du texte). Addendums : texte générique des trophées secrets verrouillés oublié (débordait aussi, corrigé), et clause "pas de liste, la surprise fait partie du jeu" jugée redondante sur question directe — retirée, réglait aussi un débordement du bandeau d'intro

### Bloc 24 — 01/09 (suite, consolidation de l'historique lui-même)
- `historique/bloc-24.md` — retour direct ("depuis le début tu as créé plein de fichiers pour l'historique, sont-ils tous vraiment utiles ?") : audit honnête (oui, plusieurs racontaient LE MÊME fil coupé en plusieurs morceaux) — anciens blocs 18/20/23 fusionnés dans 17/19/21 respectivement (9 fichiers → 6), toutes les références corrigées (`appConfig.js`, cet index). Principe de fusion généralisé et documenté pour l'avenir : vérifier À CHAQUE nouveau bloc s'il prolonge le fil d'un bloc récent plutôt que d'ouvrir un nouveau numéro par réflexe

## Blocs futurs

Le prochain bloc (25) doit suivre la même convention : un ou plusieurs
fichiers `historique/bloc-25x.md`, chacun sous ~13 000 caractères,
la coupure tombant sur une frontière de session/date plutôt qu'un
comptage aveugle de caractères — ajoutés à l'index ci-dessus au moment
de leur création. **Avant d'ouvrir un nouveau numéro**, vérifier s'il ne
prolonge pas plutôt le fil d'un bloc RÉCENT déjà écrit (voir la nouvelle
règle de fusion, `readme/partie-01.md`) — dans ce cas, fusionner dans le
bloc existant plutôt que d'en ouvrir un nouveau.
