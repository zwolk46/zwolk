// Shared renderer for the Game Detail view.
// Used by /wc/game/[id] (fullscreen) AND by the popup overlay opened from
// fixtures / groups / bracket lists. Same content in both, different chrome.

import * as api from './api.js';
import * as data from './data.js';
import { flagSrc } from './flags.js';
import { dayLabel, dayLong, timeLabel, eur, initials, countdown as fmtCountdown, PHASE_LABEL, ROUND_LABEL } from './format.js';
import { pronounce } from './data.js';
import { liveCss, renderLiveInto } from './render-live.js';

export const gameCss = `
  .gd-root{position:relative}
  .gd-phase-pill{display:inline-flex;align-items:center;gap:7px;font-family:Archivo Expanded,Archivo;font-weight:800;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;padding:4px 11px;border-radius:6px}
  .gd-phase-pill::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
  .gd-phase-pill.pre  {color:#f5c712;background:rgba(245,199,18,0.12)}
  .gd-phase-pill.live {color:#ff6a6f;background:rgba(255,106,111,0.13)}
  .gd-phase-pill.post {color:#9bbaa2;background:rgba(155,186,162,0.12)}
  .gd-phase-pill.live::before{animation:wc-pulse 1.3s ease infinite}
  .gd-stage{font-family:Archivo;font-weight:800;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5a7a5a;margin-left:10px}

  .gd-scoreboard{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:clamp(10px,3vw,46px);margin-top:18px;animation:wc-reveal-up .55s cubic-bezier(.34,1.56,.64,1) both}
  .gd-team{display:flex;flex-direction:column;align-items:center;gap:12px;min-width:0;text-decoration:none;color:inherit;transition:transform .22s cubic-bezier(.2,.9,.3,1.2),filter .22s;cursor:pointer}
  .gd-team:hover{transform:scale(1.04);filter:drop-shadow(0 0 10px rgba(245,199,18,0.35))}
  .gd-flag{width:clamp(70px,13cqi,150px);height:clamp(52px,9.7cqi,112px);border-radius:11px;background-size:cover;background-position:center;box-shadow:0 10px 30px rgba(0,0,0,0.7)}
  .gd-flag.empty{background:repeating-linear-gradient(135deg,#141f14 0 6px,#0e1610 6px 12px);display:flex;align-items:center;justify-content:center;font-family:Anton;font-size:clamp(26px,5cqi,52px);color:#5a7a5a}
  .gd-code{font-family:Anton;font-size:clamp(30px,7cqi,80px);letter-spacing:0.02em;line-height:0.9;text-align:center;color:#f4f2ea}
  .gd-name{font-family:Archivo;font-weight:600;font-size:clamp(11px,1.3cqi,16px);color:#6a8a6a;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .gd-middle{display:flex;flex-direction:column;align-items:center;gap:9px;padding-top:clamp(8px,2cqi,28px)}
  .gd-score{font-family:Anton;font-size:clamp(40px,10cqi,124px);line-height:0.82;letter-spacing:-0.02em;white-space:nowrap;color:#f4f2ea}
  .gd-score.pre{color:#f5c712}
  .gd-time{display:inline-flex;align-items:center;gap:7px;font-family:Archivo Expanded,Archivo;font-weight:800;font-size:clamp(10px,1.3cqi,15px);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;color:#3a5a3a}
  .gd-time.live{color:#ff6a6f}
  .gd-time.live::before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor;animation:wc-pulse 1.3s ease infinite}
  .gd-time.post{color:#9bbaa2}
  .gd-annot{font-family:Archivo;font-weight:800;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#9bbaa2;background:#141f14;padding:4px 11px;border-radius:999px;text-align:center}

  .gd-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin-top:clamp(18px,3cqi,34px);animation:wc-reveal-up .6s ease .12s both}
  .gd-chip{background:#0e1610;border:1px solid #18241a;border-radius:11px;padding:11px 18px;text-align:center}
  .gd-chip .lbl{font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.12em;color:#3a5a3a;text-transform:uppercase}
  .gd-chip .val{font-family:Archivo;font-weight:700;font-size:13px;color:#dfe6df;margin-top:4px}

  .gd-section{background:#0e1610;border:1px solid #18241a;border-radius:16px;padding:18px 20px;margin-top:14px;animation:wc-reveal-up .55s ease both;container-type:inline-size}
  .gd-section h3{font-family:Archivo;font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#f5c712;margin-bottom:14px}
  .gd-section h3.muted{color:#5a7a5a}
  .gd-section h3 .note{color:#3a5a3a;font-weight:700;letter-spacing:0.06em;margin-left:8px}

  .gd-storyline{background:linear-gradient(120deg,rgba(245,199,18,0.08),transparent);border:none;border-left:4px solid #f5c712;border-radius:0 12px 12px 0;padding:16px 22px;margin-top:18px;container-type:inline-size}
  .gd-storyline h3{margin-bottom:7px;font-family:Archivo;font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#f5c712}
  .gd-storyline p{font-family:Archivo;font-weight:600;font-size:clamp(14px,1.5vw,19px);line-height:1.4;color:#eef2ee}

  .gd-tot-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .gd-tot-header .ttl{font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#f5c712}
  .gd-tot-header .sub{font-family:Archivo;font-weight:700;font-size:9px;color:#3a5a3a}
  .gd-tot-row{display:grid;grid-template-columns:66px 1fr auto 1fr 66px;align-items:center;gap:10px;margin-bottom:13px}
  .gd-tot-row .v1{font-family:Anton;font-size:clamp(16px,2.2vw,22px);color:#f5c712;text-align:right}
  .gd-tot-row .v2{font-family:Anton;font-size:clamp(16px,2.2vw,22px);color:#9ab4ff}
  .gd-tot-row .lbl{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#5a7a5a;white-space:nowrap;text-align:center;min-width:80px}
  .gd-tot-bar{height:9px;background:#141f14;border-radius:6px;overflow:hidden;display:flex}
  .gd-tot-bar.left{justify-content:flex-end}
  .gd-tot-bar .fill1{height:100%;background:linear-gradient(90deg,transparent,#f5c712);border-radius:6px;transform-origin:right;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .gd-tot-bar .fill2{height:100%;background:linear-gradient(90deg,#6e96ff,transparent);border-radius:6px;transform-origin:left;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}

  .gd-stand-row{display:grid;grid-template-columns:26px 1fr 40px 40px 40px;gap:6px;align-items:center;padding:9px 8px;border-radius:8px;margin-bottom:2px}
  .gd-stand-head{display:grid;grid-template-columns:26px 1fr 40px 40px 40px;gap:6px;padding:0 8px 8px;font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#3a5a3a}
  .gd-stand-row .flag{width:22px;height:16px;flex:none;border-radius:3px;background-size:cover;background-position:center}
  .gd-stand-name{display:flex;align-items:center;gap:9px;min-width:0}
  .gd-stand-name span{font-family:Archivo;font-weight:600;font-size:13px;color:#b9c0b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .gd-stand-pos{font-family:Anton;font-size:14px;color:#3a5a3a}
  .gd-stand-g{text-align:center;font-family:Archivo;font-weight:700;font-size:13px;color:#9bbaa2}
  .gd-stand-p{text-align:center;font-family:Anton;font-size:16px;color:#9bbaa2}
  .gd-stand-row.me{background:rgba(245,199,18,0.08);border-left:3px solid #f5c712}
  .gd-stand-row.me .gd-stand-name span{color:#f4f2ea;font-weight:800}
  .gd-stand-row.me .gd-stand-pos,.gd-stand-row.me .gd-stand-p{color:#f5c712}
  .gd-stand-row.q{border-left:3px solid #1ea85a}

  .gd-h2h-summary{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin-bottom:14px}
  .gd-h2h-summary .col{text-align:center}
  .gd-h2h-summary .label{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.1em;color:#5a7a5a;text-transform:uppercase}
  .gd-h2h-summary .big{font-family:Anton;font-size:clamp(26px,4vw,42px);line-height:1;margin-top:6px;color:#f4f2ea}
  .gd-h2h-last{display:grid;grid-template-columns:80px 1fr auto 1fr;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #141f14}
  .gd-h2h-last .when{font-family:JetBrains Mono,monospace;font-weight:700;font-size:11px;color:#5a7a5a}
  .gd-h2h-last .a, .gd-h2h-last .b{font-family:Archivo;font-weight:700;font-size:13px;color:#dfe6df}
  .gd-h2h-last .a{text-align:right}
  .gd-h2h-last .b{text-align:left}
  .gd-h2h-last .score{font-family:Anton;font-size:16px;color:#f5c712;text-align:center;min-width:54px}

  .gd-kp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
  .gd-kp-row{display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid #141f14}
  .gd-kp-row:last-child{border-bottom:none}
  .gd-kp-portrait{width:34px;height:40px;flex:none;border-radius:7px;background:linear-gradient(160deg,#1a2218,#0c1310);border:1px solid #20301f;display:flex;align-items:center;justify-content:center;font-family:Anton;font-size:13px;color:#7e9a7e}
  .gd-kp-info{flex:1;min-width:0}
  .gd-kp-info .name{font-family:Archivo;font-weight:800;font-size:13px;color:#eef2ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .gd-kp-info .pos{font-family:Archivo;font-weight:600;font-size:11px;color:#5a7a5a}
  .gd-kp-val{font-family:JetBrains Mono,monospace;font-weight:700;font-size:12px;color:#f5c712}
  @container (max-width:520px){.gd-kp-grid{grid-template-columns:1fr}}

  .gd-events{position:relative;padding-left:30px}
  .gd-events::before{content:'';position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:linear-gradient(#1e2a1e,#2a3a2a)}
  .gd-event{position:relative;padding-bottom:16px}
  .gd-event .dot{position:absolute;left:-30px;top:2px;width:16px;height:16px;border-radius:50%;box-shadow:0 0 0 4px #0e1610}
  .gd-event .min{font-family:JetBrains Mono,monospace;font-weight:700;font-size:14px;min-width:38px;display:inline-block}
  .gd-event .type{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;border-radius:5px;padding:2px 7px}
  .gd-event .who{font-family:Archivo;font-weight:800;font-size:13px;color:#eef2ee;margin-left:8px}
  a.gd-plink{color:inherit;text-decoration:none;cursor:pointer;transition:color .15s}
  a.gd-plink:hover{color:#f5c712}
  .gd-event .team{font-family:Archivo;font-weight:700;font-size:10px;color:#5a7a5a;margin-left:8px}
  .gd-event .detail{font-family:Archivo;font-weight:600;font-size:11px;color:#6a8a6a;margin-top:2px;display:block;margin-left:46px}
  .gd-event-goal{--c:#f5c712;--bg:rgba(245,199,18,0.14)}
  .gd-event-yellow{--c:#f0c830;--bg:rgba(240,200,48,0.13)}
  .gd-event-red{--c:#e05060;--bg:rgba(224,80,96,0.14)}
  .gd-event-sub{--c:#6e96ff;--bg:rgba(110,150,255,0.14)}

  .gd-stat-row{margin-bottom:13px}
  .gd-stat-row .head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
  .gd-stat-row .v1{font-family:Anton;font-size:16px;color:#f5c712}
  .gd-stat-row .v2{font-family:Anton;font-size:16px;color:#9ab4ff}
  .gd-stat-row .lbl{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#5a7a5a}
  .gd-stat-row .bar{display:flex;gap:3px;height:6px}
  .gd-stat-row .bar .f1{background:#f5c712;border-radius:4px}
  .gd-stat-row .bar .f2{background:#6e96ff;border-radius:4px}
  .gd-stat-pending{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;padding:7px 0;border-top:1px solid #141f14}
  .gd-stat-pending .lbl{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#3a5a3a}
  .gd-stat-pending .v{font-family:Archivo;font-weight:700;font-size:10px;color:#3a5a3a;letter-spacing:0.04em}

  .gd-weather-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:1px;background:#141f14;border-radius:12px;overflow:hidden}
  .gd-weather-cell{background:#0c1410;padding:14px 10px;text-align:center}
  .gd-weather-cell .v{font-family:Anton;font-size:22px;color:#dfe6df}
  .gd-weather-cell .v.warm{color:#f5c712}
  .gd-weather-cell .v.cool{color:#6e96ff}
  .gd-weather-cell .lbl{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#5a7a5a;margin-top:6px}

  .gd-sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
  @container (max-width:520px){.gd-sc-grid{grid-template-columns:1fr}}
  .gd-sc-card .ttl{font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:#5a7a5a;margin-bottom:8px}
  .gd-sc-card .row{font-family:Archivo;font-weight:700;font-size:13px;color:#eef2ee;padding:2px 0}
  .gd-sc-card .mins{color:#5a7a5a;font-weight:600}

  .gd-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @container (max-width:680px){.gd-grid-2{grid-template-columns:1fr}}

  .gd-loading{padding:60px 20px;text-align:center;font-family:Archivo;font-weight:700;font-size:13px;color:#5a6a5a}
  .gd-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid #2a3a2a;border-top-color:#f5c712;border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  .gd-error{padding:30px 20px;text-align:center;font-family:Archivo;font-weight:600;font-size:13px;color:#c0444f;background:#1c0e10;border:1px solid #3a1820;border-radius:12px;max-width:580px;margin:30px auto}
` + liveCss;

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

