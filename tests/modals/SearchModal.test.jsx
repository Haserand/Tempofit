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
    loadMoreBpmResults: vi.fn(),
    bpmUnconfirmedReserve: [],
    bpmSearchExhausted: false,
    loadMoreElapsedSeconds: 0,
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
    toggleTrackFavorite: vi.fn(),
    toggleArtistFavorite: vi.fn(),
    exclusions: { tracks: [], artists: [] },
    toggleTrackExclusion: vi.fn(),
    toggleArtistExclusion: vi.fn(),
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
  it('affiche la cible BPM/tolérance/genres', () => {
    render(
      <SearchModal
        {...baseProps({
          isBpmSearchMode: true,
          bpmSearchParams: { bpm: 150, tolerance: 10, genres: ['Rock', 'Métal'] },
        })}
      />
    );
    expect(screen.getByText(/150 BPM ± 10/)).toBeInTheDocument();
    expect(screen.getByText(/Rock, Métal/)).toBeInTheDocument();
  });

  it('sans genre ciblé, affiche "tous genres"', () => {
    render(<SearchModal {...baseProps({ isBpmSearchMode: true, bpmSearchParams: { bpm: 150, tolerance: 10, genres: [] } })} />);
    expect(screen.getByText(/tous genres/)).toBeInTheDocument();
  });
});

