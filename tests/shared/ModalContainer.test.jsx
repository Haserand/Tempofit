// @vitest-environment jsdom
//
// Palier 3 (29/07, 9/11) — ModalContainer. Composant purement "dispatch" :
// lit `activeModal`/`modalData`/`closeModal` de ModalContext et les
// retransmet à 4 modales enfants sous les noms de props qu'elles
// attendaient déjà avant la migration vers ModalContext (`isOpen`,
// `pendingNavigation`, `pendingUnsavePlaylist`...). Les 4 modales sont
// mockées par des stubs légers qui affichent leurs props reçues — la
// logique interne de chaque modale est hors périmètre de CE test (AuthModal
// est d'ailleurs prévue pour son propre test au Palier 4).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUseModalContext = vi.fn();
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => mockUseModalContext(),
}));

vi.mock('../../src/components/modals/AuthModal.jsx', () => ({
  default: ({ isAuthModalOpen, onClose, signUp, signIn, resetPassword, checkUsernameAvailable, showToast }) => (
    <div data-testid="auth-modal-mock" data-open={String(isAuthModalOpen)}>
      <button onClick={onClose}>close-auth</button>
      <span data-testid="auth-received-signup">{String(typeof signUp === 'function')}</span>
      <span data-testid="auth-received-signin">{String(typeof signIn === 'function')}</span>
      <span data-testid="auth-received-resetpwd">{String(typeof resetPassword === 'function')}</span>
      <span data-testid="auth-received-checkusername">{String(typeof checkUsernameAvailable === 'function')}</span>
      <span data-testid="auth-received-showtoast">{String(typeof showToast === 'function')}</span>
    </div>
  ),
}));

vi.mock('../../src/components/modals/ImportSharedPlaylistModal.jsx', () => ({
  default: ({ isOpen, preview, onImport, onClose }) => (
    <div data-testid="import-shared-modal-mock" data-open={String(isOpen)} data-preview={JSON.stringify(preview)}>
      <button onClick={onClose}>close-import</button>
      <button onClick={() => onImport('called')}>trigger-import</button>
    </div>
  ),
}));

vi.mock('../../src/components/modals/PendingNavigationModal.jsx', () => ({
  default: ({ pendingNavigation, onClose, resolvePendingNavigation }) => (
    <div data-testid="pending-nav-modal-mock" data-value={JSON.stringify(pendingNavigation)}>
      <button onClick={onClose}>close-pending-nav</button>
      <button onClick={() => resolvePendingNavigation('resolved')}>trigger-resolve-nav</button>
    </div>
  ),
}));

vi.mock('../../src/components/modals/PendingUnsaveModal.jsx', () => ({
  default: ({ pendingUnsavePlaylist, onClose, removeSavedPlaylist }) => (
    <div data-testid="pending-unsave-modal-mock" data-value={JSON.stringify(pendingUnsavePlaylist)}>
      <button onClick={onClose}>close-pending-unsave</button>
      <button onClick={() => removeSavedPlaylist('removed')}>trigger-remove</button>
    </div>
  ),
}));

import ModalContainer from '../../src/components/shared/ModalContainer.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeModalContext(overrides = {}) {
  return {
    activeModal: null,
    modalData: null,
    closeModal: vi.fn(),
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: {},
    signUp: vi.fn(),
    signIn: vi.fn(),
    resetPassword: vi.fn(),
    checkUsernameAvailable: vi.fn(),
    showToast: vi.fn(),
    onImportSharedPlaylist: vi.fn(),
    resolvePendingNavigation: vi.fn(),
    removeSavedPlaylist: vi.fn(),
    ...overrides,
  };
}

