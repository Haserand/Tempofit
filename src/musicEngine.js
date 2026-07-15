/**
 * musicEngine.js — Moteur de génération musicale de TempoFit, séparé de App.jsx.
 *
 * Contient toutes les fonctions PURES (aucun hook React, aucun JSX, aucun state)
 * qui trouvent/valident les titres d'une playlist : appels Deezer, résolution de
 * genre/BPM, catalogue d'artistes, construction des segments. Extrait pour la
 * même raison que musicCatalog.js/appConfig.js — ne pas mélanger données/logique
 * pure et logique applicative React dans un seul fichier de 5000+ lignes — mais
 * la vraie motivation cette fois est différente : ce bloc concentre la quasi-
 * totalité des changements de la longue session de debug/amélioration du moteur
 * de génération (vérification de genre, équivalence Rock/Métal, pagination
 * Deezer, catalogue d'artistes, filtre de durée, détection de conflit de titre).
 * L'isoler permet de travailler dessus sans avoir à charger tout App.jsx.
 *
 * Dépend de musicCatalog.js pour les données de genre (ARTIST_CATALOG,
 * DEEZER_GENRE_KEYWORDS) et les fonctions de correspondance de genre déjà pures
 * qui s'y trouvaient déjà (isDirectGenreMatch, genreRoughlyMatches,
 * detectTitleStyleConflict).
 *
 * AJOUT ULTÉRIEUR : `recalculateTimeline` et `createPlaylistData`, déplacées
 * ici depuis App.jsx (découpage des grosses fonctions de génération, suite du
 * même chantier que pour searchEngine.js/searchWorldMusicApi). `createPlaylistData`
 * lisait `favorites`/`spotifyTrackPool`/`isNaughtyMode` directement dans le
 * state d'App.jsx — elle les reçoit maintenant en paramètres explicites, ce
 * qui la rend 100% pure (aucun setState, aucune lecture de state React nulle
 * part dans ce fichier). `executeGeneration`, elle, reste dans App.jsx : c'est
 * l'orchestrateur qui gère les spinners, les trophées, `savedPlaylists`,
 * `routines`... — bien trop imbriqué avec le reste de l'app pour être déplacé
 * sans risque (même logique que `searchWorldMusicApi` conservée dans App.jsx).
 */

import { ARTIST_CATALOG, DEEZER_GENRE_KEYWORDS, WEAK_DEEZER_KEYWORD_GENRES, isDirectGenreMatch, genreRoughlyMatches, detectTitleStyleConflict } from './musicCatalog';
import { formatDuration } from './utils/format';


// =====================================================================================
// MOTEUR DE SÉLECTION MUSICALE PAR BPM
// =====================================================================================

/**
 * Trouve UN morceau dont le BPM correspond à `targetBpm` (± tolerance).
 * Stratégie en cascade, du plus pertinent/personnel au plus générique — mise à
 * jour après le passage à ARTIST_CATALOG (voir musicCatalog.js), qui remplace
 * l'ancienne base de titres codés en dur (DATABASE_MUSIQUES) :
 *
 *   1. Priorité ABSOLUE aux morceaux mis en Favoris par l'utilisateur (`favorites.tracks`)
 *      — ce sont des choix explicites, donc plus fiables que tout le reste.
 *   1.5. Recherche Deezer sur tes artistes favoris (`favorites.artists`), via
 *      `searchArtistsForBpm` — genre revérifié ici (contrairement à l'étape 4,
 *      un artiste favori personnel n'est pas garanti coller au genre demandé).
 *   2. Puis les morceaux de la bibliothèque Spotify synchronisée (`spotifyTrackPool`),
 *      déjà analysés en BPM via `resolveRealBPM`.
 *   3. Une recherche Deezer en direct, tolérance exacte (`searchDeezerForGenres`,
 *      multi-genres, BPM résolu via `resolveBpmForCandidates` — valeur Deezer si
 *      connue, sinon détection audio en direct sur l'extrait, voir
 *      `detectBpmFromPreview`).
 *   3.5. Deezer à nouveau, tolérance ÉLARGIE (×2, plafonnée à ±40 BPM) : un vrai
 *      titre écoutable légèrement hors tempo sert mieux l'usage réel qu'un repli
 *      qui ne s'écoute pas du tout.
 *   4. Si Deezer ne renvoie toujours rien (ni exact, ni élargi) via la recherche
 *      généraliste par mot-clé de genre, on retente via ARTIST_CATALOG (une
 *      liste d'artistes représentatifs par genre, voir musicCatalog.js) avec
 *      `searchArtistsForBpm` — recherche par ARTISTE, pas par mot-clé flou, donc
 *      pas besoin de revérifier le genre. Tout vient réellement de Deezer (BPM,
 *      durée, extrait), rien n'est deviné. Exempté de l'historique inter-génération
 *      (`historyExcludeIds`) — mieux vaut réutiliser un artiste déjà vu que de
 *      forcer un mauvais genre.
 *   5. En tout dernier recours (garanti non-vide, GetSongBPM RETIRÉ de cette
 *      cascade : durée inventée, jamais d'extrait, artiste souvent "Inconnu"),
 *      même catalogue d'artistes mais SANS filtre BPM — on prend ce que Deezer a
 *      de ces artistes et on trie par proximité avec la cible. Un tout dernier
 *      repli minimal (sans extrait) protège contre un échec réseau total.
 *
 * `excludeYoutubeIds` sert à éviter de proposer deux fois le même morceau dans
 * une même playlist (utilisé aussi bien à la génération initiale qu'au
 * remplacement manuel d'un titre) ; `historyExcludeIds` porte spécifiquement sur
 * l'historique inter-génération d'une routine (voir `executeGeneration`).
 */
// Fetch + parsing JSON "sûr" : ne lève JAMAIS d'exception pour un corps vide
// ou invalide (contrairement à res.json() classique), seulement pour une
// vraie erreur réseau (fetch() qui rejette). Définie au niveau module (et non
// dans le composant App) car utilisée à la fois par l'UI (recherche manuelle)
// et par le moteur de génération getSingleMatchingTrack ci-dessous.
const safeFetchJson = async (url) => {
  const res = await fetch(url);
  const text = await res.text();
  if (!text) return { data: null, isEmpty: true };
  try {
    return { data: JSON.parse(text), isEmpty: false };
  } catch {
    return { data: null, isEmpty: true };
  }
};

// ⚠️ Piège connu : l'API Deezer ne renvoie PAS d'en-têtes CORS pour les appels
// directs depuis un navigateur (confirmé dans leur propre FAQ développeur), donc
// on passe par un relais serveur qu'on contrôle nous-mêmes : la fonction serverless
// Vercel /api/deezer.js (voir ce fichier). Chemin relatif : fonctionne aussi bien
// appelé depuis le module que depuis le composant, tant que le code tourne dans
// le navigateur (même origine que l'app déployée).
const DEEZER_CORS_PROXY = '/api/deezer?url=';
const deezerFetch = (deezerUrl) => safeFetchJson(DEEZER_CORS_PROXY + encodeURIComponent(deezerUrl));

/**
 * Résout le VRAI genre d'un titre Deezer via la chaîne officielle titre → album →
 * genre_id → nom du genre. Deezer n'expose pas le genre directement sur le titre
 * lui-même (limite documentée et confirmée par des développeurs sur le forum
 * officiel Deezer, jamais corrigée) — il faut passer par l'album puis l'endpoint
 * dédié /genre/{id}. `_deezerAlbumGenreCache` (module-level, partagé pour toute la
 * session) évite de refaire ces 2 appels supplémentaires pour des titres du même
 * album. Renvoie null en cas d'échec (jamais d'erreur bloquante) — l'appelant
 * décide alors d'afficher "Genre inconnu" plutôt qu'une fausse valeur.
 */
const _deezerAlbumGenreCache = {};
const resolveDeezerGenre = async (deezerTrackId, knownAlbumId = null) => {
  try {
    let albumId = knownAlbumId;
    if (!albumId) {
      const { data: trackData } = await deezerFetch(`https://api.deezer.com/track/${deezerTrackId}`);
      albumId = trackData && trackData.album ? trackData.album.id : null;
    }
    if (!albumId) return null;
    if (_deezerAlbumGenreCache[albumId] !== undefined) return _deezerAlbumGenreCache[albumId];
    const { data: albumData } = await deezerFetch(`https://api.deezer.com/album/${albumId}`);
    const genreId = albumData ? albumData.genre_id : null;
    if (!genreId || genreId <= 0) { _deezerAlbumGenreCache[albumId] = null; return null; }
    const { data: genreData } = await deezerFetch(`https://api.deezer.com/genre/${genreId}`);
    const name = genreData ? genreData.name : null;
    _deezerAlbumGenreCache[albumId] = name;
    return name;
  } catch (e) {
    return null;
  }
};

/**
 * Détecte le BPM RÉEL d'un extrait audio Deezer (30s) directement dans le
 * navigateur — Web Audio API + la librairie `web-audio-beat-detector` (analyse
 * des pics rythmiques du signal, aucune donnée externe requise). N'est utilisé
 * QUE quand Deezer ne fournit aucun BPM pour un titre (`full.bpm` absent/à 0) —
 * cas fréquent dans le catalogue Deezer, qui réduisait artificiellement le pool
 * exploitable jusqu'ici (un genre/BPM pouvait sembler "pauvre" alors que
 * beaucoup de titres valides existaient, juste sans métadonnée BPM renseignée).
 *
 * ⚠️ Limites honnêtes à connaître :
 *  - C'est une ESTIMATION algorithmique (généralement fiable à ±1-2 BPM sur de la
 *    musique à rythme marqué), pas une donnée officielle vérifiée — moins fiable
 *    sur du jazz/rubato ou des morceaux sans pulsation nette.
 *  - Risque classique d'"erreur d'octave" (détecter la moitié ou le double du
 *    vrai tempo) — atténué ici en contraignant l'analyse à la fenêtre BPM déjà
 *    visée (`minBpm`/`maxBpm` ± 5) plutôt que de laisser l'algorithme deviner
 *    sans aucune borne.
 *  - Point NON VÉRIFIABLE depuis cet environnement de développement (pas d'accès
 *    réseau ici) : ça suppose que le CDN Deezer autorise la récupération de
 *    l'extrait en ArrayBuffer via `fetch` (CORS). L'app lit déjà ces extraits via
 *    une balise `<audio>`, mais ça ne garantit pas que `fetch()` fonctionnera
 *    pareil pour du décodage. À VÉRIFIER une fois déployé — en cas de blocage
 *    CORS, il faudra faire transiter l'extrait par le proxy Vercel existant
 *    plutôt que de le récupérer en direct depuis le CDN Deezer.
 *  - Nécessite d'ajouter la dépendance `web-audio-beat-detector` au projet
 *    (`npm install web-audio-beat-detector`) avant de déployer.
 */
