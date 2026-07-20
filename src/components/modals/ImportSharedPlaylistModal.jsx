import { X, Music2, Clock, Activity, Download } from 'lucide-react';
import { formatDuration } from '../../utils/format';

/**
 * ImportSharedPlaylistModal — s'ouvre automatiquement quand l'app détecte un
 * paramètre `?import=...` dans l'URL au chargement (voir App.jsx, et
 * playlistShareCode.js pour le décodage). Alternative légère à un feed
 * communautaire complet (voir la discussion qui a mené à ce chantier) : un
 * partage point-à-point, sans liste publique ni vote ni modération.
 *
 * `preview` est le payload DÉCODÉ (voir playlistShareCode.js), pas encore
 * une vraie playlist de l'app — `onImport` (App.jsx) se charge de la
 * transformer en playlist complète et de l'ajouter à "Mes Séances".
 */
export default function ImportSharedPlaylistModal({ theme, isOpen, onClose, preview, onImport }) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

  if (!isOpen || !preview) return null;

  const totalDuration = preview.tracks.reduce((s, t) => s + (t.du || 0), 0);
  const bpmValues = preview.tracks.map(t => t.bp).filter(Boolean);
  const avgBpm = bpmValues.length > 0 ? Math.round(bpmValues.reduce((s, b) => s + b, 0) / bpmValues.length) : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <Download className={textColorClass}/>
            <span>Playlist partagée</span>
          </h3>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>
        <p className={`text-sm mb-4 ${textMuted}`}>Quelqu'un t'a partagé cette séance TempoFit — tu peux l'ajouter à tes propres Séances avant de la lancer.</p>

        <div className={`p-4 rounded-2xl border ${inputBorder} ${inputBg} mb-4`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{preview.coverIcon}</span>
            <div className="min-w-0">
              <h4 className={`font-bold truncate ${textHighlight}`}>{preview.name}</h4>
              <p className={`text-xs truncate ${textMuted}`}>{preview.workoutType}</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs font-bold">
            <span className={`flex items-center gap-1 ${textMuted}`}><Clock size={13}/> {formatDuration(totalDuration)}</span>
            <span className={`flex items-center gap-1 ${textMuted}`}><Music2 size={13}/> {preview.tracks.length} titres</span>
            {avgBpm && <span className={`flex items-center gap-1 ${textMuted}`}><Activity size={13}/> ~{avgBpm} BPM</span>}
          </div>
        </div>

        <button
          onClick={onImport}
          className={`w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 ${bgAccentClass}`}
        >
          <Download size={18}/> Ajouter à Mes Séances
        </button>
        <button onClick={onClose} className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors`}>
          Ignorer
        </button>
      </div>
    </div>
  );
}
