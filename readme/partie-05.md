### Vérifier un alignement CSS par le raisonnement seul est risqué — mesurer dès que possible

Actée le 22/08, après le chantier `MiniPlayerBar.jsx`/`GuestModeBar.jsx`
(voir la section dédiée plus bas pour le détail complet) : un
raisonnement THÉORIQUE sur une question de centrage flexbox s'est révélé
FAUX deux fois de suite le même jour, avant qu'une vraie mesure (un
navigateur réel piloté par Playwright, trouvé utilisable via un binaire
déjà en cache dans le bac à sable malgré l'échec habituel du
téléchargement — voir CLAUDE-SANDBOX-VERIFICATION.md §5quinquies) ne
tranche pour de bon. Deux leçons distinctes retenues :
1. **Ne pas re-raisonner une 3e fois dans le vide après 2 échecs** —
   chercher activement un moyen de mesurer (ex. chercher un navigateur
   déjà en cache avec `find` avant de conclure à l'impossibilité) plutôt
   que de refaire le même calcul mental en espérant un résultat
   différent.
2. **Ne jamais reproduire un composant "à la main" pour le tester —
   toujours importer le vrai fichier.** Une 1re mesure basée sur une
   reproduction manuelle des 3 zones "principales" de `MiniPlayerBar.jsx`
   donnait 0px d'écart, faussement rassurant : elle avait tout simplement
   OMIS 2 éléments bien réels du fichier (bouton volume, bouton fermer)
   en les recopiant de mémoire. Une 2e mesure avec le VRAI composant
   importé directement a révélé l'écart réel (46px). Une reproduction
   manuelle ne teste que ce dont on se souvient d'un fichier, jamais ce
   qui y existe vraiment.

### Une "recette" de mise en page recopiée dans plusieurs fichiers dérive — extraire un composant partagé dès le 2e cas

Constat du 22/08 : `MiniPlayerBar.jsx` et `GuestModeBar.jsx` ont accumulé
3 bugs de désalignement DISTINCTS la même session (hauteur forcée sur la
Sidebar, centrage `GuestModeBar` vs `MiniPlayerBar`, centrage interne à
`MiniPlayerBar` lui-même) — pas 3 problèmes indépendants avec 3 causes
différentes, mais 3 symptômes de LA MÊME fragilité : les deux fichiers
recopiaient indépendamment la même "recette" de conteneur
(`h-[70px]` + `max-w-5xl mx-auto` + padding), avec de petites divergences
de détail à chaque copie (`px-4` vs `px-6`, `justify-center` présent ou
non sur le conteneur externe). Une convention maintenue par la mémoire
humaine ("se souvenir de recopier le même motif partout") dérive
inévitablement avec le temps, contrairement à une convention imposée par
la STRUCTURE du code. Extrait en composant partagé
(`BottomBarShell.jsx`, voir la section dédiée plus bas) dès ce 2e cas —
pas besoin d'attendre un 3e ou 4e fichier pour que la duplication devienne
un vrai risque : 2 fichiers qui doivent visuellement s'aligner et
partagent déjà une recette identique suffisent.

### Une classe Tailwind "dépendante" (`flex-col`/`items-*`/`justify-*`) ne fait RIEN sans sa classe "prérequise" (`flex`/`grid`) — invisible à la simple lecture

Actée le 22/08, après le VRAI bug derrière le "3e symptôme" ci-dessus
(centrage interne à `MiniPlayerBar.jsx`/`GuestModeBar.jsx`, voir la
section dédiée plus bas pour le récit complet) : 2 tentatives de
correctif basées sur un raisonnement théorique se sont révélées fausses
avant qu'une vraie mesure (Playwright) ne révèle la cause réelle —
`BottomBarShell.jsx` acceptait un `innerClassName` transmis par chaque
appelant, mais son propre template de base ne posait JAMAIS `flex` —
sans lui, `flex-col`/`items-center` transmis par un appelant n'ont
LITTÉRALEMENT AUCUN EFFET. Rien de "faux" en apparence dans le JSX
final : les classes sont bien là, juste incomplètes d'une façon qu'une
relecture de code ne révèle pas — seul un rendu réel (ou une
vérification automatisée du couplage entre classes) le révèle.

**Généralisable** : toute classe qui ne prend effet que sur un conteneur
`flex`/`grid` (`flex-col`, `flex-row`, `items-*`, `justify-*`,
`content-*`...) doit TOUJOURS être accompagnée de `flex`/`grid`/
`inline-flex`/`inline-grid` sur le MÊME élément — que ce soit dans une
chaîne de classes statique (là, une relecture attentive suffit à le
voir) OU, plus insidieux, quand une chaîne de classes est transmise à un
composant partagé via une prop de personnalisation (`innerClassName`,
`cardClassName`...) : dans ce cas, la classe prérequise peut manquer
soit côté appelant, soit côté composant receveur — le bug se cache dans
l'INTERACTION entre 2 fichiers, jamais visible en lisant l'un des deux
séparément. Garde-fou automatique ajouté
(`tests/flexDependentClassTrap.test.js`, même famille que
`tailwindConcatTrap.test.js`) : scanne toute prop `cardClassName=`
(celle qui reste réellement à risque, voir sa docstring pour pourquoi
`innerClassName` en est exclu) et vérifie qu'une classe dépendante n'y
apparaît jamais sans son prérequis.

## Décisions actées, pas encore implémentées — chantier Pulses/Leaderboard

Suite à l'arrivée de "Running Mode" chez Spotify (juillet 2026) : **pas de pivot**. Le positionnement reste Sport + Mode Intime, on renforce l'existant plutôt que de reconstruire une couche sociale généraliste (feed 24h, avatars, follow) — décision explicitement actée, pas un oubli. Si ça change un jour, ce paragraphe doit changer avec.

Décisions initiales prises avec Claude, puis raffinées via un second avis (Gemini, 02/08) sur deux points précis : les garde-fous anti-corrélation temporelle/réseau du Mode Intime, et la distinction Vague 2/Vague 2bis ci-dessous.

Les règles ci-dessous sont **tranchées avant tout schéma SQL**, précisément pour éviter la situation "on verra à l'implémentation" sur un sujet où le schéma détermine la garantie de confidentialité :

- **Interactions classiques (Sport)** : tout est **full opt-in**, comme le reste de l'app — aucune exception "public par défaut", y compris pour le leaderboard. Cohérent avec `is_profile_public`/`show_sport_stats`/`show_intimate_stats`/`default_playlist_public`, tous `default false` (voir plus haut) — pas de rupture de philosophie.
- **Mode Intime** : fermé par défaut. L'utilisateur peut choisir de partager, mais alors :
  - Il apparaît sous un **pseudonyme anonymisé**, jamais son vrai pseudo/profil.
  - Ce pseudonyme est **stable** (pas généré à la volée à chaque partage) — nécessite une vraie table d'identité dédiée (`ex: intimate_personas`, `intimate_id -> user_id`), RLS verrouillée au propriétaire uniquement, **jamais jointe dans une requête publique**.
  - Généré par un algorithme **indépendant du vrai username** (pas un hash tronqué, pas une variante dérivée) — un pattern reconnaissable casserait l'anonymat aussi sûrement qu'un vrai lien en base.
  - **Leaderboard strictement séparé** de celui du Sport — deux classements distincts, jamais fusionnés ni sommés, même sous forme d'un total caché quelque part (dashboard créateur compris). Objectif : aucun agrégat visible ne mélange jamais intime et non-intime, nulle part.
  - Les pulses reçus sur du contenu intime restent possibles même sans opt-in au leaderboard (envoi anonyme indépendant du choix d'apparaître classé).
  - Si des avatars sont ajoutés un jour : l'avatar de la persona intime ne peut **jamais** être dérivé de façon déterministe du même id que l'avatar réel (même algorithme, même seed) — sinon l'image redevient l'indice qui recolle les deux identités.
  - **Pas d'horodatage précis affiché publiquement** pour une action liée à la persona intime (pas de "il y a 2 minutes") — une fenêtre floue ("cette semaine", "récemment") uniquement. Un horodatage précis permettrait une corrélation temporelle avec l'activité publique du même utilisateur sous son vrai profil (ex: une routine générée à 21h15 sous le vrai profil + une action intime à 21h16 sous la persona = recoupement trivial), même sans aucun lien technique direct entre les deux identités.
  - **Le vrai `user_id` (UUID `auth.users`) ne doit JAMAIS transiter dans un payload API lié à la persona intime**, même si le pseudo affiché à l'écran est bien anonymisé — un utilisateur inspectant l'onglet Network de son navigateur ferait sinon le rapprochement immédiatement. Prévoir une fonction RPC Supabase DÉDIÉE au Mode Intime (même principe que `get_public_profile_summary`/`search_public_profiles`, qui renvoient déjà des résumés construits à la main plutôt que les lignes brutes) — jamais un simple `select *` sur une table jointe à `auth.users`.

Ordre de priorité retenu (voir aussi les passations pour le détail du raisonnement) :
1. ~~UI publique pour les routines — le SQL existe déjà (`is_public`/`is_intimate`), juste l'UI manque.~~ **Fait (02/08)** — voir plus haut, section "État d'avancement".
2. **Renforcement post-hoc** (léger, valorise l'existant) : moteur BPM/structuration (crescendo, fractionné), et approfondissement de l'analyse post-séance déjà en place (`useSessionAnalysis.js` — comparaison de la cadence/FC réelle importée via CSV Garmin/Strava à la courbe de BPM musical cible).
3. ~~Description texte libre sur une playlist publique (aucun risque nouveau, faisable dès maintenant).~~ **Fait (02/08)** — étendu aux routines aussi, voir plus haut, section "État d'avancement".
4. ~~Compteur de sauvegardes/clonages.~~ **Fait (02/08), en attente de confirmation Vercel** — voir plus haut, section "État d'avancement". Décision actée avec l'utilisateur : uniquement un compteur par item, PAS de classement par créateur (ça, c'est le futur chantier "Pulses/Leaderboard" round 2 — la persona intime n'est donc PAS utilisée ici, un simple total ne révèle jamais qui a cloné quoi).
5. Follow — repoussé, c'est la pièce la plus "réseau social" du lot, contredirait la décision "pas de pivot" si avancée trop tôt.

**Vague 2bis — Futur / à l'étude, PAS confondue avec la Vague 2 ci-dessus** : adaptation dynamique en temps réel à la fréquence cardiaque (ex. "monte le tempo si ma FC dépasse 155, ralentis si je sors de Zone 2"), via connexion Web Bluetooth à un capteur/montre pendant l'effort, avec re-séquençage du flux audio en direct. Axe de différenciation réel (Spotify, application de streaming généraliste, n'a structurellement aucune raison de construire une intégration matérielle aussi spécifique) — mais un chantier d'ingénierie d'un tout autre ordre que le point 2 ci-dessus (gestion des déconnexions Bluetooth en pleine course, re-séquençage sans coupure audio, pas juste une comparaison a posteriori). À ne surtout pas sous-estimer en la fondant dans la Vague 2 "légère" — étiquetée à part exprès pour ça.
