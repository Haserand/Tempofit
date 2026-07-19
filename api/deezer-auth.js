/**
 * api/deezer-auth.js — Proxy serverless (Vercel) pour l'échange OAuth Deezer
 * (code → access_token).
 *
 * Même principe que api/getsongbpm.js : garder un secret d'app côté serveur
 * plutôt que dans le bundle JS envoyé au navigateur. Contrairement au flow
 * Spotify (PKCE, sans secret client — voir useSpotifyImport.js), Deezer
 * utilise le flow OAuth "classique" : `https://connect.deezer.com/oauth/
 * access_token.php` exige `secret` (le secret d'app) en paramètre, qui ne
 * doit donc JAMAIS être envoyé au navigateur. `app_id`, lui, n'est PAS
 * sensible (il apparaît déjà en clair dans l'URL d'autorisation construite
 * côté client, voir useDeezerImport.js) — mais il faut quand même le
 * renseigner ici aussi côté serveur, l'app_id du client et celui du serveur
 * n'ont aucun moyen de partager la même variable JS (2 environnements
 * d'exécution séparés).
 *
 * Configuration requise sur Vercel : Project Settings → Environment Variables
 *   - DEEZER_APP_ID     : l'App ID récupéré sur https://developers.deezer.com/myapps
 *   - DEEZER_APP_SECRET : le Secret Key de cette même app (JAMAIS le mettre
 *     ailleurs que côté serveur)
 * Et dans useDeezerImport.js, remplacer le même app_id en dur côté client
 * (non sensible, mais doit être identique aux 2 endroits).
 *
 * Deezer répond en texte brut par défaut (`access_token=XXX&expires=0`) —
 * `output=json` en paramètre force une vraie réponse JSON, plus simple à
 * parser ici que de reproduire un parseur de query string à la main.
 * `expires=0` signifie un token SANS expiration (permission `offline_access`
 * demandée côté client) — pas de refresh token à gérer, contrairement à
 * Spotify.
 */
export default async function handler(req, res) {
  const appId = process.env.DEEZER_APP_ID;
  const secret = process.env.DEEZER_APP_SECRET;
  if (!appId || !secret) {
    res.status(500).json({ error: "DEEZER_APP_ID / DEEZER_APP_SECRET manquantes côté serveur — à configurer dans Project Settings > Environment Variables sur Vercel." });
    return;
  }

  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Paramètre "code" requis.' });
    return;
  }

  try {
    const targetUrl = `https://connect.deezer.com/oauth/access_token.php?app_id=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(code)}&output=json`;
    const response = await fetch(targetUrl);
    const data = await response.json();

    // Deezer renvoie les erreurs DANS le corps (ex. code déjà utilisé/expiré),
    // pas via un statut HTTP dédié — on les remonte ici en 400 pour rester
    // cohérent avec le reste de l'API côté client.
    if (!data || !data.access_token) {
      res.status(400).json({ error: data && data.error_reason ? data.error_reason : "Échange du code Deezer contre un token échoué." });
      return;
    }

    res.status(200).json({ access_token: data.access_token, expires: data.expires ?? 0 });
  } catch (e) {
    res.status(502).json({ error: "Erreur lors de l'échange du code Deezer." });
  }
}
