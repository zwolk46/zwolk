// Static JSON loader with in-memory cache. Every helper here works against
// data that's checked into the repo (teams-48, countries, etc.) — none of it
// touches wc2026api.com. Use the wrappers in api.js for live data.
//
// All requests use { cache: 'force-cache' } because these files are versioned
// in the repo and only change when re-deployed.

const CACHE = new Map();

async function loadJson(path) {
  if (CACHE.has(path)) return CACHE.get(path);
  const promise = fetch(path, { cache: 'force-cache' }).then((r) => {
    if (!r.ok) throw new Error(`failed to load ${path}: ${r.status}`);
    return r.json();
  });
  CACHE.set(path, promise);
  return promise;
}

// 48-team backbone, keyed by FIFA 3-letter code.
export const getTeams48 = () => loadJson('/wc/data/enrichment/teams-48.json');

// Per-team country profile (capital, languages, currencies, flag URL, tz).
export const getCountries = () => loadJson('/wc/data/enrichment/countries.json');

// Predictive Elo (pre-tournament + history).
export const getEloRatings = () => loadJson('/wc/data/enrichment/elo-ratings.json');

// Official FIFA rank (2026-06-11 snapshot + live values).
export const getFifaRankings = () => loadJson('/wc/data/enrichment/fifa-rankings.json');

// All-time team records (W/D/L since 1872).
export const getTeamRecords = () => loadJson('/wc/data/enrichment/team-all-time-records.json');

// Head-to-head, keyed by sorted-pair string "ARG_BRA".
export const getHeadToHead = () => loadJson('/wc/data/enrichment/head-to-head.json');

// Stadium weather forecast per match day.
export const getStadiumWeather = () => loadJson('/wc/data/enrichment/stadium-weather.json');

// TheSportsDB team enrichment (badges, stadium imagery, socials).
export const getSportsdbTeams = () => loadJson('/wc/data/enrichment/sportsdb-teams.json');

// Golden boot / tournament scorers (aggregated from live match timelines).
// Shape: { _meta, leaderboard:[{rank,player,team,goals,...}], by_team:{CODE:[...]}, own_goals:[] }.
export const getTournamentScorers = () =>
  loadJson('/wc/data/enrichment/tournament-scorers.json').catch(() => null);

// TheSportsDB player thumbnails, keyed by player name → { thumb, cutout, team }.
export const getPlayerThumbs = () =>
  loadJson('/wc/data/enrichment/sportsdb-player-thumbs.json').catch(() => null);

// World cup history (per-tournament results) + 2026 reference (teams/stadiums/groups/squads).
export const getWcYear = (year) => loadJson(`/wc/data/enrichment/worldcup-history/${year}.json`);
export const get2026Squads = () => loadJson('/wc/data/enrichment/worldcup-history/2026.squads.json');
export const get2026Stadiums = () => loadJson('/wc/data/enrichment/worldcup-history/2026.stadiums.json');
export const get2026Groups = () => loadJson('/wc/data/enrichment/worldcup-history/2026.groups.json');

// Forvo pronunciation file. Shape: { _meta, countries: {name: {mp3,...}}, players: {name: {mp3,...}} }.
// Use pronounce() below to fish out the MP3 URL — direct lookup won't work because
// of the countries/players sub-keys.
export const getPronunciations = () =>
  loadJson('/wc/data/enrichment/pronunciations.json').catch(() => ({}));

// Resolves a pronunciation MP3 URL for a name (or null). `kind` is 'players' or 'countries'.
export function pronounce(prons, name, kind = 'players') {
  if (!prons || !name) return null;
  const bucket = prons[kind];
  if (!bucket || typeof bucket !== 'object') return null;
  const entry = bucket[name];
  return entry && entry.mp3 ? entry.mp3 : null;
}

// Sample fallback datasets (only used when the live API is unreachable).
export const getMatchesSample = () => loadJson('/wc/data/matches.json');
export const getStadiumsSample = () => loadJson('/wc/data/stadiums.json');
export const getGroupsSample = () => loadJson('/wc/data/groups.json');
export const getPlayersSample = () => loadJson('/wc/data/players.json');
export const getPlayersByTeamSample = () => loadJson('/wc/data/players-by-team.json');

// ─── Built indices ───────────────────────────────────────────────────────────
// resolveTeam(name)  → { code, name, name_normalised, group, confed, ... } | null
//   Looks up by both `name` AND `name_normalised` so the live API's preferred
//   spelling matches regardless of which the source uses.
// Alias table: maps the spellings the LIVE wc2026api.com uses (and other common
// variants across enrichment sources) onto our canonical teams-48 FIFA codes.
// Without this, names like "Czechia" or "Korea Republic" from the live API fail
// to resolve and the team/flag/enrichment joins break. Keep code → record stable.
export const TEAM_NAME_ALIASES = {
  'Czechia': 'CZE', 'Czech Republic': 'CZE',
  'Korea Republic': 'KOR', 'South Korea': 'KOR', 'Korea, Republic of': 'KOR',
  "Côte d'Ivoire": 'CIV', "Cote d'Ivoire": 'CIV', 'Ivory Coast': 'CIV',
  'IR Iran': 'IRN', 'Iran': 'IRN', 'Iran (Islamic Republic of)': 'IRN',
  'Congo DR': 'COD', 'DR Congo': 'COD', 'DR Congo (Kinshasa)': 'COD', 'Democratic Republic of the Congo': 'COD',
  'Cabo Verde': 'CPV', 'Cape Verde': 'CPV',
  'Bosnia-Herzegovina': 'BIH', 'Bosnia & Herzegovina': 'BIH', 'Bosnia and Herzegovina': 'BIH',
  'Türkiye': 'TUR', 'Turkiye': 'TUR', 'Turkey': 'TUR',
  'USA': 'USA', 'United States': 'USA', 'United States of America': 'USA',
};

