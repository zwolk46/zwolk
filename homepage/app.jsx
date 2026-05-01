// zwolk landing — main app
const { useState, useEffect, useRef, useMemo, useLayoutEffect } = React;

const STORAGE_KEY = 'zwolk:state:v2';
const ADMIN_PASSWORD = 'piano05player';

const THEME_COLORS = [
  { name: 'lime', value: 'oklch(72% 0.18 145)' },
  { name: 'sky', value: 'oklch(72% 0.16 230)' },
  { name: 'violet', value: 'oklch(68% 0.20 295)' },
  { name: 'amber', value: 'oklch(78% 0.16 75)' },
  { name: 'rose', value: 'oklch(70% 0.20 15)' },
  { name: 'mono', value: 'oklch(95% 0 0)' },
];

const CATEGORIES = ['time', 'money', 'language', 'thinking', 'utility', 'writing', 'design', 'dev', 'misc'];

function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return {}; return JSON.parse(raw); }
  catch { return {}; }
}
function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

const SearchSVG = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const ArrowSVG = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M5 8 L11 8 M8 5 L11 8 L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
// New pin: actual thumbtack — round head, narrow neck, sharp point, with a shadow tick
const PinSVG = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    {/* Head (top) */}
    <ellipse cx="8" cy="4.5" rx="4" ry="2.2"/>
    {/* Neck connecting head to body */}
    <path d="M5.5 5.5 L4 9 L12 9 L10.5 5.5"/>
    {/* Point */}
    <line x1="8" y1="9" x2="8" y2="14" strokeLinecap="round"/>
  </svg>
);
const HandleSVG = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
    <circle cx="2.5" cy="3" r="1"/><circle cx="7.5" cy="3" r="1"/>
    <circle cx="2.5" cy="7" r="1"/><circle cx="7.5" cy="7" r="1"/>
    <circle cx="2.5" cy="11" r="1"/><circle cx="7.5" cy="11" r="1"/>
  </svg>
);
const SunSVG = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="8" y1="1.5" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="14.5"/>
      <line x1="1.5" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="14.5" y2="8"/>
      <line x1="3.5" y1="3.5" x2="4.5" y2="4.5"/><line x1="11.5" y1="11.5" x2="12.5" y2="12.5"/>
      <line x1="3.5" y1="12.5" x2="4.5" y2="11.5"/><line x1="11.5" y1="4.5" x2="12.5" y2="3.5"/>
    </g>
  </svg>
);
const MoonSVG = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M13 9.5 A6 6 0 0 1 6.5 3 A6 6 0 1 0 13 9.5 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const ImageSVG = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <circle cx="6" cy="7" r="1.2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3 12 L6 9 L9 11 L13 7 L13 12 Z" fill="currentColor"/>
  </svg>
);
const CloseSVG = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const PlusSVG = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const LockSVG = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="3.5" y="7" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5.5 7 L5.5 5 Q5.5 2.5 8 2.5 Q10.5 2.5 10.5 5 L10.5 7" stroke="currentColor" strokeWidth="1.4" fill="none"/>
  </svg>
);

function Tile({ app, pinned, onTogglePin, onDragStart, onDragEnd, idx, customBg, onCustomBgClick, isDragging }) {
  const iconDef = window.ICON_BY_ID[app.iconId];
  const style = customBg
    ? { '--tile-bg': `url(${customBg})`, animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }
    : { animationDelay: `${Math.min(idx * 0.04, 0.4)}s` };

  return (
    <li
      className={`tile ${isDragging ? 'dragging' : ''}`}
      style={style}
      draggable
      data-has-bg={!!customBg}
      data-app-id={app.id}
      onDragStart={(e) => onDragStart(e, app.id)}
      onDragEnd={onDragEnd}
      onClick={(e) => { if (e.target.closest('.tile-actions') || e.target.closest('.tile-handle')) return; if (app.url) window.location.href = app.url; }}
    >
      <div className="tile-handle" aria-label="Drag to reorder">
        <HandleSVG />
      </div>
      {iconDef ? iconDef.render() : <div className="tile-icon" />}
      <div className="tile-body">
        <div className="tile-name">{app.name}</div>
        <div className="tile-desc">{app.desc}</div>
      </div>
      <div className="tile-meta">{app.meta}</div>
      <div className="tile-actions">
        <button className="tile-btn" aria-label="Set background" title="Set tile background"
          onClick={(e) => { e.stopPropagation(); onCustomBgClick(app.id, e); }}>
          <ImageSVG />
        </button>
        <button className={`tile-btn ${pinned ? 'pinned' : ''}`} aria-label={pinned ? 'Unpin' : 'Pin'} title={pinned ? 'Unpin' : 'Pin to top'}
          onClick={(e) => { e.stopPropagation(); onTogglePin(app.id); }}>
          <PinSVG filled={pinned} />
        </button>
      </div>
      <div className="tile-arrow"><ArrowSVG /></div>
    </li>
  );
}

