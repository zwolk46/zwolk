// /wc/live — the flagship LIVE match experience.
//
// A first-class app page (adopts the standard nav shell) that fuses three live
// sources, none of which needs a key:
//   • FIFA official (lib/fifa.js)  — score, clock, lineups + pitch coordinates,
//     event timeline (with shot coordinates), officials, weather, attendance.
//   • ESPN (lib/espn.js)           — live TEXT COMMENTARY, box-score stats, team
//     colours, and betting odds (a win-probability prior). CORS-open.
//   • SofaScore (lib/sofa.js)      — BEST-EFFORT overlay for official xG / attack
//     momentum / shotmap, via a same-origin proxy. Degrades silently.
// Plus on-page analytics (lib/analytics.js): a transparent xG model from FIFA
// shot coordinates, an attack-momentum index, an in-play win-probability model,
// and average-match baselines — so the page is rich even with zero overlays.
//
// Behaviour highlights: auto-finds whatever is in play; stays live for 15 minutes
// after full time; a picker + in-view switcher when several matches overlap; a
// freshness ("updated 3s ago") indicator; every player and team is clickable to
// its popup. When nothing is live it becomes a polished countdown to the next
// kickoff with the day's slate.

import { flagSrc, FLAG } from './flags.js';
import { SHELL_CSS, injectShell, revealVisible } from './shell.js';
import { playGoalCelebration, dismissGoalCelebration } from './goal-celebration.js';
import { enablePopupLinks } from './popup.js';
import { icon } from './icons.js';
import * as data from './data.js';
import * as espn from './espn.js';
import * as sofa from './sofa.js';
import * as an from './analytics.js';

// Propagate ?v= cache-buster to fifa.js during local dev (no-op in prod).
const _ver = new URL(import.meta.url).searchParams.get('v');
const fifa = await import('./fifa.js' + (_ver ? '?v=' + encodeURIComponent(_ver) : ''));

const CFG = {
  FIFA_MS: 1_000,         // score/clock/events/lineups — as fast as is useful: FIFA's
                          // feed doesn't refresh sub-second and the clock ticks locally,
                          // so 1s is the floor. Keyless w/ NO daily cap; only polls while
                          // the tab is visible AND the match is in play (frozen→20s).
  FIFA_MS_FROZEN: 20_000, // HT / FT — nothing moves, slow down
  ESPN_MS: 7_000,         // commentary + box score
  SOFA_MS: 20_000,        // xG/momentum overlay (cached at the proxy too)
  CLOCK_MS: 250,          // re-render the running clock 4×/s so seconds roll over
                          // crisply on the true boundary (interpolated from the
                          // last accurate anchor — just a text update, ~free).
  FRESH_MS: 500,          // refresh the "updated …" badge twice a second so it
                          // reads true to the second since the last live pull.
  EMPTY_MS: 30_000,       // re-scan for a kickoff while idle
  POST_FT_LIVE_MS: 15 * 60_000, // keep showing a match for 15 min after FT
};

// ─── colour helpers (team accents, ESPN-derived, luminance-corrected) ──────────
let COLORS = { teams: {}, accentOverrides: {} };
async function loadColors() {
  try { COLORS = await fetch('/wc/data/enrichment/team-colors.json', { cache: 'force-cache' }).then((r) => r.json()); }
  catch { COLORS = { teams: {}, accentOverrides: {} }; }
}
function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function relLum(h) { const [r, g, b] = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function mix(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function accentFor(code) {
  if (!code) return '#f5c712';
  const ov = COLORS.accentOverrides && COLORS.accentOverrides[code];
  if (ov) return '#' + ov;
  const pair = (COLORS.teams && COLORS.teams[code]) || ['F5C712', 'FFFFFF'];
  for (const h of pair) { const L = relLum('#' + h); if (L >= 0.16 && L <= 0.72) return '#' + h; }
  const h = '#' + pair[0]; const L = relLum(h);
  return L > 0.72 ? mix(h, '#0a0e0c', 0.34) : mix(h, '#ffffff', 0.42);
}

// ─── DOM helpers ───────────────────────────────────────────────────────────────
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
  return e;
}
function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
  return e;
}
function flagImg(code, cls) {
  const img = el('img', { class: cls || 'lvx-flag', alt: code || '', loading: 'eager' });
  const local = flagSrc(code);
  img.src = local || fifa.flagUrl(code) || '';
  img.onerror = () => { const f = fifa.flagUrl(code); if (f && img.src !== f) { img.onerror = null; img.src = f; } };
  return img;
}

