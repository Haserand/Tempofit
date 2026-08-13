import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Activity, Clock, Music, Check, Heart, Loader2, AlertCircle, Zap, Menu, Trophy, User as UserIcon, X, LogOut, Search as SearchIcon } from 'lucide-react';
import { genreDisplayLabel } from './musicCatalog';
import { NAUGHTY_ROUTINE_NAMES, getRankStyle } from './appConfig';
import { VIEW_HEADER_TOP_PADDING } from './layout/viewHeaderLayout';
import { ICON_BUTTON_ROUNDING } from './layout/iconButtonLayout';
import { supabase } from './supabaseClient';

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

import { deezerFetch, deduceCrescendoBpm, buildCrescendoSegments, recalculateTimeline } from './engine/musicEngine';
import { decodePlaylistFromSharing } from './utils/playlistShareCode';
import { useTheme } from './hooks/useTheme';
import { usePersistentState } from './hooks/usePersistentState';
import { useSyncedCollection } from './hooks/useSyncedCollection';
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
import { useNavigation } from './hooks/useNavigation';
import { usePlaylistGeneration } from './hooks/usePlaylistGeneration';
import { useRoutineActions } from './hooks/useRoutineActions';
import { useCsvImport } from './hooks/useCsvImport';
// useAudioPreview n'est plus importé ici : appelé une seule fois à
// l'intérieur de <AudioPlayerProvider> (contexts/AudioPlayerContext.jsx).
import { AudioPlayerProvider, useAudioPlayer } from './contexts/AudioPlayerContext';
import { useShare } from './hooks/useShare';
import { useElapsedTimer } from './hooks/useElapsedTimer';
import { useSessionAnalysis } from './hooks/useSessionAnalysis';
// Vues chargées en lazy (Optimisation "app encore petite", 29/07) — une SEULE
// de ces 9 vues est jamais montée à la fois (voir le switch `view === '...'`
// plus bas, toujours mutuellement exclusif), donc les charger toutes de façon
// statique dans le bundle initial force TOUT LE MONDE à télécharger le code
// de StatsView/PlaylistCharts (recharts, ~gros) et de GeneratorWizard (1000+
// lignes) dès le premier chargement, même quelqu'un qui ne fait QUE générer
// une séance et ne visitera jamais Stats. `React.lazy()` + le `<Suspense>`
// unique qui entoure le switch plus bas (seule modification nécessaire côté
// rendu) suffit à découper chaque vue dans son propre chunk JS, chargé à la
// demande au premier changement de vue — Vite/Rolldown s'en charge tout
// seul, aucune configuration supplémentaire. Les imports non listés ici
// (DualRangeSlider, CustomActivityModal, MiniPlayerBar, GuestModeBar...)
// restent statiques : ce sont des petits composants de chrome partagé,
// potentiellement visibles dès le premier écran, pas des vues entières.
const SettingsView = lazy(() => import('./components/views/SettingsView'));
const FavoritesView = lazy(() => import('./components/views/FavoritesView'));
const TrophiesView = lazy(() => import('./components/views/TrophiesView'));
const RoutinesView = lazy(() => import('./components/views/RoutinesView'));
const PlaylistsView = lazy(() => import('./components/views/PlaylistsView'));
import DualRangeSlider from './components/shared/DualRangeSlider';
const StatsView = lazy(() => import('./components/views/StatsView'));
const GeneratorView = lazy(() => import('./components/views/GeneratorView'));
const PlaylistDetailView = lazy(() => import('./components/views/PlaylistDetailView'));
import CustomActivityModal from './components/modals/CustomActivityModal';
const DiscoverView = lazy(() => import('./components/views/DiscoverView'));
const ProfileView = lazy(() => import('./components/views/ProfileView'));
import MiniPlayerBar from './components/shared/MiniPlayerBar';
import GuestModeBar from './components/shared/GuestModeBar';
import ErrorBoundary from './components/shared/ErrorBoundary';
import SavingRoutineModal from './components/modals/SavingRoutineModal';
import ShareModal from './components/modals/ShareModal';
import { OFFICIAL_VITRINE_USERNAME } from './data/officialVitrineProfile';
import SearchUsersModal from './components/modals/SearchUsersModal';
import { useAuthContext } from './contexts/AuthContext';
import { ModalProvider, useModalContext } from './contexts/ModalContext';
import { GeneratorProvider, useGeneratorContext } from './contexts/GeneratorContext';
import { AthleticProvider } from './contexts/AthleticContext';
import ModalContainer from './components/shared/ModalContainer';
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
// `isNaughtyMode` et `athleticProfileApi` (le retour intact de
// useAthleticProfile()) sont maintenant reçus EN PROPS plutôt que déclarés
// ici via useState/useAthleticProfile() directement — ils doivent exister
// AVANT que <GeneratorProvider> ne se monte (le Provider en a besoin pour
// sa propre valeur), donc ils ne peuvent plus vivre à l'intérieur du
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
  athleticProfileApi,
  toast, showToast,
}) {
  // --- Navigation & état d'affichage global ---
  const [view, setView] = useState('generator');
  // Pseudo actuellement consulté sur la vue Profil Public (ProfileView.jsx),
  // posé par la détection `?profile=...` ci-dessous (voir ce useEffect pour
  // le raisonnement complet) — `null` tant qu'aucun profil n'est en cours
  // de consultation, jamais lu ailleurs que par ce composant.
  const [viewingProfileUsername, setViewingProfileUsername] = useState(null);

  // Navigation vers un profil DEPUIS l'app elle-même (Feature Sociale —
  // Navigation, 01/08 — clic sur un résultat de SearchUsersModal.jsx), par
  // opposition à la détection `?profile=...` ci-dessous (arrivée depuis
  // un lien externe). Même state cible (`viewingProfileUsername`), 2
  // chemins différents pour y arriver — ProfileView.jsx ne fait aucune
  // différence entre les deux une fois affichée.
  const handleViewProfile = (username) => {
    setViewingProfileUsername(username);
    changeView('profile');
  };

  // Ouvre une playlist PUBLIQUE d'un autre utilisateur en APERÇU (Feature
  // Sociale — Consultation/Clonage, 01/08, clic sur une carte de
  // ProfileView.jsx) — `row` est une LIGNE brute de la table `playlists`
  // (voir supabase-schema.sql), déjà en mémoire côté ProfileView.jsx (pas
  // besoin d'un 2e fetch : contrairement à `?profile=...`, ce n'est PAS un
  // lien externe froid, on est déjà DANS l'app, la donnée est déjà là).
  // `isReadOnly: true` posé ICI, et NULLE PART AILLEURS dans toute l'app —
  // c'est la SEULE source de ce champ (voir PlaylistDetailContext.jsx pour
  // tout ce qui en découle). `isPublic: !!row.is_public` reflète l'état
  // RÉEL de la ligne consultée — pas de raison de le forcer à autre chose
  // ici, seul `handleClonePlaylist` (usePlaylistLibrary.js) le remet à
  // `false` au moment du clonage.
  //
  // BUG CORRIGÉ (01/08, relecture globale, retour direct : "je devrais pas
  // pouvoir sauvegarder ou mettre en public des playlists déjà sauvegardées
  // ou mises en public") — cette fonction forçait `isReadOnly: true` SANS
  // JAMAIS vérifier si le visiteur consultait sa PROPRE playlist (via son
  // propre aperçu de profil, voir `isSelf`, ProfileView.jsx). Résultat :
  // cliquer sur sa propre playlist depuis son propre profil affichait à
  // tort le bouton "Sauvegarder dans mes séances" — cloner sa propre
  // playlist déjà sienne, avec un nouvel id, comme si c'était celle d'un
  // inconnu. Vérifie maintenant D'ABORD si `row.user_id` correspond au
  // visiteur connecté : si oui, retrouve la VRAIE copie déjà possédée
  // (`savedPlaylists`, jamais reconstruite depuis `row.content` — la copie
  // déjà en mémoire est la source de vérité la plus à jour, pas une lecture
  // Supabase qui pourrait dater de quelques secondes) et l'ouvre
  // NORMALEMENT (`isReadOnly` absent = `false`, exactement comme un clic
  // depuis "Mes Séances") — jamais en lecture seule sur sa propre playlist.
  const handleOpenPublicPlaylist = (row) => {
    // Profil vitrine "@tempofit_officiel" (Feature Sociale "Cold Start",
    // 02/08) — VÉRIFIÉ EN PREMIER : `row._sourceTemplate` n'existe QUE sur
    // les lignes construites par officialVitrineProfile.js
    // (templateToVitrineRow), jamais sur une vraie ligne `playlists`.
    // `row.content` d'un template vitrine est volontairement MINIMAL
    // (name/workoutType/totalDuration/config.bpm/coverUrl seulement, voir
    // ce fichier) — PAS de vrais `tracks` dedans (ils n'existent nulle
    // part en base pour un simple modèle du catalogue). Le raccourci
    // habituel `{...row.content, id: row.id, ...}` produirait donc une
    // playlist SANS titres, cassant la lecture/le détail. `openCuratedPlaylist`
    // (déjà utilisée par Découvrir pour ouvrir un template normalement,
    // voir useNavigation.js) fait la VRAIE reconstruction complète —
    // `{isReadOnly: true, isPublic: true}` fusionnés dedans (2e paramètre,
    // ajouté pour ce cas précis) pour obtenir exactement le même
    // comportement de "playlist étrangère en aperçu" qu'une vraie playlist
    // publique (bouton "Sauvegarder dans mes séances", pas d'édition
    // possible — voir PlaylistDetailContext.jsx).
    if (row._sourceTemplate) {
      // `cloneCount: row.clone_count` (05/08, retour direct : "je ne vois
      // pas le nombre de clones... c'est la demande de base") —
      // `row.clone_count` existe déjà ici (posé par `templateToVitrineRow`,
      // officialVitrineProfile.js, depuis la VRAIE table
      // `template_clone_counts`) mais n'était jusqu'ici jamais transmis à
      // `openCuratedPlaylist` — se perdait silencieusement au clic, comme
      // pour Découvrir direct (voir TemplateCard.jsx).
      openCuratedPlaylist(row._sourceTemplate, { isReadOnly: true, isPublic: true, cloneCount: row.clone_count });
      return;
    }
    if (user && row.user_id === user.id) {
      const own = savedPlaylists.find(p => p.id === row.id);
      setCurrentPlaylist(own || { ...row.content, id: row.id, isPublic: !!row.is_public });
      changeView('playlist');
      return;
    }
    // `user_id: row.user_id` conservé ici (compteur de clonages, 02/08) —
    // nécessaire pour incrémenter le bon `clone_count` au clonage
    // (`handleClonePlaylist`, usePlaylistLibrary.js) : la clé primaire de
    // `playlists` est COMPOSITE `(id, user_id)`, jamais `id` seul (2
    // comptes différents peuvent légitimement partager le même id, voir
    // la playlist démo évoquée dans PlaylistDetailContext.jsx) — cibler
    // l'incrément par `id` seul risquerait exactement la même collision
    // déjà corrigée une fois sur ce projet.
    // `ownerUsername` (05/08, retour direct : "ajouter le nom du compte
    // créateur... pour mieux se repérer") — lu depuis `row._ownerUsername`
    // (posé par ProfileView.jsx, seul endroit qui connaît le pseudo du
    // profil consulté ; `row.user_id` seul n'a aucune valeur d'affichage).
    // Affiché par PlaylistHeader.jsx tant que la playlist reste en
    // lecture seule.
    // `cloneCount: row.clone_count` (05/08, même retour direct que
    // `ownerUsername` juste au-dessus, même raisonnement) —
    // `row.clone_count` est une VRAIE colonne de `playlists` (voir
    // ProfileView.jsx, PublicItemCard, pour pourquoi une colonne plutôt
    // qu'un champ de `content`), déjà affichée sur la carte d'où vient ce
    // clic, mais jamais transmise à la page détail jusqu'ici.
    setCurrentPlaylist({ ...row.content, id: row.id, user_id: row.user_id, ownerUsername: row._ownerUsername, cloneCount: row.clone_count, isPublic: !!row.is_public, isReadOnly: true });
    changeView('playlist');
  };

  // Ouvre l'aperçu d'une routine PUBLIQUE d'un autre utilisateur (Vague 2,
  // Chantier 1 — UI publique des routines, 02/08, clic sur une carte de
  // ProfileView.jsx) — transposition de `handleOpenPublicPlaylist`
  // ci-dessus, MAIS une routine n'a pas de vue détail dédiée où naviguer en
  // lecture seule (`RoutinesView.jsx` est une grille de cartes, pas de route
  // par item) : le clic ouvre donc une modale d'aperçu légère
  // (PUBLIC_ROUTINE_PREVIEW, voir PublicRoutinePreviewModal.jsx) plutôt
  // qu'une navigation vers une page qui n'existe pas.
  //
  // Même garde-fou EXACT que `handleOpenPublicPlaylist` pour le cas "je
  // consulte ma PROPRE routine publique depuis mon propre profil" — pas de
  // clonage de sa propre routine sur elle-même, on va directement à \"Mes
  // Routines\" à la place, où elle est de toute façon déjà éditable
  // normalement (pas besoin d'un aperçu en lecture seule de son propre
  // contenu).
  const handleOpenPublicRoutine = (row) => {
    if (user && row.user_id === user.id) {
      changeView('routines');
      return;
    }
    openModal('PUBLIC_ROUTINE_PREVIEW', row);
  };

  // Clonage d'une routine publique consultée via PublicRoutinePreviewModal —
  // MÊME schéma exact que `handleClonePlaylist` (usePlaylistLibrary.js) :
  // nouvel id généré côté client (jamais celui de la routine d'origine),
  // `isPublic: false` (on ne republie pas automatiquement une copie chez
  // soi — cohérent avec la philosophie \"full opt-in\" du README), compteurs
  // d'utilisation remis à zéro (une copie n'a encore jamais été relancée
  // par SON nouveau propriétaire).
  const handleClonePublicRoutine = (row) => {
    // Traçabilité de lignée — REFONTE (03/08, même raisonnement que
    // handleClonePlaylist, usePlaylistLibrary.js — voir sa docstring pour
    // le détail complet) : ne pose plus que le maillon IMMÉDIAT
    // (`parentId`/`parentUserId` — `row.id`/`row.user_id`, lus
    // directement, RIEN à dériver). `row` ici est la ligne BRUTE Supabase
    // (contrairement à `currentPlaylist` côté playlists, déjà aplatie) —
    // voir useSyncedCollection.js pour cette différence de forme.
    const parentId = row.id;
    const parentUserId = row.user_id;

    const cloned = {
      ...row.content,
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      isPublic: false,
      manualGenerations: 0,
      recentTrackIds: [],
      createdAt: new Date().toLocaleDateString(),
      // Ne conserver le lien que s'il pointe vers un VRAI utilisateur —
      // sinon (routine fictive de la vitrine, `parentUserId` toujours
      // absent) ces 2 champs resteraient `undefined`, jamais un faux lien
      // pointant vers personne. `isModifiedSinceClone: false` — MÊME
      // raisonnement que handleClonePlaylist (usePlaylistLibrary.js), voir
      // sa docstring pour le détail complet. Plus de
      // `originCreditClaimed` (retiré, voir supabase-schema.sql — le
      // mécanisme qu'il gardait était du code mort).
      ...(parentUserId ? { parentId, parentUserId, isModifiedSinceClone: false } : {}),
    };
    setRoutines(prev => [cloned, ...prev]);
    closeModal();
    changeView('routines');
    showToast('⚡ Routine clonée dans Mes Routines !');

    // Compteur de clonages RÉEL — REFONTE (03/08) : UN SEUL appel RPC
    // désormais (au lieu de 2 avant), MÊME raisonnement que
    // handleClonePlaylist (usePlaylistLibrary.js) — `increment_routine_
    // clone_count` crédite maintenant, EN INTERNE côté serveur, à la fois
    // le maillon immédiat ET l'origine réelle de la chaîne (résolue par
    // `resolve_routine_origin`, jamais calculée ici). Routine fictive de
    // la vitrine (`row.user_id` absent) : `row.id` sert toujours de clé
    // dans `template_clone_counts` — une routine fictive n'a pas de
    // `sourceTemplateId` équivalent aux playlists, elle EST déjà son
    // propre "template" (id fixe, `vitrine-routine-1` etc.).
    // Fire-and-forget dans tous les cas, jamais bloquant/visible en cas
    // d'échec — même raisonnement que côté playlists.
    if (row.user_id) {
      supabase.rpc('increment_routine_clone_count', {
        target_id: row.id,
        target_user_id: row.user_id,
      }).then(({ error }) => {
        if (error) console.error('[App] increment_routine_clone_count a échoué :', error);
      });
    } else {
      supabase.rpc('increment_template_clone_count', {
        target_template_id: row.id,
      }).then(({ error }) => {
        if (error) console.error('[App] increment_template_clone_count a échoué :', error);
      });
    }
  };

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

  // Dropdown utilisateur (Feature UI, 28/07, "Header — menu déroulant avatar")
  // — état d'ouverture + ref pour la fermeture au clic extérieur (voir le
  // useEffect dédié plus bas, juste après le bloc de rendu du bouton
  // avatar). `userMenuRef` pointe sur le CONTENEUR englobant à la fois le
  // bouton avatar ET le dropdown lui-même — un clic sur le bouton (pour
  // ouvrir/fermer) ne doit pas être interprété comme un clic "extérieur".
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Onglet initial de SettingsView (03/08, "cliquer sur mon compte" depuis
  // le dropdown avatar) — `null` = comportement par défaut inchangé
  // (bouton "Réglages" de la Sidebar, `handleOpenSettings` plus bas).
  // Posé juste avant CHAQUE `changeView('settings')`, jamais laissé à une
  // valeur périmée d'une visite précédente (voir la docstring de
  // `initialTab`, SettingsView.jsx, pour pourquoi ça reste fiable malgré
  // un `useState` simple ici plutôt qu'un state plus élaboré).
  const [settingsInitialTab, setSettingsInitialTab] = useState(null);

  // Point d'entrée UNIQUE vers "Réglages" pour la Sidebar (garde le
  // comportement par défaut — jamais 'account' forcé) — la Sidebar
  // continue de recevoir `changeView` pour tous ses autres boutons, mais
  // celui-ci a besoin en plus de réinitialiser `settingsInitialTab` avant
  // d'y naviguer, sinon un onglet 'account' resté posé par une visite
  // précédente via le dropdown avatar s'appliquerait à tort ici aussi.
  // Point d'entrée UNIQUE vers "Réglages" — `tab` optionnel (`null` par
  // défaut = comportement d'origine, utilisé par la Sidebar) ; réinitialise
  // TOUJOURS `settingsInitialTab` avant de naviguer (jamais une valeur
  // périmée d'une visite précédente, voir la docstring de `initialTab`,
  // SettingsView.jsx). Reste UNE SEULE fonction plutôt que 3 call sites
  // dupliquant `setSettingsInitialTab(...); changeView('settings');` côte
  // à côte — Sidebar.jsx (tab par défaut), le dropdown avatar (`'account'`)
  // et désormais StatsView.jsx (`'account'` aussi, carte de confidentialité
  // "Ton profil n'est pas encore public").
  const handleOpenSettings = (tab = null) => {
    setSettingsInitialTab(tab);
    changeView('settings');
  };

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);
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

  // Fix UI/Tech (28/07, "comportement Native App — anti-flash blanc au
  // rubber-banding") — les classes `.dark`/`.naughty` qui pilotent les
  // variables CSS de thème (`--color-base`, etc. — voir index.css) ne
  // vivaient JUSQU'ICI que sur la <div> racine du JSX (voir plus bas dans ce
  // fichier), qui est déjà À L'INTÉRIEUR de <body>. Poser une règle
  // `background: rgb(var(--color-base))` directement sur <html>/<body>
  // (pour éviter le flash blanc natif au survol/dépassement du scroll,
  // "overscroll-behavior") aurait donc TOUJOURS résolu la valeur CLAIRE
  // par défaut de `:root`, jamais celle du mode sombre/Intime réellement
  // actif — <html>/<body> étant des ANCÊTRES de cette div, pas des
  // descendants, ils ne voient jamais ses classes. Ce useEffect reproduit
  // les 2 mêmes classes sur `document.documentElement` (la vraie racine du
  // document), en plus de la div existante (pas à la place — rien d'autre
  // ne dépend de cette dernière, aucune raison de la retirer) : les
  // variables CSS sont désormais aussi bien scopées à la racine réelle du
  // document, donc `html, body { background: rgb(var(--color-base)) }`
  // (index.css) résout enfin la BONNE couleur, quel que soit le thème.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('naughty', isNaughtyMode);
  }, [theme, isNaughtyMode]);

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
  // `signIn`/`signOut` pour les passer à AuthModal/SettingsView.
  // `isAuthModalOpen` vivait ici (state local) avant le chantier "centraliser
  // les modales" (25/07) — dérivée maintenant de ModalContext
  // (`activeModal === 'AUTH'`), voir ModalContainer.jsx.
  const { user, signUp, signIn, signOut, resetPassword, updateEmail, updatePassword, exportUserData, deleteAccount, isSupabaseConfigured, userCount, username, usernameLoading, checkUsernameAvailable, setUsername, profilePrivacy, updatePrivacySettings } = useAuthContext();

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
  // playlistShareCode.js) au montage, une seule fois. Le payload DÉCODÉ (clés
  // courtes ti/ar/bp/du...) devient `modalData` (ModalContext, chantier
  // "centraliser les modales", 25/07) — pas encore une vraie playlist, voir
  // `importSharedPlaylist` plus bas, qui fait la conversion au moment du clic
  // sur "Ajouter à Mes Séances", pas ici (pas besoin de la construire avant
  // que l'utilisateur confirme vouloir l'ajouter). `importedPlaylistPreview`/
  // `isImportModalOpen` vivaient ici en state local avant ce chantier.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('import');
    if (!code) return;

    const decoded = decodePlaylistFromSharing(code);
    if (decoded) {
      openModal('IMPORT_SHARED_PLAYLIST', decoded);
    } else {
      showToast("❌ Ce lien de playlist est invalide ou corrompu.", 'error');
    }
    // Nettoie l'URL dans les 2 cas (valide ou pas) — évite de re-proposer le
    // même import à chaque rafraîchissement de la page.
    window.history.replaceState({}, document.title, window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profil Public (01/08, Feature Sociale Partie 2/3) — détecte
  // `?profile=pseudo` au montage, MÊME PRINCIPE EXACT que `?import=...`
  // juste au-dessus (pas de coïncidence : ce projet n'utilise pas
  // react-router — voir useNavigation.js — donc toute "route" est en
  // réalité un paramètre de requête lu ici, une seule fois, au chargement).
  // Contrairement à `?import=`, pas de décodage local à faire : `pseudo`
  // est directement le nom à interroger, toute la résolution/vérification
  // se fait côté serveur dans ProfileView.jsx (fonction Postgres
  // `get_public_profile_summary`, voir supabase-schema.sql) — rien à valider
  // ici avant de basculer la vue.
  //
  // ⚠️ Pas de vraie route `/user/:username` : un lien direct vers ce chemin
  // ouvert à froid (pas depuis l'app) renverrait un 404 AVANT même que React
  // ne s'exécute, `vercel.json` n'ayant aucune règle de réécriture pour un
  // chemin arbitraire. Un paramètre de requête, lui, atteint toujours
  // `index.html` normalement, quel que soit l'hébergeur.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const profileUsername = params.get('profile');
    if (!profileUsername) return;

    setViewingProfileUsername(profileUsername);
    setView('profile');
    // PAS de nettoyage de l'URL ici (contrairement à `?import=` juste au-
    // dessus) — volontaire : cette page doit rester partageable/rechargeable
    // telle quelle (`tempofit.app/?profile=alex`), exactement comme un lien
    // de playlist reste valide une fois ouvert. Nettoyer l'URL casserait le
    // rafraîchissement de page et le partage du lien lui-même.
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
    isSavingRoutineModalOpen,
    editingRoutine, setEditingRoutine,
    isEditRoutineModalOpen,
    newRoutineName, setNewRoutineName,
    newRoutineIcon, setNewRoutineIcon,
    newRoutineFreq, setNewRoutineFreq,
    getDisplayRoutineName, getDisplayRoutineIcon,
    addRoutine, updateRoutine,
  } = useRoutines(isNaughtyMode, showToast);

  const { userStats, setUserStats, checkTrophies, unseenTrophyCount, markTrophiesSeen } = useUserStats(showToast, user);

  // `userStatsRef` (check-up 10/08 — 5e occurrence de la même famille de
  // course cette session, voir `shareImageFileWithTrophy` plus bas pour le
  // raisonnement complet) — toujours la valeur la PLUS RÉCENTE de
  // `userStats`, mise à jour à chaque rendu.
  const userStatsRef = useRef(userStats);
  userStatsRef.current = userStats;

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
    // `customActivity`/`handleOpenCustomActivityModal` retirées d'ici
    // (08/08, 2e passe) — en vérifiant pourquoi elles devraient migrer vers
    // `useCustomActivityContext()` suite au découpage de
    // `CustomActivityContext.jsx`, découvert qu'elles n'étaient en réalité
    // PLUS utilisées nulle part ailleurs dans ce fichier (commentaire
    // précédent, "customActivity reste nécessaire ci-dessous
    // (handleSaveRoutine)", déjà obsolète — `handleSaveRoutine` vit dans
    // `useRoutineActions.js`, qui lit sa PROPRE copie de `customActivity`
    // via son propre appel de contexte, jamais celle-ci). Code mort
    // retiré plutôt que redirigé pour rien.
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

  // ModalContext (chantier "centraliser les modales", 25/07) — source de vérité
  // unique pour "quelle modale est ouverte" (voir ModalContext.jsx). Appelé ici,
  // tôt, pour que `openModal`/`closeModal`/`activeModal`/`modalData` soient
  // disponibles à tout le corps de AppContent (import partagé, resolvePendingNavigation...).
  const { activeModal, modalData, openModal, closeModal } = useModalContext();

  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  // Playlist d'exemple pré-remplie, même principe que la routine et les favoris de
  // départ — clairement nommée "Exemple" pour ne pas laisser penser qu'elle a été
  // vraiment générée, et laissée en statut "à faire" pour que la découverte du
  // bouton "marquer comme terminée" reste naturelle. `preview: null` ici par
  // défaut : le vrai extrait Deezer est résolu séparément au montage (voir le
  // useEffect dédié plus bas, après celui du <title>) plutôt que codé en dur —
  // une URL d'extrait Deezer expire au bout de quelques heures, donc la figer
  // ici casserait le bouton d'écoute silencieusement après coup.
  // "Refonte Structurale — Round 1/2" (01/08) — remplace
  // `usePersistentState('savedPlaylists', ...)` par
  // `useSyncedCollection('savedPlaylists', 'playlists', ...)` : chaque
  // playlist vit désormais dans sa PROPRE ligne de la table `playlists`
  // (voir supabase-schema.sql) plutôt que dans un blob JSON unique — sans
  // rien changer pour les ~20 appelants existants de `setSavedPlaylists`
  // ailleurs dans l'app (voir la docstring de useSyncedCollection.js pour
  // le raisonnement complet). Mode invité/hors-ligne INCHANGÉ.
  const [savedPlaylists, setSavedPlaylists] = useSyncedCollection('savedPlaylists', 'playlists', () => [{
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
    if (activeModal !== 'IMPORT_SHARED_PLAYLIST' || !modalData) return;
    const preview = modalData;

    const genres = Array.from(new Set(preview.tracks.map(t => t.ge).filter(Boolean)));
    const avgBpm = Math.round(preview.tracks.reduce((s, t) => s + (t.bp || 0), 0) / preview.tracks.length) || 120;

    const rawPlaylist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
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
    closeModal();
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
    shareData,
    isShareModalOpen,
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
  //
  // ⚠️ COURSE CORRIGÉE (check-up 10/08 — 5e occurrence de la même famille
  // cette session, voir PlaylistDetailView.jsx/PlaylistDetailContext.jsx/
  // usePlaylistGeneration.js/useCsvImport.js pour les 4 précédentes, et la
  // FENÊTRE DE COURSE LA PLUS LONGE de toutes : `await shareImageFile(...)`
  // attend `navigator.share()` avec un fichier — la feuille de partage
  // native du système, qui reste ouverte tant que l'utilisateur ne l'a pas
  // fermée/utilisée, potentiellement plusieurs minutes s'il se laisse
  // distraire. `userStats` a largement le temps de changer ENTRE-temps par
  // une tout autre action (terminer une séance, remplacer un titre...).
  // `checkTrophies({ ...userStats, hasSharedSomething: true })` utilisait
  // le `userStats` FIGÉ au moment du clic sur "Partager" — écrasant tout
  // changement concurrent au moment où la feuille de partage se ferme
  // enfin. Corrigé avec le même "patch" que `usePlaylistGeneration.js`
  // (voir sa docstring) : seul le champ RÉELLEMENT ajouté par CETTE action
  // (`hasSharedSomething`) est appliqué par-dessus `userStatsRef.current`
  // (le plus frais), pas l'objet entier.
  const shareImageFileWithTrophy = async (file, title, text) => {
    const result = await shareImageFile(file, title, text);
    if (result !== 'cancelled' && !userStatsRef.current.hasSharedSomething) {
      checkTrophies({ ...userStatsRef.current, hasSharedSomething: true });
    }
    return result;
  };

  // isSearchModalOpen vivait ici en state local avant le chantier "centraliser
  // les modales" (25/07) — dérivée maintenant de ModalContext
  // (`activeModal === 'SEARCH'`). En corrigeant au passage un vrai bug : voir
  // useDeezerSearch.js pour le détail (`closeSearchModal` plantait).
  const isSearchModalOpen = activeModal === 'SEARCH';

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

  // pendingNavigation/pendingUnsavePlaylist vivaient ici en state local avant
  // le chantier "centraliser les modales" (25/07) — désormais représentés par
  // `activeModal === 'PENDING_NAVIGATION' | 'PENDING_UNSAVE'` + `modalData`
  // (ModalContext), déclenchés respectivement par `changeView` (useNavigation.js)
  // et `requestRemoveSavedPlaylist` (usePlaylistLibrary.js) via `openModal(...)`.

  // hasUnsavedPlaylist/changeView/openCuratedPlaylist + l'effet beforeunload
  // extraites dans useNavigation.js (25/07, chantier "réduire le God
  // Component") — même schéma que useRoutineActions.js pour setWizardStep
  // (useGeneratorContext() appelé à l'intérieur du hook).
  const { hasUnsavedPlaylist, changeView, openCuratedPlaylist } = useNavigation(
    view, setView, setIsMobileMenuOpen,
    currentPlaylist, setCurrentPlaylist, savedPlaylists,
    isNaughtyMode,
  );

  // (L'effet `beforeunload` associé à hasUnsavedPlaylist vit maintenant DANS
  // useNavigation.js, avec le reste du cluster — pas dupliqué ici.)

  // Résout la navigation mise en attente par la modale d'avertissement. Lit la
  // vue en attente dans `modalData` (posée par `changeView`, voir
  // useNavigation.js) plutôt que dans un state `pendingNavigation` dédié.
  const resolvePendingNavigation = (shouldSave) => {
    if (shouldSave) handleSavePlaylist();
    const pendingView = activeModal === 'PENDING_NAVIGATION' ? modalData : null;
    if (pendingView) {
      setView(pendingView);
      setIsMobileMenuOpen(false);
      if (pendingView === 'generator') setWizardStep(1);
    }
    closeModal();
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
  // restauration du template pristine), déjà défini plus haut dans ce fichier.
  // La modale de confirmation (openModal('PENDING_UNSAVE', ...)) est gérée par
  // usePlaylistLibrary.js lui-même via ModalContext, pas transmise en paramètre.
  const {
    handleSavePlaylist, handleClonePlaylist, removeSavedPlaylist, playlistHasHistory, requestRemoveSavedPlaylist, setPlaylistPlannedDate,
  } = usePlaylistLibrary(
    currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists, showToast,
    openCuratedPlaylist, userStats, checkTrophies, profilePrivacy?.defaultPlaylistPublic,
  );

  // MIGRÉ VERS PlaylistDetailContext (`handleUnsavePlaylist`, même wrapper
  // autour de requestRemoveSavedPlaylist, gardée ci-dessus car partagée avec
  // PlaylistsView).

  // executeGeneration extraite dans usePlaylistGeneration.js (25/07, chantier
  // "réduire le God Component") — checkGenreWeightDeviation vient de
  // useGeneratorContext() (appelé à l'intérieur du hook). Appelée ici, AVANT
  // useRoutineActions() juste en dessous, qui a besoin d'executeGeneration en
  // paramètre (applyRoutineEditOnce/Permanently).
  const { executeGeneration, cancelGeneration } = usePlaylistGeneration(
    showToast, userStats, checkTrophies,
    routines, setRoutines,
    favorites, spotifyTrackPool, isNaughtyMode,
    setCurrentPlaylist, changeView,
    savedPlaylists, setSavedPlaylists,
    setIsGenerating, setGeneratingTotal, setGeneratingDone, setIsGeneratingSlowGenre,
  );

  const { toggleNaughtyMode, handleSaveRoutine, applyRoutineEditOnce, applyRoutineEditPermanently } = useRoutineActions(
    isNaughtyMode, setIsNaughtyMode, showToast,
    routines, addRoutine, updateRoutine,
    editingRoutine, setEditingRoutine,
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
  const { triggerCSVUpload, handleCSVUpload, removeImportedData } = useCsvImport(
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
    cardBg, cardBorder, cardBorderStrong, inputBg, inputBorder, textMuted, textHighlight,
  } = themeTokens;

  // Fermeture SESSION-ONLY de la guest bar (03/08) : REMONTÉE ici depuis
  // GuestModeBar.jsx (04/08, retour direct "je dois pouvoir scroll QUAND la
  // barre est visible, et ne PLUS avoir à scroller une fois qu'elle est
  // masquée"). Avant ce changement, `dismissed` était un `useState` strictement
  // LOCAL à GuestModeBar.jsx : personne en dehors du composant — ni le spacer
  // du contenu principal (plus bas), ni `bottomBarPadding`/`creditRowHeight`
  // dans Sidebar.jsx (qui se basaient déjà sur `isGuestBarVisible`, voir plus
  // bas) — ne pouvait savoir que la barre avait été masquée. Résultat concret :
  // fermer la barre ne libérait jamais l'espace qu'elle réservait, contraire à
  // ce qui était demandé. Le comportement "session-only" (repli à zéro à
  // chaque vrai rechargement de page, jamais persisté) est INCHANGÉ : un
  // simple `useState`, juste possédé un cran plus haut désormais.
  const [isGuestBarDismissed, setIsGuestBarDismissed] = useState(false);

  // Source unique de vérité, calculée UNE SEULE FOIS ici et partagée entre
  // GuestModeBar (l'affiche), le spacer du contenu principal ET Sidebar
  // (cache son propre crédit dans ce cas précis) — voir GuestModeBar.jsx pour
  // tout l'historique du bug que ça corrige (les deux crédits pouvaient
  // s'afficher en double sur les pages où la sidebar est plus courte).
  // Reprend l'esprit "Soft Gating" d'origine (voir PlaylistsView.jsx/
  // StatsView.jsx) : rien à perdre encore, pas la peine d'alerter dès la
  // toute première visite. Volontairement PAS basé sur `favorites` : 2
  // artistes de démo y sont pré-remplis dès l'installation (voir
  // useFavorites.js), ce qui rendrait la condition vraie en permanence.
  // BUG CORRIGÉ (25/07) : cette ligne vivait par erreur dans le mauvais
  // composant — `App()`, le simple assembleur de Providers tout en bas de ce
  // fichier, qui n'a jamais eu `user`/`savedPlaylists`/`routines` en portée
  // (ceux-ci n'existent que dans CE composant-ci, `AppContent`) — d'où un
  // `ReferenceError: user is not defined` en production, page blanche.
  // `&& !isGuestBarDismissed` AJOUTÉ (04/08) : sans quoi la variable ne
  // reflétait que "c'est un invité avec des données", jamais "et il n'a pas
  // déjà masqué le rappel cette visite" — voir le commentaire ci-dessus.
  const isGuestBarVisible = !user && (savedPlaylists.length > 0 || routines.length > 0) && !isGuestBarDismissed;

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} ${isNaughtyMode ? 'naughty' : ''}`}>
      {/* `h-screen overflow-hidden` déjà en place avant ce chantier (layout
          Dashboard, 27/07) — le <body> ne scrolle donc déjà jamais, seules
          les zones internes le font (`overflow-y-auto` sur `<main>`, voir
          plus bas). `w-screen` ajouté ici en plus (28/07, conformité brief
          "Native App") — redondant dans la plupart des cas (ce <div> de
          bloc prend déjà 100% de la largeur de son parent par défaut, et
          <body> couvre déjà toute la largeur de la fenêtre), mais explicite
          plutôt qu'implicite, et sans risque. */}
      <div className={`flex h-screen w-screen overflow-hidden ${bgMainApp} ${textMain} font-sans selection:bg-${themeColor}-500 selection:text-white transition-colors duration-500 relative`}>

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
          } px-6 py-3 rounded-full flex items-center space-x-3`}>
            {toast.variant === 'special' ? <Trophy size={18} className="text-yellow-500 fill-yellow-500" /> :
             toast.variant === 'ambiance' ? <Heart size={18} className="text-rose-500 fill-rose-500" /> :
             toast.variant === 'error' ? <AlertCircle size={18} className="text-red-500" /> :
             <Check size={18} className={textColorClass} />}
            {/* `whitespace-nowrap` (retour direct — "le texte doit tenir
                sur une seule ligne") : garde-fou technique EN PLUS des
                textes raccourcis à la source (voir PlaylistsView.jsx/
                RoutinesView.jsx/PlaylistDetailContext.jsx) — pas un
                remplacement. Sans texte suffisamment court, un très long
                nom de playlist/routine (aucune longueur maximale
                imposée, voir MIN_PLAYLIST_NAME_LENGTH seul dans
                appConfig.js) pourrait toujours élargir ce toast au point
                de dépasser l'écran sur mobile — accepté comme limite
                connue, pas vérifiable ici sans rendu réel. */}
            <span className={`font-medium whitespace-nowrap ${toast.variant === 'error' ? 'text-red-600 dark:text-red-400' : textHighlight}`}>{toast.message}</span>
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
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[80] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl px-6 py-3 rounded-full flex items-center space-x-3 max-w-[90vw]">
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
            {/* Bouton Annuler — voir cancelGeneration (usePlaylistGeneration.js)
                pour ce qu'il fait réellement (ne coupe pas la requête réseau en
                cours, jette juste son résultat) et pourquoi. */}
            <button
              onClick={cancelGeneration}
              title="Annuler la génération"
              className={`shrink-0 p-1 ${ICON_BUTTON_ROUNDING} ${textMuted} hover:text-red-500 hover:bg-red-500/10 transition-colors`}
            >
              <X size={16} />
            </button>
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
          cardBorder={cardBorder} cardBorderStrong={cardBorderStrong} bgAccentClass={bgAccentClass} isNaughtyMode={isNaughtyMode}
          textHighlight={textHighlight} textColorClass={textColorClass} textMuted={textMuted}
          isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
          changeView={changeView} view={view}
          onOpenSettings={handleOpenSettings}
          favorites={favorites}
          user={user} unseenTrophyCount={unseenTrophyCount}
          guestBarVisible={isGuestBarVisible}
          playerBarVisible={!!(currentTrack || playingPreviewId)}
          toggleNaughtyMode={toggleNaughtyMode}
          theme={theme} toggleTheme={toggleTheme}
        />

        <div className="flex-1 flex flex-col relative w-full">
          {/* Header mobile (bouton burger + logo) */}
          <header className={`md:hidden flex items-center p-4 bg-surface border-b ${cardBorder} z-30`}>
            <button onClick={() => setIsMobileMenuOpen(true)} className={`p-2 mr-3 ${textMuted} hover:text-main bg-surface-hover ${ICON_BUTTON_ROUNDING}`}><Menu size={20} /></button>
            <button onClick={() => changeView('generator')} title="Retour à l'accueil" className="flex items-center space-x-2 cursor-pointer">
              <span className={`font-bold text-lg tracking-tight ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
            </button>
          </header>

          {/* Header desktop flottant, n'apparaît qu'après un certain scroll (isScrolled) */}
          <header className={`hidden md:flex absolute top-0 left-0 right-0 p-6 z-30 transition-all duration-300 pointer-events-none ${isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className={`bg-surface/80 backdrop-blur-md border ${cardBorder} shadow-lg px-6 py-3 rounded-full flex items-center space-x-4 pointer-events-auto`}>
              {/* STATIQUE (Refactor UI "Suppression du lien de retour sur les
                  titres de pages", 29/07, retour direct : capture montrant
                  l'infobulle "Retour à l'accueil" superposée au titre de
                  page) — cette pastille flottante dupliquait le comportement
                  du logo Sidebar (toujours visible juste à côté sur
                  desktop) : `onClick`/`title`/`cursor-pointer` retirés,
                  `<button>` redevient un `<span>` neutre. */}
              <span className={`font-bold text-sm ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
              <div className={`w-1 h-1 rounded-full ${bgAccentClass}`}></div>
              <span className={`text-sm font-medium ${textMuted}`}>{displaySubtitleGen}</span>
            </div>
          </header>

          {/* Padding supérieur RÉDUIT (25/07, "uniformisation des largeurs de
              vues et alignement vertical") — `pt-6 sm:pt-8` (aligné sur le
              padding latéral `px-4 sm:px-8`), contre `pt-20 sm:pt-24` avant.
              L'ancienne marge énorme poussait le titre de chaque vue très en
              dessous des boutons flottants Thème/Connexion (voir juste plus
              bas), créant un grand vide au-dessus du contenu. La protection
              contre une collision horizontale avec ces boutons (toujours
              `absolute`, toujours au-dessus du flux) est maintenant assurée
              PAR CHAQUE VUE elle-même (`pr-32 md:pr-40` sur le bloc d'en-tête
              — voir GeneratorView.jsx/PlaylistsView.jsx/etc.), pas par cette
              marge globale. */}
          {/* Harmonisation de la ligne de flottaison (Refactor UI, 29/07,
              retour direct : "léger décalage visuel en haut d'écran entre
              le logo et les titres de page") — `pt-6 sm:pt-8` ESCALADAIT
              avec le breakpoint (24px → 32px dès `sm:`), alors que le bloc
              logo de la Sidebar reste fixe à `p-6` (24px, AUCUNE variante
              responsive, voir Sidebar.jsx) : sur desktop (`sm:` et plus,
              exactement la disposition où Sidebar+contenu principal sont
              visibles côte à côte), le titre de page démarrait donc 8px
              plus bas que le logo. Valeur désormais centralisée dans
              `viewHeaderLayout.js` (`VIEW_HEADER_TOP_PADDING`), partagée
              avec le côté haut du bloc logo de la Sidebar — un futur
              ajustement se fait à un seul endroit, plus jamais aux 2. */}
          {/* `sm:pb-6` (PAS `sm:pb-8`) — 03/08, retour direct, capture d'écran :
              "c'est la même page au même moment, que je peux continuer à
              scroll" — la refonte `min-h-[450px]` (GeneratorWizard.jsx)
              réglait l'espace mort À L'INTÉRIEUR de la carte, mais pas ce
              padding de bas de page, une source DIFFÉRENTE des quelques
              pixels de trop. Réduit ici avec les 3 autres petites marges
              identifiées à cette occasion (GeneratorView.jsx `space-y-8`→
              `space-y-6`, GeneratorWizard.jsx barre de progression `mb-8`→
              `mb-6` et pied de page `pt-8`→`pt-6`) plutôt qu'un seul gros
              changement au même endroit — chacune contribue modestement
              (8px), le cumul devrait couvrir "quelques pixels" sans rendre
              une seule zone visuellement resserrée à elle seule. Best-effort
              documenté : sans navigateur réel dans cet environnement, la
              valeur exacte qui suffit ne peut être confirmée qu'en
              conditions réelles (voir CLAUDE-SANDBOX-VERIFICATION.md). */}
          <main id="main-scroll-area" className={`relative flex-1 overflow-y-auto ${VIEW_HEADER_TOP_PADDING} px-4 sm:px-8 pb-4 sm:pb-6 no-scrollbar`}>

            {/* Bloc connexion — Polish UX (28/07, "icône standard haut-
                droite") : remplace le bouton pilule "Se connecter" (texte +
                fond plein) par une simple icône silhouette minimaliste,
                réintroduite comme point d'entrée universel — le coin
                supérieur droit reste le standard cognitif pour "mon compte",
                indépendamment de GuestModeBar (qui, elle, reste le CTA
                principal en bas). Condition `!isGuestBarVisible` du chantier
                précédent RETIRÉE ici à dessein : ce bouton est maintenant
                assez discret (icône seule, ~40px) pour ne plus justifier de
                se masquer selon l'état de GuestModeBar — y compris sur
                PlaylistDetailView, où GuestModeBar est déjà visible : les
                deux coexistent sans problème, l'icône n'a pas le gabarit
                pour recréer le risque de collision avec le titre de
                PlaylistHeader.jsx qui avait motivé cette condition à
                l'origine (voir historique de ce bloc).
                Bouton avatar (utilisateur CONNECTÉ) — Feature UI (28/07,
                "menu déroulant avatar") : n'appelle plus directement
                `changeView('settings')` au clic ; ouvre désormais un
                dropdown (voir `isUserMenuOpen`/`userMenuRef` plus haut)
                avec l'e-mail du compte + "Se déconnecter". Réglages reste
                accessible via son propre bouton dans la Sidebar — ce menu-
                ci n'a pas besoin de dupliquer ce lien.
                ⚠️ MIS À JOUR (03/08) — le paragraphe ci-dessus décrit
                l'état du 28/07, plus tout à fait exact : le bloc pseudo/
                e-mail EN TÊTE du dropdown est désormais lui-même cliquable
                et ouvre Réglages directement sur l'onglet "Mon Compte"
                (`handleOpenSettings('account')`, voir le bloc plus bas —
                même fonction que le bouton Réglages de la Sidebar, juste
                avec un onglet de départ différent). Décision délibérée de
                garder l'ouverture du dropdown lui-même au
                CLIC sur l'avatar (pas au survol) — un menu au survol n'a
                pas d'équivalent sur mobile/tactile. Le reste du paragraphe
                (Réglages accessible via la Sidebar, "Rechercher un
                profil"/"Se déconnecter" inchangés) reste vrai. */}
            {/* top-offset RECALCULÉ (Refactor UI "ligne de flottaison",
                29/07, 8e itération, retour direct : "le bouton thème doit
                être parfaitement aligné avec le bouton de connexion") —
                `md:top-6` (24px) ne centrait plus ce bouton sur la ligne du
                logo Sidebar depuis l'agrandissement de son icône (28→34px,
                7e itération) : centre de la ligne logo = pt-6 (24px) +
                moitié du badge (icône 34px + padding p-1.5×2 = 46px) =
                47px depuis le haut ; ce bouton (icône 20px + padding p-2 =
                36px de haut) doit donc démarrer à 47 − 36/2 = 29px pour
                que SON centre tombe au même endroit — d'où `md:top-[29px]`
                plutôt que `md:top-6`. `top-4` (mobile, Sidebar masquée,
                pas de logo à côté à cet endroit) reste inchangé — cet
                alignement ne concerne que la disposition desktop. */}
            <div className="absolute top-4 right-4 md:top-[29px] md:right-8 z-[60] flex items-center gap-2">
              {isSupabaseConfigured && (
                user ? (
                  <div ref={userMenuRef} className="relative">
                    <button
                      onClick={() => setIsUserMenuOpen((v) => !v)}
                      title={username ? `@${username}` : user.email}
                      className={`w-11 h-11 ${ICON_BUTTON_ROUNDING} shadow-lg border hover:scale-110 transition-transform flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 border-green-200 dark:border-green-700/50 font-bold cursor-pointer`}
                    >
                      {/* Initiale du PSEUDONYME plutôt que de l'e-mail
                          (Feature, 28/07, "identifiant public") — repli sur
                          l'e-mail tant que `username` n'est pas encore
                          chargé/défini (comptes créés avant cette
                          fonctionnalité, voir SettingsView.jsx pour le
                          formulaire de 1re définition). */}
                      {(username || user.email).charAt(0).toUpperCase()}
                    </button>

                    {isUserMenuOpen && (
                      <div className={`absolute right-0 mt-2 w-60 rounded-xl border ${cardBorder} ${cardBg} shadow-xl z-50 overflow-hidden`}>
                        {/* Bloc pseudo/e-mail CLIQUABLE (03/08, retour
                            direct : "cliquer sur mon compte devrait ouvrir
                            mes réglages dans la partie mon compte") —
                            avant, ce bloc était du texte statique, un vrai
                            "clic mort" à l'endroit le plus intuitif pour y
                            aller. Choix délibéré, discuté avec
                            l'utilisateur, de GARDER le menu déroulant
                            au CLIC sur l'avatar (pas au survol) : un menu
                            au survol n'a pas d'équivalent sur mobile/tactile
                            (pas de `:hover`), ce serait casser l'accès sur
                            une bonne partie des visiteurs de l'app. Le clic
                            sur l'avatar reste donc identique à avant — seul
                            CE bloc, à l'intérieur du menu déjà ouvert,
                            devient un lien, pattern standard (GitHub,
                            Slack...) : avatar → menu → son propre nom en
                            tête → réglages du compte. */}
                        <button
                          onClick={() => { setIsUserMenuOpen(false); handleOpenSettings('account'); }}
                          className="w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                          {/* Pseudonyme en gras + e-mail en texte secondaire
                              juste en dessous (Feature, 28/07) — remplace
                              l'ancien "Connecté en tant que [email]" : le
                              pseudonyme est maintenant l'identité mise en
                              avant, l'e-mail redevient une information
                              secondaire. Repli sur l'ancien affichage tant
                              que `username` n'existe pas encore. */}
                          {username ? (
                            <>
                              <p className={`text-sm font-bold truncate ${textHighlight}`}>@{username}</p>
                              <p className={`text-xs truncate ${textMuted}`}>{user.email}</p>
                            </>
                          ) : (
                            <>
                              <p className={`text-xs ${textMuted}`}>Connecté en tant que</p>
                              <p className={`text-sm font-bold truncate ${textHighlight}`}>{user.email}</p>
                            </>
                          )}
                        </button>
                        <div className={`border-t ${cardBorder} my-0`} />
                        {/* Rechercher un profil (Feature Sociale —
                            Navigation, 01/08, retour direct : "je la veux
                            en option... quand je clique sur mon logo pour
                            voir éventuellement d'autres utilisateurs") —
                            ouvre SearchUsersModal.jsx (déjà câblée plus
                            bas dans ce fichier). `setIsUserMenuOpen(false)`
                            avant `openModal` : ferme CE menu-ci en premier,
                            même geste que "Se déconnecter" juste en
                            dessous — jamais les deux ouverts en même
                            temps. */}
                        <button
                          onClick={() => { setIsUserMenuOpen(false); openModal('SEARCH_USERS'); }}
                          className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-bold ${textHighlight} hover:bg-surface-hover transition-colors cursor-pointer`}
                        >
                          <SearchIcon size={16} />
                          Rechercher un profil
                        </button>
                        <div className={`border-t ${cardBorder} my-0`} />
                        <button
                          onClick={() => { setIsUserMenuOpen(false); signOut(); }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <LogOut size={16} />
                          Se déconnecter
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  // Style "ghost" adaptatif : transparent au repos, même
                  // paire de tokens déjà utilisée pour les boutons Thème/
                  // Trophées de Sidebar.jsx (`${textMuted} hover:bg-surface-
                  // hover hover:text-main`) plutôt que du `text-slate-500`/
                  // `hover:bg-white/5` en dur (invisible ou trop faible dans
                  // un des deux thèmes, même famille de piège que les
                  // chantiers précédents sur ce fichier) — cohérence totale
                  // avec les autres boutons "icône seule" déjà dans l'app.
                  <button
                    onClick={() => openModal('AUTH')}
                    title="Se connecter"
                    className={`p-2 ${ICON_BUTTON_ROUNDING} transition-colors duration-200 ${textMuted} hover:bg-surface-hover hover:text-main`}
                  >
                    <UserIcon size={20} strokeWidth={2} />
                  </button>
                )
              )}
            </div>


            {/* Suspense unique pour les 9 vues lazy ci-dessus (voir le
                commentaire près des imports) — un SEUL fallback pour tout le
                switch puisqu'une seule vue est jamais montée à la fois. Motif
                de chargement identique à celui déjà utilisé ailleurs dans ce
                fichier (`Loader2 animate-spin` + `textColorClass`, voir plus
                haut) plutôt qu'un nouveau style de spinner. Ne s'affiche
                QUE lors du tout premier changement vers une vue donnée (son
                chunk JS est ensuite mis en cache par le navigateur) — jamais
                vu du tout pour la vue affichée au chargement initial de
                l'app, elle est déjà prête au moment où ce composant monte. */}
            <Suspense fallback={
              <div className="flex items-center justify-center py-24">
                <Loader2 size={28} className={`animate-spin ${textColorClass}`} />
              </div>
            }>
            {/* ===================== VIEW: GENERATOR (ASSISTANT MULTI-ETAPES) ===================== */}
            {view === 'generator' && (
              // Chantier God Component étape 2 : cet appel ne porte plus QUE
              // les props qui ne viennent PAS de GeneratorContext (theme,
              // orchestration App.jsx — recherche/génération/sauvegarde —,
              // showToast). GeneratorView lit désormais tout le reste
              // (workoutType, bpm, segments, genres, profil athlétique...)
              // directement via useGeneratorContext(). Passé de 93 à 15 props.
              <GeneratorView
                theme={themeTokens}
                toggleNaughtyMode={toggleNaughtyMode} changeView={changeView}
                setCurrentPlaylist={setCurrentPlaylist} setIsBpmSearchMode={setIsBpmSearchMode}
                setSearchQuery={setSearchQuery} setWorldSearchResults={setWorldSearchResults}
                setResultsContextLabel={setResultsContextLabel} setNoUsableResultsHint={setNoUsableResultsHint}
                searchTracksByBpm={searchTracksByBpm}
                executeGeneration={executeGeneration} isGenerating={isGenerating}
              />
            )}

            {view === 'discover' && (
              <DiscoverView theme={themeTokens} onPlayTemplate={openCuratedPlaylist} isNaughtyMode={isNaughtyMode} user={user} openModal={openModal} onViewOfficialProfile={() => handleViewProfile(OFFICIAL_VITRINE_USERNAME)} />
            )}

            {view === 'profile' && (
              <ProfileView theme={themeTokens} username={viewingProfileUsername} isNaughtyMode={isNaughtyMode} changeView={changeView} user={user} openModal={openModal} onOpenPlaylist={handleOpenPublicPlaylist} onOpenRoutine={handleOpenPublicRoutine} />
            )}

            {view === 'routines' && (
              <RoutinesView
                theme={themeTokens} isNaughtyMode={isNaughtyMode} routines={routines} setRoutines={setRoutines}
                routineBatchCounts={routineBatchCounts} setRoutineBatchCounts={setRoutineBatchCounts}
                getDisplayRoutineIcon={getDisplayRoutineIcon} getDisplayRoutineName={getDisplayRoutineName}
                renderConfigInfoLine={renderConfigInfoLine} getRankStyle={getRankStyle}
                setEditingRoutine={setEditingRoutine}
                executeGeneration={executeGeneration} isGenerating={isGenerating} changeView={changeView}
                showToast={showToast}
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
                triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
                markPlaylistAsCompleted={markPlaylistAsCompleted}
                showToast={showToast}
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
                user={user} username={username} profilePrivacy={profilePrivacy}
                onViewOwnProfile={() => handleViewProfile(username)}
                onManageProfilePrivacy={() => handleOpenSettings('account')}
              />
            )}

            {/* ===================== VIEW: SETTINGS (OPTIONS ET COMPTES) ===================== */}
            {view === 'settings' && (
              <SettingsView
                theme={themeTokens} spotifyToken={spotifyToken} loginSpotify={loginSpotify} setSpotifyToken={setSpotifyToken}
                spotifyRedirectUri={REDIRECT_URI}
                user={user} updateEmail={updateEmail} isSupabaseConfigured={isSupabaseConfigured}
                updatePassword={updatePassword} exportUserData={exportUserData} deleteAccount={deleteAccount}
                username={username} usernameLoading={usernameLoading} checkUsernameAvailable={checkUsernameAvailable} setUsername={setUsername}
                profilePrivacy={profilePrivacy} updatePrivacySettings={updatePrivacySettings}
                userCount={userCount}
                isNaughtyMode={isNaughtyMode} showToast={showToast} changeView={changeView}
                onViewOwnProfile={() => handleViewProfile(username)}
                initialTab={settingsInitialTab}
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
                setWorldSearchResults={setWorldSearchResults}
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
              <TrophiesView theme={themeTokens} userStats={userStats} handleShare={handleShare} isNaughtyMode={isNaughtyMode} markTrophiesSeen={markTrophiesSeen} />
            )}

            {view === 'playlist' && currentPlaylist && (
              <PlaylistDetailView
                currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
                savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
                favorites={favorites} spotifyTrackPool={spotifyTrackPool}
                userStats={userStats} checkTrophies={checkTrophies}
                showToast={showToast} requestRemoveSavedPlaylist={requestRemoveSavedPlaylist} handleSavePlaylist={handleSavePlaylist}
                handleClonePlaylist={handleClonePlaylist}
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
                setIsBpmSearchMode={setIsBpmSearchMode}
                setPlaylistPlannedDate={setPlaylistPlannedDate}
                editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
                getRankStyle={getRankStyle} triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
                username={username}
                changeView={changeView} onViewProfile={handleViewProfile}
              />
            )}
            </Suspense>

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
            {/* Spacer JUMEAU de celui juste au-dessus, pour la barre "mode
                invité" (voir plus bas, conteneur commun avec MiniPlayerBar)
                — même principe (enfant réel dans le flux, pas un padding
                fixe). Utilise désormais `isGuestBarVisible` (calculée plus
                haut) plutôt que de redupliquer la condition brute : la même
                variable pilote maintenant CE spacer, la prop `isVisible` de
                GuestModeBar plus bas, ET `guestBarVisible` sur Sidebar — un
                seul état, jamais 3 sources qui peuvent diverger.
                ⚠️ BUG CORRIGÉ (04/08, retour direct "je dois pouvoir scroll
                QUAND la barre est visible, zéro scroll une fois masquée") :
                CE spacer était bloqué à `h-10` (40px) depuis l'ancien design
                1-ligne de la barre (28/07) — jamais mis à jour quand sa
                hauteur réelle est passée à 72px le 29/07 ("aération footer/
                GuestBar"). Résultat concret : la barre (72px, fixed, hors du
                flux) pouvait recouvrir jusqu'à 32px de contenu réel que ce
                spacer ne compensait pas — exactement le "scroll résiduel"/
                bouton coupé documenté (sans jamais avoir été relié à cette
                cause précise) dans GeneratorWizard.jsx. `h-[72px]` (valeur
                littérale, PAS interpolée depuis GUEST_MODE_BAR_HEIGHT_PX —
                contrainte Tailwind JIT documentée dans bottomBarLayout.js)
                remplace `h-10` pour matcher exactement la vraie hauteur de
                GuestModeBar.jsx, sans marge de sécurité superflue : cette
                barre est un bloc `flex items-center` à hauteur fixe et
                connue, pas un contenu de hauteur imprévisible (contrairement
                au mini-lecteur juste au-dessus, qui garde volontairement une
                marge). Les deux spacers s'additionnent naturellement dans le
                flux normal du document quand les deux barres sont visibles
                en même temps — pas besoin d'une condition combinée qui
                recalcule une hauteur totale à la main. */}
            {isGuestBarVisible && <div className="h-[72px] shrink-0 w-full"></div>}
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

        {/* PendingNavigationModal/PendingUnsaveModal migrées vers ModalContext
            (25/07, chantier "centraliser les modales") — rendues par
            <ModalContainer/>, voir plus bas. */}

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
          isSavingRoutineModalOpen={isSavingRoutineModalOpen} onClose={closeModal}
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
          isEditRoutineModalOpen={isEditRoutineModalOpen} onClose={closeModal}
          editingRoutine={editingRoutine} setEditingRoutine={setEditingRoutine}
          showExtraGenres={showExtraGenres} setShowExtraGenres={setShowExtraGenres}
          getProfileForWorkout={getProfileForWorkout} CRESCENDO_MIN_MAIN_PCT={CRESCENDO_MIN_MAIN_PCT}
          applyRoutineEditOnce={applyRoutineEditOnce} applyRoutineEditPermanently={applyRoutineEditPermanently}
        />


        {/* Extrait dans ShareModal.jsx — BUG CORRIGÉ (historique, gardé pour
            mémoire) : handleShare() préparait shareData et ouvrait
            isShareModalOpen, mais aucune fenêtre ne s'affichait nulle part
            avant ça (le bouton "Partager" ne faisait donc rien de visible).
            copyToClipboard existait déjà et n'attendait que son interface.
            `isShareModalOpen`/`shareData` viennent maintenant de ModalContext
            via useShare.js (chantier "centraliser les modales", 25/07). */}
        <ShareModal
          theme={themeTokens}
          isShareModalOpen={isShareModalOpen} onClose={closeModal} shareData={shareData}
          shareNative={shareNative} shareToWhatsApp={shareToWhatsApp} shareToTwitter={shareToTwitter} shareToFacebook={shareToFacebook}
          copyToClipboard={copyToClipboard} shareViaEmail={shareViaEmail}
          shareImageFile={shareImageFileWithTrophy}
          summaryImageStatus={summaryImageStatus} summaryImageFile={summaryImageFile}
          summaryImagePreviewUrl={summaryImagePreviewUrl}
          includeSummaryImage={includeSummaryImage} setIncludeSummaryImage={setIncludeSummaryImage}
        />

        {/* Feature Sociale — Navigation (01/08) — déclenchée depuis le
            bouton loupe de Sidebar.jsx, `activeModal === 'SEARCH_USERS'`
            (ModalContext, même mécanisme que ShareModal juste au-dessus).
            `onViewProfile` bascule directement `view` sur 'profile' — pas
            besoin de passer par un paramètre d'URL `?profile=...` ici,
            contrairement à un lien externe (voir le useEffect de détection
            plus haut) : on est DÉJÀ dans l'app, changer le state suffit. */}
        <SearchUsersModal
          theme={themeTokens}
          isOpen={activeModal === 'SEARCH_USERS'} onClose={closeModal}
          user={user} onViewProfile={handleViewProfile}
        />

        {/* AuthModal/ImportSharedPlaylistModal/PendingNavigationModal/PendingUnsaveModal
            — les 4 premières modales migrées vers ModalContext (25/07, chantier
            "centraliser les modales" — suggestion initiale de Gemini, vérifiée
            et adaptée avant implémentation, voir ModalContext.jsx). Les 6
            autres modales du projet restent rendues directement ici pour
            l'instant (voir ModalContext.jsx pour le détail du périmètre). */}
        <ModalContainer
          theme={themeTokens}
          signUp={signUp} signIn={signIn} resetPassword={resetPassword} checkUsernameAvailable={checkUsernameAvailable} showToast={showToast}
          onImportSharedPlaylist={importSharedPlaylist}
          resolvePendingNavigation={resolvePendingNavigation}
          removeSavedPlaylist={removeSavedPlaylist}
          onCloneRoutine={handleClonePublicRoutine}
        />

        {/* Conteneur commun (25/07) — empile la notice "mode invité" avec
            MiniPlayerBar SANS deviner la hauteur de l'une pour positionner
            l'autre au-dessus : un simple `flex-col` ancré au bas du viewport,
            chaque enfant réel dans le flux détermine sa propre hauteur, et
            l'ORDRE du JSX fixe qui est au-dessus de qui — MiniPlayerBar en
            dernier = toujours collée au vrai bas d'écran (comportement
            inchangé pour le lecteur, prioritaire au pouce sur mobile).
            Choix assumé suite à un retour direct de l'utilisateur : "pas
            dans la sidebar, ça surcharge le menu — plutôt une barre
            horizontale pleine largeur, pour tous les comptes invités".
            Remplace une tentative précédente dans la même session (bloc
            ajouté à Sidebar.jsx) qui vivait dans la mauvaise zone d'affichage
            au regard de cette demande — entièrement retirée de là-bas.
            z-[65] repris tel quel de l'ancien MiniPlayerBar (cohérent avec la
            hiérarchie z-index existante — Sidebar z-50 < badge trophée/
            connexion z-[60] < CE conteneur z-[65] < modales z-[70] < toasts
            z-[80]) : posé maintenant sur le conteneur plutôt que sur
            MiniPlayerBar individuellement, puisque c'est lui qui gère le
            positionnement fixe désormais.
            `left-0 md:left-64 w-full md:w-[calc(100%-16rem)]` (layout
            Dashboard, retour direct : "la Sidebar doit être une colonne
            ininterrompue de haut en bas, sa bordure droite doit descendre
            jusqu'en bas") — remplace `left-0 right-0` : sur mobile la
            Sidebar est hors-écran par défaut (`-translate-x-full`, sauf menu
            ouvert), donc ces barres restent pleine largeur ; à partir de
            `md`, la Sidebar redevient une vraie colonne (`md:relative`,
            toujours visible) et ces barres se calent maintenant À CÔTÉ
            d'elle plutôt que de passer PAR-DESSUS — l'ancien chevauchement
            forçait à dupliquer le crédit "Un projet créé par..." dans
            GuestModeBar.jsx (voir son ancienne docstring) pour ne pas le
            recouvrir ; ce hack n'a plus lieu d'être une fois que la Sidebar
            n'est plus jamais recouverte sur desktop (retiré de
            GuestModeBar.jsx/Sidebar.jsx, voir ces fichiers). */}
        <div className="fixed bottom-0 left-0 md:left-64 w-full md:w-[calc(100%-16rem)] z-[65] flex flex-col">
          {/* Chantier God Component (suite) : ne reçoit plus que theme et
              currentPlaylist (seule dépendance hors du périmètre
              d'AudioPlayerContext) — lit tout le reste (currentTrack,
              isPlaying, pause/reprise/fermeture, skip précédent/suivant)
              directement via useAudioPlayer(). */}
          <MiniPlayerBar theme={themeTokens} currentPlaylist={currentPlaylist} changeView={changeView} />
          {/* Extraite dans son propre fichier (25/07, même principe que
              MiniPlayerBar juste au-dessus) — voir GuestModeBar.jsx pour
              tout le raisonnement (pourquoi cet ordre, pourquoi la réplique
              du crédit sidebar). `isVisible` reçue toute faite (pas
              recalculée ici) — voir isGuestBarVisible ci-dessus.
              `onDismiss` (04/08) : remplace l'ancien `useState` local du
              composant — voir isGuestBarDismissed ci-dessus pour le
              raisonnement complet. GuestModeBar ne possède plus que
              `confirmingDismiss` (état d'affichage pur, propre à lui,
              personne d'autre n'en a besoin) ; la décision finale "masqué
              ou non" remonte ici. */}
          <GuestModeBar
            theme={themeTokens} isVisible={isGuestBarVisible} openModal={openModal}
            onDismiss={() => setIsGuestBarDismissed(true)}
          />
        </div>

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
 * `isNaughtyMode` et l'instance UNIQUE de useAthleticProfile() vivent ici et
 * sont transmis 2 fois : une fois au Provider (pour que GeneratorView les
 * récupère via useGeneratorContext()), une fois en props classiques à
 * AppContent (qui en a toujours besoin directement — StatsView,
 * PlaylistDetailView, Sidebar, et ses propres fonctions comme
 * handleSaveRoutine/toggleNaughtyMode ne passent pas par ce contexte).
 * Résultat : une seule source de vérité pour chacun des 2, jamais dupliquée,
 * distribuée par 2 canaux différents selon qui la consomme.
 *
 * `toast`/`showToast` (useToast()) suivent EXACTEMENT le même schéma, ajoutés
 * ici pour <AudioPlayerProvider> (useAudioPreview en dépend) — remontés pour
 * la même raison que athleticProfile, jamais dupliqués (voir useToast.js).
 *
 * Imbrication des Providers : `AthleticProvider`/`GeneratorProvider`/
 * `AudioPlayerProvider` sont indépendants les uns des autres (aucun ne lit
 * l'état d'un autre) — leur ordre relatif n'a donc aucune importance
 * fonctionnelle. AuthProvider reste dans main.jsx, au-dessus des trois.
 *
 * <ModalProvider> (chantier "centraliser les modales", 25/07) enveloppe
 * SEULEMENT <AppContent>, à l'intérieur d'<ErrorBoundary> — contrairement à
 * GeneratorProvider/AudioPlayerProvider, rien en dehors d'AppContent n'a
 * besoin d'y accéder (pas de valeur à faire remonter ici comme
 * athleticProfile/toast), donc pas de raison de l'ouvrir plus haut.
 */
export default function App() {
  const [isNaughtyMode, setIsNaughtyMode] = useState(false);
  const athleticProfileApi = useAthleticProfile();
  const { toast, showToast } = useToast();

  return (
    // `AthleticProvider` (08/08, chantier "GeneratorContext.jsx re-rend à
    // chaque réglage du wizard") — monté ICI, au même niveau que
    // `<GeneratorProvider>`/`<AudioPlayerProvider>` : `isNaughtyMode`/
    // `athleticProfileApi` restent possédés par `App()` (inchangé), ce
    // Provider les expose juste via un Contexte DÉDIÉ, découplé de l'état
    // du formulaire du générateur — voir AthleticContext.jsx.
    <AthleticProvider isNaughtyMode={isNaughtyMode} athleticProfileApi={athleticProfileApi}>
      <GeneratorProvider
        isNaughtyMode={isNaughtyMode}
        athleticProfileApi={athleticProfileApi}
      >
        <AudioPlayerProvider showToast={showToast}>
          <ErrorBoundary>
            <ModalProvider>
              <AppContent
                isNaughtyMode={isNaughtyMode} setIsNaughtyMode={setIsNaughtyMode}
                athleticProfileApi={athleticProfileApi}
                toast={toast} showToast={showToast}
              />
            </ModalProvider>
          </ErrorBoundary>
        </AudioPlayerProvider>
      </GeneratorProvider>
    </AthleticProvider>
  );
}
