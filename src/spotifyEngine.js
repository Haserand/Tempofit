/**
 * spotifyEngine.js — Récupération et analyse de la bibliothèque Spotify de
 * l'utilisateur (titres likés + artistes suivis), avec résolution du BPM réel
 * de chaque titre. Extrait d'App.jsx suite à la demande explicite de
 * découpage des grosses fonctions en fichiers utilitaires séparés — même
 * chantier que musicEngine.js/searchEngine.js.
 *
 * Ne couvre PAS l'authentification OAuth (login, échange de code contre un
 * token) : ça reste dans App.jsx, propre à l'écran et au flow de redirection
 * navigateur. Ce fichier suppose un token déjà valide en entrée.
 *
 * MÊME PRINCIPE QUE searchEngine.js (pour ne pas reproduire le bug de la
 * tentative de découpage précédente) : ces fonctions ne font QUE réseau +
 * calcul et RENVOIENT un résultat, sans jamais toucher au state React.
 * `syncSpotifyFavorites`, resté dans App.jsx, ne fait plus qu'appeler
 * `fetchSpotifyLibrary` puis appliquer le résultat reçu (setSpotifyTrackPool,
 * setFavorites, toasts, gestion du cas "Token expiré").
 *
 * Aucune règle métier n'a changé par rapport à l'original — extraction pure,
 * pas une réécriture.
 */

import { deezerFetch } from './musicEngine';

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

/**
 * Résout le BPM réel d'un titre (Deezer en priorité, GetSongBPM en repli, puis
 * une estimation mathématique grossière en tout dernier recours pour ne
 * jamais bloquer la synchro). Voir le commentaire d'origine dans App.jsx pour
 * le détail complet de cette cascade — non reproduit ici pour éviter la
 * duplication.
 */
export const resolveRealBPM = async (title, artist) => {
  const cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').split('-')[0].trim();
  const cleanArtist = artist.split(',')[0].split('&')[0].trim();

  // Recherche Deezer en priorité
  try {
    const q = `track:"${cleanTitle}" artist:"${cleanArtist}"`;
    const { data: searchData } = await deezerFetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`);
    const stub = (searchData && Array.isArray(searchData.data)) ? searchData.data[0] : null;
    if (stub) {
      const { data: full } = await deezerFetch(`https://api.deezer.com/track/${stub.id}`);
      if (full && full.bpm && parseFloat(full.bpm) > 0) {
        return { bpm: Math.round(parseFloat(full.bpm)), preview: full.preview || null };
      }
    }
  } catch (e) {
    // On continue vers le fallback GetSongBPM ci-dessous.
  }

  // Filet de sécurité : GetSongBPM, via /api/getsongbpm (la clé reste côté serveur).
  try {
    const queryStr = "song:" + cleanTitle + " artist:" + cleanArtist;
    let res = await fetch(`/api/getsongbpm?type=both&lookup=${encodeURIComponent(queryStr)}`);
    let data = await res.json();
    if (data.search && data.search.length > 0 && data.search[0].tempo) {
      return { bpm: parseInt(data.search[0].tempo), preview: null };
    }

    // Repli : chercher uniquement par titre.
    res = await fetch(`/api/getsongbpm?type=song&lookup=${encodeURIComponent(cleanTitle)}`);
    data = await res.json();
    if (data.search && data.search.length > 0 && data.search[0].tempo) {
      return { bpm: parseInt(data.search[0].tempo), preview: null };
    }
  } catch (e) {
    console.error("Erreur API GetSongBPM:", e);
  }

  // Fallback mathématique si la musique est totalement inconnue.
  return { bpm: 100 + (title.length % 80), preview: null };
};

/**
 * Récupère les titres likés Spotify en suivant la pagination de l'API (`next`
 * URL renvoyée par Spotify tant qu'il reste des pages). Plafonné à
 * `maxTracks` : au-delà, chaque titre supplémentaire coûte un appel réseau de
 * résolution BPM (voir `resolveRealBPM`), donc une bibliothèque de plusieurs
 * milliers de titres likés rendrait la synchro extrêmement longue et
 * risquerait de déclencher du rate-limiting côté Deezer/GetSongBPM.
 *
 * Lève une exception "Token expiré" si Spotify répond 401/403 — à
 * l'appelant de la traiter (déconnexion, message dédié).
 */
export const fetchAllLikedTracks = async (token, maxTracks = 200) => {
  let allTracks = [];
  let url = SPOTIFY_API_BASE + '/me/tracks?limit=50';
  while (url && allTracks.length < maxTracks) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (res.status === 401 || res.status === 403) throw new Error("Token expiré");
    const data = await res.json();
    const items = data.items ? data.items.map(i => i.track) : [];
    allTracks = allTracks.concat(items);
    url = data.next; // Spotify fournit directement l'URL de la page suivante, ou null si terminé
  }
  return allTracks.slice(0, maxTracks);
};

// Récupère les artistes réellement SUIVIS par l'utilisateur (distinct des
// artistes des titres likés) — échec silencieux (tableau vide) plutôt que de
// faire échouer toute la synchro pour cette seule source secondaire.
export const fetchFollowedArtists = async (token) => {
  try {
    const followedRes = await fetch(SPOTIFY_API_BASE + '/me/following?type=artist&limit=50', {
      headers: { Authorization: "Bearer " + token }
    });
    if (!followedRes.ok) return [];
    const followedData = await followedRes.json();
    const items = followedData.artists && followedData.artists.items ? followedData.artists.items : [];
    return items.map(a => a.name);
  } catch (e) {
    return [];
  }
};

/**
 * Récupère titres likés + artistes suivis, SANS résoudre le BPM (étape
 * séparée de `resolveTracksBpm` ci-dessous) — permet à l'appelant de vérifier
 * s'il y a quoi que ce soit à traiter avant de lancer la résolution BPM,
 * potentiellement coûteuse (un appel réseau par titre).
 */
export const fetchSpotifyRawData = async (token) => {
  const [rawTracks, followedArtistNames] = await Promise.all([
    fetchAllLikedTracks(token),
    fetchFollowedArtists(token),
  ]);
  return { rawTracks, followedArtistNames };
};

// Résout le BPM réel (+ extrait audio) de chaque titre brut Spotify. Pure :
// aucun setState, aucune lecture de state React.
export const resolveTracksBpm = async (rawTracks) => {
  return Promise.all(rawTracks.map(async (track) => {
    const artistName = track.artists && track.artists[0] ? track.artists[0].name : 'Artiste inconnu';
    const resolved = await resolveRealBPM(track.name, artistName);

    return {
      youtubeId: track.id,
      title: track.name,
      artist: artistName,
      album: track.album ? track.album.name : 'Album',
      bpm: resolved.bpm,
      duration: Math.round(track.duration_ms / 1000),
      isFromPlatform: 'Spotify',
      preview: track.preview_url || resolved.preview || null // extrait Spotify natif si dispo, sinon celui trouvé via Deezer
    };
  }));
};