// Wrap a player name in a popup link resolved by name. Live event/scorer feeds
// only carry names (no tmId); the player renderer resolves "name:<Name>" and
// degrades gracefully if there's no match. Returns a text node if no name.
function playerLink(name, className = 'gd-plink') {
  if (!name) return document.createTextNode('');
  return el('a', { class: className, href: `/wc/player/${encodeURIComponent('name:' + name)}` }, name);
}

export async function renderGameInto(container, matchId, opts = {}) {
  container.classList.add('gd-root');

  // Demo entry points for the live view: /wc/game/test (wc2026api sandbox match
  // that cycles through phases live) and /wc/game/mock (frozen, fully-populated
  // state that makes no API calls). Both render the dedicated live experience.
  if (matchId === 'mock' || matchId === 'test' || String(matchId) === '9999') {
    return renderLiveInto(container, { mode: matchId === 'mock' ? 'mock' : 'test', matchId, setTitle: opts.setTitle });
  }

  container.innerHTML = `<div class="gd-loading">Loading match…</div>`;

  let m;
  try {
    const match = await api.getMatch(matchId);
    m = Array.isArray(match) ? match[0] : (match.data || match);
    if (!m || !m.id) throw new Error('match not found');
  } catch (err) {
    // Live API unavailable/over-cap — fall back to the complete local schedule
    // so every match still opens with its full pre-game context and result.
    try {
      const all = await data.getMatchesSample();
      m = (Array.isArray(all) ? all : []).find(x => String(x.id) === String(matchId)) || null;
    } catch {}
    if (!m || !m.id) {
      container.innerHTML = `<div class="gd-error">Couldn't load match ${matchId}: ${err.message}</div>`;
      return;
    }
  }

  const enrich = await Promise.allSettled([
    data.resolveTeam(m.home_team).then(t => t || data.teamByCode(m.home_team_code)),
    data.resolveTeam(m.away_team).then(t => t || data.teamByCode(m.away_team_code)),
    data.getHeadToHead(),
    data.getEloRatings(),
    data.getFifaRankings(),
    data.getStadiumWeather(),
    data.getCountries(),
    data.getPlayersByTeamSample(),
    data.getTeamRecords(),
    (m.round === 'group') ? api.getGroups().catch(() => null) : Promise.resolve(null),
    (m.status !== 'scheduled') ? api.getMatchStats(m.id).catch(() => null) : Promise.resolve(null),
    data.getSportsdbTeams(),
    (m.round === 'group') ? data.getGroupsSample().catch(() => null) : Promise.resolve(null),
  ]);
  const [home, away, h2h, elo, fifa, weather, countries, playersByTeam, records, groups, stats, sportsdb, groupsStatic] =
    enrich.map(r => r.status === 'fulfilled' ? r.value : null);

  // Update popup title once teams resolve
  if (opts.setTitle && (home || away)) {
    const t = (home && away) ? `${home.fifa_code} vs ${away.fifa_code}` : (home ? home.name : (away ? away.name : 'Match'));
    opts.setTitle(t);
  }

  // Live matches get the dedicated live experience (in the popup AND the full
  // page). It runs its own seconds-precision clock and budget-safe poll loop, so
  // we hand off entirely rather than rebuilding the generic layout on a timer.
  if (m.status === 'live') {
    // Full-screen page: hand off to the dedicated /wc/live broadcast view so a
    // live game lives there until full time. The hover popup keeps its inline
    // live view (no navigation).
    if (opts.fullPage) { location.replace('/wc/live'); return; }
    return renderLiveInto(container, {
      mode: 'live', matchId, setTitle: opts.setTitle,
      seed: { m, home, away, stats, groups, groupsStatic },
    });
  }

  render({ m, home, away, h2h, elo, fifa, weather, countries, playersByTeam, records, groups, groupsStatic, stats, sportsdb, container });
}

