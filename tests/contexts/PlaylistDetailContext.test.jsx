// @vitest-environment jsdom
//
// Test dédié à PlaylistDetailContext.jsx — le Provider n'avait jusqu'ici
// AUCUN test à son propre niveau (voir la passation du 02/08, §5 : monter
// réellement ce Provider exige de mocker GeneratorContext + AudioPlayerContext
// + le moteur de recalcul de timeline, jugé trop coûteux pour ce qui restait
// alors une poignée de lignes triviales). Ajouté ici, DÉLIBÉRÉMENT SCOPÉ à
// UNE seule chose : `isSaved`/`isReadOnly`, PAS une couverture exhaustive de
// tout le Provider (drag-and-drop, graphique BPM, distributions...) — ces
// derniers restent indirectement couverts via TrackItem.test.jsx/
// PlaylistHeader.test.jsx/PlaylistCharts.test.jsx, qui mockent ce contexte
// plutôt que de le faire tourner pour de vrai.
//
// RAISON DE CE TEST (relecture du 02/08, APRÈS la passation ci-dessus) —
// BUG RÉEL CORRIGÉ : `isSaved` comparait autrefois `currentPlaylist.id`
// UNIQUEMENT à `savedPlaylists` (par `id`, jamais par `user_id`), sur
// l'hypothèse qu'une playlist étrangère consultée en aperçu (`isReadOnly`)
// ne peut PAS se retrouver dans la bibliothèque du visiteur. Cette
// hypothèse est fausse : la playlist de démonstration par défaut a l'id
// `'playlist-example-1'`, IDENTIQUE pour chaque nouveau compte tant que
// personne n'a encore sauvegardé sa propre séance (voir §3.2 de la
// passation) — un visiteur qui n'a pas encore personnalisé SA PROPRE
// playlist d'exemple a donc, lui aussi, une entrée à ce même id. Sans
// `isReadOnly` pris en compte, `isSaved` remontait `true` à tort, ce qui
// aurait rendu `canEditTracks` (TrackItem.jsx/TrackList.jsx/
// PlaylistCharts.jsx, tous basés sur `isSaved && !isLocked`) vrai sur une
// playlist censée être strictement en lecture seule — et une mutation de
// titre dans cet état aurait silencieusement écrasé la PROPRE playlist
// d'exemple du visiteur avec le contenu de celle d'autrui (voir
// `applyPlaylistUpdate`, qui écrit par id dans `savedPlaylists`), avant
// synchronisation vers Supabase par `useSyncedCollection`. Correctif :
// `isSaved = !isReadOnly && !!(...)`.
//
// AthleticContext/AudioPlayerContext mockés à l'identique du pattern déjà
// établi (voir AthleticProfilePanel.test.jsx) — seuls les champs RÉELLEMENT
// lus par PlaylistDetailContext.jsx sont fournis (`isNaughtyMode`/
// `getProfileForWorkout` ; `togglePreview`/`playingPreviewId`/
// `resolveAndPlay`/`resolvingTrackId`), pas la totalité de ce que ces
// contextes exposent ailleurs dans l'app.

import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/contexts/AthleticContext.jsx', () => ({
  useAthleticContext: () => ({
    isNaughtyMode: false,
    getProfileForWorkout: vi.fn(() => null),
  }),
}));

vi.mock('../../src/contexts/AudioPlayerContext.jsx', () => ({
  useAudioPlayer: () => ({
    togglePreview: vi.fn(),
    playingPreviewId: null,
    resolveAndPlay: vi.fn(),
    resolvingTrackId: null,
  }),
}));

// Compteur de clonages HONNÊTE (02/08) — `handleTogglePlaylistPublic`
// appelle désormais `supabase.rpc(...)` quand on republie une copie issue
// d'une chaîne de clonage. Jamais mocké avant dans ce fichier (pas besoin
// jusqu'ici).
const mockRpc = vi.fn();
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { rpc: (...args) => mockRpc(...args) },
}));

