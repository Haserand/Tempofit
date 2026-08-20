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
 * ⚠️ CORRIGÉ (19/08, check-up global) — `closeModal()` ne prenait aucun
 * argument et fermait TOUJOURS sans condition, même appelé tardivement
 * après un `await`. Un commentaire ici affirmait à tort qu'un filet de
 * sécurité existait déjà ("ne vide QUE si la modale fermée est bien celle
 * actuellement active"), alors qu'aucun appelant ne lui passait de nom.
 * Risque réel identifié : `shareNative()`/`copyToClipboard()` (`useShare.js`)
 * attendent une opération asynchrone (`navigator.share()` — boîte de
 * dialogue système pouvant rester ouverte un moment — ou l'écriture presse-
 * papier) AVANT de fermer ; si l'utilisateur ouvrait une AUTRE modale
 * pendant cette attente, l'ancien `closeModal()` inconditionnel la fermait
 * par erreur au lieu de ne rien faire.
 *
 * ⚠️ 1er CORRECTIF CASSÉ EN PRODUCTION (même jour, rattrapé par le build
 * Vercel réel AVANT tout déploiement — voir les logs collés dans la
 * conversation) : la 1ère version de ce correctif avait fait de `closeModal`
 * une fonction À UN SEUL paramètre `name` OPTIONNEL — `closeModal(name)`
 * scopé si fourni, `closeModal()` legacy sinon. Ça casse silencieusement
 * PARTOUT où `closeModal` (ou `closeEditPlaylistModal`, son alias dans
 * PlaylistEditContext.jsx) est branché DIRECTEMENT comme handler JSX
 * (`onClick={closeModal}`, `onClose={closeModal}` — 12 endroits dans le
 * projet, `ModalContainer.jsx`/`App.jsx`/`EditPlaylistModal.jsx`) : React
 * appelle alors la fonction avec l'OBJET ÉVÉNEMENT comme 1er argument, qui
 * devenait `name` — `name !== undefined` était vrai (l'événement n'est pas
 * `undefined`), donc la modale ne se fermait JAMAIS. Détecté par
 * `tests/contexts/PlaylistEditContext.test.jsx` (test déjà existant, pas
 * un nouveau test ajouté pour ce correctif) : "ferme la modale sans appeler
 * setCurrentPlaylist/setSavedPlaylists" — `editing-state` restait `true`
 * après clic sur "Annuler".
 *
 * CORRECTIF DÉFINITIF : 2 fonctions bien SÉPARÉES plutôt qu'un paramètre
 * optionnel ambigu.
 *   - `closeModal()` — ZÉRO paramètre déclaré, ferme TOUJOURS sans
 *     condition. Sûre à brancher DIRECTEMENT en JSX (`onClick={closeModal}`)
 *     : un paramètre non déclaré dans la signature d'une fonction JS est
 *     simplement IGNORÉ, peu importe ce que l'appelant lui passe (React
 *     peut bien lui passer l'objet événement, cette fonction ne le regarde
 *     jamais). Comportement légataire, inchangé pour les 8 appelants
 *     synchrones (`useRoutines.js`/`useRoutineActions.js`/
 *     `useDeezerSearch.js`/`App.jsx`/`PlaylistEditContext.jsx`), tous sans
 *     risque de course (voir plus haut).
 *   - `closeModalIfActive(name)` — même comportement scopé qu'avant, mais
 *     sous un NOM DISTINCT qui rend impossible de la confondre avec un
 *     handler JSX direct : réservée aux 2 SEULS appelants ayant un vrai
 *     `await` avant de fermer (`copyToClipboard`/`shareNative`,
 *     `useShare.js`) — jamais branchée directement en `onClick`/`onClose`
 *     nulle part dans le projet, seulement appelée explicitement avec un
 *     nom littéral.
 */
const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  // Combinés en UN SEUL state (plutôt que 2 useState séparés comme avant ce
  // correctif) : `closeModalIfActive(name)` a besoin de lire `activeModal`
  // ET `modalData` de façon ATOMIQUE au moment de la vérification, dans le
  // MÊME functional updater — 2 state séparés n'auraient pas permis à la
  // fonction updater de `modalData` de consulter la valeur courante
  // d'`activeModal` pour décider si elle doit se vider ou non.
  const [modalState, setModalState] = useState({ name: null, data: null }); // name: null | 'AUTH' | 'IMPORT_SHARED_PLAYLIST' | 'PENDING_NAVIGATION' | 'PENDING_UNSAVE' | ...

  const openModal = useCallback((name, data = null) => {
    setModalState({ name, data });
  }, []);

  // ZÉRO paramètre déclaré — voir la docstring plus haut pour pourquoi
  // c'est essentiel (sûre à brancher directement en JSX).
  const closeModal = useCallback(() => {
    setModalState({ name: null, data: null });
  }, []);

  // Nom délibérément DISTINCT de `closeModal` (pas un paramètre optionnel
  // dessus) — voir la docstring plus haut, "CORRECTIF DÉFINITIF". NE JAMAIS
  // brancher directement en `onClick`/`onClose` (même piège que
  // `closeModal(name)` avant ce correctif si on le faisait).
  const closeModalIfActive = useCallback((name) => {
    setModalState(current => (current.name === name ? { name: null, data: null } : current));
  }, []);

  // `useMemo` (08/08, chantier "value non mémoïsée re-render tout le
  // monde") — sûr et complet ICI (contrairement à PlaylistDetailContext.jsx,
  // qui a eu besoin d'un vrai découpage en 2 Contextes) : les 5 champs de
  // cette valeur sont soit du state simple qui ne change QUE quand une
  // modale s'ouvre/se ferme (`modalState`, pas à chaque frappe dans un
  // formulaire — chaque modale garde SON PROPRE state de formulaire
  // ailleurs, voir la docstring plus haut), soit déjà stables par eux-mêmes
  // (`openModal`/`closeModal`/`closeModalIfActive`, `useCallback([])`). Ce
  // `useMemo` élimine donc un objet `value` neuf à CHAQUE rendu de
  // n'importe quel composant qui monte `<ModalProvider>` au-dessus de lui
  // (React.StrictMode/re-render du parent), même quand aucune modale ne
  // change réellement d'état.
  const value = useMemo(
    () => ({ activeModal: modalState.name, modalData: modalState.data, openModal, closeModal, closeModalIfActive }),
    [modalState, openModal, closeModal, closeModalIfActive],
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
    return { activeModal: null, modalData: null, openModal: () => {}, closeModal: () => {}, closeModalIfActive: () => {} };
  }
  return ctx;
}
