// FIFA official live-data client (api.fifa.com) — the rich, live, OFFICIAL spine
// for the /wc/live page. Verified against the real match-centre traffic on
// 2026-06-22 (NZ v Egypt, match 40):
//
//   • CORS is OPEN on api.fifa.com, so every call here runs client-side with a
//     plain fetch — no proxy, no API key, no daily cap. (wc2026api still needs
//     its proxy; FIFA does not.)
//   • Matches join to the rest of the app by MatchNumber (FIFA "MatchNumber" ==
//     wc2026api / matches.json "match_number"). FIFA's own id is "IdMatch".
//   • Country ids are FIFA 3-letter codes (NZL, EGY) and line up with teams-48
//     `fifa_code`, so flags/colors/enrichment join with no alias table.
//
// Endpoints used (all GET, all ?language=en):
//   live      api.fifa.com/api/v3/live/football/{IdMatch}
//   timeline  api.fifa.com/api/v3/timelines/{IdMatch}
//   calendar  api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=…
//   standing  api.fifa.com/api/v3/calendar/17/285023/{IdStage}/standing?count=200
//   teamform  api.fifa.com/api/v3/teamform/{IdTeam}?idCompetition=17&count=5&to=…
//
// The /wc/live page never hardcodes a match id: it asks findLiveMatch() to scan
// the FIFA calendar for whatever is in-play right now (MatchStatus LIVE), and
// falls back to a match number when one is supplied (e.g. /wc/live?m=40).

const API = 'https://api.fifa.com/api/v3';
export const FIFA_COMPETITION = '17';      // FIFA World Cup
export const FIFA_SEASON = '285023';       // 2026 edition (verified live)
const LANG = 'en';

// ─── status / period decoding ────────────────────────────────────────────────
// MatchStatus: 0 finished (Played) · 1 not-started · 3 live · 4 pre/lineups ·
// 12 abandoned. Verified live==3 against NZ–Egypt; the rest follow FIFA's codes
// and are treated defensively (we also look at Period + MatchTime).
const FIFA_STATUS = { 0: 'finished', 1: 'scheduled', 3: 'live', 4: 'scheduled', 12: 'finished' };
// Period: 0 none · 3 1st half · 4 half-time · 5 2nd half · 7 ET1 · 9 ET2 ·
// 11 penalties · 10/12 finished. Mapped onto the app's phase vocabulary so the
// existing clock/labels keep working.
const FIFA_PERIOD_PHASE = { 3: '1H', 4: 'HT', 5: '2H', 7: 'ET1', 9: 'ET2', 11: 'PEN' };

export function statusFromCode(code) { return FIFA_STATUS[code] ?? 'scheduled'; }

// Map a live payload to the app's {status, phase} pair. Penalty + ET aware.
export function phaseFromLive(m) {
  const status = statusFromCode(m.MatchStatus);
  if (status === 'live') return { status, phase: FIFA_PERIOD_PHASE[m.Period] || '2H' };
  if (status === 'finished') {
    const pen = (m.HomeTeamPenaltyScore != null && m.AwayTeamPenaltyScore != null);
    return { status, phase: pen ? 'FT_PEN' : 'FT' };
  }
  return { status, phase: 'PRE' };
}

// ─── low-level fetch (client-side; FIFA sends permissive CORS) ────────────────
async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`FIFA ${res.status} on ${url}`);
  return res.json();
}

export const getLive = (idMatch) =>
  getJson(`${API}/live/football/${encodeURIComponent(idMatch)}?language=${LANG}`);
export const getTimeline = (idMatch) =>
  getJson(`${API}/timelines/${encodeURIComponent(idMatch)}?language=${LANG}`).catch(() => null);
export const getStandings = (idStage) =>
  getJson(`${API}/calendar/${FIFA_COMPETITION}/${FIFA_SEASON}/${idStage}/standing?language=${LANG}&count=200`).catch(() => null);
export const getTeamForm = (idTeam) =>
  getJson(`${API}/teamform/${idTeam}?idCompetition=${FIFA_COMPETITION}&count=5&language=${LANG}`).catch(() => null);

