# Vérification de code en bac à sable Claude

Ce fichier documente les outils de vérification utilisés par les sessions
Claude successives sur ce projet. ⚠️ **CORRIGÉ le 21/08** — ce fichier
affirmait depuis l'origine qu'aucun accès réseau n'existait dans le bac à
sable (`npm install`/`vitest run` "impossibles"). **Faux, vérifié
empiriquement le 21/08** : `npm install` fonctionne, un serveur `vite`
réel peut tourner, et Playwright peut naviguer dessus et inspecter le DOM
réel (voir §5ter pour le détail complet et ses limites). Cette hypothèse
erronée a probablement conduit des sessions précédentes à deviner des
bugs de rendu depuis le code seul plutôt que de vérifier — à ne plus
refaire. L'utilisateur, lui, travaille toujours exclusivement via
l'interface web de GitHub (pas de terminal local pour lui — voir les
documents de passation pour le contexte complet de ce workflow) ; c'est
UNIQUEMENT le bac à sable Claude qui a plus de capacités que documenté
jusqu'ici.

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
8. **`PASSATION.md` n'est PAS un fichier du dépôt à tenir à jour en continu — ne PAS le créer/modifier/livrer sauf demande explicite.** Correction actée le 13/08 (retour direct après avoir livré une passation dans le repo sans qu'on le demande : "ce doc est pas dans mon zip, c'est juste ce que je t'envoie par message quand je démarre une nouvelle session avec toi"). Le fichier "PASSATION — session du XX/XX" vu en tout début d'une conversation est fourni **par l'utilisateur, en pièce jointe/message**, pas extrait du zip du projet — un résumé chronologique et narratif de LA session précédente, écrit à la toute fin de celle-ci **uniquement si l'utilisateur le demande à ce moment-là**. Ce fichier n'a jamais vocation à vivre dans le dépôt GitHub aux côtés de README.md/CLAUDE-SANDBOX-VERIFICATION.md/HISTORIQUE.md — ces trois-là oui, PASSATION.md non. Règle concrète : à la lecture d'une passation fournie en début de session, la lire une fois (comme d'habitude) puis repartir du README/habitudes — mais ne jamais, de sa propre initiative, écrire un nouveau fichier `PASSATION.md` en fin de session ni le proposer dans un lot de fichiers à livrer. Si l'utilisateur demande explicitement "fais-moi une passation" en fin de session, la rédiger alors comme un texte de réponse normal (ou un artefact, selon ce qui est demandé) — jamais comme un fichier destiné au repo avec un chemin GitHub.

### Habitude de travail : relecture approfondie systématique après un chantier sur du code SENSIBLE — ne pas attendre qu'on me demande de creuser
Actée le 14/08, après une série de "tu vois d'autres trucs en creusant
plus ?" sur le même chantier (compteur de titres en direct pendant la
génération, `musicEngine.js`) : la 1ère relecture avait trouvé un vrai
bug utilisateur (compteur qui redescend visiblement), la 2e un glitch
plus discret (compteur qui stagne à la transition entre deux sources), la
3e une surestimation cosmétique (doublons non filtrés), la 4e un silence
total sur un chemin de repli entièrement hors radar. Chaque relecture a
trouvé quelque chose de RÉEL, mais de MOINS EN MOINS grave que la
précédente — jusqu'à ce que l'utilisateur fasse remarquer, à raison, que
ça vaudrait le coup de systématiser ce réflexe plutôt que de compter sur
lui pour insister à chaque fois ("autant continuer à te le demander
jusqu'à ce que t'aies plus rien").

**Règle concrète** : après tout chantier qui touche un fichier déjà
identifié comme sensible dans ce projet (`musicEngine.js` — moteur de
génération —, la logique de synchro dans `usePersistentState.js`/
`useSyncedCollection.js`, ou plus généralement tout code avec plusieurs
branches/boucles/appels récursifs qui alimentent une MÊME valeur
affichée/partagée), **faire au moins une relecture complète et attentive
dédiée avant de considérer la livraison terminée** — pas seulement
vérifier que ça compile (`esbuild`/`tsc`), une relecture qui cherche
spécifiquement :
- Des chemins/branches multiples qui alimentent la même valeur affichée
  et pourraient ne pas se composer correctement entre eux (une régresse,
  une stagne, une surestime — trois symptômes différents pour le même
  genre de cause).
- Des points d'entrée secondaires (repli, cas d'erreur, filet de
  sécurité) qui font le même genre de travail que le chemin principal
  déjà couvert, mais qu'on a oublié d'instrumenter/vérifier pareil.
