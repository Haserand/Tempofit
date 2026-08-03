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

  // ⚠️ RENOMMÉ le 02/08 (compteur de clonages HONNÊTE pour les templates) —
  // ce fixture ne pose pas `sourceTemplateId`, donc n'appelle toujours pas
  // la RPC playlist — mais un VRAI template de la vitrine EN A un
  // (`openCuratedPlaylist`, useNavigation.js), et appelle DÉSORMAIS
  // `increment_template_clone_count` à la place (voir le test suivant).
  // Ce test-ci couvre le cas où NI `user_id` NI `sourceTemplateId` ne sont
  // présents — un cas limite, pas le cas réel de la vitrine.
  it('sans user_id NI sourceTemplateId, n\'appelle aucune RPC — rien à cibler', () => {
    const orphanPlaylist = { id: 'pl-orphan', name: 'Sans origine identifiable', isReadOnly: true };
    const result = renderLibrary(orphanPlaylist);

    result.current.handleClonePlaylist();

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('un VRAI template de la vitrine (sourceTemplateId, sans user_id) appelle increment_template_clone_count — compteur honnête, pas increment_playlist_clone_count', () => {
    mockRpc.mockResolvedValue({ error: null });
    const vitrineTemplate = { id: 'pl-curated-tpl-cardio-123-456', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express', isReadOnly: true };
    const result = renderLibrary(vitrineTemplate);

    result.current.handleClonePlaylist();

    expect(mockRpc).toHaveBeenCalledWith('increment_template_clone_count', { target_template_id: 'tpl-cardio' });
    expect(mockRpc).not.toHaveBeenCalledWith('increment_playlist_clone_count', expect.anything());
  });

  // Traçabilité de lignée (02/08, retour direct : "si A clone B, puis C
  // clone la copie d'A, ça doit compter pour B, pas pour A").
  describe('chaîne de clonage (originId/originUserId)', () => {
    it('un 1er clonage (jamais cloné avant) pose originId/originUserId = SOI-MÊME sur la copie', () => {
      const setSavedPlaylists = vi.fn();
      const foreignPlaylist = { id: 'pl-A-original', user_id: 'user-A', name: 'Playlist de A', isReadOnly: true };
      const result = renderLibrary(foreignPlaylist, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.originId).toBe('pl-A-original');
      expect(cloned.originUserId).toBe('user-A');
    });

    // Anti-abus "toggle spam" + "Clone" vs "Enfant" (02/08) — une copie
    // FRAÎCHE démarre toujours "jamais republiée, jamais modifiée", même
    // si l'objet source (`currentPlaylist`) portait déjà ces champs à
    // `true` (un parent republié/modifié ne doit jamais "contaminer" sa
    // descendance — chaque copie a sa PROPRE vie).
    it('une copie fraîche démarre toujours avec isModifiedSinceClone=false et originCreditClaimed=false, même si le parent les avait à true', () => {
      const setSavedPlaylists = vi.fn();
      const alreadyModifiedParent = {
        id: 'pl-B-copy', user_id: 'user-B', name: 'Copie déjà modifiée de B',
        isReadOnly: true, isModifiedSinceClone: true, originCreditClaimed: true,
      };
      const result = renderLibrary(alreadyModifiedParent, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.isModifiedSinceClone).toBe(false);
      expect(cloned.originCreditClaimed).toBe(false);
    });

    it('B clonant la playlist de A (jamais clonée avant) : un SEUL incrément réel (origine = maillon immédiat, jamais compté 2 fois)', () => {
      mockRpc.mockResolvedValue({ error: null });
      const playlistOfA = { id: 'pl-A-original', user_id: 'user-A', name: 'Playlist de A', isReadOnly: true };
      const result = renderLibrary(playlistOfA);

      result.current.handleClonePlaylist();

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('increment_playlist_clone_count', {
        target_id: 'pl-A-original',
        target_user_id: 'user-A',
      });
    });

    // Retour direct (02/08) : "si A fait une playlist, B la clone, et C
    // clone la copie de B, ça doit augmenter le compteur de A ET de B" —
    // scénario exact : `copyOfB` est la copie que B a obtenue en clonant
    // A (donc `user_id: 'user-B'`, `originId`/`originUserId` pointant
    // vers A) ; C clone MAINTENANT cette copie.
    it('C clonant la copie de B (elle-même clonée de A) incrémente A ET B — 2 appels distincts', () => {
      mockRpc.mockResolvedValue({ error: null });
      const copyOfB = {
        id: 'pl-B-copy', user_id: 'user-B', originId: 'pl-A-original', originUserId: 'user-A',
        name: 'Copie de B (elle-même clonée de A)', isReadOnly: true,
      };
      const result = renderLibrary(copyOfB);

      result.current.handleClonePlaylist();

      expect(mockRpc).toHaveBeenCalledTimes(2);
      // Maillon immédiat : B vient de se faire cloner par C.
      expect(mockRpc).toHaveBeenCalledWith('increment_playlist_clone_count', {
        target_id: 'pl-B-copy',
        target_user_id: 'user-B',
      });
      // Origine : le contenu d'A vient d'être réutilisé une fois de plus.
      expect(mockRpc).toHaveBeenCalledWith('increment_playlist_clone_count', {
        target_id: 'pl-A-original',
        target_user_id: 'user-A',
      });
    });

    it('la copie de C hérite de la MÊME origine (A) que la copie de B — la chaîne ne s\'arrête jamais à un maillon intermédiaire', () => {
      const setSavedPlaylists = vi.fn();
      const copyOfB = {
        id: 'pl-B-copy', user_id: 'user-B', originId: 'pl-A-original', originUserId: 'user-A',
        name: 'Copie de B', isReadOnly: true,
      };
      const result = renderLibrary(copyOfB, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const clonedByC = setSavedPlaylists.mock.calls[0][0][0];
      expect(clonedByC.originId).toBe('pl-A-original');
      expect(clonedByC.originUserId).toBe('user-A');
    });
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
