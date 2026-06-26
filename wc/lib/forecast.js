// lib/forecast.js
// ─────────────────────────────────────────────────────────────────────────────
// Elo + Poisson Monte Carlo forecast for the World Cup 2026, "all the way to the
// trophy". Pure & dependency-free apart from standings.js. Designed to run in a
// Web Worker; deterministic for a given seed so all clients agree between matches.
//
//   • Unplayed group games are sampled from an Elo→expected-goals→Poisson model.
//   • Live games are sampled from the in-play remaining-time distribution, with
//     RED CARDS shifting each side's remaining expected goals (not just a trigger).
//   • Finished games are fixed.
//   • Each simulated tournament: build group tables (FIFA tiebreakers, standings.js)
//     → rank thirds → Annex C slotting → simulate R32…Final.
//   • Aggregate per-team odds (qualify, win group, finish 1st/2nd/3rd, reach each
//     round, win it) + each third-placed team's R32 destination distribution.
//   • Dead-rubber dampening: a team with nothing to play for is modelled slightly
//     weaker (squad rotation), tunable / disableable.
// ─────────────────────────────────────────────────────────────────────────────

import { computeAllTables, rankThirds, qualifiedThirdGroups, resolveThirdSlots } from './standings.js';

export const CONFIG = {
  muTot: 2.75,         // baseline total goals per match (WC average)
  supPerElo: 1 / 220,  // goal supremacy per Elo point of difference
  hostBumpElo: 60,     // crowd bump for host nations (USA/CAN/MEX) every match
  minLambda: 0.15,
  redAtkMult: 0.74,    // a red-carded team's remaining attack ×
  redDefMult: 1.25,    // …and what it concedes ×
  deadEloPenalty: 70,  // effective-Elo hit for a team with nothing to play for
  seedEloPenalty: 25,  // smaller hit when only seeding (not qualification) is at stake
  defaultIterations: 40000,
};
const HOSTS = new Set(['USA', 'CAN', 'MEX']);

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
export function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(lambda, rng) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

// ── Elo → expected goals ──────────────────────────────────────────────────────
function lambdas(eloH, eloA) {
  const sup = (eloH - eloA) * CONFIG.supPerElo;
  return {
    lh: Math.max(CONFIG.minLambda, (CONFIG.muTot + sup) / 2),
    la: Math.max(CONFIG.minLambda, (CONFIG.muTot - sup) / 2),
  };
}
function sampleScore(eloH, eloA, rng) {
  const { lh, la } = lambdas(eloH, eloA);
  return { h: poisson(lh, rng), a: poisson(la, rng) };
}
// In-play: project a live match to its FINAL score from current state + red cards.
function sampleLiveFinal(m, eloH, eloA, rng) {
  const minute = Math.min(90, Math.max(0, m.minute || minuteFromPhase(m.phase)));
  const frac = Math.max(0, (90 - minute) / 90);
  let { lh, la } = lambdas(eloH, eloA);
  lh *= frac; la *= frac;
  const redH = m.redHome || 0, redA = m.redAway || 0;
  for (let i = 0; i < redH; i++) { lh *= CONFIG.redAtkMult; la *= CONFIG.redDefMult; }
  for (let i = 0; i < redA; i++) { la *= CONFIG.redAtkMult; lh *= CONFIG.redDefMult; }
  return { h: (m.home_score || 0) + poisson(lh, rng), a: (m.away_score || 0) + poisson(la, rng) };
}
function minuteFromPhase(phase) {
  return ({ PRE: 0, '1H': 25, HT: 45, '2H': 70, ET1: 100, ET2: 115, PEN: 120, FT: 90, FT_PEN: 120 })[phase] ?? 0;
}

// ── Knockout bracket wiring (parsed once from static matches.json shapes) ──────
export function buildKnockout(staticMatches) {
  const ko = {};
  const parse = (src) => {
    let mr;
    if (!src) return null;
    if ((mr = /^Winner Group ([A-L])$/.exec(src))) return { t: 'winGroup', g: mr[1] };
    if ((mr = /^Runner-up Group ([A-L])$/.exec(src))) return { t: 'runGroup', g: mr[1] };
    if (/3rd/i.test(src) && /Group/i.test(src)) return { t: 'third' };
    if ((mr = /^Winner of Match (\d+)$/.exec(src))) return { t: 'winMatch', m: +mr[1] };
    if ((mr = /^Loser of Match (\d+)$/.exec(src))) return { t: 'loseMatch', m: +mr[1] };
    return null;
  };
  for (const m of staticMatches) {
    if (m.round === 'group') continue;
    ko[m.match_number] = { round: m.round, home: parse(m.home_team_source), away: parse(m.away_team_source) };
  }
  return ko;
}

