import { useState, useEffect } from 'react';

/**
 * useElapsedTimer — chrono en secondes qui tourne tant que `isActive` est vrai,
 * repart de 0 à chaque nouvelle activation, s'arrête et se nettoie dès que
 * `isActive` repasse à faux (ou que le composant démonte).
 *
 * Avant ce hook, ce pattern était dupliqué deux fois dans App.jsx à
 * l'identique : une fois pour le chrono de génération (bandeau "Génération en
 * cours..."), une fois pour le chrono de recherche manuelle (modale de
 * recherche). Un seul hook réutilisé aux deux endroits maintenant.
 */
export function useElapsedTimer(isActive) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive) { setElapsedSeconds(0); return; }
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  return elapsedSeconds;
}
