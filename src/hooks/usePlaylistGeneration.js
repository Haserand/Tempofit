import { useRef } from 'react';
import { EXTRA_GENRES, WEAK_DEEZER_KEYWORD_GENRES } from '../musicCatalog';
import { createPlaylistData } from '../engine/musicEngine';
import { useGeneratorContext } from '../contexts/GeneratorContext';

/**
 * usePlaylistGeneration — le point d'entrée principal de la génération de
 * playlist(s), appelé depuis le wizard (count=1) ou depuis une routine
 * (count=1..10, génération en lot / "batch").
 *
 * Extrait d'App.jsx (25/07, chantier "réduire le God Component"). Contrairement
 * aux hooks précédents (playlists sauvegardées, complétions, routines,
 * navigation), cette extraction n'est PAS motivée par du partage/prop-drilling —
 * `executeGeneration` n'est appelée que depuis App.jsx lui-même (le wizard,
 * `applyRoutineEditOnce`/`applyRoutineEditPermanently` dans useRoutineActions.js).
 * Elle est simplement longue et dense (calcul de la durée cible, détection de
 * plusieurs trophées liés à la config, boucle de génération avec pause
 * anti-rate-limit, mise à jour de l'historique de routine, navigation finale) —
 * la déplacer réduit la taille d'App.jsx sans changer son architecture.
 *
 * `checkGenreWeightDeviation` vient de `useGeneratorContext()` (appelé ici, comme
 * dans useRoutineActions.js/useNavigation.js). Le state de progression
 * (`isGenerating`/`generatingTotal`/`generatingDone`/`isGeneratingSlowGenre`)
 * reste dans App.jsx — lu directement par son propre JSX (bandeau de
 * progression) et transmis à GeneratorView/RoutinesView, donc pas déplaçable
 * ici ; seuls les setters sont reçus en paramètres.
 */
