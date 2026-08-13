import { Save, CheckCircle, Share2, Calendar, Upload, Gauge, X } from 'lucide-react';

/**
 * PlaylistHeaderActions.jsx — rangée d'actions de `PlaylistHeader.jsx` :
 * import CSV (si applicable), action principale (Sauvegarder/cloner ou
 * Ajouter à Mes Séances), Planifier, Partager, badge BPM/Zone. Extrait de
 * `PlaylistHeader.jsx` (chantier découpage, 08/08) — hiérarchie explicite
 * conservée à l'identique : action PRINCIPALE d'abord (pleine, rose),
 * action secondaire (Partager) juste après, badge BPM poussé à droite
 * (`ml-auto`) dans cette même rangée plutôt qu'un élément flottant à part.
 *
 * `plannedDateInputRef` reste possédé par le parent (`PlaylistHeader.jsx`)
 * — un seul `useRef` par instance de la page, transmis ici tel quel.
 */
export default function PlaylistHeaderActions({
  currentPlaylist, isLocked, isReadOnly, isSaved,
  triggerCSVUpload, removeImportedData, mostRecentCompletionIso, hasImportedDataForMostRecent,
  handleClonePlaylist, handleSavePlaylist,
  setPlaylistPlannedDate, plannedDateInputRef,
  onShare,
  bpmBadgeColor, avgBpm, bpmZone,
}) {
  return (
    <div className="flex items-center flex-wrap justify-center md:justify-start gap-3 mt-auto">
      {isLocked && !isReadOnly && triggerCSVUpload && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => triggerCSVUpload(e, currentPlaylist, mostRecentCompletionIso)}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-sm shrink-0 bg-white text-black shadow-lg transition-transform hover:scale-[1.02] ${hasImportedDataForMostRecent ? '' : 'animate-pulse'}`}
          >
            {hasImportedDataForMostRecent ? (
              <>
                <CheckCircle size={16} className="text-green-500 shrink-0" />
                <span>Données importées</span>
              </>
            ) : (
              <>
                <Upload size={16} className="shrink-0" />
                <span>Importe tes données</span>
              </>
            )}
          </button>
          {/* Retirer les données importées — seule façon de revenir à
              "rien d'importé" sans avoir un fichier de remplacement sous
              la main. Visible UNIQUEMENT si des données existent déjà. */}
          {hasImportedDataForMostRecent && removeImportedData && (
            <button
              onClick={() => removeImportedData(currentPlaylist, mostRecentCompletionIso)}
              title="Retirer les données importées"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Action principale — `isReadOnly` VÉRIFIÉ EN PREMIER (Feature
          Sociale — Consultation/Clonage) : `isSaved` vaut TOUJOURS `false`
          quand `isReadOnly` est vrai, mais le garder en premier ici reste
          plus direct que de compter sur une propriété dérivée, et évite
          la branche "Ajouter à Mes Séances" habituelle qui garderait à
          tort le même id que l'original (voir handleClonePlaylist,
          usePlaylistLibrary.js). */}
      {isReadOnly ? (
        <button
          onClick={handleClonePlaylist}
          title="Sauvegarde une copie personnelle de cette playlist, modifiable, dans 'Mes Séances'."
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm shrink-0 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-colors"
        >
          <Save size={16} /> <span>Sauvegarder dans mes séances</span>
        </button>
      ) : isSaved ? null : (
        <button
          onClick={handleSavePlaylist}
          title="Ajoute cette séance à 'Mes Séances', ton journal de séances (passées et à venir)."
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm shrink-0 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-colors"
        >
          <Save size={16} /> <span>Ajouter à Mes Séances</span>
        </button>
      )}

      {/* Planifier — n'apparaît que si la playlist est déjà sauvegardée. */}
      {isSaved && !isReadOnly && (
        <label
          onClick={(e) => {
            // showPicker() force l'ouverture explicitement là où l'API existe
            // (Chrome/Edge récents) — sans ce filet, le clic pouvait ne
            // simplement rien faire dans certains navigateurs.
            if (plannedDateInputRef.current?.showPicker) {
              e.preventDefault();
              plannedDateInputRef.current.showPicker();
            }
          }}
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors border cursor-pointer bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200 shrink-0"
          title={
            // Une fois la séance déjà réalisée, "planifier" ne peut plus
            // vouloir dire "prévoir sa première fois" — ça ne peut plus
            // être qu'une intention de la refaire plus tard.
            isLocked ? "Refaire cette séance" : "Planifier cette séance"
          }
        >
          <Calendar size={16} />
          <span>{currentPlaylist.plannedDate ? new Date(currentPlaylist.plannedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Planifier'}</span>
          <input
            ref={plannedDateInputRef}
            type="date"
            value={currentPlaylist.plannedDate || ''}
            onChange={(e) => setPlaylistPlannedDate(currentPlaylist.id, e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      )}

      {/* Partager — ShareModal génère déjà l'image en arrière-plan et
          l'inclut directement dans l'aperçu (avec une croix pour la
          retirer) — `onShare` (fourni par le parent) déclenche cette
          génération ET ouvre le menu de partage en un seul clic. */}
      <button
        onClick={onShare}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shrink-0 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        <Share2 size={16} /> <span>Partager</span>
      </button>

      {/* Badge BPM/Zone — `ml-auto` le pousse à droite dans CETTE MÊME
          rangée, jamais un élément flottant isolé ailleurs sur la carte.
          `py-2`/`self-center` (retour direct, capture d'écran — "je veux
          que le bas du badge soit sur la même ligne que celle des
          boutons") : `py-1` (plus petit que les boutons voisins, `py-2`)
          laissait ce badge visuellement plus bas/désaligné malgré
          `items-center` sur le conteneur — même hauteur que
          "Sauvegarder"/"Partager" désormais, `self-center` en plus par
          sécurité si jamais ce conteneur est un jour repris ailleurs avec
          un `items-*` différent. */}
      {bpmBadgeColor && (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border ml-auto self-center"
          style={{ backgroundColor: `${bpmBadgeColor}26`, borderColor: `${bpmBadgeColor}66`, color: bpmBadgeColor }}
        >
          <Gauge size={14} />
          <span>{avgBpm} BPM{bpmZone ? ` • ${bpmZone.shortLabel}` : ''}</span>
        </div>
      )}
    </div>
  );
}
