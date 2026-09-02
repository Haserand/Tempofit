// @vitest-environment jsdom
//
// Premier fichier de test pour ShareImageContext.jsx — jusqu'ici jamais
// testé directement (couvert seulement indirectement via les tests des
// composants qui le consomment : ShareModal.test.jsx, StatsView.test.jsx,
// TrophiesView.test.jsx...). Ajouté le 01/09 en même temps que
// `summaryImageContextKey`, la nouvelle valeur introduite par le chantier
// "visuel de trophée partageable" (voir sa docstring dans
// ShareImageContext.jsx pour le raisonnement complet — CE fichier teste
// que le mécanisme lui-même fonctionne, PAS le scénario métier qui l'a
// rendu nécessaire, déjà couvert par PlaylistDetailView.test.jsx/
// TrophiesView.test.jsx).
//
// Même modèle que ModalContext.test.jsx (le seul autre Contexte "pur
// état", sans logique métier interne) : une sonde minimale qui capture la
// `value` à chaque rendu.

import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { ShareImageProvider, useShareImage } from '../../src/contexts/ShareImageContext.jsx';

afterEach(() => {
  cleanup();
});

const captured = [];
function Probe() {
  captured.push(useShareImage());
  return null;
}

describe('ShareImageContext — repli hors Provider', () => {
  it('useShareImage() hors Provider renvoie des valeurs neutres, pas un plantage', () => {
    captured.length = 0;
    render(<Probe />);
    const val = captured[0];
    expect(val.summaryImageStatus).toBe('idle');
    expect(val.summaryImageFile).toBeNull();
    expect(val.summaryImagePreviewUrl).toBeNull();
    expect(val.includeSummaryImage).toBe(true);
    expect(val.summaryImageContextKey).toBeNull();
    // Les 5 setters restent des fonctions no-op appelables sans erreur —
    // même garde-fou que ModalContext.jsx/AudioPlayerContext.jsx pour un
    // composant monté par erreur (ou dans un test isolé) hors Provider.
    expect(typeof val.setSummaryImageStatus).toBe('function');
    expect(typeof val.setSummaryImageFile).toBe('function');
    expect(typeof val.setSummaryImagePreviewUrl).toBe('function');
    expect(typeof val.setIncludeSummaryImage).toBe('function');
    expect(typeof val.setSummaryImageContextKey).toBe('function');
    expect(() => val.setSummaryImageStatus('loading')).not.toThrow();
  });
});

describe('ShareImageContext — état initial dans le Provider', () => {
  it('valeurs par défaut identiques au repli (idle/null/null/true/null)', () => {
    captured.length = 0;
    render(<ShareImageProvider><Probe /></ShareImageProvider>);
    const val = captured[captured.length - 1];
    expect(val.summaryImageStatus).toBe('idle');
    expect(val.summaryImageFile).toBeNull();
    expect(val.summaryImagePreviewUrl).toBeNull();
    expect(val.includeSummaryImage).toBe(true);
    expect(val.summaryImageContextKey).toBeNull();
  });
});

describe('ShareImageContext — chaque setter met bien à jour sa propre valeur', () => {
  it('setSummaryImageStatus', () => {
    captured.length = 0;
    render(<ShareImageProvider><Probe /></ShareImageProvider>);
    act(() => { captured[captured.length - 1].setSummaryImageStatus('loading'); });
    expect(captured[captured.length - 1].summaryImageStatus).toBe('loading');
  });

  it('setSummaryImageFile', () => {
    captured.length = 0;
    render(<ShareImageProvider><Probe /></ShareImageProvider>);
    const file = new File(['x'], 'bilan.png');
    act(() => { captured[captured.length - 1].setSummaryImageFile(file); });
    expect(captured[captured.length - 1].summaryImageFile).toBe(file);
  });

  it('setSummaryImagePreviewUrl — accepte aussi un updater fonctionnel (utilisé pour révoquer l\'URL précédente)', () => {
    captured.length = 0;
    render(<ShareImageProvider><Probe /></ShareImageProvider>);
    act(() => { captured[captured.length - 1].setSummaryImagePreviewUrl('blob:a'); });
    expect(captured[captured.length - 1].summaryImagePreviewUrl).toBe('blob:a');
    act(() => { captured[captured.length - 1].setSummaryImagePreviewUrl(prev => prev + '-suite'); });
    expect(captured[captured.length - 1].summaryImagePreviewUrl).toBe('blob:a-suite');
  });

  it('setIncludeSummaryImage', () => {
    captured.length = 0;
    render(<ShareImageProvider><Probe /></ShareImageProvider>);
    act(() => { captured[captured.length - 1].setIncludeSummaryImage(false); });
    expect(captured[captured.length - 1].includeSummaryImage).toBe(false);
  });

  it('setSummaryImageContextKey — distingue bien "playlist:{id}" de "trophy:{id}" (voir la docstring du fichier pour le scénario réel évité)', () => {
    captured.length = 0;
    render(<ShareImageProvider><Probe /></ShareImageProvider>);
    act(() => { captured[captured.length - 1].setSummaryImageContextKey('playlist:abc123'); });
    expect(captured[captured.length - 1].summaryImageContextKey).toBe('playlist:abc123');
    act(() => { captured[captured.length - 1].setSummaryImageContextKey('trophy:t_first'); });
    expect(captured[captured.length - 1].summaryImageContextKey).toBe('trophy:t_first');
  });
});
