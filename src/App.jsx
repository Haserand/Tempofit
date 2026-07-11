import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Clock, Music, Save, Play, List, Plus, Check, Settings, Trash2, Pause, Search, X, Footprints, Flame, Heart, SlidersHorizontal, ListPlus, Loader2, User, Star, AlertCircle, Link as LinkIcon, Zap, BookmarkPlus, Menu, RefreshCw, Globe, Share2, Image as ImageIcon, Info, PlaySquare, Edit3, Copy, CheckCircle, Circle, Layers, Trophy, Award, MapPin, Upload, ChevronRight, ChevronLeft, Target, History, MessageCircle, ExternalLink, GripVertical, MoreVertical } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine, ReferenceArea, PieChart, Pie, Cell } from 'recharts';
import { DATABASE_MUSIQUES, STANDARD_GENRES, NAUGHTY_GENRES, EXTRA_GENRES, DEEZER_GENRE_KEYWORDS, getGenreLocalDepthWarning } from './musicCatalog';
import { TROPHIES_DATA, NAUGHTY_ROUTINE_NAMES, WORKOUT_TYPES, NAUGHTY_WORKOUT_LABELS, NAUGHTY_WORKOUT_ICONS, NAUGHTY_WORKOUT_ORDER, WORKOUT_DEFAULT_BPM, WORKOUT_DEFAULT_TARGET, AVAILABLE_ICONS, AUTO_GEN_OPTIONS } from './appConfig';

// =====================================================================================
// CONSTANTES GLOBALES & CONFIGURATION
// =====================================================================================

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_BASE = 'https://accounts.spotify.com/authorize?';
const SPOTIFY_TOKEN_BASE = 'https://accounts.spotify.com/api/token';

// --- CLÉ API GETSONGBPM ---
// Déplacée côté serveur (api/getsongbpm.js) : la clé n'apparaît plus du tout dans
// ce fichier ni dans le bundle envoyé au navigateur. Elle doit être configurée
// comme variable d'environnement Vercel (GETSONGBPM_API_KEY) sur le projet.
// ⚠️ L'ancienne clé codée en dur ici a circulé en clair dans les commits Git
// précédents — même retirée du code, elle reste visible dans l'historique du
// dépôt. Vaut le coup de la régénérer côté GetSongBPM plutôt que de considérer
// le problème réglé par ce seul changement.
// Configuration applicative (trophées, types d'activité, libellés/icônes du mode
// Intime, valeurs par défaut du wizard, icônes de routine...) : voir appConfig.js
// (importé en haut de ce fichier).

// NOTE : un système `TRANSLATIONS`/`const t = TRANSLATIONS['fr']` existait ici,
// mais n'était utilisé qu'à UN SEUL endroit (`t.tooltipMemorize` plus bas) alors
// que tout le reste de l'app — des centaines de textes — est directement en
// français codé en dur dans le JSX. Ça ressemblait à un début de système de
// traduction jamais poursuivi. Retiré pour rester cohérent avec le reste : le
// texte est maintenant écrit en dur à son unique point d'usage.

// =====================================================================================
// MOTEUR DE SÉLECTION MUSICALE PAR BPM
// =====================================================================================

/**
 * Trouve UN morceau dont le BPM correspond à `targetBpm` (± tolerance).
 * Stratégie en cascade, du plus pertinent/personnel au plus générique — mise à
 * jour pour refléter la cascade RÉELLE actuelle (ce commentaire avait fini par
 * décrire une version périmée du code après plusieurs réécritures successives) :
 *
 *   1. Priorité ABSOLUE aux morceaux mis en Favoris par l'utilisateur (`favorites.tracks`)
 *      — ce sont des choix explicites, donc plus fiables que tout le reste.
 *   1.5. Recherche Deezer sur tes artistes favoris (`favorites.artists`) dans la
 *      fourchette de BPM demandée — sans cette étape, "Top Artistes" n'avait aucun
 *      effet réel sur la génération, uniquement un rôle d'affichage.
 *   2. Puis les morceaux de la bibliothèque Spotify synchronisée (`spotifyTrackPool`),
 *      déjà analysés en BPM via `resolveRealBPM`.
 *   3. Une recherche Deezer en direct, tolérance exacte (`searchDeezerForGenres`,
 *      multi-genres, BPM résolu via `resolveBpmForCandidates` — valeur Deezer si
 *      connue, sinon détection audio en direct sur l'extrait, voir
 *      `detectBpmFromPreview`) : prioritaire sur la base locale statique car elle
 *      fournit un extrait audio écoutable, contrairement aux morceaux codés en dur.
 *   3.5. Deezer à nouveau, tolérance ÉLARGIE (×2, plafonnée à ±40 BPM) : un vrai
 *      titre écoutable légèrement hors tempo sert mieux l'usage réel qu'un repli
 *      qui ne s'écoute pas du tout — priorité délibérée sur la base locale.
 *   4. Si Deezer ne renvoie toujours rien (ni exact, ni élargi), on pioche dans la
 *      base locale (`DATABASE_MUSIQUES`), filtrée par genres sélectionnés, à
 *      tolérance exacte. Cette base est exemptée de l'historique inter-génération
 *      (`historyExcludeIds`) — trop réduite pour servir de source de "nouveauté"
 *      sans se vider — mais reste dédoublonnée sur la playlist en cours.
 *   5. En tout dernier recours (GetSongBPM RETIRÉ de cette cascade : durée
 *      inventée, jamais d'extrait, artiste souvent "Inconnu" — moins fiable que
 *      ce qui suit), on retourne le morceau LOCAL dont le BPM est le plus proche
 *      de la cible, même hors tolérance — d'abord dans le genre demandé, puis
 *      élargi à toute la base si besoin — pour ne jamais laisser un "trou" dans
 *      la playlist générée.
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
const resolveDeezerGenre = async (deezerTrackId) => {
  try {
    const { data: trackData } = await deezerFetch(`https://api.deezer.com/track/${deezerTrackId}`);
    const albumId = trackData && trackData.album ? trackData.album.id : null;
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

const searchDeezerForGenres = async (genresForQuery, minBpm, maxBpm, excludeYoutubeIds, preferredDuration, candidateCap) => {
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
  const validCandidates = await resolveBpmForCandidates(detailedCandidates.filter(Boolean), minBpm, maxBpm);
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
    if (genresForQuery.some(g => genreRoughlyMatches(realGenre, g))) {
      full = candidate;
      break;
    }
  }
  if (!full) {
    full = attempted[0] || ordered[0];
    genreMismatch = true;
  }

  return {
    youtubeId: `deezer-${full.id}`,
    title: full.title,
    artist: full.artist ? full.artist.name : 'Inconnu',
    bpm: full._resolvedBpm,
    duration: full.duration || 180,
    isEmbeddable: true,
    genre: full._resolvedGenre || 'Genre inconnu',
    preview: full.preview || null,
    _bpmSource: full._bpmSource,
    ...(genreMismatch ? { _genreMismatch: true, _isFallback: true } : {})
  };
};

const getSingleMatchingTrack = async (targetBpm, tolerance, selectedGenres, excludeYoutubeIds = [], favorites = null, spotifyTrackPool = [], preferredDuration = null, historyExcludeIds = []) => {
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
  //      dans la fourchette de BPM demandée (filtre combiné artist:/bpm_min/bpm_max).
  //      Limité à 3 artistes tirés au hasard par appel pour contenir le nombre de
  //      requêtes réseau (un utilisateur peut avoir des dizaines d'artistes favoris).
  if (favorites && Array.isArray(favorites.artists) && favorites.artists.length > 0) {
    try {
      const sampledArtists = [...favorites.artists].sort(() => Math.random() - 0.5).slice(0, 3);
      const stubsByArtist = await Promise.all(sampledArtists.map(async (artistName) => {
        const q = `artist:"${artistName}" bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"`;
        const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
        const stubs = (data && Array.isArray(data.data)) ? data.data : [];
        return stubs.filter(s => !excludeYoutubeIds.includes(`deezer-${s.id}`));
      }));
      const candidateStubs = stubsByArtist.flat();
      if (candidateStubs.length > 0) {
        const pick = candidateStubs[Math.floor(Math.random() * candidateStubs.length)];
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${pick.id}`);
        if (full && full.bpm && parseFloat(full.bpm) >= minBpm && parseFloat(full.bpm) <= maxBpm) {
          const realGenre = await resolveDeezerGenre(full.id);
          return {
            youtubeId: `deezer-${full.id}`,
            title: full.title,
            artist: full.artist ? full.artist.name : 'Inconnu',
            bpm: Math.round(parseFloat(full.bpm)),
            duration: full.duration || 180,
            isEmbeddable: true,
            genre: realGenre || 'Genre inconnu',
            preview: full.preview || null
          };
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

  // 3. DEEZER EN DIRECT, tolérance exacte : mot-clé de CHAQUE genre sélectionné, une
  //    recherche par genre entrelacée round-robin (voir searchDeezerForGenres) —
  //    prioritaire sur la base locale statique car Deezer/la détection audio
  //    fournissent un extrait écoutable, ce que DATABASE_MUSIQUES ne peut jamais offrir.
  const genresForQuery = (selectedGenres && selectedGenres.length > 0) ? selectedGenres : ['Autre'];
  const candidateCap = Math.min(Math.max(8, genresForQuery.length * 3), 24);
  try {
    const exactMatch = await searchDeezerForGenres(genresForQuery, minBpm, maxBpm, excludeYoutubeIds, preferredDuration, candidateCap);
    if (exactMatch) return exactMatch;
  } catch (e) {
    // Échec silencieux (proxy indisponible, hors-ligne...) : on continue vers la tentative suivante.
  }

  // 3.5. DEEZER, TOLÉRANCE ÉLARGIE : changement de priorité délibéré. Avant de
  //      sacrifier l'écoute (base locale, jamais d'extrait), on retente Deezer avec
  //      une fenêtre BPM doublée (plafonnée à ±40 BPM d'écart max) — un vrai titre
  //      écoutable légèrement hors tempo sert mieux l'usage réel qu'un repli qui ne
  //      s'écoute pas du tout. Marqué `_isFallback`.
  try {
    const widenedTolerance = Math.min(tolerance * 2, 40);
    const widenedMatch = await searchDeezerForGenres(genresForQuery, targetBpm - widenedTolerance, targetBpm + widenedTolerance, excludeYoutubeIds, preferredDuration, candidateCap);
    if (widenedMatch) return { ...widenedMatch, _isFallback: true };
  } catch (e) {
    // Échec silencieux : on continue vers le fallback local.
  }

  // 4. BACKUP LOCAL, tolérance exacte : Deezer n'a rien donné (ni exact, ni élargi).
  //    Cette base est exemptée de l'historique inter-génération (`historyExcludeIds`)
  //    — trop réduite pour servir de source de "nouveauté" sans se vider — mais reste
  //    dédoublonnée SUR LA PLAYLIST EN COURS.
  let availableTracks = [];
  const validGenres = selectedGenres.length > 0 ? selectedGenres : ['Métal'];
  const localExcludeIds = excludeYoutubeIds.filter(id => !historyExcludeIds.includes(id));

  validGenres.forEach(g => {
    if (DATABASE_MUSIQUES[g]) availableTracks = [...availableTracks, ...DATABASE_MUSIQUES[g].map(t => ({...t, genre: g}))];
  });
  if (availableTracks.length === 0) availableTracks = DATABASE_MUSIQUES['Pop'].map(t => ({...t, genre: 'Pop'}));

  let suitable = availableTracks.filter(t => t.bpm >= minBpm && t.bpm <= maxBpm && !localExcludeIds.includes(t.youtubeId));

  if (suitable.length > 0) {
      return pickByDurationProximity(suitable, preferredDuration);
  }

  // GetSongBPM SUPPRIMÉ ICI (ancienne étape 5) : ne fournissait jamais d'extrait
  // écoutable, inventait une durée aléatoire, et donnait souvent un artiste
  // "Inconnu" — moins fiable que le repli extrême ci-dessous (vrai titre, vraie
  // durée, juste hors tolérance BPM), qui est de toute façon garanti non-vide.

  // 5. FALLBACK EXTRÊME (dernier recours) :
  //    On cherche parmi les morceaux locaux dont le BPM est le plus proche de la cible,
  //    tolérance ignorée. Trois corrections par rapport à l'ancienne version :
  //      - Si le genre sélectionné est épuisé (tous ses titres déjà utilisés dans la
  //        playlist), on élargit à TOUTE la base locale plutôt que de retomber sur un
  //        pool vide qui forçait la réutilisation du même titre.
  //      - Le choix final est aléatoire PARMI les 3 titres les plus proches en BPM,
  //        plutôt que strictement déterministe (toujours LE plus proche) — c'est ce
  //        déterminisme qui causait des répétitions en boucle du même titre une fois
  //        le stock épuisé (ex. "Duality" répété 10 fois d'affilée).
  //      - BUG CORRIGÉ : cette étape utilisait `excludeYoutubeIds` (qui inclut
  //        l'historique inter-génération) au lieu de `localExcludeIds` (qui l'exempte).
  //        Résultat concret observé : au bout de quelques générations, les titres
  //        locaux du genre demandé finissaient tous marqués "déjà utilisés" par
  //        l'historique, et le code élargissait alors à TOUT le catalogue local
  //        (Country, R&B, Electro...) au lieu de rester sur le genre sélectionné —
  //        exactement le genre de fuite que l'exemption d'historique était censée
  //        éviter, oubliée sur cette seule étape.
  let fallbackPool = availableTracks.filter(t => !localExcludeIds.includes(t.youtubeId));
  if (fallbackPool.length === 0) {
    const allTracksFlat = [];
    Object.keys(DATABASE_MUSIQUES).forEach(g => DATABASE_MUSIQUES[g].forEach(t => allTracksFlat.push({...t, genre: g})));
    fallbackPool = allTracksFlat.filter(t => !localExcludeIds.includes(t.youtubeId));
    if (fallbackPool.length === 0) fallbackPool = allTracksFlat; // vraiment tout épuisé : on autorise la répétition en tout dernier recours
  }
  const sortedByProximity = [...fallbackPool].sort((a, b) => Math.abs(a.bpm - targetBpm) - Math.abs(b.bpm - targetBpm));
  const topCandidates = sortedByProximity.slice(0, 3);
  const picked = pickByDurationProximity(topCandidates, preferredDuration);
  return { ...picked, _isFallback: true };
};

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
/**
 * Compare le VRAI genre Deezer d'un titre (résolu via resolveDeezerGenre — chaîne
 * officielle titre → album → genre_id → nom) au genre interne demandé par
 * l'utilisateur (ex. "Métal", "Rap"). Comparaison tolérante (accents/casse
 * ignorés, correspondance partielle dans un sens ou l'autre) car les noms Deezer
 * ne correspondent pas toujours exactement aux nôtres (ex. Deezer catégorise
 * parfois "Rap/Hip Hop" en un seul intitulé). S'appuie sur DEEZER_GENRE_KEYWORDS
 * plutôt que sur le nom interne brut, puisque c'est déjà la correspondance
 * qu'on maintient entre nos genres et le vocabulaire Deezer.
 */
const genreRoughlyMatches = (realGenre, requestedGenre) => {
  if (!realGenre) return false;
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const real = normalize(realGenre);
  const requested = normalize(requestedGenre);
  const keyword = normalize(DEEZER_GENRE_KEYWORDS[requestedGenre] || requestedGenre);
  return real.includes(keyword) || keyword.includes(real) || real.includes(requested) || requested.includes(real);
};

