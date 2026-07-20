import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Clock, Music, Check, X, Heart, Loader2, AlertCircle, Zap, Menu, Edit3, Trophy, Upload, User as UserIcon } from 'lucide-react';
import { ARTIST_CATALOG, EXTRA_GENRES, WEAK_DEEZER_KEYWORD_GENRES, normalizeGenreForDisplay, genreDisplayLabel } from './musicCatalog';
import { NAUGHTY_ROUTINE_NAMES, getZoneForValue, ATHLETIC_ZONES, DISTRIBUTION_COLORS } from './appConfig';

// =====================================================================================
// CONSTANTES GLOBALES & CONFIGURATION
// =====================================================================================

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
import { decodePlaylistFromSharing } from './utils/playlistShareCode';
import { parseGarminCsv } from './workoutDataEngine';
import { useTheme } from './hooks/useTheme';
import { usePersistentState } from './hooks/usePersistentState';
import { useToast } from './hooks/useToast';
import { useCustomActivity } from './hooks/useCustomActivity';
import { useGeneratorForm } from './hooks/useGeneratorForm';
import { useTrackSearch } from './hooks/useTrackSearch';
import { useDeezerSearch } from './hooks/useDeezerSearch';
import { useFavorites } from './hooks/useFavorites';
import { useSpotifyImport } from './hooks/useSpotifyImport';
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
import CustomActivityModal from './components/modals/CustomActivityModal';
import ImportSharedPlaylistModal from './components/modals/ImportSharedPlaylistModal';
import DiscoverView from './components/views/DiscoverView';
import MiniPlayerBar from './components/shared/MiniPlayerBar';
import SavingRoutineModal from './components/modals/SavingRoutineModal';
import ShareModal from './components/modals/ShareModal';
import AuthModal from './components/modals/AuthModal';
import { useAuthContext } from './contexts/AuthContext';
import IconPickerModal from './components/modals/IconPickerModal';
import PendingNavigationModal from './components/modals/PendingNavigationModal';
import PendingUnsaveModal from './components/modals/PendingUnsaveModal';
import SearchModal from './components/modals/SearchModal';
import EditRoutineModal from './components/modals/EditRoutineModal';
import Sidebar from './components/shared/Sidebar';
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
  // Genre/tranche BPM actuellement "ouvert(s)" dans les donuts de la page
  // Statistiques (clic sur une part = aperçu ciblé dessous) — voir plus bas
  // pour le détail. RETOUR DIRECT ("faut pouvoir sélectionner plusieurs
  // zones graphiques à la fois, pareil partout où y a les camemberts") :
  // `Set` plutôt qu'une valeur unique, même changement que
  // PlaylistDetailView.jsx (selectedDetailGenre/selectedDetailBpmBucket) —
  // plusieurs parts du MÊME camembert sélectionnables ensemble.
  const [selectedStatsGenre, setSelectedStatsGenre] = useState(() => new Set());
  const [selectedStatsBpmBucket, setSelectedStatsBpmBucket] = useState(() => new Set());
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
  // --- MOTEUR SPOTIFY : extrait dans hooks/useSpotifyImport.js (retour
  //     direct : "comment tu diviserais App.jsx ?" — après les 8 modales,
  //     ce module était le 2e chantier identifié). Le hook est appelé plus
  //     bas, APRÈS useFavorites (dont il a besoin : `setFavorites`). ---


  const [isNaughtyMode, setIsNaughtyMode] = useState(false);
  const { toast, showToast } = useToast();

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

  // MOTEUR SPOTIFY (voir hooks/useSpotifyImport.js) — appelé ICI, après
  // useFavorites, parce qu'il a besoin de `setFavorites` (la synchro fusionne
  // les titres likés/artistes suivis dans les favoris existants).
  const { spotifyToken, setSpotifyToken, spotifyTrackPool, setSpotifyTrackPool, loginSpotify, syncSpotifyFavorites, REDIRECT_URI } = useSpotifyImport(setFavorites, showToast);

  // RETOUR DIRECT ("supprime tout ce qui ne sert plus à rien niveau Deezer")
  // — le moteur Deezer Connect (login/synchro favoris, symétrique à
  // useSpotifyImport ci-dessus) a été retiré ici : Deezer n'accepte plus de
  // nouvelles inscriptions d'application développeur, impossible d'obtenir
  // les identifiants nécessaires pour ce flow. Voir DEEZER-CONNECT-REMOVED.md
  // (racine du projet) pour le détail complet et comment le reconstruire si
  // Deezer rouvre un jour les inscriptions. Le CATALOGUE Deezer (recherche
  // de titres, résolution BPM — musicEngine.js, api/deezer.js) n'est PAS
  // concerné, continue de fonctionner normalement.

  // COMPTE UTILISATEUR (voir contexts/AuthContext.jsx) — email/mot de passe
  // pour commencer (voir la discussion qui a mené à ce chantier). `user`/
  // `authLoading` sont déjà lus directement par usePersistentState.js (voir
  // ce fichier) pour la synchro — ici, on n'a besoin que de `signUp`/
  // `signIn`/`signOut` pour les passer à AuthModal/SettingsView, et de
  // `isAuthModalOpen` (state propre à CETTE vue, pas au contexte global).
  const { user, signUp, signIn, signOut, isSupabaseConfigured, userCount } = useAuthContext();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // RETOUR DIRECT ("pas de message d'erreur quand je clique sur un lien
  // expiré ?") — Supabase redirige bien vers l'app avec le détail de
  // l'erreur (lien de confirmation expiré/déjà utilisé, etc.), mais dans le
  // HASH de l'URL (`#error=access_denied&error_code=otp_expired&
  // error_description=...`), jamais lu ni affiché nulle part jusqu'ici —
  // l'utilisateur retombait silencieusement sur l'accueil, sans savoir si sa
  // confirmation avait marché ou pas. Lu UNE SEULE FOIS au montage (ce hash
  // n'apparaît que juste après une redirection Supabase, jamais en usage
  // normal de l'app), puis nettoyé de l'URL pour ne pas re-déclencher ce
  // toast à chaque rafraîchissement de la page.
  useEffect(() => {
    if (!window.location.hash.includes('error=')) return;
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorCode = hashParams.get('error_code');
    if (errorCode === 'otp_expired') {
      showToast("❌ Ce lien de confirmation a expiré ou a déjà été utilisé — redemande-en un nouveau.", 'error');
    } else {
      const description = hashParams.get('error_description');
      showToast(`❌ ${description ? decodeURIComponent(description.replace(/\+/g, ' ')) : 'Erreur de confirmation du compte.'}`, 'error');
    }
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RETOUR DIRECT ("rendre le lien de partage réellement importable, sans
  // feed communautaire complet") — détecte `?import=...` (voir useShare.js,
  // playlistShareCode.js) au montage, une seule fois. `importedPlaylistPreview`
  // reste le payload DÉCODÉ tel quel (clés courtes ti/ar/bp/du...), pas
  // encore une vraie playlist — voir `importSharedPlaylist` plus bas, qui
  // fait la conversion au moment du clic sur "Ajouter à Mes Séances", pas ici
  // (pas besoin de la construire avant que l'utilisateur confirme vouloir
  // l'ajouter).
  const [importedPlaylistPreview, setImportedPlaylistPreview] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('import');
    if (!code) return;

    const decoded = decodePlaylistFromSharing(code);
    if (decoded) {
      setImportedPlaylistPreview(decoded);
      setIsImportModalOpen(true);
    } else {
      showToast("❌ Ce lien de playlist est invalide ou corrompu.", 'error');
    }
    // Nettoie l'URL dans les 2 cas (valide ou pas) — évite de re-proposer le
    // même import à chaque rafraîchissement de la page.
    window.history.replaceState({}, document.title, window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Profil Athlétique (BPM cibles par zone d'effort) — voir useAthleticProfile.js.
  // Pas encore connecté au générateur ni aux stats à ce stade (étape 1/2 du
  // plan : modèle de données + interface Réglages d'abord) ; `athleticProfile`
  // est déjà exposé aux autres vues dès maintenant pour que le branchement
  // des étapes suivantes n'ait qu'à consommer ce state, pas à le redéfinir.
  const {
    athleticProfile, setAthleticProfile,
    computeZonesFromBaseBpm, getDefaultBaseBpm, buildDefaultPreviewProfile, getZoneSpacingForActivity,
    setBaseBpmForActivity, setZoneForActivity, resetActivityProfile,
    addCustomActivity, removeCustomActivity, setBaseBpmForCustom, setZoneForCustom, getProfileForWorkout,
    getProfileForWorkoutOrDefault,
    setCadenceIntentForActivity, setCadenceIntentForCustom, isCadenceIntentEligible,
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
    name: 'Exemple : Session Rock/Métal',
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

  /**
   * Transforme le payload décodé (voir playlistShareCode.js — clés courtes,
   * aucun historique personnel) en une VRAIE playlist de l'app, exactement
   * dans la même forme que celles produites par createPlaylistData
   * (musicEngine.js) — même `recalculateTimeline` réutilisé pour calculer
   * `startTimeStr`/`startDistVal`/`totalDuration`, plutôt que de les deviner
   * à la main ici.
   *
   * Repart TOUJOURS à zéro : nouvel id, `createdAt` d'aujourd'hui,
   * `completions`/`actualDataByDate` vides, `status: 'pending'` — importer
   * la playlist de quelqu'un d'autre n'importe JAMAIS son historique
   * d'utilisation, seulement sa structure (titres, BPM, activité).
   */
  const importSharedPlaylist = () => {
    if (!importedPlaylistPreview) return;
    const preview = importedPlaylistPreview;

    const genres = Array.from(new Set(preview.tracks.map(t => t.ge).filter(Boolean)));
    const avgBpm = Math.round(preview.tracks.reduce((s, t) => s + (t.bp || 0), 0) / preview.tracks.length) || 120;

    const rawPlaylist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${preview.name} (importée)`,
      workoutType: preview.workoutType || 'Autre',
      avgPace: preview.avgPace, targetMode: preview.targetMode, distanceUnit: preview.distanceUnit,
      tolerance: preview.tolerance, crossfade: preview.crossfade,
      tracks: preview.tracks.map(t => ({
        title: t.ti, artist: t.ar, bpm: t.bp, duration: t.du,
        genre: t.ge || 'Genre inconnu',
        // Réutilise le même identifiant que la playlist d'origine si présent
        // (c'est le titre lui-même qu'il désigne, ex. "deezer-12345" — pas un
        // marqueur de propriété, plusieurs playlists de comptes différents
        // peuvent légitimement pointer vers le même titre). Repli sur un
        // identifiant généré UNIQUEMENT si absent du payload.
        youtubeId: t.id || `imported-${Math.random().toString(36).slice(2)}`,
        preview: t.pv || null,
      })),
      isNaughty: false, fallbackTrackCount: 0,
      coverIcon: preview.coverIcon || '🎧', createdAt: new Date().toLocaleDateString(),
      status: 'pending', actualDataByDate: {},
      config: { workoutName: preview.workoutType, targetMode: preview.targetMode, bpm: avgBpm, tolerance: preview.tolerance, selectedGenres: genres.length ? genres : ['Autre'] },
    };

    const finalPlaylist = recalculateTimeline(rawPlaylist);
    setSavedPlaylists(prev => [finalPlaylist, ...prev]);
    setIsImportModalOpen(false);
    setImportedPlaylistPreview(null);
    showToast("✅ Playlist ajoutée à Mes Séances !");
    setCurrentPlaylist(finalPlaylist);
    changeView('playlist');
  };

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
  // RETOUR DIRECT ("insérer le bilan image directement dans l'option de
  // partage, avec une croix pour le retirer") — état de la génération en
  // arrière-plan du Bilan Visuel de Séance, vécu ICI (pas dans
  // PlaylistDetailView.jsx) parce que ShareModal, qui doit le LIRE pour
  // afficher l'aperçu, est rendu une seule fois globalement dans App.jsx —
  // pas à l'intérieur de PlaylistDetailView. La génération elle-même (qui a
  // besoin d'une réf DOM sur la carte hors-écran) reste dans
  // PlaylistDetailView.jsx, qui reçoit ces setters en props pour y écrire le
  // résultat au fur et à mesure.
  const [summaryImageStatus, setSummaryImageStatus] = useState('idle'); // idle | loading | ready | error
  const [summaryImageFile, setSummaryImageFile] = useState(null);
  const [summaryImagePreviewUrl, setSummaryImagePreviewUrl] = useState(null);
  const [includeSummaryImage, setIncludeSummaryImage] = useState(true);

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
  // `useTrackSearch()` regroupe l'ÉTAT (texte tapé, résultats, pagination...),
  // `useDeezerSearch(search, ...)` la LOGIQUE qui l'utilise (voir
  // hooks/useDeezerSearch.js — retour direct : "prends du recul, regarde si
  // ça vaut le coup" sur une note précédente jugeant tout ce bloc trop
  // risqué à extraire, qui s'est avérée trop large une fois relue en
  // détail). Capturé une seule fois dans `search` (appel UNIQUE du hook,
  // jamais 2 fois — sinon 2 états indépendants) puis déstructuré, pour
  // pouvoir à la fois garder les noms courts utilisés partout ailleurs dans
  // ce fichier ET passer l'objet complet à useDeezerSearch.
  const search = useTrackSearch();
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
  } = search;
  // Chrono affiché pendant le chargement — repart de 0 à chaque nouvelle
  // recherche, incrémente chaque seconde tant que isWorldSearching est vrai.
  const searchElapsedSeconds = useElapsedTimer(isWorldSearching);
  // Édition du nom d'une playlist générée — avant, le nom auto-généré (ex. "Depuis :
  // 🏃‍♂️ Mon 5km Quotidien") n'était jamais modifiable, ce qui devenait vite peu
  // pratique pour s'y retrouver une fois plusieurs playlists sauvegardées.
  const [isEditingPlaylistName, setIsEditingPlaylistName] = useState(false);
  const [editedPlaylistName, setEditedPlaylistName] = useState("");

  // --- Lecture des extraits audio (30s, fournis par Deezer) ---
  const {
    playingPreviewId, togglePreview,
    currentTrack: currentPreviewTrack, isPlaying: isPreviewPlaying,
    pauseCurrentPreview, resumeCurrentPreview, stopCurrentPreview,
  } = useAudioPreview(showToast);

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
  // RETOUR DIRECT ("prends du recul, regarde si ça vaut le coup" — sur une
  // note de session précédente jugeant tout le bloc "recherche Deezer" trop
  // risqué à extraire) : relu en détail, seule `renderSearchResultRow`
  // (juste en dessous) touchait vraiment plusieurs domaines (favoris,
  // playlist en cours, lecture audio) — les 4 autres fonctions ne
  // dépendaient QUE de l'état de recherche + showToast + isNaughtyMode,
  // extraites sans risque dans hooks/useDeezerSearch.js.
  const { searchWorldMusicApi, commitBpmEdit, closeSearchModal, searchTracksByBpm } = useDeezerSearch(search, showToast, isNaughtyMode);

  // renderSearchResultRow : déplacée dans SearchModal.jsx (retour direct :
  // "continue avec renderSearchResultRow" — elle produit du JSX propre à
  // cette modale, ça n'avait pas de sens qu'elle vive ailleurs que là où
  // elle s'affiche). Ses dépendances (favoris, playlist en cours, lecture
  // audio...) sont maintenant passées en props à SearchModal directement.

  // closeSearchModal, searchTracksByBpm : voir hooks/useDeezerSearch.js (même
  // hook call que searchWorldMusicApi/commitBpmEdit, plus haut).

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
    // BUG CORRIGÉ (retour direct : "je ne peux plus revenir dans Générer après
    // avoir cliqué sur Mon Profil Athlétique") — `showAthleticProfile` bascule
    // GeneratorView entre 2 pages mutuellement exclusives (le profil ou le
    // wizard, voir section 4 de la passation), mais rien ne le remettait
    // jamais à `false` en repartant vers 'generator'. Comme `view` valait déjà
    // 'generator' une fois sur la page profil, cliquer sur le bouton "Générer"
    // de la sidebar ne faisait que re-régler `view` sur la même valeur —
    // `showAthleticProfile` restait bloqué à `true` pour toujours, quel que
    // soit le point d'entrée (sidebar, ou n'importe quel CTA "Créer une
    // playlist" ailleurs dans l'app qui appelle aussi `changeView('generator')`
    // — PlaylistsView/RoutinesView/StatsView). Recalé ici, à la racine,
    // plutôt que dans chaque bouton séparément. Le bouton "Mon Profil
    // Athlétique" (voir plus bas) rappelle `setShowAthleticProfile(true)`
    // juste après son propre `changeView('generator')` — React regroupe les 2
    // mises à jour du même clic, la dernière (`true`) l'emporte, donc ce cas
    // précis n'est pas cassé par ce reset.
    if (newView === 'generator') { setWizardStep(1); setShowAthleticProfile(false); }
  };

  /**
   * PIVOT PRODUIT (retour direct) — remplace `applyTemplateToGenerator`
   * (ancienne version, pré-remplissait le formulaire du générateur). Un
   * modèle de séance ensemencé est maintenant une VRAIE playlist figée (voir
   * data/curatedSessions.js, `tracks`) : injectée directement dans
   * `currentPlaylist` et ouverte sur PlaylistDetailView, exactement comme
   * une playlist fraîchement générée ou importée via lien partagé (voir
   * `importSharedPlaylist`, même fichier, même principe de reconstruction
   * via `recalculateTimeline` plutôt que deviner `startTimeStr`/
   * `totalDuration` à la main). Pas encore dans `savedPlaylists` — comme
   * pour une génération classique, c'est au clic sur "Sauvegarder"
   * (PlaylistDetailView, déjà existant) que ça devient permanent.
   */
  const openCuratedPlaylist = (template) => {
    const avgBpm = Math.round(template.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / template.tracks.length) || 120;
    const genres = Array.from(new Set(template.tracks.map(t => t.genre).filter(Boolean)));

    const rawPlaylist = {
      id: `pl-curated-${template.id}-${Date.now()}`,
      name: template.title,
      workoutType: template.workoutType,
      avgPace: 330, targetMode: 'time', distanceUnit: 'km',
      tolerance: 10, crossfade: 2,
      tracks: template.tracks.map(t => ({ ...t })),
      isNaughty: false, fallbackTrackCount: 0,
      coverIcon: '🎧', createdAt: new Date().toLocaleDateString(),
      status: 'pending', actualDataByDate: {},
      config: { workoutName: template.workoutType, targetMode: 'time', bpm: avgBpm, selectedGenres: genres.length ? genres : ['Autre'] },
    };

    const finalPlaylist = recalculateTimeline(rawPlaylist);
    setCurrentPlaylist(finalPlaylist);
    changeView('playlist');
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
  //
  // RETOUR DIRECT (capture d'écran à l'appui, avec un Profil Athlétique déjà
  // configuré) : "ni les mêmes valeurs ni les mêmes couleurs" que le Profil
  // Athlétique (145/160/175/190 BPM, couleurs zone1-4) — ce camembert
  // utilisait un découpage GÉNÉRIQUE en tranches de 20 BPM alignées sur des
  // multiples de 20 (120-139, 140-159...), coloré par simple INDEX dans une
  // palette arc-en-ciel fixe (`DISTRIBUTION_COLORS`, PlaylistDetailView.jsx),
  // sans aucun lien avec `ATHLETIC_ZONES`/`getZoneForValue` — la même
  // incohérence déjà corrigée ailleurs (SessionSummaryCard.jsx, le camembert
  // "Tes zones" de StatsView, le visuel Crescendo) avait été oubliée sur CE
  // graphique précis, propre à la fiche d'une séance.
  //
  // Corrigé en réutilisant `getZoneForValue` : classe chaque titre dans sa
  // VRAIE zone si un profil est configuré pour cette activité — même
  // logique/mêmes couleurs que partout ailleurs (`ATHLETIC_ZONES`, ordre
  // Récupération → Vitesse). Repli sur l'ancien découpage générique
  // UNIQUEMENT si aucun profil n'est configuré pour cette activité
  // (`matchedAnyZone` reste `false`) — jamais un graphique vide juste parce
  // que l'utilisateur n'a pas rempli son Profil Athlétique. Le `color` est
  // maintenant porté par chaque entrée de donnée plutôt que recalculé par
  // INDEX côté PlaylistDetailView (qui n'a aucun moyen de savoir si une
  // entrée vient d'une zone ou d'une tranche générique).
  // RETOUR DIRECT ("le jargon 'effort' (Récupération/Seuil) a-t-il un sens
  // avec une estimation par défaut, ou vaut-il mieux montrer des tranches de
  // BPM brutes dans ce cas ?") — revient à `getProfileForWorkout` (strict) :
  // le mode Synchro (voir plus bas, `cadenceIntent`) applique déjà cette
  // même règle (`getProfileForWorkoutOrDefault` ne bascule en 'sync' que si
  // `isConfigured` est vrai, jamais avec l'estimation par défaut) — ce
  // graphique suivait une règle différente, moins stricte, incohérente avec
  // ça. Le jargon "effort" prétend connaître TA zone réelle ; sans profil
  // réellement configuré, ce n'est qu'une formule générique habillée en
  // fausse personnalisation. Repli sur les tranches brutes (code déjà en
  // place plus bas, jamais retiré) — honnête sur ce que c'est vraiment.
  const bpmDistributionData = useMemo(() => {
    if (!currentPlaylist) return [];
    const activityName = isNaughtyMode
      ? (currentPlaylist.config?.workoutName || currentPlaylist.workoutType || 'Autre')
      : (currentPlaylist.workoutType || 'Autre');

    const zoneSeconds = {};
    let matchedAnyZone = false;
    currentPlaylist.tracks.forEach(t => {
      if (!t.bpm) return;
      const zone = getZoneForValue(t.bpm, activityName, getProfileForWorkout);
      if (zone) {
        matchedAnyZone = true;
        zoneSeconds[zone.key] = (zoneSeconds[zone.key] || 0) + (t.duration || 0);
      }
    });
    if (matchedAnyZone) {
      return ATHLETIC_ZONES
        .filter(z => zoneSeconds[z.key] > 0)
        .map(z => ({ name: z.shortLabel, value: zoneSeconds[z.key], color: z.color }));
    }

    const buckets = {};
    currentPlaylist.tracks.forEach(t => {
      const bucketStart = Math.floor(t.bpm / 20) * 20;
      const label = `${bucketStart}-${bucketStart + 19}`;
      buckets[label] = (buckets[label] || 0) + t.duration;
    });
    return Object.entries(buckets)
      .map(([name, value], i) => ({ name, value, sortKey: parseInt(name), color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [currentPlaylist, isNaughtyMode, getProfileForWorkout]);

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

  // RETOUR DIRECT (capture d'écran, 2 tours de suite) : "la date est écrite
  // 2 fois (en-tête + pastille du bas), inutile de garder l'option du bas —
  // je dois pouvoir modifier la date depuis celle du HAUT". L'en-tête
  // n'affichait jusqu'ici QUE `completions[0]` en texte statique, jamais
  // éditable — toute édition de date passait forcément par la pastille du
  // bas (`renderCompletionsList`). Ce helper la rend éditable directement,
  // en réutilisant le MÊME state `editingCompletion`/`editCompletionDate`
  // que la pastille (une seule logique d'édition de date dans toute l'app,
  // pas une 2e copiée pour l'en-tête) — seul le format d'affichage change
  // (long : "18 juil. 2026", cohérent avec le style de sur-titre existant,
  // vs court "18/07/2026" dans les pastilles).
  //
  // Ne gère QUE `completions[0]` (la première réalisation) — volontairement,
  // pas toutes les dates : une playlist rejouée plusieurs fois a plusieurs
  // dates, l'en-tête n'a la place/le sens d'en montrer qu'une. Les autres
  // restent gérables individuellement dans la pastille du bas, qui exclut
  // maintenant `completions[0]` pour ne plus la répéter (voir
  // PlaylistDetailView.jsx, l'appel à `renderCompletionsList` passe
  // `skipDates={[currentPlaylist.completions[0]]}`).
  const renderTopCompletionDate = (playlist) => {
    const iso = playlist.completions?.[0];
    if (!iso) return null;
    const isEditing = editingCompletion && editingCompletion.playlistId === playlist.id && editingCompletion.isoDate === iso;
    if (isEditing) {
      return (
        <input
          type="date" autoFocus defaultValue={iso}
          onBlur={(e) => { editCompletionDate(playlist.id, iso, e.target.value); setEditingCompletion(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCompletion(null); }}
          className={`px-2 py-1 rounded-lg text-xs font-bold normal-case tracking-normal ${inputBg} border ${borderAccentClass} ${textHighlight}`}
        />
      );
    }
    const longLabel = new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    // RETOUR DIRECT ("pas complètement intuitif qu'on peut modifier la date —
    // ajoute une indication visuelle, genre le crayon du titre") — avant,
    // seul un `hover:underline` signalait que c'était cliquable : invisible
    // tant qu'on n'a pas déjà survolé (donc inutile pour DÉCOUVRIR que c'est
    // modifiable), et carrément absent au toucher (mobile/tablette, où
    // "hover" n'existe pas). Corrigé avec 2 indices TOUJOURS visibles,
    // jamais seulement au survol :
    //   - un soulignement POINTILLÉ sur la date (convention "texte éditable
    //     en ligne", déjà utilisée par des apps comme Notion/Linear) ;
    //   - la MÊME icône crayon que celle du titre juste en dessous (Edit3),
    //     pour que le geste "il y a un crayon à côté = je peux modifier ce
    //     texte" soit reconnu une seule fois puis réutilisé partout dans la
    //     page, plutôt qu'un nouveau signal à apprendre.
    // Le survol reste utile en PLUS (couleur qui se renforce), pas comme
    // seul indice.
    // RETOUR DIRECT ("'Réalisée le' me semble de trop, autant juste laisser
    // la date") — retiré : le contexte immédiat (juste à côté du badge
    // "Verrouillée", lui-même juste avant "Planifier à nouveau") suffit à
    // lire "date à laquelle c'est arrivé" sans le répéter en toutes lettres
    // — même logique déjà appliquée à "Planifier à nouveau" juste à côté,
    // qui affiche sa date SANS "Planifiée le" devant une fois choisie.
    // RETOUR DIRECT ("les pointillés sous la date ne semblent pas utiles, il
    // y a déjà l'infobulle et le crayon") — 3 indices, c'était un de trop :
    // le crayon (Edit3, toujours visible) suffit déjà à signaler "modifiable"
    // au même titre que celui du titre juste en dessous, et le `title`
    // (tooltip "Modifier cette date") reste dispo au survol. Le soulignement
    // pointillé retiré ici — la couleur qui se renforce au survol
    // (group-hover/date:text-main) reste comme seul retour visuel du survol.
    return (
      <button
        onClick={() => setEditingCompletion({ playlistId: playlist.id, isoDate: iso })}
        className={`inline-flex items-center gap-1 group/date`}
        title="Modifier cette date"
      >
        {/* `text-main` en dur (pas `${textHighlight}` interpolé dans le nom de
            variant) : Tailwind scanne le code SOURCE pour repérer les noms de
            classes à générer — une classe reconstruite au runtime via
            template literal (`group-hover/date:${textHighlight}`) n'apparaît
            jamais telle quelle dans le code, donc jamais générée. `textHighlight`
            vaut toujours littéralement "text-main" depuis le Design System
            sémantique (voir useTheme.js) — mais ça reste une variable, pas un
            littéral, donc dangereux à interpoler dans un préfixe de variant. */}
        <span className="group-hover/date:text-main">{longLabel}</span>
        <Edit3 size={11} className="opacity-60 group-hover/date:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  };

  // RETOUR DIRECT (capture d'écran à l'appui) : "pourquoi garder la petite
  // icône d'import quand il y a déjà la grosse en bas ?" — sur
  // PlaylistDetailView.jsx, le gros bouton "Complète ta séance" cible
  // TOUJOURS `mostRecentCompletionIso` (voir plus bas dans ce fichier) ; pour
  // CETTE date précise, la petite icône de la liste faisait doublon pur.
  // Mais cette même liste sert AUSSI sur PlaylistCard.jsx (grille "Mes
  // Séances"), où il n'y a PAS de gros bouton — impossible de juste
  // supprimer l'icône partout, seulement là où elle est vraiment redondante.
  // `hideUploadForDate` (optionnel, `null` par défaut = rien de caché) :
  // l'appelant indique QUELLE date est déjà couverte par un CTA plus gros
  // ailleurs sur l'écran ; seule cette icône-là disparaît (date + bouton
  // "retirer" restent, pour garder la cohérence visuelle de la pastille).
  // `skipDates` (optionnel, tableau vide par défaut) : dates à ne PAS
  // afficher DU TOUT dans cette liste — sert à exclure `completions[0]`
  // quand l'en-tête (`renderTopCompletionDate`) la montre déjà, pour ne plus
  // la répéter une 2e fois (retour direct : "la date est écrite 2 fois").
  const renderCompletionsList = (playlist, hideUploadForDate = null, skipDates = []) => {
    const completions = (playlist.completions || []).filter(iso => !skipDates.includes(iso));
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
                  analyse Cible vs Réalité différente pour chaque date. Absent si
                  `hideUploadForDate` couvre déjà cette date (voir plus haut). */}
              {iso !== hideUploadForDate && (
                <button
                  onClick={(e) => triggerCSVUpload(e, playlist, iso)}
                  className={hasData ? "text-purple-500 hover:text-purple-600 transition-colors" : "text-gray-400 hover:text-blue-500 transition-colors"}
                  title={hasData ? "Données déjà importées — cliquer pour remplacer" : "Importer Garmin/Strava (cadence/FC)"}
                >
                  <Upload size={12}/>
                </button>
              )}
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
    <div className={`${theme === 'dark' ? 'dark' : ''} ${isNaughtyMode ? 'naughty' : ''}`}>
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
        {/* RETOUR DIRECT ("le bouton pour se connecter devrait être en haut à
            droite, pas caché dans un onglet") — jusqu'ici, la seule façon de
            se connecter était de naviguer jusqu'à Options & Comptes. Ajouté
            ici, à côté du trophée (même coin, même style visuel — rounded-full,
            ombre, bordure), visible sur TOUTES les pages plutôt que dans un
            seul onglet peu fréquenté. Déconnecté → bouton "Se connecter" avec
            libellé (c'est un appel à l'action, contrairement au trophée qui
            n'est qu'un indicateur de statut passif — mérite d'être nommé,
            pas juste une icône). Connecté → pastille avec l'initiale de
            l'email, renvoie vers Options & Comptes pour se déconnecter ou
            voir le détail (pas de nouveau menu déroulant à construire pour
            un cas déjà bien couvert là-bas). */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[60] flex items-center gap-2">
          {isSupabaseConfigured && (
            user ? (
              <button
                onClick={() => changeView('settings')}
                title={user.email}
                className="w-11 h-11 rounded-full shadow-lg border hover:scale-110 transition-transform flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 border-green-200 dark:border-green-700/50 font-bold"
              >
                {user.email.charAt(0).toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className={`px-4 py-2.5 rounded-full shadow-lg border hover:scale-105 transition-transform flex items-center gap-1.5 text-sm font-bold ${bgAccentClass} text-white border-transparent`}
              >
                <UserIcon size={16} />
                <span>Se connecter</span>
              </button>
            )
          )}
          <button
            onClick={() => changeView('trophies')}
            className={`relative p-3 rounded-full shadow-lg border hover:scale-110 transition-transform flex items-center justify-center ${
              userStats.unlockedTrophies.length > 0
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 border-yellow-200 dark:border-yellow-700/50'
                : 'bg-surface-hover text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700'
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
        {/* Extrait dans components/shared/Sidebar.jsx (retour direct : "comment
            tu diviserais App.jsx ?" — 3e et dernier chantier de cette série,
            après les 8 modales et le moteur Spotify). */}
        <Sidebar
          cardBorder={cardBorder} bgAccentClass={bgAccentClass} isNaughtyMode={isNaughtyMode}
          textHighlight={textHighlight} textColorClass={textColorClass} textMuted={textMuted}
          theme={theme} toggleTheme={toggleTheme}
          isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
          changeView={changeView} view={view}
          showAthleticProfile={showAthleticProfile} setShowAthleticProfile={setShowAthleticProfile}
          favorites={favorites}
        />

        <div className="flex-1 flex flex-col relative w-full">
          {/* Header mobile (bouton burger + logo) */}
          <header className={`md:hidden flex items-center p-4 bg-surface border-b ${cardBorder} z-30`}>
            <button onClick={() => setIsMobileMenuOpen(true)} className={`p-2 mr-3 ${textMuted} hover:text-main bg-surface-hover rounded-lg`}><Menu size={20} /></button>
            <button onClick={() => changeView('generator')} title="Retour à l'accueil" className="flex items-center space-x-2 cursor-pointer">
              <span className={`font-bold text-lg tracking-tight ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
            </button>
          </header>

          {/* Header desktop flottant, n'apparaît qu'après un certain scroll (isScrolled) */}
          <header className={`hidden md:flex absolute top-0 left-0 right-0 p-6 z-30 transition-all duration-300 pointer-events-none ${isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className={`bg-surface/80 backdrop-blur-md border ${cardBorder} shadow-lg px-6 py-3 rounded-full flex items-center space-x-4 pointer-events-auto`}>
              <button onClick={() => changeView('generator')} title="Retour à l'accueil" className="cursor-pointer">
                <span className={`font-bold text-sm ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
              </button>
              <div className={`w-1 h-1 rounded-full ${bgAccentClass}`}></div>
              <span className={`text-sm font-medium ${textMuted}`}>{displaySubtitleGen}</span>
            </div>
          </header>

          <main id="main-scroll-area" className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar pb-32">

            {/* ===================== VIEW: GENERATOR (ASSISTANT MULTI-ETAPES) ===================== */}
            {view === 'generator' && (
              <GeneratorView
                theme={themeTokens} isNaughtyMode={isNaughtyMode} displaySubtitleGen={displaySubtitleGen} showToast={showToast}
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
                athleticProfile={athleticProfile} setBaseBpmForActivity={setBaseBpmForActivity} setZoneForActivity={setZoneForActivity}
                resetActivityProfile={resetActivityProfile} addCustomActivity={addCustomActivity} removeCustomActivity={removeCustomActivity}
                setBaseBpmForCustom={setBaseBpmForCustom} setZoneForCustom={setZoneForCustom} getProfileForWorkout={getProfileForWorkout}
                getDefaultBaseBpm={getDefaultBaseBpm} buildDefaultPreviewProfile={buildDefaultPreviewProfile}
                getZoneSpacingForActivity={getZoneSpacingForActivity}
                setCadenceIntentForActivity={setCadenceIntentForActivity} setCadenceIntentForCustom={setCadenceIntentForCustom}
                isCadenceIntentEligible={isCadenceIntentEligible}
                showAthleticProfile={showAthleticProfile} setShowAthleticProfile={setShowAthleticProfile}
              />
            )}

            {view === 'discover' && (
              <DiscoverView theme={themeTokens} onPlayTemplate={openCuratedPlaylist} />
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
                getProfileForWorkoutOrDefault={getProfileForWorkoutOrDefault}
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
                spotifyRedirectUri={REDIRECT_URI}
                user={user} signOut={signOut} isSupabaseConfigured={isSupabaseConfigured} openAuthModal={() => setIsAuthModalOpen(true)}
                userCount={userCount}
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
                currentPlaylist={currentPlaylist} savedPlaylists={savedPlaylists} getProfileForWorkout={getProfileForWorkout}
                getProfileForWorkoutOrDefault={getProfileForWorkoutOrDefault}
                renderTopCompletionDate={renderTopCompletionDate}
                isEditingPlaylistName={isEditingPlaylistName} setIsEditingPlaylistName={setIsEditingPlaylistName}
                editedPlaylistName={editedPlaylistName} setEditedPlaylistName={setEditedPlaylistName}
                handleRenamePlaylist={handleRenamePlaylist}
                handleSavePlaylist={handleSavePlaylist} handleUnsavePlaylist={requestUnsavePlaylist} handleShare={handleShare}
                showToast={showToast}
                summaryImageStatus={summaryImageStatus} setSummaryImageStatus={setSummaryImageStatus}
                summaryImageFile={summaryImageFile} setSummaryImageFile={setSummaryImageFile}
                summaryImagePreviewUrl={summaryImagePreviewUrl} setSummaryImagePreviewUrl={setSummaryImagePreviewUrl}
                includeSummaryImage={includeSummaryImage} setIncludeSummaryImage={setIncludeSummaryImage}
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
                renderCompletionsList={renderCompletionsList}
                getRankStyle={getRankStyle} triggerCSVUpload={triggerCSVUpload}
              />
            )}
          </main>
        </div>

        {/* ============================= MODALS ============================= */}

        {/* RECHERCHE MANUELLE DE TITRE VIA DEEZER : n'affiche que des titres dont le
            tempo est certifié par l'API. Si une playlist est actuellement affichée,
            le titre choisi y est ajouté ; sinon, il est ajouté aux favoris (utile
            pour "nourrir" l'algorithme de génération). */}
        <SearchModal
          theme={themeTokens}
          isSearchModalOpen={isSearchModalOpen} closeSearchModal={closeSearchModal}
          isBpmSearchMode={isBpmSearchMode} bpmSearchParams={bpmSearchParams} searchTracksByBpm={searchTracksByBpm}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchWorldMusicApi={searchWorldMusicApi}
          isWorldSearching={isWorldSearching} worldSearchResults={worldSearchResults} worldSearchOtherResults={worldSearchOtherResults}
          searchLoadingMessage={searchLoadingMessage} searchElapsedSeconds={searchElapsedSeconds}
          searchHasMoreResults={searchHasMoreResults} isLoadingMoreResults={isLoadingMoreResults}
          resultsContextLabel={resultsContextLabel} searchActiveArtistName={searchActiveArtistName} noUsableResultsHint={noUsableResultsHint}
          currentPlaylist={currentPlaylist} favorites={favorites} setFavorites={setFavorites}
          editingBpmId={editingBpmId} setEditingBpmId={setEditingBpmId} commitBpmEdit={commitBpmEdit}
          handleAddManualTrack={handleAddManualTrack} togglePreview={togglePreview} playingPreviewId={playingPreviewId}
          showToast={showToast}
        />

        <IconPickerModal
          theme={themeTokens}
          isIconPickerOpen={isIconPickerOpen} setIsIconPickerOpen={setIsIconPickerOpen}
          currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
          savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
          showToast={showToast}
        />

        <PendingNavigationModal
          theme={themeTokens}
          pendingNavigation={pendingNavigation} setPendingNavigation={setPendingNavigation}
          resolvePendingNavigation={resolvePendingNavigation}
        />

        <PendingUnsaveModal
          theme={themeTokens}
          pendingUnsavePlaylist={pendingUnsavePlaylist} setPendingUnsavePlaylist={setPendingUnsavePlaylist}
          removeSavedPlaylist={removeSavedPlaylist}
        />

        {/* Extrait dans CustomActivityModal.jsx (retour direct : "comment tu
            diviserais App.jsx ?" — modales déplacées une par une, en
            commençant par les plus petites/autonomes). */}
        <CustomActivityModal
          theme={themeTokens} isNaughtyMode={isNaughtyMode}
          isCustomActivityModalOpen={isCustomActivityModalOpen} setIsCustomActivityModalOpen={setIsCustomActivityModalOpen}
          tempCustomActivity={tempCustomActivity} setTempCustomActivity={setTempCustomActivity} setCustomActivity={setCustomActivity}
          getProfileForWorkout={getProfileForWorkout} applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}
          userStats={userStats} checkTrophies={checkTrophies}
        />

        <SavingRoutineModal
          theme={themeTokens} isNaughtyMode={isNaughtyMode}
          isSavingRoutineModalOpen={isSavingRoutineModalOpen} setIsSavingRoutineModalOpen={setIsSavingRoutineModalOpen}
          newRoutineName={newRoutineName} setNewRoutineName={setNewRoutineName}
          newRoutineIcon={newRoutineIcon} setNewRoutineIcon={setNewRoutineIcon}
          newRoutineFreq={newRoutineFreq} setNewRoutineFreq={setNewRoutineFreq}
          handleSaveRoutine={handleSaveRoutine}
        />

        {/* Extrait dans EditRoutineModal.jsx — modale d'édition d'une routine
            existante, contrairement à la modale de création elle propose un
            choix explicite à la sauvegarde : "cette séance seulement" ou
            "toujours pour cette routine". */}
        <EditRoutineModal
          theme={themeTokens} isNaughtyMode={isNaughtyMode}
          isEditRoutineModalOpen={isEditRoutineModalOpen} setIsEditRoutineModalOpen={setIsEditRoutineModalOpen}
          editingRoutine={editingRoutine} setEditingRoutine={setEditingRoutine}
          showExtraGenres={showExtraGenres} setShowExtraGenres={setShowExtraGenres}
          getProfileForWorkout={getProfileForWorkout} CRESCENDO_MIN_MAIN_PCT={CRESCENDO_MIN_MAIN_PCT}
          applyRoutineEditOnce={applyRoutineEditOnce} applyRoutineEditPermanently={applyRoutineEditPermanently}
        />


        {/* Extrait dans ShareModal.jsx — BUG CORRIGÉ (historique, gardé pour
            mémoire) : handleShare() préparait shareData et ouvrait
            isShareModalOpen, mais aucune fenêtre ne s'affichait nulle part
            avant ça (le bouton "Partager" ne faisait donc rien de visible).
            copyToClipboard existait déjà et n'attendait que son interface. */}
        <ShareModal
          theme={themeTokens}
          isShareModalOpen={isShareModalOpen} setIsShareModalOpen={setIsShareModalOpen} shareData={shareData}
          shareNative={shareNative} shareToWhatsApp={shareToWhatsApp} shareToTwitter={shareToTwitter} shareToFacebook={shareToFacebook}
          copyToClipboard={copyToClipboard} shareViaEmail={shareViaEmail}
          shareImageFile={shareImageFileWithTrophy}
          summaryImageStatus={summaryImageStatus} summaryImageFile={summaryImageFile}
          summaryImagePreviewUrl={summaryImagePreviewUrl}
          includeSummaryImage={includeSummaryImage} setIncludeSummaryImage={setIncludeSummaryImage}
        />

        <AuthModal
          theme={themeTokens}
          isAuthModalOpen={isAuthModalOpen} setIsAuthModalOpen={setIsAuthModalOpen}
          signUp={signUp} signIn={signIn} showToast={showToast}
        />

        <ImportSharedPlaylistModal
          theme={themeTokens}
          isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setImportedPlaylistPreview(null); }}
          preview={importedPlaylistPreview} onImport={importSharedPlaylist}
        />

        <MiniPlayerBar
          theme={themeTokens}
          track={currentPreviewTrack} isPlaying={isPreviewPlaying}
          onTogglePlayPause={() => isPreviewPlaying ? pauseCurrentPreview() : resumeCurrentPreview()}
          onClose={stopCurrentPreview}
        />

      </div>
    </div>
  );
}
