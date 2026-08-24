import { curatedSessions, naughtyCuratedSessions } from '../data/curatedSessions';
import { useModalContext } from '../contexts/ModalContext';
import { supabase } from '../supabaseClient';

/**
 * usePlaylistLibrary — regroupe les actions de gestion de "Mes Playlists" :
 * sauvegarder/retirer une playlist, savoir si elle a un vrai historique à perdre,
 * le point d'entrée commun de retrait AVEC confirmation, et la planification d'une
 * date optionnelle.
 *
 * Extrait d'App.jsx (25/07, chantier "réduire le God Component") : même schéma que
 * usePlaylistCompletions.js — les dépendances externes (`currentPlaylist`/
 * `setCurrentPlaylist`, `savedPlaylists`/`setSavedPlaylists`, `showToast`,
 * `userStats`/`checkTrophies`) sont reçues en paramètres. `openCuratedPlaylist`
 * aussi : la restauration du template pristine (`removeSavedPlaylist`) reste
 * possédée par App.jsx, qui la transmet ici plutôt que de la réimplémenter.
 * `openModal` (ModalContext, chantier "centraliser les modales", même jour) suit
 * le même principe que dans useNavigation.js : `requestRemoveSavedPlaylist`
 * déclenche la confirmation via `openModal('PENDING_UNSAVE', playlist)` plutôt
 * qu'un setter dédié reçu en paramètre. Comportement strictement identique à
 * l'original.
 */
