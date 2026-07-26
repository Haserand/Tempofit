import { useState, useRef, useEffect } from 'react';
import { Play, Pause, X, Music2, SkipBack, SkipForward, Volume2, Volume1, VolumeX } from 'lucide-react';
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
 * ── Volume : curseur en popup, pas un glisser à l'aveugle ───────────────
 * Toujours PAS un vrai lecteur principal (ces extraits de 30s servent à
 * choisir un titre, l'écoute réelle se fait sur Deezer/Spotify) — mais 2e
 * itération après un essai en "cliquer-glisser directement sur l'icône" :
 * retour direct que ce geste est invisible tant qu'on ne l'a pas déjà
 * essayé (aucune piste visible, rien ne suggère qu'on peut glisser). Un
 * vrai curseur (`<input type="range">`), qui n'apparaît qu'en popup au
 * clic/survol, respecte le "sans empiéter l'espace visuel" (rien en
 * permanence dans la barre) tout en restant DÉCOUVRABLE dès l'interaction
 * (survol ou clic) — même idiome que Spotify desktop/YouTube.
 *   - Clic sur l'icône : ouvre/ferme le popup — fonctionne aussi bien sur
 *     tactile (pas de hover) qu'à la souris.
 *   - Survol (souris uniquement) : ouvre le popup sans avoir à cliquer,
 *     en bonus pour desktop.
 *   - Fermeture : clic ailleurs sur la page (`useEffect` + listener
 *     `mousedown` document, nettoyé quand le popup se ferme/le composant
 *     démonte), ou la souris qui quitte toute la zone (desktop).
 * Popup positionné SANS marge mais avec un `pb-2` (padding, pas margin) au-
 * dessus du bouton : le padding fait partie du rectangle survolé du popup
 * lui-même, donc traverser cet espace en allant du bouton vers le curseur
 * ne quitte jamais la zone survolée — avec une vraie marge (`mb-2`), ce
 * trajet traverserait une zone MORTE entre bouton et popup, qui aurait
 * déclenché une fermeture prématurée avant même d'atteindre le curseur.
 * `volume` reste un state LOCAL à ce composant (pas remonté dans
 * useAudioPreview.js/le Contexte), synchronisé sur `previewAudioRef.current`
 * (MÊME objet <audio> réutilisé pour tous les titres, voir
 * useAudioPreview.js) — persiste donc déjà tout seul d'un extrait au
 * suivant, aucune synchronisation supplémentaire à faire ailleurs.
 * Icône reflétant le niveau (`Volume2`/`Volume1`/`VolumeX` selon 3 paliers)
 * plutôt qu'un simple binaire muet/pas-muet : 3 icônes lucide déjà dans la
 * lib du projet, pas de nouvelle dépendance.
 * `accent-primary` sur le curseur : token sémantique déjà exposé par
 * Tailwind (`useTheme.js`/`index.css`, comme `bg-primary`) — s'adapte donc
 * automatiquement au Mode Intime sans avoir à threader `isNaughtyMode`
 * jusqu'ici juste pour ça (contrairement au ternaire `accent-red-500`/
 * `accent-rose-500` codé en dur ailleurs dans l'app sur les curseurs BPM).
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
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const {
    currentTrack, isPlaying,
    pauseCurrentPreview, resumeCurrentPreview, stopCurrentPreview,
    skipToNext, skipToPrevious,
    previewAudioRef,
  } = useAudioPlayer();

  // Volume 0..1 — synchronisé sur previewAudioRef.current à chaque
  // changement (curseur du popup), voir applyVolume.
  const [volume, setVolume] = useState(1);
  const [isVolumePopupOpen, setIsVolumePopupOpen] = useState(false);
  const volumeWrapperRef = useRef(null);

  // Ferme le popup sur un clic n'importe où EN DEHORS de la zone
  // bouton+popup (`volumeWrapperRef` englobe les deux, voir JSX plus bas).
  // N'écoute que pendant que le popup est réellement ouvert — jamais de
  // listener document qui traîne pour rien le reste du temps.
  useEffect(() => {
    if (!isVolumePopupOpen) return;
    const handleClickOutside = (e) => {
      if (volumeWrapperRef.current && !volumeWrapperRef.current.contains(e.target)) {
        setIsVolumePopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVolumePopupOpen]);

  if (!currentTrack) return null;

  const handleTogglePlayPause = () => isPlaying ? pauseCurrentPreview() : resumeCurrentPreview();
  const handlePrevious = () => skipToPrevious(currentPlaylist?.tracks);
  const handleNext = () => skipToNext(currentPlaylist?.tracks);

  const applyVolume = (v) => {
    const clamped = Math.min(1, Math.max(0, v));
    if (previewAudioRef.current) previewAudioRef.current.volume = clamped;
    setVolume(clamped);
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

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

        <div
          ref={volumeWrapperRef}
          className="relative"
          onMouseEnter={() => setIsVolumePopupOpen(true)}
          onMouseLeave={() => setIsVolumePopupOpen(false)}
        >
          <button
            onClick={() => setIsVolumePopupOpen(v => !v)}
            title={`Volume : ${Math.round(volume * 100)}%`}
            className={`p-2 rounded-full shrink-0 transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
          >
            <VolumeIcon size={18}/>
          </button>

          {isVolumePopupOpen && (
            // `pb-2` (padding, pas margin) : voir docstring en tête de
            // fichier — garde la zone survolée continue entre le bouton et
            // le popup, pour ne pas se fermer en traversant l'espace entre
            // les deux.
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-10">
              <div className={`${cardBg} border ${cardBorder} rounded-xl shadow-xl px-3 py-2.5`}>
                <input
                  type="range" min="0" max="100" value={Math.round(volume * 100)}
                  onChange={(e) => applyVolume(Number(e.target.value) / 100)}
                  className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          )}
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
