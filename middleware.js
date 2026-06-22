// Public paths: anyone can visit without a session cookie.
// The landing page and its assets render for everyone; tools require auth.
const PUBLIC_EXACT = new Set([
  '/',
  '/index.html',
  '/styles.css',
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/favicon-light.svg',
  '/favicon-dark.svg',
  '/letter-z.png',
  '/login',
  '/api/me',
  '/api/login',
  '/api/logout',
  '/omniconvert',
  '/northwestern',
  '/goinghome',
  '/apple',
]);

const PUBLIC_PREFIXES = [
  '/login/',
  '/homepage/',
  '/social/',
  '/omniconvert/',
  '/api/omniconvert/',
  '/northwestern/',
  '/api/northwestern/',
  '/goinghome/',
  '/apple/',
];

// API paths that require auth — return 401 JSON on failure (no redirect).
function isApiPath(pathname) {
  return pathname.startsWith('/api/');
}

function isPublic(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

// ─── wc2026api.com proxy (inlined into middleware to stay under the 12-function
// Hobby-plan cap). Runs ONLY after the auth check passes, so unauthenticated
// users can't burn the daily budget. ────────────────────────────────────────────
const WC_PREFIX = '/api/wc2026/';
const WC_UPSTREAM = 'https://api.wc2026api.com';
const WC_DAILY_CAP = 490; // hard ceiling under the 500/day Pro key auto-disable

const WC_ALLOWED = [
  /^\/teams$/,
  /^\/matches$/,
  /^\/matches\/\d+$/,
  /^\/matches\/\d+\/stats$/,
  /^\/groups$/,
  /^\/stadiums$/,
  /^\/test\/match$/,
];

function wcCacheTtl(path) {
  if (path === '/matches' || path === '/groups') return 25;
  if (/^\/matches\/\d+$/.test(path)) return 25;
  if (/^\/matches\/\d+\/stats$/.test(path)) return 20;
  if (path === '/test/match') return 5;
  return 600; // teams / stadiums effectively static during tournament
}

function utcDayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Upstash REST one-shot. Returns the `result` field on success, or null on
// any failure — KV downtime should never block the proxy.
async function wcKvCmd(parts) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(parts),
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => ({}));
    return data && 'result' in data ? data.result : null;
  } catch {
    return null;
  }
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function handleWcProxy(req) {
  const apiKey = process.env.WC_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'WC_API_KEY not configured' }, 500);

  const url = new URL(req.url);
  const upstreamPath = url.pathname.slice(WC_PREFIX.length - 1); // keep leading slash
  if (!upstreamPath || upstreamPath.includes('..') || !WC_ALLOWED.some((re) => re.test(upstreamPath))) {
    return jsonResponse({ error: 'Unknown wc2026 endpoint', path: upstreamPath }, 404);
  }
  const query = url.search; // includes "?" or ""
  const cacheKey = `wc:apicache:wc2026:${upstreamPath}${query}`;

  // 1) Cache hits don't burn the daily cap.
  const cachedRaw = await wcKvCmd(['GET', cacheKey]);
  if (cachedRaw) {
    try {
      const parsed = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
      if (parsed && parsed.status && parsed.body !== undefined) {
        return jsonResponse(parsed.body, parsed.status, { 'X-WC-Cache': 'HIT' });
      }
    } catch {}
  }

  // 2) Daily cap (per-API). If KV is unavailable, fail open — better to serve
  //    than to deny on infra hiccups.
  const capKey = `wc:apicap:wc2026:${utcDayKey()}`;
  const count = await wcKvCmd(['INCR', capKey]);
  if (count === 1) wcKvCmd(['EXPIRE', capKey, 90000]); // slightly over 24h
  if (typeof count === 'number' && count > WC_DAILY_CAP) {
    return jsonResponse(
      { error: 'Daily wc2026api.com request cap reached', cap: WC_DAILY_CAP, count, resets: 'next UTC day' },
      429,
      { 'X-WC-Cap': `${count}/${WC_DAILY_CAP}` }
    );
  }
  const capHeader = typeof count === 'number' ? `${count}/${WC_DAILY_CAP}` : 'KV-DOWN';

  // 3) Upstream call. The Bearer key never leaves this function.
  let upstreamRes;
  try {
    upstreamRes = await fetch(`${WC_UPSTREAM}${upstreamPath}${query}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    return jsonResponse({ error: 'Upstream fetch failed', detail: String(err && err.message || err) }, 502, { 'X-WC-Cap': capHeader });
  }
  const text = await upstreamRes.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }

  if (upstreamRes.ok) {
    wcKvCmd(['SET', cacheKey, JSON.stringify({ status: upstreamRes.status, body }), 'EX', wcCacheTtl(upstreamPath)]);
  }

  return jsonResponse(body, upstreamRes.status, { 'X-WC-Cache': 'MISS', 'X-WC-Cap': capHeader });
}
// ────────────────────────────────────────────────────────────────────────────────

export default function middleware(req) {
  const { pathname } = new URL(req.url);

  if (isPublic(pathname)) return;

  const cookieStr = req.headers.get('cookie') || '';
  const token = cookieStr
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('zwolk_auth='))
    ?.slice('zwolk_auth='.length);
  let decodedToken = token || '';
  try {
    decodedToken = decodeURIComponent(decodedToken);
  } catch {
    decodedToken = token || '';
  }

  const validTokens = [
    process.env.GUEST_SESSION_TOKEN,
    process.env.ADMIN_SESSION_TOKEN || process.env.SESSION_TOKEN,
  ].filter(Boolean);

  if (decodedToken && validTokens.includes(decodedToken)) {
    // Authenticated. If this is a WC proxy request, handle it here rather than
    // forwarding to a serverless function — keeps us under the Hobby-plan cap.
    if (pathname.startsWith(WC_PREFIX)) return handleWcProxy(req);
    return;
  }

  if (isApiPath(pathname)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // Allow link-preview bots through so social cards render.
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  const previewBotHints = [
    'facebookexternalhit', 'twitterbot', 'linkedinbot', 'slackbot', 'discordbot',
    'telegrambot', 'whatsapp', 'applebot', 'googlebot', 'bingbot', 'duckduckbot',
    'pinterest', 'skypeuripreview', 'embedly', 'quora link preview',
    'crawler', 'spider', 'bot',
  ];
  if (previewBotHints.some(hint => ua.includes(hint))) return;

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return Response.redirect(loginUrl);
}
