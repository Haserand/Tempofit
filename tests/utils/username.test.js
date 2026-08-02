import { describe, it, expect } from 'vitest';
import { USERNAME_REGEX, ADMIN_USERNAME_EXCEPTION, isReservedUsername, RESERVED_USERNAME_ERROR } from '../../src/utils/username.js';

describe('isReservedUsername', () => {
  it('laisse passer l\'exception admin explicite, malgré "tempofit" qu\'elle contient', () => {
    expect(isReservedUsername('tempofit_admin')).toBe(false);
    expect(isReservedUsername(ADMIN_USERNAME_EXCEPTION)).toBe(false);
  });

  it('bloque tout pseudo contenant "tempofit", n\'importe où dans la chaîne', () => {
    expect(isReservedUsername('tempofit')).toBe(true);
    expect(isReservedUsername('mytempofit')).toBe(true);
    expect(isReservedUsername('tempofitfan')).toBe(true);
    expect(isReservedUsername('team_tempofit_2026')).toBe(true);
  });

  it('bloque les mots-clés système UNIQUEMENT en préfixe (^), pas ailleurs dans la chaîne', () => {
    expect(isReservedUsername('admin_123')).toBe(true);
    expect(isReservedUsername('support_team')).toBe(true);
    expect(isReservedUsername('system')).toBe(true);
    expect(isReservedUsername('modo_alex')).toBe(true);
    expect(isReservedUsername('staff_2026')).toBe(true);
    expect(isReservedUsername('root')).toBe(true);
    expect(isReservedUsername('officiel_test')).toBe(true);
    // Cas limite EXPLICITEMENT non couvert par le pattern tel que fourni
    // (mot-clé système ailleurs qu'en préfixe) — documente le comportement
    // RÉEL, pas resserré au-delà de ce qui a été demandé.
    expect(isReservedUsername('grand_admin_fan')).toBe(false);
  });

  it('insensible à la casse', () => {
    expect(isReservedUsername('TempoFit')).toBe(true);
    expect(isReservedUsername('ADMIN_test')).toBe(true);
    expect(isReservedUsername('TEMPOFIT_ADMIN')).toBe(false); // exception, insensible à la casse aussi ? -> voir test suivant
  });

  it('l\'exception admin est sensible à la casse (comparaison stricte ===, pas insensible)', () => {
    // `candidate === ADMIN_USERNAME_EXCEPTION` est une égalité STRICTE —
    // contrairement au reste du pattern (`~*`/`/i`, insensible à la casse),
    // 'TEMPOFIT_ADMIN' ne bénéficie PAS de l'exception : il retombe donc
    // sur la règle générale, qui le bloque (contient "tempofit").
    expect(isReservedUsername('TEMPOFIT_ADMIN')).toBe(true);
    expect(isReservedUsername('Tempofit_Admin')).toBe(true);
  });

  it('laisse passer un pseudo normal, sans rapport avec les mots réservés', () => {
    expect(isReservedUsername('alex_runner')).toBe(false);
    expect(isReservedUsername('marie123')).toBe(false);
  });

  it('gère une entrée vide/undefined/null sans planter', () => {
    expect(isReservedUsername('')).toBe(false);
    expect(isReservedUsername(undefined)).toBe(false);
    expect(isReservedUsername(null)).toBe(false);
  });
});

describe('USERNAME_REGEX (format, réexportée depuis ce fichier)', () => {
  it('accepte 3 à 20 caractères minuscules/chiffres/underscore', () => {
    expect(USERNAME_REGEX.test('abc')).toBe(true);
    expect(USERNAME_REGEX.test('alex_runner_99')).toBe(true);
  });

  it('refuse en dehors de ces bornes/caractères', () => {
    expect(USERNAME_REGEX.test('ab')).toBe(false); // trop court
    expect(USERNAME_REGEX.test('a'.repeat(21))).toBe(false); // trop long
    expect(USERNAME_REGEX.test('Alex')).toBe(false); // majuscule
    expect(USERNAME_REGEX.test('alex-runner')).toBe(false); // tiret non autorisé
  });
});

describe('RESERVED_USERNAME_ERROR', () => {
  it('est le message exact demandé par le brief', () => {
    expect(RESERVED_USERNAME_ERROR).toBe('Ce pseudo est réservé ou invalide.');
  });
});
