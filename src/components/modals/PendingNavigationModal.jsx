import { AlertCircle } from 'lucide-react';

/**
 * PendingNavigationModal — confirmation avant de quitter une playlist tout
 * juste générée/ouverte mais jamais sauvegardée (ensemencée depuis
 * Découvrir, importée via lien partagé, ou fraîchement générée) — voir
 * `hasUnsavedPlaylist`/`changeView` (useNavigation.js), qui déclenche cette
 * modale via `openModal('PENDING_NAVIGATION', newView)` plutôt que de
 * naviguer directement, pour ne jamais perdre silencieusement une playlist
 * sans brouillon persistant (voir createPlaylistData).
 *
 * BUG CORRIGÉ (01/08, retour direct : "je devrais pouvoir sortir d'une
 * playlist en cliquant dans le menu, là c'est juste via Retour") — ce
 * fichier ne contenait PLUS le code de PendingNavigationModal du tout : il
 * s'agissait d'une copie quasi identique d'EditRoutineModal.jsx (même
 * fonction exportée, mêmes props), écrasement resté invisible jusqu'ici car
 * `PendingNavigationModal` n'a jamais eu son propre fichier de test
 * (contrairement à PendingUnsaveModal.jsx, son proche cousin) — à corriger
 * séparément, voir passation. Le composant qui s'affichait réellement au
 * clic (`isEditRoutineModalOpen`/`editingRoutine` toujours faux/null dans
 * ce contexte) retournait donc TOUJOURS `null` : aucune modale visible,
 * aucune navigation possible — SAUF via "← Retour"
 * (PlaylistDetailView.jsx), qui appelle exactement le même `changeView`
 * mais vers 'playlists' : la protection s'appliquait donc IDENTIQUEMENT
 * aux deux, silencieusement bloquée dans les deux cas. Reconstruit ici à
 * partir de ses vraies props (voir ModalContainer.jsx : `theme`,
 * `pendingNavigation`, `onClose`, `resolvePendingNavigation`) et du style
 * déjà établi par PendingUnsaveModal.jsx pour ce même type de modale de
 * confirmation courte.
 *
 * `pendingNavigation` : la vue de destination en attente (ex. 'discover',
 * 'stats'...), posée par `changeView` — sert uniquement de test de présence
 * ici (`!pendingNavigation` → pas de modale), la vraie navigation est gérée
 * par `resolvePendingNavigation` (App.jsx), qui relit cette même valeur
 * depuis `modalData` au moment de la résoudre.
 *
 * `resolvePendingNavigation(shouldSave)` : `true` sauvegarde la playlist
 * (`handleSavePlaylist`) PUIS navigue vers la vue en attente ; `false`
 * navigue sans sauvegarder (la playlist est perdue) ; ni l'un ni l'autre
 * (bouton Annuler, `onClose` seul) referme la modale sans naviguer, la
 * playlist reste ouverte telle quelle.
 */
export default function PendingNavigationModal({
  theme, pendingNavigation, onClose, resolvePendingNavigation,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass } = theme;

  if (!pendingNavigation) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertCircle size={22} />
          </div>
          <div>
            <h3 className={"text-xl font-bold " + textHighlight}>Playlist non sauvegardée</h3>
            <p className={"text-sm mt-1 " + textMuted}>
              Si tu quittes maintenant sans l'enregistrer dans Mes Séances, cette playlist sera définitivement perdue.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-6">
          <button onClick={() => resolvePendingNavigation(true)} className={"w-full py-3.5 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all " + bgAccentClass}>
            Sauvegarder et continuer
          </button>
          <button onClick={() => resolvePendingNavigation(false)} className="w-full px-6 py-3 font-bold rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            Continuer sans sauvegarder
          </button>
          <button onClick={onClose} className={"w-full px-6 py-3 font-medium hover:text-main " + textMuted}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
