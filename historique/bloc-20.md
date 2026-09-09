### SESSION DU 01/09 (suite) — Paliers Garmin-style pour 5 métriques cumulatives

**Demande** — retour direct : "souvent sur les applications type Garmin
il y a plusieurs itérations des trophées, par exemple si on fait 1 ou 5
séances y en a 2, là selon toi faudrait-il en dupliquer certains en
fonction des paliers d'objectifs ? fais un audite, si tu en vois,
ajoute-les tous sans me demander et fais-moi le bilan ensuite".

**Méthode d'audit** — passe sur les 30 trophées existants (24 d'origine +
6 du bloc 19), en distinguant 2 familles :
- **Métriques cumulatives** (un compteur qui grandit avec le temps/
  l'usage — sessions, distance, remplacements...) : de vrais candidats à
  plusieurs paliers, exactement le modèle déjà en place pour
  `totalCompleted` (1/5/30 séances).
- **Trophées "découverte"** (un exploit ponctuel — générer UNE session
  extrême, trouver le Rickroll, essayer les 3 structures...) : PAS de
  paliers pertinents, il n'y a pas de sens à "faire 5 fois" une
  découverte-surprise — délibérément écartés (Le Marathonien, La Foudre,
  Maître du HIIT, Oiseau de Nuit, Rickroll, Les 3 Visages de l'Effort, Le
  Grimpeur, Pile à l'Heure, Touche-à-Tout, Adepte de la Lumière,
  Explorateur de Genres, Planificateur, Pilote Automatique, Ma Première
  Routine, Fidèle à tes Artistes, Sur Mesure, Curieux de Nature — ce
  dernier pourrait en théorie compter des profils distincts, mais sans
  compteur existant ni signal fort que ce soit une vraie habitude
  répétée, écarté par prudence plutôt que d'inventer un mécanisme de
  déduplication pour un bénéfice incertain).

**5 métriques retenues, 10 nouveaux trophées** :

| Métrique | Palier(s) existant(s) | Nouveaux paliers |
|---|---|---|
| Sessions totales | 1 / 5 / 30 | +100 ("Vétéran") |
| Sessions Mode Intime | 1 | +10, +50 |
| Remplacements de titres | 3 | +25, +100 |
| Distance cumulée | 100 km | +300, +1000 |
| Imports de données | 1 | +10 |
| Clonages reçus | 1 (bloc 19) | +10, +50 |

**Mise en œuvre — 2 groupes bien distincts** :

1. **Total/naughty/replace/data (6 nouveaux trophées)** — AUCUN changement
   de code au-delà d'`appConfig.js` : ces 4 types de `requirement` sont
   déjà gérés génériquement par `checkTrophies` (`useUserStats.js`),
   qui compare directement un compteur existant (`totalCompleted`,
   `naughtyCompleted`, `replacedTracks`, `dataImports`) au seuil
   (`count`) de CHAQUE trophée — exactement le même mécanisme qui permet
   déjà à "Premier Pas"/"Athlète Régulier"/"La Machine" de coexister sur
   `totalCompleted`. Ajouter un seuil plus élevé, c'est juste une nouvelle
   entrée dans le tableau.
2. **Distance/clonages reçus (4 nouveaux trophées)** — ces 2 métriques
   utilisent un flag booléen ad-hoc (`has100km`, `hasReceivedClone`),
   PAS le mécanisme générique — 2 nouveaux flags par métrique, posés au
   MÊME endroit que l'existant plutôt que refondus en un type générique
   `distance`/`receivedClones` (aurait touché `checkTrophies` lui-même et
   son test déjà en place ; minimal-diff préféré à une réarchitecture pour
   ce chantier) :
   - `usePlaylistCompletions.js` — `has300km`/`has1000km` posés juste
     après `has100km`, sur LE MÊME compteur cumulatif
     (`stats.totalDistanceKm`).
   - `StatsView.jsx` — `hasReceivedClone10`/`hasReceivedClone50` posés
     juste après `hasReceivedClone`, sur LE MÊME total déjà calculé
     (`total`, pas de requête supplémentaire).
   - `useUserStats.js` — les 4 nouveaux flags ajoutés aux valeurs par
     défaut.

**Choix de catégorie** (`TrophiesView.jsx` groupe par `category`) : chaque
nouveau palier reprend EXACTEMENT la catégorie de son "palier 1" déjà
existant (Mode Intime → `feature`, comme "Tempo Lover" ; remplacements →
`habit`, comme "Le Mixeur" ; distance → `secret: true`, comme "100 Bornes
au Compteur" ; imports → `feature`, comme "Data Scientist" ; clonages
reçus → `habit`, comme "Source d'Inspiration") — pour rester groupés
ensemble à l'affichage plutôt que dispersés entre sections.

**Icônes** — 10 nouveaux emoji, vérifiés un par un pour ne réutiliser
AUCUN des 30 déjà en place (liste complète consultée avant de choisir) :
🎖️😈💋🎧🎚️🗺️🚀📉🌟🎬.

**Piège rencontré en cours de route** — une édition de texte imprécise
(`str_replace`) dans `tests/views/StatsView.test.jsx` a fait disparaître
la ligne d'ouverture (`it(...)`) d'un test existant ("n'affiche RIEN quand
le total vaut 0") en capturant par erreur un fragment de texte trop
générique. Repéré immédiatement en revérifiant la structure du fichier
après l'édition (habitude systématique après toute édition non triviale,
pas seulement en cas d'erreur signalée) — corrigé avant même de lancer
les tests.

**Tests** — 6 nouveaux :
- `tests/hooks/usePlaylistCompletions.test.js` (+3) — les 2 nouveaux
  seuils de distance, plus un test négatif (sous les 3 seuils à la fois,
  aucun des 3 flags ne passe).
- `tests/views/StatsView.test.jsx` (+3) — les 2 nouveaux seuils de
  clonages reçus, plus un test négatif (entre 1 et 9, seul le palier de
  base se déclenche).

**Suite complète** : 125 fichiers, 1751 tests, tous verts (+6 tests par
rapport au bloc 19).

**Livraison** : `src/appConfig.js`, `src/hooks/useUserStats.js`,
`src/hooks/usePlaylistCompletions.js`,
`src/components/views/StatsView.jsx`,
`tests/hooks/usePlaylistCompletions.test.js`,
`tests/views/StatsView.test.jsx` — fichier par fichier, chemin repo
exact, esbuild + tsc --checkJs + `npx vitest run` avant livraison.
