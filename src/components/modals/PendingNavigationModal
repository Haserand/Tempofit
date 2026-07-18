import { AlertCircle } from 'lucide-react';

/**
 * PendingNavigationModal — avertissement quand l'utilisateur quitte une
 * playlist générée mais jamais sauvegardée. Extrait de App.jsx (voir
 * CustomActivityModal.jsx pour le contexte de cette série d'extractions).
 */
export default function PendingNavigationModal({
  theme, pendingNavigation, setPendingNavigation, resolvePendingNavigation,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass } = theme;

  if (!pendingNavigation) return null;

  return (
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
  );
}
