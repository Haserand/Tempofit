// @vitest-environment jsdom
//
// Palier 2 (29/07, 6/10) — CompletionsList, liste interactive des dates de
// complétion d'une playlist (modifier/importer Garmin-Strava/retirer).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CompletionsList from '../src/components/shared/CompletionsList.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
  borderAccentClass: 'mock-border-accent',
  textHighlight: 'mock-highlight',
};

const mockPlaylist = {
  id: 'playlist-1',
  completions: ['2026-01-10', '2026-02-15', '2026-03-20'],
  actualDataByDate: { '2026-02-15': { cadence: 170 } },
};

const baseProps = {
  playlist: mockPlaylist,
  editingCompletion: null,
  setEditingCompletion: () => {},
  editCompletionDate: () => {},
  removeCompletionDate: () => {},
  triggerCSVUpload: () => {},
  theme: mockTheme,
};

describe('CompletionsList', () => {
  it('affiche 1 pastille par date de complétion (3 dates -> 3 boutons "Retirer cette date")', () => {
    render(<CompletionsList {...baseProps} />);
    expect(screen.getAllByTitle('Retirer cette date')).toHaveLength(3);
  });

  it('exclut les dates listées dans skipDates', () => {
    render(<CompletionsList {...baseProps} skipDates={['2026-01-10', '2026-03-20']} />);
    expect(screen.getAllByTitle('Retirer cette date')).toHaveLength(1);
  });

  it('masque le bouton d\'import UNIQUEMENT pour la date couverte par hideUploadForDate (date et bouton retirer restent)', () => {
    render(<CompletionsList {...baseProps} hideUploadForDate="2026-02-15" />);
    // 3 dates au total, mais seulement 2 boutons d'import (upload) affichés.
    expect(screen.getAllByTitle('Retirer cette date')).toHaveLength(3);
    const uploadButtons = [
      ...screen.queryAllByTitle('Importer Garmin/Strava (cadence/FC)'),
      ...screen.queryAllByTitle('Données déjà importées — cliquer pour remplacer'),
    ];
    expect(uploadButtons).toHaveLength(2);
  });

  it('le bouton d\'import a un titre différent quand des données existent déjà pour cette date', () => {
    render(<CompletionsList {...baseProps} />);
    // 2026-02-15 a des données (actualDataByDate) -> titre "déjà importées"
    expect(screen.getByTitle('Données déjà importées — cliquer pour remplacer')).toBeInTheDocument();
    // Les 2 autres dates n'en ont pas -> titre "Importer..."
    expect(screen.getAllByTitle('Importer Garmin/Strava (cadence/FC)')).toHaveLength(2);
  });

  it('le clic sur une date appelle setEditingCompletion avec le bon playlistId/isoDate', () => {
    const setEditingCompletion = vi.fn();
    render(<CompletionsList {...baseProps} setEditingCompletion={setEditingCompletion} />);

    fireEvent.click(screen.getAllByTitle('Modifier cette date')[1]); // la 2e date

    expect(setEditingCompletion).toHaveBeenCalledWith({ playlistId: 'playlist-1', isoDate: '2026-02-15' });
  });

  it('affiche un <input type="date"> à la place de la pastille en cours d\'édition, les autres restant des pastilles', () => {
    render(
      <CompletionsList
        {...baseProps}
        editingCompletion={{ playlistId: 'playlist-1', isoDate: '2026-02-15' }}
      />
    );
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(1);
    // Les 2 autres dates restent des pastilles cliquables (2 boutons "Modifier cette date" restants).
    expect(screen.getAllByTitle('Modifier cette date')).toHaveLength(2);
  });

  it('le clic sur le bouton d\'import appelle triggerCSVUpload(e, playlist, iso)', () => {
    const triggerCSVUpload = vi.fn();
    render(<CompletionsList {...baseProps} triggerCSVUpload={triggerCSVUpload} />);

    fireEvent.click(screen.getByTitle('Données déjà importées — cliquer pour remplacer'));

    expect(triggerCSVUpload).toHaveBeenCalledTimes(1);
    const args = triggerCSVUpload.mock.calls[0];
    expect(args[1]).toBe(mockPlaylist);
    expect(args[2]).toBe('2026-02-15');
  });

  it('le clic sur "Retirer cette date" appelle removeCompletionDate(playlistId, iso)', () => {
    const removeCompletionDate = vi.fn();
    render(<CompletionsList {...baseProps} removeCompletionDate={removeCompletionDate} />);

    fireEvent.click(screen.getAllByTitle('Retirer cette date')[0]);

    expect(removeCompletionDate).toHaveBeenCalledWith('playlist-1', '2026-01-10');
  });

  it('un clic dans la liste ne se propage PAS au parent (stopPropagation, ex. évite d\'ouvrir la playlist en dessous)', () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <CompletionsList {...baseProps} />
      </div>
    );

    fireEvent.click(screen.getAllByTitle('Retirer cette date')[0]);

    expect(onParentClick).not.toHaveBeenCalled();
  });
});
