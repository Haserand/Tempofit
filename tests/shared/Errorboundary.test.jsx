// @vitest-environment jsdom
//
// Palier 2 (29/07, 5/10) — ErrorBoundary, le SEUL composant classe de tout
// le projet (obligatoire : les error boundaries React ne peuvent pas être
// des fonctions à ce jour). Valeur de sécurité réelle : s'il est cassé,
// n'importe quelle erreur ailleurs dans l'app blanchit tout l'écran au lieu
// d'afficher un message lisible.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ErrorBoundary from '../../src/components/shared/ErrorBoundary.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Petit composant DÉLIBÉRÉMENT instable, seulement pour ce fichier de test —
// lance une vraie erreur pendant le rendu si `shouldThrow` est vrai, pour
// donner à ErrorBoundary quelque chose de réel à attraper.
function Bomb({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Erreur de test délibérée');
  }
  return <div>Tout va bien</div>;
}

describe('ErrorBoundary', () => {
  it('affiche les enfants normalement quand aucune erreur ne survient', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Tout va bien')).toBeInTheDocument();
  });

  it('attrape une erreur de rendu et affiche l\'écran de secours avec le message d\'erreur', () => {
    // React logge lui-même l'erreur attrapée sur console.error (bruit normal
    // et attendu ici, pas un signal d'échec) — supprimé pour un output de
    // test propre, restauré automatiquement par `vi.restoreAllMocks()`
    // dans `afterEach`.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Une erreur a interrompu l'affichage de cette page")).toBeInTheDocument();
    expect(screen.getByText('Erreur de test délibérée')).toBeInTheDocument();
    // Les enfants d'origine (le composant cassé) ne sont plus rendus du tout.
    expect(screen.queryByText('Tout va bien')).toBeNull();
  });

  it('affiche la pile des composants React dans le détail dépliable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Pile des composants React')).toBeInTheDocument();
    // Le nom du composant fautif doit apparaître dans la pile affichée.
    const details = screen.getByText('Pile des composants React').closest('details');
    expect(details).toHaveTextContent('Bomb');
  });

  it('le clic sur "Recharger la page" appelle window.location.reload()', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom n'implémente pas réellement la navigation (`location.reload`
    // lèverait "Not implemented") — `vi.stubGlobal` remplace `location` par
    // une version mockée, restaurée automatiquement après ce test.
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Recharger la page' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
