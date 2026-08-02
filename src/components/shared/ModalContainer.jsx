import { useModalContext } from '../../contexts/ModalContext';
import AuthModal from '../modals/AuthModal';
import ImportSharedPlaylistModal from '../modals/ImportSharedPlaylistModal';
import PendingNavigationModal from '../modals/PendingNavigationModal';
import PendingUnsaveModal from '../modals/PendingUnsaveModal';
import PublicRoutinePreviewModal from '../modals/PublicRoutinePreviewModal';

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
 * `PublicRoutinePreviewModal` (Vague 2, Chantier 1 — UI publique des
 * routines, 02/08) rejoint ce groupe directement : `modalData` porte la
 * LIGNE brute `routines` consultée (voir handleOpenPublicRoutine, App.jsx),
 * `onClone` déclenche le clonage puis ferme elle-même via `closeModal`
 * (même schéma qu'`onImportSharedPlaylist` ci-dessous).
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
  theme, signUp, signIn, resetPassword, checkUsernameAvailable, showToast,
  onImportSharedPlaylist, resolvePendingNavigation, removeSavedPlaylist, onCloneRoutine,
}) {
  const { activeModal, modalData, closeModal } = useModalContext();

  return (
    <>
      <AuthModal
        theme={theme}
        isAuthModalOpen={activeModal === 'AUTH'} onClose={closeModal}
        signUp={signUp} signIn={signIn} resetPassword={resetPassword} checkUsernameAvailable={checkUsernameAvailable} showToast={showToast}
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

      <PublicRoutinePreviewModal
        theme={theme}
        isOpen={activeModal === 'PUBLIC_ROUTINE_PREVIEW'} onClose={closeModal}
        routine={modalData} onClone={onCloneRoutine}
      />
    </>
  );
}
