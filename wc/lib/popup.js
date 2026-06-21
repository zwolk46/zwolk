// Shared popup overlay used by list pages (fixtures, groups, bracket).
//
// Behaviour (per user spec):
//   - Click a card → smooth-animated popup opens IN PLACE. URL does NOT change.
//   - "Open full page" link in the popup header is a real anchor to the
//     dedicated URL (/wc/game/[id] etc.) — that's how you escape into the
//     fullscreen view.
//   - Backdrop click / X / Esc all close the popup. Nothing else changes.
//
// The popup body renders the same content as the fullscreen page by
// delegating to wc/lib/render-{game,team,player}.js (which both this and the
// fullscreen wrappers call).

import { renderGameInto, gameCss } from './render-game.js';
import { renderTeamInto, teamCss } from './render-team.js';
import { renderPlayerInto, playerCss } from './render-player.js';

const RENDERERS = {
  game:   { render: renderGameInto,   css: gameCss,   urlFor: id   => `/wc/game/${id}`,    title: 'Match centre' },
  team:   { render: renderTeamInto,   css: teamCss,   urlFor: code => `/wc/team/${code}`,  title: 'Team profile' },
  player: { render: renderPlayerInto, css: playerCss, urlFor: id   => `/wc/player/${id}`,  title: 'Player dossier' },
};

// Ensure each css string only gets injected once per page lifetime.
const _cssMounted = new Set();
function mountCss(key, css) {
  if (_cssMounted.has(key)) return;
  const s = document.createElement('style');
  s.setAttribute('data-popup-css', key);
  s.textContent = css;
  document.head.appendChild(s);
  _cssMounted.add(key);
}

const POPUP_CSS = `
  .wc-popup-back{position:fixed;inset:0;z-index:190;background:rgba(0,0,0,0.68);backdrop-filter:blur(5px);cursor:pointer;animation:wc-popup-back-in .28s ease both}
  .wc-popup-back.closing{animation:wc-popup-back-out .22s ease both}
  .wc-popup-panel{position:fixed;z-index:200;left:50%;top:50%;transform:translate(-50%,-50%);width:min(840px,94vw);max-height:88vh;display:flex;flex-direction:column;background:#0c1410;border:1px solid #1c2c1c;border-radius:22px;overflow:hidden;box-shadow:0 50px 100px -30px rgba(0,0,0,0.92);animation:wc-popup-in .42s cubic-bezier(.34,1.4,.5,1) both}
  .wc-popup-panel.closing{animation:wc-popup-out .22s ease both}
  @keyframes wc-popup-back-in{0%{opacity:0}100%{opacity:1}}
  @keyframes wc-popup-back-out{0%{opacity:1}100%{opacity:0}}
  @keyframes wc-popup-in{0%{opacity:0;transform:translate(-50%,-42%) scale(.94)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  @keyframes wc-popup-out{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-52%) scale(.94)}}
  .wc-popup-header{position:relative;display:flex;align-items:center;gap:10px;padding:12px 16px;background:#0c1410;border-bottom:1px solid #141f14;flex:none;z-index:5}
  .wc-popup-title{font-family:Archivo Expanded,Archivo;font-weight:800;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#dfe6df;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:9px}
  .wc-popup-title .crest{width:22px;height:16px;border-radius:3px;background-size:cover;background-position:center;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,0.12)}
  .wc-popup-expand{display:flex;align-items:center;gap:7px;background:rgba(245,199,18,0.1);border:1px solid rgba(245,199,18,0.25);color:#f5c712;text-decoration:none;height:32px;padding:0 13px;border-radius:8px;font-family:Archivo;font-weight:800;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;transition:background .2s,transform .15s ease-out;white-space:nowrap}
  .wc-popup-expand:hover{background:rgba(245,199,18,0.2)}
  .wc-popup-expand:active{transform:scale(0.94)}
  .wc-popup-close{display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:#4a6a4a;width:32px;height:32px;border-radius:8px;flex:none;transition:transform .2s cubic-bezier(.34,1.56,.64,1),background .2s,color .2s}
  .wc-popup-close:hover{background:rgba(255,255,255,0.06);color:#f4f2ea}
  .wc-popup-close:active{transform:scale(0.85) rotate(90deg)}
  .wc-popup-body{overflow-y:auto;flex:1;background:radial-gradient(130% 80% at 50% 0%,#0f1a13 0%,#0c1410 55%);padding:22px 26px 34px}
  .wc-popup-body::-webkit-scrollbar{width:10px}
  .wc-popup-body::-webkit-scrollbar-track{background:transparent}
  .wc-popup-body::-webkit-scrollbar-thumb{background:#2a322c;border-radius:8px}
  .wc-popup-body::-webkit-scrollbar-thumb:hover{background:#f5c712}
  .wc-popup-loading{padding:40px 20px;text-align:center;font-family:Archivo;font-weight:700;font-size:13px;color:#5a6a5a}
  .wc-popup-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid #2a3a2a;border-top-color:#f5c712;border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  /* Body class hook for in-popup-mode renderers (lets pages skip hero spacers etc.). */
  .wc-in-popup{padding:0 !important}
  .wc-in-popup .hero-spacer{display:none !important}
  /* Disable body scroll while popup is open. */
  body.wc-popup-open{overflow:hidden}
  @media (max-width:560px){
    .wc-popup-panel{width:100vw;height:100vh;max-height:100vh;border-radius:0;top:0;left:0;transform:none}
    @keyframes wc-popup-in{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes wc-popup-out{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(20px)}}
    .wc-popup-expand .lbl{display:none}
  }
`;

