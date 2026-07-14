import { useState, useEffect } from 'react';

/**
 * useSessionAnalysis — regroupe les réglages d'analyse "Cible vs Réalité" du
 * graphique d'une playlist (décalage temporel, quelle date de complétion
 * analyser, quelle métrique afficher), ainsi que les données dérivées
 * (`currentActualData`, `availableMetrics`).
 *
 * `currentPlaylist` est une dépendance externe (vit dans App.jsx, pas encore
 * dans un hook dédié) passée en paramètre — ce hook lit son contenu mais ne
 * le modifie jamais.
 *
 * `csvUploadTargetDate` (à quelle date de complétion rattacher le prochain
 * import CSV) vit ici aussi : conceptuellement proche du reste (c'est un
 * réglage "quelle séance analyser/enrichir"), même si son écriture réelle se
 * fait depuis `handleCSVUpload` dans App.jsx (qui touche `savedPlaylists`,
 * hors de la portée de ce hook).
 */
export function useSessionAnalysis(currentPlaylist) {
  const [dataOffset, setDataOffset] = useState(0);
  // Mémorise à QUELLE date de complétion précise rattacher le prochain import
  // CSV (une playlist peut avoir plusieurs séances réelles, une par date de
  // complétion, au lieu d'une seule donnée réelle partagée pour toute la playlist).
  const [csvUploadTargetDate, setCsvUploadTargetDate] = useState(null);
  // Quelle date de complétion afficher dans le graphique "Cible vs Réalité"
  // quand plusieurs séances ont des données réelles importées — par défaut la
  // plus récente.
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState(null);
  // Quelle métrique réelle afficher sur le graphique quand les deux sont
  // dispo pour la séance sélectionnée : 'cadence' (PPM, comparable au BPM
  // musical cible) ou 'heartRate' (fréquence cardiaque, courbe brute — pas de
  // cible équivalente dans TempoFit aujourd'hui).
  const [selectedMetric, setSelectedMetric] = useState('cadence');

  // Réinitialise le décalage temporel du graphique (dataOffset) à chaque
  // changement de playlist affichée, et pré-sélectionne la séance réelle la
  // plus récente (s'il y en a) pour l'affichage "Cible vs Réalité".
  useEffect(() => {
    setDataOffset(0);
    const datesWithData = currentPlaylist?.actualDataByDate ? Object.keys(currentPlaylist.actualDataByDate).sort() : [];
    setSelectedAnalysisDate(datesWithData.length > 0 ? datesWithData[datesWithData.length - 1] : null);
  }, [currentPlaylist?.id]);

  // Données réelles (Garmin/Strava) de la séance actuellement sélectionnée
  // pour analyse — accès à la bonne entrée de `actualDataByDate` selon
  // `selectedAnalysisDate`.
  const currentActualData = (currentPlaylist && currentPlaylist.actualDataByDate && selectedAnalysisDate)
    ? currentPlaylist.actualDataByDate[selectedAnalysisDate]
    : null;

  // Quelles métriques sont réellement présentes dans la séance affichée — un
  // même fichier CSV Garmin/Strava peut contenir la cadence, la fréquence
  // cardiaque, ou les deux (elles viennent du même export par tour, pas
  // d'imports séparés).
  const availableMetrics = {
    cadence: !!(currentActualData && currentActualData.some(d => d.cadenceReelle !== undefined)),
    heartRate: !!(currentActualData && currentActualData.some(d => d.heartRate !== undefined)),
  };

  // Si la métrique actuellement choisie n'existe pas pour la séance affichée
  // (ex. on vient de changer de date, ou ce CSV ne contenait que l'une des
  // deux), on bascule automatiquement sur celle qui est disponible plutôt que
  // d'afficher un graphique vide.
  useEffect(() => {
    if (!currentActualData) return;
    if (selectedMetric === 'cadence' && !availableMetrics.cadence && availableMetrics.heartRate) setSelectedMetric('heartRate');
    else if (selectedMetric === 'heartRate' && !availableMetrics.heartRate && availableMetrics.cadence) setSelectedMetric('cadence');
  }, [currentActualData, selectedAnalysisDate]);

  return {
    dataOffset, setDataOffset,
    csvUploadTargetDate, setCsvUploadTargetDate,
    selectedAnalysisDate, setSelectedAnalysisDate,
    selectedMetric, setSelectedMetric,
    currentActualData, availableMetrics,
  };
}
