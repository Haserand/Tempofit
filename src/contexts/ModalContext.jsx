import { createContext, useContext, useState, useCallback } from 'react';

/**
 * ModalContext — source de vérité UNIQUE pour "quelle modale est ouverte en ce
 * moment" (`activeModal`, une chaîne parmi les noms ci-dessous ou `null`) et les
 * données dont elle a besoin pour s'afficher (`modalData`).
 *
 * Chantier "centraliser les modales" (25/07), suggestion initiale de Gemini,
 * vérifiée puis adaptée avant implémentation — voir la discussion : le plan
 * d'origine sous-estimait 2 points réels du code actuel, corrigés ici :
 *
 * 1. `modalData` n'a PAS de forme fixe/générique — chaque type de modale reçoit
 *    exactement le sac de props dont ELLE a besoin, assemblé par l'appelant au
 *    moment de `openModal(name, data)`. Un payload générique unique aurait
 *    obligé un composant central à connaître/rassembler les props de TOUTES les
 *    modales (10 signatures différentes, aucune ne se ressemble) — le problème
 *    aurait juste déménagé dans ce composant plutôt que d'être réduit.
 * 2. Cette 1ère passe ne couvre QUE les modales dont le déclenchement était déjà
 *    simple (état local à App.jsx, ou dérivé d'un flux "confirmation en
 *    attente" — voir PENDING_NAVIGATION/PENDING_UNSAVE ci-dessous) :
 *    AUTH, IMPORT_SHARED_PLAYLIST, PENDING_NAVIGATION, PENDING_UNSAVE.
 *    Volontairement PAS migrées ici : SavingRoutineModal/EditRoutineModal (état
 *    possédé par `useRoutines()`, migrer casserait la source de vérité unique
 *    de ce hook sans bénéfice clair) et ShareModal/SearchModal (déclenchées
 *    depuis plusieurs composants différents, mélangées à de l'état persistant
 *    de hooks singleton comme useTrackSearch — périmètre plus large, à traiter
 *    séparément).
 *
 * `closeModal` ne vide QUE si la modale fermée est bien celle actuellement
 * active — filet de sécurité contre une fermeture tardive (ex. un timeout) qui
 * fermerait par erreur une AUTRE modale ouverte entre-temps.
 */
const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null); // null | 'AUTH' | 'IMPORT_SHARED_PLAYLIST' | 'PENDING_NAVIGATION' | 'PENDING_UNSAVE'
  const [modalData, setModalData] = useState(null);

  const openModal = useCallback((name, data = null) => {
    setActiveModal(name);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  return (
    <ModalContext.Provider value={{ activeModal, modalData, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModalContext() {
  const ctx = useContext(ModalContext);
  // Filet de sécurité (même convention que useGeneratorContext/useAudioPlayer) :
  // un composant utilisé hors de <ModalProvider> (ex. dans un test isolé) reçoit
  // des no-op plutôt qu'un crash immédiat sur `undefined`.
  if (!ctx) {
    return { activeModal: null, modalData: null, openModal: () => {}, closeModal: () => {} };
  }
  return ctx;
}
