import { describe, it, expect } from 'vitest';
import { clampNumericInput, syncClampedInput } from '../src/utils/numberInput.js';

/**
 * numberInput.test.js — tests pour clampNumericInput/syncClampedInput.
 *
 * DÉPLACÉ ICI depuis src/utils/numberInput.test.js (dette technique
 * corrigée, 29/07) — ce fichier vivait hors de `tests/`, le seul dossier
 * couvert par `include: ['tests/**\/*.test.js']` (voir vite.config.js) :
 * ses 11 tests n'ont donc JAMAIS tourné via `npm run test:run`/le build
 * Vercel (voir les logs de déploiement : "152 passed", pas 163 — l'écart
 * de 11 correspondait exactement à ce fichier). Converti au passage de
 * l'API `node:test`/`node:assert` (utilisée à l'origine pour vérifier le
 * code sans accès npm/réseau — voir l'historique Git de l'ancien fichier
 * pour ce contexte) vers l'API Vitest (`describe`/`it`/`expect`), cohérente
 * avec les 12 autres fichiers de ce dossier — plus de 2 conventions de
 * test différentes à maintenir dans le même projet.
 *
 * Portée volontairement resserrée à `numberInput.js` (pas tout le projet
 * d'un coup) : c'est la fonction la plus directement liée aux bugs réels de
 * la session du 26/07/2026 (saisie "0145", plancher BPM incohérent) — celle
 * où un test avait le plus de valeur immédiate.
 */

describe('clampNumericInput', () => {
  it('laisse passer une chaîne vide (pour permettre d\'effacer le champ)', () => {
    expect(clampNumericInput('', { min: 0, max: 59 })).toBe('');
  });

  it('retire les zéros de tête (bug réel : "0145" devait devenir "145")', () => {
    expect(clampNumericInput('0145', { min: 80, max: 220 })).toBe('145');
    expect(clampNumericInput('041', { min: 0, max: 59 })).toBe('41');
    expect(clampNumericInput('00', { min: 0, max: 59 })).toBe('0');
  });

  it('borne une valeur trop basse au minimum', () => {
    expect(clampNumericInput('5', { min: 80, max: 220 })).toBe('80');
    expect(clampNumericInput('0', { min: 40, max: 220 })).toBe('40');
  });

  it('borne une valeur trop haute au maximum', () => {
    expect(clampNumericInput('999', { min: 0, max: 59 })).toBe('59');
    expect(clampNumericInput('300', { min: 40, max: 220 })).toBe('220');
  });

  it('accepte une valeur déjà dans les bornes, sans y toucher', () => {
    expect(clampNumericInput('145', { min: 80, max: 220 })).toBe('145');
    expect(clampNumericInput('0', { min: 0, max: 59 })).toBe('0');
  });

  it('retire tout caractère non numérique (protection copier-coller)', () => {
    expect(clampNumericInput('1a4b5', { min: 0, max: 220 })).toBe('145');
    expect(clampNumericInput('abc', { min: 0, max: 220 })).toBe('');
    expect(clampNumericInput('-45', { min: 0, max: 220 })).toBe('45');
  });

  it('fonctionne saisie caractère par caractère (pas de blocage prématuré)', () => {
    // Simule taper "5" puis "9" pour atteindre 59 (max) — chaque étape
    // intermédiaire doit rester valide, pas juste le résultat final.
    expect(clampNumericInput('5', { min: 0, max: 59 })).toBe('5');
    expect(clampNumericInput('59', { min: 0, max: 59 })).toBe('59');
  });

  it('bornes par défaut (aucune limite) si non précisées', () => {
    expect(clampNumericInput('99999')).toBe('99999');
  });
});

describe('syncClampedInput', () => {
  // Mock minimal d'un évènement React — seul `target.value` est lu/écrit
  // par la fonction, pas besoin d'un vrai DOM.
  const fakeEvent = (value) => ({ target: { value } });

  it('renvoie la valeur bornée, comme clampNumericInput seule', () => {
    const e = fakeEvent('0145');
    expect(syncClampedInput(e, { min: 80, max: 220 })).toBe('145');
  });

  it('BUG CORRIGÉ : réécrit e.target.value pour forcer la synchro DOM', () => {
    // Reproduit exactement le bug remonté par capture d'écran : la valeur
    // recalculée est identique à ce qu'affichait déjà le champ ("145"),
    // React seul ne réappliquerait pas la prop `value` sur le DOM réel —
    // c'est cette ligne-ci qui doit corriger l'affichage à la place.
    const e = fakeEvent('0145');
    syncClampedInput(e, { min: 80, max: 220 });
    expect(e.target.value).toBe('145');
  });

  it('même comportement de bornage que clampNumericInput', () => {
    const e = fakeEvent('999');
    expect(syncClampedInput(e, { min: 0, max: 59 })).toBe('59');
    expect(e.target.value).toBe('59');
  });
});
