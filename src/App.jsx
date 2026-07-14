import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Clock, Music, Play, List, Plus, Check, Settings, Trash2, Pause, Search, X, Flame, Heart, ListPlus, Loader2, User, Star, AlertCircle, Zap, BookmarkPlus, Menu, RefreshCw, Share2, Image as ImageIcon, Info, Edit3, Copy, CheckCircle, Trophy, Upload, ChevronUp, ChevronDown, Target, History, MessageCircle, ExternalLink } from 'lucide-react';
import { ARTIST_CATALOG, STANDARD_GENRES, NAUGHTY_GENRES, EXTRA_GENRES, DEEZER_GENRE_KEYWORDS, getGenreLocalDepthWarning, GENRE_EQUIVALENCE_GROUPS, isDirectGenreMatch, genreRoughlyMatches, TITLE_STYLE_OVERRIDE_KEYWORDS, detectTitleStyleConflict, normalizeGenreForDisplay } from './musicCatalog';
import { NAUGHTY_ROUTINE_NAMES, WORKOUT_TYPES, NAUGHTY_WORKOUT_LABELS, NAUGHTY_WORKOUT_ICONS, NAUGHTY_WORKOUT_ORDER, WORKOUT_DEFAULT_BPM, WORKOUT_DEFAULT_TARGET, AVAILABLE_ICONS, AUTO_GEN_OPTIONS } from './appConfig';

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

import { safeFetchJson, deezerFetch, resolveDeezerGenre, detectBpmFromPreview, resolveBpmForCandidates, MAX_TRACK_DURATION, pickByDurationProximity, searchArtistsForBpm, fetchInBatches, searchDeezerPage, searchDeezerForGenres, getSingleMatchingTrack, buildSegmentTracks } from './musicEngine';
import { useTheme } from './hooks/useTheme';
import { useFavorites } from './hooks/useFavorites';
import { useRoutines } from './hooks/useRoutines';
import { useUserStats } from './hooks/useUserStats';
import { useAudioPreview } from './hooks/useAudioPreview';
import { useShare } from './hooks/useShare';
import { useElapsedTimer } from './hooks/useElapsedTimer';
import { useSessionAnalysis } from './hooks/useSessionAnalysis';
import SettingsView from './components/views/SettingsView';
import FavoritesView from './components/views/FavoritesView';
import TrophiesView from './components/views/TrophiesView';
import RoutinesView from './components/views/RoutinesView';
import HistoryView from './components/views/HistoryView';
import PlaylistsView from './components/views/PlaylistsView';
import StatsView from './components/views/StatsView';
import GeneratorView from './components/views/GeneratorView';
import PlaylistDetailView from './components/views/PlaylistDetailView';
// Début du découpage de App.jsx en composants de vue (voir passation) : chaque
// vue extraite vit dans src/components/views/, et consomme le hook useTheme
// plutôt que de redéfinir ses propres classes de couleur.
// Le moteur de génération (recherche Deezer, résolution de genre/BPM, catalogue
// d'artistes, construction des segments) est maintenant dans musicEngine.js —
// importé ci-dessus, plus rien à charger ici pour y toucher.


// =====================================================================================
// UTILITAIRES DE FORMATAGE / PARSING
// =====================================================================================

import { formatDuration, parseTimeToSeconds } from './utils/format';
// formatDuration/parseTimeToSeconds extraits dans utils/format.js (aucune
// dépendance à React ni au state, utilisés aussi par StatsView).

// =====================================================================================
// COMPOSANT PRINCIPAL
// =====================================================================================