function render(ctx) {
  const { m, container } = ctx;
  container.innerHTML = '';

  const phase = phaseClass(m);

  const headRow = el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px' });
  headRow.appendChild(el('span', { class: `gd-phase-pill ${phase}` }, statusLabel(m)));
  headRow.appendChild(el('span', { class: 'gd-stage' }, stageLabel(m)));
  container.appendChild(headRow);

  container.appendChild(buildScoreboard(ctx));

  const stadName = m.stadium || '—';
  const venueInfo = pickStadiumInfo(ctx.weather, stadName);
  const kickoffDate = new Date(m.kickoff_utc);
  const koLabel = phase === 'pre' ? 'Kickoff' : (phase === 'live' ? 'Started' : 'Played');
  const koDateTime = dayLabel(kickoffDate) + ' · ' + timeLabel(kickoffDate) + ' ET';
  const chips = el('div', { class: 'gd-chips' },
    metaChip('Stadium', stadName),
    venueInfo && venueInfo.city ? metaChip('City', venueInfo.city) : null,
    venueInfo && venueInfo.capacity ? metaChip('Capacity', venueInfo.capacity.toLocaleString()) : null,
    metaChip(koLabel, koDateTime),
    phase === 'pre' ? metaChip('Kicks off in', fmtCountdown(kickoffDate)) : null,
  );
  container.appendChild(chips);

  if (phase === 'pre') renderPre(container, ctx);
  else                 renderLiveOrPost(container, ctx);
}

