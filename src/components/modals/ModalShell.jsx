/**
 * ModalShell.jsx — conteneur partagé pour les modales de ce projet
 * (fond + carte), extrait le 22/08.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE — même principe que `BottomBarShell.jsx`
 * (extrait plus tôt cette session, voir sa docstring et la Convention UI
 * du README, "Une recette de mise en page recopiée... dérive") : les 12
 * fichiers de modales de ce projet (`AuthModal.jsx`, `CustomActivityModal.jsx`,
 * `EditPlaylistModal.jsx`, `EditRoutineModal.jsx`, `ImportSharedPlaylistModal.jsx`,
 * `PendingNavigationModal.jsx`, `PendingUnsaveModal.jsx`,
 * `PublicRoutinePreviewModal.jsx`, `SavingRoutineModal.jsx`, `SearchModal.jsx`,
 * `SearchUsersModal.jsx`, `ShareModal.jsx`) recopiaient TOUS, chacun
 * indépendamment, le MÊME littéral exact pour le fond
 * (`"fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60
 * backdrop-blur-xs"`) — une duplication encore plus large que celle de
 * `BottomBarShell.jsx` (12 fichiers au lieu de 2), trouvée en cherchant
 * délibérément ce genre de motif après la question directe "est-ce que tu
 * vois d'autres composants partagés à extraire ?". Contrairement au fond
 * (identique partout), la carte interne variait légèrement d'un fichier à
 * l'autre (largeur max, padding, `flex flex-col` + hauteur max pour les
 * modales scrollables) — ces variations restent des points de
 * personnalisation explicites ici (`maxWidth`/`cardClassName`), pas
 * unifiées de force.
 *
 * ⚠️ SEULE la coquille structurelle (fond + carte) est extraite ICI — pas
 * l'en-tête (icône + titre + croix de fermeture), qui varie trop pour
 * être une vraie "recette" unique : 2 modales sur les 12
 * (`PendingNavigationModal.jsx`/`PendingUnsaveModal.jsx`) utilisent un
 * en-tête complètement différent (icône d'alerte + texte, sans croix de
 * fermeture dans l'en-tête — la fermeture s'y fait via les boutons du
 * pied de page). Forcer un en-tête commun aurait donc soit cassé ces 2
 * modales, soit ajouté une branche conditionnelle dans le composant
 * partagé — moins clair qu'un simple `children` qui laisse chaque
 * appelant entièrement libre sur son contenu.
 *
 * `onClick={onClose}` sur le fond + `onClick={e => e.stopPropagation()}`
 * sur la carte : ferme la modale au clic EXTÉRIEUR à la carte, jamais au
 * clic À L'INTÉRIEUR — comportement IDENTIQUE dans les 12 fichiers
 * d'origine, préservé tel quel ici.
 */
export default function ModalShell({ onClose, theme, maxWidth = 'max-w-md', cardClassName = 'p-8', children }) {
  const { cardBg, cardBorder } = theme;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div className={`${cardClassName} rounded-3xl w-full ${maxWidth} shadow-2xl border ${cardBg} ${cardBorder}`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
