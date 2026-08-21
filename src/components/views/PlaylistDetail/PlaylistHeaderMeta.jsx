import { Lock, Activity, Clock, Music, User } from 'lucide-react';
import { getGenresForDisplay, genreDisplayLabel } from '../../../musicCatalog';
import { formatDuration } from '../../../utils/format';
import TopCompletionDate from '../../shared/TopCompletionDate';
import CompletionsList from '../../shared/CompletionsList';

/**
 * PlaylistHeaderMeta.jsx — badge "séance déjà réalisée" + dernière date
 * (+ liste des autres dates), suivi de la ligne d'infos brutes de la
 * playlist (créateur, type d'activité, durée, nb de titres, genres).
 * Extrait de `PlaylistHeader.jsx` (chantier découpage, 08/08) — 2 blocs
 * regroupés ici car tous deux purement informatifs (pas d'action
 * principale), à la différence de `PlaylistHeaderActions.jsx`.
 *
 * ⚠️ PSEUDO DÉPLACÉ ICI (10/08, retour direct avec capture d'écran —
 * "supprimer la ligne pseudo/compteur au-dessus du titre pour épurer le
 * design, l'intégrer comme première info de la ligne de métadonnées à la
 * place"). Vivait auparavant dans `PlaylistHeaderTitleBlock.jsx`, sur sa
 * propre ligne au-dessus du titre — voir sa docstring pour le "avant".
 *
 * ⚠️ COMPTEUR DE CLONAGES REPARTI AILLEURS (10/08, MÊME SESSION, retour
 * direct suivant : "je le veux davantage sur la même ligne que le bouton
 * public/corbeille, à leur gauche ; laisse le pseudo où il est, dans les
 * métadonnées c'est très bien") — a suivi le pseudo ici dans un 1er temps
 * (les deux vivaient dans le même bloc conditionnel `ownerLabel &&` de
 * `PlaylistHeaderTitleBlock.jsx`, les dissocier aurait fait disparaître le
 * compteur de l'écran lors du 1er déplacement), puis déplacé une 2e fois,
 * séparément du pseudo cette fois, vers `PlaylistHeaderBadges.jsx` (rangée
 * d'icônes en haut à droite de la carte) — voir sa docstring. Ce fichier
 * ne porte donc plus QUE le pseudo, plus le compteur.
 *
 * Gaté sur `ownerLabel` (peut être `null` — génération fraîche pas encore
 * sauvegardée, voir PlaylistHeader.jsx) : tout le 1er item (icône + nom +
 * séparateur qui suit) disparaît proprement dans ce cas, "Course à pied"
 * redevient naturellement le premier élément de la ligne, sans séparateur
 * orphelin devant lui.
 *
 * ⚠️ PSEUDO CLIQUABLE VERS "MES PLAYLISTS" QUAND `isSaved` (10/08, MÊME
 * SESSION, retour direct : "quand c'est mon propre pseudo je veux que ça
 * ramène vers 'Mes Séances', que je sois connecté ou en mode invité" — nom
 * de destination renommé le 20/08, "Mes Séances" → "Mes Playlists", voir
 * Sidebar.jsx) — décidé APRÈS discussion explicite sur l'avertissement envisagé au
 * départ : AUCUN popup de confirmation, ni pour un compte connecté (rien
 * à risquer, simple navigation interne) ni pour l'invité (le seul vrai
 * risque du mode invité — données non synchronisées — est déjà rappelé en
 * PERMANENCE par `GuestModeBar.jsx`, pas la peine de le répéter sur CE
 * clic précis alors qu'aucun autre lien de navigation de l'app ne le
 * fait — ni "← Retour", qui fait exactement la même navigation). 3
 * branches désormais dans le rendu du pseudo : `ownerProfileUsername` +
 * `onViewProfile` fournis → profil d'un AUTRE utilisateur (inchangé) ;
 * `isSaved` (et PAS de profil à visiter — mutuellement exclusif avec la
 * branche précédente) → TON pseudo, clique dessus ramène à `changeView(
 * 'playlists')` ; sinon (ni l'un ni l'autre) → texte simple, non cliquable
 * (cas défensif : `ownerProfileUsername` fourni mais `onViewProfile`
 * manquant, voir le test dédié).
 */
