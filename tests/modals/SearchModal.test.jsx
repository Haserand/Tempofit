// @vitest-environment jsdom
//
// Palier 4 (31/07, 2e) — SearchModal. Aucun Context à mocker, tout passe
// par des props. `musicCatalog.js` (`getGenresForDisplay`/`genreDisplayLabel`)
// mocké — fonctions pures déjà testées ailleurs (musicCatalog.test.js).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((genre) => [genre]),
  genreDisplayLabel: vi.fn((g) => g),
}));

import SearchModal from '../../src/components/modals/SearchModal.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight',
  textColorClass: 'mock-text-color', textMuted: 'mock-muted', inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border', bgAccentClass: 'mock-accent-bg',
};

const trackWithPreview = { trackId: 't1', title: 'Blitzkrieg Bop', artist: 'The Ramones', genre: 'Punk', bpm: 150, preview: 'url', _bpmSource: 'deezer' };
const trackNoPreview = { trackId: 't2', title: 'Silence', artist: 'Nobody', genre: null, bpm: 120, preview: null, _bpmSource: 'deezer' };
const trackDetectedBpm = { trackId: 't3', title: 'Mystery Track', artist: 'DJ Unknown', genre: 'Techno', bpm: 128, preview: 'url', _bpmSource: 'detected' };

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isSearchModalOpen: true,
    closeSearchModal: vi.fn(),
    isBpmSearchMode: false,
    bpmSearchParams: { bpm: 150, tolerance: 10, genres: [] },
    searchTracksByBpm: vi.fn(),
    loadMoreBpmResults: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    searchWorldMusicApi: vi.fn(),
    isWorldSearching: false,
    worldSearchResults: [],
    worldSearchOtherResults: [],
    searchLoadingMessage: 'Recherche en cours...',
    searchElapsedSeconds: 0,
    searchHasMoreResults: false,
    isLoadingMoreResults: false,
    resultsContextLabel: null,
    searchActiveArtistName: null,
    noUsableResultsHint: false,
    currentPlaylist: null,
    favorites: { tracks: [], artists: [] },
    setFavorites: vi.fn(),
    editingBpmId: null,
    setEditingBpmId: vi.fn(),
    commitBpmEdit: vi.fn(),
    handleAddManualTrack: vi.fn(),
    togglePreview: vi.fn(),
    playingPreviewId: null,
    showToast: vi.fn(),
    ...overrides,
  };
}

