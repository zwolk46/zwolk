const { readItem, writeItem } = require('./_edge-config');
const { requireAuthRole, storageKey } = require('./_auth');

const KEY = 'countdowns';

async function readList(role) {
  let data = await readItem(storageKey(KEY, role));
  if (data === null && role === 'admin') data = await readItem(KEY);
  return Array.isArray(data) ? data : [];
}

async function writeList(role, list) {
  await writeItem(storageKey(KEY, role), list);
}

const VALID_SCENES = ['horizon','brief','halo','bauhaus','inkwell','terminal','marquee','folio'];
const VALID_COMP   = ['quiet','balanced','loud'];
const VALID_ATMOS  = ['bare','dressed','theatrical'];

function sanitize(cd) {
  if (!cd || typeof cd !== 'object') return null;
  const id    = String(cd.id    || '').slice(0, 64);
  const title = String(cd.title || '').slice(0, 120);
  const tz    = String(cd.tz   || '');
  if (!id || !title || !tz) return null;

  // New format: targetISO (full ISO string)
  let targetISO = null;
  if (cd.targetISO) {
    const d = new Date(String(cd.targetISO));
    if (!isNaN(d)) targetISO = d.toISOString();
  }
  // Old format: target "YYYY-MM-DDTHH:MM" kept for backward compat
  let target = null;
  if (cd.target) {
    target = String(cd.target).slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(target)) target = null;
  }

  if (!targetISO && !target) return null;

  const out = { id, title, tz };
  if (targetISO) out.targetISO = targetISO;
  if (target)    out.target    = target;

  // Scene
  const scene = String(cd.scene || 'horizon');
  out.scene = VALID_SCENES.includes(scene) ? scene : 'horizon';

  // Icon
  if (cd.icon && typeof cd.icon === 'object') {
    const t = String(cd.icon.type || '');
    if (t === 'emoji' || t === 'image') {
      out.icon = { type: t, value: String(cd.icon.value || '').slice(0, 4096) };
    }
  }

  // Palette
  if (cd.palette && typeof cd.palette === 'object') {
    const palette = {};
    for (const k of ['bg','ink','c1','c2','c3']) {
      if (typeof cd.palette[k] === 'string') palette[k] = cd.palette[k].slice(0, 32);
    }
    if (Object.keys(palette).length) out.palette = palette;
  }

  // Copy
  if (cd.copy && typeof cd.copy === 'object') {
    const copy = {};
    if (typeof cd.copy.prefix   === 'string') copy.prefix   = cd.copy.prefix.slice(0, 120);
    if (typeof cd.copy.dayLabel === 'string') copy.dayLabel = cd.copy.dayLabel.slice(0, 64);
    if (Object.keys(copy).length) out.copy = copy;
  }

  // Feel
  if (VALID_COMP.includes(cd.composition))   out.composition = cd.composition;
  if (VALID_ATMOS.includes(cd.atmosphere))   out.atmosphere  = cd.atmosphere;

  return out;
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
      const list = await readList(role);
      return res.status(200).json({ countdowns: list });
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const incoming = Array.isArray(body && body.countdowns) ? body.countdowns : null;
      if (!incoming) return res.status(400).json({ error: 'Expected { countdowns: [...] }' });
      const cleaned = incoming.map(sanitize).filter(Boolean);
      await writeList(role, cleaned);
      return res.status(200).json({ countdowns: cleaned });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
