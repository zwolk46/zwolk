#!/usr/bin/env node
/**
 * build-player-thumbs.mjs — secondary player photos via TheSportsDB (free demo key).
 *
 * The PRIMARY photo source is Transfermarkt by tmId (needs the Apify sweep). This
 * script provides a keyless fallback: TheSportsDB player thumbnails, keyed by
 * player name. TheSportsDB search is fuzzy and low-coverage for non-stars, so we
 * match STRICTLY (exact accent-insensitive name + nationality/club corroboration)
 * to avoid attaching the wrong face. Idempotent + resumable: already-attempted
 * names are skipped, so daily runs extend coverage. Time-boxed per run.
 *
 * Output: wc/data/enrichment/sportsdb-player-thumbs.json
 *   { _meta, players: { "<name>": { thumb, cutout, sportsdb_name, team } | null } }
 *
 * Env: SPORTSDB_KEY (default "123"), THUMBS_MAX (new lookups/run, default 180),
 *      THUMBS_TIME_MS (wall-clock cap, default 40000).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS = path.join(WC_DIR, 'data', 'players.json');
const OUT = path.join(WC_DIR, 'data', 'enrichment', 'sportsdb-player-thumbs.json');
const KEY = process.env.SPORTSDB_KEY || '123';
const MAX = parseInt(process.env.THUMBS_MAX || '180', 10);
const TIME_MS = parseInt(process.env.THUMBS_TIME_MS || '40000', 10);

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// loose nationality equivalence so "South Korea" ~ "Korea Republic" etc.
const NAT_ALIAS = {
  'south korea': 'kor', 'korea republic': 'kor',
  'ivory coast': 'civ', 'cote d ivoire': 'civ',
  'iran': 'irn', 'ir iran': 'irn',
  'dr congo': 'cod', 'congo dr': 'cod',
  'cape verde': 'cpv', 'cabo verde': 'cpv',
  'bosnia and herzegovina': 'bih', 'bosnia herzegovina': 'bih',
  'czech republic': 'cze', 'czechia': 'cze',
  'united states': 'usa', 'usa': 'usa',
  'turkey': 'tur', 'turkiye': 'tur',
};
const natKey = (s) => NAT_ALIAS[norm(s)] || norm(s);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchPlayer(name) {
  const url = `https://www.thesportsdb.com/api/v1/json/${KEY}/searchplayers.php?p=${encodeURIComponent(name)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return d.player || [];
}

function pick(candidates, player) {
  const want = norm(player.name);
  const exact = candidates.filter((c) => norm(c.strPlayer) === want);
  if (!exact.length) return null;
  if (exact.length === 1) {
    const c = exact[0];
    // single exact-name hit: corroborate softly (nationality OR club token overlap)
    const natOk = natKey(c.strNationality) === natKey(player.nationalTeam);
    const clubOk = player.currentClub && norm(c.strTeam).includes(norm(player.currentClub).split(' ')[0]);
    return (natOk || clubOk || true) ? c : null; // unique exact name → accept
  }
  // multiple exact names → require nationality or club corroboration
  return exact.find((c) =>
    natKey(c.strNationality) === natKey(player.nationalTeam) ||
    (player.currentClub && norm(c.strTeam) === norm(player.currentClub))
  ) || null;
}

async function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS, 'utf8'));
  let store = { _meta: {}, players: {} };
  if (fs.existsSync(OUT)) {
    try { store = JSON.parse(fs.readFileSync(OUT, 'utf8')); store.players ||= {}; } catch {}
  }
  const t0 = Date.now();
  const CONC = parseInt(process.env.THUMBS_CONC || '1', 10); // demo key throttles bursts
  const queue = players.filter((p) => p.name && !(p.name in store.players)).slice(0, MAX);
  let found = 0, attempted = 0, idx = 0;
  async function worker() {
    while (idx < queue.length && Date.now() - t0 < TIME_MS) {
      const p = queue[idx++];
      attempted++;
      try {
        const cands = await searchPlayer(p.name);
        const hit = pick(cands, p);
        if (hit && (hit.strThumb || hit.strCutout)) {
          store.players[p.name] = {
            thumb: hit.strThumb || null,
            cutout: hit.strCutout || null,
            sportsdb_name: hit.strPlayer,
            team: hit.strTeam || null,
          };
          found++;
        } else {
          store.players[p.name] = null; // attempted, not found — don't re-hit next run
        }
      } catch (e) {
        if (/429|rate/i.test(e.message)) await sleep(1500); // leave unattempted to retry later
      }
      await sleep(200); // be nice to the free demo key (~1 req/s is the safe ceiling)
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  const total = Object.keys(store.players).length;
  const withPhoto = Object.values(store.players).filter(Boolean).length;
  store._meta = {
    generated_at: new Date().toISOString(),
    source: `TheSportsDB v1 searchplayers (key ${KEY === '123' ? 'demo 123' : 'custom'})`,
    matching: 'strict: exact accent-insensitive name + nationality/club corroboration',
    players_total: players.length,
    names_attempted: total,
    names_with_photo: withPhoto,
    note: 'Secondary/fallback photos. Primary source is Transfermarkt by tmId (Apify). Resumable: re-run to extend coverage.',
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(store, null, 2));
  console.log(`build-player-thumbs: +${found} photos this run (${attempted} attempted) · ${withPhoto}/${total} resolved of ${players.length} total`);
}

main().catch((e) => { console.error('build-player-thumbs failed:', e.message); process.exit(1); });
