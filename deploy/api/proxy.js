const https = require('https');
const url   = require('url');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
  const ADMIN_KEY       = process.env.ADMIN_KEY || '';

  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({ error: 'APPS_SCRIPT_URL non configurée' });
  }

  try {
    let body = {};
    if (req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
    if (!body.admin_key) body.admin_key = ADMIN_KEY;

    const parsed = new url.URL(APPS_SCRIPT_URL);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
    };

    const data = JSON.stringify(body);

    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        // Suivre les redirections Google
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const loc = new url.URL(response.headers.location);
          const redirectOpts = {
            hostname: loc.hostname,
            path: loc.pathname + loc.search,
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
          };
          const req2 = https.request(redirectOpts, (res2) => {
            let text = '';
            res2.on('data', chunk => text += chunk);
            res2.on('end', () => resolve(text));
          });
          req2.on('error', reject);
          req2.write(data);
          req2.end();
          return;
        }
        let text = '';
        response.on('data', chunk => text += chunk);
        response.on('end', () => resolve(text));
      });
      request.on('error', reject);
      request.write(data);
      request.end();
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(result);

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
};
