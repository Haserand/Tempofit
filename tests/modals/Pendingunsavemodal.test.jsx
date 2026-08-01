// @vitest-environment jsdom
//
// Palier 2 (29/07, "chantier tests de composants", 1/10) — PendingUnsaveModal,
// modale de confirmation avant de retirer une playlist ayant de l'historique.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PendingUnsaveModal from '../src/components/modals/PendingUnsaveModal.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
};

describe('PendingUnsaveModal', () => {
  it('ne rend rien quand pendingUnsavePlaylist est null', () => {
    const { container } = render(
      <PendingUnsaveModal
        theme={mockTheme}
        pendingUnsavePlaylist={null}
        onClose={() => {}}
        removeSavedPlaylist={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le nombre de complétions quand la playlist en a', () => {
    render(
      <PendingUnsaveModal
        theme={mockTheme}
        pendingUnsavePlaylist={{ id: 'p1', completions: [{}, {}, {}] }}
        onClose={() => {}}
        removeSavedPlaylist={() => {}}
      />
    );
    expect(screen.getByText(/déjà été faite 3x/)).toBeInTheDocument();
  });

  it('affiche le message "données réelles importées" quand il n\'y a pas de complétions', () => {
    render(
      <PendingUnsaveModal
        theme={mockTheme}
        pendingUnsavePlaylist={{ id: 'p1', completions: [] }}
        onClose={() => {}}
        removeSavedPlaylist={() => {}}
      />
    );
    expect(screen.getByText(/données réelles importées/)).toBeInTheDocument();
  });

  it('le clic sur "Retirer quand même" appelle removeSavedPlaylist(id) PUIS onClose', () => {
    const removeSavedPlaylist = vi.fn();
    const onClose = vi.fn();
    render(
      <PendingUnsaveModal
        theme={mockTheme}
        pendingUnsavePlaylist={{ id: 'playlist-42', completions: [] }}
        onClose={onClose}
        removeSavedPlaylist={removeSavedPlaylist}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retirer quand même' }));

    expect(removeSavedPlaylist).toHaveBeenCalledWith('playlist-42');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le clic sur "Annuler" appelle onClose SANS jamais appeler removeSavedPlaylist', () => {
    const removeSavedPlaylist = vi.fn();
    const onClose = vi.fn();
    render(
      <PendingUnsaveModal
        theme={mockTheme}
        pendingUnsavePlaylist={{ id: 'playlist-42', completions: [] }}
        onClose={onClose}
        removeSavedPlaylist={removeSavedPlaylist}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(removeSavedPlaylist).not.toHaveBeenCalled();
  });

  it('le clic sur le fond (backdrop) ferme la modale, mais PAS le clic à l\'intérieur de la carte (stopPropagation)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <PendingUnsaveModal
        theme={mockTheme}
        pendingUnsavePlaylist={{ id: 'p1', completions: [] }}
        onClose={onClose}
        removeSavedPlaylist={() => {}}
      />
    );

    // Clic à l'intérieur de la carte (le titre, par exemple) — ne doit PAS fermer.
    fireEvent.click(screen.getByText('Retirer cette playlist ?'));
    expect(onClose).not.toHaveBeenCalled();

    // Clic sur le fond lui-même (le conteneur racine) — doit fermer.
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
