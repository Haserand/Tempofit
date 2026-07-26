import { useState } from 'react';
import { Play, Pause, X, Music2, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import AudioProgressBar from './AudioProgressBar';

/**
 * MiniPlayerBar — barre persistante en bas d'écran (façon Spotify), monté
 * UNE SEULE FOIS dans App.jsx, visible sur TOUTES les vues tant qu'un
 * extrait est chargé (jouant ou en pause).
 *
 * `track` est `null` tant qu'aucun extrait n'a jamais été lancé, ou après un
 * arrêt complet (`stopCurrentPreview`, useAudioPreview.js) — le composant ne
 * rend alors rien du tout, pas une barre vide.
 *
 * Chantier God Component (suite) : ce composant est 100% dédié à l'audio —
 * il lit donc directement `useAudioPlayer()` au lieu de recevoir ces valeurs
 * en props. Exceptions : `currentPlaylist` et `changeView`, reçus en props
 * (state de playlist/navigation, jamais fait partie du périmètre
 * d'AudioPlayerContext, qui ne connaît que le lecteur lui-même).
 *
 * ── 3 zones (flex) ──────────────────────────────────────────────────────
 * Gauche : pochette + titre/artiste/BPM — TOUJOURS visible, y compris mobile
 *          (c'est l'info essentielle : "qu'est-ce qui joue ?").
 * Centre : précédent/lecture/suivant + barre de progression de l'extrait
 *          (AudioProgressBar, isolée — voir sa docstring pour la
 *          performance). Toujours visible aussi.
 * Droite : contexte playlist (nom cliquable + position "Titre X/Y") —
 *          masqué sur mobile (`hidden md:flex`, non essentiel, cf. plan).
 *
 * ── Mute (pas un vrai réglage de volume) ────────────────────────────────
 * Volontairement PAS un slider de volume : ces extraits servent à choisir
 * un titre (30s), pas à l'écoute principale (celle-ci se fait sur
 * Deezer/Spotify une fois la playlist générée) — le volume système fait
 * déjà ce travail sans rien coder. Un simple mute couvre le seul vrai
 * besoin identifié : couper vite un extrait trop fort, notamment parce que
 * `skipToNext`/`skipToPrevious` peuvent enchaîner plusieurs extraits sans
 * reclic à chaque fois. `isMuted` reste un state LOCAL à ce composant (pas
 * remonté dans useAudioPreview.js/le Contexte) : bascule directement
 * `previewAudioRef.current.muted`, sur le MÊME objet <audio> réutilisé pour
 * tous les titres (voir useAudioPreview.js) — le mute persiste donc déjà
 * tout seul d'un extrait au suivant, aucune synchronisation à faire.
 *
 * ── Contexte playlist : affiché seulement si VRAI ──────────────────────
 * `currentPlaylist` (prop) est la DERNIÈRE playlist ouverte dans l'app, pas
 * forcément celle du titre en cours (ex. on ouvre la playlist A, puis on
 * lance un extrait depuis Mes Favoris — `currentPlaylist` reste A alors que
 * le titre qui joue n'en fait pas partie). `belongsToCurrentPlaylist`
 * vérifie que `currentTrack` est RÉELLEMENT dans `currentPlaylist.tracks`
 * avant d'afficher nom/position — jamais une info reconstituée à partir
 * d'une coïncidence de state.
 *
 * ── Navigation ───────────────────────────────────────────────────────────
 * Pas de react-router dans ce projet (vérifié : absent de package.json) —
 * la navigation se fait via `changeView('playlist')` (state, pas de route
 * URL), comme partout ailleurs dans l'app (voir App.jsx). `currentPlaylist`
 * étant déjà LE state global affiché par la vue détail, pas besoin de le
 * re-poser avant de changer de vue.
 */
export default function MiniPlayerBar({ theme, currentPlaylist, changeView }) {
  const { cardBg, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const {
    currentTrack, isPlaying,
    pauseCurrentPreview, resumeCurrentPreview, stopCurrentPreview,
    skipToNext, skipToPrevious,
    previewAudioRef,
  } = useAudioPlayer();

  const [isMuted, setIsMuted] = useState(false);

  if (!currentTrack) return null;

  const handleTogglePlayPause = () => isPlaying ? pauseCurrentPreview() : resumeCurrentPreview();
  const handlePrevious = () => skipToPrevious(currentPlaylist?.tracks);
  const handleNext = () => skipToNext(currentPlaylist?.tracks);
  // Bascule directement `audio.muted` sur l'élément <audio> partagé plutôt
  // que de couper le volume à 0 : `muted` est un flag séparé du volume
  // lui-même, donc rien à mémoriser/restaurer côté volume — démuter rend
  // exactement le niveau sonore d'avant.
  const handleToggleMute = () => {
    if (previewAudioRef.current) previewAudioRef.current.muted = !isMuted;
    setIsMuted(m => !m);
  };

  const trackIndex = currentPlaylist?.tracks ? currentPlaylist.tracks.findIndex(t => t.id === currentTrack.id) : -1;
  const belongsToCurrentPlaylist = trackIndex !== -1;

  return (
    // Plus de `fixed bottom-0 left-0 right-0 z-[65]` ICI (25/07) — déplacé sur
    // le conteneur PARTAGÉ dans App.jsx, qui empile cette barre avec la
    // nouvelle notice "mode invité" (voir App.jsx) via un simple flex-col,
    // sans avoir à deviner/coder en dur la hauteur de l'une pour positionner
    // l'autre au-dessus. Cette barre-ci reste toujours la DERNIÈRE du flex
    // (donc collée au vrai bas d'écran, comportement inchangé) — seul le
    // conteneur qui l'enveloppe a changé, pas elle.
    <div className={`border-t-2 border-slate-200 dark:border-white/20 shadow-2xl ${cardBg}`}>
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">

        {/* ── Zone gauche : infos titre (essentiel, jamais masqué) ── */}
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <Music2 size={16} className={`shrink-0 hidden sm:block ${textMuted}`}/>
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate ${textHighlight}`}>{currentTrack.title}</p>
            <p className={`text-xs truncate ${textMuted}`}>{currentTrack.artist}{currentTrack.bpm ? ` · ${currentTrack.bpm} BPM` : ''}</p>
          </div>
        </div>

        {/* ── Zone centre : contrôles + progression (cœur du lecteur, jamais masqué) ── */}
        <div className="flex flex-col items-center gap-1 shrink-0 w-full max-w-[160px] sm:max-w-[220px] md:max-w-[260px]">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevious}
              title="Titre précédent"
              className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
            >
              <SkipBack size={16} className="fill-current"/>
            </button>

            <button
              onClick={handleTogglePlayPause}
              title={isPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white shadow-md hover:brightness-110 transition-all ${bgAccentClass}`}
            >
              {isPlaying ? <Pause size={16} className="fill-white"/> : <Play size={16} className="fill-white ml-0.5"/>}
            </button>

            <button
              onClick={handleNext}
              title="Titre suivant"
              className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
            >
              <SkipForward size={16} className="fill-current"/>
            </button>
          </div>

          {/* `key` sur trackId : force un REMONTAGE de AudioProgressBar à
              chaque nouveau titre — son state currentTime/duration repart
              donc proprement de zéro (pas de flash "23s" résiduel de
              l'extrait précédent le temps qu'un effet se déclenche). */}
          <AudioProgressBar
            key={currentTrack.trackId}
            audioRef={previewAudioRef}
            textMuted={textMuted}
            bgAccentClass={bgAccentClass}
          />
        </div>

        {/* ── Zone droite : contexte playlist — non essentiel, masqué sur mobile ── */}
        <div className="hidden md:flex flex-col items-end min-w-0 flex-1 text-right">
          {belongsToCurrentPlaylist && (
            <>
              <button
                onClick={() => changeView('playlist')}
                title="Aller à cette playlist"
                className={`text-xs font-bold truncate max-w-[200px] hover:underline transition-colors ${textMuted} hover:text-main`}
              >
                Playlist : <span className={textColorClass}>{currentPlaylist.name}</span>
              </button>
              <span className={`text-[11px] font-mono ${textMuted}`}>
                Titre {trackIndex + 1}/{currentPlaylist.tracks.length}
              </span>
            </>
          )}
        </div>

        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Réactiver le son' : 'Couper le son'}
          className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
        >
          {isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
        </button>

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