export default function PlaylistHeaderMeta({
  currentPlaylist, theme, isLocked, isReadOnly,
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate,
  triggerCSVUpload, removeImportedData, mostRecentCompletionIso,
  ownerLabel, ownerProfileUsername, onViewProfile, isSaved, changeView,
}) {
  return (
    <>
      {/* Badge "séance déjà réalisée" — seul élément qui peut légitimement
          précéder le titre (info sur la séance elle-même, pas une action).
          Bloc entier conditionné à `isLocked`, pas juste son contenu :
          sans ça, un conteneur vide laisse un espace mort au-dessus du
          titre. */}
      {isLocked && currentPlaylist.completions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 justify-center md:justify-start">
            <span className="text-xs font-bold flex items-center text-rose-400" title="Séance déjà réalisée">
              <Lock size={12}/>
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              <TopCompletionDate
                playlist={currentPlaylist} theme={theme}
                editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                editCompletionDate={editCompletionDate}
                isReadOnly={isReadOnly}
              />
            </p>
          </div>
          {/* N'affiche cette liste que s'il reste au moins UNE date au-delà
              de `completions[0]` (déjà montrée juste au-dessus). */}
          {currentPlaylist.completions.length > 1 && (
            <div className="pt-0.5">
              <CompletionsList
                playlist={currentPlaylist} theme={theme}
                hideUploadForDate={mostRecentCompletionIso} skipDates={[currentPlaylist.completions[0]]}
                editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
                triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
                isReadOnly={isReadOnly}
              />
            </div>
          )}
        </div>
      )}

      {/* Ligne d'infos de la playlist SEULES — icônes + `text-slate-300`
          (fixe, cohérent avec le fond toujours sombre de cette carte). */}
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-sm font-medium text-slate-300">
        {ownerLabel && (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <User size={16} className="text-slate-400 shrink-0"/>
              {ownerProfileUsername && onViewProfile ? (
                <button
                  onClick={() => onViewProfile(ownerProfileUsername)}
                  title={`Voir le profil de ${ownerLabel}`}
                  className="truncate underline hover:text-slate-100 cursor-pointer"
                >
                  {ownerLabel}
                </button>
              ) : isSaved ? (
                // Ton PROPRE pseudo (ou "Invité" en mode invité) — retour
                // direct (10/08, même session que le déplacement de ce
                // bloc) : "ça devrait ramener vers Mes Séances, connecté ou
                // invité, sans avertissement" — pas de popup de
                // confirmation ici (décidé après discussion : une simple
                // navigation interne, réversible et sans conséquence, ne
                // justifie pas d'en ajouter un — le rappel "mode invité"
                // déjà permanent via GuestModeBar.jsx couvre déjà le seul
                // vrai risque, pas la peine de le répéter sur CE clic
                // précis alors qu'aucun autre lien de navigation de l'app
                // ne le fait). Même style que le pseudo cliquable
                // ci-dessus (`onViewProfile`) — ce n'est plus "ton pseudo
                // affiché passivement", c'est un vrai lien.
                <button
                  onClick={() => changeView('playlists')}
                  title="Aller à Mes Playlists"
                  className="truncate underline hover:text-slate-100 cursor-pointer"
                >
                  {ownerLabel}
                </button>
              ) : (
                <span
                  title={`Créée par ${ownerLabel}`}
                  className="truncate"
                >
                  {ownerLabel}
                </span>
              )}
            </div>
            <span className="text-slate-600">•</span>
          </>
        )}
        <div className="flex items-center gap-1.5" title="Type de séance"><Activity size={16} className="text-slate-400"/><span>{currentPlaylist.workoutType}</span></div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5" title="Durée"><Clock size={16} className="text-slate-400"/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5" title="Nombre de titres"><Music size={16} className="text-slate-400"/><span>{currentPlaylist.tracks.length} titres</span></div>
        {(() => {
          const cfg = currentPlaylist.config || {};
          // Les genres SÉLECTIONNÉS (cfg.selectedGenres) sont déjà des noms
          // canoniques de l'app — ne JAMAIS les repasser dans
          // normalizeGenreForDisplay (prévu pour un genre BRUT venu de
          // Deezer). Seul le repli (genres réels des titres) a besoin de
          // cette normalisation.
          if (cfg.selectedGenres && cfg.selectedGenres.length > 0) {
            return (
              <>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1.5" title="Genres musicaux"><Music size={16} className="text-slate-400"/><span>{cfg.selectedGenres.map(genreDisplayLabel).join(', ')}</span></div>
              </>
            );
          }
          const genres = Array.from(new Set(currentPlaylist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
          return genres.length > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <div className="flex items-center gap-1.5" title="Genres musicaux"><Music size={16} className="text-slate-400"/><span>{Array.from(new Set(genres.flatMap(getGenresForDisplay))).join(', ')}</span></div>
            </>
          );
        })()}
      </div>
    </>
  );
}
