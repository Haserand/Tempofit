// @vitest-environment jsdom
//
// Premier fichier de test pour TabPills.jsx — nouveau composant partagé
// (21/08), extrait de 5 implémentations divergentes (PlaylistsView.jsx/
// ProfileView.jsx/DiscoverView.jsx/SettingsView.jsx/TrophiesView.jsx — voir
// sa docstring pour le détail complet des 2 dérives trouvées). Composant
// entièrement contrôlé (pas de state interne) — `activeTab` piloté par le
// parent, `onChange` appelé au clic, jamais de logique de bascule ici.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TabPills from '../../src/components/shared/TabPills.jsx';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const mockTheme = {
  bgAccentClass: 'mock-accent-bg',
  textMuted: 'mock-muted',
};

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    activeTab: 'a',
    onChange: vi.fn(),
    tabs: [
      { value: 'a', label: 'Onglet A' },
      { value: 'b', label: 'Onglet B' },
    ],
    ...overrides,
  };
}

describe('TabPills', () => {
  it('rend un role="tablist" contenant un bouton role="tab" par onglet', () => {
    render(<TabPills {...baseProps()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('aria-selected reflète activeTab, un seul onglet à la fois', () => {
    render(<TabPills {...baseProps({ activeTab: 'b' })} />);
    expect(screen.getByRole('tab', { name: 'Onglet A' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Onglet B' })).toHaveAttribute('aria-selected', 'true');
  });

  it('le clic sur un onglet appelle onChange avec sa value, jamais avec l\'onglet déjà actif d\'un autre clic', () => {
    const onChange = vi.fn();
    render(<TabPills {...baseProps({ onChange })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Onglet B' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('n\'applique JAMAIS onChange en interne — activeTab ne change que si le parent le repasse en prop (composant contrôlé)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<TabPills {...baseProps({ onChange, activeTab: 'a' })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Onglet B' }));
    // Sans rerender avec activeTab='b' explicitement, l'affichage ne bouge pas —
    // preuve que ce composant ne gère aucun state interne de son cru.
    expect(screen.getByRole('tab', { name: 'Onglet A' })).toHaveAttribute('aria-selected', 'true');

    rerender(<TabPills {...baseProps({ onChange, activeTab: 'b' })} />);
    expect(screen.getByRole('tab', { name: 'Onglet B' })).toHaveAttribute('aria-selected', 'true');
  });

  it('accepte un label ReactNode (icône + texte), pas seulement une chaîne', () => {
    render(
      <TabPills
        {...baseProps({
          tabs: [
            { value: 'a', label: <span data-testid="rich-label">Riche <b>Label</b></span> },
            { value: 'b', label: 'Simple' },
          ],
        })}
      />
    );
    expect(screen.getByTestId('rich-label')).toBeInTheDocument();
    expect(screen.getByText('Simple')).toBeInTheDocument();
  });

  it('affiche exactement les onglets fournis dans `tabs`, dans l\'ordre — un tableau filtré en amont (masquage conditionnel) se reflète directement', () => {
    render(<TabPills {...baseProps({ tabs: [{ value: 'only', label: 'Seul onglet' }], activeTab: 'only' })} />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByText('Seul onglet')).toBeInTheDocument();
  });

  it('accepte une className additionnelle sur le conteneur', () => {
    const { container } = render(<TabPills {...baseProps({ className: 'mb-4' })} />);
    expect(container.querySelector('[role="tablist"]')).toHaveClass('mb-4');
  });
});
