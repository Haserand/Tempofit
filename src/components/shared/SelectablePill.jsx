/**
 * SelectablePill.jsx — bouton "pastille" (genre, activité, tout élément
 * sélectionnable/désélectionnable individuellement), extrait le 22/08 —
 * suite des extractions `BottomBarShell.jsx`/`ModalShell.jsx`/
 * `ModalCloseButton.jsx` (même question directe, même jour).
 *
 * ⚠️ Portée volontairement LIMITÉE au style visuel — jamais à la logique
 * de sélection autour, qui DIFFÈRE réellement selon les 3 fichiers
 * d'origine (`EditRoutineModal.jsx`/`FavoritesView.jsx`, garde-fou "au
 * moins 1 genre sélectionné" présent dans le 1er, délibérément absent du
 * 2e — voir son propre commentaire pour le raisonnement ;
 * `AthleticProfilePanel.jsx`, sélection UNIQUE — onglet d'activité, pas
 * multi-sélection — avec en plus une coche "configuré" et un bouton de
 * réinitialisation superposé). Extraire la logique de sélection aurait
 * exigé d'unifier des comportements qui doivent rester différents —
 * seul le bouton visuel lui-même (couleurs sélectionné/non-sélectionné,
 * padding, arrondi) était un littéral réellement identique dans les 3
 * fichiers.
 *
 * `extraSelectedClassName` : point d'extension pour un besoin ponctuel
 * comme `AthleticProfilePanel.jsx` (`pr-7` sur l'onglet sélectionné ET
 * configuré, pour laisser la place à son icône de coche) — vide par
 * défaut, n'affecte aucun des autres appelants qui ne le passent pas.
 */
export default function SelectablePill({ selected, onClick, title, theme, extraSelectedClassName = '', children }) {
  const { bgAccentClass, borderAccentClass, cardBorder, textMuted } = theme;
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${selected ? `${bgAccentClass} ${borderAccentClass} text-white ${extraSelectedClassName}` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}
    >
      {children}
    </button>
  );
}
