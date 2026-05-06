// Vercel Serverless Function — proxy vers Google Apps Script
// L'URL Apps Script est dans la variable d'environnement APPS_SCRIPT_URL (jamais exposée au client)

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!APPS_SCRIPT_URL) {
    return res.status(503).json({ success: false, error: 'Backend non configuré (variable APPS_SCRIPT_URL manquante)' });
  }

  try {
    let response;

    if (req.method === 'POST') {
      // POST : body JSON transmis directement
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {}),
        redirect: 'follow',
      });
    } else {
      // GET : query params transmis
      const params = new URLSearchParams(req.query || {}).toString();
      const url = APPS_SCRIPT_URL + (params ? '?' + params : '');
      response = await fetch(url, { redirect: 'follow' });
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { success: false, error: 'Réponse non-JSON du serveur', raw: text.slice(0, 200) }; }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
};
