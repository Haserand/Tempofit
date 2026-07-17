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
export const fetchBpmSearchResults = async (targetBpm, tolerance, genres) => {
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

  // BUG CORRIGÉ (cas réel constaté : "Métal" sélectionné → Eagles, AC/DC,
  // Coldplay en tête, aucun avertissement) — cause racine : `DEEZER_GENRE_
  // KEYWORDS` n'a PAS d'entrée pour "Métal" (voir musicCatalog.js : Deezer
  // classe la quasi-totalité du metal en "Rock", jamais avec un mot-clé
  // "metal" fiable), donc la recherche par mot-clé ci-dessous tournait SANS
  // AUCUN filtre de genre pour ce cas précis — n'importe quel titre dans la
  // fourchette BPM pouvait remonter, `genreRoughlyMatches` (avec son
  // équivalence Rock/Métal, nécessaire mais large) ne faisant que trier
  // après coup plutôt que vraiment cibler la recherche. Exactement pour ça
  // que `buildSegmentTracks`/`getSingleMatchingTrack` (musicEngine.js)
  // renforcent ces genres via `ARTIST_CATALOG` (recherche par artiste
  // représentatif) plutôt que de compter sur un mot-clé Deezer inexistant —
  // jamais reproduit ici avant, un chemin de code entièrement séparé.
  const catalogStubsByGenre = await Promise.all(genresToQuery.map(async (genre) => {
    const artists = ARTIST_CATALOG[genre];
    if (!artists || artists.length === 0) return [];
    // BUG CORRIGÉ (retour direct : "on est d'accord que c'est tous les
    // artistes qu'il doit tester ?") — un `maxArtistsToTry` fini, même élevé
    // (20), ne garantit PAS de tester tout le catalogue : c'est un SEUIL
    // D'ARRÊT ANTICIPÉ (voir searchArtistsForBpm, musicEngine.js), pas un
    // nombre d'artistes réellement essayés. Si les premiers artistes du lot
    // mélangé remontent chacun leur quota de titres — même hors-genre, le tri
    // par genre n'intervient qu'APRÈS coup ici — le seuil pouvait être atteint
    // bien avant la fin du catalogue. En lui passant la TAILLE RÉELLE du
    // catalogue de ce genre comme `maxArtistsToTry`, le seuil devient
    // pratiquement inatteignable avant d'avoir épuisé la liste entière —
    // exactement le comportement déjà voulu et corrigé une 1ère fois pour
    // K-pop (voir le commentaire de searchArtistsForBpm), qui n'avait
    // simplement pas été repris ici, un chemin de code séparé.
    const stubs = await searchArtistsForBpm(artists, minBpm, maxBpm, [], needsDeepCatalogSearch ? artists.length : 8, needsDeepCatalogSearch ? 10 : 6);
    return stubs.map(s => ({ ...s, matchedGenre: genre, _fromCatalog: true }));
  }));

  const stubsByGenre = await Promise.all(genresToQuery.map(async (genre) => {
    const keyword = DEEZER_GENRE_KEYWORDS[genre] || '';
    const q = `bpm_min:"${minBpm}" bpm_max:"${maxBpm}"${keyword ? ' ' + keyword : ''}`;
    const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=6`);
    const stubs = (data && Array.isArray(data.data)) ? data.data : [];
    return stubs.map(s => ({ ...s, matchedGenre: genre }));
  }));

  // BUG CORRIGÉ (retour direct : "impossible que tu aies toujours que 2
  // morceaux Métal en premier" — vu APRÈS avoir déjà élargi la recherche à
  // tout le catalogue ci-dessus, ce qui aurait dû suffire) — la vraie cause
  // était ICI, en aval : `searchArtistsForBpm` mélange ALÉATOIREMENT ses
  // résultats avant de les renvoyer (voir son dernier `.sort(() => Math.random()
  // ...)`, musicEngine.js), et ce plafond ne gardait que les 18 PREMIERS de ce
  // tirage aléatoire — AVANT toute résolution de genre. Résultat : même en
  // interrogeant les 140 artistes du catalogue Métal, si la grande majorité de
  // leurs titres sont réellement étiquetés "Rock" chez Deezer (comme documenté
  // plus haut), les 18 survivants du tirage aléatoire étaient statistiquement
  // presque tous "Rock" aussi — la recherche plus large ne changeait donc RIEN
  // au nombre final de vrais résultats "Métal", puisqu'ils étaient perdus AVANT
  // même d'être identifiés comme tels. Plafond relevé (18 → 50) spécifiquement
  // pour les genres à recherche profonde : plus de survivants du tirage
  // aléatoire arrivent jusqu'à la résolution de genre plus bas, donc plus de
  // chances qu'un vrai résultat "Métal" en fasse partie. Coût : jusqu'à 50 x 2
  // appels réseau (détail + genre) au lieu de 18 x 2 — acceptable ici car
  // recherche ponctuelle déclenchée à la main par la personne, pas un chemin
  // répété en arrière-plan.
  const merged = new Map();
  [...catalogStubsByGenre.flat(), ...stubsByGenre.flat()].forEach(s => { if (!merged.has(s.id)) merged.set(s.id, s); });

  // RETOUR DIRECT ("je veux à chaque fois que du metal pour les résultats
  // jusqu'à ce qu'on finisse par épuiser le genre, teste tous les artistes")
  // — le plafond précédent (50) restait un compromis, pas une vraie recherche
  // exhaustive : sur ~140 artistes du catalogue Métal, 50 candidats ne
  // couvrent souvent qu'une fraction du terrain avant résolution de genre.
  // Relevé à 150 pour les genres à recherche profonde — largement suffisant
  // pour couvrir la quasi-totalité des correspondances BPM réalistes sur un
  // catalogue de cette taille, tout en restant borné (pas un `Infinity` qui
  // ferait exploser le nombre d'appels réseau sans limite si jamais un
  // catalogue devenait un jour beaucoup plus grand).
  const uniqueStubs = Array.from(merged.values()).slice(0, needsDeepCatalogSearch ? 150 : 18);

  if (uniqueStubs.length === 0) {
    return { results: [] };
  }

  // Un appel par titre pour confirmer le BPM exact et récupérer l'extrait
  // audio — PAR LOTS (voir fetchInBatches, musicEngine.js) plutôt qu'un seul
  // `Promise.all` géant : avec un plafond remonté à 150 candidats (voir
  // ci-dessus), une rafale de 150 requêtes simultanées risquerait de
  // déclencher un blocage temporaire côté Deezer (déjà documenté et corrigé
  // pour ce même risque côté génération de playlist, voir musicEngine.js).
  const detailedTracks = await fetchInBatches(uniqueStubs, 15, async (stub) => {
    const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
    return full ? { ...full, matchedGenre: stub.matchedGenre, _fromCatalog: stub._fromCatalog || false } : null;
  });

  const validDetailedTracks = detailedTracks.filter(t => t && t.bpm && parseFloat(t.bpm) >= minBpm && parseFloat(t.bpm) <= maxBpm);
  // LOG DE DIAGNOSTIC (retour direct : "je veux bien mettre des logs et te
  // montrer console") — combien de candidats bruts sont rejetés ici FAUTE DE
  // DONNÉE BPM EXPLOITABLE côté Deezer (pas de champ bpm du tout, ou une
  // valeur hors de la fenêtre demandée une fois le détail du titre consulté) —
  // teste directement l'hypothèse que le BPM Deezer (une analyse audio
  // automatique, pas systématiquement calculée pour tout le catalogue) est en
  // réalité le facteur limitant, pas un défaut du code de recherche lui-même.
  console.log(`[BPM search] ${uniqueStubs.length} candidat(s) brut(s) → ${detailedTracks.filter(Boolean).length} détail(s) récupéré(s) → ${validDetailedTracks.length} avec un BPM Deezer réellement dans ${minBpm}-${maxBpm} (${detailedTracks.filter(Boolean).length - validDetailedTracks.length} rejeté(s) : pas de BPM Deezer, ou hors fenêtre une fois le détail consulté).`);
  const results = await fetchInBatches(validDetailedTracks, 15, async (t) => {
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

  // Titres du bon genre en premier — sans ça, une poignée de résultats hors-
  // genre (voir le bug ci-dessus) pouvait reléguer les vrais résultats en fin
  // de liste, ou pire, complètement hors des ~15 candidats gardés en amont.
  // Tri par palier (`_matchTier`, voir plus haut), pas juste mismatch/non-
  // mismatch. Tri STABLE (Array.prototype.sort l'est nativement dans tous les
  // moteurs modernes) : à égalité de palier, l'ordre Deezer d'origine reste
  // inchangé.
  results.sort((a, b) => a._matchTier - b._matchTier);

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
