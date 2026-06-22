// Shared renderer for the global Players hub (/wc/players).
//
// This is the home for the ~1,250-player Transfermarkt dataset that previously
// only surfaced one player at a time on individual dossiers. It loads the full
// players.json once and turns it into tournament-wide leaderboards, a value XI,
// "where the talent plays" breakdowns, superlatives, and a searchable index of
// every player. All joins go through teams-48 (FIFA code) so flags resolve.

import * as data from './data.js';
import { flagSrc } from './flags.js';
import { eur, initials } from './format.js';

export const playersCss = `
  .ph-root{position:relative;container-type:inline-size}

  /* ── Hero ─────────────────────────────────────────── */
  .ph-hero{position:relative;overflow:hidden;border-radius:18px;padding:clamp(20px,4cqi,52px);background:radial-gradient(130% 130% at 88% 0%,rgba(245,199,18,0.14),transparent 60%);animation:wc-reveal-up .6s cubic-bezier(.34,1.56,.64,1) both}
  .ph-hero-word{position:absolute;right:-1%;top:-22%;font-family:Anton;font-size:clamp(120px,40cqi,440px);color:rgba(245,199,18,0.06);line-height:1;pointer-events:none;user-select:none;z-index:0}
  .ph-hero-inner{position:relative;z-index:1}
  .ph-kicker{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:clamp(10px,1.5cqi,14px);letter-spacing:0.2em;text-transform:uppercase;color:#f5c712}
  .ph-title{font-family:Anton;font-size:clamp(44px,13cqi,150px);line-height:0.82;text-transform:uppercase;color:#f4f2ea;margin-top:8px}
  .ph-title .y{color:#f5c712}
  .ph-sub{font-family:Archivo;font-weight:600;font-size:clamp(13px,1.7cqi,17px);color:#9bbaa2;margin-top:14px;max-width:640px;line-height:1.5}

  /* ── Aggregate strip ──────────────────────────────── */
  .ph-aggs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:#141f14;border:1px solid #18241a;border-radius:14px;overflow:hidden;margin-top:16px}
  .ph-agg{background:#0e1610;padding:16px 18px}
  .ph-agg .v{font-family:Anton;font-size:clamp(24px,3.4cqi,38px);color:#f5c712;line-height:0.95}
  .ph-agg .v.pale{color:#f4f2ea}
  .ph-agg .k{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#5a7a5a;margin-top:7px}

  /* ── Section frame ────────────────────────────────── */
  .ph-section{margin-top:26px;animation:wc-reveal-up .55s ease both}
  .ph-sec-head{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
  .ph-sec-head h2{font-family:Anton;font-size:clamp(20px,3cqi,30px);text-transform:uppercase;letter-spacing:0.01em;color:#f4f2ea}
  .ph-sec-head .desc{font-family:Archivo;font-weight:600;font-size:12px;color:#5a7a5a;margin-left:auto;text-align:right}

  /* ── Most valuable (podium grid) ──────────────────── */
  .ph-mv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px}
  .ph-mv{position:relative;display:block;background:#0e1610;border:1px solid #18241a;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .22s,border-color .22s,box-shadow .22s}
  .ph-mv:hover{transform:translateY(-4px);border-color:rgba(245,199,18,0.4);box-shadow:0 22px 44px -26px rgba(0,0,0,0.9)}
  .ph-mv .pic{position:relative;aspect-ratio:1/1;background:linear-gradient(165deg,#1a2218,#0c1310);background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center}
  .ph-mv .pic .ini{font-family:Anton;font-size:42px;color:#3f5840}
  .ph-mv .rk{position:absolute;top:9px;left:10px;font-family:Anton;font-size:26px;color:#f5c712;line-height:0.8;text-shadow:0 2px 8px rgba(0,0,0,0.7)}
  .ph-mv .fl{position:absolute;top:11px;right:10px;width:26px;height:19px;border-radius:3px;background-size:cover;background-position:center;box-shadow:0 2px 6px rgba(0,0,0,0.6)}
  .ph-mv .pic::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(8,12,10,0.96) 4%,transparent 46%)}
  .ph-mv .cap{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;z-index:2}
  .ph-mv .nm{font-family:Archivo;font-weight:800;font-size:14px;color:#f4f2ea;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-mv .cl{font-family:Archivo;font-weight:600;font-size:10px;color:#9bbaa2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-mv .vl{font-family:JetBrains Mono,monospace;font-weight:700;font-size:15px;color:#f5c712;margin-top:5px}

  /* ── Value XI pitch ───────────────────────────────── */
  .ph-xi-wrap{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px}
  @container (max-width:680px){.ph-xi-wrap{grid-template-columns:1fr}}
  .ph-pitch{position:relative;aspect-ratio:3/4;border-radius:16px;background:linear-gradient(170deg,#10341f,#0b2417 70%);border:1px solid #1c4a2e;overflow:hidden}
  .ph-pitch .ln{position:absolute;border:1px solid rgba(245,199,18,0.12)}
  .ph-pitch .mid{left:0;right:0;top:50%;border-width:1px 0 0 0}
  .ph-pitch .circ{left:50%;top:50%;width:30%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%}
  .ph-pitch .boxT{left:26%;right:26%;top:0;height:14%;border-top:none}
  .ph-pitch .boxB{left:26%;right:26%;bottom:0;height:14%;border-bottom:none}
  .ph-xi-spot{position:absolute;transform:translate(-50%,-50%);width:20%;max-width:96px;text-align:center;text-decoration:none}
  .ph-xi-spot .ph-xi-face{width:clamp(40px,11cqi,62px);height:clamp(40px,11cqi,62px);margin:0 auto;border-radius:50%;background:#0c1310;border:2px solid #f5c712;background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px -8px rgba(0,0,0,0.9)}
  .ph-xi-spot .ph-xi-face .ini{font-family:Anton;font-size:16px;color:#7e9a7e}
  .ph-xi-spot .nm{font-family:Archivo;font-weight:800;font-size:10px;color:#f4f2ea;margin-top:5px;line-height:1.05;text-shadow:0 1px 4px rgba(0,0,0,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-xi-spot .vl{font-family:JetBrains Mono,monospace;font-weight:700;font-size:9px;color:#f5c712}
  .ph-xi-side{display:flex;flex-direction:column;gap:8px;justify-content:center}
  .ph-xi-note{font-family:Archivo;font-weight:600;font-size:12px;color:#9bbaa2;line-height:1.5}
  .ph-xi-tot{background:#0e1610;border:1px solid #18241a;border-radius:12px;padding:14px 16px}
  .ph-xi-tot .v{font-family:JetBrains Mono,monospace;font-weight:700;font-size:30px;color:#f5c712;line-height:0.9}
  .ph-xi-tot .k{font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#5a7a5a;margin-top:7px}
  .ph-xi-form{display:inline-flex;gap:6px;margin-top:2px}
  .ph-xi-form span{font-family:Anton;font-size:18px;color:#f4f2ea;background:#0c1310;border:1px solid #20301f;border-radius:7px;padding:3px 10px}

  /* ── By position columns ──────────────────────────── */
  .ph-pos-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
  .ph-pos-col{background:#0e1610;border:1px solid #18241a;border-radius:14px;padding:14px 14px 8px}
  .ph-pos-col h3{font-family:Archivo;font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#f5c712;margin-bottom:10px}
  .ph-pl-row{display:flex;align-items:center;gap:10px;padding:7px 4px;border-radius:8px;text-decoration:none;color:inherit;transition:background .15s}
  .ph-pl-row:hover{background:rgba(255,255,255,0.03)}
  .ph-pl-row .rk{font-family:Anton;font-size:14px;color:#3a5a3a;min-width:16px;text-align:center}
  .ph-pl-row .face{width:30px;height:30px;flex:none;border-radius:50%;background:#0c1310;border:1px solid #20301f;background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center}
  .ph-pl-row .face .ini{font-family:Anton;font-size:11px;color:#7e9a7e}
  .ph-pl-row .info{flex:1;min-width:0}
  .ph-pl-row .nm{font-family:Archivo;font-weight:700;font-size:12px;color:#eef2ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-pl-row .sub{font-family:Archivo;font-weight:600;font-size:10px;color:#5a7a5a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-pl-row .fl{width:18px;height:13px;flex:none;border-radius:2px;background-size:cover;background-position:center}
  .ph-pl-row .vl{font-family:JetBrains Mono,monospace;font-weight:700;font-size:11px;color:#f5c712;min-width:44px;text-align:right}

  /* ── Talent map (bars) ────────────────────────────── */
  .ph-bars-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
  .ph-bars{background:#0e1610;border:1px solid #18241a;border-radius:14px;padding:16px 18px}
  .ph-bars h3{font-family:Archivo;font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#f5c712;margin-bottom:14px}
  .ph-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:9px}
  .ph-bar-row .lab{display:flex;align-items:center;gap:7px;min-width:118px}
  .ph-bar-row .lab .fl{width:20px;height:14px;flex:none;border-radius:2px;background-size:cover;background-position:center}
  .ph-bar-row .lab span{font-family:Archivo;font-weight:700;font-size:11px;color:#cfd6cf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-bar-row .track{flex:1;height:9px;background:#141f14;border-radius:5px;overflow:hidden}
  .ph-bar-row .fill{height:100%;background:linear-gradient(90deg,#c9a227,#f5c712);border-radius:5px;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .ph-bar-row .n{font-family:Anton;font-size:14px;color:#f5c712;min-width:26px;text-align:right}

  /* ── Superlatives ─────────────────────────────────── */
  .ph-super-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}
  .ph-super{display:block;background:#0e1610;border:1px solid #18241a;border-radius:14px;padding:14px 15px;text-decoration:none;color:inherit;transition:transform .2s,border-color .2s}
  .ph-super:hover{transform:translateY(-3px);border-color:rgba(245,199,18,0.32)}
  .ph-super .cat{font-family:Archivo;font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#5a7a5a}
  .ph-super .top{display:flex;align-items:center;gap:11px;margin-top:11px}
  .ph-super .face{width:42px;height:42px;flex:none;border-radius:50%;background:#0c1310;border:1px solid #20301f;background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center}
  .ph-super .face .ini{font-family:Anton;font-size:15px;color:#7e9a7e}
  .ph-super .nm{font-family:Archivo;font-weight:800;font-size:14px;color:#f4f2ea;line-height:1.1}
  .ph-super .meta{font-family:Archivo;font-weight:600;font-size:10px;color:#9bbaa2;margin-top:2px}
  .ph-super .big{font-family:Anton;font-size:30px;color:#f5c712;margin-top:10px;line-height:0.9}
  .ph-super .big small{font-family:Archivo;font-weight:700;font-size:11px;color:#5a7a5a;letter-spacing:0.04em}

  /* ── Index (search/filter/sort + grid) ───────────── */
  .ph-idx{background:#0e1610;border:1px solid #18241a;border-radius:16px;padding:16px 18px;margin-top:14px}
  .ph-idx-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
  .ph-search{flex:1;min-width:180px;display:flex;align-items:center;gap:8px;background:#0c1310;border:1px solid #1c2c1c;border-radius:9px;padding:9px 13px}
  .ph-search svg{flex:none;color:#5a7a5a}
  .ph-search input{flex:1;background:none;border:none;outline:none;font-family:Archivo;font-weight:600;font-size:13px;color:#f4f2ea}
  .ph-search input::placeholder{color:#4a5a4a}
  .ph-seg{display:flex;gap:3px;background:#0c1310;border:1px solid #1c2c1c;border-radius:9px;padding:3px}
  .ph-seg button{cursor:pointer;border:none;font-family:Archivo;font-weight:800;font-size:10px;letter-spacing:0.04em;text-transform:uppercase;padding:6px 11px;border-radius:6px;background:transparent;color:#9bbaa2}
  .ph-seg button.on{background:#f5c712;color:#0a0e0c}
  .ph-select{position:relative}
  .ph-select select{appearance:none;cursor:pointer;background:#0c1310;border:1px solid #1c2c1c;border-radius:9px;padding:9px 30px 9px 13px;font-family:Archivo;font-weight:700;font-size:12px;color:#cfd6cf;outline:none;max-width:200px}
  .ph-select::after{content:'▾';position:absolute;right:11px;top:50%;transform:translateY(-50%);color:#5a7a5a;pointer-events:none;font-size:11px}
  .ph-idx-count{font-family:Archivo;font-weight:700;font-size:11px;color:#5a7a5a;margin-left:auto}

  .ph-idx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:8px}
  .ph-idx-card{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;background:#0c1310;border:1px solid #16201a;text-decoration:none;color:inherit;transition:transform .18s,border-color .18s}
  .ph-idx-card:hover{transform:translateY(-2px);border-color:rgba(245,199,18,0.28)}
  .ph-idx-card .face{width:42px;height:42px;flex:none;border-radius:50%;background:#111a13;border:1px solid #20301f;background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center;position:relative}
  .ph-idx-card .face .ini{font-family:Anton;font-size:14px;color:#6f8a70}
  .ph-idx-card .face .fl{position:absolute;bottom:-2px;right:-3px;width:18px;height:13px;border-radius:2px;background-size:cover;background-position:center;box-shadow:0 0 0 2px #0c1310}
  .ph-idx-card .info{flex:1;min-width:0}
  .ph-idx-card .nm{font-family:Archivo;font-weight:800;font-size:13px;color:#f4f2ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-idx-card .sub{font-family:Archivo;font-weight:600;font-size:10px;color:#5a7a5a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-idx-card .pos{font-family:Archivo;font-weight:900;font-size:8px;letter-spacing:0.08em;color:#6f8a70;background:rgba(245,199,18,0.06);border:1px solid rgba(245,199,18,0.14);padding:2px 5px;border-radius:4px}
  .ph-idx-card .vl{font-family:JetBrains Mono,monospace;font-weight:700;font-size:12px;color:#f5c712;text-align:right;min-width:46px}
  .ph-idx-card .vl small{display:block;font-family:Archivo;font-weight:700;font-size:8px;color:#5a7a5a;letter-spacing:0.04em}
  .ph-empty{padding:36px 18px;text-align:center;font-family:Archivo;font-weight:600;font-size:13px;color:#5a7a5a}
  .ph-more{display:block;width:100%;margin-top:14px;cursor:pointer;background:#0c1310;border:1px solid #20301f;border-radius:10px;padding:12px;font-family:Archivo;font-weight:800;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#cfd6cf}
  .ph-more:hover{border-color:#f5c712;color:#f5c712}

  .ph-loading{padding:60px 20px;text-align:center;font-family:Archivo;font-weight:700;font-size:14px;color:#5a6a5a}
  .ph-loading::before{content:'';display:inline-block;width:16px;height:16px;border:2px solid #2a3a2a;border-top-color:#f5c712;border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:11px}
  .ph-foot{margin-top:30px;padding-top:18px;border-top:1px solid #18241a;font-family:Archivo;font-weight:600;font-size:11px;color:#3f5840;line-height:1.6}
`;

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

