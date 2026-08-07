// @vitest-environment jsdom
//
// Premier fichier de test pour localCache.js (nouveau, 07/08 — voir sa
// docstring pour le raisonnement complet : correctif de la dette "les
// données restent dans localStorage après déconnexion, sur un appareil
// partagé le compte suivant pourrait les voir/modifier"). Vrai
// `window.localStorage` de jsdom, pas mocké — vérifie le comportement réel.

import { describe, it, expect, afterEach } from 'vitest';
import { STORAGE_PREFIX, clearLocalCache } from '../../src/utils/localCache.js';

afterEach(() => {
  window.localStorage.clear();
});

describe('clearLocalCache', () => {
  it('supprime toutes les clés préfixées tempofit: de localStorage', () => {
    window.localStorage.setItem('tempofit:savedPlaylists', '[]');
    window.localStorage.setItem('tempofit:routines', '[]');
    window.localStorage.setItem('tempofit:theme', '"dark"');

    clearLocalCache();

    expect(window.localStorage.getItem('tempofit:savedPlaylists')).toBeNull();
    expect(window.localStorage.getItem('tempofit:routines')).toBeNull();
    expect(window.localStorage.getItem('tempofit:theme')).toBeNull();
  });

  it('ne touche JAMAIS une clé qui ne commence pas par STORAGE_PREFIX (autre app sur le même domaine)', () => {
    window.localStorage.setItem('tempofit:theme', '"dark"');
    window.localStorage.setItem('une-autre-app:preference', 'valeur-etrangere');
    // Cas piège : une clé qui CONTIENT le préfixe mais ne COMMENCE pas par
    // lui — ne doit pas non plus être supprimée (`startsWith`, jamais
    // `includes`).
    window.localStorage.setItem('prefix-tempofit:pas-le-bon-format', 'a garder');

    clearLocalCache();

    expect(window.localStorage.getItem('tempofit:theme')).toBeNull();
    expect(window.localStorage.getItem('une-autre-app:preference')).toBe('valeur-etrangere');
    expect(window.localStorage.getItem('prefix-tempofit:pas-le-bon-format')).toBe('a garder');
  });

  it('sur un localStorage déjà vide, ne fait rien et ne lève aucune erreur', () => {
    expect(() => clearLocalCache()).not.toThrow();
  });

  it('STORAGE_PREFIX vaut bien "tempofit:" — même valeur que celle historiquement dupliquée dans usePersistentState.js/useSyncedCollection.js', () => {
    expect(STORAGE_PREFIX).toBe('tempofit:');
  });
});
