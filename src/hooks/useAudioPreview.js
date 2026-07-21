import { useState, useRef } from 'react';
import { resolveDeezerTrackByTitleArtist } from '../musicEngine';

/**
 * useAudioPreview — lecture des extraits audio (30s, fournis par Deezer).
 *
 * Un seul lecteur audio partagé pour toute l'app : lancer un nouvel extrait
 * coupe automatiquement celui en cours. `previewAudioRef` est créé une seule
 * fois (lazy, via useRef) plutôt qu'avec useState pour éviter de recréer un
 * objet Audio à chaque re-render.
 *
 * `showToast` est une dépendance externe (définie dans App.jsx) passée en
 * paramètre, utilisée pour signaler un échec de lecture/reprise/résolution.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MINI-LECTEUR PERSISTANT (retour direct : "l'extrait s'arrête dès qu'on
 * change de page") — `currentTrack` (le TITRE COMPLET, pas juste son id) est
 * exposé en state RÉACTIF (contrairement à `currentTrackRef`, une simple ref
 * invisible en dehors de ce hook) : un composant de mini-lecteur global (voir
 * MiniPlayerBar.jsx, monté une fois dans App.jsx, visible sur toutes les
 * vues) peut ainsi afficher titre/artiste sans dépendre d'un re-render
 * déclenché ailleurs.
 *
 * `isPlaying` est VOLONTAIREMENT distinct de `playingPreviewId` :
 *   - `playingPreviewId` garde son comportement HISTORIQUE ("stop & oublie"
 *     dès qu'on re-clique la même ligne dans une liste, voir `togglePreview`
 *     — inchangé, les listes existantes n'ont rien à changer).
 *   - `isPlaying`/`currentTrack` alimentent 3 actions dédiées au
 *     mini-lecteur (`pauseCurrentPreview`/`resumeCurrentPreview`/
 *     `stopCurrentPreview`) : une VRAIE pause n'efface PAS `currentTrack` (le
 *     titre reste affiché dans la barre, prêt à reprendre), contrairement au
 *     toggle des listes qui, lui, oublie tout.
 *
 * RETOUR DIRECT ("boutons précédent/suivant depuis le mini-lecteur") —
 * `resolveAndPlay` est déplacée ICI depuis PlaylistDetailView.jsx (qui en
 * avait sa propre copie locale, retirée — voir ce fichier) : le mini-lecteur
 * étant GLOBAL (visible sur toutes les vues, monté une fois dans App.jsx),
 * il a besoin de pouvoir résoudre/lire un titre sans dépendre de la vue
 * actuellement affichée. `skipToNext`/`skipToPrevious` réutilisent cette
 * même fonction : ils prennent en paramètre le tableau de titres à
 * parcourir (fourni par l'appelant — App.jsx, avec `currentPlaylist.tracks`
 * — ce hook reste volontairement ignorant de la forme d'une "playlist").
 */
export function useAudioPreview(showToast) {
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Titre en cours de résolution (recherche Deezer par titre+artiste) —
  // sert d'indicateur de chargement ET empêche un double-clic rapide de
  // lancer 2 résolutions concurrentes pour le même titre.
  const [resolvingTrackId, setResolvingTrackId] = useState(null);
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

  /**
   * Résout l'extrait à la demande (recherche Deezer par titre+artiste) SI
   * besoin, puis joue le titre — sinon appelle directement `playTrack`. Ne
   * met PAS en cache le résultat dans une playlist quelconque (ce hook ne
   * connaît aucune forme de "playlist") : renvoie le titre mis à jour
   * (`youtubeId`/`preview` résolus) pour que l'appelant fasse ce qu'il veut
   * de cette mise en cache (voir PlaylistDetailView.jsx, qui l'écrit dans
   * `currentPlaylist.tracks`).
   */
  const resolveAndPlay = async (track, getNextTrack) => {
    if (track.preview) { playTrack(track, getNextTrack); return track; }
    if (resolvingTrackId === track.id) return null;

    setResolvingTrackId(track.id);
    try {
      const resolved = await resolveDeezerTrackByTitleArtist(track.title, track.artist);
      if (!resolved || !resolved.preview) {
        showToast("Extrait audio introuvable pour ce titre.", 'error');
        return null;
      }
      const updatedTrack = { ...track, youtubeId: `deezer-${resolved.id}`, preview: resolved.preview };
      playTrack(updatedTrack, getNextTrack);
      return updatedTrack;
    } finally {
      setResolvingTrackId(null);
    }
  };

  // Précédent/suivant DANS L'ORDRE DE LA PLAYLIST fournie par l'appelant
  // (pas parmi les seuls titres déjà résolus, contrairement à l'enchaînement
  // automatique en fin d'extrait ci-dessus) — retrouve le titre en cours par
  // `id` (stable, contrairement à `youtubeId` qui change lors d'une
  // résolution), calcule l'index voisin en bouclant (dernier → 1er et
  // inversement), et réutilise le même résolveur d'enchaînement déjà actif
  // pour que la suite continue de fonctionner normalement après ce saut
  // manuel.
  const skipByOffset = (tracks, offset) => {
    const current = currentTrackRef.current;
    if (!current || !tracks || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === current.id);
    if (idx === -1) return;
    const targetIdx = (idx + offset + tracks.length) % tracks.length;
    resolveAndPlay(tracks[targetIdx], autoAdvanceResolverRef.current);
  };
  const skipToNext = (tracks) => skipByOffset(tracks, 1);
  const skipToPrevious = (tracks) => skipByOffset(tracks, -1);

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
    resolveAndPlay, resolvingTrackId,
    skipToNext, skipToPrevious,
  };
}
