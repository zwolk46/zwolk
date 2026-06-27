// wc/lib/shell.js — sticky top nav, collapsing hero logo, theme toggle (dark/
// light, View-Transition flip, persisted), and a mobile hamburger → slide-in
// menu drawer (this is a website, not an app — no bottom tab bar). Shared
// across every page so the chrome is consistent and behavior isn't re-implemented.
//
// Call injectShell({ active, subtitle }) from a page bootstrap.

import * as api from './api.js';
import { flagSrc } from './flags.js';
import { resolveTeam } from './data.js';
import { icon } from './icons.js';

export const NAV_LINKS = [
  { key: 'fixtures', href: '/wc/fixtures', label: 'Fixtures', icon: 'calendar-days' },
  { key: 'groups',   href: '/wc/groups',   label: 'Groups',   icon: 'list-ordered' },
  { key: 'stakes',   href: '/wc/stakes',   label: 'Stakes',   icon: 'trending-up' },
  { key: 'bracket',  href: '/wc/bracket',  label: 'Bracket',  icon: 'git-fork' },
  { key: 'players',  href: '/wc/players',  label: 'Players',  icon: 'users' },
];

/* ── Theme (dark default; follows device when unset; persisted) ──────────── */
const THEME_KEY = 'wc-theme';
export function getTheme() {
  const a = document.documentElement.getAttribute('data-theme');
  if (a) return a;
  try { if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'; } catch {}
  return 'dark';
}
// Apply a theme for paint. Deliberately does NOT persist — calling this on every
// boot (applyTheme(getTheme())) would turn a transient device preference into a
// sticky stored choice. Persistence happens only in toggleTheme (user action).
export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('[data-theme-icon]').forEach((el) => {
    el.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', { size: 18 });
  });
  const lbl = document.querySelector('[data-theme-label]');
  if (lbl) lbl.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
}
function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  const run = () => applyTheme(next);
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(run);
  } else run();
}

export function injectShell({ active, subtitle }) {
  ensureShellCss();
  injectSpeculationRules();

  // Top sticky nav
  const nav = document.createElement('nav');
  nav.id = 'wc-nav';

  // Permanent left-hand logo (emblem + page name) — lives INSIDE the nav, top-
  // left, always. Clicking it scrolls back to the top. (No scroll animation: the
  // old collapsing-hero behaviour was removed.)
  const logo = document.createElement('button');
  logo.id = 'wc-hero-logo';
  logo.type = 'button';
  logo.setAttribute('aria-label', 'Top of page');
  logo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  logo.innerHTML = `
    <img class="wc-nav-emblem" src="/wc/assets/emblem.svg" alt="World Cup 26">
    <span class="wc-page-name">${subtitle || 'Match Tracker'}</span>`;
  nav.appendChild(logo);

  const wrap = document.createElement('div');
  wrap.id = 'wc-nav-buttons';

  // LIVE / NEXT countdown button (first)
  const liveBtn = document.createElement('a');
  liveBtn.className = 'wc-live-btn';
  liveBtn.href = '/wc/live';
  liveBtn.setAttribute('data-idle', '');
  liveBtn.setAttribute('aria-label', 'Live match');
  liveBtn.innerHTML = '<span class="wc-live-dot"></span><span class="wc-live-label">Live</span><span class="wc-live-flags" aria-hidden="true"></span><span class="wc-live-time"></span>';
  wrap.appendChild(liveBtn);

  // Desktop nav pills
  for (const link of NAV_LINKS) {
    const a = document.createElement('a');
    a.href = link.href;
    a.className = 'wc-nav-pill' + (link.key === active ? ' active' : '');
    a.textContent = link.label;
    wrap.appendChild(a);
  }

  // Info button (desktop)
  const info = document.createElement('a');
  info.className = 'wc-icon-btn wc-info-btn' + (active === 'info' ? ' active' : '');
  info.href = '/wc/info';
  info.setAttribute('aria-label', 'Data sources');
  info.setAttribute('title', 'Where this data comes from');
  info.innerHTML = icon('info', { size: 18 });
  wrap.appendChild(info);

  // Theme toggle (desktop)
  const theme = document.createElement('button');
  theme.type = 'button';
  theme.className = 'wc-icon-btn wc-theme-btn';
  theme.setAttribute('aria-label', 'Toggle light / dark theme');
  theme.setAttribute('data-theme-icon', '');
  theme.addEventListener('click', toggleTheme);
  wrap.appendChild(theme);

  // Hamburger (mobile)
  const ham = document.createElement('button');
  ham.type = 'button';
  ham.className = 'wc-icon-btn wc-menu-btn';
  ham.setAttribute('aria-label', 'Open menu');
  ham.setAttribute('aria-expanded', 'false');
  ham.innerHTML = icon('menu', { size: 20 });
  wrap.appendChild(ham);

  nav.appendChild(wrap);
  document.body.prepend(nav);
  wireLiveButton(liveBtn);

  // Spacer under the fixed nav so page content clears it. Height tracks the real
  // nav height (also published as --nav-h by setupScroll, for sticky sub-bars).
  const spacer = document.createElement('div');
  spacer.id = 'wc-nav-spacer';
  nav.after(spacer);

  // Background watermark
  const wm = document.createElement('img');
  wm.className = 'wc-watermark';
  wm.src = '/wc/assets/emblem-white.svg';
  wm.alt = '';
  wm.setAttribute('aria-hidden', 'true');
  document.body.prepend(wm);

  buildDrawer(active, ham);
  applyTheme(getTheme());
  setupScroll();
}

