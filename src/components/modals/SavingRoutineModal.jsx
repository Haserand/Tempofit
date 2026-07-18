import { X, BookmarkPlus } from 'lucide-react';
import { AVAILABLE_ICONS, AUTO_GEN_OPTIONS } from '../../appConfig';

/**
 * SavingRoutineModal — création d'une nouvelle routine à partir des réglages
 * actuels du wizard. Extrait de App.jsx (voir CustomActivityModal.jsx pour
 * le contexte de cette série d'extractions).
 */
export default function SavingRoutineModal({
  theme, isNaughtyMode,
  isSavingRoutineModalOpen, setIsSavingRoutineModalOpen,
  newRoutineName, setNewRoutineName,
  newRoutineIcon, setNewRoutineIcon,
  newRoutineFreq, setNewRoutineFreq,
  handleSaveRoutine,
}) {
  const { cardBg, cardBorder, textHighlight, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

  if (!isSavingRoutineModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSavingRoutineModalOpen(false)}>
      <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-2xl font-bold flex items-center space-x-2 " + textHighlight}>
            <BookmarkPlus className={isNaughtyMode ? "text-rose-500" : "text-yellow-500"}/> <span>Nouvelle Routine</span>
          </h3>
          <button onClick={() => setIsSavingRoutineModalOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>
        <div className="space-y-4 mb-6">
          <input
            type="text" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)}
            placeholder="Nom (Ex: 5km Rapide)" autoFocus
            className={"w-full rounded-xl px-4 py-3 font-bold outline-none border " + inputBg + " " + inputBorder + " " + textHighlight}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveRoutine()}
          />
          <div className="flex justify-between bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-divider">
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
              {AUTO_GEN_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-surface">{opt}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-2">Permet à TempoFit de préparer automatiquement ces playlists en arrière-plan.</p>
          </div>
        </div>
        <button onClick={handleSaveRoutine} className={"w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all " + bgAccentClass}>Enregistrer la routine</button>
      </div>
    </div>
  );
}
