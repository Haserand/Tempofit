/**
 * api/freqblog.js — Proxy serverless (Vercel) pour l'API FreqBlog Music
 * (freqblog.com), remplaçant maintenu de l'ancien endpoint Spotify
 * `audio-features` (tué par Spotify fin 2024).
 *
 * Même principe que api/getsongbpm.js : garder la clé côté serveur plutôt
 * que dans le bundle JS envoyé au navigateur.
 *
 * Utilisé par searchWorldMusicApi dans App.jsx, comme niveau de résolution
 * BPM intermédiaire — après le BPM natif Deezer, avant GetSongBPM et avant
 * la détection audio en dernier recours (voir le commentaire détaillé dans
 * App.jsx pour l'ordre complet de la cascade et pourquoi).
 *
 * Configuration requise sur Vercel : Project Settings → Environment Variables
 * → ajouter FREQBLOG_API_KEY avec la clé récupérée sur freqblog.com.
 * ⚠️ Si une clé a été partagée en clair quelque part (capture d'écran, chat...)
 * avant d'être configurée ici, mieux vaut la régénérer côté FreqBlog plutôt
 * que de réutiliser celle déjà exposée.
 *
 * Paramètres acceptés (query string) :
 *   - track (requis) : titre du morceau.
 *   - artist (optionnel mais fortement recommandé) : nom de l'artiste, pour
 *     désambiguïser les titres homonymes (voir /lookup dans leur doc).
 */
export default async function handler(req, res) {
  const apiKey = process.env.FREQBLOG_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "FREQBLOG_API_KEY manquante côté serveur — à configurer dans Project Settings > Environment Variables sur Vercel." });
    return;
  }

  const { track, artist } = req.query;
  if (!track || typeof track !== 'string') {
    res.status(400).json({ error: 'Paramètre "track" requis.' });
    return;
  }

  const targetUrl = `https://api.freqblog.com/lookup?track=${encodeURIComponent(track)}${artist ? `&artist=${encodeURIComponent(artist)}` : ''}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'X-Api-Key': apiKey }
    });
    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status).send(text);
  } catch (e) {
    res.status(502).json({ error: "Erreur lors de l'appel à FreqBlog." });
  }
}
