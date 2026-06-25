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
import { icon } from './icons.js';

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
  .wc-popup-back{position:fixed;inset:0;z-index:190;background:var(--scrim);backdrop-filter:blur(5px);cursor:pointer;animation:wc-popup-back-in .28s ease both}
  .wc-popup-back.closing{animation:wc-popup-back-out .22s ease both}
  .wc-popup-panel{position:fixed;z-index:200;left:50%;top:50%;transform:translate(-50%,-50%);width:min(840px,94vw);max-height:88vh;display:flex;flex-direction:column;background:var(--surface-4);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--sh-4);animation:wc-popup-in .42s var(--ease-spring) both}
  .wc-popup-panel.closing{animation:wc-popup-out .22s ease both}
  .wc-popup-panel:focus{outline:none}
  @keyframes wc-popup-back-in{0%{opacity:0}100%{opacity:1}}
  @keyframes wc-popup-back-out{0%{opacity:1}100%{opacity:0}}
  @keyframes wc-popup-in{0%{opacity:0;transform:translate(-50%,-42%) scale(.94)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  @keyframes wc-popup-out{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-52%) scale(.94)}}
  .wc-popup-header{position:relative;display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);flex:none;z-index:5}
  .wc-popup-title{font-family:var(--f-body);font-weight:800;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text);max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:9px}
  .wc-popup-title .crest{width:22px;height:16px;border-radius:3px;background-size:cover;background-position:center;flex:none;box-shadow:0 0 0 1px var(--border-strong)}
  .wc-popup-expand{display:flex;align-items:center;gap:7px;background:var(--accent-quiet);border:1px solid var(--accent-line);color:var(--accent-text);text-decoration:none;height:32px;padding:0 13px;border-radius:var(--r-sm);font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;transition:background var(--dur-2),transform var(--dur-1) var(--ease-press),border-color var(--dur-2);white-space:nowrap}
  .wc-popup-expand:hover{background:var(--accent);color:var(--on-accent);border-color:transparent}
  .wc-popup-expand:active{transform:scale(0.94)}
  .wc-popup-expand:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .wc-popup-expand .wc-ic{flex:none}
  .wc-popup-close{display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:var(--text-3);width:32px;height:32px;border-radius:var(--r-sm);flex:none;transition:transform var(--dur-2) var(--ease-spring),background var(--dur-2),color var(--dur-2)}
  .wc-popup-close:hover{background:var(--surface-3);color:var(--text)}
  .wc-popup-close:active{transform:scale(0.85) rotate(90deg)}
  .wc-popup-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .wc-popup-body{overflow-y:auto;flex:1;background:var(--surface-4);padding:22px 26px 34px}
  .wc-popup-body::-webkit-scrollbar{width:10px}
  .wc-popup-body::-webkit-scrollbar-track{background:transparent}
  .wc-popup-body::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:var(--r-sm)}
  .wc-popup-body::-webkit-scrollbar-thumb:hover{background:var(--accent)}
  .wc-popup-loading{padding:40px 20px;text-align:center;font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text-3)}
  .wc-popup-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  .wc-popup-loading.err{color:var(--danger-text);animation:none}
  /* Body class hook for in-popup-mode renderers (lets pages skip hero spacers etc.). */
  .wc-in-popup{padding:0 !important}
  .wc-in-popup .hero-spacer{display:none !important}
  /* Disable body scroll while popup is open. */
  body.wc-popup-open{overflow:hidden}
  @media (prefers-reduced-motion: reduce){
    .wc-popup-panel,.wc-popup-back{animation-duration:.01ms !important}
  }
  @media (max-width:560px){
    .wc-popup-panel{width:100vw;height:100vh;height:100dvh;max-height:100vh;max-height:100dvh;border-radius:0;top:0;left:0;transform:none}
    @keyframes wc-popup-in{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes wc-popup-out{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(20px)}}
    .wc-popup-expand .lbl{display:none}
  }
