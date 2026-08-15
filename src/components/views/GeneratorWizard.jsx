import { useEffect, useRef, useState } from 'react';
import {
  Activity, Heart, Clock, Footprints, ListPlus, MapPin, SlidersHorizontal, Music, Trash2, Plus,
  Target, Loader2, Zap, BookmarkPlus, Info, ChevronLeft, ChevronRight, ChevronDown, Flame,
  TrendingUp, Gauge,
} from 'lucide-react';
import { STANDARD_GENRES, EXTRA_GENRES, getGenreLocalDepthWarning, genreDisplayLabel, GENRE_SEARCH_DEPTH_HINT } from '../../musicCatalog';
import { formatDuration } from '../../utils/format';
import { syncClampedInput } from '../../utils/numberInput';
import { isTargetValueValid, isSegmentValid, areSegmentsValid, snapSegmentBpmOnBlur, snapSegmentDurationOnBlur } from '../../utils/targetValidation';
import DualRangeSlider from '../shared/DualRangeSlider';
import TargetModeInputs from './TargetModeInputs';
import {
  WORKOUT_TYPES, NAUGHTY_WORKOUT_ORDER, NAUGHTY_WORKOUT_ICONS, NAUGHTY_WORKOUT_LABELS,
  WORKOUT_DEFAULT_BPM, WORKOUT_DEFAULT_TARGET, ATHLETIC_ZONES, getZoneForValue,
} from '../../appConfig';
import { useGeneratorContext } from '../../contexts/GeneratorContext';
import { useAthleticContext } from '../../contexts/AthleticContext';
import { useCustomActivityContext } from '../../contexts/CustomActivityContext';
import { useModalContext } from '../../contexts/ModalContext';
import { INLINE_NAV_LINK_CLASS } from '../../layout/inlineLinkLayout';

/**
 * GeneratorWizard — le wizard de génération en 4 étapes ("Sculpte ta
 * séance"), seul contenu de GeneratorView.jsx (Profil Athlétique a
 * déménagé vers SettingsView.jsx, 28/07 — voir docstring de GeneratorView.jsx).
 *
 * Extrait de GeneratorView.jsx (25/07, chantier "séparer le générateur en 2
 * composants" — voir AthleticProfilePanel.jsx pour le raisonnement complet
 * et les chiffres qui ont motivé ce découpage). Ce fichier concentre tout ce
 * qui était spécifique au wizard dans l'ancien GeneratorView.jsx (~840
 * lignes de JSX + la logique Crescendo/sélecteur rapide de zone/indicateur
 * de scroll qui n'appartenait qu'à lui) — rien de partagé avec
 * AthleticProfilePanel.jsx au-delà de quelques champs génériques de
 * useAthleticContext() (`athleticProfile`, `buildDefaultPreviewProfile` —
 * DEPUIS LE 08/08, auparavant `useGeneratorContext()`, voir sa docstring
 * pour le raisonnement complet du découpage), chacun lu ICI via son propre
 * appel au Contexte. (`setShowAthleticProfile`
 * retiré de cette liste le 29/07 — dead reference depuis le refactor
 * "Réglages à onglets" du 28/07, voir plus bas dans ce fichier pour le
 * détail du nettoyage.)
 *
 * Props reçues de GeneratorView.jsx : tout ce qui vient d'App.jsx et n'est
 * PAS dans GeneratorContext (recherche/génération/theme) — identique à ce
 * que GeneratorView.jsx recevait avant l'extraction pour cette partie
 * précise (`showToast` n'en fait PAS partie : uniquement utilisé côté
 * Profil Athlétique, vérifié par grep avant de couper).
 */
