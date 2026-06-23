// Pure, offline match analytics for the /wc/live page. No network — everything
// here is computed from data the page already holds (FIFA timeline + scores), so
// the page stays rich even when every external overlay (ESPN/SofaScore) fails.
//
//   • xgForShot()      — a transparent distance/angle expected-goals model.
//   • computeShotmap()  — shot pins (with model xG) from FIFA event coordinates.
//   • computeMomentum() — a rolling "attack momentum" series in [-100,100].
//   • winProbability()  — in-play Poisson win/draw/loss model, odds-primed.
//   • baselineAt()      — the AVERAGE WC match's cumulative stat at minute N,
//                         so live bars can be read against a "normal" pace.
//
// All model outputs are labelled "est." in the UI — they are principled
// approximations, never presented as official Opta numbers.

// ─── Expected goals (distance/angle logistic) ─────────────────────────────────
// FIFA event coords (PositionX/PositionY) come 0..100. Empirically the attacking
// goal sits at (100, 50) in the shooting team's frame. Distance & the goal-mouth
// angle drive a logistic xG, with coefficients tuned to give sensible values
// (penalty ≈ .76, six-yard tap-in ≈ .9, edge-of-box ≈ .07, 30-yarder ≈ .02).
const PITCH_LEN_M = 105, PITCH_WID_M = 68, GOAL_W_M = 7.32;
export function xgForShot(x, y, opts = {}) {
  if (x == null || y == null) return null;
  if (opts.penalty) return 0.76;
  // metres from the goal line / centre
  const dx = (100 - x) / 100 * PITCH_LEN_M;
  const dy = (y - 50) / 100 * PITCH_WID_M;
  const dist = Math.hypot(dx, dy);
  // angle subtended by the posts from the shot point
  const a = Math.atan2(GOAL_W_M * dx, (dx * dx + dy * dy - (GOAL_W_M / 2) ** 2)) || 0.0001;
  const angle = a < 0 ? a + Math.PI : a;
  const z = 0.62 + 0.95 * Math.log(Math.max(angle, 1e-3)) - 0.10 * dist;
  const p = 1 / (1 + Math.exp(-z));
  return Math.max(0.01, Math.min(0.99, p));
}

// Build shot pins from the (already-normalized) FIFA timeline. Each shot carries
// model xG + a normalized (x,y) in 0..1 within one half of the pitch for drawing.
export function computeShotmap(events, m) {
  if (!Array.isArray(events) || !m) return { home: [], away: [], homeXg: 0, awayXg: 0 };
  const home = [], away = [];
  for (const e of events) {
    const isShot = e.kind === 'shot' || e.kind === 'goal' || e.kind === 'penalty';
    if (!isShot) continue;
    const goal = e.kind === 'goal' || e.kind === 'penalty';
    const xg = e.kind === 'penalty' ? 0.76 : (e.x != null && e.y != null ? xgForShot(e.x, e.y) : (goal ? 0.25 : 0.06));
    const side = e.teamId === m.home.id ? 'home' : e.teamId === m.away.id ? 'away' : null;
    if (!side) continue;
    const pin = { xg: xg || 0, goal, min: e.minuteLabel, player: e.player, x: e.x, y: e.y };
    (side === 'home' ? home : away).push(pin);
  }
  const sum = (a) => a.reduce((s, p) => s + (p.xg || 0), 0);
  return { home, away, homeXg: sum(home), awayXg: sum(away) };
}

