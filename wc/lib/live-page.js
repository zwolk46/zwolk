// /wc/live — the dedicated, full-screen, broadcast-grade LIVE match view.
//
// Data spine: FIFA official API (lib/fifa.js) — live score/clock/lineups/events,
// CORS-open so it runs client-side with no proxy or rate cap. Team colours are
// baked from ESPN (data/enrichment/team-colors.json). Flags come from the local
// /wc/flags set. The page auto-finds whatever match is in play; when nothing is
// live it shows a countdown to the next kickoff.
//
// Everything is one responsive layout: a single full-bleed stage that scales
// from phone to desktop, with one tasteful Back control. No app nav/hero shell.

import { flagSrc } from './flags.js';
// Propagate the ?v= cache-buster from live.html to the fifa.js dependency during
// local dev (plain http.server doesn't revalidate sub-imports). No-op in prod.
const _ver = new URL(import.meta.url).searchParams.get('v');
const fifa = await import('./fifa.js' + (_ver ? '?v=' + encodeURIComponent(_ver) : ''));

const CFG = {
  POLL_MS: 10_000,        // FIFA refresh cadence (score/events/lineups)
  POLL_MS_HALFTIME: 30_000,
  CLOCK_MS: 1_000,        // local seconds tick between polls
  CALENDAR_MS: 60_000,    // empty-state countdown / next-match re-check
};

// ─── colour helpers ───────────────────────────────────────────────────────────
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
  for (const h of pair) { const L = relLum('#' + h); if (L >= 0.15 && L <= 0.72) return '#' + h; }
  let h = '#' + pair[0]; const L = relLum(h);
  return L > 0.72 ? mix(h, '#0a0e0c', 0.32) : mix(h, '#ffffff', 0.42);
}

// ─── DOM helpers ────────────────────────────────────────────────────────────────
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
function flagImg(code, cls) {
  const img = el('img', { class: cls || 'lvx-flag', alt: code || '', loading: 'eager' });
  const local = flagSrc(code);
  img.src = local || fifa.flagUrl(code) || '';
  img.onerror = () => { const f = fifa.flagUrl(code); if (f && img.src !== f) { img.onerror = null; img.src = f; } };
  return img;
}
function backButton() {
  return el('button', {
    class: 'lvx-back', type: 'button', 'aria-label': 'Back to fixtures',
    onclick: () => { if (history.length > 1) history.back(); else location.href = '/wc/fixtures'; },
  }, el('span', { class: 'lvx-back-ar', html: '&#8592;' }));
}

// ─── entry ────────────────────────────────────────────────────────────────────
export async function renderLivePage(root) {
  await loadColors();
  root.innerHTML = '';
  const params = new URLSearchParams(location.search);
  const wantMatch = params.get('m');                 // optional deep link /wc/live?m=40
  let row;
  try { row = await fifa.findLiveMatch(wantMatch ? Number(wantMatch) : null); }
  catch (e) { row = null; }

  if (row && fifa.statusFromCode(row.MatchStatus) === 'live') {
    const ctrl = new LiveController(root, row.IdMatch);
    await ctrl.start();
    return ctrl;
  }
  // Nothing in play (or the requested match isn't live) → countdown view.
  await renderEmpty(root, row);
}

// ─── LIVE controller ────────────────────────────────────────────────────────────
class LiveController {
  constructor(root, idMatch) {
    this.root = root; this.idMatch = idMatch;
    this.m = null; this.events = []; this.refs = {};
    this.playerById = new Map();
    this.baseSec = 0; this.anchor = null; this.phase = null; this.prevScore = null;
    this.seen = new Set(); this.pollId = null; this.clockId = null;
    this._vis = () => { if (!document.hidden) this.poll(true); };
  }

  async fetchAll() {
    const [live, tl] = await Promise.all([fifa.getLive(this.idMatch), fifa.getTimeline(this.idMatch)]);
    return { m: fifa.normalizeLive(live), events: fifa.normalizeTimeline(tl) };
  }

  async start() {
    const { m, events } = await this.fetchAll();
    this.m = m; this.events = events;
    this.indexPlayers();
    this.buildSkeleton();
    this.update({ initial: true });
    this.startClock();
    this.pollId = setInterval(() => this.poll(), CFG.POLL_MS);
    document.addEventListener('visibilitychange', this._vis);
  }

  indexPlayers() {
    this.playerById = new Map();
    for (const t of [this.m.home, this.m.away]) for (const p of t.players) this.playerById.set(String(p.id), { ...p, teamCode: t.code });
  }

