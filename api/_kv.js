function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function kvUrl() {
  return requireEnv('KV_REST_API_URL');
}

function kvToken() {
  return process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN || '';
}

function kvReady() {
  return !!(process.env.KV_REST_API_URL && (process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN));
}

function kvWriteReady() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(parts) {
  if (!kvReady()) {
    throw new Error('Vercel KV is not configured (missing KV_REST_API_URL / KV_REST_API_TOKEN)');
  }
  const res = await fetch(kvUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kvToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parts),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `KV request failed: ${res.status}`);
  }
  return data.result;
}

async function kvGetJson(key) {
  const raw = await kvCommand(['GET', key]);
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function kvSetJson(key, value) {
  if (!kvWriteReady()) {
    throw new Error('Vercel KV writes are not configured (missing KV_REST_API_TOKEN)');
  }
  // Store everything as JSON to keep types stable across reads.
  await kvCommand(['SET', key, JSON.stringify(value)]);
}

module.exports = {
  kvCommand,
  kvGetJson,
  kvReady,
  kvWriteReady,
  kvSetJson,
};