// Calendar (paged). count high enough to grab a day's slate in one call.
export async function getCalendar({ count = 60, idStage } = {}) {
  let url = `${API}/calendar/matches?idCompetition=${FIFA_COMPETITION}&idSeason=${FIFA_SEASON}&count=${count}&language=${LANG}`;
  if (idStage) url += `&idStage=${idStage}`;
  const data = await getJson(url);
  return Array.isArray(data) ? data : (data.Results || []);
}

// Find the single in-play match (the app guarantees ≤1 live at a time). Returns
// the calendar row {IdMatch, IdStage, MatchNumber, …} or null. If matchNumber is
// given, resolve that specific match regardless of status (used for deep links
// and to keep showing a match through FT).
export async function findLiveMatch(matchNumber = null) {
  const rows = await getCalendar({ count: 120 });
  const live = rows.find((r) => statusFromCode(r.MatchStatus) === 'live');
  if (matchNumber != null) {
    const exact = rows.find((r) => Number(r.MatchNumber) === Number(matchNumber));
    return exact || live || null;
  }
  return live || null;
}

// ─── normalizers → app-friendly shapes ───────────────────────────────────────
const desc = (arr) => (Array.isArray(arr) && arr[0] && arr[0].Description) || null;

export function playerPhoto(p) {
  const u = p && p.PlayerPicture && p.PlayerPicture.PictureUrl;
  return u || null; // official FIFA headshot (digitalhub.fifa.com/...)
}

export function normalizePlayer(p) {
  return {
    id: p.IdPlayer,
    name: desc(p.PlayerName) || desc(p.ShortName) || '',
    short: desc(p.ShortName) || desc(p.PlayerName) || '',
    number: p.ShirtNumber,
    position: p.Position,          // 0 GK · 1 DEF · 2 MID · 3 FWD (FIFA enum)
    captain: !!p.Captain,
    onField: p.FieldStatus === 0,  // 0 = on the pitch at this moment
    photo: playerPhoto(p),
    x: p.LineupX, y: p.LineupY,     // formation coords when FIFA supplies them
    status: p.Status,
  };
}

function normalizeTeam(t) {
  const players = Array.isArray(t.Players) ? t.Players.map(normalizePlayer) : [];
  return {
    id: t.IdTeam,
    code: t.IdCountry || t.Abbreviation,    // FIFA 3-letter; joins to teams-48
    name: desc(t.TeamName) || t.Abbreviation,
    abbr: t.Abbreviation,
    score: t.Score ?? 0,
    penScore: t.IdCountry ? undefined : undefined,
    tactics: t.Tactics || null,             // "4-4-2"
    players,
  };
}

export function normalizeLive(m) {
  const { status, phase } = phaseFromLive(m);
  return {
    source: 'fifa',
    idMatch: m.IdMatch,
    idStage: m.IdStage,
    matchNumber: m.MatchNumber,
    competitionName: desc(m.CompetitionName),
    groupName: desc(m.GroupName) || (typeof m.GroupName === 'string' ? m.GroupName : null),
    stageName: desc(m.StageName) || null,
    status, phase,
    minute: m.MatchTime || null,            // "69'"
    home: normalizeTeam(m.HomeTeam),
    away: normalizeTeam(m.AwayTeam),
    homePen: m.HomeTeamPenaltyScore,
    awayPen: m.AwayTeamPenaltyScore,
    possession: { home: numOrNull(m.BallPossession && m.BallPossession.OverallHome),
                  away: numOrNull(m.BallPossession && m.BallPossession.OverallAway) },
    territory: m.TerritorialPossesion || null,
    stadium: desc(m.Stadium && m.Stadium.Name) || (m.Stadium && m.Stadium.Name) || null,
    city: desc(m.Stadium && m.Stadium.CityName) || null,
    attendance: m.Attendance ? Number(m.Attendance) : null,
    weather: m.Weather || null,
    officials: Array.isArray(m.Officials) ? m.Officials.map((o) => ({
      name: desc(o.Name) || desc(o.NameShort), role: desc(o.TypeLocalized), country: o.IdCountry,
    })) : [],
    date: m.Date,
  };
}

