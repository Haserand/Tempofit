import { Edit3, Copy } from 'lucide-react';
import { getActivityEmoji, MAX_DESCRIPTION_LENGTH } from '../../../appConfig';

/**
 * PlaylistHeaderTitleBlock.jsx — ligne "chapeau" (pseudo cliquable +
 * compteur de clonages) suivie du titre + description de la playlist
 * (édition FUSIONNÉE, un seul crayon ouvre les 2 champs ensemble — voir
 * `PlaylistDetailContext.jsx`/README pour le raisonnement complet du
 * chantier du 08/08). Extrait de `PlaylistHeader.jsx` (chantier découpage,
 * même jour) — `ownerLabel`/`ownerProfileUsername`/tout l'état d'édition
 * restent calculés/possédés par le parent (`PlaylistHeader.jsx`/
 * `usePlaylistDetail()`), ce composant reste "dumb", uniquement du rendu.
 *
 * Compteur de clonages gaté sur `currentPlaylist.cloneCount !== undefined`
 * (PAS `isReadOnly` seul — un template ouvert DIRECTEMENT depuis Découvrir
 * reçoit un `cloneCount` réel sans `isReadOnly: true` à côté, voir
 * README) — TOUJOURS affiché même à 0, mêmes icône/gabarit que
 * `TemplateCard.jsx`.
 */
export default function PlaylistHeaderTitleBlock({
  currentPlaylist, isSaved, isReadOnly,
  ownerLabel, ownerProfileUsername, onViewProfile,
  isEditingPlaylistDetails, setIsEditingPlaylistDetails,
  editedPlaylistName, setEditedPlaylistName,
  editedPlaylistDescription, setEditedPlaylistDescription,
  handleSavePlaylistDetails,
}) {
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

      {isEditingPlaylistDetails ? (
        <div className="w-full space-y-2">
          <input
            type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlaylistDetails(); if (e.key === 'Escape') setIsEditingPlaylistDetails(false); }}
            className="text-xl font-bold bg-transparent outline-hidden border-b-2 border-rose-500 text-white w-full"
          />
          {/* Pas de gestion `Enter` ici (contrairement au champ nom
              juste au-dessus) — Entrée dans une `<textarea>` insère un
              retour à la ligne, comportement natif attendu pour un
              texte multi-lignes, jamais une soumission prématurée. */}
          <textarea
            value={editedPlaylistDescription}
            onChange={e => setEditedPlaylistDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsEditingPlaylistDetails(false); }}
            placeholder="Ajoute une description (visible si cette playlist devient publique)..."
            rows={2}
            className="w-full text-sm bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 outline-hidden text-slate-200 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{editedPlaylistDescription.length}/{MAX_DESCRIPTION_LENGTH}</span>
            <div className="flex gap-2">
              <button onClick={() => setIsEditingPlaylistDetails(false)} className="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors">Annuler</button>
              <button onClick={handleSavePlaylistDetails} className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold flex items-center gap-3 justify-center md:justify-start text-white">
            <span className="truncate min-w-0" title={currentPlaylist.name}>{getActivityEmoji(currentPlaylist.workoutType)} {currentPlaylist.name}</span>
            {/* Éditer n'a de sens que pour une playlist déjà dans la
                bibliothèque personnelle (`isSaved`) — sur un modèle pas
                encore sauvegardé, le nom/la description affichés sont
                ceux du modèle d'origine, pas encore "à soi". */}
            {isSaved && !isReadOnly && (
              <button
                onClick={() => {
                  setEditedPlaylistName(currentPlaylist.name);
                  setEditedPlaylistDescription(currentPlaylist.description || '');
                  setIsEditingPlaylistDetails(true);
                }}
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
      )}
    </>
  );
}
