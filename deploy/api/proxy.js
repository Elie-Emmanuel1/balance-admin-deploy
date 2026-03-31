const https = require('https');
const http  = require('http');
const { URL } = require('url');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
  const ADMIN_KEY       = process.env.ADMIN_KEY || '';

  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({ error: 'APPS_SCRIPT_URL non configurée dans Vercel Environment Variables' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
    if (!body.admin_key) body.admin_key = ADMIN_KEY;

    const text = await fetchWithRedirects(APPS_SCRIPT_URL, JSON.stringify(body), 5);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Suit manuellement les redirections (Google Apps Script redirige vers un autre domaine)
function fetchWithRedirects(urlStr, body, maxRedirects) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));

    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = Buffer.from(body, 'utf-8');

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': payload.length,
      },
    };

    const request = lib.request(options, (response) => {
      // Suivre la redirection
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        const nextUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : `${parsed.protocol}//${parsed.host}${response.headers.location}`;
        // Pour les redirections GET (302/303), on envoie GET sans body
        const method = [302, 303].includes(response.statusCode) ? 'GET' : 'POST';
        response.resume();
        return fetchWithRedirectsMethod(nextUrl, body, maxRedirects - 1, method)
          .then(resolve).catch(reject);
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    });

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function fetchWithRedirectsMethod(urlStr, body, maxRedirects, method) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));

    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = method === 'POST' ? Buffer.from(body, 'utf-8') : null;

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: method,
      headers: method === 'POST'
        ? { 'Content-Type': 'text/plain', 'Content-Length': payload.length }
        : {},
    };

    const request = lib.request(options, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        const nextUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : `${parsed.protocol}//${parsed.host}${response.headers.location}`;
        const nextMethod = [302, 303].includes(response.statusCode) ? 'GET' : method;
        response.resume();
        return fetchWithRedirectsMethod(nextUrl, body, maxRedirects - 1, nextMethod)
          .then(resolve).catch(reject);
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    });

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}
