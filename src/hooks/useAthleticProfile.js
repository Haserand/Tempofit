import { useEffect } from 'react';
import { usePersistentState } from './usePersistentState';
import { WORKOUT_DEFAULT_BPM } from '../appConfig';

/**
 * useAthleticProfile — regroupe le "Profil Athlétique" de l'utilisateur : le
 * BPM MUSICAL qu'il souhaite entendre à chaque zone d'intensité d'effort
 * (Récupération/Endurance/Seuil/Vitesse). Persisté comme tout le reste via
 * `usePersistentState`, même convention que useFavorites/useUserStats/useRoutines.
 *
 * ⚠️ PIVOT DE MODÈLE (retour direct, avec un cas concret : "à ma zone 4, mon
 * cœur est à 170 bpm, mes pas à 160, et je veux de la musique à 180") — ce
 * fichier prétendait avant stocker une CADENCE PHYSIQUE (PPM, le rythme des
 * pas), silencieusement recopiée telle quelle comme cible BPM de génération.
 * Or ce sont 3 nombres INDÉPENDANTS pour la plupart des gens :
 *   - la fréquence cardiaque réelle (mesure physiologique, en retard sur
 *     l'effort, sensible à la chaleur/fatigue/forme du jour — un mauvais
 *     tempo littéral : 170 bpm cardiaque donnerait une musique bien plus
 *     agressive que ce qu'on a généralement envie d'entendre) ;
 *   - la cadence physique réelle (rythme des pas — la seule des 3 qui ait un
 *     sens rythmique réel, mais rien n'oblige la musique à la matcher au
 *     PPM près, voir le cas ci-dessus) ;
 *   - le tempo de musique qu'on a ENVIE d'entendre à cette intensité — la
 *     seule des 3 qui compte vraiment pour la génération, et déjà (avant ce
 *     pivot) ce que StatsView classait en pratique dans son camembert "zones"
 *     (`classifyIntoZone(t.bpm, ...)` classe le BPM du TITRE généré, jamais
 *     une cadence réelle importée) — le code faisait déjà ça, seul le texte
 *     à l'écran prétendait encore parler de cadence physique.
 *
 * Ce fichier stocke maintenant DIRECTEMENT ce 3e nombre : le BPM musical
 * cible par zone, décidé par l'utilisateur en s'appuyant sur ce qu'il veut
 * (sa cadence, sa FC, son ressenti — le mélange qui lui parle), pas une
 * conversion automatique depuis l'un des deux autres. Les zones
 * (Récupération/Endurance/Seuil/Vitesse, `ATHLETIC_ZONES` dans appConfig.js)
 * restent des noms génériques de NIVEAU D'EFFORT — empruntés au vocabulaire
 * des coachs de course à pied, indépendants de la fréquence cardiaque —
 * pas une promesse que le nombre associé soit "physique" plutôt que musical.
 *
 * La vraie cadence physique et la vraie fréquence cardiaque restent
 * mesurables et affichées ailleurs, sans changement : import Garmin/Strava
 * réel (voir useSessionAnalysis.js et `getCadenceUnitLabel`/`playlistCadenceUnit`
 * dans PlaylistDetailView.jsx, qui eux parlent bien de cadence physique en
 * PPM/RPM — un cas totalement différent de ce fichier, jamais mélangé).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ÉVOLUTION MULTI-ACTIVITÉS (session précédente) : un seul profil global
 * devient un DICTIONNAIRE de profils par activité :
 *
 *   { activities: { 'Course à pied': {...}, 'Cyclisme': {...} }, custom: [...] }
 *
 * Deux choix de structure qui s'écartent volontairement de la demande initiale
 * (clés `running`/`cycling`, zones `z1..z4`) — expliqués ici plutôt que
 * silencieusement changés :
 *
 * 1. Clés d'activité = les IDENTIFIANTS RÉELS déjà utilisés partout ailleurs
 *    dans l'app (`WORKOUT_TYPES` dans appConfig.js : 'Course à pied',
 *    'Cyclisme'...), pas 'running'/'cycling'. Sans ça, GeneratorView aurait dû
 *    maintenir une table de correspondance français ↔ anglais rien que pour
 *    relier le `workoutType` choisi à l'étape 1 au bon profil ici — une
 *    source de bug de plus pour aucun bénéfice.
 * 2. Zones toujours `zone1`..`zone4` (pas `z1`..`z4`) — cohérence avec
 *    `ATHLETIC_ZONES` (appConfig.js, `key: 'zone1'` etc.), qui reste la SEULE
 *    source des libellés/couleurs affichés (StatsView, GeneratorView) et n'a
 *    pas été dupliquée avec un 2e système de clés.
 *
 * "Autre/Personnalisé" : PAS une 3e clé fixe dans `activities`, mais un
 * tableau `custom` — chaque activité personnalisée (ex. "Elliptique") y est
 * une entrée `{ id, name, isConfigured, baseCadence, zone1..zone4 }`,
 * indépendante des autres. Se raccroche au mécanisme EXISTANT de
 * `useCustomActivity.js` (le nom tapé dans la modale "Autre" à l'étape 1) via
 * `getProfileForWorkout(workoutType, customActivityName)` plus bas : si le nom
 * tapé correspond (insensible à la casse/aux espaces) à une activité
 * personnalisée déjà configurée ici, on récupère son profil ; sinon repli sur
 * des valeurs par défaut standard — jamais d'erreur, jamais de profil
 * fantôme.
 *
 * "Musculation" n'a volontairement PAS de 3e emplacement dédié dans
 * `activities` (le plan ne le demandait pas) — la choisir à l'étape 1 retombe
 * sur le repli standard comme n'importe quelle activité sans profil configuré.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `isConfigured` (par profil, pas global) : distingue "l'utilisateur a
 * réellement rempli CE profil au moins une fois" de "valeurs par défaut
 * quelconques" — sert de garde-fou pour GeneratorView (pré-remplissage
 * Crescendo) ET StatsView (répartition par zone).
 *
 * Note de nommage interne : les champs restent `baseCadence`/`zone1..zone4`
 * en interne (pas renommés en `targetBpm`/etc.) pour ne rien casser dans les
 * données déjà persistées (`usePersistentState`) des utilisateurs existants
 * — seul ce qui est AFFICHÉ à l'écran change de sens, pas la forme des
 * données stockées.
 */

