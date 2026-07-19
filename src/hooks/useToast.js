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
 *   - 'error'    (8s) : échec/erreur à signaler clairement (icône alerte
 *     rouge) — retour direct ("pas le temps de lire le message d'erreur") :
 *     partageait avant les mêmes 5s que 'special'/'ambiance', des
 *     confirmations positives courtes qu'on n'a pas vraiment besoin de LIRE
 *     en détail. Une erreur, si, surtout quand le message explique une
 *     cause externe à l'app (ex. compte développeur Spotify) — durée séparée
 *     et allongée, pas juste une valeur commune remontée pour tout le monde.
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
    const duration = variant === 'default' ? 3000 : variant === 'error' ? 8000 : 5000;
    setTimeout(() => setToast(null), duration);
  };

  return { toast, showToast };
}
