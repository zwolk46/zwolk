export default function middleware(req) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith('/login') || pathname === '/api/login') {
    return;
  }

  if (pathname.startsWith('/social/')) {
    return;
  }

  if (pathname === '/favicon.png' || pathname === '/favicon.ico') {
    return;
  }

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
    return;
  }

  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  const previewBotHints = [
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'whatsapp',
    'applebot',
    'googlebot',
    'bingbot',
    'duckduckbot',
    'pinterest',
    'skypeuripreview',
    'embedly',
    'quora link preview',
    'crawler',
    'spider',
    'bot',
  ];
  if (previewBotHints.some(hint => ua.includes(hint))) {
    return;
  }

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return Response.redirect(loginUrl);
}
