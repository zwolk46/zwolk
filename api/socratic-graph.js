const { readItem, writeItem } = require('./_edge-config');
const { requireAuthRole, storageKey } = require('./_auth');

const KEY = 'socratic:graph:v1';

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function normalizeGraph(graph) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return { nodes: [], edges: [] };
  const nodes = Array.isArray(graph.nodes) ? cloneJson(graph.nodes, []) : [];
  const edges = Array.isArray(graph.edges) ? cloneJson(graph.edges, []) : [];
  return { nodes, edges, savedAt: graph.savedAt || new Date().toISOString() };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = requireAuthRole(req, res);
    if (!role) return;

    if (req.method === 'GET') {
      let value = await readItem(storageKey(KEY, role));
      if (value === null && role === 'admin') value = await readItem(KEY);
      return res.status(200).json({ graph: normalizeGraph(value) });
    }

    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || '{}'); } catch { return {}; }
          })();
      const graph = normalizeGraph(body);
      graph.savedAt = new Date().toISOString();
      await writeItem(storageKey(KEY, role), graph);
      return res.status(200).json({ graph });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
