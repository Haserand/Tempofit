import { GripVertical, Star, MoreVertical, Plus, User, RefreshCw, X, Lock, Play, Pause, Loader2 } from 'lucide-react';
import { getGenresForDisplay } from '../../../musicCatalog';
import { getZoneForValue } from '../../../appConfig';
import { formatDuration } from '../../../utils/format';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';

/**
 * TrackItem.jsx — une ligne de la tracklist, style "Coaching / Sport" :
 * BPM en badge + repère de zone d'intensité (bordure gauche + pastille
 * texte) SEULEMENT si un vrai Profil Athlétique est configuré pour cette
 * activité (décision Produit : l'app reste neutre par défaut, badge BPM
 * gris/bordure neutre tant que rien n'est réglé — jamais de vocabulaire
 * "effort" non sollicité). Extrait de PlaylistDetailView.jsx (chantier
 * découpage, suite de GeneratorContext/AudioPlayerContext/
 * PlaylistDetailContext).
 *
 * Ne reçoit QUE ce qui est génuinement possédé par PlaylistDetailView (theme,
 * favoris, verrouillage, résolution de lecture — tous PARTAGÉS avec d'autres
 * blocs de cette vue qui restent ailleurs pour l'instant : bouton "Écouter"
 * de l'en-tête, popup du graphique BPM, camemberts de répartition). Tout ce
 * qui est exclusif à cette ligne (drag-and-drop, menu, mutations de titre,
 * état de lecture, profil athlétique pour la zone) vient de
 * usePlaylistDetail() directement ici plutôt que d'être re-descendu en
 * props par TrackList — un seul point d'entrée, pas un 2e niveau de
 * prop drilling recréé juste après en avoir supprimé un.
 *
 * `isDimmed`/`isHighlighted` : precalculés par TrackList (pas recalculés ici)
 * à partir de `hasDetailFilter`/`trackMatchesDetailFilter`, qui restent
 * possédés par PlaylistDetailView — cet état est partagé avec les 2
 * camemberts de répartition (clic sur une part = surbrillance de la liste),
 * donc PAS déplaçable dans ce sous-composant sans dupliquer sa source de
 * vérité (même piège que documenté pour athleticProfile/showToast).
 */
export default function TrackItem(props) {
  // DIAGNOSTIC TEMPORAIRE (bug "page blanche" en cours d'investigation) :
  // enveloppe TOUT le rendu de ce composant (pas seulement le calcul de
  // zone comme la version précédente de ce diagnostic, qui n'a pas capté le
  // crash) — si N'IMPORTE QUELLE ligne de TrackItemInner plante, relance une
  // erreur enrichie avec les données exactes en cause. ErrorBoundary
  // (App.jsx) affiche `error.message` telle quelle. À retirer une fois le
  // bug confirmé et corrigé.
  try {
    return TrackItemInner(props);
  } catch (e) {
    throw new Error(
      `[TrackItem] track=${JSON.stringify(props.track)} | favorites=${JSON.stringify(props.favorites)} | erreur d'origine: ${e.message}`
    );
  }
}

