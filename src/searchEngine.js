/**
 * searchEngine.js — Logique de la recherche MANUELLE de titre (modale
 * "Rechercher un titre" : recherche texte/artiste ET recherche par BPM).
 *
 * Extrait d'App.jsx (`searchWorldMusicApi`, `searchTracksByBpm`) suite à une
 * demande explicite de découpage des grosses fonctions de recherche/
 * génération en fichiers utilitaires séparés.
 *
 * ⚠️ Différent de musicEngine.js (moteur de GÉNÉRATION de playlist) : celui-ci
 * ne couvre que la recherche déclenchée à la main depuis la modale. Gardé
 * séparé pour ne pas mélanger les deux domaines dans un même fichier, même
 * s'ils partagent des briques Deezer de bas niveau (deezerFetch,
 * resolveDeezerGenre, resolveBpmForCandidates), réimportées ici depuis
 * musicEngine.js plutôt que dupliquées.
 *
 * PRINCIPE DE L'EXTRACTION (pour ne pas reproduire le bug de la tentative
 * précédente sur ce même découpage) : dans App.jsx, ces fonctions n'étaient
 * PAS pures — elles lisaient/écrivaient directement une quinzaine de
 * useState (setIsWorldSearching, setWorldSearchResults,
 * setSearchActiveArtistName...). Les copier telles quelles dans un fichier
 * hors composant est impossible (aucun accès aux setters depuis ici), et les
 * faire recevoir tous les setters en argument aurait juste déplacé le
 * couplage sans le réduire (fermetures obsolètes, ordre d'appel fragile,
 * risque de bug silencieux).
 *
 * La séparation retenue ici est différente : les fonctions de ce fichier ne
 * font QUE réseau + calcul (récupérer chez Deezer/GetSongBPM, résoudre
 * BPM/genre, formater, trier) et RENVOIENT un objet de résultat, sans jamais
 * toucher au state React. App.jsx garde l'orchestration (spinners, setState,
 * dédoublonnage avec l'état précédent) dans `searchWorldMusicApi` /
 * `searchTracksByBpm`, qui ne font plus qu'appeler ces fonctions puis
 * appliquer le résultat reçu. Même principe que `getSingleMatchingTrack` /
 * `buildSegmentTracks` dans musicEngine.js, appelées depuis
 * `executeGeneration` côté App.jsx — ce fichier suit ce même précédent qui,
 * lui, n'a pas posé de problème.
 *
 * Aucune règle métier n'a changé par rapport à l'original : la logique ci-
 * dessous est une extraction, pas une réécriture. Se référer aux commentaires
 * d'origine dans App.jsx (historique des 3 versions de searchWorldMusicApi,
 * raisons du choix des 3 niveaux de résolution BPM, etc.) pour le contexte
 * complet — non reproduit ici pour éviter la duplication.
 */

import { DEEZER_GENRE_KEYWORDS } from './musicCatalog';
import { deezerFetch, resolveDeezerGenre, resolveBpmForCandidates } from './musicEngine';

export const SEARCH_PAGE_SIZE = 10;

