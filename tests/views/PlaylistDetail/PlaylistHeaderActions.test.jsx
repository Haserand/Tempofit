// @vitest-environment jsdom
//
// Test dédié pour PlaylistHeaderActions.jsx — extrait de
// PlaylistHeader.test.jsx (08/08, découpage). `avgBpm`/`bpmZone`/
// `bpmBadgeColor` sont reçus ici en props DIRECTES : leur calcul reste
// testé côté PlaylistHeader.test.jsx.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useRef } from 'react';

import PlaylistHeaderActions from '../../../src/components/views/PlaylistDetail/PlaylistHeaderActions.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makePlaylist(overrides = {}) {
  return { id: 'pl1', plannedDate: null, completions: [], actualDataByDate: {}, ...overrides };
}

// `plannedDateInputRef` doit être un vrai `useRef` (le composant lit
// `.current?.showPicker`) — un simple wrapper fonctionnel suffit pour lui
// en fournir un sans dépendre de PlaylistHeader.jsx lui-même.
function Wrapper(props) {
  const plannedDateInputRef = useRef(null);
  return <PlaylistHeaderActions {...props} plannedDateInputRef={props.plannedDateInputRef || plannedDateInputRef} />;
}

function baseProps(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    isLocked: false,
    isReadOnly: false,
    isSaved: true,
    triggerCSVUpload: vi.fn(),
    removeImportedData: vi.fn(),
    mostRecentCompletionIso: null,
    hasImportedDataForMostRecent: false,
    handleClonePlaylist: vi.fn(),
    handleSavePlaylist: vi.fn(),
    setPlaylistPlannedDate: vi.fn(),
    onShare: vi.fn(),
    bpmBadgeColor: null,
    avgBpm: null,
    bpmZone: null,
    ...overrides,
  };
}

describe('PlaylistHeaderActions — import CSV', () => {
  it('libellé et action dépendent de hasImportedDataForMostRecent', () => {
    const triggerCSVUpload = vi.fn();
    render(<Wrapper {...baseProps({
      isLocked: true, triggerCSVUpload,
      currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }),
      mostRecentCompletionIso: '2026-01-01',
    })} />);
    expect(screen.getByText('Importe tes données')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Importe tes données'));
    expect(triggerCSVUpload).toHaveBeenCalled();
  });

  it('"Données importées" quand hasImportedDataForMostRecent=true', () => {
    render(<Wrapper {...baseProps({ isLocked: true, hasImportedDataForMostRecent: true })} />);
    expect(screen.getByText('Données importées')).toBeInTheDocument();
  });

  describe('retirer les données importées', () => {
    it('absent si removeImportedData n\'est pas fourni (prop optionnelle)', () => {
      render(<Wrapper {...baseProps({ isLocked: true, hasImportedDataForMostRecent: true, removeImportedData: undefined })} />);
      expect(screen.queryByTitle('Retirer les données importées')).not.toBeInTheDocument();
    });

    it('absent si hasImportedDataForMostRecent=false, même avec removeImportedData fourni', () => {
      render(<Wrapper {...baseProps({ isLocked: true, hasImportedDataForMostRecent: false, removeImportedData: vi.fn() })} />);
      expect(screen.queryByTitle('Retirer les données importées')).not.toBeInTheDocument();
    });

    it('présent si des données existent, le clic appelle removeImportedData avec la playlist et la date', () => {
      const removeImportedData = vi.fn();
      const playlist = makePlaylist({ completions: ['2026-01-01'] });
      render(<Wrapper {...baseProps({
        isLocked: true, hasImportedDataForMostRecent: true, removeImportedData,
        currentPlaylist: playlist, mostRecentCompletionIso: '2026-01-01',
      })} />);

      fireEvent.click(screen.getByTitle('Retirer les données importées'));

      expect(removeImportedData).toHaveBeenCalledWith(playlist, '2026-01-01');
    });
  });

  it('masqué si isReadOnly=true, même si isLocked=true', () => {
    render(<Wrapper {...baseProps({ isLocked: true, isReadOnly: true })} />);
    expect(screen.queryByText('Importe tes données')).not.toBeInTheDocument();
    expect(screen.queryByText('Données importées')).not.toBeInTheDocument();
  });
});

