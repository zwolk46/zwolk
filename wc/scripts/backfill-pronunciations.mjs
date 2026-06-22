#!/usr/bin/env node
// backfill-pronunciations.mjs — fetch REAL Forvo name recordings for every
// World Cup player and snapshot the MP3 locally.
//
// Why this exists: pronunciations.json shipped with only ~20 sample players, so
// the "Hear name" button rendered for almost nobody. This walks the full
// players-by-team roster (~1250 players), queries Forvo with per-team language
// hints, downloads the MP3 binary, and rewrites pronunciations.json so each
// resolved player points at a stable local file (Forvo's pathmp3 URLs expire).
//
// ── Forvo budget ────────────────────────────────────────────────────────────
// The Non-Profit plan is 500 requests/DAY and the key auto-disables if exceeded.
// This script is therefore:
//   • budget-capped  — stops after MAX_REQ requests (default 450, safe margin)
//   • resumable      — every name it has already resolved OR confirmed-missing
//                      is recorded in pronunciations.json and skipped next run,
//                      so re-running on subsequent days continues where it left
//                      off without spending requests on names already tried.
// Run it once a day until it reports "nothing left to do".
//
// Usage:  node scripts/backfill-pronunciations.mjs            (default 450 cap)
//         MAX_REQ=200 node scripts/backfill-pronunciations.mjs (smaller batch)
//         RECHECK_MISSES=1 ...  re-tries names previously marked missing
// Requires data/enrichment/keys.local.json → { forvo: { key: "..." } }.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WC_ROOT = resolve(__dirname, '..');
const PRONS_FILE   = join(WC_ROOT, 'data/enrichment/pronunciations.json');
const KEYS_FILE    = join(WC_ROOT, 'data/enrichment/keys.local.json');
const PBT_FILE     = join(WC_ROOT, 'data/players-by-team.json');
const TEAMS_FILE   = join(WC_ROOT, 'data/enrichment/teams-48.json');
const COUNTRY_FILE = join(WC_ROOT, 'data/enrichment/countries.json');
const AUDIO_DIR    = join(WC_ROOT, 'data/enrichment/pronunciations');
const PUBLIC_PREFIX = '/wc/data/enrichment/pronunciations';

const MAX_REQ = Number(process.env.MAX_REQ || 450);
const MAX_SECONDS = Number(process.env.MAX_SECONDS || 0); // 0 = no wall-clock cap
const RECHECK_MISSES = process.env.RECHECK_MISSES === '1';
const startMs = Date.now();
const elapsed = () => (Date.now() - startMs) / 1000;

// Country-language name → Forvo language code. Unmapped (minor) languages are
// dropped; English is always appended as a fallback so nobody is left untried.
const LANG_CODE = {
  'English': 'en', 'French': 'fr', 'Spanish': 'es', 'Portuguese': 'pt',
  'German': 'de', 'Austro-Bavarian German': 'de', 'Swiss German': 'de',
  'Italian': 'it', 'Dutch': 'nl', 'Arabic': 'ar', 'Persian (Farsi)': 'fa',
  'Turkish': 'tr', 'Japanese': 'ja', 'Korean': 'ko', 'Croatian': 'hr',
  'Bosnian': 'bs', 'Serbian': 'sr', 'Czech': 'cs', 'Slovak': 'sk',
  'Swedish': 'sv', 'Norwegian Bokmål': 'no', 'Norwegian Nynorsk': 'no',
  'Russian': 'ru', 'Uzbek': 'uz', 'Swahili': 'sw', 'Afrikaans': 'af',
};

const slug = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
// Forvo phrase word: lowercase, spaces → underscores, accents PRESERVED.
const forvoWord = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '_');

let requests = 0;
let limitHit = false;

