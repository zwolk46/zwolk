// Shared renderer for the Team Detail view.

import * as api from './api.js';
import * as data from './data.js';
import { flagSrc } from './flags.js';
import { dayLabel, timeLabel, eur, initials, ordinal } from './format.js';
import { pronounce } from './data.js';

export const teamCss = `
  .td-root{position:relative;container-type:inline-size}
  .td-hero{position:relative;width:100%;height:clamp(220px,46cqi,520px);background-size:cover;background-position:center;border-radius:0;margin:-22px -26px 18px;animation:wc-reveal-up .55s cubic-bezier(.34,1.56,.64,1) both}
  .td-plate{position:absolute;left:0;bottom:clamp(16px,3cqi,26px);display:flex;max-width:92%}
  .td-plate .bar{width:6px;background:#f5c712}
  .td-plate .body{background:rgba(8,12,10,0.94);backdrop-filter:blur(4px);padding:clamp(16px,3cqi,28px) clamp(20px,4cqi,38px);min-width:0}
  .td-plate .name{font-family:Anton;font-size:clamp(36px,11cqi,108px);line-height:0.85;text-transform:uppercase;letter-spacing:-0.01em;color:#f4f2ea}
  .td-plate .meta{display:flex;align-items:center;gap:13px;margin-top:12px;flex-wrap:wrap}
  .td-plate .meta span{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:clamp(10px,1.4cqi,13px);letter-spacing:0.16em;text-transform:uppercase;color:#9bbaa2}
  .td-plate .meta .accent{color:#f5c712}
  .td-plate .meta .dot{width:5px;height:5px;border-radius:50%;background:#f5c712}
  .td-pron{display:inline-flex;align-items:center;gap:6px;margin-top:14px;background:rgba(245,199,18,0.12);border:1px solid rgba(245,199,18,0.3);border-radius:999px;padding:6px 12px;font-family:Archivo;font-weight:800;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#f5c712;cursor:pointer}
  .td-pron:hover{background:rgba(245,199,18,0.22)}
  .td-pron svg .wv{opacity:.55}
  .td-pron[data-playing="1"] svg .wv1{animation:pron-wv 0.9s ease-in-out infinite}
  .td-pron[data-playing="1"] svg .wv2{animation:pron-wv 0.9s ease-in-out infinite 0.18s}
  @keyframes pron-wv{0%,100%{opacity:.15}50%{opacity:1}}

  .td-meta-bar{display:flex;align-items:stretch;background:#0e1610;border:1px solid #18241a;border-radius:14px;overflow:hidden;margin-bottom:12px}
  .td-meta-bar .cell{flex:1;padding:13px 20px;border-right:1px solid #141f14}
  .td-meta-bar .cell:last-child{border-right:none}
  .td-meta-bar .lbl{font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#3a5a3a;margin-bottom:6px}
  .td-meta-bar .val{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:16px;letter-spacing:0.03em;color:#eef2ee}
  .td-meta-bar .val.big{font-family:Anton;font-size:20px;color:#f5c712;line-height:1}

  .td-record{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#141f14;border-radius:14px;overflow:hidden;margin-bottom:14px}
  .td-record .cell{background:#0e1610;padding:14px 6px;text-align:center}
  .td-record .cell:last-child{background:linear-gradient(160deg,rgba(245,199,18,0.16),#0e1610)}
  .td-record .v{font-family:Anton;font-size:clamp(22px,3.4cqi,38px);color:#f4f2ea}
  .td-record .lbl{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.1em;margin-top:4px;color:#3a5a3a}
  .td-record .cell:last-child .lbl{color:#8a7a3a}

  .td-section{background:#0e1610;border:1px solid #18241a;border-radius:16px;padding:18px 20px;margin-top:14px;animation:wc-reveal-up .55s ease both;container-type:inline-size}
  .td-section h3{font-family:Archivo;font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#f5c712;margin-bottom:14px;display:flex;align-items:center;gap:10px}
  .td-section h3 .note{color:#3a5a3a;font-weight:700;letter-spacing:0.06em;margin-left:auto}

  .td-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}

  .td-sv .num{font-family:JetBrains Mono,monospace;font-weight:700;font-size:clamp(28px,4.5cqi,46px);color:#f4f2ea;line-height:0.9}
  .td-sv .lbl{font-family:Archivo;font-weight:700;font-size:11px;color:#5a7a5a;margin-top:6px}
  .td-sv .mvp{display:flex;align-items:center;gap:11px;margin-top:16px;padding-top:14px;border-top:1px solid #141f14}
  .td-sv .face{width:34px;height:40px;flex:none;border-radius:7px;background:linear-gradient(160deg,#1a2218,#0c1310);border:1px solid #20301f;display:flex;align-items:center;justify-content:center;font-family:Anton;font-size:13px;color:#7e9a7e}
  .td-sv .info{flex:1;min-width:0}
  .td-sv .name{font-family:Archivo;font-weight:800;font-size:14px;color:#eef2ee}
  .td-sv .sub{font-family:Archivo;font-weight:600;font-size:11px;color:#5a7a5a}
  .td-sv .val{font-family:JetBrains Mono,monospace;font-weight:700;font-size:13px;color:#f5c712}

  .td-demo{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#141f14;border-radius:12px;overflow:hidden}
  .td-demo .cell{background:#0e1610;padding:13px 10px;text-align:center}
  .td-demo .v{font-family:Anton;font-size:24px;color:#f4f2ea}
  .td-demo .lbl{font-family:Archivo;font-weight:800;font-size:9px;color:#3a5a3a;letter-spacing:0.08em;margin-top:3px}
  .td-pos-dist{margin-top:12px}
  .td-pos-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .td-pos-row .lbl{font-family:Archivo;font-weight:800;font-size:10px;letter-spacing:0.06em;color:#9bbaa2;min-width:88px}
  .td-pos-row .bar{flex:1;height:8px;background:#141f14;border-radius:5px;overflow:hidden}
  .td-pos-row .fill{height:100%;background:linear-gradient(90deg,#c9a227,#f5c712);border-radius:5px;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .td-pos-row .n{font-family:Anton;font-size:15px;color:#f5c712;min-width:20px;text-align:right}

  .td-stand-head{display:grid;grid-template-columns:24px 1fr 34px 34px 44px;gap:6px;padding:0 6px 8px;font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#3a5a3a}
  .td-stand-row{display:grid;grid-template-columns:24px 1fr 34px 34px 44px;gap:6px;align-items:center;padding:9px 6px;border-radius:8px;margin-bottom:2px;text-decoration:none;color:inherit}
  .td-stand-row:hover{background:rgba(255,255,255,0.02)}
  .td-stand-row.me{background:rgba(245,199,18,0.08);border-left:3px solid #f5c712}
  .td-stand-row.q{border-left:3px solid #1ea85a}
  .td-stand-row .pos{font-family:Anton;font-size:14px;color:#3a5a3a}
  .td-stand-row.me .pos{color:#f5c712}
  .td-stand-row .nm{display:flex;align-items:center;gap:8px;min-width:0}
  .td-stand-row .nm .flag{width:22px;height:16px;flex:none;border-radius:3px;background-size:cover;background-position:center}
  .td-stand-row .nm span{font-family:Archivo;font-weight:600;font-size:13px;color:#b9c0b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-stand-row.me .nm span{font-weight:800;color:#f4f2ea}
  .td-stand-row .c{text-align:center;font-family:Archivo;font-weight:700;font-size:12px;color:#9bbaa2}
  .td-stand-row .p{text-align:right;font-family:Anton;font-size:16px;color:#9bbaa2}
  .td-stand-row.me .p{color:#f5c712}
  .td-stand-key{display:flex;align-items:center;gap:6px;margin-top:10px;font-family:Archivo;font-weight:700;font-size:10px;color:#5a7a5a}
  .td-stand-key span.s{width:11px;height:11px;border-radius:3px;background:#1ea85a}

  .td-fix-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .td-form-chips{display:flex;gap:5px}
  .td-form-chip{font-family:Anton;font-size:13px;width:22px;height:22px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#08120a}
  .td-form-W{background:#1ea85a}
  .td-form-D{background:#c9a227}
  .td-form-L{background:#c0444f}
  .td-form-N{background:#2a3a2a;color:#5a7a5a}
  .td-fix-row{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid #141f14;text-decoration:none;color:inherit;cursor:pointer;transition:transform .2s,background .2s}
  .td-fix-row:hover{transform:translateX(3px)}
  .td-fix-row .when{display:flex;flex-direction:column;min-width:64px}
  .td-fix-row .when .d{font-family:Anton;font-size:15px;line-height:1;color:#f4f2ea}
  .td-fix-row .when .t{font-family:Archivo;font-weight:700;font-size:10px;color:#5a7a5a;margin-top:2px}
  .td-fix-row .vs{font-family:Archivo;font-weight:800;font-size:10px;color:#3a5a3a}
  .td-fix-row .opp-flag{width:26px;height:19px;flex:none;border-radius:3px;background-size:cover;background-position:center}
  .td-fix-row .opp-name{flex:1;font-family:Archivo;font-weight:700;font-size:13px;color:#dfe6df;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-fix-row .opp-name .res{font-weight:800;color:#f5c712;margin-left:6px}
  .td-fix-row .opp-name .res.loss{color:#c0444f}
  .td-fix-row .opp-name .res.draw{color:#c9a227}
  .td-fix-row .ven{font-family:Archivo;font-weight:600;font-size:10px;color:#5a7a5a;white-space:nowrap}

  .td-squad-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .td-sort-pill{display:flex;gap:3px;background:#0c1310;border:1px solid #1c2c1c;border-radius:8px;padding:3px}
  .td-sort-pill button{cursor:pointer;border:none;font-family:Archivo;font-weight:800;font-size:10px;letter-spacing:0.04em;text-transform:uppercase;padding:5px 11px;border-radius:6px;background:transparent;color:#9bbaa2}
  .td-sort-pill button.on{background:#f5c712;color:#0a0e0c}
  .td-squad-section .ttl{display:flex;align-items:center;gap:10px;margin:16px 0 10px}
  .td-squad-section .ttl span{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#f5c712}
  .td-squad-section .ttl hr{flex:1;height:1px;background:#1a241a;border:none}
  .td-squad-section .ttl .n{font-family:Archivo;font-weight:800;font-size:10px;color:#3a5a3a}
  .td-squad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
  .td-squad-card{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;background:#0c1310;border:1px solid #16201a;text-decoration:none;color:inherit;transition:transform .2s,border-color .2s}
  .td-squad-card:hover{transform:translateY(-2px);border-color:rgba(245,199,18,0.25)}
  .td-squad-card.mvp{background:rgba(245,199,18,0.08);border-color:rgba(245,199,18,0.3)}
  .td-squad-card .no{font-family:Anton;font-size:19px;color:#3a5a3a;min-width:26px}
  .td-squad-card.mvp .no{color:#f5c712}
  .td-squad-card .info{flex:1;min-width:0}
  .td-squad-card .name{font-family:Archivo;font-weight:800;font-size:13px;color:#f4f2ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-squad-card .sub{font-family:Archivo;font-weight:600;font-size:11px;color:#5a7a5a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-squad-card .val{font-family:JetBrains Mono,monospace;font-weight:700;font-size:12px;color:#f5c712}

  .td-country-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}
  .td-country-cell{padding:6px 0}
  .td-country-cell .k{font-family:Archivo;font-weight:800;font-size:9px;color:#3a5a3a;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px}
  .td-country-cell .v{font-family:Archivo;font-weight:700;font-size:13px;color:#dfe6df}
  .td-country-cell .v.big{font-family:Anton;font-size:22px;color:#f4f2ea}

  .td-rank-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @container (max-width:520px){.td-rank-grid{grid-template-columns:1fr}}
  .td-rank-card{background:#0c1310;border:1px solid #16201a;border-radius:12px;padding:14px 16px;text-align:center}
  .td-rank-card .src{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.12em;color:#5a7a5a;text-transform:uppercase}
  .td-rank-card .num{font-family:Anton;font-size:48px;color:#f5c712;line-height:0.9;margin-top:6px}
  .td-rank-card .peak{font-family:Archivo;font-weight:600;font-size:11px;color:#5a7a5a;margin-top:8px}

  .td-wc-hist-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:6px}
  .td-wc-hist-card{background:#0c1310;border:1px solid #16201a;border-radius:10px;padding:11px 13px}
  .td-wc-hist-card .year{font-family:Anton;font-size:22px;color:#f4f2ea}
  .td-wc-hist-card .out{font-family:Archivo;font-weight:700;font-size:11px;color:#9bbaa2;margin-top:4px}
  .td-wc-hist-card .pld{font-family:Archivo;font-weight:600;font-size:11px;color:#5a7a5a;margin-top:2px}

  a.td-plink{color:inherit;text-decoration:none;cursor:pointer;transition:color .15s}
  a.td-plink:hover,.td-sc-name a:hover{color:#f5c712}

  /* Squad value: MVP face photo + value-by-position bars */
  .td-sv .face{background-size:cover;background-position:center 35%;overflow:hidden}
  .td-svpos{margin-top:16px;padding-top:14px;border-top:1px solid #141f14;display:flex;flex-direction:column;gap:8px}
  .td-svpos .row{display:flex;align-items:center;gap:10px}
  .td-svpos .lbl{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.06em;color:#9bbaa2;min-width:84px;text-transform:uppercase}
  .td-svpos .track{flex:1;height:7px;background:#141f14;border-radius:5px;overflow:hidden}
  .td-svpos .fill{height:100%;background:linear-gradient(90deg,#c9a227,#f5c712);border-radius:5px;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .td-svpos .v{font-family:JetBrains Mono,monospace;font-weight:700;font-size:10px;color:#5a7a5a;min-width:42px;text-align:right}

  /* Squad profile extra chips (clubs / foreign-based / age range / height) */
  .td-demo2{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:1px;background:#141f14;border-radius:12px;overflow:hidden;margin-top:12px}
  .td-demo2 .cell{background:#0e1610;padding:11px 10px;text-align:center}
  .td-demo2 .v{font-family:Anton;font-size:19px;color:#f4f2ea;line-height:1}
  .td-demo2 .v.accent{color:#f5c712}
  .td-demo2 .lbl{font-family:Archivo;font-weight:800;font-size:8px;letter-spacing:0.06em;color:#3a5a3a;margin-top:4px;text-transform:uppercase}
  .td-foot{display:flex;gap:8px;margin-top:12px}
  .td-foot .seg{flex:none;display:flex;align-items:center;gap:6px;font-family:Archivo;font-weight:700;font-size:11px;color:#9bbaa2}
  .td-foot .dot{width:9px;height:9px;border-radius:50%}

  /* Where they play */
  .td-wtp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @container (max-width:520px){.td-wtp-grid{grid-template-columns:1fr}}
  .td-wtp h4{font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#5a7a5a;margin-bottom:11px}
  .td-wtp-row{display:flex;align-items:center;gap:9px;margin-bottom:8px}
  .td-wtp-row .lab{display:flex;align-items:center;gap:6px;min-width:0;flex:1}
  .td-wtp-row .lab .fl{width:18px;height:13px;flex:none;border-radius:2px;background-size:cover;background-position:center}
  .td-wtp-row .lab span{font-family:Archivo;font-weight:700;font-size:11px;color:#cfd6cf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-wtp-row .track{width:42%;flex:none;height:8px;background:#141f14;border-radius:5px;overflow:hidden}
  .td-wtp-row .fill{height:100%;background:linear-gradient(90deg,#c9a227,#f5c712);border-radius:5px;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .td-wtp-row .n{font-family:Anton;font-size:13px;color:#f5c712;min-width:20px;text-align:right}

  /* Squad card photo + contract flag */
  .td-squad-card .face{width:38px;height:38px;flex:none;border-radius:50%;background:#111a13;border:1px solid #20301f;background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .td-squad-card .face .ini{font-family:Anton;font-size:13px;color:#6f8a70}
  .td-squad-card .sub .exp{color:#c98a27}

  .td-loading{padding:40px 20px;text-align:center;font-family:Archivo;font-weight:700;font-size:13px;color:#5a6a5a}
  .td-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid #2a3a2a;border-top-color:#f5c712;border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  .td-error{padding:24px 18px;text-align:center;font-family:Archivo;font-weight:600;font-size:13px;color:#c0444f;background:#1c0e10;border:1px solid #3a1820;border-radius:12px;max-width:580px;margin:30px auto}
`;

