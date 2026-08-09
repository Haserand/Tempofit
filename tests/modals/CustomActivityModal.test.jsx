// @vitest-environment jsdom
//
// Palier 3 (29/07, 1/11) — CustomActivityModal, 1er composant du projet
// avec un vrai Context React à mocker (`GeneratorContext`). `theme`,
// `userStats` et `checkTrophies` restent de simples props (comme au
// Palier 2) — seul `useGeneratorContext()` est intercepté via `vi.mock`,
// pour ne pas avoir à monter un vrai `<GeneratorProvider>` (qui exigerait
// lui-même `useAthleticProfile`/`useGeneratorForm` réels, hors périmètre
// d'un test de CE composant précis).
//
// ⚠️ Piège de sélecteur déjà rencontré une fois sur ce lot de tests
// (SavingRoutineModal.test.jsx, 29/07) : ne jamais utiliser une classe
// Tailwind partagée par plusieurs éléments comme sélecteur unique sans
// l'avoir vérifiée au préalable (`grep` dans le composant). Ici, le seul
// <input> du composant est ciblé via son `placeholder`, sans ambiguïté.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUseGeneratorContext = vi.fn();
vi.mock('../../src/contexts/GeneratorContext.jsx', () => ({
  useGeneratorContext: () => mockUseGeneratorContext(),
}));

// `useAthleticContext()` (08/08) — `isNaughtyMode`/`getProfileForWorkout`
// ne viennent plus de `useGeneratorContext()` (voir la docstring de
// AthleticContext.jsx). Mocké séparément, mais alimenté PAR
// `makeContextValue()` elle-même (voir plus bas) — aucun des 10 appels
// existants n'a besoin de changer.
const mockUseAthleticContext = vi.fn();
vi.mock('../../src/contexts/AthleticContext.jsx', () => ({
  useAthleticContext: () => mockUseAthleticContext(),
}));

// Import APRÈS le vi.mock (obligatoire avec l'hoisting de Vitest, mais
// l'ordre dans le fichier source reste celui qu'on écrit ici par lisibilité).
import CustomActivityModal from '../../src/components/modals/CustomActivityModal.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

function makeContextValue(overrides = {}) {
  const merged = {
    isNaughtyMode: false,
    isCustomActivityModalOpen: true,
    setIsCustomActivityModalOpen: vi.fn(),
    tempCustomActivity: '',
    setTempCustomActivity: vi.fn(),
    setCustomActivity: vi.fn(),
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
    applyProfileBpmIfUntouched: vi.fn(),
    ...overrides,
  };
  // Sépare les champs athlétiques (08/08, voir AthleticContext.jsx) —
  // cette fonction continue de prendre TOUS les champs en un seul objet
  // d'overrides (les 10 appels existants n'ont pas besoin de changer),
  // mais alimente maintenant les 2 mocks séparément.
  const { isNaughtyMode, getProfileForWorkout, ...generatorPart } = merged;
  mockUseAthleticContext.mockReturnValue({ isNaughtyMode, getProfileForWorkout });
  return generatorPart;
}

const baseProps = {
  theme: mockTheme,
  userStats: { hasRickroll: false },
  checkTrophies: vi.fn(),
};

