async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const body = await readBody(req);
  if (!body || body.password !== process.env.SITE_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  const maxAge = 60 * 60 * 24 * 30;
  res.setHeader(
    'Set-Cookie',
    `zwolk_auth=${process.env.SESSION_TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
  res.status(200).json({ ok: true });
};
