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
    (props) => useCsvImport(
      props.fileInputRef, props.csvUploadTargetDate, props.setCsvUploadTargetDate,
      props.currentPlaylist, props.setCurrentPlaylist, props.savedPlaylists, props.setSavedPlaylists,
      props.setSelectedAnalysisDate, props.setSelectedMetric,
      props.userStats, props.checkTrophies, props.changeView, props.showToast,
    ),
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
