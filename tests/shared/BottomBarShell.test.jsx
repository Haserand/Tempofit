// @vitest-environment jsdom
//
// Premier fichier de test pour BottomBarShell.jsx — extrait le 22/08
// (MiniPlayerBar.jsx/GuestModeBar.jsx recopiaient jusqu'ici indépendamment
// la même "recette" de conteneur, avec de petites divergences de détail
// qui ont produit 2 bugs de désalignement distincts la même session — voir
// README pour le détail complet).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import BottomBarShell from '../../src/components/shared/BottomBarShell.jsx';

afterEach(cleanup);

const mockTheme = { cardBg: 'mock-card-bg', cardBorderStrong: 'mock-border-strong' };

describe('BottomBarShell', () => {
  it('applique h-[70px] et max-w-5xl mx-auto — les 2 classes que les 2 barres doivent partager', () => {
    const { container } = render(<BottomBarShell theme={mockTheme}>contenu</BottomBarShell>);
    const outer = container.firstChild;
    expect(outer.className).toContain('h-[70px]');
    const inner = outer.firstChild;
    expect(inner.className).toContain('max-w-5xl');
    expect(inner.className).toContain('mx-auto');
  });

  it('applique le thème fourni (cardBg/cardBorderStrong) sur le conteneur externe', () => {
    const { container } = render(<BottomBarShell theme={mockTheme}>contenu</BottomBarShell>);
    expect(container.firstChild.className).toContain('mock-card-bg');
    expect(container.firstChild.className).toContain('mock-border-strong');
  });

  it('rend children à l\'intérieur du conteneur max-w-5xl', () => {
    render(<BottomBarShell theme={mockTheme}><span>Mon contenu</span></BottomBarShell>);
    expect(screen.getByText('Mon contenu')).toBeInTheDocument();
  });

  it('shadow=false par défaut (MiniPlayerBar.jsx passe shadow explicitement, GuestModeBar.jsx ne le fait jamais)', () => {
    const { container } = render(<BottomBarShell theme={mockTheme}>contenu</BottomBarShell>);
    expect(container.firstChild.className).not.toContain('shadow-2xl');
  });

  it('shadow=true ajoute bien shadow-2xl (cas MiniPlayerBar.jsx)', () => {
    const { container } = render(<BottomBarShell theme={mockTheme} shadow>contenu</BottomBarShell>);
    expect(container.firstChild.className).toContain('shadow-2xl');
  });

  it('justify=false par défaut : pas de justify-center sur le conteneur externe (cas MiniPlayerBar.jsx, ses 2 zones flex-1 s\'en chargent déjà)', () => {
    const { container } = render(<BottomBarShell theme={mockTheme}>contenu</BottomBarShell>);
    expect(container.firstChild.className).not.toContain('justify-center');
  });

  it('justify=true ajoute bien justify-center sur le conteneur externe (cas GuestModeBar.jsx)', () => {
    const { container } = render(<BottomBarShell theme={mockTheme} justify>contenu</BottomBarShell>);
    expect(container.firstChild.className).toContain('justify-center');
  });

  it('innerClassName transmis tel quel au conteneur max-w-5xl (personnalisation par appelant : rangée vs colonne, padding)', () => {
    const { container } = render(<BottomBarShell theme={mockTheme} innerClassName="flex-col gap-1 py-2">contenu</BottomBarShell>);
    const inner = container.firstChild.firstChild;
    expect(inner.className).toContain('flex-col');
    expect(inner.className).toContain('gap-1');
    expect(inner.className).toContain('py-2');
  });
});
