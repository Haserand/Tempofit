// @vitest-environment jsdom
//
// Palier 2 (29/07, 4/10) — TopCompletionDate, date de la 1ère complétion
// d'une playlist, éditable en ligne (clic → <input type="date">).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TopCompletionDate from '../src/components/shared/TopCompletionDate.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  inputBg: 'mock-input-bg',
  borderAccentClass: 'mock-border-accent',
  textHighlight: 'mock-highlight',
};

const mockPlaylist = { id: 'playlist-1', completions: ['2026-03-15T10:00:00.000Z'] };

describe('TopCompletionDate', () => {
  it('ne rend rien quand la playlist n\'a aucune complétion', () => {
    const { container } = render(
      <TopCompletionDate
        playlist={{ id: 'playlist-1', completions: [] }}
        editingCompletion={null}
        setEditingCompletion={() => {}}
        editCompletionDate={() => {}}
        theme={mockTheme}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche la date de la 1re complétion formatée en français, hors édition', () => {
    render(
      <TopCompletionDate
        playlist={mockPlaylist}
        editingCompletion={null}
        setEditingCompletion={() => {}}
        editCompletionDate={() => {}}
        theme={mockTheme}
      />
    );
    // "15 mars 2026" au format court fr-FR ("15 mars 2026" ou "15 mar. 2026"
    // selon l'environnement ICU) — on vérifie juste la présence du jour/année,
    // moins fragile qu'un texte exact dépendant de la locale du runtime.
    expect(screen.getByRole('button', { name: /15.*2026/ })).toBeInTheDocument();
  });

  it('le clic sur la date appelle setEditingCompletion avec le bon playlistId/isoDate', () => {
    const setEditingCompletion = vi.fn();
    render(
      <TopCompletionDate
        playlist={mockPlaylist}
        editingCompletion={null}
        setEditingCompletion={setEditingCompletion}
        editCompletionDate={() => {}}
        theme={mockTheme}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /15.*2026/ }));
    expect(setEditingCompletion).toHaveBeenCalledWith({
      playlistId: 'playlist-1',
      isoDate: '2026-03-15T10:00:00.000Z',
    });
  });

  it('affiche un <input type="date"> quand editingCompletion correspond à CETTE playlist/date', () => {
    render(
      <TopCompletionDate
        playlist={mockPlaylist}
        editingCompletion={{ playlistId: 'playlist-1', isoDate: '2026-03-15T10:00:00.000Z' }}
        setEditingCompletion={() => {}}
        editCompletionDate={() => {}}
        theme={mockTheme}
      />
    );
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('ne bascule PAS en édition si editingCompletion vise une AUTRE playlist', () => {
    render(
      <TopCompletionDate
        playlist={mockPlaylist}
        editingCompletion={{ playlistId: 'une-autre-playlist', isoDate: '2026-03-15T10:00:00.000Z' }}
        setEditingCompletion={() => {}}
        editCompletionDate={() => {}}
        theme={mockTheme}
      />
    );
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it('quitter le champ (blur) appelle editCompletionDate PUIS setEditingCompletion(null)', () => {
    const editCompletionDate = vi.fn();
    const setEditingCompletion = vi.fn();
    render(
      <TopCompletionDate
        playlist={mockPlaylist}
        editingCompletion={{ playlistId: 'playlist-1', isoDate: '2026-03-15T10:00:00.000Z' }}
        setEditingCompletion={setEditingCompletion}
        editCompletionDate={editCompletionDate}
        theme={mockTheme}
      />
    );
    const input = document.querySelector('input[type="date"]');
    fireEvent.change(input, { target: { value: '2026-03-20' } });
    fireEvent.blur(input);

    expect(editCompletionDate).toHaveBeenCalledWith('playlist-1', '2026-03-15T10:00:00.000Z', '2026-03-20');
    expect(setEditingCompletion).toHaveBeenCalledWith(null);
  });

  it('la touche Échap ferme l\'édition SANS appeler editCompletionDate', () => {
    const editCompletionDate = vi.fn();
    const setEditingCompletion = vi.fn();
    render(
      <TopCompletionDate
        playlist={mockPlaylist}
        editingCompletion={{ playlistId: 'playlist-1', isoDate: '2026-03-15T10:00:00.000Z' }}
        setEditingCompletion={setEditingCompletion}
        editCompletionDate={editCompletionDate}
        theme={mockTheme}
      />
    );
    fireEvent.keyDown(document.querySelector('input[type="date"]'), { key: 'Escape' });

    expect(setEditingCompletion).toHaveBeenCalledWith(null);
    expect(editCompletionDate).not.toHaveBeenCalled();
  });

  // isReadOnly (Feature Sociale — Consultation/Clonage, 01/08) — playlist
  // étrangère consultée en aperçu (PlaylistHeader.jsx) : la date reste
  // visible mais ne doit plus être cliquable/éditable.
  describe('isReadOnly', () => {
    it('affiche la date en texte simple, sans bouton ni icône crayon', () => {
      render(
        <TopCompletionDate
          playlist={mockPlaylist}
          editingCompletion={null}
          setEditingCompletion={() => {}}
          editCompletionDate={() => {}}
          theme={mockTheme}
          isReadOnly={true}
        />
      );
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByText(/15.*2026/)).toBeInTheDocument();
    });

    it('ignore editingCompletion — jamais de <input type="date"> même si un état d\'édition matche CETTE date', () => {
      render(
        <TopCompletionDate
          playlist={mockPlaylist}
          editingCompletion={{ playlistId: 'playlist-1', isoDate: '2026-03-15T10:00:00.000Z' }}
          setEditingCompletion={() => {}}
          editCompletionDate={() => {}}
          theme={mockTheme}
          isReadOnly={true}
        />
      );
      expect(document.querySelector('input[type="date"]')).toBeNull();
    });
  });
});
