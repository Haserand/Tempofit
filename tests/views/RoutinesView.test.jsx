// @vitest-environment jsdom
//
// Palier 3 (29/07, 2/11) — RoutinesView. Seul `ModalContext` (via
// `useModalContext()`, pour `openModal`) est un vrai Context React à
// mocker ici — tout le reste (routines, setters, callbacks de rendu comme
// `getDisplayRoutineIcon`/`renderConfigInfoLine`/`getRankStyle`) sont des
// props classiques, comme au Palier 2.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockOpenModal = vi.fn();
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ openModal: mockOpenModal, activeModal: null, modalData: null, closeModal: vi.fn() }),
}));

import RoutinesView from '../../src/components/views/RoutinesView.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-text-color',
  bgAccentClass: 'mock-accent-bg',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
};

const routineA = { id: 'a', name: 'Routine A', manualGenerations: 2, workoutType: 'Course à pied' };
const routineB = { id: 'b', name: 'Routine B', manualGenerations: 5, workoutType: 'Cyclisme' };
const routineC = { id: 'c', name: 'Routine C', manualGenerations: 0, workoutType: 'Yoga' };

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isNaughtyMode: false,
    routines: [routineA, routineB, routineC],
    setRoutines: vi.fn(),
    routineBatchCounts: {},
    setRoutineBatchCounts: vi.fn(),
    getDisplayRoutineIcon: vi.fn(() => '🏃'),
    getDisplayRoutineName: vi.fn((r) => r.name),
    renderConfigInfoLine: vi.fn(() => <div>Config info</div>),
    getRankStyle: vi.fn(() => null),
    setEditingRoutine: vi.fn(),
    executeGeneration: vi.fn(),
    isGenerating: false,
    changeView: vi.fn(),
    ...overrides,
  };
}

