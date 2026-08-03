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

// Compteur de clonages HONNÊTE (02/08) — `handleToggleRoutinePublic`
// appelle désormais `supabase.rpc(...)` quand on republie une copie issue
// d'une chaîne de clonage. Jamais mocké avant ici (pas besoin jusqu'ici).
const mockRpc = vi.fn();
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { rpc: (...args) => mockRpc(...args) },
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

  // Compteur de clonages HONNÊTE (02/08, retour direct : "si je mets en
  // public ma séance depuis un clone, ça alimente aussi le compteur de
  // clonage de ce dernier") — MÊME logique que côté playlists
  // (PlaylistDetailContext.jsx/PlaylistsView.jsx), transposée aux
  // routines.
  describe('republication d\'un clone alimente le compteur de l\'origine', () => {
    it('rendre publique une copie issue d\'une chaîne de clonage appelle increment_routine_clone_count ciblant l\'ORIGINE', () => {
      mockRpc.mockResolvedValue({ error: null });
      const clonedRoutine = { id: 'c1', name: 'Copie clonée', manualGenerations: 0, workoutType: 'Course à pied', isPublic: false, originId: 'routine-B-original', originUserId: 'user-B' };
      render(<RoutinesView {...baseProps({ routines: [clonedRoutine] })} />);

      fireEvent.click(screen.getByTitle('Rendre cette routine visible sur ton profil public'));

      expect(mockRpc).toHaveBeenCalledWith('increment_routine_clone_count', {
        target_id: 'routine-B-original',
        target_user_id: 'user-B',
      });
    });

    it('rendre PRIVÉE n\'appelle jamais la RPC', () => {
      const clonedRoutine = { id: 'c1', name: 'Copie clonée', manualGenerations: 0, workoutType: 'Course à pied', isPublic: true, originId: 'routine-B-original', originUserId: 'user-B' };
      render(<RoutinesView {...baseProps({ routines: [clonedRoutine] })} />);

      fireEvent.click(screen.getByTitle('Visible sur ton profil public — clique pour la rendre privée'));

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rendre publique une routine sans origine (jamais clonée) n\'appelle aucune RPC', () => {
      const ownRoutine = { id: 'r1', name: 'Ma routine', manualGenerations: 0, workoutType: 'Course à pied', isPublic: false };
      render(<RoutinesView {...baseProps({ routines: [ownRoutine] })} />);

      fireEvent.click(screen.getByTitle('Rendre cette routine visible sur ton profil public'));

      expect(mockRpc).not.toHaveBeenCalled();
    });

    // Anti-abus "toggle spam" (02/08) — MÊME garde que côté playlists,
    // voir leur docstring pour le raisonnement complet.
    it('anti-abus : originCreditClaimed déjà à true → une 2e republication n\'appelle AUCUNE RPC', () => {
      mockRpc.mockResolvedValue({ error: null });
      const alreadyClaimed = { id: 'r1', name: 'Copie clonée', manualGenerations: 0, workoutType: 'Course à pied', isPublic: false, originId: 'routine-A', originUserId: 'user-A', originCreditClaimed: true };
      render(<RoutinesView {...baseProps({ routines: [alreadyClaimed] })} />);

      fireEvent.click(screen.getByTitle('Rendre cette routine visible sur ton profil public'));

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('1re republication pose originCreditClaimed à true sur la routine mise à jour', () => {
      mockRpc.mockResolvedValue({ error: null });
      const setRoutines = vi.fn();
      const clonedRoutine = { id: 'r1', name: 'Copie clonée', manualGenerations: 0, workoutType: 'Course à pied', isPublic: false, originId: 'routine-A', originUserId: 'user-A' };
      render(<RoutinesView {...baseProps({ routines: [clonedRoutine], setRoutines })} />);

      fireEvent.click(screen.getByTitle('Rendre cette routine visible sur ton profil public'));

      expect(setRoutines).toHaveBeenCalledWith([{ ...clonedRoutine, isPublic: true, originCreditClaimed: true }]);
    });
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

// Vague 2, Chantier 3 — "description texte libre sur une playlist/routine
// publique" (02/08). Édition inline directement sur la carte (PAS via
// EditRoutineModal.jsx — voir la docstring de `handleSaveRoutineDescription`
// dans RoutinesView.jsx : cette modale forcerait un déclenchement de
// génération à chaque sauvegarde, une friction absurde pour un simple champ
// texte).
describe('RoutinesView — description libre', () => {
  it('affiche une invite "Ajouter une description" quand la routine n\'en a pas', () => {
    render(<RoutinesView {...baseProps({ routines: [routineC] })} />);
    expect(screen.getByText('Ajouter une description')).toBeInTheDocument();
  });

  it('affiche la description existante, avec un bouton pour la modifier', () => {
    render(<RoutinesView {...baseProps({ routines: [{ ...routineC, description: 'Ma routine du dimanche' }] })} />);
    expect(screen.getByText('Ma routine du dimanche')).toBeInTheDocument();
    expect(screen.getByTitle('Modifier la description')).toBeInTheDocument();
  });

  it('cliquer "Ajouter une description" ouvre un champ, et "Enregistrer" appelle setRoutines avec le texte saisi, SANS jamais appeler executeGeneration', () => {
    const setRoutines = vi.fn();
    const executeGeneration = vi.fn();
    render(<RoutinesView {...baseProps({ routines: [routineC], setRoutines, executeGeneration })} />);

    fireEvent.click(screen.getByText('Ajouter une description'));
    const textarea = screen.getByPlaceholderText(/Ajoute une description/);
    fireEvent.change(textarea, { target: { value: '  Séance de récupération active  ' } });
    fireEvent.click(screen.getByTitle('Enregistrer'));

    expect(setRoutines).toHaveBeenCalledWith([
      { ...routineC, description: 'Séance de récupération active' },
    ]);
    expect(executeGeneration).not.toHaveBeenCalled();
  });

  it('"Annuler" ferme le champ sans appeler setRoutines', () => {
    const setRoutines = vi.fn();
    render(<RoutinesView {...baseProps({ routines: [routineC], setRoutines })} />);

    fireEvent.click(screen.getByText('Ajouter une description'));
    fireEvent.change(screen.getByPlaceholderText(/Ajoute une description/), { target: { value: 'brouillon jeté' } });
    fireEvent.click(screen.getByTitle('Annuler'));

    expect(setRoutines).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/Ajoute une description/)).toBeNull();
    expect(screen.getByText('Ajouter une description')).toBeInTheDocument();
  });

  it('tronque à 280 caractères même si le texte saisi dépasse (défense en profondeur)', () => {
    const setRoutines = vi.fn();
    render(<RoutinesView {...baseProps({ routines: [routineC], setRoutines })} />);

    fireEvent.click(screen.getByText('Ajouter une description'));
    fireEvent.change(screen.getByPlaceholderText(/Ajoute une description/), { target: { value: 'y'.repeat(500) } });
    fireEvent.click(screen.getByTitle('Enregistrer'));

    expect(setRoutines.mock.calls[0][0][0].description.length).toBe(280);
  });

  // "Clone" vs "Enfant" (02/08) — MÊME règle que côté playlists
  // (PlaylistDetailContext.jsx, voir sa docstring pour le raisonnement
  // complet), transposée aux routines.
  it('éditer la description d\'une routine CLONÉE (originUserId présent) pose isModifiedSinceClone à true', () => {
    const setRoutines = vi.fn();
    const clonedRoutine = { ...routineC, originId: 'routine-A', originUserId: 'user-A', isModifiedSinceClone: false };
    render(<RoutinesView {...baseProps({ routines: [clonedRoutine], setRoutines })} />);

    fireEvent.click(screen.getByText('Ajouter une description'));
    fireEvent.change(screen.getByPlaceholderText(/Ajoute une description/), { target: { value: 'Ma propre touche' } });
    fireEvent.click(screen.getByTitle('Enregistrer'));

    expect(setRoutines).toHaveBeenCalledWith([
      expect.objectContaining({ isModifiedSinceClone: true }),
    ]);
  });
});
