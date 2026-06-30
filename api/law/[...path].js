// Auth-gated proxy for /api/law/<pathname> → Vercel Blob.
// The repo's middleware.js already gates everything under /api/* behind the
// zwolk_auth cookie; by the time this handler runs the request is trusted.
// Files are uploaded to Blob with `addRandomSuffix: false` so the pathname we
// receive on the URL is the exact blob key. We use head().downloadUrl (a
// pre-signed, short-lived URL the SDK mints from BLOB_READ_WRITE_TOKEN) and
// stream the body back so the raw blob URL never leaves the function.

const { head } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const raw = req.query.path;
  const parts = Array.isArray(raw) ? raw : raw ? [raw] : [];
  let pathname;
  try {
    pathname = parts.map((s) => decodeURIComponent(String(s))).join('/');
  } catch {
    return res.status(400).json({ error: 'Bad path encoding' });
  }
  if (!pathname || pathname.includes('..') || pathname.startsWith('/')) {
    return res.status(400).json({ error: 'Bad path' });
  }

  let meta;
  try {
    meta = await head(pathname);
  } catch {
    return res.status(404).json({ error: 'Not found', path: pathname });
  }

  if (req.method === 'HEAD') {
    res.setHeader('Content-Type', meta.contentType || 'application/json');
    res.setHeader('Content-Length', String(meta.size || 0));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).end();
  }

  const upstream = await fetch(meta.downloadUrl);
  if (!upstream.ok || !upstream.body) {
    return res.status(502).json({ error: 'Blob fetch failed', status: upstream.status });
  }

  res.setHeader('Content-Type', meta.contentType || 'application/json');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.statusCode = 200;

  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const ok = res.write(Buffer.from(value));
      if (!ok) await new Promise((r) => res.once('drain', r));
    }
  } catch (err) {
    // Client disconnected or upstream interrupted; nothing useful to add.
  } finally {
    res.end();
  }
};