function pronIconSvg(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 14 14" fill="none" aria-hidden="true">`
    + `<path d="M2 5v4h2l3 2.5V2.5L4 5H2z" fill="currentColor"/>`
    + `<path class="wv wv1" d="M9 5c.8.8.8 3.2 0 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
    + `<path class="wv wv2" d="M11 3.5c1.5 1.5 1.5 5.5 0 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
    + `</svg>`;
}

function playPron(btn, url) {
  if (!url || !btn) return;
  const audio = new Audio(url);
  btn.dataset.playing = '1';
  const stop = () => { delete btn.dataset.playing; };
  audio.addEventListener('ended', stop);
  audio.addEventListener('error', stop);
  audio.addEventListener('pause', stop);
  audio.play().catch(stop);
}

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

// Wrap a player name in a popup link (resolved by tmId when known, else by name).
function playerLink(name, tmId, className = 'td-plink') {
  if (!name) return document.createTextNode('');
  const id = tmId || `name:${name}`;
  return el('a', { class: className, href: `/wc/player/${encodeURIComponent(id)}` }, name);
}

async function loadTeamMatches(teamCode, team) {
  // Prefer live (real-time scores/status); fall back to the complete local
  // schedule filtered to this team so fixtures always render.
  try {
    const r = await api.getMatches({ team: teamCode });
    const arr = Array.isArray(r) ? r : (r && r.data) || [];
    if (arr && arr.length) return arr;
  } catch {}
  try {
    const all = await data.getMatchesSample();
    const names = new Set([team.name, team.name_normalised].filter(Boolean));
    return (all || []).filter(m => names.has(m.home_team) || names.has(m.away_team));
  } catch { return null; }
}