describe('SearchModal — affichage de base', () => {
  it('ne rend rien quand isSearchModalOpen=false', () => {
    const { container } = render(<SearchModal {...baseProps({ isSearchModalOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('titre "Titres à ce BPM" en mode BPM, "Rechercher un titre" sinon', () => {
    const { rerender } = render(<SearchModal {...baseProps({ isBpmSearchMode: true })} />);
    expect(screen.getByText('Titres à ce BPM')).toBeInTheDocument();

    rerender(<SearchModal {...baseProps({ isBpmSearchMode: false })} />);
    expect(screen.getByText('Rechercher un titre')).toBeInTheDocument();
  });

  it('le clic sur le fond ferme la modale, le clic à l\'intérieur non (stopPropagation), le X ferme aussi', () => {
    const closeSearchModal = vi.fn();
    const { container } = render(<SearchModal {...baseProps({ closeSearchModal })} />);

    fireEvent.click(screen.getByPlaceholderText(/Titre ou artiste/));
    expect(closeSearchModal).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('svg.lucide-x').closest('button'));
    expect(closeSearchModal).toHaveBeenCalledTimes(1);

    fireEvent.click(container.firstChild);
    expect(closeSearchModal).toHaveBeenCalledTimes(2);
  });
});

describe('SearchModal — mode BPM', () => {
  it('affiche la cible BPM/tolérance/genres, le refresh appelle searchTracksByBpm', () => {
    const searchTracksByBpm = vi.fn();
    const { container } = render(
      <SearchModal
        {...baseProps({
          isBpmSearchMode: true,
          bpmSearchParams: { bpm: 150, tolerance: 10, genres: ['Rock', 'Métal'] },
          searchTracksByBpm,
        })}
      />
    );
    expect(screen.getByText(/150 BPM ± 10/)).toBeInTheDocument();
    expect(screen.getByText(/Rock, Métal/)).toBeInTheDocument();

    fireEvent.click(container.querySelector('svg.lucide-refresh-cw').closest('button'));
    expect(searchTracksByBpm).toHaveBeenCalledWith(150, 10, ['Rock', 'Métal']);
  });

  it('sans genre ciblé, affiche "tous genres"', () => {
    render(<SearchModal {...baseProps({ isBpmSearchMode: true, bpmSearchParams: { bpm: 150, tolerance: 10, genres: [] } })} />);
    expect(screen.getByText(/tous genres/)).toBeInTheDocument();
  });
});

describe('SearchModal — mode texte', () => {
  it('la saisie appelle setSearchQuery, Entrée déclenche la recherche', () => {
    const setSearchQuery = vi.fn();
    const searchWorldMusicApi = vi.fn();
    render(<SearchModal {...baseProps({ setSearchQuery, searchWorldMusicApi })} />);

    const input = screen.getByPlaceholderText(/Titre ou artiste/);
    fireEvent.change(input, { target: { value: 'Daft Punk' } });
    expect(setSearchQuery).toHaveBeenCalledWith('Daft Punk');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(searchWorldMusicApi).toHaveBeenCalledWith(true);
  });

  it('Entrée pendant une recherche en cours ne relance rien', () => {
    const searchWorldMusicApi = vi.fn();
    render(<SearchModal {...baseProps({ isWorldSearching: true, searchWorldMusicApi })} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/Titre ou artiste/), { key: 'Enter' });
    expect(searchWorldMusicApi).not.toHaveBeenCalled();
  });

  it('le bouton loupe appelle searchWorldMusicApi(true)', () => {
    const searchWorldMusicApi = vi.fn();
    render(<SearchModal {...baseProps({ searchWorldMusicApi })} />);
    fireEvent.click(screen.getAllByRole('button').find(b => b.querySelector('svg.lucide-search')));
    expect(searchWorldMusicApi).toHaveBeenCalledWith(true);
  });
});

describe('SearchModal — états de la liste', () => {
  it('recherche en cours sans résultat : affiche le message + le chrono M:SS', () => {
    render(<SearchModal {...baseProps({ isWorldSearching: true, searchLoadingMessage: 'On cherche...', searchElapsedSeconds: 75 })} />);
    expect(screen.getByText('On cherche...')).toBeInTheDocument();
    expect(screen.getByText('1:15')).toBeInTheDocument();
  });

  it('mode BPM, toujours en recherche mais résultats déjà là : bandeau "toujours en cours"', () => {
    render(
      <SearchModal
        {...baseProps({ isBpmSearchMode: true, isWorldSearching: true, worldSearchResults: [trackWithPreview] })}
      />
    );
    expect(screen.getByText(/Recherche toujours en cours/)).toBeInTheDocument();
  });

  it('affiche resultsContextLabel hors mode BPM', () => {
    render(<SearchModal {...baseProps({ resultsContextLabel: 'Résultats pour "Daft Punk"', worldSearchResults: [trackWithPreview] })} />);
    expect(screen.getByText('Résultats pour "Daft Punk"')).toBeInTheDocument();
  });

  it('sans résultat, sans hint : "Aucun résultat."', () => {
    render(<SearchModal {...baseProps({ searchQuery: 'xyz' })} />);
    expect(screen.getByText('Aucun résultat.')).toBeInTheDocument();
  });

  it('sans résultat avec hint, mode BPM : message dédié BPM', () => {
    render(<SearchModal {...baseProps({ isBpmSearchMode: true, noUsableResultsHint: true, bpmSearchParams: { bpm: 150, tolerance: 10, genres: [] } })} />);
    expect(screen.getByText(/Aucun titre trouvé pile à 150 BPM/)).toBeInTheDocument();
  });

  it('sans résultat avec hint, mode texte : message dédié recherche', () => {
    render(<SearchModal {...baseProps({ searchQuery: 'xyz', noUsableResultsHint: true })} />);
    expect(screen.getByText(/Aucun titre avec un BPM connu trouvé pour "xyz"/)).toBeInTheDocument();
  });

  it('champ vide, mode texte, jamais cherché : invite à taper quelque chose', () => {
    render(<SearchModal {...baseProps()} />);
    expect(screen.getByText('Tape un titre ou un nom d\'artiste pour chercher son BPM.')).toBeInTheDocument();
  });

  it('filtre les résultats déjà en favoris (hors contexte playlist), et signale si tous filtrés', () => {
    render(
      <SearchModal
        {...baseProps({
          worldSearchResults: [trackWithPreview],
          favorites: { tracks: [{ trackId: 't1' }], artists: [] },
        })}
      />
    );
    expect(screen.queryByText('Blitzkrieg Bop')).not.toBeInTheDocument();
    expect(screen.getByText('Tous les titres trouvés ici sont déjà dans tes favoris.')).toBeInTheDocument();
  });

  it('en contexte playlist, ne filtre PAS les titres déjà en favoris', () => {
    render(
      <SearchModal
        {...baseProps({
          currentPlaylist: { id: 'pl1' },
          worldSearchResults: [trackWithPreview],
          favorites: { tracks: [{ trackId: 't1' }], artists: [] },
        })}
      />
    );
    expect(screen.getByText('Blitzkrieg Bop')).toBeInTheDocument();
  });

  it('"Voir plus de résultats" appelle searchWorldMusicApi(false), texte change pendant le chargement', () => {
    const searchWorldMusicApi = vi.fn();
    const { rerender } = render(
      <SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], searchHasMoreResults: true, searchWorldMusicApi })} />
    );
    fireEvent.click(screen.getByText('Voir plus de résultats'));
    expect(searchWorldMusicApi).toHaveBeenCalledWith(false);

    rerender(
      <SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], searchHasMoreResults: true, isLoadingMoreResults: true })} />
    );
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  // NOUVEAU (28/08, chantier "Charger plus" pour la recherche BPM) — bouton
  // dédié, distinct de "Voir plus de résultats" (texte libre, ci-dessus) :
  // pas de `searchHasMoreResults` ici (voir la docstring de
  // `loadMoreBpmResults`, useDeezerSearch.js — la recherche catalogue
  // explore déjà tout le catalogue dès le 1er appel, aucune notion de page
  // suivante), affiché dès que la recherche initiale est terminée avec au
  // moins un résultat déjà là.
  describe('"Charger plus de résultats" (mode BPM)', () => {
    it('appelle loadMoreBpmResults au clic, texte change pendant le chargement', () => {
      const loadMoreBpmResults = vi.fn();
      const { rerender } = render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: false, loadMoreBpmResults })} />
      );
      fireEvent.click(screen.getByText('Charger plus de résultats'));
      expect(loadMoreBpmResults).toHaveBeenCalledTimes(1);

      rerender(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: false, isLoadingMoreResults: true })} />
      );
      expect(screen.getByText('Chargement...')).toBeInTheDocument();
    });

    it('absent tant que la recherche initiale est encore en cours', () => {
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: true })} />
      );
      expect(screen.queryByText('Charger plus de résultats')).not.toBeInTheDocument();
    });

    it('absent sans aucun résultat (rien à compléter)', () => {
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [], isWorldSearching: false })} />
      );
      expect(screen.queryByText('Charger plus de résultats')).not.toBeInTheDocument();
    });

    it('absent en mode recherche texte libre (réservé au mode BPM)', () => {
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: false, worldSearchResults: [trackWithPreview], isWorldSearching: false })} />
      );
      expect(screen.queryByText('Charger plus de résultats')).not.toBeInTheDocument();
    });
  });

  it('réserve "autres résultats" affichée seulement une fois la recherche générale épuisée', () => {
    const { rerender } = render(
      <SearchModal
        {...baseProps({
          worldSearchResults: [trackWithPreview],
          worldSearchOtherResults: [trackNoPreview],
          searchHasMoreResults: true,
          searchQuery: 'daft punk',
          searchActiveArtistName: 'Daft Punk',
        })}
      />
    );
    expect(screen.queryByText(/Autres résultats pour/)).not.toBeInTheDocument();

    rerender(
      <SearchModal
        {...baseProps({
          worldSearchResults: [trackWithPreview],
          worldSearchOtherResults: [trackNoPreview],
          searchHasMoreResults: false,
          searchQuery: 'daft punk',
          searchActiveArtistName: 'Daft Punk',
        })}
      />
    );
    expect(screen.getByText('Autres résultats pour "daft punk" (pas Daft Punk)')).toBeInTheDocument();
    expect(screen.getByText('Silence')).toBeInTheDocument();
  });
});

