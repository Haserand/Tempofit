import { Lock, Globe, Trash2 } from 'lucide-react';

/**
 * PlaylistHeaderBadges.jsx — les 3 éléments qui flottent en overlay
 * absolu au-dessus de la carte d'en-tête (jamais dans le flux normal) :
 * médaille de rang (coin haut-droit, en dehors de la carte), badge
 * "Lecture seule" (coin haut-droit, à l'intérieur), boutons icône seule
 * publique/privée + retirer (même coin, juste en dessous). Extrait de
 * `PlaylistHeader.jsx` (chantier découpage, 08/08) — voir ce fichier pour
 * le raisonnement complet sur pourquoi ces 3 éléments coexistent au même
 * coin sans jamais se chevaucher (offsets différents, `isSaved`/
 * `!isSaved` mutuellement exclusifs sur médaille+lecture-seule).
 *
 * Rendu en `<>...</>` (fragment) — ces 3 blocs sont des ENFANTS DIRECTS
 * du conteneur `relative` de `PlaylistHeader.jsx`, pas un wrapper imbriqué
 * (chacun se positionne en `absolute` par rapport à CE conteneur externe,
 * pas par rapport à un div propre à ce composant).
 */
export default function PlaylistHeaderBadges({
  currentPlaylist, currentPlaylistRank, currentPlaylistRankStyle,
  isSaved, isReadOnly, handleTogglePlaylistPublic, handleUnsavePlaylist,
}) {
  return (
    <>
      {currentPlaylistRankStyle && (
        <span
          className="absolute -top-2 -right-2 text-xl z-10"
          title={`${currentPlaylist.completions.length} fois — la ${currentPlaylistRank === 0 ? 'plus' : currentPlaylistRank === 1 ? '2e plus' : '3e plus'} utilisée`}
        >
          {currentPlaylistRankStyle.emoji}
        </span>
      )}

      {/* Badge "Lecture seule" — jamais affiché en même temps que la
          médaille ci-dessus (un rang suppose des complétions, donc une
          playlist déjà sauvegardée). Icône seule + `title` natif du
          navigateur pour l'explication complète au survol. */}
      {!isSaved && (
        <span
          title="Lecture seule — tu ne peux pas modifier cette playlist tant qu'elle n'est pas ajoutée à Mes Séances"
          className="absolute top-4 right-4 bg-slate-800/80 border border-slate-700 text-slate-300 p-2 rounded-full flex items-center justify-center z-10"
        >
          <Lock size={12} />
        </span>
      )}

      {/* Rendre publique/privée (Globe) PUIS Retirer (Trash2), même ordre
          que PlaylistCard.jsx ("Mes Séances" en carte). Fond au SURVOL
          uniquement (contrairement au badge "Lecture seule" ci-dessus,
          volontairement toujours visible — un STATUT à signaler
          passivement, pas la même famille que ces 2 actions). */}
      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        {isSaved && !isReadOnly && (
          <button
            onClick={handleTogglePlaylistPublic}
            title={currentPlaylist.isPublic ? "Visible sur ton profil public — clique pour la rendre privée" : "Rendre cette playlist visible sur ton profil public"}
            className={`p-2 rounded-full flex items-center justify-center transition-colors ${
              currentPlaylist.isPublic
                ? 'text-emerald-400 hover:bg-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
          >
            <Globe size={14} />
          </button>
        )}
        {isSaved && !isReadOnly && (
          <button
            onClick={handleUnsavePlaylist}
            title="Retirer cette séance de 'Mes Séances'"
            className="p-2 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </>
  );
}
