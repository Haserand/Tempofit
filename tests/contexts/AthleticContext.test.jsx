// @vitest-environment jsdom
//
// Premier fichier de test pour AthleticContext.jsx — jusqu'ici couvert
// seulement indirectement (via les tests des composants qui le mockent :
// AthleticProfilePanel.test.jsx, CustomActivityModal.test.jsx...). Ajouté
// en complétant le chantier "CustomActivityModal.jsx re-rend à chaque
// réglage du wizard" (08/08) — cohérent avec l'habitude de travail "après
// un découpage de fichier src/, ajouter un fichier de test dédié" déjà
// actée sur ce projet. Ciblé sur la SEULE chose qui justifie l'existence de
// ce Contexte : que sa `value` reste RÉFÉRENTIELLEMENT STABLE tant que
// `isNaughtyMode`/`athleticProfileApi` ne changent pas — pas une
// couverture de l'API athlétique elle-même (déjà testée via
// useAthleticProfile côté consommateurs).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AthleticProvider, useAthleticContext } from '../../src/contexts/AthleticContext.jsx';

afterEach(() => {
  cleanup();
});

function makeAthleticProfileApi(overrides = {}) {
  return {
    athleticProfile: { activities: {}, custom: [] },
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
    buildDefaultPreviewProfile: vi.fn(() => ({ isConfigured: false })),
    ...overrides,
  };
}

// Sonde minimale — capture la `value` du Contexte à chaque rendu dans un
// tableau, pour comparer les références d'un rendu à l'autre après coup.
const captured = [];
function Probe() {
  captured.push(useAthleticContext());
  return null;
}

describe('AthleticContext — comportement de base', () => {
  it('useAthleticContext() hors Provider renvoie un repli inerte (pas de crash)', () => {
    captured.length = 0;
    render(<Probe />);
    expect(captured[0].isNaughtyMode).toBe(false);
    expect(typeof captured[0].getProfileForWorkout).toBe('function');
  });

  it('réexpose isNaughtyMode et tous les champs de athleticProfileApi tels quels', () => {
    captured.length = 0;
    const athleticProfileApi = makeAthleticProfileApi({ athleticProfile: { activities: { Cyclisme: {} }, custom: [] } });
    render(
      <AthleticProvider isNaughtyMode={true} athleticProfileApi={athleticProfileApi}>
        <Probe />
      </AthleticProvider>
    );
    expect(captured[0].isNaughtyMode).toBe(true);
    expect(captured[0].athleticProfile).toEqual({ activities: { Cyclisme: {} }, custom: [] });
    expect(captured[0].getProfileForWorkout).toBe(athleticProfileApi.getProfileForWorkout);
  });
});

// NOUVEAU — la vraie raison d'être de ce Contexte (voir sa docstring) :
// sa `value` doit garder la MÊME référence tant qu'`isNaughtyMode`/
// `athleticProfileApi` ne changent pas réellement, pour que les
// consommateurs qui n'ont besoin QUE de ces champs ne re-rendent pas à
// cause d'un changement sans rapport ailleurs dans l'app.
describe('AthleticContext — stabilité référentielle de la value (useMemo)', () => {
  it('un re-rendu du Provider avec les MÊMES props (même référence athleticProfileApi) renvoie la MÊME value', () => {
    captured.length = 0;
    const athleticProfileApi = makeAthleticProfileApi();
    const { rerender } = render(
      <AthleticProvider isNaughtyMode={false} athleticProfileApi={athleticProfileApi}>
        <Probe />
      </AthleticProvider>
    );
    rerender(
      <AthleticProvider isNaughtyMode={false} athleticProfileApi={athleticProfileApi}>
        <Probe />
      </AthleticProvider>
    );
    expect(captured.length).toBe(2);
    expect(captured[1]).toBe(captured[0]);
  });

  it('athleticProfileApi qui change de référence (nouvel objet, même contenu) fait bien recalculer la value', () => {
    captured.length = 0;
    const { rerender } = render(
      <AthleticProvider isNaughtyMode={false} athleticProfileApi={makeAthleticProfileApi()}>
        <Probe />
      </AthleticProvider>
    );
    rerender(
      <AthleticProvider isNaughtyMode={false} athleticProfileApi={makeAthleticProfileApi()}>
        <Probe />
      </AthleticProvider>
    );
    expect(captured[1]).not.toBe(captured[0]);
  });

  it('isNaughtyMode qui change fait bien recalculer la value', () => {
    captured.length = 0;
    const athleticProfileApi = makeAthleticProfileApi();
    const { rerender } = render(
      <AthleticProvider isNaughtyMode={false} athleticProfileApi={athleticProfileApi}>
        <Probe />
      </AthleticProvider>
    );
    rerender(
      <AthleticProvider isNaughtyMode={true} athleticProfileApi={athleticProfileApi}>
        <Probe />
      </AthleticProvider>
    );
    expect(captured[1]).not.toBe(captured[0]);
    expect(captured[1].isNaughtyMode).toBe(true);
  });
});