export async function renderTeamInto(container, teamCode, opts = {}) {
  container.classList.add('td-root');
  container.innerHTML = `<div class="td-loading">Loading team…</div>`;

  const team = await data.teamByCode(teamCode);
  if (!team) {
    container.innerHTML = `<div class="td-error">Unknown team code: ${teamCode}</div>`;
    return;
  }

  if (opts.setTitle) opts.setTitle(team.name, { flagUrl: flagSrc(team.fifa_code) });

  const enrich = await Promise.allSettled([
    loadTeamMatches(teamCode, team),
    api.getGroups().catch(() => null),
    data.getCountries(),
    data.getEloRatings(),
    data.getFifaRankings(),
    data.getTeamRecords(),
    data.getPlayersByTeamSample(),
    data.get2026Squads().catch(() => null),
    data.getSportsdbTeams(),
    data.getPronunciations(),
    Promise.all([2010, 2014, 2018, 2022].map(y => data.getWcYear(y).catch(() => null))),
    api.getMatches().catch(() => null),          // all matches → live group table
    data.getTournamentScorers(),                  // golden boot / scorers
    data.getGroupsSample().catch(() => null),     // static standings fallback
  ]);
  const [matches, groups, countries, elo, fifa, records, playersSample, squads2026, sportsdb, prons, history, allMatches, scorers, groupsStatic] =
    enrich.map(r => r.status === 'fulfilled' ? r.value : null);

  const ctx = { team, matches, groups, countries, elo, fifa, records, playersSample, squads2026, sportsdb, prons, history, allMatches, scorers, groupsStatic, container, opts, sort: 'value' };
  render(ctx);
}

