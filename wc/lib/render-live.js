// Live match view — the in-play state of the Game page.
//
// renderGameInto() (render-game.js) delegates here whenever a match is live, in
// BOTH the fullscreen page and the popup. It is also reachable directly via the
// demo routes /wc/game/test (the wc2026api sandbox match that cycles phases) and
// /wc/game/mock (a frozen, fully-populated state that burns no API budget).
//
// Design goals, in priority order:
//   1. Score, team names, and a seconds-precision match clock dominate.
//   2. The clock ticks locally every second and RE-SYNCS to the feed's minute
//      whenever a poll returns a different minute (the feed only carries whole
//      minutes — match_minute — so the seconds are a smooth local estimate that
//      snaps to the source of truth, exactly as the brief asked).
//   3. As much fast-updating real data as possible: possession-territory pitch,
//      live stat bars, goalscorers, and a newest-first event timeline.
//
// What the live API actually provides (verified against api.wc2026api.com):
//   • match: home/away_score, status, phase, match_minute, next_phase_in_seconds,
//     kickoff_in_seconds, home_pen/away_pen, team names + codes.
//   • /matches/:id/stats: aggregate { possession, shots, shots_on_target, corners,
//     fouls, yellows, reds } per side + a timeline of { team, type, minute, player }
//     where type ∈ goal | own_goal | yellow_card | red_card.
//   There is NO shot-location / xG / heatmap data at any tier, so the pitch shows
//   real possession territory + real goal/shot/red-card data, never fake positions.

import * as api from './api.js';
import * as data from './data.js';
import { flagSrc } from './flags.js';

// All cadence/timing constants live here so the rate-limit budget is easy to tune.
// 75s collection-style polling keeps an 8-hour match day well under the 490/day cap.
const LIVE_CFG = {
  POLL_MS: 75_000,        // live match: refresh score + stats
  POLL_MS_TEST: 15_000,   // sandbox match cycles phases fast; proxy caches /test/match ~5s
  CLOCK_TICK_MS: 1_000,   // local clock tick
  SNAP_DRIFT_MIN: 2,      // re-sync the clock if it drifts >= this many minutes ahead
};

// ─── Small DOM helper ─────────────────────────────────────────────────────────
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
function svgEl(tag, attrs = {}, ...children) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const c of children.flat()) { if (c == null || c === false) continue; e.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
  return e;
}
function playerLink(name) {
  if (!name) return document.createTextNode('');
  return el('a', { class: 'lv-plink', href: `/wc/player/${encodeURIComponent('name:' + name)}` }, name);
}

