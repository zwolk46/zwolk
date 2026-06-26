// lib/forecast-data.js
// Pure helpers that assemble the Monte-Carlo context from loaded data, and a
// cache key from the current results. No fetching, no DOM — unit-testable.

import { groupsFromTeams } from './standings.js';

// Live wc2026api / FIFA spellings → the names used in data/teams.json.
export const NAME_ALIASES = {
  'Czechia': 'Czech Republic', 'Korea Republic': 'South Korea', 'South Korea': 'South Korea',
  'Côte d’Ivoire': 'Ivory Coast', "Côte d'Ivoire": 'Ivory Coast', 'Ivory Coast': 'Ivory Coast',
  'IR Iran': 'Iran', 'Iran': 'Iran', 'Congo DR': 'DR Congo', 'DR Congo': 'DR Congo',
  'Cabo Verde': 'Cape Verde', 'Cape Verde': 'Cape Verde',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina', 'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Türkiye': 'Turkey', 'Turkiye': 'Turkey', 'Turkey': 'Turkey',
  'United States': 'USA', 'USA': 'USA',
};

export function buildCodeIndex(teams) {
  const byName = {};
  for (const t of teams) { byName[t.name] = t.code; }
  // also index the alias source spellings
  for (const [alias, canon] of Object.entries(NAME_ALIASES)) {
    if (byName[canon]) byName[alias] = byName[canon];
  }
  return byName;
}

const num = (v) => (v == null || v === '' ? null : +v);

// Overlay live status/scores onto the static schedule, matched by match_number.
export function mergeLive(staticMatches, liveMatches) {
  const live = new Map();
  for (const m of (liveMatches || [])) if (m && m.match_number != null) live.set(+m.match_number, m);
  return staticMatches.map(s => {
    const l = live.get(+s.match_number);
    if (!l) return { ...s };
    return {
      ...s,
      status: l.status || s.status,
      phase: l.phase || s.phase,
      home_score: num(l.home_score) ?? s.home_score ?? null,
      away_score: num(l.away_score) ?? s.away_score ?? null,
      minute: l.minute ?? l.clock ?? null,
      redHome: l.redHome ?? 0, redAway: l.redAway ?? 0,
    };
  });
}

// Build the runForecast() context. teams = data/teams.json shape (name,code,group).
// Group results come from the LIVE feed (authoritative current scores + FIFA codes);
// the static schedule is used ONLY for the knockout wiring (source strings). We do
// NOT trust the checked-in group scores — they're sample data.
export function buildContext({ staticMatches, liveMatches, teams, elo, fifaRank, annexC }) {
  const codeByName = buildCodeIndex(teams);
  const codeOf = (name, given) => given || codeByName[name] || codeByName[NAME_ALIASES[name]] || null;
  const liveGroup = (liveMatches || []).filter(
    m => m && m.round === 'group' && (m.group_name || m.group) && (m.home_team || m.away_team));
  let groupMatches;
  if (liveGroup.length >= 48) {
    // Primary path: use the live group fixtures directly.
    groupMatches = liveGroup.map(m => ({
      match_number: m.match_number,
      group_name: m.group_name || m.group,
      home_team: m.home_team, away_team: m.away_team,
      home_code: codeOf(m.home_team, m.home_team_code),
      away_code: codeOf(m.away_team, m.away_team_code),
      home_score: m.home_score, away_score: m.away_score,
      status: m.status, phase: m.phase,
      minute: m.minute ?? null, redHome: m.redHome ?? 0, redAway: m.redAway ?? 0,
    }));
  } else {
    // Fallback only if live is unavailable: overlay whatever live we have onto static.
    const merged = mergeLive(staticMatches, liveMatches);
    groupMatches = merged.filter(m => m.round === 'group')
      .map(m => ({ ...m, home_code: codeOf(m.home_team, m.home_team_code), away_code: codeOf(m.away_team, m.away_team_code) }));
  }
  return {
    groups: groupsFromTeams(teams),
    groupMatches,
    staticMatches,           // for knockout wiring only (buildKnockout ignores group rows)
    elo: elo || {},
    fifaRank: fifaRank || {},
    annexC: annexC || {},
  };
}

// Stable cache key: only the things that change a forecast (group results + live state).
export function resultsHash(ctx) {
  const parts = [];
  for (const m of ctx.groupMatches) {
    if (m.status === 'finished') parts.push(`${m.match_number}=${m.home_score}-${m.away_score}`);
    else if (m.status === 'live') parts.push(`${m.match_number}~${m.home_score}-${m.away_score}@${m.phase || ''}`);
  }
  return parts.join('|');
}
