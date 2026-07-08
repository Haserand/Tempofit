/**
 * api/getsongbpm.js — Proxy serverless (Vercel) pour l'API GetSongBPM.
 *
 * Même principe que api/deezer.js : garder une clé/API tierce côté serveur
 * plutôt que dans le bundle JS envoyé au navigateur. Avant ce fichier, la clé
 * GetSongBPM était codée en dur dans App.jsx et visible par n'importe qui
 * (onglet Network, ou simplement en lisant le code source une fois buildé).
 *
 * Utilisé UNIQUEMENT par `resolveRealBPM` dans App.jsx (résolution du BPM d'un
 * titre Spotify liké dont le tempo n'est pas encore connu) — pas par le moteur
 * de génération de playlists, qui n'utilise plus GetSongBPM depuis son retrait
 * de la cascade (voir getSingleMatchingTrack).
 *
 * Configuration requise sur Vercel : Project Settings → Environment Variables
 * → ajouter GETSONGBPM_API_KEY avec la clé récupérée sur getsongbpm.com.
 * ⚠️ Si l'ancienne clé codée en dur a déjà été poussée sur GitHub, elle reste
 * visible dans l'historique des commits même après ce changement — mieux vaut
 * en régénérer une nouvelle côté GetSongBPM plutôt que de réutiliser l'ancienne.
 *
 * Paramètres acceptés (query string) :
 *   - lookup (+ type optionnel, 'both' par défaut) : recherche par titre/artiste,
 *     utilisée par resolveRealBPM.
 *   - bpm (+ limit optionnel) : recherche par BPM cible (ancien endpoint /tempo/,
 *     gardé au cas où, même si plus appelé depuis le retrait de GetSongBPM de la
 *     cascade principale de génération).
 */
export default async function handler(req, res) {
  const apiKey = process.env.GETSONGBPM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GETSONGBPM_API_KEY manquante côté serveur — à configurer dans Project Settings > Environment Variables sur Vercel." });
    return;
  }

  const { type, lookup, bpm, limit } = req.query;
  let targetUrl;

  if (lookup) {
    targetUrl = `https://api.getsong.co/search/?api_key=${apiKey}&type=${type || 'both'}&lookup=${encodeURIComponent(lookup)}`;
  } else if (bpm) {
    targetUrl = `https://api.getsong.co/tempo/?api_key=${apiKey}&bpm=${encodeURIComponent(bpm)}&limit=${limit || 50}`;
  } else {
    res.status(400).json({ error: 'Paramètre "lookup" ou "bpm" requis.' });
    return;
  }

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: "Erreur lors de l'appel à GetSongBPM." });
  }
}
