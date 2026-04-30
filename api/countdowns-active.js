const { readItem, writeItem } = require('./_edge-config');

const KEY = 'countdowns:active-id:v1';

function normalizeId(value) {
  const id = String(value || '').trim().slice(0, 64);
  return id || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ activeId: normalizeId(await readItem(KEY)) });
    }

    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || '{}'); } catch { return {}; }
          })();
      const activeId = normalizeId(body.activeId);
      await writeItem(KEY, activeId);
      return res.status(200).json({ activeId });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
