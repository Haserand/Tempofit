// @vitest-environment jsdom
//
// `renderHook` (@testing-library/react) a besoin du DOM (`window`,
// `localStorage`...) — ce projet utilise `environment: 'node'` par défaut
// pour TOUS les tests (perf, voir vite.config.js), donc ce pragma est
// OBLIGATOIRE ici, en 1re ligne exacte du fichier (pas plus bas, pas un
// simple commentaire explicatif — Vitest ne le reconnaît que sous cette
// forme précise). Même convention que useUserStats.test.js/
// useSyncedCollection.test.js/ViewHeader.test.jsx/GuestModeBar.test.jsx/
// DualRangeSlider.test.jsx.
//
// Premier fichier de test pour useAthleticProfile.js (10/08, check-up —
// voir la docstring "STABILISATION RÉFÉRENTIELLE" en tête de ce hook, et
// celle d'AthleticContext.jsx). Ciblé UNIQUEMENT sur le comportement AJOUTÉ
// ce jour-là (stabilité référentielle des fonctions de mutation + de
// l'objet retourné) — pas une couverture exhaustive des 383 lignes
// pré-existantes de ce hook (calcul des zones, migration V1, activités
// personnalisées...), déjà couvertes indirectement via les composants qui
// les consomment (AthleticProfilePanel.jsx, GeneratorWizard.jsx...), tous
// mockant `useAthleticContext()` entièrement — aucun d'eux n'exerçait
// jusqu'ici la vraie implémentation de ce hook, d'où l'absence totale de
// test dédié avant ce fichier malgré sa taille.
//
// `useAthleticProfile` s'appuie sur `usePersistentState` (localStorage +
// AuthContext) — `useAuthContext()` retombe sur un `FALLBACK` sûr sans
// wrapper `<AuthProvider>` (voir AuthContext.jsx), donc `renderHook` direct
// fonctionne sans monter de Provider ici, même raisonnement que
// useUserStats.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAthleticProfile } from '../../src/hooks/useAthleticProfile';

describe('useAthleticProfile — stabilité référentielle (NOUVEAU, 10/08)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renvoie le MÊME objet si le composant appelant re-rend sans que le profil ait changé', () => {
    const { result, rerender } = renderHook(() => useAthleticProfile());

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second).toBe(first);
  });

  // La vraie raison d'être de ce chantier : AVANT le 10/08, chacune de ces
  // 10 fonctions était une simple `const` recréée à CHAQUE appel du hook —
  // donc une nouvelle référence à chaque re-render du composant appelant,
  // même sans aucun changement de profil. `AthleticContext.jsx` (08/08)
  // enveloppe l'objet retourné ici dans un `useMemo` qui en dépend
  // ENTIÈREMENT — sa docstring affirmait la stabilité "à la source" comme
  // acquise, ce qui était faux tant que ces fonctions n'étaient pas
  // elles-mêmes stables.
  it('les 10 fonctions de mutation gardent la MÊME référence entre deux rendus sans changement', () => {
    const { result, rerender } = renderHook(() => useAthleticProfile());
    const before = result.current;
    rerender();
    const after = result.current;

    expect(after.setBaseBpmForActivity).toBe(before.setBaseBpmForActivity);
    expect(after.setZoneForActivity).toBe(before.setZoneForActivity);
    expect(after.resetActivityProfile).toBe(before.resetActivityProfile);
    expect(after.addCustomActivity).toBe(before.addCustomActivity);
    expect(after.removeCustomActivity).toBe(before.removeCustomActivity);
    expect(after.setBaseBpmForCustom).toBe(before.setBaseBpmForCustom);
    expect(after.setZoneForCustom).toBe(before.setZoneForCustom);
    expect(after.setCadenceIntentForActivity).toBe(before.setCadenceIntentForActivity);
    expect(after.setCadenceIntentForCustom).toBe(before.setCadenceIntentForCustom);
    expect(after.resetAthleticProfile).toBe(before.resetAthleticProfile);
  });

  it('renvoie un NOUVEL objet quand le profil change réellement (setBaseBpmForActivity)', () => {
    const { result } = renderHook(() => useAthleticProfile());

    const before = result.current;
    act(() => { result.current.setBaseBpmForActivity('Course à pied', '160'); });
    const after = result.current;

    expect(after).not.toBe(before);
    expect(after.athleticProfile.activities['Course à pied'].targetBpm).toBe(160);
    expect(after.athleticProfile.activities['Course à pied'].isConfigured).toBe(true);
  });

  it('les fonctions de mutation restent identiques même APRÈS un changement réel de profil (useCallback([]) — jamais recréées, y compris post-mutation)', () => {
    const { result } = renderHook(() => useAthleticProfile());

    const before = result.current.setBaseBpmForActivity;
    act(() => { result.current.setBaseBpmForActivity('Course à pied', '160'); });
    const after = result.current.setBaseBpmForActivity;

    expect(after).toBe(before);
  });

  // Contrôle négatif — sans ce test, une implémentation qui renverrait
  // toujours le même objet (bug inverse : `useMemo` avec un tableau de
  // dépendances vide par erreur) pourrait passer les tests ci-dessus à
  // tort. `getProfileForWorkout` (stabilisée depuis le 03/08, AVANT ce
  // chantier) DOIT changer de référence quand `athleticProfile` change —
  // c'est sa seule vraie dépendance (voir sa propre docstring).
  it('getProfileForWorkout change de référence quand athleticProfile change réellement (contrôle négatif)', () => {
    const { result } = renderHook(() => useAthleticProfile());

    const before = result.current.getProfileForWorkout;
    act(() => { result.current.setBaseBpmForActivity('Course à pied', '160'); });
    const after = result.current.getProfileForWorkout;

    expect(after).not.toBe(before);
  });
});
