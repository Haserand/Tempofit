import { Play, Pause, X, Music2 } from 'lucide-react';

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
 * Volontairement simple pour ce premier jet : play/pause + fermer, pas de
 * barre de progression ni de défilement — un extrait Deezer ne fait que 30s,
 * une progression fine n'apporte pas grand-chose sur une durée aussi courte.
 */
export default function MiniPlayerBar({ theme, track, isPlaying, onTogglePlayPause, onClose }) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass } = theme;

  if (!track) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[65] border-t shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 ${cardBg} ${cardBorder}`}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          onClick={onTogglePlayPause}
          title={isPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow-md hover:brightness-110 transition-all ${bgAccentClass}`}
        >
          {isPlaying ? <Pause size={18} className="fill-white"/> : <Play size={18} className="fill-white ml-0.5"/>}
        </button>

        <div className="min-w-0 flex-1 flex items-center gap-2">
          <Music2 size={16} className={`shrink-0 ${textMuted}`}/>
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate ${textHighlight}`}>{track.title}</p>
            <p className={`text-xs truncate ${textMuted}`}>{track.artist}{track.bpm ? ` · ${track.bpm} BPM` : ''}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Fermer le lecteur"
          className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-red-500 hover:bg-surface-hover`}
        >
          <X size={18}/>
        </button>
      </div>
    </div>
  );
}
