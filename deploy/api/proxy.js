const https = require('https');
const { URL } = require('url');

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyZH38O2DVH1327fc6HCkPQqgHaFWbjsUib4CQJCYPvLT4G6X8M8qxA_Ar-evdo5f4Wxw/execc';
const ADMIN_KEY = process.env.ADMIN_KEY || 'BC2026Platform';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Lire le body
    let body = {};
    try {
      body = typeof req.body === 'object' && req.body !== null
        ? req.body : JSON.parse(req.body || '{}');
    } catch(e) {}
    if (!body.admin_key) body.admin_key = ADMIN_KEY;

    // Construire URL GET avec tous les paramètres à plat
    const url = new URL(APPS_SCRIPT_URL);
    Object.entries(body).forEach(([k, v]) => {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    });

    const text = await getWithRedirects(url.toString(), 5);

    try { JSON.parse(text); } catch(e) {
      return res.status(502).json({ error: 'Réponse non-JSON', preview: text.slice(0, 150) });
    }

    return res.status(200).send(text);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};

function getWithRedirects(urlStr, maxRedirects) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Trop de redirections'));
    https.get(urlStr, (response) => {
      if (response.statusCode >= 300 && response.headers.location) {
        const next = response.headers.location.startsWith('http')
          ? response.headers.location
          : new URL(response.headers.location, urlStr).toString();
        response.resume();
        getWithRedirects(next, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      response.on('data', c => data += c);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