  // ── persistent DOM, themed by the two teams ──
  buildSkeleton() {
    const r = this.refs; const m = this.m;
    const hc = accentFor(m.home.code), ac = accentFor(m.away.code);
    this.root.innerHTML = '';
    const stage = el('div', { class: 'lvx-stage' });
    stage.style.setProperty('--home', hc);
    stage.style.setProperty('--away', ac);
    stage.style.setProperty('--home-rgb', hexToRgb(hc).join(','));
    stage.style.setProperty('--away-rgb', hexToRgb(ac).join(','));

    // ambient team-colour wash
    stage.appendChild(el('div', { class: 'lvx-amb lvx-amb-h' }));
    stage.appendChild(el('div', { class: 'lvx-amb lvx-amb-a' }));

    // top bar
    const top = el('div', { class: 'lvx-top' });
    top.appendChild(backButton());
    r.statusPill = el('div', { class: 'lvx-livepill' }, el('span', { class: 'lvx-dot' }), r.statusTxt = el('span', { class: 'lvx-livetxt' }, 'LIVE'));
    r.stage = el('div', { class: 'lvx-stagetag' });
    const topMid = el('div', { class: 'lvx-topmid' }, r.statusPill, r.stage);
    r.venueTag = el('div', { class: 'lvx-venuetag' });
    top.appendChild(topMid); top.appendChild(r.venueTag);
    stage.appendChild(top);

    // hero scoreboard
    const hero = el('div', { class: 'lvx-hero' });
    r.homeSide = this.teamColumn('home');
    r.awaySide = this.teamColumn('away');
    const mid = el('div', { class: 'lvx-heromid' });
    r.score = el('div', { class: 'lvx-score' });
    r.clock = el('div', { class: 'lvx-clock' });
    r.clockMain = el('span', { class: 'lvx-clock-main' }, '0:00');
    r.clockExtra = el('span', { class: 'lvx-clock-extra' });
    r.clock.appendChild(r.clockMain); r.clock.appendChild(r.clockExtra);
    mid.appendChild(r.score); mid.appendChild(r.clock);
    hero.appendChild(r.homeSide.node); hero.appendChild(mid); hero.appendChild(r.awaySide.node);
    stage.appendChild(hero);
    r.goalFlash = el('div', { class: 'lvx-goalflash' }, 'GOAL');
    stage.appendChild(r.goalFlash);

    // info chips
    r.info = el('div', { class: 'lvx-info' });
    stage.appendChild(r.info);

    // body grid: pitch + side rail (timeline/scorers)
    const body = el('div', { class: 'lvx-body' });
    r.pitchWrap = el('div', { class: 'lvx-pitchwrap' });
    r.pitch = el('div', { class: 'lvx-pitch' });
    r.pitchWrap.appendChild(el('div', { class: 'lvx-panel-h' }, el('span', {}, 'Formations'), r.formTag = el('span', { class: 'lvx-panel-sub' })));
    r.pitchWrap.appendChild(r.pitch);
    body.appendChild(r.pitchWrap);

    const rail = el('div', { class: 'lvx-rail' });
    r.statsCard = el('div', { class: 'lvx-card lvx-statscard', style: 'display:none' });
    r.scorersCard = el('div', { class: 'lvx-card' });
    r.scorersCard.appendChild(el('div', { class: 'lvx-card-h' }, 'Scorers'));
    r.scorers = el('div', { class: 'lvx-scorers' });
    r.scorersCard.appendChild(r.scorers);
    r.tlCard = el('div', { class: 'lvx-card lvx-tlcard' });
    r.tlCard.appendChild(el('div', { class: 'lvx-card-h' }, 'Timeline', el('span', { class: 'lvx-card-sub' }, 'live')));
    r.timeline = el('div', { class: 'lvx-tl' });
    r.tlCard.appendChild(r.timeline);
    rail.appendChild(r.statsCard); rail.appendChild(r.scorersCard); rail.appendChild(r.tlCard);
    body.appendChild(rail);
    stage.appendChild(body);

    // footnote
    r.foot = el('div', { class: 'lvx-foot' });
    stage.appendChild(r.foot);

    this.root.appendChild(stage);
  }

  teamColumn(which) {
    const node = el('div', { class: 'lvx-team lvx-team-' + which });
    const flag = el('div', { class: 'lvx-teamflag' });
    const code = el('div', { class: 'lvx-teamcode' });
    const name = el('div', { class: 'lvx-teamname' });
    const form = el('div', { class: 'lvx-teamform' });
    node.appendChild(flag); node.appendChild(code); node.appendChild(name); node.appendChild(form);
    return { node, flag, code, name, form, which };
  }

  // ── in-place update from the latest (m, events) ──
  async poll(force) {
    if (!this.root.isConnected) return this.stop();
    if (!force && document.hidden) return;
    try {
      const { m, events } = await this.fetchAll();
      this.m = m; this.events = events; this.indexPlayers();
      this.update({});
      if (m.status === 'finished') { clearInterval(this.pollId); this.pollId = null; this.refs.foot && this.markFinished(); }
    } catch { /* transient; next tick retries */ }
  }

  update({ initial }) {
    const r = this.refs, m = this.m;
    const live = m.status === 'live';
    r.statusPill.className = 'lvx-livepill ' + (live ? 'is-live' : m.status === 'finished' ? 'is-ft' : 'is-pre');
    r.statusTxt.textContent = live ? 'LIVE' : m.status === 'finished' ? 'FULL TIME' : 'KICKOFF SOON';
    r.stage.textContent = stageLabel(m);
    r.venueTag.textContent = [m.stadium, m.city].filter(Boolean).join(' · ');

    // teams
    this.fillTeam(r.homeSide, m.home);
    this.fillTeam(r.awaySide, m.away);

    // score
    const hs = m.home.score ?? 0, as = m.away.score ?? 0;
    r.score.innerHTML = '';
    r.score.appendChild(el('span', { class: 'lvx-s lvx-s-h' }, String(hs)));
    r.score.appendChild(el('span', { class: 'lvx-sdash' }, '–'));
    r.score.appendChild(el('span', { class: 'lvx-s lvx-s-a' }, String(as)));
    if (m.homePen != null && m.awayPen != null) r.score.appendChild(el('div', { class: 'lvx-pens' }, '(' + m.homePen + '–' + m.awayPen + ' pens)'));
    const key = hs + '-' + as;
    if (!initial && this.prevScore != null && this.prevScore !== key) this.flash();
    this.prevScore = key;

    this.syncClock(m);
    this.renderInfo();
    this.renderPitch();
    this.renderStats();
    this.renderScorers();
    this.renderTimeline();
    this.renderFoot();
  }

  fillTeam(side, t) {
    side.flag.innerHTML = ''; side.flag.appendChild(flagImg(t.code, 'lvx-flagimg'));
    side.code.textContent = t.code || '';
    side.code.style.color = 'var(--' + side.which + ')';
    side.name.textContent = t.name || '';
  }