const POS_FROM_GROUP = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' };
const POS_FULL = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };

// Resolve a player's photo: Transfermarkt portrait first, then SportsDB thumb.
function photoFor(p, thumbs) {
  if (p && p.tmPhotoUrl) return p.tmPhotoUrl;
  const t = thumbs && thumbs.players ? thumbs.players[p.name] : null;
  return (t && (t.cutout || t.thumb)) || null;
}

function faceStyle(url) {
  return url ? `background-image:url(${url})` : '';
}

function playerHref(p) {
  return `/wc/player/${encodeURIComponent(p.tmId || 'name:' + p.name)}`;
}

function bigEur(v) {
  if (v == null) return '—';
  if (v >= 1_000_000_000) return `€${(v / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')}b`;
  if (v >= 1_000_000) return `€${Math.round(v / 1_000_000)}m`;
  return eur(v);
}

export async function renderPlayersInto(container, opts = {}) {
  container.classList.add('ph-root');
  container.innerHTML = `<div class="ph-loading">Loading 1,248 players…</div>`;

  const [players, teams48, thumbs] = await Promise.all([
    data.getPlayersSample(),
    data.getTeams48().catch(() => []),
    data.getPlayerThumbs().catch(() => null),
  ]);

  // Build a name → team record resolver (with aliases + normalization) so each
  // player's nationalTeam maps to a FIFA code for flags + filtering.
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  const byName = new Map();
  const byCode = new Map();
  for (const t of teams48) {
    byCode.set(t.fifa_code, t);
    byName.set(norm(t.name), t);
    if (t.name_normalised) byName.set(norm(t.name_normalised), t);
  }
  for (const [alias, code] of Object.entries(data.TEAM_NAME_ALIASES || {})) {
    const rec = byCode.get(code);
    if (rec && !byName.has(norm(alias))) byName.set(norm(alias), rec);
  }
  const teamOf = (p) => byName.get(norm(p.nationalTeam)) || byCode.get(p.nationalTeam) || null;

  // Annotate each player once with the joined team + a comparable value.
  for (const p of players) {
    p._team = teamOf(p);
    p._code = p._team ? p._team.fifa_code : null;
    p._pos = POS_FROM_GROUP[p.positionGroup] || 'MID';
    p._v = p.marketValueEur || 0;
  }

  const ctx = { players, teams48, thumbs, container, byCode };
  render(ctx);
}

