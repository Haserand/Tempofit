import { Music2, Clock, Activity } from 'lucide-react';
import { formatDuration } from '../../utils/format';
import { getZoneForValue, ATHLETIC_ZONES } from '../../appConfig';

/**
 * SessionSummaryCard — "Bilan Visuel de Séance", pensé pour être capturé en
 * image (voir exportSessionSummaryImage dans PlaylistDetailView.jsx, qui
 * utilise html2canvas dessus) et partagé en Story Instagram / WhatsApp.
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
 */
export default function SessionSummaryCard({ playlist, topTrackCovers = {}, isNaughtyMode = false, getProfileForWorkout = null }) {
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

  // "Règle d'or" ergonomie (retour direct : une couleur = une zone
  // d'intensité, partout dans l'app, y compris à l'export/au partage) :
  // classe chaque titre dans sa VRAIE zone (via getZoneForValue, appConfig.js
  // — même fonction que StatsView/GeneratorView), plutôt qu'une tranche de
  // BPM générique sans lien avec le profil de l'utilisateur.
  //
  // Repli sur l'ancienne palette à 5 tranches BPM fixes UNIQUEMENT si aucun
  // profil n'est configuré pour cette activité (`matchedAnyZone` reste
  // `false` — `getZoneForValue` renvoie alors `null` pour chaque titre) :
  // jamais un graphique vide juste parce que l'utilisateur n'a pas encore
  // rempli son Profil Athlétique.
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

  const bpmBucketLabel = (bpm) => bpm < 90 ? '< 90' : bpm < 120 ? '90-119' : bpm < 150 ? '120-149' : bpm < 180 ? '150-179' : '180+';
  const bucketOrder = ['< 90', '90-119', '120-149', '150-179', '180+'];
  const bucketColors = { '< 90': '#3b82f6', '90-119': '#22c55e', '120-149': '#f59e0b', '150-179': '#f97316', '180+': '#ef4444' };

  let bars;
  if (matchedAnyZone) {
    const totalZoneSeconds = Object.values(zoneSeconds).reduce((s, v) => s + v, 0);
    bars = ATHLETIC_ZONES
      .filter(z => zoneSeconds[z.key] > 0)
      .map(z => ({ label: z.shortLabel, pct: totalZoneSeconds > 0 ? Math.round((zoneSeconds[z.key] / totalZoneSeconds) * 100) : 0, color: z.color }));
  } else {
    // Répartition par tranche de BPM générique — même découpage que
    // StatsView/PlaylistDetailView (bpmBucketLabel), recalculé ici pour
    // garder ce composant autonome (ne dépend que de `playlist`).
    const bucketSeconds = {};
    tracks.forEach(t => {
      if (!t.bpm) return;
      const b = bpmBucketLabel(t.bpm);
      bucketSeconds[b] = (bucketSeconds[b] || 0) + (t.duration || 0);
    });
    const totalBucketSeconds = Object.values(bucketSeconds).reduce((s, v) => s + v, 0);
    bars = bucketOrder
      .filter(b => bucketSeconds[b] > 0)
      .map(b => ({ label: b, pct: totalBucketSeconds > 0 ? Math.round((bucketSeconds[b] / totalBucketSeconds) * 100) : 0, color: bucketColors[b] }));
  }

  // Top 3 titres — les 3 premiers de la playlist (ordre de lecture), pas un
  // tri par popularité qui n'existe pas côté données ici.
  const topTracks = tracks.slice(0, 3);

  const accent = isNaughtyMode ? '#f43f5e' : '#ef4444';

  return (
    <div
      className="w-[400px] rounded-[32px] overflow-hidden shadow-2xl"
      style={{ background: isNaughtyMode ? 'linear-gradient(160deg, #1a0b12 0%, #0d0509 100%)' : 'linear-gradient(160deg, #111827 0%, #030712 100%)', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="p-8 pb-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent }}>
            <Activity size={20} color="white" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">Tempo<span style={{ color: accent }}>Fit</span></span>
        </div>

        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Bilan de séance</p>
        <h1 className="text-white text-3xl font-black leading-tight mb-6">{playlist.name}</h1>

        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Clock size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">Durée</span></div>
            <p className="text-white text-2xl font-black">{formatDuration(playlist.totalDuration || 0)}</p>
          </div>
          <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1" style={{ color: accent }}><Activity size={14}/><span className="text-[11px] font-bold uppercase tracking-wide">BPM moyen</span></div>
            <p className="text-white text-2xl font-black">{avgBpm}</p>
          </div>
        </div>

        {/* Zones d'intensité — barres empilées, une par tranche de BPM */}
        {bars.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-2">Zones d'intensité</p>
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
            topTrackCovers) — repli sur une icône générique sinon. */}
        {topTracks.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-1">Titres marquants</p>
            {topTracks.map((t, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/10">
                {topTrackCovers[t.youtubeId] ? (
                  <img src={topTrackCovers[t.youtubeId]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" crossOrigin="anonymous" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Music2 size={16} className="text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white text-sm font-bold truncate">{t.title}</p>
                  <p className="text-gray-400 text-xs truncate">{t.artist}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-8 py-4 border-t border-white/10 flex items-center justify-center">
        <p className="text-gray-500 text-[11px] font-semibold">Généré avec TempoFit — l'app qui cale ta musique sur ton effort</p>
      </div>
    </div>
  );
}
