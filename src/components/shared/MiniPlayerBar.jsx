import { Play, Pause, X, Music2, SkipBack, SkipForward } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

/**
 * MiniPlayerBar — barre persistante en bas d'écran (façon Spotify), monté
 * UNE SEULE FOIS dans App.jsx, visible sur TOUTES les vues tant qu'un
 * extrait est chargé (jouant ou en pause) — voir la discussion qui a mené à
 * ce chantier : "l'extrait s'arrête dès qu'on change de page".
 *
 * `track` est `null` tant qu'aucun extrait n'a jamais été lancé, ou après un
 * arrêt complet (`stopCurrentPreview`, useAudioPreview.js) — le composant ne
 * rend alors rien du tout, pas une barre vide.
 *
 * Chantier God Component (suite) : ce composant est 100% dédié à l'audio
 * (contrairement à FavoritesView/StatsView/SearchModal, qui n'utilisent
 * `togglePreview`/`playingPreviewId` que pour UNE fonctionnalité parmi
 * d'autres) — il lit donc directement `useAudioPlayer()` au lieu de recevoir
 * ces valeurs en props depuis AppContent. Seule exception : `currentPlaylist`
 * reste une prop, car les boutons précédent/suivant ont besoin de SES titres
 * (`currentPlaylist?.tracks`) pour l'enchaînement — une donnée qui n'a jamais
 * fait partie du périmètre d'AudioPlayerContext (c'est du state de playlist,
 * pas de lecteur audio). Si aucune playlist n'est ouverte (l'extrait en
 * cours vient d'ailleurs — favoris, recherche...), ce tableau est vide et
 * les boutons ne font simplement rien (géré côté hook, pas ici) — pas besoin
 * de les masquer, un clic sans effet est suffisamment clair.
 */
export default function MiniPlayerBar({ theme, currentPlaylist }) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass } = theme;
  const {
    currentTrack, isPlaying,
    pauseCurrentPreview, resumeCurrentPreview, stopCurrentPreview,
    skipToNext, skipToPrevious,
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const handleTogglePlayPause = () => isPlaying ? pauseCurrentPreview() : resumeCurrentPreview();
  const handlePrevious = () => skipToPrevious(currentPlaylist?.tracks);
  const handleNext = () => skipToNext(currentPlaylist?.tracks);

  return (
    // z-[65] volontairement conservé (pas baissé à z-40) : déjà cohérent avec
    // la hiérarchie z-index existante de l'app — Sidebar (z-50) < badge
    // trophée/connexion (z-[60]) < CETTE barre (z-[65]) < modales (z-[70]) <
    // toasts (z-[80]). Le recouvrement du bas de la Sidebar par cette barre
    // (bug signalé) ne se réglait de toute façon pas par le z-index : Sidebar
    // est `fixed`, donc jamais affectée par un padding d'ancêtre — voir
    // Sidebar.jsx (hasActiveTrack) pour le vrai correctif.
    <div className={`fixed bottom-0 left-0 right-0 z-[65] border-t shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 ${cardBg} ${cardBorder}`}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
        <button
          onClick={handlePrevious}
          title="Titre précédent"
          className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
        >
          <SkipBack size={18} className="fill-current"/>
        </button>

        <button
          onClick={handleTogglePlayPause}
          title={isPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow-md hover:brightness-110 transition-all ${bgAccentClass}`}
        >
          {isPlaying ? <Pause size={18} className="fill-white"/> : <Play size={18} className="fill-white ml-0.5"/>}
        </button>

        <button
          onClick={handleNext}
          title="Titre suivant"
          className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
        >
          <SkipForward size={18} className="fill-current"/>
        </button>

        <div className="min-w-0 flex-1 flex items-center gap-2 ml-1">
          <Music2 size={16} className={`shrink-0 ${textMuted}`}/>
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate ${textHighlight}`}>{currentTrack.title}</p>
            <p className={`text-xs truncate ${textMuted}`}>{currentTrack.artist}{currentTrack.bpm ? ` · ${currentTrack.bpm} BPM` : ''}</p>
          </div>
        </div>

        <button
          onClick={stopCurrentPreview}
          title="Fermer le lecteur"
          className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-red-500 hover:bg-surface-hover`}
        >
          <X size={18}/>
        </button>
      </div>
    </div>
  );
}
