// @vitest-environment jsdom
//
// Test dédié à PlaylistEditContext.jsx — extrait de
// PlaylistDetailContext.test.jsx (08/08, découpage) : ces scénarios
// testaient déjà exactement ce périmètre via l'ancien Provider unique,
// simplement déplacés pour rendre `PlaylistEditProvider` directement.
// Setup BEAUCOUP plus simple qu'avant : plus besoin de mocker
// GeneratorContext/AudioPlayerContext/supabase (ce Contexte n'en dépend
// pas du tout, contrairement à PlaylistDetailContext.jsx).
//
// ⚠️ MIS À JOUR (08/08, 2e passe — "édition passée en modale") : ce
// Contexte pilote maintenant son ouverture via un vrai `ModalContext`
// (`isEditPlaylistModalOpen` dérivé de `activeModal === 'EDIT_PLAYLIST'`,
// même schéma que `useRoutines.js`/`EditRoutineModal.jsx`) — `renderWithProvider`
// enveloppe donc désormais avec un VRAI `<ModalProvider>` (pas juste
// `PlaylistEditProvider` seul comme avant), sans quoi `openModal`/
// `closeModal` seraient des no-op (repli hors Provider de ModalContext.jsx)
// et rendraient tout le cycle ouverture/fermeture impossible à observer.
//
// ⚠️ MIS À JOUR (08/08, 3e passe — validation du titre) : `editedPlaylistName`
// démarre à `''` (vide, `useState('')`) tant que `handleOpenEditPlaylistModal`
// ("open-edit" dans les tests) n'a pas été appelé pour le préremplir — et un
// titre vide est maintenant INVALIDE (`isEditedNameValid`), donc
// `handleSavePlaylistDetails` refuse de sauvegarder. TOUS les tests de
// sauvegarde ci-dessous appellent donc "open-edit" AVANT de modifier quoi
// que ce soit, pour préremplir un nom déjà valide (celui de la playlist) —
// exactement le déroulé réel de l'app (la modale ne s'ouvre jamais sans
// préremplissage).
//
// ⚠️ MIS À JOUR (10/08, check-up — découpage en 2 Contextes) : `usePlaylistEdit()`
// (volatil — inclut `editedPlaylistName`/`editedPlaylistDescription`, change
// à chaque frappe) et `usePlaylistEditActions()` (stable — uniquement
// `handleOpenEditPlaylistModal`) sont désormais 2 Contextes DISTINCTS, tous
// les deux fournis par le MÊME `<PlaylistEditProvider>`. `DetailsProbe`
// ci-dessous continue de lire `usePlaylistEdit()` pour tous les scénarios
// déjà couverts (rien ne change côté comportement/API de ce hook). Un
// nouveau describe en fin de fichier ("isolation actions vs draft") couvre
// spécifiquement la RAISON D'ÊTRE de ce découpage : un composant qui ne lit
// que `usePlaylistEditActions()` ne doit JAMAIS re-render pendant une
// frappe dans le brouillon — trou de couverture avant ce chantier (aucun
// test ne vérifiait la stabilité référentielle de ce Contexte).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MAX_DESCRIPTION_LENGTH } from '../../src/appConfig.js';
import { ModalProvider } from '../../src/contexts/ModalContext.jsx';
import { PlaylistEditProvider, usePlaylistEdit, usePlaylistEditActions } from '../../src/contexts/PlaylistEditContext.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makePlaylist(overrides = {}) {
  return { id: 'pl1', name: 'Ma séance', description: '', ...overrides };
}