  flash() {
    const r = this.refs;
    r.score.classList.remove('flash'); void r.score.offsetWidth; r.score.classList.add('flash');
    r.goalFlash.classList.remove('show'); void r.goalFlash.offsetWidth; r.goalFlash.classList.add('show');
    setTimeout(() => r.goalFlash.classList.remove('show'), 1600);
  }

  // ── clock ──
  syncClock(m) {
    this.phase = m.phase;
    if (FROZEN.has(m.phase)) { this.anchor = null; this.renderClock(); return; }
    const tgt = parseMinute(m.minute) * 60;
    const cur = this.curSec();
    const tMin = Math.floor(tgt / 60), cMin = Math.floor(cur / 60);
    if (this.anchor == null || tMin > cMin || cMin - tMin >= 2) { this.baseSec = tgt; this.anchor = Date.now(); }
    this.renderClock();
  }
  curSec() { return this.anchor == null ? this.baseSec : this.baseSec + (Date.now() - this.anchor) / 1000; }
  startClock() { this.renderClock(); this.clockId = setInterval(() => { if (!this.root.isConnected) return this.stop(); this.renderClock(); }, CFG.CLOCK_MS); }
  renderClock() {
    const r = this.refs; if (!r.clockMain) return;
    const m = this.m, ph = this.phase;
    r.clock.className = 'lvx-clock ' + (m.status === 'live' ? 'is-live' : m.status === 'finished' ? 'is-ft' : 'is-pre');
    if (ph === 'HT') { r.clockMain.textContent = 'HALF TIME'; r.clockExtra.textContent = ''; }
    else if (ph === 'PRE') { r.clockMain.textContent = 'KICKOFF'; r.clockExtra.textContent = ''; }
    else if (ph === 'FT' || ph === 'FT_PEN') { r.clockMain.textContent = 'FULL TIME'; r.clockExtra.textContent = ph === 'FT_PEN' ? 'on penalties' : ''; }
    else if (ph === 'PEN') { r.clockMain.textContent = 'PENALTIES'; r.clockExtra.textContent = ''; }
    else { const c = fmtClock(ph, this.curSec()); r.clockMain.textContent = c.main; r.clockExtra.textContent = c.extra || ''; }
  }

  // ── info chips ──
  renderInfo() {
    const r = this.refs, m = this.m;
    const chips = [];
    if (m.minute && m.status === 'live') chips.push(['MIN', m.minute]);
    if (m.attendance) chips.push(['CROWD', m.attendance.toLocaleString('en-US')]);
    const ref = (m.officials.find((o) => /referee/i.test(o.role || '')) || m.officials[0]);
    if (ref && ref.name) chips.push(['REFEREE', ref.name]);
    if (m.groupName) chips.push(['GROUP', String(m.groupName).replace(/group/i, '').trim()]);
    r.info.innerHTML = '';
    for (const [k, v] of chips) r.info.appendChild(el('div', { class: 'lvx-chip' }, el('span', { class: 'lvx-chip-k' }, k), el('span', { class: 'lvx-chip-v' }, v)));
  }

  // ── pitch with formations + photos ──
  renderPitch() {
    const r = this.refs, m = this.m;
    r.formTag.textContent = (m.home.tactics || '') + (m.home.tactics && m.away.tactics ? '  ·  ' : '') + (m.away.tactics || '');
    r.pitch.innerHTML = '';
    const surface = el('div', { class: 'lvx-grass' });
    // markings
    surface.appendChild(el('div', { class: 'lvx-mid-line' }));
    surface.appendChild(el('div', { class: 'lvx-mid-circle' }));
    for (const cls of ['lvx-box lvx-box-top', 'lvx-box lvx-box-bot', 'lvx-six lvx-six-top', 'lvx-six lvx-six-bot']) surface.appendChild(el('div', { class: cls }));
    this.placeXI(surface, m.away, 'away');
    this.placeXI(surface, m.home, 'home');
    r.pitch.appendChild(surface);
    if (!startingXI(m.home).length && !startingXI(m.away).length)
      r.pitch.appendChild(el('div', { class: 'lvx-pitch-empty' }, 'Line-ups appear when the teams are confirmed.'));
  }

  placeXI(surface, team, side) {
    const xi = startingXI(team);
    if (!xi.length) return;
    const rows = fifa.parseFormation(team.tactics) || [Math.max(0, xi.length - 1)];
    const pts = lineupPositions(rows, side, xi.length);
    const goalMap = this.goalsByPlayer();
    const cardMap = this.cardsByPlayer();
    xi.forEach((p, i) => {
      const pos = pts[i] || { x: 0.5, y: side === 'home' ? 0.8 : 0.2 };
      const dot = el('div', { class: 'lvx-pl lvx-pl-' + side, style: 'left:' + (pos.x * 100).toFixed(2) + '%;top:' + (pos.y * 100).toFixed(2) + '%' });
      const av = el('div', { class: 'lvx-av' });
      av.style.setProperty('--c', 'var(--' + side + ')');
      if (p.photo) { const im = el('img', { class: 'lvx-avimg', src: p.photo, alt: p.short, loading: 'lazy' }); im.onerror = () => { im.remove(); av.classList.add('lvx-av-nophoto'); av.textContent = p.number != null ? p.number : ''; }; av.appendChild(im); }
      else { av.classList.add('lvx-av-nophoto'); av.textContent = p.number != null ? p.number : ''; }
      if (p.number != null) dot.appendChild(el('span', { class: 'lvx-num' }, String(p.number)));
      if (p.captain) dot.appendChild(el('span', { class: 'lvx-cap' }, 'C'));
      const badges = el('div', { class: 'lvx-plbadge' });
      const g = goalMap.get(String(p.id)); if (g) badges.appendChild(el('span', { class: 'lvx-bg lvx-bg-goal' }, g > 1 ? '⚽' + g : '⚽'));
      const c = cardMap.get(String(p.id)); if (c) badges.appendChild(el('span', { class: 'lvx-bg lvx-bg-' + c }));
      dot.appendChild(av);
      if (badges.childNodes.length) dot.appendChild(badges);
      dot.appendChild(el('span', { class: 'lvx-plname' }, p.short || p.name || ''));
      surface.appendChild(dot);
    });
  }

