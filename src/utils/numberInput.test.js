// numberInput.test.js — tests pour clampNumericInput/syncClampedInput.
//
// Utilise le test runner NATIF de Node (`node:test` + `node:assert`),
// disponible depuis Node 18 sans AUCUNE dépendance à installer — donc
// exécutable directement avec `node --test src/utils/numberInput.test.js`,
// même dans un environnement sans accès npm/réseau (ce qui a permis de le
// faire tourner réellement pendant la session où il a été écrit, plutôt
// que de livrer du code jamais vérifié).
//
// Si le projet passe un jour à un vrai test runner (Vitest, déjà cohérent
// avec Vite) : ce fichier n'a presque rien à changer, `describe`/`test`/
// `assert.strictEqual` sont l'API standard, très proche de celle de Vitest.
//
// Portée volontairement resserrée à `numberInput.js` (pas tout le projet
// d'un coup) : c'est la fonction la plus directement liée aux bugs réels de
// la session du 26/07/2026 (saisie "0145", plancher BPM incohérent) — celle
// où un test aurait eu le plus de valeur immédiate.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clampNumericInput, syncClampedInput } from './numberInput.js';

describe('clampNumericInput', () => {
  test('laisse passer une chaîne vide (pour permettre d\'effacer le champ)', () => {
    assert.strictEqual(clampNumericInput('', { min: 0, max: 59 }), '');
  });

  test('retire les zéros de tête (bug réel : "0145" devait devenir "145")', () => {
    assert.strictEqual(clampNumericInput('0145', { min: 80, max: 220 }), '145');
    assert.strictEqual(clampNumericInput('041', { min: 0, max: 59 }), '41');
    assert.strictEqual(clampNumericInput('00', { min: 0, max: 59 }), '0');
  });

  test('borne une valeur trop basse au minimum', () => {
    assert.strictEqual(clampNumericInput('5', { min: 80, max: 220 }), '80');
    assert.strictEqual(clampNumericInput('0', { min: 40, max: 220 }), '40');
  });

  test('borne une valeur trop haute au maximum', () => {
    assert.strictEqual(clampNumericInput('999', { min: 0, max: 59 }), '59');
    assert.strictEqual(clampNumericInput('300', { min: 40, max: 220 }), '220');
  });

  test('accepte une valeur déjà dans les bornes, sans y toucher', () => {
    assert.strictEqual(clampNumericInput('145', { min: 80, max: 220 }), '145');
    assert.strictEqual(clampNumericInput('0', { min: 0, max: 59 }), '0');
  });

  test('retire tout caractère non numérique (protection copier-coller)', () => {
    assert.strictEqual(clampNumericInput('1a4b5', { min: 0, max: 220 }), '145');
    assert.strictEqual(clampNumericInput('abc', { min: 0, max: 220 }), '');
    assert.strictEqual(clampNumericInput('-45', { min: 0, max: 220 }), '45');
  });

  test('fonctionne saisie caractère par caractère (pas de blocage prématuré)', () => {
    // Simule taper "5" puis "9" pour atteindre 59 (max) — chaque étape
    // intermédiaire doit rester valide, pas juste le résultat final.
    assert.strictEqual(clampNumericInput('5', { min: 0, max: 59 }), '5');
    assert.strictEqual(clampNumericInput('59', { min: 0, max: 59 }), '59');
  });

  test('bornes par défaut (aucune limite) si non précisées', () => {
    assert.strictEqual(clampNumericInput('99999'), '99999');
  });
});

describe('syncClampedInput', () => {
  // Mock minimal d'un évènement React — seul `target.value` est lu/écrit
  // par la fonction, pas besoin d'un vrai DOM.
  const fakeEvent = (value) => ({ target: { value } });

  test('renvoie la valeur bornée, comme clampNumericInput seule', () => {
    const e = fakeEvent('0145');
    assert.strictEqual(syncClampedInput(e, { min: 80, max: 220 }), '145');
  });

  test('BUG CORRIGÉ : réécrit e.target.value pour forcer la synchro DOM', () => {
    // Reproduit exactement le bug remonté par capture d'écran : la valeur
    // recalculée est identique à ce qu'affichait déjà le champ ("145"),
    // React seul ne réappliquerait pas la prop `value` sur le DOM réel —
    // c'est cette ligne-ci qui doit corriger l'affichage à la place.
    const e = fakeEvent('0145');
    syncClampedInput(e, { min: 80, max: 220 });
    assert.strictEqual(e.target.value, '145');
  });

  test('même comportement de bornage que clampNumericInput', () => {
    const e = fakeEvent('999');
    assert.strictEqual(syncClampedInput(e, { min: 0, max: 59 }), '59');
    assert.strictEqual(e.target.value, '59');
  });
});
