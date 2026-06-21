#!/usr/bin/env node
/**
 * fetch-players-apify.mjs — Transfermarkt player sweep via Apify.
 *
 * Scrapes all 48 national-team squad pages (by verein id, from tm-verein-ids.json)
 * and expands each to full player profiles with market value + value history +
 * transfers + achievements + photos. This is the ONE source that needs a paid
 * account; everything else in the app is keyless. Output:
 *   data/enrichment/transfermarkt-raw.json   (then merge-players.mjs + enrich-clubs.mjs)
 *
 * CADENCE: market values change slowly (≈monthly), so on a daily schedule this
 * SKIPS if the raw file is newer than FRESH_DAYS (default 7) — set APIFY_FORCE=1
 * to override. This keeps the daily refresh-data run from burning Apify credit;
 * weather/FIFA (keyless) still refresh every day.
 *
 * Token: APIFY_TOKEN env, or keys.local.json { "apify": { "token": "..." } }.
 * Run:  APIFY_TOKEN=… node wc/scripts/fetch-players-apify.mjs
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENR = join(__dirname, '..', 'data', 'enrichment');
const OUT = join(ENR, 'transfermarkt-raw.json');
const VEREIN = join(ENR, 'tm-verein-ids.json');
const ACTOR = 'solidcode~transfermarkt-scraper';
const FRESH_DAYS = Number(process.env.APIFY_FRESH_DAYS || 7);

function token() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN;
  try { return JSON.parse(readFileSync(join(ENR, 'keys.local.json'), 'utf8')).apify.token; } catch {}
  console.error('✖ No Apify token (APIFY_TOKEN env or keys.local.json apify.token).');
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Cadence guard.
  if (!process.env.APIFY_FORCE && existsSync(OUT)) {
    const ageDays = (Date.now() - statSync(OUT).mtimeMs) / 86400000;
    if (ageDays < FRESH_DAYS) {
      console.log(`↩ player data is ${ageDays.toFixed(1)}d old (< ${FRESH_DAYS}d) — skipping sweep. Set APIFY_FORCE=1 to override.`);
      return;
    }
  }
  const T = token();
  const ids = JSON.parse(readFileSync(VEREIN, 'utf8'));               // { FIFA: vereinId }
  const urls = Object.values(ids).map((id) => `https://www.transfermarkt.com/x/kader/verein/${id}/saison_id/2025`);
  const input = {
    startUrls: urls,
    recordType: 'auto',
    language: 'com',
    maxResults: urls.length * 30 + 50,         // ~26 players + club per team
    includeClubSquad: true,
    includeMarketValueHistory: true,
    includeTransferHistory: true,
    includeAchievements: true,
    includeInjuries: false,
  };

  console.log(`▶ scraping ${urls.length} national-team squads via ${ACTOR}…`);
  const startRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${T}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!startRes.ok) { console.error('✖ start failed', startRes.status, await startRes.text()); process.exit(1); }
  const run = (await startRes.json()).data;
  console.log('  run', run.id, '· dataset', run.defaultDatasetId);

  let status = run.status; const t0 = Date.now();
  while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
    await sleep(15000);
    status = (await (await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${T}`)).json()).data.status;
    process.stdout.write(`  …${status} ${Math.round((Date.now() - t0) / 1000)}s\r`);
  }
  console.log('\n  run', status);
  if (status !== 'SUCCEEDED') { console.error('✖ run did not succeed'); process.exit(1); }

  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?format=json&clean=true&token=${T}`)).json();
  const players = items.filter((x) => (x.recordType || '') === 'player').length;
  console.log(`  downloaded ${items.length} records (${players} players)`);
  if (players < 1000) console.warn(`  ⚠ only ${players} players — expected ~1,248. Some verein ids may be wrong.`);
  writeFileSync(OUT, JSON.stringify(items, null, 1));
  console.log('✔ wrote', OUT.replace(/.*\/wc\//, 'wc/'), '· next: merge-players.mjs && enrich-clubs.mjs');
}
main().catch((e) => { console.error(e); process.exit(1); });
