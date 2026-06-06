// Northwestern Events Hub — single Edge Function.
// GET            → return cached events from Vercel KV (or live-fetch on cold start)
// GET ?refresh=1 → re-fetch from sources and rewrite KV (auth required: x-vercel-cron or CRON_SECRET)
// POST           → same as ?refresh=1
//
// Runs on the Edge runtime so it doesn't count against the Hobby 12-Serverless cap.

export const config = { runtime: 'edge' };

// Versioned key — bump when the event schema (e.g. food detector) changes so
// existing caches don't serve stale records.
const SCHEMA_VERSION = 'v4';
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

// ─── Galter Health Sciences Library (LibCal RSS) ────────────────────────────
async function fetchGalter() {
  const url = 'https://galter-northwestern.libcal.com/rss.php?m=month&cid=21209';
  let xml;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'zwolk-events/1.0' } });
    if (!res.ok) return [];
    xml = await res.text();
  } catch { return []; }
  const items = getAll(xml, 'item');
  const out = [];
  for (const it of items) {
    const title = htmlDecode(stripTags(getTag(it, 'title')).trim());
    if (!title) continue;
    const link  = (getTag(it, 'link') || getTag(it, 'guid') || '').trim();
    const date  = getTag(it, 'libcal:date').trim();
    const start = getTag(it, 'libcal:start').trim() || '00:00:00';
    const end   = getTag(it, 'libcal:end').trim() || start;
    const location = htmlDecode(getTag(it, 'libcal:location').trim());
    if (!date) continue;
    // Build ISO; libcal times are local Central — approximate offset (+5 ≈ CDT, +6 ≈ CST).
    const startDt = new Date(`${date}T${start}-05:00`);
    const endDt   = new Date(`${date}T${end}-05:00`);
    if (isNaN(+startDt)) continue;
    const descRaw = getTag(it, 'libcal:description') || getTag(it, 'description');
    const descText = truncate(htmlDecode(stripTags(descRaw)), 320);
    const food = detectFreeFood(`${title}\n${descText}`);
    out.push({
      id: `galter:${(getTag(it,'libcal:eventid') || link).trim() || title}`,
      source: 'galter',
      title,
      description: descText,
      startUtc: startDt.toISOString(),
      endUtc:   endDt.toISOString(),
      tz: 'CT', allDay: false,
      location: location || 'Galter Library',
      locationFull: location || 'Galter Library',
      building: '', address: '', city: 'Chicago', state: 'IL',
      hybrid: /online/i.test(location), webcast: '', image: '',
      url: link, externalUrl: '', registrationUrl: link, cost: '',
      category: 'Library / Workshop', categoryId: 200,
      audiences: ['Public', 'Student', 'Faculty/Staff'],
      organizer: 'Galter Health Sciences Library',
      organizerUrl: 'https://galter.northwestern.edu',
      organizerId: null,
      contactName: '', contactEmail: '',
      freeFood: food.freeFood, foodKeywords: food.foodKeywords,
    });
  }
  return out;
}