function render(ctx) {
  const { team, container } = ctx;
  container.innerHTML = '';

  const flagUrl = flagSrc(team.fifa_code) || '';
  const country = (ctx.countries || {})[team.fifa_code] || null;
  const sportsdbT = (ctx.sportsdb || {})[team.fifa_code] || null;
  // Try both the team name and the normalised name (e.g. "USA" vs "United States").
  const pronUrl = pronounce(ctx.prons, team.name, 'countries')
              || pronounce(ctx.prons, team.name_normalised, 'countries');

  // HERO
  const hero = el('div', { class: 'td-hero', style: `background-image:url(${flagUrl})` });
  const plate = el('div', { class: 'td-plate' });
  plate.appendChild(el('div', { class: 'bar' }));
  const body = el('div', { class: 'body' });
  body.appendChild(el('div', { class: 'name' }, team.name));
  const meta = el('div', { class: 'meta' });
  meta.appendChild(el('span', {}, team.confed || 'FIFA'));
  meta.appendChild(el('span', { class: 'dot' }));
  meta.appendChild(el('span', {}, 'Group ' + team.group));
  body.appendChild(meta);
  if (pronUrl) {
    const pron = el('button', {
      class: 'td-pron',
      type: 'button',
      'aria-label': `Hear ${team.name}`,
      onclick: (ev) => playPron(ev.currentTarget, pronUrl),
    },
      el('span', { html: pronIconSvg(14) }),
      ' Hear name');
    body.appendChild(pron);
  }
  plate.appendChild(body);
  hero.appendChild(plate);
  container.appendChild(hero);

  // Meta bar
  // Live /groups gives membership only → compute the table from all matches
  // (joined by FIFA code, robust to name spelling); fall back to static standings.
  const liveGroup = (ctx.groups || []).find(g => (g.group_name || g.group || g.letter) === team.group);
  let standingsForGroup = pickGroupStandings(ctx.groups, team.group);
  if ((!standingsForGroup || !standingsForGroup.length) && ctx.allMatches) {
    standingsForGroup = data.computeGroupStandings(ctx.allMatches, liveGroup || { group_name: team.group });
  }
  if (!standingsForGroup || !standingsForGroup.length) standingsForGroup = pickGroupStandings(ctx.groupsStatic, team.group);
  const myRow = (standingsForGroup || []).find(r =>
    (r.code && r.code === team.fifa_code) || (r.team || r.name) === team.name || (r.team || r.name) === team.name_normalised);
  const pos = standingsForGroup ? standingsForGroup.findIndex(r => (r.team || r.name) === team.name || (r.team || r.name) === team.name_normalised) + 1 : 0;
  container.appendChild(el('div', { class: 'td-meta-bar' },
    el('div', { class: 'cell' }, el('div', { class: 'lbl' }, 'Confederation'), el('div', { class: 'val' }, team.confed || 'FIFA')),
    el('div', { class: 'cell' }, el('div', { class: 'lbl' }, 'Group'), el('div', { class: 'val big' }, team.group)),
    el('div', { class: 'cell' }, el('div', { class: 'lbl' }, 'Standing'), el('div', { class: 'val' }, pos > 0 ? ordinal(pos) : '—')),
  ));

  // Record strip
  const w = myRow?.won ?? 0, d = myRow?.drawn ?? 0, l = myRow?.lost ?? 0, gp = myRow?.played ?? 0, pts = myRow?.points ?? 0;
  container.appendChild(el('div', { class: 'td-record' },
    cell(gp, 'PLAYED'),
    cell(w, 'WON', '#1ea85a'),
    cell(d, 'DREW', '#c9a227'),
    cell(l, 'LOST', '#c0444f'),
    cell(pts, 'POINTS', '#f5c712'),
  ));

  // SV + demographics
  const sv = buildSquadValue(team, ctx.playersSample);
  const demo = buildDemographics(team, ctx.playersSample, ctx.squads2026);
  container.appendChild(el('div', { class: 'td-grid-2', style: 'margin-top:14px' }, sv, demo));

  // Rankings
  const rk = buildRankings(team, ctx.elo, ctx.fifa);
  if (rk) container.appendChild(rk);

  // Country panel
  if (country) container.appendChild(buildCountryPanel(country));

  // SportsDB federation card
  if (sportsdbT) container.appendChild(buildSportsdbCard(sportsdbT));

  // Standings + Fixtures
  const fixSection = buildFixtures(team, ctx.matches);
  const standSection = standingsForGroup ? buildStandings(standingsForGroup, team, team.group) : null;
  if (standSection && fixSection) container.appendChild(el('div', { class: 'td-grid-2' }, standSection, fixSection));
  else if (standSection) container.appendChild(standSection);
  else if (fixSection) container.appendChild(fixSection);

  // Tournament scorers (golden boot data, from live match timelines)
  container.appendChild(buildScorers(team, ctx.scorers, myRow?.gf ?? 0));

  // All-time international record (1872-present per team-all-time-records.json)
  if (ctx.records && ctx.records[team.fifa_code]) {
    container.appendChild(buildAllTimeRecord(ctx.records[team.fifa_code]));
  }

  // WC history
  const hist = buildWcHistory(team, ctx.history);
  if (hist) container.appendChild(hist);

  // Where they play (clubs + leagues that supply the squad)
  const wtp = buildWhereTheyPlay(team, ctx.playersSample);
  if (wtp) container.appendChild(wtp);

  // Full squad
  container.appendChild(buildSquad(team, ctx.playersSample, ctx.squads2026, ctx));
}

function cell(v, lbl, color) {
  return el('div', { class: 'cell' },
    el('div', { class: 'v', style: color ? `color:${color}` : '' }, String(v)),
    el('div', { class: 'lbl' }, lbl),
  );
}

function pickGroupStandings(groups, letter) {
  if (!groups || !letter) return null;
  const arr = Array.isArray(groups) ? groups : (groups.data || groups.groups || []);
  if (!Array.isArray(arr)) return null;
  const g = arr.find(x => (x.group_name || x.group) === letter || x.letter === letter);
  return g ? (g.standings || g.table || []) : null;
}

function teamSquad(team, playersSample, squads2026) {
  const sampleList = data.squadFor(playersSample, team);
  if (sampleList && sampleList.length) {
    return sampleList.map(p => ({
      name: p.name, tmId: p.tmId, shirt: p.shirtNumber || null,
      position: normPos(p), positionDetail: p.positionDetail || p.position,
      club: p.currentClub, clubCountry: p.currentClubCountry || null,
      age: p.age, caps: p.internationalCaps, value: p.marketValueEur,
      peak: p.marketValuePeak || null, photo: p.tmPhotoUrl || null,
      foot: p.preferredFoot || null, height: p.height || null,
      contractUntil: p.contractUntil || null,
    }));
  }
  const enrich = squads2026 && (squads2026[team.fifa_code] || squads2026[team.name]);
  if (enrich && Array.isArray(enrich)) {
    return enrich.map(p => ({
      name: p.name || p.player, shirt: p.shirt_number || p.no || null,
      position: p.position || 'MID', club: p.club || '', clubCountry: null,
      age: p.age || null, caps: null, value: null, photo: null,
    }));
  }
  return [];
}
// Transfermarkt positionGroup (GK/DF/MF/FW) → our 4-bucket code. This is the
// reliable signal; the free-text `position` field is inconsistent ("DF" vs
// "Goalkeeper") and must not be fed to the substring matcher below.
const POSGROUP = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' };
function normPos(p) {
  return POSGROUP[p.positionGroup] || shortPos(p.positionDetail || p.position);
}
function shortPos(p) {
  if (!p) return 'MID';
  const s = String(p).toLowerCase();
  if (s === 'gk' || s.includes('keeper')) return 'GK';
  if (s === 'df' || s.includes('back') || s.includes('defender') || s.includes('def')) return 'DEF';
  if (s === 'fw' || s.includes('forward') || s.includes('striker') || s.includes('winger') || s.includes('fwd')) return 'FWD';
  return 'MID';
}

