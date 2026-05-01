// Icon library — reusable animated SVG icons users can pick from when adding apps.
// Each entry: { id, name, category, render: () => <Icon>...</Icon> }
// All icons hook into the .tile:hover CSS pattern via shared classes.

const Icon = ({ children, cls = '' }) => (
  <div className={`tile-icon ${cls}`} aria-hidden="true">
    <svg viewBox="0 0 40 40" fill="none">{children}</svg>
  </div>
);

const ICONS = [
  // ─── Time ────────────────────────────────────────────
  { id: 'clock', name: 'Clock', category: 'time', render: () => (
    <Icon cls="ico-clock">
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5"/>
      <path className="arc" d="M20 6 A14 14 0 0 1 34 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="20" x2="20" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="hand-min"/>
      <line x1="20" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="hand-sec"/>
      <circle cx="20" cy="20" r="1.4" fill="currentColor"/>
    </Icon>
  )},
  { id: 'hourglass', name: 'Hourglass', category: 'time', render: () => (
    <Icon cls="ico-hourglass">
      <path d="M11 8 L29 8 L29 12 L20 20 L29 28 L29 32 L11 32 L11 28 L20 20 L11 12 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M14 11 L26 11 L20 17 Z" fill="currentColor" className="hg-top"/>
      <path d="M14 29 L26 29 L20 23 Z" fill="currentColor" className="hg-bot"/>
    </Icon>
  )},
  { id: 'tomato', name: 'Tomato', category: 'time', render: () => (
    <Icon cls="ico-tomato">
      <circle cx="20" cy="22" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M20 22 L20 12 A10 10 0 0 1 28.66 17 Z" fill="currentColor" className="pom-slice"/>
      <path d="M16 12 Q20 9 24 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </Icon>
  )},
  { id: 'stopwatch', name: 'Stopwatch', category: 'time', render: () => (
    <Icon cls="ico-stopwatch">
      <circle cx="20" cy="22" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="17" y1="8" x2="23" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="8" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="20" y1="22" x2="20" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="sw-hand"/>
    </Icon>
  )},

  // ─── Money ───────────────────────────────────────────
  { id: 'coins', name: 'Stacked coins', category: 'money', render: () => (
    <Icon cls="ico-coins">
      <ellipse cx="20" cy="30" rx="11" ry="2.4" stroke="currentColor" strokeWidth="1.5" className="coin coin-3"/>
      <ellipse cx="20" cy="24" rx="11" ry="2.4" stroke="currentColor" strokeWidth="1.5" className="coin coin-2"/>
      <ellipse cx="20" cy="18" rx="11" ry="2.4" stroke="currentColor" strokeWidth="1.5" className="coin coin-1"/>
      <line x1="9" y1="18" x2="9" y2="30" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="31" y1="18" x2="31" y2="30" stroke="currentColor" strokeWidth="1.5"/>
      <text x="20" y="15" textAnchor="middle" fontSize="6" fill="currentColor" fontFamily="ui-monospace, monospace" className="wage-num">$</text>
    </Icon>
  )},
  { id: 'wallet', name: 'Wallet', category: 'money', render: () => (
    <Icon cls="ico-wallet">
      <rect x="8" y="13" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="27" cy="21" r="1.6" fill="currentColor" className="wal-dot"/>
    </Icon>
  )},
  { id: 'chart-up', name: 'Chart up', category: 'money', render: () => (
    <Icon cls="ico-chartup">
      <path d="M9 28 L16 21 L21 24 L31 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="ch-line"/>
      <path d="M27 12 L31 12 L31 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </Icon>
  )},

  // ─── Language ────────────────────────────────────────
  { id: 'eth', name: 'Eth (ð) — voiced theta', category: 'language', render: () => (
    <Icon cls="ico-eth">
      <path d="M11 10 L8 10 L8 30 L11 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M29 10 L32 10 L32 30 L29 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <g className="eth-glyph" style={{transformOrigin: '20px 20px'}}>
        {/* Eth letter: oval body with crossed stem at top */}
        <path className="eth-body"
          d="M14 22 Q14 14 20 14 Q26 14 26 22 Q26 30 20 30 Q14 30 14 22 Z"
          stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
        <path className="eth-stem"
          d="M16 16 L24 11"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path className="eth-cross"
          d="M19 12 L21 17"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </g>
    </Icon>
  )},
  { id: 'speech', name: 'Speech bubble', category: 'language', render: () => (
    <Icon cls="ico-speech">
      <path d="M10 12 Q10 9 13 9 L27 9 Q30 9 30 12 L30 22 Q30 25 27 25 L19 25 L14 30 L14 25 L13 25 Q10 25 10 22 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="16" cy="17" r="1.2" fill="currentColor" className="sp-dot sp-dot-1"/>
      <circle cx="20" cy="17" r="1.2" fill="currentColor" className="sp-dot sp-dot-2"/>
      <circle cx="24" cy="17" r="1.2" fill="currentColor" className="sp-dot sp-dot-3"/>
    </Icon>
  )},
  { id: 'globe', name: 'Globe', category: 'language', render: () => (
    <Icon cls="ico-globe">
      <circle cx="20" cy="20" r="11" stroke="currentColor" strokeWidth="1.5"/>
      <ellipse cx="20" cy="20" rx="5" ry="11" stroke="currentColor" strokeWidth="1.5" className="globe-meridian"/>
      <line x1="9" y1="20" x2="31" y2="20" stroke="currentColor" strokeWidth="1.5"/>
    </Icon>
  )},

  // ─── Thinking / structure ────────────────────────────
  { id: 'graph', name: 'Argument graph', category: 'thinking', render: () => (
    <Icon cls="ico-graph">
      <line x1="20" y1="11" x2="11" y2="22" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" className="edge edge-1"/>
      <line x1="20" y1="11" x2="29" y2="22" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" className="edge edge-2"/>
      <line x1="11" y1="22" x2="20" y2="31" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" className="edge edge-3"/>
      <line x1="29" y1="22" x2="20" y2="31" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" className="edge edge-4"/>
      <circle cx="20" cy="11" r="3" fill="currentColor" className="node node-top"/>
      <circle cx="11" cy="22" r="3" fill="currentColor" className="node node-l"/>
      <circle cx="29" cy="22" r="3" fill="currentColor" className="node node-r"/>
      <circle cx="20" cy="31" r="3" fill="currentColor" className="node node-bot"/>
    </Icon>
  )},
  { id: 'brain', name: 'Brain', category: 'thinking', render: () => (
    <Icon cls="ico-brain">
      <path d="M14 12 Q10 12 10 16 Q8 18 10 21 Q8 24 11 26 Q12 30 16 29 L16 12 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M26 12 Q30 12 30 16 Q32 18 30 21 Q32 24 29 26 Q28 30 24 29 L24 12 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="20" y1="12" x2="20" y2="29" stroke="currentColor" strokeWidth="1.5" className="brain-mid"/>
    </Icon>
  )},
  { id: 'tree', name: 'Tree', category: 'thinking', render: () => (
    <Icon cls="ico-tree">
      <line x1="20" y1="10" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="20" y1="20" x2="12" y2="28" stroke="currentColor" strokeWidth="1.5" className="tree-l"/>
      <line x1="20" y1="20" x2="28" y2="28" stroke="currentColor" strokeWidth="1.5" className="tree-r"/>
      <circle cx="20" cy="10" r="2.5" fill="currentColor"/>
      <circle cx="12" cy="29" r="2.5" fill="currentColor" className="tree-leaf-l"/>
      <circle cx="28" cy="29" r="2.5" fill="currentColor" className="tree-leaf-r"/>
    </Icon>
  )},

  // ─── Utility ─────────────────────────────────────────
  { id: 'arrows', name: 'Convert arrows', category: 'utility', render: () => (
    <Icon cls="ico-arrows">
      <g className="omni-rot" style={{transformOrigin: '20px 20px'}}>
        <path d="M10 16 L30 16 M26 12 L30 16 L26 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M30 24 L10 24 M14 20 L10 24 L14 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </Icon>
  )},
  { id: 'cipher', name: 'Cipher wheel', category: 'utility', render: () => (
    <Icon cls="ico-cipher">
      <circle cx="20" cy="20" r="11" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5"/>
      <circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="1.5" className="cipher-inner"/>
      <text x="20" y="13" textAnchor="middle" fontSize="5" fill="currentColor" fontFamily="ui-monospace, monospace" className="cipher-letter">A</text>
      <text x="20" y="32" textAnchor="middle" fontSize="5" fill="currentColor" fontFamily="ui-monospace, monospace" className="cipher-letter cipher-letter-2">N</text>
    </Icon>
  )},
  { id: 'key', name: 'Key', category: 'utility', render: () => (
    <Icon cls="ico-key">
      <circle cx="14" cy="20" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="19" y1="20" x2="32" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="27" y1="20" x2="27" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="31" y1="20" x2="31" y2="25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </Icon>
  )},
  { id: 'compass', name: 'Compass', category: 'utility', render: () => (
    <Icon cls="ico-compass">
      <circle cx="20" cy="20" r="11" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M20 12 L23 20 L20 28 L17 20 Z" fill="currentColor" className="comp-needle" style={{transformOrigin: '20px 20px'}}/>
    </Icon>
  )},

  // ─── Writing ─────────────────────────────────────────
  { id: 'pencil-lines', name: 'Pencil & lines', category: 'writing', render: () => (
    <Icon cls="ico-pencil-lines">
      <line x1="10" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="md-line md-line-1"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="md-line md-line-2"/>
      <line x1="10" y1="26" x2="28" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="md-line md-line-3"/>
      <path d="M28 28 L32 24 L34 26 L30 30 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" className="md-pencil"/>
    </Icon>
  )},
  { id: 'bars', name: 'Bar chart', category: 'writing', render: () => (
    <Icon cls="ico-bars">
      <rect x="10" y="22" width="4" height="8" stroke="currentColor" strokeWidth="1.5" className="bar bar-1"/>
      <rect x="16" y="18" width="4" height="12" stroke="currentColor" strokeWidth="1.5" className="bar bar-2"/>
      <rect x="22" y="14" width="4" height="16" stroke="currentColor" strokeWidth="1.5" className="bar bar-3"/>
      <rect x="28" y="10" width="4" height="20" stroke="currentColor" strokeWidth="1.5" className="bar bar-4"/>
    </Icon>
  )},
  { id: 'doc', name: 'Document', category: 'writing', render: () => (
    <Icon cls="ico-doc">
      <path d="M12 8 L24 8 L30 14 L30 32 L12 32 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M24 8 L24 14 L30 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="15" y1="20" x2="27" y2="20" stroke="currentColor" strokeWidth="1.2" className="doc-line doc-line-1"/>
      <line x1="15" y1="24" x2="25" y2="24" stroke="currentColor" strokeWidth="1.2" className="doc-line doc-line-2"/>
      <line x1="15" y1="28" x2="27" y2="28" stroke="currentColor" strokeWidth="1.2" className="doc-line doc-line-3"/>
    </Icon>
  )},

  // ─── Design ──────────────────────────────────────────
  { id: 'swatches', name: 'Swatches', category: 'design', render: () => (
    <Icon cls="ico-swatches">
      <rect x="9" y="13" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" className="sw sw-1"/>
      <rect x="16" y="13" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" className="sw sw-2"/>
      <rect x="23" y="13" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" className="sw sw-3"/>
    </Icon>
  )},
  { id: 'palette', name: 'Palette', category: 'design', render: () => (
    <Icon cls="ico-palette">
      <path d="M20 8 Q31 8 31 19 Q31 24 26 24 Q22 24 22 27 Q22 30 18 30 Q9 30 9 20 Q9 8 20 8 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="14" cy="16" r="1.5" fill="currentColor" className="pal-dot pal-dot-1"/>
      <circle cx="20" cy="13" r="1.5" fill="currentColor" className="pal-dot pal-dot-2"/>
      <circle cx="25" cy="16" r="1.5" fill="currentColor" className="pal-dot pal-dot-3"/>
    </Icon>
  )},
  { id: 'eyedropper', name: 'Eyedropper', category: 'design', render: () => (
    <Icon cls="ico-eyedropper">
      <path d="M22 8 L26 12 L20 18 L16 14 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="16" y1="14" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="eye-tube"/>
      <circle cx="11" cy="29" r="2.5" fill="currentColor" className="eye-drop"/>
    </Icon>
  )},

  // ─── Dev ─────────────────────────────────────────────
  { id: 'regex', name: 'Regex', category: 'dev', render: () => (
    <Icon cls="ico-regex">
      <text x="9" y="26" fontSize="16" fill="currentColor" fontFamily="ui-monospace, monospace">/.*/</text>
      <circle cx="28" cy="24" r="5" stroke="currentColor" strokeWidth="1.5" className="regex-lens"/>
      <line x1="32" y1="28" x2="35" y2="31" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="regex-handle"/>
    </Icon>
  )},
  { id: 'braces', name: 'Braces { }', category: 'dev', render: () => (
    <Icon cls="ico-braces">
      <path d="M14 10 Q10 10 10 14 L10 18 Q10 20 8 20 Q10 20 10 22 L10 26 Q10 30 14 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M26 10 Q30 10 30 14 L30 18 Q30 20 32 20 Q30 20 30 22 L30 26 Q30 30 26 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="17" cy="20" r="1.4" fill="currentColor" className="json-dot json-dot-1"/>
      <circle cx="20" cy="20" r="1.4" fill="currentColor" className="json-dot json-dot-2"/>
      <circle cx="23" cy="20" r="1.4" fill="currentColor" className="json-dot json-dot-3"/>
    </Icon>
  )},
  { id: 'terminal', name: 'Terminal', category: 'dev', render: () => (
    <Icon cls="ico-terminal">
      <rect x="8" y="10" width="24" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M13 17 L17 20 L13 23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="term-caret"/>
      <line x1="20" y1="23" x2="27" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="term-line"/>
    </Icon>
  )},
  { id: 'git', name: 'Git branch', category: 'dev', render: () => (
    <Icon cls="ico-git">
      <line x1="14" y1="12" x2="14" y2="28" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M14 18 Q14 22 18 22 L22 22 Q26 22 26 26" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <circle cx="14" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14" cy="29" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="26" cy="27" r="2.5" stroke="currentColor" strokeWidth="1.5" className="git-merge"/>
    </Icon>
  )},

  // ─── Misc ────────────────────────────────────────────
  { id: 'sparkle', name: 'Sparkle', category: 'misc', render: () => (
    <Icon cls="ico-sparkle">
      <path d="M20 8 L22 18 L32 20 L22 22 L20 32 L18 22 L8 20 L18 18 Z" fill="currentColor" className="spark-main" style={{transformOrigin: '20px 20px'}}/>
    </Icon>
  )},
  { id: 'heart', name: 'Heart', category: 'misc', render: () => (
    <Icon cls="ico-heart">
      <path d="M20 30 Q9 22 9 15 Q9 10 14 10 Q18 10 20 14 Q22 10 26 10 Q31 10 31 15 Q31 22 20 30 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="heart-shape"/>
    </Icon>
  )},
  { id: 'bolt', name: 'Bolt', category: 'misc', render: () => (
    <Icon cls="ico-bolt">
      <path d="M22 8 L12 22 L19 22 L18 32 L28 18 L21 18 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="bolt-shape"/>
    </Icon>
  )},
  { id: 'leaf', name: 'Leaf', category: 'misc', render: () => (
    <Icon cls="ico-leaf">
      <path d="M10 30 Q10 14 30 10 Q26 30 10 30 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="leaf-shape"/>
      <line x1="10" y1="30" x2="22" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </Icon>
  )},
  { id: 'star', name: 'Star', category: 'misc', render: () => (
    <Icon cls="ico-star">
      <path d="M20 8 L23 17 L32 17 L25 22 L28 31 L20 26 L12 31 L15 22 L8 17 L17 17 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="star-shape" style={{transformOrigin: '20px 20px'}}/>
    </Icon>
  )},
  { id: 'cube', name: 'Cube', category: 'misc', render: () => (
    <Icon cls="ico-cube">
      <path d="M20 8 L31 14 L31 26 L20 32 L9 26 L9 14 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M20 8 L20 20 L31 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="cube-edge"/>
      <path d="M20 20 L9 14 M20 20 L20 32" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </Icon>
  )},
  { id: 'wave', name: 'Wave', category: 'misc', render: () => (
    <Icon cls="ico-wave">
      <path d="M8 20 Q12 12 16 20 T24 20 T32 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="wave-path"/>
    </Icon>
  )},
];

const ICON_BY_ID = Object.fromEntries(ICONS.map(i => [i.id, i]));

window.ICONS = ICONS;
window.ICON_BY_ID = ICON_BY_ID;
