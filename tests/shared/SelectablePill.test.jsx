// @vitest-environment jsdom
//
// Premier fichier de test pour SelectablePill.jsx — extrait le 22/08,
// suite des extractions BottomBarShell.jsx/ModalShell.jsx/
// ModalCloseButton.jsx (même question directe, même jour). Portée
// volontairement limitée au STYLE — la logique de sélection (garde-fou
// "au moins 1" présent dans EditRoutineModal.jsx, absent de
// FavoritesView.jsx ; sélection unique dans AthleticProfilePanel.jsx)
// reste entièrement dans chaque fichier appelant, pas testée ici.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SelectablePill from '../../src/components/shared/SelectablePill.jsx';

afterEach(cleanup);

const mockTheme = {
  bgAccentClass: 'mock-accent-bg', borderAccentClass: 'mock-accent-border',
  cardBorder: 'mock-border', textMuted: 'mock-muted',
};

describe('SelectablePill', () => {
  it('selected=false : classes non-sélectionné', () => {
    render(<SelectablePill selected={false} theme={mockTheme} onClick={() => {}}>Rock</SelectablePill>);
    const button = screen.getByText('Rock');
    expect(button.className).toContain('mock-border');
    expect(button.className).toContain('mock-muted');
    expect(button.className).not.toContain('mock-accent-bg');
  });

  it('selected=true : classes sélectionné (accent)', () => {
    render(<SelectablePill selected={true} theme={mockTheme} onClick={() => {}}>Rock</SelectablePill>);
    const button = screen.getByText('Rock');
    expect(button.className).toContain('mock-accent-bg');
    expect(button.className).toContain('mock-accent-border');
    expect(button.className).toContain('text-white');
  });

  it('clic appelle onClick', () => {
    const onClick = vi.fn();
    render(<SelectablePill selected={false} theme={mockTheme} onClick={onClick}>Rock</SelectablePill>);
    fireEvent.click(screen.getByText('Rock'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('title transmis tel quel (cas warning de genre, EditRoutineModal.jsx/FavoritesView.jsx)', () => {
    render(<SelectablePill selected={false} theme={mockTheme} onClick={() => {}} title="Génération un peu plus longue">Rock</SelectablePill>);
    expect(screen.getByTitle('Génération un peu plus longue')).toBeInTheDocument();
  });

  it('extraSelectedClassName vide par défaut : n\'affecte pas selected=false', () => {
    render(<SelectablePill selected={false} theme={mockTheme} onClick={() => {}}>Rock</SelectablePill>);
    expect(screen.getByText('Rock').className).not.toContain('pr-7');
  });

  it('extraSelectedClassName appliqué UNIQUEMENT si selected=true (cas AthleticProfilePanel.jsx, coche "configuré")', () => {
    const { rerender } = render(
      <SelectablePill selected={false} theme={mockTheme} extraSelectedClassName="pr-7" onClick={() => {}}>Course à pied</SelectablePill>
    );
    expect(screen.getByText('Course à pied').className).not.toContain('pr-7');

    rerender(<SelectablePill selected={true} theme={mockTheme} extraSelectedClassName="pr-7" onClick={() => {}}>Course à pied</SelectablePill>);
    expect(screen.getByText('Course à pied').className).toContain('pr-7');
  });
});
