const https = require('https');
const http = require('http');
const { URL } = require('url');

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxa3CKcGsX-ZIrq9zDRt72lWPKftrPl3HNb_03BeurHAnN9Rsa1ejKhh4K_2YMmz6-Tbw/exec';
const ADMIN_KEY = process.env.ADMIN_KEY || 'BC2026Platform';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = {};
    try {
      body = typeof req.body === 'object' && req.body !== null
        ? req.body : JSON.parse(req.body || '{}');
    } catch(e) {}
    if (!body.admin_key) body.admin_key = ADMIN_KEY;

    const payload = JSON.stringify(body);

    // ÉTAPE 1 : POST initial vers Apps Script
    // Apps Script va rediriger vers une autre URL
    const redirectUrl = await new Promise((resolve, reject) => {
      const parsed = new URL(APPS_SCRIPT_URL);
      const buf = Buffer.from(payload);
      const opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': buf.length,
        },
      };
      const req2 = https.request(opts, (r) => {
        r.resume(); // Ignorer le body
        if (r.headers.location) {
          resolve(r.headers.location);
        } else {
          // Pas de redirection — lire directement
          let data = '';
          // On a déjà fait resume(), relancer
          reject(new Error('NO_REDIRECT'));
        }
      });
      req2.on('error', reject);
      req2.write(buf);
      req2.end();
    }).catch(async (e) => {
      if (e.message === 'NO_REDIRECT') return null;
      throw e;
    });

    let text;
    
    if (redirectUrl) {
      // ÉTAPE 2 : POST vers l'URL finale (après redirection)
      text = await new Promise((resolve, reject) => {
        const parsed = new URL(redirectUrl);
        const buf = Buffer.from(payload);
        const lib = redirectUrl.startsWith('https') ? https : http;
        const opts = {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': buf.length,
          },
        };
        const req3 = lib.request(opts, (r) => {
          let data = '';
          r.on('data', c => data += c);
          r.on('end', () => resolve(data));
        });
        req3.on('error', reject);
        req3.write(buf);
        req3.end();
      });
    } else {
      // Pas de redirection — GET direct
      const url = new URL(APPS_SCRIPT_URL);
      Object.entries(body).forEach(([k, v]) => {
        url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      text = await new Promise((resolve, reject) => {
        https.get(url.toString(), (r) => {
          if (r.headers.location) {
            https.get(r.headers.location, (r2) => {
              let d = ''; r2.on('data', c => d += c); r2.on('end', () => resolve(d));
            }).on('error', reject);
            return;
          }
          let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
        }).on('error', reject);
      });
    }

    // Valider JSON
    try { JSON.parse(text); } catch(e) {
      return res.status(502).json({ error: 'non-JSON: ' + text.slice(0, 200) });
    }
    return res.status(200).send(text);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
