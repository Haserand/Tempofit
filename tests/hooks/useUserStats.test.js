// @vitest-environment jsdom
//
// `renderHook` (@testing-library/react) a besoin du DOM (`window`,
// `localStorage`...) — ce projet utilise `environment: 'node'` par défaut
// pour TOUS les tests (perf, voir vite.config.js), donc ce pragma est
// OBLIGATOIRE ici, en 1re ligne exacte du fichier (pas plus bas, pas un
// simple commentaire explicatif — Vitest ne le reconnaît que sous cette
// forme précise). Même convention que useSyncedCollection.test.js/
// ViewHeader.test.jsx/GuestModeBar.test.jsx/DualRangeSlider.test.jsx.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserStats } from '../../src/hooks/useUserStats';

// Badge de notification "vu/pas vu" (03/08, retour direct, capture d'écran :
// "quand j'ai ouvert la partie trophées, l'icône doit devenir grise... et
// les notifications '5' doit être retiré, sinon on pollue visuellement") —
// voir la docstring complète de `unseenTrophyCount`/`markTrophiesSeen`,
// useUserStats.js. `checkTrophies` lui-même (déblocage) est PRÉ-EXISTANT et
// n'a jamais eu de test dédié avant ce fichier — volontairement gardé HORS
// SCOPE ici (ce fichier ne teste QUE ce qui vient d'être ajouté), pas
// reproduit à l'identique pour ne pas gonfler ce chantier ponctuel en audit
// complet d'un système préexistant non demandé.
//
// `useUserStats` s'appuie sur `usePersistentState` (localStorage +
// AuthContext) — `useAuthContext()` retombe sur un `FALLBACK` sûr sans
// wrapper `<AuthProvider>` (voir AuthContext.jsx), donc `renderHook` direct
// fonctionne sans monter de Provider ici, comme pour n'importe quel autre
// hook de ce fichier qui n'a pas besoin de tester la synchro Supabase
// elle-même.
describe('useUserStats — unseenTrophyCount / markTrophiesSeen', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('unseenTrophyCount vaut 0 par défaut (aucun trophée débloqué)', () => {
    const { result } = renderHook(() => useUserStats(() => {}, null));
    expect(result.current.unseenTrophyCount).toBe(0);
  });

  it('unseenTrophyCount reflète les trophées débloqués tant qu\'ils n\'ont jamais été vus', () => {
    const { result } = renderHook(() => useUserStats(() => {}, null));

    act(() => {
      result.current.checkTrophies({ ...result.current.userStats, totalCompleted: 1 });
    });

    // Le 1er trophée de TROPHIES_DATA à condition 'total' devrait se
    // débloquer à `totalCompleted: 1` (ex. "première séance") — vérifié
    // via `unlockedTrophies.length` plutôt qu'un id en dur, pour ne pas
    // dépendre du contenu exact d'appConfig.js dans ce test.
    expect(result.current.userStats.unlockedTrophies.length).toBeGreaterThan(0);
    expect(result.current.unseenTrophyCount).toBe(result.current.userStats.unlockedTrophies.length);
  });

  it('markTrophiesSeen ramène unseenTrophyCount à 0', () => {
    const { result } = renderHook(() => useUserStats(() => {}, null));

    act(() => {
      result.current.checkTrophies({ ...result.current.userStats, totalCompleted: 1 });
    });
    expect(result.current.unseenTrophyCount).toBeGreaterThan(0);

    act(() => {
      result.current.markTrophiesSeen();
    });

    expect(result.current.unseenTrophyCount).toBe(0);
  });

  // Cas central de cette refonte : un COMPTEUR, pas juste un booléen "a
  // déjà visité la page une fois" — un nouveau déblocage APRÈS une 1re
  // consultation doit ressortir un badge, avec seulement le nombre de
  // trophées RÉELLEMENT nouveaux (pas le total).
  it('un nouveau déblocage APRÈS markTrophiesSeen fait réapparaître le badge, avec seulement le delta', () => {
    const { result } = renderHook(() => useUserStats(() => {}, null));

    act(() => {
      result.current.checkTrophies({ ...result.current.userStats, totalCompleted: 1 });
    });
    const countAfterFirstUnlock = result.current.userStats.unlockedTrophies.length;

    act(() => {
      result.current.markTrophiesSeen();
    });
    expect(result.current.unseenTrophyCount).toBe(0);

    act(() => {
      result.current.checkTrophies({ ...result.current.userStats, totalCompleted: 10 });
    });
    const countAfterSecondUnlock = result.current.userStats.unlockedTrophies.length;

    // Si `totalCompleted: 10` a débloqué au moins un trophée de plus que
    // `totalCompleted: 1`, le delta doit apparaître — sinon (config
    // TROPHIES_DATA qui ne débloquerait rien de plus à ce palier) ce test
    // n'a rien à vérifier de plus, mais ne doit pas non plus planter.
    const expectedDelta = countAfterSecondUnlock - countAfterFirstUnlock;
    expect(result.current.unseenTrophyCount).toBe(expectedDelta);
  });

  it('markTrophiesSeen est idempotent (rappelé sans nouveau déblocage entre-temps, reste à 0)', () => {
    const { result } = renderHook(() => useUserStats(() => {}, null));

    act(() => {
      result.current.checkTrophies({ ...result.current.userStats, totalCompleted: 1 });
      result.current.markTrophiesSeen();
    });
    act(() => {
      result.current.markTrophiesSeen();
    });

    expect(result.current.unseenTrophyCount).toBe(0);
  });
});
