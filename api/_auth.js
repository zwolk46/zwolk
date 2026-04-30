const crypto = require('crypto');

const COOKIE_NAME = 'zwolk_auth';
const ROLES = ['public', 'admin'];

function parseCookies(header) {
  const out = {};
  String(header || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(part => {
      const eq = part.indexOf('=');
      if (eq < 0) return;
      const rawValue = part.slice(eq + 1);
      try {
        out[part.slice(0, eq)] = decodeURIComponent(rawValue);
      } catch {
        out[part.slice(0, eq)] = rawValue;
      }
    });
  return out;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function tokenForRole(role) {
  if (role === 'admin') return process.env.ADMIN_SESSION_TOKEN || process.env.SESSION_TOKEN || '';
  if (role === 'public') return process.env.GUEST_SESSION_TOKEN || '';
  return '';
}

function passwordForRole(role) {
  if (role === 'admin') return process.env.ADMIN_SITE_PASSWORD || process.env.SITE_PASSWORD || '';
  if (role === 'public') return process.env.GUEST_SITE_PASSWORD || '';
  return '';
}

function roleForPassword(password) {
  const candidate = String(password || '');
  for (const role of ['admin', 'public']) {
    const expected = passwordForRole(role);
    if (expected && safeEqual(candidate, expected)) return role;
  }
  return null;
}

function roleForToken(token) {
  const candidate = String(token || '');
  for (const role of ROLES) {
    const expected = tokenForRole(role);
    if (expected && safeEqual(candidate, expected)) return role;
  }
  return null;
}

function getAuthRole(req) {
  const cookies = parseCookies(req.headers.cookie);
  return roleForToken(cookies[COOKIE_NAME]);
}

function requireAuthRole(req, res) {
  const role = getAuthRole(req);
  if (role) return role;
  res.status(401).json({ error: 'Unauthorized' });
  return null;
}

function storageKey(baseKey, role) {
  if (!ROLES.includes(role)) throw new Error('Invalid storage role');
  return `${role}:${baseKey}`;
}

module.exports = {
  COOKIE_NAME,
  ROLES,
  getAuthRole,
  parseCookies,
  passwordForRole,
  requireAuthRole,
  roleForPassword,
  roleForToken,
  storageKey,
  tokenForRole,
};
