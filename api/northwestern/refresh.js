const { fetchPlanItPurple, fetchAthletics, writeEvents, setCors } = require('./_lib');

module.exports = async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = req.headers['authorization'] || '';
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const isAuthorized = isVercelCron || (cronSecret && auth === `Bearer ${cronSecret}`);
  // Allow unauthenticated refreshes only if explicitly enabled (dev/manual prime).
  const allowOpenRefresh = process.env.NU_EVENTS_ALLOW_OPEN_REFRESH === '1';
  if (!isAuthorized && !allowOpenRefresh) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = Date.now();
  const results = { planitpurple: 0, athletics: 0, errors: [] };

  let planit = [];
  try {
    planit = await fetchPlanItPurple(90);
    results.planitpurple = planit.length;
  } catch (e) {
    results.errors.push(`planitpurple: ${e.message || e}`);
  }

  let athletics = [];
  try {
    athletics = await fetchAthletics();
    results.athletics = athletics.length;
  } catch (e) {
    results.errors.push(`athletics: ${e.message || e}`);
  }

  const all = [...planit, ...athletics].sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  // Deduplicate by id
  const seen = new Set();
  const deduped = [];
  for (const ev of all) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    deduped.push(ev);
  }

  const meta = {
    refreshedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    counts: { total: deduped.length, planitpurple: results.planitpurple, athletics: results.athletics },
    errors: results.errors,
  };

  try {
    await writeEvents(deduped, meta);
  } catch (e) {
    return res.status(500).json({ error: 'KV write failed', detail: String(e.message || e), meta });
  }

  return res.status(200).json({ ok: true, meta });
};
