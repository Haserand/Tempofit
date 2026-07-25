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
 * `Share`, `Search`, `EditRoutine` et `SavingRoutine` sont ÉGALEMENT migrées
 * vers ModalContext depuis (toujours 25/07), mais rendues ailleurs qu'ici :
 * leur booléen d'ouverture est dérivé directement dans le hook qui possède
 * déjà le reste de leur état (`useShare.js`, `useRoutines.js`), donc rendues
 * dans App.jsx à l'endroit où cet état est naturellement disponible, plutôt
 * que de le faire transiter par ce composant sans bénéfice réel.
 * `CustomActivityModal` n'a pas besoin d'être migrée : déjà autonome via
 * GeneratorContext. `IconPickerModal` a été supprimée (25/07) : jamais
 * déclenchée nulle part dans le projet — fonctionnalité morte confirmée,
 * sans rapport avec ce chantier.
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
