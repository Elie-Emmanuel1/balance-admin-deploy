export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
  const ADMIN_KEY = process.env.ADMIN_KEY || '';

  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({ error: 'APPS_SCRIPT_URL non configurée' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  } catch(e) {}
  if (!body.admin_key) body.admin_key = ADMIN_KEY;

  // Étape 1 : Obtenir l'URL finale après redirection (GET pour suivre les redirects)
  // Google Apps Script redirige les POST vers une URL différente
  try {
    const finalUrl = await getFinalUrl(APPS_SCRIPT_URL);
    
    // Étape 2 : Envoyer le POST à l'URL finale directement
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    
    // Vérifier que c'est du JSON valide
    try {
      JSON.parse(text);
    } catch(e) {
      // Si pas JSON, retourner une erreur claire
      return res.status(500).json({ 
        error: 'Le serveur Apps Script a retourné une réponse non-JSON',
        raw: text.slice(0, 200)
      });
    }
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getFinalUrl(url) {
  // Suivre les redirections pour obtenir l'URL finale
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
  });
  return response.url || url;
}