const buildSegmentTracks = async (segment, config, excludeYoutubeIds, favorites, spotifyTrackPool, historyExcludeIds = []) => {
  const minBpm = segment.bpm - config.bpmTolerance;
  const maxBpm = segment.bpm + config.bpmTolerance;
  const pool = [];
  const seenIds = new Set(excludeYoutubeIds);
  // Genre effectif pour CE segment : si la portion a un genre spécifique défini
  // (override manuel à l'étape 3 du wizard), il prime sur le genre global de la
  // séance (config.selectedGenres) — sinon comportement inchangé.
  const effectiveGenres = (segment.selectedGenres && segment.selectedGenres.length > 0) ? segment.selectedGenres : config.selectedGenres;

  const addIfValid = (t) => {
    if (t && typeof t.bpm === 'number' && t.bpm >= minBpm && t.bpm <= maxBpm && t.duration && t.youtubeId && !seenIds.has(t.youtubeId)) {
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
  // dans son classement. On va donc chercher une page Deezer SUPPLÉMENTAIRE tant
  // que : (a) le pool ne couvre pas encore confortablement la durée du segment, ET
  // (b) la dernière page a effectivement apporté de nouveaux titres valides. Dès
  // que l'une des deux conditions cesse d'être vraie — assez de matière, ou le
  // filon Deezer semble tari pour ce genre/BPM — on s'arrête et on laisse la main
  // aux filets de secours (base locale, etc.), plutôt que de continuer à interroger
  // Deezer indéfiniment sur un genre déjà épuisé.
  try {
    const genresForQuery = (effectiveGenres && effectiveGenres.length > 0) ? effectiveGenres : ['Autre'];
    const detailFetchCap = Math.min(Math.max(25, genresForQuery.length * 6), 60);
    const seenStubIds = new Set();
    let allResolvedCandidates = [];
    let poolDurationSoFar = 0;
    // Cible large (1.5x la durée du segment) : donne à la sélection gloutonne
    // (bin-packing) un vrai choix parmi plusieurs combinaisons possibles, plutôt
    // que tout juste de quoi remplir le segment sans marge.
    const targetPoolDuration = segment.durationSeconds * 1.5;
    const MAX_PAGES = 4; // garde-fou : borne le pire cas (genre très pauvre) en appels réseau/latence

    for (let page = 0; page < MAX_PAGES; page++) {
      if (poolDurationSoFar >= targetPoolDuration) break; // déjà assez de matière

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

      allResolvedCandidates.push(...resolved);
      poolDurationSoFar += resolved.reduce((sum, t) => sum + (t.duration || 180), 0);
    }

    for (const full of allResolvedCandidates) {
      // Genre volontairement PAS résolu ici : ça coûte 2-3 appels réseau par
      // titre, et la plupart des candidats du pool ne seront jamais retenus par
      // la sélection ci-dessous — autant ne le faire QUE pour les titres
      // effectivement choisis (voir la boucle après la sélection gloutonne).
      addIfValid({
        youtubeId: `deezer-${full.id}`, title: full.title,
        artist: full.artist ? full.artist.name : 'Inconnu',
        bpm: full._resolvedBpm, duration: full.duration || 180,
        genre: null, _deezerId: full.id, preview: full.preview || null,
        _bpmSource: full._bpmSource
      });
    }
  } catch (e) {
    // Échec silencieux : le pool s'appuiera sur les autres sources (favoris/Spotify/local).
  }

  // Base locale statique (jamais d'extrait audio, mais toujours disponible hors-ligne).
  // Volontairement épargnée de l'historique inter-génération (`historyExcludeIds`) :
  // cette base ne contient que quelques titres par genre au total, c'est un filet de
  // sécurité minimal, pas une source de nouveauté — l'exclure sur tout l'historique
  // des générations précédentes la viderait en quelques séances et forcerait un repli
  // vers une source moins fiable juste pour "garantir" une variété que cette petite
  // base n'a jamais eu vocation à fournir. Elle reste en revanche dédoublonnée sur LA
  // PLAYLIST EN COURS (pas de titre local répété deux fois dans la même séance).
  const localExcludeIds = excludeYoutubeIds.filter(id => !historyExcludeIds.includes(id));
  let localPool = [];
  const validGenres = effectiveGenres && effectiveGenres.length > 0 ? effectiveGenres : ['Métal'];
  validGenres.forEach(g => { if (DATABASE_MUSIQUES[g]) localPool = [...localPool, ...DATABASE_MUSIQUES[g].map(t => ({ ...t, genre: g }))]; });
  localPool
    .filter(t => t.bpm >= minBpm && t.bpm <= maxBpm && !localExcludeIds.includes(t.youtubeId))
    .forEach(addIfValid);

  // Sélection gloutonne SUR TOUT LE POOL : à chaque étape, on compare le temps
  // restant à TOUS les candidats encore disponibles (pas 2-3), et on retire celui
  // qui s'en rapproche le plus — un vrai "bin packing" plutôt qu'un tirage local.
  //
  // GARDE-FOU GENRE (ajouté après le cas "Stan" d'Eminem retenu dans une playlist
  // Métal/Rock) : la recherche Deezer utilise le genre comme mot-clé flou dans une
  // requête texte, pas comme un filtre strict — un titre peut matcher le BPM sans
  // vraiment correspondre au genre demandé. Pour chaque candidat venant de Deezer
  // (`_deezerId` présent), on vérifie maintenant son VRAI genre (résolu via
  // resolveDeezerGenre) AVANT de l'accepter définitivement. S'il ne correspond à
  // aucun des genres demandés, on essaie le candidat suivant du pool (déjà
  // récupéré, donc sans nouvel appel de recherche) — jusqu'à 5 essais. Si les 5
  // échouent, on garde quand même le meilleur candidat (le plus proche en durée)
  // plutôt que de laisser un trou dans la playlist, mais marqué `_genreMismatch`
  // pour que ce soit visible dans l'interface plutôt que découvert après coup.
  // Les titres favoris/Spotify/locaux gardent leur genre déjà assigné, jamais
  // revérifiés ici (ce sont des choix délibérés, pas des résultats de recherche floue).
  const MAX_GENRE_CHECK_ATTEMPTS = 5;
  const selected = [];
  let remaining = segment.durationSeconds;
  let availablePool = [...pool];

  while (remaining > 30 && availablePool.length > 0) {
    availablePool.sort((a, b) => Math.abs(a.duration - remaining) - Math.abs(b.duration - remaining));

    let pick = null;
    const attempted = [];
    for (let attempt = 0; attempt < Math.min(MAX_GENRE_CHECK_ATTEMPTS, availablePool.length); attempt++) {
      const candidate = availablePool[attempt];
      if (!candidate._deezerId) {
        // Favoris / Spotify / local : genre déjà assigné, on fait confiance directement.
        pick = candidate;
        break;
      }
      const realGenre = await resolveDeezerGenre(candidate._deezerId);
      candidate.genre = realGenre || 'Genre inconnu';
      attempted.push(candidate);
      if (effectiveGenres.some(g => genreRoughlyMatches(realGenre, g))) {
        pick = candidate;
        break;
      }
      // Sinon : genre confirmé mais ne correspond pas, on essaie le candidat suivant.
    }
    if (!pick) {
      // Aucun des candidats testés ne correspondait au genre demandé : on garde
      // quand même le premier (le plus proche en durée), marqué explicitement.
      pick = attempted[0] || availablePool[0];
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
    const extra = await getSingleMatchingTrack(segment.bpm, config.bpmTolerance, effectiveGenres, usedSoFar, favorites, spotifyTrackPool, remaining, historyExcludeIds);
    extra._isFallback = true;
    selected.push(extra);
    remaining -= extra.duration;
  }

  // Filet de sécurité ultime : un segment ne doit jamais rester totalement vide.
  if (selected.length === 0) {
    const extra = await getSingleMatchingTrack(segment.bpm, config.bpmTolerance, effectiveGenres, excludeYoutubeIds, favorites, spotifyTrackPool, segment.durationSeconds, historyExcludeIds);
    extra._isFallback = true;
    selected.push(extra);
  }

  // Le genre est maintenant résolu EN AMONT, pendant la sélection elle-même (voir
  // la vérification de genre ci-dessus) — plus besoin de le résoudre après coup ici.
  // Reste juste à nettoyer le champ technique `_deezerId`, inutile une fois la
  // sélection terminée.
  selected.forEach(t => { delete t._deezerId; });

  return selected;
};

// =====================================================================================
// UTILITAIRES DE FORMATAGE / PARSING
// =====================================================================================

// Convertit un nombre de secondes en chaîne lisible ("1h 05m" ou "3m 42s").
const formatDuration = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

// Parse une valeur de temps issue d'un CSV Garmin/Strava (formats "HH:MM:SS",
// "MM:SS" ou nombre brut de secondes) vers un nombre de secondes.
const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const cleanStr = timeStr.replace(/"/g, '').trim();
  const parts = cleanStr.split(':');
  if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  else if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(cleanStr) || 0;
};

// =====================================================================================
// SOUS-COMPOSANTS DU GRAPHIQUE BPM (Recharts)
// =====================================================================================

// Tooltip personnalisé affiché au survol d'un point du graphique BPM.
// Affiche le nom du morceau (si dispo), le temps écoulé, et selon les données
// disponibles le BPM cible (musique) et/ou la cadence réelle en PPM (import Garmin/Strava).
const CustomChartTooltip = ({ active, payload, isNaughtyMode, currentUnit, metric }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl min-w-[200px]">
        {data.trackName && <p className="font-black text-sm text-gray-900 dark:text-white mb-1 truncate">{data.trackName}</p>}
        {/* Deux informations distinctes, clairement étiquetées pour ne plus les confondre :
            "Début" = position de ce titre dans la séance ; "Durée" = longueur du titre
            lui-même. Avant, une seule des deux s'affichait selon l'endroit (tooltip vs
            liste), sans jamais préciser laquelle — source de confusion signalée. Le
            bouton d'écoute a été retiré d'ici (déplacé dans un encart fixe sous le
            titre du graphique) : dans cette bulle flottante qui suit la souris, il
            devenait impossible à cliquer de façon fiable (la bulle se repositionnait
            en tentant de l'atteindre). */}
        <p className="text-xs text-gray-500 font-medium mb-1 flex items-center space-x-1">
          <Clock size={12}/> <span>{data.trackName ? 'Début' : 'Temps'} : {formatDuration(data.time)}</span>
        </p>
        {data.trackDuration !== undefined && (
          <p className="text-xs text-gray-500 font-medium mb-3 flex items-center space-x-1">
            <Clock size={12}/> <span>Durée : {formatDuration(data.trackDuration)}</span>
          </p>
        )}
        <div className="flex flex-col gap-2">
            {data.bpmTarget !== undefined && (
               <div className={`px-2 py-1.5 rounded text-xs font-bold font-mono text-white ${isNaughtyMode ? 'bg-rose-500' : 'bg-gray-800 dark:bg-gray-700'}`}>
                 🎯 Cible: {data.bpmTarget} BPM musical
               </div>
            )}
            {data.realValue !== undefined && (
               <div className="px-2 py-1.5 rounded text-xs font-bold font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                 {metric === 'heartRate' ? `❤️ Fréquence cardiaque: ${data.realValue} pulsations/min` : `🏃 Cadence réelle: ${data.realValue} PPM`}
               </div>
            )}
        </div>
      </div>
    );
  }
  return null;
};

// Point personnalisé de la courbe "réelle" affichée (Cadence PPM OU Fréquence
// cardiaque, selon `selectedMetric`). La coloration "feu tricolore" (vert/orange/
// rouge selon l'écart à la cible) n'a de sens QUE pour la cadence, comparable au
// BPM musical cible via la convention "1 pas = 1 temps" (course à pied). La
// fréquence cardiaque n'a pas de cible équivalente dans TempoFit aujourd'hui —
// son point reste donc dans une couleur neutre unique, sans jugement "trop
// lent/trop rapide" inventé de toutes pièces.
const RealDataDot = (props) => {
  const { cx, cy, payload, tolerance, metric } = props;
  if (payload.realValue === undefined) return null;
  if (metric !== 'cadence' || payload.targetAtTime === undefined) {
    // Fréquence cardiaque (ou cadence sans cible connue à cet instant) : point neutre.
    return <circle cx={cx} cy={cy} r={4} fill="#ec4899" stroke="white" strokeWidth={1} />;
  }
  const target = payload.targetAtTime;
  const real = payload.realValue;
  const tol = tolerance || 10;
  let fill = "#3b82f6";
  if (real >= target - tol && real <= target + tol) fill = "#22c55e"; 
  else if (real < target - tol) fill = "#f59e0b"; 
  else fill = "#ef4444"; 
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="white" strokeWidth={1} />;
};

// =====================================================================================
// COMPOSANT PRINCIPAL
// =====================================================================================

export default function App() {
  // --- Navigation & état d'affichage global ---
  const [view, setView] = useState('generator');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme, setTheme] = useState('dark'); 

  /**
   * "Moteur de vérité BPM" : détermine le BPM réel d'un morceau externe (ex.
   * un titre liké sur Spotify dont on ne connaît pas encore le tempo).
   * Ordre de résolution :
   *   1. Recherche approximative (inclusion de chaîne dans les 2 sens) dans
   *      la base locale DATABASE_MUSIQUES — rapide, gratuit, pas d'appel réseau.
   *   2. Requête à l'API GetSongBPM `/search/` avec titre + artiste nettoyés
   *      (suppression des parenthèses/crochets, ne garde que le 1er artiste
   *      en cas de featuring séparé par "," ou "&").
   *   3. Si la recherche combinée titre+artiste ne donne rien, on retente en
   *      cherchant uniquement par titre (`type=song`), plus permissif.
   *   4. Si l'API échoue ou ne trouve rien : fallback mathématique arbitraire
   *      (100 + longueur du titre modulo 80) — approximatif mais garantit
   *      qu'un BPM (même faux) est toujours renvoyé, pour ne jamais bloquer
   *      la synchronisation Spotify.
   */
  /**
   * "Moteur de vérité BPM" : détermine le BPM réel (et l'extrait audio, si dispo)
   * d'un morceau externe (ex. un titre liké sur Spotify dont on ne connaît pas
   * encore le tempo). Renvoie toujours { bpm, preview }, jamais juste un nombre.
   * Ordre de résolution :
   *   1. Recherche approximative (inclusion de chaîne dans les 2 sens) dans
   *      la base locale DATABASE_MUSIQUES — rapide, gratuit, pas d'appel réseau
   *      (mais jamais d'extrait audio pour ces entrées codées en dur).
   *   2. Recherche Deezer (titre + artiste, filtre avancé track:/artist:) via notre
   *      relais /api/deezer — c'est la source principale désormais : plus fiable
   *      que GetSongBPM (voir tout l'historique de debug de cette app) ET fournit
   *      systématiquement un extrait audio écoutable dans l'app.
   *   3. Si Deezer échoue, on retente sur GetSongBPM en dernier filet de sécurité.
   *   4. Fallback mathématique arbitraire (100 + longueur du titre modulo 80) si
   *      absolument rien n'a fonctionné — approximatif mais garantit qu'un BPM
   *      (même faux) est toujours renvoyé, pour ne jamais bloquer la synchro.
   */
  const resolveRealBPM = async (title, artist) => {
    const allLocalTracks = [];
    Object.values(DATABASE_MUSIQUES).forEach(tracks => allLocalTracks.push(...tracks));
    
    const exactMatch = allLocalTracks.find(t => 
      t.title.toLowerCase().includes(title.toLowerCase()) || 
      title.toLowerCase().includes(t.title.toLowerCase())
    );

    if (exactMatch) return { bpm: exactMatch.bpm, preview: null };

    const cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').split('-')[0].trim();
    const cleanArtist = artist.split(',')[0].split('&')[0].trim();

    // Recherche Deezer en priorité
    try {
      const q = `track:"${cleanTitle}" artist:"${cleanArtist}"`;
      const { data: searchData } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`);
      const stub = (searchData && Array.isArray(searchData.data)) ? searchData.data[0] : null;
      if (stub) {
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
        if (full && full.bpm && parseFloat(full.bpm) > 0) {
          return { bpm: Math.round(parseFloat(full.bpm)), preview: full.preview || null };
        }
      }
    } catch(e) {
      // On continue vers le fallback GetSongBPM ci-dessous.
    }

    // Filet de sécurité : GetSongBPM, désormais via /api/getsongbpm (la clé reste
    // côté serveur, voir api/getsongbpm.js — avant, elle était en clair dans ce
    // fichier et donc visible par n'importe qui dans le bundle JS envoyé au navigateur).
    try {
        const queryStr = "song:" + cleanTitle + " artist:" + cleanArtist;
        let res = await fetch(`/api/getsongbpm?type=both&lookup=${encodeURIComponent(queryStr)}`);
        let data = await res.json();
        if (data.search && data.search.length > 0 && data.search[0].tempo) {
            return { bpm: parseInt(data.search[0].tempo), preview: null };
        }

        // Fallback: chercher uniquement par titre
        res = await fetch(`/api/getsongbpm?type=song&lookup=${encodeURIComponent(cleanTitle)}`);
        data = await res.json();
        if (data.search && data.search.length > 0 && data.search[0].tempo) {
            return { bpm: parseInt(data.search[0].tempo), preview: null };
        }
    } catch(e) {
        console.error("Erreur API GetSongBPM:", e);
    }

    // Fallback mathématique si la musique est totalement inconnue
    return { bpm: 100 + (title.length % 80), preview: null };
  };

  // --- DÉBUT : MOTEUR SPOTIFY (Version Unifiée & Sécurisée) ---
  // Authentification OAuth2 PKCE (Proof Key for Code Exchange) : flow adapté
  // aux apps 100% front-end car il ne nécessite pas de "client secret" caché
  // côté serveur — contrairement au flow "Authorization Code" classique.
  const SPOTIFY_CLIENT_ID = '38d8a04ac20047cebe31d20a2cd65d52';
  const REDIRECT_URI = window.location.origin + window.location.pathname; 
  const [spotifyToken, setSpotifyToken] = useState(window.localStorage.getItem("spotify_token"));
  const hasFetchedToken = useRef(false); // Garde-fou anti double-échange du "code" (StrictMode / re-render)

  // Au montage : si l'URL contient un paramètre "code" (retour de la redirection
  // Spotify après consentement de l'utilisateur), on l'échange contre un token
  // d'accès via l'endpoint /api/token, en fournissant le "code_verifier" PKCE
  // généré avant la redirection et stocké temporairement en localStorage.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');

    if (code && !hasFetchedToken.current) {
      hasFetchedToken.current = true;
      const codeVerifier = window.localStorage.getItem('code_verifier');
      
      fetch(SPOTIFY_TOKEN_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      })
      .then(res => res.json())
      .then(data => {
        if(data.access_token) {
           window.localStorage.setItem("spotify_token", data.access_token);
           setSpotifyToken(data.access_token);
           // Nettoie l'URL (retire ?code=...) pour éviter un ré-échange si l'utilisateur rafraîchit.
           window.history.replaceState({}, document.title, REDIRECT_URI);
           showToast("✅ Connexion à Spotify réussie !");
        }
      }).catch(err => console.error(err));
    }
  }, []);

  // Génère une chaîne aléatoire cryptographiquement sûre (utilisée comme code_verifier PKCE).
  const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  };

  // Hash SHA-256 du code_verifier → donnera le code_challenge envoyé à Spotify.
  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  // Encodage base64url (variante base64 sans padding, compatible URL) requis par PKCE.
  const base64encode = (input) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  // Lance le flow de connexion Spotify : génère le couple verifier/challenge PKCE,
  // stocke le verifier pour pouvoir le réutiliser au retour, puis redirige
  // l'utilisateur vers la page de consentement Spotify.
  const loginSpotify = async () => {
    window.localStorage.removeItem("spotify_token");
    setSpotifyToken(null);
    
    const codeVerifier = generateRandomString(64);
    window.localStorage.setItem('code_verifier', codeVerifier);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: 'user-read-private user-read-email user-top-read user-library-read user-follow-read playlist-modify-public playlist-modify-private',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      show_dialog: 'true' 
    });
    
    window.location.href = SPOTIFY_AUTH_BASE + params.toString();
  };

  /**
   * Récupère les titres likés Spotify en suivant la pagination de l'API (`next`
   * URL renvoyée par Spotify tant qu'il reste des pages), plutôt que la seule
   * première page de 50 titres comme avant. Plafonné à `maxTracks` : au-delà,
   * chaque titre supplémentaire coûte un appel réseau de résolution BPM (voir
   * `resolveRealBPM`), donc une bibliothèque de plusieurs milliers de titres
   * likés rendrait la synchro extrêmement longue et risquerait de déclencher du
   * rate-limiting côté Deezer/GetSongBPM. 200 est un compromis raisonnable ;
   * augmente cette valeur si besoin, en gardant en tête le coût en requêtes.
   */
  const fetchAllLikedTracks = async (token, maxTracks = 200) => {
    let allTracks = [];
    let url = SPOTIFY_API_BASE + '/me/tracks?limit=50';
    while (url && allTracks.length < maxTracks) {
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (res.status === 401 || res.status === 403) throw new Error("Token expiré");
      const data = await res.json();
      const items = data.items ? data.items.map(i => i.track) : [];
      allTracks = allTracks.concat(items);
      url = data.next; // Spotify fournit directement l'URL de la page suivante, ou null si terminé
    }
    return allTracks.slice(0, maxTracks);
  };

  /**
   * Récupère les titres likés ET les artistes suivis de l'utilisateur sur Spotify,
   * résout le BPM réel (+ extrait audio) de chaque titre via `resolveRealBPM`, et
   * alimente `spotifyTrackPool` (utilisé en priorité par `getSingleMatchingTrack`)
   * ainsi que `favorites` (utilisés eux aussi en priorité, voir même fonction).
   *
   * `favorites.artists` combine désormais deux sources : les artistes des titres
   * likés (comme avant) ET les artistes explicitement suivis via /me/following
   * (nouveau) — avant, seule la première source existait, ce qui ne reflétait pas
   * vraiment "les artistes que tu aimes" au sens Spotify du terme.
   *
   * ⚠️ Performance/quota : `Promise.all` lance une résolution BPM par titre en
   * parallèle. Avec la pagination (jusqu'à 200 titres désormais, contre 50 avant),
   * ça peut représenter un nombre significatif de requêtes quasi simultanées vers
   * Deezer/GetSongBPM — la synchro peut prendre plusieurs dizaines de secondes.
   */
  const syncSpotifyFavorites = async (tokenToUse) => {
    const token = tokenToUse || spotifyToken;
    if (!token || token === "undefined" || token === "null") return;
    
    try {
      showToast("⚡ Récupération de ta bibliothèque Spotify...");
      
      const rawTracks = await fetchAllLikedTracks(token);


      // Récupération des artistes réellement SUIVIS (distinct des artistes des titres likés).
      let followedArtistNames = [];
      try {
        const followedRes = await fetch(SPOTIFY_API_BASE + '/me/following?type=artist&limit=50', {
          headers: { Authorization: "Bearer " + token }
        });
        if (followedRes.ok) {
          const followedData = await followedRes.json();
          const items = followedData.artists && followedData.artists.items ? followedData.artists.items : [];
          followedArtistNames = items.map(a => a.name);
        }
      } catch (e) {
        // Échec silencieux : on garde au moins les artistes déduits des titres likés ci-dessous.
      }

      if (rawTracks.length === 0 && followedArtistNames.length === 0) {
        showToast("Synchro terminée (Aucun titre liké ni artiste suivi trouvé).");
        return;
      }

      showToast("🔍 Interrogation du Moteur de Vérité BPM TempoFit...");

      const analyzedPool = await Promise.all(rawTracks.map(async (track) => {
         const artistName = track.artists && track.artists[0] ? track.artists[0].name : 'Artiste inconnu';
         const resolved = await resolveRealBPM(track.name, artistName);
         
         return {
            youtubeId: track.id, 
            title: track.name,
            artist: artistName,
            album: track.album ? track.album.name : 'Album',
            bpm: resolved.bpm, 
            duration: Math.round(track.duration_ms / 1000),
            isEmbeddable: true,
            isFromPlatform: 'Spotify',
            preview: track.preview_url || resolved.preview || null // extrait Spotify natif si dispo, sinon celui trouvé via Deezer
         };
      }));

      setSpotifyTrackPool(analyzedPool);

      // Fusion avec les favoris déjà présents (ajoutés manuellement ou via une
      // recherche BPM) plutôt que remplacement complet — une synchro Spotify ne
      // doit pas effacer ce que l'utilisateur a choisi lui-même dans l'app.
      setFavorites(prev => {
        const artistsFromTracks = analyzedPool.map(t => t.artist);
        const mergedArtists = Array.from(new Set([...prev.artists, ...followedArtistNames, ...artistsFromTracks])).slice(0, 40);

        const existingIds = new Set(prev.tracks.map(t => t.youtubeId));
        const newTracks = analyzedPool.filter(t => !existingIds.has(t.youtubeId));
        const mergedTracks = [...prev.tracks, ...newTracks];

        return { ...prev, useFavorites: true, artists: mergedArtists, tracks: mergedTracks };
      });

      showToast(`🎯 ${analyzedPool.length} titres et ${followedArtistNames.length} artistes suivis synchronisés !`);
    } catch (e) {
      console.error("Erreur d'importation :", e);
      if(e.message === "Token expiré") {
          window.localStorage.removeItem("spotify_token");
          setSpotifyToken(null);
          showToast("❌ Ta session Spotify a expiré. Reconnecte-toi !", 'error');
      } else {
          showToast("❌ Erreur lors de l'importation.", 'error');
      }
    }
  };

  // Synchronise automatiquement dès qu'un token Spotify valide est disponible
  // (au montage si déjà connecté, ou juste après le login OAuth ci-dessus).
  useEffect(() => {
     if (spotifyToken && spotifyToken !== "undefined" && spotifyToken !== "null") {
         syncSpotifyFavorites(spotifyToken);
     }
  }, [spotifyToken]);
  // --- FIN : MOTEUR SPOTIFY ---

  const [isNaughtyMode, setIsNaughtyMode] = useState(false);
  const [toast, setToast] = useState(null);

  // Pool de morceaux Spotify de l'utilisateur, déjà résolus en BPM (voir syncSpotifyFavorites).
  const [spotifyTrackPool, setSpotifyTrackPool] = useState([]);
  // favorites.tracks contient des objets complets (bpm, extrait audio...), pas de
  // simples chaînes — nécessaire pour que getSingleMatchingTrack puisse s'en servir
  // en priorité, et pour permettre l'écoute d'extrait dans la vue Favoris.
  // Titres et artistes de démonstration pré-remplis pour inciter l'utilisateur à
  // manipuler ces options dès le premier lancement (les découvrir passivement,
  // sans avoir à d'abord chercher/ajouter quoi que ce soit soi-même). Les deux
  // titres viennent de la base locale (mêmes youtubeId que DATABASE_MUSIQUES) donc
  // leur BPM est fiable, mais ils n'ont pas d'extrait audio par défaut (bouton
  // grisé) — pas d'appel réseau Deezer nécessaire juste pour peupler l'exemple.
  const [favorites, setFavorites] = useState({
    useFavorites: true,
    artists: ['Metallica', 'System Of A Down'],
    tracks: [
      { youtubeId: 'uRyAIyq53FY', title: 'Master of Puppets', artist: 'Metallica', bpm: 212, duration: 515, isEmbeddable: false, preview: null, genre: 'Métal' },
      { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', bpm: 128, duration: 210, isEmbeddable: false, preview: null, genre: 'Métal' }
    ]
  });
  // Réglages du sélecteur BPM/genre propre à la page Cœur & Favoris (indépendant
  // de ceux du wizard de génération, qui a son propre contexte bpm/selectedGenres).
  const [favBpmTarget, setFavBpmTarget] = useState(140);
  const [favBpmTolerance, setFavBpmTolerance] = useState(10);
  const [favSelectedGenres, setFavSelectedGenres] = useState(['Métal']);
  const [newFavArtist, setNewFavArtist] = useState("");
  const [isAddingArtist, setIsAddingArtist] = useState(false);

  /**
   * Ajoute un artiste aux favoris de façon OPTIMISTE : le nom tapé apparaît
   * immédiatement (aucune latence perçue, aucun blocage possible), puis une
   * recherche Deezer tourne en arrière-plan pour corriger discrètement l'orthographe
   * si un artiste correspondant est trouvé sous un nom légèrement différent (ex.
   * casse, accents). Si Deezer ne répond pas ou ne trouve rien, le nom tapé reste
   * tel quel — jamais de blocage, jamais d'attente visible.
   */
  const addFavoriteArtistValidated = (rawName) => {
    const query = rawName.trim();
    if (!query) return;

    // 1. Ajout immédiat, sans attendre quoi que ce soit.
    setFavorites(prev => ({ ...prev, artists: Array.from(new Set([...prev.artists, query])) }));
    showToast(`🎵 ${query} ajouté à tes artistes favoris !`);
    setNewFavArtist("");
    setIsAddingArtist(false);

    // 2. Correction discrète en arrière-plan (ne bloque plus rien, pas de toast
    // supplémentaire pour rester discret — juste le nom qui se corrige si besoin).
    (async () => {
      try {
        const { data } = await deezerFetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=1`);
        const match = data && Array.isArray(data.data) ? data.data[0] : null;
        if (match && match.name && match.name.toLowerCase() !== query.toLowerCase()) {
          setFavorites(prev => ({
            ...prev,
            artists: Array.from(new Set(prev.artists.map(a => a === query ? match.name : a)))
          }));
        }
      } catch (e) {
        // Échec silencieux : le nom tapé reste tel quel (voir docstring).
      }
    })();
  };

  // Routines sauvegardées : configurations de génération réutilisables en 1 clic.
  const [routines, setRoutines] = useState([{
    id: 'routine-1', name: '🏃‍♂️ Mon 5km Quotidien', workoutType: 'Course à pied', customActivity: '',
    isIntervalMode: false, bpm: 160, selectedGenres: ['Métal', 'Rock'], bpmTolerance: 10, crossfade: 2,
    segments: [], coverIcon: '🏃‍♂️', autoGenFreq: 'Manuel', manualGenerations: 0, recentTrackIds: [],
    targetMode: 'distance', distanceVal: 5, distanceUnit: 'km', paceMin: 5, paceSec: 30, hours: 0, minutes: 27,
    createdAt: new Date().toLocaleDateString()
  }]);
  
  const [routineBatchCounts, setRoutineBatchCounts] = useState({});
  const [isSavingRoutineModalOpen, setIsSavingRoutineModalOpen] = useState(false);
  // Routine en cours d'édition (copie modifiable, distincte de l'entrée dans `routines`
  // tant que l'utilisateur n'a pas choisi "cette séance seulement" ou "toujours").
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [isEditRoutineModalOpen, setIsEditRoutineModalOpen] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineIcon, setNewRoutineIcon] = useState("⚡");
  const [newRoutineFreq, setNewRoutineFreq] = useState("Manuel");

  // Statistiques utilisateur servant à débloquer les trophées (voir checkTrophies).
  const [userStats, setUserStats] = useState({ 
    totalCompleted: 0, naughtyCompleted: 0, dataImports: 0, 
    replacedTracks: 0, hasMarathon: false, hasBolt: false, 
    hasHiitMaster: false, hasNightOwl: false, hasRickroll: false,
    unlockedTrophies: [] 
  });

  // --- État du wizard de génération (4 étapes) ---
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState(['Métal']);
  // Affiche ou non le reste de la taxonomie Deezer (EXTRA_GENRES) sous les 3 sélecteurs
  // de genre (wizard étape 4, page Favoris, édition de routine) — un seul état partagé
  // puisque c'est une simple préférence d'affichage, pas une donnée métier par écran.
  const [showExtraGenres, setShowExtraGenres] = useState(false);
  const [workoutType, setWorkoutType] = useState('Course à pied');
  const [customActivity, setCustomActivity] = useState('');
  const [tempCustomActivity, setTempCustomActivity] = useState('');
  const [isCustomActivityModalOpen, setIsCustomActivityModalOpen] = useState(false);

  const [bpmTolerance, setBpmTolerance] = useState(14);
  const [crossfade, setCrossfade] = useState(2);
  const [bpm, setBpm] = useState(160);
  const [isIntervalMode, setIsIntervalMode] = useState(false);
  
  const [targetMode, setTargetMode] = useState('time'); 
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(45);
  
  const [distanceVal, setDistanceVal] = useState(5);
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [paceMin, setPaceMin] = useState(5);
  const [paceSec, setPaceSec] = useState(30);

  // Segments du mode fractionné (HIIT) : chacun a son propre BPM cible et sa durée.
  const [segments, setSegments] = useState([{ id: 1, bpm: 120, durationValue: 15 }]); 
  // Quelle portion a son panneau "genre spécifique" déplié (une seule à la fois,
  // replié par défaut pour ne pas surcharger l'étape 3 du wizard). null = aucune.
  const [expandedSegmentGenreId, setExpandedSegmentGenreId] = useState(null);

  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  // Playlist d'exemple pré-remplie, même principe que la routine et les favoris de
  // départ — clairement nommée "Exemple" pour ne pas laisser penser qu'elle a été
  // vraiment générée, construite sur des titres de la base locale (pas d'appel
  // Deezer nécessaire au premier chargement), et laissée en statut "à faire" pour
  // que la découverte du bouton "marquer comme terminée" reste naturelle.
  const [savedPlaylists, setSavedPlaylists] = useState([{
    id: 'playlist-example-1',
    name: '🏃 Exemple : Session Rock/Métal',
    workoutType: 'Course à pied',
    avgPace: 330,
    targetMode: 'time',
    distanceUnit: 'km',
    tolerance: 15,
    crossfade: 2,
    isNaughty: false,
    coverIcon: '🏃‍♂️',
    createdAt: new Date().toLocaleDateString(),
    status: 'pending',
    actualDataByDate: {},
    config: { workoutName: 'Course à pied', targetMode: 'time', hours: 0, minutes: 18, bpm: 150, tolerance: 15, isIntervalMode: false, selectedGenres: ['Rock', 'Métal'] },
    totalDuration: 1138,
    tracks: [
      { id: 'ex-track-1', segmentIndex: 1, targetSegmentBpm: 148, title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222, youtubeId: 'gGdGFtwPNsQ', preview: null, startTimeStr: '0m 00s', startDistVal: 0 },
      { id: 'ex-track-2', segmentIndex: 1, targetSegmentBpm: 145, title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252, youtubeId: 'v2H4l9RpkwM', preview: null, startTimeStr: '3m 40s', startDistVal: 0.67 },
      { id: 'ex-track-3', segmentIndex: 1, targetSegmentBpm: 180, title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170, youtubeId: 'L_jWHffIx5E', preview: null, startTimeStr: '7m 50s', startDistVal: 1.42 },
      { id: 'ex-track-4', segmentIndex: 1, targetSegmentBpm: 133, title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292, youtubeId: 'v2AC41dglnM', preview: null, startTimeStr: '10m 38s', startDistVal: 1.93 },
      { id: 'ex-track-5', segmentIndex: 1, targetSegmentBpm: 128, title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210, youtubeId: 'CSvFpBOe8eY', preview: null, startTimeStr: '15m 28s', startDistVal: 2.81 }
    ]
  }]);
  const [isGenerating, setIsGenerating] = useState(false);
  // Nombre total de playlists du lot en cours de génération, et combien sont déjà
  // terminées — sert uniquement à afficher un message de progression rassurant
  // pendant la génération (voir le bandeau fixe plus bas), pas à la logique de
  // génération elle-même.
  const [generatingTotal, setGeneratingTotal] = useState(0);
  const [generatingDone, setGeneratingDone] = useState(0);

  const [shareData, setShareData] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Recherche manuelle de titre via une base musicale externe (ajout précis à une playlist ou aux favoris) ---
  const [isWorldSearching, setIsWorldSearching] = useState(false);
  const [worldSearchResults, setWorldSearchResults] = useState([]);
  // Libellé de contexte affiché au-dessus des résultats quand ils viennent d'une
  // recherche par artiste plutôt que par titre direct (ex. "Top titres de Daft Punk").
  const [resultsContextLabel, setResultsContextLabel] = useState(null);
  // true si la recherche n'a rien donné du tout (aucun titre, aucun artiste connu,
  // ou aucun des titres trouvés n'a de BPM renseigné par Deezer).
  const [noUsableResultsHint, setNoUsableResultsHint] = useState(false);
  // true quand la modale de recherche est en mode "BPM précis" (déclenchée depuis
  // le générateur) plutôt qu'en mode recherche libre par texte.
  const [isBpmSearchMode, setIsBpmSearchMode] = useState(false);
  // Édition du nom d'une playlist générée — avant, le nom auto-généré (ex. "Depuis :
  // 🏃‍♂️ Mon 5km Quotidien") n'était jamais modifiable, ce qui devenait vite peu
  // pratique pour s'y retrouver une fois plusieurs playlists sauvegardées.
  const [isEditingPlaylistName, setIsEditingPlaylistName] = useState(false);
  const [editedPlaylistName, setEditedPlaylistName] = useState("");
  // Mémorise les paramètres (bpm, tolérance, genres) de la dernière recherche par
  // BPM lancée, quel que soit l'endroit d'où elle a été déclenchée (wizard ou page
  // Favoris) — permet à la modale d'afficher le bon contexte et de relancer une
  // recherche identique via le bouton "actualiser", sans dépendre du state du wizard.
  const [bpmSearchParams, setBpmSearchParams] = useState({ bpm: 140, tolerance: 10, genres: [] });

  // --- Lecture des extraits audio (30s, fournis par Deezer) ---
  // Un seul lecteur audio partagé pour toute l'app : lancer un nouvel extrait
  // coupe automatiquement celui en cours. `previewAudioRef` est créé une seule
  // fois (lazy) plutôt qu'avec useState pour éviter de recréer un objet Audio à
  // chaque re-render.
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const previewAudioRef = useRef(null);

  const togglePreview = (track) => {
    if (!track.preview) return;
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.addEventListener('ended', () => setPlayingPreviewId(null));
    }
    const audio = previewAudioRef.current;
    if (playingPreviewId === track.youtubeId) {
      audio.pause();
      setPlayingPreviewId(null);
    } else {
      audio.src = track.preview;
      audio.currentTime = 0;
      audio.play().catch(() => showToast("Impossible de lire cet extrait.", 'error'));
      setPlayingPreviewId(track.youtubeId);
    }
  };

  // Coupe l'extrait en cours si la modale de recherche se ferme, pour ne pas
  // laisser un aperçu jouer en arrière-plan une fois la fenêtre fermée.
  useEffect(() => {
    if (!isSearchModalOpen && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreviewId(null);
    }
  }, [isSearchModalOpen]);

  // --- MOTEUR DE RECHERCHE DEEZER (recherche manuelle titre/artiste avec BPM) ---
  // On utilise l'API publique Deezer (100M+ titres, champ "bpm" par titre, pas de
  // clé API requise) plutôt que GetSongBPM pour cette recherche manuelle : Deezer
  // permet aussi de lister les titres populaires d'un artiste, ce que GetSongBPM
  // ne sait pas faire.
  //
  // NOTE : safeFetchJson et deezerFetch sont maintenant définies au niveau module
  // (tout en haut du fichier, avant ce composant) plutôt qu'ici, car le moteur de
  // génération getSingleMatchingTrack en a aussi besoin pour interroger Deezer en
  // direct (voir plus bas : ça garantit des extraits audio disponibles sur les
  // morceaux générés, ce que la base locale statique ne permettait pas).

  /**
   * Recherche manuelle utilisée dans la modale "Rechercher un titre".
   * Stratégie en 3 temps pour couvrir "artiste OU titre" :
   *   1. Recherche directe de titres correspondant au texte tapé (/search).
   *   2. Si rien ne matche comme titre, recherche d'artiste (/search/artist) ;
   *      si trouvé, récupère ses titres les plus populaires (/artist/{id}/top).
   *   3. Le BPM n'étant jamais inclus dans les listes de résultats (limitation
   *      Deezer documentée), une requête /track/{id} par titre est nécessaire
   *      pour le récupérer — on la fait pour les 8 premiers titres trouvés.
   */
  const searchWorldMusicApi = async () => {
    if(!searchQuery.trim()) return;
    setIsWorldSearching(true);
    setWorldSearchResults([]);
    setResultsContextLabel(null);
    setNoUsableResultsHint(false);
    try {
      // 1. Recherche directe de titres
      const { data: searchData } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
      let trackStubs = (searchData && Array.isArray(searchData.data)) ? searchData.data : [];
      let contextLabel = null;

      if (trackStubs.length === 0) {
         // 2. Rien comme titre : on tente une recherche d'artiste
         const { data: artistData } = await deezerFetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(searchQuery)}&limit=1`);
         const artist = (artistData && Array.isArray(artistData.data)) ? artistData.data[0] : null;
         if (artist) {
            const { data: topData } = await deezerFetch(`https://api.deezer.com/artist/${artist.id}/top?limit=8`);
            trackStubs = (topData && Array.isArray(topData.data)) ? topData.data : [];
            if (trackStubs.length > 0) contextLabel = `Top titres de ${artist.name}`;
         }
      }

      if (trackStubs.length === 0) {
         setNoUsableResultsHint(true);
         setIsWorldSearching(false);
         return;
      }

      // 3. Un appel par titre pour récupérer son BPM (absent des listes de résultats)
      const detailedTracks = await Promise.all(trackStubs.slice(0, 8).map(async (stub) => {
         const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
         return full;
      }));

      const formattedResults = await Promise.all(
        detailedTracks
          .filter(t => t && t.bpm && parseFloat(t.bpm) > 0)
          .map(async (t) => {
            const realGenre = await resolveDeezerGenre(t.id);
            return {
              youtubeId: `deezer-${t.id}`,
              title: t.title,
              artist: t.artist ? t.artist.name : 'Inconnu',
              bpm: Math.round(parseFloat(t.bpm)),
              duration: t.duration || 180,
              isEmbeddable: true,
              genre: realGenre || 'Genre inconnu',
              preview: t.preview || null // extrait MP3 de 30s fourni par Deezer, lisible sans clé ni CORS
            };
          })
      );

      setWorldSearchResults(formattedResults);
      setResultsContextLabel(contextLabel);
      if (formattedResults.length === 0) setNoUsableResultsHint(true); // titres trouvés mais aucun n'a de BPM connu
    } catch(e) {
      // Erreur réseau réelle (proxy CORS injoignable, hors-ligne...) — safeFetchJson
      // absorbe déjà les corps vides/invalides sans lever d'exception.
      showToast("Erreur réseau lors de la recherche.", 'error');
    }
    setIsWorldSearching(false);
  };

  /**
   * Recherche des titres dont le BPM tombe pile dans la fourchette [targetBpm-tolerance,
   * targetBpm+tolerance], en tenant compte des genres fournis. Utilise le filtre avancé
   * natif de Deezer `bpm_min:`/`bpm_max:` (non documenté officiellement mais confirmé
   * fonctionnel), combiné à un mot-clé de genre en texte libre. Une recherche est lancée
   * par genre (Deezer ne supporte pas de "OU" entre plusieurs genres dans une seule
   * requête), puis les résultats sont fusionnés et dédupliqués.
   *
   * Paramètres explicites (plutôt que de lire directement le state du wizard) pour que
   * cette fonction soit réutilisable depuis plusieurs endroits de l'app : le générateur
   * (étape 4) ET la page Cœur & Favoris, qui ont chacun leurs propres réglages BPM/genres.
   */
  const searchTracksByBpm = async (targetBpm, tolerance, genres) => {
    setBpmSearchParams({ bpm: targetBpm, tolerance, genres: genres || [] });
    setIsWorldSearching(true);
    setWorldSearchResults([]);
    setResultsContextLabel(`${targetBpm} BPM ± ${tolerance}`);
    setNoUsableResultsHint(false);
    try {
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
         setNoUsableResultsHint(true);
         setIsWorldSearching(false);
         return;
      }

      // Un appel par titre pour confirmer le BPM exact et récupérer l'extrait audio
      const detailedTracks = await Promise.all(uniqueStubs.map(async (stub) => {
         const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
         return full ? { ...full, matchedGenre: stub.matchedGenre } : null;
      }));

      const formattedResults = (await Promise.all(
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
              isEmbeddable: true,
              genre: realGenre || 'Genre inconnu',
              preview: t.preview || null
            };
          })
      ));

      setWorldSearchResults(formattedResults);
      if (formattedResults.length === 0) setNoUsableResultsHint(true);
    } catch(e) {
      showToast("Erreur réseau lors de la recherche.", 'error');
    }
    setIsWorldSearching(false);
  };
  
  // Liste à plat de tous les morceaux de la base locale (mémoïsée, ne change jamais
  // en pratique puisque DATABASE_MUSIQUES est une constante).
  const allTracksDb = useMemo(() => {
    let list = [];
    Object.keys(DATABASE_MUSIQUES).forEach(genre => {
        DATABASE_MUSIQUES[genre].forEach(t => list.push({...t, genre}));
    });
    return list;
  }, []);

  // Recherche locale simple (titre/artiste) dans la base interne — pas d'appel réseau.
  // Distincte de searchWorldMusicApi qui interroge l'API mondiale.
  const searchResults = useMemo(() => {
    if(!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allTracksDb.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  }, [searchQuery, allTracksDb]);

  const [dataOffset, setDataOffset] = useState(0);
  const fileInputRef = useRef(null);
  // Mémorise à QUELLE date de complétion précise rattacher le prochain import CSV
  // (une playlist peut désormais avoir plusieurs séances réelles, une par date de
  // complétion, au lieu d'une seule donnée réelle partagée pour toute la playlist).
  const [csvUploadTargetDate, setCsvUploadTargetDate] = useState(null);
  // Quelle date de complétion afficher dans le graphique "Cible vs Réalité" quand
  // plusieurs séances ont des données réelles importées — par défaut la plus récente.
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState(null);
  // Quelle métrique réelle afficher sur le graphique quand les deux sont dispo pour
  // la séance sélectionnée : 'cadence' (PPM, comparable au BPM musical cible) ou
  // 'heartRate' (fréquence cardiaque, affichée en courbe brute — pas de cible
  // équivalente dans TempoFit aujourd'hui, voir RealDataDot et analysisStats).
  const [selectedMetric, setSelectedMetric] = useState('cadence');

  const availableGenres = isNaughtyMode ? NAUGHTY_GENRES : STANDARD_GENRES;
  // Sous-titre du générateur adapté au mode Intime — avant, le titre changeait déjà
  // ("Prépare l'ambiance...") mais le sous-titre juste en dessous restait le texte
  // générique fitness ("pulvériser tes objectifs"), ce qui jurait avec l'ambiance
  // annoncée par le titre.
  const displaySubtitleGen = isNaughtyMode ? "Laisse l'algorithme composer la bande-son idéale pour cette soirée." : "Laisse l'algorithme générer la bande-son ultime pour pulvériser tes objectifs.";

  // En mode "Intime", pré-remplit le nom de la routine avec un nom rigolo tiré
  // au hasard de NAUGHTY_ROUTINE_NAMES, uniquement si le champ est encore vide.
  useEffect(() => {
    if(isSavingRoutineModalOpen && isNaughtyMode && newRoutineName === "") {
       setNewRoutineName(NAUGHTY_ROUTINE_NAMES[Math.floor(Math.random() * NAUGHTY_ROUTINE_NAMES.length)]);
       setNewRoutineIcon("🔥");
    }
  }, [isSavingRoutineModalOpen, isNaughtyMode]);

  // Réinitialise le décalage temporel du graphique (dataOffset) à chaque changement de
  // playlist affichée, et pré-sélectionne la séance réelle la plus récente (s'il y en a)
  // pour l'affichage "Cible vs Réalité".
  useEffect(() => {
    setDataOffset(0);
    const datesWithData = currentPlaylist?.actualDataByDate ? Object.keys(currentPlaylist.actualDataByDate).sort() : [];
    setSelectedAnalysisDate(datesWithData.length > 0 ? datesWithData[datesWithData.length - 1] : null);
  }, [currentPlaylist?.id]);

  // Données réelles (Garmin/Strava) de la séance actuellement sélectionnée pour analyse
  // — remplace l'ancien `currentPlaylist.actualData` unique par un accès à la bonne
  // entrée de `actualDataByDate` selon `selectedAnalysisDate`.
  const currentActualData = (currentPlaylist && currentPlaylist.actualDataByDate && selectedAnalysisDate)
    ? currentPlaylist.actualDataByDate[selectedAnalysisDate]
    : null;

  // Quelles métriques sont réellement présentes dans la séance affichée — un même
  // fichier CSV Garmin/Strava peut contenir la cadence, la fréquence cardiaque, ou
  // les deux (elles viennent du même export par tour, pas d'imports séparés).
  const availableMetrics = {
    cadence: !!(currentActualData && currentActualData.some(d => d.cadenceReelle !== undefined)),
    heartRate: !!(currentActualData && currentActualData.some(d => d.heartRate !== undefined)),
  };

  // Si la métrique actuellement choisie n'existe pas pour la séance affichée (ex. on
  // vient de changer de date, ou ce CSV ne contenait que l'une des deux), on bascule
  // automatiquement sur celle qui est disponible plutôt que d'afficher un graphique vide.
  useEffect(() => {
    if (!currentActualData) return;
    if (selectedMetric === 'cadence' && !availableMetrics.cadence && availableMetrics.heartRate) setSelectedMetric('heartRate');
    else if (selectedMetric === 'heartRate' && !availableMetrics.heartRate && availableMetrics.cadence) setSelectedMetric('cadence');
  }, [currentActualData, selectedAnalysisDate]);

  // Le <title> de la page est écrit en dur dans index.html (hors de portée de React),
  // donc il ne suivait jamais le mode Intime. On le met à jour manuellement ici pour
  // que la personnalisation soit vraiment complète, jusque dans l'onglet du navigateur.
  useEffect(() => {
    document.title = isNaughtyMode ? 'TempoIntime' : 'TempoFit';
  }, [isNaughtyMode]);

  // Affiche un toast temporaire. `variant` détermine le style et la durée :
  //   - 'default' (3s) : confirmation neutre (icône check)
  //   - 'special'  (5s) : mise en avant positive, ex. déblocage de trophée (icône trophée dorée)
  //   - 'error'    (5s) : échec/erreur à signaler clairement (icône alerte rouge)
  const showToast = (message, variant = 'default') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), variant === 'default' ? 3000 : 5000);
  };

  const changeView = (newView) => { 
    setView(newView); 
    setIsMobileMenuOpen(false); 
    if (newView === 'generator') setWizardStep(1); // Repart toujours à l'étape 1 du wizard
  };

  const getActiveWorkoutName = () => (workoutType === 'Autre' && customActivity.trim() !== '') ? customActivity : workoutType;

  // Hash simple et stable (même routine → toujours le même résultat, pas aléatoire
  // à chaque re-render) utilisé pour attribuer un nom/icône "Intime" cohérent à une
  // routine existante, sans jamais modifier ses vraies données sauvegardées (nom,
  // config, musiques). Purement cosmétique, à l'affichage seulement.
  const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = (hash * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(hash);
  };
  const getDisplayRoutineName = (routine) => isNaughtyMode ? NAUGHTY_ROUTINE_NAMES[simpleHash(routine.id) % NAUGHTY_ROUTINE_NAMES.length] : routine.name;
  const getDisplayRoutineIcon = (routine) => isNaughtyMode ? NAUGHTY_ROUTINE_NAMES[simpleHash(routine.id) % NAUGHTY_ROUTINE_NAMES.length].split(' ')[0] : routine.coverIcon;

  /**
   * Ligne d'infos partagée par les cartes de Routine, Playlist (Mes Playlists) et
   * Historique — avant, chacune affichait un mélange différent de champs, dans un
   * ordre différent, ce qui rendait les trois vues incohérentes entre elles. Ordre
   * unique désormais : Activité → Distance/Durée → BPM (ou phases si Fractionné)
   * → Style musical, partout. `extra` permet d'ajouter un élément propre à un
   * contexte précis (ex. le nombre de titres, qui n'existe que pour une playlist
   * déjà générée — une routine n'a pas encore de titres concrets).
   */
  const renderConfigInfoLine = (source, extra) => {
    const distanceOrDuration = source.targetMode === 'distance'
      ? `${source.distanceVal} ${source.distanceUnit}`
      : `${source.hours || 0}h ${source.minutes || 0}m`;
    const genres = source.selectedGenres && source.selectedGenres.length > 0 ? source.selectedGenres : [];
    return (
      <div className={`text-sm flex flex-wrap items-center gap-x-3 gap-y-1 ${textMuted} mt-2`}>
        <div className="flex items-center space-x-1"><Activity size={14}/><span>{source.workoutType}{source.customActivity ? ` (${source.customActivity})` : ''}</span></div>
        <div className="flex items-center space-x-1"><Clock size={14}/><span>{distanceOrDuration}</span></div>
        <div className="flex items-center space-x-1"><Zap size={14}/><span>{source.isIntervalMode ? `${(source.segments || []).length} phases` : `${source.bpm} BPM`}</span></div>
        {genres.length > 0 && <div className="flex items-center space-x-1"><Music size={14}/><span>{genres.join(', ')}</span></div>}
        {extra}
      </div>
    );
  };

  const handleOpenCustomActivityModal = () => {
    setWorkoutType('Autre');
    setTempCustomActivity(customActivity);
    setIsCustomActivityModalOpen(true);
  };

  // Bascule le "mode Intime" : change à la volée les réglages par défaut
  // (BPM plus bas, genres différents, crossfade plus long...) pour coller à
  // l'ambiance, et les restaure au retour au mode standard.
  const toggleNaughtyMode = () => {
    if (!isNaughtyMode) {
      setIsNaughtyMode(true);
      // isIntervalMode n'est plus forcé à false ici : le mode Fractionné reste
      // proposé en mode Intime (voir étape 2 du wizard), donc son état ne doit
      // plus être écrasé silencieusement à l'activation du mode.
      setBpm(85); setBpmTolerance(15); setSelectedGenres(['R&B Sensuel']); setTargetMode('time');
      setCrossfade(5); 
      showToast("Ambiance intime activée...", 'special');
    } else {
      setIsNaughtyMode(false);
      setBpm(160); setBpmTolerance(10); setSelectedGenres(['Métal']); setCrossfade(2);
      showToast("Retour au mode Standard !");
    }
  };

  // Ajoute/retire un genre de la sélection, en empêchant de désélectionner le dernier
  // genre restant (il en faut toujours au moins un pour générer une playlist).
  const toggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  // Ajoute/retire un genre du genre SPÉCIFIQUE d'une portion en mode Fractionné
  // (override qui prime sur le genre global de la séance — voir buildSegmentTracks).
  // Un segment sans selectedGenres (undefined) utilise le genre global ; dès qu'on
  // coche un genre ici, la portion bascule sur sa propre sélection indépendante.
  const toggleSegmentGenre = (segmentId, genre) => {
    setSegments(segments.map(s => {
      if (s.id !== segmentId) return s;
      const current = s.selectedGenres || [];
      if (current.includes(genre)) {
        const updated = current.filter(g => g !== genre);
        // Liste vidée : on ne laisse jamais une portion sans AUCUN genre, on
        // repasse simplement en "pas d'override" (undefined = genre global).
        return { ...s, selectedGenres: updated.length > 0 ? updated : undefined };
      }
      return { ...s, selectedGenres: [...current, genre] };
    }));
  };

  // Retire l'override de genre d'une portion : elle revient au genre global de
  // la séance plutôt que de garder une sélection propre.
  const resetSegmentGenre = (segmentId) => {
    setSegments(segments.map(s => s.id === segmentId ? { ...s, selectedGenres: undefined } : s));
  };

  // Sauvegarde la configuration actuelle du wizard comme routine réutilisable.
  const handleSaveRoutine = () => {
    const finalName = newRoutineName.trim() || `Routine ${workoutType === 'Autre' ? customActivity || 'Personnalisée' : workoutType}`;
    const newRoutine = {
      id: `routine-${Date.now()}`, name: finalName, workoutType,
      customActivity: workoutType === 'Autre' ? customActivity : '', isIntervalMode, bpm,
      targetMode, distanceVal, distanceUnit, paceMin, paceSec, hours, minutes, selectedGenres, bpmTolerance, crossfade,
      segments: isIntervalMode ? [...segments] : [], coverIcon: newRoutineIcon, autoGenFreq: newRoutineFreq,
      manualGenerations: 0, recentTrackIds: [], createdAt: new Date().toLocaleDateString()
    };
    setRoutines([newRoutine, ...routines]);
    setNewRoutineName(""); setNewRoutineIcon("⚡"); setNewRoutineFreq("Manuel"); setIsSavingRoutineModalOpen(false);
    showToast(`Routine sauvegardée avec succès !`);
  };

  /**
   * Lance une génération à partir de `editingRoutine` (la version modifiée dans la
   * modale d'édition), sans jamais toucher à la routine sauvegardée dans `routines`.
   * Utilisée par le bouton "Cette séance seulement".
   */
  const applyRoutineEditOnce = () => {
    if (!editingRoutine) return;
    executeGeneration({ ...editingRoutine, workoutName: editingRoutine.customActivity || editingRoutine.workoutType, routineName: editingRoutine.name }, 1, editingRoutine.id);
    setIsEditRoutineModalOpen(false);
    setEditingRoutine(null);
  };

  /**
   * Écrase la routine sauvegardée avec les valeurs modifiées dans `editingRoutine`,
   * PUIS lance une génération avec ces nouvelles valeurs. Utilisée par le bouton
   * "Toujours pour cette routine".
   */
  const applyRoutineEditPermanently = () => {
    if (!editingRoutine) return;
    setRoutines(routines.map(r => r.id === editingRoutine.id ? { ...editingRoutine } : r));
    executeGeneration({ ...editingRoutine, workoutName: editingRoutine.customActivity || editingRoutine.workoutType, routineName: editingRoutine.name }, 1, editingRoutine.id);
    showToast("Routine mise à jour pour toutes les prochaines séances.");
    setIsEditRoutineModalOpen(false);
    setEditingRoutine(null);
  };

  /**
   * Recalcule les horodatages de démarrage de chaque morceau (startTimeStr,
   * startDistVal) et la durée totale de la playlist, en tenant compte du
   * crossfade (chaque morceau, sauf le dernier, "mange" `crossfade` secondes
   * sur le suivant pour créer un enchaînement sans blanc).
   * À rappeler après toute modification de la liste de morceaux (ajout,
   * suppression, remplacement).
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
   * Génère une playlist complète à partir d'une config de wizard/routine.
   * 1. Découpe la séance en "segments" (1 seul segment en mode simple, un par
   *    portion en mode fractionné), chacun avec un BPM cible et une durée en secondes.
   * 2. Pour chaque segment, pioche des morceaux via getSingleMatchingTrack jusqu'à
   *    couvrir la durée du segment (boucle while), en évitant les doublons
   *    (usedYoutubeIds) au sein de la playlist entière.
   * 3. Calcule un nom de playlist selon le mode (naughty / fractionné / routine...).
   * 4. Recalcule la timeline finale (horodatages, durée totale) avant de renvoyer l'objet.
   *
   * `initialExcludeIds` : titres à exclure DÈS LE DÉPART (pas seulement au sein de
   * cette playlist) — utilisé par executeGeneration pour éviter de répéter des
   * titres déjà utilisés lors de générations précédentes de la même routine (voir
   * `routine.recentTrackIds`), en plus des doublons internes à la playlist elle-même.
   */
  const createPlaylistData = async (config, initialExcludeIds = []) => {
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
            });
            usedYoutubeIds.push(randomTrack.youtubeId);
        });
    }

    const finalWorkoutName = isNaughtyMode ? 'Ambiance' : config.workoutName;
    let generatedName = isNaughtyMode ? `Moment Intime` : (config.isIntervalMode ? `Fractionné : ${finalWorkoutName}` : `Session ${finalWorkoutName}`);
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

  // Ajoute la playlist en cours d'affichage à l'historique (si pas déjà sauvegardée).
  const handleSavePlaylist = () => {
    if (currentPlaylist && !savedPlaylists.find(p => p.id === currentPlaylist.id)) {
      setSavedPlaylists([{...currentPlaylist, status: 'pending'}, ...savedPlaylists]);
      showToast("Playlist ajoutée à ta bibliothèque !");
    }
  };

  /**
   * Point d'entrée principal de la génération, appelé depuis le wizard (count=1)
   * ou depuis une routine (count=1..10, génération en lot / "batch").
   * Enchaîne : détection de trophées liés à la config (marathon, foudre, HIIT
   * complexe, easter egg Rick Astley) → génération effective de `count`
   * playlist(s) → navigation vers la vue résultat (1 playlist) ou vers
   * l'historique (plusieurs playlists générées d'un coup).
   */
  const executeGeneration = async (config, count = 1, routineId = null) => {
    // Garde-fou : si la distance/durée saisie est vide ou nulle, la durée totale
    // calculée de la séance tombe à 0 seconde. Sans cette vérification, la boucle
    // de génération de morceaux (dans createPlaylistData) ne s'exécute alors
    // jamais et produit silencieusement une playlist VIDE (zéro morceau) — ce qui
    // se manifestait ensuite par un graphique BPM vide, sans qu'aucune erreur
    // n'indique la vraie cause. On bloque maintenant la génération en amont avec
    // un message clair, plutôt que de laisser passer une playlist inutilisable.
    let computedDurationSecs;
    if (config.isIntervalMode) {
      const unitPaceSecs = config.targetMode === 'distance' ? ((parseInt(config.paceMin)||0)*60 + (parseInt(config.paceSec)||0)) : 60;
      computedDurationSecs = (config.segments || []).reduce((sum, s) => sum + (parseFloat(s.durationValue) || 0) * unitPaceSecs, 0);
    } else if (config.targetMode === 'distance') {
      const unitPaceSecs = (parseInt(config.paceMin)||0)*60 + (parseInt(config.paceSec)||0);
      computedDurationSecs = (parseFloat(config.distanceVal) || 0) * unitPaceSecs;
    } else {
      computedDurationSecs = (parseInt(config.hours) || 0) * 3600 + (parseInt(config.minutes) || 0) * 60;
    }
    if (!computedDurationSecs || computedDurationSecs <= 0) {
      showToast("Renseigne une distance ou une durée avant de générer.", 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratingTotal(count);
    setGeneratingDone(0);
    let statsUpdated = false;
    let newStats = { ...userStats };

    if ((config.targetMode === 'distance' && config.distanceVal >= 42) || (!config.isIntervalMode && config.targetMode === 'time' && config.hours >= 4)) {
      if (!newStats.hasMarathon) { newStats.hasMarathon = true; statsUpdated = true; }
    }
    if ((!config.isIntervalMode && config.bpm >= 180) || (config.targetMode === 'distance' && config.paceMin < 4)) {
      if (!newStats.hasBolt) { newStats.hasBolt = true; statsUpdated = true; }
    }
    if (config.isIntervalMode && config.segments.length >= 5) {
      if (!newStats.hasHiitMaster) { newStats.hasHiitMaster = true; statsUpdated = true; }
    }
    if (config.workoutName && config.workoutName.toLowerCase().includes('rick astley')) {
      if (!newStats.hasRickroll) { newStats.hasRickroll = true; statsUpdated = true; }
    }
    if (statsUpdated) checkTrophies(newStats);

    // Historique glissant des titres déjà utilisés par CETTE routine (toutes
    // générations précédentes confondues), pour éviter de reproduire la même
    // playlist à chaque régénération — voir `routine.recentTrackIds`.
    // Volontairement PLAFONNÉ (RECENT_TRACKS_CAP) plutôt qu'illimité : sur une
    // routine à genre/BPM étroit, exclure indéfiniment tous les titres déjà
    // utilisés finirait par vider le pool de candidats et forcer un repli de
    // moins bonne qualité — mieux vaut laisser les plus anciens titres redevenir
    // éligibles après quelques générations que dégrader la qualité pour garantir
    // un "jamais deux fois le même titre" absolu.
    const RECENT_TRACKS_CAP = 60;
    const sourceRoutine = routineId ? routines.find(r => r.id === routineId) : null;
    let rollingExcludeIds = sourceRoutine ? [...(sourceRoutine.recentTrackIds || [])] : [];

    const generatedPlaylists = [];
    for (let i = 0; i < count; i++) {
      const pl = await createPlaylistData(config, rollingExcludeIds);
      if (count > 1) pl.name = `${pl.name} (Session ${i + 1})`;
      generatedPlaylists.push(pl);
      setGeneratingDone(i + 1);
      // Les titres de CETTE playlist s'ajoutent immédiatement à l'exclusion pour
      // les sessions SUIVANTES du même lot (ex. "générer 6 fois d'un coup") — sans
      // ça, un lot généré en une fois aurait le même problème de répétition que
      // deux générations séparées dans le temps.
      rollingExcludeIds = [...rollingExcludeIds, ...pl.tracks.map(t => t.youtubeId)];

      // Petite pause entre deux playlists d'un même lot (pas après la dernière) :
      // générer plusieurs playlists d'affilée déclenche une rafale d'appels Deezer
      // très rapprochés (jusqu'à ~60 par playlist rien que pour le pool principal),
      // ce qui peut atteindre le rate-limiting de Deezer/du proxy Vercel — observé
      // en pratique sur un lot de 10, où les dernières sessions retombaient presque
      // entièrement sur le repli local (faute de réponse Deezer). Cette pause
      // ralentit un peu la génération d'un gros lot, mais réduit le risque que les
      // dernières playlists du lot soient de moins bonne qualité que les premières.
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    setIsGenerating(false);

    if (routineId) {
      setRoutines(routines.map(r => r.id === routineId
        ? { ...r, manualGenerations: (r.manualGenerations || 0) + count, recentTrackIds: rollingExcludeIds.slice(-RECENT_TRACKS_CAP) }
        : r));
    }

    if (count === 1) {
      setCurrentPlaylist(generatedPlaylists[0]);
      changeView('playlist');
      // Transparence : les morceaux ont une durée fixe (on ne peut pas couper une
      // chanson en deux), donc la distance/durée réellement atteinte peut différer
      // légèrement de la cible demandée — mieux vaut le dire que laisser croire à
      // une précision parfaite.
      showToast("🎧 Playlist générée ! Distance/durée réelle : peut légèrement différer de la cible.");
      // Deuxième avertissement, distinct : si une part importante des titres vient
      // du repli de secours (voir fallbackTrackCount), c'est le signe qu'il n'y
      // avait pas assez de vrais candidats pour ce BPM/style — l'utilisateur doit
      // le savoir plutôt que de découvrir silencieusement des titres approximatifs.
      const pl = generatedPlaylists[0];
      if (pl.tracks.length > 0 && pl.fallbackTrackCount / pl.tracks.length >= 0.34) {
        showToast(`⚠️ Peu de titres trouvés à ce BPM/style précis — ${pl.fallbackTrackCount} sur ${pl.tracks.length} viennent d'un choix de secours approximatif.`, 'error');
      }
    } else {
      setSavedPlaylists([...generatedPlaylists, ...savedPlaylists]);
      changeView('playlists');
      showToast(`${count} playlists générées ! Distance/durée réelle : peut légèrement différer de la cible.`);
      const totalFallback = generatedPlaylists.reduce((s, p) => s + (p.fallbackTrackCount || 0), 0);
      const totalTracks = generatedPlaylists.reduce((s, p) => s + p.tracks.length, 0);
      if (totalTracks > 0 && totalFallback / totalTracks >= 0.34) {
        showToast(`⚠️ Peu de titres trouvés à ce BPM/style précis sur cette série — pas mal de choix de secours approximatifs.`, 'error');
      }
    }
  };

  // Retire un morceau de la playlist en cours et recalcule la timeline en conséquence.
  const handleRemoveTrack = (indexToRemove) => {
    if (!currentPlaylist) return;
    const newTracks = [...currentPlaylist.tracks];
    newTracks.splice(indexToRemove, 1);

    let updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);

    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
  };

  // handleMoveTrack (flèches ↑/↓) supprimée : remplacée par le glisser-déposer
  // ci-dessous (handleTrackDragStart/handleTrackDragEnter/handleTrackDragEnd),
  // plus naturel et qui libère de la place sur la ligne de titre.

  /**
   * Duplique un titre de la playlist (le remet juste après lui-même) — permet de
   * mettre plusieurs fois le même morceau sans repasser par la recherche à chaque
   * fois. Le bouton "+" fait office d'ajout ; le "X" déjà existant sur chaque
   * occurrence fait office de retrait, pas besoin d'un compteur séparé.
   */
  const handleDuplicateTrack = (index) => {
    if (!currentPlaylist) return;
    const newTracks = [...currentPlaylist.tracks];
    const duplicated = { ...newTracks[index], id: `track-dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
    newTracks.splice(index + 1, 0, duplicated);

    let updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);

    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    showToast("🎵 Titre dupliqué !");
  };

  const handleRenamePlaylist = () => {
    const trimmed = editedPlaylistName.trim();
    if (!trimmed || !currentPlaylist) { setIsEditingPlaylistName(false); return; }
    const updatedPlaylist = { ...currentPlaylist, name: trimmed };
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    setIsEditingPlaylistName(false);
  };

  // Remplace un morceau par un autre correspondant au même BPM cible (utilise
  // à nouveau la cascade Spotify → local → API mondiale → fallback le plus proche).
  const handleReplaceTrack = async (indexToReplace) => {
    if (!currentPlaylist) return;
    let stats = { ...userStats, replacedTracks: userStats.replacedTracks + 1 };
    checkTrophies(stats);

    const oldTrack = currentPlaylist.tracks[indexToReplace];
    const usedIds = currentPlaylist.tracks.map(t => t.youtubeId);
    
    // Requête asynchrone modifiée pour taper dans l'API si nécessaire
    const newRawTrack = await getSingleMatchingTrack(oldTrack.targetSegmentBpm, currentPlaylist.tolerance || 10, currentPlaylist.config?.selectedGenres || ['Métal'], usedIds, favorites, spotifyTrackPool);

    const newTracks = [...currentPlaylist.tracks];
    newTracks[indexToReplace] = {
      ...newTracks[indexToReplace], title: newRawTrack.title, artist: newRawTrack.artist,
      genre: newRawTrack.genre, bpm: newRawTrack.bpm, duration: newRawTrack.duration,
      youtubeId: newRawTrack.youtubeId, id: `track-replaced-${Date.now()}`,
      preview: newRawTrack.preview || null
    };

    let updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);

    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    showToast("🎵 Titre remplacé et durée ajustée !");
  };

  // handleReplaceTrackFromFavorites supprimée : redondante avec "Remplacer (recherche
  // large)", qui vérifie déjà les favoris en tout premier via getSingleMatchingTrack.
  // Ne gardait comme vraie différence que l'absence de repli automatique, ce qui
  // n'était pas une distinction assez utile pour justifier un 3e bouton dans le menu.

  /**
   * Variante de handleReplaceTrack qui privilégie un autre titre du MÊME artiste
   * (recherche Deezer combinée artist:/bpm_min/bpm_max), plutôt que la recherche
   * large habituelle. Si aucun autre titre de cet artiste ne correspond au BPM
   * demandé, on retombe sur la recherche large classique pour ne jamais bloquer.
   */
  const handleReplaceTrackSameArtist = async (indexToReplace) => {
    if (!currentPlaylist) return;
    const oldTrack = currentPlaylist.tracks[indexToReplace];
    const usedIds = currentPlaylist.tracks.map(t => t.youtubeId);
    const minBpm = oldTrack.targetSegmentBpm - (currentPlaylist.tolerance || 10);
    const maxBpm = oldTrack.targetSegmentBpm + (currentPlaylist.tolerance || 10);

    let newRawTrack = null;
    try {
      const q = `artist:"${oldTrack.artist}" bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"`;
      const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`);
      const stubs = (data && Array.isArray(data.data) ? data.data : []).filter(s => !usedIds.includes(`deezer-${s.id}`));
      if (stubs.length > 0) {
        const details = await Promise.all(stubs.map(async (s) => {
          const { data: full } = await deezerFetch(`https://api.deezer.com/track/${s.id}`);
          return full;
        }));
        const valid = details.filter(f => f && f.bpm && parseFloat(f.bpm) >= minBpm && parseFloat(f.bpm) <= maxBpm);
        if (valid.length > 0) {
          const pick = valid[Math.floor(Math.random() * valid.length)];
          const realGenre = await resolveDeezerGenre(pick.id);
          newRawTrack = {
            title: pick.title, artist: pick.artist ? pick.artist.name : oldTrack.artist,
            genre: realGenre || 'Genre inconnu', bpm: Math.round(parseFloat(pick.bpm)), duration: pick.duration || 180,
            youtubeId: `deezer-${pick.id}`, preview: pick.preview || null
          };
        }
      }
    } catch (e) {
      // Échec silencieux : on retombe sur la recherche large ci-dessous.
    }

    // Repli sur la recherche large habituelle si aucun autre titre de cet artiste n'a été trouvé.
    if (!newRawTrack) {
      newRawTrack = await getSingleMatchingTrack(oldTrack.targetSegmentBpm, currentPlaylist.tolerance || 10, currentPlaylist.config?.selectedGenres || ['Métal'], usedIds, favorites, spotifyTrackPool);
      showToast(`Aucun autre titre de ${oldTrack.artist} à ce BPM — recherche élargie utilisée.`);
    } else {
      let stats = { ...userStats, replacedTracks: userStats.replacedTracks + 1 };
      checkTrophies(stats);
      showToast(`🎵 Remplacé par un autre titre de ${newRawTrack.artist} !`);
    }

    const newTracks = [...currentPlaylist.tracks];
    newTracks[indexToReplace] = {
      ...newTracks[indexToReplace], title: newRawTrack.title, artist: newRawTrack.artist,
      genre: newRawTrack.genre, bpm: newRawTrack.bpm, duration: newRawTrack.duration,
      youtubeId: newRawTrack.youtubeId, id: `track-replaced-${Date.now()}`,
      preview: newRawTrack.preview || null
    };

    let updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);

    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
  };

  // --- Glisser-déposer pour réordonner les titres — remplace les flèches ↑/↓,
  // plus naturel et ça libère de la place sur une ligne déjà chargée d'actions.
  const [draggedTrackIndex, setDraggedTrackIndex] = useState(null);
  const handleTrackDragStart = (index) => (e) => {
    setDraggedTrackIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleTrackDragEnter = (index) => (e) => {
    e.preventDefault();
    if (draggedTrackIndex === null || draggedTrackIndex === index || !currentPlaylist) return;
    const newTracks = [...currentPlaylist.tracks];
    const [moved] = newTracks.splice(draggedTrackIndex, 1);
    newTracks.splice(index, 0, moved);
    let updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    setDraggedTrackIndex(index);
  };
  const handleTrackDragEnd = () => setDraggedTrackIndex(null);

  // Menu d'options par titre (Dupliquer / Remplacer large / Remplacer même artiste),
  // regroupées derrière une seule icône "⋮" plutôt que plusieurs boutons permanents.
  const [openTrackMenuIndex, setOpenTrackMenuIndex] = useState(null);

  // Ajoute manuellement un morceau choisi dans la modale de recherche (locale ou API mondiale).
  const handleAddManualTrack = (rawTrack) => {
    if(!currentPlaylist) return;
    const newTrackObj = {
      ...rawTrack,
      targetSegmentBpm: rawTrack.bpm,
      id: `track-manual-${Date.now()}`
    };
    let updatedPlaylist = { ...currentPlaylist, tracks: [...currentPlaylist.tracks, newTrackObj] };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);

    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    setIsSearchModalOpen(false);
    setSearchQuery("");
    showToast("🎵 Titre ajouté avec succès !");
  };

  // Compare newStats aux conditions de TROPHIES_DATA et débloque les nouveaux
  // trophées éligibles. N'affiche qu'un seul toast même si plusieurs trophées
  // sont débloqués d'un coup (affiche le premier de la liste).
  const checkTrophies = (newStats) => {
    const newlyUnlocked = TROPHIES_DATA.filter(t => {
      if (newStats.unlockedTrophies.includes(t.id)) return false;
      if (t.requirement.type === 'total' && newStats.totalCompleted >= t.requirement.count) return true;
      if (t.requirement.type === 'naughty' && newStats.naughtyCompleted >= t.requirement.count) return true;
      if (t.requirement.type === 'data' && newStats.dataImports >= t.requirement.count) return true;
      if (t.requirement.type === 'replace' && newStats.replacedTracks >= t.requirement.count) return true;
      if (t.requirement.type === 'custom' && newStats[t.requirement.key]) return true;
      return false;
    });

    if (newlyUnlocked.length > 0) {
      setUserStats({ ...newStats, unlockedTrophies: [...newStats.unlockedTrophies, ...newlyUnlocked.map(t => t.id)] });
      showToast(`🏆 Trophée débloqué : ${newlyUnlocked[0].name} !`, 'special');
    } else {
      setUserStats(newStats);
    }
  };

  // Marque une playlist de l'historique comme "faite", met à jour les stats
  // (dont la détection "Oiseau de Nuit" selon l'heure locale) et vérifie les trophées.
  /**
   * Ajoute la date du jour à l'historique des complétions de la playlist (voir
   * playlist.completions), plutôt que de simplement basculer un statut booléen
   * "faite/pas faite". Ce choix permet de marquer la MÊME playlist comme faite
   * plusieurs fois (une entrée par vraie utilisation), sans dupliquer toute la
   * playlist à chaque fois — ce qui aurait recréé inutilement les mêmes titres et
   * pollué "Mes Playlists" d'un doublon par séance.
   */
  // Formate une date ISO (YYYY-MM-DD, format natif de <input type="date">) en
  // date lisible localement — les completions sont désormais stockées en ISO en
  // interne (nécessaire pour pouvoir les éditer via un vrai sélecteur de date),
  // et seulement formatées au moment de l'affichage.
  const formatCompletionDate = (isoStr) => {
    const d = new Date(isoStr + 'T00:00:00');
    return isNaN(d.getTime()) ? isoStr : d.toLocaleDateString();
  };

  const markPlaylistAsCompleted = (e, playlistId) => {
    e.stopPropagation();
    const pl = savedPlaylists.find(p => p.id === playlistId);
    if (!pl) return;

    const todayIso = new Date().toISOString().split('T')[0];
    const existingCompletions = pl.completions || [];
    // Évite d'empiler plusieurs entrées identiques si on clique par erreur deux
    // fois le même jour — une seule entrée par jour a du sens.
    if (existingCompletions.includes(todayIso)) {
      showToast("Déjà marquée comme faite aujourd'hui !");
      return;
    }
    const updatedCompletions = [...existingCompletions, todayIso].sort();

    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, completions: updatedCompletions } : p));

    const hour = new Date().getHours();
    const isNight = hour >= 22 || hour <= 4;

    let stats = {
      ...userStats,
      totalCompleted: userStats.totalCompleted + 1,
      naughtyCompleted: userStats.naughtyCompleted + (pl.isNaughty ? 1 : 0),
      hasNightOwl: userStats.hasNightOwl || isNight
    };
    checkTrophies(stats);
    if(stats.unlockedTrophies.length === userStats.unlockedTrophies.length) {
      showToast(updatedCompletions.length > 1 ? `Séance re-marquée comme faite ! (${updatedCompletions.length}e fois) 💪` : "Session marquée comme terminée ! 💪");
    }
  };

  /**
   * Ajoute une date de complétion PRÉCISE (choisie via un input date), à la
   * différence de markPlaylistAsCompleted qui ajoute toujours la date du jour.
   * Permet de renseigner une séance faite un autre jour (rattrapage, oubli...).
   */
  const addCompletionDate = (playlistId, isoDate) => {
    if (!isoDate) return;
    setSavedPlaylists(savedPlaylists.map(p => {
      if (p.id !== playlistId) return p;
      const existing = p.completions || [];
      if (existing.includes(isoDate)) { showToast("Cette date est déjà enregistrée."); return p; }
      return { ...p, completions: [...existing, isoDate].sort() };
    }));
  };

  /**
   * Retire une date de complétion précise. Si c'était la DERNIÈRE restante, la
   * playlist n'a alors plus aucune complétion : elle disparaît de l'Historique et
   * retourne dans "Mes Playlists" (son statut n'est plus que dérivé de la présence
   * ou non de complétions, voir plus haut). On prévient clairement de cette
   * conséquence plutôt que de laisser l'utilisateur la découvrir après coup —
   * mais on laisse quand même l'action se faire, puisque c'est explicitement ce
   * qui est demandé.
   */
  const removeCompletionDate = (playlistId, isoDate) => {
    const pl = savedPlaylists.find(p => p.id === playlistId);
    if (!pl) return;
    const remaining = (pl.completions || []).filter(d => d !== isoDate);
    // Si des données Garmin/Strava étaient rattachées à CETTE date précise, on les
    // retire aussi — les garder n'aurait plus de sens sans la date de complétion
    // qu'elles étaient censées documenter.
    const remainingActualData = { ...(pl.actualDataByDate || {}) };
    delete remainingActualData[isoDate];

    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, completions: remaining, actualDataByDate: remainingActualData } : p));

    if (remaining.length === 0) {
      showToast("Dernière date retirée : cette playlist n'a plus aucune complétion, elle repasse dans \"Mes Playlists\".", 'error');
    }
  };

  /**
   * Modifie une date de complétion existante (remplace oldIso par newIso).
   */
  const editCompletionDate = (playlistId, oldIso, newIso) => {
    if (!newIso || oldIso === newIso) return;
    setSavedPlaylists(savedPlaylists.map(p => {
      if (p.id !== playlistId) return p;
      const existing = p.completions || [];
      if (existing.includes(newIso)) { showToast("Cette date est déjà enregistrée."); return p; }
      const updated = existing.map(d => d === oldIso ? newIso : d).sort();
      // Si des données réelles étaient rattachées à l'ancienne date, on les
      // déplace vers la nouvelle plutôt que de les perdre.
      let updatedActualData = p.actualDataByDate || {};
      if (updatedActualData[oldIso] !== undefined) {
        updatedActualData = { ...updatedActualData };
        updatedActualData[newIso] = updatedActualData[oldIso];
        delete updatedActualData[oldIso];
      }
      return { ...p, completions: updated, actualDataByDate: updatedActualData };
    }));
  };

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
    // que sur une date de complétion précise (voir renderCompletionsList), donc si
    // jamais il manque (état incohérent), on préfère bloquer plutôt que de deviner
    // à quelle séance rattacher les données.
    if (!file || !currentPlaylist || !csvUploadTargetDate) return;
    const targetDate = csvUploadTargetDate;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        if(lines.length < 2) throw new Error("Fichier vide ou invalide");

        const headers = lines[0].split('","').map(h => h.replace(/"/g, '').toLowerCase());
        const cadenceIdx = headers.findIndex(h => h.includes('cadence de course moyenne') || (h.includes('cadence') && h.includes('ppm')));
        const heartRateIdx = headers.findIndex(h => h.includes('fréquence cardiaque') || h.includes('frequence cardiaque') || h.includes('fc moyenne') || h.includes('heart rate'));
        const timeIdx = headers.findIndex(h => h.includes('temps cumulé') || h.includes('durée'));

        if(cadenceIdx === -1 && heartRateIdx === -1) { showToast("Erreur: aucune colonne de cadence ou de fréquence cardiaque trouvée dans ce fichier.", 'error'); return; }

        const parsedData = lines.slice(1).map((line, idx) => {
          const cols = line.split('","').map(c => c.replace(/"/g, ''));
          const cadenceVal = (cadenceIdx !== -1 && cols.length > cadenceIdx) ? (parseInt(cols[cadenceIdx]) || 0) : 0;
          const heartRateVal = (heartRateIdx !== -1 && cols.length > heartRateIdx) ? (parseInt(cols[heartRateIdx]) || 0) : 0;
          if(cadenceVal === 0 && heartRateVal === 0) return null;

          const timeSec = timeIdx !== -1 ? parseTimeToSeconds(cols[timeIdx]) : idx * 60;

          const point = { circuit: idx + 1, timeSec: timeSec };
          if (cadenceVal > 0) point.cadenceReelle = cadenceVal;
          if (heartRateVal > 0) point.heartRate = heartRateVal;
          return point;
        }).filter(Boolean);

        if(parsedData.length === 0) { showToast("Aucune donnée de cadence ou de fréquence cardiaque valide trouvée.", 'error'); return; }

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
        const hasCadence = parsedData.some(d => d.cadenceReelle !== undefined);
        const hasHeartRate = parsedData.some(d => d.heartRate !== undefined);
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

  // Prépare le contenu à partager (playlist ou trophée) et ouvre la modale de partage.
  const handleShare = (type, item) => {
    if (type === 'playlist') {
      setShareData({
        type: 'playlist', title: item.name,
        text: `Je viens de générer la session musicale parfaite de ${formatDuration(item.totalDuration)} pour mon entraînement sur TempoFit ! 💪🎧`,
        url: window.location.href
      });
    } else if (type === 'trophy') {
      setShareData({
        type: 'trophy', title: item.name,
        text: `J'ai débloqué le trophée "${item.name}" ${item.icon} sur TempoFit ! 🔥 Rejoins-moi !`,
        url: window.location.href
      });
    }
    setIsShareModalOpen(true);
  };

  // Copie le texte de partage dans le presse-papier via l'ancienne API execCommand
  // (fallback compatible même sans HTTPS/contexte sécurisé, contrairement à navigator.clipboard).
  const copyToClipboard = () => {
    if (!shareData) return;
    const textToCopy = `${shareData.text} ${shareData.url}`;
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.top = "0"; textArea.style.left = "0"; textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try { document.execCommand('copy'); showToast("Lien copié dans le presse-papier !"); } catch (err) {}
    document.body.removeChild(textArea);
    setIsShareModalOpen(false);
  };

  // Partage natif du téléphone/OS (menu "Partager" habituel avec toutes les apps
  // installées) — disponible sur mobile et certains navigateurs desktop récents,
  // pas partout. D'où les boutons de partage direct ci-dessous en complément, qui
  // fonctionnent eux partout puisqu'ils ouvrent juste une URL classique.
  const shareNative = async () => {
    if (!shareData || !navigator.share) return;
    try {
      await navigator.share({ title: shareData.title, text: shareData.text, url: shareData.url });
      setIsShareModalOpen(false);
    } catch (e) {
      // L'utilisateur a annulé le partage, ou l'API a échoué : on ne fait rien de spécial.
    }
  };

  const shareToWhatsApp = () => {
    if (!shareData) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank');
  };
  const shareToTwitter = () => {
    if (!shareData) return;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`, '_blank');
  };
  const shareToFacebook = () => {
    if (!shareData) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`, '_blank');
  };
  const shareViaEmail = () => {
    if (!shareData) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`;
  };

  // BUG CORRIGÉ : la valeur par défaut était 'musique', qui ne correspond à aucun
  // des deux cas gérés par le graphique ('temps' ou 'distance') — la clé de l'axe X
  // ('time' vs 'startDistVal') ne matchait donc jamais, et le graphique restait vide
  // par défaut malgré le bouton "Temps (Min)" visuellement sélectionné.
  const [chartAxisType, setChartAxisType] = useState('temps');
  // Unité d'affichage du graphique en mode Distance — purement cosmétique, ne
  // touche jamais à l'allure/l'unité réellement utilisées pour générer la
  // playlist (currentPlaylist.distanceUnit). null = utilise l'unité d'origine.
  const [chartDistanceUnitOverride, setChartDistanceUnitOverride] = useState(null);

  /**
   * Construit le jeu de données unifié pour le graphique BPM : fusionne la
   * courbe "cible" (un point par début/fin de morceau, tracée en "escalier"
   * avec type="stepAfter") et, si des données réelles ont été importées, la
   * courbe "réel" (un point par tour Garmin, décalé de `dataOffset` secondes
   * pour permettre à l'utilisateur de recaler manuellement les deux courbes
   * si le chrono du device n'était pas parfaitement synchronisé au démarrage).
   */
  const unifiedChartData = useMemo(() => {
    if (!currentPlaylist) return [];

    let combined = [];
    let accTime = 0;
    // Vitesse moyenne (secondes par km/mile) utilisée pour convertir un temps
    // écoulé en distance parcourue — même valeur que celle utilisée par
    // recalculateTimeline pour calculer track.startDistVal.
    const avgPaceSecs = currentPlaylist.avgPace || 330;

    currentPlaylist.tracks.forEach((track, i) => {
      // BUG CORRIGÉ : startDistVal n'était jamais calculé ici, alors que le mode
      // "Distance" du graphique en dépend comme clé d'axe X. Résultat : en mode
      // Distance, chaque point avait un X undefined → Recharts ne traçait rien
      // du tout (un <path> sans attribut "d"), silencieusement.
      // trackPreview/trackYoutubeId ajoutés pour permettre l'écoute d'extrait
      // directement au survol d'un point du graphique (dans le tooltip).
      combined.push({ time: accTime, startDistVal: accTime / avgPaceSecs, bpmTarget: track.bpm, trackName: track.title, trackArtist: track.artist, trackPreview: track.preview || null, trackYoutubeId: track.youtubeId, trackDuration: track.duration, isTrack: true });
      accTime += track.duration - (currentPlaylist.crossfade || 0);
    });
    if(currentPlaylist.tracks.length > 0) {
      combined.push({ time: accTime, startDistVal: accTime / avgPaceSecs, bpmTarget: currentPlaylist.tracks[currentPlaylist.tracks.length-1].bpm });
    }

    if (currentActualData) {
      currentActualData.forEach(d => {
        // Métrique effectivement affichée pour ce point : si la séance n'a pas
        // cette valeur précise (ex. FC manquante sur certains tours), on saute
        // le point plutôt que d'afficher un zéro trompeur.
        const rawValue = selectedMetric === 'heartRate' ? d.heartRate : d.cadenceReelle;
        if (rawValue === undefined) return;

        let t = d.timeSec + dataOffset;
        if(t >= 0 && t <= accTime + 300) {
          let target = null;
          let tempAcc = 0;
          for (let tr of currentPlaylist.tracks) {
            tempAcc += tr.duration - (currentPlaylist.crossfade || 0);
            if (t <= tempAcc) { target = tr.bpm; break; }
          }
          if(!target && currentPlaylist.tracks.length > 0) target = currentPlaylist.tracks[currentPlaylist.tracks.length-1].bpm;

          combined.push({ time: t, startDistVal: t / avgPaceSecs, realValue: rawValue, targetAtTime: target, title: `Tour Garmin ${d.circuit}` });
        }
      });
    }

    combined.sort((a,b) => a.time - b.time);
    return combined;
  }, [currentPlaylist, currentActualData, selectedMetric, dataOffset]);

  /**
   * Bornes [début, fin[ de chaque morceau, en temps ET en distance — calculées à
   * part de `unifiedChartData` (qui mélange aussi les points de données réelles
   * Garmin) pour avoir une source propre et fiable des segments musicaux. Sert à
   * deux choses : mettre en surbrillance tout le segment sélectionné (pas juste son
   * point de départ), et placer un repère vertical à chaque début de morceau.
   */
  const trackSegments = useMemo(() => {
    if (!currentPlaylist) return [];
    const avgPaceSecs = currentPlaylist.avgPace || 330;
    let accTime = 0;
    return currentPlaylist.tracks.map((track) => {
      const startTime = accTime;
      const startDist = accTime / avgPaceSecs;
      accTime += track.duration - (currentPlaylist.crossfade || 0);
      return { track, startTime, endTime: accTime, startDist, endDist: accTime / avgPaceSecs };
    });
  }, [currentPlaylist]);

  // Répartition de la playlist par tranche de BPM, pondérée par la DURÉE de chaque
  // titre (pas juste un compte de titres) — donne une vue "combien de temps de la
  // séance à chaque niveau d'intensité", complémentaire à la courbe déjà affichée.
  const bpmDistributionData = useMemo(() => {
    if (!currentPlaylist) return [];
    const buckets = {};
    currentPlaylist.tracks.forEach(t => {
      const bucketStart = Math.floor(t.bpm / 20) * 20;
      const label = `${bucketStart}-${bucketStart + 19}`;
      buckets[label] = (buckets[label] || 0) + t.duration;
    });
    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value, sortKey: parseInt(name) }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [currentPlaylist]);

  // Répartition par style musical, pondérée par la durée elle aussi. Le champ
  // `genre` de chaque titre est désormais résolu via la vraie chaîne Deezer
  // titre → album → genre_id → nom (voir resolveDeezerGenre) plutôt qu'hérité du
  // mot-clé de recherche — sans ça, ce graphique aurait surtout affiché le
  // critère de recherche utilisé, pas le vrai style du morceau.
  const genreDistributionData = useMemo(() => {
    if (!currentPlaylist) return [];
    const buckets = {};
    currentPlaylist.tracks.forEach(t => {
      const g = t.genre || 'Genre inconnu';
      buckets[g] = (buckets[g] || 0) + t.duration;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [currentPlaylist]);

  const DISTRIBUTION_COLORS = ['#f43f5e', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

  // Segment actuellement sélectionné (déterminé par la position X du curseur, pas par
  // le point de données le plus proche) — permet de mettre en surbrillance TOUTE
  // la largeur du segment plutôt qu'un simple sommet.
  // BUG UX CORRIGÉ : le survol continu était trop fragile en pratique (un léger
  // écart de trajectoire de la souris en remontant vers l'encart changeait de
  // segment sans le vouloir ; il fallait aussi rester immobile une seconde ou
  // deux avant que l'info n'apparaisse). Un CLIC fixe désormais l'affichage de
  // façon déterministe et instantanée, et reste stable jusqu'au clic suivant.
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState(null);

  // Une seule date de complétion éditable à la fois, tous playlists confondus —
  // évite d'avoir à suivre un état d'édition séparé par playlist/par date.
  const [editingCompletion, setEditingCompletion] = useState(null); // {playlistId, isoDate} | null

  /**
   * Liste interactive des dates de complétion d'une playlist — partagée entre
   * "Mes Playlists" et "Historique" pour rester cohérente. Chaque date : clic
   * pour modifier (ouvre un vrai sélecteur de date), croix pour retirer. Une
   * tuile en pointillés permet d'ajouter une date précise (pas seulement
   * "aujourd'hui", pour les séances renseignées après coup).
   */
  // Bordure + badge pour les éléments les plus utilisés (routines, playlists,
  // séances de l'historique) — même logique partagée aux 3 endroits. `rank` va
  // de 0 (le plus utilisé) à 2 ; au-delà, pas de distinction visuelle.
  const RANK_STYLES = [
    { emoji: '🥇', border: 'border-yellow-500 ring-2 ring-yellow-500/20' },
    { emoji: '🥈', border: 'border-gray-400 ring-2 ring-gray-400/20' },
    { emoji: '🥉', border: 'border-amber-700 ring-2 ring-amber-700/20' },
  ];
  const getRankStyle = (rank) => (rank >= 0 && rank < 3) ? RANK_STYLES[rank] : null;

  const renderCompletionsList = (playlist) => {
    const completions = playlist.completions || [];
    const dataByDate = playlist.actualDataByDate || {};
    return (
      <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center gap-1.5">
        {completions.map((iso) => {
          const isEditing = editingCompletion && editingCompletion.playlistId === playlist.id && editingCompletion.isoDate === iso;
          const hasData = !!dataByDate[iso];
          return isEditing ? (
            <input
              key={iso} type="date" autoFocus defaultValue={iso}
              onBlur={(e) => { editCompletionDate(playlist.id, iso, e.target.value); setEditingCompletion(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCompletion(null); }}
              className={`px-2 py-1 rounded-lg text-xs font-bold ${inputBg} border ${borderAccentClass} ${textHighlight}`}
            />
          ) : (
            <span key={iso} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${inputBg} border ${inputBorder} ${textHighlight}`}>
              <button onClick={() => setEditingCompletion({ playlistId: playlist.id, isoDate: iso })} className="hover:underline" title="Modifier cette date">
                {formatCompletionDate(iso)}
              </button>
              {/* Import Garmin/Strava rattaché à CETTE séance précise (pas à toute la
                  playlist) — une playlist refaite plusieurs fois peut donc avoir une
                  analyse Cible vs Réalité différente pour chaque date. */}
              <button
                onClick={(e) => triggerCSVUpload(e, playlist, iso)}
                className={hasData ? "text-purple-500 hover:text-purple-600 transition-colors" : "text-gray-400 hover:text-blue-500 transition-colors"}
                title={hasData ? "Données déjà importées pour cette séance (cadence et/ou FC) — cliquer pour remplacer" : "Importer les données Garmin/Strava de cette séance (cadence et/ou fréquence cardiaque)"}
              >
                <Upload size={12}/>
              </button>
              <button onClick={() => removeCompletionDate(playlist.id, iso)} className="text-gray-400 hover:text-red-500 transition-colors" title="Retirer cette date">
                <X size={12}/>
              </button>
            </span>
          );
        })}
        <label className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-dashed cursor-pointer ${inputBorder} ${textMuted} hover:${textHighlight} transition-colors`}>
          <Plus size={12}/> Ajouter une date
          <input type="date" className="hidden" onChange={(e) => { if (e.target.value) addCompletionDate(playlist.id, e.target.value); e.target.value = ''; }} />
        </label>
      </div>
    );
  };

  const handleChartClick = (state) => {
    if (!state || state.activeLabel === undefined || state.activeLabel === null) return;
    // En mode Distance, activeLabel est déjà dans l'unité d'AFFICHAGE convertie
    // (voir dataKey du XAxis) — on le reconvertit dans l'unité brute d'origine
    // avant de le comparer aux bornes de trackSegments, qui restent toujours
    // exprimées dans l'unité d'origine de la playlist.
    const rawCursorVal = chartAxisType === 'distance' ? parseFloat(state.activeLabel) / distanceDisplayFactor : parseFloat(state.activeLabel);
    const key = chartAxisType === 'distance' ? 'Dist' : 'Time';
    const idx = trackSegments.findIndex(seg => rawCursorVal >= seg[`start${key}`] && rawCursorVal < seg[`end${key}`]);
    if (idx >= 0) setSelectedSegmentIdx(idx);
  };

  // Domaines des axes calculés explicitement en JS, plutôt que de laisser Recharts
  // les déduire lui-même via les expressions "dataMax"/"dataMin" (qui semblent être
  // la cause du bug récurrent : graphique vide malgré des données valides). Ici, le
  // calcul est fait à la main, avec parseFloat/coercion numérique défensive, donc
  // le résultat est garanti correct quel que soit le type exact des valeurs sources.
  // Facteur de conversion appliqué uniquement à l'affichage du graphique — les
  // valeurs startDistVal sont toujours calculées dans l'unité d'origine de la
  // playlist (currentPlaylist.distanceUnit), ce facteur les convertit à la volée
  // si l'utilisateur a choisi de visualiser dans l'autre unité.
  const chartDistanceUnit = chartDistanceUnitOverride || (currentPlaylist ? currentPlaylist.distanceUnit : 'km') || 'km';
  const distanceDisplayFactor = useMemo(() => {
    if (!currentPlaylist || chartDistanceUnit === currentPlaylist.distanceUnit) return 1;
    // km -> mi : ×0.621371 ; mi -> km : ×1.60934
    return currentPlaylist.distanceUnit === 'km' ? 0.621371 : 1.60934;
  }, [currentPlaylist, chartDistanceUnit]);

  const chartXDomain = useMemo(() => {
    const key = chartAxisType === 'distance' ? 'startDistVal' : 'time';
    const factor = chartAxisType === 'distance' ? distanceDisplayFactor : 1;
    const values = unifiedChartData.map(d => parseFloat(d[key]) * factor).filter(v => !isNaN(v));
    if (values.length === 0) return [0, 1];
    return [0, Math.max(...values)];
  }, [unifiedChartData, chartAxisType, distanceDisplayFactor]);

  // Graduations explicites pour l'axe X, dans les deux modes — sans ça, Recharts
  // choisit lui-même un nombre de graduations "arbitraire" selon l'espace
  // disponible, ce qui pouvait sauter de "2" à "5.972727272727273" en Distance,
  // ou finir sur un "29m 46s" isolé en Temps (aucun repère régulier avant).
  //
  // Mode Distance : un repère tous les 1 km/mile, arrondi, PLUS la distance finale
  // exacte (précision 0.01 km/mile, soit la dizaine de mètres) ajoutée à part —
  // sans elle, la distance réellement parcourue en fin de séance ne correspondait
  // à aucune graduation ronde et n'était donc jamais lisible.
  //
  // Mode Temps : un repère par minute — mais SEULEMENT si la séance est assez
  // courte pour rester lisible (jusqu'à 10 min). Au-delà, un repère toutes les
  // minutes donnerait des dizaines d'étiquettes qui se chevauchent ; le pas
  // s'élargit alors automatiquement (2, 5, ou 10 min) pour rester lisible tout en
  // gardant des graduations bien régulières. Même logique de "durée finale ajoutée
  // à part" qu'en mode Distance.
  const chartXTicks = useMemo(() => {
    const maxVal = chartXDomain[1];
    const ticks = [];

    if (chartAxisType === 'distance') {
      const roundedMax = Math.round(maxVal * 100) / 100; // arrondi à 0.01 km/mile (dizaine de mètres)
      for (let i = 0; i <= Math.floor(maxVal); i++) ticks.push(i);
      // N'ajoute la distance finale que si elle n'est pas déjà quasiment un nombre rond
      // (évite un doublon visuel du type "6" et "6.0" côte à côte).
      if (Math.abs(roundedMax - Math.round(roundedMax)) > 0.02) ticks.push(roundedMax);
    } else {
      const totalMinutes = maxVal / 60;
      let stepMinutes = 1;
      if (totalMinutes > 40) stepMinutes = 10;
      else if (totalMinutes > 20) stepMinutes = 5;
      else if (totalMinutes > 10) stepMinutes = 2;
      const stepSeconds = stepMinutes * 60;
      for (let t = 0; t <= maxVal; t += stepSeconds) ticks.push(t);
      const roundedMax = Math.round(maxVal / 10) * 10; // arrondi à la dizaine de secondes
      if (ticks.length === 0 || Math.abs(roundedMax - ticks[ticks.length - 1]) > 5) ticks.push(roundedMax);
    }
    return ticks;
  }, [chartAxisType, chartXDomain]);

  const chartYDomain = useMemo(() => {
    const values = unifiedChartData
      .flatMap(d => [parseFloat(d.bpmTarget), parseFloat(d.realValue)])
      .filter(v => !isNaN(v));
    if (values.length === 0) return [60, 200];
    return [Math.min(...values) - 10, Math.max(...values) + 10];
  }, [unifiedChartData]);

  // Calcule le % de temps passé "dans la cible" / "trop lent" / "trop rapide" en
  // comparant chaque point de CADENCE réelle à la cible (BPM musical) au même
  // instant. Volontairement limité à la cadence : la fréquence cardiaque n'a pas
  // de cible équivalente dans TempoFit aujourd'hui, donc un "% de match" pour
  // elle n'aurait pas de sens réel — voir aussi RealDataDot, même restriction.
  const analysisStats = useMemo(() => {
    if (!currentPlaylist || !currentActualData || selectedMetric !== 'cadence') return null;
    let matchCount = 0, belowCount = 0, aboveCount = 0;
    const tol = currentPlaylist.tolerance || 10;

    currentActualData.forEach(d => {
      if (d.cadenceReelle === undefined) return; // point sans cadence (FC seule) : hors calcul
      const t = d.timeSec + dataOffset;
      let target = null;
      let acc = 0;
      for (let track of currentPlaylist.tracks) {
        acc += track.duration - (currentPlaylist.crossfade || 0);
        if (t <= acc) { target = track.bpm; break; }
      }
      if(!target && currentPlaylist.tracks.length > 0) target = currentPlaylist.tracks[currentPlaylist.tracks.length-1].bpm;

      if(target) {
        if (d.cadenceReelle >= target - tol && d.cadenceReelle <= target + tol) matchCount++;
        else if (d.cadenceReelle < target - tol) belowCount++;
        else aboveCount++;
      }
    });

    const total = matchCount + belowCount + aboveCount;
    if(total === 0) return null;
    return {
      matchPct: Math.round((matchCount / total) * 100),
      belowPct: Math.round((belowCount / total) * 100),
      abovePct: Math.round((aboveCount / total) * 100),
    };
  }, [currentPlaylist, currentActualData, selectedMetric, dataOffset]);

  // --- Tokens de thème (couleurs Tailwind conditionnées par le mode Intime / clair-sombre) ---
  const themeColor = isNaughtyMode ? 'rose' : 'red';
  const bgMainApp = isNaughtyMode ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-50 to-white dark:from-gray-900 dark:via-rose-950/20 dark:to-black' : 'bg-gray-50 dark:bg-gray-950';
  const textMain = 'text-gray-900 dark:text-gray-100';
  const textColorClass = isNaughtyMode ? 'text-rose-500 dark:text-rose-400' : 'text-red-500 dark:text-red-500';
  const bgAccentClass = isNaughtyMode ? 'bg-rose-500 dark:bg-rose-600' : 'bg-red-500 dark:bg-red-600';
  const borderAccentClass = isNaughtyMode ? 'border-rose-500' : 'border-red-500';

  const cardBg = "bg-white dark:bg-gray-900";
  const cardBorder = "border-gray-200 dark:border-gray-800";
  const inputBg = "bg-gray-50 dark:bg-gray-950";
  const inputBorder = "border-gray-300 dark:border-gray-700";
  // BUG DE CONTRASTE CORRIGÉ : le mode Intime éclaircit le fond en mode clair
  // (dégradé rose très pâle/blanc, voir bgMainApp), mais le texte "muted" gardait
  // le même gris clair que le fond neutre standard — illisible dans ce contexte
  // plus pâle. On fonce ce gris uniquement en clair + Intime, où le contraste
  // manquait vraiment ; le mode sombre n'était pas concerné (fond toujours foncé).
  const textMuted = isNaughtyMode ? "text-gray-500 dark:text-gray-500" : "text-gray-400 dark:text-gray-500";
  const textHighlight = "text-gray-900 dark:text-white";

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''}`}>
      <div className={`flex h-screen overflow-hidden ${bgMainApp} ${textMain} font-sans selection:bg-${themeColor}-500 selection:text-white transition-colors duration-500 relative`}>

        {/* Toast de notification global : style et icône dépendent de toast.variant
            ('default' = neutre, 'special' = succès mis en avant/trophée, 'error' = échec).
            Avant : les erreurs réutilisaient le style doré "trophée" des déblocages de succès,
            ce qui prêtait à confusion (une erreur ne doit pas ressembler à une récompense). */}
        {toast && (
          <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[80] bg-white dark:bg-gray-800 border ${
            toast.variant === 'special' ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]' :
            toast.variant === 'error' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]' :
            'border-gray-200 dark:border-gray-700 shadow-2xl'
          } px-6 py-3 rounded-full flex items-center space-x-3 animate-in slide-in-from-top-4 fade-in duration-300`}>
            {toast.variant === 'special' ? <Trophy size={18} className="text-yellow-500 fill-yellow-500" /> :
             toast.variant === 'error' ? <AlertCircle size={18} className="text-red-500" /> :
             <Check size={18} className={textColorClass} />}
            <span className={`font-medium ${toast.variant === 'error' ? 'text-red-600 dark:text-red-400' : textHighlight}`}>{toast.message}</span>
          </div>
        )}

        {/* Bandeau rassurant pendant une génération : le moteur fait maintenant
            beaucoup plus de travail par titre qu'avant (recherche multi-genres,
            tolérance élargie, détection audio en direct sur l'extrait quand Deezer
            n'a pas de BPM renseigné...), donc une génération peut prendre plusieurs
            secondes — et plusieurs dizaines de secondes pour un gros lot (+1s de
            pause volontaire entre chaque playlist, voir executeGeneration). Sans ce
            message, ce délai pouvait donner l'impression que l'app est bloquée.
            Fixé en bas (pas en haut, pour ne pas se superposer au toast). */}
        {isGenerating && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[80] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl px-6 py-3 rounded-full flex items-center space-x-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <Loader2 size={18} className={`animate-spin ${textColorClass}`} />
            <span className={`font-medium text-sm ${textHighlight}`}>
              {generatingTotal > 1
                ? `Génération ${generatingDone}/${generatingTotal}... ça peut prendre un moment (recherche des meilleurs titres + vérification audio)`
                : "Génération en cours... ça peut prendre quelques secondes (recherche des meilleurs titres + vérification audio)"}
            </span>
          </div>
        )}

        {/* Bouton flottant "Trophées" avec badge du nombre débloqué */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[60]">
          <button onClick={() => changeView('trophies')} className="relative p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-full shadow-lg border border-yellow-200 dark:border-yellow-700/50 hover:scale-110 transition-transform flex items-center justify-center">
            <Trophy size={22} className={userStats.unlockedTrophies.length > 0 ? "fill-yellow-500" : ""} />
            {userStats.unlockedTrophies.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {userStats.unlockedTrophies.length}
              </span>
            )}
          </button>
        </div>

        {/* Input fichier caché, réutilisé pour tous les imports CSV (piloté via fileInputRef) */}
        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="hidden" />

        {/* ============================= SIDEBAR ============================= */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r ${cardBorder} flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className={`p-6 border-b ${cardBorder} flex items-center justify-between`}>
             <div className="flex items-center space-x-3">
                <div className={`${bgAccentClass} p-1.5 rounded-lg transition-colors duration-500 ${isNaughtyMode ? 'shadow-[0_0_15px_rgba(244,63,94,0.4)]' : ''}`}>
                  {isNaughtyMode ? <Heart size={20} className="text-white fill-white" /> : <Activity size={20} className="text-white" />}
                </div>
                <span className={`font-bold text-xl tracking-tight leading-none ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
             </div>
             <button className="md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-3 overflow-y-auto no-scrollbar">
            
            <button onClick={() => changeView('generator')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors ${view === 'generator' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Zap size={18} className={view === 'generator' ? 'text-white' : textColorClass} />
              <span className="font-bold text-sm">Générer</span>
            </button>

            <button onClick={() => changeView('routines')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors ${view === 'routines' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <ListPlus size={18} />
              <span className="font-bold text-sm">Mes Routines</span>
            </button>
            
            <button onClick={() => changeView('playlists')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors ${view === 'playlists' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <List size={18} />
              <span className="font-bold text-sm">Mes Playlists</span>
            </button>

            <button onClick={() => changeView('history')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors ${view === 'history' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <History size={18} />
              <span className="font-bold text-sm">Historique</span>
            </button>

            <button onClick={() => changeView('favorites')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors ${view === 'favorites' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Star size={18} className={favorites.useFavorites && favorites.artists.length > 0 ? "text-yellow-500 fill-yellow-500/20" : ""} />
              <span className="font-bold text-sm">Mes Favoris</span>
            </button>

            <button onClick={() => changeView('settings')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors ${view === 'settings' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Settings size={18} />
              <span className="font-bold text-sm">Options & Comptes</span>
            </button>

          </nav>

          {/* Crédit du projet, en bas de la sidebar — discret, ouvre dans un nouvel onglet
              pour ne pas faire quitter l'app en un clic accidentel. */}
          <div className={`px-4 py-4 border-t ${cardBorder} text-center`}>
            <a
              href="https://www.linkedin.com/in/damiengrange/"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs font-medium ${textMuted} hover:${textHighlight} transition-colors`}
            >
              Un projet créé par <span className="font-bold underline">Damien Grangé</span>
            </a>
          </div>
        </aside>

        <div className="flex-1 flex flex-col relative w-full">
          {/* Header mobile (bouton burger + logo) */}
          <header className={`md:hidden flex items-center p-4 bg-white dark:bg-gray-900 border-b ${cardBorder} z-30`}>
            <button onClick={() => setIsMobileMenuOpen(true)} className={`p-2 mr-3 ${textMuted} hover:${textHighlight} bg-gray-100 dark:bg-gray-800 rounded-lg`}><Menu size={20} /></button>
            <div className="flex items-center space-x-2">
              <span className={`font-bold text-lg tracking-tight ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
            </div>
          </header>

          {/* Header desktop flottant, n'apparaît qu'après un certain scroll (isScrolled) */}
          <header className={`hidden md:flex absolute top-0 left-0 right-0 p-6 z-30 transition-all duration-300 pointer-events-none ${isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border ${cardBorder} shadow-lg px-6 py-3 rounded-full flex items-center space-x-4 pointer-events-auto`}>
              <span className={`font-bold text-sm ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
              <div className={`w-1 h-1 rounded-full ${bgAccentClass}`}></div>
              <span className={`text-sm font-medium ${textMuted}`}>{displaySubtitleGen}</span>
            </div>
          </header>

          <main id="main-scroll-area" className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar pb-32">

            {/* ===================== VIEW: GENERATOR (ASSISTANT MULTI-ETAPES) ===================== */}
            {view === 'generator' && (
              <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className="text-center md:text-left space-y-2 mb-8">
                  <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight ${textHighlight}`}>{isNaughtyMode ? "Prépare l'ambiance..." : "Sculpte ta séance"}</h1>
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">{displaySubtitleGen}</p>
                </div>

                <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl relative overflow-hidden flex flex-col min-h-[450px]`}>

                  {/* Barre de progression du wizard (4 pastilles) */}
                  <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`h-2.5 w-8 sm:w-12 rounded-full transition-colors duration-300 ${wizardStep >= s ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}/>
                      ))}
                    </div>
                    <span className={`text-sm font-bold uppercase tracking-wider ${textMuted}`}>Étape {wizardStep} / 4</span>
                  </div>

                  <div className="flex-1">

                    {/* ETAPE 1 : L'ACTIVITE (choix du type d'entraînement + accès caché au mode Intime via l'icône flamme) */}
                    {wizardStep === 1 && (
                      <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                          {isNaughtyMode ? <Heart className={textColorClass} size={24} /> : <Activity className={textColorClass} size={24} />}
                          <span>{isNaughtyMode ? "De quoi as-tu envie aujourd'hui ?" : "Qu'est-ce qu'on fait aujourd'hui ?"}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          {(isNaughtyMode ? NAUGHTY_WORKOUT_ORDER.map(id => WORKOUT_TYPES.find(t => t.id === id)) : WORKOUT_TYPES).map(type => {
                            const Icon = isNaughtyMode ? NAUGHTY_WORKOUT_ICONS[type.id] : type.icon;
                            const isSelected = workoutType === type.id;
                            return (
                              <div key={type.id} className="relative group/btn">
                                <button
                                  onClick={() => {
                                    if(type.id === 'Autre') handleOpenCustomActivityModal();
                                    else {
                                      setWorkoutType(type.id);
                                      const modeKey = isNaughtyMode ? 'naughty' : 'standard';
                                      const defaultBpm = WORKOUT_DEFAULT_BPM[modeKey][type.id];
                                      if (defaultBpm) setBpm(defaultBpm);
                                      const defaultTarget = WORKOUT_DEFAULT_TARGET[modeKey][type.id];
                                      if (defaultTarget) {
                                        setTargetMode(defaultTarget.targetMode);
                                        if (defaultTarget.targetMode === 'distance') {
                                          setDistanceVal(defaultTarget.distanceVal);
                                          setDistanceUnit(defaultTarget.distanceUnit);
                                        } else {
                                          setHours(defaultTarget.hours);
                                          setMinutes(defaultTarget.minutes);
                                        }
                                      }
                                      setTimeout(()=>setWizardStep(2), 200);
                                    }
                                  }}
                                  className={`w-full flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${isSelected ? `${isNaughtyMode ?
                                    'bg-rose-100 dark:bg-rose-900/20 border-rose-500 text-rose-500 dark:text-rose-400' : 'bg-red-50 dark:bg-red-600/10 border-red-500 text-red-600 dark:text-red-500'}` : `${bgMainApp} ${cardBorder} ${textMuted} hover:${textHighlight} hover:border-gray-300 dark:hover:border-gray-600`}`}
                                >
                                  <Icon size={32} className="mb-3" />
                                  <span className="font-bold text-center">
                                    {type.id === 'Autre' && customActivity ? customActivity : (isNaughtyMode ? NAUGHTY_WORKOUT_LABELS[type.id] : type.id)}
                                  </span>
                                </button>
                                {type.id === 'Autre' && (
                                  <button onClick={(e) => { e.stopPropagation(); toggleNaughtyMode(); }} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-rose-500 z-20 cursor-pointer">
                                    <Flame size={16} className={isNaughtyMode ? "text-rose-500 fill-rose-500 animate-pulse" : ""} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ETAPE 2 : OBJECTIF (temps vs distance, option HIIT) */}
                    {wizardStep === 2 && (
                      <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
                        {/* Le choix Temps/Distance n'a pas de sens en mode Intime (personne ne
                            mesure ça en kilomètres) : le mode reste forcé sur "temps"
                            (voir toggleNaughtyMode) et ce sélecteur est simplement masqué. */}
                        {!isNaughtyMode && (
                          <div className="space-y-4">
                            <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                              <MapPin className={textColorClass} size={24} /> <span>Sur quoi on se base ?</span>
                            </label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5">
                              <button onClick={() => setTargetMode('time')} className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl font-bold transition-all ${targetMode === 'time' ?
                                'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted}`}>
                                <Clock size={20} className="mb-1"/> Par Durée (Temps)
                              </button>
                              <button onClick={() => setTargetMode('distance')} className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl font-bold transition-all ${targetMode === 'distance' ?
                                'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted}`}>
                                <Footprints size={20} className="mb-1"/> Par Distance (Km/Mi)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Mode Fractionné : réactivé en mode Intime (variations d'intensité qui
                            s'enchaînent — le principe colle en fait très bien au thème), avec un
                            libellé adapté. Avant, cette option était entièrement masquée en mode
                            Intime, sans vraie raison de fond de l'en priver. */}
                        <div className={`flex items-center justify-between p-5 ${inputBg} border-2 ${isIntervalMode ? borderAccentClass : inputBorder} rounded-2xl transition-colors cursor-pointer`} onClick={() => setIsIntervalMode(!isIntervalMode)}>
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-xl ${isIntervalMode ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}>
                              <ListPlus size={24} className={isIntervalMode ? 'text-white' : textMuted} />
                            </div>
                            <div>
                              <h3 className={`font-bold text-lg ${textHighlight}`}>{isNaughtyMode ? 'Montée en Intensité' : 'Mode Fractionné (HIIT)'}</h3>
                              <p className={`text-sm ${textMuted}`}>{isNaughtyMode ? 'Enchaîner plusieurs phases, à des rythmes différents' : 'Faire des variations de rythme'}</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                            <input type="checkbox" className="sr-only peer" checked={isIntervalMode} readOnly />
                            <div className={`w-14 h-7 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all ${isIntervalMode ?
                              'peer-checked:bg-red-500 dark:peer-checked:bg-red-600' : ''}`}></div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* ETAPE 3 : REGLAGES DU RYTHME (BPM simple/distance/temps, ou découpage HIIT) */}
                    {wizardStep === 3 && (
                      <div className="space-y-8 animate-in slide-in-from-right-8 duration-300 h-[300px] overflow-y-auto no-scrollbar pb-10">

                        {!isIntervalMode ? (
                          <>
                            <div className="space-y-4">
                              <div className="flex justify-between items-end">
                                <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                                  <Activity className={textColorClass} size={24} /> <span>Rythme cible global</span>
                                </label>
                                <span className={`text-4xl font-black ${textColorClass}`}>{bpm} <span className={`text-sm font-bold ${textMuted}`}>BPM</span></span>
                              </div>
                              <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className={`w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ?
                                'accent-rose-500' : 'accent-red-500'}`} />
                            </div>

                            {targetMode === 'distance' ? (
                              <div className="space-y-4 mt-8">
                                <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                                  <MapPin className={textColorClass} size={24} /> <span>Objectif & Allure</span>
                                </label>
                                <div className="flex flex-col sm:flex-row gap-4">
                                  <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center pl-4 pr-2 py-4 justify-between`}>
                                    <input type="number" min="0" step="0.1" value={distanceVal} onChange={(e) => setDistanceVal(e.target.value)} className={`bg-transparent w-full text-2xl font-bold ${textHighlight} outline-none`} />
                                    <select value={distanceUnit} onChange={(e)=>setDistanceUnit(e.target.value)} className={`font-bold text-lg ${textMuted} bg-transparent outline-none cursor-pointer`}>
                                      <option value="km">Km</option><option value="mi">Miles</option>
                                    </select>
                                  </div>
                                  <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-4 py-4 justify-between`}>
                                    <span className={`text-sm font-bold ${textMuted} mr-2`}>Allure:</span>
                                    <div className="flex items-center">
                                      <input type="number" min="1" max="15" value={paceMin} onChange={(e) => setPaceMin(e.target.value)} className={`bg-transparent w-10 text-2xl font-bold ${textHighlight} outline-none text-right`} />
                                      <span className={`${textHighlight} mx-1 font-bold text-xl`}>:</span>
                                      <input type="number" min="0" max="59" value={paceSec} onChange={(e) => setPaceSec(e.target.value)} className={`bg-transparent w-12 text-2xl font-bold ${textHighlight} outline-none`} />
                                      <span className={`text-sm font-bold ${textMuted} ml-1`}>/{distanceUnit}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4 mt-8">
                                <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                                  <Clock className={textColorClass} size={24} /> <span>Durée de la session</span>
                                </label>
                                <div className="flex space-x-4">
                                  <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-6 py-4`}>
                                    <input type="number" min="0" max="12" value={hours} onChange={(e) => setHours(e.target.value)} className={`bg-transparent w-full text-3xl font-black ${textHighlight} outline-none`} />
                                    <span className={`font-bold text-lg ${textMuted}`}>Heures</span>
                                  </div>
                                  <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-6 py-4`}>
                                    <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`bg-transparent w-full text-3xl font-black ${textHighlight} outline-none`} />
                                    <span className={`font-bold text-lg ${textMuted}`}>Min</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={`space-y-4`}>
                            <div className="flex justify-between items-end mb-4">
                              <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                                <SlidersHorizontal className={textColorClass} size={24} /> <span>Découpage de l'effort</span>
                              </label>
                              {targetMode === 'distance' && (
                                <div className={`text-sm font-bold ${textMuted} flex items-center bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg`}>
                                  Allure moy:
                                  <input type="number" value={paceMin} onChange={e=>setPaceMin(e.target.value)} className={`w-8 bg-transparent ml-2 text-center outline-none ${textHighlight}`}/>:
                                  <input type="number" value={paceSec} onChange={e=>setPaceSec(e.target.value)} className={`w-8 bg-transparent text-center outline-none ${textHighlight}`}/>
                                  <select value={distanceUnit} onChange={e=>setDistanceUnit(e.target.value)} className="bg-transparent outline-none ml-1 cursor-pointer">
                                    <option value="km">/km</option><option value="mi">/mi</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              {segments.map((segment, index) => {
                                const isGenreExpanded = expandedSegmentGenreId === segment.id;
                                const hasOverride = segment.selectedGenres && segment.selectedGenres.length > 0;
                                return (
                                <div key={segment.id} className={`${inputBg} rounded-xl border ${inputBorder} overflow-hidden`}>
                                  <div className="flex items-center gap-4 p-4">
                                    <div className={`w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-sm ${textHighlight}`}>{index + 1}</div>
                                    <div className="flex-1 flex gap-3">
                                      <div className={`flex-1 flex items-center bg-white dark:bg-gray-900 rounded-lg px-3 py-2 shadow-sm`}>
                                        <input type="number" value={segment.bpm} onChange={(e) => setSegments(segments.map(s => s.id === segment.id ? { ...s, bpm: parseInt(e.target.value) || 0 } : s))} className={`w-full bg-transparent text-lg font-bold outline-none ${textHighlight}`} />
                                        <span className={`text-xs font-bold ${textMuted}`}>BPM</span>
                                      </div>
                                      <div className={`flex-1 flex items-center bg-white dark:bg-gray-900 rounded-lg px-3 py-2 shadow-sm`}>
                                        <input type="number" step={targetMode==='distance'?'0.1':'1'} value={segment.durationValue} onChange={(e) => setSegments(segments.map(s => s.id === segment.id ? { ...s, durationValue: parseFloat(e.target.value) || 0 } : s))} className={`w-full bg-transparent text-lg font-bold outline-none ${textHighlight}`} />
                                        <span className={`text-xs font-bold ${textMuted}`}>{targetMode === 'distance' ? distanceUnit : 'Min'}</span>
                                      </div>
                                    </div>
                                    {/* Genre spécifique à CETTE portion : replié par défaut (icône
                                        neutre), colorée dès qu'un override est défini pour cette
                                        portion — sinon elle utilise le genre global de l'étape 4. */}
                                    <button
                                      onClick={() => setExpandedSegmentGenreId(isGenreExpanded ? null : segment.id)}
                                      title={hasOverride ? `Genre spécifique : ${segment.selectedGenres.join(', ')}` : "Genre global de la séance (cliquer pour définir un genre spécifique à cette portion)"}
                                      className={`p-2 rounded-lg transition-colors ${hasOverride ? `${bgAccentClass} text-white` : `${textMuted} hover:${textHighlight} hover:bg-gray-200 dark:hover:bg-gray-700`}`}
                                    >
                                      <Music size={18} />
                                    </button>
                                    <button onClick={() => segments.length > 1 && setSegments(segments.filter(s => s.id !== segment.id))} disabled={segments.length === 1} className={`p-2 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 ${textMuted}`}>
                                      <Trash2 size={20} />
                                    </button>
                                  </div>
                                  {isGenreExpanded && (
                                    <div className={`px-4 pb-4 border-t ${inputBorder} pt-3`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className={`text-xs font-bold ${textMuted}`}>
                                          {hasOverride ? "Genre spécifique à cette portion" : "Aucun override — utilise le genre global de la séance"}
                                        </span>
                                        {hasOverride && (
                                          <button onClick={() => resetSegmentGenre(segment.id)} className={`text-xs font-bold underline ${textMuted} hover:${textHighlight}`}>
                                            Revenir au genre global
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {STANDARD_GENRES.map(genre => {
                                          const isSelected = (segment.selectedGenres || []).includes(genre);
                                          const warning = getGenreLocalDepthWarning(genre);
                                          return (
                                            <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                              {genre}{warning && <span className="ml-1">⚠️</span>}
                                            </button>
                                          );
                                        })}
                                        <button onClick={() => setShowExtraGenres(!showExtraGenres)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}>
                                          {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                                        </button>
                                      </div>
                                      {showExtraGenres && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {EXTRA_GENRES.map(genre => {
                                            const isSelected = (segment.selectedGenres || []).includes(genre);
                                            const warning = getGenreLocalDepthWarning(genre);
                                            return (
                                              <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                                {genre}{warning && <span className="ml-1">⚠️</span>}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                              })}
                            </div>
                            <button onClick={() => setSegments([...segments, { id: Date.now(), bpm: segments[segments.length - 1].bpm, durationValue: targetMode==='distance'?1:10 }])} className={`w-full py-4 mt-4 border-2 border-dashed ${inputBorder} rounded-xl flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400 bg-gray-50 dark:bg-gray-800/50`}>
                              <Plus size={20} /><span>Ajouter une portion</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ETAPE 4 : MUSIQUE & GENERATION (genres, tolérance BPM, crossfade, boutons finaux) */}
                    {wizardStep === 4 && (
                      <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
                        <div className="space-y-4">
                          <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                            <Music className={textColorClass} size={24} /> <span>Quelle vibe musicale ?</span>
                          </label>
                          <div className="flex flex-wrap gap-3">
                            {availableGenres.map(genre => {
                              const isSelected = selectedGenres.includes(genre);
                              const warning = getGenreLocalDepthWarning(genre);
                              return (
                                <button key={genre} onClick={() => toggleGenre(genre)} title={warning || undefined} className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 ${isSelected ?
                                  `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                  {genre}{warning && <span className="ml-1">⚠️</span>}
                                </button>
                              )
                            })}
                            {/* Le mode Intime garde volontairement sa liste restreinte, pas d'extension ici */}
                            {!isNaughtyMode && (
                              <button onClick={() => setShowExtraGenres(!showExtraGenres)} className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}>
                                {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                              </button>
                            )}
                          </div>
                          {!isNaughtyMode && showExtraGenres && (
                            <div className="flex flex-wrap gap-3 pt-1">
                              {EXTRA_GENRES.map(genre => {
                                const isSelected = selectedGenres.includes(genre);
                                const warning = getGenreLocalDepthWarning(genre);
                                return (
                                  <button key={genre} onClick={() => toggleGenre(genre)} title={warning || undefined} className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 ${isSelected ?
                                    `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                    {genre}{warning && <span className="ml-1">⚠️</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`space-y-4 p-5 rounded-2xl ${inputBg} border ${inputBorder}`}>
                            <div className="flex justify-between items-center">
                              <label className={`text-sm font-bold flex items-center space-x-2 ${textMuted}`}>
                                <SlidersHorizontal size={18} /><span>Marge d'erreur</span>
                              </label>
                              <span className={`text-sm font-black ${textColorClass}`}>± {bpmTolerance} BPM</span>
                            </div>
                            {/* La tolérance BPM détermine la fourchette [bpm-tol, bpm+tol] utilisée par getSingleMatchingTrack */}
                            <input type="range" min="0" max="30" value={bpmTolerance} onChange={(e) => setBpmTolerance(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ?
                              'accent-rose-500' : 'accent-red-500'}`} />
                            <p className={`text-xs ${textMuted}`}>Tolérance faible = Précision militaire. Tolérance élevée = Plus de pépites !</p>
                          </div>

                          <div className={`space-y-4 p-5 rounded-2xl ${inputBg} border ${inputBorder}`}>
                            <div className="flex justify-between items-center">
                              <label className={`text-sm font-bold flex items-center space-x-2 ${textMuted}`}>
                                <Activity size={18} /><span>Fondu enchaîné</span>
                              </label>
                              <span className={`text-sm font-black ${textColorClass}`}>{crossfade} sec</span>
                            </div>
                            <input type="range" min="0" max="12" value={crossfade} onChange={(e) => setCrossfade(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ?
                              'accent-rose-500' : 'accent-red-500'}`} />
                            <p className={`text-xs ${textMuted}`}>Élimine les blancs entre les morceaux pour une énergie constante.</p>
                          </div>
                        </div>

                        {/* Exploration manuelle : voir les titres qui matchent pile ce BPM + ces genres,
                            avec extrait audio, plutôt que de laisser l'algorithme piocher au hasard. */}
                        <button onClick={() => {
                          setCurrentPlaylist(null); // idem : garantit que les ajouts vont aux favoris, pas dans une ancienne playlist
                          setIsBpmSearchMode(true);
                          setSearchQuery('');
                          setWorldSearchResults([]);
                          setResultsContextLabel(null);
                          setNoUsableResultsHint(false);
                          setIsSearchModalOpen(true);
                          searchTracksByBpm(bpm, bpmTolerance, selectedGenres);
                        }} className={`w-full py-4 rounded-2xl border-2 border-dashed ${inputBorder} flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400 bg-gray-50 dark:bg-gray-800/50`}>
                          <Target size={20} /><span>Explorer les titres à {bpm} BPM</span>
                        </button>

                        {/* Boutons finaux : génération immédiate, ou sauvegarde en routine réutilisable */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                          <button onClick={() => executeGeneration({ isIntervalMode, targetMode, distanceVal, distanceUnit, paceMin, paceSec, segments, bpm, hours, minutes, selectedGenres, bpmTolerance, crossfade, workoutName: getActiveWorkoutName() })} disabled={isGenerating} className={`flex-1 text-xl font-black py-5 rounded-2xl flex items-center justify-center space-x-3 transition-transform active:scale-95 shadow-xl ${isNaughtyMode ?
                            'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200'}`}>
                            {isGenerating ? <Loader2 size={28} className="animate-spin" /> : <><Zap size={28} /><span>Générer ma Playlist</span></>}
                          </button>

                          <div className="relative group/memorize sm:w-1/3">
                            <button onClick={() => setIsSavingRoutineModalOpen(true)} className={`w-full h-full text-base font-bold py-5 rounded-2xl border-2 flex flex-col items-center justify-center leading-tight transition-colors bg-white dark:bg-gray-800 ${cardBorder} ${textHighlight} hover:bg-gray-50 dark:hover:bg-gray-700 relative`}>
                              <BookmarkPlus size={20} className="mb-1 text-yellow-500" />
                              <span>Créer routine</span>
                              <div className="absolute top-3 right-3 text-gray-400 hover:text-blue-500 transition-colors">
                                <Info size={16} />
                              </div>
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-64 p-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium text-center rounded-xl shadow-2xl opacity-0 group-hover/memorize:opacity-100 transition-opacity pointer-events-none z-20">
                              {"Sauvegarde ces réglages pour relancer cette session en un claquement de doigts la prochaine fois."}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Navigation Précédent/Suivant du wizard (étapes 1 à 3) */}
                  {wizardStep < 4 && (
                    <div className="mt-auto pt-8 flex justify-between items-center border-t border-gray-100 dark:border-gray-800">
                      {wizardStep > 1 ? (
                        <button onClick={() => setWizardStep(wizardStep - 1)} className={`px-6 py-3 rounded-xl font-bold flex items-center space-x-2 ${textMuted} hover:${textHighlight} bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}>
                          <ChevronLeft size={20}/> <span>Précédent</span>
                        </button>
                      ) : <div/>}
                      <button onClick={() => setWizardStep(wizardStep + 1)} className={`px-8 py-3 rounded-xl font-bold flex items-center space-x-2 text-white shadow-md transition-colors ${isNaughtyMode ?
                        'bg-rose-500 hover:bg-rose-600' : 'bg-red-500 hover:bg-red-600'}`}>
                        <span>Suivant</span> <ChevronRight size={20}/>
                      </button>
                    </div>
                  )}
                  {wizardStep === 4 && (
                    <div className="mt-4 flex justify-start">
                      <button onClick={() => setWizardStep(3)} className={`px-6 py-2 rounded-xl font-bold flex items-center space-x-2 ${textMuted} hover:${textHighlight} transition-colors`}>
                        <ChevronLeft size={18}/> <span>Retour aux réglages</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===================== VIEW: ROUTINES ===================== */}
            {view === 'routines' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={`border-b ${cardBorder} pb-6`}>
                  <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><ListPlus className={textColorClass} size={36} /> <span>Mes Routines</span></h1>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Génère instantanément des playlists à partir de tes configurations.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {routines.length === 0 ? (
                    <div className={`col-span-full py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
                      <ListPlus size={48} className={`mx-auto mb-4 text-gray-300 dark:text-gray-700`} />
                      <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune routine pour l'instant</h3>
                      <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère une première playlist et sauvegarde-la comme routine pour la relancer en un clic la prochaine fois.</p>
                      <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                        Créer ma première playlist
                      </button>
                    </div>
                  ) : (
                    // Tuile "+" toujours visible (même avec des routines existantes) — même principe
                    // que la tuile "+" de "Titres Favoris" : incite à en ajouter une nouvelle sans
                    // dupliquer le lien "Générer" déjà présent dans la sidebar.
                    <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed ${cardBorder} flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400`}>
                      <Plus size={28} />
                      <span>Créer une nouvelle routine</span>
                    </button>
                  )}
                  {(() => {
                    // Triées par nombre de générations manuelles décroissant — les plus
                    // utilisées remontent en premier. À égalité, ordre inchangé.
                    const sortedRoutines = [...routines].sort((a, b) => (b.manualGenerations || 0) - (a.manualGenerations || 0));
                    const routineRanks = [...routines]
                      .filter(r => (r.manualGenerations || 0) > 0)
                      .sort((a, b) => (b.manualGenerations || 0) - (a.manualGenerations || 0))
                      .map(r => r.id);

                    return sortedRoutines.map(routine => {
                    const batchCount = routineBatchCounts[routine.id] || 1;
                    const rank = routineRanks.indexOf(routine.id);
                    const rankStyle = getRankStyle(rank);
                    return (
                      <div key={routine.id} className={`${cardBg} rounded-2xl p-6 border ${rankStyle ? rankStyle.border : cardBorder} shadow-sm relative group overflow-hidden flex flex-col`}>
                        {rankStyle && <span className="absolute -top-2 -right-2 text-xl" title={`${routine.manualGenerations} générations — la ${rank === 0 ? 'plus' : rank === 1 ? '2e plus' : '3e plus'} utilisée`}>{rankStyle.emoji}</span>}
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gray-100 dark:bg-gray-800`}>
                            {getDisplayRoutineIcon(routine)}
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Badge "génération auto" : calcule combien de générations manuelles il reste
                                à faire aujourd'hui/cette semaine par rapport à la fréquence configurée.
                                Note : la génération automatique en tâche de fond n'est pas implémentée ici,
                                seul l'affichage du badge "restant" l'est (fonctionnalité marquée "Premium"). */}
                            {routine.autoGenFreq && routine.autoGenFreq !== 'Manuel' && (() => {
                              let target = 0; let label = "ajd";
                              if (routine.autoGenFreq === '1 fois / jour') target = 1;
                              if (routine.autoGenFreq === '2 fois / jour') target = 2;
                              if (routine.autoGenFreq === '1 fois / semaine') { target = 1; label = "cette sem."; }
                              const remaining = Math.max(0, target - (routine.manualGenerations || 0));
                              return (
                                <div className="text-[10px] font-bold uppercase px-2 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md">
                                  Auto : {remaining} restante{remaining > 1 ? 's' : ''} {label}
                                </div>
                              )
                            })()}
                            <button onClick={() => { setEditingRoutine({ ...routine }); setIsEditRoutineModalOpen(true); }} className={`p-2 rounded-lg text-gray-400 hover:text-blue-500 transition-colors`} title="Éditer cette routine">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => setRoutines(routines.filter(r => r.id !== routine.id))} className={`p-2 rounded-lg text-gray-400 hover:text-red-500 transition-colors`} title="Supprimer cette routine">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <h3 className={`font-bold text-xl mb-1 flex items-center gap-2 ${textHighlight}`}>
                          {getDisplayRoutineName(routine)}
                          {routine.isIntervalMode && (
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white shrink-0 ${bgAccentClass}`}>
                              Fractionné
                            </span>
                          )}
                        </h3>
                        <div>{renderConfigInfoLine(routine)}</div>
                        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex gap-2 mb-2">
                            <div className={`flex items-center ${inputBg} border ${inputBorder} rounded-xl px-2`} title="Génère plusieurs versions différentes en un clic, pour choisir celle que tu préfères.">
                              <Layers size={16} className={`${textMuted} mr-1`} />
                              <select
                                value={batchCount} onChange={(e) => setRoutineBatchCounts({...routineBatchCounts, [routine.id]: parseInt(e.target.value)})}
                                className={`bg-transparent text-sm font-bold outline-none text-blue-600 dark:text-blue-400 cursor-pointer py-3 appearance-none pl-1 pr-2`}
                              >
                                <option value={1} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">x1</option>
                                <option value={3} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">x3</option>
                                <option value={5} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">x5</option>
                                <option value={10} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">x10</option>
                              </select>
                              {/* Icône Info visible plutôt qu'un simple attribut title invisible sur
                                  un div — l'ancienne version était peu découvrable (aucun indice
                                  visuel qu'une infobulle existait). */}
                              <Info size={13} className={`${textMuted} ml-0.5 mr-1 shrink-0`} />
                            </div>
                            <button onClick={() => { executeGeneration({ ...routine, workoutName: routine.customActivity || routine.workoutType, routineName: routine.name }, batchCount, routine.id);
                            }} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${bgAccentClass} text-white hover:brightness-110 active:scale-95`}>
                              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <PlaySquare size={18} fill="currentColor"/>}
                              <span>Générer</span>
                            </button>
                          </div>
                          {/* Date de création déplacée en pied de carte — avant, elle était
                              juste après les infos, alors que sur les cartes Playlist/Historique
                              elle est en bas. Même position partout désormais. */}
                          {routine.createdAt && (
                            <div className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {routine.createdAt}</div>
                          )}
                        </div>
                      </div>
                    );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ===================== VIEW: PLAYLISTS (Historique) ===================== */}
            {view === 'playlists' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={`border-b ${cardBorder} pb-6`}>
                  <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><List className={textColorClass} size={36} /> <span>Mes Playlists</span></h1>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Retrouve tes sessions sauvegardées. N'oublie pas de les marquer comme terminées !</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedPlaylists.length > 0 && (
                    // Tuile "+" toujours visible, même principe que "Mes Routines" et
                    // "Titres Favoris" — incite à en générer une nouvelle sans avoir à
                    // revenir chercher le lien "Générer" dans la sidebar.
                    <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed ${cardBorder} flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400`}>
                      <Plus size={28} />
                      <span>Générer une nouvelle playlist</span>
                    </button>
                  )}
                  {(() => {
                    // Triées par utilisation la plus récente d'abord ; celles jamais
                    // encore faites restent après, par ordre de création (comportement
                    // précédent, inchangé pour elles).
                    const sortedPlaylists = [...savedPlaylists].sort((a, b) => {
                      const lastA = a.completions && a.completions.length > 0 ? a.completions[a.completions.length - 1] : null;
                      const lastB = b.completions && b.completions.length > 0 ? b.completions[b.completions.length - 1] : null;
                      if (lastA && lastB) return lastB.localeCompare(lastA);
                      if (lastA) return -1;
                      if (lastB) return 1;
                      return 0;
                    });
                    // Classement par nombre d'utilisations, uniquement parmi celles
                    // ayant déjà été faites au moins une fois — sert à la bordure.
                    const playlistRanks = savedPlaylists
                      .filter(p => p.completions && p.completions.length > 0)
                      .sort((a, b) => b.completions.length - a.completions.length)
                      .map(p => p.id);

                    return sortedPlaylists.map(playlist => {
                      const rank = playlistRanks.indexOf(playlist.id);
                      const rankStyle = getRankStyle(rank);
                      return (
                  <div key={playlist.id} className={`${cardBg} rounded-2xl p-4 border ${rankStyle ? rankStyle.border : (playlist.completions && playlist.completions.length > 0 ?
                    'border-green-500/30 bg-green-50/30 dark:bg-green-900/10' : cardBorder)} shadow-sm flex flex-col group hover:border-gray-400 transition-colors cursor-pointer relative`} onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}>
                    {rankStyle && <span className="absolute -top-2 -right-2 text-xl" title={`${playlist.completions.length} fois — la ${rank === 0 ? 'plus' : rank === 1 ? '2e plus' : '3e plus'} utilisée`}>{rankStyle.emoji}</span>}
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br ${isNaughtyMode ? 'from-rose-400 to-rose-600' : 'from-gray-800 to-black dark:from-gray-200 dark:to-white'} shrink-0 text-3xl`}>
                          {playlist.coverIcon || <Music size={24} className={isNaughtyMode ? 'text-white' : 'text-white dark:text-black'} />}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSavedPlaylists(savedPlaylists.filter(p => p.id !== playlist.id)); }} className={`p-2 rounded-lg text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100`}>
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <h3 className={`font-bold text-lg flex items-center gap-2 ${textHighlight}`}>
                        {playlist.name}
                        {playlist.config?.isIntervalMode && (
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white shrink-0 ${bgAccentClass}`}>
                            Fractionné
                          </span>
                        )}
                      </h3>
                      {(() => {
                        const cfg = playlist.config || {};
                        const genres = cfg.selectedGenres && cfg.selectedGenres.length > 0
                          ? cfg.selectedGenres
                          : Array.from(new Set(playlist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
                        // Distance/durée RÉELLES de la playlist générée (pas juste la cible de
                        // départ) — plus pertinent ici qu'en Routine, puisque le résultat concret
                        // existe déjà.
                        const infoSource = {
                          workoutType: playlist.workoutType, customActivity: cfg.customActivity,
                          targetMode: cfg.targetMode,
                          distanceVal: playlist.avgPace ? Math.round((playlist.totalDuration / playlist.avgPace) * 10) / 10 : 0,
                          distanceUnit: playlist.distanceUnit || cfg.distanceUnit,
                          hours: Math.floor(playlist.totalDuration / 3600),
                          minutes: Math.round((playlist.totalDuration % 3600) / 60),
                          bpm: cfg.bpm, isIntervalMode: cfg.isIntervalMode, segments: cfg.segments,
                          selectedGenres: genres
                        };
                        return renderConfigInfoLine(infoSource, (
                          <div className="flex items-center space-x-1"><List size={14}/><span>{playlist.tracks.length} titres</span></div>
                        ));
                      })()}

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        {playlist.completions && playlist.completions.length > 0 ? (
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-green-600 dark:text-green-400 text-xs font-bold bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                                <CheckCircle size={14} className="mr-1.5"/> Faite {playlist.completions.length}x
                              </div>
                              <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {playlist.createdAt}</span>
                            </div>
                            {/* Liste interactive des dates de complétion — chaque date cliquable
                                pour la modifier, croix pour la retirer, tuile pour en ajouter une
                                précise (pas seulement "aujourd'hui"). */}
                            {renderCompletionsList(playlist)}
                            <button onClick={(e) => markPlaylistAsCompleted(e, playlist.id)} className={`flex items-center justify-center w-full py-2 text-xs font-bold ${inputBg} hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-600 rounded-lg transition-colors border ${inputBorder}`}>
                              <Circle size={14} className="mr-1.5"/> Marquer comme refaite aujourd'hui
                            </button>
                            {/* L'import CSV se fait désormais via l'icône 📤 sur chaque date
                                ci-dessus (une séance = une analyse), plus via un bouton unique
                                pour toute la playlist. Ce badge résume juste combien de séances
                                ont déjà des données réelles associées. */}
                            {playlist.actualDataByDate && Object.keys(playlist.actualDataByDate).length > 0 && (
                              <div className="flex items-center justify-center w-full py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold">
                                <Activity size={14} className="mr-2"/> {Object.keys(playlist.actualDataByDate).length} séance{Object.keys(playlist.actualDataByDate).length > 1 ? 's' : ''} avec données Garmin importées (cadence/FC)
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <button onClick={(e) => markPlaylistAsCompleted(e, playlist.id)} className={`flex items-center text-gray-500 hover:text-green-600 text-xs font-bold ${inputBg} hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors border ${inputBorder}`}>
                              <Circle size={14} className="mr-1.5"/> Marquer comme faite
                            </button>
                            <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {playlist.createdAt}</span>
                          </>
                        )}
                      </div>
                    </div>
                      );
                    });
                  })()}
                  {savedPlaylists.length === 0 && (
                    <div className={`col-span-full py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
                      <List size={48} className={`mx-auto mb-4 text-gray-300 dark:text-gray-700`} />
                      <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune playlist sauvegardée</h3>
                      <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère une playlist et sauvegarde-la pour la retrouver ici.</p>
                      <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                        Générer ma première playlist
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===================== VIEW: HISTORIQUE (sessions terminées uniquement) =====================
                Cette vue n'existait tout simplement pas avant : le bouton "Historique" du menu menait
                à une page blanche (aucun bloc `view === 'history'` n'était codé). Distincte de "Mes
                Playlists" (qui liste TOUTES les playlists sauvegardées, terminées ou non), "Historique"
                ne montre que les sessions marquées comme faites — un vrai journal d'entraînement. */}
            {view === 'history' && (() => {
              // Triées par utilisation la PLUS RÉCENTE (pas par ordre de création) —
              // la dernière fois qu'une playlist a été faite remonte en premier.
              const completedPlaylists = savedPlaylists
                .filter(p => p.completions && p.completions.length > 0)
                .sort((a, b) => {
                  const lastA = a.completions[a.completions.length - 1];
                  const lastB = b.completions[b.completions.length - 1];
                  return lastB.localeCompare(lastA);
                });
              // Classement par NOMBRE d'utilisations (indépendant du tri par
              // récence ci-dessus) — sert uniquement à la bordure or/argent/bronze.
              const completionRanks = [...completedPlaylists]
                .sort((a, b) => b.completions.length - a.completions.length)
                .map(p => p.id);
              return (
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                  <div className={`border-b ${cardBorder} pb-6`}>
                    <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><History className={textColorClass} size={36} /> <span>Historique</span></h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Le journal de tes séances effectuées.</p>
                  </div>

                  {completedPlaylists.length === 0 ? (
                    <div className={`py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
                      <History size={48} className={`mx-auto mb-4 text-gray-300 dark:text-gray-700`} />
                      {savedPlaylists.length === 0 ? (
                        <>
                          <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune séance pour l'instant</h3>
                          <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère ta première playlist, fais ta séance, puis marque-la comme terminée pour la voir apparaître ici.</p>
                          <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                            Générer ma première playlist
                          </button>
                        </>
                      ) : (
                        <>
                          <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune séance terminée pour l'instant</h3>
                          <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Tu as déjà des playlists sauvegardées — marque-en une comme "faite" pour qu'elle apparaisse dans ton historique.</p>
                          <button onClick={() => changeView('playlists')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                            Voir mes playlists
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {completedPlaylists.map(playlist => {
                        const rank = completionRanks.indexOf(playlist.id);
                        const rankStyle = getRankStyle(rank);
                        return (
                        <div key={playlist.id} className={`${cardBg} rounded-2xl p-4 border ${rankStyle ? rankStyle.border : 'border-green-500/30'} bg-green-50/30 dark:bg-green-900/10 shadow-sm flex flex-col hover:border-gray-400 transition-colors cursor-pointer relative`} onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}>
                          {rankStyle && <span className="absolute -top-2 -right-2 text-xl" title={`${playlist.completions.length} fois — la ${rank === 0 ? 'plus' : rank === 1 ? '2e plus' : '3e plus'} utilisée`}>{rankStyle.emoji}</span>}
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${isNaughtyMode ? 'from-rose-400 to-rose-600' : 'from-gray-800 to-black dark:from-gray-200 dark:to-white'} shrink-0 text-2xl`}>
                              {playlist.coverIcon || <Music size={20} className={isNaughtyMode ? 'text-white' : 'text-white dark:text-black'} />}
                            </div>
                            <div className="flex items-center text-green-600 dark:text-green-400 text-xs font-bold bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                              <CheckCircle size={14} className="mr-1.5"/> Terminée
                            </div>
                          </div>
                          <h3 className={`font-bold text-lg flex items-center gap-2 ${textHighlight}`}>
                            {playlist.name}
                            {playlist.config?.isIntervalMode && (
                              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white shrink-0 ${bgAccentClass}`}>
                                Fractionné
                              </span>
                            )}
                          </h3>
                          {(() => {
                            const cfg = playlist.config || {};
                            const genres = cfg.selectedGenres && cfg.selectedGenres.length > 0
                              ? cfg.selectedGenres
                              : Array.from(new Set(playlist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
                            const infoSource = {
                              workoutType: playlist.workoutType, customActivity: cfg.customActivity,
                              targetMode: cfg.targetMode,
                              distanceVal: playlist.avgPace ? Math.round((playlist.totalDuration / playlist.avgPace) * 10) / 10 : 0,
                              distanceUnit: playlist.distanceUnit || cfg.distanceUnit,
                              hours: Math.floor(playlist.totalDuration / 3600),
                              minutes: Math.round((playlist.totalDuration % 3600) / 60),
                              bpm: cfg.bpm, isIntervalMode: cfg.isIntervalMode, segments: cfg.segments,
                              selectedGenres: genres
                            };
                            return renderConfigInfoLine(infoSource, (
                              <div className="flex items-center space-x-1"><List size={14}/><span>{playlist.tracks.length} titres</span></div>
                            ));
                          })()}
                          {playlist.actualDataByDate && Object.keys(playlist.actualDataByDate).length > 0 && (
                            <div className="flex items-center justify-center w-full py-2 mt-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold">
                              <Activity size={14} className="mr-2"/> {Object.keys(playlist.actualDataByDate).length} séance{Object.keys(playlist.actualDataByDate).length > 1 ? 's' : ''} avec données Garmin importées (cadence/FC)
                            </div>
                          )}
                          {/* Date de création + liste des dates de complétion réelles — avant,
                              seule la date de création apparaissait, sans distinguer "généré le"
                              de "réellement effectué le". */}
                          <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
                            <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${textMuted}`}>Créée le {playlist.createdAt}</div>
                            {renderCompletionsList(playlist)}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ===================== VIEW: SETTINGS (OPTIONS ET COMPTES) ===================== */}
            {view === 'settings' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={`border-b ${cardBorder} pb-6`}>
                  <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
                    <Settings className={textColorClass} size={36} /> <span>Options & Comptes</span>
                  </h1>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Connecte tes plateformes pour utiliser de vraies musiques.</p>
                </div>

                <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
                  <h3 className={`font-bold text-xl mb-6 ${textHighlight}`}>Comptes connectés</h3>

                  <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${spotifyToken ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : inputBorder + ' ' + inputBg}`}>
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${spotifyToken ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                        <LinkIcon size={24} />
                      </div>
                      <div>
                        <h4 className={`font-bold text-lg ${textHighlight}`}>Spotify</h4>
                        <p className={`text-sm ${textMuted}`}>{spotifyToken ? 'Connecté (Accès à 100M de titres)' : 'Non connecté'}</p>
                      </div>
                    </div>

                    {!spotifyToken ? (
                      <button onClick={loginSpotify} className="px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black rounded-xl shadow-md transition-all flex items-center space-x-2">
                        <span>Lier mon compte</span>
                      </button>
                    ) : (
                      <button onClick={() => { window.localStorage.removeItem("spotify_token"); setSpotifyToken(null); }} className={`px-4 py-2 bg-gray-200 dark:bg-gray-800 font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-all text-gray-500`}>
                        Déconnecter
                      </button>
                    )}
                  </div>

                  <div className="h-4"></div>
                  <div className="p-4 rounded-2xl border border-green-500 bg-green-50 dark:bg-green-900/10 text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                    <Globe size={18}/> <span>Base musicale mondiale : connectée</span>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== VIEW: FAVORITES ===================== */}
            {/* Note de correction : le bloc d'en-tête "Tes Préférences Musicales" avec les
                boutons de synchro était dupliqué juste avant cette vue dans le fichier
                d'origine (probablement un reste de copier-coller). Le doublon a été retiré ;
                il ne reste plus qu'une seule carte, avec le bouton "Chercher via l'API"
                fusionné à côté du bouton de synchro Spotify. */}
            {view === 'favorites' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={`border-b ${cardBorder} pb-6`}>
                  <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
                    <Star className="text-yellow-500 fill-yellow-500/20" size={36} /> <span>Mes Favoris</span>
                  </h1>
                  {/* Explication du principe de priorisation, en langage simple — pas de
                      détail technique (pas de mention d'API/Deezer), juste l'ordre qui compte
                      pour l'utilisateur. Placée ici (en-tête de page) plutôt que dans la carte
                      "Tes Préférences Musicales" car elle concerne toute la page, pas
                      seulement cette carte. Remplace l'ancien sous-titre générique. */}
                  <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Priorité à la génération : tes titres favoris d'abord, puis tes artistes favoris, puis une recherche plus large si besoin pour compléter la playlist.</p>
                </div>

                <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <h3 className={`font-bold text-xl ${textHighlight}`}>Tes Préférences Musicales</h3>
                    {/* Bouton générique plutôt qu'un bouton dédié à Spotify : la gestion des
                        comptes connectés (Spotify, et bientôt d'autres plateformes) est
                        centralisée dans "Options & Comptes", pour ne pas avoir à empiler un
                        bouton par plateforme sur cette page à mesure que d'autres s'ajoutent. */}
                    <button onClick={() => changeView('settings')} className={`px-5 py-2.5 ${cardBg} border-2 ${borderAccentClass} rounded-xl text-sm font-bold ${textColorClass} transition-colors shadow-sm flex items-center gap-2 ${isNaughtyMode ? 'hover:bg-rose-500 dark:hover:bg-rose-600' : 'hover:bg-red-500 dark:hover:bg-red-600'} hover:text-white`}>
                      <RefreshCw size={18} /> <span>Synchroniser mes comptes</span>
                    </button>
                  </div>
                  <div className="space-y-8">
                    {/* LIGNE 1 : Titres uniquement — en premier car c'est le niveau le plus
                        précis de la cascade de génération (priorité 1). La tuile "+" remplace
                        l'ancien bouton "Rechercher un titre" du header. */}
                    <div>
                      <h4 className={`text-sm font-bold uppercase tracking-wider ${textMuted} mb-4 flex items-center`}><Heart size={16} className="mr-2"/> Titres Favoris</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {favorites.tracks.map((track, idx) => (
                          <div key={track.youtubeId || idx} className={`flex items-center gap-2 p-2.5 rounded-xl border ${cardBorder} ${inputBg}`}>
                            <button
                              onClick={() => togglePreview(track)}
                              disabled={!track.preview}
                              title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                            >
                              {playingPreviewId === track.youtubeId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className={`font-bold text-sm truncate ${textHighlight}`}>{track.title}</div>
                              <div className={`text-xs truncate ${textMuted}`}>{track.artist}{track.genre ? ` · ${track.genre}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Ce titre a été retenu malgré un genre différent de celui demandé — le pool de candidats n'avait rien de mieux disponible.">⚠️ Genre non confirmé</span>}</div>
                            </div>
                            {track.bpm ? <span className={`font-mono text-xs font-bold shrink-0 ${textColorClass}`}>{track.bpm} BPM</span> : null}
                            <button onClick={() => setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.youtubeId !== track.youtubeId) }))} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <X size={14}/>
                            </button>
                          </div>
                        ))}
                        <button onClick={() => { setCurrentPlaylist(null); setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed ${inputBorder} ${textMuted} hover:${textHighlight} hover:border-gray-400 transition-colors font-bold text-sm`}>
                          <Plus size={16}/> Ajouter un titre
                        </button>
                      </div>
                    </div>

                    {/* LIGNE 2 : Artistes uniquement — en second, car c'est le niveau
                        d'élargissement suivant dans la cascade de génération (priorité 1.5).
                        L'ajout est optimiste (voir addFavoriteArtistValidated). */}
                    <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                      <h4 className={`text-sm font-bold uppercase tracking-wider ${textMuted} mb-4 flex items-center`}><User size={16} className="mr-2"/> Top Artistes</h4>
                      <div className="flex flex-wrap gap-2.5 items-center">
                        {favorites.artists.map((artist, idx) => (
                          <span key={idx} className={`px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold ${textHighlight} shadow-sm flex items-center gap-2`}>
                            {artist}
                            <button onClick={() => setFavorites(prev => ({ ...prev, artists: prev.artists.filter(a => a !== artist) }))} className="text-gray-400 hover:text-red-500 transition-colors">
                              <X size={13}/>
                            </button>
                          </span>
                        ))}
                        {isAddingArtist ? (
                          <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-xl pl-3 pr-1 py-1 shadow-sm">
                            <input
                              type="text" autoFocus value={newFavArtist} onChange={e => setNewFavArtist(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') addFavoriteArtistValidated(newFavArtist);
                                if (e.key === 'Escape') { setNewFavArtist(""); setIsAddingArtist(false); }
                              }}
                              onBlur={() => { if (!newFavArtist.trim()) setIsAddingArtist(false); }}
                              placeholder="Nom de l'artiste..."
                              className="text-sm font-bold text-gray-900 outline-none bg-transparent w-36"
                            />
                            <button onClick={() => addFavoriteArtistValidated(newFavArtist)} className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 ${bgAccentClass}`}>
                              <Plus size={14}/>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setIsAddingArtist(true)} title="Ajouter un artiste" className="w-10 h-10 rounded-full bg-white border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors shadow-sm">
                            <Plus size={18}/>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sélecteur BPM/genre propre à cette page : permet d'explorer et d'ajouter aux
                    favoris des titres précis, indépendamment du wizard de génération. */}
                <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
                  <h3 className={`font-bold text-xl mb-6 flex items-center gap-2 ${textHighlight}`}><Target className={textColorClass} size={22}/> Explorer par BPM & Genre</h3>


                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className={`text-sm font-bold ${textMuted}`}>Rythme cible</label>
                        <span className={`text-2xl font-black ${textColorClass}`}>{favBpmTarget} <span className={`text-xs font-bold ${textMuted}`}>BPM</span></span>
                      </div>
                      <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={favBpmTarget} onChange={(e) => setFavBpmTarget(parseInt(e.target.value))} className={`w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className={`text-sm font-bold ${textMuted}`}>Marge d'erreur</label>
                        <span className={`text-sm font-black ${textColorClass}`}>± {favBpmTolerance} BPM</span>
                      </div>
                      <input type="range" min="1" max="30" value={favBpmTolerance} onChange={(e) => setFavBpmTolerance(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
                    </div>

                    <div>
                      <label className={`text-sm font-bold ${textMuted} block mb-3`}>Genres</label>
                      <div className="flex flex-wrap gap-2">
                        {availableGenres.map(genre => {
                          const isSelected = favSelectedGenres.includes(genre);
                          const warning = getGenreLocalDepthWarning(genre);
                          return (
                            <button key={genre} onClick={() => {
                              if (isSelected) { if (favSelectedGenres.length > 1) setFavSelectedGenres(favSelectedGenres.filter(g => g !== genre)); }
                              else setFavSelectedGenres([...favSelectedGenres, genre]);
                            }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                              {genre}{warning && <span className="ml-1">⚠️</span>}
                            </button>
                          );
                        })}
                        {!isNaughtyMode && (
                          <button onClick={() => setShowExtraGenres(!showExtraGenres)} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}>
                            {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                          </button>
                        )}
                      </div>
                      {!isNaughtyMode && showExtraGenres && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {EXTRA_GENRES.map(genre => {
                            const isSelected = favSelectedGenres.includes(genre);
                            const warning = getGenreLocalDepthWarning(genre);
                            return (
                              <button key={genre} onClick={() => {
                                if (isSelected) { if (favSelectedGenres.length > 1) setFavSelectedGenres(favSelectedGenres.filter(g => g !== genre)); }
                                else setFavSelectedGenres([...favSelectedGenres, genre]);
                              }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                {genre}{warning && <span className="ml-1">⚠️</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button onClick={() => {
                      setCurrentPlaylist(null); // BUG CORRIGÉ : sans ça, les ajouts partaient dans une ancienne playlist au lieu des favoris
                      setIsBpmSearchMode(true);
                      setWorldSearchResults([]);
                      setNoUsableResultsHint(false);
                      setIsSearchModalOpen(true);
                      searchTracksByBpm(favBpmTarget, favBpmTolerance, favSelectedGenres);
                    }} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                      <Search size={20}/> <span>Chercher des titres à {favBpmTarget} BPM</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== VIEW: TROPHIES ===================== */}
            {view === 'trophies' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={`border-b ${cardBorder} pb-6`}>
                  <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
                    <Award className="text-yellow-500" size={36} /> <span>Mes Trophées</span>
                  </h1>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Le mur des légendes. Accomplis tes sessions pour débloquer ces succès.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {TROPHIES_DATA.map(trophy => {
                    const isUnlocked = userStats.unlockedTrophies.includes(trophy.id);
                    return (
                      <div key={trophy.id} className={`${cardBg} rounded-2xl p-6 border ${isUnlocked ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : cardBorder} flex items-start space-x-4 transition-all`}>
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 ${isUnlocked ?
                          'bg-gradient-to-br from-yellow-100 to-yellow-300 dark:from-yellow-900/40 dark:to-yellow-700/40' : 'bg-gray-100 dark:bg-gray-800 grayscale opacity-40'}`}>
                          {trophy.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-bold text-lg ${isUnlocked ? textHighlight : textMuted}`}>{trophy.name}</h3>
                          <p className={`text-sm mt-1 ${isUnlocked ? textMuted : 'text-gray-400 dark:text-gray-600'}`}>{trophy.desc}</p>
                          {isUnlocked && (
                            <button onClick={() => handleShare('trophy', trophy)} className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center space-x-1">
                              <Share2 size={12}/> <span>Partager mon exploit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={`text-center mt-8 ${textMuted} text-sm font-medium bg-gray-100 dark:bg-gray-900 p-6 rounded-2xl`}>
                  <div className="flex justify-center items-center space-x-8">
                    <div>Sessions totales : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.totalCompleted}</span></div>
                    <div>Fichiers analysés : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.dataImports}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== VIEW: PLAYLIST RESULT WITH CHART ===================== */}
            {view === 'playlist' && currentPlaylist && (
              <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={"rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0 md:space-x-8 bg-gradient-to-br " + (isNaughtyMode ? 'from-rose-50 to-rose-100 dark:from-gray-900 dark:to-rose-950/40' : 'from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800') + " " + (isNaughtyMode ? 'border-rose-200 dark:border-rose-900/50' : cardBorder)}>
                  <div className="relative group/cover">
                    <div className={"w-32 h-32 md:w-48 md:h-48 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner text-5xl md:text-7xl " + inputBg}>
                      <div className={"absolute inset-0 opacity-10 dark:opacity-20 " + (isNaughtyMode ? 'bg-rose-500' : 'bg-red-500')}></div>
                      {currentPlaylist.coverIcon}
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-4 w-full">
                    {isEditingPlaylistName ? (
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <input
                          type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlaylist(); if (e.key === 'Escape') setIsEditingPlaylistName(false); }}
                          className={`text-3xl md:text-5xl font-black bg-transparent outline-none border-b-2 ${borderAccentClass} ${textHighlight} w-full`}
                        />
                        <button onClick={handleRenamePlaylist} className={`p-2 rounded-lg text-white shrink-0 ${bgAccentClass}`}><Check size={20}/></button>
                      </div>
                    ) : (
                      <h2 className={"text-3xl md:text-5xl font-black flex items-center gap-3 justify-center md:justify-start " + textHighlight}>
                        {currentPlaylist.name}
                        <button onClick={() => { setEditedPlaylistName(currentPlaylist.name); setIsEditingPlaylistName(true); }} className={`p-1.5 rounded-lg ${textMuted} hover:${textHighlight} transition-colors shrink-0`} title="Renommer la playlist">
                          <Edit3 size={20}/>
                        </button>
                      </h2>
                    )}
                    <div className={"flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium " + textMuted}>
                      <div className="flex items-center space-x-1"><Activity size={16}/><span>{currentPlaylist.workoutType}</span></div><span>•</span>
                      <div className="flex items-center space-x-1"><Clock size={16}/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div><span>•</span>
                      <div className="flex items-center space-x-1"><Music size={16}/><span>{currentPlaylist.tracks.length} titres</span></div>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                      {!savedPlaylists.find(p => p.id === currentPlaylist.id) ? (
                        <button onClick={handleSavePlaylist} className={"flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 " + cardBorder + " " + textHighlight}>
                          <Save size={16} /> <span>Sauvegarder la Playlist</span>
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                          <CheckCircle size={16} /> <span>Sauvegardée dans tes playlists</span>
                        </div>
                      )}
                      <button onClick={() => handleShare('playlist', currentPlaylist)} className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                        <Share2 size={16} /> <span>Partager</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className={"mt-8 p-6 md:p-8 rounded-3xl border shadow-lg " + cardBg + " " + cardBorder}>
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <div>
                      <h3 className={"font-bold text-xl flex items-center space-x-2 " + textHighlight}>
                        <Activity className={textColorClass}/>
                        <span>{currentActualData ? (selectedMetric === 'heartRate' ? "Fréquence cardiaque de la séance" : "Analyse Cadence (PPM) vs BPM cible") : "Courbe d'intensité (BPM)"}</span>
                      </h3>
                      {/* Les stats de "match %" ne s'affichent qu'en mode Cadence : la FC
                          n'a pas de cible équivalente dans TempoFit (voir analysisStats). */}
                      {currentActualData && selectedMetric === 'cadence' && analysisStats && (
                        <div className="flex items-center gap-3 mt-3 text-xs font-bold bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                          <span className="text-green-600 dark:text-green-400">🎯 Match: {analysisStats.matchPct}%</span>
                          <span className="text-red-500">⬆ Rapide: {analysisStats.abovePct}%</span>
                          <span className="text-yellow-600 dark:text-yellow-500">⬇ Lent: {analysisStats.belowPct}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Sélecteur de séance à analyser — n'apparaît que si au moins 2 dates
                          de complétion ont des données réelles importées, pour choisir
                          laquelle superposer à la courbe cible (par défaut, la plus récente). */}
                      {currentPlaylist.actualDataByDate && Object.keys(currentPlaylist.actualDataByDate).length > 1 && (
                        <select
                          value={selectedAnalysisDate || ''}
                          onChange={(e) => setSelectedAnalysisDate(e.target.value)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold ${inputBg} border ${inputBorder} ${textHighlight}`}
                        >
                          {Object.keys(currentPlaylist.actualDataByDate).sort().reverse().map(iso => (
                            <option key={iso} value={iso}>Séance du {formatCompletionDate(iso)}</option>
                          ))}
                        </select>
                      )}
                      {/* Sélecteur cadence/FC — n'apparaît que si les DEUX métriques sont
                          présentes pour cette séance précise (un même CSV peut n'avoir que
                          l'une des deux, auto-basculé automatiquement dans ce cas). */}
                      {availableMetrics.cadence && availableMetrics.heartRate && (
                        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                          <button onClick={() => setSelectedMetric('cadence')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (selectedMetric === 'cadence' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Cadence (PPM)</button>
                          <button onClick={() => setSelectedMetric('heartRate')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (selectedMetric === 'heartRate' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Fréquence cardiaque</button>
                        </div>
                      )}
                      {currentActualData && (
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                          <button onClick={() => setDataOffset(o => o - 10)} className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">-10s</button>
                          <span className={"text-xs font-bold w-24 text-center " + textMuted}>Décalage: {dataOffset > 0 ? '+' : ''}{dataOffset}s</span>
                          <button onClick={() => setDataOffset(o => o + 10)} className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">+10s</button>
                        </div>
                      )}
                      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <button onClick={() => setChartAxisType('temps')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartAxisType === 'temps' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Temps (Min)</button>
                        {currentPlaylist.targetMode === 'distance' && (
                          <button onClick={() => setChartAxisType('distance')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartAxisType === 'distance' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>Distance</button>
                        )}
                      </div>
                      {/* Sélecteur km/mi : purement cosmétique, ne change jamais l'unité
                          réellement utilisée pour générer la playlist — visible seulement
                          quand l'axe Distance est actuellement affiché. */}
                      {chartAxisType === 'distance' && (
                        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                          <button onClick={() => setChartDistanceUnitOverride('km')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartDistanceUnit === 'km' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>km</button>
                          <button onClick={() => setChartDistanceUnitOverride('mi')} className={"px-3 py-1.5 rounded-md text-xs font-bold transition-colors " + (chartDistanceUnit === 'mi' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : textMuted)}>mi</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Encart fixe pour le segment sélectionné — remplace la bulle flottante de
                      Recharts qui suivait la souris et se repositionnait de façon instable
                      (elle pouvait "sauter" en tentant de cliquer sur le bouton lecture).
                      Ici, la position ne bouge JAMAIS : seul le contenu change selon le
                      segment sélectionné (piloté par selectedSegmentIdx, déjà calculé). */}
                  <div className={`mb-4 p-4 rounded-2xl border ${cardBorder} ${inputBg} flex items-center gap-4 min-h-[76px]`}>
                    {selectedSegmentIdx !== null && trackSegments[selectedSegmentIdx] ? (
                      <>
                        <button
                          onClick={() => togglePreview(trackSegments[selectedSegmentIdx].track)}
                          disabled={!trackSegments[selectedSegmentIdx].track.preview}
                          title={trackSegments[selectedSegmentIdx].track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                          className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${trackSegments[selectedSegmentIdx].track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >
                          {playingPreviewId === trackSegments[selectedSegmentIdx].track.youtubeId ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`font-bold text-sm truncate ${textHighlight}`}>{trackSegments[selectedSegmentIdx].track.title}</div>
                          <div className={`text-xs truncate ${textMuted}`}>{trackSegments[selectedSegmentIdx].track.artist}{trackSegments[selectedSegmentIdx].track.genre ? ` · ${trackSegments[selectedSegmentIdx].track.genre}` : ''}{trackSegments[selectedSegmentIdx].track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Ce titre a été retenu malgré un genre différent de celui demandé.">⚠️ Genre non confirmé</span>}</div>
                        </div>
                        <div className={`text-xs font-mono ${textMuted} shrink-0`}>
                          Début : {formatDuration(trackSegments[selectedSegmentIdx].startTime)}<br/>
                          Durée : {formatDuration(trackSegments[selectedSegmentIdx].track.duration)}
                        </div>
                        <div className={`px-3 py-2 rounded-lg text-sm font-bold font-mono text-white shrink-0 ${isNaughtyMode ? 'bg-rose-500' : 'bg-gray-800 dark:bg-gray-700'}`}>
                          🎯 {trackSegments[selectedSegmentIdx].track.bpm} BPM
                        </div>
                      </>
                    ) : (
                      <span className={`text-sm ${textMuted}`}>Clique sur un segment du graphique pour voir le détail du titre et l'écouter.</span>
                    )}
                  </div>

                  <div className="h-72 w-full">
                    {currentPlaylist.tracks.length === 0 ? (
                      <div className={`h-full flex items-center justify-center text-center px-6 ${textMuted}`}>
                        Cette playlist ne contient aucun morceau (durée/distance probablement vide au moment de la génération) — regénère-la avec une distance ou une durée renseignée.
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {/* Interaction par CLIC plutôt que par survol continu (voir handleChartClick
                          ci-dessus pour le détail du raisonnement) : plus fiable, plus rapide,
                          et le résultat reste stable tant qu'on ne clique pas ailleurs. */}
                      <LineChart data={unifiedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} vertical={false} />

                        {/* Surbrillance de TOUT le segment sélectionné (pas juste son point de
                            départ) — la zone couvre exactement la durée/distance du morceau
                            sous le curseur, déterminée via handleChartMouseMove. */}
                        {selectedSegmentIdx !== null && trackSegments[selectedSegmentIdx] && (
                          <ReferenceArea
                            x1={chartAxisType === 'distance' ? trackSegments[selectedSegmentIdx].startDist * distanceDisplayFactor : trackSegments[selectedSegmentIdx].startTime}
                            x2={chartAxisType === 'distance' ? trackSegments[selectedSegmentIdx].endDist * distanceDisplayFactor : trackSegments[selectedSegmentIdx].endTime}
                            fill={isNaughtyMode ? '#f43f5e' : '#ef4444'}
                            fillOpacity={0.12}
                            stroke="none"
                          />
                        )}

                        {/* Repère vertical fin à chaque début de morceau, dans une couleur
                            distincte de la grille régulière — permet de voir où chaque titre
                            commence, en plus des graduations rondes (minutes/km). */}
                        {trackSegments.map((seg, i) => (
                          <ReferenceLine
                            key={i}
                            x={chartAxisType === 'distance' ? seg.startDist * distanceDisplayFactor : seg.startTime}
                            stroke="#3b82f6"
                            strokeOpacity={0.5}
                            strokeDasharray="2 2"
                          />
                        ))}

                        <XAxis 
                          dataKey={chartAxisType === 'distance' ? (d) => parseFloat(d.startDistVal) * distanceDisplayFactor : 'time'} 
                          type="number"
                          domain={chartXDomain}
                          ticks={chartXTicks}
                          stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} 
                          tick={{fontSize: 12}} 
                          tickFormatter={chartAxisType === 'distance' ? (val) => (Number.isInteger(val) ? `${val} ${chartDistanceUnit}` : `${val.toFixed(2)} ${chartDistanceUnit}`) : formatDuration}
                          allowDuplicatedCategory={false}
                        />
                        <YAxis domain={chartYDomain} stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} tick={{fontSize: 12}} width={40} />
                        
                        <RechartsTooltip
                          content={(props) => <CustomChartTooltip {...props} isNaughtyMode={isNaughtyMode} currentUnit={currentPlaylist.distanceUnit} metric={selectedMetric} />}
                          isAnimationActive={false}
                        />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '15px'}}/>

                        <Line 
                          dataKey="bpmTarget" 
                          name="Cible (BPM musical)" 
                          type="stepAfter"
                          stroke={isNaughtyMode ? '#f43f5e' : '#ef4444'} 
                          strokeWidth={3} 
                          connectNulls
                          dot={{ r: 3, fill: isNaughtyMode ? '#f43f5e' : '#ef4444', strokeWidth: 0 }} 
                        />

                        {currentActualData && (
                          <Line 
                            dataKey="realValue" 
                            name={selectedMetric === 'heartRate' ? "Fréquence cardiaque (pulsations/min)" : "Cadence réelle (PPM)"} 
                            type="monotone"
                            stroke={selectedMetric === 'heartRate' ? '#ec4899' : '#3b82f6'} 
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            connectNulls
                            dot={<RealDataDot tolerance={currentPlaylist.tolerance} metric={selectedMetric} />}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Liste des musiques AVEC BOUTON AJOUT MANUEL */}
                <div className={"rounded-3xl border overflow-hidden shadow-md " + cardBg + " " + cardBorder}>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {currentPlaylist.tracks.map((track, index) => (
                      <div
                        key={track.id}
                        draggable
                        onDragStart={handleTrackDragStart(index)}
                        onDragEnter={handleTrackDragEnter(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={handleTrackDragEnd}
                        className={`flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 group ${draggedTrackIndex === index ? 'opacity-40' : ''}`}
                      >
                        {/* Poignée de glisser-déposer — remplace les flèches ↑/↓, plus naturel
                            pour réordonner et ça libère de la place sur la ligne. */}
                        <div className={`shrink-0 cursor-grab active:cursor-grabbing px-1 ${textMuted}`} title="Glisser pour réordonner">
                          <GripVertical size={16}/>
                        </div>
                        <div className={"w-6 text-center font-medium text-xs " + textMuted}>{index + 1}</div>
                        {/* Bouton lecture d'extrait : toujours affiché (pas seulement au survol),
                            désactivé si le titre n'a pas d'extrait disponible (ex. venant de la BDD
                            locale ou de GetSongBPM, qui n'en fournissent pas). */}
                        <button
                          onClick={() => togglePreview(track)}
                          disabled={!track.preview}
                          title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors mr-2 ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >
                          {playingPreviewId === track.youtubeId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                        </button>
                        <div className="flex-1 px-2 min-w-0">
                          <div className={"font-bold text-sm truncate " + textHighlight}>{track.title}</div>
                          <div className={"text-xs truncate " + textMuted}>{track.artist}{track.genre ? ` · ${track.genre}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Ce titre a été retenu malgré un genre différent de celui demandé — le pool de candidats n'avait rien de mieux disponible.">⚠️ Genre non confirmé</span>}</div>
                        </div>
                        <div className="w-28 text-center shrink-0">
                          <div className={"font-mono font-bold text-sm " + textColorClass}>{track.bpm} <span className={`text-[10px] font-normal ${textMuted}`}>BPM</span></div>
                          {/* Les deux informations, clairement étiquetées — avant, seule la durée
                              s'affichait ici (sans le mot "Durée"), pendant que le tooltip du
                              graphique montrait le "Début" sans le préciser non plus : source de
                              confusion entre les deux, maintenant levée par les libellés. */}
                          <div className={`text-[11px] font-mono ${textMuted}`} title="Moment où ce titre démarre dans la séance">
                            Début : {track.startTimeStr || '0m 00s'}
                          </div>
                          <div
                            className={`text-[11px] font-mono ${textMuted}`}
                            title="Durée réelle du morceau dans la séance — l'extrait écoutable reste toujours limité à 30 secondes, quelle que soit cette durée."
                          >
                            Durée : {formatDuration(track.duration)}
                          </div>
                        </div>

                        {/* Menu d'options unique (Dupliquer / Remplacer large / Remplacer même
                            artiste) — regroupe ce qui prenait avant 3 icônes permanentes. */}
                        <div className="relative shrink-0">
                          <button onClick={() => setOpenTrackMenuIndex(openTrackMenuIndex === index ? null : index)} className={"p-2 rounded-lg transition-colors " + textMuted + " hover:" + textHighlight} title="Plus d'options">
                            <MoreVertical size={16}/>
                          </button>
                          {openTrackMenuIndex === index && (
                            <>
                              {/* Zone invisible pour fermer le menu au clic ailleurs */}
                              <div className="fixed inset-0 z-10" onClick={() => setOpenTrackMenuIndex(null)}></div>
                              {/* BUG CORRIGÉ : la liste des titres est dans un conteneur à coins
                                  arrondis avec `overflow-hidden` (nécessaire pour l'effet visuel) —
                                  ce qui coupait ce menu net dès qu'il s'ouvrait vers le bas sur un
                                  des 2-3 derniers titres, faute de place pour s'afficher entièrement
                                  avant le bord du conteneur. On ouvre donc le menu VERS LE HAUT pour
                                  les derniers titres de la liste plutôt que systématiquement vers le bas. */}
                              <div className={`absolute right-0 z-20 w-64 rounded-xl border shadow-2xl ${cardBg} ${cardBorder} overflow-hidden ${
                                index >= currentPlaylist.tracks.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'
                              }`}>
                                <button onClick={() => { handleDuplicateTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                                  <Plus size={16} className="text-green-500"/> Dupliquer ce titre
                                </button>
                                <div className={`h-px my-1 ${cardBorder} border-t`}></div>
                                <button onClick={() => { handleReplaceTrackSameArtist(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                                  <User size={16} className="text-purple-500"/> Remplacer (même artiste)
                                </button>
                                <button onClick={() => { handleReplaceTrack(index); setOpenTrackMenuIndex(null); }} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${textHighlight}`}>
                                  <RefreshCw size={16} className="text-blue-500"/> Remplacer (recherche large)
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        <button onClick={() => handleRemoveTrack(index)} className={"p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors shrink-0 " + textMuted} title="Retirer de la proposition">
                          <X size={16}/>
                        </button>
                      </div>
                    ))}

                    {/* BOUTON AJOUT MANUEL */}
                    <div className="p-2 bg-gray-50 dark:bg-gray-900/50">
                      <button onClick={() => { setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={"w-full py-3 flex items-center justify-center gap-2 text-sm font-bold border-2 border-dashed rounded-xl transition-colors hover:border-gray-400 " + inputBorder + " " + textMuted + " hover:" + textHighlight}>
                        <Plus size={18} /> <span>Ajouter un titre</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Répartition BPM et style musical — deux vues complémentaires de la
                    courbe d'intensité, pondérées par la durée de chaque titre (pas juste
                    un compte de titres) pour refléter combien de temps de la séance est
                    passé à chaque niveau/style. Donut + pourcentages + légende propre,
                    plutôt que le rendu Recharts par défaut (étiquettes en dehors qui se
                    chevauchent facilement). */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} shadow-xl`}>
                    <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${textHighlight}`}><Activity className={textColorClass} size={20}/> Répartition par BPM</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bpmDistributionData} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                            paddingAngle={3} cornerRadius={4} stroke="none"
                          >
                            {bpmDistributionData.map((entry, i) => <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip formatter={(value, name) => {
                            const total = bpmDistributionData.reduce((s, e) => s + e.value, 0);
                            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                            return [`${formatDuration(value)} (${pct}%)`, `${name} BPM`];
                          }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                      {bpmDistributionData.map((entry, i) => {
                        const total = bpmDistributionData.reduce((s, e) => s + e.value, 0);
                        const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-1.5 text-xs font-bold">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }}></span>
                            <span className={textHighlight}>{entry.name}</span>
                            <span className={textMuted}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} shadow-xl`}>
                    <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${textHighlight}`}><Music className={textColorClass} size={20}/> Répartition par style</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={genreDistributionData} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                            paddingAngle={3} cornerRadius={4} stroke="none"
                          >
                            {genreDistributionData.map((entry, i) => <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip formatter={(value, name) => {
                            const total = genreDistributionData.reduce((s, e) => s + e.value, 0);
                            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                            return [`${formatDuration(value)} (${pct}%)`, name];
                          }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                      {genreDistributionData.map((entry, i) => {
                        const total = genreDistributionData.reduce((s, e) => s + e.value, 0);
                        const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-1.5 text-xs font-bold">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }}></span>
                            <span className={textHighlight}>{entry.name}</span>
                            <span className={textMuted}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* ============================= MODALS ============================= */}

        {/* RECHERCHE MANUELLE DE TITRE VIA API STRICTE (GetSongBPM) : n'affiche que
            des titres dont le tempo est certifié par l'API. Si une playlist est
            actuellement affichée, le titre choisi y est ajouté ; sinon, il est
            ajouté aux favoris (utile pour "nourrir" l'algorithme de génération). */}
        {isSearchModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => {setIsSearchModalOpen(false); setSearchQuery(""); setIsBpmSearchMode(false);}}>
            <div className={"p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-1">
                <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
                  {isBpmSearchMode ? <Target className={textColorClass}/> : <Search className={textColorClass}/>}
                  <span>{isBpmSearchMode ? "Titres à ce BPM" : "Rechercher un titre"}</span>
                </h3>
                <button onClick={() => {setIsSearchModalOpen(false); setSearchQuery(""); setIsBpmSearchMode(false);}} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
              </div>
              {/* Disclaimer honnête : l'utilisateur n'a pas besoin de savoir qu'on passe par
                  une API, mais mérite de savoir que les résultats viennent d'un service tiers
                  (Deezer) et peuvent être incomplets ou approximatifs — sans jargon technique. */}
              <p className={`text-xs mb-5 ${textMuted}`}>* Connecté via Deezer — le BPM peut être approximatif, et certains titres peuvent rester introuvables.</p>

              {isBpmSearchMode ? (
                <div className={`mb-4 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg} flex items-center justify-between`}>
                  <span className={`text-sm font-bold ${textMuted}`}>Cible : <span className={textColorClass}>{bpmSearchParams.bpm} BPM ± {bpmSearchParams.tolerance}</span> · {bpmSearchParams.genres.join(', ')}</span>
                  <button onClick={() => searchTracksByBpm(bpmSearchParams.bpm, bpmSearchParams.tolerance, bpmSearchParams.genres)} disabled={isWorldSearching} className={`p-2 rounded-lg text-white ${bgAccentClass}`}>
                    {isWorldSearching ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                  </button>
                </div>
              ) : (
                <div className="mb-4 flex gap-2">
                  <div className={"flex-1 flex items-center px-4 py-3 rounded-xl border " + inputBg + " " + inputBorder}>
                    <Search size={18} className={"mr-3 " + textMuted} />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchWorldMusicApi()} placeholder="Titre ou artiste (ex: One More Time, Daft Punk)..." className={"bg-transparent w-full font-bold outline-none " + textHighlight} autoFocus />
                  </div>
                  <button onClick={searchWorldMusicApi} disabled={isWorldSearching} className={"px-4 rounded-xl text-white font-bold transition-transform active:scale-95 flex items-center justify-center " + bgAccentClass}>
                    {isWorldSearching ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 min-h-[200px]">
                {isWorldSearching && worldSearchResults.length === 0 ? (
                  <div className={`text-center py-8 font-medium ${textMuted} flex flex-col items-center gap-2`}>
                    <Loader2 className="animate-spin" size={20}/>
                    <span>Recherche en cours...</span>
                  </div>
                ) : worldSearchResults.length > 0 ? (
                  <>
                    {resultsContextLabel && !isBpmSearchMode && (
                      <div className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${textMuted}`}>{resultsContextLabel}</div>
                    )}
                    {worldSearchResults.map((track, i) => (
                      <div key={i} className={"flex items-center gap-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:" + cardBorder}>
                        {/* Bouton lecture/pause de l'extrait audio 30s (Deezer). Désactivé si aucun extrait disponible. */}
                        <button
                          onClick={() => togglePreview(track)}
                          disabled={!track.preview}
                          title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
                          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >
                          {playingPreviewId === track.youtubeId ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
                        </button>

                        {(() => {
                          const isAlreadyFavorited = !currentPlaylist && favorites.tracks.some(t => t.youtubeId === track.youtubeId);
                          return (
                            <button onClick={() => {
                                // Si on est dans la vue Playlist, on l'ajoute. Sinon, ça bascule dans les Favoris !
                                if (currentPlaylist) handleAddManualTrack(track);
                                else if (isAlreadyFavorited) {
                                   setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.youtubeId !== track.youtubeId) }));
                                   showToast("Retiré de tes favoris.");
                                } else {
                                   setFavorites(prev => ({
                                     ...prev,
                                     artists: Array.from(new Set([...prev.artists, track.artist])),
                                     tracks: [...prev.tracks, track]
                                   }));
                                   showToast("🎵 Ajouté à tes favoris !");
                                }
                            }} className="flex-1 min-w-0 text-left flex items-center justify-between gap-3">
                              <div className="truncate">
                                <div className={"font-bold text-sm truncate " + textHighlight}>{track.title}</div>
                                <div className={"text-xs truncate " + textMuted}>{track.artist}{track.genre ? ` · ${track.genre}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Ce titre a été retenu malgré un genre différent de celui demandé.">⚠️ Genre non confirmé</span>}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={"font-mono text-sm font-bold " + textColorClass}>{track.bpm} BPM</span>
                                {isAlreadyFavorited ? (
                                  <Check size={16} className="text-green-500" />
                                ) : (
                                  <Plus size={16} className={textMuted}/>
                                )}
                              </div>
                            </button>
                          );
                        })()}
                      </div>
                    ))}
                  </>
                ) : (
                  (isBpmSearchMode || searchQuery.length > 0) && !isWorldSearching ? (
                    noUsableResultsHint ? (
                      <div className={`text-center py-8 px-4 font-medium ${textMuted}`}>
                        {isBpmSearchMode
                          ? <>Aucun titre trouvé pile à {bpmSearchParams.bpm} BPM (± {bpmSearchParams.tolerance}) pour ces genres.<br/>Essaie d'élargir la marge d'erreur.</>
                          : <>Aucun titre avec un BPM connu trouvé pour "{searchQuery}".<br/>Essaie une orthographe différente, ou un titre plus précis.</>
                        }
                      </div>
                    ) : (
                      <div className={`text-center py-8 font-medium ${textMuted}`}>Aucun résultat.</div>
                    )
                  ) : (
                    <div className={`text-center py-8 font-medium ${textMuted}`}>Tape un titre ou un nom d'artiste pour chercher son BPM.</div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {isIconPickerOpen && currentPlaylist && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsIconPickerOpen(false)}>
            <div className={"p-8 rounded-3xl w-full max-w-sm shadow-2xl transform transition-all border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}><ImageIcon className="text-purple-500"/> <span>Personnaliser l'image</span></h3>
                <button onClick={() => setIsIconPickerOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {AVAILABLE_ICONS.map(icon => (
                  <button key={icon} onClick={() => { setCurrentPlaylist({...currentPlaylist, coverIcon: icon}); setSavedPlaylists(savedPlaylists.map(p => p.id === currentPlaylist.id ? {...p, coverIcon: icon} : p)); setIsIconPickerOpen(false); showToast("Image de playlist mise à jour !"); }} className={"text-3xl p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:scale-110 hover:shadow-md transition-all " + (currentPlaylist.coverIcon === icon ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' : '')}>{icon}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isCustomActivityModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCustomActivityModalOpen(false)}>
            <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl transform transition-all border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={"text-2xl font-bold " + textHighlight}>Activité personnalisée</h3>
                <button onClick={() => setIsCustomActivityModalOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
              </div>
              <input type="text" value={tempCustomActivity} onChange={e => setTempCustomActivity(e.target.value)} placeholder="Ex: Yoga..." className={"w-full rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-red-500 mb-8 border " + inputBg + " " + inputBorder + " " + textHighlight} autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setCustomActivity(tempCustomActivity); setIsCustomActivityModalOpen(false); } }} />
              <div className="flex justify-end space-x-3">
                <button onClick={() => setIsCustomActivityModalOpen(false)} className={"px-6 py-3 font-medium hover:" + textHighlight + " " + textMuted}>Annuler</button>
                <button onClick={() => {
                  setCustomActivity(tempCustomActivity);
                  setIsCustomActivityModalOpen(false);
                  // Easter egg : taper "Rick Astley" dans l'activité personnalisée débloque le trophée dédié.
                  if (tempCustomActivity.toLowerCase().includes('rick astley')) {
                    checkTrophies({ ...userStats, hasRickroll: true });
                  }
                }} className={"px-6 py-3 text-white font-bold rounded-xl shadow-md " + bgAccentClass}>Valider</button>
              </div>
            </div>
          </div>
        )}

        {isSavingRoutineModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSavingRoutineModalOpen(false)}>
            <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={"text-2xl font-bold flex items-center space-x-2 " + textHighlight}>
                  <BookmarkPlus className={isNaughtyMode ? "text-rose-500" : "text-yellow-500"}/> <span>Nouvelle Routine</span>
                </h3>
                <button onClick={() => setIsSavingRoutineModalOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
              </div>
              <div className="space-y-4 mb-6">
                <input type="text" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} placeholder="Nom (Ex: 5km Rapide)" className={"w-full rounded-xl px-4 py-3 font-bold outline-none border " + inputBg + " " + inputBorder + " " + textHighlight} onKeyDown={(e) => e.key === 'Enter' && handleSaveRoutine()} autoFocus />
                <div className="flex justify-between bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-200 dark:border-gray-800">
                  {AVAILABLE_ICONS.slice(0, isNaughtyMode ? 14 : 8).map(icon => (
                    <button key={icon} onClick={() => setNewRoutineIcon(icon)} className={"text-xl p-2 rounded-lg transition-transform " + (newRoutineIcon === icon ? 'bg-white dark:bg-gray-800 shadow-sm scale-110' : 'grayscale opacity-50')}>{icon}</button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className={"block text-sm font-bold mb-2 flex justify-between items-center " + textMuted}>
                    <span>Fréquence de génération auto.</span>
                    <span className="text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Premium</span>
                  </label>
                  <select value={newRoutineFreq} onChange={e => setNewRoutineFreq(e.target.value)} className={"w-full rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-500 border " + inputBg + " " + inputBorder + " " + textHighlight}>
                    {AUTO_GEN_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-white dark:bg-gray-900">{opt}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-2">Permet à TempoFit de préparer automatiquement ces playlists en arrière-plan.</p>
                </div>
              </div>
              <button onClick={handleSaveRoutine} className={"w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all " + bgAccentClass}>Enregistrer la routine</button>
            </div>
          </div>
        )}

        {/* Modale d'édition d'une routine existante. Contrairement à la modale de
            création, elle propose un choix explicite à la sauvegarde : appliquer les
            changements uniquement à la génération lancée maintenant ("cette séance
            seulement"), ou les répercuter sur la routine elle-même pour toutes les
            générations futures ("toujours pour cette routine"). */}
        {isEditRoutineModalOpen && editingRoutine && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setIsEditRoutineModalOpen(false); setEditingRoutine(null); }}>
            <div className={"p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
                  <Edit3 className={textColorClass}/>
                  <span>Éditer la routine</span>
                </h3>
                <button onClick={() => { setIsEditRoutineModalOpen(false); setEditingRoutine(null); }} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pr-1">
                <input type="text" value={editingRoutine.name} onChange={e => setEditingRoutine({...editingRoutine, name: e.target.value})} className={`w-full rounded-xl px-4 py-3 font-bold outline-none border ${inputBg} ${inputBorder} ${textHighlight}`} placeholder="Nom de la routine" />

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className={`text-sm font-bold ${textMuted}`}>Rythme cible</label>
                    <span className={`text-xl font-black ${textColorClass}`}>{editingRoutine.bpm} <span className={`text-xs font-bold ${textMuted}`}>BPM</span></span>
                  </div>
                  <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={editingRoutine.bpm} onChange={e => setEditingRoutine({...editingRoutine, bpm: parseInt(e.target.value)})} className={`w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className={`text-sm font-bold ${textMuted}`}>Marge d'erreur</label>
                    <span className={`text-sm font-black ${textColorClass}`}>± {editingRoutine.bpmTolerance} BPM</span>
                  </div>
                  <input type="range" min="0" max="30" value={editingRoutine.bpmTolerance} onChange={e => setEditingRoutine({...editingRoutine, bpmTolerance: parseInt(e.target.value)})} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
                </div>

                {editingRoutine.targetMode === 'distance' ? (
                  <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-4 py-3 justify-between`}>
                    <input type="number" min="0" step="0.1" value={editingRoutine.distanceVal} onChange={e => setEditingRoutine({...editingRoutine, distanceVal: e.target.value})} className={`bg-transparent w-full font-bold outline-none ${textHighlight}`} />
                    <span className={`text-sm font-bold ${textMuted}`}>{editingRoutine.distanceUnit}</span>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-4 py-3 justify-between`}>
                      <input type="number" min="0" value={editingRoutine.hours} onChange={e => setEditingRoutine({...editingRoutine, hours: e.target.value})} className={`bg-transparent w-full font-bold outline-none ${textHighlight}`} />
                      <span className={`text-sm font-bold ${textMuted}`}>Heures</span>
                    </div>
                    <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-4 py-3 justify-between`}>
                      <input type="number" min="0" max="59" value={editingRoutine.minutes} onChange={e => setEditingRoutine({...editingRoutine, minutes: e.target.value})} className={`bg-transparent w-full font-bold outline-none ${textHighlight}`} />
                      <span className={`text-sm font-bold ${textMuted}`}>Min</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className={`text-sm font-bold ${textMuted} block mb-3`}>Genres</label>
                  <div className="flex flex-wrap gap-2">
                    {(isNaughtyMode ? NAUGHTY_GENRES : STANDARD_GENRES).map(genre => {
                      const isSelected = editingRoutine.selectedGenres.includes(genre);
                      const warning = getGenreLocalDepthWarning(genre);
                      return (
                        <button key={genre} onClick={() => {
                          const current = editingRoutine.selectedGenres;
                          if (isSelected) { if (current.length > 1) setEditingRoutine({...editingRoutine, selectedGenres: current.filter(g => g !== genre)}); }
                          else setEditingRoutine({...editingRoutine, selectedGenres: [...current, genre]});
                        }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                          {genre}{warning && <span className="ml-1">⚠️</span>}
                        </button>
                      );
                    })}
                    {!isNaughtyMode && (
                      <button onClick={() => setShowExtraGenres(!showExtraGenres)} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}>
                        {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                      </button>
                    )}
                  </div>
                  {!isNaughtyMode && showExtraGenres && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {EXTRA_GENRES.map(genre => {
                        const isSelected = editingRoutine.selectedGenres.includes(genre);
                        const warning = getGenreLocalDepthWarning(genre);
                        return (
                          <button key={genre} onClick={() => {
                            const current = editingRoutine.selectedGenres;
                            if (isSelected) { if (current.length > 1) setEditingRoutine({...editingRoutine, selectedGenres: current.filter(g => g !== genre)}); }
                            else setEditingRoutine({...editingRoutine, selectedGenres: [...current, genre]});
                          }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                            {genre}{warning && <span className="ml-1">⚠️</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {editingRoutine.isIntervalMode && (
                  <div className={`text-xs p-3 rounded-xl ${inputBg} border ${inputBorder} ${textMuted}`}>
                    Cette routine est en mode Fractionné : les portions détaillées ne sont pas éditables depuis cette fenêtre pour l'instant. Les réglages ci-dessus (BPM, genres, marge d'erreur) s'appliqueront quand même à l'ensemble des portions.
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={applyRoutineEditOnce} className={`flex-1 py-3.5 rounded-xl font-bold border-2 ${cardBorder} ${textHighlight} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}>
                  Cette séance seulement
                </button>
                <button onClick={applyRoutineEditPermanently} className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
                  Toujours pour cette routine
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale de partage — BUG CORRIGÉ : handleShare() préparait shareData et ouvrait
            isShareModalOpen, mais aucune fenêtre ne s'affichait nulle part avant ça (le
            bouton "Partager" ne faisait donc rien de visible). copyToClipboard existait
            déjà et n'attendait que son interface. */}
        {isShareModalOpen && shareData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsShareModalOpen(false)}>
            <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
                  <Share2 className={textColorClass}/>
                  <span>Partager</span>
                </h3>
                <button onClick={() => setIsShareModalOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
              </div>
              <div className={`p-4 rounded-xl mb-6 text-sm ${inputBg} border ${inputBorder} ${textHighlight}`}>
                {shareData.text}
              </div>

              {/* Boutons directs vers les réseaux les plus courants — tuiles discrètes
                  (fond léger + accent coloré) plutôt que des blocs pleins saturés qui se
                  battaient visuellement entre eux. Le partage natif (menu "Partager"
                  habituel du téléphone/OS, quand disponible) est intégré comme une tuile
                  de plus, pas un gros bouton séparé qui dominait tout le reste. */}
              <div className={`grid gap-2 mb-4 ${typeof navigator !== 'undefined' && navigator.share ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button onClick={shareNative} title="Autres options" className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl ${cardBg} border ${cardBorder} hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}>
                    <Share2 size={18} className={textColorClass}/>
                    <span className={`text-[11px] font-bold ${textMuted}`}>Plus</span>
                  </button>
                )}
                <button onClick={shareToWhatsApp} title="WhatsApp" className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 transition-colors">
                  <MessageCircle size={18} className="text-[#25D366]"/>
                  <span className="text-[11px] font-bold text-[#25D366]">WhatsApp</span>
                </button>
                <button onClick={shareToTwitter} title="X (Twitter)" className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl ${cardBg} border ${cardBorder} hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}>
                  <span className={`text-base font-black leading-none ${textHighlight}`}>𝕏</span>
                  <span className={`text-[11px] font-bold ${textMuted}`}>X</span>
                </button>
                <button onClick={shareToFacebook} title="Facebook" className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 transition-colors">
                  <ExternalLink size={18} className="text-[#1877F2]"/>
                  <span className="text-[11px] font-bold text-[#1877F2]">Facebook</span>
                </button>
              </div>

              <button onClick={copyToClipboard} className={`w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 ${bgAccentClass}`}>
                <Copy size={18}/> Copier le lien
              </button>
              <button onClick={shareViaEmail} className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:${textHighlight} transition-colors flex items-center justify-center gap-2`}>
                <MessageCircle size={16}/> Envoyer par e-mail
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
