import { useEffect, useRef, useState } from 'react';
import {
  Activity, Heart, Clock, Footprints, ListPlus, MapPin, SlidersHorizontal, Music, Trash2, Plus,
  Target, Loader2, Zap, BookmarkPlus, Info, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Flame,
  TrendingUp, Gauge, RotateCcw,
} from 'lucide-react';
import { STANDARD_GENRES, EXTRA_GENRES, getGenreLocalDepthWarning, genreDisplayLabel } from '../../musicCatalog';
import { formatDuration } from '../../utils/format';
import DualRangeSlider from '../shared/DualRangeSlider';
import {
  WORKOUT_TYPES, NAUGHTY_WORKOUT_ORDER, NAUGHTY_WORKOUT_ICONS, NAUGHTY_WORKOUT_LABELS,
  WORKOUT_DEFAULT_BPM, WORKOUT_DEFAULT_TARGET, ATHLETIC_ZONES, getZoneForValue,
} from '../../appConfig';

/**
 * GeneratorView — vue "Sculpte ta séance" (wizard de génération en 4 étapes).
 *
 * Extrait de App.jsx (bloc `view === 'generator'`). Le plus gros wizard de
 * l'appli — beaucoup de props (une par bout de state du formulaire), mais le
 * composant reste "dumb" comme les autres vues extraites : aucune logique
 * métier ici, juste de l'affichage et des appels aux setters/fonctions
 * fournis par App.jsx. `executeGeneration` reste dans App.jsx (elle appelle
 * le moteur de génération dans musicEngine.js).
 */
