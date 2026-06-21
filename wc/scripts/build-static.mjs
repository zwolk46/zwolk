#!/usr/bin/env node
/**
 * build-static.mjs — Build the app's static tournament dataset from the
 * openfootball backbone (public domain) already checked into data/enrichment.
 *
 * NO NETWORK. Reads only local files. Writes the six Section-2 files that the
 * pages load at startup, in the EXACT snake_case / camelCase contract the
 * renderers expect (see wc/data/schema.md and wc/CLAUDE.md):
 *
 *   data/teams.json            48 teams   {id,name,code,group,flag,totalMarketValueEur,averageMarketValueEur}
 *   data/matches.json          104 fixtures (snake_case match shape)
 *   data/groups.json           12 group standings (computed from finished group matches)
 *   data/stadiums.json         16 venues  {id,name,city,country,capacity,lat,lng}
 *   data/players.json          every squad player (flat)         — market values null until Apify merge
 *   data/players-by-team.json  players grouped by country name, sorted by value desc
 *
 * Player market value / transfer / caps fields are left null/empty here and are
 * filled later by scripts/merge-players.mjs after the Apify Transfermarkt sweep.
 *
 * Run:  node wc/scripts/build-static.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WC = join(__dirname, '..');           // wc/
const DATA = join(WC, 'data');
const ENR = join(DATA, 'enrichment');
const HIST = join(ENR, 'worldcup-history');

const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const wr = (p, obj) => { writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); console.log('  wrote', p.replace(WC + '/', ''), Array.isArray(obj) ? `(${obj.length})` : `(${Object.keys(obj).length} keys)`); };

// ── Load backbone ────────────────────────────────────────────────────────────
const teams48 = rd(join(ENR, 'teams-48.json'));               // [{id,name,name_normalised,fifa_code,group,confed,continent,flag_icon}]
const wc2026 = rd(join(HIST, '2026.json'));                   // {matches:[openfootball]}
const stadiumsRaw = rd(join(HIST, '2026.stadiums.json')).stadiums; // [{city,timezone,cc,name,capacity,coords}]
const squads = rd(join(HIST, '2026.squads.json'));            // [{name,fifa_code,group,players:[{number,pos,name,club:{name,country},date_of_birth}]}]
const weather = rd(join(ENR, 'stadium-weather.json')).stadiums; // keyed by official stadium name {coords:{lat,lng}, city,...}
const countries = rd(join(ENR, 'countries.json'));            // keyed by fifa code

const byName = new Map();
const byNorm = new Map();
const byCode = new Map();
for (const t of teams48) {
  byName.set(t.name, t);
  byNorm.set(t.name_normalised || t.name, t);
  byCode.set(t.fifa_code, t);
}
const codeOf = (name) => (byName.get(name) || byNorm.get(name) || {}).fifa_code || null;

// ── Stadiums ─────────────────────────────────────────────────────────────────
// openfootball match `ground` === stadium `city`. Build city → official-name map.
const CC_COUNTRY = { us: 'United States', ca: 'Canada', mx: 'Mexico' };
const cityToStadium = new Map();
const stadiums = stadiumsRaw.map((s, i) => {
  cityToStadium.set(s.city, s.name);
  const wx = weather[s.name] || {};
  const coords = wx.coords || {};
  const cleanCity = s.city.replace(/\s*\([^)]*\)\s*$/, '').trim(); // "Dallas (Arlington)" → "Dallas"
  return {
    id: i + 1,
    name: s.name,
    city: cleanCity,
    metro: s.city,                      // full openfootball metro label (join key to weather)
    country: CC_COUNTRY[s.cc] || s.cc,
    capacity: s.capacity,
    lat: coords.lat ?? null,
    lng: coords.lng ?? null,
    timezone: wx.timezone || s.timezone || null,
  };
});

// ── Matches ──────────────────────────────────────────────────────────────────
const ROUND = {
  'Round of 32': 'round_of_32',
  'Round of 16': 'round_of_16',
  'Quarter-final': 'quarter_final',
  'Semi-final': 'semi_final',
  'Match for third place': 'third_place',
  'Final': 'final',
};
function roundOf(m) {
  if (m.group) return 'group';
  return ROUND[m.round] || 'group';
}
function toUtcIso(date, time) {
  // date "2026-06-16", time "15:00 UTC-4"  →  UTC ISO
  const [hm, tz] = String(time).split(/\s+/);
  const [h, mn] = hm.split(':').map(Number);
  const off = parseInt(String(tz).replace(/UTC/i, ''), 10) || 0; // e.g. -4
  const [Y, M, D] = date.split('-').map(Number);
  return new Date(Date.UTC(Y, M - 1, D, h - off, mn, 0)).toISOString();
}
function koSource(token) {
  const t = String(token).trim();
  if (/^W\d+$/i.test(t)) return `Winner of Match ${t.slice(1)}`;
  if (/^L\d+$/i.test(t)) return `Loser of Match ${t.slice(1)}`;
  if (/^1[A-L]$/.test(t)) return `Winner Group ${t[1]}`;
  if (/^2[A-L]$/.test(t)) return `Runner-up Group ${t[1]}`;
  if (/^3[A-L/]+$/.test(t)) return `3rd place — Group ${t.slice(1)}`;
  return t;
}

const rawMatches = wc2026.matches.map((m) => {
  const round = roundOf(m);
  const isGroup = round === 'group';
  const kickoff_utc = toUtcIso(m.date, m.time);
  const stadium = cityToStadium.get(m.ground) || m.ground;
  const hasScore = m.score && Array.isArray(m.score.ft);
  const out = {
    _num: m.num || null,            // official number for knockout (73-104)
    round,
    group_name: isGroup ? (m.group || '').replace(/^Group\s+/, '') || null : null,
    home_team: isGroup ? m.team1 : null,
    away_team: isGroup ? m.team2 : null,
    home_team_source: isGroup ? null : koSource(m.team1),
    away_team_source: isGroup ? null : koSource(m.team2),
    stadium,
    kickoff_utc,
    status: hasScore ? 'finished' : 'scheduled',
    phase: hasScore ? 'FT' : 'PRE',
    home_score: hasScore ? m.score.ft[0] : null,
    away_score: hasScore ? m.score.ft[1] : null,
    // keep goals for later (scorer breakdowns) — not in the live shape but harmless extra
    goals: hasScore ? buildGoals(m) : [],
  };
  return out;
});

function buildGoals(m) {
  const g = [];
  for (const x of (m.goals1 || [])) g.push({ team: m.team1, ...normGoal(x) });
  for (const x of (m.goals2 || [])) g.push({ team: m.team2, ...normGoal(x) });
  return g.sort((a, b) => parseInt(a.minute) - parseInt(b.minute));
}
function normGoal(x) {
  return { player: x.name, minute: String(x.minute), penalty: !!x.penalty, ownGoal: !!x.owngoal };
}

// Assign match_number / id: knockout uses openfootball `num`; group games get
// 1..72 by chronological kickoff (best-effort match to FIFA's official numbering).
const groupMatches = rawMatches.filter((m) => m.round === 'group')
  .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc) || a.stadium.localeCompare(b.stadium));
groupMatches.forEach((m, i) => { m._num = i + 1; });

const matches = rawMatches
  .map((m) => {
    const num = m._num;
    const { _num, goals, ...rest } = m;
    return { id: num, match_number: num, ...rest, goals };
  })
  .sort((a, b) => a.match_number - b.match_number);

// ── Group standings (computed from finished group matches) ─────────────────────
const groupsMap = {};
for (const t of teams48) {
  (groupsMap[t.group] ||= []).push(t.name);
}
function blankRow(name) {
  return { team: name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}
const groups = Object.keys(groupsMap).sort().map((letter) => {
  const rows = {};
  for (const name of groupsMap[letter]) rows[name] = blankRow(name);
  for (const m of matches) {
    if (m.round !== 'group' || m.group_name !== letter || m.status !== 'finished') continue;
    const h = rows[m.home_team], a = rows[m.away_team];
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; a.lost++; h.points += 3; }
    else if (m.home_score < m.away_score) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  const standings = Object.values(rows).map((r) => ({ ...r, gd: r.gf - r.ga }))
    .sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team))
    .map((r, i) => ({ rank: i + 1, ...r }));
  return { group_name: letter, standings };
});

// ── Teams ──────────────────────────────────────────────────────────────────--
const teams = teams48.map((t) => {
  const c = countries[t.fifa_code] || {};
  const iso2 = (c.cca2 || c.flag_cc || '').toLowerCase();
  const flag = iso2 ? `https://flagcdn.com/w320/${iso2}.png` : (c.flag_png || c.flag_svg || null);
  return {
    id: t.id,
    name: t.name,
    code: t.fifa_code,
    group: t.group,
    confed: t.confed,
    flag,
    totalMarketValueEur: null,      // filled by merge-players.mjs
    averageMarketValueEur: null,
  };
});

// ── Players ──────────────────────────────────────────────────────────────────
const POS_LABEL = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
function ageOn(dob, ref = '2026-06-11') {
  if (!dob) return null;
  const b = new Date(dob), r = new Date(ref);
  let a = r.getFullYear() - b.getFullYear();
  const mdiff = r.getMonth() - b.getMonth() || r.getDate() - b.getDate();
  if (mdiff < 0) a--;
  return a;
}
const players = [];
const playersByTeam = {};
for (const sq of squads) {
  // Use the CANONICAL teams-48 name (by FIFA code) so player.nationalTeam and the
  // players-by-team keys match teams.json byte-for-byte — the join convention the
  // app relies on. (2026.squads spells a couple of teams differently, e.g.
  // "United States"/"USA", "Bosnia and Herzegovina"/"Bosnia & Herzegovina".)
  const teamName = (byCode.get(sq.fifa_code) || {}).name || sq.name;
  const list = [];
  for (const p of (sq.players || [])) {
    const club = p.club && (p.club.name || p.club);
    const player = {
      // null tmId → render-team links these via `name:<Name>` and render-player
      // resolves by name. The Apify merge later assigns the real numeric
      // Transfermarkt id, after which squad cards link by that id.
      tmId: null,
      _ofKey: `${sq.fifa_code}-${p.number ?? list.length + 1}`,
      name: p.name,
      shortName: (p.name || '').trim().split(/\s+/).slice(-1)[0] || null,
      dateOfBirth: p.date_of_birth || null,
      age: ageOn(p.date_of_birth),
      nationality: teamName,
      secondNationality: null,
      height: null,
      preferredFoot: null,
      position: POS_LABEL[p.pos] || p.pos || 'Midfielder',
      positionGroup: p.pos || null,
      currentClub: club || null,
      currentClubId: null,
      currentLeague: null,
      currentClubCountry: (p.club && p.club.country) || null,
      shirtNumber: p.number ?? null,
      contractUntil: null,
      marketValueEur: null,
      marketValuePeak: null,
      marketValueHistory: [],
      nationalTeam: teamName,
      internationalCaps: null,
      internationalGoals: null,
      transferHistory: [],
      achievements: [],
      tmUrl: null,
      source: 'openfootball',
    };
    players.push(player);
    list.push(player);
  }
  // sort by value desc (all null now) then shirt number
  list.sort((a, b) => (b.marketValueEur || 0) - (a.marketValueEur || 0) || (a.shirtNumber || 99) - (b.shirtNumber || 99));
  playersByTeam[teamName] = list;
}

// ── Write ──────────────────────────────────────────────────────────────────--
mkdirSync(DATA, { recursive: true });
console.log('Building static dataset from openfootball backbone…');
wr(join(DATA, 'stadiums.json'), stadiums);
wr(join(DATA, 'matches.json'), matches);
wr(join(DATA, 'groups.json'), groups);
wr(join(DATA, 'teams.json'), teams);
wr(join(DATA, 'players.json'), players);
wr(join(DATA, 'players-by-team.json'), playersByTeam);

// ── Summary / sanity ───────────────────────────────────────────────────────--
const finished = matches.filter((m) => m.status === 'finished').length;
const ko = matches.filter((m) => m.round !== 'group').length;
console.log('\nSummary:');
console.log(`  teams=${teams.length}  matches=${matches.length} (group=${matches.length - ko}, ko=${ko}, finished=${finished})`);
console.log(`  groups=${groups.length}  stadiums=${stadiums.length}`);
console.log(`  players=${players.length}  squads=${Object.keys(playersByTeam).length}`);
const noStadium = matches.filter((m) => !m.stadium);
if (noStadium.length) console.warn('  ⚠ matches missing stadium:', noStadium.length);