  goalsByPlayer() {
    const map = new Map();
    for (const e of this.events) if (e.kind === 'goal' || e.kind === 'penalty') if (e.playerId) map.set(String(e.playerId), (map.get(String(e.playerId)) || 0) + 1);
    return map;
  }
  cardsByPlayer() {
    const map = new Map();
    for (const e of this.events) if (e.kind === 'yellow' || e.kind === 'red') map.set(String(e.playerId), e.kind);
    return map;
  }

  // ── live stats — possession from FIFA when present, plus shots/corners/fouls/
  //    offsides/cards tallied from the official event timeline ──
  computeStats() {
    const m = this.m;
    const blank = () => ({ shots: 0, corners: 0, fouls: 0, offsides: 0, yellows: 0 });
    const home = blank(), away = blank();
    for (const e of this.events) {
      const t = e.teamId === m.home.id ? home : e.teamId === m.away.id ? away : null;
      if (!t) continue;
      if (e.kind === 'shot') t.shots++;
      else if (e.kind === 'corner') t.corners++;
      else if (e.kind === 'foul') t.fouls++;
      else if (e.kind === 'offside') t.offsides++;
      else if (e.kind === 'yellow') t.yellows++;
    }
    return { home, away };
  }
  renderStats() {
    const r = this.refs, m = this.m;
    const s = this.computeStats();
    let rows = [];
    if (m.possession && (m.possession.home != null || m.possession.away != null)) rows.push(['Possession %', m.possession.home || 0, m.possession.away || 0]);
    rows.push(['Shots', s.home.shots, s.away.shots], ['Corners', s.home.corners, s.away.corners],
      ['Fouls', s.home.fouls, s.away.fouls], ['Offsides', s.home.offsides, s.away.offsides], ['Yellow cards', s.home.yellows, s.away.yellows]);
    rows = rows.filter(([l, a, b]) => l.indexOf('Possession') === 0 || a || b);
    if (!rows.length) { r.statsCard.style.display = 'none'; return; }
    r.statsCard.style.display = '';
    r.statsCard.innerHTML = '';
    r.statsCard.appendChild(el('div', { class: 'lvx-card-h' }, 'Match stats', el('span', { class: 'lvx-card-sub' }, 'live · official events')));
    for (const [label, a, b] of rows) {
      const av = Number(a) || 0, bv = Number(b) || 0;
      r.statsCard.appendChild(el('div', { class: 'lvx-stat' },
        el('div', { class: 'lvx-stat-top' }, el('b', { style: 'color:var(--home)' }, String(av)), el('span', {}, label), el('b', { style: 'color:var(--away)' }, String(bv))),
        el('div', { class: 'lvx-stat-bar' }, el('i', { style: 'flex:' + (av || 0.001) + ';background:var(--home)' }), el('i', { style: 'flex:' + (bv || 0.001) + ';background:var(--away)' }))));
    }
  }

  // ── scorers ──
  renderScorers() {
    const r = this.refs, m = this.m;
    const goals = this.events.filter((e) => e.kind === 'goal' || e.kind === 'penalty' || e.kind === 'own_goal');
    r.scorers.innerHTML = '';
    if (!goals.length) { r.scorers.appendChild(el('div', { class: 'lvx-muted' }, 'No goals yet.')); return; }
    for (const side of ['home', 'away']) {
      const team = m[side];
      const list = goals.filter((g) => g.teamId === team.id);
      const col = el('div', { class: 'lvx-sc-col' });
      col.appendChild(el('div', { class: 'lvx-sc-team', style: 'color:var(--' + side + ')' }, team.code));
      if (!list.length) col.appendChild(el('div', { class: 'lvx-muted' }, '—'));
      for (const g of list) {
        const p = this.playerById.get(String(g.playerId));
        const row = el('div', { class: 'lvx-sc-row' });
        if (p && p.photo) row.appendChild(el('img', { class: 'lvx-sc-face', src: p.photo, alt: '' }));
        row.appendChild(el('span', { class: 'lvx-sc-name' }, (g.player || (p && p.short) || 'Goal') + (g.kind === 'own_goal' ? ' (OG)' : g.kind === 'penalty' ? ' (P)' : '')));
        row.appendChild(el('span', { class: 'lvx-sc-min' }, g.minuteLabel));
        col.appendChild(row);
      }
      r.scorers.appendChild(col);
    }
  }

  // ── timeline ──
  renderTimeline() {
    const r = this.refs, m = this.m;
    const evs = this.events.filter((e) => ['goal', 'penalty', 'own_goal', 'yellow', 'red', 'sub'].includes(e.kind));
    r.timeline.innerHTML = '';
    if (!evs.length) { r.timeline.appendChild(el('div', { class: 'lvx-muted' }, 'No events yet — kickoff imminent.')); return; }
    for (const e of evs) {
      const side = e.teamId === m.home.id ? 'home' : 'away';
      const isNew = !this.seen.has(e.id); this.seen.add(e.id);
      const row = el('div', { class: 'lvx-ev lvx-ev-' + side + (isNew ? ' lvx-ev-new' : '') });
      row.appendChild(el('span', { class: 'lvx-ev-min' }, e.minuteLabel));
      row.appendChild(el('span', { class: 'lvx-ev-ic lvx-ev-ic-' + e.kind }, eventIcon(e.kind)));
      const who = el('span', { class: 'lvx-ev-who' }, e.player || e.label);
      row.appendChild(who);
      if (e.kind === 'goal' || e.kind === 'penalty' || e.kind === 'own_goal') row.appendChild(el('span', { class: 'lvx-ev-sc' }, (e.homeGoals ?? '') + '–' + (e.awayGoals ?? '')));
      row.appendChild(el('span', { class: 'lvx-ev-team', style: 'color:var(--' + side + ')' }, side === 'home' ? m.home.code : m.away.code));
      r.timeline.appendChild(row);
    }
  }

