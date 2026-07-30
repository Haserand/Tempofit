// @vitest-environment jsdom
//
// Palier 2 (29/07, 10/10, dernier de ce lot) — TemplateCard, carte d'une
// playlist ensemencée (DiscoverView.jsx) : pochette générée, BPM/durée
// calculés depuis les titres réels (jamais stockés en dur).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TemplateCard from '../src/components/views/TemplateCard.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

const mockTemplate = {
  title: 'Cardio Blast',
  author: 'TempoFit',
  workoutType: 'Course à pied',
  isOfficial: true,
  tracks: [
    { duration: 180, bpm: 150 },
    { duration: 200, bpm: 160 },
  ],
};

describe('TemplateCard', () => {
  it('affiche le titre, l\'auteur, le type de séance et la durée calculée depuis les titres', () => {
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    expect(screen.getByText('Cardio Blast')).toBeInTheDocument();
    // (180+200)/60 = 6.33 -> arrondi à 6 min
    expect(screen.getByText(/Course à pied • 6 min/)).toBeInTheDocument();
  });

  it('affiche le BPM moyen à côté de l\'auteur quand les titres en ont', () => {
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    // (150+160)/2 = 155
    expect(screen.getByText('TempoFit • 155 BPM')).toBeInTheDocument();
  });

  it('n\'affiche AUCUN BPM quand le modèle n\'a aucun titre (tracks vide)', () => {
    const templateSansTracks = { ...mockTemplate, tracks: [] };
    render(<TemplateCard theme={mockTheme} template={templateSansTracks} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    // ⚠️ "TempoFit" apparaît à 2 endroits ici (le badge "officiel" ET le nom
    // d'auteur du mock, qui vaut aussi "TempoFit") — `selector: 'p'` cible
    // spécifiquement la ligne auteur, pas le badge, pour lever l'ambiguïté.
    expect(screen.getByText('TempoFit', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText(/BPM/)).toBeNull();
  });

  it('affiche le badge "TempoFit" UNIQUEMENT quand template.isOfficial est vrai', () => {
    const { rerender } = render(
      <TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />
    );
    expect(screen.getByText('TempoFit', { selector: 'span' })).toBeInTheDocument();

    rerender(
      <TemplateCard
        theme={mockTheme}
        template={{ ...mockTemplate, isOfficial: false }}
        onPlayTemplate={() => {}}
        isNaughtyMode={false}
      />
    );
    expect(screen.queryByText('TempoFit', { selector: 'span' })).toBeNull();
  });

  it('le clic sur la carte appelle onPlayTemplate(template)', () => {
    const onPlayTemplate = vi.fn();
    const { container } = render(
      <TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={onPlayTemplate} isNaughtyMode={false} />
    );
    fireEvent.click(container.firstChild);
    expect(onPlayTemplate).toHaveBeenCalledWith(mockTemplate);
  });

  it('le clic sur le bouton play appelle onPlayTemplate UNE SEULE fois (stopPropagation évite le doublon avec le clic de carte)', () => {
    const onPlayTemplate = vi.fn();
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={onPlayTemplate} isNaughtyMode={false} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(onPlayTemplate).toHaveBeenCalledTimes(1);
    expect(onPlayTemplate).toHaveBeenCalledWith(mockTemplate);
  });
});