const detectBpmFromPreview = async (previewUrl, minBpm, maxBpm) => {
  if (!previewUrl) return null;
  let audioContext = null;
  try {
    const response = await fetch(previewUrl);
    const arrayBuffer = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const { analyze } = await import('web-audio-beat-detector');
    // Marge de ±5 BPM autour de la fenêtre visée : laisse un peu de mou à
    // l'algorithme (sinon un titre à 159.5 BPM réel pourrait rater de peu une
    // fenêtre stricte 150-160), sans pour autant le laisser dériver vers une
    // octave complètement différente.
    const tempo = await analyze(audioBuffer, { minTempo: Math.max(1, minBpm - 5), maxTempo: maxBpm + 5 });
    return tempo;
  } catch (e) {
    // Échec silencieux (CORS, format non décodable, extrait trop court pour une
    // détection fiable...) : le titre est simplement écarté, comme s'il n'avait
    // pas de BPM du tout — jamais bloquant pour le reste de la génération.
    return null;
  } finally {
    if (audioContext) audioContext.close();
  }
};

/**
 * Résout le BPM utilisable pour une liste de titres Deezer déjà détaillés
 * (`full` = réponse de /track/{id}) dans une fenêtre [minBpm, maxBpm] donnée :
 *  - Si Deezer fournit un BPM dans la fenêtre → utilisé tel quel (`_bpmSource: 'deezer'`).
 *  - Sinon, si un extrait audio existe → tentative de détection en direct (voir
 *    `detectBpmFromPreview`), acceptée seulement si le résultat tombe dans la
 *    fenêtre (`_bpmSource: 'detected'`).
 * Les détections tournent en parallèle (Promise.all) pour limiter la latence
 * totale — chacune reste indépendante et ne bloque pas les autres en cas d'échec.
 */
const resolveBpmForCandidates = async (details, minBpm, maxBpm) => {
  const withDeezerBpm = details
    .filter(full => full && full.bpm && parseFloat(full.bpm) >= minBpm && parseFloat(full.bpm) <= maxBpm)
    .map(full => ({ ...full, _resolvedBpm: Math.round(parseFloat(full.bpm)), _bpmSource: 'deezer' }));

  const missingBpm = details.filter(full => full && (!full.bpm || parseFloat(full.bpm) <= 0) && full.preview);
  // Lots plus petits qu'au-dessus (5 au lieu de 10) : chaque détection implique un
  // téléchargement d'extrait + décodage audio + analyse, nettement plus coûteux
  // qu'un simple appel JSON — mieux vaut limiter la charge simultanée sur le
  // navigateur en plus du risque de rate-limiting côté CDN Deezer.
  const detected = await fetchInBatches(missingBpm, 5, async (full) => {
    const tempo = await detectBpmFromPreview(full.preview, minBpm, maxBpm);
    if (tempo && tempo >= minBpm && tempo <= maxBpm) {
      return { ...full, _resolvedBpm: Math.round(tempo), _bpmSource: 'detected' };
    }
    return null;
  });

  return [...withDeezerBpm, ...detected.filter(Boolean)];
};

// DEEZER_GENRE_KEYWORDS et getGenreLocalDepthWarning : voir musicCatalog.js
// (importés en haut de ce fichier).

/**
 * Choisit un morceau parmi plusieurs candidats, en privilégiant celui dont la
 * durée se rapproche le plus de `preferredDuration` (le temps qu'il reste à
 * combler dans la séance) — plutôt qu'un choix uniquement aléatoire, qui pouvait
 * ajouter un morceau de 6-8 minutes en toute fin de séance et faire largement
 * dépasser la distance/durée cible (jusqu'à 1+ km d'écart observé en pratique).
 * Garde un peu de hasard (parmi les 3 plus proches) pour ne pas devenir
 * déterministe et répétitif. Si `preferredDuration` n'est pas fourni, comportement
 * inchangé (choix uniformément aléatoire).
 */
// Seuil "titre long" utilisé par l'option allowLongTracks — 6 minutes, au-delà
// desquelles un titre peut monopoliser une grosse partie d'une séance courte
// juste parce que sa durée comble bien ce qu'il reste à remplir (voir addIfValid
// dans buildSegmentTracks et les filtres équivalents dans getSingleMatchingTrack).
const MAX_TRACK_DURATION = 360;

const pickByDurationProximity = (candidates, preferredDuration) => {
  if (!preferredDuration || candidates.length <= 1) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  const sorted = [...candidates].sort((a, b) =>
    Math.abs((a.duration || 180) - preferredDuration) - Math.abs((b.duration || 180) - preferredDuration)
  );
  const top = sorted.slice(0, Math.min(3, sorted.length));
  return top[Math.floor(Math.random() * top.length)];
};

/**
 * Cherche des titres parmi une liste d'ARTISTES donnée, dans une fenêtre BPM
 * précise — recherche Deezer `artist:"X" bpm_min:Y bpm_max:Z` (fiable, pas la
 * recherche floue par mot-clé de genre utilisée ailleurs dans ce moteur).
 *
 * REMPLACE l'ancien mécanisme basé sur une liste de TITRES codés en dur
 * (`DATABASE_MUSIQUES` + `verifyAndEnrichLocalTrack`, qui devinait un BPM et
 * une durée à la main puis les faisait vérifier par Deezer après coup). Ici,
 * tout vient de Deezer EN DIRECT — BPM, durée et extrait sont réels par
 * construction, rien à deviner ni à vérifier après coup. Seule hypothèse
 * posée : un artiste choisi comme représentatif d'un genre (voir
 * ARTIST_CATALOG dans musicCatalog.js) fait globalement partie de ce genre —
 * une hypothèse bien plus fiable que la classification Deezer au niveau du
 * TITRE (voir GENRE_EQUIVALENCE_GROUPS, qui documente pourquoi cette dernière
 * s'est révélée peu fiable en pratique).
 *
 * Utilisée à la fois pour les artistes FAVORIS de l'utilisateur et pour
 * ARTIST_CATALOG (le filet de secours par genre) — même mécanisme, deux
 * sources de noms d'artistes différentes.
 *
 * Retourne une liste de STUBS Deezer (pas encore les détails complets) —
 * l'appelant doit encore récupérer les détails (bpm réel, durée, extrait) via
 * /track/{id} pour les stubs qui l'intéressent, plutôt que de tout récupérer
 * en une fois (coût réseau proportionnel à ce qui est vraiment utilisé).
 */
