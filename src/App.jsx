import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Clock, Music, Play, List, Plus, Check, Settings, Pause, Search, X, Heart, ListPlus, Loader2, Star, AlertCircle, Zap, BookmarkPlus, Menu, RefreshCw, Share2, Image as ImageIcon, Edit3, Copy, Trophy, Upload, ChevronUp, ChevronDown, Target, MessageCircle, ExternalLink, Sun, Moon, Gauge } from 'lucide-react';
import { ARTIST_CATALOG, STANDARD_GENRES, NAUGHTY_GENRES, EXTRA_GENRES, WEAK_DEEZER_KEYWORD_GENRES, getGenreLocalDepthWarning, normalizeGenreForDisplay, genreDisplayLabel, getGenresForDisplay } from './musicCatalog';
import { NAUGHTY_ROUTINE_NAMES, AVAILABLE_ICONS, AUTO_GEN_OPTIONS } from './appConfig';

// =====================================================================================
// CONSTANTES GLOBALES & CONFIGURATION
// =====================================================================================

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

import { safeFetchJson, deezerFetch, resolveDeezerGenre, getSingleMatchingTrack, buildSegmentTracks, deduceCrescendoBpm, buildCrescendoSegments, findSameArtistReplacement, recalculateTimeline, createPlaylistData } from './musicEngine';
import { fetchSpotifyRawData, resolveTracksBpm } from './spotifyEngine';
import { parseGarminCsv } from './workoutDataEngine';
import { dedupeAppend, fetchWorldSearchResults, fetchBpmSearchResults } from './searchEngine';
import { useTheme } from './hooks/useTheme';
import { usePersistentState } from './hooks/usePersistentState';
import { useToast } from './hooks/useToast';
import { useCustomActivity } from './hooks/useCustomActivity';
import { useGeneratorForm } from './hooks/useGeneratorForm';
import { useTrackSearch, SEARCH_LOADING_MESSAGES } from './hooks/useTrackSearch';
import { useFavorites } from './hooks/useFavorites';
import { useAthleticProfile } from './hooks/useAthleticProfile';
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
import PlaylistsView from './components/views/PlaylistsView';
import DualRangeSlider from './components/shared/DualRangeSlider';
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

