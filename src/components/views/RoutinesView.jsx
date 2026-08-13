import { useState, useMemo } from 'react';
import { ListPlus, Plus, Edit3, Trash2, Layers, Info, Loader2, PlaySquare, Globe } from 'lucide-react';
import { useModalContext } from '../../contexts/ModalContext';
import ViewHeader from '../shared/ViewHeader';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';
import { isTargetValueValid, areSegmentsValid } from '../../utils/targetValidation';

/**
 * RoutinesView — vue "Mes Routines" (configurations sauvegardées, relançables en un clic).
 *
 * Extrait de App.jsx (bloc `view === 'routines'`). Les routines sont triées
 * côté composant (par nombre de générations manuelles décroissant), mais la
 * mutation de l'état (`setRoutines`, `setRoutineBatchCounts`) reste pilotée
 * depuis App.jsx via les props — ce composant ne fait qu'appeler les setters
 * qu'on lui passe.
 */
export default function RoutinesView({
  theme, isNaughtyMode, routines, setRoutines, routineBatchCounts, setRoutineBatchCounts,
  getDisplayRoutineIcon, getDisplayRoutineName, renderConfigInfoLine, getRankStyle,
  setEditingRoutine, executeGeneration, isGenerating, changeView, showToast,
}) {
  const { openModal } = useModalContext();
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass, inputBg, inputBorder } = theme;

  // Bascule publique/privée INDIVIDUELLE (Vague 2, Chantier 1 — UI publique
  // des routines, 02/08) — MÊME principe exact que `handleTogglePlaylistPublic`
  // de PlaylistsView.jsx (celui-là agit sur `savedPlaylists`, celui-ci sur
  // `routines`) : le SQL/RLS existait déjà (`routines.is_public`, voir
  // supabase-schema.sql), il ne manquait que ce déclencheur UI.
  // `useSyncedCollection.js` détecte le changement au prochain rendu et
  // pousse la mise à jour vers la colonne `is_public` de la table `routines`
  // tout seul, rien de plus à faire ici côté synchro.
  // ⚠️ SIMPLIFIÉ (03/08, refonte lignée serveur) — voir la docstring de
  // `handleTogglePlaylistPublic` (PlaylistDetailContext.jsx) pour le
  // raisonnement complet : le crédit de republication vers l'origine
  // était du code mort (déjà bloqué par le `clone_ledger`, systématiquement
  // réclamé au moment du clonage lui-même) — retiré.
  const handleToggleRoutinePublic = (id) => {
    setRoutines(routines.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, isPublic: !r.isPublic };
      // Confirmation (05/08, retour direct — même raisonnement/formulation
      // que PlaylistDetailContext.jsx/PlaylistsView.jsx, voir leurs
      // docstrings). `getDisplayRoutineName` (déjà reçu en prop) plutôt que
      // `updated.name` brut — résout le même nom affiché que partout
      // ailleurs sur cette carte (gère les cas Mode Intime), pas une 2e
      // logique de nommage divergente pour ce seul message.
      // ⚠️ TEXTE RACCOURCI (10/08, retour direct — "le texte doit tenir sur
      // une seule ligne") : voir PlaylistsView.jsx pour le raisonnement
      // complet — même raccourci appliqué aux 3 endroits identiques.
      showToast(updated.isPublic ? `🌐 "${getDisplayRoutineName(updated)}" est maintenant publique.` : `🔒 "${getDisplayRoutineName(updated)}" est de nouveau privée.`);
      return updated;
    }));
  };

  // Description libre sur les routines — RETIRÉE (08/08, retour direct,
  // capture à l'appui : "finalement pas emballé par la fonctionnalité
  // description sur les routines... on conserve juste pour les
  // playlists"). Contrairement à une playlist (vraie page détail dédiée,
  // la description y respire), une routine n'a AUCUNE vue détail séparée
  // — la description finissait compressée sur la carte elle-même,
  // tronquée à 1 ligne sans échappatoire "Voir plus" (voir le bloc JSX
  // qui vivait ici, retiré). La fonctionnalité reste intacte pour les
  // playlists (`PlaylistHeader.jsx`/`PlaylistDetailContext.jsx`,
  // inchangés) — seule la variante "routines" de ce chantier (Vague 2,
  // Chantier 3, 02/08) est annulée. Voir aussi `PublicRoutinePreviewModal.jsx`
  // (affichage retiré), `ProfileView.jsx`/`PublicItemCard` (gaté sur
  // `kind === 'playlist'` désormais), `officialVitrineProfile.js`
  // (descriptions retirées de `FAKE_VITRINE_ROUTINES`).

  // Triées par nombre de générations manuelles décroissant — les plus utilisées
  // remontent en premier. À égalité, ordre inchangé.
  //
  // ⚠️ OPTIMISATION (audit perf, 05/08) : les 2 tris + le filtre ci-dessous
  // tournaient sur CHAQUE rendu de ce composant (pas de `useMemo`) — y
  // compris un rendu déclenché par un state local à ce même composant sans
  // aucun rapport avec `routines` (à l'époque, une frappe dans le brouillon
  // de description — fonctionnalité retirée depuis le 08/08, voir plus
  // haut ; l'optimisation elle-même reste valable pour tout autre state
  // local futur du même genre). Memoïsé sur `[routines]`
  // : les 2 tris ne se recalculent plus que quand la liste change vraiment.
  // `routineRankMap` (Map id → rang) remplace aussi un `routineRanks.indexOf
  // (routine.id)` qui tournait DANS la boucle `.map()` juste en dessous —
  // O(n) par carte, donc O(n²) au total pour toute la grille ; une Map rend
  // ce lookup O(1) par carte. Sans impact perceptible au nombre de routines
  // réaliste pour un compte (quelques dizaines), mais correct par principe
  // et cohérent avec les optimisations déjà faites ailleurs cette semaine
  // (StatsView.jsx `useMemo`, musicEngine.js `Set`).
  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => (b.manualGenerations || 0) - (a.manualGenerations || 0)),
    [routines],
  );
  const routineRankMap = useMemo(() => {
    const ranked = routines
      .filter(r => (r.manualGenerations || 0) > 0)
      .sort((a, b) => (b.manualGenerations || 0) - (a.manualGenerations || 0));
    return new Map(ranked.map((r, index) => [r.id, index]));
  }, [routines]);

  return (
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-8`}>
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<ListPlus className={textColorClass} size={VIEW_HEADER_ICON_SIZE} />}
        title="Mes Routines"
        subtitle="Génère instantanément des playlists à partir de tes configurations."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {routines.length === 0 ? (
          <div className={`col-span-full py-16 text-center border-2 border-dashed rounded-2xl ${isNaughtyMode ? 'border-slate-400' : 'border-slate-700'}`}>
            <ListPlus size={48} className={`mx-auto mb-4 ${textMuted}`} />
            <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Aucune routine pour l'instant</h3>
            <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>Génère une première playlist et sauvegarde-la comme routine pour la relancer en un clic la prochaine fois.</p>
            <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
              Créer ma première playlist
            </button>
          </div>
        ) : (
          <>
            {/* Ménage "Centraliser les règles de couleur" (29/07) — l'ancien
                ternaire `isNaughtyMode ? 'border-slate-400 text-slate-300
                hover:text-white' : 'border-slate-700 text-slate-400
                hover:text-white'` dupliquait à la main une logique que
                `useTheme.js` gère déjà : `cardBorder`/`textMuted` s'adaptent
                tout seuls (clair/sombre/Intime) via les variables CSS de
                `.dark`/`.naughty` (index.css) — plus besoin de `isNaughtyMode`
                ici du tout. `hover:text-main` gardé littéral (déjà utilisé
                tel quel ailleurs dans ce fichier) plutôt qu'interpolé via
                `hover:${'${textHighlight}'}`, qui ne serait jamais généré par
                Tailwind (piège JIT documenté partout dans ce projet). */}
            <button onClick={() => changeView('generator')} className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-10 font-bold transition-colors ${cardBorder} ${textMuted} hover:text-main`}>
              <Plus size={28} />
              <span>Créer une nouvelle routine</span>
            </button>
          </>
        )}
        {sortedRoutines.map(routine => {
          const batchCount = routineBatchCounts[routine.id] || 1;
          const rank = routineRankMap.get(routine.id) ?? -1;
          const rankStyle = getRankStyle(rank);
          // ⚠️ NOUVEAU (04/08, retour direct, 2e capture d'écran — une
          // routine SAUVEGARDÉE avec 0 km, créée avant le 1er correctif de
          // ce chantier, se générait encore sans blocage) : voir
          // targetValidation.js ("ÉLARGI") pour le raisonnement complet — le
          // 1er passage n'avait couvert que les formulaires d'ENTRÉE
          // (wizard, EditRoutineModal), pas le bouton "Générer" de cette
          // carte, qui consomme directement les valeurs déjà STOCKÉES sur
          // `routine`. Calculé UNE FOIS par carte ici, réutilisé plus bas
          // dans l'avertissement ET le bouton plutôt que recalculé 2 fois.
          // ⚠️ ÉLARGI (même jour, 3e retour direct — "ce comportement
          // minimal est-il celui généralisé dans toute l'app ? il le
          // faudrait") : le mode Fractionné (`routine.isIntervalMode`)
          // était jusque-là exclu de la validation, sous prétexte qu'il
          // utilise des durées PAR SEGMENT (`routine.segments[]`) plutôt
          // que la cible globale — mais ces segments souffraient
          // EXACTEMENT du même défaut (`isSegmentValid`, targetValidation.js,
          // trouvé en généralisant ce correctif dans GeneratorWizard.jsx).
          // Désormais validé selon le bon critère par mode : cible globale
          // (Constant/Crescendo) OU segments (Fractionné), jamais les deux.
          const routineTargetInvalid = routine.isIntervalMode
            ? !areSegmentsValid(routine.segments, routine.targetMode)
            : !isTargetValueValid({
                targetMode: routine.targetMode, distanceVal: routine.distanceVal, hours: routine.hours, minutes: routine.minutes,
              });
          return (
            <div key={routine.id} className={`${cardBg} rounded-2xl p-6 border ${rankStyle ? rankStyle.border : cardBorder} shadow-xs relative group overflow-hidden flex flex-col`}>
              {rankStyle && <span className="absolute -top-2 -right-2 text-xl" title={`${routine.manualGenerations} générations — la ${rank === 0 ? 'plus' : rank === 1 ? '2e plus' : '3e plus'} utilisée`}>{rankStyle.emoji}</span>}
              <div className="flex items-start justify-between mb-4 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-surface-hover shrink-0`}>
                    {getDisplayRoutineIcon(routine)}
                  </div>
                  <h3 className={`font-bold text-xl flex items-center gap-2 min-w-0 ${textHighlight}`}>
                    <span className="truncate">{getDisplayRoutineName(routine)}</span>
                    {routine.isIntervalMode && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white shrink-0 ${bgAccentClass}`}>
                        {routine.isCrescendoMode ? 'Crescendo' : 'Fractionné'}
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  {routine.autoGenFreq && routine.autoGenFreq !== 'Manuel' && (() => {
                    let target = 0; let label = "ajd";
                    if (routine.autoGenFreq === '1 fois / jour') target = 1;
                    if (routine.autoGenFreq === '2 fois / jour') target = 2;
                    if (routine.autoGenFreq === '1 fois / semaine') { target = 1; label = "cette sem."; }
                    const remaining = Math.max(0, target - (routine.manualGenerations || 0));
                    return (
                      <div className="text-[10px] font-bold uppercase px-2 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md">
                        Auto : {remaining} restante{remaining > 1 ? 's' : ''} {label}
                      </div>
                    )
                  })()}
                  {/* Bascule publique/privée — même bouton (icône seule)
                      qu'une carte de PlaylistCard.jsx : toujours visible
                      quand déjà publique (statut persistant à signaler),
                      révélée au survol du groupe sinon, cohérent avec
                      Éditer/Supprimer juste à côté. */}
                  <button
                    onClick={() => handleToggleRoutinePublic(routine.id)}
                    title={routine.isPublic ? "Visible sur ton profil public — clique pour la rendre privée" : "Rendre cette routine visible sur ton profil public"}
                    className={`p-2 rounded-lg transition-colors ${
                      routine.isPublic
                        ? 'text-emerald-500 hover:text-emerald-600'
                        : 'text-gray-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Globe size={16} />
                  </button>
                  <button onClick={() => { setEditingRoutine({ ...routine }); openModal('EDIT_ROUTINE'); }} className={`p-2 rounded-lg text-gray-400 hover:text-blue-500 transition-colors`} title="Éditer cette routine">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => setRoutines(routines.filter(r => r.id !== routine.id))} className={`p-2 rounded-lg text-gray-400 hover:text-red-500 transition-colors`} title="Supprimer cette routine">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div>{renderConfigInfoLine(routine)}</div>

              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                {/* Message différencié : le mode Fractionné ne peut PAS être
                    corrigé via l'icône crayon (EditRoutineModal.jsx n'offre
                    aucune édition des segments, voir son message "les
                    portions détaillées ne sont pas éditables depuis cette
                    fenêtre") — y renvoyer serait un cul-de-sac trompeur. */}
                {routineTargetInvalid && (
                  <p className="text-xs font-bold text-red-500 mb-2">
                    {routine.isIntervalMode
                      ? <>Portion(s) invalide(s) (BPM ou {routine.targetMode === 'distance' ? 'distance' : 'durée'} à 0) — recrée cette routine via "Nouvelle séance" pour corriger les portions.</>
                      : <>{routine.targetMode === 'distance' ? 'Distance invalide (0 ou vide)' : 'Durée invalide (0 ou vide)'} — corrige-la via <Edit3 size={11} className="inline align-text-bottom" /> avant de générer.</>}
                  </p>
                )}
                <div className="flex gap-2 mb-2">
                  <div className={`flex items-center ${inputBg} border ${inputBorder} rounded-xl px-2`} title="Génère plusieurs versions différentes en un clic, pour choisir celle que tu préfères.">
                    <Layers size={16} className={`${textMuted} mr-1`} />
                    <select
                      value={batchCount} onChange={(e) => setRoutineBatchCounts({...routineBatchCounts, [routine.id]: parseInt(e.target.value)})}
                      disabled={isGenerating}
                      className={`bg-transparent text-sm font-bold outline-hidden text-blue-600 dark:text-blue-400 cursor-pointer py-3 appearance-none pl-1 pr-2 disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <option value={1} className="bg-surface text-main">x1</option>
                      <option value={3} className="bg-surface text-main">x3</option>
                      <option value={5} className="bg-surface text-main">x5</option>
                      <option value={10} className="bg-surface text-main">x10</option>
                    </select>
                    <Info size={13} className={`${textMuted} ml-0.5 mr-1 shrink-0`} />
                  </div>
                  {/* BUG CORRIGÉ (25/07) : contrairement au bouton "Générer ma
                      Playlist" du wizard (GeneratorView.jsx), ce bouton n'avait
                      aucun `disabled` — on pouvait lancer une 2e génération
                      (même routine ou une autre) par-dessus une déjà en cours. */}
                  <button
                    onClick={() => { executeGeneration({ ...routine, workoutName: routine.customActivity || routine.workoutType, routineName: routine.name }, batchCount, routine.id);
                  }}
                    disabled={isGenerating || routineTargetInvalid}
                    title={routineTargetInvalid ? (routine.isIntervalMode ? 'Une ou plusieurs portions de cette routine sont invalides.' : 'Corrige la distance/durée de cette routine avant de générer.') : undefined}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${bgAccentClass} text-white hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100`}>
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <PlaySquare size={18} fill="currentColor"/>}
                    <span>Générer</span>
                  </button>
                </div>
                {routine.createdAt && (
                  <div className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Créée le {routine.createdAt}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