function render(ctx) {
  const { container } = ctx;
  container.innerHTML = '';
  container.appendChild(buildHero(ctx));
  container.appendChild(buildMostValuable(ctx));
  container.appendChild(buildValueXI(ctx));
  container.appendChild(buildByPosition(ctx));
  container.appendChild(buildTalentMap(ctx));
  container.appendChild(buildSuperlatives(ctx));
  container.appendChild(buildIndex(ctx));
  container.appendChild(el('div', { class: 'ph-foot' },
    'Player valuations, photos and career data via Transfermarkt. National-team rosters from openfootball. '
    + 'Values shown are estimated market values in EUR. A handful of players carry no valuation yet and are sorted last.'));
}

// ── Hero + tournament aggregates ────────────────────────────────────────────
function buildHero(ctx) {
  const { players } = ctx;
  const withV = players.filter(p => p._v > 0);
  const total = withV.reduce((a, p) => a + p._v, 0);
  const clubs = new Set(players.map(p => p.currentClub).filter(Boolean));
  const nations = new Set(players.map(p => p._code).filter(Boolean));
  const ages = players.map(p => p.age).filter(Boolean);
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—';
  const avgVal = withV.length ? Math.round(total / withV.length) : 0;

  const hero = el('div', { class: 'ph-hero' });
  hero.appendChild(el('div', { class: 'ph-hero-word' }, 'XI'));
  const inner = el('div', { class: 'ph-hero-inner' });
  inner.appendChild(el('div', { class: 'ph-kicker' }, 'World Cup 26 · Every player'));
  const title = el('div', { class: 'ph-title' });
  title.appendChild(document.createTextNode('THE '));
  title.appendChild(el('span', { class: 'y' }, 'TALENT'));
  inner.appendChild(title);
  inner.appendChild(el('div', { class: 'ph-sub' },
    `Every one of the ${players.length.toLocaleString('en-US')} players across all 48 squads — ranked, searchable, and valued. `
    + `A combined ${bigEur(total)} of talent on one pitch.`));
  hero.appendChild(inner);

  const aggs = el('div', { class: 'ph-aggs' });
  const agg = (v, k, pale) => el('div', { class: 'ph-agg' },
    el('div', { class: 'v' + (pale ? ' pale' : '') }, v), el('div', { class: 'k' }, k));
  aggs.appendChild(agg(bigEur(total), 'Combined market value'));
  aggs.appendChild(agg(players.length.toLocaleString('en-US'), 'Players', true));
  aggs.appendChild(agg(String(nations.size), 'Nations', true));
  aggs.appendChild(agg(String(clubs.size), 'Clubs represented', true));
  aggs.appendChild(agg(eur(avgVal), 'Average value'));
  aggs.appendChild(agg(avgAge, 'Average age', true));

  const wrap = el('div', {});
  wrap.appendChild(hero);
  wrap.appendChild(aggs);
  return wrap;
}

