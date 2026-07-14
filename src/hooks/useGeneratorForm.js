import { useState } from 'react';
import { STANDARD_GENRES, NAUGHTY_GENRES, normalizeGenreForDisplay } from '../musicCatalog';

/**
 * useGeneratorForm — regroupe tout l'état du formulaire du wizard de
 * génération (4 étapes) : BPM, genres + pondérations, segments (mode
 * Fractionné), durée/distance, allure.
 *
 * C'est le plus gros hook créé jusqu'ici, et le plus dense — contrairement
 * aux précédents (favoris, routines, partage...), qui étaient chacun un
 * domaine assez isolé, celui-ci est le cœur même du formulaire, avec
 * plusieurs fonctions qui se recoupent (toggleGenre dépend de
 * equalSplitWeights, setGenreWeight dépend de selectedGenres...). Regroupées
 * ici plutôt que laissées éparpillées, mais à traiter comme un bloc dense
 * plutôt que plusieurs petites pièces indépendantes.
 *
 * Volontairement PAS inclus dans ce hook (restent dans App.jsx) :
 *   - `workoutType`/`customActivity` : gérés par useCustomActivity, qui a
 *     besoin d'écrire dans workoutType depuis un autre contexte (bouton
 *     "Autre" de l'étape 1) — les garder séparés évite une dépendance
 *     circulaire entre les deux hooks.
 *   - `getActiveWorkoutName` : dépend justement de workoutType/customActivity,
 *     reste dans App.jsx pour cette raison.
 *   - `executeGeneration` : la fonction qui lance réellement une génération,
 *     bien plus large (touche savedPlaylists, routines, userStats...), reste
 *     dans App.jsx.
 */