let _teamsIndex = null;
async function teamsIndex() {
  if (_teamsIndex) return _teamsIndex;
  const teams = await getTeams48();
  const byName = new Map();
  const byCode = new Map();
  for (const t of teams) {
    byName.set(t.name, t);
    if (t.name_normalised && t.name_normalised !== t.name) byName.set(t.name_normalised, t);
    byCode.set(t.fifa_code, t);
  }
  // Wire every alias to the canonical record (only if the canonical code exists).
  for (const [alias, code] of Object.entries(TEAM_NAME_ALIASES)) {
    const rec = byCode.get(code);
    if (rec && !byName.has(alias)) byName.set(alias, rec);
  }
  _teamsIndex = { teams, byName, byCode };
  return _teamsIndex;
}

export async function resolveTeam(nameOrCode) {
  if (!nameOrCode) return null;
  const idx = await teamsIndex();
  return idx.byName.get(nameOrCode) || idx.byCode.get(nameOrCode) || null;
}

export async function teamByCode(code) {
  if (!code) return null;
  const idx = await teamsIndex();
  return idx.byCode.get(code) || null;
}

export async function allTeams() {
  const idx = await teamsIndex();
  return idx.teams;
}

// Synchronous lookup — only useful after teamsIndex() has been awaited at least
// once on the page. Returns null if the cache isn't warm.
export function teamSync(nameOrCode) {
  if (!_teamsIndex || !nameOrCode) return null;
  return _teamsIndex.byName.get(nameOrCode) || _teamsIndex.byCode.get(nameOrCode) || null;
}
export function teamsReady() { return !!_teamsIndex; }

// H2H is keyed by sorted FIFA-code pair: "ARG_BRA".
export function h2hKey(codeA, codeB) {
  if (!codeA || !codeB) return null;
  return [codeA, codeB].sort().join('_');
}

// Resolve a team's squad from players-by-team despite name-spelling drift between
// sources (e.g. teams-48 "Bosnia & Herzegovina" vs players-by-team "Bosnia and
// Herzegovina", or "USA" vs "United States"). Tries exact keys, &↔and variants,
// then an accent/punctuation-insensitive match.
const _pbtNorm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
export function squadFor(pbt, team) {
  if (!pbt || !team) return [];
  const tries = [team.name, team.name_normalised,
    team.name && team.name.replace(/ & /g, ' and '),
    team.name && team.name.replace(/ and /g, ' & ')].filter(Boolean);
  for (const k of tries) if (pbt[k]) return pbt[k];
  const want = _pbtNorm(team.name) || _pbtNorm(team.name_normalised);
  for (const k of Object.keys(pbt)) if (_pbtNorm(k) === want) return pbt[k];
  return [];
}

// Compute live group standings from the match list. The live wc2026api.com
// /groups endpoint returns membership only ({ id, name, teams:[...] }) — no
// table — so we accumulate W/D/L/points from finished matches here. Works with
// both live matches (have *_code) and the static fallback (names only).
// `group` is a normalized group object ({ group_name|name, teams:[{name,code}] }).
export function computeGroupStandings(matches, group) {
  if (!group) return [];
  const letter = group.group_name || group.name || group.letter || group.group;
  const rows = [];
  const byKey = new Map();
  const add = (name, code) => {
    const primary = code || name;
    if (!primary || byKey.has(primary)) return;
    const row = { rank: 0, team: name || code, code: code || null,
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
    byKey.set(primary, row);
    if (code) byKey.set(code, row);
    if (name) byKey.set(name, row);
    rows.push(row);
  };
  for (const t of (group.teams || group.members || [])) add(t.name || t.team, t.code || t.fifa_code);
  if (!rows.length && Array.isArray(matches)) {
    for (const m of matches) {
      if ((m.group_name || m.group) !== letter) continue;
      add(m.home_team, m.home_team_code); add(m.away_team, m.away_team_code);
    }
  }
  const find = (name, code) => (code && byKey.get(code)) || (name && byKey.get(name)) || null;
  for (const m of (matches || [])) {
    if ((m.group_name || m.group) !== letter) continue;
    if (m.status !== 'finished') continue;
    if (m.home_score == null || m.away_score == null) continue;
    const h = find(m.home_team, m.home_team_code);
    const a = find(m.away_team, m.away_team_code);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; a.lost++; h.points += 3; }
    else if (m.home_score < m.away_score) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  for (const r of rows) r.gd = r.gf - r.ga;
  rows.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || String(x.team).localeCompare(String(y.team)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
