// @vitest-environment jsdom
//
// Premier fichier de test pour usePlaylistLibrary.js — jusqu'ici non testé
// directement (comme la plupart des hooks de ce projet, voir tests/hooks/).
// Volontairement SCOPÉ au compteur de clonages (chantier "compteur de
// sauvegardes/clonages", 02/08) — pas une couverture exhaustive de
// handleSavePlaylist/handleUnsavePlaylist/etc., qui restent non testées
// directement ici (déjà exercées indirectement via les tests de composants
// qui les consomment).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlaylistLibrary } from '../../src/hooks/usePlaylistLibrary.js';

const mockRpc = vi.fn();
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { rpc: (...args) => mockRpc(...args) },
}));

vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ openModal: vi.fn() }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function renderLibrary(currentPlaylist, overrides = {}) {
  const setCurrentPlaylist = overrides.setCurrentPlaylist || vi.fn();
  const setSavedPlaylists = overrides.setSavedPlaylists || vi.fn();
  const { result } = renderHook(() => usePlaylistLibrary(
    currentPlaylist,
    setCurrentPlaylist,
    overrides.savedPlaylists || [],
    setSavedPlaylists,
    overrides.showToast || vi.fn(),
    overrides.openCuratedPlaylist || vi.fn(),
    overrides.userStats || {},
    overrides.checkTrophies || vi.fn(),
    overrides.defaultPlaylistPublic || false,
  ));
  return result;
}

describe('usePlaylistLibrary — compteur de clonages (handleClonePlaylist)', () => {
  it('une playlist étrangère RÉELLE (avec user_id) appelle increment_playlist_clone_count avec le bon id ET le bon target_user_id', () => {
    mockRpc.mockResolvedValue({ error: null });
    const foreignPlaylist = { id: 'pl-original', user_id: 'owner-uuid-123', name: 'Sortie running', isReadOnly: true };
    const result = renderLibrary(foreignPlaylist);

    result.current.handleClonePlaylist();

    expect(mockRpc).toHaveBeenCalledWith('increment_playlist_clone_count', {
      target_id: 'pl-original',
      target_user_id: 'owner-uuid-123',
    });
  });

  it('un template de la vitrine (sans user_id) n\'appelle PAS la RPC — rien à incrémenter, aucun vrai propriétaire en base', () => {
    const vitrineTemplate = { id: 'curated-1', name: 'Cardio Express', isReadOnly: true }; // pas de user_id
    const result = renderLibrary(vitrineTemplate);

    result.current.handleClonePlaylist();

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('le clonage local reste effectif même si la RPC échoue (fire-and-forget, jamais bloquant)', () => {
    mockRpc.mockResolvedValue({ error: { message: 'boom' } });
    const setSavedPlaylists = vi.fn();
    const foreignPlaylist = { id: 'pl-original', user_id: 'owner-uuid-123', name: 'Sortie running', isReadOnly: true };
    const result = renderLibrary(foreignPlaylist, { setSavedPlaylists });

    result.current.handleClonePlaylist();

    // Le clonage local (setSavedPlaylists) a lieu de façon SYNCHRONE, avant
    // même la résolution de la promesse RPC — jamais conditionné à son
    // succès.
    expect(setSavedPlaylists).toHaveBeenCalledTimes(1);
    expect(setSavedPlaylists.mock.calls[0][0][0]).toMatchObject({ name: 'Sortie running', isPublic: false, isReadOnly: false });
  });

  it('sans currentPlaylist, ne fait rien (ni clonage local, ni appel RPC)', () => {
    const setSavedPlaylists = vi.fn();
    const result = renderLibrary(null, { setSavedPlaylists });

    result.current.handleClonePlaylist();

    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
