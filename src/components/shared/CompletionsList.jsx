import { Upload, X } from 'lucide-react';
import { formatCompletionDate } from '../../utils/format';

/**
 * CompletionsList — liste interactive des dates de complétion d'une playlist :
 * utilisée par PlaylistCard ("Mes Séances", les 3 sections) et PlaylistHeader (liste
 * détaillée sous la date principale). Chaque date : clic pour modifier (ouvre un vrai
 * sélecteur), icône Upload pour rattacher un export Garmin/Strava à CETTE date précise,
 * croix pour retirer.
 *
 * Extrait d'App.jsx (chantier "réduire le God Component", 25/07) : c'était
 * `renderCompletionsList`, une fonction interne à AppContent retournant du JSX,
 * transmise en prop sur 2 niveaux (App → PlaylistsView/PlaylistDetailView →
 * PlaylistCard/PlaylistHeader). Devenue un vrai composant, avec `formatCompletionDate`
 * importé directement (fonction pure, voir utils/format.js) plutôt que reçu en prop.
 * Comportement et classes CSS strictement identiques à l'original.
 *
 * `hideUploadForDate` (optionnel, `null` par défaut) : l'appelant indique QUELLE date
 * est déjà couverte par un CTA d'import plus visible ailleurs sur l'écran (le gros
 * bouton "Complète ta séance" de PlaylistDetailView, qui cible toujours la complétion
 * la plus récente) ; seule l'icône d'import de CETTE date-là disparaît ici (date +
 * bouton "retirer" restent, pour garder la cohérence visuelle de la pastille).
 *
 * `skipDates` (optionnel, tableau vide par défaut) : dates à ne PAS afficher DU TOUT —
 * sert à exclure `completions[0]` côté PlaylistHeader, déjà montrée par
 * <TopCompletionDate/> juste au-dessus, pour ne pas la répéter une 2e fois.
 *
 * `editingCompletion`/`setEditingCompletion` : état d'édition possédé par le parent
 * (App.jsx) et PARTAGÉ avec <TopCompletionDate/> — une seule date éditable à la fois,
 * tous playlists ET tous composants confondus.
 *
 * `isReadOnly` (Feature Sociale — Consultation/Clonage, 01/08) — même principe et même
 * raisonnement EXACTS que TopCompletionDate.jsx (voir sa docstring) : `false` par
 * défaut, aucun appelant existant n'a besoin de le préciser. Sur une playlist étrangère
 * en aperçu, chaque date redevient du texte simple — ni bouton "modifier", ni icône
 * d'import Garmin/Strava, ni croix "retirer" : ces 3 actions écriraient sur
 * l'HISTOIRE du propriétaire d'origine, jamais sur celle du visiteur.
 */
export default function CompletionsList({
  playlist, hideUploadForDate = null, skipDates = [],
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate, triggerCSVUpload,
  theme, isReadOnly = false,
}) {
  const { inputBg, inputBorder, borderAccentClass, textHighlight } = theme;
  const completions = (playlist.completions || []).filter(iso => !skipDates.includes(iso));
  const dataByDate = playlist.actualDataByDate || {};

  if (isReadOnly) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {completions.map((iso) => (
          <span key={iso} className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${inputBg} border ${inputBorder} ${textHighlight}`}>
            {formatCompletionDate(iso)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center gap-1.5">
      {completions.map((iso) => {
        const isEditing = editingCompletion && editingCompletion.playlistId === playlist.id && editingCompletion.isoDate === iso;
        const hasData = !!dataByDate[iso];
        return isEditing ? (
          <input
            key={iso} type="date" autoFocus defaultValue={iso}
            onBlur={(e) => { editCompletionDate(playlist.id, iso, e.target.value); setEditingCompletion(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCompletion(null); }}
            className={`px-2 py-1 rounded-lg text-xs font-bold ${inputBg} border ${borderAccentClass} ${textHighlight}`}
          />
        ) : (
          <span key={iso} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${inputBg} border ${inputBorder} ${textHighlight}`}>
            <button onClick={() => setEditingCompletion({ playlistId: playlist.id, isoDate: iso })} className="hover:underline" title="Modifier cette date">
              {formatCompletionDate(iso)}
            </button>
            {/* Import Garmin/Strava rattaché à CETTE séance précise (pas à toute la
                playlist) — une playlist refaite plusieurs fois peut donc avoir une
                analyse Cible vs Réalité différente pour chaque date. Absent si
                `hideUploadForDate` couvre déjà cette date (voir plus haut). */}
            {iso !== hideUploadForDate && (
              <button
                onClick={(e) => triggerCSVUpload(e, playlist, iso)}
                className={hasData ? "text-purple-500 hover:text-purple-600 transition-colors" : "text-gray-400 hover:text-blue-500 transition-colors"}
                title={hasData ? "Données déjà importées — cliquer pour remplacer" : "Importer Garmin/Strava (cadence/FC)"}
              >
                <Upload size={12}/>
              </button>
            )}
            <button onClick={() => removeCompletionDate(playlist.id, iso)} className="text-gray-400 hover:text-red-500 transition-colors" title="Retirer cette date">
              <X size={12}/>
            </button>
          </span>
        );
      })}
    </div>
  );
}
