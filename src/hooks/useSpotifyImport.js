import { useState, useEffect, useRef } from 'react';
import { fetchSpotifyRawData, resolveTracksBpm } from '../spotifyEngine';

const SPOTIFY_AUTH_BASE = 'https://accounts.spotify.com/authorize?';
const SPOTIFY_TOKEN_BASE = 'https://accounts.spotify.com/api/token';

/**
 * useSpotifyImport — authentification OAuth2 PKCE + import/synchro de la
 * bibliothèque Spotify (titres likés, artistes suivis) vers les favoris de
 * l'app. Extrait de App.jsx (retour direct : "prends du recul sur le code,
 * comment tu diviserais App.jsx ?" — après les 8 modales, voir
 * components/modals/, ce module était le 2e chantier identifié : un
 * "moteur" entier laissé inline alors que ce pattern existe déjà comme
 * hooks ailleurs, ex. useTrackSearch.js).
 *
 * Contrairement au moteur de recherche Deezer manuelle (`searchWorldMusicApi`
 * et consorts, restés dans App.jsx — voir la note dans useTrackSearch.js sur
 * pourquoi : "énormes, fortement imbriquées avec d'autres domaines"), ce
 * module est raisonnablement AUTONOME : authentification + synchro, sans
 * dépendance profonde vers la génération/l'édition de playlist en cours —
 * seul `setFavorites` (le state du hook `useFavorites`, appelé par
 * l'appelant AVANT celui-ci) et `showToast` sont nécessaires en paramètres.
 *
 * `spotifyTrackPool` reste exposé par ce hook (pas juste `spotifyToken`) car
 * il est consommé ailleurs dans App.jsx par le moteur de génération
 * (`createPlaylistData`, `getSingleMatchingTrack`) — extraction pure, aucun
 * comportement changé, juste son EMPLACEMENT.
 */
