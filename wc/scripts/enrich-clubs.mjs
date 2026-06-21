#!/usr/bin/env node
/**
 * enrich-clubs.mjs — Resolve Transfermarkt club IDs → club names so player
 * transfer histories (and current-club league) render with real names instead
 * of numeric IDs. The transfermarkt-scraper emits club IDs in transferHistory
 * (fromClubId/toClubId) and currentClubId, not names.
 *
 * Two phases (run after fetch-players-apify.mjs + merge-players.mjs):
 *   1) Collect every unique club ID referenced by any player, scrape those club
 *      pages on Apify (recordType=club, no squad expansion), build
 *      data/enrichment/tm-clubs.json  ({ clubId: { name, league, country } }).
 *   2) Backfill data/players.json transferHistory[].fromClub/toClub names and
 *      currentLeague from that map; rewrite players-by-team.json.
 *
 * Idempotent: re-running only scrapes club IDs missing from tm-clubs.json.
 *
 * Run:  APIFY_TOKEN=… node wc/scripts/enrich-clubs.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');
const ENR = join(DATA, 'enrichment');
const RAW = join(ENR, 'transfermarkt-raw.json');
const CLUBS = join(ENR, 'tm-clubs.json');
const ACTOR = 'solidcode~transfermarkt-scraper';

function token() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN;
  try { return JSON.parse(readFileSync(join(ENR, 'keys.local.json'), 'utf8')).apify.token; } catch {}
  console.error('✖ No Apify token (APIFY_TOKEN or keys.local.json).'); process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const T = token();
  const raw = existsSync(RAW) ? JSON.parse(readFileSync(RAW, 'utf8')) : [];
  const clubs = existsSync(CLUBS) ? JSON.parse(readFileSync(CLUBS, 'utf8')) : {};

  // 1) collect unique club ids
  const ids = new Set();
  for (const r of raw) {
    if (r.currentClubId) ids.add(String(r.currentClubId));
    for (const t of (r.transferHistory || [])) { if (t.fromClubId) ids.add(String(t.fromClubId)); if (t.toClubId) ids.add(String(t.toClubId)); }
  }
  const missing = [...ids].filter((id) => !clubs[id]);
  console.log(`${ids.size} unique club ids referenced · ${missing.length} not yet resolved`);

  if (missing.length) {
    const urls = missing.map((id) => `https://www.transfermarkt.com/x/startseite/verein/${id}`);
    const input = { startUrls: urls, recordType: 'club', language: 'com', maxResults: missing.length + 10, includeClubSquad: false };
    console.log(`▶ scraping ${urls.length} club pages…`);
    const run = (await (await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${T}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).json()).data;
    let status = run.status;
    while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      await sleep(15000);
      status = (await (await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${T}`)).json()).data.status;
      process.stdout.write('.');
    }
    console.log('', status);
    const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?format=json&clean=true&token=${T}`)).json();
    for (const c of items) {
      if (c && (c.recordType === 'club' || c.name) && c.id != null) {
        clubs[String(c.id)] = { name: c.name || c.displayName || null, league: c.leagueName || c.competitionName || null, country: c.countryName || null };
      }
    }
    writeFileSync(CLUBS, JSON.stringify(clubs, null, 2) + '\n');
    console.log('✔ wrote', CLUBS.replace(/.*\/wc\//, 'wc/'), `(${Object.keys(clubs).length} clubs)`);
  }

  // 2) backfill players
  const players = JSON.parse(readFileSync(join(DATA, 'players.json'), 'utf8'));
  let filled = 0;
  for (const p of players) {
    if (Array.isArray(p.transferHistory)) {
      for (const t of p.transferHistory) {
        if (t.fromClubId && clubs[String(t.fromClubId)]) { t.fromClub = clubs[String(t.fromClubId)].name; filled++; }
        if (t.toClubId && clubs[String(t.toClubId)]) t.toClub = clubs[String(t.toClubId)].name;
      }
    }
    if (!p.currentLeague && p.currentClubId && clubs[String(p.currentClubId)]) p.currentLeague = clubs[String(p.currentClubId)].league;
  }
  writeFileSync(join(DATA, 'players.json'), JSON.stringify(players, null, 2) + '\n');
  // regroup
  const grouped = {};
  for (const p of players) (grouped[p.nationalTeam] ||= []).push(p);
  for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => (b.marketValueEur || 0) - (a.marketValueEur || 0) || (a.shirtNumber || 99) - (b.shirtNumber || 99));
  writeFileSync(join(DATA, 'players-by-team.json'), JSON.stringify(grouped, null, 2) + '\n');
  console.log(`✔ backfilled ${filled} transfer club names`);
}
main().catch((e) => { console.error(e); process.exit(1); });
