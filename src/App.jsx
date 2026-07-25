import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Clock, Music, Check, Heart, Loader2, AlertCircle, Zap, Menu, Trophy, User as UserIcon, Sun, Moon } from 'lucide-react';
import { ARTIST_CATALOG, EXTRA_GENRES, WEAK_DEEZER_KEYWORD_GENRES, genreDisplayLabel } from './musicCatalog';
import { NAUGHTY_ROUTINE_NAMES, getRankStyle } from './appConfig';

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

import { safeFetchJson, deezerFetch, getSingleMatchingTrack, buildSegmentTracks, deduceCrescendoBpm, buildCrescendoSegments, recalculateTimeline, createPlaylistData } from './musicEngine';
import { decodePlaylistFromSharing } from './utils/playlistShareCode';
import { buildCoverUrl } from './utils/coverArt';
import { curatedSessions, naughtyCuratedSessions } from './data/curatedSessions';
import { useTheme } from './hooks/useTheme';
import { usePersistentState } from './hooks/usePersistentState';
// useToast est toujours importé ici, mais appelé UNE SEULE FOIS par le
// composant racine `App` (chantier AudioPlayerContext — voir fin de fichier),
// plus par AppContent : toast/showToast lui arrivent maintenant en props.
import { useToast } from './hooks/useToast';
// useCustomActivity et useGeneratorForm ne sont plus importés ici : appelés
// une seule fois à l'intérieur de <GeneratorProvider> (contexts/GeneratorContext.jsx).
import { useTrackSearch } from './hooks/useTrackSearch';
import { useDeezerSearch } from './hooks/useDeezerSearch';
import { useFavorites } from './hooks/useFavorites';
import { useSpotifyImport } from './hooks/useSpotifyImport';
import { useAthleticProfile } from './hooks/useAthleticProfile';
import { useRoutines } from './hooks/useRoutines';
import { useUserStats } from './hooks/useUserStats';
import { usePlaylistCompletions } from './hooks/usePlaylistCompletions';
import { usePlaylistLibrary } from './hooks/usePlaylistLibrary';
import { useRoutineActions } from './hooks/useRoutineActions';
import { useCsvImport } from './hooks/useCsvImport';
// useAudioPreview n'est plus importé ici : appelé une seule fois à
// l'intérieur de <AudioPlayerProvider> (contexts/AudioPlayerContext.jsx).
import { AudioPlayerProvider, useAudioPlayer } from './contexts/AudioPlayerContext';
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
import ErrorBoundary from './components/shared/ErrorBoundary';
import SavingRoutineModal from './components/modals/SavingRoutineModal';
import ShareModal from './components/modals/ShareModal';
import AuthModal from './components/modals/AuthModal';
import { useAuthContext } from './contexts/AuthContext';
import { GeneratorProvider, useGeneratorContext } from './contexts/GeneratorContext';
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

