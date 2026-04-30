const { kvGetJson, kvSetJson } = require('./_kv');
const { requireAuthRole, storageKey } = require('./_auth');

const KEY = 'ipa:dictionary-overrides:v1';

function normalizeWord(word) {
  return String(word || '')
    .trim()
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[^a-z'-]/g, '')
    .slice(0, 64);
}

function normalizeIpa(value) {
  return String(value || '').trim().slice(0, 64);
}

function normalizeOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [word, ipa] of Object.entries(value)) {
    const cleanWord = normalizeWord(word);
    const cleanIpa = normalizeIpa(ipa);
    if (!cleanWord) continue;
    out[cleanWord] = cleanIpa;
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = requireAuthRole(req, res);
    if (!role) return;

    if (req.method === 'GET') {
      const overrides = await kvGetJson(storageKey(KEY, role));
      return res.status(200).json({ dictionaryOverrides: normalizeOverrides(overrides) });
    }

    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || '{}'); } catch { return {}; }
          })();
      const incoming = body && typeof body.dictionaryOverrides === 'object'
        ? body.dictionaryOverrides
        : body;
      const dictionaryOverrides = normalizeOverrides(incoming);
      await kvSetJson(storageKey(KEY, role), dictionaryOverrides);
      return res.status(200).json({ dictionaryOverrides });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
