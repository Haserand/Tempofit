import { Edit3, X } from 'lucide-react';
import { ICON_BUTTON_ROUNDING } from '../../layout/iconButtonLayout';
import { MAX_DESCRIPTION_LENGTH } from '../../appConfig';
import { usePlaylistEdit } from '../../contexts/PlaylistEditContext';
import ModalShell from '../shared/ModalShell';

/**
 * EditPlaylistModal — édition du titre + de la description d'une playlist,
 * sur le modèle de `EditRoutineModal.jsx` (même gabarit de fenêtre :
 * overlay `fixed inset-0`, carte `rounded-3xl`, en-tête icône+titre+croix,
 * pied de page 2 boutons pleine largeur).
 *
 * REMPLACE l'édition INLINE qui vivait directement dans
 * `PlaylistHeaderTitleBlock.jsx` (retour direct, captures à l'appui : "le
 * mode édition inline crée un layout shift désagréable qui décale les
 * stats/boutons vers le bas — remplacer par une modale dédiée, standardiser
 * l'UX comme `EditRoutineModal.jsx`"). Le crayon (`PlaylistHeaderTitleBlock.jsx`)
 * n'ouvre donc plus un formulaire À LA PLACE du titre — il appelle
 * `handleOpenEditPlaylistModal()`, qui préremplit le brouillon et ouvre
 * CETTE modale par-dessus toute la page, sans jamais décaler la mise en
 * page de la carte d'en-tête.
 *
 * État d'ouverture ET brouillon (`editedPlaylistName`/
 * `editedPlaylistDescription`) possédés par `PlaylistEditContext.jsx`, pas
 * ici — même schéma que `CustomActivityModal.jsx`/`useCustomActivityContext()` :
 * ce composant reste "dumb", lit tout via `usePlaylistEdit()`, ne reçoit que
 * `theme` en prop (seule dépendance externe, comme pour toutes les modales
 * extraites de ce projet). `isEditPlaylistModalOpen` est dérivé de
 * `activeModal === 'EDIT_PLAYLIST'` (ModalContext) DANS ce Contexte —
 * jamais reçu en prop générique depuis un container (voir
 * `ModalContainer.jsx` pour la même convention appliquée à
 * `EditRoutineModal.jsx`/`useRoutines.js`).
 *
 * Montée dans `PlaylistDetailView.jsx`, à l'intérieur de
 * `<PlaylistEditProvider>` (pas dans `ModalContainer.jsx`, monté
 * GLOBALEMENT et donc sans accès à ce Contexte, scopé à la vue détail
 * d'une playlist) — même logique de placement que `CustomActivityModal.jsx`
 * dans `App.jsx`.
 *
 * Logique de sauvegarde ENTIÈREMENT dans `handleSavePlaylistDetails`
 * (PlaylistEditContext.jsx) — ce composant n'écrit jamais directement dans
 * `currentPlaylist`/`savedPlaylists`. Une fois la sauvegarde faite, ce
 * handler ferme lui-même la modale (`closeModal()`), donc rien à faire ici
 * après l'appel.
 *
 * ⚠️ VALIDATION DU TITRE (même session, retour direct) — `isEditedNameValid`
 * (PlaylistEditContext.jsx) désactive "Enregistrer" (`disabled`, même
 * pattern que `EditRoutineModal.jsx` sur cible invalide) tant que le titre
 * fait moins de `MIN_PLAYLIST_NAME_LENGTH` caractères une fois les espaces
 * retirés — message d'erreur affiché sous le champ dans ce cas. La
 * DESCRIPTION reste sans aucune contrainte de longueur minimale.
 */
export default function EditPlaylistModal({ theme }) {
  const { cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;
  const {
    isEditPlaylistModalOpen, closeEditPlaylistModal,
    editedPlaylistName, setEditedPlaylistName,
    editedPlaylistDescription, setEditedPlaylistDescription,
    isEditedNameValid,
    handleSavePlaylistDetails,
  } = usePlaylistEdit();

  if (!isEditPlaylistModalOpen) return null;

  return (
    <ModalShell onClose={closeEditPlaylistModal} theme={theme} maxWidth="max-w-lg" cardClassName="p-6 md:p-8 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <Edit3 className={textColorClass}/>
            <span>Modifier la playlist</span>
          </h3>
          <button onClick={closeEditPlaylistModal} className={`p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors ${ICON_BUTTON_ROUNDING} hover:bg-surface-hover`}><X size={20}/></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className={`text-sm font-bold ${textMuted} block mb-2`}>Titre</label>
            {/* Entrée valide (comme l'ancienne édition inline) — Échap
                N'EST PAS géré ici : aucune modale de ce projet ne ferme sur
                Échap (voir SearchModal.jsx, seul autre usage d'Échap dans
                ce dossier, et pour un tout autre besoin), le clic sur la
                croix ou en dehors de la carte suffit déjà.
                `handleSavePlaylistDetails` revérifie `isEditedNameValid` en
                interne (voir PlaylistEditContext.jsx) — Entrée sur un
                titre invalide reste donc un no-op silencieux, cohérent
                avec le bouton "Enregistrer" déjà désactivé juste en
                dessous. */}
            <input
              type="text" autoFocus value={editedPlaylistName}
              onChange={e => setEditedPlaylistName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlaylistDetails(); }}
              className={`w-full rounded-xl px-4 py-3 font-bold outline-hidden border ${inputBg} ${!isEditedNameValid ? 'border-red-500' : inputBorder} ${textHighlight}`}
              placeholder="Nom de la playlist"
            />
            {!isEditedNameValid && (
              <p className="text-xs text-red-400 mt-1.5">Le titre doit contenir au moins 3 caractères.</p>
            )}
          </div>

          <div>
            <label className={`text-sm font-bold ${textMuted} block mb-2`}>Description</label>
            {/* Pas de gestion `Enter` ici (contrairement au champ titre
                juste au-dessus) — Entrée dans une `<textarea>` insère un
                retour à la ligne, comportement natif attendu pour un
                texte multi-lignes, jamais une soumission prématurée.
                Aucune validation de longueur minimale ici (contrairement
                au titre) — champ optionnel, n'importe quel contenu est
                valide, y compris vide. */}
            <textarea
              value={editedPlaylistDescription}
              onChange={e => setEditedPlaylistDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              placeholder="Ajoute une description (visible si cette playlist devient publique)..."
              rows={3}
              className={`w-full text-sm rounded-xl px-4 py-3 outline-hidden border resize-none ${inputBg} ${inputBorder} ${textHighlight}`}
            />
            <span className={`text-xs ${textMuted} block text-right mt-1`}>{editedPlaylistDescription.length}/{MAX_DESCRIPTION_LENGTH}</span>
          </div>
        </div>

        <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={closeEditPlaylistModal}
            className={`flex-1 py-3.5 rounded-xl font-bold border-2 ${cardBorder} ${textHighlight} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}
          >
            Annuler
          </button>
          <button
            onClick={handleSavePlaylistDetails}
            disabled={!isEditedNameValid}
            title={!isEditedNameValid ? 'Le titre doit contenir au moins 3 caractères.' : undefined}
            className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100`}
          >
            Enregistrer
          </button>
        </div>
    </ModalShell>
  );
}
