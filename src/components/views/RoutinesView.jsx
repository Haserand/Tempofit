import { ListPlus, Plus, Edit3, Trash2, Layers, Info, Loader2, PlaySquare } from 'lucide-react';

/**
 * RoutinesView — vue "Mes Routines" (configurations sauvegardées, relançables en un clic).
 *
 * Extrait de App.jsx (bloc `view === 'routines'`). Les routines sont triées
 * côté composant (par nombre de générations manuelles décroissant), mais la
 * mutation de l'état (`setRoutines`, `setRoutineBatchCounts`) reste pilotée
 * depuis App.jsx via les props — ce composant ne fait qu'appeler les setters
 * qu'on lui passe.
 */
export default function RoutinesView({
  theme, routines, setRoutines, routineBatchCounts, setRoutineBatchCounts,
  getDisplayRoutineIcon, getDisplayRoutineName, renderConfigInfoLine, getRankStyle,
  setEditingRoutine, setIsEditRoutineModalOpen, executeGeneration, isGenerating, changeView,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, inputBg, inputBorder } = theme;

  // Triées par nombre de générations manuelles décroissant — les plus utilisées
  // remontent en premier. À égalité, ordre inchangé.
  const sortedRoutines = [...routines].sort((a, b) => (b.manualGenerations || 0) - (a.manualGenerations || 0));
  const routineRanks = [...routines]
    .filter(r => (r.manualGenerations || 0) > 0)
    .sort((a, b) => (b.manualGenerations || 0) - (a.manualGenerations || 0))
    .map(r => r.id);

  return (
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
          <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed ${cardBorder} flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400`}>
            <Plus size={28} />
            <span>Créer une nouvelle routine</span>
          </button>
        )}
        {sortedRoutines.map(routine => {
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
                    {routine.isCrescendoMode ? 'Crescendo' : 'Fractionné'}
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
                    <Info size={13} className={`${textMuted} ml-0.5 mr-1 shrink-0`} />
                  </div>
                  <button onClick={() => { executeGeneration({ ...routine, workoutName: routine.customActivity || routine.workoutType, routineName: routine.name }, batchCount, routine.id);
                  }} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${bgAccentClass} text-white hover:brightness-110 active:scale-95`}>
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <PlaySquare size={18} fill="currentColor"/>}
                    <span>Générer</span>
                  </button>
                </div>
                {routine.createdAt && (
                  <div className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {routine.createdAt}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
