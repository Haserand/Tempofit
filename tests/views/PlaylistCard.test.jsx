// @vitest-environment jsdom
//
// Test dédié à PlaylistCard.jsx — 0 test jusqu'ici (avant même la Feature
// Sociale, 01/08). `coverArt.js` mocké (fonction pure déjà couverte par
// ses propres tests, même convention que PlaylistHeader.test.jsx).
// `CompletionsList` mocké par un stub léger : déjà testé dans
// tests/Completionslist.test.jsx — pas la peine de re-tester sa logique
// interne ici.
//
// ⚠️ `appConfig.js` (getActivityEmoji) N'EST PLUS mocké ici (08/08,
// chantier "émoji baké en texte littéral dans le titre") — ce composant
// ne l'importe plus DU TOUT : l'émoji est désormais du texte ORDINAIRE
// dans `playlist.name` (baké une fois à la création, voir musicEngine.js/
// useNavigation.js), plus recalculé à l'affichage.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/utils/coverArt.js', () => ({
  buildCoverUrl: vi.fn((name) => `generated-cover://${name}`),
}));

vi.mock('../../src/components/shared/CompletionsList.jsx', () => ({
  default: () => <div data-testid="completions-list-mock">CompletionsList (mock)</div>,
}));

import PlaylistCard from '../../src/components/views/PlaylistCard.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border',
  textHighlight: 'mock-highlight', textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg', inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
};

