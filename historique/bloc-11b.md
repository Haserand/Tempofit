# TempoFit — Historique détaillé, bloc 11b (28/08 suite : harmonisation, exclusion par genre, fusion Exclusions→Favoris)

Suite directe de bloc-11a.md, même session, même date.

## Harmonisation d'`addOrToggleFavorite` + "prends du recul" sur l'exclusion par genre

Retour direct : "harmonise aussi l'ajout depuis la recherche [manuelle]" (un oubli du chantier précédent : `SearchModal.jsx` manipulait encore `setFavorites` directement, EN DOUBLE de `toggleTrackFavorite`, sans jamais passer par la coordination favoris/exclusions) — **puis, dans le même message** : "prends du recul, pouvoir permettre d'exclure un style au besoin ?"

**Harmonisation** : `addOrToggleFavorite` réduit à un simple relais vers `toggleTrackFavorite` (prop, désormais la version coordonnée depuis App.jsx) — plus de logique dupliquée entre recherche et playlist.

**Exclusion par genre — avis donné avant de coder** : utile surtout dans 2 cas précis, pas un simple confort symétrique avec artiste/titre — (1) quand aucun genre n'est sélectionné ("Autre"/tous genres, où n'importe quel style peut sortir), (2) pour une sélection large de plusieurs genres où "tout sauf X" est plus simple qu'une désélection manuelle.

**Implémentation — le point technique le plus délicat de ce sous-chantier** : contrairement à artiste/titre (connus AVANT tout appel réseau), le genre RÉEL d'un candidat n'est connu qu'APRÈS `resolveDeezerGenre`. Un filtrage unique en amont (comme pour artiste/titre) aurait donc laissé passer un candidat de genre exclu jusqu'à devenir un repli de dernier recours, avant même que son genre soit vérifié. Corrigé en ajoutant un **second point de filtrage**, à l'intérieur de chaque boucle de résolution de genre (une fois `realGenre` connu) — 6 endroits distincts trouvés et corrigés à travers `musicEngine.js` et `searchEngine.js`. Une limite documentée et assumée : le tout dernier filet de secours "garanti non-vide" de `getSingleMatchingTrack` n'appelle jamais `resolveDeezerGenre` (conçu pour rester rapide), donc pas de vrai genre à vérifier contre l'exclusion à cet endroit précis — seule l'exclusion par artiste/titre s'y applique.

