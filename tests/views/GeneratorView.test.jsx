// @vitest-environment jsdom
//
// Palier 3 (29/07, 11/11 — partie 1/2 ; mis à jour 08/08). GeneratorView.
// Simple wrapper autour de GeneratorWizard (voir sa propre docstring : "1572
// lignes, séparées en 2 composants" à l'origine). `GeneratorContext` mocké,
// `GeneratorWizard` mocké par un stub léger (son propre test suit dans
// GeneratorWizard.test.jsx).
//
// ⚠️ `isNaughtyMode` vient de `useAthleticContext()` DEPUIS LE 08/08
// (auparavant `useGeneratorContext()` — voir la docstring de
// AthleticContext.jsx pour le raisonnement du découpage) — mocké séparément
// ici en conséquence.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUseGeneratorContext = vi.fn();
vi.mock('../../src/contexts/GeneratorContext.jsx', () => ({
  useGeneratorContext: () => mockUseGeneratorContext(),
}));

const mockUseAthleticContext = vi.fn();
vi.mock('../../src/contexts/AthleticContext.jsx', () => ({
  useAthleticContext: () => mockUseAthleticContext(),
}));

vi.mock('../../src/components/views/GeneratorWizard.jsx', () => ({
  default: ({ isGenerating }) => <div data-testid="generator-wizard-mock" data-generating={String(isGenerating)} />,
}));

import GeneratorView from '../../src/components/views/GeneratorView.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = { textColorClass: 'mock-text-color' };

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    setCurrentPlaylist: vi.fn(),
    setIsBpmSearchMode: vi.fn(),
    setSearchQuery: vi.fn(),
    setWorldSearchResults: vi.fn(),
    setResultsContextLabel: vi.fn(),
    setNoUsableResultsHint: vi.fn(),
    searchTracksByBpm: vi.fn(),
    executeGeneration: vi.fn(),
    isGenerating: false,
    toggleNaughtyMode: vi.fn(),
    changeView: vi.fn(),
    ...overrides,
  };
}

describe('GeneratorView', () => {
  it('mode normal : titre "Sculpte ta séance"', () => {
    mockUseGeneratorContext.mockReturnValue({ displaySubtitleGen: 'Choisis ton activité.' });
    mockUseAthleticContext.mockReturnValue({ isNaughtyMode: false });
    render(<GeneratorView {...baseProps()} />);
    expect(screen.getByText('Sculpte ta séance')).toBeInTheDocument();
    expect(screen.getByText('Choisis ton activité.')).toBeInTheDocument();
  });

  it('Mode Intime : titre "Prépare l\'ambiance..."', () => {
    mockUseGeneratorContext.mockReturnValue({ displaySubtitleGen: 'Sous-titre Intime' });
    mockUseAthleticContext.mockReturnValue({ isNaughtyMode: true });
    render(<GeneratorView {...baseProps()} />);
    expect(screen.getByText("Prépare l'ambiance...")).toBeInTheDocument();
  });

  it('transmet isGenerating à GeneratorWizard', () => {
    mockUseGeneratorContext.mockReturnValue({ displaySubtitleGen: '' });
    mockUseAthleticContext.mockReturnValue({ isNaughtyMode: false });
    render(<GeneratorView {...baseProps({ isGenerating: true })} />);
    expect(screen.getByTestId('generator-wizard-mock')).toHaveAttribute('data-generating', 'true');
  });
});
