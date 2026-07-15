import React from 'react';
import { Activity, Flame, Upload, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { NAUGHTY_WORKOUT_LABELS } from '../../appConfig';
import { genreDisplayLabel } from '../../musicCatalog';
import { formatDuration } from '../../utils/format';

/**
 * StatsView — vue "Statistiques" ("Wrapped" personnel).
 *
 * Extrait de App.jsx (bloc `view === 'stats'`), de loin le plus gros des
 * blocs de vue (voir passation, section 4). Volontairement une couche de
 * LECTURE/AGRÉGATION sur `savedPlaylists` — pas un nouveau système de
 * tracking. Tous les calculs (genreBreakdown, topArtists, timeline...)
 * restent recalculés à chaque rendu (comportement identique à avant
 * l'extraction) : pas de useMemo ajouté ici pour ne pas changer le
 * comportement en même temps que la structure du fichier.
 *
 * ⚠️ Piège déjà rencontré (voir passation, section 4) : `createPlaylistData`
 * stocke `selectedGenres`/`bpm` DANS `config`, jamais au niveau racine de la
 * playlist. Toujours lire `pl.config?.selectedGenres` / `pl.config?.bpm`.
 */
export default function StatsView({
  theme, savedPlaylists, userStats, changeView, setCurrentPlaylist,
  statsMode, setStatsMode,
  selectedStatsGenre, setSelectedStatsGenre,
  selectedStatsBpmBucket, setSelectedStatsBpmBucket,
  showAdvancedStats, setShowAdvancedStats,
  expandedDetailGenre, setExpandedDetailGenre,
  expandedDetailArtist, setExpandedDetailArtist,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;

  // Palette adaptée au mode consulté — rose pour Mode Intime (cohérent avec
  // son habillage ailleurs dans l'app), rouge/orange sinon.
  const COLORS = statsMode === 'naughty'
    ? ['#f43f5e', '#fb7185', '#e11d48', '#fda4af', '#be123c', '#ec4899', '#f472b6', '#db2777', '#9f1239']
    : ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
  // Seules les playlists du mode consulté nourrissent tout ce qui suit —
  // `!!p.isNaughty` normalise undefined/false en un booléen propre avant comparaison
  // (playlists anciennes sans champ).
  const playlistsForStats = savedPlaylists.filter(p => !!p.isNaughty === (statsMode === 'naughty'));

  // Séances avec données réelles importées (Garmin/Strava) — voir la nouvelle
  // section "Données réelles" plus bas. Une entrée par PLAYLIST (pas par date
  // de complétion individuelle) : `actualDataByDate` peut contenir plusieurs
  // dates pour une même playlist rejouée plusieurs fois, on les regroupe donc
  // ligne par ligne plutôt que d'exploser en une ligne par date. Triées par
  // date d'import la plus récente d'abord.
  const playlistsWithRealData = playlistsForStats
    .filter(p => p.actualDataByDate && Object.keys(p.actualDataByDate).length > 0)
    .map(p => ({ playlist: p, dates: Object.keys(p.actualDataByDate).sort().reverse() }))
    .sort((a, b) => (a.dates[0] < b.dates[0] ? 1 : -1));

  const genreSeconds = {};
  const genreSessions = {};
  let totalSessions = 0;
  let totalSeconds = 0;
  let bpmSum = 0;
  let bpmCount = 0;
  const sessionsByMonth = {};
  // Comptage par artiste et par titre — clé sur "titre|||artiste" plutôt que sur
  // youtubeId : un même morceau peut être résolu vers un ID Deezer différent d'une
  // génération à l'autre. Compte à chaque COMPLÉTION (pas juste à chaque apparition
  // dans une playlist sauvegardée) : rejouer 3x la même playlist compte ses titres 3x.
  const artistCounts = {};
  const trackCounts = {}; // clé "titre|||artiste" -> { title, artist, count }
  const activitySeconds = {};
  const activitySessions = {};
  // Pour chaque artiste/titre : quelle activité domine ses écoutes, et à quel BPM
  // réel — pas un vrai tableau croisé, juste de quoi afficher UNE ligne contextuelle
  // sous chaque entrée du top 5, sans transformer la page en tableau de bord.
  const artistActivityCounts = {}; // artiste -> { activité -> count }
  const artistBpmSum = {}; const artistBpmCount = {};
  const trackBpmSum = {}; const trackBpmCount = {};
  const trackActivityCounts = {}; // clé titre|||artiste -> { activité -> count }
  // artiste -> { clé titre|||artiste -> {title, count} } — pour déplier une ligne
  // "Détail par artiste" (vue avancée) et voir TOUS ses titres.
  const artistTrackCounts = {};
  // Une entrée par COMPLÉTION (pas par playlist) — sert aux "records" plus bas.
  const allSessions = [];
  // Jour de la semaine le plus fréquent, et jours uniques (Set, dédupliqués) pour
  // calculer la plus longue série de jours consécutifs avec au moins une séance.
  const weekdayCounts = {}; // 0 (dimanche) à 6 (samedi) -> count
  const uniqueDays = new Set();
  const bpmBuckets = { '< 90': 0, '90-119': 0, '120-149': 0, '150-179': 0, '180+': 0 };
  const bpmBucketLabel = (bpm) => bpm < 90 ? '< 90' : bpm < 120 ? '90-119' : bpm < 150 ? '120-149' : bpm < 180 ? '150-179' : '180+';
  // Données de "zoom" au clic sur une part de donut (genre ou tranche BPM).
  const genreArtistCounts = {}; // genre -> { artiste -> count }
  const genreTrackCounts = {}; // genre -> { clé titre|||artiste -> {title, artist, count} }
  const genreBpmBuckets = {}; // genre -> { tranche BPM -> count }
  const bpmBucketArtistCounts = {}; // tranche -> { artiste -> count }
  const bpmBucketTrackCounts = {}; // tranche -> { clé titre|||artiste -> {title, artist, count} }
  const bpmBucketGenreCounts = {}; // tranche -> { genre -> count }
  const genreActivityCounts = {}; // genre -> { activité -> count }

  playlistsForStats.forEach(pl => {
    if (!pl.completions || pl.completions.length === 0) return;
    const genres = (pl.config?.selectedGenres && pl.config.selectedGenres.length > 0) ? pl.config.selectedGenres : ['Autre'];
    const perGenreSeconds = (pl.totalDuration || 0) / genres.length;
    // En Mode Intime, `pl.workoutType` vaut toujours "Ambiance" (écrasé volontairement
    // pour la discrétion sur les cartes de playlist). L'activité RÉELLE est toujours
    // dans `pl.config.workoutName`.
    const activity = pl.isNaughty
      ? (NAUGHTY_WORKOUT_LABELS[pl.config?.workoutName] || pl.config?.workoutName || 'Autre')
      : (pl.workoutType || 'Autre');

    pl.completions.forEach(dateStr => {
      totalSessions += 1;
      totalSeconds += pl.totalDuration || 0;
      if (pl.config?.bpm) { bpmSum += pl.config.bpm; bpmCount += 1; }
      genres.forEach(g => {
        genreSeconds[g] = (genreSeconds[g] || 0) + perGenreSeconds;
        genreSessions[g] = (genreSessions[g] || 0) + 1;
        if (!genreActivityCounts[g]) genreActivityCounts[g] = {};
        genreActivityCounts[g][activity] = (genreActivityCounts[g][activity] || 0) + 1;
      });
      activitySeconds[activity] = (activitySeconds[activity] || 0) + (pl.totalDuration || 0);
      activitySessions[activity] = (activitySessions[activity] || 0) + 1;
      allSessions.push({ date: dateStr, duration: pl.totalDuration || 0, bpm: pl.config?.bpm || null, activity, genres, name: pl.name });
      (pl.tracks || []).forEach(t => {
        if (!t.artist) return;
        artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
        const key = `${t.title}|||${t.artist}`;
        if (!trackCounts[key]) trackCounts[key] = { title: t.title, artist: t.artist, count: 0 };
        trackCounts[key].count += 1;

        if (!artistActivityCounts[t.artist]) artistActivityCounts[t.artist] = {};
        artistActivityCounts[t.artist][activity] = (artistActivityCounts[t.artist][activity] || 0) + 1;
        if (t.bpm) { artistBpmSum[t.artist] = (artistBpmSum[t.artist] || 0) + t.bpm; artistBpmCount[t.artist] = (artistBpmCount[t.artist] || 0) + 1; }
        if (!artistTrackCounts[t.artist]) artistTrackCounts[t.artist] = {};
        if (!artistTrackCounts[t.artist][key]) artistTrackCounts[t.artist][key] = { title: t.title, count: 0 };
        artistTrackCounts[t.artist][key].count += 1;

        if (!trackActivityCounts[key]) trackActivityCounts[key] = {};
        trackActivityCounts[key][activity] = (trackActivityCounts[key][activity] || 0) + 1;
        if (t.bpm) { trackBpmSum[key] = (trackBpmSum[key] || 0) + t.bpm; trackBpmCount[key] = (trackBpmCount[key] || 0) + 1; }

        // Zoom par genre : chaque genre sélectionné pour CETTE séance (pas le genre
        // réel du titre) reçoit ce titre.
        genres.forEach(g => {
          if (!genreArtistCounts[g]) genreArtistCounts[g] = {};
          genreArtistCounts[g][t.artist] = (genreArtistCounts[g][t.artist] || 0) + 1;
          if (!genreTrackCounts[g]) genreTrackCounts[g] = {};
          if (!genreTrackCounts[g][key]) genreTrackCounts[g][key] = { title: t.title, artist: t.artist, count: 0 };
          genreTrackCounts[g][key].count += 1;
          if (t.bpm) {
            if (!genreBpmBuckets[g]) genreBpmBuckets[g] = {};
            const b = bpmBucketLabel(t.bpm);
            genreBpmBuckets[g][b] = (genreBpmBuckets[g][b] || 0) + 1;
          }
        });

        if (t.bpm) {
          const bucket = bpmBucketLabel(t.bpm);
          bpmBuckets[bucket] += 1;
          if (!bpmBucketArtistCounts[bucket]) bpmBucketArtistCounts[bucket] = {};
          bpmBucketArtistCounts[bucket][t.artist] = (bpmBucketArtistCounts[bucket][t.artist] || 0) + 1;
          if (!bpmBucketTrackCounts[bucket]) bpmBucketTrackCounts[bucket] = {};
          if (!bpmBucketTrackCounts[bucket][key]) bpmBucketTrackCounts[bucket][key] = { title: t.title, artist: t.artist, count: 0 };
          bpmBucketTrackCounts[bucket][key].count += 1;
          genres.forEach(g => {
            if (!bpmBucketGenreCounts[bucket]) bpmBucketGenreCounts[bucket] = {};
            bpmBucketGenreCounts[bucket][g] = (bpmBucketGenreCounts[bucket][g] || 0) + 1;
          });
        }
      });
      // Regroupement par mois (année-mois) plutôt que par semaine ISO — plus simple
      // à calculer sans librairie de dates dédiée.
      const d = new Date(dateStr);
      if (!isNaN(d)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        sessionsByMonth[key] = (sessionsByMonth[key] || 0) + 1;
        weekdayCounts[d.getDay()] = (weekdayCounts[d.getDay()] || 0) + 1;
        uniqueDays.add(d.toISOString().slice(0, 10));
      }
    });
  });

  const genreBreakdown = Object.entries(genreSeconds)
    .map(([genre, seconds]) => ({ genre, seconds, sessions: genreSessions[genre] }))
    .sort((a, b) => b.seconds - a.seconds);

  const activityBreakdown = Object.entries(activitySeconds)
    .map(([activity, seconds]) => ({ activity, seconds, sessions: activitySessions[activity] }))
    .sort((a, b) => b.seconds - a.seconds);

  // Records — coup d'œil narratif plutôt qu'un chiffre froid de plus ; aucune
  // donnée nouvelle, juste un tri sur ce qui existe déjà (durée, BPM, date).
  const formatSessionDate = (dateStr) => {
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const longestSession = allSessions.length > 0 ? [...allSessions].sort((a, b) => b.duration - a.duration)[0] : null;
  const sessionsWithBpm = allSessions.filter(s => s.bpm);
  const fastestSession = sessionsWithBpm.length > 0 ? [...sessionsWithBpm].sort((a, b) => b.bpm - a.bpm)[0] : null;
  const firstSession = allSessions.length > 0 ? [...allSessions].sort((a, b) => a.date.localeCompare(b.date))[0] : null;

  // Régularité — jour de la semaine le plus fréquent, et plus longue série de
  // jours CONSÉCUTIFS avec au moins une séance.
  const weekdayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const topWeekdayEntry = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0];
  const topWeekday = topWeekdayEntry ? { name: weekdayNames[parseInt(topWeekdayEntry[0])], count: topWeekdayEntry[1] } : null;

  const sortedDays = [...uniqueDays].sort();
  let longestStreak = sortedDays.length > 0 ? 1 : 0;
  let currentStreak = sortedDays.length > 0 ? 1 : 0;
  for (let i = 1; i < sortedDays.length; i++) {
    const diffDays = Math.round((new Date(sortedDays[i]) - new Date(sortedDays[i - 1])) / 86400000);
    if (diffDays === 1) { currentStreak += 1; longestStreak = Math.max(longestStreak, currentStreak); }
    else if (diffDays > 1) { currentStreak = 1; }
  }

  const bpmBucketOrder = ['< 90', '90-119', '120-149', '150-179', '180+'];
  const bpmDistribution = bpmBucketOrder.map(label => ({ label, count: bpmBuckets[label] })).filter(b => b.count > 0);

  // Aperçu au clic (voir selectedStatsGenre/selectedStatsBpmBucket) — top 3
  // seulement : un aperçu, pas un doublon de la vue détaillée existante.
  const topNEntries = (counts, n = 3) => Object.entries(counts || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
  const topNTracksFromMap = (tracksMap, n = 3) => Object.values(tracksMap || {}).sort((a, b) => b.count - a.count).slice(0, n);

  const monthLabels = { '01':'Jan','02':'Fév','03':'Mar','04':'Avr','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sep','10':'Oct','11':'Nov','12':'Déc' };
  const timeline = Object.entries(sessionsByMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => { const [y, m] = key.split('-'); return { label: `${monthLabels[m]} ${y}`, count }; });

  const avgBpm = bpmCount > 0 ? Math.round(bpmSum / bpmCount) : null;

  // Activité qui revient le plus souvent pour un artiste/titre donné — un simple
  // "mode" statistique (l'entrée la plus fréquente), pas une vraie répartition affichée.
  const dominantActivity = (counts) => {
    const entries = Object.entries(counts || {});
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

  const topArtists = Object.entries(artistCounts)
    .map(([artist, count]) => ({
      artist, count,
      activity: dominantActivity(artistActivityCounts[artist]),
      avgBpm: artistBpmCount[artist] ? Math.round(artistBpmSum[artist] / artistBpmCount[artist]) : null
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topTracks = Object.values(trackCounts)
    .map(t => {
      const key = `${t.title}|||${t.artist}`;
      return {
        ...t,
        activity: dominantActivity(trackActivityCounts[key]),
        avgBpm: trackBpmCount[key] ? Math.round(trackBpmSum[key] / trackBpmCount[key]) : null
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Données complètes pour la "vue détaillée" (voir showAdvancedStats) — TOUS les
  // artistes/titres, pas juste le top 5, avec la répartition d'activité ENTIÈRE.
  const formatActivities = (counts) => Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([act, n]) => `${act} (${n})`)
    .join(', ');

  const allArtistsDetailed = Object.entries(artistCounts)
    .map(([artist, count]) => ({
      artist, count,
      activitiesLabel: formatActivities(artistActivityCounts[artist]),
      avgBpm: artistBpmCount[artist] ? Math.round(artistBpmSum[artist] / artistBpmCount[artist]) : null
    }))
    .sort((a, b) => b.count - a.count);

  const allTracksDetailed = Object.values(trackCounts)
    .map(t => {
      const key = `${t.title}|||${t.artist}`;
      return {
        ...t,
        activitiesLabel: formatActivities(trackActivityCounts[key]),
        avgBpm: trackBpmCount[key] ? Math.round(trackBpmSum[key] / trackBpmCount[key]) : null
      };
    })
    .sort((a, b) => b.count - a.count);

  // Genre × activité, pour la vue détaillée — symétrique à artiste × activité.
  const allGenresDetailed = Object.entries(genreSeconds)
    .map(([genre, seconds]) => ({
      genre, seconds, sessions: genreSessions[genre],
      activitiesLabel: formatActivities(genreActivityCounts[genre])
    }))
    .sort((a, b) => b.seconds - a.seconds);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6 flex items-start justify-between gap-4`}>
        <div>
          <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${statsMode === 'naughty' ? 'text-rose-500' : textHighlight}`}>
            <Activity className={statsMode === 'naughty' ? 'text-rose-500' : textColorClass} size={36} />
            <span>{statsMode === 'naughty' ? 'Statistiques · Intime' : 'Statistiques'}</span>
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            {statsMode === 'naughty' ? "Ce que tu as écouté en mode Intime, à part du reste." : "Ce que tu as écouté, séance après séance."}
          </p>
        </div>
        {/* Bascule discrète — jamais montrée en avant, jamais mélangée aux stats
            par défaut (voir playlistsForStats plus haut). Icône flamme plutôt qu'un
            texte "Stats Mode Intime" : c'est déjà l'icône utilisée ailleurs dans
            l'app pour ce mode. Le chemin retour (une fois dedans) reste en texte. */}
        {statsMode === 'naughty' ? (
          <button
            onClick={() => { setStatsMode('standard'); setSelectedStatsGenre(null); setSelectedStatsBpmBucket(null); }}
            className={`shrink-0 text-xs font-bold px-3 py-2 rounded-lg transition-colors ${textMuted} hover:${textHighlight} hover:bg-gray-100 dark:hover:bg-gray-800`}
          >
            ← Stats standards
          </button>
        ) : (
          <button
            onClick={() => { setStatsMode('naughty'); setSelectedStatsGenre(null); setSelectedStatsBpmBucket(null); }}
            title="Stats Mode Intime"
            className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <Flame size={18} />
          </button>
        )}
      </div>

      {totalSessions === 0 ? (
        <div className={`py-16 text-center border-2 border-dashed ${cardBorder} rounded-2xl`}>
          <Activity size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
          <h3 className={`text-lg font-bold mb-2 ${textHighlight}`}>Rien à montrer pour l'instant</h3>
          <p className={`text-sm mb-6 max-w-sm mx-auto ${textMuted}`}>
            {statsMode === 'naughty'
              ? "Aucune séance Mode Intime marquée comme faite pour l'instant."
              : 'Génère des playlists et marque-les comme faites (voir "Mes Séances") — les stats se rempliront au fur et à mesure.'}
          </p>
          <button onClick={() => changeView('generator')} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110`}>
            Générer ma première playlist
          </button>
        </div>
      ) : (
        <>
          {/* Gros chiffres — l'effet "Wrapped" tient surtout à ça. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${cardBg} rounded-2xl p-4 border ${cardBorder} text-center`}>
              <div className={`text-3xl font-black ${textHighlight}`}>{totalSessions}</div>
              <div className={`text-xs font-bold uppercase tracking-wide mt-1 ${textMuted}`}>Séances</div>
            </div>
            <div className={`${cardBg} rounded-2xl p-4 border ${cardBorder} text-center`}>
              <div className={`text-3xl font-black ${textHighlight}`}>{formatDuration(totalSeconds)}</div>
              <div className={`text-xs font-bold uppercase tracking-wide mt-1 ${textMuted}`}>Écoute estimée</div>
            </div>
            <div className={`${cardBg} rounded-2xl p-4 border ${cardBorder} text-center`}>
              <div className={`text-3xl font-black ${textHighlight}`}>{avgBpm ?? '—'}</div>
              <div className={`text-xs font-bold uppercase tracking-wide mt-1 ${textMuted}`}>BPM moyen</div>
            </div>
            <div className={`${cardBg} rounded-2xl p-4 border ${cardBorder} text-center`}>
              <div className={`text-3xl font-black ${textHighlight}`}>{genreBreakdown.length}</div>
              <div className={`text-xs font-bold uppercase tracking-wide mt-1 ${textMuted}`}>Styles différents</div>
            </div>
          </div>

          {/* Donnée réelle importée (cadence/FC Garmin-Strava) — avant, une simple
              ligne de texte ("X imports...") apparaissait seulement s'il y en avait
              déjà eu au moins un, et rien du tout sinon (aucune incitation à
              essayer). Devenu un vrai encart : liste les séances concernées (avec
              accès direct à leur détail) si au moins une existe, ou explique la
              fonctionnalité et invite à l'essayer une fois si ce n'est encore
              jamais arrivé. Scope volontairement identique au reste de cette page
              (playlistsForStats, donc le mode Standard/Intime consulté). */}
          {playlistsWithRealData.length > 0 ? (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-1 flex items-center gap-2 ${textHighlight}`}><Upload size={18} className={textColorClass}/> Données réelles importées</h3>
              <p className={`text-xs mb-4 ${textMuted}`}>{playlistsWithRealData.reduce((s, p) => s + p.dates.length, 0)} séance{playlistsWithRealData.reduce((s, p) => s + p.dates.length, 0) > 1 ? 's' : ''} avec cadence/FC réelle (Garmin/Strava) sur {playlistsWithRealData.length} playlist{playlistsWithRealData.length > 1 ? 's' : ''} — clique pour comparer au réel.</p>
              <div className="space-y-2">
                {playlistsWithRealData.map(({ playlist, dates }) => (
                  <button
                    key={playlist.id}
                    onClick={() => { setCurrentPlaylist(playlist); changeView('playlist'); }}
                    className={`w-full flex items-center justify-between gap-3 text-sm rounded-xl px-3 py-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5 border ${cardBorder}`}
                  >
                    <div className="min-w-0 text-left">
                      <div className={`font-semibold truncate ${textHighlight}`}>{playlist.name}</div>
                      <div className={`text-xs ${textMuted}`}>{dates.length} import{dates.length > 1 ? 's' : ''} · dernier le {formatSessionDate(dates[0])}</div>
                    </div>
                    <ChevronRight size={16} className={`shrink-0 ${textMuted}`} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder} flex items-start gap-4`}>
              <div className={`shrink-0 p-2.5 rounded-xl ${bgAccentClass} text-white`}><Upload size={20}/></div>
              <div>
                <h3 className={`font-bold mb-1 ${textHighlight}`}>Compare tes séances au réel</h3>
                <p className={`text-sm ${textMuted}`}>
                  Tu n'as encore importé aucune donnée réelle (cadence ou fréquence cardiaque). Depuis le détail d'une séance <span className={`font-semibold ${textHighlight}`}>terminée</span> dans "Mes Séances", tu peux importer un export CSV Garmin ou Strava pour comparer ce que tu as vraiment fait au rythme visé — ça vaut le coup d'essayer au moins une fois.
                </p>
                <button onClick={() => changeView('playlists')} className={`mt-3 text-sm font-bold underline ${textColorClass}`}>
                  Aller à Mes Séances →
                </button>
              </div>
            </div>
          )}

          {/* Records — pas une nouvelle donnée, juste un tri narratif. */}
          {(longestSession || fastestSession || firstSession) && (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-4 ${textHighlight}`}>Tes records</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {longestSession && (
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>Séance la plus longue</div>
                    <div className={`font-semibold ${textHighlight}`}>{formatDuration(longestSession.duration)} · {longestSession.activity}</div>
                    <div className={textMuted}>{formatSessionDate(longestSession.date)}</div>
                  </div>
                )}
                {fastestSession && (
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>BPM le plus élevé</div>
                    <div className={`font-semibold ${textHighlight}`}>{fastestSession.bpm} BPM · {fastestSession.activity}</div>
                    <div className={textMuted}>{formatSessionDate(fastestSession.date)}</div>
                  </div>
                )}
                {firstSession && (
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>Ta toute première séance</div>
                    <div className={`font-semibold ${textHighlight}`}>{firstSession.activity}</div>
                    <div className={textMuted}>{formatSessionDate(firstSession.date)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ordre des 3 blocs suivants aligné sur celui du wizard de génération :
              Activité (étape 1) → BPM (étape 3) → Genre (étape 4). */}

          <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
            <h3 className={`font-bold mb-4 ${textHighlight}`}>Tes activités</h3>
            <div className="space-y-3">
              {activityBreakdown.map((a, i) => {
                const maxSeconds = activityBreakdown[0].seconds;
                const pct = maxSeconds > 0 ? Math.max(4, Math.round((a.seconds / maxSeconds) * 100)) : 0;
                return (
                  <div key={a.activity}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={`font-semibold ${textHighlight}`}>{a.activity}</span>
                      <span className={textMuted}>{a.sessions} séance{a.sessions > 1 ? 's' : ''} · {formatDuration(Math.round(a.seconds))}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-4 ${textHighlight}`}>Tes styles</h3>
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={genreBreakdown} dataKey="seconds" nameKey="genre" innerRadius={45} outerRadius={80} paddingAngle={2}
                      onClick={(entry) => setSelectedStatsGenre(prev => prev === entry.genre ? null : entry.genre)}
                      style={{ cursor: 'pointer' }}
                    >
                      {genreBreakdown.map((entry, i) => (
                        <Cell key={entry.genre} fill={COLORS[i % COLORS.length]} opacity={selectedStatsGenre && selectedStatsGenre !== entry.genre ? 0.35 : 1} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value, name) => [formatDuration(Math.round(value)), name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2">
                  {genreBreakdown.map((g, i) => (
                    <button
                      key={g.genre}
                      onClick={() => setSelectedStatsGenre(prev => prev === g.genre ? null : g.genre)}
                      className={`w-full flex items-center justify-between text-sm rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedStatsGenre === g.genre ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                        <span className={`truncate font-semibold ${textHighlight}`}>{genreDisplayLabel(g.genre)}</span>
                      </div>
                      <span className={`shrink-0 ${textMuted}`}>{g.sessions} séance{g.sessions > 1 ? 's' : ''} · {formatDuration(Math.round(g.seconds))}</span>
                    </button>
                  ))}
                </div>
                {selectedStatsGenre && (
                  <div className={`w-full text-sm space-y-1.5 pt-3 border-t ${cardBorder}`}>
                    <div className={`font-bold ${textHighlight}`}>Zoom : {selectedStatsGenre}</div>
                    <div className={textMuted}>
                      <span className="font-semibold">Artistes</span> : {topNEntries(genreArtistCounts[selectedStatsGenre]).map(([a, c]) => `${a} (${c})`).join(', ') || '—'}
                    </div>
                    <div className={textMuted}>
                      <span className="font-semibold">Titres</span> : {topNTracksFromMap(genreTrackCounts[selectedStatsGenre]).map(t => `${t.title} (${t.count})`).join(', ') || '—'}
                    </div>
                    <div className={textMuted}>
                      <span className="font-semibold">BPM</span> : {bpmBucketOrder.filter(b => (genreBpmBuckets[selectedStatsGenre] || {})[b]).map(b => `${b} (${genreBpmBuckets[selectedStatsGenre][b]})`).join(', ') || '—'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {bpmDistribution.length > 0 && (
              <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
                <h3 className={`font-bold mb-4 ${textHighlight}`}>Tes BPM</h3>
                <div className="flex flex-col items-center gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={bpmDistribution} dataKey="count" nameKey="label" innerRadius={45} outerRadius={80} paddingAngle={2}
                        onClick={(entry) => setSelectedStatsBpmBucket(prev => prev === entry.label ? null : entry.label)}
                        style={{ cursor: 'pointer' }}
                      >
                        {bpmDistribution.map((entry, i) => (
                          <Cell key={entry.label} fill={COLORS[i % COLORS.length]} opacity={selectedStatsBpmBucket && selectedStatsBpmBucket !== entry.label ? 0.35 : 1} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value, name) => [`${value} titre${value > 1 ? 's' : ''}`, `${name} BPM`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-2">
                    {bpmDistribution.map((b, i) => (
                      <button
                        key={b.label}
                        onClick={() => setSelectedStatsBpmBucket(prev => prev === b.label ? null : b.label)}
                        className={`w-full flex items-center justify-between text-sm rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedStatsBpmBucket === b.label ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                          <span className={`truncate font-semibold ${textHighlight}`}>{b.label} BPM</span>
                        </div>
                        <span className={`shrink-0 ${textMuted}`}>{b.count} titre{b.count > 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                  {selectedStatsBpmBucket && (
                    <div className={`w-full text-sm space-y-1.5 pt-3 border-t ${cardBorder}`}>
                      <div className={`font-bold ${textHighlight}`}>Zoom : {selectedStatsBpmBucket} BPM</div>
                      <div className={textMuted}>
                        <span className="font-semibold">Artistes</span> : {topNEntries(bpmBucketArtistCounts[selectedStatsBpmBucket]).map(([a, c]) => `${a} (${c})`).join(', ') || '—'}
                      </div>
                      <div className={textMuted}>
                        <span className="font-semibold">Titres</span> : {topNTracksFromMap(bpmBucketTrackCounts[selectedStatsBpmBucket]).map(t => `${t.title} (${t.count})`).join(', ') || '—'}
                      </div>
                      <div className={textMuted}>
                        <span className="font-semibold">Styles</span> : {topNEntries(bpmBucketGenreCounts[selectedStatsBpmBucket]).map(([g, c]) => `${g} (${c})`).join(', ') || '—'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Top artistes / top titres — comptés à chaque COMPLÉTION d'une playlist
              qui les contient, pas juste à leur 1ère apparition. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-4 ${textHighlight}`}>Artistes les plus écoutés</h3>
              {topArtists.length === 0 ? (
                <p className={`text-sm ${textMuted}`}>Pas encore assez de données.</p>
              ) : (
                <div className="space-y-2">
                  {topArtists.map((a, i) => (
                    <div key={a.artist} className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 shrink-0 font-black text-xs ${textMuted}`}>#{i + 1}</span>
                        <div className="min-w-0">
                          <div className={`truncate font-semibold ${textHighlight}`}>{a.artist}</div>
                          {a.activity && (
                            <div className={`truncate text-xs ${textMuted}`}>
                              Surtout en {a.activity}{a.avgBpm ? ` · ~${a.avgBpm} BPM` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 ${textMuted}`}>{a.count} écoute{a.count > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-4 ${textHighlight}`}>Titres les plus écoutés</h3>
              {topTracks.length === 0 ? (
                <p className={`text-sm ${textMuted}`}>Pas encore assez de données.</p>
              ) : (
                <div className="space-y-2">
                  {topTracks.map((t, i) => (
                    <div key={t.title + t.artist} className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 shrink-0 font-black text-xs ${textMuted}`}>#{i + 1}</span>
                        <div className="min-w-0">
                          <div className={`truncate font-semibold ${textHighlight}`}>{t.title}</div>
                          <div className={`truncate text-xs ${textMuted}`}>
                            {t.artist}{t.activity ? ` · ${t.activity}` : ''}{t.avgBpm ? ` · ~${t.avgBpm} BPM` : ''}
                          </div>
                        </div>
                      </div>
                      <span className={`shrink-0 ${textMuted}`}>{t.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Évolution dans le temps — seulement si on a au moins 2 mois distincts. */}
          {timeline.length > 1 && (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-4 ${textHighlight}`}>Ton évolution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <RechartsTooltip formatter={(value) => [`${value} séance${value > 1 ? 's' : ''}`, '']} />
                  <Line type="monotone" dataKey="count" stroke={bgAccentClass.includes('rose') ? '#f43f5e' : '#ef4444'} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Régularité — jour de la semaine dominant + plus longue série de jours
              consécutifs avec au moins une séance. */}
          {(topWeekday || longestStreak > 1) && (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-4 ${textHighlight}`}>Ta régularité</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {topWeekday && (
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>Jour préféré</div>
                    <div className={`font-semibold ${textHighlight}`}>{topWeekday.name}</div>
                    <div className={textMuted}>{topWeekday.count} séance{topWeekday.count > 1 ? 's' : ''}</div>
                  </div>
                )}
                <div>
                  <div className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>Plus longue série</div>
                  <div className={`font-semibold ${textHighlight}`}>{longestStreak} jour{longestStreak > 1 ? 's' : ''} d'affilée</div>
                </div>
              </div>
            </div>
          )}

          {/* Bascule vers la vue détaillée. */}
          <button
            onClick={() => setShowAdvancedStats(!showAdvancedStats)}
            className={`w-full py-4 rounded-2xl border-2 border-dashed ${cardBorder} flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:${textHighlight} hover:border-gray-400`}
          >
            {showAdvancedStats ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            {showAdvancedStats ? "Revenir à la vue simple" : "Voir le détail complet"}
          </button>

          {/* Vue détaillée — TOUS les artistes/titres (pas un top 5), avec la
              répartition COMPLÈTE par activité plutôt que la seule activité
              dominante affichée ci-dessus. */}
          {showAdvancedStats && (
            <div className="space-y-6">
              <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder} overflow-x-auto`}>
                <h3 className={`font-bold mb-4 ${textHighlight}`}>Détail par genre ({allGenresDetailed.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left border-b ${cardBorder} ${textMuted}`}>
                      <th className="pb-2 pr-3 font-semibold">Genre</th>
                      <th className="pb-2 pr-3 font-semibold">Séances</th>
                      <th className="pb-2 pr-3 font-semibold">Durée</th>
                      <th className="pb-2 font-semibold">Activités</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allGenresDetailed.map(g => {
                      const isExpanded = expandedDetailGenre === g.genre;
                      return (
                      <React.Fragment key={g.genre}>
                        <tr
                          onClick={() => setExpandedDetailGenre(isExpanded ? null : g.genre)}
                          className={`border-b last:border-0 ${cardBorder} cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isExpanded ? 'bg-black/5 dark:bg-white/5' : ''}`}
                        >
                          <td className={`py-2 pr-3 font-semibold ${textHighlight} flex items-center gap-1.5`}>
                            {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {genreDisplayLabel(g.genre)}
                          </td>
                          <td className={`py-2 pr-3 ${textMuted}`}>{g.sessions}</td>
                          <td className={`py-2 pr-3 ${textMuted}`}>{formatDuration(Math.round(g.seconds))}</td>
                          <td className={`py-2 ${textMuted}`}>{g.activitiesLabel}</td>
                        </tr>
                        {isExpanded && (
                          <tr className={`border-b last:border-0 ${cardBorder}`}>
                            <td colSpan={4} className="py-3 px-2 text-xs space-y-1.5">
                              <div className={textMuted}><span className={`font-semibold ${textHighlight}`}>Tous les artistes</span> : {topNEntries(genreArtistCounts[g.genre], Infinity).map(([a, c]) => `${a} (${c})`).join(', ') || '—'}</div>
                              <div className={textMuted}><span className={`font-semibold ${textHighlight}`}>Tous les titres</span> : {topNTracksFromMap(genreTrackCounts[g.genre], Infinity).map(t => `${t.title} (${t.count})`).join(', ') || '—'}</div>
                              <div className={textMuted}><span className={`font-semibold ${textHighlight}`}>BPM</span> : {bpmBucketOrder.filter(b => (genreBpmBuckets[g.genre] || {})[b]).map(b => `${b} (${genreBpmBuckets[g.genre][b]})`).join(', ') || '—'}</div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder} overflow-x-auto`}>
                <h3 className={`font-bold mb-4 ${textHighlight}`}>Détail par artiste ({allArtistsDetailed.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left border-b ${cardBorder} ${textMuted}`}>
                      <th className="pb-2 pr-3 font-semibold">Artiste</th>
                      <th className="pb-2 pr-3 font-semibold">Écoutes</th>
                      <th className="pb-2 pr-3 font-semibold">Activités</th>
                      <th className="pb-2 font-semibold">BPM moyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allArtistsDetailed.map(a => {
                      const isExpanded = expandedDetailArtist === a.artist;
                      return (
                      <React.Fragment key={a.artist}>
                        <tr
                          onClick={() => setExpandedDetailArtist(isExpanded ? null : a.artist)}
                          className={`border-b last:border-0 ${cardBorder} cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isExpanded ? 'bg-black/5 dark:bg-white/5' : ''}`}
                        >
                          <td className={`py-2 pr-3 font-semibold ${textHighlight} flex items-center gap-1.5`}>
                            {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {a.artist}
                          </td>
                          <td className={`py-2 pr-3 ${textMuted}`}>{a.count}</td>
                          <td className={`py-2 pr-3 ${textMuted}`}>{a.activitiesLabel}</td>
                          <td className={`py-2 ${textMuted}`}>{a.avgBpm ?? '—'}</td>
                        </tr>
                        {isExpanded && (
                          <tr className={`border-b last:border-0 ${cardBorder}`}>
                            <td colSpan={4} className="py-3 px-2 text-xs">
                              <div className={textMuted}><span className={`font-semibold ${textHighlight}`}>Tous les titres de {a.artist}</span> : {topNTracksFromMap(artistTrackCounts[a.artist], Infinity).map(t => `${t.title} (${t.count})`).join(', ') || '—'}</div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder} overflow-x-auto`}>
                <h3 className={`font-bold mb-4 ${textHighlight}`}>Détail par titre ({allTracksDetailed.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left border-b ${cardBorder} ${textMuted}`}>
                      <th className="pb-2 pr-3 font-semibold">Titre</th>
                      <th className="pb-2 pr-3 font-semibold">Artiste</th>
                      <th className="pb-2 pr-3 font-semibold">Écoutes</th>
                      <th className="pb-2 pr-3 font-semibold">Activités</th>
                      <th className="pb-2 font-semibold">BPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTracksDetailed.map(t => (
                      <tr key={t.title + t.artist} className={`border-b last:border-0 ${cardBorder}`}>
                        <td className={`py-2 pr-3 font-semibold ${textHighlight}`}>{t.title}</td>
                        <td className={`py-2 pr-3 ${textMuted}`}>{t.artist}</td>
                        <td className={`py-2 pr-3 ${textMuted}`}>{t.count}</td>
                        <td className={`py-2 pr-3 ${textMuted}`}>{t.activitiesLabel}</td>
                        <td className={`py-2 ${textMuted}`}>{t.avgBpm ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className={`text-xs italic text-center ${textMuted}`}>
            "Écoute estimée" = durée totale des playlists × nombre de fois marquées faites — pas un chrono seconde par seconde de ce que tu as vraiment écouté.
          </p>
        </>
      )}
    </div>
  );
}