describe('PlaylistHeaderActions — action principale', () => {
  // ⚠️ MIS À JOUR (10/08, retour direct — "'Sauvegarder' sous-entend déjà
  // 'dans mes séances', pourquoi le préciser ?") : libellés raccourcis,
  // "Sauvegarder dans mes séances" → "Sauvegarder" et "Ajouter à Mes
  // Séances" → "Ajouter" — comportement/déclencheurs INCHANGÉS, seul le
  // texte affiché change (le `title`, testé nulle part ici, garde
  // l'explication complète).
  it('isReadOnly=true : "Sauvegarder", le clic appelle handleClonePlaylist', () => {
    const handleClonePlaylist = vi.fn();
    render(<Wrapper {...baseProps({ isReadOnly: true, isSaved: false, handleClonePlaylist })} />);

    expect(screen.getByText('Sauvegarder')).toBeInTheDocument();
    expect(screen.queryByText('Ajouter')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Sauvegarder'));
    expect(handleClonePlaylist).toHaveBeenCalled();
  });

  // Vérifie l'ORDRE de la chaîne ternaire (isReadOnly ? ... : isSaved ? ...)
  // plutôt que de supposer isSaved toujours false quand isReadOnly est vrai.
  it('isReadOnly=true PRIME sur isSaved=true', () => {
    render(<Wrapper {...baseProps({ isReadOnly: true, isSaved: true })} />);
    expect(screen.getByText('Sauvegarder')).toBeInTheDocument();
  });

  it('isSaved=false (et pas isReadOnly) : "Ajouter", le clic appelle handleSavePlaylist', () => {
    const handleSavePlaylist = vi.fn();
    render(<Wrapper {...baseProps({ isSaved: false, handleSavePlaylist })} />);

    fireEvent.click(screen.getByText('Ajouter'));
    expect(handleSavePlaylist).toHaveBeenCalled();
  });

  it('isSaved=true (et pas isReadOnly) : aucun bouton principal (Retirer vit dans PlaylistHeaderBadges)', () => {
    render(<Wrapper {...baseProps({ isSaved: true })} />);
    expect(screen.queryByText('Ajouter')).not.toBeInTheDocument();
    expect(screen.queryByText('Sauvegarder')).not.toBeInTheDocument();
  });
});

describe('PlaylistHeaderActions — Planifier', () => {
  it('n\'apparaît que si isSaved=true, affiche la date déjà planifiée sinon "Planifier"', () => {
    const { rerender } = render(<Wrapper {...baseProps({ isSaved: false })} />);
    expect(screen.queryByText('Planifier')).not.toBeInTheDocument();

    rerender(<Wrapper {...baseProps({ isSaved: true, currentPlaylist: makePlaylist({ plannedDate: null }) })} />);
    expect(screen.getByText('Planifier')).toBeInTheDocument();
  });

  it('masqué si isReadOnly=true, même si isSaved=true', () => {
    render(<Wrapper {...baseProps({ isSaved: true, isReadOnly: true })} />);
    expect(screen.queryByText('Planifier')).not.toBeInTheDocument();
  });

  it('changer la date planifiée appelle setPlaylistPlannedDate avec l\'id de la playlist', () => {
    const setPlaylistPlannedDate = vi.fn();
    const { container } = render(<Wrapper {...baseProps({
      isSaved: true, currentPlaylist: makePlaylist({ id: 'pl1' }), setPlaylistPlannedDate,
    })} />);

    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-02-14' } });

    expect(setPlaylistPlannedDate).toHaveBeenCalledWith('pl1', '2026-02-14');
  });
});

describe('PlaylistHeaderActions — Partager', () => {
  it('le clic appelle onShare', () => {
    const onShare = vi.fn();
    render(<Wrapper {...baseProps({ onShare })} />);
    fireEvent.click(screen.getByText('Partager'));
    expect(onShare).toHaveBeenCalled();
  });
});

describe('PlaylistHeaderActions — badge BPM', () => {
  it('affiche le BPM avec le libellé de zone si bpmZone est fourni', () => {
    render(<Wrapper {...baseProps({ avgBpm: 150, bpmZone: { shortLabel: 'Seuil', color: '#f59e0b' }, bpmBadgeColor: '#f59e0b' })} />);
    expect(screen.getByText('150 BPM • Seuil')).toBeInTheDocument();
  });

  it('sans bpmZone, affiche juste le BPM (pas de suffixe)', () => {
    render(<Wrapper {...baseProps({ avgBpm: 150, bpmZone: null, bpmBadgeColor: '#123456' })} />);
    expect(screen.getByText('150 BPM')).toBeInTheDocument();
  });

  it('sans bpmBadgeColor (aucun titre dans la playlist), le badge n\'est pas affiché du tout', () => {
    render(<Wrapper {...baseProps({ avgBpm: null, bpmZone: null, bpmBadgeColor: null })} />);
    expect(screen.queryByText(/BPM/)).not.toBeInTheDocument();
  });
});
