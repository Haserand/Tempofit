// @vitest-environment jsdom
//
// Premier fichier de test pour useCsvImport.js (aucun test dédié n'existait
// avant ce chantier). Ciblé UNIQUEMENT sur le correctif de course ajouté au
// check-up du 10/08 (4e occurrence de la même famille cette session, voir
// PlaylistDetailView.jsx/PlaylistDetailContext.jsx/usePlaylistGeneration.js
// pour les 3 précédentes) — pas une couverture exhaustive du parsing CSV
// lui-même (colonnes cadence/FC, format à guillemets...), déjà testé
// séparément dans workoutDataEngine.test.js.
//
// `FileReader` remplacé par un FAUX constructeur contrôlable manuellement
// (`onload` déclenché explicitement par le test, PAS par une vraie lecture
// de fichier) — seul moyen fiable d'insérer un point de pause EXACT entre
// le déclenchement de l'import et la fin de la lecture, pour simuler un
// changement de playlist survenu PENDANT ce laps de temps.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockParseGarminCsv = vi.fn();
vi.mock('../../src/engine/workoutDataEngine.js', () => ({
  parseGarminCsv: (...args) => mockParseGarminCsv(...args),
}));

import { useCsvImport } from '../../src/hooks/useCsvImport.js';

class FakeFileReader {
  constructor() {
    this.onload = null;
    FakeFileReader.instances.push(this);
  }
  readAsText() { /* no-op — le test déclenche onload manuellement */ }
}
FakeFileReader.instances = [];

let realFileReader;
beforeEach(() => {
  FakeFileReader.instances = [];
  realFileReader = global.FileReader;
  global.FileReader = FakeFileReader;
});

afterEach(() => {
  global.FileReader = realFileReader;
  vi.clearAllMocks();
});

function makePlaylist(overrides = {}) {
  return { id: 'plA', name: 'Ma séance', actualDataByDate: {}, ...overrides };
}