const searchArtistsForBpm = async (artistNames, minBpm, maxBpm, excludeYoutubeIds, maxArtistsToTry = 4, candidatesPerArtist = 6) => {
  if (!artistNames || artistNames.length === 0) return [];
  // BIAISÉ vers le DÉBUT de la liste (voir ARTIST_CATALOG dans musicCatalog.js,
  // trié des artistes les plus connus aux moins connus) : avant, un mélange
  // complet de toute la liste avant de piocher rendait cet ordre totalement
  // sans effet — un artiste obscur en fin de liste avait exactement la même
  // chance d'être tiré qu'un artiste très connu en tête. On tire maintenant dans
  // une fenêtre limitée aux ~2x premiers artistes nécessaires (mélangée entre
  // eux pour garder un peu de variété), sans aller piocher dans la queue de la
  // liste sauf si le genre a trop peu d'artistes pour remplir cette fenêtre.
  const windowSize = Math.min(artistNames.length, Math.max(maxArtistsToTry * 2, 6));
  const window = artistNames.slice(0, windowSize);
  const sampled = [...window].sort(() => Math.random() - 0.5).slice(0, maxArtistsToTry);
  const stubsByArtist = await Promise.all(sampled.map(async (artistName) => {
    const q = `artist:"${artistName}" bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"`;
    const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${candidatesPerArtist}`);
    const stubs = (data && Array.isArray(data.data)) ? data.data : [];
    return stubs.filter(s => !excludeYoutubeIds.includes(`deezer-${s.id}`));
  }));
  return stubsByArtist.flat().sort(() => Math.random() - 0.5);
};

/**
 * Recherche Deezer multi-genres (une requête par genre sélectionné, entrelacées en
 * round-robin pour une représentation équitable — sinon les 1-2 premiers genres à
 * répondre monopolisent tout le pool quand beaucoup de genres sont cochés à la
 * fois). Le BPM de chaque candidat est résolu via `resolveBpmForCandidates` :
 * valeur Deezer si présente, sinon détection audio en direct (voir plus haut).
 * Retourne UN titre choisi (pondéré par proximité de durée) ou null si rien de
 * valable dans la fenêtre BPM donnée. Factorisé pour être appelé DEUX FOIS par
 * getSingleMatchingTrack : une fois à la tolérance demandée, une fois à une
 * tolérance élargie si la première tentative échoue.
 */
/**
 * Exécute `fn` sur chaque élément de `items`, mais PAR LOTS de `batchSize` au
 * lieu d'un seul `Promise.all` géant sur tout d'un coup, avec une petite pause
 * entre chaque lot. Nécessaire pour rester sous le rate-limiting de Deezer : un
 * burst de 40-60 requêtes simultanées (ce qu'on faisait avant, rien que pour
 * remplir le pool d'UNE seule playlist) peut à lui seul déclencher un blocage
 * temporaire — la pause d'1s ajoutée entre deux GÉNÉRATIONS différentes (voir
 * executeGeneration) n'y changeait rien, puisque le vrai risque de rafale est
 * DANS une seule génération, pas seulement entre plusieurs. Observé en pratique :
 * des playlists encore entièrement composées de repli local après cette
 * première pause, ce qui a confirmé que la rafale intra-génération restait le
 * vrai goulot d'étranglement.
 */
const fetchInBatches = async (items, batchSize, fn) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  return results;
};

/**
 * Recherche Deezer avec un décalage (`index`) aléatoire dans le classement,
 * pour explorer des tranches différentes du catalogue plutôt que retomber sur
 * le même paquet de titres à chaque appel (voir le pool qui s'épuisait au fil
 * d'un lot de 10 générations). Si la page aléatoire ne renvoie RIEN (la
 * profondeur réelle pour cette requête est plus modeste que la plage explorée),
 * on retente automatiquement à l'index 0 — garanti de renvoyer quelque chose
 * s'il existe ne serait-ce qu'un seul résultat pour cette requête. Ainsi la
 * plage aléatoire (`maxIndex`) peut rester large sans risque réel de "page
 * vide alors qu'il y avait des résultats ailleurs".
 */
const searchDeezerPage = async (q, limit, maxIndex = 100) => {
  const randomIndex = Math.floor(Math.random() * maxIndex);
  const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}&index=${randomIndex}`);
  let stubs = (data && Array.isArray(data.data)) ? data.data : [];
  if (stubs.length === 0 && randomIndex > 0) {
    const { data: retryData } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}&index=0`);
    stubs = (retryData && Array.isArray(retryData.data)) ? retryData.data : [];
  }
  return stubs;
};

const searchDeezerForGenres = async (genresForQuery, minBpm, maxBpm, excludeYoutubeIds, preferredDuration, candidateCap, allowLongTracks = false, allowGenreMismatch = true) => {
  const stubsByGenre = await Promise.all(genresForQuery.map(async (g) => {
    const keyword = DEEZER_GENRE_KEYWORDS[g] || '';
    const q = `bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"${keyword ? ' ' + keyword : ''}`;
    // Décalage aléatoire dans le classement Deezer (voir searchDeezerPage), avec
    // repli automatique sur l'index 0 si la page tirée au sort est vide — la
    // plage peut donc rester large sans risque réel de rater des résultats qui
    // existent ailleurs.
    return await searchDeezerPage(q, 15, 150);
  }));
  const seenStubIds = new Set();
  const allStubs = [];
  for (let i = 0; i < 15; i++) {
    let addedThisRound = false;
    for (const arr of stubsByGenre) {
      if (i < arr.length) {
        const s = arr[i];
        if (!seenStubIds.has(s.id) && !excludeYoutubeIds.includes(`deezer-${s.id}`)) { seenStubIds.add(s.id); allStubs.push(s); }
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }
  if (allStubs.length === 0) return null;

  const detailedCandidates = await fetchInBatches(allStubs.slice(0, candidateCap), 10, async (stub) => {
    const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
    return full;
  });
  let validCandidates = await resolveBpmForCandidates(detailedCandidates.filter(Boolean), minBpm, maxBpm);
  // Filtre de durée (voir MAX_TRACK_DURATION) : même logique que addIfValid dans
  // buildSegmentTracks, appliquée ici pour que le remplacement manuel d'un titre
  // et la cascade de repli respectent aussi ce réglage.
  if (!allowLongTracks) validCandidates = validCandidates.filter(c => (c.duration || 0) <= MAX_TRACK_DURATION);
  if (validCandidates.length === 0) return null;

  // Même garde-fou genre que dans buildSegmentTracks (voir le commentaire détaillé
  // là-bas) : ce chemin était le TROU non couvert qui laissait passer "Paranoid
  // Android" (Radiohead, genre réel "Alternative") ou "You Don't Love Me" (Dawn
  // Penn, genre réel "Pop" — même pas un genre demandé !) dans une playlist
  // Métal/Rock. Utilisé par getSingleMatchingTrack (tolérance exacte ET élargie,
  // les deux passent par cette fonction) et par le remplacement manuel d'un titre.
  const ordered = preferredDuration
    ? [...validCandidates].sort((a, b) => Math.abs((a.duration || 180) - preferredDuration) - Math.abs((b.duration || 180) - preferredDuration))
    : [...validCandidates].sort(() => Math.random() - 0.5);

  const MAX_GENRE_CHECK_ATTEMPTS = 5;
  let full = null;
  let genreMismatch = false;
  const attempted = [];
  for (let attempt = 0; attempt < Math.min(MAX_GENRE_CHECK_ATTEMPTS, ordered.length); attempt++) {
    const candidate = ordered[attempt];
    const realGenre = await resolveDeezerGenre(candidate.id);
    candidate._resolvedGenre = realGenre || 'Genre inconnu';
    attempted.push(candidate);
    // GARDE-FOU TITRE : même vérification que dans buildSegmentTracks (voir
    // detectTitleStyleConflict) — un titre peut explicitement indiquer un style
    // différent (remix hardstyle, version acoustique...) même si le genre_id de
    // l'album dit le contraire.
    const titleConflict = detectTitleStyleConflict(candidate.title, genresForQuery);
    const matches = !titleConflict && genresForQuery.some(g => genreRoughlyMatches(realGenre, g));
    if (matches) {
      full = candidate;
      break;
    }
  }
  if (!full) {
    // Pour les genres au mot-clé fiable (comportement historique, INCHANGÉ) : on
    // garde quand même le 1er candidat essayé plutôt que rien — un titre
    // légèrement hors-genre reste préférable à un trou dans la playlist.
    // Pour les genres au mot-clé FRAGILE (`allowGenreMismatch = false`, voir
    // WEAK_DEEZER_KEYWORD_GENRES et l'appelant getSingleMatchingTrack) : cas
    // réel qui a motivé ce changement — le catalogue d'artistes n'avait rien
    // trouvé au bon BPM pour "K-pop", donc cette recherche texte libre reprenait
    // la main et acceptait TOUJOURS son 1er résultat même hors-sujet (Heaven 17,
    // groupe britannique des années 80, pour une requête "asian"). Ici, on
    // préfère renvoyer `null` — la cascade retombera alors sur le repli extrême
    // (même catalogue d'artistes, BPM ignoré), qui donne au moins un VRAI artiste
    // du genre demandé plutôt qu'un résultat texte libre arbitraire.
    if (!allowGenreMismatch) return null;
    full = attempted[0] || ordered[0];
    genreMismatch = true;
  }

  return {
    youtubeId: `deezer-${full.id}`,
    title: full.title,
    artist: full.artist ? full.artist.name : 'Inconnu',
    bpm: full._resolvedBpm,
    duration: full.duration || 180,
    genre: full._resolvedGenre || 'Genre inconnu',
    preview: full.preview || null,
    _bpmSource: full._bpmSource,
    ...(genreMismatch ? { _genreMismatch: true, _isFallback: true } : {})
  };
};

const getSingleMatchingTrack = async (targetBpm, tolerance, selectedGenres, excludeYoutubeIds = [], favorites = null, spotifyTrackPool = [], preferredDuration = null, historyExcludeIds = [], allowLongTracks = false) => {
  const minBpm = targetBpm - tolerance;
  const maxBpm = targetBpm + tolerance;

  // 1. PRIORITÉ ABSOLUE : tes morceaux mis en Favoris (via la recherche BPM/genre ou
  //    la recherche libre). `favorites.tracks` contient désormais des objets complets
  //    (bpm, extrait audio...) et non plus juste des noms, ce qui permet de les
  //    utiliser réellement ici plutôt que comme simple affichage.
  if (favorites && Array.isArray(favorites.tracks) && favorites.tracks.length > 0) {
    const perfectFavoriteTracks = favorites.tracks.filter(t =>
      typeof t === 'object' && t.bpm >= minBpm && t.bpm <= maxBpm &&
      !excludeYoutubeIds.includes(t.youtubeId)
    );
    if (perfectFavoriteTracks.length > 0) {
      return pickByDurationProximity(perfectFavoriteTracks, preferredDuration);
    }
  }

  // 1.5. ARTISTES FAVORIS : jusqu'ici, favorites.artists ("Top Artistes") n'était
  //      jamais utilisé nulle part dans ce moteur — un vrai trou fonctionnel entre
  //      ce que la page Favoris laissait penser et ce qui se passait réellement.
  //      On cherche maintenant sur Deezer des titres de ces artistes qui tombent
  //      dans la fourchette de BPM demandée, via searchArtistsForBpm (même
  //      mécanisme que ARTIST_CATALOG, réutilisé ici pour les artistes PERSONNELS
  //      de l'utilisateur plutôt qu'une liste choisie par genre).
  if (favorites && Array.isArray(favorites.artists) && favorites.artists.length > 0) {
    try {
      const candidateStubs = await searchArtistsForBpm(favorites.artists, minBpm, maxBpm, excludeYoutubeIds, 3, 5);
      // GARDE-FOU GENRE (trou trouvé après un test réel : "Stan" d'Eminem et
      // "Thinking Out Loud" d'Ed Sheeran s'invitaient dans des playlists
      // Métal/Rock via ce chemin précis) : contrairement à ARTIST_CATALOG (choisi
      // PAR genre, donc le genre est présupposé fiable), les artistes favoris de
      // l'utilisateur ne sont pas garantis correspondre au genre demandé — un
      // artiste favori totalement hors du genre demandé ne devrait pas s'inviter
      // juste parce qu'un de ses titres tombe dans la bonne fenêtre BPM. On
      // vérifie donc encore le genre ici. Contrairement aux autres étapes de la
      // cascade, si aucun candidat ne correspond, on NE FORCE PAS un mauvais
      // choix : cette étape est un bonus de priorité précoce (pas un dernier
      // recours), donc on laisse simplement la main aux étapes suivantes.
      for (let attempt = 0; attempt < Math.min(5, candidateStubs.length); attempt++) {
        const stub = candidateStubs[attempt];
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
        if (full && full.bpm && parseFloat(full.bpm) >= minBpm && parseFloat(full.bpm) <= maxBpm) {
          const realGenre = await resolveDeezerGenre(full.id);
          if (selectedGenres.some(g => genreRoughlyMatches(realGenre, g))) {
            return {
              youtubeId: `deezer-${full.id}`,
              title: full.title,
              artist: full.artist ? full.artist.name : 'Inconnu',
              bpm: Math.round(parseFloat(full.bpm)),
              duration: full.duration || 180,
              genre: realGenre || 'Genre inconnu',
              preview: full.preview || null
            };
          }
        }
      }
    } catch (e) {
      // Échec silencieux : on continue vers Spotify/Deezer générique ci-dessous.
    }
  }

  // 2. On cherche ensuite dans TES propres morceaux Spotify synchronisés !
  if (spotifyTrackPool && spotifyTrackPool.length > 0) {
    const perfectSpotifyTracks = spotifyTrackPool.filter(t => 
      t.bpm >= minBpm && 
      t.bpm <= maxBpm && 
      !excludeYoutubeIds.includes(t.youtubeId)
    );
    if (perfectSpotifyTracks.length > 0) {
      return pickByDurationProximity(perfectSpotifyTracks, preferredDuration);
    }
  }

  const genresForQuery = (selectedGenres && selectedGenres.length > 0) ? selectedGenres : ['Autre'];
  const candidateCap = Math.min(Math.max(8, genresForQuery.length * 3), 24);
  // Calculé tôt (utilisé à la fois par tryDeezerKeywordSearch ci-dessous, pour
  // décider si un résultat hors-genre est acceptable, ET plus bas pour l'ordre
  // de la cascade) — voir WEAK_DEEZER_KEYWORD_GENRES dans musicCatalog.js.
  const allGenresHaveWeakKeyword = genresForQuery.length > 0 && genresForQuery.every(g => WEAK_DEEZER_KEYWORD_GENRES.includes(g));
  const validGenres = selectedGenres.length > 0 ? selectedGenres : ['Métal'];
  const localExcludeIds = excludeYoutubeIds.filter(id => !historyExcludeIds.includes(id));
  // Correspondance artiste → genre D'ORIGINE (pas juste une liste plate de noms) :
  // sans ça, un titre trouvé via un artiste de la 2e/3e liste de genres
  // sélectionnés (ex. "Rock" quand on a coché Métal+Rock) s'affichait quand même
  // comme "Métal" (toujours validGenres[0]) — les genres sélectionnés ensemble
  // doivent être traités à ÉGALITÉ, pas biaisés vers le premier de la liste.
  // Sert maintenant seulement de repli d'AFFICHAGE si `resolveDeezerGenre`
  // échoue techniquement (erreur réseau) — la vérité vient du genre réel ci-dessous.
  const artistGenreMap = new Map();
  validGenres.forEach(g => { if (ARTIST_CATALOG[g]) ARTIST_CATALOG[g].forEach(a => { if (!artistGenreMap.has(a)) artistGenreMap.set(a, g); }); });
  let catalogArtists = [...artistGenreMap.keys()];
  if (catalogArtists.length === 0) { catalogArtists = ARTIST_CATALOG['Pop']; ARTIST_CATALOG['Pop'].forEach(a => artistGenreMap.set(a, 'Pop')); }

  // DEEZER EN DIRECT, mot-clé de CHAQUE genre sélectionné, une recherche par genre
  // entrelacée round-robin (voir searchDeezerForGenres), tolérance exacte PUIS
  // élargie (±40 BPM max, marquée `_isFallback`) — extraite en fonction nommée
  // pour pouvoir être tentée soit AVANT soit APRÈS le catalogue d'artistes
  // ci-dessous, selon l'ordre décidé plus bas (voir WEAK_DEEZER_KEYWORD_GENRES).
  const tryDeezerKeywordSearch = async () => {
    try {
      const exactMatch = await searchDeezerForGenres(genresForQuery, minBpm, maxBpm, excludeYoutubeIds, preferredDuration, candidateCap, allowLongTracks, !allGenresHaveWeakKeyword);
      if (exactMatch) return exactMatch;
    } catch (e) {
      // Échec silencieux (proxy indisponible, hors-ligne...) : on continue vers la tentative suivante.
    }
    try {
      const widenedTolerance = Math.min(tolerance * 2, 40);
      const widenedMatch = await searchDeezerForGenres(genresForQuery, targetBpm - widenedTolerance, targetBpm + widenedTolerance, excludeYoutubeIds, preferredDuration, candidateCap, allowLongTracks, !allGenresHaveWeakKeyword);
      if (widenedMatch) return { ...widenedMatch, _isFallback: true };
    } catch (e) {
      // Échec silencieux : on continue vers le fallback local.
    }
    return null;
  };

  // BACKUP CATALOGUE D'ARTISTES, tolérance exacte : recherche via ARTIST_CATALOG
  // (voir musicCatalog.js et searchArtistsForBpm) — une recherche par ARTISTE
  // représentatif du genre plutôt que par mot-clé flou. Exempté de l'historique
  // inter-génération (`historyExcludeIds`) — même logique que l'ancienne base de
  // titres : mieux vaut réutiliser un artiste déjà vu que de forcer un mauvais
  // genre. Extraite en fonction nommée pour la même raison que ci-dessus.
  //
  // ⚠️ Le genre du titre choisi EST revérifié ci-dessous (album Deezer réel via
  // `resolveDeezerGenre`), contrairement à une version précédente qui faisait
  // confiance au genre du catalogue sans vérification ("l'artiste EST le choix
  // de genre"). Ce raisonnement ne tient pas pour un artiste éclectique dont les
  // albums couvrent plusieurs genres chez Deezer (cas réel rencontré : Baby
  // Lasagna, catalogué "Métal/Alternative" mais dont certains singles sont
  // taggés Pop côté Deezer) — sans cette vérification, un tel titre aurait pu
  // être étiqueté avec le genre du catalogue sans que ce soit vraiment le sien,
  // sans le moindre avertissement. Même mécanisme que plus haut dans ce fichier
  // (voir `getSingleMatchingTrack`, la boucle `MAX_GENRE_CHECK_ATTEMPTS`) :
  // quelques candidats sont essayés dans l'ordre de proximité de durée, le
  // premier dont le VRAI genre correspond est retenu ; sinon, dernier recours,
  // le premier candidat testé est gardé quand même mais marqué `_genreMismatch`.
  const tryArtistCatalogSearch = async () => {
    try {
      // Échantillon élargi (12 artistes testés / 8 résultats chacun, au lieu de
      // 6/5) — retour direct après un cas réel : avec les anciens réglages, sur
      // un catalogue K-pop de 109 artistes, seuls les 12 premiers de la liste
      // étaient même considérés (`windowSize` dans searchArtistsForBpm est
      // proportionnel à `maxArtistsToTry`, pas à la taille du catalogue), et
      // seuls 6 d'entre eux réellement interrogés — élargir le catalogue à 109
      // n'apportait donc RIEN à cette recherche précise. D'autant plus important
      // maintenant que cette recherche par catalogue est la stratégie PRIMAIRE
      // (pas juste un repli) pour les genres à mot-clé Deezer fragile (voir
      // WEAK_DEEZER_KEYWORD_GENRES et l'ordre de la cascade plus bas).
      const stubs = await searchArtistsForBpm(catalogArtists, minBpm, maxBpm, localExcludeIds, 12, 8);
      if (stubs.length > 0) {
        let details = (await fetchInBatches(stubs.slice(0, 20), 10, async (s) => {
          const { data: full } = await deezerFetch(`https://api.deezer.com/track/${s.id}`);
          return full;
        })).filter(f => f && f.bpm && parseFloat(f.bpm) >= minBpm && parseFloat(f.bpm) <= maxBpm && f.preview);
        // GARDE-FOU TITRE (voir detectTitleStyleConflict) : même si l'artiste est
        // choisi comme représentatif du genre, un remix/une version particulière
        // de ce titre peut être dans un tout autre style (ex. remix hardstyle).
        details = details.filter(f => !detectTitleStyleConflict(f.title, validGenres));
        if (!allowLongTracks) details = details.filter(f => (f.duration || 0) <= MAX_TRACK_DURATION);
        if (details.length > 0) {
          const ordered = preferredDuration
            ? [...details].sort((a, b) => Math.abs((a.duration || 180) - preferredDuration) - Math.abs((b.duration || 180) - preferredDuration))
            : [...details].sort(() => Math.random() - 0.5);

          const MAX_CATALOG_GENRE_CHECK_ATTEMPTS = 5;
          let picked = null;
          let pickedRealGenre = null;
          let genreMismatch = false;
          const attempted = [];
          for (let attempt = 0; attempt < Math.min(MAX_CATALOG_GENRE_CHECK_ATTEMPTS, ordered.length); attempt++) {
            const candidate = ordered[attempt];
            const realGenre = await resolveDeezerGenre(candidate.id);
            attempted.push({ candidate, realGenre });
            if (realGenre && validGenres.some(g => genreRoughlyMatches(realGenre, g))) {
              picked = candidate;
              pickedRealGenre = realGenre;
              break;
            }
          }
          if (!picked) {
            const fallback = attempted[0] || { candidate: ordered[0], realGenre: null };
            picked = fallback.candidate;
            pickedRealGenre = fallback.realGenre;
            genreMismatch = true;
          }

          return {
            youtubeId: `deezer-${picked.id}`, title: picked.title,
            artist: picked.artist ? picked.artist.name : 'Inconnu',
            bpm: Math.round(parseFloat(picked.bpm)), duration: picked.duration || 180,
            genre: pickedRealGenre || artistGenreMap.get(picked.artist ? picked.artist.name : '') || validGenres[0],
            preview: picked.preview,
            ...(genreMismatch ? { _genreMismatch: true, _isFallback: true } : {})
          };
        }
      }
    } catch (e) {
      // Échec silencieux : on continue vers le repli extrême ci-dessous.
    }
    return null;
  };

  // ORDRE DE LA CASCADE : la recherche Deezer généraliste par mot-clé (ci-dessus)
  // explore bien plus large que le catalogue d'artistes en temps normal, donc
  // essayée en premier par défaut. MAIS pour les genres dont le mot-clé est une
  // approximation en recherche TEXTE LIBRE plutôt qu'un vrai filtre de genre
  // (voir WEAK_DEEZER_KEYWORD_GENRES dans musicCatalog.js — cas réel constaté :
  // "K-pop" remontait un titre de Heaven 17, groupe britannique des années 80,
  // parce que "asian" y est cherché comme simple mot dans les métadonnées), le
  // catalogue d'artistes (recherche par ARTISTE réel du genre) est nettement
  // plus fiable — on inverse l'ordre uniquement quand TOUS les genres demandés
  // sont dans ce cas (un mélange avec un genre au mot-clé fiable garde l'ordre
  // normal, qui reste pertinent pour ce genre-là). `allGenresHaveWeakKeyword`
  // calculé plus haut (réutilisé par tryDeezerKeywordSearch également).
  const primarySearch = allGenresHaveWeakKeyword ? tryArtistCatalogSearch : tryDeezerKeywordSearch;
  const secondarySearch = allGenresHaveWeakKeyword ? tryDeezerKeywordSearch : tryArtistCatalogSearch;

  const primaryResult = await primarySearch();
  if (primaryResult) return primaryResult;
  const secondaryResult = await secondarySearch();
  if (secondaryResult) return secondaryResult;

  // GetSongBPM SUPPRIMÉ ICI (ancienne étape 5) : ne fournissait jamais d'extrait
  // écoutable, inventait une durée aléatoire, et donnait souvent un artiste
  // "Inconnu" — moins fiable que le repli extrême ci-dessous (vrai titre, vraie
  // durée, juste hors tolérance BPM), qui est de toute façon garanti non-vide.

  // 5. FALLBACK EXTRÊME (dernier recours, garanti non-vide) : même catalogue
  //    d'artistes, mais SANS filtre BPM strict — on prend ce que Deezer a de ces
  //    artistes, peu importe le tempo, et on trie par proximité avec la cible.
  //    Pour un artiste réel avec une vraie discographie sur Deezer, ça trouve
  //    presque toujours quelque chose — contrairement à l'ancienne base de
  //    titres figée, qui pouvait littéralement être vide pour un genre donné.
  try {
    const pickedArtist = catalogArtists[Math.floor(Math.random() * catalogArtists.length)];
    const q = `artist:"${pickedArtist}"`;
    const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=25`);
    const stubs = (data && Array.isArray(data.data) ? data.data : []).filter(s => !localExcludeIds.includes(`deezer-${s.id}`));
    if (stubs.length > 0) {
      const details = (await fetchInBatches(stubs, 10, async (s) => {
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${s.id}`);
        return full;
      })).filter(f => f && f.bpm && parseFloat(f.bpm) > 0);
      if (details.length > 0) {
        // Comme pour les autres derniers recours de cette cascade : on essaie de
        // respecter le filtre de durée, mais on l'ignore plutôt que de renvoyer
        // un trou si vraiment aucun candidat de cet artiste ne le respecte —
        // cette étape est garantie non-vide, ça reste la priorité absolue.
        const durationFiltered = allowLongTracks ? details : details.filter(f => (f.duration || 0) <= MAX_TRACK_DURATION);
        const finalDetails = durationFiltered.length > 0 ? durationFiltered : details;
        const sortedByProximity = [...finalDetails].sort((a, b) => Math.abs(parseFloat(a.bpm) - targetBpm) - Math.abs(parseFloat(b.bpm) - targetBpm));
        const picked = pickByDurationProximity(sortedByProximity.slice(0, 3), preferredDuration);
        return {
          youtubeId: `deezer-${picked.id}`, title: picked.title,
          artist: picked.artist ? picked.artist.name : 'Inconnu',
          bpm: Math.round(parseFloat(picked.bpm)), duration: picked.duration || 180,
          genre: artistGenreMap.get(picked.artist ? picked.artist.name : '') || artistGenreMap.get(pickedArtist) || validGenres[0], preview: picked.preview || null,
          _isFallback: true
        };
      }
    }
  } catch (e) {
    // Échec réseau total : voir le tout dernier repli ci-dessous.
  }

  // Repli du repli, en cas d'échec réseau total sur TOUT ce qui précède (offline,
  // proxy indisponible...) : un objet minimal sans extrait, pour ne jamais planter
  // la génération même dans le pire des cas.
  return {
    youtubeId: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title: 'Titre indisponible', artist: catalogArtists[0] || 'Inconnu',
    bpm: targetBpm, duration: preferredDuration || 200,
    genre: artistGenreMap.get(catalogArtists[0]) || validGenres[0], preview: null, _isFallback: true
  };
};

