import { describe, it, expect } from 'vitest';
import { isTargetValueValid, snapDistanceOnBlur, isSegmentValid, areSegmentsValid, snapSegmentBpmOnBlur, snapSegmentDurationOnBlur } from '../../src/utils/targetValidation.js';

/**
 * targetValidation.test.js — tests pour isTargetValueValid.
 *
 * Portée resserrée à la cible "simple" (temps OU distance, modes Constant/
 * Crescendo) — voir la docstring de la fonction pour le raisonnement complet
 * et pourquoi le mode Fractionné (durées par segment) reste hors scope.
 */

describe('isTargetValueValid — mode distance', () => {
  it('refuse 0 km (bug réel signalé par capture d\'écran, EditRoutineModal.jsx)', () => {
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: 0 })).toBe(false);
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: '0' })).toBe(false);
  });

  it('refuse un champ vidé', () => {
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: '' })).toBe(false);
  });

  it('refuse une valeur négative', () => {
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: '-5' })).toBe(false);
  });

  it('accepte une valeur décimale positive (step="0.1" côté input réel)', () => {
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: '5.5' })).toBe(true);
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: 0.1 })).toBe(true);
  });

  // 04/08, 2e retour direct (même jour) : "je pense que le comportement
  // attendu c'est que je puisse pas aller en dessous de 0,1 km" — seuil
  // resserré de `> 0` à `>= 0.1`, cohérent avec le `step="0.1"` déjà
  // affiché sur le champ.
  it('refuse une valeur strictement positive mais sous le seuil de 0.1 (BUG CORRIGÉ, seuil resserré)', () => {
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: 0.05 })).toBe(false);
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: '0.01' })).toBe(false);
  });

  it('accepte exactement le seuil (0.1), ni plus strict ni plus permissif', () => {
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: '0.1' })).toBe(true);
  });

  it('refuse une valeur non numérique', () => {
    expect(isTargetValueValid({ targetMode: 'distance', distanceVal: 'abc' })).toBe(false);
  });
});

describe('isTargetValueValid — mode time (heures/minutes)', () => {
  it('refuse 0h00', () => {
    expect(isTargetValueValid({ targetMode: 'time', hours: 0, minutes: 0 })).toBe(false);
    expect(isTargetValueValid({ targetMode: 'time', hours: '0', minutes: '0' })).toBe(false);
  });

  it('refuse des champs vidés (traités comme 0, cohérent avec syncClampedInput)', () => {
    expect(isTargetValueValid({ targetMode: 'time', hours: '', minutes: '' })).toBe(false);
  });

  it('accepte dès qu\'il y a des minutes, même sans heures', () => {
    expect(isTargetValueValid({ targetMode: 'time', hours: 0, minutes: 1 })).toBe(true);
  });

  it('accepte dès qu\'il y a des heures, même sans minutes', () => {
    expect(isTargetValueValid({ targetMode: 'time', hours: 1, minutes: 0 })).toBe(true);
  });

  it('accepte une combinaison des deux', () => {
    expect(isTargetValueValid({ targetMode: 'time', hours: 1, minutes: 30 })).toBe(true);
  });
});

// 04/08, 3e retour direct sur ce même chantier (capture annotée) : "je
// pensais qu'on avait dit qu'on ne pouvait pas sélectionner moins que
// 0,1 ?" — le blocage à l'action existait déjà, il manquait la correction
// automatique du champ lui-même au moment de le quitter.
describe('snapDistanceOnBlur', () => {
  it('remonte 0 à 0.1', () => {
    expect(snapDistanceOnBlur(0)).toBe('0.1');
    expect(snapDistanceOnBlur('0')).toBe('0.1');
  });

  it('remonte un champ vidé à 0.1', () => {
    expect(snapDistanceOnBlur('')).toBe('0.1');
  });

  it('remonte une valeur négative à 0.1', () => {
    expect(snapDistanceOnBlur('-5')).toBe('0.1');
  });

  it('remonte une valeur sous le seuil (mais positive) à 0.1', () => {
    expect(snapDistanceOnBlur('0.05')).toBe('0.1');
  });

  it('remonte une valeur non numérique à 0.1', () => {
    expect(snapDistanceOnBlur('abc')).toBe('0.1');
  });

  it('laisse une valeur déjà valide INCHANGÉE (pas de reformatage superflu)', () => {
    expect(snapDistanceOnBlur('5.5')).toBe('5.5');
    expect(snapDistanceOnBlur('0.1')).toBe('0.1');
  });
});

// 04/08, 3e retour direct sur ce même chantier : "ce comportement minimal
// est-il celui généralisé dans toute l'app ? il le faudrait" — les
// segments du mode Fractionné souffraient du même défaut que distanceVal/
// hours/minutes avant leur propre correctif (voir la docstring de
// isSegmentValid dans targetValidation.js).
describe('isSegmentValid / areSegmentsValid', () => {
  it('refuse un segment avec bpm=0', () => {
    expect(isSegmentValid({ bpm: 0, durationValue: 5 }, 'time')).toBe(false);
  });

  it('refuse un segment avec durationValue=0 (mode temps)', () => {
    expect(isSegmentValid({ bpm: 150, durationValue: 0 }, 'time')).toBe(false);
  });

  it('refuse un segment avec durationValue sous 0.1 (mode distance)', () => {
    expect(isSegmentValid({ bpm: 150, durationValue: 0.05 }, 'distance')).toBe(false);
  });

  it('accepte un segment valide', () => {
    expect(isSegmentValid({ bpm: 150, durationValue: 5 }, 'time')).toBe(true);
    expect(isSegmentValid({ bpm: 150, durationValue: 0.1 }, 'distance')).toBe(true);
  });

  it('areSegmentsValid refuse un tableau vide (aucune portion n\'a de sens)', () => {
    expect(areSegmentsValid([], 'time')).toBe(false);
  });

  it('areSegmentsValid refuse dès qu\'UN SEUL segment est invalide parmi plusieurs', () => {
    const segments = [{ bpm: 150, durationValue: 5 }, { bpm: 0, durationValue: 3 }];
    expect(areSegmentsValid(segments, 'time')).toBe(false);
  });

  it('areSegmentsValid accepte quand TOUS les segments sont valides', () => {
    const segments = [{ bpm: 150, durationValue: 5 }, { bpm: 160, durationValue: 3 }];
    expect(areSegmentsValid(segments, 'time')).toBe(true);
  });
});

describe('snapSegmentBpmOnBlur / snapSegmentDurationOnBlur', () => {
  it('remonte un BPM à 0 vers le plancher (1)', () => {
    expect(snapSegmentBpmOnBlur(0)).toBe('1');
    expect(snapSegmentBpmOnBlur('')).toBe('1');
  });

  it('laisse un BPM déjà valide inchangé', () => {
    expect(snapSegmentBpmOnBlur('150')).toBe('150');
  });

  it('remonte une durée à 0 vers le plancher, selon le mode', () => {
    expect(snapSegmentDurationOnBlur(0, 'distance')).toBe('0.1');
    expect(snapSegmentDurationOnBlur(0, 'time')).toBe('1');
  });

  it('laisse une durée déjà valide inchangée', () => {
    expect(snapSegmentDurationOnBlur('5.5', 'distance')).toBe('5.5');
    expect(snapSegmentDurationOnBlur('10', 'time')).toBe('10');
  });
});
