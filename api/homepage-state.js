const { kvGetJson, kvSetJson } = require('./_kv');
const { requireAuthRole, storageKey } = require('./_auth');

const KEY = 'homepage:state:v1';

const VALID_META = ['time', 'money', 'language', 'thinking', 'utility', 'writing', 'design', 'dev', 'misc'];

function sanitizeId(value) {
  return String(value || '').trim().slice(0, 80).replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeCustomApp(app) {
  if (!app || typeof app !== 'object') return null;
  const id = sanitizeId(app.id);
  const name = String(app.name || '').trim().slice(0, 80);
  const desc = String(app.desc || '').trim().slice(0, 160);
  const meta = VALID_META.includes(app.meta) ? app.meta : 'utility';
  const iconId = String(app.iconId || 'sparkle').trim().slice(0, 40);
  const url = String(app.url || '').trim().slice(0, 400);
  if (!id || !name) return null;
  const out = { id, name, desc: desc || 'A new tool', meta, iconId };
  if (url) out.url = url;
  return out;
}

function sanitizeIdList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const id = sanitizeId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sanitizeState(value) {
  const v = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  const customApps = Array.isArray(v.customApps)
    ? v.customApps.map(sanitizeCustomApp).filter(Boolean).slice(0, 200)
    : [];
  const pinned = sanitizeIdList(v.pinned).slice(0, 200);
  const order = sanitizeIdList(v.order).slice(0, 400);
  const removedDefaults = sanitizeIdList(v.removedDefaults).slice(0, 200);
  return { customApps, pinned, order, removedDefaults };
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
    const role = requireAuthRole(req, res);
    if (!role) return;

    if (req.method === 'GET') {
      const stored = await kvGetJson(storageKey(KEY, role));
      return res.status(200).json({ state: sanitizeState(stored) });
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      const state = sanitizeState(body && body.state ? body.state : body);
      await kvSetJson(storageKey(KEY, role), state);
      return res.status(200).json({ state });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
