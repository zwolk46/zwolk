export default function middleware(req) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith('/login') || pathname === '/api/login') {
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
