import { createContext, useContext, useState } from 'react';
import { MAX_DESCRIPTION_LENGTH, MIN_PLAYLIST_NAME_LENGTH } from '../appConfig';
import { useModalContext } from './ModalContext';

/**
 * PlaylistEditContext.jsx — extrait de PlaylistDetailContext.jsx (08/08,
 * chantier "value non mémoïsée re-render tout le monde à chaque frappe").
 *
 * PROBLÈME TROUVÉ (08/08) : `PlaylistDetailContext.jsx` construit un
 * `value` neuf (littéral d'objet, jamais passé dans `useMemo`) à CHAQUE
 * rendu du Provider. `isEditingPlaylistDetails`/`editedPlaylistName`/
 * `editedPlaylistDescription` vivaient dans ce même Provider — donc taper
 * UN SEUL caractère dans le champ titre/description recréait ce `value`
 * en entier, et React re-rendait TOUS les consommateurs de
 * `usePlaylistDetail()` à chaque frappe.
 *
 * CORRECTIF (08/08) : cet état (+ `handleSavePlaylistDetails`) déplacé
 * dans son PROPRE Contexte, à part.
 *
 * ⚠️ ÉDITION PASSÉE EN MODALE (retour direct, captures à l'appui : "l'édition
 * inline crée un layout shift désagréable qui décale les stats/boutons vers
 * le bas — remplacer par une modale dédiée, standardiser l'UX") — plus dans
 * la même session que le découpage initial. L'édition inline (un seul
 * crayon ouvrant titre+description DIRECTEMENT dans la carte, décrite plus
 * haut dans les versions précédentes de ce fichier) est retirée : le
 * crayon (`PlaylistHeaderTitleBlock.jsx`) ouvre maintenant
 * `EditPlaylistModal.jsx` via `ModalContext`, MÊME SCHÉMA que
 * `EditRoutineModal.jsx`/`useRoutines.js` — `isEditPlaylistModalOpen`
 * dérivé de `activeModal === 'EDIT_PLAYLIST'` ICI, dans le hook qui
 * possède déjà le reste de l'état d'édition, plutôt que reçu en prop
 * depuis un container générique (voir la docstring de
 * `ModalContainer.jsx` : "Share, Search, EditRoutine et SavingRoutine...
 * rendues ailleurs qu'ici : leur booléen d'ouverture est dérivé
 * directement dans le hook qui possède déjà le reste de leur état" — même
 * principe appliqué ici). `editedPlaylistName`/`editedPlaylistDescription`
 * restent le brouillon local (comme avant), mais préremplies au moment de
 * L'OUVERTURE (`handleOpenEditPlaylistModal`, un seul point d'entrée qui
 * fait les 3 choses ensemble — préremplir nom, préremplir description,
 * ouvrir la modale — plutôt que 3 appels séparés dans le composant
 * appelant : même raisonnement que l'ancien risque de course déjà
 * documenté pour `handleSavePlaylistDetails`, éviter qu'un futur appelant
 * n'oublie l'un des 3 appels ou les fasse dans le mauvais ordre).
 * `handleSavePlaylistDetails` ferme désormais la modale lui-même
 * (`closeModal()`) une fois la sauvegarde faite, au lieu de mettre à jour
 * un booléen local.
 *
 * ⚠️ VALIDATION DU TITRE (retour direct, même session — capture d'écran de
 * la modale à l'appui) : le titre n'a JAMAIS été optionnel (contrairement à
 * la description), mais rien ne l'empêchait auparavant d'être vidé — un
 * repli silencieux sur l'ancien nom masquait le problème (`|| currentPlaylist.name`,
 * retiré). Règle actée : 0 à 2 caractères (après `.trim()`, les espaces ne
 * comptent pas) = INVALIDE, bouton "Enregistrer" désactivé + message
 * d'erreur dans `EditPlaylistModal.jsx` (`MIN_PLAYLIST_NAME_LENGTH`,
 * appConfig.js). La DESCRIPTION, elle, reste sans AUCUNE contrainte de
 * longueur minimale — n'importe quel contenu est valide, y compris vide
 * (optionnelle, inchangé). `isEditedNameValid` calculé directement ici
 * (dérivé de `editedPlaylistName`, pas un state à part à synchroniser) et
 * réexposé — `handleSavePlaylistDetails` la revérifie aussi en interne
 * (garde défensive : Entrée dans le champ titre reste possible même
 * bouton désactivé, ce garde-fou empêche une sauvegarde invalide malgré
 * tout).
 *
 * Monté en frère de `<PlaylistDetailProvider>` (pas à l'intérieur, pas
 * autour dans l'autre sens — l'un n'a pas besoin de l'autre) — voir
 * `PlaylistDetailView.jsx`. Reçoit les 4 mêmes props que
 * `PlaylistDetailProvider` en a besoin pour la même raison
 * (`applyPlaylistUpdate`, écrit dans currentPlaylist ET savedPlaylists) :
 * PAS de dépendance entre les deux Providers, juste les mêmes 4 valeurs
 * reçues séparément par chacun. `EditPlaylistModal.jsx` est montée dans
 * `PlaylistDetailView.jsx`, à l'intérieur de CE Provider (lit
 * `usePlaylistEdit()` directement, comme `CustomActivityModal.jsx` lit
 * `useCustomActivityContext()`) — pas besoin de faire transiter son état
 * par un container générique (`ModalContainer.jsx`), qui, lui, est monté
 * GLOBALEMENT et n'a donc jamais accès à ce Contexte, scopé à la vue
 * détail d'une playlist.
 */

