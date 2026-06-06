// Shared helpers for the Northwestern events hub.
const { kvGetJson, kvSetJson, kvReady, kvWriteReady } = require('../_kv');

const EVENTS_KEY = 'nu:events:all';
const META_KEY   = 'nu:events:meta';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function htmlDecode(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

// Tiny XML scanner — extracts the first occurrence of <tag>...</tag> or all occurrences.
function getTag(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function getAll(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function getCdata(xml, tag) {
  const re = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function parsePlanItEvent(xml) {
  const title = htmlDecode(getTag(xml, 'title').trim());
  if (!title) return null;
  const isoText = getTag(xml, 'isodate').trim();
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
  const descText = truncate(htmlDecode(stripTags(descRaw)), 700);

  const isHybrid = getTag(xml, 'is_hybrid').trim() === '1';
  const isAllDay = !getTag(xml, 'time').trim();

  const start = new Date(startSec * 1000);
  const end   = endSec ? new Date(endSec * 1000) : start;

  const buildingLine = [building, addr1].filter(Boolean).join(', ');
  const locationFull = [buildingLine, [city, state].filter(Boolean).join(', ')].filter(Boolean).join(' — ') || location;

  return {
    id: `pp:${ppurl.split('/').pop() || Math.random().toString(36).slice(2)}`,
    source: 'planitpurple',
    title,
    description: descText,
    startUtc: start.toISOString(),
    endUtc:   end.toISOString(),
    tz,
    allDay: isAllDay,
    location,
    locationFull,
    building,
    address: addr1,
    city,
    state,
    hybrid: isHybrid,
    webcast,
    image,
    url: ppurl,
    externalUrl: external,
    registrationUrl: register,
    cost,
    category: catName,
    categoryId: catId,
    audiences,
    organizer: groupName,
    organizerUrl: groupUrl,
    organizerId: groupId,
    contactName,
    contactEmail,
  };
}

async function fetchPlanItPurple(days = 90) {
  const url = `https://planitpurple.northwestern.edu/xmlfeed?cal=0&days=${days}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'zwolk-northwestern-events/1.0' },
  });
  if (!res.ok) throw new Error(`PlanItPurple fetch failed: ${res.status}`);
  const xml = await res.text();
  const events = [];
  const re = /<event>([\s\S]*?)<\/event>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const evt = parsePlanItEvent(m[1]);
    if (evt) events.push(evt);
  }
  return events;
}

// Strip HTML tags from a chunk and collapse whitespace.
function textFrom(html) {
  return htmlDecode(stripTags(html));
}

function extractGameCards(html) {
  // Each game is wrapped in a div with classes including s-game-card.
  // We scan top-level by matching the opening tag and bracketing to its closing div.
  // Simpler: split by `class="s-game-card` occurrences and parse local text/attrs.
  const games = [];
  const re = /class="s-game-card[\s\S]*?(?=<div class="s-game-card|<footer|<\/main>|<\/body>)/g;
  const matches = html.match(re) || [];
  for (const chunk of matches) {
    const text = textFrom(chunk);
    // Heuristic: dates appear like "Nov 4 (Tue)" or "Sat, Nov 2", times like "7:00 PM"
    const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);
    const timeMatch = text.match(/(\d{1,2}:\d{2})\s*(AM|PM|am|pm)/);
    const opponent = (chunk.match(/title="([^"]*?)(?:\s*\(Exhibition\))?"/) || [])[1];
    if (!dateMatch || !opponent) continue;
    games.push({
      dateLabel: dateMatch[0],
      timeLabel: timeMatch ? `${timeMatch[1]} ${timeMatch[2].toUpperCase()}` : '',
      opponent: opponent.replace(/^#\d+\s+/, '').trim(),
      raw: text.slice(0, 240),
    });
  }
  return games;
}

const NU_SPORTS = [
  'mens-basketball',
  'womens-basketball',
  'football',
  'mens-soccer',
  'womens-soccer',
  'volleyball',
  'mens-lacrosse',
  'womens-lacrosse',
  'baseball',
  'softball',
  'field-hockey',
  'mens-tennis',
  'womens-tennis',
  'mens-golf',
  'womens-golf',
  'mens-swimming-and-diving',
  'womens-swimming-and-diving',
  'wrestling',
  'mens-cross-country',
  'womens-cross-country',
  'mens-fencing',
  'womens-fencing',
];

const SPORT_LABEL = {
  'mens-basketball':  "Men's Basketball",
  'womens-basketball': "Women's Basketball",
  'football': 'Football',
  'mens-soccer': "Men's Soccer",
  'womens-soccer': "Women's Soccer",
  'volleyball': 'Volleyball',
  'mens-lacrosse': "Men's Lacrosse",
  'womens-lacrosse': "Women's Lacrosse",
  'baseball': 'Baseball',
  'softball': 'Softball',
  'field-hockey': 'Field Hockey',
  'mens-tennis': "Men's Tennis",
  'womens-tennis': "Women's Tennis",
  'mens-golf': "Men's Golf",
  'womens-golf': "Women's Golf",
  'mens-swimming-and-diving': "Men's Swimming & Diving",
  'womens-swimming-and-diving': "Women's Swimming & Diving",
  'wrestling': 'Wrestling',
  'mens-cross-country': "Men's Cross Country",
  'womens-cross-country': "Women's Cross Country",
  'mens-fencing': "Men's Fencing",
  'womens-fencing': "Women's Fencing",
};

const MONTH_INDEX = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseGameDateTime(dateLabel, timeLabel, refYear) {
  // dateLabel like "Nov 4", timeLabel like "7:00 PM"
  const dm = dateLabel.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);
  if (!dm) return null;
  const month = MONTH_INDEX[dm[1]];
  const day   = parseInt(dm[2], 10);
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
  // Determine year: schedule pages list games starting in fall; reference year heuristic
  // Use refYear; if month is before current month - 6 months, advance to next year.
  const now = new Date();
  let year = refYear || now.getFullYear();
  const probe = new Date(Date.UTC(year, month, day, hour - 6, minute)); // Central ~ UTC-6 ignoring DST
  // If probe is far in the past (>30 days ago), bump year
  if (probe.getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 30) {
    year += 1;
  }
  // Construct CT-naive then convert: Chicago is UTC-5/6. Use -5 (CDT) as approx; off by 1h for some January games — acceptable for display.
  const startUtc = new Date(Date.UTC(year, month, day, hour + 5, minute));
  return startUtc;
}

async function fetchSportSchedule(slug) {
  const url = `https://nusports.com/sports/${slug}/schedule`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zwolk-events/1.0)' },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const games = extractGameCards(html);
  const out = [];
  const label = SPORT_LABEL[slug] || slug;
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const start = parseGameDateTime(g.dateLabel, g.timeLabel);
    if (!start) continue;
    out.push({
      id: `nusports:${slug}:${start.toISOString().slice(0,10)}:${g.opponent.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)}`,
      source: 'nusports',
      title: `${label} vs ${g.opponent}`,
      description: g.raw,
      startUtc: start.toISOString(),
      endUtc: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      tz: 'CT',
      allDay: !g.timeLabel,
      location: '',
      locationFull: '',
      building: '',
      address: '',
      city: '',
      state: '',
      hybrid: false,
      webcast: '',
      image: '',
      url,
      externalUrl: '',
      registrationUrl: '',
      cost: '',
      category: 'Athletics',
      categoryId: 100,
      audiences: ['Public', 'Student'],
      organizer: 'Northwestern Athletics',
      organizerUrl: 'https://nusports.com',
      organizerId: null,
      contactName: '',
      contactEmail: '',
      sport: label,
    });
  }
  return out;
}

async function fetchAthletics() {
  const all = [];
  // Fetch up to 6 sports in parallel batches to avoid overwhelming nusports
  const batchSize = 6;
  for (let i = 0; i < NU_SPORTS.length; i += batchSize) {
    const slice = NU_SPORTS.slice(i, i + batchSize);
    const results = await Promise.allSettled(slice.map(fetchSportSchedule));
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }
  // dedupe by id
  const seen = new Set();
  return all.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

async function readEvents() {
  if (!kvReady()) return null;
  return await kvGetJson(EVENTS_KEY);
}

async function readMeta() {
  if (!kvReady()) return null;
  return await kvGetJson(META_KEY);
}

async function writeEvents(events, meta) {
  if (!kvWriteReady()) throw new Error('KV write not configured');
  await kvSetJson(EVENTS_KEY, events);
  await kvSetJson(META_KEY, meta);
}

module.exports = {
  EVENTS_KEY,
  META_KEY,
  setCors,
  htmlDecode,
  stripTags,
  truncate,
  fetchPlanItPurple,
  fetchAthletics,
  readEvents,
  readMeta,
  writeEvents,
  NU_SPORTS,
  SPORT_LABEL,
};
