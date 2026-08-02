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
// GeneratorContext/AudioPlayerContext mockés à l'identique du pattern déjà
// établi (voir AthleticProfilePanel.test.jsx pour GeneratorContext seul) —
// seuls les champs RÉELLEMENT lus par PlaylistDetailContext.jsx sont
// fournis (`isNaughtyMode`/`getProfileForWorkout` ; `togglePreview`/
// `playingPreviewId`/`resolveAndPlay`/`resolvingTrackId`), pas la totalité
// de ce que ces contextes exposent ailleurs dans l'app.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/contexts/GeneratorContext.jsx', () => ({
  useGeneratorContext: () => ({
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