export function usePlaylistGeneration(
  showToast, userStats, checkTrophies,
  routines, setRoutines,
  favorites, spotifyTrackPool, isNaughtyMode,
  setCurrentPlaylist, changeView,
  savedPlaylists, setSavedPlaylists,
  setIsGenerating, setGeneratingTotal, setGeneratingDone, setIsGeneratingSlowGenre,
) {
  const { checkGenreWeightDeviation } = useGeneratorContext();

  // `savedPlaylistsRef`/`routinesRef`/`userStatsRef` (check-up 10/08 — même
  // famille de course que "Partager"/"Cloner" et "Remplacer un titre"/
  // "Cloner", déjà corrigées ce jour-là dans PlaylistDetailView.jsx/
  // PlaylistDetailContext.jsx) — TOUJOURS la valeur la PLUS RÉCENTE de
  // chacun, mise à jour à CHAQUE rendu (simple assignation, pas un Hook).
  //
  // `executeGeneration` peut tourner plusieurs dizaines de secondes pour un
  // gros lot (voir le bandeau de progression, App.jsx : "+1s de pause
  // volontaire entre chaque playlist") — et `isGenerating` ne bloque QUE
  // l'affichage d'un bandeau, jamais le reste de l'UI (confirmé en lisant
  // App.jsx : aucune modale/overlay, juste un `<div>` flottant). Rien
  // n'empêche donc de renommer/cloner/supprimer une AUTRE playlist, ou de
  // terminer une séance qui débloque un trophée, PENDANT qu'une génération
  // tourne encore. Sans ces refs, les 3 écritures finales de cette fonction
  // (`setSavedPlaylists`/`setRoutines`/`checkTrophies`) utilisaient
  // `savedPlaylists`/`routines`/`userStats` FIGÉS au moment du clic sur
  // "Générer" — pour `savedPlaylists`/`routines` (tous deux synchronisés via
  // `useSyncedCollection.js`), un tableau obsolète manquant une entrée
  // ajoutée entre-temps se traduisait par un vrai `DELETE` envoyé à
  // Supabase pour cette entrée (`useSyncedCollection.js` interprète toute
  // absence comme une suppression) — perte de données réelle, pas juste un
  // affichage incohérent. Pour `userStats` (simple blob local,
  // `usePersistentState`), la conséquence est moindre (pas de suppression)
  // mais réelle quand même : un changement de stats concurrent (ex. un
  // trophée débloqué par une autre action pendant ce temps) pouvait être
  // silencieusement écrasé.
  const savedPlaylistsRef = useRef(savedPlaylists);
  savedPlaylistsRef.current = savedPlaylists;
  const routinesRef = useRef(routines);
  routinesRef.current = routines;
  const userStatsRef = useRef(userStats);
  userStatsRef.current = userStats;

  // Jeton d'annulation "par exécution" — voir cancelGeneration ci-dessous pour
  // le raisonnement complet. Un objet mutable frais { cancelled: false } est
  // créé à CHAQUE appel de executeGeneration et capturé dans sa closure ; ça
  // évite qu'une annulation tardive (ou une 2e génération démarrée entre-temps)
  // ne vienne perturber une exécution différente de celle visée.
  const activeCancelTokenRef = useRef(null);

  /**
   * cancelGeneration — annule la génération EN COURS.
   *
   * Choix assumé : ceci n'interrompt PAS les requêtes réseau Deezer déjà
   * lancées (ça demanderait de faire transiter un signal d'annulation à
   * travers toute la chaîne d'appels de musicEngine.js — buildSegmentTracks,
   * fetchInBatches, searchArtistsForBpm, resolveDeezerGenre, etc., une bonne
   * dizaine de fonctions imbriquées — un chantier trop invasif pour être fait
   * sans pouvoir le tester en conditions réelles, ce sandbox n'ayant ni
   * navigateur ni accès réseau). À la place : le résultat de CETTE exécution
   * est marqué comme à jeter. Concrètement, `executeGeneration` continue de
   * tourner en tâche de fond (elle se termine typiquement en quelques
   * secondes) mais son résultat n'est jamais appliqué (pas de playlist
   * affichée, pas de sauvegarde, pas de trophée, pas de navigation) — voir la
   * vérification juste après la boucle de génération plus bas.
   * Ce qui compte du point de vue utilisateur EST bien résolu : l'interface se
   * débloque immédiatement (`setIsGenerating(false)` ici), donc il/elle peut
   * aussitôt corriger ses critères et relancer une nouvelle génération sans
   * attendre — but réel de la demande ("je devrais pouvoir l'arrêter si j'ai
   * mis de mauvais critères").
   */
  const cancelGeneration = () => {
    if (activeCancelTokenRef.current) activeCancelTokenRef.current.cancelled = true;
    setIsGenerating(false);
    setIsGeneratingSlowGenre(false);
    showToast('Génération annulée.');
  };

  /**
   * Point d'entrée principal de la génération, appelé depuis le wizard (count=1)
   * ou depuis une routine (count=1..10, génération en lot / "batch").
   * Enchaîne : détection de trophées liés à la config (marathon, foudre, HIIT
   * complexe, easter egg Rick Astley) → génération effective de `count`
   * playlist(s) → navigation vers la vue résultat (1 playlist) ou vers
   * l'historique (plusieurs playlists générées d'un coup).
   */
  const executeGeneration = async (config, count = 1, routineId = null) => {
    // Garde-fou : si la distance/durée saisie est vide ou nulle, la durée totale
    // calculée de la séance tombe à 0 seconde. Sans cette vérification, la boucle
    // de génération de morceaux (dans createPlaylistData) ne s'exécute alors
    // jamais et produit silencieusement une playlist VIDE (zéro morceau) — ce qui
    // se manifestait ensuite par un graphique BPM vide, sans qu'aucune erreur
    // n'indique la vraie cause. On bloque maintenant la génération en amont avec
    // un message clair, plutôt que de laisser passer une playlist inutilisable.
    let computedDurationSecs;
    if (config.isIntervalMode) {
      const unitPaceSecs = config.targetMode === 'distance' ? ((parseInt(config.paceMin)||0)*60 + (parseInt(config.paceSec)||0)) : 60;
      computedDurationSecs = (config.segments || []).reduce((sum, s) => sum + (parseFloat(s.durationValue) || 0) * unitPaceSecs, 0);
    } else if (config.targetMode === 'distance') {
      const unitPaceSecs = (parseInt(config.paceMin)||0)*60 + (parseInt(config.paceSec)||0);
      computedDurationSecs = (parseFloat(config.distanceVal) || 0) * unitPaceSecs;
    } else {
      computedDurationSecs = (parseInt(config.hours) || 0) * 3600 + (parseInt(config.minutes) || 0) * 60;
    }
    if (!computedDurationSecs || computedDurationSecs <= 0) {
      showToast("Renseigne une distance ou une durée avant de générer.", 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratingTotal(count);
    setGeneratingDone(0);
    // Nouveau jeton pour CETTE exécution — voir cancelGeneration plus haut.
    // Capturé dans la closure ci-dessous (variable locale `cancelToken`, pas
    // une relecture de la ref au moment de vérifier) : si une 2e génération
    // démarre avant que celle-ci ne se termine, elle posera SON PROPRE jeton
    // dans la ref, sans affecter le jeton de celle-ci, qui reste valide pour
    // savoir si ELLE, spécifiquement, a été annulée.
    const cancelToken = { cancelled: false };
    activeCancelTokenRef.current = cancelToken;
    // Couvre le genre global de la séance ET un éventuel override de genre
    // propre à une portion (mode Fractionné/Crescendo, voir toggleSegmentGenre
    // dans useGeneratorForm.js) — un genre lent choisi seulement sur UNE
    // portion mérite quand même le message, pas seulement s'il est global.
    const involvesSlowGenre = (config.selectedGenres || []).some(g => WEAK_DEEZER_KEYWORD_GENRES.includes(g))
      || (config.segments || []).some(s => (s.selectedGenres || []).some(g => WEAK_DEEZER_KEYWORD_GENRES.includes(g)));
    setIsGeneratingSlowGenre(involvesSlowGenre);
    let statsUpdated = false;
    let newStats = { ...userStats };

    if ((config.targetMode === 'distance' && config.distanceVal >= 42) || (!config.isIntervalMode && config.targetMode === 'time' && config.hours >= 4)) {
      if (!newStats.hasMarathon) { newStats.hasMarathon = true; statsUpdated = true; }
    }
    if ((!config.isIntervalMode && config.bpm >= 180) || (config.targetMode === 'distance' && config.paceMin < 4)) {
      if (!newStats.hasBolt) { newStats.hasBolt = true; statsUpdated = true; }
    }
    if (config.isIntervalMode && config.segments.length >= 5) {
      if (!newStats.hasHiitMaster) { newStats.hasHiitMaster = true; statsUpdated = true; }
    }
    if (config.workoutName && config.workoutName.toLowerCase().includes('rick astley')) {
      if (!newStats.hasRickroll) { newStats.hasRickroll = true; statsUpdated = true; }
    }

    // "Les 3 Visages de l'Effort" — génère au moins une fois chacune des 3
    // structures (Constante / Crescendo / Fractionné). `config` ne porte pas
    // directement `structureMode` (c'est un concept du wizard, voir
    // useGeneratorForm.js) — on le redérive ici à partir des 2 booléens que
    // `config` porte déjà, qui suffisent à distinguer les 3 cas sans ambiguïté.
    const structureKind = !config.isIntervalMode ? 'constant' : (config.isCrescendoMode ? 'crescendo' : 'interval');
    const usedKinds = new Set(newStats.usedStructureKinds || []);
    if (!usedKinds.has(structureKind)) {
      usedKinds.add(structureKind);
      newStats.usedStructureKinds = Array.from(usedKinds);
      statsUpdated = true;
      if (!newStats.hasAllStructures && usedKinds.size >= 3) { newStats.hasAllStructures = true; }
    }

    // "Genres étendus" — génère avec au moins un genre de la liste "+ Plus de
    // genres" (EXTRA_GENRES), jamais visible tant qu'on ne déplie pas ce
    // volet à l'étape des genres.
    if (!newStats.hasExtraGenre && (config.selectedGenres || []).some(g => EXTRA_GENRES.includes(g))) {
      newStats.hasExtraGenre = true; statsUpdated = true;
    }

    // "Mes Favoris" (hasUsedFavorites) déplacé après la génération elle-même
    // (voir plus bas) : BUG CORRIGÉ — la condition ici se basait sur la simple
    // présence de favoris CONFIGURÉS quelque part dans l'app (`favorites.
    // artists.length > 0`), qui vaut TOUJOURS vrai dès l'installation à cause
    // des 2 artistes de démonstration pré-remplis (Metallica, System Of A
    // Down — voir useFavorites.js), et `favorites.useFavorites` qui n'a jamais
    // eu la moindre UI pour être désactivé, donc toujours `true` lui aussi. Un
    // tout nouvel utilisateur qui n'avait jamais rien favorisé lui-même
    // débloquait donc ce trophée dès sa toute première génération, quel que
    // soit le genre/BPM demandé. Vérifié maintenant sur la playlist RÉELLEMENT
    // générée (voir `_fromFavorites`, posé par musicEngine.js uniquement quand
    // un titre vient effectivement de `favorites.tracks`/`favorites.artists`).

    // Historique glissant des titres déjà utilisés par CETTE routine (toutes
    // générations précédentes confondues), pour éviter de reproduire la même
    // playlist à chaque régénération — voir `routine.recentTrackIds`.
    // Volontairement PLAFONNÉ (RECENT_TRACKS_CAP) plutôt qu'illimité : sur une
    // routine à genre/BPM étroit, exclure indéfiniment tous les titres déjà
    // utilisés finirait par vider le pool de candidats et forcer un repli de
    // moins bonne qualité — mieux vaut laisser les plus anciens titres redevenir
    // éligibles après quelques générations que dégrader la qualité pour garantir
    // un "jamais deux fois le même titre" absolu.
    const RECENT_TRACKS_CAP = 60;
    const sourceRoutine = routineId ? routines.find(r => r.id === routineId) : null;
    let rollingExcludeIds = sourceRoutine ? [...(sourceRoutine.recentTrackIds || [])] : [];

    const generatedPlaylists = [];
    for (let i = 0; i < count; i++) {
      const pl = await createPlaylistData(config, rollingExcludeIds, favorites, spotifyTrackPool, isNaughtyMode);
      if (count > 1) pl.name = `${pl.name} (Session ${i + 1})`;
      generatedPlaylists.push(pl);
      setGeneratingDone(i + 1);
      // Les titres de CETTE playlist s'ajoutent immédiatement à l'exclusion pour
      // les sessions SUIVANTES du même lot (ex. "générer 6 fois d'un coup") — sans
      // ça, un lot généré en une fois aurait le même problème de répétition que
      // deux générations séparées dans le temps.
      rollingExcludeIds = [...rollingExcludeIds, ...pl.tracks.map(t => t.trackId)];

      // Annulation en cours de lot (count > 1, ex. routine "générer plusieurs
      // séances d'un coup") : contrairement à une génération réseau isolée,
      // cette boucle EST dans ce fichier, donc on peut réellement s'arrêter
      // ENTRE deux playlists sans attendre les suivantes — pas besoin de
      // toucher musicEngine.js pour ça.
      if (cancelToken.cancelled) break;

      // Petite pause entre deux playlists d'un même lot (pas après la dernière) :
      // générer plusieurs playlists d'affilée déclenche une rafale d'appels Deezer
      // très rapprochés (jusqu'à ~60 par playlist rien que pour le pool principal),
      // ce qui peut atteindre le rate-limiting de Deezer/du proxy Vercel — observé
      // en pratique sur un lot de 10, où les dernières sessions retombaient presque
      // entièrement sur le repli local (faute de réponse Deezer). Cette pause
      // ralentit un peu la génération d'un gros lot, mais réduit le risque que les
      // dernières playlists du lot soient de moins bonne qualité que les premières.
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    setIsGenerating(false);
    setIsGeneratingSlowGenre(false);

    // Génération annulée entre-temps (voir cancelGeneration) : on jette le
    // résultat sans y toucher — pas de trophée, pas de sauvegarde, pas de
    // navigation, pas de toast. `setIsGenerating(false)` a déjà été fait par
    // cancelGeneration lui-même ; l'appel juste au-dessus est donc sans effet
    // ici (idempotent), gardé pour ne pas complexifier le flux normal.
    if (cancelToken.cancelled) return;

    // "Mes Favoris" (hasUsedFavorites) : voir le commentaire plus haut pour le
    // bug corrigé — vérifié ici sur la playlist RÉELLEMENT générée par ce lot,
    // pas sur une simple présence de favoris configurés. `_fromFavorites` posé
    // par musicEngine.js (buildSegmentTracks/getSingleMatchingTrack) UNIQUEMENT
    // quand un titre vient effectivement de `favorites.tracks` ou d'une
    // recherche sur `favorites.artists` — jamais sur un titre qui, par pure
    // coïncidence, se trouve être du même artiste sans être passé par ce chemin.
    if (!newStats.hasUsedFavorites && generatedPlaylists.some(pl => pl.tracks.some(t => t._fromFavorites))) {
      newStats.hasUsedFavorites = true; statsUpdated = true;
    }
    if (statsUpdated) {
      // Rebasé sur `userStatsRef.current` (le PLUS FRAIS, voir la docstring
      // plus haut) plutôt que sur `newStats` tel quel (construit à partir du
      // `userStats` figé au tout début de cette génération) — seuls les
      // champs RÉELLEMENT modifiés par CETTE génération (comparés à
      // `userStats`, la version de départ) sont réappliqués par-dessus,
      // pour ne pas écraser un changement concurrent survenu ailleurs
      // pendant les plusieurs secondes/dizaines de secondes qu'a duré cette
      // génération.
      const touchedKeys = Object.keys(newStats).filter(k => newStats[k] !== userStats[k]);
      const rebasedStats = { ...userStatsRef.current };
      touchedKeys.forEach(k => { rebasedStats[k] = newStats[k]; });
      checkTrophies(rebasedStats);
    }

    if (routineId) {
      // `routinesRef.current` (PAS `routines`, voir la docstring plus haut)
      // — évite qu'une autre routine ajoutée/modifiée pendant cette
      // génération ne soit silencieusement perdue (DELETE côté Supabase via
      // useSyncedCollection.js) au moment d'écrire celle-ci.
      setRoutines(routinesRef.current.map(r => r.id === routineId
        ? { ...r, manualGenerations: (r.manualGenerations || 0) + count, recentTrackIds: rollingExcludeIds.slice(-RECENT_TRACKS_CAP) }
        : r));
    }

    if (count === 1) {
      setCurrentPlaylist(generatedPlaylists[0]);
      changeView('playlist');
      // Transparence : les morceaux ont une durée fixe (on ne peut pas couper une
      // chanson en deux), donc la distance/durée réellement atteinte peut différer
      // légèrement de la cible demandée — mieux vaut le dire que laisser croire à
      // une précision parfaite.
      showToast("🎧 Playlist générée ! Distance/durée réelle : peut légèrement différer de la cible.");
      // Deuxième avertissement, distinct : si une part importante des titres vient
      // du repli de secours (voir fallbackTrackCount), c'est le signe qu'il n'y
      // avait pas assez de vrais candidats pour ce BPM/style — l'utilisateur doit
      // le savoir plutôt que de découvrir silencieusement des titres approximatifs.
      const pl = generatedPlaylists[0];
      if (pl.tracks.length > 0 && pl.fallbackTrackCount / pl.tracks.length >= 0.34) {
        showToast(`⚠️ Peu de titres trouvés à ce BPM/style précis — ${pl.fallbackTrackCount} sur ${pl.tracks.length} viennent d'un choix de secours approximatif.`, 'error');
      }
      const deviations = checkGenreWeightDeviation(pl.tracks, config.genreWeights);
      if (deviations) {
        showToast(`⚠️ Répartition entre genres différente de ce qui était visé : ${deviations.join(', ')}.`, 'error');
      }
    } else {
      // `savedPlaylistsRef.current` (PAS `savedPlaylists`, voir la
      // docstring plus haut) — même raisonnement que `routinesRef` juste
      // au-dessus : un lot de plusieurs playlists peut prendre des dizaines
      // de secondes, largement assez pour qu'une AUTRE playlist soit
      // ajoutée/modifiée/supprimée entre-temps ailleurs dans l'app.
      setSavedPlaylists([...generatedPlaylists, ...savedPlaylistsRef.current]);
      changeView('playlists');
      showToast(`${count} playlists générées ! Distance/durée réelle : peut légèrement différer de la cible.`);
      const totalFallback = generatedPlaylists.reduce((s, p) => s + (p.fallbackTrackCount || 0), 0);
      const totalTracks = generatedPlaylists.reduce((s, p) => s + p.tracks.length, 0);
      if (totalTracks > 0 && totalFallback / totalTracks >= 0.34) {
        showToast(`⚠️ Peu de titres trouvés à ce BPM/style précis sur cette série — pas mal de choix de secours approximatifs.`, 'error');
      }
      const allTracksInBatch = generatedPlaylists.flatMap(p => p.tracks);
      const batchDeviations = checkGenreWeightDeviation(allTracksInBatch, config.genreWeights);
      if (batchDeviations) {
        showToast(`⚠️ Répartition entre genres différente de ce qui était visé sur cette série : ${batchDeviations.join(', ')}.`, 'error');
      }
    }
  };

  return { executeGeneration, cancelGeneration };
}
