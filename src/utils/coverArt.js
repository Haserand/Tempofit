/**
 * coverArt.js — Construction de l'URL de pochette générée (art abstrait
 * géométrique, style DiceBear "shapes" — https://www.dicebear.com/styles/shapes/,
 * vérifié à jour, version 10.x).
 *
 * RETOUR DIRECT ("la pochette disparaît en arrivant sur la fiche détail
 * d'une playlist ensemencée") — cette fonction vivait avant UNIQUEMENT dans
 * TemplateCard.jsx (DiscoverView). Elle est extraite ici pour être
 * réutilisée TELLE QUELLE par App.jsx (`openCuratedPlaylist`), qui doit
 * calculer la MÊME URL pour la poser sur `playlist.coverUrl` au moment
 * d'ouvrir la playlist — sans ça, PlaylistDetailView.jsx n'aurait jamais eu
 * cette donnée du tout (elle n'est stockée nulle part dans
 * data/curatedSessions.js, volontairement, voir ce fichier). Un seul
 * endroit pour la palette de couleurs et le format d'URL : si l'un des deux
 * change un jour, TemplateCard.jsx et App.jsx restent forcément synchronisés.
 *
 * Déterministe par nature (même seed = même image) : recalculer cette URL
 * une 2e fois (dans App.jsx) à partir du même titre renvoie systématiquement
 * l'IDENTIQUE pochette que celle déjà vue dans la grille de Découverte —
 * pas besoin de "transmettre" la valeur via un state ou des props, la
 * reproduire suffit.
 */

// Palette volontairement large et variée (12 teintes) — sans elle, DiceBear
// piochait dans son propre choix par défaut, visiblement étroit (bleu/
// orange/crème qui revenaient sur presque toutes les pochettes). Format hex
// SANS le "#" (attendu tel quel par le paramètre backgroundColor de l'API).
const COVER_BACKGROUND_COLORS = [
  'f87171', 'fb923c', 'fbbf24', 'a3e635', '4ade80', '2dd4bf',
  '38bdf8', '818cf8', 'a78bfa', 'e879f9', 'fb7185', '94a3b8',
].join(',');

export const buildCoverUrl = (seed) => {
  // `encodeURIComponent` : le titre peut contenir des espaces/apostrophes
  // ("Powerlifter's Anthem") — doivent être encodés proprement dans l'URL.
  return `https://api.dicebear.com/10.x/shapes/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${COVER_BACKGROUND_COLORS}`;
};
