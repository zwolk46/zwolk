// zwolk landing — main app
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Per-browser viewing preferences (theme, accent, etc.) — not per-account.
const PREFS_KEY = 'zwolk:prefs:v1';
// Per-account cosmetic storage that's too heavy for KV (data-URL tile backgrounds).
const TILE_BGS_KEY = (role) => `zwolk:tileBgs:${role}`;

const THEME_COLORS = [
  { name: 'lime', value: 'oklch(72% 0.18 145)' },
  { name: 'sky', value: 'oklch(72% 0.16 230)' },
  { name: 'violet', value: 'oklch(68% 0.20 295)' },
  { name: 'amber', value: 'oklch(78% 0.16 75)' },
  { name: 'rose', value: 'oklch(70% 0.20 15)' },
  { name: 'mono', value: 'oklch(95% 0 0)' },
];

const CATEGORIES = ['time', 'money', 'language', 'thinking', 'utility', 'writing', 'design', 'dev', 'misc'];

function loadPrefs() {
  try { const raw = localStorage.getItem(PREFS_KEY); if (!raw) return {}; return JSON.parse(raw); }
  catch { return {}; }
}
function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {} }

function loadTileBgs(role) {
  if (!role) return {};
  try { const raw = localStorage.getItem(TILE_BGS_KEY(role)); if (!raw) return {}; return JSON.parse(raw); }
  catch { return {}; }
}
function saveTileBgs(role, bgs) {
  if (!role) return;
  try { localStorage.setItem(TILE_BGS_KEY(role), JSON.stringify(bgs)); } catch {}
}

// ─── Inline SVGs ─────────────────────────────────────────
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
const PinSVG = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M5.1 2.6 H10.9 L10 6.5 L12.8 9.3 H3.2 L6 6.5 Z"
      fill={filled ? 'currentColor' : 'none'}
    />
    <line x1="8" y1="9.3" x2="8" y2="14"/>
    <line x1="6.7" y1="14" x2="9.3" y2="14"/>
  </svg>
);
const TrashSVG = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 4.5 H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M6.2 4.5 V3.2 H9.8 V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.5 6 L5.1 13 H10.9 L11.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <line x1="7" y1="7.5" x2="7.3" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="9" y1="7.5" x2="8.7" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
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
const LockSVG = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3.5" y="7" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5.5 7 L5.5 5 Q5.5 2.5 8 2.5 Q10.5 2.5 10.5 5 L10.5 7" stroke="currentColor" strokeWidth="1.4" fill="none"/>
  </svg>
);
const UnlockSVG = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3.5" y="7" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5.5 7 L5.5 5 Q5.5 2.5 8 2.5 Q10.5 2.5 10.5 5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
  </svg>
);
const ChevronSVG = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2.5 4 L5 6.5 L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Tile ────────────────────────────────────────────────
function Tile({ app, pinned, locked, onClick, onTogglePin, onDelete, onDragStart, onDragEnd, idx, customBg, onCustomBgClick, isDragging }) {
  const iconDef = window.ICON_BY_ID[app.iconId];
  const style = customBg
    ? { '--tile-bg': `url(${customBg})`, animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }
    : { animationDelay: `${Math.min(idx * 0.04, 0.4)}s` };

  return (
    <li
      className={`tile ${isDragging ? 'dragging' : ''} ${locked ? 'locked' : ''}`}
      style={style}
      draggable={!locked}
      data-has-bg={!!customBg}
      data-app-id={app.id}
      onDragStart={(e) => !locked && onDragStart(e, app.id)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (e.target.closest('.tile-actions') || e.target.closest('.tile-handle')) return;
        onClick(app);
      }}
    >
      {!locked && (
        <div className="tile-handle" aria-label="Drag to reorder">
          <HandleSVG />
        </div>
      )}
      {iconDef ? iconDef.render() : <div className="tile-icon" />}
      <div className="tile-body">
        <div className="tile-name">{app.name}</div>
        <div className="tile-desc">{app.desc}</div>
      </div>
      <div className="tile-meta">{app.meta}</div>
      {!locked && (
        <div className="tile-actions">
          <button className="tile-btn" aria-label="Set background" title="Set tile background"
            onClick={(e) => { e.stopPropagation(); onCustomBgClick(app.id, e); }}>
            <ImageSVG />
          </button>
          <button className={`tile-btn ${pinned ? 'pinned' : ''}`} aria-label={pinned ? 'Unpin' : 'Pin'} title={pinned ? 'Unpin' : 'Pin to top'}
            onClick={(e) => { e.stopPropagation(); onTogglePin(app.id); }}>
            <PinSVG filled={pinned} />
          </button>
          <button className="tile-btn danger" aria-label={`Delete ${app.name}`} title="Delete tool"
            onClick={(e) => { e.stopPropagation(); onDelete(app); }}>
            <TrashSVG />
          </button>
        </div>
      )}
      {locked ? (
        <div className="tile-lock" aria-hidden="true"><LockSVG size={14} /></div>
      ) : (
        <div className="tile-arrow"><ArrowSVG /></div>
      )}
    </li>
  );
}

