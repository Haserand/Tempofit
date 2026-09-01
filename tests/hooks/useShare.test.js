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
import { renderHook, act, cleanup } from '@testing-library/react';

const mockOpenModal = vi.fn();
const mockCloseModalIfActive = vi.fn();
let mockModalState = { activeModal: null, modalData: null };
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({
    activeModal: mockModalState.activeModal,
    modalData: mockModalState.modalData,
    openModal: mockOpenModal,
    closeModalIfActive: mockCloseModalIfActive,
  }),
}));

vi.mock('../../src/utils/playlistShareCode.js', () => ({
  encodePlaylistForSharing: vi.fn(() => 'ENCODED123'),
}));

import { useShare } from '../../src/hooks/useShare.js';

beforeEach(() => {
  mockModalState = { activeModal: null, modalData: null };
});

afterEach(() => {
  // BUG CORRIGÉ (01/08) — `renderHook` monte lui aussi un composant React
  // caché sous le capot (même mécanisme que `render`) : sans `cleanup()`
  // explicite ici, ce fichier était le seul du projet à laisser les
  // instances des tests précédents montées entre 2 tests (piège déjà
  // documenté, voir passation) — risque réel bien que faible ici (useShare
  // n'a aucun effet de bord/souscription en cours), gardé pour la cohérence
  // avec tous les autres fichiers de test du projet.
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete navigator.clipboard;
  delete navigator.share;
  delete navigator.canShare;
  delete document.execCommand;
});

