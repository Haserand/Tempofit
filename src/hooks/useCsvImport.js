import { useRef } from 'react';
import { parseGarminCsv } from '../engine/workoutDataEngine';
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
 *
 * ⚠️ COURSE CORRIGÉE (check-up 10/08 — 4e occurrence de la même famille cette
 * session, voir PlaylistDetailView.jsx/PlaylistDetailContext.jsx/
 * usePlaylistGeneration.js pour les 3 précédentes) : `FileReader.readAsText`
 * est asynchrone (le fichier est lu en arrière-plan, `onload` se déclenche
 * une fois la lecture terminée — le plus souvent quasi instantané pour un
 * petit CSV, mais pas garanti sur un gros fichier ou un appareil lent). Rien
 * n'empêchait de changer de playlist (ou de la cloner) PENDANT cette lecture
 * — `onload` reprenait ensuite avec `currentPlaylist`/`savedPlaylists` FIGÉS
 * au moment du clic, avec le même risque qu'ailleurs : `setCurrentPlaylist`
 * ramène l'affichage sur l'ANCIENNE playlist, et `setSavedPlaylists(
 * savedPlaylists.map(...))` avec un tableau obsolète pouvait faire
 * disparaître une playlist ajoutée entre-temps (DELETE Supabase via
 * useSyncedCollection.js). `currentPlaylistIdRef`/`savedPlaylistsRef`
 * (toujours à jour, même pattern qu'ailleurs) permettent de détecter le
 * changement et d'abandonner (toast informatif) plutôt que d'appliquer un
 * résultat obsolète.
 *
 * ⚠️ 2e COURSE CORRIGÉE (19/08, check-up global) — même famille que ci-dessus,
 * mais sur `csvUploadTargetDate` plutôt que `currentPlaylist`/
 * `savedPlaylists` : le `finally` de `handleCSVUpload` effaçait ce state SANS
 * CONDITION, pouvant clairer par erreur la date d'un 2e import lancé pendant
 * que le 1er lisait encore son fichier. `csvUploadTargetDateRef` (même
 * convention que les 2 refs ci-dessus) protège maintenant ce 3e point.
 */
export function useCsvImport(
  fileInputRef, csvUploadTargetDate, setCsvUploadTargetDate,
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  setSelectedAnalysisDate, setSelectedMetric,
  userStats, checkTrophies, changeView, showToast,
) {
  const currentPlaylistIdRef = useRef(currentPlaylist?.id);
  currentPlaylistIdRef.current = currentPlaylist?.id;
  const savedPlaylistsRef = useRef(savedPlaylists);
  savedPlaylistsRef.current = savedPlaylists;
  // AJOUTÉ (19/08, check-up global — même motif structurel que la course
  // déjà corrigée dans ce fichier le 10/08, mais sur `csvUploadTargetDate`
  // plutôt que sur `currentPlaylist`/`savedPlaylists`) : voir la docstring
  // du `finally` de `handleCSVUpload` plus bas pour le détail du risque.
  const csvUploadTargetDateRef = useRef(csvUploadTargetDate);
  csvUploadTargetDateRef.current = csvUploadTargetDate;

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
    // Capturés AVANT la lecture asynchrone — voir la docstring du fichier
    // pour le correctif de course qui en dépend.
    const playlistIdAtStart = currentPlaylist.id;
    const playlistAtStart = currentPlaylist;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = parseGarminCsv(event.target.result);
        if (!result.ok) { showToast(result.error, 'error'); return; }
        const { data: parsedData, hasCadence, hasHeartRate } = result;

        if (currentPlaylistIdRef.current !== playlistIdAtStart) {
          showToast("Import annulé : tu as changé de playlist entre-temps.");
          return;
        }

        // Rattache ces données réelles à la date de complétion précise ciblée
        // (`targetDate`), sans toucher aux données déjà importées pour d'autres
        // dates de la même playlist.
        const updatedActualDataByDate = { ...(playlistAtStart.actualDataByDate || {}), [targetDate]: parsedData };
        const updatedPlaylist = { ...playlistAtStart, actualDataByDate: updatedActualDataByDate };
        setSavedPlaylists(savedPlaylistsRef.current.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
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
      // BUG CORRIGÉ (19/08, check-up global) — MÊME motif structurel que le
      // correctif de course du 10/08 sur cette fonction (voir la docstring
      // du fichier) : ce `finally` s'exécutait AVANT sans condition,
      // pouvant effacer `csvUploadTargetDate` d'un 2e import DÉJÀ EN COURS
      // pour une AUTRE date de complétion, déclenché par l'utilisateur
      // pendant que CETTE lecture (async, `FileReader.readAsText`) tournait
      // encore. Scénario concret : import CSV pour la date A lancé, lecture
      // en vol ; l'utilisateur lance un 2e import pour la date B avant que
      // A ne finisse (`triggerCSVUpload` pose `csvUploadTargetDate = B`) ;
      // la lecture de A se termine enfin et son `finally` remettait
      // `csvUploadTargetDate` à `null` sans condition — la garde
      // `if (!csvUploadTargetDate) return;` en tête de `handleCSVUpload`
      // (voir plus haut) faisait alors échouer SILENCIEUSEMENT l'import de
      // B dès que l'utilisateur sélectionnait enfin son fichier, sans le
      // moindre message d'erreur. Corrigé en ne clairant QUE si
      // `csvUploadTargetDate` vaut TOUJOURS `targetDate` (capturé au tout
      // début de cette fonction, avant la lecture async) — même principe
      // que `currentPlaylistIdRef`/`savedPlaylistsRef` juste au-dessus.
      finally { if (csvUploadTargetDateRef.current === targetDate) setCsvUploadTargetDate(null); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /**
   * Retire les données réelles importées (cadence/FC) pour UNE date de
   * complétion précise, sans toucher au reste de la playlist (nom, autres
   * dates, etc.) — NOUVEAU (05/08, retour direct : "je dois pouvoir retirer
   * des données importées si je me trompe de fichier"). Jusqu'ici, la SEULE
   * façon de corriger un mauvais import était d'en réimporter un autre par-
   * dessus (`handleCSVUpload` écrase déjà `actualDataByDate[date]` sans
   * poser de question) — mais ça suppose d'avoir le BON fichier sous la main
   * tout de suite ; impossible de simplement revenir à "rien d'importé".
   * Signature `(playlist, isoDate)` explicite (comme `triggerCSVUpload`,
   * pas implicitement `currentPlaylist`) — réutilisable depuis n'importe
   * quelle carte de "Mes Séances" plus tard, pas seulement la vue détail
   * actuellement ouverte, même si le seul appelant pour l'instant est
   * PlaylistHeader.jsx (voir sa docstring, bouton "Données importées").
   * Extrait un NOUVEL objet `actualDataByDate` sans la clé `isoDate`
   * (déstructuration + rest, jamais une mutation de l'objet existant).
   */
  const removeImportedData = (playlist, isoDate) => {
    if (!playlist || !isoDate || !playlist.actualDataByDate || !playlist.actualDataByDate[isoDate]) return;
    const { [isoDate]: _removed, ...remainingActualData } = playlist.actualDataByDate;
    const updatedPlaylist = { ...playlist, actualDataByDate: remainingActualData };
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    if (currentPlaylist && currentPlaylist.id === updatedPlaylist.id) setCurrentPlaylist(updatedPlaylist);
    showToast(`Données importées retirées pour la séance du ${formatCompletionDate(isoDate)}.`);
  };

  return { triggerCSVUpload, handleCSVUpload, removeImportedData };
}
