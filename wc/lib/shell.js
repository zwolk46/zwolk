// Sticky top nav + collapsing hero logo that shrinks into the navbar on scroll.
// Shared across all list pages (Fixtures / Groups / Bracket) so the look is
// consistent and the scroll behavior doesn't have to be reimplemented.
//
// Call setupShell({ active: 'fixtures' | 'groups' | 'bracket', subtitle: '…' })
// from a page's bootstrap. The page must have these elements present (they're
// injected by injectShell() below if you want zero-boilerplate).

import * as api from './api.js';
import { flagSrc } from './flags.js';
import { resolveTeam } from './data.js';

export const NAV_LINKS = [
  { key: 'fixtures', href: '/wc/fixtures', label: 'Fixtures' },
  { key: 'groups',   href: '/wc/groups',   label: 'Groups' },
  { key: 'bracket',  href: '/wc/bracket',  label: 'Bracket' },
  { key: 'players',  href: '/wc/players',  label: 'Players' },
];

export function injectShell({ active, subtitle, dark = true }) {
  ensureShellCss();          // guarantee the static theme/nav styles are present
  injectSpeculationRules();  // hover/idle prefetch the nav targets (instant nav)

  // Top sticky nav
  const nav = document.createElement('nav');
  nav.id = 'wc-nav';
  const wrap = document.createElement('div');
  wrap.id = 'wc-nav-buttons';
  // Distinct LIVE button: red + pulsing while a match is in play, otherwise a
  // muted pill counting down to the next kickoff. Links to the broadcast page.
  const liveBtn = document.createElement('a');
  liveBtn.className = 'wc-live-btn';
  liveBtn.href = '/wc/live';
  liveBtn.setAttribute('data-idle', '');
  liveBtn.setAttribute('aria-label', 'Live match');
  liveBtn.innerHTML = '<span class="wc-live-dot"></span><span class="wc-live-label">Live</span><span class="wc-live-flags" aria-hidden="true"></span><span class="wc-live-time"></span>';
  wrap.appendChild(liveBtn);
  for (const link of NAV_LINKS) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    if (link.key === active) a.classList.add('active');
    wrap.appendChild(a);
  }
  // Low-key but unmistakable "i" info button — links to the data-sources page.
  const info = document.createElement('a');
  info.className = 'wc-info-btn';
  info.href = '/wc/info';
  info.setAttribute('aria-label', 'Data sources');
  info.setAttribute('title', 'Where this data comes from');
  if (active === 'info') info.classList.add('active');
  info.innerHTML = '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.8" stroke="currentColor" stroke-width="1.7"/><path d="M8 7.1v3.7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.05" fill="currentColor"/></svg>';
  wrap.appendChild(info);
  nav.appendChild(wrap);
  document.body.prepend(nav);
  wireLiveButton(liveBtn);

  // Spacer under the fixed nav
  const spacer = document.createElement('div');
  spacer.style.height = '69px';
  nav.after(spacer);

  // Collapsing hero logo
  const logo = document.createElement('button');
  logo.id = 'wc-hero-logo';
  logo.type = 'button';
  logo.setAttribute('aria-label', 'Top of page');
  logo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  logo.innerHTML = `
    <img class="wc-nav-emblem" src="/wc/assets/emblem.svg" alt="World Cup 26">
    <span class="wc-page-name">${subtitle || 'Match Tracker'}</span>
    <span class="wc-nav-top-hint" aria-hidden="true">
      <svg width="33" height="33" viewBox="0 0 11 11" fill="none"><path d="M5.5 9V2M2.5 5L5.5 2L8.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </span>`;
  spacer.after(logo);

  // Background watermark emblem
  const wm = document.createElement('img');
  wm.className = 'wc-watermark';
  wm.src = '/wc/assets/emblem-white.svg';
  wm.alt = '';
  wm.setAttribute('aria-hidden', 'true');
  document.body.prepend(wm);

  setupScroll();
}

