import { useState, useEffect, useRef } from 'react';
import { fetchDeezerRawData, resolveDeezerTracksData } from '../deezerImportEngine';

const DEEZER_AUTH_BASE = 'https://connect.deezer.com/oauth/auth.php?';

// ⚠️ App ID Deezer — PAS sensible (déjà visible dans l'URL d'autorisation
// construite ci-dessous), mais doit être remplacé par le vrai App ID une fois
// l'app créée sur https://developers.deezer.com/myapps. Le secret d'app, lui,
// ne doit JAMAIS apparaître ici — il reste côté serveur (voir
// api/deezer-auth.js, DEEZER_APP_SECRET).
const DEEZER_APP_ID = 'VOTRE_APP_ID_DEEZER';

/**
 * useDeezerImport — authentification OAuth + import/synchro de la
 * bibliothèque Deezer (titres favoris, artistes suivis) vers les favoris de
 * l'app. Miroir de useSpotifyImport.js pour la même fonctionnalité côté
 * Deezer — même structure, mêmes noms de fonctions exposées
 * (loginDeezer/syncDeezerFavorites au lieu de loginSpotify/
 * syncSpotifyFavorites), pour que App.jsx les câble de façon symétrique.
 *
 * 3 différences réelles avec le flow Spotify :
 *   1. Deezer utilise l'OAuth "classique" (secret d'app côté serveur, voir
 *      api/deezer-auth.js), PAS PKCE — pas de code_verifier/code_challenge à
 *      générer ici, une redirection suffit.
 *   2. Permission `offline_access` demandée → le token Deezer n'expire
 *      jamais (confirmé par la doc Deezer) — pas de distinction token
 *      expiré/invalide à gérer avec la même finesse que Spotify (401 vs
 *      403), Deezer ne connaît pas la même restriction "Mode Développement +
 *      Premium obligatoire" qui a motivé cette intégration.
 *   3. `oauth_provider_pending` (localStorage) : Spotify ET Deezer
 *      redirigent vers LA MÊME URL de l'app (`REDIRECT_URI` = origine +
 *      chemin, sans paramètre distinctif — changer ça casserait la
 *      correspondance exacte exigée par chaque fournisseur avec l'URL
 *      enregistrée dans son propre tableau de bord). Sans un moyen de
 *      distinguer "ce `?code=` vient de qui ?", les 2 hooks tenteraient
 *      chacun d'échanger le même code contre LEUR token respectif au retour
 *      — posé juste avant la redirection (voir loginDeezer/loginSpotify),
 *      lu ET nettoyé ici au retour, jamais laissé traîner.
 */
