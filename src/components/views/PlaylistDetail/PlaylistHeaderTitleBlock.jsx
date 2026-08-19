import { Edit3 } from 'lucide-react';
import { usePlaylistEditActions } from '../../../contexts/PlaylistEditContext';

/**
 * PlaylistHeaderTitleBlock.jsx — titre + description de la playlist.
 * Extrait de `PlaylistHeader.jsx` (chantier découpage, 08/08) — ce
 * composant reste "dumb", uniquement du rendu.
 *
 * ⚠️ RETIRÉ (10/08, retour direct avec capture d'écran — "supprimer la
 * ligne pseudo/compteur de clonages au-dessus du titre pour épurer le
 * design, l'intégrer comme première info de la ligne de métadonnées à la
 * place") : la ligne "pseudo cliquable + compteur de clonages" qui vivait
 * ici a été DÉPLACÉE dans `PlaylistHeaderMeta.jsx` (première info de la
 * ligne d'infos, icône `User` + séparateur "•" avant "Course à pied"),
 * PAS supprimée — `ownerLabel`/`ownerProfileUsername`/`onViewProfile` ne
 * sont donc plus reçus en props ICI, uniquement par `PlaylistHeaderMeta.jsx`
 * désormais (voir sa docstring pour le détail complet, y compris le
 * compteur de clonages qui a suivi le pseudo au même endroit).
 *
 * ⚠️ ÉDITION PASSÉE EN MODALE (retour direct, captures à l'appui : "l'édition
 * inline crée un layout shift désagréable qui décale les stats/boutons vers
 * le bas — remplacer par une modale dédiée"). Ce composant NE CONTIENT PLUS
 * aucun formulaire d'édition — le crayon appelle `handleOpenEditPlaylistModal()`
 * (`usePlaylistEdit()`), qui préremplit le brouillon ET ouvre
 * `EditPlaylistModal.jsx` (montée dans `PlaylistDetailView.jsx`) via
 * `ModalContext`. Toute la logique de sauvegarde (auparavant ici, dans le
 * formulaire inline) vit maintenant DANS la modale — voir sa docstring. Ce
 * composant reste volontairement "dumb" : un seul appel, aucun état
 * d'édition à gérer lui-même.
 *
 * `handleOpenEditPlaylistModal` vient directement de
 * `usePlaylistEditActions()` ICI (08/08, chantier "value non mémoïsée
 * re-render tout le monde à chaque frappe" — voir la docstring de
 * PlaylistEditContext.jsx), PAS reçu en prop depuis `PlaylistHeader.jsx`
 * comme le reste : ce composant n'a plus besoin de re-render pendant une
 * frappe (l'édition vit dans la modale, ailleurs), mais le principe "lire
 * ce Contexte au plus près du composant qui en a besoin, pas le faire
 * remonter par le parent" reste valable — inchangé depuis le découpage
 * initial.
 * ⚠️ `usePlaylistEditActions()`, PAS `usePlaylistEdit()` (10/08, check-up
 * — corrigé) : ce composant lisait auparavant `usePlaylistEdit()`, le
 * Contexte VOLATIL qui porte aussi `editedPlaylistName`/
 * `editedPlaylistDescription` (changent à chaque frappe dans
 * `EditPlaylistModal.jsx`) — un Contexte unique re-rend TOUS ses
 * consommateurs dès que N'IMPORTE QUEL champ de sa `value` change, donc ce
 * composant re-rendait bien à chaque frappe malgré ce que disait cette
 * docstring avant correction. `usePlaylistEditActions()` isole la SEULE
 * chose dont ce composant a besoin (`handleOpenEditPlaylistModal`,
 * stabilisée par `useCallback`) dans son propre Contexte, dont la `value`
 * ne change jamais pendant l'édition — voir PlaylistEditContext.jsx.
 */
export default function PlaylistHeaderTitleBlock({
  currentPlaylist, isSaved, isReadOnly,
}) {
  const { handleOpenEditPlaylistModal } = usePlaylistEditActions();

  return (
    <>
      <h2 className="text-xl font-bold flex items-center gap-3 justify-center md:justify-start text-white">
        {/* ⚠️ Émoji NON dérivé ici (retiré 08/08, chantier "émoji baké en
            texte littéral dans le titre", voir musicEngine.js/useNavigation.js) —
            `currentPlaylist.name` porte déjà l'émoji tel quel pour toute
            playlist créée APRÈS ce changement (texte littéral, éditable
            depuis EditPlaylistModal.jsx) ; le recalculer ici via
            `getActivityEmoji(workoutType)` l'aurait affiché EN DOUBLE.
            Playlists créées AVANT ce changement : n'affichent plus aucun
            émoji désormais (aucune migration rétroactive prévue, voir
            CLAUDE-SANDBOX-VERIFICATION.md). */}
        <span className="truncate min-w-0" title={currentPlaylist.name}>{currentPlaylist.name}</span>
        {/* Éditer n'a de sens que pour une playlist déjà dans la
            bibliothèque personnelle (`isSaved`) — sur un modèle pas
            encore sauvegardé, le nom/la description affichés sont
            ceux du modèle d'origine, pas encore "à soi". */}
        {isSaved && !isReadOnly && (
          <button
            onClick={handleOpenEditPlaylistModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
            title="Modifier le titre et la description"
          >
            <Edit3 size={20}/>
          </button>
        )}
      </h2>
      {/* Description en lecture seule — rendue même pour un visiteur
          (`isReadOnly`) : reste visible sur le profil public, seule
          l'AFFORDANCE d'édition disparaît (crayon plus haut, absent
          si `isReadOnly`). */}
      {currentPlaylist.description ? (
        <div className="flex items-start gap-2 text-sm text-slate-300 max-w-lg">
          {/* `line-clamp-1` : 1 ligne max. `flex-1 min-w-0` : un item
              flex ne descend jamais sous la largeur de son contenu
              par défaut, `line-clamp` n'a alors rien pour s'appuyer
              (même piège documenté dans ViewHeader.jsx). */}
          <p className="whitespace-pre-line line-clamp-1 flex-1 min-w-0" title={currentPlaylist.description}>{currentPlaylist.description}</p>
        </div>
      ) : (
        // Indice discret, NON cliquable — signale que le champ EXISTE
        // sans revenir à un bouton dédié (recréerait la duplication
        // que la fusion des 2 crayons visait justement à éliminer).
        // Jamais de `<button>`/`cursor-pointer`/état hover ici — le
        // crayon du titre reste le SEUL point d'entrée pour éditer.
        isSaved && !isReadOnly && (
          <p className="text-xs text-slate-600 italic">Aucune description</p>
        )
      )}
    </>
  );
}
