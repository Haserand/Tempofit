import { createContext, useContext, useState, useMemo } from 'react';
import { getZoneForValue, ATHLETIC_ZONES, getBpmBucketColor, getBpmBucketLabel, MAX_DESCRIPTION_LENGTH } from '../appConfig';
import { normalizeGenreForDisplay, genreDisplayLabel } from '../musicCatalog';
import { getSingleMatchingTrack, findSameArtistReplacement, recalculateTimeline } from '../engine/musicEngine';
import { useGeneratorContext } from './GeneratorContext';
import { useAudioPlayer } from './AudioPlayerContext';
import { supabase } from '../supabaseClient';

/**
 * PlaylistDetailContext.jsx — chantier "God Component", phase 1/2 pour
 * `PlaylistDetailView.jsx` (1656 lignes, 78 props — le plus gros morceau
 * restant après GeneratorView/MiniPlayerBar/CustomActivityModal).
 *
 * DIFFÉRENCE MAJEURE avec GeneratorContext/AudioPlayerContext : cette fois,
 * il n'existait AUCUN hook déjà extrait à simplement envelopper — toute cette
 * logique (édition du nom, drag-and-drop liste ET graphique, menu par titre,
 * remplacement/duplication/suppression, calculs de graphique BPM,
 * distributions BPM/genre) vivait directement, en dizaines de `useState`/
 * fonctions, dans `AppContent` (App.jsx). Ce fichier la rapatrie fidèlement.
 *
 * PORTÉE — vérifiée ligne par ligne dans App.jsx avant d'écrire quoi que ce
 * soit (chaque nom cherché individuellement pour voir s'il sert à un autre
 * appel JSX qu'à celui de PlaylistDetailView) :
 *
 * RÉELLEMENT DÉPLACÉ ICI (exclusif à cette vue, vérifié) : édition du nom,
 * sauvegarde/retrait de "Mes Séances" DEPUIS la vue détail, drag-and-drop
 * (liste ET graphique — `moveTrackTo` sert aux deux, jamais dupliqué),
 * dupliquer/remplacer/remplacer-même-artiste/retirer un titre, menu par
 * titre, tout le calcul du graphique BPM (données unifiées, segments,
 * domaines/graduations d'axes, drag sur la courbe) et des 2 camemberts de
 * distribution (BPM pondéré par zone, style musical).
 *
 * REÇU EN PROPS DU PROVIDER, JAMAIS RECRÉÉ (dépendances génuinement
 * partagées avec d'autres vues ou d'autres instances uniques ailleurs dans
 * l'app — vérifié un par un, pas supposé) :
 * - `currentPlaylist`/`setCurrentPlaylist`/`savedPlaylists` : partagés avec
 *   MiniPlayerBar, PlaylistsView, Sidebar.
 * - `favorites`/`spotifyTrackPool`/`userStats`/`checkTrophies` : instances
 *   uniques ailleurs dans App.jsx (useFavorites/useSpotifyImport/useUserStats).
 * - `requestRemoveSavedPlaylist` : PARTAGÉE avec PlaylistsView (bouton
 *   poubelle d'une carte) — `handleUnsavePlaylist` ici n'est qu'un fin
 *   wrapper autour, pas une réimplémentation.
 * - `currentActualData`/`selectedMetric`/`setSelectedMetric`/`dataOffset`/
 *   `setDataOffset`/`selectedAnalysisDate`/`setSelectedAnalysisDate`/
 *   `availableMetrics` : viennent de `useSessionAnalysis(currentPlaylist)`,
 *   appelé UNE SEULE FOIS dans AppContent — PAS ré-appelable ici même s'il
 *   *a l'air* d'un hook isolable comme useGeneratorForm : une partie de son
 *   retour (`csvUploadTargetDate`, pas repris ici) est utilisée par l'import
 *   CSV Garmin/Strava, lui-même déclenchable depuis `renderCompletionsList`
 *   — PARTAGÉE avec PlaylistsView. Une 2e instance du hook créerait un
 *   `csvUploadTargetDate` fantôme, jamais celui réellement lu à l'upload.
 * - `showToast` : instance unique (composant racine `App`, voir
 *   AudioPlayerContext.jsx pour le même raisonnement).
 *
 * DÉJÀ DISPONIBLE SANS RIEN RECEVOIR EN PROP (PlaylistDetailProvider est
 * monté à l'intérieur de <GeneratorProvider>/<AudioPlayerProvider>, qui
 * enveloppent déjà tout AppContent — voir App.jsx) :
 * - `isNaughtyMode`, `getProfileForWorkout` : lus directement via
 *   `useGeneratorContext()` ci-dessous, plutôt que reçus en prop en double.
 * - `togglePreview`/`playingPreviewId`/`resolveAndPlay`/`resolvingTrackId` :
 *   lus directement via `useAudioPlayer()`.
 *
 * VOLONTAIREMENT LAISSÉ EN DEHORS de ce contexte (reste prop classique de
 * PlaylistDetailView, inchangé) : `summaryImageStatus`/`summaryImageFile`/
 * `summaryImagePreviewUrl`/`includeSummaryImage` (partagés avec ShareModal,
 * un modal global) ; `handleShare`/`setPlaylistPlannedDate`/
 * `renderCompletionsList`/`renderTopCompletionDate`/`getRankStyle`/
 * `triggerCSVUpload` (tous partagés avec PlaylistsView/TrophiesView) ;
 * `setIsBpmSearchMode`/`setIsSearchModalOpen` (infra de recherche globale).
 * Faire vivre ces derniers dans ce contexte n'aurait rien simplifié : leur
 * source de vérité doit de toute façon rester dans AppContent pour les
 * autres vues qui les consomment.
 *
 * Phase 2 (pas ici) : brancher un <PlaylistDetailProvider> directement dans
 * PlaylistDetailView.jsx (pas dans App.jsx globalement — cette vue n'existe
 * que pour une "route" précise) et faire consommer usePlaylistDetail() par
 * le composant, en lui retirant les ~50 props désormais couvertes ici.
 */

