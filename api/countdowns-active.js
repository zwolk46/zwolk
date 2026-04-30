const { kvGetJson, kvSetJson } = require('./_kv');
const { requireAuthRole, storageKey } = require('./_auth');

const KEY = 'countdowns:active-id:v1';

function normalizeId(value) {
  const id = String(value || '').trim().slice(0, 64);
  return id || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = requireAuthRole(req, res);
    if (!role) return;

    if (req.method === 'GET') {
      const value = await kvGetJson(storageKey(KEY, role));
      return res.status(200).json({ activeId: normalizeId(value) });
    }

    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || '{}'); } catch { return {}; }
          })();
      const activeId = normalizeId(body.activeId);
      await kvSetJson(storageKey(KEY, role), activeId);
      return res.status(200).json({ activeId });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
