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
import { MAX_DESCRIPTION_LENGTH } from '../../src/appConfig.js';

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

// `targetMode`/`distanceVal`/`hours`/`minutes` ajoutés (04/08, avec la
// validation de cible — voir targetValidation.js) : une VRAIE routine en a
// TOUJOURS (handleSaveRoutine, useRoutineActions.js, les positionne
// systématiquement depuis useGeneratorContext()) — ces fixtures étaient
// jusque-là incomplètes par rapport à la vraie forme de l'objet, ce qui
// n'avait jamais posé de problème tant que rien ne lisait ces champs. Avec
// la validation, les laisser `undefined` ferait échouer isTargetValueValid
// silencieusement (targetMode absent → branche "temps" par défaut → 0+0 →
// invalide) et désactiverait "Générer" pour ces 3 routines par accident —
// pas le comportement réel d'une routine sauvegardée normalement.
const routineA = { id: 'a', name: 'Routine A', manualGenerations: 2, workoutType: 'Course à pied', targetMode: 'distance', distanceVal: 5, distanceUnit: 'km' };
const routineB = { id: 'b', name: 'Routine B', manualGenerations: 5, workoutType: 'Cyclisme', targetMode: 'distance', distanceVal: 20, distanceUnit: 'km' };
const routineC = { id: 'c', name: 'Routine C', manualGenerations: 0, workoutType: 'Yoga', targetMode: 'time', hours: 0, minutes: 45 };

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
    showToast: vi.fn(),
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

  // NOUVEAU (05/08, retour direct : "j'aimerais un message de confirmation
  // d'action quand je mets/retire quelque chose en public [...] à
  // généraliser dans toute l'app") — même raisonnement/formulation que
  // PlaylistDetailContext.jsx/PlaylistsView.jsx (voir leurs docstrings
  // respectives). `getDisplayRoutineName` mocké en `(r) => r.name` dans
  // `baseProps` (voir plus haut) — le message attendu utilise donc bien
  // `routineB.name`.
  it('affiche un toast de confirmation au clic sur "Rendre publique"/"Rendre privée"', () => {
    const showToast = vi.fn();
    const setRoutines = vi.fn();
    render(<RoutinesView {...baseProps({ showToast, setRoutines })} />);

    fireEvent.click(screen.getAllByTitle('Rendre cette routine visible sur ton profil public')[0]);
    expect(showToast).toHaveBeenCalledWith(`🌐 "${routineB.name}" est maintenant visible sur ton profil public.`);
  });

  // ⚠️ SIMPLIFIÉ (03/08, refonte lignée serveur, voir supabase-schema.sql)
  // — le mécanisme "republier une copie alimente le compteur de l'origine"
  // a été retiré (code mort : la clé du `clone_ledger` était toujours déjà
  // prise au moment du clonage lui-même — voir la docstring de
  // `handleTogglePlaylistPublic`, PlaylistDetailContext.jsx, pour le
  // détail complet). Ce composant n'importe même plus `supabase` — la
  // bascule est un simple flip local, avec ou sans lignée de clonage.
  it('rendre publique une copie issue d\'une chaîne de clonage reste un simple flip local — plus de crédit à réclamer', () => {
    const setRoutines = vi.fn();
    const clonedRoutine = { id: 'r1', name: 'Copie clonée', manualGenerations: 0, workoutType: 'Course à pied', isPublic: false, parentId: 'routine-A', parentUserId: 'user-A' };
    render(<RoutinesView {...baseProps({ routines: [clonedRoutine], setRoutines })} />);

    fireEvent.click(screen.getByTitle('Rendre cette routine visible sur ton profil public'));

    expect(setRoutines).toHaveBeenCalledWith([{ ...clonedRoutine, isPublic: true }]);
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

  // 04/08, 2e retour direct (capture d'écran) : "je viens de réussir à
  // générer une routine à 0km" — une routine SAUVEGARDÉE avec une cible
  // invalide (créée avant le 1er correctif de ce chantier, ou par tout
  // autre moyen) se générait encore sans blocage : ce bouton consomme
  // directement les valeurs stockées, sans jamais repasser par les
  // formulaires déjà validés (wizard, EditRoutineModal). Voir
  // targetValidation.js ("ÉLARGI") pour le raisonnement complet.
  it('BUG CORRIGÉ : le bouton "Générer" est désactivé pour une routine sauvegardée avec distanceVal=0', () => {
    const executeGeneration = vi.fn();
    const badRoutine = { ...routineA, distanceVal: 0 };
    render(<RoutinesView {...baseProps({ routines: [badRoutine], executeGeneration })} />);

    fireEvent.click(screen.getByText('Générer'));

    expect(executeGeneration).not.toHaveBeenCalled();
    expect(screen.getByText('Générer').closest('button')).toBeDisabled();
  });

  it('affiche un avertissement visible sur la carte d\'une routine à cible invalide', () => {
    const badRoutine = { ...routineA, distanceVal: 0 };
    render(<RoutinesView {...baseProps({ routines: [badRoutine] })} />);
    expect(screen.getByText(/Distance invalide/)).toBeInTheDocument();
  });

  // 04/08, 3e retour direct sur ce même chantier : "ce comportement minimal
  // est-il celui généralisé dans toute l'app ? il le faudrait" — le mode
  // Fractionné n'est PLUS exclu (contrairement à la 1re passe) : ses
  // segments sont désormais validés eux aussi (isSegmentValid/
  // areSegmentsValid, targetValidation.js).
  it('BUG CORRIGÉ (généralisation) : une routine Fractionné avec un segment à bpm=0 est bloquée', () => {
    const executeGeneration = vi.fn();
    const intervalRoutine = {
      ...routineA, isIntervalMode: true, targetMode: 'distance',
      segments: [{ id: 's1', bpm: 0, durationValue: 5 }],
    };
    render(<RoutinesView {...baseProps({ routines: [intervalRoutine], executeGeneration })} />);

    fireEvent.click(screen.getByText('Générer'));

    expect(executeGeneration).not.toHaveBeenCalled();
    expect(screen.getByText(/Portion\(s\) invalide\(s\)/)).toBeInTheDocument();
  });

  it('le message d\'une routine Fractionné invalide ne renvoie PAS vers l\'icône crayon (EditRoutineModal.jsx n\'édite pas les segments)', () => {
    const intervalRoutine = {
      ...routineA, isIntervalMode: true, targetMode: 'distance',
      segments: [{ id: 's1', bpm: 150, durationValue: 0 }],
    };
    render(<RoutinesView {...baseProps({ routines: [intervalRoutine] })} />);
    expect(screen.getByText(/Nouvelle séance/)).toBeInTheDocument();
  });

  it('une routine Fractionné dont TOUS les segments sont valides génère normalement', () => {
    const executeGeneration = vi.fn();
    const intervalRoutine = {
      ...routineA, isIntervalMode: true, targetMode: 'time',
      segments: [{ id: 's1', bpm: 150, durationValue: 5 }, { id: 's2', bpm: 160, durationValue: 3 }],
    };
    render(<RoutinesView {...baseProps({ routines: [intervalRoutine], executeGeneration })} />);

    fireEvent.click(screen.getByText('Générer'));

    expect(executeGeneration).toHaveBeenCalled();
    expect(screen.queryByText(/Portion\(s\) invalide\(s\)/)).toBeNull();
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

  // 04/08 — 280 → 150 (voir MAX_DESCRIPTION_LENGTH, appConfig.js, pour le
  // raisonnement). Import de la VRAIE constante (pas de mock d'appConfig
  // dans ce fichier) plutôt qu'un nombre en dur, pour ne plus jamais avoir
  // à revenir ici si cette valeur change encore.
  it('tronque à MAX_DESCRIPTION_LENGTH caractères même si le texte saisi dépasse (défense en profondeur)', () => {
    const setRoutines = vi.fn();
    render(<RoutinesView {...baseProps({ routines: [routineC], setRoutines })} />);

    fireEvent.click(screen.getByText('Ajouter une description'));
    fireEvent.change(screen.getByPlaceholderText(/Ajoute une description/), { target: { value: 'y'.repeat(500) } });
    fireEvent.click(screen.getByTitle('Enregistrer'));

    expect(setRoutines.mock.calls[0][0][0].description.length).toBe(MAX_DESCRIPTION_LENGTH);
  });

  // "Clone" vs "Enfant" (02/08) — MÊME règle que côté playlists
  // (PlaylistDetailContext.jsx, voir sa docstring pour le raisonnement
  // complet), transposée aux routines.
  it('éditer la description d\'une routine CLONÉE (parentUserId présent) pose isModifiedSinceClone à true', () => {
    const setRoutines = vi.fn();
    const clonedRoutine = { ...routineC, parentId: 'routine-A', parentUserId: 'user-A', isModifiedSinceClone: false };
    render(<RoutinesView {...baseProps({ routines: [clonedRoutine], setRoutines })} />);

    fireEvent.click(screen.getByText('Ajouter une description'));
    fireEvent.change(screen.getByPlaceholderText(/Ajoute une description/), { target: { value: 'Ma propre touche' } });
    fireEvent.click(screen.getByTitle('Enregistrer'));

    expect(setRoutines).toHaveBeenCalledWith([
      expect.objectContaining({ isModifiedSinceClone: true }),
    ]);
  });
});
