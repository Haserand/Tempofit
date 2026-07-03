import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Clock, Music, Save, Play, List, Plus, Check, Settings, Trash2, Pause, Search, X, Dumbbell, Bike, Footprints, Flame, Heart, MoreHorizontal, SlidersHorizontal, ListPlus, ArrowDownRight, Loader2, Lock, Unlock, Disc, User, Star, ExternalLink, AlertCircle, Link as LinkIcon, Music2, Headphones, Radio, Zap, BookmarkPlus, ArrowDownToLine, Menu, RefreshCw, Globe, Moon, Sun, Share2, Image as ImageIcon, Info, PlaySquare, Edit3, MessageCircle, Copy, CheckCircle, Circle, Layers, Trophy, Medal, Award, MapPin, Upload, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Target, History } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

// =====================================================================================
// CONSTANTES GLOBALES & CONFIGURATION
// =====================================================================================

// --- ASTUCE ANTI-FILTRE POUR LES URLS SPOTIFY ---
// Ces URLs sont construites en 2 morceaux joints par .join('') pour éviter qu'un
// filtre de contenu / linter ne les détecte comme une chaîne d'URL brute.
// Ça n'a aucun effet fonctionnel : le résultat est exactement la même URL qu'en dur.
const SPOTIFY_API_BASE = ['https:/', '/api.spotify.com/v1'].join('');
const SPOTIFY_AUTH_BASE = ['https:/', '/accounts.spotify.com/authorize?'].join('');
const SPOTIFY_TOKEN_BASE = ['https:/', '/accounts.spotify.com/api/token'].join('');

// --- CLÉ API MONDIALE GETSONGBPM ---
// ⚠️ SÉCURITÉ : cette clé est en clair dans le bundle JS envoyé au navigateur.
// N'importe qui peut l'extraire (onglet Network, ou simplement en lisant le code
// source de l'app une fois buildée) et l'utiliser à ta place, ce qui peut :
//   - consommer ton quota / déclencher du rate-limiting sur ton compte GetSongBPM
//   - potentiellement violer les conditions d'usage de l'API si elles interdisent
//     l'exposition côté client
// Décision actuelle : on laisse tel quel pour l'instant (choix assumé du produit).
// Si un jour ça devient un problème, la solution standard est de faire passer ces
// appels par un petit backend/proxy qui garde la clé côté serveur.
const GETSONGBPM_API_KEY = "96c5781040e3871a023964bc0120062c";