// Plancher bas volontairement généreux (40 PPM) : même valeur numérique que
// Plancher bas volontairement généreux (40 BPM) : même valeur numérique que
// le plancher BPM du mode Intime ailleurs dans l'app (voir GeneratorView,
// bpmFloor) — sert seulement à éviter une Zone 1 absurde si quelqu'un saisit
// un BPM cible très bas, jamais un vrai jugement sur ce qui est "trop lent".
// Sport-agnostique volontairement : c'est une borne de sécurité sur un BPM
// MUSICAL cible (voir le pivot de modèle dans la docstring en tête de
// fichier), donc pas de raison d'en faire une borne différente par sport.
const ATHLETIC_BPM_FLOOR = 40;

// Espacement (en BPM) entre 2 zones consécutives, selon l'activité — reste un
// point de départ RAISONNABLE inspiré de l'écart de cadence réel observé entre
// un footing facile et un effort proche de la VMA (20 à 45 pas/min selon
// McMillan Running/RunBikeCalc/TrainingPeaks) : ces zones décrivent maintenant
// un BPM MUSICAL cible, pas une cadence physique mesurée (voir le pivot de
// modèle en tête de fichier) — mais l'écart type entre zones reste un repère
// crédible pour espacer 4 tempos progressifs, même si rien n'oblige à le
// suivre à la lettre (ajustable au BPM près via "Ajuster manuellement").
// 5 BPM/palier pour Cyclisme (progression plus resserrée en pratique) contre
// 15 pour Course à pied.
//
// Honnêteté : pour une activité personnalisée (patin, elliptique...),
// impossible de deviner un espacement spécifique sans plus d'info sur le
// sport — la valeur par défaut (10) s'y applique, ajustable de toute façon au
// BPM près via "Ajuster manuellement".
const ZONE_SPACING_BY_ACTIVITY = {
  'Course à pied': 15,
  'Cyclisme': 5,
};
const DEFAULT_ZONE_SPACING = 10;

