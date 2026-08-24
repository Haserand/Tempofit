// @vitest-environment jsdom
//
// Premier fichier de test pour GenerationProgressBanner.jsx — extrait
// d'App.jsx le 21/08 (découpage App.jsx, cluster "Génération"). Le JSX
// vivait auparavant inline dans App.jsx, lui-même sans test miroir (voir
// README) — c'est donc la toute première fois que la logique des 3 paliers
// de temps du message (14/08) est vérifiée par un test, pas une régression
// de couverture au passage.
//
// ⚠️ Points de suspension retirés de TOUS les messages testés ci-dessous
// (22/08, retour direct — "les 3 petits points à la fin laisse idée que le
// message est coupé" — voir GenerationProgressBanner.jsx pour le détail).
// Comportement/logique des paliers inchangés, seul le texte final change.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GenerationProgressBanner from '../../src/components/shared/GenerationProgressBanner.jsx';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const mockTheme = {
  textColorClass: 'mock-accent',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
};

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isGenerating: true,
    generatingTotal: 0,
    generatingDone: 0,
    isGeneratingSlowGenre: false,
    isGeneratingLongPlaylist: false,
    generatingEstimatedTracksFound: 0,
    elapsedSeconds: 0,
    cancelGeneration: vi.fn(),
    ...overrides,
  };
}

describe('GenerationProgressBanner', () => {
  it('ne rend rien quand isGenerating est faux', () => {
    const { container } = render(<GenerationProgressBanner {...baseProps({ isGenerating: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('message par défaut (palier 0, ni genre lent ni séance longue)', () => {
    render(<GenerationProgressBanner {...baseProps()} />);
    expect(screen.getByText('Génération en cours')).toBeInTheDocument();
  });

  it('signale un genre plus long à cibler (palier 0)', () => {
    render(<GenerationProgressBanner {...baseProps({ isGeneratingSlowGenre: true })} />);
    expect(screen.getByText('Génération en cours (genre plus long à cibler)')).toBeInTheDocument();
  });

  it('signale une séance longue (palier 0)', () => {
    render(<GenerationProgressBanner {...baseProps({ isGeneratingLongPlaylist: true })} />);
    expect(screen.getByText('Génération en cours (séance longue, plusieurs titres à trouver)')).toBeInTheDocument();
  });

  it('signale les deux à la fois (palier 0)', () => {
    render(<GenerationProgressBanner {...baseProps({ isGeneratingSlowGenre: true, isGeneratingLongPlaylist: true })} />);
    expect(screen.getByText('Génération en cours (séance longue + genre plus long à cibler)')).toBeInTheDocument();
  });

  it('generatingTotal > 1 prime sur tout le reste, quel que soit le palier de temps', () => {
    render(<GenerationProgressBanner {...baseProps({ generatingTotal: 3, generatingDone: 1, elapsedSeconds: 50, isGeneratingSlowGenre: true })} />);
    expect(screen.getByText('Génération 1/3')).toBeInTheDocument();
  });

  it('palier 1 (15-45s), aucun titre réuni : message de réassurance générique', () => {
    render(<GenerationProgressBanner {...baseProps({ elapsedSeconds: 20 })} />);
    expect(screen.getByText("Ça prend un peu plus de temps que d'habitude")).toBeInTheDocument();
  });

  it('palier 1, avec des titres déjà réunis : privilégie le compte (singulier)', () => {
    render(<GenerationProgressBanner {...baseProps({ elapsedSeconds: 20, generatingEstimatedTracksFound: 1 })} />);
    expect(screen.getByText('Génération en cours — environ 1 titre réuni')).toBeInTheDocument();
  });

  it('palier 1, plusieurs titres réunis : accord au pluriel', () => {
    render(<GenerationProgressBanner {...baseProps({ elapsedSeconds: 20, generatingEstimatedTracksFound: 5 })} />);
    expect(screen.getByText('Génération en cours — environ 5 titres réunis')).toBeInTheDocument();
  });

  it('palier 2 (45s+), aucun titre réuni : message renforcé', () => {
    render(<GenerationProgressBanner {...baseProps({ elapsedSeconds: 50 })} />);
    expect(screen.getByText('Toujours en cours — certains genres ou gros lots peuvent prendre jusqu\'à une minute ou plus.')).toBeInTheDocument();
  });

  it('affiche le chrono écoulé au format M:SS (secondes complétées à 2 chiffres)', () => {
    render(<GenerationProgressBanner {...baseProps({ elapsedSeconds: 65 })} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('le clic sur le bouton Annuler appelle cancelGeneration', () => {
    const cancelGeneration = vi.fn();
    render(<GenerationProgressBanner {...baseProps({ cancelGeneration })} />);
    fireEvent.click(screen.getByTitle('Annuler la génération'));
    expect(cancelGeneration).toHaveBeenCalledTimes(1);
  });
});
