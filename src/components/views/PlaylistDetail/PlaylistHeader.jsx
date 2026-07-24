import { useRef } from 'react';
import {
  Check, Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Music2, Play,
  Calendar, Lock, Upload, Trash2, Gauge,
} from 'lucide-react';
import { getGenresForDisplay, genreDisplayLabel } from '../../../musicCatalog';
import { formatDuration } from '../../../utils/format';
import { buildCoverUrl } from '../../../utils/coverArt';
import { getActivityEmoji, getZoneForValue, getBpmBucketColor, getBpmBucketStart } from '../../../appConfig';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';

/**
 * PlaylistHeader.jsx — en-tête de PlaylistDetailView : pochette, titre
 * (édition inline), badge de dernière complétion (si verrouillée), et
 * rangée d'actions (import CSV, planifier, partager, sauvegarder/retirer).
 * Extrait de PlaylistDetailView.jsx (chantier découpage, suite de
 * TrackList/TrackItem).
 *
 * Contrairement à TrackList (state de filtre partagé avec les camemberts),
 * RIEN ici n'est partagé avec PlaylistCharts ou TrackList — tout ce qui
 * vivait dans le composant parent UNIQUEMENT pour cet en-tête (rang/médaille,
 * dates de complétion la plus récente, ref de l'input date caché) est donc
 * déplacé ENTIÈREMENT ici plutôt que reçu en prop précalculé, contrairement à
 * bpmChartActivityName/isBpmChartUsingRealProfile côté PlaylistCharts (ceux-
 * là restent partagés avec TrackList/le calcul de trackBpmBucketLabel, donc
 * pas déplaçables).
 *
 * Reçoit en props : ce qui est possédé par PlaylistDetailView (theme,
 * verrouillage, savedPlaylists — pour le classement/médaille — et les
 * fonctions de rendu/action partagées avec PlaylistsView/TrophiesView) ou ce
 * qui est partagé avec PlaylistCharts (resolveAndTogglePreview/
 * getNextTrackForAutoAdvance — le bouton "Écouter cette playlist" sur la
 * pochette utilise EXACTEMENT le même mécanisme que le bouton play de
 * l'encart segment sélectionné dans PlaylistCharts, pas une 2e
 * implémentation). `onShare` : callback fourni par le parent (qui possède
 * `summaryCardRef`/génération d'image, non déplaçable ici) — cet en-tête n'a
 * besoin de savoir QUE "cliquer ici déclenche le partage", pas comment.
 *
 * Tout le reste (nom éditable, sauvegarde/retrait, currentPlaylist lui-même)
 * vient de usePlaylistDetail().
 *
 * --- Refonte visuelle (retour direct : esthétique "premium" façon
 * Spotify/Apple Music) ---
 * Avant ce chantier, la carte suivait le thème clair/sombre adaptatif de
 * l'app (`theme.cardBorder`/`textMuted`/etc., fond gris clair OU rose pâle
 * en Mode Intime). Ce n'est plus le cas : le conteneur est maintenant un
 * verre dépoli SOMBRE FIXE (`slate-900` en dégradé), volontairement
 * indépendant du thème clair/sombre choisi par l'utilisateur — même logique
 * qu'un en-tête d'album Spotify, toujours sombre et immersif quel que soit
 * le thème du reste de l'app. Conséquence directe : tout le texte et les
 * boutons À L'INTÉRIEUR de cette carte doivent utiliser une palette FIXE
 * claire-sur-sombre (`text-white`/`text-slate-300`/`slate-800`...), PLUS les
 * classes `theme.textMuted`/`cardBorder` (pensées pour un fond adaptatif, pas
 * pour ce nouveau fond toujours sombre — les réutiliser ici rendrait le texte
 * illisible en thème clair). Seul `theme.bgAccentClass` reste utilisé (bouton
 * play au survol de la pochette) : c'est déjà une couleur d'accent dédiée,
 * pas une couleur de texte/fond adaptative. Le Mode Intime (`isNaughtyMode`)
 * n'a plus besoin de dégradé dédié pour se signaler : la pochette, l'emoji
 * d'activité ("Ambiance" 🌶️) et l'accent rose du bouton principal suffisent
 * déjà à le faire reconnaître, sans sacrifier la cohérence du nouveau design.
 *
 * --- Ancrage vertical + badge BPM/Zone (retour direct : "grand vide noir
 * en bas et à droite sur grand écran") ---
 * `items-stretch` (plutôt que `items-start`) sur la rangée pochette/bloc de
 * droite : le bloc de droite prend ainsi TOUJOURS la même hauteur que la
 * pochette (le plus grand des deux enfants), sans dupliquer ses classes de
 * taille (`w-32 h-32 md:w-48 md:h-48`) en dur ici — une seule source de
 * vérité pour cette hauteur, portée par la pochette elle-même. `justify-
 * between` sur le bloc de droite pousse alors naturellement la rangée
 * d'actions tout en bas, calée sur le bas de la pochette, pendant que titre/
 * métadonnées restent en haut — sans rien casser à l'alignement déjà en
 * place (le sommet des deux reste identique, seul l'étirement change).
 *
 * Le badge BPM/Zone (juste au-dessus des actions) comble l'espace
 * intermédiaire avec une info utile plutôt qu'un simple espaceur : BPM
 * moyen réel de la playlist (même calcul que SessionSummaryCard.jsx/
 * StatsView.jsx/App.jsx — jamais une 4e formule) et, SEULEMENT si un profil
 * athlétique réel est configuré pour cette activité, la zone d'effort
 * correspondante (`getZoneForValue`, même résolveur STRICT que
 * `trackBpmBucketLabel` dans PlaylistDetailView.jsx — jamais OrDefault ici :
 * ce badge affirme "calculé depuis TON profil", il doit rester honnête sur
 * ce qui a vraiment été configuré, même règle que `bpmSourceIsProfile`,
 * useGeneratorForm.js). Sans profil configuré, repli sur la couleur neutre
 * "Énergie Musicale" (`getBpmBucketColor`) déjà utilisée par le camembert
 * BPM (PlaylistDetailContext.jsx) et TrackItem.jsx — jamais une 3e palette.
 * `bpmChartActivityName` : reçue en prop plutôt que recalculée ici, pour
 * rester l'unique source de vérité déjà partagée avec PlaylistCharts.jsx
 * (résolution Mode Intime incluse — voir sa docstring, PlaylistDetailView.jsx).
 *
 * --- Passage à l'échelle "Hero Card" (retour direct : "désert noir sur
 * toute la moitié droite sur grand écran") ---
 * Pochette et titre agrandis avec un vrai palier intermédiaire (`sm:`), pas
 * seulement le saut `base → md:` d'avant (trop brutal, et insuffisant sur
 * les très grands écrans — d'où l'ajout d'un palier `lg:` supplémentaire,
 * absent jusqu'ici). Le badge BPM/Zone est déplacé : il vivait juste
 * au-dessus de la rangée d'actions (comblait le vide vertical) — il vit
 * maintenant À CÔTÉ de la ligne de métadonnées sur grand écran (`md:` et
 * plus), pour aussi combler le vide HORIZONTAL signalé cette fois. Sur
 * mobile (`flex-col` en dessous de `md:`), il redescend sous les
 * métadonnées, centré comme le reste du bloc.
 */
