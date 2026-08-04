// @vitest-environment jsdom
//
// Palier 3 (29/07, 3/11) — FavoritesView. `ModalContext` (pour `openModal`)
// est mocké via `vi.mock`, comme pour RoutinesView. `musicCatalog.js` est
// AUSSI mocké : ses fonctions (`getGenresForDisplay`, `genreDisplayLabel`,
// `getGenreLocalDepthWarning`) sont déjà couvertes par
// `tests/musicCatalog.test.js` (fonctions pures) — les re-tester ici via
// leurs vraies implémentations coupleraient inutilement ce test de
// composant à des données de catalogue réelles.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockOpenModal = vi.fn();
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ openModal: mockOpenModal, activeModal: null, modalData: null, closeModal: vi.fn() }),
}));

vi.mock('../../src/musicCatalog.js', () => ({
  getGenreLocalDepthWarning: vi.fn(() => null),
  getGenresForDisplay: vi.fn((genre) => [genre]),
  genreDisplayLabel: vi.fn((genre) => genre),
  EXTRA_GENRES: ['Techno', 'Jazz'],
  // 04/08 — GENRE_SEARCH_DEPTH_HINT extraite ici (constante partagée avec
  // GeneratorWizard.jsx, voir sa docstring dans musicCatalog.js). Mock
  // statique, pas un vi.fn() : c'est une simple chaîne dans le vrai module.
  GENRE_SEARCH_DEPTH_HINT: 'mock genre search depth hint',
}));

import FavoritesView from '../../src/components/views/FavoritesView.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-text-color',
  bgAccentClass: 'mock-accent-bg',
  borderAccentClass: 'mock-border-accent',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
};

const trackA = { id: 't1', trackId: 't1', title: 'Mr. Brightside', artist: 'The Killers', bpm: 148, preview: 'url-a' };
const trackB = { id: 't2', trackId: 't2', title: 'Thunderstruck', artist: 'AC/DC', bpm: 133, preview: null };

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isNaughtyMode: false,
    favorites: { tracks: [trackA, trackB], artists: ['The Killers', 'AC/DC'] },
    setFavorites: vi.fn(),
    togglePreview: vi.fn(),
    playingPreviewId: null,
    resolveAndPlay: vi.fn(() => Promise.resolve(null)),
    resolvingTrackId: null,
    setCurrentPlaylist: vi.fn(),
    setIsBpmSearchMode: vi.fn(),
    setWorldSearchResults: vi.fn(),
    setNoUsableResultsHint: vi.fn(),
    isAddingArtist: false,
    setIsAddingArtist: vi.fn(),
    newFavArtist: '',
    setNewFavArtist: vi.fn(),
    addFavoriteArtistValidated: vi.fn(),
    availableGenres: ['Rock', 'Pop'],
    favSelectedGenres: ['Rock'],
    setFavSelectedGenres: vi.fn(),
    showExtraGenres: false,
    setShowExtraGenres: vi.fn(),
    favBpmTarget: 140,
    setFavBpmTarget: vi.fn(),
    favBpmTolerance: 5,
    setFavBpmTolerance: vi.fn(),
    searchTracksByBpm: vi.fn(),
    changeView: vi.fn(),
    ...overrides,
  };
}

