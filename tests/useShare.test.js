// @vitest-environment jsdom
//
// Test dédié à useShare.js — jusqu'ici le seul hook non-pur du projet sans
// test propre (à la différence des composants, testés systématiquement
// depuis les Paliers 2-4). `ModalContext` mocké comme pour les composants ;
// `playlistShareCode.js` (`encodePlaylistForSharing`) mocké — fonction pure
// déjà couverte par tests/playlistShareCode.test.js.
//
// Couvre en particulier la correction du 31/07 sur `copyToClipboard` :
// avant, cette fonction n'utilisait QUE l'ancienne API `execCommand`,
// jamais `navigator.clipboard`, ET affichait un toast de succès sans
// jamais vérifier si la copie avait réellement fonctionné.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
let mockModalState = { activeModal: null, modalData: null };
vi.mock('../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({
    activeModal: mockModalState.activeModal,
    modalData: mockModalState.modalData,
    openModal: mockOpenModal,
    closeModal: mockCloseModal,
  }),
}));

vi.mock('../src/utils/playlistShareCode.js', () => ({
  encodePlaylistForSharing: vi.fn(() => 'ENCODED123'),
}));

import { useShare } from '../src/hooks/useShare.js';

beforeEach(() => {
  mockModalState = { activeModal: null, modalData: null };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete navigator.clipboard;
  delete navigator.share;
  delete navigator.canShare;
});

function renderUseShare(showToast = vi.fn()) {
  return renderHook(() => useShare(showToast));
}

describe('useShare — état dérivé du ModalContext', () => {
  it('isShareModalOpen/shareData reflètent activeModal==="SHARE"/modalData', () => {
    mockModalState = { activeModal: 'SHARE', modalData: { type: 'playlist', text: 'x', url: 'y' } };
    const { result } = renderUseShare();
    expect(result.current.isShareModalOpen).toBe(true);
    expect(result.current.shareData).toEqual({ type: 'playlist', text: 'x', url: 'y' });
  });

  it('shareData est null si une AUTRE modale est active (même si modalData existe)', () => {
    mockModalState = { activeModal: 'AUTH', modalData: { type: 'playlist', text: 'x', url: 'y' } };
    const { result } = renderUseShare();
    expect(result.current.isShareModalOpen).toBe(false);
    expect(result.current.shareData).toBeNull();
  });
});

describe('useShare — handleShare', () => {
  it('playlist non terminée (aucune complétion) : texte "je viens de générer", URL encodée avec le code', () => {
    const { result } = renderUseShare();
    act(() => {
      result.current.handleShare('playlist', { name: 'Ma Séance', totalDuration: 1800, completions: [] });
    });
    const [, data] = mockOpenModal.mock.calls[0];
    expect(data.text).toContain('viens de générer');
    expect(data.url).toContain('?import=ENCODED123');
  });

  it('playlist déjà réalisée (complétions non vides) : texte "je viens de terminer"', () => {
    const { result } = renderUseShare();
    act(() => {
      result.current.handleShare('playlist', { name: 'Ma Séance', totalDuration: 1800, completions: ['2026-01-01'] });
    });
    const [, data] = mockOpenModal.mock.calls[0];
    expect(data.text).toContain('viens de terminer');
  });

  it('si l\'encodage échoue (retourne une valeur falsy) : repli sur l\'URL simple de la page', async () => {
    const playlistShareCode = await import('../src/utils/playlistShareCode.js');
    playlistShareCode.encodePlaylistForSharing.mockReturnValueOnce(null);
    const { result } = renderUseShare();
    act(() => {
      result.current.handleShare('playlist', { name: 'Ma Séance', totalDuration: 1800, completions: [] });
    });
    const [, data] = mockOpenModal.mock.calls[0];
    expect(data.url).not.toContain('?import=');
  });

  it('trophée : texte et données dédiés, pas d\'encodage playlist', () => {
    const { result } = renderUseShare();
    act(() => {
      result.current.handleShare('trophy', { name: 'Ambassadeur', icon: '🔥' });
    });
    const [modalName, data] = mockOpenModal.mock.calls[0];
    expect(modalName).toBe('SHARE');
    expect(data.type).toBe('trophy');
    expect(data.text).toContain('Ambassadeur');
  });
});