function makePlaylist(overrides = {}) {
  return {
    id: 'pl1', name: 'Ma Séance', workoutType: 'Course à pied',
    tracks: [{ genre: 'Rock' }], totalDuration: 1800, config: {},
    completions: [], createdAt: '01/08/2026', coverUrl: null, plannedDate: null,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    playlist: makePlaylist(),
    rankStyle: null, rank: null,
    onClick: vi.fn(), onDelete: vi.fn(),
    renderConfigInfoLine: vi.fn(() => <div data-testid="config-info-line">Config info</div>),
    markPlaylistAsCompleted: vi.fn(),
    editingCompletion: null, setEditingCompletion: vi.fn(),
    editCompletionDate: vi.fn(), removeCompletionDate: vi.fn(), triggerCSVUpload: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistCard — affichage de base', () => {
  it('affiche le nom (avec l\'emoji d\'activité) et la date de création', () => {
    render(<PlaylistCard {...baseProps()} />);
    expect(screen.getByText(/Ma Séance/)).toBeInTheDocument();
    expect(screen.getByText(/01\/08\/2026/)).toBeInTheDocument();
  });

  it('utilise coverUrl si présent, sinon buildCoverUrl(name)', () => {
    const { container, rerender } = render(<PlaylistCard {...baseProps({ playlist: makePlaylist({ coverUrl: 'https://real.jpg' }) })} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('https://real.jpg');

    rerender(<PlaylistCard {...baseProps({ playlist: makePlaylist({ coverUrl: null, name: 'Ma Séance' }) })} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('generated-cover://Ma Séance');
  });

  it('badge "Fractionné"/"Crescendo" affiché uniquement en mode intervalles, selon isCrescendoMode', () => {
    const { rerender } = render(<PlaylistCard {...baseProps({ playlist: makePlaylist({ config: { isIntervalMode: false } }) })} />);
    expect(screen.queryByText('Fractionné')).not.toBeInTheDocument();
    expect(screen.queryByText('Crescendo')).not.toBeInTheDocument();

    rerender(<PlaylistCard {...baseProps({ playlist: makePlaylist({ config: { isIntervalMode: true, isCrescendoMode: false } }) })} />);
    expect(screen.getByText('Fractionné')).toBeInTheDocument();

    rerender(<PlaylistCard {...baseProps({ playlist: makePlaylist({ config: { isIntervalMode: true, isCrescendoMode: true } }) })} />);
    expect(screen.getByText('Crescendo')).toBeInTheDocument();
  });

  it('badge de rang (rankStyle) affiché avec le bon titre selon rank (0/1/2)', () => {
    const rankStyle = { emoji: '🥇', border: 'border-yellow-500' };
    render(<PlaylistCard {...baseProps({ rankStyle, rank: 0, playlist: makePlaylist({ completions: ['2026-01-01'] }) })} />);
    expect(screen.getByTitle(/la plus utilisée/)).toBeInTheDocument();
    expect(screen.getByText('🥇')).toBeInTheDocument();
  });
});

describe('PlaylistCard — clics et propagation', () => {
  it('le clic sur la carte appelle onClick', () => {
    const onClick = vi.fn();
    const { container } = render(<PlaylistCard {...baseProps({ onClick })} />);
    fireEvent.click(container.firstChild);
    expect(onClick).toHaveBeenCalled();
  });

  it('le clic sur "Ouvrir cette playlist" (survol pochette) appelle onClick, sans déclencher le onClick de la carte 2 fois', () => {
    const onClick = vi.fn();
    render(<PlaylistCard {...baseProps({ onClick })} />);
    fireEvent.click(screen.getByTitle('Ouvrir cette playlist'));
    // stopPropagation empêche la carte elle-même de redéclencher onClick —
    // un seul appel, pas deux.
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('le clic sur Supprimer appelle onDelete(id), sans déclencher onClick', () => {
    const onClick = vi.fn();
    const onDelete = vi.fn();
    const { container } = render(<PlaylistCard {...baseProps({ onClick, onDelete, playlist: makePlaylist({ id: 'pl1' }) })} />);

    fireEvent.click(container.querySelector('svg.lucide-trash2').closest('button'));

    expect(onDelete).toHaveBeenCalledWith('pl1');
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('PlaylistCard — bascule publique/privée (Feature Sociale, 01/08)', () => {
  it('absente quand onTogglePublic n\'est pas fourni', () => {
    render(<PlaylistCard {...baseProps({ onTogglePublic: undefined })} />);
    expect(screen.queryByTitle(/profil public/)).not.toBeInTheDocument();
  });

  it('affiche le bon titre selon playlist.isPublic (privée -> "Rendre...", publique -> "Visible sur...")', () => {
    const onTogglePublic = vi.fn();
    const { rerender } = render(<PlaylistCard {...baseProps({ onTogglePublic, playlist: makePlaylist({ isPublic: false }) })} />);
    expect(screen.getByTitle('Rendre cette playlist visible sur ton profil public')).toBeInTheDocument();

    rerender(<PlaylistCard {...baseProps({ onTogglePublic, playlist: makePlaylist({ isPublic: true }) })} />);
    expect(screen.getByTitle('Visible sur ton profil public — clique pour la rendre privée')).toBeInTheDocument();
  });

  it('le clic appelle onTogglePublic(playlist.id) SANS déclencher le onClick de la carte (stopPropagation)', () => {
    const onClick = vi.fn();
    const onTogglePublic = vi.fn();
    render(<PlaylistCard {...baseProps({ onClick, onTogglePublic, playlist: makePlaylist({ id: 'pl-xyz', isPublic: false }) })} />);

    fireEvent.click(screen.getByTitle('Rendre cette playlist visible sur ton profil public'));

    expect(onTogglePublic).toHaveBeenCalledWith('pl-xyz');
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('PlaylistCard — état terminé vs en attente', () => {
  it('playlist non terminée : "Marquer comme faite" visible, badge "Faite Nx" absent', () => {
    render(<PlaylistCard {...baseProps({ playlist: makePlaylist({ completions: [] }) })} />);
    expect(screen.getByText('Marquer comme faite')).toBeInTheDocument();
    expect(screen.queryByText(/Faite/)).not.toBeInTheDocument();
  });

  it('le clic sur "Marquer comme faite" appelle markPlaylistAsCompleted(id), sans date (aujourd\'hui)', () => {
    const markPlaylistAsCompleted = vi.fn();
    render(<PlaylistCard {...baseProps({ markPlaylistAsCompleted, playlist: makePlaylist({ id: 'pl1', completions: [] }) })} />);

    fireEvent.click(screen.getByText('Marquer comme faite'));

    expect(markPlaylistAsCompleted).toHaveBeenCalledWith('pl1');
  });

  it('playlist terminée : badge "Faite Nx" avec le bon nombre, CompletionsList rendue', () => {
    render(<PlaylistCard {...baseProps({ playlist: makePlaylist({ completions: ['2026-01-01', '2026-02-01'] }) })} />);
    expect(screen.getByText('Faite 2x')).toBeInTheDocument();
    expect(screen.getByTestId('completions-list-mock')).toBeInTheDocument();
    expect(screen.queryByText('Marquer comme faite')).not.toBeInTheDocument();
  });

  it('écart planifié vs réalisé : "faite comme prévu" si les dates correspondent', () => {
    render(<PlaylistCard {...baseProps({
      playlist: makePlaylist({ completions: ['2026-03-10T10:00:00.000Z'], plannedDate: '2026-03-10' }),
    })} />);
    expect(screen.getByText(/faite comme prévu/)).toBeInTheDocument();
  });

  it('écart planifié vs réalisé : "faite Nj plus tard" si la complétion est après la date planifiée', () => {
    render(<PlaylistCard {...baseProps({
      playlist: makePlaylist({ completions: ['2026-03-13T10:00:00.000Z'], plannedDate: '2026-03-10' }),
    })} />);
    expect(screen.getByText(/faite 3j plus tard/)).toBeInTheDocument();
  });

  it('badge Garmin affiché seulement si actualDataByDate contient des entrées, avec le bon pluriel', () => {
    const { rerender } = render(<PlaylistCard {...baseProps({
      playlist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: {} }),
    })} />);
    expect(screen.queryByText(/données Garmin importées/)).not.toBeInTheDocument();

    rerender(<PlaylistCard {...baseProps({
      playlist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: { '2026-01-01': {} } }),
    })} />);
    expect(screen.getByText(/1 séance avec données Garmin importées/)).toBeInTheDocument();

    rerender(<PlaylistCard {...baseProps({
      playlist: makePlaylist({ completions: ['2026-01-01', '2026-01-08'], actualDataByDate: { '2026-01-01': {}, '2026-01-08': {} } }),
    })} />);
    expect(screen.getByText(/2 séances avec données Garmin importées/)).toBeInTheDocument();
  });
});

describe('PlaylistCard — planification (onSetPlannedDate)', () => {
  it('badge "Planifier" absent quand onSetPlannedDate n\'est pas fourni', () => {
    render(<PlaylistCard {...baseProps({ onSetPlannedDate: undefined })} />);
    expect(screen.queryByTitle(/Planifier|Date planifiée/)).not.toBeInTheDocument();
  });

  it('changer la date planifiée appelle onSetPlannedDate(id, date)', () => {
    const onSetPlannedDate = vi.fn();
    const { container } = render(<PlaylistCard {...baseProps({
      onSetPlannedDate, playlist: makePlaylist({ id: 'pl1', plannedDate: null }),
    })} />);

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-05-01' } });

    expect(onSetPlannedDate).toHaveBeenCalledWith('pl1', '2026-05-01');
  });
});

describe('PlaylistCard — glisser-déposer', () => {
  it('poignée de glisser-déposer visible uniquement si draggable=true', () => {
    const { rerender } = render(<PlaylistCard {...baseProps({ draggable: false })} />);
    expect(screen.queryByTitle('Glisser pour réordonner')).not.toBeInTheDocument();

    rerender(<PlaylistCard {...baseProps({ draggable: true })} />);
    expect(screen.getByTitle('Glisser pour réordonner')).toBeInTheDocument();
  });

  it('isDragging=true applique une opacité réduite à la carte', () => {
    const { container } = render(<PlaylistCard {...baseProps({ isDragging: true })} />);
    expect(container.firstChild).toHaveClass('opacity-40');
  });
});

// RETIRÉ (07/08, retour direct après essai en conditions réelles, capture
// à l'appui : "pas la peine de mettre le nom d'utilisateur" sur Mes
// Séances) — la ligne "chapeau" pseudo au-dessus du titre, ajoutée plus tôt
// dans la même session, a été retirée de PlaylistCard.jsx (voir sa
// docstring pour le raisonnement complet : toujours le MÊME pseudo sur
// CHAQUE carte de cette vue, redondant par construction, en plus de
// tronquer le titre affiché juste à côté). La convention reste appliquée
// ailleurs (PlaylistHeader.jsx, TemplateCard.jsx), où le pseudo identifie
// un propriétaire potentiellement différent de soi — voir leurs propres
// fichiers de test, inchangés. Test de non-régression ci-dessous : même si
// un futur appelant repasse `username` par erreur (ex. copie d'un ancien
// pattern), la carte ne doit PLUS jamais l'afficher.
describe('PlaylistCard — pas de pseudo affiché (retiré le 07/08, non-régression)', () => {
  it('un éventuel prop username, même fourni, ne doit produire AUCUN texte visible sur la carte', () => {
    render(<PlaylistCard {...baseProps({ username: 'un_pseudo_quelconque' })} />);
    expect(screen.queryByText('un_pseudo_quelconque')).not.toBeInTheDocument();
    expect(screen.queryByText('Invité')).not.toBeInTheDocument();
  });
});