function curlText(url) {
  const r = spawnSync('curl', ['-sSL', '--max-time', '20', url], { encoding: 'utf8' });
  return r.stdout || '';
}
function curlBytes(url, destPath) {
  spawnSync('curl', ['-sSL', '--max-time', '30', '-o', destPath, url], { encoding: 'utf8' });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One Forvo call. Returns first item with a pathmp3, or null. Flags rate limit.
function forvoCall(key, action, word, langCode) {
  const url = `https://apifree.forvo.com/key/${encodeURIComponent(key)}/format/json/action/${action}/word/${encodeURIComponent(word)}/language/${langCode}/`;
  requests++;
  const body = curlText(url);
  if (/limit/i.test(body) && /day|request|exceed/i.test(body)) { limitHit = true; }
  try {
    const j = JSON.parse(body);
    return j && Array.isArray(j.items) ? (j.items[0] || null) : null;
  } catch { return null; }
}

// Try a small, ordered set of (action, language) combos; stop at first hit.
async function forvoLookup(key, word, langs) {
  const uniq = [...new Set([...langs, 'en'])].slice(0, 3);
  const tries = [];
  for (const lc of uniq) tries.push(['standard-pronunciation', lc]);
  tries.push(['word-pronunciations', uniq[0]]); // last-chance for native-only spellings
  for (const [action, lc] of tries) {
    if (limitHit || requests >= MAX_REQ) return null;
    const item = forvoCall(key, action, word, lc);
    await sleep(120);
    if (item && item.pathmp3) return { ...item, _lang: lc, _action: action };
  }
  return null;
}

async function downloadMp3(srcUrl, destPath) {
  curlBytes(srcUrl, destPath);
  const size = (await stat(destPath)).size;
  if (size < 1024) throw new Error(`tiny payload (${size}b) — expired/invalid`);
  return size;
}

async function main() {
  const keys = JSON.parse(await readFile(KEYS_FILE, 'utf8'));
  const forvoKey = keys?.forvo?.key;
  if (!forvoKey) throw new Error('Missing forvo.key in keys.local.json');

  const prons = JSON.parse(await readFile(PRONS_FILE, 'utf8'));
  prons._meta = prons._meta || {};
  prons.players = prons.players || {};

  const pbt = JSON.parse(await readFile(PBT_FILE, 'utf8'));
  const teams = JSON.parse(await readFile(TEAMS_FILE, 'utf8'));
  const countries = JSON.parse(await readFile(COUNTRY_FILE, 'utf8'));

  // team name → FIFA code → ordered Forvo language codes
  const nameToCode = {};
  for (const r of teams) {
    nameToCode[r.name] = r.fifa_code;
    if (r.name_normalised) nameToCode[r.name_normalised] = r.fifa_code;
  }
  const langsForTeam = (teamName) => {
    const code = nameToCode[teamName];
    const names = (code && countries[code] && countries[code].languages) || [];
    const codes = names.map((n) => LANG_CODE[n]).filter(Boolean);
    return codes.length ? codes : ['en'];
  };

  await mkdir(join(AUDIO_DIR, 'players'), { recursive: true });

  // Build the work queue: every player not already resolved or confirmed-missing.
  const seen = new Set();
  const queue = [];
  for (const [teamName, list] of Object.entries(pbt)) {
    for (const p of list) {
      const name = p.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const existing = prons.players[name];
      if (existing && existing.mp3) continue;                    // already have audio
      if (existing && existing._checked && !RECHECK_MISSES) continue; // confirmed miss
      queue.push({ name, langs: langsForTeam(teamName) });
    }
  }

  const haveAudio = Object.values(prons.players).filter((e) => e && e.mp3).length;
  console.log(`Players with audio so far: ${haveAudio}`);
  console.log(`Queue (untried): ${queue.length} | request budget this run: ${MAX_REQ}`);
  if (!queue.length) { console.log('Nothing left to do. ✅'); return; }

  // Persist progress so interrupted runs (e.g. short time windows) aren't lost.
  const flush = async () => {
    prons._meta.refreshed_at = new Date().toISOString().slice(0, 10);
    prons._meta.coverage_note =
      `Real Forvo recordings backfilled across the full roster. ` +
      `${Object.values(prons.players).filter((e) => e && e.mp3).length} players have audio.`;
    await writeFile(PRONS_FILE, JSON.stringify(prons, null, 2) + '\n');
  };

  let ok = 0, miss = 0, processed = 0;
  for (const { name, langs } of queue) {
    if (limitHit) { console.warn('!! Forvo rate limit reached — stopping early.'); break; }
    if (requests >= MAX_REQ) { console.log(`Budget reached (${requests} reqs) — stopping.`); break; }
    if (MAX_SECONDS && elapsed() > MAX_SECONDS) { console.log(`Time cap (${MAX_SECONDS}s) — stopping.`); break; }
    const word = forvoWord(name);
    const item = await forvoLookup(forvoKey, word, langs);
    if (!item || !item.pathmp3) {
      prons.players[name] = { word, mp3: null, _checked: true };
      miss++;
    } else {
      const file = slug(name) + '.mp3';
      try {
        await downloadMp3(item.pathmp3, join(AUDIO_DIR, 'players', file));
        prons.players[name] = {
          word, mp3: `${PUBLIC_PREFIX}/players/${file}`,
          language: item._lang, hits: item.hits ?? null,
        };
        ok++;
        if (ok % 10 === 0) console.log(`  …${ok} fetched (${requests} reqs used)`);
      } catch (err) {
        // Resolved on Forvo but download failed — leave untried so a later run retries.
        console.warn(`[dl-fail] ${name}: ${err.message}`);
      }
    }
    if (++processed % 10 === 0) await flush(); // checkpoint
  }

  await flush();

  const total = Object.values(prons.players).filter((e) => e && e.mp3).length;
  console.log(`\nThis run: +${ok} audio, ${miss} confirmed misses, ${requests} Forvo requests.`);
  console.log(`Total players with audio now: ${total}.`);
  if (limitHit) console.log('Stopped on rate limit — run again tomorrow to continue.');
}

main().catch((e) => { console.error(e); process.exit(1); });
