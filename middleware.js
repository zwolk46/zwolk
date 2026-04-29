export default function middleware(req) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith('/login') || pathname === '/api/login') {
    return;
  }

  if (pathname.startsWith('/social/')) {
    return;
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

  const cookieStr = req.headers.get('cookie') || '';
  const token = cookieStr
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('zwolk_auth='))
    ?.slice('zwolk_auth='.length);

  if (token && token === process.env.SESSION_TOKEN) {
    return;
  }

  return Response.redirect(new URL('/login', req.url));
}