// Même sonde que l'ancienne `DetailsProbe` (PlaylistDetailContext.test.jsx),
// + `handleOpenEditPlaylistModal`/`closeEditPlaylistModal`/`isEditedNameValid`
// (nouveaux) pour pouvoir observer/déclencher le cycle ouverture/fermeture
// et la validation.
function DetailsProbe() {
  const {
    editedPlaylistName, setEditedPlaylistName,
    editedPlaylistDescription, setEditedPlaylistDescription,
    handleOpenEditPlaylistModal, handleSavePlaylistDetails, closeEditPlaylistModal,
    isEditPlaylistModalOpen, isEditedNameValid,
  } = usePlaylistEdit();
  return (
    <div>
      <span data-testid="editing-state">{String(isEditPlaylistModalOpen)}</span>
      <span data-testid="name-valid-state">{String(isEditedNameValid)}</span>
      <input data-testid="name-draft-input" value={editedPlaylistName} onChange={(e) => setEditedPlaylistName(e.target.value)} />
      <input data-testid="draft-input" value={editedPlaylistDescription} onChange={(e) => setEditedPlaylistDescription(e.target.value)} />
      <button onClick={handleOpenEditPlaylistModal}>open-edit</button>
      <button onClick={handleSavePlaylistDetails}>save-details</button>
      <button onClick={closeEditPlaylistModal}>cancel-edit</button>
    </div>
  );
}

function renderWithProvider(currentPlaylist, savedPlaylists, { setCurrentPlaylist = vi.fn(), setSavedPlaylists = vi.fn() } = {}) {
  render(
    <ModalProvider>
      <PlaylistEditProvider
        currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
        savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
      >
        <DetailsProbe />
      </PlaylistEditProvider>
    </ModalProvider>
  );
}

// NOUVEAU (08/08, 2e passe) — "édition passée en modale" : le crayon
// n'ouvre plus un formulaire inline, il appelle ce point d'entrée unique,
// qui doit préremplir les 2 brouillons ET ouvrir la modale (via
// ModalContext) EN MÊME TEMPS, pas en 2 étapes séparées que l'appelant
// pourrait oublier.
describe('PlaylistEditContext — ouverture de la modale (handleOpenEditPlaylistModal, NOUVEAU 08/08)', () => {
  it('préremplit les 2 brouillons avec les valeurs ACTUELLES de la playlist', () => {
    const playlist = makePlaylist({ name: 'Mon titre', description: 'Ma description' });
    renderWithProvider(playlist, [playlist]);

    fireEvent.click(screen.getByText('open-edit'));

    expect(screen.getByTestId('name-draft-input').value).toBe('Mon titre');
    expect(screen.getByTestId('draft-input').value).toBe('Ma description');
  });

  it('ouvre bien la modale (isEditPlaylistModalOpen passe à true)', () => {
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist]);

    expect(screen.getByTestId('editing-state')).toHaveTextContent('false');
    fireEvent.click(screen.getByText('open-edit'));
    expect(screen.getByTestId('editing-state')).toHaveTextContent('true');
  });

  it('description absente (undefined) préremplit le brouillon avec une chaîne vide, pas "undefined"', () => {
    const playlist = { id: 'pl1', name: 'Sans description' };
    renderWithProvider(playlist, [playlist]);

    fireEvent.click(screen.getByText('open-edit'));

    expect(screen.getByTestId('draft-input').value).toBe('');
  });

  it('currentPlaylist absent (garde défensive) : n\'ouvre pas la modale, ne touche à aucun brouillon', () => {
    renderWithProvider(null, []);

    fireEvent.click(screen.getByText('open-edit'));

    expect(screen.getByTestId('editing-state')).toHaveTextContent('false');
  });
});