// ─── McCormick CS Colloquium (HTML scrape) ──────────────────────────────────
async function fetchCSColloquium() {
  const url = 'https://www.mccormick.northwestern.edu/computer-science/news-events/seminars-workshops-talks/cs-colloquium-series.html';
  let html;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'zwolk-events/1.0' } });
    if (!res.ok) return [];
    html = await res.text();
  } catch { return []; }
  // Look only at the active "2025-26 Speakers" section so we don't ingest past years.
  const yearMarker = html.indexOf('id="speakers-2025-26"');
  if (yearMarker < 0) return [];
  const sectionEnd = html.indexOf('id="speakers-2024-25"', yearMarker);
  const section = html.slice(yearMarker, sectionEnd > 0 ? sectionEnd : yearMarker + 80000);
  const out = [];
  const re = /<h4>([^<]+)<\/h4>\s*<p>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(section)) !== null) {
    const speaker = htmlDecode(m[1].trim());
    const body = m[2];
    const text = htmlDecode(stripTags(body));
    // Look for date in formats like "May 26, 2026" or "Sept. 5, 2025"
    const dateMatch = text.match(/(Jan(?:uary|\.)?|Feb(?:ruary|\.)?|Mar(?:ch|\.)?|Apr(?:il|\.)?|May|Jun(?:e|\.)?|Jul(?:y|\.)?|Aug(?:ust|\.)?|Sep(?:t(?:ember|\.)?)?|Sept|Oct(?:ober|\.)?|Nov(?:ember|\.)?|Dec(?:ember|\.)?)\s+\d{1,2}\s*,?\s+\d{4}/i);
    if (!dateMatch) continue;
    const when = new Date(dateMatch[0] + ' 16:00 CDT');
    if (isNaN(+when)) continue;
    const titleQuote = (body.match(/"([^"]{8,180})"/) || [])[1] || '';
    const affiliation = (text.split(/[\n\r]/)[0] || '').trim().slice(0, 100);
    const cleanTitle = titleQuote ? `${speaker} — "${htmlDecode(titleQuote)}"` : `CS Colloquium: ${speaker}`;
    const desc = `${affiliation}${titleQuote ? `. "${htmlDecode(titleQuote)}"` : ''}`.trim();
    const food = detectFreeFood(`${cleanTitle}\n${desc}`);
    out.push({
      id: `cs-colloq:${dateMatch[0].replace(/\s+/g,'-')}:${speaker.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,32)}`,
      source: 'mccormick-cs',
      title: cleanTitle,
      description: truncate(desc, 320),
      startUtc: when.toISOString(),
      endUtc: new Date(when.getTime() + 60 * 60 * 1000).toISOString(),
      tz: 'CT', allDay: false,
      location: 'Mudd Hall', locationFull: 'Mudd Hall, Evanston',
      building: 'Mudd Hall', address: '', city: 'Evanston', state: 'IL',
      hybrid: false, webcast: '', image: '',
      url, externalUrl: '', registrationUrl: '', cost: '',
      category: 'Lecture/Conference', categoryId: 201,
      audiences: ['Faculty/Staff','Student','Public','Graduate Students'],
      organizer: 'Computer Science Department',
      organizerUrl: 'https://www.mccormick.northwestern.edu/computer-science/',
      organizerId: null,
      contactName: '', contactEmail: '',
      freeFood: food.freeFood, foodKeywords: food.foodKeywords,
    });
  }
  return out;
}

