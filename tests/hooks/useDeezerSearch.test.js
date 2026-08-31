// Test dédié à useDeezerSearch.js — 0 test jusqu'ici (check-up du 13/08).
// Aucun `useState`/`useEffect` propre à ce hook (seul `useModalContext()`
// est appelé) — mocké en plain object, `renderHook`/`jsdom` ne sont donc
// pas nécessaires, `node` (l'environnement par défaut) suffit.
// `searchEngine.js` (dedupeAppend/fetchWorldSearchResults/
// fetchBpmSearchResults) entièrement mocké — logique déjà testée
// isolément par son propre fichier (implicite, fonctions pures).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCloseModal = vi.fn();
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ closeModal: mockCloseModal }),
}));

const mockDedupeAppend = vi.fn((prev, incoming, reset) => (reset ? incoming : [...prev, ...incoming]));
const mockMergeAndResortBpmResults = vi.fn((prev, incoming) => [...prev, ...incoming]);
const mockFetchWorldSearchResults = vi.fn();
const mockFetchBpmSearchResults = vi.fn();
vi.mock('../../src/engine/searchEngine.js', () => ({
  dedupeAppend: (...args) => mockDedupeAppend(...args),
  mergeAndResortBpmResults: (...args) => mockMergeAndResortBpmResults(...args),
  fetchWorldSearchResults: (...args) => mockFetchWorldSearchResults(...args),
  fetchBpmSearchResults: (...args) => mockFetchBpmSearchResults(...args),
}));

import { useDeezerSearch } from '../../src/hooks/useDeezerSearch.js';

// Fabrique un faux `search` (forme de retour de useTrackSearch()) — chaque
// champ `setXxx` est un vi.fn() espionnable ; les champs lus (searchQuery,
// searchResultsOffset, searchActiveArtistName, isWorldSearching) sont
// paramétrables via `overrides` pour simuler l'état au moment de l'appel.
function makeSearch(overrides = {}) {
  return {
    searchQuery: 'daft punk',
    searchResultsOffset: 0,
    searchActiveArtistName: null,
    isWorldSearching: false,
    worldSearchResults: [],
    bpmSearchParams: { bpm: 140, tolerance: 10, genres: ['Rock'] },
    isLoadingMoreResults: false,
    bpmUnconfirmedReserve: [],
    setSearchActiveArtistName: vi.fn(),
    setWorldSearchResults: vi.fn(),
    setWorldSearchOtherResults: vi.fn(),
    setResultsContextLabel: vi.fn(),
    setNoUsableResultsHint: vi.fn(),
    setSearchResultsOffset: vi.fn(),
    setSearchHasMoreResults: vi.fn(),
    setIsWorldSearching: vi.fn(),
    setIsLoadingMoreResults: vi.fn(),
    setSearchLoadingMessage: vi.fn(),
    setSearchQuery: vi.fn(),
    setIsBpmSearchMode: vi.fn(),
    setEditingBpmId: vi.fn(),
    setBpmSearchParams: vi.fn(),
    setBpmUnconfirmedReserve: vi.fn(),
    setBpmSearchExhausted: vi.fn(),
    ...overrides,
  };
}

// Applique un `setXxx(fn)` appelé avec un updater fonctionnel, comme le
// ferait React — la plupart des tests n'ont besoin que de la valeur passée
// à l'appel le plus récent.
function lastCallArg(mockFn) {
  const calls = mockFn.mock.calls;
  return calls.length ? calls[calls.length - 1][0] : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDedupeAppend.mockImplementation((prev, incoming, reset) => (reset ? incoming : [...prev, ...incoming]));
});

