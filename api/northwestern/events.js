// Northwestern Events Hub — single Edge Function.
// GET            → return cached events from Vercel KV (or live-fetch on cold start)
// GET ?refresh=1 → re-fetch from sources and rewrite KV (auth required: x-vercel-cron or CRON_SECRET)
// POST           → same as ?refresh=1
//
// Runs on the Edge runtime so it doesn't count against the Hobby 12-Serverless cap.

export const config = { runtime: 'edge' };

// Versioned key — bump when the event schema (e.g. food detector) changes so
// existing caches don't serve stale records.
const SCHEMA_VERSION = 'v2';
const EVENTS_KEY = `nu:events:all:${SCHEMA_VERSION}`;
const META_KEY   = `nu:events:meta:${SCHEMA_VERSION}`;

// ─── KV (Vercel KV REST API) ────────────────────────────────────────────────
const KV_URL   = () => process.env.KV_REST_API_URL;
const KV_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN || '';
function kvReady()      { return !!(process.env.KV_REST_API_URL && (process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN)); }
function kvWriteReady() { return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN); }

async function kvCmd(parts) {
  if (!kvReady()) throw new Error('KV not configured');
  const r = await fetch(KV_URL(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error || `KV ${r.status}`);
  return data.result;
}
async function kvGetJson(k) {
  const raw = await kvCmd(['GET', k]);
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}
async function kvSetJson(k, v) {
  if (!kvWriteReady()) throw new Error('KV write not configured');
  await kvCmd(['SET', k, JSON.stringify(v)]);
}

// ─── HTML/XML helpers ───────────────────────────────────────────────────────
function htmlDecode(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}
function stripTags(s) { return typeof s === 'string' ? s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''; }
function truncate(s, n) { return !s ? '' : s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'; }

// ─── Food detection ─────────────────────────────────────────────────────────
// Per user spec: flag ANY event mentioning food, UNLESS there's a cover charge.
// We collect the matched food terms so users see WHY it matched.

// Broad food-keyword list. A single match is enough.
const FOOD_KEYWORDS = [
  // meals
  'breakfast','brunch','lunch','dinner','supper','meal','meals',
  // generic food words
  'food','meals','snacks','snack','refreshments','refreshment','catering','catered',
  // specific foods that commonly appear at events
  'pizza','bagels','bagel','donuts','doughnuts','donut','doughnut','cookies','cookie',
  'sandwiches','sandwich','tacos','taco','sushi','burritos','burrito','wraps','wrap',
  'salad','salads','soup','chips','candy','pastries','pastry','cake','cupcakes','cupcake',
  'desserts','dessert','ice cream','popcorn','fruit','snack bar','hor d\'oeuvres',
  'hors d\'oeuvres','appetizers','appetizer','bbq','barbecue','barbeque','cookout',
  // drinks/coffee bars
  'coffee','espresso','tea','boba','bubble tea','smoothies','smoothie','soda','beverages','beverage',
  'mocktails','cocktails','wine','beer','champagne','prosecco',
  // events that almost always include food
  'reception','receptions','happy hour','mixer','potluck','tailgate','feast','luncheon','banquet','gala',
  'food truck','food trucks','tasting','tastings','open house','networking lunch','networking breakfast',
  // explicit phrases
  'free food','free pizza','free lunch','free dinner','free breakfast','free coffee','free snacks',
  'lunch will be served','lunch is provided','lunch provided','dinner provided','breakfast provided',
  'snacks provided','refreshments provided','food provided','meals provided',
  'light bites','light fare','light refreshments','light snacks','light lunch','light breakfast',
];

// Anything that means attendees pay — those events are excluded.
const PAID_PATTERNS = [
  /\$\s?\d/,                                                               // any dollar amount
  /\b(?:cover\s+charge|admission\s+(?:fee|charge)|entry\s+(?:fee|charge|cost))\b/i,
  /\b(?:cost(?:s)?|priced?|fee|price|tickets?)\s*[:=]?\s*\$\s?\d/i,
  /\btickets?\s+(?:are|cost|priced?|start|begin|sold|available\s+for)\s+(?:at\s+)?\$/i,
  /\bregistration\s+(?:is\s+)?\$\d/i,
  /\b\d+\s+dollars?\b/i,
  /\b(?:rsvp|register)\s+(?:and\s+)?pay\b/i,
  /\bpay\s+(?:at\s+the\s+door|in\s+advance)\b/i,
  /\bpurchase\s+tickets?\b/i,
  /\bpaid\s+(?:event|admission|attendance)\b/i,
];

// Build a single regex matching any food keyword (case-insensitive, word-bounded for letters).
const FOOD_REGEX = (() => {
  const escaped = FOOD_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // Use a word-boundary-ish wrapper; allow multi-word phrases
  return new RegExp(`(?:^|[\\s,;:.!?(\\[/&])(${escaped.join('|')})(?=[\\s,;:.!?)\\]/&]|$)`, 'gi');
})();

function detectFreeFood(text) {
  if (!text) return { freeFood: false, foodKeywords: [] };

  // Exclude paid events first.
  for (const re of PAID_PATTERNS) {
    if (re.test(text)) return { freeFood: false, foodKeywords: [] };
  }

  // Collect food keyword matches.
  const hits = new Set();
  let m;
  FOOD_REGEX.lastIndex = 0;
  while ((m = FOOD_REGEX.exec(text)) !== null) {
    hits.add(m[1].toLowerCase());
  }
  if (!hits.size) return { freeFood: false, foodKeywords: [] };
  return { freeFood: true, foodKeywords: Array.from(hits).slice(0, 4) };
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}
function getAll(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = []; let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function getCdata(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}

// ─── PlanItPurple parser ────────────────────────────────────────────────────
function parsePlanItEvent(xml) {
  const title = htmlDecode(getTag(xml, 'title').trim());
  if (!title) return null;
  const startSec = parseInt(getTag(xml, 'start_datetime'), 10);
  const endSec   = parseInt(getTag(xml, 'end_datetime'), 10);
  if (!startSec) return null;

  const tz       = getTag(xml, 'time_zone').trim() || 'CT';
  const location = htmlDecode(getTag(xml, 'location').trim());
  const addressXml = getTag(xml, 'address');
  const building = htmlDecode(getTag(addressXml, 'building_name').trim());
  const addr1    = htmlDecode(getTag(addressXml, 'address_1').trim());
  const city     = htmlDecode(getTag(addressXml, 'city').trim());
  const state    = htmlDecode(getTag(addressXml, 'state').trim());

  const contactXml = getTag(xml, 'contact');
  const contactName  = htmlDecode(getTag(contactXml, 'name').trim());
  const contactEmail = getTag(contactXml, 'email').trim();

  const groupXml = getTag(xml, 'group');
  const groupName = htmlDecode(getTag(groupXml, 'name').trim());
  const groupUrl  = getTag(groupXml, 'url').trim();
  const groupId   = parseInt(getTag(groupXml, 'id'), 10) || null;

  const image    = getTag(xml, 'image_med').trim() || getTag(xml, 'image_sm').trim();
  const ppurl    = getTag(xml, 'ppurl').trim();
  const external = getTag(xml, 'externalurl').trim();
  const register = getTag(xml, 'registration_link').trim();
  const webcast  = getTag(xml, 'webcast_link').trim();
  const cost     = htmlDecode(getTag(xml, 'cost').trim());

  const catId = parseInt(getTag(xml, 'event_category_id'), 10) || null;
  const catName = htmlDecode(getTag(xml, 'category-name').trim());

  const audiences = getAll(xml, 'audience').map(a => htmlDecode(a.trim())).filter(Boolean);

  const descRaw = getCdata(xml, 'description_html') || getTag(xml, 'description');
  const descFull = htmlDecode(stripTags(descRaw));
  const descText = truncate(descFull, 320);
  const food = detectFreeFood(`${title}\n${descFull}`);

  const isHybrid = getTag(xml, 'is_hybrid').trim() === '1';
  const isAllDay = !getTag(xml, 'time').trim();

  const start = new Date(startSec * 1000);
  const end   = endSec ? new Date(endSec * 1000) : start;
  const buildingLine = [building, addr1].filter(Boolean).join(', ');
  const locationFull = [buildingLine, [city, state].filter(Boolean).join(', ')].filter(Boolean).join(' — ') || location;

  return {
    id: `pp:${ppurl.split('/').pop() || Math.random().toString(36).slice(2)}`,
    source: 'planitpurple',
    title, description: descText,
    startUtc: start.toISOString(), endUtc: end.toISOString(),
    tz, allDay: isAllDay,
    location, locationFull, building, address: addr1, city, state,
    hybrid: isHybrid, webcast, image,
    url: ppurl, externalUrl: external, registrationUrl: register, cost,
    category: catName, categoryId: catId,
    audiences, organizer: groupName, organizerUrl: groupUrl, organizerId: groupId,
    contactName, contactEmail,
    freeFood: food.freeFood,
    foodKeywords: food.foodKeywords,
  };
}

async function fetchPlanItPurple(days = 90) {
  const url = `https://planitpurple.northwestern.edu/xmlfeed?cal=0&days=${days}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'zwolk-northwestern-events/1.0' } });
  if (!res.ok) throw new Error(`PlanItPurple ${res.status}`);
  const xml = await res.text();
  const events = [];
  const re = /<event>([\s\S]*?)<\/event>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const ev = parsePlanItEvent(m[1]);
    if (ev) events.push(ev);
  }
  return events;
}

// ─── NU Sports schedule scraper ────────────────────────────────────────────
const NU_SPORTS = [
  'mens-basketball','womens-basketball','football','mens-soccer','womens-soccer',
  'volleyball','mens-lacrosse','womens-lacrosse','baseball','softball','field-hockey',
  'mens-tennis','womens-tennis','wrestling',
];
const SPORT_LABEL = {
  'mens-basketball':"Men's Basketball",'womens-basketball':"Women's Basketball",
  'football':'Football','mens-soccer':"Men's Soccer",'womens-soccer':"Women's Soccer",
  'volleyball':'Volleyball','mens-lacrosse':"Men's Lacrosse",'womens-lacrosse':"Women's Lacrosse",
  'baseball':'Baseball','softball':'Softball','field-hockey':'Field Hockey',
  'mens-tennis':"Men's Tennis",'womens-tennis':"Women's Tennis",'wrestling':'Wrestling',
};
const MONTH_IDX = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseGameDateTime(dateLabel, timeLabel) {
  const dm = dateLabel.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);
  if (!dm) return null;
  const month = MONTH_IDX[dm[1]];
  const day = parseInt(dm[2], 10);
  let hour = 12, minute = 0;
  if (timeLabel) {
    const tm = timeLabel.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
    if (tm) {
      hour = parseInt(tm[1], 10);
      minute = parseInt(tm[2], 10);
      if (tm[3] === 'PM' && hour !== 12) hour += 12;
      if (tm[3] === 'AM' && hour === 12) hour = 0;
    }
  }
  const now = new Date();
  let year = now.getFullYear();
  const probe = new Date(Date.UTC(year, month, day, hour - 6, minute));
  if (probe.getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 30) year += 1;
  return new Date(Date.UTC(year, month, day, hour + 5, minute));
}

async function fetchSportSchedule(slug) {
  const url = `https://nusports.com/sports/${slug}/schedule`;
  let html;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zwolk-events/1.0)' } });
    if (!res.ok) return [];
    html = await res.text();
  } catch { return []; }
  // Each game is anchored by a div whose class list includes "s-game-card s-game-card--standard".
  const games = [];
  const reAnchor = /<div\s+[^>]*class="[^"]*s-game-card s-game-card--standard[^"]*"/g;
  const anchors = [...html.matchAll(reAnchor)];
  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].index;
    const end = i + 1 < anchors.length ? anchors[i + 1].index : html.length;
    const chunk = html.slice(start, end);
    const text = htmlDecode(stripTags(chunk));
    const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);
    const timeMatch = text.match(/(\d{1,2}:\d{2})\s*(AM|PM|am|pm)/);
    const opponent = (chunk.match(/title="([^"]*?)(?:\s*\(Exhibition\))?"/) || [])[1];
    if (!dateMatch || !opponent) continue;
    games.push({
      dateLabel: dateMatch[0],
      timeLabel: timeMatch ? `${timeMatch[1]} ${timeMatch[2].toUpperCase()}` : '',
      opponent: opponent.replace(/^#\d+\s+/, '').trim(),
      raw: text.slice(0, 200),
    });
  }
  const label = SPORT_LABEL[slug] || slug;
  const out = [];
  for (const g of games) {
    const start = parseGameDateTime(g.dateLabel, g.timeLabel);
    if (!start) continue;
    out.push({
      id: `nusports:${slug}:${start.toISOString().slice(0,10)}:${g.opponent.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)}`,
      source: 'nusports',
      title: `${label} vs ${g.opponent}`,
      description: g.raw,
      startUtc: start.toISOString(),
      endUtc: new Date(start.getTime() + 3*60*60*1000).toISOString(),
      tz: 'CT', allDay: !g.timeLabel,
      location: '', locationFull: '', building: '', address: '', city: '', state: '',
      hybrid: false, webcast: '', image: '',
      url, externalUrl: '', registrationUrl: '', cost: '',
      category: 'Athletics', categoryId: 100,
      audiences: ['Public','Student'],
      organizer: 'Northwestern Athletics', organizerUrl: 'https://nusports.com', organizerId: null,
      contactName: '', contactEmail: '',
      freeFood: false,
      foodKeywords: [],
      sport: label,
    });
  }
  return out;
}

