/**
 * wc2026-client.js — browser-side wrapper for the WC2026 API.
 *
 * Calls go through our same-origin Vercel proxy (`/api/wc2026/*`) which
 * injects the Bearer key server-side, enforces a hard 490/day calendar cap
 * (under the 500/day Pro ceiling that auto-disables the key), and caches
 * responses for ~10–25s so polling can't burst through the budget.
 *
 * The proxy whitelists the same endpoints documented below; calling
 * anything else gets a 404 from the proxy (not upstream).
 *
 * Contract:
 *   - Every exported function is async and returns parsed JSON.
 *   - On a non-2xx response, functions throw an Error including the status
 *     code and path so callers can try/catch meaningfully.
 *
 * Polling (see wc/CLAUDE.md "Live data" for rationale):
 *   - On load: fetch /matches and /groups once.
 *   - Outside a live window: refresh on user action only.
 *   - Inside a live window: poll the COLLECTION endpoint (getMatches /
 *     getLiveMatches) every 60–90s — never getMatch(id) per match.
 *   - The proxy's ~25s cache will collapse over-eager polling automatically.
 */

const BASE = '/api/wc2026';

async function wcFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      if (body && body.error) detail = ` — ${body.error}`;
    } catch {}
    throw new Error(`wc2026api error ${res.status} on ${path}${detail}`);
  }
  return res.json();
}

function buildQuery(params = {}) {
  const usable = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (usable.length === 0) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of usable) qs.append(k, String(v));
  return `?${qs.toString()}`;
}

/** GET /teams — all 48 national teams. */
export async function getTeams() {
  return wcFetch('/teams');
}

/**
 * GET /matches — fixtures/results.
 * @param {Object}  [opts]
 * @param {string}  [opts.team]    3-letter code, e.g. "NED" (filters home OR away)
 * @param {string}  [opts.status]  "scheduled" | "live" | "finished"
 * @param {string}  [opts.round]   e.g. "group"
 * @param {string}  [opts.group]   group letter, e.g. "F"
 */
export async function getMatches({ team, status, round, group } = {}) {
  return wcFetch(`/matches${buildQuery({ team, status, round, group })}`);
}

/** GET /groups — live group standings for all 12 groups. */
export async function getGroups() {
  return wcFetch('/groups');
}

/** GET /stadiums — the 16 host venues. */
export async function getStadiums() {
  return wcFetch('/stadiums');
}

/** GET /matches/:id — a single match by its id. */
export async function getMatch(id) {
  return wcFetch(`/matches/${encodeURIComponent(id)}`);
}

/**
 * GET /matches/:id/stats — post-match stats + minute-by-minute event timeline
 * (possession, shots, corners, fouls, cards; goals/bookings with player + minute).
 */
export async function getMatchStats(id) {
  return wcFetch(`/matches/${encodeURIComponent(id)}/stats`);
}

/** GET /matches?status=live — convenience wrapper for the live polling loop. */
export async function getLiveMatches() {
  return getMatches({ status: 'live' });
}

/**
 * GET /test/match — a fictional match that cycles through every phase in
 * real time. Useful for developing live-update UI off-tournament.
 */
export async function getTestMatch() {
  return wcFetch('/test/match');
}
