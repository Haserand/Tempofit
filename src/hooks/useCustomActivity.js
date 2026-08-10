import { useState, useCallback, useMemo } from 'react';

/**
 * useCustomActivity — regroupe l'état de la modale "Activité personnalisée",
 * ouverte quand l'utilisateur choisit "Autre" comme type d'activité à
 * l'étape 1 du wizard de génération.
 *
 * `setWorkoutType` est une dépendance externe (le state du workoutType vit
 * dans le formulaire du générateur, pas encore extrait dans un hook dédié) —
 * passée en paramètre plutôt que dupliquée ici.
 *
 * ⚠️ RETOUR MÉMOÏSÉ (08/08, chantier "CustomActivityModal.jsx re-rend à
 * chaque réglage du wizard") — `handleOpenCustomActivityModal` est
 * maintenant un `useCallback` (au lieu d'une fonction recréée à chaque
 * rendu), et l'objet retourné par ce hook est lui-même enveloppé dans un
 * `useMemo`. Nécessaire pour que `CustomActivityContext.jsx` (qui
 * réexpose ce retour tel quel, voir sa docstring) puisse à son tour rester
 * stable — sans ça, ce hook renverrait un objet neuf à chaque rendu de
 * `GeneratorProvider` (à chaque réglage du wizard), rendant toute
 * mémoïsation en aval inutile, peu importe les efforts faits plus haut.
 * `setWorkoutType`/les setters de `useState` sont déjà garantis stables par
 * React lui-même (jamais recréés) — seules dépendances réelles du
 * `useCallback`/`useMemo` ci-dessous : `customActivity` (lu par
 * `handleOpenCustomActivityModal`) et les 3 valeurs d'état.
 */
export function useCustomActivity(setWorkoutType) {
  const [customActivity, setCustomActivity] = useState('');
  // Copie de travail éditée dans la modale, distincte de `customActivity` tant
  // que l'utilisateur n'a pas validé — permet d'annuler sans perdre l'ancienne valeur.
  const [tempCustomActivity, setTempCustomActivity] = useState('');
  const [isCustomActivityModalOpen, setIsCustomActivityModalOpen] = useState(false);

  const handleOpenCustomActivityModal = useCallback(() => {
    setWorkoutType('Autre');
    setTempCustomActivity(customActivity);
    setIsCustomActivityModalOpen(true);
  }, [setWorkoutType, customActivity]);

  return useMemo(() => ({
    customActivity, setCustomActivity,
    tempCustomActivity, setTempCustomActivity,
    isCustomActivityModalOpen, setIsCustomActivityModalOpen,
    handleOpenCustomActivityModal,
  }), [customActivity, tempCustomActivity, isCustomActivityModalOpen, handleOpenCustomActivityModal]);
}