// ── One simulated tournament ──────────────────────────────────────────────────
function simulateOnce(ctx, rng, rec) {
  const { groups, groupMatches, ko, elo, fifaRank, deadByMatch } = ctx;
  const eff = (code) => (elo[code] || 1500) + (HOSTS.has(code) ? CONFIG.hostBumpElo : 0);

  // 1) realise every group match
  const played = [];
  for (const m of groupMatches) {
    if (m.status === 'finished') { played.push(m); continue; }
    let h, a;
    const eH = eff(m.home_code) - penalty(deadByMatch, m, 'home');
    const eA = eff(m.away_code) - penalty(deadByMatch, m, 'away');
    if (m.status === 'live') ({ h, a } = sampleLiveFinal(m, eH, eA, rng));
    else ({ h, a } = sampleScore(eH, eA, rng));
    played.push({ ...m, home_score: h, away_score: a, status: 'finished' });
    const res = h > a ? 'H' : h < a ? 'A' : 'D';
    if (rec && rec.focus === m.match_number) rec.focusResult = res;
    if (rec && rec.results) rec.results[m.match_number] = res;   // for the cross-impact pass
  }

  // 2) tables, thirds, Annex C slotting
  const tables = computeAllTables(played, groups, { fifaRank });
  const thirds = rankThirds(tables, { fifaRank });
  const qThird = qualifiedThirdGroups(thirds);
  const slotMap = resolveThirdSlots(ctx.annexC, qThird) || {};
  const thirdTeamByGroup = {}; for (const t of thirds) if (t.qualifies) thirdTeamByGroup[t.group] = t;

  // record finishing positions
  for (const [g, table] of Object.entries(tables)) {
    for (const row of table) if (row.code) (rec.t[row.code] ||= {}); // register all 4 (incl. teams locked in 4th → 0%)
    mark(rec, table[0].code, 'first'); mark(rec, table[0].code, 'qualify');
    mark(rec, table[1].code, 'second'); mark(rec, table[1].code, 'qualify');
    const third = table[2];
    mark(rec, third.code, 'third');
    if (thirdTeamByGroup[g] && thirdTeamByGroup[g].code === third.code) mark(rec, third.code, 'qualify');
  }

  // 3) knockout
  const winnerOf = {}, loserOf = {};
  const teamForThird = (winnerGroup) => { const tg = slotMap[winnerGroup]; return tg ? thirdTeamByGroup[tg] : null; };
  const resolve = (slot, matchNo, side, ctxMatch) => {
    if (!slot) return null;
    switch (slot.t) {
      case 'winGroup': return tables[slot.g][0];
      case 'runGroup': return tables[slot.g][1];
      case 'winMatch': return winnerOf[slot.m];
      case 'loseMatch': return loserOf[slot.m];
      case 'third': {            // the sibling side is the winGroup that owns this slot
        const sib = side === 'home' ? ctxMatch.away : ctxMatch.home;
        return sib && sib.t === 'winGroup' ? teamForThird(sib.g) : null;
      }
    }
    return null;
  };
  for (let n = 73; n <= 104; n++) {
    const km = ko[n]; if (!km) continue;
    const home = resolve(km.home, n, 'home', km);
    const away = resolve(km.away, n, 'away', km);
    if (km.round === 'third_place') continue; // 3rd-place playoff: not scored into "reach" tallies
    if (!home || !away) continue;
    const reach = ROUND_REACH[km.round];
    if (reach) { mark(rec, home.code, reach); mark(rec, away.code, reach); }
    const s = sampleScore(eff(home.code), eff(away.code), rng);
    let winner, loser;
    if (s.h === s.a) { (rng() < 0.5) ? (winner = home, loser = away) : (winner = away, loser = home); }
    else if (s.h > s.a) { winner = home; loser = away; } else { winner = away; loser = home; }
    winnerOf[n] = winner; loserOf[n] = loser;
    if (km.round === 'final') mark(rec, winner.code, 'champion');
  }
}
const ROUND_REACH = { round_of_32: 'r32', round_of_16: 'r16', quarter_final: 'qf', semi_final: 'sf', final: 'finalist' };
function mark(rec, code, key) { if (!rec || !code) return; (rec.t[code] ||= {}); rec.t[code][key] = (rec.t[code][key] || 0) + 1; }
function penalty(deadByMatch, m, side) {
  if (!deadByMatch) return 0;
  const tier = deadByMatch[`${m.match_number}:${side}`];
  return tier === 'dead' ? CONFIG.deadEloPenalty : tier === 'seeding' ? CONFIG.seedEloPenalty : 0;
}