`;

const ICON_EXPAND = icon('arrow-up-right', { size: 14, stroke: 2 });
const ICON_CLOSE  = icon('x', { size: 18, stroke: 2 });

// ─── Accessible-dialog primitives (inlined; per 04-overlays-inputs.md A2/A3) ───
// Focus trap: Tab/Shift+Tab wrap within the panel. Adapted from a11y-dialog.
const FOCUSABLE = [
  'a[href]:not([tabindex^="-"])',
  'button:not([disabled]):not([tabindex^="-"])',
  'input:not([type="hidden"]):not([disabled]):not([tabindex^="-"])',
  'select:not([disabled]):not([tabindex^="-"])',
  'textarea:not([disabled]):not([tabindex^="-"])',
  'iframe:not([tabindex^="-"])',
  '[contenteditable]:not([tabindex^="-"])',
  '[tabindex]:not([tabindex^="-"])',
].join(',');
const isHidden = (el) => !(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
function focusableEdges(root) {
  const all = [...root.querySelectorAll(FOCUSABLE)].filter(e => !isHidden(e));
  return [all[0] || null, all[all.length - 1] || null];
}
function trapTab(root, e) {
  const [first, last] = focusableEdges(root);
  if (!first) { e.preventDefault(); return; }      // nothing focusable → keep focus in panel
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root.contains(active))) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
}

// Scroll lock with scrollbar-width compensation so the page doesn't shift.
let _scrollLocks = 0, _prevPadRight = '';
function lockScroll() {
  if (_scrollLocks++ > 0) return;
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  _prevPadRight = document.body.style.paddingRight;
  if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
  document.body.classList.add('wc-popup-open');
}
function unlockScroll() {
  if (_scrollLocks > 0 && --_scrollLocks > 0) return;
  document.body.classList.remove('wc-popup-open');
  document.body.style.paddingRight = _prevPadRight;
}

let _activePopup = null;
let _uid = 0;

export function openPopup({ kind, id }) {
  const r = RENDERERS[kind];
  if (!r) { console.warn(`openPopup: unknown kind '${kind}'`); return null; }

  // Stack-of-1 — opening a new popup closes any previously open one.
  if (_activePopup) _activePopup.close({ immediate: true });

  // Remember what had focus so we can restore it on close (APG point of regard).
  const opener = document.activeElement;

  mountCss('popup', POPUP_CSS);
  mountCss(`render-${kind}`, r.css);
  lockScroll();

  const dlgId = `wc-popup-${++_uid}`;

  const back = document.createElement('div');
  back.className = 'wc-popup-back';

  const panel = document.createElement('div');
  panel.className = 'wc-popup-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', `${dlgId}-title`);
  panel.tabIndex = -1;

  const header = document.createElement('div');
  header.className = 'wc-popup-header';
  header.innerHTML = `
    <span class="wc-popup-title" id="${dlgId}-title" data-title>${r.title}</span>
    <span style="flex:1"></span>
    <a href="${r.urlFor(id)}" class="wc-popup-expand">${ICON_EXPAND}<span class="lbl">Open full page</span></a>
    <button class="wc-popup-close" aria-label="Close dialog" type="button">${ICON_CLOSE}</button>
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
    document.removeEventListener('keydown', onKey, true);
    if (_activePopup === api) _activePopup = null;
    const finish = () => {
      back.remove();
      panel.remove();
      unlockScroll();
      // Return focus to the trigger (unless it's gone, e.g. another popup replaced us).
      if (!immediate && opener && opener.focus && document.contains(opener)) {
        try { opener.focus({ preventScroll: true }); } catch { opener.focus(); }
      }
    };
    if (immediate) { finish(); return; }
    panel.classList.add('closing');
    back.classList.add('closing');
    setTimeout(finish, 230);
  };
  let closed = false;

  back.addEventListener('click', () => close());
  const closeBtn = header.querySelector('.wc-popup-close');
  closeBtn.addEventListener('click', () => close());
  // ESC closes; Tab is trapped within the panel (capture so it runs before page handlers).
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') trapTab(panel, e);
  };
  document.addEventListener('keydown', onKey, true);

  // Move focus into the dialog on open (the close button is the safe initial target).
  requestAnimationFrame(() => { try { closeBtn.focus({ preventScroll: true }); } catch { closeBtn.focus(); } });

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
      body.innerHTML = `<div class="wc-popup-loading err">${escapeHtml(err && err.message || String(err))}</div>`;
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
