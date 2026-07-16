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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ENCHAÎNEMENT AUTOMATIQUE (retour direct : "quand je finis un morceau ça
 * doit passer au suivant") — `togglePreview` accepte maintenant un 2e
 * argument OPTIONNEL, `getNextTrack(endedTrack) => Track|null` : appelé
 * uniquement quand l'extrait se termine NATURELLEMENT (l'événement `ended`
 * du <audio>, jamais sur une pause manuelle), pas à chaque frappe — sans ça,
 * relancer togglePreview() sur le MÊME titre depuis la liste (toggle pause)
 * n'a pas à déclencher d'enchaînement, seule une vraie fin de lecture compte.
 * Un appelant qui n'a aucun concept d'ordre (recherche manuelle, favoris) omet
 * simplement ce 2e argument — comportement inchangé, l'extrait s'arrête comme
 * avant.
 *
 * Recalculé à CHAQUE fin d'extrait plutôt que figé au moment du clic (via
 * `autoAdvanceResolverRef`, une ref, pas une valeur capturée dans la
 * fermeture) : si la playlist est réordonnée pendant la lecture (glisser-
 * déposer sur la courbe ou la liste), le "titre suivant" réel reste à jour
 * plutôt que de pointer vers une position devenue obsolète.
 *
 * L'écouteur `ended` n'est posé qu'UNE SEULE FOIS sur l'objet Audio (lazy,
 * comme avant) mais indirectement via `handleEndedRef` (une ref mise à jour
 * à chaque rendu) — sans cette indirection, l'écouteur poser au tout premier
 * appel resterait figé sur la fermeture (closure) de CE moment-là, avec un
 * `showToast`/`getNextTrack` potentiellement obsolètes pour tous les appels
 * suivants.
 */
export function useAudioPreview(isSearchModalOpen, showToast) {
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
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
      currentTrackRef.current = null;
      autoAdvanceResolverRef.current = null;
    }
  };

  const togglePreview = (track, getNextTrack) => {
    if (!track.preview) return;
    if (playingPreviewId === track.youtubeId) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setPlayingPreviewId(null);
      currentTrackRef.current = null;
      autoAdvanceResolverRef.current = null;
    } else {
      playTrack(track, getNextTrack);
    }
  };

  // Coupe l'extrait en cours si la modale de recherche se ferme, pour ne pas
  // laisser un aperçu jouer en arrière-plan une fois la fenêtre fermée.
  useEffect(() => {
    if (!isSearchModalOpen && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreviewId(null);
      currentTrackRef.current = null;
      autoAdvanceResolverRef.current = null;
    }
  }, [isSearchModalOpen]);

  return { playingPreviewId, togglePreview };
}