// NOUVEAU (08/08, 3e passe) — validation du titre : retour direct, captures
// à l'appui — "0 à 3 c'est invalide" pour le titre (jamais optionnel,
// contrairement à la description, qui elle reste valide quel que soit son
// contenu).
describe('PlaylistEditContext — validation du titre (isEditedNameValid, NOUVEAU 08/08)', () => {
  it('un titre de 3 caractères ou plus (après trim) est valide', () => {
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist]);
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'abc' } });

    expect(screen.getByTestId('name-valid-state')).toHaveTextContent('true');
  });

  it('0, 1 ou 2 caractères (après trim) sont invalides', () => {
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist]);
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: '' } });
    expect(screen.getByTestId('name-valid-state')).toHaveTextContent('false');

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'a' } });
    expect(screen.getByTestId('name-valid-state')).toHaveTextContent('false');

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'ab' } });
    expect(screen.getByTestId('name-valid-state')).toHaveTextContent('false');
  });

  it('les espaces ne comptent pas — "   " (3 espaces) reste invalide, pas contournable', () => {
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist]);
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: '   ' } });

    expect(screen.getByTestId('name-valid-state')).toHaveTextContent('false');
  });

  it('handleSavePlaylistDetails refuse de sauvegarder si le titre est invalide (défense en profondeur, même si le bouton "Enregistrer" est censé déjà être désactivé côté modale)', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist });
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).not.toHaveBeenCalled();
    // La modale reste OUVERTE (pas de closeModal() si la sauvegarde a été refusée).
    expect(screen.getByTestId('editing-state')).toHaveTextContent('true');
  });
});

// NOUVEAU (08/08, 2e passe) — fermeture SANS sauvegarder (bouton "Annuler"
// de EditPlaylistModal.jsx) : ne doit appeler AUCUN setter de playlist.
describe('PlaylistEditContext — fermeture sans sauvegarder (closeEditPlaylistModal)', () => {
  it('ferme la modale sans appeler setCurrentPlaylist/setSavedPlaylists', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.click(screen.getByText('open-edit'));
    expect(screen.getByTestId('editing-state')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('cancel-edit'));

    expect(screen.getByTestId('editing-state')).toHaveTextContent('false');
    expect(setCurrentPlaylist).not.toHaveBeenCalled();
    expect(setSavedPlaylists).not.toHaveBeenCalled();
  });
});

