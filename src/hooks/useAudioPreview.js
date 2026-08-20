import { useState, useRef, useMemo } from 'react';
import { resolveDeezerTrackByTitleArtist } from '../engine/musicEngine';

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
  // AJOUTÉ (19/08, check-up global) — même convention que
  // `csvUploadTargetDateRef` dans useCsvImport.js (correctif du même jour) :
  // permet à `resolveAndPlay` de savoir, APRÈS son `await` réseau, si une
  // AUTRE résolution a démarré entre-temps pour un titre différent (state
  // React lu directement serait figé dans la fermeture d'origine).
  //
  // ⚠️ BUG CORRIGÉ (même jour, rattrapé par le build Vercel réel AVANT tout
  // déploiement — voir les logs) : la 1ère version de ce correctif ne
  // mettait à jour ce ref QU'ICI, à chaque RENDU (`resolvingTrackIdRef.current
  // = resolvingTrackId`) — jamais au moment même de l'appel à
  // `setResolvingTrackId` dans `resolveAndPlay`. Comme un `setState` ne
  // déclenche un re-rendu (donc cette ligne) qu'au tour suivant de la
  // boucle d'événements, et JAMAIS de façon synchrone, rien ne garantissait
  // que React ait eu le temps de re-render avant que l'`await` de
  // `resolveAndPlay` ne se résolve — la comparaison
  // `resolvingTrackIdRef.current !== track.id` pouvait alors être FAUSSE
  // MÊME SANS AUCUNE COURSE RÉELLE, sur une résolution parfaitement seule
  // : le ref lisait encore SA VALEUR D'AVANT L'APPEL. Détecté par
  // `tests/hooks/useAudioPreview.test.js` en environnement de test (mock
  // résolu quasi instantanément, plus rapide que le cycle de rendu React),
  // mais le même risque existe en production dès que
  // `resolveDeezerTrackByTitleArtist` répond plus vite que le rendu suivant
  // — pas garanti impossible avec un réseau rapide/en cache. Corrigé en
  // écrivant CE REF DIRECTEMENT, de façon SYNCHRONE, au moment même de
  // chaque `setResolvingTrackId` dans `resolveAndPlay` (voir plus bas) —
  // la ligne ci-dessous reste utile en complément (rattrape un changement
  // venu d'ailleurs qu'un rendu), mais n'est plus la SEULE source de
  // vérité.
  const resolvingTrackIdRef = useRef(null);
  resolvingTrackIdRef.current = resolvingTrackId;

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
    setPlayingPreviewId(track.trackId);
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
    if (playingPreviewId === track.trackId) {
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
   * (`trackId`/`preview` résolus) pour que l'appelant fasse ce qu'il veut
   * de cette mise en cache (voir PlaylistDetailView.jsx, qui l'écrit dans
   * `currentPlaylist.tracks`).
   *
   * ⚠️ COURSE CORRIGÉE (19/08, check-up global — même famille que
   * useCsvImport.js, corrigé le même jour) : le garde-fou
   * `resolvingTrackId === track.id` ci-dessous ne bloque qu'un double-clic
   * sur LE MÊME titre — rien n'empêchait de cliquer un titre B pendant que
   * la résolution (réseau, `resolveDeezerTrackByTitleArtist`) d'un titre A
   * était encore en vol. Si la résolution de A se terminait APRÈS que B ait
   * été demandé, `playTrack(updatedTrack, ...)` lançait quand même la
   * lecture de A — un titre que l'utilisateur n'avait plus demandé pouvait
   * ainsi interrompre ou suivre B de façon inattendue. Question tranchée
   * (19/08) : une résolution devenue obsolète doit être IGNORÉE
   * ENTIÈREMENT, jamais jouée après coup, même si elle aboutit — pas
   * seulement son indicateur de chargement (`resolvingTrackId`) qu'il
   * fallait de toute façon aussi corriger (même risque que
   * `csvUploadTargetDate`, voir useCsvImport.js). `resolvingTrackIdRef`
   * (déclaré plus haut) permet de vérifier l'un ET l'autre après l'`await`.
   */
  const resolveAndPlay = async (track, getNextTrack) => {
    if (track.preview) { playTrack(track, getNextTrack); return track; }
    // Lit le REF (pas `resolvingTrackId`, le state fermé de ce rendu) — un
    // 2e clic rapproché sur LE MÊME titre doit être détecté même si React
    // n'a pas encore eu l'occasion de re-render depuis le 1er clic (même
    // raison que l'écriture synchrone ci-dessous).
    if (resolvingTrackIdRef.current === track.id) return null;

    setResolvingTrackId(track.id);
    // Écrit le ref DIRECTEMENT, de façon SYNCHRONE — ne PAS attendre le
    // prochain rendu (qui réassignerait cette même valeur via la ligne du
    // haut du hook, mais seulement APRÈS que React ait eu l'occasion de
    // re-render, jamais garanti avant que l'`await` juste en dessous ne se
    // résolve). Voir la docstring de `resolvingTrackIdRef` plus haut pour
    // le détail du bug que ça corrige.
    resolvingTrackIdRef.current = track.id;
    try {
      const resolved = await resolveDeezerTrackByTitleArtist(track.title, track.artist);
      // Une AUTRE résolution a démarré entre-temps (l'utilisateur a cliqué
      // un autre titre pendant cette attente) : celle-ci est devenue
      // obsolète, on l'ignore ENTIÈREMENT — ni toast d'erreur, ni lecture,
      // ni valeur de retour utile pour l'appelant (qui de toute façon ne
      // s'attend plus à CE titre précis).
      if (resolvingTrackIdRef.current !== track.id) return null;
      if (!resolved || !resolved.preview) {
        showToast("Extrait audio introuvable pour ce titre.", 'error');
        return null;
      }
      const updatedTrack = { ...track, trackId: `deezer-${resolved.id}`, preview: resolved.preview };
      playTrack(updatedTrack, getNextTrack);
      return updatedTrack;
    } finally {
      // Scopé au même titre — ne clairer QUE si c'est toujours CETTE
      // résolution qui est en cours (sinon on effacerait à tort
      // l'indicateur de chargement d'une résolution plus récente). Le ref
      // est aussi écrit ici de façon SYNCHRONE (même raison que dans le
      // `setResolvingTrackId(track.id)` plus haut) : un 2e clic sur ce
      // MÊME titre, juste après que cette résolution se termine, doit
      // immédiatement voir le ref à `null` sans attendre le rendu suivant.
      if (resolvingTrackIdRef.current === track.id) {
        setResolvingTrackId(null);
        resolvingTrackIdRef.current = null;
      }
    }
  };

  // Précédent/suivant DANS L'ORDRE DE LA PLAYLIST fournie par l'appelant
  // (pas parmi les seuls titres déjà résolus, contrairement à l'enchaînement
  // automatique en fin d'extrait ci-dessus) — retrouve le titre en cours par
  // `id` (stable, contrairement à `trackId` qui change lors d'une
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

  // `useMemo` (08/08, chantier "value non mémoïsée re-render tout le
  // monde" — après GeneratorContext.jsx, même principe appliqué ici) —
  // `MiniPlayerBar.jsx` est montée GLOBALEMENT dans App.jsx (comme l'était
  // `CustomActivityModal.jsx`), et `PlaylistDetailContext.jsx` consomme
  // aussi ce hook (pour `togglePreview`/`playingPreviewId`/`resolveAndPlay`/
  // `resolvingTrackId`) — sans mémoïsation, CHAQUE rendu de
  // `AudioPlayerProvider` (donc de tout composant qui consomme
  // `useAudioPlayer()`) recréait cet objet en entier.
  //
  // Dépendances = exactement les valeurs RÉACTIVES dont une fonction
  // ci-dessus a besoin (`playingPreviewId`/`currentTrack`/`isPlaying`/
  // `resolvingTrackId`/`showToast`) — PAS les fonctions elles-mêmes
  // (`playTrack`/`togglePreview`/etc., toujours recréées à chaque rendu,
  // pas individuellement stabilisées via `useCallback` : le faire
  // proprement pour les 9 fonctions ci-dessus, chacune avec ses propres
  // dépendances à vérifier, aurait été un chantier à part, plus long, pour
  // un gain marginal ici). Ce `useMemo` reste correct malgré tout : tant
  // qu'aucune de CES dépendances n'a changé, les fonctions de l'ancien
  // rendu (conservées par `useMemo`) se comportent EXACTEMENT comme des
  // fonctions fraîches l'auraient fait — elles ne ferment que sur des refs
  // (identité stable, toujours lues à jour via `.current`) et sur CES
  // mêmes dépendances. `previewAudioRef` volontairement ABSENT du tableau
  // de dépendances : son identité ne change jamais (même objet `Audio()`
  // tant que l'app vit, voir plus bas) — l'y ajouter serait inoffensif
  // mais inutile.
  return useMemo(() => ({
    playingPreviewId, togglePreview,
    currentTrack, isPlaying,
    pauseCurrentPreview, resumeCurrentPreview, stopCurrentPreview,
    resolveAndPlay, resolvingTrackId,
    skipToNext, skipToPrevious,
    // Exposée pour AudioProgressBar (MiniPlayerBar.jsx) : lui permet de lire
    // `.currentTime`/`.duration` et de s'abonner à `timeupdate` DIRECTEMENT
    // sur l'élément <audio>, sans passer par un state React ici — sinon
    // chaque tick (plusieurs fois par seconde) re-renderait TOUT ce qui
    // consomme useAudioPlayer() (MiniPlayerBar entière, mais aussi toutes les
    // vues qui lisent playingPreviewId/togglePreview pour leurs propres
    // listes). Le ref lui-même ne change jamais de valeur (même objet
    // Audio() tant que l'app vit) : le passer en contexte ne déclenche donc
    // aucun re-render supplémentaire.
    previewAudioRef,
  }), [playingPreviewId, currentTrack, isPlaying, resolvingTrackId, showToast]);
}
