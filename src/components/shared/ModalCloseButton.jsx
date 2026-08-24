import { X } from 'lucide-react';
import { ICON_BUTTON_ROUNDING } from '../../layout/iconButtonLayout';

/**
 * ModalCloseButton.jsx — la croix de fermeture en haut à droite d'une
 * modale, extraite le 22/08 (même question directe, même jour, qui a
 * déjà produit `BottomBarShell.jsx`/`ModalShell.jsx` — "tu vois encore
 * des composants à extraire ?").
 *
 * ⚠️ Contrairement à `ModalShell.jsx` (qui n'extrait QUE le fond+carte,
 * pas l'en-tête, parce que celui-ci varie trop entre modales), CE bouton
 * précis, lui, était un littéral STRICTEMENT identique dans 10 des 12
 * fichiers de modales du projet — `AuthModal.jsx`, `CustomActivityModal.jsx`,
 * `EditPlaylistModal.jsx`, `EditRoutineModal.jsx`,
 * `ImportSharedPlaylistModal.jsx`, `PublicRoutinePreviewModal.jsx`,
 * `SavingRoutineModal.jsx`, `SearchModal.jsx`, `SearchUsersModal.jsx`,
 * `ShareModal.jsx`. Les 2 modales restantes
 * (`PendingNavigationModal.jsx`/`PendingUnsaveModal.jsx`) n'ont
 * délibérément PAS de croix dans leur en-tête (icône d'alerte à la
 * place, fermeture via les boutons du pied de page) — ce composant n'y
 * est donc pas utilisé, cohérent avec le choix déjà fait pour
 * `ModalShell.jsx`.
 *
 * Seul point de variation entre appelants : le handler `onClick` lui-même
 * (`close`, `onClose`, `() => setXxxModalOpen(false)`...) — tout le reste
 * (padding, couleurs, icône, taille) est désormais imposé par ce
 * composant, pas laissé au choix de chaque fichier.
 */
export default function ModalCloseButton({ onClick }) {
  return (
    <button onClick={onClick} className={`p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors ${ICON_BUTTON_ROUNDING} hover:bg-surface-hover`}>
      <X size={20}/>
    </button>
  );
}
