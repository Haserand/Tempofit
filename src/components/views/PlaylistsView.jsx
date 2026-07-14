import { useState } from 'react';
import { List, Plus, Calendar, CheckCircle } from 'lucide-react';
import PlaylistCard from './PlaylistCard';

/**
 * PlaylistsView — vue "Mes Playlists".
 *
 * Fusionne ce qui était avant deux pages séparées ("Mes Playlists" et "Ma
 * File d'attente", voir passation) suite à un retour direct : une file
 * séparée n'apportait pas grand-chose de plus qu'un simple ordre + une date
 * optionnelle directement sur les cartes existantes. 3 sections, dans cet
 * ordre :
 *
 * 1. "À planifier" — playlists non terminées SANS date. Réordonnables à la
 *    main par glisser-déposer (même mécanisme que l'ordre des titres dans
 *    une playlist, voir PlaylistDetailView) : c'est là qu'on retrouve l'idée
 *    de "file d'attente", mais sans jamais forcer de date.
 * 2. "Planifiées" — playlists non terminées AVEC une date, triées par date
 *    croissante. La date reste optionnelle et n'est JAMAIS une contrainte
 *    bloquante — juste une clé de tri en plus de l'ordre manuel ci-dessus.
 * 3. "Terminées" — comportement inchangé : triées par complétion la plus
 *    récente d'abord.
 *
 * Le glisser-déposer ne réordonne QUE le sous-ensemble "À planifier" au sein
 * du tableau `savedPlaylists` complet — les positions des autres playlists
 * (datées ou terminées) ne bougent jamais quand on réordonne cette section.
 */
export default function PlaylistsView({
  theme, isNaughtyMode, savedPlaylists, setSavedPlaylists, setPlaylistPlannedDate, getRankStyle,
  setCurrentPlaylist, changeView, renderConfigInfoLine, renderCompletionsList, markPlaylistAsCompleted,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const [draggedId, setDraggedId] = useState(null);

  const isCompleted = (p) => p.completions && p.completions.length > 0;

  const toPlan = savedPlaylists.filter(p => !isCompleted(p) && !p.plannedDate);
  const planned = [...savedPlaylists.filter(p => !isCompleted(p) && p.plannedDate)]
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const completedPlaylists = [...savedPlaylists.filter(isCompleted)].sort((a, b) => {
    const lastA = a.completions[a.completions.length - 1];
    const lastB = b.completions[b.completions.length - 1];
    return lastB.localeCompare(lastA);
  });

  // Classement par nombre d'utilisations, uniquement parmi celles ayant déjà
  // été faites au moins une fois — sert à la bordure or/argent/bronze.
  const playlistRanks = [...completedPlaylists].sort((a, b) => b.completions.length - a.completions.length).map(p => p.id);

  // Réordonne UNIQUEMENT le sous-ensemble "À planifier" au sein de
  // `savedPlaylists`, en conservant la position relative de tout le reste
  // (playlists datées ou terminées) — même principe que le glisser-déposer
  // des titres dans une playlist (voir handleTrackDragEnter dans App.jsx).
  const reorderToPlan = (draggedPlaylistId, targetPlaylistId) => {
    setSavedPlaylists(prev => {
      const ids = prev.filter(p => !isCompleted(p) && !p.plannedDate).map(p => p.id);
      const fromIdx = ids.indexOf(draggedPlaylistId);
      const toIdx = ids.indexOf(targetPlaylistId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const reordered = [...ids];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      let cursor = 0;
      return prev.map(p => {
        if (!isCompleted(p) && !p.plannedDate) return prev.find(pp => pp.id === reordered[cursor++]);
        return p;
      });
    });
  };

  const renderCard = (playlist, { draggableSection } = {}) => {
    const rank = playlistRanks.indexOf(playlist.id);
    const rankStyle = getRankStyle(rank);
    return (
      <PlaylistCard
        key={playlist.id}
        theme={theme} isNaughtyMode={isNaughtyMode} playlist={playlist} rankStyle={rankStyle} rank={rank}
        onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}
        onDelete={(id) => setSavedPlaylists(savedPlaylists.filter(p => p.id !== id))}
        showActions={true}
        renderConfigInfoLine={renderConfigInfoLine} renderCompletionsList={renderCompletionsList}
        markPlaylistAsCompleted={markPlaylistAsCompleted}
        onSetPlannedDate={setPlaylistPlannedDate}
        draggable={draggableSection}
        isDragging={draggableSection && draggedId === playlist.id}
        onDragStart={draggableSection ? (e) => { setDraggedId(playlist.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
        onDragEnter={draggableSection ? (e) => { e.preventDefault(); if (draggedId && draggedId !== playlist.id) reorderToPlan(draggedId, playlist.id); } : undefined}
        onDragEnd={draggableSection ? () => setDraggedId(null) : undefined}
      />
    );
  };

  const isEmpty = savedPlaylists.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><List className={textColorClass} size={36} /> <span>Mes Playlists</span></h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Glisse-dépose pour choisir l'ordre de tes prochaines séances, planifie une date si tu en as une — les deux sont optionnels.</p>
      </div>

      {isEmpty ? (
        <div className={`py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
          <List size={48} className={`mx-auto mb-4 text-gray-300 dark:text-gray-700`} />
          <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune playlist sauvegardée</h3>
          <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère une playlist et sauvegarde-la pour la retrouver ici.</p>
          <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
            Générer ma première playlist
          </button>
        </div>
      ) : (
        <>
          {/* --- À PLANIFIER (pas de date, ordre manuel par glisser-déposer) --- */}
          <div className="space-y-4">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${textMuted}`}>À planifier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed ${cardBorder} flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400`}>
                <Plus size={28} />
                <span>Générer une nouvelle playlist</span>
              </button>
              {toPlan.map(p => renderCard(p, { draggableSection: true }))}
            </div>
          </div>

          {/* --- PLANIFIÉES (une date a été choisie, triées par date) --- */}
          {planned.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${textMuted} flex items-center gap-2`}>
                <Calendar size={14} /> Planifiées
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {planned.map(p => renderCard(p))}
              </div>
            </div>
          )}

          {/* --- TERMINÉES (comportement inchangé) --- */}
          {completedPlaylists.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${textMuted} flex items-center gap-2`}>
                <CheckCircle size={14} /> Terminées
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedPlaylists.map(p => renderCard(p))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