describe('CustomActivityModal', () => {
  it('ne rend rien quand isCustomActivityModalOpen=false', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ isCustomActivityModalOpen: false }));
    const { container } = render(<CustomActivityModal {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le champ de saisie avec la valeur de tempCustomActivity quand ouverte', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ tempCustomActivity: 'Yoga' }));
    render(<CustomActivityModal {...baseProps} />);
    expect(screen.getByPlaceholderText('Ex: Yoga...')).toHaveValue('Yoga');
  });

  it('taper dans le champ appelle setTempCustomActivity avec la nouvelle valeur', () => {
    const setTempCustomActivity = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ setTempCustomActivity }));
    render(<CustomActivityModal {...baseProps} />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Yoga...'), { target: { value: 'Pilates' } });

    expect(setTempCustomActivity).toHaveBeenCalledWith('Pilates');
  });

  it('le clic sur le bouton X appelle setIsCustomActivityModalOpen(false)', () => {
    const setIsCustomActivityModalOpen = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ setIsCustomActivityModalOpen }));
    const { container } = render(<CustomActivityModal {...baseProps} />);

    // `.text-gray-400` est unique au bouton X dans ce fichier (vérifié) —
    // pas de nom accessible ni de `title` sur ce bouton, donc pas de
    // `getByRole(..., {name})` fiable ici (voir piège a11y documenté 29/07).
    const closeButton = container.querySelector('.text-gray-400');
    fireEvent.click(closeButton);

    expect(setIsCustomActivityModalOpen).toHaveBeenCalledWith(false);
  });

  it('le clic sur "Annuler" appelle setIsCustomActivityModalOpen(false)', () => {
    const setIsCustomActivityModalOpen = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ setIsCustomActivityModalOpen }));
    render(<CustomActivityModal {...baseProps} />);

    fireEvent.click(screen.getByText('Annuler'));

    expect(setIsCustomActivityModalOpen).toHaveBeenCalledWith(false);
  });

  it('le clic sur le fond (backdrop) appelle setIsCustomActivityModalOpen(false)', () => {
    const setIsCustomActivityModalOpen = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ setIsCustomActivityModalOpen }));
    const { container } = render(<CustomActivityModal {...baseProps} />);

    fireEvent.click(container.firstChild);

    expect(setIsCustomActivityModalOpen).toHaveBeenCalledWith(false);
  });

  it('le clic à l\'intérieur de la carte ne ferme pas la modale (stopPropagation)', () => {
    const setIsCustomActivityModalOpen = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ setIsCustomActivityModalOpen }));
    render(<CustomActivityModal {...baseProps} />);

    fireEvent.click(screen.getByText('Activité personnalisée'));

    expect(setIsCustomActivityModalOpen).not.toHaveBeenCalled();
  });

  it('le clic sur "Valider" appelle setCustomActivity puis ferme la modale', () => {
    const setCustomActivity = vi.fn();
    const setIsCustomActivityModalOpen = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ tempCustomActivity: 'Escalade', setCustomActivity, setIsCustomActivityModalOpen })
    );
    render(<CustomActivityModal {...baseProps} />);

    fireEvent.click(screen.getByText('Valider'));

    expect(setCustomActivity).toHaveBeenCalledWith('Escalade');
    expect(setIsCustomActivityModalOpen).toHaveBeenCalledWith(false);
  });

  it('appuyer sur Entrée dans le champ confirme (même effet que "Valider")', () => {
    const setCustomActivity = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ tempCustomActivity: 'Boxe', setCustomActivity }));
    render(<CustomActivityModal {...baseProps} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Ex: Yoga...'), { key: 'Enter' });

    expect(setCustomActivity).toHaveBeenCalledWith('Boxe');
  });

  it('en mode normal, la confirmation pré-remplit le BPM via applyProfileBpmIfUntouched', () => {
    const applyProfileBpmIfUntouched = vi.fn();
    const getProfileForWorkout = vi.fn(() => ({ isConfigured: true }));
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({
        isNaughtyMode: false,
        tempCustomActivity: 'Natation',
        applyProfileBpmIfUntouched,
        getProfileForWorkout,
      })
    );
    render(<CustomActivityModal {...baseProps} />);

    fireEvent.click(screen.getByText('Valider'));

    expect(getProfileForWorkout).toHaveBeenCalledWith('Autre', 'Natation');
    expect(applyProfileBpmIfUntouched).toHaveBeenCalledWith({ isConfigured: true });
  });

  it('en Mode Intime, la confirmation NE pré-remplit PAS le BPM (pas d\'appel à applyProfileBpmIfUntouched)', () => {
    const applyProfileBpmIfUntouched = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ isNaughtyMode: true, tempCustomActivity: 'Natation', applyProfileBpmIfUntouched })
    );
    render(<CustomActivityModal {...baseProps} />);

    fireEvent.click(screen.getByText('Valider'));

    expect(applyProfileBpmIfUntouched).not.toHaveBeenCalled();
  });

  it('easter egg : taper "Rick Astley" (insensible à la casse) débloque le trophée dédié à la confirmation', () => {
    const checkTrophies = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ tempCustomActivity: 'un peu de RICK ASTLEY' }));
    render(<CustomActivityModal {...baseProps} checkTrophies={checkTrophies} userStats={{ hasRickroll: false, other: 42 }} />);

    fireEvent.click(screen.getByText('Valider'));

    expect(checkTrophies).toHaveBeenCalledWith({ hasRickroll: true, other: 42 });
  });

  it('sans "Rick Astley" dans le texte, checkTrophies n\'est jamais appelé', () => {
    const checkTrophies = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ tempCustomActivity: 'Aviron' }));
    render(<CustomActivityModal {...baseProps} checkTrophies={checkTrophies} />);

    fireEvent.click(screen.getByText('Valider'));

    expect(checkTrophies).not.toHaveBeenCalled();
  });
});
