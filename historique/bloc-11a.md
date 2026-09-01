# TempoFit — Historique détaillé, bloc 11a (28/08 : session longue, chantiers enchaînés — moteur de recherche, cadrage du mécanisme d'exclusion)

Session très longue, entièrement datée du 28/08, enchaînant de nombreux chantiers sur retours directs successifs — pas un seul sanity check ponctuel comme le bloc 10, mais une vraie série de features/corrections construites au fil de la conversation. Découpée en plusieurs fichiers par SUJET plutôt que par heure, puisque tout tombe sur la même date.

## Pourquoi 25 candidats par artiste et pas plus (recherche manuelle BPM)

Retour direct : après avoir relevé `candidatesPerArtist` de 10 à 25 pour la recherche catalogue de `searchEngine.js` (chantier précédent), question posée : pourquoi pas encore plus, voire "tout ce qu'un artiste a fait" ?

Réponse développée : le vrai frein n'est pas le coût réseau (`limit=X` ne coûte pas plus cher en requêtes), mais la **diversité**. Le budget de vérification (`stubCap`) est partagé entre TOUS les artistes du catalogue, pas par artiste. Si on demande "tout" à chaque artiste, un artiste très prolifique tombé tôt dans le tirage aléatoire pourrait à lui seul épuiser tout le budget, écrasant la place des ~100 autres artistes du catalogue — résultat dominé par 2-3 artistes plutôt que varié. 25 reste un choix de compromis assumé, pas une limite technique Deezer subie (d'autres appels du projet montent déjà à `limit=40`).

## Pourquoi le signal d'arrêt anticipé (`onBatch` → `false`) n'était utile qu'à un seul endroit

Suite logique de la discussion précédente : ce signal (ajouté dans `searchArtistsForBpm`, musicEngine.js) ne sert que si l'appelant traite les résultats AU FUR ET À MESURE avec un budget partagé qui peut s'épuiser EN COURS DE ROUTE — exactement le cas de `searchEngine.js` (callback `onBatch` + `stubCap`). Les 3 appels de `musicEngine.js` (génération) attendent le tableau COMPLET avant de faire quoi que ce soit (pas de callback progressif) — la limite s'y joue entièrement via `maxArtistsToTry`/`candidatesPerArtist`, jamais via un signal réactif en cours de recherche. Le signal existe dans la fonction partagée mais n'a d'effet que si l'appelant lui donne une raison de s'arrêter.

## Application à la génération des mêmes correctifs que la recherche manuelle

Retour direct : "des choses de la recherche manuelle peuvent-elles s'appliquer à la génération ?" Audit fait avant d'agir plutôt que de copier-coller aveuglément :

**Déjà partagé entre les deux moteurs** (rien à faire) : recherche profonde universelle (`needsDeepCatalogSearch` toujours vrai), `WEAK_DEEZER_KEYWORD_GENRES`, le "second avis" catalogue (`findCatalogGenreForArtist`) déjà appliqué à 5 endroits de `musicEngine.js` le même jour. Les favoris en génération avaient déjà leur propre mécanisme de priorité avant cette session (`getSingleMatchingTrack`, étapes 1/1.5) — rien à porter non plus.

**3 corrections réellement appliquées, une par une, avec un raisonnement différent à chaque site** :
- `getSingleMatchingTrack` (favori-artiste) : plafonné à 3 artistes essayés/5 candidats — un utilisateur avec plus de 3 artistes favoris n'avait jamais les autres pris en compte. Relevé à `favorites.artists.length` (aucun plafond) / 10 candidats.
- `tryArtistCatalogSearch` (catalogue, dernier recours pour un seul titre) : un commentaire existant documentait déjà ce même bug de fond (K-pop, 109 artistes, seuls 12 vraiment essayés), corrigé une première fois le 27/08 sans être résolu jusqu'au bout. Relevé à `catalogArtists.length` (aucun plafond) / 25 candidats (recherche pour UN SEUL titre, pas de risque de diversité écrasée).
- `buildSegmentTracks` (catalogue, construction d'un SEGMENT ENTIER) : relevé `maxArtistsToTry` à `catalogArtists.length` aussi (exploration garantie), mais **volontairement PAS** `candidatesPerArtist` (laissé à 10, pas 25) — cette fonction construit un POOL DIVERSIFIÉ pour toute une portion de playlist, pas un seul titre. Le relever sans aussi relever le plafond de vérification en aval (`stubs.slice(0, 60)`, inchangé) aurait recréé exactement le risque de diversité écrasée déjà identifié pour la recherche manuelle.

Suite complète après ce chantier : 120 fichiers, 1637 tests, 0 régression.

## Cadrage du mécanisme d'exclusion — 5 points tranchés avant tout code

Retour direct : "que penses-tu d'intégrer un mécanisme d'exclusion ? sélectionner des artistes/sons qu'on ne souhaite pas avoir, alimentable via d'autres points d'entrée comme une playlist générée." Avis donné avant d'implémenter : idée solide (complément naturel des favoris, vrai trou aujourd'hui — rien ne permet de dire "jamais ça"), mais chantier plus gros qu'il n'y paraît : une exclusion doit être un filtre dur vérifié à CHAQUE point d'acceptation possible (génération ET recherche manuelle), pas juste ajoutée à un endroit.

