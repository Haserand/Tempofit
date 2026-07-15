import { TROPHIES_DATA } from '../appConfig';
import { usePersistentState } from './usePersistentState';

/**
 * useUserStats — regroupe les statistiques utilisateur servant à débloquer
 * les trophées, et la logique de vérification/déblocage elle-même.
 *
 * `showToast` est une dépendance externe (définie dans App.jsx) passée en
 * paramètre plutôt que dupliquée ici, pour garder un seul système de toast.
 *
 * Beaucoup d'endroits différents dans App.jsx appellent `checkTrophies` après
 * un événement précis (séance terminée, import CSV, remplacement de titre,
 * easter egg Rickroll...) — c'est normal et attendu : ce hook centralise
 * uniquement la VÉRIFICATION et le DÉBLOCAGE, pas la détection de chaque
 * condition individuelle (qui reste au plus près du code métier concerné).
 */
export function useUserStats(showToast) {
  const [userStats, setUserStats] = usePersistentState('userStats', () => ({
    totalCompleted: 0, naughtyCompleted: 0, dataImports: 0,
    replacedTracks: 0, hasMarathon: false, hasBolt: false,
    hasHiitMaster: false, hasNightOwl: false, hasRickroll: false,
    // Nouveaux trophées (passe de mise à jour — Crescendo, planification, mode
    // clair n'avaient encore aucun trophée) :
    usedStructureKinds: [], hasAllStructures: false,
    hasCrescendoCompleted: false, hasOnTimeCompletion: false,
    completedWorkoutTypes: [], hasAllWorkoutTypes: false,
    totalDistanceKm: 0, has100km: false,
    hasLightMode: false, hasStreak3: false,
    hasExtraGenre: false, hasPlannedSession: false, hasAutoGen: false,
    hasFirstRoutine: false, hasSharedSomething: false, hasUsedFavorites: false,
    unlockedTrophies: []
  }));

  // Compare newStats aux conditions de TROPHIES_DATA et débloque les nouveaux
  // trophées éligibles. N'affiche qu'un seul toast même si plusieurs trophées
  // sont débloqués d'un coup (affiche le premier de la liste).
  //
  // Renvoie `true` si au moins un trophée vient d'être débloqué par CET appel,
  // `false` sinon — BUG RÉEL CORRIGÉ : cette fonction ne mutait jamais l'objet
  // `newStats` reçu en paramètre (elle ne fait que `setUserStats`, un pur
  // setter d'état), donc un appelant qui comparait ENSUITE
  // `newStats.unlockedTrophies.length` à l'ancienne valeur comparait en
  // réalité le même tableau à lui-même — toujours égal, donc cette
  // comparaison ne détectait JAMAIS un déblocage. Cas réel touché :
  // `markPlaylistAsCompleted` (App.jsx) affichait alors TOUJOURS le toast
  // générique "Session marquée comme terminée !" juste après celui-ci,
  // écrasant silencieusement le toast "Trophée débloqué" (un seul slot de
  // toast à la fois, voir useToast.js) à chaque fois qu'une séance terminée
  // débloquait un trophée — exactement le cas que toute la refonte de cette
  // session (12 → 25 trophées, philosophie "inciter à essayer") avait le plus
  // besoin de mettre en avant. Renvoyer explicitement le résultat plutôt que
  // de laisser l'appelant deviner depuis l'objet passé règle ça à la racine.
  const checkTrophies = (newStats) => {
    const newlyUnlocked = TROPHIES_DATA.filter(t => {
      if (newStats.unlockedTrophies.includes(t.id)) return false;
      if (t.requirement.type === 'total' && newStats.totalCompleted >= t.requirement.count) return true;
      if (t.requirement.type === 'naughty' && newStats.naughtyCompleted >= t.requirement.count) return true;
      if (t.requirement.type === 'data' && newStats.dataImports >= t.requirement.count) return true;
      if (t.requirement.type === 'replace' && newStats.replacedTracks >= t.requirement.count) return true;
      if (t.requirement.type === 'custom' && newStats[t.requirement.key]) return true;
      return false;
    });

    if (newlyUnlocked.length > 0) {
      setUserStats({ ...newStats, unlockedTrophies: [...newStats.unlockedTrophies, ...newlyUnlocked.map(t => t.id)] });
      // Pas d'emoji 🏆 dans le message : le toast affiche déjà sa propre icône
      // trophée dorée pour le variant 'special' (voir App.jsx) — un 2e trophée
      // écrit en dur dans le texte donnait 2 trophées visibles côte à côte
      // pour un seul déblocage (retour direct).
      showToast(`Trophée débloqué : ${newlyUnlocked[0].name} !`, 'special');
      return true;
    } else {
      setUserStats(newStats);
      return false;
    }
  };

  return { userStats, setUserStats, checkTrophies };
}
