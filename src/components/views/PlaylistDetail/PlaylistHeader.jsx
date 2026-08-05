import { useRef } from 'react';
import {
  Check, Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Music2, Play,
  Calendar, Lock, Upload, Trash2, Gauge, Globe,
} from 'lucide-react';
import { getGenresForDisplay, genreDisplayLabel } from '../../../musicCatalog';
import { formatDuration } from '../../../utils/format';
import { buildCoverUrl } from '../../../utils/coverArt';
import { getActivityEmoji, getZoneForValue, getBpmBucketColor, getBpmBucketStart, MAX_DESCRIPTION_LENGTH } from '../../../appConfig';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';
import TopCompletionDate from '../../shared/TopCompletionDate';
import CompletionsList from '../../shared/CompletionsList';

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
 * --- Compacité (retour direct : "hauteur cumulée du bloc de droite doit
 * égaler celle de la pochette") ---
 * Pochette ramenée à une taille fixe unique (`w-32 h-32`, pas de cascade
 * responsive) et bloc de droite en `justify-center` + `gap-2` (au lieu d'un
 * `space-y-4` imbriqué + `mt-5` sur les actions) : titre/métadonnées/actions
 * restent groupés au plus près les uns des autres, sans grand vide ni
 * hauteur forcée à rattraper.
 *
 * --- Badge BPM/Zone (retour direct : "j'aimais bien le badge, juste tu
 * l'avais mis n'importe où avant") ---
 * Réintégré dans la rangée d'actions elle-même (`ml-auto`, aligné à droite
 * de "Partager"), plutôt qu'à un endroit séparé du reste de la carte (coin
 * de la carte, à côté des métadonnées...) essayé lors de passes
 * précédentes — un badge d'INFO qui vit avec les boutons d'action plutôt
 * que d'être un élément flottant à part entière. BPM moyen réel de la
 * playlist (même formule que SessionSummaryCard.jsx/StatsView.jsx/App.jsx —
 * jamais une 4e formule) ; libellé de zone ("• Seuil") SEULEMENT si un vrai
 * profil athlétique est configuré pour cette activité (`getZoneForValue`
 * STRICT, jamais OrDefault ici — ce badge affirme "calculé depuis TON
 * profil", même règle que `bpmSourceIsProfile`, useGeneratorForm.js) ; repli
 * sur la couleur neutre "Énergie Musicale" (`getBpmBucketColor`) sinon,
 * déjà utilisée par le camembert BPM (PlaylistDetailContext.jsx) et
 * TrackItem.jsx — jamais une 3e palette. `bpmChartActivityName` : reçue en
 * prop plutôt que recalculée ici, pour rester l'unique source de vérité
 * déjà partagée avec PlaylistCharts.jsx (résolution Mode Intime incluse).
 */
export default function PlaylistHeader({
  theme, isLocked, savedPlaylists,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  setPlaylistPlannedDate, bpmChartActivityName,
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate,
  getRankStyle, triggerCSVUpload,
  onShare,
}) {
  const { bgAccentClass } = theme;
  const {
    currentPlaylist, isSaved, getProfileForWorkout,
    isEditingPlaylistName, setIsEditingPlaylistName, editedPlaylistName, setEditedPlaylistName, handleRenamePlaylist,
    isEditingPlaylistDescription, setIsEditingPlaylistDescription, editedPlaylistDescription, setEditedPlaylistDescription, handleEditPlaylistDescription,
    handleSavePlaylist, handleUnsavePlaylist, handleTogglePlaylistPublic,
    handleClonePlaylist, isReadOnly,
  } = usePlaylistDetail();

  // BPM moyen réel de la playlist — même formule que SessionSummaryCard.jsx/
  // ImportSharedPlaylistModal.jsx/StatsView.jsx/App.jsx (`avgBpm`), jamais
  // recalculée différemment ici. `getZoneForValue` STRICT (pas OrDefault) :
  // `null` si l'activité n'a jamais été configurée dans le Profil Athlétique
  // — repli sur la couleur neutre "Énergie Musicale" du camembert BPM
  // (`getBpmBucketColor`) plutôt qu'une zone inventée.
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
  // individuellement via <CompletionsList/> ci-dessous.
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

  return (
    <div
      className={
        "relative w-full rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl backdrop-blur-md " +
        "bg-linear-to-br from-slate-900/90 via-slate-900/60 to-slate-800/40 " +
        "flex flex-col md:flex-row items-start gap-6 md:gap-8"
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

      {/* Badge "Lecture seule" — signale AVANT même de scroller jusqu'au
          bandeau du bas (TrackList.jsx) qu'un modèle pas encore sauvegardé
          ne peut pas être modifié (retirer/dupliquer/remplacer/réordonner
          un titre) — voir `canEditTracks`, TrackItem.jsx/TrackList.jsx pour
          l'application réelle de cette règle. Jamais affiché en même temps
          que la médaille de rang ci-dessus : un rang suppose des
          complétions, donc une playlist déjà sauvegardée. */}
      {!isSaved && (
        <span className="absolute top-4 right-4 bg-slate-800/80 border border-slate-700 text-slate-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5 z-10">
          <Lock size={12} /> Lecture seule
        </span>
      )}

      {/* Pochette — ombre profonde/diffuse + léger zoom au survol, pour
          détacher visuellement la pochette du fond sombre plutôt qu'un
          simple `shadow-inner` qui se fondait dans la carte. */}
      <div className="relative group/cover shrink-0 mx-auto md:mx-0">
        <button
          onClick={() => currentPlaylist.tracks[0] && resolveAndTogglePreview(currentPlaylist.tracks[0], getNextTrackForAutoAdvance)}
          title="Écouter cette playlist"
          className="relative w-32 h-32 rounded-xl overflow-hidden shadow-2xl shadow-black/70 cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
        >
          {/* Continuité visuelle avec PlaylistCard.jsx (Mes Séances) : même
              logique de pochette exactement — `coverUrl` si déjà posé
              (playlists ouvertes depuis Découvrir, voir App.jsx
              `openCuratedPlaylist`), sinon `buildCoverUrl(currentPlaylist.name)`
              (déterministe, utils/coverArt.js) — plus de repli sur un simple
              carré teinté + `coverIcon` (l'ancien design, qui ne matchait plus
              la vraie pochette déjà visible sur la carte au moment du clic). */}
          <img src={currentPlaylist.coverUrl || buildCoverUrl(currentPlaylist.name)} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Music2 size={56} className="text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-opacity duration-300 group-hover/cover:opacity-0" />
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
            <span className={`w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 scale-95 group-hover/cover:opacity-100 group-hover/cover:scale-100 transition-all duration-300 ${bgAccentClass}`}>
              <Play size={22} className="fill-white ml-0.5"/>
            </span>
          </div>
        </button>
      </div>

      {/* Bloc de droite — `md:h-32` reprend EXACTEMENT la hauteur de la
          pochette (`w-32 h-32` juste au-dessus, même valeur, une seule
          source de vérité en tête plutôt que devinée) : titre/métadonnées
          restent en haut dans leur flux naturel, et `mt-auto` sur la ligne
          d'actions (plus bas) la pousse tout en bas de ce bloc — son bas
          tombe donc exactement sur le bas de la pochette. Uniquement à
          partir de `md:` : en dessous, la pochette est empilée AU-DESSUS de
          ce bloc (pas à côté), donc rien à aligner sur sa hauteur ici. */}
      <div className="flex-1 flex flex-col md:h-32 gap-2 text-center md:text-left w-full min-w-0">
          {/* Fix UI (27/07, suite) : le wrapper `pr-32 md:pr-40` qui vivait
              ici a été retiré. Le bouton Thème (qui risquait de chevaucher
              ce titre) a déménagé dans le header fixe de Sidebar.jsx. Le
              bouton "Se connecter" (App.jsx), lui, reste flottant ICI MAIS
              conditionné à `!isGuestBarVisible` — or une playlist affichée
              sur CETTE vue implique forcément au moins une donnée
              (`savedPlaylists.length > 0`), donc GuestModeBar.jsx est déjà
              visible et ce bouton déjà masqué : ce titre est donc, dans les
              faits, TOUJOURS protégé sur cette vue précise, sans qu'aucun
              `pr-*` n'ait besoin d'être réintroduit ici. */}
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
                  <TopCompletionDate
                    playlist={currentPlaylist} theme={theme}
                    editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                    editCompletionDate={editCompletionDate}
                    isReadOnly={isReadOnly}
                  />
                </p>
              </div>
              {/* N'affiche cette liste que s'il reste au moins UNE date au-delà
                  de `completions[0]` (déjà montrée juste au-dessus) : sur une
                  séance jamais rejouée (le cas le plus courant), il n'y aurait
                  plus rien à montrer ici. */}
              {currentPlaylist.completions.length > 1 && (
                <div className="pt-0.5">
                  <CompletionsList
                    playlist={currentPlaylist} theme={theme}
                    hideUploadForDate={mostRecentCompletionIso} skipDates={[currentPlaylist.completions[0]]}
                    editingCompletion={editingCompletion} setEditingCompletion={setEditingCompletion}
                    editCompletionDate={editCompletionDate} removeCompletionDate={removeCompletionDate}
                    triggerCSVUpload={triggerCSVUpload}
                    isReadOnly={isReadOnly}
                  />
                </div>
              )}
            </div>
          )}

          {/* Titre éditable — text-2xl/text-4xl (plutôt que text-5xl) pour que
              la plupart des noms tiennent sur une ligne SANS être coupés, et
              `truncate` en filet de sécurité pour les noms vraiment longs. */}
          {isEditingPlaylistName ? (
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <input
                type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlaylist(); if (e.key === 'Escape') setIsEditingPlaylistName(false); }}
                className="text-xl font-bold bg-transparent outline-hidden border-b-2 border-rose-500 text-white w-full"
              />
              <button onClick={handleRenamePlaylist} className="p-2 rounded-lg text-white shrink-0 bg-rose-600 hover:bg-rose-500"><Check size={20}/></button>
            </div>
          ) : (
            <h2 className="text-xl font-bold flex items-center gap-3 justify-center md:justify-start text-white">
              <span className="truncate min-w-0" title={currentPlaylist.name}>{getActivityEmoji(currentPlaylist.workoutType)} {currentPlaylist.name}</span>
              {/* Renommer n'a de sens que pour une playlist déjà dans la
                  bibliothèque personnelle (`isSaved`) — sur un modèle pas
                  encore sauvegardé (bouton principal "Ajouter à Mes
                  Séances"), le nom affiché est celui du modèle d'origine,
                  pas encore "à soi" ; le renommer ici donnerait l'illusion
                  d'une sauvegarde qui n'a pas eu lieu. `!isReadOnly` ajouté
                  (relecture globale, 02/08) — même défense en profondeur
                  que le toggle public/le bouton CSV plus haut : `isSaved`
                  vaut TOUJOURS `false` pour une vraie playlist étrangère en
                  pratique, mais ce garde protège contre un futur
                  changement qui romprait cette hypothèse implicite sans y
                  penser. */}
              {isSaved && !isReadOnly && (
                <button onClick={() => { setEditedPlaylistName(currentPlaylist.name); setIsEditingPlaylistName(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0" title="Renommer la playlist">
                  <Edit3 size={20}/>
                </button>
              )}
            </h2>
          )}

          {/* Description libre (Vague 2, Chantier 3 — "description texte
              libre sur une playlist/routine publique", 02/08) — MÊME
              schéma exact que le nom éditable juste au-dessus (édition
              inline, `isSaved && !isReadOnly` pour l'affordance d'édition),
              à 2 différences : une `<textarea>` (texte plus long possible)
              plutôt qu'un `<input>`, et un état "pas encore de description"
              affiché comme une invite discrète plutôt qu'absent — une
              playlist SANS nom n'aurait aucun sens (le nom est donc
              toujours affiché, jamais cette 3e branche), une playlist SANS
              description est le cas de départ normal. Rendue même pour un
              visiteur (`isReadOnly`) : c'est justement le but de ce
              chantier — que la description soit visible sur le profil
              public, pas seulement pour le propriétaire. */}
          {isEditingPlaylistDescription ? (
            <div className="w-full space-y-1.5">
              <textarea
                autoFocus
                value={editedPlaylistDescription}
                onChange={e => setEditedPlaylistDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsEditingPlaylistDescription(false); }}
                placeholder="Ajoute une description (visible si cette playlist devient publique)..."
                rows={2}
                className="w-full text-sm bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 outline-hidden text-slate-200 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{editedPlaylistDescription.length}/{MAX_DESCRIPTION_LENGTH}</span>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingPlaylistDescription(false)} className="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors">Annuler</button>
                  <button onClick={handleEditPlaylistDescription} className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors">Enregistrer</button>
                </div>
              </div>
            </div>
          ) : currentPlaylist.description ? (
            <div className="flex items-start gap-2 text-sm text-slate-300 max-w-lg">
              {/* `line-clamp-2` (04/08, retour direct, capture d'écran : "casse
                  la mise en page" — description trop longue sans aucune limite
                  d'affichage). ⚠️ Ce composant était jusque-là DÉLIBÉRÉMENT
                  exempté de cette troncature (voir le commentaire dans
                  ProfileView.jsx : "le texte complet reste consultable [...]
                  dans la vue détail (PlaylistHeader.jsx)") — décision
                  RENVERSÉE explicitement au même retour direct : "plutôt
                  troncature sèche, [...] je m'en moque d'en couper" (pas de
                  vrais utilisateurs pour l'instant, donc pas de coût réel à
                  perdre l'accès au texte complet). Voir aussi
                  MAX_DESCRIPTION_LENGTH (appConfig.js), resserré au même
                  retour pour un compteur de caractères plus honnête.
                  ⚠️ 2e CORRECTIF (04/08, suite — le premier passage ajoutait
                  `line-clamp-2` seul, insuffisant) : `<p>` vit dans un
                  conteneur `flex` sans largeur propre — un item flex ne
                  descend jamais sous la largeur de son contenu par défaut
                  (`min-width: auto`), donc `line-clamp` n'avait rien pour
                  s'appuyer, quel que soit le texte. MÊME piège déjà
                  documenté dans ce projet (voir ViewHeader.jsx, commentaire
                  `min-w-0`). `flex-1 min-w-0` corrige : l'élément prend
                  l'espace disponible dans le conteneur `max-w-lg` du dessus
                  ET peut se contraindre sous sa largeur de contenu. */}
              <p className="whitespace-pre-line line-clamp-2 flex-1 min-w-0">{currentPlaylist.description}</p>
              {isSaved && !isReadOnly && (
                <button onClick={() => { setEditedPlaylistDescription(currentPlaylist.description || ''); setIsEditingPlaylistDescription(true); }} className="p-1 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="Modifier la description">
                  <Edit3 size={14}/>
                </button>
              )}
            </div>
          ) : (
            isSaved && !isReadOnly && (
              <button onClick={() => { setEditedPlaylistDescription(''); setIsEditingPlaylistDescription(true); }} className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">
                + Ajouter une description
              </button>
            )
          )}

          {/* Ligne d'infos de la playlist SEULES — icônes + `text-slate-300`
              (fixe, cohérent avec le fond toujours sombre de cette carte). */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-sm font-medium text-slate-300">
            <div className="flex items-center gap-1.5"><Activity size={16} className="text-slate-400"/><span>{currentPlaylist.workoutType}</span></div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400"/><span>{formatDuration(currentPlaylist.totalDuration)}</span></div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5"><Music size={16} className="text-slate-400"/><span>{currentPlaylist.tracks.length} titres</span></div>
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
                    <div className="flex items-center gap-1.5"><Music size={16} className="text-slate-400"/><span>{cfg.selectedGenres.map(genreDisplayLabel).join(', ')}</span></div>
                  </>
                );
              }
              const genres = Array.from(new Set(currentPlaylist.tracks.map(t => t.genre).filter(g => g && g !== 'Genre inconnu')));
              return genres.length > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <div className="flex items-center gap-1.5"><Music size={16} className="text-slate-400"/><span>{Array.from(new Set(genres.flatMap(getGenresForDisplay))).join(', ')}</span></div>
                </>
              );
            })()}
          </div>

          {/* Ligne d'actions — hiérarchie explicite : action PRINCIPALE d'abord
              (pleine, rose, mise en valeur), action secondaire (Partager)
              juste après, discrète. Import CSV (quand applicable) vient
              AVANT ce duo : c'est une action ponctuelle contextuelle liée à
              une séance déjà verrouillée, pas une des 2 actions "de base"
              toujours disponibles sur cette page. */}
          <div className="flex items-center flex-wrap justify-center md:justify-start gap-3 mt-auto">
            {isLocked && !isReadOnly && triggerCSVUpload && (
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
          )}

          {/* Action principale (1er position) : Sauvegarder (clone) si
              aperçu en lecture seule / Ajouter à Mes Séances / Retirer.
              `isReadOnly` VÉRIFIÉ EN PREMIER (Feature Sociale —
              Consultation/Clonage, 01/08) : `isSaved` (PlaylistDetailContext.jsx)
              vaut désormais TOUJOURS `false` quand `isReadOnly` est vrai —
              forcé explicitement dans son calcul depuis le correctif du
              02/08 (voir le commentaire "BUG CORRIGÉ" à sa déclaration :
              comparer seulement par `id` était insuffisant, la playlist de
              démonstration par défaut partage le même id sur chaque
              nouveau compte). Sans ce `isReadOnly` vérifié en premier ici,
              le cas retomberait de toute façon correctement grâce à ce
              correctif — mais le garder EN PREMIER reste plus direct que
              de compter sur une propriété dérivée d'un autre fichier, et
              évite en plus la branche "Ajouter à Mes Séances" habituelle,
              qui garderait à tort le même id que l'original (voir
              handleClonePlaylist, usePlaylistLibrary.js, pour le
              raisonnement complet sur pourquoi ça poserait problème). */}
          {isReadOnly ? (
            <button
              onClick={handleClonePlaylist}
              title="Sauvegarde une copie personnelle de cette playlist, modifiable, dans 'Mes Séances'."
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm shrink-0 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-colors"
            >
              <Save size={16} /> <span>Sauvegarder dans mes séances</span>
            </button>
          ) : isSaved ? (
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
              clairement une action secondaire face à Ajouter/Retirer.
              `!isReadOnly` ajouté (relecture globale, 02/08) — même défense
              en profondeur que le renommage/le toggle public/le bouton CSV. */}
          {isSaved && !isReadOnly && (
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

          {/* Bascule publique/privée INDIVIDUELLE (Feature Sociale —
              Refonte Structurale Round 2/2, 01/08, retour direct : "activer
              une option dans les 2 vues pour faire de l'individuel") —
              visible UNIQUEMENT une fois la playlist sauvegardée
              (`isSaved`) : une playlist qui n'existe pas encore dans
              "Mes Séances" n'a pas de ligne dans la table `playlists`,
              rien à rendre public. Prime sur le réglage par défaut de
              SettingsView.jsx, qui ne sert qu'à préremplir cette valeur
              AU MOMENT de la sauvegarde initiale — modifiable ici à tout
              moment ensuite, dans un sens comme dans l'autre.
              `!isReadOnly` ajouté (01/08, trouvé en écrivant les tests de
              ce fichier) — défense en profondeur, même principe exact que
              le bouton CSV plus haut : `isSaved` vaut TOUJOURS `false`
              pour une vraie playlist étrangère en pratique (voir
              PlaylistDetailContext.jsx), donc ce garde ne change rien
              aujourd'hui, mais protège contre un futur changement qui
              romprait cette hypothèse implicite sans y penser. */}
          {isSaved && !isReadOnly && (
            <button
              onClick={handleTogglePlaylistPublic}
              title={currentPlaylist.isPublic ? "Visible sur ton profil public — clique pour la rendre privée" : "Rendre cette playlist visible sur ton profil public"}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shrink-0 border transition-colors ${
                currentPlaylist.isPublic
                  ? 'bg-emerald-600/20 border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/30'
                  : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Globe size={16} /> <span>{currentPlaylist.isPublic ? 'Publique' : 'Rendre publique'}</span>
            </button>
          )}

          {/* Badge BPM/Zone — `ml-auto` le pousse à droite des boutons dans
              CETTE MÊME rangée (retour direct : plus jamais un élément
              flottant isolé ailleurs sur la carte, voir docstring). */}
          {bpmBadgeColor && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ml-auto"
              style={{ backgroundColor: `${bpmBadgeColor}26`, borderColor: `${bpmBadgeColor}66`, color: bpmBadgeColor }}
            >
              <Gauge size={14} />
              <span>{avgBpm} BPM{bpmZone ? ` • ${bpmZone.shortLabel}` : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
