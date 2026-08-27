import { useState, useMemo } from 'react';
import { List, Library, Plus, Calendar, CheckCircle, ChevronLeft, ChevronRight, ListPlus, Search, SlidersHorizontal, ChevronDown, X, SearchX } from 'lucide-react';
import PlaylistCard from './PlaylistCard';
import RoutinesView from './RoutinesView';
import ViewHeader from '../shared/ViewHeader';
import TabPills from '../shared/TabPills';
import { useProfileSearchFilter } from '../../hooks/useProfileSearchFilter';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';

/**
 * PlaylistsView — vue "Mes Playlists".
 *
 * ⚠️ RENOMMÉE (20/08, retour direct suite à un retour terrain utilisateur :
 * "la notion de 'séance' parle aux utilisateurs qui font du sport
 * régulièrement mais beaucoup moins à ceux qui testent juste par
 * curiosité, ils se disent pas qu'il y a une playlist même si on fait bien
 * plus") — "Mes Séances" → "Mes Playlists", "Nouvelle séance" →
 * "Nouvelle Playlist" (Sidebar.jsx). Décision assumée réversible par
 * l'utilisateur. Referme donc la boucle : "Mes Playlists" est le nom
 * D'ORIGINE (avant le renommage du 25/07 ci-dessous vers "Mes Séances"),
 * auquel on revient sciemment après ce nouveau retour terrain — pas une
 * hésitation, un aller-retour informé par 2 signaux différents à 3
 * semaines d'écart. Tout le texte visible de CETTE vue a été réaligné en
 * conséquence (titre, sous-titre, états vides) ; l'onglet "Mes Routines"
 * (2e onglet de cette même vue) n'est PAS concerné par ce renommage.
 *
 * Récit du nom AVANT ce renommage (25/07, toujours utile pour comprendre
 * pourquoi certains fichiers non retouchés le 20/08 disent encore
 * "séance") : vue "Mes Séances" (nom restauré le 25/07 : elle s'était
 * appelée "Bibliothèque" un temps, mais c'est resté le seul endroit à le
 * dire — le reste de l'app, lui, n'avait jamais arrêté d'appeler cette
 * fonctionnalité "Mes Séances" partout ailleurs : info-bulles,
 * PlaylistHeader.jsx, StatsView.jsx, description de trophée dans
 * appConfig.js... Rétabli à l'époque pour que le titre de la page matche
 * enfin la Sidebar et le reste de l'app, plutôt que l'inverse).
 *
 * ⚠️ FUSION AVEC "Mes Routines" (20/08, retour direct — "prends du recul,
 * j'imagine la partie routines comme un onglet spécifique du menu séance ;
 * un peu comme quand on voit la vue d'un profil utilisateur où les 2 sont
 * présents dans la même page") — "Mes Routines" n'est plus une entrée de
 * Sidebar séparée : c'est maintenant le 2e onglet de CETTE vue, exactement
 * le même schéma que l'onglet Playlists/Routines déjà en place sur
 * `ProfileView.jsx` (visite du profil de QUELQU'UN D'AUTRE) — visiter SON
 * PROPRE espace suit désormais la même logique que visiter celui d'un
 * autre. `RoutinesView.jsx` a été réduit à son seul corps (grille) — plus
 * de `<ViewHeader/>` ni de wrapper propres, ce composant-CI les possède
 * pour les 2 onglets, en changeant titre/sous-titre/icône selon l'onglet
 * actif. `initialTab` : MÊME mécanisme exact que `SettingsView.jsx`
 * (`initialTab`/`handleOpenSettings`, App.jsx) — `null` par défaut (onglet
 * "Playlists", comportement historique de la Sidebar), posé à `'routine'`
 * juste avant `changeView('playlists')` par les 2 points d'entrée qui
 * naviguaient avant vers `changeView('routines')` (App.jsx : cloner une
 * routine publique, consulter sa PROPRE routine publique depuis son
 * profil) — voir `handleOpenPlaylists`, App.jsx, le nouveau point d'entrée
 * UNIQUE qui remplace ces 2 anciens appels directs à `changeView`.
 *
 * Fusionne ce qui était avant deux pages séparées ("Mes Playlists" et "Ma
 * File d'attente", voir passation) suite à un retour direct : une file
 * séparée n'apportait pas grand-chose de plus qu'un simple ordre + une date
 * optionnelle directement sur les cartes existantes. Fusionne aussi ce qui
 * était l'onglet "Historique" (HistoryView.jsx, retiré) : depuis que la
 * planification/les dates sont intégrées ici, cet écran couvre toute la
 * ligne de temps d'une séance (à venir → faite), un onglet séparé pour le
 * passé faisait doublon. 3 sections, dans cet ordre (onglet "Séances") :
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
  // NOUVEAU (20/08, fusion "Mes Routines") — transmises telles quelles au
  // corps RoutinesView.jsx (voir la docstring de ce fichier) quand l'onglet
  // actif est 'routine'. Mêmes props qu'App.jsx passait avant à
  // `<RoutinesView/>` directement, moins celles déjà partagées avec
  // l'onglet Séances (`theme`/`isNaughtyMode`/`getRankStyle`/
  // `renderConfigInfoLine`/`changeView`/`showToast`, déjà dans la liste
  // au-dessus).
  routines, setRoutines, routineBatchCounts, setRoutineBatchCounts,
  getDisplayRoutineIcon, getDisplayRoutineName, setEditingRoutine, executeGeneration, isGenerating,
  // `initialTab` — MÊME mécanisme que SettingsView.jsx (voir sa docstring
  // et celle de ce fichier) : `null` = onglet "Séances" par défaut.
  initialTab = null,
}) {
  const { cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, inputBg, inputBorder } = theme;
  const [draggedId, setDraggedId] = useState(null);
  const [plannedPage, setPlannedPage] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);
  // Barre de filtres pliable (retour direct, 27/08 : "le système de filtres
  // du compte vitrine devrait-il être adapté pour Mes Playlists ?" — même
  // constat que ProfileView.jsx : aucune recherche/filtre ici alors que
  // cette collection PERSONNELLE est potentiellement bien plus grosse que
  // ce qui est exposé publiquement) — même state/composant que
  // ProfileView.jsx pour un comportement identique.
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  // Ordre d'affichage de la section "Terminées" (retour direct, 27/08 :
  // "filtrer par statut... si utilisé, avoir en priorité celles utilisées
  // le plus") — 'recent' (comportement historique, inchangé par défaut :
  // triées par date de complétion la plus récente) ou 'most_played' (par
  // NOMBRE de fois jouée, decroissant — la même donnée que playlistRankMap
  // plus bas, déjà calculée pour la bordure or/argent/bronze des cartes,
  // mais jusqu'ici jamais utilisée pour l'ORDRE d'affichage lui-même).
  const [completedSortMode, setCompletedSortMode] = useState('recent');
  // Onglet actif — lazy init comme SettingsView.jsx : ce composant est
  // démonté/remonté à chaque changement de vue (pas de `key` ni de state
  // persistant, voir App.jsx), donc `initialTab` est systématiquement relu
  // à la valeur EXACTE que l'appelant vient de poser juste avant
  // `changeView('playlists')`, jamais une valeur périmée d'une visite
  // précédente.
  const [activeTab, setActiveTab] = useState(() => initialTab || 'playlist');

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
      // ⚠️ TEXTE RACCOURCI (10/08, retour direct — "le texte doit tenir sur
      // une seule ligne") : "est maintenant visible sur ton profil public"
      // → "est maintenant publique" — l'émoji 🌐 communique déjà "visible
      // publiquement", pas la peine de le redire en toutes lettres. Même
      // raccourci appliqué aux 2 AUTRES endroits qui affichent ce même
      // message (RoutinesView.jsx/PlaylistDetailContext.jsx — 3
      // implémentations indépendantes, voir la docstring de
      // handleTogglePlaylistPublic dans PlaylistDetailContext.jsx).
      showToast(updated.isPublic ? `🌐 "${updated.name}" est maintenant publique.` : `🔒 "${updated.name}" est de nouveau privée.`);
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
  const visiblePlaylists = useMemo(
    () => savedPlaylists.filter(p => !!p.isNaughty === !!isNaughtyMode),
    [savedPlaylists, isNaughtyMode]
  );

  // Recherche & filtres (retour direct, 27/08) — réutilise TEL QUEL le hook
  // déjà écrit/testé pour ProfileView.jsx, plutôt qu'une 2e implémentation
  // dupliquée. Ce hook attend un format "ligne" (`row.content.xxx`,
  // `row.kind`) pensé pour des lignes Supabase brutes — `savedPlaylists`,
  // ici, sont des objets LOCAUX À PLAT (`p.name` directement, pas
  // `p.content.name`). Enveloppés à la volée (`{ content: p, kind:
  // 'playlist' }`) plutôt que de généraliser le hook ou de dupliquer sa
  // logique : la forme la plus étroite, la moins risquée — `ProfileView.jsx`
  // n'est pas touché, ce hook continue de recevoir EXACTEMENT ce qu'il
  // recevait avant dans les deux fichiers qui l'utilisent maintenant.
  // `kind: 'playlist'` toujours — cette vue n'exerce jamais la branche
  // "routine" du hook (les routines ont leur propre onglet, RoutinesView.jsx,
  // pas touché ici).
  // ⚠️ Le filtre "Statut" du hook (statusFilter) n'est PAS exposé ici — ce
  // serait redondant : cette vue a déjà MIEUX qu'un simple "fait/pas fait"
  // (3 sections À planifier/Planifiées/Terminées, qui encodent aussi
  // l'aspect temporel). `statusFilter` reste à sa valeur par défaut ('all'),
  // jamais modifié depuis ce fichier — no-op silencieux, comportement du
  // hook inchangé pour cette vue.
  const searchableItems = useMemo(
    () => visiblePlaylists.map(p => ({ content: p, kind: 'playlist' })),
    [visiblePlaylists]
  );
  const {
    searchText, setSearchText,
    durationFilter, setDurationFilter,
    sportFilter, setSportFilter,
    genreFilter, setGenreFilter,
    availableSports, availableGenres,
    filteredItems: filteredWrappedItems, hasActiveFilters, resetFilters,
  } = useProfileSearchFilter(searchableItems);
  // Désenveloppé aussitôt — le reste de ce fichier continue de manipuler de
  // vrais objets playlist locaux, jamais la forme "ligne" du hook.
  const searchedPlaylists = useMemo(() => filteredWrappedItems.map(row => row.content), [filteredWrappedItems]);

  // ⚠️ OPTIMISATION (audit perf, 07/08 — même famille exacte que le
  // correctif déjà fait dans RoutinesView.jsx le 05/08, généralisé ici
  // après l'avoir cherché ailleurs dans l'app comme le veut l'habitude de
  // travail établie sur ce projet, voir CLAUDE-SANDBOX-VERIFICATION.md) :
  // les filtres/tris ci-dessous tournaient sur CHAQUE rendu de ce
  // composant (pas de `useMemo`) — y compris un rendu déclenché par
  // `draggedId`/`plannedPage`/`completedPage` (state local à ce même
  // composant, sans rapport avec le CONTENU de `savedPlaylists`).
  // ⚠️ Base de la répartition changée le 27/08 : `searchedPlaylists` (déjà
  // filtré par mode ET par recherche/sport/genre/durée) plutôt que
  // `visiblePlaylists` brut — chaque section ne montre plus que ce qui
  // correspond à la recherche en cours. `playlistRankMap`, LUI, reste
  // calculé sur `visiblePlaylists` EN ENTIER (pas `searchedPlaylists`) :
  // un badge or/argent/bronze est un classement PERMANENT parmi toutes tes
  // playlists de ce mode, il n'a aucune raison de changer/disparaître
  // parce qu'une recherche est en cours.
  const { toPlan, planned, completedPlaylists, playlistRankMap } = useMemo(() => {
    const toPlanList = searchedPlaylists.filter(p => !isCompleted(p) && !p.plannedDate);
    const plannedList = [...searchedPlaylists.filter(p => !isCompleted(p) && p.plannedDate)]
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    const completedList = [...searchedPlaylists.filter(isCompleted)].sort((a, b) => {
      // Tri par NOMBRE de fois jouée (retour direct, 27/08) — même donnée
      // que le classement plus bas (playlistRankMap), juste appliquée ici à
      // l'ORDRE d'affichage plutôt qu'à la seule bordure des cartes.
      if (completedSortMode === 'most_played') {
        return b.completions.length - a.completions.length;
      }
      const lastA = a.completions[a.completions.length - 1];
      const lastB = b.completions[b.completions.length - 1];
      return lastB.localeCompare(lastA);
    });
    // Classement par nombre d'utilisations, uniquement parmi celles ayant
    // déjà été faites au moins une fois — sert à la bordure or/argent/
    // bronze. Calculé sur `visiblePlaylists` (TOUT le mode, pas juste le
    // sous-ensemble recherché/affiché) — sinon le classement changerait
    // selon la page ET la recherche en cours.
    // `Map` id → rang (O(1) par carte) plutôt qu'un `playlistRanks
    // .indexOf(playlist.id)` recalculé DANS la boucle `.map()` de
    // `renderCard` (voir plus bas) — O(n) par carte, donc O(n²) au total
    // pour toute la grille, exactement le même piège déjà corrigé dans
    // RoutinesView.jsx (`routineRankMap`).
    const ranked = [...visiblePlaylists.filter(isCompleted)].sort((a, b) => b.completions.length - a.completions.length);
    const rankMap = new Map(ranked.map((p, i) => [p.id, i]));
    return { toPlan: toPlanList, planned: plannedList, completedPlaylists: completedList, playlistRankMap: rankMap };
  }, [searchedPlaylists, visiblePlaylists, completedSortMode]);

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
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-6`}>
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={activeTab === 'routine'
          ? <ListPlus className={textColorClass} size={VIEW_HEADER_ICON_SIZE} />
          : <Library className={textColorClass} size={VIEW_HEADER_ICON_SIZE} />}
        title={activeTab === 'routine' ? 'Mes Routines' : 'Mes Playlists'}
        subtitle={activeTab === 'routine'
          ? 'Génère instantanément des séances à partir de tes configurations.'
          : 'Retrouve tes playlists générées, planifie tes écoutes et consulte ton historique.'}
      />

      {/* Onglets Playlists/Routines (20/08, fusion — voir la docstring de
          ce fichier) — MÊME markup exact que l'onglet Playlists/Routines de
          ProfileView.jsx (visite du profil de quelqu'un d'autre), pour que
          visiter SON PROPRE espace se comporte pareil visuellement.
          ⚠️ Libellé "Séances" → "Playlists" le même jour (voir le
          renommage "Mes Séances" → "Mes Playlists" dans Sidebar.jsx pour
          le raisonnement complet) — l'onglet "Routines" lui-même reste
          "Routines", pas concerné par ce renommage.
          Standardisé sur TabPills.jsx (21/08, retour direct) — même
          composant partagé désormais avec ProfileView.jsx/DiscoverView.jsx/
          SettingsView.jsx/TrophiesView.jsx. */}
      <TabPills
        theme={theme}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'playlist', label: <>Playlists <span className="opacity-70">({visiblePlaylists.length})</span></> },
          { value: 'routine', label: <>Routines <span className="opacity-70">({routines.length})</span></> },
        ]}
      />

      {/* Notice "mode invité" RETIRÉE D'ICI (25/07) — vivait en double ici et
          dans StatsView.jsx, avec deux conditions de déclenchement légèrement
          différentes, et absente de RoutinesView.jsx alors que la même
          logique s'y appliquait tout autant (bug remonté par capture :
          "pourquoi ce message n'apparaît QUE sur certaines pages ?"). Un seul
          bloc centralisé désormais, dans Sidebar.jsx (persistante sur toutes
          les vues) — voir son commentaire pour le raisonnement complet. */}

      {/* Recherche & filtres (retour direct, 27/08) — MÊME markup que
          ProfileView.jsx (barre de recherche toujours visible, filtres
          sport/genre/durée repliables derrière un bouton) : cohérence
          visuelle avec l'endroit d'où l'idée est partie. Affichée
          UNIQUEMENT sur l'onglet Playlists (`activeTab === 'playlist'`,
          jamais pour l'onglet Routines) ET seulement s'il y a au moins une
          playlist à filtrer — pas la peine de montrer une barre de
          recherche vide sur une collection vide (voir `isEmpty`, qui régit
          l'état vide juste en dessous). */}
      {activeTab === 'playlist' && !isEmpty && (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${inputBorder} ${inputBg}`}>
            <Search size={18} className={textMuted} />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Rechercher un titre, un sport, un style..."
              className={`flex-1 bg-transparent outline-hidden text-sm ${textHighlight}`}
            />
            <button
              onClick={() => setFiltersExpanded(v => !v)}
              className={`flex items-center gap-1 text-xs font-bold shrink-0 ${filtersExpanded ? textColorClass : textMuted} hover:text-main transition-colors`}
              title={filtersExpanded ? "Masquer les filtres" : "Plus de filtres"}
            >
              <SlidersHorizontal size={15} />
              <ChevronDown size={14} className={`transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {filtersExpanded && (
            <div className="flex flex-wrap items-center gap-2">
              {availableSports.length > 0 && (
                <select
                  value={sportFilter}
                  onChange={(e) => setSportFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cardBorder} ${inputBg} ${textMuted} outline-hidden cursor-pointer`}
                >
                  <option value="all">Tous les sports</option>
                  {availableSports.map(sport => <option key={sport} value={sport}>{sport}</option>)}
                </select>
              )}

              {availableGenres.length > 0 && (
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cardBorder} ${inputBg} ${textMuted} outline-hidden cursor-pointer`}
                >
                  <option value="all">Tous les genres</option>
                  {availableGenres.map(genre => <option key={genre} value={genre}>{genre}</option>)}
                </select>
              )}

              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cardBorder} ${inputBg} ${textMuted} outline-hidden cursor-pointer`}
              >
                <option value="all">Toutes durées</option>
                <option value="short">Moins de 30 min</option>
                <option value="medium">30-60 min</option>
                <option value="long">Plus de 60 min</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${textMuted} hover:text-red-500 transition-colors`}
                >
                  <X size={13} /> Réinitialiser
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'routine' ? (
        <RoutinesView
          theme={theme} isNaughtyMode={isNaughtyMode} routines={routines} setRoutines={setRoutines}
          routineBatchCounts={routineBatchCounts} setRoutineBatchCounts={setRoutineBatchCounts}
          getDisplayRoutineIcon={getDisplayRoutineIcon} getDisplayRoutineName={getDisplayRoutineName}
          renderConfigInfoLine={renderConfigInfoLine} getRankStyle={getRankStyle}
          setEditingRoutine={setEditingRoutine}
          executeGeneration={executeGeneration} isGenerating={isGenerating} changeView={changeView}
          showToast={showToast}
        />
      ) : (
        <div className="space-y-10">
          {isEmpty ? (
            <div className={`py-16 text-center border-2 border-dashed rounded-2xl ${isNaughtyMode ? 'border-slate-400' : 'border-slate-700'}`}>
              <List size={48} className={`mx-auto mb-4 ${textMuted}`} />
              <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune playlist sauvegardée</h3>
              <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère une playlist et sauvegarde-la pour la retrouver ici.</p>
              <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                Générer ma première playlist
              </button>
            </div>
          ) : searchedPlaylists.length === 0 ? (
            // État vide DISTINCT de "aucune playlist sauvegardée" (isEmpty
            // ci-dessus) — retour direct, 27/08, même principe que
            // ProfileView.jsx : la collection n'est pas vide, c'est la
            // recherche/les filtres actuels qui ne matchent rien.
            <div className="py-16 text-center">
              <SearchX size={40} className={`mx-auto mb-3 ${textMuted}`} />
              <p className={`text-sm mb-3 ${textMuted}`}>Aucune playlist ne correspond à ta recherche.</p>
              <button onClick={resetFilters} className={`text-xs font-bold ${textColorClass} hover:underline`}>
                Réinitialiser les filtres
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
                      schéma slate normalisé que le reste de cette vue.
                      ⚠️ Texte "séance" → "playlist" (20/08, RE-renommage
                      global suite à un retour terrain — voir la docstring
                      "Nouvelle Playlist"/"Mes Playlists" dans Sidebar.jsx) :
                      ce texte avait brièvement dit "Créer une nouvelle
                      séance" plus tôt le même jour, revenu à "playlist"
                      quelques heures plus tard pour matcher le nouveau
                      titre de page ("Mes Playlists") et le bouton Sidebar
                      ("Nouvelle Playlist"). */}
                  {/* Ménage "Centraliser les règles de couleur" (29/07) —
                      ternaire `isNaughtyMode` retiré, remplacé par les tokens
                      déjà adaptatifs de useTheme.js (voir RoutinesView.jsx pour
                      le détail identique). */}
                  <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${cardBorder} ${textMuted} hover:text-main`}>
                    <Plus size={28} />
                    <span>Créer une nouvelle playlist</span>
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${textMuted}`}>
                      <CheckCircle size={14} /> Terminées
                    </h2>
                    {/* Ordre d'affichage (retour direct, 27/08) — voir la
                        docstring de `completedSortMode` plus haut pour le
                        raisonnement complet. Remis à la page 1 au
                        changement : la page actuelle n'a plus forcément de
                        sens dans le nouvel ordre. */}
                    <select
                      value={completedSortMode}
                      onChange={(e) => { setCompletedSortMode(e.target.value); setCompletedPage(0); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cardBorder} ${textMuted} outline-hidden cursor-pointer bg-transparent`}
                    >
                      <option value="recent">Plus récentes</option>
                      <option value="most_played">Plus jouées</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {completedPageItems.map(p => renderCard(p))}
                  </div>
                  {renderPager(completedSafePage, completedTotalPages, setCompletedPage)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
