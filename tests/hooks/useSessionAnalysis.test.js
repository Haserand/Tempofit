// @vitest-environment jsdom
//
// Test dédié à useSessionAnalysis.js — 0 test jusqu'ici (check-up du
// 13/08) malgré une vraie logique différenciante du projet (comparaison
// cadence/FC réelle importée via CSV Garmin/Strava à la courbe de BPM
// musical cible, voir README.md, "Vague 2 — Renforcement post-hoc").
// Aucune dépendance externe (pas de Contexte, pas de réseau) — seul
// `renderHook` (donc `jsdom`) est nécessaire, pour les 2 `useEffect`.

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionAnalysis } from '../../src/hooks/useSessionAnalysis.js';

describe('useSessionAnalysis — état initial', () => {
  it('sans playlist (undefined) : valeurs par défaut sûres, aucun plantage', () => {
    const { result } = renderHook(() => useSessionAnalysis(undefined));
    expect(result.current.dataOffset).toBe(0);
    expect(result.current.selectedAnalysisDate).toBeNull();
    expect(result.current.selectedMetric).toBe('cadence');
    expect(result.current.currentActualData).toBeNull();
    expect(result.current.availableMetrics).toEqual({ cadence: false, heartRate: false });
  });

  it('playlist sans actualDataByDate : selectedAnalysisDate reste null', () => {
    const { result } = renderHook(() => useSessionAnalysis({ id: 'pl-1' }));
    expect(result.current.selectedAnalysisDate).toBeNull();
    expect(result.current.currentActualData).toBeNull();
  });

  it('playlist avec des dates de données réelles : présélectionne la PLUS RÉCENTE', () => {
    const playlist = {
      id: 'pl-1',
      actualDataByDate: {
        '2026-08-01': [{ cadenceReelle: 88 }],
        '2026-08-05': [{ cadenceReelle: 90 }],
        '2026-08-03': [{ cadenceReelle: 89 }],
      },
    };
    const { result } = renderHook(() => useSessionAnalysis(playlist));
    expect(result.current.selectedAnalysisDate).toBe('2026-08-05');
    expect(result.current.currentActualData).toEqual([{ cadenceReelle: 90 }]);
  });
});

describe('useSessionAnalysis — changement de playlist affichée', () => {
  it('réinitialise dataOffset à 0 et re-présélectionne la date la plus récente de la NOUVELLE playlist', () => {
    const playlistA = { id: 'pl-a', actualDataByDate: { '2026-08-01': [{ cadenceReelle: 88 }] } };
    const playlistB = { id: 'pl-b', actualDataByDate: { '2026-08-09': [{ cadenceReelle: 95 }] } };

    const { result, rerender } = renderHook(({ playlist }) => useSessionAnalysis(playlist), {
      initialProps: { playlist: playlistA },
    });
    act(() => { result.current.setDataOffset(5); });
    expect(result.current.dataOffset).toBe(5);

    rerender({ playlist: playlistB });

    expect(result.current.dataOffset).toBe(0);
    expect(result.current.selectedAnalysisDate).toBe('2026-08-09');
  });

  it('un rerender avec le MÊME id de playlist ne réinitialise PAS dataOffset (dépendance sur currentPlaylist?.id uniquement)', () => {
    const playlist = { id: 'pl-a', actualDataByDate: {} };
    const { result, rerender } = renderHook(({ playlist }) => useSessionAnalysis(playlist), {
      initialProps: { playlist },
    });
    act(() => { result.current.setDataOffset(3); });

    // Nouvel objet, MÊME id — l'effet ne doit pas se redéclencher.
    rerender({ playlist: { ...playlist } });

    expect(result.current.dataOffset).toBe(3);
  });
});

describe('useSessionAnalysis — availableMetrics et bascule automatique de selectedMetric', () => {
  it('détecte cadence ET fréquence cardiaque indépendamment quand les deux sont présentes', () => {
    const playlist = {
      id: 'pl-1',
      actualDataByDate: { '2026-08-01': [{ cadenceReelle: 88, heartRate: 150 }] },
    };
    const { result } = renderHook(() => useSessionAnalysis(playlist));
    expect(result.current.availableMetrics).toEqual({ cadence: true, heartRate: true });
  });

  it('métrique sélectionnée absente pour cette séance mais l\'autre dispo : bascule automatiquement dessus', () => {
    // selectedMetric par défaut = 'cadence', mais seule heartRate est
    // présente dans ce CSV — ne doit jamais rester figé sur un graphique
    // vide.
    const playlist = {
      id: 'pl-1',
      actualDataByDate: { '2026-08-01': [{ heartRate: 150 }] },
    };
    const { result } = renderHook(() => useSessionAnalysis(playlist));
    expect(result.current.selectedMetric).toBe('heartRate');
  });

  it('les deux métriques dispo : ne force PAS de bascule, respecte le choix explicite de l\'utilisateur', () => {
    const playlist = {
      id: 'pl-1',
      actualDataByDate: { '2026-08-01': [{ cadenceReelle: 88, heartRate: 150 }] },
    };
    const { result } = renderHook(() => useSessionAnalysis(playlist));
    act(() => { result.current.setSelectedMetric('heartRate'); });
    expect(result.current.selectedMetric).toBe('heartRate');
  });

  it('aucune donnée réelle pour la séance (currentActualData null) : ne touche pas selectedMetric', () => {
    const { result } = renderHook(() => useSessionAnalysis({ id: 'pl-1' }));
    expect(result.current.selectedMetric).toBe('cadence');
  });
});

describe('useSessionAnalysis — csvUploadTargetDate (état simple, pas de logique dérivée)', () => {
  it('setCsvUploadTargetDate met à jour la valeur normalement', () => {
    const { result } = renderHook(() => useSessionAnalysis({ id: 'pl-1' }));
    expect(result.current.csvUploadTargetDate).toBeNull();
    act(() => { result.current.setCsvUploadTargetDate('2026-08-01'); });
    expect(result.current.csvUploadTargetDate).toBe('2026-08-01');
  });
});
