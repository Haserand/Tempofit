import { AlertCircle } from 'lucide-react';

/**
 * PendingUnsaveModal — confirmation avant de retirer une playlist de "Mes
 * Séances" quand elle a de l'historique à perdre (complétions et/ou données
 * réelles importées). Extrait de App.jsx (voir CustomActivityModal.jsx pour
 * le contexte de cette série d'extractions).
 */
export default function PendingUnsaveModal({
  theme, pendingUnsavePlaylist, setPendingUnsavePlaylist, removeSavedPlaylist,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted } = theme;

  if (!pendingUnsavePlaylist) return null;

  return (
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
  );
}