const PlaylistDetailContext = createContext(null);

export function PlaylistDetailProvider({
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  favorites, spotifyTrackPool, userStats, checkTrophies,
  showToast, requestRemoveSavedPlaylist, handleSavePlaylist, handleClonePlaylist,
  currentActualData, selectedMetric, setSelectedMetric,
  dataOffset, setDataOffset,
  selectedAnalysisDate, setSelectedAnalysisDate, availableMetrics,
  username,
  children,
}) {
  const { isNaughtyMode, getProfileForWorkout } = useGeneratorContext();
  const { togglePreview, playingPreviewId, resolveAndPlay, resolvingTrackId } = useAudioPlayer();

  // Petit utilitaire interne : la quasi-totalité des mutations de titres
  // suivent le même triptyque (recalculer la timeline, écrire dans
  // currentPlaylist ET dans sa copie persistée savedPlaylists) — factorisé
  // ici plutôt que répété tel quel dans 6 fonctions différentes comme
  // c'était le cas dans App.jsx.
  const applyPlaylistUpdate = (updatedTracks) => {
    let updatedPlaylist = recalculateTimeline({ ...currentPlaylist, tracks: updatedTracks });
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    return updatedPlaylist;
  };

  // --- Édition du nom de la playlist ---
  // Édition combinée titre + description (08/08, retour direct : "que
  // modifier le titre ou la description vienne un seul crayon plutôt que
  // via chacune une option individuelle" — précédent Spotify cité,
  // "Modifier les détails", mais gardé INLINE ici plutôt qu'une modale,
  // sur confirmation explicite). Fusionne `isEditingPlaylistName`/
  // `isEditingPlaylistDescription` (2 booléens séparés) en UN SEUL état,
  // et `handleRenamePlaylist`/`handleEditPlaylistDescription` en UN SEUL
  // handler de sauvegarde.
  // ⚠️ Piège identifié AVANT d'implémenter (pas après coup) : les 2
  // anciens handlers lisent chacun `currentPlaylist` depuis la MÊME
  // fermeture de rendu — les appeler l'un après l'autre (au lieu de les
  // fusionner) aurait fait perdre le 1er changement : le 2e handler aurait
  // construit son `updatedPlaylist` à partir de l'ancien `currentPlaylist`
  // (React ne reflète un `setState` qu'au rendu SUIVANT), écrasant
  // silencieusement la modification du 1er. Un seul `updatedPlaylist`,
  // les deux champs ensemble, un seul `setCurrentPlaylist`/
  // `setSavedPlaylists` : plus de risque de ce genre.
  const [isEditingPlaylistDetails, setIsEditingPlaylistDetails] = useState(false);
  const [editedPlaylistName, setEditedPlaylistName] = useState('');
  const [editedPlaylistDescription, setEditedPlaylistDescription] = useState('');

  // Nom JAMAIS vide (une playlist sans nom n'aurait aucun sens — même
  // garde que l'ancien `handleRenamePlaylist`), mais contrairement à
  // l'ancienne version, un nom vidé PAR MÉGARDE en éditant la
  // description en même temps ne fait plus avorter TOUTE la sauvegarde
  // (silencieusement, sans rien enregistrer) — repli sur l'ancien nom
  // (`|| currentPlaylist.name`) plutôt qu'un `return` précoce qui aurait
  // aussi perdu la description tapée à côté. Description VIDE, elle,
  // reste un état valide (on peut vouloir l'effacer) — pas de repli
  // équivalent pour ce champ.
  const handleSavePlaylistDetails = () => {
    if (!currentPlaylist) { setIsEditingPlaylistDetails(false); return; }
    const trimmedName = editedPlaylistName.trim();
    const trimmedDescription = editedPlaylistDescription.trim().slice(0, MAX_DESCRIPTION_LENGTH);
    const updatedPlaylist = {
      ...currentPlaylist,
      name: trimmedName || currentPlaylist.name,
      description: trimmedDescription,
      // "Clone" vs "Enfant" (02/08, discussion produit) — voir la
      // docstring historique de l'ancien `handleRenamePlaylist` pour le
      // raisonnement complet, inchangé : un booléen posé UNE SEULE FOIS,
      // peu importe LEQUEL des deux champs a réellement changé.
      ...(currentPlaylist.parentUserId && !currentPlaylist.isModifiedSinceClone ? { isModifiedSinceClone: true } : {}),
    };
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    setIsEditingPlaylistDetails(false);
  };

  // Bascule individuelle publique/privée (Feature Sociale — Refonte
  // Structurale Round 2/2, 01/08) — MÊME schéma exact que
  // `handleRenamePlaylist` juste au-dessus (pas de recalcul de timeline
  // nécessaire, contrairement à `applyPlaylistUpdate` utilisée pour les
  // mutations de titres). Prime sur `default_playlist_public`
  // (SettingsView.jsx, valeur de DÉPART uniquement) : cette fonction change
  // `isPublic` sur CETTE playlist précise, à tout moment, indépendamment de
  // ce réglage global. `useSyncedCollection.js` détecte le changement au
  // prochain `setSavedPlaylists` (diff par id) et pousse la mise à jour
  // vers la colonne `is_public` de la table `playlists` automatiquement —
  // rien de plus à faire ici côté synchro.
  // ⚠️ SIMPLIFIÉ (03/08, refonte lignée serveur, voir supabase-schema.sql)
  // — cette fonction appelait auparavant `increment_playlist_clone_count`/
  // `increment_template_clone_count` pour créditer l'origine à la
  // republication (`willClaimOriginCredit`/`originCreditClaimed`). Retiré :
  // à la relecture, ce mécanisme s'est révélé être du CODE MORT dans tous
  // les cas réels — le clonage crédite déjà l'origine INCONDITIONNELLEMENT
  // (que la copie reste privée ou non), donc la clé du `clone_ledger` pour
  // cette cible est TOUJOURS déjà prise par le temps où une republication
  // ultérieure tenterait le même appel (bloquée par construction, jamais
  // un vrai 2e crédit). Voir supabase-schema.sql pour le détail complet.
  const handleTogglePlaylistPublic = () => {
    if (!currentPlaylist) return;
    const updatedPlaylist = { ...currentPlaylist, isPublic: !currentPlaylist.isPublic };
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    // Confirmation (05/08, retour direct : "j'aimerais un message de
    // confirmation d'action quand je mets/retire quelque chose en public,
    // [...] à généraliser dans toute l'app") — même modèle que le toast de
    // déplacement de titre (`"${...}" déplacé dans la playlist.`, plus
    // haut dans ce fichier) : variant par défaut (3s, icône check), pas
    // 'ambiance'/'special' (réservés à une mise en avant/un déblocage de
    // trophée, pas une simple confirmation d'action réversible). Généralisé
    // aux 2 AUTRES endroits où une bascule publique/privée existe
    // (PlaylistsView.jsx pour les cartes de "Mes Séances", RoutinesView.jsx
    // pour les routines) — 3 implémentations indépendantes de la bascule
    // elle-même (voir leurs docstrings respectives), donc 3 endroits à
    // toucher pour ce même changement, pas un seul point central.
    showToast(updatedPlaylist.isPublic ? `🌐 "${updatedPlaylist.name}" est maintenant visible sur ton profil public.` : `🔒 "${updatedPlaylist.name}" est de nouveau privée.`);
  };

  // --- Description libre (Vague 2, Chantier 3 — "description texte libre
  // sur une playlist publique", 02/08). Fusionnée avec l'édition du nom le
  // 08/08 (voir `handleSavePlaylistDetails`/`isEditingPlaylistDetails`
  // juste au-dessus) — plus d'état ni de handler séparés ici.

  // handleSavePlaylist reçue en prop (voir signature du Provider) : sa
  // définition RESTE dans App.jsx, pas ici — contrairement à ce qui était
  // supposé au départ, elle n'est PAS exclusive à cette vue.
  // `resolvePendingNavigation` (le garde-fou "changements non sauvegardés" à
  // la navigation, App.jsx) l'appelle aussi, hors de tout contexte lié à
  // cette page — une 2e implémentation ici aurait désynchronisé les deux.

  // Fin wrapper autour de `requestRemoveSavedPlaylist` (reçue en prop, voir
  // docstring plus haut) : pas de logique de confirmation dupliquée ici, elle
  // vit à un seul endroit (App.jsx), partagée avec la poubelle de PlaylistsView.
  const handleUnsavePlaylist = () => {
    if (currentPlaylist) requestRemoveSavedPlaylist(currentPlaylist.id);
  };

  // --- Retirer / dupliquer / remplacer un titre ---
  const handleRemoveTrack = (indexToRemove) => {
    if (!currentPlaylist) return;
    const newTracks = [...currentPlaylist.tracks];
    newTracks.splice(indexToRemove, 1);
    applyPlaylistUpdate(newTracks);
  };

  const handleDuplicateTrack = (index) => {
    if (!currentPlaylist) return;
    const newTracks = [...currentPlaylist.tracks];
    const duplicated = { ...newTracks[index], id: `track-dup-${Date.now()}-${Math.random().toString(36).slice(2, 11)}` };
    newTracks.splice(index + 1, 0, duplicated);
    applyPlaylistUpdate(newTracks);
    showToast('🎵 Titre dupliqué !');
  };

  const handleReplaceTrack = async (indexToReplace) => {
    if (!currentPlaylist) return;
    checkTrophies({ ...userStats, replacedTracks: userStats.replacedTracks + 1 });

    const oldTrack = currentPlaylist.tracks[indexToReplace];
    const usedIds = currentPlaylist.tracks.map(t => t.trackId);

    const newRawTrack = await getSingleMatchingTrack(
      oldTrack.targetSegmentBpm, currentPlaylist.tolerance || 10,
      currentPlaylist.config?.selectedGenres || ['Métal'], usedIds, favorites, spotifyTrackPool,
      null, [], currentPlaylist.config?.allowLongTracks || false,
    );

    const newTracks = [...currentPlaylist.tracks];
    newTracks[indexToReplace] = {
      ...newTracks[indexToReplace], title: newRawTrack.title, artist: newRawTrack.artist,
      genre: newRawTrack.genre, bpm: newRawTrack.bpm, duration: newRawTrack.duration,
      trackId: newRawTrack.trackId, id: `track-replaced-${Date.now()}`,
      preview: newRawTrack.preview || null,
      _genreMismatch: newRawTrack._genreMismatch || false,
      _isFallback: newRawTrack._isFallback || false,
    };
    applyPlaylistUpdate(newTracks);
    showToast('🎵 Titre remplacé et durée ajustée !');
  };

  const handleReplaceTrackSameArtist = async (indexToReplace) => {
    if (!currentPlaylist) return;
    const oldTrack = currentPlaylist.tracks[indexToReplace];
    const usedIds = currentPlaylist.tracks.map(t => t.trackId);
    const minBpm = oldTrack.targetSegmentBpm - (currentPlaylist.tolerance || 10);
    const maxBpm = oldTrack.targetSegmentBpm + (currentPlaylist.tolerance || 10);
    const requestedGenres = currentPlaylist.config?.selectedGenres || ['Métal'];
    const allowLong = currentPlaylist.config?.allowLongTracks || false;

    let newRawTrack = await findSameArtistReplacement(oldTrack.artist, minBpm, maxBpm, usedIds, requestedGenres, allowLong);

    if (!newRawTrack) {
      newRawTrack = await getSingleMatchingTrack(oldTrack.targetSegmentBpm, currentPlaylist.tolerance || 10, requestedGenres, usedIds, favorites, spotifyTrackPool, null, [], allowLong);
      showToast(`Aucun autre titre de ${oldTrack.artist} à ce BPM — recherche élargie utilisée.`);
    } else {
      checkTrophies({ ...userStats, replacedTracks: userStats.replacedTracks + 1 });
      showToast(`🎵 Remplacé par un autre titre de ${newRawTrack.artist} !`);
    }

    const newTracks = [...currentPlaylist.tracks];
    newTracks[indexToReplace] = {
      ...newTracks[indexToReplace], title: newRawTrack.title, artist: newRawTrack.artist,
      genre: newRawTrack.genre, bpm: newRawTrack.bpm, duration: newRawTrack.duration,
      trackId: newRawTrack.trackId, id: `track-replaced-${Date.now()}`,
      preview: newRawTrack.preview || null,
      _genreMismatch: newRawTrack._genreMismatch || false,
      _isFallback: newRawTrack._isFallback || false,
    };
    applyPlaylistUpdate(newTracks);
  };

  // --- Menu d'options par titre (Dupliquer / Remplacer / Remplacer même artiste) ---
  const [openTrackMenuIndex, setOpenTrackMenuIndex] = useState(null);

  // --- Glisser-déposer pour réordonner les titres, réutilisé tel quel par le
  // glisser-déposer directement sur le graphique (voir handleChartMouseMove
  // plus bas) — un seul mécanisme de réordonnancement, jamais 2 implémentations. ---
  const [draggedTrackIndex, setDraggedTrackIndex] = useState(null);
  // Capturés à `handleTrackDragStart`, PAS réutilisables depuis
  // `draggedTrackIndex` seul : ce dernier évolue en direct pendant le
  // glisser (voir `moveTrackTo`, `setDraggedTrackIndex(newIndex)` à la fin) —
  // il faut donc un point de départ FIGÉ à part pour savoir, une fois relâché,
  // si le titre a RÉELLEMENT changé de position (et lequel). Même principe
  // que `chartDragStartIndex`/`chartDragTrackTitle` plus bas pour le
  // graphique — jusqu'ici cette info existait côté graphique mais pas côté
  // liste, d'où un toast de succès affiché seulement depuis le graphique et
  // jamais depuis la liste (retour direct, capture à l'appui).
  const [listDragStartIndex, setListDragStartIndex] = useState(null);
  const [listDragTrackTitle, setListDragTrackTitle] = useState(null);

  const moveTrackTo = (newIndex) => {
    if (draggedTrackIndex === null || draggedTrackIndex === newIndex || !currentPlaylist) return;
    const newTracks = [...currentPlaylist.tracks];
    const [moved] = newTracks.splice(draggedTrackIndex, 1);
    newTracks.splice(newIndex, 0, moved);
    applyPlaylistUpdate(newTracks);
    setDraggedTrackIndex(newIndex);
  };

  const handleTrackDragStart = (index) => (e) => {
    setDraggedTrackIndex(index);
    setListDragStartIndex(index);
    setListDragTrackTitle(currentPlaylist?.tracks[index]?.title || null);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleTrackDragEnter = (index) => (e) => {
    e.preventDefault();
    moveTrackTo(index);
  };
  const handleTrackDragEnd = () => {
    if (listDragStartIndex !== null && draggedTrackIndex !== null && draggedTrackIndex !== listDragStartIndex) {
      showToast(`🔀 "${listDragTrackTitle}" déplacé dans la playlist.`);
    }
    setDraggedTrackIndex(null);
    setListDragStartIndex(null);
    setListDragTrackTitle(null);
  };

  // --- Graphique BPM : axes, données unifiées, segments ---
  const [chartAxisType, setChartAxisType] = useState('temps');
  const [chartDistanceUnitOverride, setChartDistanceUnitOverride] = useState(null);

  const chartDistanceUnit = chartDistanceUnitOverride || (currentPlaylist ? currentPlaylist.distanceUnit : 'km') || 'km';

  const distanceDisplayFactor = useMemo(() => {
    if (!currentPlaylist || chartDistanceUnit === currentPlaylist.distanceUnit) return 1;
    return currentPlaylist.distanceUnit === 'km' ? 0.621371 : 1.60934;
  }, [currentPlaylist, chartDistanceUnit]);

  const unifiedChartData = useMemo(() => {
    if (!currentPlaylist) return [];
    let combined = [];
    let accTime = 0;
    const avgPaceSecs = currentPlaylist.avgPace || 330;

    currentPlaylist.tracks.forEach((track) => {
      combined.push({ time: accTime, startDistVal: accTime / avgPaceSecs, bpmTarget: track.bpm, trackName: track.title, trackArtist: track.artist, trackPreview: track.preview || null, trackId: track.trackId, trackDuration: track.duration, isTrack: true });
      accTime += track.duration - (currentPlaylist.crossfade || 0);
    });
    if (currentPlaylist.tracks.length > 0) {
      combined.push({ time: accTime, startDistVal: accTime / avgPaceSecs, bpmTarget: currentPlaylist.tracks[currentPlaylist.tracks.length - 1].bpm });
    }

    if (currentActualData) {
      currentActualData.forEach(d => {
        const rawValue = selectedMetric === 'heartRate' ? d.heartRate : d.cadenceReelle;
        if (rawValue === undefined) return;
        let t = d.timeSec + dataOffset;
        if (t >= 0 && t <= accTime + 300) {
          let target = null;
          let tempAcc = 0;
          for (let tr of currentPlaylist.tracks) {
            tempAcc += tr.duration - (currentPlaylist.crossfade || 0);
            if (t <= tempAcc) { target = tr.bpm; break; }
          }
          if (!target && currentPlaylist.tracks.length > 0) target = currentPlaylist.tracks[currentPlaylist.tracks.length - 1].bpm;
          combined.push({ time: t, startDistVal: t / avgPaceSecs, realValue: rawValue, targetAtTime: target, title: `Tour Garmin ${d.circuit}` });
        }
      });
    }

    combined.sort((a, b) => a.time - b.time);
    return combined;
  }, [currentPlaylist, currentActualData, selectedMetric, dataOffset]);

  const trackSegments = useMemo(() => {
    if (!currentPlaylist) return [];
    const avgPaceSecs = currentPlaylist.avgPace || 330;
    let accTime = 0;
    return currentPlaylist.tracks.map((track) => {
      const startTime = accTime;
      const startDist = accTime / avgPaceSecs;
      accTime += track.duration - (currentPlaylist.crossfade || 0);
      return { track, startTime, endTime: accTime, startDist, endDist: accTime / avgPaceSecs };
    });
  }, [currentPlaylist]);

  const chartXDomain = useMemo(() => {
    const key = chartAxisType === 'distance' ? 'startDistVal' : 'time';
    const factor = chartAxisType === 'distance' ? distanceDisplayFactor : 1;
    const values = unifiedChartData.map(d => parseFloat(d[key]) * factor).filter(v => !isNaN(v));
    if (values.length === 0) return [0, 1];
    return [0, Math.max(...values)];
  }, [unifiedChartData, chartAxisType, distanceDisplayFactor]);

  const chartXTicks = useMemo(() => {
    const maxVal = chartXDomain[1];
    const ticks = [];
    if (chartAxisType === 'distance') {
      const roundedMax = Math.round(maxVal * 100) / 100;
      for (let i = 0; i <= Math.floor(maxVal); i++) ticks.push(i);
      if (Math.abs(roundedMax - Math.round(roundedMax)) > 0.02) ticks.push(roundedMax);
    } else {
      const totalMinutes = maxVal / 60;
      let stepMinutes = 1;
      if (totalMinutes > 40) stepMinutes = 10;
      else if (totalMinutes > 20) stepMinutes = 5;
      else if (totalMinutes > 10) stepMinutes = 2;
      const stepSeconds = stepMinutes * 60;
      for (let t = 0; t <= maxVal; t += stepSeconds) ticks.push(t);
      const roundedMax = Math.round(maxVal / 10) * 10;
      if (ticks.length === 0 || Math.abs(roundedMax - ticks[ticks.length - 1]) > 5) ticks.push(roundedMax);
    }
    return ticks;
  }, [chartAxisType, chartXDomain]);

  const chartYDomain = useMemo(() => {
    const values = unifiedChartData
      .flatMap(d => [parseFloat(d.bpmTarget), parseFloat(d.realValue)])
      .filter(v => !isNaN(v));
    if (values.length === 0) return [60, 200];
    return [Math.min(...values) - 10, Math.max(...values) + 10];
  }, [unifiedChartData]);

  // --- Sélection/drag directement sur le graphique ---
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState(null);
  const [isDraggingChartSegment, setIsDraggingChartSegment] = useState(false);
  const [chartDragStartIndex, setChartDragStartIndex] = useState(null);
  const [chartDragTrackTitle, setChartDragTrackTitle] = useState(null);

  const resolveSegmentIdxFromChartState = (state) => {
    if (!state || state.activeLabel === undefined || state.activeLabel === null) return -1;
    const rawCursorVal = chartAxisType === 'distance' ? parseFloat(state.activeLabel) / distanceDisplayFactor : parseFloat(state.activeLabel);
    const key = chartAxisType === 'distance' ? 'Dist' : 'Time';
    return trackSegments.findIndex(seg => rawCursorVal >= seg[`start${key}`] && rawCursorVal < seg[`end${key}`]);
  };

  const handleChartClick = (state) => {
    const idx = resolveSegmentIdxFromChartState(state);
    if (idx >= 0) setSelectedSegmentIdx(idx);
  };

  const handleChartMouseDown = (state) => {
    const idx = resolveSegmentIdxFromChartState(state);
    if (idx >= 0) {
      setDraggedTrackIndex(idx);
      setSelectedSegmentIdx(idx);
      setIsDraggingChartSegment(true);
      setChartDragStartIndex(idx);
      setChartDragTrackTitle(trackSegments[idx]?.track?.title || null);
    }
  };
  const handleChartMouseMove = (state) => {
    if (!isDraggingChartSegment) return;
    const idx = resolveSegmentIdxFromChartState(state);
    if (idx >= 0) {
      moveTrackTo(idx);
      setSelectedSegmentIdx(idx);
    }
  };
  const handleChartMouseUp = () => {
    if (isDraggingChartSegment && chartDragStartIndex !== null && draggedTrackIndex !== null && draggedTrackIndex !== chartDragStartIndex) {
      showToast(`🔀 "${chartDragTrackTitle}" déplacé dans la playlist.`);
    }
    setIsDraggingChartSegment(false);
    setDraggedTrackIndex(null);
    setChartDragStartIndex(null);
    setChartDragTrackTitle(null);
  };

  // --- Distribution BPM : par zone SEULEMENT si un vrai profil est
  // configuré — décision Produit : l'app reste neutre par défaut sur le
  // VOCABULAIRE d'effort tant que l'utilisateur n'a rien réglé lui-même.
  // `getProfileForWorkout` STRICT (pas OrDefault) : un chantier précédent
  // avait basculé sur OrDefault pour synchroniser avec TrackItem.jsx, mais
  // ça affichait des zones ("Récupération", "Seuil"...) en permanence, même
  // pour un profil jamais configuré — revert explicite ici, TrackItem.jsx
  // suit le même retour en arrière (voir ce fichier). Sinon, tranches brutes
  // de 20 BPM (repli), colorées via `getBpmBucketColor` (appConfig.js) — une
  // couleur FIXE par valeur de tranche (pas par position dans une liste
  // triée, voir sa docstring), palette vibrante "Énergie Musicale"
  // volontairement distincte de ATHLETIC_ZONES (zones d'effort), pour ne
  // jamais suggérer par accident un sens "zone d'effort" à une simple
  // tranche de BPM brute — juste de la couleur, pas du vocabulaire. / genre ---
  const bpmDistributionData = useMemo(() => {
    if (!currentPlaylist) return [];
    const activityName = isNaughtyMode
      ? (currentPlaylist.config?.workoutName || currentPlaylist.workoutType || 'Autre')
      : (currentPlaylist.workoutType || 'Autre');

    const zoneSeconds = {};
    let matchedAnyZone = false;
    currentPlaylist.tracks.forEach(t => {
      if (!t.bpm) return;
      const zone = getZoneForValue(t.bpm, activityName, getProfileForWorkout);
      if (zone) {
        matchedAnyZone = true;
        zoneSeconds[zone.key] = (zoneSeconds[zone.key] || 0) + (t.duration || 0);
      }
    });
    if (matchedAnyZone) {
      return ATHLETIC_ZONES
        .filter(z => zoneSeconds[z.key] > 0)
        .map(z => ({ name: z.shortLabel, value: zoneSeconds[z.key], color: z.color }));
    }

    const buckets = {};
    currentPlaylist.tracks.forEach(t => {
      const label = getBpmBucketLabel(t.bpm);
      buckets[label] = (buckets[label] || 0) + t.duration;
    });
    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value, sortKey: parseInt(name), color: getBpmBucketColor(parseInt(name)) }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [currentPlaylist, isNaughtyMode, getProfileForWorkout]);

  // true seulement si bpmDistributionData ci-dessus a effectivement classé
  // par zone (donc, maintenant, quasi équivalent à "un vrai profil est
  // configuré" — gardé comme flag séparé plutôt que fusionné avec
  // isBpmChartUsingRealProfile : ce dernier vérifie que LE PROFIL est
  // marqué configuré, celui-ci vérifie qu'au moins un titre a VRAIMENT été
  // classé — 2 questions différentes qui pourraient un jour diverger dans
  // un cas limite, ex. un profil configuré mais dont les zones ne couvrent
  // aucun des BPM de cette playlist précise). Dérivé de bpmDistributionData
  // lui-même (son 1er libellé suffit) plutôt que de re-parcourir les titres.
  const bpmDistributionIsZoneBased = bpmDistributionData.length > 0
    && ATHLETIC_ZONES.some(z => z.shortLabel === bpmDistributionData[0].name);


  const genreDistributionData = useMemo(() => {
    if (!currentPlaylist) return [];
    const buckets = {};
    currentPlaylist.tracks.forEach(t => {
      const g = normalizeGenreForDisplay(t.genre, t.artist, t.title);
      buckets[g] = (buckets[g] || 0) + t.duration;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name: genreDisplayLabel(name), value }));
  }, [currentPlaylist]);

  // --- Stats de correspondance cadence réelle / BPM cible (mode Cadence uniquement) ---
  const analysisStats = useMemo(() => {
    if (!currentPlaylist || !currentActualData || selectedMetric !== 'cadence') return null;
    let matchCount = 0, belowCount = 0, aboveCount = 0;
    const tol = currentPlaylist.tolerance || 10;

    currentActualData.forEach(d => {
      if (d.cadenceReelle === undefined) return;
      const t = d.timeSec + dataOffset;
      let target = null;
      let acc = 0;
      for (let track of currentPlaylist.tracks) {
        acc += track.duration - (currentPlaylist.crossfade || 0);
        if (t <= acc) { target = track.bpm; break; }
      }
      if (!target && currentPlaylist.tracks.length > 0) target = currentPlaylist.tracks[currentPlaylist.tracks.length - 1].bpm;
      if (target) {
        if (d.cadenceReelle >= target - tol && d.cadenceReelle <= target + tol) matchCount++;
        else if (d.cadenceReelle < target - tol) belowCount++;
        else aboveCount++;
      }
    });

    const total = matchCount + belowCount + aboveCount;
    if (total === 0) return null;
    return {
      matchPct: Math.round((matchCount / total) * 100),
      belowPct: Math.round((belowCount / total) * 100),
      abovePct: Math.round((aboveCount / total) * 100),
    };
  }, [currentPlaylist, currentActualData, selectedMetric, dataOffset]);

  // isReadOnly (Feature Sociale — Consultation/Clonage, 01/08) — vrai
  // UNIQUEMENT pour une playlist ouverte en APERÇU depuis le profil public
  // de quelqu'un d'autre (voir App.jsx, `handleOpenPublicPlaylist` — pose
  // `isReadOnly: true` sur l'objet transmis à `setCurrentPlaylist`, la
  // SEULE source de ce champ dans toute l'app). Déclarée AVANT `isSaved` :
  // elle est désormais utilisée dans son calcul, voir juste en dessous.
  const isReadOnly = !!currentPlaylist?.isReadOnly;

  // isSaved — la playlist courante est-elle déjà dans "Mes Séances" ?
  // Calculé UNE SEULE FOIS ici (currentPlaylist/savedPlaylists déjà reçus en
  // props du Provider) plutôt que recalculé indépendamment par chaque
  // consommateur (PlaylistHeader en avait sa propre copie ; TrackItem/
  // TrackList/PlaylistCharts en ont besoin aussi, voir plus bas) — même
  // formule partout, jamais 2 sources de vérité qui pourraient diverger.
  //
  // BUG CORRIGÉ (relecture, 02/08) — l'ancienne formule ne comparait QUE
  // les `id` (`savedPlaylists.find(p => p.id === currentPlaylist.id)`),
  // sur l'hypothèse (documentée ici même, juste au-dessus dans une version
  // antérieure) que "isSaved vaut TOUJOURS false pour une playlist
  // étrangère, le visiteur ne l'a par définition jamais dans SA PROPRE
  // savedPlaylists". Cette hypothèse est fausse : voir §3.2 de la
  // passation — la playlist de démonstration par défaut a l'id
  // `'playlist-example-1'`, IDENTIQUE pour chaque nouveau compte tant que
  // personne n'a encore sauvegardé sa propre séance. Un visiteur qui n'a
  // pas encore personnalisé SA PROPRE playlist d'exemple a donc, lui
  // aussi, une entrée `id === 'playlist-example-1'` dans sa propre
  // `savedPlaylists` — la comparaison par id seul renvoyait alors `true`
  // en consultant le profil de quelqu'un d'autre dont la playlist
  // d'exemple est également encore intacte et publique.
  // Conséquence réelle, pas juste théorique : `canEditTracks`
  // (TrackItem.jsx/TrackList.jsx/PlaylistCharts.jsx) se base sur
  // `isSaved && !isLocked`, SANS revérifier `isReadOnly` séparément
  // (contrairement à PlaylistHeader.jsx, qui vérifie `isReadOnly` EN
  // PREMIER pour une autre raison — voir plus bas). Résultat : glisser-
  // déposer/dupliquer/remplacer/retirer un titre devenait possible sur une
  // playlist qui aurait dû être strictement en lecture seule — et
  // `applyPlaylistUpdate` (plus haut dans ce fichier) écrit sa mutation
  // dans `savedPlaylists` en cherchant par CE MÊME id : le contenu de la
  // playlist D'AUTRUI aurait alors silencieusement remplacé la propre
  // playlist d'exemple du visiteur, avant d'être poussé vers Supabase par
  // `useSyncedCollection` — pas une simple illusion locale, une vraie
  // perte/corruption de donnée.
  // Correctif : `isReadOnly` force `isSaved` à `false`, ce qui ferme
  // l'écart pour les TROIS consommateurs de `canEditTracks` d'un coup,
  // sans avoir à toucher chacun séparément (même philosophie que le reste
  // de ce fichier : une seule source de vérité).
  const isSaved = !isReadOnly && !!(currentPlaylist && savedPlaylists.find(p => p.id === currentPlaylist.id));

  const value = {
    isEditingPlaylistDetails, setIsEditingPlaylistDetails,
    editedPlaylistName, setEditedPlaylistName, editedPlaylistDescription, setEditedPlaylistDescription,
    handleSavePlaylistDetails,
    handleSavePlaylist, handleUnsavePlaylist, isSaved,
    handleTogglePlaylistPublic,
    handleClonePlaylist, isReadOnly,
    handleRemoveTrack, handleDuplicateTrack, handleReplaceTrack, handleReplaceTrackSameArtist,
    openTrackMenuIndex, setOpenTrackMenuIndex,
    draggedTrackIndex, handleTrackDragStart, handleTrackDragEnter, handleTrackDragEnd,
    chartAxisType, setChartAxisType, chartDistanceUnit, setChartDistanceUnitOverride,
    distanceDisplayFactor, unifiedChartData, trackSegments,
    chartXDomain, chartXTicks, chartYDomain,
    selectedSegmentIdx, setSelectedSegmentIdx, isDraggingChartSegment,
    handleChartClick, handleChartMouseDown, handleChartMouseMove, handleChartMouseUp,
    bpmDistributionData, bpmDistributionIsZoneBased, genreDistributionData, analysisStats,
    // Re-exposé (chantier TrackList/TrackItem) : jusqu'ici currentPlaylist
    // n'était PAS dans cette valeur, uniquement reçu en prop par le Provider
    // pour son usage interne (handlers). PlaylistDetailViewInner le recevait
    // donc en double : une fois via ce contexte (absent avant), une fois en
    // prop directe depuis le Wrapper — cette 2e voie reste inchangée et est
    // la source de vérité ; on ne fait qu'ajouter un accès en lecture pour
    // les sous-composants qui n'ont que usePlaylistDetail() sous la main.
    currentPlaylist,
    // Re-exposées pour que le composant n'ait plus qu'UN SEUL point d'entrée
    // (usePlaylistDetail()) au lieu de devoir aussi lire useGeneratorContext()/
    // useAudioPlayer() séparément pour ces quelques valeurs.
    togglePreview, playingPreviewId, resolveAndPlay, resolvingTrackId,
    getProfileForWorkout, isNaughtyMode,
    // Reçues du Provider, simplement re-transmises (source de vérité externe) :
    currentActualData, selectedMetric, setSelectedMetric,
    dataOffset, setDataOffset, selectedAnalysisDate, setSelectedAnalysisDate, availableMetrics,
    // `username` (05/08, retour direct : "ajouter le nom du compte
    // créateur... et mon nom une fois que je suis dans ma playlist
    // sauvegardée") — pseudo du visiteur CONNECTÉ, simplement re-transmis
    // lui aussi (AuthContext.jsx reste la source de vérité, via App.jsx).
    // PlaylistHeader.jsx en a besoin pour afficher "toi" comme "propriétaire"
    // dès qu'une playlist est sauvegardée (`isSaved`), quelle que soit son
    // origine (template, clonage, ou génération fraîche).
    username,
  };

  return <PlaylistDetailContext.Provider value={value}>{children}</PlaylistDetailContext.Provider>;
}