5 questions posées, 5 réponses tranchées avant de coder :
1. Artiste ET titre (exclure un artiste exclut tous ses titres) — oui.
2. Où gérer la liste — nouvel onglet "Exclusions".
3. Autres points d'entrée pour alimenter la liste (menu d'un titre en playlist, recherche manuelle) — oui, avec audit au besoin.
4. Effet rétroactif — non, futures générations/recherches seulement, jamais une playlist déjà générée.
5. Conflit favori/exclusion (rare mais possible) — l'action réalisée en dernier prime, MAIS avec un message explicite de transition entre les deux catégories (pas un simple toast générique).

## Implémentation — artistes et titres (partie 1, sur plusieurs tours)

Chantier étalé sur plusieurs tours de conversation faute d'espace outil suffisant en un seul passage — progression signalée explicitement à chaque interruption plutôt que de prétendre avoir fini.

**Modèle de données** : `useExclusions.js`, nouveau hook miroir de `useFavorites.js` — `{artists, tracks}`. Différence assumée et documentée : **pas de cloisonnement Mode Intime**, contrairement aux favoris. Un favori peut légitimement différer par mode (un goût musical n'est pas le même en Mode Intime qu'en standard) ; une exclusion, elle, porte le sens "je ne veux JAMAIS entendre ça", indépendamment du mode actif au moment où le choix a été fait — cloisonner aurait permis à un artiste exclu en Mode Intime de réapparaître en standard, contraire à l'intention même du mécanisme.

**Filtre partagé** : `isExcludedTrack(track, exclusions)` dans `musicCatalog.js`, fonction pure appelable depuis les deux moteurs sans dépendance circulaire.

**Audit complet de `musicEngine.js`** (génération) — chaque fonction de la cascade de sélection vérifiée une par une : `getSingleMatchingTrack` (titres favoris, artistes favoris, `tryDeezerKeywordSearch`, `tryArtistCatalogSearch`, repli extrême, repli du repli), `buildSegmentTracks` (`addIfValid`, point central qui protège d'un coup favoris/Spotify/Deezer/catalogue en un seul endroit plutôt que de patcher chaque source séparément), `createPlaylistData`, `findSameArtistReplacement`. Point important trouvé en auditant : dans plusieurs replis de "dernier recours", un candidat exclu aurait pu quand même être choisi faute de mieux si le filtre n'avait été posé qu'à l'entrée de la fonction — corrigé partout pour que l'exclusion prime toujours, même en dernier recours, en filtrant AVANT la construction de la liste triée plutôt qu'après.

**Puis `searchEngine.js`** (recherche manuelle) — même principe. Un vrai bug évité de justesse en cours de route : une tentative de filtrage précoce sur le boost artiste-favori utilisait un `return;` qui aurait fait sortir de TOUTE la fonction `fetchBpmSearchResults` (pas juste du sous-bloc concerné), puisque ce code vit directement dans le corps de la fonction et non dans une fonction imbriquée — repéré en relisant avant de livrer, corrigé par une garde `if` englobante à la place.

**Câblage de la chaîne complète** : `useDeezerSearch.js` → `usePlaylistGeneration.js` → `PlaylistDetailContext.jsx` → `App.jsx`. Un lot de tests cassés par le changement de signature de `fetchBpmSearchResults` (nouvel argument `exclusions`) trouvé et corrigé à la relance de la suite complète.

**Exclusivité mutuelle favoris/exclusions** (point 5 du cadrage) codée dans `App.jsx` — 4 fonctions coordonnées (`toggleArtistFavoriteCoordinated`, `toggleArtistExclusionCoordinated`, `toggleTrackFavoriteCoordinated`, `toggleTrackExclusionCoordinated`) qui détectent la transition et affichent le message dédié ("déplacé des exclusions vers les favoris", etc.) au lieu du toast générique. Vivent dans `App.jsx` et nulle part ailleurs — ni `useFavorites.js` ni `useExclusions.js` ne se connaissent, pour rester découplés et testables isolément ; App.jsx est le seul endroit qui a accès aux deux hooks en même temps.

**UI** : `ExclusionsView.jsx` (nouvel onglet, miroir de `FavoritesView.jsx`), entrée de navigation dans `Sidebar.jsx`, routage dans `App.jsx`. Boutons "Exclure ce titre"/"Exclure l'artiste" ajoutés dans le menu `TrackItem.jsx` (à côté de "Favoriser l'artiste" déjà existant), câblés jusqu'à `App.jsx` via `TrackList.jsx` → `PlaylistDetailView.jsx`.

Suite complète après cette 1re partie : 122 fichiers, 1671 tests, 0 régression. Suite du chantier (harmonisation, exclusion par genre, fusion d'onglet) : voir bloc-11b.md.
