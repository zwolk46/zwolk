// SofaScore overlay client (BEST-EFFORT). Talks to a same-origin proxy
// (/api/sofa/* → api.sofascore.com/api/v1/*, added in middleware.js) because
// SofaScore is not CORS-open. It supplies the one feature class the official
// CORS-open sources can't: real per-shot xG/xGoT, an official attack-momentum
// curve, and a full statistics table.
//
// EVERYTHING degrades to null. SofaScore sits behind Cloudflare and may refuse
// the proxy's datacenter IP; when it does, the page falls back to the FIFA-
// coordinate model in lib/analytics.js and never breaks. The UI labels whichever
// source actually answered.

const BASE = '/api/sofa';

async function j(path) {
  try {
    const r = await fetch(`${BASE}${path}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const ymd = (d) => {
  const x = d instanceof Date ? d : new Date(d || Date.now());
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// Find the SofaScore event id for a match by team code/name pair. Tries the live
// list first (cheap, current), then the day's scheduled events.
export async function findEvent({ date, codes = [], names = [] } = {}) {
  const wantCodes = new Set(codes.filter(Boolean).map((c) => String(c).toUpperCase()));
  const wantNames = new Set(names.filter(Boolean).map(norm));
  const hit = (ev) => {
    const hc = ev.homeTeam && (ev.homeTeam.nameCode || '').toUpperCase();
    const ac = ev.awayTeam && (ev.awayTeam.nameCode || '').toUpperCase();
    const hn = norm(ev.homeTeam && ev.homeTeam.name), an = norm(ev.awayTeam && ev.awayTeam.name);
    const codeOk = wantCodes.size >= 2 && wantCodes.has(hc) && wantCodes.has(ac);
    const nameOk = wantNames.size >= 2 && wantNames.has(hn) && wantNames.has(an);
    return codeOk || nameOk;
  };
  const live = await j('/sport/football/events/live');
  let ev = live && Array.isArray(live.events) ? live.events.find(hit) : null;
  if (!ev) {
    const sched = await j(`/sport/football/scheduled-events/${ymd(date)}`);
    ev = sched && Array.isArray(sched.events) ? sched.events.find(hit) : null;
  }
  return ev ? ev.id : null;
}

export async function getMomentum(eventId) {
  const g = await j(`/event/${eventId}/graph`);
  if (!g || !Array.isArray(g.graphPoints)) return null;
  return g.graphPoints.map((p) => ({ minute: Number(p.minute), value: Number(p.value) })).filter((p) => !isNaN(p.minute));
}

export async function getShotmap(eventId, homeIsFirst = true) {
  const s = await j(`/event/${eventId}/shotmap`);
  const arr = s && (Array.isArray(s.shotmap) ? s.shotmap : Array.isArray(s) ? s : null);
  if (!arr) return null;
  const home = [], away = [];
  for (const sh of arr) {
    const xg = sh.xg != null ? Number(sh.xg) : null;
    const pin = {
      xg: xg || 0, xgot: sh.xgot != null ? Number(sh.xgot) : null,
      goal: String(sh.shotType || '').toLowerCase() === 'goal',
      player: sh.player && sh.player.name, min: sh.time != null ? `${sh.time}'` : '',
      situation: sh.situation, bodyPart: sh.bodyPart,
      x: sh.playerCoordinates && sh.playerCoordinates.x, y: sh.playerCoordinates && sh.playerCoordinates.y,
    };
    (sh.isHome ? home : away).push(pin);
  }
  const sum = (a) => a.reduce((s, p) => s + (p.xg || 0), 0);
  return { home, away, homeXg: sum(home), awayXg: sum(away), source: 'sofascore' };
}

export async function getStatistics(eventId) {
  const s = await j(`/event/${eventId}/statistics`);
  if (!s || !Array.isArray(s.statistics)) return null;
  const all = s.statistics.find((p) => (p.period || '').toUpperCase() === 'ALL') || s.statistics[0];
  if (!all || !Array.isArray(all.groups)) return null;
  const out = {};
  for (const g of all.groups) {
    for (const it of (g.statisticsItems || [])) {
      const key = norm(it.name);
      if (!key) continue;
      out[key] = { home: it.homeValue != null ? it.homeValue : it.home, away: it.awayValue != null ? it.awayValue : it.away, label: it.name };
    }
  }
  return out;
}

// One-shot: resolve the event then pull momentum + shotmap + stats in parallel.
export async function getOfficialFor({ date, codes, names }) {
  const id = await findEvent({ date, codes, names });
  if (!id) return null;
  const [momentum, shotmap, stats] = await Promise.all([getMomentum(id), getShotmap(id), getStatistics(id)]);
  if (!momentum && !shotmap && !stats) return null;
  return { id, momentum, shotmap, stats, source: 'sofascore' };
}

export default { findEvent, getMomentum, getShotmap, getStatistics, getOfficialFor };
