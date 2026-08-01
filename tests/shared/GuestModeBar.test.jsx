// @vitest-environment jsdom
//
// 2e test de composant (29/07, suite du chantier "premier test de
// composant React"). GuestModeBar est un bon candidat suivant : props
// simples (`theme`, `isVisible`, `openModal`), un vrai rendu conditionnel
// (`if (!isVisible) return null`), et un bouton interactif réel — premier
// test de ce projet à simuler un CLIC (via `fireEvent`, déjà fourni par
// `@testing-library/react`, aucune dépendance supplémentaire nécessaire).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GuestModeBar from '../../src/components/shared/GuestModeBar.jsx';

afterEach(() => {
  cleanup();
});

// Mêmes valeurs de mock arbitraires que ViewHeader.test.jsx (voir ce
// fichier pour le raisonnement) — confirme que le composant PASSE bien ces
// classes à travers, sans dépendre de la vraie palette du projet.
const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorderStrong: 'mock-border-strong',
  textMuted: 'mock-muted',
  textColorClass: 'mock-accent',
};

describe('GuestModeBar', () => {
  it('ne rend RIEN quand isVisible=false (retourne null)', () => {
    const { container } = render(
      <GuestModeBar theme={mockTheme} isVisible={false} openModal={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le message et le bouton "Se connecter" quand isVisible=true', () => {
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);
    expect(
      screen.getByText('Données sauvegardées uniquement sur cet appareil.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
  });

  it('appelle openModal(\'AUTH\') exactement 1 fois au clic sur "Se connecter"', () => {
    // `vi.fn()` — première utilisation d'un mock de fonction dans ce
    // projet (aucun des 163 tests existants n'en avait besoin, voir
    // vite.config.js) : permet d'observer un appel SANS déclencher le
    // vrai comportement d'ouverture de modale (hors de portée de ce test,
    // qui ne vérifie que "GuestModeBar appelle-t-il bien la bonne
    // fonction avec le bon argument", pas ce que fait `openModal` ensuite.
    const openModal = vi.fn();
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={openModal} />);

    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith('AUTH');
  });

  it('applique les classes du thème fourni (textMuted sur le message, textColorClass sur le bouton)', () => {
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);
    expect(
      screen.getByText('Données sauvegardées uniquement sur cet appareil.')
    ).toHaveClass('mock-muted');
    expect(screen.getByRole('button', { name: /Se connecter/ })).toHaveClass('mock-accent');
  });
});
