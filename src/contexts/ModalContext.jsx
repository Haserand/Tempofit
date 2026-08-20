import { createContext, useContext, useState, useCallback, useMemo } from 'react';

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
 * 2. Migration faite en plusieurs passes, au fil de la session du 25/07 —
 *    toutes les modales sauf 2 sont maintenant sur ModalContext : AUTH,
 *    IMPORT_SHARED_PLAYLIST, PENDING_NAVIGATION, PENDING_UNSAVE (rendues par
 *    ModalContainer.jsx), SAVING_ROUTINE, EDIT_ROUTINE (état dérivé dans
 *    useRoutines.js), SHARE (dérivé dans useShare.js), SEARCH (dérivé dans
 *    App.jsx). Volontairement PAS migrées : CustomActivityModal (déjà
 *    autonome via GeneratorContext, rien à gagner) et IconPickerModal
 *    (supprimée — jamais déclenchée nulle part dans le projet, fonctionnalité
 *    morte confirmée, sans rapport avec ce chantier).
 *
 * Chaque modale garde son booléen d'ouverture dérivé LÀ où son état vit déjà
 * (App.jsx, useRoutines.js, useShare.js) plutôt que rendue systématiquement
 * via ModalContainer.jsx — le faire transiter par un composant central sans
 * bénéfice réel aurait juste déplacé la complexité, pas réduit.
 *
 * ⚠️ CORRIGÉ (19/08, check-up global) — `closeModal()` ferme désormais SCOPÉ
 * à un nom de modale optionnel : `closeModal('SHARE')` ne fait rien si une
 * AUTRE modale est devenue active entre-temps, `closeModal()` sans argument
 * garde l'ancien comportement (ferme sans condition). Avant ce correctif,
 * `closeModal()` ne prenait aucun argument et fermait TOUJOURS sans
 * condition — un commentaire ici affirmait à tort qu'un filet de sécurité
 * existait déjà ("ne vide QUE si la modale fermée est bien celle
 * actuellement active"), alors qu'aucun appelant ne lui passait de nom.
 * Risque réel identifié : `shareNative()`/`copyToClipboard()` (`useShare.js`)
 * attendent une opération asynchrone (`navigator.share()` — boîte de
 * dialogue système pouvant rester ouverte un moment — ou l'écriture presse-
 * papier) AVANT de fermer ; si l'utilisateur ouvre une AUTRE modale pendant
 * cette attente, l'ancien `closeModal()` inconditionnel la fermerait par
 * erreur au lieu de ne rien faire. Seuls `useShare.js` (`copyToClipboard`/
 * `shareNative`, modale `'SHARE'`) ont un vrai `await` entre l'ouverture et
 * la fermeture — vérifié sur les 8 appelants du projet
 * (`useRoutines.js`/`useRoutineActions.js`/`useDeezerSearch.js`/`App.jsx`/
 * `PlaylistEditContext.jsx` ferment tous de façon strictement synchrone,
 * sans fenêtre de course possible : `closeModal()` sans argument y reste
 * correct, pas la peine de leur ajouter un nom par réflexe).
 */
const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  // Combinés en UN SEUL state (plutôt que 2 useState séparés comme avant ce
  // correctif) : `closeModal(name)` a besoin de lire `activeModal` ET
  // `modalData` de façon ATOMIQUE au moment de la vérification, dans le
  // MÊME functional updater — 2 state séparés n'auraient pas permis à la
  // fonction updater de `modalData` de consulter la valeur courante
  // d'`activeModal` pour décider si elle doit se vider ou non.
  const [modalState, setModalState] = useState({ name: null, data: null }); // name: null | 'AUTH' | 'IMPORT_SHARED_PLAYLIST' | 'PENDING_NAVIGATION' | 'PENDING_UNSAVE' | ...

  const openModal = useCallback((name, data = null) => {
    setModalState({ name, data });
  }, []);

  // `name` optionnel — voir la docstring plus haut pour le détail complet
  // du comportement scopé vs legacy.
  const closeModal = useCallback((name) => {
    setModalState(current => {
      if (name !== undefined && current.name !== name) return current; // pas la modale attendue : ne rien faire
      return { name: null, data: null };
    });
  }, []);

  // `useMemo` (08/08, chantier "value non mémoïsée re-render tout le
  // monde") — sûr et complet ICI (contrairement à PlaylistDetailContext.jsx,
  // qui a eu besoin d'un vrai découpage en 2 Contextes) : les 4 champs de
  // cette valeur sont soit du state simple qui ne change QUE quand une
  // modale s'ouvre/se ferme (`modalState`, pas à chaque frappe dans un
  // formulaire — chaque modale garde SON PROPRE state de formulaire
  // ailleurs, voir la docstring plus haut), soit déjà stables par eux-mêmes
  // (`openModal`/`closeModal`, `useCallback([])`). Ce `useMemo` élimine donc
  // un objet `value` neuf à CHAQUE rendu de n'importe quel composant qui
  // monte `<ModalProvider>` au-dessus de lui (React.StrictMode/re-render du
  // parent), même quand aucune modale ne change réellement d'état.
  const value = useMemo(
    () => ({ activeModal: modalState.name, modalData: modalState.data, openModal, closeModal }),
    [modalState, openModal, closeModal],
  );

  return (
    <ModalContext.Provider value={value}>
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