async function fetchAthletics() {
  const batches = [];
  for (let i = 0; i < NU_SPORTS.length; i += 6) batches.push(NU_SPORTS.slice(i, i + 6));
  const all = [];
  for (const batch of batches) {
    const results = await Promise.allSettled(batch.map(fetchSportSchedule));
    for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  }
  const seen = new Set();
  return all.filter(e => seen.has(e.id) ? false : (seen.add(e.id), true));
}

// ─── Refresh + load ─────────────────────────────────────────────────────────
async function doFullRefresh() {
  const startedAt = Date.now();
  const errors = [];
  let planit = [], athletics = [];
  try { planit = await fetchPlanItPurple(90); } catch (e) { errors.push(`planitpurple: ${e.message || e}`); }
  try { athletics = await fetchAthletics(); } catch (e) { errors.push(`athletics: ${e.message || e}`); }
  const merged = [...planit, ...athletics].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const seen = new Set();
  const deduped = merged.filter(ev => seen.has(ev.id) ? false : (seen.add(ev.id), true));
  const meta = {
    refreshedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    counts: { total: deduped.length, planitpurple: planit.length, athletics: athletics.length },
    errors,
  };
  try {
    await kvSetJson(EVENTS_KEY, deduped);
    await kvSetJson(META_KEY, meta);
  } catch (e) { errors.push(`kv-write: ${e.message || e}`); }
  return { events: deduped, meta };
}