function TrackItemInner({
  track, index,
  theme, isLocked,
  favorites, toggleTrackFavorite, toggleArtistFavorite,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  isDimmed, isHighlighted,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const {
    currentPlaylist, isNaughtyMode, getProfileForWorkout,
    draggedTrackIndex, handleTrackDragStart, handleTrackDragEnter, handleTrackDragEnd,
    openTrackMenuIndex, setOpenTrackMenuIndex,
    handleDuplicateTrack, handleReplaceTrackSameArtist, handleReplaceTrack, handleRemoveTrack,
    playingPreviewId, resolvingTrackId,
  } = usePlaylistDetail();

  // Zone d'intensité pour le BPM de ce titre — SEULEMENT si un vrai profil
  // athlétique est configuré pour cette activité (décision Produit : l'app
  // reste neutre par défaut, jamais de vocabulaire "effort" tant que
  // l'utilisateur n'a rien réglé lui-même). `getProfileForWorkout` STRICT
  // (pas OrDefault, essayé puis abandonné entre-temps — voir
  // PlaylistDetailContext.jsx, même revert sur bpmDistributionData) :
  // renvoie `null` si l'activité n'a jamais été configurée, et `zone` vaut
  // alors `null` — le reste du composant (zoneColor, le `{zone && ...}` du
  // libellé plus bas) est DÉJÀ prévu pour ce cas depuis le début, rien
  // d'autre à changer ici que le résolveur : badge BPM neutre (gris),
  // bordure gauche neutre, pas de pastille de zone.
  const activityName = isNaughtyMode
    ? (currentPlaylist?.config?.workoutName || currentPlaylist?.workoutType || 'Autre')
    : (currentPlaylist?.workoutType || 'Autre');
  const customActivityName = currentPlaylist?.workoutType === 'Autre' ? (currentPlaylist?.config?.customActivity || '') : '';
  const zone = track.bpm ? getZoneForValue(track.bpm, activityName, getProfileForWorkout, customActivityName) : null;
  const zoneColor = zone?.color || '#9ca3af';

  const isFav = favorites.tracks.some(t => t.trackId === track.trackId);
  const tracksCount = currentPlaylist?.tracks?.length || 0;

  return (
    <div
      draggable={!isLocked}
      onDragStart={isLocked ? undefined : handleTrackDragStart(index)}
      onDragEnter={isLocked ? undefined : handleTrackDragEnter(index)}
      onDragOver={isLocked ? undefined : (e) => e.preventDefault()}
      onDragEnd={isLocked ? undefined : handleTrackDragEnd}
      style={{ borderLeftColor: zoneColor }}
      className={`flex items-center p-3 pl-3 border-l-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 group transition-opacity ${draggedTrackIndex === index ? 'opacity-40' : ''} ${isDimmed ? 'opacity-30' : ''} ${isHighlighted ? (isNaughtyMode ? 'bg-rose-50 dark:bg-rose-950/20' : 'bg-red-50 dark:bg-red-950/20') : ''}`}
    >
      {/* Poignée de glisser-déposer — grisée et non interactive sur une
          séance déjà réalisée : on ne réordonne plus un historique (isLocked). */}
      <div
        className={`shrink-0 px-1 ${textMuted} ${isLocked ? 'opacity-20 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
        title={isLocked ? "Verrouillé — impossible de réordonner une séance déjà réalisée" : "Glisser pour réordonner"}
      >
        <GripVertical size={16}/>
      </div>
      <div className={"w-6 text-center font-medium text-xs " + textMuted}>{index + 1}</div>
      <button
        onClick={() => resolveAndTogglePreview(track, getNextTrackForAutoAdvance)}
        title="Écouter un extrait"
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors mr-2 ${bgAccentClass} text-white hover:brightness-110`}
      >
        {resolvingTrackId === track.id
          ? <Loader2 size={14} className="animate-spin"/>
          : playingPreviewId === track.trackId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
      </button>
      <div className="flex-1 px-2 min-w-0">
        <div className={"font-bold text-sm truncate " + textHighlight}>{track.title}</div>
        <div className={"text-xs truncate " + textMuted}>
          {track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}
          {track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}
        </div>
      </div>

      {/* Bloc "Coaching" : badge BPM coloré par zone + libellé de zone +
          durée/début, remplace l'ancien affichage BPM neutre. */}
      <div className="w-28 text-center shrink-0 flex flex-col items-center gap-0.5">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-mono font-black text-white shadow-sm"
          style={{ backgroundColor: zoneColor }}
        >
          {track.bpm} BPM
        </span>
        {zone && <span className={`text-[10px] font-bold ${textMuted}`}>{zone.shortLabel}</span>}
        <div className={`text-[11px] font-mono ${textMuted}`} title="Moment où ce titre démarre dans la séance">
          {track.startTimeStr || '0m 00s'} · {formatDuration(track.duration)}
        </div>
      </div>

      {/* Bouton favori — n'affecte que la liste de favoris, jamais la
          playlist en cours. */}
      <button
        onClick={() => toggleTrackFavorite(track)}
        className={`p-2 rounded-lg transition-colors shrink-0 ${isFav ? 'text-amber-500' : textMuted + ' hover:text-amber-500'}`}
        title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <Star size={16} fill={isFav ? 'currentColor' : 'none'}/>
      </button>

      {/* Menu d'options (Dupliquer / Remplacer large / Remplacer même artiste). */}
      <div className="relative shrink-0">
        <button onClick={() => setOpenTrackMenuIndex(openTrackMenuIndex === index ? null : index)} className={"p-2 rounded-lg transition-colors " + textMuted + " hover:" + textHighlight} title="Plus d'options">
          <MoreVertical size={16}/>
        </button>
        {openTrackMenuIndex === index && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenTrackMenuIndex(null)}></div>
            {/* Menu ouvert vers le HAUT pour les derniers titres de la liste
                (sinon coupé par l'overflow-hidden du conteneur arrondi). */}
            <div className={`absolute right-0 z-20 w-64 rounded-xl border shadow-2xl ${cardBg} ${cardBorder} overflow-hidden ${
              index >= tracksCount - 2 ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}>
              {!isLocked && (
                <>
                  <button onClick={() => { handleDuplicateTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                    <Plus size={16} className="text-green-500"/> Dupliquer ce titre
                  </button>
                  <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                  <button onClick={() => { handleReplaceTrackSameArtist(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                    <User size={16} className="text-purple-500"/> Remplacer (même artiste)
                  </button>
                  <button onClick={() => { handleReplaceTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                    <RefreshCw size={16} className="text-blue-500"/> Remplacer (recherche large)
                  </button>
                  <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                </>
              )}
              {(() => {
                const artistIsFav = favorites.artists.includes(track.artist);
                return (
                  <button onClick={() => { toggleArtistFavorite(track.artist); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-surface-hover transition-colors ${textHighlight}`}>
                    <Star size={16} className="text-amber-500" fill={artistIsFav ? 'currentColor' : 'none'}/> {artistIsFav ? `Retirer ${track.artist} des favoris` : `Favoriser l'artiste (${track.artist})`}
                  </button>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {isLocked ? (
        <div className={"p-2 shrink-0 opacity-20 " + textMuted} title="Verrouillé — impossible de retirer un titre d'une séance déjà réalisée">
          <Lock size={16}/>
        </div>
      ) : (
        <button onClick={() => handleRemoveTrack(index)} className={"p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors shrink-0 " + textMuted} title="Retirer de la proposition">
          <X size={16}/>
        </button>
      )}
    </div>
  );
}
