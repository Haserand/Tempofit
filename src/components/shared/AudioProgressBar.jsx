import { useState, useEffect } from 'react';

// Format mm:ss dédié à ce composant — volontairement PAS `formatDuration`
// (utils/format.js, format "Xm YYs" pensé pour des durées de plusieurs
// minutes, ex. la durée totale d'une séance) : un extrait de 30s se lit plus
// naturellement en "0:07 / 0:30" façon lecteur audio classique. Les 2
// formats ne se substituent pas l'un à l'autre, donc pas mutualisés.
const formatSeconds = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

/**
 * AudioProgressBar — temps écoulé + barre de progression de l'extrait en
 * cours (0:00 à 0:30). Isolé du reste de MiniPlayerBar EXPRÈS : `timeupdate`
 * se déclenche plusieurs fois par seconde tant que l'extrait joue — si ce
 * temps vivait en state dans MiniPlayerBar (ou pire, dans useAudioPreview.js/
 * AudioPlayerContext), CHAQUE composant qui consomme useAudioPlayer()
 * re-renderait à cette fréquence (MiniPlayerBar entière, plus toutes les
 * vues qui lisent playingPreviewId/togglePreview pour leurs propres listes).
 * En confinant ce state ICI, seul CE petit composant re-render à chaque
 * tick — le reste de l'app (et de MiniPlayerBar) ne bouge pas.
 *
 * `audioRef` : la ref RÉELLE vers l'objet Audio() de useAudioPreview.js
 * (voir `previewAudioRef`, exposé par ce hook spécifiquement pour cet usage)
 * — jamais un state React, jamais recréée : s'abonner directement dessus via
 * useEffect/addEventListener, plutôt que de la faire transiter par des
 * props qui déclencheraient des re-renders à chaque changement.
 *
 * `trackKey` : sert de `key` React posée par l'appelant (MiniPlayerBar) sur
 * ce composant — pas une prop lue ici, juste documenté pour rappel : changer
 * de titre doit REMONTER ce composant (state currentTime remis à 0
 * proprement par React), pas le laisser afficher un temps périmé le temps
 * qu'un effet se déclenche.
 */
export default function AudioProgressBar({ audioRef, textMuted, bgAccentClass }) {
  const [currentTime, setCurrentTime] = useState(0);
  // 30 par défaut (durée réelle d'un extrait Deezer) — remplacé par la vraie
  // valeur dès que le navigateur la connaît (`loadedmetadata`/`durationchange`).
  // Utile pour ne pas afficher "0:00 / 0:00" une fraction de seconde avant
  // que l'audio ait fini de charger ses métadonnées.
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Valeurs déjà disponibles au montage (ex. reprise après pause, où le
    // <audio> a déjà son currentTime/duration réels) — évite un flash à 0:00
    // le temps du 1er événement.
    setCurrentTime(audio.currentTime || 0);
    if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDurationChange);
    audio.addEventListener('durationchange', handleDurationChange);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDurationChange);
      audio.removeEventListener('durationchange', handleDurationChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Ce composant est remonté (key=trackId côté appelant) à chaque
          // nouveau titre — pas besoin de re-brancher les listeners sur un
          // changement de dépendance ici, juste au montage.

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex items-center gap-2 w-full">
      <span className={`text-[11px] font-mono tabular-nums shrink-0 ${textMuted}`}>{formatSeconds(currentTime)}</span>
      <div className="flex-1 h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${bgAccentClass} transition-[width] duration-150 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] font-mono tabular-nums shrink-0 ${textMuted}`}>{formatSeconds(duration)}</span>
    </div>
  );
}
