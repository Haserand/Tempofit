import { useState } from 'react';

/**
 * useCustomActivity — regroupe l'état de la modale "Activité personnalisée",
 * ouverte quand l'utilisateur choisit "Autre" comme type d'activité à
 * l'étape 1 du wizard de génération.
 *
 * `setWorkoutType` est une dépendance externe (le state du workoutType vit
 * dans le formulaire du générateur, pas encore extrait dans un hook dédié) —
 * passée en paramètre plutôt que dupliquée ici.
 */
export function useCustomActivity(setWorkoutType) {
  const [customActivity, setCustomActivity] = useState('');
  // Copie de travail éditée dans la modale, distincte de `customActivity` tant
  // que l'utilisateur n'a pas validé — permet d'annuler sans perdre l'ancienne valeur.
  const [tempCustomActivity, setTempCustomActivity] = useState('');
  const [isCustomActivityModalOpen, setIsCustomActivityModalOpen] = useState(false);

  const handleOpenCustomActivityModal = () => {
    setWorkoutType('Autre');
    setTempCustomActivity(customActivity);
    setIsCustomActivityModalOpen(true);
  };

  return {
    customActivity, setCustomActivity,
    tempCustomActivity, setTempCustomActivity,
    isCustomActivityModalOpen, setIsCustomActivityModalOpen,
    handleOpenCustomActivityModal,
  };
}