describe('searchWorldMusicApi', () => {
  it('texte vide (ou seulement des espaces) : ne fait rien, aucun appel réseau', async () => {
    const search = makeSearch({ searchQuery: '   ' });
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    await searchWorldMusicApi();

    expect(mockFetchWorldSearchResults).not.toHaveBeenCalled();
    expect(search.setIsWorldSearching).not.toHaveBeenCalled();
  });

  it('reset=true alors qu\'une recherche tourne déjà : refuse (garde anti-double-lancement)', async () => {
    const search = makeSearch({ isWorldSearching: true });
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    await searchWorldMusicApi(true);

    expect(mockFetchWorldSearchResults).not.toHaveBeenCalled();
  });

  it('reset=true : réinitialise l\'affichage AVANT l\'appel réseau (résultats vidés, spinner activé)', async () => {
    mockFetchWorldSearchResults.mockReturnValue(new Promise(() => {})); // jamais résolue, pour figer l'état "en cours"
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    searchWorldMusicApi(true); // pas de await : on inspecte l'état synchrone juste après le lancement

    expect(search.setIsWorldSearching).toHaveBeenCalledWith(true);
    expect(search.setWorldSearchResults).toHaveBeenCalledWith([]);
    expect(search.setWorldSearchOtherResults).toHaveBeenCalledWith([]);
    expect(search.setNoUsableResultsHint).toHaveBeenCalledWith(false);
    expect(search.setSearchHasMoreResults).toHaveBeenCalledWith(false);
  });

  it('reset=false ("voir plus") : active isLoadingMoreResults, PAS isWorldSearching, ne vide pas les résultats existants', async () => {
    mockFetchWorldSearchResults.mockResolvedValue({
      activeArtistName: null, noResults: false, matched: [{ trackId: 'x' }], other: [],
      contextLabel: null, newOffset: 10, hasMore: true, emptyAfterFormatting: false,
    });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    await searchWorldMusicApi(false);

    expect(search.setIsLoadingMoreResults).toHaveBeenCalledWith(true);
    expect(search.setIsWorldSearching).not.toHaveBeenCalledWith(true);
    expect(search.setWorldSearchResults).not.toHaveBeenCalledWith([]);
  });

  it('succès avec résultats : applique matched/other via dedupeAppend, met à jour offset/hasMore', async () => {
    mockFetchWorldSearchResults.mockResolvedValue({
      activeArtistName: 'Daft Punk', noResults: false,
      matched: [{ trackId: 'a' }], other: [{ trackId: 'b' }],
      contextLabel: 'Top titres de Daft Punk', newOffset: 25, hasMore: true, emptyAfterFormatting: false,
    });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    await searchWorldMusicApi(true);

    expect(search.setSearchActiveArtistName).toHaveBeenCalledWith('Daft Punk');
    expect(search.setResultsContextLabel).toHaveBeenCalledWith('Top titres de Daft Punk');
    expect(search.setSearchResultsOffset).toHaveBeenCalledWith(25);
    expect(search.setSearchHasMoreResults).toHaveBeenCalledWith(true);
    expect(search.setNoUsableResultsHint).not.toHaveBeenCalledWith(true);
    // Fin de la recherche : les 2 spinners doivent retomber à false.
    expect(search.setIsWorldSearching).toHaveBeenLastCalledWith(false);
    expect(search.setIsLoadingMoreResults).toHaveBeenLastCalledWith(false);
  });

  it('noResults=true : signale noUsableResultsHint, ne touche PAS resultsContextLabel/offset/hasMore', async () => {
    mockFetchWorldSearchResults.mockResolvedValue({ activeArtistName: null, noResults: true });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    await searchWorldMusicApi(true);

    expect(search.setNoUsableResultsHint).toHaveBeenCalledWith(true);
    expect(search.setResultsContextLabel).not.toHaveBeenCalledWith(expect.anything());
    expect(search.setSearchResultsOffset).not.toHaveBeenCalled();
  });

  it('emptyAfterFormatting=true sur un reset : signale AUSSI noUsableResultsHint (titres trouvés, mais sans BPM connu)', async () => {
    mockFetchWorldSearchResults.mockResolvedValue({
      activeArtistName: null, noResults: false, matched: [], other: [],
      contextLabel: null, newOffset: 0, hasMore: false, emptyAfterFormatting: true,
    });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    await searchWorldMusicApi(true);

    expect(search.setNoUsableResultsHint).toHaveBeenCalledWith(true);
  });

  it('erreur réseau (fetchWorldSearchResults rejette) : toast erreur, journalise, retombe proprement sur les spinners', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchWorldSearchResults.mockRejectedValue(new Error('network down'));
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchWorldMusicApi } = useDeezerSearch(search, showToast, false);

    await searchWorldMusicApi(true);

    expect(showToast).toHaveBeenCalledWith('Erreur réseau lors de la recherche.', 'error');
    expect(search.setIsWorldSearching).toHaveBeenLastCalledWith(false);
    consoleSpy.mockRestore();
  });
});

