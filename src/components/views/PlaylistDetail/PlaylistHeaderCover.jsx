import { Music2, Play } from 'lucide-react';
import { buildCoverUrl } from '../../../utils/coverArt';

/**
 * PlaylistHeaderCover.jsx — pochette de `PlaylistHeader.jsx`, cliquable
 * (lance la playlist, 1er titre + enchaînement automatique). Extrait de
 * `PlaylistHeader.jsx` (chantier découpage, 08/08).
 *
 * `<span>` (pas un 2e `<button>`) pour l'icône play au survol : la
 * pochette EST déjà un bouton, imbriquer un bouton dans un bouton serait
 * du HTML invalide.
 */
export default function PlaylistHeaderCover({
  currentPlaylist, bgAccentClass, resolveAndTogglePreview, getNextTrackForAutoAdvance,
}) {
  return (
    <div className="relative group/cover shrink-0 mx-auto md:mx-0">
      <button
        onClick={() => currentPlaylist.tracks[0] && resolveAndTogglePreview(currentPlaylist.tracks[0], getNextTrackForAutoAdvance)}
        title="Écouter cette playlist"
        className="relative w-32 h-32 rounded-xl overflow-hidden shadow-2xl shadow-black/70 cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
      >
        {/* Même logique de pochette que PlaylistCard.jsx (Mes Séances) :
            `coverUrl` si déjà posé (playlists ouvertes depuis Découvrir),
            sinon `buildCoverUrl(currentPlaylist.name)` (déterministe). */}
        <img src={currentPlaylist.coverUrl || buildCoverUrl(currentPlaylist.name)} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Music2 size={56} className="text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-opacity duration-300 group-hover/cover:opacity-0" />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/30 transition-colors flex items-center justify-center">
          <span className={`w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 scale-95 group-hover/cover:opacity-100 group-hover/cover:scale-100 transition-all duration-300 ${bgAccentClass}`}>
            <Play size={22} className="fill-white ml-0.5"/>
          </span>
        </div>
      </button>
    </div>
  );
}
