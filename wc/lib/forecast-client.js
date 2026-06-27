// lib/forecast-client.js
// Main-thread driver for the Monte-Carlo forecast. Loads the static spine, merges
// the live scores the page already has, runs the sim in a Web Worker, and caches
// the result by a hash of the current results so it only recomputes when scores
// actually change. No extra wc2026api calls — live scores are passed in.

import { buildContext, resultsHash } from './forecast-data.js';

const LIVE_ITERS = 12000;   // snappy, while a match is in play
const IDLE_ITERS = 20000;   // authoritative, between matches
const SEED = 20260611;      // fixed → all clients agree between matches

let _static = null;         // { staticMatches, teams, elo, fifaRank, annexC }
const _cache = new Map();   // hash → result
const _pending = new Map();  // hash → Promise
let _worker = null, _reqId = 0;
const _waiters = new Map();

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'force-cache' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}
async function ensureStatic() {
  if (_static) return _static;
  const [matches, teams, elo, annexC] = await Promise.all([
    loadJSON('/wc/data/matches.json'),
    loadJSON('/wc/data/teams.json'),
    loadJSON('/wc/data/enrichment/elo-ratings.json'),
    loadJSON('/wc/data/enrichment/annex-c.json'),
  ]);
  const eloMap = {}, fifaRank = {};
  for (const [c, v] of Object.entries(elo)) { eloMap[c] = v.current_rating; fifaRank[c] = v.current_rank || 9999; }
  _static = { staticMatches: matches, teams, elo: eloMap, fifaRank, annexC };
  return _static;
}

// Live group results, fetched + cached (~30s) so any page can get correct odds
// without re-plumbing the live feed. The groups page passes its own; others rely
// on this. Goes through the same wc2026api proxy (cached server-side too).
let _liveCache = null, _liveAt = 0;
// Exported so other modules (e.g. clinch.js) reuse the SAME cached live matches
// instead of making their own /matches call (which risks the daily rate cap).
export async function liveGroupMatches() {
  if (_liveCache && Date.now() - _liveAt < 30000) return _liveCache;
  try {
    const api = await import('./api.js');
    const r = await api.getMatches({ round: 'group' });
    _liveCache = Array.isArray(r) ? r : (r && r.data) || [];
    _liveAt = Date.now();
  } catch { _liveCache = _liveCache || []; }
  return _liveCache;
}

function getWorker() {
  if (_worker) return _worker;
  _worker = new Worker(new URL('./forecast-worker.js', import.meta.url), { type: 'module' });
  _worker.onmessage = (e) => {
    const { reqId, ok, res, error } = e.data || {};
    const w = _waiters.get(reqId); if (!w) return;
    _waiters.delete(reqId);
    ok ? w.resolve(res) : w.reject(new Error(error));
  };
  _worker.onerror = (err) => { for (const w of _waiters.values()) w.reject(err); _waiters.clear(); };
  return _worker;
}
function runInWorker(ctx, opts, mode) {
  return new Promise((resolve, reject) => {
    const reqId = ++_reqId;
    _waiters.set(reqId, { resolve, reject });
    getWorker().postMessage({ reqId, ctx, opts, mode });
  });
}

function anyLive(ctx) { return ctx.groupMatches.some(m => m.status === 'live'); }

// Public. opts: { liveMatches?, focusMatch?, iterations?, seed? }
export async function getForecast(opts = {}) {
  const s = await ensureStatic();
  const live = opts.liveMatches || await liveGroupMatches();
  const ctx = buildContext({ ...s, liveMatches: live });
  if (opts.focusMatch) ctx.focusMatch = +opts.focusMatch;
  const iterations = opts.iterations || (anyLive(ctx) ? LIVE_ITERS : IDLE_ITERS);
  const key = resultsHash(ctx) + '#' + (opts.focusMatch || '') + '#' + iterations;
  if (_cache.has(key)) return _cache.get(key);
  if (_pending.has(key)) return _pending.get(key);
  const p = runInWorker(ctx, { iterations, seed: opts.seed || SEED })
    .then(res => { _cache.set(key, res); _pending.delete(key); return res; })
    .catch(err => { _pending.delete(key); throw err; });
  _pending.set(key, p);
  return p;
}

// Cross-impact ("rooting guide"): for every team, P(team reaches R32 | each unplayed
// match's result) — powers "what each team needs from every other game". Heavier than
// a normal forecast, so cached hard by results-hash (only recomputes when scores change).
export async function getCrossImpact(opts = {}) {
  const s = await ensureStatic();
  const live = opts.liveMatches || await liveGroupMatches();
  const ctx = buildContext({ ...s, liveMatches: live });
  const iterations = opts.iterations || (anyLive(ctx) ? LIVE_ITERS : IDLE_ITERS);
  const key = 'X#' + resultsHash(ctx) + '#' + iterations;
  if (_cache.has(key)) return _cache.get(key);
  if (_pending.has(key)) return _pending.get(key);
  const p = runInWorker(ctx, { iterations, seed: opts.seed || SEED }, 'cross')
    .then((res) => { _cache.set(key, res); _pending.delete(key); return res; })
    .catch((err) => { _pending.delete(key); throw err; });
  _pending.set(key, p);
  return p;
}

// Synchronous helpers for the deterministic layer (no worker needed).
export async function getContext(liveMatches) {
  const s = await ensureStatic();
  return buildContext({ ...s, liveMatches: liveMatches || await liveGroupMatches() });
}
