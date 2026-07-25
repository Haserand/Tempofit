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

// Formate une date de complétion de séance ("YYYY-MM-DD" ou horodatage ISO
// complet) en chaîne lisible. Rétrocompatible avec le format "date seule"
// (saisie manuelle rétroactive, l'heure n'a pas de sens) ET l'horodatage
// complet (bouton "Marquer comme faite", nécessaire depuis qu'une playlist
// peut être complétée plusieurs fois le même jour — retour utilisateur :
// matin + soir, un cas réel et légitime). L'heure ne s'affiche que pour ce
// 2e format, seul cas où elle est réellement connue et utile pour distinguer
// 2 séances du même jour.
// Extrait d'App.jsx (chantier "réduire le God Component", 25/07) : fonction
// pure, aucune dépendance à React ni au state de l'app — comme
// formatDuration/parseTimeToSeconds ci-dessus, sa place est ici plutôt que
// prop-drillée depuis App.jsx jusqu'à PlaylistCharts.jsx via
// PlaylistDetailView.jsx (3 fichiers à traverser pour une fonction sans
// aucun état à transporter).
export const formatCompletionDate = (isoStr) => {
  const hasTime = isoStr.length > 10;
  const d = hasTime ? new Date(isoStr) : new Date(isoStr + 'T00:00:00');
  if (isNaN(d.getTime())) return isoStr;
  return hasTime
    ? `${d.toLocaleDateString()} à ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString();
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