// --- Comparaison texte tapé / nom d'artiste (pure, inchangée) ---
export const normalizeForArtistMatch = (str) => (str || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim();

export const stripLeadingArticle = (s) => s.replace(/^(the|les?|la)\s+/, '');

export const levenshteinDistance = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

export const isConfidentArtistMatch = (query, artistName) => {
  const q = normalizeForArtistMatch(query);
  const aFull = normalizeForArtistMatch(artistName);
  if (!q || !aFull) return false;
  const matches = (x, y) => x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');
  if (matches(aFull, q)) return true;
  const aStripped = stripLeadingArticle(aFull);
  const qStripped = stripLeadingArticle(q);
  if (matches(aStripped, qStripped)) return true;
  const shortestLen = Math.min(qStripped.length, aStripped.length);
  const maxAllowedEdits = Math.min(3, Math.max(1, Math.floor(shortestLen / 4)));
  return levenshteinDistance(qStripped, aStripped) <= maxAllowedEdits;
};

// Fusionne un lot de résultats avec les précédents, dédoublonné par
// youtubeId. Pure : reçoit `prev` en argument, ne lit/écrit aucun state.
// `reset` détermine si `prev` doit être ignoré (nouvelle recherche) ou
// complété (page suivante, "Voir plus").
export const dedupeAppend = (prev, incoming, reset) => {
  const combined = reset ? incoming : [...prev, ...incoming];
  const seen = new Set();
  return combined.filter(t => { if (seen.has(t.youtubeId)) return false; seen.add(t.youtubeId); return true; });
};

/**
 * Cœur de `searchWorldMusicApi` — recherche texte/artiste avec résolution BPM
 * en cascade (Deezer → GetSongBPM → détection audio). Aucun setState, aucune
 * lecture de state React : tout est reçu en paramètre, tout est renvoyé dans
 * l'objet de résultat. Peut lever une exception réseau — à l'appelant de
 * l'attraper (voir `searchWorldMusicApi` dans App.jsx).
 *
 * @param {string} query texte tapé par l'utilisateur (searchQuery)
 * @param {object} opts
 *   - reset {boolean} : true = nouvelle recherche (repart de l'index 0),
 *     false = "Voir plus" (page suivante)
 *   - offset {number} : index Deezer de départ pour "Voir plus", ignoré si reset
 *   - activeArtistName {string|null} : artiste prioritaire mémorisé d'un appel
 *     précédent (searchActiveArtistName), ignoré si reset
 *   - isNaughtyMode {boolean} : élargit la fenêtre de détection BPM (voir
 *     musicEngine.js / resolveBpmForCandidates pour le détail)
 * @returns {object} résultat prêt à appliquer tel quel via setState, voir
 *   `searchWorldMusicApi` dans App.jsx pour le mapping exact champ par champ.
 */
export const fetchWorldSearchResults = async (query, { reset, offset, activeArtistName, isNaughtyMode }) => {
  const generalOffset = reset ? 0 : offset;
  let generalStubs = [];
  let generalTotal = 0;
  let priorityArtistName = reset ? null : activeArtistName;
  let resolvedActiveArtistName = priorityArtistName;

  if (reset) {
    const [artistRes, textRes] = await Promise.all([
      deezerFetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=1`),
      deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${SEARCH_PAGE_SIZE}&index=0`)
    ]);
    const artist = (artistRes.data && Array.isArray(artistRes.data.data)) ? artistRes.data.data[0] : null;
    generalStubs = (textRes.data && Array.isArray(textRes.data.data)) ? textRes.data.data : [];
    generalTotal = (textRes.data && typeof textRes.data.total === 'number') ? textRes.data.total : generalStubs.length;

    if (artist && isConfidentArtistMatch(query, artist.name)) {
      priorityArtistName = artist.name;
      resolvedActiveArtistName = artist.name;
    } else {
      resolvedActiveArtistName = null;
    }
  } else {
    const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${SEARCH_PAGE_SIZE}&index=${generalOffset}`);
    generalStubs = (data && Array.isArray(data.data)) ? data.data : [];
    generalTotal = (data && typeof data.total === 'number') ? data.total : (generalOffset + generalStubs.length);
  }

  if (generalStubs.length === 0 && reset) {
    // Aucun titre trouvé du tout : l'appelant affiche noUsableResultsHint.
    // L'artiste éventuellement détecté juste au-dessus reste renvoyé (l'original
    // appelait déjà setSearchActiveArtistName avant ce point de sortie).
    return { noResults: true, activeArtistName: resolvedActiveArtistName };
  }

  // Un appel par titre pour récupérer son BPM (absent des listes de résultats)
  const detailedTracks = await Promise.all(generalStubs.map(async (stub) => {
    const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
    return full;
  }));

  const validDetailedTracks = detailedTracks.filter(Boolean);
  const withDeezerBpm = validDetailedTracks
    .filter(t => t.bpm && parseFloat(t.bpm) > 0)
    .map(t => ({ ...t, _resolvedBpm: Math.round(parseFloat(t.bpm)), _bpmSource: 'deezer' }));
  const missingBpm = validDetailedTracks.filter(t => !t.bpm || parseFloat(t.bpm) <= 0);

  const withGetSongBpm = (await Promise.all(missingBpm.map(async (t) => {
    try {
      const cleanTitle = (t.title || '').replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').split('-')[0].trim();
      const cleanArtist = (t.artist ? t.artist.name : '').split(',')[0].split('&')[0].trim();
      const queryStr = "song:" + cleanTitle + " artist:" + cleanArtist;
      const res = await fetch(`/api/getsongbpm?type=both&lookup=${encodeURIComponent(queryStr)}`);
      const data = await res.json();
      const tempo = (data && data.search && data.search.length > 0) ? parseInt(data.search[0].tempo) : null;
      return (tempo && tempo > 0) ? { ...t, _resolvedBpm: tempo, _bpmSource: 'getsongbpm' } : null;
    } catch (e) {
      return null; // échec silencieux : ce titre retombe simplement au niveau suivant
    }
  }))).filter(Boolean);

  const stillMissing = missingBpm.filter(t => !withGetSongBpm.some(g => g.id === t.id));
  const detectionMinBpm = isNaughtyMode ? 40 : 90;
  const detectionMaxBpm = isNaughtyMode ? 130 : 180;
  const detectedCandidates = await resolveBpmForCandidates(stillMissing, detectionMinBpm, detectionMaxBpm);

  // Reconstitue l'ordre D'ORIGINE de Deezer (voir commentaire d'origine dans
  // App.jsx) plutôt que de garder les 3 groupes concaténés dans l'ordre où
  // ils ont été résolus.
  const resolvedById = new Map([...withDeezerBpm, ...withGetSongBpm, ...detectedCandidates].map(t => [t.id, t]));
  const resolvedCandidates = validDetailedTracks.map(t => resolvedById.get(t.id)).filter(Boolean);

  const formattedResults = await Promise.all(
    resolvedCandidates.map(async (t) => {
      const realGenre = await resolveDeezerGenre(t.id);
      return {
        youtubeId: `deezer-${t.id}`,
        title: t.title,
        artist: t.artist ? t.artist.name : 'Inconnu',
        bpm: t._resolvedBpm,
        duration: t.duration || 180,
        genre: realGenre || 'Genre inconnu',
        preview: t.preview || null, // extrait MP3 de 30s fourni par Deezer, lisible sans clé ni CORS
        _bpmSource: t._bpmSource // 'deezer', 'getsongbpm' ou 'detected'
      };
    })
  );

  const norm = priorityArtistName ? normalizeForArtistMatch(priorityArtistName) : null;
  const isPriorityMatch = (t) => norm && normalizeForArtistMatch(t.artist) === norm;

  let matched, other;
  if (priorityArtistName) {
    matched = formattedResults.filter(isPriorityMatch);
    other = formattedResults.filter(t => !isPriorityMatch(t));

    if (reset && matched.length === 0 && other.length > 0) {
      // Faux positif de détection d'artiste (voir commentaire d'origine dans
      // App.jsx) : si filtrer par cet "artiste" éliminerait TOUS les titres
      // trouvés, on annule le mode priorité pour cette recherche plutôt que
      // de cacher des résultats bien réels derrière un artiste fantôme.
      priorityArtistName = null;
      resolvedActiveArtistName = null;
      matched = formattedResults;
      other = [];
    }
  } else {
    matched = formattedResults;
    other = [];
  }

  return {
    noResults: false,
    matched,
    other,
    activeArtistName: resolvedActiveArtistName,
    contextLabel: priorityArtistName ? `Titres de ${priorityArtistName}` : null,
    newOffset: generalOffset + generalStubs.length,
    hasMore: generalStubs.length > 0 && (generalOffset + generalStubs.length) < generalTotal,
    emptyAfterFormatting: formattedResults.length === 0,
  };
};

/**
 * Cœur de `searchTracksByBpm` — recherche par fourchette BPM + genres, via le
 * filtre avancé natif Deezer (`bpm_min:`/`bpm_max:`). Pure : aucun setState,
 * aucune lecture de state React.
 */
export const fetchBpmSearchResults = async (targetBpm, tolerance, genres) => {
  const minBpm = Math.max(1, targetBpm - tolerance);
  const maxBpm = targetBpm + tolerance;
  const genresToQuery = genres && genres.length > 0 ? genres : ['Autre'];

  const stubsByGenre = await Promise.all(genresToQuery.map(async (genre) => {
    const keyword = DEEZER_GENRE_KEYWORDS[genre] || '';
    const q = `bpm_min:"${minBpm}" bpm_max:"${maxBpm}"${keyword ? ' ' + keyword : ''}`;
    const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=6`);
    const stubs = (data && Array.isArray(data.data)) ? data.data : [];
    return stubs.map(s => ({ ...s, matchedGenre: genre }));
  }));

  // Fusion + déduplication par id de titre (un même titre peut remonter pour plusieurs genres)
  const merged = new Map();
  stubsByGenre.flat().forEach(s => { if (!merged.has(s.id)) merged.set(s.id, s); });
  const uniqueStubs = Array.from(merged.values()).slice(0, 15);

  if (uniqueStubs.length === 0) {
    return { results: [] };
  }

  // Un appel par titre pour confirmer le BPM exact et récupérer l'extrait audio
  const detailedTracks = await Promise.all(uniqueStubs.map(async (stub) => {
    const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
    return full ? { ...full, matchedGenre: stub.matchedGenre } : null;
  }));

  const results = await Promise.all(
    detailedTracks
      .filter(t => t && t.bpm && parseFloat(t.bpm) >= minBpm && parseFloat(t.bpm) <= maxBpm)
      .map(async (t) => {
        const realGenre = await resolveDeezerGenre(t.id);
        return {
          youtubeId: `deezer-${t.id}`,
          title: t.title,
          artist: t.artist ? t.artist.name : 'Inconnu',
          bpm: Math.round(parseFloat(t.bpm)),
          duration: t.duration || 180,
          genre: realGenre || 'Genre inconnu',
          preview: t.preview || null
        };
      })
  );

  return { results };
};
