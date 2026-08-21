/**
 * usePlaylistCompletions — regroupe les 3 actions qui modifient l'historique de
 * complétion d'une playlist sauvegardée : marquer comme faite (maintenant ou à une
 * date choisie), retirer une date, éditer une date existante.
 *
 * Extrait d'App.jsx (25/07, chantier "réduire le God Component") : même schéma que
 * useFavorites.js/useRoutines.js — les dépendances externes (`savedPlaylists`/
 * `setSavedPlaylists`, source de vérité qui reste dans App.jsx car lue et écrite par
 * bien d'autres fonctions qu'elle, `showToast`, `userStats`/`checkTrophies`) sont
 * reçues en paramètres plutôt que réimplémentées ici. Comportement strictement
 * identique à l'original, y compris tous les calculs de trophées.
 */
export function usePlaylistCompletions(savedPlaylists, setSavedPlaylists, showToast, userStats, checkTrophies) {
  // Marque une playlist de l'historique comme "faite", met à jour les stats
  // (dont la détection "Oiseau de Nuit" selon l'heure locale) et vérifie les trophées.
  /**
   * Ajoute la date du jour à l'historique des complétions de la playlist (voir
   * playlist.completions), plutôt que de simplement basculer un statut booléen
   * "faite/pas faite". Ce choix permet de marquer la MÊME playlist comme faite
   * plusieurs fois (une entrée par vraie utilisation), sans dupliquer toute la
   * playlist à chaque fois — ce qui aurait recréé inutilement les mêmes titres et
   * pollué "Mes Playlists" d'un doublon par séance.
   */
  /**
   * Marque une playlist comme faite — soit "maintenant" (bouton "Marquer comme
   * faite", 1er clic sans calendrier), soit à une date CHOISIE explicitement
   * (bouton "Ajouter une date" sur une playlist déjà complétée, qui ouvre un
   * calendrier — fusionné ici avec l'ancien bouton "Marquer comme refaite
   * aujourd'hui" sur retour direct : les deux faisaient doublon, ne garder
   * qu'un seul bouton qui permet de choisir n'importe quelle date, y compris
   * aujourd'hui). `isoDate` absent ⇒ comportement "maintenant" inchangé
   * (horodatage complet avec l'heure) ; fourni ⇒ une simple date sans heure
   * (`YYYY-MM-DD`, ce que rend un `<input type="date">`).
   */
  const markPlaylistAsCompleted = (playlistId, isoDate) => {
    const pl = savedPlaylists.find(p => p.id === playlistId);
    if (!pl) return;

    const isExplicitDate = !!isoDate;
    const completionValue = isoDate || new Date().toISOString();
    const existingCompletions = pl.completions || [];

    if (existingCompletions.includes(completionValue)) {
      showToast("Cette date est déjà enregistrée.");
      return;
    }

    // CORRIGÉ après retour utilisateur : bloquer purement et simplement une 2e
    // complétion le même JOUR calendaire n'a pas de sens — une vraie double
    // séance le même jour (matin + soir) est un cas réel et légitime, pas une
    // erreur. Le vrai problème que la version précédente essayait de résoudre
    // (un double-clic accidentel sur ce bouton) se règle mieux avec un
    // horodatage complet (pas juste la date) et une fenêtre anti-rebond courte :
    // si la dernière complétion enregistrée date de moins de 10 secondes, on
    // suppose un clic répété par erreur ; au-delà, on suppose une vraie 2e séance.
    // UNIQUEMENT pertinent pour "maintenant" — une date choisie explicitement
    // dans le calendrier ne peut, par construction, jamais être un double-clic.
    if (!isExplicitDate) {
      const lastCompletion = existingCompletions.length > 0 ? existingCompletions[existingCompletions.length - 1] : null;
      if (lastCompletion) {
        const lastDate = new Date(lastCompletion);
        if (!isNaN(lastDate.getTime()) && (Date.now() - lastDate.getTime()) < 10000) {
          showToast("Déjà marquée à l'instant !");
          return;
        }
      }
    }

    const updatedCompletions = [...existingCompletions, completionValue].sort();
    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, completions: updatedCompletions } : p));

    // Heure de la journée : seulement significative pour "maintenant" — une
    // date choisie au calendrier (YYYY-MM-DD, sans heure) n'a pas d'heure
    // réelle associée, "Oiseau de Nuit" n'aurait aucun sens dessus.
    const isNight = !isExplicitDate && (() => {
      const hour = new Date(completionValue).getHours();
      return hour >= 22 || hour <= 4;
    })();

    let stats = {
      ...userStats,
      totalCompleted: userStats.totalCompleted + 1,
      naughtyCompleted: userStats.naughtyCompleted + (pl.isNaughty ? 1 : 0),
      hasNightOwl: userStats.hasNightOwl || isNight
    };

    // "Le Grimpeur" — compléter une séance en mode Crescendo.
    if (pl.config?.isCrescendoMode) stats.hasCrescendoCompleted = true;

    // "Pile à l'Heure" — la complétion tombe EXACTEMENT le jour planifié (même
    // comparaison que le texte "faite comme prévu" déjà affiché sur les
    // cartes, voir PlaylistCard.jsx — juste jamais exploitée pour un trophée).
    if (pl.plannedDate && completionValue.slice(0, 10) === pl.plannedDate) {
      stats.hasOnTimeCompletion = true;
    }

    // "Touche-à-Tout" — au moins une séance complétée de chacun des 3 types
    // d'activité "classiques" (volontairement PAS "Autre", qui est une case
    // fourre-tout sans identité propre).
    const trackedWorkoutTypes = new Set(stats.completedWorkoutTypes || []);
    if (['Course à pied', 'Musculation', 'Cyclisme'].includes(pl.workoutType)) {
      trackedWorkoutTypes.add(pl.workoutType);
      stats.completedWorkoutTypes = Array.from(trackedWorkoutTypes);
      if (trackedWorkoutTypes.size >= 3) stats.hasAllWorkoutTypes = true;
    }

    // "100 Bornes au Compteur" — distance CUMULÉE sur l'ensemble des séances
    // complétées (contrairement au Marathonien, qui porte sur une seule
    // séance ≥ 42km). Une séance basée sur le Temps (pas la Distance) a quand
    // même une distance implicite via son allure moyenne (`avgPace`, en
    // secondes/unité) — même calcul que celui déjà utilisé pour l'affichage
    // dans PlaylistCard.jsx. Conversion en km si l'unité de la playlist est
    // les miles, pour cumuler dans une seule unité cohérente.
    if (pl.avgPace) {
      const distInUnit = pl.totalDuration / pl.avgPace;
      const distKm = pl.distanceUnit === 'mi' ? distInUnit * 1.60934 : distInUnit;
      stats.totalDistanceKm = (stats.totalDistanceKm || 0) + distKm;
      if (stats.totalDistanceKm >= 100) stats.has100km = true;
    }

    // "Sur ta Lancée" — une séance complétée 3 jours calendaires D'AFFILÉE,
    // tous types et toutes playlists confondus. Reconstruit l'ensemble des
    // jours distincts ayant au moins une complétion (celle qu'on vient
    // d'ajouter incluse) à partir de TOUTES les playlists sauvegardées,
    // plutôt que de suivre un compteur séparé — plus simple et toujours exact,
    // même si des complétions sont retirées/ajoutées après coup ailleurs.
    const allCompletionDays = new Set();
    savedPlaylists.forEach(p => {
      const completions = p.id === playlistId ? updatedCompletions : (p.completions || []);
      completions.forEach(iso => allCompletionDays.add(iso.slice(0, 10)));
    });
    const sortedDays = Array.from(allCompletionDays).sort();
    let consecutive = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const diffDays = Math.round((new Date(sortedDays[i]) - new Date(sortedDays[i - 1])) / 86400000);
      consecutive = diffDays === 1 ? consecutive + 1 : 1;
      if (consecutive >= 3) { stats.hasStreak3 = true; break; }
    }

    // BUG CORRIGÉ : `stats.unlockedTrophies.length === userStats.unlockedTrophies.length`
    // comparait le même tableau à lui-même (checkTrophies ne mute jamais l'objet
    // reçu, voir useUserStats.js) — toujours vrai, donc le toast générique
    // ci-dessous s'affichait AUSSI après un déblocage de trophée et écrasait
    // silencieusement le toast "Trophée débloqué" (un seul toast à la fois).
    // On se fie maintenant à la valeur de retour de checkTrophies.
    const trophyUnlocked = checkTrophies(stats);
    if (!trophyUnlocked) {
      showToast(updatedCompletions.length > 1 ? `Séance re-marquée comme faite ! (${updatedCompletions.length}e fois) 💪` : "Session marquée comme terminée ! 💪");
    }
  };

  /**
   * Retire une date de complétion précise. Si c'était la DERNIÈRE restante, la
   * playlist n'a alors plus aucune complétion : elle quitte la section
   * "Terminées" et retourne dans "À planifier" (son statut n'est plus que
   * dérivé de la présence ou non de complétions, voir plus haut). On prévient
   * clairement de cette conséquence plutôt que de laisser l'utilisateur la
   * découvrir après coup — mais on laisse quand même l'action se faire,
   * puisque c'est explicitement ce qui est demandé.
   */
  const removeCompletionDate = (playlistId, isoDate) => {
    const pl = savedPlaylists.find(p => p.id === playlistId);
    if (!pl) return;
    const remaining = (pl.completions || []).filter(d => d !== isoDate);
    // Si des données Garmin/Strava étaient rattachées à CETTE date précise, on les
    // retire aussi — les garder n'aurait plus de sens sans la date de complétion
    // qu'elles étaient censées documenter.
    const remainingActualData = { ...(pl.actualDataByDate || {}) };
    delete remainingActualData[isoDate];

    setSavedPlaylists(savedPlaylists.map(p => p.id === playlistId ? { ...p, completions: remaining, actualDataByDate: remainingActualData } : p));

    if (remaining.length === 0) {
      showToast("Dernière date retirée : cette playlist n'a plus aucune complétion, elle repasse dans \"Mes Playlists\".", 'error');
    }
  };

  /**
   * Modifie une date de complétion existante (remplace oldIso par newIso).
   */
  const editCompletionDate = (playlistId, oldIso, newIso) => {
    if (!newIso || oldIso === newIso) return;
    setSavedPlaylists(savedPlaylists.map(p => {
      if (p.id !== playlistId) return p;
      const existing = p.completions || [];
      if (existing.includes(newIso)) { showToast("Cette date est déjà enregistrée."); return p; }
      const updated = existing.map(d => d === oldIso ? newIso : d).sort();
      // Si des données réelles étaient rattachées à l'ancienne date, on les
      // déplace vers la nouvelle plutôt que de les perdre.
      let updatedActualData = p.actualDataByDate || {};
      if (updatedActualData[oldIso] !== undefined) {
        updatedActualData = { ...updatedActualData };
        updatedActualData[newIso] = updatedActualData[oldIso];
        delete updatedActualData[oldIso];
      }
      return { ...p, completions: updated, actualDataByDate: updatedActualData };
    }));
  };

  return { markPlaylistAsCompleted, removeCompletionDate, editCompletionDate };
}
