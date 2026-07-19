import { useState, useEffect } from 'react';
import { STANDARD_GENRES, NAUGHTY_GENRES, normalizeGenreForDisplay, genreDisplayLabel } from '../musicCatalog';
import { buildCrescendoSegments, deduceCrescendoBpm } from '../musicEngine';

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
export function useGeneratorForm(isNaughtyMode, athleticProfile) {
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

  // `bpmToleranceTouched` : distingue "encore à sa valeur de départ" d'un
  // choix VOLONTAIRE de l'utilisateur, même si ce choix retombe justement sur
  // 14 (retour à la valeur de départ après l'avoir bougé compte comme un
  // choix délibéré) — nécessaire pour le seed automatique de `setStructureMode`
  // ci-dessous : sans ce flag, on ne pourrait distinguer "l'utilisateur n'a
  // jamais touché ce réglage" de "l'utilisateur a délibérément remis 14".
  const [bpmToleranceRaw, setBpmToleranceRaw] = useState(14);
  const [bpmToleranceTouched, setBpmToleranceTouched] = useState(false);
  const setBpmTolerance = (val) => { setBpmToleranceTouched(true); setBpmToleranceRaw(val); };
  const bpmTolerance = bpmToleranceRaw;
  const [crossfade, setCrossfade] = useState(2);
  const [bpm, setBpm] = useState(160);
  // `bpmTouchedManually` : ne se déclenche QUE via `setBpmManual` (le curseur
  // BPM lui-même, voir GeneratorView) — jamais via `setBpm` "brut", que
  // d'autres endroits appellent en PROGRAMMATIQUE (le BPM par défaut d'un
  // type d'activité choisi à l'étape 1, ou la remise à zéro du mode Intime,
  // voir App.jsx). Nécessaire pour distinguer "l'utilisateur a lui-même réglé
  // ce curseur" de "juste la valeur par défaut de l'activité qu'il a
  // choisie" — sans cette distinction, le pré-remplissage du Profil
  // Athlétique ci-dessous (setStructureMode) ne se déclencherait quasiment
  // jamais, puisque choisir une activité à l'étape 1 (obligatoire) appelle
  // déjà `setBpm` avec le défaut de cette activité.
  const [bpmTouchedManually, setBpmTouchedManually] = useState(false);
  const setBpmManual = (val) => { setBpmTouchedManually(true); setBpm(val); setBpmSourceIsProfile(false); };
  // Structure de l'effort — 3 modes (voir GeneratorView étape 2) :
  //   'constant'  : allure plate de bout en bout (comportement historique, BPM
  //                 unique + tolérance aléatoire, AUCUN changement ici).
  //   'crescendo' : 3 segments auto-générés (échauffement / cœur / retour au
  //                 calme, voir buildCrescendoSegments), recalculés à chaque
  //                 changement de BPM/durée/distance tant que ce mode est actif.
  //   'interval'  : Fractionné manuel historique (segments édités à la main
  //                 par l'utilisateur, étape 3 du wizard).
  // `isIntervalMode` reste dérivé ci-dessous : c'est le seul champ que
  // `createPlaylistData` (musicEngine.js) connaît côté moteur — 'crescendo' ET
  // 'interval' l'utilisent tous les deux (même mécanique de segments), seul
  // `isCrescendoMode` les distingue pour le nommage/l'affichage.
  const [structureMode, setStructureModeRaw] = useState('constant');
  const isIntervalMode = structureMode !== 'constant';
  const isCrescendoMode = structureMode === 'crescendo';


  // Répartition Crescendo réglable par l'utilisateur via le curseur double de
  // l'étape 3 (2 poignées : fin de l'échauffement / début du retour au
  // calme) — PAS un ratio fixe imposé par l'algorithme. Défauts 15/70/15 (le
  // "sweet spot" sportif standard) : un utilisateur pressé n'a rien à
  // toucher, l'expert peut affiner. `CRESCENDO_MIN_MAIN_PCT` garantit que le
  // cœur de séance ne peut jamais descendre sous 10% de la séance, quoi que
  // l'utilisateur fasse glisser les 2 poignées l'une vers l'autre — les deux
  // setters se contraignent mutuellement pour ça (voir GeneratorView pour les
  // bornes natives `min`/`max` des inputs range, qui empêchent déjà la
  // plupart des cas, ce clamp ici est le filet de sécurité final).
  const CRESCENDO_MIN_MAIN_PCT = 10;
  const [crescendoWarmupPct, setCrescendoWarmupPctRaw] = useState(15);
  const [crescendoCooldownPct, setCrescendoCooldownPctRaw] = useState(15);
  const setCrescendoWarmupPct = (val) => setCrescendoWarmupPctRaw(Math.max(0, Math.min(val, 100 - CRESCENDO_MIN_MAIN_PCT - crescendoCooldownPct)));
  const setCrescendoCooldownPct = (val) => setCrescendoCooldownPctRaw(Math.max(0, Math.min(val, 100 - CRESCENDO_MIN_MAIN_PCT - crescendoWarmupPct)));

  // BPM des phases Échauffement/Retour au calme — toujours réglables à la
  // main (retour direct : pas de bascule auto/manuel, uniquement du réglage
  // manuel). Pré-rempli avec des valeurs de départ sensées (voir
  // `deduceCrescendoBpm`, déduites du BPM cible) la toute première fois qu'on
  // passe en mode Crescendo, pour que l'utilisateur pressé n'ait pas à partir
  // de zéro — ensuite, ce sont purement ses réglages manuels qui comptent,
  // plus jamais recalculés automatiquement (voir `setStructureMode`
  // ci-dessous pour ce seed initial, et l'effet plus bas qui construit les
  // segments à partir de ces valeurs).
  const [crescendoWarmupBpm, setCrescendoWarmupBpmRaw] = useState(null);
  const [crescendoCooldownBpm, setCrescendoCooldownBpmRaw] = useState(null);

  // Le BPM affiché (cœur de séance + échauffement/retour au calme) vient-il
  // ACTUELLEMENT du Profil Athlétique de l'activité en cours, sans qu'aucun
  // des 3 curseurs concernés n'ait ensuite été retouché à la main ? Sert
  // uniquement à l'affichage (badge "calculé depuis ton profil" côté
  // GeneratorView) — jamais lu pour une décision de génération, purement
  // informatif. Repart à `false` dès qu'UN des 3 réglages est modifié
  // manuellement (voir setBpmManual/setCrescendoWarmupBpm/
  // setCrescendoCooldownBpm plus bas) : à partir de là, ce n'est plus "ce que
  // le profil propose" mais un choix de l'utilisateur, même partiel.
  const [bpmSourceIsProfile, setBpmSourceIsProfile] = useState(false);

  // `activityProfile` = le profil DÉJÀ RÉSOLU pour l'activité choisie à
  // l'étape 1 (voir `getProfileForWorkout`, useAthleticProfile.js), fourni
  // par l'appelant (GeneratorView) plutôt que recalculé ici : ce hook évite
  // délibérément de dépendre de `workoutType`/`customActivity` (voir la
  // docstring en haut de fichier, pour éviter une dépendance circulaire avec
  // useCustomActivity) — recevoir le résultat déjà calculé règle ça sans
  // franchir cette frontière.
  const setStructureMode = (mode, activityProfile = null) => {
    const isProfileConfigured = !!(activityProfile && activityProfile.isConfigured);

    // Retour direct : "pourquoi c'est utilisé en Crescendo et pas pour les
    // autres types de séances" — ce calcul du "cœur de séance" (Zone 3
    // Seuil/Tempo en priorité, Zone 2 Endurance à défaut) jouait jusqu'ici EN
    // DUR le même rôle uniquement pour le mode Crescendo, alors qu'il
    // correspond en réalité à EXACTEMENT la même valeur structurelle en
    // Allure Constante : l'unique curseur BPM de ce mode ("Rythme cible
    // global", même <input> que le "Rythme au pic" du Crescendo — voir
    // GeneratorView.jsx, le bloc `(!isIntervalMode || isCrescendoMode)`).
    // Sorti du bloc `if (mode === 'crescendo')` pour s'appliquer aux 2 modes
    // de la même façon — seuls le badge et le seed Échauffement/Retour au
    // calme restent spécifiques au Crescendo (lui seul a ces 2 curseurs).
    //
    // Fractionné (segments manuels) : volontairement LAISSÉ DE CÔTÉ pour
    // l'instant — contrairement à Crescendo/Constante, ses segments sont en
    // nombre libre et n'ont aucune convention "haut/bas" fixe (voir
    // `segments`, plus bas) : imposer un schéma zone-par-segment serait un
    // choix arbitraire, pas une évidence comme pour les 2 autres modes. `bpm`
    // est quand même pré-rempli ci-dessous (silencieusement, sans badge,
    // puisque ce curseur ne s'affiche pas en Fractionné) : ça sert au moins
    // de graine cohérente si l'utilisateur bascule ensuite vers Crescendo.
    const profileMainBpm = isProfileConfigured ? (activityProfile.zone3 || activityProfile.zone2) : null;
    if (profileMainBpm && !bpmTouchedManually) setBpm(profileMainBpm);

    if (mode === 'crescendo') {
      const bpmFloor = isNaughtyMode ? 40 : 80;
      const effectiveMainBpm = (profileMainBpm && !bpmTouchedManually) ? profileMainBpm : bpm;

      // Échauffement/Retour au calme : Zone 1 (Récupération) pour les deux,
      // comme demandé — sinon déduits du BPM cible comme avant
      // (`deduceCrescendoBpm`). Toujours via le seed "une seule fois, jamais
      // après" déjà en place (`prev === null ? seed : prev`) : un profil
      // configuré change seulement la valeur de DÉPART, jamais un réglage
      // déjà fait à la main sur ces 2 curseurs-là.
      const deduced = deduceCrescendoBpm(effectiveMainBpm, bpmFloor);
      const profileWarmupCooldownBpm = isProfileConfigured ? activityProfile.zone1 : null;
      const warmupSeed = profileWarmupCooldownBpm || deduced.warmupBpm;
      const cooldownSeed = profileWarmupCooldownBpm || deduced.cooldownBpm;
      setCrescendoWarmupBpmRaw(prev => prev === null ? warmupSeed : prev);
      setCrescendoCooldownBpmRaw(prev => prev === null ? cooldownSeed : prev);

      // Le badge "calculé depuis ton profil" (GeneratorView) ne doit
      // s'afficher QUE si les 3 valeurs qui seront AFFICHÉES à l'écran sont
      // VRAIMENT celles du profil — pas seulement "un profil existe quelque
      // part". Comparé aux valeurs EFFECTIVES finales plutôt qu'à un
      // historique "était-ce encore null avant" : ce 2e critère se serait
      // trompé en cas d'aller-retour Crescendo → Constante → Crescendo sans
      // rien retoucher (warmup/cooldown ne sont plus `null` dès le 2e
      // passage, alors que leur valeur reste pourtant bien celle du profil).
      const finalMainBpm = (profileMainBpm && !bpmTouchedManually) ? profileMainBpm : bpm;
      const finalWarmup = crescendoWarmupBpm === null ? warmupSeed : crescendoWarmupBpm;
      const finalCooldown = crescendoCooldownBpm === null ? cooldownSeed : crescendoCooldownBpm;
      const allThreeComeFromProfile = isProfileConfigured
        && finalMainBpm === profileMainBpm
        && finalWarmup === profileWarmupCooldownBpm
        && finalCooldown === profileWarmupCooldownBpm;
      setBpmSourceIsProfile(allThreeComeFromProfile);

      // RETOUR DIRECT ("mettre marge d'erreur à 5 pour être au plus proche du
      // mode Synchro du Profil Athlétique") — l'ancienne valeur fixe (7,
      // pensée pour l'espacement ÉNERGIE par défaut, ~15 BPM/palier en
      // course) ne pouvait pas refléter le mode Synchro (bien plus resserré :
      // 6 BPM/palier en course, 3 en vélo — voir SYNC_ZONE_SPACING_BY_ACTIVITY,
      // useAthleticProfile.js) ni même les autres activités en énergie (5
      // BPM/palier en vélo). Plutôt que deviner une 2e constante, calculée ici
      // depuis le VRAI écart entre le Cœur de séance et l'Échauffement/Retour
      // au calme qu'on vient de sceller juste au-dessus (`effectiveMainBpm`/
      // `warmupSeed`/`cooldownSeed`) — reflète automatiquement l'espacement
      // RÉELLEMENT actif (énergie ou sync, quelle que soit l'activité, profil
      // configuré ou non), sans dépendre d'un nouveau paramètre externe.
      // `Math.floor(écart / 2)` : la même logique qu'avant (éviter que les 2
      // zones de recherche ±tolérance se chevauchent), appliquée à l'écart
      // réel plutôt qu'à une estimation. Bornée à [3, 14] : 3 pour éviter une
      // recherche trop étroite sur les espacements les plus serrés (Synchro
      // vélo notamment), 14 pour ne jamais dépasser la marge par défaut du
      // mode Allure Constante (aucune raison d'être PLUS large qu'elle).
      const tightestGap = Math.min(Math.abs(effectiveMainBpm - warmupSeed), Math.abs(effectiveMainBpm - cooldownSeed));
      const dynamicTolerance = tightestGap > 0 ? Math.min(14, Math.max(3, Math.floor(tightestGap / 2))) : 7;
      if (!bpmToleranceTouched) setBpmToleranceRaw(dynamicTolerance);
    } else if (mode === 'constant') {
      // Même badge qu'en Crescendo, mais basé sur la SEULE valeur pertinente ici
      // (pas de triplet Échauffement/Cœur/Retour au calme — juste le rythme
      // cible global).
      const finalMainBpm = (profileMainBpm && !bpmTouchedManually) ? profileMainBpm : bpm;
      setBpmSourceIsProfile(!!(profileMainBpm && !bpmTouchedManually && finalMainBpm === profileMainBpm));
    } else {
      // Fractionné (Constante/Crescendo → Fractionné, ou 1er choix direct) :
      // invalide le badge — "cœur de séance = valeur du profil" n'a de sens
      // que dans les 2 modes gérés ci-dessus.
      setBpmSourceIsProfile(false);

      // Retour direct : motif par défaut explicite pour le Fractionné —
      // "1er segment = échauffement, 2e VMA, 3e EF, 4e VMA, 5e EF, puis
      // alternance VMA/EF à l'infini". Zone 1 = Échauffement/Récupération,
      // Zone 4 = Vitesse/VMA, Zone 2 = Endurance fondamentale (EF) — mêmes
      // libellés que ATHLETIC_ZONES (appConfig.js), pas une correspondance
      // inventée ici. `activityProfile` est TOUJOURS exploitable (profil réel
      // OU aperçu par défaut crédible, voir resolveEffectiveActivityProfile
      // dans GeneratorView.jsx) : ce motif a donc toujours des BPM sensés,
      // profil configuré ou non — cohérent avec le principe déjà appliqué à
      // l'Assistant Rapide/mode Expert de la page Profil Athlétique.
      //
      // Seedé UNE SEULE FOIS, seulement si les segments sont encore dans leur
      // tout premier état jamais personnalisé (même garde-fou que partout
      // ailleurs dans ce hook, ex. crescendoWarmupBpm) — un utilisateur qui a
      // déjà ajusté ses portions à la main, même en repassant par Constante
      // ou Crescendo entre-temps, ne se les voit jamais réécrasées.
      const isPristineSegments = segments.length === 1 && segments[0].id === 1 && segments[0].bpm === 120 && segments[0].durationValue === 15;
      if (isPristineSegments && activityProfile) {
        const warmupBpm = activityProfile.zone1 || 120;
        const vmaBpm = activityProfile.zone4 || 160;
        const efBpm = activityProfile.zone2 || 130;
        const isDistance = targetMode === 'distance';
        setSegments([
          { id: Date.now(), bpm: warmupBpm, durationValue: isDistance ? 1 : 8 },
          { id: Date.now() + 1, bpm: vmaBpm, durationValue: isDistance ? 0.4 : 1 },
          { id: Date.now() + 2, bpm: efBpm, durationValue: isDistance ? 0.6 : 2 },
          { id: Date.now() + 3, bpm: vmaBpm, durationValue: isDistance ? 0.4 : 1 },
          { id: Date.now() + 4, bpm: efBpm, durationValue: isDistance ? 0.6 : 2 },
        ]);
      }
    }
    setStructureModeRaw(mode);
  };
  // L'échauffement ne doit jamais dépasser le BPM cible (le curseur de
  // l'étape 3 le borne déjà côté UI), et le retour au calme ne doit jamais
  // dépasser l'échauffement — sinon la "forme" crescendo n'a plus de sens.
  // Si l'échauffement redescend sous la valeur actuelle du retour au calme,
  // ce dernier suit plutôt que de rester bloqué au-dessus de son propre
  // curseur (dont le `max` dépend justement de crescendoWarmupBpm).
  const setCrescendoWarmupBpm = (val) => {
    setCrescendoWarmupBpmRaw(val);
    setCrescendoCooldownBpmRaw(prev => (prev !== null && prev > val ? val : prev));
    setBpmSourceIsProfile(false);
  };
  const setCrescendoCooldownBpm = (val) => { setCrescendoCooldownBpmRaw(val); setBpmSourceIsProfile(false); };

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

  // Tant que le mode Crescendo est actif, les 3 segments (échauffement / cœur
  // de séance / retour au calme) sont recalculés automatiquement à chaque
  // changement de BPM cible, de durée/distance ou d'allure — c'est ce qui
  // rend l'étape 3 "magique" pour ce mode (rien à éditer à la main). Dès
  // qu'on quitte le mode Crescendo (vers Fractionné ou Allure Constante),
  // cet effet s'arrête et les segments restent tels quels — en repassant en
  // Fractionné manuel, ça donne d'ailleurs un point de départ tout prêt à
  // ajuster plutôt qu'un segment vide.
  useEffect(() => {
    if (structureMode !== 'crescendo') return;
    const bpmFloor = isNaughtyMode ? 40 : 80;
    setSegments(buildCrescendoSegments(
      targetMode, bpm, hours, minutes, distanceVal, paceMin, paceSec, bpmFloor,
      crescendoWarmupPct, crescendoCooldownPct,
      crescendoWarmupBpm, crescendoCooldownBpm,
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureMode, targetMode, bpm, hours, minutes, distanceVal, paceMin, paceSec, isNaughtyMode, crescendoWarmupPct, crescendoCooldownPct, crescendoWarmupBpm, crescendoCooldownBpm]);

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

  // Ajoute/retire un genre de la sélection. Contrairement à avant, on autorise
  // maintenant de tout désélectionner : aucun genre coché = recherche élargie
  // par BPM uniquement, sans restriction de style (voir isDirectGenreMatch
  // dans musicCatalog.js, qui traite un tableau de genres vide comme "aucune
  // restriction" plutôt que d'imposer un genre par défaut).
  const toggleGenre = (genre) => {
    let newGenres;
    if (selectedGenres.includes(genre)) {
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
      const g = normalizeGenreForDisplay(t.genre, t.artist, t.title);
      actualByGenre[g] = (actualByGenre[g] || 0) + t.duration;
    });
    const deviations = [];
    Object.entries(weights).forEach(([genre, targetPct]) => {
      if (!targetPct) return;
      const actualPct = Math.round(((actualByGenre[genre] || 0) / totalDuration) * 100);
      if (Math.abs(actualPct - targetPct) >= 15) {
        deviations.push(`${genreDisplayLabel(genre)} : ${actualPct}% obtenu (visé ${targetPct}%)`);
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
    bpm, setBpm, setBpmManual,
    structureMode, setStructureMode, isIntervalMode, isCrescendoMode,
    crescendoWarmupPct, setCrescendoWarmupPct, crescendoCooldownPct, setCrescendoCooldownPct,
    CRESCENDO_MIN_MAIN_PCT,
    crescendoWarmupBpm, setCrescendoWarmupBpm, crescendoCooldownBpm, setCrescendoCooldownBpm,
    bpmSourceIsProfile,
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
