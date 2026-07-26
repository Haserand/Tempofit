import { useState, useRef } from 'react';
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
 * ── Volume par glisser (pas un slider séparé) ───────────────────────────
 * Toujours PAS un vrai lecteur principal (ces extraits de 30s servent à
 * choisir un titre, l'écoute réelle se fait sur Deezer/Spotify) — mais
 * retour direct après un premier jet en simple mute : couvrir aussi le
 * réglage fin, SANS ajouter de piste/slider visible qui prendrait de la
 * place dans une barre déjà serrée sur 3 zones. Le réglage se fait
 * directement sur l'icône volume elle-même :
 *   - Cliquer (sans bouger la souris) : bascule mute, comme avant.
 *   - Cliquer-glisser horizontalement : ajuste le volume en continu
 *     (droite = plus fort, gauche = plus faible), sur toute la largeur du
 *     bouton ET au-delà (`setPointerCapture` — le drag continue de
 *     fonctionner même si le curseur sort du bouton pendant le geste).
 * Distinction clic/glisser : `dragMovedRef` (ref, pas state — pas besoin de
 * re-render pour ce simple flag interne au geste) passe à `true` dès que le
 * déplacement dépasse `CLICK_THRESHOLD_PX` ; au relâchement, seul un
 * mouvement resté SOUS ce seuil déclenche le toggle mute. Sans ce filet, le
 * moindre tremblement de souris pendant un "simple clic" serait interprété
 * comme un réglage de volume à 0 changement près.
 * Icône reflétant le niveau (`Volume2`/`Volume1`/`VolumeX` selon 3 paliers)
 * plutôt qu'un simple binaire muet/pas-muet — donne le retour visuel
 * "les vaguelettes se remplissent" demandé, sans SVG custom : ce sont 3
 * icônes lucide déjà dans la lib du projet, pas une nouvelle dépendance.
 * `volume` reste un state LOCAL à ce composant (pas remonté dans
 * useAudioPreview.js/le Contexte), synchronisé sur `previewAudioRef.current`
 * (MÊME objet <audio> réutilisé pour tous les titres, voir
 * useAudioPreview.js) — persiste donc déjà tout seul d'un extrait au
 * suivant, aucune synchronisation supplémentaire à faire ailleurs.
 * `previousVolumeRef` : mémorise le niveau d'avant un mute-par-clic, pour
 * que redémuter par clic restaure le MÊME niveau plutôt que de repartir à
 * fond (100%) à chaque fois.
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

  // Volume 0..1 — synchronisé sur previewAudioRef.current à chaque
  // changement (drag ou clic-mute), voir handleVolumePointerUp/Move.
  const [volume, setVolume] = useState(1);
  const dragStartXRef = useRef(0);
  const dragStartVolumeRef = useRef(1);
  const dragMovedRef = useRef(false);
  const previousVolumeRef = useRef(1);

  if (!currentTrack) return null;

  const handleTogglePlayPause = () => isPlaying ? pauseCurrentPreview() : resumeCurrentPreview();
  const handlePrevious = () => skipToPrevious(currentPlaylist?.tracks);
  const handleNext = () => skipToNext(currentPlaylist?.tracks);

  const applyVolume = (v) => {
    const clamped = Math.min(1, Math.max(0, v));
    if (previewAudioRef.current) previewAudioRef.current.volume = clamped;
    setVolume(clamped);
  };

  // Largeur de glisser (px) pour parcourir 0% → 100% — assez court pour
  // rester réactif sur un bouton compact, assez long pour ne pas être
  // hyper-sensible au moindre tremblement.
  const VOLUME_DRAG_RANGE_PX = 80;
  const CLICK_THRESHOLD_PX = 4;

  const handleVolumePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartXRef.current = e.clientX;
    dragStartVolumeRef.current = volume;
    dragMovedRef.current = false;
  };

  const handleVolumePointerMove = (e) => {
    if (e.buttons === 0) return; // pointer capturé mais bouton relâché (sécurité)
    const deltaX = e.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > CLICK_THRESHOLD_PX) dragMovedRef.current = true;
    if (dragMovedRef.current) {
      applyVolume(dragStartVolumeRef.current + deltaX / VOLUME_DRAG_RANGE_PX);
    }
  };

  const handleVolumePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!dragMovedRef.current) {
      // Simple clic (pas de glisser réel) : bascule mute, en mémorisant/
      // restaurant le niveau précédent plutôt que de toujours repartir à 100%.
      if (volume > 0) { previousVolumeRef.current = volume; applyVolume(0); }
      else applyVolume(previousVolumeRef.current || 1);
    }
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

        <button
          onPointerDown={handleVolumePointerDown}
          onPointerMove={handleVolumePointerMove}
          onPointerUp={handleVolumePointerUp}
          title={`Volume : ${Math.round(volume * 100)}% — glisser pour ajuster, cliquer pour couper le son`}
          className={`p-2 rounded-full shrink-0 transition-colors cursor-ew-resize touch-none select-none ${textMuted} hover:text-main hover:bg-surface-hover`}
        >
          <VolumeIcon size={18}/>
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
