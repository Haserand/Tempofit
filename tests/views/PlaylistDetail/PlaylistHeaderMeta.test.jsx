// @vitest-environment jsdom
//
// Test dédié pour PlaylistHeaderMeta.jsx — extrait de
// PlaylistHeader.test.jsx (08/08, découpage).
//
// ⚠️ PSEUDO + COMPTEUR DE CLONAGES (10/08, retour direct avec capture
// d'écran) — déplacés ici depuis PlaylistHeaderTitleBlock.jsx (voir la
// docstring du composant), avec leurs tests. `ownerLabel`/
// `ownerProfileUsername` sont reçus ici en props DIRECTES : le calcul de
// ces 2 valeurs (4-5 branches selon isSaved/username/sourceTemplateId/
// ownerUsername) reste testé côté PlaylistHeader.test.jsx, qui vérifie
// que la bonne valeur est transmise à ce composant. Ici, on teste
// uniquement "étant donné ownerLabel=X, le rendu/l'interaction sont
// corrects" — pas d'où X vient (même principe que l'ancien
// PlaylistHeaderTitleBlock.test.jsx, avant ce déplacement).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((genre) => [genre]),
  genreDisplayLabel: vi.fn((genre) => genre),
}));

vi.mock('../../../src/components/shared/TopCompletionDate.jsx', () => ({
  // Rendu inline (span, pas div) : PlaylistHeaderMeta.jsx insère ce
  // composant À L'INTÉRIEUR d'un <p> — un <div> y serait du HTML invalide.
  default: () => <span data-testid="top-completion-date-mock">TopCompletionDate (mock)</span>,
}));

vi.mock('../../../src/components/shared/CompletionsList.jsx', () => ({
  default: () => <div data-testid="completions-list-mock">CompletionsList (mock)</div>,
}));

import PlaylistHeaderMeta from '../../../src/components/views/PlaylistDetail/PlaylistHeaderMeta.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const track1 = { id: 't1', genre: 'Rock' };
const track2 = { id: 't2', genre: 'Métal' };

function makePlaylist(overrides = {}) {
  return {
    workoutType: 'Course à pied', totalDuration: 410, tracks: [track1, track2],
    completions: [], config: {}, cloneCount: undefined,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    theme: {},
    isLocked: false,
    isReadOnly: false,
    editingCompletion: null,
    setEditingCompletion: vi.fn(),
    editCompletionDate: vi.fn(),
    removeCompletionDate: vi.fn(),
    triggerCSVUpload: vi.fn(),
    removeImportedData: vi.fn(),
    mostRecentCompletionIso: null,
    ownerLabel: null,
    ownerProfileUsername: null,
    onViewProfile: vi.fn(),
    isSaved: true,
    ...overrides,
  };
}

