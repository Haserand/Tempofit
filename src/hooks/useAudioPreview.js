import { useState, useRef, useEffect } from 'react';

/**
 * useAudioPreview — lecture des extraits audio (30s, fournis par Deezer).
 *
 * Un seul lecteur audio partagé pour toute l'app : lancer un nouvel extrait
 * coupe automatiquement celui en cours. `previewAudioRef` est créé une seule
 * fois (lazy, via useRef) plutôt qu'avec useState pour éviter de recréer un
 * objet Audio à chaque re-render.
 *
 * `isSearchModalOpen` et `showToast` sont des dépendances externes (définies
 * dans App.jsx) passées en paramètre : la première pour couper l'extrait en
 * cours quand la modale de recherche se ferme, la seconde pour signaler un
 * échec de lecture.
 */
export function useAudioPreview(isSearchModalOpen, showToast) {
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const previewAudioRef = useRef(null);

  const togglePreview = (track) => {
    if (!track.preview) return;
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.addEventListener('ended', () => setPlayingPreviewId(null));
    }
    const audio = previewAudioRef.current;
    if (playingPreviewId === track.youtubeId) {
      audio.pause();
      setPlayingPreviewId(null);
    } else {
      audio.src = track.preview;
      audio.currentTime = 0;
      audio.play().catch(() => showToast("Impossible de lire cet extrait.", 'error'));
      setPlayingPreviewId(track.youtubeId);
    }
  };

  // Coupe l'extrait en cours si la modale de recherche se ferme, pour ne pas
  // laisser un aperçu jouer en arrière-plan une fois la fenêtre fermée.
  useEffect(() => {
    if (!isSearchModalOpen && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreviewId(null);
    }
  }, [isSearchModalOpen]);

  return { playingPreviewId, togglePreview };
}