export function setupScroll() {
  const nav = document.getElementById('wc-nav');
  const logo = document.getElementById('wc-hero-logo');
  const btns = document.getElementById('wc-nav-buttons');
  if (!nav || !logo) return;
  const RANGE = 160, HT = 121, NT = 14, PAD = 28, MAX_W = 1240;
  // Where the hero logo sits when fully expanded: aligned to the main content's
  // left edge (centered container + padding). As it collapses into the nav it
  // slides to PAD — i.e. the screen's left corner.
  const contentLeft = () => Math.max(PAD, (window.innerWidth - MAX_W) / 2 + PAD);
  const upd = () => {
    const p = Math.min(1, Math.max(0, window.scrollY / RANGE));
    const cl = contentLeft();
    logo.style.left = (cl - p * (cl - PAD)).toFixed(1) + 'px';
    logo.style.top = (HT - p * (HT - NT)) + 'px';
    logo.style.transform = 'scale(' + (1 - p * 0.667).toFixed(3) + ')';
    nav.style.background = `rgba(10,14,12,${(p * 0.92).toFixed(3)})`;
    nav.style.backdropFilter = `blur(${(p * 14).toFixed(1)}px)`;
    nav.style.borderBottomColor = `rgba(28,36,31,${p.toFixed(3)})`;
    if (btns) {
      btns.style.transform = `scale(${(1 + (1 - p) * 0.28).toFixed(3)})`;
      btns.style.transformOrigin = 'right center';
    }
    // Publish the nav's real height so sticky sub-bars (e.g. the fixtures
    // filter row) can sit flush beneath it with no gap.
    document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
  };
  window.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd, { passive: true });
  upd();
}

// The shell's styles now live in the STATIC stylesheet wc/lib/shell.css, which
// every page links render-blocking in <head> so the theme + nav are painted on
// the first frame (no flash). SHELL_CSS is kept as an empty export only so any
// older importer (a page bootstrap, live-page.js) keeps working without a
// reference error — injecting an empty <style> is a harmless no-op.
export const SHELL_CSS = '';

// Insurance only: guarantee the static shell stylesheet is present. Pages link
// it in their <head> (the flash-free path); this fallback runs from JS (so it
// can flash) only if a page somehow shipped without the <link>.
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

// Scroll reveal — VT-safe and un-staggered.
//
// Old behaviour hid EVERY [data-reveal] element (opacity:0) and revealed them
// one-by-one with a stagger, which is exactly the "elements load at different
// times" jank we're killing. Now:
//   • content is visible by default (so it's fully present in the first paint
//     AND in the incoming view-transition snapshot — no fading into an empty
//     page);
//   • only elements that start BELOW the fold get pre-hidden (.wc-pre) and
//     animate up once, as they scroll into view.
// Above-the-fold content simply appears, carried in by the single unified
// page entrance (see shell.css → wc-page-in).
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
    if (top < vh * 0.92) {
      el.setAttribute('data-seen', '');   // in / near view: show now (unified)
    } else {
      el.classList.add('wc-pre');         // below fold: reveal on scroll
      obs.observe(el);
    }
  });
}

// Speculation Rules — prefetch the in-app destinations on hover / pointerdown
// so a click lands instantly, then the view transition animates. PREFETCH only
// (the HTML doc), never PRERENDER: prerender would execute page JS and could
// burn the wc2026api 500/day budget. Prefetch fires no API calls. Injected once.
function injectSpeculationRules() {
  if (document.getElementById('wc-speculation-rules')) return;
  if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) return;
  const s = document.createElement('script');
  s.id = 'wc-speculation-rules';
  s.type = 'speculationrules';
  s.textContent = JSON.stringify({
    prefetch: [{
      source: 'document',
      where: { href_matches: '/wc/*' },
      eagerness: 'moderate',
    }],
  });
  document.head.appendChild(s);
}