function buildSquadValue(team, playersSample) {
  const squad = teamSquad(team, playersSample, null);
  const sec = el('div', { class: 'td-section td-sv' });
  sec.appendChild(el('h3', {}, 'Squad value'));
  if (!squad.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a' }, 'Player-level Transfermarkt data not yet wired for this team.'));
    return sec;
  }
  const withValue = squad.filter(p => p.value);
  const total = withValue.reduce((a, p) => a + p.value, 0);
  const avg = withValue.length ? Math.round(total / withValue.length) : 0;
  const mvp = withValue.slice().sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  sec.appendChild(el('div', { class: 'num' }, eur(total)));
  sec.appendChild(el('div', { class: 'lbl' }, `${squad.length} players · avg ${eur(avg)}`));
  if (mvp) {
    const face = el('div', { class: 'face' });
    if (mvp.photo) face.style.backgroundImage = `url(${mvp.photo})`;
    else face.appendChild(document.createTextNode(initials(mvp.name)));
    sec.appendChild(el('a', { class: 'mvp', href: `/wc/player/${encodeURIComponent(mvp.tmId || 'name:' + mvp.name)}`, style: 'text-decoration:none' },
      face,
      el('div', { class: 'info' },
        el('div', { class: 'name' }, mvp.name),
        el('div', { class: 'sub' }, 'Most valuable player'),
      ),
      el('div', { class: 'val' }, eur(mvp.value)),
    ));
  }
  // Value concentrated by position line.
  if (withValue.length) {
    const byPos = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of withValue) byPos[p.position] = (byPos[p.position] || 0) + p.value;
    const maxPos = Math.max(...Object.values(byPos), 1);
    const POSLBL = { GK: 'Goal', DEF: 'Defence', MID: 'Midfield', FWD: 'Attack' };
    const box = el('div', { class: 'td-svpos' });
    for (const k of ['GK', 'DEF', 'MID', 'FWD']) {
      if (!byPos[k]) continue;
      box.appendChild(el('div', { class: 'row' },
        el('span', { class: 'lbl' }, POSLBL[k]),
        el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(byPos[k] / maxPos * 100).toFixed(1)}%` })),
        el('span', { class: 'v' }, eur(byPos[k])),
      ));
    }
    sec.appendChild(box);
  }
  return sec;
}

function buildDemographics(team, playersSample, squads2026) {
  const squad = teamSquad(team, playersSample, squads2026);
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, 'Squad profile'));
  if (!squad.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a' }, 'Roster not yet wired.'));
    return sec;
  }
  const ages = squad.filter(p => p.age).map(p => p.age);
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—';
  sec.appendChild(el('div', { class: 'td-demo' },
    el('div', { class: 'cell' }, el('div', { class: 'v' }, String(squad.length)), el('div', { class: 'lbl' }, 'PLAYERS')),
    el('div', { class: 'cell' }, el('div', { class: 'v' }, avgAge), el('div', { class: 'lbl' }, 'AVG AGE')),
  ));

  // Richer profile chips when we have full player data (clubs, foreign-based,
  // age range, average height) — degrade silently for fallback rosters.
  const clubs = new Set(squad.map(p => p.club).filter(Boolean));
  const homeCC = team.fifa_code;
  const based = squad.filter(p => p.clubCountry);
  const foreign = based.filter(p => p.clubCountry !== homeCC).length;
  const heights = squad.filter(p => p.height).map(p => p.height);
  const avgH = heights.length ? Math.round(heights.reduce((a, b) => a + b, 0) / heights.length) : null;
  if (ages.length || clubs.size) {
    const minA = ages.length ? Math.min(...ages) : null;
    const maxA = ages.length ? Math.max(...ages) : null;
    const cells = [];
    if (clubs.size) cells.push(['v', String(clubs.size), 'CLUBS']);
    if (based.length) cells.push(['v accent', `${Math.round(foreign / based.length * 100)}%`, 'PLAY ABROAD']);
    if (minA && maxA) cells.push(['v', `${minA}–${maxA}`, 'AGE RANGE']);
    if (avgH) cells.push(['v', `${avgH}cm`, 'AVG HEIGHT']);
    if (cells.length) {
      const grid2 = el('div', { class: 'td-demo2' });
      for (const [cls, v, lbl] of cells) {
        grid2.appendChild(el('div', { class: 'cell' },
          el('div', { class: 'td-demo2-v ' + cls.replace('v', 'v') }, v),
          el('div', { class: 'lbl' }, lbl)));
      }
      // Fix class names (the helper above kept 'v'/'v accent').
      [...grid2.querySelectorAll('.td-demo2-v')].forEach((e, i) => { e.className = cells[i][0]; });
      sec.appendChild(grid2);
    }
  }

  const POSLABEL = { GK:'Goalkeepers', DEF:'Defenders', MID:'Midfielders', FWD:'Forwards' };
  const counts = { GK:0, DEF:0, MID:0, FWD:0 };
  for (const p of squad) counts[p.position] = (counts[p.position] || 0) + 1;
  const max = Math.max(...Object.values(counts), 1);
  const dist = el('div', { class: 'td-pos-dist', style: 'margin-top:14px' });
  for (const k of ['GK','DEF','MID','FWD']) {
    const pct = Math.round((counts[k] / max) * 100);
    dist.appendChild(el('div', { class: 'td-pos-row' },
      el('span', { class: 'lbl' }, POSLABEL[k]),
      el('div', { class: 'bar' }, el('div', { class: 'fill', style: `width:${pct}%` })),
      el('div', { class: 'n' }, String(counts[k])),
    ));
  }
  sec.appendChild(dist);

  // Preferred-foot split (full data only).
  const feet = squad.filter(p => p.foot);
  if (feet.length) {
    const r = feet.filter(p => /right/i.test(p.foot)).length;
    const l = feet.filter(p => /left/i.test(p.foot)).length;
    const b = feet.length - r - l;
    const foot = el('div', { class: 'td-foot' });
    const seg = (n, color, lbl) => n ? el('div', { class: 'seg' },
      el('span', { class: 'dot', style: `background:${color}` }), `${lbl} ${n}`) : null;
    for (const node of [seg(r, '#f5c712', 'Right'), seg(l, '#1ea85a', 'Left'), seg(b, '#9bbaa2', 'Both')]) {
      if (node) foot.appendChild(node);
    }
    sec.appendChild(foot);
  }
  return sec;
}

// "Where they play" — clubs & leagues that supply this squad. Full data only.
function buildWhereTheyPlay(team, playersSample) {
  const squad = teamSquad(team, playersSample, null);
  const based = squad.filter(p => p.club);
  if (based.length < 3) return null;
  const clubCount = new Map();
  const ccCount = new Map();
  for (const p of based) {
    clubCount.set(p.club, (clubCount.get(p.club) || 0) + 1);
    if (p.clubCountry) ccCount.set(p.clubCountry, (ccCount.get(p.clubCountry) || 0) + 1);
  }
  const topClubs = [...clubCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topCC = [...ccCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (topClubs.length < 2 && topCC.length < 2) return null;
  const maxClub = Math.max(...topClubs.map(c => c[1]), 1);
  const maxCC = Math.max(...topCC.map(c => c[1]), 1);

  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, 'Where they play', el('span', { class: 'note' }, `${new Set(based.map(p => p.club)).size} clubs`)));
  const grid = el('div', { class: 'td-wtp-grid' });

  const clubsBox = el('div', { class: 'td-wtp' });
  clubsBox.appendChild(el('h4', {}, 'Clubs'));
  for (const [club, n] of topClubs) {
    clubsBox.appendChild(el('div', { class: 'td-wtp-row' },
      el('div', { class: 'lab' }, el('span', {}, club)),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(n / maxClub * 100).toFixed(1)}%` })),
      el('div', { class: 'n' }, String(n))));
  }
  grid.appendChild(clubsBox);

  if (topCC.length >= 2) {
    const ccBox = el('div', { class: 'td-wtp' });
    ccBox.appendChild(el('h4', {}, 'Leagues'));
    for (const [cc, n] of topCC) {
      const fl = flagSrc(cc);
      ccBox.appendChild(el('div', { class: 'td-wtp-row' },
        el('div', { class: 'lab' },
          fl ? el('div', { class: 'fl', style: `background-image:url(${fl})` }) : null,
          el('span', {}, cc)),
        el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(n / maxCC * 100).toFixed(1)}%` })),
        el('div', { class: 'n' }, String(n))));
    }
    grid.appendChild(ccBox);
  }
  sec.appendChild(grid);
  return sec;
}

function buildRankings(team, elo, fifa) {
  if (!elo && !fifa) return null;
  const eloEntry = elo && elo[team.fifa_code];
  const fifaEntry = fifa && fifa[team.fifa_code];
  if (!eloEntry && !fifaEntry) return null;
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, 'Strength · predictive vs official'));
  const grid = el('div', { class: 'td-rank-grid' });
  if (eloEntry) {
    const rank = eloEntry.current_rank ?? '—';
    const rating = eloEntry.current_rating;
    const peak = eloEntry.peak_rating;
    const peakYear = eloEntry.peak_rating_year;
    const bestRank = eloEntry.best_rank;
    grid.appendChild(el('div', { class: 'td-rank-card' },
      el('div', { class: 'src' }, 'Elo · predictive'),
      el('div', { class: 'num' }, '#' + rank),
      rating ? el('div', { class: 'peak' }, `Rating ${Math.round(rating)}`) : null,
      peak ? el('div', { class: 'peak' }, `Peak ${Math.round(peak)}${peakYear ? ' · ' + peakYear : ''}`) : null,
      bestRank ? el('div', { class: 'peak' }, `Best rank #${bestRank}`) : null,
    ));
  }
  if (fifaEntry) {
    const liveRank = fifaEntry.live_rank;
    const officialRank = fifaEntry.official_rank;
    const movement = fifaEntry.ranking_movement || 0;
    const livePts = fifaEntry.live_points;
    const primary = liveRank ?? officialRank ?? '—';
    grid.appendChild(el('div', { class: 'td-rank-card' },
      el('div', { class: 'src' }, 'FIFA · official'),
      el('div', { class: 'num' }, '#' + primary),
      livePts ? el('div', { class: 'peak' }, `${Math.round(livePts)} pts live`) : null,
      officialRank && liveRank && officialRank !== liveRank
        ? el('div', { class: 'peak', style: movement > 0 ? 'color:#1ea85a' : (movement < 0 ? 'color:#c0444f' : '') }, `${movement > 0 ? '▲' : (movement < 0 ? '▼' : '·')} from #${officialRank}`)
        : (officialRank ? el('div', { class: 'peak' }, `Official #${officialRank}`) : null),
    ));
  }
  sec.appendChild(grid);
  return sec;
}