// formatDuration et parseTimeToSeconds, extraites dans utils/format.js
// (aucune dépendance à React ni au state), ne sont plus utilisées directement
// dans App.jsx : la première depuis le déplacement de recalculateTimeline
// vers musicEngine.js, la seconde depuis le déplacement du parsing CSV vers
// workoutDataEngine.js — les deux fichiers les importent désormais eux-mêmes.

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
  // Panneau "Mon Profil Athlétique" (GeneratorView) — remonté ici (pas un
  // simple useState local à GeneratorView) pour que le sous-menu "Mon Profil
  // Athlétique" de la sidebar (entre "Générer" et "Mes Routines", retour
  // direct : "j'imaginais ça en sous-menu de Générer dans le menu") puisse à
  // la fois naviguer vers Générer ET déplier directement ce panneau en un
  // seul clic, plutôt que d'atterrir sur Générer avec le panneau encore
  // replié.
  const [showAthleticProfile, setShowAthleticProfile] = useState(false);
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
  // Mode clair/sombre — persisté (voir usePersistentState) pour ne pas devoir
  // rebasculer à chaque visite. Toute la palette de couleurs (useTheme.js)
  // avait déjà son pendant `dark:` sur chaque classe Tailwind depuis le
  // début : le mode clair fonctionnait déjà "sous le capot", il ne manquait
  // que cet interrupteur pour que l'utilisateur puisse vraiment y basculer
  // (avant ce changement, `theme` valait toujours 'dark', sans aucun bouton
  // nulle part pour appeler `setTheme`).
  const [theme, setTheme] = usePersistentState('theme', 'dark');

  // "Adepte de la Lumière" — activer le mode clair au moins une fois. Wrapper
  // autour de `setTheme` plutôt qu'un appel direct dans le JSX du bouton, pour
  // garder la détection de trophée au même endroit que la bascule elle-même.
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'light' && !userStats.hasLightMode) {
      checkTrophies({ ...userStats, hasLightMode: true });
    }
  };

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

      const { rawTracks, followedArtistNames } = await fetchSpotifyRawData(token);

      if (rawTracks.length === 0 && followedArtistNames.length === 0) {
        showToast("Synchro terminée (Aucun titre liké ni artiste suivi trouvé).");
        return;
      }

      showToast("🔍 Interrogation du Moteur de Vérité BPM TempoFit...");
      const analyzedPool = await resolveTracksBpm(rawTracks);
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
  const { toast, showToast } = useToast();

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

  // Profil Athlétique (zones de cadence/BPM) — voir useAthleticProfile.js.
  // Pas encore connecté au générateur ni aux stats à ce stade (étape 1/2 du
  // plan : modèle de données + interface Réglages d'abord) ; `athleticProfile`
  // est déjà exposé aux autres vues dès maintenant pour que le branchement
  // des étapes suivantes n'ait qu'à consommer ce state, pas à le redéfinir.
  const {
    athleticProfile, setAthleticProfile,
    computeZonesFromBaseCadence,
    setBaseCadenceForActivity, setZoneForActivity, resetActivityProfile,
    addCustomActivity, removeCustomActivity, setBaseCadenceForCustom, setZoneForCustom, getProfileForWorkout,
    resetAthleticProfile,
  } = useAthleticProfile();

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

  const [workoutType, setWorkoutType] = useState('Course à pied');
  const {
    customActivity, setCustomActivity,
    tempCustomActivity, setTempCustomActivity,
    isCustomActivityModalOpen, setIsCustomActivityModalOpen,
    handleOpenCustomActivityModal,
  } = useCustomActivity(setWorkoutType);

  // --- Formulaire du wizard de génération (4 étapes) ---
  const {
    wizardStep, setWizardStep,
    selectedGenres, setSelectedGenres,
    genreWeights, setGenreWeights,
    lockedGenreWeights, setLockedGenreWeights,
    showExtraGenres, setShowExtraGenres,
    bpmTolerance, setBpmTolerance,
    crossfade, setCrossfade,
    bpm, setBpm, setBpmManual,
    structureMode, setStructureMode, isIntervalMode, isCrescendoMode,
    crescendoWarmupPct, setCrescendoWarmupPct, crescendoCooldownPct, setCrescendoCooldownPct,
    CRESCENDO_MIN_MAIN_PCT,
    crescendoWarmupBpm, setCrescendoWarmupBpm, crescendoCooldownBpm, setCrescendoCooldownBpm,
    applyProfileBpmIfUntouched,
    allowLongTracks, setAllowLongTracks,
    targetMode, setTargetMode,
    hours, setHours,
    minutes, setMinutes,
    distanceVal, setDistanceVal,
    distanceUnit, setDistanceUnit,
    paceMin, setPaceMin,
    paceSec, setPaceSec,
    segments, setSegments,
    expandedSegmentGenreId, setExpandedSegmentGenreId,
    availableGenres, displaySubtitleGen,
    equalSplitWeights, setGenreWeight, toggleGenre,
    toggleSegmentGenre, resetSegmentGenre, checkGenreWeightDeviation,
  } = useGeneratorForm(isNaughtyMode, athleticProfile);

  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  // Playlist d'exemple pré-remplie, même principe que la routine et les favoris de
  // départ — clairement nommée "Exemple" pour ne pas laisser penser qu'elle a été
  // vraiment générée, et laissée en statut "à faire" pour que la découverte du
  // bouton "marquer comme terminée" reste naturelle. `preview: null` ici par
  // défaut : le vrai extrait Deezer est résolu séparément au montage (voir le
  // useEffect dédié plus bas, après celui du <title>) plutôt que codé en dur —
  // une URL d'extrait Deezer expire au bout de quelques heures, donc la figer
  // ici casserait le bouton d'écoute silencieusement après coup.
  const [savedPlaylists, setSavedPlaylists] = usePersistentState('savedPlaylists', () => [{
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
  // Alimenté par executeGeneration : le lot en cours porte-t-il sur un genre
  // au mot-clé Deezer fragile (K-pop, J-pop & C-pop, Bandes originales — voir
  // WEAK_DEEZER_KEYWORD_GENRES) ? Utilisé UNIQUEMENT par le bandeau "Génération
  // en cours" plus bas, pour expliquer le délai au moment où il se produit
  // réellement plutôt qu'en avertissement statique avant de cliquer (retour
  // direct : plus pertinent à ce moment précis qu'en amont).
  const [isGeneratingSlowGenre, setIsGeneratingSlowGenre] = useState(false);
  // Chrono affiché dans le bandeau de génération — avant, le message restait
  // statique tout du long d'UNE playlist (seul le spinner tournait), ce qui
  // pouvait sembler figé/ennuyeux sur une génération un peu longue. Démarre à 0
  // dès que isGenerating passe à true (voir le useEffect ci-dessous), pas après
  // un délai.
  const elapsedSeconds = useElapsedTimer(isGenerating);

  const {
    shareData, setShareData,
    isShareModalOpen, setIsShareModalOpen,
    handleShare: handleShareBase, copyToClipboard, shareNative,
    shareToWhatsApp, shareToTwitter, shareToFacebook, shareViaEmail,
    shareImageFile,
  } = useShare(showToast);

  // "Partager" — utilise le bouton Partager (playlist ou trophée) au moins
  // une fois. Wrapper autour de `handleShare` (comme `toggleTheme` pour le
  // mode clair) plutôt que dans useShare.js, qui n'a accès ni à `userStats`
  // ni à `checkTrophies`.
  const handleShare = (type, item) => {
    handleShareBase(type, item);
    if (!userStats.hasSharedSomething) checkTrophies({ ...userStats, hasSharedSomething: true });
  };
  // Même trophée "Ambassadeur" que handleShare ci-dessus, pour le Bilan
  // Visuel de Séance (voir PlaylistDetailView.jsx) — un partage RÉUSSI ou une
  // image téléchargée comptent tous les deux comme un usage réel de la
  // fonctionnalité de partage ; un partage ANNULÉ par l'utilisateur (voir
  // shareImageFile, useShare.js) ne compte pas.
  const shareImageFileWithTrophy = async (file, title, text) => {
    const result = await shareImageFile(file, title, text);
    if (result !== 'cancelled' && !userStats.hasSharedSomething) checkTrophies({ ...userStats, hasSharedSomething: true });
    return result;
  };
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // --- Recherche manuelle de titre via une base musicale externe (ajout précis à une playlist ou aux favoris) ---
  // Regroupé dans useTrackSearch (state uniquement — la logique de recherche
  // elle-même, ex. searchWorldMusicApi, reste ici : trop volumineuse et
  // imbriquée pour être déplacée sans risque ce soir).
  const {
    searchQuery, setSearchQuery,
    isWorldSearching, setIsWorldSearching,
    worldSearchResults, setWorldSearchResults,
    resultsContextLabel, setResultsContextLabel,
    noUsableResultsHint, setNoUsableResultsHint,
    isBpmSearchMode, setIsBpmSearchMode,
    searchResultsOffset, setSearchResultsOffset,
    searchHasMoreResults, setSearchHasMoreResults,
    isLoadingMoreResults, setIsLoadingMoreResults,
    searchActiveArtistName, setSearchActiveArtistName,
    editingBpmId, setEditingBpmId,
    searchLoadingMessage, setSearchLoadingMessage,
    worldSearchOtherResults, setWorldSearchOtherResults,
    bpmSearchParams, setBpmSearchParams,
  } = useTrackSearch();
  // Chrono affiché pendant le chargement — repart de 0 à chaque nouvelle
  // recherche, incrémente chaque seconde tant que isWorldSearching est vrai.
  const searchElapsedSeconds = useElapsedTimer(isWorldSearching);
  // Édition du nom d'une playlist générée — avant, le nom auto-généré (ex. "Depuis :
  // 🏃‍♂️ Mon 5km Quotidien") n'était jamais modifiable, ce qui devenait vite peu
  // pratique pour s'y retrouver une fois plusieurs playlists sauvegardées.
  const [isEditingPlaylistName, setIsEditingPlaylistName] = useState(false);
  const [editedPlaylistName, setEditedPlaylistName] = useState("");

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

  // SEARCH_PAGE_SIZE, normalizeForArtistMatch, stripLeadingArticle,
  // levenshteinDistance et isConfidentArtistMatch sont désormais dans
  // searchEngine.js (voir import en haut de fichier) — extraites avec
  // fetchWorldSearchResults/fetchBpmSearchResults, qui en dépendent aussi.

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
  // Le calcul (appels Deezer/GetSongBPM, résolution BPM en cascade, tri
  // artiste prioritaire/reste) vit désormais dans fetchWorldSearchResults
  // (searchEngine.js) — voir ce fichier pour tout l'historique/raisonnement
  // (3 versions successives, cas "Bohemian Rhapsody" faux positif d'artiste,
  // etc.). Cette fonction ne fait plus que l'orchestration React : spinners,
  // puis application du résultat reçu sur le state, à l'identique du
  // comportement d'origine.
  const searchWorldMusicApi = async (reset = true) => {
    if (!searchQuery.trim()) return;
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
      const result = await fetchWorldSearchResults(searchQuery, {
        reset,
        offset: searchResultsOffset,
        activeArtistName: searchActiveArtistName,
        isNaughtyMode,
      });

      setSearchActiveArtistName(result.activeArtistName);

      if (result.noResults) {
        setNoUsableResultsHint(true);
      } else {
        setWorldSearchResults(prev => dedupeAppend(prev, result.matched, reset));
        setWorldSearchOtherResults(prev => dedupeAppend(prev, result.other, reset));
        if (reset) setResultsContextLabel(result.contextLabel);
        setSearchResultsOffset(result.newOffset);
        setSearchHasMoreResults(result.hasMore);
        if (reset && result.emptyAfterFormatting) setNoUsableResultsHint(true); // titres trouvés mais aucun n'a de BPM connu
      }
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
          <div className={"text-xs truncate " + textMuted}>{track.artist}{track.genre ? ` · ${getGenresForDisplay(track.genre, track.artist, track.title).join(', ')}` : ''}{track._genreMismatch && <span className="ml-1 text-amber-500 font-bold" title="Genre Deezer différent — peut quand même correspondre.">⚠️ Genre non confirmé</span>}{track._bpmSource === 'detected' && <span className="ml-1 text-amber-500 font-bold" title="BPM deviné par l'app, pas garanti.">⚠️ BPM estimé</span>}</div>
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
  // Calcul déplacé dans fetchBpmSearchResults (searchEngine.js) — cette
  // fonction ne fait plus que l'orchestration React (spinners + application
  // du résultat), comportement inchangé par rapport à l'original.
  const searchTracksByBpm = async (targetBpm, tolerance, genres) => {
    setBpmSearchParams({ bpm: targetBpm, tolerance, genres: genres || [] });
    setIsWorldSearching(true);
    // Même logique que le bandeau "Génération en cours" (voir isGeneratingSlowGenre,
    // executeGeneration) : message dédié quand un genre au mot-clé Deezer fragile
    // (K-pop, J-pop & C-pop, Bandes originales) est demandé, ici plutôt que dans
    // un avertissement statique avant le clic — partagé par le wizard ("Explorer
    // les titres à X BPM") ET la page Favoris ("Chercher des titres à X BPM"),
    // qui passent tous les deux par cette même fonction.
    setSearchLoadingMessage(
      (genres || []).some(g => WEAK_DEEZER_KEYWORD_GENRES.includes(g))
        ? "Recherche plus approfondie pour ce genre..."
        : SEARCH_LOADING_MESSAGES[Math.floor(Math.random() * SEARCH_LOADING_MESSAGES.length)]
    );
    setWorldSearchResults([]);
    setResultsContextLabel(`${targetBpm} BPM ± ${tolerance}`);
    setNoUsableResultsHint(false);
    try {
      const { results } = await fetchBpmSearchResults(targetBpm, tolerance, genres);
      setWorldSearchResults(results);
      if (results.length === 0) setNoUsableResultsHint(true);
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

  // Vue demandée en attente de confirmation — non-null uniquement pendant que
  // la modale d'avertissement (playlist générée non sauvegardée) est affichée.
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Confirmation avant de retirer une playlist qui a déjà de l'historique
  // (complétions et/ou données Garmin/Strava importées) — contrairement à la
  // suppression depuis "Mes Séances" (PlaylistCard), qui reste sans
  // confirmation par cohérence avec l'existant, ce bouton-ci est un badge de
  // statut devenu cliquable : le risque d'un clic accidentel (swipe mobile,
  // simple survol qui devient un tap) y est plus élevé, et la perte port sur
  // du VRAI historique (séances faites, données réelles), pas juste une
  // playlist fraîchement générée. Reste `null` tant qu'aucune confirmation
  // n'est nécessaire ; sinon contient la playlist concernée.
  const [pendingUnsavePlaylist, setPendingUnsavePlaylist] = useState(null);

  // Playlist tout juste générée mais jamais sauvegardée : la quitter (navigation
  // interne OU fermeture d'onglet/F5) la perdrait définitivement (pas de brouillon
  // persistant, voir createPlaylistData). Ignore les playlists vides (génération
  // ratée, rien de réel à perdre). Calculée une fois ici et réutilisée par
  // `changeView` (modale interne) et par le listener `beforeunload` ci-dessous
  // (avertissement natif du navigateur), pour ne jamais avoir 2 définitions de
  // "playlist non sauvegardée" qui divergent.
  const hasUnsavedPlaylist = view === 'playlist' && currentPlaylist
    && !savedPlaylists.find(p => p.id === currentPlaylist.id)
    && currentPlaylist.tracks && currentPlaylist.tracks.length > 0;

  const changeView = (newView) => {
    // Ne se déclenche que si on QUITTE réellement la vue détail (newView !== 'playlist').
    if (hasUnsavedPlaylist && newView !== 'playlist') {
      setPendingNavigation(newView);
      return;
    }
    setView(newView);
    setIsMobileMenuOpen(false);
    if (newView === 'generator') setWizardStep(1); // Repart toujours à l'étape 1 du wizard
  };

  // Pendant à `changeView` : avertit aussi à la fermeture d'onglet / F5, pas
  // seulement à la navigation interne dans l'appli (limite explicitement
  // signalée lors de la session précédente). Les navigateurs modernes
  // n'affichent plus le texte personnalisé de `returnValue` (message générique
  // imposé par le navigateur pour éviter les abus) — on le renseigne quand
  // même pour les navigateurs plus anciens qui le respectent encore.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedPlaylist) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedPlaylist]);

  // Résout la navigation mise en attente par la modale d'avertissement.
  const resolvePendingNavigation = (shouldSave) => {
    if (shouldSave) handleSavePlaylist();
    if (pendingNavigation) {
      setView(pendingNavigation);
      setIsMobileMenuOpen(false);
      if (pendingNavigation === 'generator') setWizardStep(1);
    }
    setPendingNavigation(null);
  };

  const getActiveWorkoutName = () => (workoutType === 'Autre' && customActivity.trim() !== '') ? customActivity : workoutType;

  /**
   * Ligne d'infos partagée par les cartes de Routine et de Playlist (vue "Mes
   * Séances") — avant, chacune affichait un mélange différent de champs, dans un
   * ordre différent, ce qui rendait les vues incohérentes entre elles. Ordre
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
        <div className="flex items-center space-x-1"><Zap size={14}/><span>{source.isCrescendoMode ? 'Crescendo (3 phases)' : (source.isIntervalMode ? `${(source.segments || []).length} phases` : `${source.bpm} BPM`)}</span></div>
        {genres.length > 0 && <div className="flex items-center space-x-1"><Music size={14}/><span>{genres.map(genreDisplayLabel).join(', ')}</span></div>}
        {extra}
      </div>
    );
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
      showToast("Ambiance intime activée...", 'ambiance');
    } else {
      setIsNaughtyMode(false);
      setBpm(160); setBpmTolerance(10); setSelectedGenres(['Métal']); setGenreWeights({ 'Métal': 100 }); setLockedGenreWeights(new Set()); setCrossfade(2);
      showToast("Retour au mode Standard !");
    }
  };

  // Sauvegarde la configuration actuelle du wizard comme routine réutilisable.
  const handleSaveRoutine = () => {
    const finalName = newRoutineName.trim() || `Routine ${workoutType === 'Autre' ? customActivity || 'Personnalisée' : workoutType}`;
    const newRoutine = {
      id: `routine-${Date.now()}`, name: finalName, workoutType,
      customActivity: workoutType === 'Autre' ? customActivity : '', isIntervalMode, isCrescendoMode, bpm,
      crescendoWarmupPct, crescendoCooldownPct, crescendoWarmupBpm, crescendoCooldownBpm,
      targetMode, distanceVal, distanceUnit, paceMin, paceSec, hours, minutes, selectedGenres, bpmTolerance, crossfade, allowLongTracks, genreWeights,
      segments: isIntervalMode ? [...segments] : [], coverIcon: newRoutineIcon, autoGenFreq: newRoutineFreq,
      manualGenerations: 0, recentTrackIds: [], createdAt: new Date().toLocaleDateString()
    };
    addRoutine(newRoutine);

    // "Créer une Routine" — sauvegarder sa toute première routine.
    // "Génération automatique" — activer l'auto-génération dessus (pas juste
    // "Manuel") dès la création. Les deux sont de la pure découverte de
    // fonctionnalité, vérifiées indépendamment l'une de l'autre.
    let newFlags = {};
    if (routines.length === 0 && !userStats.hasFirstRoutine) newFlags.hasFirstRoutine = true;
    if (newRoutineFreq !== 'Manuel' && !userStats.hasAutoGen) newFlags.hasAutoGen = true;
    if (Object.keys(newFlags).length > 0) checkTrophies({ ...userStats, ...newFlags });
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
   * Tant que la modale d'édition de routine est ouverte sur une routine en
   * mode Crescendo, ses segments (échauffement/cœur de séance/retour au
   * calme) sont recalculés automatiquement à chaque changement de BPM,
   * durée/distance, répartition (%) ou override BPM manuel — même logique
   * que le wizard (voir l'effet équivalent dans useGeneratorForm.js),
   * dupliquée ici car `editingRoutine` est un objet plat indépendant du state
   * du wizard : une routine en cours d'édition ne doit pas partager son state
   * avec le générateur (l'utilisateur peut avoir un brouillon de génération
   * en cours par ailleurs, les deux ne doivent pas s'écraser mutuellement).
   * Comparaison JSON avant `setEditingRoutine` pour éviter une boucle de
   * setState inutile (l'effet re-déclenche sur `editingRoutine.segments`
   * indirectement via la ré-exécution du composant, mais le contenu ne
   * change alors plus, donc pas de nouvelle mise à jour).
   */
  useEffect(() => {
    if (!isEditRoutineModalOpen || !editingRoutine || !editingRoutine.isCrescendoMode) return;
    const bpmFloor = isNaughtyMode ? 40 : 80;
    // Routine créée avant l'ajout du réglage BPM manuel (ou jamais encore
    // ouverte en édition) : `crescendoWarmupBpm`/`crescendoCooldownBpm`
    // peuvent être absents. On les initialise ici sur des valeurs de départ
    // sensées (déduites du BPM cible) — plus de bouton pour le faire
    // explicitement, seule la première ouverture de cette modale s'en charge.
    if (editingRoutine.crescendoWarmupBpm == null || editingRoutine.crescendoCooldownBpm == null) {
      const deduced = deduceCrescendoBpm(editingRoutine.bpm, bpmFloor);
      setEditingRoutine(prev => (prev && (prev.crescendoWarmupBpm == null || prev.crescendoCooldownBpm == null))
        ? { ...prev, crescendoWarmupBpm: prev.crescendoWarmupBpm ?? deduced.warmupBpm, crescendoCooldownBpm: prev.crescendoCooldownBpm ?? deduced.cooldownBpm }
        : prev);
      return;
    }
    const newSegments = buildCrescendoSegments(
      editingRoutine.targetMode, editingRoutine.bpm, editingRoutine.hours, editingRoutine.minutes,
      editingRoutine.distanceVal, editingRoutine.paceMin, editingRoutine.paceSec, bpmFloor,
      editingRoutine.crescendoWarmupPct ?? 15, editingRoutine.crescendoCooldownPct ?? 15,
      editingRoutine.crescendoWarmupBpm, editingRoutine.crescendoCooldownBpm,
    );
    if (JSON.stringify(newSegments) !== JSON.stringify(editingRoutine.segments)) {
      setEditingRoutine(prev => prev ? { ...prev, segments: newSegments } : prev);
    }
  }, [
    isEditRoutineModalOpen, editingRoutine?.isCrescendoMode,
    editingRoutine?.targetMode, editingRoutine?.bpm, editingRoutine?.hours, editingRoutine?.minutes,
    editingRoutine?.distanceVal, editingRoutine?.paceMin, editingRoutine?.paceSec,
    editingRoutine?.crescendoWarmupPct, editingRoutine?.crescendoCooldownPct,
    editingRoutine?.crescendoWarmupBpm, editingRoutine?.crescendoCooldownBpm,
    isNaughtyMode,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // recalculateTimeline est désormais dans musicEngine.js (voir import en
  // haut de fichier), déplacée avec createPlaylistData — comportement inchangé,
  // tous les appels ci-dessous continuent de fonctionner à l'identique.

  /**
   * createPlaylistData est désormais dans musicEngine.js (voir import en haut
   * de fichier), rendue 100% pure : elle reçoit maintenant `favorites`,
   * `spotifyTrackPool` et `isNaughtyMode` en paramètres explicites au lieu de
   * les lire dans le state d'App.jsx par fermeture (voir le commentaire dans
   * musicEngine.js pour le raisonnement complet). Signature désormais :
   * `createPlaylistData(config, initialExcludeIds, favorites, spotifyTrackPool, isNaughtyMode)`
   * — voir son unique appel plus bas, dans executeGeneration.
   */

  // Ajoute la playlist en cours d'affichage à "Mes Séances" (si pas déjà sauvegardée).
  const handleSavePlaylist = () => {
    if (currentPlaylist && !savedPlaylists.find(p => p.id === currentPlaylist.id)) {
      const saved = { ...currentPlaylist, status: 'pending' };
      setSavedPlaylists([saved, ...savedPlaylists]);
      // `currentPlaylist` et l'entrée poussée dans `savedPlaylists` étaient 2
      // objets distincts (même id, mais 2 références différentes) tant que
      // cette ligne n'existait pas — resynchronisé ici pour éviter toute
      // divergence silencieuse entre les deux au fil des actions suivantes
      // (ex. planifier une date juste après avoir sauvegardé).
      setCurrentPlaylist(saved);
      showToast("Playlist ajoutée à Mes Séances !");
    }
  };

  /**
   * Retire une playlist de "Mes Séances" par id — fonction UNIQUE utilisée à
   * la fois par le bouton "Sauvegardée..." de la vue détail (retrait) et par
   * la poubelle des cartes dans "Mes Séances" (PlaylistsView/PlaylistCard) :
   * c'est littéralement la même opération (retirer un id de `savedPlaylists`),
   * pas la peine de la dupliquer. `playlistId` plutôt que `currentPlaylist`
   * pour fonctionner aussi bien depuis la liste (pas de "playlist courante"
   * là-bas) que depuis le détail.
   */
  const removeSavedPlaylist = (playlistId) => {
    setSavedPlaylists(savedPlaylists.filter(p => p.id !== playlistId));
    showToast("Playlist retirée de Mes Séances.");
  };

  // A-t-elle du VRAI historique à perdre (pas juste "jamais utilisée") ?
  const playlistHasHistory = (playlist) => !!playlist && (
    (playlist.completions && playlist.completions.length > 0)
    || (playlist.actualDataByDate && Object.keys(playlist.actualDataByDate).length > 0)
  );

  /**
   * Point d'entrée commun du retrait/suppression, avec confirmation
   * UNIQUEMENT si la playlist a déjà des complétions ou des données
   * importées (une playlist "fraîche", jamais faite, est retirée
   * directement, sans friction inutile) — que ce soit depuis le bouton
   * "Sauvegardée dans Mes Séances" de la vue détail ou depuis la poubelle
   * d'une carte dans "Mes Séances" : même garde-fou aux deux endroits
   * (retour direct après un audit de cohérence — l'un avait la confirmation,
   * l'autre pas, pour la même perte de données possible).
   */
  const requestRemoveSavedPlaylist = (playlistId) => {
    const playlist = savedPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;
    if (playlistHasHistory(playlist)) {
      setPendingUnsavePlaylist(playlist);
    } else {
      removeSavedPlaylist(playlistId);
    }
  };

  // Pendant de requestRemoveSavedPlaylist, spécifique à la vue détail : pas
  // d'id à transmettre depuis là-bas, juste `currentPlaylist`.
  const requestUnsavePlaylist = () => {
    if (currentPlaylist) requestRemoveSavedPlaylist(currentPlaylist.id);
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
    // Couvre le genre global de la séance ET un éventuel override de genre
    // propre à une portion (mode Fractionné/Crescendo, voir toggleSegmentGenre
    // dans useGeneratorForm.js) — un genre lent choisi seulement sur UNE
    // portion mérite quand même le message, pas seulement s'il est global.
    const involvesSlowGenre = (config.selectedGenres || []).some(g => WEAK_DEEZER_KEYWORD_GENRES.includes(g))
      || (config.segments || []).some(s => (s.selectedGenres || []).some(g => WEAK_DEEZER_KEYWORD_GENRES.includes(g)));
    setIsGeneratingSlowGenre(involvesSlowGenre);
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

    // "Les 3 Visages de l'Effort" — génère au moins une fois chacune des 3
    // structures (Constante / Crescendo / Fractionné). `config` ne porte pas
    // directement `structureMode` (c'est un concept du wizard, voir
    // useGeneratorForm.js) — on le redérive ici à partir des 2 booléens que
    // `config` porte déjà, qui suffisent à distinguer les 3 cas sans ambiguïté.
    const structureKind = !config.isIntervalMode ? 'constant' : (config.isCrescendoMode ? 'crescendo' : 'interval');
    const usedKinds = new Set(newStats.usedStructureKinds || []);
    if (!usedKinds.has(structureKind)) {
      usedKinds.add(structureKind);
      newStats.usedStructureKinds = Array.from(usedKinds);
      statsUpdated = true;
      if (!newStats.hasAllStructures && usedKinds.size >= 3) { newStats.hasAllStructures = true; }
    }

    // "Genres étendus" — génère avec au moins un genre de la liste "+ Plus de
    // genres" (EXTRA_GENRES), jamais visible tant qu'on ne déplie pas ce
    // volet à l'étape des genres.
    if (!newStats.hasExtraGenre && (config.selectedGenres || []).some(g => EXTRA_GENRES.includes(g))) {
      newStats.hasExtraGenre = true; statsUpdated = true;
    }

    // "Mes Favoris" (hasUsedFavorites) déplacé après la génération elle-même
    // (voir plus bas) : BUG CORRIGÉ — la condition ici se basait sur la simple
    // présence de favoris CONFIGURÉS quelque part dans l'app (`favorites.
    // artists.length > 0`), qui vaut TOUJOURS vrai dès l'installation à cause
    // des 2 artistes de démonstration pré-remplis (Metallica, System Of A
    // Down — voir useFavorites.js), et `favorites.useFavorites` qui n'a jamais
    // eu la moindre UI pour être désactivé, donc toujours `true` lui aussi. Un
    // tout nouvel utilisateur qui n'avait jamais rien favorisé lui-même
    // débloquait donc ce trophée dès sa toute première génération, quel que
    // soit le genre/BPM demandé. Vérifié maintenant sur la playlist RÉELLEMENT
    // générée (voir `_fromFavorites`, posé par musicEngine.js uniquement quand
    // un titre vient effectivement de `favorites.tracks`/`favorites.artists`).

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
      const pl = await createPlaylistData(config, rollingExcludeIds, favorites, spotifyTrackPool, isNaughtyMode);
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
    setIsGeneratingSlowGenre(false);

    // "Mes Favoris" (hasUsedFavorites) : voir le commentaire plus haut pour le
    // bug corrigé — vérifié ici sur la playlist RÉELLEMENT générée par ce lot,
    // pas sur une simple présence de favoris configurés. `_fromFavorites` posé
    // par musicEngine.js (buildSegmentTracks/getSingleMatchingTrack) UNIQUEMENT
    // quand un titre vient effectivement de `favorites.tracks` ou d'une
    // recherche sur `favorites.artists` — jamais sur un titre qui, par pure
    // coïncidence, se trouve être du même artiste sans être passé par ce chemin.
    if (!newStats.hasUsedFavorites && generatedPlaylists.some(pl => pl.tracks.some(t => t._fromFavorites))) {
      newStats.hasUsedFavorites = true; statsUpdated = true;
    }
    if (statsUpdated) checkTrophies(newStats);

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

  // Planifie (ou déplanifie, si dateStr est vide) une date optionnelle pour une
  // playlist — sert uniquement de clé de TRI dans "Mes Séances" (section
  // "Planifiées"), jamais une contrainte bloquante : une playlist sans date
  // reste utilisable normalement, juste triable manuellement à la place (voir
  // PlaylistsView, glisser-déposer de la section "À planifier").
  const setPlaylistPlannedDate = (playlistId, dateStr) => {
    const value = dateStr || null;
    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, plannedDate: value } : p));
    if (currentPlaylist && currentPlaylist.id === playlistId) {
      setCurrentPlaylist({ ...currentPlaylist, plannedDate: value });
    }
    // "Planifier une séance" — donner une date à une playlist pour la première
    // fois (`value` non vide ⇒ on planifie, pas on déplanifie). Volontairement
    // indépendant de "Pile à l'Heure" (qui récompense d'avoir RESPECTÉ la
    // date) : ici c'est juste le premier pas, découvrir que ça existe.
    if (value && !userStats.hasPlannedSession) {
      checkTrophies({ ...userStats, hasPlannedSession: true });
    }
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
    const requestedGenres = currentPlaylist.config?.selectedGenres || ['Métal'];
    const allowLong = currentPlaylist.config?.allowLongTracks || false;

    let newRawTrack = await findSameArtistReplacement(oldTrack.artist, minBpm, maxBpm, usedIds, requestedGenres, allowLong);

    // Repli sur la recherche large habituelle si aucun autre titre de cet artiste n'a été trouvé.
    if (!newRawTrack) {
      newRawTrack = await getSingleMatchingTrack(oldTrack.targetSegmentBpm, currentPlaylist.tolerance || 10, requestedGenres, usedIds, favorites, spotifyTrackPool, null, [], allowLong);
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
  // Déplace le titre actuellement "saisi" (`draggedTrackIndex`) à la position
  // `newIndex` — factorisé hors de `handleTrackDragEnter` (ci-dessous) pour
  // être réutilisé tel quel par le glisser-déposer directement sur la courbe
  // d'intensité (voir handleChartMouseMove, plus haut) : la liste et le
  // graphique partagent maintenant EXACTEMENT le même mécanisme de
  // réordonnancement, pas 2 implémentations parallèles à maintenir.
  const moveTrackTo = (newIndex) => {
    if (draggedTrackIndex === null || draggedTrackIndex === newIndex || !currentPlaylist) return;
    const newTracks = [...currentPlaylist.tracks];
    const [moved] = newTracks.splice(draggedTrackIndex, 1);
    newTracks.splice(newIndex, 0, moved);
    let updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
    updatedPlaylist = recalculateTimeline(updatedPlaylist);
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    setDraggedTrackIndex(newIndex);
  };
  const handleTrackDragStart = (index) => (e) => {
    setDraggedTrackIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleTrackDragEnter = (index) => (e) => {
    e.preventDefault();
    moveTrackTo(index);
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
   * pollué "Mes Séances" d'un doublon par séance.
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

  /**
   * Marque une playlist comme faite — soit "maintenant" (bouton "Marquer comme
   * faite", 1er clic sans calendrier), soit à une date CHOISIE explicitement
   * (bouton "Ajouter une date" sur une playlist déjà complétée, qui ouvre un
   * calendrier — fusionné ici avec l'ancien bouton "Marquer comme refaite
   * aujourd'hui" sur retour direct : les deux faisaient doublon, ne garder
   * qu'un seul bouton qui permet de choisir n'importe quelle date, y compris
   * aujourd'hui). `isoDate` absent ⇒ comportement "maintenant" inchangé
   * (horodatage complet avec l'heure) ; fourni ⇒ une simple date sans heure
   * (`YYYY-MM-DD`, ce que rend un `<input type="date">`).
   */
  const markPlaylistAsCompleted = (playlistId, isoDate) => {
    const pl = savedPlaylists.find(p => p.id === playlistId);
    if (!pl) return;

    const isExplicitDate = !!isoDate;
    const completionValue = isoDate || new Date().toISOString();
    const existingCompletions = pl.completions || [];

    if (existingCompletions.includes(completionValue)) {
      showToast("Cette date est déjà enregistrée.");
      return;
    }

    // CORRIGÉ après retour utilisateur : bloquer purement et simplement une 2e
    // complétion le même JOUR calendaire n'a pas de sens — une vraie double
    // séance le même jour (matin + soir) est un cas réel et légitime, pas une
    // erreur. Le vrai problème que la version précédente essayait de résoudre
    // (un double-clic accidentel sur ce bouton) se règle mieux avec un
    // horodatage complet (pas juste la date) et une fenêtre anti-rebond courte :
    // si la dernière complétion enregistrée date de moins de 10 secondes, on
    // suppose un clic répété par erreur ; au-delà, on suppose une vraie 2e séance.
    // UNIQUEMENT pertinent pour "maintenant" — une date choisie explicitement
    // dans le calendrier ne peut, par construction, jamais être un double-clic.
    if (!isExplicitDate) {
      const lastCompletion = existingCompletions.length > 0 ? existingCompletions[existingCompletions.length - 1] : null;
      if (lastCompletion) {
        const lastDate = new Date(lastCompletion);
        if (!isNaN(lastDate.getTime()) && (Date.now() - lastDate.getTime()) < 10000) {
          showToast("Déjà marquée à l'instant !");
          return;
        }
      }
    }

    const updatedCompletions = [...existingCompletions, completionValue].sort();
    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, completions: updatedCompletions } : p));

    // Heure de la journée : seulement significative pour "maintenant" — une
    // date choisie au calendrier (YYYY-MM-DD, sans heure) n'a pas d'heure
    // réelle associée, "Oiseau de Nuit" n'aurait aucun sens dessus.
    const isNight = !isExplicitDate && (() => {
      const hour = new Date(completionValue).getHours();
      return hour >= 22 || hour <= 4;
    })();

    let stats = {
      ...userStats,
      totalCompleted: userStats.totalCompleted + 1,
      naughtyCompleted: userStats.naughtyCompleted + (pl.isNaughty ? 1 : 0),
      hasNightOwl: userStats.hasNightOwl || isNight
    };

    // "Le Grimpeur" — compléter une séance en mode Crescendo.
    if (pl.config?.isCrescendoMode) stats.hasCrescendoCompleted = true;

    // "Pile à l'Heure" — la complétion tombe EXACTEMENT le jour planifié (même
    // comparaison que le texte "faite comme prévu" déjà affiché sur les
    // cartes, voir PlaylistCard.jsx — juste jamais exploitée pour un trophée).
    if (pl.plannedDate && completionValue.slice(0, 10) === pl.plannedDate) {
      stats.hasOnTimeCompletion = true;
    }

    // "Touche-à-Tout" — au moins une séance complétée de chacun des 3 types
    // d'activité "classiques" (volontairement PAS "Autre", qui est une case
    // fourre-tout sans identité propre).
    const trackedWorkoutTypes = new Set(stats.completedWorkoutTypes || []);
    if (['Course à pied', 'Musculation', 'Cyclisme'].includes(pl.workoutType)) {
      trackedWorkoutTypes.add(pl.workoutType);
      stats.completedWorkoutTypes = Array.from(trackedWorkoutTypes);
      if (trackedWorkoutTypes.size >= 3) stats.hasAllWorkoutTypes = true;
    }

    // "100 Bornes au Compteur" — distance CUMULÉE sur l'ensemble des séances
    // complétées (contrairement au Marathonien, qui porte sur une seule
    // séance ≥ 42km). Une séance basée sur le Temps (pas la Distance) a quand
    // même une distance implicite via son allure moyenne (`avgPace`, en
    // secondes/unité) — même calcul que celui déjà utilisé pour l'affichage
    // dans PlaylistCard.jsx. Conversion en km si l'unité de la playlist est
    // les miles, pour cumuler dans une seule unité cohérente.
    if (pl.avgPace) {
      const distInUnit = pl.totalDuration / pl.avgPace;
      const distKm = pl.distanceUnit === 'mi' ? distInUnit * 1.60934 : distInUnit;
      stats.totalDistanceKm = (stats.totalDistanceKm || 0) + distKm;
      if (stats.totalDistanceKm >= 100) stats.has100km = true;
    }

    // "Sur ta Lancée" — une séance complétée 3 jours calendaires D'AFFILÉE,
    // tous types et toutes playlists confondus. Reconstruit l'ensemble des
    // jours distincts ayant au moins une complétion (celle qu'on vient
    // d'ajouter incluse) à partir de TOUTES les playlists sauvegardées,
    // plutôt que de suivre un compteur séparé — plus simple et toujours exact,
    // même si des complétions sont retirées/ajoutées après coup ailleurs.
    const allCompletionDays = new Set();
    savedPlaylists.forEach(p => {
      const completions = p.id === playlistId ? updatedCompletions : (p.completions || []);
      completions.forEach(iso => allCompletionDays.add(iso.slice(0, 10)));
    });
    const sortedDays = Array.from(allCompletionDays).sort();
    let consecutive = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const diffDays = Math.round((new Date(sortedDays[i]) - new Date(sortedDays[i - 1])) / 86400000);
      consecutive = diffDays === 1 ? consecutive + 1 : 1;
      if (consecutive >= 3) { stats.hasStreak3 = true; break; }
    }

    // BUG CORRIGÉ : `stats.unlockedTrophies.length === userStats.unlockedTrophies.length`
    // comparait le même tableau à lui-même (checkTrophies ne mute jamais l'objet
    // reçu, voir useUserStats.js) — toujours vrai, donc le toast générique
    // ci-dessous s'affichait AUSSI après un déblocage de trophée et écrasait
    // silencieusement le toast "Trophée débloqué" (un seul toast à la fois).
    // On se fie maintenant à la valeur de retour de checkTrophies.
    const trophyUnlocked = checkTrophies(stats);
    if (!trophyUnlocked) {
      showToast(updatedCompletions.length > 1 ? `Séance re-marquée comme faite ! (${updatedCompletions.length}e fois) 💪` : "Session marquée comme terminée ! 💪");
    }
  };

  /**
   * Retire une date de complétion précise. Si c'était la DERNIÈRE restante, la
   * playlist n'a alors plus aucune complétion : elle quitte la section
   * "Terminées" et retourne dans "À planifier" (son statut n'est plus que
   * dérivé de la présence ou non de complétions, voir plus haut). On prévient
   * clairement de cette conséquence plutôt que de laisser l'utilisateur la
   * découvrir après coup — mais on laisse quand même l'action se faire,
   * puisque c'est explicitement ce qui est demandé.
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
      showToast("Dernière date retirée : cette playlist n'a plus aucune complétion, elle repasse dans \"Mes Séances\".", 'error');
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
        const result = parseGarminCsv(event.target.result);
        if (!result.ok) { showToast(result.error, 'error'); return; }
        const { data: parsedData, hasCadence, hasHeartRate } = result;

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
      // Regroupement sur le genre CANONIQUE (normalizeGenreForDisplay), le
      // libellé "Divers" (genreDisplayLabel) n'est appliqué qu'à l'affichage
      // final juste en dessous — cette fonction reste un simple regroupement,
      // pas un renommage.
      const g = normalizeGenreForDisplay(t.genre, t.artist, t.title);
      buckets[g] = (buckets[g] || 0) + t.duration;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name: genreDisplayLabel(name), value }));
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
   * Liste interactive des dates de complétion d'une playlist — utilisée par
   * PlaylistCard, partagée par les 3 sections de "Mes Séances" (à planifier /
   * planifiées / terminées) pour rester cohérente. Chaque date : clic pour
   * modifier (ouvre un vrai sélecteur de date), croix pour retirer. Une tuile
   * en pointillés permet d'ajouter une date précise (pas seulement
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
        {/* L'ancienne pastille "+ Ajouter une date" ici a été retirée (retour
            direct) : elle faisait doublon avec le bouton "Marquer comme faite/
            refaite" en bas de carte, qui permet désormais de choisir
            n'importe quelle date (pas seulement "aujourd'hui") — voir
            PlaylistCard.jsx et markPlaylistAsCompleted. */}
      </div>
    );
  };

  // Résout l'index du segment (voir trackSegments) sous le curseur à partir de
  // l'objet `state` fourni par Recharts (onClick/onMouseDown/onMouseMove) —
  // extrait de handleChartClick pour être réutilisé par le glisser-déposer de
  // segments directement sur le graphique (voir plus bas, handleChartMouseDown/
  // Move/Up) : Recharts résout déjà lui-même "quel point de données sous le
  // curseur" en tenant compte des marges/largeur de l'axe Y, bien plus fiable
  // qu'un calcul de position en pixels refait à la main ici.
  const resolveSegmentIdxFromChartState = (state) => {
    if (!state || state.activeLabel === undefined || state.activeLabel === null) return -1;
    // En mode Distance, activeLabel est déjà dans l'unité d'AFFICHAGE convertie
    // (voir dataKey du XAxis) — on le reconvertit dans l'unité brute d'origine
    // avant de le comparer aux bornes de trackSegments, qui restent toujours
    // exprimées dans l'unité d'origine de la playlist.
    const rawCursorVal = chartAxisType === 'distance' ? parseFloat(state.activeLabel) / distanceDisplayFactor : parseFloat(state.activeLabel);
    const key = chartAxisType === 'distance' ? 'Dist' : 'Time';
    return trackSegments.findIndex(seg => rawCursorVal >= seg[`start${key}`] && rawCursorVal < seg[`end${key}`]);
  };

  const handleChartClick = (state) => {
    const idx = resolveSegmentIdxFromChartState(state);
    if (idx >= 0) setSelectedSegmentIdx(idx);
  };

  // Glisser-déposer directement sur la courbe (retour direct : "je veux
  // pouvoir prendre une partie du graphique et la déplacer ailleurs, ce qui
  // revient à drag & drop une musique pour la mettre ailleurs dans la
  // playlist") — réutilise EXACTEMENT la même logique de réordonnancement que
  // la liste de titres (voir moveTrackTo, factorisée depuis
  // handleTrackDragEnter juste après), pas une 2e implémentation séparée.
  // Recharts n'a pas d'équivalent direct du drag-and-drop HTML5 natif utilisé
  // par la liste (`draggable`) sur ses éléments SVG — implémenté ici via les
  // événements souris bruts (mousedown/mousemove/mouseup) que Recharts expose
  // sur <LineChart>, chacun donnant déjà accès au point de données sous le
  // curseur (voir resolveSegmentIdxFromChartState) sans calcul de pixels à la
  // main.
  const [isDraggingChartSegment, setIsDraggingChartSegment] = useState(false);
  // Retenus pour le toast de confirmation à la fin du geste (voir
  // handleChartMouseUp) : `draggedTrackIndex` est écrasé en continu pendant le
  // glissement (voir moveTrackTo), donc on ne peut plus, une fois arrivé à
  // mouseUp, savoir si la position a réellement changé sans avoir gardé le
  // point de départ à part.
  const [chartDragStartIndex, setChartDragStartIndex] = useState(null);
  const [chartDragTrackTitle, setChartDragTrackTitle] = useState(null);
  const handleChartMouseDown = (state) => {
    const idx = resolveSegmentIdxFromChartState(state);
    if (idx >= 0) {
      setDraggedTrackIndex(idx);
      setSelectedSegmentIdx(idx); // surbrillance immédiate du segment saisi
      setIsDraggingChartSegment(true);
      setChartDragStartIndex(idx);
      setChartDragTrackTitle(trackSegments[idx]?.track?.title || null);
    }
  };
  const handleChartMouseMove = (state) => {
    if (!isDraggingChartSegment) return;
    const idx = resolveSegmentIdxFromChartState(state);
    if (idx >= 0) {
      moveTrackTo(idx);
      setSelectedSegmentIdx(idx); // la surbrillance SUIT le segment pendant qu'on le déplace
    }
  };
  const handleChartMouseUp = () => {
    // Confirmation visible SEULEMENT si la position a vraiment changé (retour
    // direct : "ça manque d'indication visuelle quand je déplace un morceau
    // via le graphique") — un simple clic (mousedown puis mouseup sans
    // bouger) ne doit pas déclencher de toast, seul un déplacement réel le
    // mérite.
    if (isDraggingChartSegment && chartDragStartIndex !== null && draggedTrackIndex !== null && draggedTrackIndex !== chartDragStartIndex) {
      showToast(`🔀 "${chartDragTrackTitle}" déplacé dans la playlist.`);
    }
    setIsDraggingChartSegment(false);
    setDraggedTrackIndex(null);
    setChartDragStartIndex(null);
    setChartDragTrackTitle(null);
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
            ('default' = neutre, 'special' = trophée débloqué UNIQUEMENT, 'ambiance' =
            mise en avant positive générique (mode Intime, etc.), 'error' = échec).
            Avant : les erreurs réutilisaient le style doré "trophée" des déblocages de
            succès, corrigé une 1ère fois — puis le message "Ambiance intime activée"
            a fait exactement la même confusion (retour direct : le trophée doré qui
            s'affiche à l'activation du mode Intime ne veut rien dire, on n'a rien
            débloqué). D'où ce 4e variant dédié, avec sa propre icône/couleur. */}
        {toast && (
          <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[80] bg-white dark:bg-gray-800 border ${
            toast.variant === 'special' ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]' :
            toast.variant === 'ambiance' ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.35)]' :
            toast.variant === 'error' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]' :
            'border-gray-200 dark:border-gray-700 shadow-2xl'
          } px-6 py-3 rounded-full flex items-center space-x-3 animate-in slide-in-from-top-4 fade-in duration-300`}>
            {toast.variant === 'special' ? <Trophy size={18} className="text-yellow-500 fill-yellow-500" /> :
             toast.variant === 'ambiance' ? <Heart size={18} className="text-rose-500 fill-rose-500" /> :
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
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[80] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl px-6 py-3 rounded-full flex items-center space-x-3 animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-[90vw]">
            <Loader2 size={18} className={`animate-spin ${textColorClass} shrink-0`} />
            <span className={`font-medium text-sm ${textHighlight}`}>
              {generatingTotal > 1
                ? `Génération ${generatingDone}/${generatingTotal}...`
                : isGeneratingSlowGenre
                  ? "Génération en cours (genre plus long à cibler)..."
                  : "Génération en cours..."}
            </span>
            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${textMuted} bg-black/5 dark:bg-white/10`}>
              {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* Bouton flottant "Trophées" avec badge du nombre débloqué — discret/gris
            tant qu'aucun trophée n'est débloqué (pas de doré, pas de badge), pour
            garder l'effet de surprise/récompense au 1er déblocage, SANS pour
            autant le rendre invisible : un utilisateur qui n'a encore rien
            débloqué doit quand même voir qu'un système de récompenses existe,
            pour être incité à aller découvrir les fonctionnalités qui y mènent
            (Favoris, Partager, Planifier...) — décision prise après discussion,
            plutôt que de le masquer complètement avant le 1er trophée. */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[60]">
          <button
            onClick={() => changeView('trophies')}
            className={`relative p-3 rounded-full shadow-lg border hover:scale-110 transition-transform flex items-center justify-center ${
              userStats.unlockedTrophies.length > 0
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 border-yellow-200 dark:border-yellow-700/50'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700'
            }`}
          >
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
             <div className="flex items-center gap-1">
               <button
                 onClick={toggleTheme}
                 title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                 className={`p-2 rounded-lg transition-colors ${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}
               >
                 {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
               </button>
               <button className="md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
             </div>
          </div>
          
          {/* `select-none` sur chaque bouton ci-dessous (retour utilisateur) : sans ça,
              le texte des libellés (ex. "Mes Séances") reste sélectionnable comme du
              texte normal, donc le curseur affiche un I-beam (texte éditable) au survol
              du label — trompeur pour un bouton, même si le clic fonctionnait déjà
              correctement partout. `cursor-pointer` ajouté en plus par sécurité (déjà
              le comportement par défaut d'un <button>, mais explicite plutôt qu'implicite). */}
          <nav className="flex-1 px-4 py-6 space-y-3 overflow-y-auto no-scrollbar">
            
            <button onClick={() => changeView('generator')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <Zap size={18} className={view === 'generator' ? 'text-white' : textColorClass} />
              <span className="font-bold text-sm">Générer</span>
            </button>

            {/* Sous-menu de "Générer" (retour direct : "personne ne le verra dans
                Options & Comptes", puis "j'imaginais ça en sous-menu de Générer") —
                indenté et en retrait visuel (pas de pastille pleine, icône/texte
                plus petits, léger décalage à gauche) pour bien signaler que ce
                n'est pas une section de même niveau que les autres, mais une
                sous-partie de "Générer" spécifiquement. Ouvre directement le
                panneau (voir showAthleticProfile, remonté dans App.jsx) plutôt que
                d'atterrir sur Générer avec le panneau encore replié. */}
            <button
              onClick={() => { changeView('generator'); setShowAthleticProfile(true); }}
              className={`w-full flex items-center space-x-2.5 pl-8 pr-3 py-2 rounded-lg transition-colors select-none cursor-pointer ${view === 'generator' && showAthleticProfile ?
                `${textColorClass} bg-gray-100 dark:bg-gray-800 font-bold` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}
            >
              <Gauge size={15} className="shrink-0" />
              <span className="text-xs font-semibold">Mon Profil Athlétique</span>
            </button>

            <button onClick={() => changeView('routines')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'routines' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <ListPlus size={18} />
              <span className="font-bold text-sm">Mes Routines</span>
            </button>
            
            <button onClick={() => changeView('playlists')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'playlists' ? `bg-gray-100 dark:bg-gray-800 ${textHighlight}` : `${textMuted} hover:bg-gray-100 dark:hover:bg-gray-800 hover:${textHighlight}`}`}>
              <List size={18} />
              <span className="font-bold text-sm">Mes Séances</span>
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
                setBpm={setBpm} setBpmManual={setBpmManual} setTargetMode={setTargetMode} setDistanceVal={setDistanceVal} setDistanceUnit={setDistanceUnit}
                setHours={setHours} setMinutes={setMinutes}
                targetMode={targetMode} isIntervalMode={isIntervalMode} isCrescendoMode={isCrescendoMode}
                structureMode={structureMode} setStructureMode={setStructureMode}
                crescendoWarmupPct={crescendoWarmupPct} setCrescendoWarmupPct={setCrescendoWarmupPct}
                crescendoCooldownPct={crescendoCooldownPct} setCrescendoCooldownPct={setCrescendoCooldownPct}
                CRESCENDO_MIN_MAIN_PCT={CRESCENDO_MIN_MAIN_PCT}
                crescendoWarmupBpm={crescendoWarmupBpm} setCrescendoWarmupBpm={setCrescendoWarmupBpm}
                crescendoCooldownBpm={crescendoCooldownBpm} setCrescendoCooldownBpm={setCrescendoCooldownBpm}
                applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}
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
                athleticProfile={athleticProfile} setBaseCadenceForActivity={setBaseCadenceForActivity} setZoneForActivity={setZoneForActivity}
                resetActivityProfile={resetActivityProfile} addCustomActivity={addCustomActivity} removeCustomActivity={removeCustomActivity}
                setBaseCadenceForCustom={setBaseCadenceForCustom} setZoneForCustom={setZoneForCustom} getProfileForWorkout={getProfileForWorkout}
                showAthleticProfile={showAthleticProfile} setShowAthleticProfile={setShowAthleticProfile}
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

            {/* ===================== VIEW: PLAYLISTS / MES SÉANCES ===================== */}
            {/* Fusionne planification (à venir) ET historique (terminées) sur un seul
                écran chronologique — voir PlaylistsView pour le détail des 3 sections.
                L'ancien onglet séparé "Historique" (HistoryView.jsx) a été retiré : il
                faisait doublon avec cette vue depuis que le système de planification/
                dates y a été intégré. Le fichier HistoryView.jsx n'est plus importé
                nulle part — à supprimer manuellement du disque au prochain audit (même
                remarque que pour useQueue.js/QueueView.jsx lors d'un chantier précédent). */}
            {view === 'playlists' && (
              <PlaylistsView
                theme={themeTokens} isNaughtyMode={isNaughtyMode}
                savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
                requestRemoveSavedPlaylist={requestRemoveSavedPlaylist}
                setPlaylistPlannedDate={setPlaylistPlannedDate}
                getRankStyle={getRankStyle} setCurrentPlaylist={setCurrentPlaylist} changeView={changeView}
                renderConfigInfoLine={renderConfigInfoLine} renderCompletionsList={renderCompletionsList}
                markPlaylistAsCompleted={markPlaylistAsCompleted}
              />
            )}

            {view === 'stats' && (
              <StatsView
                theme={themeTokens} savedPlaylists={savedPlaylists} userStats={userStats} changeView={changeView}
                setCurrentPlaylist={setCurrentPlaylist} athleticProfile={athleticProfile} getProfileForWorkout={getProfileForWorkout}
                shareImageFile={shareImageFileWithTrophy} showToast={showToast}
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
              <SettingsView
                theme={themeTokens} spotifyToken={spotifyToken} loginSpotify={loginSpotify} setSpotifyToken={setSpotifyToken}
              />
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
                handleSavePlaylist={handleSavePlaylist} handleUnsavePlaylist={requestUnsavePlaylist} handleShare={handleShare}
                shareImageFile={shareImageFileWithTrophy} showToast={showToast}
                currentActualData={currentActualData} selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric}
                analysisStats={analysisStats}
                selectedAnalysisDate={selectedAnalysisDate} setSelectedAnalysisDate={setSelectedAnalysisDate}
                formatCompletionDate={formatCompletionDate} availableMetrics={availableMetrics}
                dataOffset={dataOffset} setDataOffset={setDataOffset}
                chartAxisType={chartAxisType} setChartAxisType={setChartAxisType}
                chartDistanceUnit={chartDistanceUnit} setChartDistanceUnitOverride={setChartDistanceUnitOverride}
                selectedSegmentIdx={selectedSegmentIdx} setSelectedSegmentIdx={setSelectedSegmentIdx} trackSegments={trackSegments}
                togglePreview={togglePreview} playingPreviewId={playingPreviewId}
                unifiedChartData={unifiedChartData} handleChartClick={handleChartClick}
                handleChartMouseDown={handleChartMouseDown} handleChartMouseMove={handleChartMouseMove} handleChartMouseUp={handleChartMouseUp}
                isDraggingChartSegment={isDraggingChartSegment}
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
                setPlaylistPlannedDate={setPlaylistPlannedDate}
                markPlaylistAsCompleted={markPlaylistAsCompleted} renderCompletionsList={renderCompletionsList}
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

        {pendingNavigation && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPendingNavigation(null)}>
            <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className={"text-xl font-bold " + textHighlight}>Playlist non sauvegardée</h3>
                  <p className={"text-sm mt-1 " + textMuted}>Cette playlist n'a pas encore été sauvegardée — si tu quittes maintenant, elle sera définitivement perdue.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-6">
                <button onClick={() => resolvePendingNavigation(true)} className={"w-full px-6 py-3 text-white font-bold rounded-xl shadow-md " + bgAccentClass}>
                  Sauvegarder et continuer
                </button>
                <button onClick={() => resolvePendingNavigation(false)} className={"w-full px-6 py-3 font-bold rounded-xl border hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors " + cardBorder + " " + textHighlight}>
                  Continuer sans sauvegarder
                </button>
                <button onClick={() => setPendingNavigation(null)} className={"w-full px-6 py-3 font-medium hover:" + textHighlight + " " + textMuted}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingUnsavePlaylist && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPendingUnsavePlaylist(null)}>
            <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className={"text-xl font-bold " + textHighlight}>Retirer cette playlist ?</h3>
                  <p className={"text-sm mt-1 " + textMuted}>
                    {pendingUnsavePlaylist.completions && pendingUnsavePlaylist.completions.length > 0
                      ? `Elle a déjà été faite ${pendingUnsavePlaylist.completions.length}x`
                      : 'Elle a des données réelles importées (Garmin/Strava)'}
                    {' '}— la retirer effacera aussi définitivement cet historique.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-6">
                <button onClick={() => { removeSavedPlaylist(pendingUnsavePlaylist.id); setPendingUnsavePlaylist(null); }} className="w-full px-6 py-3 font-bold rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Retirer quand même
                </button>
                <button onClick={() => setPendingUnsavePlaylist(null)} className={"w-full px-6 py-3 font-medium hover:" + textHighlight + " " + textMuted}>
                  Annuler
                </button>
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
              <input type="text" value={tempCustomActivity} onChange={e => setTempCustomActivity(e.target.value)} placeholder="Ex: Yoga..." className={"w-full rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-red-500 mb-8 border " + inputBg + " " + inputBorder + " " + textHighlight} autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setCustomActivity(tempCustomActivity); setIsCustomActivityModalOpen(false); if (!isNaughtyMode) applyProfileBpmIfUntouched(getProfileForWorkout('Autre', tempCustomActivity)); } }} />
              <div className="flex justify-end space-x-3">
                <button onClick={() => setIsCustomActivityModalOpen(false)} className={"px-6 py-3 font-medium hover:" + textHighlight + " " + textMuted}>Annuler</button>
                <button onClick={() => {
                  setCustomActivity(tempCustomActivity);
                  setIsCustomActivityModalOpen(false);
                  // Même pré-remplissage BPM que Course à pied/Cyclisme à
                  // l'étape 1 (voir applyProfileBpmIfUntouched,
                  // useGeneratorForm.js) — pour une activité personnalisée,
                  // le nom n'est connu qu'à cette confirmation, pas au moment
                  // où "Autre" est cliqué (voir GeneratorView.jsx, où le nom
                  // n'existe pas encore à ce stade).
                  if (!isNaughtyMode) applyProfileBpmIfUntouched(getProfileForWorkout('Autre', tempCustomActivity));
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
                  <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={editingRoutine.bpm} onChange={e => setEditingRoutine({...editingRoutine, bpm: parseInt(e.target.value)})} className={`w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className={`text-sm font-bold ${textMuted}`}>Marge d'erreur</label>
                    <span className={`text-sm font-black ${textColorClass}`}>± {editingRoutine.bpmTolerance} BPM</span>
                  </div>
                  <input type="range" min="0" max="30" value={editingRoutine.bpmTolerance} onChange={e => setEditingRoutine({...editingRoutine, bpmTolerance: parseInt(e.target.value)})} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ? 'accent-rose-500' : 'accent-red-500'}`} />
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
                          {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
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
                            {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {editingRoutine.isIntervalMode && (
                  editingRoutine.isCrescendoMode ? (
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <label className={`text-sm font-bold ${textMuted}`}>Répartition de l'effort</label>
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-sky-500 dark:text-sky-400">Échauffement {editingRoutine.crescendoWarmupPct ?? 15}%</span>
                          <span className={textColorClass}>Cœur {100 - (editingRoutine.crescendoWarmupPct ?? 15) - (editingRoutine.crescendoCooldownPct ?? 15)}%</span>
                          <span className="text-emerald-500 dark:text-emerald-400">Retour au calme {editingRoutine.crescendoCooldownPct ?? 15}%</span>
                        </div>
                        <DualRangeSlider
                          leftValue={editingRoutine.crescendoWarmupPct ?? 15} rightValue={editingRoutine.crescendoCooldownPct ?? 15} minMiddle={CRESCENDO_MIN_MAIN_PCT}
                          onChangeLeft={(val) => setEditingRoutine({ ...editingRoutine, crescendoWarmupPct: val })}
                          onChangeRight={(val) => setEditingRoutine({ ...editingRoutine, crescendoCooldownPct: val })}
                          leftColorClass="bg-sky-400 dark:bg-sky-500" middleColorClass={bgAccentClass} rightColorClass="bg-emerald-400 dark:bg-emerald-500"
                          leftHandleBorderClass="border-sky-500" rightHandleBorderClass="border-emerald-500"
                          leftAriaLabel="Part de l'échauffement" rightAriaLabel="Part du retour au calme"
                        />
                      </div>

                      <div className="space-y-2">
                        <p className={`text-xs ${textMuted}`}>BPM personnalisé pour ces 2 phases :</p>

                        <div className={`space-y-4 p-3 rounded-xl ${inputBg} border ${inputBorder}`}>
                            {/* Même correctif que dans le wizard (GeneratorView.jsx) : griser
                                plutôt que laisser un BPM "actif" trompeur quand la part de cette
                                phase est à 0%. */}
                            <div className={(editingRoutine.crescendoWarmupPct ?? 15) === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-sky-500 dark:text-sky-400">BPM Échauffement{(editingRoutine.crescendoWarmupPct ?? 15) === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{editingRoutine.crescendoWarmupBpm}</span>
                              </div>
                              <input
                                type="range" min={isNaughtyMode ? 40 : 80} max={editingRoutine.bpm}
                                value={editingRoutine.crescendoWarmupBpm ?? (isNaughtyMode ? 40 : 80)}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || (isNaughtyMode ? 40 : 80);
                                  setEditingRoutine(prev => ({
                                    ...prev,
                                    crescendoWarmupBpm: val,
                                    crescendoCooldownBpm: (prev.crescendoCooldownBpm != null && prev.crescendoCooldownBpm > val) ? val : prev.crescendoCooldownBpm,
                                  }));
                                }}
                                disabled={(editingRoutine.crescendoWarmupPct ?? 15) === 0}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none accent-sky-500 disabled:cursor-not-allowed"
                              />
                            </div>
                            <div className={(editingRoutine.crescendoCooldownPct ?? 15) === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">BPM Retour au calme{(editingRoutine.crescendoCooldownPct ?? 15) === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{editingRoutine.crescendoCooldownBpm}</span>
                              </div>
                              <input
                                type="range" min={isNaughtyMode ? 40 : 80} max={editingRoutine.crescendoWarmupBpm ?? editingRoutine.bpm}
                                value={editingRoutine.crescendoCooldownBpm ?? (isNaughtyMode ? 40 : 80)}
                                onChange={(e) => setEditingRoutine({ ...editingRoutine, crescendoCooldownBpm: parseInt(e.target.value) || (isNaughtyMode ? 40 : 80) })}
                                disabled={(editingRoutine.crescendoCooldownPct ?? 15) === 0}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none accent-emerald-500 disabled:cursor-not-allowed"
                              />
                            </div>
                        </div>
                      </div>

                      <p className={`text-[11px] ${textMuted}`}>Les 3 portions se recalculent automatiquement selon ces réglages.</p>
                    </div>
                  ) : (
                    <div className={`text-xs p-3 rounded-xl ${inputBg} border ${inputBorder} ${textMuted}`}>
                      Cette routine est en mode Fractionné : les portions détaillées ne sont pas éditables depuis cette fenêtre pour l'instant. Les réglages ci-dessus (BPM, genres, marge d'erreur) s'appliqueront quand même à l'ensemble des portions.
                    </div>
                  )
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