// GENRE_EQUIVALENCE_GROUPS, TITLE_STYLE_OVERRIDE_KEYWORDS, isDirectGenreMatch,
// genreRoughlyMatches, detectTitleStyleConflict : voir musicCatalog.js (importés
// en haut de ce fichier) — donnée pure + fonctions de lecture pure, déplacées là
// où elles auraient dû être dès le départ, aux côtés de DEEZER_GENRE_KEYWORDS.

/**
 * Construit l'ensemble des titres d'un SEGMENT (une phase de la séance à un BPM
 * donné), en visant sa durée cible comme un vrai problème de "somme de
 * sous-ensemble" — plutôt que d'ajouter des morceaux un par un sans vue
 * d'ensemble, en ne regardant le temps restant qu'au moment de choisir le
 * dernier titre (ce qui pouvait faire largement dépasser la cible si les seuls
 * candidats alors disponibles étaient longs).
 *
 * Principe : on rassemble d'abord un POOL de candidats variés (favoris, Spotify,
 * Deezer, base locale) correspondant au BPM/genre demandés, PUIS on sélectionne
 * dedans, à chaque étape, le titre dont la durée comble le mieux ce qu'il reste
 * à combler — en comparant à TOUT le pool restant, pas seulement 2-3 candidats
 * tirés au hasard en fin de parcours. Si le pool s'épuise avant d'atteindre la
 * durée cible, on retombe sur `getSingleMatchingTrack` (GetSongBPM + repli
 * extrême) pour terminer, qui garantit qu'on ne reste jamais bloqué.
 */
