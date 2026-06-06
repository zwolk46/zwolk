const {
  fetchPlanItPurple,
  fetchAthletics,
  readEvents,
  readMeta,
  writeEvents,
  setCors,
} = require('./_lib');

let liveCache = null;
let liveCacheAt = 0;
const LIVE_TTL_MS = 5 * 60 * 1000;

async function loadEvents() {
  let events = null;
  let meta = null;
  try {
    events = await readEvents();
    meta = await readMeta();
  } catch (_) { /* KV unavailable — fall through to live fetch */ }

  if (events && Array.isArray(events) && events.length) {
    return { events, meta, source: 'kv' };
  }

  // Live fallback — use in-memory TTL to avoid hammering source per request.
  const now = Date.now();
  if (liveCache && now - liveCacheAt < LIVE_TTL_MS) {
    return { events: liveCache, meta: { refreshedAt: new Date(liveCacheAt).toISOString(), source: 'live-memory' }, source: 'live-memory' };
  }

  const planit = await fetchPlanItPurple(90).catch(() => []);
  // Skip athletics scraping on cold-path live fetch to keep request <10s; cron will populate.
  const all = planit.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  liveCache = all;
  liveCacheAt = now;

  // Best-effort persist for future requests
  try {
    await writeEvents(all, {
      refreshedAt: new Date().toISOString(),
      durationMs: 0,
      counts: { total: all.length, planitpurple: planit.length, athletics: 0 },
      errors: [],
      coldStart: true,
    });
  } catch (_) { /* ignore */ }

  return { events: all, meta: { refreshedAt: new Date().toISOString(), source: 'live' }, source: 'live' };
}

function applyFilters(events, q) {
  const { start, end, category, audience, location, source, search } = q;
  let out = events;
  if (start) out = out.filter(e => e.endUtc >= start);
  if (end)   out = out.filter(e => e.startUtc <= end);
  if (category) {
    const cats = String(category).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    out = out.filter(e => cats.includes((e.category || '').toLowerCase()));
  }
  if (audience) {
    const auds = String(audience).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    out = out.filter(e => (e.audiences || []).some(a => auds.includes(a.toLowerCase())));
  }
  if (location) {
    const locs = String(location).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    out = out.filter(e => locs.includes((e.location || '').toLowerCase()));
  }
  if (source) {
    out = out.filter(e => e.source === source);
  }
  if (search) {
    const needle = String(search).toLowerCase();
    out = out.filter(e =>
      (e.title || '').toLowerCase().includes(needle) ||
      (e.description || '').toLowerCase().includes(needle) ||
      (e.organizer || '').toLowerCase().includes(needle) ||
      (e.category || '').toLowerCase().includes(needle)
    );
  }
  return out;
}

module.exports = async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const u = new URL(req.url, `http://${req.headers.host || 'local'}`);
    const q = Object.fromEntries(u.searchParams.entries());
    const { events, meta, source } = await loadEvents();
    const filtered = applyFilters(events, q);
    // Build category and organizer facets from the FULL set so the UI's filter list is stable.
    const facets = {
      categories: distinctCounts(events, e => e.category),
      audiences:  distinctCounts(events, e => (e.audiences || []).join('|'), { split: '|' }),
      locations:  distinctCounts(events, e => e.location),
      organizers: distinctCounts(events, e => e.organizer).slice(0, 50),
      sources:    distinctCounts(events, e => e.source),
    };
    return res.status(200).json({
      events: filtered,
      total: filtered.length,
      grandTotal: events.length,
      meta: meta || { refreshedAt: null },
      source,
      facets,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};

function distinctCounts(events, accessor, opts = {}) {
  const map = new Map();
  for (const e of events) {
    const v = accessor(e);
    if (!v) continue;
    const parts = opts.split ? String(v).split(opts.split).filter(Boolean) : [v];
    for (const part of parts) {
      const k = String(part).trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}
