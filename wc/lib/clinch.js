// lib/clinch.js — DETERMINISTIC qualification solver (exact, not Monte-Carlo).
//
// Tells whether a team has CLINCHED, is still ALIVE, or is ELIMINATED — by
// enumerating every bounded scoreline of the remaining group matches — and,
// for alive-but-not-clinched teams, the EXACT per-match conditions (margins +
// "or" cases) and the full route. Uses the app's own computeTable, so within-
// group ties resolve with the SAME head-to-head-first order as the rest of the app.
//
// Why this exists: the Monte-Carlo forecast (lib/forecast.js) gives a probability,
// which rounds sub-1/15000 survival paths to 0% and mislabels them "out". A team
// with ANY mathematical path is ALIVE here, never "eliminated".
//
// Public: analyzeTeam(matches, targetCode, { slots = 8, cap = 6 })
//   → { status:'clinched'|'alive'|'eliminated', via, allowance, perMatch:[…], thirdRace }
//   `matches` = live group matches (finished + remaining), same shape as the API.

import { computeTable } from './standings.js';

const isFin = (m) => m.status === 'finished' || m.status === 'completed' || (m.home_score != null && m.away_score != null);
const grpOf = (m) => m.group_name || m.group;
const codeH = (m) => m.home_team_code ?? m.home_code ?? m.home_team;
const codeA = (m) => m.away_team_code ?? m.away_code ?? m.away_team;
// strictly-better third (FIFA third-place race: pts → GD → GF). >0 ⇒ x ranks above y.
const betterThird = (x, y) => (x.points - y.points) || (x.gd - y.gd) || (x.gf - y.gf);

function synthMatch(L, hc, ac, hs, as) {
  return { group_name: L, home_code: hc, away_code: ac, home_team_code: hc, away_team_code: ac, home_team: hc, away_team: ac, home_score: hs, away_score: as, status: 'finished' };
}

// Enumerate one group's remaining matches over bounded scorelines.
// Returns { rem:[{mn,hc,ac}], outcomes:[{ res:{mn:[h,a]}, table, third, posOf:{code:pos} }] }.
function enumerateGroup(L, groupMatches, cap) {
  const finished = groupMatches.filter(isFin);
  const rem = groupMatches.filter((m) => !isFin(m)).map((m) => ({ mn: m.match_number, hc: codeH(m), ac: codeA(m) }));
  const outcomes = [];
  const N = rem.length;
  // odometer over N matches × (cap+1)^2 scorelines each
  const dims = N * 2; const idx = new Array(dims).fill(0); const base = cap + 1;
  const total = Math.pow(base, dims);
  for (let n = 0; n < total; n++) {
    let x = n; for (let d = 0; d < dims; d++) { idx[d] = x % base; x = (x / base) | 0; }
    const synth = []; const res = {};
    for (let i = 0; i < N; i++) { const h = idx[2 * i], a = idx[2 * i + 1]; synth.push(synthMatch(L, rem[i].hc, rem[i].ac, h, a)); res[rem[i].mn] = [h, a]; }
    const table = computeTable([...finished, ...synth], { group_name: L }, { includeLive: false });
    const posOf = {}; table.forEach((r, i) => { if (r.code) posOf[r.code] = i + 1; });
    outcomes.push({ res, third: table[2] ? { code: table[2].code, points: table[2].points, gd: table[2].gd, gf: table[2].gf } : null, posOf });
  }
  return { rem, outcomes };
}

// summarise a set of acceptable goal-margins (home − away) into readable text
function describeNeed(hc, ac, ok, all) {
  if (ok.size === 0) return { text: 'impossible', kind: 'none' };
  if (ok.size === all.size) return { text: 'any result', kind: 'any' };
  const A = [...all], O = [...ok];
  const homeAll = A.filter((d) => d > 0), awayAll = A.filter((d) => d < 0).map((d) => -d);
  const homeOk = O.filter((d) => d > 0), drawOk = O.includes(0), awayOk = O.filter((d) => d < 0).map((d) => -d);
  const parts = [];
  if (homeOk.length) {
    if (homeOk.length === homeAll.length) parts.push(`${hc} win`);
    else parts.push(`${hc} win by ${Math.min(...homeOk)}+`);
  }
  if (drawOk) parts.push('draw');
  if (awayOk.length) {
    const lo = Math.min(...awayOk), hi = Math.max(...awayOk);
    if (awayOk.length === awayAll.length) parts.push(`${ac} win`);
    else if (hi >= Math.max(...awayAll)) parts.push(`${ac} win by ${lo}+`);
    else parts.push(`${ac} win by ${lo}–${hi}`);
  }
  return { text: parts.join(' or '), kind: 'cond' };
}

export function analyzeTeam(matches, target, opts = {}) {
  const { slots = 8, cap = 6 } = opts;
  const letters = [...new Set(matches.map(grpOf).filter(Boolean))].sort();
  const byGroup = {}; for (const L of letters) byGroup[L] = matches.filter((m) => grpOf(m) === L);
  const isComplete = (L) => byGroup[L].every(isFin);
  const tableNow = {}; for (const L of letters) tableNow[L] = computeTable(byGroup[L], { group_name: L }, { includeLive: true });

  const tg = letters.find((L) => (tableNow[L] || []).some((r) => r.code === target));
  if (!tg) return { status: 'unknown' };
  const myPosNow = tableNow[tg].findIndex((r) => r.code === target) + 1;

  // Complete group, simple cases
  if (isComplete(tg)) {
    if (myPosNow <= 2) return { status: 'clinched', via: 'group', perMatch: [], thirdRace: null };
    if (myPosNow === 4) return { status: 'eliminated', via: 'group', perMatch: [], thirdRace: null };
    // 3rd in a complete group → pure third-place race
    return thirdRace(target, tableNow[tg][2], letters, byGroup, tableNow, isComplete, { slots, cap, ownGroup: tg });
  }
  // Incomplete target group: enumerate it for position + record, then third-race per scenario.
  return incompleteTarget(target, tg, letters, byGroup, tableNow, isComplete, { slots, cap });
}

