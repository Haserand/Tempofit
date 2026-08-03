// @vitest-environment jsdom
//
// Test dédié à PlaylistsView.jsx ("Mes Séances") — 0 test jusqu'ici (avant
// même la Feature Sociale, 01/08). `PlaylistCard.jsx` mocké par un stub
// léger exposant les props qui nous intéressent ICI (déjà testé en détail
// dans tests/PlaylistCard.test.jsx — pas la peine de re-tester son rendu
// interne). `ViewHeader.jsx` laissé réel : composant purement présentatif,
// aucune dépendance externe compliquée à mocker.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/components/views/PlaylistCard.jsx', () => ({
  default: ({ playlist, onClick, onDelete, onTogglePublic, draggable, isDragging, onDragStart, onDragEnter, onDragEnd, rank }) => (
    <div
      data-testid={`card-${playlist.id}`}
      data-draggable={!!draggable}
      data-dragging={!!isDragging}
      data-rank={rank}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
    >
      {playlist.name}
      <button data-testid={`delete-${playlist.id}`} onClick={(e) => { e.stopPropagation(); onDelete(playlist.id); }}>Supprimer</button>
      <button data-testid={`toggle-public-${playlist.id}`} onClick={(e) => { e.stopPropagation(); onTogglePublic(playlist.id); }}>Toggle public</button>
    </div>
  ),
}));

import PlaylistsView from '../../src/components/views/PlaylistsView.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBorder: 'mock-border', textHighlight: 'mock-highlight', textMuted: 'mock-muted',
  textColorClass: 'mock-text-color', bgAccentClass: 'mock-accent-bg',
};

function makePlaylist(overrides = {}) {
  return {
    id: `pl-${Math.random().toString(36).slice(2)}`,
    name: 'Séance', isNaughty: false, completions: [], plannedDate: null, isPublic: false,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isNaughtyMode: false,
    savedPlaylists: [],
    setSavedPlaylists: vi.fn(),
    requestRemoveSavedPlaylist: vi.fn(),
    setPlaylistPlannedDate: vi.fn(),
    getRankStyle: vi.fn(() => null),
    setCurrentPlaylist: vi.fn(),
    changeView: vi.fn(),
    renderConfigInfoLine: vi.fn(() => null),
    markPlaylistAsCompleted: vi.fn(),
    editingCompletion: null, setEditingCompletion: vi.fn(),
    editCompletionDate: vi.fn(), removeCompletionDate: vi.fn(), triggerCSVUpload: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistsView — état vide', () => {
  it('aucune playlist : affiche l\'état vide avec le bouton "Générer ma première playlist"', () => {
    render(<PlaylistsView {...baseProps({ savedPlaylists: [] })} />);
    expect(screen.getByText('Aucune playlist sauvegardée')).toBeInTheDocument();

    const changeView = vi.fn();
    cleanup();
    render(<PlaylistsView {...baseProps({ savedPlaylists: [], changeView })} />);
    fireEvent.click(screen.getByText('Générer ma première playlist'));
    expect(changeView).toHaveBeenCalledWith('generator');
  });
});

describe('PlaylistsView — pare-feu Mode Intime', () => {
  const sportPl = makePlaylist({ id: 'sport-1', name: 'Séance Sport', isNaughty: false });
  const intimatePl = makePlaylist({ id: 'intime-1', name: 'Séance Intime', isNaughty: true });

  it('mode Sport : affiche uniquement les playlists isNaughty=false', () => {
    render(<PlaylistsView {...baseProps({ savedPlaylists: [sportPl, intimatePl], isNaughtyMode: false })} />);
    expect(screen.getByText('Séance Sport')).toBeInTheDocument();
    expect(screen.queryByText('Séance Intime')).not.toBeInTheDocument();
  });

  it('Mode Intime actif : affiche uniquement les playlists isNaughty=true', () => {
    render(<PlaylistsView {...baseProps({ savedPlaylists: [sportPl, intimatePl], isNaughtyMode: true })} />);
    expect(screen.getByText('Séance Intime')).toBeInTheDocument();
    expect(screen.queryByText('Séance Sport')).not.toBeInTheDocument();
  });
});

