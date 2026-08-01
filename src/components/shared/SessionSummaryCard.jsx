import { Music2, Clock, Activity, Calendar, MapPin, Gauge } from 'lucide-react';
import { formatDuration } from '../../utils/format';
import { buildCoverUrl } from '../../utils/coverArt';
import { getZoneForValue, ATHLETIC_ZONES, getBpmBucketColor, getBpmBucketStart, getBpmBucketLabel } from '../../appConfig';

/**
 * SessionSummaryCard — "Bilan Visuel de Séance", pensé pour être capturé en
 * image (voir generateSummaryImageFile/startBackgroundImageGeneration dans
 * PlaylistDetailView.jsx, qui utilise html2canvas dessus, et ShareModal.jsx
 * pour l'aperçu/le partage une fois l'image prête) et partagé en Story
 * Instagram / WhatsApp.
 *
 * Composant PUREMENT présentationnel — aucun appel réseau ici (voir
 * `topTrackCovers`, résolues par l'appelant AVANT de monter ce composant,
 * puisque html2canvas capture l'état du DOM à un instant T : il faut que les
 * images de pochette soient déjà chargées avant la capture, pas en cours de
 * chargement à ce moment-là).
 *
 * Dimensions FIXES (pas responsive) : `w-[400px]`, pensé pour un format
 * proche d'une Story (portrait). html2canvas capture exactement la taille
 * rendue dans le DOM — laisser ce composant en pourcentages aurait rendu la
 * taille de la capture dépendante de la largeur de l'écran de la personne au
 * moment de l'export, ce qui n'a pas de sens pour une image destinée à être
 * partagée telle quelle.
 *
 * RETOUR DIRECT ("manque la date, le type de sport, la distance ; pas ok de
 * parler d'intensité") — 2 vrais manques corrigés :
 *   1. Date/activité/distance existaient déjà dans l'objet `playlist`
 *      (`completions`, `workoutType`, `config.distanceVal`) mais n'étaient
 *      jamais affichés sur cette carte précisément — ajoutés en ligne de
 *      méta sous le titre.
 *   2. Le libellé "Zones d'intensité" restait affiché même dans la branche
 *      de repli (tranches BPM brutes, sans profil réel) — incohérent avec la
 *      règle déjà posée ailleurs dans l'app (StatsView/PlaylistDetailView) :
 *      le mot "intensité"/"effort" exige un vrai profil configuré, sinon
 *      c'est une simple répartition par BPM, sans plus de sens qu'une
 *      tranche brute. Le libellé suit maintenant `matchedAnyZone`, comme le
 *      contenu du graphique lui-même.
 *
 * RETOUR DIRECT (refonte "cohérence avec la vue playlist" + Story Instagram) —
 * 4 évolutions :
 *   1. Pochette de la séance (`playlist.coverUrl || buildCoverUrl(...)`,
 *      MÊME fonction que PlaylistHeader.jsx/TemplateCard.jsx — jamais une 2e
 *      logique de pochette) intégrée dans l'en-tête, à côté du titre.
 *   2. Répartition par BPM (branche de repli, sans profil réel) : la palette
 *      à 5 tranches locale (`bucketColors`/`bpmBucketLabel` définis ici,
 *      DIFFÉRENTS de ceux d'appConfig.js — 5 bornes arbitraires contre des
 *      tranches de 20 BPM) causait exactement l'incohérence de couleur
 *      signalée (violet/rose du camembert de la vue playlist, orange/rouge
 *      ici) — remplacée par `getBpmBucketColor`/`getBpmBucketStart` (mêmes
 *      fonctions que PlaylistDetailContext.jsx/TrackItem.jsx/
 *      PlaylistHeader.jsx), un seul système de couleur BPM dans toute l'app.
 *   3. Badge BPM identique à PlaylistHeader.jsx (pastille colorée, icône
 *      Gauge, libellé de zone si un vrai profil est configuré) — même
 *      composant visuel, pas réimplémenté différemment ici.
 *   4. Dimensions ajustées vers un format Story (`min-h`, 9:16 approximatif
 *      à 400px de large) plutôt qu'une simple carte à hauteur libre — voir
 *      plus bas pour le détail.
 */
