import { parseGarminCsv } from '../workoutDataEngine';
import { formatCompletionDate } from '../utils/format';

/**
 * useCsvImport — regroupe le déclenchement et le traitement de l'import CSV
 * Garmin/Strava (cadence/fréquence cardiaque réelles, rattachées à une date de
 * complétion précise).
 *
 * Extrait d'App.jsx (25/07, chantier "réduire le God Component") : même schéma
 * que les hooks précédents — `fileInputRef`/`csvUploadTargetDate` viennent de
 * `useSessionAnalysis(currentPlaylist)`, appelé UNE SEULE FOIS dans App.jsx (voir
 * PlaylistDetailContext.jsx pour le même raisonnement : une 2e instance créerait
 * un `csvUploadTargetDate` fantôme, jamais celui réellement lu par ce hook).
 * Comportement strictement identique à l'original.
 */
export function useCsvImport(
  fileInputRef, csvUploadTargetDate, setCsvUploadTargetDate,
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  setSelectedAnalysisDate, setSelectedMetric,
  userStats, checkTrophies, changeView, showToast,
) {
  // Déclenche le sélecteur de fichier caché pour l'import CSV Garmin/Strava, en
  // mémorisant d'abord quelle playlist ET quelle date de complétion précise sont
  // concernées (une playlist faite plusieurs fois peut avoir une séance réelle
  // différente par date, plutôt qu'une seule donnée partagée pour toute la playlist).
  const triggerCSVUpload = (e, playlist, targetDateIso) => {
    e.stopPropagation();
    setCurrentPlaylist(playlist);
    setCsvUploadTargetDate(targetDateIso);
    if(fileInputRef.current) fileInputRef.current.click();
  };

  /**
   * Parse un export CSV Garmin/Strava (format à guillemets doubles, séparateur
   * `","`). Cherche dynamiquement DEUX colonnes possibles, indépendamment l'une
   * de l'autre — un même export par tour contient généralement les deux :
   *   - la cadence ("cadence de course moyenne" ou "cadence"+"ppm")
   *   - la fréquence cardiaque ("fréquence cardiaque moyenne" ou "fc moyenne",
   *     ou "heart rate" pour un export Strava en anglais)
   * et, si possible, une colonne de temps cumulé pour caler chaque point sur la
   * timeline. Au moins UNE des deux métriques doit être trouvée pour accepter le
   * fichier. En cas de succès, associe ces données réelles à la date de
   * complétion ciblée (`actualDataByDate[targetDate]`), ce qui active
   * l'affichage "Cadence/FC vs BPM cible" du graphique.
   */
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    // csvUploadTargetDate doit toujours être défini : le bouton d'import n'existe
    // que sur une date de complétion précise (voir CompletionsList.jsx), donc si
    // jamais il manque (état incohérent), on préfère bloquer plutôt que de deviner
    // à quelle séance rattacher les données.
    if (!file || !currentPlaylist || !csvUploadTargetDate) return;
    const targetDate = csvUploadTargetDate;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = parseGarminCsv(event.target.result);
        if (!result.ok) { showToast(result.error, 'error'); return; }
        const { data: parsedData, hasCadence, hasHeartRate } = result;

        // Rattache ces données réelles à la date de complétion précise ciblée
        // (`targetDate`), sans toucher aux données déjà importées pour d'autres
        // dates de la même playlist.
        const updatedActualDataByDate = { ...(currentPlaylist.actualDataByDate || {}), [targetDate]: parsedData };
        const updatedPlaylist = { ...currentPlaylist, actualDataByDate: updatedActualDataByDate };
        setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
        setCurrentPlaylist(updatedPlaylist);
        setSelectedAnalysisDate(targetDate);
        // Bascule sur la métrique effectivement importée pour donner un retour visuel
        // immédiat cohérent (ex. si ce fichier n'a que la FC, on ne reste pas bloqué
        // sur un graphique vide en mode "cadence").
        if (!hasCadence && hasHeartRate) setSelectedMetric('heartRate');
        else if (hasCadence && !hasHeartRate) setSelectedMetric('cadence');

        let stats = { ...userStats, dataImports: userStats.dataImports + 1 };
        checkTrophies(stats);
        changeView('playlist');
        const importedLabel = hasCadence && hasHeartRate ? "Cadence (PPM) et fréquence cardiaque importées"
          : hasCadence ? "Cadence (PPM) importée"
          : "Fréquence cardiaque importée";
        showToast(`${importedLabel} pour la séance du ${formatCompletionDate(targetDate)} !`);
      } catch(err) { showToast("Erreur lors de la lecture du fichier CSV.", 'error'); }
      finally { setCsvUploadTargetDate(null); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return { triggerCSVUpload, handleCSVUpload };
}
