// @vitest-environment jsdom
//
// Test dédié pour PlaylistHeaderTitleBlock.jsx — extrait de
// PlaylistHeader.test.jsx (08/08, découpage). `ownerLabel`/
// `ownerProfileUsername` sont reçus ici en props DIRECTES : le calcul de
// ces 2 valeurs (4-5 branches selon isSaved/username/sourceTemplateId/
// ownerUsername) reste testé côté PlaylistHeader.test.jsx, qui vérifie
// que la bonne valeur est transmise à ce composant. Ici, on teste
// uniquement "étant donné ownerLabel=X, le rendu/l'interaction sont
// corrects" — pas d'où X vient.
//
// ⚠️ `usePlaylistEdit()` MOCKÉ (08/08, chantier "value non mémoïsée
// re-render tout le monde à chaque frappe" — voir la docstring de
// PlaylistEditContext.jsx) : `isEditingPlaylistDetails`/
// `editedPlaylistName`/`editedPlaylistDescription`/
// `handleSavePlaylistDetails` ne sont PLUS des props de ce composant,
// il les lit directement via ce Contexte — même pattern de mock que
// `usePlaylistDetail()` dans PlaylistHeader.test.jsx.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../src/appConfig.js', () => ({
  getActivityEmoji: vi.fn(() => '🏃'),
  MAX_DESCRIPTION_LENGTH: 150,
}));

// `vi.hoisted()` (voir AuthContext.test.jsx pour l'explication complète) —
// pattern déjà établi ailleurs dans ce projet pour ce cas précis, adopté
// ici aussi plutôt qu'un simple `const mockUsePlaylistEdit = vi.fn();`
// placé avant `vi.mock()` : ce dernier est hissé tout en haut du fichier
// par Vitest, avant même les `const` du code source — passer par
// `vi.hoisted()` garantit que cette variable est disponible au même
// niveau de hissage, sans dépendre de la façon dont la factory y accède.
const { mockUsePlaylistEdit } = vi.hoisted(() => ({ mockUsePlaylistEdit: vi.fn() }));
vi.mock('../../../src/contexts/PlaylistEditContext.jsx', () => ({
  usePlaylistEdit: () => mockUsePlaylistEdit(),
}));

import PlaylistHeaderTitleBlock from '../../../src/components/views/PlaylistDetail/PlaylistHeaderTitleBlock.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makePlaylist(overrides = {}) {
  return { name: 'Ma Séance', workoutType: 'Course à pied', description: undefined, cloneCount: undefined, ...overrides };
}

function baseProps(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    isSaved: true,
    isReadOnly: false,
    ownerLabel: 'Invité',
    ownerProfileUsername: null,
    onViewProfile: vi.fn(),
    ...overrides,
  };
}

function makeEditValue(overrides = {}) {
  return {
    isEditingPlaylistDetails: false, setIsEditingPlaylistDetails: vi.fn(),
    editedPlaylistName: '', setEditedPlaylistName: vi.fn(),
    editedPlaylistDescription: '', setEditedPlaylistDescription: vi.fn(),
    handleSavePlaylistDetails: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistHeaderTitleBlock — ligne pseudo + compteur de clonages', () => {
  it('ownerLabel=null : aucune ligne "chapeau" affichée', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ ownerLabel: null })} />);
    expect(screen.queryByText('Invité')).not.toBeInTheDocument();
  });

  it('ownerProfileUsername + onViewProfile fournis : pseudo cliquable, le clic appelle onViewProfile', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    const onViewProfile = vi.fn();
    render(<PlaylistHeaderTitleBlock {...baseProps({ ownerLabel: 'un_autre_coureur', ownerProfileUsername: 'un_autre_coureur', onViewProfile })} />);
    fireEvent.click(screen.getByText('un_autre_coureur'));
    expect(onViewProfile).toHaveBeenCalledWith('un_autre_coureur');
  });

  it('sans ownerProfileUsername (ton propre pseudo) : PAS cliquable, rendu en <span>', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    const onViewProfile = vi.fn();
    render(<PlaylistHeaderTitleBlock {...baseProps({ ownerLabel: 'mon_pseudo', ownerProfileUsername: null, onViewProfile })} />);
    const label = screen.getByText('mon_pseudo');
    expect(label.tagName).toBe('SPAN');
    fireEvent.click(label);
    expect(onViewProfile).not.toHaveBeenCalled();
  });

  it('ownerProfileUsername fourni MAIS onViewProfile absent : reste un simple texte, pas un bouton', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ ownerLabel: 'TempoFit Officiel', ownerProfileUsername: 'tempofit_officiel', onViewProfile: undefined })} />);
    const label = screen.getByText('TempoFit Officiel');
    expect(label.tagName).toBe('SPAN');
  });

  it('cloneCount défini : affiche le compteur, même à 0', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ currentPlaylist: makePlaylist({ cloneCount: 0 }) })} />);
    expect(screen.getByTitle('Nombre de fois où cette playlist a été clonée')).toHaveTextContent('0');
  });

  it('cloneCount défini avec une vraie valeur : affiche le nombre', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ currentPlaylist: makePlaylist({ cloneCount: 42 }) })} />);
    expect(screen.getByTitle('Nombre de fois où cette playlist a été clonée')).toHaveTextContent('42');
  });

  it('cloneCount JAMAIS défini (undefined) : aucun compteur affiché', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ currentPlaylist: makePlaylist({ cloneCount: undefined })})} />);
    expect(screen.queryByTitle('Nombre de fois où cette playlist a été clonée')).not.toBeInTheDocument();
  });
});