async function loadEvents() {
  let events = null, meta = null;
  try {
    events = await kvGetJson(EVENTS_KEY);
    meta   = await kvGetJson(META_KEY);
  } catch (_) {}
  if (events && Array.isArray(events) && events.length) return { events, meta, source: 'kv' };
  // Cold-path live fetch — PlanItPurple only (athletics scraping too slow for sync GET)
  const planit = await fetchPlanItPurple(90).catch(() => []);
  const all = planit.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  try {
    await kvSetJson(EVENTS_KEY, all);
    await kvSetJson(META_KEY, {
      refreshedAt: new Date().toISOString(),
      durationMs: 0,
      counts: { total: all.length, planitpurple: planit.length, athletics: 0 },
      errors: [], coldStart: true,
    });
  } catch (_) {}
  return { events: all, meta: { refreshedAt: new Date().toISOString() }, source: 'live' };
}

function applyFilters(events, q) {
  const { start, end, category, audience, location, source, search, freeFood } = q;
  let out = events;
  if (freeFood === '1' || freeFood === 'true') out = out.filter(e => !!e.freeFood);
  if (start) out = out.filter(e => e.endUtc >= start);
  if (end)   out = out.filter(e => e.startUtc <= end);
  if (category) {
    const cats = String(category).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    out = out.filter(e => cats.includes((e.category || '').toLowerCase()));
  }
  if (audience) {
    const auds = String(audience).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    out = out.filter(e => (e.audiences || []).some(a => auds.includes(a.toLowerCase())));
  }
  if (location) {
    const locs = String(location).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    out = out.filter(e => locs.includes((e.location || '').toLowerCase()));
  }
  if (source) out = out.filter(e => e.source === source);
  if (search) {
    const needle = String(search).toLowerCase();
    out = out.filter(e =>
      (e.title || '').toLowerCase().includes(needle) ||
      (e.description || '').toLowerCase().includes(needle) ||
      (e.organizer || '').toLowerCase().includes(needle) ||
      (e.category || '').toLowerCase().includes(needle)
    );
  }
  return out;
}

