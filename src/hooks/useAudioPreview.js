import { useState, useRef } from 'react';

/**
 * useAudioPreview — lecture des extraits audio (30s, fournis par Deezer).
 *
 * Un seul lecteur audio partagé pour toute l'app : lancer un nouvel extrait
 * coupe automatiquement celui en cours. `previewAudioRef` est créé une seule
 * fois (lazy, via useRef) plutôt qu'avec useState pour éviter de recréer un
 * objet Audio à chaque re-render.
 *
 * `showToast` est une dépendance externe (définie dans App.jsx) passée en
 * paramètre, utilisée pour signaler un échec de lecture/reprise.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MINI-LECTEUR PERSISTANT (retour direct : "l'extrait s'arrête dès qu'on
 * change de page") — `currentTrack` (le TITRE COMPLET, pas juste son id) est
 * maintenant exposé en state RÉACTIF (contrairement à `currentTrackRef`, une
 * simple ref invisible en dehors de ce hook) : un composant de mini-lecteur
 * global (voir MiniPlayerBar.jsx, monté une fois dans App.jsx, visible sur
 * toutes les vues) peut ainsi afficher titre/artiste sans dépendre d'un
 * re-render déclenché ailleurs.
 *
 * `isPlaying` est VOLONTAIREMENT distinct de `playingPreviewId` :
 *   - `playingPreviewId` garde son comportement HISTORIQUE ("stop & oublie"
 *     dès qu'on re-clique la même ligne dans une liste, voir `togglePreview`
 *     — inchangé, les listes existantes n'ont rien à changer).
 *   - `isPlaying`/`currentTrack` alimentent 3 nouvelles actions dédiées au
 *     mini-lecteur (`pauseCurrentPreview`/`resumeCurrentPreview`/
 *     `stopCurrentPreview`) : une VRAIE pause n'efface PAS `currentTrack` (le
 *     titre reste affiché dans la barre, prêt à reprendre), contrairement au
 *     toggle des listes qui, lui, oublie tout.
 *
 * Ancien comportement retiré : couper l'extrait à la fermeture de la modale
 * de recherche n'a plus lieu d'être — c'était pour éviter qu'un extrait
 * continue de jouer invisiblement une fois la fenêtre fermée ; maintenant
 * qu'il existe un mini-lecteur qui le représente et le contrôle en
 * permanence, il n'y a plus rien d'"invisible" à ce sujet.
 */
export function useAudioPreview(showToast) {
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewAudioRef = useRef(null);
  // Le titre RÉELLEMENT chargé dans le lecteur en ce moment — distinct de
  // `playingPreviewId` (state React, pas toujours à jour de façon synchrone
  // au moment où `ended` se déclenche) : on a besoin de l'objet TITRE complet
  // (pas juste son id) pour pouvoir demander "et après lui, quoi ?".
  const currentTrackRef = useRef(null);
  const autoAdvanceResolverRef = useRef(null);
  const handleEndedRef = useRef(() => {});

  const playTrack = (track, getNextTrack) => {
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.addEventListener('ended', () => handleEndedRef.current());
    }
    currentTrackRef.current = track;
    autoAdvanceResolverRef.current = getNextTrack || null;
    const audio = previewAudioRef.current;
    audio.src = track.preview;
    audio.currentTime = 0;
    audio.play().catch(() => showToast("Impossible de lire cet extrait.", 'error'));
    setPlayingPreviewId(track.youtubeId);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  // Réassigné à CHAQUE rendu (pas dans un useEffect : pas besoin d'attendre
  // un montage, juste la fermeture la plus fraîche possible avant le prochain
  // "ended" éventuel) — voir la docstring plus haut pour pourquoi cette
  // indirection est nécessaire.
  handleEndedRef.current = () => {
    const endedTrack = currentTrackRef.current;
    const getNextTrack = autoAdvanceResolverRef.current;
    const nextTrack = (getNextTrack && endedTrack) ? getNextTrack(endedTrack) : null;
    if (nextTrack && nextTrack.preview) {
      playTrack(nextTrack, getNextTrack);
    } else {
      // Fin de la playlist (ou pas d'enchaînement demandé) : comportement
      // identique à avant cette évolution.
      setPlayingPreviewId(null);
      setCurrentTrack(null);
      setIsPlaying(false);
      currentTrackRef.current = null;
      autoAdvanceResolverRef.current = null;
    }
  };

  const togglePreview = (track, getNextTrack) => {
    if (!track.preview) return;
    if (playingPreviewId === track.youtubeId) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setPlayingPreviewId(null);
      setCurrentTrack(null);
      setIsPlaying(false);
      currentTrackRef.current = null;
      autoAdvanceResolverRef.current = null;
    } else {
      playTrack(track, getNextTrack);
    }
  };

  // Pause SANS effacer `currentTrack` — dédiée au mini-lecteur (voir la
  // docstring plus haut) : le titre reste affiché dans la barre, prêt à
  // reprendre, contrairement au toggle des listes ci-dessus qui oublie tout.
  const pauseCurrentPreview = () => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setIsPlaying(false);
  };
  // Reprend EXACTEMENT où l'extrait avait été mis en pause (`currentTime`
  // inchangé, contrairement à `playTrack` qui repart toujours de 0) — sinon
  // rouvrir la lecture depuis le mini-lecteur relancerait l'extrait depuis
  // le début à chaque pause/reprise.
  const resumeCurrentPreview = () => {
    if (previewAudioRef.current && currentTrackRef.current) {
      previewAudioRef.current.play().catch(() => showToast("Impossible de reprendre la lecture.", 'error'));
      setIsPlaying(true);
    }
  };
  // Fermeture complète du mini-lecteur (croix) — arrête tout ET efface le
  // titre affiché, contrairement à la pause ci-dessus.
  const stopCurrentPreview = () => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPlayingPreviewId(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    currentTrackRef.current = null;
    autoAdvanceResolverRef.current = null;
  };

  return {
    playingPreviewId, togglePreview,
    currentTrack, isPlaying,
    pauseCurrentPreview, resumeCurrentPreview, stopCurrentPreview,
  };
}
