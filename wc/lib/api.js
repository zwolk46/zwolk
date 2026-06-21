// Thin wrapper around the same-origin proxy (/api/wc2026/*).
// The proxy enforces a 490/day cap and a short response cache, so callers
// don't need to manage either. Errors throw so try/catch is meaningful.
//
// It ALSO normalizes the live wc2026api.com responses into the shapes the app
// was built against, because the real API differs from the original spec:
//   • match.status is "completed" upstream — the UI checks "finished".
//   • penalty-shootout finishes come through as phase "FT" + home_pen/away_pen;
//     the UI shows "(pens)" only for phase "FT_PEN".
//   • /groups returns membership only ({ id, name, teams }) — no group_name and
//     no standings; the UI reads group_name and computes standings from matches.
//   • undecided knockout slots have null teams and no source text upstream; we
//     backfill home_team_source/away_team_source from the static schedule (joined
//     by match_number, since live and static use different match ids) so the
//     bracket can render "Winner Group A" placeholders instead of bare "TBD".

const BASE = '/api/wc2026';

async function call(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    let extra = '';
    try { const b = await res.json(); if (b && b.error) extra = ` — ${b.error}`; } catch {}
    throw new Error(`wc2026api ${res.status} on ${path}${extra}`);
  }
  return res.json();
}

function qs(params = {}) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    // The UI speaks "finished"; upstream wants "completed" on the status filter.
    if (k === 'status') usp.append(k, STATUS_TO_UPSTREAM[String(v).toLowerCase()] || v);
    else usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

// ─── Normalizers (pure; unit-tested in scripts/test-normalize.mjs) ────────────
const STATUS_FROM_UPSTREAM = {
  completed: 'finished', complete: 'finished', finished: 'finished', ft: 'finished',
  live: 'live', in_progress: 'live', inplay: 'live', playing: 'live',
  scheduled: 'scheduled', upcoming: 'scheduled', not_started: 'scheduled', pre: 'scheduled',
};
const STATUS_TO_UPSTREAM = { finished: 'completed', live: 'live', scheduled: 'scheduled' };

export function normalizeStatus(s) {
  if (s == null) return s;
  return STATUS_FROM_UPSTREAM[String(s).toLowerCase()] || s;
}

export function normalizeMatch(m, sources) {
  if (!m || typeof m !== 'object') return m;
  const out = { ...m };
  out.status = normalizeStatus(m.status);
  // Penalty-shootout result → FT_PEN so the UI labels it "(pens)".
  const hp = m.home_pen, ap = m.away_pen;
  if (out.status === 'finished' && hp != null && ap != null && !(m.phase && String(m.phase).toUpperCase() === 'FT_PEN')) {
    out.phase = 'FT_PEN';
  }
  // Backfill knockout placeholder source text from the static schedule.
  if (sources && m.match_number != null) {
    const src = sources.get(m.match_number);
    if (src) {
      if (out.home_team == null && out.home_team_source == null) out.home_team_source = src.home_team_source || null;
      if (out.away_team == null && out.away_team_source == null) out.away_team_source = src.away_team_source || null;
    }
  }
  return out;
}

export function normalizeGroups(raw) {
  const arr = Array.isArray(raw) ? raw : (raw && (raw.data || raw.groups)) || [];
  if (!Array.isArray(arr)) return raw;
  return arr.map((g) => {
    if (!g || typeof g !== 'object') return g;
    const group_name = g.group_name || g.name || g.letter || g.group || null;
    const teams = g.teams || g.members || [];
    const standings = g.standings || g.table || null; // computed downstream when null
    return { ...g, group_name, teams, standings };
  });
}

// ─── Static-schedule source map (for knockout placeholder backfill) ───────────
let _sourcesPromise = null;
function matchSources() {
  if (_sourcesPromise) return _sourcesPromise;
  _sourcesPromise = fetch('/wc/data/matches.json', { cache: 'force-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const map = new Map();
      for (const m of (Array.isArray(list) ? list : [])) {
        if (m && m.match_number != null) {
          map.set(m.match_number, {
            home_team_source: m.home_team_source ?? null,
            away_team_source: m.away_team_source ?? null,
          });
        }
      }
      return map;
    })
    .catch(() => new Map());
  return _sourcesPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const getTeams = () => call('/teams');
export const getStadiums = () => call('/stadiums');
export const getMatchStats = (id) => call(`/matches/${encodeURIComponent(id)}/stats`);

export async function getMatches(opts) {
  const [raw, src] = await Promise.all([call(`/matches${qs(opts)}`), matchSources()]);
  const arr = Array.isArray(raw) ? raw : (raw && raw.data) || raw;
  return Array.isArray(arr) ? arr.map((m) => normalizeMatch(m, src)) : arr;
}

export async function getLiveMatches() {
  const [raw, src] = await Promise.all([call('/matches?status=live'), matchSources()]);
  const arr = Array.isArray(raw) ? raw : (raw && raw.data) || raw;
  return Array.isArray(arr) ? arr.map((m) => normalizeMatch(m, src)) : arr;
}

export async function getMatch(id) {
  const [raw, src] = await Promise.all([call(`/matches/${encodeURIComponent(id)}`), matchSources()]);
  const m = Array.isArray(raw) ? raw[0] : (raw && raw.data) || raw;
  return m && typeof m === 'object' ? normalizeMatch(m, src) : m;
}

export async function getGroups() {
  return normalizeGroups(await call('/groups'));
}

export async function getTestMatch() {
  const raw = await call('/test/match');
  const m = Array.isArray(raw) ? raw[0] : (raw && raw.data) || raw;
  return m && typeof m === 'object' ? normalizeMatch(m) : m;
}