// `getSingleMatchingTrack`/`findSameArtistReplacement` (check-up 10/08,
// correctif de course "Remplacer un titre"/"Cloner", voir le describe
// dédié plus bas) — jamais mockés avant dans ce fichier (aucun test
// n'exerçait encore `handleReplaceTrack`/`handleReplaceTrackSameArtist`).
// `recalculateTimeline`, elle, reste la VRAIE implémentation — pure et
// déjà testée ailleurs (musicEngine.test.js), aucune raison de la mocker.
const mockGetSingleMatchingTrack = vi.fn();
const mockFindSameArtistReplacement = vi.fn();
vi.mock('../../src/engine/musicEngine.js', async () => {
  const actual = await vi.importActual('../../src/engine/musicEngine.js');
  return {
    ...actual,
    getSingleMatchingTrack: (...args) => mockGetSingleMatchingTrack(...args),
    findSameArtistReplacement: (...args) => mockFindSameArtistReplacement(...args),
  };
});

import { PlaylistDetailProvider, usePlaylistDetail } from '../../src/contexts/PlaylistDetailContext.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Playlist minimale valide — `tracks: []` suffit, tous les `useMemo` du
// Provider gèrent déjà explicitement une liste de titres vide (vérifié en
// lisant chaque calcul concerné avant d'écrire ce test : unifiedChartData,
// bpmDistributionData, genreDistributionData retournent tous `[]`/neutre
// sans planter sur ce cas).
function makePlaylist(overrides = {}) {
  return {
    id: 'playlist-example-1',
    name: 'Ma séance',
    tracks: [],
    workoutType: 'Course à pied',
    config: {},
    ...overrides,
  };
}

// Sonde minimale — expose isSaved/isReadOnly en attributs `data-*` plutôt
// que du texte brut, pour éviter toute ambiguïté `getByText` (voir le piège
// documenté dans la passation, §4 — chaînes composites).
function Probe() {
  const { isSaved, isReadOnly } = usePlaylistDetail();
  return <div data-testid="probe" data-saved={String(isSaved)} data-readonly={String(isReadOnly)} />;
}

function renderWithProvider(currentPlaylist, savedPlaylists) {
  render(
    <PlaylistDetailProvider
      currentPlaylist={currentPlaylist}
      setCurrentPlaylist={() => {}}
      savedPlaylists={savedPlaylists}
      setSavedPlaylists={() => {}}
      favorites={{ tracks: [], artists: [] }}
      spotifyTrackPool={[]}
      userStats={{}}
      checkTrophies={() => {}}
      showToast={() => {}}
      requestRemoveSavedPlaylist={() => {}}
      handleSavePlaylist={() => {}}
      handleClonePlaylist={() => {}}
      currentActualData={null}
      selectedMetric="heartRate"
      setSelectedMetric={() => {}}
      dataOffset={0}
      setDataOffset={() => {}}
      selectedAnalysisDate={null}
      setSelectedAnalysisDate={() => {}}
      availableMetrics={[]}
    >
      <Probe />
    </PlaylistDetailProvider>
  );
}

describe('PlaylistDetailContext — isSaved / isReadOnly', () => {
  it('isSaved=true quand la playlist courante est bien dans savedPlaylists et n\'est PAS en lecture seule', () => {
    const playlist = makePlaylist();
    renderWithProvider(playlist, [playlist]);
    const probe = screen.getByTestId('probe');
    expect(probe.dataset.saved).toBe('true');
    expect(probe.dataset.readonly).toBe('false');
  });

  it('isSaved=false pour une playlist tout juste générée, jamais encore sauvegardée (id absent de savedPlaylists)', () => {
    const playlist = makePlaylist({ id: 'brand-new-not-saved' });
    renderWithProvider(playlist, []);
    const probe = screen.getByTestId('probe');
    expect(probe.dataset.saved).toBe('false');
    expect(probe.dataset.readonly).toBe('false');
  });

  it('isReadOnly=true reflète bien currentPlaylist.isReadOnly (posé par handleOpenPublicPlaylist, App.jsx)', () => {
    const playlist = makePlaylist({ isReadOnly: true });
    renderWithProvider(playlist, []);
    const probe = screen.getByTestId('probe');
    expect(probe.dataset.readonly).toBe('true');
  });

  // ─── RÉGRESSION — le bug réel corrigé le 02/08 ──────────────────────────
  it('BUG CORRIGÉ : isSaved=false même si l\'id de la playlist étrangère (en lecture seule) collisionne avec la propre playlist d\'exemple du visiteur', () => {
    // Reproduit exactement le scénario de la passation : le visiteur a
    // encore SA PROPRE playlist d'exemple, intacte, à l'id
    // 'playlist-example-1' dans sa bibliothèque...
    const ownUnmodifiedDemoPlaylist = makePlaylist({ id: 'playlist-example-1', name: 'Ma séance à moi' });
    // ...et consulte AUSSI, en aperçu lecture seule, la playlist de
    // quelqu'un d'autre qui a EXACTEMENT le même id (même situation :
    // playlist d'exemple jamais renommée côté propriétaire).
    const foreignReadOnlyPlaylist = makePlaylist({ id: 'playlist-example-1', name: 'Séance de quelqu\'un d\'autre', isReadOnly: true });

    renderWithProvider(foreignReadOnlyPlaylist, [ownUnmodifiedDemoPlaylist]);

    const probe = screen.getByTestId('probe');
    // AVANT LE CORRECTIF : cette assertion aurait échoué — `isSaved`
    // valait `true` ici (comparaison par id seul, sans tenir compte
    // d'isReadOnly), ouvrant la voie à canEditTracks=true sur une playlist
    // qui aurait dû rester strictement en lecture seule.
    expect(probe.dataset.saved).toBe('false');
    expect(probe.dataset.readonly).toBe('true');
  });
});

