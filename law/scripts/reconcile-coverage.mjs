#!/usr/bin/env node
// Re-classify every coverage/<ST>.json place against the freshly-rebuilt
// data/index/jurisdictions.json, then rewrite data/coverage/summary.json so
// the /coverage dashboard and the /map coloring agree. Runs offline; no
// network. Use after `node scripts/build-index.mjs` when the ingested set
// has changed but scan-coverage.mjs (which pulls the OLC catalog) can't run.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDX = path.resolve(__dirname, '../data/index');
const COV = path.resolve(__dirname, '../data/coverage');

async function readJson(f, fb) {
  try {
    return JSON.parse(await readFile(f, 'utf8'));
  } catch {
    return fb;
  }
}

async function main() {
  const reg = await readJson(path.join(IDX, 'jurisdictions.json'), { items: [] });
  const ingestedSet = new Set((reg.items || []).map((i) => i.jurisdictionId));
  console.log(`Ingested corpora in index: ${ingestedSet.size}`);

  const files = (await readdir(COV))
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !['summary.json', 'gaps.json'].includes(f));

  const national = { states: 0, available: 0, ingested: 0, gap: 0 };
  const states = {};
  const gaps = [];

  for (const f of files) {
    const usps = f.replace(/\.json$/, '');
    const cov = await readJson(path.join(COV, f), null);
    if (!cov || !Array.isArray(cov.places)) continue;

    let ingested = 0;
    let available = 0;
    let gap = 0;

    const rewrittenPlaces = cov.places.map((p) => {
      const jurs = Array.isArray(p.jurisdictionIds)
        ? p.jurisdictionIds
        : p.jurisdictionId
          ? [p.jurisdictionId]
          : [];
      const isIngested = jurs.some((j) => ingestedSet.has(j));

      let status = p.status || 'gap';
      if (isIngested) status = 'ingested';
      else if (p.sourceUrl && status !== 'gap') status = 'available';
      else if (!p.sourceUrl) status = 'gap';

      if (status === 'ingested') ingested++;
      else if (status === 'available') available++;
      else {
        gap++;
        gaps.push({ usps, fips: p.fips, name: p.name });
      }
      return { ...p, status };
    });

    const counts = { ingested, available, gap };
    // Rewrite per-state file with corrected place statuses + counts
    await writeFile(
      path.join(COV, f),
      JSON.stringify({ ...cov, counts, places: rewrittenPlaces }, null, 2)
    );

    if (ingested + available + gap > 0) {
      states[usps] = counts;
      national.available += available;
      national.ingested += ingested;
      national.gap += gap;
      national.states++;
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    national,
    states,
  };
  await writeFile(path.join(COV, 'summary.json'), JSON.stringify(summary, null, 2));
  await writeFile(path.join(COV, 'gaps.json'), JSON.stringify(gaps.slice(0, 5000), null, 2));

  console.log(
    `Rewrote ${files.length} state files + summary. National: ${JSON.stringify(national)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
