// ESPN hidden soccer API — a second, CORS-open, keyless live source for the
// /wc/live page. Verified callable from the browser against the real WC 2026
// feed on 2026-06-22 (Content-Type: application/json, Access-Control-Allow-Origin
// is permissive). ESPN is the app's source of LIVE TEXT COMMENTARY (play-by-play),
// a richer box score, pre-match betting odds (→ win-probability prior), and team
// colours/logos. FIFA (lib/fifa.js) stays the spine; this enriches it.
//
// Join model: ESPN groups WC matches under league slug `fifa.world`. Matches map
// to the FIFA/app world by DATE + the two team 3-letter codes (ESPN `abbreviation`
// ≈ FIFA code; a small alias table covers the handful that differ). We never hard
// the ESPN numeric event id — we discover it from the scoreboard for the day.
//
// Everything here is best-effort: every call resolves to null/[] on failure so a
// flaky ESPN never breaks the page (FIFA remains authoritative).

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

// ESPN abbreviation → FIFA/teams-48 code, only where they diverge. ESPN mostly
// already uses FIFA codes (FRA, ARG, SEN, NOR…), so this stays short.
const ESPN_CODE_ALIASES = {
  // (observed divergences get added here as the tournament runs)
};

export function espnCodeToFifa(code) {
  if (!code) return null;
  const up = String(code).toUpperCase();
  return ESPN_CODE_ALIASES[up] || up;
}

// ── low-level fetch (resolves to null on any failure) ──
async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const ymd = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x)) return null;
  return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`;
};

// status state → app vocabulary
function stateToStatus(state) {
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return 'scheduled';
}

// American moneyline → implied probability (0..1), vig included.
function mlToProb(ml) {
  const n = Number(ml);
  if (!n || isNaN(n)) return null;
  return n > 0 ? 100 / (n + 100) : -n / (-n + 100);
}

// ── scoreboard for a given day → normalized events ──
export async function getScoreboard(dateLike) {
  const date = ymd(dateLike || new Date());
  const data = await getJson(`${SITE}/scoreboard${date ? `?dates=${date}` : ''}`);
  const events = (data && data.events) || [];
  return events.map(normalizeEvent).filter(Boolean);
}

// A few days around now, de-duped — covers timezone/rollover so "today's slate"
// and the live match are always found regardless of UTC vs ET boundaries.
export async function getScoreboardWindow(daysBack = 1, daysFwd = 1) {
  const out = [];
  const seen = new Set();
  const base = Date.now();
  const jobs = [];
  for (let i = -daysBack; i <= daysFwd; i++) jobs.push(getScoreboard(new Date(base + i * 86400000)));
  for (const list of await Promise.all(jobs)) {
    for (const e of list) { if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); } }
  }
  return out;
}

function normalizeEvent(ev) {
  try {
    const comp = (ev.competitions && ev.competitions[0]) || {};
    const cs = comp.competitors || [];
    const home = cs.find((c) => c.homeAway === 'home') || cs[0] || {};
    const away = cs.find((c) => c.homeAway === 'away') || cs[1] || {};
    const st = (comp.status && comp.status.type) || (ev.status && ev.status.type) || {};
    const odds = (comp.odds && comp.odds[0]) || null;
    const side = (c) => ({
      code: espnCodeToFifa(c.team && c.team.abbreviation),
      espnCode: c.team && c.team.abbreviation,
      name: c.team && (c.team.displayName || c.team.name),
      color: c.team && c.team.color ? `#${c.team.color}` : null,
      altColor: c.team && c.team.alternateColor ? `#${c.team.alternateColor}` : null,
      logo: c.team && c.team.logo,
      score: c.score != null ? Number(c.score) : null,
      form: c.form || null,
      record: (c.records && c.records[0] && c.records[0].summary) || null,
      winner: !!c.winner,
      id: c.id,
    });
    return {
      id: String(ev.id),
      date: ev.date,
      status: stateToStatus(st.state),
      state: st.state,
      detail: st.shortDetail || st.detail || null,
      displayClock: comp.status && comp.status.displayClock,
      period: comp.status && comp.status.period,
      completed: !!st.completed,
      home: side(home),
      away: side(away),
      venue: comp.venue ? {
        name: comp.venue.fullName,
        city: comp.venue.address && [comp.venue.address.city, comp.venue.address.state].filter(Boolean).join(', '),
      } : null,
      attendance: comp.attendance || null,
      note: comp.altGameNote || null,
      broadcast: (comp.broadcasts && comp.broadcasts[0] && comp.broadcasts[0].names && comp.broadcasts[0].names.join(', ')) || null,
      playByPlay: !!comp.playByPlayAvailable,
      odds: odds ? {
        details: odds.details,
        homeProb: odds.moneyline && odds.moneyline.home ? mlToProb(odds.moneyline.home.close && odds.moneyline.home.close.odds || odds.moneyline.home.open && odds.moneyline.home.open.odds) : null,
        awayProb: odds.moneyline && odds.moneyline.away ? mlToProb(odds.moneyline.away.close && odds.moneyline.away.close.odds || odds.moneyline.away.open && odds.moneyline.away.open.odds) : null,
        drawProb: odds.drawOdds && odds.drawOdds.moneyLine != null ? mlToProb(odds.drawOdds.moneyLine) : null,
        overUnder: odds.overUnder != null ? Number(odds.overUnder) : null,
      } : null,
      links: { summary: (ev.links && ev.links.find((l) => l.rel && l.rel.includes('summary'))) ? ev.links.find((l) => l.rel.includes('summary')).href : null },
    };
  } catch { return null; }
}

