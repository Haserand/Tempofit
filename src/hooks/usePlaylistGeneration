import { EXTRA_GENRES, WEAK_DEEZER_KEYWORD_GENRES } from '../musicCatalog';
import { createPlaylistData } from '../musicEngine';
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
    if (statsUpdated) checkTrophies(newStats);

    if (routineId) {
      setRoutines(routines.map(r => r.id === routineId
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
      setSavedPlaylists([...generatedPlaylists, ...savedPlaylists]);
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

  return { executeGeneration };
}
