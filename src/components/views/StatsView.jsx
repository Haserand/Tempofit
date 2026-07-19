import React, { useState, useRef } from 'react';
import { Activity, Flame, Upload, ChevronUp, ChevronDown, ChevronRight, Gauge, Share2, Loader2 } from 'lucide-react';
import { ATHLETIC_ZONES, getZoneForValue } from '../../appConfig';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { NAUGHTY_WORKOUT_LABELS } from '../../appConfig';
import { genreDisplayLabel, normalizeGenreForDisplay } from '../../musicCatalog';
import { formatDuration } from '../../utils/format';
import GlobalStatsShareCard from '../shared/GlobalStatsShareCard';

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
  theme, savedPlaylists, userStats, changeView, setCurrentPlaylist, athleticProfile, getProfileForWorkout, getProfileForWorkoutOrDefault,
  shareImageFile, showToast,
  statsMode, setStatsMode,
  selectedStatsGenre, setSelectedStatsGenre,
  selectedStatsBpmBucket, setSelectedStatsBpmBucket,
  showAdvancedStats, setShowAdvancedStats,
  expandedDetailGenre, setExpandedDetailGenre,
  expandedDetailArtist, setExpandedDetailArtist,
}) {
  const { cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass } = theme;

  // --- Bilan Global (export image, "Spotify Wrapped") ---
  // Carte rendue hors écran en permanence (même principe que
  // SessionSummaryCard/PlaylistDetailView.jsx) — mais ici, pas d'attente
  // d'image à charger avant la capture (GlobalStatsShareCard.jsx n'affiche
  // aucune pochette, que du texte/dégradé), donc l'export est plus direct.
  const globalStatsCardRef = useRef(null);
  const [isExportingGlobalStats, setIsExportingGlobalStats] = useState(false);

  const exportGlobalStatsImage = async () => {
    if (isExportingGlobalStats) return;
    setIsExportingGlobalStats(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(globalStatsCardRef.current, { scale: 2, backgroundColor: null, useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Conversion en image échouée');
      const file = new File([blob], 'tempofit-bilan-global.png', { type: 'image/png' });
      await shareImageFile(file, 'Mon Bilan TempoFit', "Mon bilan d'entraînement sur TempoFit 💪🎧");
    } catch (e) {
      if (showToast) showToast("Impossible de générer l'image du bilan — réessaie dans un instant.", 'error');
    } finally {
      setIsExportingGlobalStats(false);
    }
  };

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
  const bpmTargetCounts = {}; // BPM cible exact -> nb de séances à ce BPM (voir plus bas, "Allure favorite")
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

  // Profil Athlétique (BPM cibles par zone d'effort, voir useAthleticProfile.js) —
  // temps passé (secondes) dans chaque zone, tout historique ET ce mois-ci
  // uniquement (pour la légende motivante, voir plus bas).
  //
  // MULTI-ACTIVITÉS (cette session) : un profil par activité, plus de profil
  // global unique — chaque titre est donc classé selon le profil de
  // L'ACTIVITÉ DE SA PROPRE SÉANCE (`pl.workoutType`, déjà le nom résolu —
  // "Course à pied"/"Cyclisme"/un nom personnalisé — jamais littéralement
  // "Autre", voir getProfileForWorkout dans useAthleticProfile.js), pas un
  // seul profil appliqué à tout l'historique sans distinction. Une séance de
  // vélo se classe avec les zones du vélo, une séance de course avec celles
  // de la course — c'est tout l'intérêt du multi-activités.
  const zoneSeconds = { zone1: 0, zone2: 0, zone3: 0, zone4: 0 };
  const zoneSecondsThisMonth = { zone1: 0, zone2: 0, zone3: 0, zone4: 0 };
  // RETOUR DIRECT ("ajoute les 2" — tendance dans le temps + répartition par
  // activité, voir plus bas pour le rendu) : mêmes bruts que `zoneSeconds`/
  // `zoneSecondsThisMonth` ci-dessus, juste éclatés par activité et par mois
  // plutôt qu'agrégés globalement — remplis dans LA MÊME boucle de titres
  // plus bas (une seule passe sur les données, pas une 2e boucle dédiée).
  const zoneSecondsByActivity = {}; // activité -> { zone1..zone4 }
  const zoneSecondsByMonth = {}; // 'AAAA-MM' -> { zone1..zone4 }
  // RETOUR DIRECT ("proposer une visualisation par sync uniquement si
  // l'utilisateur active l'option") — accumulé dans LA MÊME boucle de titres
  // que le reste (une seule passe), mais séparément de zoneSeconds* : un
  // titre dont l'activité est en mode Synchro (`cadenceIntent: 'sync'`)
  // n'est PAS classé par zone ci-dessous (pas de sens en synchro, voir
  // useAthleticProfile.js) — il alimente ce tableau à la place. activité ->
  // { target, tracks: [{title, artist, bpm, gap}] }.
  const syncTracksByActivity = {};
  const nowForZones = new Date();
  // Classe un BPM réel dans la zone dont la valeur est la plus proche (voisin
  // le plus proche) — délègue à `getZoneForValue` (appConfig.js), seule
  // source de vérité pour cette classification (règle d'or ergonomie : même
  // logique de couleur/zone dans TOUTES les vues, plus une copie privée ici).
  //
  // RETOUR DIRECT ("le jargon 'effort' (Récupération/Seuil) a-t-il un sens
  // avec une estimation par défaut, ou tranches de BPM brutes dans ce cas ?")
  // — revenu à `getProfileForWorkout` (strict), pas
  // `getProfileForWorkoutOrDefault`. Le mode Synchro (voir plus bas,
  // `syncTracksByActivity`) applique déjà cette règle — il ne s'active JAMAIS
  // sans profil réellement configuré. Le camembert par zone suivait avant une
  // règle différente (repli par défaut), incohérente avec ça : le jargon
  // "effort" prétend connaître TA zone réelle, ce qui n'a de sens qu'avec un
  // vrai profil — sinon "Tes BPM" (tranches brutes, plus bas) fait déjà très
  // bien le travail sans fausse prétention de personnalisation.
  // `activityName` = le profil de QUELLE activité utiliser pour ce titre
  // précis (voir l'appel dans la boucle des titres plus bas).
  const classifyIntoZone = (bpmVal, activityName) => getZoneForValue(bpmVal, activityName, getProfileForWorkout)?.key || null;

  // RETOUR DIRECT ("recalculer un vrai genre par titre, pour pouvoir croiser
  // style × BPM comme dans PlaylistDetailView.jsx") — jusqu'ici un titre
  // était crédité à TOUS les genres tagués sur SA SÉANCE (`pl.config.
  // selectedGenres`), jamais à son propre genre réel : une séance "Rock +
  // Metal" comptait chacun de ses titres dans les deux catégories à la fois,
  // sans distinction. Repli sur le 1er genre de séance UNIQUEMENT si le
  // titre lui-même n'a aucun genre exploitable (`t.genre` absent — anciennes
  // données, ou titre ajouté manuellement sans résolution Deezer).
  // `normalizeGenreForDisplay` renvoie l'identifiant CANONIQUE (pas le
  // libellé d'affichage — voir sa doc dans musicCatalog.js), cohérent avec
  // le reste de cette page qui indexe toujours ses tables sur le nom
  // canonique et n'applique `genreDisplayLabel` qu'au moment de l'affichage.
  const trackGenreLabel = (t, sessionGenres) =>
    t.genre ? normalizeGenreForDisplay(t.genre, t.artist, t.title) : ((sessionGenres && sessionGenres[0]) || 'Autre');

  // Une entrée par OCCURRENCE de titre (une séance rejouée 3x compte 3
  // occurrences) — sert uniquement au croisement style×BPM du panneau
  // "Zoom" plus bas (voir hasStatsFilter/trackOccurrenceMatchesFilter) :
  // contrairement à `genreArtistCounts`/`genreBpmBuckets`/etc. (agrégés PAR
  // genre ou PAR tranche BPM séparément, toujours utiles pour la vue
  // avancée à un seul axe), cette liste plate permet de filtrer sur LES DEUX
  // axes à la fois avant de recompter, plutôt que de fusionner 2 tables déjà
  // agrégées indépendamment sans lien entre elles.
  const allTrackOccurrences = [];

  playlistsForStats.forEach(pl => {
    if (!pl.completions || pl.completions.length === 0) return;
    const genres = (pl.config?.selectedGenres && pl.config.selectedGenres.length > 0) ? pl.config.selectedGenres : ['Autre'];
    // En Mode Intime, `pl.workoutType` vaut toujours "Ambiance" (écrasé volontairement
    // pour la discrétion sur les cartes de playlist). L'activité RÉELLE est toujours
    // dans `pl.config.workoutName`.
    const activity = pl.isNaughty
      ? (NAUGHTY_WORKOUT_LABELS[pl.config?.workoutName] || pl.config?.workoutName || 'Autre')
      : (pl.workoutType || 'Autre');

    pl.completions.forEach(dateStr => {
      totalSessions += 1;
      totalSeconds += pl.totalDuration || 0;
      if (pl.config?.bpm) {
        bpmSum += pl.config.bpm; bpmCount += 1;
        // Fréquence par BPM CIBLE exact (pas une tranche) — sert au "Bilan
        // Global" partageable (voir GlobalStatsShareCard.jsx, exemple "Allure
        // favorite : 160 BPM") : un nombre précis et concret plutôt qu'une
        // tranche ("120-149 BPM"), plus proche de ce qu'on partagerait
        // spontanément à l'oral ("je tourne à 160").
        bpmTargetCounts[pl.config.bpm] = (bpmTargetCounts[pl.config.bpm] || 0) + 1;
      }
      // Calculé ici (avant la boucle des titres, qui en a besoin pour
      // zoneSecondsThisMonth/zoneSecondsByMonth) plutôt que plus bas où il
      // servait avant uniquement au regroupement par mois — même variable
      // `d`/`monthKey` réutilisée pour tout, jamais recalculée 2 fois.
      const d = new Date(dateStr);
      const isThisMonth = !isNaN(d) && d.getFullYear() === nowForZones.getFullYear() && d.getMonth() === nowForZones.getMonth();
      const monthKey = !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
      activitySeconds[activity] = (activitySeconds[activity] || 0) + (pl.totalDuration || 0);
      activitySessions[activity] = (activitySessions[activity] || 0) + 1;
      allSessions.push({ date: dateStr, duration: pl.totalDuration || 0, bpm: pl.config?.bpm || null, activity, genres, name: pl.name });
      // Genres RÉELLEMENT rencontrés parmi les titres de CETTE séance (voir
      // trackGenreLabel) — remplit `genreSessions`/`genreActivityCounts` à la
      // même granularité qu'avant (1 fois par genre PRÉSENT dans la séance,
      // pas 1 fois par titre), mais dérivée des vrais genres de titres plutôt
      // que des tags de séance déclarés.
      const sessionGenresPresent = new Set();
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

        // Genre RÉEL de CE titre (pas des genres de séance) — voir le retour
        // direct plus haut, trackGenreLabel.
        const g = trackGenreLabel(t, genres);
        sessionGenresPresent.add(g);
        genreSeconds[g] = (genreSeconds[g] || 0) + (t.duration || 0);
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

        if (t.bpm) {
          const bucket = bpmBucketLabel(t.bpm);
          bpmBuckets[bucket] += 1;
          if (!bpmBucketArtistCounts[bucket]) bpmBucketArtistCounts[bucket] = {};
          bpmBucketArtistCounts[bucket][t.artist] = (bpmBucketArtistCounts[bucket][t.artist] || 0) + 1;
          if (!bpmBucketTrackCounts[bucket]) bpmBucketTrackCounts[bucket] = {};
          if (!bpmBucketTrackCounts[bucket][key]) bpmBucketTrackCounts[bucket][key] = { title: t.title, artist: t.artist, count: 0 };
          bpmBucketTrackCounts[bucket][key].count += 1;
          if (!bpmBucketGenreCounts[bucket]) bpmBucketGenreCounts[bucket] = {};
          bpmBucketGenreCounts[bucket][g] = (bpmBucketGenreCounts[bucket][g] || 0) + 1;
        }

        // Liste plate pour le croisement style×BPM du panneau Zoom — voir
        // allTrackOccurrences plus haut.
        allTrackOccurrences.push({ title: t.title, artist: t.artist, bpm: t.bpm || null, genre: g });

        // Profil Athlétique : classe ce titre dans la zone la plus proche DU
        // PROFIL DE L'ACTIVITÉ DE CETTE SÉANCE (`activity`, déjà calculé plus
        // haut dans cette boucle — voir classifyIntoZone), et ajoute sa durée
        // réelle (pas une part égale de la séance comme pour les genres —
        // chaque titre pèse pour sa propre durée). `classifyIntoZone` renvoie
        // déjà `null` si aucun profil configuré pour cette activité, pas
        // besoin de re-vérifier `isConfigured` ici en plus.
        if (t.bpm) {
          const profileForActivity = getProfileForWorkoutOrDefault ? getProfileForWorkoutOrDefault(activity) : null;
          if (profileForActivity?.cadenceIntent === 'sync') {
            if (!syncTracksByActivity[activity]) syncTracksByActivity[activity] = { target: profileForActivity.targetBpm, tracks: [] };
            syncTracksByActivity[activity].tracks.push({ title: t.title, artist: t.artist, bpm: t.bpm, gap: t.bpm - profileForActivity.targetBpm });
          } else {
            const zoneKey = classifyIntoZone(t.bpm, activity);
            if (zoneKey) {
              zoneSeconds[zoneKey] += t.duration || 0;
              if (isThisMonth) zoneSecondsThisMonth[zoneKey] += t.duration || 0;
              if (!zoneSecondsByActivity[activity]) zoneSecondsByActivity[activity] = { zone1: 0, zone2: 0, zone3: 0, zone4: 0 };
              zoneSecondsByActivity[activity][zoneKey] += t.duration || 0;
              if (monthKey) {
                if (!zoneSecondsByMonth[monthKey]) zoneSecondsByMonth[monthKey] = { zone1: 0, zone2: 0, zone3: 0, zone4: 0 };
                zoneSecondsByMonth[monthKey][zoneKey] += t.duration || 0;
              }
            }
          }
        }
      });
      // Séance comptée 1 fois par genre RÉELLEMENT présent parmi ses titres
      // (sessionGenresPresent) — repli sur les genres de séance déclarés
      // uniquement si aucun titre n'a pu être attribué à un genre (aucun
      // titre avec artiste valide dans cette séance).
      const genresForThisSession = sessionGenresPresent.size > 0 ? sessionGenresPresent : new Set(genres);
      genresForThisSession.forEach(g => {
        genreSessions[g] = (genreSessions[g] || 0) + 1;
        if (!genreActivityCounts[g]) genreActivityCounts[g] = {};
        genreActivityCounts[g][activity] = (genreActivityCounts[g][activity] || 0) + 1;
      });
      // Regroupement par mois (année-mois) plutôt que par semaine ISO — plus simple
      // à calculer sans librairie de dates dédiée. Réutilise `monthKey` calculé plus
      // haut (avant la boucle des titres) plutôt que de le recalculer ici.
      if (monthKey) {
        sessionsByMonth[monthKey] = (sessionsByMonth[monthKey] || 0) + 1;
        weekdayCounts[d.getDay()] = (weekdayCounts[d.getDay()] || 0) + 1;
        uniqueDays.add(d.toISOString().slice(0, 10));
      }
    });
  });

  const genreBreakdown = Object.entries(genreSeconds)
    .map(([genre, seconds]) => ({ genre, seconds, sessions: genreSessions[genre] }))
    .sort((a, b) => b.seconds - a.seconds);

  // Profil Athlétique : répartition par zone (tout historique, dans l'ordre
  // Récupération → Vitesse plutôt que trié par volume — contrairement aux
  // styles/BPM, l'ordre des zones a un sens physiologique qu'un tri par
  // volume casserait). Vide (tableau vide, pas d'erreur) si le profil n'est
  // pas configuré, `zoneSeconds` reste alors à zéro partout.
  const zoneBreakdown = ATHLETIC_ZONES
    .map(z => ({ ...z, seconds: zoneSeconds[z.key] }))
    .filter(z => z.seconds > 0);
  const zoneTotalSeconds = zoneBreakdown.reduce((s, z) => s + z.seconds, 0);

  // Légende motivante scopée au mois en cours (voir zoneSecondsThisMonth) —
  // seulement si au moins une séance ce mois-ci est tombée dans une zone,
  // sinon pas de phrase creuse à 0% partout.
  const zoneTotalSecondsThisMonth = ATHLETIC_ZONES.reduce((s, z) => s + zoneSecondsThisMonth[z.key], 0);
  const zoneMonthSummary = zoneTotalSecondsThisMonth > 0
    ? ATHLETIC_ZONES
        .map(z => ({ ...z, pct: Math.round((zoneSecondsThisMonth[z.key] / zoneTotalSecondsThisMonth) * 100) }))
        .filter(z => z.pct > 0)
        .sort((a, b) => b.pct - a.pct)
        .map(z => `${z.pct}% ${z.shortLabel}`)
        .join(', ')
    : null;

  // RETOUR DIRECT ("ajoute les 2" — répartition par activité, à côté du
  // total agrégé ci-dessus) : le camembert global mélange toutes tes
  // activités ensemble, ce qui peut brouiller la lecture si tu pratiques
  // plusieurs sports avec des profils très différents (ex. 90% Récupération
  // en course, mais 60% Seuil en vélo — invisible dans un seul agrégat).
  // Une entrée par activité, seulement celles avec au moins un titre classé
  // (`zoneSecondsByActivity`, rempli dans la boucle plus haut) — triée par
  // volume décroissant, comme `activityBreakdown` juste en dessous.
  const zoneBreakdownByActivity = Object.entries(zoneSecondsByActivity)
    .map(([activity, secs]) => {
      const zones = ATHLETIC_ZONES.map(z => ({ ...z, seconds: secs[z.key] })).filter(z => z.seconds > 0);
      const total = zones.reduce((s, z) => s + z.seconds, 0);
      return { activity, total, zones: zones.map(z => ({ ...z, pct: Math.round((z.seconds / total) * 100) })) };
    })
    .filter(a => a.total > 0)
    .sort((a, b) => b.total - a.total);

  // RETOUR DIRECT ("proposer une visualisation par sync uniquement si
  // l'utilisateur active l'option") — un résumé par activité en mode
  // Synchro (`syncTracksByActivity`, rempli dans la boucle plus haut) :
  // écart moyen (en valeur absolue — un écart de -8 et +8 doivent compter
  // pareil, aucun des deux n'est "plus proche" de la cible) + la liste des
  // titres avec leur écart signé, pour le nuage de points. VIDE (tableau) si
  // aucune activité n'est en mode Synchro — c'est ce qui permet à la section
  // entière de rester masquée par défaut (voir plus bas), exactement comme
  // demandé.
  const syncActivitySummaries = Object.entries(syncTracksByActivity)
    .map(([activity, { target, tracks }]) => ({
      activity,
      target,
      avgGap: tracks.length > 0 ? Math.round(tracks.reduce((s, t) => s + Math.abs(t.gap), 0) / tracks.length) : 0,
      tracks,
    }))
    .filter(a => a.tracks.length > 0)
    .sort((a, b) => b.tracks.length - a.tracks.length);

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
  // RETOUR DIRECT ("croiser les données des graphiques : voir les morceaux
  // Metal dans les 2 catégories, pas juste Rock ET Metal dans les 2
  // catégories") — l'ancienne approche (2 helpers `mergeCountMaps`/
  // `mergeTrackMaps`, supprimés) fusionnait plusieurs valeurs sélectionnées
  // À L'INTÉRIEUR d'un même camembert (ex. Rock + Metal ensemble), mais ne
  // croisait jamais les 2 camemberts ENTRE EUX (style ET BPM) : sélectionner
  // Metal + 140-159 BPM montrait "tout Metal" d'un côté et "tout 140-159" de
  // l'autre, jamais leur intersection.
  // `allTrackOccurrences` (une entrée par occurrence de titre, genre RÉEL
  // inclus — voir trackGenreLabel) permet maintenant ce vrai croisement : on
  // filtre d'abord sur LES DEUX sélections à la fois, puis on recompte
  // artistes/titres/tranches BPM/genres à partir de ce sous-ensemble déjà
  // croisé — même principe que `trackMatchesDetailFilter` dans
  // PlaylistDetailView.jsx, appliqué ici à tout l'historique plutôt qu'à une
  // seule playlist.
  const hasStatsFilter = selectedStatsGenre.size > 0 || selectedStatsBpmBucket.size > 0;
  const trackOccurrenceMatchesStatsFilter = (occ) =>
    (selectedStatsGenre.size === 0 || selectedStatsGenre.has(occ.genre)) &&
    (selectedStatsBpmBucket.size === 0 || (occ.bpm != null && selectedStatsBpmBucket.has(bpmBucketLabel(occ.bpm))));
  const statsZoomArtistCounts = {};
  const statsZoomGenreCounts = {};
  const statsZoomBpmCounts = {};
  const statsZoomTrackCounts = {};
  if (hasStatsFilter) {
    allTrackOccurrences.filter(trackOccurrenceMatchesStatsFilter).forEach(occ => {
      statsZoomArtistCounts[occ.artist] = (statsZoomArtistCounts[occ.artist] || 0) + 1;
      statsZoomGenreCounts[occ.genre] = (statsZoomGenreCounts[occ.genre] || 0) + 1;
      if (occ.bpm != null) {
        const b = bpmBucketLabel(occ.bpm);
        statsZoomBpmCounts[b] = (statsZoomBpmCounts[b] || 0) + 1;
      }
      const trackKey = `${occ.title}|||${occ.artist}`;
      if (!statsZoomTrackCounts[trackKey]) statsZoomTrackCounts[trackKey] = { title: occ.title, artist: occ.artist, count: 0 };
      statsZoomTrackCounts[trackKey].count += 1;
    });
  }
  // Libellé combiné des 2 filtres actifs pour l'en-tête "Zoom" — même format
  // que `activeDetailFilterLabel` dans PlaylistDetailView.jsx.
  const activeStatsFilterLabel = [
    selectedStatsGenre.size > 0 ? [...selectedStatsGenre].map(genreDisplayLabel).join(', ') : null,
    selectedStatsBpmBucket.size > 0 ? `${[...selectedStatsBpmBucket].join(', ')} BPM` : null,
  ].filter(Boolean).join(' · ');
  // BPM moyen réel d'un titre (pas le BPM cible de la séance) — même clé
  // "titre|||artiste" que trackBpmSum/trackBpmCount plus haut. Utilisé par le
  // récap de titres des zooms genre/BPM ci-dessous (voir "Titres écoutés").
  const avgBpmForTrack = (t) => {
    const key = `${t.title}|||${t.artist}`;
    return trackBpmCount[key] ? Math.round(trackBpmSum[key] / trackBpmCount[key]) : null;
  };

  const monthLabels = { '01':'Jan','02':'Fév','03':'Mar','04':'Avr','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sep','10':'Oct','11':'Nov','12':'Déc' };
  const timeline = Object.entries(sessionsByMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => { const [y, m] = key.split('-'); return { label: `${monthLabels[m]} ${y}`, count }; });

  // RETOUR DIRECT ("ajoute les 2" — tendance dans le temps, à côté de la
  // répartition par activité ci-dessus) : le % global (zoneBreakdown) ou même
  // mensuel (zoneMonthSummary) ne montre qu'UN instant T — impossible de voir
  // si ta part de Récupération augmente ou diminue mois après mois. En
  // MINUTES (pas en %) volontairement : un mois avec 2x plus de séances doit
  // se voir comme une barre plus haute, pas comme des proportions identiques
  // qui masqueraient ce changement de volume (même raisonnement que le total
  // en tête de carte du camembert, voir zoneTotalSeconds plus haut). Un
  // dataKey PAR ZONE (zone1..zone4) empilé dans le rendu (stackId) plutôt
  // qu'un objet imbriqué : c'est le format que Recharts attend pour un
  // BarChart empilé.
  const zoneTrendData = Object.entries(zoneSecondsByMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, secs]) => {
      const [y, m] = key.split('-');
      const entry = { label: `${monthLabels[m]} ${y}` };
      ATHLETIC_ZONES.forEach(z => { entry[z.key] = Math.round((secs[z.key] || 0) / 60); }); // minutes, plus lisible qu'en secondes sur l'axe Y
      return entry;
    });

  const avgBpm = bpmCount > 0 ? Math.round(bpmSum / bpmCount) : null;
  // BPM le plus fréquent parmi toutes les séances — "Allure favorite" du
  // Bilan Global (voir GlobalStatsShareCard.jsx). À égalité, le plus élevé
  // l'emporte (choix arbitraire mais stable/déterministe plutôt que dépendre
  // de l'ordre d'insertion de l'objet).
  const favoriteBpm = Object.keys(bpmTargetCounts).length > 0
    ? Object.entries(bpmTargetCounts).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0]
    : null;

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
            l'app pour ce mode. Le chemin retour (une fois dedans) reste en texte.
            "Partager mon bilan" (Bilan Global, voir GlobalStatsShareCard.jsx) à
            côté — bouton BIEN VISIBLE (retour direct), contrairement à la bascule
            Intime qui elle reste volontairement discrète. */}
        <div className="flex items-center gap-2 shrink-0">
          {totalSessions > 0 && (
            <button
              onClick={exportGlobalStatsImage}
              disabled={isExportingGlobalStats}
              title="Générer une image de ton bilan global à partager"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${bgAccentClass} text-white hover:brightness-110 disabled:opacity-60 disabled:cursor-wait`}
            >
              {isExportingGlobalStats ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              <span>{isExportingGlobalStats ? 'Génération...' : 'Partager mon bilan'}</span>
            </button>
          )}
          {statsMode === 'naughty' ? (
            <button
              onClick={() => { setStatsMode('standard'); setSelectedStatsGenre(new Set()); setSelectedStatsBpmBucket(new Set()); }}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors ${textMuted} hover:text-main hover:bg-surface-hover`}
            >
              ← Stats standards
            </button>
          ) : (
            <button
              onClick={() => { setStatsMode('naughty'); setSelectedStatsGenre(new Set()); setSelectedStatsBpmBucket(new Set()); }}
              title="Stats Mode Intime"
              className="p-2 rounded-lg text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              <Flame size={18} />
            </button>
          )}
        </div>
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

          {/* RETOUR DIRECT (capture d'écran à l'appui, "zones d'intensité et
              BPM musique portent à confusion, structurer par catégorie") —
              page réorganisée en 2 catégories visuelles plutôt qu'une simple
              liste de blocs :
                🏃 Entraînement (Activités + Zones d'intensité) — décrit
                  COMMENT tu t'es entraîné, dérivé de ton Profil Athlétique.
                🎵 Musique (Styles + BPM) — décrit CE QUE tu as écouté, sans
                  aucun lien avec ce profil.
              "Tes zones d'intensité" et "Tes BPM" utilisaient déjà 2 palettes
              différentes pour des découpages qui se ressemblent (tous deux
              tranchent le même axe : le BPM des titres écoutés) — les
              séparer clairement en 2 groupes, chacun avec un sous-titre
              explicite, au lieu de les laisser visuellement adjacents comme
              avant, réduit le risque de les lire comme la même donnée. */}
          <p className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>🏃 Entraînement</p>

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

          {zoneBreakdown.length === 0 ? (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder} flex items-start gap-4`}>
              <div className={`shrink-0 p-2.5 rounded-xl ${bgAccentClass} text-white`}><Gauge size={20}/></div>
              <div>
                <h3 className={`font-bold mb-1 ${textHighlight}`}>Vois comment tu t'entraînes par zone</h3>
                <p className={`text-sm ${textMuted}`}>Configure ton Profil Athlétique (BPM cibles par zone) pour voir la répartition de tes séances entre Récupération, Endurance, Seuil et Vitesse.</p>
                <button onClick={() => changeView('generator')} className={`mt-3 text-sm font-bold underline ${textColorClass}`}>
                  Configurer mon Profil Athlétique →
                </button>
              </div>
            </div>
          ) : (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold flex items-center gap-2 ${textHighlight}`}><Gauge size={18} className={textColorClass}/> Tes zones d'intensité</h3>
              {/* RETOUR DIRECT ("le jargon 'effort' a-t-il un sens avec une
                  estimation par défaut ?") — redevenu strict : ce camembert
                  n'apparaît QUE s'il y a de vraies données classées (voir
                  classifyIntoZone plus haut, `getProfileForWorkout`) — donc
                  toujours "Basé sur ton Profil Athlétique" ici, plus de
                  branche "estimation par défaut" (elle ne peut plus se
                  produire : sans profil réel, `zoneBreakdown` reste vide,
                  voir le CTA ci-dessus à la place). */}
              <p className={`text-xs mb-1 ${textMuted}`}>Basé sur ton Profil Athlétique — pas le même découpage que "Tes BPM" plus bas.</p>
              {/* RETOUR DIRECT ("est-ce que ça vaut le coup de montrer le
                  temps passé dans chaque zone ?") — jusqu'ici seul le %
                  était affiché (la donnée en secondes existait déjà dans
                  `zoneBreakdown`/`zoneTotalSeconds`, juste jamais montrée).
                  Le % seul répond à "comment mes séances SE RÉPARTISSENT",
                  mais pas à "combien de temps j'ai VRAIMENT passé" — les deux
                  se lisent différemment dans le temps : un % peut rester
                  stable (85/15) alors que le volume réel augmente d'un mois
                  sur l'autre, ce que le % seul ne montre jamais. Ajouté à 2
                  endroits : le total en tête de carte, et la durée à côté du
                  % de chaque zone dans la légende. */}
              <p className={`text-sm font-bold mb-4 ${textHighlight}`}>{formatDuration(zoneTotalSeconds)} au total, toutes zones confondues.</p>
              <div className="w-full h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={zoneBreakdown} dataKey="seconds" nameKey="shortLabel"
                      cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                      paddingAngle={3} cornerRadius={4} stroke="none"
                    >
                      {zoneBreakdown.map((z, i) => <Cell key={i} fill={z.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value, name) => {
                      const pct = zoneTotalSeconds > 0 ? Math.round((value / zoneTotalSeconds) * 100) : 0;
                      return [`${formatDuration(value)} (${pct}%)`, name];
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                {zoneBreakdown.map((z, i) => {
                  const pct = zoneTotalSeconds > 0 ? Math.round((z.seconds / zoneTotalSeconds) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                      <span className={textHighlight}>{z.shortLabel}</span>
                      <span className={textMuted}>{pct}% · {formatDuration(z.seconds)}</span>
                    </div>
                  );
                })}
              </div>
              {/* Légende motivante scopée au mois en cours — voir
                  zoneMonthSummary. Absente s'il n'y a aucune séance ce
                  mois-ci dans une zone connue, plutôt qu'une phrase à 0%
                  partout. Durée totale du mois ajoutée en fin de phrase (même
                  logique que ci-dessus : le % seul ne dit pas si le mois a été
                  copieux ou maigre en entraînement). */}
              {/* RETOUR DIRECT ("ajoute les 2" — répartition par activité) —
                  seulement si au moins 2 activités ont des titres classés :
                  pas la peine de répéter le camembert du dessus pour une
                  seule activité, l'info serait identique. */}
              {zoneBreakdownByActivity.length > 1 && (
                <div className={`mt-4 pt-4 border-t ${cardBorder} space-y-3`}>
                  <div className={`text-xs font-bold uppercase tracking-wide ${textMuted}`}>Détail par activité</div>
                  {zoneBreakdownByActivity.map(a => (
                    <div key={a.activity}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className={`font-semibold ${textHighlight}`}>{a.activity}</span>
                        <span className={textMuted}>{formatDuration(a.total)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden flex">
                        {a.zones.map((z, i) => (
                          <div key={i} style={{ width: `${z.pct}%`, backgroundColor: z.color }}></div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 mt-1 text-xs">
                        {a.zones.map((z, i) => (
                          <span key={i} className={textMuted}><span className={`font-semibold ${textHighlight}`}>{z.pct}%</span> {z.shortLabel}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {zoneMonthSummary && (
                <p className={`text-sm text-center mt-4 pt-4 border-t ${cardBorder} ${textHighlight}`}>
                  <span className="font-bold">Ce mois-ci</span> : {zoneMonthSummary} <span className={textMuted}>({formatDuration(zoneTotalSecondsThisMonth)} au total)</span>
                </p>
              )}
            </div>
          )}

          {/* RETOUR DIRECT ("ajoute les 2" — tendance dans le temps) — même
              garde-fou que "Ton évolution" plus bas (au moins 2 mois
              distincts, sinon une seule barre n'apprend rien). En minutes
              (voir zoneTrendData plus haut), empilées par zone : une barre
              plus haute d'un mois sur l'autre montre un volume d'entraînement
              en hausse, ce qu'un % seul ne peut jamais montrer. */}
          {zoneTrendData.length > 1 && (
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold ${textHighlight}`}>Ton évolution par zone</h3>
              <p className={`text-xs mb-4 ${textMuted}`}>Minutes passées dans chaque zone, mois par mois.</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={zoneTrendData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} unit="m" />
                  <RechartsTooltip formatter={(value, name) => {
                    const z = ATHLETIC_ZONES.find(z => z.key === name);
                    return [`${value} min`, z ? z.shortLabel : name];
                  }} />
                  {ATHLETIC_ZONES.map(z => (
                    <Bar key={z.key} dataKey={z.key} stackId="zones" fill={z.color} radius={z.key === 'zone4' ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                {ATHLETIC_ZONES.map(z => (
                  <div key={z.key} className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                    <span className={textMuted}>{z.shortLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RETOUR DIRECT ("proposer une visualisation par sync uniquement
              si l'utilisateur active l'option") — section entière absente si
              `syncActivitySummaries` est vide (aucune activité en mode
              Synchro) : jamais un bloc à moitié vide pour qui n'a jamais
              touché à cette option. Un chiffre ("Écart moyen") + un nuage de
              points autour d'une cible plutôt qu'un camembert par zone — en
              synchro, les 4 zones sont volontairement resserrées (voir
              SYNC_ZONE_SPACING_BY_ACTIVITY, useAthleticProfile.js), un
              camembert y serait presque unicolore et n'apprendrait rien. Une
              carte par activité en synchro (comme "Détail par activité"
              ci-dessus pour les zones), pas un seul agrégat : les cibles de
              cadence diffèrent d'une activité à l'autre (ex. course vs
              vélo), les mélanger n'aurait pas de sens. */}
          {syncActivitySummaries.length > 0 && syncActivitySummaries.map(({ activity, target, avgGap, tracks }) => {
            const maxAbsGap = Math.max(10, ...tracks.map(t => Math.abs(t.gap)));
            return (
              <div key={activity} className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
                <h3 className={`font-bold flex items-center gap-2 ${textHighlight}`}><Activity size={18} className={textColorClass}/> Ta synchro cadence — {activity}</h3>
                <p className={`text-xs mb-4 ${textMuted}`}>La musique doit suivre ta cadence, pas ton intensité — {tracks.length} titre{tracks.length > 1 ? 's' : ''} avec BPM exploitable.</p>
                <div className={`text-2xl font-black mb-1 ${textHighlight}`}>
                  Écart moyen : <span className={textColorClass}>{avgGap} BPM</span>
                </div>
                <p className={`text-xs mb-2 ${textMuted}`}>Cible : {target} BPM</p>
                <div className="relative h-16 mt-2">
                  <div className={`absolute left-0 right-0 top-1/2 h-px ${cardBorder} border-t`}></div>
                  <div className={`absolute left-1/2 top-0 bottom-0 w-px ${textColorClass.includes('rose') ? 'bg-rose-500' : 'bg-red-500'}`}></div>
                  {tracks.map((t, i) => {
                    const pct = 50 + (t.gap / maxAbsGap) * 45;
                    return (
                      <div
                        key={i}
                        title={`${t.title} — ${t.bpm} BPM (${t.gap > 0 ? '+' : ''}${t.gap})`}
                        className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 shadow ${textColorClass.includes('rose') ? 'bg-rose-400' : 'bg-red-400'}`}
                        style={{ left: `${pct}%`, top: `${8 + (i % 3) * 14}px` }}
                      ></div>
                    );
                  })}
                </div>
                <div className={`flex justify-between text-[10px] mt-1 ${textMuted}`}>
                  <span>Plus lent</span>
                  <span>Cible ({target})</span>
                  <span>Plus rapide</span>
                </div>
              </div>
            );
          })}

          <p className={`text-xs font-bold uppercase tracking-wide pt-2 ${textMuted}`}>🎵 Musique</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
              <h3 className={`font-bold mb-4 ${textHighlight}`}>Tes styles</h3>
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={genreBreakdown} dataKey="seconds" nameKey="genre" innerRadius={45} outerRadius={80} paddingAngle={2}
                      onClick={(entry) => setSelectedStatsGenre(prev => { const next = new Set(prev); next.has(entry.genre) ? next.delete(entry.genre) : next.add(entry.genre); return next; })}
                      style={{ cursor: 'pointer' }}
                    >
                      {genreBreakdown.map((entry, i) => (
                        <Cell key={entry.genre} fill={COLORS[i % COLORS.length]} opacity={selectedStatsGenre.size > 0 && !selectedStatsGenre.has(entry.genre) ? 0.35 : 1} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value, name) => [formatDuration(Math.round(value)), name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2">
                  {genreBreakdown.map((g, i) => (
                    <button
                      key={g.genre}
                      onClick={() => setSelectedStatsGenre(prev => { const next = new Set(prev); next.has(g.genre) ? next.delete(g.genre) : next.add(g.genre); return next; })}
                      className={`w-full flex items-center justify-between text-sm rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedStatsGenre.has(g.genre) ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                        <span className={`truncate font-semibold ${textHighlight}`}>{genreDisplayLabel(g.genre)}</span>
                      </div>
                      <span className={`shrink-0 ${textMuted}`}>{g.sessions} séance{g.sessions > 1 ? 's' : ''} · {formatDuration(Math.round(g.seconds))}</span>
                    </button>
                  ))}
                </div>
                {hasStatsFilter && (() => {
                  return (
                  <div className={`w-full text-sm space-y-1.5 pt-3 border-t ${cardBorder}`}>
                    <div className={`font-bold ${textHighlight}`}>Zoom : {activeStatsFilterLabel}</div>
                    <div className={textMuted}>
                      <span className="font-semibold">Artistes</span> : {topNEntries(statsZoomArtistCounts).map(([a, c]) => `${a} (${c})`).join(', ') || '—'}
                    </div>
                    <div className={textMuted}>
                      <span className="font-semibold">BPM</span> : {bpmBucketOrder.filter(b => statsZoomBpmCounts[b]).map(b => `${b} (${statsZoomBpmCounts[b]})`).join(', ') || '—'}
                    </div>
                    {/* Récap complet des titres écoutés dans ce genre (pas
                        seulement le top 3, comme la ligne "Artistes"/"BPM"
                        ci-dessus) — retour direct : ces 2 lignes en résumé ne
                        montraient pas VRAIMENT quels titres composent la part
                        cliquée. Scrollable au-delà de 6 lignes pour ne pas
                        faire exploser la hauteur de la carte sur un gros
                        historique. */}
                    <div className={`font-semibold ${textHighlight} pt-1`}>Titres écoutés</div>
                    <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1 -mx-1.5">
                      {topNTracksFromMap(statsZoomTrackCounts, Infinity).map((t, i) => (
                        <div key={i} className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded-lg ${i % 2 === 0 ? '' : 'bg-black/5 dark:bg-white/5'}`}>
                          <div className="min-w-0">
                            <div className={`font-semibold truncate ${textHighlight}`}>{t.title}</div>
                            <div className={`text-xs truncate ${textMuted}`}>{t.artist}{avgBpmForTrack(t) ? ` · ~${avgBpmForTrack(t)} BPM` : ''}</div>
                          </div>
                          <span className={`shrink-0 text-xs font-bold ${textMuted}`}>{t.count}x</span>
                        </div>
                      )) }
                      {Object.keys(statsZoomTrackCounts).length === 0 && (
                        <div className={textMuted}>—</div>
                      )}
                    </div>
                  </div>
                  );
                })()}
              </div>
            </div>

            {bpmDistribution.length > 0 && (
              <div className={`${cardBg} rounded-2xl p-4 md:p-6 border ${cardBorder}`}>
                <h3 className={`font-bold ${textHighlight}`}>Tes BPM</h3>
                <p className={`text-xs mb-4 ${textMuted}`}>Répartition brute des titres écoutés — indépendante de ton profil.</p>
                <div className="flex flex-col items-center gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={bpmDistribution} dataKey="count" nameKey="label" innerRadius={45} outerRadius={80} paddingAngle={2}
                        onClick={(entry) => setSelectedStatsBpmBucket(prev => { const next = new Set(prev); next.has(entry.label) ? next.delete(entry.label) : next.add(entry.label); return next; })}
                        style={{ cursor: 'pointer' }}
                      >
                        {bpmDistribution.map((entry, i) => (
                          <Cell key={entry.label} fill={COLORS[i % COLORS.length]} opacity={selectedStatsBpmBucket.size > 0 && !selectedStatsBpmBucket.has(entry.label) ? 0.35 : 1} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value, name) => [`${value} titre${value > 1 ? 's' : ''}`, `${name} BPM`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-2">
                    {bpmDistribution.map((b, i) => (
                      <button
                        key={b.label}
                        onClick={() => setSelectedStatsBpmBucket(prev => { const next = new Set(prev); next.has(b.label) ? next.delete(b.label) : next.add(b.label); return next; })}
                        className={`w-full flex items-center justify-between text-sm rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${selectedStatsBpmBucket.has(b.label) ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                          <span className={`truncate font-semibold ${textHighlight}`}>{b.label} BPM</span>
                        </div>
                        <span className={`shrink-0 ${textMuted}`}>{b.count} titre{b.count > 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                  {hasStatsFilter && (() => {
                    return (
                    <div className={`w-full text-sm space-y-1.5 pt-3 border-t ${cardBorder}`}>
                      <div className={`font-bold ${textHighlight}`}>Zoom : {activeStatsFilterLabel}</div>
                      <div className={textMuted}>
                        <span className="font-semibold">Artistes</span> : {topNEntries(statsZoomArtistCounts).map(([a, c]) => `${a} (${c})`).join(', ') || '—'}
                      </div>
                      <div className={textMuted}>
                        <span className="font-semibold">Styles</span> : {topNEntries(statsZoomGenreCounts).map(([g, c]) => `${g} (${c})`).join(', ') || '—'}
                      </div>
                      <div className={`font-semibold ${textHighlight} pt-1`}>Titres écoutés</div>
                      <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1 -mx-1.5">
                        {topNTracksFromMap(statsZoomTrackCounts, Infinity).map((t, i) => (
                          <div key={i} className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded-lg ${i % 2 === 0 ? '' : 'bg-black/5 dark:bg-white/5'}`}>
                            <div className="min-w-0">
                              <div className={`font-semibold truncate ${textHighlight}`}>{t.title}</div>
                              <div className={`text-xs truncate ${textMuted}`}>{t.artist}{avgBpmForTrack(t) ? ` · ~${avgBpmForTrack(t)} BPM` : ''}</div>
                            </div>
                            <span className={`shrink-0 text-xs font-bold ${textMuted}`}>{t.count}x</span>
                          </div>
                        ))}
                        {Object.keys(statsZoomTrackCounts).length === 0 && (
                          <div className={textMuted}>—</div>
                        )}
                      </div>
                    </div>
                    );
                  })()}
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
            className={`w-full py-4 rounded-2xl border-2 border-dashed ${cardBorder} flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:text-main hover:border-gray-400`}
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

      {/* Rendu hors écran, en permanence — voir exportGlobalStatsImage plus
          haut. Câblé sur les VRAIES données déjà calculées pour le reste de
          cette page (totalSeconds, avgBpm, favoriteBpm...), scopées au mode
          Standard/Intime actuellement consulté (statsMode) comme tout le
          reste ici. `totalPlaylistsGenerated` = playlistsForStats.length,
          pas totalSessions : le nombre de PLAYLISTS générées et sauvegardées,
          pas le nombre de fois qu'elles ont été rejouées (voir la demande
          initiale, qui distingue explicitement les deux). */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={globalStatsCardRef}>
          <GlobalStatsShareCard
            totalSeconds={totalSeconds}
            totalPlaylistsGenerated={playlistsForStats.length}
            avgBpm={avgBpm ?? 0}
            favoriteBpmLabel={favoriteBpm ? `${favoriteBpm} BPM` : '—'}
            isNaughtyMode={statsMode === 'naughty'}
          />
        </div>
      </div>
    </div>
  );
}