// L'édition combinée titre+description (`handleSavePlaylistDetails`) est
// DÉPLACÉE (08/08) vers PlaylistEditContext.jsx — voir
// tests/contexts/PlaylistEditContext.test.jsx pour sa couverture
// (identique à ce qui vivait ici avant, simplement déplacée avec la
// logique).

// Sonde dédiée à la bascule publique/privée — MÊME schéma que
// `Probe` ci-dessus.
function TogglePublicProbe() {
  const { handleTogglePlaylistPublic } = usePlaylistDetail();
  return <button onClick={handleTogglePlaylistPublic}>toggle-public</button>;
}

function renderWithProviderForTogglePublic(currentPlaylist, savedPlaylists, { setCurrentPlaylist = vi.fn(), setSavedPlaylists = vi.fn() } = {}) {
  return render(
    <PlaylistDetailProvider
      currentPlaylist={currentPlaylist}
      setCurrentPlaylist={setCurrentPlaylist}
      savedPlaylists={savedPlaylists}
      setSavedPlaylists={setSavedPlaylists}
      favorites={{ tracks: [], artists: [] }}
      spotifyTrackPool={[]}
      userStats={{}}
      checkTrophies={() => {}}
      showToast={() => {}}
      requestRemoveSavedPlaylist={() => {}}
      handleSavePlaylist={() => {}}
      handleClonePlaylist={() => {}}
      currentActualData={null}
      selectedMetric="heartRate"
      setSelectedMetric={() => {}}
      dataOffset={0}
      setDataOffset={() => {}}
      selectedAnalysisDate={null}
      setSelectedAnalysisDate={() => {}}
      availableMetrics={[]}
    >
      <TogglePublicProbe />
    </PlaylistDetailProvider>
  );
}

