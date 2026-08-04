import { describe, it, expect } from 'vitest';
import { isTargetValueValid } from '../../src/utils/targetValidation.js';

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