function buildScoreboard(ctx) {
  const { m, home, away } = ctx;
  const phase = phaseClass(m);
  const wrap = el('div', { class: 'gd-scoreboard' });
  wrap.appendChild(teamSide(home, m.home_team_source));

  const middle = el('div', { class: 'gd-middle' });
  const scoreText = (phase === 'pre') ? 'VS' : `${m.home_score ?? 0}–${m.away_score ?? 0}`;
  middle.appendChild(el('div', { class: `gd-score ${phase}` }, scoreText));
  const timeText = (phase === 'pre')
    ? `KO ${timeLabel(new Date(m.kickoff_utc))}`
    : (phase === 'live' ? (PHASE_LABEL[m.phase] || m.phase || 'LIVE') : (m.phase === 'FT_PEN' ? 'Full time (pens)' : 'Full time'));
  middle.appendChild(el('div', { class: `gd-time ${phase}` }, timeText));
  if (m.phase === 'FT_PEN') middle.appendChild(el('div', { class: 'gd-annot' }, 'Decided on penalties'));
  wrap.appendChild(middle);

  wrap.appendChild(teamSide(away, m.away_team_source));
  return wrap;
}

function teamSide(team, sourceText) {
  if (!team) {
    return el('div', { class: 'gd-team', style: 'cursor:default' },
      el('div', { class: 'gd-flag empty' }, '?'),
      el('div', { class: 'gd-code' }, sourceText || 'TBD'),
      el('div', { class: 'gd-name', style: 'font-style:italic' }, sourceText ? 'Slot undecided' : 'Awaiting team'),
    );
  }
  const a = el('a', { class: 'gd-team', href: `/wc/team/${team.fifa_code}` });
  const flag = el('div', { class: 'gd-flag' });
  if (flagSrc(team.fifa_code)) flag.style.backgroundImage = `url(${flagSrc(team.fifa_code)})`;
  else { flag.classList.add('empty'); flag.textContent = team.fifa_code.slice(0, 2); }
  a.appendChild(flag);
  a.appendChild(el('div', { class: 'gd-code' }, team.fifa_code));
  a.appendChild(el('div', { class: 'gd-name' }, team.name));
  // Lets list-page click handlers intercept this in popup mode if they want.
  a.dataset.teamCode = team.fifa_code;
  return a;
}

function metaChip(label, value) {
  return el('div', { class: 'gd-chip' },
    el('div', { class: 'lbl' }, label),
    el('div', { class: 'val' }, value || '—'),
  );
}

function statusLabel(m) {
  if (m.status === 'live') return PHASE_LABEL[m.phase] || 'Live';
  if (m.status === 'finished') return m.phase === 'FT_PEN' ? 'Full time (pens)' : 'Full time';
  return 'Upcoming';
}
function phaseClass(m) {
  if (m.status === 'live') return 'live';
  if (m.status === 'finished') return 'post';
  return 'pre';
}
function stageLabel(m) {
  if (m.round === 'group') return `Group ${m.group_name || '?'} · Match ${m.match_number}`;
  return `${ROUND_LABEL[m.round] || m.round} · Match ${m.match_number}`;
}

function renderPre(root, ctx) {
  const { m, home, away, h2h, elo, fifa, weather, playersByTeam, records, groups } = ctx;

  const story = el('div', { class: 'gd-storyline gd-section' });
  story.appendChild(el('h3', {}, 'The Storyline'));
  story.appendChild(el('p', {}, buildStoryline(ctx)));
  root.appendChild(story);

  if (home && away) {
    const tot = el('div', { class: 'gd-section' });
    tot.appendChild(el('div', { class: 'gd-tot-header' },
      el('span', { class: 'ttl' }, 'Tale of the Tape'),
      el('span', { class: 'sub' }, `${home.fifa_code} vs ${away.fifa_code}`),
    ));
    const rows = buildToTRows(home, away, elo, fifa, records);
    if (rows.length === 0) {
      tot.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#3a5a3a' },
        'Comparison data warming up.'));
    }
    for (const r of rows) tot.appendChild(buildToTRow(r));
    root.appendChild(tot);
  }

  if (home && away && h2h) {
    const pairKey = data.h2hKey(home.fifa_code, away.fifa_code);
    const pair = h2h[pairKey];
    if (pair) root.appendChild(buildH2H(home, away, pair));
  }

  if (m.round === 'group' && home && away) {
    const groupLetter = m.group_name || home.group;
    const live = pickGroupStandings(groups, groupLetter);
    const standings = (live && live.length) ? live : pickGroupStandings(ctx.groupsStatic, groupLetter);
    if (standings && standings.length) root.appendChild(buildStandings(standings, [home.fifa_code, away.fifa_code], groupLetter, home, away));
  }

  if (home || away) {
    root.appendChild(buildKeyPlayers(home, away, playersByTeam));
  }

  const wx = pickWeather(weather, m);
  if (wx) root.appendChild(buildWeather(wx, m));
}