describe('PlaylistHeaderTitleBlock — titre/description (édition fusionnée)', () => {
  it('le crayon (unique) n\'apparaît que si isSaved=true, cliquer préremplit les 2 brouillons et ouvre l\'édition combinée', () => {
    const setEditedPlaylistName = vi.fn();
    const setEditedPlaylistDescription = vi.fn();
    const setIsEditingPlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ setEditedPlaylistName, setEditedPlaylistDescription, setIsEditingPlaylistDetails }));
    render(<PlaylistHeaderTitleBlock {...baseProps({
      isSaved: true, currentPlaylist: makePlaylist({ description: 'Description existante' }),
    })} />);

    fireEvent.click(screen.getByTitle('Modifier le titre et la description'));

    expect(setEditedPlaylistName).toHaveBeenCalledWith('Ma Séance');
    expect(setEditedPlaylistDescription).toHaveBeenCalledWith('Description existante');
    expect(setIsEditingPlaylistDetails).toHaveBeenCalledWith(true);
  });

  it('pas de crayon quand isSaved=false', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: false })} />);
    expect(screen.queryByTitle('Modifier le titre et la description')).not.toBeInTheDocument();
  });

  it('pas de crayon quand isReadOnly=true, même si isSaved=true (défense en profondeur)', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, isReadOnly: true })} />);
    expect(screen.queryByTitle('Modifier le titre et la description')).not.toBeInTheDocument();
  });

  it('en édition combinée : Entrée dans le champ NOM valide (handleSavePlaylistDetails), Échap annule', () => {
    const handleSavePlaylistDetails = vi.fn();
    const setIsEditingPlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({
      isEditingPlaylistDetails: true, editedPlaylistName: 'Nouveau nom', handleSavePlaylistDetails, setIsEditingPlaylistDetails,
    }));
    render(<PlaylistHeaderTitleBlock {...baseProps()} />);

    const input = screen.getByDisplayValue('Nouveau nom');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleSavePlaylistDetails).toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(setIsEditingPlaylistDetails).toHaveBeenCalledWith(false);
  });

  it('en édition combinée : Échap dans le champ DESCRIPTION annule aussi (Entrée y insère juste un retour à la ligne, ne soumet rien)', () => {
    const handleSavePlaylistDetails = vi.fn();
    const setIsEditingPlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({
      isEditingPlaylistDetails: true, editedPlaylistDescription: 'Brouillon', handleSavePlaylistDetails, setIsEditingPlaylistDetails,
    }));
    render(<PlaylistHeaderTitleBlock {...baseProps()} />);

    const textarea = screen.getByPlaceholderText(/Ajoute une description/);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(handleSavePlaylistDetails).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(setIsEditingPlaylistDetails).toHaveBeenCalledWith(false);
  });

  it('en édition combinée : "Enregistrer" appelle handleSavePlaylistDetails, "Annuler" ferme sans l\'appeler', () => {
    const handleSavePlaylistDetails = vi.fn();
    const setIsEditingPlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({
      isEditingPlaylistDetails: true, editedPlaylistDescription: 'Brouillon', handleSavePlaylistDetails, setIsEditingPlaylistDetails,
    }));
    render(<PlaylistHeaderTitleBlock {...baseProps()} />);

    fireEvent.click(screen.getByText('Annuler'));
    expect(setIsEditingPlaylistDetails).toHaveBeenCalledWith(false);
    expect(handleSavePlaylistDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Enregistrer'));
    expect(handleSavePlaylistDetails).toHaveBeenCalled();
  });

  it('aucune invite "+ Ajouter une description" séparée n\'existe (retirée le 08/08, non-régression)', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    expect(screen.queryByText('+ Ajouter une description')).not.toBeInTheDocument();
  });

  it('affiche "Aucune description" (texte discret, non cliquable) quand isSaved=true et aucune description', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    const hint = screen.getByText('Aucune description');
    expect(hint.tagName).toBe('P');
    expect(hint.closest('button')).toBeNull();
  });

  it('"Aucune description" absent quand isSaved=false', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: false, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    expect(screen.queryByText('Aucune description')).not.toBeInTheDocument();
  });

  it('"Aucune description" absent pour un VISITEUR (isReadOnly) même sans description', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: false, isReadOnly: true, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    expect(screen.queryByText('Aucune description')).not.toBeInTheDocument();
  });

  it('"Aucune description" absent dès qu\'une vraie description existe', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, currentPlaylist: makePlaylist({ description: 'Une vraie description' }) })} />);
    expect(screen.queryByText('Aucune description')).not.toBeInTheDocument();
    expect(screen.getByText('Une vraie description')).toBeInTheDocument();
  });

  it('description : affichée en lecture seule pour un VISITEUR (isReadOnly), sans crayon', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({
      isSaved: false, isReadOnly: true, currentPlaylist: makePlaylist({ description: 'Une belle séance pour bien commencer la semaine' }),
    })} />);
    expect(screen.getByText('Une belle séance pour bien commencer la semaine')).toBeInTheDocument();
    expect(screen.queryByTitle('Modifier le titre et la description')).not.toBeInTheDocument();
  });
});