function baseProps(overrides = {}) {
  return {
    fileInputRef: { current: null },
    csvUploadTargetDate: '2026-08-10',
    setCsvUploadTargetDate: vi.fn(),
    currentPlaylist: makePlaylist(),
    setCurrentPlaylist: vi.fn(),
    savedPlaylists: [makePlaylist()],
    setSavedPlaylists: vi.fn(),
    setSelectedAnalysisDate: vi.fn(),
    setSelectedMetric: vi.fn(),
    userStats: { dataImports: 0 },
    checkTrophies: vi.fn(),
    changeView: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
}

function renderCsvImportHook(initialProps) {
  return renderHook(
    (props) => useCsvImport(props),
    { initialProps }
  );
}

function makeFakeEvent(fileName = 'export.csv') {
  return { target: { files: [new File(['x'], fileName)], value: '' } };
}

describe('useCsvImport — course "Importer CSV" / changement de playlist pendant la lecture du fichier (régression 10/08)', () => {
  it('changer de playlist AVANT la fin de la lecture annule l\'import (aucune écriture, toast d\'annulation)', () => {
    const setSavedPlaylists = vi.fn();
    const setCurrentPlaylist = vi.fn();
    const showToast = vi.fn();
    mockParseGarminCsv.mockReturnValue({ ok: true, data: [{ t: 0, cadence: 170 }], hasCadence: true, hasHeartRate: false });

    const playlistA = makePlaylist({ id: 'plA' });
    const { result, rerender } = renderCsvImportHook(
      baseProps({ currentPlaylist: playlistA, savedPlaylists: [playlistA], setSavedPlaylists, setCurrentPlaylist, showToast })
    );

    act(() => { result.current.handleCSVUpload(makeFakeEvent()); });
    expect(FakeFileReader.instances).toHaveLength(1);

    // "Cloner" (ou toute autre bascule en place) — currentPlaylist change de
    // plA à plB AVANT que la lecture du fichier ne se termine.
    const playlistB = makePlaylist({ id: 'plB' });
    rerender(baseProps({ currentPlaylist: playlistB, savedPlaylists: [playlistB, playlistA], setSavedPlaylists, setCurrentPlaylist, showToast }));

    // La lecture de plA se termine maintenant — APRÈS le changement de
    // playlist.
    act(() => { FakeFileReader.instances[0].onload({ target: { result: 'fake,csv,content' } }); });

    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(setCurrentPlaylist).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Import annulé'));
  });

  it('SANS changement de playlist, l\'import s\'applique normalement (comportement inchangé)', () => {
    const setSavedPlaylists = vi.fn();
    const setCurrentPlaylist = vi.fn();
    const showToast = vi.fn();
    mockParseGarminCsv.mockReturnValue({ ok: true, data: [{ t: 0, cadence: 170 }], hasCadence: true, hasHeartRate: false });

    const playlistA = makePlaylist({ id: 'plA' });
    const { result } = renderCsvImportHook(
      baseProps({ currentPlaylist: playlistA, savedPlaylists: [playlistA], setSavedPlaylists, setCurrentPlaylist, showToast })
    );

    act(() => { result.current.handleCSVUpload(makeFakeEvent()); });
    act(() => { FakeFileReader.instances[0].onload({ target: { result: 'fake,csv,content' } }); });

    expect(setCurrentPlaylist).toHaveBeenCalledTimes(1);
    const updated = setCurrentPlaylist.mock.calls[0][0];
    expect(updated.actualDataByDate['2026-08-10']).toEqual([{ t: 0, cadence: 170 }]);
    expect(setSavedPlaylists).toHaveBeenCalledTimes(1);
  });
});

// RÉGRESSION (19/08, check-up global) — 2e occurrence du même motif
// structurel dans ce fichier (voir la docstring de useCsvImport.js) : le
// `finally` de handleCSVUpload effaçait `csvUploadTargetDate` SANS
// CONDITION, pouvant clairer par erreur la date d'un 2e import lancé
// pendant que le 1er lisait encore son fichier — même famille de bug que
// le correctif du 10/08 ci-dessus, mais sur un state différent
// (csvUploadTargetDate plutôt que currentPlaylist/savedPlaylists).
describe('useCsvImport — course "2e import lancé pendant la lecture du 1er" (régression 19/08)', () => {
  it('un 2e import (autre date) lancé pendant la lecture du 1er n\'efface PAS csvUploadTargetDate à tort', () => {
    const setCsvUploadTargetDate = vi.fn();
    const setCurrentPlaylist = vi.fn();
    const showToast = vi.fn();
    mockParseGarminCsv.mockReturnValue({ ok: true, data: [{ t: 0, cadence: 170 }], hasCadence: true, hasHeartRate: false });

    const playlistA = makePlaylist({ id: 'plA' });
    const { result, rerender } = renderCsvImportHook(
      baseProps({ currentPlaylist: playlistA, savedPlaylists: [playlistA], csvUploadTargetDate: '2026-08-10', setCsvUploadTargetDate, setCurrentPlaylist, showToast })
    );

    // Import pour la date A (2026-08-10) lancé, lecture en vol.
    act(() => { result.current.handleCSVUpload(makeFakeEvent()); });
    expect(FakeFileReader.instances).toHaveLength(1);

    // L'utilisateur lance un 2e import, pour une AUTRE date (2026-08-12),
    // AVANT que la lecture du 1er fichier ne se termine — csvUploadTargetDate
    // passe donc à la nouvelle date avant même que le finally du 1er import
    // ne s'exécute.
    rerender(baseProps({ currentPlaylist: playlistA, savedPlaylists: [playlistA], csvUploadTargetDate: '2026-08-12', setCsvUploadTargetDate, setCurrentPlaylist, showToast }));

    // La lecture du 1er fichier (date A) se termine enfin.
    act(() => { FakeFileReader.instances[0].onload({ target: { result: 'fake,csv,content' } }); });

    // Le finally du 1er import ne doit PAS avoir effacé csvUploadTargetDate
    // (qui vaut désormais '2026-08-12', pas '2026-08-10' capturé au départ
    // du 1er import) — sinon le 2e import échouerait silencieusement dès
    // que l'utilisateur choisirait son fichier.
    expect(setCsvUploadTargetDate).not.toHaveBeenCalled();
  });

  it('SANS 2e import concurrent, csvUploadTargetDate est bien effacé normalement (comportement inchangé)', () => {
    const setCsvUploadTargetDate = vi.fn();
    const showToast = vi.fn();
    mockParseGarminCsv.mockReturnValue({ ok: true, data: [{ t: 0, cadence: 170 }], hasCadence: true, hasHeartRate: false });

    const playlistA = makePlaylist({ id: 'plA' });
    const { result } = renderCsvImportHook(
      baseProps({ currentPlaylist: playlistA, savedPlaylists: [playlistA], csvUploadTargetDate: '2026-08-10', setCsvUploadTargetDate, showToast })
    );

    act(() => { result.current.handleCSVUpload(makeFakeEvent()); });
    act(() => { FakeFileReader.instances[0].onload({ target: { result: 'fake,csv,content' } }); });

    expect(setCsvUploadTargetDate).toHaveBeenCalledWith(null);
  });
});