function buildStoryline(ctx) {
  const { m, home, away } = ctx;
  if (!home || !away) return `Knockout tie — teams confirmed once the qualifying matches finish.`;
  const kickoffWhen = dayLong(new Date(m.kickoff_utc));
  if (m.round === 'group') {
    return `${home.name} face ${away.name} in Group ${m.group_name} on ${kickoffWhen}. Result feeds the live Group ${m.group_name} table.`;
  }
  return `${home.name} meet ${away.name} in the ${(ROUND_LABEL[m.round] || m.round).toLowerCase()} on ${kickoffWhen}.`;
}

function buildToTRows(home, away, elo, fifa, records) {
  const rows = [];
  if (fifa) {
    const fh = fifa[home.fifa_code], fa = fifa[away.fifa_code];
    if (fh && fa) {
      const rh = fh.live_rank ?? fh.official_rank;
      const ra = fa.live_rank ?? fa.official_rank;
      if (rh && ra) rows.push({ label: 'FIFA rank', v1: '#' + rh, v2: '#' + ra, p1: invRank(rh), p2: invRank(ra) });
    }
  }
  if (elo) {
    const eh = elo[home.fifa_code], ea = elo[away.fifa_code];
    if (eh && ea) {
      const r1 = eh.current_rating || 0;
      const r2 = ea.current_rating || 0;
      if (r1 && r2) rows.push({ label: 'Elo rating', v1: Math.round(r1), v2: Math.round(r2), p1: r1, p2: r2 });
    }
  }
  if (records) {
    const rh = records[home.fifa_code], ra = records[away.fifa_code];
    if (rh && ra) {
      const wr1 = rh.win_pct != null ? rh.win_pct : (rh.played ? (rh.wins / rh.played * 100) : 0);
      const wr2 = ra.win_pct != null ? ra.win_pct : (ra.played ? (ra.wins / ra.played * 100) : 0);
      rows.push({ label: 'All-time win %', v1: wr1.toFixed(1) + '%', v2: wr2.toFixed(1) + '%', p1: wr1, p2: wr2 });
    }
  }
  return rows;
}
function invRank(r) { return r ? Math.max(1, 250 - r) : 0; }

function buildToTRow(r) {
  const total = (r.p1 + r.p2) || 1;
  const p1Pct = Math.max(8, Math.round(r.p1 / total * 100));
  const p2Pct = Math.max(8, Math.round(r.p2 / total * 100));
  return el('div', { class: 'gd-tot-row' },
    el('span', { class: 'v1' }, String(r.v1)),
    el('div', { class: 'gd-tot-bar left' }, el('div', { class: 'fill1', style: `width:${p1Pct}%` })),
    el('span', { class: 'lbl' }, r.label),
    el('div', { class: 'gd-tot-bar' }, el('div', { class: 'fill2', style: `width:${p2Pct}%` })),
    el('span', { class: 'v2' }, String(r.v2)),
  );
}

function buildH2H(home, away, pair) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, 'Head to head'));

  const pairCodes = pair.pair || [];
  const homeIsFirst = pairCodes[0] === home.fifa_code;
  const homeWins = homeIsFirst ? pair.first_wins : pair.second_wins;
  const awayWins = homeIsFirst ? pair.second_wins : pair.first_wins;
  const homeGoals = homeIsFirst ? pair.first_goals : pair.second_goals;
  const awayGoals = homeIsFirst ? pair.second_goals : pair.first_goals;
  const played = pair.played ?? 0;

  if (played > 0) {
    sec.appendChild(el('div', { class: 'gd-h2h-summary' },
      el('div', { class: 'col' },
        el('div', { class: 'label' }, `${home.fifa_code} wins`),
        el('div', { class: 'big' }, String(homeWins ?? 0)),
      ),
      el('div', { class: 'col' },
        el('div', { class: 'label' }, `Draws · ${played} played`),
        el('div', { class: 'big', style: 'color:#c9a227' }, String(pair.draws ?? 0)),
      ),
      el('div', { class: 'col' },
        el('div', { class: 'label' }, `${away.fifa_code} wins`),
        el('div', { class: 'big' }, String(awayWins ?? 0)),
      ),
    ));
    sec.appendChild(el('div', { style: 'text-align:center;font-family:Archivo;font-weight:600;font-size:11px;color:#5a7a5a;margin-bottom:10px' },
      `Aggregate goals · ${home.fifa_code} ${homeGoals ?? 0} – ${awayGoals ?? 0} ${away.fifa_code}`));
  } else {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a' }, 'No prior senior international meetings recorded.'));
    return sec;
  }

  const last = pair.last5 || [];
  if (last.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.1em;color:#5a7a5a;text-transform:uppercase;margin-top:14px;margin-bottom:6px' }, 'Last meetings'));
    for (const meet of last.slice(0, 5)) {
      const dateStr = (meet.date || '').slice(0, 10);
      sec.appendChild(el('div', { class: 'gd-h2h-last' },
        el('div', { class: 'when' }, dateStr),
        el('div', { class: 'a' }, meet.home || ''),
        el('div', { class: 'score' }, meet.score || 'vs'),
        el('div', { class: 'b' }, meet.away || ''),
      ));
    }
  }
  return sec;
}

function pickGroupStandings(groups, letter) {
  if (!groups || !letter) return null;
  const arr = Array.isArray(groups) ? groups : (groups.data || groups.groups || []);
  if (!Array.isArray(arr)) return null;
  const g = arr.find(x => (x.group_name || x.group) === letter || x.letter === letter);
  return g ? (g.standings || g.table || []) : null;
}

