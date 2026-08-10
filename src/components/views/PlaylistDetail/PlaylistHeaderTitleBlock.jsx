import { Edit3, Copy } from 'lucide-react';
import { getActivityEmoji } from '../../../appConfig';
import { usePlaylistEdit } from '../../../contexts/PlaylistEditContext';

/**
 * PlaylistHeaderTitleBlock.jsx — ligne "chapeau" (pseudo cliquable +
 * compteur de clonages) suivie du titre + description de la playlist.
 * Extrait de `PlaylistHeader.jsx` (chantier découpage, 08/08) —
 * `ownerLabel`/`ownerProfileUsername` restent calculés/possédés par le
 * parent (`PlaylistHeader.jsx`/`usePlaylistDetail()`), ce composant reste
 * "dumb", uniquement du rendu.
 *
 * Compteur de clonages gaté sur `currentPlaylist.cloneCount !== undefined`
 * (PAS `isReadOnly` seul — un template ouvert DIRECTEMENT depuis Découvrir
 * reçoit un `cloneCount` réel sans `isReadOnly: true` à côté, voir
 * README) — TOUJOURS affiché même à 0, mêmes icône/gabarit que
 * `TemplateCard.jsx`.
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
 * `handleOpenEditPlaylistModal` vient directement de `usePlaylistEdit()`
 * ICI (08/08, chantier "value non mémoïsée re-render tout le monde à
 * chaque frappe" — voir la docstring de PlaylistEditContext.jsx), PAS reçu
 * en prop depuis `PlaylistHeader.jsx` comme le reste : ce composant n'a
 * plus besoin de re-render pendant une frappe (l'édition vit dans la
 * modale, ailleurs), mais le principe "lire ce Contexte au plus près du
 * composant qui en a besoin, pas le faire remonter par le parent" reste
 * valable — inchangé depuis le découpage initial.
 */
export default function PlaylistHeaderTitleBlock({
  currentPlaylist, isSaved, isReadOnly,
  ownerLabel, ownerProfileUsername, onViewProfile,
}) {
  const { handleOpenEditPlaylistModal } = usePlaylistEdit();

  return (
    <>
      {ownerLabel && (
        <div className="flex items-center gap-2 justify-center md:justify-start text-xs font-bold text-slate-400">
          {ownerProfileUsername && onViewProfile ? (
            <button
              onClick={() => onViewProfile(ownerProfileUsername)}
              title={`Voir le profil de ${ownerLabel}`}
              className="truncate hover:underline hover:text-slate-200 cursor-pointer"
            >
              {ownerLabel}
            </button>
          ) : (
            <span
              title={isSaved ? 'Cette playlist est dans ta bibliothèque' : `Créée par ${ownerLabel}`}
              className="truncate"
            >
              {ownerLabel}
            </span>
          )}
          {currentPlaylist.cloneCount !== undefined && (
            <>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 shrink-0" title="Nombre de fois où cette playlist a été clonée">
                <Copy size={11} />{currentPlaylist.cloneCount || 0}
              </span>
            </>
          )}
        </div>
      )}

      <h2 className="text-xl font-bold flex items-center gap-3 justify-center md:justify-start text-white">
        <span className="truncate min-w-0" title={currentPlaylist.name}>{getActivityEmoji(currentPlaylist.workoutType)} {currentPlaylist.name}</span>
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
          <p className="whitespace-pre-line line-clamp-1 flex-1 min-w-0">{currentPlaylist.description}</p>
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
