// lib/standings.js
// ─────────────────────────────────────────────────────────────────────────────
// FIFA World Cup 2026 group-stage standings, tiebreakers, and third-place ranking.
// Pure & dependency-free so it can run identically on a page, in a Web Worker, or
// in a Node test. Operates on match objects shaped like data/matches.json:
//   { group_name, home_team, away_team, home_team_code?, away_team_code?,
//     home_score, away_score, status, cards? }
//   status ∈ 'scheduled' | 'live' | 'finished'
//
// FIFA 2026 WITHIN-GROUP order for teams level on points:
//   1) head-to-head: points → GD → goals, among the tied teams only, applied
//      recursively to any subset that stays tied
//   2) overall GD → overall goals → team-conduct score
//   3) FIFA world ranking
// THIRD-PLACED teams are ranked ACROSS groups (no head-to-head possible) by:
//   points → GD → goals → conduct → FIFA ranking
//
// includeLive:true counts in-progress matches provisionally (played++, current
// score contributes) and flags affected rows with `live:true`.
// ─────────────────────────────────────────────────────────────────────────────

const grp = (m) => m.group_name || m.group || m.letter;

function counts(status, includeLive) {
  return status === 'finished' || (status === 'live' && includeLive);
}

function blankRow(name, code) {
  return { team: name || code, code: code || null,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0,
    points: 0, conduct: 0, live: false, rank: 0 };
}

// Conduct (fair-play) score: yellow −1, second-yellow red −3, direct red −4,
// yellow+direct red −5. Optional; only used if a match carries a `cards` array
// like [{ side:'home'|'away', type:'yellow'|'yellow_red'|'red'|'yellow_direct_red' }].
const CARD_PTS = { yellow: -1, yellow_red: -3, red: -4, yellow_direct_red: -5 };

function membership(matches, group) {
  const letter = group && (group.group_name || group.name || group.letter || group.group);
  const map = new Map(); // dedup by code||name
  if (group && Array.isArray(group.teams)) {
    for (const t of group.teams) {
      const name = t.name || t.team, code = t.code || t.fifa_code || null;
      map.set(code || name, { name, code });
    }
  }
  if (!map.size) {
    for (const m of matches) {
      if (grp(m) !== letter) continue;
      if (m.home_team) map.set(m.home_team_code || m.home_team, { name: m.home_team, code: m.home_team_code || null });
      if (m.away_team) map.set(m.away_team_code || m.away_team, { name: m.away_team, code: m.away_team_code || null });
    }
  }
  return { letter, teams: [...map.values()] };
}

function sideRow(m, side, byKey) {
  const code = side === 'home' ? (m.home_team_code ?? m.home_code) : (m.away_team_code ?? m.away_code);
  const name = side === 'home' ? m.home_team : m.away_team;
  return (code && byKey.get(code)) || (name && byKey.get(name)) || null;
}

function accumulate(byKey, matches, letter, includeLive) {
  for (const m of matches) {
    if (grp(m) !== letter) continue;
    if (!counts(m.status, includeLive)) continue;
    if (m.home_score == null || m.away_score == null) continue;
    const h = sideRow(m, 'home', byKey), a = sideRow(m, 'away', byKey);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; a.lost++; h.points += 3; }
    else if (m.home_score < m.away_score) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
    if (m.status === 'live') { h.live = true; a.live = true; }
    if (Array.isArray(m.cards)) for (const c of m.cards) {
      const r = c.side === 'home' ? h : c.side === 'away' ? a : null;
      if (r) r.conduct += (CARD_PTS[c.type] || 0);
    }
  }
}

// Overall fallback comparator (FIFA steps 2–3). Higher conduct is better
// (conduct is ≤ 0); lower FIFA rank number is better.
function overallCmp(rankOf) {
  return (x, y) =>
    y.points - x.points || y.gd - x.gd || y.gf - x.gf ||
    (y.conduct - x.conduct) || (rankOf(x) - rankOf(y)) ||
    String(x.team).localeCompare(String(y.team));
}

