import { useRef, useMemo } from 'react';
import { getZoneForValue, getBpmBucketColor, getBpmBucketStart } from '../../../appConfig';
import { usePlaylistDetail } from '../../../contexts/PlaylistDetailContext';
import { OFFICIAL_VITRINE_DISPLAY_NAME } from '../../../data/curatedSessions';
import { OFFICIAL_VITRINE_USERNAME } from '../../../data/officialVitrineProfile';
import PlaylistHeaderBadges from './PlaylistHeaderBadges';
import PlaylistHeaderCover from './PlaylistHeaderCover';
import PlaylistHeaderTitleBlock from './PlaylistHeaderTitleBlock';
import PlaylistHeaderMeta from './PlaylistHeaderMeta';
import PlaylistHeaderActions from './PlaylistHeaderActions';

/**
 * PlaylistHeader.jsx — en-tête de PlaylistDetailView : pochette, titre
 * (édition inline), badge de dernière complétion (si verrouillée), et
 * rangée d'actions (import CSV, planifier, partager, sauvegarder/retirer).
 *
 * ⚠️ DÉCOUPÉ (08/08, ce fichier faisait 836 lignes) en 5 sous-composants
 * "dumb" (uniquement du rendu, aucun état/calcul propre) dans ce même
 * dossier — voir chacun pour le détail du bloc qu'il rend :
 * `PlaylistHeaderBadges.jsx` (médaille de rang, compteur de clonages —
 * déplacé ici le 10/08 —, badge "séance déjà réalisée"+date la plus
 * récente — déplacé ici le 22/08, voir sa docstring —, "Lecture seule",
 * boutons publique/privée+retirer en overlay), `PlaylistHeaderCover.jsx`
 * (pochette), `PlaylistHeaderTitleBlock.jsx` (titre/description édition
 * fusionnée), `PlaylistHeaderMeta.jsx` (pseudo — déplacé ici le 10/08,
 * voir sa docstring —, ligne d'infos, liste des AUTRES dates de
 * complétion), et `PlaylistHeaderActions.jsx` (import CSV, action
 * principale, planifier, partager, badge BPM). CE fichier reste le seul à calculer les valeurs
 * PARTAGÉES entre plusieurs de ces blocs (`ownerLabel`/`avgBpm`/
 * `currentPlaylistRank`/etc.) et à posséder `usePlaylistDetail()` — les
 * sous-composants les reçoivent tous en props, jamais recalculés en double.
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
 * Le conteneur est un verre dépoli SOMBRE FIXE (`slate-900` en dégradé),
 * volontairement indépendant du thème clair/sombre choisi par
 * l'utilisateur — même logique qu'un en-tête d'album Spotify. Conséquence
 * directe : tout le texte/les boutons DANS cette carte (y compris dans
 * les 5 sous-composants ci-dessus) utilisent une palette FIXE
 * claire-sur-sombre, jamais `theme.textMuted`/`cardBorder` (pensées pour
 * un fond adaptatif). Seul `theme.bgAccentClass` reste utilisé (bouton
 * play au survol de la pochette, `PlaylistHeaderCover.jsx`).
 *
 * --- Compacité (retour direct : "hauteur cumulée du bloc de droite doit
 * égaler celle de la pochette") ---
 * Pochette à taille fixe (`w-32 h-32`) et bloc de droite en
 * `justify-center` + `gap-2` : titre/métadonnées/actions restent groupés
 * au plus près, `mt-auto` sur la rangée d'actions la pousse tout en bas.
 *
 * --- Badge BPM/Zone ---
 * Vit dans la rangée d'actions elle-même (`ml-auto`, tout à droite),
 * jamais un élément flottant à part. BPM moyen réel de la playlist (même
 * formule que SessionSummaryCard.jsx/StatsView.jsx/App.jsx) ; libellé de
 * zone SEULEMENT si un vrai profil athlétique est configuré
 * (`getZoneForValue` STRICT) ; repli sur la couleur neutre "Énergie
 * Musicale" (`getBpmBucketColor`) sinon.
 */
