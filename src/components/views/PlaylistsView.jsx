import { useState } from 'react';
import { List, Library, Plus, Calendar, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import PlaylistCard from './PlaylistCard';
import ViewHeader from '../shared/ViewHeader';

/**
 * PlaylistsView — vue "Mes Séances" (nom d'origine restauré le 25/07 : elle
 * s'était appelée "Bibliothèque" un temps, mais c'est resté le seul endroit
 * à le dire — le reste de l'app, lui, n'a jamais arrêté d'appeler cette
 * fonctionnalité "Mes Séances" partout ailleurs : info-bulles,
 * PlaylistHeader.jsx, StatsView.jsx, description de trophée dans
 * appConfig.js... Rétabli ici pour que le titre de la page matche enfin la
 * Sidebar et le reste de l'app, plutôt que l'inverse).
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
  setCurrentPlaylist, changeView, renderConfigInfoLine, markPlaylistAsCompleted,
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate, triggerCSVUpload,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const [draggedId, setDraggedId] = useState(null);
  const [plannedPage, setPlannedPage] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);

  const isCompleted = (p) => p.completions && p.completions.length > 0;

  // Pare-feu Mode Intime (retour direct : "les vues Mes Séances et Découvrir
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
        renderConfigInfoLine={renderConfigInfoLine}
        editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
        editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
        triggerCSVUpload={triggerCSVUpload}
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
    <div className="max-w-4xl mx-auto space-y-10">
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<Library className={textColorClass} size={36} />}
        title="Mes Séances"
        subtitle="Retrouve tes playlists générées, planifie tes écoutes et consulte ton historique."
      />

      {/* Notice "mode invité" RETIRÉE D'ICI (25/07) — vivait en double ici et
          dans StatsView.jsx, avec deux conditions de déclenchement légèrement
          différentes, et absente de RoutinesView.jsx alors que la même
          logique s'y appliquait tout autant (bug remonté par capture :
          "pourquoi ce message n'apparaît QUE sur certaines pages ?"). Un seul
          bloc centralisé désormais, dans Sidebar.jsx (persistante sur toutes
          les vues) — voir son commentaire pour le raisonnement complet. */}

      {isEmpty ? (
        <div className={`py-16 text-center border-2 border-dashed rounded-2xl ${isNaughtyMode ? 'border-slate-400' : 'border-slate-700'}`}>
          <List size={48} className={`mx-auto mb-4 ${isNaughtyMode ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`} />
          <h3 className={`text-lg font-bold mb-2 ${isNaughtyMode ? 'text-slate-950 dark:text-white' : 'text-white'}`}>Aucune playlist sauvegardée</h3>
          <p className={`text-sm mb-6 max-w-sm mx-auto ${isNaughtyMode ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>Génère une playlist et sauvegarde-la pour la retrouver ici.</p>
          <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
            Générer ma première playlist
          </button>
        </div>
      ) : (
        <>
          {/* --- À PLANIFIER (pas de date, ordre manuel par glisser-déposer, PAS paginée) --- */}
          <div className="space-y-4">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isNaughtyMode ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>À planifier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Zone vide "Générer une nouvelle playlist" (retour direct :
                  "le texte gris clair et le + sont illisibles") — même
                  schéma slate normalisé que le reste de cette vue. */}
              <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${isNaughtyMode ? 'border-slate-400 text-slate-800 hover:text-slate-950' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                <Plus size={28} />
                <span>Générer une nouvelle playlist</span>
              </button>
              {toPlan.map(p => renderCard(p, { draggableSection: true }))}
            </div>
          </div>

          {/* --- PLANIFIÉES (une date a été choisie, triées par date, paginée) --- */}
          {planned.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isNaughtyMode ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
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
              <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isNaughtyMode ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
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
