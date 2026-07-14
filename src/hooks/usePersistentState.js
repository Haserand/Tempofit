import { useState, useEffect } from 'react';

// Préfixe commun à toutes les clés TempoFit dans localStorage — évite toute
// collision avec d'autres données que le navigateur pourrait stocker sur ce
// même domaine (peu probable en pratique, mais coûte rien à préciser).
const STORAGE_PREFIX = 'tempofit:';

/**
 * usePersistentState — se comporte exactement comme `useState`, mais la
 * valeur est automatiquement lue depuis `localStorage` au montage et
 * réécrite à chaque changement. Persistance "Niveau 1" (voir échange avec
 * l'utilisateur) : locale à CE navigateur/appareil, aucun compte, aucun
 * serveur — mais F5/fermeture de l'onglet ne perd plus rien.
 *
 * `initialValue` peut être une valeur directe ou une fonction (paresseuse,
 * comme pour `useState`) — n'est utilisée QUE si rien n'est encore stocké
 * pour cette clé (première visite, ou storage vidé). C'est ce qui permet de
 * garder les données de démonstration actuelles (playlist d'exemple,
 * favoris de départ...) pour un nouvel utilisateur, tout en les ignorant
 * silencieusement dès qu'un vrai historique existe.
 *
 * Échecs silencieux volontaires (quota dépassé, navigation privée qui bloque
 * localStorage, JSON corrompu...) : l'app continue de fonctionner en mémoire
 * pour la session en cours plutôt que de planter — la persistance est un
 * confort, pas une dépendance dure.
 */
export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return typeof initialValue === 'function' ? initialValue() : initialValue;
      return JSON.parse(raw);
    } catch (e) {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
    } catch (e) {
      // Échec silencieux (voir docstring) — pas de showToast ici volontairement :
      // ce hook est utilisé par plusieurs autres hooks indépendants qui n'ont pas
      // tous accès à showToast, et une erreur de quota localStorage à chaque
      // frappe serait de toute façon plus gênante qu'utile.
    }
  }, [key, state]);

  return [state, setState];
}