// Vague 2, Chantier 3 — "description texte libre sur une playlist
// publique" (02/08). FUSIONNÉ avec l'édition du nom le 08/08 (retour
// direct : "que modifier le titre ou la description vienne un seul
// crayon plutôt que via chacune une option individuelle") — un seul
// handler, `handleSavePlaylistDetails`, sauvegarde les DEUX champs
// ensemble. Comportement de SAUVEGARDE inchangé par le passage en modale
// (2e passe, 08/08) — seule l'OUVERTURE a changé, testée séparément
// ci-dessus. Chaque test ouvre d'abord la modale ("open-edit") pour
// préremplir un titre déjà valide (voir l'avertissement en tête de
// fichier), sauf mention contraire explicite.
describe('PlaylistEditContext — édition combinée titre+description (handleSavePlaylistDetails)', () => {
  it('met à jour currentPlaylist ET savedPlaylists avec la description éditée, en la découpant sur les espaces superflus', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ description: '' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });
    fireEvent.click(screen.getByText('open-edit'));

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
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'Nouveau nom' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Nouvelle description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledTimes(1);
    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nouveau nom', description: 'Nouvelle description' }));
  });

  // MIS À JOUR (08/08, 3e passe) — comportement CHANGÉ : un titre vidé (ou
  // trop court) ne replie PLUS silencieusement sur l'ancien nom, il BLOQUE
  // la sauvegarde entière (voir describe "validation du titre" plus haut).
  it('un titre vidé (chaîne vide après trim) BLOQUE la sauvegarde entière — même la description tapée à côté n\'est pas enregistrée', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist({ name: 'Nom original', description: '' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist });
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: '   ' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Une description quand même' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).not.toHaveBeenCalled();
  });

  it('accepte une description VIDE (contrairement au nom, effacer la description est un état valide)', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ description: 'Une description déjà présente' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: '' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ description: '' }));
  });

  // NOUVEAU (08/08, 3e passe) — confirmation explicite du retour :
  // "description : là peu importe ce qu'on met c'est valide" — même un
  // seul caractère, aucune contrainte de longueur minimale (contrairement
  // au titre).
  it('accepte une description d\'UN SEUL caractère (aucune contrainte de longueur minimale, contrairement au titre)', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist({ description: '' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist });
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ description: 'x' }));
  });

  it('tronque à MAX_DESCRIPTION_LENGTH même si le texte fourni est plus long (défense en profondeur, pas juste le `maxLength` du textarea)', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist({ description: '' });
    renderWithProvider(playlist, [playlist], { setCurrentPlaylist });
    fireEvent.click(screen.getByText('open-edit'));

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
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Ma propre description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ isModifiedSinceClone: true }));
  });

  it('éditer la description d\'une playlist SANS origine (jamais clonée) ne pose PAS isModifiedSinceClone — rien à marquer', () => {
    const setCurrentPlaylist = vi.fn();
    const ownPlaylist = makePlaylist({ description: '' });
    renderWithProvider(ownPlaylist, [ownPlaylist], { setCurrentPlaylist });
    fireEvent.click(screen.getByText('open-edit'));

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Ma description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist.mock.calls[0][0].isModifiedSinceClone).toBeUndefined();
  });

  it('currentPlaylist absent (garde défensive) : ferme juste la modale, n\'appelle aucun setter', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    renderWithProvider(null, [], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).not.toHaveBeenCalled();
    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(screen.getByTestId('editing-state')).toHaveTextContent('false');
  });

  // NOUVEAU (08/08, 2e passe) — "Une fois la sauvegarde réussie, la modale
  // se ferme" (exigence explicite du chantier "édition passée en modale").
  it('ferme la modale après une sauvegarde réussie', () => {
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist]);

    fireEvent.click(screen.getByText('open-edit'));
    expect(screen.getByTestId('editing-state')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('save-details'));

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
      const { isEditPlaylistModalOpen, handleSavePlaylistDetails } = usePlaylistEdit();
      return <span data-testid="bare">{String(isEditPlaylistModalOpen)}{typeof handleSavePlaylistDetails}</span>;
    }
    render(<Bare />);
    expect(screen.getByTestId('bare')).toHaveTextContent('falsefunction');
  });

  it('usePlaylistEditActions() hors Provider renvoie un repli inerte (pas de crash)', () => {
    function BareActions() {
      const { handleOpenEditPlaylistModal } = usePlaylistEditActions();
      return <span data-testid="bare-actions">{typeof handleOpenEditPlaylistModal}</span>;
    }
    render(<BareActions />);
    expect(screen.getByTestId('bare-actions')).toHaveTextContent('function');
  });
});

