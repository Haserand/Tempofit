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

    // BUG CORRIGÉ (07/08, check-up) — voir la docstring de `cloned` dans
    // usePlaylistLibrary.js pour le raisonnement complet. `currentPlaylist`
    // porte ici les champs D'AFFICHAGE posés par `handleOpenPublicPlaylist`
    // (App.jsx) pour la playlist ÉTRANGÈRE consultée : `user_id` (le
    // PROPRIÉTAIRE D'ORIGINE), `ownerUsername`. Avant ce correctif, le
    // spread `...currentPlaylist` les reportait tels quels sur la copie —
    // désormais possédée par l'utilisateur, qui se retrouvait avec l'UUID/
    // le pseudo de quelqu'un d'autre dans son propre `content`,
    // synchronisé tel quel vers Supabase.
    //
    // ⚠️ `cloneCount` RETIRÉ DE CE TEST (10/08, retour direct avec 4
    // captures d'écran — "quand je l'ajoute à Mes Séances il n'y a plus le
    // compteur de clones ?") : contrairement à `user_id`/`ownerUsername`
    // (identifiants de PROPRIÉTÉ, un vrai risque de logique à les garder),
    // `cloneCount` est un simple chiffre d'affichage — le réinitialiser ne
    // protégeait rien, ça faisait juste disparaître le badge sur la copie
    // fraîchement créée. Voir le test dédié juste en dessous.
    it('la copie clonée ne garde JAMAIS le user_id/ownerUsername du propriétaire d\'origine (BUG CORRIGÉ 07/08)', () => {
      const setSavedPlaylists = vi.fn();
      const foreignPlaylist = {
        id: 'pl-A-original', user_id: 'user-A', name: 'Playlist de A',
        isReadOnly: true, ownerUsername: 'pseudo_de_a', cloneCount: 42,
      };
      const result = renderLibrary(foreignPlaylist, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.user_id).toBeUndefined();
      expect(cloned.ownerUsername).toBeUndefined();
      // Le lien de lignée, lui, reste bien posé — seuls les champs
      // D'AFFICHAGE de l'ancien propriétaire sont retirés, pas la
      // traçabilité réelle (`parentId`/`parentUserId`, colonnes dédiées).
      expect(cloned.parentId).toBe('pl-A-original');
      expect(cloned.parentUserId).toBe('user-A');
    });

    // NOUVEAU (10/08, régression — même retour direct que ci-dessus) —
    // `cloneCount`, LUI, doit survivre au clonage, contrairement à
    // `user_id`/`ownerUsername` juste au-dessus : c'est un simple chiffre
    // d'affichage (voir PlaylistHeaderBadges.jsx, gaté sur
    // `cloneCount !== undefined`), pas un identifiant de propriété — le
    // réinitialiser faisait juste disparaître le badge sur la copie
    // fraîchement créée, sans protéger quoi que ce soit.
    it('la copie clonée GARDE cloneCount (badge de clonages) — régression 10/08, contrairement à user_id/ownerUsername ci-dessus', () => {
      const setSavedPlaylists = vi.fn();
      const foreignPlaylist = {
        id: 'pl-A-original', user_id: 'user-A', name: 'Playlist de A',
        isReadOnly: true, ownerUsername: 'pseudo_de_a', cloneCount: 42,
      };
      const result = renderLibrary(foreignPlaylist, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.cloneCount).toBe(42);
    });

    it('la copie clonée : cloneCount jamais défini (undefined) sur l\'original se propage tel quel — pas de faux 0 inventé', () => {
      const setSavedPlaylists = vi.fn();
      const foreignPlaylist = {
        id: 'pl-A-original', user_id: 'user-A', name: 'Playlist de A',
        isReadOnly: true, ownerUsername: 'pseudo_de_a', cloneCount: undefined,
      };
      const result = renderLibrary(foreignPlaylist, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.cloneCount).toBeUndefined();
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

  // NOUVEAU (14/08, retour direct avec capture — "pourquoi je vois quand
  // même le compteur à 0 pour la playlist que j'ai pourtant clonée ?") :
  // jusqu'ici, seul `handleClonePlaylist` (le bouton "Sauvegarder" d'un
  // template ouvert depuis la vitrine `@tempofit_officiel`) incrémentait
  // `template_clone_counts` — jamais CE chemin-ci ("Ajouter" depuis
  // Découvrir, de très loin le plus emprunté). Voir la docstring de
  // `handleSavePlaylist` dans usePlaylistLibrary.js pour le raisonnement
  // complet du changement.
  describe('compteur de clonages de template (NOUVEAU, 14/08)', () => {
    it('un template ouvert depuis Découvrir (sourceTemplateId) appelle increment_template_clone_count', () => {
      mockRpc.mockResolvedValue({ error: null });
      const discoverTemplate = { id: 'pl-curated-tpl-cardio-123', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express' };
      const result = renderLibrary(discoverTemplate, { setSavedPlaylists: vi.fn(), setCurrentPlaylist: vi.fn() });

      result.current.handleSavePlaylist();

      expect(mockRpc).toHaveBeenCalledWith('increment_template_clone_count', { target_template_id: 'tpl-cardio' });
    });

    it('une playlist fraîchement générée par le wizard (pas de sourceTemplateId) n\'appelle AUCUNE RPC — jamais comptée à tort comme un clonage de template', () => {
      const freshGeneration = { id: 'pl-fresh-123', name: 'Ma séance' };
      const result = renderLibrary(freshGeneration, { setSavedPlaylists: vi.fn(), setCurrentPlaylist: vi.fn() });

      result.current.handleSavePlaylist();

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('template déjà ajouté (bascule sur la copie existante) : ne recompte PAS un 2e clonage', () => {
      const existingClone = { id: 'pl-curated-tpl-cardio-111', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express' };
      const reopenedPreview = { id: 'pl-curated-tpl-cardio-222', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express' };
      const result = renderLibrary(reopenedPreview, { savedPlaylists: [existingClone], setSavedPlaylists: vi.fn(), setCurrentPlaylist: vi.fn() });

      result.current.handleSavePlaylist();

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('échec réseau de la RPC : échec silencieux (journalisé), la sauvegarde locale reste pleinement effective', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRpc.mockResolvedValue({ error: { message: 'boom' } });
      const setSavedPlaylists = vi.fn();
      const discoverTemplate = { id: 'pl-curated-tpl-cardio-123', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express' };
      const result = renderLibrary(discoverTemplate, { setSavedPlaylists, setCurrentPlaylist: vi.fn() });

      expect(() => result.current.handleSavePlaylist()).not.toThrow();

      expect(setSavedPlaylists).toHaveBeenCalledTimes(1); // la sauvegarde locale a bien eu lieu, indépendamment de la RPC
      consoleSpy.mockRestore();
    });
  });
});

// NOUVEAU (check-up 10/08, retour direct — captures à l'appui : "je supprime
// de Mes Séances, je ne vois plus le compteur de clonages, on devrait revoir
// le précédent pourtant ?") — `removeSavedPlaylist` n'avait aucun test avant
// ce chantier. Ciblé sur le correctif : `openCuratedPlaylist` doit être
// appelée avec `{ isReadOnly: true, isPublic: true, cloneCount }` au moment
// de restaurer le template pristine, comme les 2 AUTRES appelants du projet
// (App.jsx/TemplateCard.jsx) — pas une couverture exhaustive de
// removeSavedPlaylist par ailleurs (garde-fou historique/PENDING_UNSAVE déjà
// couvert indirectement via requestRemoveSavedPlaylist ailleurs).
describe('usePlaylistLibrary — removeSavedPlaylist (restauration du template pristine)', () => {
  it('restaure le template avec isReadOnly/isPublic/cloneCount (régression 10/08 — badge de clonages disparaissait)', () => {
    const openCuratedPlaylist = vi.fn();
    // Même template que les captures d'écran du retour direct ("Midnight
    // Runner 160") — un VRAI id de data/curatedSessions.js, pas un fixture
    // inventé, pour que `catalog.find(...)` matche réellement.
    const savedCopy = {
      id: 'pl-curated-tpl-midnight-runner-160-1723200000000',
      sourceTemplateId: 'tpl-midnight-runner-160',
      name: 'Midnight Runner 160',
      cloneCount: 7, // hérité de l'ouverture initiale depuis Découvrir
      isNaughty: false,
    };
    const result = renderLibrary(savedCopy, { savedPlaylists: [savedCopy], openCuratedPlaylist });

    result.current.removeSavedPlaylist(savedCopy.id);

    expect(openCuratedPlaylist).toHaveBeenCalledTimes(1);
    const [calledTemplate, calledExtraFields] = openCuratedPlaylist.mock.calls[0];
    expect(calledTemplate.id).toBe('tpl-midnight-runner-160');
    expect(calledExtraFields).toEqual({ isReadOnly: true, isPublic: true, cloneCount: 7 });
  });

  it('cloneCount undefined sur la copie retirée (jamais posé) se propage tel quel — pas de faux 0 inventé', () => {
    const openCuratedPlaylist = vi.fn();
    const savedCopy = {
      id: 'pl-curated-tpl-midnight-runner-160-1723200000000',
      sourceTemplateId: 'tpl-midnight-runner-160',
      name: 'Midnight Runner 160',
      isNaughty: false,
      // Pas de cloneCount — cas d'une playlist sauvegardée AVANT ce
      // correctif (pas de migration rétroactive, voir CLAUDE-SANDBOX-
      // VERIFICATION.md, "tant qu'il n'y a pas d'utilisateurs réels").
    };
    const result = renderLibrary(savedCopy, { savedPlaylists: [savedCopy], openCuratedPlaylist });

    result.current.removeSavedPlaylist(savedCopy.id);

    const [, calledExtraFields] = openCuratedPlaylist.mock.calls[0];
    expect(calledExtraFields.cloneCount).toBeUndefined();
  });

  it('playlist SANS sourceTemplateId (générée/importée) : pas de restauration de template, openCuratedPlaylist jamais appelée', () => {
    const openCuratedPlaylist = vi.fn();
    const generatedPlaylist = { id: 'pl-generated-123', name: 'Ma séance générée' };
    const result = renderLibrary(generatedPlaylist, { savedPlaylists: [generatedPlaylist], openCuratedPlaylist });

    result.current.removeSavedPlaylist(generatedPlaylist.id);

    expect(openCuratedPlaylist).not.toHaveBeenCalled();
  });
});
