import { useState, useMemo } from 'react';
import { getGenresForDisplay, genreDisplayLabel } from '../musicCatalog';

/**
 * useProfileSearchFilter — recherche/filtres 100% client-side sur la grille
 * "Playlists partagées" de ProfileView.jsx (playlists ET routines publiques
 * mêlées dans une seule grille, PAS d'onglets séparés — voir la docstring
 * de ProfileView.jsx pour ce choix).
 *
 * `items` doit être un tableau DÉJÀ filtré par mode Sport/Intime (le
 * combiné de `visiblePlaylists`/`visibleRoutines`, PAS `publicItems.
 * playlists`/`publicItems.routines` bruts) — ce hook n'a lui-même AUCUNE
 * connaissance de `is_intimate` : c'est l'appelant (ProfileView.jsx) qui
 * garantit qu'aucune ligne intime ne lui parvient hors Mode Intime. Un
 * test dédié dans ProfileView.test.jsx verrouille cette garantie à
 * l'intégration (pas ici — un item avec `is_intimate: true` glissé dans
 * `items` serait filtré comme n'importe quel autre par ce hook, il n'a pas
 * de logique spéciale pour le détecter).
 *
 * Chaque item de `items` doit porter un champ `kind` ('playlist' |
 * 'routine'), posé par ProfileView.jsx au moment de combiner les deux
 * tableaux — les lignes brutes `playlists`/`routines` (supabase-schema.sql)
 * n'ont pas de colonne équivalente, ce n'est pas une donnée serveur.
 *
 * Extraction ADAPTATIVE selon `kind`, pas une seule formule qui suppose la
 * forme d'une playlist pour les deux (une routine n'a jamais été générée :
 * pas de `content.tracks`, pas de `content.totalDuration`) :
 * - Genres : `getGenresForDisplay` sur les titres réels pour une playlist ;
 *   `content.selectedGenres` (déjà canoniques) directement pour une
 *   routine — pas de titres à désambiguïser.
 * - Durée : `content.totalDuration` (secondes réelles) pour une playlist ;
 *   pour une routine, seulement si elle cible une DURÉE
 *   (`targetMode === 'time'`, `hours`/`minutes`) — une routine en mode
 *   distance est exclue de tout bucket précis (pas de conversion
 *   distance→temps approximative qui induirait en erreur), mais reste
 *   visible tant que le filtre durée est sur "Toutes".
 */

const DURATION_BUCKETS = {
  short: (min) => min < 30,
  medium: (min) => min >= 30 && min <= 60,
  long: (min) => min > 60,
};

function extractGenres(row) {
  const content = row.content || {};
  if (row.kind === 'routine') {
    return (content.selectedGenres || []).map(genreDisplayLabel);
  }
  const tracks = content.tracks || [];
  const genreSet = new Set();
  tracks.forEach(t => {
    if (!t.genre) return;
    getGenresForDisplay(t.genre, t.artist, t.title).forEach(g => genreSet.add(g));
  });
  return Array.from(genreSet);
}

// `null` = pas de durée exploitable pour le filtre (routine en mode
// distance) — DÉLIBÉRÉMENT distinct de `0`, qui tomberait à tort dans le
// bucket "< 30 min" au lieu d'être exclu de tout bucket précis.
function extractDurationMinutes(row) {
  const content = row.content || {};
  if (row.kind === 'routine') {
    if (content.targetMode !== 'time') return null;
    return (content.hours || 0) * 60 + (content.minutes || 0);
  }
  return Math.round((content.totalDuration || 0) / 60);
}

export function useProfileSearchFilter(items) {
  const [searchText, setSearchText] = useState('');
  const [durationFilter, setDurationFilter] = useState('all'); // 'all' | 'short' | 'medium' | 'long'
  const [sportFilter, setSportFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'playlist' | 'routine'

  // Enrichissement une seule fois par changement de `items` — évite de
  // ré-extraire genres/durée à chaque frappe dans le champ de recherche
  // (seul le `.filter()` plus bas doit re-tourner à chaque changement de
  // filtre, pas cette extraction, plus coûteuse).
  const enriched = useMemo(() => items.map(row => {
    const content = row.content || {};
    return {
      row,
      kind: row.kind || 'playlist',
      name: (content.name || '').toLowerCase(),
      workoutType: content.workoutType || '',
      genres: extractGenres(row),
      durationMinutes: extractDurationMinutes(row),
    };
  }), [items]);

  const availableSports = useMemo(
    () => Array.from(new Set(enriched.map(e => e.workoutType).filter(Boolean))).sort(),
    [enriched]
  );
  const availableGenres = useMemo(
    () => Array.from(new Set(enriched.flatMap(e => e.genres))).sort(),
    [enriched]
  );

  const filteredItems = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return enriched
      .filter(e => {
        if (typeFilter !== 'all' && e.kind !== typeFilter) return false;
        if (text) {
          const matchesText = e.name.includes(text)
            || e.workoutType.toLowerCase().includes(text)
            || e.genres.some(g => g.toLowerCase().includes(text));
          if (!matchesText) return false;
        }
        if (sportFilter !== 'all' && e.workoutType !== sportFilter) return false;
        if (genreFilter !== 'all' && !e.genres.includes(genreFilter)) return false;
        if (durationFilter !== 'all') {
          if (e.durationMinutes == null) return false;
          if (!DURATION_BUCKETS[durationFilter](e.durationMinutes)) return false;
        }
        return true;
      })
      .map(e => e.row);
  }, [enriched, searchText, sportFilter, genreFilter, durationFilter, typeFilter]);

  const hasActiveFilters = searchText.trim() !== ''
    || durationFilter !== 'all' || sportFilter !== 'all' || genreFilter !== 'all' || typeFilter !== 'all';

  const resetFilters = () => {
    setSearchText('');
    setDurationFilter('all');
    setSportFilter('all');
    setGenreFilter('all');
    setTypeFilter('all');
  };

  return {
    searchText, setSearchText,
    durationFilter, setDurationFilter,
    sportFilter, setSportFilter,
    genreFilter, setGenreFilter,
    typeFilter, setTypeFilter,
    availableSports, availableGenres,
    filteredItems, hasActiveFilters, resetFilters,
  };
}
