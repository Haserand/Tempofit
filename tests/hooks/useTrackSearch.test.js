// @vitest-environment jsdom
//
// Test dédié à useTrackSearch.js — 0 test jusqu'ici (check-up du 13/08).
// Volontairement scopé : ce hook ne contient QUE de l'état (voir sa
// docstring), pas de logique — la logique elle-même (searchWorldMusicApi,
// closeSearchModal...) vit dans useDeezerSearch.js/App.jsx et est testée
// séparément. Ici : valeurs par défaut correctes + chaque setter fonctionne.

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrackSearch, SEARCH_LOADING_MESSAGES } from '../../src/hooks/useTrackSearch.js';

describe('useTrackSearch — valeurs par défaut', () => {
  it('initialise tous les champs à leur valeur de repos attendue', () => {
    const { result } = renderHook(() => useTrackSearch());
    expect(result.current.searchQuery).toBe('');
    expect(result.current.isWorldSearching).toBe(false);
    expect(result.current.worldSearchResults).toEqual([]);
    expect(result.current.resultsContextLabel).toBeNull();
    expect(result.current.noUsableResultsHint).toBe(false);
    expect(result.current.isBpmSearchMode).toBe(false);
    expect(result.current.searchResultsOffset).toBe(0);
    expect(result.current.searchHasMoreResults).toBe(false);
    expect(result.current.isLoadingMoreResults).toBe(false);
    expect(result.current.searchActiveArtistName).toBeNull();
    expect(result.current.editingBpmId).toBeNull();
    expect(result.current.searchLoadingMessage).toBe(SEARCH_LOADING_MESSAGES[0]);
    expect(result.current.worldSearchOtherResults).toEqual([]);
    expect(result.current.bpmSearchParams).toEqual({ bpm: 140, tolerance: 10, genres: [] });
  });
});

describe('useTrackSearch — chaque setter met bien à jour son propre champ, sans toucher aux autres', () => {
  it('setSearchQuery', () => {
    const { result } = renderHook(() => useTrackSearch());
    act(() => { result.current.setSearchQuery('Daft Punk'); });
    expect(result.current.searchQuery).toBe('Daft Punk');
  });

  it('setWorldSearchResults accepte aussi bien une valeur directe qu\'un updater fonctionnel', () => {
    const { result } = renderHook(() => useTrackSearch());
    act(() => { result.current.setWorldSearchResults([{ id: 'a' }]); });
    expect(result.current.worldSearchResults).toEqual([{ id: 'a' }]);

    act(() => { result.current.setWorldSearchResults(prev => [...prev, { id: 'b' }]); });
    expect(result.current.worldSearchResults).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('setBpmSearchParams remplace l\'objet entier (pas de fusion automatique)', () => {
    const { result } = renderHook(() => useTrackSearch());
    act(() => { result.current.setBpmSearchParams({ bpm: 160, tolerance: 5, genres: ['Rock'] }); });
    expect(result.current.bpmSearchParams).toEqual({ bpm: 160, tolerance: 5, genres: ['Rock'] });
  });

  it('setIsWorldSearching/setIsBpmSearchMode/setSearchHasMoreResults/setIsLoadingMoreResults sont indépendants les uns des autres', () => {
    const { result } = renderHook(() => useTrackSearch());
    act(() => {
      result.current.setIsWorldSearching(true);
      result.current.setIsBpmSearchMode(true);
    });
    expect(result.current.isWorldSearching).toBe(true);
    expect(result.current.isBpmSearchMode).toBe(true);
    expect(result.current.searchHasMoreResults).toBe(false);
    expect(result.current.isLoadingMoreResults).toBe(false);
  });
});

describe('SEARCH_LOADING_MESSAGES — export partagé avec useDeezerSearch.js/App.jsx', () => {
  it('contient au moins un message, tous non vides', () => {
    expect(SEARCH_LOADING_MESSAGES.length).toBeGreaterThan(0);
    SEARCH_LOADING_MESSAGES.forEach(msg => expect(msg.length).toBeGreaterThan(0));
  });
});
