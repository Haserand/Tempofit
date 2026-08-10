// @vitest-environment jsdom
//
// Premier fichier de test pour useNavigation.js — volontairement scopé à
// `buildCuratedPlaylistName`, la SEULE fonction PURE exportée par ce
// fichier (le hook lui-même a besoin de `useGeneratorContext()`/
// `useModalContext()` pour exister, bien plus lourd à monter pour ce
// besoin précis). Extraite le 08/08 (chantier "émoji baké en texte
// littéral dans le titre") — même principe que
// `buildGeneratedPlaylistName` dans musicEngine.test.js.

import { describe, it, expect } from 'vitest';
import { buildCuratedPlaylistName } from '../../src/hooks/useNavigation.js';

describe('buildCuratedPlaylistName', () => {
  it('préfixe le titre du template avec l\'émoji correspondant à finalWorkoutType', () => {
    const name = buildCuratedPlaylistName({ title: 'Sprint Zone 180' }, 'Course à pied');
    expect(name).toBe('🏃 Sprint Zone 180');
  });

  it('replie sur l\'émoji par défaut (🎧) pour un type d\'activité non reconnu', () => {
    const name = buildCuratedPlaylistName({ title: 'Séance libre' }, 'Escalade');
    expect(name).toBe('🎧 Séance libre');
  });

  // "BUG ÉVITÉ" (voir openCuratedPlaylist, useNavigation.js) — un template
  // ouvert en Mode Intime doit recevoir l'émoji de 'Ambiance' (le
  // `finalWorkoutType` RÉEL une fois le pare-feu appliqué), jamais celui du
  // `workoutType` brut du template lui-même.
  it('utilise le finalWorkoutType REÇU (déjà pare-feu Mode Intime appliqué par l\'appelant), pas le workoutType brut du template', () => {
    const name = buildCuratedPlaylistName({ title: 'Full Body', workoutType: 'Musculation' }, 'Ambiance');
    expect(name).toBe('🌶️ Full Body');
  });
});