function buildStandings(rows, meCodes, letter, home, away) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, `Group ${letter} · Standings`));
  sec.appendChild(el('div', { class: 'gd-stand-head' },
    el('span', {}, '#'), el('span', {}, 'Team'),
    el('span', { style:'text-align:center' }, 'P'),
    el('span', { style:'text-align:center' }, 'GD'),
    el('span', { style:'text-align:center' }, 'PTS'),
  ));
  const meNames = new Set();
  if (home) { meNames.add(home.name); meNames.add(home.name_normalised); }
  if (away) { meNames.add(away.name); meNames.add(away.name_normalised); }
  rows.forEach((r, i) => {
    const teamName = r.team || r.name;
    const isMe = meNames.has(teamName);
    const qual = i < 2;
    const t = (data.teamSync && data.teamSync(teamName)) || (r.code && data.teamSync && data.teamSync(r.code));
    const cls = `gd-stand-row${isMe ? ' me' : ''}${qual && !isMe ? ' q' : ''}`;
    // Clickable into the team popup when we can resolve a FIFA code.
    const row = t
      ? el('a', { class: cls, href: `/wc/team/${t.fifa_code}`, style: 'text-decoration:none;color:inherit' })
      : el('div', { class: cls });
    row.appendChild(el('span', { class: 'gd-stand-pos' }, String(i + 1)));
    const name = el('div', { class: 'gd-stand-name' });
    const flag = el('span', { class: 'flag' });
    if (t && flagSrc(t.fifa_code)) flag.style.backgroundImage = `url(${flagSrc(t.fifa_code)})`;
    name.appendChild(flag);
    name.appendChild(el('span', {}, teamName));
    row.appendChild(name);
    row.appendChild(el('span', { class: 'gd-stand-g' }, String(r.played ?? 0)));
    const gd = (r.gd != null) ? r.gd : ((r.gf ?? 0) - (r.ga ?? 0));
    row.appendChild(el('span', { class: 'gd-stand-g' }, gd > 0 ? `+${gd}` : String(gd)));
    row.appendChild(el('span', { class: 'gd-stand-p' }, String(r.points ?? 0)));
    sec.appendChild(row);
  });
  return sec;
}

function buildKeyPlayers(home, away, playersByTeam) {
  const sec = el('div', { class: 'gd-kp-grid' });
  for (const t of [home, away]) {
    const card = el('div', { class: 'gd-section' });
    card.appendChild(el('div', { class: 'ttl', style: 'font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.1em;color:#5a7a5a;text-transform:uppercase;margin-bottom:12px' },
      (t ? t.fifa_code : '?') + ' · Watch'));
    const top = topPlayers(t, playersByTeam);
    if (!top.length) {
      card.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:12px;color:#3a5a3a;padding:6px 0' }, 'Squad data not yet wired for this team.'));
    } else {
      for (const p of top) {
        const playerId = p.tmId || `name:${p.name}`;
        // Make each row clickable to the player popup.
        const row = el('a', { class: 'gd-kp-row', href: `/wc/player/${encodeURIComponent(playerId)}`,
          style: 'text-decoration:none;color:inherit' });
        row.appendChild(el('div', { class: 'gd-kp-portrait' }, initials(p.name)));
        row.appendChild(el('div', { class: 'gd-kp-info' },
          el('div', { class: 'name' }, p.name),
          el('div', { class: 'pos' }, p.position || ''),
        ));
        row.appendChild(el('div', { class: 'gd-kp-val' }, eur(p.marketValueEur)));
        card.appendChild(row);
      }
    }
    sec.appendChild(card);
  }
  return sec;
}
function topPlayers(team, playersByTeam) {
  if (!team || !playersByTeam) return [];
  return data.squadFor(playersByTeam, team).slice(0, 3);
}

// Returns the match-day weather entry (has .weather and .weather_source) or null.
function pickWeather(weather, m) {
  if (!weather || !m.stadium) return null;
  const stadiums = weather.stadiums;
  if (!stadiums || typeof stadiums !== 'object') return null;
  const venue = stadiums[m.stadium];
  if (!venue) return null;
  const matches = venue.matches || [];
  const targetDate = m.kickoff_utc.slice(0, 10);
  // Match by date (preferred) or by the team pair (loose fallback).
  return matches.find(d => d.date === targetDate) || null;
}

// Top-level stadium info (city, capacity, timezone) from the same weather file.
function pickStadiumInfo(weather, stadiumName) {
  if (!weather || !stadiumName) return null;
  const stadiums = weather.stadiums;
  if (!stadiums || typeof stadiums !== 'object') return null;
  return stadiums[stadiumName] || null;
}

function buildWeather(wx, m) {
  const sec = el('div', { class: 'gd-section' });
  const w = wx.weather || {};
  const src = wx.weather_source;
  // Title varies by data source: observed = past, forecast = upcoming, beyond = too far out.
  const titleNote = src === 'observed' ? '(observed)' : (src === 'forecast' ? '(forecast)' : '');
  sec.appendChild(el('h3', {}, `Match-day weather · ${m.stadium} ${titleNote}`.trim()));

  if (src === 'beyond_forecast_window' || !w || Object.keys(w).length === 0) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:12px;color:#3a5a3a;line-height:1.5' },
      src === 'beyond_forecast_window'
        ? 'Outside the 16-day forecast window — refresh closer to the match for accurate conditions.'
        : 'Forecast not yet populated for this match day.'));
    return sec;
  }

  const grid = el('div', { class: 'gd-weather-grid' });
  if (w.temp_max_c != null) grid.appendChild(weatherCell('High', `${Math.round(w.temp_max_c)}°C`, 'warm'));
  if (w.temp_min_c != null) grid.appendChild(weatherCell('Low', `${Math.round(w.temp_min_c)}°C`, 'cool'));
  if (w.precip_mm != null) grid.appendChild(weatherCell('Precip', `${w.precip_mm}mm`));
  if (w.precip_prob_max_pct != null) grid.appendChild(weatherCell('Rain prob', `${w.precip_prob_max_pct}%`));
  if (w.wind_max_kmh != null) grid.appendChild(weatherCell('Wind', `${Math.round(w.wind_max_kmh)} km/h`));
  if (w.uv_index_max != null) grid.appendChild(weatherCell('UV', String(w.uv_index_max)));
  if (!grid.children.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:12px;color:#3a5a3a' }, 'Weather slot present but unspecified.'));
  } else {
    sec.appendChild(grid);
  }
  sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:10px;color:#3a5a3a;margin-top:10px;text-align:right' },
    'Source: Open-Meteo · ' + (src || 'forecast')));
  return sec;
}
function weatherCell(label, value, tone) {
  return el('div', { class: 'gd-weather-cell' },
    el('div', { class: 'v' + (tone ? ' ' + tone : '') }, value),
    el('div', { class: 'lbl' }, label),
  );
}