// AppContent — anciennement `App` (voir plus bas pour le nouveau composant
// racine `App`, léger, qui ne fait qu'assembler les Providers). Renommage
// pur : aucune logique changée dans ce qui suit, seuls les 3 blocs
// explicitement commentés "MIGRÉ VERS GeneratorContext" ont bougé.
//
// `isNaughtyMode`, `showAthleticProfile` et `athleticProfileApi` (le retour
// intact de useAthleticProfile()) sont maintenant reçus EN PROPS plutôt que
// déclarés ici via useState/useAthleticProfile() directement — ils doivent
// exister AVANT que <GeneratorProvider> ne se monte (le Provider en a besoin
// pour sa propre valeur), donc ils ne peuvent plus vivre à l'intérieur du
// composant que ce Provider enveloppe. Remontés d'un cran dans `App`, qui
// les passe à la fois au Provider et ici, en props, à l'identique.
//
// `toast`/`showToast` (chantier AudioPlayerContext) suivent EXACTEMENT le
// même schéma : <AudioPlayerProvider> a besoin de `showToast` (useAudioPreview
// en dépend), qui doit rester une instance UNIQUE dans toute l'app — voir
// useToast.js, qui documente lui-même que tous les hooks qui en ont besoin le
// reçoivent en paramètre plutôt que de le dupliquer. Remonté ici pour la
// même raison que athleticProfile, pas ré-instancié.
function AppContent({
  isNaughtyMode, setIsNaughtyMode,
  showAthleticProfile, setShowAthleticProfile,
  athleticProfileApi,
  toast, showToast,
}) {
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
  // MIGRÉ VERS le composant racine `App` — même raison que isNaughtyMode
  // ci-dessus (nécessaire à <GeneratorProvider> avant le montage de ce composant).
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


  // MIGRÉ VERS le composant racine `App` (voir fin de fichier) : isNaughtyMode
  // est maintenant reçu en prop, pas déclaré ici — <GeneratorProvider> en a
  // besoin avant même que ce composant ne soit monté.
  // MIGRÉ VERS le composant racine `App` (chantier AudioPlayerContext) :
  // toast/showToast sont maintenant reçus en props, pour la même raison que
  // isNaughtyMode ci-dessus — <AudioPlayerProvider> a besoin de showToast
  // avant même que ce composant ne soit monté.

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
  } = useFavorites(showToast, isNaughtyMode);

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
  const { user, signUp, signIn, signOut, resetPassword, updateEmail, isSupabaseConfigured, userCount } = useAuthContext();
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
  // MIGRÉ : `useAthleticProfile()` n'est plus appelé ici mais dans le
  // composant racine `App` (instance UNIQUE, partagée avec GeneratorContext
  // ET avec StatsView/PlaylistDetailView/Sidebar plus bas) — reçue en prop et
  // simplement déstructurée à l'identique, aucun autre changement.
  const {
    athleticProfile, setAthleticProfile,
    computeZonesFromBaseBpm, getDefaultBaseBpm, buildDefaultPreviewProfile, getZoneSpacingForActivity,
    setBaseBpmForActivity, setZoneForActivity, resetActivityProfile,
    addCustomActivity, removeCustomActivity, setBaseBpmForCustom, setZoneForCustom, getProfileForWorkout,
    getProfileForWorkoutOrDefault,
    setCadenceIntentForActivity, setCadenceIntentForCustom, isCadenceIntentEligible,
    resetAthleticProfile,
  } = athleticProfileApi;

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

  const { userStats, setUserStats, checkTrophies } = useUserStats(showToast, user);

  // MIGRÉ VERS GeneratorContext (chantier God Component, étape 2) : tout ce
  // qui suit vivait ici via `useState('Course à pied')` + `useCustomActivity`
  // + `useGeneratorForm` directement. Ces 3 hooks sont maintenant appelés une
  // seule fois à l'intérieur de <GeneratorProvider> (voir
  // contexts/GeneratorContext.jsx) — AppContent les lit ici via
  // useGeneratorContext() pour ses propres besoins (handleSaveRoutine, le
  // toggle Mode Standard/Intime plus bas...), exactement comme GeneratorView
  // le fait de son côté. Mêmes noms de variables qu'avant : rien d'autre
  // dans ce fichier n'a besoin de changer.
  const {
    workoutType, setWorkoutType,
    // `setCustomActivity`/`tempCustomActivity`/`setTempCustomActivity`/
    // `isCustomActivityModalOpen`/`setIsCustomActivityModalOpen` ne sont PLUS
    // déstructurées ici : elles ne servaient qu'à alimenter les props de
    // CustomActivityModal, qui lit maintenant directement le contexte
    // lui-même (voir CustomActivityModal.jsx). `customActivity` (sans
    // "set") reste nécessaire ci-dessous (handleSaveRoutine).
    customActivity,
    handleOpenCustomActivityModal,
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
    bpmSourceIsProfile,
    // `applyProfileBpmIfUntouched` idem : plus utilisée qu'à l'intérieur de
    // CustomActivityModal.jsx désormais, retirée d'ici pour la même raison.
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
    getActiveWorkoutName,
  } = useGeneratorContext();

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
      { id: 'ex-track-1', segmentIndex: 1, targetSegmentBpm: 148, title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', bpm: 148, duration: 222, trackId: 'gGdGFtwPNsQ', preview: null, startTimeStr: '0m 00s', startDistVal: 0 },
      { id: 'ex-track-2', segmentIndex: 1, targetSegmentBpm: 145, title: 'Duality', artist: 'Slipknot', genre: 'Métal', bpm: 145, duration: 252, trackId: 'v2H4l9RpkwM', preview: null, startTimeStr: '3m 40s', startDistVal: 0.67 },
      { id: 'ex-track-3', segmentIndex: 1, targetSegmentBpm: 180, title: 'Smash', artist: 'The Offspring', genre: 'Métal', bpm: 180, duration: 170, trackId: 'L_jWHffIx5E', preview: null, startTimeStr: '7m 50s', startDistVal: 1.42 },
      { id: 'ex-track-4', segmentIndex: 1, targetSegmentBpm: 133, title: 'Thunderstruck', artist: 'AC/DC', genre: 'Rock', bpm: 133, duration: 292, trackId: 'v2AC41dglnM', preview: null, startTimeStr: '10m 38s', startDistVal: 1.93 },
      { id: 'ex-track-5', segmentIndex: 1, targetSegmentBpm: 128, title: 'Chop Suey!', artist: 'System Of A Down', genre: 'Métal', bpm: 128, duration: 210, trackId: 'CSvFpBOe8eY', preview: null, startTimeStr: '15m 28s', startDistVal: 2.81 }
    ]
  }, {
    // Mode Intime — 1 exemple dédié (retour direct : "manque d'exemples
    // concrets pour illustrer ce mode à un nouvel utilisateur", puis "less is
    // more" — un 2e exemple, "Sensual Groove", a été retiré : une seule
    // suffit). `workoutType: 'Ambiance'` (jamais autre chose pour une
    // playlist Intime, voir musicEngine.js) + `isNaughty: true` : mêmes
    // champs EXACTEMENT qu'une vraie génération produirait,
    // `config.workoutName` porte l'activité réelle sous-jacente (privée,
    // jamais affichée telle quelle en Mode Intime — voir
    // NAUGHTY_WORKOUT_LABELS, appConfig.js). Genre 'R&B Sensuel' : nom
    // canonique de NAUGHTY_GENRES (musicCatalog.js), pas inventé. Pas de
    // `completions` (contrairement à l'exemple Rock/Métal ci-dessus, déjà
    // marqué "faite") : ressort dans "À planifier", pour montrer un état
    // différent d'entrée de gamme.
    id: 'playlist-example-2',
    name: 'Late Night R&B',
    workoutType: 'Ambiance',
    avgPace: 300,
    targetMode: 'time',
    distanceUnit: 'km',
    tolerance: 8,
    crossfade: 2,
    isNaughty: true,
    coverIcon: '🔥',
    createdAt: new Date().toLocaleDateString(),
    status: 'pending',
    actualDataByDate: {},
    config: { workoutName: 'Musculation', targetMode: 'time', hours: 0, minutes: 17, bpm: 70, tolerance: 8, isIntervalMode: false, selectedGenres: ['R&B Sensuel'] },
    totalDuration: 1044,
    tracks: [
      { id: 'naughty-ex1-track-1', segmentIndex: 1, targetSegmentBpm: 65, title: 'Adorn', artist: 'Miguel', genre: 'R&B Sensuel', bpm: 65, duration: 205, trackId: 'nex1-1', preview: null, startTimeStr: '0m 00s', startDistVal: 0 },
      { id: 'naughty-ex1-track-2', segmentIndex: 1, targetSegmentBpm: 68, title: 'No Ordinary Love', artist: 'Sade', genre: 'R&B Sensuel', bpm: 68, duration: 293, trackId: 'nex1-2', preview: null, startTimeStr: '3m 23s', startDistVal: 0.68 },
      { id: 'naughty-ex1-track-3', segmentIndex: 1, targetSegmentBpm: 72, title: 'Untitled (How Does It Feel)', artist: "D'Angelo", genre: 'R&B Sensuel', bpm: 72, duration: 304, trackId: 'nex1-3', preview: null, startTimeStr: '8m 14s', startDistVal: 1.65 },
      { id: 'naughty-ex1-track-4', segmentIndex: 1, targetSegmentBpm: 70, title: 'Ordinary People', artist: 'John Legend', genre: 'R&B Sensuel', bpm: 70, duration: 248, trackId: 'nex1-4', preview: null, startTimeStr: '13m 16s', startDistVal: 2.65 }
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
        trackId: t.id || `imported-${Math.random().toString(36).slice(2)}`,
        // BUG ÉVITÉ (trouvé en repassant sur tout le projet) : `t.pv` est
        // l'extrait audio encodé dans le LIEN au moment du partage — une URL
        // Deezer, donc soumise à la même expiration déjà documentée pour les
        // playlists ensemencées (voir data/curatedSessions.js). Un lien
        // ouvert des semaines après son partage pouvait pointer vers un
        // extrait mort. Toujours `null` ici désormais : `preview` se résout
        // à la demande au 1er clic, exactement comme pour les playlists
        // ensemencées (voir resolveAndTogglePreview, PlaylistDetailView.jsx)
        // — même mécanisme déjà en place, rien de nouveau à construire.
        preview: null,
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
  // MIGRÉ VERS PlaylistDetailContext (édition du nom de la playlist).

  // MIGRÉ VERS AudioPlayerContext : useAudioPreview(showToast) n'est plus
  // appelé ici mais à l'intérieur de <AudioPlayerProvider> (instance
  // UNIQUE). AppContent le lit ici via useAudioPlayer() pour continuer à
  // transmettre `playingPreviewId`/`togglePreview`/`resolveAndPlay`/
  // `resolvingTrackId` aux vues qui en ont besoin pour LEURS listes de
  // titres (FavoritesView, StatsView, SearchModal — chacune n'utilise
  // l'aperçu audio que pour une fonctionnalité parmi d'autres, contrairement
  // à MiniPlayerBar qui lui est 100% dédié à l'audio et lit désormais
  // useAudioPlayer() directement, voir MiniPlayerBar.jsx).
  const {
    playingPreviewId, togglePreview,
    resolveAndPlay, resolvingTrackId,
    currentTrack,
  } = useAudioPlayer();
  // hasActiveTrack (dérivé de currentTrack) a été retiré : ne servait qu'au
  // padding conditionnel de Sidebar (abandonné, voir Sidebar.jsx) et à celui
  // de <main> (remplacé par le div espaceur, voir plus bas — condition
  // `currentTrack || playingPreviewId` directement à l'endroit où c'est
  // utilisé, pas la peine d'un booléen intermédiaire pour un seul usage).

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
      if (favorites.tracks.some(t => demoTrackIds.includes(t.trackId) && !t.preview)) {
        const resolvedFavs = await Promise.all(favorites.tracks.map(async (t) => {
          if (!demoTrackIds.includes(t.trackId) || t.preview) return t;
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
      // BUG ÉVITÉ (trouvé en vérifiant le pare-feu Mode Intime signalé sur
      // Bibliothèque/Découvrir) : `workoutType` était TOUJOURS
      // `template.workoutType` tel quel, `isNaughty` TOUJOURS `false` — une
      // playlist ouverte depuis un template du catalogue Intime (voir
      // NAUGHTY_DISCOVER_TEMPLATES, DiscoverView.jsx) se serait donc
      // retrouvée classée comme standard dans la Bibliothèque (le filtre par
      // mode, lui correct, l'aurait alors fait disparaître de la vue Intime
      // qui vient de la générer — invisible immédiatement après son propre
      // clic). `workoutType` suit maintenant EXACTEMENT la même règle que
      // toute vraie génération (musicEngine.js, `finalWorkoutName`) : toujours
      // "Ambiance" en Mode Intime, l'activité réelle du template restant
      // disponible dans `config.workoutName` ci-dessous.
      workoutType: isNaughtyMode ? 'Ambiance' : template.workoutType,
      avgPace: 330, targetMode: 'time', distanceUnit: 'km',
      tolerance: 10, crossfade: 2,
      // RETOUR DIRECT ("pas de bruit, ne pas appeler ça un id YouTube si ça
      // n'en est pas un") — curatedSessions.js n'a plus aucun id de service
      // par titre (voir ce fichier). `trackId` (le nom générique déjà
      // utilisé PARTOUT ailleurs dans l'app pour identifier un titre, quelle
      // que soit sa source réelle — favoris, mini-lecteur, graphiques) est
      // posé ICI avec un préfixe `curated-` clairement interne, PAS un faux
      // id Deezer/Spotify — remplacé par le vrai `deezer-{id}` dès la 1re
      // résolution réussie (voir resolveAndTogglePreview,
      // PlaylistDetailView.jsx). `preview: null` : jamais stocké en dur,
      // résolu à la demande au clic — voir la même fonction.
      // BUG ÉVITÉ (trouvé en revérifiant avant de valider) : `id` (par
      // OCCURRENCE dans la liste, distinct de `trackId` qui identifie la
      // CHANSON elle-même — voir musicEngine.js, createPlaylistData) sert de
      // clé React ET à l'enchaînement automatique des extraits
      // (getNextTrackForAutoAdvance, PlaylistDetailView.jsx) : sans lui ici,
      // ces deux mécanismes se seraient cassés silencieusement sur une
      // playlist ensemencée (clés React dupliquées, enchaînement qui
      // retombe toujours sur le même titre).
      tracks: template.tracks.map((t, i) => ({ ...t, id: `curated-${template.id}-${i}`, trackId: `curated-${template.id}-${i}`, preview: null })),
      isNaughty: isNaughtyMode, fallbackTrackCount: 0,
      // RETOUR DIRECT ("la pochette générée disparaît sur la fiche détail")
      // — `coverUrl` n'est stocké NULLE PART dans data/curatedSessions.js
      // (volontairement, voir ce fichier) : recalculé ici avec la MÊME
      // fonction que TemplateCard.jsx (utils/coverArt.js) — déterministe par
      // le titre, donc rigoureusement identique à la pochette déjà vue dans
      // la grille de Découverte, sans avoir besoin de la faire transiter par
      // un state/des props séparés. `coverIcon` (l'émoji) reste posé en
      // repli, au cas où `coverUrl` échouerait à charger un jour (voir
      // PlaylistDetailView.jsx pour ce repli).
      coverUrl: buildCoverUrl(template.title),
      coverIcon: '🎧', createdAt: new Date().toLocaleDateString(),
      status: 'pending', actualDataByDate: {},
      config: { workoutName: template.workoutType, targetMode: 'time', bpm: avgBpm, selectedGenres: genres.length ? genres : ['Autre'] },
      // Trace de l'origine (retour direct : "je devrais revenir à la
      // playlist telle que j'ai cliqué dessus au départ" après un
      // renommage/édition suivi d'un retrait de "Mes Séances") — permet à
      // `removeSavedPlaylist` (plus bas) de retrouver le template BRUT et
      // pristine dans data/curatedSessions.js, plutôt que de laisser
      // affiché un `currentPlaylist` qui garderait les modifications d'une
      // sauvegarde abandonnée. Un id STABLE (`template.id`, jamais régénéré
      // à chaque ouverture, contrairement à `id` ci-dessus qui embarque
      // `Date.now()`) — indispensable pour retrouver le bon template après
      // coup, pas juste au moment de l'ouverture.
      sourceTemplateId: template.id,
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

  // MIGRÉ VERS GeneratorContext (déjà déstructurée plus haut depuis
  // useGeneratorContext()) — sa définition ne changeait pas, juste son
  // emplacement.

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

  // toggleNaughtyMode/handleSaveRoutine/applyRoutineEditOnce/applyRoutineEditPermanently
  // extraites dans useRoutineActions.js (25/07, chantier "réduire le God
  // Component") — appelée plus bas, une fois executeGeneration défini (dont
  // applyRoutineEditOnce/Permanently dépendent).

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

  // handleSavePlaylist/removeSavedPlaylist/playlistHasHistory/requestRemoveSavedPlaylist/
  // setPlaylistPlannedDate extraites dans usePlaylistLibrary.js (25/07, chantier
  // "réduire le God Component") : même schéma que usePlaylistCompletions.js —
  // currentPlaylist/savedPlaylists restent ici (lus/écrits par bien d'autres
  // fonctions) et transmis en paramètres, avec openCuratedPlaylist (pour la
  // restauration du template pristine) et setPendingUnsavePlaylist (modale de
  // confirmation), tous deux déjà définis plus haut dans ce fichier.
  const {
    handleSavePlaylist, removeSavedPlaylist, playlistHasHistory, requestRemoveSavedPlaylist, setPlaylistPlannedDate,
  } = usePlaylistLibrary(
    currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists, showToast,
    openCuratedPlaylist, setPendingUnsavePlaylist, userStats, checkTrophies,
  );

  // MIGRÉ VERS PlaylistDetailContext (`handleUnsavePlaylist`, même wrapper
  // autour de requestRemoveSavedPlaylist, gardée ci-dessus car partagée avec
  // PlaylistsView).

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
      rollingExcludeIds = [...rollingExcludeIds, ...pl.tracks.map(t => t.trackId)];

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

  const { toggleNaughtyMode, handleSaveRoutine, applyRoutineEditOnce, applyRoutineEditPermanently } = useRoutineActions(
    isNaughtyMode, setIsNaughtyMode, showToast,
    routines, addRoutine, updateRoutine,
    editingRoutine, setEditingRoutine, setIsEditRoutineModalOpen,
    newRoutineName, newRoutineIcon, newRoutineFreq,
    userStats, checkTrophies, executeGeneration,
  );

  // MIGRÉ VERS PlaylistDetailContext : handleRemoveTrack, handleDuplicateTrack,
  // handleRenamePlaylist, handleReplaceTrack, handleReplaceTrackSameArtist,
  // le drag-and-drop de la liste (draggedTrackIndex/moveTrackTo/
  // handleTrackDragStart/handleTrackDragEnter/handleTrackDragEnd) et le menu
  // par titre (openTrackMenuIndex) — tous exclusifs à cette vue, vérifié
  // qu'aucun n'est appelé ailleurs dans ce fichier avant de les déplacer.

  // setPlaylistPlannedDate déplacée avec le reste de usePlaylistLibrary.js
  // ci-dessus — plus définie ici.

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

  // markPlaylistAsCompleted/removeCompletionDate/editCompletionDate extraites
  // dans usePlaylistCompletions.js (25/07, chantier "réduire le God Component") :
  // même schéma que useFavorites/useRoutines, savedPlaylists/setSavedPlaylists
  // restent ici (lus/écrits par bien d'autres fonctions) et transmis en paramètres.
  const { markPlaylistAsCompleted, removeCompletionDate, editCompletionDate } =
    usePlaylistCompletions(savedPlaylists, setSavedPlaylists, showToast, userStats, checkTrophies);

  // triggerCSVUpload/handleCSVUpload extraites dans useCsvImport.js (25/07,
  // chantier "réduire le God Component") : même schéma que les hooks
  // précédents — fileInputRef/csvUploadTargetDate (uniques, voir useSessionAnalysis
  // plus haut) transmis en paramètres.
  const { triggerCSVUpload, handleCSVUpload } = useCsvImport(
    fileInputRef, csvUploadTargetDate, setCsvUploadTargetDate,
    currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
    setSelectedAnalysisDate, setSelectedMetric,
    userStats, checkTrophies, changeView, showToast,
  );

  // MIGRÉ VERS PlaylistDetailContext : chartAxisType/chartDistanceUnitOverride,
  // unifiedChartData, trackSegments, bpmDistributionData, genreDistributionData,
  // selectedSegmentIdx — tous les calculs dérivés du graphique BPM et des
  // distributions, exclusifs à cette vue (vérifié : aucun n'est lu ailleurs
  // dans ce fichier avant de les déplacer).

  // Une seule date de complétion éditable à la fois, tous playlists confondus —
  // évite d'avoir à suivre un état d'édition séparé par playlist/par date.
  const [editingCompletion, setEditingCompletion] = useState(null); // {playlistId, isoDate} | null

  // RANK_STYLES/getRankStyle déplacées dans appConfig.js (25/07, chantier
  // "réduire le God Component") : fonction pure, importée en haut de ce
  // fichier plutôt que définie ici.

  // renderTopCompletionDate/renderCompletionsList extraites en composants
  // réels (25/07, chantier "réduire le God Component") : voir
  // components/shared/TopCompletionDate.jsx et CompletionsList.jsx. `editingCompletion`/
  // `setEditingCompletion` (juste au-dessus) restent ici et sont transmis en props aux
  // deux composants, qui les partagent — une seule date éditable à la fois, tous
  // playlists ET tous composants confondus, inchangé par rapport à avant.

  // MIGRÉ VERS PlaylistDetailContext : resolveSegmentIdxFromChartState,
  // handleChartClick, le drag-and-drop directement sur le graphique
  // (isDraggingChartSegment/chartDragStartIndex/chartDragTrackTitle/
  // handleChartMouseDown/Move/Up), les domaines d'axes (chartDistanceUnit/
  // distanceDisplayFactor/chartXDomain/chartXTicks/chartYDomain) et
  // analysisStats — tous exclusifs à cette vue (vérifié).


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

        {/* Bloc thème + connexion — déplacé à l'intérieur de <main> (voir plus
            bas, juste après son ouverture) : retour direct ("je veux juste
            que les boutons restent en haut et que quand on scroll on les
            voit plus") — après 2 tentatives pour le garder visible en
            permanence (fixed + vignette), la demande réelle est plus simple :
            qu'il défile normalement AVEC le contenu, comme n'importe quel
            autre élément de la page, plutôt que de rester ancré au viewport. */}


        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="hidden" />

        {/* ============================= SIDEBAR ============================= */}
        {/* Extrait dans components/shared/Sidebar.jsx (retour direct : "comment
            tu diviserais App.jsx ?" — 3e et dernier chantier de cette série,
            après les 8 modales et le moteur Spotify). */}
        <Sidebar
          cardBorder={cardBorder} bgAccentClass={bgAccentClass} isNaughtyMode={isNaughtyMode}
          textHighlight={textHighlight} textColorClass={textColorClass} textMuted={textMuted}
          isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
          changeView={changeView} view={view}
          showAthleticProfile={showAthleticProfile} setShowAthleticProfile={setShowAthleticProfile}
          favorites={favorites}
          user={user} userStats={userStats}
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

          {/* Padding supérieur augmenté (`pt-20 sm:pt-24`, contre `p-4 sm:p-8`
              partout ailleurs) — clairance nécessaire pour le bloc
              thème/connexion, maintenant `fixed` (voir plus haut) et donc
              plus jamais repoussé par le flux normal du contenu : sans cette
              marge dédiée, l'en-tête de certaines vues (ex. le stepper
              "ÉTAPE 1/4" de GeneratorView) pourrait passer juste sous ce
              bloc plutôt qu'à côté. */}
          <main id="main-scroll-area" className="relative flex-1 overflow-y-auto pt-20 sm:pt-24 px-4 sm:px-8 pb-4 sm:pb-8 no-scrollbar">

            {/* Bloc thème + connexion — RETOUR DIRECT ("je veux juste que les
                boutons restent en haut et que quand on scroll on les voit
                plus") : `absolute` (pas `fixed`) et positionné ICI, comme
                premier enfant de `<main>` (devenu `relative` juste au-dessus
                pour lui servir de repère) — il défile donc NORMALEMENT avec
                le reste du contenu de `<main>`, visible en haut de page au
                chargement, puis disparaît en scrollant comme n'importe quel
                autre élément, au lieu de rester ancré au viewport. */}
            <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[60] flex items-center gap-2">
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                className={`w-11 h-11 rounded-full shadow-lg border hover:scale-110 transition-transform flex items-center justify-center ${cardBg} ${cardBorder} ${textMuted}`}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
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
            </div>


            {/* ===================== VIEW: GENERATOR (ASSISTANT MULTI-ETAPES) ===================== */}
            {view === 'generator' && (
              // Chantier God Component étape 2 : cet appel ne porte plus QUE
              // les props qui ne viennent PAS de GeneratorContext (theme,
              // orchestration App.jsx — recherche/génération/sauvegarde —,
              // showToast). GeneratorView lit désormais tout le reste
              // (workoutType, bpm, segments, genres, profil athlétique...)
              // directement via useGeneratorContext(). Passé de 93 à 15 props.
              <GeneratorView
                theme={themeTokens} showToast={showToast}
                toggleNaughtyMode={toggleNaughtyMode}
                setCurrentPlaylist={setCurrentPlaylist} setIsBpmSearchMode={setIsBpmSearchMode}
                setSearchQuery={setSearchQuery} setWorldSearchResults={setWorldSearchResults}
                setResultsContextLabel={setResultsContextLabel} setNoUsableResultsHint={setNoUsableResultsHint}
                setIsSearchModalOpen={setIsSearchModalOpen} searchTracksByBpm={searchTracksByBpm}
                executeGeneration={executeGeneration} isGenerating={isGenerating}
                setIsSavingRoutineModalOpen={setIsSavingRoutineModalOpen}
              />
            )}

            {view === 'discover' && (
              <DiscoverView theme={themeTokens} onPlayTemplate={openCuratedPlaylist} isNaughtyMode={isNaughtyMode} />
            )}

            {view === 'routines' && (
              <RoutinesView
                theme={themeTokens} isNaughtyMode={isNaughtyMode} routines={routines} setRoutines={setRoutines}
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
                dates y a été intégré. Vérifié le 25/07 : HistoryView.jsx, useQueue.js
                et QueueView.jsx n'existent déjà plus sur le disque — nettoyage déjà
                fait lors d'une session antérieure, ce commentaire ne demandait plus
                rien de réel. */}
            {view === 'playlists' && (
              <PlaylistsView
                theme={themeTokens} isNaughtyMode={isNaughtyMode}
                savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
                requestRemoveSavedPlaylist={requestRemoveSavedPlaylist}
                setPlaylistPlannedDate={setPlaylistPlannedDate}
                getRankStyle={getRankStyle} setCurrentPlaylist={setCurrentPlaylist} changeView={changeView}
                renderConfigInfoLine={renderConfigInfoLine}
                editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
                triggerCSVUpload={triggerCSVUpload}
                markPlaylistAsCompleted={markPlaylistAsCompleted}
              />
            )}

            {view === 'stats' && (
              <StatsView
                theme={themeTokens} savedPlaylists={savedPlaylists} userStats={userStats} changeView={changeView}
                setCurrentPlaylist={setCurrentPlaylist} athleticProfile={athleticProfile} getProfileForWorkout={getProfileForWorkout}
                getProfileForWorkoutOrDefault={getProfileForWorkoutOrDefault}
                shareImageFile={shareImageFileWithTrophy} showToast={showToast}
                isNaughtyMode={isNaughtyMode}
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
                user={user} signOut={signOut} updateEmail={updateEmail} isSupabaseConfigured={isSupabaseConfigured}
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
                resolveAndPlay={resolveAndPlay} resolvingTrackId={resolvingTrackId}
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
                currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
                savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
                favorites={favorites} spotifyTrackPool={spotifyTrackPool}
                userStats={userStats} checkTrophies={checkTrophies}
                showToast={showToast} requestRemoveSavedPlaylist={requestRemoveSavedPlaylist} handleSavePlaylist={handleSavePlaylist}
                currentActualData={currentActualData} selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric}
                dataOffset={dataOffset} setDataOffset={setDataOffset}
                selectedAnalysisDate={selectedAnalysisDate} setSelectedAnalysisDate={setSelectedAnalysisDate}
                availableMetrics={availableMetrics}
                theme={themeTokens} colorMode={theme} handleShare={handleShare}
                summaryImageStatus={summaryImageStatus} setSummaryImageStatus={setSummaryImageStatus}
                summaryImageFile={summaryImageFile} setSummaryImageFile={setSummaryImageFile}
                summaryImagePreviewUrl={summaryImagePreviewUrl} setSummaryImagePreviewUrl={setSummaryImagePreviewUrl}
                includeSummaryImage={includeSummaryImage} setIncludeSummaryImage={setIncludeSummaryImage}
                toggleTrackFavorite={toggleTrackFavorite} toggleArtistFavorite={toggleArtistFavorite}
                setIsBpmSearchMode={setIsBpmSearchMode} setIsSearchModalOpen={setIsSearchModalOpen}
                setPlaylistPlannedDate={setPlaylistPlannedDate}
                editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
                getRankStyle={getRankStyle} triggerCSVUpload={triggerCSVUpload}
              />
            )}

            {/* Espaceur — réserve de la place en bas du contenu défilant pour
                MiniPlayerBar (fixed bottom-0, hors du flux normal, ne pousse
                donc rien tout seul). Remplace le pb-32 conditionnel posé
                directement sur <main> : un enfant réel dans le flux (plutôt
                qu'un padding sur le conteneur) s'adapte à la hauteur RÉELLE
                du contenu qui le précède quel que soit son overflow, sans
                dépendre d'une classe de padding qui pouvait laisser un vide
                ou rester insuffisante (barre de progression ajoutée depuis,
                lecteur plus haut qu'avant — pb-32 ne suffisait déjà plus).
                `currentTrack || playingPreviewId` : couvre à la fois le
                mini-lecteur persistant ET le cas où un extrait vient tout
                juste d'être lancé depuis une liste avant que `currentTrack`
                n'ait eu le temps de se propager (même garde que MiniPlayerBar
                utilise indirectement via useAudioPlayer()). h-40 (160px) :
                un peu plus que la hauteur réelle de la barre (pochette +
                contrôles + progression), marge de sécurité incluse plutôt
                qu'une valeur pile ajustée au pixel. */}
            {(currentTrack || playingPreviewId) && <div className="h-40 shrink-0 w-full"></div>}
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

        {/* Extrait dans CustomActivityModal.jsx. Chantier God Component étape 2
            (suite) : ne reçoit plus que ce qui est hors du périmètre de
            GeneratorContext (theme + le système de trophées, sans rapport
            avec le générateur) — tout le reste (ouverture, valeur saisie,
            confirmation) vient directement de useGeneratorContext(). */}
        <CustomActivityModal
          theme={themeTokens}
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
          signUp={signUp} signIn={signIn} resetPassword={resetPassword} showToast={showToast}
        />

        <ImportSharedPlaylistModal
          theme={themeTokens}
          isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setImportedPlaylistPreview(null); }}
          preview={importedPlaylistPreview} onImport={importSharedPlaylist}
        />

        {/* Chantier God Component (suite) : ne reçoit plus que theme et
            currentPlaylist (seule dépendance hors du périmètre
            d'AudioPlayerContext) — lit tout le reste (currentTrack,
            isPlaying, pause/reprise/fermeture, skip précédent/suivant)
            directement via useAudioPlayer(). */}
        <MiniPlayerBar theme={themeTokens} currentPlaylist={currentPlaylist} changeView={changeView} />

      </div>
    </div>
  );
}

/**
 * App — composant racine (chantier God Component, étape 2/2). Ne fait QUE
 * posséder ce qui doit exister AVANT <GeneratorProvider> (le Provider en a
 * besoin dans sa propre valeur, donc ça ne peut plus vivre dans AppContent,
 * qu'il enveloppe) et assembler les Providers. Aucune autre logique ici.
 *
 * NOTE : `<AuthProvider>` n'est PAS répété ici — il enveloppe déjà `<App/>`
 * dans main.jsx. Le dupliquer créerait 2 instances indépendantes du contexte
 * d'auth (2e connexion Supabase, 2e écoute d'état) pour rien : la 2e
 * envelopperait la 1ère sans jamais être lue par personne, puisque
 * `useAuthContext()` (AppContent) remonte au Provider le plus proche, qui
 * resterait celui de main.jsx de toute façon vu qu'aucun composant ici ne
 * s'intercale entre les deux. Un seul <AuthProvider>, tout en haut, suffit.
 *
 * `isNaughtyMode`, `showAthleticProfile` et l'instance UNIQUE de
 * useAthleticProfile() vivent ici et sont transmis 2 fois : une fois au
 * Provider (pour que GeneratorView les récupère via useGeneratorContext()),
 * une fois en props classiques à AppContent (qui en a toujours besoin
 * directement — StatsView, PlaylistDetailView, Sidebar, et ses propres
 * fonctions comme handleSaveRoutine/toggleNaughtyMode ne passent pas par ce
 * contexte). Résultat : une seule source de vérité pour chacun des 3, jamais
 * dupliquée, distribuée par 2 canaux différents selon qui la consomme.
 *
 * `toast`/`showToast` (useToast()) suivent EXACTEMENT le même schéma, ajoutés
 * ici pour <AudioPlayerProvider> (useAudioPreview en dépend) — remontés pour
 * la même raison que athleticProfile, jamais dupliqués (voir useToast.js).
 *
 * Imbrication des Providers : GeneratorProvider et AudioPlayerProvider sont
 * indépendants l'un de l'autre (aucun des deux ne lit l'état de l'autre) —
 * leur ordre relatif n'a donc aucune importance fonctionnelle. AuthProvider
 * reste dans main.jsx, au-dessus des deux (voir plus haut).
 */
export default function App() {
  const [isNaughtyMode, setIsNaughtyMode] = useState(false);
  const [showAthleticProfile, setShowAthleticProfile] = useState(false);
  const athleticProfileApi = useAthleticProfile();
  const { toast, showToast } = useToast();

  // Filet de sécurité navigation (retour direct : "Mon Profil Athlétique n'a
  // aucun sens en Mode Intime et affiche une page vide") — si l'utilisateur
  // est SUR ce panneau au moment de basculer en Mode Intime (l'entrée de
  // sidebar qui y mène est désormais masquée dans ce mode, voir Sidebar.jsx,
  // mais rien n'empêchait D'Y ÊTRE DÉJÀ juste avant de basculer), on le
  // referme automatiquement — reste sur la vue "Générer" elle-même (déjà
  // fonctionnelle en Mode Intime), pas de redirection vers une autre vue,
  // ce panneau étant un sous-état de "Générer", pas une vue à part entière.
  useEffect(() => {
    if (isNaughtyMode) setShowAthleticProfile(false);
  }, [isNaughtyMode]);

  return (
    <GeneratorProvider
      isNaughtyMode={isNaughtyMode}
      athleticProfileApi={athleticProfileApi}
      showAthleticProfile={showAthleticProfile}
      setShowAthleticProfile={setShowAthleticProfile}
    >
      <AudioPlayerProvider showToast={showToast}>
        <ErrorBoundary>
          <AppContent
            isNaughtyMode={isNaughtyMode} setIsNaughtyMode={setIsNaughtyMode}
            showAthleticProfile={showAthleticProfile} setShowAthleticProfile={setShowAthleticProfile}
            athleticProfileApi={athleticProfileApi}
            toast={toast} showToast={showToast}
          />
        </ErrorBoundary>
      </AudioPlayerProvider>
    </GeneratorProvider>
  );
}