// Title-case an ALL-CAPS source name ("MESSI"→"Messi", "DE BRUYNE"→"De Bruyne").
const SMALL_PARTICLES = new Set(['de', 'del', 'da', 'di', 'van', 'von', 'der', 'den', 'dos', 'das', 'do', 'la', 'le', 'el', 'bin', 'al', 'y', 'of', 'the']);
function prettyName(s) {
  if (!s) return '';
  // Title-case any ALL-CAPS word (FIFA surnames come uppercased, e.g.
  // "Aissa MANDI" → "Aissa Mandi", "MESSI" → "Messi") while leaving already
  // mixed-case words untouched ("Lionel", "Vinícius", "McTominay").
  return String(s).trim().split(/\s+/).map((w, i) => {
    if (/[a-zà-ÿ]/.test(w)) return w;
    const lw = w.toLowerCase();
    if (i > 0 && SMALL_PARTICLES.has(lw)) return lw;
    return lw.replace(/(^|[-'’.])([a-zà-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase());
  }).join(' ');
}

// Surname only (keeps leading particles: "Kevin De Bruyne" → "De Bruyne",
// "Virgil van Dijk" → "van Dijk", "Rodrygo" → "Rodrygo"). For the pitch labels.
function lastName(full) {
  const name = prettyName(full).trim();
  const parts = name.split(/\s+/);
  if (parts.length <= 1) return name;
  let i = parts.length - 1;
  while (i > 0 && SMALL_PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(' ');
}

// Clickable team chip (flag/code/name) → team popup.
function teamLink(code, cls, ...kids) {
  if (!code) return el('span', { class: cls }, ...kids);
  return el('a', { class: (cls ? cls + ' ' : '') + 'lvx-tlink', href: `/wc/team/${encodeURIComponent(code)}`, 'data-popup-team': code }, ...kids);
}
// Clickable player chip → player popup (looked up by name across squads).
function playerLink(name, cls) {
  const disp = prettyName(name);
  if (!name) return el('span', { class: cls || '' }, disp || '');
  return el('a', { class: (cls ? cls + ' ' : '') + 'lvx-plink', href: `/wc/player/${encodeURIComponent('name:' + name)}`, 'data-popup-player': 'name:' + name }, disp);
}

// ─── live backdrop: solid team-colour diagonal split + faint edge names ────────
// Darken a team accent into a deep background tone that white text reads cleanly
// over. Brighter accents (e.g. yellows) are darkened more so both halves stay
// legible while still carrying the team's hue.
function deepTeamBg(hex) {
  const L = relLum(hex);
  const t = 0.56 + 0.2 * Math.min(1, L / 0.55);
  return mix(hex, '#070a08', Math.min(0.8, t));
}
// Lighten a team accent into a pastel background suitable for light mode.
// Brighter colours (yellows, reds with higher L) get slightly less white so they
// stay visibly tinted rather than bleaching to near-white; dark hues need more
// white to lift them up. Result is always a clearly team-identified pastel.
function lightTeamBg(hex) {
  const L = relLum(hex);
  // Range: 0.84 (bright yellows) – 0.92 (near-black navies)
  const t = 0.84 + 0.08 * (1 - Math.min(1, L / 0.5));
  return mix(hex, '#f4f5f3', Math.min(0.93, t));
}
// Solid diagonal team-colour split (resolution-independent, CSS-driven so it can
// flip from a left/right split to a top/bottom split on narrow clean-view
// screens). Home is the container fill; away is one clipped overlay, so the two
// fields meet on a single crisp edge. Colours come from --home-deep/--away-deep.
function buildLiveBg() {
  const wrap = el('div', { class: 'live-bg2', 'aria-hidden': 'true' });
  wrap.appendChild(el('div', { class: 'live-bg2-a' }));
  return wrap;
}
// Matched-pair view toggle. Icons (real Lucide) describe the DESTINATION: the
// broadcast/TV clean view → `radio`; the rich detailed grid → `chart-line`.
const ICON_INFO = icon('info', { size: 14 });
function viewToggleEl(href, target) {
  const toClean = target === 'clean';
  return el('a', { class: 'live-vt', href, title: toClean ? 'Switch to the minimal clean view' : 'Switch to the full detailed view' },
    el('span', { class: 'live-vt-ic', html: icon(toClean ? 'radio' : 'chart-line', { size: 15 }) }),
    el('span', { class: 'live-vt-lbl' }, toClean ? 'Clean view' : 'Details'));
}

// ─── styles injection (shell + live) ──────────────────────────────────────────
let _stylesIn = false;
function injectStyles() {
  if (_stylesIn) return; _stylesIn = true;
  const a = document.createElement('style'); a.textContent = SHELL_CSS; document.head.appendChild(a);
  const b = document.createElement('style'); b.id = 'lvx-css'; b.textContent = LIVE_CSS; document.head.appendChild(b);
}

// Reveal the entrance-animated cards. requestAnimationFrame can be fully paused
// in a BACKGROUND tab, which would leave every [data-reveal] block stuck at
// opacity:0 until the tab is focused. So reveal immediately AND force-show via a
// (background-safe) timer fallback so the page is never blank when opened in a
// background tab.
function revealNow() {
  try { revealVisible(); } catch {}
  setTimeout(() => {
    try { document.querySelectorAll('[data-reveal]:not([data-seen])').forEach((e) => e.setAttribute('data-seen', '')); } catch {}
  }, 450);
}

// ─── entry ─────────────────────────────────────────────────────────────────────
export async function renderLivePage(root) {
  injectStyles();
  enablePopupLinks();
  // Dev/QA: trigger the goal celebration by hand, e.g.
  //   __wcGoalDemo('br','Brazil','Vinícius Jr.',62)  ·  __wcGoalDemo('gb-eng')
  try {
    window.__wcGoalDemo = (iso = 'br', teamName = 'Brazil', playerName = 'A. Player', minute = 24) =>
      playGoalCelebration({ iso, code: iso, teamName, playerName, minute });
  } catch {}
  data.getTeams48().catch(() => {});
  await loadColors();

  const params = new URLSearchParams(location.search);
  const merge = params.get('merge') != null || params.get('view') === 'merge';
  const clean = !merge && (params.get('view') === 'clean' || params.get('clean') != null);
  const shell = () => { try { injectShell({ active: 'live', subtitle: 'Live' }); } catch {} };

  if (params.get('demo')) {
    if (!clean) shell();
    // Seed a couple of synthetic concurrent matches so the "also live" indicator
    // (both views) and the swap links can be exercised without two real games.
    const ctrl = new LiveController(root, DEMO.m.idMatch, { demo: true, clean, merge, others: DEMO.others, otherBriefs: DEMO.otherBriefs });
    await ctrl.start();
    return ctrl;
  }

  // Sandbox/simulator (?sim): a hand-driven clean live page for previewing a
  // match. It fires goals through the SAME celebrateGoalCheck → celebrateGoal →
  // playGoalCelebration path the real feed uses, so what you see here is exactly
  // what a real goal will do.
  // ?sim-detail: same sandbox but shows the full DETAILED view (no clean overlay)
  // so you can test card layouts, team colours, and the shell at the same time.
  if (params.get('sim') != null) {
    const ctrl = new SimController(root, { forceDetail: params.get('sim') === 'detail' });
    await ctrl.start();
    return ctrl;
  }

  root.innerHTML = '<div class="lvx-boot">Finding the live match…</div>';
  const wantMatch = params.get('m');

  let active = [];
  try { active = await findActiveMatches(); } catch { active = []; }

  let chosen = null;
  if (wantMatch) {
    chosen = active.find((r) => String(r.MatchNumber) === String(wantMatch)) || { __byNumber: Number(wantMatch) };
  }
  if (!chosen) {
    let def = null; try { def = localStorage.getItem('wc_live_default'); } catch {}
    if (active.length > 1 && def) chosen = active.find((r) => String(r.MatchNumber) === String(def)) || null;
    if (!chosen && active.length === 1) chosen = active[0];
  }
  if (!chosen && active.length > 1) { shell(); renderPicker(root, active); return; }
  if (!chosen && active.length) chosen = active[0];
  if (!chosen) { shell(); await renderEmpty(root); return; }

  let idMatch = chosen.IdMatch;
  if (!idMatch && chosen.__byNumber != null) idMatch = await resolveIdByNumber(chosen.__byNumber);
  if (!idMatch) { shell(); await renderEmpty(root); return; }

  if (!clean) shell();
  const others = active.filter((r) => r.IdMatch !== idMatch);
  // Briefs (teams/score/clock) for the "also live" indicator — shown in BOTH the
  // detailed and the clean view now, so resolve them regardless of view.
  const otherBriefs = await Promise.all(others.map((r) => matchBrief(r.IdMatch, r.MatchNumber)));
  const ctrl = new LiveController(root, idMatch, { others, otherBriefs, clean, merge });
  await ctrl.start();
  return ctrl;
}

// A light per-match snapshot (teams/score/clock/status) for the picker & switcher,
// resolved from the FIFA per-match endpoint (the calendar row omits live score).
async function matchBrief(idMatch, matchNumber) {
  try {
    const m = fifa.normalizeLive(await fifa.getLive(idMatch));
    return { idMatch, MatchNumber: matchNumber ?? m.matchNumber, home: m.home.code, away: m.away.code, hs: m.home.score, as: m.away.score, minute: m.minute, status: m.status, phase: m.phase };
  } catch { return { idMatch, MatchNumber: matchNumber, home: null, away: null, hs: null, as: null, minute: null, status: null }; }
}

// Active = in-play now, or finished within the last 15 minutes (so the page
// holds on a match through and just past full time).
async function findActiveMatches() {
  const rows = await fifa.getCalendar({ count: 200 });
  const now = Date.now();
  return rows.filter((r) => {
    const st = fifa.statusFromCode(r.MatchStatus);
    if (st === 'live') return true;
    if (st === 'finished') {
      const ftEst = Date.parse(r.Date) + 118 * 60_000; // kickoff + ~118m ≈ FT
      return now - ftEst < CFG.POST_FT_LIVE_MS && now - ftEst > -30 * 60_000;
    }
    return false;
  }).sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date));
}
async function resolveIdByNumber(num) {
  try { const rows = await fifa.getCalendar({ count: 200 }); const r = rows.find((x) => Number(x.MatchNumber) === Number(num)); return r ? r.IdMatch : null; }
  catch { return null; }
}

// ─── LIVE controller ─────────────────────────────────────────────────────────
class LiveController {
  constructor(root, idMatch, opts = {}) {
    this.root = root; this.idMatch = idMatch; this.opts = opts; this.demo = !!opts.demo;
    this.others = opts.others || [];
    this.otherBriefs = opts.otherBriefs || [];
    this.m = null; this.events = [];
    this.espn = null; this.espnEventId = null; this.espnClock = null;
    this.official = null;            // SofaScore overlay
    this.refs = {};
    this.clean = !!opts.clean;
    this.merge = !!opts.merge;        // ?merge — clean hero that docks into the nav on scroll
    this.clkSec = null; this.clkAt = 0; this.phase = null; this.prevScore = null;
    this.freshNodes = [];            // per-card liveness indicators (see makeFresh)
    this.seenEvents = new Set(); this.seenComments = new Set();
    this.firstFinishedMs = null;
    this.lastFifaMs = null; this.lastEspnMs = null; this.lastSofaMs = null;
    this.timers = [];
    this._vis = () => { if (!document.hidden) { this.pollFifa(true); this.pollEspn(true); this.pollSofa(true); } };
  }

  async fetchFifa() {
    if (this.demo) return { m: DEMO.m, events: DEMO.events };
    const [live, tl] = await Promise.all([fifa.getLive(this.idMatch), fifa.getTimeline(this.idMatch)]);
    return { m: fifa.normalizeLive(live), events: fifa.normalizeTimeline(tl) };
  }

  async start() {
    const { m, events } = await this.fetchFifa();
    this.m = m; this.events = events; this.lastFifaMs = Date.now();
    this._restoreClock();   // resume the real second across a reload (no mm:00 snap)
    if (m.status === 'finished') this.firstFinishedMs = Date.now();
    if (this.merge) this.buildMergeSkeleton();
    else if (this.clean) this.buildCleanSkeleton(); else this.buildSkeleton();
    this.fullRender({ initial: true });
    this.startClock(); this.startFreshness();
    if (this.merge) this.startDockScroll();
    if (this.demo) { this.seedDemoOverlays(); this.fullRender({}); revealNow(); return; }
    this.pollFifa(true); this.pollEspn(true);
    if (!this.clean) { this.pollSofa(true); this.loadContext(); }
    this.timers.push(setInterval(() => this.pollFifa(), CFG.FIFA_MS));
    this.timers.push(setInterval(() => this.pollEspn(), CFG.ESPN_MS));
    if (!this.clean) {
      this.timers.push(setInterval(() => this.pollSofa(), CFG.SOFA_MS));
    }
    // Keep the "also live" indicator (detailed switcher OR clean pill) current.
    if (this.otherBriefs.length) this.timers.push(setInterval(() => this.refreshOthers(), 25_000));
    document.addEventListener('visibilitychange', this._vis);
    revealNow();
  }

  // ── polling ──
  async pollFifa(force) {
    if (!this.root.isConnected) return this.stop();
    if (!force && document.hidden) return;
    // While frozen (HT / full time) nothing changes — ease off to ~20s.
    if (!force && this.m && FROZEN.has(this.m.phase) && this.lastFifaMs && Date.now() - this.lastFifaMs < CFG.FIFA_MS_FROZEN) return;
    try {
      const { m, events } = await this.fetchFifa();
      this.m = m; this.events = events; this.lastFifaMs = Date.now();
      if (m.status === 'finished' && this.firstFinishedMs == null) this.firstFinishedMs = Date.now();
      this.fullRender({});
    } catch {}
  }
  async pollEspn(force) {
    if (this.demo || !this.root.isConnected) return;
    if (!force && document.hidden) return;
    try {
      // Resolve (and keep refining) the ESPN event until we have one WITH odds:
      // early in a match ESPN may list the fixture before its price, and the very
      // first scan can race the scoreboard flipping to live.
      if (!this.espnEventId || !(this.espnEvent && this.espnEvent.odds)) {
        const evs = await espn.getScoreboardWindow(1, 1);
        const ev = espn.matchEventByCodes(evs, [this.m.home.code, this.m.away.code]);
        if (ev) { this.espnEventId = ev.id; this.espnEvent = ev; if (!this.clean) this.renderWinProb(); }
      }
      if (this.espnEventId) {
        const sum = await espn.getSummary(this.espnEventId);
        if (sum) {
          this.espn = sum; this.lastEspnMs = Date.now();
          // Capture ESPN's second-accurate running clock, stamped with the moment
          // we received it, so renderClock can interpolate from a precise anchor.
          this.espnClock = sum.clock ? { ...sum.clock, at: this.lastEspnMs } : null;
          this.renderClock();
          if (this.clean) this.renderCleanComm();
          else { this.renderCommentary(); this.renderStats(); this.renderWinProb(); }
        }
      }
      if (!this.clean) this.renderFoot();
    } catch {}
  }
  async pollSofa(force) {
    if (this.demo || !this.root.isConnected) return;
    if (!force && document.hidden) return;
    try {
      const off = await sofa.getOfficialFor({ date: this.m.date || Date.now(), codes: [this.m.home.code, this.m.away.code], names: [this.m.home.name, this.m.away.name] });
      if (off) { this.official = off; this.lastSofaMs = Date.now(); this.renderMomentum(); this.renderStats(); this.renderShotmap(); this.renderFoot(); }
    } catch {}
  }
  seedDemoOverlays() {
    this.espn = DEMO.espn; this.lastEspnMs = Date.now() - 4000;
    this.official = DEMO.official; this.lastSofaMs = Date.now() - 9000;
    this.espnEvent = DEMO.espnEvent;
    this.ctxData = DEMO.ctx;
    // Seed a second-accurate clock so /wc/live?demo=1 shows the real behaviour:
    // on (re)load the clock resumes at the exact second, not the whole minute.
    this.espnClock = { displayClock: '66:50', period: 2, state: 'in', at: Date.now() };
  }

  // ── skeleton ──
  buildSkeleton(opts = {}) {
    const r = this.refs, m = this.m;
    const hc = accentFor(m.home.code), ac = accentFor(m.away.code);
    this.root.innerHTML = '';
    const stage = el('div', { class: 'lvx-stage' });
    stage.style.setProperty('--home', hc); stage.style.setProperty('--away', ac);
    stage.style.setProperty('--home-rgb', hexToRgb(hc).join(',')); stage.style.setProperty('--away-rgb', hexToRgb(ac).join(','));

    const hDeep = deepTeamBg(hc), aDeep = deepTeamBg(ac);
    stage.style.setProperty('--home-deep', hDeep); stage.style.setProperty('--away-deep', aDeep);
    const hLight = lightTeamBg(hc), aLight = lightTeamBg(ac);
    stage.style.setProperty('--home-deep-light', hLight); stage.style.setProperty('--away-deep-light', aLight);
    stage.appendChild(buildLiveBg());
    r.edgeH = el('div', { class: 'live-edge live-edge-h', 'aria-hidden': 'true' });
    r.edgeA = el('div', { class: 'live-edge live-edge-a', 'aria-hidden': 'true' });
    stage.appendChild(r.edgeH); stage.appendChild(r.edgeA);

    // status bar
    r.statusBar = el('div', { class: 'lvx-statusbar', 'data-reveal': '' });
    stage.appendChild(r.statusBar);

    // hero (skipped in ?merge — the fixed docking strip provides the hero there)
    if (!opts.noHero) {
      const hero = el('div', { class: 'lvx-hero', 'data-reveal': '' });
      r.homeSide = this.teamColumn('home'); r.awaySide = this.teamColumn('away');
      const mid = el('div', { class: 'lvx-heromid' });
      r.score = el('div', { class: 'lvx-score', 'aria-live': 'polite', 'aria-atomic': 'true' });
      r.clockWrap = el('div', { class: 'lvx-clockwrap' });
      r.clock = el('div', { class: 'lvx-clock' });
      r.clockMain = el('span', { class: 'lvx-clock-main' }, '0:00');
      r.clockAdded = el('span', { class: 'lvx-clock-added' });
      r.clock.appendChild(r.clockMain); r.clock.appendChild(r.clockAdded);
      r.phaseTag = el('div', { class: 'lvx-phasetag' });
      r.clockWrap.appendChild(r.clock); r.clockWrap.appendChild(r.phaseTag);
      mid.appendChild(r.score); mid.appendChild(r.clockWrap);
      hero.appendChild(r.homeSide.node); hero.appendChild(mid); hero.appendChild(r.awaySide.node);
      stage.appendChild(hero);
      r.goalFlash = el('div', { class: 'lvx-goalflash' }, 'GOAL'); stage.appendChild(r.goalFlash);
    }
    r.stage = stage;

    // win probability
    r.winWrap = el('div', { class: 'lvx-winwrap', 'data-reveal': '' });
    stage.appendChild(r.winWrap);

    // chips
    r.chips = el('div', { class: 'lvx-chips', 'data-reveal': '' });
    stage.appendChild(r.chips);

    // what's at stake (qualification odds + per-result scenario) — group matches only
    r.stakesWrap = el('div', { class: 'lvx-stakes', 'data-reveal': '', style: 'display:none' });
    stage.appendChild(r.stakesWrap);

    // momentum
    r.momCard = card('Attack momentum', r.momSub = el('span', { class: 'lvx-cardsub' }),
      this.makeFresh(() => this.official && this.official.momentum
        ? { ms: this.lastSofaMs, cadence: 20, label: 'SofaScore' }
        : { ms: this.lastFifaMs, cadence: 2, label: 'on-device model' }));
    r.momentum = el('div', { class: 'lvx-mom' }); r.momCard.appendChild(r.momentum);
    stage.appendChild(r.momCard);

    // two-column primary grid
    const grid1 = el('div', { class: 'lvx-grid lvx-grid-2' });
    // pitch
    r.pitchCard = card('Formations', r.formTag = el('span', { class: 'lvx-cardsub' }),
      this.makeFresh(() => ({ ms: this.lastFifaMs, cadence: 2, label: 'FIFA official' })));
    r.pitch = el('div', { class: 'lvx-pitch' }); r.pitchCard.appendChild(r.pitch);
    r.subsWrap = el('div', { class: 'lvx-subs' }); r.pitchCard.appendChild(r.subsWrap);
    // stats
    r.statsCard = card('Match stats', r.statsSub = el('span', { class: 'lvx-cardsub' }),
      this.makeFresh(() => this.official && this.official.stats
        ? { ms: this.lastSofaMs, cadence: 20, label: 'SofaScore' }
        : (this.espn && this.espn.stats
          ? { ms: this.lastEspnMs, cadence: 7, label: 'ESPN' }
          : { ms: this.lastFifaMs, cadence: 2, label: 'FIFA official' })));
    r.stats = el('div', { class: 'lvx-stats' }); r.statsCard.appendChild(r.stats);
    grid1.appendChild(r.pitchCard); grid1.appendChild(r.statsCard);
    stage.appendChild(grid1);

    // shotmap + xG
    r.shotCard = card('Shots & expected goals (xG)', r.shotSub = el('span', { class: 'lvx-cardsub' }),
      this.makeFresh(() => this.official && this.official.shotmap
        ? { ms: this.lastSofaMs, cadence: 20, label: 'SofaScore' }
        : { ms: this.lastFifaMs, cadence: 2, label: 'on-device model' }));
    r.shotmap = el('div', { class: 'lvx-shotmap' }); r.shotCard.appendChild(r.shotmap);
    stage.appendChild(r.shotCard);

    // commentary + timeline grid
    const grid2 = el('div', { class: 'lvx-grid lvx-grid-2' });
    r.commCard = card('Live commentary', r.commSub = el('span', { class: 'lvx-cardsub' }),
      this.makeFresh(() => ({ ms: this.lastEspnMs, cadence: 7, label: 'ESPN' })));
    r.commentary = el('div', { class: 'lvx-comm' }); r.commCard.appendChild(r.commentary);
    const tlcol = el('div', { class: 'lvx-tlcol' });
    r.tlCard = card('Key events', el('span', { class: 'lvx-cardsub' }, 'latest first'),
      this.makeFresh(() => ({ ms: this.lastFifaMs, cadence: 2, label: 'FIFA official' })));
    r.timeline = el('div', { class: 'lvx-tl' }); r.tlCard.appendChild(r.timeline);
    r.scorersCard = card('Top scorers', r.scorersSub = el('span', { class: 'lvx-cardsub' }, 'tournament + live'));
    r.scorers = el('div', { class: 'lvx-scorers' }); r.scorersCard.appendChild(r.scorers);
    tlcol.appendChild(r.tlCard); tlcol.appendChild(r.scorersCard);
    grid2.appendChild(r.commCard); grid2.appendChild(tlcol);
    stage.appendChild(grid2);

    // group impact
    r.groupCard = card('Group impact', r.groupSub = el('span', { class: 'lvx-cardsub' }));
    r.groupCard.style.display = 'none';
    r.group = el('div', { class: 'lvx-group' }); r.groupCard.appendChild(r.group);
    stage.appendChild(r.groupCard);

    // pre-match context
    r.ctxCard = card('Head-to-head & form', el('span', { class: 'lvx-cardsub' }, 'pre-match'));
    r.ctxCard.style.display = 'none';
    r.ctx = el('div', { class: 'lvx-ctx' }); r.ctxCard.appendChild(r.ctx);
    stage.appendChild(r.ctxCard);

    // footer
    r.foot = el('div', { class: 'lvx-foot', 'data-reveal': '' }); stage.appendChild(r.foot);

    this.root.appendChild(stage);

    function card(title, sub, fresh) {
      const c = el('div', { class: 'lvx-card', 'data-reveal': '' });
      const left = el('div', { class: 'lvx-cardh-l' }, el('span', { class: 'lvx-cardt' }, title));
      if (fresh) left.appendChild(fresh);
      const h = el('div', { class: 'lvx-cardh' }, left);
      if (sub) h.appendChild(sub);
      c.appendChild(h);
      return c;
    }
  }

  teamColumn(which) {
    const node = el('div', { class: 'lvx-team lvx-team-' + which });
    const flagBox = el('div', { class: 'lvx-teamflag' });
    const code = el('div', { class: 'lvx-teamcode' });
    const name = el('div', { class: 'lvx-teamname' });
    const form = el('div', { class: 'lvx-teamform' });
    const link = teamLink(null, 'lvx-teamlink', flagBox, code, name, form);
    node.appendChild(link);
    return { node, link, flagBox, code, name, form, which };
  }

  // ── render orchestration ──
  fullRender({ initial }) {
    if (this.clean) return this.renderClean({ initial });
    this.renderStatusBar();
    this.renderHero({ initial });
    this.renderClock();
    this.renderWinProb();
    this.renderChips();
    this.renderStakes();
    this.renderMomentum();
    this.renderPitch();
    this.renderStats();
    this.renderShotmap();
    this.renderCommentary();
    this.renderTimeline();
    this.renderScorers();
    this.computeGroup();
    this.renderFoot();
  }

  // ── CLEAN VIEW (?view=clean): flags, codes, names, score, clock, the match
  //    line, live + freshness indicators, and an optional play-by-play dropdown.
  //    Big, bold, minimal; shares the live data + clock + freshness machinery. ──
  buildCleanSkeleton() {
    const r = this.refs, m = this.m;
    const hc = accentFor(m.home.code), ac = accentFor(m.away.code);
    this.root.innerHTML = '';
    const stage = el('div', { class: 'cv-stage' });
    stage.style.setProperty('--home', hc); stage.style.setProperty('--away', ac);
    stage.style.setProperty('--home-rgb', hexToRgb(hc).join(',')); stage.style.setProperty('--away-rgb', hexToRgb(ac).join(','));
    const hDeep = deepTeamBg(hc), aDeep = deepTeamBg(ac);
    stage.style.setProperty('--home-deep', hDeep); stage.style.setProperty('--away-deep', aDeep);
    const hLight = lightTeamBg(hc), aLight = lightTeamBg(ac);
    stage.style.setProperty('--home-deep-light', hLight); stage.style.setProperty('--away-deep-light', aLight);
    stage.appendChild(buildLiveBg());
    r.edgeH = el('div', { class: 'live-edge live-edge-h', 'aria-hidden': 'true' });
    r.edgeA = el('div', { class: 'live-edge live-edge-a', 'aria-hidden': 'true' });
    stage.appendChild(r.edgeH); stage.appendChild(r.edgeA);

    const top = el('div', { class: 'cv-top' });
    r.fresh = el('div', { class: 'cv-fresh', title: 'Time since last refresh' }, el('span', { class: 'cv-fresh-dot' }), r.freshTxt = el('span', {}, 'updated just now'));
    top.appendChild(r.fresh);
    // "Also live" pill(s) for other concurrent matches — tap to swap.
    r.cvOther = el('div', { class: 'cv-other', style: 'display:none' });
    top.appendChild(r.cvOther);
    // Match meta (group/venue): a plain line at the very top on desktop, a
    // collapsible "Match info" button on mobile — kept clear of the score.
    const info = el('div', { class: 'cv-info' + (this.cvInfoOpen ? ' open' : '') });
    r.infoBtn = el('button', { class: 'cv-info-btn', type: 'button', 'aria-expanded': this.cvInfoOpen ? 'true' : 'false' });
    r.infoBtn.appendChild(el('span', { class: 'cv-info-ic', html: ICON_INFO }));
    r.infoBtn.appendChild(el('span', { class: 'cv-info-lbl' }, 'Match info'));
    r.infoBtn.appendChild(el('span', { class: 'cv-info-ar', html: icon('chevron-down', { size: 14 }) }));
    r.infoBtn.addEventListener('click', () => {
      this.cvInfoOpen = !this.cvInfoOpen;
      info.classList.toggle('open', this.cvInfoOpen);
      r.infoBtn.setAttribute('aria-expanded', this.cvInfoOpen ? 'true' : 'false');
    });
    r.meta = el('div', { class: 'cv-info-panel' });
    info.appendChild(r.infoBtn); info.appendChild(r.meta);
    top.appendChild(info);
    top.appendChild(viewToggleEl(this.viewHref('full'), 'full'));
    stage.appendChild(top);

    const main = el('div', { class: 'cv-main' });
    const rowEl = el('div', { class: 'cv-row' });
    r.homeSide = this.cvTeam('home'); r.awaySide = this.cvTeam('away');
    const mid = el('div', { class: 'cv-mid' });
    r.score = el('div', { class: 'cv-score', 'aria-live': 'polite', 'aria-atomic': 'true' });
    mid.appendChild(r.score);
    // Clock + half indicator hang centred just below the score, out of flow so the
    // score group stays centred on the diagonal (desktop). On mobile this drops
    // back into flow between the stacked teams (see CSS).
    r.clockWrap = el('div', { class: 'cv-clockwrap' });
    r.clock = el('div', { class: 'cv-clock' });
    r.clockMain = el('span', { class: 'cv-clock-main' }, '0:00');
    r.clockAdded = el('span', { class: 'cv-clock-added' });
    r.clock.appendChild(r.clockMain); r.clock.appendChild(r.clockAdded);
    r.phaseTag = el('div', { class: 'cv-phase' });
    r.clockWrap.appendChild(r.clock); r.clockWrap.appendChild(r.phaseTag);
    mid.appendChild(r.clockWrap);
    rowEl.appendChild(r.homeSide.node); rowEl.appendChild(mid); rowEl.appendChild(r.awaySide.node);
    main.appendChild(rowEl);
    r.goalFlash = el('div', { class: 'cv-goalflash' }, 'GOAL'); main.appendChild(r.goalFlash);
    stage.appendChild(main);

    const pbp = el('div', { class: 'cv-pbp' + (this.cvPbpOpen ? ' open' : '') });
    r.pbpBtn = el('button', { class: 'cv-pbp-btn', type: 'button', onclick: () => {
      this.cvPbpOpen = !this.cvPbpOpen; pbp.classList.toggle('open', this.cvPbpOpen);
    } }, el('span', {}, 'Play-by-play'), r.pbpAr = el('span', { class: 'cv-pbp-ar', html: icon('chevron-down', { size: 20 }) }));
    r.pbp = el('div', { class: 'cv-pbp-body' });
    pbp.appendChild(r.pbpBtn); pbp.appendChild(r.pbp);
    stage.appendChild(pbp);

    this.root.appendChild(stage);
    this.renderCleanOthers();
    this._onResize = () => this.sizeCleanEdges();
    window.addEventListener('resize', this._onResize, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onResize, { passive: true });
    // Re-pin slash/edges once the display fonts paint (they change the score's
    // measured size/position), and on the next frame after first layout.
    requestAnimationFrame(() => this.sizeCleanEdges());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.sizeCleanEdges()).catch(() => {});
  }
  cvTeam(which) {
    const node = el('div', { class: 'cv-team cv-team-' + which });
    const flag = el('div', { class: 'cv-flag' });
    const code = el('div', { class: 'cv-code' });
    const link = teamLink(null, 'cv-tlink', flag, code);
    node.appendChild(link);
    return { node, link, flag, code, which };
  }
  viewHref(mode) {
    const p = new URLSearchParams(location.search);
    if (mode === 'clean') p.set('view', 'clean'); else p.delete('view');
    p.delete('clean');
    const q = p.toString();
    return '/wc/live' + (q ? '?' + q : '');
  }
  renderClean({ initial }) {
    const r = this.refs, m = this.m;
    r.meta.textContent = [stageLabel(m), m.stadium, m.city].filter(Boolean).join('  ·  ');
    this.cvFill(r.homeSide, m.home); this.cvFill(r.awaySide, m.away);
    this.fillEdges(m);
    this.maybeSizeEdges();
    const hs = m.home.score ?? 0, as = m.away.score ?? 0;
    if (!r.scoreH) {
      r.score.innerHTML = '';
      r.scoreH = el('span', { class: 'cv-s cv-s-h' }, String(hs));
      r.scoreA = el('span', { class: 'cv-s cv-s-a' }, String(as));
      r.pens = el('div', { class: 'cv-pens', style: 'display:none' });
      r.slash = el('span', { class: 'cv-sslash', 'aria-hidden': 'true' }, '-');
      r.score.appendChild(r.scoreH); r.score.appendChild(r.slash); r.score.appendChild(r.scoreA); r.score.appendChild(r.pens);
    } else { r.scoreH.textContent = String(hs); r.scoreA.textContent = String(as); }
    if (m.homePen != null && m.awayPen != null) { r.pens.textContent = `(${m.homePen}–${m.awayPen} pens)`; r.pens.style.display = ''; } else r.pens.style.display = 'none';
    const key = hs + '-' + as;
    if (!initial && this.prevScore != null && this.prevScore !== key) this.cvFlash();
    this.prevScore = key;
    this.celebrateGoalCheck(m, initial);
    this.renderClock();
    this.layoutSlash();
    this.renderCleanComm();
  }
  cvFill(side, t) {
    if (side._code !== t.code) {
      side.flag.innerHTML = ''; side.flag.appendChild(flagImg(t.code, 'cv-flagimg'));
      side.code.textContent = t.code || '';
      if (t.code) { side.link.setAttribute('href', `/wc/team/${encodeURIComponent(t.code)}`); side.link.dataset.popupTeam = t.code; }
      side._code = t.code;
    }
  }
  cvFlash() {
    const r = this.refs;
    r.score.classList.remove('flash'); void r.score.offsetWidth; r.score.classList.add('flash');
    if (r.goalFlash) { r.goalFlash.classList.remove('show'); void r.goalFlash.offsetWidth; r.goalFlash.classList.add('show'); setTimeout(() => r.goalFlash.classList.remove('show'), 1700); }
  }
  renderCleanComm() {
    const r = this.refs; if (!r.pbp) return;
    let items = (this.espn && this.espn.commentary) ? this.espn.commentary : null;
    if (!items || !items.length) items = this.fifaCommentary();
    const csig = (items ? items.length + '~' + (items[0] ? (items[0].seq + items[0].min + (items[0].text || '').slice(0, 18)) : '') : '0');
    if (csig === this._cvCommSig) return;
    this._cvCommSig = csig;
    r.pbp.innerHTML = '';
    if (!items || !items.length) { r.pbp.appendChild(el('div', { class: 'cv-muted' }, 'Commentary begins at kick-off.')); return; }
    for (const c of items.slice(0, 60)) {
      const row = el('div', { class: 'cv-cm' + (c.isGoal ? ' goal' : c.isCard ? ' card' : '') });
      if (c.min) row.appendChild(el('span', { class: 'cv-cm-min' }, c.min));
      row.appendChild(el('span', { class: 'cv-cm-tx' }, c.text));
      r.pbp.appendChild(row);
    }
  }

  liveState() {
    const m = this.m;
    if (m.status === 'live') return 'live';
    if (m.status === 'finished') {
      if (this.firstFinishedMs && Date.now() - this.firstFinishedMs < CFG.POST_FT_LIVE_MS) return 'justft';
      return 'ft';
    }
    return 'pre';
  }

  renderStatusBar() {
    const r = this.refs, m = this.m, ls = this.liveState();
    // Rebuild only when something here actually changes — otherwise the freshness
    // chip (which updates on its own 1s timer) would blink back to "…" each poll.
    const sig = ls + '|' + stageLabel(m) + '|' + [m.stadium, m.city].filter(Boolean).join('·') + '|' + (this.otherBriefs || []).map((o) => `${o.MatchNumber}:${o.hs}:${o.as}:${o.minute}`).join(',');
    if (sig === this._sbSig && r.fresh) return;
    this._sbSig = sig;
    r.statusBar.innerHTML = '';
    // back
    r.statusBar.appendChild(el('button', {
      class: 'lvx-back', type: 'button', 'aria-label': 'Back',
      onclick: () => { if (history.length > 1) history.back(); else location.href = '/wc/fixtures'; },
    }, el('span', { class: 'lvx-back-ic', html: icon('arrow-left', { size: 15 }) }), el('span', { class: 'lvx-back-lbl' }, 'Back')));

    const pillCls = ls === 'live' ? 'is-live' : ls === 'pre' ? 'is-pre' : 'is-ft';
    const pillTxt = ls === 'live' ? 'LIVE' : ls === 'pre' ? 'KICKOFF SOON' : ls === 'justft' ? 'FULL TIME' : 'FULL TIME';
    r.statusBar.appendChild(el('div', { class: 'lvx-livepill ' + pillCls }, el('span', { class: 'lvx-dot' }), el('span', {}, pillTxt)));
    r.statusBar.appendChild(el('div', { class: 'lvx-stage-lbl' }, stageLabel(m)));
    const venue = [m.stadium, m.city].filter(Boolean).join(' · ');
    if (venue) r.statusBar.appendChild(el('div', { class: 'lvx-venue-lbl' }, venue));
    r.statusBar.appendChild(el('div', { class: 'lvx-sb-spacer' }));
    // switcher for overlapping games
    if (this.others && this.others.length) r.statusBar.appendChild(this.buildSwitcher());
    // clean-view toggle
    r.statusBar.appendChild(viewToggleEl(this.viewHref('clean'), 'clean'));
    // freshness
    r.fresh = el('div', { class: 'lvx-fresh', title: 'Time since last data refresh' }, el('span', { class: 'lvx-fresh-dot' }), r.freshTxt = el('span', {}, '…'));
    r.statusBar.appendChild(r.fresh);
  }

  // Href to swap the page to another live match, preserving the current view
  // (so a clean-view user who taps the other game stays in clean view).
  switchHref(num) { return '/wc/live?m=' + num + (this.clean ? '&view=clean' : '') + (this.merge ? '&merge' : ''); }

  buildSwitcher() {
    const briefs = (this.otherBriefs && this.otherBriefs.length) ? this.otherBriefs
      : this.others.map((o) => ({ MatchNumber: o.MatchNumber, home: teamCodeOf(o, 'home'), away: teamCodeOf(o, 'away'), hs: null, as: null, minute: minuteOf(o), status: fifa.statusFromCode(o.MatchStatus) }));
    const wrap = el('div', { class: 'lvx-switch' });
    wrap.appendChild(el('span', { class: 'lvx-switch-lbl' }, briefs.length > 1 ? `${briefs.length} other live` : 'Also live'));
    for (const o of briefs.slice(0, 3)) {
      const chip = el('a', { class: 'lvx-switch-chip', href: this.switchHref(o.MatchNumber), title: 'Switch to this match' });
      chip.appendChild(el('span', { class: 'lvx-switch-side' }, flagImg(o.home, 'lvx-switch-flag'), el('span', { class: 'lvx-switch-c' }, o.home || '—')));
      const sc = (o.hs != null && o.as != null) ? `${o.hs}–${o.as}` : null;
      chip.appendChild(el('span', { class: 'lvx-switch-sc' }, sc != null ? sc : 'v'));
      chip.appendChild(el('span', { class: 'lvx-switch-side' }, el('span', { class: 'lvx-switch-c' }, o.away || '—'), flagImg(o.away, 'lvx-switch-flag')));
      chip.appendChild(el('span', { class: 'lvx-switch-min' }, o.status === 'finished' ? 'FT' : (o.minute || 'LIVE')));
      wrap.appendChild(chip);
    }
    return wrap;
  }

  // Clean view's compact "also live" pill(s) — flags + score + minute, tap to swap.
  renderCleanOthers() {
    const host = this.refs.cvOther; if (!host) return;
    const briefs = (this.otherBriefs || []).filter((o) => o && (o.home || o.away));
    host.innerHTML = '';
    if (!briefs.length) { host.style.display = 'none'; return; }
    host.style.display = '';
    host.appendChild(el('span', { class: 'cv-other-lbl' }, 'Also live'));
    for (const o of briefs.slice(0, 2)) {
      const live = o.status !== 'finished';
      const chip = el('a', { class: 'cv-other-chip', href: this.switchHref(o.MatchNumber), title: `Switch to ${o.home || ''}–${o.away || ''}` });
      chip.appendChild(el('span', { class: 'cv-other-dot' + (live ? '' : ' ft') }));
      chip.appendChild(flagImg(o.home, 'cv-other-flag'));
      const sc = (o.hs != null && o.as != null) ? `${o.hs}–${o.as}` : 'v';
      chip.appendChild(el('span', { class: 'cv-other-sc' }, sc));
      chip.appendChild(flagImg(o.away, 'cv-other-flag'));
      chip.appendChild(el('span', { class: 'cv-other-min' }, o.status === 'finished' ? 'FT' : (o.minute || 'LIVE')));
      host.appendChild(chip);
    }
  }

  async refreshOthers() {
    if (this.demo || !this.root.isConnected || document.hidden || !this.otherBriefs.length) return;
    try {
      this.otherBriefs = await Promise.all(this.otherBriefs.map((b) => matchBrief(b.idMatch, b.MatchNumber)));
      if (this.clean) this.renderCleanOthers();
      else { this.renderStatusBar(); this.renderFresh(); }
    } catch {}
  }

  // "What's at stake" — both teams' live odds to reach the Round of 32, plus how a
  // result from the current scoreline would shift them. Group matches only. The
  // forecast runs in a worker and is keyed by score+phase, so it only recomputes
  // on goals / phase changes, not every clock tick.
  renderStakes() {
    const r = this.refs, m = this.m;
    if (!r.stakesWrap) return;
    const isGroup = m.matchNumber && Number(m.matchNumber) <= 72;
    if (!isGroup || !m.home.code || !m.away.code) { r.stakesWrap.style.display = 'none'; return; }
    const key = `${m.home.code}${m.away.code}|${m.home.score ?? 0}-${m.away.score ?? 0}|${m.phase || ''}`;
    if (key === this._stkKey && r.stakesWrap.dataset.filled) return;
    this._stkKey = key;
    const mn = Number(m.matchNumber), H = m.home.code, A = m.away.code, snap = { status: m.status };
    import('./forecast-client.js').then((fc) => fc.getForecast({ focusMatch: mn })).then((f) => {
      if (this._stkKey !== key) return;
      this.paintStakes(f, H, A, snap);
    }).catch(() => {});
  }
  paintStakes(f, H, A, snap) {
    const r = this.refs; if (!r.stakesWrap) return;
    const th = f.teams[H], ta = f.teams[A];
    if (!th || !ta) { r.stakesWrap.style.display = 'none'; return; }
    const pctTxt = (q) => q >= 0.9995 ? el('span', { class: 'thru-ic', html: icon('check', { size: 12 }) }) : document.createTextNode(q <= 0.0005 ? 'OUT' : `${Math.min(99, Math.max(1, Math.round(q * 100)))}%`);
    r.stakesWrap.style.display = ''; r.stakesWrap.dataset.filled = '1'; r.stakesWrap.innerHTML = '';
    r.stakesWrap.appendChild(el('div', { class: 'lvx-stk-h' },
      el('span', { class: 'lvx-stk-ic', html: icon('trending-up', { size: 12 }) }),
      'What’s at stake', el('span', { class: 'lvx-stk-note' }, 'live odds to reach the Round of 32')));
    const teams = el('div', { class: 'lvx-stk-teams' });
    const teamCard = (code, q, side) => {
      const c = el('div', { class: 'lvx-stk-tc ' + side });
      c.appendChild(el('div', { class: 'code' }, code));
      const big = el('div', { class: 'big' + (q >= 0.9995 ? ' thru' : q <= 0.0005 ? ' out' : '') });
      if (q >= 0.9995) big.innerHTML = icon('check', { size: 15 }) + ' THROUGH';
      else if (q <= 0.0005) big.textContent = 'ELIMINATED';
      else { big.appendChild(document.createTextNode(String(Math.min(99, Math.max(1, Math.round(q * 100)))))); big.appendChild(el('i', {}, '%')); }
      c.appendChild(big);
      c.appendChild(el('div', { class: 'cap' }, 'to advance'));
      const bar = el('div', { class: 'bar' });
      bar.appendChild(el('div', { class: 'f' + (q >= 0.9995 ? ' thru' : ''), style: `width:${q <= 0.0005 ? 0 : Math.max(4, Math.round(q * 100))}%` }));
      c.appendChild(bar);
      return c;
    };
    teams.appendChild(teamCard(H, th.qualify, 'home'));
    teams.appendChild(teamCard(A, ta.qualify, 'away'));
    r.stakesWrap.appendChild(teams);
    if (snap.status === 'live' && f.focus && f.focus.H && f.focus.D && f.focus.A) {
      // map buckets by team code (forecast orientation can differ from the display)
      const homeWinB = (f.focus.homeCode === H) ? f.focus.H : f.focus.A;
      const awayWinB = (f.focus.homeCode === H) ? f.focus.A : f.focus.H;
      const rows = [
        { lbl: `${H} win`, cls: 'home', b: homeWinB },
        { lbl: 'Draw', cls: 'draw', b: f.focus.D },
        { lbl: `${A} win`, cls: 'away', b: awayWinB },
      ].filter((x) => ((x.b && x.b.p) || 0) >= 0.02);  // drop essentially-impossible outcomes
      if (rows.length >= 2) {
        const sc = el('div', { class: 'lvx-stk-scen' });
        sc.appendChild(el('div', { class: 'lvx-stk-scen-h' }, 'If it finishes from here…'));
        // home outcome (left) · result (centre) · away outcome (right)
        for (const x of rows) sc.appendChild(el('div', { class: 'lvx-stk-srow' },
          el('span', { class: 'v vh' }, el('b', {}, pctTxt(x.b.teams[H]?.qualify ?? th.qualify))),
          el('span', { class: 'r ' + x.cls }, x.lbl),
          el('span', { class: 'v va' }, el('b', {}, pctTxt(x.b.teams[A]?.qualify ?? ta.qualify)))));
        r.stakesWrap.appendChild(sc);
      } else {
        r.stakesWrap.appendChild(el('div', { class: 'lvx-stk-decided' }, 'Result effectively decided.'));
      }
    }
    // Who else is watching — other teams (not playing) hanging on this result.
    if (snap.status === 'live') this.paintWhoElse(H, A, this._stkKey);
  }
  paintWhoElse(H, A, key) {
    const r = this.refs; if (!r.stakesWrap) return;
    import('./forecast-client.js').then((fc) => fc.getCrossImpact()).then((cx) => {
      if (this._stkKey !== key || !r.stakesWrap) return;
      const cm = cx && cx.cross && cx.cross[Number(this.m.matchNumber)];
      if (!cm) return;
      const swing = (q) => (q ? Math.max(q.H, q.D, q.A) - Math.min(q.H, q.D, q.A) : 0);
      const others = Object.keys(cm.qual)
        .filter((c) => c !== H && c !== A)
        .map((c) => ({ c, q: cm.qual[c], s: swing(cm.qual[c]) }))
        .filter((x) => x.s >= 0.03).sort((a, b) => b.s - a.s).slice(0, 5);
      if (!others.length) return;
      const who = el('div', { class: 'lvx-stk-who' });
      who.appendChild(el('div', { class: 'lvx-stk-scen-h' }, 'Who else is watching'));
      for (const { c, q, s } of others) {
        const best = [['H', q.H], ['D', q.D], ['A', q.A]].sort((a, b) => b[1] - a[1])[0][0];
        const want = best === 'D' ? 'a draw' : best === 'H' ? H : A;
        who.appendChild(el('div', { class: 'lvx-who-row' },
          el('span', { class: 'tc' }, c),
          el('span', { class: 'wt ' + (best === 'D' ? 'draw' : 'win') }, 'wants ', el('b', {}, want)),
          el('span', { class: 'sw' }, '±' + Math.round(s * 100) + 'pt')));
      }
      r.stakesWrap.appendChild(who);
    }).catch(() => {});
  }

  renderHero({ initial }) {
    const r = this.refs, m = this.m;
    this.fillTeam(r.homeSide, m.home);
    this.fillTeam(r.awaySide, m.away);
    this.fillEdges(m);
    const hs = m.home.score ?? 0, as = m.away.score ?? 0;
    // Build the score nodes ONCE, then update text in place — rebuilding the DOM
    // every poll made the digits repaint/"jump". Same idea for flags (below).
    if (!r.scoreH) {
      r.score.innerHTML = '';
      r.scoreH = el('span', { class: 'lvx-s lvx-s-h' }, String(hs));
      r.scoreA = el('span', { class: 'lvx-s lvx-s-a' }, String(as));
      r.pens = el('div', { class: 'lvx-pens', style: 'display:none' });
      r.score.appendChild(r.scoreH); r.score.appendChild(el('span', { class: 'lvx-sdash' }, '–')); r.score.appendChild(r.scoreA); r.score.appendChild(r.pens);
    } else { r.scoreH.textContent = String(hs); r.scoreA.textContent = String(as); }
    if (m.homePen != null && m.awayPen != null) { r.pens.textContent = `(${m.homePen}–${m.awayPen} on pens)`; r.pens.style.display = ''; } else r.pens.style.display = 'none';
    const key = hs + '-' + as;
    if (!initial && this.prevScore != null && this.prevScore !== key) this.flash();
    this.prevScore = key;
    this.celebrateGoalCheck(m, initial);
  }

  fillTeam(side, t) {
    // Only (re)build the flag <img> when the team code changes — recreating it
    // every poll made the flag flicker as the browser re-decoded the image.
    if (side._code !== t.code) {
      side.flagBox.innerHTML = ''; side.flagBox.appendChild(flagImg(t.code, 'lvx-flagimg'));
      side.code.textContent = t.code || ''; side.code.style.color = 'var(--' + side.which + ')';
      if (t.code) { side.link.setAttribute('href', `/wc/team/${encodeURIComponent(t.code)}`); side.link.dataset.popupTeam = t.code; }
      side._code = t.code;
    }
    side.name.textContent = t.name || '';
    const ev = this.espnEvent;
    const formStr = ev ? (side.which === 'home' ? ev.home.form : ev.away.form) : null;
    if (formStr && side._form !== formStr) {
      side.form.innerHTML = '';
      for (const ch of String(formStr).slice(-5)) side.form.appendChild(el('span', { class: 'lvx-pip lvx-pip-' + (ch === 'W' ? 'w' : ch === 'L' ? 'l' : 'd') }, ch));
      side._form = formStr;
    }
  }

  // Faint sideways team names pressed against each screen edge. Set only when the
  // name changes (avoids re-layout each poll). Falls back to the 3-letter code.
  fillEdges(m) {
    const r = this.refs;
    const hn = m.home.name || m.home.code || '';
    const an = m.away.name || m.away.code || '';
    if (r.edgeH && r.edgeH._txt !== hn) { r.edgeH.textContent = hn; r.edgeH._txt = hn; }
    if (r.edgeA && r.edgeA._txt !== an) { r.edgeA.textContent = an; r.edgeA._txt = an; }
  }

  // Clean view only: size each sideways name to fill most of the viewport height
  // (big & bold) on desktop, regardless of length, so the longest name still
  // fits. On mobile we hand sizing back to CSS (svh-based) so the browser chrome
  // never clips it. Gated on a name/size signature so it isn't re-measured each poll.
  maybeSizeEdges() {
    if (!this.clean) return;
    const r = this.refs;
    const vv = window.visualViewport;
    const h = (vv && vv.height) || window.innerHeight, w = window.innerWidth;
    const sig = (r.edgeH && r.edgeH._txt) + '|' + (r.edgeA && r.edgeA._txt) + '|' + w + 'x' + Math.round(h);
    if (sig === this._edgeSig) return;
    this._edgeSig = sig;
    this.sizeCleanEdges();
  }
  sizeCleanEdges() {
    const r = this.refs;
    const desktop = window.innerWidth > 560;
    const vv = window.visualViewport;
    const safe = (vv && vv.height) || window.innerHeight;
    for (const e of [r.edgeH, r.edgeA]) {
      if (!e) continue;
      if (!desktop || !e.textContent) { e.style.fontSize = ''; continue; } // CSS handles mobile
      e.style.fontSize = '120px';                 // measure run length at a reference size
      const run = e.offsetHeight || 1;            // vertical-rl: offsetHeight = the text run
      const capW = window.innerWidth * 0.27;      // keep the rotated thickness reasonable
      let fs = 120 * (safe * 0.86) / run;
      fs = Math.max(46, Math.min(190, capW, fs));
      e.style.fontSize = fs.toFixed(1) + 'px';
    }
    this.layoutSlash();
  }

  // Separator is now a static inline hyphen centred by the flex parent; no JS positioning needed.
  layoutSlash() {}

  flash() {
    const r = this.refs;
    r.score.classList.remove('flash'); void r.score.offsetWidth; r.score.classList.add('flash');
    r.goalFlash.classList.remove('show'); void r.goalFlash.offsetWidth; r.goalFlash.classList.add('show');
    setTimeout(() => r.goalFlash.classList.remove('show'), 1700);
  }

  // ── full-screen GOAL celebration (lib/goal-celebration.js) ──
  // Watch each side's score independently so we know WHICH team scored — that one
  // team drives the entire celebration (colors, banner, confetti, cannons). Fires
  // in both the clean and detailed views; never on the initial paint.
  //
  // ⚠️ SHARED PATH — the sandbox (SimController) inherits these two methods
  // unchanged and reaches them via the same fullRender → renderClean/renderHero.
  // A simulated goal therefore exercises the EXACT code a real API goal does, so
  // previewing in /wc/live?sim guarantees the live behaviour. Keep them generic:
  // resolve everything from `m`/`this.events` (never from sandbox- or feed-
  // specific state) so the two can never drift.
  celebrateGoalCheck(m, initial) {
    if (!m) return;
    const hs = m.home.score ?? 0, as = m.away.score ?? 0;
    if (!initial && this._gHs != null && (hs > this._gHs || as > this._gAs)) {
      this.celebrateGoal(hs > this._gHs ? 'home' : 'away');
    }
    this._gHs = hs; this._gAs = as;
  }
  celebrateGoal(side) {
    const m = this.m; if (!m) return;
    const team = side === 'home' ? m.home : m.away;
    const iso = FLAG[team.code] || '';
    // Scorer + minute: take the latest goal-type event from the timeline; fall
    // back to the running match clock if events haven't landed yet.
    let playerName = '', minute = '';
    const isGoalEv = (e) => e.kind === 'goal' || e.kind === 'penalty' || e.kind === 'own_goal';
    let last = null;
    for (const e of (this.events || [])) {
      if (!isGoalEv(e)) continue;
      if (!last || parseMinute(e.minuteLabel || e.minute) >= parseMinute(last.minuteLabel || last.minute)) last = e;
    }
    if (last) {
      playerName = prettyName(last.player || '') || '';
      minute = String(last.minuteLabel || last.minute || '').replace(/['′\s]+$/, '');
    }
    if (!minute) minute = String(parseMinute(m.minute) || '');
    try { playGoalCelebration({ iso, code: team.code, teamName: team.name || team.code || '', playerName, minute }); }
    catch (e) { /* never let a celebration error break the live view */ }
  }

  // ── clock with explicit added time ──
  startClock() { this.renderClock(); this.timers.push(setInterval(() => { if (!this.root.isConnected) return this.stop(); this.renderClock(); }, CFG.CLOCK_MS)); }
  // Continuous, second-accurate, monotonic clock.
  //
  // The displayed time is ONE running value (this.clkSec) advanced by real
  // wall-time every tick. It is corrected by the best source available, but it is
  // NEVER reset to a whole minute — so re-opening / re-foregrounding / reloading
  // the page resumes the real seconds, instead of snapping back to mm:00:
  //
  //   • ESPN displayClock ("67:23") is a true second-level stopwatch. When present
  //     and consistent with FIFA's minute (±120s) it is the truth — we adopt it.
  //   • Otherwise we free-run from the last shown value (continuity across polls,
  //     background↔foreground and, via sessionStorage, reloads) and only nudge it
  //     to stay inside FIFA's current whole-minute window. Sub-minute seconds are
  //     preserved; we never zero them.
  //
  // FIFA's minute is minute-resolution only, so on a truly cold first view with no
  // ESPN yet the clock can start at mm:00 for ~1s until the forced ESPN/FIFA polls
  // land — every other path keeps the real seconds.
  computeClockSec() {
    const m = this.m, ph = m.phase, now = Date.now();
    if (FROZEN.has(ph)) { this.clkSec = parseMinute(m.minute) * 60; this.clkAt = now; this._persistClock(); return this.clkSec; }

    const fmin = parseMinute(m.minute);
    const lo = fmin * 60, hi = lo + 60;

    // Second-accurate target from ESPN, interpolated to now. Trust only when it
    // agrees with FIFA's live minute (rejects mis-parse / wrong match / drift).
    let espn = null;
    const c = this.espnClock;
    if (c && c.state === 'in') {
      const sec = clockToSec(c.displayClock);
      const at = c.at || this.lastEspnMs;
      if (sec != null && at) {
        const t = sec + Math.max(0, (now - at) / 1000);
        if (Math.abs(t - lo) <= 120) espn = t;
      }
    }

    // Free-running estimate from the value we last showed (this is what survives
    // background tabs and, seeded from sessionStorage, page reloads).
    const est = (this.clkSec != null && this.clkAt) ? this.clkSec + (now - this.clkAt) / 1000 : null;

    let val;
    if (espn != null) {
      val = espn;                                   // adopt the accurate second
    } else if (est != null) {
      val = est;                                    // free-run…
      if (val < lo) val = lo;                       // …caught up to the official minute
      else if (val >= hi) val = hi - 0.7;           // …held just under the next minute
      if (this.clkSec != null && val < this.clkSec && this.clkSec < hi) val = this.clkSec; // monotonic
    } else {
      val = lo;                                     // cold start: corrected within ~1s
    }

    this.clkSec = val; this.clkAt = now; this._persistClock();
    return val;
  }
  _persistClock() {
    try {
      if (this.demo || this.clkSec == null) return;
      sessionStorage.setItem('wc_live_clk', JSON.stringify({ id: this.idMatch, sec: this.clkSec, at: this.clkAt }));
    } catch {}
  }
  // Seed the clock from the last value this session showed for THIS match, so a
  // reload resumes at the real second instead of mm:00. Safe no-op otherwise.
  _restoreClock() {
    try {
      const o = JSON.parse(sessionStorage.getItem('wc_live_clk') || 'null');
      if (o && o.id === this.idMatch && o.sec != null && o.at && (Date.now() - o.at) < 3 * 3600e3) {
        this.clkSec = o.sec; this.clkAt = o.at;
      }
    } catch {}
  }
  renderClock() {
    const r = this.refs; if (!r.clockMain) return;
    const m = this.m, ph = m.phase, ls = this.liveState();
    if (r.clock) r.clock.className = (this.clean ? 'cv-clock' : 'lvx-clock') + ' ' + (ls === 'live' ? 'is-live' : ls === 'pre' ? 'is-pre' : 'is-ft');
    r.clockAdded.textContent = ''; r.clockAdded.classList.remove('on');
    if (ph === 'HT') { r.clockMain.textContent = 'HALF TIME'; }
    else if (ph === 'PRE') { r.clockMain.textContent = 'KICK-OFF'; }
    else if (ph === 'FT' || ph === 'FT_PEN') { r.clockMain.textContent = 'FULL TIME'; if (ph === 'FT_PEN') r.clockAdded.textContent = 'on penalties'; }
    else if (ph === 'PEN') { r.clockMain.textContent = 'PENALTIES'; }
    else {
      const c = fmtClock(ph, this.computeClockSec());
      r.clockMain.textContent = c.main;
      if (c.added) { r.clockAdded.textContent = '+' + c.added; r.clockAdded.classList.add('on'); }
    }
    if (r.phaseTag) r.phaseTag.textContent = phaseTag(m, ls);
  }

  // A small, tasteful per-card liveness chip placed in a card header. `get`
  // returns { ms, cadence, label } describing that card's CURRENT data source
  // (it can change live, e.g. SofaScore overlay vs the on-device model), so the
  // chip always reflects where THAT panel's numbers actually came from and how
  // often they refresh. Updated together with the main badge in renderFresh().
  makeFresh(get) {
    const dot = el('span', { class: 'lvx-cf-dot' });
    const t = el('span', { class: 'lvx-cf-t' }, '');
    const wrap = el('span', { class: 'lvx-cf' }, dot, t);
    this.freshNodes.push({ wrap, t, get });
    return wrap;
  }
  paintFresh(node) {
    const info = node.get && node.get();
    const ms = info && info.ms;
    if (!ms) { node.wrap.className = 'lvx-cf idle'; node.t.textContent = '— '; node.wrap.title = info && info.label ? `${info.label}: waiting for first update` : 'waiting'; return; }
    const age = Math.max(0, (Date.now() - ms) / 1000);
    const cadence = (info.cadence || 10);
    node.t.textContent = age < 1.5 ? 'live' : `${Math.round(age)}s`;
    node.wrap.classList.toggle('live', age < cadence + 1);
    node.wrap.classList.toggle('stale', age > cadence * 3 + 2);
    node.wrap.classList.remove('idle');
    node.wrap.title = `${info.label} · refreshes about every ${cadence}s` + (age >= 1.5 ? ` · last ${Math.round(age)}s ago` : ' · just updated');
  }

  startFreshness() { this.timers.push(setInterval(() => this.renderFresh(), CFG.FRESH_MS)); this.renderFresh(); }
  // Honest "how live is this" badge. It tracks the SCORE + CLOCK spine (FIFA),
  // which is re-pulled ~every second while a match is live (eased to ~20s at the
  // HT/FT breaks, when nothing is moving). So when it reads "updated just now"
  // (the last pull landed under a second ago) the score and clock on screen are
  // synced to the source as tightly as the feed allows.
  renderFresh() {
    const r = this.refs; if (!r.freshTxt) return;
    const last = this.lastFifaMs;
    if (!last) { r.freshTxt.textContent = 'connecting…'; return; }
    const ms = Math.max(0, Date.now() - last);
    const s = Math.round(ms / 1000);
    const frozen = FROZEN.has(this.m && this.m.phase);
    r.freshTxt.textContent = ms < 1000 ? 'updated just now' : `updated ${s}s ago`;
    r.fresh.classList.toggle('fresh', ms < 1000);
    r.fresh.classList.toggle('stale', s > (frozen ? 30 : 6));
    r.fresh.title = frozen
      ? 'Paused: score & clock are re-checked about every 20 seconds during the break'
      : 'Live: score & clock refresh from the feed about once a second; the clock then ticks in real time between pulls';
    for (const node of this.freshNodes) { try { this.paintFresh(node); } catch {} }
  }

  renderChips() {
    const r = this.refs, m = this.m;
    const chips = [];
    if (m.minute && this.liveState() === 'live') chips.push(['Clock', m.minute]);
    const att = m.attendance || (this.espn && this.espn.info && this.espn.info.attendance);
    if (att) chips.push(['Attendance', Number(att).toLocaleString('en-US')]);
    const ref = (m.officials.find((o) => /referee/i.test(o.role || '')) || m.officials[0]) || (this.espn && this.espn.info && this.espn.info.officials && this.espn.info.officials[0]);
    if (ref && ref.name) chips.push(['Referee', prettyName(ref.name)]);
    if (m.weather && (m.weather.TemperatureCelsius != null || m.weather.Description)) {
      const w = m.weather; const t = w.TemperatureCelsius != null ? `${Math.round(w.TemperatureCelsius)}°C` : '';
      const d = (w.TypeLocalized && w.TypeLocalized[0] && w.TypeLocalized[0].Description) || w.Description || '';
      chips.push(['Weather', [d, t].filter(Boolean).join(' · ')]);
    }
    if (this.espnEvent && this.espnEvent.broadcast) chips.push(['TV', this.espnEvent.broadcast]);
    if (m.groupName) chips.push(['Group', String(m.groupName).replace(/group/i, '').trim()]);
    r.chips.innerHTML = '';
    for (const [k, v] of chips) r.chips.appendChild(el('div', { class: 'lvx-chip' }, el('span', { class: 'lvx-chip-k' }, k), el('span', { class: 'lvx-chip-v' }, v)));
  }

  // ── win probability ──
  renderWinProb() {
    const r = this.refs, m = this.m;
    if (this.liveState() === 'pre' && !(this.espnEvent && this.espnEvent.odds)) { r.winWrap.style.display = 'none'; return; }
    const prior = this.espnEvent && this.espnEvent.odds ? this.espnEvent.odds : null;
    const wp = an.winProbability({ homeScore: m.home.score ?? 0, awayScore: m.away.score ?? 0, minute: parseMinute(m.minute), phase: m.phase, prior });
    r.winWrap.style.display = '';
    r.winWrap.innerHTML = '';
    const head = el('div', { class: 'lvx-win-h' },
      el('span', {}, 'Win probability'),
      el('span', { class: 'lvx-cardsub' }, this.liveState() === 'pre' ? 'pre-match · from odds' : 'in-play model'));
    r.winWrap.appendChild(head);
    const bar = el('div', { class: 'lvx-win-bar' });
    const seg = (cls, pct, label, color) => {
      const s = el('div', { class: 'lvx-win-seg ' + cls, style: `flex:${Math.max(0.001, pct)};${color ? 'background:' + color : ''}` });
      if (pct >= 0.08) s.appendChild(el('span', {}, Math.round(pct * 100) + '%'));
      s.title = `${label} ${Math.round(pct * 100)}%`;
      return s;
    };
    bar.appendChild(seg('h', wp.home, m.home.code + ' win', 'var(--home)'));
    bar.appendChild(seg('d', wp.draw, 'Draw', null));
    bar.appendChild(seg('a', wp.away, m.away.code + ' win', 'var(--away)'));
    r.winWrap.appendChild(bar);
    r.winWrap.appendChild(el('div', { class: 'lvx-win-legend' },
      el('span', {}, el('i', { style: 'background:var(--home)' }), m.home.code),
      el('span', {}, el('i', { style: 'background:rgba(255,255,255,.34)' }), 'Draw'),
      el('span', {}, el('i', { style: 'background:var(--away)' }), m.away.code)));
  }

  // ── momentum ──
  renderMomentum() {
    const r = this.refs, m = this.m;
    let series = null, src = '';
    if (this.official && this.official.momentum && this.official.momentum.length) { series = this.official.momentum; src = 'SofaScore official'; }
    else { series = an.computeMomentum(this.events, m, parseMinute(m.minute)); src = 'model · from events'; }
    r.momSub.textContent = src;
    r.momentum.innerHTML = '';
    if (!series || series.length < 2) { r.momentum.appendChild(el('div', { class: 'lvx-muted' }, 'Momentum builds once the match is under way.')); return; }
    const W = 1000, H = 150, mid = H / 2;
    const nowMin = parseMinute(m.minute);
    const maxMin = Math.max(nowMin, ...series.map((p) => p.minute), 1);
    const sx = (mn) => (mn / maxMin) * W;
    const sy = (v) => mid - (Math.max(-100, Math.min(100, v)) / 100) * (mid - 8);
    const lastX = sx(series[series.length - 1].minute).toFixed(1);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'lvx-mom-svg' });
    s.appendChild(svg('defs', {}, gradient('lvx-mom-h', 'var(--home)', true), gradient('lvx-mom-a', 'var(--away)', false)));
    // minute gridlines every 15', stronger at the half/full-time marks
    const ticks = [15, 30, 45, 60, 75, 90, 105, 120].filter((t) => t <= maxMin + 0.5);
    for (const t of ticks) s.appendChild(svg('line', { x1: sx(t), x2: sx(t), y1: 0, y2: H, stroke: (t === 45 || t === 90) ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)', 'stroke-width': 1 }));
    s.appendChild(svg('line', { x1: 0, x2: W, y1: mid, y2: mid, stroke: 'rgba(255,255,255,.22)', 'stroke-width': 1 }));
    const top = [`M 0 ${mid}`], bot = [`M 0 ${mid}`];
    for (const p of series) { const x = sx(p.minute).toFixed(1); top.push(`L ${x} ${(p.value > 0 ? sy(p.value) : mid).toFixed(1)}`); bot.push(`L ${x} ${(p.value < 0 ? sy(p.value) : mid).toFixed(1)}`); }
    top.push(`L ${lastX} ${mid} Z`); bot.push(`L ${lastX} ${mid} Z`);
    s.appendChild(svg('path', { d: top.join(' '), fill: 'url(#lvx-mom-h)' }));
    s.appendChild(svg('path', { d: bot.join(' '), fill: 'url(#lvx-mom-a)' }));
    let dl = '';
    series.forEach((p, i) => { dl += `${i ? 'L' : 'M'} ${sx(p.minute).toFixed(1)} ${sy(p.value).toFixed(1)} `; });
    s.appendChild(svg('path', { d: dl, fill: 'none', stroke: 'rgba(255,255,255,.6)', 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke' }));
    r.momentum.appendChild(s);
    // time axis (HTML, positioned by %) — 0', every 15', HT marker, current minute
    const axis = el('div', { class: 'lvx-mom-time' });
    for (const t of [0, ...ticks]) axis.appendChild(el('span', { class: 'lvx-mom-tick' + (t === 45 ? ' ht' : ''), style: `left:${(t / maxMin * 100).toFixed(1)}%` }, t === 0 ? "0'" : t === 45 ? 'HT' : t + "'"));
    if (nowMin && Math.abs(nowMin - 45) > 3 && nowMin < maxMin - 1) axis.appendChild(el('span', { class: 'lvx-mom-tick now', style: `left:${(nowMin / maxMin * 100).toFixed(1)}%` }, nowMin + "'"));
    r.momentum.appendChild(axis);
    r.momentum.appendChild(el('div', { class: 'lvx-mom-ax' },
      el('span', { style: 'color:var(--home)', html: m.home.code + ' ' + icon('arrow-up', { size: 11 }) }),
      el('span', { class: 'lvx-muted' }, 'pressure'),
      el('span', { style: 'color:var(--away)', html: icon('arrow-down', { size: 11 }) + ' ' + m.away.code })));
    function gradient(id, color, isTop) {
      const g = svg('linearGradient', { id, x1: 0, x2: 0, y1: isTop ? 0 : 1, y2: isTop ? 1 : 0 });
      g.appendChild(svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.55 }));
      g.appendChild(svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0.02 }));
      return g;
    }
  }

  // ── pitch / formations ──
  renderPitch() {
    const r = this.refs, m = this.m;
    // Skip the (image-heavy) pitch rebuild unless the line-ups, formation, or the
    // goal/card/sub events actually changed — otherwise the player photos flicker
    // every poll.
    const evSig = this.events.filter((e) => ['goal', 'penalty', 'own_goal', 'yellow', 'red', 'sub'].includes(e.kind)).map((e) => e.id + e.kind).join(',');
    const sig = (m.home.tactics || '') + '|' + (m.away.tactics || '') + '|'
      + startingXI(m.home).map((p) => p.id).join(',') + '|' + startingXI(m.away).map((p) => p.id).join(',') + '|' + evSig;
    if (sig === this._pitchSig) return;
    this._pitchSig = sig;
    r.formTag.textContent = [m.home.tactics, m.away.tactics].filter(Boolean).join('  ·  ');
    r.pitch.innerHTML = '';
    const surface = el('div', { class: 'lvx-grass' });
    surface.appendChild(el('div', { class: 'lvx-midline' }));
    surface.appendChild(el('div', { class: 'lvx-midcircle' }));
    for (const c of ['lvx-box lvx-box-t', 'lvx-box lvx-box-b', 'lvx-six lvx-six-t', 'lvx-six lvx-six-b']) surface.appendChild(el('div', { class: c }));
    this.placeXI(surface, m.away, 'away');
    this.placeXI(surface, m.home, 'home');
    r.pitch.appendChild(surface);
    if (!startingXI(m.home).length && !startingXI(m.away).length)
      r.pitch.appendChild(el('div', { class: 'lvx-pitch-empty' }, 'Line-ups appear when the teams are confirmed (≈1 hour before kick-off).'));
    // subs / bench
    this.renderSubs();
  }
  placeXI(surface, team, which) {
    const xi = startingXI(team); if (!xi.length) return;
    const rows = fifa.parseFormation(team.tactics) || [Math.max(0, xi.length - 1)];
    const pts = lineupPositions(rows, which, xi.length);
    const goalMap = this.goalsByPlayer(), cardMap = this.cardsByPlayer();
    xi.forEach((p, i) => {
      const pos = pts[i] || { x: 0.5, y: which === 'home' ? 0.8 : 0.2 };
      const dot = el('div', { class: 'lvx-pl', style: `left:${(pos.x * 100).toFixed(2)}%;top:${(pos.y * 100).toFixed(2)}%` });
      const link = el('a', { class: 'lvx-pl-link', href: `/wc/player/${encodeURIComponent('name:' + (p.name || p.short))}`, 'data-popup-player': 'name:' + (p.name || p.short) });
      const av = el('div', { class: 'lvx-av' }); av.style.setProperty('--c', 'var(--' + which + ')');
      if (p.photo) { const im = el('img', { class: 'lvx-avimg', src: p.photo, alt: '', loading: 'lazy' }); im.onerror = () => { im.remove(); av.classList.add('lvx-av-no'); av.textContent = p.number != null ? p.number : ''; }; av.appendChild(im); }
      else { av.classList.add('lvx-av-no'); av.textContent = p.number != null ? p.number : ''; }
      const numBadge = p.number != null ? el('span', { class: 'lvx-num' }, String(p.number)) : null;
      if (p.captain) link.appendChild(el('span', { class: 'lvx-cap' }, 'C'));
      const badges = el('div', { class: 'lvx-plbadge' });
      const g = goalMap.get(String(p.id)); if (g) badges.appendChild(el('span', { class: 'lvx-bg lvx-bg-goal', html: icon('circle-dot', { size: 11 }) + (g > 1 ? g : '') }));
      const c = cardMap.get(String(p.id)); if (c) badges.appendChild(el('span', { class: 'lvx-bg lvx-bg-' + c }));
      link.appendChild(av);
      // When there's no photo the number already fills the circle — only add the
      // corner badge over a photo so we never double-print the number.
      if (numBadge && p.photo) link.appendChild(numBadge);
      if (badges.childNodes.length) link.appendChild(badges);
      link.appendChild(el('span', { class: 'lvx-plname' }, lastName(p.name || p.short || '')));
      dot.appendChild(link);
      surface.appendChild(dot);
    });
  }
  renderSubs() {
    const r = this.refs, m = this.m;
    r.subsWrap.innerHTML = '';
    const bench = (team) => team.players.filter((p) => !(p.status === 1 || p.status === '1') && !p.onField);
    let any = false;
    for (const which of ['home', 'away']) {
      const team = m[which]; const bn = bench(team);
      if (!bn.length) continue; any = true;
      const col = el('div', { class: 'lvx-subcol' });
      col.appendChild(el('div', { class: 'lvx-subh', style: 'color:var(--' + which + ')' }, (team.code || '') + ' bench'));
      const list = el('div', { class: 'lvx-sublist' });
      for (const p of bn.slice(0, 12)) list.appendChild(playerLink(p.name || p.short, 'lvx-subchip'));
      col.appendChild(list); r.subsWrap.appendChild(col);
    }
    r.subsWrap.style.display = any ? '' : 'none';
  }
  goalsByPlayer() { const map = new Map(); for (const e of this.events) if ((e.kind === 'goal' || e.kind === 'penalty') && e.playerId) map.set(String(e.playerId), (map.get(String(e.playerId)) || 0) + 1); return map; }
  cardsByPlayer() { const map = new Map(); for (const e of this.events) if (e.kind === 'yellow' || e.kind === 'red') map.set(String(e.playerId), e.kind); return map; }

  // ── stats as a comparative bar chart with average baseline ──
  statRows() {
    const m = this.m;
    const fifaCount = (kind) => { let h = 0, a = 0; for (const e of this.events) { if (e.kind !== kind) continue; if (e.teamId === m.home.id) h++; else if (e.teamId === m.away.id) a++; } return [h, a]; };
    const espnStat = (...keys) => {
      if (!this.espn || !this.espn.stats) return null;
      const hs = this.espn.stats[m.home.code], as = this.espn.stats[m.away.code];
      if (!hs || !as) return null;
      for (const k of keys) { const kk = k.toLowerCase(); if (hs[kk] && as[kk]) return [hs[kk].num, as[kk].num]; }
      // fuzzy contains
      const find = (obj) => { for (const kk of Object.keys(obj)) if (keys.some((k) => kk.includes(k.toLowerCase()))) return obj[kk].num; return null; };
      const h = find(hs), a = find(as); return (h != null && a != null) ? [h, a] : null;
    };
    const sofaStat = (...keys) => {
      if (!this.official || !this.official.stats) return null;
      const o = this.official.stats;
      for (const k of keys) { const kk = k.toLowerCase().replace(/[^a-z]/g, ''); if (o[kk]) { const h = num(o[kk].home), a = num(o[kk].away); if (h != null && a != null) return [h, a]; } }
      return null;
    };
    const pick = (label, key, sofaKeys, espnKeys, fifaKind, isPct) => {
      let pair = sofaStat(...(sofaKeys || [])) || espnStat(...(espnKeys || []));
      let srcd = pair ? (sofaStat(...(sofaKeys || [])) ? 'sofa' : 'espn') : null;
      if (!pair && fifaKind) { pair = fifaCount(fifaKind); srcd = 'fifa'; }
      if (!pair) return null;
      return { label, key, h: pair[0], a: pair[1], isPct, src: srcd };
    };
    const poss = (() => {
      if (m.possession && (m.possession.home != null || m.possession.away != null)) return { label: 'Possession', key: 'possession', h: m.possession.home || 0, a: m.possession.away || 0, isPct: true, src: 'fifa' };
      return pick('Possession', 'possession', ['ballpossession'], ['possessionpct', 'possession'], null, true);
    })();
    const rows = [
      poss,
      pick('Shots', 'shots', ['totalshotsongoal', 'shotstotal', 'totalshots'], ['totalshots', 'shots'], 'shot'),
      pick('Shots on target', 'shotsOnTarget', ['shotsongoal', 'shotsontarget'], ['shotsontarget', 'ontarget'], null),
      this.xgRow(),
      pick('Corners', 'corners', ['cornerkicks', 'corners'], ['woncorners', 'corners'], 'corner'),
      pick('Fouls', 'fouls', ['fouls'], ['foulscommitted', 'fouls'], 'foul'),
      pick('Offsides', 'offsides', ['offsides'], ['offsides'], 'offside'),
      pick('Passes', 'passes', ['passes'], ['totalpasses', 'passes'], null),
      pick('Yellow cards', 'yellow', ['yellowcards'], ['yellowcards'], 'yellow'),
    ].filter(Boolean).filter((r) => r.isPct || r.h || r.a || r.key === 'xg');
    return rows;
  }
  xgRow() {
    const m = this.m;
    if (this.official && this.official.shotmap) return { label: 'Expected goals (xG)', key: 'xg', h: round2(this.official.shotmap.homeXg), a: round2(this.official.shotmap.awayXg), isXg: true, src: 'sofa' };
    const sm = an.computeShotmap(this.events, m);
    if (sm.home.length || sm.away.length) return { label: 'Expected goals (xG)', key: 'xg', h: round2(sm.homeXg), a: round2(sm.awayXg), isXg: true, src: 'model' };
    return null;
  }
  renderStats() {
    const r = this.refs, m = this.m;
    const rows = this.statRows();
    r.statsSub.textContent = this.official && this.official.stats ? 'SofaScore + ESPN + FIFA' : (this.espn && this.espn.stats ? 'ESPN + FIFA official' : 'from official events');
    r.stats.innerHTML = '';
    if (!rows.length) { r.stats.appendChild(el('div', { class: 'lvx-muted' }, 'Stats populate once the match is under way.')); return; }
    const minute = parseMinute(m.minute) || ((this.liveState() === 'ft' || this.liveState() === 'justft') ? 90 : 0);
    // Each row is a centre-diverging graph: bar LENGTH = absolute value on a
    // shared per-row scale, with a dashed tick at the average WC match's value
    // for this minute. So "both teams far above normal" is visible (both bars
    // overshoot their ticks) — exactly what a pure share bar would hide.
    let showedAvg = false;
    for (const row of rows) {
      const h = Number(row.h) || 0, a = Number(row.a) || 0;
      const avg = row.isPct ? 50 : (row.isXg ? an.baselineAt('goals', minute) : an.baselineAt(row.key, minute));
      const scaleMax = row.isPct ? 100 : Math.max(h, a, (avg || 0) * 1.8, 1);
      const frac = (v) => clamp((v / (scaleMax || 1)) * 100, 0, 100);
      const node = el('div', { class: 'lvx-stat' });
      node.appendChild(el('div', { class: 'lvx-stat-top' },
        el('b', { class: 'lvx-stat-h' }, fmtStat(row)),
        el('span', { class: 'lvx-stat-lbl' }, row.label + (row.isXg ? ' · est' : '')),
        el('b', { class: 'lvx-stat-a' }, fmtStat(row, true))));
      const graph = el('div', { class: 'lvx-stat-graph' });
      const lh = el('div', { class: 'lvx-half left' }, el('i', { class: 'fill', style: `width:${frac(h).toFixed(1)}%;background:var(--home)` }));
      const rh = el('div', { class: 'lvx-half right' }, el('i', { class: 'fill', style: `width:${frac(a).toFixed(1)}%;background:var(--away)` }));
      if (avg != null) {
        showedAvg = true;
        const at = frac(avg).toFixed(1);
        lh.appendChild(el('span', { class: 'lvx-avg', style: `right:${at}%`, title: `Average WC match by ${minute}': ≈ ${row.isPct ? '50%' : round1(avg)}` }));
        rh.appendChild(el('span', { class: 'lvx-avg', style: `left:${at}%`, title: `Average WC match by ${minute}': ≈ ${row.isPct ? '50%' : round1(avg)}` }));
      }
      graph.appendChild(lh); graph.appendChild(rh);
      node.appendChild(graph);
      r.stats.appendChild(node);
    }
    if (showedAvg) r.stats.appendChild(el('div', { class: 'lvx-stat-legend' }, el('span', { class: 'lvx-stat-basekey' }), 'dashed line = an average World Cup match at this minute'));
  }

  // ── shotmap ──
  renderShotmap() {
    const r = this.refs, m = this.m;
    const sm = (this.official && this.official.shotmap) || an.computeShotmap(this.events, m);
    const src = (this.official && this.official.shotmap) ? 'SofaScore official' : 'model · FIFA shot coordinates';
    const total = (sm.home.length || 0) + (sm.away.length || 0);
    r.shotSub.textContent = total ? `${m.home.code} ${round2(sm.homeXg)} xG · ${m.away.code} ${round2(sm.awayXg)} xG · ${src}` : 'awaiting shots';
    r.shotmap.innerHTML = '';
    if (!total) { r.shotmap.appendChild(el('div', { class: 'lvx-muted' }, 'Shot map fills in as attempts are taken.')); return; }
    const W = 900, H = 300;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lvx-shot-svg', role: 'img', 'aria-label': 'Shot map' });
    // pitch (vertical halves: home attacks right, away attacks left)
    s.appendChild(svg('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 8, fill: 'none', stroke: 'rgba(190,230,200,.16)' }));
    s.appendChild(svg('line', { x1: W / 2, y1: 1, x2: W / 2, y2: H - 1, stroke: 'rgba(190,230,200,.16)' }));
    s.appendChild(svg('circle', { cx: W / 2, cy: H / 2, r: 40, fill: 'none', stroke: 'rgba(190,230,200,.16)' }));
    s.appendChild(svg('rect', { x: 1, y: H / 2 - 70, width: 80, height: 140, fill: 'none', stroke: 'rgba(190,230,200,.14)' }));
    s.appendChild(svg('rect', { x: W - 81, y: H / 2 - 70, width: 80, height: 140, fill: 'none', stroke: 'rgba(190,230,200,.14)' }));
    const place = (list, side) => {
      list.forEach((sh) => {
        // FIFA PositionX/PositionY are ABSOLUTE pitch coordinates (0-100 along the
        // length / width), NOT attacking-relative — so each team's shots already
        // sit at their real end. Plot them directly (mirroring squished one side).
        let px, py;
        if (sh.x != null && sh.y != null) {
          px = (sh.x / 100) * W; py = (sh.y / 100) * H;
        } else { px = side === 'home' ? W * 0.80 : W * 0.20; py = H * (0.32 + 0.36 * Math.random()); }
        const col = side === 'home' ? 'var(--home)' : 'var(--away)';
        const rad = Math.max(4, Math.min(18, 4 + (sh.xg || 0) * 26));
        const g = svg('g', { class: 'lvx-shotpin' + (sh.goal ? ' goal' : '') });
        g.appendChild(svg('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: rad.toFixed(1), fill: sh.goal ? col : 'none', stroke: col, 'stroke-width': sh.goal ? 0 : 2, 'fill-opacity': sh.goal ? 0.95 : 0.12 }));
        if (sh.goal) g.appendChild(svg('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: (rad + 3).toFixed(1), fill: 'none', stroke: col, 'stroke-opacity': 0.5 }));
        const tt = `${prettyName(sh.player || '')} ${sh.min || ''} · ${round2(sh.xg)} xG${sh.goal ? ' · GOAL' : ''}`;
        g.appendChild(svg('title', {}, tt));
        s.appendChild(g);
      });
    };
    place(sm.away, 'away'); place(sm.home, 'home');
    r.shotmap.appendChild(s);
    r.shotmap.appendChild(el('div', { class: 'lvx-shot-key' },
      el('span', {}, el('i', { class: 'k-o' }), 'attempt'),
      el('span', {}, el('i', { class: 'k-g' }), 'goal'),
      el('span', { class: 'lvx-muted' }, 'bubble size = xG')));
  }

  // ── commentary (ESPN play-by-play; FIFA fallback) ──
  renderCommentary() {
    const r = this.refs, m = this.m;
    let items = (this.espn && this.espn.commentary) ? this.espn.commentary : null;
    let src = 'ESPN play-by-play';
    if (!items || !items.length) { items = this.fifaCommentary(); src = 'from official events'; }
    // Skip rebuild unless the feed changed — keeps it from flickering / resetting
    // your scroll position every poll.
    const csig = (items ? items.length + '~' + (items[0] ? (items[0].seq + items[0].min + (items[0].text || '').slice(0, 18)) : '') : '0');
    if (csig === this._commSig) return;
    this._commSig = csig;
    r.commSub.textContent = items && items.length ? src : 'awaiting kick-off';
    r.commentary.innerHTML = '';
    if (!items || !items.length) { r.commentary.appendChild(el('div', { class: 'lvx-muted' }, 'Live commentary begins at kick-off.')); return; }
    for (const c of items.slice(0, 60)) {
      const id = (c.seq != null ? c.seq : '') + '|' + (c.min || '') + '|' + (c.text || '').slice(0, 24);
      const isNew = !this.seenComments.has(id); this.seenComments.add(id);
      const cls = 'lvx-cm' + (c.isGoal ? ' goal' : c.isCard ? ' card' : c.isSub ? ' sub' : '') + (isNew ? ' lvx-cm-new' : '');
      const row = el('div', { class: cls });
      if (c.min) row.appendChild(el('span', { class: 'lvx-cm-min' }, c.min));
      // Goal / quiet event → Lucide circle-dot; sub → Lucide git-fork; card → CSS
      // colour chip. Every mark comes from lib/icons.js — never a Unicode glyph.
      const icCls = 'lvx-cm-ic' + (c.isCard ? ' card' : '');
      row.appendChild(c.isGoal ? el('span', { class: icCls, html: icon('circle-dot', { size: 12 }) })
        : c.isSub ? el('span', { class: icCls, html: icon('git-fork', { size: 12 }) })
        : el('span', c.isCard ? { class: icCls } : { class: icCls, html: icon('circle-dot', { size: 9 }) }));
      row.appendChild(el('span', { class: 'lvx-cm-tx' }, linkifyNames(c.text, this)));
      r.commentary.appendChild(row);
    }
  }
  fifaCommentary() {
    const m = this.m;
    const out = [];
    for (const e of this.events) {
      let text = '';
      const who = prettyName(e.player || '');
      if (e.kind === 'goal') text = `Goal! ${who} scores${e.homeGoals != null ? ` — ${m.home.code} ${e.homeGoals}-${e.awayGoals} ${m.away.code}` : ''}.`;
      else if (e.kind === 'penalty') text = `Goal from the penalty spot — ${who}.`;
      else if (e.kind === 'own_goal') text = `Own goal — ${who}.`;
      else if (e.kind === 'yellow') text = `Yellow card shown to ${who}.`;
      else if (e.kind === 'red') text = `Red card! ${who} is sent off.`;
      else if (e.kind === 'sub') text = `Substitution made.`;
      else if (e.kind === 'corner') text = `Corner.`;
      else if (e.kind === 'offside') text = `Offside flag against ${who || 'the attacker'}.`;
      else continue;
      out.push({ seq: Number(e.minute) || 0, min: e.minuteLabel, text, isGoal: e.kind === 'goal' || e.kind === 'penalty' || e.kind === 'own_goal', isCard: e.kind === 'yellow' || e.kind === 'red', isSub: e.kind === 'sub' });
    }
    return out;
  }

  // ── key-event timeline ──
  renderTimeline() {
    const r = this.refs, m = this.m;
    const evs = this.events.filter((e) => ['goal', 'penalty', 'own_goal', 'yellow', 'red', 'sub'].includes(e.kind));
    r.timeline.innerHTML = '';
    if (!evs.length) { r.timeline.appendChild(el('div', { class: 'lvx-muted' }, 'Goals, cards and subs appear here.')); return; }
    for (const e of evs) {
      const side = e.teamId === m.home.id ? 'home' : 'away';
      const isNew = !this.seenEvents.has(e.id); this.seenEvents.add(e.id);
      const row = el('div', { class: 'lvx-ev lvx-ev-' + side + (isNew ? ' lvx-ev-new' : '') });
      row.appendChild(el('span', { class: 'lvx-ev-min' }, e.minuteLabel));
      // Goals keep the ball mark, subs use a Lucide swap, cards render as CSS chips.
      row.appendChild(e.kind === 'sub'
        ? el('span', { class: 'lvx-ev-ic lvx-ev-ic-sub', html: icon('git-fork', { size: 13 }) })
        : el('span', { class: 'lvx-ev-ic lvx-ev-ic-' + e.kind, html: eventIcon(e.kind) }));
      row.appendChild(playerLink(e.player, 'lvx-ev-who'));
      if (e.kind === 'goal' || e.kind === 'penalty' || e.kind === 'own_goal') row.appendChild(el('span', { class: 'lvx-ev-sc' }, (e.homeGoals ?? '') + '–' + (e.awayGoals ?? '')));
      row.appendChild(teamLink(side === 'home' ? m.home.code : m.away.code, 'lvx-ev-team', side === 'home' ? m.home.code : m.away.code));
      r.timeline.appendChild(row);
    }
  }

  // Each team's TOURNAMENT top scorers (golden-boot style), with this match's
  // live goals surfaced and badged "today".
  renderScorers() {
    const r = this.refs, m = this.m;
    const liveGoals = this.events.filter((e) => e.kind === 'goal' || e.kind === 'penalty' || e.kind === 'own_goal');
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    r.scorers.innerHTML = '';
    for (const which of ['home', 'away']) {
      const team = m[which];
      const col = el('div', { class: 'lvx-sc-col' });
      col.appendChild(teamLink(team.code, 'lvx-sc-team', team.code));
      const today = liveGoals.filter((g) => (g.kind === 'own_goal' ? (g.teamId === m.home.id ? m.away.id : m.home.id) : g.teamId) === team.id);
      const todayNames = new Set(today.map((g) => norm(g.player)));
      const tour = (this.tourScorers && this.tourScorers[team.code]) || [];
      let any = false;
      for (const g of today) {
        any = true;
        col.appendChild(el('div', { class: 'lvx-sc-row lvx-sc-today' },
          playerLink(g.player || 'Goal', 'lvx-sc-name'),
          el('span', { class: 'lvx-sc-tag' }, g.kind === 'own_goal' ? 'OG' : g.kind === 'penalty' ? 'PEN' : 'today'),
          el('span', { class: 'lvx-sc-min' }, g.minuteLabel)));
      }
      for (const s of tour.slice(0, 6)) {
        if (todayNames.has(norm(s.player))) continue;
        any = true;
        col.appendChild(el('div', { class: 'lvx-sc-row' },
          playerLink(s.player, 'lvx-sc-name'),
          el('span', { class: 'lvx-sc-goals', html: icon('circle-dot', { size: 11 }) + ' ' + s.goals + (s.penalties ? ` (${s.penalties}P)` : '') })));
      }
      if (!any) col.appendChild(el('div', { class: 'lvx-muted' }, 'No goals in the tournament yet.'));
      r.scorers.appendChild(col);
    }
  }

  // ── live group impact (group games) ──
  async loadContext() {
    const m = this.m;
    // group table
    if (m.groupName) this.loadGroup().catch(() => {});
    // h2h + elo + rank + records
    try {
      const [h2h, elo, ranks, recs] = await Promise.all([
        data.getHeadToHead().catch(() => null), data.getEloRatings().catch(() => null),
        data.getFifaRankings().catch(() => null), data.getTeamRecords().catch(() => null),
      ]);
      this.ctxData = { h2h, elo, ranks, recs }; this.renderContext();
    } catch {}
    data.getTournamentScorers().then((ts) => { this.tourScorers = (ts && ts.by_team) || null; this.renderScorers(); }).catch(() => {});
  }
  async loadGroup() {
    try {
      const api = await import('./api.js');
      const [groups, matches] = await Promise.all([api.getGroups().catch(() => null), api.getMatches().catch(() => null)]);
      const letter = String(this.m.groupName).replace(/group/i, '').trim();
      this._groupObj = (groups || []).find((g) => String(g.group_name).replace(/group/i, '').trim() === letter) || { group_name: letter, teams: [] };
      this._allMatches = Array.isArray(matches) ? matches : null;
      this.computeGroup();
    } catch {}
  }
  // Live "if it ended now" table: count finished matches PLUS any in-progress one
  // (using FIFA's fresh score for THIS match), so the standings shift as it plays.
  // Recomputed in-memory each tick — no extra wc2026api budget spent.
  computeGroup() {
    if (!this._allMatches || !this._groupObj) return;
    const liveNum = this.m.matchNumber, hs = this.m.home.score, as = this.m.away.score;
    let prov = false;
    const matches = this._allMatches.map((mm) => {
      if (mm.status === 'live' && mm.home_score != null && mm.away_score != null) {
        prov = true;
        const over = (mm.match_number === liveNum && hs != null && as != null) ? { home_score: hs, away_score: as } : {};
        return { ...mm, ...over, status: 'finished' };
      }
      return mm;
    });
    this.groupProvisional = prov;
    this.groupStandings = data.computeGroupStandings(matches, this._groupObj);
    this.renderGroup();
  }
  renderGroup() {
    const r = this.refs, m = this.m;
    if (!m.groupName || !this.groupStandings || !this.groupStandings.length) { r.groupCard.style.display = 'none'; return; }
    // Skip the rebuild (flag images) unless the table actually changed.
    const sig = (this.groupProvisional ? 'P|' : '') + this.groupStandings.map((x) => `${x.code}:${x.points}:${x.gd}:${x.played}`).join('|');
    if (sig === this._groupSig && r.groupCard.style.display !== 'none') return;
    this._groupSig = sig;
    r.groupCard.style.display = '';
    r.groupSub.textContent = 'Group ' + String(m.groupName).replace(/group/i, '').trim() + (this.groupProvisional ? ' · live, if it ended now' : ' · current');
    const me = new Set([m.home.code, m.away.code]);
    r.group.innerHTML = '';
    r.group.appendChild(el('div', { class: 'lvx-gst-h' }, el('span', {}, '#'), el('span', {}, 'Team'), el('span', {}, 'P'), el('span', {}, 'GD'), el('span', {}, 'Pts')));
    this.groupStandings.forEach((row, i) => {
      const isMe = row.code && me.has(row.code);
      const node = el('div', { class: 'lvx-gst' + (isMe ? ' me' : '') + (i < 2 ? ' q' : '') });
      node.appendChild(el('span', { class: 'lvx-gst-pos' }, String(i + 1)));
      const nm = teamLink(row.code, 'lvx-gst-name', flagImg(row.code, 'lvx-gst-flag'), el('span', {}, row.team || row.code));
      node.appendChild(nm);
      node.appendChild(el('span', { class: 'lvx-gst-c' }, String(row.played ?? 0)));
      const gd = row.gd != null ? row.gd : 0;
      node.appendChild(el('span', { class: 'lvx-gst-c' }, gd > 0 ? '+' + gd : String(gd)));
      node.appendChild(el('span', { class: 'lvx-gst-pts' }, String(row.points ?? 0)));
      r.group.appendChild(node);
    });
  }

  renderContext() {
    const r = this.refs, m = this.m; const cx = this.ctxData; if (!cx) return;
    const hc = m.home.code, ac = m.away.code;
    const cells = [];
    // H2H — head-to-head.json is keyed by the sorted code pair; orient via .pair.
    if (cx.h2h) {
      const key = data.h2hKey(hc, ac); const rec = key && cx.h2h[key];
      if (rec && Array.isArray(rec.pair)) {
        const homeFirst = rec.pair[0] === hc;
        const hw = homeFirst ? rec.first_wins : rec.second_wins;
        const aw = homeFirst ? rec.second_wins : rec.first_wins;
        cells.push(ctxStat('All-time H2H', `${val(hw)} · ${val(rec.draws)} · ${val(aw)}`, `${hc} W — D — ${ac} W${rec.played ? ' · ' + rec.played + ' met' : ''}`));
      }
    }
    if (cx.elo) {
      const he = eloOf(cx.elo, hc), ae = eloOf(cx.elo, ac);
      if (he != null || ae != null) cells.push(ctxStat('Elo rating', `${he ?? '—'} · ${ae ?? '—'}`, `${hc} · ${ac}`));
    }
    if (cx.ranks) {
      const hr = rankOf(cx.ranks, hc), ar = rankOf(cx.ranks, ac);
      if (hr != null || ar != null) cells.push(ctxStat('FIFA rank', `#${hr ?? '—'} · #${ar ?? '—'}`, `${hc} · ${ac} · live`));
    }
    if (cx.recs) {
      const hh = recOf(cx.recs, hc), aa = recOf(cx.recs, ac);
      if (hh) cells.push(ctxStat(hc + ' all-time', hh, 'Won — Drew — Lost'));
      if (aa) cells.push(ctxStat(ac + ' all-time', aa, 'Won — Drew — Lost'));
    }
    if (!cells.length) { r.ctxCard.style.display = 'none'; return; }
    r.ctxCard.style.display = '';
    r.ctx.innerHTML = ''; for (const c of cells) r.ctx.appendChild(c);
    function ctxStat(k, v, sub) { return el('div', { class: 'lvx-ctxcell' }, el('div', { class: 'lvx-ctx-k' }, k), el('div', { class: 'lvx-ctx-v' }, v), el('div', { class: 'lvx-ctx-s' }, sub)); }
    function val(x) { return x == null ? '—' : x; }
    function eloOf(elo, code) { const e = elo[code]; return e && e.current_rating != null ? Math.round(e.current_rating) : null; }
    function rankOf(rk, code) { const e = rk[code]; return e ? (e.live_rank ?? e.official_rank ?? null) : null; }
    function recOf(rc, code) { const e = rc[code]; if (!e || e.wins == null) return null; return `${e.wins}–${e.draws}–${e.losses}`; }
  }

  renderFoot() {
    const r = this.refs;
    r.foot.innerHTML = '';
    const espnOk = !!this.espn, sofaOk = !!(this.official);
    r.foot.appendChild(el('div', { class: 'lvx-srcs' },
      srcChip('FIFA official', 'score · clock · line-ups · timeline', this.lastFifaMs, '~live (≈1s poll)'),
      srcChip('ESPN', 'commentary · box score · odds', this.lastEspnMs, espnOk ? '~10–15s' : 'connecting…'),
      srcChip('SofaScore', 'official xG · momentum', this.lastSofaMs, sofaOk ? '~10s' : 'overlay if reachable')));
    r.foot.appendChild(el('div', { class: 'lvx-prov' }, 'Unofficial fan project — not affiliated with FIFA. xG/momentum are estimates unless an official overlay is shown. Times in ET.'));
    function srcChip(name, what, last, latency) {
      const ok = last != null; const ago = ok ? Math.round((Date.now() - last) / 1000) : null;
      return el('div', { class: 'lvx-src' + (ok ? ' on' : '') },
        el('span', { class: 'lvx-src-dot' }), el('span', { class: 'lvx-src-n' }, name),
        el('span', { class: 'lvx-src-w' }, what), el('span', { class: 'lvx-src-l' }, latency));
    }
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    dismissGoalCelebration();
    document.removeEventListener('visibilitychange', this._vis);
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._onResize);
    }
    // merge-mode cleanup
    if (this._mgOnScroll) window.removeEventListener('scroll', this._mgOnScroll);
    if (this._mgOnResize) window.removeEventListener('resize', this._mgOnResize);
    for (const k of ['mgDock', 'mgFab', 'mgPanel', 'navTint']) {
      const n = this.refs && this.refs[k]; if (n && n.remove) n.remove();
    }
  }

  // ═══ MERGED LIVE (?merge) ════════════════════════════════════════════════════
  // Clean broadcast hero as the first screen; scroll to reveal the detailed grid.
  // The flags + score + ticking clock live in a single FIXED strip that scroll-
  // scrubs up and scales into the nav's left slot (transform/opacity only, so it
  // stays on the compositor). Three "scroll feel" variants and three "what docks"
  // variants are switchable live from the corner ⊙ Animation-lab panel.
  buildMergeSkeleton() {
    const m = this.m;
    const hc = accentFor(m.home.code), ac = accentFor(m.away.code);
    this._hc = hc; this._ac = ac;
    // Detailed page WITHOUT its in-flow hero (the fixed dock replaces it).
    this.buildSkeleton({ noHero: true });
    const r = this.refs;
    const stage = r.stage;
    stage.classList.add('mg-stage');
    r.bg = stage.querySelector('.live-bg2');

    // First-screen reserve + scroll hint (inserted above the status strip).
    const herospace = el('div', { class: 'mg-herospace' });
    r.scrollHint = el('div', { class: 'mg-scrollhint' },
      el('span', {}, 'Scroll for details'),
      el('span', { class: 'mg-scrollhint-ic', html: icon('chevron-down', { size: 22 }) }));
    herospace.appendChild(r.scrollHint);
    stage.insertBefore(herospace, stage.firstChild);

    // The traveling strip — fixed, centered on the first screen, docks into nav.
    const dock = el('div', { class: 'mg-dock' });
    dock.style.setProperty('--home', hc); dock.style.setProperty('--away', ac);
    const inner = el('div', { class: 'mg-dockinner' });
    const blk = el('div', { class: 'lvx-hero mg-dockblk' });
    r.homeSide = this.teamColumn('home'); r.awaySide = this.teamColumn('away');
    const mid = el('div', { class: 'lvx-heromid' });
    r.mgLive = el('div', { class: 'mg-live' }, el('span', { class: 'mg-live-dot' }), el('span', {}, 'LIVE'));
    r.score = el('div', { class: 'lvx-score', 'aria-live': 'polite', 'aria-atomic': 'true' });
    r.clockWrap = el('div', { class: 'lvx-clockwrap' });
    r.clock = el('div', { class: 'lvx-clock' });
    r.clockMain = el('span', { class: 'lvx-clock-main' }, '0:00');
    r.clockAdded = el('span', { class: 'lvx-clock-added' });
    r.clock.appendChild(r.clockMain); r.clock.appendChild(r.clockAdded);
    r.phaseTag = el('div', { class: 'lvx-phasetag' });
    r.clockWrap.appendChild(r.clock); r.clockWrap.appendChild(r.phaseTag);
    mid.appendChild(r.mgLive); mid.appendChild(r.score); mid.appendChild(r.clockWrap);
    blk.appendChild(r.homeSide.node); blk.appendChild(mid); blk.appendChild(r.awaySide.node);
    r.goalFlash = el('div', { class: 'lvx-goalflash' }, 'GOAL'); blk.appendChild(r.goalFlash);
    inner.appendChild(blk); dock.appendChild(inner);
    document.body.appendChild(dock);
    r.mgDock = dock; r.mgDockInner = inner; r.mgDockBlk = blk;

    // Team-colour underline bar in the nav (used by the "+ LIVE tint" variant).
    const nav = document.getElementById('wc-nav');
    if (nav) {
      r.navTint = el('div', { class: 'mg-navtint' });
      r.navTint.style.background = `linear-gradient(90deg, ${hc}, ${ac})`;
      nav.appendChild(r.navTint);
    }

    this.readMergePrefs();
    this.buildAnimLab();
  }

  readMergePrefs() {
    const g = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
    this.mgFeel = g('wc_merge_feel', 'scrub');      // scrub | snap | settle
    this.mgDockMode = g('wc_merge_dock', 'A');      // A flags+score | B +LIVE tint | C score only
    this.mgRangePct = Number(g('wc_merge_range', '62')) || 62;
    this._reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  persistMerge(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }
  resetDock() {
    this._measured = null; this._snapState = -1; this._settled = false;
    if (this.refs.mgDockInner) this.refs.mgDockInner.classList.remove('mg-anim');
    if (this._mgOnScroll) this._mgOnScroll();
  }

  startDockScroll() {
    const inner = this.refs.mgDockInner;
    if (!inner) return;
    this._measured = null; this._snapState = -1; this._settled = false; this._mgTick = false;

    const measure = () => {
      const prevTr = inner.style.transform, prevTs = inner.style.transition;
      inner.style.transition = 'none'; inner.style.transform = 'none';
      inner.classList.remove('mg-anim');
      const ir = inner.getBoundingClientRect();
      const nav = document.getElementById('wc-nav');
      const navR = nav ? nav.getBoundingClientRect() : { height: 66 };
      const small = window.innerWidth <= 760;
      const padL = small ? 16 : 28;
      const targetH = small ? 34 : 48;
      const scale = Math.max(0.1, targetH / Math.max(1, ir.height));
      const targetCx = padL + (ir.width * scale) / 2;
      const targetCy = (navR.height || 66) / 2;
      this._measured = {
        tx: targetCx - (ir.left + ir.width / 2),
        ty: targetCy - (ir.top + ir.height / 2),
        scale,
      };
      inner.style.transform = prevTr; inner.style.transition = prevTs;
    };

    const frame = () => {
      this._mgTick = false;
      if (!this.refs.mgDock || !this.refs.mgDock.isConnected) return;
      if (!this._measured) measure();
      const vh = window.innerHeight || 800;
      const range = Math.max(120, vh * (this.mgRangePct / 100));
      const y = window.scrollY || window.pageYOffset || 0;
      const p = Math.min(1, Math.max(0, y / range));
      if (this._reduced) { this.applyDock(y > range * 0.4 ? 1 : 0, false); return; }
      if (this.mgFeel === 'snap') {
        const target = y > range * 0.45 ? 1 : 0;
        if (target !== this._snapState) { this._snapState = target; inner.classList.add('mg-anim'); this.applyDock(target, true); }
        return;
      }
      inner.classList.remove('mg-anim');
      this.applyDock(p, false);
      if (this.mgFeel === 'settle') {
        if (p >= 0.999 && !this._settled) { this._settled = true; this._playSettle(); }
        if (p < 0.9) this._settled = false;
      }
    };

    this._mgFrame = frame;
    this._mgOnScroll = () => { if (this._mgTick) return; this._mgTick = true; requestAnimationFrame(frame); };
    this._mgOnResize = () => { this._measured = null; this._mgOnScroll(); };
    window.addEventListener('scroll', this._mgOnScroll, { passive: true });
    window.addEventListener('resize', this._mgOnResize, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this._measured = null; this._mgOnScroll(); }).catch(() => {});
    requestAnimationFrame(() => { measure(); frame(); });
  }

  _playSettle() {
    const blk = this.refs.mgDockBlk; if (!blk) return;
    blk.classList.remove('mg-settled'); void blk.offsetWidth; blk.classList.add('mg-settled');
    setTimeout(() => { if (blk) blk.classList.remove('mg-settled'); }, 520);
  }

  applyDock(p, animate) {
    const m = this._measured, r = this.refs; if (!m || !r.mgDockInner) return;
    const s = 1 - p * (1 - m.scale);
    r.mgDockInner.style.transform = `translate3d(${(p * m.tx).toFixed(1)}px, ${(p * m.ty).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    const mode = this.mgDockMode;
    const floor = mode === 'B' ? 0.18 : 0;
    if (r.bg) {
      r.bg.style.transition = animate ? 'opacity .5s cubic-bezier(.34,1.25,.4,1)' : 'none';
      r.bg.style.opacity = (floor + (1 - floor) * (1 - p)).toFixed(3);
    }
    if (r.edgeH) r.edgeH.style.opacity = (0.1 * (1 - p)).toFixed(3);
    if (r.edgeA) r.edgeA.style.opacity = (0.1 * (1 - p)).toFixed(3);
    // what docks
    const flagFade = mode === 'C' ? Math.max(0, 1 - Math.max(0, p - 0.4) / 0.4) : 1;
    if (r.homeSide && r.homeSide.flagBox) r.homeSide.flagBox.style.opacity = flagFade;
    if (r.awaySide && r.awaySide.flagBox) r.awaySide.flagBox.style.opacity = flagFade;
    if (r.mgLive) r.mgLive.style.display = mode === 'B' ? 'inline-flex' : 'none';
    if (r.navTint) r.navTint.style.opacity = (mode === 'B' ? p : 0).toFixed(3);
    if (r.scrollHint) r.scrollHint.style.opacity = Math.max(0, 1 - p * 2.4).toFixed(3);
  }

  buildAnimLab() {
    injectSimStyles();
    const self = this;
    const fab = el('button', { class: 'gcsim-fab mg-fab', type: 'button', title: 'Animation lab', 'aria-label': 'Animation lab' });
    const panel = el('div', { class: 'gcsim-panel mg-labpanel' });
    const segGroup = (labels, vals, getCur, onPick) => {
      const wrap = el('div', { class: 'gcsim-segwrap mg-segwrap' });
      const btns = [];
      vals.forEach((v, i) => {
        const b = el('button', { class: 'gcsim-seg' + (v === getCur() ? ' gcsim-seg-on' : ''), type: 'button' }, labels[i]);
        b.addEventListener('click', () => { onPick(v); btns.forEach((bb, j) => bb.classList.toggle('gcsim-seg-on', vals[j] === v)); });
        btns.push(b); wrap.appendChild(b);
      });
      return wrap;
    };
    panel.appendChild(el('div', { class: 'gcsim-head' },
      el('span', { class: 'gcsim-title' }, 'Animation lab'),
      el('button', { class: 'gcsim-x', type: 'button', onclick: () => panel.classList.remove('open') }, '✕')));
    panel.appendChild(el('div', { class: 'gcsim-sec' }, 'Scroll feel'));
    panel.appendChild(segGroup(['Scrub', 'Snap', 'Settle'], ['scrub', 'snap', 'settle'],
      () => self.mgFeel, (v) => { self.mgFeel = v; self.persistMerge('wc_merge_feel', v); self.resetDock(); }));
    panel.appendChild(el('div', { class: 'gcsim-sec' }, 'What docks into the nav'));
    panel.appendChild(segGroup(['Flags + score', '+ LIVE tint', 'Score only'], ['A', 'B', 'C'],
      () => self.mgDockMode, (v) => { self.mgDockMode = v; self.persistMerge('wc_merge_dock', v); self.resetDock(); }));
    panel.appendChild(el('div', { class: 'gcsim-sec' }, 'Dock distance (scroll)'));
    const rangeRow = el('div', { class: 'gcsim-rowflex', style: 'align-items:center' });
    const rng = el('input', { class: 'mg-range', type: 'range', min: '35', max: '100', step: '1', value: String(self.mgRangePct) });
    const out = el('span', { class: 'gcsim-readout', style: 'flex:0 0 50px;margin:0;padding:6px 0' }, self.mgRangePct + '%');
    rng.addEventListener('input', () => { self.mgRangePct = Number(rng.value); out.textContent = rng.value + '%'; self.persistMerge('wc_merge_range', rng.value); self.resetDock(); });
    rangeRow.appendChild(rng); rangeRow.appendChild(out);
    panel.appendChild(rangeRow);
    panel.appendChild(el('div', { class: 'gcsim-hint' }, 'Live data · scroll to send the score into the nav.'));
    fab.addEventListener('click', () => panel.classList.toggle('open'));
    document.body.appendChild(fab); document.body.appendChild(panel);
    this.refs.mgFab = fab; this.refs.mgPanel = panel;
  }
}

// ─── SANDBOX / SIMULATOR  (/wc/live?sim) ─────────────────────────────────────
// A network-free clean-view live page you can drive by hand to preview a real
// match: pick the two teams, run/stop/set the clock, set the phase, and trigger
// a goal for either side — which fires the EXACT same broadcast celebration a
// real goal does (lib/goal-celebration.js). Nothing here touches the live APIs.
function injectSimStyles() {
  if (document.getElementById('gcsim-css')) return;
  const css = `
.gcsim-fab{position:fixed;top:14px;left:14px;z-index:2147482000;width:30px;height:30px;border-radius:50%;background:#fff;border:2.5px solid #111;cursor:pointer;padding:0;box-shadow:0 4px 14px rgba(0,0,0,.45);transition:transform .15s ease}
.gcsim-fab:hover{transform:scale(1.09)} .gcsim-fab:active{transform:scale(.94)}
.gcsim-fab::before{content:"";position:absolute;inset:0;margin:auto;width:13px;height:13px;border-radius:50%;border:2.5px solid #111}
.gcsim-panel{position:fixed;top:52px;left:14px;z-index:2147482001;width:300px;max-width:calc(100vw - 28px);max-height:calc(100vh - 66px);overflow:auto;background:rgba(13,15,21,.97);color:#e9eef5;border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.65);padding:12px 13px 14px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.3;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);display:none}
.gcsim-panel.open{display:block;animation:gcsimin .16s ease-out}
@keyframes gcsimin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.gcsim-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.gcsim-title{font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:11.5px;color:#fff}
.gcsim-x{background:none;border:none;color:#aeb6c2;font-size:15px;cursor:pointer;padding:2px 6px;border-radius:8px;line-height:1}
.gcsim-x:hover{background:rgba(255,255,255,.08);color:#fff}
.gcsim-row{display:flex;align-items:center;gap:8px;margin:6px 0}
.gcsim-lbl{flex:0 0 46px;color:#9aa3b2;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.gcsim-sel,.gcsim-inp{flex:1;min-width:0;background:#1a1e27;color:#e9eef5;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:7px 9px;font-size:13px;font-family:inherit}
.gcsim-inp-min{flex:0 0 66px;width:66px}
.gcsim-sec{margin:11px 0 3px;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7b8494}
.gcsim-segwrap{display:flex;align-items:center;gap:6px;margin:6px 0}
.gcsim-seg{flex:1;background:#1a1e27;color:#cfd6e2;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:7px 0;font-size:12px;font-weight:700;cursor:pointer;text-align:center}
.gcsim-seg-on{background:#2d6cf6;border-color:#2d6cf6;color:#fff}
.gcsim-rowflex{display:flex;gap:6px;margin:6px 0}
.gcsim-go{flex:1;background:#16a34a;border:none;color:#fff;font-weight:800;font-size:13px;letter-spacing:.03em;border-radius:10px;padding:9px 10px;cursor:pointer;box-shadow:0 4px 14px rgba(22,163,74,.35)}
.gcsim-go:hover{filter:brightness(1.08)} .gcsim-go:active{transform:scale(.98)}
.gcsim-btn{background:#1a1e27;color:#e9eef5;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer;flex:1;text-align:center}
.gcsim-btn:hover{background:#222734}
.gcsim-btn-wide{width:100%;margin-top:9px;flex:none}
.gcsim-readout{font-variant-numeric:tabular-nums;background:#0f1420;border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:7px 10px;margin:3px 0 6px;color:#dfe6f0;font-weight:700;letter-spacing:.02em;text-align:center}
.gcsim-hint{color:#7b8494;font-size:10.5px;margin-top:9px;text-align:center}`;
  document.head.appendChild(el('style', { id: 'gcsim-css', html: css }));
}

class SimController extends LiveController {
  constructor(root, opts = {}) {
    // ?sim → clean broadcast view (default); ?sim=detail → full detailed view
    super(root, 'sim', { clean: !opts.forceDetail });
    this.sim = true;
    this.simSec = 0;
    this.simRunning = false;
    this.simGoalSeq = 0;
    this._autoPhase = true;
    this._sideSel = 'home';
  }

  buildSimMatch(homeCode, awayCode) {
    const nm = (c) => (this.simTeams && this.simTeams[c]) || c;
    const team = (code, id) => ({ id, code, name: nm(code), abbr: code, score: 0, tactics: '', players: [] });
    return {
      source: 'sim', idMatch: 'sim', matchNumber: 0, groupName: '', stageName: 'Sandbox match',
      status: 'live', phase: '1H', minute: "0'",
      home: team(homeCode, 'H'), away: team(awayCode, 'A'),
      homePen: null, awayPen: null, stadium: '', city: '', date: new Date().toISOString(),
    };
  }

  async start() {
    this.simTeams = {};
    let teams = [];
    try { teams = await data.getTeams48(); } catch {}
    for (const t of teams) this.simTeams[t.fifa_code] = t.name;
    this.simTeamList = teams.map((t) => ({ code: t.fifa_code, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
    if (!this.simTeamList.length) { // hard fallback so the sandbox still opens
      this.simTeamList = [{ code: 'BRA', name: 'Brazil' }, { code: 'ARG', name: 'Argentina' }];
      this.simTeams = { BRA: 'Brazil', ARG: 'Argentina' };
    }

    this.homeCode = this.simTeams['BRA'] ? 'BRA' : this.simTeamList[0].code;
    this.awayCode = this.simTeams['ARG'] ? 'ARG' : (this.simTeamList[1] || this.simTeamList[0]).code;
    this.m = this.buildSimMatch(this.homeCode, this.awayCode);
    this.events = [];
    this._gHs = 0; this._gAs = 0; this.prevScore = '0-0';

    if (this.clean) {
      this.buildCleanSkeleton();
      this._stripChrome();
    } else {
      // Detail sim: inject the full nav shell so the page looks like the real
      // live page, then build the detailed skeleton.
      try { injectShell({ active: 'live', subtitle: 'Sim' }); } catch {}
      this.buildSkeleton();
    }
    this.fullRender({ initial: true });

    this._simLast = performance.now();
    this.timers.push(setInterval(() => this.simTick(), 200));
    this.buildPanel();
    revealNow();
    return this;
  }

  // The sandbox owns the clock — never the FIFA/ESPN machinery.
  computeClockSec() { return this.simSec; }
  _persistClock() {}
  startFreshness() {}
  startClock() {}
  pollFifa() {} pollEspn() {} pollSofa() {}

  // The clean top-bar's freshness chip + view toggle are meaningless here.
  _stripChrome() {
    try { this.root.querySelectorAll('.live-vt, .cv-fresh').forEach((n) => n.remove()); } catch {}
  }

  simTick() {
    if (!this.root.isConnected) return this.stop();
    const now = performance.now();
    const dt = (now - (this._simLast || now)) / 1000; this._simLast = now;
    if (this.simRunning) { this.simSec += dt; this.applyClockToMatch(); }
    this.renderClock();
    this.refreshPanel();
  }
  applyClockToMatch() {
    const min = Math.floor(this.simSec / 60);
    this.m.minute = min + "'";
    if (this._autoPhase) this.m.phase = min < 45 ? '1H' : '2H';
  }

  setTeam(side, code) {
    if (side === 'home') this.homeCode = code; else this.awayCode = code;
    if (this._onResize) { window.removeEventListener('resize', this._onResize); if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._onResize); }
    this.m = this.buildSimMatch(this.homeCode, this.awayCode);
    this.events = []; this._gHs = 0; this._gAs = 0; this.prevScore = '0-0';
    this.applyClockToMatch();
    if (this.clean) { this.buildCleanSkeleton(); this._stripChrome(); }
    else { this.buildSkeleton(); }
    this.fullRender({ initial: true });   // initial → no celebration on a team swap
    this.refreshPanel();
  }
  triggerGoal(side, scorer, minuteStr) {
    const team = side === 'home' ? this.m.home : this.m.away;
    let minute = parseInt(minuteStr, 10);
    if (!Number.isFinite(minute)) minute = Math.floor(this.simSec / 60);
    const maxMin = (this.events || []).reduce((mx, e) => Math.max(mx, parseMinute(e.minuteLabel || e.minute)), 0);
    if (minute < maxMin) minute = maxMin;   // keep this the latest event so the scorer resolves
    team.score = (team.score || 0) + 1;
    this.simGoalSeq++;
    this.events.unshift({
      id: 'sim' + this.simGoalSeq, kind: 'goal', label: 'goal', teamId: team.id,
      player: (scorer || '').trim(), playerId: null, minute, minuteLabel: minute + "'",
      homeGoals: this.m.home.score, awayGoals: this.m.away.score, x: null, y: null,
    });
    this.fullRender({});                    // not initial → celebrateGoalCheck fires the celebration
    this.refreshPanel();
  }
  startSimClock() { this.simRunning = true; this._simLast = performance.now(); }
  stopSimClock() { this.simRunning = false; }
  resetSimClock() { this.simSec = 0; this.applyClockToMatch(); this.renderClock(); }
  setSimClock(min) { const v = parseInt(min, 10); if (Number.isFinite(v)) { this.simSec = Math.max(0, v) * 60; this.applyClockToMatch(); this.renderClock(); } }
  setPhase(ph) { this._autoPhase = (ph === 'auto'); if (!this._autoPhase) { this.m.phase = ph; this.m.status = (ph === 'FT' || ph === 'FT_PEN') ? 'finished' : 'live'; } else { this.m.status = 'live'; this.applyClockToMatch(); } this.renderClock(); }
  resetScore() { this.m.home.score = 0; this.m.away.score = 0; this.events = []; this._gHs = 0; this._gAs = 0; this.prevScore = '0-0'; this.fullRender({ initial: true }); this.refreshPanel(); }

  stop() {
    super.stop();
    if (this._panelRoot && this._panelRoot.parentNode) this._panelRoot.parentNode.removeChild(this._panelRoot);
  }

  buildPanel() {
    injectSimStyles();
    const row = (label, ctrl) => el('div', { class: 'gcsim-row' }, el('span', { class: 'gcsim-lbl' }, label), ctrl);
    const sec = (t) => el('div', { class: 'gcsim-sec' }, t);
    const opts = () => this.simTeamList.map((o) => el('option', { value: o.code }, o.name));

    const panel = el('div', { class: 'gcsim-panel' });
    this._panel = panel;
    const fab = el('button', { class: 'gcsim-fab', type: 'button', title: 'Match sandbox', 'aria-label': 'Open match sandbox',
      onclick: () => panel.classList.toggle('open') });

    const homeSel = el('select', { class: 'gcsim-sel', onchange: (e) => this.setTeam('home', e.target.value) }, opts());
    const awaySel = el('select', { class: 'gcsim-sel', onchange: (e) => this.setTeam('away', e.target.value) }, opts());
    homeSel.value = this.homeCode; awaySel.value = this.awayCode;
    this._homeSel = homeSel; this._awaySel = awaySel;

    const sideHome = el('button', { class: 'gcsim-seg gcsim-seg-on', type: 'button' }, 'Home');
    const sideAway = el('button', { class: 'gcsim-seg', type: 'button' }, 'Away');
    const setSide = (s) => { this._sideSel = s; sideHome.classList.toggle('gcsim-seg-on', s === 'home'); sideAway.classList.toggle('gcsim-seg-on', s === 'away'); };
    sideHome.addEventListener('click', () => setSide('home'));
    sideAway.addEventListener('click', () => setSide('away'));

    const scorer = el('input', { class: 'gcsim-inp', type: 'text', placeholder: 'Scorer name (optional)' });
    const goalMin = el('input', { class: 'gcsim-inp gcsim-inp-min', type: 'number', min: '0', max: '130', placeholder: 'min' });
    const goalBtn = el('button', { class: 'gcsim-go', type: 'button', onclick: () => this.triggerGoal(this._sideSel, scorer.value, goalMin.value) }, '⚽  Trigger goal');

    const startBtn = el('button', { class: 'gcsim-btn', type: 'button', onclick: () => { this.startSimClock(); this.refreshPanel(); } }, '▶ Start');
    const stopBtn = el('button', { class: 'gcsim-btn', type: 'button', onclick: () => { this.stopSimClock(); this.refreshPanel(); } }, '■ Stop');
    const resetClkBtn = el('button', { class: 'gcsim-btn', type: 'button', onclick: () => { this.resetSimClock(); this.refreshPanel(); } }, '↺ Reset');
    const setMin = el('input', { class: 'gcsim-inp gcsim-inp-min', type: 'number', min: '0', max: '130', placeholder: 'min' });
    const setBtn = el('button', { class: 'gcsim-btn', type: 'button', onclick: () => { this.setSimClock(setMin.value); this.refreshPanel(); } }, 'Set clock');
    const phaseSel = el('select', { class: 'gcsim-sel', onchange: (e) => this.setPhase(e.target.value) },
      el('option', { value: 'auto' }, 'Auto (1H / 2H)'), el('option', { value: '1H' }, '1st half'),
      el('option', { value: 'HT' }, 'Half time'), el('option', { value: '2H' }, '2nd half'), el('option', { value: 'FT' }, 'Full time'));

    const resetScoreBtn = el('button', { class: 'gcsim-btn gcsim-btn-wide', type: 'button', onclick: () => this.resetScore() }, 'Reset score 0–0');
    this._readout = el('div', { class: 'gcsim-readout' }, '—');

    panel.appendChild(el('div', { class: 'gcsim-head' },
      el('span', { class: 'gcsim-title' }, 'Match sandbox'),
      el('button', { class: 'gcsim-x', type: 'button', title: 'Close', onclick: () => panel.classList.remove('open') }, '✕')));
    panel.appendChild(row('Home', homeSel));
    panel.appendChild(row('Away', awaySel));
    panel.appendChild(sec('Goal'));
    panel.appendChild(el('div', { class: 'gcsim-segwrap' }, el('span', { class: 'gcsim-lbl' }, 'Scores'), sideHome, sideAway));
    panel.appendChild(el('div', { class: 'gcsim-rowflex' }, scorer));
    panel.appendChild(el('div', { class: 'gcsim-rowflex' }, goalMin, goalBtn));
    panel.appendChild(sec('Clock'));
    panel.appendChild(this._readout);
    panel.appendChild(el('div', { class: 'gcsim-rowflex' }, startBtn, stopBtn, resetClkBtn));
    panel.appendChild(el('div', { class: 'gcsim-rowflex' }, setMin, setBtn));
    panel.appendChild(row('Phase', phaseSel));
    panel.appendChild(resetScoreBtn);
    panel.appendChild(el('div', { class: 'gcsim-hint' }, 'Tip: leave the minute blank to use the clock. Esc closes a celebration.'));

    const rootEl = el('div'); rootEl.appendChild(fab); rootEl.appendChild(panel);
    this._panelRoot = rootEl;
    document.body.appendChild(rootEl);
    this.refreshPanel();
  }
  refreshPanel() {
    if (!this._readout) return;
    const m = this.m;
    const mm = Math.floor(this.simSec / 60), ss = Math.floor(this.simSec % 60);
    this._readout.textContent = `${m.home.code}  ${m.home.score} – ${m.away.score}  ${m.away.code}    ·    ${mm}:${String(ss).padStart(2, '0')}  ·  ${this.simRunning ? 'running' : 'paused'}`;
    if (this._homeSel && this._homeSel.value !== this.homeCode) this._homeSel.value = this.homeCode;
    if (this._awaySel && this._awaySel.value !== this.awayCode) this._awaySel.value = this.awayCode;
  }
}

// ─── picker (overlapping live games) ───────────────────────────────────────────
async function renderPicker(root, active) {
  root.innerHTML = '';
  const _qp = new URLSearchParams(location.search);
  const _mergeSuffix = (_qp.get('merge') != null || _qp.get('view') === 'merge') ? '&merge' : '';
  const stage = el('div', { class: 'lvx-stage lvx-pick' });
  stage.appendChild(el('div', { class: 'lvx-pick-kicker', 'data-reveal': '' }, `${active.length} matches are live right now`));
  stage.appendChild(el('div', { class: 'lvx-pick-sub', 'data-reveal': '' }, 'Pick the one you want to follow.'));
  const list = el('div', { class: 'lvx-pick-list', 'data-reveal': '' });
  let remember = false;
  const resolved = await Promise.all(active.map(async (rrow) => ({ row: rrow, b: await matchBrief(rrow.IdMatch, rrow.MatchNumber) })));
  for (const { row, b } of resolved) {
    const hc = b.home || teamCodeOf(row, 'home'), ac = b.away || teamCodeOf(row, 'away');
    const card = el('button', { class: 'lvx-pick-card', type: 'button', onclick: () => {
      if (remember) { try { localStorage.setItem('wc_live_default', String(row.MatchNumber)); } catch {} }
      location.href = '/wc/live?m=' + row.MatchNumber + _mergeSuffix;
    } });
    card.appendChild(el('div', { class: 'lvx-pick-team' }, flagImg(hc, 'lvx-pick-flag'), el('span', { class: 'lvx-pick-code' }, hc || '—')));
    const mid = el('div', { class: 'lvx-pick-mid' });
    const sc = (b.hs != null && b.as != null) ? `${b.hs}–${b.as}` : null;
    mid.appendChild(el('div', { class: 'lvx-pick-score' }, sc != null ? sc : 'vs'));
    mid.appendChild(el('div', { class: 'lvx-pick-min' }, b.status === 'finished' ? 'Full time' : (b.minute || 'Live')));
    card.appendChild(mid);
    card.appendChild(el('div', { class: 'lvx-pick-team' }, flagImg(ac, 'lvx-pick-flag'), el('span', { class: 'lvx-pick-code' }, ac || '—')));
    list.appendChild(card);
  }
  stage.appendChild(list);
  const remRow = el('label', { class: 'lvx-pick-remember', 'data-reveal': '' });
  const cb = el('input', { type: 'checkbox' }); cb.addEventListener('change', () => { remember = cb.checked; });
  remRow.appendChild(cb); remRow.appendChild(el('span', {}, 'Remember my pick as the default when several matches are live'));
  stage.appendChild(remRow);
  stage.appendChild(el('a', { class: 'lvx-empty-link', href: '/wc/fixtures', 'data-reveal': '' }, 'View all fixtures →'));
  root.appendChild(stage);
  revealNow();
}

// ─── empty / countdown ─────────────────────────────────────────────────────────
async function renderEmpty(root) {
  root.innerHTML = '';
  const stage = el('div', { class: 'lvx-stage lvx-empty' });
  stage.appendChild(el('div', { class: 'lvx-statusbar', 'data-reveal': '' },
    el('button', { class: 'lvx-back', type: 'button', onclick: () => location.href = '/wc/fixtures' }, el('span', { class: 'lvx-back-ic', html: icon('arrow-left', { size: 15 }) }), el('span', { class: 'lvx-back-lbl' }, 'Fixtures')),
    el('div', { class: 'lvx-livepill is-pre' }, el('span', { class: 'lvx-dot' }), el('span', {}, 'NO MATCH LIVE')),
    el('div', { class: 'lvx-sb-spacer' })));

  let rows = [];
  try { rows = await fifa.getCalendar({ count: 200 }); } catch {}
  const now = Date.now();
  const upcoming = rows.filter((r) => fifa.statusFromCode(r.MatchStatus) !== 'finished' && Date.parse(r.Date) > now - 2 * 3600e3).sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date));
  const recent = rows.filter((r) => fifa.statusFromCode(r.MatchStatus) === 'finished').sort((a, b) => Date.parse(b.Date) - Date.parse(a.Date)).slice(0, 4);
  const next = upcoming[0];
  const nextTime = next ? Date.parse(next.Date) : null;
  // every match sharing the next kick-off slot, so simultaneous kickoffs all show
  const slot = next ? upcoming.filter((r) => Math.abs(Date.parse(r.Date) - nextTime) < 90000) : [];
  let forecast = null;
  try { const fc = await import('./forecast-client.js'); forecast = await fc.getForecast(); } catch {}
  const stakeChips = (hc, ac, mn) => {
    if (!forecast || !mn || Number(mn) > 72) return null;
    const th = forecast.teams[hc], ta = forecast.teams[ac];
    const pctTxt = (q) => q >= 0.9995 ? el('span', { class: 'thru-ic', html: icon('check', { size: 11 }) }) : document.createTextNode(q <= 0.0005 ? 'out' : `${Math.min(99, Math.max(1, Math.round(q * 100)))}%`);
    const chip = (code, t) => t ? el('span', { class: 'lvx-stk-chip' + (t.qualify >= 0.9995 ? ' thru' : t.qualify <= 0.0005 ? ' out' : '') }, `${code} `, pctTxt(t.qualify)) : null;
    const a = chip(hc, th), b = chip(ac, ta);
    if (!a && !b) return null;
    const w = el('div', { class: 'lvx-stk' }, el('span', { class: 'lvx-stk-lbl' }, 'To advance'));
    if (a) w.appendChild(a); if (b) w.appendChild(b);
    return w;
  };

  const card = el('div', { class: 'lvx-empty-card', 'data-reveal': '' });
  card.appendChild(el('div', { class: 'lvx-empty-kicker' }, 'No match is being played right now'));
  if (next) {
    const resolved = await Promise.all(slot.map(async (r) => ({ r, t: await teamsFor(r.IdMatch) })));
    const hc0 = resolved[0].t && resolved[0].t.home.code, ac0 = resolved[0].t && resolved[0].t.away.code;
    if (hc0) stage.style.setProperty('--home', accentFor(hc0));
    if (ac0) stage.style.setProperty('--away', accentFor(ac0));
    card.appendChild(el('div', { class: 'lvx-empty-next' }, slot.length > 1 ? `NEXT KICK-OFF · ${slot.length} MATCHES` : 'NEXT KICK-OFF'));
    if (slot.length === 1) {
      const mu = el('div', { class: 'lvx-empty-mu' });
      mu.appendChild(teamLink(hc0, 'lvx-empty-team', flagImg(hc0, 'lvx-empty-flag'), el('span', { style: 'color:var(--home)' }, hc0 || '')));
      mu.appendChild(el('div', { class: 'lvx-empty-vs' }, 'v'));
      mu.appendChild(teamLink(ac0, 'lvx-empty-team', flagImg(ac0, 'lvx-empty-flag'), el('span', { style: 'color:var(--away)' }, ac0 || '')));
      card.appendChild(mu);
      const sc = stakeChips(hc0, ac0, resolved[0].r.MatchNumber); if (sc) card.appendChild(sc);
    } else {
      const multi = el('div', { class: 'lvx-empty-multi' });
      for (const { r, t } of resolved) {
        const hc = t && t.home.code, ac = t && t.away.code;
        const row = el('div', { class: 'lvx-empty-mrow' });
        row.appendChild(teamLink(hc, 'lvx-empty-mteam', flagImg(hc, 'lvx-empty-mflag'), el('span', {}, hc || '—')));
        row.appendChild(el('div', { class: 'lvx-empty-mvs' }, 'v'));
        row.appendChild(teamLink(ac, 'lvx-empty-mteam', el('span', {}, ac || '—'), flagImg(ac, 'lvx-empty-mflag')));
        const sc = stakeChips(hc, ac, r.MatchNumber); if (sc) { sc.classList.add('compact'); row.appendChild(sc); }
        multi.appendChild(row);
      }
      card.appendChild(multi);
    }
    const cd = el('div', { class: 'lvx-count' }); card.appendChild(cd);
    if (slot.length === 1) {
      const venue = [descOf(next.Stadium && next.Stadium.Name), descOf(next.Stadium && next.Stadium.CityName)].filter(Boolean).join(' · ');
      if (venue) card.appendChild(el('div', { class: 'lvx-empty-venue' }, venue));
    }
    const tick = () => {
      if (!cd.isConnected) return;
      const left = Date.parse(next.Date) - Date.now();
      cd.innerHTML = '';
      if (left <= 0) { cd.appendChild(el('span', { class: 'lvx-count-live' }, 'Kicking off…')); return; }
      const s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60;
      const seg = (n, l) => el('div', { class: 'lvx-count-seg' }, el('b', {}, String(n).padStart(2, '0')), el('i', {}, l));
      if (d > 0) cd.appendChild(seg(d, 'days'));
      cd.appendChild(seg(h, 'hrs')); cd.appendChild(seg(mi, 'min')); cd.appendChild(seg(se, 'sec'));
    };
    tick(); setInterval(tick, 1000);
  } else card.appendChild(el('div', { class: 'lvx-empty-venue' }, 'Check the schedule for the next match.'));
  card.appendChild(el('a', { class: 'lvx-empty-link', href: '/wc/fixtures' }, 'View all fixtures →'));
  stage.appendChild(card);

  // today's slate
  const dayRef = next ? Date.parse(next.Date) : now;
  const slate = upcoming.filter((r) => sameDay(Date.parse(r.Date), dayRef) && !slot.includes(r)).slice(0, 10);
  if (slate.length) {
    const sl = el('div', { class: 'lvx-slate', 'data-reveal': '' });
    sl.appendChild(el('div', { class: 'lvx-slate-h' }, 'On this matchday'));
    const resolved = await Promise.all(slate.map(async (r) => ({ r, t: await teamsFor(r.IdMatch) })));
    for (const { r, t } of resolved) {
      const hc = t && t.home.code, ac = t && t.away.code;
      sl.appendChild(el('div', { class: 'lvx-slate-row' },
        flagImg(hc, 'lvx-slate-flag'), el('span', { class: 'lvx-slate-code' }, hc || '—'),
        el('span', { class: 'lvx-slate-time' }, fmtTime(r.Date)),
        el('span', { class: 'lvx-slate-code' }, ac || '—'), flagImg(ac, 'lvx-slate-flag')));
    }
    stage.appendChild(sl);
  }
  // recently finished
  if (recent.length) {
    const rc = el('div', { class: 'lvx-slate', 'data-reveal': '' });
    rc.appendChild(el('div', { class: 'lvx-slate-h' }, 'Recent results'));
    const resolved = await Promise.all(recent.map(async (r) => ({ r, b: await matchBrief(r.IdMatch, r.MatchNumber) })));
    for (const { r, b } of resolved) {
      const hc = b.home, ac = b.away;
      const sc = (b.hs != null && b.as != null) ? `${b.hs}–${b.as}` : 'FT';
      rc.appendChild(el('div', { class: 'lvx-slate-row' },
        flagImg(hc, 'lvx-slate-flag'), el('span', { class: 'lvx-slate-code' }, hc || '—'),
        el('span', { class: 'lvx-slate-time res' }, sc),
        el('span', { class: 'lvx-slate-code' }, ac || '—'), flagImg(ac, 'lvx-slate-flag')));
    }
    stage.appendChild(rc);
  }

  stage.appendChild(el('div', { class: 'lvx-foot', 'data-reveal': '' }, el('span', { class: 'lvx-prov' }, 'Schedule & kick-off times — FIFA official. This page switches to the live broadcast automatically when a match kicks off.')));
  root.appendChild(stage);
  revealNow();
  setInterval(async () => { try { const a = await findActiveMatches(); if (a.length) location.reload(); } catch {} }, CFG.EMPTY_MS);
}

async function teamsFor(idMatch) {
  try { const m = fifa.normalizeLive(await fifa.getLive(idMatch)); return { home: { code: m.home.code, name: m.home.name }, away: { code: m.away.code, name: m.away.name } }; }
  catch { return null; }
}

// ─── pure helpers ──────────────────────────────────────────────────────────────
const FROZEN = new Set(['PRE', 'HT', 'FT', 'FT_PEN', 'PEN']);
const CAPS = { '1H': 45, '2H': 90, ET1: 105, ET2: 120 };
function pad(n) { return String(n).padStart(2, '0'); }
function mmss(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
function fmtClock(phase, sec) {
  const cap = CAPS[phase];
  if (cap == null) return { main: mmss(sec), added: null };
  const capSec = cap * 60;
  if (sec <= capSec) return { main: mmss(sec), added: null };
  return { main: cap + ':00', added: mmss(sec - capSec) };
}
function parseMinute(str) { if (str == null) return 0; const clean = String(str).replace(/[^\d+]/g, ''); const m = clean.match(/^(\d+)(?:\+(\d+))?/); return m ? Number(m[1]) + (m[2] ? Number(m[2]) : 0) : 0; }
// Parse a seconds-bearing clock like "67:23" → 4043. Returns null for a bare
// minute ("67'") so we don't fabricate sub-minute precision FIFA didn't give.
function clockToSec(str) { if (str == null) return null; const m = String(str).match(/(\d+):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function stageLabel(m) {
  const g = m.groupName ? 'Group ' + String(m.groupName).replace(/group/i, '').trim() : (m.stageName || '');
  return [g, m.matchNumber ? 'Match ' + m.matchNumber : ''].filter(Boolean).join(' · ');
}
function phaseTag(m, ls) {
  if (ls === 'pre') return 'Pre-match';
  if (m.phase === '1H') return 'First half';
  if (m.phase === '2H') return 'Second half';
  if (m.phase === 'HT') return 'Half-time break';
  if (m.phase === 'ET1' || m.phase === 'ET2') return 'Extra time';
  if (m.phase === 'PEN') return 'Penalty shoot-out';
  if (ls === 'justft') return 'Full time · just now';
  if (ls === 'ft') return m.phase === 'FT_PEN' ? 'Decided on penalties' : 'Full time';
  return '';
}
function startingXI(team) {
  const starters = team.players.filter((p) => p.status === 1 || p.status === '1');
  if (starters.length >= 7) return starters.slice(0, 11);
  return team.players.filter((p) => p.onField).slice(0, 11);
}
function lineupPositions(rows, side, total) {
  const pts = [];
  const gkY = side === 'home' ? 0.955 : 0.045;
  pts.push({ x: 0.5, y: gkY });
  const lines = rows.length || 1;
  const defY = side === 'home' ? 0.86 : 0.14, fwdY = side === 'home' ? 0.56 : 0.44;
  for (let li = 0; li < lines; li++) {
    const n = rows[li]; const frac = lines === 1 ? 0.5 : li / (lines - 1);
    const y = defY + frac * (fwdY - defY);
    for (let i = 0; i < n; i++) pts.push({ x: (i + 1) / (n + 1), y });
  }
  while (pts.length < total) pts.push({ x: 0.5, y: side === 'home' ? 0.72 : 0.28 });
  return pts;
}
function eventIcon(kind) {
  if (kind === 'yellow' || kind === 'red') return '';                 // CSS draws the colour chip
  if (kind === 'sub') return icon('git-fork', { size: 12 });
  if (kind === 'goal' || kind === 'penalty' || kind === 'own_goal') return icon('circle-dot', { size: 12 });
  return icon('circle-dot', { size: 9 });
}
function descOf(arr) { return (Array.isArray(arr) && arr[0] && arr[0].Description) || (typeof arr === 'string' ? arr : null); }
function sameDay(a, b) { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); }
function fmtTime(d) { try { return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }); } catch { return ''; } }
function num(v) { if (v == null) return null; const m = String(v).match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; }
function round2(v) { return v == null ? '0' : (Math.round(v * 100) / 100).toFixed(2); }
function round1(v) { return v == null ? '0' : (Math.round(v * 10) / 10).toFixed(1); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fmtStat(row, away) {
  const v = away ? row.a : row.h;
  if (row.isPct) return Math.round(v) + '%';
  if (row.isXg) return round2(v);
  return String(v);
}
// FIFA calendar rows: pull a team code / score / minute for the picker & switcher.
function teamCodeOf(row, which) {
  const t = which === 'home' ? (row.HomeTeam || row.Home) : (row.AwayTeam || row.Away);
  return t ? (t.IdCountry || t.Abbreviation || null) : null;
}
function scoreOf(row) {
  const h = row.HomeTeam && row.HomeTeam.Score, a = row.AwayTeam && row.AwayTeam.Score;
  return (h != null && a != null) ? `${h}–${a}` : null;
}
function minuteOf(row) { return row.MatchTime || null; }

// Replace player surnames in commentary text with clickable links, best-effort.
function linkifyNames(text, ctrl) {
  if (!text) return document.createTextNode('');
  const frag = document.createDocumentFragment();
  const names = ctrl.playerNameList ? ctrl.playerNameList() : [];
  // simple pass: if any known full name appears, link it; else plain text.
  let matched = null, idx = -1;
  for (const n of names) { const i = text.indexOf(n); if (i >= 0) { matched = n; idx = i; break; } }
  if (!matched) { frag.appendChild(document.createTextNode(text)); return frag; }
  frag.appendChild(document.createTextNode(text.slice(0, idx)));
  frag.appendChild(playerLink(matched, 'lvx-cm-name'));
  frag.appendChild(document.createTextNode(text.slice(idx + matched.length)));
  return frag;
}

// expose a name list for commentary linkification
LiveController.prototype.playerNameList = function () {
  if (this._nameCache && this._nameCacheM === this.m) return this._nameCache;
  const out = [];
  for (const t of [this.m.home, this.m.away]) for (const p of t.players) if (p.name) out.push(p.name);
  out.sort((a, b) => b.length - a.length); // longest first
  this._nameCache = out; this._nameCacheM = this.m;
  return out;
};

// ─── DEMO state (deterministic, network-free — /wc/live?demo=1) ────────────────
const DEMO = buildDemo();
function buildDemo() {
  const pl = (id, name, short, number, status, captain, position) => ({ id, name, short, number, position, captain: !!captain, onField: status === 1, photo: null, x: null, y: null, status });
  const homePlayers = [
    pl(1, 'Alisson Becker', 'Alisson', 1, 1, false, 0), pl(2, 'Danilo', 'Danilo', 2, 1, false, 1), pl(3, 'Marquinhos', 'Marquinhos', 4, 1, true, 1),
    pl(4, 'Gabriel Magalhães', 'Gabriel', 3, 1, false, 1), pl(5, 'Wendell', 'Wendell', 6, 1, false, 1), pl(6, 'Bruno Guimarães', 'Bruno G.', 5, 1, false, 2),
    pl(7, 'Lucas Paquetá', 'Paquetá', 10, 1, false, 2), pl(8, 'Rodrygo', 'Rodrygo', 11, 1, false, 3), pl(9, 'Raphinha', 'Raphinha', 7, 1, false, 3),
    pl(10, 'Vinícius Júnior', 'Vinícius Jr', 20, 1, false, 3), pl(11, 'Endrick', 'Endrick', 9, 1, false, 3),
    pl(12, 'Bento', 'Bento', 12, 0, false, 0), pl(13, 'Éder Militão', 'Militão', 14, 0, false, 1), pl(14, 'João Gomes', 'J. Gomes', 15, 0, false, 2),
  ];
  const awayPlayers = [
    pl(21, 'Emiliano Martínez', 'E. Martínez', 23, 1, false, 0), pl(22, 'Nahuel Molina', 'Molina', 26, 1, false, 1), pl(23, 'Cristian Romero', 'Romero', 13, 1, false, 1),
    pl(24, 'Nicolás Otamendi', 'Otamendi', 19, 1, false, 1), pl(25, 'Nicolás Tagliafico', 'Tagliafico', 3, 1, false, 1), pl(26, 'Rodrigo De Paul', 'De Paul', 7, 1, false, 2),
    pl(27, 'Enzo Fernández', 'Enzo', 24, 1, false, 2), pl(28, 'Alexis Mac Allister', 'Mac Allister', 20, 1, false, 2), pl(29, 'Lionel Messi', 'Messi', 10, 1, true, 3),
    pl(30, 'Julián Álvarez', 'J. Álvarez', 9, 1, false, 3), pl(31, 'Ángel Di María', 'Di María', 11, 1, false, 3),
    pl(32, 'Gerónimo Rulli', 'Rulli', 12, 0, false, 0), pl(33, 'Lautaro Martínez', 'L. Martínez', 22, 0, false, 3), pl(34, 'Leandro Paredes', 'Paredes', 5, 0, false, 2),
  ];
  const m = {
    source: 'fifa', idMatch: 'demo', matchNumber: 53, groupName: 'C', stageName: 'Group Stage', status: 'live', phase: '2H', minute: "67'",
    home: { id: 'H', code: 'BRA', name: 'Brazil', abbr: 'BRA', score: 2, tactics: '4-3-3', players: homePlayers },
    away: { id: 'A', code: 'ARG', name: 'Argentina', abbr: 'ARG', score: 1, tactics: '4-4-2', players: awayPlayers },
    homePen: null, awayPen: null, possession: { home: 54, away: 46 },
    stadium: 'MetLife Stadium', city: 'East Rutherford', attendance: 82500,
    weather: { TemperatureCelsius: 24, TypeLocalized: [{ Description: 'Clear' }] },
    officials: [{ name: 'Szymon Marciniak', role: 'Referee', country: 'POL' }], date: new Date().toISOString(),
  };
  const ev = (id, kind, team, player, playerId, minute, hg, ag, x, y) => ({ id, kind, label: kind, teamId: team, player, playerId, minute, minuteLabel: minute + "'", homeGoals: hg, awayGoals: ag, x, y });
  const events = [
    ev('e7', 'goal', 'H', 'Rodrygo', 8, 67, 2, 1, 88, 44),
    ev('e6', 'shot', 'A', 'Julián Álvarez', 30, 64, null, null, 80, 58),
    ev('e5', 'red', 'A', 'Cristian Romero', 23, 63, null, null),
    ev('e4', 'yellow', 'A', 'Nicolás Otamendi', 24, 58, null, null),
    ev('e3', 'goal', 'A', 'Lionel Messi', 29, 45, 1, 1, 14, 52),
    ev('e2', 'shot', 'H', 'Raphinha', 9, 38, null, null, 84, 40),
    ev('e2b', 'corner', 'H', 'Raphinha', 9, 31, null, null),
    ev('e1', 'goal', 'H', 'Vinícius Júnior', 10, 9, 1, 0, 90, 52),
  ];
  const espnC = (seq, min, text, type) => ({ seq, min, minVal: parseInt(min), text, type, isGoal: /goal/i.test(type || ''), isCard: /card/i.test(type || ''), isSub: /sub/i.test(type || '') });
  const espn = {
    commentary: [
      espnC(67, "67'", 'GOAL! Brazil 2-1 Argentina. Rodrygo curls a beautiful effort into the top corner from the edge of the box.', 'Goal'),
      espnC(66, "66'", 'Vinícius Júnior wins a free kick in a dangerous area after being fouled by Molina.', 'Foul'),
      espnC(64, "64'", 'Attempt saved. Julián Álvarez sees his low drive held by Alisson.', 'Shot'),
      espnC(63, "63'", 'Red card! Cristian Romero is sent off for a second bookable offence.', 'Red Card'),
      espnC(61, "61'", 'Vinícius Júnior receiving medical attention after a heavy challenge. He looks okay to continue.', 'Injury'),
      espnC(58, "58'", 'Yellow card. Nicolás Otamendi is booked for a tactical foul.', 'Yellow Card'),
      espnC(52, "52'", 'Corner kick taken by Raphinha, headed clear by Otamendi.', 'Corner'),
      espnC(46, "46'", 'Second half under way at MetLife Stadium.', 'Start'),
      espnC(45, "45'", 'GOAL! Lionel Messi levels it before the break with a trademark finish into the bottom corner.', 'Goal'),
      espnC(9, "9'", 'GOAL! Vinícius Júnior gives Brazil the lead with a crisp finish.', 'Goal'),
    ],
    stats: {
      BRA: { possession: { num: 54 }, totalshots: { num: 11 }, shotsontarget: { num: 5 }, woncorners: { num: 4 }, foulscommitted: { num: 9 }, offsides: { num: 2 }, totalpasses: { num: 412 }, yellowcards: { num: 1 } },
      ARG: { possession: { num: 46 }, totalshots: { num: 7 }, shotsontarget: { num: 3 }, woncorners: { num: 2 }, foulscommitted: { num: 12 }, offsides: { num: 1 }, totalpasses: { num: 358 }, yellowcards: { num: 3 } },
    },
    info: { attendance: 82500, officials: [{ name: 'Szymon Marciniak', role: 'Referee' }], weather: { temp: 24 } },
    winprob: null,
  };
  const official = {
    momentum: Array.from({ length: 68 }, (_, i) => ({ minute: i, value: 60 * Math.sin(i / 7) + (i > 63 ? 40 : 0) - (i > 44 && i < 50 ? 50 : 0) })),
    shotmap: { home: [{ xg: 0.62, goal: true, player: 'Vinícius Júnior', min: "9'", x: 90, y: 54 }, { xg: 0.71, goal: true, player: 'Rodrygo', min: "67'", x: 86, y: 42 }, { xg: 0.09, goal: false, player: 'Raphinha', min: "38'", x: 82, y: 64 }], away: [{ xg: 0.55, goal: true, player: 'Lionel Messi', min: "45'", x: 91, y: 47 }, { xg: 0.12, goal: false, player: 'Julián Álvarez', min: "64'", x: 76, y: 58 }], homeXg: 1.42, awayXg: 0.67, source: 'sofascore' },
    stats: null,
  };
  // demo ESPN event for form pips + demo context (real enrichment shapes)
  const espnEvent = { home: { form: 'WWDWW' }, away: { form: 'WWLWD' }, broadcast: 'FOX', odds: { homeProb: 0.45, awayProb: 0.33, drawProb: 0.22 } };
  const ctx = {
    h2h: { ARG_BRA: { pair: ['ARG', 'BRA'], first_wins: 42, second_wins: 43, draws: 26, played: 111 } },
    elo: { BRA: { current_rating: 2012 }, ARG: { current_rating: 2041 } },
    ranks: { BRA: { live_rank: 5, official_rank: 5 }, ARG: { live_rank: 1, official_rank: 1 } },
    recs: { BRA: { wins: 650, draws: 201, losses: 180 }, ARG: { wins: 602, draws: 211, losses: 199 } },
  };
  // A second concurrent match so the "also live" indicator + swap links can be
  // demoed (?demo) without two real games running at once.
  const others = [{ IdMatch: 'demo-2', MatchNumber: 54 }];
  const otherBriefs = [{ idMatch: 'demo-2', MatchNumber: 54, home: 'FRA', away: 'ESP', hs: 1, as: 2, minute: "72'", status: 'live', phase: '2H' }];
  return { m, events, espn, official, espnEvent, ctx, others, otherBriefs };
}

// ─── styles ────────────────────────────────────────────────────────────────────
export const LIVE_CSS = `
.lvx-boot{display:flex;min-height:60vh;align-items:center;justify-content:center;color:var(--text-3);font-weight:700;font-size:14px;letter-spacing:.04em}
.lvx-stage{position:relative;display:flex;flex-direction:column;gap:clamp(12px,1.6vw,18px)}
/* Broadcast diagonal: deep team-colour split behind everything (both themes). */
.live-bg2{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:var(--home-deep,var(--bg))}
.live-bg2-a{position:absolute;inset:0;background:var(--away-deep,var(--bg));clip-path:polygon(58% 0,100% 0,100% 100%,42% 100%)}
.lvx-stage .live-bg2::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 56%,rgba(7,10,8,.5))}
.live-edge{position:fixed;top:50vh;top:50svh;z-index:0;pointer-events:none;font-family:var(--f-display);text-transform:uppercase;letter-spacing:.05em;line-height:.86;color:#fff;opacity:.07;writing-mode:vertical-rl;white-space:nowrap;font-size:clamp(26px,7vh,78px)}
.live-edge-h{left:clamp(0px,.6vw,12px);transform:translateY(-50%) rotate(180deg)}
.live-edge-a{right:clamp(0px,.6vw,12px);transform:translateY(-50%)}
.lvx-stage>:not(.live-bg2):not(.live-edge):not(.lvx-goalflash){position:relative;z-index:1}
#wc-hero-logo{display:none}

/* status bar — a clean token strip floating over the broadcast backdrop */
.lvx-statusbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:8px 10px;box-shadow:var(--sh-1)}
.lvx-back{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px 0 11px;border-radius:var(--r-pill);border:1px solid var(--border);background:var(--surface-2);color:var(--text-2);font-family:var(--f-body);font-weight:800;font-size:12px;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;transition:background var(--dur-2),border-color var(--dur-2),color var(--dur-2),transform var(--dur-1) var(--ease-press)}
.lvx-back:hover{color:var(--text);border-color:var(--accent-line);transform:translateX(-2px)}
.lvx-back-ic{display:inline-flex;align-items:center}
.lvx-back svg{display:block}
.lvx-livepill{display:inline-flex;align-items:center;gap:8px;padding:6px 11px;border-radius:var(--r-pill);background:var(--live);color:var(--live-ink);font-family:Archivo Expanded,var(--f-body);font-weight:900;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.lvx-livepill .lvx-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.lvx-livepill.is-live .lvx-dot{animation:lvx-pulse 1.25s infinite}
.lvx-livepill.is-ft{background:var(--surface-2);color:var(--text-2);border:1px solid var(--border)}
.lvx-livepill.is-pre{background:var(--accent);color:var(--on-accent)}
.lvx-stage-lbl{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-2)}
.lvx-venue-lbl{font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:30vw}
.lvx-sb-spacer{flex:1}
.lvx-fresh{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-2);background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-pill);padding:5px 11px}
.lvx-fresh-dot{width:7px;height:7px;border-radius:50%;background:var(--success);animation:lvx-pulse 2s infinite}
.lvx-fresh.fresh{color:var(--success-text);border-color:var(--success)}
.lvx-fresh.fresh .lvx-fresh-dot{background:var(--success);box-shadow:0 0 7px var(--success-quiet)}
.lvx-fresh.stale{color:var(--warning-text);border-color:var(--warning-quiet)}
.lvx-fresh.stale .lvx-fresh-dot{background:var(--warning);animation:none}
.live-vt{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:var(--r-pill);background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);font-family:var(--f-body);font-weight:800;font-size:11px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;transition:border-color var(--dur-2),color var(--dur-2),background var(--dur-2)}
.live-vt:hover{border-color:var(--accent-line);color:var(--accent-text)}
.live-vt-ic{display:inline-flex;align-items:center}
.live-vt-ic svg{display:block}
.live-vt-lbl{line-height:1}
.lvx-switch{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap}
.lvx-switch-lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
.lvx-switch-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-2);transition:border-color var(--dur-2),background var(--dur-2),color var(--dur-2)}
.lvx-switch-chip:hover{border-color:var(--accent-line);color:var(--text)}
.lvx-switch-side{display:inline-flex;align-items:center;gap:5px}
.lvx-switch-flag{width:18px;height:12px;border-radius:2px;object-fit:cover;display:block;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
.lvx-switch-c{font-family:var(--f-display);font-size:13px;letter-spacing:.02em;color:var(--text)}
.lvx-switch-sc{color:var(--accent-text);padding:0 1px}
.lvx-switch-min{color:var(--text-3);font-size:10px}

/* hero — sits over the broadcast team backdrop, so its big type stays light in
   both themes (the diagonal is deep team-colour in both); team codes are tinted
   to --home/--away in JS. Only the chrome-y states pull tokens. */
.lvx-hero{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(8px,2.4vw,40px);padding:clamp(6px,1.6vw,16px) 0}
.lvx-team{display:flex;justify-content:center;min-width:0}
.lvx-teamlink{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0;text-decoration:none;color:inherit;cursor:pointer;transition:transform var(--dur-2),filter var(--dur-2);padding:6px 10px;border-radius:var(--r-md)}
.lvx-teamlink:hover{transform:translateY(-2px);filter:drop-shadow(0 8px 20px rgba(0,0,0,.5))}
.lvx-teamflag{width:clamp(72px,15vw,124px);height:clamp(48px,10vw,83px);border-radius:var(--r-sm);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.55)}
.lvx-flagimg{width:100%;height:100%;object-fit:cover;display:block}
.lvx-teamcode{font-family:var(--f-display);font-size:clamp(30px,7vw,60px);line-height:.85;letter-spacing:.02em}
.lvx-teamname{font-weight:600;font-size:clamp(11px,1.5vw,15px);color:rgba(255,255,255,.7);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.lvx-teamform{display:flex;gap:4px;margin-top:2px}
.lvx-pip{width:15px;height:15px;border-radius:var(--r-xs);font-family:var(--f-body);font-weight:900;font-size:9px;display:flex;align-items:center;justify-content:center;color:var(--on-accent)}
.lvx-pip-w{background:var(--success)}.lvx-pip-d{background:var(--warning)}.lvx-pip-l{background:var(--danger);color:#fff}
.lvx-heromid{display:flex;flex-direction:column;align-items:center;gap:8px}
.lvx-score{font-family:'Archivo Black',var(--f-body);font-variant-numeric:tabular-nums;font-size:clamp(52px,14vw,112px);line-height:1;display:flex;align-items:center;justify-content:center;gap:clamp(10px,2.2vw,26px);letter-spacing:0;position:relative}
.lvx-s-h,.lvx-s-a{color:#fff}
.lvx-sdash{color:rgba(255,255,255,.46);font-size:.5em;line-height:1;transform:translateY(-.06em)}
.lvx-score.flash .lvx-s-h,.lvx-score.flash .lvx-s-a{animation:lvx-scoreflash .9s cubic-bezier(.3,1.4,.5,1)}
.lvx-pens{position:absolute;left:50%;top:calc(100% - 4px);transform:translateX(-50%);font-family:var(--f-body);font-weight:800;font-size:12px;color:rgba(255,255,255,.78);white-space:nowrap}
.lvx-clockwrap{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:2px}
.lvx-clock{display:flex;align-items:baseline;justify-content:center;gap:8px;font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums}
.lvx-clock-main{font-size:clamp(30px,6vw,50px);letter-spacing:.01em;line-height:1;color:#fff}
.lvx-clock.is-ft .lvx-clock-main{color:rgba(255,255,255,.72)}
.lvx-clock.is-pre .lvx-clock-main{color:var(--accent-text)}
.lvx-clock-added{font-size:clamp(15px,2.4vw,24px);color:rgba(255,255,255,.66)}
.lvx-clock-added.on{color:var(--accent-text);background:var(--accent-quiet);border-radius:var(--r-sm);padding:2px 9px;font-weight:800}
.lvx-phasetag{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.66)}
.lvx-goalflash{position:absolute;left:50%;top:24%;transform:translate(-50%,0) scale(.7);font-family:var(--f-display);font-size:clamp(60px,12vw,120px);letter-spacing:.06em;color:#fff;opacity:0;pointer-events:none;z-index:9;text-shadow:0 0 50px rgba(255,255,255,.5)}
.lvx-goalflash.show{animation:lvx-goal 1.7s cubic-bezier(.2,.9,.3,1.2)}

/* win prob — over the backdrop; team colours stay, neutrals are overlay-safe */
.lvx-winwrap{display:flex;flex-direction:column;gap:7px;max-width:760px;width:100%;margin:0 auto}
.lvx-win-h{display:flex;align-items:baseline;justify-content:space-between;font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.7)}
.lvx-win-bar{display:flex;height:26px;border-radius:var(--r-sm);overflow:hidden;gap:2px;background:rgba(0,0,0,.3)}
.lvx-win-seg{display:flex;align-items:center;justify-content:center;font-family:var(--f-body);font-weight:800;font-size:11px;color:#fff;min-width:0;transition:flex .6s cubic-bezier(.4,0,.2,1)}
.lvx-win-seg.d{background:rgba(255,255,255,.34);color:#fff}
.lvx-win-legend{display:flex;gap:16px;justify-content:center;font-family:var(--f-body);font-weight:700;font-size:10px;color:rgba(255,255,255,.7)}
.lvx-win-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}

/* chips — over the backdrop; subtle translucent surface */
.lvx-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.lvx-chip{display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 15px;border-radius:var(--r-sm);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
.lvx-chip-k{font-weight:800;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.lvx-chip-v{font-weight:700;font-size:13px;color:#fff}

/* cards — token surfaces, readable in both themes */
.lvx-card{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:15px 17px;box-shadow:var(--sh-1)}
.lvx-cardh{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.lvx-cardh-l{display:inline-flex;align-items:center;gap:9px;min-width:0}
.lvx-cardt{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-text)}
.lvx-cardsub{font-family:var(--f-mono);font-weight:700;font-size:9.5px;color:var(--text-3);text-align:right}
.lvx-cf{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-mono);font-weight:700;font-size:8.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);white-space:nowrap;padding:2px 7px 2px 6px;border:1px solid var(--border);border-radius:var(--r-pill);flex:none}
.lvx-cf-dot{width:6px;height:6px;border-radius:50%;background:var(--success);flex:none;animation:lvx-pulse 2s infinite}
.lvx-cf.live{color:var(--success-text);border-color:var(--success-quiet)}
.lvx-cf.live .lvx-cf-dot{background:var(--success);box-shadow:0 0 6px var(--success-quiet)}
.lvx-cf.stale{color:var(--warning-text);border-color:var(--warning-quiet)}
.lvx-cf.stale .lvx-cf-dot{background:var(--warning);animation:none;box-shadow:none}
.lvx-cf.idle{color:var(--text-3)}
.lvx-cf.idle .lvx-cf-dot{background:var(--text-disabled);animation:none;box-shadow:none}
.lvx-muted{color:var(--text-3);font-weight:600;font-size:13px;padding:6px 0}
.lvx-grid{display:grid;gap:clamp(12px,1.6vw,16px)}
.lvx-grid-2{grid-template-columns:1fr 1fr}

/* momentum */
.lvx-mom-svg{width:100%;height:150px;display:block}
.lvx-mom-time{position:relative;height:13px;margin-top:3px}
.lvx-mom-tick{position:absolute;transform:translateX(-50%);font-family:var(--f-mono);font-weight:700;font-size:9px;color:var(--text-3);white-space:nowrap}
.lvx-mom-tick.ht{color:var(--text-2)}
.lvx-mom-tick.now{color:var(--accent-text)}
.lvx-mom-ax{display:flex;justify-content:space-between;font-family:var(--f-body);font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;color:var(--text-3)}

/* pitch — the grass keeps its dark green identity in both themes; chrome tokens */
.lvx-pitch{position:relative}
.lvx-grass{position:relative;width:100%;aspect-ratio:68/96;border-radius:var(--r-md);background:linear-gradient(#11331f,#0c2417);border:1px solid var(--border);overflow:hidden}
.lvx-grass::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 8.33%,transparent 8.33% 16.66%)}
.lvx-midline{position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,.18)}
.lvx-midcircle{position:absolute;left:50%;top:50%;width:22%;aspect-ratio:1;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.18);border-radius:50%}
.lvx-box{position:absolute;left:50%;transform:translateX(-50%);width:56%;height:13%;border:1px solid rgba(255,255,255,.15)}
.lvx-box-t{top:0;border-top:none}.lvx-box-b{bottom:0;border-bottom:none}
.lvx-six{position:absolute;left:50%;transform:translateX(-50%);width:28%;height:5.5%;border:1px solid rgba(255,255,255,.13)}
.lvx-six-t{top:0;border-top:none}.lvx-six-b{bottom:0;border-bottom:none}
.lvx-pl{position:absolute;transform:translate(-50%,-50%);width:14%;max-width:66px}
.lvx-pl-link{display:flex;flex-direction:column;align-items:center;text-decoration:none;color:inherit;position:relative}
.lvx-av{position:relative;width:clamp(28px,5.6vw,46px);height:clamp(28px,5.6vw,46px);border-radius:50%;overflow:hidden;border:2px solid var(--c);background:#0c1410 center/cover;box-shadow:0 4px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;transition:transform .15s}
.lvx-pl-link:hover .lvx-av{transform:scale(1.12)}
.lvx-avimg{width:100%;height:100%;object-fit:cover;object-position:top center}
.lvx-av-no{font-family:var(--f-display);font-size:15px;color:#dce9df;background:#1a2a20}
.lvx-num{position:absolute;top:-5px;right:-7px;font-family:var(--f-mono);font-weight:800;font-size:9px;color:#fff;background:rgba(0,0,0,.82);border:1.5px solid var(--c);border-radius:var(--r-xs);padding:0 4px;line-height:1.4;box-shadow:0 1px 3px rgba(0,0,0,.6)}
.lvx-cap{position:absolute;top:-5px;left:-7px;font-family:var(--f-body);font-weight:900;font-size:8px;color:var(--on-accent);background:var(--accent);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;z-index:2}
.lvx-plbadge{position:absolute;bottom:14px;right:-4px;display:flex;gap:2px;z-index:3}
.lvx-bg{font-size:11px;line-height:1}
.lvx-bg-goal{font-size:11px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))}
.lvx-bg-yellow{width:8px;height:11px;border-radius:2px;background:var(--warning);display:inline-block}
.lvx-bg-red{width:8px;height:11px;border-radius:2px;background:var(--danger);display:inline-block}
.lvx-plname{margin-top:4px;font-weight:700;font-size:9.5px;color:#fff;text-align:center;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.9);max-width:78px;overflow:hidden;text-overflow:ellipsis}
.lvx-pl-link:hover .lvx-plname{color:var(--accent-hover)}
.lvx-pitch-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;color:#cdd8cf;font-weight:600;font-size:13px;padding:0 24px;text-shadow:0 1px 3px rgba(0,0,0,.8)}
.lvx-subs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.lvx-subh{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.lvx-sublist{display:flex;flex-wrap:wrap;gap:5px}
.lvx-subchip{font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-2);background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-xs);padding:3px 8px;text-decoration:none;transition:color var(--dur-2),border-color var(--dur-2)}
.lvx-subchip:hover{color:var(--accent-text);border-color:var(--accent-line)}

/* stats — centre-diverging FLAT solid bars with an average tick */
.lvx-stat{margin-bottom:14px}
.lvx-stat-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
.lvx-stat-h{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:15px;color:var(--home);min-width:46px}
.lvx-stat-a{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:15px;color:var(--away);min-width:46px;text-align:right}
.lvx-stat-lbl{font-family:var(--f-body);font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--text-2);text-align:center;flex:1}
.lvx-stat-graph{display:flex;gap:3px;height:13px}
.lvx-half{position:relative;flex:1;background:var(--surface-2);border-radius:var(--r-xs)}
.lvx-half.left{display:flex;justify-content:flex-end}
.lvx-half .fill{display:block;height:100%;border-radius:var(--r-xs);transition:width .5s cubic-bezier(.4,0,.2,1)}
.lvx-avg{position:absolute;top:-3px;bottom:-3px;width:0;border-left:2px dashed var(--text-3)}
.lvx-stat-legend{display:flex;align-items:center;gap:7px;margin-top:6px;font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-3)}
.lvx-stat-basekey{display:inline-block;width:14px;border-top:2px dashed var(--text-3)}

/* shotmap — keeps a dark pitch tone in both themes; chrome tokens */
.lvx-shot-svg{width:100%;display:block;border-radius:var(--r-md);border:1px solid var(--border);background:linear-gradient(#0c1a10,#0a160c)}
.lvx-shotpin{cursor:default}
.lvx-shotpin.goal{animation:lvx-pulse 2.6s ease infinite;transform-box:fill-box;transform-origin:center}
.lvx-shot-key{display:flex;gap:16px;margin-top:8px;font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-2)}
.lvx-shot-key i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:middle}
.lvx-shot-key .k-o{border:2px solid var(--text-2)}
.lvx-shot-key .k-g{background:var(--home)}

/* commentary */
.lvx-comm{display:flex;flex-direction:column;gap:2px;max-height:520px;overflow-y:auto}
.lvx-cm{display:flex;gap:10px;padding:9px 4px;border-bottom:1px solid var(--border-subtle);align-items:flex-start}
.lvx-cm-new{animation:lvx-evin .5s cubic-bezier(.2,.9,.3,1.2)}
.lvx-cm.goal{background:var(--accent-quiet)}
.lvx-cm.card{background:var(--warning-quiet)}
.lvx-cm-min{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-2);min-width:34px;padding-top:1px}
.lvx-cm-ic{font-size:12px;min-width:14px;display:inline-flex;align-items:center;justify-content:center;padding-top:1px;color:var(--text-3)}
.lvx-cm-ic svg{display:block}
.lvx-cm-ic.card::before{content:'';width:8px;height:11px;border-radius:2px;background:var(--warning)}
.lvx-cm.goal .lvx-cm-min{color:var(--accent-text)}
.lvx-cm.goal .lvx-cm-ic{color:var(--accent-text)}
.lvx-cm-tx{font-family:var(--f-body);font-weight:500;font-size:13px;line-height:1.45;color:var(--text-2)}
.lvx-cm.goal .lvx-cm-tx{font-weight:700;color:var(--text)}
.lvx-plink{color:inherit;text-decoration:none;cursor:pointer;transition:color .15s}
.lvx-plink:hover{color:var(--accent-text)}
.lvx-cm-name{border-bottom:1px dotted var(--accent-line)}
.lvx-cm-name:hover{color:var(--accent-text)}

/* timeline + scorers */
.lvx-tlcol{display:flex;flex-direction:column;gap:16px}
.lvx-tl{display:flex;flex-direction:column;gap:9px;max-height:280px;overflow-y:auto}
.lvx-ev{display:flex;align-items:center;gap:9px}
.lvx-ev-new{animation:lvx-evin .5s cubic-bezier(.2,.9,.3,1.2)}
.lvx-ev-min{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:12px;color:var(--text-2);min-width:36px}
.lvx-ev-ic{width:18px;text-align:center;font-size:13px;display:inline-flex;align-items:center;justify-content:center;color:var(--text-2)}
.lvx-ev-ic-goal{color:var(--accent-text)}
.lvx-ev-ic-yellow::before{content:'';display:inline-block;width:9px;height:12px;border-radius:2px;background:var(--warning)}
.lvx-ev-ic-red::before{content:'';display:inline-block;width:9px;height:12px;border-radius:2px;background:var(--danger)}
.lvx-ev-who{font-weight:800;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none}
a.lvx-ev-who:hover{color:var(--accent-text)}
.lvx-ev-sc{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:12px;color:var(--text-2)}
.lvx-ev-team{margin-left:auto;font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:10px;letter-spacing:.06em;text-decoration:none;color:var(--text-3)}
.lvx-scorers{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lvx-sc-col{min-width:0}
.lvx-sc-team{font-family:var(--f-display);font-size:15px;margin-bottom:6px;display:inline-block;text-decoration:none;color:var(--text)}
.lvx-sc-row{display:flex;align-items:center;gap:7px;margin-bottom:5px}
.lvx-sc-name{font-weight:700;font-size:12.5px;color:var(--text);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lvx-sc-name:hover{color:var(--accent-text)}
.lvx-sc-tag{font-family:var(--f-body);font-weight:800;font-size:8.5px;color:var(--text-2)}
.lvx-sc-min{margin-left:auto;font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-3)}
.lvx-sc-goals{margin-left:auto;font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:11px;color:var(--accent-text)}
.lvx-sc-today .lvx-sc-tag{background:var(--accent-quiet);color:var(--accent-text);border-radius:var(--r-xs);padding:1px 6px}

/* group — full-row tint + coloured position (no left-edge stripe) */
.lvx-gst-h{display:grid;grid-template-columns:24px 1fr 30px 38px 38px;gap:6px;padding:0 8px 8px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3)}
.lvx-gst{display:grid;grid-template-columns:24px 1fr 30px 38px 38px;gap:6px;align-items:center;padding:7px 8px;border-radius:var(--r-sm);margin-bottom:2px;border:1px solid transparent}
.lvx-gst.q{background:var(--success-quiet)}
.lvx-gst.me{background:var(--accent-quiet);border-color:var(--accent-line)}
.lvx-gst-pos{font-family:var(--f-display);font-size:14px;color:var(--text-3)}
.lvx-gst.q .lvx-gst-pos{color:var(--success-text)}
.lvx-gst.me .lvx-gst-pos{color:var(--accent-text)}
.lvx-gst-name{display:flex;align-items:center;gap:9px;min-width:0;text-decoration:none}
.lvx-gst-name span:last-child{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lvx-gst.me .lvx-gst-name span:last-child{color:var(--text);font-weight:800}
.lvx-gst-flag{width:22px;height:16px;flex:none;border-radius:3px;object-fit:cover;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
.lvx-gst-c{text-align:center;font-family:var(--f-body);font-weight:700;font-variant-numeric:tabular-nums;font-size:13px;color:var(--text-2)}
.lvx-gst-pts{text-align:center;font-family:var(--f-display);font-size:16px;color:var(--text)}
.lvx-gst.me .lvx-gst-pts{color:var(--accent-text)}

/* context */
.lvx-ctx{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.lvx-ctxcell{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:11px 13px}
.lvx-ctx-k{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
.lvx-ctx-v{font-family:var(--f-display);font-size:22px;color:var(--text);margin:5px 0 2px}
.lvx-ctx-s{font-family:var(--f-body);font-weight:700;font-size:10px;color:var(--text-3)}

/* footer / sources */
.lvx-foot{margin-top:6px;display:flex;flex-direction:column;gap:10px;align-items:center}
.lvx-srcs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.lvx-src{display:flex;align-items:center;gap:7px;padding:6px 12px;border-radius:var(--r-sm);background:var(--surface-1);border:1px solid var(--border)}
.lvx-src-dot{width:8px;height:8px;border-radius:50%;background:var(--text-disabled)}
.lvx-src.on .lvx-src-dot{background:var(--success)}
.lvx-src-n{font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2)}
.lvx-src-w{font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-3)}
.lvx-src-l{font-family:var(--f-mono);font-weight:700;font-size:9.5px;color:var(--text-3);padding-left:7px;border-left:1px solid var(--border)}
.lvx-prov{font-weight:600;font-size:10.5px;line-height:1.5;color:var(--text-3);text-align:center;max-width:640px}

/* picker */
.lvx-pick{align-items:center;text-align:center;padding-top:2vh}
.lvx-pick-kicker{font-family:var(--f-display);font-size:clamp(24px,4vw,40px);color:var(--text);letter-spacing:.02em}
.lvx-pick-sub{font-weight:600;font-size:14px;color:var(--text-2);margin-top:-4px}
.lvx-pick-list{display:flex;flex-direction:column;gap:12px;width:100%;max-width:560px;margin-top:14px}
.lvx-pick-card{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px 18px;cursor:pointer;transition:transform var(--dur-2) var(--ease-press),border-color var(--dur-2),box-shadow var(--dur-2)}
.lvx-pick-card:hover{transform:translateY(-2px);border-color:var(--accent-line);box-shadow:var(--sh-3)}
.lvx-pick-team{display:flex;align-items:center;gap:10px;min-width:0}
.lvx-pick-team:last-child{flex-direction:row-reverse}
.lvx-pick-flag{width:46px;height:31px;border-radius:var(--r-xs);object-fit:cover;box-shadow:0 0 0 1px rgba(0,0,0,.18)}
.lvx-pick-code{font-family:var(--f-display);font-size:24px;color:var(--text)}
.lvx-pick-mid{display:flex;flex-direction:column;align-items:center;gap:3px}
.lvx-pick-score{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:30px;color:var(--text)}
.lvx-pick-min{font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:11px;color:var(--live)}
.lvx-pick-remember{display:flex;align-items:center;gap:9px;margin-top:16px;font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-2);cursor:pointer}
.lvx-pick-remember input{width:17px;height:17px;accent-color:var(--accent)}

/* empty / countdown */
/* What's at stake — broadcast (detailed live view) */
.lvx-stakes{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px 18px}
:root[data-theme=light] .lvx-stakes{background:var(--surface-1);border-color:var(--border)}
.lvx-stk-h{display:flex;align-items:center;gap:7px;font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-bottom:12px}
:root[data-theme=light] .lvx-stk-h{color:var(--accent-text)}
.lvx-stk-ic{display:inline-flex;align-items:center}
.lvx-stk-note{font-weight:700;letter-spacing:.03em;text-transform:none;color:rgba(255,255,255,.45);margin-left:auto}
:root[data-theme=light] .lvx-stk-note{color:var(--text-3)}
.lvx-stk-teams{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lvx-stk-tc{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 14px}
:root[data-theme=light] .lvx-stk-tc{background:var(--surface-2);border-color:var(--border-subtle)}
.lvx-stk-tc.home{box-shadow:inset 3px 0 0 var(--home)} .lvx-stk-tc.away{box-shadow:inset 3px 0 0 var(--away)}
.lvx-stk-tc .code{font-family:var(--f-display);font-size:15px;color:#fff;letter-spacing:.02em;margin-bottom:5px}
:root[data-theme=light] .lvx-stk-tc .code{color:var(--text)}
.lvx-stk-tc .big{font-family:var(--f-display);font-size:30px;line-height:.9;color:#fff}
.lvx-stk-tc .big i{font-style:normal;font-size:14px;opacity:.6;margin-left:1px}
.lvx-stk-tc .big.thru{color:var(--success);font-size:20px} .lvx-stk-tc .big.out{color:rgba(255,255,255,.4);font-size:16px}
.lvx-stk-tc .cap{font-family:var(--f-body);font-weight:700;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-top:4px}
:root[data-theme=light] .lvx-stk-tc .cap{color:var(--text-3)}
.lvx-stk-tc .bar{height:6px;border-radius:99px;background:rgba(255,255,255,.13);overflow:hidden;margin-top:9px}
.lvx-stk-tc .bar .f{height:100%;border-radius:99px;background:var(--accent);transition:width .5s ease}
.lvx-stk-tc .bar .f.thru{background:var(--success)}
.lvx-stk-scen{margin-top:12px;display:flex;flex-direction:column;gap:6px}
.lvx-stk-scen-h{font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:2px}
:root[data-theme=light] .lvx-stk-scen-h{color:var(--text-3)}
.lvx-stk-decided{font-family:var(--f-body);font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.5)}
:root[data-theme=light] .lvx-stk-decided{color:var(--text-3)}
.lvx-stk-who{margin-top:14px}
.lvx-who-row{display:grid;grid-template-columns:minmax(64px,auto) 1fr auto;gap:10px;align-items:center;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:9px;margin-bottom:6px}
:root[data-theme=light] .lvx-who-row{background:var(--surface-2)}
.lvx-who-row .tc{font-family:var(--f-display);font-size:14px;color:#fff}
:root[data-theme=light] .lvx-who-row .tc{color:var(--text)}
.lvx-who-row .wt{font-family:var(--f-body);font-size:12px;color:rgba(255,255,255,.7)}
:root[data-theme=light] .lvx-who-row .wt{color:var(--text-2)}
.lvx-who-row .wt b{color:#fff}
:root[data-theme=light] .lvx-who-row .wt b{color:var(--text)}
.lvx-who-row .wt.win b{color:var(--success-text)} .lvx-who-row .wt.draw b{color:var(--accent-text)}
.lvx-who-row .sw{font-family:var(--f-mono);font-weight:700;font-size:12px;color:rgba(255,255,255,.5);font-variant-numeric:tabular-nums;justify-self:end}
:root[data-theme=light] .lvx-who-row .sw{color:var(--text-3)}
@media (max-width:560px){.lvx-who-row{grid-template-columns:auto 1fr}.lvx-who-row .sw{display:none}}
.lvx-stk-srow{display:grid;grid-template-columns:1fr 96px 1fr;gap:12px;align-items:center;padding:9px 14px;background:rgba(255,255,255,.03);border-radius:9px;font-family:var(--f-body);font-size:13px;color:rgba(255,255,255,.78)}
:root[data-theme=light] .lvx-stk-srow{background:var(--surface-2);color:var(--text-2)}
.lvx-stk-srow .r{font-weight:900;font-size:10px;letter-spacing:.03em;text-transform:uppercase;text-align:center;padding:6px 14px;border-radius:6px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.85);white-space:nowrap}
.lvx-stk-srow .r.home{color:var(--home);background:rgba(var(--home-rgb),.18)}
.lvx-stk-srow .r.away{color:var(--away);background:rgba(var(--away-rgb),.18)}
.lvx-stk-srow .v{font-family:var(--f-mono);font-weight:600;font-variant-numeric:tabular-nums}
.lvx-stk-srow .v.vh{text-align:left} .lvx-stk-srow .v.va{text-align:right}
.lvx-stk-srow .v b{color:#fff;font-weight:800}
:root[data-theme=light] .lvx-stk-srow .v b{color:var(--text)}
/* idle page: simultaneous kickoffs + stake chips */
.lvx-empty-multi{display:flex;flex-direction:column;gap:10px;width:100%;max-width:560px}
.lvx-empty-mrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 16px}
:root[data-theme=light] .lvx-empty-mrow{background:var(--surface-2);border-color:var(--border-subtle)}
.lvx-empty-mteam{display:flex;align-items:center;gap:7px;font-family:var(--f-display);font-size:19px;color:#fff;text-decoration:none}
:root[data-theme=light] .lvx-empty-mteam{color:var(--text)}
.lvx-empty-mflag{width:26px;height:18px;border-radius:3px}
.lvx-empty-mvs{font-family:var(--f-body);font-weight:800;font-size:12px;color:rgba(255,255,255,.5)}
.lvx-stk{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:center;margin-top:9px}
.lvx-stk.compact{margin-top:0;margin-left:auto}
.lvx-stk-lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45)}
:root[data-theme=light] .lvx-stk-lbl{color:var(--text-3)}
.lvx-stk-chip{font-family:var(--f-mono);font-weight:800;font-size:12px;color:#fff;background:rgba(255,255,255,.09);border-radius:7px;padding:3px 8px}
.lvx-stk-chip.thru{color:var(--success)} .lvx-stk-chip.out{color:rgba(255,255,255,.4)}
:root[data-theme=light] .lvx-stk-chip{background:var(--surface-sunken);color:var(--text)}
.lvx-empty-card{margin:4vh auto 0;max-width:560px;width:100%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:13px}
.lvx-empty-kicker{font-weight:700;font-size:13px;color:var(--text-3);letter-spacing:.04em}
.lvx-empty-next{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:11px;letter-spacing:.2em;color:var(--text-2)}
.lvx-empty-mu{display:flex;align-items:center;gap:18px;justify-content:center}
.lvx-empty-team{display:flex;flex-direction:column;align-items:center;gap:8px;font-family:var(--f-display);font-size:30px;text-decoration:none;color:var(--text)}
.lvx-empty-flag{width:74px;height:50px;border-radius:var(--r-sm);object-fit:cover;box-shadow:var(--sh-2)}
.lvx-empty-vs{font-family:var(--f-display);font-size:18px;color:var(--text-3)}
.lvx-count{display:flex;gap:10px;margin-top:4px}
.lvx-count-seg{display:flex;flex-direction:column;align-items:center;min-width:58px;padding:10px 6px;border-radius:var(--r-md);background:var(--surface-1);border:1px solid var(--border)}
.lvx-count-seg b{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:26px;color:var(--text)}
.lvx-count-seg i{font-style:normal;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-top:3px}
.lvx-count-live{font-family:var(--f-display);font-size:24px;color:var(--accent-text)}
.lvx-empty-venue{font-weight:600;font-size:12px;color:var(--text-3)}
.lvx-empty-link{font-weight:800;font-size:12px;color:var(--text-2);border-bottom:1px solid currentColor;padding-bottom:1px;align-self:center;text-decoration:none}
.lvx-empty-link:hover{color:var(--accent-text)}
.lvx-slate{max-width:560px;width:100%;margin:18px auto 0}
.lvx-slate-h{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;text-align:center}
.lvx-slate-row{display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0;border-top:1px solid var(--border-subtle);text-decoration:none;color:inherit}
.lvx-slate-row:hover{background:var(--accent-quiet)}
.lvx-slate-flag{width:26px;height:18px;border-radius:3px;object-fit:cover;box-shadow:0 0 0 1px rgba(0,0,0,.18)}
.lvx-slate-code{font-family:var(--f-display);font-size:16px;min-width:42px;text-align:center;color:var(--text)}
.lvx-slate-time{font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:12px;color:var(--text-2);min-width:64px;text-align:center}
.lvx-slate-time.res{color:var(--accent-text)}

@keyframes lvx-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.55}}
@keyframes lvx-scoreflash{0%{transform:scale(1)}35%{transform:scale(1.32);color:#fff}100%{transform:scale(1)}}
@keyframes lvx-goal{0%{opacity:0;transform:translate(-50%,16px) scale(.6)}16%{opacity:1;transform:translate(-50%,0) scale(1.08)}72%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px) scale(1)}}
@keyframes lvx-evin{0%{opacity:0;transform:translateX(-12px)}100%{opacity:1;transform:none}}

@media (max-width:820px){
  .lvx-grid-2{grid-template-columns:1fr}
  .lvx-venue-lbl{display:none}
  .lvx-comm{max-height:380px}
}
/* Phones: keep the detailed status strip tidy instead of letting it wrap into a
   tall stack — icon-only back, the live pill + stage stay, switcher/fresh flow. */
@media (max-width:480px){
  .lvx-statusbar{gap:6px;padding:7px 8px;border-radius:var(--r-md)}
  .lvx-back{padding:0 10px}
  .lvx-back-lbl{display:none}
  .lvx-stage-lbl{font-size:10px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lvx-sb-spacer{display:none}
  .lvx-switch{flex-basis:100%;order:6;justify-content:flex-start}
  .lvx-fresh{order:5}
  .live-vt{padding:0 11px}
  .live-vt-lbl{display:none}
}

/* Respect reduced-motion: keep the page informative but still. */
@media (prefers-reduced-motion: reduce){
  .lvx-livepill .lvx-dot,.lvx-fresh-dot,.cv-fresh-dot,.cv-pill .cv-dot,.lvx-cf-dot,.lvx-shotpin.goal,.wc-live-dot{animation:none!important}
  .lvx-score.flash .lvx-s-h,.lvx-score.flash .lvx-s-a,.cv-score.flash .cv-s-h,.cv-score.flash .cv-s-a{animation:none!important}
  .lvx-goalflash.show,.cv-goalflash.show{animation-duration:.01ms!important}
  .lvx-cm-new,.lvx-ev-new{animation:none!important}
  [data-reveal]{opacity:1!important;transform:none!important}
}

/* ─── CLEAN VIEW (?view=clean) — a fullscreen broadcast/TV surface that stays
   deliberately dark + team-coloured in BOTH themes. Its big type sits on the
   team backdrop (light text is correct); only the incidental chrome (top-bar
   pills, play-by-play dropdown) is tidied, using overlay neutrals + the dark-
   safe --accent/--live tokens so it reads consistently regardless of theme. ─── */
.cv-stage{position:fixed;inset:0;z-index:60;background:#06080b;color:#f4f6f5;display:flex;flex-direction:column;padding:max(16px,env(safe-area-inset-top)) clamp(16px,4vw,48px) max(14px,env(safe-area-inset-bottom));overflow:hidden;font-family:var(--f-body)}
.cv-stage>:not(.live-bg2):not(.live-edge){position:relative;z-index:1}
.cv-top{display:flex;align-items:center;gap:12px;position:relative;z-index:5}
.cv-fresh{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:12px;color:rgba(255,255,255,.66);flex:none}
.cv-fresh-dot{width:7px;height:7px;border-radius:50%;background:var(--success);animation:lvx-pulse 2s infinite}
.cv-fresh.fresh{color:#a6ecbb}
.cv-fresh.fresh .cv-fresh-dot{background:#5cf08a;box-shadow:0 0 7px rgba(92,240,138,0.7)}
.cv-fresh.stale .cv-fresh-dot{background:var(--warning);animation:none}
.cv-other{display:inline-flex;align-items:center;gap:8px;flex:none;min-width:0}
.cv-other-lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6);flex:none}
.cv-other-chip{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:var(--r-pill);background:rgba(8,12,10,.55);border:1px solid rgba(255,255,255,.15);color:#e6efea;text-decoration:none;font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:12px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:border-color .2s,background .2s}
.cv-other-chip:hover{border-color:rgba(255,255,255,.42);background:rgba(20,28,22,.72)}
.cv-other-flag{width:18px;height:12px;border-radius:2px;object-fit:cover;display:block;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
.cv-other-dot{width:7px;height:7px;border-radius:50%;background:var(--live);flex:none;animation:lvx-pulse 2s infinite}
.cv-other-dot.ft{background:rgba(255,255,255,.5);animation:none}
.cv-other-sc{font-variant-numeric:tabular-nums;color:#fff;letter-spacing:.02em}
.cv-other-min{color:rgba(255,255,255,.66);font-size:10.5px}
.cv-info{flex:1;display:flex;justify-content:center;align-items:center;position:relative;min-width:0}
.cv-info-btn{display:none;align-items:center;gap:7px;height:32px;padding:0 13px;border-radius:var(--r-pill);background:rgba(8,12,10,.5);border:1px solid rgba(255,255,255,.16);color:#cdd8d2;font-family:var(--f-body);font-weight:800;font-size:11px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.cv-info-ic{display:inline-flex}
.cv-info-ar{display:inline-flex;transition:transform .2s}
.cv-info-ar svg{display:block}
.cv-info.open .cv-info-ar{transform:rotate(180deg)}
.cv-info-panel{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:clamp(10px,1.4vw,13px);letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);text-align:center;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.cv-main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(12px,2.6vh,28px);min-height:0}
.cv-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(10px,4vw,90px);width:100%;max-width:1500px}
.cv-team{display:flex;justify-content:center;min-width:0}
.cv-tlink{display:flex;flex-direction:column;align-items:center;gap:clamp(18px,2.8vw,38px);text-decoration:none;color:inherit;min-width:0;cursor:pointer;transition:transform .2s}
.cv-tlink:hover{transform:translateY(-3px)}
.cv-flag{width:clamp(100px,18vw,256px);height:clamp(67px,12vw,170px);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.6);flex:none}
.cv-flagimg{width:100%;height:100%;object-fit:cover;display:block}
.cv-code{font-family:var(--f-display);font-size:clamp(56px,13.5vw,184px);line-height:.8;letter-spacing:.01em;color:#fff}
.cv-mid{position:relative;display:flex;flex-direction:column;align-items:center}
.cv-clockwrap{position:absolute;top:100%;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;margin-top:clamp(16px,3.4vh,46px);white-space:nowrap}
.cv-score{position:relative;font-family:'Archivo Black',var(--f-body);font-variant-numeric:tabular-nums;font-size:clamp(82px,20vw,300px);line-height:1;display:flex;align-items:center;justify-content:center;gap:0}
.cv-s-h,.cv-s-a{color:#fff}
.cv-sslash{color:#fff;line-height:1;pointer-events:none;padding:0 0.12em}
.cv-score.flash .cv-s-h,.cv-score.flash .cv-s-a{animation:lvx-scoreflash .9s cubic-bezier(.3,1.4,.5,1)}
.cv-pens{position:absolute;left:50%;top:calc(100% - 2px);transform:translateX(-50%);font-family:var(--f-body);font-weight:800;font-size:clamp(12px,1.6vw,17px);color:rgba(255,255,255,.82);white-space:nowrap}
.cv-clock{display:flex;flex-direction:column;align-items:center;gap:clamp(4px,.9vh,9px);font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums}
.cv-clock-main{font-size:clamp(34px,6vw,68px);line-height:1;color:#f4f6f5}
.cv-clock.is-ft .cv-clock-main{color:rgba(255,255,255,.72)}.cv-clock.is-pre .cv-clock-main{color:#ffd23f}
.cv-clock-added{font-size:clamp(15px,2.3vw,26px);color:#ffd23f;font-weight:800;letter-spacing:.03em;line-height:1}
.cv-clock-added:empty{display:none}
.cv-phase{margin-top:clamp(8px,1.4vh,15px);font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:clamp(10px,1.4vw,14px);letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.72)}
.cv-stage .live-edge{opacity:.12}
.cv-goalflash{position:absolute;left:50%;top:32%;transform:translate(-50%,0) scale(.7);font-family:var(--f-display);font-size:clamp(70px,16vw,180px);letter-spacing:.06em;color:#fff;opacity:0;pointer-events:none;z-index:9;text-shadow:0 0 60px rgba(255,255,255,.55)}
.cv-goalflash.show{animation:lvx-goal 1.7s cubic-bezier(.2,.9,.3,1.2)}
.cv-pbp{flex:none;border-top:1px solid rgba(255,255,255,.08);max-height:64px;overflow:hidden;transition:max-height .35s cubic-bezier(.4,0,.2,1);position:relative;z-index:5}
.cv-pbp.open{max-height:min(46vh,460px)}
.cv-pbp-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:18px 4px;background:none;border:none;cursor:pointer;font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:clamp(17px,2.6vw,24px);letter-spacing:.1em;text-transform:uppercase;color:#cdd8d2}
.cv-pbp-ar{color:rgba(255,255,255,.66);display:inline-flex}
.cv-pbp-ar svg{display:block;transition:transform .2s}
.cv-pbp.open .cv-pbp-ar svg{transform:rotate(180deg)}
.cv-pbp-body{max-height:calc(min(46vh,460px) - 66px);overflow-y:auto;padding-bottom:12px}
.cv-cm{display:flex;gap:14px;padding:12px 4px;border-top:1px solid rgba(255,255,255,.05);align-items:flex-start}
.cv-cm.goal{background:rgba(245,199,18,.08)}
.cv-cm-min{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:15px;color:rgba(255,255,255,.66);min-width:52px;padding-top:2px}
.cv-cm-tx{font-family:var(--f-body);font-weight:500;font-size:clamp(16px,1.9vw,20px);line-height:1.5;color:#e2ece8}
.cv-cm.goal .cv-cm-tx{font-weight:700;color:#fff}
.cv-muted{color:rgba(255,255,255,.5);font-weight:600;font-size:13px;padding:10px 4px}
@media (max-width:560px){
  .cv-stage{padding:max(12px,env(safe-area-inset-top)) 14px max(12px,env(safe-area-inset-bottom))}
  .cv-top{gap:8px;flex-wrap:wrap;row-gap:10px}
  /* On phones the "also live" pill drops to its own centered row so the top bar
     (fresh · match-info · view toggle) never has to compete for width. */
  .cv-other{order:5;flex-basis:100%;justify-content:center}
  .cv-other-min{display:none}
  .cv-info-btn{display:inline-flex}
  .cv-info-panel{display:none;position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);background:rgba(8,12,10,.95);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:9px 13px;white-space:normal;max-width:84vw;z-index:8;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-size:11px}
  .cv-info.open .cv-info-panel{display:block}
  .cv-row{grid-template-columns:1fr;justify-items:center;gap:clamp(12px,3.4vh,32px);max-width:none}
  .cv-flag{width:clamp(84px,30vw,150px);height:clamp(56px,20vw,100px)}
  .cv-code{font-size:clamp(50px,17vw,104px)}
  .cv-score{font-size:clamp(70px,26vw,152px);gap:0}
  .cv-clockwrap{position:static;transform:none;left:auto;margin-top:clamp(10px,2.4vh,22px)}
  .cv-clock-main{font-size:clamp(30px,9vw,52px)}
  .cv-stage .live-bg2-a{clip-path:polygon(0 58%,100% 42%,100% 100%,0 100%)}
  .cv-stage .live-edge{font-size:clamp(28px,6.2svh,66px);opacity:.1}
  .live-vt{padding:0 11px}
  .live-vt-lbl{display:none}
}

/* ── Light-mode overrides: swap team-colour backgrounds to pastels ─────────── */
/* Detailed view (lvx-stage) — swap to pastel team tints */
:root[data-theme=light] .lvx-stage .live-bg2{background:var(--home-deep-light,var(--bg))}
:root[data-theme=light] .lvx-stage .live-bg2-a{background:var(--away-deep-light,var(--bg))}
/* Remove the dark bottom-fade vignette; use a faint light one instead */
:root[data-theme=light] .lvx-stage .live-bg2::after{background:linear-gradient(180deg,transparent 50%,rgba(255,255,255,.18))}
/* Edge watermark text: invert from white to dark */
:root[data-theme=light] .live-edge{color:#111}

/* Clean view (cv-stage) — full light adaptation */
:root[data-theme=light] .cv-stage{background:var(--bg);color:var(--text)}
:root[data-theme=light] .cv-stage .live-bg2{background:var(--home-deep-light,var(--bg))}
:root[data-theme=light] .cv-stage .live-bg2-a{background:var(--away-deep-light,var(--bg))}
/* code, score, slash */
:root[data-theme=light] .cv-code{color:var(--text)}
:root[data-theme=light] .cv-s-h,:root[data-theme=light] .cv-s-a{color:var(--text)}
:root[data-theme=light] .cv-sslash{color:var(--text-3)}
:root[data-theme=light] .cv-pens{color:var(--text-2)}
/* clock */
:root[data-theme=light] .cv-clock-main{color:var(--text)}
:root[data-theme=light] .cv-clock.is-ft .cv-clock-main{color:var(--text-2)}
:root[data-theme=light] .cv-phase{color:var(--text-2)}
/* freshness / pill */
:root[data-theme=light] .cv-fresh{color:var(--text-2)}
:root[data-theme=light] .cv-fresh.fresh{color:var(--success-text)}
:root[data-theme=light] .cv-fresh.stale{color:var(--warning-text)}
/* other-match chips */
:root[data-theme=light] .cv-other-lbl{color:var(--text-3)}
:root[data-theme=light] .cv-other-chip{background:var(--surface-2);border-color:var(--border);color:var(--text)}
:root[data-theme=light] .cv-other-chip:hover{background:var(--surface-3);border-color:var(--border-strong)}
:root[data-theme=light] .cv-other-sc{color:var(--text)}
:root[data-theme=light] .cv-other-min{color:var(--text-2)}
:root[data-theme=light] .cv-other-dot.ft{background:var(--text-3)}
/* match info panel (mobile) */
:root[data-theme=light] .cv-info-panel{color:var(--text-2)}
:root[data-theme=light] .cv-info-btn{background:var(--surface-2);border-color:var(--border);color:var(--text-2)}
:root[data-theme=light] .cv-info.open .cv-info-panel{background:var(--surface-1);border-color:var(--border)}
/* play-by-play */
:root[data-theme=light] .cv-pbp{border-top-color:var(--border)}
:root[data-theme=light] .cv-pbp-btn{color:var(--text-2)}
:root[data-theme=light] .cv-pbp-ar{color:var(--text-2)}
:root[data-theme=light] .cv-cm{border-top-color:var(--border-subtle)}
:root[data-theme=light] .cv-cm.goal{background:var(--accent-quiet)}
:root[data-theme=light] .cv-cm-min{color:var(--text-2)}
:root[data-theme=light] .cv-cm-tx{color:var(--text)}
:root[data-theme=light] .cv-cm.goal .cv-cm-tx{color:var(--text);font-weight:700}
:root[data-theme=light] .cv-muted{color:var(--text-3)}

/* ─── MERGED LIVE (?merge): broadcast hero that scrubs/docks into the nav ───── */
/* The win-prob + chip strips are broadcast-styled (light text on the team
   backdrop). In merge the backdrop fades on scroll, so hide them here — the
   detail cards below the fold are opaque token surfaces and read in both themes. */
.mg-stage .lvx-winwrap,.mg-stage .lvx-chips{display:none!important}
/* First-screen reserve. The dock (fixed) provides the visible hero on top of it. */
.mg-herospace{display:flex;align-items:flex-end;justify-content:center;min-height:calc(100svh - var(--nav-h,66px) - 18px);position:relative}
.mg-scrollhint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);pointer-events:none;transition:opacity .2s;z-index:2}
.mg-scrollhint-ic{display:inline-flex;animation:mg-bounce 1.8s ease-in-out infinite}
.mg-scrollhint-ic svg{display:block}
@keyframes mg-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}
:root[data-theme=light] .mg-scrollhint{color:var(--text-2)}
/* Fixed full-viewport layer; only the inner strip is interactive. */
.mg-dock{position:fixed;inset:0;z-index:55;display:flex;align-items:center;justify-content:center;padding-top:var(--nav-h,66px);pointer-events:none}
.mg-dockinner{pointer-events:auto;will-change:transform;transform-origin:50% 50%}
.mg-dockinner.mg-anim{transition:transform .5s cubic-bezier(.34,1.25,.4,1)}
.mg-dockblk{padding:0!important;gap:clamp(16px,3.2vw,52px)!important;align-items:center}
.mg-dockblk.mg-settled{animation:mg-settle .46s cubic-bezier(.34,1.56,.5,1)}
@keyframes mg-settle{0%{transform:scale(1)}45%{transform:scale(1.055)}100%{transform:scale(1)}}
.mg-dock .lvx-teamname{display:none}
.mg-dock .lvx-teamflag{width:clamp(80px,11vw,132px);height:clamp(54px,7.4vw,88px);box-shadow:0 14px 38px rgba(0,0,0,.5)}
.mg-dock .lvx-teamcode{font-size:clamp(38px,6.6vw,68px)}
.mg-dock .lvx-score{font-size:clamp(62px,12.5vw,120px)}
.mg-dock .lvx-clock-main{font-size:clamp(28px,4.8vw,46px)}
.mg-dock .lvx-clockwrap{gap:2px}
.mg-dock .lvx-heromid{gap:6px}
.mg-live{display:none;align-items:center;gap:6px;font-family:Archivo Expanded,var(--f-body);font-weight:900;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:var(--live);border-radius:var(--r-pill);padding:3px 11px;margin-bottom:2px}
.mg-live-dot{width:7px;height:7px;border-radius:50%;background:#fff;animation:lvx-pulse 1.25s infinite}
.mg-navtint{position:absolute;left:0;right:0;bottom:-1px;height:2px;opacity:0;pointer-events:none;transition:opacity .25s;z-index:1}
/* Move the sandbox-style cog out of the nav/dock's way (bottom-right). */
.mg-fab{left:auto!important;right:16px!important;top:auto!important;bottom:18px!important}
.mg-labpanel{left:auto!important;right:16px!important;top:auto!important;bottom:60px!important}
.mg-range{flex:1;min-width:0;accent-color:#2d6cf6}
@media (max-width:760px){
  .mg-dock .lvx-teamcode{font-size:clamp(32px,9vw,54px)}
  .mg-dock .lvx-score{font-size:clamp(54px,17vw,104px)}
  .mg-dock .lvx-teamflag{width:clamp(64px,18vw,104px);height:clamp(44px,12vw,70px)}
}
@media (prefers-reduced-motion:reduce){
  .mg-scrollhint-ic{animation:none}
  .mg-dockinner{will-change:auto}
  .mg-dockblk.mg-settled{animation:none}
}
`;