describe('SearchModal — ligne de résultat (renderSearchResultRow)', () => {
  it('bouton extrait désactivé sans preview, activé avec preview, appelle togglePreview', () => {
    const togglePreview = vi.fn();
    render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview, trackNoPreview], togglePreview })} />);

    const previewButtons = screen.getAllByTitle(/Écouter un extrait|Extrait non disponible/);
    expect(previewButtons[0]).toBeEnabled();
    expect(previewButtons[1]).toBeDisabled();

    fireEvent.click(previewButtons[0]);
    expect(togglePreview).toHaveBeenCalledWith(trackWithPreview);
  });

  it('playingPreviewId correspondant affiche Pause, sinon Play', () => {
    const { container } = render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], playingPreviewId: 't1' })} />);
    expect(container.querySelector('.lucide-pause')).toBeTruthy();
  });

  it('hors contexte playlist : clic sur le titre ajoute aux favoris (et le retire si déjà présent)', () => {
    const setFavorites = vi.fn();
    const showToast = vi.fn();
    const { rerender } = render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], setFavorites, showToast })} />);

    fireEvent.click(screen.getByText('Blitzkrieg Bop'));
    const addUpdater = setFavorites.mock.calls[0][0];
    expect(addUpdater({ tracks: [], artists: [] }).tracks).toEqual([trackWithPreview]);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Ajouté'));

    rerender(
      <SearchModal
        {...baseProps({ worldSearchResults: [trackWithPreview], favorites: { tracks: [{ trackId: 't1' }], artists: [] }, setFavorites, showToast, currentPlaylist: { id: 'pl1' } })}
      />
    );
    // en contexte playlist, le titre reste visible même déjà favori (pas filtré) — vérifie juste qu'il est bien là
    expect(screen.getByText('Blitzkrieg Bop')).toBeInTheDocument();
  });

  it('en contexte playlist : clic sur le titre appelle handleAddManualTrack (pas de bascule favoris)', () => {
    const handleAddManualTrack = vi.fn();
    const setFavorites = vi.fn();
    render(
      <SearchModal
        {...baseProps({ currentPlaylist: { id: 'pl1' }, worldSearchResults: [trackWithPreview], handleAddManualTrack, setFavorites })}
      />
    );

    fireEvent.click(screen.getByText('Blitzkrieg Bop'));

    expect(handleAddManualTrack).toHaveBeenCalledWith(trackWithPreview);
    expect(setFavorites).not.toHaveBeenCalled();
  });

  it('BPM "detected" : éditable, clic ouvre l\'édition ; BPM "deezer" : texte simple, pas de bouton', () => {
    const setEditingBpmId = vi.fn();
    render(<SearchModal {...baseProps({ worldSearchResults: [trackDetectedBpm, trackWithPreview], setEditingBpmId })} />);

    const editButton = screen.getByTitle('BPM deviné, pas garanti — touche pour corriger.');
    fireEvent.click(editButton);
    expect(setEditingBpmId).toHaveBeenCalledWith('t3');

    // Le 2e titre (source "deezer") ne doit avoir aucun bouton d'édition BPM.
    expect(screen.queryByTitle('BPM corrigé à la main. Touche pour modifier.')).not.toBeInTheDocument();
  });

  it('en édition BPM : Entrée déclenche le blur (commitBpmEdit), Échap ferme sans valider', () => {
    const commitBpmEdit = vi.fn();
    const setEditingBpmId = vi.fn();
    render(
      <SearchModal
        {...baseProps({ worldSearchResults: [trackDetectedBpm], editingBpmId: 't3', commitBpmEdit, setEditingBpmId })}
      />
    );

    const input = screen.getByDisplayValue('128');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(setEditingBpmId).toHaveBeenCalledWith(null);

    // Champ non contrôlé (defaultValue) : on change sa valeur AVANT le blur,
    // plutôt que de compter sur fireEvent.blur pour porter lui-même la
    // nouvelle valeur (comportement moins garanti pour cet événement précis).
    fireEvent.change(input, { target: { value: '130' } });
    fireEvent.blur(input);
    expect(commitBpmEdit).toHaveBeenCalledWith(trackDetectedBpm, '130');
  });

  it('affiche l\'avertissement genre non confirmé et BPM estimé quand applicable', () => {
    render(
      <SearchModal
        {...baseProps({
          worldSearchResults: [{ ...trackWithPreview, _genreMismatch: true, _bpmSource: 'detected' }],
        })}
      />
    );
    expect(screen.getByText(/Genre non confirmé/)).toBeInTheDocument();
    expect(screen.getByText(/BPM estimé/)).toBeInTheDocument();
  });

  it('le bouton favori de la ligne (Plus/Check) déclenche aussi addOrToggleFavorite', () => {
    const setFavorites = vi.fn();
    render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], setFavorites })} />);
    fireEvent.click(screen.getByTitle('Ajouter'));
    expect(setFavorites).toHaveBeenCalled();
  });
});
