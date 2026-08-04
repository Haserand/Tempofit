// @vitest-environment jsdom
//
// 1er fichier de test pour EditRoutineModal.jsx — portée volontairement
// resserrée (même raisonnement que numberInput.test.js) à la nouvelle
// validation distance/durée, PAS une couverture exhaustive de toute la
// modale (genres, mode Crescendo/Fractionné, etc.), qui reste à faire
// séparément si besoin. Props réelles reprises directement de la
// signature de la fonction dans EditRoutineModal.jsx (§4ter,
// CLAUDE-SANDBOX-VERIFICATION.md : vérifier les VRAIS noms, jamais deviner).
//
// 04/08, retour direct (capture d'écran) : "je ne trouve pas ça normal de
// pouvoir générer une routine avec une valeur de 0 km" — voir
// targetValidation.js pour le raisonnement complet.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EditRoutineModal from '../../src/components/modals/EditRoutineModal.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight',
  textColorClass: 'mock-accent', inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
  textMuted: 'mock-muted', bgAccentClass: 'mock-accent-bg', borderAccentClass: 'mock-border-accent',
};

function makeRoutine(overrides = {}) {
  return {
    id: 'routine-1', name: 'Mon 5km Quotidien',
    bpm: 160, bpmTolerance: 10,
    targetMode: 'distance', distanceVal: 5, distanceUnit: 'km',
    hours: 0, minutes: 45,
    selectedGenres: ['Rock'],
    isIntervalMode: false, isCrescendoMode: false,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme, isNaughtyMode: false,
    isEditRoutineModalOpen: true, onClose: vi.fn(),
    editingRoutine: makeRoutine(), setEditingRoutine: vi.fn(),
    showExtraGenres: false, setShowExtraGenres: vi.fn(),
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })), CRESCENDO_MIN_MAIN_PCT: 20,
    applyRoutineEditOnce: vi.fn(), applyRoutineEditPermanently: vi.fn(),
    ...overrides,
  };
}

describe('EditRoutineModal — validation distance/durée (BUG CORRIGÉ, cible à 0)', () => {
  it('les 2 boutons de sauvegarde sont actifs quand la distance est valide', () => {
    render(<EditRoutineModal {...baseProps({ editingRoutine: makeRoutine({ targetMode: 'distance', distanceVal: 5 }) })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).not.toBeDisabled();
    expect(screen.getByText('Toujours pour cette routine').closest('button')).not.toBeDisabled();
  });

  it('les 2 boutons de sauvegarde sont désactivés quand distanceVal vaut 0', () => {
    render(<EditRoutineModal {...baseProps({ editingRoutine: makeRoutine({ targetMode: 'distance', distanceVal: 0 }) })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).toBeDisabled();
    expect(screen.getByText('Toujours pour cette routine').closest('button')).toBeDisabled();
  });

  it('affiche un avertissement visible quand distanceVal vaut 0', () => {
    render(<EditRoutineModal {...baseProps({ editingRoutine: makeRoutine({ targetMode: 'distance', distanceVal: 0 }) })} />);
    expect(screen.getByText('Renseigne une distance supérieure à 0.')).toBeInTheDocument();
  });

  it('les boutons sont désactivés quand heures ET minutes valent 0 (mode temps)', () => {
    render(<EditRoutineModal {...baseProps({ editingRoutine: makeRoutine({ targetMode: 'time', hours: 0, minutes: 0 }) })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).toBeDisabled();
    expect(screen.getByText('Toujours pour cette routine').closest('button')).toBeDisabled();
    expect(screen.getByText('Renseigne une durée supérieure à 0.')).toBeInTheDocument();
  });

  it('les boutons restent actifs en mode temps dès que les minutes sont positives', () => {
    render(<EditRoutineModal {...baseProps({ editingRoutine: makeRoutine({ targetMode: 'time', hours: 0, minutes: 45 }) })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).not.toBeDisabled();
    expect(screen.getByText('Toujours pour cette routine').closest('button')).not.toBeDisabled();
  });
});
