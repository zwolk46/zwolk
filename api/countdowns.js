// Vercel serverless function: reads/writes the countdowns list in Vercel KV.
// KV_REST_API_URL and KV_REST_API_TOKEN are auto-injected when you connect
// a Vercel KV store to this project — no manual env var setup needed.

const KEY = "countdowns";

async function readList() {
  const res = await fetch(
    `${process.env.KV_REST_API_URL}/get/${KEY}`,
    { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
  );
  if (!res.ok) throw new Error(`KV read failed: ${res.status} ${await res.text()}`);
  const { result } = await res.json();
  return result ? JSON.parse(result) : [];
}

async function writeList(list) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", KEY, JSON.stringify(list)]),
  });
  if (!res.ok) throw new Error(`KV write failed: ${res.status} ${await res.text()}`);
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
