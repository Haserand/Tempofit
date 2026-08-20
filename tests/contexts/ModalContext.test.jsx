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
//
// ⚠️ 1ère VERSION DE CE FICHIER CASSÉE EN PRODUCTION (même jour, rattrapé
// par le build Vercel réel) : le 1er correctif faisait de `closeModal` une
// fonction à un paramètre `name` OPTIONNEL — cassait silencieusement tout
// endroit où `closeModal` est branché DIRECTEMENT comme handler JSX
// (`onClick={closeModal}`), React lui passant l'objet événement comme
// `name`. Ce fichier de test, purement unitaire (jamais monté dans un VRAI
// JSX avec `onClick={...}`), ne pouvait PAS détecter ce genre de piège —
// c'est `PlaylistEditContext.test.jsx` (qui monte un vrai
// `<button onClick={closeEditPlaylistModal}>`) qui l'a attrapé. Voir la
// docstring de ModalContext.jsx ("CORRECTIF DÉFINITIF") pour le design
// retenu : `closeModal()` (zéro paramètre, toujours sûr en JSX direct) et
// `closeModalIfActive(name)` (scopé, jamais branché directement en JSX)
// sont maintenant 2 fonctions bien séparées plutôt qu'un paramètre
// optionnel ambigu. Ce fichier teste maintenant CE piège explicitement
// (dernière section) en plus du comportement des 2 fonctions.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent, screen } from '@testing-library/react';
// BUG CORRIGÉ (build Vercel réel) — oublié dans la 1ère version de ce
// fichier : ce projet n'a pas de `setupFiles` global (voir vite.config.js),
// chaque fichier de test qui utilise un matcher jest-dom (`toHaveTextContent`
// ici) doit l'importer lui-même. Sans cet import, `expect(...).toHaveTextContent`
// échoue avec "Invalid Chai property" — Chai (le moteur d'assertion sous
// `expect`) ne connaît pas ce matcher tant que jest-dom ne l'a pas étendu.
import '@testing-library/jest-dom/vitest';
import { ModalProvider, useModalContext } from '../../src/contexts/ModalContext.jsx';

afterEach(() => {
  cleanup();
});

// Sonde minimale — capture la `value` du Contexte à chaque rendu dans un
// tableau, pour à la fois lire son état ET déclencher ses actions
// (openModal/closeModal/closeModalIfActive) depuis les tests.
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
    expect(typeof captured[0].closeModalIfActive).toBe('function');
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

describe('ModalContext — closeModal() : ZÉRO paramètre, ferme TOUJOURS sans condition', () => {
  it('ferme la modale active', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].openModal('SHARE', { text: 'x' }); });
    act(() => { captured[captured.length - 1].closeModal(); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBeNull();
    expect(last.modalData).toBeNull();
  });

  // RÉGRESSION (19/08, la faille du 1er correctif) — un paramètre non
  // déclaré dans la signature d'une fonction JS est ignoré, peu importe ce
  // que l'appelant lui passe : `closeModal` doit fermer sans condition même
  // si on lui passe explicitement quelque chose (objet événement React,
  // ou n'importe quoi d'autre) — jamais interprété comme un nom de modale.
  it("ferme sans condition même si on lui passe un argument (ex. un objet événement React) — ne doit JAMAIS l'interpréter comme un nom de modale", () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].openModal('SHARE'); });
    const fakeReactSyntheticEvent = { type: 'click', target: {} };
    act(() => { captured[captured.length - 1].closeModal(fakeReactSyntheticEvent); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBeNull();
  });
});

// RÉGRESSION (19/08, check-up global) — le vrai bug corrigé : un appel
// tardif à closeModalIfActive('SHARE') après un point d'attente asynchrone
// (ex. navigator.share() dans shareNative(), useShare.js) fermait
// N'IMPORTE QUELLE modale active au moment où la promesse se résolvait,
// pas forcément celle qui l'avait demandé.
describe('ModalContext — closeModalIfActive(name) SCOPÉ (correctif du 19/08, jamais branché directement en JSX)', () => {
  it('ferme la modale si le nom correspond bien à activeModal', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].openModal('SHARE', { text: 'x' }); });
    act(() => { captured[captured.length - 1].closeModalIfActive('SHARE'); });
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBeNull();
    expect(last.modalData).toBeNull();
  });

  it("NE FAIT RIEN si une AUTRE modale est devenue active entre-temps (le vrai scénario de course)", () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    // La modale SHARE s'ouvre, puis (pendant un `await` quelconque côté
    // appelant) l'utilisateur ouvre AUTH avant que le
    // closeModalIfActive('SHARE') tardif n'arrive.
    act(() => { captured[captured.length - 1].openModal('SHARE', { text: 'x' }); });
    act(() => { captured[captured.length - 1].openModal('AUTH'); });
    act(() => { captured[captured.length - 1].closeModalIfActive('SHARE'); }); // tardif, ne doit RIEN fermer
    const last = captured[captured.length - 1];
    expect(last.activeModal).toBe('AUTH'); // AUTH reste ouverte
    expect(last.modalData).toBeNull();
  });

  it('ne fait rien non plus si aucune modale du tout n\'est active', () => {
    captured.length = 0;
    render(<ModalProvider><Probe /></ModalProvider>);
    act(() => { captured[captured.length - 1].closeModalIfActive('SHARE'); });
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

// RÉGRESSION DIRECTE DU PIÈGE (19/08) — le SEUL type de test qui pouvait
// vraiment attraper ce bug : monter `closeModal` sur un VRAI `onClick` JSX
// et simuler un VRAI clic (`fireEvent`, qui passe un vrai objet événement,
// contrairement à un appel direct `closeModal()` dans un test). Voir la
// docstring en tête de fichier — c'est exactement le test qui a attrapé le
// 1er correctif cassé (dans PlaylistEditContext.test.jsx, pas ici).
describe('ModalContext — branché DIRECTEMENT sur un onClick JSX (reproduction du piège de production)', () => {
  function DirectWiringProbe() {
    const { activeModal, openModal, closeModal } = useModalContext();
    return (
      <div>
        <span data-testid="active-modal-state">{String(activeModal)}</span>
        <button onClick={() => openModal('AUTH')}>open</button>
        {/* Branchement DIRECT, sans wrapper `() => closeModal()` — exactement
            le motif qui a cassé dans PlaylistEditContext.jsx/EditPlaylistModal.jsx/
            ModalContainer.jsx/App.jsx (12 endroits). */}
        <button onClick={closeModal}>close-direct</button>
      </div>
    );
  }

  it('un clic réel sur un bouton onClick={closeModal} (sans wrapper) ferme bien la modale', () => {
    render(<ModalProvider><DirectWiringProbe /></ModalProvider>);

    fireEvent.click(screen.getByText('open'));
    expect(screen.getByTestId('active-modal-state')).toHaveTextContent('AUTH');

    fireEvent.click(screen.getByText('close-direct'));
    expect(screen.getByTestId('active-modal-state')).toHaveTextContent('null');
  });
});