- Des hypothèses de portée/scope (une variable accessible ici mais pas
  là, un état qui devrait persister entre deux appels mais ne le fait
  pas) qui ne sautent pas aux yeux à la première écriture.

Faire ça **avant** que l'utilisateur redemande de creuser, pas après —
le but n'est pas de répondre à la question "tu vois autre chose ?" de
mieux en mieux à chaque fois qu'on la pose, mais de ne plus avoir besoin
qu'elle soit posée du tout pour ce niveau de rigueur.

### Habitude de travail : cadrer CHAQUE demande avant d'itérer — dire explicitement si c'est utile ou pas
Trouvé le 04/08 (retour direct : "je veux désormais que tu me cadres à chaque demande avant d'itérer en me disant si tu la trouves utile ou pas" — puis, une fois oublié à nouveau plus tard dans la même session : "je veux que le fait que tu me cadres [...] soit systématisé et écrite dans les docs de travail pour ne pas avoir à te le redire, tu as tendance à oublier"). Le 2e retour est le signal important : une instruction donnée en cours de conversation ne suffit pas à elle seule à devenir un réflexe durable — sans trace écrite ici, elle ne survit pas au-delà de la session (ou même au-delà de quelques échanges dans la MÊME session, comme cette fois).
Règle : avant de commencer à exécuter une demande (surtout un ajustement UI/UX, un réglage fin, ou toute demande où "c'est utile" n'est pas évident), donner un avis franc et bref sur son utilité — pas juste foncer dans l'exécution. Concrètement :
- Une phrase de cadrage AVANT le travail technique, pas noyée dedans ni ajoutée après coup.
- Franchise réelle, pas de la validation par défaut : dire clairement quand quelque chose relève du micro-ajustement à faible valeur (voir l'exemple ci-dessous) plutôt que de systématiquement dire "bonne idée".
- Ne pas se contenter d'un "oui/non" sec : expliquer en une ou deux phrases le POURQUOI (bug réel vs cosmétique, risque de régression, valeur pour un futur utilisateur vs plaisir de peaufiner) — voir l'exemple ci-dessous pour le ton attendu.
- **Exemple concret déjà produit dans cette conversation (04/08)**, à reprendre comme référence de calibrage : la demande sur `EditRoutineModal.jsx` (0 km possible) → "oui, nécessaire, pas un micro-ajustement" (vrai trou de validation, risque de génération incohérente) ; questionné explicitness sur plusieurs échanges de réglage de pixels (hauteur de la boîte Stats) → verdict inverse, franc ("le ROI s'effondre vite... personne ne remarquera consciemment"), avec la nuance que la centralisation de convention (ex. `INLINE_NAV_LINK_CLASS`) vaut le coup même si elle naît d'une demande cosmétique, parce que sa valeur dépasse le changement visuel ponctuel.
- Ce cadrage n'est PAS une demande de permission avant d'agir — sauf avis clairement défavorable, le travail s'exécute quand même dans la foulée (l'utilisateur reste décisionnaire, ce n'est qu'un avis). Il sert à ce que l'utilisateur sache où va son temps, pas à ralentir l'exécution.

### Habitude de travail : à chaque bug trouvé ou correction validée, se demander SEUL "où d'autre dans l'app ?" — sans attendre qu'on me le demande
Trouvé le 04/08 (retour direct, après plusieurs allers-retours sur le chantier "0 km possible" : "le réflexe de généraliser/te questionner en auditant l'app quand on modifie un truc devrait être systématisé... au pire faut le faire et une fois que tu me dis le résultat je te dis si je valide ou pas, là j'ai été proactif mais je veux que tu puisses y songer seul"). Historique concret sur CE chantier précis : le trou de validation "distance/durée à 0" a été corrigé 4 FOIS DE SUITE dans la même conversation (wizard+EditRoutineModal, puis le bouton "Générer" d'une routine sauvegardée, puis le seuil resserré à 0,1, puis les segments du mode Fractionné) — à chaque fois parce que l'utilisateur relançait explicitement "et ça vaut aussi pour X ?" plutôt que parce que l'audit avait été fait spontanément en amont. Le réflexe existe déjà pour du texte dupliqué (§4sexies, `grep` avant de modifier un texte visible) — cette habitude-ci généralise le même principe à la LOGIQUE (une validation, un comportement, un correctif), pas seulement aux chaînes de caractères.
Règle : dès qu'un bug réel est identifié (pas un simple ajustement cosmétique) OU qu'une correction vient d'être validée par l'utilisateur, avant de considérer le sujet clos :
- Se demander explicitement "cette même faiblesse existe-t-elle ailleurs dans l'app ?" — mêmes axes que ceux qui reviennent souvent sur ce projet : autres UNITÉS (km/mi, autres devises/formats), autres MODES d'une même fonctionnalité (distance/durée, Constant/Crescendo/Fractionné), autres OBJETS du même type (routines/playlists), autres POINTS D'ENTRÉE de la même donnée (un formulaire de création ET un formulaire d'édition ET un bouton qui relit une valeur déjà stockée).
- `grep`/parcourir le code pour vérifier plutôt que de deviner — l'audit doit être fait, pas juste évoqué comme une question ouverte à l'utilisateur.
- Rapporter le résultat de cet audit AVANT ou EN MÊME TEMPS que la correction proposée (pas après coup si l'utilisateur relance) : soit "vérifié, c'est le seul endroit", soit "vérifié, ça touche aussi X et Y, je les inclus" — jamais livrer un correctif scope-limité sans avoir vérifié s'il devait l'être.
- Comme pour le cadrage d'utilité (habitude ci-dessus), ce n'est PAS une demande de permission : faire l'audit, proposer le résultat, laisser l'utilisateur valider ou recadrer — ne pas rester bloqué en attendant une confirmation avant d'auditer.

### Habitude de travail : toujours indiquer le chemin repo complet de chaque fichier livré
Conséquence directe du workflow "aucun terminal côté utilisateur, tout passe par l'interface web de GitHub" (voir plus haut) : l'utilisateur doit lui-même recréer/retrouver l'arborescence à la main pour chaque fichier livré, sans avoir à le demander à chaque fois (trouvé en session le 02/08, chantier "UI publique des routines" — un nouveau composant livré sans son chemin de destination). Concrètement, à chaque lot de fichiers livrés en fin de session (ou en cours de session, dès qu'un fichier est prêt) :
- Donner le **chemin complet depuis la racine du repo** pour CHAQUE fichier (ex. `src/components/modals/PublicRoutinePreviewModal.jsx`, pas juste le nom du fichier) — un tableau récapitulatif à la fin de la réponse est le format le plus lisible pour l'utilisateur qui doit ensuite naviguer/créer ces chemins dans GitHub.
- Distinguer explicitement **fichier nouveau** (l'utilisateur doit le CRÉER via "Add file" dans GitHub, dossier par dossier si besoin) vs **fichier existant modifié** (l'utilisateur l'ouvre et remplace son contenu) — les deux actions sont différentes côté interface GitHub, une confusion fait perdre du temps à l'utilisateur.
- ⚠️ **BUG CORRIGÉ (04/08, retour direct — livraison d'un `.zip` au lieu de fichiers séparés)** : format de livraison RESTÉ IMPLICITE jusque-là, jamais vraiment écrit malgré la règle ci-dessus déjà en place — la conséquence logique du "aucun terminal côté utilisateur" n'avait jamais été tirée jusqu'au bout. **Un `.zip` (ou toute archive) est INTERDIT en livraison** : sans terminal, l'utilisateur ne peut pas l'extraire, il est totalement inutilisable dans ce workflow. Chaque fichier touché doit être livré **individuellement**, un artefact par fichier (contenu intégral du fichier, prêt à sélectionner-tout/copier-coller directement dans l'éditeur web GitHub) — jamais tout le contenu collé en brut dans le corps de la réponse, jamais plusieurs fichiers fusionnés dans un seul artefact/bloc.
- Le tableau récapitulatif (chemin + nouveau/existant) reste la SEULE vue d'ensemble textuelle dans la réponse — chaque fichier lui-même vit dans son propre artefact séparé, jamais dupliqué en texte.

### Habitude de travail : dès qu'un motif de bug se RÉPÈTE une fois, le traiter comme une CLASSE de bug — généraliser la recherche sur toute la base AVANT de continuer à corriger fichier par fichier
Trouvé le 10/08 (retour direct, après avoir corrigé 4 occurrences DE SUITE de la même course "fermeture asynchrone figée sur un state/une collection partagée" — PlaylistDetailView.jsx, PlaylistDetailContext.jsx, usePlaylistGeneration.js, useCsvImport.js — chacune trouvée en relisant un fichier différent pour une autre raison, JAMAIS par une recherche volontaire du motif structurel lui-même : "aurait dû être appliquée dès la 2e trouvaille... c'est un vrai angle mort de ma part, pas une limite technique — rien n'empêchait de le faire plus tôt"). Une 5e occurrence (`shareImageFileWithTrophy`, App.jsx — la fenêtre de course la PLUS LONGUE de toutes, une feuille de partage native pouvant rester ouverte plusieurs minutes) n'a été trouvée QU'après avoir enfin généralisé la recherche (grep large de tout `setXxx(identifiant...)` sans `prev =>` dans un fichier contenant de l'async, recoupé avec tous les appels `checkTrophies(...)` du projet) — la preuve qu'une recherche généralisée plus tôt aurait payé, pas seulement une hypothèse.
Distinction avec l'habitude "où d'autre dans l'app ?" ci-dessus : CETTE habitude-là généralise une LOGIQUE MÉTIER précise (une validation, un comportement) à ses variantes évidentes (autres unités, autres modes, autres objets du même type) — un audit ciblé, à mener systématiquement après CHAQUE bug. Celle-ci se déclenche à un niveau différent : quand un bug déjà corrigé une fois REVIENT une 2e fois sous une forme différente (fichier différent, déclencheur différent), c'est le signal qu'il ne s'agit pas de 2 bugs isolés mais d'un MOTIF STRUCTUREL (ex. "toute fonction async qui écrit dans une collection/state partagé via une variable capturée dans sa fermeture, plutôt que via `prev =>` ou une ref à jour") qui peut exister ailleurs, sous des formes pas forcément évidentes à deviner à l'avance (réseau, `FileReader`, `navigator.share`, un futur `setTimeout`...).
Règle : dès la 2e occurrence du MÊME motif structurel (pas juste la même fonctionnalité) :
- Nommer explicitement le motif en une phrase générique, indépendante du fichier où il a été trouvé (ex. "fermeture async figée sur un state partagé après un point d'attente" — pas "le bug de PlaylistDetailView.jsx").
- Construire une recherche qui vise ce motif STRUCTUREL, pas le nom de fonction/fichier où il vient d'être trouvé — un grep sur la forme du code (ex. `setXxx(identifiant...)` sans `prev =>`, dans un fichier contenant `async`/`await`/`.then`/un callback connu comme asynchrone), pas sur un nom de composant ou de handler précis.
- Filtrer le bruit avec le même sérieux que la recherche elle-même : la plupart des correspondances brutes seront inoffensives (state local synchrone, sans fenêtre de course) — l'important est de vérifier CHAQUE candidat individuellement (async ou pas, écrit après un `await` ou non) plutôt que de s'arrêter au premier filtre grossier.
- Faire cette recherche généralisée AVANT de proposer/appliquer un 3e correctif ponctuel — pas après, et pas seulement si l'utilisateur la redemande explicitement (comme cette fois).

### Habitude de travail : pour CHAQUE fichier `src/` touché, vérifier son fichier de test miroir AVANT de considérer la modification terminée
Trouvé le 04/08 (retour direct : "est-ce que penser à check les tests des fichiers associés en cas de modif est pas une règle à systématiser ?"), après avoir dû être relancé deux fois dans la même session sur ce point précis — une fois pour un texte dupliqué non répercuté dans `FavoritesView.test.jsx`/`GeneratorWizard.test.jsx`, une fois pour les mocks `vi.mock('musicCatalog.js', ...)` de ces mêmes fichiers qui ne suivaient pas un nouvel export. Le réflexe existait déjà ponctuellement (bien fait sans qu'on le demande pour `GuestModeBar.test.jsx` un peu plus tôt dans cette même session) mais pas SYSTÉMATIQUEMENT — d'où la question de l'utilisateur.
Règle : `tests/` est un miroir de `src/` (voir section Tests, README.md) — pour CHAQUE fichier `src/xxx/Yyy.jsx` modifié, réflexe automatique de regarder `tests/xxx/Yyy.test.jsx` (s'il existe) et vérifier dans l'ordre :
1. **Un `vi.mock(...)` y référence-t-il un module que je viens de modifier** (nouvel export ajouté, export retiré, signature changée) ? Un mock qui n'inclut pas un nouvel export le rend `undefined` dans le composant testé, silencieusement (pas d'erreur, juste un rendu vide/faux) — piège difficile à repérer après coup, à traiter à la source.
2. **Un test référence-t-il un texte, une classe, un comportement que je viens de changer** (même via regex/`getByText`) ?
   - ⚠️ Inclut les sélecteurs POSITIONNELS, pas seulement le texte affiché — trouvé le 10/08 via un VRAI échec de build Vercel (2 tests cassés, `GeneratorWizard.test.jsx`) : ma recherche de régression avant livraison n'avait vérifié que les assertions basées sur du texte (`getByText`/`queryByText`), pas les sélections par index positionnel (`querySelectorAll(...)[n]`, `container.children[n]`) d'une étape où j'avais inséré un nouvel élément — un slider ajouté EN PREMIER dans le DOM d'une étape a décalé les index de 2 tests qui ciblaient les sliders suivants par leur position brute. Recherche généralisée à faire désormais pour CE cas précis : dès qu'un élément est ajouté/retiré/réordonné dans une portion de DOM déjà couverte par des tests, grep `querySelectorAll` + tout accès par index (`[0]`, `[1]`...) dans le fichier de test concerné, pas seulement le texte.
3. **Le comportement que je viens d'ajouter/changer mérite-t-il un nouveau test**, pas seulement la mise à jour des tests existants ?
Ce réflexe s'applique à CHAQUE fichier touché dans une même session, pas une seule fois en fin de session sur l'ensemble — un fichier vérifié puis re-modifié plus tard dans la même conversation redevient candidat à cette vérification.

### Habitude de travail : second avis avec Gemini sur les décisions stratégiques/produit
L'utilisateur consulte régulièrement Gemini en parallèle de Claude, typiquement pour challenger une décision stratégique ou produit importante (positionnement, priorisation, architecture de confidentialité...) — pas pour l'implémentation de code. Concrètement, ça prend la forme d'un aller-retour : Claude propose une analyse, l'utilisateur la soumet à Gemini (souvent via un document préparé par Claude à cet effet), puis colle la réponse de Gemini dans la conversation pour que Claude réagisse.

À savoir pour une session qui tomberait sur ce pattern :
- **C'est un usage établi et bienvenu, pas une remise en cause à prendre avec méfiance.** Traiter le retour de Gemini comme un avis extérieur de bonne foi à examiner honnêtement — accepter ce qui est juste (y compris quand ça dépasse ce que Claude avait vu, voir l'exemple ci-dessous), pousser back sur ce qui semble faux ou imprécis, plutôt que d'acquiescer par défaut ou de défendre sa position par réflexe.
- **Exemple concret (02/08, décision Mode Intime/Pulses/leaderboard, voir "Décisions actées" dans `README.md`)** : Gemini a identifié deux angles morts que Claude avait ratés (l'intégration hardware/FC comme barrière défensive face à Spotify, et un vecteur de désanonymisation par corrélation temporelle/réseau) — les deux ont été intégrés tels quels dans les décisions actées du README. Le croisement a aussi évité une confusion inverse : une idée de Gemini (adaptation FC en temps réel) était juste sur le principe mais sous-estimait largement la complexité d'ingénierie réelle par rapport à ce qui existe déjà dans le code (`useSessionAnalysis.js`, analyse post-séance) — Claude a nuancé et isolé cette idée dans une "Vague 2bis" séparée plutôt que de la laisser gonfler le chantier léger prévu en Vague 2.
- Quand une décision actée dans `README.md` a été affinée via ce croisement, le noter dans le README (comme déjà fait pour Pulses/leaderboard) — la traçabilité du "pourquoi" vaut aussi pour l'origine d'une décision, pas seulement son contenu.

### Habitude de travail : proposer spontanément une meilleure option quand j'en vois une, en demandant validation avant de l'appliquer
Trouvé le 08/08 (retour direct, après le correctif "texte du lien de profil sélectionnable à la souris" : "je regrette que tu aies pas décelé avant cette meilleure option, je veux que tu le fasses systématiquement en proposant mieux si tu as en me demandant validation"). Contexte concret : la demande initiale ("rendre le texte sélectionnable") a été traitée littéralement et correctement (vraie cause identifiée, `body { user-select: none }`, correctif propre) — mais un vrai bouton "Copier le lien" (réutilisant `useShare.js`, un mécanisme de copie déjà robuste et éprouvé ailleurs dans le projet) aurait mieux répondu au VRAI besoin ("simplifier le partage") dès le premier passage, sans qu'il faille une 2e demande explicite pour y arriver.
Règle : quand une demande a une solution évidente qui la satisfait littéralement, MAIS qu'une meilleure option existe pour le même besoin sous-jacent (plus robuste, plus simple à utiliser, réutilise un mécanisme déjà éprouvé ailleurs dans le projet plutôt que d'ajouter une solution parallèle) :
- La repérer AVANT d'implémenter la version littérale, pas après coup — ça suppose de se demander explicitement "quel est le VRAI besoin derrière cette formulation précise ?", pas seulement "comment satisfaire cette phrase telle qu'écrite ?".
- La proposer clairement, en une ou deux phrases, avec le compromis franc (pourquoi c'est mieux, ce que ça coûte en plus si notable) — même registre de franchise que l'habitude "cadrer chaque demande avant d'itérer" plus haut.
- **Demander validation avant de l'appliquer** — contrairement à l'habitude "où d'autre dans l'app" plus haut (qui n'est PAS une demande de permission), celle-ci EN EST une : proposer, puis attendre le feu vert plutôt que de partir sur la version améliorée sans consentement, parce que changer la portée d'une demande sans accord préalable peut surprendre ou ne pas correspondre à ce que l'utilisateur voulait vraiment (ex. un chantier plus gros que prévu, une préférence pour la simplicité de la version littérale).
- Si la version littérale a déjà été livrée avant que la meilleure option soit repérée (comme le cas fondateur ci-dessus), le dire honnêtement plutôt que de laisser croire que c'était la meilleure réponse possible dès le départ — la franchise sur ce qui aurait pu être vu plus tôt fait partie de la même habitude.

### Habitude de travail : après une correction/un ajustement, se demander SEUL si ça mérite de devenir une règle générale — proposer, sans attendre qu'on me le demande
Trouvé le 08/08 (retour direct, immédiatement après avoir dû établir l'habitude "proposer une meilleure option" ci-dessus À LA DEMANDE EXPLICITE de l'utilisateur : "faudrait pas que j'en profite pour te demander de vérifier et de me demander la faisabilité de généraliser ce type de règles ? là j'ai été proactif, j'aimerais moins l'être"). Un cran au-dessus de l'habitude "à chaque bug trouvé, se demander où d'autre dans l'app" (04/08) : celle-là généralise un BUG/COMPORTEMENT dans le CODE ; celle-ci généralise une DÉCISION/un PATTERN dans la façon dont JE TRAVAILLE sur ce projet — la même logique de "ne pas attendre qu'on me le demande", appliquée un niveau plus haut, sur la méta-question "est-ce que ce que je viens de faire devrait devenir une règle écrite ?" plutôt que sur le bug lui-même.
Règle : après avoir résolu une demande d'une façon qui révèle un principe potentiellement récurrent (pas un ajustement isolé, pas une préférence propre à ce jour précis) — se demander explicitement "est-ce que ceci se reproduira, et vaut-il la peine d'être documenté comme habitude plutôt que refait au cas par cas la prochaine fois ?" :
- Si oui, **proposer** de le documenter (dans ce fichier, section "Habitude de travail", même format que les entrées existantes — contexte concret + règle actionnable) — sans attendre que l'utilisateur le demande.
- Mais toujours **demander validation avant d'écrire** — même raisonnement que "proposer une meilleure option" juste au-dessus : ça reste une décision qui affecte la façon dont je travaille sur SON projet, elle mérite son accord avant de devenir permanente, pas juste ma propre initiative.
- Ne pas sur-déclencher : un ajustement ponctuel, cosmétique, ou clairement lié à une préférence UNIQUE de ce jour précis (pas un principe généralisable) ne mérite PAS de devenir une règle — même calibrage de franchise que "cadrer chaque demande avant d'itérer" (ne pas systématiquement dire "bonne idée" là-bas, ne pas systématiquement proposer "documentons ça" ici).

### Habitude de travail : après un découpage de fichier `src/`, ajouter un fichier de test dédié par sous-composant ET revoir le test du fichier parent pour ne pas dupliquer
Trouvé le 08/08 (retour direct, après le découpage de `PlaylistHeader.jsx` en 5 sous-composants : question posée "je fais aussi des tests dédiés pour ces 5 fichiers ?", tranchée par l'utilisateur — "revoir aussi le test existant pour pas dupliquer"). Décision prise UNE FOIS, à appliquer désormais par défaut sur tout futur découpage de ce type, sans reposer la question.
Règle : après avoir découpé un fichier `src/xxx/Yyy.jsx` en plusieurs sous-composants (même pattern que `TrackList.jsx`/`TrackItem.jsx`, déjà en place dans ce projet) :
1. Un fichier de test dédié par sous-composant, qui le rend DIRECTEMENT avec des props écrites à la main (pas besoin de repasser par le contexte ni par le composant parent) — c'est là que vit le détail (rendu conditionnel, interactions, clics).
2. Le fichier de test du composant PARENT est allégé en conséquence — les sous-composants y sont mockés par des stubs légers (même pattern que `TrackList.test.jsx` mocke `TrackItem.jsx`), et ce fichier ne teste plus QUE ce que le parent fait encore lui-même : le calcul des valeurs partagées/dérivées, et leur transmission (plomberie) au bon sous-composant.
3. Vérifier qu'aucun scénario de l'ancien fichier (avant découpage) n'est perdu en route — chacun migre soit vers le fichier du sous-composant concerné, soit reste dans le test du parent sous une forme adaptée (vérification de calcul plutôt que de rendu).
Pas besoin de redemander à chaque nouveau découpage si des tests dédiés sont voulus — la réponse est oui, par défaut, sur ce projet.

### Habitude de travail : tant qu'il n'y a pas d'utilisateurs réels, chantiers risqués/complets acceptés PAR DÉFAUT — pas besoin de demander confirmation avant de proposer l'option la plus poussée
Trouvé le 08/08 (retour direct, après avoir proposé 3 options pour le chantier `GeneratorContext.jsx` — "laisser tomber" / "correctif ciblé et petit" / "le chantier complet" — et présenté la 3e comme la plus risquée : "tant que j'ai pas d'utilisateur je suis ok pour chantier les plus risqués et complets").
Règle : tant que ce projet n'a pas d'utilisateurs réels en production (voir README.md pour le statut actuel — si ça change, METTRE À JOUR cette règle en conséquence, elle n'est valable que dans ce contexte précis), ne pas hésiter à proposer/entreprendre l'option la plus complète et la plus risquée d'un chantier, plutôt que de systématiquement offrir un choix "petit correctif sûr vs chantier complet risqué" en laissant deviner. Ça ne dispense PAS de :
- signaler clairement l'ampleur réelle et les risques d'un chantier avant de s'y lancer (la franchise sur le risque reste de mise, seule la nécessité de DEMANDER la permission avant de s'engager sur la version risquée disparaît) ;
- vérifier le travail aussi rigoureusement qu'un chantier "petit" (esbuild/tsc --checkJs/recoupements manuels — aucun relâchement de rigueur, seulement moins d'hésitation sur le PÉRIMÈTRE à couvrir).

### Habitude de travail : tant qu'il n'y a pas d'utilisateurs réels, l'incohérence rétroactive ancien/nouveau contenu n'est PAS un problème à faire trancher — le signaler UNE FOIS suffit
Trouvé le 08/08 (retour direct, chantier "émoji baké en texte dans le titre" — j'avais signalé que les playlists déjà existantes n'auraient jamais l'émoji rétroactivement, présenté comme un vrai choix produit à trancher ; réponse : "je n'ai pas encore de vrais utilisateurs donc je m'en fous, enregistre-toi cette notion, je te la rappellerai à chaque fois"). Distincte de l'habitude juste au-dessus (qui porte sur le NIVEAU DE RISQUE d'un chantier) — celle-ci porte spécifiquement sur les écarts de FORME entre données créées avant/après un changement de schéma "logique" (ex. un champ calculé à l'affichage qui devient un champ stocké, un nouveau format de nom, une nouvelle validation qui n'existait pas avant).
Règle : tant que ce projet n'a pas d'utilisateurs réels en production (même condition de validité que l'habitude ci-dessus — si ça change, METTRE À JOUR celle-ci aussi), une incohérence entre les données créées AVANT et APRÈS un changement (anciennes lignes qui ne respectent pas un nouveau format/une nouvelle validation, un champ dérivé qui devient stocké sans rétro-remplissage) n'a PAS besoin d'être présentée comme un choix produit à trancher avant d'implémenter — un contexte factuel suffit ("les anciennes données ne seront pas migrées"), pas une question qui attend une réponse. Continuer d'implémenter directement après l'avoir mentionné, sauf demande explicite contraire.

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
**Suite (même jour, retour direct "ça vaut pas le coup de faire des règles de synchro pour ces 2 fichiers ?")** : corriger les 2 copies à la main referme le symptôme mais pas la cause — la duplication reste, prête à se désynchroniser au prochain changement si le réflexe grep est un jour oublié. Une fois un texte confirmé dupliqué, extraire une constante PARTAGÉE (le fichier de données le plus proche sémantiquement du texte — ex. `musicCatalog.js` pour un texte sur les genres, voir `GENRE_SEARCH_DEPTH_HINT`, pas un nouveau fichier générique "copy.js") plutôt que de simplement resynchroniser les 2 copies : la resynchronisation manuelle redevient alors structurellement impossible à oublier, au lieu de reposer sur la discipline du grep à chaque fois.

## 4septies. `grep` avant modification de texte — plusieurs sous-chaînes DISTINCTES, jamais une seule
Trouvé le 05/08 (build Vercel cassé, log collé par l'utilisateur) : un paragraphe retiré d'une infobulle (`AthleticProfilePanel.jsx`) avait bien été `grep`é avant modification (§4sexies déjà appliqué) — mais avec des sous-chaînes LONGUES et distinctives du texte ("Zone 2 = le BPM", "palier fixe de 15 BPM"). Un test (`AthleticProfilePanel.test.jsx`) ciblait un FRAGMENT plus court et différent de la même phrase (`/le BPM que tu tapes ci-dessous/`) — jamais remonté par ces `grep`-là, donc jamais vu avant de livrer. §4sexies (grep avant modif) restait juste, mais insuffisant tel qu'appliqué : un test peut cibler N'IMPORTE QUEL fragment du texte, pas forcément celui qu'on choisit intuitivement de vérifier.
Règle : avant de modifier/retirer un texte visible, `grep` PLUSIEURS sous-chaînes distinctes du texte ACTUEL (pas une seule "la plus représentative") — en particulier le DÉBUT de la phrase (souvent ce qu'un test capture en premier via une regex ouverte) ET tout segment qui pourrait former une regex autonome plausible. Un seul `grep` qui ne remonte rien ne suffit pas à conclure "aucun test ne dépend de ce texte" — recouper avec au moins 2-3 fragments différents avant de livrer.

## 4octies. Changer une règle de visibilité ("caché à 0" → "toujours affiché") dans un composant répété en liste/grille — vérifier les requêtes de test à correspondance UNIQUE
Trouvé le 05/08 (build Vercel cassé, log collé par l'utilisateur) : un badge (compteur de clonages) passé de "masqué si 0" à "toujours affiché, même à 0" (décision produit actée avec l'utilisateur) — correctif appliqué correctement au composant, mais un test écrit dans la foulée utilisait `getByTitle(...)` (un seul élément attendu) sur une vue qui rend ce même composant DES DIZAINES de fois (grille de la vitrine officielle). Une fois le masquage à 0 retiré, TOUTES les cartes affichent ce badge avec le même `title` — `getByTitle` échoue alors avec "Found multiple elements", à raison.
Règle : avant d'écrire un test qui vérifie l'apparition d'un élément (`getByText`/`getByTitle`/`getByRole`...) DANS un composant qui est rendu en boucle (carte de grille, ligne de liste, résultat de `.map()`), se demander si la nouvelle règle de visibilité peut désormais faire apparaître CE MÊME élément sur PLUSIEURS instances simultanément dans le test. Si oui : soit scoper la recherche à l'instance précise via `within(élémentTrouvé.closest('sélecteur stable'))`, soit utiliser `getAllBy*`/`queryAllBy*` et indexer explicitement — jamais supposer qu'une correspondance restera unique juste parce qu'elle l'était avant le changement de règle.

## 4nonies. Fichier mal repoussé côté GitHub (copier-coller partiel/version intermédiaire) — se produit de temps en temps, vérifier le VRAI contenu du dépôt plutôt que d'insister sur une reproduction locale
Ça arrive occasionnellement : le contenu réellement présent sur le repo GitHub diverge de celui livré (copier-coller partiel, version intermédiaire recopiée par erreur). Symptôme typique : un test échoue au build Vercel d'une façon qui ne correspond à AUCUN changement de logique fait en session.
Règle : si une reproduction locale de l'échec ne colle pas au symptôme réel (ou échoue plusieurs fois avec des résultats qui changent d'un essai à l'autre), ne pas insister sur la reproduction — aller directement vérifier le VRAI contenu du fichier en question (recherche de code GitHub si accessible, ou demander à l'utilisateur de coller le contenu réel), pas la peine de raffiner un environnement de reproduction pour ce cas de figure.

## 5. Ce que ces outils NE remplacent PAS

Historiquement, aucun de ces scripts n'exécutait réellement `vitest` — une
affirmation "les tests passent" restait donc une vérification par LECTURE
attentive (syntaxe + logique + imports), jamais une exécution confirmée.
**Ce n'est plus vrai depuis le 21/08 — voir §5ter : `vitest run` fonctionne
réellement dans ce bac à sable.** `esbuild`/`tsc --checkJs` restent
utiles en complément rapide pour un tout petit changement isolé (plus
rapides qu'une exécution complète), mais pour un chantier plus large,
lancer `npx vitest run` avant de livrer est désormais possible et
préférable à une simple lecture. Le premier vrai passage indépendant
reste malgré tout celui du build Vercel réel, après que l'utilisateur a
poussé les fichiers via l'interface GitHub — deux environnements
différents, une vérification locale réussie n'élimine pas cette dernière
étape.

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