const ICON_EXPAND = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2H12M12 2V5M12 2L8 6M5 12H2M2 12V9M2 12L6 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CLOSE  = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`;

let _activePopup = null;

export function openPopup({ kind, id }) {
  const r = RENDERERS[kind];
  if (!r) { console.warn(`openPopup: unknown kind '${kind}'`); return null; }

  // Stack-of-1 — opening a new popup closes any previously open one.
  if (_activePopup) _activePopup.close({ immediate: true });

  mountCss('popup', POPUP_CSS);
  mountCss(`render-${kind}`, r.css);
  document.body.classList.add('wc-popup-open');

  const back = document.createElement('div');
  back.className = 'wc-popup-back';

  const panel = document.createElement('div');
  panel.className = 'wc-popup-panel';

  const header = document.createElement('div');
  header.className = 'wc-popup-header';
  header.innerHTML = `
    <span class="wc-popup-title" data-title>${r.title}</span>
    <span style="flex:1"></span>
    <a href="${r.urlFor(id)}" class="wc-popup-expand">${ICON_EXPAND}<span class="lbl">Open full page</span></a>
    <button class="wc-popup-close" aria-label="Close" type="button">${ICON_CLOSE}</button>
  `;

  const body = document.createElement('div');
  body.className = 'wc-popup-body';
  body.innerHTML = `<div class="wc-popup-loading">Loading…</div>`;

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(back);
  document.body.appendChild(panel);

  const close = ({ immediate = false } = {}) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    if (_activePopup === api) _activePopup = null;
    if (immediate) {
      back.remove();
      panel.remove();
      document.body.classList.remove('wc-popup-open');
      return;
    }
    panel.classList.add('closing');
    back.classList.add('closing');
    setTimeout(() => {
      back.remove();
      panel.remove();
      document.body.classList.remove('wc-popup-open');
    }, 230);
  };
  let closed = false;

  back.addEventListener('click', () => close());
  header.querySelector('.wc-popup-close').addEventListener('click', () => close());
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const titleEl = header.querySelector('[data-title]');
  const setTitle = (text, opts = {}) => {
    titleEl.innerHTML = '';
    if (opts.flagUrl) {
      const crest = document.createElement('span');
      crest.className = 'crest';
      crest.style.backgroundImage = `url(${opts.flagUrl})`;
      titleEl.appendChild(crest);
    }
    titleEl.appendChild(document.createTextNode(text));
  };

  // Mark body so detail renderers can skip page-only chrome (hero spacers etc.).
  body.classList.add('wc-in-popup');

  // Kick off content render. Renderer can call opts.setTitle to update header.
  Promise.resolve()
    .then(() => r.render(body, id, { popupMode: true, setTitle }))
    .catch(err => {
      body.innerHTML = `<div class="wc-popup-loading" style="color:#c0444f;animation:none">${escapeHtml(err && err.message || String(err))}</div>`;
    });

  const api = { close };
  _activePopup = api;
  return api;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Event delegation: any anchor whose href matches /wc/game/[id], /wc/team/[code],
// or /wc/player/[tmId] opens the corresponding popup INSTEAD of navigating —
// unless the user holds cmd/ctrl/shift/middle-click (in which case the browser
// performs its usual new-tab/window navigation to the fullscreen URL).
//
// Call once per page after the DOM is wired. Idempotent.
let _linksEnabled = false;
export function enablePopupLinks() {
  if (_linksEnabled) return;
  _linksEnabled = true;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== undefined && e.button !== 0) return;

    // Data-attribute targets take precedence (lets a nested team-name span open
    // a team popup even when its parent card is a game-popup anchor).
    const tEl = e.target.closest('[data-popup-team]');
    const gEl = e.target.closest('[data-popup-game]');
    const pEl = e.target.closest('[data-popup-player]');
    // Pick the closest one if multiple match by depth.
    const closestAttr = [tEl, gEl, pEl].filter(Boolean).sort((a, b) => depth(b) - depth(a))[0];
    if (closestAttr) {
      if (closestAttr === tEl) { e.preventDefault(); openPopup({ kind: 'team', id: tEl.dataset.popupTeam }); return; }
      if (closestAttr === gEl) { e.preventDefault(); openPopup({ kind: 'game', id: gEl.dataset.popupGame }); return; }
      if (closestAttr === pEl) { e.preventDefault(); openPopup({ kind: 'player', id: pEl.dataset.popupPlayer }); return; }
    }

    // Fall back to anchors pointing at /wc/{kind}/[id].
    const a = e.target.closest('a[href^="/wc/game/"], a[href^="/wc/team/"], a[href^="/wc/player/"]');
    if (!a) return;
    if (a.classList.contains('wc-popup-expand')) return; // "Open full page" always navigates.
    const m = a.getAttribute('href').match(/^\/wc\/(game|team|player)\/([^\/?#]+)/);
    if (!m) return;
    e.preventDefault();
    openPopup({ kind: m[1], id: decodeURIComponent(m[2]) });
  });
}
function depth(el) { let n = 0; for (let c = el; c; c = c.parentNode) n++; return n; }
