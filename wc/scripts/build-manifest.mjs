#!/usr/bin/env node
/**
 * build-manifest.mjs — Regenerate data/enrichment/manifest.json from what is
 * actually present on disk. Counts records, stamps the fetch/refresh date, and
 * records source + static-vs-refreshable for every data file the app reads.
 * Run at the end of refresh-data so the manifest never drifts from reality.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(WC_DIR, 'data');
const ENR = path.join(DATA, 'enrichment');
const today = new Date().toISOString().slice(0, 10);

// Known files → metadata. `class`: static | refreshable | live-derived.
const META = {
  'teams.json':            { dir: DATA, source: 'wc2026api.com /teams (or openfootball backbone via build-static.mjs)', class: 'static', powers: 'team list, market-value totals' },
  'matches.json':          { dir: DATA, source: 'openfootball backbone (live scores come from wc2026api.com at runtime)', class: 'static-fallback', powers: 'fixtures/results fallback + knockout source text + goals' },
  'groups.json':           { dir: DATA, source: 'computed from openfootball results (live standings computed client-side)', class: 'static-fallback', powers: 'group standings fallback' },
  'stadiums.json':         { dir: DATA, source: 'openfootball backbone', class: 'static', powers: 'venue list' },
  'players.json':          { dir: DATA, source: 'openfootball squads (market values/tmId need Apify/Transfermarkt sweep)', class: 'static', powers: 'player pages, squad lists' },
  'players-by-team.json':  { dir: DATA, source: 'derived from players.json (grouped by team, sorted by market value)', class: 'derived', powers: 'team squad lists' },
  'teams-48.json':         { dir: ENR, source: 'openfootball/worldcup.json (2026)', class: 'static', powers: 'team backbone / name+code index' },
  'countries.json':        { dir: ENR, source: 'mledoze/countries + World Bank + Open-Meteo + flagcdn', class: 'static', powers: 'country/languages panel' },
  'elo-ratings.json':      { dir: ENR, source: 'Kaggle afonsofernandescruz 2026 Elo', class: 'static', powers: 'predictive strength' },
  'fifa-rankings.json':    { dir: ENR, source: 'FIFA api.fifa.com live ranking endpoint', class: 'refreshable', powers: 'official ranking (live values refresh during tournament)' },
  'head-to-head.json':     { dir: ENR, source: 'Kaggle martj42 international results (1872–present)', class: 'static', powers: 'pre-game H2H block' },
  'team-all-time-records.json': { dir: ENR, source: 'Kaggle martj42 international results', class: 'static', powers: 'all-time W/D/L per team' },
  'stadium-weather.json':  { dir: ENR, source: 'Open-Meteo forecast/archive (keyless)', class: 'refreshable', powers: 'match-day weather (16-day forecast window moves)' },
  'sportsdb-teams.json':   { dir: ENR, source: 'TheSportsDB v1 (demo key)', class: 'static', powers: 'team badges, stadium imagery, socials, RSS' },
  'sportsdb-player-thumbs.json': { dir: ENR, source: 'TheSportsDB v1 searchplayers (demo key)', class: 'refreshable', powers: 'fallback player photos (resumable; extends each run)' },
  'tournament-scorers.json': { dir: ENR, source: 'wc2026api.com /matches/:id/stats timelines', class: 'live-derived', powers: 'golden boot / tournament scorers' },
  'pronunciations.json':   { dir: ENR, source: 'Forvo API (Non-Profit plan)', class: 'static', powers: 'tap-to-hear name audio' },
};

function count(obj) {
  if (Array.isArray(obj)) return obj.length;
  if (obj && typeof obj === 'object') {
    // most enrichment files are keyed maps (drop _meta); some wrap a list
    if (Array.isArray(obj.leaderboard)) return obj.leaderboard.length;
    // pronunciations: both countries + players buckets
    if (obj.countries && obj.players && typeof obj.players === 'object') {
      const c = Object.values(obj.countries).filter(Boolean).length;
      const p = Object.values(obj.players).filter(Boolean).length;
      return `${c} countries + ${p} players w/ audio`;
    }
    if (obj.players && typeof obj.players === 'object') return Object.values(obj.players).filter(Boolean).length;
    if (obj.stadiums && typeof obj.stadiums === 'object') return Object.keys(obj.stadiums).length;
    if (obj.countries && obj.players === undefined) return Object.keys(obj.countries).length;
    return Object.keys(obj).filter((k) => k !== '_meta').length;
  }
  return null;
}

const files = [];
for (const [name, meta] of Object.entries(META)) {
  const fp = path.join(meta.dir, name);
  const rel = path.relative(WC_DIR, fp);
  if (!fs.existsSync(fp)) { files.push({ file: rel, present: false, source: meta.source, class: meta.class, powers: meta.powers }); continue; }
  let records = null;
  try { records = count(JSON.parse(fs.readFileSync(fp, 'utf8'))); } catch {}
  files.push({
    file: rel, present: true, records, source: meta.source,
    class: meta.class, powers: meta.powers,
    fetched: new Date(fs.statSync(fp).mtime).toISOString().slice(0, 10),
  });
}

// worldcup-history (directory of per-year files)
const wch = path.join(ENR, 'worldcup-history');
if (fs.existsSync(wch)) {
  const yrs = fs.readdirSync(wch).filter((f) => f.endsWith('.json'));
  files.push({ file: 'data/enrichment/worldcup-history/', present: true, records: yrs.length, source: 'openfootball/worldcup.json', class: 'static', powers: 'historical tournament context' });
}

const out = {
  generated_at: today,
  wc_dir: WC_DIR,
  enrichment_dir: 'data/enrichment/',
  join_key_convention: 'Core players/teams join by NAME (with alias map in lib/data.js for live-API spellings). Per-team enrichment files key by FIFA 3-letter code (teams.json.code); head-to-head by sorted code pair "ARG_BRA".',
  refresh_model: {
    live_runtime: 'Scores/phase/standings/match-stats come from wc2026api.com at runtime via the /api/wc2026 proxy (490/day cap, ~25s cache).',
    refreshable_daily: ['stadium-weather.json', 'fifa-rankings.json', 'tournament-scorers.json', 'sportsdb-player-thumbs.json'],
    static_baked: ['countries.json', 'elo-ratings.json', 'head-to-head.json', 'team-all-time-records.json', 'sportsdb-teams.json', 'pronunciations.json', 'teams-48.json', 'worldcup-history/'],
    refresh_script: 'scripts/refresh-data (idempotent; scheduled daily via launchd)',
  },
  blocked: {
    player_market_values_photos: 'Transfermarkt via Apify needs APIFY_TOKEN (not present). players.json has rosters but no market values/tmId/Transfermarkt photos until the sweep runs.',
  },
  files,
};
fs.writeFileSync(path.join(ENR, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`✔ manifest rebuilt: ${files.filter((f) => f.present).length}/${files.length} known files present.`);
