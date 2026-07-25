import { useModalContext } from '../../contexts/ModalContext';
import AuthModal from '../modals/AuthModal';
import ImportSharedPlaylistModal from '../modals/ImportSharedPlaylistModal';
import PendingNavigationModal from '../modals/PendingNavigationModal';
import PendingUnsaveModal from '../modals/PendingUnsaveModal';

/**
 * ModalContainer — regroupe le rendu des modales migrées vers ModalContext
 * (25/07, chantier "centraliser les modales", voir ModalContext.jsx pour le
 * détail du périmètre et des choix de conception).
 *
 * Chaque modale reçoit `modalData` tel quel, sous le nom de prop qu'elle
 * attendait déjà avant cette migration (`preview`, `pendingNavigation`,
 * `pendingUnsavePlaylist`...) — aucune modale n'a eu besoin de changer sa
 * propre logique interne au-delà de `setX(null)` → `onClose()`.
 *
 * Les 6 autres modales du projet (Share, Search, EditRoutine, SavingRoutine,
 * CustomActivity, IconPicker) restent rendues directement dans App.jsx pour
 * l'instant — pas encore migrées, voir ModalContext.jsx.
 */
export default function ModalContainer({
  theme, signUp, signIn, resetPassword, showToast,
  onImportSharedPlaylist, resolvePendingNavigation, removeSavedPlaylist,
}) {
  const { activeModal, modalData, closeModal } = useModalContext();

  return (
    <>
      <AuthModal
        theme={theme}
        isAuthModalOpen={activeModal === 'AUTH'} onClose={closeModal}
        signUp={signUp} signIn={signIn} resetPassword={resetPassword} showToast={showToast}
      />

      <ImportSharedPlaylistModal
        theme={theme}
        isOpen={activeModal === 'IMPORT_SHARED_PLAYLIST'} onClose={closeModal}
        preview={modalData} onImport={onImportSharedPlaylist}
      />

      <PendingNavigationModal
        theme={theme}
        pendingNavigation={activeModal === 'PENDING_NAVIGATION' ? modalData : null}
        onClose={closeModal} resolvePendingNavigation={resolvePendingNavigation}
      />

      <PendingUnsaveModal
        theme={theme}
        pendingUnsavePlaylist={activeModal === 'PENDING_UNSAVE' ? modalData : null}
        onClose={closeModal} removeSavedPlaylist={removeSavedPlaylist}
      />
    </>
  );
}