export default function GeneratorWizard({
  theme,
  setCurrentPlaylist, setIsBpmSearchMode, setSearchQuery, setWorldSearchResults,
  setResultsContextLabel, setNoUsableResultsHint, searchTracksByBpm,
  executeGeneration, isGenerating,
  toggleNaughtyMode, changeView,
}) {
  const { openModal } = useModalContext();
  const {
    wizardStep, setWizardStep,
    workoutType, setWorkoutType,
    setBpm, setBpmManual, setTargetMode, setDistanceVal, setDistanceUnit, setHours, setMinutes,
    targetMode, isIntervalMode, isCrescendoMode, structureMode, setStructureMode,
    crescendoWarmupPct, setCrescendoWarmupPct, crescendoCooldownPct, setCrescendoCooldownPct, CRESCENDO_MIN_MAIN_PCT,
    crescendoWarmupBpm, setCrescendoWarmupBpm, crescendoCooldownBpm, setCrescendoCooldownBpm,
    bpmSourceIsProfile,
    hours, minutes, distanceVal, distanceUnit, paceMin, setPaceMin, paceSec, setPaceSec,
    bpm,
    segments, setSegments, expandedSegmentGenreId, setExpandedSegmentGenreId,
    resetSegmentGenre, toggleSegmentGenre, showExtraGenres, setShowExtraGenres,
    availableGenres, selectedGenres, toggleGenre,
    genreWeights, setGenreWeights, setGenreWeight, equalSplitWeights, setLockedGenreWeights,
    bpmTolerance, setBpmTolerance, crossfade, setCrossfade, allowLongTracks, setAllowLongTracks,
    getActiveWorkoutName,
  } = useGeneratorContext();
  const { isNaughtyMode, athleticProfile, getProfileForWorkout, buildDefaultPreviewProfile } = useAthleticContext();
  // `customActivity`/`handleOpenCustomActivityModal` (08/08, 2e passe) —
  // viennent maintenant de `useCustomActivityContext()`, plus de
  // `useGeneratorContext()` (voir la docstring de CustomActivityContext.jsx).
  const { customActivity, handleOpenCustomActivityModal } = useCustomActivityContext();
  const {
    cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass,
    borderAccentClass, bgMainApp, inputBg, inputBorder,
  } = theme;

  // `configuredProfilesCount` (comptait les profils Constante/Crescendo/
  // Fractionné déjà configurés) retiré (Refactor UX "Option A", 29/07) :
  // son seul usage était de conditionner l'affichage de l'ancienne bannière
  // "Configure ton Profil Athlétique" (retirée juste au-dessus) — devenu
  // dead code une fois la bannière supprimée, retiré plutôt que laissé
  // traîner sans consommateur.

  // Plancher BPM pour l'échauffement/retour au calme du mode Crescendo —
  // mêmes bornes que le curseur BPM principal de l'étape 3 (40 en mode
  // Intime, 80 en mode standard), pour ne jamais proposer une valeur
  // absurdement basse même en ajustement manuel.
  const crescendoBpmFloor = isNaughtyMode ? 40 : 80;

  // "Règle d'or" ergonomie (retour direct : une couleur = une zone
  // d'intensité, partout dans l'app) : le visuel Crescendo (courbe
  // Échauffement/Cœur/Retour au calme) colore chaque segment selon la ZONE
  // RÉELLE de son BPM (via getZoneForValue, appConfig.js) plutôt que 3
  // couleurs fixes par RÔLE (bleu/rouge/vert) sans lien avec l'intensité
  // réelle. Repli sur les anciennes couleurs par rôle si aucun profil n'est
  // configuré pour cette activité — `getZoneForValue` renvoie alors `null`,
  // jamais une couleur inventée.
  const crescendoAccentFallback = isNaughtyMode ? '#f43f5e' : '#ef4444'; // rose-500/red-500 (bgAccentClass)
  const crescendoWarmupZone = getZoneForValue(crescendoWarmupBpm, workoutType, getProfileForWorkout, customActivity);
  const crescendoCoreZone = getZoneForValue(bpm, workoutType, getProfileForWorkout, customActivity);
  const crescendoCooldownZone = getZoneForValue(crescendoCooldownBpm, workoutType, getProfileForWorkout, customActivity);
  const crescendoWarmupColor = crescendoWarmupZone?.color || '#0ea5e9'; // sky-500 (repli)
  const crescendoCoreColor = crescendoCoreZone?.color || crescendoAccentFallback;
  const crescendoCooldownColor = crescendoCooldownZone?.color || '#10b981'; // emerald-500 (repli)

  // --- Profil Athlétique appliqué au wizard (Constante / Crescendo / Fractionné) ---
  //
  // Résout le profil de l'activité choisie à l'étape 1, TOUJOURS avec des
  // valeurs de zones exploitables — un vrai profil configuré si l'utilisateur
  // en a un, sinon le même "aperçu par défaut crédible" que sur la page
  // Profil Athlétique elle-même (voir buildDefaultPreviewProfile,
  // useAthleticProfile.js — retour direct plus haut dans la conversation :
  // "il devrait toujours y avoir un nombre par défaut... des valeurs
  // crédibles par discipline"). `isConfigured` reste fidèle à la RÉALITÉ
  // (`false` pour l'aperçu par défaut) : sert de garde-fou pour tout ce qui
  // ne doit s'activer qu'avec un VRAI profil (badge "Profil Athlétique",
  // sélecteur rapide de zones ci-dessous) sans jamais affecter les BPM
  // eux-mêmes, qui restent crédibles dans les 2 cas.
  const resolveEffectiveActivityProfile = () => {
    const real = getProfileForWorkout(workoutType, customActivity);
    if (real.isConfigured) return real;
    return buildDefaultPreviewProfile(workoutType === 'Autre' ? (customActivity || '__custom__') : workoutType, real.cadenceIntent || 'energy');
  };

  // Sélecteur rapide de zone (retour direct : "je devrais pouvoir sélectionner
  // un de mes 4 zones pour savoir en un instant ce qui correspond à quoi,
  // plutôt que de devoir me souvenir de mes BPM") — SEULEMENT si un VRAI
  // profil existe pour cette activité (`isConfigured`), pas avec le simple
  // aperçu par défaut : choisir explicitement "une de mes zones" n'a de sens
  // que si les zones sont vraiment calibrées pour cette personne, pas des
  // valeurs génériques. Réutilisé aux 5 endroits où un curseur BPM peut se
  // relier à une zone (voir plus bas) — cohérence globale plutôt qu'un
  // sélecteur réinventé à chaque fois : mêmes couleurs/libellés courts que la
  // page Profil Athlétique elle-même (ATHLETIC_ZONES, appConfig.js).
  const renderZoneQuickPicks = (currentBpm, onSelectZone) => {
    const effectiveProfile = resolveEffectiveActivityProfile();
    if (!effectiveProfile.isConfigured) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {ATHLETIC_ZONES.map(z => {
          const zoneBpm = effectiveProfile[z.key];
          const isActive = currentBpm === zoneBpm;
          return (
            <button
              key={z.key}
              onClick={() => onSelectZone(zoneBpm)}
              title={`${z.label} — ${zoneBpm} BPM`}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${isActive ? 'text-white' : `${inputBg} ${inputBorder} ${textMuted} hover:text-main`}`}
              style={isActive ? { backgroundColor: z.color, borderColor: z.color } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
              {z.shortLabel} · {zoneBpm}
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * Bloc "Rythme cible global" (Constant) / "Rythme au pic" (Crescendo) —
   * slider BPM + badge "Calculé depuis ton Profil" + raccourcis de zone.
   * Extrait ici (10/08, 2e passe du chantier "redondance étape 2/étape 3",
   * retour direct : "dans la logique de l'allure constante exclusivement je
   * verrais bien la partie BPM dans l'étape 4") — même raisonnement que
   * `renderZoneQuickPicks` juste au-dessus : PARTAGÉ par 2 emplacements
   * maintenant, donc factorisé plutôt que copié-collé (éviter de
   * réintroduire, sur CE bloc, la même redondance qu'on vient de corriger
   * sur `<TargetModeInputs>` juste avant).
   * - Crescendo : rendu à l'étape 3, EXACTEMENT comme avant cette
   *   extraction (emplacement inchangé, contenu inchangé).
   * - Allure Constante : rendu à l'étape 4 maintenant, PLUS à l'étape 3 —
   *   ce mode ne visite plus jamais l'étape 3 du tout (voir
   *   goToNextWizardStep/goToPreviousWizardStepFromStep4 plus bas, qui la
   *   sautent explicitement). L'étape 3, elle, reste un `wizardStep === 3`
   *   ordinaire dans le code — simplement jamais atteint par la navigation
   *   pour ce mode précis, pas besoin de condition supplémentaire dedans.
   */
  const renderTargetBpmBlock = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
          <Activity className={textColorClass} size={24} /> <span>{isCrescendoMode ? 'Rythme au pic (cœur de séance)' : 'Rythme cible global'}</span>
        </label>
        <span className={`text-4xl font-black ${textColorClass}`}>{bpm} <span className={`text-sm font-bold ${textMuted}`}>BPM</span></span>
      </div>
      <input type="range" min={isNaughtyMode ? "40" : "80"} max={isNaughtyMode ? "180" : "220"} value={bpm} onChange={(e) => setBpmManual(parseInt(e.target.value))} className={`w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ?
        'accent-rose-500' : 'accent-red-500'}`} />
      {/* Badge "calculé depuis ton profil" (retour direct : "il faudrait
          ajouter une petite indication visuelle... pour bien faire
          comprendre à l'utilisateur que l'appli a intelligemment
          calculé ces BPM pour lui"). Affiché en Crescendo ET en
          Allure Constante (retour direct : "pourquoi c'est utilisé en
          Crescendo et pas pour les autres types de séances" — les 2
          modes partagent maintenant EXACTEMENT le même mécanisme, voir
          setStructureMode dans useGeneratorForm.js) — `bpmSourceIsProfile`
          encode déjà "est-ce pertinent dans le mode actuel", pas la peine
          de reproduire une condition de mode ici. N'apparaît QUE si la/les
          valeur(s) affichée(s) sont VRAIMENT celles du profil de
          l'activité en cours, pas dès qu'un profil existe quelque part
          (voir bpmSourceIsProfile, useGeneratorForm.js) — disparaît dès
          qu'un réglage est retouché à la main. Animation d'entrée
          ponctuelle (pas un pulse en boucle) : un "aha" au moment où ça
          apparaît, pas une sollicitation permanente. */}
      {bpmSourceIsProfile && (
        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${bgAccentClass} text-white`}>
          <Gauge size={12}/> Calculé depuis ton Profil Athlétique
        </div>
      )}
      {renderZoneQuickPicks(bpm, (zoneBpm) => setBpmManual(zoneBpm))}
    </div>
  );
  const step3ScrollRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  useEffect(() => {
    const el = step3ScrollRef.current;
    if (!el) { setShowScrollHint(false); return; }
    const checkOverflow = () => {
      // Ne (re)montre le pill que si on est encore tout en haut — un
      // changement de contenu (ex. ouverture du panneau BPM) ne doit pas le
      // faire réapparaître si l'utilisateur avait déjà scrollé.
      if (el.scrollTop <= 2) setShowScrollHint(el.scrollHeight > el.clientHeight + 2);
    };
    const handleScroll = () => {
      if (el.scrollTop > 2) setShowScrollHint(false);
    };
    checkOverflow();
    el.addEventListener('scroll', handleScroll);
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [wizardStep, structureMode, targetMode]);

  // ⚠️ NOUVEAU (04/08, retour direct — capture d'écran EditRoutineModal.jsx :
  // "je ne trouve pas ça normal de pouvoir générer une routine avec une
  // valeur de 0 km") : voir isTargetValueValid (targetValidation.js) pour le
  // constat complet — rien n'empêchait jusque-là de générer avec une cible
  // (distance OU durée) à 0.
  //
  // ⚠️ SIMPLIFIÉ (10/08, retour direct — "est-ce cohérent d'avoir la
  // prévision temps/km à la fois à l'étape 2 ET à l'étape 3 ? est-ce pas
  // redondant ?") : la cible n'était éditable qu'à l'étape 2 ET à l'étape 3
  // (Constant/Crescendo) jusqu'à ce jour — `<TargetModeInputs>` retiré de
  // l'étape 3 (voir plus bas, même raisonnement), donc `hours`/`minutes`/
  // `distanceVal` ne peuvent plus JAMAIS changer une fois l'étape 2
  // quittée : une valeur déjà validée avant de cliquer "Suivant" à l'étape 2
  // reste valide pour toute la suite du wizard, par construction — plus
  // besoin de revalider à l'étape 3. `step3ShowsTargetInputs` (l'ancienne
  // condition qui gatait cette 2e validation) est donc supprimée, elle
  // n'avait plus qu'un seul usage, devenu mort.
  const isTopLevelTargetInvalid =
    wizardStep === 2 && !isTargetValueValid({ targetMode, distanceVal, hours, minutes });
  // Mode Fractionné pur (`isIntervalMode && !isCrescendoMode`) : la cible
  // globale ne s'affiche jamais à l'étape 3 (segments à la place) — donc
  // c'est la validité des SEGMENTS eux-mêmes (`isSegmentValid`,
  // targetValidation.js) qui gouverne "Suivant" à cette étape précise, pas
  // isTargetValueValid.
  const isSegmentsStepInvalid =
    wizardStep === 3 && isIntervalMode && !isCrescendoMode &&
    !areSegmentsValid(segments, targetMode);
  const isNextDisabledByInvalidTarget = isTopLevelTargetInvalid || isSegmentsStepInvalid;

  // `goToNextWizardStep`/`goToPreviousWizardStepFromStep4` (10/08, 2e passe
  // du chantier "redondance étape 2/étape 3" — voir renderTargetBpmBlock
  // plus haut pour le contexte complet) : en Allure Constante, l'étape 3
  // (juste le slider BPM, seule chose que ce mode y affichait — aucun
  // segment/répartition, contrairement à Crescendo/Fractionné) n'a plus de
  // raison d'exister comme étape À PART ENTIÈRE une fois son slider déplacé
  // à l'étape 4 (fusionné avec la sélection de genre). `wizardStep` GARDE
  // ses valeurs numériques habituelles (1/2/3/4) — pas de renumérotation
  // interne, seulement une NAVIGATION qui saute la valeur 3 pour ce mode
  // précis : moins de surface de risque qu'une refonte du modèle d'état
  // lui-même (`wizardStep === 3` reste un test parfaitement valide partout
  // ailleurs dans ce fichier, simplement jamais atteint par ce mode). Seul
  // l'AFFICHAGE (barre de progression, libellé "Étape X / N" — voir plus
  // bas) traduit ce saut en un compte cohérent pour l'utilisateur (3 étapes
  // au total en Allure Constante, pas 4 avec un trou).
  const goToNextWizardStep = () => setWizardStep(wizardStep === 2 && structureMode === 'constant' ? 4 : wizardStep + 1);
  const goToPreviousWizardStepFromStep4 = () => setWizardStep(structureMode === 'constant' ? 2 : 3);

  // Nombre total d'étapes ET position AFFICHÉE dans ce total — distincts de
  // `wizardStep` lui-même (voir juste au-dessus) : en Allure Constante,
  // `wizardStep` vaut 4 sur le dernier écran, mais l'utilisateur ne doit
  // jamais voir "Étape 4 / 3" (incohérent) — seulement "Étape 3 / 3".
  const totalWizardSteps = structureMode === 'constant' ? 3 : 4;
  const displayWizardStep = (structureMode === 'constant' && wizardStep === 4) ? 3 : wizardStep;


  return (
        <>
          {/* Renvoi inverse, côté "Générer" (retour direct : "et inversement
              dans gestion faudrait un message renvoyant vers le fait de
              remplir le profil athlétique") — seulement si RIEN n'a jamais été
              configuré (voir configuredProfilesCount) : une fois au moins une
              activité configurée, plus la peine d'insister à chaque
              génération, le badge "calculé depuis ton profil" (étape 3) prend
              le relais.
              RETOUR DIRECT SUIVANT : "le profil athlétique ne s'applique plus
              uniquement au Crescendo" — ce texte listait "Crescendo et
              Allure Constante", devenu à son tour incomplet depuis que le
              Fractionné en bénéficie aussi (motif de segments par défaut basé
              sur le profil, voir setStructureMode dans useGeneratorForm.js).
              RETOUR DIRECT ENCORE SUIVANT : plutôt que de courir après une
              liste de modes vouée à se périmer à chaque nouvelle extension,
              reformulé en restant volontairement VAGUE ("des paramètres
              ajustés à ton profil") — reste vrai quel que soit le nombre de
              modes concernés à l'avenir, sans jamais promettre une
              équivalence exacte entre eux (le Fractionné n'a par exemple pas
              le même badge "calculé depuis ton profil" que Crescendo/
              Constante, faute d'une zone unique à mettre en avant sur des
              segments libres — rester vague évite justement d'avoir à
              détailler cette nuance ici).
              PIVOT DE MODÈLE (retour direct, cas concret : cœur à 170 bpm,
              pas à 160, musique voulue à 180) : "ajustés à ta cadence" ne
              disait plus la vérité — le profil ne stocke plus une cadence
              physique mais un BPM musical cible choisi par l'utilisateur,
              voir useAthleticProfile.js. Reformulé en "ajustés à ton profil",
              volontairement générique plutôt que de réintroduire un mot qui a
              déjà causé une confusion. */}
          {/* Bannière "Configure ton Profil Athlétique" (au-dessus de la
              carte) RETIRÉE (Refactor UI, 29/07, 3e itération sur cet
              emplacement — retour direct : "l'emplacement en bas à gauche
              de la carte était le bon, juste le style qui manquait de
              présence"). Redescendue dans le footer de la carte, restylée
              (badge icône + typo contrastée + lien rouge accentué) — voir
              plus bas, slot gauche du footer (`wizardStep === 1`), à côté
              du bouton "Suivant". Navigation et conditions d'affichage
              INCHANGÉES par rapport à la version bannière : toujours
              `changeView('settings')` (jamais l'ancien
              `setShowAthleticProfile`, une fonction retirée de
              GeneratorContext.jsx depuis le refactor "Réglages à onglets"
              du 28/07), toujours masqué en Mode Intime. */}

          {/* `pointer-events-none` + `opacity-60` pendant une génération : gèle
              TOUTE la carte du wizard (sliders, toggles, champs, boutons) d'un
              coup plutôt que d'ajouter `disabled` un par un sur chaque contrôle
              — un seul point de vérification, donc rien ne peut être oublié.
              Le bouton "Générer" restait déjà cliquable visuellement sans ça
              (juste `disabled` en HTML, pas toujours perceptible) ; ceci le
              rend aussi visuellement évident. Annulation possible via le
              bouton dans le bandeau "Génération en cours" (App.jsx), qui est
              EN DEHORS de cette carte donc jamais gelé par ce changement.
              `min-h-[450px]` RETIRÉ (03/08, retour direct, capture d'écran :
              "éviter de devoir scroll pour quelques pixels" sur l'étape 1)
              — cette hauteur minimale, PARTAGÉE par les 4 étapes du wizard
              (`flex flex-col` + pied de page en `mt-auto`, voir plus bas),
              poussait le bouton "Suivant"/"Précédent" tout en bas d'une
              carte de 450px MÊME quand le contenu réel de l'étape en
              occupait beaucoup moins — un vrai espace mort, pas juste
              quelques px de marge en trop. Plus flagrant sur l'étape 1
              (~60 lignes de JSX : un simple choix à 4 cartes) que sur
              l'étape 3 (~330 lignes : sélection de genres, BPM, structure,
              options avancées — dépasse déjà largement 450px de contenu
              naturel, donc ce retrait ne change RIEN visuellement pour
              elle). Choix délibéré, discuté avec l'utilisateur : plutôt
              que de garder cette hauteur partagée seulement réduite (ce
              qui aurait aidé l'étape 1 sans la résoudre complètement, tout
              en restant un pari sur la marge de l'étape 3 sans pouvoir le
              vérifier dans un vrai navigateur ici), chaque étape prend
              maintenant EXACTEMENT la hauteur de son propre contenu — le
              principe demandé ("pas plus grand pour éviter le scroll,
              mais pas plus petit non plus") s'applique alors identiquement
              aux 4 étapes, pas seulement à la première. Aucun élément de
              ce composant ne dépend en absolu de cette hauteur partagée
              (vérifié : les seuls `absolute` du fichier sont positionnés
              relativement à leur propre parent local — badge/toggle sur
              une carte d'activité, tooltip sur le bouton "Créer routine" —
              jamais par rapport à CETTE carte englobante).
              `p-5 md:p-6` (PAS `p-6 md:p-8`) — 03/08, 4e passe (retour
              direct : "je vois bien tout, mais je peux encore scroll, je
              veux retirer cette possibilité") — le plus gros levier resté
              intact jusqu'ici : ce padding s'applique en HAUT et en BAS de
              LA CARTE ENTIÈRE, contrairement aux espacements internes déjà
              réduits aux passes précédentes (barre de progression, étape 1,
              pied de page) — sur desktop (`md:`), le passage de 32px à
              24px de chaque côté retire à lui seul 16px de hauteur totale,
              plus que n'importe laquelle des réductions précédentes prise
              isolément. Toujours pas de `min-h`/hauteur fixe réintroduite
              (voir plus haut) — cette valeur est un simple padding, pas une
              contrainte de taille.
              ⚠️ TENTATIVE ABANDONNÉE (03/08, 5e passe) — une compensation
              `-mb-10` conditionnelle à `isGuestBarVisible` avait été
              essayée ici pour absorber le spacer de 40px que la barre
              "Mode invité" réserve (App.jsx) — RETIRÉE après retour direct,
              capture d'écran à l'appui : ça surcompensait (le cas invité
              n'avait en réalité aucune marge de manœuvre, contrairement à
              l'hypothèse de départ), rendant le bouton "Suivant" coupé ET
              plus du tout accessible au scroll — pire que le petit scroll
              d'origine que ça visait à supprimer. Pas de nouvelle tentative
              chiffrée sans navigateur réel pour mesurer la vraie marge
              disponible dans ce cas précis. */}
          <div className={`${cardBg} rounded-3xl p-5 md:p-6 border ${cardBorder} shadow-xl relative overflow-hidden flex flex-col ${isGenerating ? 'opacity-60 pointer-events-none select-none' : ''}`}>

            {/* Barre de progression du wizard (3 pastilles en Allure
                Constante, 4 sinon — voir totalWizardSteps/displayWizardStep
                plus haut). `mb-6` (PAS `mb-8`) — 03/08, voir la docstring de
                `<main>` (App.jsx) pour le raisonnement complet de ce
                chantier en 4 parties. */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex space-x-2">
                {Array.from({ length: totalWizardSteps }, (_, i) => i + 1).map(s => (
                  <div key={s} className={`h-2.5 w-8 sm:w-12 rounded-full transition-colors duration-300 ${displayWizardStep >= s ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}/>
                ))}
              </div>
              <span className={`text-sm font-bold uppercase tracking-wider ${textMuted}`}>Étape {displayWizardStep} / {totalWizardSteps}</span>
            </div>

            <div className="flex-1">

              {/* ETAPE 1 : L'ACTIVITE (choix du type d'entraînement + accès caché au mode Intime via l'icône flamme) */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  {/* `space-y-4` (PAS `space-y-6`) — 03/08, 2e passe (retour
                      direct : "tu y es presque") : après avoir épuisé les
                      marges génériques de la page au 1er passage (`<main>`,
                      en-tête, barre de progression, pied de page — voir
                      App.jsx/GeneratorView.jsx), les derniers px
                      raisonnables à gratter vivent DANS cette étape
                      elle-même. `p-6`→`p-5` et `mb-3`→`mb-2` sur chaque
                      carte d'activité juste plus bas, même raisonnement. */}
              <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                {isNaughtyMode ? <Heart className={textColorClass} size={24} /> : <Activity className={textColorClass} size={24} />}
                <span>{isNaughtyMode ? "De quoi as-tu envie aujourd'hui ?" : "Qu'est-ce qu'on fait aujourd'hui ?"}</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* `gap-3` (PAS `gap-4`) — 03/08, 3e passe (retour direct :
                    "il reste un chouïa"). Dernier levier sûr annoncé au
                    tour précédent — voir la docstring de `<main>` (App.jsx)
                    pour l'historique complet de ce chantier en plusieurs
                    petites passes. */}
                {(isNaughtyMode ? NAUGHTY_WORKOUT_ORDER.map(id => WORKOUT_TYPES.find(t => t.id === id)) : WORKOUT_TYPES).map(type => {
                  const Icon = isNaughtyMode ? NAUGHTY_WORKOUT_ICONS[type.id] : type.icon;
                  const isSelected = workoutType === type.id;
                  return (
                    <div key={type.id} className="relative group/btn">
                      <button
                        onClick={() => {
                          if(type.id === 'Autre') handleOpenCustomActivityModal();
                          else {
                            setWorkoutType(type.id);
                            const modeKey = isNaughtyMode ? 'naughty' : 'standard';
                            const defaultBpm = WORKOUT_DEFAULT_BPM[modeKey][type.id];
                            if (defaultBpm) setBpm(defaultBpm);
                            const defaultTarget = WORKOUT_DEFAULT_TARGET[modeKey][type.id];
                            if (defaultTarget) {
                              setTargetMode(defaultTarget.targetMode);
                              if (defaultTarget.targetMode === 'distance') {
                                setDistanceVal(defaultTarget.distanceVal);
                                setDistanceUnit(defaultTarget.distanceUnit);
                              } else {
                                setHours(defaultTarget.hours);
                                setMinutes(defaultTarget.minutes);
                              }
                            }
                            setTimeout(()=>setWizardStep(2), 200);
                          }
                        }}
                        className={`w-full flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 ${isSelected ? `${isNaughtyMode ?
                          'bg-rose-100 dark:bg-rose-900/20 border-rose-500 text-rose-500 dark:text-rose-400' : 'bg-red-50 dark:bg-red-600/10 border-red-500 text-red-600 dark:text-red-500'}` : `${bgMainApp} ${cardBorder} ${textMuted} hover:text-main hover:border-gray-300 dark:hover:border-gray-600`}`}
                      >
                        <Icon size={32} className="mb-2" />
                        <span className="font-bold text-center">
                          {type.id === 'Autre' && customActivity ? customActivity : (isNaughtyMode ? NAUGHTY_WORKOUT_LABELS[type.id] : type.id)}
                        </span>
                      </button>
                      {type.id === 'Autre' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleNaughtyMode(); }} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-rose-500 z-20 cursor-pointer">
                          <Flame size={16} className={isNaughtyMode ? "text-rose-500 fill-rose-500 animate-pulse" : ""} />
                        </button>
                      )}
                      {/* Repère "prendre du recul, voir où ce serait utile dans toute
                          l'app" (retour direct) : indique DÈS L'ÉTAPE 1 qu'un Profil
                          Athlétique existe pour cette activité, avant même d'arriver
                          au BPM qui en profitera réellement à l'étape 3 (voir le badge
                          "calculé depuis ton profil" plus loin) — évite que ce
                          pré-remplissage plus tard semble sorti de nulle part. */}
                      {!isNaughtyMode && athleticProfile?.activities?.[type.id]?.isConfigured && (
                        <span className={`absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${bgAccentClass} text-white`}>
                          <Gauge size={10}/> Profil configuré
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ETAPE 2 : OBJECTIF (temps vs distance, option HIIT) */}
          {wizardStep === 2 && (
            <div className="space-y-8">
              {/* Le choix Temps/Distance n'a pas de sens en mode Intime (le mode reste
                  forcé sur "temps", voir toggleNaughtyMode) NI pour la Musculation
                  (retour direct : "absurde d'avoir un bouton distance" — on ne
                  soulève pas des poids "sur 5 km") — ce sélecteur est masqué dans
                  les 2 cas, `targetMode` forcé sur 'time' pour Musculation via le
                  même effet que celui qui gère déjà le repli par défaut à l'étape 1
                  (voir plus haut, `setTargetMode(defaultTarget.targetMode)`). */}
              {!isNaughtyMode && workoutType !== 'Musculation' && (
                <>
                  <div className="space-y-4">
                    <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                      <MapPin className={textColorClass} size={24} /> <span>Sur quoi on se base ?</span>
                    </label>
                    <div className="flex bg-surface-hover rounded-2xl p-1.5">
                      <button onClick={() => setTargetMode('time')} className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl font-bold transition-all ${targetMode === 'time' ?
                        'bg-white dark:bg-gray-700 text-main shadow-xs' : textMuted}`}>
                        <Clock size={20} className="mb-1"/> Par Durée (Temps)
                      </button>
                      <button onClick={() => setTargetMode('distance')} className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl font-bold transition-all ${targetMode === 'distance' ?
                        'bg-white dark:bg-gray-700 text-main shadow-xs' : textMuted}`}>
                        <Footprints size={20} className="mb-1"/> Par Distance (Km/Mi)
                      </button>
                    </div>
                  </div>

                  {/* Extrait dans TargetModeInputs.jsx (03/08, check-up dette
                      technique) — était dupliqué mot pour mot ici ET à
                      l'étape 3 juste plus bas. Voir sa docstring pour le
                      raisonnement complet. */}
                  <TargetModeInputs
                    targetMode={targetMode} theme={theme}
                    distanceVal={distanceVal} setDistanceVal={setDistanceVal}
                    distanceUnit={distanceUnit} setDistanceUnit={setDistanceUnit}
                    paceMin={paceMin} setPaceMin={setPaceMin} paceSec={paceSec} setPaceSec={setPaceSec}
                    hours={hours} setHours={setHours} minutes={minutes} setMinutes={setMinutes}
                  />
                </>
              )}

              {/* Structure de l'effort. Mode Intime : conserve l'ancien toggle simple
                  (Constante / "Montée en Intensité" = Fractionné manuel relabellisé) —
                  comportement historique inchangé. Mode standard : sélecteur à 3
                  cartes, qui ajoute le mode "Crescendo" (échauffement → cœur de
                  séance → retour au calme, généré automatiquement à l'étape 3). */}
              {isNaughtyMode ? (
                <div className={`flex items-center justify-between p-5 ${inputBg} border-2 ${isIntervalMode ? borderAccentClass : inputBorder} rounded-2xl transition-colors cursor-pointer select-none`} onClick={() => setStructureMode(isIntervalMode ? 'constant' : 'interval')}>
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl ${isIntervalMode ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <ListPlus size={24} className={isIntervalMode ? 'text-white' : textMuted} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg ${textHighlight}`}>Montée en Intensité</h3>
                      <p className={`text-sm ${textMuted}`}>Enchaîner plusieurs phases, à des rythmes différents</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                    <input type="checkbox" className="sr-only peer" checked={isIntervalMode} readOnly />
                    <div className={`w-14 h-7 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all ${isIntervalMode ?
                      'peer-checked:bg-red-500 dark:peer-checked:bg-red-600' : ''}`}></div>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                    <SlidersHorizontal className={textColorClass} size={24} /> <span>Structure de l'effort</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* RETOUR DIRECT ("en Musculation, 'Allure Constante' et
                        'Distance' n'ont pas de sens — mais 'type d'effort'
                        oui") — les 3 mêmes MODES restent valables quelle que
                        soit l'activité (le moteur de génération ne connaît
                        que `constant`/`crescendo`/`interval`, voir
                        useGeneratorForm.js), seul le VOCABULAIRE change :
                        "Allure" (la vitesse à laquelle on court/pédale) et
                        "HIIT" (jargon cardio) ne veulent rien dire pour de la
                        musculation, où l'unité naturelle est la SÉRIE (temps
                        sous tension) et le REPOS entre séries — déjà
                        exactement ce que "Fractionné" modélise techniquement
                        (des segments à BPM différents), juste mal nommé pour
                        ce contexte. "Crescendo" reste inchangé : monter en
                        intensité puis redescendre en fin de séance (échauffement
                        → série principale → retour au calme) est un concept
                        tout aussi valable en musculation qu'en course. */}
                    {(workoutType === 'Musculation' ? [
                      { mode: 'constant', icon: Gauge, title: 'Effort Constant', desc: 'Même intensité tout au long de la séance' },
                      { mode: 'crescendo', icon: TrendingUp, title: 'Crescendo', desc: 'Montée progressive, avec retour au calme' },
                      { mode: 'interval', icon: ListPlus, title: 'Par Blocs / Circuit', desc: 'Séries et repos personnalisés à la main' },
                    ] : [
                      { mode: 'constant', icon: Gauge, title: 'Allure Constante', desc: 'Un rythme stable de bout en bout' },
                      { mode: 'crescendo', icon: TrendingUp, title: 'Crescendo', desc: 'Montée progressive, avec retour au calme' },
                      { mode: 'interval', icon: ListPlus, title: 'Fractionné / HIIT', desc: 'Intervalles personnalisés à la main' },
                    ]).map(({ mode, icon: Icon, title, desc }) => {
                      const isSelected = structureMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setStructureMode(mode, resolveEffectiveActivityProfile())}
                          className={`flex flex-col items-start text-left p-4 rounded-2xl border-2 transition-all duration-200 ${isSelected ? `${borderAccentClass} ${bgMainApp}` : `${inputBorder} ${inputBg} hover:border-gray-300 dark:hover:border-gray-600`}`}
                        >
                          <div className={`p-2 rounded-xl mb-2 ${isSelected ? bgAccentClass : 'bg-gray-200 dark:bg-gray-700'}`}>
                            <Icon size={20} className={isSelected ? 'text-white' : textMuted} />
                          </div>
                          <span className={`font-bold ${textHighlight}`}>{title}</span>
                          <span className={`text-xs mt-0.5 ${textMuted}`}>{desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPE 3 : REGLAGES DU RYTHME (BPM simple/distance/temps, ou découpage HIIT) */}
          {wizardStep === 3 && (
            <div
              ref={step3ScrollRef}
              className={`space-y-8 no-scrollbar pb-10 ${
                (isCrescendoMode || isIntervalMode) ? 'h-[300px] overflow-y-auto' : ''
              }`}
            >
              {/* ⚠️ Hauteur `h-[300px]` désormais CONDITIONNELLE (04/08, retour
                  direct : "quelques pixels de scroll résiduel à l'étape 3,
                  gagnables en vue connectée") — jusque-là fixe et identique
                  pour les 3 sous-modes, alors que leur contenu diffère
                  radicalement : Crescendo (double slider + liste de segments)
                  et Fractionné (liste de segments AJOUTÉS À LA MAIN par
                  l'utilisateur, donc potentiellement longue et non bornée)
                  ont réellement besoin d'une zone scrollable dédiée — mais
                  Effort Constant (slider BPM + durée, contenu court et FIXE,
                  jamais de liste) héritait quand même de cette même réserve
                  de 300px, en pure perte. Résultat concret : en Constant,
                  cette boîte pouvait dépasser légèrement le contenu réel
                  qu'elle affichait, ce qui pouvait suffire à faire déborder
                  la page entière de quelques px sur un viewport serré (le
                  cas montré en capture). Constant garde `pb-10` mais perd
                  `h-[300px]`/`overflow-y-auto` : son contenu suit sa hauteur
                  naturelle dans le flux de `<main>`, sans zone de scroll
                  interne dédiée — cohérent avec le fait que ce contenu ne
                  varie jamais en longueur (pas de liste), pas besoin d'y
                  réserver une hauteur "au cas où". `showScrollHint`
                  (ci-dessus) continue de fonctionner sans changement : sans
                  overflow réel (`scrollHeight === clientHeight` en Constant),
                  il reste simplement à `false` — rien à garder en plus. */}

              {(!isIntervalMode || isCrescendoMode) ? (
                <>
                  {renderTargetBpmBlock()}

                  {/* ⚠️ RETIRÉ (10/08, retour direct — "est-ce cohérent d'avoir
                      la prévision temps/km à la fois à l'étape 2 ET à l'étape 3 ?
                      est-ce pas redondant ?") : `<TargetModeInputs>` (même
                      composant, mêmes champs, éditable identiquement aux 2
                      endroits — donc STRICTEMENT redondant, pas un raffinement)
                      vivait ici en plus de l'étape 2, où la cible (durée/distance)
                      se règle UNE SEULE fois désormais. Pour Crescendo (juste
                      en dessous) et Fractionné (branche `else`, plus bas), la
                      durée totale reste lisible indirectement via la durée
                      concrète de chaque segment/portion affichée — pas de trou
                      d'information.
                      ⚠️ Allure Constante NE PASSE PLUS PAR ICI DU TOUT (10/08,
                      2e passe, même chantier) — ce mode ne visite plus jamais
                      l'étape 3 (voir goToNextWizardStep/
                      goToPreviousWizardStepFromStep4 plus bas) : son slider BPM
                      (`renderTargetBpmBlock()`, même fonction que juste
                      au-dessus) vit maintenant à l'étape 4, fusionné avec la
                      sélection de genre — voir cette étape plus bas pour le
                      raisonnement complet. Cette branche `(!isIntervalMode ||
                      isCrescendoMode)` reste écrite telle quelle (pas
                      simplifiée en juste `isCrescendoMode`) : moins de risque
                      de régression sur une condition qui fonctionne déjà, même
                      si sa moitié `!isIntervalMode` ne peut plus se déclencher
                      concrètement ici. */}

                  {isCrescendoMode && (
                    <div className="space-y-6 mt-6">
                      <div className="space-y-3">
                        <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                          <TrendingUp className={textColorClass} size={24} /> <span>Répartition de l'effort</span>
                        </label>
                        <div className="flex justify-between text-xs font-bold">
                          <span style={{ color: crescendoWarmupColor }}>Échauffement {crescendoWarmupPct}%</span>
                          <span className={textColorClass}>Cœur {100 - crescendoWarmupPct - crescendoCooldownPct}%</span>
                          <span style={{ color: crescendoCooldownColor }}>Retour au calme {crescendoCooldownPct}%</span>
                        </div>
                        <DualRangeSlider
                          leftValue={crescendoWarmupPct} rightValue={crescendoCooldownPct} minMiddle={CRESCENDO_MIN_MAIN_PCT}
                          onChangeLeft={setCrescendoWarmupPct} onChangeRight={setCrescendoCooldownPct}
                          leftColor={crescendoWarmupColor} middleColor={crescendoCoreColor} rightColor={crescendoCooldownColor}
                          leftHandleBorderColor={crescendoWarmupColor} rightHandleBorderColor={crescendoCooldownColor}
                          leftAriaLabel="Part de l'échauffement" rightAriaLabel="Part du retour au calme"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs ${textMuted}`}>BPM personnalisé pour ces 2 phases :</p>
                          {bpmSourceIsProfile && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${bgAccentClass} text-white`}>
                              <Gauge size={10}/> Profil Athlétique
                            </span>
                          )}
                        </div>

                        <div className={`space-y-4 p-4 rounded-xl ${inputBg} border ${inputBorder}`}>
                            {/* Griser (pas juste laisser un BPM "actif" trompeur) quand la part
                                de cette phase est à 0% (curseur double poussé jusqu'au bout) :
                                buildCrescendoSegments (musicEngine.js) n'en fait de toute façon
                                plus un segment séparé dans ce cas — retour direct après confusion
                                sur ce point précis, un BPM affiché "normalement" à 0% laissait
                                penser qu'il comptait encore. */}
                            <div className={crescendoWarmupPct === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold" style={{ color: crescendoWarmupColor }}>BPM Échauffement{crescendoWarmupPct === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{crescendoWarmupBpm}</span>
                              </div>
                              <input
                                type="range" min={crescendoBpmFloor} max={bpm}
                                value={crescendoWarmupBpm ?? crescendoBpmFloor}
                                onChange={(e) => setCrescendoWarmupBpm(parseInt(e.target.value) || crescendoBpmFloor)}
                                disabled={crescendoWarmupPct === 0}
                                style={{ accentColor: crescendoWarmupColor }}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none disabled:cursor-not-allowed"
                              />
                              {renderZoneQuickPicks(crescendoWarmupBpm, setCrescendoWarmupBpm)}
                            </div>
                            <div className={crescendoCooldownPct === 0 ? 'opacity-40 grayscale pointer-events-none' : ''}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold" style={{ color: crescendoCooldownColor }}>BPM Retour au calme{crescendoCooldownPct === 0 && ' (0% — sans effet)'}</span>
                                <span className={`text-sm font-black ${textHighlight}`}>{crescendoCooldownBpm}</span>
                              </div>
                              <input
                                type="range" min={crescendoBpmFloor} max={crescendoWarmupBpm ?? bpm}
                                value={crescendoCooldownBpm ?? crescendoBpmFloor}
                                onChange={(e) => setCrescendoCooldownBpm(parseInt(e.target.value) || crescendoBpmFloor)}
                                disabled={crescendoCooldownPct === 0}
                                style={{ accentColor: crescendoCooldownColor }}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none disabled:cursor-not-allowed"
                              />
                              {renderZoneQuickPicks(crescendoCooldownBpm, setCrescendoCooldownBpm)}
                            </div>
                        </div>

                        <p className={`text-xs ${textMuted} pt-1`}>Traduit en direct pour ta séance :</p>
                        {segments.map((segment) => (
                          <div key={segment.id} className={`flex items-center gap-3 p-3 rounded-xl ${inputBg} border ${inputBorder}`}>
                            <div className={`p-1.5 rounded-lg ${bgAccentClass} text-white shrink-0`}>
                              <TrendingUp size={16} />
                            </div>
                            <div className="flex-1">
                              <div className={`font-bold text-sm ${textHighlight}`}>{segment._crescendoLabel || 'Portion'}</div>
                              <div className={`text-xs ${textMuted}`}>
                                {/* Retour direct : personne ne raisonne en minutes décimales
                                    ("14.4 min") — précis à la seconde (formatDuration, déjà
                                    utilisée ailleurs dans l'app pour ça), pas besoin d'aller
                                    plus loin. Ne s'applique qu'au mode Temps : en mode
                                    Distance, durationValue est un km/mi, où le décimal reste
                                    la norme (ex. "3.2 km"). */}
                                {targetMode === 'distance' ? `${segment.durationValue} ${distanceUnit}` : formatDuration(segment.durationValue * 60)} · {segment.bpm} BPM
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`space-y-4`}>
                  <div className="flex justify-between items-end mb-4">
                    <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                      <SlidersHorizontal className={textColorClass} size={24} /> <span>Découpage de l'effort</span>
                    </label>
                    {targetMode === 'distance' && (
                      <div className={`text-sm font-bold ${textMuted} flex items-center bg-surface-hover px-3 py-1.5 rounded-lg`}>
                        Allure moy:
                        <input type="number" value={paceMin} onChange={e=>setPaceMin(syncClampedInput(e, { min: 1, max: 15 }))} className={`w-8 bg-transparent ml-2 text-center outline-hidden ${textHighlight}`}/>:
                        <input type="number" value={paceSec} onChange={e=>setPaceSec(syncClampedInput(e, { min: 0, max: 59 }))} className={`w-8 bg-transparent text-center outline-hidden ${textHighlight}`}/>
                        <select value={distanceUnit} onChange={e=>setDistanceUnit(e.target.value)} className="bg-transparent outline-hidden ml-1 cursor-pointer">
                          <option value="km">/km</option><option value="mi">/mi</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {segments.map((segment, index) => {
                      const isGenreExpanded = expandedSegmentGenreId === segment.id;
                      const hasOverride = segment.selectedGenres && segment.selectedGenres.length > 0;
                      return (
                      <div key={segment.id} className={`${inputBg} rounded-xl border ${inputBorder} overflow-hidden`}>
                        <div className="flex items-center gap-4 p-4">
                          <div className={`w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-sm ${textHighlight}`}>{index + 1}</div>
                          <div className="flex-1 flex gap-3">
                            <div className="flex-1">
                              <div className={`flex items-center bg-surface rounded-lg px-3 py-2 shadow-xs`}>
                                {/* min=1 + onBlur — même principe que le champ distance
                                    (targetValidation.js, snapSegmentBpmOnBlur) : un BPM à 0
                                    n'a aucun sens pour la lecture d'un titre. Voir
                                    isSegmentValid/areSegmentsValid pour le blocage du
                                    bouton "Suivant" tant qu'un segment reste invalide. */}
                                <input
                                  type="number" min="1" value={segment.bpm}
                                  onChange={(e) => setSegments(segments.map(s => s.id === segment.id ? { ...s, bpm: parseInt(e.target.value) || 0 } : s))}
                                  onBlur={(e) => setSegments(prev => prev.map(s => s.id === segment.id ? { ...s, bpm: parseInt(snapSegmentBpmOnBlur(e.target.value), 10) } : s))}
                                  className={`w-full bg-transparent text-lg font-bold outline-hidden ${textHighlight}`}
                                />
                                <span className={`text-xs font-bold ${textMuted}`}>BPM</span>
                              </div>
                              {renderZoneQuickPicks(segment.bpm, (zoneBpm) => setSegments(segments.map(s => s.id === segment.id ? { ...s, bpm: zoneBpm } : s)))}
                            </div>
                            <div className={`flex-1 flex items-center bg-surface rounded-lg px-3 py-2 shadow-xs h-fit`}>
                              {/* min dynamique (0.1 en distance, 1 en temps) + onBlur — pendant
                                  de snapDistanceOnBlur pour ce champ par segment (voir
                                  snapSegmentDurationOnBlur, targetValidation.js). */}
                              <input
                                type="number" min={targetMode==='distance'?'0.1':'1'} step={targetMode==='distance'?'0.1':'1'} value={segment.durationValue}
                                onChange={(e) => setSegments(segments.map(s => s.id === segment.id ? { ...s, durationValue: parseFloat(e.target.value) || 0 } : s))}
                                onBlur={(e) => setSegments(prev => prev.map(s => s.id === segment.id ? { ...s, durationValue: parseFloat(snapSegmentDurationOnBlur(e.target.value, targetMode)) } : s))}
                                className={`w-full bg-transparent text-lg font-bold outline-hidden ${textHighlight}`}
                              />
                              <span className={`text-xs font-bold ${textMuted}`}>{targetMode === 'distance' ? distanceUnit : 'Min'}</span>
                            </div>
                          </div>
                          {/* Genre spécifique à CETTE portion : replié par défaut (icône
                              neutre), colorée dès qu'un override est défini pour cette
                              portion — sinon elle utilise le genre global de l'étape 4. */}
                          <button
                            onClick={() => setExpandedSegmentGenreId(isGenreExpanded ? null : segment.id)}
                            title={hasOverride ? `Genre spécifique : ${segment.selectedGenres.join(', ')}` : "Genre global de la séance (cliquer pour définir un genre spécifique à cette portion)"}
                            className={`p-2 rounded-lg transition-colors ${hasOverride ? `${bgAccentClass} text-white` : `${textMuted} hover:text-main hover:bg-gray-200 dark:hover:bg-gray-700`}`}
                          >
                            <Music size={18} />
                          </button>
                          <button onClick={() => segments.length > 1 && setSegments(segments.filter(s => s.id !== segment.id))} disabled={segments.length === 1} className={`p-2 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 ${textMuted}`}>
                            <Trash2 size={20} />
                          </button>
                        </div>
                        {/* Voir isSegmentValid (targetValidation.js) — même raisonnement
                            que l'indice sur le champ distance/durée global
                            (TargetModeInputs.jsx), transposé au niveau du segment. */}
                        {!isSegmentValid(segment, targetMode) && (
                          <p className="text-xs font-bold text-red-500 px-4 pb-3 -mt-2">Portion {index + 1} : BPM et {targetMode === 'distance' ? 'distance' : 'durée'} doivent être supérieurs à 0.</p>
                        )}
                        {isGenreExpanded && (
                          <div className={`px-4 pb-4 border-t ${inputBorder} pt-3`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-bold ${textMuted}`}>
                                {hasOverride ? "Style personnalisé pour cette portion" : "Suit le style musical de toute la séance"}
                              </span>
                              {hasOverride && (
                                <button onClick={() => resetSegmentGenre(segment.id)} className={`text-xs font-bold underline ${textMuted} hover:text-main`}>
                                  Revenir au genre global
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {STANDARD_GENRES.map(genre => {
                                const isSelected = (segment.selectedGenres || []).includes(genre);
                                const warning = getGenreLocalDepthWarning(genre);
                                return (
                                  <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                                    {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                                  </button>
                                );
                              })}
                              <button
                                onClick={() => setShowExtraGenres(!showExtraGenres)}
                                title="Certains genres ci-dessous : génération un peu plus longue."
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 border-dashed ${cardBorder} ${textMuted} hover:text-main`}
                              >
                                {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                              </button>
                            </div>
                            {showExtraGenres && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {EXTRA_GENRES.map(genre => {
                                  const isSelected = (segment.selectedGenres || []).includes(genre);
                                  const warning = getGenreLocalDepthWarning(genre);
                                  return (
                                    <button key={genre} onClick={() => toggleSegmentGenre(segment.id, genre)} title={warning || undefined} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${isSelected ? `${bgAccentClass} ${borderAccentClass} text-white` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                                      {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      // Retour direct : "alternance entre VMA et EF ad vitam
                      // eternam" — continue le motif au-delà des 5 segments
                      // par défaut (voir setStructureMode, useGeneratorForm.js)
                      // plutôt que de simplement dupliquer le BPM du dernier
                      // segment tel quel. Ne s'applique qu'à partir du 2e
                      // segment (le 1er reste l'échauffement, jamais concerné
                      // par l'alternance) et seulement si le dernier segment
                      // correspond bien à l'une des 2 valeurs de zone — sinon
                      // (BPM personnalisé, hors zones) le comportement
                      // d'origine (dupliquer) reste le plus sûr.
                      const last = segments[segments.length - 1];
                      const effectiveProfile = resolveEffectiveActivityProfile();
                      const vmaBpm = effectiveProfile.zone4;
                      const efBpm = effectiveProfile.zone2;
                      let nextBpm = last.bpm;
                      if (segments.length >= 2 && vmaBpm && efBpm) {
                        if (last.bpm === vmaBpm) nextBpm = efBpm;
                        else if (last.bpm === efBpm) nextBpm = vmaBpm;
                      }
                      setSegments([...segments, { id: Date.now(), bpm: nextBpm, durationValue: targetMode==='distance'?1:10 }]);
                    }}
                    className={`w-full py-4 mt-4 border-2 border-dashed ${inputBorder} rounded-xl flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:text-main hover:border-gray-400 bg-gray-50 dark:bg-gray-800/50`}
                  >
                    <Plus size={20} /><span>Ajouter une portion</span>
                  </button>
                </div>
              )}

              {showScrollHint && (
                <div className="sticky bottom-0 left-0 right-0 flex justify-center pt-2 pointer-events-none">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg animate-bounce ${bgAccentClass} text-white`}>
                    <ChevronDown size={12} /> <span>Fais défiler pour tout voir</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPE 4 : MUSIQUE & GENERATION (genres, tolérance BPM, crossfade, boutons finaux) */}
          {wizardStep === 4 && (
            <div className="space-y-8">
              {/* Slider BPM (10/08, 2e passe — voir la docstring de
                  renderTargetBpmBlock plus haut) : UNIQUEMENT en Allure
                  Constante, seul mode qui ne visite plus l'étape 3 (Crescendo/
                  Fractionné continuent de l'afficher là-bas, inchangé). Rendu
                  en premier, avant le choix du genre — dernier réglage
                  numérique avant la partie plus "exploratoire" de cette étape
                  (genres, options avancées), même ordre logique que
                  Crescendo/Fractionné (BPM d'abord, détails ensuite). */}
              {structureMode === 'constant' && renderTargetBpmBlock()}

              <div className="space-y-4">
                <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
                  <Music className={textColorClass} size={24} /> <span>Quelle vibe musicale ?</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {availableGenres.map(genre => {
                    const isSelected = selectedGenres.includes(genre);
                    const warning = getGenreLocalDepthWarning(genre);
                    return (
                      <button key={genre} onClick={() => toggleGenre(genre)} title={warning || undefined} className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 ${isSelected ?
                        `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                        {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                      </button>
                    )
                  })}
                  {/* Le mode Intime garde volontairement sa liste restreinte, pas d'extension ici */}
                  {!isNaughtyMode && (
                    <button
                      onClick={() => setShowExtraGenres(!showExtraGenres)}
                      title="Certains genres ci-dessous : génération un peu plus longue."
                      className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 border-dashed ${cardBorder} ${textMuted} hover:text-main`}
                    >
                      {showExtraGenres ? '− Moins de genres' : '+ Plus de genres'}
                    </button>
                  )}
                </div>
                {!isNaughtyMode && showExtraGenres && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {EXTRA_GENRES.map(genre => {
                      const isSelected = selectedGenres.includes(genre);
                      const warning = getGenreLocalDepthWarning(genre);
                      return (
                        <button key={genre} onClick={() => toggleGenre(genre)} title={warning || undefined} className={`px-5 py-3 rounded-full text-base font-bold transition-all duration-200 border-2 ${isSelected ?
                          `${bgAccentClass} ${borderAccentClass} text-white shadow-md scale-105` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}>
                          {genreDisplayLabel(genre)}{warning && <span className="ml-1">⚠️</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* Rappel une fois le panneau ouvert — retour direct : préférer une
                    infobulle sur "+ Plus de genres" AVANT le clic (title ci-dessus) plutôt
                    qu'un texte statique qui n'apparaissait qu'après ouverture ; ce
                    paragraphe reste comme rappel visuel une fois le panneau déjà ouvert,
                    mais un ton plus affirmé (couleur, poids) qu'un simple texte gris discret
                    pour qu'il ne se perde pas au milieu des pills de genre. Le message "au
                    moment de générer" est lui déplacé dans le bandeau "Génération en
                    cours" (App.jsx), plus pertinent au moment où le délai se produit
                    réellement qu'en avertissement statique avant de cliquer. */}
                {!isNaughtyMode && showExtraGenres && (
                  <p className={`text-sm flex items-start gap-1.5 font-semibold ${textColorClass}`}>
                    <Info size={16} className="shrink-0 mt-0.5" />
                    {/* Retour direct : "on n'a pas la liste exhaustive des genres pour
                        lesquels ça peut être long, autant rester vague" — ce texte
                        nommait explicitement WEAK_DEEZER_KEYWORD_GENRES, une liste
                        de convenance interne (genres dont le mot-clé Deezer est une
                        approximation en texte libre, voir musicCatalog.js), pas une
                        promesse de couverture exhaustive de "tout ce qui peut être
                        lent" — un genre absent de cette liste précise pourrait très
                        bien l'être aussi selon le catalogue Deezer du moment. Reformulé
                        pour ne plus rien nommer explicitement.
                        ⚠️ EXTRAIT dans GENRE_SEARCH_DEPTH_HINT (musicCatalog.js, 04/08)
                        — dupliqué mot pour mot dans FavoritesView.jsx, une correction
                        de formulation ici avait raté cette 2e copie. Voir sa docstring
                        pour l'historique complet. */}
                    <span>{GENRE_SEARCH_DEPTH_HINT}</span>
                  </p>
                )}

                {/* Répartition en % entre plusieurs genres sélectionnés ensemble — voir
                    setGenreWeight pour la logique de verrouillage. N'apparaît qu'à partir
                    de 2 genres. */}
                {selectedGenres.length > 1 && (
                  <div className={`flex flex-wrap items-center gap-3 pt-2 p-4 rounded-2xl ${inputBg} border ${inputBorder}`}>
                    <span className={`text-xs font-bold ${textMuted} w-full`}>Répartition entre les genres choisis :</span>
                    {selectedGenres.map(genre => (
                      <div key={genre} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${cardBg} border ${cardBorder}`}>
                        <span className={`text-sm font-bold ${textHighlight}`}>{genreDisplayLabel(genre)}</span>
                        <input
                          type="number" min="0" max="100"
                          value={genreWeights[genre] ?? 0}
                          onChange={(e) => setGenreWeight(genre, e.target.value)}
                          className={`w-12 bg-transparent text-right font-mono font-bold ${textColorClass} outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        />
                        <span className={`text-xs ${textMuted}`}>%</span>
                      </div>
                    ))}
                    <button onClick={() => { setGenreWeights(equalSplitWeights(selectedGenres)); setLockedGenreWeights(new Set()); }} className={`text-xs font-bold underline ${textMuted} hover:text-main`}>
                      Répartition égale
                    </button>
                    <p className={`text-xs w-full ${textMuted}`}>Répartition indicative : le moteur essaie de s'en rapprocher, mais un genre avec moins de titres disponibles peut finir légèrement sous-représenté (un avertissement s'affichera si l'écart est important).</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`space-y-4 p-5 rounded-2xl ${inputBg} border ${inputBorder}`}>
                  <div className="flex justify-between items-center">
                    <label className={`text-sm font-bold flex items-center space-x-2 ${textMuted}`}>
                      <SlidersHorizontal size={18} /><span>Marge d'erreur</span>
                    </label>
                    <span className={`text-sm font-black ${textColorClass}`}>± {bpmTolerance} BPM</span>
                  </div>
                  <input type="range" min="0" max="30" value={bpmTolerance} onChange={(e) => setBpmTolerance(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ?
                    'accent-rose-500' : 'accent-red-500'}`} />
                  <p className={`text-xs ${textMuted}`}>Faible = précision militaire. Élevée = plus de pépites !</p>
                </div>

                <div className={`space-y-4 p-5 rounded-2xl ${inputBg} border ${inputBorder}`}>
                  <div className="flex justify-between items-center">
                    <label className={`text-sm font-bold flex items-center space-x-2 ${textMuted}`}>
                      <Activity size={18} /><span>Fondu enchaîné</span>
                    </label>
                    <span className={`text-sm font-black ${textColorClass}`}>{crossfade} sec</span>
                  </div>
                  <input type="range" min="0" max="12" value={crossfade} onChange={(e) => setCrossfade(parseInt(e.target.value))} className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer select-none ${isNaughtyMode ?
                    'accent-rose-500' : 'accent-red-500'}`} />
                  <p className={`text-xs ${textMuted}`}>Élimine les blancs entre les morceaux pour une énergie constante.</p>
                </div>

                {/* Sans ce filtre, un titre atypiquement long pouvait monopoliser une
                    grosse partie d'une séance courte. Off par défaut. */}
                <div className={`flex items-center justify-between p-5 rounded-2xl ${inputBg} border ${inputBorder}`}>
                  <div>
                    <label className={`text-sm font-bold flex items-center space-x-2 ${textMuted}`}>
                      <Clock size={18} /><span>Titres de plus de 6 min</span>
                    </label>
                    <p className={`text-xs mt-1 ${textMuted}`}>Inclut les titres longs (épiques, prog...).</p>
                  </div>
                  <button
                    onClick={() => setAllowLongTracks(!allowLongTracks)}
                    className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ml-4 ${allowLongTracks ? (isNaughtyMode ? 'bg-rose-500' : 'bg-red-500') : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${allowLongTracks ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Exploration manuelle : voir les titres qui matchent pile ce BPM + ces genres,
                  avec extrait audio, plutôt que de laisser l'algorithme piocher au hasard. */}
              <button onClick={() => {
                setCurrentPlaylist(null);
                setIsBpmSearchMode(true);
                setSearchQuery('');
                setWorldSearchResults([]);
                setResultsContextLabel(null);
                setNoUsableResultsHint(false);
                openModal('SEARCH');
                searchTracksByBpm(bpm, bpmTolerance, selectedGenres);
              }} className={`w-full py-4 rounded-2xl border-2 border-dashed ${inputBorder} flex items-center justify-center gap-2 font-bold transition-colors ${textMuted} hover:text-main hover:border-gray-400 bg-gray-50 dark:bg-gray-800/50`}>
                <Target size={20} /><span>Explorer les titres à {bpm} BPM</span>
              </button>

              {/* Message "genre plus long à générer" retiré d'ici : déplacé dans le
                  bandeau "Génération en cours" (App.jsx), plus pertinent au moment où
                  le délai se produit réellement — voir isGeneratingSlowGenre. */}

              {/* Boutons finaux : génération immédiate, ou sauvegarde en routine réutilisable */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => executeGeneration({ isIntervalMode, isCrescendoMode, targetMode, distanceVal, distanceUnit, paceMin, paceSec, segments, bpm, hours, minutes, selectedGenres, bpmTolerance, crossfade, allowLongTracks, genreWeights, workoutName: getActiveWorkoutName() })} disabled={isGenerating} className={`flex-1 text-xl font-black py-5 rounded-2xl flex items-center justify-center space-x-3 transition-transform active:scale-95 shadow-xl ${isNaughtyMode ?
                  'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200'}`}>
                  {isGenerating ? <Loader2 size={28} className="animate-spin" /> : <><Zap size={28} /><span>Générer ma Playlist</span></>}
                </button>

                <div className="relative group/memorize sm:w-1/3">
                  <button onClick={() => openModal('SAVING_ROUTINE')} className={`w-full h-full text-base font-bold py-5 rounded-2xl border-2 flex flex-col items-center justify-center leading-tight transition-colors bg-white dark:bg-gray-800 ${cardBorder} ${textHighlight} hover:bg-gray-50 dark:hover:bg-gray-700 relative`}>
                    <BookmarkPlus size={20} className="mb-1 text-yellow-500" />
                    <span>Créer routine</span>
                    <div className="absolute top-3 right-3 text-gray-400 hover:text-blue-500 transition-colors">
                      <Info size={16} />
                    </div>
                  </button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-64 p-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium text-center rounded-xl shadow-2xl opacity-0 group-hover/memorize:opacity-100 transition-opacity pointer-events-none z-20">
                    {"Sauvegarde ces réglages pour relancer cette session en un claquement de doigts la prochaine fois."}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Navigation Précédent/Suivant du wizard (étapes 1 à 3). `pt-6`
            (PAS `pt-8`) — 03/08, voir la docstring de `<main>` (App.jsx)
            pour le raisonnement complet de ce chantier en 4 parties. */}
        {wizardStep < 4 && (
          <div className="mt-auto pt-6 flex justify-between items-center border-t border-gray-100 dark:border-gray-800">
            {wizardStep > 1 ? (
              <button onClick={() => setWizardStep(wizardStep - 1)} className={`px-6 py-3 rounded-xl font-bold flex items-center space-x-2 ${textMuted} hover:text-main bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}>
                <ChevronLeft size={20}/> <span>Précédent</span>
              </button>
            ) : !isNaughtyMode ? (
              // 4e itération sur cet emplacement (Refactor UI, 29/07, retour
              // direct : "le lien est un peu trop petit face au bouton
              // principal"). Le style "badge rouge + Configure →" de
              // l'itération précédente est retiré — retour à un style
              // SOBRE (gris par défaut, `textMuted`), mais agrandi par
              // rapport à la toute première version (`text-xs` → `text-sm`,
              // icône 14px → 16px, `gap-1.5` → `gap-2`) pour mieux tenir
              // face au bouton "Suivant" à côté. Libellé "Profil : Ajuster
              // mes zones BPM" (celui de la toute première version, pas
              // "Configure ton Profil Athlétique... Configure →" de
              // l'itération intermédiaire). `hover:text-main` plutôt que le
              // `hover:text-white` suggéré tel quel : un blanc en dur
              // serait invisible en thème clair, `textHighlight` (déjà
              // "text-main" dans ce projet, voir useTheme.js) est
              // l'équivalent adaptatif clair/sombre — même substitution que
              // sur les itérations précédentes. Navigation/conditions
              // d'affichage inchangées (`changeView('settings')`, masqué
              // en Mode Intime).
              // ⚠️ PIÈGE ÉVITÉ (même famille que celui documenté dans
              // Sidebar.jsx/GuestModeBar.jsx, sessions du 26-27/07) :
              // `hover:${textHighlight}` aurait construit la classe par
              // interpolation avec un préfixe — le token combiné
              // `hover:text-main` n'apparaîtrait alors JAMAIS en toutes
              // lettres dans le code source, donc jamais généré par
              // Tailwind (scan littéral du texte source, pas d'évaluation
              // JS). `textHighlight` vaut toujours exactement `"text-main"`
              // dans ce projet (aucune variante Mode Intime, voir
              // useTheme.js) — `hover:text-main` écrit ici en dur plutôt
              // qu'interpolé, en toute sécurité.
              // ⚠️ REFONTE (04/08, retour direct, capture annotée — le lien
              // "Profil : Ajuster mes zones BPM" gardait le préfixe en gris
              // (`textMuted`), seul "Configure →" ressortait en accent) :
              // tout le libellé passe en accent (`textColorClass`), texte
              // unifié en un seul span ("Configurer mes zones BPM →" plutôt
              // que "Profil : Ajuster mes zones BPM" + "Configure →" séparé)
              // — la flèche colle directement au texte (espace simple, plus
              // de `ml-2` qui l'écartait artificiellement).
              // ⚠️ ALIGNÉ SUR LA CONVENTION (04/08, même jour, retour direct :
              // "j'aimerais bien utiliser la même flèche et souligner mon
              // texte configurer BPM, comme pour synchroniser mes comptes")
              // — la refonte ci-dessus avait involontairement introduit un
              // style DIFFÉRENT (icône `Gauge`, pas de soulignement par
              // défaut) de la convention déjà en place ailleurs dans l'app
              // pour ce type de lien ("Synchroniser mes comptes →" dans
              // FavoritesView.jsx, "Aller à Mes Séances →"/"Voir l'aperçu de
              // mon profil public →"/"Gérer ma visibilité →"/"Configurer mon
              // Profil Athlétique →" dans StatsView.jsx) — toutes en
              // `font-bold underline`, AUCUNE icône. Icône retirée,
              // `INLINE_NAV_LINK_CLASS` (layout/inlineLinkLayout.js, nouveau
              // ce même jour) appliquée ici comme partout ailleurs — voir sa
              // docstring pour l'audit complet et la règle pour un futur
              // lien de ce type.
              <button
                onClick={() => changeView('settings')} disabled={isGenerating}
                className={`text-sm ${INLINE_NAV_LINK_CLASS} ${textColorClass} hover:opacity-80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Configurer mes zones BPM →
              </button>
            ) : <div/>}
            <button
              onClick={goToNextWizardStep}
              disabled={isNextDisabledByInvalidTarget}
              title={isNextDisabledByInvalidTarget ? (isSegmentsStepInvalid ? 'Chaque portion doit avoir un BPM et une durée/distance valides.' : (targetMode === 'distance' ? 'Renseigne une distance supérieure à 0 pour continuer.' : 'Renseigne une durée supérieure à 0 pour continuer.')) : undefined}
              className={`px-8 py-3 rounded-xl font-bold flex items-center space-x-2 text-white shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isNaughtyMode ?
              'bg-rose-500 hover:bg-rose-600' : 'bg-red-500 hover:bg-red-600'}`}>
              <span>Suivant</span> <ChevronRight size={20}/>
            </button>
          </div>
        )}
        {wizardStep === 4 && (
          <div className="mt-4 flex justify-start">
            <button onClick={goToPreviousWizardStepFromStep4} disabled={isGenerating} className={`px-6 py-2 rounded-xl font-bold flex items-center space-x-2 ${textMuted} hover:text-main transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}>
              <ChevronLeft size={18}/> <span>Retour aux réglages</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
