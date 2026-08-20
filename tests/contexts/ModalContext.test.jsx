// @vitest-environment jsdom
//
// Premier fichier de test pour ModalContext.jsx — jusqu'ici couvert
// seulement indirectement (via les tests des composants/hooks qui le
// mockent : useShare.test.js, useRoutines.test.js...). Ajouté lors du
// check-up global du 19/08, qui a corrigé un vrai bug : `closeModal()`
// fermait TOUJOURS sans condition, même appelé tardivement après un point
// d'attente asynchrone (`shareNative()`/`copyToClipboard()` dans
// useShare.js) — un appel tardif pouvait fermer une AUTRE modale ouverte
// entre-temps. Un commentaire affirmait à tort qu'une garde existait déjà.
// Ce fichier couvre la garde RÉELLEMENT implémentée depuis : `closeModal`
// accepte un nom de modale optionnel, et ne ferme QUE si c'est bien celle-là
// qui est active.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { ModalProvider, useModalContext } from '../../src/contexts/ModalContext.jsx';

afterEach(() => {
  cleanup();
});

// Sonde minimale — capture la `value` du Contexte à chaque rendu dans un
// tableau, pour à la fois lire son état ET déclencher ses actions
// (openModal/closeModal) depuis les tests.
const captured = [];
function Probe() {
  captured.push(useModalContext());
  return null;
}

describe('ModalContext — comportement de base', () => {
  it('useModalContext() hors Provider renvoie un repli inerte (pas de crash)', () => {
    captured.length = 0;
    render(<Probe />);
    expect(captured[0].activeModal).toBeNull();
    expect(captured[0].modalData).toBeNull();
    expect(typeof captured[0].openModal).toBe('function');
    expect(typeof captured[0].closeModal).toBe('function');
  });

  it('openModal(name, data) pose activeModal ET modalData ensemble', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].openModal('SHARE', { text: 'x' }); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBe('SHARE');
    expect(last.modalData).toEqual({ text: 'x' });
  });

  it('openModal(name) sans 2e argument pose modalData à null', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].openModal('AUTH'); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBe('AUTH');
    expect(last.modalData).toBeNull();
  });
});

describe('ModalContext — closeModal() SANS argument (comportement legacy, toujours valide pour les appelants synchrones)', () => {
  it('ferme la modale active sans condition', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].openModal('SHARE', { text: 'x' }); });
    act(() => { captured[captured.length - 1].closeModal(); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBeNull();
    expect(last.modalData).toBeNull();
  });
});

// RÉGRESSION (19/08, check-up global) — le vrai bug corrigé : un appel
// tardif à closeModal() après un point d'attente asynchrone (ex.
// navigator.share() dans shareNative(), useShare.js) fermait N'IMPORTE
// QUELLE modale active au moment où la promesse se résolvait, pas
// forcément celle qui l'avait demandé.
describe('ModalContext — closeModal(name) SCOPÉ (correctif du 19/08)', () => {
  it('ferme la modale si le nom correspond bien à activeModal', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].openModal('SHARE', { text: 'x' }); });
    act(() => { captured[captured.length - 1].closeModal('SHARE'); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBeNull();
    expect(last.modalData).toBeNull();
  });

  it("NE FAIT RIEN si une AUTRE modale est devenue active entre-temps (le vrai scénario de course)", () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    // La modale SHARE s'ouvre, puis (pendant un `await` quelconque côté
    // appelant) l'utilisateur ouvre AUTH avant que le closeModal('SHARE')
    // tardif n'arrive.
    act(() => { captured[captured.length - 1].openModal('SHARE', { text: 'x' }); });
    act(() => { captured[captured.length - 1].openModal('AUTH'); });
    act(() => { captured[captured.length - 1].closeModal('SHARE'); }); // tardif, ne doit RIEN fermer
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBe('AUTH'); // AUTH reste ouverte
    expect(last.modalData).toBeNull();
  });

  it('ne fait rien non plus si aucune modale du tout n\'est active', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].closeModal('SHARE'); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBeNull();
  });
});

describe('ModalContext — stabilité référentielle de la value (useMemo)', () => {
  it('un re-rendu du Provider sans action ne recrée pas la value', () => {
    captured.length = 0;
    const { rerender } = render(<ModalProvider><Probe /></ModalProvider>);
    rerender(<ModalProvider><Probe /></ModalProvider>);
    expect(captured.length).toBe(2);
    expect(captured[1]).toBe(captured[0]);
  });

  it('openModal recrée bien la value (nouvel état réel)', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    const before = captured[captured.length - 1];
    act(() => { before.openModal('SHARE'); });
    const after = captured[captured.length - 1];
    expect(after).not.toBe(before);
  });
});