function buildCountryPanel(country) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, 'Country profile'));
  const grid = el('div', { class: 'td-country-grid' });
  if (country.capital) grid.appendChild(field('Capital', Array.isArray(country.capital) ? country.capital[0] : country.capital));
  if (country.population) grid.appendChild(field('Population', formatPop(country.population), true));
  const langs = country.languages;
  if (langs) {
    const text = Array.isArray(langs) ? langs.join(', ') : (typeof langs === 'object' ? Object.values(langs).join(', ') : String(langs));
    grid.appendChild(field('Languages', text));
  }
  const currencies = country.currencies;
  if (currencies) {
    const text = Array.isArray(currencies)
      ? currencies.map(c => typeof c === 'object' ? (c.name || c.code) : c).join(', ')
      : (typeof currencies === 'object' ? Object.entries(currencies).map(([k, v]) => v.name ? `${v.name} (${k})` : k).join(', ') : String(currencies));
    grid.appendChild(field('Currency', text));
  }
  if (country.region) grid.appendChild(field('Region', country.region + (country.subregion ? ' · ' + country.subregion : '')));
  if (country.area_km2) grid.appendChild(field('Area', Math.round(country.area_km2).toLocaleString() + ' km²'));
  if (country.timezone_capital || country.capital_coords) grid.appendChild(field('Capital tz', country.timezone_capital || (country.capital_coords && country.capital_coords.tz)));
  sec.appendChild(grid);
  return sec;
}
function field(k, v, big) {
  return el('div', { class: 'td-country-cell' },
    el('div', { class: 'k' }, k),
    el('div', { class: 'v' + (big ? ' big' : '') }, v),
  );
}
function formatPop(n) {
  if (!n) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return String(n);
}

function buildSportsdbCard(t) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, 'Federation'));
  const wrap = el('div', { style: 'display:flex;gap:18px;align-items:center;flex-wrap:wrap' });
  if (t.badge) {
    wrap.appendChild(el('img', { src: t.badge, alt: '', style: 'height:80px;width:80px;object-fit:contain;background:#0c1310;border:1px solid #16201a;border-radius:12px;padding:8px;flex:none' }));
  }
  const info = el('div', { style: 'flex:1;min-width:200px' });
  if (t.stadium) info.appendChild(el('div', { style: 'font-family:Archivo;font-weight:700;font-size:13px;color:#dfe6df' },
    'Home: ', el('span', { style: 'color:#9bbaa2' }, t.stadium + (t.location ? ` · ${t.location}` : ''))));
  const socials = el('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' });
  const links = [
    ['Website', t.website],
    ['Twitter', t.twitter && `https://twitter.com/${t.twitter}`],
    ['Instagram', t.instagram && `https://instagram.com/${t.instagram}`],
    ['Facebook', t.facebook && `https://facebook.com/${t.facebook}`],
    ['YouTube', t.youtube],
    ['News (RSS)', t.rss],
  ].filter(([, u]) => u);
  for (const [label, url] of links) {
    const ext = url.startsWith('http') ? url : `https://${url}`;
    socials.appendChild(el('a', { href: ext, target: '_blank', rel: 'noopener',
      style: 'font-family:Archivo;font-weight:700;font-size:11px;color:#9bbaa2;border:1px solid #2a3a2a;padding:6px 10px;border-radius:6px;text-decoration:none' }, label + ' ↗'));
  }
  if (socials.children.length) info.appendChild(socials);
  wrap.appendChild(info);
  sec.appendChild(wrap);
  if (t.stadium_thumb) {
    sec.appendChild(el('img', { src: t.stadium_thumb, alt: '', loading: 'lazy',
      style: 'width:100%;height:180px;object-fit:cover;border-radius:12px;margin-top:14px' }));
  }
  return sec;
}

function buildStandings(rows, team, letter) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, `Group ${letter} standings`));
  sec.appendChild(el('div', { class: 'td-stand-head' },
    el('span', {}, '#'), el('span', {}, 'Team'),
    el('span', { style:'text-align:center' }, 'P'),
    el('span', { style:'text-align:center' }, 'GD'),
    el('span', { style:'text-align:right' }, 'PTS'),
  ));
  rows.forEach((r, i) => {
    const teamName = r.team || r.name;
    const isMe = (r.code && r.code === team.fifa_code) || teamName === team.name || teamName === team.name_normalised;
    const qual = i < 2;
    const t = (r.code && data.teamSync && data.teamSync(r.code)) || (data.teamSync && data.teamSync(teamName));
    const href = t ? `/wc/team/${t.fifa_code}` : '#';
    const row = el('a', { class: `td-stand-row${isMe ? ' me' : ''}${qual && !isMe ? ' q' : ''}`, href, 'data-team-code': t ? t.fifa_code : '' });
    row.appendChild(el('span', { class: 'pos' }, String(i + 1)));
    const nm = el('div', { class: 'nm' });
    const fl = el('span', { class: 'flag' });
    if (t && flagSrc(t.fifa_code)) fl.style.backgroundImage = `url(${flagSrc(t.fifa_code)})`;
    nm.appendChild(fl);
    nm.appendChild(el('span', {}, teamName));
    row.appendChild(nm);
    row.appendChild(el('span', { class: 'c' }, String(r.played ?? 0)));
    const gd = (r.gd != null) ? r.gd : ((r.gf ?? 0) - (r.ga ?? 0));
    row.appendChild(el('span', { class: 'c' }, gd > 0 ? `+${gd}` : String(gd)));
    row.appendChild(el('span', { class: 'p' }, String(r.points ?? 0)));
    sec.appendChild(row);
  });
  sec.appendChild(el('div', { class: 'td-stand-key' },
    el('span', { class: 's' }),
    el('span', {}, 'Qualifies (top 2)'),
  ));
  return sec;
}