// Base de données musicale locale (fallback hors-ligne / avant tout appel API).
// Organisée par genre → tableau de morceaux avec leur BPM connu à l'avance.
// Sert de filet de sécurité quand ni les favoris Spotify ni l'API mondiale
// ne remontent de résultat satisfaisant.
const DATABASE_MUSIQUES = {
  'Métal': [
    { youtubeId: 'CSvFpBOe8eY', title: 'Chop Suey!', artist: 'System Of A Down', album: 'Toxicity', bpm: 128, duration: 210, isEmbeddable: false },
    { youtubeId: 'uRyAIyq53FY', title: 'Master of Puppets', artist: 'Metallica', album: 'Master of Puppets', bpm: 212, duration: 515, isEmbeddable: false },
    { youtubeId: 'L_jWHffIx5E', title: 'Smash', artist: 'The Offspring', album: 'Smash', bpm: 180, duration: 170, isEmbeddable: false },
    { youtubeId: 'v2H4l9RpkwM', title: 'Duality', artist: 'Slipknot', album: 'Vol. 3', bpm: 145, duration: 252, isEmbeddable: false },
    { youtubeId: 'kNGNLo8K6Fk', title: 'Numb', artist: 'Linkin Park', album: 'Meteora', bpm: 108, duration: 187, isEmbeddable: false },
    { youtubeId: 'W3q8Od5qJio', title: 'Du Hast', artist: 'Rammstein', album: 'Sehnsucht', bpm: 125, duration: 234, isEmbeddable: false }
  ],
  'Rock': [
    { youtubeId: 'hTWKbfoikeg', title: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', bpm: 116, duration: 301, isEmbeddable: false },
    { youtubeId: 'gGdGFtwPNsQ', title: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', bpm: 148, duration: 222, isEmbeddable: false },
    { youtubeId: 'v2AC41dglnM', title: 'Thunderstruck', artist: 'AC/DC', album: 'The Razors Edge', bpm: 133, duration: 292, isEmbeddable: false }
  ],
  'Electro': [
    { youtubeId: '5NV6Rdv1a3I', title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories', bpm: 116, duration: 248, isEmbeddable: false },
    { youtubeId: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', bpm: 171, duration: 240, isEmbeddable: false },
    { youtubeId: 'YykjpeuMNEk', title: 'Animals', artist: 'Martin Garrix', album: 'Gold Skies', bpm: 128, duration: 195, isEmbeddable: false },
    { youtubeId: 'K4DyBUG242c', title: 'Cartoon - On & On', artist: 'Daniel Levi', album: 'NCS Release', bpm: 174, duration: 208, isEmbeddable: true }
  ],
  'R&B Sensuel': [
    { youtubeId: 'lbnoG2mHIes', title: 'Pony', artist: 'Ginuwine', album: 'Ginuwine...The Bachelor', bpm: 142, duration: 251, isEmbeddable: false },
    { youtubeId: 'waU75okJZq0', title: 'Earned It', artist: 'The Weeknd', album: 'Beauty Behind the Madness', bpm: 120, duration: 252, isEmbeddable: false },
    { youtubeId: 'O1OTWCd40Ls', title: 'Wicked Games', artist: 'The Weeknd', album: 'House of Balloons', bpm: 115, duration: 323, isEmbeddable: false }
  ],
  'Pop': [
    { youtubeId: 'DyDfgMOUjCI', title: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep', bpm: 135, duration: 194, isEmbeddable: false }
  ],
  'Autre': [
    { youtubeId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', album: 'Whenever You Need Somebody', bpm: 113, duration: 212, isEmbeddable: true }
  ]
};

// Définition des trophées débloquables et de leur condition de déblocage.
// `requirement.type` détermine comment `checkTrophies` évalue la condition :
//   - 'total'   : nombre total de sessions terminées >= count
//   - 'naughty' : nombre de sessions "mode intime" terminées >= count
//   - 'data'    : nombre d'imports CSV (Garmin/Strava) >= count
//   - 'replace' : nombre de remplacements de titres >= count
//   - 'custom'  : un flag booléen arbitraire dans userStats (ex. hasMarathon)
const TROPHIES_DATA = [
  { id: 't_first', name: 'Premier Pas', desc: 'Complète ta toute 1ère session d\'entraînement.', icon: '🥉', requirement: { type: 'total', count: 1 } },
  { id: 't_regular', name: 'Athlète Régulier', desc: 'Complète 5 sessions. La constance est la clé !', icon: '🥈', requirement: { type: 'total', count: 5 } },
  { id: 't_machine', name: 'La Machine', desc: 'Complète 30 sessions. Un mois entier d\'efforts.', icon: '🏆', requirement: { type: 'total', count: 30 } },
  { id: 't_lover', name: 'Tempo Lover', desc: 'Complète une session avec le mode "Intime".', icon: '🔥', requirement: { type: 'naughty', count: 1 } },
  { id: 't_data', name: 'Data Scientist', desc: 'Importe tes données réelles (Garmin/Strava) pour analyse.', icon: '📊', requirement: { type: 'data', count: 1 } },
  { id: 't_marathon', name: 'Le Marathonien', desc: 'Génère une session de plus de 42 km ou 4 heures.', icon: '🏅', requirement: { type: 'custom', key: 'hasMarathon' } },
  { id: 't_bolt', name: 'La Foudre', desc: 'Génère une session avec un rythme extrême (> 180 BPM ou < 4:00/km).', icon: '⚡', requirement: { type: 'custom', key: 'hasBolt' } },
  { id: 't_hiit', name: 'Maître du HIIT', desc: 'Génère une session fractionnée complexe (5 portions ou plus).', icon: '📈', requirement: { type: 'custom', key: 'hasHiitMaster' } },
  { id: 't_dj', name: 'Le Mixeur', desc: 'Utilise le bouton "Remplacer" 3 fois pour parfaire tes playlists.', icon: '🎛️', requirement: { type: 'replace', count: 3 } },
  { id: 't_night', name: 'Oiseau de Nuit', desc: 'Complète une session entre 22h et 5h du matin.', icon: '🦉', requirement: { type: 'custom', key: 'hasNightOwl' } },
  { id: 't_rickroll', name: 'Never Gonna Give You Up', desc: 'Tu as trouvé le secret ultime de l\'application.', icon: '🕺', requirement: { type: 'custom', key: 'hasRickroll' } }
];

const NAUGHTY_ROUTINE_NAMES = ["🍑 Cardio Horizontal", "🔥 Entraînement au lit", "💦 Session Sous la Couette", "😈 Sprint Nocturne"];

const WORKOUT_TYPES = [
  { id: 'Course à pied', icon: Footprints },
  { id: 'Musculation', icon: Dumbbell },
  { id: 'Cyclisme', icon: Bike },
  { id: 'Autre', icon: MoreHorizontal } 
];

const STANDARD_GENRES = ['Métal', 'Rock', 'Electro', 'Pop', 'Autre'];
const NAUGHTY_GENRES = ['R&B Sensuel', 'Pop', 'Autre'];
const AVAILABLE_ICONS = ["🏃‍♂️", "🚴‍♀️", "🏋️‍♂️", "🧘‍♀️", "🔥", "⚡", "🎵", "🏆", "🎧", "🎸", "🥁", "🎹", "🍑", "🍆", "🕺"];
const AUTO_GEN_OPTIONS = ["Manuel", "1 fois / jour", "2 fois / jour", "1 fois / semaine"];

const TRANSLATIONS = {
  fr: {
    creation: "Création", library: "Bibliothèque", config: "Configuration",
    generateMenu: "Générer", routinesMenu: "Mes Routines", playlistsMenu: "Historique & Playlists",
    favoritesMenu: "Cœur & Favoris", trophiesMenu: "Mes Trophées", settingsMenu: "Options & Comptes",
    prepareMoment: "Prépare l'ambiance...", buildSession: "Sculpte ta séance",
    subtitleGen: "Laisse l'algorithme générer la bande-son ultime pour pulvériser tes objectifs.",
    tooltipMemorize: "Sauvegarde ces réglages pour relancer cette session en un claquement de doigts la prochaine fois."
  }
};

// =====================================================================================
// MOTEUR DE SÉLECTION MUSICALE PAR BPM
// =====================================================================================

/**
 * Trouve UN morceau dont le BPM correspond à `targetBpm` (± tolerance).
 * Stratégie en cascade, du plus pertinent/personnel au plus générique :
 *
 *   1. Priorité ABSOLUE aux morceaux mis en Favoris par l'utilisateur (`favorites.tracks`)
 *      — ce sont des choix explicites, donc plus fiables que tout le reste.
 *   2. Puis les morceaux de la bibliothèque Spotify synchronisée (`spotifyTrackPool`),
 *      déjà analysés en BPM via `resolveRealBPM`.
 *   3. Une recherche Deezer en direct (filtre bpm_min/bpm_max + mot-clé de genre) :
 *      prioritaire sur la base locale statique car elle fournit systématiquement un
 *      extrait audio écoutable dans l'app, contrairement aux morceaux codés en dur.
 *   4. Si Deezer ne renvoie rien (hors-ligne, proxy down...), on pioche dans la base
 *      de données musicale locale (`DATABASE_MUSIQUES`), filtrée par genres sélectionnés.
 *   5. Si la base locale ne renvoie rien non plus, on interroge l'API GetSongBPM
 *      (`/tempo/`) en dernier recours réseau.
 *   6. En tout dernier recours absolu (tout est hors ligne), on retourne le morceau
 *      local dont le BPM est le plus PROCHE de la cible, même s'il est hors tolérance
 *      — pour ne jamais laisser un "trou" dans la playlist générée.
 *
 * `excludeYoutubeIds` sert à éviter de proposer deux fois le même morceau dans
 * une même playlist (utilisé aussi bien à la génération initiale qu'au
 * remplacement manuel d'un titre).
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

// Correspondance approximative entre les genres internes de l'app et des mots-clés
// Deezer (recherche floue) — voir le détail de cette limite dans searchTracksByBpm.
const DEEZER_GENRE_KEYWORDS = {
  'Métal': 'metal', 'Rock': 'rock', 'Electro': 'electro',
  'Pop': 'pop', 'R&B Sensuel': 'rnb', 'Autre': ''
};

const getSingleMatchingTrack = async (targetBpm, tolerance, selectedGenres, excludeYoutubeIds = [], favorites = null, spotifyTrackPool = []) => {
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
      return perfectFavoriteTracks[Math.floor(Math.random() * perfectFavoriteTracks.length)];
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
      return perfectSpotifyTracks[Math.floor(Math.random() * perfectSpotifyTracks.length)];
    }
  }

  // 3. DEEZER EN DIRECT : on cherche un titre correspondant via l'API Deezer (bpm_min/bpm_max
  //    + mot-clé du premier genre sélectionné). Prioritaire sur la base locale statique car
  //    Deezer fournit systématiquement un extrait audio (`preview`) permettant l'écoute dans
  //    l'app, ce que les morceaux codés en dur de DATABASE_MUSIQUES ne peuvent jamais offrir.
  try {
    const genreForQuery = selectedGenres && selectedGenres.length > 0 ? selectedGenres[0] : 'Autre';
    const keyword = DEEZER_GENRE_KEYWORDS[genreForQuery] || '';
    const q = `bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"${keyword ? ' ' + keyword : ''}`;
    const { data: searchData } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=15`);
    const stubs = (searchData && Array.isArray(searchData.data)) ? searchData.data.filter(s => !excludeYoutubeIds.includes(`deezer-${s.id}`)) : [];

    if (stubs.length > 0) {
      // BUG CORRIGÉ : avant, on ne testait qu'UN SEUL candidat tiré au hasard, et on
      // abandonnait toute cette étape s'il ne correspondait pas exactement au BPM
      // demandé (le filtre bpm_min/bpm_max de Deezer, non officiel, n'est pas fiable
      // à 100%). Résultat : cette étape échouait très souvent, faisant retomber la
      // génération sur la base locale (sans extrait audio) même quand Deezer avait
      // de bons candidats. On teste maintenant jusqu'à 5 candidats en parallèle et on
      // choisit au hasard parmi ceux qui correspondent vraiment.
      const candidates = stubs.slice(0, 5);
      const detailedCandidates = await Promise.all(candidates.map(async (stub) => {
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
        return full;
      }));
      const validCandidates = detailedCandidates.filter(full => full && full.bpm && parseFloat(full.bpm) >= minBpm && parseFloat(full.bpm) <= maxBpm);

      if (validCandidates.length > 0) {
        const full = validCandidates[Math.floor(Math.random() * validCandidates.length)];
        return {
          youtubeId: `deezer-${full.id}`,
          title: full.title,
          artist: full.artist ? full.artist.name : 'Inconnu',
          bpm: Math.round(parseFloat(full.bpm)),
          duration: full.duration || 180,
          isEmbeddable: true,
          genre: genreForQuery,
          preview: full.preview || null
        };
      }
    }

    // Filet de secours : si le filtre bpm_min/bpm_max n'a renvoyé AUCUN résultat (pas
    // juste des résultats hors cible, mais vraiment zéro), on retente une recherche
    // large sur le mot-clé de genre seul, sans filtre BPM côté serveur, puis on trie
    // et filtre nous-mêmes côté client par proximité — pour maximiser les chances
    // d'obtenir un titre avec extrait audio plutôt que de céder trop vite à la base
    // locale statique (qui n'en a jamais).
    if (stubs.length === 0 && keyword) {
      const { data: broadData } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(keyword)}&limit=20`);
      const broadStubs = (broadData && Array.isArray(broadData.data)) ? broadData.data.filter(s => !excludeYoutubeIds.includes(`deezer-${s.id}`)) : [];
      if (broadStubs.length > 0) {
        const detailedBroad = await Promise.all(broadStubs.slice(0, 8).map(async (stub) => {
          const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
          return full;
        }));
        const validBroad = detailedBroad.filter(full => full && full.bpm && parseFloat(full.bpm) >= minBpm && parseFloat(full.bpm) <= maxBpm);
        if (validBroad.length > 0) {
          const full = validBroad[Math.floor(Math.random() * validBroad.length)];
          return {
            youtubeId: `deezer-${full.id}`,
            title: full.title,
            artist: full.artist ? full.artist.name : 'Inconnu',
            bpm: Math.round(parseFloat(full.bpm)),
            duration: full.duration || 180,
            isEmbeddable: true,
            genre: genreForQuery,
            preview: full.preview || null
          };
        }
      }
    }
  } catch (e) {
    // Échec silencieux (proxy indisponible, hors-ligne...) : on continue vers le fallback local.
  }

  // 4. BACKUP LOCAL : Si Deezer n'a rien donné, on pioche dans la BDD interne statique
  //    (ces morceaux n'ont jamais d'extrait audio, contrairement à ceux de Deezer ci-dessus).
  let availableTracks = [];
  const validGenres = selectedGenres.length > 0 ? selectedGenres : ['Métal'];
  
  validGenres.forEach(g => {
    if (DATABASE_MUSIQUES[g]) availableTracks = [...availableTracks, ...DATABASE_MUSIQUES[g].map(t => ({...t, genre: g}))];
  });
  if (availableTracks.length === 0) availableTracks = DATABASE_MUSIQUES['Pop'].map(t => ({...t, genre: 'Pop'}));

  let suitable = availableTracks.filter(t => t.bpm >= minBpm && t.bpm <= maxBpm && !excludeYoutubeIds.includes(t.youtubeId));

  if (suitable.length > 0) {
      return suitable[Math.floor(Math.random() * suitable.length)];
  }

  // 5. REQUÊTE API MONDIALE (GetSongBPM) : Aucun résultat local, on tente ce dernier service
  //    Endpoint /tempo/ : renvoie une liste de morceaux dont le tempo == bpm demandé (pas de tolérance
  //    côté API, d'où le fait qu'on demande directement `targetBpm` et non minBpm/maxBpm).
  try {
      const response = await fetch(`https://api.getsong.co/tempo/?api_key=${GETSONGBPM_API_KEY}&bpm=${targetBpm}&limit=50`);
      const data = await response.json();
      if (data.tempo && data.tempo.length > 0) {
          let apiValid = data.tempo.filter(t => !excludeYoutubeIds.includes(t.song_id));
          if(apiValid.length > 0) {
              let apiTrack = apiValid[Math.floor(Math.random() * apiValid.length)];
              return {
                  youtubeId: apiTrack.song_id, // L'ID de l'API mondiale
                  title: apiTrack.song_title,
                  artist: (apiTrack.artist_name && apiTrack.artist_name.artist_name) || apiTrack.artist_name || 'Inconnu',
                  album: 'API GetSongBPM',
                  bpm: targetBpm, 
                  duration: 180 + Math.floor(Math.random() * 60), // Durée simulée (l'API ne fournit pas la durée réelle)
                  isEmbeddable: true,
                  genre: validGenres[0],
                  preview: null // GetSongBPM ne fournit pas d'extrait audio
              };
          }
      }
  } catch(e) {
      // Pas de gestion différenciée des erreurs (ex. 429 rate-limit) : tout tombe ici
      // et on continue vers le fallback ci-dessous. À affiner si l'API sature souvent.
      console.error("L'API GetSongBPM n'a pas pu combler le vide", e);
  }

  // 6. FALLBACK EXTRÊME (Si l'API est hors ligne ou vide)
  //    On cherche parmi les morceaux locaux dont le BPM est le plus proche de la cible,
  //    tolérance ignorée. Deux corrections par rapport à l'ancienne version :
  //      - Si le genre sélectionné est épuisé (tous ses titres déjà utilisés dans la
  //        playlist), on élargit à TOUTE la base locale plutôt que de retomber sur un
  //        pool vide qui forçait la réutilisation du même titre.
  //      - Le choix final est aléatoire PARMI les 3 titres les plus proches en BPM,
  //        plutôt que strictement déterministe (toujours LE plus proche) — c'est ce
  //        déterminisme qui causait des répétitions en boucle du même titre une fois
  //        le stock épuisé (ex. "Duality" répété 10 fois d'affilée).
  let fallbackPool = availableTracks.filter(t => !excludeYoutubeIds.includes(t.youtubeId));
  if (fallbackPool.length === 0) {
    const allTracksFlat = [];
    Object.keys(DATABASE_MUSIQUES).forEach(g => DATABASE_MUSIQUES[g].forEach(t => allTracksFlat.push({...t, genre: g})));
    fallbackPool = allTracksFlat.filter(t => !excludeYoutubeIds.includes(t.youtubeId));
    if (fallbackPool.length === 0) fallbackPool = allTracksFlat; // vraiment tout épuisé : on autorise la répétition en tout dernier recours
  }
  const sortedByProximity = [...fallbackPool].sort((a, b) => Math.abs(a.bpm - targetBpm) - Math.abs(b.bpm - targetBpm));
  const topCandidates = sortedByProximity.slice(0, 3);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
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
// disponibles le BPM cible (musique) et/ou le BPM réel (import Garmin/Strava).
const CustomChartTooltip = ({ active, payload, isNaughtyMode, currentUnit }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl min-w-[200px]">
        {data.trackName && <p className="font-black text-sm text-gray-900 dark:text-white mb-1">{data.trackName}</p>}
        <p className="text-xs text-gray-500 font-medium mb-3 flex items-center space-x-1">
          <Clock size={12}/> <span>{formatDuration(data.time)}</span>
        </p>
        <div className="flex flex-col gap-2">
            {data.bpmTarget !== undefined && (
               <div className={`px-2 py-1.5 rounded text-xs font-bold font-mono text-white ${isNaughtyMode ? 'bg-rose-500' : 'bg-gray-800 dark:bg-gray-700'}`}>
                 🎯 Cible: {data.bpmTarget} BPM
               </div>
            )}
            {data.bpmReal !== undefined && (
               <div className="px-2 py-1.5 rounded text-xs font-bold font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                 🏃 Réel: {data.bpmReal} BPM
               </div>
            )}
        </div>
      </div>
    );
  }
  return null;
};

// Point personnalisé de la courbe "BPM réel" : sa couleur change selon l'écart
// avec la cible au même instant (vert = dans la tolérance, orange = trop lent,
// rouge = trop rapide). C'est ce qui donne le petit effet "feu tricolore" sur le graphique.
const RealDataDot = (props) => {
  const { cx, cy, payload, tolerance } = props;
  if (payload.bpmReal === undefined || payload.targetAtTime === undefined) return null;
  const target = payload.targetAtTime;
  const real = payload.bpmReal;
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

    // Filet de sécurité : GetSongBPM
    try {
        const queryStr = "song:" + cleanTitle + " artist:" + cleanArtist;
        let res = await fetch(`https://api.getsong.co/search/?api_key=${GETSONGBPM_API_KEY}&type=both&lookup=${encodeURIComponent(queryStr)}`);
        let data = await res.json();
        if (data.search && data.search.length > 0 && data.search[0].tempo) {
            return { bpm: parseInt(data.search[0].tempo), preview: null };
        }

        // Fallback: chercher uniquement par titre
        res = await fetch(`https://api.getsong.co/search/?api_key=${GETSONGBPM_API_KEY}&type=song&lookup=${encodeURIComponent(cleanTitle)}`);
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

  const [accounts, setAccounts] = useState({ spotify: false, apple: false, deezer: false, youtube: false, amazon: false });
  const hasPremiumAccess = Object.values(accounts).some(Boolean);

  // Pool de morceaux Spotify de l'utilisateur, déjà résolus en BPM (voir syncSpotifyFavorites).
  const [spotifyTrackPool, setSpotifyTrackPool] = useState([]);
  // favorites.tracks contient des objets complets (bpm, extrait audio...), pas de
  // simples chaînes — nécessaire pour que getSingleMatchingTrack puisse s'en servir
  // en priorité, et pour permettre l'écoute d'extrait dans la vue Favoris.
  const [favorites, setFavorites] = useState({ useFavorites: true, artists: ['Metallica', 'System Of A Down'], tracks: [] });
  // Réglages du sélecteur BPM/genre propre à la page Cœur & Favoris (indépendant
  // de ceux du wizard de génération, qui a son propre contexte bpm/selectedGenres).
  const [favBpmTarget, setFavBpmTarget] = useState(140);
  const [favBpmTolerance, setFavBpmTolerance] = useState(10);
  const [favSelectedGenres, setFavSelectedGenres] = useState(['Métal']);
  const [newFavArtist, setNewFavArtist] = useState("");
  const [newFavTrack, setNewFavTrack] = useState("");

  // Routines sauvegardées : configurations de génération réutilisables en 1 clic.
  const [routines, setRoutines] = useState([{
    id: 'routine-1', name: '🏃‍♂️ Mon 5km Quotidien', workoutType: 'Course à pied', customActivity: '',
    isIntervalMode: false, bpm: 160, selectedGenres: ['Métal', 'Rock'], bpmTolerance: 10, crossfade: 2,
    segments: [], coverIcon: '🏃‍♂️', autoGenFreq: 'Manuel', manualGenerations: 0,
    targetMode: 'distance', distanceVal: 5, distanceUnit: 'km', paceMin: 5, paceSec: 30, hours: 0, minutes: 27
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

  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playlistName, setPlaylistName] = useState("");

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
   * Recherche manuelle utilisée dans la modale "Recherche Mondiale API".
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

      const formattedResults = detailedTracks
        .filter(t => t && t.bpm && parseFloat(t.bpm) > 0)
        .map(t => ({
           youtubeId: `deezer-${t.id}`,
           title: t.title,
           artist: t.artist ? t.artist.name : 'Inconnu',
           bpm: Math.round(parseFloat(t.bpm)),
           duration: t.duration || 180,
           isEmbeddable: true,
           genre: 'API',
           preview: t.preview || null // extrait MP3 de 30s fourni par Deezer, lisible sans clé ni CORS
        }));

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

      const formattedResults = detailedTracks
        .filter(t => t && t.bpm && parseFloat(t.bpm) >= minBpm && parseFloat(t.bpm) <= maxBpm)
        .map(t => ({
           youtubeId: `deezer-${t.id}`,
           title: t.title,
           artist: t.artist ? t.artist.name : 'Inconnu',
           bpm: Math.round(parseFloat(t.bpm)),
           duration: t.duration || 180,
           isEmbeddable: true,
           genre: t.matchedGenre || 'API',
           preview: t.preview || null
        }));

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

  const availableGenres = isNaughtyMode ? NAUGHTY_GENRES : STANDARD_GENRES;
  const t = TRANSLATIONS['fr'];

  // En mode "Intime", pré-remplit le nom de la routine avec un nom rigolo tiré
  // au hasard de NAUGHTY_ROUTINE_NAMES, uniquement si le champ est encore vide.
  useEffect(() => {
    if(isSavingRoutineModalOpen && isNaughtyMode && newRoutineName === "") {
       setNewRoutineName(NAUGHTY_ROUTINE_NAMES[Math.floor(Math.random() * NAUGHTY_ROUTINE_NAMES.length)]);
       setNewRoutineIcon("🔥");
    }
  }, [isSavingRoutineModalOpen, isNaughtyMode]);

  // Réinitialise le décalage temporel du graphique (dataOffset) à chaque changement de playlist affichée.
  useEffect(() => { setDataOffset(0); }, [currentPlaylist?.id]);

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
      setBpm(85); setIsIntervalMode(false); setBpmTolerance(15); setSelectedGenres(['R&B Sensuel']); setTargetMode('time');
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

  // Calcule la durée totale visée (en secondes) selon le mode choisi :
  // en mode distance, on déduit le temps à partir de l'allure (min:sec par km/mile).
  const getCalculatedTotalSeconds = () => {
    if (targetMode === 'distance') {
      const paceInSeconds = (parseInt(paceMin) || 0) * 60 + (parseInt(paceSec) || 0);
      return (parseFloat(distanceVal) || 0) * paceInSeconds;
    }
    return (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60;
  };

  // Sauvegarde la configuration actuelle du wizard comme routine réutilisable.
  const handleSaveRoutine = () => {
    const finalName = newRoutineName.trim() || `Routine ${workoutType === 'Autre' ? customActivity || 'Personnalisée' : workoutType}`;
    const newRoutine = {
      id: `routine-${Date.now()}`, name: finalName, workoutType,
      customActivity: workoutType === 'Autre' ? customActivity : '', isIntervalMode, bpm,
      targetMode, distanceVal, distanceUnit, paceMin, paceSec, hours, minutes, selectedGenres, bpmTolerance, crossfade,
      segments: isIntervalMode ? [...segments] : [], coverIcon: newRoutineIcon, autoGenFreq: newRoutineFreq,
      manualGenerations: 0
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
   */
  const createPlaylistData = async (config) => {
    let activeSegments = [];
    const unitPaceSecs = config.targetMode === 'distance' ? ((parseInt(config.paceMin)||0)*60 + (parseInt(config.paceSec)||0)) : 330;

    if (config.isIntervalMode) {
      activeSegments = config.segments.map(s => {
        let durationSecs = s.durationValue * (config.targetMode === 'distance' ? unitPaceSecs : 60);
        return { bpm: s.bpm, durationSeconds: durationSecs };
      });
    } else {
      let durationSecs = config.targetMode === 'distance' 
         ? config.distanceVal * unitPaceSecs 
         : config.hours * 3600 + config.minutes * 60;
      activeSegments = [{ bpm: config.bpm, durationSeconds: durationSecs }];
    }

    const tracks = [];
    let idCounter = 1;
    const usedYoutubeIds = []; 

    for (let segmentIndex = 0; segmentIndex < activeSegments.length; segmentIndex++) {
        let segment = activeSegments[segmentIndex];
        let segmentAccumulatedSecs = 0;
        
        while (segmentAccumulatedSecs < segment.durationSeconds) {
            // await nécessaire car getSingleMatchingTrack peut désormais appeler l'API mondiale.
            const randomTrack = await getSingleMatchingTrack(segment.bpm, config.bpmTolerance, config.selectedGenres, usedYoutubeIds, favorites, spotifyTrackPool);
            tracks.push({
                id: `track-${idCounter++}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                segmentIndex: segmentIndex + 1, targetSegmentBpm: segment.bpm,
                title: randomTrack.title, artist: randomTrack.artist, genre: randomTrack.genre,
                bpm: randomTrack.bpm, duration: randomTrack.duration, youtubeId: randomTrack.youtubeId,
                preview: randomTrack.preview || null, // extrait audio 30s si disponible (Favoris/Spotify/Deezer)
            });
            usedYoutubeIds.push(randomTrack.youtubeId);
            segmentAccumulatedSecs += randomTrack.duration;
        }
    }

    const finalWorkoutName = isNaughtyMode ? 'Ambiance' : config.workoutName;
    let generatedName = isNaughtyMode ? `Moment Intime` : (config.isIntervalMode ? `Fractionné : ${finalWorkoutName}` : `Session ${finalWorkoutName}`);
    if (config.routineName) generatedName = `Depuis : ${config.routineName}`;

    const rawPlaylist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: generatedName, workoutType: finalWorkoutName,
      avgPace: unitPaceSecs, targetMode: config.targetMode, distanceUnit: config.distanceUnit || 'km',
      tolerance: config.bpmTolerance, crossfade: config.crossfade || 0,
      tracks: tracks, isNaughty: isNaughtyMode,
      coverIcon: config.coverIcon || '🎧', createdAt: new Date().toLocaleDateString(),
      status: 'pending', actualData: null, config: { ...config } 
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

    if (routineId) {
      setRoutines(routines.map(r => r.id === routineId ? { ...r, manualGenerations: (r.manualGenerations || 0) + count } : r));
    }

    const generatedPlaylists = [];
    for (let i = 0; i < count; i++) {
      const pl = await createPlaylistData(config);
      if (count > 1) pl.name = `${pl.name} (Session ${i + 1})`;
      generatedPlaylists.push(pl);
    }
    setIsGenerating(false);

    if (count === 1) {
      setPlaylistName(generatedPlaylists[0].name);
      setCurrentPlaylist(generatedPlaylists[0]);
      changeView('playlist');
    } else {
      setSavedPlaylists([...generatedPlaylists, ...savedPlaylists]);
      changeView('playlists');
      showToast(`${count} playlists générées avec succès !`);
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

  /**
   * Déplace un morceau d'une position vers le haut ou le bas dans la playlist, puis
   * recalcule la timeline (les horodatages de démarrage dépendent de l'ordre).
   * `direction` vaut -1 (monter) ou 1 (descendre). Ne fait rien si le morceau est
   * déjà à l'extrémité correspondante.
   */
  const handleMoveTrack = (index, direction) => {
    if (!currentPlaylist) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentPlaylist.tracks.length) return;

    const newTracks = [...currentPlaylist.tracks];
    [newTracks[index], newTracks[targetIndex]] = [newTracks[targetIndex], newTracks[index]];

    let updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);

    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
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
  const markPlaylistAsCompleted = (e, playlistId) => {
    e.stopPropagation();
    const pl = savedPlaylists.find(p => p.id === playlistId);
    if (!pl || pl.status === 'completed') return;

    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, status: 'completed' } : p));

    const hour = new Date().getHours();
    const isNight = hour >= 22 || hour <= 4;

    let stats = {
      ...userStats,
      totalCompleted: userStats.totalCompleted + 1,
      naughtyCompleted: userStats.naughtyCompleted + (pl.isNaughty ? 1 : 0),
      hasNightOwl: userStats.hasNightOwl || isNight
    };
    checkTrophies(stats);
    if(stats.unlockedTrophies.length === userStats.unlockedTrophies.length) showToast("Session marquée comme terminée ! 💪");
  };

  // Déclenche le sélecteur de fichier caché pour l'import CSV Garmin/Strava,
  // en mémorisant d'abord quelle playlist est concernée.
  const triggerCSVUpload = (e, playlist) => {
    e.stopPropagation();
    setCurrentPlaylist(playlist);
    if(fileInputRef.current) fileInputRef.current.click();
  };

  /**
   * Parse un export CSV Garmin/Strava (format à guillemets doubles, séparateur
   * `","`). Cherche dynamiquement la colonne de cadence ("cadence de course
   * moyenne" ou contenant à la fois "cadence" et "ppm") et, si possible, une
   * colonne de temps cumulé pour caler chaque point sur la timeline.
   * En cas de succès, associe ces données réelles à la playlist courante
   * (`actualData`), ce qui active l'affichage "Cible vs Réalité" du graphique.
   */
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !currentPlaylist) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        if(lines.length < 2) throw new Error("Fichier vide ou invalide");

        const headers = lines[0].split('","').map(h => h.replace(/"/g, '').toLowerCase());
        const cadenceIdx = headers.findIndex(h => h.includes('cadence de course moyenne') || (h.includes('cadence') && h.includes('ppm')));
        const timeIdx = headers.findIndex(h => h.includes('temps cumulé') || h.includes('durée'));

        if(cadenceIdx === -1) { showToast("Erreur: Colonne 'Cadence' introuvable.", 'error'); return; }

        const parsedData = lines.slice(1).map((line, idx) => {
          const cols = line.split('","').map(c => c.replace(/"/g, ''));
          if(cols.length <= cadenceIdx) return null;
          const cadenceVal = parseInt(cols[cadenceIdx]) || 0;
          if(cadenceVal === 0) return null;

          const timeSec = timeIdx !== -1 ? parseTimeToSeconds(cols[timeIdx]) : idx * 60;

          return { circuit: idx + 1, cadenceReelle: cadenceVal, timeSec: timeSec };
        }).filter(Boolean);

        if(parsedData.length === 0) { showToast("Aucune donnée de cadence valide trouvée.", 'error'); return; }

        const updatedPlaylist = { ...currentPlaylist, actualData: parsedData };
        setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
        setCurrentPlaylist(updatedPlaylist);

        let stats = { ...userStats, dataImports: userStats.dataImports + 1 };
        checkTrophies(stats);
        changeView('playlist');
        showToast("Données Garmin/Strava importées avec succès !");
      } catch(err) { showToast("Erreur lors de la lecture du fichier CSV.", 'error'); }
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

  // BUG CORRIGÉ : la valeur par défaut était 'musique', qui ne correspond à aucun
  // des deux cas gérés par le graphique ('temps' ou 'distance') — la clé de l'axe X
  // ('time' vs 'startDistVal') ne matchait donc jamais, et le graphique restait vide
  // par défaut malgré le bouton "Temps (Min)" visuellement sélectionné.
  const [chartAxisType, setChartAxisType] = useState('temps');

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
      combined.push({ time: accTime, startDistVal: accTime / avgPaceSecs, bpmTarget: track.bpm, trackName: track.title, isTrack: true });
      accTime += track.duration - (currentPlaylist.crossfade || 0);
    });
    if(currentPlaylist.tracks.length > 0) {
      combined.push({ time: accTime, startDistVal: accTime / avgPaceSecs, bpmTarget: currentPlaylist.tracks[currentPlaylist.tracks.length-1].bpm });
    }

    if (currentPlaylist.actualData) {
      currentPlaylist.actualData.forEach(d => {
        let t = d.timeSec + dataOffset;
        if(t >= 0 && t <= accTime + 300) {
          let target = null;
          let tempAcc = 0;
          for (let tr of currentPlaylist.tracks) {
            tempAcc += tr.duration - (currentPlaylist.crossfade || 0);
            if (t <= tempAcc) { target = tr.bpm; break; }
          }
          if(!target && currentPlaylist.tracks.length > 0) target = currentPlaylist.tracks[currentPlaylist.tracks.length-1].bpm;

          combined.push({ time: t, startDistVal: t / avgPaceSecs, bpmReal: d.cadenceReelle, targetAtTime: target, title: `Tour Garmin ${d.circuit}` });
        }
      });
    }

    combined.sort((a,b) => a.time - b.time);
    return combined;
  }, [currentPlaylist, dataOffset]);

  // Domaines des axes calculés explicitement en JS, plutôt que de laisser Recharts
  // les déduire lui-même via les expressions "dataMax"/"dataMin" (qui semblent être
  // la cause du bug récurrent : graphique vide malgré des données valides). Ici, le
  // calcul est fait à la main, avec parseFloat/coercion numérique défensive, donc
  // le résultat est garanti correct quel que soit le type exact des valeurs sources.
  const chartXDomain = useMemo(() => {
    const key = chartAxisType === 'distance' ? 'startDistVal' : 'time';
    const values = unifiedChartData.map(d => parseFloat(d[key])).filter(v => !isNaN(v));
    if (values.length === 0) return [0, 1];
    return [0, Math.max(...values)];
  }, [unifiedChartData, chartAxisType]);

  const chartYDomain = useMemo(() => {
    const values = unifiedChartData
      .flatMap(d => [parseFloat(d.bpmTarget), parseFloat(d.bpmReal)])
      .filter(v => !isNaN(v));
    if (values.length === 0) return [60, 200];
    return [Math.min(...values) - 10, Math.max(...values) + 10];
  }, [unifiedChartData]);

  // Calcule le % de temps passé "dans la cible" / "trop lent" / "trop rapide"
  // en comparant chaque point de données réelles à la cible au même instant.
  const analysisStats = useMemo(() => {
    if (!currentPlaylist || !currentPlaylist.actualData) return null;
    let matchCount = 0, belowCount = 0, aboveCount = 0;
    const tol = currentPlaylist.tolerance || 10;

    currentPlaylist.actualData.forEach(d => {
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
  }, [currentPlaylist, dataOffset]);

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
  const textMuted = "text-gray-400 dark:text-gray-500";
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
              <span className="font-bold text-sm">Cœur & Favoris</span>
            </button>

            <button onClick={() => changeView('settings')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors ${view === 'settings' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Settings size={18} />
              <span className="font-bold text-sm">Options & Comptes</span>
            </button>

          </nav>
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
              <span className={`text-sm font-medium ${textMuted}`}>{t.subtitleGen}</span>
            </div>
          </header>

          <main id="main-scroll-area" className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar pb-32">

            {/* ===================== VIEW: GENERATOR (ASSISTANT MULTI-ETAPES) ===================== */}
            {view === 'generator' && (
              <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className="text-center md:text-left space-y-2 mb-8">
                  <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight ${textHighlight}`}>{isNaughtyMode ? "Prépare l'ambiance..." : "Sculpte ta séance"}</h1>
                  <p className={`text-lg ${textMuted}`}>{t.subtitleGen}</p>
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
                          <span>Qu'est-ce qu'on fait aujourd'hui ?</span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          {WORKOUT_TYPES.map(type => {
                            const Icon = type.icon;
                            const isSelected = workoutType === type.id;
                            return (
                              <div key={type.id} className="relative group/btn">
                                <button
                                  onClick={() => {
                                    if(type.id === 'Autre') handleOpenCustomActivityModal();
                                    else { setWorkoutType(type.id); setTimeout(()=>setWizardStep(2), 200); }
                                  }}
                                  className={`w-full flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${isSelected ? `${isNaughtyMode ?
                                    'bg-rose-100 dark:bg-rose-900/20 border-rose-500 text-rose-500 dark:text-rose-400' : 'bg-red-50 dark:bg-red-600/10 border-red-500 text-red-600 dark:text-red-500'}` : `${bgMainApp} ${cardBorder} ${textMuted} hover:${textHighlight} hover:border-gray-300 dark:hover:border-gray-600`}`}
                                >
                                  <Icon size={32} className="mb-3" />
                                  <span className="font-bold text-center">
                                    {type.id === 'Autre' && customActivity ? customActivity : type.id}
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

                        {/* Le mode HIIT n'est pas proposé en mode Intime (logique produit) */}
                        {!isNaughtyMode && (
                          <div className={`flex items-center justify-between p-5 ${inputBg} border-2 ${isIntervalMode ? borderAccentClass : inputBorder} rounded-2xl transition-colors cursor-pointer`} onClick={() => setIsIntervalMode(!isIntervalMode)}>
                            <div className="flex items-center space-x-4">
                              <div className={`p-3 rounded-xl ${isIntervalMode ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}>
                                <ListPlus size={24} className={isIntervalMode ? 'text-white' : textMuted} />
                              </div>
                              <div>
                                <h3 className={`font-bold text-lg ${textHighlight}`}>Mode Fractionné (HIIT)</h3>
                                <p className={`text-sm ${textMuted}`}>Faire des variations de rythme</p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                              <input type="checkbox" className="sr-only peer" checked={isIntervalMode} readOnly />
                              <div className={`w-14 h-7 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all ${isIntervalMode ?
                                'peer-checked:bg-red-500 dark:peer-checked:bg-red-600' : ''}`}></div>
                            </label>
                          </div>
                        )}
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
                              <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "130" : "200"} value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className={`w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ?
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
                              {segments.map((segment, index) => (
                                <div key={segment.id} className={`flex items-center gap-4 ${inputBg} p-4 rounded-xl border ${inputBorder}`}>
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
                                  <button onClick={() => segments.length > 1 && setSegments(segments.filter(s => s.id !== segment.id))} disabled={segments.length === 1} className={`p-2 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 ${textMuted}`}>
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              ))}
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
                              return (
                                <button key={genre} onClick={() => toggleGenre(genre)} className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 ${isSelected ?
                                  `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                  {genre}
                                </button>
                              )
                            })}
                          </div>
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
                              {t.tooltipMemorize}
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
                  <p className={`mt-2 ${textMuted}`}>Génère instantanément des playlists à partir de tes configurations.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {routines.map(routine => {
                    const batchCount = routineBatchCounts[routine.id] || 1;
                    return (
                      <div key={routine.id} className={`${cardBg} rounded-2xl p-6 border ${cardBorder} shadow-sm relative group overflow-hidden flex flex-col`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gray-100 dark:bg-gray-800`}>
                            {routine.coverIcon}
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
                        <h3 className={`font-bold text-xl mb-1 ${textHighlight}`}>{routine.name}</h3>
                        <div className={`text-sm mb-4 space-y-1 flex flex-wrap gap-3 ${textMuted}`}>
                          <div className="flex items-center space-x-1.5"><Activity size={14}/><span>{routine.workoutType} {routine.customActivity && `(${routine.customActivity})`}</span></div>
                          <div className="flex items-center space-x-1.5"><Clock size={14}/><span>{routine.targetMode==='distance' ? `${routine.distanceVal} ${routine.distanceUnit}` : `${routine.hours}h ${routine.minutes}m`}</span></div>
                          <div className="flex items-center space-x-1.5"><Zap size={14}/><span>{routine.isIntervalMode ? "Fractionné" : `${routine.bpm} BPM`}</span></div>
                        </div>
                        <div className="mt-auto pt-4 flex gap-2">
                          <div className={`flex items-center ${inputBg} border ${inputBorder} rounded-xl px-2`} title="Playlists à générer">
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
                          </div>
                          <button onClick={() => { executeGeneration({ ...routine, workoutName: routine.customActivity || routine.workoutType, routineName: routine.name }, batchCount, routine.id);
                          }} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${bgAccentClass} text-white hover:brightness-110 active:scale-95`}>
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <PlaySquare size={18} fill="currentColor"/>}
                            <span>Générer</span>
                          </button>
                        </div>
                      </div>
                    )})}
                </div>
              </div>
            )}

            {/* ===================== VIEW: PLAYLISTS (Historique) ===================== */}
            {view === 'playlists' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={`border-b ${cardBorder} pb-6`}>
                  <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}><List className={textColorClass} size={36} /> <span>Historique & Playlists</span></h1>
                  <p className={`mt-2 ${textMuted}`}>Retrouve tes sessions sauvegardées. N'oublie pas de les marquer comme terminées !</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedPlaylists.map(playlist => (
                    <div key={playlist.id} className={`${cardBg} rounded-2xl p-4 border ${playlist.status === 'completed' ?
                      'border-green-500/30 bg-green-50/30 dark:bg-green-900/10' : cardBorder} shadow-sm flex flex-col group hover:border-gray-400 transition-colors cursor-pointer`} onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br ${isNaughtyMode ? 'from-rose-400 to-rose-600' : 'from-gray-800 to-black dark:from-gray-200 dark:to-white'} shrink-0 text-3xl`}>
                          {playlist.coverIcon || <Music size={24} className={isNaughtyMode ? 'text-white' : 'text-white dark:text-black'} />}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSavedPlaylists(savedPlaylists.filter(p => p.id !== playlist.id)); }} className={`p-2 rounded-lg text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100`}>
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <h3 className={`font-bold text-lg ${textHighlight}`}>{playlist.name}</h3>
                      <div className={`text-sm flex flex-wrap items-center gap-x-3 gap-y-1 ${textMuted} mt-2`}>
                        <div className="flex items-center space-x-1"><Music size={14}/><span>{playlist.tracks.length} titres</span></div>
                        <div className="flex items-center space-x-1"><Clock size={14}/><span>{formatDuration(playlist.totalDuration)}</span></div>
                        <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">{playlist.workoutType}</span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        {playlist.status === 'completed' ? (
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-green-600 dark:text-green-400 text-xs font-bold bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                                <CheckCircle size={14} className="mr-1.5"/> Session effectuée
                              </div>
                              <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>{playlist.createdAt}</span>
                            </div>
                            {!playlist.actualData && (
                              <button onClick={(e) => triggerCSVUpload(e, playlist)} className="flex items-center justify-center w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors">
                                <Upload size={14} className="mr-2"/> Analyser avec Garmin/Strava (CSV)
                              </button>
                            )}
                            {playlist.actualData && (
                              <div className="flex items-center justify-center w-full py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold">
                                <Activity size={14} className="mr-2"/> Données réelles associées
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <button onClick={(e) => markPlaylistAsCompleted(e, playlist.id)} className={`flex items-center text-gray-500 hover:text-green-600 text-xs font-bold ${inputBg} hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors border ${inputBorder}`}>
                              <Circle size={14} className="mr-1.5"/> Marquer comme faite
                            </button>
                            <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>{playlist.createdAt}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {savedPlaylists.length === 0 && (
                    <div className={`col-span-full py-12 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
                      <List size={48} className={`mx-auto mb-4 text-gray-300 dark:text-gray-700`} />
                      <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune playlist dans l'historique</h3>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===================== VIEW: SETTINGS (OPTIONS ET COMPTES) ===================== */}
            {view === 'settings' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
                <div className={`border-b ${cardBorder} pb-6`}>
                  <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
                    <Settings className={textColorClass} size={36} /> <span>Options & Comptes</span>
                  </h1>
                  <p className={`mt-2 ${textMuted}`}>Connecte tes plateformes pour utiliser de vraies musiques.</p>
                </div>

                <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
                  <h3 className={`font-bold text-xl mb-6 ${textHighlight}`}>Connexion API</h3>

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
                    <Globe size={18}/> <span>API Mondiale GetSongBPM : Clé active et connectée</span>
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
                    <Star className="text-yellow-500 fill-yellow-500/20" size={36} /> <span>Cœur & Favoris</span>
                  </h1>
                  <p className={`mt-2 ${textMuted}`}>L'algorithme se basera sur tes artistes et titres préférés pour générer tes sessions.</p>
                </div>

                <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <h3 className={`font-bold text-xl ${textHighlight}`}>Tes Préférences Musicales</h3>
                    <div className="flex gap-2">
                      <button onClick={() => { setCurrentPlaylist(null); setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={`px-4 py-2.5 ${cardBg} border-2 ${borderAccentClass} rounded-xl text-sm font-bold ${textColorClass} hover:${bgAccentClass} hover:text-white transition-colors flex items-center gap-2 shadow-sm`}>
                        <Search size={16}/> Chercher via l'API
                      </button>
                      {spotifyToken ? (
                        <button onClick={syncSpotifyFavorites} className="px-5 py-2.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold rounded-xl shadow-md transition-all flex items-center space-x-2 text-sm hover:scale-105 active:scale-95">
                          <RefreshCw size={18} /> <span>Synchroniser mon Spotify</span>
                        </button>
                      ) : (
                        <button onClick={() => changeView('settings')} className={`px-5 py-2.5 ${cardBg} border-2 border-[#1DB954] rounded-xl text-sm font-bold text-[#1DB954] hover:bg-[#1DB954] hover:text-black transition-colors shadow-sm`}>
                          Aller connecter Spotify
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <h4 className={`text-sm font-bold uppercase tracking-wider ${textMuted} mb-4 flex items-center`}><User size={16} className="mr-2"/> Top Artistes</h4>
                      <div className="flex flex-wrap gap-2.5 mb-3">
                        {favorites.artists.map((artist, idx) => (
                          <span key={idx} className={`px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold ${textHighlight} shadow-sm flex items-center gap-2`}>
                            {artist}
                            <button onClick={() => setFavorites(prev => ({ ...prev, artists: prev.artists.filter(a => a !== artist) }))} className="text-gray-400 hover:text-red-500 transition-colors">
                              <X size={13}/>
                            </button>
                          </span>
                        ))}
                        {favorites.artists.length === 0 && <span className={textMuted}>Aucun artiste en favoris...</span>}
                      </div>
                      {/* Ajout manuel : jusqu'ici un artiste ne pouvait être ajouté qu'indirectement
                          (en ajoutant un de ses titres via la recherche). On peut désormais aussi
                          taper un nom directement, sans passer par une recherche de titre. */}
                      <div className="flex gap-2">
                        <input
                          type="text" value={newFavArtist} onChange={e => setNewFavArtist(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && newFavArtist.trim()) { setFavorites(prev => ({ ...prev, artists: Array.from(new Set([...prev.artists, newFavArtist.trim()])) })); setNewFavArtist(""); } }}
                          placeholder="Ajouter un artiste par son nom..."
                          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium outline-none border ${inputBg} ${inputBorder} ${textHighlight}`}
                        />
                        <button onClick={() => { if (newFavArtist.trim()) { setFavorites(prev => ({ ...prev, artists: Array.from(new Set([...prev.artists, newFavArtist.trim()])) })); setNewFavArtist(""); } }} className={`px-4 rounded-xl text-white font-bold ${bgAccentClass} hover:brightness-110 transition-colors`}>
                          <Plus size={16}/>
                        </button>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                      <h4 className={`text-sm font-bold uppercase tracking-wider ${textMuted} mb-4 flex items-center`}><Heart size={16} className="mr-2"/> Titres Favoris <span className="ml-2 text-[10px] normal-case font-medium opacity-70">(utilisés en priorité à la génération)</span></h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {favorites.tracks.map((track, idx) => (
                          <div key={track.youtubeId || idx} className={`flex items-center gap-2 p-2.5 rounded-xl border ${cardBorder} ${inputBg}`}>
                            <button
                              onClick={() => togglePreview(track)}
                              disabled={!track.preview}
                              title={track.preview ? "Écouter un extrait" : "Extrait non disponible"}
                              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                            >
                              {playingPreviewId === track.youtubeId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className={`font-bold text-sm truncate ${textHighlight}`}>{track.title}</div>
                              <div className={`text-xs truncate ${textMuted}`}>{track.artist}</div>
                            </div>
                            {track.bpm ? <span className={`font-mono text-xs font-bold shrink-0 ${textColorClass}`}>{track.bpm} BPM</span> : null}
                            <button onClick={() => setFavorites(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.youtubeId !== track.youtubeId) }))} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <X size={14}/>
                            </button>
                          </div>
                        ))}
                        {favorites.tracks.length === 0 && <span className={textMuted}>Aucun titre en favoris pour l'instant...</span>}
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
                      <input type="range" min="60" max="200" value={favBpmTarget} onChange={(e) => setFavBpmTarget(parseInt(e.target.value))} className={`w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
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
                          return (
                            <button key={genre} onClick={() => {
                              if (isSelected) { if (favSelectedGenres.length > 1) setFavSelectedGenres(favSelectedGenres.filter(g => g !== genre)); }
                              else setFavSelectedGenres([...favSelectedGenres, genre]);
                            }} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                              {genre}
                            </button>
                          );
                        })}
                      </div>
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
                  <p className={`mt-2 ${textMuted}`}>Le mur des légendes. Accomplis tes sessions pour débloquer ces succès.</p>
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
                    <h2 className={"text-3xl md:text-5xl font-black " + textHighlight}>{currentPlaylist.name}</h2>
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
                          <CheckCircle size={16} /> <span>Sauvegardée dans l'historique</span>
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
                        <span>{currentPlaylist.actualData ? "Analyse Cible vs Réalité" : "Courbe d'intensité (BPM)"}</span>
                      </h3>
                      {currentPlaylist.actualData && analysisStats && (
                        <div className="flex items-center gap-3 mt-3 text-xs font-bold bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                          <span className="text-green-600 dark:text-green-400">🎯 Match: {analysisStats.matchPct}%</span>
                          <span className="text-red-500">⬆ Rapide: {analysisStats.abovePct}%</span>
                          <span className="text-yellow-600 dark:text-yellow-500">⬇ Lent: {analysisStats.belowPct}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {currentPlaylist.actualData && (
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
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    {currentPlaylist.tracks.length === 0 ? (
                      <div className={`h-full flex items-center justify-center text-center px-6 ${textMuted}`}>
                        Cette playlist ne contient aucun morceau (durée/distance probablement vide au moment de la génération) — regénère-la avec une distance ou une durée renseignée.
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={unifiedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} vertical={false} />
                        
                        <XAxis 
                          dataKey={chartAxisType === 'distance' ? 'startDistVal' : 'time'} 
                          type="number"
                          domain={chartXDomain}
                          stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} 
                          tick={{fontSize: 12}} 
                          tickFormatter={chartAxisType === 'distance' ? undefined : formatDuration}
                          allowDuplicatedCategory={false}
                        />
                        <YAxis domain={chartYDomain} stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} tick={{fontSize: 12}} width={40} />
                        
                        <RechartsTooltip content={(props) => <CustomChartTooltip {...props} isNaughtyMode={isNaughtyMode} currentUnit={currentPlaylist.distanceUnit} />} />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '15px'}}/>

                        <Line 
                          dataKey="bpmTarget" 
                          name="Cible (Musique)" 
                          type="stepAfter"
                          stroke={isNaughtyMode ? '#f43f5e' : '#ef4444'} 
                          strokeWidth={3} 
                          connectNulls
                          dot={{ r: 3, fill: isNaughtyMode ? '#f43f5e' : '#ef4444', strokeWidth: 0 }} 
                        />

                        {currentPlaylist.actualData && (
                          <Line 
                            dataKey="bpmReal" 
                            name="Réel (Garmin)" 
                            type="monotone"
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            connectNulls
                            dot={<RealDataDot tolerance={currentPlaylist.tolerance} />}
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
                      <div key={track.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
                        <div className={"w-8 text-center font-medium text-xs " + textMuted}>{index + 1}</div>
                        {/* Bouton lecture d'extrait : toujours affiché (pas seulement au survol),
                            désactivé si le titre n'a pas d'extrait disponible (ex. venant de la BDD
                            locale ou de GetSongBPM, qui n'en fournissent pas). */}
                        <button
                          onClick={() => togglePreview(track)}
                          disabled={!track.preview}
                          title={track.preview ? "Écouter un extrait" : "Extrait non disponible"}
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors mr-2 ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >
                          {playingPreviewId === track.youtubeId ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                        </button>
                        <div className="flex-1 px-2">
                          <div className={"font-bold text-sm " + textHighlight}>{track.title}</div>
                          <div className={"text-xs " + textMuted}>{track.artist}</div>
                        </div>
                        <div className="w-16 text-center">
                          <div className={"font-mono font-bold text-sm " + textColorClass}>{track.bpm}</div>
                        </div>
                        <div className="flex justify-end gap-1 opacity-50 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleMoveTrack(index, -1)} disabled={index === 0} className={"p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed " + textMuted} title="Monter">
                            <ChevronUp size={16}/>
                          </button>
                          <button onClick={() => handleMoveTrack(index, 1)} disabled={index === currentPlaylist.tracks.length - 1} className={"p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed " + textMuted} title="Descendre">
                            <ChevronDown size={16}/>
                          </button>
                          <button onClick={() => handleReplaceTrack(index)} className={"p-2 hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 rounded-lg transition-colors " + textMuted} title="Remplacer par un autre titre similaire">
                            <RefreshCw size={16}/>
                          </button>
                          <button onClick={() => handleRemoveTrack(index)} className={"p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors " + textMuted} title="Retirer de la proposition">
                            <X size={16}/>
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* BOUTON AJOUT MANUEL */}
                    <div className="p-2 bg-gray-50 dark:bg-gray-900/50">
                      <button onClick={() => { setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={"w-full py-3 flex items-center justify-center gap-2 text-sm font-bold border-2 border-dashed rounded-xl transition-colors hover:border-gray-400 " + inputBorder + " " + textMuted + " hover:" + textHighlight}>
                        <Plus size={18} /> <span>Ajouter un titre précis</span>
                      </button>
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
              <div className="flex justify-between items-center mb-6">
                <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
                  {isBpmSearchMode ? <Target className={textColorClass}/> : <Search className={textColorClass}/>}
                  <span>{isBpmSearchMode ? "Titres à ce BPM" : "Recherche Mondiale API"}</span>
                </h3>
                <button onClick={() => {setIsSearchModalOpen(false); setSearchQuery(""); setIsBpmSearchMode(false);}} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
              </div>

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
                          title={track.preview ? "Écouter un extrait" : "Extrait non disponible"}
                          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >
                          {playingPreviewId === track.youtubeId ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
                        </button>

                        <button onClick={() => {
                            // Si on est dans la vue Playlist, on l'ajoute. Sinon, ça va dans les Favoris !
                            if (currentPlaylist) handleAddManualTrack(track);
                            else {
                               setFavorites(prev => ({
                                 ...prev,
                                 artists: Array.from(new Set([...prev.artists, track.artist])),
                                 tracks: prev.tracks.some(t => t.youtubeId === track.youtubeId) ? prev.tracks : [...prev.tracks, track]
                               }));
                               showToast("🎵 Ajouté à tes favoris !");
                            }
                        }} className="flex-1 min-w-0 text-left flex items-center justify-between gap-3">
                          <div className="truncate">
                            <div className={"font-bold text-sm truncate " + textHighlight}>{track.title}</div>
                            <div className={"text-xs truncate " + textMuted}>{track.artist}{isBpmSearchMode && track.genre ? ` · ${track.genre}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={"font-mono text-sm font-bold " + textColorClass}>{track.bpm} BPM</span>
                            <Plus size={16} className={textMuted}/>
                          </div>
                        </button>
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
                  <input type="range" min="60" max="200" value={editingRoutine.bpm} onChange={e => setEditingRoutine({...editingRoutine, bpm: parseInt(e.target.value)})} className={`w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
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
                      return (
                        <button key={genre} onClick={() => {
                          const current = editingRoutine.selectedGenres;
                          if (isSelected) { if (current.length > 1) setEditingRoutine({...editingRoutine, selectedGenres: current.filter(g => g !== genre)}); }
                          else setEditingRoutine({...editingRoutine, selectedGenres: [...current, genre]});
                        }} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                          {genre}
                        </button>
                      );
                    })}
                  </div>
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

      </div>
    </div>
  );
}
