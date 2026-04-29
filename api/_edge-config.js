const EC_READ_BASE = 'https://edge-config.vercel.com';
const EC_WRITE_BASE = 'https://api.vercel.com';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function readItem(key) {
  const id = requireEnv('EC_ID');
  const token = requireEnv('EC_TOKEN');
  const res = await fetch(`${EC_READ_BASE}/${id}/item/${encodeURIComponent(key)}?token=${token}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`EC read failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function writeItem(key, value) {
  const id = requireEnv('EC_ID');
  const teamId = requireEnv('EC_TEAM_ID');
  const token = requireEnv('EC_WRITE_TOKEN');
  const res = await fetch(`${EC_WRITE_BASE}/v1/edge-config/${id}/items?teamId=${teamId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ operation: 'upsert', key, value }],
    }),
  });
  if (!res.ok) throw new Error(`EC write failed: ${res.status} ${await res.text()}`);
}

module.exports = { readItem, writeItem };