describe('commitBpmEdit', () => {
  it('ferme toujours l\'édition (setEditingBpmId(null)), même si la valeur est invalide', () => {
    const search = makeSearch();
    const showToast = vi.fn();
    const { commitBpmEdit } = useDeezerSearch(search, showToast, false);

    commitBpmEdit({ trackId: 'x', bpm: 120 }, 'abc');

    expect(search.setEditingBpmId).toHaveBeenCalledWith(null);
  });

  it('valeur invalide (NaN, 0, négative) : ne modifie rien, pas de toast', () => {
    const search = makeSearch();
    const showToast = vi.fn();
    const { commitBpmEdit } = useDeezerSearch(search, showToast, false);

    commitBpmEdit({ trackId: 'x', bpm: 120 }, '0');

    expect(search.setWorldSearchResults).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('valeur IDENTIQUE au BPM actuel : ne modifie rien (rien à faire)', () => {
    const search = makeSearch();
    const showToast = vi.fn();
    const { commitBpmEdit } = useDeezerSearch(search, showToast, false);

    commitBpmEdit({ trackId: 'x', bpm: 120 }, '120');

    expect(search.setWorldSearchResults).not.toHaveBeenCalled();
  });

  it('valeur valide et différente : met à jour LE bon titre dans les deux listes (résultats + réserve cachée), marque _bpmSource="manual"', () => {
    const search = makeSearch();
    const showToast = vi.fn();
    const { commitBpmEdit } = useDeezerSearch(search, showToast, false);

    commitBpmEdit({ trackId: 'x', bpm: 120 }, '135');

    const updateResults = lastCallArg(search.setWorldSearchResults);
    const updated = updateResults([{ trackId: 'x', bpm: 120 }, { trackId: 'y', bpm: 90 }]);
    expect(updated).toEqual([{ trackId: 'x', bpm: 135, _bpmSource: 'manual' }, { trackId: 'y', bpm: 90 }]);

    const updateOther = lastCallArg(search.setWorldSearchOtherResults);
    expect(typeof updateOther).toBe('function');

    expect(showToast).toHaveBeenCalledWith('BPM corrigé : 135');
  });
});

describe('closeSearchModal', () => {
  it('ferme la modale ET réinitialise tout l\'état de recherche', () => {
    const search = makeSearch();
    const showToast = vi.fn();
    const { closeSearchModal } = useDeezerSearch(search, showToast, false);

    closeSearchModal();

    expect(mockCloseModal).toHaveBeenCalled();
    expect(search.setSearchQuery).toHaveBeenCalledWith('');
    expect(search.setIsBpmSearchMode).toHaveBeenCalledWith(false);
    expect(search.setWorldSearchResults).toHaveBeenCalledWith([]);
    expect(search.setWorldSearchOtherResults).toHaveBeenCalledWith([]);
    expect(search.setResultsContextLabel).toHaveBeenCalledWith(null);
    expect(search.setNoUsableResultsHint).toHaveBeenCalledWith(false);
    expect(search.setSearchResultsOffset).toHaveBeenCalledWith(0);
    expect(search.setSearchHasMoreResults).toHaveBeenCalledWith(false);
    expect(search.setSearchActiveArtistName).toHaveBeenCalledWith(null);
    expect(search.setEditingBpmId).toHaveBeenCalledWith(null);
  });
});

describe('searchTracksByBpm', () => {
  it('une recherche tourne déjà (isWorldSearching=true) : refuse (défense en profondeur, même garde que le bouton désactivé côté UI)', async () => {
    const search = makeSearch({ isWorldSearching: true });
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(mockFetchBpmSearchResults).not.toHaveBeenCalled();
    expect(search.setBpmSearchParams).not.toHaveBeenCalled();
  });

  it('mémorise les paramètres de recherche (bpm/tolerance/genres), même en cas de genres omis', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [{ trackId: 'a' }], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, undefined);

    expect(search.setBpmSearchParams).toHaveBeenCalledWith({ bpm: 140, tolerance: 10, genres: [] });
  });

  it('genre fragile (K-pop/Musique asiatique/Bandes originales) : message de chargement dédié "Recherche plus longue"', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['K-pop']);

    expect(search.setSearchLoadingMessage).toHaveBeenCalledWith('Recherche plus longue pour ce genre...');
  });

  it('genre standard : message de chargement tiré parmi SEARCH_LOADING_MESSAGES (pas le message dédié genre fragile)', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    // 'Jazz' plutôt que 'Rock' (28/08) — 'Rock' a rejoint
    // WEAK_DEEZER_KEYWORD_GENRES le même jour (voir musicCatalog.js, mot-clé
    // 'rock' jugé trop générique en recherche texte libre), donc il
    // déclenche maintenant, à raison, le message dédié que ce test vérifie
    // justement l'ABSENCE. 'Jazz' reste un mot-clé suffisamment spécifique
    // au vocabulaire musical pour ne pas avoir rejoint cette liste.
    await searchTracksByBpm(140, 10, ['Jazz']);

    expect(search.setSearchLoadingMessage).not.toHaveBeenCalledWith('Recherche plus longue pour ce genre...');
  });

  // NOUVEAU (28/08, chantier "favoris en premier dans la recherche BPM") —
  // `favorites` reçu par le hook (4e paramètre, voir sa docstring) doit être
  // transmis TEL QUEL à `fetchBpmSearchResults` (searchEngine.js, où vit
  // tout le mécanisme réel de priorisation) — logique interne hors scope
  // ici (nécessite un mock HTTP complet, voir searchEngine.test.js), on
  // vérifie seulement le CÂBLAGE : le bon objet arrive au bon endroit.
  it('transmet `favorites` à fetchBpmSearchResults quand fourni au hook', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const favorites = { tracks: [{ trackId: 'deezer-1', title: 'X', artist: 'Y', bpm: 140, genre: 'Rock' }], artists: ['AC/DC'] };
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false, favorites);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(mockFetchBpmSearchResults).toHaveBeenCalledWith(140, 10, ['Rock'], expect.any(Function), favorites, [], 1, null);
  });

  it('sans favoris NI exclusions fournis au hook (undefined), transmet `null` pour les deux à fetchBpmSearchResults (pas de crash)', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['Jazz']);

    expect(mockFetchBpmSearchResults).toHaveBeenCalledWith(140, 10, ['Jazz'], expect.any(Function), null, [], 1, null);
  });

  // NOUVEAU (28/08, chantier "mécanisme d'exclusion") — `exclusions` reçu
  // par le hook (5e paramètre, même convention que `favorites`) doit être
  // transmis TEL QUEL à `fetchBpmSearchResults` — logique réelle de
  // filtrage hors scope ici (réseau, voir searchEngine.test.js), on
  // vérifie seulement le câblage.
  it('transmet `exclusions` à fetchBpmSearchResults quand fourni au hook', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const exclusions = { artists: ['Nickelback'], tracks: [] };
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false, null, exclusions);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(mockFetchBpmSearchResults).toHaveBeenCalledWith(140, 10, ['Rock'], expect.any(Function), null, [], 1, exclusions);
  });

  it('applique la progression (onProgress) EN COURS de recherche avant le résultat final — confirmé et non confirmé séparés', async () => {
    let capturedOnProgress;
    mockFetchBpmSearchResults.mockImplementation(async (bpm, tol, genres, onProgress) => {
      capturedOnProgress = onProgress;
      onProgress({ confirmed: [{ trackId: 'partiel-1' }], unconfirmed: [] });
      return { results: [{ trackId: 'partiel-1' }, { trackId: 'final-2' }], unconfirmed: [{ trackId: 'nc-1' }] };
    });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(typeof capturedOnProgress).toBe('function');
    expect(search.setWorldSearchResults).toHaveBeenCalledWith([{ trackId: 'partiel-1' }]);
    expect(search.setWorldSearchResults).toHaveBeenLastCalledWith([{ trackId: 'partiel-1' }, { trackId: 'final-2' }]);
    // Le non confirmé va dans la réserve CACHÉE, jamais dans
    // setWorldSearchResults (voir la docstring de bpmUnconfirmedReserve,
    // useTrackSearch.js) — c'est tout l'objet du chantier du 28/08.
    expect(search.setBpmUnconfirmedReserve).toHaveBeenLastCalledWith([{ trackId: 'nc-1' }]);
  });

  it('résultat final vide (ni confirmé ni non confirmé) : signale noUsableResultsHint', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(search.setNoUsableResultsHint).toHaveBeenCalledWith(true);
  });

  // NOUVEAU (28/08, chantier "révéler le non confirmé seulement si vraiment
  // épuisé") — même si AUCUN résultat confirmé n'est trouvé, la présence
  // d'un non confirmé en réserve signifie qu'on a trouvé QUELQUE CHOSE (pas
  // "rien du tout") : noUsableResultsHint ne doit PAS se déclencher, pour
  // laisser la porte ouverte au bouton "Charger plus" plutôt que d'afficher
  // un message définitif "Aucun résultat".
  it('confirmé vide MAIS non confirmé présent : ne signale PAS noUsableResultsHint (reste \'à essayer avec Charger plus\')', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [{ trackId: 'nc-1' }] });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(search.setNoUsableResultsHint).not.toHaveBeenCalledWith(true);
    expect(search.setBpmUnconfirmedReserve).toHaveBeenLastCalledWith([{ trackId: 'nc-1' }]);
  });

  // NOUVEAU (28/08, même chantier) — chaque NOUVELLE recherche doit repartir
  // à zéro sur la réserve et le signal d'épuisement, jamais hériter d'un état
  // laissé par une recherche précédente (BPM/genres différents).
  it('réinitialise la réserve non confirmée et le signal d\'épuisement à chaque nouvelle recherche', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(search.setBpmUnconfirmedReserve).toHaveBeenCalledWith([]);
    expect(search.setBpmSearchExhausted).toHaveBeenCalledWith(false);
  });

  it('erreur réseau : toast erreur, retombe sur isWorldSearching=false', async () => {
    mockFetchBpmSearchResults.mockRejectedValue(new Error('network down'));
    const search = makeSearch();
    const showToast = vi.fn();
    const { searchTracksByBpm } = useDeezerSearch(search, showToast, false);

    await searchTracksByBpm(140, 10, ['Rock']);

    expect(showToast).toHaveBeenCalledWith('Erreur réseau lors de la recherche.', 'error');
    expect(search.setIsWorldSearching).toHaveBeenLastCalledWith(false);
  });
});

