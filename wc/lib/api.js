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
    else if (k === 'round') usp.append(k, ROUND_TO_UPSTREAM[String(v)] || v);
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

// The live API uses short knockout-round codes (R32/R16/QF/SF/3rd); the app and
// the static schedule use long codes (round_of_32 …). Normalize inbound so the
// bracket/fixtures/round labels work against live data; map outbound for filters.
const ROUND_FROM_UPSTREAM = {
  group: 'group', R32: 'round_of_32', R16: 'round_of_16', QF: 'quarter_final',
  SF: 'semi_final', '3rd': 'third_place', final: 'final',
  round_of_32: 'round_of_32', round_of_16: 'round_of_16', quarter_final: 'quarter_final',
  semi_final: 'semi_final', third_place: 'third_place',
};
const ROUND_TO_UPSTREAM = {
  round_of_32: 'R32', round_of_16: 'R16', quarter_final: 'QF', semi_final: 'SF',
  third_place: '3rd', final: 'final', group: 'group',
};
export function normalizeRound(r) {
  if (r == null) return r;
  return ROUND_FROM_UPSTREAM[String(r)] || ROUND_FROM_UPSTREAM[String(r).toUpperCase()] || r;
}

export function normalizeStatus(s) {
  if (s == null) return s;
  return STATUS_FROM_UPSTREAM[String(s).toLowerCase()] || s;
}

export function normalizeMatch(m, sources) {
  if (!m || typeof m !== 'object') return m;
  const out = { ...m };
  out.status = normalizeStatus(m.status);
  if (m.round != null) out.round = normalizeRound(m.round);
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
  _sourcesPromise = fetch('/wc/data/matches.json', { cache: 'no-cache' })
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
  try {
    const [raw, src] = await Promise.all([call(`/matches${qs(opts)}`), matchSources()]);
    const arr = Array.isArray(raw) ? raw : (raw && raw.data) || raw;
    return Array.isArray(arr) ? arr.map((m) => normalizeMatch(m, src)) : arr;
  } catch (e) {
    // wc2026api unavailable (daily cap / down) → ESPN fallback (group stage only,
    // since the knockout bracket structure isn't reconstructable from ESPN).
    const fb = await espnFallbackMatches(opts).catch(() => null);
    if (fb && fb.length) return fb;
    throw e;
  }
}

// ESPN's public scoreboard → app-shaped GROUP matches. No key, no rate cap. Group
// is mapped from the shipped 48-team file; scores are nulled for unplayed games
// (ESPN returns 0, not null, for scheduled fixtures). Keeps groups/standings/stakes
// working when the wc2026api budget is exhausted.
async function espnFallbackMatches(opts = {}) {
  if (opts.round && opts.round !== 'group') return [];
  const [espn, data] = await Promise.all([import('./espn.js'), import('./data.js')]);
  const teams = await data.getTeams48().catch(() => []);
  const grpOf = new Map((teams || []).map((t) => [t.code || t.fifa_code, t.group]));
  const events = await espn.getScoreboardWindow(20, 4);
  let out = []; let synth = 9000;
  for (const e of events) {
    const hc = e.home && e.home.code, ac = e.away && e.away.code, g = grpOf.get(hc);
    if (!hc || !ac || !g || grpOf.get(ac) !== g) continue;       // group-stage matches only
    const done = e.status === 'finished';
    out.push({
      match_number: synth++, id: e.id, group_name: g, group: g, round: 'group',
      phase: done ? 'FT' : e.status === 'live' ? '2H' : 'PRE',
      home_team: (e.home.name || hc), away_team: (e.away.name || ac),
      home_team_code: hc, away_team_code: ac, home_code: hc, away_code: ac,
      home_score: done ? e.home.score : null, away_score: done ? e.away.score : null,
      status: e.status, kickoff_utc: e.date, home_team_source: null, away_team_source: null,
    });
  }
  if (opts.team) out = out.filter((m) => m.home_code === opts.team || m.away_code === opts.team);
  if (opts.status) out = out.filter((m) => m.status === opts.status);
  return out;
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
