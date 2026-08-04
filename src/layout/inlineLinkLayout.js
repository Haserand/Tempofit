// Style des liens texte "ce lien t'emmène ailleurs dans l'app" — CENTRALISÉ
// (04/08, retour direct : "j'aimerais bien utiliser la même flèche et
// souligner mon texte configurer BPM, comme pour synchroniser mes comptes,
// ça peut pas être des conventions pour tous ces types de bouton ?").
//
// Audit réalisé à cette occasion sur TOUS les liens de ce type dans l'app :
// la convention existait déjà en pratique à 4 endroits (StatsView.jsx —
// "Aller à Mes Séances →", "Voir l'aperçu de mon profil public →", "Gérer
// ma visibilité →", "Configurer mon Profil Athlétique →" — et FavoritesView.jsx
// — "Synchroniser mes comptes →", le modèle cité par l'utilisateur) mais
// jamais formalisée : chaque bouton répétait `font-bold underline` en dur.
// Un seul VRAI outlier trouvé : "Configurer mes zones BPM →"
// (GeneratorWizard.jsx), ajouté le même jour un peu plus tôt dans cette
// session, avec une icône `Gauge` et SANS soulignement par défaut
// (`hover:underline` seulement) — corrigé pour rejoindre la convention
// (icône retirée, soulignement permanent comme partout ailleurs).
//
// RÈGLE pour un futur lien de ce type : texte se terminant par ` →` (flèche
// unicode simple, PAS une icône `ArrowRight` séparée — aucune des
// occurrences existantes n'en utilise une), `${INLINE_NAV_LINK_CLASS}
// ${textColorClass}` + une taille de texte au choix du contexte (`text-sm`
// dans la majorité des cas, `text-xs` déjà vu dans un encart plus dense —
// volontairement PAS fixée ici, une seule valeur aurait été fausse dans au
// moins un cas réel déjà en place).
//
// Centralisé ici plutôt que répété en dur à chaque lien : un futur
// changement de ce choix esthétique se ferait à CET unique endroit — même
// raisonnement que `ICON_BUTTON_ROUNDING` (iconButtonLayout.js), déjà
// établi dans ce dossier.
export const INLINE_NAV_LINK_CLASS = 'font-bold underline';