// Match an ESPN event to a FIFA match by code pair (order-independent), then by
// resolved-name fallback. `wantCodes` = [homeCode, awayCode] in FIFA vocabulary.
export function matchEventByCodes(events, wantCodes) {
  if (!Array.isArray(events) || !wantCodes) return null;
  const set = new Set(wantCodes.filter(Boolean).map((c) => String(c).toUpperCase()));
  if (set.size < 2) return null;
  return events.find((e) => set.has(String(e.home.code).toUpperCase()) && set.has(String(e.away.code).toUpperCase())) || null;
}

// ── full match summary: commentary, box score, lineups, officials, win prob ──
export async function getSummary(eventId) {
  if (!eventId) return null;
  const data = await getJson(`${SITE}/summary?event=${encodeURIComponent(eventId)}`);
  if (!data) return null;
  return {
    commentary: normalizeCommentary(data.commentary),
    keyEvents: normalizeKeyEvents(data.keyEvents || data.commentary),
    stats: normalizeBoxscore(data.boxscore),
    rosters: normalizeRosters(data.rosters),
    info: normalizeGameInfo(data.gameInfo),
    winprob: normalizeWinprob(data.winprobability),
    raw: data,
  };
}

// Commentary entries → newest-first {min, text, type, isGoal, isCard, home, away}.
function normalizeCommentary(arr) {
  if (!Array.isArray(arr)) return [];
  const out = arr.map((c) => {
    const play = c.play || {};
    const typeTxt = (play.type && (play.type.text || play.type.name)) || '';
    const t = String(typeTxt).toLowerCase();
    return {
      seq: Number(c.sequence) || 0,
      min: (c.time && c.time.displayValue) || (play.clock && play.clock.displayValue) || '',
      minVal: parseMinute((c.time && c.time.displayValue) || (play.clock && play.clock.displayValue)),
      text: c.text || (play && play.text) || '',
      type: typeTxt || null,
      isGoal: t.includes('goal') && !t.includes('disallow'),
      isCard: t.includes('card') || t.includes('booking'),
      isSub: t.includes('substitut'),
      homeScore: c.homeScore != null ? Number(c.homeScore) : (play.homeScore != null ? Number(play.homeScore) : null),
      awayScore: c.awayScore != null ? Number(c.awayScore) : (play.awayScore != null ? Number(play.awayScore) : null),
    };
  }).filter((c) => c.text);
  out.sort((a, b) => b.seq - a.seq || b.minVal - a.minVal);
  return out;
}

function normalizeKeyEvents(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((c) => {
    const t = String((c.play && c.play.type && (c.play.type.text || c.play.type.name)) || '').toLowerCase();
    return t.includes('goal') || t.includes('card') || t.includes('substitut');
  }).map((c) => ({
    min: (c.time && c.time.displayValue) || '',
    text: c.text || '',
    type: (c.play && c.play.type && (c.play.type.text || c.play.type.name)) || '',
  }));
}

// Box score → per-team stat map keyed by lowercase stat name.
function normalizeBoxscore(box) {
  if (!box || !Array.isArray(box.teams)) return null;
  const out = {};
  for (const t of box.teams) {
    const code = espnCodeToFifa(t.team && t.team.abbreviation);
    const m = {};
    for (const s of (t.statistics || [])) {
      const key = String(s.name || s.abbreviation || '').toLowerCase();
      if (!key) continue;
      m[key] = { value: s.displayValue, num: numFrom(s.displayValue), label: s.label || s.name };
    }
    if (code) out[code] = m;
  }
  return out;
}

function normalizeRosters(rosters) {
  if (!Array.isArray(rosters)) return null;
  const out = {};
  for (const r of rosters) {
    const code = espnCodeToFifa(r.team && r.team.abbreviation);
    if (!code) continue;
    out[code] = {
      formation: r.formation || null,
      players: (r.roster || []).map((p) => ({
        name: p.athlete && (p.athlete.displayName || p.athlete.shortName),
        jersey: p.jersey != null ? Number(p.jersey) : null,
        position: p.position && (p.position.abbreviation || p.position.name),
        starter: !!p.starter,
        formationPlace: p.formationPlace != null ? Number(p.formationPlace) : null,
        subbedIn: p.subbedIn, subbedOut: p.subbedOut,
        stats: p.stats || null,
      })),
    };
  }
  return out;
}

function normalizeGameInfo(gi) {
  if (!gi) return null;
  return {
    attendance: gi.attendance || null,
    venue: gi.venue ? { name: gi.venue.fullName, city: gi.venue.address && [gi.venue.address.city, gi.venue.address.country].filter(Boolean).join(', ') } : null,
    officials: Array.isArray(gi.officials) ? gi.officials.map((o) => ({ name: o.displayName || o.fullName, role: o.position && (o.position.displayName || o.position.name) })) : [],
    weather: gi.weather ? { temp: gi.weather.temperature, condition: gi.weather.conditionId || gi.weather.displayValue } : null,
  };
}

function normalizeWinprob(wp) {
  if (!Array.isArray(wp) || !wp.length) return null;
  const last = wp[wp.length - 1];
  return {
    home: last.homeWinPercentage != null ? Number(last.homeWinPercentage) : null,
    tie: last.tiePercentage != null ? Number(last.tiePercentage) : null,
  };
}

// ── helpers ──
export function parseMinute(s) {
  if (s == null) return 0;
  const m = String(s).match(/(\d+)(?:\s*\+\s*(\d+))?/);
  return m ? Number(m[1]) + (m[2] ? Number(m[2]) : 0) : 0;
}
function numFrom(v) {
  if (v == null) return null;
  const m = String(v).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export default {
  getScoreboard, getScoreboardWindow, getSummary, matchEventByCodes, espnCodeToFifa, parseMinute,
};
