import { useState, useMemo } from 'react';
import { List, Library, Plus, Calendar, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import PlaylistCard from './PlaylistCard';
import ViewHeader from '../shared/ViewHeader';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';

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
  removeImportedData,
  showToast,
  // `username` (07/08, retour direct : "afficher aussi votre pseudo en
  // chapeau" — sur VOS PROPRES playlists, pour la cohérence visuelle avec
  // PlaylistHeader.jsx/TemplateCard.jsx, où pseudo+compteur de clonages
  // vivent désormais au-dessus du titre) — transmis tel quel à
  // PlaylistCard.jsx, seul consommateur réel ici.
  username,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;
  const [draggedId, setDraggedId] = useState(null);
  const [plannedPage, setPlannedPage] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);

  const isCompleted = (p) => p.completions && p.completions.length > 0;

  // Bascule publique/privée INDIVIDUELLE (Feature Sociale — Refonte
  // Structurale Round 2/2, 01/08) — MÊME principe exact que
  // `handleTogglePlaylistPublic` de PlaylistDetailContext.jsx (celui-là
  // agit sur `currentPlaylist`, celui-ci sur n'importe quelle carte de
  // cette liste par id) : `useSyncedCollection.js` détecte le changement
  // au prochain rendu et pousse la mise à jour vers Supabase tout seul,
  // rien de plus à faire ici.
  // ⚠️ SIMPLIFIÉ (03/08, refonte lignée serveur) — voir la docstring de
  // `handleTogglePlaylistPublic` (PlaylistDetailContext.jsx) pour le
  // raisonnement complet : le crédit de republication vers l'origine
  // était du code mort (déjà bloqué par le `clone_ledger`, systématiquement
  // réclamé au moment du clonage lui-même) — retiré, plus rien à dupliquer
  // entre les 2 implémentations.
  const handleTogglePlaylistPublic = (id) => {
    setSavedPlaylists(savedPlaylists.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, isPublic: !p.isPublic };
      // Confirmation (05/08, retour direct — voir la docstring identique
      // dans PlaylistDetailContext.jsx pour le raisonnement complet, même
      // formulation/variant ici pour rester cohérent partout). Calculée
      // DANS le `.map()` (accès direct à `p`/`updated`) plutôt qu'après,
      // sur un `find()` séparé sur `savedPlaylists` déjà obsolète à ce
      // stade (state pas encore réellement mis à jour tant que ce
      // `setSavedPlaylists` n'a pas été appliqué).
      showToast(updated.isPublic ? `🌐 "${updated.name}" est maintenant visible sur ton profil public.` : `🔒 "${updated.name}" est de nouveau privée.`);
      return updated;
    }));
  };

  // Pare-feu Mode Intime (retour direct : "les vues Mes Séances et Découvrir
  // mélangent les contenus des deux modes") — TOUT le reste de ce composant
  // travaille sur `visiblePlaylists`, jamais directement sur `savedPlaylists`
  // (qui contient les deux modes mélangés) : `!!p.isNaughty` normalise
  // undefined/false en booléen propre avant comparaison (playlists
  // anciennes sans ce champ), même garde-fou déjà en place dans
  // StatsView.jsx pour le même filtre.
  //
  // ⚠️ OPTIMISATION (audit perf, 07/08 — même famille exacte que le
  // correctif déjà fait dans RoutinesView.jsx le 05/08, généralisé ici
  // après l'avoir cherché ailleurs dans l'app comme le veut l'habitude de
  // travail établie sur ce projet, voir CLAUDE-SANDBOX-VERIFICATION.md) :
  // les filtres/tris ci-dessous tournaient sur CHAQUE rendu de ce
  // composant (pas de `useMemo`) — y compris un rendu déclenché par
  // `draggedId`/`plannedPage`/`completedPage` (state local à ce même
  // composant, sans rapport avec le CONTENU de `savedPlaylists`).
  // Memoïsé sur `[savedPlaylists, isNaughtyMode]` : ne se recalcule plus
  // que quand la liste ou le mode changent vraiment.
  const { visiblePlaylists, toPlan, planned, completedPlaylists, playlistRankMap } = useMemo(() => {
    const visible = savedPlaylists.filter(p => !!p.isNaughty === !!isNaughtyMode);
    const toPlanList = visible.filter(p => !isCompleted(p) && !p.plannedDate);
    const plannedList = [...visible.filter(p => !isCompleted(p) && p.plannedDate)]
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    const completedList = [...visible.filter(isCompleted)].sort((a, b) => {
      const lastA = a.completions[a.completions.length - 1];
      const lastB = b.completions[b.completions.length - 1];
      return lastB.localeCompare(lastA);
    });
    // Classement par nombre d'utilisations, uniquement parmi celles ayant
    // déjà été faites au moins une fois — sert à la bordure or/argent/
    // bronze. Calculé sur la liste COMPLÈTE (pas juste la page affichée),
    // sinon le classement changerait selon la page consultée.
    // `Map` id → rang (O(1) par carte) plutôt qu'un `playlistRanks
    // .indexOf(playlist.id)` recalculé DANS la boucle `.map()` de
    // `renderCard` (voir plus bas) — O(n) par carte, donc O(n²) au total
    // pour toute la grille, exactement le même piège déjà corrigé dans
    // RoutinesView.jsx (`routineRankMap`).
    const ranked = [...completedList].sort((a, b) => b.completions.length - a.completions.length);
    const rankMap = new Map(ranked.map((p, i) => [p.id, i]));
    return { visiblePlaylists: visible, toPlan: toPlanList, planned: plannedList, completedPlaylists: completedList, playlistRankMap: rankMap };
  }, [savedPlaylists, isNaughtyMode]);

  const { pageItems: plannedPageItems, totalPages: plannedTotalPages, safePage: plannedSafePage } = usePageSlice(planned, plannedPage);
  const { pageItems: completedPageItems, totalPages: completedTotalPages, safePage: completedSafePage } = usePageSlice(completedPlaylists, completedPage);

  // Réordonne UNIQUEMENT le sous-ensemble "À planifier" au sein de
  // `savedPlaylists`, en conservant la position relative de tout le reste
  // (playlists datées ou terminées) — même principe que le glisser-déposer
  // des titres dans une playlist (voir handleTrackDragEnter dans App.jsx).
  // Réordonne UNIQUEMENT le sous-ensemble "À planifier" au sein de
  // `savedPlaylists`, en conservant la position relative de tout le reste
  // (playlists datées ou terminées) — même principe que le glisser-déposer
  // des titres dans une playlist (voir handleTrackDragEnter dans App.jsx).
  //
  // BUG CORRIGÉ (01/08, remonté par un échec de build réel — voir logs
  // Vercel, tests/PlaylistsView.test.jsx) — `cursor++` vivait DANS le
  // comparateur passé à `.find()` (`prev.find(pp => pp.id ===
  // reordered[cursor++])`) : `.find()` appelle ce comparateur une fois
  // par élément qu'il TESTE en interne, pas une fois par itération
  // EXTERNE de `.map()` — `cursor` avançait donc bien plus vite que prévu
  // (jusqu'à 3 incréments pour une seule itération de `.map()` sur ce
  // tableau de 3 éléments), lisant `reordered[cursor]` hors limites
  // (`undefined`) dès la 3e comparaison. Résultat concret en production :
  // glisser-déposer une playlist dans "À planifier" remplaçait
  // SILENCIEUSEMENT des playlists par `undefined` dans `savedPlaylists` —
  // une vraie perte de données, pas juste un affichage cassé. Corrigé en
  // séparant complètement les deux opérations : une `Map` construite UNE
  // FOIS (recherche par id en O(1), aucun `.find()` répété) et `cursor`
  // incrémenté par une INSTRUCTION à part, hors de tout comparateur —
  // impossible qu'il avance plus vite que voulu désormais.
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
      const byId = new Map(prev.map(p => [p.id, p]));
      let cursor = 0;
      return prev.map(p => {
        if (!inSection(p)) return p;
        const nextId = reordered[cursor];
        cursor += 1;
        return byId.get(nextId);
      });
    });
  };

  const renderCard = (playlist, { draggableSection } = {}) => {
    const rank = playlistRankMap.get(playlist.id);
    const rankStyle = getRankStyle(rank);
    return (
      <PlaylistCard
        key={playlist.id}
        theme={theme} isNaughtyMode={isNaughtyMode} playlist={playlist} rankStyle={rankStyle} rank={rank}
        username={username}
        onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}
        onDelete={requestRemoveSavedPlaylist}
        onTogglePublic={handleTogglePlaylistPublic}
        renderConfigInfoLine={renderConfigInfoLine}
        editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
        editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
        triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
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
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-10`}>
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<Library className={textColorClass} size={VIEW_HEADER_ICON_SIZE} />}
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
          <List size={48} className={`mx-auto mb-4 ${textMuted}`} />
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
              {/* Zone vide "Générer une nouvelle playlist" (retour direct :
                  "le texte gris clair et le + sont illisibles") — même
                  schéma slate normalisé que le reste de cette vue. */}
              {/* Ménage "Centraliser les règles de couleur" (29/07) —
                  ternaire `isNaughtyMode` retiré, remplacé par les tokens
                  déjà adaptatifs de useTheme.js (voir RoutinesView.jsx pour
                  le détail identique). */}
              <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${cardBorder} ${textMuted} hover:text-main`}>
                <Plus size={28} />
                <span>Générer une nouvelle playlist</span>
              </button>
              {toPlan.map(p => renderCard(p, { draggableSection: true }))}
            </div>
          </div>

          {/* --- PLANIFIÉES (une date a été choisie, triées par date, paginée) --- */}
          {planned.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${textMuted}`}>
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
              <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${textMuted}`}>
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