export function useGeneratorForm(isNaughtyMode) {
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState(['Métal']);
  // Répartition en % entre les genres sélectionnés ENSEMBLE (utile uniquement à
  // partir de 2 genres) — voir setGenreWeight pour la logique de verrouillage :
  // un genre modifié manuellement se fige à sa valeur, seuls les genres jamais
  // touchés se repartagent ce qui reste, à parts égales entre eux.
  const [genreWeights, setGenreWeights] = useState({ 'Métal': 100 });
  const [lockedGenreWeights, setLockedGenreWeights] = useState(new Set());
  // Affiche ou non le reste de la taxonomie Deezer (EXTRA_GENRES) sous les 3
  // sélecteurs de genre (wizard étape 4, page Favoris, édition de routine) —
  // un seul état partagé puisque c'est une simple préférence d'affichage, pas
  // une donnée métier par écran.
  const [showExtraGenres, setShowExtraGenres] = useState(false);

  const [bpmTolerance, setBpmTolerance] = useState(14);
  const [crossfade, setCrossfade] = useState(2);
  const [bpm, setBpm] = useState(160);
  const [isIntervalMode, setIsIntervalMode] = useState(false);
  // Autorise ou non les titres de plus de 6 minutes dans la génération — sans
  // ça, l'algorithme de remplissage (qui choisit le titre dont la durée colle
  // le mieux au temps restant) pouvait piocher un morceau atypiquement long
  // juste parce qu'il comblait bien la séance, au détriment de la variété.
  // Off par défaut.
  const [allowLongTracks, setAllowLongTracks] = useState(false);

  const [targetMode, setTargetMode] = useState('time');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(45);

  const [distanceVal, setDistanceVal] = useState(5);
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [paceMin, setPaceMin] = useState(5);
  const [paceSec, setPaceSec] = useState(30);

  // Segments du mode fractionné (HIIT) : chacun a son propre BPM cible et sa durée.
  const [segments, setSegments] = useState([{ id: 1, bpm: 120, durationValue: 15 }]);
  // Quelle portion a son panneau "genre spécifique" déplié (une seule à la
  // fois, replié par défaut pour ne pas surcharger l'étape 3 du wizard).
  // null = aucune.
  const [expandedSegmentGenreId, setExpandedSegmentGenreId] = useState(null);

  const availableGenres = isNaughtyMode ? NAUGHTY_GENRES : STANDARD_GENRES;
  const displaySubtitleGen = isNaughtyMode
    ? "Laisse l'algorithme composer la bande-son idéale pour cette soirée."
    : "Laisse l'algorithme générer la bande-son ultime pour pulvériser tes objectifs.";

  // Répartit 100% à parts égales entre les genres donnés (reste éventuel
  // affecté au dernier, pour que la somme tombe toujours pile sur 100 malgré
  // les arrondis — ex. 3 genres → 33/33/34, pas 33/33/33 qui ne totaliserait que 99).
  const equalSplitWeights = (genres) => {
    if (genres.length === 0) return {};
    const base = Math.floor(100 / genres.length);
    const result = {};
    genres.forEach(g => { result[g] = base; });
    result[genres[genres.length - 1]] += 100 - base * genres.length;
    return result;
  };

  /**
   * Modifie le % d'UN genre, verrouille sa valeur, et redistribue ce qu'il
   * reste à parts égales entre les genres PAS ENCORE verrouillés — jamais en
   * touchant aux genres déjà fixés manuellement avant. La valeur saisie est
   * plafonnée pour ne jamais dépasser ce qui reste disponible une fois les
   * autres genres déjà verrouillés retirés.
   */
  const setGenreWeight = (genre, rawValue) => {
    const otherLockedSum = [...lockedGenreWeights].filter(g => g !== genre).reduce((s, g) => s + (genreWeights[g] || 0), 0);
    const maxAllowed = Math.max(0, 100 - otherLockedSum);
    const value = Math.min(Math.max(0, parseInt(rawValue) || 0), maxAllowed);

    const newLocked = new Set(lockedGenreWeights);
    newLocked.add(genre);
    setLockedGenreWeights(newLocked);

    const unlockedGenres = selectedGenres.filter(g => !newLocked.has(g));
    const remainder = 100 - otherLockedSum - value;
    const newWeights = { ...genreWeights, [genre]: value };
    if (unlockedGenres.length > 0) {
      const base = Math.floor(remainder / unlockedGenres.length);
      unlockedGenres.forEach(g => { newWeights[g] = base; });
      newWeights[unlockedGenres[unlockedGenres.length - 1]] += remainder - base * unlockedGenres.length;
    }
    setGenreWeights(newWeights);
  };

  // Ajoute/retire un genre de la sélection, en empêchant de désélectionner le
  // dernier genre restant (il en faut toujours au moins un pour générer une
  // playlist). La répartition des % repart à zéro (équirépartition, tout
  // déverrouillé) dès que l'ENSEMBLE des genres change.
  const toggleGenre = (genre) => {
    let newGenres;
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length <= 1) return;
      newGenres = selectedGenres.filter(g => g !== genre);
    } else {
      newGenres = [...selectedGenres, genre];
    }
    setSelectedGenres(newGenres);
    setGenreWeights(equalSplitWeights(newGenres));
    setLockedGenreWeights(new Set());
  };

  // Ajoute/retire un genre du genre SPÉCIFIQUE d'une portion en mode
  // Fractionné (override qui prime sur le genre global de la séance). Un
  // segment sans selectedGenres (undefined) utilise le genre global ; dès
  // qu'on coche un genre ici, la portion bascule sur sa propre sélection
  // indépendante.
  const toggleSegmentGenre = (segmentId, genre) => {
    setSegments(segments.map(s => {
      if (s.id !== segmentId) return s;
      const current = s.selectedGenres || [];
      if (current.includes(genre)) {
        const updated = current.filter(g => g !== genre);
        // Liste vidée : on ne laisse jamais une portion sans AUCUN genre, on
        // repasse simplement en "pas d'override" (undefined = genre global).
        return { ...s, selectedGenres: updated.length > 0 ? updated : undefined };
      }
      return { ...s, selectedGenres: [...current, genre] };
    }));
  };

  // Retire l'override de genre d'une portion : elle revient au genre global
  // de la séance plutôt que de garder une sélection propre.
  const resetSegmentGenre = (segmentId) => {
    setSegments(segments.map(s => s.id === segmentId ? { ...s, selectedGenres: undefined } : s));
  };

  /**
   * Compare la répartition RÉELLEMENT obtenue (durée par genre dans la
   * playlist) à la répartition en % DEMANDÉE (config.genreWeights) —
   * approximatif par nature, donc on ne signale que les écarts vraiment
   * significatifs (≥ 15 points de %), pas la moindre fluctuation. Retourne la
   * liste des genres trop éloignés de leur cible, ou `null` si rien à
   * signaler (pas de poids configurés, ou tout est proche).
   */
  const checkGenreWeightDeviation = (tracks, weights) => {
    if (!weights || Object.keys(weights).length <= 1) return null;
    const totalDuration = tracks.reduce((s, t) => s + t.duration, 0);
    if (totalDuration === 0) return null;
    const actualByGenre = {};
    tracks.forEach(t => {
      const g = normalizeGenreForDisplay(t.genre);
      actualByGenre[g] = (actualByGenre[g] || 0) + t.duration;
    });
    const deviations = [];
    Object.entries(weights).forEach(([genre, targetPct]) => {
      if (!targetPct) return;
      const actualPct = Math.round(((actualByGenre[genre] || 0) / totalDuration) * 100);
      if (Math.abs(actualPct - targetPct) >= 15) {
        deviations.push(`${genre} : ${actualPct}% obtenu (visé ${targetPct}%)`);
      }
    });
    return deviations.length > 0 ? deviations : null;
  };

  return {
    wizardStep, setWizardStep,
    selectedGenres, setSelectedGenres,
    genreWeights, setGenreWeights,
    lockedGenreWeights, setLockedGenreWeights,
    showExtraGenres, setShowExtraGenres,
    bpmTolerance, setBpmTolerance,
    crossfade, setCrossfade,
    bpm, setBpm,
    isIntervalMode, setIsIntervalMode,
    allowLongTracks, setAllowLongTracks,
    targetMode, setTargetMode,
    hours, setHours,
    minutes, setMinutes,
    distanceVal, setDistanceVal,
    distanceUnit, setDistanceUnit,
    paceMin, setPaceMin,
    paceSec, setPaceSec,
    segments, setSegments,
    expandedSegmentGenreId, setExpandedSegmentGenreId,
    availableGenres, displaySubtitleGen,
    equalSplitWeights, setGenreWeight, toggleGenre,
    toggleSegmentGenre, resetSegmentGenre, checkGenreWeightDeviation,
  };
}