// ⚠️ SIMPLIFIÉ (03/08, refonte lignée serveur, voir supabase-schema.sql) —
// le mécanisme "republier une copie alimente le compteur de son origine"
// (`willClaimOriginCredit`/`originCreditClaimed`) a été retiré : à la
// relecture, c'était du CODE MORT dans tous les cas réels — le clonage
// crédite déjà l'origine INCONDITIONNELLEMENT (que la copie reste privée
// ou non, voir `handleClonePlaylist`, usePlaylistLibrary.js), donc la clé
// du `clone_ledger` pour cette cible est TOUJOURS déjà prise par le temps
// où une republication ultérieure tenterait le même appel — bloquée par
// construction, jamais un vrai 2e crédit. `handleTogglePlaylistPublic`
// n'appelle donc plus AUCUNE RPC désormais, qu'il y ait une lignée de
// clonage/un template ou non.
describe('PlaylistDetailContext — handleTogglePlaylistPublic (simple flip, plus de crédit à réclamer)', () => {
  it('rendre publique une copie issue d\'une chaîne de clonage n\'appelle plus aucune RPC', () => {
    const clonedPlaylist = makePlaylist({ isPublic: false, parentId: 'pl-B-original', parentUserId: 'user-B' });
    renderWithProviderForTogglePublic(clonedPlaylist, [clonedPlaylist]);

    fireEvent.click(screen.getByText('toggle-public'));

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rendre publique une playlist issue d\'un TEMPLATE (sourceTemplateId) n\'appelle plus aucune RPC non plus', () => {
    const templatePlaylist = makePlaylist({ isPublic: false, sourceTemplateId: 'tpl-cardio' });
    renderWithProviderForTogglePublic(templatePlaylist, [templatePlaylist]);

    fireEvent.click(screen.getByText('toggle-public'));

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('la bascule reste un simple flip local de isPublic, peu importe la lignée', () => {
    const setSavedPlaylists = vi.fn();
    const clonedPlaylist = makePlaylist({ isPublic: false, parentId: 'pl-A-original', parentUserId: 'user-A' });
    renderWithProviderForTogglePublic(clonedPlaylist, [clonedPlaylist], { setSavedPlaylists });

    fireEvent.click(screen.getByText('toggle-public'));

    const updated = setSavedPlaylists.mock.calls[0][0][0];
    expect(updated.isPublic).toBe(true);
  });
});

// NOUVEAU (check-up 10/08) — `handleReplaceTrack`/`handleReplaceTrackSameArtist`
// n'avaient jusqu'ici AUCUN test (aucun mock de musicEngine.js dans ce
// fichier avant ce chantier). Ciblé UNIQUEMENT sur le correctif de course
// ajouté ce jour-là — pas une couverture exhaustive de ces 2 fonctions
// (choix du titre de remplacement, repli élargi, etc.), hors périmètre ici.
function ReplaceProbe() {
  const { handleReplaceTrack, handleReplaceTrackSameArtist } = usePlaylistDetail();
  return (
    <div>
      <button onClick={() => handleReplaceTrack(0)}>trigger-replace</button>
      <button onClick={() => handleReplaceTrackSameArtist(0)}>trigger-replace-same-artist</button>
    </div>
  );
}

function makeReplaceableTrack(overrides = {}) {
  return { id: 't1', trackId: 'deezer-1', title: 'Ancien titre', artist: 'Ancien Artiste', bpm: 140, targetSegmentBpm: 140, duration: 200, ...overrides };
}

function renderProviderForReplace(props = {}) {
  const merged = {
    currentPlaylist: makePlaylist({ tracks: [makeReplaceableTrack()] }),
    setCurrentPlaylist: vi.fn(),
    savedPlaylists: [],
    setSavedPlaylists: vi.fn(),
    favorites: { tracks: [], artists: [] },
    spotifyTrackPool: [],
    userStats: { replacedTracks: 0 },
    checkTrophies: vi.fn(),
    showToast: vi.fn(),
    requestRemoveSavedPlaylist: vi.fn(),
    handleSavePlaylist: vi.fn(),
    handleClonePlaylist: vi.fn(),
    currentActualData: null,
    selectedMetric: 'heartRate',
    setSelectedMetric: vi.fn(),
    dataOffset: 0,
    setDataOffset: vi.fn(),
    selectedAnalysisDate: null,
    setSelectedAnalysisDate: vi.fn(),
    availableMetrics: [],
    ...props,
  };
  return render(
    <PlaylistDetailProvider {...merged}>
      <ReplaceProbe />
    </PlaylistDetailProvider>
  );
}

function createDeferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

describe('PlaylistDetailContext — course "Remplacer un titre" / changement de playlist en cours de route (régression 10/08)', () => {
  it('handleReplaceTrack : changer de playlist AVANT la fin de la recherche annule le remplacement (aucune écriture, toast d\'annulation)', async () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const showToast = vi.fn();
    const deferred = createDeferred();
    mockGetSingleMatchingTrack.mockImplementationOnce(() => deferred.promise);

    const checkTrophies = vi.fn();
    const playlistA = makePlaylist({ id: 'plA', tracks: [makeReplaceableTrack()] });
    const { rerender } = render(
      <PlaylistDetailProvider
        currentPlaylist={playlistA} setCurrentPlaylist={setCurrentPlaylist}
        savedPlaylists={[playlistA]} setSavedPlaylists={setSavedPlaylists}
        favorites={{ tracks: [], artists: [] }} spotifyTrackPool={[]}
        userStats={{ replacedTracks: 0 }} checkTrophies={checkTrophies}
        showToast={showToast} requestRemoveSavedPlaylist={vi.fn()}
        handleSavePlaylist={vi.fn()} handleClonePlaylist={vi.fn()}
        currentActualData={null} selectedMetric="heartRate" setSelectedMetric={vi.fn()}
        dataOffset={0} setDataOffset={vi.fn()}
        selectedAnalysisDate={null} setSelectedAnalysisDate={vi.fn()} availableMetrics={[]}
      >
        <ReplaceProbe />
      </PlaylistDetailProvider>
    );

    fireEvent.click(screen.getByText('trigger-replace'));

    // "Cloner" (ou toute autre bascule en place) — currentPlaylist passe de
    // plA à plB SANS démonter ce Provider, exactement comme un vrai
    // clonage le fait (usePlaylistLibrary.js, handleClonePlaylist).
    const playlistB = makePlaylist({ id: 'plB', tracks: [makeReplaceableTrack({ id: 't2' })] });
    rerender(
      <PlaylistDetailProvider
        currentPlaylist={playlistB} setCurrentPlaylist={setCurrentPlaylist}
        savedPlaylists={[playlistB, playlistA]} setSavedPlaylists={setSavedPlaylists}
        favorites={{ tracks: [], artists: [] }} spotifyTrackPool={[]}
        userStats={{ replacedTracks: 0 }} checkTrophies={checkTrophies}
        showToast={showToast} requestRemoveSavedPlaylist={vi.fn()}
        handleSavePlaylist={vi.fn()} handleClonePlaylist={vi.fn()}
        currentActualData={null} selectedMetric="heartRate" setSelectedMetric={vi.fn()}
        dataOffset={0} setDataOffset={vi.fn()}
        selectedAnalysisDate={null} setSelectedAnalysisDate={vi.fn()} availableMetrics={[]}
      >
        <ReplaceProbe />
      </PlaylistDetailProvider>
    );

    // La recherche de plA se termine maintenant — APRÈS le changement de
    // playlist.
    deferred.resolve({ title: 'Nouveau titre', artist: 'Nouvel Artiste', genre: 'Rock', bpm: 145, duration: 210, trackId: 'deezer-99', preview: null });
    await new Promise((r) => setTimeout(r, 0));

    // La vraie assertion : plA (obsolète) n'a JAMAIS écrit dans le state —
    // ni ramené l'affichage dessus, ni recréé savedPlaylists à partir d'une
    // version amputée de plB (qui causerait sa suppression via
    // useSyncedCollection.js).
    expect(setCurrentPlaylist).not.toHaveBeenCalled();
    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Remplacement annulé'));
    // BUG CORRIGÉ (25/08) : un remplacement ANNULÉ ne doit PAS faire
    // progresser le trophée "remplacer N titres" — avant ce correctif,
    // checkTrophies était appelé tout en haut de handleReplaceTrack, avant
    // même de savoir si le remplacement allait aboutir.
    expect(checkTrophies).not.toHaveBeenCalled();
  });

  it('handleReplaceTrack : SANS changement de playlist, le remplacement s\'applique normalement (comportement inchangé)', async () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const showToast = vi.fn();
    const checkTrophies = vi.fn();
    mockGetSingleMatchingTrack.mockResolvedValue({ title: 'Nouveau titre', artist: 'Nouvel Artiste', genre: 'Rock', bpm: 145, duration: 210, trackId: 'deezer-99', preview: null });

    const playlistA = makePlaylist({ id: 'plA', tracks: [makeReplaceableTrack()] });
    renderProviderForReplace({ currentPlaylist: playlistA, savedPlaylists: [playlistA], setCurrentPlaylist, setSavedPlaylists, showToast, checkTrophies, userStats: { replacedTracks: 0 } });

    fireEvent.click(screen.getByText('trigger-replace'));
    await waitFor(() => expect(setCurrentPlaylist).toHaveBeenCalled());

    // ⚠️ setCurrentPlaylist reçoit désormais une FONCTION de mise à jour
    // (`prev => ...`, correctif de course du 20/08 — voir la docstring
    // d'applyPlaylistUpdate) et non plus l'objet playlist directement. Le
    // mock ici (`vi.fn()`) n'exécute rien tout seul — on invoque la
    // fonction nous-mêmes avec `playlistA` comme `prev`, exactement ce que
    // React ferait avec le VRAI state.
    const updater = setCurrentPlaylist.mock.calls[0][0];
    const updated = typeof updater === 'function' ? updater(playlistA) : updater;
    expect(updated.tracks[0].title).toBe('Nouveau titre');
    expect(showToast).toHaveBeenCalledWith('🎵 Titre remplacé et durée ajustée !');
    // Cas miroir du test d'annulation ci-dessus (25/08) : un remplacement
    // qui ABOUTIT réellement doit, lui, bien faire progresser le trophée.
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ replacedTracks: 1 }));
  });

  it('handleReplaceTrackSameArtist : changer de playlist pendant le repli élargi (2e appel réseau) annule aussi le remplacement', async () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const showToast = vi.fn();
    mockFindSameArtistReplacement.mockResolvedValue(null); // force le repli élargi
    const deferred = createDeferred();
    mockGetSingleMatchingTrack.mockImplementationOnce(() => deferred.promise);

    const playlistA = makePlaylist({ id: 'plA', tracks: [makeReplaceableTrack()] });
    const { rerender } = render(
      <PlaylistDetailProvider
        currentPlaylist={playlistA} setCurrentPlaylist={setCurrentPlaylist}
        savedPlaylists={[playlistA]} setSavedPlaylists={setSavedPlaylists}
        favorites={{ tracks: [], artists: [] }} spotifyTrackPool={[]}
        userStats={{ replacedTracks: 0 }} checkTrophies={vi.fn()}
        showToast={showToast} requestRemoveSavedPlaylist={vi.fn()}
        handleSavePlaylist={vi.fn()} handleClonePlaylist={vi.fn()}
        currentActualData={null} selectedMetric="heartRate" setSelectedMetric={vi.fn()}
        dataOffset={0} setDataOffset={vi.fn()}
        selectedAnalysisDate={null} setSelectedAnalysisDate={vi.fn()} availableMetrics={[]}
      >
        <ReplaceProbe />
      </PlaylistDetailProvider>
    );

    fireEvent.click(screen.getByText('trigger-replace-same-artist'));
    await waitFor(() => expect(mockFindSameArtistReplacement).toHaveBeenCalled());

    const playlistB = makePlaylist({ id: 'plB', tracks: [makeReplaceableTrack({ id: 't2' })] });
    rerender(
      <PlaylistDetailProvider
        currentPlaylist={playlistB} setCurrentPlaylist={setCurrentPlaylist}
        savedPlaylists={[playlistB, playlistA]} setSavedPlaylists={setSavedPlaylists}
        favorites={{ tracks: [], artists: [] }} spotifyTrackPool={[]}
        userStats={{ replacedTracks: 0 }} checkTrophies={vi.fn()}
        showToast={showToast} requestRemoveSavedPlaylist={vi.fn()}
        handleSavePlaylist={vi.fn()} handleClonePlaylist={vi.fn()}
        currentActualData={null} selectedMetric="heartRate" setSelectedMetric={vi.fn()}
        dataOffset={0} setDataOffset={vi.fn()}
        selectedAnalysisDate={null} setSelectedAnalysisDate={vi.fn()} availableMetrics={[]}
      >
        <ReplaceProbe />
      </PlaylistDetailProvider>
    );

    deferred.resolve({ title: 'Nouveau titre', artist: 'Nouvel Artiste', genre: 'Rock', bpm: 145, duration: 210, trackId: 'deezer-99', preview: null });
    await new Promise((r) => setTimeout(r, 0));

    expect(setCurrentPlaylist).not.toHaveBeenCalled();
    expect(setSavedPlaylists).not.toHaveBeenCalled();
  });
});