// NOUVEAU (28/08, chantier "Charger plus" pour la recherche BPM) —
// `loadMoreBpmResults` : relance `fetchBpmSearchResults` avec un budget de
// vérification plus large (`stubCapMultiplier`) et exclut les titres déjà
// affichés, fusionne via `mergeAndResortBpmResults` (mockée en simple
// concaténation ici, sa vraie logique de retri est testée dans
// searchEngine.test.js — hors scope de ce fichier, qui vérifie uniquement
// le CÂBLAGE : bons paramètres transmis, bon état mis à jour, bons
// garde-fous anti-concurrence).
describe('loadMoreBpmResults', () => {
  it('relance fetchBpmSearchResults avec les paramètres BPM en cours, les trackId déjà affichés (confirmés ET en réserve) en exclusion, et un budget doublé', async () => {
    const existingConfirmed = [{ trackId: 'deezer-1', _matchTier: 0 }];
    const existingReserve = [{ trackId: 'deezer-2', _matchTier: 2 }];
    mockFetchBpmSearchResults.mockResolvedValue({ results: [{ trackId: 'deezer-3', _matchTier: 0 }], unconfirmed: [] });
    const search = makeSearch({
      worldSearchResults: existingConfirmed,
      bpmUnconfirmedReserve: existingReserve,
      bpmSearchParams: { bpm: 140, tolerance: 10, genres: ['Electro'] },
    });
    const showToast = vi.fn();
    const favorites = { tracks: [], artists: ['AC/DC'] };
    const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false, favorites);

    await loadMoreBpmResults();

    expect(mockFetchBpmSearchResults).toHaveBeenCalledWith(
      140, 10, ['Electro'],
      expect.any(Function),
      favorites,
      ['deezer-1', 'deezer-2'], // trackId déjà affichés OU en réserve, les 2 piles combinées
      2, // stubCapMultiplier
      null // exclusions, pas fourni au hook dans ce test
    );
  });

  it('transmet `exclusions` à fetchBpmSearchResults (loadMoreBpmResults) quand fourni au hook', async () => {
    mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
    const search = makeSearch();
    const showToast = vi.fn();
    const exclusions = { artists: ['Nickelback'], tracks: [] };
    const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false, null, exclusions);

    await loadMoreBpmResults();

    expect(mockFetchBpmSearchResults).toHaveBeenCalledWith(
      140, 10, ['Rock'], expect.any(Function), null, [], 2, exclusions
    );
  });

  it('fusionne le résultat final avec les résultats déjà affichés (confirmés ET réserve) via mergeAndResortBpmResults', async () => {
    const existingConfirmed = [{ trackId: 'deezer-1', _matchTier: 0 }];
    const existingReserve = [{ trackId: 'deezer-2', _matchTier: 2 }];
    const newConfirmed = [{ trackId: 'deezer-3', _matchTier: 0 }];
    const newUnconfirmed = [{ trackId: 'deezer-4', _matchTier: 2 }];
    mockFetchBpmSearchResults.mockResolvedValue({ results: newConfirmed, unconfirmed: newUnconfirmed });
    const search = makeSearch({ worldSearchResults: existingConfirmed, bpmUnconfirmedReserve: existingReserve });
    const showToast = vi.fn();
    const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

    await loadMoreBpmResults();

    expect(mockMergeAndResortBpmResults).toHaveBeenCalledWith(existingConfirmed, newConfirmed);
    expect(mockMergeAndResortBpmResults).toHaveBeenCalledWith(existingReserve, newUnconfirmed);
    expect(search.setWorldSearchResults).toHaveBeenLastCalledWith([...existingConfirmed, ...newConfirmed]);
    expect(search.setBpmUnconfirmedReserve).toHaveBeenLastCalledWith([...existingReserve, ...newUnconfirmed]);
  });

  it('refuse un appel concurrent si une recherche BPM initiale est déjà en cours (isWorldSearching)', async () => {
    const search = makeSearch({ isWorldSearching: true });
    const showToast = vi.fn();
    const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

    await loadMoreBpmResults();

    expect(mockFetchBpmSearchResults).not.toHaveBeenCalled();
    expect(search.setIsLoadingMoreResults).not.toHaveBeenCalled();
  });

  it('refuse un appel concurrent si un "Charger plus" est déjà en cours (isLoadingMoreResults)', async () => {
    const search = makeSearch({ isLoadingMoreResults: true });
    const showToast = vi.fn();
    const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

    await loadMoreBpmResults();

    expect(mockFetchBpmSearchResults).not.toHaveBeenCalled();
  });

  it('affichage progressif : chaque lot partiel (confirmé et réserve) est fusionné avec la base FIGÉE, jamais un résultat partiel précédent déjà écrit dans le state', async () => {
    const existingConfirmed = [{ trackId: 'deezer-1', _matchTier: 0 }];
    const existingReserve = [];
    let capturedOnProgress;
    mockFetchBpmSearchResults.mockImplementation(async (_bpm, _tol, _genres, onProgress) => {
      capturedOnProgress = onProgress;
      onProgress({ confirmed: [{ trackId: 'deezer-2', _matchTier: 0 }], unconfirmed: [] });
      onProgress({ confirmed: [{ trackId: 'deezer-2', _matchTier: 0 }, { trackId: 'deezer-3', _matchTier: -1 }], unconfirmed: [] });
      return { results: [{ trackId: 'deezer-2', _matchTier: 0 }, { trackId: 'deezer-3', _matchTier: -1 }], unconfirmed: [] };
    });
    const search = makeSearch({ worldSearchResults: existingConfirmed, bpmUnconfirmedReserve: existingReserve });
    const showToast = vi.fn();
    const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

    await loadMoreBpmResults();

    expect(typeof capturedOnProgress).toBe('function');
    // Chaque appel de fusion CONFIRMÉ utilise TOUJOURS `existingConfirmed`
    // comme base — jamais un résultat partiel précédent déjà écrit dans le
    // state (voir la docstring de `loadMoreBpmResults` : "photo figée AVANT
    // ce nouvel appel").
    expect(search.setWorldSearchResults).toHaveBeenCalledWith([...existingConfirmed, { trackId: 'deezer-2', _matchTier: 0 }]);
    expect(search.setWorldSearchResults).toHaveBeenLastCalledWith([...existingConfirmed, { trackId: 'deezer-2', _matchTier: 0 }, { trackId: 'deezer-3', _matchTier: -1 }]);
  });

  // NOUVEAU (28/08, chantier "révéler le non confirmé seulement si vraiment
  // épuisé") — 3 cas déterminant `bpmSearchExhausted` : voir la docstring de
  // `loadMoreBpmResults`, useDeezerSearch.js, pour le raisonnement complet.
  describe('signal bpmSearchExhausted', () => {
    it('trouve un nouveau titre CONFIRMÉ : bpmSearchExhausted reste faux, la réserve n\'est pas révélée', async () => {
      mockFetchBpmSearchResults.mockResolvedValue({ results: [{ trackId: 'nouveau', _matchTier: 0 }], unconfirmed: [] });
      const search = makeSearch();
      const showToast = vi.fn();
      const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

      await loadMoreBpmResults();

      expect(search.setBpmSearchExhausted).not.toHaveBeenCalledWith(true);
    });

    it('trouve seulement un nouveau NON CONFIRMÉ (rien de confirmé) : bpmSearchExhausted reste faux (encore de l\'espoir)', async () => {
      mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [{ trackId: 'nc-nouveau', _matchTier: 2 }] });
      const search = makeSearch();
      const showToast = vi.fn();
      const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

      await loadMoreBpmResults();

      expect(search.setBpmSearchExhausted).not.toHaveBeenCalledWith(true);
    });

    it('ne trouve STRICTEMENT RIEN de nouveau (ni confirmé ni non confirmé) : bpmSearchExhausted passe à vrai, la réserve peut être révélée', async () => {
      mockFetchBpmSearchResults.mockResolvedValue({ results: [], unconfirmed: [] });
      const search = makeSearch();
      const showToast = vi.fn();
      const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

      await loadMoreBpmResults();

      expect(search.setBpmSearchExhausted).toHaveBeenCalledWith(true);
    });
  });

  it('erreur réseau : toast erreur, retombe sur isLoadingMoreResults=false', async () => {
    mockFetchBpmSearchResults.mockRejectedValue(new Error('network down'));
    const search = makeSearch();
    const showToast = vi.fn();
    const { loadMoreBpmResults } = useDeezerSearch(search, showToast, false);

    await loadMoreBpmResults();

    expect(showToast).toHaveBeenCalledWith('Erreur réseau lors de la recherche.', 'error');
    expect(search.setIsLoadingMoreResults).toHaveBeenLastCalledWith(false);
  });
});
