import { useRef } from 'react';
import {
  Check, Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Music2, Play,
  Calendar, Lock, Upload, Trash2, Gauge,
} from 'lucide-react';
import { getGenresForDisplay, genreDisplayLabel } from '../../../musicCatalog';
import { formatDuration } from '../../../utils/format';
import { buildCoverUrl } from '../../../utils/coverArt';
import { getActivityEmoji, getZoneForValue, getBpmBucketColor, getBpmBucketStart } from '../../../appConfig';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';

/**
 * PlaylistHeader.jsx — en-tête de PlaylistDetailView : pochette, titre
 * (édition inline), badges d'infos (dont BPM/Zone), et rangée d'actions
 * (import CSV, planifier, partager, sauvegarder/retirer). Extrait de
 * PlaylistDetailView.jsx (chantier découpage, suite de TrackList/TrackItem).
 *
 * RETOUR RECUL (STOP aux ajustements complexes, juillet 2026) — 3 passes
 * successives de raffinement visuel (glassmorphism, ancrage vertical
 * items-stretch, cascade responsive sm/md/lg, badge repoussé à droite via
 * justify-between) avaient fini par produire l'inverse de l'objectif :
 * métadonnées quasi illisibles et un badge BPM isolé dans un coin. Ce
 * fichier repart sur une structure flex volontairement PLATE et minimale :
 *   - Conteneur : `flex items-center gap-6 p-6 bg-slate-900 rounded-2xl
 *     border border-slate-800` — fond plein, pas de dégradé/glass.
 *   - Pochette : taille FIXE (`w-36 h-36`), pas de cascade responsive.
 *   - Bloc de droite : `flex flex-col justify-center gap-3` — titre,
 *     métadonnées, actions, groupés naturellement par le `gap`, sans
 *     `justify-between` ni hauteur calquée sur la pochette.
 *   - Badge BPM/Zone : DANS le fil des métadonnées (après les genres),
 *     jamais `ml-auto` ni positionné à part — un badge compact parmi
 *     d'autres, pas un élément qui réclame sa propre moitié de carte.
 *   - Couleurs de texte explicites et non ambiguës : `text-slate-300` pour
 *     tout le texte de métadonnées, `text-slate-400` pour les icônes qui
 *     l'accompagnent — jamais une classe plus foncée qui se fondrait dans
 *     le fond `bg-slate-900`.
 *
 * Reçoit en props : ce qui est possédé par PlaylistDetailView (theme,
 * verrouillage, savedPlaylists — pour le classement/médaille — et les
 * fonctions de rendu/action partagées avec PlaylistsView/TrophiesView), ce
 * qui est partagé avec PlaylistCharts (resolveAndTogglePreview/
 * getNextTrackForAutoAdvance — le bouton "Écouter cette playlist" sur la
 * pochette utilise EXACTEMENT le même mécanisme que le bouton play de
 * l'encart segment sélectionné dans PlaylistCharts, pas une 2e
 * implémentation ; bpmChartActivityName — même résolution d'activité que le
 * badge BPM/Zone de PlaylistCharts, jamais une 2e formule). `onShare` :
 * callback fourni par le parent (qui possède `summaryCardRef`/génération
 * d'image, non déplaçable ici) — cet en-tête n'a besoin de savoir QUE
 * "cliquer ici déclenche le partage", pas comment.
 *
 * Tout le reste (nom éditable, sauvegarde/retrait, currentPlaylist lui-même,
 * getProfileForWorkout) vient de usePlaylistDetail().
 */
