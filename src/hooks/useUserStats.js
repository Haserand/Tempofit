import { useState } from 'react';
import { TROPHIES_DATA } from '../appConfig';

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
  const [userStats, setUserStats] = useState({
    totalCompleted: 0, naughtyCompleted: 0, dataImports: 0,
    replacedTracks: 0, hasMarathon: false, hasBolt: false,
    hasHiitMaster: false, hasNightOwl: false, hasRickroll: false,
    unlockedTrophies: []
  });

  // Compare newStats aux conditions de TROPHIES_DATA et débloque les nouveaux
  // trophées éligibles. N'affiche qu'un seul toast même si plusieurs trophées
  // sont débloqués d'un coup (affiche le premier de la liste).
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
      showToast(`🏆 Trophée débloqué : ${newlyUnlocked[0].name} !`, 'special');
    } else {
      setUserStats(newStats);
    }
  };

  return { userStats, setUserStats, checkTrophies };
}
