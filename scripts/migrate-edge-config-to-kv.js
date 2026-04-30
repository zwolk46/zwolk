/* eslint-disable no-console */
const { storageKey } = require('../api/_auth');
const { kvSetJson } = require('../api/_kv');

const EC_READ_BASE = 'https://edge-config.vercel.com';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function readEdgeItem(key) {
  const id = requireEnv('EC_ID');
  const token = requireEnv('EC_TOKEN');
  const res = await fetch(`${EC_READ_BASE}/${id}/item/${encodeURIComponent(key)}?token=${token}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Edge Config read failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function migrateKey(baseKey, role) {
  const targetKey = storageKey(baseKey, role);
  let value = await readEdgeItem(targetKey);
  if (value === null && role === 'admin') {
    // Legacy fallback used by the old Edge Config integration.
    value = await readEdgeItem(baseKey);
  }
  if (value === null) return { migrated: false, reason: 'missing' };
  await kvSetJson(targetKey, value);
  return { migrated: true };
}

async function main() {
  const roles = ['admin', 'public'];
  const baseKeys = [
    'countdowns',
    'countdowns:active-id:v1',
    'socratic:graph:v1',
    'wage:hourly-v1',
    'ipa:dictionary-overrides:v1',
    'ipa:sessions:v1',
  ];

  console.log('Migrating Edge Config -> Vercel KV');
  console.log('Base keys:', baseKeys.join(', '));
  console.log('Roles:', roles.join(', '));

  const results = [];
  for (const baseKey of baseKeys) {
    for (const role of roles) {
      try {
        const r = await migrateKey(baseKey, role);
        results.push({ baseKey, role, ...r });
        console.log(`${r.migrated ? 'OK ' : 'SKIP'} ${role} ${baseKey}`);
      } catch (e) {
        results.push({ baseKey, role, migrated: false, reason: String(e.message || e) });
        console.log(`ERR ${role} ${baseKey}: ${String(e.message || e)}`);
      }
    }
  }

  const migrated = results.filter(r => r.migrated).length;
  const skipped = results.filter(r => !r.migrated && r.reason === 'missing').length;
  const errored = results.filter(r => !r.migrated && r.reason && r.reason !== 'missing').length;
  console.log(`Done. migrated=${migrated} skipped_missing=${skipped} errors=${errored}`);
  if (errored) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