export default function PlaylistHeader({
  theme, isLocked, savedPlaylists,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  setPlaylistPlannedDate, bpmChartActivityName,
  renderCompletionsList, renderTopCompletionDate, getRankStyle, triggerCSVUpload,
  onShare,
}) {
  const { bgAccentClass } = theme;
  const {
    currentPlaylist, getProfileForWorkout,
    isEditingPlaylistName, setIsEditingPlaylistName, editedPlaylistName, setEditedPlaylistName, handleRenamePlaylist,
    handleSavePlaylist, handleUnsavePlaylist,
  } = usePlaylistDetail();

  // BPM moyen réel de la playlist — même formule que SessionSummaryCard.jsx/
  // ImportSharedPlaylistModal.jsx/StatsView.jsx/App.jsx (`avgBpm`), jamais
  // recalculée différemment ici. `getZoneForValue` STRICT (pas OrDefault) :
  // `null` si l'activité n'a jamais été configurée dans le Profil Athlétique
  // — repli sur la couleur neutre "Énergie Musicale" du camembert BPM
  // (`getBpmBucketColor`) plutôt qu'une zone inventée.
  const avgBpm = currentPlaylist.tracks.length > 0
    ? Math.round(currentPlaylist.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / currentPlaylist.tracks.length)
    : null;
  const bpmZone = avgBpm != null ? getZoneForValue(avgBpm, bpmChartActivityName, getProfileForWorkout) : null;
  const bpmBadgeColor = bpmZone ? bpmZone.color : (avgBpm != null ? getBpmBucketColor(getBpmBucketStart(avgBpm)) : null);

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

  const isSaved = !!savedPlaylists.find(p => p.id === currentPlaylist.id);

  return (
    <div className="relative flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-900 rounded-2xl border border-slate-800">
      {currentPlaylistRankStyle && (
        <span
          className="absolute -top-2 -right-2 text-xl z-10"
          title={`${currentPlaylist.completions.length} fois — la ${currentPlaylistRank === 0 ? 'plus' : currentPlaylistRank === 1 ? '2e plus' : '3e plus'} utilisée`}
        >
          {currentPlaylistRankStyle.emoji}
        </span>
      )}

      {/* Pochette — taille fixe, pas de cascade responsive. */}
      <button
        onClick={() => currentPlaylist.tracks[0] && resolveAndTogglePreview(currentPlaylist.tracks[0], getNextTrackForAutoAdvance)}
        title="Écouter cette playlist"
        className="group/cover relative w-36 h-36 shrink-0 rounded-2xl overflow-hidden shadow-lg cursor-pointer"
      >
        {/* Continuité visuelle avec PlaylistCard.jsx (Bibliothèque) : même
            logique de pochette exactement — `coverUrl` si déjà posé
            (playlists ouvertes depuis Découvrir, voir App.jsx
            `openCuratedPlaylist`), sinon `buildCoverUrl(currentPlaylist.name)`
            (déterministe, utils/coverArt.js). */}
        <img src={currentPlaylist.coverUrl || buildCoverUrl(currentPlaylist.name)} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Music2 size={44} className="text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-opacity duration-300 group-hover/cover:opacity-0" />
        </div>
        {/* Cliquer sur la pochette lance la playlist (1er titre + enchaînement
            automatique, getNextTrackForAutoAdvance — même mécanisme que
            partout ailleurs sur cette page). */}
        <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/30 transition-colors flex items-center justify-center">
          <span className={`w-12 h-12 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 scale-95 group-hover/cover:opacity-100 group-hover/cover:scale-100 transition-all duration-300 ${bgAccentClass}`}>
            <Play size={18} className="fill-white ml-0.5"/>
          </span>
        </div>
      </button>

      {/* Bloc de droite — flex-col + justify-center + gap : tout reste
          groupé naturellement, sans hauteur calquée sur la pochette ni
          répartition forcée de l'espace vertical. */}
      <div className="flex-1 flex flex-col justify-center gap-3 w-full min-w-0 text-center sm:text-left">
        {isLocked && currentPlaylist.completions.length > 0 && (
          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
            <span className="text-xs font-bold flex items-center text-rose-400" title="Séance déjà réalisée">
              <Lock size={12}/>
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {renderTopCompletionDate ? renderTopCompletionDate(currentPlaylist) : new Date(currentPlaylist.completions[0].slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {/* N'affiche cette liste que s'il reste au moins UNE date au-delà
                de `completions[0]` (déjà montrée juste au-dessus) : sur une
                séance jamais rejouée (le cas le plus courant), il n'y aurait
                plus rien à montrer ici. */}
            {renderCompletionsList && currentPlaylist.completions.length > 1 && (
              <span>{renderCompletionsList(currentPlaylist, mostRecentCompletionIso, [currentPlaylist.completions[0]])}</span>
            )}
          </div>
        )}

        {/* Titre éditable. */}
        {isEditingPlaylistName ? (
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <input
              type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlaylist(); if (e.key === 'Escape') setIsEditingPlaylistName(false); }}
              className="text-3xl font-extrabold bg-transparent outline-none border-b-2 border-rose-500 text-white w-full"
            />
            <button onClick={handleRenamePlaylist} className="p-2 rounded-lg text-white shrink-0 bg-rose-600 hover:bg-rose-500"><Check size={20}/></button>
          </div>
        ) : (
          <h2 className="text-3xl font-extrabold flex items-center gap-3 justify-center sm:justify-start text-white">
            <span className="truncate min-w-0" title={currentPlaylist.name}>{getActivityEmoji(currentPlaylist.workoutType)} {currentPlaylist.name}</span>
            <button onClick={() => { setEditedPlaylistName(currentPlaylist.name); setIsEditingPlaylistName(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0" title="Renommer la playlist">
              <Edit3 size={20}/>
            </button>
          </h2>
        )}

        {/* Ligne de métadonnées — TOUT le texte en `text-slate-300`, toutes
            les icônes en `text-slate-400` : explicite et non ambigu, aucune
            classe plus foncée qui se fondrait dans `bg-slate-900`. Le badge
            BPM/Zone vit ICI, dans le même fil que le reste (`flex-wrap`) —
            un badge compact parmi d'autres, jamais `ml-auto` ni sorti du
            flux normal. */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-sm text-slate-300">
          <div className="flex items-center gap-1.5"><Activity size={16} className="text-slate-400"/><span>{currentPlaylist.workoutType}</span></div>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400"/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1.5"><Music size={16} className="text-slate-400"/><span>{currentPlaylist.tracks.length} titres</span></div>
          {(() => {
            const cfg = currentPlaylist.config || {};
            // Les genres SÉLECTIONNÉS (cfg.selectedGenres) sont déjà des noms
            // canoniques de l'app (ex. "K-pop") — ne JAMAIS les repasser dans
            // normalizeGenreForDisplay (prévu pour nettoyer un genre BRUT venu
            // de Deezer). Seul le repli (genres réels des titres, quand aucun
            // genre n'a été explicitement sélectionné) a besoin de cette
            // normalisation.
            if (cfg.selectedGenres && cfg.selectedGenres.length > 0) {
              return (
                <>
                  <span className="text-slate-600">•</span>
                  <div className="flex items-center gap-1.5"><Music size={16} className="text-slate-400"/><span>{cfg.selectedGenres.map(genreDisplayLabel).join(', ')}</span></div>
                </>
              );
            }
            const genres = Array.from(new Set(currentPlaylist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
            return genres.length > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1.5"><Music size={16} className="text-slate-400"/><span>{Array.from(new Set(genres.flatMap(getGenresForDisplay))).join(', ')}</span></div>
              </>
            );
          })()}
          {/* Badge BPM/Zone — couleur dynamique appliquée en `style` inline,
              pas en classe Tailwind arbitraire (une couleur calculée à
              l'exécution ne peut pas être une classe générée à la
              compilation) — même convention que `zoneColor` dans
              TrackItem.jsx. Libellé de zone SEULEMENT si un profil réel est
              configuré pour cette activité (`getZoneForValue` strict) ;
              sinon repli neutre sur `getBpmBucketColor`. */}
          {bpmBadgeColor && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{ backgroundColor: `${bpmBadgeColor}26`, borderColor: `${bpmBadgeColor}66`, color: bpmBadgeColor }}
            >
              <Gauge size={14} />
              <span>{avgBpm} BPM{bpmZone ? ` • ${bpmZone.shortLabel}` : ''}</span>
            </div>
          )}
        </div>

        {/* Ligne d'actions — hiérarchie explicite : action PRINCIPALE d'abord
            (pleine, rose, mise en valeur), planifier et partager ensuite,
            discrets. Import CSV (quand applicable) vient AVANT ce trio :
            c'est une action ponctuelle contextuelle liée à une séance déjà
            verrouillée, pas une des actions "de base" toujours disponibles
            sur cette page. */}
        <div className="flex items-center flex-wrap justify-center sm:justify-start gap-3">
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

          {/* Action principale : Ajouter à Mes Séances / Retirer. */}
          {isSaved ? (
            <button
              onClick={handleUnsavePlaylist}
              title="Retirer cette séance de 'Mes Séances'"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shrink-0 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <Trash2 size={16} /> <span>Retirer de Mes Séances</span>
            </button>
          ) : (
            <button
              onClick={handleSavePlaylist}
              title="Ajoute cette séance à 'Mes Séances', ton journal de séances (passées et à venir)."
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm shrink-0 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-colors"
            >
              <Save size={16} /> <span>Ajouter à Mes Séances</span>
            </button>
          )}

          {/* Planifier — n'apparaît que si la playlist est déjà sauvegardée. */}
          {isSaved && (
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
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors border cursor-pointer bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200 shrink-0"
              title={
                // Une fois la séance déjà réalisée, "planifier" ne peut plus
                // vouloir dire "prévoir sa première fois" — ça ne peut plus
                // être qu'une intention de la refaire plus tard.
                isLocked ? "Refaire cette séance" : "Planifier cette séance"
              }
            >
              <Calendar size={16} />
              <span>{currentPlaylist.plannedDate ? new Date(currentPlaylist.plannedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Planifier'}</span>
              <input
                ref={plannedDateInputRef}
                type="date"
                value={currentPlaylist.plannedDate || ''}
                onChange={(e) => setPlaylistPlannedDate(currentPlaylist.id, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          )}

          {/* Partager — ShareModal génère déjà l'image en arrière-plan et
              l'inclut directement dans l'aperçu du partage (avec une croix
              pour la retirer) — `onShare` (fourni par le parent) déclenche
              cette génération ET ouvre le menu de partage en un seul clic. */}
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shrink-0 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <Share2 size={16} /> <span>Partager</span>
          </button>
        </div>
      </div>
    </div>
  );
}
