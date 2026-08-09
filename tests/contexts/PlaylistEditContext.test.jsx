// @vitest-environment jsdom
//
// Test dédié à PlaylistEditContext.jsx — extrait de
// PlaylistDetailContext.test.jsx (08/08, découpage) : ces scénarios
// testaient déjà exactement ce périmètre via l'ancien Provider unique,
// simplement déplacés pour rendre `PlaylistEditProvider` directement.
// Setup BEAUCOUP plus simple qu'avant : plus besoin de mocker
// GeneratorContext/AudioPlayerContext/supabase (ce Contexte n'en dépend
// pas du tout, contrairement à PlaylistDetailContext.jsx).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MAX_DESCRIPTION_LENGTH } from '../../src/appConfig.js';
import { PlaylistEditProvider, usePlaylistEdit } from '../../src/contexts/PlaylistEditContext.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makePlaylist(overrides = {}) {
  return { id: 'pl1', name: 'Ma séance', description: '', ...overrides };
}

// Même sonde que l'ancienne `DetailsProbe` (PlaylistDetailContext.test.jsx).
function DetailsProbe() {
  const {
    editedPlaylistName, setEditedPlaylistName,
    editedPlaylistDescription, setEditedPlaylistDescription,
    handleSavePlaylistDetails, isEditingPlaylistDetails,
  } = usePlaylistEdit();
  return (
    <div>
      <span data-testid="editing-state">{String(isEditingPlaylistDetails)}</span>
      <input data-testid="name-draft-input" value={editedPlaylistName} onChange={(e) => setEditedPlaylistName(e.target.value)} />
      <input data-testid="draft-input" value={editedPlaylistDescription} onChange={(e) => setEditedPlaylistDescription(e.target.value)} />
      <button onClick={handleSavePlaylistDetails}>save-details</button>
    </div>
  );
}

function renderWithProvider(currentPlaylist, savedPlaylists, { setCurrentPlaylist = vi.fn(), setSavedPlaylists = vi.fn() } = {}) {
  render(
    <PlaylistEditProvider
      currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
      savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
    >
      <DetailsProbe />
    </PlaylistEditProvider>
  );
}

// Vague 2, Chantier 3 — "description texte libre sur une playlist
// publique" (02/08). FUSIONNÉ avec l'édition du nom le 08/08 (retour
// direct : "que modifier le titre ou la description vienne un seul
// crayon plutôt que via chacune une option individuelle") — un seul
// handler, `handleSavePlaylistDetails`, sauvegarde les DEUX champs
// ensemble.
describe('PlaylistEditContext — édition combinée titre+description (handleSavePlaylistDetails)', () => {
  it('met à jour currentPlaylist ET savedPlaylists avec la description éditée, en la découpant sur les espaces superflus', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ description: '' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: '  Ma nouvelle description  ' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ description: 'Ma nouvelle description' }));
    expect(setSavedPlaylists).toHaveBeenCalledWith([expect.objectContaining({ description: 'Ma nouvelle description' })]);
  });

  // NOUVEAU (08/08) — le VRAI risque identifié AVANT d'implémenter la
  // fusion (pas trouvé après coup) : les 2 anciens handlers séparés
  // lisaient chacun `currentPlaylist` depuis la MÊME fermeture de rendu —
  // les appeler l'un après l'autre (au lieu de les fusionner) aurait fait
  // perdre le 1er changement.
  it('modifier le NOM et la DESCRIPTION dans la même édition, puis sauvegarder UNE FOIS, garde les deux changements (régression du risque de course identifié avant implémentation)', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ name: 'Ancien nom', description: 'Ancienne description' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'Nouveau nom' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Nouvelle description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledTimes(1);
    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nouveau nom', description: 'Nouvelle description' }));
  });

  it('un nom vidé (chaîne vide après trim) replie sur l\'ancien nom SANS perdre la description modifiée à côté', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist({ name: 'Nom original', description: '' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist });

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: '   ' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Une description quand même' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nom original', description: 'Une description quand même' }));
  });

  it('accepte une description VIDE (contrairement au nom, effacer la description est un état valide)', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ description: 'Une description déjà présente' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: '' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ description: '' }));
  });

  it('tronque à MAX_DESCRIPTION_LENGTH même si le texte fourni est plus long (défense en profondeur, pas juste le `maxLength` du textarea)', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist({ description: '' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist });

    const tooLong = 'x'.repeat(500);
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: tooLong } });
    fireEvent.click(screen.getByText('save-details'));

    const calledWith = setCurrentPlaylist.mock.calls[0][0];
    expect(calledWith.description.length).toBe(MAX_DESCRIPTION_LENGTH);
  });

  // "Clone" vs "Enfant" (02/08, discussion produit : la lignée ne se
  // rompt jamais, mais l'étiquette affichée change dès la 1re
  // modification — booléen simple, jamais un seuil arbitraire).
  it('éditer la description d\'une copie CLONÉE (parentUserId présent) pose isModifiedSinceClone à true', () => {
    const setCurrentPlaylist = vi.fn();
    const clonedPlaylist = makePlaylist({ description: '', parentId: 'pl-A', parentUserId: 'user-A', isModifiedSinceClone: false });
    renderWithProvider(clonedPlaylist, [clonedPlaylist], { setCurrentPlaylist });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Ma propre description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ isModifiedSinceClone: true }));
  });

  it('éditer la description d\'une playlist SANS origine (jamais clonée) ne pose PAS isModifiedSinceClone — rien à marquer', () => {
    const setCurrentPlaylist = vi.fn();
    const ownPlaylist = makePlaylist({ description: '' });
    renderWithProvider(ownPlaylist, [ownPlaylist], { setCurrentPlaylist });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Ma description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist.mock.calls[0][0].isModifiedSinceClone).toBeUndefined();
  });

  it('currentPlaylist absent (garde défensive) : ferme juste l\'édition, n\'appelle aucun setter', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    renderWithProvider(null, [], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).not.toHaveBeenCalled();
    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(screen.getByTestId('editing-state')).toHaveTextContent('false');
  });
});

// NOUVEAU (08/08) — la vraie raison d'être de ce découpage : vérifier que
// CE Contexte, à lui seul, ne re-render QUE ses propres consommateurs.
// Ne peut pas prouver l'absence de re-render d'un AUTRE composant
// (usePlaylistDetail()) depuis ce fichier isolé — cette partie-là est
// structurelle (2 Contextes distincts, PlaylistDetailProvider n'a plus
// cet état interne du tout) plutôt que testable unitairement ici.
describe('PlaylistEditContext — isolation', () => {
  it('usePlaylistEdit() hors Provider renvoie un repli inerte (pas de crash)', () => {
    function Bare() {
      const { isEditingPlaylistDetails, handleSavePlaylistDetails } = usePlaylistEdit();
      return <span data-testid="bare">{String(isEditingPlaylistDetails)}{typeof handleSavePlaylistDetails}</span>;
    }
    render(<Bare />);
    expect(screen.getByTestId('bare')).toHaveTextContent('falsefunction');
  });
});
