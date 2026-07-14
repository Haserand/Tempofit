/**
 * workoutDataEngine.js — Parsing des fichiers CSV Garmin/Strava importés
 * (cadence de course et/ou fréquence cardiaque réelles d'une séance), extrait
 * de App.jsx (`handleCSVUpload`) suite à la demande explicite de découpage
 * des grosses fonctions en fichiers utilitaires séparés — même chantier que
 * musicEngine.js/searchEngine.js/spotifyEngine.js.
 *
 * Domaine distinct des 3 fichiers ci-dessus (aucun rapport avec la musique) :
 * garder ce parsing dans un fichier à part plutôt que de le glisser dans
 * l'un d'eux, pour ne pas mélanger deux domaines qui n'ont rien à voir.
 *
 * MÊME PRINCIPE QUE LES AUTRES EXTRACTIONS (pour ne pas reproduire le bug de
 * la tentative de découpage précédente) : `parseGarminCsv` ne fait QUE du
 * parsing texte pur — aucun setState, aucune lecture de state React. Elle
 * reçoit le texte brut du fichier et renvoie soit une erreur explicite, soit
 * les points de données extraits. `handleCSVUpload`, resté dans App.jsx, ne
 * garde que la plomberie FileReader et l'orchestration (setState, toasts,
 * trophées, navigation).
 *
 * Aucune règle métier n'a changé par rapport à l'original — extraction pure,
 * pas une réécriture.
 */

import { parseTimeToSeconds } from './utils/format';

/**
 * Parse le texte d'un export CSV Garmin/Strava et en extrait la cadence de
 * course et/ou la fréquence cardiaque, point par point. Cherche dans l'en-tête :
 *   - la cadence ("cadence de course moyenne" ou "cadence"+"ppm")
 *   - la fréquence cardiaque ("fréquence cardiaque moyenne" ou "fc moyenne",
 *     ou "heart rate" pour un export Strava en anglais)
 * et, si possible, une colonne de temps cumulé pour caler chaque point sur la
 * timeline. Au moins UNE des deux métriques doit être trouvée pour accepter
 * le fichier.
 *
 * @param {string} text contenu brut du fichier CSV
 * @returns {{ ok: true, data: object[], hasCadence: boolean, hasHeartRate: boolean } | { ok: false, error: string }}
 *   `error` est un message déjà prêt à afficher tel quel via showToast.
 */
export const parseGarminCsv = (text) => {
  const lines = text.split('\n');
  if (lines.length < 2) return { ok: false, error: "Fichier vide ou invalide" };

  const headers = lines[0].split('","').map(h => h.replace(/"/g, '').toLowerCase());
  const cadenceIdx = headers.findIndex(h => h.includes('cadence de course moyenne') || (h.includes('cadence') && h.includes('ppm')));
  const heartRateIdx = headers.findIndex(h => h.includes('fréquence cardiaque') || h.includes('frequence cardiaque') || h.includes('fc moyenne') || h.includes('heart rate'));
  const timeIdx = headers.findIndex(h => h.includes('temps cumulé') || h.includes('durée'));

  if (cadenceIdx === -1 && heartRateIdx === -1) {
    return { ok: false, error: "Erreur: aucune colonne de cadence ou de fréquence cardiaque trouvée dans ce fichier." };
  }

  const parsedData = lines.slice(1).map((line, idx) => {
    const cols = line.split('","').map(c => c.replace(/"/g, ''));
    const cadenceVal = (cadenceIdx !== -1 && cols.length > cadenceIdx) ? (parseInt(cols[cadenceIdx]) || 0) : 0;
    const heartRateVal = (heartRateIdx !== -1 && cols.length > heartRateIdx) ? (parseInt(cols[heartRateIdx]) || 0) : 0;
    if (cadenceVal === 0 && heartRateVal === 0) return null;

    const timeSec = timeIdx !== -1 ? parseTimeToSeconds(cols[timeIdx]) : idx * 60;

    const point = { circuit: idx + 1, timeSec };
    if (cadenceVal > 0) point.cadenceReelle = cadenceVal;
    if (heartRateVal > 0) point.heartRate = heartRateVal;
    return point;
  }).filter(Boolean);

  if (parsedData.length === 0) {
    return { ok: false, error: "Aucune donnée de cadence ou de fréquence cardiaque valide trouvée." };
  }

  return {
    ok: true,
    data: parsedData,
    hasCadence: parsedData.some(d => d.cadenceReelle !== undefined),
    hasHeartRate: parsedData.some(d => d.heartRate !== undefined),
  };
};