// RÉGRESSION (28/08, sanity check périodique) — 3e occurrence du même motif
// structurel déjà rencontré 6 fois sur ce projet (voir la docstring du
// Provider, "AJOUTÉ (28/08...)") : `checkTrophies` dans `handleReplaceTrack`
// utilisait `userStats` FIGÉ au moment du clic plutôt que sa version la plus
// fraîche au moment où l'appel réseau (`getSingleMatchingTrack`) se termine
// réellement.
describe('PlaylistDetailContext — course "userStats obsolète dans checkTrophies" (régression 28/08)', () => {
  it('userStats ayant changé PENDANT la recherche réseau, checkTrophies reçoit la version FRAÎCHE, pas celle figée au clic', async () => {
    const checkTrophies = vi.fn();
    const deferred = createDeferred();
    mockGetSingleMatchingTrack.mockImplementationOnce(() => deferred.promise);

    const playlistA = makePlaylist({ id: 'plA', tracks: [makeReplaceableTrack()] });
    const { rerender } = render(
      <PlaylistDetailProvider
        currentPlaylist={playlistA} setCurrentPlaylist={vi.fn()}
        savedPlaylists={[playlistA]} setSavedPlaylists={vi.fn()}
        favorites={{ tracks: [], artists: [] }} spotifyTrackPool={[]}
        userStats={{ replacedTracks: 0 }} checkTrophies={checkTrophies}
        showToast={vi.fn()} requestRemoveSavedPlaylist={vi.fn()}
        handleSavePlaylist={vi.fn()} handleClonePlaylist={vi.fn()}
        currentActualData={null} selectedMetric="heartRate" setSelectedMetric={vi.fn()}
        dataOffset={0} setDataOffset={vi.fn()}
        selectedAnalysisDate={null} setSelectedAnalysisDate={vi.fn()} availableMetrics={[]}
      >
        <ReplaceProbe />
      </PlaylistDetailProvider>
    );

    fireEvent.click(screen.getByText('trigger-replace'));

    // Une tout autre action (ex. terminer une séance ailleurs dans l'app)
    // fait évoluer userStats PENDANT que la recherche réseau est en vol —
    // MÊME playlist, MÊME id, donc currentPlaylistIdRef ne bloque rien ici
    // (à raison : le remplacement doit bien aboutir).
    rerender(
      <PlaylistDetailProvider
        currentPlaylist={playlistA} setCurrentPlaylist={vi.fn()}
        savedPlaylists={[playlistA]} setSavedPlaylists={vi.fn()}
        favorites={{ tracks: [], artists: [] }} spotifyTrackPool={[]}
        userStats={{ replacedTracks: 0, hasStreak3: true }} checkTrophies={checkTrophies}
        showToast={vi.fn()} requestRemoveSavedPlaylist={vi.fn()}
        handleSavePlaylist={vi.fn()} handleClonePlaylist={vi.fn()}
        currentActualData={null} selectedMetric="heartRate" setSelectedMetric={vi.fn()}
        dataOffset={0} setDataOffset={vi.fn()}
        selectedAnalysisDate={null} setSelectedAnalysisDate={vi.fn()} availableMetrics={[]}
      >
        <ReplaceProbe />
      </PlaylistDetailProvider>
    );

    deferred.resolve({ title: 'Nouveau titre', artist: 'Nouvel Artiste', genre: 'Rock', bpm: 145, duration: 210, trackId: 'deezer-99', preview: null });
    await new Promise((r) => setTimeout(r, 0));

    expect(checkTrophies).toHaveBeenCalledTimes(1);
    const statsPassed = checkTrophies.mock.calls[0][0];
    expect(statsPassed.hasStreak3).toBe(true); // pas perdu
    expect(statsPassed.replacedTracks).toBe(1); // +1 appliqué sur la base fraîche
  });
});