// jsdom n'implémente PAS `document.execCommand` du tout (même pas comme
// fonction qui ne fait rien) — `vi.spyOn(document, 'execCommand')` échoue
// donc avec "The property is not defined on the object" (vi.spyOn a
// besoin que la propriété existe déjà). On l'assigne directement à la
// place.
function stubExecCommand(returnValue) {
  const fn = vi.fn(() => returnValue);
  document.execCommand = fn;
  return fn;
}

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
    const playlistShareCode = await import('../../src/utils/playlistShareCode.js');
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
    expect(mockCloseModalIfActive).not.toHaveBeenCalled();
  });

  it('navigator.clipboard disponible et réussit : toast de succès, ferme la modale, PAS de repli execCommand', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const execSpy = stubExecCommand(true);
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);

    await act(async () => { await result.current.copyToClipboard(); });

    expect(writeText).toHaveBeenCalledWith('Regarde ça https://tempofit.example');
    expect(showToast).toHaveBeenCalledWith('Lien copié dans le presse-papier !');
    // BUG CORRIGÉ (19/08, check-up global) — `closeModal()` était appelé
    // SANS argument (fermeture inconditionnelle) après un `await`
    // presse-papier, ce qui pouvait fermer une AUTRE modale ouverte
    // entre-temps. Doit maintenant appeler `closeModalIfActive('SHARE')`
    // (fonction séparée, PAS `closeModal(name)` — voir ModalContext.jsx,
    // "CORRECTIF DÉFINITIF" : la 1ère version avait cassé tout branchement
    // direct `onClick={closeModal}` ailleurs dans le projet).
    expect(mockCloseModalIfActive).toHaveBeenCalledWith('SHARE');
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('navigator.clipboard échoue (ex: permission refusée) : repli sur execCommand, succès → toast de succès', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) } });
    stubExecCommand(true);
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);

    await act(async () => { await result.current.copyToClipboard(); });

    expect(showToast).toHaveBeenCalledWith('Lien copié dans le presse-papier !');
    expect(mockCloseModalIfActive).toHaveBeenCalledWith('SHARE'); // voir le commentaire du test ci-dessus (19/08)
  });

  it('BUG CORRIGÉ (31/07) — execCommand renvoie false (échec silencieux) : toast d\'ERREUR, pas de faux succès', async () => {
    // Pas de navigator.clipboard du tout → passe directement par execCommand.
    stubExecCommand(false);
    const showToast = vi.fn();
    const { result } = renderUseShare(showToast);

    await act(async () => { await result.current.copyToClipboard(); });

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Impossible de copier'), 'error');
    expect(showToast).not.toHaveBeenCalledWith('Lien copié dans le presse-papier !');
  });

  it('le <textarea> temporaire (repli execCommand) est bien retiré du DOM après usage', async () => {
    stubExecCommand(true);
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
    expect(mockCloseModalIfActive).not.toHaveBeenCalled();
  });

  it('navigator.share réussit : appelé avec title/text/url, puis ferme la modale', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { share });
    const { result } = renderUseShare();

    await act(async () => { await result.current.shareNative(); });

    expect(share).toHaveBeenCalledWith({ title: 'Ma Séance', text: 'Regarde ça', url: 'https://tempofit.example' });
    // BUG CORRIGÉ (19/08, check-up global) — voir le commentaire équivalent
    // sur copyToClipboard plus haut : fenêtre d'attente encore plus longue
    // ici (boîte de dialogue système), donc risque plus réel.
    expect(mockCloseModalIfActive).toHaveBeenCalledWith('SHARE');
  });

  it('l\'utilisateur annule (navigator.share rejette) : pas de crash, modale pas fermée', async () => {
    Object.assign(navigator, { share: vi.fn(() => Promise.reject(new Error('cancelled'))) });
    const { result } = renderUseShare();

    await act(async () => { await result.current.shareNative(); });

    expect(mockCloseModalIfActive).not.toHaveBeenCalled();
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

// RETOUR DIRECT (01/09, capture d'écran : "es-tu sûr que les boutons de
// partage vers les réseaux sociaux ouvrent bien les réseaux sociaux ? ça ne
// me semble pas être le cas pour Instagram") — voir la docstring complète
// de `shareToInstagramStories` dans useShare.js pour le contexte et la
// limite honnête (jamais testé sur un vrai iPhone, uniquement ce que
// jsdom/ce bac à sable permettent de vérifier : la LOGIQUE de bascule
// elle-même, pas le vrai comportement d'iOS/Instagram).
describe('useShare — shareToInstagramStories', () => {
  function stubIOSUserAgent() {
    // Objet simple plutôt que `Object.create(Navigator.prototype)` — `userAgent`
    // n'est qu'un getter sur le vrai prototype `Navigator`, `Object.assign`
    // déclenche son setter (inexistant) et lève une erreur. Un objet neuf
    // suffit : chaque test ajoute ensuite lui-même les propriétés dont il a
    // besoin (`clipboard`...) via `Object.assign(navigator, {...})`, APRÈS
    // cet appel.
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' });
  }

  it('hors iOS (userAgent jsdom par défaut) : bascule directement sur le repli, sans toucher au presse-papier', async () => {
    const { result } = renderUseShare();
    const file = new File(['x'], 'bilan.png', { type: 'image/png' });
    const fallback = vi.fn(() => Promise.resolve('shared'));

    await act(async () => { await result.current.shareToInstagramStories(file, 'Titre', 'Texte', fallback); });

    expect(fallback).toHaveBeenCalledWith(file, 'Titre', 'Texte');
  });

  it('iOS mais API presse-papier indisponible : bascule directement sur le repli', async () => {
    stubIOSUserAgent();
    const { result } = renderUseShare();
    const file = new File(['x'], 'bilan.png', { type: 'image/png' });
    const fallback = vi.fn(() => Promise.resolve('shared'));

    await act(async () => { await result.current.shareToInstagramStories(file, 'Titre', 'Texte', fallback); });

    expect(fallback).toHaveBeenCalledWith(file, 'Titre', 'Texte');
  });

  it('iOS + presse-papier dispo mais écriture refusée/échoue : bascule sur le repli', async () => {
    stubIOSUserAgent();
    global.ClipboardItem = vi.fn(function (items) { this.items = items; });
    Object.assign(navigator, { clipboard: { write: vi.fn(() => Promise.reject(new Error('denied'))) } });
    const { result } = renderUseShare();
    const file = new File(['x'], 'bilan.png', { type: 'image/png' });
    const fallback = vi.fn(() => Promise.resolve('shared'));

    await act(async () => { await result.current.shareToInstagramStories(file, 'Titre', 'Texte', fallback); });

    expect(fallback).toHaveBeenCalledWith(file, 'Titre', 'Texte');
    delete global.ClipboardItem;
  });

  it('iOS + écriture presse-papier réussie : écrit le fichier avec son propre type MIME, PAS de repli immédiat', async () => {
    stubIOSUserAgent();
    global.ClipboardItem = vi.fn(function (items) { this.items = items; });
    const writeSpy = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { write: writeSpy } });
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, href: '' };
    const { result } = renderUseShare();
    const file = new File(['x'], 'bilan.png', { type: 'image/png' });
    const fallback = vi.fn(() => Promise.resolve('shared'));

    await act(async () => { await result.current.shareToInstagramStories(file, 'Titre', 'Texte', fallback); });

    expect(global.ClipboardItem).toHaveBeenCalledWith({ 'image/png': file });
    expect(writeSpy).toHaveBeenCalled();
    expect(window.location.href).toBe('instagram-stories://share?source_application=tempofit');
    expect(fallback).not.toHaveBeenCalled();
    window.location = originalLocation;
    delete global.ClipboardItem;
  });

  it('iOS + navigation tentée mais page TOUJOURS visible après le délai (Instagram probablement non installé) : bascule sur le repli', async () => {
    vi.useFakeTimers();
    stubIOSUserAgent();
    global.ClipboardItem = vi.fn(function (items) { this.items = items; });
    Object.assign(navigator, { clipboard: { write: vi.fn(() => Promise.resolve()) } });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, href: '' };
    const { result } = renderUseShare();
    const file = new File(['x'], 'bilan.png', { type: 'image/png' });
    const fallback = vi.fn(() => Promise.resolve('shared'));

    await act(async () => { await result.current.shareToInstagramStories(file, 'Titre', 'Texte', fallback); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    expect(fallback).toHaveBeenCalledWith(file, 'Titre', 'Texte');
    window.location = originalLocation;
    delete global.ClipboardItem;
    vi.useRealTimers();
  });

  it('iOS + page cachée avant le délai (Instagram probablement ouvert avec succès) : le repli n\'est PAS déclenché', async () => {
    vi.useFakeTimers();
    stubIOSUserAgent();
    global.ClipboardItem = vi.fn(function (items) { this.items = items; });
    Object.assign(navigator, { clipboard: { write: vi.fn(() => Promise.resolve()) } });
    let visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilityState });
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, href: '' };
    const { result } = renderUseShare();
    const file = new File(['x'], 'bilan.png', { type: 'image/png' });
    const fallback = vi.fn(() => Promise.resolve('shared'));

    await act(async () => { await result.current.shareToInstagramStories(file, 'Titre', 'Texte', fallback); });
    // Simule le passage au premier plan d'Instagram (page cachée) AVANT le
    // délai de repli, puis déclenche l'event que le vrai navigateur
    // émettrait dans ce cas.
    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    expect(fallback).not.toHaveBeenCalled();
    window.location = originalLocation;
    delete global.ClipboardItem;
    vi.useRealTimers();
  });
});
