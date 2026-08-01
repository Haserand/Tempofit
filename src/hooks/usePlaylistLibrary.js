import { curatedSessions, naughtyCuratedSessions } from '../data/curatedSessions';
import { useModalContext } from '../contexts/ModalContext';

/**
 * usePlaylistLibrary — regroupe les actions de gestion de "Mes Séances" :
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

  // Ajoute la playlist en cours d'affichage à "Mes Séances" (si pas déjà sauvegardée).
  const handleSavePlaylist = () => {
    if (currentPlaylist && !savedPlaylists.find(p => p.id === currentPlaylist.id)) {
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
      showToast("Playlist ajoutée à Mes Séances !");
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
    const cloned = {
      ...currentPlaylist,
      id: `pl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      isPublic: false,
      isReadOnly: false,
      completions: [],
      actualDataByDate: {},
      plannedDate: null,
      createdAt: new Date().toLocaleDateString(),
    };
    setSavedPlaylists([cloned, ...savedPlaylists]);
    // Bascule IMMÉDIATEMENT sur la copie (brief, UX : "redirige
    // immédiatement... sortant ainsi du mode lecture seule") — `isReadOnly`
    // valant désormais `false` sur cet objet, l'interface redevient
    // éditable au prochain rendu, sans navigation séparée nécessaire (on
    // reste sur la même vue détail, seul l'objet affiché change).
    setCurrentPlaylist(cloned);
    showToast("🎵 Playlist clonée dans Mes Séances !");
  };

  /**
   * Retire une playlist de "Mes Séances" par id — fonction UNIQUE utilisée à
   * la fois par le bouton "Sauvegardée..." de la vue détail (retrait) et par
   * la poubelle des cartes dans "Mes Séances" (PlaylistsView/PlaylistCard) :
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
    if (currentPlaylist?.id === playlistId && currentPlaylist.sourceTemplateId) {
      const catalog = currentPlaylist.isNaughty ? naughtyCuratedSessions : curatedSessions;
      const originalTemplate = catalog.find(t => t.id === currentPlaylist.sourceTemplateId);
      if (originalTemplate) {
        openCuratedPlaylist(originalTemplate);
        showToast("Playlist retirée de Mes Séances — le modèle original a été restauré.");
        return;
      }
    }

    showToast("Playlist retirée de Mes Séances.");
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
   * "Sauvegardée dans Mes Séances" de la vue détail ou depuis la poubelle
   * d'une carte dans "Mes Séances" : même garde-fou aux deux endroits
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
  // playlist — sert uniquement de clé de TRI dans "Mes Séances" (section
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
