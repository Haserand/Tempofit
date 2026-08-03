// Premier fichier de test pour curatedSessions.js — scopé à
// `fakeCloneCountForId` (chantier "compteur de clonages", 02/08, retour
// direct "chaque playlist en Découvrir devrait au minimum avoir une
// indication du nombre de clonages"). Pas une couverture du CATALOGUE
// lui-même (`curatedSessions`/`naughtyCuratedSessions`, simples données
// statiques) — seule la fonction partagée mérite un test.

import { describe, it, expect } from 'vitest';
import { fakeCloneCountForId } from '../../src/data/curatedSessions.js';

describe('fakeCloneCountForId', () => {
  it('renvoie toujours un nombre entre 8 et 72 (jamais 0 — "toujours ambitieux")', () => {
    ['tpl-a', 'tpl-b', 'ntpl-heat-rising', 'x', 'un-id-plus-long-que-les-autres'].forEach(id => {
      const count = fakeCloneCountForId(id);
      expect(count).toBeGreaterThanOrEqual(8);
      expect(count).toBeLessThanOrEqual(72);
    });
  });

  it('est déterministe — le même id renvoie TOUJOURS exactement le même nombre', () => {
    expect(fakeCloneCountForId('tpl-midnight-runner-160')).toBe(fakeCloneCountForId('tpl-midnight-runner-160'));
  });

  it('des ids différents produisent généralement des nombres différents (pas une constante déguisée)', () => {
    const values = new Set(['tpl-a', 'tpl-b', 'tpl-c', 'tpl-d', 'tpl-e'].map(fakeCloneCountForId));
    expect(values.size).toBeGreaterThan(1);
  });

  // Garde défensive (trouvée en écrivant les tests de TemplateCard.jsx :
  // son fixture existant n'avait jamais eu besoin d'un `id` avant cette
  // fonction) — un vrai template a toujours un id, ce cas ne devrait
  // jamais se produire en usage réel, mais ne doit jamais planter toute
  // une carte pour un détail sans rapport.
  it('ne plante pas et renvoie une valeur par défaut si id est absent/vide/pas une chaîne', () => {
    expect(fakeCloneCountForId(undefined)).toBe(8);
    expect(fakeCloneCountForId(null)).toBe(8);
    expect(fakeCloneCountForId('')).toBe(8);
    expect(fakeCloneCountForId(42)).toBe(8);
  });
});
