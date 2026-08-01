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
 * FUSION (01/08, suite — chantier proposé en fin de session précédente,
 * "quasi-identiques, seul /svg vs /png change") — `buildCoverUrl` et
 * `buildCoverUrlPng` restent 2 fonctions PUBLIQUES distinctes (même
 * signature, même comportement, mêmes noms qu'avant : rien ne change côté
 * appelants ni côté tests/coverArt.test.js, qui importe les deux noms
 * explicitement) — seule l'implémentation est maintenant partagée via
 * `buildCoverUrlForFormat`, pour ne plus avoir 2 copies de la même
 * construction d'URL (palette + encodage du seed) à maintenir en parallèle.
 */

// Palette volontairement large et variée (12 teintes) — sans elle, DiceBear
// piochait dans son propre choix par défaut, visiblement étroit (bleu/
// orange/crème qui revenaient sur presque toutes les pochettes). Format hex
// SANS le "#" (attendu tel quel par le paramètre backgroundColor de l'API).
const COVER_BACKGROUND_COLORS = [
  'f87171', 'fb923c', 'fbbf24', 'a3e635', '4ade80', '2dd4bf',
  '38bdf8', '818cf8', 'a78bfa', 'e879f9', 'fb7185', '94a3b8',
].join(',');

// Builder interne partagé — NON exporté, `format` toujours fourni par les
// 2 fonctions publiques ci-dessous, jamais par un appelant externe (qui n'a
// pas à savoir que ce détail existe).
const buildCoverUrlForFormat = (seed, format) => {
  // `encodeURIComponent` : le titre peut contenir des espaces/apostrophes
  // ("Powerlifter's Anthem") — doivent être encodés proprement dans l'URL.
  return `https://api.dicebear.com/10.x/shapes/${format}?seed=${encodeURIComponent(seed)}&backgroundColor=${COVER_BACKGROUND_COLORS}`;
};

export const buildCoverUrl = (seed) => buildCoverUrlForFormat(seed, 'svg');

/**
 * Variante PNG de buildCoverUrl — RÉSERVÉE au pipeline de capture
 * html2canvas (voir generateSummaryImageFile, PlaylistDetailView.jsx),
 * jamais utilisée pour l'affichage normal à l'écran (qui reste sur
 * buildCoverUrl/SVG ci-dessus : net à toute taille, plus léger — aucune
 * raison d'y renoncer là où html2canvas n'entre pas en jeu).
 *
 * BUG CORRIGÉ (01/08, suite — "la génération s'arrête en moins d'une
 * seconde, sans la moindre erreur") — au-delà du piège CORS déjà corrigé
 * (résolution en data URI), html2canvas a un problème plus fondamental et
 * documenté avec le rendu des <img> pointant vers du SVG, MÊME en data
 * URI : son support SVG interne est connu pour être incomplet, et peut
 * échouer silencieusement (aucune exception levée, juste un rendu qui
 * n'aboutit jamais) plutôt que de lever une erreur propre — exactement
 * le symptôme observé. Demander directement un PNG à DiceBear (l'API le
 * permet nativement, un simple changement de segment d'URL) évite le
 * problème à la source, sans conversion côté client.
 */
export const buildCoverUrlPng = (seed) => buildCoverUrlForFormat(seed, 'png');