// View-transition coordination.
//  • pagereveal: when this page arrives via a cross-document view transition the
//    VT already does the motion, so suppress the cold-load page fade (wc-page-in)
//    to avoid a double animation. On a genuine cold load the event still fires
//    but `viewTransition` is null, so the fade runs.
//  • Swallow the benign "AbortError: Transition was skipped" the declarative VT
//    rejects with when a navigation interrupts an in-flight transition (rapid
//    clicks, a prefetched page committing, etc). It's harmless but otherwise
//    surfaces as an unhandled rejection in the console.
if (typeof window !== 'undefined') {
  const swallowVT = (vt) => {
    if (!vt) return;
    vt.finished && vt.finished.catch(() => {});
    vt.ready && vt.ready.catch(() => {});
    vt.updateCallbackDone && vt.updateCallbackDone.catch(() => {});
  };
  if ('onpagereveal' in window) {
    window.addEventListener('pagereveal', (e) => {
      if (e && e.viewTransition) {
        document.documentElement.classList.add('wc-vt-in');
        swallowVT(e.viewTransition);
      }
    });
  }
  if ('onpageswap' in window) {
    window.addEventListener('pageswap', (e) => { if (e) swallowVT(e.viewTransition); });
  }
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    if (r && r.name === 'AbortError' && /Transition was skipped/i.test(r.message || '')) {
      e.preventDefault();
    }
  });
}

// LIVE nav button. Red + pulsing during a live match, else a muted countdown to
// the next kickoff. The countdown ticks client-side (no network); we only re-hit
// the API once a kickoff has passed (throttled to 75s, paused when the tab is
// hidden) to catch the scheduled→live flip — staying well under the wc2026api
// daily budget. Falls back to the bundled schedule if the live call fails.
async function wireLiveButton(btn) {
  const dot = btn.querySelector('.wc-live-dot');
  const label = btn.querySelector('.wc-live-label');
  const timeEl = btn.querySelector('.wc-live-time');
  const flagsEl = btn.querySelector('.wc-live-flags');
  if (!label || !timeEl) return;
  let matches = [];
  try { matches = await api.getMatches(); }
  catch { try { const d = await import('./data.js'); matches = await d.getMatchesSample(); } catch {} }

  // Show the teams as [flag] v [flag] for the match(es) the button refers to.
  // Accepts ONE match (the next kickoff) or SEVERAL (every match in play right
  // now) — when two games overlap that's four flags, each matchup its own pair
  // with a hairline divider between them. Resolves team-name strings → FIFA codes
  // → local flag SVGs; re-renders only when the referenced set changes.
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
    if (key !== flagKey) return; // a newer set took over while we resolved
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
  function render() {
    const now = Date.now();
    const liveMs = matches.filter((m) => m.status === 'live');
    if (liveMs.length) {
      btn.setAttribute('data-live', ''); btn.removeAttribute('data-idle'); btn.removeAttribute('data-none');
      label.textContent = 'Live'; timeEl.textContent = '';
      setFlags(liveMs.slice(0, 2)); // up to two concurrent games → up to four flags
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
  // Dev/QA: preview the multi-game nav (four flags) without two real concurrent
  // games, e.g. window.__wcLiveNavDemo(2). Pass 0 to clear and re-fetch.
  try {
    window.__wcLiveNavDemo = (n = 2) => {
      const demo = [
        { id: 901, match_number: 53, status: 'live', home_team: 'Brazil', home_team_code: 'BRA', away_team: 'Argentina', away_team_code: 'ARG' },
        { id: 902, match_number: 54, status: 'live', home_team: 'France', home_team_code: 'FRA', away_team: 'Spain', away_team_code: 'ESP' },
        { id: 903, match_number: 55, status: 'live', home_team: 'England', home_team_code: 'ENG', away_team: 'Germany', away_team_code: 'GER' },
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
