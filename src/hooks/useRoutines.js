import { useState } from 'react';
import { NAUGHTY_ROUTINE_NAMES } from '../appConfig';

// Hash simple et stable (même routine → toujours le même résultat, pas
// aléatoire à chaque re-render) utilisé pour attribuer un nom/icône "Intime"
// cohérent à une routine existante, sans jamais modifier ses vraies données
// sauvegardées (nom, config, musiques). Purement cosmétique, à l'affichage
// seulement. Privé à ce fichier — utilisé uniquement par getDisplayRoutine*.
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = (hash * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(hash);
}

/**
 * useRoutines — regroupe l'état des routines sauvegardées (configurations de
 * génération réutilisables en 1 clic) et le formulaire de sauvegarde/édition.
 *
 * `isNaughtyMode` et `showToast` sont des dépendances externes (définies dans
 * App.jsx) passées en paramètre plutôt que dupliquées ici.
 *
 * Note : `handleSaveRoutine` (construction d'une nouvelle routine à partir des
 * réglages actuels du wizard de génération) reste dans App.jsx, car elle a
 * besoin de ~15 valeurs du wizard (bpm, segments, genres...) qui ne font pas
 * partie de ce hook — App.jsx construit l'objet routine, puis appelle
 * `addRoutine(routine)` fourni ici. Même logique pour la mise à jour d'une
 * routine éditée (`updateRoutine`).
 */
export function useRoutines(isNaughtyMode, showToast) {
  const [routines, setRoutines] = useState([{
    id: 'routine-1', name: '🏃‍♂️ Mon 5km Quotidien', workoutType: 'Course à pied', customActivity: '',
    isIntervalMode: false, bpm: 160, selectedGenres: ['Métal', 'Rock'], bpmTolerance: 10, crossfade: 2,
    segments: [], coverIcon: '🏃‍♂️', autoGenFreq: 'Manuel', manualGenerations: 0, recentTrackIds: [],
    targetMode: 'distance', distanceVal: 5, distanceUnit: 'km', paceMin: 5, paceSec: 30, hours: 0, minutes: 27,
    createdAt: new Date().toLocaleDateString()
  }]);
  const [routineBatchCounts, setRoutineBatchCounts] = useState({});
  const [isSavingRoutineModalOpen, setIsSavingRoutineModalOpen] = useState(false);
  // Routine en cours d'édition (copie modifiable, distincte de l'entrée dans
  // `routines` tant que l'utilisateur n'a pas choisi "cette séance seulement"
  // ou "toujours").
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [isEditRoutineModalOpen, setIsEditRoutineModalOpen] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineIcon, setNewRoutineIcon] = useState("⚡");
  const [newRoutineFreq, setNewRoutineFreq] = useState("Manuel");

  const getDisplayRoutineName = (routine) => isNaughtyMode ? NAUGHTY_ROUTINE_NAMES[simpleHash(routine.id) % NAUGHTY_ROUTINE_NAMES.length] : routine.name;
  const getDisplayRoutineIcon = (routine) => isNaughtyMode ? NAUGHTY_ROUTINE_NAMES[simpleHash(routine.id) % NAUGHTY_ROUTINE_NAMES.length].split(' ')[0] : routine.coverIcon;

  // Ajoute une routine déjà construite (App.jsx assemble l'objet à partir des
  // réglages du wizard) et réinitialise le formulaire de sauvegarde.
  const addRoutine = (newRoutine) => {
    setRoutines(prev => [newRoutine, ...prev]);
    setNewRoutineName(""); setNewRoutineIcon("⚡"); setNewRoutineFreq("Manuel");
    setIsSavingRoutineModalOpen(false);
    showToast(`Routine sauvegardée avec succès !`);
  };

  // Écrase la routine sauvegardée correspondante avec la version modifiée.
  const updateRoutine = (updatedRoutine) => {
    setRoutines(prev => prev.map(r => r.id === updatedRoutine.id ? { ...updatedRoutine } : r));
  };

  return {
    routines, setRoutines,
    routineBatchCounts, setRoutineBatchCounts,
    isSavingRoutineModalOpen, setIsSavingRoutineModalOpen,
    editingRoutine, setEditingRoutine,
    isEditRoutineModalOpen, setIsEditRoutineModalOpen,
    newRoutineName, setNewRoutineName,
    newRoutineIcon, setNewRoutineIcon,
    newRoutineFreq, setNewRoutineFreq,
    getDisplayRoutineName, getDisplayRoutineIcon,
    addRoutine, updateRoutine,
  };
}