const emptyProfile = () => ({ isConfigured: false, baseCadence: null, zone1: null, zone2: null, zone3: null, zone4: null });

const computeZonesFromBaseBpm = (base, spacing = DEFAULT_ZONE_SPACING) => ({
  zone1: Math.max(ATHLETIC_BPM_FLOOR, base - spacing),
  zone2: Math.max(ATHLETIC_BPM_FLOOR, base),
  zone3: Math.max(ATHLETIC_BPM_FLOOR, base + spacing),
  zone4: Math.max(ATHLETIC_BPM_FLOOR, base + spacing * 2),
});

// BPM cible CRÉDIBLE par activité, utilisée uniquement pour PRÉ-REMPLIR
// l'Assistant Rapide et les champs "Ajuster manuellement" avant toute vraie
// saisie (retour direct : "il devrait toujours y avoir un nombre par
// défaut... pour inciter l'utilisateur à manipuler... des valeurs crédibles
// par discipline") — jamais pour décider `isConfigured`, qui reste
// strictement réservé à "la personne a réellement validé/ajusté quelque
// chose ici" (voir plus bas). Réutilise volontairement `WORKOUT_DEFAULT_BPM`
// (appConfig.js) plutôt que d'inventer de nouveaux chiffres : ce sont déjà
// les BPM par défaut du wizard pour ces mêmes activités (160 Course à pied,
// 140 Cyclisme), donc déjà des valeurs crédibles et cohérentes avec le reste
// de l'app. "Autre"/repli pour toute activité personnalisée, faute d'un
// chiffre spécifique par discipline pour une activité inconnue à l'avance
// (patin, elliptique...).
const getDefaultBaseBpm = (activityKey) => WORKOUT_DEFAULT_BPM.standard[activityKey] ?? WORKOUT_DEFAULT_BPM.standard['Autre'];

// Profil "aperçu" complet (BPM de base + 4 zones déjà calculées) pour une
// activité qui n'a JAMAIS été configurée — `isConfigured` reste `false` :
// ceci sert de valeur d'AFFICHAGE par défaut (voir GeneratorView.jsx), pas
// une vraie configuration silencieuse. Sert aussi de bloc de départ dans
// `setZoneForActivity`/`setZoneForCustom` ci-dessous : si la personne ajuste
// UNE SEULE zone à la main sans être jamais passée par l'Assistant Rapide,
// les 3 AUTRES zones doivent se retrouver enregistrées avec ces mêmes valeurs
// par défaut déjà affichées à l'écran — jamais `null` en douce alors que
// l'écran, lui, montrait déjà un chiffre.
const buildDefaultPreviewProfile = (activityKey) => {
  const base = getDefaultBaseBpm(activityKey);
  const spacing = ZONE_SPACING_BY_ACTIVITY[activityKey] ?? DEFAULT_ZONE_SPACING;
  return { isConfigured: false, baseCadence: base, ...computeZonesFromBaseBpm(base, spacing) };
};

// Espacement RÉEL utilisé pour une activité donnée — exposé pour que l'UI
// (infobulle "méthode de calcul", GeneratorView.jsx) puisse afficher le vrai
// chiffre plutôt que de deviner/dupliquer la table ZONE_SPACING_BY_ACTIVITY.
const getZoneSpacingForActivity = (activityKey) => ZONE_SPACING_BY_ACTIVITY[activityKey] ?? DEFAULT_ZONE_SPACING;