  renderFoot() {
    this.refs.foot.innerHTML = '';
    this.refs.foot.appendChild(el('span', { class: 'lvx-prov' },
      'Live score, clock & events — FIFA official, refreshed every ' + (CFG.POLL_MS / 1000) + 's (clock ticks each second). Line-ups & player photos — FIFA. Team colours — ESPN. Unofficial fan project, not affiliated with FIFA.'));
  }
  markFinished() { this.refs.statusTxt && (this.refs.statusTxt.textContent = 'FULL TIME'); }

  stop() {
    if (this.pollId) clearInterval(this.pollId);
    if (this.clockId) clearInterval(this.clockId);
    this.pollId = this.clockId = null;
    document.removeEventListener('visibilitychange', this._vis);
  }
}

// ─── empty / countdown state ────────────────────────────────────────────────────
async function renderEmpty(root, maybeRow) {
  root.innerHTML = '';
  const stage = el('div', { class: 'lvx-stage lvx-empty' });
  const top = el('div', { class: 'lvx-top' }); top.appendChild(backButton());
  top.appendChild(el('div', { class: 'lvx-topmid' }, el('div', { class: 'lvx-livepill is-pre' }, el('span', { class: 'lvx-dot' }), el('span', { class: 'lvx-livetxt' }, 'NO MATCH LIVE'))));
  top.appendChild(el('div', {}));
  stage.appendChild(top);

  let rows = [];
  try { rows = await fifa.getCalendar({ count: 160 }); } catch {}
  const now = Date.now();
  const scheduled = rows.filter((r) => fifa.statusFromCode(r.MatchStatus) !== 'finished' && Date.parse(r.Date) > now - 2 * 3600e3)
    .sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date));
  const next = scheduled[0];

  const card = el('div', { class: 'lvx-empty-card' });
  card.appendChild(el('div', { class: 'lvx-empty-kicker' }, 'No match is being played right now'));
  if (next) {
    const nt = await teamsFor(next.IdMatch);
    const hc = nt && nt.home.code, ac = nt && nt.away.code;
    if (hc) stage.style.setProperty('--home', accentFor(hc));
    if (ac) stage.style.setProperty('--away', accentFor(ac));
    card.appendChild(el('div', { class: 'lvx-empty-next' }, 'NEXT KICKOFF'));
    const mu = el('div', { class: 'lvx-empty-mu' });
    mu.appendChild(el('div', { class: 'lvx-empty-team' }, flagImg(hc, 'lvx-empty-flag'), el('span', { style: 'color:var(--home)' }, hc || '')));
    mu.appendChild(el('div', { class: 'lvx-empty-vs' }, 'v'));
    mu.appendChild(el('div', { class: 'lvx-empty-team' }, flagImg(ac, 'lvx-empty-flag'), el('span', { style: 'color:var(--away)' }, ac || '')));
    card.appendChild(mu);
    const cd = el('div', { class: 'lvx-count' }); card.appendChild(cd);
    const venue = [descOf(next.Stadium && next.Stadium.Name), descOf(next.Stadium && next.Stadium.CityName)].filter(Boolean).join(' · ');
    if (venue) card.appendChild(el('div', { class: 'lvx-empty-venue' }, venue));
    const tick = () => {
      const left = Date.parse(next.Date) - Date.now();
      cd.innerHTML = '';
      if (left <= 0) { cd.appendChild(el('span', { class: 'lvx-count-live' }, 'Kicking off…')); return; }
      const s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60;
      const seg = (n, l) => el('div', { class: 'lvx-count-seg' }, el('b', {}, String(n).padStart(2, '0')), el('i', {}, l));
      if (d > 0) cd.appendChild(seg(d, 'days'));
      cd.appendChild(seg(h, 'hrs')); cd.appendChild(seg(mi, 'min')); cd.appendChild(seg(se, 'sec'));
    };
    tick(); setInterval(tick, 1000);
  } else {
    card.appendChild(el('div', { class: 'lvx-empty-venue' }, 'Check the schedule for the next match.'));
  }
  const link = el('a', { class: 'lvx-empty-link', href: '/wc/fixtures' }, 'View all fixtures →');
  card.appendChild(link);
  stage.appendChild(card);

  // today's slate
  const dayRef = next ? Date.parse(next.Date) : now;
  const today = scheduled.filter((r) => sameDay(Date.parse(r.Date), dayRef)).slice(0, 8);
  if (today.length) {
    const slate = el('div', { class: 'lvx-slate' });
    slate.appendChild(el('div', { class: 'lvx-slate-h' }, 'On this matchday'));
    const resolved = await Promise.all(today.map(async (r) => ({ r, t: await teamsFor(r.IdMatch) })));
    for (const { r, t } of resolved) {
      const hc = t && t.home.code, ac = t && t.away.code;
      slate.appendChild(el('div', { class: 'lvx-slate-row' },
        flagImg(hc, 'lvx-slate-flag'), el('span', { class: 'lvx-slate-code' }, hc || '—'),
        el('span', { class: 'lvx-slate-time' }, fmtTime(r.Date)),
        el('span', { class: 'lvx-slate-code' }, ac || '—'), flagImg(ac, 'lvx-slate-flag')));
    }
    stage.appendChild(slate);
  }

  stage.appendChild(el('div', { class: 'lvx-foot' }, el('span', { class: 'lvx-prov' }, 'Schedule & kickoff times — FIFA official. This view switches to the live broadcast automatically when a match kicks off.')));
  root.appendChild(stage);

  // re-check for a live match periodically
  setInterval(async () => { try { const r = await fifa.findLiveMatch(); if (r && fifa.statusFromCode(r.MatchStatus) === 'live') location.reload(); } catch {} }, CFG.CALENDAR_MS);
}