// Rank a set of rows TIED on points using head-to-head, recursively, then overall.
function rankTied(tied, matches, letter, includeLive, byKey, fallbackCmp) {
  if (tied.length === 1) return tied.slice();
  const set = new Set(tied);
  const agg = new Map(tied.map(r => [r, { pts: 0, gd: 0, gf: 0 }]));
  for (const m of matches) {
    if (grp(m) !== letter || !counts(m.status, includeLive)) continue;
    if (m.home_score == null || m.away_score == null) continue;
    const H = sideRow(m, 'home', byKey), A = sideRow(m, 'away', byKey);
    if (!H || !A || !set.has(H) || !set.has(A)) continue; // matches AMONG the tied only
    const ah = agg.get(H), aa = agg.get(A);
    ah.gf += m.home_score; aa.gf += m.away_score;
    ah.gd += m.home_score - m.away_score; aa.gd += m.away_score - m.home_score;
    if (m.home_score > m.away_score) ah.pts += 3;
    else if (m.home_score < m.away_score) aa.pts += 3;
    else { ah.pts++; aa.pts++; }
  }
  const sorted = tied.slice().sort((x, y) => {
    const X = agg.get(x), Y = agg.get(y);
    return Y.pts - X.pts || Y.gd - X.gd || Y.gf - X.gf;
  });
  const runs = [];
  for (const r of sorted) {
    const M = agg.get(r), last = runs[runs.length - 1];
    if (last) { const L = agg.get(last[0]); if (L.pts === M.pts && L.gd === M.gd && L.gf === M.gf) { last.push(r); continue; } }
    runs.push([r]);
  }
  if (runs.length === 1) return tied.slice().sort(fallbackCmp); // H2H didn't separate → overall
  const out = [];
  for (const run of runs) out.push(...(run.length === 1 ? run : rankTied(run, matches, letter, includeLive, byKey, fallbackCmp)));
  return out;
}

// Build one group's table (sorted, ranked). opts: { includeLive, fifaRank:{CODE:rank} }
export function computeTable(matches, group, opts = {}) {
  const { includeLive = false, fifaRank = {} } = opts;
  const { letter, teams } = membership(matches, group);
  const rows = teams.map(t => blankRow(t.name, t.code));
  const byKey = new Map();
  teams.forEach((t, i) => { if (t.code) byKey.set(t.code, rows[i]); if (t.name) byKey.set(t.name, rows[i]); });
  accumulate(byKey, matches, letter, includeLive);
  for (const r of rows) r.gd = r.gf - r.ga;
  const rankOf = (r) => (r.code && fifaRank[r.code]) || 9999;
  const fallbackCmp = overallCmp(rankOf);
  const byPoints = rows.slice().sort((a, b) => b.points - a.points);
  const out = [];
  for (let i = 0; i < byPoints.length;) {
    let j = i; while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    const tied = byPoints.slice(i, j);
    out.push(...(tied.length === 1 ? tied : rankTied(tied, matches, letter, includeLive, byKey, fallbackCmp)));
    i = j;
  }
  out.forEach((r, idx) => { r.rank = idx + 1; });
  return out;
}

// Convenience: build group objects {group_name, teams:[{name,code}]} from teams.json.
export function groupsFromTeams(teams) {
  const by = new Map();
  for (const t of teams) {
    const g = t.group; if (!g) continue;
    if (!by.has(g)) by.set(g, { group_name: g, teams: [] });
    by.get(g).teams.push({ name: t.name, code: t.code });
  }
  return [...by.values()].sort((a, b) => a.group_name.localeCompare(b.group_name));
}

// Compute all 12 tables → { A:[...], B:[...], ... }.
export function computeAllTables(matches, groups, opts = {}) {
  const out = {};
  for (const g of groups) out[g.group_name || g.name || g.letter] = computeTable(matches, g, opts);
  return out;
}

// Rank the twelve third-placed teams across groups (no head-to-head).
export function rankThirds(tables, opts = {}) {
  const { fifaRank = {} } = opts;
  const rankOf = (r) => (r.code && fifaRank[r.code]) || 9999;
  const thirds = [];
  for (const [letter, table] of Object.entries(tables)) if (table[2]) thirds.push({ ...table[2], group: letter });
  thirds.sort((x, y) =>
    y.points - x.points || y.gd - x.gd || y.gf - x.gf ||
    (y.conduct - x.conduct) || (rankOf(x) - rankOf(y)) ||
    String(x.group).localeCompare(String(y.group)));
  thirds.forEach((t, i) => { t.thirdRank = i + 1; t.qualifies = i < 8; });
  return thirds;
}

// Sorted letters of the eight qualifying thirds → key into the Annex C table.
export function qualifiedThirdGroups(thirds) {
  return thirds.filter(t => t.qualifies).map(t => t.group).sort();
}

// Resolve which third-placed group fills each winner's R32 slot.
// annexC: { "<8 sorted letters>": { A:'C', B:'G', D:'B', E:'C', G:'A', I:'F', K:'D', L:'E' } }
// Returns { winnerGroup -> thirdGroupLetter } or null if the combination is unknown.
export function resolveThirdSlots(annexC, qualifiedGroups) {
  const key = [...qualifiedGroups].sort().join('');
  return (annexC && annexC[key]) || null;
}
