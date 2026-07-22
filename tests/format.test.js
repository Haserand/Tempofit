import { describe, it, expect } from 'vitest';
import { formatDuration, parseTimeToSeconds } from '../src/utils/format.js';

describe('formatDuration', () => {
  it('formate en dessous d\'une heure en "Xm YYs"', () => {
    expect(formatDuration(222)).toBe('3m 42s');
  });

  it('formate au-delà d\'une heure en "Xh YYm" (les secondes disparaissent)', () => {
    expect(formatDuration(3900)).toBe('1h 05m'); // 1h 05m 00s
  });

  it('gère 0 seconde', () => {
    expect(formatDuration(0)).toBe('0m 00s');
  });

  it('tronque (n\'arrondit pas) les secondes fractionnaires', () => {
    // 90.9s -> 1m 30s, pas 1m 31s : Math.floor partout dans l'implémentation
    expect(formatDuration(90.9)).toBe('1m 30s');
  });
});

describe('parseTimeToSeconds', () => {
  it('parse le format HH:MM:SS', () => {
    expect(parseTimeToSeconds('01:02:03')).toBe(3723);
  });

  it('parse le format MM:SS', () => {
    expect(parseTimeToSeconds('05:30')).toBe(330);
  });

  it('parse un nombre brut de secondes', () => {
    expect(parseTimeToSeconds('45')).toBe(45);
  });

  it('retourne 0 pour une entrée vide/nulle', () => {
    expect(parseTimeToSeconds('')).toBe(0);
    expect(parseTimeToSeconds(null)).toBe(0);
  });

  it('retire les guillemets résiduels d\'un export CSV', () => {
    expect(parseTimeToSeconds('"05:30"')).toBe(330);
  });
});
