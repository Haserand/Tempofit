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

  // Traçabilité de lignée — REFONTE (03/08, voir supabase-schema.sql) :
  // le client ne calcule/porte plus la chaîne entière (`originId`/
  // `originUserId`, retirés) — il pose seulement `parentId`/`parentUserId`
  // (le maillon IMMÉDIAT, trivialement correct — `currentPlaylist.id`/
  // `.user_id` lus directement) et fait TOUJOURS UN SEUL appel RPC. La
  // résolution de l'origine réelle de la chaîne (`resolve_playlist_origin`,
  // marche récursive) vit désormais côté Postgres — hors de portée d'un
  // test unitaire ici (aucun vrai Postgres dans ce bac à sable), c'est
  // précisément ce que la vérification en conditions réelles doit couvrir.
  describe('chaîne de clonage (parentId/parentUserId)', () => {
    it('pose parentId/parentUserId = le maillon qu\'on vient de cloner, jamais une valeur dérivée', () => {
      const setSavedPlaylists = vi.fn();
      const foreignPlaylist = { id: 'pl-A-original', user_id: 'user-A', name: 'Playlist de A', isReadOnly: true };
      const result = renderLibrary(foreignPlaylist, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.parentId).toBe('pl-A-original');
      expect(cloned.parentUserId).toBe('user-A');
    });

    // "Clone" vs "Enfant" (02/08) — une copie FRAÎCHE démarre toujours
    // "jamais modifiée", même si l'objet source (`currentPlaylist`)
    // portait déjà `isModifiedSinceClone: true` (un parent modifié ne doit
    // jamais "contaminer" sa descendance — chaque copie a sa PROPRE vie).
    it('une copie fraîche démarre toujours avec isModifiedSinceClone=false, même si le parent l\'avait à true', () => {
      const setSavedPlaylists = vi.fn();
      const alreadyModifiedParent = {
        id: 'pl-B-copy', user_id: 'user-B', name: 'Copie déjà modifiée de B',
        isReadOnly: true, isModifiedSinceClone: true,
      };
      const result = renderLibrary(alreadyModifiedParent, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.isModifiedSinceClone).toBe(false);
    });

    // Retour direct (02/08) : "si A fait une playlist, B la clone, et C
    // clone la copie de B, ça doit augmenter le compteur de A ET de B" —
    // avec la refonte, C ne fait plus qu'UN SEUL appel (ciblant B, le
    // maillon immédiat) — c'est `increment_playlist_clone_count`
    // elle-même, côté serveur, qui remonte ensuite jusqu'à A via
    // `resolve_playlist_origin` et la crédite aussi, en interne.
    it('C clonant la copie de B (elle-même clonée de A) ne fait qu\'UN appel RPC, ciblant B — la résolution de A est désormais interne à la fonction SQL', () => {
      mockRpc.mockResolvedValue({ error: null });
      const copyOfB = {
        id: 'pl-B-copy', user_id: 'user-B', parentId: 'pl-A-original', parentUserId: 'user-A',
        name: 'Copie de B (elle-même clonée de A)', isReadOnly: true,
      };
      const result = renderLibrary(copyOfB);

      result.current.handleClonePlaylist();

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('increment_playlist_clone_count', {
        target_id: 'pl-B-copy',
        target_user_id: 'user-B',
      });
    });

    it('la copie de C ne porte que son parent DIRECT (B), jamais la racine (A) — plus rien à propager plus loin que le maillon immédiat', () => {
      const setSavedPlaylists = vi.fn();
      const copyOfB = {
        id: 'pl-B-copy', user_id: 'user-B', parentId: 'pl-A-original', parentUserId: 'user-A',
        name: 'Copie de B', isReadOnly: true,
      };
      const result = renderLibrary(copyOfB, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const clonedByC = setSavedPlaylists.mock.calls[0][0][0];
      expect(clonedByC.parentId).toBe('pl-B-copy');
      expect(clonedByC.parentUserId).toBe('user-B');
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

  // NOUVEAU (05/08, retour direct : "je vais dans Découvrir, j'ajoute une
  // playlist, j'y retourne, je l'ajoute une 2e fois → je me retrouve avec
  // 2 copies identiques") — voir la docstring de `handleClonePlaylist` pour
  // le raisonnement complet. Couvre les 2 branches (playlist étrangère
  // réelle / template de la vitrine), symétrique aux tests
  // `handleSavePlaylist` plus bas pour le cas "template ouvert directement
  // depuis Découvrir".
  describe('détection de copie déjà existante (NOUVEAU, 05/08)', () => {
    it('playlist étrangère RÉELLE déjà clonée (parentId/parentUserId matchent) : bascule dessus, ne clone PAS une 2e fois', () => {
      const setSavedPlaylists = vi.fn();
      const setCurrentPlaylist = vi.fn();
      const showToast = vi.fn();
      const existingClone = { id: 'pl-my-copy', parentId: 'pl-original', parentUserId: 'owner-uuid-123', name: 'Ma copie' };
      const foreignPlaylist = { id: 'pl-original', user_id: 'owner-uuid-123', name: 'Sortie running', isReadOnly: true };
      const result = renderLibrary(foreignPlaylist, { savedPlaylists: [existingClone], setSavedPlaylists, setCurrentPlaylist, showToast });

      result.current.handleClonePlaylist();

      expect(setSavedPlaylists).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      expect(setCurrentPlaylist).toHaveBeenCalledWith(existingClone);
      expect(showToast).toHaveBeenCalledWith('Déjà dans Mes Séances — retour sur ta copie.');
    });

    it('template de la vitrine déjà cloné (sourceTemplateId matche) : bascule dessus, ne clone PAS une 2e fois', () => {
      const setSavedPlaylists = vi.fn();
      const setCurrentPlaylist = vi.fn();
      const existingClone = { id: 'pl-my-copy', sourceTemplateId: 'tpl-cardio', name: 'Ma copie de Cardio Express' };
      const vitrineTemplate = { id: 'pl-curated-tpl-cardio-123-999', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express', isReadOnly: true };
      const result = renderLibrary(vitrineTemplate, { savedPlaylists: [existingClone], setSavedPlaylists, setCurrentPlaylist });

      result.current.handleClonePlaylist();

      expect(setSavedPlaylists).not.toHaveBeenCalled();
      expect(setCurrentPlaylist).toHaveBeenCalledWith(existingClone);
    });

    it('une playlist étrangère jamais clonée avant : clone normalement (pas de faux positif)', () => {
      const setSavedPlaylists = vi.fn();
      const otherPersonUnrelatedCopy = { id: 'pl-unrelated', parentId: 'pl-SOMETHING-ELSE', parentUserId: 'owner-uuid-123', name: 'Sans rapport' };
      const foreignPlaylist = { id: 'pl-original', user_id: 'owner-uuid-123', name: 'Sortie running', isReadOnly: true };
      const result = renderLibrary(foreignPlaylist, { savedPlaylists: [otherPersonUnrelatedCopy], setSavedPlaylists });

      result.current.handleClonePlaylist();

      expect(setSavedPlaylists).toHaveBeenCalledTimes(1);
    });
  });
});

describe('usePlaylistLibrary — handleSavePlaylist', () => {
  it('sauvegarde normalement une playlist fraîchement générée (pas de sourceTemplateId)', () => {
    const setSavedPlaylists = vi.fn();
    const setCurrentPlaylist = vi.fn();
    const freshGeneration = { id: 'pl-fresh-123', name: 'Ma séance' };
    const result = renderLibrary(freshGeneration, { setSavedPlaylists, setCurrentPlaylist });

    result.current.handleSavePlaylist();

    expect(setSavedPlaylists).toHaveBeenCalledTimes(1);
    expect(setSavedPlaylists.mock.calls[0][0][0]).toMatchObject({ id: 'pl-fresh-123', status: 'pending' });
  });

  // NOUVEAU (05/08, retour direct — voir sa docstring dans
  // usePlaylistLibrary.js pour le raisonnement complet) : un template
  // ouvert DIRECTEMENT depuis Découvrir obtient un id FRAIS
  // (`pl-curated-{template.id}-${Date.now()}`) à CHAQUE ouverture — le
  // garde `id` seul ne suffit donc jamais à détecter "déjà ajouté" pour ce
  // cas précis, contrairement à une playlist déjà présente telle quelle.
  it('template déjà ajouté (sourceTemplateId matche un id DIFFÉRENT de la prévisualisation) : bascule dessus, ne duplique PAS', () => {
    const setSavedPlaylists = vi.fn();
    const setCurrentPlaylist = vi.fn();
    const showToast = vi.fn();
    const existingClone = { id: 'pl-curated-tpl-cardio-111', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express' };
    // 2e ouverture du MÊME template depuis Découvrir : id frais différent,
    // même sourceTemplateId — exactement le scénario du retour direct.
    const reopenedPreview = { id: 'pl-curated-tpl-cardio-222', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express' };
    const result = renderLibrary(reopenedPreview, { savedPlaylists: [existingClone], setSavedPlaylists, setCurrentPlaylist, showToast });

    result.current.handleSavePlaylist();

    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(setCurrentPlaylist).toHaveBeenCalledWith(existingClone);
    expect(showToast).toHaveBeenCalledWith('Déjà dans Mes Séances — retour sur ta copie.');
  });

  it('2 templates DIFFÉRENTS (sourceTemplateId distincts) ne se confondent jamais', () => {
    const setSavedPlaylists = vi.fn();
    const existingClone = { id: 'pl-curated-tpl-cardio-111', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express' };
    const differentTemplate = { id: 'pl-curated-tpl-endurance-222', sourceTemplateId: 'tpl-endurance', name: 'Endurance Longue' };
    const result = renderLibrary(differentTemplate, { savedPlaylists: [existingClone], setSavedPlaylists });

    result.current.handleSavePlaylist();

    expect(setSavedPlaylists).toHaveBeenCalledTimes(1);
  });

  it('sans currentPlaylist, ne fait rien', () => {
    const setSavedPlaylists = vi.fn();
    const result = renderLibrary(null, { setSavedPlaylists });

    result.current.handleSavePlaylist();

    expect(setSavedPlaylists).not.toHaveBeenCalled();
  });
});