// ─── Clock maths ──────────────────────────────────────────────────────────────
const FROZEN_PHASES = new Set(['PRE', 'HT', 'FT', 'FT_PEN', 'PEN']);
function fmtMS(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function regulationCapMin(phase) {
  return ({ '1H': 45, '2H': 90, ET1: 105, ET2: 120 })[phase] ?? null;
}
// Returns { main, extra } — main is the big clock string, extra is the stoppage chip.
function formatClock(phase, totalSec) {
  const cap = regulationCapMin(phase);
  if (cap == null) return { main: fmtMS(totalSec), extra: null };
  const capSec = cap * 60;
  if (totalSec <= capSec) return { main: fmtMS(totalSec), extra: null };
  return { main: `${cap}:00`, extra: `+${fmtMS(totalSec - capSec)}` };
}
// The feed only carries whole minutes (match_minute). Treat it as the count-up
// minute so the big clock reads like the "67'" shown everywhere else, then tick
// seconds locally on top. Fall back to a kickoff-based estimate if absent.
function targetSecondsFromMatch(m) {
  if (m.match_minute != null && !isNaN(m.match_minute)) return Number(m.match_minute) * 60;
  const ko = Date.parse(m.kickoff_utc);
  if (isNaN(ko)) return null;
  const elapsed = (Date.now() - ko) / 1000;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  switch (m.phase) {
    case '1H':  return clamp(elapsed, 0, 50 * 60);
    case '2H':  return clamp(elapsed - 15 * 60, 45 * 60, 100 * 60); // assume ~15m HT
    case 'ET1': return clamp(elapsed - 20 * 60, 90 * 60, 110 * 60);
    case 'ET2': return clamp(elapsed - 25 * 60, 105 * 60, 125 * 60);
    default:    return elapsed;
  }
}

// ─── Event helpers ────────────────────────────────────────────────────────────
const EVENT_META = {
  goal:        { kind: 'goal',   label: 'Goal',  cls: 'goal' },
  own_goal:    { kind: 'goal',   label: 'OG',    cls: 'goal', og: true },
  penalty:     { kind: 'goal',   label: 'Pen',   cls: 'goal', pen: true },
  yellow_card: { kind: 'yellow', label: 'Yellow', cls: 'yellow' },
  yellow:      { kind: 'yellow', label: 'Yellow', cls: 'yellow' },
  red_card:    { kind: 'red',    label: 'Red',   cls: 'red' },
  red:         { kind: 'red',    label: 'Red',   cls: 'red' },
  second_yellow: { kind: 'red',  label: 'Red',   cls: 'red' },
};
function extractEvents(stats) {
  if (!stats) return [];
  const tl = stats.timeline || stats.events || [];
  if (!Array.isArray(tl)) return [];
  return tl.map((ev, i) => {
    const type = String(ev.type || ev.event_type || '').toLowerCase();
    const meta = EVENT_META[type] || { kind: 'other', label: type.slice(0, 3).toUpperCase(), cls: 'other' };
    const minute = ev.minute != null ? Number(ev.minute) : null;
    return {
      i, type, ...meta,
      minute,
      minuteLabel: minute != null ? `${minute}'${ev.extra ? '+' + ev.extra : ''}` : '',
      sortKey: (minute != null ? minute : 0) * 100 + (ev.extra ? Number(ev.extra) : 0),
      player: ev.player || ev.player_name || ev.scorer || '',
      teamCode: String(ev.team || ev.team_code || '').toUpperCase(),
      key: `${minute}|${type}|${ev.player || ''}|${ev.team || ''}`,
    };
  });
}

// ─── Built-in MOCK state (fully populated; burns no API budget) ───────────────
const MOCK_MATCH = {
  id: 'mock', match_number: 11, round: 'group', group_name: 'C',
  home_team: 'Brazil', home_team_code: 'BRA', away_team: 'Argentina', away_team_code: 'ARG',
  stadium: 'MetLife Stadium', stadium_city: 'East Rutherford',
  kickoff_utc: new Date(Date.now() - 82 * 60_000).toISOString(),
  status: 'live', phase: '2H', match_minute: 67,
  home_score: 2, away_score: 1, home_pen: null, away_pen: null,
};
const MOCK_STATS = {
  match_id: 'mock',
  stats: {
    home_possession: 58, away_possession: 42,
    home_shots: 11, away_shots: 7,
    home_shots_on_target: 5, away_shots_on_target: 3,
    home_corners: 4, away_corners: 2,
    home_fouls: 9, away_fouls: 12,
    home_yellows: 1, away_yellows: 3,
    home_reds: 0, away_reds: 1,
  },
  timeline: [
    { team: 'BRA', type: 'goal', minute: 9, player: 'Vinícius Júnior' },
    { team: 'ARG', type: 'yellow_card', minute: 23, player: 'Rodrigo De Paul' },
    { team: 'BRA', type: 'yellow_card', minute: 34, player: 'Casemiro' },
    { team: 'ARG', type: 'goal', minute: 45, player: 'Lionel Messi' },
    { team: 'ARG', type: 'yellow_card', minute: 58, player: 'Nicolás Otamendi' },
    { team: 'ARG', type: 'red_card', minute: 63, player: 'Cristian Romero' },
    { team: 'BRA', type: 'goal', minute: 67, player: 'Rodrygo' },
  ],
};

// ─── Public entry ─────────────────────────────────────────────────────────────
// opts: { mode: 'live'|'test'|'mock', matchId, seed?: {m,home,away,stats,groups,groupsStatic}, setTitle? }
export async function renderLiveInto(container, opts = {}) {
  const mode = opts.mode || 'live';
  container.classList.add('lv-root');
  container.innerHTML = `<div class="lv-loading">Loading live match…</div>`;
  const ctrl = new LiveController(container, mode, opts.matchId, opts.setTitle);
  try {
    await ctrl.start(opts.seed);
  } catch (err) {
    container.innerHTML = `<div class="lv-error">Couldn't load the live match: ${String(err && err.message || err)}</div>`;
  }
  return ctrl;
}

class LiveController {
  constructor(container, mode, matchId, setTitle) {
    this.container = container;
    this.mode = mode;
    this.matchId = matchId;
    this.setTitle = setTitle;
    this.home = null; this.away = null;
    this.match = null; this.stats = null;
    this.groups = null; this.groupsStatic = null;
    this.refs = {};
    this.seenEventKeys = new Set();
    this.prevScore = null;
    // clock state
    this.baseSeconds = 0; this.anchorMs = null; this.phase = null; this.frozen = false;
    this.frozenAnchorMs = null; this.frozenCountdown = null; // for HT / pre countdowns
    this.pollId = null; this.clockId = null;
    this._onVis = () => { if (!document.hidden) this.poll(true); };
  }

  async fetchData() {
    if (this.mode === 'mock') return { match: { ...MOCK_MATCH }, stats: MOCK_STATS };
    if (this.mode === 'test') {
      // The sandbox match has no stats endpoint ("not available yet"), so don't
      // spend requests polling it — the clock/score/phase cycling is the demo.
      const match = await api.getTestMatch();
      return { match, stats: null };
    }
    const [match, stats] = await Promise.all([
      api.getMatch(this.matchId),
      api.getMatchStats(this.matchId).catch(() => null),
    ]);
    return { match: Array.isArray(match) ? match[0] : (match && match.data) || match, stats };
  }

  async resolveTeams(m) {
    const byNameOrCode = (name, code) =>
      data.resolveTeam(name).then(t => t || data.teamByCode(code)).catch(() => null);
    const [home, away] = await Promise.all([
      byNameOrCode(m.home_team, m.home_team_code),
      byNameOrCode(m.away_team, m.away_team_code),
    ]);
    // Synthesize a minimal record if teams-48 can't resolve (keeps demo robust).
    this.home = home || synthTeam(m.home_team, m.home_team_code);
    this.away = away || synthTeam(m.away_team, m.away_team_code);
  }

  async start(seed) {
    let match, stats;
    if (seed && seed.m) {
      match = seed.m; stats = seed.stats || null;
      this.home = seed.home || null; this.away = seed.away || null;
      this.groups = seed.groups || null; this.groupsStatic = seed.groupsStatic || null;
    } else {
      ({ match, stats } = await this.fetchData());
    }
    if (!match) throw new Error('match not found');
    if (!this.home || !this.away) await this.resolveTeams(match);
    // Group context (live standings computed from matches) — best-effort, async.
    if (match.round === 'group') this.loadGroupContext(match).catch(() => {});

    this.match = match; this.stats = stats;
    this.buildSkeleton();
    this.applyTitle();
    this.update(match, stats, { initial: true });

    this.startClock();
    if (this.mode !== 'mock') {
      this.startPolling();
      document.addEventListener('visibilitychange', this._onVis);
    }
  }

  applyTitle() {
    if (!this.setTitle) return;
    const h = this.home, a = this.away;
    const t = (h && a) ? `${h.fifa_code} ${this.match.home_score ?? 0}–${this.match.away_score ?? 0} ${a.fifa_code}` : 'Live match';
    this.setTitle(t, h && flagSrc(h.fifa_code) ? { flagUrl: flagSrc(h.fifa_code) } : {});
  }

  async loadGroupContext(m) {
    const letter = m.group_name;
    if (!letter) return;
    const [liveGroups, allMatches] = await Promise.all([
      api.getGroups().catch(() => null),
      api.getMatches().catch(() => null),
    ]);
    const groupObj = pickGroupObj(liveGroups, letter);
    if (groupObj && Array.isArray(allMatches)) {
      this.groupStandings = data.computeGroupStandings(allMatches, groupObj);
      if (this.refs.group) this.renderGroup();
    }
  }

  // ── Skeleton: build the persistent DOM once, keep refs for in-place patching ──
  buildSkeleton() {
    const c = this.container;
    c.innerHTML = '';
    const r = this.refs;

    // Status row
    r.statusRow = el('div', { class: 'lv-statusrow' });
    c.appendChild(r.statusRow);

    // Scoreboard
    const sb = el('div', { class: 'lv-scoreboard' });
    r.homeSide = this.teamSide('home');
    r.awaySide = this.teamSide('away');
    const mid = el('div', { class: 'lv-mid' });
    r.score = el('div', { class: 'lv-score' });
    r.clock = el('div', { class: 'lv-clock' });
    r.clockMain = el('span', { class: 'lv-clock-main' }, '0:00');
    r.clockExtra = el('span', { class: 'lv-clock-extra' });
    r.clock.appendChild(r.clockMain); r.clock.appendChild(r.clockExtra);
    r.phaseChip = el('div', { class: 'lv-phasechip' });
    mid.appendChild(r.score); mid.appendChild(r.clock); mid.appendChild(r.phaseChip);
    sb.appendChild(r.homeSide.node); sb.appendChild(mid); sb.appendChild(r.awaySide.node);
    c.appendChild(sb);
    r.goalflash = el('div', { class: 'lv-goalflash' }, 'GOAL');
    c.appendChild(r.goalflash);

    // Pitch
    r.pitchSec = el('div', { class: 'lv-section lv-pitch-sec' });
    r.pitchSec.appendChild(el('div', { class: 'lv-sec-head' },
      el('span', { class: 'lv-sec-ttl' }, 'Match shape'),
      el('span', { class: 'lv-sec-note' }, 'possession territory · real goals & shots'),
    ));
    r.pitch = el('div', { class: 'lv-pitch-wrap' });
    r.pitchSec.appendChild(r.pitch);
    c.appendChild(r.pitchSec);

    // Two-column: stats + timeline
    const cols = el('div', { class: 'lv-cols' });
    r.statsSec = el('div', { class: 'lv-section' });
    r.statsSec.appendChild(el('div', { class: 'lv-sec-head' },
      el('span', { class: 'lv-sec-ttl' }, 'Live stats'),
      r.statsNote = el('span', { class: 'lv-sec-note' }, 'updating'),
    ));
    r.stats = el('div', {});
    r.statsSec.appendChild(r.stats);

    r.tlSec = el('div', { class: 'lv-section' });
    r.tlSec.appendChild(el('div', { class: 'lv-sec-head' },
      el('span', { class: 'lv-sec-ttl' }, 'Timeline'),
      el('span', { class: 'lv-sec-note' }, 'latest first'),
    ));
    r.timeline = el('div', { class: 'lv-tl' });
    r.tlSec.appendChild(r.timeline);

    cols.appendChild(r.statsSec); cols.appendChild(r.tlSec);
    c.appendChild(cols);

    // Scorers
    r.scorersSec = el('div', { class: 'lv-section' });
    r.scorersSec.appendChild(el('div', { class: 'lv-sec-head' },
      el('span', { class: 'lv-sec-ttl' }, 'Goalscorers')));
    r.scorers = el('div', { class: 'lv-scorers' });
    r.scorersSec.appendChild(r.scorers);
    c.appendChild(r.scorersSec);

    // Shootout (hidden until PEN)
    r.shootoutSec = el('div', { class: 'lv-section', style: 'display:none' });
    r.shootoutSec.appendChild(el('div', { class: 'lv-sec-head' },
      el('span', { class: 'lv-sec-ttl' }, 'Penalty shootout')));
    r.shootout = el('div', {});
    r.shootoutSec.appendChild(r.shootout);
    c.appendChild(r.shootoutSec);

    // Group impact (group games only)
    r.groupSec = el('div', { class: 'lv-section', style: 'display:none' });
    r.groupSec.appendChild(el('div', { class: 'lv-sec-head' },
      r.groupTtl = el('span', { class: 'lv-sec-ttl' }, 'Group impact')));
    r.group = el('div', {});
    r.groupSec.appendChild(r.group);
    c.appendChild(r.groupSec);

    // Footer note
    c.appendChild(el('div', { class: 'lv-foot' },
      this.mode === 'mock'
        ? 'Demo · frozen mock state (no API calls). Clock ticks locally.'
        : this.mode === 'test'
          ? 'Demo · wc2026api sandbox match, cycling phases live.'
          : 'Live · refreshes every 75s · clock ticks locally between updates'));
  }

  teamSide(which) {
    const node = el('a', { class: 'lv-team' });
    const flag = el('div', { class: 'lv-flag' });
    const code = el('div', { class: 'lv-code' });
    const name = el('div', { class: 'lv-name' });
    node.appendChild(flag); node.appendChild(code); node.appendChild(name);
    return { node, flag, code, name, which };
  }

  fillTeamSide(side, team) {
    if (!team) {
      side.flag.className = 'lv-flag empty'; side.flag.textContent = '?';
      side.code.textContent = 'TBD'; side.name.textContent = '';
      side.node.removeAttribute('href');
      return;
    }
    const src = flagSrc(team.fifa_code);
    if (src) { side.flag.className = 'lv-flag'; side.flag.style.backgroundImage = `url(${src})`; }
    else { side.flag.className = 'lv-flag empty'; side.flag.textContent = (team.fifa_code || '').slice(0, 2); }
    side.code.textContent = team.fifa_code || '';
    side.name.textContent = team.name || '';
    if (team.fifa_code && this.mode === 'live') { side.node.href = `/wc/team/${team.fifa_code}`; side.node.dataset.popupTeam = team.fifa_code; }
  }

  // ── Update everything from a fresh (match, stats) pair ──
  update(match, stats, { initial = false } = {}) {
    this.match = match; this.stats = stats;
    const r = this.refs;

    // status row
    r.statusRow.innerHTML = '';
    const live = match.status === 'live';
    const pill = el('span', { class: `lv-pill ${live ? 'live' : match.status === 'finished' ? 'post' : 'pre'}` },
      live ? null : null, statusText(match));
    r.statusRow.appendChild(pill);
    r.statusRow.appendChild(el('span', { class: 'lv-stage' }, stageText(match)));
    r.statusRow.appendChild(el('span', { style: 'flex:1' }));
    const venue = [match.stadium, match.stadium_city].filter(Boolean).join(' · ');
    if (venue) r.statusRow.appendChild(el('span', { class: 'lv-stage' }, venue));

    // teams
    this.fillTeamSide(r.homeSide, this.home);
    this.fillTeamSide(r.awaySide, this.away);

    // score (flash on change)
    const hs = match.home_score ?? 0, as = match.away_score ?? 0;
    r.score.innerHTML = '';
    r.score.appendChild(el('span', { class: 'lv-s1' }, String(hs)));
    r.score.appendChild(el('span', { class: 'lv-sdash' }, '–'));
    r.score.appendChild(el('span', { class: 'lv-s2' }, String(as)));
    const pens = (match.home_pen != null && match.away_pen != null)
      ? el('span', { class: 'lv-pens' }, `(${match.home_pen}–${match.away_pen} pens)`) : null;
    if (pens) r.score.appendChild(pens);
    const scoreKey = `${hs}-${as}`;
    if (!initial && this.prevScore && this.prevScore !== scoreKey) this.flashGoal();
    this.prevScore = scoreKey;

    // clock
    this.syncClock(match);

    // pitch / stats / timeline / scorers / shootout
    this.renderPitch();
    this.renderStats();
    this.renderTimeline();
    this.renderScorers();
    this.renderShootout();

    // group section visibility
    if (match.round === 'group') { r.groupSec.style.display = ''; this.renderGroup(); }
    else r.groupSec.style.display = 'none';

    this.applyTitle();
  }

  flashGoal() {
    const r = this.refs;
    r.score.classList.remove('flash'); void r.score.offsetWidth; r.score.classList.add('flash');
    r.goalflash.classList.remove('show'); void r.goalflash.offsetWidth; r.goalflash.classList.add('show');
    setTimeout(() => r.goalflash.classList.remove('show'), 1500);
  }

  // ── Clock ──
  syncClock(match) {
    const phase = match.phase;
    this.phase = phase;
    if (FROZEN_PHASES.has(phase)) {
      this.frozen = true;
      // HT / PRE may carry a countdown to the next phase / kickoff.
      const secs = phase === 'PRE' ? match.kickoff_in_seconds : match.next_phase_in_seconds;
      if (secs != null && !isNaN(secs)) { this.frozenCountdown = Number(secs); this.frozenAnchorMs = Date.now(); }
      else { this.frozenCountdown = null; }
      this.renderClock();
      return;
    }
    this.frozen = false;
    const target = targetSecondsFromMatch(match);
    if (target == null) { this.renderClock(); return; }
    const cur = this.currentSeconds();
    const apiMin = Math.floor(target / 60), dispMin = Math.floor(cur / 60);
    if (this.anchorMs == null || apiMin > dispMin || (dispMin - apiMin) >= LIVE_CFG.SNAP_DRIFT_MIN) {
      this.baseSeconds = target; this.anchorMs = Date.now();
    }
    this.renderClock();
  }
  currentSeconds() {
    if (this.anchorMs == null) return this.baseSeconds || 0;
    return (this.baseSeconds || 0) + (Date.now() - this.anchorMs) / 1000;
  }
  startClock() {
    this.renderClock();
    this.clockId = setInterval(() => {
      if (!this.container.isConnected) { this.stop(); return; }
      this.renderClock();
    }, LIVE_CFG.CLOCK_TICK_MS);
  }
  renderClock() {
    const r = this.refs; if (!r.clockMain) return;
    const phase = this.phase;
    const live = this.match && this.match.status === 'live';
    r.clock.className = 'lv-clock ' + (live ? 'live' : this.match && this.match.status === 'finished' ? 'post' : 'pre');

    if (phase === 'HT') {
      r.clockMain.textContent = 'HT';
      r.clockExtra.textContent = this.frozenCountdownText('2H in ');
    } else if (phase === 'PRE') {
      r.clockMain.textContent = 'KICKOFF';
      r.clockExtra.textContent = this.frozenCountdownText('in ');
    } else if (phase === 'PEN') {
      r.clockMain.textContent = 'PENS';
      r.clockExtra.textContent = '';
    } else if (phase === 'FT' || phase === 'FT_PEN') {
      r.clockMain.textContent = 'FT';
      r.clockExtra.textContent = phase === 'FT_PEN' ? 'pens' : '';
    } else {
      const { main, extra } = formatClock(phase, this.currentSeconds());
      r.clockMain.textContent = main;
      r.clockExtra.textContent = extra || '';
    }
    r.phaseChip.textContent = phaseChipText(this.match);
  }
  frozenCountdownText(prefix) {
    if (this.frozenCountdown == null || this.frozenAnchorMs == null) return '';
    const left = this.frozenCountdown - (Date.now() - this.frozenAnchorMs) / 1000;
    if (left <= 0) return '';
    return prefix + fmtMS(left);
  }

  // ── Pitch ──
  renderPitch() {
    const r = this.refs;
    const s = (this.stats && (this.stats.stats || this.stats)) || {};
    const homePos = numOr(s.home_possession ?? s.possession_home, null);
    const awayPos = numOr(s.away_possession ?? s.possession_away, null);
    const hShots = numOr(s.home_shots ?? s.shots_home, null);
    const aShots = numOr(s.away_shots ?? s.shots_away, null);
    const hOT = numOr(s.home_shots_on_target ?? s.shots_on_target_home ?? s.on_target_home, null);
    const aOT = numOr(s.away_shots_on_target ?? s.shots_on_target_away ?? s.on_target_away, null);
    const hReds = numOr(s.home_reds ?? s.red_home, 0);
    const aReds = numOr(s.away_reds ?? s.red_away, 0);

    const events = extractEvents(this.stats);
    const homeCode = this.home && this.home.fifa_code, awayCode = this.away && this.away.fifa_code;

    r.pitch.innerHTML = '';
    const W = 600, H = 300;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', class: 'lv-pitch-svg', role: 'img',
      'aria-label': 'Match pitch showing possession territory and goal locations' });

    // possession territory: divider at home%; if unknown, centre.
    const hp = homePos != null ? homePos : (awayPos != null ? 100 - awayPos : 50);
    const ap = awayPos != null ? awayPos : 100 - hp;
    const x0 = 18, x1 = W - 18, span = x1 - x0;
    const divX = x0 + span * (hp / 100);

    // washes
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: divX, height: H, fill: 'var(--lv-home)', 'fill-opacity': 0.08 }));
    svg.appendChild(svgEl('rect', { x: divX, y: 0, width: W - divX, height: H, fill: 'var(--lv-away)', 'fill-opacity': 0.08 }));

    // pitch lines
    const lines = svgEl('g', { stroke: 'var(--text-3)', 'stroke-opacity': 0.32, fill: 'none', 'stroke-width': 2 });
    lines.appendChild(svgEl('rect', { x: 18, y: 18, width: 564, height: 264, rx: 3 }));
    lines.appendChild(svgEl('line', { x1: 300, y1: 18, x2: 300, y2: 282 }));
    lines.appendChild(svgEl('circle', { cx: 300, cy: 150, r: 46 }));
    lines.appendChild(svgEl('rect', { x: 18, y: 80, width: 78, height: 140 }));
    lines.appendChild(svgEl('rect', { x: 18, y: 120, width: 30, height: 60 }));
    lines.appendChild(svgEl('rect', { x: 504, y: 80, width: 78, height: 140 }));
    lines.appendChild(svgEl('rect', { x: 552, y: 120, width: 30, height: 60 }));
    svg.appendChild(lines);
    svg.appendChild(svgEl('circle', { cx: 300, cy: 150, r: 3, fill: 'var(--text-3)', 'fill-opacity': 0.5 }));

    // territory divider
    svg.appendChild(svgEl('line', { x1: divX, y1: 22, x2: divX, y2: 278, stroke: 'var(--lv-home)', 'stroke-opacity': 0.5, 'stroke-width': 2, 'stroke-dasharray': '3 5' }));

    // possession labels at each end
    if (homePos != null || awayPos != null) {
      svg.appendChild(svgEl('text', { x: 34, y: 40, fill: 'var(--lv-home)', 'font-size': 12, class: 'lv-pitch-num' },
        `${homeCode || 'HOME'} ${Math.round(hp)}%`));
      const aT = svgEl('text', { x: 566, y: 40, fill: 'var(--lv-away)', 'font-size': 12, 'text-anchor': 'end', class: 'lv-pitch-num' },
        `${Math.round(ap)}% ${awayCode || 'AWAY'}`);
      svg.appendChild(aT);
    }

    // goal pins — home attacks right, away attacks left. Own goals credit the
    // opposite side. Distribute multiple goals vertically near the goalmouth.
    const homeGoals = [], awayGoals = [];
    for (const ev of events) {
      if (ev.kind !== 'goal') continue;
      let side = ev.teamCode === homeCode ? 'home' : ev.teamCode === awayCode ? 'away' : null;
      if (side && ev.og) side = side === 'home' ? 'away' : 'home'; // own goal credits opponent
      if (side === 'home') homeGoals.push(ev); else if (side === 'away') awayGoals.push(ev);
    }
    const placeGoals = (list, side) => {
      const n = list.length; if (!n) return;
      list.forEach((ev, idx) => {
        const cx = side === 'home' ? 512 + (idx % 2 === 0 ? 0 : 22) : 88 - (idx % 2 === 0 ? 0 : 22);
        const cy = 150 + (idx - (n - 1) / 2) * 34;
        const color = side === 'home' ? 'var(--lv-home)' : 'var(--lv-away)';
        const g = svgEl('g', { class: 'lv-goalpin' });
        g.appendChild(svgEl('circle', { cx, cy, r: 13, fill: color }));
        const ball = svgEl('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--on-accent)' }, '⚽');
        g.appendChild(ball);
        g.appendChild(svgEl('text', { x: cx, y: cy - 18, 'text-anchor': 'middle', fill: color, 'font-size': 11, class: 'lv-pitch-min' },
          ev.minuteLabel + (ev.og ? ' OG' : '')));
        svg.appendChild(g);
      });
    };
    placeGoals(homeGoals, 'home');
    placeGoals(awayGoals, 'away');

    // shot / on-target badges + red-card man indicator at each end
    const shotText = (sh, ot) => sh != null ? `${sh} shots${ot != null ? ` · ${ot} on target` : ''}` : null;
    const hTxt = shotText(hShots, hOT), aTxt = shotText(aShots, aOT);
    if (hTxt) svg.appendChild(svgEl('text', { x: 512, y: 252, 'text-anchor': 'middle', fill: 'var(--text-2)', 'font-size': 12, class: 'lv-pitch-badge' }, hTxt));
    if (aTxt) svg.appendChild(svgEl('text', { x: 92, y: 252, 'text-anchor': 'middle', fill: 'var(--text-2)', 'font-size': 12, class: 'lv-pitch-badge' }, aTxt));
    if (hReds > 0) svg.appendChild(svgEl('text', { x: 512, y: 272, 'text-anchor': 'middle', fill: 'var(--danger-text)', 'font-size': 11, class: 'lv-pitch-badge' }, `down to ${11 - hReds} players`));
    if (aReds > 0) svg.appendChild(svgEl('text', { x: 92, y: 272, 'text-anchor': 'middle', fill: 'var(--danger-text)', 'font-size': 11, class: 'lv-pitch-badge' }, `down to ${11 - aReds} players`));

    r.pitch.appendChild(svg);

    if (homePos == null && awayPos == null && !events.length) {
      r.pitch.appendChild(el('div', { class: 'lv-pitch-empty' }, 'Possession & shots populate once the match feed reports them.'));
    }
  }

  // ── Stat bars ──
  renderStats() {
    const r = this.refs;
    r.statsNote.textContent = this.match.status === 'finished' ? 'final' : 'updating';
    const s = (this.stats && (this.stats.stats || this.stats)) || {};
    const rows = [
      ['Possession %', s.home_possession ?? s.possession_home, s.away_possession ?? s.possession_away],
      ['Shots', s.home_shots ?? s.shots_home, s.away_shots ?? s.shots_away],
      ['On target', s.home_shots_on_target ?? s.shots_on_target_home, s.away_shots_on_target ?? s.shots_on_target_away],
      ['Corners', s.home_corners ?? s.corners_home, s.away_corners ?? s.corners_away],
      ['Fouls', s.home_fouls ?? s.fouls_home, s.away_fouls ?? s.fouls_away],
      ['Yellow', s.home_yellows ?? s.yellow_home, s.away_yellows ?? s.yellow_away],
      ['Red', s.home_reds ?? s.red_home, s.away_reds ?? s.red_away],
    ].map(([label, a, b]) => [label, numOr(a, null), numOr(b, null)]);

    r.stats.innerHTML = '';
    let any = false;
    for (const [label, v1, v2] of rows) {
      if (v1 == null && v2 == null) continue;
      any = true;
      if (v1 == null || v2 == null) {
        r.stats.appendChild(el('div', { class: 'lv-stat-pending' },
          el('span', { class: 'lv-lab' }, label), el('span', { class: 'lv-pend' }, 'populating…')));
        continue;
      }
      const total = (v1 + v2) || 1;
      const p1 = Math.max(6, Math.round(v1 / total * 100));
      const p2 = Math.max(6, Math.round(v2 / total * 100));
      r.stats.appendChild(el('div', { class: 'lv-stat' },
        el('div', { class: 'lv-stat-head' },
          el('span', { class: 'lv-v1' }, String(v1)),
          el('span', { class: 'lv-lab' }, label),
          el('span', { class: 'lv-v2' }, String(v2)),
        ),
        el('div', { class: 'lv-bar' },
          el('div', { class: 'lv-f1', style: `flex:${p1}` }),
          el('div', { class: 'lv-f2', style: `flex:${p2}` }),
        ),
      ));
    }
    if (!any) r.stats.appendChild(el('div', { class: 'lv-empty' },
      this.match.status === 'scheduled' ? 'Stats begin once the match kicks off.' : 'Stats not reported by the feed yet.'));
  }

  // ── Timeline (newest first; animate genuinely new rows) ──
  renderTimeline() {
    const r = this.refs;
    const events = extractEvents(this.stats).filter(e => e.kind !== 'other');
    events.sort((a, b) => b.sortKey - a.sortKey || b.i - a.i);
    r.timeline.innerHTML = '';
    if (!events.length) {
      r.timeline.appendChild(el('div', { class: 'lv-empty' },
        this.match.status === 'scheduled' ? 'No events yet — kickoff imminent.' : 'No goals or cards yet.'));
      return;
    }
    for (const ev of events) {
      const isNew = !this.seenEventKeys.has(ev.key);
      const row = el('div', { class: `lv-ev lv-ev-${ev.cls}${isNew ? ' lv-ev-new' : ''}` },
        el('span', { class: 'lv-ev-min' }, ev.minuteLabel),
        el('span', { class: 'lv-ev-type' }, ev.label),
        el('span', { class: 'lv-ev-who' }, ev.player ? playerLink(ev.player) : ''),
        el('span', { class: 'lv-ev-team' }, ev.teamCode || ''),
      );
      r.timeline.appendChild(row);
      this.seenEventKeys.add(ev.key);
    }
  }

  // ── Goalscorers ──
  renderScorers() {
    const r = this.refs;
    const events = extractEvents(this.stats).filter(e => e.kind === 'goal');
    const homeCode = this.home && this.home.fifa_code, awayCode = this.away && this.away.fifa_code;
    const buckets = { home: new Map(), away: new Map() };
    for (const ev of events) {
      let side = ev.teamCode === homeCode ? 'home' : ev.teamCode === awayCode ? 'away' : null;
      if (side && ev.og) side = side === 'home' ? 'away' : 'home';
      if (!side) continue;
      const name = ev.player + (ev.og ? ' (OG)' : ev.pen ? ' (pen)' : '');
      if (!buckets[side].has(name)) buckets[side].set(name, []);
      buckets[side].get(name).push(ev.minuteLabel);
    }
    r.scorers.innerHTML = '';
    for (const side of ['home', 'away']) {
      const team = side === 'home' ? this.home : this.away;
      const card = el('div', { class: 'lv-sc-card' });
      card.appendChild(el('div', { class: 'lv-lab', style: 'margin-bottom:8px' }, `${team ? team.fifa_code : '?'} scorers`));
      const list = Array.from(buckets[side].entries());
      if (!list.length) card.appendChild(el('div', { class: 'lv-sc-row muted' }, '—'));
      else for (const [name, mins] of list) {
        const baseName = name.replace(/ \((OG|pen)\)$/, '');
        card.appendChild(el('div', { class: 'lv-sc-row' },
          playerLink(baseName), name !== baseName ? el('span', { class: 'lv-sc-tag' }, name.match(/\((OG|pen)\)/)[0]) : null,
          ' ', el('span', { class: 'lv-sc-mins' }, mins.join(', '))));
      }
      r.scorers.appendChild(card);
    }
  }

  // ── Shootout ──
  renderShootout() {
    const r = this.refs;
    const m = this.match;
    const isPen = m.phase === 'PEN' || m.phase === 'FT_PEN' || (m.home_pen != null && m.away_pen != null);
    if (!isPen) { r.shootoutSec.style.display = 'none'; return; }
    r.shootoutSec.style.display = '';
    r.shootout.innerHTML = '';
    const h = this.home, a = this.away;
    r.shootout.appendChild(el('div', { class: 'lv-pen-line' },
      el('span', { class: 'lv-pen-code' }, h ? h.fifa_code : 'H'),
      el('span', { class: 'lv-pen-num' }, String(m.home_pen ?? 0)),
      el('span', { class: 'lv-pen-dash' }, '–'),
      el('span', { class: 'lv-pen-num away' }, String(m.away_pen ?? 0)),
      el('span', { class: 'lv-pen-code' }, a ? a.fifa_code : 'A'),
    ));
    r.shootout.appendChild(el('div', { class: 'lv-foot', style: 'margin-top:8px' },
      'Per-kick detail isn’t carried by the feed — running shootout total shown.'));
  }

  // ── Group impact ──
  renderGroup() {
    const r = this.refs;
    const rows = this.groupStandings;
    const letter = this.match.group_name;
    r.groupTtl.textContent = `Group ${letter || ''} · live table`.trim();
    if (!rows || !rows.length) { r.group.innerHTML = ''; r.group.appendChild(el('div', { class: 'lv-empty' }, 'Standings compute from results as the group plays out.')); return; }
    const meCodes = new Set([this.home && this.home.fifa_code, this.away && this.away.fifa_code].filter(Boolean));
    r.group.innerHTML = '';
    r.group.appendChild(el('div', { class: 'lv-gst-head' },
      el('span', {}, '#'), el('span', {}, 'Team'),
      el('span', { style: 'text-align:center' }, 'P'),
      el('span', { style: 'text-align:center' }, 'GD'),
      el('span', { style: 'text-align:center' }, 'PTS')));
    rows.forEach((row, i) => {
      const me = row.code && meCodes.has(row.code);
      const node = el('div', { class: `lv-gst-row${me ? ' me' : ''}${i < 2 ? ' q' : ''}` });
      node.appendChild(el('span', { class: 'lv-gst-pos' }, String(i + 1)));
      const nm = el('div', { class: 'lv-gst-name' });
      const fl = el('span', { class: 'lv-gst-flag' });
      if (row.code && flagSrc(row.code)) fl.style.backgroundImage = `url(${flagSrc(row.code)})`;
      nm.appendChild(fl); nm.appendChild(el('span', {}, row.team || row.code));
      node.appendChild(nm);
      node.appendChild(el('span', { class: 'lv-gst-c' }, String(row.played ?? 0)));
      const gd = row.gd != null ? row.gd : (row.gf ?? 0) - (row.ga ?? 0);
      node.appendChild(el('span', { class: 'lv-gst-c' }, gd > 0 ? `+${gd}` : String(gd)));
      node.appendChild(el('span', { class: 'lv-gst-pts' }, String(row.points ?? 0)));
      r.group.appendChild(node);
    });
  }

  // ── Polling ──
  startPolling() {
    const ms = this.mode === 'test' ? LIVE_CFG.POLL_MS_TEST : LIVE_CFG.POLL_MS;
    this.pollId = setInterval(() => this.poll(), ms);
  }
  async poll(force = false) {
    if (!this.container.isConnected) { this.stop(); return; }
    if (!force && document.hidden) return; // don't burn budget on a hidden tab
    try {
      const { match, stats } = await this.fetchData();
      if (!match) return;
      if (!this.home || !this.away) await this.resolveTeams(match);
      this.update(match, stats);
      // A real match that has ended: keep the final picture, stop polling.
      if (this.mode === 'live' && match.status === 'finished') {
        clearInterval(this.pollId); this.pollId = null;
      }
    } catch (e) { /* transient; next tick retries */ }
  }
  stop() {
    if (this.pollId) clearInterval(this.pollId);
    if (this.clockId) clearInterval(this.clockId);
    this.pollId = this.clockId = null;
    document.removeEventListener('visibilitychange', this._onVis);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function numOr(v, fallback) { const n = Number(v); return (v == null || isNaN(n)) ? fallback : n; }
function synthTeam(name, code) {
  if (!name && !code) return null;
  return { fifa_code: code || (name || '').slice(0, 3).toUpperCase(), name: name || code };
}
function pickGroupObj(groups, letter) {
  if (!groups || !letter) return null;
  const arr = Array.isArray(groups) ? groups : (groups.data || groups.groups || []);
  if (!Array.isArray(arr)) return null;
  return arr.find(g => (g.group_name || g.name || g.letter) === letter) || null;
}
function statusText(m) {
  if (m.status === 'live') return ({ '1H': 'Live · 1st half', HT: 'Halftime', '2H': 'Live · 2nd half', ET1: 'Live · ET', ET2: 'Live · ET', PEN: 'Penalties' })[m.phase] || 'Live';
  if (m.status === 'finished') return m.phase === 'FT_PEN' ? 'Full time · pens' : 'Full time';
  return 'Upcoming';
}
function stageText(m) {
  const ROUND = { group: 'Group', round_of_32: 'Round of 32', round_of_16: 'Round of 16', quarter_final: 'Quarterfinal', semi_final: 'Semifinal', third_place: 'Third place', final: 'Final' };
  if (m.round === 'group') return `Group ${m.group_name || '?'} · Match ${m.match_number}`;
  return `${ROUND[m.round] || m.round || ''} · Match ${m.match_number}`;
}
function phaseChipText(m) {
  if (!m) return '';
  if (m.status === 'finished') return m.phase === 'FT_PEN' ? 'Decided on penalties' : 'Full time';
  if (m.phase === '1H') return 'First half · clock ticks locally';
  if (m.phase === '2H') return 'Second half · clock ticks locally';
  if (m.phase === 'HT') return 'Halftime break';
  if (m.phase === 'ET1' || m.phase === 'ET2') return 'Extra time';
  if (m.phase === 'PEN') return 'Penalty shootout';
  if (m.phase === 'PRE') return 'Pre-match';
  return '';
}

// ─── CSS (concatenated into gameCss so popup + page both pick it up) ───────────
export const liveCss = `
  .lv-root{position:relative;--lv-home:var(--accent);--lv-away:var(--away)}
  .lv-loading{padding:60px 20px;text-align:center;font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text-3)}
  .lv-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  .lv-error{padding:30px 20px;text-align:center;font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--danger-text);background:var(--danger-quiet);border:1px solid var(--danger);border-radius:var(--r-md);max-width:580px;margin:30px auto}
  .lv-lab{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-3)}

  .lv-statusrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
  .lv-pill{display:inline-flex;align-items:center;gap:7px;font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;padding:5px 11px;border-radius:var(--r-xs)}
  .lv-pill.live{color:var(--live);background:var(--live-quiet)}
  .lv-pill.live::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;animation:wc-pulse 1.3s ease infinite}
  .lv-pill.pre{color:var(--accent-text);background:var(--accent-quiet)}
  .lv-pill.post{color:var(--text-2);background:var(--surface-2)}
  .lv-stage{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3)}

  .lv-scoreboard{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(8px,3vw,40px);margin-top:6px;animation:wc-reveal-up .5s var(--ease-spring) both;container-type:inline-size}
  .lv-team{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0;color:inherit;text-decoration:none;transition:transform var(--dur-2),filter var(--dur-2)}
  .lv-team[href]{cursor:pointer}
  .lv-team[href]:hover{transform:translateY(-2px) scale(1.03);filter:drop-shadow(0 6px 16px rgba(0,0,0,0.4))}
  .lv-flag{width:clamp(64px,15cqi,104px);height:clamp(46px,11cqi,76px);border-radius:var(--r-sm);background-size:cover;background-position:center;box-shadow:var(--sh-2),0 0 0 1px rgba(0,0,0,.18)}
  .lv-flag.empty{background:repeating-linear-gradient(135deg,var(--surface-2) 0 6px,var(--surface-3) 6px 12px);display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-size:28px;color:var(--text-3)}
  .lv-code{font-family:var(--f-display);font-size:clamp(30px,8cqi,50px);line-height:0.9;letter-spacing:0.02em;color:var(--text)}
  .lv-name{font-family:var(--f-body);font-weight:600;font-size:clamp(11px,1.5cqi,14px);color:var(--text-3);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .lv-mid{display:flex;flex-direction:column;align-items:center;gap:8px}
  .lv-score{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:clamp(46px,15cqi,88px);line-height:0.8;letter-spacing:-0.02em;white-space:nowrap;display:flex;align-items:baseline;gap:0;position:relative}
  .lv-score .lv-s1{color:var(--lv-home)}
  .lv-score .lv-s2{color:var(--lv-away)}
  .lv-score .lv-sdash{color:var(--text-3);margin:0 clamp(4px,1.5cqi,10px)}
  .lv-score .lv-pens{font-family:var(--f-body);font-weight:800;font-size:12px;color:var(--text-2);margin-left:10px;align-self:center}
  .lv-score.flash .lv-s1,.lv-score.flash .lv-s2{animation:lv-scoreflash .9s cubic-bezier(.3,1.4,.5,1)}
  @keyframes lv-scoreflash{0%{transform:scale(1)}35%{transform:scale(1.35);color:var(--text)}100%{transform:scale(1)}}
  .lv-clock{display:flex;align-items:baseline;gap:7px;font-family:var(--f-mono);font-variant-numeric:tabular-nums}
  .lv-clock-main{font-weight:700;font-size:clamp(22px,5cqi,32px);letter-spacing:0.02em;color:var(--text)}
  .lv-clock.live .lv-clock-main{color:var(--live)}
  .lv-clock.pre .lv-clock-main{color:var(--accent-text)}
  .lv-clock.post .lv-clock-main{color:var(--text-2)}
  .lv-clock-extra{font-weight:700;font-size:13px;color:var(--accent-text)}
  .lv-phasechip{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-2);background:var(--surface-2);border:1px solid var(--border);padding:4px 10px;border-radius:var(--r-pill);text-align:center}

  .lv-goalflash{position:absolute;left:50%;top:0;transform:translate(-50%,-10px) scale(.8);font-family:var(--f-display);font-size:64px;color:var(--accent-text);letter-spacing:0.06em;opacity:0;pointer-events:none;z-index:30}
  .lv-goalflash.show{animation:lv-goalburst 1.5s cubic-bezier(.2,.9,.3,1.2)}
  @keyframes lv-goalburst{0%{opacity:0;transform:translate(-50%,10px) scale(.6)}18%{opacity:1;transform:translate(-50%,-6px) scale(1.1)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-20px) scale(1)}}

  .lv-section{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px 18px;margin-top:14px;animation:wc-reveal-up .5s ease both;container-type:inline-size}
  .lv-sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:13px}
  .lv-sec-ttl{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-text)}
  .lv-sec-note{font-family:var(--f-body);font-weight:700;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-3)}
  .lv-empty{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-3);padding:4px 0}

  .lv-pitch-wrap{position:relative}
  .lv-pitch-svg{display:block;border-radius:var(--r-md);border:1px solid var(--border);background:var(--surface-sunken)}
  .lv-pitch-num{font-family:var(--f-display)}
  .lv-pitch-min{font-family:var(--f-mono);font-weight:700}
  .lv-pitch-badge{font-family:var(--f-body);font-weight:800}
  .lv-goalpin{animation:wc-pulse 2.4s ease infinite;transform-box:fill-box;transform-origin:center}
  .lv-pitch-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 30px;font-family:var(--f-body);font-weight:600;font-size:12px;color:var(--text-3)}

  .lv-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @container (max-width:680px){.lv-cols{grid-template-columns:1fr}}

  .lv-stat{margin-bottom:12px}
  .lv-stat-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
  .lv-stat-head .lv-v1{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:16px;color:var(--lv-home)}
  .lv-stat-head .lv-v2{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:16px;color:var(--lv-away)}
  .lv-bar{display:flex;gap:3px;height:6px}
  .lv-bar .lv-f1{background:var(--lv-home);border-radius:var(--r-xs);transform-origin:right;animation:wc-grow-x .6s cubic-bezier(.4,0,.18,1) both}
  .lv-bar .lv-f2{background:var(--lv-away);border-radius:var(--r-xs);transform-origin:left;animation:wc-grow-x .6s cubic-bezier(.4,0,.18,1) both}
  .lv-stat-pending{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border-subtle);margin-bottom:6px}
  .lv-pend{font-family:var(--f-body);font-weight:700;font-size:10px;color:var(--text-3);letter-spacing:0.04em}

  .lv-tl{display:flex;flex-direction:column;gap:10px;max-height:340px;overflow-y:auto}
  .lv-tl::-webkit-scrollbar{width:8px}.lv-tl::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:6px}
  .lv-ev{display:flex;align-items:center;gap:9px}
  .lv-ev-new{animation:lv-evin .5s cubic-bezier(.2,.9,.3,1.2) both}
  @keyframes lv-evin{0%{opacity:0;transform:translateX(-12px)}100%{opacity:1;transform:none}}
  .lv-ev-min{font-family:var(--f-mono);font-weight:700;font-variant-numeric:tabular-nums;font-size:13px;min-width:38px;color:var(--text-2)}
  .lv-ev-type{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;border-radius:var(--r-xs);padding:2px 7px}
  .lv-ev-who{font-family:var(--f-body);font-weight:800;font-size:13px;color:var(--text)}
  .lv-ev-team{font-family:Archivo Expanded,var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.08em;color:var(--text-3);margin-left:auto}
  .lv-ev-goal .lv-ev-type{color:var(--accent-text);background:var(--accent-quiet)}
  .lv-ev-goal .lv-ev-min{color:var(--accent-text)}
  .lv-ev-yellow .lv-ev-type{color:var(--warning-text);background:var(--warning-quiet)}
  .lv-ev-red .lv-ev-type{color:var(--danger-text);background:var(--danger-quiet)}
  .lv-ev-red .lv-ev-min{color:var(--danger-text)}
  a.lv-plink{color:inherit;text-decoration:none;cursor:pointer;transition:color .15s}
  a.lv-plink:hover{color:var(--accent-text)}

  .lv-scorers{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @container (max-width:520px){.lv-scorers{grid-template-columns:1fr}}
  .lv-sc-row{font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text);padding:2px 0}
  .lv-sc-row.muted{color:var(--text-3)}
  .lv-sc-mins{color:var(--text-3);font-weight:600;font-family:var(--f-mono);font-variant-numeric:tabular-nums;font-size:11px}
  .lv-sc-tag{font-family:var(--f-body);font-weight:800;font-size:9px;color:var(--text-2);margin-left:4px}

  .lv-pen-line{display:flex;align-items:center;justify-content:center;gap:14px;padding:8px 0}
  .lv-pen-code{font-family:var(--f-body);font-weight:800;font-size:13px;color:var(--text-2)}
  .lv-pen-num{font-family:var(--f-mono);font-weight:800;font-variant-numeric:tabular-nums;font-size:40px;color:var(--lv-home)}
  .lv-pen-num.away{color:var(--lv-away)}
  .lv-pen-dash{font-family:var(--f-mono);font-weight:800;font-size:24px;color:var(--text-3)}

  .lv-gst-head{display:grid;grid-template-columns:24px 1fr 36px 40px 40px;gap:6px;padding:0 6px 8px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3)}
  .lv-gst-row{display:grid;grid-template-columns:24px 1fr 36px 40px 40px;gap:6px;align-items:center;padding:8px 6px;border-radius:var(--r-sm);margin-bottom:2px}
  .lv-gst-row.q{background:var(--success-quiet)}
  .lv-gst-row.me{background:var(--accent-quiet)}
  .lv-gst-pos{font-family:var(--f-display);font-size:14px;color:var(--text-3)}
  .lv-gst-row.q .lv-gst-pos{color:var(--success-text)}
  .lv-gst-row.me .lv-gst-pos{color:var(--accent-text)}
  .lv-gst-name{display:flex;align-items:center;gap:9px;min-width:0}
  .lv-gst-name span:last-child{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lv-gst-row.me .lv-gst-name span:last-child{color:var(--text);font-weight:800}
  .lv-gst-flag{width:22px;height:16px;flex:none;border-radius:3px;background-size:cover;background-position:center;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
  .lv-gst-c{text-align:center;font-family:var(--f-body);font-weight:700;font-variant-numeric:tabular-nums;font-size:13px;color:var(--text-2)}
  .lv-gst-pts{text-align:center;font-family:var(--f-display);font-size:16px;color:var(--text)}
  .lv-gst-row.me .lv-gst-pts{color:var(--accent-text)}

  .lv-foot{font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-3);text-align:center;margin-top:16px;letter-spacing:0.02em}
`;