const PlaylistEditContext = createContext(null);

export function PlaylistEditProvider({
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  children,
}) {
  const { activeModal, openModal, closeModal } = useModalContext();
  // Même schéma que `isEditRoutineModalOpen` (useRoutines.js) — dérivé
  // directement de `activeModal`, pas un 2e booléen local à synchroniser.
  const isEditPlaylistModalOpen = activeModal === 'EDIT_PLAYLIST';

  // --- Édition du nom/de la description de la playlist ---
  // Brouillon local, préremplit à l'OUVERTURE de la modale
  // (`handleOpenEditPlaylistModal` plus bas) — inchangé depuis la version
  // inline : UN SEUL état, UN SEUL handler de sauvegarde pour les deux
  // champs.
  // ⚠️ Piège identifié AVANT d'implémenter la fusion titre+description
  // (pas après coup) : les 2 anciens handlers séparés lisaient chacun
  // `currentPlaylist` depuis la MÊME fermeture de rendu — les appeler l'un
  // après l'autre aurait fait perdre le 1er changement (React ne reflète
  // un `setState` qu'au rendu SUIVANT). Un seul `updatedPlaylist`, les
  // deux champs ensemble, un seul `setCurrentPlaylist`/`setSavedPlaylists`
  // : plus de risque de ce genre.
  const [editedPlaylistName, setEditedPlaylistName] = useState('');
  const [editedPlaylistDescription, setEditedPlaylistDescription] = useState('');

  // Dérivé directement de `editedPlaylistName` — pas un state à part à
  // resynchroniser à chaque frappe, juste un calcul lu à chaque rendu.
  const isEditedNameValid = editedPlaylistName.trim().length >= MIN_PLAYLIST_NAME_LENGTH;

  // Point d'entrée UNIQUE pour ouvrir la modale — préremplit les 2
  // brouillons ET ouvre la modale ensemble, plutôt que de laisser
  // l'appelant (`PlaylistHeaderTitleBlock.jsx`) faire les 3 appels
  // séparément : évite qu'un futur appelant oublie l'un des 3, ou les
  // fasse dans le mauvais ordre (même raisonnement que
  // `handleSavePlaylistDetails` plus bas).
  const handleOpenEditPlaylistModal = () => {
    if (!currentPlaylist) return;
    setEditedPlaylistName(currentPlaylist.name);
    setEditedPlaylistDescription(currentPlaylist.description || '');
    openModal('EDIT_PLAYLIST');
  };

  // Titre JAMAIS vide (0 à 2 caractères = invalide, voir
  // `isEditedNameValid` plus haut — le bouton "Enregistrer" est déjà
  // désactivé dans ce cas, cette garde couvre l'entrée par Entrée dans le
  // champ, toujours possible malgré le bouton désactivé). Description
  // SANS contrainte de longueur minimale — n'importe quel contenu est
  // valide, y compris vide (optionnelle).
  const handleSavePlaylistDetails = () => {
    if (!currentPlaylist) { closeModal(); return; }
    if (!isEditedNameValid) return;
    const trimmedName = editedPlaylistName.trim();
    const trimmedDescription = editedPlaylistDescription.trim().slice(0, MAX_DESCRIPTION_LENGTH);
    const updatedPlaylist = {
      ...currentPlaylist,
      name: trimmedName,
      description: trimmedDescription,
      // "Clone" vs "Enfant" (02/08, discussion produit) — un booléen posé
      // UNE SEULE FOIS, peu importe LEQUEL des deux champs a réellement
      // changé.
      ...(currentPlaylist.parentUserId && !currentPlaylist.isModifiedSinceClone ? { isModifiedSinceClone: true } : {}),
    };
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    closeModal();
  };

  const value = {
    isEditPlaylistModalOpen, closeEditPlaylistModal: closeModal,
    editedPlaylistName, setEditedPlaylistName,
    editedPlaylistDescription, setEditedPlaylistDescription,
    isEditedNameValid,
    handleOpenEditPlaylistModal, handleSavePlaylistDetails,
  };

  return <PlaylistEditContext.Provider value={value}>{children}</PlaylistEditContext.Provider>;
}

// Fallback silencieux — même convention que les autres contexts du projet
// (AuthContext.jsx/GeneratorContext.jsx/AudioPlayerContext.jsx).
const FALLBACK = {
  isEditPlaylistModalOpen: false, closeEditPlaylistModal: () => {},
  editedPlaylistName: '', setEditedPlaylistName: () => {},
  editedPlaylistDescription: '', setEditedPlaylistDescription: () => {},
  isEditedNameValid: true,
  handleOpenEditPlaylistModal: () => {}, handleSavePlaylistDetails: () => {},
};

export function usePlaylistEdit() {
  const ctx = useContext(PlaylistEditContext);
  return ctx || FALLBACK;
}