const buildSegmentTracks = async (segment, config, excludeYoutubeIds, favorites, spotifyTrackPool, historyExcludeIds = []) => {
  // Genre effectif pour CE segment : si la portion a un genre spécifique défini
  // (override manuel à l'étape 3 du wizard), il prime sur le genre global de la
  // séance (config.selectedGenres) — sinon comportement inchangé.
  const effectiveGenres = (segment.selectedGenres && segment.selectedGenres.length > 0) ? segment.selectedGenres : config.selectedGenres;

  // RÉPARTITION PONDÉRÉE ENTRE GENRES : si plusieurs genres sont sélectionnés
  // ENSEMBLE avec des % définis (config.genreWeights), on découpe la durée de CE
  // segment en sous-budgets proportionnels à ces %, et on remplit chaque
  // sous-budget avec UN SEUL genre à la fois (appel récursif de cette même
  // fonction, avec `selectedGenres` réduit à 1 genre — la condition ci-dessous ne
  // se redéclenche donc pas, `effectiveGenres.length` vaudra 1 au rappel). Chaque
  // sous-segment garde le même BPM et la même tolérance que le segment d'origine
  // — seule la DURÉE est répartie, pas le tempo. Volontairement approximatif, pas
  // garanti au titre près : voir executeGeneration pour l'avertissement si l'écart
  // final est important.
  //
  // Ne s'applique QUE sur le genre GLOBAL de la séance (pas sur un override de
  // genre propre à une portion en mode Fractionné) : les % sont configurés pour
  // la sélection globale, un override peut porter sur une liste de genres
  // complètement différente pour laquelle aucun poids n'existe.
  const usingGlobalGenres = !segment.selectedGenres || segment.selectedGenres.length === 0;
  if (usingGlobalGenres && effectiveGenres.length > 1 && config.genreWeights && Object.keys(config.genreWeights).length > 1) {
    let allSelected = [];
    let runningExcludeIds = [...excludeYoutubeIds];
    for (const genre of effectiveGenres) {
      const weight = config.genreWeights[genre];
      if (!weight || weight <= 0) continue; // un genre mis à 0% est simplement ignoré
      const subDurationSeconds = segment.durationSeconds * (weight / 100);
      if (subDurationSeconds < 20) continue; // trop court pour espérer y caser un titre
      const subSegment = { ...segment, durationSeconds: subDurationSeconds, selectedGenres: [genre] };
      const subTracks = await buildSegmentTracks(subSegment, config, runningExcludeIds, favorites, spotifyTrackPool, historyExcludeIds);
      allSelected = [...allSelected, ...subTracks];
      runningExcludeIds = [...runningExcludeIds, ...subTracks.map(t => t.youtubeId)];
    }
    return allSelected;
  }

  const minBpm = segment.bpm - config.bpmTolerance;
  const maxBpm = segment.bpm + config.bpmTolerance;
  const pool = [];
  const seenIds = new Set(excludeYoutubeIds);

  // Filtre de durée : si l'utilisateur n'autorise pas les titres de plus de
  // 6 minutes (option par défaut), on les écarte ici — point de passage central
  // pour TOUTES les sources (favoris, Spotify, Deezer, catalogue d'artistes),
  // pour ne jamais laisser un morceau atypiquement long (ex. "April" de Deep
  // Purple, ~12 min) monopoliser une grosse partie de la séance juste parce
  // qu'il comble bien le temps restant.
  const addIfValid = (t) => {
    if (t && typeof t.bpm === 'number' && t.bpm >= minBpm && t.bpm <= maxBpm && t.duration && t.youtubeId && !seenIds.has(t.youtubeId)) {
      if (!config.allowLongTracks && t.duration > MAX_TRACK_DURATION) return;
      pool.push(t);
      seenIds.add(t.youtubeId); // évite aussi les doublons À L'INTÉRIEUR du pool lui-même
    }
  };

  // Favoris et Spotify : sources déjà en mémoire, aucun appel réseau nécessaire.
  (favorites && Array.isArray(favorites.tracks) ? favorites.tracks : []).forEach(addIfValid);
  (Array.isArray(spotifyTrackPool) ? spotifyTrackPool : []).forEach(addIfValid);

  // Deezer : une recherche PAR GENRE sélectionné, entrelacées round-robin (voir
  // searchDeezerForGenres) pour que chaque genre coché ait une vraie chance d'être
  // représenté, même à beaucoup de genres à la fois. Le BPM de chaque candidat est
  // résolu via `resolveBpmForCandidates` : valeur Deezer si présente, sinon
  // détection audio en direct sur l'extrait (voir plus haut) — beaucoup de titres
  // Deezer n'ont simplement pas de BPM renseigné, ce qui réduisait artificiellement
  // le pool exploitable même quand le titre convenait parfaitement.
  //
  // BOUCLE ADAPTATIVE : une seule page (plafonnée à 25-60 titres détaillés) pouvait
  // être insuffisante pour couvrir une longue séance (marathon, plusieurs heures),
  // forçant un repli local même quand Deezer avait encore de la matière plus loin
  // dans son classement.
  //
  // RAFFINEMENT (après un test réel sur "Métal" seul à 150 BPM : la moitié du pool
  // récupéré était en fait du Rock/Alternative/Pop/Rap, rejeté par la vérification
  // de genre — la boucle s'arrêtait parce qu'elle avait "assez de durée", sans
  // savoir que la moitié de cette durée ne comptait pas vraiment) : le genre de
  // chaque candidat est maintenant résolu ICI, pendant la construction du pool
  // (pas différé à la sélection comme avant), et c'est la durée CUMULÉE DES
  // TITRES QUI CORRESPONDENT VRAIMENT AU GENRE qui sert de critère d'arrêt — pas
  // juste la durée brute BPM-valide. On continue donc à chercher tant que : (a) le
  // pool "bon genre" ne couvre pas encore confortablement la durée du segment, ET
  // (b) la dernière page a apporté de nouveaux titres valides (n'importe lequel,
  // bon ou mauvais genre — un titre hors-genre sert quand même de dernier recours
  // si vraiment rien de mieux n'existe). Coût réseau plus élevé qu'avant (le genre
  // est résolu pour TOUS les candidats BPM-valides, pas seulement les quelques
  // retenus), mais optimisé : l'ID d'album est déjà connu depuis le détail du
  // titre, donc resolveDeezerGenre saute un appel réseau redondant.
  try {
    const genresForQuery = (effectiveGenres && effectiveGenres.length > 0) ? effectiveGenres : ['Autre'];
    const detailFetchCap = Math.min(Math.max(25, genresForQuery.length * 6), 60);
    const seenStubIds = new Set();
    let allResolvedCandidates = [];
    let genreValidDurationSoFar = 0;
    // Cible large (1.5x la durée du segment) : donne à la sélection gloutonne
    // (bin-packing) un vrai choix parmi plusieurs combinaisons possibles, plutôt
    // que tout juste de quoi remplir le segment sans marge.
    const targetPoolDuration = segment.durationSeconds * 1.5;
    const MAX_PAGES = 6; // relevé de 4 à 6 : la vérification de genre est plus stricte que le seul BPM, peut légitimement demander plus de pages pour atteindre une couverture "bon genre" suffisante

    for (let page = 0; page < MAX_PAGES; page++) {
      if (genreValidDurationSoFar >= targetPoolDuration) break; // déjà assez de matière DU BON GENRE

      const stubsByGenre = await Promise.all(genresForQuery.map(async (g) => {
        const keyword = DEEZER_GENRE_KEYWORDS[g] || '';
        const q = `bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"${keyword ? ' ' + keyword : ''}`;
        // Décalage aléatoire dans le classement Deezer, avec repli sur l'index 0
        // si la page est vide (voir searchDeezerPage) — pour explorer une tranche
        // différente à chaque page plutôt que retomber sur les mêmes titres.
        return await searchDeezerPage(q, 40, 150);
      }));
      const newStubs = [];
      for (let i = 0; i < 40; i++) {
        let addedThisRound = false;
        for (const arr of stubsByGenre) {
          if (i < arr.length) {
            const s = arr[i];
            if (!seenStubIds.has(s.id) && !seenIds.has(`deezer-${s.id}`)) { seenStubIds.add(s.id); newStubs.push(s); }
            addedThisRound = true;
          }
        }
        if (!addedThisRound) break;
      }
      if (newStubs.length === 0) break; // plus aucun nouveau titre à explorer, inutile de continuer

      const details = await fetchInBatches(newStubs.slice(0, detailFetchCap), 10, async (s) => {
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${s.id}`);
        return full;
      });
      const resolved = await resolveBpmForCandidates(details.filter(Boolean), minBpm, maxBpm);
      if (resolved.length === 0) break; // cette page n'a rien apporté de valide : le filon semble tari ici

      // Résolution du genre MAINTENANT (pas différée) — voir le raffinement
      // expliqué plus haut. `full.album.id` est déjà connu, donc pas d'appel
      // réseau supplémentaire juste pour le retrouver.
      await fetchInBatches(resolved, 10, async (full) => {
        const albumId = full.album ? full.album.id : null;
        full._resolvedGenre = (await resolveDeezerGenre(full.id, albumId)) || 'Genre inconnu';
        return full;
      });

      allResolvedCandidates.push(...resolved);
      resolved.forEach(t => {
        if (genresForQuery.some(g => genreRoughlyMatches(t._resolvedGenre, g))) {
          genreValidDurationSoFar += (t.duration || 180);
        }
      });
    }

    for (const full of allResolvedCandidates) {
      addIfValid({
        youtubeId: `deezer-${full.id}`, title: full.title,
        artist: full.artist ? full.artist.name : 'Inconnu',
        bpm: full._resolvedBpm, duration: full.duration || 180,
        genre: full._resolvedGenre, _deezerId: full.id, preview: full.preview || null,
        _bpmSource: full._bpmSource
      });
    }
  } catch (e) {
    // Échec silencieux : le pool s'appuiera sur les autres sources (favoris/Spotify/local).
  }

  // CATALOGUE D'ARTISTES (remplace l'ancienne base de titres codés en dur) :
  // recherche Deezer EN DIRECT sur une liste d'artistes représentatifs du genre
  // (ARTIST_CATALOG, voir musicCatalog.js et searchArtistsForBpm) — BPM, durée et
  // extrait viennent tous réellement de Deezer, rien n'est deviné ni à vérifier
  // après coup. Volontairement épargné de l'historique inter-génération
  // (`historyExcludeIds`) : mieux vaut réutiliser un artiste déjà vu dans une
  // génération précédente que de forcer un mauvais genre en élargissant trop.
  // Reste dédoublonné sur LA PLAYLIST EN COURS (pas de titre répété deux fois
  // dans la même séance).
  const localExcludeIds = excludeYoutubeIds.filter(id => !historyExcludeIds.includes(id));
  const validGenres = effectiveGenres && effectiveGenres.length > 0 ? effectiveGenres : ['Métal'];
  // Correspondance artiste → genre D'ORIGINE (voir getSingleMatchingTrack pour le
  // même correctif) : les genres sélectionnés ensemble doivent être traités à
  // ÉGALITÉ pour l'affichage, pas biaisés vers le premier de la liste.
  const artistGenreMap = new Map();
  validGenres.forEach(g => { if (ARTIST_CATALOG[g]) ARTIST_CATALOG[g].forEach(a => { if (!artistGenreMap.has(a)) artistGenreMap.set(a, g); }); });
  let catalogArtists = [...artistGenreMap.keys()];

  if (catalogArtists.length > 0) {
    try {
      const stubs = await searchArtistsForBpm(catalogArtists, minBpm, maxBpm, localExcludeIds, 8, 6);
      const details = await fetchInBatches(stubs.slice(0, 30), 10, async (s) => {
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${s.id}`);
        return full;
      });
      const validDetails = details.filter(f => f && f.bpm && parseFloat(f.bpm) >= minBpm && parseFloat(f.bpm) <= maxBpm && f.preview);
      // VÉRIFICATION DU VRAI GENRE (album Deezer) pour chaque candidat, plutôt
      // que de lui coller tel quel le genre supposé par le catalogue — même
      // correctif que dans `getSingleMatchingTrack` plus haut, pour la même
      // raison : un artiste éclectique (ex. Baby Lasagna, dont les albums vont
      // du Pop au Rock/Alternative chez Deezer) rend faux le raisonnement
      // "l'artiste EST le choix de genre". Sans ça, le garde-fou genre plus bas
      // dans cette fonction (`isDirectGenreMatch`/`genreRoughlyMatches` contre
      // `effectiveGenres`) ne servait à rien pour CES candidats précis : leur
      // champ `genre` valait toujours déjà l'un des genres demandés par
      // construction (`artistGenreMap.get(...) || validGenres[0]`), donc la
      // comparaison était tautologique — elle "matchait" à coup sûr, qu'elle
      // soit vraie ou non. `_genreMismatch` est maintenant posé ici s'il y a
      // lieu, comme pour toutes les autres sources du pool.
      // ⚠️ Coût assumé : jusqu'à 30 appels `resolveDeezerGenre` de plus par
      // segment — mis en cache par album (voir `_deezerAlbumGenreCache`), donc
      // moindre en pratique dès qu'un même album revient sur plusieurs titres,
      // mais réel sur un premier appel. `fetchInBatches` limite déjà le débit
      // (lots de 10, pause 250ms entre lots), comme pour tout le reste du pool.
      await fetchInBatches(validDetails, 10, async (full) => {
        const realGenre = await resolveDeezerGenre(full.id);
        const genreMismatch = !realGenre || !validGenres.some(g => genreRoughlyMatches(realGenre, g));
        // `_isLocalDB` : nom conservé pour la priorité à 4 niveaux ci-dessous
        // (distingue ce filet de secours par artiste des favoris/Spotify — ce
        // sont des choix explicites de l'utilisateur, pas un filet de secours —
        // et du reste de Deezer en recherche généraliste).
        addIfValid({
          youtubeId: `deezer-${full.id}`, title: full.title,
          artist: full.artist ? full.artist.name : 'Inconnu',
          bpm: Math.round(parseFloat(full.bpm)), duration: full.duration || 180,
          genre: realGenre || artistGenreMap.get(full.artist ? full.artist.name : '') || validGenres[0],
          preview: full.preview, _isLocalDB: true,
          ...(genreMismatch ? { _genreMismatch: true } : {})
        });
        return null;
      });
    } catch (e) {
      // Échec silencieux : le pool s'appuiera sur les autres sources.
    }
  }

  // Sélection gloutonne SUR TOUT LE POOL : à chaque étape, on compare le temps
  // restant à TOUS les candidats encore disponibles (pas 2-3), et on retire celui
  // qui s'en rapproche le plus — un vrai "bin packing" plutôt qu'un tirage local.
  //
  // GARDE-FOU GENRE (ajouté après le cas "Stan" d'Eminem retenu dans une playlist
  // Métal/Rock) : la recherche Deezer utilise le genre comme mot-clé flou dans une
  // requête texte, pas comme un filtre strict — un titre peut matcher le BPM sans
  // vraiment correspondre au genre demandé. Le genre de chaque candidat Deezer est
  // déjà résolu PENDANT la construction du pool ci-dessus, donc filtrer par genre
  // ici ne coûte plus rien en réseau.
  //
  // BUG CORRIGÉ (trouvé après un test réel où ~1/3 des titres restaient en repli
  // malgré des candidats du bon genre disponibles ailleurs dans le pool) : la
  // version précédente triait TOUT le pool par proximité de durée, puis
  // n'examinait que les 5 plus proches pour le genre — abandonnant si ces 5-là
  // étaient mauvais, même si un bon candidat existait plus loin dans la liste
  // triée par durée. Le bon ordre est l'inverse : d'abord filtrer TOUT le pool
  // pour ne garder que les titres du bon genre (gratuit, déjà résolu), PUIS
  // trier par proximité de durée à l'intérieur de ce sous-ensemble. Si vraiment
  // aucun candidat du pool n'a le bon genre, on retombe sur le pool complet
  // (mieux qu'un trou dans la playlist), marqué `_genreMismatch`.
  //
  // PRIORITÉ RAFFINÉE UNE 2E FOIS (sur demande explicite : "je veux que Deezer en
  // direct soit toujours privilégié sur mon catalogue codé en dur, qui ne doit
  // servir qu'en dernier recours dans sa propre catégorie") — 4 niveaux maintenant :
  //   1. FAVORIS/Spotify : choix explicites de l'utilisateur, jamais concurrencés.
  //   2. Deezer EN DIRECT, genre confirmé : la vraie source "fraîche", privilégiée
  //      sur le catalogue local même quand les deux ont un genre tout aussi valide.
  //   3. CATALOGUE LOCAL (déjà vérifié par Deezer, voir plus haut) : utilisé
  //      SEULEMENT si Deezer en direct n'a pas assez de candidats pour ce segment.
  //   4. Équivalence uniquement (Rock accepté pour Métal) : dernier filet avant
  //      le repli "genre non confirmé".
  const selected = [];
  let remaining = segment.durationSeconds;
  let availablePool = [...pool];

  while (remaining > 30 && availablePool.length > 0) {
    // GARDE-FOU TITRE (trouvé après un test réel : "Let Her Go (Selecta Hardstyle
    // Remix Edit)" accepté comme Métal/Rock parce que l'album d'origine était
    // classé ainsi chez Deezer, alors que le titre dit explicitement "hardstyle"
    // — voir detectTitleStyleConflict) : appliqué à toutes les sources SAUF les
    // favoris explicites (choix délibéré de l'utilisateur, jamais annulé par un
    // mot dans le titre).
    const titleConflictFree = (t) => (!t._deezerId && !t._isLocalDB) || !detectTitleStyleConflict(t.title, effectiveGenres);
    const favoritesPool = availablePool.filter(t => !t._deezerId && !t._isLocalDB);
    const deezerDirectPool = availablePool.filter(t => t._deezerId && titleConflictFree(t) && effectiveGenres.some(g => isDirectGenreMatch(t.genre, g)));
    const localPoolMatches = availablePool.filter(t => t._isLocalDB && titleConflictFree(t));
    const equivalencePool = availablePool.filter(t => t._deezerId && titleConflictFree(t) && !deezerDirectPool.includes(t) && effectiveGenres.some(g => genreRoughlyMatches(t.genre, g)));

    let searchPool, matchLevel;
    if (favoritesPool.length > 0) { searchPool = favoritesPool; matchLevel = 'favoris'; }
    else if (deezerDirectPool.length > 0) { searchPool = deezerDirectPool; matchLevel = 'deezer-direct'; }
    else if (localPoolMatches.length > 0) { searchPool = localPoolMatches; matchLevel = 'local'; }
    else if (equivalencePool.length > 0) { searchPool = equivalencePool; matchLevel = 'equivalence'; }
    else { searchPool = availablePool; matchLevel = 'none'; }

    searchPool.sort((a, b) => Math.abs(a.duration - remaining) - Math.abs(b.duration - remaining));
    const pick = searchPool[0];

    if (matchLevel === 'none') {
      pick._genreMismatch = true;
      pick._isFallback = true;
    }

    availablePool = availablePool.filter(t => t !== pick);
    selected.push(pick);
    remaining -= pick.duration;
  }

  // Le pool s'est épuisé avant d'atteindre la durée cible (rare, mais possible sur
  // un BPM/genre très restrictif) : on termine avec l'ancien moteur au coup par
  // coup, qui sait déjà gérer ce cas (Deezer à tolérance élargie puis repli
  // extrême local). Ces titres sont marqués `_isFallback` : le pool de candidats
  // "de qualité" n'a pas suffi, donc ce qui suit peut être moins bien ajusté —
  // information transmise à l'utilisateur après génération (voir createPlaylistData).
  while (remaining > 30) {
    const usedSoFar = [...excludeYoutubeIds, ...selected.map(t => t.youtubeId)];
    const extra = await getSingleMatchingTrack(segment.bpm, config.bpmTolerance, effectiveGenres, usedSoFar, favorites, spotifyTrackPool, remaining, historyExcludeIds, config.allowLongTracks);
    extra._isFallback = true;
    selected.push(extra);
    remaining -= extra.duration;
  }

  // Filet de sécurité ultime : un segment ne doit jamais rester totalement vide.
  if (selected.length === 0) {
    const extra = await getSingleMatchingTrack(segment.bpm, config.bpmTolerance, effectiveGenres, excludeYoutubeIds, favorites, spotifyTrackPool, segment.durationSeconds, historyExcludeIds, config.allowLongTracks);
    extra._isFallback = true;
    selected.push(extra);
  }

  // Le genre ET la vérification/extrait des titres locaux sont maintenant résolus
  // EN AMONT, avant même la sélection (voir plus haut) — plus rien à faire après coup ici.
  selected.forEach(t => { delete t._deezerId; delete t._isLocalDB; });

  return selected;
};

