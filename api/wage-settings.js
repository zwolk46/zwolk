const { kvGetJson, kvSetJson } = require('./_kv');
const { requireAuthRole, storageKey } = require('./_auth');

const KEY = 'wage:hourly-v1';

function normalizeWage(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = requireAuthRole(req, res);
    if (!role) return;

    if (req.method === 'GET') {
      const stored = await kvGetJson(storageKey(KEY, role));
      const value = normalizeWage(stored);
      return res.status(200).json({ hourlyWage: value });
    }

    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || '{}'); } catch { return {}; }
          })();
      const hourlyWage = normalizeWage(body.hourlyWage);
      if (hourlyWage === null) return res.status(400).json({ error: 'Expected positive numeric hourlyWage' });
      await kvSetJson(storageKey(KEY, role), hourlyWage);
      return res.status(200).json({ hourlyWage });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