/* ── Mobile menu drawer ──────────────────────────────────────────────────── */
function buildDrawer(active, hamBtn) {
  const scrim = document.createElement('div');
  scrim.className = 'wc-scrim';
  const drawer = document.createElement('aside');
  drawer.className = 'wc-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Menu');
  drawer.setAttribute('aria-hidden', 'true');

  const items = [...NAV_LINKS,
    { key: 'live', href: '/wc/live', label: 'Live', icon: 'radio', live: true },
    { key: 'info', href: '/wc/info', label: 'Data sources', icon: 'info' },
  ];
  drawer.innerHTML = `
    <div class="wc-drawer-h">
      <b>World Cup 26</b>
      <button class="wc-icon-btn wc-drawer-close" aria-label="Close menu">${icon('x', { size: 18 })}</button>
    </div>
    <nav>${items.map((l) => `
      <a class="wc-drawer-item${l.key === active ? ' active' : ''}" href="${l.href}">
        ${icon(l.icon, { size: 20 })}<span>${l.label}</span>
        ${l.live ? '<span class="lp" data-drawer-live hidden><span class="d"></span><span data-drawer-live-n>1</span></span>' : ''}
      </a>`).join('')}</nav>
    <div class="wc-drawer-foot">
      <span class="lbl">Theme</span>
      <button class="wc-btn ghost wc-drawer-theme" type="button" data-theme-label>Light mode</button>
    </div>`;
  document.body.append(scrim, drawer);

  const open = () => {
    scrim.classList.add('open'); drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false'); hamBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('.wc-drawer-close')?.focus();
  };
  const close = () => {
    scrim.classList.remove('open'); drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true'); hamBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    hamBtn.focus();
  };
  hamBtn.addEventListener('click', open);
  scrim.addEventListener('click', close);
  drawer.querySelector('.wc-drawer-close')?.addEventListener('click', close);
  drawer.querySelector('.wc-drawer-theme')?.addEventListener('click', toggleTheme);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });
  // basic focus trap
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = drawer.querySelectorAll('a[href],button:not([disabled])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

// The nav is now a static, always-opaque bar with the logo permanently docked at
// its left (see shell.css) — there is NO collapse animation anymore. This only
// keeps --nav-h (and the spacer) in sync with the real nav height so sticky
// sub-bars (day-strip, bracket tabs, round headers) and the content offset stay
// correct across breakpoints. (revealVisible is separate and unchanged.)
export function setupScroll() {
  const nav = document.getElementById('wc-nav');
  const spacer = document.getElementById('wc-nav-spacer');
  if (!nav) return;
  const sync = () => {
    const h = nav.offsetHeight;
    document.documentElement.style.setProperty('--nav-h', h + 'px');
    if (spacer) spacer.style.height = h + 'px';
  };
  window.addEventListener('resize', sync, { passive: true });
  sync();
}

export const SHELL_CSS = '';
export function ensureShellCss() {
  if (document.querySelector('link[data-wc-shell-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/wc/lib/shell.css';
  l.setAttribute('data-wc-shell-css', '');
  document.head.appendChild(l);
}

const prefersReduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function revealVisible() {
  const els = document.querySelectorAll('[data-reveal]:not([data-seen])');
  if (!('IntersectionObserver' in window) || prefersReduced()) {
    els.forEach((el) => el.setAttribute('data-seen', ''));
    return;
  }
  const vh = window.innerHeight || 800;
  const obs = new IntersectionObserver((entries, o) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.remove('wc-pre');
        e.target.setAttribute('data-seen', '');
        o.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
  els.forEach((el) => {
    const top = el.getBoundingClientRect().top;
    if (top < vh * 0.92) el.setAttribute('data-seen', '');
    else { el.classList.add('wc-pre'); obs.observe(el); }
  });
}

// Standardized same-document transition (SWAP/PROMOTE). Wrap any in-page DOM
// replacement in this so every same-document content swap (tab/segment switch,
// day change, filter, live re-render, skeleton->content reveal) animates the
// SAME way -- a scoped cross-fade -- instead of snapping. Reduced-motion and
// unsupported browsers fall back to an instant synchronous update. Keep `update`
// minimal (DOM writes only); do heavy work before calling.
export function viewSwap(update) {
  if (typeof update !== 'function') return Promise.resolve();
  if (!document.startViewTransition || prefersReduced()) {
    try { update(); } catch (e) { console.error(e); }
    return Promise.resolve();
  }
  let vt;
  try { vt = document.startViewTransition(() => { update(); }); }
  catch (e) { try { update(); } catch (_) {} return Promise.resolve(); }
  vt.finished && vt.finished.catch(() => {});
  vt.ready && vt.ready.catch(() => {});
  return (vt.finished || Promise.resolve()).catch(() => {});
}

function injectSpeculationRules() {
  if (document.getElementById('wc-speculation-rules')) return;
  if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) return;
  const s = document.createElement('script');
  s.id = 'wc-speculation-rules';
  s.type = 'speculationrules';
  s.textContent = JSON.stringify({
    prefetch: [{ source: 'document', where: { href_matches: '/wc/*' }, eagerness: 'moderate' }],
  });
  document.head.appendChild(s);
}

if (typeof window !== 'undefined') {
  const swallowVT = (vt) => {
    if (!vt) return;
    vt.finished && vt.finished.catch(() => {});
    vt.ready && vt.ready.catch(() => {});
    vt.updateCallbackDone && vt.updateCallbackDone.catch(() => {});
  };
  if ('onpagereveal' in window) {
    window.addEventListener('pagereveal', (e) => {
      if (e && e.viewTransition) { document.documentElement.classList.add('wc-vt-in'); swallowVT(e.viewTransition); }
    });
  }
  if ('onpageswap' in window) {
    window.addEventListener('pageswap', (e) => { if (e) swallowVT(e.viewTransition); });
  }
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    if (r && r.name === 'AbortError' && /Transition was skipped/i.test(r.message || '')) e.preventDefault();
  });
}

async function wireLiveButton(btn) {
  const dot = btn.querySelector('.wc-live-dot');
  const label = btn.querySelector('.wc-live-label');
  const timeEl = btn.querySelector('.wc-live-time');
  const flagsEl = btn.querySelector('.wc-live-flags');
  if (!label || !timeEl) return;
  let matches = [];
  try { matches = await api.getMatches(); }
  catch { try { const d = await import('./data.js'); matches = await d.getMatchesSample(); } catch {} }

  let flagKey = null;
  async function setFlags(input) {
    if (!flagsEl) return;
    const list = (Array.isArray(input) ? input : [input]).filter(Boolean);
    const idOf = (m) => m.id ?? m.match_number ?? (m.home_team + '|' + m.away_team);
    const key = list.length ? list.map((m) => `${idOf(m)}:${m.status}`).join('~') : 'none';
    if (key === flagKey) return;
    flagKey = key;
    flagsEl.classList.toggle('has-multi', list.length > 1);
    if (!list.length) { flagsEl.innerHTML = ''; return; }
    const codeOf = async (nm, code) => code || (nm ? (await resolveTeam(nm).catch(() => null))?.fifa_code : null);
    const pairs = await Promise.all(list.map(async (m) => {
      const [hc, ac] = await Promise.all([codeOf(m.home_team, m.home_team_code), codeOf(m.away_team, m.away_team_code)]);
      return [hc, ac];
    }));
    if (key !== flagKey) return;
    const single = pairs.length === 1;
    const cell = (c) => { const s = c && flagSrc(c); return s ? `<img class="wc-live-flag" src="${s}" alt="${c}">` : (c ? `<span class="wc-live-code">${c}</span>` : ''); };
    const pair = ([hc, ac]) => (hc || ac) ? `<span class="wc-live-pair">${cell(hc)}${single ? '<span class="wc-live-v">v</span>' : ''}${cell(ac)}</span>` : '';
    flagsEl.innerHTML = pairs.map(pair).filter(Boolean).join('<span class="wc-live-sep" aria-hidden="true"></span>');
  }

  const ts = (m) => (m && m.kickoff_utc ? new Date(m.kickoff_utc).getTime() : 0);
  const fmt = (ms) => {
    if (ms <= 0) return 'Soon';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400),
          h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    return `${m}:${String(ss).padStart(2, '0')}`;
  };
  const drawerLive = document.querySelector('[data-drawer-live]');
  const drawerLiveN = document.querySelector('[data-drawer-live-n]');
  function render() {
    const now = Date.now();
    const liveMs = matches.filter((m) => m.status === 'live');
    if (drawerLive) {
      if (liveMs.length) { drawerLive.hidden = false; if (drawerLiveN) drawerLiveN.textContent = liveMs.length; }
      else drawerLive.hidden = true;
    }
    if (liveMs.length) {
      btn.setAttribute('data-live', ''); btn.removeAttribute('data-idle'); btn.removeAttribute('data-none');
      label.textContent = 'Live'; timeEl.textContent = '';
      setFlags(liveMs.slice(0, 2));
      return;
    }
    btn.removeAttribute('data-live');
    const next = matches.filter((m) => m.status === 'scheduled' && ts(m) > now).sort((a, b) => ts(a) - ts(b))[0];
    if (!next) {
      btn.setAttribute('data-none', ''); btn.removeAttribute('data-idle');
      label.textContent = 'Live'; timeEl.textContent = ''; setFlags(null);
      return;
    }
    btn.setAttribute('data-idle', ''); btn.removeAttribute('data-none');
    label.textContent = 'Next'; timeEl.textContent = fmt(ts(next) - now);
    setFlags(next);
  }
  render();
  try {
    window.__wcLiveNavDemo = (n = 2) => {
      const demo = [
        { id: 901, match_number: 53, status: 'live', home_team: 'Brazil', home_team_code: 'BRA', away_team: 'Argentina', away_team_code: 'ARG' },
        { id: 902, match_number: 54, status: 'live', home_team: 'France', home_team_code: 'FRA', away_team: 'Spain', away_team_code: 'ESP' },
      ].slice(0, n);
      if (!n) { api.getMatches().then((r) => { matches = r; render(); }).catch(() => {}); return; }
      matches = demo; render();
    };
  } catch {}
  let lastRefetch = Date.now();
  setInterval(async () => {
    render();
    const now = Date.now();
    const due = matches.some((m) => m.status === 'scheduled' && ts(m) && ts(m) <= now);
    const anyLive = matches.some((m) => m.status === 'live');
    if ((due || anyLive) && now - lastRefetch > 75000 && !document.hidden) {
      lastRefetch = now;
      try { matches = await api.getMatches(); render(); } catch {}
    }
  }, 1000);
}