// FIFA's calendar list omits teams for scheduled matches, so resolve them from
// the per-match endpoint (which carries full team info even pre-kickoff).
async function teamsFor(idMatch) {
  try { const m = fifa.normalizeLive(await fifa.getLive(idMatch)); return { home: { code: m.home.code, name: m.home.name }, away: { code: m.away.code, name: m.away.name } }; }
  catch { return null; }
}

// ─── pure helpers ────────────────────────────────────────────────────────────────
const FROZEN = new Set(['PRE', 'HT', 'FT', 'FT_PEN', 'PEN']);
const CAPS = { '1H': 45, '2H': 90, ET1: 105, ET2: 120 };
function pad(n) { return String(n).padStart(2, '0'); }
function mmss(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
function fmtClock(phase, sec) {
  const cap = CAPS[phase];
  if (cap == null) return { main: mmss(sec), extra: null };
  const capSec = cap * 60;
  if (sec <= capSec) return { main: mmss(sec), extra: null };
  return { main: cap + ':00', extra: '+' + mmss(sec - capSec) };
}
// FIFA minute strings look like "72'", "45'+2'", "90'+5'". Strip everything but
// digits and '+' so the stoppage portion is preserved ("90'+5'" -> 95).
function parseMinute(str) { if (str == null) return 0; const clean = String(str).replace(/[^\d+]/g, ''); const m = clean.match(/^(\d+)(?:\+(\d+))?/); return m ? Number(m[1]) + (m[2] ? Number(m[2]) : 0) : 0; }
function stageLabel(m) {
  const g = m.groupName ? 'Group ' + String(m.groupName).replace(/group/i, '').trim() : (m.stageName || '');
  return [g, m.matchNumber ? 'Match ' + m.matchNumber : ''].filter(Boolean).join(' · ');
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
  const defY = side === 'home' ? 0.88 : 0.12, fwdY = side === 'home' ? 0.55 : 0.45;
  for (let li = 0; li < lines; li++) {
    const n = rows[li]; const frac = lines === 1 ? 0.5 : li / (lines - 1);
    const y = defY + frac * (fwdY - defY);
    for (let i = 0; i < n; i++) pts.push({ x: (i + 1) / (n + 1), y });
  }
  while (pts.length < total) pts.push({ x: 0.5, y: side === 'home' ? 0.72 : 0.28 });
  return pts;
}
function eventIcon(kind) {
  return ({ goal: '⚽', penalty: '⚽', own_goal: '⚽', yellow: '', red: '', sub: '⇄' })[kind] || '•';
}
function descOf(arr) { return (Array.isArray(arr) && arr[0] && arr[0].Description) || (typeof arr === 'string' ? arr : null); }
function sameDay(a, b) { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); }
function fmtTime(d) { try { return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } }

