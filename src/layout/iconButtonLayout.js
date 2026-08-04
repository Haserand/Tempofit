// Rayon de bordure des boutons "icône SEULE" (pas de libellé texte à côté)
// — CENTRALISÉ (03/08, retour direct, 2 captures d'écran : "pour certains
// boutons la zone de survol... est carrée ; pour d'autres rondes... il
// faudrait harmoniser").
//
// Audit réalisé à cette occasion sur TOUS les boutons icône-seule de
// l'app : 3 rayons différents en circulation sur des boutons visuellement
// équivalents (`rounded-lg`, `rounded-xl`, `rounded-full`) — seuls le
// bouton Thème et le bouton Trophées (Sidebar.jsx) et le hamburger mobile
// (App.jsx) divergeaient réellement de la majorité déjà en place (avatar/
// connexion — App.jsx —, les 4 boutons de MiniPlayerBar.jsx, les 9
// boutons de fermeture de modale ×, et le bouton de suppression du bilan
// visuel de ShareModal.jsx — tous déjà `rounded-full` avant ce chantier).
//
// RÈGLE, binaire, facile à retenir pour un futur bouton :
//   - Icône SEULE (aucun texte visible à côté)      → `ICON_BUTTON_ROUNDING`
//     (cette constante, `rounded-full`)
//   - Icône + libellé texte (ex. liens de la Sidebar,
//     bouton Réglages)                               → `rounded-xl` en dur,
//     déjà 100% cohérent partout, pas besoin d'une constante dédiée pour
//     celui-là (une seule valeur, jamais divergée, contrairement au cas
//     icône-seule qui a motivé ce fichier).
//
// Centralisé ici plutôt que répété en dur à chaque bouton : un futur
// changement de ce choix esthétique (ex. passer à `rounded-2xl` partout)
// se ferait à CET unique endroit, jamais fichier par fichier — même
// raisonnement que `SIDEBAR_LINK_PADDING`/`VIEW_HEADER_ICON_SIZE`
// (sidebarLayout.js/viewHeaderLayout.js), déjà établi dans ce dossier.
export const ICON_BUTTON_ROUNDING = 'rounded-full';
