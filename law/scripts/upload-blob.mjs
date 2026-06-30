#!/usr/bin/env node
// Idempotent uploader: syncs law/data/index/**.json to Vercel Blob.
//
// Run after enabling Blob in the Vercel dashboard for this project:
//   1. Vercel dashboard → Storage → Create Blob Store
//   2. `vercel env pull .env.local` (or copy BLOB_READ_WRITE_TOKEN by hand)
//   3. `node law/scripts/upload-blob.mjs`
//
// Files are uploaded with the same pathname as their relative path under
// data/index/ — e.g., data/index/jur/us-usc-t9.json becomes blob key
// "jur/us-usc-t9.json", which the /api/law/[...path].js proxy fetches by
// passing through the catch-all segments. addRandomSuffix: false keeps the
// keys deterministic so re-uploads overwrite in place.
//
// Idempotency: existing blobs are listed once, and any file whose on-disk
// size matches the existing blob size is skipped. This lets you re-run the
// script after partial uploads or to top up new corpora without re-shipping
// hundreds of MB.

import { put, list } from '@vercel/blob';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'data', 'index');

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
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
  try {
    await stat(ROOT);
  } catch {
    console.error(`Missing ${ROOT}. Run the build pipeline first: \`node law/scripts/build-index.mjs\`.`);
    process.exit(1);
  }

  console.log(`Reading existing blobs…`);
  const existing = await existingBlobs();
  console.log(`Found ${existing.size} existing blob(s).`);

  let uploaded = 0,
    skipped = 0,
    bytesUploaded = 0;
  for await (const full of walk(ROOT)) {
    const key = path.relative(ROOT, full).split(path.sep).join('/');
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
  console.log(
    `Done. uploaded=${uploaded} (${formatBytes(bytesUploaded)}), skipped=${skipped}.`
  );
}

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
