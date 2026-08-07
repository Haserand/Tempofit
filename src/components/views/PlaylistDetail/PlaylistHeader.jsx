import { useRef, useMemo } from 'react';
import {
  Edit3, Save, CheckCircle, Share2, Activity, Clock, Music, Music2, Play,
  Calendar, Lock, Upload, Trash2, Gauge, Globe, X, Copy,
} from 'lucide-react';
import { getGenresForDisplay, genreDisplayLabel } from '../../../musicCatalog';
import { formatDuration } from '../../../utils/format';
import { buildCoverUrl } from '../../../utils/coverArt';
import { getActivityEmoji, getZoneForValue, getBpmBucketColor, getBpmBucketStart, MAX_DESCRIPTION_LENGTH } from '../../../appConfig';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';
import { OFFICIAL_VITRINE_DISPLAY_NAME } from '../../../data/curatedSessions';
import { OFFICIAL_VITRINE_USERNAME } from '../../../data/officialVitrineProfile';
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
  getRankStyle, triggerCSVUpload, removeImportedData,
  onShare, onViewProfile,
}) {
  const { bgAccentClass } = theme;
  const {
    currentPlaylist, isSaved, getProfileForWorkout,
    isEditingPlaylistDetails, setIsEditingPlaylistDetails,
    editedPlaylistName, setEditedPlaylistName, editedPlaylistDescription, setEditedPlaylistDescription,
    handleSavePlaylistDetails,
    handleSavePlaylist, handleUnsavePlaylist, handleTogglePlaylistPublic,
    handleClonePlaylist, isReadOnly, username,
  } = usePlaylistDetail();

  // Étiquette "propriétaire actuel" (05/08, retour direct : "ajouter le nom
  // du compte créateur... quand je suis dans sa playlist en vitrine, et mon
  // nom une fois que je suis dans ma playlist sauvegardée") — une fois
  // `isSaved` (peu importe l'origine — template, clonage, génération
  // fraîche), c'est TOI le propriétaire dans "Mes Séances", donc TON pseudo
  // (`username`, PlaylistDetailContext.jsx — re-transmis depuis
  // AuthContext.jsx via App.jsx). Tant que ce n'est PAS encore sauvegardé
  // (aperçu en lecture seule, ou brouillon fraîchement généré) : le
  // CRÉATEUR d'origine — soit "TempoFit Officiel" pour un template du
  // catalogue (`sourceTemplateId`, posé par openCuratedPlaylist,
  // useNavigation.js — présent que la prévisualisation vienne de la
  // vitrine `@tempofit_officiel` OU d'un clic direct dans "Découvrir",
  // les deux cas doivent afficher le même créateur), soit le pseudo du
  // vrai propriétaire pour une playlist étrangère (`ownerUsername`, posé
  // par ProfileView.jsx via `handleOpenPublicPlaylist`, App.jsx — la SEULE
  // information qu'on ait sur lui, `user_id` n'étant qu'un UUID sans
  // valeur d'affichage). `null` si aucun des deux (génération fraîche pas
  // encore sauvegardée) — rien à afficher, pas encore "à" quelqu'un au
  // sens de cette étiquette.
  // ⚠️ CORRIGÉ (05/08, retour direct, capture annotée) : "TempoFit
  // Officiel" via `OFFICIAL_VITRINE_DISPLAY_NAME` (curatedSessions.js —
  // centralisé le même jour, "règles à harmoniser dans un fichier ?" :
  // même chaîne réutilisée 35 fois pour `author:` dans ce fichier, plus
  // cette 36e copie qui venait d'être ajoutée ici en dur) plutôt que
  // `OFFICIAL_VITRINE_USERNAME` ('tempofit_officiel', le pseudo TECHNIQUE
  // utilisé pour l'URL/les mentions @, tout en minuscules) — "faut les
  // majuscules si y en a pour cohérence". Un vrai pseudo utilisateur
  // (`username`/`ownerUsername`), lui, est TOUJOURS en minuscules par
  // construction (`USERNAME_REGEX`, utils/username.js,
  // `/^[a-z0-9_]{3,20}$/`) — rien à corriger de ce côté, aucun pseudo réel
  // ne peut contenir de majuscule.
  // ⚠️ BUG CORRIGÉ (05/08, retour direct — capture montrant l'espace vide
  // sous la pochette : "je suis en mode invité, par défaut mets 'Guest
  // Mode' plutôt que rien") : `username` vaut `null` en mode invité (pas
  // de compte, voir AuthContext.jsx) — `ownerLabel` retombait donc sur
  // `null` lui aussi dans la branche `isSaved`, laissant l'étiquette
  // silencieusement invisible plutôt que d'expliquer pourquoi. Repli sur
  // "Invité" — MÊME mot que la convention déjà en place ailleurs dans
  // l'app pour ce même état (Sidebar.jsx, en-tête de section "Mon Espace
  // • Invité"), pas l'anglais "Guest Mode" proposé dans le retour direct :
  // cohérence avec l'existant plutôt qu'un 2e vocabulaire pour la même
  // notion.
  const ownerLabel = isSaved
    ? (username || 'Invité')
    : (currentPlaylist.sourceTemplateId ? OFFICIAL_VITRINE_DISPLAY_NAME : currentPlaylist.ownerUsername) || null;

  // Pseudo TECHNIQUE (07/08, retour direct : "cliquer sur le pseudo devrait
  // amener à sa vue statistiques") — DISTINCT d'`ownerLabel` ci-dessus, qui
  // ne porte que la valeur D'AFFICHAGE ("TempoFit Officiel", en majuscules,
  // n'est PAS un vrai pseudo utilisable pour la navigation — voir
  // `handleViewProfile`, App.jsx, qui attend le pseudo réel/technique,
  // toujours en minuscules par construction, `USERNAME_REGEX`). Seulement
  // dans la branche `!isSaved` (quelqu'un D'AUTRE a fait cette playlist) —
  // volontairement PAS de navigation pour ton PROPRE pseudo sur ta propre
  // playlist sauvegardée (branche `isSaved`), ni demandé ni évidemment
  // utile (naviguer vers son propre profil depuis sa propre playlist).
  // Même repli que `ownerLabel` : vitrine (`sourceTemplateId`) → pseudo
  // technique de la vitrine (`OFFICIAL_VITRINE_USERNAME`, minuscules,
  // importé d'`officialVitrineProfile.js` — PAS `OFFICIAL_VITRINE_DISPLAY_NAME`,
  // qui n'est qu'un texte d'affichage) ; sinon `ownerUsername` (déjà le
  // vrai pseudo technique d'un propriétaire réel, posé par ProfileView.jsx
  // via `handleOpenPublicPlaylist`, App.jsx — rien à transformer).
  const ownerProfileUsername = !isSaved
    ? (currentPlaylist.sourceTemplateId ? OFFICIAL_VITRINE_USERNAME : currentPlaylist.ownerUsername) || null
    : null;

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
  //
  // ⚠️ OPTIMISATION (audit perf, 07/08 — même famille que le correctif déjà
  // fait dans RoutinesView.jsx le 05/08 et PlaylistsView.jsx plus tôt
  // aujourd'hui, cherché ici aussi par principe une fois le pattern
  // identifié) : ce tri tournait sur CHAQUE rendu de ce composant SANS
  // `useMemo` — y compris chaque frappe en train de renommer cette même
  // playlist ou d'éditer sa description (`editedPlaylistName`/
  // `editedPlaylistDescription`, state local au Provider
  // `PlaylistDetailContext.jsx`, inclus dans la valeur du Contexte : CHAQUE
  // frappe re-render tous les consommateurs du Contexte, dont ce composant
  // lui-même). Moins coûteux en absolu qu'une boucle O(n²) sur une grille de
  // cartes (ici un seul tri, pas répété N fois) — mais le même gaspillage à
  // chaque frappe, sur TOUTE la collection `savedPlaylists`, pour ne lire
  // au final qu'UN SEUL rang. `savedPlaylists` (reçu en prop depuis
  // App.jsx via `PlaylistDetailView.jsx`) reste RÉFÉRENTIELLEMENT stable
  // pendant la frappe (seul le state d'édition change, pas la collection
  // elle-même) — `useMemo([savedPlaylists, currentPlaylist.id])` élimine
  // donc bien tout recalcul inutile pendant l'édition.
  const currentPlaylistRank = useMemo(() => {
    const ranks = [...savedPlaylists.filter(p => p.completions && p.completions.length > 0)]
      .sort((a, b) => b.completions.length - a.completions.length)
      .map(p => p.id);
    return ranks.indexOf(currentPlaylist.id);
  }, [savedPlaylists, currentPlaylist.id]);
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
          complétions, donc une playlist déjà sauvegardée.
          Icône seule + `title` (05/08, retour direct : "le cadenas me
          semble suffisant... surtout si tu mets une infobulle au survol")
          — le libellé texte "Lecture seule" retiré, le cadenas seul porte
          déjà le sens ; `title` natif du navigateur fournit l'explication
          complète au survol, sans lester en permanence l'en-tête pour ce
          qui reste un statut secondaire (contrairement au nom/aux stats,
          jamais l'info qu'on vient chercher en premier ici). Padding
          resserré à `p-2` (symétrique) plutôt que `px-3 py-1` (pensé pour
          icône+texte) — un badge icône seule reste circulaire et compact,
          pas une pilule allongée sans texte pour la justifier. */}
      {!isSaved && (
        <span
          title="Lecture seule — tu ne peux pas modifier cette playlist tant qu'elle n'est pas ajoutée à Mes Séances"
          className="absolute top-4 right-4 bg-slate-800/80 border border-slate-700 text-slate-300 p-2 rounded-full flex items-center justify-center z-10"
        >
          <Lock size={12} />
        </span>
      )}

      {/* Bloc d'actions icône seule en coin (`top-4 right-4`, même
          emplacement que le badge "Lecture seule" juste au-dessus — les
          deux blocs ne s'affichent jamais ensemble : l'un exige `!isSaved`,
          l'autre `isSaved`) — Rendre publique/privée (Globe) PUIS Retirer
          (Trash2), dans cet ordre, MÊME ordre que PlaylistCard.jsx ("Mes
          Séances" en carte) pour rester cohérent avec ce pattern déjà
          établi là-bas.
          RETOUR DIRECT (05/08), 2 points sur ce bloc :
          1. "Rendre publique" (auparavant un bouton texte+icône dans la
             ligne d'actions principale, à côté de Partager/Planifier) suit
             désormais la MÊME logique que Retirer : icône seule, même
             ligne, à gauche de la corbeille — transposition directe du
             pattern Globe+Trash déjà en place sur la carte de
             PlaylistCard.jsx (mêmes `title`, même logique "toujours coloré
             si déjà public, gris + résolu au survol sinon").
          2. Le fond circulaire de la corbeille (ajouté au 1er passage de ce
             bloc) était VISIBLE EN PERMANENCE (`bg-slate-800/80 border
             border-slate-700`) — pas la convention du reste de l'app pour
             un bouton icône seule ACTIONNABLE (voir `ICON_BUTTON_ROUNDING`,
             MiniPlayerBar.jsx/GuestModeBar.jsx/EditRoutineModal.jsx : icône
             seule nue, fond/couleur uniquement au survol direct du bouton).
             Corrigé ici aux 2 boutons — le fond n'apparaît plus qu'au
             survol, jamais en repos. Le badge "Lecture seule" juste
             au-dessus GARDE son fond permanent, volontairement : c'est un
             STATUT à signaler passivement (pas une action), pas le même
             rôle que ces 2 boutons.
          `!isReadOnly` explicite EN PLUS de `isSaved` sur les 2 conditions
          (voir la docstring de la bascule publique/privée plus bas dans ce
          fichier pour le même raisonnement "défense en profondeur"). */}
      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        {/* Coexiste avec la médaille de rang (`-top-2 -right-2`, juste
            au-dessus dans ce fichier) sans collision de principe : offsets
            diagonaux différents, la médaille pointe hors de la carte au
            coin, ce bloc reste à l'intérieur — à confirmer visuellement en
            conditions réelles pour une playlist À LA FOIS classée ET
            sauvegardée, seul cas qui les combine. */}
        {isSaved && !isReadOnly && (
          <button
            onClick={handleTogglePlaylistPublic}
            title={currentPlaylist.isPublic ? "Visible sur ton profil public — clique pour la rendre privée" : "Rendre cette playlist visible sur ton profil public"}
            className={`p-2 rounded-full flex items-center justify-center transition-colors ${
              currentPlaylist.isPublic
                ? 'text-emerald-400 hover:bg-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
          >
            <Globe size={14} />
          </button>
        )}
        {isSaved && !isReadOnly && (
          <button
            onClick={handleUnsavePlaylist}
            title="Retirer cette séance de 'Mes Séances'"
            className="p-2 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

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
        {/* Étiquette "propriétaire actuel" + compteur de clonages — DÉPLACÉS
            (07/08, retour direct, capture annotée : "mettre les pseudos
            avant le nom de la playlist, et le compteur de clones, sur la
            même ligne") — vivaient ici, sous la pochette, PHYSIQUEMENT
            déconnectés du compteur de clonages (resté à côté du titre,
            colonne de droite) alors que les deux décrivent la même chose
            (qui a fait cette séance, quel accueil elle a eu). Regroupés
            maintenant en une seule ligne "chapeau" AU-DESSUS du titre,
            colonne de droite — voir plus bas. Rien à afficher ici sous la
            pochette désormais. */}
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
          {/* Ligne "chapeau" — pseudo (cliquable si applicable) + compteur
              de clonages, AU-DESSUS du titre (07/08, retour direct, capture
              annotée : "mettre les pseudos avant le nom de la playlist, et
              le compteur de clones, sur la même ligne" — pattern déjà
              éprouvé ailleurs, ex. Spotify "Playlist par X"). Remplace 2
              emplacements séparés qui décrivaient pourtant la même famille
              d'info (qui a fait cette séance, quel accueil elle a eu) :
              l'étiquette propriétaire vivait sous la pochette (colonne de
              gauche), le compteur de clonages à côté du titre (colonne de
              droite) — visuellement déconnectés sans raison. Appliqué de
              façon cohérente aux 3 endroits concernés (retour direct
              explicite) : ici (fiche détail), TemplateCard.jsx (cartes
              Découvrir), PlaylistCard.jsx (Mes Séances, TON PROPRE pseudo
              — pas de compteur de clonages là, `cloneCount` reste TOUJOURS
              `undefined` pour une playlist déjà sauvegardée, voir la
              docstring du badge plus bas).
              Séparateur `•` — MÊME convention que la ligne de métadonnées
              juste en dessous (`text-slate-600`), pas un style inventé ici.
              `ownerLabel`/`ownerProfileUsername` inchangés (calculés plus
              haut) — seul l'EMPLACEMENT bouge, pas la logique qui décide
              QUOI afficher/QUAND c'est cliquable (voir leurs docstrings
              respectives pour ce raisonnement, toujours valable).
              Compteur gaté sur `currentPlaylist.cloneCount !== undefined`
              (07/08, historique important, gardé ici) — PAS `isReadOnly`
              seul (raisonnement d'origine, 05/08 : "cloneCount vaut
              undefined pour tout le reste... donc isReadOnly seul suffit"
              — hypothèse fausse : un template ouvert DIRECTEMENT depuis
              Découvrir, `TemplateCard.jsx` → `openCuratedPlaylist`, reçoit
              bien un `cloneCount` réel SANS `isReadOnly: true` à côté —
              seul le chemin vitrine pose les deux ensemble). Ne PAS
              remettre `isReadOnly: true` côté Découvrir direct pour
              "corriger" ça autrement : ce flag pilote AUSSI le bouton
              d'action principal plus bas (Sauvegarder/Cloner vs Ajouter à
              Mes Séances), une distinction VOLONTAIRE (voir le README :
              "le clonage ne s'incrémente QUE via 'Cloner'... jamais via
              'Utiliser ce modèle' dans Découvrir"). TOUJOURS affiché même
              à 0, mêmes icône/gabarit que TemplateCard.jsx — signature
              visuelle cohérente partout où ce compteur apparaît. */}
          {ownerLabel && (
            <div className="flex items-center gap-2 justify-center md:justify-start text-xs font-bold text-slate-400">
              {ownerProfileUsername && onViewProfile ? (
                <button
                  onClick={() => onViewProfile(ownerProfileUsername)}
                  title={`Voir le profil de ${ownerLabel}`}
                  className="truncate hover:underline hover:text-slate-200 cursor-pointer"
                >
                  {ownerLabel}
                </button>
              ) : (
                <span
                  title={isSaved ? 'Cette playlist est dans ta bibliothèque' : `Créée par ${ownerLabel}`}
                  className="truncate"
                >
                  {ownerLabel}
                </span>
              )}
              {currentPlaylist.cloneCount !== undefined && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1 shrink-0" title="Nombre de fois où cette playlist a été clonée">
                    <Copy size={11} />{currentPlaylist.cloneCount || 0}
                  </span>
                </>
              )}
            </div>
          )}

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
                    triggerCSVUpload={triggerCSVUpload} removeImportedData={removeImportedData}
                    isReadOnly={isReadOnly}
                  />
                </div>
              )}
            </div>
          )}

          {/* Titre + description — ÉDITION FUSIONNÉE (08/08, retour direct,
              capture annotée : "que modifier le titre ou la description
              vienne un seul crayon plutôt que via chacune une option
              individuelle" — précédent cité, Spotify "Modifier les
              détails", gardé INLINE ici plutôt qu'une modale sur
              confirmation explicite). Un SEUL crayon (sur le titre,
              affiché seulement `isSaved && !isReadOnly`, même garde qu'avant)
              ouvre l'édition des DEUX champs ensemble — pré-remplit les 2
              brouillons AVANT de basculer `isEditingPlaylistDetails`, pour
              que rien ne parte d'un état vide au 1er rendu de l'édition.
              text-2xl/text-4xl (plutôt que text-5xl) pour que la plupart
              des noms tiennent sur une ligne SANS être coupés, `truncate`
              en filet de sécurité pour les noms vraiment longs. */}
          {isEditingPlaylistDetails ? (
            <div className="w-full space-y-2">
              <input
                type="text" autoFocus value={editedPlaylistName} onChange={e => setEditedPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlaylistDetails(); if (e.key === 'Escape') setIsEditingPlaylistDetails(false); }}
                className="text-xl font-bold bg-transparent outline-hidden border-b-2 border-rose-500 text-white w-full"
              />
              {/* Pas de gestion `Enter` ici (contrairement au champ nom
                  juste au-dessus) — Entrée dans une `<textarea>` insère un
                  retour à la ligne, comportement natif attendu pour un
                  texte multi-lignes, jamais une soumission prématurée. */}
              <textarea
                value={editedPlaylistDescription}
                onChange={e => setEditedPlaylistDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsEditingPlaylistDetails(false); }}
                placeholder="Ajoute une description (visible si cette playlist devient publique)..."
                rows={2}
                className="w-full text-sm bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 outline-hidden text-slate-200 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{editedPlaylistDescription.length}/{MAX_DESCRIPTION_LENGTH}</span>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingPlaylistDetails(false)} className="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors">Annuler</button>
                  <button onClick={handleSavePlaylistDetails} className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors">Enregistrer</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold flex items-center gap-3 justify-center md:justify-start text-white">
                <span className="truncate min-w-0" title={currentPlaylist.name}>{getActivityEmoji(currentPlaylist.workoutType)} {currentPlaylist.name}</span>
                {/* Compteur de clonages — vit dans la ligne "chapeau"
                    au-dessus du titre, avec le pseudo (voir sa docstring
                    plus haut). Rien à afficher ici, à côté du titre. */}
                {/* Éditer n'a de sens que pour une playlist déjà dans la
                    bibliothèque personnelle (`isSaved`) — sur un modèle pas
                    encore sauvegardé (bouton principal "Ajouter à Mes
                    Séances"), le nom/la description affichés sont ceux du
                    modèle d'origine, pas encore "à soi" ; les modifier ici
                    donnerait l'illusion d'une sauvegarde qui n'a pas eu
                    lieu. `!isReadOnly` ajouté (relecture globale, 02/08) —
                    même défense en profondeur que le toggle public/le
                    bouton CSV plus haut : `isSaved` vaut TOUJOURS `false`
                    pour une vraie playlist étrangère en pratique, mais ce
                    garde protège contre un futur changement qui romprait
                    cette hypothèse implicite sans y penser. */}
                {isSaved && !isReadOnly && (
                  <button
                    onClick={() => {
                      setEditedPlaylistName(currentPlaylist.name);
                      setEditedPlaylistDescription(currentPlaylist.description || '');
                      setIsEditingPlaylistDetails(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
                    title="Modifier le titre et la description"
                  >
                    <Edit3 size={20}/>
                  </button>
                )}
              </h2>
              {/* Description en lecture seule — plus d'invite "+ Ajouter
                  une description" ni de crayon dédié ici (retirés le
                  08/08, fusionnés dans le crayon du titre ci-dessus) :
                  rien à afficher du tout si la description est vide,
                  contrairement à avant. Rendue même pour un visiteur
                  (`isReadOnly`) — la description reste visible sur le
                  profil public, seule l'AFFORDANCE d'édition disparaît
                  (déjà géré par le crayon plus haut, absent si
                  `isReadOnly`). */}
              {currentPlaylist.description && (
                <div className="flex items-start gap-2 text-sm text-slate-300 max-w-lg">
                  {/* `line-clamp-1` (05/08, retour direct — clarification de
                      la demande du 04/08 : "je voulais UNE ligne max ; pas
                      2"). `flex-1 min-w-0` : même piège déjà documenté dans
                      ce projet (ViewHeader.jsx, commentaire `min-w-0`) — un
                      item flex ne descend jamais sous la largeur de son
                      contenu par défaut, `line-clamp` n'a alors rien pour
                      s'appuyer. */}
                  <p className="whitespace-pre-line line-clamp-1 flex-1 min-w-0">{currentPlaylist.description}</p>
                </div>
              )}
            </>
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
                {/* Retirer les données importées — NOUVEAU (05/08, retour
                    direct : "je dois pouvoir retirer des données importées
                    si je me trompe de fichier"). Jusqu'ici, la SEULE façon
                    de corriger un mauvais import était d'en réimporter un
                    autre par-dessus (le bouton juste à gauche écrase déjà
                    `actualDataByDate[date]` sans poser de question) — ça
                    suppose d'avoir le BON fichier sous la main tout de
                    suite, impossible de simplement revenir à "rien
                    d'importé". `removeImportedData` (useCsvImport.js) fait
                    ça proprement (retire juste cette clé, ne touche à rien
                    d'autre). Visible UNIQUEMENT si des données existent
                    déjà (`hasImportedDataForMostRecent`) — rien à retirer
                    sinon. `removeImportedData &&` en garde (comme
                    `triggerCSVUpload` juste au-dessus) : prop optionnelle,
                    ce composant ne doit pas planter si un futur appelant ne
                    la fournit pas.
                    ⚠️ Même trou existe dans CompletionsList.jsx (icône
                    Upload par date de complétion, même limite "remplacer
                    seulement") — PAS traité ici : cette pastille inline est
                    déjà dense (date + import + retirer-la-date), un 4e
                    élément mérite d'être confirmé séparément avant d'y être
                    ajouté plutôt que d'être supposé aller de soi. */}
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

          {/* Action principale (1er position) : Sauvegarder (clone) si
              aperçu en lecture seule / Ajouter à Mes Séances. "Retirer"
              déplacé le 05/08 (retour direct — icône seule en coin, voir
              le bouton corbeille `top-4 right-4` plus haut dans ce fichier,
              même emplacement que le badge "Lecture seule") : ce n'est
              donc plus une des 3 branches ici, `isSaved` retombe sur
              `null` (rien à afficher dans CETTE rangée pour ce cas — la
              corbeille en coin suffit).
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
          ) : isSaved ? null : (
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

          {/* Bascule publique/privée — icône seule déplacée en haut à
              droite (05/08, retour direct : même traitement que "Retirer",
              voir le bloc `top-4 right-4` en tête de ce fichier). Plus
              rien à rendre ici : `isSaved && !isReadOnly` gère déjà tout
              là-bas, avec le même garde-fou. */}

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
