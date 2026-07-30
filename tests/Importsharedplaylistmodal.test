// @vitest-environment jsdom
//
// Palier 2 (29/07, 3/10) — ImportSharedPlaylistModal, ouverture automatique
// sur détection d'un paramètre ?import=... dans l'URL.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ImportSharedPlaylistModal from '../src/components/modals/ImportSharedPlaylistModal.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textColorClass: 'mock-accent-text',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

const mockPreview = {
  coverIcon: '🏃',
  name: 'Cardio Express',
  workoutType: 'Course à pied',
  tracks: [
    { du: 180, bp: 160 },
    { du: 200, bp: 165 },
    { du: 190, bp: null },
  ],
};

describe('ImportSharedPlaylistModal', () => {
  it('ne rend rien quand isOpen=false', () => {
    const { container } = render(
      <ImportSharedPlaylistModal theme={mockTheme} isOpen={false} onClose={() => {}} preview={mockPreview} onImport={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('ne rend rien quand preview est null (même si isOpen=true)', () => {
    const { container } = render(
      <ImportSharedPlaylistModal theme={mockTheme} isOpen={true} onClose={() => {}} preview={null} onImport={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le nom, le type de séance et le nombre de titres de l\'aperçu', () => {
    render(
      <ImportSharedPlaylistModal theme={mockTheme} isOpen={true} onClose={() => {}} preview={mockPreview} onImport={() => {}} />
    );
    expect(screen.getByText('Cardio Express')).toBeInTheDocument();
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
    expect(screen.getByText('3 titres')).toBeInTheDocument();
  });

  it('calcule et affiche le BPM moyen à partir des titres qui en ont un (null ignorés)', () => {
    render(
      <ImportSharedPlaylistModal theme={mockTheme} isOpen={true} onClose={() => {}} preview={mockPreview} onImport={() => {}} />
    );
    // (160+165)/2 = 162.5 -> arrondi à 163 (Math.round)
    expect(screen.getByText('~163 BPM')).toBeInTheDocument();
  });

  it('n\'affiche AUCUN BPM moyen quand aucun titre n\'a de BPM connu', () => {
    const previewSansBpm = { ...mockPreview, tracks: [{ du: 180, bp: null }, { du: 190, bp: null }] };
    render(
      <ImportSharedPlaylistModal theme={mockTheme} isOpen={true} onClose={() => {}} preview={previewSansBpm} onImport={() => {}} />
    );
    expect(screen.queryByText(/BPM/)).toBeNull();
  });

  it('le clic sur "Ajouter à Mes Séances" appelle onImport', () => {
    const onImport = vi.fn();
    render(
      <ImportSharedPlaylistModal theme={mockTheme} isOpen={true} onClose={() => {}} preview={mockPreview} onImport={onImport} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ajouter à Mes Séances/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('le clic sur "Ignorer" appelle onClose', () => {
    const onClose = vi.fn();
    render(
      <ImportSharedPlaylistModal theme={mockTheme} isOpen={true} onClose={onClose} preview={mockPreview} onImport={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ignorer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