function renderLiveOrPost(root, ctx) {
  const { m, stats, home, away } = ctx;

  // Goalscorers (per side) when there's at least one goal event.
  const scorers = extractScorers(stats, home, away);
  if (scorers.home.length || scorers.away.length) {
    const sec = el('div', { class: 'gd-sc-grid' });
    for (const side of ['home', 'away']) {
      const team = side === 'home' ? home : away;
      const list = scorers[side];
      const card = el('div', { class: 'gd-section gd-sc-card' });
      card.appendChild(el('div', { class: 'ttl', style: 'font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:#5a7a5a;margin-bottom:8px' },
        `${team ? team.fifa_code : '?'} scorers`));
      if (!list.length) {
        card.appendChild(el('div', { class: 'row', style: 'color:#3a5a3a' }, '—'));
      } else {
        for (const s of list) {
          card.appendChild(el('div', { class: 'row' },
            playerLink(s.name), ' ',
            el('span', { class: 'mins' }, s.mins.join(', ')),
          ));
        }
      }
      sec.appendChild(card);
    }
    root.appendChild(sec);
  }

  const cols = el('div', { class: 'gd-grid-2' });
  cols.appendChild(buildEvents(stats, m, ctx));
  cols.appendChild(buildLiveStats(stats, m));
  root.appendChild(cols);

  // Penalty shootout block when applicable.
  if (m.phase === 'PEN' || m.phase === 'FT_PEN') {
    root.appendChild(buildShootout(stats, home, away));
  }

  if (m.status === 'finished') {
    const story = el('div', { class: 'gd-storyline' });
    story.appendChild(el('h3', {}, 'Result'));
    story.appendChild(el('p', {}, buildPostStoryline(ctx)));
    root.appendChild(story);
  }
}

function extractScorers(stats, home, away) {
  const events = extractEvents(stats);
  const homeCode = home?.fifa_code;
  const awayCode = away?.fifa_code;
  const buckets = { home: new Map(), away: new Map() };
  for (const ev of events) {
    if (ev.type !== 'goal') continue;
    // Match by FIFA code OR by home/away marker (the wc2026api stats schema isn't
    // fully pinned, so accept both team_code strings and side markers).
    const tc = String(ev.teamCode || '').toUpperCase();
    const bucket = (tc === homeCode || tc === 'HOME' || tc === 'H') ? 'home'
                : (tc === awayCode || tc === 'AWAY' || tc === 'A') ? 'away'
                : null;
    if (!bucket) continue;
    if (!buckets[bucket].has(ev.player)) buckets[bucket].set(ev.player, []);
    buckets[bucket].get(ev.player).push(ev.min);
  }
  const collapse = (m) => Array.from(m.entries()).map(([name, mins]) => ({ name, mins }));
  return { home: collapse(buckets.home), away: collapse(buckets.away) };
}

function buildShootout(stats, home, away) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, 'Penalty shootout'));
  // The stats schema for shootouts isn't pinned. Try a few common shapes.
  const shootout = stats && (stats.shootout || stats.penalties || stats.penalty_shootout);
  if (!shootout) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a' },
      home && away ? `${home.fifa_code} vs ${away.fifa_code} decided on penalties — per-kick detail loads once the stats endpoint returns it.` : 'Decided on penalties.'));
    return sec;
  }
  // Try a generic { home_kicks: [bool], away_kicks: [bool] } or array of {team, scored, player}.
  const homeKicks = shootout.home_kicks || shootout.home;
  const awayKicks = shootout.away_kicks || shootout.away;
  if (Array.isArray(homeKicks) && Array.isArray(awayKicks)) {
    sec.appendChild(buildKickRow(home, homeKicks));
    sec.appendChild(buildKickRow(away, awayKicks));
  } else if (Array.isArray(shootout)) {
    // Flat list — bucket by team
    const homeArr = [], awayArr = [];
    for (const k of shootout) {
      const tc = String(k.team_code || k.team || '').toUpperCase();
      const ok = k.scored ?? k.success ?? !!k.goal;
      if (tc === home?.fifa_code) homeArr.push(ok);
      else if (tc === away?.fifa_code) awayArr.push(ok);
    }
    sec.appendChild(buildKickRow(home, homeArr));
    sec.appendChild(buildKickRow(away, awayArr));
  } else {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a' },
      'Shootout data present but in unexpected shape — refresh later.'));
  }
  return sec;
}
function buildKickRow(team, kicks) {
  const row = el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px' });
  row.appendChild(el('span', { style: 'font-family:Archivo;font-weight:800;font-size:11px;color:#dfe6df;min-width:42px' }, team?.fifa_code || '?'));
  const dots = el('div', { style: 'display:flex;gap:6px' });
  for (const ok of kicks) {
    dots.appendChild(el('span', {
      style: `width:15px;height:15px;border-radius:50%;background:${ok ? '#1ea85a' : '#2a1818'};border:${ok ? 'none' : '1px solid #5a3030'};display:inline-block`,
    }));
  }
  row.appendChild(dots);
  return row;
}

function buildEvents(stats, m, ctx) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, 'Match events'));
  let events = extractEvents(stats);
  // If the live stats feed has no timeline yet (or is unavailable), fall back to
  // the goal events baked into the local schedule for finished matches.
  if (!events.length) events = goalEventsFromMatch(m, ctx);
  if (!events.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#4a5a4a' },
      m.status === 'scheduled' ? 'No events yet — kickoff imminent.' : 'No events recorded yet.'));
    return sec;
  }
  const timeline = el('div', { class: 'gd-events' });
  for (const ev of events) {
    const node = el('div', { class: 'gd-event gd-event-' + ev.type });
    node.appendChild(el('span', { class: 'dot', style: 'background:var(--c)' }));
    node.appendChild(el('span', { class: 'min', style: 'color:var(--c)' }, ev.min));
    node.appendChild(el('span', { class: 'type', style: 'color:var(--c);background:var(--bg)' }, ev.typeLabel));
    node.appendChild(el('span', { class: 'who' }, ev.player ? playerLink(ev.player) : ''));
    node.appendChild(el('span', { class: 'team' }, ev.teamCode || ''));
    if (ev.detail) node.appendChild(el('span', { class: 'detail' }, ev.detail));
    timeline.appendChild(node);
  }
  sec.appendChild(timeline);
  return sec;
}

