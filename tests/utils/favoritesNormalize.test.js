import { describe, it, expect } from 'vitest';
import { normalizeFavorites } from '../src/utils/favoritesNormalize.js';

describe('normalizeFavorites', () => {
  it('laisse inchangé un objet déjà au nouveau format (standard/naughty)', () => {
    const modern = {
      useFavorites: true,
      standard: { artists: ['The Killers'], tracks: [] },
      naughty: { artists: [], tracks: [] },
    };
    expect(normalizeFavorites(modern)).toBe(modern);
  });

  it('migre l\'ancien format PLAT vers le bucket "standard", sans rien perdre', () => {
    const legacy = {
      useFavorites: true,
      artists: ['The Killers', 'AC/DC'],
      tracks: [{ trackId: 'x', title: 'Thunderstruck' }],
    };
    expect(normalizeFavorites(legacy)).toEqual({
      useFavorites: true,
      standard: { artists: ['The Killers', 'AC/DC'], tracks: [{ trackId: 'x', title: 'Thunderstruck' }] },
      naughty: { artists: [], tracks: [] },
    });
  });

  it('ne plante pas si artists/tracks sont absents de l\'ancien format (repli sur tableaux vides)', () => {
    expect(normalizeFavorites({ useFavorites: false })).toEqual({
      useFavorites: false,
      standard: { artists: [], tracks: [] },
      naughty: { artists: [], tracks: [] },
    });
  });

  it('préserve la valeur de useFavorites (y compris false) pendant la migration', () => {
    expect(normalizeFavorites({ useFavorites: false, artists: ['A'], tracks: [] }).useFavorites).toBe(false);
  });
});
