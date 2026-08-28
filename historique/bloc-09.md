# TempoFit — Historique détaillé, bloc 9 (25-27/08 : audit exhaustif contextes/modales/vues, biais favoris/genre dans le moteur musical, lien Deezer externe, recherche & filtres portés sur Mes Playlists, classement de genre unifié)

Session longue, en plusieurs journées. Deux moitiés bien distinctes : une
première moitié d'audit systématique (aucun bug de code trouvé nulle
part, sauf 2 exceptions notables), une deuxième moitié de retours directs
sur le vrai comportement du moteur musical en usage réel — nettement plus
fructueuse en corrections concrètes.

## Partie 1 — Audit exhaustif (documentation puis code)

### Restructuration documentation
`README.md` (57k caractères) et `CLAUDE-SANDBOX-VERIFICATION.md` (66k)
découpés en `readme/partie-0N.md` / `claude-sandbox-verification/partie-0N.md`
(6 fichiers chacun, sous ~15k caractères). Purge ensuite de 18 215
caractères d'historique dupliqué dans le README (32% du total) — voir la
règle permanente ajoutée dans `readme/partie-01.md` : "État
d'avancement" ne garde jamais qu'1 paragraphe courant, jamais
l'empilement des anciens.

### Audit de code, fichier par fichier
Périmètre : les 9 contextes (`src/contexts/`), les 12 modales
(`src/components/modals/`), et les 3 plus grosses vues jamais relues en
entier (`ProfileView.jsx` 946 lignes, `StatsView.jsx` 1752 lignes,
`GeneratorWizard.jsx` 1291 lignes). Chaque fichier lu intégralement, pas
en diagonale.

**2 trouvailles réelles sur l'ensemble de cet audit** :
- `PlaylistDetailContext.jsx` — `handleReplaceTrack` appelait
  `checkTrophies` **avant** la vérification d'annulation (contrairement
  à `handleReplaceTrackSameArtist`, juste à côté, qui le fait bien
  après) : un remplacement annulé en cours de route créditait quand même
  le trophée. Corrigé, tests de régression ajoutés (annulé →
  `checkTrophies` jamais appelé ; réussi → appelé avec le bon compteur).
- `AuthContext.jsx` — RPC `get_registered_users_count` appelée à chaque
  connexion, résultat stocké (`userCount`) mais jamais affiché nulle
  part dans l'UI, ni jamais consommé. Décision prise avec l'utilisateur :
  affichage discret dans `SettingsView.jsx`, uniquement connecté, sous
  la forme "🎉 N comptes créés sur TempoFit jusqu'ici." 4 tests ajoutés
  (singulier/pluriel/absent/mode invité).

Tout le reste de l'audit (modales, contextes, `ProfileView.jsx`,
`StatsView.jsx`, `GeneratorWizard.jsx`) : rien à signaler. Base de code
jugée saine sur ce périmètre.

## Partie 2 — Retours directs sur le comportement réel du moteur musical

