import { Plus, Lock } from 'lucide-react';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';
import TrackItem from './TrackItem';

/**
 * TrackList.jsx — carte "liste des musiques" de PlaylistDetailView, chantier
 * découpage (suite de GeneratorContext/AudioPlayerContext/PlaylistDetailContext,
 * l'occasion prise en même temps que la refonte "Coaching" de TrackItem).
 *
 * Ne prend PAS 0 prop : contrairement à GeneratorView/CustomActivityModal
 * (où tout le state déplacé était exclusif à la vue), une partie de ce qui
 * entoure la liste est PARTAGÉE avec des blocs qui restent dans
 * PlaylistDetailView.jsx pour l'instant (les 2 camemberts de répartition, le
 * bouton "Écouter" de l'en-tête, la recherche globale) — même principe que
 * documenté dans PlaylistDetailContext.jsx : recevoir en prop une donnée dont
 * la source de vérité vit ailleurs, jamais la recréer ici. Concrètement :
 * - `hasDetailFilter`/`trackMatchesDetailFilter`/`selectedDetailGenre`/
 *   `selectedDetailBpmBucket` (+ setters) : pilotés par un clic sur une part
 *   des camemberts, plus bas dans PlaylistDetailView.jsx — cette liste ne
 *   fait que LIRE ce filtre pour se mettre en surbrillance/reset, jamais le
 *   posséder.
 * - `isBpmChartUsingRealProfile` : détermine si "BPM" doit être suffixé au
 *   libellé du bandeau de filtre — calculé une fois dans PlaylistDetailView
 *   à partir du profil athlétique, pas la peine de le recalculer ici.
 * - `favorites`/`toggleTrackFavorite`/`toggleArtistFavorite` : le bouton
 *   "Écouter" de l'en-tête de la vue ne les utilise pas, mais `favorites`
 *   sert aussi à la popup du graphique BPM (segment sélectionné) — instance
 *   unique, reçue en prop.
 * - `resolveAndTogglePreview`/`getNextTrackForAutoAdvance` : partagés avec le
 *   bouton "Écouter toute la séance" de l'en-tête ET la popup du graphique.
 * - `isLocked` : réutilisé à plusieurs endroits de PlaylistDetailView (verrou
 *   du graphique, CTA planification...), pas exclusif à la liste.
 * - `setIsBpmSearchMode`/`setIsSearchModalOpen` : infra de recherche globale
 *   (App.jsx), jamais possédée par une vue en particulier.
 *
 * Tout le reste (tracks, drag-and-drop, menu par titre, mutations,
 * lecture) vient de usePlaylistDetail() — ici pour `currentPlaylist.tracks`
 * et le rendu de la liste, et directement dans TrackItem pour le reste
 * (voir TrackItem.jsx).
 */
export default function TrackList(props) {
  // DIAGNOSTIC TEMPORAIRE (bug "page blanche" en cours d'investigation) —
  // même mécanisme que TrackItem.jsx, à retirer une fois corrigé.
  try {
    return TrackListInner(props);
  } catch (e) {
    throw new Error(`[TrackList] erreur d'origine: ${e.message}`);
  }
}

function TrackListInner({
  theme, isLocked,
  favorites, toggleTrackFavorite, toggleArtistFavorite,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  setIsBpmSearchMode, setIsSearchModalOpen,
  hasDetailFilter, trackMatchesDetailFilter,
  selectedDetailGenre, selectedDetailBpmBucket, setSelectedDetailGenre, setSelectedDetailBpmBucket,
  isBpmChartUsingRealProfile,
}) {
  const { cardBg, cardBorder, textMuted, textHighlight, textColorClass, inputBorder } = theme;
  const { currentPlaylist } = usePlaylistDetail();

  return (
    <div className={"rounded-3xl border overflow-hidden shadow-md " + cardBg + " " + cardBorder}>
      {/* Bandeau de filtre actif — apparaît uniquement après un clic sur une
          part d'un des 2 camemberts plus bas (voir selectedDetailGenre/
          selectedDetailBpmBucket, possédés par PlaylistDetailView) : indique
          clairement quel filtre est appliqué à la liste, avec un moyen
          explicite de le lever plutôt que de devoir re-cliquer la part
          exacte dans le graphique. */}
      {hasDetailFilter && (
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold border-b ${cardBorder} bg-black/5 dark:bg-white/5 ${textHighlight}`}>
          <span>
            Titres associés
            {selectedDetailGenre.size > 0 && <> · <span className={textColorClass}>{[...selectedDetailGenre].join(', ')}</span></>}
            {selectedDetailBpmBucket.size > 0 && <> · <span className={textColorClass}>{[...selectedDetailBpmBucket].join(', ')}{!isBpmChartUsingRealProfile ? ' BPM' : ''}</span></>}
          </span>
          <button onClick={() => { setSelectedDetailGenre(new Set()); setSelectedDetailBpmBucket(new Set()); }} className={`underline ${textMuted} hover:text-main`}>
            Réinitialiser
          </button>
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
        {currentPlaylist.tracks.map((track, index) => (
          <TrackItem
            key={track.id}
            track={track} index={index}
            theme={theme} isLocked={isLocked}
            favorites={favorites} toggleTrackFavorite={toggleTrackFavorite} toggleArtistFavorite={toggleArtistFavorite}
            resolveAndTogglePreview={resolveAndTogglePreview} getNextTrackForAutoAdvance={getNextTrackForAutoAdvance}
            isDimmed={hasDetailFilter && !trackMatchesDetailFilter(track)}
            isHighlighted={hasDetailFilter && trackMatchesDetailFilter(track)}
          />
        ))}

        {/* BOUTON AJOUT MANUEL — remplacé par un message explicite une fois la
            séance verrouillée (voir isLocked) : ajouter un titre à une
            playlist déjà réalisée changerait rétroactivement ce qui a été
            effectivement écouté. */}
        {isLocked ? (
          <div className={"p-3 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center gap-2 text-xs font-bold " + textMuted}>
            <Lock size={14}/> Séance déjà réalisée — plus aucun titre ne peut être ajouté, dupliqué, remplacé ou retiré
          </div>
        ) : (
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50">
            <button onClick={() => { setIsBpmSearchMode(false); setIsSearchModalOpen(true); }} className={"w-full py-3 flex items-center justify-center gap-2 text-sm font-bold border-2 border-dashed rounded-xl transition-colors hover:border-gray-400 " + inputBorder + " " + textMuted + " hover:" + textHighlight}>
              <Plus size={18} /> <span>Ajouter un titre</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