/**
 * Recalcule les horodatages de démarrage de chaque morceau (startTimeStr,
 * startDistVal) et la durée totale de la playlist, en tenant compte du
 * crossfade (chaque morceau, sauf le dernier, "mange" `crossfade` secondes
 * sur le suivant pour créer un enchaînement sans blanc). Pure — déplacée
 * depuis App.jsx, aucune logique changée. À rappeler après toute
 * modification de la liste de morceaux (ajout, suppression, remplacement) ;
 * App.jsx continue de l'appeler à tous ces endroits, juste importée d'ici.
 */
const recalculateTimeline = (playlistToUpdate) => {
  let accSecs = 0;
  const avgPaceSecs = playlistToUpdate.avgPace || 330;
  const fadeSecs = playlistToUpdate.crossfade || 0;

  const updatedTracks = playlistToUpdate.tracks.map((t, idx) => {
     let startDist = accSecs / avgPaceSecs;
     const updatedTrack = {
         ...t,
         startTimeStr: formatDuration(Math.max(0, accSecs)),
         startDistVal: Math.round(startDist * 100) / 100 // nombre, PAS .toFixed() qui renvoie une chaîne (cassait l'axe "Distance" du graphique)
     };
     accSecs += t.duration;
     if (idx < playlistToUpdate.tracks.length - 1) {
         accSecs -= fadeSecs;
     }
     return updatedTrack;
  });

  return {
     ...playlistToUpdate,
     tracks: updatedTracks,
     totalDuration: Math.max(0, accSecs)
  };
};