export function usePlaylistLibrary(
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists, showToast,
  openCuratedPlaylist, userStats, checkTrophies, defaultPlaylistPublic,
) {
  const { openModal } = useModalContext();

  // Ajoute la playlist en cours d'affichage à "Mes Playlists" (si pas déjà sauvegardée).
  const handleSavePlaylist = () => {
    if (!currentPlaylist) return;
    if (savedPlaylists.find(p => p.id === currentPlaylist.id)) return;

    // NOUVEAU (05/08, retour direct : "je vais dans Découvrir, j'ajoute une
    // playlist, j'y retourne, je l'ajoute une 2e fois → je me retrouve avec
    // 2 copies identiques") — un template ouvert DIRECTEMENT depuis
    // Découvrir (`onPlayTemplate={openCuratedPlaylist}`, DiscoverView.jsx,
    // SANS `isReadOnly`, contrairement au même template ouvert via la
    // vitrine `@tempofit_officiel`, voir App.jsx) obtient un id FRAIS à
    // CHAQUE ouverture (`pl-curated-{template.id}-${Date.now()}`,
    // useNavigation.js) — le garde `savedPlaylists.find(p => p.id ===
    // currentPlaylist.id)` juste au-dessus ne peut donc JAMAIS matcher pour
    // ce cas précis, même en rouvrant exactement le même template. Ce
    // 2e garde compare par `sourceTemplateId` (STABLE, lui, — l'id du
    // template dans curatedSessions.js, pas celui de CETTE ouverture
    // précise) plutôt que par `id` : si une copie de CE MÊME template
    // existe déjà, on bascule dessus au lieu d'en recréer une identique.
    // Seulement pertinent pour un template (`sourceTemplateId` absent sur
    // une playlist fraîchement générée par le wizard — aucune raison
    // d'empêcher de sauvegarder 2 générations différentes, même
    // coïncidence de contenu).
    if (currentPlaylist.sourceTemplateId) {
      const existing = savedPlaylists.find(p => p.sourceTemplateId === currentPlaylist.sourceTemplateId);
      if (existing) {
        setCurrentPlaylist(existing);
        showToast('Déjà dans Mes Playlists — retour sur ta copie.');
        return;
      }
    }

    // `isPublic` (Feature Sociale — Refonte Structurale Round 2/2, 01/08)
    // — valeur de DÉPART lue depuis le réglage par défaut de
    // SettingsView.jsx (`profilePrivacy.defaultPlaylistPublic`, reçu ici
    // en paramètre) : juste une commodité au moment de la sauvegarde,
    // ajustable ensuite au cas par cas (voir PlaylistHeader.jsx/
    // PlaylistCard.jsx pour la bascule individuelle). `!!` en repli sûr :
    // `undefined` (Supabase pas configuré, ou avant le 1er chargement du
    // profil) doit se comporter comme `false`, jamais planter ce
    // spread.
    const saved = { ...currentPlaylist, status: 'pending', isPublic: !!defaultPlaylistPublic };
    setSavedPlaylists([saved, ...savedPlaylists]);
    // `currentPlaylist` et l'entrée poussée dans `savedPlaylists` étaient 2
    // objets distincts (même id, mais 2 références différentes) tant que
    // cette ligne n'existait pas — resynchronisé ici pour éviter toute
    // divergence silencieuse entre les deux au fil des actions suivantes
    // (ex. planifier une date juste après avoir sauvegardé).
    setCurrentPlaylist(saved);
    showToast("Playlist ajoutée à Mes Playlists !");

    // Compteur de clonages de template — AJOUTÉ (14/08, retour direct avec
    // capture : "pourquoi je vois quand même le compteur à 0 pour la
    // playlist que j'ai pourtant clonée ?"). Jusqu'ici, `template_clone_counts`
    // ne s'incrémentait QUE via `handleClonePlaylist` (le bouton
    // "Sauvegarder" d'un template ouvert depuis la vitrine
    // `@tempofit_officiel`, `isReadOnly: true`) — JAMAIS via CE chemin-ci
    // ("Ajouter", le bouton d'un template ouvert directement depuis
    // Découvrir, `isReadOnly` absent). Distinction délibérée à l'origine
    // (02/08, TemplateCard.jsx : "ce geste génère sa propre nouvelle
    // séance, ce n'est pas 'copier le contenu de quelqu'un'"), mais
    // Découvrir étant de très loin le chemin le plus emprunté pour
    // récupérer un template, le compteur restait quasi systématiquement à
    // 0 en pratique — plus trompeur qu'honnête. Les deux chemins créditent
    // désormais le MÊME compteur, avec le MÊME garde-fou
    // (`sourceTemplateId`, absent sur une playlist fraîchement générée par
    // le wizard — jamais compté à tort comme un clonage de template) et la
    // MÊME philosophie fire-and-forget que `handleClonePlaylist` plus bas
    // (échec silencieux, jamais remonté à l'utilisateur — un compteur de
    // vanité qui rate une fois ne justifie pas une erreur visible sur une
    // action qui, de son point de vue, a déjà pleinement réussi).
    if (currentPlaylist.sourceTemplateId) {
      supabase.rpc('increment_template_clone_count', {
        target_template_id: currentPlaylist.sourceTemplateId,
      }).then(({ error }) => {
        if (error) console.error('[usePlaylistLibrary] increment_template_clone_count (Découvrir) a échoué :', error);
      });
    }
  };

  /**
   * Clone une playlist ÉTRANGÈRE consultée en aperçu (Feature Sociale —
   * Consultation/Clonage, 01/08) vers une vraie copie personnelle,
   * éditable. DISTINCT de `handleSavePlaylist` ci-dessus (qui, lui, garde
   * le même `id` — légitime pour une playlist qu'on a soi-même générée ou
   * ouverte depuis un modèle du catalogue, jamais "possédée" par quelqu'un
   * d'autre avant) : réutiliser `handleSavePlaylist` tel quel pour une
   * playlist étrangère aurait inséré une ligne `playlists` sous L'ID
   * ORIGINAL du propriétaire — la contrainte `primary key (id, user_id)`
   * l'aurait techniquement toléré (clé composite, `user_id` différent),
   * mais 2 lignes sans rapport partageant le même `id` reste une
   * incohérence évitable, et surtout : le brief demande explicitement un
   * NOUVEL id pour la copie.
   *
   * Repartis à zéro sur tout ce qui appartient à L'HISTOIRE du
   * propriétaire d'origine, jamais mentionné explicitement dans le brief
   * mais indispensable pour ne pas mentir sur la nouvelle copie :
   * `completions`/`actualDataByDate`/`plannedDate` — la copie n'a, de fait,
   * jamais été faite par son nouvel acquéreur, lui prêter l'historique de
   * quelqu'un d'autre afficherait des séances qu'il n'a jamais réalisées.
   * `isPublic: false` (demandé explicitement par le brief) : la copie
   * redevient privée, son nouveau propriétaire décide lui-même s'il veut
   * la rendre publique à son tour. `isReadOnly` retiré : la copie est
   * désormais VRAIMENT la sienne, plus un aperçu.
   */
  const handleClonePlaylist = () => {
    if (!currentPlaylist) return;

    // NOUVEAU (05/08, retour direct — même chantier que le garde
    // équivalent dans `handleSavePlaylist` juste au-dessus, voir sa
    // docstring pour le raisonnement complet) : ici, le cas concerné est
    // une playlist ÉTRANGÈRE (`user_id` réel) ou un template ouvert via la
    // vitrine `@tempofit_officiel` (`isReadOnly: true` forcé, voir
    // App.jsx) — même symptôme, revisiter la même source et cloner à
    // nouveau créait une 2e copie identique à chaque fois. Même branchement
    // que l'appel RPC juste plus bas dans cette fonction (`user_id` d'abord,
    // `sourceTemplateId` en repli) : une vraie playlist étrangère se
    // reconnaît par sa lignée immédiate (`parentId`+`parentUserId`, POSÉS
    // par un clonage précédent — voir plus bas), un template par
    // `sourceTemplateId` (stable, contrairement à l'id de CETTE
    // prévisualisation précise).
    const existing = currentPlaylist.user_id
      ? savedPlaylists.find(p => p.parentId === currentPlaylist.id && p.parentUserId === currentPlaylist.user_id)
      : currentPlaylist.sourceTemplateId
        ? savedPlaylists.find(p => p.sourceTemplateId === currentPlaylist.sourceTemplateId)
        : null;
    if (existing) {
      setCurrentPlaylist(existing);
      showToast('Déjà dans Mes Playlists — retour sur ta copie.');
      return;
    }

    // Traçabilité de lignée — REFONTE (03/08, voir supabase-schema.sql
    // pour le raisonnement complet) : le client ne pose plus que le
    // maillon IMMÉDIAT (`parentId`/`parentUserId` — `currentPlaylist.id`/
    // `.user_id`, lus directement, RIEN à dériver ni à faire remonter
    // depuis une éventuelle lignée précédente). Reconstituer la racine de
    // la chaîne (pour créditer A même quand C clone la copie de B) est
    // désormais la responsabilité de Postgres (`resolve_playlist_origin`,
    // appelée EN INTERNE par `increment_playlist_clone_count` plus bas) —
    // plus rien à calculer ni à propager ici.
    const parentId = currentPlaylist.id;
    const parentUserId = currentPlaylist.user_id;

    const cloned = {
      ...currentPlaylist,
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      status: 'pending',
      isPublic: false,
      isReadOnly: false,
      completions: [],
      actualDataByDate: {},
      plannedDate: null,
      createdAt: new Date().toLocaleDateString(),
      // BUG CORRIGÉ (07/08, check-up) : `...currentPlaylist` ci-dessus
      // reporte aussi les champs D'AFFICHAGE posés par
      // `handleOpenPublicPlaylist` (App.jsx) pour la playlist ÉTRANGÈRE
      // qu'on vient de consulter — `user_id` (l'UUID du propriétaire
      // D'ORIGINE) et `ownerUsername`. Sans ce reset, ces 2 champs
      // restaient indéfiniment dans `content` de la copie — désormais
      // possédée par l'utilisateur — synchronisés tels quels vers
      // Supabase. Un futur code qui lirait `currentPlaylist.user_id` SANS
      // vérifier `isReadOnly`/`isSaved` en premier traiterait à tort cette
      // copie, pourtant possédée, comme une playlist étrangère : même
      // famille de piège que celui déjà documenté plus haut sur la clé
      // composite `(id, user_id)` ("toujours filtrer par les deux
      // ensemble"). `handleClonePublicRoutine` (App.jsx), l'équivalent
      // côté routines, n'a jamais eu ce problème : il part de `{
      // ...row.content }` (le contenu brut, sans `user_id`) plutôt que de
      // l'objet aplati — divergence entre les deux implémentations, pas un
      // choix voulu.
      user_id: undefined,
      ownerUsername: undefined,
      // ⚠️ `cloneCount` RÉINITIALISÉ ICI (22/08, retour direct : "la
      // playlist que j'ai créée ne devrait pas avoir ce 1 tant qu'elle n'a
      // pas été clonée à son tour") — le 07/08, ce champ avait déjà été
      // réinitialisé dans ce même bloc, PUIS retiré le 10/08 (retour
      // direct avec 4 captures : "quand je l'ajoute il n'y a plus le
      // compteur de clones ?"). Cette suppression du 10/08 généralisait à
      // tort le même raisonnement aux 2 chemins de sauvegarde de ce
      // fichier, alors qu'ils sont sémantiquement DIFFÉRENTS sur ce point
      // précis : `handleSavePlaylist` (template Découvrir, MÊME `id`
      // conservé) ne porte quasiment jamais de `cloneCount` réel au
      // départ — le compteur d'un template vit dans une table séparée
      // (`template_clone_counts`, par `sourceTemplateId`), pas dans un
      // champ `cloneCount` par playlist — retirer ce champ y était donc
      // un no-op silencieux, jamais remarqué. ICI, à l'inverse
      // (`handleClonePlaylist`, NOUVEL `id` généré), `currentPlaylist`
      // PEUT réellement porter un `cloneCount` non-`undefined` — celui de
      // la playlist ÉTRANGÈRE qu'on vient de cloner (`row.clone_count`
      // depuis Supabase, voir App.jsx). Le garder sur la copie affichait
      // donc le compteur du PARENT comme si c'était déjà celui de la
      // copie fraîchement créée, qui n'a par définition encore jamais été
      // clonée par personne. `undefined` (pas `0`) : cohérent avec le
      // garde-fou déjà en place ailleurs (`PlaylistHeaderBadges.jsx`,
      // badge gaté sur `cloneCount !== undefined`) — une copie qui n'a
      // jamais été clonée n'affiche AUCUN badge, plutôt qu'un badge à 0
      // qui laisserait croire que le compteur a un sens avant la 1re
      // vraie occurrence.
      cloneCount: undefined,
      // Ne conserver le lien que s'il pointe vers un VRAI utilisateur
      // (`parentUserId` défini) — sinon (playlist issue d'un template de
      // la vitrine, `sourceTemplateId` déjà propagé par le spread
      // ci-dessus et suffisant pour cette traçabilité-là) ces 2 champs
      // resteraient `undefined`, jamais un faux lien pointant vers
      // personne. `isModifiedSinceClone: false` ("Clone", pas encore
      // "Enfant" — une copie fraîche est identique à sa source, voir
      // handleRenamePlaylist/handleEditPlaylistDescription pour où ce
      // booléen passe à `true`) posé EXPLICITEMENT ici (le spread
      // `...currentPlaylist` pourrait sinon transmettre par erreur la
      // valeur de la copie précédente dans la chaîne — chaque NOUVELLE
      // copie démarre sa propre vie "jamais modifiée", même si son parent
      // l'était déjà). Plus de `originCreditClaimed` (retiré, voir
      // supabase-schema.sql — le mécanisme qu'il gardait était du code
      // mort).
      ...(parentUserId ? { parentId, parentUserId, isModifiedSinceClone: false } : {}),
    };
    setSavedPlaylists([cloned, ...savedPlaylists]);
    // Bascule IMMÉDIATEMENT sur la copie (brief, UX : "redirige
    // immédiatement... sortant ainsi du mode lecture seule") — `isReadOnly`
    // valant désormais `false` sur cet objet, l'interface redevient
    // éditable au prochain rendu, sans navigation séparée nécessaire (on
    // reste sur la même vue détail, seul l'objet affiché change).
    setCurrentPlaylist(cloned);
    showToast("🎵 Playlist clonée dans Mes Playlists !");

    // Compteur de clonages RÉEL — REFONTE (03/08) : UN SEUL appel RPC
    // désormais (au lieu de 2 avant) — `increment_playlist_clone_count`
    // crédite maintenant, EN INTERNE côté serveur, à la fois le maillon
    // immédiat (`currentPlaylist`) ET l'origine réelle de la chaîne
    // (résolue par `resolve_playlist_origin`, jamais calculée ici). Le
    // client indique juste ce qu'il vient RÉELLEMENT de cloner.
    //
    // `currentPlaylist.sourceTemplateId` (playlist de la vitrine
    // `@tempofit_officiel`, sans vrai propriétaire) reste géré séparément,
    // sur la table DÉDIÉE `template_clone_counts` — les deux mécanismes
    // sont volontairement PARALLÈLES, jamais mélangés (voir la docstring
    // de `templateToVitrineRow`, officialVitrineProfile.js). Fire-and-forget
    // dans tous les cas : ne bloque jamais le clonage lui-même (déjà
    // effectif localement juste au-dessus) si le réseau est indisponible
    // ou l'appel échoue — seulement journalisé, jamais remonté à
    // l'utilisateur (un compteur de vanité qui rate une fois ne justifie
    // pas une erreur visible sur une action qui, du point de vue de
    // l'utilisateur, a déjà pleinement réussi).
    if (currentPlaylist.user_id) {
      supabase.rpc('increment_playlist_clone_count', {
        target_id: currentPlaylist.id,
        target_user_id: currentPlaylist.user_id,
      }).then(({ error }) => {
        if (error) console.error('[usePlaylistLibrary] increment_playlist_clone_count a échoué :', error);
      });
    } else if (currentPlaylist.sourceTemplateId) {
      supabase.rpc('increment_template_clone_count', {
        target_template_id: currentPlaylist.sourceTemplateId,
      }).then(({ error }) => {
        if (error) console.error('[usePlaylistLibrary] increment_template_clone_count a échoué :', error);
      });
    }
  };

  /**
   * Retire une playlist de "Mes Playlists" par id — fonction UNIQUE utilisée à
   * la fois par le bouton "Sauvegardée..." de la vue détail (retrait) et par
   * la poubelle des cartes dans "Mes Playlists" (PlaylistsView/PlaylistCard) :
   * c'est littéralement la même opération (retirer un id de `savedPlaylists`),
   * pas la peine de la dupliquer. `playlistId` plutôt que `currentPlaylist`
   * pour fonctionner aussi bien depuis la liste (pas de "playlist courante"
   * là-bas) que depuis le détail.
   */
  const removeSavedPlaylist = (playlistId) => {
    setSavedPlaylists(savedPlaylists.filter(p => p.id !== playlistId));

    // RETOUR DIRECT ("je devrais revenir à la playlist telle que j'ai
    // cliqué dessus au départ, pas garder le même titre") : "Retirer de Mes
    // Séances" ne supprime QUE l'entrée dans `savedPlaylists` — sans ça,
    // `currentPlaylist` (toujours affiché à l'écran juste après) garde
    // n'importe quelle modification faite pendant que la playlist était
    // sauvegardée (renommage, titres retirés/remplacés...), alors que
    // l'écran redevient une simple PRÉVISUALISATION en lecture seule d'un
    // template du catalogue — qui, lui, n'a jamais changé dans
    // data/curatedSessions.js. Uniquement si c'est la playlist AFFICHÉE
    // (retirer une autre carte depuis PlaylistsView ne doit rien changer à
    // l'écran courant) et qu'elle vient bien d'un template (`sourceTemplateId`
    // — absent pour une playlist générée ou importée, qui n'a pas de
    // "version canonique" séparée d'elle-même vers laquelle revenir).
    //
    // ⚠️ BUG CORRIGÉ (retour direct, captures à l'appui : "je supprime de
    // Mes Séances, je ne vois plus le compteur de clonages, on devrait
    // revoir le précédent pourtant ?") — `openCuratedPlaylist` était
    // appelée ICI sans son 2e paramètre (`extraFields`), contrairement aux
    // 2 AUTRES appelants du projet (`App.jsx`/`TemplateCard.jsx`), qui
    // fusionnent tous les deux `{ isReadOnly: true, isPublic: true,
    // cloneCount }` — vérifié en généralisant la recherche à TOUS les
    // appels de `openCuratedPlaylist` du projet avant de corriger (2 seuls
    // autres appelants, tous les deux déjà corrects). Le template restauré
    // ici repartait donc d'un objet flambant neuf, sans `cloneCount` ni
    // `isReadOnly`/`isPublic` — le badge de compteur de clonages
    // (`PlaylistHeaderTitleBlock.jsx`, gaté sur `cloneCount !== undefined`)
    // disparaissait purement et simplement.
    // `cloneCount: currentPlaylist.cloneCount` (PAS une nouvelle requête
    // Supabase à `template_clone_counts`, contrairement à App.jsx) — la
    // copie qu'on retire avait ELLE-MÊME hérité de la vraie valeur au
    // moment de sa sauvegarde (`handleSavePlaylist` spreads
    // `{...currentPlaylist}`, voir sa docstring) et ne l'a plus jamais
    // perdue depuis (aucune mutation de playlist dans ce projet ne
    // supprime `cloneCount` du spread) : la reporter ici suffit, sans
    // avoir besoin de refaire un aller-retour réseau juste pour un
    // affichage qui redevient de toute façon un aperçu figé. Potentiellement
    // légèrement périmée (quelqu'un d'autre a pu cloner ce template
    // entre-temps) — acceptable pour un chiffre de vanité, largement
    // mieux que l'absence totale actuelle.
    if (currentPlaylist?.id === playlistId && currentPlaylist.sourceTemplateId) {
      const catalog = currentPlaylist.isNaughty ? naughtyCuratedSessions : curatedSessions;
      const originalTemplate = catalog.find(t => t.id === currentPlaylist.sourceTemplateId);
      if (originalTemplate) {
        openCuratedPlaylist(originalTemplate, { isReadOnly: true, isPublic: true, cloneCount: currentPlaylist.cloneCount });
        showToast("Playlist retirée de Mes Playlists — le modèle original a été restauré.");
        return;
      }
    }

    showToast("Playlist retirée de Mes Playlists.");
  };

  // A-t-elle du VRAI historique à perdre (pas juste "jamais utilisée") ?
  const playlistHasHistory = (playlist) => !!playlist && (
    (playlist.completions && playlist.completions.length > 0)
    || (playlist.actualDataByDate && Object.keys(playlist.actualDataByDate).length > 0)
  );

  /**
   * Point d'entrée commun du retrait/suppression, avec confirmation
   * UNIQUEMENT si la playlist a déjà des complétions ou des données
   * importées (une playlist "fraîche", jamais faite, est retirée
   * directement, sans friction inutile) — que ce soit depuis le bouton
   * "Sauvegardée dans Mes Playlists" de la vue détail ou depuis la poubelle
   * d'une carte dans "Mes Playlists" : même garde-fou aux deux endroits
   * (retour direct après un audit de cohérence — l'un avait la confirmation,
   * l'autre pas, pour la même perte de données possible).
   */
  const requestRemoveSavedPlaylist = (playlistId) => {
    const playlist = savedPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;
    if (playlistHasHistory(playlist)) {
      openModal('PENDING_UNSAVE', playlist);
    } else {
      removeSavedPlaylist(playlistId);
    }
  };

  // Planifie (ou déplanifie, si dateStr est vide) une date optionnelle pour une
  // playlist — sert uniquement de clé de TRI dans "Mes Playlists" (section
  // "Planifiées"), jamais une contrainte bloquante : une playlist sans date
  // reste utilisable normalement, juste triable manuellement à la place (voir
  // PlaylistsView, glisser-déposer de la section "À planifier"). PARTAGÉE avec
  // PlaylistsView — reste ici, pas migrée dans PlaylistDetailContext.
  const setPlaylistPlannedDate = (playlistId, dateStr) => {
    const value = dateStr || null;
    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, plannedDate: value } : p));
    if (currentPlaylist && currentPlaylist.id === playlistId) {
      setCurrentPlaylist({ ...currentPlaylist, plannedDate: value });
    }
    // "Planifier une séance" — donner une date à une playlist pour la première
    // fois (`value` non vide ⇒ on planifie, pas on déplanifie). Volontairement
    // indépendant de "Pile à l'Heure" (qui récompense d'avoir RESPECTÉ la
    // date) : ici c'est juste le premier pas, découvrir que ça existe.
    if (value && !userStats.hasPlannedSession) {
      checkTrophies({ ...userStats, hasPlannedSession: true });
    }
  };

  return { handleSavePlaylist, handleClonePlaylist, removeSavedPlaylist, playlistHasHistory, requestRemoveSavedPlaylist, setPlaylistPlannedDate };
}