// ─────────────────────────────────────────────────────────────────────────
// RÉGRESSION (20/08) — "écritures concurrentes de MÊME TYPE sur la MÊME
// playlist", limite connue et NON corrigée depuis le check-up du 10/08
// (voir README, "Limite connue, non traitée"). Les tests ci-dessus
// vérifient le changement de PLAYLIST pendant une recherche — celui-ci
// vérifie le cas resté ouvert : 2 titres DIFFÉRENTS de la MÊME playlist,
// remplacés coup sur coup sans attendre le premier.
//
// Du VRAI state React ici (`useState`, pas des `vi.fn()` inertes comme les
// tests ci-dessus) — nécessaire pour vérifier le comportement RÉEL de 2
// mises à jour fonctionnelles enchaînées (`setCurrentPlaylist(prev => ...)`)
// plutôt qu'une simulation manuelle qui pourrait diverger de ce que React
// fait vraiment.
function RaceProbe() {
  const { handleReplaceTrack, currentPlaylist } = usePlaylistDetail();
  return (
    <div>
      <button onClick={() => handleReplaceTrack(0)}>trigger-replace-0</button>
      <button onClick={() => handleReplaceTrack(1)}>trigger-replace-1</button>
      <div data-testid="tracks">{currentPlaylist?.tracks.map(t => t.title).join(',')}</div>
    </div>
  );
}