// ── third-place race for a team whose record is fixed (complete group, 3rd) ──
function thirdRace(target, myThird, letters, byGroup, tableNow, isComplete, opts) {
  const { slots, cap, ownGroup } = opts;
  const R = { points: myThird.points, gd: myThird.gd, gf: myThird.gf };
  // fixed thirds from OTHER complete groups
  let fixedAbove = 0;
  for (const L of letters) {
    if (L === ownGroup || !isComplete(L)) continue;
    const t = tableNow[L][2]; if (t && betterThird(t, R) > 0) fixedAbove++;
  }
  const A = (slots - 1) - fixedAbove; // variable thirds target can afford above it
  // incomplete groups (variable thirds)
  const varGroups = letters.filter((L) => !isComplete(L) && L !== ownGroup);
  const enol = {}; for (const L of varGroups) enol[L] = enumerateGroup(L, byGroup[L], cap);
  const canNotAbove = {}; const canBeAbove = {};
  for (const L of varGroups) {
    canNotAbove[L] = enol[L].outcomes.some((o) => o.third && betterThird(o.third, R) <= 0);
    canBeAbove[L] = enol[L].outcomes.some((o) => o.third && betterThird(o.third, R) > 0);
  }
  const minAbove = A < 0 ? 99 : varGroups.filter((L) => !canNotAbove[L]).length;
  const maxAbove = varGroups.filter((L) => canBeAbove[L]).length;
  let status = 'alive';
  if (A < 0 || minAbove > A) status = 'eliminated';
  else if (maxAbove <= A) status = 'clinched';

  // per-match needs
  const otherMin = (L) => varGroups.filter((x) => x !== L && !canNotAbove[x]).length;
  const perMatch = [];
  if (status === 'alive') {
    for (const L of varGroups) for (const r of enol[L].rem) {
      const all = new Set(), ok = new Set();
      for (const o of enol[L].outcomes) {
        const [h, a] = o.res[r.mn]; const d = h - a; all.add(d);
        const compat = enol[L].outcomes.some((o2) => { const [hh, aa] = o2.res[r.mn]; return (hh - aa) === d && o2.third && betterThird(o2.third, R) <= 0; });
        if (otherMin(L) + (compat ? 0 : 1) <= A) ok.add(d);
      }
      const need = describeNeed(r.hc, r.ac, ok, all);
      perMatch.push({ mn: r.mn, group: L, hc: r.hc, ac: r.ac, ...need });
    }
  }
  return { status, via: 'third', allowance: A, fixedAbove, perMatch, thirdRace: { record: R, varGroups, canNotAbove } };
}

// ── target still playing: enumerate own group, combine with third race ──
function incompleteTarget(target, tg, letters, byGroup, tableNow, isComplete, opts) {
  const { slots, cap } = opts;
  const own = enumerateGroup(tg, byGroup[tg], cap);
  // For each own-group outcome: top-2 ⇒ through; 3rd ⇒ depends on third race; 4th ⇒ no.
  // Build the per-outcome qualification, then aggregate status + per-match needs.
  const otherVar = letters.filter((L) => !isComplete(L) && L !== tg);
  const enol = {}; for (const L of otherVar) enol[L] = enumerateGroup(L, byGroup[L], cap);
  // best-case (max) and worst-case (min) thirds from other variable groups vs a record R:
  const fixedAboveOf = (R) => {
    let n = 0; for (const L of letters) { if (L === tg || !isComplete(L)) continue; const t = tableNow[L][2]; if (t && betterThird(t, R) > 0) n++; } return n;
  };
  const minOtherAbove = (R) => otherVar.filter((L) => !enol[L].outcomes.some((o) => o.third && betterThird(o.third, R) <= 0)).length;

  let anyQual = false, allQual = own.outcomes.length > 0;
  const okMargins = {}; // mn -> Set of acceptable margins (target still alive)
  const allMargins = {};
  const addMargin = (mn, d, set) => { (set[mn] = set[mn] || new Set()).add(d); };
  for (const o of own.outcomes) {
    const pos = o.posOf[target];
    let qual;
    if (pos <= 2) qual = true;
    else if (pos === 4) qual = false;
    else { const R = o.third; const A = (slots - 1) - fixedAboveOf(R); qual = A >= 0 && minOtherAbove(R) <= A; }
    anyQual = anyQual || qual; allQual = allQual && qual;
    for (const r of own.rem) { const [h, a] = o.res[r.mn]; const d = h - a; addMargin(r.mn, d, allMargins); if (qual) addMargin(r.mn, d, okMargins); }
  }
  const status = !anyQual ? 'eliminated' : allQual ? 'clinched' : 'alive';
  const perMatch = [];
  if (status === 'alive') for (const r of own.rem) {
    const need = describeNeed(r.hc, r.ac, okMargins[r.mn] || new Set(), allMargins[r.mn] || new Set());
    perMatch.push({ mn: r.mn, group: tg, hc: r.hc, ac: r.ac, ...need, own: true });
  }
  return { status, via: 'mixed', perMatch, thirdRace: null };
}
