import { useEffect, useCallback, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import {
  isCadenceIntentEligible,
  emptyProfile,
  computeZonesFromBaseBpm,
  getDefaultBaseBpm,
  buildDefaultPreviewProfile,
  getZoneSpacingForActivity,
  ATHLETIC_BPM_FLOOR,
} from '../athleticZones';

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
 * une entrée `{ id, name, isConfigured, targetBpm, zone1..zone4 }`,
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
 * Note de nommage interne : le champ `baseCadence` a été renommé en
 * `targetBpm` (avec `zone1..zone4`, cohérence inchangée) — pas de migration
 * nécessaire, aucun utilisateur existant n'avait encore de profil persisté.
 * Si ce n'était pas le cas, il aurait fallu lire l'ancien nom en plus du
 * nouveau le temps d'une migration, comme pour l'ancien format plat (V1,
 * voir plus haut).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STABILISATION RÉFÉRENTIELLE (10/08, check-up) : toutes les fonctions de
 * mutation (`setBaseBpmForActivity`, `setZoneForActivity`,
 * `resetActivityProfile`, `addCustomActivity`, `removeCustomActivity`,
 * `setBaseBpmForCustom`, `setZoneForCustom`, `setCadenceIntentForActivity`,
 * `setCadenceIntentForCustom`, `resetAthleticProfile`) enveloppées dans
 * `useCallback([])` — aucune ne lit `athleticProfile` directement (toutes
 * passent par `prev =>` dans `setAthleticProfile`, garanti stable par
 * React comme tout setter `useState`), donc rien ne les empêchait d'être
 * stables depuis le début. La `value` retournée par ce hook est maintenant
 * elle-même dans un `useMemo`. Raison : ce hook n'est appelé QU'une fois,
 * dans `App()` (App.jsx) — et `AthleticContext.jsx` (08/08) enveloppe déjà
 * SON `value` dans un `useMemo` qui dépend de cet objet retourné ICI en
 * entier. Sans cette stabilisation, cet objet était recréé à CHAQUE rendu
 * de `App()` (y compris les ~73 endroits du projet qui affichent un toast,
 * state également possédé par `App()`, sans rapport avec le profil
 * athlétique) — rendant le `useMemo` d'`AthleticContext.jsx` décoratif :
 * il recalculait presque à chaque interaction utilisateur ayant un retour
 * visuel, pas seulement quand le profil changeait vraiment. `getProfileForWorkout`/
 * `getProfileForWorkoutOrDefault` l'étaient déjà (03/08, voir plus bas) —
 * seules les 10 fonctions de mutation ci-dessus manquaient.
 * ─────────────────────────────────────────────────────────────────────────
 */

// Constantes/fonctions pures de calcul des zones BPM : extraites dans
// src/athleticZones.js (importé plus haut) pour être testables sans React —
// voir ce fichier pour le détail des choix (plancher, espacement par
// activité, mode Synchro cadence, etc.).

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
            targetBpm: athleticProfile.targetBpm,
            zone1: athleticProfile.zone1, zone2: athleticProfile.zone2,
            zone3: athleticProfile.zone3, zone4: athleticProfile.zone4,
            cadenceIntent: 'energy',
          },
          'Cyclisme': emptyProfile(),
        },
        custom: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Activités "built-in" (Course à pied, Cyclisme) ───────────────────────

  // `useCallback([])` (10/08, check-up) — sûr ici (comme les 9 autres
  // fonctions de mutation ci-dessous) : cette fonction ne lit JAMAIS
  // `athleticProfile` directement, uniquement via `prev =>` dans
  // `setAthleticProfile` (le setter de `usePersistentState`, garanti stable
  // par React comme n'importe quel setter `useState` — voir sa propre
  // définition, `return [state, setState]`). Les seules autres valeurs
  // fermées (`getZoneSpacingForActivity`/`computeZonesFromBaseBpm`) sont des
  // imports MODULE-LEVEL de `athleticZones.js`, jamais recréées entre les
  // rendus. Donc RIEN dans le corps de cette fonction ne peut jamais
  // changer d'une frappe à l'autre — `[]` est la dépendance correcte, pas
  // une approximation.
  //
  // RAISON D'ÊTRE (voir aussi la docstring de `AthleticContext.jsx`) :
  // avant ce chantier, cette fonction (et les 9 sœurs ci-dessous) était une
  // simple `const` recréée à CHAQUE appel de `useAthleticProfile()` — donc
  // à CHAQUE rendu de `App()` (l'unique appelant, App.jsx), y compris les
  // re-renders déclenchés par `toast` (state DE `App()`, mis à jour par les
  // ~73 appels `showToast(...)` du projet, n'importe où). Le `useMemo` déjà
  // posé dans `AthleticContext.jsx` le 08/08 dépendait de l'objet retourné
  // ICI EN ENTIER — donc recalculait à chaque toast affiché n'importe où
  // dans l'app, pas seulement quand le profil athlétique changeait
  // vraiment. Stabiliser les fonctions ICI, à la source, est ce qui rend ce
  // `useMemo` réellement efficace plutôt que décoratif.
  const setBaseBpmForActivity = useCallback((activityKey, rawValue) => {
    const base = parseInt(rawValue);
    if (!Number.isFinite(base) || base <= 0) return;
    setAthleticProfile(prev => {
      // Respecte l'intention DÉJÀ choisie pour cette activité (sync ou
      // énergie) si elle existe — sinon 'energy' par défaut (comportement
      // historique, avant l'existence du mode Synchro).
      const cadenceIntent = prev.activities[activityKey]?.cadenceIntent || 'energy';
      const spacing = getZoneSpacingForActivity(activityKey, cadenceIntent);
      return {
        ...prev,
        activities: {
          ...prev.activities,
          [activityKey]: { isConfigured: true, targetBpm: base, cadenceIntent, ...computeZonesFromBaseBpm(base, spacing) },
        },
      };
    });
  }, [setAthleticProfile]);

  // RETOUR DIRECT ("proposer une visualisation par sync uniquement si
  // l'utilisateur active l'option") — bascule l'intention ET recalcule
  // immédiatement les 4 zones autour du MÊME BPM de base (`targetBpm`
  // courant, ou le défaut crédible si jamais configuré), avec le nouvel
  // espacement correspondant. Sans ce recalcul, changer d'intention laisserait
  // les anciennes zones (mal espacées pour la nouvelle intention) jusqu'à ce
  // que la personne relance l'Assistant Rapide — un état incohérent entre
  // "ce qui est coché" et "ce qui est affiché".
  const setCadenceIntentForActivity = useCallback((activityKey, intent) => {
    if (intent !== 'energy' && intent !== 'sync') return;
    setAthleticProfile(prev => {
      const existing = prev.activities[activityKey];
      // Si l'activité n'a JAMAIS été configurée, ne pas écrire de vraies
      // valeurs de zone maintenant : `isConfigured: false` doit garder des
      // zones à `null` (invariant dont dépend `getProfileForWorkout`, le
      // résolveur STRICT utilisé par l'export public/les badges — voir
      // useAthleticProfile.js en tête de fichier). Juste mémoriser
      // l'intention choisie, appliquée dès que "Calculer mes zones" sera
      // réellement utilisé (voir setBaseBpmForActivity ci-dessus, qui lit
      // déjà `cadenceIntent` en priorité).
      if (!existing?.isConfigured) {
        return { ...prev, activities: { ...prev.activities, [activityKey]: { ...emptyProfile(), cadenceIntent: intent } } };
      }
      const spacing = getZoneSpacingForActivity(activityKey, intent);
      return {
        ...prev,
        activities: {
          ...prev.activities,
          [activityKey]: { ...existing, cadenceIntent: intent, ...computeZonesFromBaseBpm(existing.targetBpm, spacing) },
        },
      };
    });
  }, [setAthleticProfile]);

  // Mode Expert : ajuste UNE zone à la fois, sans recalculer les 3 autres —
  // une fois qu'une zone a été ajustée manuellement, elle n'est plus jamais
  // recalculée automatiquement (même philosophie "manuel = définitif" que le
  // BPM Échauffement/Retour au calme du Crescendo, voir useGeneratorForm.js).
  const setZoneForActivity = useCallback((activityKey, zoneKey, rawValue) => {
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
  }, [setAthleticProfile]);

  const resetActivityProfile = useCallback((activityKey) => {
    setAthleticProfile(prev => ({ ...prev, activities: { ...prev.activities, [activityKey]: emptyProfile() } }));
  }, [setAthleticProfile]);

  // ─── Activités personnalisées ("Ajouter une autre activité") ──────────────

  // Identifiant simple (horodatage) plutôt qu'un vrai UUID — cohérent avec le
  // reste de l'app (voir génération d'ids des routines/playlists ailleurs),
  // amplement suffisant pour une poignée d'activités persos par utilisateur.
  const addCustomActivity = useCallback((name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const id = `custom-${Date.now()}`;
    setAthleticProfile(prev => ({ ...prev, custom: [...prev.custom, { id, name: trimmed, ...emptyProfile() }] }));
    return id;
  }, [setAthleticProfile]);

  const removeCustomActivity = useCallback((id) => {
    setAthleticProfile(prev => ({ ...prev, custom: prev.custom.filter(c => c.id !== id) }));
  }, [setAthleticProfile]);

  const setBaseBpmForCustom = useCallback((id, rawValue) => {
    const base = parseInt(rawValue);
    if (!Number.isFinite(base) || base <= 0) return;
    setAthleticProfile(prev => ({
      ...prev,
      custom: prev.custom.map(c => {
        if (c.id !== id) return c;
        const cadenceIntent = c.cadenceIntent || 'energy';
        const spacing = getZoneSpacingForActivity('__custom__', cadenceIntent);
        return { ...c, isConfigured: true, targetBpm: base, cadenceIntent, ...computeZonesFromBaseBpm(base, spacing) };
      }),
    }));
  }, [setAthleticProfile]);

  // Même garde-fou que setCadenceIntentForActivity ci-dessus : ne recalcule
  // de vraies zones que si l'activité personnalisée est DÉJÀ configurée,
  // sinon mémorise juste l'intention (zones restent à `null`).
  const setCadenceIntentForCustom = useCallback((id, intent) => {
    if (intent !== 'energy' && intent !== 'sync') return;
    setAthleticProfile(prev => ({
      ...prev,
      custom: prev.custom.map(c => {
        if (c.id !== id) return c;
        if (!c.isConfigured) return { ...c, cadenceIntent: intent };
        const spacing = getZoneSpacingForActivity('__custom__', intent);
        return { ...c, cadenceIntent: intent, ...computeZonesFromBaseBpm(c.targetBpm, spacing) };
      }),
    }));
  }, [setAthleticProfile]);

  const setZoneForCustom = useCallback((id, zoneKey, rawValue) => {
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
  }, [setAthleticProfile]);

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
  const getProfileForWorkout = useCallback((workoutTypeOrName, customActivityName = '') => {
    const nameToMatch = (workoutTypeOrName === 'Autre' && customActivityName && customActivityName.trim())
      ? customActivityName.trim()
      : workoutTypeOrName;
    if (athleticProfile.activities[nameToMatch]) return athleticProfile.activities[nameToMatch];
    const normalized = (nameToMatch || '').trim().toLowerCase();
    const match = athleticProfile.custom.find(c => c.name.trim().toLowerCase() === normalized);
    return match || emptyProfile();
    // `useCallback` (03/08, check-up perf — voir StatsView.jsx, la 1re
    // consommatrice qui en avait vraiment besoin) : SANS ça, cette fonction
    // était RECRÉÉE à chaque rendu du composant propriétaire de ce hook —
    // une nouvelle référence à chaque fois, même quand `athleticProfile`
    // n'avait pas changé. N'importe quel `useMemo`/`useEffect` en aval qui
    // la prend en dépendance (ex. `statsAggregation`, StatsView.jsx)
    // recalculait alors à CHAQUE rendu du parent, pas seulement quand le
    // profil changeait vraiment — la mémoïsation en aval restait
    // techniquement correcte, mais son bénéfice réel était largement
    // annulé par cette instabilité en amont. Seule dépendance réelle :
    // `athleticProfile` (state de ce hook) — `emptyProfile` est une
    // fonction pure sans état, définie une seule fois plus haut dans ce
    // fichier, jamais recréée entre les rendus (voir sa propre définition).
  }, [athleticProfile]);

  // RETOUR DIRECT ("si je n'ai pas validé de profil mais fait des séances
  // normalement, je devrais avoir des stats — ce sera juste celles par
  // défaut, non ?") — variante de `getProfileForWorkout` pour les affichages
  // où "rien" est pire que "une estimation non confirmée" (typiquement
  // StatsView, une page privée). Si l'activité n'a jamais été configurée,
  // renvoie `buildDefaultPreviewProfile` (les mêmes valeurs par défaut déjà
  // montrées, grisées, sur la page Profil Athlétique elle-même — donc jamais
  // inventées pour l'occasion) PLUTÔT que `emptyProfile()` (zones à `null`,
  // rien à classer). `isConfigured` reste `false` sur ce qui est renvoyé —
  // ne PAS l'utiliser pour un badge/contexte qui doit rester honnête sur "ce
  // profil a vraiment été rempli" (ex. `bpmSourceIsProfile` dans
  // useGeneratorForm.js, ou l'export image `SessionSummaryCard.jsx`, partagé
  // publiquement — ceux-là continuent d'utiliser `getProfileForWorkout` tel
  // quel, sans repli).
  const getProfileForWorkoutOrDefault = useCallback((workoutTypeOrName, customActivityName = '') => {
    const profile = getProfileForWorkout(workoutTypeOrName, customActivityName);
    if (profile.isConfigured) return profile;
    const nameToMatch = (workoutTypeOrName === 'Autre' && customActivityName && customActivityName.trim())
      ? '__custom__'
      : workoutTypeOrName;
    return buildDefaultPreviewProfile(nameToMatch);
    // `useCallback` (03/08) — même raisonnement que `getProfileForWorkout`
    // juste au-dessus, voir sa docstring. Dépend de `getProfileForWorkout`
    // (maintenant stable elle-même) — PAS de `buildDefaultPreviewProfile`,
    // importée au niveau module (ligne 8), jamais recréée entre les
    // rendus.
  }, [getProfileForWorkout]);

  const resetAthleticProfile = useCallback(() => setAthleticProfile({
    activities: { 'Course à pied': emptyProfile(), 'Cyclisme': emptyProfile() },
    custom: [],
  }), [setAthleticProfile]);

  // `useMemo` (10/08, check-up — voir la docstring de `AthleticContext.jsx`
  // et les docstrings `useCallback` ci-dessus pour le détail du problème) :
  // SANS ce `useMemo`, cet objet était recréé à chaque appel de ce hook —
  // donc à chaque rendu de `App()` (son unique appelant), y compris les
  // ~73 endroits du projet qui affichent un toast n'importe où dans l'app
  // (state `toast` possédé par `App()`, sans rapport avec le profil
  // athlétique). Maintenant que les 10 fonctions de mutation ci-dessus sont
  // stabilisées par `useCallback([])` (jamais recréées, elles ne ferment
  // que sur `setAthleticProfile` — stable — et des imports module-level),
  // ce `useMemo` ne recalcule RÉELLEMENT que quand `athleticProfile`
  // change vraiment (ou, en théorie, si `getProfileForWorkout`/
  // `getProfileForWorkoutOrDefault` changeaient — déjà stabilisées depuis
  // le 03/08, listées ici par exhaustivité). `computeZonesFromBaseBpm`/
  // `getDefaultBaseBpm`/`buildDefaultPreviewProfile`/
  // `getZoneSpacingForActivity`/`isCadenceIntentEligible` : imports
  // module-level (ligne 3), jamais recréés — pas la peine de les lister en
  // dépendance, mais inclus dans l'objet retourné comme avant.
  return useMemo(() => ({
    athleticProfile, setAthleticProfile,
    computeZonesFromBaseBpm, getDefaultBaseBpm, buildDefaultPreviewProfile, getZoneSpacingForActivity,
    setBaseBpmForActivity, setZoneForActivity, resetActivityProfile,
    addCustomActivity, removeCustomActivity, setBaseBpmForCustom, setZoneForCustom,
    setCadenceIntentForActivity, setCadenceIntentForCustom, isCadenceIntentEligible,
    getProfileForWorkout, getProfileForWorkoutOrDefault,
    resetAthleticProfile,
  }), [
    athleticProfile, setAthleticProfile,
    setBaseBpmForActivity, setZoneForActivity, resetActivityProfile,
    addCustomActivity, removeCustomActivity, setBaseBpmForCustom, setZoneForCustom,
    setCadenceIntentForActivity, setCadenceIntentForCustom,
    getProfileForWorkout, getProfileForWorkoutOrDefault,
    resetAthleticProfile,
  ]);
}
