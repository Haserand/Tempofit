import { describe, it, expect } from 'vitest';
import { getDeezerTrackUrl } from '../../src/utils/deezerLink.js';

describe('getDeezerTrackUrl', () => {
  it('construit le bon lien pour un trackId Deezer réel', () => {
    expect(getDeezerTrackUrl('deezer-123456')).toBe('https://www.deezer.com/track/123456');
  });

  it('renvoie null pour un titre de secours (aucun vrai titre Deezer derrière)', () => {
    expect(getDeezerTrackUrl('fallback-1724750000000-a1b2c3')).toBeNull();
  });

  it('renvoie null pour un titre du catalogue vitrine (identifiant purement local)', () => {
    expect(getDeezerTrackUrl('curated-template-1-3')).toBeNull();
  });

  it('renvoie null pour une valeur absente/invalide', () => {
    expect(getDeezerTrackUrl(null)).toBeNull();
    expect(getDeezerTrackUrl(undefined)).toBeNull();
    expect(getDeezerTrackUrl('')).toBeNull();
    expect(getDeezerTrackUrl(42)).toBeNull();
  });

  it('renvoie null si le préfixe est présent mais l\'identifiant numérique est vide', () => {
    expect(getDeezerTrackUrl('deezer-')).toBeNull();
  });
});