// ─── NICO Wednesdays (HTML scrape) ──────────────────────────────────────────
async function fetchNICO() {
  // Try current academic year first; pages roll over.
  const year = new Date().getFullYear();
  const candidates = [
    `https://nico.northwestern.edu/news-events/wednesdays-at-nico/speakers-${year}.html`,
    `https://nico.northwestern.edu/news-events/wednesdays-at-nico/speakers-${year - 1}.html`,
  ];
  let html = '';
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'zwolk-events/1.0' } });
      if (res.ok) { html = await res.text(); break; }
    } catch {}
  }
  if (!html) return [];
  const out = [];
  // NICO inlines dates as "<br/>Month Day, Year, Time Central<br/>"
  const re = /<br\s*\/?>\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(202[4-9]),?\s+(\d{1,2}):(\d{2})\s*([ap]m)/gi;
  // Each match represents one talk; the preceding ~500 chars contain title/speaker
  let m;
  const seen = new Set();
  while ((m = re.exec(html)) !== null) {
    const month = m[1];
    const day = parseInt(m[2], 10);
    const yr  = parseInt(m[3], 10);
    let hour = parseInt(m[4], 10);
    const min = parseInt(m[5], 10);
    const ampm = m[6].toLowerCase();
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    const monthIdx = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(month.toLowerCase());
    // Central time → UTC, approximating CDT (+5)
    const when = new Date(Date.UTC(yr, monthIdx, day, hour + 5, min));
    if (isNaN(+when)) continue;

    // Look backward up to 700 chars for the preceding <p> block to extract speaker/title
    const start = Math.max(0, m.index - 700);
    const lookback = html.slice(start, m.index);
    const pMatch = lookback.match(/<p[^>]*>([\s\S]*)$/);
    const body = pMatch ? pMatch[1] : lookback;
    const text = htmlDecode(stripTags(body));
    const headLine = text.split(/<br|[\n.]/)[0].trim().slice(0, 90) || 'Speaker TBA';

    const dayKey = `${yr}-${String(monthIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const id = `nico:${dayKey}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const title = `Wednesdays at NICO: ${headLine}`;
    const desc = truncate(text, 320);
    const food = detectFreeFood(`${title}\n${desc}`);
    // Try to find a matching event detail link in the immediately-following block
    const fwd = html.slice(m.index, m.index + 600);
    const eidMatch = fwd.match(/events\/index\.php\?eid=(\d+)/);
    const url = eidMatch
      ? `https://nico.northwestern.edu/news-events/events/index.php?eid=${eidMatch[1]}`
      : `https://nico.northwestern.edu/news-events/wednesdays-at-nico/speakers-${yr}.html`;

    out.push({
      id,
      source: 'nico',
      title,
      description: desc,
      startUtc: when.toISOString(),
      endUtc:   new Date(when.getTime() + 60 * 60 * 1000).toISOString(),
      tz: 'CT', allDay: false,
      location: 'Chambers Hall', locationFull: 'Chambers Hall, Evanston',
      building: 'Chambers Hall', address: '600 Foster St', city: 'Evanston', state: 'IL',
      hybrid: false, webcast: '', image: '',
      url, externalUrl: '', registrationUrl: '', cost: '',
      category: 'Lecture/Conference', categoryId: 202,
      audiences: ['Faculty/Staff','Student','Public','Graduate Students'],
      organizer: 'Northwestern Institute on Complex Systems (NICO)',
      organizerUrl: 'https://nico.northwestern.edu',
      organizerId: null,
      contactName: '', contactEmail: '',
      freeFood: food.freeFood, foodKeywords: food.foodKeywords,
    });
  }
  return out;
}

