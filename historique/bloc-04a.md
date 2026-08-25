# TempoFit — Historique détaillé, bloc 4 (13-14/08, hooks/tests, infobulles, moteur de génération)

Rien en cours actuellement. Dix chantiers enchaînés, mêmes 24-48h,
**+ 6 correctifs trouvés/demandés en creusant après coup, et une nouvelle
habitude actée à l'issue de cette série** :

**14/08 — rattrapage complet des infobulles sur texte tronqué.** Suite
directe du chantier précédent (`TemplateCard.jsx` seul, motif plus large
signalé sans être traité) — confirmé explicitement ("on le fait
maintenant"). Les 71 éléments `truncate`/`line-clamp-*` recensés dans
`src/components/` passés en revue un par un, dans 19 fichiers :
`StatsView.jsx` (12), `SettingsView.jsx` (6), `ProfileView.jsx` (4),
`PlaylistCharts.jsx` (5/6, 1 exception), `ViewHeader.jsx`,
`PlaylistHeaderTitleBlock.jsx`, `MiniPlayerBar.jsx` (1/2, 1 exception),
`TrackItem.jsx` (2), `SessionSummaryCard.jsx` (2), `SearchModal.jsx` (2),
`PublicRoutinePreviewModal.jsx` (2), `ImportSharedPlaylistModal.jsx` (2),
`RoutinesView.jsx`, `PlaylistCard.jsx`, `FavoritesView.jsx` (2),
`AthleticProfilePanel.jsx`, `Sidebar.jsx`, `SearchUsersModal.jsx` — plus
`PlaylistHeaderMeta.jsx`, déjà entièrement bon (le comptage initial au
grep simple n'avait pas vu les `title=` déjà posés sur une ligne
différente du `className`). 2 exceptions assumées, détaillées dans la
règle 6 du README (tooltip de graphique déjà affiché au survol ; un
bouton dont le `title=` décrit l'action plutôt que de répéter le texte).
Vérifié : aucune collision avec un `getByTitle`/`getAllByTitle` déjà
testé dans les fichiers à risque (croisement des valeurs mock utilisées).
Règle 6 du README mise à jour (ne mentionne plus "66 restants").

**14/08 — Découvrir : infobulles sur le texte tronqué (motif DISTINCT des
icônes).** Retour direct : "il manque pas les infobulles sur les metadata
de Découvrir ? je pensais qu'on les avait systématisées partout" — bonne
occasion de clarifier : la convention actée jusqu'ici portait sur les
ICÔNES seules, pas sur le texte TRONQUÉ (`truncate`, ellipsis) sans
`title=`, un motif différent bien que lié. `TemplateCard.jsx` corrigé (3
éléments : titre, ligne de métadonnées, description). Ampleur du motif
plus large constatée en vérifiant (71 éléments au total, voir le
rattrapage complet ci-dessus). Test dédié ajouté dans
`TemplateCard.test.jsx`.

**14/08 — bouton final du wizard : texte raccourci + couleur de marque
restaurée.** Retour direct : "Générer suffit pas ? et pourquoi le bouton
est blanc ?". "Générer ma Playlist" → "Générer" (redondant à ce stade,
plusieurs étapes de configuration déjà faites). Couleur : c'était
`bg-gray-900 dark:bg-white` codé en dur, sans lien avec `bgAccentClass`
(rouge Sport/rose Intime) utilisé PARTOUT ailleurs dans ce même fichier —
la CTA la plus importante de tout le wizard était la seule à ne pas
porter la couleur de marque, aucune trace d'un raisonnement voulu dans
l'historique du projet. Passé à `bgAccentClass`, qui bascule déjà
automatiquement rouge/rose via CSS (`--color-primary`, index.css) — plus
besoin du ternaire `isNaughtyMode` local, supprimé. Test mis à jour dans
`GeneratorWizard.test.jsx`.

**14/08 — Découvrir : compteur de clonages déplacé sur la pochette.**
Retour direct : "pour gagner de la place, le compteur en bas à droite de
la pochette ?". Complète le badge "TempoFit" en haut à gauche par une
symétrie diagonale — la ligne "chapeau" sous la pochette, qui ne
contenait plus que ce compteur depuis le retrait de l'auteur (chantier
précédent), est retirée entièrement : le titre suit désormais directement
la pochette. `z-10` posé DIRECTEMENT sur ce nouveau badge dès l'écriture
(pas après coup) — leçon tirée du bug juste précédent (badge "TempoFit"
inatteignable au clic, empilement CSS) appliquée immédiatement à ce badge
non cliquable, pour une cohérence purement esthétique (éviter qu'il
s'assombrisse au survol contrairement au badge "TempoFit"). Toujours
affiché même à 0 (comportement inchangé, juste déplacé). Tests réécrits
dans `TemplateCard.test.jsx` (le compteur est vérifié DANS le conteneur
de la pochette, plus "précédant le titre dans un `<p>`" — cet élément
n'existe plus).

**14/08 — bug réel raté au 1er passage : badge cliquable inatteignable
(empilement CSS).** Retour direct après déploiement : "TEMPOFIT est pas
cliquable". Le câblage (`onClick`+`stopPropagation`) était correct, mais
JAMAIS atteint dans un vrai navigateur — l'overlay du bouton play
(`absolute inset-0`, transparent hors survol) vient APRÈS le badge dans
le DOM ; sans z-index explicite, 2 éléments `position: absolute`
s'empilent selon leur ordre DOM, celui d'après passe AU-DESSUS même
invisible. Cet overlay couvre toute la carte, recouvrait donc le coin du
badge et interceptait le clic avant qu'il n'atteigne le bouton en dessous
— remontant jusqu'au clic de la carte entière (ouvrir la playlist) au
lieu du badge (voir profil). Corrigé avec `z-10` sur le badge. **Limite
honnêtement notée dans le test existant** : `fireEvent.click()` en jsdom
cible l'élément directement, sans aucun test de recouvrement visuel réel
— ce test passait DÉJÀ avant le correctif, il vérifie le câblage, pas
l'atteignabilité réelle au clic dans un navigateur, que jsdom ne peut pas
simuler. Recherche du même motif ailleurs dans le projet (badge cliquable
en coin + overlay plein cadre après lui dans le DOM) — aucune autre
occurrence trouvée, cas isolé à ce fichier.

**14/08 — Découvrir : badge "TempoFit" cliquable, auteur redondant
retiré.** Retour direct avec capture : "on a déjà TEMPOFIT sur la
pochette ET TempoFit Officiel en dessous, le 2e est redondant — est-ce
qu'on peut pas juste rendre le badge cliquable ?" (repris de la question
"le premier suffirait pas ?" — avis donné avant d'agir : oui redondant
aujourd'hui, mais raison documentée le 02/08 pour garder l'auteur
cliquable — anticipation d'un contenu non-officiel futur, jamais planifié
concrètement). Le clic vers le profil (Feature Sociale "Cold Start",
02/08) vit désormais sur le badge de la pochette (`TemplateCard.jsx`) —
même garde `isOfficial && onViewOfficialProfile`, même `stopPropagation`
— plus sur un texte auteur séparé (retiré). Si du contenu non-officiel
apparaît un jour, réintroduire l'affichage différencié de l'auteur sera
un changement naturel à ce moment-là, pas une régression de celui-ci.
Tests réécrits dans `TemplateCard.test.jsx` (section renommée "badge
cliquable") et `DiscoverView.test.jsx` (nom accessible du bouton changé :
"TempoFit", le texte du badge, plus "TempoFit Officiel", l'ancien
`template.author`).


**14/08 — dernier angle mort : silence total pendant le repli réseau
final.** Trouvé à la 5e relecture demandée ("continue à creuser au cas
où"). La boucle de repli final (`getSingleMatchingTrack`, quand le pool
ne suffit pas — rare, "BPM/genre très restrictif") fait ses PROPRES
appels réseau, entièrement APRÈS la construction du pool où `onProgress`
s'arrêtait jusqu'ici — pas juste une stagnation temporaire comme les
correctifs précédents, un silence total tant qu'elle tournait. Corrigé en
basculant, à ce stade, du compte de pool ESTIMÉ au compte RÉEL de titres
déjà retenus pour le segment (`selected.length`) — le clamp anti-régression
déjà en place gère la transition si ce compte réel démarre plus bas que
la dernière estimation affichée. Même traitement appliqué au filet de
sécurité ultime (segment resté vide) pour cohérence, fenêtre de silence
plus courte mais réelle.

**Nouvelle habitude actée dans `CLAUDE-SANDBOX-VERIFICATION.md`** : après
5 relectures demandées sur le même chantier, chacune trouvant quelque
chose de réel mais de moins en moins grave, l'utilisateur a fait
remarquer que ça vaudrait le coup de systématiser ce réflexe plutôt que
de compter sur lui pour insister à chaque fois. Actée : après tout
chantier touchant un fichier déjà identifié comme sensible dans ce projet
(`musicEngine.js`, la logique de synchro Supabase, ou plus généralement
du code à plusieurs branches/boucles alimentant une même valeur
affichée/partagée), faire au moins une relecture complète et attentive
dédiée AVANT de considérer la livraison terminée — pas seulement vérifier
que ça compile.

**14/08 — anti-doublon dans le comptage catalogue.** Trouvé en creusant
encore ("continue à creuser au cas où, même la cosmétique a de
l'importance") : le comptage en direct du bloc catalogue ne dédoublonnait
pas contre les titres déjà retenus par les sources précédentes (favoris,
Spotify, recherche généraliste) — un même titre trouvé par deux sources
pouvait compter deux fois, gonflant légèrement le chiffre affiché au-delà
de la réalité du pool. Corrigé en réutilisant `seenIds` (déjà tenu à jour
par `addIfValid` pour TOUTES les sources, pas seulement la recherche
généraliste) dans le filtre de comptage — bénéfice plus large que prévu
au départ (dédoublonne aussi contre favoris/Spotify, pas seulement contre
la recherche généraliste). Pas de test dédié ajouté : logique trop
imbriquée dans l'accumulation de `seenIds` sur toute la fonction pour
être extraite proprement en fonction pure, comme les autres morceaux déjà
testés de ce chantier — cohérent avec la convention déjà actée pour cette
fonction (non testable en isolation, appels réseau réels).

**14/08 — chaînage de la progression entre recherche généraliste et
catalogue d'artistes.** Trouvé en re-creusant après le correctif
précédent (question ouverte "tu vois d'autres trucs ?", pas de retour
direct cette fois) : le chemin catalogue tourne SOUVENT en complément de
la recherche généraliste, dans le MÊME appel de fonction — mais sa
progression repartait de `progressBaseCount` tout court, sans tenir
compte de ce que la recherche généraliste avait déjà trouvé. Pas une
régression visible (déjà couverte par le clamp du correctif précédent),
mais un compteur qui aurait pu sembler STAGNER un moment à la transition
entre les deux sources, le temps que le catalogue "rattrape" le niveau
déjà atteint. Corrigé en hissant `generalSearchEstimate` en variable de
PORTÉE FONCTION (pas juste le bloc où vivait `genreValidDurationSoFar`
avant ce correctif), pour que le bloc catalogue puisse chaîner sa propre
progression à la suite plutôt que de repartir à zéro.

**14/08 — angle mort comblé sur demande explicite : progression aussi pour
le chemin catalogue d'artistes.** Signalé au check-up précédent comme
angle mort acceptable (pas corrigé sur le moment), puis demandé quand
même ("tan qu'à faire"). Le chemin de repli par catalogue d'artistes
(`ARTIST_CATALOG`, musicEngine.js) — SEUL chemin emprunté pour les genres
à mot-clé Deezer fragile (K-pop, etc.), et systématiquement en complément
pour les genres normaux — n'avait aucun signal de progression, contrairement
à la recherche généraliste Deezer. `fetchInBatches` (utilitaire partagé,
8 appels dans musicEngine.js) accepte désormais un 4e paramètre optionnel
`onBatchDone`, rétrocompatible (`null` par défaut, aucun effet sur les 7
autres appels). Utilisé sur CE chemin précis pour compter les candidats
valables lot par lot, plutôt qu'une conversion durée→titres (cette branche
n'accumule pas de durée "bon genre" comme la recherche généraliste).
⚠️ Cette 2e branche de progression tourne parfois APRÈS la recherche
généraliste dans le MÊME appel à `buildSegmentTracks`, sans être chaînée à
son compte — un vrai risque de régression visible (le compteur qui
redescend), mais déjà couvert par le clamp anti-régression posé juste
avant au niveau de l'affichage (`usePlaylistGeneration.js`) : aucun
changement nécessaire là, la protection était déjà générique. Tests
ajoutés dans `tests/engine/fetchInBatches.test.js`.