function RealStateWrapper({ initialPlaylist }) {
  const [currentPlaylist, setCurrentPlaylist] = useState(initialPlaylist);
  const [savedPlaylists, setSavedPlaylists] = useState([initialPlaylist]);
  return (
    <PlaylistDetailProvider
      currentPlaylist={currentPlaylist} setCurrentPlaylist={setCurrentPlaylist}
      savedPlaylists={savedPlaylists} setSavedPlaylists={setSavedPlaylists}
      favorites={{ tracks: [], artists: [] }} spotifyTrackPool={[]}
      userStats={{ replacedTracks: 0 }} checkTrophies={vi.fn()}
      showToast={vi.fn()} requestRemoveSavedPlaylist={vi.fn()}
      handleSavePlaylist={vi.fn()} handleClonePlaylist={vi.fn()}
      currentActualData={null} selectedMetric="heartRate" setSelectedMetric={vi.fn()}
      dataOffset={0} setDataOffset={vi.fn()}
      selectedAnalysisDate={null} setSelectedAnalysisDate={vi.fn()} availableMetrics={[]}
    >
      <RaceProbe />
    </PlaylistDetailProvider>
  );
}

describe('PlaylistDetailContext — course "2 titres différents de la MÊME playlist" (régression 20/08, README)', () => {
  it('BUG CORRIGÉ : 2 "Remplacer" lancés coup sur coup sur 2 titres différents — aucun des deux n\'est perdu', async () => {
    const deferredA = createDeferred();
    const deferredB = createDeferred();
    mockGetSingleMatchingTrack
      .mockImplementationOnce(() => deferredA.promise)
      .mockImplementationOnce(() => deferredB.promise);

    const initialPlaylist = makePlaylist({
      id: 'plRace',
      tracks: [
        makeReplaceableTrack({ id: 't1', title: 'Titre A' }),
        makeReplaceableTrack({ id: 't2', title: 'Titre B' }),
      ],
    });

    render(<RealStateWrapper initialPlaylist={initialPlaylist} />);

    // Clic sur "Remplacer" du titre A (index 0) — recherche réseau lancée,
    // PAS encore résolue.
    fireEvent.click(screen.getByText('trigger-replace-0'));
    // AVANT que ça ne réponde, clic sur "Remplacer" du titre B (index 1) —
    // exactement le scénario du README ("cliquer 'Remplacer' sur deux
    // titres différents de la même playlist coup sur coup").
    fireEvent.click(screen.getByText('trigger-replace-1'));

    // La recherche de A se résout EN PREMIER.
    await act(async () => {
      deferredA.resolve({ title: 'Nouveau A', artist: 'Artiste A', genre: 'Rock', bpm: 145, duration: 210, trackId: 'deezer-A', preview: null });
      await deferredA.promise;
    });
    // PUIS celle de B.
    await act(async () => {
      deferredB.resolve({ title: 'Nouveau B', artist: 'Artiste B', genre: 'Rock', bpm: 150, duration: 220, trackId: 'deezer-B', preview: null });
      await deferredB.promise;
    });

    // AVANT LE CORRECTIF : le remplacement de A aurait été perdu — la mise
    // à jour de B, bâtie sur `currentPlaylist.tracks` capturé dans SA
    // PROPRE fermeture (au moment de SON clic, donc AVANT que A n'ait
    // écrit sa propre mise à jour), écrasait silencieusement le
    // remplacement de A en réappliquant l'ancien tableau par-dessus.
    const tracksText = screen.getByTestId('tracks').textContent;
    expect(tracksText).toContain('Nouveau A');
    expect(tracksText).toContain('Nouveau B');
  });

  it('même scénario mais B se résout AVANT A (ordre inverse) — toujours aucune perte', async () => {
    const deferredA = createDeferred();
    const deferredB = createDeferred();
    mockGetSingleMatchingTrack
      .mockImplementationOnce(() => deferredA.promise)
      .mockImplementationOnce(() => deferredB.promise);

    const initialPlaylist = makePlaylist({
      id: 'plRace2',
      tracks: [
        makeReplaceableTrack({ id: 't1', title: 'Titre A' }),
        makeReplaceableTrack({ id: 't2', title: 'Titre B' }),
      ],
    });

    render(<RealStateWrapper initialPlaylist={initialPlaylist} />);

    fireEvent.click(screen.getByText('trigger-replace-0'));
    fireEvent.click(screen.getByText('trigger-replace-1'));

    // Ordre INVERSÉ cette fois — B se résout en premier.
    await act(async () => {
      deferredB.resolve({ title: 'Nouveau B', artist: 'Artiste B', genre: 'Rock', bpm: 150, duration: 220, trackId: 'deezer-B', preview: null });
      await deferredB.promise;
    });
    await act(async () => {
      deferredA.resolve({ title: 'Nouveau A', artist: 'Artiste A', genre: 'Rock', bpm: 145, duration: 210, trackId: 'deezer-A', preview: null });
      await deferredA.promise;
    });

    const tracksText = screen.getByTestId('tracks').textContent;
    expect(tracksText).toContain('Nouveau A');
    expect(tracksText).toContain('Nouveau B');
  });
});
