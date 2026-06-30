// Auth-gated proxy for /api/law/<pathname> → Vercel Blob.
// The repo's middleware.js already gates everything under /api/* behind the
// zwolk_auth cookie; by the time this handler runs the request is trusted.
// Files are uploaded to Blob with `addRandomSuffix: false` so the pathname we
// receive on the URL is the exact blob key. We use the SDK's get() to stream
// the bytes — get() attaches the Authorization header automatically for
// private stores, which head().downloadUrl does NOT (that's a public URL).

const { get } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  // Parse the pathname out of req.url — vanilla Vercel Functions don't always
  // populate req.query.path for catch-all routes the same way Next.js does.
  let pathname = '';
  try {
    const u = new URL(req.url || '/', 'http://x');
    const after = u.pathname.replace(/^\/+api\/+law\/+/, '');
    pathname = decodeURIComponent(after.replace(/^\/+|\/+$/g, ''));
  } catch {
    return res.status(400).json({ error: 'Bad path encoding' });
  }
  if (!pathname || pathname.includes('..') || pathname.startsWith('/')) {
    return res.status(400).json({ error: 'Bad path' });
  }

  let result;
  try {
    result = await get(pathname, { access: 'private' });
  } catch (err) {
    return res
      .status(502)
      .json({ error: 'Blob get failed', detail: String((err && err.message) || err) });
  }
  if (!result) {
    return res.status(404).json({ error: 'Not found', path: pathname });
  }

  res.setHeader('Content-Type', result.blob.contentType || 'application/json');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  if (req.method === 'HEAD' || !result.stream) {
    res.setHeader('Content-Length', String(result.blob.size || 0));
    return res.status(200).end();
  }

  res.statusCode = 200;
  const reader = result.stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const ok = res.write(Buffer.from(value));
      if (!ok) await new Promise((r) => res.once('drain', r));
    }
  } catch {
    // client disconnected or upstream interrupted
  } finally {
    res.end();
  }
};