function distinctCounts(events, accessor, opts = {}) {
  const map = new Map();
  for (const e of events) {
    const v = accessor(e); if (!v) continue;
    const parts = opts.split ? String(v).split(opts.split).filter(Boolean) : [v];
    for (const p of parts) {
      const k = String(p).trim(); if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

function isAuthorizedToRefresh(req) {
  if (req.headers.get('x-vercel-cron')) return true;
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  if (process.env.NU_EVENTS_ALLOW_OPEN_REFRESH === '1') return true;
  return false;
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...(init.headers || {}),
    },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams.entries());
  const wantsRefresh = req.method === 'POST' || q.refresh === '1' || q.action === 'refresh';

  if (wantsRefresh && isAuthorizedToRefresh(req)) {
    try {
      const { events, meta } = await doFullRefresh();
      return jsonResponse({ ok: true, refreshed: true, total: events.length, meta }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (e) {
      return jsonResponse({ error: String(e.message || e) }, { status: 500 });
    }
  }
  if (wantsRefresh && req.method === 'POST') {
    return jsonResponse({ error: 'Refresh requires CRON_SECRET or x-vercel-cron' }, { status: 401 });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, {
      status: 405,
      headers: { Allow: 'GET, POST, OPTIONS' },
    });
  }

  try {
    const { events, meta, source } = await loadEvents();
    const filtered = applyFilters(events, q);
    const facets = {
      categories: distinctCounts(events, e => e.category),
      audiences:  distinctCounts(events, e => (e.audiences || []).join('|'), { split: '|' }),
      locations:  distinctCounts(events, e => e.location),
      organizers: distinctCounts(events, e => e.organizer).slice(0, 50),
      sources:    distinctCounts(events, e => e.source),
      freeFoodCount: events.filter(e => e.freeFood).length,
    };
    return jsonResponse({
      events: filtered,
      total: filtered.length,
      grandTotal: events.length,
      meta: meta || { refreshedAt: null },
      source,
      facets,
    }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch (e) {
    return jsonResponse({ error: String(e.message || e) }, { status: 500 });
  }
}
