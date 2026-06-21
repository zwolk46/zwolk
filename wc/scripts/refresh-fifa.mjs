#!/usr/bin/env node
/**
 * refresh-fifa.mjs — Refresh live FIFA ranking values (keyless).
 *
 * Source: api.fifa.com/api/v3/fifarankings/rankings/live?gender=1&sportType=0.
 * Updates each of the 48 teams' live_rank / live_points / ranking_movement /
 * rated_matches in place. The official_* fields are the frozen last-official
 * snapshot (2026-06-11 until ~2026-07-19) and are preserved untouched.
 *
 * Reads/writes: data/enrichment/fifa-rankings.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'data', 'enrichment', 'fifa-rankings.json');
const URL = 'https://api.fifa.com/api/v3/fifarankings/rankings/live?locale=en&gender=1&sportType=0';

async function main() {
  const doc = JSON.parse(readFileSync(FILE, 'utf8'));
  const r = await fetch(URL, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`FIFA endpoint HTTP ${r.status}`);
  const feed = await r.json();
  const results = Array.isArray(feed.Results) ? feed.Results : [];
  const byCode = new Map(results.map((x) => [x.IdCountry, x]));

  let updated = 0;
  for (const [code, rec] of Object.entries(doc)) {
    if (code === '_meta') continue;
    const f = byCode.get(code);
    if (!f) continue;
    rec.live_rank = f.Rank ?? rec.live_rank;
    rec.live_points = f.TotalPoints != null ? Math.round(f.TotalPoints * 100) / 100 : rec.live_points;
    rec.ranking_movement = f.RankingMovement ?? rec.ranking_movement;
    if (f.RatedMatches != null) rec.rated_matches = f.RatedMatches;
    updated++;
  }
  doc._meta = doc._meta || {};
  doc._meta.live_as_of = new Date().toISOString().slice(0, 10);
  doc._meta.source = doc._meta.source || 'FIFA api.fifa.com/api/v3/fifarankings/rankings/live (gender=1 men, sportType=0 football)';
  writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
  console.log(`✔ FIFA rankings refreshed: ${updated}/48 teams updated (official snapshot preserved).`);
}
main().catch((e) => { console.error('refresh-fifa failed:', e.message); process.exit(1); });
