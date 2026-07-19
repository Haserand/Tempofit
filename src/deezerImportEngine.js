/**
 * deezerImportEngine.js — Récupération de la bibliothèque Deezer de
 * l'utilisateur (titres favoris + artistes suivis), miroir de
 * spotifyEngine.js pour la même fonctionnalité côté Spotify.
 *
 * Ne couvre PAS l'authentification OAuth (login, échange de code contre un
 * token) : ça reste dans useDeezerImport.js, propre à l'écran et au flow de
 * redirection navigateur — même découpage que spotifyEngine.js/
 * useSpotifyImport.js.
 *
 * PLUS SIMPLE que spotifyEngine.js sur un point clé : Spotify ne fournit
 * aucun BPM, il faut donc une cascade de recherche FLOUE (titre/artiste) vers
 * Deezer puis GetSongBPM pour tenter de retrouver le bon titre et son tempo
 * (voir resolveRealBPM, spotifyEngine.js). Ici, chaque titre importé est
 * DÉJÀ un vrai titre Deezer avec son ID exact — `GET /track/{id}` suffit,
 * aucune recherche floue, aucun risque de mauvaise correspondance
 * titre/artiste. Le seul vrai flou qui reste : Deezer ne renseigne pas
 * toujours le champ `bpm` sur un titre donné (catalogue incomplet, cas
 * documenté ailleurs dans musicEngine.js) — repli sur `detectBpmFromPreview`
 * (détection réelle par analyse audio du extrait, déjà utilisée dans le
 * moteur de génération pour ce même problème) avant l'ultime repli
 * mathématique, plutôt qu'une simple estimation comme dernier recours direct.
 *
 * Même principe que spotifyEngine.js : fonctions PURES (réseau + calcul,
 * aucun state React touché) — l'appelant (useDeezerImport.js) applique le
 * résultat reçu (setFavorites, toasts, gestion d'erreur).
 */

import { deezerFetch, resolveDeezerGenre, detectBpmFromPreview } from './musicEngine';

export const DEEZER_API_BASE = 'https://api.deezer.com';

/**
 * Récupère les titres favoris Deezer en suivant la pagination (`next`,
 * fournie directement par Deezer — même mécanisme que fetchAllLikedTracks
 * dans spotifyEngine.js). Plafonné à `maxTracks` pour la même raison :
 * au-delà, chaque titre coûte un appel réseau supplémentaire de résolution
 * BPM/genre.
 *
 * ⚠️ Deezer renvoie ses erreurs (token invalide/révoqué...) DANS le corps
 * JSON avec un statut HTTP 200, pas via un code d'erreur HTTP dédié — d'où
 * la vérification de `data.error` plutôt qu'un simple `res.status`.
 */
export const fetchAllDeezerFavoriteTracks = async (token, maxTracks = 200) => {
  let allTracks = [];
  let url = `${DEEZER_API_BASE}/user/me/tracks?access_token=${encodeURIComponent(token)}&limit=50`;
  while (url && allTracks.length < maxTracks) {
    const { data } = await deezerFetch(url);
    if (data && data.error) throw new Error("Token Deezer invalide");
    const items = data && Array.isArray(data.data) ? data.data : [];
    allTracks = allTracks.concat(items);
    url = data && data.next ? data.next : null;
  }
  return allTracks.slice(0, maxTracks);
};

// Récupère les artistes réellement SUIVIS par l'utilisateur — échec silencieux
// (tableau vide) plutôt que de faire échouer toute la synchro pour cette seule
// source secondaire, même principe que fetchFollowedArtists (spotifyEngine.js).
//
// `/user/me/followings` mélange artistes ET utilisateurs Deezer suivis (amis) —
// contrairement à Spotify qui a un endpoint dédié `type=artist`, ici il faut
// filtrer nous-mêmes sur `type === 'artist'` (chaque entrée porte ce champ),
// sinon des noms de comptes utilisateurs Deezer s'inviteraient dans les
// artistes favoris de l'app.
export const fetchDeezerFollowedArtists = async (token) => {
  try {
    const { data } = await deezerFetch(`${DEEZER_API_BASE}/user/me/followings?access_token=${encodeURIComponent(token)}`);
    const items = data && Array.isArray(data.data) ? data.data : [];
    return items.filter(a => a.type === 'artist' && a.name).map(a => a.name);
  } catch (e) {
    return [];
  }
};

