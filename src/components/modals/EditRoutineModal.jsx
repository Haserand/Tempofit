import { Edit3, X, ChevronUp, ChevronDown } from 'lucide-react';
import { NAUGHTY_GENRES, STANDARD_GENRES, EXTRA_GENRES, getGenreLocalDepthWarning, genreDisplayLabel } from '../../musicCatalog';
import { getZoneForValue } from '../../appConfig';
import DualRangeSlider from '../shared/DualRangeSlider';

/**
 * EditRoutineModal — édition d'une routine existante. Contrairement à la
 * modale de création (SavingRoutineModal.jsx), elle propose un choix
 * explicite à la sauvegarde : appliquer les changements uniquement à la
 * génération lancée maintenant ("cette séance seulement"), ou les
 * répercuter sur la routine elle-même pour toutes les générations futures
 * ("toujours pour cette routine").
 *
 * Extrait de App.jsx (voir CustomActivityModal.jsx pour le contexte de
 * cette série d'extractions) — la plus grosse et la plus complexe des
 * modales déplacées (le visuel Crescendo zone-aware, voir "règle d'or"
 * ergonomie, déjà présent dans GeneratorView.jsx pour le wizard lui-même).
 */
export default function EditRoutineModal({
  theme, isNaughtyMode,
  isEditRoutineModalOpen, setIsEditRoutineModalOpen,
  editingRoutine, setEditingRoutine,
  showExtraGenres, setShowExtraGenres,
  getProfileForWorkout, CRESCENDO_MIN_MAIN_PCT,
  applyRoutineEditOnce, applyRoutineEditPermanently,
}) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass, borderAccentClass } = theme;

  if (!isEditRoutineModalOpen || !editingRoutine) return null;

  const close = () => { setIsEditRoutineModalOpen(false); setEditingRoutine(null); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={close}>
      <div className={"p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <Edit3 className={textColorClass}/>
            <span>Éditer la routine</span>
          </h3>
          <button onClick={close} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
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
                  <button type="button" onClick={() => setEditingRoutine(r => ({...r, minutes: (parseInt(r.minutes) || 0) + 1 > 59 ? 0 : (parseInt(r.minutes) || 0) + 1}))} className={`${textMuted} hover:text-main`}>
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => setEditingRoutine(r => ({...r, minutes: (parseInt(r.minutes) || 0) - 1 < 0 ? 59 : (parseInt(r.minutes) || 0) - 1}))} className={`${textMuted} hover:text-main`}>
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
                  }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                    {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                  </button>
                );
              })}
              {!isNaughtyMode && (
                <button onClick={() => setShowExtraGenres(!showExtraGenres)} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:text-main`}>
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
                    }} title={warning || undefined} className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                      {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {editingRoutine.isIntervalMode && (
            editingRoutine.isCrescendoMode ? (() => {
              // Même "règle d'or" ergonomie que GeneratorView.jsx (voir
              // crescendoWarmupColor et al. là-bas) : couleur = vraie zone
              // du BPM de ce segment, pas 3 couleurs fixes par rôle.
              // Repli sur les anciennes couleurs (sky/accent/emerald) si
              // aucun profil n'est configuré pour cette activité.
              const editAccentFallback = isNaughtyMode ? '#f43f5e' : '#ef4444';
              const editWarmupZone = getZoneForValue(editingRoutine.crescendoWarmupBpm ?? (isNaughtyMode ? 40 : 80), editingRoutine.workoutType, getProfileForWorkout, editingRoutine.customActivity);
              const editCoreZone = getZoneForValue(editingRoutine.bpm, editingRoutine.workoutType, getProfileForWorkout, editingRoutine.customActivity);
              const editCooldownZone = getZoneForValue(editingRoutine.crescendoCooldownBpm ?? (isNaughtyMode ? 40 : 80), editingRoutine.workoutType, getProfileForWorkout, editingRoutine.customActivity);
              const editWarmupColor = editWarmupZone?.color || '#0ea5e9';
              const editCoreColor = editCoreZone?.color || editAccentFallback;
              const editCooldownColor = editCooldownZone?.color || '#10b981';
              return (
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className={`text-sm font-bold ${textMuted}`}>Répartition de l'effort</label>
                  <div className="flex justify-between text-xs font-bold">
                    <span style={{ color: editWarmupColor }}>Échauffement {editingRoutine.crescendoWarmupPct ?? 15}%</span>
                    <span className={textColorClass}>Cœur {100 - (editingRoutine.crescendoWarmupPct ?? 15) - (editingRoutine.crescendoCooldownPct ?? 15)}%</span>
                    <span style={{ color: editCooldownColor }}>Retour au calme {editingRoutine.crescendoCooldownPct ?? 15}%</span>
                  </div>
                  <DualRangeSlider
                    leftValue={editingRoutine.crescendoWarmupPct ?? 15} rightValue={editingRoutine.crescendoCooldownPct ?? 15} minMiddle={CRESCENDO_MIN_MAIN_PCT}
                    onChangeLeft={(val) => setEditingRoutine({ ...editingRoutine, crescendoWarmupPct: val })}
                    onChangeRight={(val) => setEditingRoutine({ ...editingRoutine, crescendoCooldownPct: val })}
                    leftColor={editWarmupColor} middleColor={editCoreColor} rightColor={editCooldownColor}
                    leftHandleBorderColor={editWarmupColor} rightHandleBorderColor={editCooldownColor}
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
                          <span className="text-xs font-bold" style={{ color: editWarmupColor }}>BPM Échauffement{(editingRoutine.crescendoWarmupPct ?? 15) === 0 && ' (0% — sans effet)'}</span>
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
                          style={{ accentColor: editWarmupColor }}
                          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className={(editingRoutine.crescendoCooldownPct ?? 15) === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold" style={{ color: editCooldownColor }}>BPM Retour au calme{(editingRoutine.crescendoCooldownPct ?? 15) === 0 && ' (0% — sans effet)'}</span>
                          <span className={`text-sm font-black ${textHighlight}`}>{editingRoutine.crescendoCooldownBpm}</span>
                        </div>
                        <input
                          type="range" min={isNaughtyMode ? 40 : 80} max={editingRoutine.crescendoWarmupBpm ?? editingRoutine.bpm}
                          value={editingRoutine.crescendoCooldownBpm ?? (isNaughtyMode ? 40 : 80)}
                          onChange={(e) => setEditingRoutine({ ...editingRoutine, crescendoCooldownBpm: parseInt(e.target.value) || (isNaughtyMode ? 40 : 80) })}
                          disabled={(editingRoutine.crescendoCooldownPct ?? 15) === 0}
                          style={{ accentColor: editCooldownColor }}
                          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none disabled:cursor-not-allowed"
                        />
                      </div>
                  </div>
                </div>

                <p className={`text-[11px] ${textMuted}`}>Les 3 portions se recalculent automatiquement selon ces réglages.</p>
              </div>
              );
            })() : (
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
  );
}