// Verified FIFA event Type codes (2026 WC live feed):
//   0 Goal · 1 Assist · 2 Yellow card · 5 Substitution · 12 Attempt at Goal (shot)
//   15 Offside · 16 Corner · 18 Foul · 57 Goal Prevention (save) · 7/8 Start/End
//   78 Resume · 79 Coin Toss · 83 Delay.
// IMPORTANT: classify by CODE, not a "contains 'goal'" label match — otherwise
// "Attempt at Goal" and "Goal Prevention" get miscounted as goals.
// Red card / own goal / penalty codes don't appear in every match, so those are
// refined from the localized label as a fallback.
const EVENT_TYPE = { 0: 'goal', 1: 'assist', 2: 'yellow', 5: 'sub', 12: 'shot', 15: 'offside', 16: 'corner', 18: 'foul', 57: 'save' };
function classifyEvent(ev) {
  const label = desc(ev.TypeLocalized) || '';
  const L = label.toLowerCase();
  let kind = EVENT_TYPE[ev.Type];
  if (kind === 'goal') {
    if (L.includes('own')) kind = 'own_goal';
    else if (L.includes('penalt')) kind = 'penalty';
  }
  if (!kind) {
    if (L.includes('own goal')) kind = 'own_goal';
    else if (L === 'goal!' || L === 'goal' || L.includes('penalty goal')) kind = 'goal';
    else if (L.includes('second yellow') || L.includes('red card') || L === 'red') kind = 'red';
    else if (L.includes('yellow')) kind = 'yellow';
    else if (L.includes('substitut')) kind = 'sub';
    else kind = 'other';
  }
  return { kind, label: label || kind };
}

// Flatten the timeline into newest-first UI events. Keeps pitch coordinates
// (PositionX/Y in 0..100) and goal-mouth placement when present.
export function normalizeTimeline(tl) {
  const evs = (tl && (tl.Event || tl.Events)) || [];
  if (!Array.isArray(evs)) return [];
  return evs.map((ev) => {
    const c = classifyEvent(ev);
    const min = ev.MatchMinute ? String(ev.MatchMinute).replace(/'+$/, '') : null;
    return {
      id: ev.EventId,
      kind: c.kind, label: c.label,
      teamId: ev.IdTeam,
      player: desc(ev.PlayerName) || null,
      playerId: ev.IdPlayer || null,
      subPlayerId: ev.IdSubPlayer || null,
      minute: min,
      minuteLabel: ev.MatchMinute || (min ? `${min}'` : ''),
      period: ev.Period,
      homeGoals: ev.HomeGoals, awayGoals: ev.AwayGoals,
      x: numOrNull(ev.PositionX), y: numOrNull(ev.PositionY),
      goalX: numOrNull(ev.GoalGatePositionX), goalY: numOrNull(ev.GoalGatePositionY),
      raw: ev.Type,
    };
  }).sort((a, b) => seq(b) - seq(a));
}
const seq = (e) => (Number(e.minute) || 0) * 100 + (e.kind === 'goal' ? 1 : 0);

// FIFA formation coords come 0..100; convert a tactics string into row counts so
// we can lay out a pitch even when LineupX/Y are absent.
export function parseFormation(tactics) {
  if (!tactics) return null;
  const rows = String(tactics).split('-').map((n) => parseInt(n, 10)).filter((n) => n > 0);
  return rows.length ? rows : null;
}

export function flagUrl(country, size = '4') {
  if (!country) return null;
  // FIFA's own flag service; {format}/{size} templated. Falls back handled by caller.
  return `${API}/picture/flags-sq-${size}/${country}`;
}

function numOrNull(v) { const n = Number(v); return v == null || isNaN(n) ? null : n; }

export default {
  getLive, getTimeline, getStandings, getTeamForm, getCalendar, findLiveMatch,
  normalizeLive, normalizeTimeline, normalizePlayer, parseFormation,
  playerPhoto, flagUrl, statusFromCode, phaseFromLive,
  FIFA_COMPETITION, FIFA_SEASON,
};
