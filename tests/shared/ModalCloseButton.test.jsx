// @vitest-environment jsdom
//
// Premier fichier de test pour ModalCloseButton.jsx — extrait le 22/08,
// même question directe, même jour, qui a déjà produit BottomBarShell.jsx/
// ModalShell.jsx ("tu vois encore des composants à extraire ?"). Ce bouton
// était un littéral STRICTEMENT identique dans 10 des 12 fichiers de
// modales du projet — voir la docstring du composant pour le détail
// complet des 2 exceptions (PendingNavigationModal.jsx/
// PendingUnsaveModal.jsx, pas de croix dans leur en-tête).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ModalCloseButton from '../../src/components/shared/ModalCloseButton.jsx';

afterEach(cleanup);

describe('ModalCloseButton', () => {
  it('rend un bouton avec l\'icône X', () => {
    const { container } = render(<ModalCloseButton onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('clic appelle onClick', () => {
    const onClick = vi.fn();
    render(<ModalCloseButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applique les classes attendues (hover rouge, arrondi centralisé)', () => {
    render(<ModalCloseButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('hover:text-red-500');
    expect(button.className).toContain('hover:bg-surface-hover');
  });
});