// NOUVEAU (10/08, check-up) — la vraie raison d'être du découpage en 2
// Contextes (voir la docstring de PlaylistEditContext.jsx, "⚠️ 2 CONTEXTES
// DISTINCTS ICI, PAS UN SEUL") : AVANT ce découpage, `usePlaylistEdit()`
// portait à la fois le brouillon volatil (`editedPlaylistName`/
// `editedPlaylistDescription`, change à chaque frappe) ET
// `handleOpenEditPlaylistModal` (utilisé par `PlaylistHeaderTitleBlock.jsx`,
// qui n'a besoin de rien d'autre) dans le MÊME objet `value` — un Contexte
// React re-rend TOUS ses consommateurs dès que N'IMPORTE QUEL champ de sa
// `value` change, donc `PlaylistHeaderTitleBlock.jsx` re-rendait à chaque
// frappe malgré ce qu'affirmait sa docstring à l'époque. Aucun test
// existant (ci-dessus) ne le vérifiait — trou de couverture comblé ici,
// avec un compteur de rendus réel plutôt qu'une simple relecture de code.
describe('PlaylistEditContext — stabilité référentielle (10/08, régression du re-render réintroduit puis corrigé)', () => {
  // Compte les rendus d'un composant qui ne lit QUE usePlaylistEditActions()
  // — doit rester à 1 (le rendu initial) même après plusieurs frappes dans
  // le brouillon, PUISQUE ce Contexte ne porte plus que
  // `handleOpenEditPlaylistModal`, stabilisée par useCallback + useMemo.
  function ActionsRenderProbe({ renderCountRef }) {
    renderCountRef.current += 1;
    const { handleOpenEditPlaylistModal } = usePlaylistEditActions();
    return <button onClick={handleOpenEditPlaylistModal}>open-edit-via-actions</button>;
  }

  // Contrôle négatif — un composant qui lit usePlaylistEdit() (le Contexte
  // VOLATIL) DOIT continuer à re-render à chaque frappe : sans ce contrôle,
  // un test qui se contenterait de vérifier "ActionsRenderProbe ne re-render
  // pas" pourrait passer à tort si le mécanisme de frappe lui-même était
  // cassé (aucune frappe n'atteignant plus aucun Contexte).
  function DraftRenderProbe({ renderCountRef }) {
    renderCountRef.current += 1;
    usePlaylistEdit();
    return null;
  }

  it('un composant qui ne lit que usePlaylistEditActions() NE re-render PAS pendant une frappe dans le brouillon', () => {
    const playlist = makePlaylist();
    const actionsRenderCount = { current: 0 };
    const draftRenderCount = { current: 0 };

    render(
      <ModalProvider>
        <PlaylistEditProvider
          currentPlaylist={playlist} setCurrentPlaylist={vi.fn()}
          savedPlaylists={[playlist]} setSavedPlaylists={vi.fn()}
        >
          <ActionsRenderProbe renderCountRef={actionsRenderCount} />
          <DraftRenderProbe renderCountRef={draftRenderCount} />
          <DetailsProbe />
        </PlaylistEditProvider>
      </ModalProvider>
    );

    const actionsRendersAtStart = actionsRenderCount.current;
    const draftRendersAtStart = draftRenderCount.current;
    expect(actionsRendersAtStart).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('open-edit'));
    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'a' } });
    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Nouvelle description' } });

    // Contrôle : le Contexte volatil, lui, a bien re-rendu à chaque frappe
    // (la mécanique de frappe fonctionne normalement) — sinon le test
    // ci-dessous ne prouverait rien.
    expect(draftRenderCount.current).toBeGreaterThan(draftRendersAtStart);

    // La vraie assertion : le composant qui ne lit QUE le Contexte stable
    // n'a subi AUCUN rendu supplémentaire, malgré 4 frappes + une ouverture
    // de modale dans le même arbre.
    expect(actionsRenderCount.current).toBe(actionsRendersAtStart);
  });

  it('handleOpenEditPlaylistModal garde EXACTEMENT la même référence entre deux rendus déclenchés par une frappe ailleurs', () => {
    const playlist = makePlaylist();
    const seenRefs = [];

    function RefCapturingProbe() {
      const { handleOpenEditPlaylistModal } = usePlaylistEditActions();
      seenRefs.push(handleOpenEditPlaylistModal);
      return null;
    }

    render(
      <ModalProvider>
        <PlaylistEditProvider
          currentPlaylist={playlist} setCurrentPlaylist={vi.fn()}
          savedPlaylists={[playlist]} setSavedPlaylists={vi.fn()}
        >
          <RefCapturingProbe />
          <DetailsProbe />
        </PlaylistEditProvider>
      </ModalProvider>
    );

    fireEvent.click(screen.getByText('open-edit'));
    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'Nouveau titre' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Nouvelle description' } });

    // RefCapturingProbe n'a été rendu qu'une fois (voir le test précédent) —
    // une seule référence collectée, donc rien à comparer entre plusieurs
    // valeurs. On vérifie ici plutôt qu'elle reste bien une fonction valide
    // et que le Provider n'a jamais eu besoin de la recréer pour que ce test
    // passe (si ActionsRenderProbe avait re-rendu, `seenRefs.length` serait
    // > 1 et pourrait alors différer d'un élément à l'autre).
    expect(seenRefs.length).toBe(1);
    expect(typeof seenRefs[0]).toBe('function');
  });
});
