import { createContext, useContext, useState, useMemo } from 'react';
import { getZoneForValue, ATHLETIC_ZONES, DISTRIBUTION_COLORS } from '../appConfig';
import { normalizeGenreForDisplay, genreDisplayLabel } from '../musicCatalog';
import { getSingleMatchingTrack, findSameArtistReplacement, recalculateTimeline } from '../musicEngine';
import { useGeneratorContext } from './GeneratorContext';
import { useAudioPlayer } from './AudioPlayerContext';

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
  showToast, requestRemoveSavedPlaylist,
  currentActualData, selectedMetric, setSelectedMetric,
  dataOffset, setDataOffset,
  selectedAnalysisDate, setSelectedAnalysisDate, availableMetrics,
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
  const [isEditingPlaylistName, setIsEditingPlaylistName] = useState(false);
  const [editedPlaylistName, setEditedPlaylistName] = useState('');

  const handleRenamePlaylist = () => {
    const trimmed = editedPlaylistName.trim();
    if (!trimmed || !currentPlaylist) { setIsEditingPlaylistName(false); return; }
    const updatedPlaylist = { ...currentPlaylist, name: trimmed };
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    setIsEditingPlaylistName(false);
  };

  // --- Sauvegarde / retrait de "Mes Séances" depuis la vue détail ---
  const handleSavePlaylist = () => {
    if (currentPlaylist && !savedPlaylists.find(p => p.id === currentPlaylist.id)) {
      const saved = { ...currentPlaylist, status: 'pending' };
      setSavedPlaylists([saved, ...savedPlaylists]);
      setCurrentPlaylist(saved);
      showToast('Playlist ajoutée à Mes Séances !');
    }
  };

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
    const duplicated = { ...newTracks[index], id: `track-dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
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
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleTrackDragEnter = (index) => (e) => {
    e.preventDefault();
    moveTrackTo(index);
  };
  const handleTrackDragEnd = () => setDraggedTrackIndex(null);

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

  // --- Distributions BPM (par zone si profil configuré, sinon tranches génériques) / genre ---
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
      const bucketStart = Math.floor(t.bpm / 20) * 20;
      const label = `${bucketStart}-${bucketStart + 19}`;
      buckets[label] = (buckets[label] || 0) + t.duration;
    });
    return Object.entries(buckets)
      .map(([name, value], i) => ({ name, value, sortKey: parseInt(name), color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [currentPlaylist, isNaughtyMode, getProfileForWorkout]);

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

  const value = {
    isEditingPlaylistName, setIsEditingPlaylistName, editedPlaylistName, setEditedPlaylistName, handleRenamePlaylist,
    handleSavePlaylist, handleUnsavePlaylist,
    handleRemoveTrack, handleDuplicateTrack, handleReplaceTrack, handleReplaceTrackSameArtist,
    openTrackMenuIndex, setOpenTrackMenuIndex,
    draggedTrackIndex, handleTrackDragStart, handleTrackDragEnter, handleTrackDragEnd,
    chartAxisType, setChartAxisType, chartDistanceUnit, setChartDistanceUnitOverride,
    distanceDisplayFactor, unifiedChartData, trackSegments,
    chartXDomain, chartXTicks, chartYDomain,
    selectedSegmentIdx, setSelectedSegmentIdx, isDraggingChartSegment,
    handleChartClick, handleChartMouseDown, handleChartMouseMove, handleChartMouseUp,
    bpmDistributionData, genreDistributionData, analysisStats,
    // Re-exposées pour que le composant n'ait plus qu'UN SEUL point d'entrée
    // (usePlaylistDetail()) au lieu de devoir aussi lire useGeneratorContext()/
    // useAudioPlayer() séparément pour ces quelques valeurs.
    togglePreview, playingPreviewId, resolveAndPlay, resolvingTrackId,
    getProfileForWorkout,
    // Reçues du Provider, simplement re-transmises (source de vérité externe) :
    currentActualData, selectedMetric, setSelectedMetric,
    dataOffset, setDataOffset, selectedAnalysisDate, setSelectedAnalysisDate, availableMetrics,
  };

  return <PlaylistDetailContext.Provider value={value}>{children}</PlaylistDetailContext.Provider>;
}

// Fallback silencieux — même convention que les autres contextes du projet.
const FALLBACK = {
  isEditingPlaylistName: false, setIsEditingPlaylistName: () => {},
  editedPlaylistName: '', setEditedPlaylistName: () => {}, handleRenamePlaylist: () => {},
  handleSavePlaylist: () => {}, handleUnsavePlaylist: () => {},
  handleRemoveTrack: () => {}, handleDuplicateTrack: () => {}, handleReplaceTrack: async () => {}, handleReplaceTrackSameArtist: async () => {},
  openTrackMenuIndex: null, setOpenTrackMenuIndex: () => {},
  draggedTrackIndex: null, handleTrackDragStart: () => () => {}, handleTrackDragEnter: () => () => {}, handleTrackDragEnd: () => {},
  chartAxisType: 'temps', setChartAxisType: () => {}, chartDistanceUnit: 'km', setChartDistanceUnitOverride: () => {},
  distanceDisplayFactor: 1, unifiedChartData: [], trackSegments: [],
  chartXDomain: [0, 1], chartXTicks: [], chartYDomain: [60, 200],
  selectedSegmentIdx: null, setSelectedSegmentIdx: () => {}, isDraggingChartSegment: false,
  handleChartClick: () => {}, handleChartMouseDown: () => {}, handleChartMouseMove: () => {}, handleChartMouseUp: () => {},
  bpmDistributionData: [], genreDistributionData: [], analysisStats: null,
  togglePreview: () => {}, playingPreviewId: null, resolveAndPlay: () => {}, resolvingTrackId: null,
  getProfileForWorkout: () => ({ isConfigured: false }),
  currentActualData: null, selectedMetric: 'cadence', setSelectedMetric: () => {},
  dataOffset: 0, setDataOffset: () => {}, selectedAnalysisDate: null, setSelectedAnalysisDate: () => {}, availableMetrics: [],
};

export function usePlaylistDetail() {
  const ctx = useContext(PlaylistDetailContext);
  return ctx || FALLBACK;
}