function secHead(title, desc) {
  return el('div', { class: 'ph-sec-head' },
    el('h2', {}, title),
    desc ? el('div', { class: 'desc' }, desc) : null);
}

// ── Most valuable players ───────────────────────────────────────────────────
function buildMostValuable(ctx) {
  const { players, thumbs } = ctx;
  const top = players.filter(p => p._v > 0).sort((a, b) => b._v - a._v).slice(0, 12);
  const sec = el('div', { class: 'ph-section' });
  sec.appendChild(secHead('Most valuable', 'Top 12 by market value'));
  const grid = el('div', { class: 'ph-mv-grid' });
  top.forEach((p, i) => {
    const card = el('a', { class: 'ph-mv', href: playerHref(p) });
    const pic = el('div', { class: 'pic', style: faceStyle(photoFor(p, thumbs)) });
    if (!photoFor(p, thumbs)) pic.appendChild(el('div', { class: 'ini' }, initials(p.name)));
    pic.appendChild(el('div', { class: 'rk' }, String(i + 1)));
    if (p._code && flagSrc(p._code)) pic.appendChild(el('div', { class: 'fl', style: `background-image:url(${flagSrc(p._code)})` }));
    const cap = el('div', { class: 'cap' },
      el('div', { class: 'nm' }, p.name),
      el('div', { class: 'cl' }, p.currentClub || ''),
      el('div', { class: 'vl' }, eur(p._v)));
    pic.appendChild(cap);
    card.appendChild(pic);
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
}

// ── Value XI (best 4-3-3 by market value) ───────────────────────────────────
function buildValueXI(ctx) {
  const { players, thumbs } = ctx;
  const pick = (group, n) => players.filter(p => p.positionGroup === group && p._v > 0)
    .sort((a, b) => b._v - a._v).slice(0, n);
  const gk = pick('GK', 1), df = pick('DF', 4), mf = pick('MF', 3), fw = pick('FW', 3);
  const xi = [...gk, ...df, ...mf, ...fw];
  if (xi.length < 11) return el('div'); // safety
  const total = xi.reduce((a, p) => a + p._v, 0);

  // Vertical pitch, attackers at the top. [topPct] per line, evenly spread across.
  const lines = [
    { row: fw, y: 13 }, { row: mf, y: 38 }, { row: df, y: 64 }, { row: gk, y: 88 },
  ];
  const pitch = el('div', { class: 'ph-pitch' });
  pitch.appendChild(el('div', { class: 'ln mid' }));
  pitch.appendChild(el('div', { class: 'ln circ' }));
  pitch.appendChild(el('div', { class: 'ln boxT' }));
  pitch.appendChild(el('div', { class: 'ln boxB' }));
  for (const { row, y } of lines) {
    const n = row.length;
    row.forEach((p, i) => {
      const x = (i + 1) / (n + 1) * 100;
      const spot = el('a', { class: 'ph-xi-spot', href: playerHref(p), style: `left:${x}%;top:${y}%` });
      const face = el('div', { class: 'ph-xi-face', style: faceStyle(photoFor(p, thumbs)) });
      if (!photoFor(p, thumbs)) face.appendChild(el('div', { class: 'ini' }, initials(p.name)));
      spot.appendChild(face);
      spot.appendChild(el('div', { class: 'nm' }, p.name.split(/\s+/).pop()));
      spot.appendChild(el('div', { class: 'vl' }, eur(p._v)));
      pitch.appendChild(spot);
    });
  }

  const side = el('div', { class: 'ph-xi-side' },
    el('div', { class: 'ph-xi-form' }, el('span', {}, '4'), el('span', {}, '3'), el('span', {}, '3')),
    el('div', { class: 'ph-xi-note' }, 'The most valuable player available at every position — a notional starting XI built purely on Transfermarkt value.'),
    el('div', { class: 'ph-xi-tot' },
      el('div', { class: 'v' }, bigEur(total)),
      el('div', { class: 'k' }, 'Combined value of the XI')));

  const sec = el('div', { class: 'ph-section' });
  sec.appendChild(secHead('The value XI', 'Best 4-3-3 by price tag'));
  sec.appendChild(el('div', { class: 'ph-xi-wrap' }, pitch, side));
  return sec;
}

// ── Leaderboards by position ────────────────────────────────────────────────
function buildByPosition(ctx) {
  const { players, thumbs } = ctx;
  const sec = el('div', { class: 'ph-section' });
  sec.appendChild(secHead('By position', 'Top 5 in each line'));
  const grid = el('div', { class: 'ph-pos-grid' });
  for (const k of ['GK', 'DEF', 'MID', 'FWD']) {
    const col = el('div', { class: 'ph-pos-col' });
    col.appendChild(el('h3', {}, POS_FULL[k]));
    const top = players.filter(p => p._pos === k && p._v > 0).sort((a, b) => b._v - a._v).slice(0, 5);
    top.forEach((p, i) => {
      const row = el('a', { class: 'ph-pl-row', href: playerHref(p) });
      row.appendChild(el('div', { class: 'rk' }, String(i + 1)));
      const face = el('div', { class: 'face', style: faceStyle(photoFor(p, thumbs)) });
      if (!photoFor(p, thumbs)) face.appendChild(el('div', { class: 'ini' }, initials(p.name)));
      row.appendChild(face);
      row.appendChild(el('div', { class: 'info' },
        el('div', { class: 'nm' }, p.name),
        el('div', { class: 'sub' }, p.currentClub || '')));
      if (p._code && flagSrc(p._code)) row.appendChild(el('div', { class: 'fl', style: `background-image:url(${flagSrc(p._code)})` }));
      row.appendChild(el('div', { class: 'vl' }, eur(p._v)));
      col.appendChild(row);
    });
    grid.appendChild(col);
  }
  sec.appendChild(grid);
  return sec;
}

// ── Where the talent plays ──────────────────────────────────────────────────
function buildTalentMap(ctx) {
  const { players } = ctx;
  const clubCount = new Map();
  const ctryVal = new Map();
  const ctryCount = new Map();
  for (const p of players) {
    if (p.currentClub) clubCount.set(p.currentClub, (clubCount.get(p.currentClub) || 0) + 1);
    if (p.currentClubCountry) {
      ctryCount.set(p.currentClubCountry, (ctryCount.get(p.currentClubCountry) || 0) + 1);
      ctryVal.set(p.currentClubCountry, (ctryVal.get(p.currentClubCountry) || 0) + p._v);
    }
  }
  const topClubs = [...clubCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topCtry = [...ctryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxClub = Math.max(...topClubs.map(c => c[1]), 1);
  const maxCtry = Math.max(...topCtry.map(c => c[1]), 1);

  const sec = el('div', { class: 'ph-section' });
  sec.appendChild(secHead('Where the talent plays', 'Club & league footprint'));
  const grid = el('div', { class: 'ph-bars-grid' });

  const clubsBox = el('div', { class: 'ph-bars' });
  clubsBox.appendChild(el('h3', {}, 'Most-represented clubs'));
  for (const [club, n] of topClubs) {
    clubsBox.appendChild(el('div', { class: 'ph-bar-row' },
      el('div', { class: 'lab' }, el('span', {}, club)),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(n / maxClub * 100).toFixed(1)}%` })),
      el('div', { class: 'n' }, String(n))));
  }
  grid.appendChild(clubsBox);

  const leagueBox = el('div', { class: 'ph-bars' });
  leagueBox.appendChild(el('h3', {}, 'Leagues by player count'));
  for (const [cc, n] of topCtry) {
    const fl = flagSrc(cc);
    leagueBox.appendChild(el('div', { class: 'ph-bar-row' },
      el('div', { class: 'lab' },
        fl ? el('div', { class: 'fl', style: `background-image:url(${fl})` }) : null,
        el('span', {}, cc)),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(n / maxCtry * 100).toFixed(1)}%` })),
      el('div', { class: 'n' }, String(n))));
  }
  grid.appendChild(leagueBox);

  sec.appendChild(grid);
  return sec;
}

