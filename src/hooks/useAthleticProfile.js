import { usePersistentState } from './usePersistentState';

/**
 * useAthleticProfile — regroupe le "Profil Athlétique" de l'utilisateur : ses
 * 4 zones d'intensité de CADENCE musicale (BPM), pas de fréquence cardiaque
 * (voir la remarque terminologie plus bas). Persisté comme tout le reste via
 * `usePersistentState`, même convention que useFavorites/useUserStats/
 * useRoutines — un hook de domaine dédié plutôt que de mélanger ce state dans
 * un hook générique.
 *
 * ⚠️ TERMINOLOGIE (consigne explicite) : on parle de "Cadence" ou "Allure
 * musicale", JAMAIS de "Cardio" — ce mot est déjà pris par la fréquence
 * cardiaque réelle (voir useSessionAnalysis.js, l'analyse Cadence PPM vs FC
 * importée d'un Garmin/Strava). Réutiliser "Cardio" ici prêterait à confusion
 * avec cette autre donnée, bien distincte, pour un utilisateur sportif qui
 * fait déjà la différence entre les deux dans son vocabulaire habituel.
 *
 * Les 4 zones, du plus lent au plus rapide :
 *   zone1 — Récupération / Échauffement
 *   zone2 — Endurance fondamentale / Footing
 *   zone3 — Seuil / Tempo
 *   zone4 — Vitesse / VMA
 * Voir ATHLETIC_ZONES (appConfig.js) pour les libellés/couleurs d'affichage
 * partagés avec StatsView (répartition du temps par zone) — ce hook-ci ne
 * contient que les VALEURS BPM propres à l'utilisateur, pas ces métadonnées
 * d'affichage qui, elles, ne dépendent pas de l'utilisateur.
 *
 * `isConfigured` : distingue explicitement "l'utilisateur a réellement rempli
 * son profil au moins une fois" de "les zones ont une valeur par défaut
 * quelconque" — sert de garde-fou pour GeneratorView (pré-remplissage
 * Crescendo) ET StatsView (graphique de répartition par zone), qui ne
 * doivent ni l'un ni l'autre supposer un profil tant qu'il n'a pas été
 * explicitement configuré au moins une fois.
 */
export function useAthleticProfile() {
  const [athleticProfile, setAthleticProfile] = usePersistentState('athleticProfile', () => ({
    isConfigured: false,
    // Dernière cadence de footing lent saisie dans l'Assistant Rapide — gardée
    // à part des zones elles-mêmes pour pouvoir la ré-afficher/re-proposer
    // comme point de départ si l'utilisateur rouvre l'Assistant Rapide après
    // être déjà passé en mode Expert.
    baseCadence: null,
    zone1: null,
    zone2: null,
    zone3: null,
    zone4: null,
  }));

  // Plancher bas volontairement généreux (40 BPM) : même plancher que le mode
  // Intime ailleurs dans l'app (voir GeneratorView, bpmFloor) — sert seulement
  // à éviter une Zone 1 absurde si quelqu'un saisit une cadence de footing
  // très basse (ex. 45), jamais un vrai jugement sur ce qui est "trop lent".
  const ATHLETIC_BPM_FLOOR = 40;

  // Calcule les 4 zones par défaut à partir d'une seule cadence de référence
  // (footing lent) — Assistant Rapide, voir SettingsView.jsx. Espacement fixe
  // de 10 BPM par palier : simple à comprendre, ajustable ensuite au BPM près
  // en mode Expert pour qui veut affiner.
  const computeZonesFromBaseCadence = (base) => ({
    zone1: Math.max(ATHLETIC_BPM_FLOOR, base - 10),
    zone2: Math.max(ATHLETIC_BPM_FLOOR, base),
    zone3: Math.max(ATHLETIC_BPM_FLOOR, base + 10),
    zone4: Math.max(ATHLETIC_BPM_FLOOR, base + 20),
  });

  // Assistant Rapide : une seule saisie recalcule les 4 zones d'un coup.
  // Ignoré silencieusement si la valeur n'est pas un nombre positif exploitable
  // (champ vidé en cours de frappe, par exemple) plutôt que d'écraser le
  // profil existant avec des zones invalides.
  const setBaseCadence = (rawValue) => {
    const base = parseInt(rawValue);
    if (!Number.isFinite(base) || base <= 0) return;
    setAthleticProfile({ isConfigured: true, baseCadence: base, ...computeZonesFromBaseCadence(base) });
  };

  // Mode Expert : ajuste UNE zone à la fois, sans recalculer les 3 autres —
  // contrairement à setBaseCadence, qui repart de zéro sur les 4. Une fois
  // qu'une zone a été ajustée manuellement, elle n'est plus jamais recalculée
  // automatiquement (même philosophie "manuel = définitif" déjà appliquée au
  // BPM Échauffement/Retour au calme du mode Crescendo, voir
  // useGeneratorForm.js) — seul un nouveau passage par l'Assistant Rapide
  // réinitialise tout.
  const setZone = (zoneKey, rawValue) => {
    const value = parseInt(rawValue);
    setAthleticProfile(prev => ({
      ...prev,
      isConfigured: true,
      [zoneKey]: Number.isFinite(value) && value > 0 ? Math.max(ATHLETIC_BPM_FLOOR, value) : prev[zoneKey],
    }));
  };

  const resetAthleticProfile = () => setAthleticProfile({
    isConfigured: false, baseCadence: null, zone1: null, zone2: null, zone3: null, zone4: null,
  });

  return {
    athleticProfile, setAthleticProfile,
    computeZonesFromBaseCadence, setBaseCadence, setZone, resetAthleticProfile,
  };
}
