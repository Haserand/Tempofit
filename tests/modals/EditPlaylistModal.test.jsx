// @vitest-environment jsdom
//
// Premier fichier de test pour EditPlaylistModal.jsx (nouveau — chantier
// "édition passée en modale", retour direct, captures à l'appui : "le mode
// édition inline crée un layout shift désagréable — remplacer par une
// modale dédiée, standardiser l'UX comme EditRoutineModal.jsx"). Sur le
// modèle d'EditRoutineModal.test.jsx (props réelles reprises directement de
// la signature du composant) — mais `usePlaylistEdit()` MOCKÉ ici (comme
// PlaylistHeaderTitleBlock.test.jsx), puisque ce composant lit tout son
// état via ce Contexte plutôt qu'en props (seule `theme` est une vraie
// prop).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/appConfig.js', () => ({
  MAX_DESCRIPTION_LENGTH: 150,
}));

// `vi.hoisted()` (voir AuthContext.test.jsx pour l'explication complète) —
// pattern déjà établi ailleurs dans ce projet pour ce cas précis.
const { mockUsePlaylistEdit } = vi.hoisted(() => ({ mockUsePlaylistEdit: vi.fn() }));
vi.mock('../../src/contexts/PlaylistEditContext.jsx', () => ({
  usePlaylistEdit: () => mockUsePlaylistEdit(),
}));

import EditPlaylistModal from '../../src/components/modals/EditPlaylistModal.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight',
  textColorClass: 'mock-accent', inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
  textMuted: 'mock-muted', bgAccentClass: 'mock-accent-bg',
};

function makeEditValue(overrides = {}) {
  return {
    isEditPlaylistModalOpen: true, closeEditPlaylistModal: vi.fn(),
    editedPlaylistName: 'Ma Séance', setEditedPlaylistName: vi.fn(),
    editedPlaylistDescription: '', setEditedPlaylistDescription: vi.fn(),
    handleSavePlaylistDetails: vi.fn(),
    ...overrides,
  };
}

describe('EditPlaylistModal — ouverture/fermeture', () => {
  it('ne rend RIEN quand isEditPlaylistModalOpen=false', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ isEditPlaylistModalOpen: false }));
    const { container } = render(<EditPlaylistModal theme={mockTheme} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le champ titre PRÉREMPLI avec editedPlaylistName quand ouverte', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ editedPlaylistName: 'Mon titre existant' }));
    render(<EditPlaylistModal theme={mockTheme} />);
    expect(screen.getByDisplayValue('Mon titre existant')).toBeInTheDocument();
  });

  it('le clic sur la croix appelle closeEditPlaylistModal', () => {
    const closeEditPlaylistModal = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ closeEditPlaylistModal }));
    const { container } = render(<EditPlaylistModal theme={mockTheme} />);

    // Bouton icône seule (X), pas de `title`/nom accessible (même
    // convention que EditRoutineModal.jsx) — sélectionné directement plutôt
    // que par un nom accessible vide, ambigu. C'est le PREMIER `<button>`
    // rendu (en-tête, avant les 2 boutons Annuler/Enregistrer du pied de
    // page).
    fireEvent.click(container.querySelectorAll('button')[0]);
    expect(closeEditPlaylistModal).toHaveBeenCalledTimes(1);
  });

  it('le clic sur le fond (overlay) appelle closeEditPlaylistModal, le clic DANS la carte ne l\'appelle PAS', () => {
    const closeEditPlaylistModal = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ closeEditPlaylistModal }));
    const { container } = render(<EditPlaylistModal theme={mockTheme} />);

    fireEvent.click(screen.getByText('Modifier la playlist')); // à l'intérieur de la carte
    expect(closeEditPlaylistModal).not.toHaveBeenCalled();

    fireEvent.click(container.firstChild); // l'overlay lui-même
    expect(closeEditPlaylistModal).toHaveBeenCalledTimes(1);
  });
});

describe('EditPlaylistModal — édition des champs', () => {
  it('taper dans le champ titre appelle setEditedPlaylistName', () => {
    const setEditedPlaylistName = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ setEditedPlaylistName }));
    render(<EditPlaylistModal theme={mockTheme} />);

    fireEvent.change(screen.getByDisplayValue('Ma Séance'), { target: { value: 'Nouveau titre' } });

    expect(setEditedPlaylistName).toHaveBeenCalledWith('Nouveau titre');
  });

  it('taper dans la description appelle setEditedPlaylistDescription, tronquée à MAX_DESCRIPTION_LENGTH', () => {
    const setEditedPlaylistDescription = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ setEditedPlaylistDescription }));
    render(<EditPlaylistModal theme={mockTheme} />);

    const tooLong = 'x'.repeat(200);
    fireEvent.change(screen.getByPlaceholderText(/Ajoute une description/), { target: { value: tooLong } });

    expect(setEditedPlaylistDescription).toHaveBeenCalledWith('x'.repeat(150));
  });

  it('affiche le compteur de caractères de la description (longueur actuelle/MAX)', () => {
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ editedPlaylistDescription: 'Douze lettres' }));
    render(<EditPlaylistModal theme={mockTheme} />);
    expect(screen.getByText('13/150')).toBeInTheDocument();
  });

  it('Entrée dans le champ TITRE appelle handleSavePlaylistDetails', () => {
    const handleSavePlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ handleSavePlaylistDetails }));
    render(<EditPlaylistModal theme={mockTheme} />);

    fireEvent.keyDown(screen.getByDisplayValue('Ma Séance'), { key: 'Enter' });

    expect(handleSavePlaylistDetails).toHaveBeenCalledTimes(1);
  });

  it('Entrée dans la DESCRIPTION n\'appelle PAS handleSavePlaylistDetails (retour à la ligne natif attendu)', () => {
    const handleSavePlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ handleSavePlaylistDetails }));
    render(<EditPlaylistModal theme={mockTheme} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/Ajoute une description/), { key: 'Enter' });

    expect(handleSavePlaylistDetails).not.toHaveBeenCalled();
  });
});

describe('EditPlaylistModal — Annuler / Enregistrer', () => {
  it('"Annuler" appelle closeEditPlaylistModal, jamais handleSavePlaylistDetails', () => {
    const closeEditPlaylistModal = vi.fn();
    const handleSavePlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ closeEditPlaylistModal, handleSavePlaylistDetails }));
    render(<EditPlaylistModal theme={mockTheme} />);

    fireEvent.click(screen.getByText('Annuler'));

    expect(closeEditPlaylistModal).toHaveBeenCalledTimes(1);
    expect(handleSavePlaylistDetails).not.toHaveBeenCalled();
  });

  it('"Enregistrer" appelle handleSavePlaylistDetails (qui ferme lui-même la modale, voir PlaylistEditContext.jsx)', () => {
    const handleSavePlaylistDetails = vi.fn();
    mockUsePlaylistEdit.mockReturnValue(makeEditValue({ handleSavePlaylistDetails }));
    render(<EditPlaylistModal theme={mockTheme} />);

    fireEvent.click(screen.getByText('Enregistrer'));

    expect(handleSavePlaylistDetails).toHaveBeenCalledTimes(1);
  });
});
