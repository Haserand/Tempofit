import { Play, Pause, X, Music2, SkipBack, SkipForward } from 'lucide-react';

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
 * RETOUR DIRECT ("boutons précédent/suivant") — `onPrevious`/`onNext`
 * viennent de `skipToPrevious`/`skipToNext` (useAudioPreview.js), appelés
 * par App.jsx avec le tableau de titres de la playlist actuellement ouverte
 * (`currentPlaylist?.tracks`). Si aucune playlist n'est ouverte (l'extrait
 * en cours vient d'ailleurs — favoris, recherche...), ce tableau est vide
 * et les boutons ne font simplement rien (géré côté hook, pas ici) — pas
 * besoin de les masquer, un clic sans effet est suffisamment clair.
 */
export default function MiniPlayerBar({ theme, track, isPlaying, onTogglePlayPause, onClose, onPrevious, onNext }) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass } = theme;

  if (!track) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[65] border-t shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 ${cardBg} ${cardBorder}`}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
        <button
          onClick={onPrevious}
          title="Titre précédent"
          className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
        >
          <SkipBack size={18} className="fill-current"/>
        </button>

        <button
          onClick={onTogglePlayPause}
          title={isPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow-md hover:brightness-110 transition-all ${bgAccentClass}`}
        >
          {isPlaying ? <Pause size={18} className="fill-white"/> : <Play size={18} className="fill-white ml-0.5"/>}
        </button>

        <button
          onClick={onNext}
          title="Titre suivant"
          className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
        >
          <SkipForward size={18} className="fill-current"/>
        </button>

        <div className="min-w-0 flex-1 flex items-center gap-2 ml-1">
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
