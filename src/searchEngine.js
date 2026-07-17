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

import { DEEZER_GENRE_KEYWORDS, genreRoughlyMatches, isDirectGenreMatch, ARTIST_CATALOG, GENRES_NEEDING_DEEP_CATALOG_SEARCH } from './musicCatalog';
import { deezerFetch, resolveDeezerGenre, resolveBpmForCandidates, searchArtistsForBpm, fetchInBatches } from './musicEngine';

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
export const fetchBpmSearchResults = async (targetBpm, tolerance, genres, onProgress = null) => {
  const minBpm = Math.max(1, targetBpm - tolerance);
  const maxBpm = targetBpm + tolerance;
  const genresToQuery = genres && genres.length > 0 ? genres : ['Autre'];

  // BUG CORRIGÉ (retour direct, logs de diagnostic à l'appui : recherche
  // "Métal", seulement 8 artistes testés/6 candidats au lieu de 120/10) —
  // l'ancien test "ce genre a-t-il un mot-clé Deezer ?" répondait FAUX pour
  // Métal, qui a pourtant bien un mot-clé ('metal', voir DEEZER_GENRE_
  // KEYWORDS) — le vrai critère est "ce genre a-t-il besoin d'un renfort
  // profond par catalogue ?", capturé maintenant par
  // GENRES_NEEDING_DEEP_CATALOG_SEARCH (musicCatalog.js), qui inclut
  // explicitement Métal en plus des genres sans mot-clé fiable. Voir le
  // commentaire complet à sa définition pour le detail de cette confusion.
  const needsDeepCatalogSearch = genresToQuery.every(g => GENRES_NEEDING_DEEP_CATALOG_SEARCH.includes(g));
  // Même plafond que précédemment (150/18), mais maintenant un plafond de
  // SOUMISSION progressive plutôt qu'un simple `.slice()` unique en fin de
  // pipeline (voir plus bas, `processStubBatch`) — la logique de "combien on
  // traite au total" ne change pas, seul le MOMENT où chaque lot est résolu
  // change (au fil de l'eau, pas tout d'un coup à la toute fin).
  const stubCap = needsDeepCatalogSearch ? 150 : 18;

  // ─────────────────────────────────────────────────────────────────────
  // AFFICHAGE PROGRESSIF (retour direct : "chercher 10 morceaux d'abord,
  // puis en chercher d'autres au clic sur voir plus") — proposition retenue
  // à la place d'une VRAIE pagination en 2 recherches séparées : paginer
  // aurait cassé la garantie "Metal d'abord, Rock ensuite" (voir plus bas),
  // puisque chaque lot serait trié indépendamment SANS savoir si le lot
  // suivant contient encore du Metal non découvert — le mélange qu'on vient
  // justement de corriger serait réapparu, lot par lot.
  //
  // À la place : la recherche reste EXHAUSTIVE en arrière-plan (inchangé),
  // mais chaque LOT d'artistes interrogés (voir `onBatch`, searchArtistsForBpm)
  // déclenche IMMÉDIATEMENT la résolution de son BPM réel + genre réel, sans
  // attendre que tous les autres lots soient eux aussi interrogés. Le résultat
  // affiché (`onProgress`) est RECALCULÉ ET RETRIÉ en entier à chaque lot —
  // jamais un tri partiel figé sur un sous-ensemble incomplet : à tout moment,
  // ce qui est affiché respecte déjà l'ordre Metal > Rock > mismatch sur TOUT
  // ce qui a été résolu jusque-là, pas seulement sur le dernier lot arrivé.
  const seenIds = new Set();
  const accumulator = new Map();
  let submittedCount = 0;

  const emitProgress = () => {
    if (!onProgress) return;
    const sorted = Array.from(accumulator.values()).sort((a, b) => a._matchTier - b._matchTier);
    onProgress(sorted);
  };

  // Traite un lot de stubs bruts (catalogue OU recherche généraliste) :
  // dédoublonnage contre ce qui a déjà été soumis, plafond global de
  // soumission (voir stubCap), confirmation du BPM réel + genre réel,
  // fusion dans l'accumulateur partagé, ré-émission du résultat trié complet.
  // Isolée en fonction réutilisable : appelée à CHAQUE lot remonté par
  // searchArtistsForBpm (voir onBatch plus bas) ET une fois pour la
  // recherche généraliste — pas seulement une fois à la toute fin comme
  // avant, c'est ce qui permet l'affichage progressif.
  const processStubBatch = async (rawStubs) => {
    const fresh = rawStubs.filter(s => !seenIds.has(s.id));
    if (fresh.length === 0) return;
    const room = stubCap - submittedCount;
    if (room <= 0) return;
    const toProcess = fresh.slice(0, room);
    toProcess.forEach(s => seenIds.add(s.id));
    submittedCount += toProcess.length;

    const detailedTracks = await fetchInBatches(toProcess, 15, async (stub) => {
      const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
      return full ? { ...full, matchedGenre: stub.matchedGenre, _fromCatalog: stub._fromCatalog || false } : null;
    });
    const validDetailedTracks = detailedTracks.filter(t => t && t.bpm && parseFloat(t.bpm) >= minBpm && parseFloat(t.bpm) <= maxBpm);
    // LOG DE DIAGNOSTIC (retour direct : "je veux bien mettre des logs et te
    // montrer console") — combien de candidats de CE LOT sont rejetés faute
    // de donnée BPM Deezer exploitable — même hypothèse à tester qu'avant
    // (BPM Deezer pas systématiquement calculé pour tout le catalogue), juste
    // mesurée lot par lot maintenant plutôt qu'en un seul bloc final.
    console.log(`[BPM search] Lot : ${toProcess.length} candidat(s) brut(s) → ${detailedTracks.filter(Boolean).length} détail(s) → ${validDetailedTracks.length} avec un BPM Deezer réellement dans ${minBpm}-${maxBpm}.`);

    const resolved = await fetchInBatches(validDetailedTracks, 15, async (t) => {
      const realGenre = await resolveDeezerGenre(t.id);
      // BUG CORRIGÉ (retour direct, capture d'écran à l'appui : recherche
      // "Métal", des titres Judas Priest ressortaient étiquetés "Pop", sans
      // le moindre avertissement, mélangés sans distinction aux vrais
      // résultats Métal/Rock) — `t._fromCatalog ? false : ...` faisait
      // confiance de façon ABSOLUE à un titre trouvé via un artiste du
      // catalogue (voir ARTIST_CATALOG, musicCatalog.js), quel que soit le
      // vrai genre Deezer renvoyé — y compris un genre totalement étranger
      // au Métal (Pop, Rap...), pas seulement le cas légitime que ce renfort
      // catalogue existe pour couvrir (Deezer classe la quasi-totalité du
      // Metal en "Rock", jamais "Metal" — voir GENRE_EQUIVALENCE_GROUPS).
      // Un artiste globalement représentatif d'un genre peut très bien avoir
      // UN titre précis ailleurs (reprise, featuring, compilation mal
      // cataloguée par le label côté Deezer) — le signaler reste plus juste
      // que de l'accepter silencieusement juste parce que l'artiste, LUI,
      // est fiable. Aligné sur EXACTEMENT la même formule que
      // `buildSegmentTracks` (musicEngine.js, même renfort catalogue) pour
      // ce même cas : l'équivalence Rock/Métal est déjà couverte par
      // `genreRoughlyMatches` (GENRE_EQUIVALENCE_GROUPS) pour TOUTES les
      // sources, catalogue inclus — pas besoin d'un 2e mécanisme de
      // confiance par-dessus qui, lui, n'a plus aucun garde-fou.
      const genreMismatch = !realGenre || !genresToQuery.some(g => genreRoughlyMatches(realGenre, g));
      // Retour direct (cas réel : "Métal" sélectionné, un titre du catalogue
      // dont le vrai genre Deezer est "Rock" — ex. Lamb of God, "Ghost
      // Walking" — ressortait à égalité de tri avec un titre littéralement
      // classé "Métal" chez Deezer, ex. Slayer). `_genreMismatch` (binaire)
      // ne distinguait pas ces 2 cas, tous les deux "non mismatch". 3 paliers
      // au lieu de 2 : correspondance DIRECTE du genre_id (la plus fiable)
      // d'abord, équivalence/catalogue (ex. Rock accepté pour Métal, voir
      // GENRE_EQUIVALENCE_GROUPS) ensuite, mismatch en dernier.
      const isDirectMatch = genresToQuery.some(g => isDirectGenreMatch(realGenre, g));
      const matchTier = isDirectMatch ? 0 : (genreMismatch ? 2 : 1);
      return {
        id: t.id,
        youtubeId: `deezer-${t.id}`,
        title: t.title,
        artist: t.artist ? t.artist.name : 'Inconnu',
        bpm: Math.round(parseFloat(t.bpm)),
        duration: t.duration || 180,
        genre: realGenre || 'Genre inconnu',
        preview: t.preview || null,
        _genreMismatch: genreMismatch,
        _matchTier: matchTier,
      };
    });
    resolved.forEach(r => accumulator.set(r.id, r));
    emitProgress();
  };

  // Recherche généraliste par mot-clé — traitée comme UN lot de plus parmi
  // d'autres, résolue tôt (elle est rapide, un seul appel par genre) plutôt
  // que mise de côté jusqu'à la toute fin comme avant.
  const genericSearchPromise = (async () => {
    const stubsByGenre = await Promise.all(genresToQuery.map(async (genre) => {
      const keyword = DEEZER_GENRE_KEYWORDS[genre] || '';
      const q = `bpm_min:"${minBpm}" bpm_max:"${maxBpm}"${keyword ? ' ' + keyword : ''}`;
      const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=6`);
      const stubs = (data && Array.isArray(data.data)) ? data.data : [];
      return stubs.map(s => ({ ...s, matchedGenre: genre }));
    }));
    await processStubBatch(stubsByGenre.flat());
  })();

  // Recherche par catalogue d'artistes — un `onBatch` par genre, résolu au
  // fil de l'eau (voir searchArtistsForBpm, musicEngine.js). Chaque promesse
  // de `searchArtistsForBpm` n'est résolue qu'une fois TOUS ses `onBatch`
  // internes eux-mêmes terminés (voir le commentaire de cette fonction) :
  // le `Promise.all` juste en dessous attend donc bien TOUT, sans rien
  // perdre en route.
  const catalogSearchPromises = genresToQuery.map(async (genre) => {
    const artists = ARTIST_CATALOG[genre];
    if (!artists || artists.length === 0) return;
    await searchArtistsForBpm(
      artists, minBpm, maxBpm, [],
      needsDeepCatalogSearch ? artists.length : 8,
      needsDeepCatalogSearch ? 10 : 6,
      (batchStubs) => processStubBatch(batchStubs.map(s => ({ ...s, matchedGenre: genre, _fromCatalog: true })))
    );
  });

  await Promise.all([genericSearchPromise, ...catalogSearchPromises]);

  const results = Array.from(accumulator.values()).sort((a, b) => a._matchTier - b._matchTier);

  // LOG DE DIAGNOSTIC (retour direct) : répartition finale par palier — tier 0
  // = genre demandé confirmé directement par Deezer, tier 1 = accepté par
  // équivalence (ex. Rock pour Métal) ou via le catalogue, tier 2 = mismatch
  // (affiché quand même, en dernier, avec l'avertissement "Genre non
  // confirmé"). Donne en un coup d'œil si le nombre de résultats tier 0 est
  // bien celui qui pose question, ou si c'est le tri/l'équilibre entre paliers
  // qui surprend.
  const tierCounts = results.reduce((acc, r) => { acc[r._matchTier] = (acc[r._matchTier] || 0) + 1; return acc; }, {});
  console.log(`[BPM search] Résultat final : ${results.length} titre(s) — tier 0 (genre direct) : ${tierCounts[0] || 0}, tier 1 (équivalence/catalogue) : ${tierCounts[1] || 0}, tier 2 (mismatch) : ${tierCounts[2] || 0}.`);

  return { results };
};
