const EC_READ_BASE = 'https://edge-config.vercel.com';
const EC_WRITE_BASE = 'https://api.vercel.com';
const KEY = 'countdowns';

async function readList() {
  const res = await fetch(
    `${EC_READ_BASE}/${process.env.EC_ID}/item/${KEY}?token=${process.env.EC_TOKEN}`
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`EC read failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function writeList(list) {
  const res = await fetch(
    `${EC_WRITE_BASE}/v1/edge-config/${process.env.EC_ID}/items?teamId=${process.env.EC_TEAM_ID}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.EC_WRITE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ operation: 'upsert', key: KEY, value: list }],
      }),
    }
  );
  if (!res.ok) throw new Error(`EC write failed: ${res.status} ${await res.text()}`);
}

function sanitize(cd) {
  if (!cd || typeof cd !== 'object') return null;
  const id = String(cd.id || '').slice(0, 64);
  const title = String(cd.title || '').slice(0, 120);
  const target = String(cd.target || '').slice(0, 16); // normalize: drop any seconds portion
  const tz = String(cd.tz || '');
  if (!id || !title || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(target) || !tz) return null;
  return { id, title, target, tz };
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : null); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const list = await readList();
      return res.status(200).json({ countdowns: list });
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const incoming = Array.isArray(body && body.countdowns) ? body.countdowns : null;
      if (!incoming) return res.status(400).json({ error: 'Expected { countdowns: [...] }' });
      const cleaned = incoming.map(sanitize).filter(Boolean);
      await writeList(cleaned);
      return res.status(200).json({ countdowns: cleaned });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
