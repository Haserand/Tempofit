// @vitest-environment jsdom
//
// Premier fichier de test pour useGeneratorForm.js (441 lignes, le plus
// gros hook du projet). Volontairement SCOPÉ à `applyProfileBpmIfUntouched`
// — le comportement STABILISÉ le 08/08 (chantier "CustomActivityModal.jsx
// re-rend à chaque réglage du wizard") — pas une couverture exhaustive du
// reste (déjà couvert indirectement via GeneratorWizard.test.jsx, qui
// mocke ce hook plutôt que de le faire tourner pour de vrai).

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeneratorForm } from '../../src/hooks/useGeneratorForm.js';

function renderForm(isNaughtyMode = false, athleticProfile = { activities: {}, custom: [] }) {
  return renderHook(
    ({ naughty, profile }) => useGeneratorForm(naughty, profile),
    { initialProps: { naughty: isNaughtyMode, profile: athleticProfile } },
  );
}

describe('useGeneratorForm — applyProfileBpmIfUntouched, comportement métier (inchangé)', () => {
  it('applique le BPM du profil (zone3 priorisée sur zone2) quand le BPM n\'a jamais été touché manuellement', () => {
    const { result } = renderForm();
    act(() => {
      result.current.applyProfileBpmIfUntouched({ isConfigured: true, zone1: 100, zone2: 150, zone3: 165, zone4: 180 });
    });
    expect(result.current.bpm).toBe(165);
  });

  it('replie sur zone2 si zone3 est absente', () => {
    const { result } = renderForm();
    act(() => {
      result.current.applyProfileBpmIfUntouched({ isConfigured: true, zone1: 100, zone2: 150 });
    });
    expect(result.current.bpm).toBe(150);
  });

  it('ne touche PAS au BPM si le profil n\'est pas configuré (isConfigured: false)', () => {
    const { result } = renderForm();
    const before = result.current.bpm;
    act(() => {
      result.current.applyProfileBpmIfUntouched({ isConfigured: false });
    });
    expect(result.current.bpm).toBe(before);
  });

  it('ne touche PAS au BPM si l\'utilisateur l\'a déjà réglé manuellement (bpmTouchedManually)', () => {
    const { result } = renderForm();
    act(() => { result.current.setBpmManual(140); });
    act(() => {
      result.current.applyProfileBpmIfUntouched({ isConfigured: true, zone2: 150, zone3: 165 });
    });
    expect(result.current.bpm).toBe(140);
  });
});

// NOUVEAU (08/08) — la vraie raison d'être de ce fichier : vérifier que
// `applyProfileBpmIfUntouched` reste RÉFÉRENTIELLEMENT STABLE d'un rendu à
// l'autre (condition nécessaire pour que CustomActivityContext.jsx, qui la
// réexpose, puisse être mémoïsé utilement — voir la docstring du hook)
// TOUT EN continuant à lire l'état LE PLUS RÉCENT à chaque appel (via les
// refs internes), jamais figée sur les valeurs du 1er rendu.
describe('useGeneratorForm — applyProfileBpmIfUntouched, stabilité référentielle (NOUVEAU, 08/08)', () => {
  it('garde la MÊME référence à travers un re-rendu déclenché par un changement d\'état sans rapport', () => {
    const { result, rerender } = renderForm();
    const first = result.current.applyProfileBpmIfUntouched;

    act(() => { result.current.setCrossfade(5); });
    rerender({ naughty: false, profile: { activities: {}, custom: [] } });

    expect(result.current.applyProfileBpmIfUntouched).toBe(first);
  });

  it('garde la MÊME référence même après un changement de structureMode (précisément le state qu\'elle lit)', () => {
    const { result } = renderForm();
    const first = result.current.applyProfileBpmIfUntouched;

    act(() => { result.current.setStructureMode('crescendo'); });

    expect(result.current.applyProfileBpmIfUntouched).toBe(first);
  });

  it('mais lit bien le structureMode ACTUEL au moment de l\'appel — pas figée sur "constant" du 1er rendu', () => {
    const { result } = renderForm();
    const profile = { isConfigured: true, zone1: 100, zone2: 150, zone3: 165, zone4: 180 };

    // En mode 'constant' (par défaut), un profil configuré + BPM jamais
    // touché manuellement active bpmSourceIsProfile (voir setStructureMode,
    // branche `mode === 'constant'`).
    act(() => { result.current.applyProfileBpmIfUntouched(profile); });
    expect(result.current.bpmSourceIsProfile).toBe(true);

    // Bascule en mode 'interval' (Fractionné) — sa branche (le `else` de
    // setStructureMode) met INCONDITIONNELLEMENT bpmSourceIsProfile à
    // false, peu importe le profil. Si `applyProfileBpmIfUntouched` lisait
    // encore 'constant' (figée sur le 1er rendu plutôt que lue à travers
    // le ref), bpmSourceIsProfile resterait `true` ici — c'est ce signal,
    // pas `crescendoWarmupBpm` (qui se réamorce dès l'entrée en mode
    // crescendo, profil ou non, et ne permet donc pas de distinguer les
    // deux cas), qui prouve que le state lu est bien le plus récent.
    act(() => { result.current.setStructureMode('interval'); });
    act(() => { result.current.applyProfileBpmIfUntouched(profile); });
    expect(result.current.bpmSourceIsProfile).toBe(false);
  });
});
