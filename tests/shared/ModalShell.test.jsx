// @vitest-environment jsdom
//
// Premier fichier de test pour ModalShell.jsx — extrait le 22/08, même
// principe que BottomBarShell.jsx (voir sa docstring et la Convention UI
// du README, "Une recette de mise en page recopiée... dérive") : les 12
// fichiers de modales de ce projet recopiaient tous, indépendamment, le
// même littéral exact pour le fond, trouvé en cherchant délibérément ce
// genre de motif après la question directe "est-ce que tu vois d'autres
// composants partagés à extraire ?".

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ModalShell from '../../src/components/shared/ModalShell.jsx';

afterEach(cleanup);

const mockTheme = { cardBg: 'mock-card-bg', cardBorder: 'mock-border' };

describe('ModalShell', () => {
  it('applique le fond fixed inset-0 z-[70] + flou + assombrissement — identiques dans les 12 modales d\'origine', () => {
    const { container } = render(<ModalShell theme={mockTheme}>contenu</ModalShell>);
    const backdrop = container.firstChild;
    expect(backdrop.className).toContain('fixed');
    expect(backdrop.className).toContain('inset-0');
    expect(backdrop.className).toContain('z-[70]');
    expect(backdrop.className).toContain('bg-black/60');
    expect(backdrop.className).toContain('backdrop-blur-xs');
  });

  it('clic sur le fond appelle onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<ModalShell onClose={onClose} theme={mockTheme}>contenu</ModalShell>);
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clic À L\'INTÉRIEUR de la carte NE ferme PAS la modale (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<ModalShell onClose={onClose} theme={mockTheme}><span>Mon contenu</span></ModalShell>);
    fireEvent.click(screen.getByText('Mon contenu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applique le thème fourni (cardBg/cardBorder) sur la carte', () => {
    const { container } = render(<ModalShell theme={mockTheme}>contenu</ModalShell>);
    const card = container.firstChild.firstChild;
    expect(card.className).toContain('mock-card-bg');
    expect(card.className).toContain('mock-border');
  });

  it('maxWidth="max-w-md" par défaut', () => {
    const { container } = render(<ModalShell theme={mockTheme}>contenu</ModalShell>);
    expect(container.firstChild.firstChild.className).toContain('max-w-md');
  });

  it('maxWidth personnalisé (cas EditRoutineModal.jsx/SearchModal.jsx : max-w-lg)', () => {
    const { container } = render(<ModalShell theme={mockTheme} maxWidth="max-w-lg">contenu</ModalShell>);
    const card = container.firstChild.firstChild;
    expect(card.className).toContain('max-w-lg');
    expect(card.className).not.toContain('max-w-md');
  });

  it('cardClassName="p-8" par défaut', () => {
    const { container } = render(<ModalShell theme={mockTheme}>contenu</ModalShell>);
    expect(container.firstChild.firstChild.className).toContain('p-8');
  });

  it('cardClassName personnalisé (cas SearchModal.jsx : padding + flex-col + hauteur max)', () => {
    const { container } = render(<ModalShell theme={mockTheme} cardClassName="p-6 md:p-8 flex flex-col max-h-[80vh]">contenu</ModalShell>);
    const card = container.firstChild.firstChild;
    expect(card.className).toContain('flex-col');
    expect(card.className).toContain('max-h-[80vh]');
  });

  it('rend children à l\'intérieur de la carte', () => {
    render(<ModalShell theme={mockTheme}><span>Contenu unique</span></ModalShell>);
    expect(screen.getByText('Contenu unique')).toBeInTheDocument();
  });
});
