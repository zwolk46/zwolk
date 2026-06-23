// Sticky top nav + collapsing hero logo that shrinks into the navbar on scroll.
// Shared across all list pages (Fixtures / Groups / Bracket) so the look is
// consistent and the scroll behavior doesn't have to be reimplemented.
//
// Call setupShell({ active: 'fixtures' | 'groups' | 'bracket', subtitle: '…' })
// from a page's bootstrap. The page must have these elements present (they're
// injected by injectShell() below if you want zero-boilerplate).

import * as api from './api.js';

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
  liveBtn.innerHTML = '<span class="wc-live-dot"></span><span class="wc-live-label">Live</span><span class="wc-live-time"></span>';
  wrap.appendChild(liveBtn);
  for (const link of NAV_LINKS) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    if (link.key === active) a.classList.add('active');
    wrap.appendChild(a);
  }
  // Deliberately low-key "i" — there if you want to know where the data comes
  // from, easy to ignore if you don't.
  const info = document.createElement('a');
  info.className = 'wc-info-btn';
  info.href = '/wc/info';
  info.setAttribute('aria-label', 'Data sources');
  info.setAttribute('title', 'Where this data comes from');
  if (active === 'info') info.classList.add('active');
  info.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.6" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.1v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="5" r="0.95" fill="currentColor"/></svg>';
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

// View-transition coordination. When this page is arriving via a cross-document
// view transition, the VT already does the motion — so suppress the cold-load
// page fade (wc-page-in) to avoid a double animation. On a genuine cold load
// the event still fires but `viewTransition` is null, so the fade runs.
if (typeof window !== 'undefined' && 'onpagereveal' in window) {
  window.addEventListener('pagereveal', (e) => {
    if (e && e.viewTransition) document.documentElement.classList.add('wc-vt-in');
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
  if (!label || !timeEl) return;
  let matches = [];
  try { matches = await api.getMatches(); }
  catch { try { const d = await import('./data.js'); matches = await d.getMatchesSample(); } catch {} }

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
    if (matches.some((m) => m.status === 'live')) {
      btn.setAttribute('data-live', ''); btn.removeAttribute('data-idle'); btn.removeAttribute('data-none');
      label.textContent = 'Live'; timeEl.textContent = '';
      return;
    }
    btn.removeAttribute('data-live');
    const next = matches.filter((m) => m.status === 'scheduled' && ts(m) > now).sort((a, b) => ts(a) - ts(b))[0];
    if (!next) {
      btn.setAttribute('data-none', ''); btn.removeAttribute('data-idle');
      label.textContent = 'Live'; timeEl.textContent = '';
      return;
    }
    btn.setAttribute('data-idle', ''); btn.removeAttribute('data-none');
    label.textContent = 'Next'; timeEl.textContent = fmt(ts(next) - now);
  }
  render();
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