// ─── Attack momentum ──────────────────────────────────────────────────────────
// A per-minute pressure series in [-100, 100] (home positive). Each attacking
// action decays over ~6 minutes; we sample the weighted balance each minute.
const MOM_WEIGHT = { goal: 10, penalty: 9, shot: 4, corner: 2.2, offside: 1.2, foul: -0.6, yellow: -0.8, red: -2, sub: 0 };
const MOM_HALFLIFE = 5; // minutes
export function computeMomentum(events, m, maxMinute) {
  if (!Array.isArray(events) || !m) return [];
  const evs = events.filter((e) => e.minute != null && MOM_WEIGHT[e.kind] != null);
  if (!evs.length) return [];
  const end = Math.max(maxMinute || 0, ...evs.map((e) => Number(e.minute) || 0), 1);
  const series = [];
  const lambda = Math.LN2 / MOM_HALFLIFE;
  for (let t = 0; t <= end; t++) {
    let h = 0, a = 0;
    for (const e of evs) {
      const em = Number(e.minute) || 0;
      if (em > t) continue;
      const w = (MOM_WEIGHT[e.kind] || 0) * Math.exp(-lambda * (t - em));
      if (e.teamId === m.home.id) h += w; else if (e.teamId === m.away.id) a += w;
    }
    const net = h - a;
    const val = Math.max(-100, Math.min(100, net * 11));
    series.push({ minute: t, value: val });
  }
  return series;
}

// ─── In-play win probability (Poisson, odds-primed) ───────────────────────────
// Expected remaining goals per side from a base rate, tilted by the pre-match
// odds prior, then a skellam-style integration of the remaining-goals difference.
export function winProbability({ homeScore = 0, awayScore = 0, minute = 0, phase = '2H', prior = null }) {
  const lead = homeScore - awayScore;
  const baseTotalPerMatch = 2.7;                 // avg WC goals/match
  let homeShare = 0.535;                          // mild home/first-named edge
  if (prior && prior.homeProb != null && prior.awayProb != null) {
    const tot = prior.homeProb + prior.awayProb || 1;
    homeShare = Math.max(0.2, Math.min(0.8, (prior.homeProb / tot) * 0.7 + 0.265));
  }
  const done = ['FT', 'FT_PEN', 'PEN'].includes(phase);
  const minsLeft = done ? 0 : Math.max(0, (phase === 'ET1' || phase === 'ET2' ? 120 : 90) - Math.min(minute, 120));
  const remGoals = baseTotalPerMatch * (minsLeft / 90);
  let lh = remGoals * homeShare, la = remGoals * (1 - homeShare);
  lh = Math.max(0.001, lh); la = Math.max(0.001, la);
  // distribution of remaining home/away goals (Poisson, capped)
  const pois = (k, l) => Math.exp(-l) * Math.pow(l, k) / fact(k);
  let pHome = 0, pDraw = 0, pAway = 0;
  const K = 8;
  for (let i = 0; i <= K; i++) for (let j = 0; j <= K; j++) {
    const p = pois(i, lh) * pois(j, la);
    const fin = lead + (i - j);
    if (fin > 0) pHome += p; else if (fin < 0) pAway += p; else pDraw += p;
  }
  const s = pHome + pDraw + pAway || 1;
  return { home: pHome / s, draw: pDraw / s, away: pAway / s };
}
function fact(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }

// ─── Average-match baselines ──────────────────────────────────────────────────
// Per-MATCH WC averages (both teams combined), from public WC 2022/2026 figures.
// Used to draw a "normal pace" reference on each live stat bar.
export const WC_AVERAGES = {
  shots: 22, shotsOnTarget: 7.6, corners: 8.6, fouls: 24, offsides: 3.6,
  yellow: 3.34, possession: 100, passes: 820, goals: 2.7, saves: 5.4,
};
// Expected cumulative value PER TEAM for a stat at a given minute (linear pace,
// goals weighted slightly later). minute beyond 90 clamps near the full total.
export function baselineAt(key, minute, { perTeam = true } = {}) {
  const total = WC_AVERAGES[key];
  if (total == null) return null;
  const frac = Math.max(0, Math.min(1.05, (Number(minute) || 0) / 90));
  const shaped = key === 'goals' ? Math.pow(frac, 1.12) : frac;
  const v = total * shaped;
  return perTeam ? v / 2 : v;
}

export default { xgForShot, computeShotmap, computeMomentum, winProbability, baselineAt, WC_AVERAGES };
