import { useCallback } from 'react';
import { TROPHIES_DATA } from '../appConfig';
import { usePersistentState } from './usePersistentState';

/**
 * useUserStats — regroupe les statistiques utilisateur servant à débloquer
 * les trophées, et la logique de vérification/déblocage elle-même.
 *
 * `showToast` est une dépendance externe (définie dans App.jsx) passée en
 * paramètre plutôt que dupliquée ici, pour garder un seul système de toast.
 *
 * `user` (retour direct, bug signalé : "j'ai encore les notifications quand
 * je débloque des trophées alors que je suis pas connecté") — le bouton
 * Trophées lui-même est déjà masqué en entier pour un visiteur non connecté
 * (voir Sidebar.jsx) ; sans ce garde-fou, `checkTrophies` continuait quand
 * même d'afficher le toast "Trophée débloqué" à chaque déblocage, pointant
 * vers une fonctionnalité invisible — incohérent. Le déblocage lui-même
 * (`unlockedTrophies`, stocké localement via `usePersistentState`, PAS lié
 * au compte) continue de progresser normalement même déconnecté : seul le
 * TOAST est suspendu, pas le suivi — si l'utilisateur se connecte plus
 * tard, ses trophées déjà débloqués restent acquis, juste jamais notifiés
 * pendant qu'ils ne pouvaient de toute façon pas les consulter.
 *
 * Beaucoup d'endroits différents dans App.jsx appellent `checkTrophies` après
 * un événement précis (séance terminée, import CSV, remplacement de titre,
 * easter egg Rickroll...) — c'est normal et attendu : ce hook centralise
 * uniquement la VÉRIFICATION et le DÉBLOCAGE, pas la détection de chaque
 * condition individuelle (qui reste au plus près du code métier concerné).
 */
export function useUserStats(showToast, user) {
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
  // Enveloppé dans useCallback (25/08, chantier perf — voir Sidebar.jsx) :
  // remonte jusqu'à `toggleTheme` (App.jsx), lui-même passé à <Sidebar>,
  // désormais mémoïsé (React.memo). Dépendances réelles : `user` (le garde-
  // fou "toast suspendu si déconnecté" documenté plus haut) et `showToast`
  // (déjà stabilisé, voir useToast.js) — `setUserStats` est un setState,
  // garanti stable par React, omis comme ailleurs dans ce projet.
  const checkTrophies = useCallback((newStats) => {
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
      //
      // `if (user)` : le toast lui-même est suspendu si déconnecté (voir la
      // docstring plus haut), mais la valeur de RETOUR doit refléter "un
      // toast a-t-il été affiché par cet appel ?" (c'est tout son rôle,
      // éviter qu'un appelant affiche un 2e toast par-dessus) — pas "un
      // trophée a-t-il été débloqué ?". Sans cette distinction, un
      // utilisateur déconnecté qui débloque un trophée en terminant une
      // séance se serait retrouvé avec AUCUN toast du tout : ni celui du
      // trophée (supprimé ici), ni le générique de l'appelant (qui aurait
      // cru, à tort, qu'un toast venait déjà d'être affiché).
      if (user) {
        showToast(`Trophée débloqué : ${newlyUnlocked[0].name} !`, 'special');
        return true;
      }
      return false;
    } else {
      setUserStats(newStats);
      return false;
    }
  }, [user, showToast]);

  // Badge de notification "vu/pas vu" (03/08, retour direct, capture
  // d'écran : "quand j'ai ouvert la partie trophées, l'icône doit devenir
  // grise... et les notifications '5' doit être retiré, sinon on pollue
  // visuellement") — AVANT ce chantier, le badge (Sidebar.jsx) affichait
  // INCONDITIONNELLEMENT `unlockedTrophies.length` dès qu'au moins un
  // trophée était débloqué, POUR TOUJOURS, même après consultation. Un
  // 2e morceau d'état persistant (`trophiesSeenCount`, PAS lié au compte,
  // même raisonnement que `unlockedTrophies` — voir la docstring de ce
  // hook plus haut) retient combien de trophées avaient déjà été VUS la
  // dernière fois que la page Trophées a été ouverte. Tant que
  // `unlockedTrophies.length > trophiesSeenCount`, il reste des trophées
  // "nouveaux, jamais montrés" → badge doré + nombre. `markTrophiesSeen()`
  // (appelée par `TrophiesView` à l'ouverture, voir sa docstring) remet
  // les compteurs à égalité → badge disparaît, icône redevient grise.
  //
  // Pas un simple booléen "vu/pas vu" : un COMPTEUR, pour survivre
  // correctement à un 2e déblocage APRÈS une 1re consultation (ex. : 5
  // trophées vus → `trophiesSeenCount = 5` → un 6e se débloque plus tard
  // → `6 > 5`, badge réapparaît avec juste "1", pas "6" — cohérent avec un
  // vrai badge de notification "nouveau depuis la dernière visite", pas
  // juste "y a-t-il eu un jour un trophée").
  const [trophiesSeenCount, setTrophiesSeenCount] = usePersistentState('trophiesSeenCount', () => 0);

  const unseenTrophyCount = Math.max(0, userStats.unlockedTrophies.length - trophiesSeenCount);

  const markTrophiesSeen = () => setTrophiesSeenCount(userStats.unlockedTrophies.length);

  return { userStats, setUserStats, checkTrophies, unseenTrophyCount, markTrophiesSeen };
}
