import { useRef } from 'react';
import { Music, Trash2, CheckCircle, Circle, Activity, List, Calendar, GripVertical } from 'lucide-react';

/**
 * PlaylistCard — carte d'une playlist, utilisée par PlaylistsView ("Mes
 * Séances") pour ses 3 sections (à planifier / planifiées / terminées).
 *
 * Historiquement partagée aussi avec HistoryView ("Historique", séances
 * terminées uniquement) via une prop `showActions` qui basculait entre 2
 * rendus. HistoryView a été retirée (fusionnée dans "Mes Séances" depuis que
 * la planification/dates y a été intégrée) — `showActions` était donc devenue
 * toujours `true` (plus qu'un seul appelant), retirée ici pour ne pas garder
 * une branche de code morte inatteignable.
 */
export default function PlaylistCard({
  theme, isNaughtyMode, playlist, rankStyle, rank,
  onClick, onDelete,
  renderConfigInfoLine, renderCompletionsList, markPlaylistAsCompleted,
  onSetPlannedDate,
  draggable, onDragStart, onDragEnter, onDragEnd, isDragging,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass, inputBg, inputBorder } = theme;
  // Filet de sécurité multi-navigateurs pour le bouton "Ajouter une date"
  // ci-dessous (même raison que PlaylistDetailView.jsx) : un <input
  // type="date"> caché derrière un <label> ne s'ouvre pas de façon fiable
  // partout au clic seul.
  const completionDateInputRef = useRef(null);
  const isCompleted = playlist.completions && playlist.completions.length > 0;

  const borderClasses = rankStyle
    ? rankStyle.border
    : (isCompleted ? 'border-green-500/30 bg-green-50/30 dark:bg-green-900/10' : cardBorder);

  const configInfo = (() => {
    const cfg = playlist.config || {};
    const genres = cfg.selectedGenres && cfg.selectedGenres.length > 0
      ? cfg.selectedGenres
      : Array.from(new Set(playlist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
    const infoSource = {
      workoutType: playlist.workoutType, customActivity: cfg.customActivity,
      targetMode: cfg.targetMode,
      distanceVal: playlist.avgPace ? Math.round((playlist.totalDuration / playlist.avgPace) * 10) / 10 : 0,
      distanceUnit: playlist.distanceUnit || cfg.distanceUnit,
      hours: Math.floor(playlist.totalDuration / 3600),
      minutes: Math.round((playlist.totalDuration % 3600) / 60),
      bpm: cfg.bpm, isIntervalMode: cfg.isIntervalMode, isCrescendoMode: cfg.isCrescendoMode, segments: cfg.segments,
      selectedGenres: genres
    };
    return renderConfigInfoLine(infoSource, (
      <div className="flex items-center space-x-1"><List size={14}/><span>{playlist.tracks.length} titres</span></div>
    ));
  })();

  const garminBadge = playlist.actualDataByDate && Object.keys(playlist.actualDataByDate).length > 0 && (
    <div className="flex items-center justify-center w-full py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold">
      <Activity size={14} className="mr-2"/> {Object.keys(playlist.actualDataByDate).length} séance{Object.keys(playlist.actualDataByDate).length > 1 ? 's' : ''} avec données Garmin importées (cadence/FC)
    </div>
  );

  return (
    <div
      className={`${cardBg} rounded-2xl p-4 border ${borderClasses} shadow-sm flex flex-col group hover:border-gray-400 transition-colors cursor-pointer select-none relative ${isDragging ? 'opacity-40' : ''}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDragEnd={onDragEnd}
    >
      {rankStyle && <span className="absolute -top-2 -right-2 text-xl" title={`${playlist.completions.length} fois — la ${rank === 0 ? 'plus' : rank === 1 ? '2e plus' : '3e plus'} utilisée`}>{rankStyle.emoji}</span>}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {draggable && (
            <div className="shrink-0 cursor-grab active:cursor-grabbing text-gray-400" title="Glisser pour réordonner">
              <GripVertical size={16}/>
            </div>
          )}
          <div className={`w-16 h-16 text-3xl rounded-xl flex items-center justify-center bg-gradient-to-br ${isNaughtyMode ? 'from-rose-400 to-rose-600' : 'from-gray-800 to-black dark:from-gray-200 dark:to-white'} shrink-0`}>
            {playlist.coverIcon || <Music size={24} className={isNaughtyMode ? 'text-white' : 'text-white dark:text-black'} />}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onSetPlannedDate && (
            <label
              onClick={(e) => e.stopPropagation()}
              className={`relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${playlist.plannedDate ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'}`}
              title={playlist.plannedDate ? "Date planifiée — modifier" : "Planifier une date (optionnel, sert juste à trier)"}
            >
              <Calendar size={16} />
              {playlist.plannedDate && <span>{new Date(playlist.plannedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
              <input
                type="date"
                value={playlist.plannedDate || ''}
                onChange={(e) => onSetPlannedDate(playlist.id, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(playlist.id); }} className="p-2 rounded-lg text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <h3 className={`font-bold text-lg flex items-center gap-2 ${textHighlight}`}>
        {playlist.name}
        {playlist.config?.isIntervalMode && (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white shrink-0 ${bgAccentClass}`}>
            {playlist.config?.isCrescendoMode ? 'Crescendo' : 'Fractionné'}
          </span>
        )}
      </h3>
      {configInfo}

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        {isCompleted ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-green-600 dark:text-green-400 text-xs font-bold bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                <CheckCircle size={14} className="mr-1.5"/> Faite {playlist.completions.length}x
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {playlist.createdAt}</span>
            </div>
            {/* Compare la date PLANIFIÉE (intention, optionnelle) à la date RÉELLE
                de la dernière complétion — deux choses distinctes qui coexistent :
                plannedDate ne se met jamais à jour toute seule quand on marque la
                playlist comme faite, donc l'écart reste visible après coup plutôt
                que d'être silencieusement écrasé. */}
            {playlist.plannedDate && (() => {
              const lastIso = playlist.completions[playlist.completions.length - 1];
              const lastDateOnly = lastIso.slice(0, 10);
              const plannedFormatted = new Date(playlist.plannedDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              let comparison;
              if (lastDateOnly === playlist.plannedDate) {
                comparison = 'faite comme prévu';
              } else {
                const diffDays = Math.round((new Date(lastDateOnly) - new Date(playlist.plannedDate)) / 86400000);
                comparison = diffDays > 0 ? `faite ${diffDays}j plus tard` : `faite ${Math.abs(diffDays)}j plus tôt`;
              }
              return (
                <div className={`text-xs ${textMuted}`}>
                  Planifiée le {plannedFormatted} · {comparison}
                </div>
              );
            })()}
            {renderCompletionsList(playlist)}
            {/* Fusionné avec l'ancienne pastille "+ Ajouter une date" (retour direct :
                elles faisaient doublon) — ce bouton permet maintenant de choisir
                n'importe quelle date, pas seulement "aujourd'hui". Le clic sur le
                <label> ouvre explicitement le sélecteur via showPicker() (filet de
                sécurité multi-navigateurs), et non plus un simple appel direct à
                markPlaylistAsCompleted au clic. */}
            <label
              onClick={(e) => {
                e.stopPropagation();
                if (completionDateInputRef.current?.showPicker) {
                  e.preventDefault();
                  completionDateInputRef.current.showPicker();
                }
              }}
              className={`relative flex items-center justify-center w-full py-2 text-xs font-bold cursor-pointer ${inputBg} hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-600 rounded-lg transition-colors border ${inputBorder}`}
            >
              <Circle size={14} className="mr-1.5"/> Ajouter une date
              <input
                ref={completionDateInputRef}
                type="date"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); if (e.target.value) markPlaylistAsCompleted(playlist.id, e.target.value); e.target.value = ''; }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            {garminBadge}
          </div>
        ) : (
          <>
            <button onClick={(e) => { e.stopPropagation(); markPlaylistAsCompleted(playlist.id); }} className={`flex items-center text-gray-500 hover:text-green-600 text-xs font-bold ${inputBg} hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors border ${inputBorder}`}>
              <Circle size={14} className="mr-1.5"/> Marquer comme faite
            </button>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {playlist.createdAt}</span>
          </>
        )}
      </div>
    </div>
  );
}
