import { createContext, useContext, useState } from 'react';
import { MAX_DESCRIPTION_LENGTH } from '../appConfig';

/**
 * PlaylistEditContext.jsx — extrait de PlaylistDetailContext.jsx (08/08,
 * chantier "value non mémoïsée re-render tout le monde à chaque frappe").
 *
 * PROBLÈME TROUVÉ : `PlaylistDetailContext.jsx` construit un `value` neuf
 * (littéral d'objet, jamais passé dans `useMemo`) à CHAQUE rendu du
 * Provider. `isEditingPlaylistDetails`/`editedPlaylistName`/
 * `editedPlaylistDescription` vivaient dans ce même Provider — donc taper
 * UN SEUL caractère dans le champ titre/description recréait ce `value`
 * en entier, et React re-rendait TOUS les consommateurs de
 * `usePlaylistDetail()` (TrackList/TrackItem, PlaylistCharts, et les 5
 * sous-composants de PlaylistHeader) à chaque frappe — pas seulement le
 * champ de saisie lui-même. Les calculs lourds restaient protégés par
 * leurs propres `useMemo` (pas de recalcul), mais le re-render React en
 * lui-même a un coût, payé à chaque frappe, par des composants qui n'ont
 * RIEN à voir avec l'édition en cours.
 *
 * CORRECTIF : cet état (+ `handleSavePlaylistDetails`) vit maintenant dans
 * son PROPRE Contexte, à part. Seul `PlaylistHeaderTitleBlock.jsx` (via
 * `usePlaylistEdit()`) le consomme — c'est le SEUL composant qui a besoin
 * de re-render à chaque frappe, et c'est maintenant le SEUL qui le fait.
 * `PlaylistDetailProvider` lui-même n'a plus cet état interne : il ne
 * re-rend plus du tout pendant une frappe, donc son `value` (toujours pas
 * mémoïsé, mais ça n'a plus d'importance ici) garde la MÊME référence
 * d'un rendu à l'autre — React ne propage alors AUCUN re-render à ses
 * propres consommateurs pendant l'édition.
 *
 * Monté en frère de `<PlaylistDetailProvider>` (pas à l'intérieur, pas
 * autour dans l'autre sens — l'un n'a pas besoin de l'autre) — voir
 * `PlaylistDetailView.jsx`. Reçoit les 4 mêmes props que
 * `PlaylistDetailProvider` en a besoin pour la même raison
 * (`applyPlaylistUpdate`, écrit dans currentPlaylist ET savedPlaylists) :
 * PAS de dépendance entre les deux Providers, juste les mêmes 4 valeurs
 * reçues séparément par chacun.
 */

const PlaylistEditContext = createContext(null);

export function PlaylistEditProvider({
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  children,
}) {
  // --- Édition du nom/de la description de la playlist ---
  // Édition combinée titre + description (08/08, retour direct : "que
  // modifier le titre ou la description vienne un seul crayon plutôt que
  // via chacune une option individuelle" — précédent Spotify cité, gardé
  // INLINE plutôt qu'une modale, sur confirmation explicite). UN SEUL
  // état, UN SEUL handler de sauvegarde pour les deux champs.
  // ⚠️ Piège identifié AVANT d'implémenter (pas après coup, voir aussi
  // git blame de PlaylistDetailContext.jsx avant ce découpage) : les 2
  // anciens handlers séparés lisaient chacun `currentPlaylist` depuis la
  // MÊME fermeture de rendu — les appeler l'un après l'autre aurait fait
  // perdre le 1er changement (React ne reflète un `setState` qu'au rendu
  // SUIVANT). Un seul `updatedPlaylist`, les deux champs ensemble, un
  // seul `setCurrentPlaylist`/`setSavedPlaylists` : plus de risque de ce
  // genre.
  const [isEditingPlaylistDetails, setIsEditingPlaylistDetails] = useState(false);
  const [editedPlaylistName, setEditedPlaylistName] = useState('');
  const [editedPlaylistDescription, setEditedPlaylistDescription] = useState('');

  // Nom JAMAIS vide (une playlist sans nom n'aurait aucun sens), mais un
  // nom vidé PAR MÉGARDE en éditant la description en même temps ne fait
  // plus avorter TOUTE la sauvegarde — repli sur l'ancien nom
  // (`|| currentPlaylist.name`) plutôt qu'un `return` précoce qui aurait
  // aussi perdu la description tapée à côté. Description VIDE, elle,
  // reste un état valide (on peut vouloir l'effacer) — pas de repli
  // équivalent pour ce champ.
  const handleSavePlaylistDetails = () => {
    if (!currentPlaylist) { setIsEditingPlaylistDetails(false); return; }
    const trimmedName = editedPlaylistName.trim();
    const trimmedDescription = editedPlaylistDescription.trim().slice(0, MAX_DESCRIPTION_LENGTH);
    const updatedPlaylist = {
      ...currentPlaylist,
      name: trimmedName || currentPlaylist.name,
      description: trimmedDescription,
      // "Clone" vs "Enfant" (02/08, discussion produit) — un booléen posé
      // UNE SEULE FOIS, peu importe LEQUEL des deux champs a réellement
      // changé.
      ...(currentPlaylist.parentUserId && !currentPlaylist.isModifiedSinceClone ? { isModifiedSinceClone: true } : {}),
    };
    setCurrentPlaylist(updatedPlaylist);
    setSavedPlaylists(savedPlaylists.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
    setIsEditingPlaylistDetails(false);
  };

  const value = {
    isEditingPlaylistDetails, setIsEditingPlaylistDetails,
    editedPlaylistName, setEditedPlaylistName,
    editedPlaylistDescription, setEditedPlaylistDescription,
    handleSavePlaylistDetails,
  };

  return <PlaylistEditContext.Provider value={value}>{children}</PlaylistEditContext.Provider>;
}

// Fallback silencieux — même convention que les autres contexts du projet
// (AuthContext.jsx/GeneratorContext.jsx/AudioPlayerContext.jsx).
const FALLBACK = {
  isEditingPlaylistDetails: false, setIsEditingPlaylistDetails: () => {},
  editedPlaylistName: '', setEditedPlaylistName: () => {},
  editedPlaylistDescription: '', setEditedPlaylistDescription: () => {},
  handleSavePlaylistDetails: () => {},
};

export function usePlaylistEdit() {
  const ctx = useContext(PlaylistEditContext);
  return ctx || FALLBACK;
}