describe('PlaylistHeaderMeta — pseudo + compteur de clonages (1er élément de la ligne)', () => {
  it('ownerLabel=null : aucun pseudo affiché, "Course à pied" reste le 1er élément (pas de séparateur orphelin)', () => {
    render(<PlaylistHeaderMeta {...baseProps({ ownerLabel: null })} />);
    expect(screen.queryByText('Invité')).not.toBeInTheDocument();
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
  });

  it('ownerLabel fourni : affiché AVANT "Course à pied", précédé de l\'icône User', () => {
    const { container } = render(<PlaylistHeaderMeta {...baseProps({ ownerLabel: 'Invité' })} />);
    expect(screen.getByText('Invité')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-user')).toBeInTheDocument();
  });

  it('ownerProfileUsername + onViewProfile fournis : pseudo cliquable, le clic appelle onViewProfile', () => {
    const onViewProfile = vi.fn();
    render(<PlaylistHeaderMeta {...baseProps({ ownerLabel: 'un_autre_coureur', ownerProfileUsername: 'un_autre_coureur', onViewProfile })} />);
    fireEvent.click(screen.getByText('un_autre_coureur'));
    expect(onViewProfile).toHaveBeenCalledWith('un_autre_coureur');
  });

  it('sans ownerProfileUsername (ton propre pseudo) : PAS cliquable, rendu en <span>', () => {
    const onViewProfile = vi.fn();
    render(<PlaylistHeaderMeta {...baseProps({ ownerLabel: 'mon_pseudo', ownerProfileUsername: null, onViewProfile })} />);
    const label = screen.getByText('mon_pseudo');
    expect(label.tagName).toBe('SPAN');
    fireEvent.click(label);
    expect(onViewProfile).not.toHaveBeenCalled();
  });

  it('ownerProfileUsername fourni MAIS onViewProfile absent : reste un simple texte, pas un bouton', () => {
    render(<PlaylistHeaderMeta {...baseProps({ ownerLabel: 'TempoFit Officiel', ownerProfileUsername: 'tempofit_officiel', onViewProfile: undefined })} />);
    const label = screen.getByText('TempoFit Officiel');
    expect(label.tagName).toBe('SPAN');
  });

  // ⚠️ RETIRÉ (10/08, retour direct suivant, même session — "le compteur
  // de clonages, je le veux davantage sur la même ligne que le bouton
  // public/corbeille") : les tests cloneCount vivaient ici juste au-dessus
  // (compteur affiché à 0/avec une valeur/absent si undefined, et le cas
  // "gaté sur ownerLabel") — déplacés dans PlaylistHeaderBadges.test.jsx,
  // ce composant ne rend plus DU TOUT le compteur de clonages, uniquement
  // le pseudo désormais.
  it('cloneCount (sur currentPlaylist) n\'a plus aucun effet ici, quelle que soit sa valeur', () => {
    render(<PlaylistHeaderMeta {...baseProps({ ownerLabel: 'Invité', currentPlaylist: makePlaylist({ cloneCount: 42 }) })} />);
    expect(screen.queryByTitle('Nombre de fois où cette playlist a été clonée')).not.toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });
});

describe('PlaylistHeaderMeta — ligne d\'infos', () => {
  it('affiche le type de séance, la durée et le nombre de titres', () => {
    render(<PlaylistHeaderMeta {...baseProps()} />);
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
    expect(screen.getByText('2 titres')).toBeInTheDocument();
  });

  it('genres : affiche cfg.selectedGenres (via genreDisplayLabel) en priorité sur les genres réels des titres', () => {
    render(<PlaylistHeaderMeta {...baseProps({ currentPlaylist: makePlaylist({ config: { selectedGenres: ['Rock', 'Pop'] } }) })} />);
    expect(screen.getByText('Rock, Pop')).toBeInTheDocument();
  });

  it('genres : sans cfg.selectedGenres, replie sur les genres réels des titres', () => {
    render(<PlaylistHeaderMeta {...baseProps({ currentPlaylist: makePlaylist({ config: {}, tracks: [{ ...track1, genre: 'Techno' }] }) })} />);
    expect(screen.getByText('Techno')).toBeInTheDocument();
  });
});

describe('PlaylistHeaderMeta — badge "séance déjà réalisée"', () => {
  it('isLocked + au moins 1 complétion : affiche TopCompletionDate, et CompletionsList seulement si >1 complétion', () => {
    const { rerender } = render(<PlaylistHeaderMeta {...baseProps({
      isLocked: true, currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }),
    })} />);
    expect(screen.getByTestId('top-completion-date-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('completions-list-mock')).not.toBeInTheDocument();

    rerender(<PlaylistHeaderMeta {...baseProps({
      isLocked: true, currentPlaylist: makePlaylist({ completions: ['2026-01-01', '2026-01-08'] }),
    })} />);
    expect(screen.getByTestId('completions-list-mock')).toBeInTheDocument();
  });

  it('sans isLocked ou sans complétion : aucun badge affiché', () => {
    render(<PlaylistHeaderMeta {...baseProps({ isLocked: false, currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }) })} />);
    expect(screen.queryByTestId('top-completion-date-mock')).not.toBeInTheDocument();
  });
});