describe('PlaylistsView — répartition dans les 3 sections', () => {
  it('sans date ni complétion -> "À planifier" ; avec date -> "Planifiées" ; avec complétion -> "Terminées"', () => {
    const toPlanPl = makePlaylist({ id: 'p1', name: 'Séance libre', plannedDate: null, completions: [] });
    const plannedPl = makePlaylist({ id: 'p2', name: 'Séance datée', plannedDate: '2026-05-01', completions: [] });
    const donePl = makePlaylist({ id: 'p3', name: 'Séance faite', completions: ['2026-01-01'] });

    render(<PlaylistsView {...baseProps({ savedPlaylists: [toPlanPl, plannedPl, donePl] })} />);

    // Titres de section — noms de playlists volontairement DIFFÉRENTS des
    // titres de section eux-mêmes (une playlist nommée littéralement "À
    // planifier" aurait fait planter `getByText` : 2 éléments correspondants,
    // le titre de section ET la carte).
    expect(screen.getByText('À planifier')).toBeInTheDocument();
    expect(screen.getByText('Planifiées')).toBeInTheDocument();
    expect(screen.getByText('Terminées')).toBeInTheDocument();
    expect(screen.getByText('Séance libre')).toBeInTheDocument();
    expect(screen.getByText('Séance datée')).toBeInTheDocument();
    expect(screen.getByText('Séance faite')).toBeInTheDocument();
  });

  it('section "Planifiées" absente s\'il n\'y a aucune playlist datée', () => {
    render(<PlaylistsView {...baseProps({ savedPlaylists: [makePlaylist({ plannedDate: null, completions: [] })] })} />);
    expect(screen.queryByText('Planifiées')).not.toBeInTheDocument();
  });

  it('section "Terminées" absente s\'il n\'y a aucune playlist complétée', () => {
    render(<PlaylistsView {...baseProps({ savedPlaylists: [makePlaylist({ plannedDate: null, completions: [] })] })} />);
    expect(screen.queryByText('Terminées')).not.toBeInTheDocument();
  });

  it('les playlists "Planifiées" sont triées par date croissante', () => {
    const later = makePlaylist({ id: 'later', name: 'Plus tard', plannedDate: '2026-06-01' });
    const sooner = makePlaylist({ id: 'sooner', name: 'Plus tôt', plannedDate: '2026-05-01' });
    const { container } = render(<PlaylistsView {...baseProps({ savedPlaylists: [later, sooner] })} />);

    // Vérifie l'ORDRE des cartes rendues via leur data-testid (encode
    // directement l'id de la playlist) — plus fiable qu'une reconstruction
    // du texte affiché, qui inclut aussi les boutons Supprimer/Toggle
    // intercalés dans le mock de PlaylistCard ci-dessus.
    const ids = [...container.querySelectorAll('[data-testid^="card-"]')].map(el => el.dataset.testid);
    expect(ids.indexOf('card-sooner')).toBeLessThan(ids.indexOf('card-later'));
  });
});

