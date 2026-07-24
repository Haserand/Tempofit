/**
 * favoritesNormalize.js — Migration défensive de la forme de stockage des
 * favoris, extraite de useFavorites.js (retour recul session dette
 * technique) pour être testable isolément.
 *
 * Un favoris déjà enregistré AVANT le chantier "cloisonnement Mode Intime"
 * a l'ancienne forme PLATE ({useFavorites, artists, tracks}, sans
 * distinction de mode). Cette fonction la convertit vers la forme actuelle
 * ({useFavorites, standard: {artists, tracks}, naughty: {artists, tracks}})
 * en traitant l'ancien contenu comme le bucket "standard" — plutôt que de
 * planter sur `.standard`/`.naughty` absents (`undefined`), avec un bucket
 * "naughty" vide à côté.
 *
 * C'est exactement le genre d'endroit où un bug est catastrophique (perte
 * silencieuse des favoris d'un utilisateur existant) et où un test vaut le
 * plus cher — d'où l'extraction, même si useFavorites.js reste le seul
 * appelant réel à ce jour.
 */
export const normalizeFavorites = (raw) => (!raw.standard && !raw.naughty)
  ? { useFavorites: raw.useFavorites, standard: { artists: raw.artists || [], tracks: raw.tracks || [] }, naughty: { artists: [], tracks: [] } }
  : raw;
