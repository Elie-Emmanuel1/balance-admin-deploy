const https = require('https');
const { URL } = require('url');

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzU93X8_LehEFASWS3MEfU_f-Zs-T2O0CWr4U2AZ7bVUqWtcwg3OVs30Nkl1JDXRG7OKw/exec';
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

    // Envoyer en GET — méthode qui fonctionne avec Apps Script
    // Les données complexes (row, data) sont encodées en base64
    const url = new URL(APPS_SCRIPT_URL);
    Object.entries(body).forEach(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        // Encoder les objets en base64 pour éviter les problèmes d'URL
        url.searchParams.set(k, Buffer.from(JSON.stringify(v)).toString('base64'));
        url.searchParams.set(k + '__b64', '1');
      } else {
        url.searchParams.set(k, String(v ?? ''));
      }
    });

    const text = await getFollowRedirect(url.toString());

    // Valider JSON
    try {
      JSON.parse(text);
      return res.status(200).send(text);
    } catch(e) {
      // Si HTML → le script n'est pas public
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        return res.status(502).json({ 
          error: 'Apps Script non-public. Vérifiez le déploiement : Accès = Tout le monde' 
        });
      }
      return res.status(502).json({ error: 'Réponse invalide', preview: text.slice(0,100) });
    }

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};

function getFollowRedirect(urlStr, depth) {
  depth = depth || 0;
  if (depth > 5) return Promise.reject(new Error('Trop de redirections'));
  return new Promise((resolve, reject) => {
    https.get(urlStr, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        const next = r.headers.location.startsWith('http')
          ? r.headers.location
          : new URL(r.headers.location, urlStr).toString();
        getFollowRedirect(next, depth + 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