// ─── Bienen School of Music (HTML scrape, slug-based) ───────────────────────
async function fetchBienen() {
  const listUrl = 'https://music.northwestern.edu/events';
  let html;
  try {
    const res = await fetch(listUrl, { headers: { 'User-Agent': 'zwolk-events/1.0' } });
    if (!res.ok) return [];
    html = await res.text();
  } catch { return []; }
  // Extract real event slugs (filter out nav links)
  const skipSlugs = new Set(['calendar','category','subscriptions','ticket-office']);
  const slugMatches = [...html.matchAll(/href="\/events\/([a-zA-Z0-9-]{5,80})"/g)];
  const slugs = [...new Set(slugMatches.map(m => m[1]))]
    .filter(s => !skipSlugs.has(s) && !s.startsWith('category'));
  if (!slugs.length) return [];
  const detailFetch = async (slug) => {
    try {
      const res = await fetch(`https://music.northwestern.edu/events/${slug}`, { headers: { 'User-Agent': 'zwolk-events/1.0' } });
      if (!res.ok) return null;
      const page = await res.text();
      const title = htmlDecode((page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1] || '').replace(/<[^>]+>/g, ' ').trim();
      if (!title) return null;

      let startUtc = null;
      // Drupal Bienen pages expose: data-date="Saturday, June 6, 2026 at 2:30pm CDT"
      const dataDateMatch = page.match(/data-date="([^"]+)"/);
      if (dataDateMatch) {
        const raw = htmlDecode(dataDateMatch[1]);
        // Normalize "at 2:30pm CDT" → "2:30 pm CDT" so Date() can parse
        const normalized = raw
          .replace(/\s+at\s+/i, ' ')
          .replace(/(\d)(am|pm)\b/i, '$1 $2')
          .replace(/\s+(CDT|CST|EDT|EST|PDT|PST)\s*$/i, ' $1');
        const d = new Date(normalized);
        if (!isNaN(+d)) startUtc = d.toISOString();
      }
      if (!startUtc) {
        const isoMatch = page.match(/datetime="([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}[^"]*)"/);
        if (isoMatch) {
          const d = new Date(isoMatch[1]);
          if (!isNaN(+d)) startUtc = d.toISOString();
        }
      }
      if (!startUtc) {
        // Fallback: parse text body
        const text = htmlDecode(stripTags(page));
        const dm = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+202[5-7]/i);
        const tm = text.match(/(\d{1,2}:\d{2})\s*(?:a\.?m\.?|p\.?m\.?|AM|PM)/i);
        if (dm) {
          const guess = new Date(`${dm[0]} ${tm ? tm[0] : '7:30 PM'} CDT`);
          if (!isNaN(+guess)) startUtc = guess.toISOString();
        }
      }
      if (!startUtc) return null;

      // Extract a location line near the date (Drupal renders <p class="location">…</p>)
      const locMatch = page.match(/class="location[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const locationFull = locMatch ? htmlDecode(stripTags(locMatch[1])).trim().slice(0, 200) : 'Pick-Staiger Concert Hall, Evanston';
      // Build a short description from meta or first <p>
      const metaDesc = (page.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/) || [, ''])[1];
      const descText = truncate(htmlDecode(metaDesc || stripTags((page.match(/<p>([\s\S]*?)<\/p>/) || [, ''])[1] || '')), 320);
      const food = detectFreeFood(`${title}\n${descText}`);
      return {
        id: `bienen:${slug}`,
        source: 'bienen',
        title,
        description: descText,
        startUtc,
        endUtc: new Date(new Date(startUtc).getTime() + 90 * 60 * 1000).toISOString(),
        tz: 'CT', allDay: false,
        location: 'Bienen School of Music',
        locationFull,
        building: '', address: '', city: 'Evanston', state: 'IL',
        hybrid: false, webcast: '', image: '',
        url: `https://music.northwestern.edu/events/${slug}`,
        externalUrl: '', registrationUrl: '', cost: '',
        category: 'Music', categoryId: 203,
        audiences: ['Public','Student','Faculty/Staff'],
        organizer: 'Bienen School of Music',
        organizerUrl: 'https://music.northwestern.edu',
        organizerId: null,
        contactName: '', contactEmail: '',
        freeFood: food.freeFood, foodKeywords: food.foodKeywords,
      };
    } catch { return null; }
  };
  // Limit to the first 16 slugs to keep latency reasonable
  const sliced = slugs.slice(0, 16);
  const results = await Promise.allSettled(sliced.map(detailFetch));
  return results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
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
  const counts = { planitpurple: 0, athletics: 0, galter: 0, mccormickCs: 0, nico: 0, bienen: 0 };

  const settled = await Promise.allSettled([
    fetchPlanItPurple(90),
    fetchAthletics(),
    fetchGalter(),
    fetchCSColloquium(),
    fetchNICO(),
    fetchBienen(),
  ]);
  const keys = ['planitpurple', 'athletics', 'galter', 'mccormickCs', 'nico', 'bienen'];
  const all = [];
  settled.forEach((r, i) => {
    const k = keys[i];
    if (r.status === 'fulfilled') {
      counts[k] = r.value.length;
      all.push(...r.value);
    } else {
      errors.push(`${k}: ${r.reason && r.reason.message || r.reason}`);
    }
  });

  const merged = all.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const seen = new Set();
  const deduped = merged.filter(ev => seen.has(ev.id) ? false : (seen.add(ev.id), true));
  const meta = {
    refreshedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    counts: { total: deduped.length, ...counts },
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
  // Cold path — fetch every source. doFullRefresh writes to KV so subsequent
  // requests serve from cache without re-fetching.
  const { events: fresh, meta: freshMeta } = await doFullRefresh();
  return { events: fresh, meta: { ...freshMeta, coldStart: true }, source: 'live' };
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
