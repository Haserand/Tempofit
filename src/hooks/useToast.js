import { useState } from 'react';

/**
 * useToast — affiche un toast de notification temporaire, utilisé dans toute
 * l'app (favoris, routines, trophées, partage, import CSV...).
 *
 * `variant` détermine le style et la durée d'affichage :
 *   - 'default' (3s) : confirmation neutre (icône check)
 *   - 'special'  (5s) : mise en avant positive, ex. déblocage de trophée (icône trophée dorée)
 *   - 'error'    (5s) : échec/erreur à signaler clairement (icône alerte rouge)
 *
 * C'est le hook le plus simple de tous ceux créés jusqu'ici, mais aussi le
 * plus transversal : presque tous les autres hooks (useFavorites, useRoutines,
 * useUserStats, useShare, useAudioPreview...) reçoivent `showToast` en
 * paramètre plutôt que de le dupliquer, pour garder un seul système de toast
 * dans toute l'app.
 */
export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = (message, variant = 'default') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), variant === 'default' ? 3000 : 5000);
  };

  return { toast, showToast };
}