function buildFixtures(team, matches) {
  if (!matches) return null;
  const arr = Array.isArray(matches) ? matches : (matches.data || []);
  if (!Array.isArray(arr) || !arr.length) return null;
  arr.sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc));
  const sec = el('div', { class: 'td-section' });
  const completed = arr.filter(x => x.status === 'finished');
  const formCol = el('div', { class: 'td-form-chips' });
  for (const m of completed.slice(-5)) {
    const homeIsUs = (m.home_team === team.name || m.home_team === team.name_normalised);
    const us = homeIsUs ? m.home_score : m.away_score;
    const them = homeIsUs ? m.away_score : m.home_score;
    const r = us > them ? 'W' : (us < them ? 'L' : 'D');
    formCol.appendChild(el('span', { class: 'td-form-chip td-form-' + r }, r));
  }
  if (!completed.length) formCol.appendChild(el('span', { class: 'td-form-chip td-form-N' }, '—'));
  const head = el('div', { class: 'td-fix-head' }, el('h3', { style: 'margin:0' }, 'Fixtures'), formCol);
  sec.appendChild(head);
  for (const m of arr) {
    const homeIsUs = (m.home_team === team.name || m.home_team === team.name_normalised);
    const oppName = homeIsUs ? m.away_team : m.home_team;
    const oppT = data.teamSync && data.teamSync(oppName);
    const kickoff = new Date(m.kickoff_utc);
    const row = el('a', { class: 'td-fix-row', href: `/wc/game/${m.id}`, 'data-game-id': m.id });
    row.appendChild(el('div', { class: 'when' },
      el('div', { class: 'd' }, dayLabel(kickoff).replace(/^\w+, /, '')),
      el('div', { class: 't' }, timeLabel(kickoff) + ' ET'),
    ));
    row.appendChild(el('span', { class: 'vs' }, 'vs'));
    const fl = el('div', { class: 'opp-flag' });
    if (oppT && flagSrc(oppT.fifa_code)) fl.style.backgroundImage = `url(${flagSrc(oppT.fifa_code)})`;
    row.appendChild(fl);
    const nameNode = el('div', { class: 'opp-name' }, oppName || (homeIsUs ? m.away_team_source : m.home_team_source) || 'TBD');
    if (m.status === 'finished') {
      const us = homeIsUs ? m.home_score : m.away_score;
      const them = homeIsUs ? m.away_score : m.home_score;
      const cls = us > them ? '' : (us < them ? 'loss' : 'draw');
      nameNode.appendChild(el('span', { class: 'res ' + cls }, `${us}–${them}`));
    } else if (m.status === 'live') {
      const us = homeIsUs ? m.home_score : m.away_score;
      const them = homeIsUs ? m.away_score : m.home_score;
      nameNode.appendChild(el('span', { class: 'res', style: 'color:#ff6a6f' }, `${us ?? 0}–${them ?? 0} LIVE`));
    }
    row.appendChild(nameNode);
    row.appendChild(el('span', { class: 'ven' }, m.stadium));
    sec.appendChild(row);
  }
  return sec;
}

function buildScorers(team, scorers, goalsFallback) {
  const sec = el('div', { class: 'td-section' });
  const h = el('h3', {});
  h.appendChild(el('span', {}, 'Tournament scorers'));
  const list = scorers && scorers.by_team ? (scorers.by_team[team.fifa_code] || []) : null;
  const totalGoals = list ? list.reduce((s, r) => s + (r.goals || 0), 0) : goalsFallback;
  h.appendChild(el('span', { class: 'note' }, `${totalGoals} goal${totalGoals === 1 ? '' : 's'} scored`));
  sec.appendChild(h);

  if (list && list.length) {
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:1px;background:#141f14;border-radius:12px;overflow:hidden' });
    list.slice(0, 12).forEach((r) => {
      const row = el('div', { style: 'display:flex;align-items:center;gap:10px;background:#0c1310;padding:11px 14px' });
      row.appendChild(el('span', { style: 'font-family:Anton;font-size:20px;color:#f5c712;min-width:26px;text-align:center' }, String(r.goals)));
      const meta = el('div', { style: 'flex:1;min-width:0' });
      meta.appendChild(el('div', { class: 'td-sc-name', style: 'font-family:Archivo;font-weight:800;font-size:14px;color:#eef2ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' },
        playerLink(r.player, r.tmId)));
      const sub = r.penalties ? `${r.goals} goal${r.goals === 1 ? '' : 's'} · ${r.penalties} pen` : `${r.matches ? r.matches.length : r.goals} appearance${(r.matches ? r.matches.length : r.goals) === 1 ? '' : 's'}`;
      meta.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:11px;color:#4a5a4a' }, sub));
      row.appendChild(meta);
      sec.appendChild(wrap);
      wrap.appendChild(row);
    });
    return sec;
  }

  sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#4a5a4a;line-height:1.45' },
    totalGoals ? `${totalGoals} goals scored so far — individual breakdown updates as match events are recorded.`
               : 'Goalscorer breakdown populates from live match events as the tournament progresses.'));
  return sec;
}

function buildAllTimeRecord(r) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, 'All-time international record'));
  const totals = el('div', { style: 'display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#141f14;border-radius:12px;overflow:hidden;margin-bottom:12px' });
  const tcell = (v, lbl, color) => el('div', { style: `background:#0c1310;padding:13px 8px;text-align:center` },
    el('div', { style: `font-family:Anton;font-size:24px;color:${color || '#f4f2ea'}` }, String(v)),
    el('div', { style: 'font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.08em;color:#3a5a3a;margin-top:3px;text-transform:uppercase' }, lbl),
  );
  totals.appendChild(tcell(r.played ?? '—', 'PLAYED'));
  totals.appendChild(tcell(r.wins ?? '—', 'WON', '#1ea85a'));
  totals.appendChild(tcell(r.draws ?? '—', 'DREW', '#c9a227'));
  totals.appendChild(tcell(r.losses ?? '—', 'LOST', '#c0444f'));
  totals.appendChild(tcell((r.win_pct != null ? r.win_pct.toFixed(1) + '%' : '—'), 'WIN %', '#f5c712'));
  sec.appendChild(totals);
  const meta = el('div', { style: 'display:flex;flex-wrap:wrap;gap:18px;font-family:Archivo;font-weight:600;font-size:11px;color:#5a7a5a' });
  if (r.gf != null && r.ga != null) meta.appendChild(el('span', {}, `Goals: ${r.gf}–${r.ga} (GD ${r.gd >= 0 ? '+' : ''}${r.gd})`));
  if (r.first) meta.appendChild(el('span', {}, `First international: ${r.first}`));
  if (r.last) meta.appendChild(el('span', {}, `Last match: ${r.last}`));
  if (meta.children.length) sec.appendChild(meta);
  return sec;
}