export function useAthleticProfile() {
  const [athleticProfile, setAthleticProfile] = usePersistentState('athleticProfile', () => ({
    activities: {
      'Course à pied': emptyProfile(),
      'Cyclisme': emptyProfile(),
    },
    custom: [],
  }));

  // Migration UNE SEULE FOIS depuis l'ancien format "profil unique" (avant
  // cette session) — un utilisateur qui avait déjà configuré son profil ne
  // doit pas se retrouver avec un profil vide du jour au lendemain juste
  // parce que la structure a changé. L'ancien profil (sport-agnostique) est
  // rapatrié sur "Course à pied" : c'était déjà implicitement la seule
  // activité visée ("cadence habituelle lors d'un FOOTING lent"). Détecté par
  // la PRÉSENCE de `zone1` en clé de premier niveau (signature de l'ancien
  // format) ET l'ABSENCE de `activities` (signature du nouveau) — ne se
  // déclenche donc plus jamais une fois la migration faite.
  useEffect(() => {
    if (athleticProfile && !athleticProfile.activities && athleticProfile.zone1 !== undefined) {
      setAthleticProfile({
        activities: {
          'Course à pied': {
            isConfigured: athleticProfile.isConfigured,
            baseCadence: athleticProfile.baseCadence,
            zone1: athleticProfile.zone1, zone2: athleticProfile.zone2,
            zone3: athleticProfile.zone3, zone4: athleticProfile.zone4,
          },
          'Cyclisme': emptyProfile(),
        },
        custom: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Activités "built-in" (Course à pied, Cyclisme) ───────────────────────

  const setBaseBpmForActivity = (activityKey, rawValue) => {
    const base = parseInt(rawValue);
    if (!Number.isFinite(base) || base <= 0) return;
    const spacing = ZONE_SPACING_BY_ACTIVITY[activityKey] ?? DEFAULT_ZONE_SPACING;
    setAthleticProfile(prev => ({
      ...prev,
      activities: {
        ...prev.activities,
        [activityKey]: { isConfigured: true, baseCadence: base, ...computeZonesFromBaseBpm(base, spacing) },
      },
    }));
  };

  // Mode Expert : ajuste UNE zone à la fois, sans recalculer les 3 autres —
  // une fois qu'une zone a été ajustée manuellement, elle n'est plus jamais
  // recalculée automatiquement (même philosophie "manuel = définitif" que le
  // BPM Échauffement/Retour au calme du Crescendo, voir useGeneratorForm.js).
  const setZoneForActivity = (activityKey, zoneKey, rawValue) => {
    const value = parseInt(rawValue);
    setAthleticProfile(prev => {
      const existing = prev.activities[activityKey];
      // BUG évité (retour direct, section Assistant Rapide) : si l'activité
      // n'a JAMAIS été configurée, on part du profil "aperçu" déjà affiché à
      // l'écran (voir buildDefaultPreviewProfile) plutôt que de zones à
      // `null` — sinon ajuster UNE SEULE zone à la main aurait silencieusement
      // enregistré les 3 AUTRES à `null`, alors que l'écran, lui, montrait
      // déjà un chiffre par défaut pour chacune.
      const current = (existing && existing.isConfigured) ? existing : buildDefaultPreviewProfile(activityKey);
      return {
        ...prev,
        activities: {
          ...prev.activities,
          [activityKey]: {
            ...current,
            isConfigured: true,
            [zoneKey]: Number.isFinite(value) && value > 0 ? Math.max(ATHLETIC_BPM_FLOOR, value) : current[zoneKey],
          },
        },
      };
    });
  };

  const resetActivityProfile = (activityKey) => {
    setAthleticProfile(prev => ({ ...prev, activities: { ...prev.activities, [activityKey]: emptyProfile() } }));
  };

  // ─── Activités personnalisées ("Ajouter une autre activité") ──────────────

  // Identifiant simple (horodatage) plutôt qu'un vrai UUID — cohérent avec le
  // reste de l'app (voir génération d'ids des routines/playlists ailleurs),
  // amplement suffisant pour une poignée d'activités persos par utilisateur.
  const addCustomActivity = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const id = `custom-${Date.now()}`;
    setAthleticProfile(prev => ({ ...prev, custom: [...prev.custom, { id, name: trimmed, ...emptyProfile() }] }));
    return id;
  };

  const removeCustomActivity = (id) => {
    setAthleticProfile(prev => ({ ...prev, custom: prev.custom.filter(c => c.id !== id) }));
  };

  const setBaseBpmForCustom = (id, rawValue) => {
    const base = parseInt(rawValue);
    if (!Number.isFinite(base) || base <= 0) return;
    setAthleticProfile(prev => ({
      ...prev,
      custom: prev.custom.map(c => c.id === id
        ? { ...c, isConfigured: true, baseCadence: base, ...computeZonesFromBaseBpm(base, DEFAULT_ZONE_SPACING) }
        : c),
    }));
  };

  const setZoneForCustom = (id, zoneKey, rawValue) => {
    const value = parseInt(rawValue);
    setAthleticProfile(prev => ({
      ...prev,
      custom: prev.custom.map(c => {
        if (c.id !== id) return c;
        // Même seed que setZoneForActivity ci-dessus : part du profil aperçu
        // déjà affiché (nom générique "custom", repli WORKOUT_DEFAULT_BPM.Autre)
        // plutôt que de zones à `null`, si jamais configuré.
        const current = c.isConfigured ? c : { ...c, ...buildDefaultPreviewProfile('__custom__') };
        return {
          ...current,
          isConfigured: true,
          [zoneKey]: Number.isFinite(value) && value > 0 ? Math.max(ATHLETIC_BPM_FLOOR, value) : current[zoneKey],
        };
      }),
    }));
  };

  // ─── Lookup — LE point d'entrée que GeneratorView utilisera à l'étape 3 ───

  /**
   * Résout le profil applicable à une activité. Gère DEUX façons de l'appeler,
   * qui correspondent aux deux endroits qui en ont besoin :
   *
   * 1. Depuis GeneratorView (étape 1 du wizard) : `workoutTypeOrName='Autre'`
   *    ET `customActivityName` = le texte tapé dans la modale (voir
   *    useCustomActivity.js), pas encore "résolu" à ce stade.
   * 2. Depuis StatsView (playlists déjà générées) : un seul argument, déjà
   *    résolu — une playlist sauvegardée ne stocke JAMAIS littéralement
   *    'Autre' dans son `workoutType` : `createPlaylistData` (musicEngine.js)
   *    y met directement le nom personnalisé le cas échéant (`finalWorkoutName`).
   *
   * Les deux convergent vers la même résolution : nom direct d'une activité
   * "built-in", sinon recherche par nom (insensible casse/espaces) dans
   * `custom`, sinon profil vide. Renvoie toujours un objet exploitable,
   * jamais `null`/`undefined` — à l'appelant de vérifier `isConfigured`.
   */
  const getProfileForWorkout = (workoutTypeOrName, customActivityName = '') => {
    const nameToMatch = (workoutTypeOrName === 'Autre' && customActivityName && customActivityName.trim())
      ? customActivityName.trim()
      : workoutTypeOrName;
    if (athleticProfile.activities[nameToMatch]) return athleticProfile.activities[nameToMatch];
    const normalized = (nameToMatch || '').trim().toLowerCase();
    const match = athleticProfile.custom.find(c => c.name.trim().toLowerCase() === normalized);
    return match || emptyProfile();
  };

  const resetAthleticProfile = () => setAthleticProfile({
    activities: { 'Course à pied': emptyProfile(), 'Cyclisme': emptyProfile() },
    custom: [],
  });

  return {
    athleticProfile, setAthleticProfile,
    computeZonesFromBaseBpm, getDefaultBaseBpm, buildDefaultPreviewProfile, getZoneSpacingForActivity,
    setBaseBpmForActivity, setZoneForActivity, resetActivityProfile,
    addCustomActivity, removeCustomActivity, setBaseBpmForCustom, setZoneForCustom,
    getProfileForWorkout,
    resetAthleticProfile,
  };
}