/**
 * Récupère titres favoris + artistes suivis, SANS résoudre BPM/genre —
 * permet à l'appelant de vérifier s'il y a quoi que ce soit à traiter avant
 * de lancer la résolution, potentiellement coûteuse. Même découpage que
 * fetchSpotifyRawData (spotifyEngine.js).
 */
export const fetchDeezerRawData = async (token) => {
  const [rawTracks, followedArtistNames] = await Promise.all([
    fetchAllDeezerFavoriteTracks(token),
    fetchDeezerFollowedArtists(token),
  ]);
  return { rawTracks, followedArtistNames };
};

/**
 * Résout le BPM réel + genre de chaque titre Deezer brut. Pure : aucun
 * setState, aucune lecture de state React — même contrat que
 * resolveTracksBpm (spotifyEngine.js).
 *
 * Cascade BPM, du plus fiable au plus grossier :
 *   1. `bpm` déjà présent dans la réponse de la liste des favoris (le cas le
 *      plus courant, aucun appel réseau supplémentaire).
 *   2. Sinon, un appel `GET /track/{id}` dédié — la liste des favoris omet
 *      parfois ce champ même quand il existe réellement sur le titre.
 *   3. Sinon, détection réelle par analyse audio de l'extrait 30s
 *      (`detectBpmFromPreview`, déjà utilisée ailleurs pour ce même
 *      problème de catalogue Deezer incomplet) — fenêtre large (40-220,
 *      les bornes BPM valides de toute l'app) puisqu'il n'y a pas de cible
 *      précise à ce stade (pas une recherche, un import de bibliothèque).
 *   4. Ultime repli mathématique (comme resolveRealBPM, spotifyEngine.js) si
 *      même l'analyse audio échoue (pas d'extrait disponible, etc.) — pour
 *      ne jamais bloquer la synchro sur UN titre récalcitrant.
 */
export const resolveDeezerTracksData = async (rawTracks) => {
  return Promise.all(rawTracks.map(async (track) => {
    let bpm = track.bpm && parseFloat(track.bpm) > 0 ? Math.round(parseFloat(track.bpm)) : null;
    let preview = track.preview || null;

    if (!bpm) {
      try {
        const { data: full } = await deezerFetch(`${DEEZER_API_BASE}/track/${track.id}`);
        if (full && full.bpm && parseFloat(full.bpm) > 0) bpm = Math.round(parseFloat(full.bpm));
        if (!preview && full && full.preview) preview = full.preview;
      } catch (e) {
        // On continue vers la détection audio ci-dessous.
      }
    }

    if (!bpm && preview) {
      try {
        bpm = await detectBpmFromPreview(preview, 40, 220);
      } catch (e) {
        // On continue vers le repli mathématique ci-dessous.
      }
    }

    if (!bpm) bpm = 100 + (track.title.length % 80);

    const genre = (await resolveDeezerGenre(track.id, track.album ? track.album.id : null).catch(() => null)) || 'Genre inconnu';

    return {
      // Préfixe "deezer-" : même convention que les titres sourcés depuis les
      // artistes favoris dans le moteur de génération (voir getSingleMatchingTrack,
      // musicEngine.js) — garde ce champ, générique historiquement ("youtubeId"),
      // unique et reconnaissable quelle que soit la vraie source du titre.
      youtubeId: `deezer-${track.id}`,
      title: track.title,
      artist: track.artist ? track.artist.name : 'Artiste inconnu',
      album: track.album ? track.album.title : 'Album',
      genre,
      bpm,
      duration: Math.round(track.duration) || 180,
      isFromPlatform: 'Deezer',
      preview,
    };
  }));
};
