// Vercel serverless function: reads/writes the countdowns list in Supabase.
// Storage model: a single row in table `app_state` (key text pk, value jsonb).
//
// One-time Supabase setup (run in the SQL editor):
//   create table if not exists app_state (
//     key text primary key,
//     value jsonb not null,
//     updated_at timestamptz not null default now()
//   );
//   insert into app_state (key, value) values ('countdowns', '[]'::jsonb)
//     on conflict (key) do nothing;
//
// Required env vars (auto-set by the Vercel Supabase integration):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const KEY = "countdowns";

function env() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return { url: url.replace(/\/+$/, ""), key };
}

async function readList() {
  const { url, key } = env();
  const res = await fetch(
    `${url}/rest/v1/app_state?key=eq.${KEY}&select=value`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) throw new Error(`Supabase read failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].value || [] : [];
}

async function writeList(list) {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/app_state?on_conflict=key`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ key: KEY, value: list, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase write failed: ${res.status} ${await res.text()}`);
}

function sanitize(cd) {
  if (!cd || typeof cd !== "object") return null;
  const id = String(cd.id || "").slice(0, 64);
  const title = String(cd.title || "").slice(0, 120);
  const target = String(cd.target || "");
  const tz = String(cd.tz || "");
  if (!id || !title || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(target) || !tz) return null;
  return { id, title, target, tz };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : null); } catch { resolve(null); } });
    req.on("error", () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const list = await readList();
      res.status(200).json({ countdowns: list });
      return;
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const incoming = Array.isArray(body && body.countdowns) ? body.countdowns : null;
      if (!incoming) { res.status(400).json({ error: "Expected { countdowns: [...] }" }); return; }
      const cleaned = incoming.map(sanitize).filter(Boolean);
      await writeList(cleaned);
      res.status(200).json({ countdowns: cleaned });
      return;
    }
    res.setHeader("Allow", "GET, PUT");
    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
