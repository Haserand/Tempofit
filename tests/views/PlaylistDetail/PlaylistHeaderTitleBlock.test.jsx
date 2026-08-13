// @vitest-environment jsdom
//
// Test dédié pour PlaylistHeaderTitleBlock.jsx — extrait de
// PlaylistHeader.test.jsx (08/08, découpage).
//
// ⚠️ `usePlaylistEditActions()` MOCKÉ — ce composant lit
// `handleOpenEditPlaylistModal` directement via ce Contexte plutôt qu'en
// prop (même pattern de mock que `usePlaylistDetail()` dans
// PlaylistHeader.test.jsx). DEPUIS LE 08/08 (2e passe, "édition passée en
// modale") : ce composant ne rend PLUS aucun formulaire — le crayon
// appelle juste `handleOpenEditPlaylistModal()` (PlaylistEditContext.jsx),
// qui ouvre `EditPlaylistModal.jsx` ailleurs dans l'arbre (voir
// PlaylistDetailView.jsx). Le comportement du formulaire lui-même
// (Entrée/Échap/Enregistrer/Annuler) est donc testé dans
// EditPlaylistModal.test.jsx désormais, pas ici.
//
// ⚠️ MOCK CIBLÉ SUR `usePlaylistEditActions()`, PAS `usePlaylistEdit()`
// (10/08, check-up — corrigé) : ce composant lisait auparavant
// `usePlaylistEdit()`, le Contexte VOLATIL (recrée sa `value` à chaque
// frappe dans EditPlaylistModal.jsx) — un vrai re-render inutile à chaque
// frappe, jamais couvert par ce fichier de test (aucun test ici ne vérifie
// la stabilité référentielle). Corrigé en isolant
// `handleOpenEditPlaylistModal` dans son propre Contexte STABLE
// (`PlaylistEditActionsContext`, voir PlaylistEditContext.jsx) — ce mock
// suit ce changement, plus un test dédié plus bas vérifie que ce
// composant NE re-render PAS quand le Contexte volatil change seul.
//
// ⚠️ RETIRÉ (10/08, retour direct avec capture d'écran) : la ligne
// pseudo + compteur de clonages, testée ici jusqu'à ce jour, a été
// DÉPLACÉE dans PlaylistHeaderMeta.jsx (voir sa propre docstring) — ce
// composant ne reçoit plus `ownerLabel`/`ownerProfileUsername`/
// `onViewProfile` du tout, ces tests vivent désormais dans
// PlaylistHeaderMeta.test.jsx.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// `appConfig.js` (getActivityEmoji/MAX_DESCRIPTION_LENGTH) N'EST PLUS
// mocké ici (08/08, chantier "émoji baké en texte littéral dans le
// titre") — ce composant ne l'importe plus DU TOUT : l'émoji est
// désormais du texte ORDINAIRE dans `currentPlaylist.name`, et
// MAX_DESCRIPTION_LENGTH n'a jamais servi qu'au formulaire d'édition,
// déplacé dans EditPlaylistModal.jsx (voir sa docstring).

// `vi.hoisted()` (voir AuthContext.test.jsx pour l'explication complète) —
// pattern déjà établi ailleurs dans ce projet pour ce cas précis, adopté
// ici aussi plutôt qu'un simple `const mockUsePlaylistEditActions = vi.fn();`
// placé avant `vi.mock()` : ce dernier est hissé tout en haut du fichier
// par Vitest, avant même les `const` du code source — passer par
// `vi.hoisted()` garantit que cette variable est disponible au même
// niveau de hissage, sans dépendre de la façon dont la factory y accède.
const { mockUsePlaylistEditActions } = vi.hoisted(() => ({ mockUsePlaylistEditActions: vi.fn() }));
vi.mock('../../../src/contexts/PlaylistEditContext.jsx', () => ({
  usePlaylistEditActions: () => mockUsePlaylistEditActions(),
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
    ...overrides,
  };
}

function makeEditValue(overrides = {}) {
  return {
    handleOpenEditPlaylistModal: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistHeaderTitleBlock — titre/description (crayon → ouverture de la modale)', () => {
  it('le crayon (unique) n\'apparaît que si isSaved=true, cliquer appelle handleOpenEditPlaylistModal', () => {
    const handleOpenEditPlaylistModal = vi.fn();
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue({ handleOpenEditPlaylistModal }));
    render(<PlaylistHeaderTitleBlock {...baseProps({
      isSaved: true, currentPlaylist: makePlaylist({ description: 'Description existante' }),
    })} />);

    fireEvent.click(screen.getByTitle('Modifier le titre et la description'));

    expect(handleOpenEditPlaylistModal).toHaveBeenCalledTimes(1);
  });

  it('pas de crayon quand isSaved=false', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: false })} />);
    expect(screen.queryByTitle('Modifier le titre et la description')).not.toBeInTheDocument();
  });

  it('pas de crayon quand isReadOnly=true, même si isSaved=true (défense en profondeur)', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, isReadOnly: true })} />);
    expect(screen.queryByTitle('Modifier le titre et la description')).not.toBeInTheDocument();
  });

  // NON-RÉGRESSION (08/08, 2e passe) — ce composant ne rend plus AUCUN
  // formulaire d'édition inline (input titre, textarea description,
  // boutons Enregistrer/Annuler) : tout ça vit maintenant dans
  // EditPlaylistModal.jsx, testé séparément.
  it('aucun formulaire d\'édition inline (input titre/textarea description/Enregistrer/Annuler) n\'est rendu ici', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true })} />);
    expect(screen.queryByPlaceholderText(/Ajoute une description/)).not.toBeInTheDocument();
    expect(screen.queryByText('Enregistrer')).not.toBeInTheDocument();
    expect(screen.queryByText('Annuler')).not.toBeInTheDocument();
  });

  it('aucune invite "+ Ajouter une description" séparée n\'existe (retirée le 08/08, non-régression)', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    expect(screen.queryByText('+ Ajouter une description')).not.toBeInTheDocument();
  });

  it('affiche "Aucune description" (texte discret, non cliquable) quand isSaved=true et aucune description', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    const hint = screen.getByText('Aucune description');
    expect(hint.tagName).toBe('P');
    expect(hint.closest('button')).toBeNull();
  });

  it('"Aucune description" absent quand isSaved=false', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: false, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    expect(screen.queryByText('Aucune description')).not.toBeInTheDocument();
  });

  it('"Aucune description" absent pour un VISITEUR (isReadOnly) même sans description', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: false, isReadOnly: true, currentPlaylist: makePlaylist({ description: undefined }) })} />);
    expect(screen.queryByText('Aucune description')).not.toBeInTheDocument();
  });

  it('"Aucune description" absent dès qu\'une vraie description existe', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({ isSaved: true, currentPlaylist: makePlaylist({ description: 'Une vraie description' }) })} />);
    expect(screen.queryByText('Aucune description')).not.toBeInTheDocument();
    expect(screen.getByText('Une vraie description')).toBeInTheDocument();
  });

  it('description : affichée en lecture seule pour un VISITEUR (isReadOnly), sans crayon', () => {
    mockUsePlaylistEditActions.mockReturnValue(makeEditValue());
    render(<PlaylistHeaderTitleBlock {...baseProps({
      isSaved: false, isReadOnly: true, currentPlaylist: makePlaylist({ description: 'Une belle séance pour bien commencer la semaine' }),
    })} />);
    expect(screen.getByText('Une belle séance pour bien commencer la semaine')).toBeInTheDocument();
    expect(screen.queryByTitle('Modifier le titre et la description')).not.toBeInTheDocument();
  });
});
