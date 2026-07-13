/**
 * format.js — Utilitaires de formatage/parsing partagés entre App.jsx et les
 * vues extraites (StatsView notamment, gros consommateur de formatDuration).
 * Aucune dépendance à React ni au state de l'app : pures fonctions.
 */

// Convertit un nombre de secondes en chaîne lisible ("1h 05m" ou "3m 42s").
export const formatDuration = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

// Parse une valeur de temps issue d'un CSV Garmin/Strava (formats "HH:MM:SS",
// "MM:SS" ou nombre brut de secondes) vers un nombre de secondes.
export const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const cleanStr = timeStr.replace(/"/g, '').trim();
  const parts = cleanStr.split(':');
  if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  else if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(cleanStr) || 0;
};