describe('RoutinesView', () => {
  it('affiche l\'état vide et son bouton quand routines=[]', () => {
    render(<RoutinesView {...baseProps({ routines: [] })} />);
    expect(screen.getByText('Aucune routine pour l\'instant')).toBeInTheDocument();
    expect(screen.queryByText('Créer une nouvelle routine')).not.toBeInTheDocument();
  });

  it('le clic sur "Créer ma première playlist" (état vide) appelle changeView("generator")', () => {
    const changeView = vi.fn();
    render(<RoutinesView {...baseProps({ routines: [], changeView })} />);
    fireEvent.click(screen.getByText('Créer ma première playlist'));
    expect(changeView).toHaveBeenCalledWith('generator');
  });

  it('affiche une carte par routine et la tuile "Créer une nouvelle routine" quand routines non vide', () => {
    render(<RoutinesView {...baseProps()} />);
    expect(screen.getByText('Routine A')).toBeInTheDocument();
    expect(screen.getByText('Routine B')).toBeInTheDocument();
    expect(screen.getByText('Routine C')).toBeInTheDocument();
    expect(screen.getByText('Créer une nouvelle routine')).toBeInTheDocument();
  });

  it('le clic sur la tuile "Créer une nouvelle routine" appelle changeView("generator")', () => {
    const changeView = vi.fn();
    render(<RoutinesView {...baseProps({ changeView })} />);
    fireEvent.click(screen.getByText('Créer une nouvelle routine'));
    expect(changeView).toHaveBeenCalledWith('generator');
  });

  it('trie les routines par manualGenerations décroissant (B=5, A=2, C=0)', () => {
    const { container } = render(<RoutinesView {...baseProps()} />);
    const names = Array.from(container.querySelectorAll('h3 span.truncate')).map(el => el.textContent);
    expect(names).toEqual(['Routine B', 'Routine A', 'Routine C']);
  });

  it('le clic sur "Éditer" appelle setEditingRoutine avec une copie de la routine puis openModal("EDIT_ROUTINE")', () => {
    const setEditingRoutine = vi.fn();
    render(<RoutinesView {...baseProps({ setEditingRoutine })} />);

    const editButtons = screen.getAllByTitle('Éditer cette routine');
    fireEvent.click(editButtons[0]); // Routine B (1re après tri)

    expect(setEditingRoutine).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', name: 'Routine B' }));
    expect(mockOpenModal).toHaveBeenCalledWith('EDIT_ROUTINE');
  });

  it('le clic sur "Supprimer" appelle setRoutines avec la liste privée de cette routine', () => {
    const setRoutines = vi.fn();
    render(<RoutinesView {...baseProps({ setRoutines })} />);

    const deleteButtons = screen.getAllByTitle('Supprimer cette routine');
    fireEvent.click(deleteButtons[0]); // Routine B (1re après tri)

    expect(setRoutines).toHaveBeenCalledWith([routineA, routineC]);
  });

  // Vague 2, Chantier 1 — UI publique des routines (02/08). Même
  // convention de test que le bouton Supprimer juste au-dessus : on vérifie
  // l'appel à `setRoutines`, pas un état interne.
  it('le clic sur "Rendre cette routine visible..." bascule isPublic à true sur la bonne routine, sans toucher aux autres', () => {
    const setRoutines = vi.fn();
    render(<RoutinesView {...baseProps({ setRoutines })} />);

    const toggleButtons = screen.getAllByTitle('Rendre cette routine visible sur ton profil public');
    fireEvent.click(toggleButtons[0]); // Routine B (1re après tri)

    expect(setRoutines).toHaveBeenCalledWith([
      routineA,
      { ...routineB, isPublic: true },
      routineC,
    ]);
  });

  it('une routine déjà publique affiche le bouton "clique pour la rendre privée", et le clic la repasse à false', () => {
    const setRoutines = vi.fn();
    const publicRoutineB = { ...routineB, isPublic: true };
    render(<RoutinesView {...baseProps({ setRoutines, routines: [routineA, publicRoutineB, routineC] })} />);

    const toggleButton = screen.getByTitle('Visible sur ton profil public — clique pour la rendre privée');
    fireEvent.click(toggleButton);

    expect(setRoutines).toHaveBeenCalledWith([
      routineA,
      { ...publicRoutineB, isPublic: false },
      routineC,
    ]);
  });

  it('changer le nombre de générations (select) appelle setRoutineBatchCounts en fusionnant avec les compteurs existants', () => {
    const setRoutineBatchCounts = vi.fn();
    render(<RoutinesView {...baseProps({ setRoutineBatchCounts, routineBatchCounts: { a: 3 } })} />);

    const selects = screen.getAllByTitle('Génère plusieurs versions différentes en un clic, pour choisir celle que tu préfères.');
    fireEvent.change(selects[0].querySelector('select'), { target: { value: '5' } });

    // Routine B est la 1re carte après tri (id 'b')
    expect(setRoutineBatchCounts).toHaveBeenCalledWith({ a: 3, b: 5 });
  });

  it('le clic sur "Générer" appelle executeGeneration avec la routine, le batchCount et l\'id', () => {
    const executeGeneration = vi.fn();
    render(<RoutinesView {...baseProps({ executeGeneration, routineBatchCounts: { b: 3 } })} />);

    fireEvent.click(screen.getAllByText('Générer')[0]); // Routine B (1re après tri)

    expect(executeGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b', routineName: 'Routine B', workoutName: 'Cyclisme' }),
      3,
      'b'
    );
  });

  it('les boutons "Générer" sont désactivés quand isGenerating=true', () => {
    render(<RoutinesView {...baseProps({ isGenerating: true })} />);
    const generateButtons = screen.getAllByText('Générer').map(el => el.closest('button'));
    generateButtons.forEach(btn => expect(btn).toBeDisabled());
  });

  it('affiche la date de création quand createdAt est renseigné', () => {
    render(
      <RoutinesView
        {...baseProps({ routines: [{ ...routineA, createdAt: '01/01/2026' }] })}
      />
    );
    expect(screen.getByText('Créée le 01/01/2026')).toBeInTheDocument();
  });
});