function buildWcHistory(team, history) {
  if (!history || !Array.isArray(history)) return null;
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(el('h3', {}, 'World Cup pedigree'));
  const grid = el('div', { class: 'td-wc-hist-grid' });
  for (const yearData of history) {
    if (!yearData) continue;
    const year = yearData.year || yearData.season || (yearData.name && yearData.name.match(/\d{4}/)?.[0]);
    if (!year) continue;
    const outcome = extractTeamOutcome(yearData, team);
    if (!outcome) continue;
    grid.appendChild(el('div', { class: 'td-wc-hist-card' },
      el('div', { class: 'year' }, String(year)),
      el('div', { class: 'out' }, outcome.label),
      outcome.played != null ? el('div', { class: 'pld' }, `${outcome.played} played · ${outcome.gf}-${outcome.ga}`) : null,
    ));
  }
  if (!grid.children.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a' }, 'No World Cup appearances in 2010–2022.'));
    return sec;
  }
  sec.appendChild(grid);
  return sec;
}

function extractTeamOutcome(yearData, team) {
  const matches = yearData.matches || yearData.fixtures || [];
  if (!Array.isArray(matches)) return null;
  const ours = matches.filter(m =>
    (m.team1 === team.name || m.team2 === team.name || m.home === team.name || m.away === team.name ||
     m.team1 === team.name_normalised || m.team2 === team.name_normalised ||
     m.home_team === team.name || m.away_team === team.name)
  );
  if (!ours.length) return null;
  let w = 0, d = 0, l = 0, gf = 0, ga = 0, furthestRound = null;
  for (const m of ours) {
    const isHome = (m.team1 === team.name || m.team1 === team.name_normalised || m.home === team.name || m.home_team === team.name);
    const us = (m.score && (isHome ? m.score.ft?.[0] : m.score.ft?.[1])) ?? (isHome ? m.home_score : m.away_score);
    const them = (m.score && (isHome ? m.score.ft?.[1] : m.score.ft?.[0])) ?? (isHome ? m.away_score : m.home_score);
    if (us != null && them != null) {
      if (us > them) w++;
      else if (us < them) l++;
      else d++;
      gf += us; ga += them;
    }
    if (m.round) furthestRound = m.round;
  }
  const total = w + d + l;
  return {
    label: furthestRound ? labelForRound(furthestRound, w, d, l) : `${w}-${d}-${l} group`,
    played: total, gf, ga,
  };
}
function labelForRound(r, w, d, l) {
  const lr = String(r).toLowerCase();
  if (lr.includes('final') && !lr.includes('quarter') && !lr.includes('semi')) return w > 0 ? 'Champions' : 'Runners-up';
  if (lr.includes('third')) return 'Third place';
  if (lr.includes('semi')) return 'Semifinal';
  if (lr.includes('quarter')) return 'Quarterfinal';
  if (lr.includes('round of 16') || lr.includes('r16')) return 'Round of 16';
  if (lr.includes('round of 32') || lr.includes('r32')) return 'Round of 32';
  return `Group · ${w}-${d}-${l}`;
}

function buildSquad(team, playersSample, squads2026, ctx) {
  const squad = teamSquad(team, playersSample, squads2026);
  const sec = el('div', { class: 'td-section' });
  const head = el('h3', {});
  head.appendChild(el('span', {}, 'Full squad'));
  head.appendChild(el('span', { class: 'note' }, `${squad.length} players`));
  sec.appendChild(head);
  if (!squad.length) {
    sec.appendChild(el('div', { style: 'font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a' },
      'Roster will populate from the live wc2026api.com /teams response or the 2026 enrichment squads.'));
    return sec;
  }
  const SORTS = [{id:'value',label:'Value'},{id:'age',label:'Age'},{id:'no',label:'Number'}];
  const pill = el('div', { class: 'td-sort-pill' });
  for (const s of SORTS) {
    const b = el('button', { class: ctx.sort === s.id ? 'on' : '',
      onclick: () => { ctx.sort = s.id; render(ctx); } }, s.label);
    pill.appendChild(b);
  }
  sec.appendChild(el('div', { class: 'td-squad-controls' },
    el('span', { style: 'font-family:Archivo;font-weight:700;font-size:9px;letter-spacing:0.08em;color:#5a7a5a;text-transform:uppercase' }, 'Sort'),
    pill,
  ));
  const POSLABEL = { GK:'Goalkeepers', DEF:'Defenders', MID:'Midfielders', FWD:'Forwards' };
  const byPos = { GK:[], DEF:[], MID:[], FWD:[] };
  for (const p of squad) (byPos[p.position] || byPos.MID).push(p);
  const cmp = {
    value: (a, b) => (b.value || 0) - (a.value || 0),
    age: (a, b) => (b.age || 0) - (a.age || 0),
    no: (a, b) => (a.shirt || 99) - (b.shirt || 99),
  }[ctx.sort] || ((a, b) => (b.value || 0) - (a.value || 0));
  const mvpValue = Math.max(0, ...squad.map(p => p.value || 0));
  for (const k of ['GK','DEF','MID','FWD']) {
    if (!byPos[k].length) continue;
    const section = el('div', { class: 'td-squad-section' });
    section.appendChild(el('div', { class: 'ttl' },
      el('span', {}, POSLABEL[k]),
      el('hr'),
      el('div', { class: 'n' }, String(byPos[k].length)),
    ));
    const grid = el('div', { class: 'td-squad-grid' });
    for (const p of byPos[k].slice().sort(cmp)) {
      // Use tmId when available, else fall back to URL-encoded name so the
      // popup/page can still surface what little we know from 2026.squads.json.
      const playerId = p.tmId || `name:${p.name}`;
      const card = el('a', {
        class: 'td-squad-card' + (p.value === mvpValue && mvpValue > 0 ? ' mvp' : ''),
        href: `/wc/player/${encodeURIComponent(playerId)}`,
      });
      card.appendChild(el('div', { class: 'no' }, p.shirt != null ? String(p.shirt) : '—'));
      const face = el('div', { class: 'face' });
      if (p.photo) face.style.backgroundImage = `url(${p.photo})`;
      else face.appendChild(el('span', { class: 'ini' }, initials(p.name)));
      card.appendChild(face);
      // Flag contracts expiring within the next year (free-agent watch).
      const expiringSoon = p.contractUntil && (new Date(p.contractUntil) - Date.now()) < 365 * 864e5 && new Date(p.contractUntil) > Date.now();
      const sub = el('div', { class: 'sub' });
      sub.appendChild(document.createTextNode([p.club, p.age && `${p.age}y`, p.caps != null && `${p.caps} caps`].filter(Boolean).join(' · ')));
      if (expiringSoon) sub.appendChild(el('span', { class: 'exp' }, ` · exp ${String(p.contractUntil).slice(0, 4)}`));
      card.appendChild(el('div', { class: 'info' },
        el('div', { class: 'name' }, p.name),
        sub,
      ));
      card.appendChild(el('div', { class: 'val' }, eur(p.value)));
      grid.appendChild(card);
    }
    section.appendChild(grid);
    sec.appendChild(section);
  }
  return sec;
}
