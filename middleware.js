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
]);

const PUBLIC_PREFIXES = [
  '/login/',
  '/homepage/',
  '/social/',
  '/omniconvert/',
  '/api/omniconvert/',
  '/northwestern/',
  '/api/northwestern/',
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

  if (decodedToken && validTokens.includes(decodedToken)) return;

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