export function useDeezerImport(setFavorites, showToast) {
  const REDIRECT_URI = window.location.origin + window.location.pathname;
  const [deezerToken, setDeezerToken] = useState(window.localStorage.getItem("deezer_token"));
  const hasFetchedToken = useRef(false); // Garde-fou anti double-échange du "code" (StrictMode / re-render)

  // Au montage : si l'URL contient un paramètre "code" ET que ce code a été
  // posé pour Deezer (voir `oauth_provider_pending` dans la docstring
  // ci-dessus), on l'échange contre un token via api/deezer-auth.js (le
  // secret d'app reste côté serveur, jamais ici).
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const pendingProvider = window.localStorage.getItem('oauth_provider_pending');

    if (code && pendingProvider === 'deezer' && !hasFetchedToken.current) {
      hasFetchedToken.current = true;
      window.localStorage.removeItem('oauth_provider_pending');

      fetch(`/api/deezer-auth?code=${encodeURIComponent(code)}`)
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            window.localStorage.setItem("deezer_token", data.access_token);
            setDeezerToken(data.access_token);
            // Nettoie l'URL (retire ?code=...) pour éviter un ré-échange si l'utilisateur rafraîchit.
            window.history.replaceState({}, document.title, REDIRECT_URI);
            showToast("✅ Connexion à Deezer réussie !");
          } else {
            showToast("❌ Connexion à Deezer échouée.", 'error');
          }
        }).catch(err => console.error(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lance le flow de connexion Deezer : pose le marqueur de provenance (voir
  // docstring), puis redirige vers la page de consentement Deezer. Pas de
  // PKCE ici (contrairement à Spotify) — Deezer n'en a pas besoin, le secret
  // d'app côté serveur suffit à sécuriser l'échange (voir api/deezer-auth.js).
  const loginDeezer = () => {
    window.localStorage.removeItem("deezer_token");
    setDeezerToken(null);
    window.localStorage.setItem('oauth_provider_pending', 'deezer');

    const params = new URLSearchParams({
      app_id: DEEZER_APP_ID,
      redirect_uri: REDIRECT_URI,
      perms: 'basic_access,email,offline_access',
    });

    window.location.href = DEEZER_AUTH_BASE + params.toString();
  };

  /**
   * Récupère titres favoris ET artistes suivis sur Deezer, résout leur BPM
   * réel/genre via `resolveDeezerTracksData`, et fusionne dans les MÊMES
   * favoris que Spotify (`favorites.tracks`/`favorites.artists`) — pas un
   * état séparé "favoris Deezer" : le moteur de génération lit `favorites`
   * comme SOURCE PRIORITAIRE unique, peu importe la plateforme d'origine de
   * chaque titre (voir getSingleMatchingTrack, musicEngine.js — étape 1).
   * Même logique de fusion (jamais un remplacement complet) que
   * syncSpotifyFavorites (spotifyEngine.js) : une synchro ne doit jamais
   * effacer ce que l'utilisateur a choisi lui-même dans l'app, ni ce qui
   * vient déjà d'une autre plateforme connectée.
   */
  const syncDeezerFavorites = async (tokenToUse) => {
    const token = tokenToUse || deezerToken;
    if (!token || token === "undefined" || token === "null") return;

    try {
      showToast("⚡ Récupération de ta bibliothèque Deezer...");

      const { rawTracks, followedArtistNames } = await fetchDeezerRawData(token);

      if (rawTracks.length === 0 && followedArtistNames.length === 0) {
        showToast("Synchro terminée (Aucun titre favori ni artiste suivi trouvé).");
        return;
      }

      showToast("🔍 Résolution BPM/genre des titres Deezer...");
      const analyzedTracks = await resolveDeezerTracksData(rawTracks);

      setFavorites(prev => {
        const artistsFromTracks = analyzedTracks.map(t => t.artist);
        const mergedArtists = Array.from(new Set([...prev.artists, ...followedArtistNames, ...artistsFromTracks])).slice(0, 40);

        const existingIds = new Set(prev.tracks.map(t => t.youtubeId));
        const newTracks = analyzedTracks.filter(t => !existingIds.has(t.youtubeId));
        const mergedTracks = [...prev.tracks, ...newTracks];

        return { ...prev, useFavorites: true, artists: mergedArtists, tracks: mergedTracks };
      });

      showToast(`🎯 ${analyzedTracks.length} titres et ${followedArtistNames.length} artistes suivis synchronisés !`);
    } catch (e) {
      console.error("Erreur d'importation Deezer :", e);
      window.localStorage.removeItem("deezer_token");
      setDeezerToken(null);
      showToast("❌ Ta session Deezer a expiré ou a été révoquée. Reconnecte-toi !", 'error');
    }
  };

  // Synchronise automatiquement dès qu'un token Deezer valide est disponible
  // (au montage si déjà connecté, ou juste après le login OAuth ci-dessus) —
  // même principe que useSpotifyImport.js.
  useEffect(() => {
    if (deezerToken && deezerToken !== "undefined" && deezerToken !== "null") {
      syncDeezerFavorites(deezerToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deezerToken]);

  return {
    deezerToken, setDeezerToken,
    loginDeezer, syncDeezerFavorites,
    REDIRECT_URI,
  };
}