/**
 * Cœur de `handleReplaceTrackSameArtist` (App.jsx) — cherche un autre titre du
 * MÊME artiste correspondant au BPM cible (recherche Deezer combinée
 * artist:/bpm_min/bpm_max), avec les mêmes garde-fous que le reste du moteur
 * (durée, conflit de titre, vérification de genre par équivalence, jusqu'à 5
 * essais avant repli sur le premier candidat avec `_genreMismatch: true`).
 *
 * Pure : aucun setState, aucune lecture de state React. Renvoie `null` si
 * aucun titre de cet artiste n'a été trouvé dans la fourchette BPM — à
 * l'appelant de retomber sur `getSingleMatchingTrack` (recherche large) dans
 * ce cas, comme le faisait déjà App.jsx.
 *
 * Extrait de App.jsx suite à la demande explicite de découpage des grosses
 * fonctions de recherche/génération en fichiers utilitaires séparés (même
 * chantier que fetchWorldSearchResults/fetchBpmSearchResults dans
 * searchEngine.js, et createPlaylistData ci-dessous) — laissé dans
 * musicEngine.js plutôt que searchEngine.js : ceci concerne le remplacement
 * d'un titre DANS une playlist déjà générée, pas la recherche manuelle libre.
 */
const findSameArtistReplacement = async (artistName, minBpm, maxBpm, excludeYoutubeIds, requestedGenres, allowLongTracks = false) => {
  try {
    const q = `artist:"${artistName}" bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"`;
    const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`);
    const stubs = (data && Array.isArray(data.data) ? data.data : []).filter(s => !excludeYoutubeIds.includes(`deezer-${s.id}`));
    if (stubs.length === 0) return null;

    const details = await Promise.all(stubs.map(async (s) => {
      const { data: full } = await deezerFetch(`https://api.deezer.com/track/${s.id}`);
      return full;
    }));
    let valid = details.filter(f => f && f.bpm && parseFloat(f.bpm) >= minBpm && parseFloat(f.bpm) <= maxBpm);
    if (!allowLongTracks) valid = valid.filter(f => (f.duration || 0) <= MAX_TRACK_DURATION);
    valid = valid.filter(f => !detectTitleStyleConflict(f.title, requestedGenres));
    valid = valid.sort(() => Math.random() - 0.5);

    // Même garde-fou genre que le reste du moteur : même en restant sur le MÊME
    // artiste, un artiste peut avoir des titres de genres différents
    // (featurings, évolution de style...) — on vérifie avant de valider,
    // jusqu'à 5 essais parmi les candidats déjà récupérés.
    let pick = null;
    let genreMismatch = false;
    const attempted = [];
    for (let attempt = 0; attempt < Math.min(5, valid.length); attempt++) {
      const candidate = valid[attempt];
      const realGenre = await resolveDeezerGenre(candidate.id);
      candidate._resolvedGenre = realGenre || 'Genre inconnu';
      attempted.push(candidate);
      if (requestedGenres.some(g => genreRoughlyMatches(realGenre, g))) { pick = candidate; break; }
    }
    if (!pick && attempted.length > 0) { pick = attempted[0]; genreMismatch = true; }
    if (!pick) return null;

    return {
      title: pick.title, artist: pick.artist ? pick.artist.name : artistName,
      genre: pick._resolvedGenre || 'Genre inconnu', bpm: Math.round(parseFloat(pick.bpm)), duration: pick.duration || 180,
      youtubeId: `deezer-${pick.id}`, preview: pick.preview || null,
      ...(genreMismatch ? { _genreMismatch: true, _isFallback: true } : {})
    };
  } catch (e) {
    // Échec silencieux : l'appelant retombe sur la recherche large (voir docstring).
    return null;
  }
};

/**
 * deduceCrescendoBpm — calcule le BPM par défaut de l'échauffement et du
 * retour au calme à partir du seul BPM cible (celui du "cœur de séance").
 * C'est la valeur "intelligence par défaut" du mode Crescendo : l'utilisateur
 * n'a qu'un seul BPM à régler (le pic) au départ, l'algorithme déduit tout
 * seul le reste (-30 pour l'échauffement, encore -15 pour le retour au
 * calme, arrondis au multiple de 5 le plus proche pour rester lisible).
 * Exportée séparément de `buildCrescendoSegments` pour être réutilisée par
 * l'UI (GeneratorView) au moment où l'utilisateur bascule en mode "Ajuster
 * manuellement" : on veut initialiser les 2 curseurs experts sur CES valeurs
 * déduites, pas sur un défaut arbitraire différent.
 *
 * Pure, aucune dépendance au reste du moteur.
 */
const deduceCrescendoBpm = (mainBpm, bpmFloor = 80) => {
  const roundTo5 = (v) => Math.round(v / 5) * 5;
  const main = parseInt(mainBpm) || 120;
  const warmupBpm = Math.max(bpmFloor, roundTo5(main - 30));
  const cooldownBpm = Math.max(bpmFloor, roundTo5(warmupBpm - 15));
  return { warmupBpm, cooldownBpm };
};

