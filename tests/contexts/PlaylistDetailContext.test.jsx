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
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MAX_DESCRIPTION_LENGTH } from '../../src/appConfig.js';

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

// Compteur de clonages HONNÊTE (02/08) — `handleTogglePlaylistPublic`
// appelle désormais `supabase.rpc(...)` quand on republie une copie issue
// d'une chaîne de clonage. Jamais mocké avant dans ce fichier (pas besoin
// jusqu'ici).
const mockRpc = vi.fn();
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { rpc: (...args) => mockRpc(...args) },
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

// Variante instrumentée (setters capturés via vi.fn(), pas des no-op) —
// nécessaire pour le chantier "édition combinée titre+description"
// ci-dessous : contrairement à isSaved/isReadOnly (valeurs DÉRIVÉES, pas
// de setter à vérifier), on doit pouvoir observer CE AVEC QUOI
// `setCurrentPlaylist`/`setSavedPlaylists` sont appelés après
// `handleSavePlaylistDetails`.
function renderWithProviderCapturing(currentPlaylist, savedPlaylists, { setCurrentPlaylist = vi.fn(), setSavedPlaylists = vi.fn() } = {}) {
  render(
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
      <DetailsProbe />
    </PlaylistDetailProvider>
  );
}

// Sonde dédiée à l'édition combinée titre+description (fusion du 08/08,
// retour direct : "que modifier le titre ou la description vienne un seul
// crayon plutôt que via chacune une option individuelle") — DÉLIBÉRÉMENT
// séparée de `Probe` (isSaved/isReadOnly) plutôt que de tout fusionner en
// une seule sonde fourre-tout : chaque describe ci-dessous ne rend que ce
// dont il a besoin, cohérent avec le principe déjà énoncé en tête de
// fichier (scope volontairement restreint, pas une couverture exhaustive
// du Provider).
function DetailsProbe() {
  const {
    editedPlaylistName, setEditedPlaylistName,
    editedPlaylistDescription, setEditedPlaylistDescription,
    handleSavePlaylistDetails, isEditingPlaylistDetails,
  } = usePlaylistDetail();
  return (
    <div>
      <span data-testid="editing-state">{String(isEditingPlaylistDetails)}</span>
      <input data-testid="name-draft-input" value={editedPlaylistName} onChange={(e) => setEditedPlaylistName(e.target.value)} />
      <input data-testid="draft-input" value={editedPlaylistDescription} onChange={(e) => setEditedPlaylistDescription(e.target.value)} />
      <button onClick={handleSavePlaylistDetails}>save-details</button>
    </div>
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

// Vague 2, Chantier 3 — "description texte libre sur une playlist
// publique" (02/08 — nom d'origine du chantier mentionnait aussi les
// routines, RETIRÉ pour elles le 08/08, voir RoutinesView.jsx ; reste
// actif ici, côté playlist). FUSIONNÉ avec l'édition du nom le 08/08
// (retour direct : "que modifier le titre ou la description vienne un
// seul crayon plutôt que via chacune une option individuelle") — un seul
// handler, `handleSavePlaylistDetails`, sauvegarde les DEUX champs
// ensemble. On vérifie ici qu'il appelle bien LES DEUX setters
// (`setCurrentPlaylist` ET `setSavedPlaylists`).
describe('PlaylistDetailContext — édition combinée titre+description (handleSavePlaylistDetails)', () => {
  it('met à jour currentPlaylist ET savedPlaylists avec la description éditée, en la découpant sur les espaces superflus', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ description: '' });
    renderWithProviderCapturing(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: '  Ma nouvelle description  ' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ description: 'Ma nouvelle description' }));
    expect(setSavedPlaylists).toHaveBeenCalledWith([expect.objectContaining({ description: 'Ma nouvelle description' })]);
  });

  // NOUVEAU (08/08) — le VRAI risque identifié AVANT d'implémenter la
  // fusion (pas trouvé après coup) : les 2 anciens handlers séparés
  // lisaient chacun `currentPlaylist` depuis la MÊME fermeture de rendu —
  // les appeler l'un après l'autre (au lieu de les fusionner en un seul
  // `updatedPlaylist`) aurait fait perdre le 1er changement, le 2e
  // handler construisant son objet à partir de l'ancien `currentPlaylist`
  // (React ne reflète un `setState` qu'au rendu SUIVANT). Ce test
  // reproduit exactement le scénario qui aurait révélé ce bug : nom ET
  // description modifiés dans la MÊME session d'édition, sauvegardés en
  // UN SEUL clic — les deux doivent survivre.
  it('modifier le NOM et la DESCRIPTION dans la même édition, puis sauvegarder UNE FOIS, garde les deux changements (régression du risque de course identifié avant implémentation)', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ name: 'Ancien nom', description: 'Ancienne description' });
    renderWithProviderCapturing(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: 'Nouveau nom' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Nouvelle description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledTimes(1);
    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nouveau nom', description: 'Nouvelle description' }));
  });

  // Nom JAMAIS vide (une playlist sans nom n'aurait aucun sens) — mais
  // contrairement à l'ancien comportement (avorter TOUTE la sauvegarde,
  // description comprise, si le nom était vidé), un nom vidé PAR MÉGARDE
  // en éditant la description à côté replie désormais sur l'ANCIEN nom,
  // sans perdre la description tapée en même temps.
  it('un nom vidé (chaîne vide après trim) replie sur l\'ancien nom SANS perdre la description modifiée à côté', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist({ name: 'Nom original', description: '' });
    renderWithProviderCapturing(playlist, [playlist], { setCurrentPlaylist });

    fireEvent.change(screen.getByTestId('name-draft-input'), { target: { value: '   ' } });
    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Une description quand même' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nom original', description: 'Une description quand même' }));
  });

  it('accepte une description VIDE (contrairement au nom, effacer la description est un état valide)', () => {
    const setCurrentPlaylist = vi.fn();
    const setSavedPlaylists = vi.fn();
    const playlist = makePlaylist({ description: 'Une description déjà présente' });
    renderWithProviderCapturing(playlist, [playlist], { setCurrentPlaylist, setSavedPlaylists });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: '' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ description: '' }));
  });

  it('tronque à MAX_DESCRIPTION_LENGTH même si le texte fourni est plus long (défense en profondeur, pas juste le `maxLength` du textarea)', () => {
    const setCurrentPlaylist = vi.fn();
    const playlist = makePlaylist({ description: '' });
    renderWithProviderCapturing(playlist, [playlist], { setCurrentPlaylist });

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
    renderWithProviderCapturing(clonedPlaylist, [clonedPlaylist], { setCurrentPlaylist });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Ma propre description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(expect.objectContaining({ isModifiedSinceClone: true }));
  });

  it('éditer la description d\'une playlist SANS origine (jamais clonée) ne pose PAS isModifiedSinceClone — rien à marquer', () => {
    const setCurrentPlaylist = vi.fn();
    const ownPlaylist = makePlaylist({ description: '' });
    renderWithProviderCapturing(ownPlaylist, [ownPlaylist], { setCurrentPlaylist });

    fireEvent.change(screen.getByTestId('draft-input'), { target: { value: 'Ma description' } });
    fireEvent.click(screen.getByText('save-details'));

    expect(setCurrentPlaylist.mock.calls[0][0].isModifiedSinceClone).toBeUndefined();
  });
});

// Sonde dédiée à la bascule publique/privée — MÊME schéma que
// DetailsProbe ci-dessus.
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