// ─── styles ──────────────────────────────────────────────────────────────────
export const LIVE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:#06080c;color:#f3f5f7;font-family:Archivo,system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{display:block}
.lvx-boot{display:flex;min-height:100vh;align-items:center;justify-content:center;color:#5a6a78;font-weight:700;font-size:14px;letter-spacing:.04em}
.lvx-boot-err{color:#e0606c;padding:0 24px;text-align:center}

.lvx-stage{position:relative;min-height:100vh;min-height:100dvh;padding:max(14px,env(safe-area-inset-top)) clamp(14px,3.5vw,40px) 28px;display:flex;flex-direction:column;gap:clamp(12px,2vw,22px);overflow:hidden}
.lvx-amb{position:fixed;top:-30vh;width:75vw;height:120vh;border-radius:50%;filter:blur(120px);opacity:.20;pointer-events:none;z-index:0}
.lvx-amb-h{left:-30vw;background:var(--home)}
.lvx-amb-a{right:-30vw;background:var(--away)}
.lvx-stage>:not(.lvx-amb):not(.lvx-goalflash){position:relative;z-index:1}

.lvx-top{display:flex;align-items:center;gap:14px}
.lvx-back{flex:none;width:42px;height:42px;border-radius:50%;border:1px solid #20272f;background:rgba(18,22,28,.7);color:#e8edf2;display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);transition:transform .15s,background .15s,border-color .15s}
.lvx-back:hover{transform:scale(1.07);background:#1a2129;border-color:#33414e}
.lvx-back-ar{font-size:21px;line-height:1;margin-top:-1px}
.lvx-topmid{flex:1;display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-width:0}
.lvx-livepill{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(255,70,80,.13);font-family:Archivo Expanded,Archivo;font-weight:800;font-size:11px;letter-spacing:.13em}
.lvx-livepill .lvx-dot{width:8px;height:8px;border-radius:50%;background:#ff5560}
.lvx-livepill.is-live{color:#ff6670}
.lvx-livepill.is-live .lvx-dot{animation:lvx-pulse 1.25s infinite}
.lvx-livepill.is-ft{color:#9fb2c2;background:rgba(159,178,194,.12)}
.lvx-livepill.is-ft .lvx-dot{background:#9fb2c2;animation:none}
.lvx-livepill.is-pre{color:#ffd23f;background:rgba(255,210,63,.12)}
.lvx-livepill.is-pre .lvx-dot{background:#ffd23f;animation:none}
.lvx-stagetag{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6c7e8e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lvx-venuetag{font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5d6f7e;text-align:right;max-width:38%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.lvx-hero{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(8px,2.5vw,44px);padding:clamp(6px,2vw,18px) 0}
.lvx-team{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0}
.lvx-teamflag{width:clamp(70px,15vw,128px);height:clamp(47px,10vw,86px);border-radius:10px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.55)}
.lvx-flagimg{width:100%;height:100%;object-fit:cover}
.lvx-teamcode{font-family:Anton;font-size:clamp(30px,7vw,58px);line-height:.85;letter-spacing:.02em}
.lvx-teamname{font-weight:600;font-size:clamp(11px,1.5vw,15px);color:#8597a6;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.lvx-teamform{display:flex;gap:4px}
.lvx-heromid{display:flex;flex-direction:column;align-items:center;gap:6px}
.lvx-score{font-family:Anton;font-size:clamp(54px,17vw,116px);line-height:.8;display:flex;align-items:baseline;gap:clamp(6px,2vw,16px);letter-spacing:-.01em;position:relative}
.lvx-s-h{color:var(--home);text-shadow:0 0 34px rgba(var(--home-rgb),.45)}
.lvx-s-a{color:var(--away);text-shadow:0 0 34px rgba(var(--away-rgb),.45)}
.lvx-sdash{color:#33414e;font-size:.6em}
.lvx-score.flash .lvx-s-h,.lvx-score.flash .lvx-s-a{animation:lvx-scoreflash .9s cubic-bezier(.3,1.4,.5,1)}
.lvx-pens{position:absolute;left:50%;top:calc(100% + 2px);transform:translateX(-50%);font-family:Archivo;font-weight:800;font-size:12px;color:#9fb2c2;white-space:nowrap}
.lvx-clock{display:flex;align-items:baseline;gap:8px;font-family:JetBrains Mono,monospace;font-weight:800}
.lvx-clock-main{font-size:clamp(20px,4.5vw,30px)}
.lvx-clock.is-live .lvx-clock-main{color:#ff6670}
.lvx-clock.is-ft .lvx-clock-main{color:#9fb2c2}
.lvx-clock.is-pre .lvx-clock-main{color:#ffd23f}
.lvx-clock-extra{font-size:14px;color:#9fb2c2}

.lvx-goalflash{position:absolute;left:50%;top:30%;transform:translate(-50%,0) scale(.7);font-family:Anton;font-size:clamp(60px,12vw,120px);letter-spacing:.06em;color:#fff;opacity:0;pointer-events:none;z-index:9;text-shadow:0 0 50px rgba(255,255,255,.5)}
.lvx-goalflash.show{animation:lvx-goal 1.6s cubic-bezier(.2,.9,.3,1.2)}

.lvx-info{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.lvx-chip{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 14px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.05)}
.lvx-chip-k{font-weight:800;font-size:8.5px;letter-spacing:.13em;color:#5d6f7e}
.lvx-chip-v{font-weight:700;font-size:13px;color:#d7e0e8}

.lvx-body{display:grid;grid-template-columns:1.15fr .85fr;gap:clamp(12px,2vw,20px);align-items:start;flex:1;min-height:0}
.lvx-panel-h,.lvx-card-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-family:Archivo Expanded,Archivo;font-weight:800;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7f93a3;margin-bottom:10px}
.lvx-panel-sub,.lvx-card-sub{font-family:JetBrains Mono,monospace;font-weight:700;color:#56697a}
.lvx-panel-sub{color:#8aa0b0}
.lvx-card-sub{color:#ff6670;font-size:9px}

.lvx-pitchwrap{background:rgba(10,16,13,.5);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:14px}
.lvx-pitch{position:relative}
.lvx-grass{position:relative;width:100%;aspect-ratio:68/105;border-radius:12px;background:linear-gradient(#0e2417,#0a1c12);border:1px solid rgba(255,255,255,.07);overflow:hidden}
.lvx-grass::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.022) 0 9.09%,transparent 9.09% 18.18%)}
.lvx-mid-line{position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,.16)}
.lvx-mid-circle{position:absolute;left:50%;top:50%;width:24%;aspect-ratio:1;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.16);border-radius:50%}
.lvx-box{position:absolute;left:50%;transform:translateX(-50%);width:54%;height:15%;border:1px solid rgba(255,255,255,.14)}
.lvx-box-top{top:0;border-top:none}.lvx-box-bot{bottom:0;border-bottom:none}
.lvx-six{position:absolute;left:50%;transform:translateX(-50%);width:28%;height:6%;border:1px solid rgba(255,255,255,.12)}
.lvx-six-top{top:0;border-top:none}.lvx-six-bot{bottom:0;border-bottom:none}
.lvx-pl{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;width:13%;max-width:64px}
.lvx-av{position:relative;width:clamp(26px,5.4vw,46px);height:clamp(26px,5.4vw,46px);border-radius:50%;overflow:hidden;border:2px solid var(--c);background:#0c1410 center/cover;box-shadow:0 4px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center}
.lvx-avimg{width:100%;height:100%;object-fit:cover;object-position:top center}
.lvx-av-nophoto{font-family:Anton;font-size:14px;color:#cfe0d4;background:#16221b}
.lvx-num{position:absolute;transform:translate(14px,-12px);font-family:JetBrains Mono;font-weight:800;font-size:9px;color:#0a0e0c;background:var(--c);border-radius:5px;padding:0 3px;z-index:2}
.lvx-cap{position:absolute;transform:translate(-15px,-12px);font-family:Archivo;font-weight:900;font-size:8px;color:#0a0e0c;background:#ffd23f;border-radius:50%;width:13px;height:13px;display:flex;align-items:center;justify-content:center;z-index:2}
.lvx-plbadge{position:absolute;transform:translate(15px,8px);display:flex;gap:2px;z-index:3}
.lvx-bg{font-size:11px;line-height:1}
.lvx-bg-goal{font-size:10px}
.lvx-bg-yellow{width:8px;height:11px;border-radius:2px;background:#ffd23f;display:inline-block}
.lvx-bg-red{width:8px;height:11px;border-radius:2px;background:#ff4757;display:inline-block}
.lvx-plname{margin-top:3px;font-weight:700;font-size:9px;color:#dbe6ee;text-align:center;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.8);max-width:74px;overflow:hidden;text-overflow:ellipsis}
.lvx-pitch-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;color:#6c7e8e;font-weight:600;font-size:13px;padding:0 24px}

.lvx-rail{display:flex;flex-direction:column;gap:clamp(12px,2vw,18px);min-width:0}
.lvx-card{background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:14px 16px}
.lvx-card-sub{margin-left:auto}
.lvx-muted{color:#5d6f7e;font-weight:600;font-size:13px}
.lvx-scorers{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lvx-sc-team{font-family:Anton;font-size:15px;margin-bottom:6px}
.lvx-sc-row{display:flex;align-items:center;gap:7px;margin-bottom:6px}
.lvx-sc-face{width:24px;height:24px;border-radius:50%;object-fit:cover;object-position:top center;background:#16221b;flex:none}
.lvx-sc-name{font-weight:700;font-size:12.5px;color:#e7edf2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lvx-sc-min{margin-left:auto;font-family:JetBrains Mono;font-weight:700;font-size:11px;color:#7f93a3}
.lvx-tl{display:flex;flex-direction:column;gap:9px;max-height:46vh;overflow-y:auto}
.lvx-ev{display:flex;align-items:center;gap:9px}
.lvx-ev-new{animation:lvx-evin .5s cubic-bezier(.2,.9,.3,1.2)}
.lvx-ev-min{font-family:JetBrains Mono;font-weight:800;font-size:12px;color:#9fb2c2;min-width:34px}
.lvx-ev-ic{width:20px;text-align:center;font-size:13px}
.lvx-ev-ic-yellow::before{content:'';display:inline-block;width:9px;height:12px;border-radius:2px;background:#ffd23f}
.lvx-ev-ic-red::before{content:'';display:inline-block;width:9px;height:12px;border-radius:2px;background:#ff4757}
.lvx-ev-who{font-weight:800;font-size:13px;color:#eef3f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lvx-ev-sc{font-family:JetBrains Mono;font-weight:800;font-size:12px;color:#cdd8e0}
.lvx-ev-team{margin-left:auto;font-family:Archivo Expanded,Archivo;font-weight:800;font-size:10px;letter-spacing:.06em}
.lvx-stat{margin-bottom:10px}
.lvx-stat-top{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;color:#9fb2c2;font-weight:700;margin-bottom:5px}
.lvx-stat-bar{display:flex;gap:3px;height:6px}
.lvx-stat-bar i{border-radius:4px}

.lvx-foot{text-align:center;padding-top:6px}
.lvx-prov{font-weight:600;font-size:10.5px;line-height:1.5;color:#4f6171;letter-spacing:.01em}

/* empty / countdown */
.lvx-empty{justify-content:flex-start}
.lvx-empty-card{margin:6vh auto 0;max-width:560px;width:100%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.lvx-empty-kicker{font-weight:700;font-size:13px;color:#6c7e8e;letter-spacing:.04em}
.lvx-empty-next{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:11px;letter-spacing:.2em;color:#7f93a3}
.lvx-empty-mu{display:flex;align-items:center;gap:18px;justify-content:center}
.lvx-empty-team{display:flex;flex-direction:column;align-items:center;gap:8px;font-family:Anton;font-size:30px}
.lvx-empty-flag{width:74px;height:50px;border-radius:8px;object-fit:cover;box-shadow:0 8px 22px rgba(0,0,0,.5)}
.lvx-empty-vs{font-family:Anton;font-size:18px;color:#41505d}
.lvx-count{display:flex;gap:10px;margin-top:4px}
.lvx-count-seg{display:flex;flex-direction:column;align-items:center;min-width:58px;padding:10px 6px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.lvx-count-seg b{font-family:JetBrains Mono;font-weight:800;font-size:26px;color:#f3f5f7}
.lvx-count-seg i{font-style:normal;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6c7e8e;margin-top:3px}
.lvx-count-live{font-family:Anton;font-size:24px;color:#ffd23f}
.lvx-empty-venue{font-weight:600;font-size:12px;color:#6c7e8e}
.lvx-empty-link{margin-top:4px;font-weight:800;font-size:12px;color:#9fb2c2;border-bottom:1px solid currentColor;padding-bottom:1px}
.lvx-slate{max-width:560px;width:100%;margin:22px auto 0}
.lvx-slate-h{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6c7e8e;margin-bottom:8px;text-align:center}
.lvx-slate-row{display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0;border-top:1px solid rgba(255,255,255,.05)}
.lvx-slate-flag{width:26px;height:18px;border-radius:3px;object-fit:cover}
.lvx-slate-code{font-family:Anton;font-size:16px;min-width:42px;text-align:center}
.lvx-slate-time{font-family:JetBrains Mono;font-weight:700;font-size:12px;color:#7f93a3;min-width:64px;text-align:center}

@keyframes lvx-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.55}}
@keyframes lvx-scoreflash{0%{transform:scale(1)}35%{transform:scale(1.32);color:#fff}100%{transform:scale(1)}}
@keyframes lvx-goal{0%{opacity:0;transform:translate(-50%,16px) scale(.6)}16%{opacity:1;transform:translate(-50%,0) scale(1.08)}72%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px) scale(1)}}
@keyframes lvx-evin{0%{opacity:0;transform:translateX(-12px)}100%{opacity:1;transform:none}}

/* ── responsive: phone = single column, score-dominant ── */
@media (max-width:760px){
  .lvx-body{grid-template-columns:1fr}
  .lvx-venuetag{display:none}
  .lvx-pitchwrap{order:2}
  .lvx-rail{order:1}
  .lvx-tl{max-height:40vh}
}
@media (min-width:1500px){
  .lvx-stage{max-width:1440px;margin:0 auto}
}
`;
