// Proxy Vercel — adapté depuis StudioPro (version qui marche)
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

module.exports = async function handler(req, res) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-session-token, x-site-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  const send = (status, body) => {
    Object.entries(cors).forEach(([k,v]) => res.setHeader(k, v));
    return res.status(status).json(typeof body === 'string' ? { raw: body } : body);
  };

  if (req.method === 'OPTIONS') return send(200, {});

  if (!APPS_SCRIPT_URL) {
    return send(503, { error: 'APPS_SCRIPT_URL non configurée dans Vercel Environment Variables' });
  }

  try {
    let body = {};
    try {
      body = typeof req.body === 'object' && req.body !== null
        ? req.body
        : JSON.parse(req.body || '{}');
    } catch(e) {}

    const r = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'BalanceAdmin-Proxy/1.0',
      },
      redirect: 'follow',
      body: JSON.stringify({
        ...body,
        admin_key: body.admin_key || ADMIN_KEY,
      }),
    });

    const text = await r.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch(e) {
      // Apps Script a retourné du HTML — problème de déploiement
      console.error('Non-JSON response:', text.slice(0, 300));
      return send(502, { 
        error: 'Apps Script non-JSON response. Vérifiez que le script est bien déployé en mode public.',
        preview: text.slice(0, 100)
      });
    }

    return send(200, result);

  } catch(err) {
    console.error('Proxy error:', err.message);
    return send(502, { error: err.message });
  }
};