export default function App() {
  // --- Navigation & état d'affichage global ---
  const [view, setView] = useState('generator');
  // Bascule "vue détaillée" de la page Statistiques — voir plus bas. Volontairement
  // hors du bloc `view === 'stats' && (() => {...})()` : ce bloc ne s'exécute que
  // quand cette vue est active, donc un `useState` dedans violerait les règles des
  // Hooks (appelés dans un ordre non garanti d'un rendu à l'autre).
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  // 'standard' | 'naughty' — quelles playlists nourrissent la page Statistiques.
  // Séparé plutôt que mélangé (voir la discussion) : le Mode Intime est déjà
  // traité avec discrétion ailleurs dans l'app (noms différents, pas de mélange
  // visuel) — les stats par défaut n'incluent DONC JAMAIS les séances Intime,
  // uniquement sur bascule explicite. Un seul pipeline de calcul/rendu pour les
  // deux (voir playlistsForStats plus bas), pas 2 pages dupliquées à maintenir.
  const [statsMode, setStatsMode] = useState('standard');
  // Genre/tranche BPM actuellement "ouvert" dans les donuts de la page Statistiques
  // (clic sur une part = aperçu ciblé dessous) — voir plus bas pour le détail.
  const [selectedStatsGenre, setSelectedStatsGenre] = useState(null);
  const [selectedStatsBpmBucket, setSelectedStatsBpmBucket] = useState(null);
  // Ligne actuellement dépliée dans les tables de la vue détaillée (genre ou
  // artiste) — voir plus bas. Contrairement au zoom léger de la vue simple
  // (plafonné à 3), ici la liste dépliée est COMPLÈTE, cohérent avec le principe
  // déjà établi pour cette vue ("aucun seuil caché pour gonfler un classement pauvre").
  const [expandedDetailGenre, setExpandedDetailGenre] = useState(null);
  const [expandedDetailArtist, setExpandedDetailArtist] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme, setTheme] = useState('dark'); 

  /**
   * "Moteur de vérité BPM" : détermine le BPM réel (et l'extrait audio, si dispo)
   * d'un morceau externe (ex. un titre liké sur Spotify dont on ne connaît pas
   * encore le tempo). Renvoie toujours { bpm, preview }, jamais juste un nombre.
   * Ordre de résolution :
   *   1. Recherche Deezer (titre + artiste, filtre avancé track:/artist:) via notre
   *      relais /api/deezer — la source principale : plus fiable que GetSongBPM
   *      (voir tout l'historique de debug de cette app) ET fournit systématiquement
   *      un extrait audio écoutable dans l'app.
   *   2. Si Deezer échoue, on retente sur GetSongBPM en dernier filet de sécurité.
   *   3. Fallback mathématique arbitraire (100 + longueur du titre modulo 80) si
   *      absolument rien n'a fonctionné — approximatif mais garantit qu'un BPM
   *      (même faux) est toujours renvoyé, pour ne jamais bloquer la synchro.
   * (L'ancienne étape 1 « recherche dans la base locale » a disparu avec le passage
   * à ARTIST_CATALOG : plus de liste de titres codés en dur à consulter ici — voir
   * musicCatalog.js pour le détail de ce changement d'architecture.)
   */
  const resolveRealBPM = async (title, artist) => {
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
  // Affiche un toast temporaire. `variant` détermine le style et la durée :
  //   - 'default' (3s) : confirmation neutre (icône check)
  //   - 'special'  (5s) : mise en avant positive, ex. déblocage de trophée (icône trophée dorée)
  //   - 'error'    (5s) : échec/erreur à signaler clairement (icône alerte rouge)
  const showToast = (message, variant = 'default') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), variant === 'default' ? 3000 : 5000);
  };

  // Pool de morceaux Spotify de l'utilisateur, déjà résolus en BPM (voir syncSpotifyFavorites).
  const [spotifyTrackPool, setSpotifyTrackPool] = useState([]);
  // favorites.tracks contient des objets complets (bpm, extrait audio...), pas de
  // simples chaînes — nécessaire pour que getSingleMatchingTrack puisse s'en servir
  // en priorité, et pour permettre l'écoute d'extrait dans la vue Favoris.
  // Titres et artistes de démonstration pré-remplis pour inciter l'utilisateur à
  // manipuler ces options dès le premier lancement (les découvrir passivement,
  // sans avoir à d'abord chercher/ajouter quoi que ce soit soi-même). Les deux
  // titres sont des valeurs figées à la main (pas tirées d'un catalogue), donc
  // leur BPM est fiable. `preview: null` ici par défaut, résolu séparément au
  // montage (voir le useEffect dédié après celui du <title>, même principe que
  // pour la playlist d'exemple — une URL d'extrait Deezer expire, impossible de
  // la coder en dur ici sans qu'elle finisse par casser silencieusement).
  const {
    favorites, setFavorites,
    favBpmTarget, setFavBpmTarget,
    favBpmTolerance, setFavBpmTolerance,
    favSelectedGenres, setFavSelectedGenres,
    newFavArtist, setNewFavArtist,
    isAddingArtist, setIsAddingArtist,
    addFavoriteArtistValidated, toggleTrackFavorite, toggleArtistFavorite,
  } = useFavorites(showToast);

  const {
    routines, setRoutines,
    routineBatchCounts, setRoutineBatchCounts,
    isSavingRoutineModalOpen, setIsSavingRoutineModalOpen,
    editingRoutine, setEditingRoutine,
    isEditRoutineModalOpen, setIsEditRoutineModalOpen,
    newRoutineName, setNewRoutineName,
    newRoutineIcon, setNewRoutineIcon,
    newRoutineFreq, setNewRoutineFreq,
    getDisplayRoutineName, getDisplayRoutineIcon,
    addRoutine, updateRoutine,
  } = useRoutines(isNaughtyMode, showToast);

  const { userStats, setUserStats, checkTrophies } = useUserStats(showToast);

  // --- État du wizard de génération (4 étapes) ---
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState(['Métal']);
  // Répartition en % entre les genres sélectionnés ENSEMBLE (utile uniquement à
  // partir de 2 genres) — voir setGenreWeight pour la logique de verrouillage :
  // un genre modifié manuellement se fige à sa valeur, seuls les genres jamais
  // touchés se repartagent ce qui reste, à parts égales entre eux.
  const [genreWeights, setGenreWeights] = useState({ 'Métal': 100 });
  const [lockedGenreWeights, setLockedGenreWeights] = useState(new Set());

  // Répartit 100% à parts égales entre les genres donnés (reste éventuel affecté
  // au dernier, pour que la somme tombe toujours pile sur 100 malgré les
  // arrondis — ex. 3 genres → 33/33/34, pas 33/33/33 qui ne totaliserait que 99).
  const equalSplitWeights = (genres) => {
    if (genres.length === 0) return {};
    const base = Math.floor(100 / genres.length);
    const result = {};
    genres.forEach(g => { result[g] = base; });
    result[genres[genres.length - 1]] += 100 - base * genres.length;
    return result;
  };

  /**
   * Modifie le % d'UN genre, verrouille sa valeur, et redistribue ce qu'il reste
   * à parts égales entre les genres PAS ENCORE verrouillés — jamais en touchant
   * aux genres déjà fixés manuellement avant (ex. Métal fixé à 70% reste à 70%
   * même si on ajuste Rock ensuite ; seul le dernier genre non verrouillé absorbe
   * la différence). La valeur saisie est plafonnée pour ne jamais dépasser ce qui
   * reste disponible une fois les autres genres déjà verrouillés retirés.
   */
  const setGenreWeight = (genre, rawValue) => {
    const otherLockedSum = [...lockedGenreWeights].filter(g => g !== genre).reduce((s, g) => s + (genreWeights[g] || 0), 0);
    const maxAllowed = Math.max(0, 100 - otherLockedSum);
    const value = Math.min(Math.max(0, parseInt(rawValue) || 0), maxAllowed);

    const newLocked = new Set(lockedGenreWeights);
    newLocked.add(genre);
    setLockedGenreWeights(newLocked);

    const unlockedGenres = selectedGenres.filter(g => !newLocked.has(g));
    const remainder = 100 - otherLockedSum - value;
    const newWeights = { ...genreWeights, [genre]: value };
    if (unlockedGenres.length > 0) {
      const base = Math.floor(remainder / unlockedGenres.length);
      unlockedGenres.forEach(g => { newWeights[g] = base; });
      newWeights[unlockedGenres[unlockedGenres.length - 1]] += remainder - base * unlockedGenres.length;
    }
    setGenreWeights(newWeights);
  };

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
  // Autorise ou non les titres de plus de 6 minutes dans la génération — sans
  // ça, l'algorithme de remplissage (qui choisit le titre dont la durée colle
  // le mieux au temps restant) pouvait piocher un morceau atypiquement long
  // (ex. "April" de Deep Purple, ~12 min) juste parce qu'il comblait bien la
  // séance, au détriment de la variété (4 titres pour 45 minutes au lieu d'une
  // dizaine). Off par défaut : la plupart des séances veulent de la variété,
  // pas quelques épiques qui monopolisent tout le temps.
  const [allowLongTracks, setAllowLongTracks] = useState(false);
  
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
  // vraiment générée, et laissée en statut "à faire" pour que la découverte du
  // bouton "marquer comme terminée" reste naturelle. `preview: null` ici par
  // défaut : le vrai extrait Deezer est résolu séparément au montage (voir le
  // useEffect dédié plus bas, après celui du <title>) plutôt que codé en dur —
  // une URL d'extrait Deezer expire au bout de quelques heures, donc la figer
  // ici casserait le bouton d'écoute silencieusement après coup.
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
  // Chrono affiché dans le bandeau de génération — avant, le message restait
  // statique tout du long d'UNE playlist (seul le spinner tournait), ce qui
  // pouvait sembler figé/ennuyeux sur une génération un peu longue. Démarre à 0
  // dès que isGenerating passe à true (voir le useEffect ci-dessous), pas après
  // un délai.
  const elapsedSeconds = useElapsedTimer(isGenerating);

  const {
    shareData, setShareData,
    isShareModalOpen, setIsShareModalOpen,
    handleShare, copyToClipboard, shareNative,
    shareToWhatsApp, shareToTwitter, shareToFacebook, shareViaEmail,
  } = useShare(showToast);
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
  // --- Pagination + détection "recherche par artiste" (voir searchWorldMusicApi) ---
  // Décalage (paramètre `index` de l'API Deezer) pour le PROCHAIN appel "Voir
  // plus" — pas la page actuellement affichée, mais celle qu'il reste à charger.
  const [searchResultsOffset, setSearchResultsOffset] = useState(0);
  // true tant que Deezer indique qu'il reste des résultats au-delà de ceux déjà chargés.
  const [searchHasMoreResults, setSearchHasMoreResults] = useState(false);
  // Spinner dédié au bouton "Voir plus" — distinct de isWorldSearching (qui vide
  // toute la liste pendant le chargement) pour ne pas faire disparaître les
  // résultats déjà affichés pendant qu'on en charge d'autres à la suite.
  const [isLoadingMoreResults, setIsLoadingMoreResults] = useState(false);
  // Non-null seulement si la recherche initiale a identifié avec confiance un
  // artiste correspondant au texte tapé (voir isConfidentArtistMatch).
  const [searchActiveArtistName, setSearchActiveArtistName] = useState(null);
  // youtubeId du titre actuellement en cours de correction manuelle de BPM dans
  // la modale de recherche (voir renderSearchResultRow / commitBpmEdit) — null
  // si aucune édition en cours.
  const [editingBpmId, setEditingBpmId] = useState(null);
  // Message affiché pendant la recherche — tiré au sort à chaque nouvelle
  // recherche (reset=true) parmi une petite liste, pour rester dans le ton
  // ludique déjà présent ailleurs dans l'app (trophées, Mode Intime...) plutôt
  // qu'un "Recherche en cours..." neutre et répété à chaque clic.
  const SEARCH_LOADING_MESSAGES = [
    "On fouille chez Deezer...",
    "Ça arrive, promis...",
    "Un peu de patience, le rythme se cherche...",
    "On compte les BPM...",
    "On tend l'oreille...",
    "Ça chauffe les enceintes...",
    "Recherche du bon tempo en cours..."
  ];
  const [searchLoadingMessage, setSearchLoadingMessage] = useState(SEARCH_LOADING_MESSAGES[0]);
  // Chrono affiché pendant le chargement (voir l'effet dédié plus bas) — repart
  // de 0 à chaque nouvelle recherche, incrémente chaque seconde tant que
  // isWorldSearching est vrai. Rassure sur une recherche un peu longue (plusieurs
  // appels réseau en cascade : Deezer, puis GetSongBPM/détection par titre
  // manquant) plutôt que de laisser un spinner muet sans indication de progression.
  const searchElapsedSeconds = useElapsedTimer(isWorldSearching);
  // Réserve CACHÉE des titres qui matchent le texte tapé mais PAS l'artiste
  // identifié (ex. "Starboy" pour "daft punk", où Daft Punk n'est que
  // co-producteur) — voir searchWorldMusicApi. Jamais affichée tant qu'il reste
  // de vrais titres de l'artiste à montrer ou des pages Deezer non explorées ;
  // révélée seulement une fois la recherche générale épuisée (voir le rendu de
  // la modale) — pour ne jamais faire disparaître totalement ces titres non plus,
  // au cas où l'utilisateur les cherchait vraiment.
  const [worldSearchOtherResults, setWorldSearchOtherResults] = useState([]);
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
  const { playingPreviewId, togglePreview } = useAudioPreview(isSearchModalOpen, showToast);

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

  const SEARCH_PAGE_SIZE = 10;

  // Compare le texte tapé au nom d'un artiste Deezer, insensible à la casse,
  // aux accents (ex. "beyonce" doit matcher "Beyoncé"), aux articles de tête
  // (ex. "beatles" doit matcher "The Beatles") et — depuis un retour utilisateur
  // sur "dat punk" — aux petites fautes de frappe (voir isConfidentArtistMatch,
  // 3 passes progressives : égalité exacte, puis sans article, puis tolérance
  // Levenshtein bornée). Reste volontairement strict sur les mots courts/génériques
  // ("punk" seul ne doit matcher ni "daft punk" ni l'inverse) pour éviter de
  // basculer à tort en mode artiste sur un terme trop générique.
  const normalizeForArtistMatch = (str) => (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
  // Retire un article de tête ("the", "la", "le", "les") avant comparaison —
  // sans ça, "beatles" ne matchait pas "The Beatles" (un des cas les plus
  // évidents qu'on puisse taper), parce que ni l'un ni l'autre n'est un
  // préfixe de mot entier de l'autre une fois l'article laissé en place.
  const stripLeadingArticle = (s) => s.replace(/^(the|les?|la)\s+/, '');
  // Distance de Levenshtein classique (nb minimal d'insertions/suppressions/
  // substitutions pour passer d'une chaîne à l'autre) — utilisée ci-dessous
  // comme filet de tolérance aux fautes de frappe, en dernier recours seulement.
  const levenshteinDistance = (a, b) => {
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
  const isConfidentArtistMatch = (query, artistName) => {
    const q = normalizeForArtistMatch(query);
    const aFull = normalizeForArtistMatch(artistName);
    if (!q || !aFull) return false;
    const matches = (x, y) => x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');
    if (matches(aFull, q)) return true;
    // 2e passe, articles retirés des deux côtés ("the beatles"/"beatles" → "beatles"/"beatles")
    const aStripped = stripLeadingArticle(aFull);
    const qStripped = stripLeadingArticle(q);
    if (matches(aStripped, qStripped)) return true;
    // 3e passe, TOLÉRANCE AUX FAUTES DE FRAPPE (ex. "dat punk" doit quand même
    // matcher "Daft Punk") : les 2 passes précédentes sont des comparaisons
    // EXACTES (à l'article près), donc une simple lettre manquante/inversée les
    // fait échouer. On autorise ici un petit nombre d'éditions (Levenshtein),
    // proportionnel à la longueur du plus court des 2 textes — borné pour rester
    // strict sur les mots courts (là où une "petite" faute change complètement
    // le sens) et plus tolérant sur les noms longs. Ex. "dat punk" (8) vs
    // "daft punk" (9) → 1 édition autorisée, distance réelle = 1 → match.
    const shortestLen = Math.min(qStripped.length, aStripped.length);
    const maxAllowedEdits = Math.min(3, Math.max(1, Math.floor(shortestLen / 4)));
    return levenshteinDistance(qStripped, aStripped) <= maxAllowedEdits;
  };

  /**
   * Recherche manuelle utilisée dans la modale "Rechercher un titre".
   *
   * REFONTE — comportement précédent posait 2 problèmes signalés par l'utilisa-
   * teur (capture d'écran à l'appui, recherche "daft punk") :
   *  1. Taper un nom d'ARTISTE remontait des titres d'AUTRES artistes en premier
   *     (ex. "Starboy" de The Weeknd, où Daft Punk n'est que co-producteur) —
   *     parce que la recherche texte générale de Deezer (/search) matche aussi
   *     les crédits/featurings, pas seulement l'artiste principal du titre.
   *  2. Seuls 8 résultats étaient jamais accessibles, sans aucun moyen d'en voir
   *     plus, même quand Deezer en avait beaucoup plus à proposer.
   *
   * ⚠️ HISTORIQUE DE CETTE FONCTION (3 versions avant la bonne, gardé pour ne
   * pas retomber dans les mêmes pièges) :
   *  - v1 : basculait ENTIÈREMENT vers une requête scopée `artist:"Nom"` dès
   *    qu'un artiste était identifié — cassait la recherche (titres sans BPM connu).
   *  - v2 : ajoutait cette même requête scopée EN PLUS de la recherche générale
   *    (au lieu de la remplacer) — semblait plus sûr, mais les LOGS DE PRODUCTION
   *    (voir ci-dessous) ont montré que cette requête ne renvoie tout simplement
   *    PAS les bons titres : pour "daft punk", elle remontait "Pan Da Punk",
   *    "Punk Mbedzi", "Digital Punk"... Deezer semble tokeniser "Daft"/"Punk"
   *    séparément plutôt que de chercher la phrase exacte via `artist:"..."`
   *    sans autre filtre. Confirmé AUCUN vrai titre de l'artiste apporté par
   *    cette requête sur 2 pages testées : elle ne faisait qu'ajouter du coût
   *    réseau pour du bruit filtré après coup. Purement et simplement retirée.
   *  - v3 (celle-ci) : repose ENTIÈREMENT sur la recherche texte générale
   *    (`/search?q=...`), seule source dont on ait la preuve qu'elle renvoie les
   *    bons titres. Le problème résiduel signalé (Starboy/The Weeknd visibles
   *    dès la 1ère page, juste triés en dernier) est réglé autrement : les
   *    titres qui ne correspondent PAS à l'artiste identifié ne sont plus
   *    seulement triés en fin de liste, ils sont CACHÉS (stockés à part dans
   *    `worldSearchOtherResults`) tant qu'il reste de vrais titres de l'artiste
   *    à montrer OU des pages Deezer non explorées. Une fois la recherche texte
   *    générale épuisée (`searchHasMoreResults` devient false) et s'il reste des
   *    titres en réserve, ils sont révélés en bas de liste avec un séparateur
   *    clair (voir le rendu de la modale) — jamais perdus, juste relégués tout
   *    en bas, après avoir vraiment tout vu de l'artiste demandé.
   *
   * Stratégie :
   *  - Recherche d'ARTISTE (`/search/artist`, détection seulement) et recherche
   *    de TITRE (`/search`, seule source de résultats réels) lancées en
   *    parallèle à la recherche initiale.
   *  - Si le texte tapé correspond avec confiance à l'artiste trouvé (voir
   *    `isConfidentArtistMatch`), chaque page de résultats est scindée en 2 :
   *    ceux dont `artist` correspond exactement à ce nom (affichés normalement,
   *    dans `worldSearchResults`) et les autres (mis de côté dans
   *    `worldSearchOtherResults`, révélés seulement une fois épuisé).
   *  - Pagination via le paramètre `index` de l'API Deezer sur cette recherche
   *    texte générale : `reset = true` repart de l'index 0 et vide tout ;
   *    `reset = false` (bouton "Voir plus") ajoute la page suivante des 2 côtés.
   */
  const searchWorldMusicApi = async (reset = true) => {
    if (!searchQuery.trim()) return;
    const generalOffset = reset ? 0 : searchResultsOffset;
    if (reset) {
      setIsWorldSearching(true);
      setSearchLoadingMessage(SEARCH_LOADING_MESSAGES[Math.floor(Math.random() * SEARCH_LOADING_MESSAGES.length)]);
      setWorldSearchResults([]);
      setWorldSearchOtherResults([]);
      setResultsContextLabel(null);
      setNoUsableResultsHint(false);
      setSearchHasMoreResults(false);
    } else {
      setIsLoadingMoreResults(true);
    }

    try {
      let generalStubs = [];
      let generalTotal = 0;
      // Nom d'artiste utilisé pour scinder chaque page en "correspond"/"reste
      // de côté" — déterminé à la recherche initiale, réutilisé tel quel pour
      // "Voir plus" (mémorisé dans searchActiveArtistName entre 2 appels).
      let priorityArtistName = reset ? null : searchActiveArtistName;

      if (reset) {
        const [artistRes, textRes] = await Promise.all([
          deezerFetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(searchQuery)}&limit=1`),
          deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=${SEARCH_PAGE_SIZE}&index=0`)
        ]);
        const artist = (artistRes.data && Array.isArray(artistRes.data.data)) ? artistRes.data.data[0] : null;
        generalStubs = (textRes.data && Array.isArray(textRes.data.data)) ? textRes.data.data : [];
        generalTotal = (textRes.data && typeof textRes.data.total === 'number') ? textRes.data.total : generalStubs.length;

        if (artist && isConfidentArtistMatch(searchQuery, artist.name)) {
          priorityArtistName = artist.name;
          setSearchActiveArtistName(artist.name);
        } else {
          setSearchActiveArtistName(null);
        }
      } else {
        const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=${SEARCH_PAGE_SIZE}&index=${generalOffset}`);
        generalStubs = (data && Array.isArray(data.data)) ? data.data : [];
        generalTotal = (data && typeof data.total === 'number') ? data.total : (generalOffset + generalStubs.length);
      }

      if (generalStubs.length === 0 && reset) {
        setNoUsableResultsHint(true);
        setIsWorldSearching(false);
        return;
      }

      // Un appel par titre pour récupérer son BPM (absent des listes de résultats)
      const detailedTracks = await Promise.all(generalStubs.map(async (stub) => {
        const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
        return full;
      }));

      // 3 niveaux de résolution BPM, du plus fiable au plus incertain :
      //   1. Deezer (déjà dans `full.bpm` si renseigné) — la source la plus fiable.
      //   2. GetSongBPM — vraie base de données communautaire (titre + artiste),
      //      DÉJÀ utilisée ailleurs dans l'app (`resolveRealBPM`, pour la synchro
      //      Spotify) — c'est cette même source qui donne 128 BPM pour "Rim Tim
      //      Tagi Dim" (vérifié), pas une estimation.
      //   3. Détection audio en direct (voir plus haut, `resolveBpmForCandidates`)
      //      — dernier recours SEULEMENT si les 2 sources fiables au-dessus n'ont
      //      rien donné, gardée pour ne jamais laisser un titre invisible si
      //      aucune base ne le connaît, mais son ambiguïté d'octave documentée
      //      reste entière (voir `_bpmSource` exposé à l'affichage plus bas).
      //
      // ⚠️ Un 4e niveau (FreqBlog, freqblog.com) a été essayé puis retiré : son
      // quota gratuit s'est avéré inutilisable en pratique — statut 429 (limite
      // atteinte) dès la toute première requête réelle, bien avant les 1000/mois
      // annoncés. Aucun gain constaté sur les cas testés de toute façon (butait
      // sur la même nouveauté de catalogue que GetSongBPM). Fichier
      // `api/freqblog.js` laissé de côté dans le projet mais plus appelé ici —
      // peut être supprimé du dépôt si vous voulez faire le ménage.
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
      // Fenêtre resserrée pour CE dernier recours uniquement — réduit la fréquence
      // des erreurs d'octave en empêchant l'algorithme de même considérer des
      // tempos hors plage comme candidats, plutôt que de deviner après coup lequel
      // est le bon.
      //
      // ⚠️ 1er essai (70-200) insuffisant : confirmé sur un vrai cas ("End The
      // Party" détecté à 75 BPM alors que la description officielle du titre —
      // "high-energy", "crushing riffs", "moshing/headbanging" — est incompatible
      // avec un tempo aussi lent ; 150 ÷ 2 = 75 reste dans une fenêtre 70-200).
      // Rétrécir la fenêtre n'aide QUE si le vrai tempo est sous le double du
      // minimum choisi — inutile pour un titre réellement rapide.
      //
      // Val réelle, tirée de la documentation officielle de `web-audio-beat-
      // detector` (la librairie utilisée ici) plutôt que d'une nouvelle
      // supposition : "by default the bpm are expected to be between 90 and 180
      // bpm" — c'est la plage sur laquelle l'algorithme est réellement calibré.
      // Remonter le minimum à 90 en mode standard exclut mécaniquement 75 comme
      // candidat pour un titre réellement à ~150, sans deviner après coup.
      //
      // Le Mode Intime reste hors de cette plage calibrée par construction (il a
      // besoin de BPM sous 90, voir appConfig.js) — la détection y est donc
      // structurellement moins fiable, sans solution locale : la librairie n'expose
      // aucun score de confiance ni plusieurs candidats, impossible de compenser
      // par du code. Compromis assumé, pas résolu.
      const detectionMinBpm = isNaughtyMode ? 40 : 90;
      const detectionMaxBpm = isNaughtyMode ? 130 : 180;
      const detectedCandidates = await resolveBpmForCandidates(stillMissing, detectionMinBpm, detectionMaxBpm);

      // Reconstitue l'ordre D'ORIGINE de Deezer (= son classement par pertinence/
      // popularité, voir Étape 0) plutôt que de garder les 3 groupes concaténés
      // dans l'ordre où ils ont été résolus. Sans ça, un titre pourtant très
      // populaire (ex. "Bohemian Rhapsody" de Queen, classé en tête par Deezer)
      // pouvait se retrouver en fin de liste simplement parce que SON bpm à lui
      // n'était pas renseigné chez Deezer et a dû être résolu par GetSongBPM/
      // détection — alors qu'un titre bien moins populaire mais dont Deezer AVAIT
      // le BPM passait devant. Le niveau de résolution (Deezer/GetSongBPM/
      // détection) ne doit influencer QUE la fiabilité affichée (`_bpmSource`),
      // jamais la position dans la liste.
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
              _bpmSource: t._bpmSource // 'deezer' (renseigné) ou 'detected' (analysé en direct sur l'extrait)
            };
          })
      );

      const norm = priorityArtistName ? normalizeForArtistMatch(priorityArtistName) : null;
      const isPriorityMatch = (t) => norm && normalizeForArtistMatch(t.artist) === norm;
      const dedupeAppend = (prev, incoming) => {
        const combined = reset ? incoming : [...prev, ...incoming];
        const seen = new Set();
        return combined.filter(t => { if (seen.has(t.youtubeId)) return false; seen.add(t.youtubeId); return true; });
      };

      if (priorityArtistName) {
        const matched = formattedResults.filter(isPriorityMatch);
        const other = formattedResults.filter(t => !isPriorityMatch(t));

        if (reset && matched.length === 0 && other.length > 0) {
          // FAUX POSITIF DE DÉTECTION D'ARTISTE (confirmé sur un vrai cas : Deezer
          // a une fiche "artiste" appelée littéralement "Bohemian Rhapsody" — sans
          // doute une compilation/hommage/karaoké, pas le vrai groupe recherché —
          // qui matchait le texte tapé à l'identique). Si le filtrage par cet
          // "artiste" éliminerait la TOTALITÉ des titres trouvés, c'est le signe
          // que la détection était fausse : on annule le mode priorité pour cette
          // recherche plutôt que de cacher des résultats bien réels derrière un
          // artiste fantôme. Uniquement sur la 1ère page (reset) — sur "Voir
          // plus", une page sans résultat de l'artiste est normale, pas un signal
          // d'erreur (l'artiste a déjà été confirmé légitime par une page précédente).
          priorityArtistName = null;
          setSearchActiveArtistName(null);
          setWorldSearchResults(prev => dedupeAppend(prev, formattedResults));
        } else {
          setWorldSearchResults(prev => dedupeAppend(prev, matched));
          setWorldSearchOtherResults(prev => dedupeAppend(prev, other));
        }
      } else {
        setWorldSearchResults(prev => dedupeAppend(prev, formattedResults));
      }

      if (reset) setResultsContextLabel(priorityArtistName ? `Titres de ${priorityArtistName}` : null);
      setSearchResultsOffset(generalOffset + generalStubs.length);
      setSearchHasMoreResults(generalStubs.length > 0 && (generalOffset + generalStubs.length) < generalTotal);
      if (reset && formattedResults.length === 0) setNoUsableResultsHint(true); // titres trouvés mais aucun n'a de BPM connu
    } catch(e) {
      // Erreur réseau réelle (proxy CORS injoignable, hors-ligne...) — loggée en
      // console (pas de tag DEBUG, permanent) pour ne pas retomber sur "Aucun
      // résultat." sans aucune trace exploitable si ça se reproduit un jour.
      console.error('[TempoFit] Erreur dans searchWorldMusicApi :', e);
      showToast("Erreur réseau lors de la recherche.", 'error');
    }
    setIsWorldSearching(false);
    setIsLoadingMoreResults(false);
  };

  // Ferme la modale de recherche et réinitialise tout son état — centralisé ici
  // (au lieu d'être dupliqué sur le clic du fond et sur le bouton X) pour que
  // l'ajout de nouvel état (searchResultsOffset, searchHasMoreResults,
  // searchActiveArtistName, worldSearchOtherResults) n'oublie aucun des 2 endroits.
  // (voir sa définition juste après renderSearchResultRow ci-dessous)

  // Corrige le BPM d'un titre à la main (voir editingBpmId) — met à jour les 2
  // listes possibles (résultats visibles ET réserve cachée, un titre pouvant
  // être dans l'une ou l'autre) puisqu'on ne sait pas laquelle le contient sans
  // le revérifier. `_bpmSource: 'manual'` retire le "~" (l'utilisateur devient
  // lui-même la source la plus fiable qui soit sur SON propre correctif).
  const commitBpmEdit = (track, rawValue) => {
    setEditingBpmId(null);
    const parsed = parseInt(rawValue, 10);
    if (!parsed || parsed <= 0 || parsed === track.bpm) return; // valeur invalide ou inchangée : rien à faire
    const updateList = (list) => list.map(t => t.youtubeId === track.youtubeId ? { ...t, bpm: parsed, _bpmSource: 'manual' } : t);
    setWorldSearchResults(prev => updateList(prev));
    setWorldSearchOtherResults(prev => updateList(prev));
    showToast(`BPM corrigé : ${parsed}`);
  };

  // Une seule ligne de résultat de recherche (bouton extrait + ajout/favori) —
  // extraite en fonction réutilisable pour être partagée entre la liste
  // principale (worldSearchResults) et la réserve "autres résultats" révélée en
  // bas une fois la recherche épuisée (voir worldSearchOtherResults).
  const renderSearchResultRow = (track, key) => {
    const isEditingThisBpm = editingBpmId === track.youtubeId;
    const isAlreadyFavorited = !currentPlaylist && favorites.tracks.some(t => t.youtubeId === track.youtubeId);
    const addOrToggleFavorite = () => {
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
    };
    return (
    <div key={key} className={"flex items-center gap-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:" + cardBorder}>
      {/* Bouton lecture/pause de l'extrait audio 30s (Deezer). Désactivé si aucun extrait disponible. */}
      <button
        onClick={() => togglePreview(track)}
        disabled={!track.preview}
        title={track.preview ? "Écouter un extrait" : "Extrait non disponible pour ce titre (source sans aperçu audio)"}
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${track.preview ? `${bgAccentClass} text-white hover:brightness-110` : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
      >
        {playingPreviewId === track.youtubeId ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
      </button>

      <button onClick={addOrToggleFavorite} className="flex-1 min-w-0 text-left">
        <div className="truncate">
          <div className={"font-bold text-sm truncate " + textHighlight}>{track.title}</div>
          <div className={"text-xs truncate " + textMuted}>{track.artist}{track.genre ? ` · ${normalizeGenreForDisplay(track.genre)}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Ce titre a été retenu malgré un genre différent de celui demandé.">⚠️ Genre non confirmé</span>}{track._bpmSource === 'detected' && <span className="ml-1 text-amber-500 font-bold" title="BPM deviné par l'app, pas garanti.">⚠️ BPM estimé</span>}</div>
        </div>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        {isEditingThisBpm ? (
          <input
            type="number"
            autoFocus
            defaultValue={track.bpm}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commitBpmEdit(track, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditingBpmId(null);
            }}
            className={`w-16 text-right font-mono text-sm font-bold bg-transparent border-b outline-none ${textColorClass} ${inputBorder}`}
          />
        ) : (track._bpmSource === 'detected' || track._bpmSource === 'manual') ? (
          // L'édition n'est proposée QUE là où il y a un doute réel à corriger :
          // `detected` (deviné par analyse audio, ambiguïté d'octave documentée
          // plus haut) et `manual` (pour pouvoir se corriger à nouveau soi-même).
          //
          // ⚠️ Décision prise après retour utilisateur : au départ, TOUS les BPM
          // étaient éditables, y compris ceux fournis directement par Deezer —
          // ce qui n'a pas de sens ("corriger" une valeur qu'on n'a aucune
          // raison de mettre en doute), et affaiblissait le signal du crayon
          // pour les cas où il compte vraiment. Un titre `deezer`/`getsongbpm`
          // s'affiche donc maintenant en texte simple, sans bouton ni crayon —
          // le risque, sinon, est qu'un utilisateur tape un chiffre erroné sur
          // un titre déjà fiable, et fausse silencieusement le matching BPM
          // plus tard (le générateur choisirait ce titre pour un tempo qu'il
          // n'a en réalité pas, puisque seule la métadonnée aurait changé, pas
          // l'audio réel).
          //
          // Titre choisi avec soin : "~" seul (déjà présent) signale l'incertitude
          // sans expliquer quoi faire. Le texte au survol dit explicitement
          // qu'un clic permet de corriger — la seule vraie parade à une
          // détection audio par nature ambiguë (voir le long historique de
          // cette fonction plus haut) est de laisser l'utilisateur trancher
          // lui-même quand il connaît la vraie valeur.
          //
          // Icône crayon TOUJOURS visible (pas seulement au survol) : le `title`
          // (infobulle native) et un simple `hover:underline` sont tous les deux
          // invisibles sur écran tactile (pas de survol au doigt) — sans indice
          // visuel permanent, ce bouton ne se distinguait pas de texte normal
          // sur mobile. Le `title` reste en plus, pour la souris/clavier.
          <button
            onClick={() => setEditingBpmId(track.youtubeId)}
            title={
              track._bpmSource === 'detected'
                ? "BPM deviné, pas garanti — touche pour corriger."
                : "BPM corrigé à la main. Touche pour modifier."
            }
            className={"flex items-center gap-1 font-mono text-sm font-bold " + textColorClass}
          >
            <span>{track._bpmSource === 'detected' ? '~' : ''}{track.bpm} BPM</span>
            <Edit3 size={12} className="opacity-50"/>
          </button>
        ) : (
          // Source fiable (Deezer ou GetSongBPM) : pas d'affordance d'édition —
          // voir le commentaire ci-dessus pour le raisonnement complet.
          <span className={"font-mono text-sm font-bold " + textColorClass}>{track.bpm} BPM</span>
        )}
        <button onClick={addOrToggleFavorite} title={isAlreadyFavorited ? "Retirer des favoris" : "Ajouter"}>
          {isAlreadyFavorited ? (
            <Check size={16} className="text-green-500" />
          ) : (
            <Plus size={16} className={textMuted}/>
          )}
        </button>
      </div>
    </div>
    );
  };

  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    setSearchQuery("");
    setIsBpmSearchMode(false);
    setWorldSearchResults([]);
    setWorldSearchOtherResults([]);
    setResultsContextLabel(null);
    setNoUsableResultsHint(false);
    setSearchResultsOffset(0);
    setSearchHasMoreResults(false);
    setSearchActiveArtistName(null);
    setEditingBpmId(null); // évite qu'un champ d'édition BPM reste "ouvert" en mémoire après fermeture
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
  
  // NOTE : un bloc "recherche locale simple (titre/artiste)" existait ici
  // (allTracksDb + searchResults), construit sur l'ancienne base de titres
  // codés en dur. Code mort trouvé au passage : son résultat (`searchResults`)
  // n'était en fait lu nulle part ailleurs dans l'interface — retiré, d'autant
  // qu'il n'a plus de fondation avec le passage à ARTIST_CATALOG (qui ne liste
  // que des noms d'artistes, pas de titres à chercher).

  const fileInputRef = useRef(null);
  const {
    dataOffset, setDataOffset,
    csvUploadTargetDate, setCsvUploadTargetDate,
    selectedAnalysisDate, setSelectedAnalysisDate,
    selectedMetric, setSelectedMetric,
    currentActualData, availableMetrics,
  } = useSessionAnalysis(currentPlaylist);

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

  // Le <title> de la page est écrit en dur dans index.html (hors de portée de React),
  // donc il ne suivait jamais le mode Intime. On le met à jour manuellement ici pour
  // que la personnalisation soit vraiment complète, jusque dans l'onglet du navigateur.
  useEffect(() => {
    document.title = isNaughtyMode ? 'TempoIntime' : 'TempoFit';
  }, [isNaughtyMode]);

  // Les titres de démonstration (playlist d'exemple + favoris pré-remplis, voir
  // leurs déclarations plus haut) sont fixés à la main avec `preview: null` —
  // le bouton d'écoute y restait donc grisé au premier lancement, ce qui ne
  // donnait pas envie de les essayer alors que ce sont les premiers titres que
  // l'utilisateur voit dans l'app.
  //
  // ⚠️ Piège découvert en corrigeant ça : l'URL d'extrait Deezer n'est PAS
  // permanente — elle est signée avec une expiration courte (paramètre
  // `hdnea=exp=...` dans l'URL, de l'ordre de quelques heures). Impossible donc
  // de la coder en dur une bonne fois pour toutes : le lien finirait par ne
  // plus jouer, silencieusement, sans qu'aucune erreur ne le signale. On résout
  // donc l'extrait EN DIRECT au montage de l'app plutôt qu'une valeur figée —
  // mais toujours par une recherche `track:"X" artist:"Y"` exacte (pas par BPM
  // ni au hasard), donc c'est TOUJOURS le même morceau qui est retrouvé à
  // chaque chargement, comme souhaité (comportement déterministe côté contenu,
  // même si l'URL elle-même change d'une session à l'autre).
  //
  // Ne touche jamais une vraie playlist générée ni une playlist d'exemple déjà
  // modifiée par l'utilisateur (vérifie l'id ET la présence des ids `ex-track-*`
  // avant d'écrire quoi que ce soit) — et ne s'exécute qu'une fois au montage.
  useEffect(() => {
    let cancelled = false;

    const resolveDemoPreview = async (title, artist) => {
      try {
        const q = `track:"${title}" artist:"${artist}"`;
        const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`);
        const hit = data && Array.isArray(data.data) ? data.data[0] : null;
        return hit ? (hit.preview || null) : null;
      } catch (e) {
        return null;
      }
    };

    const fillDemoPreviews = async () => {
      const example = savedPlaylists.find(p => p.id === 'playlist-example-1');
      if (example && example.tracks.some(t => t.id && t.id.startsWith('ex-track-') && !t.preview)) {
        const resolved = await Promise.all(example.tracks.map(async (t) => {
          if (!t.id || !t.id.startsWith('ex-track-') || t.preview) return t;
          const preview = await resolveDemoPreview(t.title, t.artist);
          return preview ? { ...t, preview } : t;
        }));
        if (!cancelled) {
          setSavedPlaylists(prev => prev.map(p => p.id === 'playlist-example-1' ? { ...p, tracks: resolved } : p));
        }
      }

      const demoTrackIds = ['uRyAIyq53FY', 'CSvFpBOe8eY'];
      if (favorites.tracks.some(t => demoTrackIds.includes(t.youtubeId) && !t.preview)) {
        const resolvedFavs = await Promise.all(favorites.tracks.map(async (t) => {
          if (!demoTrackIds.includes(t.youtubeId) || t.preview) return t;
          const preview = await resolveDemoPreview(t.title, t.artist);
          return preview ? { ...t, preview } : t;
        }));
        if (!cancelled) {
          setFavorites(prev => ({ ...prev, tracks: resolvedFavs }));
        }
      }
    };

    fillDemoPreviews();
    return () => { cancelled = true; };
  }, []); // une seule fois au montage, voir le commentaire ci-dessus

  const changeView = (newView) => { 
    setView(newView); 
    setIsMobileMenuOpen(false); 
    if (newView === 'generator') setWizardStep(1); // Repart toujours à l'étape 1 du wizard
  };

  const getActiveWorkoutName = () => (workoutType === 'Autre' && customActivity.trim() !== '') ? customActivity : workoutType;

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
      setBpm(85); setBpmTolerance(15); setSelectedGenres(['R&B Sensuel']); setGenreWeights({ 'R&B Sensuel': 100 }); setLockedGenreWeights(new Set()); setTargetMode('time');
      setCrossfade(5); 
      showToast("Ambiance intime activée...", 'special');
    } else {
      setIsNaughtyMode(false);
      setBpm(160); setBpmTolerance(10); setSelectedGenres(['Métal']); setGenreWeights({ 'Métal': 100 }); setLockedGenreWeights(new Set()); setCrossfade(2);
      showToast("Retour au mode Standard !");
    }
  };

  // Ajoute/retire un genre de la sélection, en empêchant de désélectionner le dernier
  // genre restant (il en faut toujours au moins un pour générer une playlist).
  // La répartition des % repart à zéro (équirépartition, tout déverrouillé) dès que
  // l'ENSEMBLE des genres change — plus simple et plus prévisible que d'essayer de
  // faire persister des poids/verrouillages à travers un ajout/retrait de genre.
  const toggleGenre = (genre) => {
    let newGenres;
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length <= 1) return;
      newGenres = selectedGenres.filter(g => g !== genre);
    } else {
      newGenres = [...selectedGenres, genre];
    }
    setSelectedGenres(newGenres);
    setGenreWeights(equalSplitWeights(newGenres));
    setLockedGenreWeights(new Set());
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
      targetMode, distanceVal, distanceUnit, paceMin, paceSec, hours, minutes, selectedGenres, bpmTolerance, crossfade, allowLongTracks, genreWeights,
      segments: isIntervalMode ? [...segments] : [], coverIcon: newRoutineIcon, autoGenFreq: newRoutineFreq,
      manualGenerations: 0, recentTrackIds: [], createdAt: new Date().toLocaleDateString()
    };
    addRoutine(newRoutine);
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
    updateRoutine(editingRoutine);
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
      const deviations = checkGenreWeightDeviation(pl.tracks, config.genreWeights);
      if (deviations) {
        showToast(`⚠️ Répartition entre genres différente de ce qui était visé : ${deviations.join(', ')}.`, 'error');
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
      const allTracksInBatch = generatedPlaylists.flatMap(p => p.tracks);
      const batchDeviations = checkGenreWeightDeviation(allTracksInBatch, config.genreWeights);
      if (batchDeviations) {
        showToast(`⚠️ Répartition entre genres différente de ce qui était visé sur cette série : ${batchDeviations.join(', ')}.`, 'error');
      }
    }
  };

  /**
   * Compare la répartition RÉELLEMENT obtenue (durée par genre dans la playlist)
   * à la répartition en % DEMANDÉE (config.genreWeights) — approximatif par
   * nature (voir le message dans l'UI de répartition), donc on ne signale que
   * les écarts vraiment significatifs (≥ 15 points de %), pas la moindre
   * fluctuation. Retourne la liste des genres trop éloignés de leur cible, ou
   * `null` si rien à signaler (pas de poids configurés, ou tout est proche).
   */
  const checkGenreWeightDeviation = (tracks, weights) => {
    if (!weights || Object.keys(weights).length <= 1) return null;
    const totalDuration = tracks.reduce((s, t) => s + t.duration, 0);
    if (totalDuration === 0) return null;
    const actualByGenre = {};
    tracks.forEach(t => {
      const g = normalizeGenreForDisplay(t.genre);
      actualByGenre[g] = (actualByGenre[g] || 0) + t.duration;
    });
    const deviations = [];
    Object.entries(weights).forEach(([genre, targetPct]) => {
      if (!targetPct) return;
      const actualPct = Math.round(((actualByGenre[genre] || 0) / totalDuration) * 100);
      if (Math.abs(actualPct - targetPct) >= 15) {
        deviations.push(`${genre} : ${actualPct}% obtenu (visé ${targetPct}%)`);
      }
    });
    return deviations.length > 0 ? deviations : null;
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

  // Ajoute/retire un titre (et son artiste) des favoris DEPUIS une playlist déjà
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
    const newRawTrack = await getSingleMatchingTrack(oldTrack.targetSegmentBpm, currentPlaylist.tolerance || 10, currentPlaylist.config?.selectedGenres || ['Métal'], usedIds, favorites, spotifyTrackPool, null, [], currentPlaylist.config?.allowLongTracks || false);

    const newTracks = [...currentPlaylist.tracks];
    newTracks[indexToReplace] = {
      ...newTracks[indexToReplace], title: newRawTrack.title, artist: newRawTrack.artist,
      genre: newRawTrack.genre, bpm: newRawTrack.bpm, duration: newRawTrack.duration,
      youtubeId: newRawTrack.youtubeId, id: `track-replaced-${Date.now()}`,
      preview: newRawTrack.preview || null,
      // Même bug corrigé qu'à la génération initiale : ces marqueurs n'étaient
      // jamais copiés ici, donc le badge ne pouvait pas s'afficher après un
      // remplacement même si la vérification de genre avait échoué.
      _genreMismatch: newRawTrack._genreMismatch || false,
      _isFallback: newRawTrack._isFallback || false,
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
      const requestedGenres = currentPlaylist.config?.selectedGenres || ['Métal'];
      const q = `artist:"${oldTrack.artist}" bpm_min:"${Math.max(1, minBpm)}" bpm_max:"${maxBpm}"`;
      const { data } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`);
      const stubs = (data && Array.isArray(data.data) ? data.data : []).filter(s => !usedIds.includes(`deezer-${s.id}`));
      if (stubs.length > 0) {
        const details = await Promise.all(stubs.map(async (s) => {
          const { data: full } = await deezerFetch(`https://api.deezer.com/track/${s.id}`);
          return full;
        }));
        const allowLong = currentPlaylist.config?.allowLongTracks || false;
        let valid = details.filter(f => f && f.bpm && parseFloat(f.bpm) >= minBpm && parseFloat(f.bpm) <= maxBpm);
        // Filtre de durée et de conflit de titre : oubliés ici jusqu'ici, alors
        // qu'ils s'appliquaient déjà partout ailleurs dans le moteur — ce bouton
        // précis pouvait donc encore ramener un titre de 12 minutes ou un
        // "Hardstyle Remix" malgré les réglages actifs.
        if (!allowLong) valid = valid.filter(f => (f.duration || 0) <= MAX_TRACK_DURATION);
        valid = valid.filter(f => !detectTitleStyleConflict(f.title, requestedGenres));
        valid = valid.sort(() => Math.random() - 0.5);
        // Même garde-fou genre que le reste du moteur : même en restant sur le
        // MÊME artiste, un artiste peut avoir des titres de genres différents
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
        if (pick) {
          newRawTrack = {
            title: pick.title, artist: pick.artist ? pick.artist.name : oldTrack.artist,
            genre: pick._resolvedGenre || 'Genre inconnu', bpm: Math.round(parseFloat(pick.bpm)), duration: pick.duration || 180,
            youtubeId: `deezer-${pick.id}`, preview: pick.preview || null,
            ...(genreMismatch ? { _genreMismatch: true, _isFallback: true } : {})
          };
        }
      }
    } catch (e) {
      // Échec silencieux : on retombe sur la recherche large ci-dessous.
    }

    // Repli sur la recherche large habituelle si aucun autre titre de cet artiste n'a été trouvé.
    if (!newRawTrack) {
      newRawTrack = await getSingleMatchingTrack(oldTrack.targetSegmentBpm, currentPlaylist.tolerance || 10, currentPlaylist.config?.selectedGenres || ['Métal'], usedIds, favorites, spotifyTrackPool, null, [], currentPlaylist.config?.allowLongTracks || false);
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
      preview: newRawTrack.preview || null,
      // Même bug corrigé qu'à la génération initiale : ces marqueurs n'étaient
      // jamais copiés ici, donc le badge ne pouvait pas s'afficher après un
      // remplacement même si la vérification de genre avait échoué.
      _genreMismatch: newRawTrack._genreMismatch || false,
      _isFallback: newRawTrack._isFallback || false,
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
    closeSearchModal(); // ferme ET réinitialise tout l'état de recherche (voir sa définition) —
    // avant, seuls isSearchModalOpen et searchQuery étaient remis à zéro ici,
    // laissant worldSearchResults et le reste trainer en mémoire jusqu'à la
    // prochaine recherche, avec un risque de flash de résultats obsolètes à la
    // réouverture de la modale.
    showToast("🎵 Titre ajouté avec succès !");
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
    // Rétrocompatible avec le format "date seule" (YYYY-MM-DD, celui de "Ajouter
    // une date" ci-dessous, où l'heure n'a pas de sens pour une saisie manuelle
    // rétroactive) ET le nouvel horodatage complet utilisé par "Marquer comme
    // faite" — nécessaire depuis qu'une playlist peut être complétée plusieurs
    // fois le même jour (retour utilisateur : matin + soir, un cas réel et
    // légitime, pas une erreur à empêcher). L'heure ne s'affiche que pour ce 2e
    // format, seul cas où elle est réellement connue et utile pour distinguer
    // 2 séances du même jour.
    const hasTime = isoStr.length > 10;
    const d = hasTime ? new Date(isoStr) : new Date(isoStr + 'T00:00:00');
    if (isNaN(d.getTime())) return isoStr;
    return hasTime
      ? `${d.toLocaleDateString()} à ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : d.toLocaleDateString();
  };

  const markPlaylistAsCompleted = (e, playlistId) => {
    e.stopPropagation();
    const pl = savedPlaylists.find(p => p.id === playlistId);
    if (!pl) return;

    // CORRIGÉ après retour utilisateur : bloquer purement et simplement une 2e
    // complétion le même JOUR calendaire n'a pas de sens — une vraie double
    // séance le même jour (matin + soir) est un cas réel et légitime, pas une
    // erreur. Le vrai problème que la version précédente essayait de résoudre
    // (un double-clic accidentel sur ce bouton) se règle mieux avec un
    // horodatage complet (pas juste la date) et une fenêtre anti-rebond courte :
    // si la dernière complétion enregistrée date de moins de 10 secondes, on
    // suppose un clic répété par erreur ; au-delà, on suppose une vraie 2e séance.
    const nowIso = new Date().toISOString();
    const existingCompletions = pl.completions || [];
    const lastCompletion = existingCompletions.length > 0 ? existingCompletions[existingCompletions.length - 1] : null;
    if (lastCompletion) {
      const lastDate = new Date(lastCompletion);
      if (!isNaN(lastDate.getTime()) && (Date.now() - lastDate.getTime()) < 10000) {
        showToast("Déjà marquée à l'instant !");
        return;
      }
    }
    const updatedCompletions = [...existingCompletions, nowIso].sort();

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
  //
  // normalizeGenreForDisplay : voir musicCatalog.js (importée en haut de ce
  // fichier) — utilisée ici ET partout où un genre est affiché dans l'app, pour
  // fusionner les variantes d'écriture du même genre (accents, casse, noms
  // composés type "Rap/Hip Hop") en un seul et même libellé cohérent.
  const genreDistributionData = useMemo(() => {
    if (!currentPlaylist) return [];
    const buckets = {};
    currentPlaylist.tracks.forEach(t => {
      const g = normalizeGenreForDisplay(t.genre);
      buckets[g] = (buckets[g] || 0) + t.duration;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [currentPlaylist]);

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
                title={hasData ? "Données déjà importées — cliquer pour remplacer" : "Importer Garmin/Strava (cadence/FC)"}
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
  // Extrait dans src/hooks/useTheme.js (voir passation) — déstructuré ici avec
  // les mêmes noms qu'avant pour ne rien casser dans le reste du fichier, qui
  // n'est pas encore entièrement découpé en composants de vue.
  const themeTokens = useTheme(isNaughtyMode);
  const {
    themeColor, bgMainApp, textMain, textColorClass, bgAccentClass, borderAccentClass,
    cardBg, cardBorder, inputBg, inputBorder, textMuted, textHighlight,
  } = themeTokens;

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
                ? `Génération ${generatingDone}/${generatingTotal}...`
                : "Génération en cours..."}
            </span>
            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${textMuted} bg-black/5 dark:bg-white/10`}>
              {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
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
          
          {/* `select-none` sur chaque bouton ci-dessous (retour utilisateur) : sans ça,
              le texte des libellés (ex. "Historique") reste sélectionnable comme du
              texte normal, donc le curseur affiche un I-beam (texte éditable) au survol
              du label — trompeur pour un bouton, même si le clic fonctionnait déjà
              correctement partout. `cursor-pointer` ajouté en plus par sécurité (déjà
              le comportement par défaut d'un <button>, mais explicite plutôt qu'implicite). */}
          <nav className="flex-1 px-4 py-6 space-y-3 overflow-y-auto no-scrollbar">
            
            <button onClick={() => changeView('generator')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Zap size={18} className={view === 'generator' ? 'text-white' : textColorClass} />
              <span className="font-bold text-sm">Générer</span>
            </button>

            <button onClick={() => changeView('routines')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'routines' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <ListPlus size={18} />
              <span className="font-bold text-sm">Mes Routines</span>
            </button>
            
            <button onClick={() => changeView('playlists')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'playlists' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <List size={18} />
              <span className="font-bold text-sm">Mes Playlists</span>
            </button>

            <button onClick={() => changeView('history')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'history' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <History size={18} />
              <span className="font-bold text-sm">Historique</span>
            </button>

            <button onClick={() => changeView('stats')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'stats' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Activity size={18} />
              <span className="font-bold text-sm">Statistiques</span>
            </button>

            <button onClick={() => changeView('favorites')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'favorites' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Star size={18} className={favorites.useFavorites && favorites.artists.length > 0 ? "text-yellow-500 fill-yellow-500/20" : ""} />
              <span className="font-bold text-sm">Mes Favoris</span>
            </button>

            <button onClick={() => changeView('settings')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'settings' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
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
              <GeneratorView
                theme={themeTokens} isNaughtyMode={isNaughtyMode} displaySubtitleGen={displaySubtitleGen}
                wizardStep={wizardStep} setWizardStep={setWizardStep}
                workoutType={workoutType} setWorkoutType={setWorkoutType} customActivity={customActivity}
                handleOpenCustomActivityModal={handleOpenCustomActivityModal} toggleNaughtyMode={toggleNaughtyMode}
                setBpm={setBpm} setTargetMode={setTargetMode} setDistanceVal={setDistanceVal} setDistanceUnit={setDistanceUnit}
                setHours={setHours} setMinutes={setMinutes}
                targetMode={targetMode} isIntervalMode={isIntervalMode} setIsIntervalMode={setIsIntervalMode}
                hours={hours} minutes={minutes} distanceVal={distanceVal} distanceUnit={distanceUnit}
                paceMin={paceMin} setPaceMin={setPaceMin} paceSec={paceSec} setPaceSec={setPaceSec}
                bpm={bpm}
                segments={segments} setSegments={setSegments}
                expandedSegmentGenreId={expandedSegmentGenreId} setExpandedSegmentGenreId={setExpandedSegmentGenreId}
                resetSegmentGenre={resetSegmentGenre} toggleSegmentGenre={toggleSegmentGenre}
                showExtraGenres={showExtraGenres} setShowExtraGenres={setShowExtraGenres}
                availableGenres={availableGenres} selectedGenres={selectedGenres} toggleGenre={toggleGenre}
                genreWeights={genreWeights} setGenreWeights={setGenreWeights} setGenreWeight={setGenreWeight}
                equalSplitWeights={equalSplitWeights} setLockedGenreWeights={setLockedGenreWeights}
                bpmTolerance={bpmTolerance} setBpmTolerance={setBpmTolerance}
                crossfade={crossfade} setCrossfade={setCrossfade}
                allowLongTracks={allowLongTracks} setAllowLongTracks={setAllowLongTracks}
                setCurrentPlaylist={setCurrentPlaylist} setIsBpmSearchMode={setIsBpmSearchMode}
                setSearchQuery={setSearchQuery} setWorldSearchResults={setWorldSearchResults}
                setResultsContextLabel={setResultsContextLabel} setNoUsableResultsHint={setNoUsableResultsHint}
                setIsSearchModalOpen={setIsSearchModalOpen} searchTracksByBpm={searchTracksByBpm}
                executeGeneration={executeGeneration} isGenerating={isGenerating}
                getActiveWorkoutName={getActiveWorkoutName} setIsSavingRoutineModalOpen={setIsSavingRoutineModalOpen}
              />
            )}

            {view === 'routines' && (
              <RoutinesView
                theme={themeTokens} routines={routines} setRoutines={setRoutines}
                routineBatchCounts={routineBatchCounts} setRoutineBatchCounts={setRoutineBatchCounts}
                getDisplayRoutineIcon={getDisplayRoutineIcon} getDisplayRoutineName={getDisplayRoutineName}
                renderConfigInfoLine={renderConfigInfoLine} getRankStyle={getRankStyle}
                setEditingRoutine={setEditingRoutine} setIsEditRoutineModalOpen={setIsEditRoutineModalOpen}
                executeGeneration={executeGeneration} isGenerating={isGenerating} changeView={changeView}
              />
            )}

            {/* ===================== VIEW: PLAYLISTS (Historique) ===================== */}
            {view === 'playlists' && (
              <PlaylistsView
                theme={themeTokens} isNaughtyMode={isNaughtyMode}
                savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
                getRankStyle={getRankStyle} setCurrentPlaylist={setCurrentPlaylist} changeView={changeView}
                renderConfigInfoLine={renderConfigInfoLine} renderCompletionsList={renderCompletionsList}
                markPlaylistAsCompleted={markPlaylistAsCompleted}
              />
            )}

            {view === 'history' && (
              <HistoryView
                theme={themeTokens} isNaughtyMode={isNaughtyMode} savedPlaylists={savedPlaylists}
                getRankStyle={getRankStyle} setCurrentPlaylist={setCurrentPlaylist} changeView={changeView}
                renderConfigInfoLine={renderConfigInfoLine} renderCompletionsList={renderCompletionsList}
              />
            )}

            {view === 'stats' && (
              <StatsView
                theme={themeTokens} savedPlaylists={savedPlaylists} userStats={userStats} changeView={changeView}
                statsMode={statsMode} setStatsMode={setStatsMode}
                selectedStatsGenre={selectedStatsGenre} setSelectedStatsGenre={setSelectedStatsGenre}
                selectedStatsBpmBucket={selectedStatsBpmBucket} setSelectedStatsBpmBucket={setSelectedStatsBpmBucket}
                showAdvancedStats={showAdvancedStats} setShowAdvancedStats={setShowAdvancedStats}
                expandedDetailGenre={expandedDetailGenre} setExpandedDetailGenre={setExpandedDetailGenre}
                expandedDetailArtist={expandedDetailArtist} setExpandedDetailArtist={setExpandedDetailArtist}
              />
            )}

            {/* ===================== VIEW: SETTINGS (OPTIONS ET COMPTES) ===================== */}
            {view === 'settings' && (
              <SettingsView theme={themeTokens} spotifyToken={spotifyToken} loginSpotify={loginSpotify} setSpotifyToken={setSpotifyToken} />
            )}

            {/* ===================== VIEW: FAVORITES ===================== */}
            {/* Note de correction : le bloc d'en-tête "Tes Préférences Musicales" avec les
                boutons de synchro était dupliqué juste avant cette vue dans le fichier
                d'origine (probablement un reste de copier-coller). Le doublon a été retiré ;
                il ne reste plus qu'une seule carte, avec le bouton "Chercher via l'API"
                fusionné à côté du bouton de synchro Spotify. */}
            {view === 'favorites' && (
              <FavoritesView
                theme={themeTokens} isNaughtyMode={isNaughtyMode}
                favorites={favorites} setFavorites={setFavorites}
                togglePreview={togglePreview} playingPreviewId={playingPreviewId}
                setCurrentPlaylist={setCurrentPlaylist} setIsBpmSearchMode={setIsBpmSearchMode}
                setIsSearchModalOpen={setIsSearchModalOpen} setWorldSearchResults={setWorldSearchResults}
                setNoUsableResultsHint={setNoUsableResultsHint}
                isAddingArtist={isAddingArtist} setIsAddingArtist={setIsAddingArtist}
                newFavArtist={newFavArtist} setNewFavArtist={setNewFavArtist}
                addFavoriteArtistValidated={addFavoriteArtistValidated}
                availableGenres={availableGenres} favSelectedGenres={favSelectedGenres}
                setFavSelectedGenres={setFavSelectedGenres} showExtraGenres={showExtraGenres}
                setShowExtraGenres={setShowExtraGenres}
                favBpmTarget={favBpmTarget} setFavBpmTarget={setFavBpmTarget}
                favBpmTolerance={favBpmTolerance} setFavBpmTolerance={setFavBpmTolerance}
                searchTracksByBpm={searchTracksByBpm} changeView={changeView}
              />
            )}

            {view === 'trophies' && (
              <TrophiesView theme={themeTokens} userStats={userStats} handleShare={handleShare} />
            )}

            {view === 'playlist' && currentPlaylist && (
              <PlaylistDetailView
                theme={themeTokens} colorMode={theme} isNaughtyMode={isNaughtyMode}
                currentPlaylist={currentPlaylist} savedPlaylists={savedPlaylists}
                isEditingPlaylistName={isEditingPlaylistName} setIsEditingPlaylistName={setIsEditingPlaylistName}
                editedPlaylistName={editedPlaylistName} setEditedPlaylistName={setEditedPlaylistName}
                handleRenamePlaylist={handleRenamePlaylist}
                handleSavePlaylist={handleSavePlaylist} handleShare={handleShare}
                currentActualData={currentActualData} selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric}
                analysisStats={analysisStats}
                selectedAnalysisDate={selectedAnalysisDate} setSelectedAnalysisDate={setSelectedAnalysisDate}
                formatCompletionDate={formatCompletionDate} availableMetrics={availableMetrics}
                dataOffset={dataOffset} setDataOffset={setDataOffset}
                chartAxisType={chartAxisType} setChartAxisType={setChartAxisType}
                chartDistanceUnit={chartDistanceUnit} setChartDistanceUnitOverride={setChartDistanceUnitOverride}
                selectedSegmentIdx={selectedSegmentIdx} trackSegments={trackSegments}
                togglePreview={togglePreview} playingPreviewId={playingPreviewId}
                unifiedChartData={unifiedChartData} handleChartClick={handleChartClick}
                chartXDomain={chartXDomain} chartXTicks={chartXTicks} chartYDomain={chartYDomain}
                distanceDisplayFactor={distanceDisplayFactor}
                draggedTrackIndex={draggedTrackIndex} handleTrackDragStart={handleTrackDragStart}
                handleTrackDragEnter={handleTrackDragEnter} handleTrackDragEnd={handleTrackDragEnd}
                favorites={favorites} toggleTrackFavorite={toggleTrackFavorite} toggleArtistFavorite={toggleArtistFavorite}
                openTrackMenuIndex={openTrackMenuIndex} setOpenTrackMenuIndex={setOpenTrackMenuIndex}
                handleDuplicateTrack={handleDuplicateTrack} handleReplaceTrackSameArtist={handleReplaceTrackSameArtist}
                handleReplaceTrack={handleReplaceTrack} handleRemoveTrack={handleRemoveTrack}
                setIsBpmSearchMode={setIsBpmSearchMode} setIsSearchModalOpen={setIsSearchModalOpen}
                bpmDistributionData={bpmDistributionData} genreDistributionData={genreDistributionData}
              />
            )}
          </main>
        </div>

        {/* ============================= MODALS ============================= */}

        {/* RECHERCHE MANUELLE DE TITRE VIA DEEZER : n'affiche que des titres dont le
            tempo est certifié par l'API. Si une playlist est actuellement affichée,
            le titre choisi y est ajouté ; sinon, il est ajouté aux favoris (utile
            pour "nourrir" l'algorithme de génération). */}
        {isSearchModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeSearchModal}>
            <div className={"p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-1">
                <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
                  {isBpmSearchMode ? <Target className={textColorClass}/> : <Search className={textColorClass}/>}
                  <span>{isBpmSearchMode ? "Titres à ce BPM" : "Rechercher un titre"}</span>
                </h3>
                <button onClick={closeSearchModal} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20}/></button>
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
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchWorldMusicApi(true)} placeholder="Titre ou artiste (ex: One More Time, Daft Punk)..." className={"bg-transparent w-full font-bold outline-none " + textHighlight} autoFocus />
                  </div>
                  <button onClick={() => searchWorldMusicApi(true)} disabled={isWorldSearching} className={"px-4 rounded-xl text-white font-bold transition-transform active:scale-95 flex items-center justify-center " + bgAccentClass}>
                    {isWorldSearching ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 min-h-[200px]">
                {isWorldSearching && worldSearchResults.length === 0 ? (
                  // Standardisé sur le même visuel "pilule" que l'indicateur de génération
                  // (voir plus haut, "Génération en cours...") — retour utilisateur : les
                  // indicateurs de chargement de l'app étaient trop différents d'un endroit
                  // à l'autre (ici, un gros bloc vertical centré vs une pilule horizontale
                  // ailleurs). Même structure exacte reprise : icône + texte + puce
                  // chronomètre au format M:SS, plutôt qu'un simple "Xs" comme avant.
                  <div className="flex justify-center py-8">
                    <div className={`${cardBg} border ${cardBorder} shadow-2xl px-6 py-3 rounded-full flex items-center space-x-3`}>
                      <Loader2 size={18} className={`animate-spin ${textColorClass}`} />
                      <span className={`font-medium text-sm ${textHighlight}`}>{searchLoadingMessage}</span>
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${textMuted} bg-black/5 dark:bg-white/10`}>
                        {Math.floor(searchElapsedSeconds / 60)}:{String(searchElapsedSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                ) : (worldSearchResults.length > 0 || (!searchHasMoreResults && worldSearchOtherResults.length > 0)) ? (
                  <>
                    {resultsContextLabel && !isBpmSearchMode && worldSearchResults.length > 0 && (
                      <div className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${textMuted}`}>{resultsContextLabel}</div>
                    )}
                    {(() => {
                      // Filtre les titres déjà en favoris — pas la peine de les
                      // remontrer à chaque nouvelle recherche identique. Uniquement
                      // hors contexte playlist : dans une playlist, un titre déjà
                      // en favoris reste pertinent à ajouter, la notion de
                      // "favori" n'a rien à voir avec ce qu'on cherche à faire ici.
                      const isAlreadyFav = (t) => !currentPlaylist && favorites.tracks.some(f => f.youtubeId === t.youtubeId);
                      const visibleMainResults = worldSearchResults.filter(t => !isAlreadyFav(t));
                      return (
                        <>
                          {worldSearchResults.length > 0 && visibleMainResults.length === 0 && (
                            <div className={`text-xs italic px-1 pb-1 ${textMuted}`}>Tous les titres trouvés ici sont déjà dans tes favoris.</div>
                          )}
                          {visibleMainResults.map((track, i) => renderSearchResultRow(track, i))}
                        </>
                      );
                    })()}
                    {searchHasMoreResults && !isBpmSearchMode && (
                      <button
                        onClick={() => searchWorldMusicApi(false)}
                        disabled={isLoadingMoreResults}
                        className={"w-full mt-1 py-2.5 rounded-xl border-2 border-dashed text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 " + inputBorder + " " + textMuted + " hover:" + textHighlight + " hover:border-gray-400"}
                      >
                        {isLoadingMoreResults ? <Loader2 className="animate-spin" size={16}/> : <ChevronDown size={16}/>}
                        <span>{isLoadingMoreResults ? "Chargement..." : "Voir plus de résultats"}</span>
                      </button>
                    )}
                    {/* Réserve "autres résultats" (titres qui matchent le texte tapé
                        mais pas l'artiste identifié, ex. Starboy pour "daft punk") —
                        révélée seulement une fois la recherche générale épuisée
                        (searchHasMoreResults = false), jamais avant : voir searchWorldMusicApi. */}
                    {!searchHasMoreResults && !isBpmSearchMode && worldSearchOtherResults.length > 0 && (
                      <>
                        <div className={`text-xs font-bold uppercase tracking-wider mt-4 mb-2 px-1 ${textMuted}`}>Autres résultats pour "{searchQuery}" (pas {searchActiveArtistName})</div>
                        {worldSearchOtherResults.filter(t => !(!currentPlaylist && favorites.tracks.some(f => f.youtubeId === t.youtubeId))).map((track, i) => renderSearchResultRow(track, `other-${i}`))}
                      </>
                    )}
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
                      <input type="number" min="0" max="59" value={editingRoutine.minutes} onChange={e => setEditingRoutine({...editingRoutine, minutes: e.target.value})} className={`bg-transparent w-full font-bold outline-none ${textHighlight} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                      <span className={`text-sm font-bold ${textMuted} mr-1`}>Min</span>
                      <div className="flex flex-col">
                        <button type="button" onClick={() => setEditingRoutine(r => ({...r, minutes: (parseInt(r.minutes) || 0) + 1 > 59 ? 0 : (parseInt(r.minutes) || 0) + 1}))} className={`${textMuted} hover:${textHighlight}`}>
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" onClick={() => setEditingRoutine(r => ({...r, minutes: (parseInt(r.minutes) || 0) - 1 < 0 ? 59 : (parseInt(r.minutes) || 0) - 1}))} className={`${textMuted} hover:${textHighlight}`}>
                          <ChevronDown size={14} />
                        </button>
                      </div>
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