function buildLiveStats(stats, m) {
  const sec = el('div', { class: 'gd-section' });
  const head = el('h3', {}, 'Match stats');
  head.appendChild(el('span', { class: 'note' }, m.status === 'live' ? 'Partial · updating' : 'Final'));
  sec.appendChild(head);
  const rows = extractStatRows(stats);
  if (!rows.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#4a5a4a' }, 'Stats unavailable for this match yet.'));
    return sec;
  }
  for (const r of rows) {
    if (r.pending) {
      sec.appendChild(el('div', { class: 'gd-stat-pending' },
        el('span', { class: 'lbl' }, r.label),
        el('span', { class: 'v' }, 'Populating…'),
      ));
    } else {
      const total = (r.v1 + r.v2) || 1;
      const p1 = Math.max(6, Math.round(r.v1 / total * 100));
      const p2 = Math.max(6, Math.round(r.v2 / total * 100));
      sec.appendChild(el('div', { class: 'gd-stat-row' },
        el('div', { class: 'head' },
          el('span', { class: 'v1' }, String(r.v1)),
          el('span', { class: 'lbl' }, r.label),
          el('span', { class: 'v2' }, String(r.v2)),
        ),
        el('div', { class: 'bar' },
          el('div', { class: 'f1', style: `flex:${p1}` }),
          el('div', { class: 'f2', style: `flex:${p2}` }),
        ),
      ));
    }
  }
  return sec;
}

function goalEventsFromMatch(m, ctx) {
  const goals = Array.isArray(m && m.goals) ? m.goals : [];
  if (!goals.length) return [];
  const codeFor = (teamName) => {
    if (ctx && ctx.home && teamName === m.home_team) return ctx.home.fifa_code;
    if (ctx && ctx.away && teamName === m.away_team) return ctx.away.fifa_code;
    return teamName || '';
  };
  return goals.map((g) => ({
    type: 'goal',
    typeLabel: g.ownGoal ? 'OG' : (g.penalty ? 'PEN' : 'GOAL'),
    detail: g.ownGoal ? 'Own goal' : (g.penalty ? 'Penalty' : 'Goal'),
    min: /'$/.test(String(g.minute)) ? String(g.minute) : `${g.minute}'`,
    player: g.player || '',
    teamCode: codeFor(g.team),
  }));
}

function extractEvents(stats) {
  if (!stats) return [];
  const tl = stats.timeline || stats.events || stats.minute_by_minute || [];
  if (!Array.isArray(tl)) return [];
  const TYPE = {
    goal: { typeLabel: 'GOAL', type: 'goal', detail: 'Goal' },
    own_goal: { typeLabel: 'OG', type: 'goal', detail: 'Own goal' },
    penalty: { typeLabel: 'PEN', type: 'goal', detail: 'Penalty' },
    yellow: { typeLabel: 'YC', type: 'yellow', detail: 'Yellow card' },
    yellow_card: { typeLabel: 'YC', type: 'yellow', detail: 'Yellow card' },
    red: { typeLabel: 'RC', type: 'red', detail: 'Red card' },
    red_card: { typeLabel: 'RC', type: 'red', detail: 'Red card' },
    substitution: { typeLabel: 'SUB', type: 'sub', detail: 'Substitution' },
    sub: { typeLabel: 'SUB', type: 'sub', detail: 'Substitution' },
  };
  return tl.map(ev => {
    const t = ev.type || ev.event_type || '';
    const meta = TYPE[t] || { typeLabel: t.toUpperCase().slice(0, 3), type: 'sub', detail: t };
    return {
      ...meta,
      min: (ev.minute != null ? ev.minute + "'" : (ev.time || '')),
      player: ev.player || ev.player_name || ev.scorer || '',
      teamCode: ev.team_code || ev.team || '',
    };
  }).filter(e => e.min || e.player);
}

function extractStatRows(stats) {
  if (!stats) return [];
  const out = [];
  const s = stats.stats || stats;
  const pairs = [
    ['Possession %', s.possession_home, s.possession_away],
    ['Shots', s.shots_home, s.shots_away],
    ['On target', s.shots_on_target_home ?? s.on_target_home, s.shots_on_target_away ?? s.on_target_away],
    ['Corners', s.corners_home, s.corners_away],
    ['Fouls', s.fouls_home, s.fouls_away],
    ['Yellow', s.yellow_home, s.yellow_away],
    ['Red', s.red_home, s.red_away],
  ];
  for (const [label, v1, v2] of pairs) {
    if (v1 == null && v2 == null) continue;
    if (v1 == null || v2 == null) out.push({ label, pending: true });
    else out.push({ label, v1, v2 });
  }
  return out;
}

function buildPostStoryline(ctx) {
  const { m, home, away } = ctx;
  const homeN = home?.name || m.home_team || 'Home';
  const awayN = away?.name || m.away_team || 'Away';
  const hs = m.home_score ?? 0, as = m.away_score ?? 0;
  const winner = hs > as ? homeN : (as > hs ? awayN : null);
  if (m.round === 'final') return winner ? `${winner} are crowned World Cup 2026 champions.` : `A drawn final goes the distance.`;
  if (m.round === 'group') return winner ? `${winner} take the points in Group ${m.group_name}.` : `Honours shared in Group ${m.group_name}.`;
  if (winner) return `${winner} advance to the next knockout round.`;
  return `Tied — see the live stage to see what comes next.`;
}