describe('FavoritesView', () => {
  it('affiche les titres et artistes favoris', () => {
    render(<FavoritesView {...baseProps()} />);
    expect(screen.getByText('Mr. Brightside')).toBeInTheDocument();
    expect(screen.getByText('Thunderstruck')).toBeInTheDocument();
    // "The Killers" et "AC/DC" apparaissent chacun 2 fois (ligne artiste du
    // titre + chip artiste favori) puisque les 2 artistes ont à la fois un
    // titre ET un chip dans ce jeu de données de test — pas d'assertion
    // getByText simple possible sur ces deux noms.
    expect(screen.getAllByText('The Killers').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('AC/DC').length).toBeGreaterThanOrEqual(2);
  });

  it('le clic sur play d\'un titre AVEC preview appelle togglePreview directement (pas resolveAndPlay)', () => {
    const togglePreview = vi.fn();
    const resolveAndPlay = vi.fn();
    render(<FavoritesView {...baseProps({ togglePreview, resolveAndPlay })} />);

    fireEvent.click(screen.getAllByTitle('Écouter un extrait')[0]); // trackA, a un preview

    expect(togglePreview).toHaveBeenCalledWith(trackA);
    expect(resolveAndPlay).not.toHaveBeenCalled();
  });

  it('le clic sur play d\'un titre SANS preview appelle resolveAndPlay puis met à jour favorites', async () => {
    const setFavorites = vi.fn();
    const resolvedTrack = { ...trackB, trackId: 'deezer-99', preview: 'resolved-url' };
    const resolveAndPlay = vi.fn(() => Promise.resolve(resolvedTrack));
    render(<FavoritesView {...baseProps({ resolveAndPlay, setFavorites })} />);

    fireEvent.click(screen.getAllByTitle('Écouter un extrait')[1]); // trackB, pas de preview
    await Promise.resolve(); // laisse le await interne se résoudre

    expect(resolveAndPlay).toHaveBeenCalledWith(trackB);
    expect(setFavorites).toHaveBeenCalledWith(expect.any(Function));
    // Vérifie que la fonction passée à setFavorites remplace bien le bon titre
    const updater = setFavorites.mock.calls[0][0];
    const result = updater({ tracks: [trackA, trackB], artists: [] });
    expect(result.tracks).toEqual([trackA, resolvedTrack]);
  });

  it('le clic sur X d\'un titre favori le retire de favorites.tracks', () => {
    const setFavorites = vi.fn();
    render(<FavoritesView {...baseProps({ setFavorites })} />);

    const trackRow = screen.getByText('Mr. Brightside').closest('div.flex.items-center.gap-2');
    fireEvent.click(trackRow.querySelector('button:last-child'));

    const updater = setFavorites.mock.calls[0][0];
    const result = updater({ tracks: [trackA, trackB], artists: [] });
    expect(result.tracks).toEqual([trackB]);
  });

  it('le clic sur "Ajouter un titre" réinitialise la playlist courante et ouvre SEARCH (mode normal)', () => {
    const setCurrentPlaylist = vi.fn();
    const setIsBpmSearchMode = vi.fn();
    render(<FavoritesView {...baseProps({ setCurrentPlaylist, setIsBpmSearchMode })} />);

    fireEvent.click(screen.getByText('Ajouter un titre'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(null);
    expect(setIsBpmSearchMode).toHaveBeenCalledWith(false);
    expect(mockOpenModal).toHaveBeenCalledWith('SEARCH');
  });

  it('le clic sur X d\'un artiste le retire de favorites.artists', () => {
    const setFavorites = vi.fn();
    render(<FavoritesView {...baseProps({ setFavorites })} />);

    // "The Killers" est ambigu (apparaît aussi dans la ligne artiste du
    // titre favori) — le chip artiste est directement le <span> renvoyé
    // (le texte est un enfant direct du span, pas besoin de .closest ici),
    // repérable par son tagName parmi les 2 correspondances.
    const artistChip = screen.getAllByText('The Killers').find(el => el.tagName === 'SPAN');
    fireEvent.click(artistChip.querySelector('button'));

    const updater = setFavorites.mock.calls[0][0];
    const result = updater({ tracks: [], artists: ['The Killers', 'AC/DC'] });
    expect(result.artists).toEqual(['AC/DC']);
  });

  it('le clic sur le bouton "+" (ajouter un artiste) appelle setIsAddingArtist(true)', () => {
    const setIsAddingArtist = vi.fn();
    render(<FavoritesView {...baseProps({ setIsAddingArtist })} />);

    fireEvent.click(screen.getByTitle('Ajouter un artiste'));

    expect(setIsAddingArtist).toHaveBeenCalledWith(true);
  });

  it('quand isAddingArtist=true, Entrée dans le champ appelle addFavoriteArtistValidated', () => {
    const addFavoriteArtistValidated = vi.fn();
    render(<FavoritesView {...baseProps({ isAddingArtist: true, newFavArtist: 'Daft Punk', addFavoriteArtistValidated })} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Nom de l\'artiste...'), { key: 'Enter' });

    expect(addFavoriteArtistValidated).toHaveBeenCalledWith('Daft Punk');
  });

  it('quand isAddingArtist=true, Échap vide le champ et ferme la saisie', () => {
    const setNewFavArtist = vi.fn();
    const setIsAddingArtist = vi.fn();
    render(<FavoritesView {...baseProps({ isAddingArtist: true, newFavArtist: 'Daft', setNewFavArtist, setIsAddingArtist })} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Nom de l\'artiste...'), { key: 'Escape' });

    expect(setNewFavArtist).toHaveBeenCalledWith('');
    expect(setIsAddingArtist).toHaveBeenCalledWith(false);
  });

  it('cliquer sur un genre non sélectionné l\'ajoute à favSelectedGenres', () => {
    const setFavSelectedGenres = vi.fn();
    render(<FavoritesView {...baseProps({ favSelectedGenres: ['Rock'], setFavSelectedGenres })} />);

    fireEvent.click(screen.getByText('Pop'));

    expect(setFavSelectedGenres).toHaveBeenCalledWith(['Rock', 'Pop']);
  });

  it('cliquer sur le dernier genre sélectionné le retire (aucune garde à 1 minimum)', () => {
    const setFavSelectedGenres = vi.fn();
    render(<FavoritesView {...baseProps({ favSelectedGenres: ['Rock'], setFavSelectedGenres })} />);

    fireEvent.click(screen.getByText('Rock'));

    expect(setFavSelectedGenres).toHaveBeenCalledWith([]);
  });

  it('affiche le message "Aucun genre sélectionné" quand favSelectedGenres est vide', () => {
    render(<FavoritesView {...baseProps({ favSelectedGenres: [] })} />);
    expect(screen.getByText(/Aucun genre sélectionné/)).toBeInTheDocument();
  });

  it('le bouton "+ Plus de genres" n\'apparaît qu\'en mode normal, pas en Mode Intime', () => {
    const { rerender } = render(<FavoritesView {...baseProps({ isNaughtyMode: false })} />);
    expect(screen.getByText('+ Plus de genres')).toBeInTheDocument();

    rerender(<FavoritesView {...baseProps({ isNaughtyMode: true })} />);
    expect(screen.queryByText('+ Plus de genres')).not.toBeInTheDocument();
  });

  it('déplacer le curseur BPM cible appelle setFavBpmTarget avec un nombre', () => {
    const setFavBpmTarget = vi.fn();
    const { container } = render(<FavoritesView {...baseProps({ setFavBpmTarget })} />);
    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[0], { target: { value: '160' } });
    expect(setFavBpmTarget).toHaveBeenCalledWith(160);
  });

  it('le clic sur "Chercher des titres à X BPM" enchaîne tous les setters puis la recherche', () => {
    const setCurrentPlaylist = vi.fn();
    const setIsBpmSearchMode = vi.fn();
    const setWorldSearchResults = vi.fn();
    const setNoUsableResultsHint = vi.fn();
    const searchTracksByBpm = vi.fn();
    render(
      <FavoritesView
        {...baseProps({
          setCurrentPlaylist, setIsBpmSearchMode, setWorldSearchResults, setNoUsableResultsHint, searchTracksByBpm,
          favBpmTarget: 140, favBpmTolerance: 5, favSelectedGenres: ['Rock'],
        })}
      />
    );

    fireEvent.click(screen.getByText('Chercher des titres à 140 BPM'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(null);
    expect(setIsBpmSearchMode).toHaveBeenCalledWith(true);
    expect(setWorldSearchResults).toHaveBeenCalledWith([]);
    expect(setNoUsableResultsHint).toHaveBeenCalledWith(false);
    expect(mockOpenModal).toHaveBeenCalledWith('SEARCH');
    expect(searchTracksByBpm).toHaveBeenCalledWith(140, 5, ['Rock']);
  });

  it('le clic sur "Synchroniser mes comptes" appelle changeView("settings")', () => {
    const changeView = vi.fn();
    render(<FavoritesView {...baseProps({ changeView })} />);
    fireEvent.click(screen.getByText('Synchroniser mes comptes →'));
    expect(changeView).toHaveBeenCalledWith('settings');
  });
});
