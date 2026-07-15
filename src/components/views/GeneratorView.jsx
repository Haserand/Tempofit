import { useEffect, useRef, useState } from 'react';
import {
  Activity, Heart, Clock, Footprints, ListPlus, MapPin, SlidersHorizontal, Music, Trash2, Plus,
  Target, Loader2, Zap, BookmarkPlus, Info, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Flame,
  TrendingUp, Gauge,
} from 'lucide-react';
import { STANDARD_GENRES, EXTRA_GENRES, getGenreLocalDepthWarning, genreDisplayLabel, WEAK_DEEZER_KEYWORD_GENRES } from '../../musicCatalog';
import { formatDuration } from '../../utils/format';
import DualRangeSlider from '../shared/DualRangeSlider';
import {
  WORKOUT_TYPES, NAUGHTY_WORKOUT_ORDER, NAUGHTY_WORKOUT_ICONS, NAUGHTY_WORKOUT_LABELS,
  WORKOUT_DEFAULT_BPM, WORKOUT_DEFAULT_TARGET,
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
  setBpm, setTargetMode, setDistanceVal, setDistanceUnit, setHours, setMinutes,
  targetMode, isIntervalMode, isCrescendoMode, structureMode, setStructureMode,
  crescendoWarmupPct, setCrescendoWarmupPct, crescendoCooldownPct, setCrescendoCooldownPct, CRESCENDO_MIN_MAIN_PCT,
  crescendoWarmupBpm, setCrescendoWarmupBpm, crescendoCooldownBpm, setCrescendoCooldownBpm,
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
              {/* Le choix Temps/Distance n'a pas de sens en mode Intime : le mode reste
                  forcé sur "temps" (voir toggleNaughtyMode) et ce sélecteur est masqué. */}
              {!isNaughtyMode && (
                <>
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
                          onClick={() => setStructureMode(mode)}
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
                    <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className={`w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ?
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
                          <span className="text-sky-500 dark:text-sky-400">Échauffement {crescendoWarmupPct}%</span>
                          <span className={textColorClass}>Cœur {100 - crescendoWarmupPct - crescendoCooldownPct}%</span>
                          <span className="text-emerald-500 dark:text-emerald-400">Retour au calme {crescendoCooldownPct}%</span>
                        </div>
                        <DualRangeSlider
                          leftValue={crescendoWarmupPct} rightValue={crescendoCooldownPct} minMiddle={CRESCENDO_MIN_MAIN_PCT}
                          onChangeLeft={setCrescendoWarmupPct} onChangeRight={setCrescendoCooldownPct}
                          leftColorClass="bg-sky-400 dark:bg-sky-500" middleColorClass={bgAccentClass} rightColorClass="bg-emerald-400 dark:bg-emerald-500"
                          leftHandleBorderClass="border-sky-500" rightHandleBorderClass="border-emerald-500"
                          leftAriaLabel="Part de l'échauffement" rightAriaLabel="Part du retour au calme"
                        />
                      </div>

                      <div className="space-y-2">
                        <p className={`text-xs ${textMuted}`}>BPM personnalisé pour ces 2 phases :</p>

                        <div className={`space-y-4 p-4 rounded-xl ${inputBg} border ${inputBorder}`}>
                            {/* Griser (pas juste laisser un BPM "actif" trompeur) quand la part
                                de cette phase est à 0% (curseur double poussé jusqu'au bout) :
                                buildCrescendoSegments (musicEngine.js) n'en fait de toute façon
                                plus un segment séparé dans ce cas — retour direct après confusion
                                sur ce point précis, un BPM affiché "normalement" à 0% laissait
                                penser qu'il comptait encore. */}
                            <div className={crescendoWarmupPct === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-sky-500 dark:text-sky-400">BPM Échauffement{crescendoWarmupPct === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{crescendoWarmupBpm}</span>
                              </div>
                              <input
                                type="range" min={crescendoBpmFloor} max={bpm}
                                value={crescendoWarmupBpm ?? crescendoBpmFloor}
                                onChange={(e) => setCrescendoWarmupBpm(parseInt(e.target.value) || crescendoBpmFloor)}
                                disabled={crescendoWarmupPct === 0}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none accent-sky-500 disabled:cursor-not-allowed"
                              />
                            </div>
                            <div className={crescendoCooldownPct === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">BPM Retour au calme{crescendoCooldownPct === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{crescendoCooldownBpm}</span>
                              </div>
                              <input
                                type="range" min={crescendoBpmFloor} max={crescendoWarmupBpm ?? bpm}
                                value={crescendoCooldownBpm ?? crescendoBpmFloor}
                                onChange={(e) => setCrescendoCooldownBpm(parseInt(e.target.value) || crescendoBpmFloor)}
                                disabled={crescendoCooldownPct === 0}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none accent-emerald-500 disabled:cursor-not-allowed"
                              />
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
                                  <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
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
                                    <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
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
                  <button onClick={() => setSegments([...segments, { id: Date.now(), bpm: segments[segments.length - 1].bpm, durationValue: targetMode==='distance'?1:10 }])} className={`w-full py-4 mt-4 border-2 border-dashed ${inputBorder} rounded-xl flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400 bg-gray-50 dark:bg-gray-800/50`}>
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
                        `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
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
                          `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-gray-100 dark:bg-gray-800 ${cardBorder} ${textMuted} hover:${textHighlight}`}`}>
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
                    <span>{WEAK_DEEZER_KEYWORD_GENRES.map(genreDisplayLabel).join(', ')} demandent une recherche plus approfondie : la génération peut prendre un peu plus de temps si tu en choisis un.</span>
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
    </div>
  );
}
