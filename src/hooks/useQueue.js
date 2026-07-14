import { useState } from 'react';

/**
 * useQueue — "Ma file d'attente" : un ORDRE logique de playlists déjà
 * générées et sauvegardées, pas un calendrier avec des dates. Le premier
 * élément de la file est "la prochaine séance", sans notion d'heure précise —
 * volontairement simple, pour un besoin qui n'a jamais vraiment été une
 * question de date (2 séances le même jour, l'une puis l'autre, peu importe
 * l'heure exacte).
 *
 * Stocke uniquement une liste ORDONNÉE d'IDs de playlists (pas les playlists
 * elles-mêmes, déjà dans `savedPlaylists`) — la file référence des playlists
 * déjà figées, elle ne les régénère jamais. Si une playlist référencée est
 * supprimée de `savedPlaylists` par ailleurs, elle doit simplement être
 * ignorée à l'affichage (voir QueueView) plutôt que de planter.
 */
export function useQueue() {
  const [queue, setQueue] = useState([]); // tableau d'IDs de playlist, dans l'ordre

  // Ajoute en fin de file (prochaine séance après tout ce qui est déjà prévu).
  // Ignore silencieusement si déjà présente, plutôt que de la dupliquer.
  const addToQueue = (playlistId) => {
    setQueue(prev => prev.includes(playlistId) ? prev : [...prev, playlistId]);
  };

  const removeFromQueue = (playlistId) => {
    setQueue(prev => prev.filter(id => id !== playlistId));
  };

  const isInQueue = (playlistId) => queue.includes(playlistId);

  // Déplace une playlist d'un cran dans la file (direction : -1 = plus tôt,
  // +1 = plus tard). Ne fait rien si déjà en bout de file dans ce sens.
  const moveInQueue = (playlistId, direction) => {
    setQueue(prev => {
      const idx = prev.indexOf(playlistId);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  return { queue, setQueue, addToQueue, removeFromQueue, isInQueue, moveInQueue };
}