/**
 * buildCrescendoSegments — génère automatiquement 3 segments (Échauffement /
 * Cœur de séance / Retour au calme) pour le mode "Crescendo" du wizard, en
 * réutilisant tel quel le moteur de segments déjà construit pour le mode
 * Fractionné : le tableau renvoyé a exactement la même forme qu'un tableau de
 * segments saisis à la main (`{ id, bpm, durationValue }`), donc
 * `createPlaylistData` n'a besoin d'aucune modification pour le consommer.
 *
 * Pure : aucun setState, aucune lecture de state React — reçoit tout en
 * paramètres (mêmes valeurs que l'étape 2/3 du wizard : bpm cible, durée ou
 * distance, allure, + les 2 curseurs échauffement/retour au calme de l'étape
 * 3), renvoie un tableau de segments.
 *
 * `warmupPct`/`cooldownPct` : réglables par l'utilisateur via les 2 poignées
 * du curseur double de l'étape 3 (voir GeneratorView) — PAS des ratios fixes
 * imposés par l'algorithme. Le cœur de séance obtient le reste
 * (100 - warmupPct - cooldownPct). Fonctionne à l'identique en mode Temps ou
 * Distance : les % s'appliquent à la durée totale calculée (une distance est
 * d'abord convertie en minutes via l'allure, voir `unitPaceSecs`), donc
 * l'utilisateur raisonne toujours en "part de sa séance", jamais en minutes
 * absolues à recalculer lui-même.
 *
 * `manualWarmupBpm`/`manualCooldownBpm` (divulgation progressive — décision
 * explicite avec l'utilisateur) : `null` par défaut → le BPM de ces 2 phases
 * est DÉDUIT automatiquement du BPM cible (voir `deduceCrescendoBpm`).
 * L'utilisateur peut écraser l'une ou l'autre valeur (ou les deux) via le
 * mode "Ajuster manuellement" de l'étape 3 — dans ce cas, la valeur fournie
 * ici prime purement et simplement sur le calcul automatique.
 *
 * En dessous de 10 minutes au total, distinguer 3 phases n'a plus de sens
 * (portions ridiculement courtes) : un seul segment au BPM cible, comme en
 * mode Allure Constante — quels que soient warmupPct/cooldownPct/les
 * éventuels overrides manuels de BPM.
 *
 * `bpmFloor` : plancher BPM (80 en mode standard, 40 en mode Intime — mêmes
 * bornes que le curseur BPM de l'étape 3) pour ne jamais proposer un
 * échauffement/retour au calme à un BPM absurdement bas, y compris si
 * l'utilisateur force manuellement une valeur trop basse.
 */
const buildCrescendoSegments = (targetMode, bpm, hours, minutes, distanceVal, paceMin, paceSec, bpmFloor = 80, warmupPct = 15, cooldownPct = 15, manualWarmupBpm = null, manualCooldownBpm = null) => {
  const unitPaceSecs = (parseInt(paceMin) || 0) * 60 + (parseInt(paceSec) || 0) || 330;
  const totalMinutes = targetMode === 'distance'
    ? ((parseFloat(distanceVal) || 0) * unitPaceSecs) / 60
    : (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

  const mainBpm = parseInt(bpm) || 120;
  const deduced = deduceCrescendoBpm(mainBpm, bpmFloor);
  const warmupBpm = manualWarmupBpm != null ? Math.max(bpmFloor, parseInt(manualWarmupBpm) || bpmFloor) : deduced.warmupBpm;
  const cooldownBpm = manualCooldownBpm != null ? Math.max(bpmFloor, parseInt(manualCooldownBpm) || bpmFloor) : deduced.cooldownBpm;

  // Distance/durée cible en unité "durationValue" (minutes en mode temps,
  // km/mi en mode distance) — la conversion inverse de celle utilisée dans
  // createPlaylistData, pour rester dans le même référentiel que les
  // segments saisis à la main.
  const toDurationValue = (mins) => targetMode === 'distance'
    ? Math.round((mins * 60 / unitPaceSecs) * 100) / 100
    : mins;

  if (totalMinutes < 10) {
    return [{ id: 1, bpm: mainBpm, durationValue: toDurationValue(totalMinutes) }];
  }

  // GeneratorView contraint déjà warmupPct + cooldownPct à laisser au moins
  // 10% au cœur de séance (voir MIN_MAIN_PCT), mais on reclamp ici quand même
  // — cette fonction doit rester sûre même appelée avec des valeurs qui
  // n'auraient pas transité par ce garde-fou (ex. routine importée/éditée à
  // la main dans le localStorage).
  const safeWarmupPct = Math.max(0, Math.min(90, warmupPct));
  const safeCooldownPct = Math.max(0, Math.min(90 - safeWarmupPct, cooldownPct));

  const warmupMin = (totalMinutes * safeWarmupPct) / 100;
  const cooldownMin = (totalMinutes * safeCooldownPct) / 100;
  const mainMin = totalMinutes - warmupMin - cooldownMin;

  // Une portion à 0% (poignée poussée jusqu'au bout) n'a plus de raison
  // d'exister comme segment séparé — on la retire plutôt que de générer un
  // segment de durée nulle, que le moteur de génération gérerait mal.
  const result = [];
  if (warmupMin >= 0.5) result.push({ id: 1, bpm: warmupBpm, durationValue: toDurationValue(warmupMin), _crescendoLabel: 'Échauffement' });
  result.push({ id: 2, bpm: mainBpm, durationValue: toDurationValue(mainMin), _crescendoLabel: 'Cœur de séance' });
  if (cooldownMin >= 0.5) result.push({ id: 3, bpm: cooldownBpm, durationValue: toDurationValue(cooldownMin), _crescendoLabel: 'Retour au calme' });
  return result;
};

/**
 * Génère une playlist complète à partir d'une config de wizard/routine.
 * 1. Découpe la séance en "segments" (1 seul segment en mode simple, un par
 *    portion en mode fractionné), chacun avec un BPM cible et une durée en secondes.
 * 2. Pour chaque segment, pioche des morceaux via buildSegmentTracks jusqu'à
 *    couvrir la durée du segment, en évitant les doublons (usedYoutubeIds) au
 *    sein de la playlist entière.
 * 3. Calcule un nom de playlist selon le mode (naughty / fractionné / routine...).
 * 4. Recalcule la timeline finale (horodatages, durée totale) avant de renvoyer l'objet.
 *
 * Déplacée depuis App.jsx (découpage des grosses fonctions de génération).
 * Différence avec l'original : `favorites`, `spotifyTrackPool` et
 * `isNaughtyMode` — lus depuis le state d'App.jsx par simple fermeture dans
 * la version d'origine — sont maintenant des paramètres explicites. C'est ce
 * qui rend cette fonction 100% pure et déplaçable ici sans rien changer
 * d'autre : aucune autre dépendance au state React n'existait dans son corps.
 *
 * `initialExcludeIds` : titres à exclure DÈS LE DÉPART (pas seulement au sein
 * de cette playlist) — utilisé par `executeGeneration` (resté dans App.jsx)
 * pour éviter de répéter des titres déjà utilisés lors de générations
 * précédentes de la même routine (voir `routine.recentTrackIds`), en plus des
 * doublons internes à la playlist elle-même.
 */
const createPlaylistData = async (config, initialExcludeIds = [], favorites, spotifyTrackPool, isNaughtyMode) => {
  let activeSegments = [];
  const unitPaceSecs = config.targetMode === 'distance' ? ((parseInt(config.paceMin)||0)*60 + (parseInt(config.paceSec)||0)) : 330;

  if (config.isIntervalMode) {
    activeSegments = config.segments.map(s => {
      let durationSecs = s.durationValue * (config.targetMode === 'distance' ? unitPaceSecs : 60);
      // selectedGenres transmis tel quel : undefined/vide = pas d'override, le
      // segment utilisera le genre global de la séance (voir buildSegmentTracks).
      return { bpm: s.bpm, durationSeconds: durationSecs, selectedGenres: s.selectedGenres };
    });
  } else {
    let durationSecs = config.targetMode === 'distance'
       ? config.distanceVal * unitPaceSecs
       : config.hours * 3600 + config.minutes * 60;
    activeSegments = [{ bpm: config.bpm, durationSeconds: durationSecs }];
  }

  const tracks = [];
  let idCounter = 1;
  const usedYoutubeIds = [...initialExcludeIds];
  let fallbackCount = 0; // titres pour lesquels le pool de candidats de qualité n'a pas suffi

  for (let segmentIndex = 0; segmentIndex < activeSegments.length; segmentIndex++) {
      let segment = activeSegments[segmentIndex];
      // Construit tout l'ensemble des titres de ce segment d'un coup, en visant sa
      // durée cible comme un problème de "somme de sous-ensemble" (voir
      // buildSegmentTracks) — plutôt que d'ajouter des morceaux un par un sans
      // vue d'ensemble, ce qui pouvait faire largement dépasser la cible.
      const segmentTracks = await buildSegmentTracks(segment, config, usedYoutubeIds, favorites, spotifyTrackPool, initialExcludeIds);
      segmentTracks.forEach((randomTrack) => {
          if (randomTrack._isFallback) fallbackCount++;
          tracks.push({
              id: `track-${idCounter++}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              segmentIndex: segmentIndex + 1, targetSegmentBpm: segment.bpm,
              title: randomTrack.title, artist: randomTrack.artist, genre: randomTrack.genre,
              bpm: randomTrack.bpm, duration: randomTrack.duration, youtubeId: randomTrack.youtubeId,
              preview: randomTrack.preview || null, // extrait audio 30s si disponible (Favoris/Spotify/Deezer)
              // BUG CORRIGÉ : ces deux marqueurs n'étaient jamais copiés ici, alors
              // que c'est CET objet (pas `randomTrack`) qui finit dans la playlist
              // affichée — le badge "⚠️ Genre non confirmé" ne pouvait donc
              // JAMAIS s'afficher, peu importe si la vérification de genre avait
              // réellement détecté un problème ou non.
              _genreMismatch: randomTrack._genreMismatch || false,
              _isFallback: randomTrack._isFallback || false,
          });
          usedYoutubeIds.push(randomTrack.youtubeId);
      });
  }

  const finalWorkoutName = isNaughtyMode ? 'Ambiance' : config.workoutName;
  let generatedName = isNaughtyMode ? `Moment Intime` : (config.isCrescendoMode ? `Crescendo : ${finalWorkoutName}` : (config.isIntervalMode ? `Fractionné : ${finalWorkoutName}` : `Session ${finalWorkoutName}`));
  if (config.routineName) generatedName = `Depuis : ${config.routineName}`;

  const rawPlaylist = {
    id: `pl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: generatedName, workoutType: finalWorkoutName,
    avgPace: unitPaceSecs, targetMode: config.targetMode, distanceUnit: config.distanceUnit || 'km',
    tolerance: config.bpmTolerance, crossfade: config.crossfade || 0,
    tracks: tracks, isNaughty: isNaughtyMode, fallbackTrackCount: fallbackCount,
    coverIcon: config.coverIcon || '🎧', createdAt: new Date().toLocaleDateString(),
    status: 'pending', actualDataByDate: {}, config: { ...config }
  };

  return recalculateTimeline(rawPlaylist);
};

export {
  safeFetchJson,
  deezerFetch,
  resolveDeezerGenre,
  detectBpmFromPreview,
  resolveBpmForCandidates,
  MAX_TRACK_DURATION,
  pickByDurationProximity,
  searchArtistsForBpm,
  fetchInBatches,
  searchDeezerPage,
  searchDeezerForGenres,
  getSingleMatchingTrack,
  buildSegmentTracks,
  deduceCrescendoBpm,
  buildCrescendoSegments,
  findSameArtistReplacement,
  recalculateTimeline,
  createPlaylistData
};
