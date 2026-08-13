import { useState, useRef } from 'react';

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
 *
 * ⚠️ BUG CORRIGÉ (13/08, trouvé en écrivant le test dédié — voir
 * useToast.test.js) : chaque appel de `showToast` posait son propre
 * `setTimeout`, sans jamais annuler celui d'un appel précédent encore en
 * vol. Deux toasts affichés à quelques secondes d'écart (ex. un toast
 * "special" 5s suivi de près par un toast "error" 8s) pouvaient donc voir
 * le SECOND toast effacé prématurément par le minuteur du PREMIER, avant sa
 * propre durée écoulée — un vrai souci pour 'error' (8s, pensé pour laisser
 * le temps de lire) écrasé par un toast plus court parti juste avant. Un
 * `useRef` mémorise désormais le timer en cours ; `showToast` l'annule
 * (`clearTimeout`) avant d'en poser un nouveau — un seul toast affiché à la
 * fois, sa propre durée toujours respectée jusqu'au bout.
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = (message, variant = 'default') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, variant });
    const duration = variant === 'default' ? 3000 : variant === 'error' ? 8000 : 5000;
    timerRef.current = setTimeout(() => { setToast(null); timerRef.current = null; }, duration);
  };

  return { toast, showToast };
}