// ── Superlatives ────────────────────────────────────────────────────────────
function valueRiseSince(p, cutoffYear = 2024) {
  const h = p.marketValueHistory || [];
  if (h.length < 2 || !p._v) return null;
  let base = null;
  for (const e of h) {
    const y = +(String(e.date).slice(0, 4));
    if (y >= cutoffYear) break;
    base = e.valueEur;
  }
  if (base == null) base = h[0].valueEur;
  return p._v - base;
}

function buildSuperlatives(ctx) {
  const { players, thumbs } = ctx;
  const withV = players.filter(p => p._v > 0);
  const withAge = players.filter(p => p.age);
  const youngest = withAge.slice().sort((a, b) => a.age - b.age)[0];
  const oldest = withAge.slice().sort((a, b) => b.age - a.age)[0];
  const tallest = players.filter(p => p.height).sort((a, b) => b.height - a.height)[0];
  const peak = withV.slice().sort((a, b) => (b.marketValuePeak || 0) - (a.marketValuePeak || 0))[0];
  const traveled = players.slice().sort((a, b) => (b.transferHistory || []).length - (a.transferHistory || []).length)[0];
  const riser = withV.map(p => ({ p, r: valueRiseSince(p) })).filter(x => x.r > 0)
    .sort((a, b) => b.r - a.r)[0];

  const card = (cat, p, metaText, big) => {
    if (!p) return null;
    const a = el('a', { class: 'ph-super', href: playerHref(p) });
    a.appendChild(el('div', { class: 'cat' }, cat));
    const top = el('div', { class: 'top' });
    const face = el('div', { class: 'face', style: faceStyle(photoFor(p, thumbs)) });
    if (!photoFor(p, thumbs)) face.appendChild(el('div', { class: 'ini' }, initials(p.name)));
    top.appendChild(face);
    top.appendChild(el('div', {},
      el('div', { class: 'nm' }, p.name),
      el('div', { class: 'meta' }, metaText)));
    a.appendChild(top);
    if (big) a.appendChild(el('div', { class: 'big', html: big }));
    return a;
  };

  const sec = el('div', { class: 'ph-section' });
  sec.appendChild(secHead('Superlatives', 'Records across the field'));
  const grid = el('div', { class: 'ph-super-grid' });
  grid.appendChild(card('Youngest', youngest, youngest && `${youngest.currentClub || ''}`, youngest && `${youngest.age}<small> yrs</small>`));
  grid.appendChild(card('Oldest', oldest, oldest && `${oldest.currentClub || ''}`, oldest && `${oldest.age}<small> yrs</small>`));
  grid.appendChild(card('Biggest riser', riser && riser.p, riser && 'Value gained since 2024', riser && `+${bigEur(riser.r)}`));
  grid.appendChild(card('Highest peak', peak, peak && `Now ${eur(peak._v)}`, peak && bigEur(peak.marketValuePeak)));
  grid.appendChild(card('Most clubs', traveled, traveled && (traveled.currentClub || ''), traveled && `${(traveled.transferHistory || []).length}<small> moves</small>`));
  grid.appendChild(card('Tallest', tallest, tallest && (tallest.currentClub || ''), tallest && `${tallest.height}<small> cm</small>`));
  sec.appendChild(grid);
  return sec;
}

