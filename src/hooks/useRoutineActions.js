import { useGeneratorContext } from '../contexts/GeneratorContext';
import { useModalContext } from '../contexts/ModalContext';

/**
 * useRoutineActions — regroupe les 4 actions qui lisent/écrivent le state du wizard
 * de génération (`GeneratorContext`) en dehors du wizard lui-même : basculer Mode
 * Standard/Intime, sauvegarder la config actuelle comme routine réutilisable, et
 * appliquer une routine éditée (une fois ou en permanence).
 *
 * Extrait d'App.jsx (25/07, chantier "réduire le God Component") : contrairement à
 * usePlaylistCompletions.js/usePlaylistLibrary.js, ce hook appelle lui-même
 * `useGeneratorContext()` plutôt que de recevoir chaque champ du wizard en
 * paramètre (~20 valeurs) — légitime ici car c'est un CONTEXTE React, prévu par
 * conception pour plusieurs points de lecture simultanés du même Provider, pas un
 * hook à état comme `useRoutines`/`useFavorites` (appeler CE genre de hook 2 fois
 * créerait 2 instances de state indépendantes — jamais fait ici). Les dépendances
 * restantes (`routines`/`addRoutine`/`updateRoutine`/`editingRoutine`/... viennent
 * de l'UNIQUE appel à `useRoutines()` déjà fait dans App.jsx, `executeGeneration`
 * reste dans App.jsx vu sa taille) sont reçues en paramètres classiques.
 * `closeModal` (ModalContext, chantier "centraliser les modales", même jour)
 * suit le même principe que `useGeneratorContext()` ci-dessus : appelé ici
 * directement plutôt que reçu en paramètre, pour fermer EditRoutineModal après
 * application (`applyRoutineEditOnce`/`applyRoutineEditPermanently`).
 * Comportement strictement identique à l'original.
 */
export function useRoutineActions(
  isNaughtyMode, setIsNaughtyMode, showToast,
  routines, addRoutine, updateRoutine,
  editingRoutine, setEditingRoutine,
  newRoutineName, newRoutineIcon, newRoutineFreq,
  userStats, checkTrophies, executeGeneration,
) {
  const { closeModal } = useModalContext();
  const {
    workoutType, customActivity, isIntervalMode, isCrescendoMode, bpm,
    crescendoWarmupPct, crescendoCooldownPct, crescendoWarmupBpm, crescendoCooldownBpm,
    targetMode, distanceVal, distanceUnit, paceMin, paceSec, hours, minutes,
    selectedGenres, bpmTolerance, crossfade, allowLongTracks, genreWeights, segments,
    setBpm, setBpmTolerance, setSelectedGenres, setGenreWeights, setLockedGenreWeights,
    setTargetMode, setCrossfade,
  } = useGeneratorContext();

  // Bascule le "mode Intime" : change à la volée les réglages par défaut
  // (BPM plus bas, genres différents, crossfade plus long...) pour coller à
  // l'ambiance, et les restaure au retour au mode standard.
  const toggleNaughtyMode = () => {
    if (!isNaughtyMode) {
      setIsNaughtyMode(true);
      // isIntervalMode n'est plus forcé à false ici : le mode Fractionné reste
      // proposé en mode Intime (voir étape 2 du wizard), donc son état ne doit
      // plus être écrasé silencieusement à l'activation du mode.
      setBpm(85); setBpmTolerance(15); setSelectedGenres(['R&B Sensuel']); setGenreWeights({ 'R&B Sensuel': 100 }); setLockedGenreWeights(new Set()); setTargetMode('time');
      setCrossfade(5);
      showToast("Ambiance intime activée...", 'ambiance');
    } else {
      setIsNaughtyMode(false);
      setBpm(160); setBpmTolerance(10); setSelectedGenres(['Métal']); setGenreWeights({ 'Métal': 100 }); setLockedGenreWeights(new Set()); setCrossfade(2);
      showToast("Retour au mode Standard !");
    }
  };

  // Sauvegarde la configuration actuelle du wizard comme routine réutilisable.
  const handleSaveRoutine = () => {
    const finalName = newRoutineName.trim() || `Routine ${workoutType === 'Autre' ? customActivity || 'Personnalisée' : workoutType}`;
    const newRoutine = {
      id: `routine-${Date.now()}`, name: finalName, workoutType,
      customActivity: workoutType === 'Autre' ? customActivity : '', isIntervalMode, isCrescendoMode, bpm,
      crescendoWarmupPct, crescendoCooldownPct, crescendoWarmupBpm, crescendoCooldownBpm,
      targetMode, distanceVal, distanceUnit, paceMin, paceSec, hours, minutes, selectedGenres, bpmTolerance, crossfade, allowLongTracks, genreWeights,
      segments: isIntervalMode ? [...segments] : [], coverIcon: newRoutineIcon, autoGenFreq: newRoutineFreq,
      manualGenerations: 0, recentTrackIds: [], createdAt: new Date().toLocaleDateString()
    };
    addRoutine(newRoutine);

    // "Créer une Routine" — sauvegarder sa toute première routine.
    // "Génération automatique" — activer l'auto-génération dessus (pas juste
    // "Manuel") dès la création. Les deux sont de la pure découverte de
    // fonctionnalité, vérifiées indépendamment l'une de l'autre.
    let newFlags = {};
    if (routines.length === 0 && !userStats.hasFirstRoutine) newFlags.hasFirstRoutine = true;
    if (newRoutineFreq !== 'Manuel' && !userStats.hasAutoGen) newFlags.hasAutoGen = true;
    if (Object.keys(newFlags).length > 0) checkTrophies({ ...userStats, ...newFlags });
  };

  /**
   * Lance une génération à partir de `editingRoutine` (la version modifiée dans la
   * modale d'édition), sans jamais toucher à la routine sauvegardée dans `routines`.
   * Utilisée par le bouton "Cette séance seulement".
   */
  const applyRoutineEditOnce = () => {
    if (!editingRoutine) return;
    executeGeneration({ ...editingRoutine, workoutName: editingRoutine.customActivity || editingRoutine.workoutType, routineName: editingRoutine.name }, 1, editingRoutine.id);
    closeModal();
    setEditingRoutine(null);
  };

  /**
   * Écrase la routine sauvegardée avec les valeurs modifiées dans `editingRoutine`,
   * PUIS lance une génération avec ces nouvelles valeurs. Utilisée par le bouton
   * "Toujours pour cette routine".
   */
  const applyRoutineEditPermanently = () => {
    if (!editingRoutine) return;
    updateRoutine(editingRoutine);
    executeGeneration({ ...editingRoutine, workoutName: editingRoutine.customActivity || editingRoutine.workoutType, routineName: editingRoutine.name }, 1, editingRoutine.id);
    showToast("Routine mise à jour pour toutes les prochaines séances.");
    closeModal();
    setEditingRoutine(null);
  };

  return { toggleNaughtyMode, handleSaveRoutine, applyRoutineEditOnce, applyRoutineEditPermanently };
}
