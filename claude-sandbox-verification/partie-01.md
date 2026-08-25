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
7. **Mettre à jour `README.md` avant de conclure** : (a) si une décision d'architecture a été touchée (voir la section précédente) ; (b) **systématiquement si un chantier a démarré, avancé ou terminé** — la section "🚧 État d'avancement" en tête du README doit toujours refléter où en est réellement le projet, sinon une session future repart à l'aveugle en croyant qu'aucun chantier n'est en cours. ⚠️ **Règle absolue depuis le 25/08 : cette section ne contient QUE l'état courant, jamais l'historique clos.** Le récit complet part dans `historique/bloc-NNx.md` comme d'habitude, mais la version condensée de la session précédente est SUPPRIMÉE d'"État d'avancement" au moment d'y écrire la nouvelle — jamais empilée à côté. Un empilement non purgé de ce genre (5 sous-sections "Historique détaillé" jamais nettoyées) a fait grossir le README jusqu'à dépasser le seuil de lecture d'un coup et forcer sa restructuration en plusieurs fichiers (voir `README.md` en tête pour le détail) — ne pas reproduire.
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