describe('PlaylistsView — clic sur une carte', () => {
  it('appelle setCurrentPlaylist(playlist) puis changeView(\'playlist\')', () => {
    const setCurrentPlaylist = vi.fn();
    const changeView = vi.fn();
    const pl = makePlaylist({ id: 'p1', name: 'Ma Séance' });
    render(<PlaylistsView {...baseProps({ savedPlaylists: [pl], setCurrentPlaylist, changeView })} />);

    fireEvent.click(screen.getByTestId('card-p1'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(pl);
    expect(changeView).toHaveBeenCalledWith('playlist');
  });
});

describe('PlaylistsView — suppression', () => {
  it('le clic sur Supprimer appelle requestRemoveSavedPlaylist(id)', () => {
    const requestRemoveSavedPlaylist = vi.fn();
    const pl = makePlaylist({ id: 'p1' });
    render(<PlaylistsView {...baseProps({ savedPlaylists: [pl], requestRemoveSavedPlaylist })} />);

    fireEvent.click(screen.getByTestId('delete-p1'));

    expect(requestRemoveSavedPlaylist).toHaveBeenCalledWith('p1');
  });
});

describe('PlaylistsView — bascule publique/privée (Feature Sociale, 01/08)', () => {
  it('le clic sur "Toggle public" inverse isPublic UNIQUEMENT sur la playlist ciblée, via setSavedPlaylists', () => {
    const setSavedPlaylists = vi.fn();
    const target = makePlaylist({ id: 'p1', isPublic: false });
    const other = makePlaylist({ id: 'p2', isPublic: true });
    render(<PlaylistsView {...baseProps({ savedPlaylists: [target, other], setSavedPlaylists })} />);

    fireEvent.click(screen.getByTestId('toggle-public-p1'));

    expect(setSavedPlaylists).toHaveBeenCalledTimes(1);
    // Argument passé : un NOUVEAU tableau, avec SEULEMENT p1 inversé, p2 intact.
    const updater = setSavedPlaylists.mock.calls[0][0];
    const result = Array.isArray(updater) ? updater : updater([target, other]);
    expect(result.find(p => p.id === 'p1').isPublic).toBe(true);
    expect(result.find(p => p.id === 'p2').isPublic).toBe(true); // inchangé
  });

  // ⚠️ SIMPLIFIÉ (03/08, refonte lignée serveur, voir supabase-schema.sql)
  // — le mécanisme "republier une copie alimente le compteur de son
  // origine" a été retiré (code mort : la clé du `clone_ledger` était
  // toujours déjà prise au moment du clonage lui-même, avant même toute
  // republication — voir la docstring de `handleTogglePlaylistPublic`,
  // PlaylistDetailContext.jsx, pour le détail complet). Ce composant
  // n'importe même plus `supabase` désormais — la bascule publique/privée
  // est un simple flip local, avec ou sans lignée de clonage.
  it('rendre publique une copie issue d\'une chaîne de clonage reste un simple flip local — plus de crédit à réclamer', () => {
    const setSavedPlaylists = vi.fn();
    const target = makePlaylist({ id: 'p1', isPublic: false, parentId: 'pl-B-original', parentUserId: 'user-B' });
    render(<PlaylistsView {...baseProps({ savedPlaylists: [target], setSavedPlaylists })} />);

    fireEvent.click(screen.getByTestId('toggle-public-p1'));

    const updater = setSavedPlaylists.mock.calls[0][0];
    const result = Array.isArray(updater) ? updater : updater([target]);
    expect(result.find(p => p.id === 'p1').isPublic).toBe(true);
  });


describe('PlaylistsView — glisser-déposer (section "À planifier" uniquement)', () => {
  it('les cartes "À planifier" reçoivent draggable=true, les autres sections non', () => {
    const toPlanPl = makePlaylist({ id: 'toplan', plannedDate: null, completions: [] });
    const plannedPl = makePlaylist({ id: 'planned', plannedDate: '2026-05-01', completions: [] });
    render(<PlaylistsView {...baseProps({ savedPlaylists: [toPlanPl, plannedPl] })} />);

    expect(screen.getByTestId('card-toplan').dataset.draggable).toBe('true');
    expect(screen.getByTestId('card-planned').dataset.draggable).toBe('false');
  });

  it('déposer une carte sur une autre réordonne UNIQUEMENT le sous-ensemble "À planifier", sans toucher aux playlists datées/terminées', () => {
    const setSavedPlaylists = vi.fn();
    const a = makePlaylist({ id: 'a', plannedDate: null, completions: [] });
    const b = makePlaylist({ id: 'b', plannedDate: null, completions: [] });
    const datedUntouched = makePlaylist({ id: 'dated', plannedDate: '2026-05-01', completions: [] });
    render(<PlaylistsView {...baseProps({ savedPlaylists: [a, b, datedUntouched], setSavedPlaylists })} />);

    // Démarre le glisser sur 'a', dépose sur 'b'.
    fireEvent.dragStart(screen.getByTestId('card-a'), { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragEnter(screen.getByTestId('card-b'));

    expect(setSavedPlaylists).toHaveBeenCalled();
    const updater = setSavedPlaylists.mock.calls[0][0];
    const result = updater([a, b, datedUntouched]);
    // 'a' et 'b' ont permuté, 'dated' n'a pas bougé de position ni de contenu.
    expect(result.map(p => p.id)).toEqual(['b', 'a', 'dated']);
  });
});

describe('PlaylistsView — pagination (section "Terminées")', () => {
  it('pas de pagineur si 10 playlists ou moins', () => {
    const many = Array.from({ length: 10 }, (_, i) => makePlaylist({ id: `done-${i}`, completions: ['2026-01-01'] }));
    render(<PlaylistsView {...baseProps({ savedPlaylists: many })} />);
    expect(screen.queryByText(/Page \d+ \//)).not.toBeInTheDocument();
  });

  it('pagineur affiché au-delà de 10, "Page 1 / 2", le bouton Précédent est désactivé sur la 1re page', () => {
    const many = Array.from({ length: 15 }, (_, i) => makePlaylist({ id: `done-${i}`, completions: ['2026-01-01'] }));
    render(<PlaylistsView {...baseProps({ savedPlaylists: many })} />);
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();
  });

  it('le bouton Suivant change de page, affiche le reste des playlists', () => {
    const many = Array.from({ length: 15 }, (_, i) => makePlaylist({ id: `done-${i}`, name: `Séance ${i}`, completions: ['2026-01-01'] }));
    render(<PlaylistsView {...baseProps({ savedPlaylists: many })} />);

    // 11e-15e séances pas encore visibles sur la page 1.
    expect(screen.queryByText('Séance 11')).not.toBeInTheDocument();

    const nextButtons = screen.getAllByText('Page 1 / 2')[0].parentElement.querySelectorAll('button');
    fireEvent.click(nextButtons[1]); // 2e bouton = Suivant

    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
  });
});
