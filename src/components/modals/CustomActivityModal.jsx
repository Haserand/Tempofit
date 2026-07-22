import { X } from 'lucide-react';
import { useGeneratorContext } from '../../contexts/GeneratorContext';

/**
 * CustomActivityModal — saisie du nom d'une activité personnalisée ("Autre"
 * à l'étape 1 du wizard). Extrait de App.jsx (retour direct : "prends du
 * recul sur le code, comment tu diviserais App.jsx ?" — App.jsx contenait au
 * moins 6 modales entières en JSX inline, jamais extraites contrairement aux
 * VUES (GeneratorView, StatsView...), qui elles suivent déjà ce pattern).
 *
 * Chantier God Component étape 2 (suite) : cette modale appartient au wizard
 * de génération ("Autre" à l'étape 1) — tout son state (ouverture, valeur
 * temporaire, confirmation) vit déjà dans GeneratorContext (voir
 * contexts/GeneratorContext.jsx) puisque `useCustomActivity` y est appelé.
 * Ne reste en props que ce qui est VRAIMENT hors de ce périmètre : `theme`
 * (convention partagée avec toutes les vues extraites, vient de useTheme.js)
 * et `userStats`/`checkTrophies` (système de trophées, sans rapport avec le
 * générateur — seul l'easter egg Rick Astley les utilise ici).
 */
export default function CustomActivityModal({ theme, userStats, checkTrophies }) {
  const {
    isNaughtyMode,
    isCustomActivityModalOpen, setIsCustomActivityModalOpen,
    tempCustomActivity, setTempCustomActivity, setCustomActivity,
    getProfileForWorkout, applyProfileBpmIfUntouched,
  } = useGeneratorContext();

  const { cardBg, cardBorder, textHighlight, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

  if (!isCustomActivityModalOpen) return null;

  const confirm = () => {
    setCustomActivity(tempCustomActivity);
    setIsCustomActivityModalOpen(false);
    // Même pré-remplissage BPM que Course à pied/Cyclisme à l'étape 1 (voir
    // applyProfileBpmIfUntouched, useGeneratorForm.js) — pour une activité
    // personnalisée, le nom n'est connu qu'à cette confirmation, pas au
    // moment où "Autre" est cliqué (voir GeneratorView.jsx, où le nom
    // n'existe pas encore à ce stade).
    if (!isNaughtyMode) applyProfileBpmIfUntouched(getProfileForWorkout('Autre', tempCustomActivity));
    // Easter egg : taper "Rick Astley" dans l'activité personnalisée débloque le trophée dédié.
    if (tempCustomActivity.toLowerCase().includes('rick astley')) {
      checkTrophies({ ...userStats, hasRickroll: true });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCustomActivityModalOpen(false)}>
      <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl transform transition-all border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-2xl font-bold " + textHighlight}>Activité personnalisée</h3>
          <button onClick={() => setIsCustomActivityModalOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>
        <input
          type="text" value={tempCustomActivity} onChange={e => setTempCustomActivity(e.target.value)}
          placeholder="Ex: Yoga..." autoFocus
          className={"w-full rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-red-500 mb-8 border " + inputBg + " " + inputBorder + " " + textHighlight}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
        />
        <div className="flex justify-end space-x-3">
          <button onClick={() => setIsCustomActivityModalOpen(false)} className={"px-6 py-3 font-medium hover:" + textHighlight + " " + textMuted}>Annuler</button>
          <button onClick={confirm} className={"px-6 py-3 text-white font-bold rounded-xl shadow-md " + bgAccentClass}>Valider</button>
        </div>
      </div>
    </div>
  );
}
