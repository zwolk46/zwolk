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
import { icon } from './icons.js';

export const playersCss = `
  /* Page-local pitch tokens (the grass is a textured decorative surface, but its
     shades, lines and overlay text must still be theme-aware — no raw hexes). */
  .ph-root{position:relative;container-type:inline-size;
    --pitch-1:#10341f;--pitch-2:#0b2417;--pitch-border:#1c4a2e;
    --pitch-line:rgba(255,255,255,.16);
    --pitch-ini:#cfe6cf;--pitch-name:#fff;--pitch-value:#ffe9a8}
  :root[data-theme="light"] .ph-root{
    --pitch-1:#1f7a45;--pitch-2:#15663a;--pitch-border:#1f8a4e;
    --pitch-line:rgba(255,255,255,.28);
    --pitch-ini:#eaf7ea;--pitch-name:#fff;--pitch-value:#fff3cf}

  /* ── Hero (keep the big "XI / THE TALENT" typographic hero) ───────────── */
  .ph-hero{position:relative;overflow:hidden;border-radius:var(--r-lg);padding:clamp(20px,4cqi,52px);background:radial-gradient(130% 130% at 88% 0%,var(--accent-quiet),transparent 60%);border:1px solid var(--border-subtle);animation:wc-reveal-up .6s var(--ease-spring) both}
  .ph-hero-word{position:absolute;right:-1%;top:-22%;font-family:var(--f-display);font-size:clamp(120px,40cqi,440px);color:var(--accent-quiet);line-height:1;pointer-events:none;user-select:none;z-index:0}
  .ph-hero-inner{position:relative;z-index:1}
  .ph-kicker{font-family:'Archivo Expanded',var(--f-body);font-weight:800;font-size:clamp(10px,1.5cqi,14px);letter-spacing:0.2em;text-transform:uppercase;color:var(--accent-text)}
  .ph-title{font-family:var(--f-display);font-size:clamp(44px,13cqi,150px);line-height:0.82;text-transform:uppercase;color:var(--text);margin-top:8px}
  .ph-title .y{color:var(--accent-text)}
  .ph-sub{font-family:var(--f-body);font-weight:600;font-size:clamp(13px,1.7cqi,17px);color:var(--text-2);margin-top:14px;max-width:640px;line-height:1.5}

  /* ── Aggregate strip → .wc-stat look ──────────────────────────────────── */
  .ph-aggs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--border-subtle);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-top:16px}
  .ph-agg{background:var(--surface-1);padding:18px}
  .ph-agg .v{font-family:var(--f-display);font-size:clamp(24px,3.4cqi,38px);color:var(--accent-text);line-height:0.95;font-variant-numeric:tabular-nums}
  .ph-agg .v.pale{color:var(--text)}
  .ph-agg .k{font-family:var(--f-body);font-weight:800;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-3);margin-top:8px}

  /* ── Section frame ────────────────────────────────────────────────────── */
  .ph-section{margin-top:26px;animation:wc-reveal-up .55s ease both}
  .ph-sec-head{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
  .ph-sec-head h2{font-family:var(--f-display);font-size:clamp(20px,3cqi,30px);text-transform:uppercase;letter-spacing:0.01em;color:var(--text)}
  .ph-sec-head .desc{font-family:var(--f-body);font-weight:600;font-size:12px;color:var(--text-3);margin-left:auto;text-align:right}

  /* ── Most valuable (podium grid) ──────────────────────────────────────── */
  .ph-mv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px}
  .ph-mv{position:relative;display:block;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;text-decoration:none;color:inherit;box-shadow:var(--sh-1);transition:transform var(--dur-2) var(--ease-press),border-color var(--dur-2),box-shadow var(--dur-2)}
  .ph-mv:hover{transform:translateY(-3px);border-color:var(--accent-line);box-shadow:var(--sh-3)}
  .ph-mv:active{transform:scale(.97)}
  .ph-mv .pic{position:relative;aspect-ratio:1/1;background:var(--surface-2);background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center}
  .ph-mv .pic .ini{font-family:var(--f-display);font-size:42px;color:var(--text-3)}
  .ph-mv .rk{position:absolute;top:9px;left:10px;font-family:var(--f-display);font-size:26px;color:var(--accent-text);line-height:0.8;text-shadow:0 2px 8px rgba(0,0,0,0.7)}
  .ph-mv .fl{position:absolute;top:11px;right:10px;width:26px;height:19px;background-size:cover;background-position:center}
  .ph-mv .pic::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,var(--bg) 4%,transparent 50%)}
  .ph-mv .cap{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;z-index:2}
  .ph-mv .nm{font-family:var(--f-body);font-weight:800;font-size:14px;color:var(--text);line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-mv .cl{font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-mv .vl{font-family:var(--f-mono);font-weight:700;font-size:15px;color:var(--accent-text);margin-top:5px;font-variant-numeric:tabular-nums}

  /* ── Value XI pitch (responsive — names/values must not overlap) ──────── */
  .ph-xi-wrap{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px}
  @container (max-width:680px){.ph-xi-wrap{grid-template-columns:1fr}}
  .ph-pitch{position:relative;aspect-ratio:3/4;border-radius:var(--r-lg);background:linear-gradient(170deg,var(--pitch-1),var(--pitch-2) 70%);border:1px solid var(--pitch-border);overflow:hidden}
  .ph-pitch .ln{position:absolute;border:1px solid var(--pitch-line)}
  .ph-pitch .mid{left:0;right:0;top:50%;border-width:1px 0 0 0}
  .ph-pitch .circ{left:50%;top:50%;width:30%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%}
  .ph-pitch .boxT{left:26%;right:26%;top:0;height:14%;border-top:none}
  .ph-pitch .boxB{left:26%;right:26%;bottom:0;height:14%;border-bottom:none}
  /* spot sizing scales with the pitch column. 4 defenders sit 20cqi apart, so a
     <20cqi spot width keeps their label boxes from overlapping; names ellipsize
     inside the box as a second guard. */
  .ph-xi-spot{position:absolute;transform:translate(-50%,-50%);width:min(92px,19cqi);min-width:0;text-align:center;text-decoration:none}
  .ph-xi-spot .ph-xi-face{width:clamp(34px,10cqi,56px);height:clamp(34px,10cqi,56px);margin:0 auto;border-radius:50%;background:var(--surface-sunken);border:2px solid var(--accent);background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px -8px rgba(0,0,0,0.9);transition:transform var(--dur-2) var(--ease-press)}
  .ph-xi-spot:hover .ph-xi-face{transform:translateY(-2px)}
  .ph-xi-spot:active .ph-xi-face{transform:scale(.95)}
  .ph-xi-spot .ph-xi-face .ini{font-family:var(--f-display);font-size:clamp(11px,3cqi,16px);color:var(--pitch-ini)}
  .ph-xi-spot .nm{font-family:var(--f-body);font-weight:800;font-size:clamp(8px,2.2cqi,11px);color:var(--pitch-name);margin-top:5px;line-height:1.05;text-shadow:0 1px 4px rgba(0,0,0,0.95);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-xi-spot .vl{font-family:var(--f-mono);font-weight:700;font-size:clamp(7px,1.9cqi,10px);color:var(--pitch-value);text-shadow:0 1px 3px rgba(0,0,0,0.95);font-variant-numeric:tabular-nums}
  .ph-xi-side{display:flex;flex-direction:column;gap:8px;justify-content:center}
  .ph-xi-note{font-family:var(--f-body);font-weight:600;font-size:12px;color:var(--text-2);line-height:1.5}
  .ph-xi-tot{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;box-shadow:var(--sh-1)}
  .ph-xi-tot .v{font-family:var(--f-mono);font-weight:700;font-size:30px;color:var(--accent-text);line-height:0.9;font-variant-numeric:tabular-nums}
  .ph-xi-tot .k{font-family:var(--f-body);font-weight:800;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-3);margin-top:8px}
  .ph-xi-form{display:inline-flex;gap:6px;margin-top:2px}
  .ph-xi-form span{font-family:var(--f-display);font-size:18px;color:var(--text);background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px 10px}

  /* ── By position columns ──────────────────────────────────────────────── */
  .ph-pos-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
  .ph-pos-col{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 14px 8px;box-shadow:var(--sh-1)}
  .ph-pos-col h3{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:10px}
  .ph-pl-row{display:flex;align-items:center;gap:10px;padding:7px 6px;border-radius:var(--r-sm);text-decoration:none;color:inherit;transition:background var(--dur-2),transform var(--dur-1) var(--ease-press)}
  .ph-pl-row:hover{background:var(--surface-2)}
  .ph-pl-row:active{transform:scale(.98)}
  .ph-pl-row .rk{font-family:var(--f-display);font-size:14px;color:var(--text-3);min-width:16px;text-align:center}
  .ph-pl-row .face{width:30px;height:30px;flex:none;font-size:11px}
  .ph-pl-row .info{flex:1;min-width:0}
  .ph-pl-row .nm{font-family:var(--f-body);font-weight:700;font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-pl-row .sub{font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-pl-row .fl{width:18px;height:13px;flex:none;background-size:cover;background-position:center}
  .ph-pl-row .vl{font-family:var(--f-mono);font-weight:700;font-size:11px;color:var(--accent-text);min-width:44px;text-align:right;font-variant-numeric:tabular-nums}

  /* ── Talent map (flat, solid bars — no gradient) ──────────────────────── */
  .ph-bars-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
  .ph-bars{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);padding:16px 18px;box-shadow:var(--sh-1)}
  .ph-bars h3{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:14px}
  .ph-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:9px}
  .ph-bar-row .lab{display:flex;align-items:center;gap:7px;min-width:118px}
  .ph-bar-row .lab .fl{width:20px;height:14px;flex:none;background-size:cover;background-position:center}
  .ph-bar-row .lab span{font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-bar-row .track{flex:1;height:9px;background:var(--surface-2);border-radius:var(--r-pill);overflow:hidden}
  .ph-bar-row .fill{height:100%;background:var(--accent);border-radius:var(--r-pill);transform-origin:left;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .ph-bar-row .n{font-family:var(--f-display);font-size:14px;color:var(--accent-text);min-width:26px;text-align:right;font-variant-numeric:tabular-nums}

  /* ── Superlatives ─────────────────────────────────────────────────────── */
  .ph-super-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}
  .ph-super{display:block;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 15px;text-decoration:none;color:inherit;box-shadow:var(--sh-1);transition:transform var(--dur-2) var(--ease-press),border-color var(--dur-2),box-shadow var(--dur-2)}
  .ph-super:hover{transform:translateY(-3px);border-color:var(--accent-line);box-shadow:var(--sh-2)}
  .ph-super:active{transform:scale(.97)}
  .ph-super .cat{font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-3)}
  .ph-super .top{display:flex;align-items:center;gap:11px;margin-top:11px}
  .ph-super .face{width:42px;height:42px;flex:none;font-size:15px}
  .ph-super .nm{font-family:var(--f-body);font-weight:800;font-size:14px;color:var(--text);line-height:1.1}
  .ph-super .meta{font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-2);margin-top:2px}
  .ph-super .big{font-family:var(--f-display);font-size:30px;color:var(--accent-text);margin-top:10px;line-height:0.9;font-variant-numeric:tabular-nums}
  .ph-super .big small{font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-3);letter-spacing:0.04em}

  /* ── Avatar (monogram fallback — matches .wc-avatar) ──────────────────── */
  .ph-face{border-radius:50%;flex:none;display:grid;place-items:center;background:var(--surface-2);color:var(--text-3);font-family:var(--f-display);position:relative;overflow:hidden;box-shadow:inset 0 0 0 1px var(--border);background-size:cover;background-position:center 35%}
  .ph-face .ini{font-family:var(--f-display);color:var(--text-3)}

  /* ── Index (search/filter/sort + grid) ────────────────────────────────── */
  .ph-idx{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px 18px;margin-top:14px;box-shadow:var(--sh-1)}
  .ph-idx-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
  .ph-search{flex:1;min-width:180px;display:flex;align-items:center;gap:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-pill);padding:10px 16px}
  .ph-search .wc-ic{flex:none;color:var(--text-3);width:18px;height:18px}
  .ph-search input{flex:1;min-width:0;background:none;border:none;outline:none;font-family:var(--f-body);font-size:14px;color:var(--text)}
  .ph-search input::placeholder{color:var(--text-3)}
  /* segmented control with sliding thumb — matches .wc-seg */
  .ph-seg{display:inline-flex;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-pill);padding:4px;position:relative}
  .ph-seg button{position:relative;z-index:1;cursor:pointer;border:0;font-family:var(--f-body);font-weight:800;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;padding:7px 13px;border-radius:var(--r-pill);background:none;color:var(--text-3);transition:color var(--dur-2)}
  .ph-seg button.on{color:var(--on-accent)}
  .ph-seg .wc-seg-thumb{position:absolute;top:4px;bottom:4px;border-radius:var(--r-pill);background:var(--accent);transition:transform var(--dur-3) var(--ease-spring),width var(--dur-3) var(--ease-spring);z-index:0}
  .ph-select{position:relative}
  .ph-select select{appearance:none;cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-pill);padding:10px 32px 10px 15px;font-family:var(--f-body);font-weight:700;font-size:12px;color:var(--text-2);outline:none;max-width:200px;transition:border-color var(--dur-2),color var(--dur-2)}
  .ph-select select:hover{border-color:var(--accent-line);color:var(--text)}
  .ph-select .wc-ic{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:var(--text-3);pointer-events:none;width:14px;height:14px}
  .ph-idx-count{font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-3);margin-left:auto;font-variant-numeric:tabular-nums}

  .ph-idx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:8px}
  .ph-idx-card{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:var(--r-md);background:var(--surface-2);border:1px solid var(--border);text-decoration:none;color:inherit;transition:transform var(--dur-2) var(--ease-press),border-color var(--dur-2),background var(--dur-2)}
  .ph-idx-card:hover{transform:translateY(-2px);border-color:var(--accent-line);background:var(--surface-3)}
  .ph-idx-card:active{transform:scale(.98)}
  .ph-idx-card .face{width:42px;height:42px;flex:none;font-size:14px;overflow:visible}
  .ph-idx-card .face .ini{font-size:14px}
  .ph-idx-card .face .fl{position:absolute;bottom:-2px;right:-3px;width:18px;height:13px;background-size:cover;background-position:center;box-shadow:0 0 0 2px var(--surface-2)}
  .ph-idx-card .info{flex:1;min-width:0}
  .ph-idx-card .nm{font-family:var(--f-body);font-weight:800;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-idx-card .sub{font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ph-idx-card .pos{font-family:var(--f-body);font-weight:900;font-size:8px;letter-spacing:0.08em;color:var(--accent-text);background:var(--accent-quiet);border:1px solid var(--accent-line);padding:2px 6px;border-radius:var(--r-xs)}
  .ph-idx-card .vl{font-family:var(--f-mono);font-weight:700;font-size:12px;color:var(--accent-text);text-align:right;min-width:46px;font-variant-numeric:tabular-nums}
  .ph-idx-card .vl small{display:block;font-family:var(--f-body);font-weight:700;font-size:8px;color:var(--text-3);letter-spacing:0.04em}
  .ph-empty{padding:36px 18px;text-align:center;font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-3)}
  .ph-more{display:block;width:100%;margin-top:14px;cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;font-family:var(--f-body);font-weight:800;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-2);transition:border-color var(--dur-2),color var(--dur-2),transform var(--dur-1) var(--ease-press)}
  .ph-more:hover{border-color:var(--accent-line);color:var(--accent-text)}
  .ph-more:active{transform:scale(.99)}

  .ph-loading{padding:60px 20px;text-align:center;font-family:var(--f-body);font-weight:700;font-size:14px;color:var(--text-3)}
  .ph-loading::before{content:'';display:inline-block;width:16px;height:16px;border:2px solid var(--border-strong);border-top-color:var(--accent-text);border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:11px}
  .ph-foot{margin-top:30px;padding-top:18px;border-top:1px solid var(--border-subtle);font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3);line-height:1.6}
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

// Short pitch label for a player. Single-word names stay as-is; otherwise use the
// last token — UNLESS it's a generic suffix (Junior/Jr/Neto/Filho/da/de/II/…), in
// which case keep the last TWO tokens so "Vinicius Junior" stays "Vinicius Junior"
// rather than collapsing to "Junior". Kept short so it fits the pitch spot.
const NAME_SUFFIXES = new Set([
  'junior', 'jr', 'jr.', 'neto', 'filho', 'sobrinho', 'dos', 'da', 'de', 'ii', 'iii',
]);
function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length <= 1) return name || '';
  const last = parts[parts.length - 1];
  if (NAME_SUFFIXES.has(last.toLowerCase())) {
    return parts.slice(-2).join(' ');
  }
  return last;
}

// Large headline values: extend the shared eur() with a billions tier so big
// aggregates read as "€1.04b". Below 1b it defers to eur() so per-player values
// and totals share one rounding style (no local mismatch).
function bigEur(v) {
  if (v == null) return '—';
  if (v >= 1_000_000_000) return `€${(+(v / 1_000_000_000).toFixed(2)).toString().replace(/\.?0+$/, '')}b`;
  return eur(v);
}

// Build a circular avatar with the shared monogram fallback (photo → initials).
// Matches the .wc-avatar token treatment via .ph-face.
function faceEl(p, thumbs, cls = '') {
  const url = photoFor(p, thumbs);
  const f = el('div', { class: ('ph-face ' + cls).trim(), style: faceStyle(url) });
  if (!url) f.appendChild(el('div', { class: 'ini' }, initials(p.name)));
  return f;
}

// Flag chip styled like the shared .wc-flag token (border-radius + box-shadow),
// rendered as a background-image div so it can sit as a positioned corner badge.
function flagEl(code, cls = '') {
  if (!code) return null;
  const src = flagSrc(code);
  if (!src) return null;
  return el('div', { class: ('wc-flag ' + cls).trim(), style: `background-image:url(${src})` });
}

// Position the sliding thumb of a .ph-seg segmented control under its .on button.
function moveSegThumb(seg) {
  const thumb = seg.querySelector('.wc-seg-thumb');
  const on = seg.querySelector('button.on');
  if (!thumb || !on) return;
  thumb.style.width = on.offsetWidth + 'px';
  thumb.style.transform = `translateX(${on.offsetLeft - 4}px)`;
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
    const picUrl = photoFor(p, thumbs);
    const pic = el('div', { class: 'pic', style: faceStyle(picUrl) });
    if (!picUrl) pic.appendChild(el('div', { class: 'ini' }, initials(p.name)));
    pic.appendChild(el('div', { class: 'rk' }, String(i + 1)));
    const fl = flagEl(p._code, 'fl');
    if (fl) pic.appendChild(fl);
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
      spot.appendChild(el('div', { class: 'nm' }, shortName(p.name)));
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
      row.appendChild(faceEl(p, thumbs, 'face'));
      row.appendChild(el('div', { class: 'info' },
        el('div', { class: 'nm' }, p.name),
        el('div', { class: 'sub' }, p.currentClub || '')));
      const fl = flagEl(p._code, 'fl');
      if (fl) row.appendChild(fl);
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
    leagueBox.appendChild(el('div', { class: 'ph-bar-row' },
      el('div', { class: 'lab' },
        flagEl(cc, 'fl'),
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
    top.appendChild(faceEl(p, thumbs, 'face'));
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
    el('span', { html: icon('search', { size: 18 }) }));
  const input = el('input', { type: 'text', placeholder: 'Search players or clubs…', autocomplete: 'off', 'aria-label': 'Search players or clubs' });
  search.appendChild(input);
  controls.appendChild(search);

  // Position filter — segmented control with a sliding gold thumb (.wc-seg look).
  const seg = el('div', { class: 'ph-seg', role: 'tablist', 'aria-label': 'Filter by position' });
  seg.appendChild(el('div', { class: 'wc-seg-thumb' }));
  for (const [id, lab] of [['ALL', 'All'], ['GK', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['FWD', 'FWD']]) {
    seg.appendChild(el('button', { class: id === state.pos ? 'on' : '', type: 'button',
      'data-pos': id, 'aria-pressed': id === state.pos ? 'true' : 'false',
      onclick: () => {
        state.pos = id; state.shown = 48;
        for (const b of seg.querySelectorAll('button')) {
          const on = b.dataset.pos === id;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        moveSegThumb(seg);
        update();
      } }, lab));
  }
  controls.appendChild(seg);

  const teamSel = el('select', { 'aria-label': 'Filter by team' });
  teamSel.appendChild(el('option', { value: 'ALL' }, 'All teams'));
  for (const t of [...teams48].sort((a, b) => a.name.localeCompare(b.name))) {
    teamSel.appendChild(el('option', { value: t.fifa_code }, t.name));
  }
  teamSel.addEventListener('change', () => { state.team = teamSel.value; state.shown = 48; update(); });
  controls.appendChild(el('div', { class: 'ph-select' }, teamSel, el('span', { html: icon('chevron-down', { size: 14 }) })));

  const sortSel = el('select', { 'aria-label': 'Sort players' });
  for (const [id, lab] of [['value', 'Highest value'], ['valueAsc', 'Lowest value'], ['ageAsc', 'Youngest'], ['ageDesc', 'Oldest'], ['peak', 'Peak value'], ['name', 'Name A–Z']]) {
    sortSel.appendChild(el('option', { value: id }, lab));
  }
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.shown = 48; update(); });
  controls.appendChild(el('div', { class: 'ph-select' }, sortSel, el('span', { html: icon('chevron-down', { size: 14 }) })));

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
  // The seg thumb needs layout (offsetWidth/Left), so place it once mounted and
  // keep it aligned if the controls row reflows (wrap on narrow viewports).
  requestAnimationFrame(() => moveSegThumb(seg));
  if (typeof ResizeObserver !== 'undefined') {
    let raf;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => moveSegThumb(seg)); }).observe(seg);
  }
  sec.appendChild(box);
  return sec;
}

function idxCard(p, thumbs, sort) {
  const card = el('a', { class: 'ph-idx-card', href: playerHref(p) });
  const face = faceEl(p, thumbs, 'face');
  const fl = flagEl(p._code, 'fl');
  if (fl) face.appendChild(fl);
  card.appendChild(face);
  card.appendChild(el('div', { class: 'info' },
    el('div', { class: 'nm' }, p.name),
    el('div', { class: 'sub' }, [p.currentClub, p.age && `${p.age}y`].filter(Boolean).join(' · '))));
  card.appendChild(el('div', { class: 'pos' }, p._pos));
  const showPeak = sort === 'peak';
  card.appendChild(el('div', { class: 'vl', html: `${eur(showPeak ? p.marketValuePeak : p._v)}${showPeak ? '<small>peak</small>' : ''}` }));
  return card;
}