export default function SessionSummaryCard({ playlist, topTrackCovers = {}, sessionCoverUrl = null, isNaughtyMode = false, getProfileForWorkout = null }) {
  if (!playlist) return null;

  const tracks = playlist.tracks || [];
  const bpmValues = tracks.map(t => t.bpm).filter(Boolean);
  const avgBpm = bpmValues.length > 0 ? Math.round(bpmValues.reduce((s, b) => s + b, 0) / bpmValues.length) : (playlist.config?.bpm || 0);

  // Activité RÉELLE à utiliser pour résoudre le profil — même piège déjà
  // documenté dans StatsView.jsx : en Mode Intime, `playlist.workoutType`
  // vaut toujours "Ambiance" (écrasé volontairement pour la discrétion sur
  // les cartes de playlist), le vrai nom est dans `playlist.config.workoutName`.
  const activityName = isNaughtyMode
    ? (playlist.config?.workoutName || playlist.workoutType || 'Autre')
    : (playlist.workoutType || 'Autre');

  // Date affichée : la complétion la plus RÉCENTE si cette séance a déjà été
  // marquée comme faite au moins une fois (`completions`, un tableau de
  // dates ISO — voir PlaylistDetailView.jsx pour le même champ), sinon repli
  // sur la date de création de la playlist (`createdAt`, déjà au format
  // locale FR — voir musicEngine.js/createPlaylistData) pour ne jamais
  // laisser cette ligne vide.
  const displayDate = (playlist.completions && playlist.completions.length > 0)
    ? new Date(playlist.completions[playlist.completions.length - 1].slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : (playlist.createdAt || null);

  // Distance UNIQUEMENT pertinente si la séance a été calée "Par Distance"
  // (`targetMode === 'distance'`) — pas de sens de l'afficher pour une
  // séance calée par durée, ce serait une valeur de config jamais vraiment
  // choisie par l'utilisateur pour cette séance-là.
  const distanceLabel = (playlist.targetMode === 'distance' && playlist.config?.distanceVal)
    ? `${playlist.config.distanceVal} ${playlist.distanceUnit || 'km'}`
    : null;

  // "Règle d'or" ergonomie (retour direct : une couleur = une zone
  // d'intensité, partout dans l'app, y compris à l'export/au partage) :
  // classe chaque titre dans sa VRAIE zone (via getZoneForValue, appConfig.js
  // — même fonction que StatsView/GeneratorView), plutôt qu'une tranche de
  // BPM générique sans lien avec le profil de l'utilisateur.
  //
  // Repli sur les tranches de 20 BPM PARTAGÉES (getBpmBucketLabel/Start/
  // Color, appConfig.js — mêmes fonctions que PlaylistDetailContext.jsx/
  // TrackItem.jsx/PlaylistHeader.jsx) UNIQUEMENT si aucun profil n'est
  // configuré pour cette activité (`matchedAnyZone` reste `false`) : jamais
  // une palette locale réinventée, sinon la couleur affichée ici divergerait
  // de celle du camembert BPM/du badge dans la vraie vue playlist pour EXACTEMENT
  // le même titre — c'est justement le bug signalé (violet/rose attendus,
  // orange/rouge affichés).
  const zoneSeconds = {};
  let matchedAnyZone = false;
  tracks.forEach(t => {
    if (!t.bpm) return;
    const zone = getZoneForValue(t.bpm, activityName, getProfileForWorkout);
    if (zone) {
      matchedAnyZone = true;
      zoneSeconds[zone.key] = (zoneSeconds[zone.key] || 0) + (t.duration || 0);
    }
  });

  let bars;
  if (matchedAnyZone) {
    const totalZoneSeconds = Object.values(zoneSeconds).reduce((s, v) => s + v, 0);
    bars = ATHLETIC_ZONES
      .filter(z => zoneSeconds[z.key] > 0)
      .map(z => ({ label: z.shortLabel, pct: totalZoneSeconds > 0 ? Math.round((zoneSeconds[z.key] / totalZoneSeconds) * 100) : 0, color: z.color }));
  } else {
    // Répartition par tranche de BPM générique — mêmes fonctions PARTAGÉES
    // que StatsView/PlaylistDetailContext (getBpmBucketStart/Label/Color),
    // recalculé ici pour garder ce composant autonome (ne dépend que de
    // `playlist`), mais jamais une palette/un découpage réinventés.
    const bucketSeconds = {};
    tracks.forEach(t => {
      if (!t.bpm) return;
      const start = getBpmBucketStart(t.bpm);
      bucketSeconds[start] = (bucketSeconds[start] || 0) + (t.duration || 0);
    });
    const totalBucketSeconds = Object.values(bucketSeconds).reduce((s, v) => s + v, 0);
    bars = Object.keys(bucketSeconds)
      .map(Number)
      .sort((a, b) => a - b)
      .map(start => ({ label: getBpmBucketLabel(start), pct: totalBucketSeconds > 0 ? Math.round((bucketSeconds[start] / totalBucketSeconds) * 100) : 0, color: getBpmBucketColor(start) }));
  }

  // Top 3 titres — les 3 premiers de la playlist (ordre de lecture), pas un
  // tri par popularité qui n'existe pas côté données ici.
  const topTracks = tracks.slice(0, 3);

  const accent = isNaughtyMode ? '#f43f5e' : '#ef4444';

  // Badge BPM — même logique EXACTE que PlaylistHeader.jsx (bpmBadgeColor) :
  // libellé de zone seulement si un vrai profil est configuré pour cette
  // activité, repli neutre sur la couleur "Énergie Musicale" sinon.
  const avgBpmZone = avgBpm > 0 ? getZoneForValue(avgBpm, activityName, getProfileForWorkout) : null;
  const bpmBadgeColor = avgBpmZone ? avgBpmZone.color : (avgBpm > 0 ? getBpmBucketColor(getBpmBucketStart(avgBpm)) : null);

  // Pochette de la séance — MÊME fonction que PlaylistHeader.jsx/
  // TemplateCard.jsx (utils/coverArt.js) : `coverUrl` si déjà posé (playlist
  // ouverte depuis Découvrir), sinon calculée depuis le titre (déterministe,
  // toujours la même pochette pour une même playlist).
  const coverUrl = sessionCoverUrl || playlist.coverUrl || buildCoverUrl(playlist.name);

  return (
    <div
      className="w-[400px] min-h-[711px] flex flex-col rounded-[32px] overflow-hidden"
      style={{ background: isNaughtyMode ? 'linear-gradient(160deg, #1a0b12 0%, #0d0509 100%)' : 'linear-gradient(160deg, #111827 0%, #030712 100%)', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="p-8 pb-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent }}>
            <Activity size={20} color="white" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">Tempo<span style={{ color: accent }}>Fit</span></span>
        </div>

        {/* En-tête : pochette de la séance à côté du titre — retour direct
            ("la pochette est absente"), même fonction que PlaylistHeader.jsx
            (voir plus haut). `shrink-0` sur la pochette, `min-w-0` sur le
            bloc titre (comme partout ailleurs dans l'app) pour que le titre
            se tronque proprement plutôt que de repousser la pochette. */}
        <div className="flex items-start gap-4 mb-2">
          <img src={coverUrl} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-lg" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Bilan de séance</p>
            <h1 className="text-white text-2xl font-black leading-tight">{playlist.name}</h1>
          </div>
        </div>

        {/* Ligne de méta : date · activité · distance (si pertinente) — un
            simple texte gris séparé par des points, pas des badges séparés,
            pour rester compact sur une seule ligne. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-6 mt-3 text-gray-400 text-xs font-semibold">
          {displayDate && (
            <span className="flex items-center gap-1"><Calendar size={12}/> {displayDate}</span>
          )}
          <span className="flex items-center gap-1">{displayDate && '·'} <Activity size={12}/> {activityName}</span>
          {distanceLabel && (
            <span className="flex items-center gap-1">· <MapPin size={12}/> {distanceLabel}</span>
          )}
        </div>

        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Clock size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">Durée</span></div>
            <p className="text-white text-2xl font-black">{formatDuration(playlist.totalDuration || 0)}</p>
          </div>
          {/* Badge BPM — identique à PlaylistHeader.jsx (pastille colorée,
              icône Gauge, libellé de zone si un vrai profil est configuré),
              plutôt qu'un simple nombre blanc comme avant : cette carte suit
              maintenant le même repère visuel BPM/Zone que la vue playlist. */}
          <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Gauge size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">BPM moyen</span></div>
            {bpmBadgeColor ? (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-black border w-fit"
                style={{ backgroundColor: `${bpmBadgeColor}26`, borderColor: `${bpmBadgeColor}66`, color: bpmBadgeColor }}
              >
                <span>{avgBpm}{avgBpmZone ? ` • ${avgBpmZone.shortLabel}` : ''}</span>
              </div>
            ) : (
              <p className="text-white text-2xl font-black">{avgBpm}</p>
            )}
          </div>
        </div>

        {/* Barres empilées — le libellé dépend de CE QUI EST VRAIMENT affiché
            (voir la docstring plus haut) : "Zones d'intensité" seulement si
            `matchedAnyZone` (vraies zones d'effort, profil configuré),
            "Répartition par BPM" sinon (tranches brutes, sans lien avec un
            profil réel) — jamais l'un affiché avec le libellé de l'autre. */}
        {bars.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-2">{matchedAnyZone ? "Zones d'intensité" : "Répartition par BPM"}</p>
            <div className="w-full h-3 rounded-full overflow-hidden flex">
              {bars.map((b, i) => (
                <div key={i} style={{ width: `${b.pct}%`, backgroundColor: b.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {bars.map((b, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="text-gray-400 text-[10px] font-semibold">{b.label} · {b.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top titres, avec pochette si résolue par l'appelant (voir
            topTrackCovers) — repli sur une icône générique sinon.
            RETOUR RECUL (rognage TOUJOURS visible sur l'image réellement
            téléchargée, malgré 2 correctifs précédents — leading-relaxed en
            classe Tailwind, puis py-0.5) : passage à un `lineHeight` en
            STYLE INLINE explicite (1.8) plutôt qu'une classe Tailwind —
            html2canvas lit le style calculé final, mais certaines classes
            utilitaires peuvent ne pas se traduire fidèlement selon la
            version/le contexte de rendu ; un style inline élimine cette
            ambiguïté. `py-1.5` (au lieu de `py-0.5`) sur le conteneur, en
            plus du line-height généreux — la marge de sécurité vient des
            DEUX côtés cette fois, pas d'un seul réglage isolé.
            "Premiers titres" plutôt que "Titres marquants" : ce sont
            littéralement les 3 premiers de la playlist dans l'ordre de
            lecture (`tracks.slice(0, 3)`), pas une sélection par pertinence
            (BPM, popularité...) — le libellé précédent laissait croire le
            contraire. */}
        {topTracks.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-1">Premiers titres</p>
            {topTracks.map((t, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/10">
                {topTrackCovers[t.trackId] ? (
                  <img src={topTrackCovers[t.trackId]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Music2 size={16} className="text-gray-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1 py-1.5">
                  <p className="text-white text-sm font-bold truncate" style={{ lineHeight: 1.8 }}>{t.title}</p>
                  <p className="text-gray-400 text-xs truncate" style={{ lineHeight: 1.8 }}>{t.artist}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto px-8 py-4 border-t border-white/10 flex items-center justify-center">
        <p className="text-gray-500 text-[11px] font-semibold">Généré avec TempoFit — l'app qui cale ta musique sur ton effort</p>
      </div>
    </div>
  );
}