describe('ModalContainer', () => {
  it('aucune modale active : toutes reçoivent un état "fermé"/données nulles', () => {
    mockUseModalContext.mockReturnValue(makeModalContext());
    render(<ModalContainer {...baseProps()} />);
    expect(screen.getByTestId('auth-modal-mock')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('import-shared-modal-mock')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('pending-nav-modal-mock')).toHaveAttribute('data-value', 'null');
    expect(screen.getByTestId('pending-unsave-modal-mock')).toHaveAttribute('data-value', 'null');
  });

  it('activeModal="AUTH" : seule AuthModal est ouverte', () => {
    mockUseModalContext.mockReturnValue(makeModalContext({ activeModal: 'AUTH' }));
    render(<ModalContainer {...baseProps()} />);
    expect(screen.getByTestId('auth-modal-mock')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('import-shared-modal-mock')).toHaveAttribute('data-open', 'false');
  });

  it('activeModal="IMPORT_SHARED_PLAYLIST" : ImportSharedPlaylistModal ouverte avec modalData en preview', () => {
    const preview = { name: 'Playlist partagée' };
    mockUseModalContext.mockReturnValue(makeModalContext({ activeModal: 'IMPORT_SHARED_PLAYLIST', modalData: preview }));
    render(<ModalContainer {...baseProps()} />);
    const el = screen.getByTestId('import-shared-modal-mock');
    expect(el).toHaveAttribute('data-open', 'true');
    expect(el).toHaveAttribute('data-preview', JSON.stringify(preview));
  });

  it('activeModal="PENDING_NAVIGATION" : PendingNavigationModal reçoit modalData, sinon null', () => {
    const nav = { targetView: 'settings' };
    mockUseModalContext.mockReturnValue(makeModalContext({ activeModal: 'PENDING_NAVIGATION', modalData: nav }));
    const { rerender } = render(<ModalContainer {...baseProps()} />);
    expect(screen.getByTestId('pending-nav-modal-mock')).toHaveAttribute('data-value', JSON.stringify(nav));

    mockUseModalContext.mockReturnValue(makeModalContext({ activeModal: 'AUTH', modalData: nav }));
    rerender(<ModalContainer {...baseProps()} />);
    expect(screen.getByTestId('pending-nav-modal-mock')).toHaveAttribute('data-value', 'null');
  });

  it('activeModal="PENDING_UNSAVE" : PendingUnsaveModal reçoit modalData, sinon null', () => {
    const pl = { id: 'pl1' };
    mockUseModalContext.mockReturnValue(makeModalContext({ activeModal: 'PENDING_UNSAVE', modalData: pl }));
    const { rerender } = render(<ModalContainer {...baseProps()} />);
    expect(screen.getByTestId('pending-unsave-modal-mock')).toHaveAttribute('data-value', JSON.stringify(pl));

    mockUseModalContext.mockReturnValue(makeModalContext({ activeModal: null, modalData: pl }));
    rerender(<ModalContainer {...baseProps()} />);
    expect(screen.getByTestId('pending-unsave-modal-mock')).toHaveAttribute('data-value', 'null');
  });

  it('les 4 modales appellent bien closeModal (le même, issu du contexte) pour leur onClose', () => {
    const closeModal = vi.fn();
    mockUseModalContext.mockReturnValue(makeModalContext({ closeModal }));
    render(<ModalContainer {...baseProps()} />);

    fireEvent.click(screen.getByText('close-auth'));
    fireEvent.click(screen.getByText('close-import'));
    fireEvent.click(screen.getByText('close-pending-nav'));
    fireEvent.click(screen.getByText('close-pending-unsave'));

    expect(closeModal).toHaveBeenCalledTimes(4);
  });

  it('transmet correctement signUp/signIn/resetPassword/checkUsernameAvailable/showToast à AuthModal', () => {
    mockUseModalContext.mockReturnValue(makeModalContext());
    render(<ModalContainer {...baseProps()} />);
    expect(screen.getByTestId('auth-received-signup')).toHaveTextContent('true');
    expect(screen.getByTestId('auth-received-signin')).toHaveTextContent('true');
    expect(screen.getByTestId('auth-received-resetpwd')).toHaveTextContent('true');
    expect(screen.getByTestId('auth-received-checkusername')).toHaveTextContent('true');
    expect(screen.getByTestId('auth-received-showtoast')).toHaveTextContent('true');
  });

  it('transmet onImportSharedPlaylist / resolvePendingNavigation / removeSavedPlaylist aux bonnes modales', () => {
    const onImportSharedPlaylist = vi.fn();
    const resolvePendingNavigation = vi.fn();
    const removeSavedPlaylist = vi.fn();
    mockUseModalContext.mockReturnValue(makeModalContext());
    render(<ModalContainer {...baseProps({ onImportSharedPlaylist, resolvePendingNavigation, removeSavedPlaylist })} />);

    fireEvent.click(screen.getByText('trigger-import'));
    fireEvent.click(screen.getByText('trigger-resolve-nav'));
    fireEvent.click(screen.getByText('trigger-remove'));

    expect(onImportSharedPlaylist).toHaveBeenCalledWith('called');
    expect(resolvePendingNavigation).toHaveBeenCalledWith('resolved');
    expect(removeSavedPlaylist).toHaveBeenCalledWith('removed');
  });
});