// ── Full searchable / filterable / sortable index ───────────────────────────
function buildIndex(ctx) {
  const { players, teams48, thumbs } = ctx;
  const state = { q: '', pos: 'ALL', team: 'ALL', sort: 'value', shown: 48 };

  const sec = el('div', { class: 'ph-section' });
  sec.appendChild(secHead('Every player', 'Search · filter · sort all ' + players.length.toLocaleString('en-US')));
  const box = el('div', { class: 'ph-idx' });

  // Controls
  const controls = el('div', { class: 'ph-idx-controls' });
  const search = el('div', { class: 'ph-search' },
    el('span', { html: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' }));
  const input = el('input', { type: 'text', placeholder: 'Search players or clubs…', autocomplete: 'off' });
  search.appendChild(input);
  controls.appendChild(search);

  const seg = el('div', { class: 'ph-seg' });
  for (const [id, lab] of [['ALL', 'All'], ['GK', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['FWD', 'FWD']]) {
    seg.appendChild(el('button', { class: id === state.pos ? 'on' : '',
      'data-pos': id, onclick: (e) => { state.pos = id; state.shown = 48; for (const b of seg.children) b.classList.toggle('on', b.dataset.pos === id); update(); } }, lab));
  }
  controls.appendChild(seg);

  const teamSel = el('select');
  teamSel.appendChild(el('option', { value: 'ALL' }, 'All teams'));
  for (const t of [...teams48].sort((a, b) => a.name.localeCompare(b.name))) {
    teamSel.appendChild(el('option', { value: t.fifa_code }, t.name));
  }
  teamSel.addEventListener('change', () => { state.team = teamSel.value; state.shown = 48; update(); });
  controls.appendChild(el('div', { class: 'ph-select' }, teamSel));

  const sortSel = el('select');
  for (const [id, lab] of [['value', 'Value ↓'], ['valueAsc', 'Value ↑'], ['ageAsc', 'Youngest'], ['ageDesc', 'Oldest'], ['peak', 'Peak value'], ['name', 'Name A–Z']]) {
    sortSel.appendChild(el('option', { value: id }, lab));
  }
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.shown = 48; update(); });
  controls.appendChild(el('div', { class: 'ph-select' }, sortSel));

  const count = el('div', { class: 'ph-idx-count' });
  controls.appendChild(count);
  box.appendChild(controls);

  const grid = el('div', { class: 'ph-idx-grid' });
  box.appendChild(grid);
  const more = el('button', { class: 'ph-more' }, 'Load more');
  more.addEventListener('click', () => { state.shown += 48; update(); });
  box.appendChild(more);

  const CMP = {
    value: (a, b) => b._v - a._v,
    valueAsc: (a, b) => (a._v || Infinity) - (b._v || Infinity),
    ageAsc: (a, b) => (a.age || 999) - (b.age || 999),
    ageDesc: (a, b) => (b.age || 0) - (a.age || 0),
    peak: (a, b) => (b.marketValuePeak || 0) - (a.marketValuePeak || 0),
    name: (a, b) => a.name.localeCompare(b.name),
  };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return players.filter(p => {
      if (state.pos !== 'ALL' && p._pos !== state.pos) return false;
      if (state.team !== 'ALL' && p._code !== state.team) return false;
      if (q && !(p.name.toLowerCase().includes(q) || (p.currentClub || '').toLowerCase().includes(q))) return false;
      return true;
    }).sort(CMP[state.sort] || CMP.value);
  }

  function update() {
    const list = filtered();
    const visible = list.slice(0, state.shown);
    grid.innerHTML = '';
    if (!visible.length) {
      grid.appendChild(el('div', { class: 'ph-empty' }, 'No players match those filters.'));
    } else {
      for (const p of visible) grid.appendChild(idxCard(p, thumbs, state.sort));
    }
    count.textContent = `${list.length.toLocaleString('en-US')} player${list.length === 1 ? '' : 's'}`;
    more.style.display = list.length > state.shown ? 'block' : 'none';
  }

  let t = null;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = input.value; state.shown = 48; update(); }, 130);
  });

  update();
  sec.appendChild(box);
  return sec;
}

function idxCard(p, thumbs, sort) {
  const card = el('a', { class: 'ph-idx-card', href: playerHref(p) });
  const face = el('div', { class: 'face', style: faceStyle(photoFor(p, thumbs)) });
  if (!photoFor(p, thumbs)) face.appendChild(el('div', { class: 'ini' }, initials(p.name)));
  if (p._code && flagSrc(p._code)) face.appendChild(el('div', { class: 'fl', style: `background-image:url(${flagSrc(p._code)})` }));
  card.appendChild(face);
  card.appendChild(el('div', { class: 'info' },
    el('div', { class: 'nm' }, p.name),
    el('div', { class: 'sub' }, [p.currentClub, p.age && `${p.age}y`].filter(Boolean).join(' · '))));
  card.appendChild(el('div', { class: 'pos' }, p._pos));
  const showPeak = sort === 'peak';
  card.appendChild(el('div', { class: 'vl', html: `${eur(showPeak ? p.marketValuePeak : p._v)}${showPeak ? '<small>peak</small>' : ''}` }));
  return card;
}