export default function GeneratorView({
  theme, isNaughtyMode, displaySubtitleGen,
  wizardStep, setWizardStep,
  workoutType, setWorkoutType, customActivity, handleOpenCustomActivityModal, toggleNaughtyMode,
  setBpm, setBpmManual, setTargetMode, setDistanceVal, setDistanceUnit, setHours, setMinutes,
  targetMode, isIntervalMode, isCrescendoMode, structureMode, setStructureMode,
  crescendoWarmupPct, setCrescendoWarmupPct, crescendoCooldownPct, setCrescendoCooldownPct, CRESCENDO_MIN_MAIN_PCT,
  crescendoWarmupBpm, setCrescendoWarmupBpm, crescendoCooldownBpm, setCrescendoCooldownBpm,
  bpmSourceIsProfile,
  hours, minutes, distanceVal, distanceUnit, paceMin, setPaceMin, paceSec, setPaceSec,
  bpm,
  segments, setSegments, expandedSegmentGenreId, setExpandedSegmentGenreId,
  resetSegmentGenre, toggleSegmentGenre, showExtraGenres, setShowExtraGenres,
  availableGenres, selectedGenres, toggleGenre,
  genreWeights, setGenreWeights, setGenreWeight, equalSplitWeights, setLockedGenreWeights,
  bpmTolerance, setBpmTolerance, crossfade, setCrossfade, allowLongTracks, setAllowLongTracks,
  setCurrentPlaylist, setIsBpmSearchMode, setSearchQuery, setWorldSearchResults,
  setResultsContextLabel, setNoUsableResultsHint, setIsSearchModalOpen, searchTracksByBpm,
  executeGeneration, isGenerating, getActiveWorkoutName, setIsSavingRoutineModalOpen,
  athleticProfile, setBaseCadenceForActivity, setZoneForActivity, resetActivityProfile,
  addCustomActivity, removeCustomActivity, setBaseCadenceForCustom, setZoneForCustom, getProfileForWorkout,
  getDefaultBaseCadence, buildDefaultPreviewProfile, getZoneSpacingForActivity,
  showAthleticProfile, setShowAthleticProfile,
}) {
  const {
    cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass,
    borderAccentClass, bgMainApp, inputBg, inputBorder,
  } = theme;

  // Plancher BPM pour l'échauffement/retour au calme du mode Crescendo —
  // mêmes bornes que le curseur BPM principal de l'étape 3 (40 en mode
  // Intime, 80 en mode standard), pour ne jamais proposer une valeur
  // absurdement basse même en ajustement manuel.
  const crescendoBpmFloor = isNaughtyMode ? 40 : 80;

  // "Règle d'or" ergonomie (retour direct : une couleur = une zone
  // d'intensité, partout dans l'app) : le visuel Crescendo (courbe
  // Échauffement/Cœur/Retour au calme) colore chaque segment selon la ZONE
  // RÉELLE de son BPM (via getZoneForValue, appConfig.js) plutôt que 3
  // couleurs fixes par RÔLE (bleu/rouge/vert) sans lien avec l'intensité
  // réelle. Repli sur les anciennes couleurs par rôle si aucun profil n'est
  // configuré pour cette activité — `getZoneForValue` renvoie alors `null`,
  // jamais une couleur inventée.
  const crescendoAccentFallback = isNaughtyMode ? '#f43f5e' : '#ef4444'; // rose-500/red-500 (bgAccentClass)
  const crescendoWarmupZone = getZoneForValue(crescendoWarmupBpm, workoutType, getProfileForWorkout, customActivity);
  const crescendoCoreZone = getZoneForValue(bpm, workoutType, getProfileForWorkout, customActivity);
  const crescendoCooldownZone = getZoneForValue(crescendoCooldownBpm, workoutType, getProfileForWorkout, customActivity);
  const crescendoWarmupColor = crescendoWarmupZone?.color || '#0ea5e9'; // sky-500 (repli)
  const crescendoCoreColor = crescendoCoreZone?.color || crescendoAccentFallback;
  const crescendoCooldownColor = crescendoCooldownZone?.color || '#10b981'; // emerald-500 (repli)

  // --- Profil Athlétique appliqué au wizard (Constante / Crescendo / Fractionné) ---
  //
  // Résout le profil de l'activité choisie à l'étape 1, TOUJOURS avec des
  // valeurs de zones exploitables — un vrai profil configuré si l'utilisateur
  // en a un, sinon le même "aperçu par défaut crédible" que sur la page
  // Profil Athlétique elle-même (voir buildDefaultPreviewProfile,
  // useAthleticProfile.js — retour direct plus haut dans la conversation :
  // "il devrait toujours y avoir un nombre par défaut... des valeurs
  // crédibles par discipline"). `isConfigured` reste fidèle à la RÉALITÉ
  // (`false` pour l'aperçu par défaut) : sert de garde-fou pour tout ce qui
  // ne doit s'activer qu'avec un VRAI profil (badge "Profil Athlétique",
  // sélecteur rapide de zones ci-dessous) sans jamais affecter les BPM
  // eux-mêmes, qui restent crédibles dans les 2 cas.
  const resolveEffectiveActivityProfile = () => {
    const real = getProfileForWorkout(workoutType, customActivity);
    if (real.isConfigured) return real;
    return buildDefaultPreviewProfile(workoutType === 'Autre' ? (customActivity || '__custom__') : workoutType);
  };

  // Sélecteur rapide de zone (retour direct : "je devrais pouvoir sélectionner
  // un de mes 4 zones pour savoir en un instant ce qui correspond à quoi,
  // plutôt que de devoir me souvenir de mes BPM") — SEULEMENT si un VRAI
  // profil existe pour cette activité (`isConfigured`), pas avec le simple
  // aperçu par défaut : choisir explicitement "une de mes zones" n'a de sens
  // que si les zones sont vraiment calibrées pour cette personne, pas des
  // valeurs génériques. Réutilisé aux 5 endroits où un curseur BPM peut se
  // relier à une zone (voir plus bas) — cohérence globale plutôt qu'un
  // sélecteur réinventé à chaque fois : mêmes couleurs/libellés courts que la
  // page Profil Athlétique elle-même (ATHLETIC_ZONES, appConfig.js).
  const renderZoneQuickPicks = (currentBpm, onSelectZone) => {
    const effectiveProfile = resolveEffectiveActivityProfile();
    if (!effectiveProfile.isConfigured) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {ATHLETIC_ZONES.map(z => {
          const zoneBpm = effectiveProfile[z.key];
          const isActive = currentBpm === zoneBpm;
          return (
            <button
              key={z.key}
              onClick={() => onSelectZone(zoneBpm)}
              title={`${z.label} — ${zoneBpm} BPM`}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${isActive ? 'text-white' : `${inputBg} ${inputBorder} ${textMuted} hover:${textHighlight}`}`}
              style={isActive ? { backgroundColor: z.color, borderColor: z.color } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
              {z.shortLabel} · {zoneBpm}
            </button>
          );
        })}
      </div>
    );
  };

  // Profil Athlétique — DÉPLACÉ depuis Options & Comptes (retour direct :
  // "personne ne le verra là-bas", ça sert au générateur, ça doit vivre ici),
  // puis `showAthleticProfile` lui-même REMONTÉ dans App.jsx (retour direct
  // suivant : "j'imaginais ça en sous-menu de Générer, dans le menu") — le
  // sous-menu de la sidebar a besoin de pouvoir déplier ce panneau depuis
  // l'extérieur du composant, pas juste au clic sur son propre en-tête ici.
  // Replié par défaut (divulgation progressive, même logique que
  // showExtraGenres/showScrollHint plus bas) : ne s'affiche en développé que
  // si l'utilisateur clique dessus (ici OU dans la sidebar), pour ne pas
  // s'interposer entre lui et le wizard pour qui n'en a pas l'usage.
  //
  // Multi-activités (cette session) : `selectedProfileActivity` contient soit
  // une clé "built-in" ('Course à pied' / 'Cyclisme'), soit l'id d'une
  // activité personnalisée ('custom-...') — voir `activeProfile` juste après
  // le state, qui résout les deux cas de façon uniforme pour le reste du
  // composant.
  const [showExpertZones, setShowExpertZones] = useState(false);
  // Retour direct : "je ne vois pas infobulle expliquant le calcul
  // automatique" — l'ancienne infobulle reposait sur l'attribut HTML `title`,
  // qui ne s'affiche qu'au SURVOL — invisible sur un écran tactile (mobile,
  // tablette), qui n'a pas de "survol". Remplacé par un vrai popover cliquable
  // (voir plus bas), qui marche identiquement à la souris ET au doigt.
  const [showZoneCalcInfo, setShowZoneCalcInfo] = useState(false);
  const [selectedProfileActivity, setSelectedProfileActivity] = useState('Course à pied');
  const [showAddCustomActivity, setShowAddCustomActivity] = useState(false);
  const [newCustomActivityName, setNewCustomActivityName] = useState('');

  const isCustomProfileTab = selectedProfileActivity.startsWith('custom-');
  const activeProfile = isCustomProfileTab
    ? (athleticProfile.custom.find(c => c.id === selectedProfileActivity) || null)
    : (athleticProfile.activities[selectedProfileActivity] || null);

  // Profil "aperçu" par défaut (retour direct : "il devrait toujours y avoir
  // un nombre par défaut... pour inciter l'utilisateur à manipuler... des
  // valeurs crédibles par discipline") — calculé UNIQUEMENT pour affichage
  // tant que l'activité n'a jamais été réellement configurée
  // (`activeProfile?.isConfigured`), jamais pour décider quoi que ce soit
  // ailleurs (badges "Profil configuré", pré-remplissage Crescendo...), qui
  // continuent de se fier strictement à `isConfigured`. `getDefaultBaseCadence`
  // n'a pas de valeur spécifique pour une activité personnalisée (aucun moyen
  // de deviner un chiffre par discipline pour un sport inconnu à l'avance) —
  // lui passer une clé bidon retombe proprement sur le repli générique
  // ("Autre") déjà utilisé ailleurs dans l'app.
  const defaultPreviewProfile = buildDefaultPreviewProfile(isCustomProfileTab ? '__custom__' : selectedProfileActivity);
  // PIVOT DE MODÈLE (retour direct, cas concret : "à ma zone 4, cœur à
  // 170 bpm, pas à 160, musique voulue à 180" — 3 nombres indépendants) :
  // ce profil ne prétend plus stocker une cadence physique (PPM/RPM,
  // propre à l'activité) mais directement le BPM MUSICAL cible par zone,
  // décidé par l'utilisateur — donc une seule unité, "BPM", quelle que soit
  // l'activité (course, vélo, personnalisée). Ne pas confondre avec
  // `getCadenceUnitLabel`/`playlistCadenceUnit` (PlaylistDetailView.jsx) :
  // celui-là reste correct et inchangé, il affiche une VRAIE cadence
  // physique importée d'un Garmin/Strava, un cas totalement différent.
  const activityCadenceUnit = 'BPM';

  // Brouillon de saisie de l'Assistant Rapide — RE-DÉRIVÉ à chaque changement
  // d'onglet (voir l'effet juste en dessous) puisque chaque activité a
  // maintenant sa propre cadence de base, contrairement à l'ancien profil
  // unique où un seul brouillon suffisait. Pré-rempli avec une valeur
  // crédible par défaut (`defaultPreviewProfile.baseCadence`) plutôt que vide
  // tant que rien n'a encore été configuré.
  const [baseCadenceDraft, setBaseCadenceDraft] = useState(activeProfile?.baseCadence ?? defaultPreviewProfile.baseCadence);
  // BUG CORRIGÉ (retour direct : "le bouton calculer mes zones ne marche
  // pas") — `computeAndApplyZones` faisait bien un `return` silencieux si le
  // champ était vide ou invalide (`if (!baseCadenceDraft) return;`, et
  // `setBaseCadenceForActivity`/`setBaseCadenceForCustom` refusent eux-mêmes
  // toute valeur <= 0 ou non numérique, voir useAthleticProfile.js) — mais
  // RIEN ne le signalait à l'écran : ni message, ni bordure rouge, ni le
  // moindre indice. Un clic sur "Calculer mes zones" sans avoir tapé de
  // chiffre (le placeholder "ex : 160" grisé peut se lire vite comme une
  // vraie valeur déjà saisie) semblait alors juste ne rien faire — ce que
  // c'était très exactement, mais sans jamais l'expliquer. Ce cas reste
  // possible malgré la pré-saisie par défaut ci-dessus (la personne peut
  // vider le champ à la main), d'où ce garde-fou conservé tel quel.
  const [cadenceInputError, setCadenceInputError] = useState(false);
  useEffect(() => {
    setBaseCadenceDraft(activeProfile?.baseCadence ?? buildDefaultPreviewProfile(isCustomProfileTab ? '__custom__' : selectedProfileActivity).baseCadence);
    setCadenceInputError(false);
    setShowZoneCalcInfo(false);
  }, [selectedProfileActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  const computeAndApplyZones = () => {
    const parsed = parseInt(baseCadenceDraft);
    if (!baseCadenceDraft || !Number.isFinite(parsed) || parsed <= 0) {
      setCadenceInputError(true);
      return false;
    }
    setCadenceInputError(false);
    if (isCustomProfileTab) setBaseCadenceForCustom(selectedProfileActivity, baseCadenceDraft);
    else setBaseCadenceForActivity(selectedProfileActivity, baseCadenceDraft);
    return true;
  };
  const handleSetZone = (zoneKey, value) => {
    if (isCustomProfileTab) setZoneForCustom(selectedProfileActivity, zoneKey, value);
    else setZoneForActivity(selectedProfileActivity, zoneKey, value);
  };
  const handleResetProfile = () => {
    if (isCustomProfileTab) {
      removeCustomActivity(selectedProfileActivity);
      setSelectedProfileActivity('Course à pied');
    } else {
      resetActivityProfile(selectedProfileActivity);
    }
  };
  const confirmAddCustomActivity = () => {
    const id = addCustomActivity(newCustomActivityName);
    if (id) { setSelectedProfileActivity(id); setNewCustomActivityName(''); setShowAddCustomActivity(false); }
  };
  // Question de l'Assistant Rapide adaptée à l'activité — un footing et une
  // sortie vélo n'évoquent pas la même intensité "tranquille" pour qui répond.
  // PIVOT DE MODÈLE : on demande maintenant directement le BPM MUSICAL voulu
  // à une intensité tranquille, pas une cadence physique (voir
  // useAthleticProfile.js, docstring en tête de fichier, pour le pourquoi).
  const baseCadenceQuestion = selectedProfileActivity === 'Course à pied'
    ? "Quel tempo de musique veux-tu lors d'un footing lent ?"
    : selectedProfileActivity === 'Cyclisme'
      ? "Quel tempo de musique veux-tu lors d'une sortie tranquille ?"
      : `Quel tempo de musique veux-tu pour ${activeProfile ? `"${activeProfile.name}"` : 'cette activité'}, à une intensité tranquille ?`;
  const configuredProfilesCount = Object.values(athleticProfile.activities).filter(p => p.isConfigured).length
    + athleticProfile.custom.filter(c => c.isConfigured).length;

  // Étape 3 : conteneur en hauteur fixe + `overflow-y-auto no-scrollbar` (la
  // barre de défilement est volontairement masquée pour l'esthétique), donc
  // rien n'indiquait visuellement qu'il y avait plus de contenu en dessous —
  // repéré après l'ajout du mode Crescendo, qui allonge le contenu de cette
  // étape. `showScrollHint` s'active si le contenu déborde réellement (mesuré
  // via ResizeObserver, qui se redéclenche si le contenu change de hauteur —
  // ex. passage Constante ↔ Crescendo ↔ Fractionné), ET se désactive dès que
  // l'utilisateur commence à scroller (retour direct : le pill restait
  // affiché en `sticky` pendant tout le scroll et finissait par chevaucher le
  // contenu, ex. le curseur BPM Retour au calme — son seul rôle est de
  // signaler qu'il y a plus à voir AVANT que l'utilisateur ne le découvre lui-
  // même en scrollant, pas de rester affiché indéfiniment une fois qu'il a
  // compris).
  const step3ScrollRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  useEffect(() => {
    const el = step3ScrollRef.current;
    if (!el) { setShowScrollHint(false); return; }
    const checkOverflow = () => {
      // Ne (re)montre le pill que si on est encore tout en haut — un
      // changement de contenu (ex. ouverture du panneau BPM) ne doit pas le
      // faire réapparaître si l'utilisateur avait déjà scrollé.
      if (el.scrollTop <= 2) setShowScrollHint(el.scrollHeight > el.clientHeight + 2);
    };
    const handleScroll = () => {
      if (el.scrollTop > 2) setShowScrollHint(false);
    };
    checkOverflow();
    el.addEventListener('scroll', handleScroll);
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [wizardStep, structureMode, targetMode]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className="text-center md:text-left space-y-2 mb-8">
        <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight ${textHighlight}`}>
          {showAthleticProfile ? 'Mon Profil Athlétique' : (isNaughtyMode ? "Prépare l'ambiance..." : "Sculpte ta séance")}
        </h1>
        <p className="text-lg font-medium text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {showAthleticProfile ? "Définis ton BPM musical cible par zone d'effort, pour chaque activité." : displaySubtitleGen}
        </p>
      </div>

      {/* Profil Athlétique et Générer sont maintenant 2 PAGES DISTINCTES et
          MUTUELLEMENT EXCLUSIVES (retour direct : "quand je clique sur profil
          athlétique je dois pas avoir accès à la gestion, et inversement") —
          avant, un simple accordéon dépliable au-dessus du wizard ; ce dernier
          restait visible en dessous dans les 2 cas, ce qui n'isolait pas
          vraiment les deux. `showAthleticProfile` (remonté dans App.jsx, piloté
          par les 2 entrées de la sidebar : "Générer" et son sous-menu "Mon
          Profil Athlétique") choisit maintenant laquelle des 2 pages s'affiche,
          plus un simple "replié/déplié". */}
      {showAthleticProfile ? (
        !isNaughtyMode && (
          <div className={`${cardBg} rounded-3xl border ${cardBorder} shadow-xl p-5 md:p-6`}>
            {/* Onglets d'activité — "Course à pied"/"Cyclisme" toujours présents
                (voir useAthleticProfile.js, pas de suppression possible pour ces
                2-là), activités personnalisées ajoutées/retirables à volonté. */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {['Course à pied', 'Cyclisme'].map(key => (
                <button
                  key={key}
                  onClick={() => setSelectedProfileActivity(key)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${selectedProfileActivity === key ?
                    `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:${textHighlight}`}`}
                >
                  {key}{athleticProfile.activities[key]?.isConfigured && ' ✓'}
                </button>
              ))}
              {athleticProfile.custom.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedProfileActivity(c.id)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${selectedProfileActivity === c.id ?
                    `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:${textHighlight}`}`}
                >
                  {c.name}{c.isConfigured && ' ✓'}
                </button>
              ))}
              {!showAddCustomActivity ? (
                <button
                  onClick={() => setShowAddCustomActivity(true)}
                  className={`px-4 py-2 rounded-full text-sm font-bold border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}
                >
                  + Ajouter une autre activité
                </button>
              ) : (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border-2 border-dashed ${cardBorder}`}>
                  <input
                    type="text" autoFocus placeholder="ex : Elliptique"
                    value={newCustomActivityName}
                    onChange={(e) => setNewCustomActivityName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmAddCustomActivity()}
                    className={`bg-transparent text-sm font-bold outline-none w-28 px-2 ${textHighlight}`}
                  />
                  <button onClick={confirmAddCustomActivity} className={`p-1.5 rounded-full text-white ${bgAccentClass}`}><Plus size={14}/></button>
                  <button onClick={() => { setShowAddCustomActivity(false); setNewCustomActivityName(''); }} className={`p-1.5 rounded-full ${textMuted} hover:text-red-500`}><Trash2 size={14}/></button>
                </div>
              )}
            </div>

            {/* Retour direct : "redondant d'avoir le titre de l'activité juste en
                dessous du bouton de sélection" — cette ligne répétait
                systématiquement le libellé de l'onglet déjà en surbrillance
                juste au-dessus (`selectedProfileActivity`/`activeProfile.name`),
                sans jamais rien ajouter. Gardé comme repère de section neutre
                (le bouton réinitialiser/supprimer a toujours besoin d'un point
                d'ancrage sur cette ligne), mais ne répète plus le nom déjà
                visible sur l'onglet actif. */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="relative flex items-center gap-1.5">
                <span className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>
                  BPM cibles par zone
                </span>
                {/* RETOUR DIRECT : "je ne vois pas infobulle expliquant le
                    calcul automatique" — l'ancien <span title="..."> ne
                    s'affichait qu'au survol (souris), invisible au doigt sur
                    mobile/tablette. Remplacé par un vrai popover cliquable
                    (voir showZoneCalcInfo plus haut) : marche pareil à la
                    souris et au tactile, et reste ouvert le temps de lire au
                    lieu de disparaître si le curseur/doigt bouge.
                    La formule elle-même est une simple progression linéaire
                    autour du BPM tapé (base ± un espacement fixe par palier,
                    voir ZONE_SPACING_BY_ACTIVITY dans useAthleticProfile.js),
                    volontairement PAS une vraie formule physiologique
                    (%VMA, VO2max...).
                    PIVOT DE MODÈLE (retour direct, cas concret : "à ma zone 4,
                    cœur à 170 bpm, pas à 160, musique voulue à 180") : ce
                    profil demande maintenant directement le BPM MUSICAL
                    voulu à chaque zone d'effort, plus une cadence physique
                    silencieusement recopiée comme cible — voir la docstring
                    de useAthleticProfile.js pour le détail du raisonnement. */}
                <button
                  type="button"
                  onClick={() => setShowZoneCalcInfo(!showZoneCalcInfo)}
                  className={`${textMuted} hover:${textHighlight} transition-colors`}
                >
                  <Info size={13}/>
                </button>
                {/* Popover élargi (w-80/w-96, contraste texte relevé, backdrop
                    cliquable pour fermer) après un retour direct sur
                    l'ancienne version (trop étroite, texte gris peu lisible,
                    superposée de façon confuse avec la question/le bouton
                    juste en dessous). Contenu réécrit pour le pivot de
                    modèle : BPM musical cible directement, zones nommées par
                    NIVEAU D'EFFORT (vocabulaire de coach de course à pied),
                    jamais présentées comme une mesure cardiaque ou une
                    cadence physique. */}
                {showZoneCalcInfo && (
                  <div className="fixed inset-0 z-30" onClick={() => setShowZoneCalcInfo(false)} />
                )}
                {showZoneCalcInfo && (
                  <div className={`absolute z-40 top-full left-0 mt-2 w-80 sm:w-96 p-4 rounded-xl border shadow-2xl text-xs font-medium leading-relaxed ${cardBg} ${cardBorder} ${textHighlight}`}>
                    <p className="mb-2">
                      Zone 2 = le BPM que tu tapes ci-dessous. Les 3 autres s'en écartent par palier fixe de {getZoneSpacingForActivity(isCustomProfileTab ? '__custom__' : selectedProfileActivity)} BPM (Zone 1 = -1 palier, Zone 3 = +1, Zone 4 = +2) — une progression simple autour de ton BPM, pas une vraie formule physiologique (%VMA...).
                    </p>
                    <p className={textMuted}>
                      Les noms de zone (Récupération, Endurance, Seuil, Vitesse) viennent du vocabulaire des coachs de course à pied — ils décrivent un niveau d'effort, pas une mesure précise. Le chiffre associé est directement le tempo de musique que TU veux à cette intensité : ta fréquence cardiaque et ta cadence de pas peuvent t'aider à en juger, mais ce ne sont pas les mêmes nombres et rien ne les convertit automatiquement l'un dans l'autre. Toujours ajustable au BPM près via le bouton "Ajuster manuellement" ci-dessous — et modifiable librement au moment de générer, ce profil ne fait que suggérer un point de départ.
                    </p>
                  </div>
                )}
              </div>
              {activeProfile?.isConfigured && (
                <button onClick={handleResetProfile} title={isCustomProfileTab ? "Supprimer cette activité" : "Effacer ce profil"} className={`shrink-0 p-2 rounded-lg transition-colors ${textMuted} hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}>
                  {isCustomProfileTab ? <Trash2 size={18}/> : <RotateCcw size={18}/>}
                </button>
              )}
            </div>

            {/* Assistant Rapide : une seule question, 4 zones calculées d'un
                coup (voir computeZonesFromBaseCadence, useAthleticProfile.js).
                ─────────────────────────────────────────────────────────────
                PIVOT DE MODÈLE (retour direct, cas concret : "à ma zone 4,
                cœur à 170 bpm, pas à 160, musique voulue à 180") — ce champ
                demande directement le BPM MUSICAL que l'utilisateur veut à
                une intensité tranquille, pas une cadence physique. L'ancienne
                version demandait "ta cadence habituelle" (PPM) puis recopiait
                silencieusement ce nombre comme cible BPM — or ce sont 3
                nombres indépendants pour la plupart des gens (fréquence
                cardiaque réelle, cadence de pas réelle, tempo de musique
                voulu). Voir la docstring de useAthleticProfile.js pour le
                raisonnement complet. Les noms internes (`baseCadence`,
                `zone1..4`) restent inchangés (pas de migration de données
                nécessaire) — seul ce qui est DEMANDÉ/AFFICHÉ change de sens.
                Ne pas confondre avec PlaylistDetailView.jsx ("Cadence (PPM)"
                vs "BPM cible"), qui lui affiche une vraie cadence physique
                importée d'un Garmin/Strava — cas différent, inchangé. */}
            <div className={`p-4 rounded-2xl ${inputBg} border ${inputBorder}`}>
              <label className={`text-sm font-bold block mb-2 ${textHighlight}`}>{baseCadenceQuestion}</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border ${cadenceInputError ? 'border-red-500' : inputBorder} ${cardBg}`}>
                  <input
                    type="number" min="40" max="220" placeholder="ex : 160"
                    value={baseCadenceDraft}
                    onChange={(e) => { setBaseCadenceDraft(e.target.value); if (cadenceInputError) setCadenceInputError(false); }}
                    onKeyDown={(e) => e.key === 'Enter' && computeAndApplyZones()}
                    className={`bg-transparent w-full text-lg font-bold outline-none ${textHighlight}`}
                  />
                  <span className={`text-sm font-bold shrink-0 ${textMuted}`}>{activityCadenceUnit}</span>
                </div>
                <button onClick={computeAndApplyZones} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110 shrink-0`}>
                  Calculer mes zones
                </button>
              </div>
              {cadenceInputError && (
                <p className="text-xs font-bold text-red-500 mt-2">Indique d'abord un chiffre (le BPM que tu veux) avant de calculer tes zones.</p>
              )}
            </div>

            {/* RETOUR DIRECT ("je n'ai toujours pas accès à l'option de
                génération par défaut alors que je pourrais être en accord
                avec toutes les valeurs") — ce récapitulatif (et le bandeau
                "Générer une playlist" juste en dessous) ne s'affichaient
                QUE si `isConfigured` était déjà vrai, c'est-à-dire après avoir
                cliqué "Calculer mes zones" ou touché un champ Expert. Sauf que
                la page affiche maintenant TOUJOURS des valeurs crédibles par
                défaut (voir defaultPreviewProfile, buildDefaultPreviewProfile
                dans useAthleticProfile.js) — quelqu'un qui regarde juste ces
                valeurs par défaut, les trouve très bien et n'a RIEN à changer
                n'avait donc aucun moyen d'accéder à la génération sans un
                clic de validation qui, pour lui, ne servait à rien. Affiché
                maintenant dans TOUS les cas (profil réel ou aperçu par
                défaut), avec une mention explicite quand ce sont encore des
                valeurs par défaut — la transparence sur l'origine du chiffre
                reste importante, seul l'ACCÈS ne doit plus dépendre de
                `isConfigured`. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {ATHLETIC_ZONES.map(z => (
                <div key={z.key} className={`p-3 rounded-xl border ${inputBorder} ${inputBg} text-center`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${textMuted}`}>{z.shortLabel}</span>
                  </div>
                  <div className={`text-xl font-black ${textHighlight}`}>{activeProfile?.[z.key] ?? defaultPreviewProfile[z.key]}</div>
                  <div className={`text-[10px] ${textMuted}`}>{activityCadenceUnit}</div>
                </div>
              ))}
            </div>

            {/* RETOUR DIRECT : "faudrait la possibilité d'ajuster
                manuellement puis ensuite générer playlist en dessous" —
                remonté ici (juste après le récapitulatif des zones), AVANT le
                bouton "Générer" plutôt qu'après : l'ordre logique de lecture
                devient "voir mes zones → les affiner si besoin → générer",
                le CTA restant la toute dernière étape quel que soit le choix
                de déplier ou non cette section (elle reste repliée par
                défaut, toujours facultative). */}
            <button
              onClick={() => setShowExpertZones(!showExpertZones)}
              className={`mt-4 flex items-center gap-1.5 text-sm font-bold ${textColorClass}`}
            >
              {showExpertZones ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              <span>Ajuster manuellement</span>
            </button>

            {showExpertZones && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {ATHLETIC_ZONES.map(z => (
                  <div key={z.key} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${inputBorder} ${inputBg}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                      <span className={`text-sm font-bold truncate ${textHighlight}`}>{z.label}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border ${inputBorder} ${cardBg}`}>
                      <input
                        type="number" min="40" max="220"
                        value={activeProfile?.[z.key] ?? defaultPreviewProfile[z.key]}
                        onChange={(e) => handleSetZone(z.key, e.target.value)}
                        className={`w-14 bg-transparent text-right font-mono font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${textHighlight}`}
                      />
                      <span className={`text-xs font-bold ${textMuted}`}>{activityCadenceUnit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Renvoi vers la génération (retour direct : "une fois profil
                athlétique complété pour une activité faudrait un message qui
                suggère de générer une playlist") — reste accessible SANS
                condition (retour direct : "je ne devrais pas avoir besoin
                d'ajuster manuellement pour générer, si les zones de base me
                conviennent je dois pouvoir cliquer directement sur générer") :
                le clic accepte implicitement les valeurs par défaut affichées
                si rien n'a encore été réellement configuré
                (`computeAndApplyZones` avec la cadence déjà pré-remplie dans
                l'Assistant Rapide, voir `baseCadenceDraft`), avant de
                rejoindre le générateur.
                RETOUR DIRECT SUIVANT : "pas la peine d'avoir le texte
                explicatif ou les pointillés en rouge" — simplifié en simple
                bouton, sans l'encart à bordure en pointillés ni le texte
                d'accompagnement (qui expliquait surtout "pourquoi" ce bouton
                est là, jugé superflu une fois que son EMPLACEMENT — juste
                après les réglages, avant rien d'autre — parle de lui-même). */}
            <button
              onClick={() => { if (activeProfile?.isConfigured || computeAndApplyZones()) setShowAthleticProfile(false); }}
              className={`w-full mt-4 px-4 py-3 rounded-xl font-bold text-sm text-white ${bgAccentClass} hover:brightness-110`}
            >
              Générer une playlist →
            </button>
          </div>
        )
      ) : (
        <>
          {/* Renvoi inverse, côté "Générer" (retour direct : "et inversement
              dans gestion faudrait un message renvoyant vers le fait de
              remplir le profil athlétique") — seulement si RIEN n'a jamais été
              configuré (voir configuredProfilesCount) : une fois au moins une
              activité configurée, plus la peine d'insister à chaque
              génération, le badge "calculé depuis ton profil" (étape 3) prend
              le relais.
              RETOUR DIRECT SUIVANT : "le profil athlétique ne s'applique plus
              uniquement au Crescendo" — ce texte listait "Crescendo et
              Allure Constante", devenu à son tour incomplet depuis que le
              Fractionné en bénéficie aussi (motif de segments par défaut basé
              sur le profil, voir setStructureMode dans useGeneratorForm.js).
              RETOUR DIRECT ENCORE SUIVANT : plutôt que de courir après une
              liste de modes vouée à se périmer à chaque nouvelle extension,
              reformulé en restant volontairement VAGUE ("des paramètres
              ajustés à ton profil") — reste vrai quel que soit le nombre de
              modes concernés à l'avenir, sans jamais promettre une
              équivalence exacte entre eux (le Fractionné n'a par exemple pas
              le même badge "calculé depuis ton profil" que Crescendo/
              Constante, faute d'une zone unique à mettre en avant sur des
              segments libres — rester vague évite justement d'avoir à
              détailler cette nuance ici).
              PIVOT DE MODÈLE (retour direct, cas concret : cœur à 170 bpm,
              pas à 160, musique voulue à 180) : "ajustés à ta cadence" ne
              disait plus la vérité — le profil ne stocke plus une cadence
              physique mais un BPM musical cible choisi par l'utilisateur,
              voir useAthleticProfile.js. Reformulé en "ajustés à ton profil",
              volontairement générique plutôt que de réintroduire un mot qui a
              déjà causé une confusion. */}
          {!isNaughtyMode && configuredProfilesCount === 0 && (
            <div className={`${cardBg} rounded-2xl border ${cardBorder} p-4 flex items-center justify-between gap-3 flex-wrap`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 p-2 rounded-xl ${bgAccentClass} text-white`}><Gauge size={18}/></div>
                <p className={`text-sm ${textMuted}`}>Configure ton <span className={`font-semibold ${textHighlight}`}>Profil Athlétique</span> pour que le générateur te propose automatiquement un BPM ajusté à chaque zone d'effort.</p>
              </div>
              <button onClick={() => setShowAthleticProfile(true)} className={`shrink-0 text-sm font-bold underline ${textColorClass}`}>
                Configurer →
              </button>
            </div>
          )}

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
                      {/* Repère "prendre du recul, voir où ce serait utile dans toute
                          l'app" (retour direct) : indique DÈS L'ÉTAPE 1 qu'un Profil
                          Athlétique existe pour cette activité, avant même d'arriver
                          au BPM qui en profitera réellement à l'étape 3 (voir le badge
                          "calculé depuis ton profil" plus loin) — évite que ce
                          pré-remplissage plus tard semble sorti de nulle part. */}
                      {!isNaughtyMode && athleticProfile?.activities?.[type.id]?.isConfigured && (
                        <span className={`absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${bgAccentClass} text-white animate-in fade-in zoom-in duration-300`}>
                          <Gauge size={10}/> Profil configuré
                        </span>
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
              {/* Le choix Temps/Distance n'a pas de sens en mode Intime : le mode reste
                  forcé sur "temps" (voir toggleNaughtyMode) et ce sélecteur est masqué. */}
              {!isNaughtyMode && (
                <>
                  <div className="space-y-4">
                    <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                      <MapPin className={textColorClass} size={24} /> <span>Sur quoi on se base ?</span>
                    </label>
                    <div className="flex bg-surface-hover rounded-2xl p-1.5">
                      <button onClick={() => setTargetMode('time')} className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl font-bold transition-all ${targetMode === 'time' ?
                        'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted}`}>
                        <Clock size={20} className="mb-1"/> Par Durée (Temps)
                      </button>
                      <button onClick={() => setTargetMode('distance')} className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl font-bold transition-all ${targetMode === 'distance' ?
                        'bg-white dark:bg-gray-700 text-main shadow-sm' : textMuted}`}>
                        <Footprints size={20} className="mb-1"/> Par Distance (Km/Mi)
                      </button>
                    </div>
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
                            <input type="number" min="0" max="59" value={paceSec} onChange={(e) => setPaceSec(e.target.value)} className={`bg-transparent w-10 text-2xl font-bold ${textHighlight} outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                            <div className="flex flex-col mr-1">
                              <button type="button" onClick={() => setPaceSec(s => { const v = (parseInt(s) || 0) + 1; return v > 59 ? 0 : v; })} className={`${textMuted} hover:${textHighlight}`}>
                                <ChevronUp size={12} />
                              </button>
                              <button type="button" onClick={() => setPaceSec(s => { const v = (parseInt(s) || 0) - 1; return v < 0 ? 59 : v; })} className={`${textMuted} hover:${textHighlight}`}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
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
                          {/* Flèches personnalisées plutôt que le spinner natif : un input
                              number natif s'arrête à 59 (ou 0) au lieu de boucler. */}
                          <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`bg-transparent w-full text-3xl font-black ${textHighlight} outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                          <span className={`font-bold text-lg ${textMuted} mr-2`}>Min</span>
                          <div className="flex flex-col">
                            <button type="button" onClick={() => setMinutes(m => { const v = (parseInt(m) || 0) + 1; return v > 59 ? 0 : v; })} className={`p-0.5 rounded ${textMuted} hover:${textHighlight} hover:bg-black/5 dark:hover:bg-white/10`}>
                              <ChevronUp size={16} />
                            </button>
                            <button type="button" onClick={() => setMinutes(m => { const v = (parseInt(m) || 0) - 1; return v < 0 ? 59 : v; })} className={`p-0.5 rounded ${textMuted} hover:${textHighlight} hover:bg-black/5 dark:hover:bg-white/10`}>
                              <ChevronDown size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Structure de l'effort. Mode Intime : conserve l'ancien toggle simple
                  (Constante / "Montée en Intensité" = Fractionné manuel relabellisé) —
                  comportement historique inchangé. Mode standard : sélecteur à 3
                  cartes, qui ajoute le mode "Crescendo" (échauffement → cœur de
                  séance → retour au calme, généré automatiquement à l'étape 3). */}
              {isNaughtyMode ? (
                <div className={`flex items-center justify-between p-5 ${inputBg} border-2 ${isIntervalMode ? borderAccentClass : inputBorder} rounded-2xl transition-colors cursor-pointer select-none`} onClick={() => setStructureMode(isIntervalMode ? 'constant' : 'interval')}>
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl ${isIntervalMode ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <ListPlus size={24} className={isIntervalMode ? 'text-white' : textMuted} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg ${textHighlight}`}>Montée en Intensité</h3>
                      <p className={`text-sm ${textMuted}`}>Enchaîner plusieurs phases, à des rythmes différents</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                    <input type="checkbox" className="sr-only peer" checked={isIntervalMode} readOnly />
                    <div className={`w-14 h-7 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all ${isIntervalMode ?
                      'peer-checked:bg-red-500 dark:peer-checked:bg-red-600' : ''}`}></div>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                    <SlidersHorizontal className={textColorClass} size={24} /> <span>Structure de l'effort</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { mode: 'constant', icon: Gauge, title: 'Allure Constante', desc: 'Un rythme stable de bout en bout' },
                      { mode: 'crescendo', icon: TrendingUp, title: 'Crescendo', desc: 'Montée progressive, avec retour au calme' },
                      { mode: 'interval', icon: ListPlus, title: 'Fractionné / HIIT', desc: 'Intervalles personnalisés à la main' },
                    ].map(({ mode, icon: Icon, title, desc }) => {
                      const isSelected = structureMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setStructureMode(mode, resolveEffectiveActivityProfile())}
                          className={`flex flex-col items-start text-left p-4 rounded-2xl border-2 transition-all duration-200 ${isSelected ? `${borderAccentClass} ${bgMainApp}` : `${inputBorder} ${inputBg} hover:border-gray-300 dark:hover:border-gray-600`}`}
                        >
                          <div className={`p-2 rounded-xl mb-2 ${isSelected ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}>
                            <Icon size={20} className={isSelected ? 'text-white' : textMuted} />
                          </div>
                          <span className={`font-bold ${textHighlight}`}>{title}</span>
                          <span className={`text-xs mt-0.5 ${textMuted}`}>{desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPE 3 : REGLAGES DU RYTHME (BPM simple/distance/temps, ou découpage HIIT) */}
          {wizardStep === 3 && (
            <div ref={step3ScrollRef} className="space-y-8 animate-in slide-in-from-right-8 duration-300 h-[300px] overflow-y-auto no-scrollbar pb-10">

              {(!isIntervalMode || isCrescendoMode) ? (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                        <Activity className={textColorClass} size={24} /> <span>{isCrescendoMode ? 'Rythme au pic (cœur de séance)' : 'Rythme cible global'}</span>
                      </label>
                      <span className={`text-4xl font-black ${textColorClass}`}>{bpm} <span className={`text-sm font-bold ${textMuted}`}>BPM</span></span>
                    </div>
                    <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={bpm} onChange={(e) => setBpmManual(parseInt(e.target.value))} className={`w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ?
                      'accent-rose-500' : 'accent-red-500'}`} />
                    {/* Badge "calculé depuis ton profil" (retour direct : "il faudrait
                        ajouter une petite indication visuelle... pour bien faire
                        comprendre à l'utilisateur que l'appli a intelligemment
                        calculé ces BPM pour lui"). Affiché en Crescendo ET en
                        Allure Constante (retour direct : "pourquoi c'est utilisé en
                        Crescendo et pas pour les autres types de séances" — les 2
                        modes partagent maintenant EXACTEMENT le même mécanisme, voir
                        setStructureMode dans useGeneratorForm.js) — `bpmSourceIsProfile`
                        encode déjà "est-ce pertinent dans le mode actuel", pas la peine
                        de reproduire une condition de mode ici. N'apparaît QUE si la/les
                        valeur(s) affichée(s) sont VRAIMENT celles du profil de
                        l'activité en cours, pas dès qu'un profil existe quelque part
                        (voir bpmSourceIsProfile, useGeneratorForm.js) — disparaît dès
                        qu'un réglage est retouché à la main. Animation d'entrée
                        ponctuelle (pas un pulse en boucle) : un "aha" au moment où ça
                        apparaît, pas une sollicitation permanente. */}
                    {bpmSourceIsProfile && (
                      <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${bgAccentClass} text-white animate-in fade-in zoom-in slide-in-from-bottom-2 duration-500`}>
                        <Gauge size={12}/> Calculé depuis ton Profil Athlétique
                      </div>
                    )}
                    {renderZoneQuickPicks(bpm, (zoneBpm) => setBpmManual(zoneBpm))}
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
                            <input type="number" min="0" max="59" value={paceSec} onChange={(e) => setPaceSec(e.target.value)} className={`bg-transparent w-10 text-2xl font-bold ${textHighlight} outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                            <div className="flex flex-col mr-1">
                              <button type="button" onClick={() => setPaceSec(s => { const v = (parseInt(s) || 0) + 1; return v > 59 ? 0 : v; })} className={`${textMuted} hover:${textHighlight}`}>
                                <ChevronUp size={12} />
                              </button>
                              <button type="button" onClick={() => setPaceSec(s => { const v = (parseInt(s) || 0) - 1; return v < 0 ? 59 : v; })} className={`${textMuted} hover:${textHighlight}`}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
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
                          <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`bg-transparent w-full text-3xl font-black ${textHighlight} outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                          <span className={`font-bold text-lg ${textMuted} mr-2`}>Min</span>
                          <div className="flex flex-col">
                            <button type="button" onClick={() => setMinutes(m => { const v = (parseInt(m) || 0) + 1; return v > 59 ? 0 : v; })} className={`p-0.5 rounded ${textMuted} hover:${textHighlight} hover:bg-black/5 dark:hover:bg-white/10`}>
                              <ChevronUp size={16} />
                            </button>
                            <button type="button" onClick={() => setMinutes(m => { const v = (parseInt(m) || 0) - 1; return v < 0 ? 59 : v; })} className={`p-0.5 rounded ${textMuted} hover:${textHighlight} hover:bg-black/5 dark:hover:bg-white/10`}>
                              <ChevronDown size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isCrescendoMode && (
                    <div className="space-y-6 mt-6">
                      <div className="space-y-3">
                        <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                          <TrendingUp className={textColorClass} size={24} /> <span>Répartition de l'effort</span>
                        </label>
                        <div className="flex justify-between text-xs font-bold">
                          <span style={{ color: crescendoWarmupColor }}>Échauffement {crescendoWarmupPct}%</span>
                          <span className={textColorClass}>Cœur {100 - crescendoWarmupPct - crescendoCooldownPct}%</span>
                          <span style={{ color: crescendoCooldownColor }}>Retour au calme {crescendoCooldownPct}%</span>
                        </div>
                        <DualRangeSlider
                          leftValue={crescendoWarmupPct} rightValue={crescendoCooldownPct} minMiddle={CRESCENDO_MIN_MAIN_PCT}
                          onChangeLeft={setCrescendoWarmupPct} onChangeRight={setCrescendoCooldownPct}
                          leftColor={crescendoWarmupColor} middleColor={crescendoCoreColor} rightColor={crescendoCooldownColor}
                          leftHandleBorderColor={crescendoWarmupColor} rightHandleBorderColor={crescendoCooldownColor}
                          leftAriaLabel="Part de l'échauffement" rightAriaLabel="Part du retour au calme"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs ${textMuted}`}>BPM personnalisé pour ces 2 phases :</p>
                          {bpmSourceIsProfile && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${bgAccentClass} text-white animate-in fade-in zoom-in duration-500`}>
                              <Gauge size={10}/> Profil Athlétique
                            </span>
                          )}
                        </div>

                        <div className={`space-y-4 p-4 rounded-xl ${inputBg} border ${inputBorder}`}>
                            {/* Griser (pas juste laisser un BPM "actif" trompeur) quand la part
                                de cette phase est à 0% (curseur double poussé jusqu'au bout) :
                                buildCrescendoSegments (musicEngine.js) n'en fait de toute façon
                                plus un segment séparé dans ce cas — retour direct après confusion
                                sur ce point précis, un BPM affiché "normalement" à 0% laissait
                                penser qu'il comptait encore. */}
                            <div className={crescendoWarmupPct === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold" style={{ color: crescendoWarmupColor }}>BPM Échauffement{crescendoWarmupPct === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{crescendoWarmupBpm}</span>
                              </div>
                              <input
                                type="range" min={crescendoBpmFloor} max={bpm}
                                value={crescendoWarmupBpm ?? crescendoBpmFloor}
                                onChange={(e) => setCrescendoWarmupBpm(parseInt(e.target.value) || crescendoBpmFloor)}
                                disabled={crescendoWarmupPct === 0}
                                style={{ accentColor: crescendoWarmupColor }}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none disabled:cursor-not-allowed"
                              />
                              {renderZoneQuickPicks(crescendoWarmupBpm, setCrescendoWarmupBpm)}
                            </div>
                            <div className={crescendoCooldownPct === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold" style={{ color: crescendoCooldownColor }}>BPM Retour au calme{crescendoCooldownPct === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{crescendoCooldownBpm}</span>
                              </div>
                              <input
                                type="range" min={crescendoBpmFloor} max={crescendoWarmupBpm ?? bpm}
                                value={crescendoCooldownBpm ?? crescendoBpmFloor}
                                onChange={(e) => setCrescendoCooldownBpm(parseInt(e.target.value) || crescendoBpmFloor)}
                                disabled={crescendoCooldownPct === 0}
                                style={{ accentColor: crescendoCooldownColor }}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none disabled:cursor-not-allowed"
                              />
                              {renderZoneQuickPicks(crescendoCooldownBpm, setCrescendoCooldownBpm)}
                            </div>
                        </div>

                        <p className={`text-xs ${textMuted} pt-1`}>Traduit en direct pour ta séance :</p>
                        {segments.map((segment) => (
                          <div key={segment.id} className={`flex items-center gap-3 p-3 rounded-xl ${inputBg} border ${inputBorder}`}>
                            <div className={`p-1.5 rounded-lg ${bgAccentClass} text-white shrink-0`}>
                              <TrendingUp size={16} />
                            </div>
                            <div className="flex-1">
                              <div className={`font-bold text-sm ${textHighlight}`}>{segment._crescendoLabel || 'Portion'}</div>
                              <div className={`text-xs ${textMuted}`}>
                                {/* Retour direct : personne ne raisonne en minutes décimales
                                    ("14.4 min") — précis à la seconde (formatDuration, déjà
                                    utilisée ailleurs dans l'app pour ça), pas besoin d'aller
                                    plus loin. Ne s'applique qu'au mode Temps : en mode
                                    Distance, durationValue est un km/mi, où le décimal reste
                                    la norme (ex. "3.2 km"). */}
                                {targetMode === 'distance' ? `${segment.durationValue} ${distanceUnit}` : formatDuration(segment.durationValue * 60)} · {segment.bpm} BPM
                              </div>
                            </div>
                          </div>
                        ))}
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
                      <div className={`text-sm font-bold ${textMuted} flex items-center bg-surface-hover px-3 py-1.5 rounded-lg`}>
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
                            <div className="flex-1">
                              <div className={`flex items-center bg-surface rounded-lg px-3 py-2 shadow-sm`}>
                                <input type="number" value={segment.bpm} onChange={(e) => setSegments(segments.map(s => s.id === segment.id ? { ...s, bpm: parseInt(e.target.value) || 0 } : s))} className={`w-full bg-transparent text-lg font-bold outline-none ${textHighlight}`} />
                                <span className={`text-xs font-bold ${textMuted}`}>BPM</span>
                              </div>
                              {renderZoneQuickPicks(segment.bpm, (zoneBpm) => setSegments(segments.map(s => s.id === segment.id ? { ...s, bpm: zoneBpm } : s)))}
                            </div>
                            <div className={`flex-1 flex items-center bg-surface rounded-lg px-3 py-2 shadow-sm h-fit`}>
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
                                {hasOverride ? "Style personnalisé pour cette portion" : "Suit le style musical de toute la séance"}
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
                                  <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                    {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                                  </button>
                                );
                              })}
                              <button
                                onClick={() => setShowExtraGenres(!showExtraGenres)}
                                title="Certains genres ci-dessous : génération un peu plus longue."
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}
                              >
                                {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                              </button>
                            </div>
                            {showExtraGenres && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {EXTRA_GENRES.map(genre => {
                                  const isSelected = (segment.selectedGenres || []).includes(genre);
                                  const warning = getGenreLocalDepthWarning(genre);
                                  return (
                                    <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                                      {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
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
                  <button
                    onClick={() => {
                      // Retour direct : "alternance entre VMA et EF ad vitam
                      // eternam" — continue le motif au-delà des 5 segments
                      // par défaut (voir setStructureMode, useGeneratorForm.js)
                      // plutôt que de simplement dupliquer le BPM du dernier
                      // segment tel quel. Ne s'applique qu'à partir du 2e
                      // segment (le 1er reste l'échauffement, jamais concerné
                      // par l'alternance) et seulement si le dernier segment
                      // correspond bien à l'une des 2 valeurs de zone — sinon
                      // (BPM personnalisé, hors zones) le comportement
                      // d'origine (dupliquer) reste le plus sûr.
                      const last = segments[segments.length - 1];
                      const effectiveProfile = resolveEffectiveActivityProfile();
                      const vmaBpm = effectiveProfile.zone4;
                      const efBpm = effectiveProfile.zone2;
                      let nextBpm = last.bpm;
                      if (segments.length >= 2 && vmaBpm && efBpm) {
                        if (last.bpm === vmaBpm) nextBpm = efBpm;
                        else if (last.bpm === efBpm) nextBpm = vmaBpm;
                      }
                      setSegments([...segments, { id: Date.now(), bpm: nextBpm, durationValue: targetMode==='distance'?1:10 }]);
                    }}
                    className={`w-full py-4 mt-4 border-2 border-dashed ${inputBorder} rounded-xl flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400 bg-gray-50 dark:bg-gray-800/50`}
                  >
                    <Plus size={20} /><span>Ajouter une portion</span>
                  </button>
                </div>
              )}

              {showScrollHint && (
                <div className="sticky bottom-0 left-0 right-0 flex justify-center pt-2 pointer-events-none">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg animate-bounce ${bgAccentClass} text-white`}>
                    <ChevronDown size={12} /> <span>Fais défiler pour tout voir</span>
                  </div>
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
                        `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-surface-hover ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                        {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                      </button>
                    )
                  })}
                  {/* Le mode Intime garde volontairement sa liste restreinte, pas d'extension ici */}
                  {!isNaughtyMode && (
                    <button
                      onClick={() => setShowExtraGenres(!showExtraGenres)}
                      title="Certains genres ci-dessous : génération un peu plus longue."
                      className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 border-dashed ${cardBorder} ${textMuted} hover:${textHighlight}`}
                    >
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
                          `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-surface-hover ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
                          {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* Rappel une fois le panneau ouvert — retour direct : préférer une
                    infobulle sur "+ Plus de genres" AVANT le clic (title ci-dessus) plutôt
                    qu'un texte statique qui n'apparaissait qu'après ouverture ; ce
                    paragraphe reste comme rappel visuel une fois le panneau déjà ouvert,
                    mais un ton plus affirmé (couleur, poids) qu'un simple texte gris discret
                    pour qu'il ne se perde pas au milieu des pills de genre. Le message "au
                    moment de générer" est lui déplacé dans le bandeau "Génération en
                    cours" (App.jsx), plus pertinent au moment où le délai se produit
                    réellement qu'en avertissement statique avant de cliquer. */}
                {!isNaughtyMode && showExtraGenres && (
                  <p className={`text-sm flex items-start gap-1.5 font-semibold ${textColorClass}`}>
                    <Info size={16} className="shrink-0 mt-0.5" />
                    {/* Retour direct : "on n'a pas la liste exhaustive des genres pour
                        lesquels ça peut être long, autant rester vague" — ce texte
                        nommait explicitement WEAK_DEEZER_KEYWORD_GENRES, une liste
                        de convenance interne (genres dont le mot-clé Deezer est une
                        approximation en texte libre, voir musicCatalog.js), pas une
                        promesse de couverture exhaustive de "tout ce qui peut être
                        lent" — un genre absent de cette liste précise pourrait très
                        bien l'être aussi selon le catalogue Deezer du moment. Reformulé
                        pour ne plus rien nommer explicitement. */}
                    <span>Les genres les moins courants dans le catalogue peuvent demander une recherche plus approfondie : la génération prend alors un peu plus de temps.</span>
                  </p>
                )}

                {/* Répartition en % entre plusieurs genres sélectionnés ensemble — voir
                    setGenreWeight pour la logique de verrouillage. N'apparaît qu'à partir
                    de 2 genres. */}
                {selectedGenres.length > 1 && (
                  <div className={`flex flex-wrap items-center gap-3 pt-2 p-4 rounded-2xl ${inputBg} border ${inputBorder}`}>
                    <span className={`text-xs font-bold ${textMuted} w-full`}>Répartition entre les genres choisis :</span>
                    {selectedGenres.map(genre => (
                      <div key={genre} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${cardBg} border ${cardBorder}`}>
                        <span className={`text-sm font-bold ${textHighlight}`}>{genreDisplayLabel(genre)}</span>
                        <input
                          type="number" min="0" max="100"
                          value={genreWeights[genre] ?? 0}
                          onChange={(e) => setGenreWeight(genre, e.target.value)}
                          className={`w-12 bg-transparent text-right font-mono font-bold ${textColorClass} outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        />
                        <span className={`text-xs ${textMuted}`}>%</span>
                      </div>
                    ))}
                    <button onClick={() => { setGenreWeights(equalSplitWeights(selectedGenres)); setLockedGenreWeights(new Set()); }} className={`text-xs font-bold underline ${textMuted} hover:${textHighlight}`}>
                      Répartition égale
                    </button>
                    <p className={`text-xs w-full ${textMuted}`}>Répartition indicative : le moteur essaie de s'en rapprocher, mais un genre avec moins de titres disponibles peut finir légèrement sous-représenté (un avertissement s'affichera si l'écart est important).</p>
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
                  <input type="range" min="0" max="30" value={bpmTolerance} onChange={(e) => setBpmTolerance(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ?
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
                  <input type="range" min="0" max="12" value={crossfade} onChange={(e) => setCrossfade(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ?
                    'accent-rose-500' : 'accent-red-500'}`} />
                  <p className={`text-xs ${textMuted}`}>Élimine les blancs entre les morceaux pour une énergie constante.</p>
                </div>

                {/* Sans ce filtre, un titre atypiquement long pouvait monopoliser une
                    grosse partie d'une séance courte. Off par défaut. */}
                <div className={`flex items-center justify-between p-5 rounded-2xl ${inputBg} border ${inputBorder}`}>
                  <div>
                    <label className={`text-sm font-bold flex items-center space-x-2 ${textMuted}`}>
                      <Clock size={18} /><span>Titres de plus de 6 min</span>
                    </label>
                    <p className={`text-xs mt-1 ${textMuted}`}>Autorise les morceaux longs (épiques, prog...) dans la sélection.</p>
                  </div>
                  <button
                    onClick={() => setAllowLongTracks(!allowLongTracks)}
                    className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ml-4 ${allowLongTracks ? (isNaughtyMode ? 'bg-rose-500' : 'bg-red-500') : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${allowLongTracks ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Exploration manuelle : voir les titres qui matchent pile ce BPM + ces genres,
                  avec extrait audio, plutôt que de laisser l'algorithme piocher au hasard. */}
              <button onClick={() => {
                setCurrentPlaylist(null);
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

              {/* Message "genre plus long à générer" retiré d'ici : déplacé dans le
                  bandeau "Génération en cours" (App.jsx), plus pertinent au moment où
                  le délai se produit réellement — voir isGeneratingSlowGenre. */}

              {/* Boutons finaux : génération immédiate, ou sauvegarde en routine réutilisable */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => executeGeneration({ isIntervalMode, isCrescendoMode, targetMode, distanceVal, distanceUnit, paceMin, paceSec, segments, bpm, hours, minutes, selectedGenres, bpmTolerance, crossfade, allowLongTracks, genreWeights, workoutName: getActiveWorkoutName() })} disabled={isGenerating} className={`flex-1 text-xl font-black py-5 rounded-2xl flex items-center justify-center space-x-3 transition-transform active:scale-95 shadow-xl ${isNaughtyMode ?
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
        </>
      )}
    </div>
  );
}
