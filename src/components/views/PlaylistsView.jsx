import { useState } from 'react';
import { List, Library, Plus, Calendar, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import PlaylistCard from './PlaylistCard';

/**
 * PlaylistsView — vue "Bibliothèque" (renommée depuis "Mes Séances", elle-même
 * renommée depuis "Mes Playlists").
 *
 * Fusionne ce qui était avant deux pages séparées ("Mes Playlists" et "Ma
 * File d'attente", voir passation) suite à un retour direct : une file
 * séparée n'apportait pas grand-chose de plus qu'un simple ordre + une date
 * optionnelle directement sur les cartes existantes. Fusionne aussi ce qui
 * était l'onglet "Historique" (HistoryView.jsx, retiré) : depuis que la
 * planification/les dates sont intégrées ici, cet écran couvre toute la
 * ligne de temps d'une séance (à venir → faite), un onglet séparé pour le
 * passé faisait doublon. 3 sections, dans cet ordre :
 *
 * 1. "À planifier" — playlists non terminées SANS date. Réordonnables à la
 *    main par glisser-déposer (même mécanisme que l'ordre des titres dans
 *    une playlist, voir PlaylistDetailView) : c'est là qu'on retrouve l'idée
 *    de "file d'attente", mais sans jamais forcer de date. PAS paginée : le
 *    glisser-déposer devrait sinon gérer le passage d'une page à l'autre, ce
 *    qui complexifierait beaucoup ce mécanisme pour un gain limité — c'est
 *    une file de travail active, généralement courte.
 * 2. "Planifiées" — playlists non terminées AVEC une date, triées par date
 *    croissante. La date reste optionnelle et n'est JAMAIS une contrainte
 *    bloquante — juste une clé de tri en plus de l'ordre manuel ci-dessus.
 *    Paginée (pas de glisser-déposer ici, donc rien à casser).
 * 3. "Terminées" — comportement inchangé sinon : triées par complétion la
 *    plus récente d'abord. Paginée — c'est la section qui grossit le plus
 *    avec le temps (tout l'historique, maintenant que HistoryView a disparu),
 *    donc la plus concernée par le risque de scroll infini.
 *
 * Le glisser-déposer ne réordonne QUE le sous-ensemble "À planifier" au sein
 * du tableau `savedPlaylists` complet — les positions des autres playlists
 * (datées ou terminées) ne bougent jamais quand on réordonne cette section.
 */

// Nombre de cartes par page pour les sections paginées (Planifiées/Terminées).
const PAGE_SIZE = 10;

// Petit helper de pagination local à cette vue. `page` peut dépasser
// `totalPages - 1` (ex. après suppression d'items) — on clampe ici plutôt que
// de risquer une page vide ou hors-limites ; les boutons de la pagination
// utilisent `safePage` (valeur affichée) pour calculer prev/next, donc rien
// à resynchroniser dans un useEffect séparé.
const usePageSlice = (items, page) => {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  return { pageItems: items.slice(start, start + PAGE_SIZE), totalPages, safePage };
};

export default function PlaylistsView({
  theme, isNaughtyMode, savedPlaylists, setSavedPlaylists, requestRemoveSavedPlaylist, setPlaylistPlannedDate, getRankStyle,
  setCurrentPlaylist, changeView, renderConfigInfoLine, renderCompletionsList, markPlaylistAsCompleted,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const [draggedId, setDraggedId] = useState(null);
  const [plannedPage, setPlannedPage] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);

  const isCompleted = (p) => p.completions && p.completions.length > 0;

  // Pare-feu Mode Intime (retour direct : "les vues Bibliothèque et Découvrir
  // mélangent les contenus des deux modes") — TOUT le reste de ce composant
  // travaille sur `visiblePlaylists`, jamais directement sur `savedPlaylists`
  // (qui contient les deux modes mélangés) : `!!p.isNaughty` normalise
  // undefined/false en booléen propre avant comparaison (playlists
  // anciennes sans ce champ), même garde-fou déjà en place dans
  // StatsView.jsx pour le même filtre.
  const visiblePlaylists = savedPlaylists.filter(p => !!p.isNaughty === !!isNaughtyMode);

  const toPlan = visiblePlaylists.filter(p => !isCompleted(p) && !p.plannedDate);
  const planned = [...visiblePlaylists.filter(p => !isCompleted(p) && p.plannedDate)]
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const completedPlaylists = [...visiblePlaylists.filter(isCompleted)].sort((a, b) => {
    const lastA = a.completions[a.completions.length - 1];
    const lastB = b.completions[b.completions.length - 1];
    return lastB.localeCompare(lastA);
  });

  const { pageItems: plannedPageItems, totalPages: plannedTotalPages, safePage: plannedSafePage } = usePageSlice(planned, plannedPage);
  const { pageItems: completedPageItems, totalPages: completedTotalPages, safePage: completedSafePage } = usePageSlice(completedPlaylists, completedPage);

  // Classement par nombre d'utilisations, uniquement parmi celles ayant déjà
  // été faites au moins une fois — sert à la bordure or/argent/bronze.
  // Calculé sur la liste COMPLÈTE (pas juste la page affichée), sinon le
  // classement changerait selon la page consultée.
  const playlistRanks = [...completedPlaylists].sort((a, b) => b.completions.length - a.completions.length).map(p => p.id);

  // Réordonne UNIQUEMENT le sous-ensemble "À planifier" au sein de
  // `savedPlaylists`, en conservant la position relative de tout le reste
  // (playlists datées ou terminées) — même principe que le glisser-déposer
  // des titres dans une playlist (voir handleTrackDragEnter dans App.jsx).
  const reorderToPlan = (draggedPlaylistId, targetPlaylistId) => {
    setSavedPlaylists(prev => {
      const inSection = (p) => !isCompleted(p) && !p.plannedDate && !!p.isNaughty === !!isNaughtyMode;
      const ids = prev.filter(inSection).map(p => p.id);
      const fromIdx = ids.indexOf(draggedPlaylistId);
      const toIdx = ids.indexOf(targetPlaylistId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const reordered = [...ids];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      let cursor = 0;
      return prev.map(p => {
        if (inSection(p)) return prev.find(pp => pp.id === reordered[cursor++]);
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
        onDelete={requestRemoveSavedPlaylist}
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

  // Pagineur compact (Précédent / Page X sur Y / Suivant) — masqué s'il n'y a
  // qu'une seule page. `page`/`setPage` reçoivent la valeur déjà clampée
  // (`safePage`), pas l'état brut, pour rester cohérents avec ce qui est
  // affiché même juste après une suppression qui réduirait le nombre de pages.
  const renderPager = (page, totalPages, setPage) => totalPages > 1 && (
    <div className="flex items-center justify-center gap-3 pt-1">
      <button
        onClick={() => setPage(Math.max(0, page - 1))}
        disabled={page === 0}
        className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${textMuted} hover:text-main hover:bg-surface-hover`}
      >
        <ChevronLeft size={18} />
      </button>
      <span className={`text-xs font-bold ${textMuted}`}>Page {page + 1} / {totalPages}</span>
      <button
        onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${textMuted} hover:text-main hover:bg-surface-hover`}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );

  const isEmpty = visiblePlaylists.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><Library className={textColorClass} size={36} /> <span>Bibliothèque</span></h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Retrouve ici toutes tes playlists générées. Glisse-dépose pour organiser tes prochaines écoutes, ton historique complet est juste en dessous.</p>
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
          {/* --- À PLANIFIER (pas de date, ordre manuel par glisser-déposer, PAS paginée) --- */}
          <div className="space-y-4">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${textMuted}`}>À planifier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed ${cardBorder} flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${textMuted} hover:text-main hover:border-gray-400`}>
                <Plus size={28} />
                <span>Générer une nouvelle playlist</span>
              </button>
              {toPlan.map(p => renderCard(p, { draggableSection: true }))}
            </div>
          </div>

          {/* --- PLANIFIÉES (une date a été choisie, triées par date, paginée) --- */}
          {planned.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${textMuted} flex items-center gap-2`}>
                <Calendar size={14} /> Planifiées
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plannedPageItems.map(p => renderCard(p))}
              </div>
              {renderPager(plannedSafePage, plannedTotalPages, setPlannedPage)}
            </div>
          )}

          {/* --- TERMINÉES (fusionne l'ancien "Historique", paginée) --- */}
          {completedPlaylists.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${textMuted} flex items-center gap-2`}>
                <CheckCircle size={14} /> Terminées
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedPageItems.map(p => renderCard(p))}
              </div>
              {renderPager(completedSafePage, completedTotalPages, setCompletedPage)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
