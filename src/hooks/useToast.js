import { useState } from 'react';

/**
 * useToast — affiche un toast de notification temporaire, utilisé dans toute
 * l'app (favoris, routines, trophées, partage, import CSV...).
 *
 * `variant` détermine le style et la durée d'affichage :
 *   - 'default'  (3s) : confirmation neutre (icône check)
 *   - 'special'  (5s) : déblocage de trophée UNIQUEMENT (icône trophée dorée)
 *   - 'ambiance' (5s) : mise en avant positive générique, ex. activation du
 *     mode Intime (icône cœur rose) — distinct de 'special' pour ne jamais
 *     laisser croire qu'un trophée vient d'être débloqué quand ce n'est pas
 *     le cas (retour direct après confusion sur ce point précis)
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