export default function PlaylistHeader({
  theme, isLocked, savedPlaylists,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  setPlaylistPlannedDate, bpmChartActivityName,
  renderCompletionsList, renderTopCompletionDate, getRankStyle, triggerCSVUpload,
  onShare,
}) {
  const { bgAccentClass } = theme;
  const {
    currentPlaylist, getProfileForWorkout,
    isEditingPlaylistName, setIsEditingPlaylistName, editedPlaylistName, setEditedPlaylistName, handleRenamePlaylist,
    handleSavePlaylist, handleUnsavePlaylist,
  } = usePlaylistDetail();

  // BPM moyen réel de la playlist — même formule que SessionSummaryCard.jsx/
  // ImportSharedPlaylistModal.jsx/StatsView.jsx/App.jsx (`avgBpm`), jamais
  // recalculée différemment ici. `getZoneForValue` STRICT (pas OrDefault) :
  // `null` si l'activité n'a jamais été configurée dans le Profil Athlétique
  // — repli sur la couleur neutre du camembert BPM plutôt qu'une zone
  // inventée (voir la docstring ci-dessus).
  const avgBpm = currentPlaylist.tracks.length > 0
    ? Math.round(currentPlaylist.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / currentPlaylist.tracks.length)
    : null;
  const bpmZone = avgBpm != null ? getZoneForValue(avgBpm, bpmChartActivityName, getProfileForWorkout) : null;
  const bpmBadgeColor = bpmZone ? bpmZone.color : (avgBpm != null ? getBpmBucketColor(getBpmBucketStart(avgBpm)) : null);

  // Filet de sécurité multi-navigateurs pour le bouton "Planifier" (voir plus
  // bas) : un <input type="date"> rendu invisible et superposé à un <label>
  // s'ouvre au clic dans la plupart des navigateurs, mais pas de façon fiable
  // partout (Safari en particulier peut ignorer ce clic précis, sans aucune
  // erreur visible) — d'où le retour "le bouton Planifier ne fonctionne pas".
  const plannedDateInputRef = useRef(null);

  // --- CTA "Importer mes données" (retour direct : maquette UI/UX complète) ---
  // Cible la date de complétion la plus RÉCENTE (celle qu'on vient de
  // marquer/refaire est la plus probable à vouloir enrichir) plutôt que
  // d'exiger que la personne choisisse elle-même laquelle dans le cas
  // fréquent d'une seule date. Les dates plus anciennes restent gérables
  // individuellement via la liste détaillée (renderCompletionsList).
  const mostRecentCompletionIso = isLocked ? currentPlaylist.completions[currentPlaylist.completions.length - 1] : null;
  const hasImportedDataForMostRecent = !!(mostRecentCompletionIso && currentPlaylist.actualDataByDate && currentPlaylist.actualDataByDate[mostRecentCompletionIso]);

  // Médaille "la plus/2e plus/3e plus utilisée" — même logique de classement
  // recalculée localement (mêmes filtre + tri que PlaylistsView.jsx), plutôt
  // qu'un classement centralisé transmis en prop — cohérent avec la
  // convention déjà en place ailleurs dans l'app pour ce même genre de
  // classement (RoutinesView.jsx fait exactement pareil pour ses routines).
  const playlistRanks = [...savedPlaylists.filter(p => p.completions && p.completions.length > 0)]
    .sort((a, b) => b.completions.length - a.completions.length)
    .map(p => p.id);
  const currentPlaylistRank = playlistRanks.indexOf(currentPlaylist.id);
  const currentPlaylistRankStyle = getRankStyle ? getRankStyle(currentPlaylistRank) : null;

  const isSaved = !!savedPlaylists.find(p => p.id === currentPlaylist.id);

  return (
    <div
      className={
        "relative rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl backdrop-blur-md " +
        "bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-800/40 " +
        "flex flex-col md:flex-row items-stretch gap-6 md:gap-8"
      }
    >
      {currentPlaylistRankStyle && (
        <span
          className="absolute -top-2 -right-2 text-xl z-10"
          title={`${currentPlaylist.completions.length} fois — la ${currentPlaylistRank === 0 ? 'plus' : currentPlaylistRank === 1 ? '2e plus' : '3e plus'} utilisée`}
        >
          {currentPlaylistRankStyle.emoji}
        </span>
      )}

      {/* Pochette — ombre profonde/diffuse + léger zoom au survol, pour
          détacher visuellement la pochette du fond sombre plutôt qu'un
          simple `shadow-inner` qui se fondait dans la carte. */}
      <div className="relative group/cover shrink-0 mx-auto md:mx-0">
        <button
          onClick={() => currentPlaylist.tracks[0] && resolveAndTogglePreview(currentPlaylist.tracks[0], getNextTrackForAutoAdvance)}
          title="Écouter cette playlist"
          className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-2xl overflow-hidden shadow-2xl shadow-black/70 cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
        >
          {/* Continuité visuelle avec PlaylistCard.jsx (Bibliothèque) : même
              logique de pochette exactement — `coverUrl` si déjà posé
              (playlists ouvertes depuis Découvrir, voir App.jsx
              `openCuratedPlaylist`), sinon `buildCoverUrl(currentPlaylist.name)`
              (déterministe, utils/coverArt.js) — plus de repli sur un simple
              carré teinté + `coverIcon` (l'ancien design, qui ne matchait plus
              la vraie pochette déjà visible sur la carte au moment du clic). */}
          <img src={currentPlaylist.coverUrl || buildCoverUrl(currentPlaylist.name)} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Music2 className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-opacity duration-300 group-hover/cover:opacity-0" />
          </div>
          {/* Cliquer sur la pochette lance la playlist (1er titre + enchaînement
              automatique, getNextTrackForAutoAdvance — même mécanisme que
              partout ailleurs sur cette page). Même cercle rouge que
              TemplateCard.jsx (DiscoverView.jsx)/PlaylistCard.jsx au survol.
              `<span>` (pas un 2e `<button>` : cette pochette EST déjà un
              bouton, imbriquer un bouton dans un bouton serait du HTML
              invalide) centré par le `flex items-center justify-center` de
              cet overlay, pas par un positionnement absolu propre. */}
          <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/30 transition-colors flex items-center justify-center">
            <span className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 scale-95 group-hover/cover:opacity-100 group-hover/cover:scale-100 transition-all duration-300 ${bgAccentClass}`}>
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5"/>
            </span>
          </div>
        </button>
      </div>

      {/* Bloc de droite — `items-start` sur le conteneur parent garantit déjà
          qu'il démarre pile à la hauteur du haut de la pochette ; ce bloc
          n'a donc plus besoin de centrer/pousser son contenu verticalement. */}
      <div className="flex-1 flex flex-col justify-between text-center md:text-left w-full min-w-0">
        <div className="space-y-4">
          {/* Badge "séance déjà réalisée" + dernière date — seul élément
              qui peut légitimement précéder le titre (information sur la
              séance elle-même, pas une action). Bloc entier conditionné à
              `isLocked`, pas juste son contenu : sans ça, un conteneur vide
              laissait un espace mort au-dessus du titre (space-y-4) une fois
              le bouton "Planifier" déplacé dans la barre d'actions du bas —
              désormais, quand la séance n'est pas encore verrouillée, le
              titre est bien le tout premier élément visuel de ce bloc,
              aligné avec le sommet de la pochette. */}
          {isLocked && currentPlaylist.completions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 justify-center md:justify-start">
                <span className="text-xs font-bold flex items-center text-rose-400" title="Séance déjà réalisée">
                  <Lock size={12}/>
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {renderTopCompletionDate ? renderTopCompletionDate(currentPlaylist) : new Date(currentPlaylist.completions[0].slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {/* N'affiche cette liste que s'il reste au moins UNE date au-delà
                  de `completions[0]` (déjà montrée juste au-dessus) : sur une
                  séance jamais rejouée (le cas le plus courant), il n'y aurait
                  plus rien à montrer ici. */}
              {renderCompletionsList && currentPlaylist.completions.length > 1 && (
                <div className="pt-0.5">
                  {renderCompletionsList(currentPlaylist, mostRecentCompletionIso, [currentPlaylist.completions[0]])}
                </div>
              )}
            </div>
          )}

          {/* Titre éditable — vraie échelle de titre principal (voir la
              docstring "Hero Card"), avec un palier `sm:` intermédiaire en
              plus de `md:` pour ne pas sauter brutalement de 2xl à 4xl.
              `truncate` reste un filet de sécurité pour les noms vraiment
              longs, pas une contrainte de largeur artificielle. */}
          {isEditingPlaylistName ? (
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <input
                type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlaylist(); if (e.key === 'Escape') setIsEditingPlaylistName(false); }}
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight bg-transparent outline-none border-b-2 border-rose-500 text-white w-full"
              />
              <button onClick={handleRenamePlaylist} className="p-2 rounded-lg text-white shrink-0 bg-rose-600 hover:bg-rose-500"><Check size={20}/></button>
            </div>
          ) : (
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3 justify-center md:justify-start text-white">
              <span className="truncate min-w-0" title={currentPlaylist.name}>{getActivityEmoji(currentPlaylist.workoutType)} {currentPlaylist.name}</span>
              <button onClick={() => { setEditedPlaylistName(currentPlaylist.name); setIsEditingPlaylistName(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0" title="Renommer la playlist">
                <Edit3 size={20}/>
              </button>
            </h2>
          )}

          {/* Ligne d'infos + badge BPM/Zone regroupés sur une même rangée dès
              `md:` (retour direct : "désert noir sur toute la moitié droite
              sur grand écran") — `md:justify-between` étale les 2 blocs sur
              toute la largeur disponible au lieu de les laisser tassés à
              gauche l'un sous l'autre. Sous `md:`, retour à un simple
              empilement vertical centré (le badge redescend sous les
              métadonnées). Icônes/texte légèrement agrandis
              (`text-sm md:text-base`) pour suivre l'échelle "Hero Card" du
              titre au-dessus. */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-sm md:text-base font-medium text-slate-300">
              <div className="flex items-center gap-1.5"><Activity size={18} className="text-slate-400"/><span>{currentPlaylist.workoutType}</span></div>
              <span className="text-slate-600">•</span>
              <div className="flex items-center gap-1.5"><Clock size={18} className="text-slate-400"/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div>
              <span className="text-slate-600">•</span>
              <div className="flex items-center gap-1.5"><Music size={18} className="text-slate-400"/><span>{currentPlaylist.tracks.length} titres</span></div>
              {(() => {
                const cfg = currentPlaylist.config || {};
                // Les genres SÉLECTIONNÉS (cfg.selectedGenres) sont déjà des noms
                // canoniques de l'app (ex. "K-pop") — ne JAMAIS les repasser dans
                // normalizeGenreForDisplay (prévu pour nettoyer un genre BRUT venu
                // de Deezer). Seul le repli (genres réels des titres, quand aucun
                // genre n'a été explicitement sélectionné) a besoin de cette
                // normalisation — non nécessaire ici, ce repli utilise directement
                // getGenresForDisplay sur le genre déjà brut du titre.
                if (cfg.selectedGenres && cfg.selectedGenres.length > 0) {
                  return (
                    <>
                      <span className="text-slate-600">•</span>
                      <div className="flex items-center gap-1.5"><Music size={18} className="text-slate-400"/><span>{cfg.selectedGenres.map(genreDisplayLabel).join(', ')}</span></div>
                    </>
                  );
                }
                const genres = Array.from(new Set(currentPlaylist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
                return genres.length > 0 && (
                  <>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center gap-1.5"><Music size={18} className="text-slate-400"/><span>{Array.from(new Set(genres.flatMap(getGenresForDisplay))).join(', ')}</span></div>
                  </>
                );
              })()}
            </div>

            {/* Badge BPM/Zone — voir la docstring "Hero Card" : vit maintenant
                à côté des métadonnées (poussé à droite via `md:justify-
                between` du parent) plutôt qu'au-dessus des actions, pour
                occuper la largeur disponible plutôt que la hauteur. */}
            {bpmBadgeColor && (
              <div
                className="inline-flex items-center gap-2 self-center md:self-auto shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold border w-fit mx-auto md:mx-0"
                style={{ backgroundColor: `${bpmBadgeColor}26`, borderColor: `${bpmBadgeColor}66`, color: bpmBadgeColor }}
              >
                <Gauge size={16} />
                <span>{avgBpm} BPM{bpmZone ? ` • ${bpmZone.shortLabel}` : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ligne d'actions — hiérarchie explicite : action PRINCIPALE d'abord
            (pleine, rose, mise en valeur), action secondaire (Partager)
            juste après, discrète. Import CSV (quand applicable) vient
            AVANT ce duo : c'est une action ponctuelle contextuelle liée à
            une séance déjà verrouillée, pas une des 2 actions "de base"
            toujours disponibles sur cette page. */}
        <div className="flex items-center flex-wrap justify-center md:justify-start gap-3">
          {isLocked && triggerCSVUpload && (
            <button
              onClick={(e) => triggerCSVUpload(e, currentPlaylist, mostRecentCompletionIso)}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-sm shrink-0 bg-white text-black shadow-lg transition-transform hover:scale-[1.02] ${hasImportedDataForMostRecent ? 'animate-in fade-in zoom-in duration-500' : 'animate-pulse'}`}
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
          )}

          {/* Action principale (1er position) : Ajouter à Mes Séances / Retirer. */}
          {isSaved ? (
            <button
              onClick={handleUnsavePlaylist}
              title="Retirer cette séance de 'Mes Séances'"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shrink-0 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <Trash2 size={16} /> <span>Retirer de Mes Séances</span>
            </button>
          ) : (
            <button
              onClick={handleSavePlaylist}
              title="Ajoute cette séance à 'Mes Séances', ton journal de séances (passées et à venir)."
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm shrink-0 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-colors"
            >
              <Save size={16} /> <span>Ajouter à Mes Séances</span>
            </button>
          )}

          {/* Action secondaire : Planifier — n'apparaît que si la playlist
              est déjà sauvegardée (planifier une séance qui n'est pas encore
              dans "Mes Séances" n'a pas de sens). Déplacée ici (retour direct :
              flottait seule au-dessus du titre, cassait son alignement avec
              le sommet de la pochette) — même style que Partager pour rester
              clairement une action secondaire face à Ajouter/Retirer. */}
          {isSaved && (
            <label
              onClick={(e) => {
                // showPicker() force l'ouverture explicitement là où l'API existe
                // (Chrome/Edge récents) — sans ce filet, le clic pouvait ne
                // simplement rien faire dans certains navigateurs. Sur les
                // navigateurs sans showPicker (Safari plus anciens, Firefox),
                // on laisse le comportement natif label→input inchangé.
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

          {/* Action secondaire (2e position) : Partager — ShareModal génère
              déjà l'image en arrière-plan et l'inclut directement dans
              l'aperçu du partage (avec une croix pour la retirer) — `onShare`
              (fourni par le parent) déclenche cette génération ET ouvre le
              menu de partage en un seul clic. */}
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shrink-0 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <Share2 size={16} /> <span>Partager</span>
          </button>
        </div>
      </div>
    </div>
  );
}
