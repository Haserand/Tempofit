import { useRef } from 'react';
import {
  Check, Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Music2, Play,
  Calendar, Lock, Upload, Trash2,
} from 'lucide-react';
import { getGenresForDisplay, genreDisplayLabel } from '../../../musicCatalog';
import { formatDuration } from '../../../utils/format';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';

/**
 * PlaylistHeader.jsx — en-tête de PlaylistDetailView : pochette, titre
 * (édition inline), badges d'infos, ligne dates/verrou/planification, et
 * rangée d'actions (import CSV, partager, sauvegarder/retirer). Extrait de
 * PlaylistDetailView.jsx (chantier découpage, suite de TrackList/TrackItem).
 *
 * Contrairement à TrackList (state de filtre partagé avec les camemberts),
 * RIEN ici n'est partagé avec PlaylistCharts ou TrackList — tout ce qui
 * vivait dans le composant parent UNIQUEMENT pour cet en-tête (rang/médaille,
 * dates de complétion la plus récente, ref de l'input date caché) est donc
 * déplacé ENTIÈREMENT ici plutôt que reçu en prop précalculé, contrairement à
 * bpmChartActivityName/isBpmChartUsingRealProfile côté PlaylistCharts (ceux-
 * là restent partagés avec TrackList/le calcul de trackBpmBucketLabel, donc
 * pas déplaçables).
 *
 * Reçoit en props : ce qui est possédé par PlaylistDetailView (theme,
 * verrouillage, savedPlaylists — pour le classement/médaille — et les
 * fonctions de rendu/action partagées avec PlaylistsView/TrophiesView) ou ce
 * qui est partagé avec PlaylistCharts (resolveAndTogglePreview/
 * getNextTrackForAutoAdvance — le bouton "Écouter cette playlist" sur la
 * pochette utilise EXACTEMENT le même mécanisme que le bouton play de
 * l'encart segment sélectionné dans PlaylistCharts, pas une 2e
 * implémentation). `onShare` : callback fourni par le parent (qui possède
 * `summaryCardRef`/génération d'image, non déplaçable ici) — cet en-tête n'a
 * besoin de savoir QUE "cliquer ici déclenche le partage", pas comment.
 *
 * Tout le reste (nom éditable, sauvegarde/retrait, currentPlaylist lui-même)
 * vient de usePlaylistDetail().
 */
export default function PlaylistHeader(props) {
  // DIAGNOSTIC TEMPORAIRE (bug "page blanche" en cours d'investigation) —
  // même mécanisme que TrackItem.jsx, à retirer une fois corrigé.
  try {
    return PlaylistHeaderInner(props);
  } catch (e) {
    throw new Error(`[PlaylistHeader] erreur d'origine: ${e.message}`);
  }
}