### 27/08 — Favoris qui ignorent totalement le genre demandé
Retour direct, capture à l'appui : génération "Rap" demandée, "Mr.
Brightside" (Rock, en favoris) sort quand même. Trouvé dans le code
lui-même, pas une supposition : un titre favori entrait dans le pool de
sélection avec **priorité absolue**, sans AUCUNE vérification de genre —
commentaire explicite dans le code ("jamais concurrencés") confirmant
que c'était une décision produit consciente d'une session antérieure,
pas un oubli. Décision inversée à la demande de l'utilisateur : un
favori doit désormais aussi correspondre au genre demandé (tolérance
d'équivalence incluse, ex. Rock accepté pour Métal), sinon il est écarté
comme n'importe quelle autre source. Corrigé aux **2** points d'entrée
où des favoris peuvent être sélectionnés (`buildSegmentTracks` ET
`getSingleMatchingTrack`, ce dernier utilisé aussi bien pour "Remplacer
un titre" que pour compléter un segment pendant une génération
complète). Au passage : trouvé que les ARTISTES favoris avaient déjà ce
garde-fou (posé après un bug antérieur avec "Stan"/Eminem dans du
Métal), mais pas les TITRES favoris — incohérence interne au même
fichier, maintenant réglée dans les deux sens.
Limite assumée : aucun test automatisé possible sur ce correctif précis
(chemin réseau, `musicEngine.test.js` exclut explicitement ces fonctions
de son périmètre testable) ; vérifié uniquement par lecture de code et
cohérence avec le garde-fou artiste déjà existant et déjà couvert.

### 27/08 — Mélange de genres pondéré : repli vers un genre totalement étranger
2e capture le même jour : génération "Musique brésilienne + Blues +
Musique africaine", des titres Rock/Pop "genre non confirmé" sortent
alors qu'aucun des 2 autres genres réellement demandés (Brésilienne,
Africaine) n'a été essayé en repli. Cause : dans le découpage par budget
pondéré (un sous-appel récursif par genre), le dernier recours de CHAQUE
genre acceptait n'importe quel candidat au bon BPM, de n'importe quel
genre — y compris un genre jamais demandé par l'utilisateur. Corrigé :
nouveau paramètre `siblingGenres`, transmis à chaque sous-appel
récursif = les AUTRES genres du même mélange ; le dernier recours essaie
maintenant ces genres frères en premier (sans poser `_genreMismatch`,
puisqu'ils correspondent réellement à un choix explicite de
l'utilisateur) avant d'accepter un genre totalement étranger.
En parallèle : le mécanisme `checkGenreWeightDeviation` (déjà existant,
détecte un écart ≥15 points entre répartition visée/obtenue) a été
enrichi pour expliquer le POURQUOI probable ("un style au tempo
naturellement lent en a rarement à un BPM élevé"), pas seulement le
QUOI — pour que "0% Blues obtenu" ne soit pas lu comme un bug quand
c'est probablement une vraie rareté du genre à ce tempo.

### 27/08 — Recherche manuelle "Titres à ce BPM" : budget de recherche partagé, pas par genre
3e capture : recherche "Rock + Dance & EDM + Reggae" à 140±10 BPM,
majoritairement des résultats "genre non confirmé" alors que ce sont 3
styles très courants à ce tempo. Trouvé : `searchEngine.js`
(`fetchBpmSearchResults`, le moteur de la recherche manuelle,
**complètement distinct** du moteur de génération complète) plafonnait
le nombre total de candidats explorés à 18, **partagé entre tous les
genres sélectionnés** plutôt que par genre — avec 3 genres, chacun ne
disposait en pratique que d'une fraction du budget. Corrigé : le
plafond grandit maintenant avec le nombre de genres
(`× genresToQuery.length`).
Discussion de fond qui a suivi ("pourquoi ne pas fusionner les 2
moteurs de recherche pour améliorer les 2 d'un coup ?") : décision de
NE PAS fusionner (besoins de consommation trop différents — remplir une
durée précise vs afficher une liste paginable), mais d'extraire la
seule vraie duplication réelle, la classification de confiance d'un
genre (direct/équivalence/mismatch), en une fonction pure partagée
(`classifyGenreMatchTier`, `musicCatalog.js`), utilisée maintenant par
les deux fichiers. Bonus trouvé en le faisant : un `Set` d'exclusion
devenu inutile a pu être supprimé dans `musicEngine.js` au passage (un
palier "équivalence" exclut déjà par construction tout ce qui est
"direct", pas besoin de le re-vérifier après coup).

### 27/08 — Discussion produit : écouter un titre en entier
"Prends du recul" : tous les extraits viennent de Deezer (API encore
ouverte gratuitement pour ça, contrairement à Spotify qui a fermé
l'accès équivalent en nov. 2024) — faut-il proposer d'écouter le titre
en entier via cette plateforme ? Recherché avant de répondre (conditions
Deezer, statut de leur API en 2026). Réponse : oui pour un simple lien
de sortie (`deezer.com/track/{id}`, nouvel onglet), non pour un lecteur
intégré (exigerait que l'auditeur soit connecté à SON PROPRE compte
Deezer + Premium pour entendre un titre en entier, sinon même le widget
"complet" ne joue que 30s comme nos propres extraits — mur payant
surprise pour une bonne partie des visiteurs). Multi-plateforme
(Odesli/Song.link) noté comme piste future, pas engagé maintenant (statut
du service jugé instable/probablement en fin de vie après recherche).
Implémenté : `src/utils/deezerLink.js` (fonction pure,
`getDeezerTrackUrl`), lien ajouté dans `MiniPlayerBar.jsx` (zone toujours
visible, y compris mobile) et dans le menu d'options de `TrackItem.jsx`
(visible même sur une séance non éditable — écouter n'est pas une action
d'édition).

### 27/08 — Filtre par statut (fait/pas fait), sur 2 vues à la fois
Retour direct + capture d'écran (aperçu du profil public) : "pouvoir
filtrer par statut, et si utilisé, prioriser les plus utilisées ?".
Ajouté un nouveau filtre "Statut" dans `useProfileSearchFilter.js`
(utilisé par `ProfileView.jsx`) — visible uniquement sur l'onglet
Playlists (une routine n'est jamais "faite" elle-même). "Déjà faites"
trie automatiquement par nombre de fois jouée décroissant.
Question de recul posée ensuite sur "Mes Playlists"
(`PlaylistsView.jsx`) : elle a en fait DÉJÀ ce filtre, sous une autre
forme (3 sections À planifier/Planifiées/Terminées) — un dropdown y
ferait doublon. Le vrai manque : le classement par popularité existait
déjà en interne (`playlistRankMap`, pour la seule bordure or/argent/
bronze) mais ne contrôlait jamais l'ORDRE d'affichage de "Terminées"
(triée par date, pas par popularité). Ajouté un sélecteur "Plus
récentes / Plus jouées" pour cette section précise.

### 27/08 — Recherche & filtres portés sur "Mes Playlists"
Nouvelle question de recul, capture à l'appui : "Mes Playlists" (30+
items, appelée à grossir) n'avait AUCUNE recherche/filtre, alors que
l'aperçu du profil public (un sous-ensemble de la même collection) en
avait déjà 4. Décision : porter recherche texte + sport + genre + durée
vers "Mes Playlists", mais PAS le filtre Statut (déjà couvert par les 3
sections) et sans toucher au glisser-déposer/pagination existants.
Option technique retenue : envelopper les objets locaux à plat
(`p.name` direct) au format attendu par le hook partagé
(`{ content: p, kind: 'playlist' }`) au moment de l'appel, plutôt que de
généraliser `useProfileSearchFilter.js` ou dupliquer sa logique —
`ProfileView.jsx` n'a pas eu besoin d'être touché. Point de rigueur
vérifié explicitement par un test dédié : le classement or/argent/
bronze reste calculé sur TOUTES les playlists du mode courant, jamais
seulement sur le sous-ensemble qu'un filtre laisse visible (sinon une
playlist verrait son rang changer selon la recherche en cours).

## 2 incidents Vercel — garde-fous anti-régression, tous deux fonctionnels comme prévu

**Incident 1 (casse de nom de fichier)** : `deezerLink.test.js` livré,
arrivé sur GitHub en `deezerlink.test.js` (casse perdue en renommant
pour retirer le préfixe de livraison) — `testFileIdentityTrap.test.js`
l'a attrapé immédiatement (Vercel/Linux est sensible à la casse,
contrairement à macOS/Windows). Résolu en 2 temps (renommer vers un nom
temporaire, commit, puis vers le bon nom, commit — un renommage direct
casse↔casse ne "prend" pas toujours sur un système insensible à la
casse côté utilisateur).

**Incident 2 (contenu de fichier inversé)** : `src/hooks/
useProfileSearchFilter.js` et son test livrés séparément, mais leur
CONTENU a été échangé au moment de les coller sur GitHub — le hook réel
s'est retrouvé dans le fichier de test et vice versa.
`criticalExportsTrap.test.js` l'a attrapé (`src/` important `vitest` =
signal quasi certain d'un fichier de test au mauvais endroit), avec 104
échecs en cascade (tout ce qui dépend du hook). Résolu en identifiant
les 2 fichiers par leurs toutes premières lignes (`import { useState,
useMemo }` pour le vrai hook vs `// @vitest-environment jsdom` pour le
vrai test) et en remettant chaque contenu à sa bonne place.

### Motifs récurrents à retenir pour la suite

**Une découverte "le garde-fou X existe déjà pour Y mais pas pour Z"
signale presque toujours un oubli, pas une différence voulue** — vu 2
fois ce bloc (artistes favoris vs titres favoris genre-vérifiés ;
`checkGenreWeightDeviation` existant mais pas assez explicite sur le
pourquoi). Quand une même préoccupation est déjà résolue ailleurs dans
le même fichier/projet, l'absence de symétrie mérite d'être questionnée
activement, pas supposée intentionnelle.

**Livrer des fichiers séparément par la messagerie ne protège pas contre
une inversion de contenu au moment du copier-coller manuel côté
utilisateur** — 2 incidents distincts ce bloc (casse, puis contenu
inversé), tous deux heureusement attrapés par des garde-fous
automatiques déjà en place AVANT ce bloc (grâce à l'incident du 05/08 et
sa leçon). Sans ces garde-fous, ces 2 erreurs seraient passées en
production silencieusement. Confirme que ces garde-fous génériques
(identité de fichier, imports de test égarés dans `src/`) valent largement
leur coût de maintenance — à ne jamais retirer, et le réflexe à
généraliser : quand une livraison contient plusieurs fichiers dont un
couple source/test très similaires en tête (mêmes premières lignes
d'import), signaler explicitement à l'utilisateur COMMENT distinguer
les deux à l'oeil (comme fait pour l'incident 2), pas seulement donner
le nom du fichier.

**Un moteur "similaire" n'est pas un moteur "fusionnable"** — la
tentation de fusionner `musicEngine.js`/`searchEngine.js` (même
domaine, logique de genre dupliquée) aurait été une erreur : leurs
contraintes de CONSOMMATION (remplir une durée précise vs afficher une
liste paginable) sont incompatibles, alors que leur logique de
DÉCISION (confiance d'un genre) ne l'est pas. Distinguer les deux avant
de proposer une fusion — n'extraire QUE la décision partagée, jamais le
moteur entier, quand c'est le cas.
