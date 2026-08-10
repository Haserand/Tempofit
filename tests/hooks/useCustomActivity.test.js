// @vitest-environment jsdom
//
// Premier fichier de test pour CustomActivityContext.jsx (nouveau, 08/08 —
// chantier "CustomActivityModal.jsx re-rend à chaque réglage du wizard").
// Même principe que AthleticContext.test.jsx : ciblé sur la SEULE chose
// qui justifie l'existence de ce Contexte, la stabilité référentielle de
// sa `value` — pas une couverture de la logique métier de
// `useCustomActivity`/`useGeneratorForm` (déjà testées directement dans
// leurs propres fichiers).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CustomActivityProvider, useCustomActivityContext } from '../../src/contexts/CustomActivityContext.jsx';

afterEach(() => {
  cleanup();
});

function makeCustomActivityApi(overrides = {}) {
  return {
    customActivity: '', setCustomActivity: vi.fn(),
    tempCustomActivity: '', setTempCustomActivity: vi.fn(),
    isCustomActivityModalOpen: false, setIsCustomActivityModalOpen: vi.fn(),
    handleOpenCustomActivityModal: vi.fn(),
    ...overrides,
  };
}

const captured = [];
function Probe() {
  captured.push(useCustomActivityContext());
  return null;
}

describe('CustomActivityContext — comportement de base', () => {
  it('useCustomActivityContext() hors Provider renvoie un repli inerte (pas de crash)', () => {
    captured.length = 0;
    render(<Probe />);
    expect(captured[0].isCustomActivityModalOpen).toBe(false);
    expect(typeof captured[0].applyProfileBpmIfUntouched).toBe('function');
  });

  it('réexpose tous les champs de customActivityApi ET applyProfileBpmIfUntouched tels quels', () => {
    captured.length = 0;
    const customActivityApi = makeCustomActivityApi({ customActivity: 'Escalade' });
    const applyProfileBpmIfUntouched = vi.fn();
    render(
      <CustomActivityProvider customActivityApi={customActivityApi} applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}>
        <Probe />
      </CustomActivityProvider>
    );
    expect(captured[0].customActivity).toBe('Escalade');
    expect(captured[0].applyProfileBpmIfUntouched).toBe(applyProfileBpmIfUntouched);
    expect(captured[0].setCustomActivity).toBe(customActivityApi.setCustomActivity);
  });
});

// NOUVEAU — la vraie raison d'être de ce Contexte (voir sa docstring) :
// sa `value` doit garder la MÊME référence tant que `customActivityApi`/
// `applyProfileBpmIfUntouched` ne changent pas réellement — condition dont
// dépend directement le fait que `CustomActivityModal.jsx` (montée
// globalement dans App.jsx) ne re-rende plus à chaque réglage du wizard.
describe('CustomActivityContext — stabilité référentielle de la value (useMemo)', () => {
  it('un re-rendu du Provider avec les MÊMES références (customActivityApi/applyProfileBpmIfUntouched inchangés) renvoie la MÊME value', () => {
    captured.length = 0;
    const customActivityApi = makeCustomActivityApi();
    const applyProfileBpmIfUntouched = vi.fn();
    const { rerender } = render(
      <CustomActivityProvider customActivityApi={customActivityApi} applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}>
        <Probe />
      </CustomActivityProvider>
    );
    rerender(
      <CustomActivityProvider customActivityApi={customActivityApi} applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}>
        <Probe />
      </CustomActivityProvider>
    );
    expect(captured.length).toBe(2);
    expect(captured[1]).toBe(captured[0]);
  });

  it('customActivityApi qui change de référence (nouvel objet) fait bien recalculer la value', () => {
    captured.length = 0;
    const applyProfileBpmIfUntouched = vi.fn();
    const { rerender } = render(
      <CustomActivityProvider customActivityApi={makeCustomActivityApi()} applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}>
        <Probe />
      </CustomActivityProvider>
    );
    rerender(
      <CustomActivityProvider customActivityApi={makeCustomActivityApi()} applyProfileBpmIfUntouched={applyProfileBpmIfUntouched}>
        <Probe />
      </CustomActivityProvider>
    );
    expect(captured[1]).not.toBe(captured[0]);
  });

  it('applyProfileBpmIfUntouched qui change de référence fait bien recalculer la value', () => {
    captured.length = 0;
    const customActivityApi = makeCustomActivityApi();
    const { rerender } = render(
      <CustomActivityProvider customActivityApi={customActivityApi} applyProfileBpmIfUntouched={vi.fn()}>
        <Probe />
      </CustomActivityProvider>
    );
    rerender(
      <CustomActivityProvider customActivityApi={customActivityApi} applyProfileBpmIfUntouched={vi.fn()}>
        <Probe />
      </CustomActivityProvider>
    );
    expect(captured[1]).not.toBe(captured[0]);
  });
});
