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
//
// ⚠️ DÉPLACÉ le 05/08 (check-up) : ce fichier vivait par erreur dans
// `src/components/modals/EditRoutineModal.test.jsx` au lieu de
// `tests/modals/EditRoutineModal.test.jsx` — invisible du build Vercel réel
// (`vite.config.js`, `test.include: ['tests/**/*.test.{js,jsx}']` ne scanne
// jamais `src/`) ET son import relatif (déjà écrit pour CET emplacement,
// `../../src/...`) était cassé depuis l'ancien. Aucun des tests ci-dessous
// n'avait donc JAMAIS tourné, y compris ceux qui couvrent le chantier
// "cible à 0" du 04/08. Voir PASSATION.md pour le détail de la découverte.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

// 04/08, 3e retour direct sur ce même chantier (capture annotée) : "je
// pensais qu'on avait dit qu'on ne pouvait pas sélectionner moins que
// 0,1 ?" — voir snapDistanceOnBlur (targetValidation.js) pour le
// raisonnement complet.
describe('EditRoutineModal — correction automatique au blur (BUG CORRIGÉ)', () => {
  it('quitter le champ distance à 0 le remonte à 0.1', () => {
    const setEditingRoutine = vi.fn();
    const { container } = render(<EditRoutineModal {...baseProps({ editingRoutine: makeRoutine({ targetMode: 'distance', distanceVal: 0 }), setEditingRoutine })} />);

    const distanceInput = container.querySelector('input[step="0.1"]');
    fireEvent.blur(distanceInput, { target: { value: '0' } });

    // setEditingRoutine reçoit un updater fonctionnel (comme le reste de la
    // modale pour les champs édités hors du flux React "contrôlé simple",
    // voir les boutons +/- des minutes juste au-dessus dans le fichier
    // source) — on l'exécute avec l'état simulé pour vérifier le résultat.
    const updater = setEditingRoutine.mock.calls[0][0];
    expect(updater(makeRoutine({ targetMode: 'distance', distanceVal: '0' })).distanceVal).toBe('0.1');
  });
});

// ⚠️ TROU COMBLÉ (audit du 05/08) : cette modale appelle `executeGeneration`
// directement (`applyRoutineEditOnce`/`applyRoutineEditPermanently`) sans
// jamais valider `editingRoutine.segments` — en mode Fractionné pur
// (`isIntervalMode && !isCrescendoMode`), c'est pourtant `segments` qui
// pilote réellement la durée générée (voir usePlaylistGeneration.js),
// jamais `distanceVal`/`hours`/`minutes`. Voir la docstring d'`isTargetInvalid`
// dans EditRoutineModal.jsx pour le raisonnement complet.
describe('EditRoutineModal — segments cassés en mode Fractionné pur (TROU COMBLÉ, 05/08)', () => {
  function makeIntervalRoutine(overrides = {}) {
    return makeRoutine({
      isIntervalMode: true, isCrescendoMode: false,
      targetMode: 'distance',
      segments: [
        { id: 1, bpm: 150, durationValue: 2 },
        { id: 2, bpm: 170, durationValue: 1 },
      ],
      ...overrides,
    });
  }

  it('les 2 boutons restent actifs quand toutes les portions sont valides', () => {
    render(<EditRoutineModal {...baseProps({ editingRoutine: makeIntervalRoutine() })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).not.toBeDisabled();
    expect(screen.getByText('Toujours pour cette routine').closest('button')).not.toBeDisabled();
  });

  it('les 2 boutons se désactivent quand une portion a une durée à 0', () => {
    render(<EditRoutineModal {...baseProps({
      editingRoutine: makeIntervalRoutine({ segments: [{ id: 1, bpm: 150, durationValue: 0 }] }),
    })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).toBeDisabled();
    expect(screen.getByText('Toujours pour cette routine').closest('button')).toBeDisabled();
    expect(screen.getByText(/Portion\(s\) invalide\(s\)/)).toBeInTheDocument();
  });

  it('les 2 boutons se désactivent quand une portion a un BPM à 0', () => {
    render(<EditRoutineModal {...baseProps({
      editingRoutine: makeIntervalRoutine({ segments: [{ id: 1, bpm: 0, durationValue: 2 }] }),
    })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).toBeDisabled();
    expect(screen.getByText('Toujours pour cette routine').closest('button')).toBeDisabled();
  });

  it('une distanceVal globale à 0 n\'a AUCUN effet en Fractionné pur (le champ est masqué, seuls les segments comptent)', () => {
    render(<EditRoutineModal {...baseProps({
      editingRoutine: makeIntervalRoutine({ distanceVal: 0 }),
    })} />);
    // Le champ global est masqué dans ce mode (step="0.1" n'existe plus).
    expect(screen.queryByText('Renseigne une distance supérieure à 0.')).not.toBeInTheDocument();
    expect(screen.getByText('Cette séance seulement').closest('button')).not.toBeDisabled();
  });

  it('le mode Crescendo (isIntervalMode ET isCrescendoMode) continue de valider la cible globale, pas les segments', () => {
    render(<EditRoutineModal {...baseProps({
      editingRoutine: makeRoutine({
        isIntervalMode: true, isCrescendoMode: true, targetMode: 'distance', distanceVal: 0,
        crescendoWarmupBpm: 100, crescendoCooldownBpm: 100,
        segments: [{ id: 1, bpm: 150, durationValue: 2 }],
      }),
    })} />);
    expect(screen.getByText('Cette séance seulement').closest('button')).toBeDisabled();
    expect(screen.getByText('Renseigne une distance supérieure à 0.')).toBeInTheDocument();
  });
});
