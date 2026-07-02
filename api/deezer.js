export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || typeof url !== 'string' || !url.startsWith('https://api.deezer.com/')) {
    res.status(400).json({ error: 'invalid or missing url parameter' });
    return;
  }

  try {
    const deezerRes = await fetch(url);
    const text = await deezerRes.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ error: 'upstream fetch failed' });
  }
}
