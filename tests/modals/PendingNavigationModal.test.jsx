// @vitest-environment jsdom
//
// Créé le 01/08, suite à un incident réel : PendingNavigationModal.jsx avait
// été silencieusement écrasé par une copie quasi identique d'EditRoutineModal.jsx
// (même fonction exportée, mêmes props) — jamais détecté car ce composant
// n'avait, jusqu'ici, AUCUN test dédié (contrairement à PendingUnsaveModal.jsx,
// son proche cousin). Conséquence réelle : impossible de quitter une playlist
// non sauvegardée autrement qu'en cliquant "← Retour" (qui, par coïncidence,
// mène à la même vue que celle vers laquelle ce cas de test particulier aurait
// navigué) — tout autre lien de menu restait silencieusement bloqué, la
// modale de confirmation censée s'afficher ne rendant jamais rien.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PendingNavigationModal from '../src/components/modals/PendingNavigationModal.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

describe('PendingNavigationModal', () => {
  it('ne rend rien quand pendingNavigation est null', () => {
    const { container } = render(
      <PendingNavigationModal
        theme={mockTheme}
        pendingNavigation={null}
        onClose={() => {}}
        resolvePendingNavigation={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche la modale de confirmation quand pendingNavigation est une vue en attente', () => {
    render(
      <PendingNavigationModal
        theme={mockTheme}
        pendingNavigation="discover"
        onClose={() => {}}
        resolvePendingNavigation={() => {}}
      />
    );
    expect(screen.getByText('Playlist non sauvegardée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sauvegarder et continuer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer sans sauvegarder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  it('le clic sur "Sauvegarder et continuer" appelle resolvePendingNavigation(true)', () => {
    const resolvePendingNavigation = vi.fn();
    render(
      <PendingNavigationModal
        theme={mockTheme}
        pendingNavigation="discover"
        onClose={() => {}}
        resolvePendingNavigation={resolvePendingNavigation}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder et continuer' }));

    expect(resolvePendingNavigation).toHaveBeenCalledWith(true);
    expect(resolvePendingNavigation).toHaveBeenCalledTimes(1);
  });

  it('le clic sur "Continuer sans sauvegarder" appelle resolvePendingNavigation(false)', () => {
    const resolvePendingNavigation = vi.fn();
    render(
      <PendingNavigationModal
        theme={mockTheme}
        pendingNavigation="stats"
        onClose={() => {}}
        resolvePendingNavigation={resolvePendingNavigation}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuer sans sauvegarder' }));

    expect(resolvePendingNavigation).toHaveBeenCalledWith(false);
    expect(resolvePendingNavigation).toHaveBeenCalledTimes(1);
  });

  it('le clic sur "Annuler" appelle onClose SANS jamais appeler resolvePendingNavigation', () => {
    const onClose = vi.fn();
    const resolvePendingNavigation = vi.fn();
    render(
      <PendingNavigationModal
        theme={mockTheme}
        pendingNavigation="generator"
        onClose={onClose}
        resolvePendingNavigation={resolvePendingNavigation}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(resolvePendingNavigation).not.toHaveBeenCalled();
  });

  it('le clic sur le fond (backdrop) ferme la modale, mais PAS le clic à l\'intérieur de la carte (stopPropagation)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <PendingNavigationModal
        theme={mockTheme}
        pendingNavigation="discover"
        onClose={onClose}
        resolvePendingNavigation={() => {}}
      />
    );

    // Clic à l'intérieur de la carte (le titre, par exemple) — ne doit PAS fermer.
    fireEvent.click(screen.getByText('Playlist non sauvegardée'));
    expect(onClose).not.toHaveBeenCalled();

    // Clic sur le fond lui-même (le conteneur racine) — doit fermer.
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