`ExclusionsView.jsx` étendu avec une 3e section "Genres Exclus" (pastilles `SelectablePill` déjà utilisées ailleurs dans l'app), volontairement **non filtrée par Mode Intime** — même raisonnement que pour artiste/titre.

Suite complète : 122 fichiers, 1685 tests, 0 régression.

## Bug réel trouvé sur capture : "Synchroniser mes comptes" ouvre le mauvais onglet Réglages

Retour direct avec capture à l'appui : "prends du recul, si je clique sur synchroniser mes comptes je dois avoir la page réglages qui ouvre sur l'onglet profil athlétique ou sur services musicaux ?" Réponse sans ambiguïté : "Services Musicaux" (le lien dit explicitement "lier Spotify", aucun rapport avec le profil athlétique).

Cause trouvée : `changeView('settings')` seul ne réinitialise JAMAIS `settingsInitialTab` (App.jsx) — un mécanisme déjà en place ailleurs (`handleOpenSettings(tab)`) existait précisément pour éviter ça, mais ce lien-ci l'avait contourné. Corrigé en remplaçant l'appel direct par `handleOpenSettings('music')`.

## Fusion "Exclusions" en onglet de "Mes Favoris"

Retour direct avec capture annotée : "Exclusion devrait être un onglet contenu dans l'onglet favoris, comme le modèle playlists/routines contenu dans la vue playlists." Avis donné et confirmé : Favoris et Exclusions sont deux faces d'une même pièce (goûts musicaux), exactement comme Playlists/Routines.

Implémentation : même schéma EXACT que la fusion Routines→Playlists du 20/08. `ExclusionsView.jsx` réduit à son CORPS SEUL (plus de `<ViewHeader/>`/`VIEW_CONTENT_WRAPPER` propres) ; `FavoritesView.jsx` porte désormais les onglets (`TabPills`) et le titre/sous-titre qui changent selon l'onglet actif. Entrée Sidebar "Exclusions" retirée entièrement.

**Test garde-fou trouvé et corrigé en cours de route** : un test scanne systématiquement tous les fichiers `*View.jsx` pour vérifier qu'ils utilisent `VIEW_CONTENT_WRAPPER` — `ExclusionsView.jsx` n'en a plus besoin, exactement comme `RoutinesView.jsx` avant elle lors de la même fusion le 20/08. Ajoutée à la même liste d'exclusion déjà documentée dans ce test pour ce cas précis, plutôt que de casser silencieusement ce garde-fou.

Suite complète : 122 fichiers, 1690 tests, 0 régression.

## 2 phrases condensées à une ligne (DiscoverView.jsx, ProfileView.jsx)

Retour direct : "prends du recul, est-ce que la phrase en gris est seulement utile pour la vue découvrir profils ?" comparant favorablement le patron "icône + un seul message + bouton" de `StatsView.jsx` à la structure "titre + sous-titre" de `DiscoverView.jsx`/`ProfileView.jsx` (verrous de connexion).

Analyse faite avant de coder : le sous-titre de `DiscoverView.jsx` est effectivement redondant avec son titre générique — mais `ProfileView.jsx` a la MÊME structure pour une raison différente (son sous-titre porte une info réelle et non redondante, le pseudo précis de la personne visitée). Les deux fusionnés en un seul message chacun, mais le second devait composer avec une longueur VARIABLE (le pseudo).

**Calcul fait sur le PIRE CAS, pas un pseudo "typique"** : `USERNAME_REGEX` limite un pseudo à 20 caractères max — gabarit "Connecte-toi pour @" (19 caractères) + pseudo (≤20) = 39 caractères MÊME DANS LE PIRE CAS, dans le même budget déjà confirmé réel pour `StatsView.jsx` (38-40 caractères à `text-lg font-bold max-w-sm mx-auto`). Un test dédié ajouté avec un pseudo de 20 "a" (le maximum absolu) pour figer cette garantie, pas seulement un pseudo court qui aurait masqué le problème.

## 2e bug du même motif : "Configurer mes zones BPM" ouvre aussi le mauvais onglet

Retour direct avec capture : après avoir cliqué "Synchroniser mes comptes" (Services Musicaux), le bouton "Configurer mes zones BPM" (`GeneratorWizard.jsx`) ouvrait LUI AUSSI sur Services Musicaux au lieu de Profil Athlétique — "en fonction du point d'entrée l'onglet d'arrivée doit être différent."

Cause EXACTEMENT identique au bug précédent, sur un site différent : ce bouton appelait encore `changeView('settings')` nu, sans jamais passer par `handleOpenSettings`. Audit fait avant de corriger (vérification de tous les liens similaires du projet, notamment dans `StatsView.jsx`) : tous les autres étaient déjà corrects, seul celui-ci avait le bug. Corrigé en `handleOpenSettings('profile')`, chaîne de props remontée (`GeneratorWizard.jsx` → `GeneratorView.jsx` → `App.jsx`).

Suite complète : 122 fichiers, 1691 tests, 0 régression.

## Phrase du disclaimer Deezer condensée à une ligne

Retour direct, capture à l'appui : phrase grise de `SearchModal.jsx` ("* Connecté via Deezer — le BPM peut être approximatif, et certains titres peuvent rester introuvables.", 104 caractères) passait sur 2 lignes. Condensée à "* Via Deezer — BPM approximatif, titres parfois introuvables." (61 caractères), gardant les 3 informations essentielles.

## Discussion sans action : exclusions pré-remplies ?

Retour direct : "faut-il des exclusions pré-remplies, comme pour les favoris ?" Avis donné : non — une exclusion est un jugement négatif porté à la place de l'utilisateur (contrairement à un favori, démonstration positive neutre), avec un risque de confusion différée (un titre absent est invisible, contrairement à un titre qui apparaît plus souvent). L'état vide actuel enseigne déjà la marche à suivre. Aucune implémentation demandée, resté une discussion.
