import { X, Activity, Clock, Zap, Music, Copy } from 'lucide-react';
import { ICON_BUTTON_ROUNDING } from '../../layout/iconButtonLayout';
import { genreDisplayLabel } from '../../musicCatalog';

/**
 * PublicRoutinePreviewModal — Vague 2, Chantier 1 (UI publique des routines,
 * 02/08). Transposition du mécanisme déjà en prod pour les playlists
 * (`ImportSharedPlaylistModal.jsx`, même schéma exact : aperçu + un seul
 * bouton d'action), PAS une nouvelle vue détail dédiée aux routines.
 *
 * Une routine n'a pas de page détail comme une playlist (`RoutinesView.jsx`
 * n'est qu'une grille de cartes, jamais de route par item) — cliquer sur la
 * carte d'une routine publique depuis `ProfileView.jsx` ouvre donc cette
 * modale légère plutôt qu'une navigation vers une page qui n'existe pas.
 * `handleOpenPublicRoutine` (App.jsx) court-circuite déjà le cas "je
 * consulte ma PROPRE routine publique depuis mon propre profil" avant
 * d'ouvrir cette modale — jamais besoin ici de distinguer visiteur/
 * propriétaire, `routine` est toujours celle de QUELQU'UN D'AUTRE.
 *
 * `routine` est la LIGNE brute de la table `routines` (voir
 * supabase-schema.sql, `content` porte la config complète) — déjà en
 * mémoire côté ProfileView.jsx (pas de 2e fetch nécessaire, même principe
 * que `handleOpenPublicPlaylist`).
 */
export default function PublicRoutinePreviewModal({ theme, isOpen, onClose, routine, onClone }) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

  if (!isOpen || !routine) return null;

  const content = routine.content || {};
  const distanceOrDuration = content.targetMode === 'distance'
    ? `${content.distanceVal} ${content.distanceUnit}`
    : `${content.hours || 0}h ${content.minutes || 0}m`;
  const genres = content.selectedGenres && content.selectedGenres.length > 0 ? content.selectedGenres : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <Copy className={textColorClass} />
            <span>Routine publique</span>
          </h3>
          <button onClick={onClose} className={`p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors ${ICON_BUTTON_ROUNDING} hover:bg-surface-hover`}><X size={20} /></button>
        </div>
        {/* Message raccourci (07/08, retour direct : "tienne en 2 lignes
            max" — capture à l'appui montrant 3 lignes) — même idée que
            l'ancien texte (routine partagée, clonage = copie indépendante,
            jamais de modification de l'originale), condensée. Inspiré du
            ton/de la longueur du message équivalent côté playlists
            (`ImportSharedPlaylistModal.jsx`, nettement plus court) plutôt
            que d'inventer un style différent pour une modale au même
            rôle. */}
        <p className={`text-sm mb-4 ${textMuted}`}>Routine partagée publiquement — clone-la dans tes Routines pour la relancer à ta façon, sans y toucher.</p>

        <div className={`p-4 rounded-2xl border ${inputBorder} ${inputBg} mb-4`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{content.coverIcon || '⚡'}</span>
            <div className="min-w-0">
              <h4 className={`font-bold truncate ${textHighlight}`} title={content.name || 'Routine'}>{content.name || 'Routine'}</h4>
              <p className={`text-xs truncate ${textMuted}`} title={`${content.workoutType}${content.customActivity ? ` (${content.customActivity})` : ''}`}>{content.workoutType}{content.customActivity ? ` (${content.customActivity})` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
            <span className={`flex items-center gap-1 ${textMuted}`}><Activity size={13} /> {content.workoutType}</span>
            <span className={`flex items-center gap-1 ${textMuted}`}><Clock size={13} /> {distanceOrDuration}</span>
            <span className={`flex items-center gap-1 ${textMuted}`}>
              <Zap size={13} />
              {content.isCrescendoMode ? 'Crescendo (3 phases)' : (content.isIntervalMode ? `${(content.segments || []).length} phases` : `${content.bpm} BPM`)}
            </span>
            {genres.length > 0 && (
              <span className={`flex items-center gap-1 ${textMuted}`}><Music size={13} /> {genres.map(genreDisplayLabel).join(', ')}</span>
            )}
          </div>
          {/* Affichage de la description RETIRÉ (08/08, retour direct :
              "finalement pas emballé par la fonctionnalité description sur
              les routines... on conserve juste pour les playlists") —
              vivait ici, voir RoutinesView.jsx pour l'historique complet
              du chantier retiré (édition, affichage public, vitrine). */}
        </div>

        <button
          onClick={() => onClone(routine)}
          className={`w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 ${bgAccentClass}`}
        >
          <Copy size={18} /> Cloner dans mes Routines
        </button>
        <button onClick={onClose} className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors`}>
          Fermer
        </button>
      </div>
    </div>
  );
}
