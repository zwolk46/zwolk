const { readItem, writeItem } = require('./_edge-config');
const { requireAuthRole, storageKey } = require('./_auth');

const KEY = 'ipa:sessions:v1';
const MAX_SESSIONS = 50;

function jsonClone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function toIso(value, fallback = null) {
  if (!value) return fallback;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function sanitizeSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  const id = String(session.id || '').trim().slice(0, 64);
  const name = String(session.name || '').trim().slice(0, 120);
  const originalFileName = String(session.originalFileName || '').trim().slice(0, 180);
  const fileText = String(session.fileText || '');
  const createdAt = toIso(session.createdAt);
  const updatedAt = toIso(session.updatedAt, createdAt || toIso(Date.now(), null));
  if (!id || !name || !createdAt || !updatedAt) return null;

  return {
    id,
    name,
    createdAt,
    updatedAt,
    originalFileName,
    fileText,
    flags: jsonClone(session.flags, {}),
    notes: jsonClone(session.notes, {}),
    phonemeOverrides: jsonClone(session.phonemeOverrides, {}),
    deletedPhonemes: jsonClone(session.deletedPhonemes, {}),
  };
}

function normalizeSessions(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const session of list) {
    const clean = sanitizeSession(session);
    if (clean) byId.set(clean.id, clean);
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_SESSIONS);
}

async function readSessions(role) {
  let data = await readItem(storageKey(KEY, role));
  if (data === null && role === 'admin') data = await readItem(KEY);
  return normalizeSessions(Array.isArray(data) ? data : []);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = requireAuthRole(req, res);
    if (!role) return;

    if (req.method === 'GET') {
      const sessions = await readSessions(role);
      return res.status(200).json({ sessions });
    }

    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || '{}'); } catch { return {}; }
          })();
      const incoming = Array.isArray(body.sessions) ? body.sessions : null;
      if (!incoming) return res.status(400).json({ error: 'Expected { sessions: [...] }' });
      const sessions = normalizeSessions(incoming);
      await writeItem(storageKey(KEY, role), sessions);
      return res.status(200).json({ sessions });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