// Icon picker for the Add App modal
function IconPicker({ value, onChange }) {
  const [activeCat, setActiveCat] = useState('all');
  const cats = useMemo(() => ['all', ...new Set(window.ICONS.map(i => i.category))], []);
  const visible = useMemo(() => activeCat === 'all' ? window.ICONS : window.ICONS.filter(i => i.category === activeCat), [activeCat]);

  return (
    <div className="icon-picker">
      <div className="icon-picker-cats">
        {cats.map(c => (
          <button key={c} type="button" className={`icon-picker-cat ${activeCat === c ? 'active' : ''}`} onClick={() => setActiveCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="icon-grid">
        {visible.map(icon => (
          <button key={icon.id} type="button"
            className={`icon-grid-item ${value === icon.id ? 'selected' : ''}`}
            onClick={() => onChange(icon.id)} title={icon.name}>
            {icon.render()}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddAppModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', desc: '', meta: 'utility', iconId: 'sparkle', url: '', bg: null });
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) setForm({ name: '', desc: '', meta: 'utility', iconId: 'sparkle', url: '', bg: null });
  }, [open]);

  if (!open) return null;

  const handleFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setForm(f => ({ ...f, bg: r.result }));
    r.readAsDataURL(file);
  };

  const submit = () => {
    if (!form.name.trim()) return;
    const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
    onAdd({
      id,
      name: form.name.trim(),
      desc: form.desc.trim() || 'A new tool',
      meta: form.meta,
      iconId: form.iconId,
      url: form.url.trim() || '',
      bg: form.bg,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add a new site</div>
          <button className="modal-close" onClick={onClose} title="Close"><CloseSVG /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">Name</label>
            <input type="text" placeholder="e.g. Word Counter" value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="field">
            <label className="field-label">Description</label>
            <input type="text" placeholder="One short line" value={form.desc}
              onChange={(e) => setForm(f => ({ ...f, desc: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field-label">Page URL</label>
            <input type="text" placeholder="e.g. /countdowns" value={form.url}
              onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field-label">Tag</label>
            <div className="icon-picker-cats" style={{ marginBottom: 0 }}>
              {CATEGORIES.map(c => (
                <button key={c} type="button" className={`icon-picker-cat ${form.meta === c ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, meta: c }))}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Animated icon</label>
            <IconPicker value={form.iconId} onChange={(id) => setForm(f => ({ ...f, iconId: id }))} />
          </div>
          <div className="field">
            <label className="field-label">Background image (optional)</label>
            {form.bg ? (
              <div className="file-drop has-file">
                <div className="file-drop-preview" style={{ backgroundImage: `url(${form.bg})` }}/>
                <span className="file-drop-name">Image attached</span>
                <button className="file-drop-clear" onClick={() => setForm(f => ({ ...f, bg: null }))}>Remove</button>
              </div>
            ) : (
              <div className="file-drop" onClick={() => fileRef.current?.click()}>
                Click to upload an image
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={onClose}>Cancel</button>
          <button className="ghost-btn primary" onClick={submit} disabled={!form.name.trim()}>
            Add tool
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminModal({ open, onClose, onSignIn, signedIn }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (open) { setPw(''); setErr(''); } }, [open]);
  if (!open) return null;

  const submit = () => {
    if (pw === ADMIN_PASSWORD) {
      onSignIn(true);
      onClose();
    } else {
      setErr('Incorrect password');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{signedIn ? 'Admin' : 'Sign in as admin'}</div>
          <button className="modal-close" onClick={onClose}><CloseSVG /></button>
        </div>
        <div className="modal-body">
          {signedIn ? (
            <div className="admin-form">
              <div className="helper">You're signed in as admin.</div>
              <button className="ghost-btn" onClick={() => { onSignIn(false); onClose(); }}>Sign out</button>
            </div>
          ) : (
            <div className="admin-form">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Password</label>
                <input type="password" autoFocus value={pw}
                  onChange={(e) => { setPw(e.target.value); setErr(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && submit()} />
              </div>
              {err && <div className="helper" style={{ color: 'oklch(70% 0.18 25)' }}>{err}</div>}
              <div className="helper">Demo: try “admin”.</div>
            </div>
          )}
        </div>
        {!signedIn && (
          <div className="modal-footer">
            <button className="ghost-btn" onClick={onClose}>Cancel</button>
            <button className="ghost-btn primary" onClick={submit}>Sign in</button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [tweaks, setTweak] = window.useTweaks({
    theme: 'dark',
    accent: 'lime',
  });
  const [state, setState] = useState(() => {
    const s = loadState();
    return {
      apps: s.apps || window.DEFAULT_APPS,
      pinned: s.pinned || [],
      order: s.order || (s.apps || window.DEFAULT_APPS).map(a => a.id),
      tileBgs: s.tileBgs || {},
      signedIn: s.signedIn || false,
    };
  });
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [bgMenu, setBgMenu] = useState(null);
  const [stuck, setStuck] = useState(false);
  const fileInputRef = useRef(null);
  const heroRef = useRef(null);
  const tilesRef = useRef(null);

  // Drag state
  const [dragId, setDragId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null); // index in unpinned list where the line is drawn
  const [dropY, setDropY] = useState(null);

  useEffect(() => { saveState(state); }, [state]);

  // Apply theme + accent
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    const accent = THEME_COLORS.find(c => c.name === tweaks.accent) || THEME_COLORS[0];
    document.documentElement.style.setProperty('--accent', accent.value);
    document.documentElement.style.setProperty('--accent-soft', accent.value.replace(')', ' / 0.14)'));
    document.documentElement.style.setProperty('--accent-glow', accent.value.replace(')', ' / 0.28)'));
  }, [tweaks.theme, tweaks.accent]);

  // Keyboard ⌘K
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search')?.focus();
      }
      if (e.key === 'Escape') {
        setShowAdd(false); setShowAdmin(false); setBgMenu(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Sticky logo: detect when hero is out of view
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      setStuck(!entry.isIntersecting);
    }, { threshold: 0, rootMargin: '-40px 0px 0px 0px' });
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  // Resolve apps
  const orderedApps = useMemo(() => {
    const byId = Object.fromEntries(state.apps.map(a => [a.id, a]));
    return state.order.map(id => byId[id]).filter(Boolean);
  }, [state.apps, state.order]);

  const filtered = useMemo(() => {
    if (!query.trim()) return orderedApps;
    const q = query.toLowerCase();
    return orderedApps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.desc.toLowerCase().includes(q) ||
      a.meta.toLowerCase().includes(q)
    );
  }, [orderedApps, query]);

  const pinnedSet = useMemo(() => new Set(state.pinned), [state.pinned]);
  const pinnedApps = filtered.filter(a => pinnedSet.has(a.id));
  const unpinnedApps = filtered.filter(a => !pinnedSet.has(a.id));

  const togglePin = (id) => {
    setState(s => ({ ...s, pinned: s.pinned.includes(id) ? s.pinned.filter(x => x !== id) : [...s.pinned, id] }));
  };

  // ─── Drag & drop with line indicator (Linear/Notion style) ───
  const handleDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragId(id);
  };
  const handleDragEnd = () => {
    setDragId(null);
    setDropIndex(null);
    setDropY(null);
  };
  const handleListDragOver = (e) => {
    if (!dragId) return;
    e.preventDefault();
    const list = tilesRef.current;
    if (!list) return;
    const tiles = Array.from(list.querySelectorAll('.tile'));
    if (tiles.length === 0) return;
    const listRect = list.getBoundingClientRect();
    const y = e.clientY;
    let insertIdx = tiles.length;
    for (let i = 0; i < tiles.length; i++) {
      const r = tiles[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { insertIdx = i; break; }
    }
    // Compute the y position for the line: above the tile at insertIdx, or below the last
    let lineY;
    if (insertIdx < tiles.length) {
      const r = tiles[insertIdx].getBoundingClientRect();
      lineY = r.top - listRect.top - 4; // sit halfway inside the 8px gap
    } else {
      const r = tiles[tiles.length - 1].getBoundingClientRect();
      lineY = r.bottom - listRect.top + 4;
    }
    setDropIndex(insertIdx);
    setDropY(lineY);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    if (!dragId || dropIndex == null) return handleDragEnd();
    setState(s => {
      const order = [...s.order];
      const fromIdx = order.indexOf(dragId);
      if (fromIdx === -1) return s;
      // Map dropIndex (in unpinned filtered list) → order position
      const targetApp = unpinnedApps[dropIndex];
      let insertAt;
      if (!targetApp) {
        insertAt = order.length;
      } else {
        insertAt = order.indexOf(targetApp.id);
      }
      order.splice(fromIdx, 1);
      if (fromIdx < insertAt) insertAt -= 1;
      // ensure not negative
      insertAt = Math.max(0, Math.min(insertAt, order.length));
      order.splice(insertAt, 0, dragId);
      return { ...s, order };
    });
    handleDragEnd();
  };

  // ─── Tile bg upload ───
  const handleCustomBgClick = (appId, evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    setBgMenu({ appId, x: rect.right - 180, y: rect.bottom + 6 });
  };
  const handleBgUpload = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !bgMenu) return;
    const r = new FileReader();
    r.onload = () => {
      setState(s => ({ ...s, tileBgs: { ...s.tileBgs, [bgMenu.appId]: r.result } }));
      setBgMenu(null);
    };
    r.readAsDataURL(file);
    e.target.value = '';
  };
  const handleBgRemove = () => {
    if (!bgMenu) return;
    setState(s => { const next = { ...s.tileBgs }; delete next[bgMenu.appId]; return { ...s, tileBgs: next }; });
    setBgMenu(null);
  };
  useEffect(() => {
    if (!bgMenu) return;
    const onClick = (e) => {
      if (!e.target.closest('.tile-bg-upload') && !e.target.closest('.tile-btn')) setBgMenu(null);
    };
    setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => document.removeEventListener('click', onClick);
  }, [bgMenu]);

  // ─── Add app ───
  const handleAddApp = (newApp) => {
    setState(s => ({
      ...s,
      apps: [...s.apps, { id: newApp.id, name: newApp.name, desc: newApp.desc, meta: newApp.meta, iconId: newApp.iconId }],
      order: [...s.order, newApp.id],
      tileBgs: newApp.bg ? { ...s.tileBgs, [newApp.id]: newApp.bg } : s.tileBgs,
    }));
  };

  const scrollToTop = (e) => {
    e?.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="grid-bg"></div>

      {/* Sticky top bar — appears when hero scrolls out */}
      <div className={`top-bar ${stuck ? 'is-stuck' : ''}`}>
        <a href="#" className="mini-wordmark" onClick={scrollToTop} aria-label="Back to top">
          zwolk<span className="dot"></span>
        </a>
        <div className="top-bar-right">
          <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTweak('theme', tweaks.theme === 'dark' ? 'light' : 'dark')}>
            {tweaks.theme === 'dark' ? <SunSVG /> : <MoonSVG />}
          </button>
        </div>
      </div>

      <div className="shell">
        <header className="header" ref={heroRef}>
          <div className="wordmark">
            zwolk<span className="dot"></span>
          </div>
          <div className="tagline">A directory of small, useful tools</div>
        </header>

        <div className="search-wrap">
          <span className="search-icon"><SearchSVG /></span>
          <input className="search" placeholder="Search tools…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="search-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
        </div>

        <div className="meta-row">
          <span className="count">
            <strong>{filtered.length}</strong> {filtered.length === 1 ? 'tool' : 'tools'}
            {query && ` matching "${query}"`}
          </span>
          {state.signedIn && (
            <button className="add-app" onClick={() => setShowAdd(true)} title="Add a new site to the directory">
              <PlusSVG /> Add site
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">No tools matched "{query}"</div>
        ) : (
          <>
            {pinnedApps.length > 0 && (
              <>
                <div className="section-label">Pinned</div>
                <ul className="tiles">
                  {pinnedApps.map((app, i) => (
                    <Tile key={app.id} app={app} pinned={true} idx={i}
                      onTogglePin={togglePin}
                      onDragStart={() => {}} onDragEnd={() => {}}
                      isDragging={false}
                      customBg={state.tileBgs[app.id]}
                      onCustomBgClick={handleCustomBgClick} />
                  ))}
                </ul>
                <div className="section-label">All tools</div>
              </>
            )}
            <ul className="tiles" ref={tilesRef}
                onDragOver={handleListDragOver}
                onDrop={handleDrop}
                onDragLeave={(e) => {
                  // only clear if leaving the list entirely
                  if (!e.currentTarget.contains(e.relatedTarget)) { setDropIndex(null); setDropY(null); }
                }}>
              {unpinnedApps.map((app, i) => (
                <Tile key={app.id} app={app} pinned={false} idx={i}
                  onTogglePin={togglePin}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={dragId === app.id}
                  customBg={state.tileBgs[app.id]}
                  onCustomBgClick={handleCustomBgClick} />
              ))}
              {dragId && dropY != null && (
                <div className="drop-line" style={{ top: dropY }} />
              )}
            </ul>
          </>
        )}

        <footer className="footer">
          <span>© 2026 zwolk</span>
          <a href="#" className="admin-link" onClick={(e) => { e.preventDefault(); setShowAdmin(true); }}>
            <LockSVG />
            {state.signedIn ? 'Admin' : 'Sign in as admin'}
          </a>
        </footer>
      </div>

      {bgMenu && (
        <div className="tile-bg-upload" style={{ left: bgMenu.x, top: bgMenu.y }}>
          <button onClick={handleBgUpload}>Upload image…</button>
          {state.tileBgs[bgMenu.appId] && (
            <button className="danger" onClick={handleBgRemove}>Remove background</button>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      <AddAppModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAddApp} />
      <AdminModal open={showAdmin} onClose={() => setShowAdmin(false)} signedIn={state.signedIn}
        onSignIn={(v) => setState(s => ({ ...s, signedIn: v }))} />

      <window.TweaksPanel>
        <window.TweakSection label="Appearance">
          <window.TweakRadio label="Theme" value={tweaks.theme}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
            onChange={(v) => setTweak('theme', v)} />
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)', marginBottom: 8 }}>
              Accent color
            </div>
            <div className="tweak-color-row">
              {THEME_COLORS.map(c => (
                <button key={c.name} className={`color-chip ${tweaks.accent === c.name ? 'active' : ''}`}
                  style={{ background: c.value }} onClick={() => setTweak('accent', c.name)} title={c.name} />
              ))}
            </div>
          </div>
        </window.TweakSection>

        <window.TweakSection label="Customization">
          <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.5 }}>
            <div style={{ marginBottom: 6 }}>• <strong>Pin</strong> — hover any tile, click the pin icon</div>
            <div style={{ marginBottom: 6 }}>• <strong>Reorder</strong> — drag any tile</div>
            <div style={{ marginBottom: 6 }}>• <strong>Backgrounds</strong> — hover, click image icon</div>
            <div>• <strong>Add tool</strong> — sign in as admin first</div>
          </div>
          <window.TweakButton label="Reset everything" onClick={() => {
            if (confirm('Reset all customization? This restores default tools and clears pins/backgrounds.')) {
              setState({ apps: window.DEFAULT_APPS, pinned: [], order: window.DEFAULT_APPS.map(a => a.id), tileBgs: {}, signedIn: false });
            }
          }} />
        </window.TweakSection>
      </window.TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