function PlaylistHeaderInner({
  theme, isLocked, savedPlaylists,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  setPlaylistPlannedDate,
  renderCompletionsList, renderTopCompletionDate, getRankStyle, triggerCSVUpload,
  onShare,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, borderAccentClass, inputBg, inputBorder } = theme;
  const {
    currentPlaylist, isNaughtyMode,
    isEditingPlaylistName, setIsEditingPlaylistName, editedPlaylistName, setEditedPlaylistName, handleRenamePlaylist,
    handleSavePlaylist, handleUnsavePlaylist,
  } = usePlaylistDetail();

  // Filet de sécurité multi-navigateurs pour le bouton "Planifier" (voir plus
  // bas) : un <input type="date"> rendu invisible et superposé à un <label>
  // s'ouvre au clic dans la plupart des navigateurs, mais pas de façon fiable
  // partout (Safari en particulier peut ignorer ce clic précis, sans aucune
  // erreur visible) — d'où le retour "le bouton Planifier ne fonctionne pas".
  const plannedDateInputRef = useRef(null);

  // --- CTA "Importer mes données" (retour direct : maquette UI/UX complète) ---
  // Cible la date de complétion la plus RÉCENTE (celle qu'on vient de
  // marquer/refaire est la plus probable à vouloir enrichir) plutôt que
  // d'exiger que la personne choisisse elle-même laquelle dans le cas
  // fréquent d'une seule date. Les dates plus anciennes restent gérables
  // individuellement via la liste détaillée (renderCompletionsList).
  const mostRecentCompletionIso = isLocked ? currentPlaylist.completions[currentPlaylist.completions.length - 1] : null;
  const hasImportedDataForMostRecent = !!(mostRecentCompletionIso && currentPlaylist.actualDataByDate && currentPlaylist.actualDataByDate[mostRecentCompletionIso]);

  // Médaille "la plus/2e plus/3e plus utilisée" — même logique de classement
  // recalculée localement (mêmes filtre + tri que PlaylistsView.jsx), plutôt
  // qu'un classement centralisé transmis en prop — cohérent avec la
  // convention déjà en place ailleurs dans l'app pour ce même genre de
  // classement (RoutinesView.jsx fait exactement pareil pour ses routines).
  const playlistRanks = [...savedPlaylists.filter(p => p.completions && p.completions.length > 0)]
    .sort((a, b) => b.completions.length - a.completions.length)
    .map(p => p.id);
  const currentPlaylistRank = playlistRanks.indexOf(currentPlaylist.id);
  const currentPlaylistRankStyle = getRankStyle ? getRankStyle(currentPlaylistRank) : null;

  return (
    <div className={"relative rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0 md:space-x-8 bg-gradient-to-br " + (isNaughtyMode ? 'from-rose-50 to-rose-100 dark:from-gray-900 dark:to-rose-950/40' : 'from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800') + " " + (currentPlaylistRankStyle ? currentPlaylistRankStyle.border : (isNaughtyMode ? 'border-rose-200 dark:border-rose-900/50' : cardBorder))}>
      {currentPlaylistRankStyle && (
        <span
          className="absolute -top-2 -right-2 text-xl z-10"
          title={`${currentPlaylist.completions.length} fois — la ${currentPlaylistRank === 0 ? 'plus' : currentPlaylistRank === 1 ? '2e plus' : '3e plus'} utilisée`}
        >
          {currentPlaylistRankStyle.emoji}
        </span>
      )}
      <div className="relative group/cover">
        <button
          onClick={() => currentPlaylist.tracks[0] && resolveAndTogglePreview(currentPlaylist.tracks[0], getNextTrackForAutoAdvance)}
          title="Écouter cette playlist"
          className={"relative w-32 h-32 md:w-48 md:h-48 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner text-5xl md:text-7xl cursor-pointer " + inputBg}
        >
          <div className={"absolute inset-0 opacity-10 dark:opacity-20 " + (isNaughtyMode ? 'bg-rose-500' : 'bg-red-500')}></div>
          {/* Playlists ensemencées (voir data/curatedSessions.js) : `coverUrl`
              (image générée DiceBear), en plus de `coverIcon` (l'émoji, gardé
              en repli). Une playlist générée classiquement ou importée via
              lien n'a PAS de `coverUrl` — retombe naturellement sur l'émoji. */}
          {currentPlaylist.coverUrl ? (
            <>
              <img src={currentPlaylist.coverUrl} alt="" className="w-full h-full object-cover rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Music2 size={56} className="text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-opacity duration-300 group-hover/cover:opacity-0" />
              </div>
            </>
          ) : (
            currentPlaylist.coverIcon
          )}
          {/* Cliquer sur la pochette lance la playlist (1er titre + enchaînement
              automatique, getNextTrackForAutoAdvance — même mécanisme que
              partout ailleurs sur cette page). Même cercle rouge que
              TemplateCard.jsx (DiscoverView.jsx) au survol — plus une icône
              blanche nue superposée à la note centrale, qui se chevauchaient
              de façon brouillonne. `<span>` (pas un 2e `<button>` : cette
              pochette EST déjà un bouton, imbriquer un bouton dans un bouton
              serait du HTML invalide) centré par le `flex items-center
              justify-center` de cet overlay, pas par un positionnement
              absolu propre. */}
          <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/20 transition-colors flex items-center justify-center">
            <span className={`w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 scale-95 group-hover/cover:opacity-100 group-hover/cover:scale-100 transition-all duration-300 ${bgAccentClass}`}>
              <Play size={22} className="fill-white ml-0.5"/>
            </span>
          </div>
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-between text-center md:text-left w-full">
        <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            {isLocked && currentPlaylist.completions.length > 0 && (
              <>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold flex items-center ${textColorClass}`}
                    title="Séance déjà réalisée"
                  >
                    <Lock size={12}/>
                  </span>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${textMuted}`}>
                    {renderTopCompletionDate ? renderTopCompletionDate(currentPlaylist) : new Date(currentPlaylist.completions[0].slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </>
            )}
            {/* "Planifier" — n'apparaît que si la playlist est déjà sauvegardée
                (planifier une séance qui n'est pas encore dans "Mes Séances"
                n'a pas de sens). */}
            {savedPlaylists.find(p => p.id === currentPlaylist.id) && (
              <label
                onClick={(e) => {
                  // showPicker() force l'ouverture explicitement là où l'API existe
                  // (Chrome/Edge récents) — sans ce filet, le clic pouvait ne
                  // simplement rien faire dans certains navigateurs. Sur les
                  // navigateurs sans showPicker (Safari plus anciens, Firefox),
                  // on laisse le comportement natif label→input inchangé.
                  if (plannedDateInputRef.current?.showPicker) {
                    e.preventDefault();
                    plannedDateInputRef.current.showPicker();
                  }
                }}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0 ${cardBorder} ${textHighlight}`}
                title={
                  // Une fois la séance déjà réalisée, "planifier" ne peut plus
                  // vouloir dire "prévoir sa première fois" — ça ne peut plus
                  // être qu'une intention de la refaire plus tard.
                  isLocked ? "Refaire cette séance" : "Planifier cette séance"
                }
              >
                <Calendar size={14} />
                {currentPlaylist.plannedDate && (
                  <span>{new Date(currentPlaylist.plannedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                )}
                <input
                  ref={plannedDateInputRef}
                  type="date"
                  value={currentPlaylist.plannedDate || ''}
                  onChange={(e) => setPlaylistPlannedDate(currentPlaylist.id, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            )}
          </div>
          {/* N'affiche cette liste que s'il reste au moins UNE date au-delà
              de `completions[0]` (déjà montrée, éditable, juste au-dessus) :
              sur une séance jamais rejouée (le cas le plus courant), il
              n'y aurait plus rien à montrer ici. */}
          {isLocked && renderCompletionsList && currentPlaylist.completions.length > 1 && (
            <div className="pt-0.5">
              {renderCompletionsList(currentPlaylist, mostRecentCompletionIso, [currentPlaylist.completions[0]])}
            </div>
          )}
        </div>

        {/* Titre éditable — text-2xl/text-4xl (plutôt que text-5xl) pour que
            la plupart des noms tiennent sur une ligne SANS être coupés, et
            `truncate` en filet de sécurité pour les noms vraiment longs. */}
        {isEditingPlaylistName ? (
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <input
              type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlaylist(); if (e.key === 'Escape') setIsEditingPlaylistName(false); }}
              className={`text-2xl md:text-4xl font-black bg-transparent outline-none border-b-2 ${borderAccentClass} ${textHighlight} w-full`}
            />
            <button onClick={handleRenamePlaylist} className={`p-2 rounded-lg text-white shrink-0 ${bgAccentClass}`}><Check size={20}/></button>
          </div>
        ) : (
          <h2 className={"text-2xl md:text-4xl font-black flex items-center gap-3 justify-center md:justify-start " + textHighlight}>
            <span className="truncate min-w-0" title={currentPlaylist.name}>{currentPlaylist.name}</span>
            <button onClick={() => { setEditedPlaylistName(currentPlaylist.name); setIsEditingPlaylistName(true); }} className={`p-1.5 rounded-lg ${textMuted} hover:text-main transition-colors shrink-0`} title="Renommer la playlist">
              <Edit3 size={20}/>
            </button>
          </h2>
        )}
        {/* Ligne d'infos de la playlist SEULES. */}
        <div className={"flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium " + textMuted}>
          <div className="flex items-center space-x-1"><Activity size={16}/><span>{currentPlaylist.workoutType}</span></div><span>•</span>
          <div className="flex items-center space-x-1"><Clock size={16}/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div><span>•</span>
          <div className="flex items-center space-x-1"><Music size={16}/><span>{currentPlaylist.tracks.length} titres</span></div>
          {(() => {
            const cfg = currentPlaylist.config || {};
            // Les genres SÉLECTIONNÉS (cfg.selectedGenres) sont déjà des noms
            // canoniques de l'app (ex. "K-pop") — ne JAMAIS les repasser dans
            // normalizeGenreForDisplay (prévu pour nettoyer un genre BRUT venu
            // de Deezer). Seul le repli (genres réels des titres, quand aucun
            // genre n'a été explicitement sélectionné) a besoin de cette
            // normalisation — non nécessaire ici, ce repli utilise directement
            // getGenresForDisplay sur le genre déjà brut du titre.
            if (cfg.selectedGenres && cfg.selectedGenres.length > 0) {
              return (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1"><Music size={16}/><span>{cfg.selectedGenres.map(genreDisplayLabel).join(', ')}</span></div>
                </>
              );
            }
            const genres = Array.from(new Set(currentPlaylist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
            return genres.length > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center space-x-1"><Music size={16}/><span>{Array.from(new Set(genres.flatMap(getGenresForDisplay))).join(', ')}</span></div>
              </>
            );
          })()}
        </div>
        </div>

        {/* Ligne d'actions du bas : import CSV / partager à gauche,
            sauvegarder-retirer à droite. */}
        <div className="flex items-center flex-wrap justify-between gap-3 mt-4">
          <div className="flex items-center flex-wrap justify-center md:justify-start gap-3">
          {isLocked && triggerCSVUpload && (
            <button
              onClick={(e) => triggerCSVUpload(e, currentPlaylist, mostRecentCompletionIso)}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-sm shrink-0 bg-white text-black shadow-lg transition-transform hover:scale-[1.02] ${hasImportedDataForMostRecent ? 'animate-in fade-in zoom-in duration-500' : 'animate-pulse'}`}
            >
              {hasImportedDataForMostRecent ? (
                <>
                  <CheckCircle size={16} className="text-green-500 shrink-0" />
                  <span>Données importées</span>
                </>
              ) : (
                <>
                  <Upload size={16} className="shrink-0" />
                  <span>Importe tes données</span>
                </>
              )}
            </button>
          )}
          {/* ShareModal génère déjà l'image en arrière-plan et l'inclut
              directement dans l'aperçu du partage (avec une croix pour la
              retirer) — `onShare` (fourni par le parent) déclenche cette
              génération ET ouvre le menu de partage en un seul clic. */}
          <button
            onClick={onShare}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          >
            <Share2 size={16} /> <span>Partager</span>
          </button>
          </div>

          {savedPlaylists.find(p => p.id === currentPlaylist.id) ? (
            <button
              onClick={handleUnsavePlaylist}
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${textMuted} hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <button
              onClick={handleSavePlaylist}
              title="Ajoute cette séance à 'Mes Séances', ton journal de séances (passées et à venir)."
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0 ${cardBorder} ${textHighlight}`}
            >
              <Save size={14} /> <span>Ajouter à Mes Séances</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