describe('useShare — copyToClipboard', () => {
  beforeEach(() => {
    mockModalState = { activeModal: 'SHARE', modalData: { text: 'Regarde ça', url: 'https://tempofit.example' } };
  });

  it('sans shareData (modale pas vraiment ouverte) : ne fait rien', async () => {
    mockModalState = { activeModal: null, modalData: null };
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);
    await act(async () => { await result.current.copyToClipboard(); });
    expect(showToast).not.toHaveBeenCalled();
    expect(mockCloseModal).not.toHaveBeenCalled();
  });

  it('navigator.clipboard disponible et réussit : toast de succès, ferme la modale, PAS de repli execCommand', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const execSpy = vi.spyOn(document, 'execCommand');
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);

    await act(async () => { await result.current.copyToClipboard(); });

    expect(writeText).toHaveBeenCalledWith('Regarde ça https://tempofit.example');
    expect(showToast).toHaveBeenCalledWith('Lien copié dans le presse-papier !');
    expect(mockCloseModal).toHaveBeenCalled();
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('navigator.clipboard échoue (ex: permission refusée) : repli sur execCommand, succès → toast de succès', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) } });
    vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);

    await act(async () => { await result.current.copyToClipboard(); });

    expect(showToast).toHaveBeenCalledWith('Lien copié dans le presse-papier !');
    expect(mockCloseModal).toHaveBeenCalled();
  });

  it('BUG CORRIGÉ (31/07) — execCommand renvoie false (échec silencieux) : toast d\'ERREUR, pas de faux succès', async () => {
    // Pas de navigator.clipboard du tout → passe directement par execCommand.
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);

    await act(async () => { await result.current.copyToClipboard(); });

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Impossible de copier'), 'error');
    expect(showToast).not.toHaveBeenCalledWith('Lien copié dans le presse-papier !');
  });

  it('le <textarea> temporaire (repli execCommand) est bien retiré du DOM après usage', async () => {
    vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const { result } = renderUseShare();

    await act(async () => { await result.current.copyToClipboard(); });

    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('useShare — partage natif (texte)', () => {
  beforeEach(() => {
    mockModalState = { activeModal: 'SHARE', modalData: { title: 'Ma Séance', text: 'Regarde ça', url: 'https://tempofit.example' } };
  });

  it('sans navigator.share : ne fait rien', async () => {
    const { result } = renderUseShare();
    await act(async () => { await result.current.shareNative(); });
    expect(mockCloseModal).not.toHaveBeenCalled();
  });

  it('navigator.share réussit : appelé avec title/text/url, puis ferme la modale', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { share });
    const { result } = renderUseShare();

    await act(async () => { await result.current.shareNative(); });

    expect(share).toHaveBeenCalledWith({ title: 'Ma Séance', text: 'Regarde ça', url: 'https://tempofit.example' });
    expect(mockCloseModal).toHaveBeenCalled();
  });

  it('l\'utilisateur annule (navigator.share rejette) : pas de crash, modale pas fermée', async () => {
    Object.assign(navigator, { share: vi.fn(() => Promise.reject(new Error('cancelled'))) });
    const { result } = renderUseShare();

    await act(async () => { await result.current.shareNative(); });

    expect(mockCloseModal).not.toHaveBeenCalled();
  });
});

describe('useShare — canaux directs (WhatsApp/Twitter/Facebook/e-mail)', () => {
  beforeEach(() => {
    mockModalState = { activeModal: 'SHARE', modalData: { title: 'Ma Séance', text: 'Regarde ça', url: 'https://tempofit.example' } };
  });

  it('shareToWhatsApp ouvre la bonne URL wa.me', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    const { result } = renderUseShare();
    act(() => { result.current.shareToWhatsApp(); });
    expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/?text=');
    expect(openSpy.mock.calls[0][0]).toContain(encodeURIComponent('Regarde ça'));
  });

  it('shareToTwitter ouvre la bonne URL intent', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    const { result } = renderUseShare();
    act(() => { result.current.shareToTwitter(); });
    expect(openSpy.mock.calls[0][0]).toContain('https://twitter.com/intent/tweet');
  });

  it('shareToFacebook ouvre la bonne URL sharer', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    const { result } = renderUseShare();
    act(() => { result.current.shareToFacebook(); });
    expect(openSpy.mock.calls[0][0]).toContain('https://www.facebook.com/sharer/sharer.php');
  });

  it('aucun canal n\'ouvre quoi que ce soit sans shareData', () => {
    mockModalState = { activeModal: null, modalData: null };
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    const { result } = renderUseShare();
    act(() => {
      result.current.shareToWhatsApp();
      result.current.shareToTwitter();
      result.current.shareToFacebook();
    });
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe('useShare — shareImageFile', () => {
  it('canShare(files) supporté : partage le fichier, retourne "shared"', async () => {
    Object.assign(navigator, {
      canShare: vi.fn(() => true),
      share: vi.fn(() => Promise.resolve()),
    });
    const { result } = renderUseShare();
    const file = new File(['x'], 'bilan.png');

    let outcome;
    await act(async () => { outcome = await result.current.shareImageFile(file, 'Titre', 'Texte'); });

    expect(navigator.share).toHaveBeenCalledWith({ files: [file], title: 'Titre', text: 'Texte' });
    expect(outcome).toBe('shared');
  });

  it('partage annulé par l\'utilisateur : retourne "cancelled", pas d\'erreur levée', async () => {
    Object.assign(navigator, {
      canShare: vi.fn(() => true),
      share: vi.fn(() => Promise.reject(new Error('cancelled'))),
    });
    const { result } = renderUseShare();

    let outcome;
    await act(async () => { outcome = await result.current.shareImageFile(new File(['x'], 'bilan.png'), 'T', 'X'); });

    expect(outcome).toBe('cancelled');
  });

  it('partage de fichier non supporté : télécharge directement, prévient via showToast, retourne "downloaded"', async () => {
    // Pas de navigator.canShare/share → repli téléchargement.
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);

    let outcome;
    await act(async () => { outcome = await result.current.shareImageFile(new File(['x'], 'bilan.png'), 'T', 'X'); });

    expect(clickSpy).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('téléchargée'));
    expect(outcome).toBe('downloaded');
  });
});
