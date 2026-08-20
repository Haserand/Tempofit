// @vitest-environment jsdom
//
// Premier fichier de test pour GeneratorContext.jsx — jusqu'ici couvert
// seulement indirectement (via les tests des vues qui le mockent). Ajouté
// lors du check-up global du 19/08. `useGeneratorForm`/`useCustomActivity`
// mockés — ce fichier teste la composition PROPRE à GeneratorProvider
// (workoutType, getActiveWorkoutName, exclusion d'applyProfileBpmIfUntouched
// de sa value), pas la logique interne de ces 2 hooks (déjà testés à part).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const mockUseGeneratorForm = vi.fn();
vi.mock('../../src/hooks/useGeneratorForm.js', () => ({
  useGeneratorForm: (...args) => mockUseGeneratorForm(...args),
}));

const mockUseCustomActivity = vi.fn();
vi.mock('../../src/hooks/useCustomActivity.js', () => ({
  useCustomActivity: (...args) => mockUseCustomActivity(...args),
}));

import { GeneratorProvider, useGeneratorContext } from '../../src/contexts/GeneratorContext.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeGeneratorFormApi(overrides = {}) {
  return {
    bpm: 140, setBpm: vi.fn(), setBpmManual: vi.fn(),
    segments: [], setSegments: vi.fn(),
    selectedGenres: ['Rock'], setSelectedGenres: vi.fn(),
    applyProfileBpmIfUntouched: vi.fn(),
    ...overrides,
  };
}

function makeCustomActivityApi(overrides = {}) {
  return {
    customActivity: '', setCustomActivity: vi.fn(),
    tempCustomActivity: '', setTempCustomActivity: vi.fn(),
    isCustomActivityModalOpen: false, setIsCustomActivityModalOpen: vi.fn(),
    handleOpenCustomActivityModal: vi.fn(),
    ...overrides,
  };
}

const captured = [];
function Probe() {
  captured.push(useGeneratorContext());
  return null;
}

describe('GeneratorContext — comportement de base', () => {
  it('useGeneratorContext() hors Provider renvoie un repli inerte (pas de crash)', () => {
    captured.length = 0;
    render(<Probe />);
    expect(captured[0].workoutType).toBe('Course à pied');
    expect(captured[0].bpm).toBe(120);
    expect(typeof captured[0].setBpm).toBe('function');
  });

  it('workoutType démarre à "Course à pied" (déplacé tel quel depuis App.jsx, voir la docstring)', () => {
    captured.length = 0;
    mockUseGeneratorForm.mockReturnValue(makeGeneratorFormApi());
    mockUseCustomActivity.mockReturnValue(makeCustomActivityApi());
    render(
      <GeneratorProvider isNaughtyMode={false} athleticProfileApi={{ athleticProfile: {} }}>
        <Probe />
      </GeneratorProvider>
    );
    expect(captured[0].workoutType).toBe('Course à pied');
  });

  it('réexpose les champs de useGeneratorForm() (bpm, segments, selectedGenres...) tels quels', () => {
    captured.length = 0;
    mockUseGeneratorForm.mockReturnValue(makeGeneratorFormApi({ bpm: 155, selectedGenres: ['Techno', 'Trance'] }));
    mockUseCustomActivity.mockReturnValue(makeCustomActivityApi());
    render(
      <GeneratorProvider isNaughtyMode={false} athleticProfileApi={{ athleticProfile: {} }}>
        <Probe />
      </GeneratorProvider>
    );
    expect(captured[0].bpm).toBe(155);
    expect(captured[0].selectedGenres).toEqual(['Techno', 'Trance']);
  });
});

// La raison d'être de ce Contexte (voir sa docstring "DEPUIS LE 08/08") :
// `applyProfileBpmIfUntouched` NE DOIT PLUS transiter par la value de CE
// Contexte — déplacé vers CustomActivityContext.jsx — pour éviter de
// re-render CustomActivityModal.jsx (montée globalement) à chaque réglage
// du wizard.
describe('GeneratorContext — applyProfileBpmIfUntouched exclu de la value (déplacé vers CustomActivityContext, 08/08)', () => {
  it('n\'apparaît PAS dans useGeneratorContext(), même si useGeneratorForm() le renvoie', () => {
    captured.length = 0;
    const applyProfileBpmIfUntouched = vi.fn();
    mockUseGeneratorForm.mockReturnValue(makeGeneratorFormApi({ applyProfileBpmIfUntouched }));
    mockUseCustomActivity.mockReturnValue(makeCustomActivityApi());
    render(
      <GeneratorProvider isNaughtyMode={false} athleticProfileApi={{ athleticProfile: {} }}>
        <Probe />
      </GeneratorProvider>
    );
    expect(captured[0].applyProfileBpmIfUntouched).toBeUndefined();
  });
});

describe('GeneratorContext — getActiveWorkoutName', () => {
  it('workoutType différent de "Autre" : renvoie workoutType tel quel', () => {
    captured.length = 0;
    mockUseGeneratorForm.mockReturnValue(makeGeneratorFormApi());
    mockUseCustomActivity.mockReturnValue(makeCustomActivityApi());
    render(
      <GeneratorProvider isNaughtyMode={false} athleticProfileApi={{ athleticProfile: {} }}>
        <Probe />
      </GeneratorProvider>
    );
    expect(captured[0].getActiveWorkoutName()).toBe('Course à pied');
  });

  it('workoutType==="Autre" avec customActivity non vide : renvoie customActivity', () => {
    captured.length = 0;
    mockUseGeneratorForm.mockReturnValue(makeGeneratorFormApi());
    mockUseCustomActivity.mockReturnValue(makeCustomActivityApi({ customActivity: 'Escalade' }));
    render(
      <GeneratorProvider isNaughtyMode={false} athleticProfileApi={{ athleticProfile: {} }}>
        <Probe />
      </GeneratorProvider>
    );
    // workoutType par défaut est "Course à pied", pas "Autre" — le test
    // vérifie donc le repli, pas le cas "Autre" lui-même (workoutType n'est
    // modifiable que via setWorkoutType, non déclenché ici). Voir le test
    // suivant pour le cas "Autre" réellement activé.
    expect(captured[0].getActiveWorkoutName()).toBe('Course à pied');
  });

  it('workoutType==="Autre" (déclenché via setWorkoutType) avec customActivity non vide : renvoie customActivity', () => {
    captured.length = 0;
    mockUseGeneratorForm.mockReturnValue(makeGeneratorFormApi());
    mockUseCustomActivity.mockReturnValue(makeCustomActivityApi({ customActivity: '  Escalade  ' }));
    render(
      <GeneratorProvider isNaughtyMode={false} athleticProfileApi={{ athleticProfile: {} }}>
        <Probe />
      </GeneratorProvider>
    );
    act(() => { captured[0].setWorkoutType('Autre'); });
    // Le state React ne se reflète qu'au rendu suivant — on relit donc la
    // DERNIÈRE capture après le re-render déclenché par ce setState.
    const last = captured[captured.length - 1];
    expect(last.getActiveWorkoutName()).toBe('  Escalade  '); // pas de trim ici, voir la doc de la fonction source
  });
});