// ── Public: run the Monte Carlo ───────────────────────────────────────────────
// ctx: { groups, groupMatches:[{..,home_code,away_code,status,scores}], staticMatches,
//        elo:{CODE:rating}, fifaRank:{CODE:rank}, annexC, deadByMatch?, focusMatch? }
export function runForecast(ctx, opts = {}) {
  const { iterations = CONFIG.defaultIterations, seed = 12345 } = opts;
  const focusMatch = opts.focusMatch ?? ctx.focusMatch ?? null;
  const rng = rngFrom(seed);
  ctx.ko = buildKnockout(ctx.staticMatches);
  const rec = { t: {}, focus: focusMatch };
  const focusBuckets = focusMatch ? { H: blankAgg(), D: blankAgg(), A: blankAgg() } : null;
  let counts = {};
  for (let i = 0; i < iterations; i++) {
    rec.t = {}; rec.focusResult = null;
    simulateOnce(ctx, rng, rec);
    for (const [code, ev] of Object.entries(rec.t)) {
      const c = (counts[code] ||= blankAgg());
      for (const k in ev) c[k] = (c[k] || 0) + (ev[k] ? 1 : 0);
    }
    if (focusBuckets && rec.focusResult) {
      const fb = focusBuckets[rec.focusResult]; fb._n++;
      for (const [code, ev] of Object.entries(rec.t)) { const c = (fb[code] ||= blankAgg()); for (const k in ev) c[k] = (c[k] || 0) + (ev[k] ? 1 : 0); }
    }
  }
  const probs = {};
  for (const [code, c] of Object.entries(counts)) probs[code] = toProb(c, iterations);
  const out = { iterations, seed, teams: probs };
  if (focusBuckets) {
    const fm = ctx.groupMatches.find((x) => x.match_number === focusMatch);
    out.focus = { match: focusMatch, homeCode: fm && fm.home_code, awayCode: fm && fm.away_code };
    for (const r of ['H', 'D', 'A']) {
      const n = focusBuckets[r]._n; const tp = {};
      for (const [code, c] of Object.entries(focusBuckets[r])) if (code !== '_n') tp[code] = toProb(c, n || 1);
      out.focus[r] = { p: n / iterations, teams: tp };
    }
  }
  return out;
}
// ── Cross-impact ("rooting guide") ────────────────────────────────────────────
// One Monte-Carlo pass that records, for every not-yet-finished group match M and
// every team T, P(T reaches the Round of 32 | M ends home-win / draw / away-win).
// From this we can tell, for any team, which other matches move their odds and
// which result they should root for — and for any match, who else is watching.
export function runCrossImpact(ctx, { iterations = 20000, seed = 20260611 } = {}) {
  const rng = rngFrom(seed);
  ctx.ko = buildKnockout(ctx.staticMatches);
  const teamCodes = [], teamIndex = {};
  for (const g of ctx.groups) for (const t of g.teams) if (t.code && !(t.code in teamIndex)) { teamIndex[t.code] = teamCodes.length; teamCodes.push(t.code); }
  const nT = teamCodes.length;
  const impact = ctx.groupMatches.filter((m) => m.status !== 'finished');
  const mIndex = {}; impact.forEach((m, i) => { mIndex[m.match_number] = i; });
  const nM = impact.length;
  const RI = { H: 0, D: 1, A: 2 };
  const nCount = new Int32Array(nM * 3);              // sims with each result
  const qCount = new Int32Array(nM * 3 * nT);         // …in which team T qualified
  const rec = { t: {}, results: {} };
  for (let it = 0; it < iterations; it++) {
    rec.t = {}; rec.results = {};
    simulateOnce(ctx, rng, rec);
    const qIdx = [];
    for (const code in rec.t) if (rec.t[code].qualify && (code in teamIndex)) qIdx.push(teamIndex[code]);
    for (let i = 0; i < nM; i++) {
      const r = rec.results[impact[i].match_number]; if (r == null) continue;
      const base = i * 3 + RI[r];
      nCount[base]++;
      const off = base * nT;
      for (let k = 0; k < qIdx.length; k++) qCount[off + qIdx[k]]++;
    }
  }
  const cross = {};
  for (let i = 0; i < nM; i++) {
    const m = impact[i];
    const entry = { matchNumber: m.match_number, group: m.group_name, homeCode: m.home_code, awayCode: m.away_code, status: m.status, p: {}, qual: {} };
    for (const r of ['H', 'D', 'A']) {
      const ri = RI[r], n = nCount[i * 3 + ri];
      entry.p[r] = n / iterations;
      const off = (i * 3 + ri) * nT;
      for (let ti = 0; ti < nT; ti++) {
        const c = qCount[off + ti];
        if (n) (entry.qual[teamCodes[ti]] ||= {})[r] = c / n;
      }
    }
    cross[m.match_number] = entry;
  }
  return { iterations, seed, teamCodes, cross };
}

function blankAgg() { return { _n: 0 }; }
function toProb(c, n) {
  const keys = ['qualify', 'first', 'second', 'third', 'r32', 'r16', 'qf', 'sf', 'finalist', 'champion'];
  const o = {}; for (const k of keys) o[k] = (c[k] || 0) / n; return o;
}
