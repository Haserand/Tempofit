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
const mockFrom = vi.fn();
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { rpc: (...args) => mockRpc(...args), from: (...args) => mockFrom(...args) },
}));

// Chaîne `.select().eq().maybeSingle()` — imite le vrai query builder
// Supabase, même convention que StatsView.test.jsx/ProfileView.test.jsx
// pour ce genre de mock (voir `makeQueryBuilder` dans ces fichiers).
function makeSingleRowQueryBuilder(resolvedValue) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(resolvedValue)),
  };
  return builder;
}

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
    // ⚠️ `cloneCount` — RETOURNEMENT le 22/08 (voir les 2 tests juste en
    // dessous) : retiré du reset le 07/08, PUIS ce retrait généralisé à
    // tort le 10/08 (retour direct avec 4 captures — "quand je l'ajoute à
    // Mes Séances il n'y a plus le compteur de clones ?"), PUIS ce
    // généralisation elle-même corrigée le 22/08 (nouveau retour direct :
    // "la playlist que j'ai créée ne devrait pas avoir ce 1 tant qu'elle
    // n'a pas été clonée à son tour") — le raisonnement du 10/08
    // s'appliquait en réalité à `handleSavePlaylist` (même `id`, template
    // Découvrir, où `cloneCount` n'est quasiment jamais réellement
    // défini), pas à CE chemin-ci (`handleClonePlaylist`, nouvel `id`,
    // où `cloneCount` PEUT réellement porter la vraie valeur du parent
    // étranger qu'on vient de cloner). Voir usePlaylistLibrary.js pour le
    // détail complet.
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

    // ⚠️ RETOURNÉ (22/08, retour direct : "la playlist que j'ai créée ne
    // devrait pas avoir ce 1 tant qu'elle n'a pas été clonée à son
    // tour") — remplace le test "la copie clonée GARDE cloneCount" du
    // 10/08, qui vérifiait le comportement inverse. Une copie
    // FRAÎCHEMENT clonée n'a, par définition, encore jamais été clonée
    // par personne — porter le compteur du PARENT laissait croire le
    // contraire. `undefined` (pas `0`) : cohérent avec le garde-fou déjà
    // en place ailleurs (`PlaylistHeaderBadges.jsx`, badge gaté sur
    // `cloneCount !== undefined`) — aucun badge plutôt qu'un badge à 0.
    it('la copie clonée RÉINITIALISE cloneCount, quelle que soit la valeur du parent — régression 22/08', () => {
      const setSavedPlaylists = vi.fn();
      const foreignPlaylist = {
        id: 'pl-A-original', user_id: 'user-A', name: 'Playlist de A',
        isReadOnly: true, ownerUsername: 'pseudo_de_a', cloneCount: 42,
      };
      const result = renderLibrary(foreignPlaylist, { setSavedPlaylists });

      result.current.handleClonePlaylist();

      const cloned = setSavedPlaylists.mock.calls[0][0][0];
      expect(cloned.cloneCount).toBeUndefined();
    });

    it('la copie clonée : cloneCount jamais défini (undefined) sur l\'original reste undefined sur la copie — cas déjà couvert, comportement inchangé par le correctif du 22/08', () => {
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
      expect(showToast).toHaveBeenCalledWith('Déjà dans Mes Playlists — retour sur ta copie.');
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

  // ⚠️ NOUVEAU (22/08, retour direct SUIVANT le correctif équivalent sur
  // handleClonePlaylist — capture d'écran : "normalement avec ton
  // correctif le compteur devrait être à 0, pk je suis à 1 ?") : un
  // template ouvert depuis Découvrir transmet bien un `cloneCount` RÉEL
  // (`TemplateCard.jsx` → `onPlayTemplate(template, { cloneCount })`) —
  // l'hypothèse du 1er correctif ("quasiment jamais réellement défini sur
  // ce chemin") était fausse, ce cas avait été manqué. Voir
  // usePlaylistLibrary.js pour le détail complet.
  it('template Découvrir avec un vrai cloneCount transmis : réinitialisé sur la copie sauvegardée', () => {
    const setSavedPlaylists = vi.fn();
    const templateWithRealCount = { id: 'pl-curated-tpl-cardio-333', sourceTemplateId: 'tpl-cardio', name: 'Cardio Express', cloneCount: 1 };
    const result = renderLibrary(templateWithRealCount, { setSavedPlaylists });

    result.current.handleSavePlaylist();

    const saved = setSavedPlaylists.mock.calls[0][0][0];
    expect(saved.cloneCount).toBeUndefined();
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
    expect(showToast).toHaveBeenCalledWith('Déjà dans Mes Playlists — retour sur ta copie.');
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
//
// ⚠️ RÉÉCRITS (22/08, retour direct SUIVANT le correctif de
// handleSavePlaylist — captures à l'appui : "je supprime et reviens dans
// Découvrir, je ne vois plus le compteur") : l'ancienne version de ces 2
// tests vérifiait que `cloneCount` était reporté SYNCHRONE depuis
// `currentPlaylist.cloneCount` — plus vrai depuis que `handleSavePlaylist`
// pose explicitement `cloneCount: undefined` sur la copie sauvegardée (voir
// sa docstring) : cette source n'existe plus, `removeSavedPlaylist` fait
// désormais un VRAI fetch Supabase (`template_clone_counts`) après avoir
// restauré le template. Voir usePlaylistLibrary.js pour le détail complet.
describe('usePlaylistLibrary — removeSavedPlaylist (restauration du template pristine)', () => {
  it('restaure IMMÉDIATEMENT le template avec isReadOnly/isPublic, cloneCount undefined en attendant le vrai fetch', () => {
    const openCuratedPlaylist = vi.fn();
    mockFrom.mockImplementation(() => makeSingleRowQueryBuilder({ data: { clone_count: 7 }, error: null }));
    // Même template que les captures d'écran du retour direct ("Midnight
    // Runner 160"), un VRAI id de data/curatedSessions.js.
    const savedCopy = {
      id: 'pl-curated-tpl-midnight-runner-160-1723200000000',
      sourceTemplateId: 'tpl-midnight-runner-160',
      name: 'Midnight Runner 160',
      isNaughty: false,
    };
    const result = renderLibrary(savedCopy, { savedPlaylists: [savedCopy], openCuratedPlaylist });

    result.current.removeSavedPlaylist(savedCopy.id);

    expect(openCuratedPlaylist).toHaveBeenCalledTimes(1);
    const [calledTemplate, calledExtraFields] = openCuratedPlaylist.mock.calls[0];
    expect(calledTemplate.id).toBe('tpl-midnight-runner-160');
    // Restauration IMMÉDIATE toujours undefined — la vraie valeur arrive
    // après coup, de façon asynchrone (test suivant).
    expect(calledExtraFields).toEqual({ isReadOnly: true, isPublic: true, cloneCount: undefined });
  });

  it('met à jour cloneCount de façon asynchrone une fois le vrai fetch résolu, en ciblant bien template_clone_counts', async () => {
    const setCurrentPlaylist = vi.fn();
    mockFrom.mockImplementation(() => makeSingleRowQueryBuilder({ data: { clone_count: 7 }, error: null }));
    const savedCopy = {
      id: 'pl-curated-tpl-midnight-runner-160-1723200000000',
      sourceTemplateId: 'tpl-midnight-runner-160',
      name: 'Midnight Runner 160',
      isNaughty: false,
    };
    const result = renderLibrary(savedCopy, { savedPlaylists: [savedCopy], setCurrentPlaylist });

    await result.current.removeSavedPlaylist(savedCopy.id);
    // Laisse la micro-tâche de la promesse `.maybeSingle()` se résoudre.
    await new Promise(r => setTimeout(r, 0));

    expect(mockFrom).toHaveBeenCalledWith('template_clone_counts');
    // 1er appel : setCurrentPlaylist(nouvelle preview) par openCuratedPlaylist
    // lui-même (mocké ici, donc pas observé) — celui qu'on vérifie est
    // l'appel FONCTIONNEL posé après coup par ce correctif.
    const functionalCall = setCurrentPlaylist.mock.calls.find(([arg]) => typeof arg === 'function');
    expect(functionalCall).toBeDefined();
    const updated = functionalCall[0]({ sourceTemplateId: 'tpl-midnight-runner-160', cloneCount: undefined });
    expect(updated.cloneCount).toBe(7);
  });

  it('protégé contre une navigation entre-temps : ne touche pas currentPlaylist si l\'utilisateur a changé de playlist pendant le fetch', async () => {
    const setCurrentPlaylist = vi.fn();
    mockFrom.mockImplementation(() => makeSingleRowQueryBuilder({ data: { clone_count: 7 }, error: null }));
    const savedCopy = {
      id: 'pl-curated-tpl-midnight-runner-160-1723200000000',
      sourceTemplateId: 'tpl-midnight-runner-160',
      name: 'Midnight Runner 160',
      isNaughty: false,
    };
    const result = renderLibrary(savedCopy, { savedPlaylists: [savedCopy], setCurrentPlaylist });

    await result.current.removeSavedPlaylist(savedCopy.id);
    await new Promise(r => setTimeout(r, 0));

    const functionalCall = setCurrentPlaylist.mock.calls.find(([arg]) => typeof arg === 'function');
    // Une AUTRE playlist a été ouverte entre-temps (sourceTemplateId
    // différent) — le fetch, résolu après coup, ne doit RIEN écraser.
    const unrelatedPlaylist = { sourceTemplateId: 'tpl-autre-template', name: 'Autre playlist' };
    const result2 = functionalCall[0](unrelatedPlaylist);
    expect(result2).toBe(unrelatedPlaylist);
  });

  it('échec réseau du fetch : échec silencieux (journalisé), la restauration locale reste pleinement effective', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const openCuratedPlaylist = vi.fn();
    const setCurrentPlaylist = vi.fn();
    mockFrom.mockImplementation(() => makeSingleRowQueryBuilder({ data: null, error: { message: 'boom' } }));
    const savedCopy = {
      id: 'pl-curated-tpl-midnight-runner-160-1723200000000',
      sourceTemplateId: 'tpl-midnight-runner-160',
      name: 'Midnight Runner 160',
      isNaughty: false,
    };
    const result = renderLibrary(savedCopy, { savedPlaylists: [savedCopy], openCuratedPlaylist, setCurrentPlaylist });

    expect(() => result.current.removeSavedPlaylist(savedCopy.id)).not.toThrow();
    await new Promise(r => setTimeout(r, 0));

    expect(openCuratedPlaylist).toHaveBeenCalledTimes(1); // la restauration locale a bien eu lieu, indépendamment du fetch
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('cloneCount undefined sur la copie retirée (jamais posé) : comportement inchangé — toujours undefined à la restauration immédiate', () => {
    const openCuratedPlaylist = vi.fn();
    mockFrom.mockImplementation(() => makeSingleRowQueryBuilder({ data: { clone_count: 0 }, error: null }));
    const savedCopy = {
      id: 'pl-curated-tpl-midnight-runner-160-1723200000000',
      sourceTemplateId: 'tpl-midnight-runner-160',
      name: 'Midnight Runner 160',
      isNaughty: false,
      // Pas de cloneCount — cas d'une playlist sauvegardée AVANT ce
      // correctif (pas de migration rétroactive, voir CLAUDE-SANDBOX-
      // VERIFICATION.md, "tant qu'il n'y a pas d'utilisateurs réels").
      // Sans incidence désormais : la restauration immédiate est TOUJOURS
      // undefined, que la copie retirée en ait porté un ou non.
    };
    const result = renderLibrary(savedCopy, { savedPlaylists: [savedCopy], openCuratedPlaylist });

    result.current.removeSavedPlaylist(savedCopy.id);

    const [, calledExtraFields] = openCuratedPlaylist.mock.calls[0];
    expect(calledExtraFields.cloneCount).toBeUndefined();
  });

  it('playlist SANS sourceTemplateId (générée/importée) : pas de restauration de template, openCuratedPlaylist jamais appelée', () => {
    const openCuratedPlaylist = vi.fn();
    const freshGeneration = { id: 'pl-fresh-123', name: 'Ma séance générée' };
    const result = renderLibrary(freshGeneration, { savedPlaylists: [freshGeneration], openCuratedPlaylist });

    result.current.removeSavedPlaylist(freshGeneration.id);

    expect(openCuratedPlaylist).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
