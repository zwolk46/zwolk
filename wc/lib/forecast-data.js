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
export function buildContext({ staticMatches, liveMatches, teams, elo, fifaRank, annexC }) {
  const codeByName = buildCodeIndex(teams);
  const merged = mergeLive(staticMatches, liveMatches);
  const code = (name) => codeByName[name] || codeByName[NAME_ALIASES[name]] || null;
  const groupMatches = merged
    .filter(m => m.round === 'group')
    .map(m => ({ ...m, home_code: code(m.home_team), away_code: code(m.away_team) }));
  return {
    groups: groupsFromTeams(teams),
    groupMatches,
    staticMatches: merged,
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
