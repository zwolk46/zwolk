#!/usr/bin/env node
// Idempotent uploader: syncs law/data subdirs to Vercel Blob.
//
// Run after enabling Blob in the Vercel dashboard for this project:
//   1. Vercel dashboard → Storage → Create Blob Store
//   2. `vercel env pull .env.local` (or paste BLOB_READ_WRITE_TOKEN by hand)
//   3. `node law/scripts/upload-blob.mjs`
//
// Each entry in TARGETS maps a local directory under law/data/ to its blob
// key prefix. Files under that directory upload with key = prefix + relative
// path. The /api/law-proxy function fetches blob keys directly from the
// pathname after /api/law/, so the lawClient (baseUrl /api/law) and geoClient
// (same baseUrl) both land their requests at matching blob keys with no extra
// rewrite glue:
//
//   law/data/index/jur/us-usc-t9.json    → blob key 'jur/us-usc-t9.json'
//                                       served at /api/law/jur/us-usc-t9.json
//   law/data/coverage/NY.json            → blob key 'coverage/NY.json'
//                                       served at /api/law/coverage/NY.json
//   law/data/geo/fips-jurisdictions.json → blob key 'geo/fips-jurisdictions.json'
//                                       served at /api/law/geo/fips-jurisdictions.json
//
// Idempotency: existing blobs are listed once, and any file whose on-disk
// size matches the existing blob size is skipped.

import { put, list } from '@vercel/blob';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '..', 'data');

const TARGETS = [
  // local-dir-relative-to-data/  →  blob-key-prefix
  { dir: 'index',    prefix: '',         skip: [] },
  { dir: 'coverage', prefix: 'coverage', skip: [] },
  // geo/places/ is large per-state TOPO; load lazily later, don't ship in bulk.
  { dir: 'geo',      prefix: 'geo',      skip: ['places'] },
];

async function* walk(dir, skip = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    if (skip.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, skip);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      yield full;
    }
  }
}

async function existingBlobs() {
  const map = new Map(); // pathname → size
  let cursor;
  do {
    const page = await list({ cursor, limit: 1000 });
    for (const b of page.blobs) map.set(b.pathname, b.size);
    cursor = page.cursor;
  } while (cursor);
  return map;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set.');
    console.error('Set it by running `vercel env pull .env.local` from the repo root, then source the file, or paste it inline:');
    console.error('  BLOB_READ_WRITE_TOKEN=vercel_blob_… node law/scripts/upload-blob.mjs');
    process.exit(1);
  }

  console.log('Reading existing blobs…');
  const existing = await existingBlobs();
  console.log(`Found ${existing.size} existing blob(s).`);

  let uploaded = 0,
    skipped = 0,
    bytesUploaded = 0,
    missingDirs = 0;

  for (const target of TARGETS) {
    const localDir = path.join(DATA_ROOT, target.dir);
    try {
      await stat(localDir);
    } catch {
      console.warn(`  (skipping ${target.dir} — directory not present locally)`);
      missingDirs++;
      continue;
    }
    for await (const full of walk(localDir, target.skip)) {
      const rel = path.relative(localDir, full).split(path.sep).join('/');
      const key = target.prefix ? `${target.prefix}/${rel}` : rel;
      const s = await stat(full);
      if (existing.get(key) === s.size) {
        skipped++;
        continue;
      }
      const body = await readFile(full);
      await put(key, body, {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: true,
      });
      uploaded++;
      bytesUploaded += s.size;
      console.log(`  ↑ ${key} (${formatBytes(s.size)})`);
    }
  }

  console.log(
    `Done. uploaded=${uploaded} (${formatBytes(bytesUploaded)}), skipped=${skipped}, missing dirs=${missingDirs}.`
  );
}

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