// NOUVEAU (28/08, retour direct — "un compteur de résultats en haut à
// droite, qui augmente ou diminue selon les ajouts et retraits", puis "le
// bouton rouge à droite fait doublon avec Charger plus, je préfère tout
// avoir dans la pastille du haut") — Option A retenue après discussion :
// compte les résultats CONFIRMÉS VISIBLES à l'écran (donc affecté par le
// filtre favoris), jamais la réserve non confirmée encore cachée. Cette
// même pastille est ensuite devenue un vrai BOUTON déclenchant
// `loadMoreBpmResults` — l'ancien bouton "Charger plus" en pointillés tout
// en bas ET le bouton 🔄 (rafraîchir depuis zéro, jugé redondant : le
// catalogue est déjà exploré en entier dès le 1er appel) ont tous les deux
// été retirés au profit de cette pastille unique. Voir sa docstring,
// SearchModal.jsx, pour le détail complet.
describe('SearchModal — pastille compteur + bouton "Charger plus" (mode BPM)', () => {
  it('affiche le nombre de résultats visibles, singulier pour 1 seul', () => {
    render(<SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview] })} />);
    expect(screen.getByText('1 résultat')).toBeInTheDocument();
  });

  it('affiche le nombre de résultats visibles, pluriel pour plusieurs', () => {
    render(<SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview, trackNoPreview] })} />);
    expect(screen.getByText('2 résultats')).toBeInTheDocument();
  });

  it('absent tant qu\'aucun résultat NI réserve (avant toute recherche, ou rien à compléter)', () => {
    render(<SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [], bpmUnconfirmedReserve: [] })} />);
    expect(screen.queryByText(/^\d+ résultat/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rien de confirmé')).not.toBeInTheDocument();
  });

  it('diminue quand un titre déjà en favoris est filtré de l\'affichage (hors contexte playlist)', () => {
    render(
      <SearchModal
        {...baseProps({
          isBpmSearchMode: true,
          worldSearchResults: [trackWithPreview, trackNoPreview],
          favorites: { tracks: [{ trackId: trackWithPreview.trackId }], artists: [] },
        })}
      />
    );
    // trackWithPreview est filtré (déjà en favoris) : il ne reste que
    // trackNoPreview parmi les résultats VISIBLES.
    expect(screen.getByText('1 résultat')).toBeInTheDocument();
  });

  it('en contexte playlist, ne filtre PAS les favoris — le compteur les inclut', () => {
    render(
      <SearchModal
        {...baseProps({
          isBpmSearchMode: true,
          currentPlaylist: { id: 'pl1' },
          worldSearchResults: [trackWithPreview, trackNoPreview],
          favorites: { tracks: [{ trackId: trackWithPreview.trackId }], artists: [] },
        })}
      />
    );
    expect(screen.getByText('2 résultats')).toBeInTheDocument();
  });

  it('inclut la réserve non confirmée une fois révélée (bpmSearchExhausted), jamais avant', () => {
    const unconfirmedTrack = { ...trackDetectedBpm, _genreMismatch: true };
    const { rerender } = render(
      <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], bpmUnconfirmedReserve: [unconfirmedTrack], bpmSearchExhausted: false })} />
    );
    expect(screen.getByText('1 résultat')).toBeInTheDocument();

    rerender(
      <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], bpmUnconfirmedReserve: [unconfirmedTrack], bpmSearchExhausted: true })} />
    );
    expect(screen.getByText('2 résultats')).toBeInTheDocument();
  });

  it('affiche "Rien de confirmé" (au lieu d\'un compte) quand rien de confirmé mais une réserve existe déjà', () => {
    const unconfirmedTrack = { ...trackDetectedBpm, _genreMismatch: true };
    render(
      <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [], bpmUnconfirmedReserve: [unconfirmedTrack], isWorldSearching: false })} />
    );
    expect(screen.getByText('Rien de confirmé')).toBeInTheDocument();
  });

  it('absent en mode recherche texte libre (réservé au mode BPM)', () => {
    render(<SearchModal {...baseProps({ isBpmSearchMode: false, worldSearchResults: [trackWithPreview] })} />);
    expect(screen.queryByText(/^\d+ résultat/)).not.toBeInTheDocument();
  });

  // ⚠️ REVENU À 2 ÉLÉMENTS SÉPARÉS (28/08, retour direct — "j'aimais
  // vraiment bien avoir un bouton qui correspondait au truc pour
  // rafraîchir [au niveau du DESIGN], je veux juste que la fonctionnalité
  // désormais ce soit charger plus/approfondir") — voir la docstring du
  // composant : la pastille de compteur est redevenue un simple badge non
  // cliquable ; c'est le BOUTON ROND distinct (même identité visuelle que
  // l'ancien 🔄) qui déclenche `loadMoreBpmResults`.
  describe('bouton rond "Charger plus" (28/08, distinct de la pastille de compteur)', () => {
    it('le badge de compteur reste visible PENDANT la recherche initiale (compte progressif) — seul le bouton d\'action se cache', () => {
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: true })} />
      );
      expect(screen.getByText('1 résultat')).toBeInTheDocument();
      expect(screen.queryByTitle('Charger plus de résultats')).not.toBeInTheDocument();
    });

    it('clic sur le bouton rond appelle loadMoreBpmResults (pas un clic sur le badge)', () => {
      const loadMoreBpmResults = vi.fn();
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: false, loadMoreBpmResults })} />
      );
      fireEvent.click(screen.getByTitle('Charger plus de résultats'));
      expect(loadMoreBpmResults).toHaveBeenCalledTimes(1);
    });

    it('reste présent même une fois bpmSearchExhausted à vrai (un coup de malchance ne doit pas fermer la porte) — infobulle différente', () => {
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: false, bpmSearchExhausted: true })} />
      );
      expect(screen.getByTitle('Chercher encore plus loin')).toBeInTheDocument();
    });

    // NOUVEAU (28/08, retour direct — "faudrait avoir le texte 'chargement'
    // qui évolue un peu comme pour le reste de la génération") — même
    // principe à paliers de temps que GenerationProgressBanner.jsx, testé
    // ici via `loadMoreElapsedSeconds` (le chrono lui-même, `useElapsedTimer`,
    // est déjà testé ailleurs — hors scope ici, on vérifie juste le CHOIX
    // du texte pour chaque palier). Affiché dans le BADGE de compteur
    // (trop petit pour du texte dans le bouton rond lui-même).
    it('pendant le chargement, le texte évolutif remplace le compte dans le badge', () => {
      const { rerender } = render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: false, isLoadingMoreResults: true, loadMoreElapsedSeconds: 0 })} />
      );
      expect(screen.getByText('Chargement...')).toBeInTheDocument();
      expect(screen.queryByText('1 résultat')).not.toBeInTheDocument();

      rerender(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: false, isLoadingMoreResults: true, loadMoreElapsedSeconds: 10 })} />
      );
      expect(screen.getByText('Encore un instant...')).toBeInTheDocument();

      rerender(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], isWorldSearching: false, isLoadingMoreResults: true, loadMoreElapsedSeconds: 25 })} />
      );
      expect(screen.getByText('Ça prend plus de temps que prévu...')).toBeInTheDocument();
    });
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

  // NOUVEAU (28/08, chantier "révéler le non confirmé seulement si vraiment
  // épuisé") — voir la docstring de `displayedResults`, SearchModal.jsx.
  describe('réserve non confirmée (mode BPM) — révélée seulement une fois bpmSearchExhausted', () => {
    it('confirmé vide, réserve non vide, PAS encore épuisé : ni la réserve ni un titre ne s\'affichent, message honnête à la place', () => {
      const unconfirmedTrack = { ...trackDetectedBpm, _genreMismatch: true };
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [], bpmUnconfirmedReserve: [unconfirmedTrack], isWorldSearching: false, bpmSearchExhausted: false })} />
      );
      expect(screen.queryByText('Mystery Track')).not.toBeInTheDocument();
      expect(screen.getByText(/Rien de confirmé pour l'instant/)).toBeInTheDocument();
    });

    // NOUVEAU (28/08, retour direct — "ça peut sembler être un échec total")
    // — le message affiche maintenant le NOMBRE EXACT de titres en réserve,
    // pour distinguer "rien trouvé du tout" de "des pistes existent, pas
    // sûres encore". Singulier/pluriel vérifiés séparément.
    it('message avec le nombre exact de titres en réserve, au singulier pour 1 seul', () => {
      const unconfirmedTrack = { ...trackDetectedBpm, _genreMismatch: true };
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [], bpmUnconfirmedReserve: [unconfirmedTrack], isWorldSearching: false, bpmSearchExhausted: false })} />
      );
      expect(screen.getByText(/1 titre approximatif trouvé \(genre non garanti\)/)).toBeInTheDocument();
    });

    it('message avec le nombre exact de titres en réserve, au pluriel pour plusieurs', () => {
      const unconfirmedTrack1 = { ...trackDetectedBpm, trackId: 'nc1', _genreMismatch: true };
      const unconfirmedTrack2 = { ...trackDetectedBpm, trackId: 'nc2', _genreMismatch: true };
      const unconfirmedTrack3 = { ...trackDetectedBpm, trackId: 'nc3', _genreMismatch: true };
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [], bpmUnconfirmedReserve: [unconfirmedTrack1, unconfirmedTrack2, unconfirmedTrack3], isWorldSearching: false, bpmSearchExhausted: false })} />
      );
      expect(screen.getByText(/3 titres approximatifs trouvés \(genre non garanti\)/)).toBeInTheDocument();
    });

    it('confirmé vide, réserve non vide, ÉPUISÉ : la réserve est enfin révélée', () => {
      const unconfirmedTrack = { ...trackDetectedBpm, _genreMismatch: true };
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [], bpmUnconfirmedReserve: [unconfirmedTrack], isWorldSearching: false, bpmSearchExhausted: true })} />
      );
      expect(screen.getByText('Mystery Track')).toBeInTheDocument();
      expect(screen.getByText('⚠️ Genre non confirmé')).toBeInTheDocument();
      // Le message "rien de confirmé" ne doit plus apparaître une fois la
      // réserve révélée : le titre non confirmé EST maintenant le résultat affiché.
      expect(screen.queryByText(/Rien de confirmé pour l'instant/)).not.toBeInTheDocument();
    });

    it('confirmé ET réserve non vides, ÉPUISÉ : les deux s\'affichent, confirmé avant réserve', () => {
      const unconfirmedTrack = { ...trackDetectedBpm, _genreMismatch: true };
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], bpmUnconfirmedReserve: [unconfirmedTrack], isWorldSearching: false, bpmSearchExhausted: true })} />
      );
      const order = screen.getAllByText(/Blitzkrieg Bop|Mystery Track/).map(el => el.textContent);
      expect(order).toEqual(['Blitzkrieg Bop', 'Mystery Track']);
    });

    it('confirmé non vide, réserve non vide, PAS encore épuisé : seul le confirmé s\'affiche, la réserve reste cachée', () => {
      const unconfirmedTrack = { ...trackDetectedBpm, _genreMismatch: true };
      render(
        <SearchModal {...baseProps({ isBpmSearchMode: true, worldSearchResults: [trackWithPreview], bpmUnconfirmedReserve: [unconfirmedTrack], isWorldSearching: false, bpmSearchExhausted: false })} />
      );
      expect(screen.getByText('Blitzkrieg Bop')).toBeInTheDocument();
      expect(screen.queryByText('Mystery Track')).not.toBeInTheDocument();
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

  it('hors contexte playlist : clic sur le titre appelle toggleTrackFavorite (délègue entièrement, plus de logique dupliquée ici)', () => {
    const toggleTrackFavorite = vi.fn();
    const { rerender } = render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleTrackFavorite })} />);

    fireEvent.click(screen.getByText('Blitzkrieg Bop'));
    expect(toggleTrackFavorite).toHaveBeenCalledWith(trackWithPreview);

    rerender(
      <SearchModal
        {...baseProps({ worldSearchResults: [trackWithPreview], favorites: { tracks: [{ trackId: 't1' }], artists: [] }, toggleTrackFavorite, currentPlaylist: { id: 'pl1' } })}
      />
    );
    // en contexte playlist, le titre reste visible même déjà favori (pas filtré) — vérifie juste qu'il est bien là
    expect(screen.getByText('Blitzkrieg Bop')).toBeInTheDocument();
  });

  it('en contexte playlist : clic sur le titre appelle handleAddManualTrack (pas de bascule favoris)', () => {
    const handleAddManualTrack = vi.fn();
    const toggleTrackFavorite = vi.fn();
    render(
      <SearchModal
        {...baseProps({ currentPlaylist: { id: 'pl1' }, worldSearchResults: [trackWithPreview], handleAddManualTrack, toggleTrackFavorite })}
      />
    );

    fireEvent.click(screen.getByText('Blitzkrieg Bop'));

    expect(handleAddManualTrack).toHaveBeenCalledWith(trackWithPreview);
    expect(toggleTrackFavorite).not.toHaveBeenCalled();
  });

  // ⚠️ MENU UNIFIÉ (28/08, retour direct — "prends du recul, pouvoir
  // ajouter un artiste aux favoris depuis le moteur de recherche, ou à
  // l'inverse exclure l'artiste ; et pas juste le morceau") — les 2 boutons
  // rapides (favori titre / exclure titre) ont fusionné dans un menu "..."
  // à 4 actions (titre + artiste, favori + exclusion), même patron que le
  // menu de TrackItem.jsx (playlist). `screen.getByTitle("Plus d'options")`
  // ouvre le menu avant chaque clic sur une action.
  describe('menu d\'options d\'un résultat de recherche (28/08)', () => {
    const openMenu = () => fireEvent.click(screen.getByTitle("Plus d'options"));

    it('clic sur "Favoriser ce titre" appelle toggleTrackFavorite avec le titre entier', () => {
      const toggleTrackFavorite = vi.fn();
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleTrackFavorite })} />);
      openMenu();
      fireEvent.click(screen.getByText('Favoriser ce titre'));
      expect(toggleTrackFavorite).toHaveBeenCalledWith(trackWithPreview);
    });

    // ⚠️ PAS DE TEST "titre déjà favori : le menu propose de le retirer"
    // (piège trouvé en écrivant ce test, pas juste une omission) — hors
    // contexte playlist, un titre DÉJÀ favori est filtré de l'affichage
    // ENTIER par `visibleMainResults` (voir le commentaire "Filtre les
    // titres déjà en favoris" plus haut dans ce fichier) : son menu "..."
    // n'est donc jamais atteignable par ce chemin, la ligne elle-même
    // disparaît avant que quiconque puisse l'ouvrir. En contexte playlist,
    // le libellé de CETTE action devient "Ajouter à la playlist" (testé
    // juste au-dessus) — jamais "Retirer des favoris" non plus, puisque
    // cette branche du code sert alors une intention différente. Le
    // rameau conditionnel `isAlreadyFavorited ? "Retirer..." : "Favoriser..."`
    // existe bien dans le code, mais n'est réellement exercé par AUCUN
    // chemin naturel de ce composant — documenté ici plutôt que de forcer
    // un test sur un état qui ne survient jamais en pratique.

    it('en contexte playlist, le libellé change ("Ajouter à la playlist") et déclenche handleAddManualTrack', () => {
      const handleAddManualTrack = vi.fn();
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], currentPlaylist: { id: 'pl1' }, handleAddManualTrack })} />);
      openMenu();
      fireEvent.click(screen.getByText('Ajouter à la playlist'));
      expect(handleAddManualTrack).toHaveBeenCalledWith(trackWithPreview);
    });

    it('clic sur "Favoriser l\'artiste" appelle toggleArtistFavorite avec le nom de l\'artiste', () => {
      const toggleArtistFavorite = vi.fn();
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleArtistFavorite })} />);
      openMenu();
      fireEvent.click(screen.getByText(/Favoriser l'artiste/));
      expect(toggleArtistFavorite).toHaveBeenCalledWith('The Ramones');
    });

    it('artiste déjà favori : le menu propose de le retirer des favoris', () => {
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], favorites: { tracks: [], artists: ['The Ramones'] } })} />);
      openMenu();
      expect(screen.getByText('Retirer The Ramones des favoris')).toBeInTheDocument();
    });

    it('absent de "Favoriser l\'artiste" si toggleArtistFavorite n\'est pas fourni', () => {
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleArtistFavorite: undefined })} />);
      openMenu();
      expect(screen.queryByText(/Favoriser l'artiste/)).not.toBeInTheDocument();
    });

    it('clic sur "Exclure ce titre" appelle toggleTrackExclusion avec le titre entier', () => {
      const toggleTrackExclusion = vi.fn();
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleTrackExclusion })} />);
      openMenu();
      fireEvent.click(screen.getByText('Exclure ce titre'));
      expect(toggleTrackExclusion).toHaveBeenCalledWith(trackWithPreview);
    });

    it('titre déjà exclu : le menu propose de le retirer des exclusions', () => {
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], exclusions: { tracks: [{ trackId: 't1' }], artists: [] } })} />);
      openMenu();
      expect(screen.getByText('Retirer ce titre des exclusions')).toBeInTheDocument();
      expect(screen.queryByText('Exclure ce titre')).not.toBeInTheDocument();
    });

    it('absent de "Exclure ce titre" si toggleTrackExclusion n\'est pas fourni (composant utilisable sans le mécanisme d\'exclusion branché)', () => {
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleTrackExclusion: undefined })} />);
      openMenu();
      expect(screen.queryByText('Exclure ce titre')).not.toBeInTheDocument();
    });

    it('clic sur "Exclure l\'artiste" appelle toggleArtistExclusion avec le nom de l\'artiste', () => {
      const toggleArtistExclusion = vi.fn();
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleArtistExclusion })} />);
      openMenu();
      fireEvent.click(screen.getByText(/Exclure l'artiste/));
      expect(toggleArtistExclusion).toHaveBeenCalledWith('The Ramones');
    });

    it('artiste déjà exclu : le menu propose de le retirer des exclusions', () => {
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], exclusions: { tracks: [], artists: ['The Ramones'] } })} />);
      openMenu();
      expect(screen.getByText('Retirer The Ramones des exclusions')).toBeInTheDocument();
    });

    it('absent de "Exclure l\'artiste" si toggleArtistExclusion n\'est pas fourni', () => {
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview], toggleArtistExclusion: undefined })} />);
      openMenu();
      expect(screen.queryByText(/Exclure l'artiste/)).not.toBeInTheDocument();
    });

    it('un clic en dehors du menu le referme', () => {
      render(<SearchModal {...baseProps({ worldSearchResults: [trackWithPreview] })} />);
      openMenu();
      expect(screen.getByText('Favoriser ce titre')).toBeInTheDocument();
      // Sélecteur PRÉCIS (pas juste `.fixed.inset-0`) — `ModalShell.jsx`
      // possède SON PROPRE fond `.fixed.inset-0` (avec un z-index différent,
      // z-[70]) pour fermer la modale entière ; un sélecteur trop générique
      // attraperait CELUI-LÀ en premier (premier dans l'ordre du DOM),
      // jamais l'overlay dédié à la fermeture DE CE MENU (`.z-10`, propre à
      // `renderSearchResultRow`).
      // eslint-disable-next-line testing-library/no-node-access
      fireEvent.click(document.body.querySelector('.fixed.inset-0.z-10'));
      expect(screen.queryByText('Favoriser ce titre')).not.toBeInTheDocument();
    });
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
});