// ─── Add app modal ───────────────────────────────────────
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
  const [form, setForm] = useState({ name: '', desc: '', meta: 'utility', iconId: 'sparkle', bg: null, url: '' });
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) setForm({ name: '', desc: '', meta: 'utility', iconId: 'sparkle', bg: null, url: '' });
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
      bg: form.bg,
      url: form.url.trim() || null,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add a new tool</div>
          <button className="modal-close" onClick={onClose}><CloseSVG /></button>
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
            <label className="field-label">Link (optional)</label>
            <input type="text" placeholder="https://… or /path" value={form.url}
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

// ─── Sign-in modal ───────────────────────────────────────
function SignInModal({ open, currentRole, intent, onClose, onSignedIn }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPw(''); setErr(''); setBusy(false);
      // Focus the field after the modal mounts.
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.role) {
        onSignedIn(data.role);
      } else {
        setErr(data.error || 'Wrong password');
        setBusy(false);
        // Re-select for quick retry.
        setTimeout(() => inputRef.current?.select(), 0);
      }
    } catch {
      setErr('Network error');
      setBusy(false);
    }
  };

  const title = intent?.type === 'switch' ? 'Switch account'
    : currentRole ? 'Sign in'
    : 'Sign in to continue';
  const subtitle = intent?.type === 'navigate' && intent.appName
    ? `Sign in to open ${intent.appName}.`
    : intent?.type === 'action'
    ? 'Sign in to make changes to your workspace.'
    : intent?.type === 'switch'
    ? 'Enter the other account’s password to switch.'
    : 'Public access opens the shared workspace. Admin access opens the private one.';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal signin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}><CloseSVG /></button>
        </div>
        <div className="modal-body">
          <p className="signin-subtitle">{subtitle}</p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="signin-pw">Password</label>
            <input
              id="signin-pw"
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={pw}
              disabled={busy}
              onChange={(e) => { setPw(e.target.value); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <div className={`signin-error ${err ? 'visible' : ''}`}>{err || ' '}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="ghost-btn primary" onClick={submit} disabled={!pw || busy}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Account chip in top bar ─────────────────────────────
function AccountChip({ role, onSignIn, onSwitch, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!role) {
    return (
      <button className="account-chip signed-out" onClick={onSignIn} aria-label="Sign in">
        <LockSVG size={12} />
        <span>Sign in</span>
      </button>
    );
  }

  const label = role === 'admin' ? 'admin' : 'public';
  return (
    <div className="account-wrap" ref={ref}>
      <button
        className={`account-chip signed-in role-${role} ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UnlockSVG size={12} />
        <span className="account-role">{label}</span>
        <span className="account-chev"><ChevronSVG /></span>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-header">Signed in as <strong>{label}</strong></div>
          <button role="menuitem" onClick={() => { setOpen(false); onSwitch(); }}>
            <LockSVG size={12} /> Switch account…
          </button>
          <button role="menuitem" className="danger" onClick={() => { setOpen(false); onSignOut(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main app ────────────────────────────────────────────
function App() {
  // Per-browser viewing prefs — theme/accent. useTweaks does not persist on its
  // own (it postMessages to an editor host), so we hydrate from / save to
  // localStorage ourselves below.
  const initialPrefs = useMemo(() => {
    const stored = loadPrefs();
    return { theme: stored.theme || 'dark', accent: stored.accent || 'lime' };
  }, []);
  const [tweaks, setTweak] = window.useTweaks(initialPrefs);
  useEffect(() => { savePrefs({ theme: tweaks.theme, accent: tweaks.accent }); }, [tweaks.theme, tweaks.accent]);

  // Auth + per-account state.
  const [auth, setAuth] = useState({ ready: false, role: null });
  const [serverState, setServerState] = useState({ customApps: [], pinned: [], order: [], removedDefaults: [] });
  const [tileBgs, setTileBgs] = useState({});

  // UI state.
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [signin, setSignin] = useState({ open: false, intent: null });
  const [bgMenu, setBgMenu] = useState(null);
  const [stuck, setStuck] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const heroRef = useRef(null);
  const tilesRef = useRef(null);

  // Drag state.
  const [dragId, setDragId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [dropY, setDropY] = useState(null);

  // ── Auth bootstrap ──
  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setAuth({ ready: true, role: data.role || null });
      return data.role || null;
    } catch {
      setAuth({ ready: true, role: null });
      return null;
    }
  }, []);

  useEffect(() => { refreshAuth(); }, [refreshAuth]);

  // ── Load server-stored homepage state when role becomes known ──
  useEffect(() => {
    let cancelled = false;
    if (!auth.ready) return;
    if (!auth.role) {
      setServerState({ customApps: [], pinned: [], order: [], removedDefaults: [] });
      setTileBgs({});
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/homepage-state', { cache: 'no-store' });
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setServerState({
          customApps: Array.isArray(data.state?.customApps) ? data.state.customApps : [],
          pinned: Array.isArray(data.state?.pinned) ? data.state.pinned : [],
          order: Array.isArray(data.state?.order) ? data.state.order : [],
          removedDefaults: Array.isArray(data.state?.removedDefaults) ? data.state.removedDefaults : [],
        });
      } catch (err) {
        if (!cancelled) {
          console.warn('Could not load homepage state:', err);
          setServerState({ customApps: [], pinned: [], order: [], removedDefaults: [] });
        }
      }
      if (!cancelled) setTileBgs(loadTileBgs(auth.role));
    })();
    return () => { cancelled = true; };
  }, [auth.ready, auth.role]);

  // ── Persist server state (debounced) ──
  const saveTimer = useRef(null);
  const persistServer = useCallback((next) => {
    if (!auth.role) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/homepage-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: next }),
      }).catch(err => console.warn('Could not save homepage state:', err));
    }, 250);
  }, [auth.role]);

  const updateServer = useCallback((updater) => {
    setServerState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistServer(next);
      return next;
    });
  }, [persistServer]);

  // ── Persist tile bgs to localStorage scoped to role ──
  useEffect(() => {
    if (auth.role) saveTileBgs(auth.role, tileBgs);
  }, [auth.role, tileBgs]);

  // ── Theme + accent ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    const accent = THEME_COLORS.find(c => c.name === tweaks.accent) || THEME_COLORS[0];
    document.documentElement.style.setProperty('--accent', accent.value);
    document.documentElement.style.setProperty('--accent-soft', accent.value.replace(')', ' / 0.14)'));
    document.documentElement.style.setProperty('--accent-glow', accent.value.replace(')', ' / 0.28)'));
  }, [tweaks.theme, tweaks.accent]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search')?.focus();
      }
      if (e.key === 'Escape') {
        setShowAdd(false); setBgMenu(null); setSignin(s => s.open ? { ...s, open: false } : s);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── Hero out-of-view detection ──
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      setStuck(!entry.isIntersecting);
    }, { threshold: 0, rootMargin: '-40px 0px 0px 0px' });
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Toast helper ──
  const flashToast = useCallback((message) => {
    setToast({ message, id: Date.now() });
    setTimeout(() => setToast(t => (t && t.message === message ? null : t)), 2400);
  }, []);

  // ── Resolve full app list ──
  const allApps = useMemo(() => {
    const removed = new Set(serverState.removedDefaults);
    const defaults = window.DEFAULT_APPS.filter(a => {
      if (removed.has(a.id)) return false;
      if (Array.isArray(a.roles) && !a.roles.includes(auth.role)) return false;
      return true;
    });
    return [...defaults, ...serverState.customApps];
  }, [serverState.customApps, serverState.removedDefaults, auth.role]);

  const orderedApps = useMemo(() => {
    const byId = Object.fromEntries(allApps.map(a => [a.id, a]));
    const seen = new Set();
    const out = [];
    for (const id of serverState.order) {
      if (byId[id] && !seen.has(id)) { out.push(byId[id]); seen.add(id); }
    }
    for (const app of allApps) {
      if (!seen.has(app.id)) { out.push(app); seen.add(app.id); }
    }
    return out;
  }, [allApps, serverState.order]);

  const filtered = useMemo(() => {
    if (!query.trim()) return orderedApps;
    const q = query.toLowerCase();
    return orderedApps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.desc.toLowerCase().includes(q) ||
      a.meta.toLowerCase().includes(q)
    );
  }, [orderedApps, query]);

  const pinnedSet = useMemo(() => new Set(serverState.pinned), [serverState.pinned]);
  const pinnedApps = filtered.filter(a => pinnedSet.has(a.id));
  const unpinnedApps = filtered.filter(a => !pinnedSet.has(a.id));
  const locked = !auth.role;

  // ── Sign-in flow ──
  const requireAuth = useCallback((intent) => {
    if (auth.role) return true;
    setSignin({ open: true, intent });
    return false;
  }, [auth.role]);

  const handleSignedIn = useCallback(async (newRole) => {
    const intent = signin.intent;
    setSignin({ open: false, intent: null });
    setAuth({ ready: true, role: newRole });
    flashToast(`Signed in as ${newRole}`);
    if (!intent) return;
    if (intent.type === 'navigate' && intent.url) {
      // Brief delay so the user sees the toast before navigating.
      setTimeout(() => { window.location.href = intent.url; }, 350);
    }
  }, [signin.intent, flashToast]);

  const handleSignOut = useCallback(async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch {}
    setAuth({ ready: true, role: null });
    setServerState({ customApps: [], pinned: [], order: [], removedDefaults: [] });
    setTileBgs({});
    flashToast('Signed out');
  }, [flashToast]);

  // ── Tile interactions ──
  const handleTileClick = useCallback((app) => {
    if (!app.url) return;
    if (auth.role) {
      window.location.href = app.url;
    } else {
      setSignin({ open: true, intent: { type: 'navigate', url: app.url, appName: app.name } });
    }
  }, [auth.role]);

  const togglePin = useCallback((id) => {
    if (!requireAuth({ type: 'action' })) return;
    updateServer(s => ({
      ...s,
      pinned: s.pinned.includes(id) ? s.pinned.filter(x => x !== id) : [...s.pinned, id],
    }));
  }, [requireAuth, updateServer]);

  const deleteTool = useCallback((app) => {
    if (!requireAuth({ type: 'action' })) return;
    if (!confirm(`Delete ${app.name} from this workspace?`)) return;

    const isDefault = window.DEFAULT_APPS.some(defaultApp => defaultApp.id === app.id);
    updateServer(s => ({
      ...s,
      customApps: s.customApps.filter(customApp => customApp.id !== app.id),
      removedDefaults: isDefault && !s.removedDefaults.includes(app.id)
        ? [...s.removedDefaults, app.id]
        : s.removedDefaults,
      pinned: s.pinned.filter(id => id !== app.id),
      order: s.order.filter(id => id !== app.id),
    }));
    setTileBgs(prev => {
      if (!prev[app.id]) return prev;
      const next = { ...prev };
      delete next[app.id];
      return next;
    });
    flashToast(`${app.name} deleted`);
  }, [requireAuth, updateServer, flashToast]);

  // ── Drag & drop ──
  const handleDragStart = (e, id) => {
    if (!auth.role) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragId(id);
  };
  const handleDragEnd = () => {
    setDragId(null); setDropIndex(null); setDropY(null);
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
    let lineY;
    if (insertIdx < tiles.length) {
      const r = tiles[insertIdx].getBoundingClientRect();
      lineY = r.top - listRect.top - 4;
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
    updateServer(s => {
      // Build canonical full order from current state.
      const fullOrder = orderedApps.map(a => a.id);
      const fromIdx = fullOrder.indexOf(dragId);
      if (fromIdx === -1) return s;
      const targetApp = unpinnedApps[dropIndex];
      let insertAt;
      if (!targetApp) {
        insertAt = fullOrder.length;
      } else {
        insertAt = fullOrder.indexOf(targetApp.id);
      }
      fullOrder.splice(fromIdx, 1);
      if (fromIdx < insertAt) insertAt -= 1;
      insertAt = Math.max(0, Math.min(insertAt, fullOrder.length));
      fullOrder.splice(insertAt, 0, dragId);
      return { ...s, order: fullOrder };
    });
    handleDragEnd();
  };

  // ── Tile bg upload ──
  const handleCustomBgClick = (appId, evt) => {
    if (!requireAuth({ type: 'action' })) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    setBgMenu({ appId, x: rect.right - 180, y: rect.bottom + 6 });
  };
  const handleBgUpload = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !bgMenu) return;
    const r = new FileReader();
    r.onload = () => {
      setTileBgs(prev => ({ ...prev, [bgMenu.appId]: r.result }));
      setBgMenu(null);
    };
    r.readAsDataURL(file);
    e.target.value = '';
  };
  const handleBgRemove = () => {
    if (!bgMenu) return;
    setTileBgs(prev => { const next = { ...prev }; delete next[bgMenu.appId]; return next; });
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

  // ── Add app ──
  const handleAddApp = (newApp) => {
    if (!requireAuth({ type: 'action' })) return;
    const customApp = {
      id: newApp.id,
      name: newApp.name,
      desc: newApp.desc,
      meta: newApp.meta,
      iconId: newApp.iconId,
    };
    if (newApp.url) customApp.url = newApp.url;
    updateServer(s => ({
      ...s,
      customApps: [...s.customApps, customApp],
      order: [...s.order, newApp.id],
    }));
    if (newApp.bg) setTileBgs(prev => ({ ...prev, [newApp.id]: newApp.bg }));
  };

  const scrollToTop = (e) => {
    e?.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="grid-bg"></div>

      {/* Sticky top bar — always visible */}
      <div className={`top-bar ${stuck ? 'is-stuck' : ''}`}>
        <a href="#" className="mini-wordmark" onClick={scrollToTop} aria-label="Back to top">
          zwolk<span className="dot"></span>
        </a>
        <div className="top-bar-right">
          <AccountChip
            role={auth.ready ? auth.role : null}
            onSignIn={() => setSignin({ open: true, intent: null })}
            onSwitch={() => setSignin({ open: true, intent: { type: 'switch' } })}
            onSignOut={handleSignOut}
          />
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
          {auth.role && (
            <button className="add-app" onClick={() => setShowAdd(true)}>
              <PlusSVG /> Add tool
            </button>
          )}
        </div>

        {locked && auth.ready && (
          <div className="locked-banner" role="note">
            <LockSVG size={14} />
            <span>Sign in to open any tool. Public access is shared; admin access is private.</span>
            <button className="ghost-btn primary" onClick={() => setSignin({ open: true, intent: null })}>
              Sign in
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty">No tools matched "{query}"</div>
        ) : (
          <>
            {pinnedApps.length > 0 && (
              <>
                <div className="section-label">Pinned</div>
                <ul className="tiles">
                  {pinnedApps.map((app, i) => (
                    <Tile key={app.id} app={app} pinned={true} idx={i} locked={locked}
                      onClick={handleTileClick}
                      onTogglePin={togglePin}
                      onDelete={deleteTool}
                      onDragStart={() => {}} onDragEnd={() => {}}
                      isDragging={false}
                      customBg={tileBgs[app.id]}
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
                  if (!e.currentTarget.contains(e.relatedTarget)) { setDropIndex(null); setDropY(null); }
                }}>
              {unpinnedApps.map((app, i) => (
                <Tile key={app.id} app={app} pinned={false} idx={i} locked={locked}
                  onClick={handleTileClick}
                  onTogglePin={togglePin}
                  onDelete={deleteTool}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={dragId === app.id}
                  customBg={tileBgs[app.id]}
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
          <span className="footer-status">
            {auth.ready && (auth.role
              ? <>Signed in as <strong>{auth.role}</strong></>
              : <>Not signed in</>)}
          </span>
        </footer>
      </div>

      {bgMenu && (
        <div className="tile-bg-upload" style={{ left: bgMenu.x, top: bgMenu.y }}>
          <button onClick={handleBgUpload}>Upload image…</button>
          {tileBgs[bgMenu.appId] && (
            <button className="danger" onClick={handleBgRemove}>Remove background</button>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      <AddAppModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAddApp} />
      <SignInModal
        open={signin.open}
        currentRole={auth.role}
        intent={signin.intent}
        onClose={() => setSignin({ open: false, intent: null })}
        onSignedIn={handleSignedIn}
      />

      {toast && (
        <div className="signin-toast" key={toast.id}>{toast.message}</div>
      )}

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
            <div style={{ marginBottom: 6 }}>• <strong>Delete</strong> — hover, click trash icon</div>
            <div>• <strong>Add tool</strong> — sign in first</div>
          </div>
          {auth.role && (
            <window.TweakButton label="Reset workspace" onClick={() => {
              if (!confirm('Reset this account\'s tool order, pins, custom tools, and tile backgrounds?')) return;
              updateServer({ customApps: [], pinned: [], order: [], removedDefaults: [] });
              setTileBgs({});
            }} />
          )}
        </window.TweakSection>
      </window.TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
