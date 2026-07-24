import { describe, it, expect } from 'vitest';
import { buildCoverUrl } from '../src/utils/coverArt.js';

describe('buildCoverUrl', () => {
  it('construit une URL DiceBear "shapes" avec le seed encodé', () => {
    expect(buildCoverUrl('Ma Session Rock')).toBe(
      'https://api.dicebear.com/10.x/shapes/svg?seed=Ma%20Session%20Rock&backgroundColor=f87171,fb923c,fbbf24,a3e635,4ade80,2dd4bf,38bdf8,818cf8,a78bfa,e879f9,fb7185,94a3b8'
    );
  });

  it('est déterministe : même seed = même URL, à chaque appel', () => {
    expect(buildCoverUrl('test')).toBe(buildCoverUrl('test'));
  });

  it('encode les caractères spéciaux dans le seed (espaces, accents, emoji)', () => {
    const url = buildCoverUrl('Séance Été 🔥');
    expect(url).toContain('seed=S%C3%A9ance%20%C3%89t%C3%A9%20%F0%9F%94%A5');
  });

  it('n\'échappe PAS l\'apostrophe (hors du jeu de caractères réservés par encodeURIComponent)', () => {
    // Non-régression volontaire : ce n'est pas un bug, encodeURIComponent
    // laisse l'apostrophe telle quelle par design (RFC 3986, sous-ensemble
    // "unreserved"). Si ce comportement doit changer un jour (ex. passage à
    // un encodage plus strict), ce test doit être mis à jour consciemment.
    expect(buildCoverUrl("Powerlifter's Anthem")).toContain("seed=Powerlifter's%20Anthem");
  });

  it('ne plante pas sur un seed vide', () => {
    expect(buildCoverUrl('')).toContain('seed=&backgroundColor=');
  });
});
