// Sticky top nav + collapsing hero logo that shrinks into the navbar on scroll.
// Shared across all list pages (Fixtures / Groups / Bracket) so the look is
// consistent and the scroll behavior doesn't have to be reimplemented.
//
// Call setupShell({ active: 'fixtures' | 'groups' | 'bracket', subtitle: '…' })
// from a page's bootstrap. The page must have these elements present (they're
// injected by injectShell() below if you want zero-boilerplate).

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
  for (const link of NAV_LINKS) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    if (link.key === active) a.classList.add('active');
    wrap.appendChild(a);
  }
  nav.appendChild(wrap);
  document.body.prepend(nav);

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
