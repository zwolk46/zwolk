#!/usr/bin/env node
// Refresh Forvo pronunciations: re-query the standard-pronunciation endpoint
// for every name that already exists in pronunciations.json, download the
// resolved MP3 binary to data/enrichment/pronunciations/<kind>/<slug>.mp3,
// and rewrite pronunciations.json so `mp3` points at the local path instead
// of the temporary Forvo URL (which expires).
//
// Forvo's apifree.forvo.com pathmp3 URLs are signed/expiring — once cached
// they stop returning audio after a while ("Audio request is expired."). By
// snapshotting the binary at refresh time we get a stable, CDN-friendly
// pronunciation feature with no runtime API calls.
//
// Usage: node scripts/refresh-pronunciations.mjs
// Requires data/enrichment/keys.local.json with { forvo: { key: "..." } }.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function curlText(url) {
  const r = spawnSync('curl', ['-sSL', '--max-time', '20', url], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`curl ${url}: ${r.stderr || 'failed'}`);
  return r.stdout;
}

function curlBytes(url, destPath) {
  const r = spawnSync('curl', ['-sSL', '--max-time', '30', '-o', destPath, url], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`curl download ${url}: ${r.stderr || 'failed'}`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WC_ROOT = resolve(__dirname, '..');
const PRONS_FILE = join(WC_ROOT, 'data/enrichment/pronunciations.json');
const KEYS_FILE = join(WC_ROOT, 'data/enrichment/keys.local.json');
const AUDIO_DIR = join(WC_ROOT, 'data/enrichment/pronunciations');
const PUBLIC_PREFIX = '/wc/data/enrichment/pronunciations';

const slug = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const LANG_CODE = {
  english: 'en', french: 'fr', spanish: 'es', portuguese: 'pt', german: 'de',
  italian: 'it', dutch: 'nl', arabic: 'ar', persian: 'fa', turkish: 'tr',
};

function forvoCall(key, action, word, langCode) {
  const url = `https://apifree.forvo.com/key/${encodeURIComponent(key)}/format/json/action/${action}/word/${encodeURIComponent(word)}/language/${langCode}/`;
  const body = curlText(url);
  const j = JSON.parse(body);
  return j && Array.isArray(j.items) ? j.items[0] || null : null;
}

function forvoLookup(key, word, langHint) {
  const code = LANG_CODE[String(langHint || 'english').toLowerCase()] || 'en';
  const tries = [
    ['standard-pronunciation', word, 'en'],
    ['standard-pronunciation', word, code],
    ['word-pronunciations', word, code],
    ['word-pronunciations', word, 'en'],
  ];
  for (const [action, w, lc] of tries) {
    try {
      const item = forvoCall(key, action, w, lc);
      if (item && item.pathmp3) return item;
    } catch { /* try next */ }
  }
  return null;
}

async function downloadMp3(srcUrl, destPath) {
  curlBytes(srcUrl, destPath);
  const { statSync } = await import('node:fs');
  const size = statSync(destPath).size;
  if (size < 1024) throw new Error(`download: tiny payload (${size} bytes) — likely expired/invalid`);
  return size;
}

async function main() {
  const keys = JSON.parse(await readFile(KEYS_FILE, 'utf8'));
  const forvoKey = keys?.forvo?.key;
  if (!forvoKey) throw new Error('Missing forvo.key in keys.local.json');

  const prons = JSON.parse(await readFile(PRONS_FILE, 'utf8'));
  prons._meta = prons._meta || {};
  prons._meta.audio_storage = 'local';
  prons._meta.audio_path_prefix = PUBLIC_PREFIX;
  prons._meta.refreshed_at = new Date().toISOString().slice(0, 10);

  await mkdir(join(AUDIO_DIR, 'countries'), { recursive: true });
  await mkdir(join(AUDIO_DIR, 'players'), { recursive: true });

  for (const kind of ['countries', 'players']) {
    const bucket = prons[kind] || {};
    for (const [name, entry] of Object.entries(bucket)) {
      if (!entry || !entry.word) continue;
      const word = entry.word;
      const file = slug(name) + '.mp3';
      const destPath = join(AUDIO_DIR, kind, file);
      const publicPath = `${PUBLIC_PREFIX}/${kind}/${file}`;
      try {
        const item = forvoLookup(forvoKey, word, entry.language);
        if (!item || !item.pathmp3) {
          entry.mp3 = null;
          console.warn(`[skip] ${kind}/${name}: no pathmp3 from Forvo (cleared)`);
          continue;
        }
        const bytes = await downloadMp3(item.pathmp3, destPath);
        entry.mp3 = publicPath;
        entry.hits = item.hits ?? entry.hits;
        console.log(`[ok]   ${kind}/${name} → ${publicPath} (${bytes} bytes)`);
      } catch (err) {
        console.warn(`[fail] ${kind}/${name}: ${err.message}`);
      }
      await new Promise((res) => setTimeout(res, 120));
    }
  }

  await writeFile(PRONS_FILE, JSON.stringify(prons, null, 2) + '\n');
  console.log('Wrote', PRONS_FILE);
}

main().catch((e) => { console.error(e); process.exit(1); });