export function useSpotifyImport(setFavorites, showToast) {
  const REDIRECT_URI = window.location.origin + window.location.pathname;
  const [spotifyToken, setSpotifyToken] = useState(window.localStorage.getItem("spotify_token"));
  const [spotifyTrackPool, setSpotifyTrackPool] = useState([]);
  const hasFetchedToken = useRef(false); // Garde-fou anti double-échange du "code" (StrictMode / re-render)

  // Au montage : si l'URL contient un paramètre "code" (retour de la redirection
  // Spotify après consentement de l'utilisateur), on l'échange contre un token
  // d'accès via l'endpoint /api/token, en fournissant le "code_verifier" PKCE
  // généré avant la redirection et stocké temporairement en localStorage.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');

    if (code && !hasFetchedToken.current) {
      hasFetchedToken.current = true;
      const codeVerifier = window.localStorage.getItem('code_verifier');

      fetch(SPOTIFY_TOKEN_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: '38d8a04ac20047cebe31d20a2cd65d52',
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          window.localStorage.setItem("spotify_token", data.access_token);
          setSpotifyToken(data.access_token);
          // Nettoie l'URL (retire ?code=...) pour éviter un ré-échange si l'utilisateur rafraîchit.
          window.history.replaceState({}, document.title, REDIRECT_URI);
          showToast("✅ Connexion à Spotify réussie !");
        }
      }).catch(err => console.error(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Génère une chaîne aléatoire cryptographiquement sûre (utilisée comme code_verifier PKCE).
  const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  };

  // Hash SHA-256 du code_verifier → donnera le code_challenge envoyé à Spotify.
  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  // Encodage base64url (variante base64 sans padding, compatible URL) requis par PKCE.
  const base64encode = (input) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  // Lance le flow de connexion Spotify : génère le couple verifier/challenge PKCE,
  // stocke le verifier pour pouvoir le réutiliser au retour, puis redirige
  // l'utilisateur vers la page de consentement Spotify.
  const loginSpotify = async () => {
    window.localStorage.removeItem("spotify_token");
    setSpotifyToken(null);

    const codeVerifier = generateRandomString(64);
    window.localStorage.setItem('code_verifier', codeVerifier);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: '38d8a04ac20047cebe31d20a2cd65d52',
      scope: 'user-read-private user-read-email user-top-read user-library-read user-follow-read playlist-modify-public playlist-modify-private',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      show_dialog: 'true'
    });

    window.location.href = SPOTIFY_AUTH_BASE + params.toString();
  };

  /**
   * Récupère les titres likés ET les artistes suivis de l'utilisateur sur Spotify,
   * résout le BPM réel (+ extrait audio) de chaque titre via `resolveRealBPM`, et
   * alimente `spotifyTrackPool` (utilisé en priorité par `getSingleMatchingTrack`)
   * ainsi que `favorites` (utilisés eux aussi en priorité, voir même fonction).
   *
   * `favorites.artists` combine désormais deux sources : les artistes des titres
   * likés (comme avant) ET les artistes explicitement suivis via /me/following
   * (nouveau) — avant, seule la première source existait, ce qui ne reflétait pas
   * vraiment "les artistes que tu aimes" au sens Spotify du terme.
   *
   * ⚠️ Performance/quota : `Promise.all` (dans resolveTracksBpm) lance une
   * résolution BPM par titre en parallèle. Avec la pagination (jusqu'à 200
   * titres, voir fetchSpotifyRawData), ça peut représenter un nombre
   * significatif de requêtes quasi simultanées vers Deezer/GetSongBPM — la
   * synchro peut prendre plusieurs dizaines de secondes.
   */
  const syncSpotifyFavorites = async (tokenToUse) => {
    const token = tokenToUse || spotifyToken;
    if (!token || token === "undefined" || token === "null") return;

    try {
      showToast("⚡ Récupération de ta bibliothèque Spotify...");

      const { rawTracks, followedArtistNames } = await fetchSpotifyRawData(token);

      if (rawTracks.length === 0 && followedArtistNames.length === 0) {
        showToast("Synchro terminée (Aucun titre liké ni artiste suivi trouvé).");
        return;
      }

      showToast("🔍 Interrogation du Moteur de Vérité BPM TempoFit...");
      const analyzedPool = await resolveTracksBpm(rawTracks);
      setSpotifyTrackPool(analyzedPool);

      // Fusion avec les favoris déjà présents (ajoutés manuellement ou via une
      // recherche BPM) plutôt que remplacement complet — une synchro Spotify ne
      // doit pas effacer ce que l'utilisateur a choisi lui-même dans l'app.
      setFavorites(prev => {
        const artistsFromTracks = analyzedPool.map(t => t.artist);
        const mergedArtists = Array.from(new Set([...prev.artists, ...followedArtistNames, ...artistsFromTracks])).slice(0, 40);

        const existingIds = new Set(prev.tracks.map(t => t.youtubeId));
        const newTracks = analyzedPool.filter(t => !existingIds.has(t.youtubeId));
        const mergedTracks = [...prev.tracks, ...newTracks];

        return { ...prev, useFavorites: true, artists: mergedArtists, tracks: mergedTracks };
      });

      showToast(`🎯 ${analyzedPool.length} titres et ${followedArtistNames.length} artistes suivis synchronisés !`);
    } catch (e) {
      console.error("Erreur d'importation :", e);
      if (e.message === "Token expiré") {
        window.localStorage.removeItem("spotify_token");
        setSpotifyToken(null);
        showToast("❌ Ta session Spotify a expiré. Reconnecte-toi !", 'error');
      } else if (e.message === "Accès Spotify refusé") {
        // RETOUR DIRECT (boucle infinie constatée : reconnexion → 403 →
        // "expiré" → reconnexion...) — un 403 signifie que le token est
        // VALIDE mais que Spotify refuse quand même la requête : se
        // reconnecter ne peut RIEN y changer, donc surtout ne pas vider le
        // token ni pousser vers une nouvelle reconnexion ici (ça ne ferait
        // que répéter le même échec). Cause la plus probable actuellement :
        // restriction du Mode Développement Spotify (l'app doit avoir un
        // propriétaire Spotify Premium depuis mars 2026, et le compte qui se
        // connecte doit figurer dans "Users and Access" du tableau de bord
        // développeur — voir developer.spotify.com/dashboard), pas un
        // problème réglable depuis TempoFit lui-même.
        showToast("❌ Spotify refuse l'accès — pas ta session, vérifie le compte développeur de l'app.", 'error');
      } else {
        showToast("❌ Erreur lors de l'importation.", 'error');
      }
    }
  };

  // Synchronise automatiquement dès qu'un token Spotify valide est disponible
  // (au montage si déjà connecté, ou juste après le login OAuth ci-dessus).
  useEffect(() => {
    if (spotifyToken && spotifyToken !== "undefined" && spotifyToken !== "null") {
      syncSpotifyFavorites(spotifyToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyToken]);

  return {
    spotifyToken, setSpotifyToken,
    spotifyTrackPool, setSpotifyTrackPool,
    loginSpotify, syncSpotifyFavorites,
    REDIRECT_URI,
  };
}