// Fallback silencieux — même convention que les autres contextes du projet.
const FALLBACK = {
  isEditingPlaylistDetails: false, setIsEditingPlaylistDetails: () => {},
  editedPlaylistName: '', setEditedPlaylistName: () => {},
  editedPlaylistDescription: '', setEditedPlaylistDescription: () => {},
  handleSavePlaylistDetails: () => {},
  handleSavePlaylist: () => {}, handleUnsavePlaylist: () => {}, isSaved: false,
  handleTogglePlaylistPublic: () => {},
  handleClonePlaylist: () => {}, isReadOnly: false,
  handleRemoveTrack: () => {}, handleDuplicateTrack: () => {}, handleReplaceTrack: async () => {}, handleReplaceTrackSameArtist: async () => {},
  openTrackMenuIndex: null, setOpenTrackMenuIndex: () => {},
  draggedTrackIndex: null, handleTrackDragStart: () => () => {}, handleTrackDragEnter: () => () => {}, handleTrackDragEnd: () => {},
  chartAxisType: 'temps', setChartAxisType: () => {}, chartDistanceUnit: 'km', setChartDistanceUnitOverride: () => {},
  distanceDisplayFactor: 1, unifiedChartData: [], trackSegments: [],
  chartXDomain: [0, 1], chartXTicks: [], chartYDomain: [60, 200],
  selectedSegmentIdx: null, setSelectedSegmentIdx: () => {}, isDraggingChartSegment: false,
  handleChartClick: () => {}, handleChartMouseDown: () => {}, handleChartMouseMove: () => {}, handleChartMouseUp: () => {},
  bpmDistributionData: [], bpmDistributionIsZoneBased: false, genreDistributionData: [], analysisStats: null,
  currentPlaylist: null,
  togglePreview: () => {}, playingPreviewId: null, resolveAndPlay: () => {}, resolvingTrackId: null,
  getProfileForWorkout: () => ({ isConfigured: false }), isNaughtyMode: false,
  currentActualData: null, selectedMetric: 'cadence', setSelectedMetric: () => {},
  dataOffset: 0, setDataOffset: () => {}, selectedAnalysisDate: null, setSelectedAnalysisDate: () => {}, availableMetrics: [],
  username: null,
};

export function usePlaylistDetail() {
  const ctx = useContext(PlaylistDetailContext);
  return ctx || FALLBACK;
}
