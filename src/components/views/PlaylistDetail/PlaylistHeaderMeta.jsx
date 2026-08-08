import { Lock, Activity, Clock, Music } from 'lucide-react';
import { getGenresForDisplay, genreDisplayLabel } from '../../../musicCatalog';
import { formatDuration } from '../../../utils/format';
import TopCompletionDate from '../../shared/TopCompletionDate';
import CompletionsList from '../../shared/CompletionsList';

/**
 * PlaylistHeaderMeta.jsx — badge "séance déjà réalisée" + dernière date
 * (+ liste des autres dates), suivi de la ligne d'infos brutes de la
 * playlist (type d'activité, durée, nb de titres, genres). Extrait de
 * `PlaylistHeader.jsx` (chantier découpage, 08/08) — 2 blocs regroupés
 * ici car tous deux purement informatifs (pas d'action principale), à la
 * différence de `PlaylistHeaderActions.jsx`.
 */
export default function PlaylistHeaderMeta({
  currentPlaylist, theme, isLocked, isReadOnly,
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate,
  triggerCSVUpload, removeImportedData, mostRecentCompletionIso,
}) {
  return (
    <>
      {/* Badge "séance déjà réalisée" — seul élément qui peut légitimement
          précéder le titre (info sur la séance elle-même, pas une action).
          Bloc entier conditionné à `isLocked`, pas juste son contenu :
          sans ça, un conteneur vide laisse un espace mort au-dessus du
          titre. */}
      {isLocked && currentPlaylist.completions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 justify-center md:justify-start">
            <span className="text-xs font-bold flex items-center text-rose-400" title="Séance déjà réalisée">
              <Lock size={12}/>
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              <TopCompletionDate
                playlist={currentPlaylist} theme={theme}
                editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                editCompletionDate={editCompletionDate}
                isReadOnly={isReadOnly}
              />
            </p>
          </div>
          {/* N'affiche cette liste que s'il reste au moins UNE date au-delà
              de `completions[0]` (déjà montrée juste au-dessus). */}
          {currentPlaylist.completions.length > 1 && (
            <div className="pt-0.5">
              <CompletionsList
                playlist={currentPlaylist} theme={theme}
                hideUploadForDate={mostRecentCompletionIso} skipDates={[currentPlaylist.completions[0]]}
                editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
                triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
                isReadOnly={isReadOnly}
              />
            </div>
          )}
        </div>
      )}

      {/* Ligne d'infos de la playlist SEULES — icônes + `text-slate-300`
          (fixe, cohérent avec le fond toujours sombre de cette carte). */}
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-sm font-medium text-slate-300">
        <div className="flex items-center gap-1.5"><Activity size={16} className="text-slate-400"/><span>{currentPlaylist.workoutType}</span></div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400"/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5"><Music size={16} className="text-slate-400"/><span>{currentPlaylist.tracks.length} titres</span></div>
        {(() => {
          const cfg = currentPlaylist.config || {};
          // Les genres SÉLECTIONNÉS (cfg.selectedGenres) sont déjà des noms
          // canoniques de l'app — ne JAMAIS les repasser dans
          // normalizeGenreForDisplay (prévu pour un genre BRUT venu de
          // Deezer). Seul le repli (genres réels des titres) a besoin de
          // cette normalisation.
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
      </div>
    </>
  );
}