export default function PlaylistHeader({
  theme, isLocked, savedPlaylists,
  resolveAndTogglePreview, getNextTrackForAutoAdvance,
  setPlaylistPlannedDate, bpmChartActivityName,
  editingCompletion, setEditingCompletion, editCompletionDate, removeCompletionDate,
  getRankStyle, triggerCSVUpload, removeImportedData,
  onShare, onViewProfile, changeView,
}) {
  const { bgAccentClass } = theme;
  const {
    currentPlaylist, isSaved, getProfileForWorkout,
    handleSavePlaylist, handleUnsavePlaylist, handleTogglePlaylistPublic,
    handleClonePlaylist, isReadOnly, username,
  } = usePlaylistDetail();

  // Étiquette "propriétaire actuel" — une fois `isSaved` (peu importe
  // l'origine — template, clonage, génération fraîche), c'est TOI le
  // propriétaire dans "Mes Playlists", donc TON pseudo (`username`,
  // PlaylistDetailContext.jsx). Tant que ce n'est PAS encore sauvegardé :
  // le CRÉATEUR d'origine — "TempoFit Officiel" pour un template du
  // catalogue (`sourceTemplateId`), soit le pseudo du vrai propriétaire
  // pour une playlist étrangère (`ownerUsername`). `null` si aucun des
  // deux (génération fraîche pas encore sauvegardée).
  // Repli "Invité" en mode invité (`username === null`) — même mot que la
  // convention déjà en place ailleurs dans l'app pour ce même état
  // (Sidebar.jsx, "Mon Espace • Invité").
  const ownerLabel = isSaved
    ? (username || 'Invité')
    : (currentPlaylist.sourceTemplateId ? OFFICIAL_VITRINE_DISPLAY_NAME : currentPlaylist.ownerUsername) || null;

  // Pseudo TECHNIQUE — DISTINCT d'`ownerLabel` ci-dessus, qui ne porte
  // que la valeur D'AFFICHAGE. Seulement dans la branche `!isSaved`
  // (quelqu'un D'AUTRE a fait cette playlist) — volontairement PAS de
  // navigation pour ton PROPRE pseudo sur ta propre playlist sauvegardée.
  // Même repli que `ownerLabel` : vitrine → pseudo technique de la
  // vitrine (`OFFICIAL_VITRINE_USERNAME`, PAS `OFFICIAL_VITRINE_DISPLAY_NAME`,
  // qui n'est qu'un texte d'affichage) ; sinon `ownerUsername` (déjà le
  // vrai pseudo technique).
  const ownerProfileUsername = !isSaved
    ? (currentPlaylist.sourceTemplateId ? OFFICIAL_VITRINE_USERNAME : currentPlaylist.ownerUsername) || null
    : null;

  // BPM moyen réel de la playlist — même formule que SessionSummaryCard.jsx/
  // ImportSharedPlaylistModal.jsx/StatsView.jsx/App.jsx (`avgBpm`), jamais
  // recalculée différemment ici. `getZoneForValue` STRICT (pas OrDefault) :
  // `null` si l'activité n'a jamais été configurée dans le Profil Athlétique.
  const avgBpm = currentPlaylist.tracks.length > 0
    ? Math.round(currentPlaylist.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / currentPlaylist.tracks.length)
    : null;
  const bpmZone = avgBpm != null ? getZoneForValue(avgBpm, bpmChartActivityName, getProfileForWorkout) : null;
  const bpmBadgeColor = bpmZone ? bpmZone.color : (avgBpm != null ? getBpmBucketColor(getBpmBucketStart(avgBpm)) : null);

  // Filet de sécurité multi-navigateurs pour le bouton "Planifier" : un
  // <input type="date"> rendu invisible et superposé à un <label> s'ouvre
  // au clic dans la plupart des navigateurs, mais pas de façon fiable
  // partout (Safari en particulier) — d'où `showPicker()` explicite,
  // voir PlaylistHeaderActions.jsx.
  const plannedDateInputRef = useRef(null);

  // --- CTA "Importer mes données" ---
  // Cible la date de complétion la plus RÉCENTE (celle qu'on vient de
  // marquer/refaire est la plus probable à vouloir enrichir) plutôt que
  // d'exiger que la personne choisisse elle-même laquelle. Les dates plus
  // anciennes restent gérables individuellement via <CompletionsList/>.
  const mostRecentCompletionIso = isLocked ? currentPlaylist.completions[currentPlaylist.completions.length - 1] : null;
  const hasImportedDataForMostRecent = !!(mostRecentCompletionIso && currentPlaylist.actualDataByDate && currentPlaylist.actualDataByDate[mostRecentCompletionIso]);

  // Médaille "la plus/2e plus/3e plus utilisée" — même logique de classement
  // recalculée localement (mêmes filtre + tri que PlaylistsView.jsx), plutôt
  // qu'un classement centralisé transmis en prop — cohérent avec
  // RoutinesView.jsx pour ses routines.
  //
  // `useMemo([savedPlaylists, currentPlaylist.id])` — `savedPlaylists`
  // (reçu en prop depuis App.jsx) reste RÉFÉRENTIELLEMENT stable d'un
  // rendu à l'autre tant que la collection elle-même ne change pas.
  // Historiquement ajouté (07/08) pour contourner un re-render à chaque
  // frappe pendant l'édition du titre/de la description — ce problème
  // n'existe plus depuis le découpage `PlaylistEditContext.jsx` (08/08,
  // voir sa docstring) : `PlaylistHeader.jsx` ne re-render même plus du
  // tout pendant une frappe. Ce `useMemo` reste néanmoins la bonne
  // pratique standard (éviter un tri à chaque rendu, peu importe la
  // cause) — pas retiré pour autant.
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
      <PlaylistHeaderBadges
        currentPlaylist={currentPlaylist}
        currentPlaylistRank={currentPlaylistRank}
        currentPlaylistRankStyle={currentPlaylistRankStyle}
        isSaved={isSaved}
        isReadOnly={isReadOnly}
        handleTogglePlaylistPublic={handleTogglePlaylistPublic}
        handleUnsavePlaylist={handleUnsavePlaylist}
        isLocked={isLocked}
        theme={theme}
        editingCompletion={editingCompletion}
        setEditingCompletion={setEditingCompletion}
        editCompletionDate={editCompletionDate}
      />

      <PlaylistHeaderCover
        currentPlaylist={currentPlaylist}
        bgAccentClass={bgAccentClass}
        resolveAndTogglePreview={resolveAndTogglePreview}
        getNextTrackForAutoAdvance={getNextTrackForAutoAdvance}
      />

      {/* Bloc de droite — `md:h-32` reprend EXACTEMENT la hauteur de la
          pochette (`w-32 h-32`, PlaylistHeaderCover.jsx) : titre/métadonnées
          restent en haut dans leur flux naturel, `mt-auto` sur la rangée
          d'actions (PlaylistHeaderActions.jsx) la pousse tout en bas de
          ce bloc — son bas tombe donc exactement sur le bas de la
          pochette. Uniquement à partir de `md:` : en dessous, la pochette
          est empilée AU-DESSUS de ce bloc, rien à aligner sur sa hauteur. */}
      <div className="flex-1 flex flex-col md:h-32 gap-2 text-center md:text-left w-full min-w-0">
        <PlaylistHeaderTitleBlock
          currentPlaylist={currentPlaylist}
          isSaved={isSaved}
          isReadOnly={isReadOnly}
        />

        <PlaylistHeaderMeta
          currentPlaylist={currentPlaylist}
          theme={theme}
          isLocked={isLocked}
          isReadOnly={isReadOnly}
          editingCompletion={editingCompletion}
          setEditingCompletion={setEditingCompletion}
          editCompletionDate={editCompletionDate}
          removeCompletionDate={removeCompletionDate}
          triggerCSVUpload={triggerCSVUpload}
          removeImportedData={removeImportedData}
          mostRecentCompletionIso={mostRecentCompletionIso}
          ownerLabel={ownerLabel}
          ownerProfileUsername={ownerProfileUsername}
          onViewProfile={onViewProfile}
          isSaved={isSaved}
          changeView={changeView}
        />

        <PlaylistHeaderActions
          currentPlaylist={currentPlaylist}
          isLocked={isLocked}
          isReadOnly={isReadOnly}
          isSaved={isSaved}
          triggerCSVUpload={triggerCSVUpload}
          removeImportedData={removeImportedData}
          mostRecentCompletionIso={mostRecentCompletionIso}
          hasImportedDataForMostRecent={hasImportedDataForMostRecent}
          handleClonePlaylist={handleClonePlaylist}
          handleSavePlaylist={handleSavePlaylist}
          setPlaylistPlannedDate={setPlaylistPlannedDate}
          plannedDateInputRef={plannedDateInputRef}
          onShare={onShare}
          bpmBadgeColor={bpmBadgeColor}
          avgBpm={avgBpm}
          bpmZone={bpmZone}
        />
      </div>
    </div>
  );
}
