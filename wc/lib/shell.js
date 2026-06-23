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

// CSS shared by the shell. Pages embed this once at <head> time.
export const SHELL_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#0a0e0c;color:#f4f2ea;font-family:Archivo,sans-serif;}
  body{--accent:#f5c712;--cardpad:16px 22px;min-height:100vh;overflow-x:hidden;position:relative;}
  ::selection{background:var(--accent);color:#0a0e0c}
  a{color:inherit;text-decoration:none}
  button{font:inherit;color:inherit}
  ::-webkit-scrollbar{width:11px;height:11px}
  ::-webkit-scrollbar-track{background:#0a0e0c}
  ::-webkit-scrollbar-thumb{background:#2a322c;border-radius:8px;border:2px solid #0a0e0c}
  ::-webkit-scrollbar-thumb:hover{background:var(--accent)}
  @keyframes wc-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
  @keyframes wc-spin{to{transform:rotate(360deg)}}
  @keyframes wc-nav-bob{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-6px) scale(1.06)}70%{transform:translateY(-2px) scale(1.02)}100%{transform:translateY(0) scale(1)}}
  @keyframes wc-grow-x{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
  @keyframes wc-reveal-up{0%{opacity:0;transform:translateY(28px)}100%{opacity:1;transform:none}}
  [data-reveal]{opacity:0;transform:translateY(28px);transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .62s cubic-bezier(.2,.95,.3,1.4),border-color .2s,box-shadow .25s;}
  [data-reveal][data-seen]{opacity:1;transform:none;}
  .wc-watermark{position:fixed;right:-140px;top:50%;transform:translateY(-50%);height:140vh;opacity:0.035;pointer-events:none;z-index:0;}
  #wc-nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:flex-end;gap:16px;padding:14px 28px;background:rgba(10,14,12,0);border-bottom:1px solid transparent;transition:background .12s ease-out,border-color .12s ease-out}
  #wc-nav-buttons{display:flex;gap:8px;font-family:Archivo;font-weight:800;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;transition:transform .12s ease-out;transform-origin:right center}
  #wc-nav-buttons a{padding:9px 16px;border-radius:999px;border:1px solid #242c25;background:#161c18;color:#cfd6cf}
  #wc-nav-buttons a.active{background:var(--accent);color:#0a0e0c;border-color:transparent}
  .wc-live-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:999px;border:1px solid #2c2622;background:#191513;color:#c9bdb8;text-decoration:none;font-family:Archivo;font-weight:800;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;transition:background .2s,border-color .2s,opacity .2s}
  .wc-live-btn .wc-live-dot{width:8px;height:8px;border-radius:50%;background:#7c8a7c;flex:none}
  .wc-live-btn .wc-live-time{font-family:JetBrains Mono,monospace;font-weight:700;font-size:11.5px;letter-spacing:0;color:#9aa7a0;font-variant-numeric:tabular-nums}
  .wc-live-btn .wc-live-time:empty{display:none}
  .wc-live-btn[data-idle]{opacity:0.92}
  .wc-live-btn[data-none]{opacity:0.4;pointer-events:none}
  .wc-live-btn[data-none] .wc-live-dot{background:#4a534a}
  .wc-live-btn[data-live]{background:#bc1530;border-color:#e8324c;color:#fff}
  .wc-live-btn[data-live] .wc-live-dot{background:#fff;animation:wc-live-blink 1s steps(1,start) infinite}
  @keyframes wc-live-pulse{0%{box-shadow:0 0 0 0 rgba(232,50,76,0.55)}70%{box-shadow:0 0 0 13px rgba(232,50,76,0)}100%{box-shadow:0 0 0 0 rgba(232,50,76,0)}}
  @keyframes wc-live-blink{0%,100%{opacity:1}50%{opacity:0.2}}
  .wc-info-btn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:1px solid #1c241e;background:transparent;color:#5d6a5b;opacity:0.72;transition:opacity .2s,color .2s,border-color .2s,background .2s}
  .wc-info-btn:hover{opacity:1;color:#cfd6cf;border-color:#2a352b;background:#161c18}
  .wc-info-btn.active{opacity:1;color:var(--accent);border-color:rgba(245,199,18,0.4)}
  #wc-hero-logo{position:fixed;top:121px;left:28px;z-index:51;display:flex;align-items:center;gap:28px;transform-origin:top left;cursor:pointer;transition:top .12s ease-out,transform .12s ease-out;background:none;border:none;padding:0}
  .wc-nav-emblem{height:120px;background:#f4f2ea;border-radius:20px;padding:14px 18px;flex:none}
  #wc-hero-logo .wc-page-name{font-family:Anton;font-size:clamp(34px,5vw,56px);letter-spacing:0.04em;text-transform:uppercase;color:var(--accent);line-height:0.95;white-space:nowrap}
  .wc-nav-top-hint{display:flex;align-items:center;justify-content:center;width:66px;height:66px;border-radius:50%;background:rgba(245,199,18,0.14);opacity:0;transform:translateY(9px);transition:opacity .25s,transform .28s;margin-left:12px;flex:none}
  @media (max-width:720px){
    #wc-hero-logo{gap:18px}
    #wc-hero-logo .wc-page-name{font-size:34px}
    .wc-nav-emblem{height:78px;padding:8px 12px;border-radius:14px}
  }
`;

export function revealVisible() {
  const els = document.querySelectorAll('[data-reveal]:not([data-seen])');
  let i = 0;
  for (const el of els) {
    setTimeout(() => el.setAttribute('data-seen', ''), Math.min(i * 25, 600));
    i++;
  }
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
