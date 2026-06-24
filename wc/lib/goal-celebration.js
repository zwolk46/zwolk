// /wc/lib/goal-celebration.js
//
// Full-screen, broadcast-style GOAL celebration — a faithful vanilla-JS port of
// the claudesign "GOAL Option D — Real Flag Tiles" design component. It fires the
// moment a goal is scored and re-themes its ENTIRE palette (banner, confetti,
// glitter, cannons, fireworks, fluid background) to the scoring team's national
// flag.
//
// Everything is driven by the scoring side:
//   • iso        — ISO-2 flag code (e.g. 'br', 'gb-eng'); drives colors + banner
//   • teamName   — shown big above GOAL!  (e.g. "BRAZIL")
//   • playerName — the scorer, shown under GOAL!
//   • minute     — match minute, appended as  ·  NN'
//
// Public API:
//   playGoalCelebration({ iso, teamName, playerName, minute, speed })
//   dismissGoalCelebration()
//
// The overlay mounts to <body> (independent of the live page's own re-renders),
// is pointer-events:none except the Dismiss button, and stays up until dismissed
// (cinematic speed 0.3 by default — the design's shipped pacing).
//
// Flag SVGs are reused from /wc/flags/<iso>.svg (same flag-icons set the design
// used). The recolorable cannon art is bundled at /wc/assets/goal-cannon.svg.

const CANNON_URL = '/wc/assets/goal-cannon.svg';
const FLAG_DIR = '/wc/flags/';

// Per-flag palettes (2–4 hex), keyed by ISO-2 code — verbatim from the design.
const COLORS = {
  dz:['#006233','#d21034','#ffffff'], ar:['#74acdf','#f6b40e','#ffffff'], au:['#012169','#e4002b','#ffffff'],
  at:['#ed2939','#ffffff'], be:['#fae042','#ed2939','#1a1a1a'], ba:['#002395','#fecb00','#ffffff'],
  br:['#009c3b','#ffdf00','#3a52d4'], ca:['#ff2233','#ffffff'], cv:['#003893','#cf2027','#f7d116','#ffffff'],
  co:['#fcd116','#1652c0','#ce1126'], ci:['#f77f00','#009e60','#ffffff'], hr:['#ff2233','#1c63d8','#ffffff'],
  cw:['#1145d6','#f9d90f','#ffffff'], cz:['#1b66d6','#d7141a','#ffffff'], cd:['#1aa0ff','#f7d518','#ce1021'],
  ec:['#ffdd00','#0a64d4','#ed1c24'], eg:['#ce1126','#ffffff','#1c1c1c','#c9a227'], es:['#c60b1e','#ffc400'],
  'gb-eng':['#ce1124','#ffffff','#2a6fdb'], fr:['#2356d8','#ed2939','#ffffff'], de:['#1a1a1a','#dd0000','#ffce00'],
  gh:['#ce1126','#fcd116','#11a35a','#1a1a1a'], ht:['#1530c4','#d21034','#ffffff'], ir:['#23bf50','#ff2233','#ffffff'],
  iq:['#ce1126','#ffffff','#1a1a1a','#11a35a'], jp:['#ff2244','#ffffff'], jo:['#1a1a1a','#ffffff','#11a35a','#ce1126'],
  mx:['#1a9c63','#ce1126','#ffffff'], ma:['#e23741','#11a35a'], nl:['#ff3b46','#3a6bd8','#ffffff'],
  nz:['#2353c4','#cc142b','#ffffff'], no:['#e2253f','#3a6bd8','#ffffff'], pa:['#e22044','#2370d8','#ffffff'],
  py:['#e2352b','#1a64e0','#ffffff'], pt:['#11a35a','#ff2233','#ffdd33'], qa:['#a4234a','#ffffff'],
  sa:['#11a35a','#ffffff'], 'gb-sct':['#1f7fd6','#ffffff'], sn:['#11a35a','#fdef42','#e31b23'],
  za:['#1aa35a','#ffb915','#de3831','#2356d8'], kr:['#e2374a','#1f63d6','#ffffff'], se:['#1f80d6','#ffd000'],
  ch:['#e2253f','#ffffff'], tn:['#ff1a2e','#ffffff'], tr:['#ff1a28','#ffffff'],
  uy:['#1f63d6','#fcd116','#ffffff'], us:['#3a52d4','#e2253f','#ffffff'], uz:['#15b5d6','#1eb53a','#ce1126','#ffffff']
};

// Proportional area per flag color — biases confetti/glitter toward the dominant.
const WEIGHTS = {
  dz:[0.45,0.13,0.42], ar:[0.63,0.05,0.32], au:[0.68,0.15,0.17],
  at:[0.67,0.33], be:[0.33,0.33,0.34], ba:[0.60,0.22,0.18],
  br:[0.58,0.26,0.16], ca:[0.48,0.52], cv:[0.54,0.15,0.10,0.21],
  co:[0.50,0.25,0.25], ci:[0.33,0.33,0.34], hr:[0.33,0.33,0.34],
  cw:[0.72,0.12,0.16], cz:[0.30,0.36,0.34], cd:[0.45,0.22,0.33],
  ec:[0.50,0.25,0.25], eg:[0.31,0.31,0.31,0.07], es:[0.50,0.50],
  'gb-eng':[0.22,0.73,0.05], fr:[0.33,0.33,0.34], de:[0.33,0.33,0.34],
  gh:[0.31,0.31,0.31,0.07], ht:[0.46,0.46,0.08], ir:[0.33,0.33,0.34], iq:[0.30,0.30,0.30,0.10], jp:[0.20,0.80], jo:[0.28,0.28,0.28,0.16],
  mx:[0.33,0.33,0.34], ma:[0.88,0.12], nl:[0.33,0.33,0.34],
  nz:[0.65,0.18,0.17], no:[0.55,0.20,0.25], pa:[0.25,0.25,0.50],
  py:[0.33,0.33,0.34], pt:[0.34,0.58,0.08], qa:[0.75,0.25],
  sa:[0.78,0.22], 'gb-sct':[0.60,0.40], sn:[0.35,0.32,0.33],
  za:[0.28,0.18,0.26,0.28], kr:[0.18,0.18,0.64], se:[0.66,0.34],
  ch:[0.72,0.28], tn:[0.68,0.32], tr:[0.68,0.32],
  uy:[0.20,0.07,0.73], us:[0.20,0.42,0.38], uz:[0.32,0.32,0.10,0.26]
};

const FALLBACK_COLORS = ['#ffffff', '#ff4d4d', '#4d8bff'];

// ── one-time CSS (keyframes) injection ───────────────────────────────────────
const STYLE_ID = 'wc-goalceleb-css';
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const css = `
@keyframes gcspot{from{opacity:0;transform:translate(-50%,-50%) scale(.65);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
@keyframes gcbar{0%{transform:rotate(var(--bar)) scaleX(0);}100%{transform:rotate(var(--bar)) scaleX(1);}}
@keyframes gcbarscroll{from{transform:translateX(0);}to{transform:translateX(calc(-1 * var(--barTile)));}}
@keyframes gcstamp{0%{opacity:0;letter-spacing:.42em;transform:scale(1.55) skewX(-14deg);filter:blur(18px);text-shadow:none;}40%{opacity:1;letter-spacing:-.025em;transform:scale(.92) skewX(1.5deg);filter:blur(0);text-shadow:0 0 calc(52px*var(--glow)) rgba(255,255,255,calc(.85*var(--glow))),0 12px 52px rgba(0,0,0,.9);}58%{transform:scale(1.045) skewX(0);}74%{transform:scale(.99);}100%{opacity:1;letter-spacing:-.01em;transform:scale(1) skewX(0);filter:blur(0);text-shadow:0 0 calc(30px*var(--glow)) rgba(255,255,255,calc(.45*var(--glow))),0 10px 50px rgba(0,0,0,.85);}}
@keyframes gcglow{0%,100%{transform:scale(1);text-shadow:0 0 calc(30px*var(--glow)) rgba(255,255,255,calc(.45*var(--glow))),0 10px 50px rgba(0,0,0,.85);}50%{transform:scale(1.016);text-shadow:0 0 calc(70px*var(--glow)) rgba(255,255,255,calc(.92*var(--glow))),0 10px 50px rgba(0,0,0,.85);}}
@keyframes gcwipe{0%{transform:scaleX(0);}100%{transform:scaleX(1);}}
@keyframes gcsub{from{opacity:0;transform:translateY(28px);letter-spacing:12px;}to{opacity:1;transform:translateY(0);letter-spacing:4px;}}
@keyframes gcflash{0%{opacity:0;}14%{opacity:.85;}100%{opacity:0;}}
@keyframes gcdimfade{from{opacity:0;}to{opacity:1;}}
@keyframes gcflash2{0%{opacity:0;}18%{opacity:.42;}100%{opacity:0;}}
@keyframes gcshake{0%{transform:translate(0,0) scale(1);}10%{transform:translate(-10px,7px) scale(1.045);}20%{transform:translate(9px,-8px) scale(1.045);}30%{transform:translate(-11px,-4px) scale(1.05);}40%{transform:translate(8px,8px) scale(1.04);}52%{transform:translate(-6px,4px) scale(1.03);}66%{transform:translate(5px,-3px) scale(1.02);}80%{transform:translate(-2px,2px) scale(1.01);}100%{transform:translate(0,0) scale(1);}}
@keyframes gcshock{0%{opacity:0;transform:translate(-50%,-50%) scale(.04);}9%{opacity:.6;}100%{opacity:0;transform:translate(-50%,-50%) scale(1);}}
@keyframes gcrays{0%{transform:translate(-50%,-50%) rotate(0deg);}100%{transform:translate(-50%,-50%) rotate(360deg);}}
@keyframes gcraysin{from{opacity:0;}to{opacity:1;}}
@keyframes gccannonin{0%{opacity:0;transform:translateY(60%) scale(.88);}100%{opacity:1;transform:translateY(0) scale(1);}}
@keyframes gccannoninR{0%{opacity:0;transform:translateY(60%) scaleX(-1) scale(.88);}100%{opacity:1;transform:translateY(0) scaleX(-1);}}`;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = css;
  document.head.appendChild(st);
}

// Lazily load Inter (team line + Dismiss button) — scoped to this feature, only
// fetched the first time a celebration plays; never blocks the live page.
function ensureInter() {
  if (document.getElementById('wc-goalceleb-font')) return;
  const l = document.createElement('link');
  l.id = 'wc-goalceleb-font';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;800&display=swap';
  document.head.appendChild(l);
}

// ── WebGL flag-fluid background (port of "Flag Fluid.dc.html") ────────────────
class FlagFluid {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.colors = opts.colors;
    this.weights = opts.weights;
    this.seedStr = opts.seedStr || 'fluid';
    this._t0 = performance.now();
    this._raf = null;
  }
  hexToRgb(h) {
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  buildPalette() {
    let f;
    const pc = this.colors, pw = this.weights;
    if (Array.isArray(pc) && pc.length) {
      f = pc.slice(0, 6).map((hex, i) => [hex, (Array.isArray(pw) && pw[i] != null) ? pw[i] : 1]);
    } else { f = [['#0055A4', 1], ['#FFFFFF', 1], ['#EF4135', 1]]; }
    const tot = f.reduce((s, c) => s + c[1], 0) || 1;
    const flat = new Float32Array(18), stops = new Float32Array(6);
    let acc = 0, last = [1, 1, 1];
    for (let i = 0; i < 6; i++) {
      if (i < f.length) { last = this.hexToRgb(f[i][0]); acc += f[i][1] / tot; } else { acc = 1; }
      flat[i * 3] = last[0]; flat[i * 3 + 1] = last[1]; flat[i * 3 + 2] = last[2];
      stops[i] = Math.min(1, acc);
    }
    return { flat, stops, count: Math.min(6, f.length) };
  }
  seedFor(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return [(h % 9973) / 9973 * 60 - 30, ((h >>> 11) % 9973) / 9973 * 60 - 30];
  }
  _compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  mount() {
    const canvas = this.canvas;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) { console.warn('[goal-celebration] WebGL unavailable — skipping fluid background'); return false; }
    this.gl = gl;
    const vs = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos,0.0,1.0); }';
    const fs = [
      'precision highp float;',
      'uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;',
      'uniform vec3 uColors[6]; uniform float uStops[6]; uniform int uCount;',
      'uniform float uFlow; uniform float uTurb; uniform vec3 uBg; uniform float uVignette; uniform float uGrain; uniform vec2 uSeed; uniform float uMouseOn;',
      'uniform float uFrost; uniform float uBright; uniform float uContrast; uniform float uHaze; uniform float uOpacity;',
      'float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
      'float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);',
      ' float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));',
      ' return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }',
      'float fbm(vec2 p){ float v=0.0,a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);',
      ' for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=0.5; } return v; }',
      'float tanhx(float x){ float e=exp(2.0*x); return (e-1.0)/(e+1.0); }',
      'float toUniform(float f){ float z=(f-0.5)/(0.163*1.41421); return clamp(0.5*(1.0+tanhx(1.202*z)),0.0,1.0); }',
      'vec3 colorFromField(float f){ vec3 c=uColors[0];',
      ' for(int i=1;i<6;i++){ if(i>=uCount) break; float e=uStops[i-1]; c=mix(c,uColors[i],smoothstep(e-0.075,e+0.075,f)); } return c; }',
      'vec3 fieldColor(vec2 uv){',
      ' float aspect=uRes.x/uRes.y;',
      ' vec2 p=uv; p.x*=aspect;',
      ' float t=uTime*0.06*uFlow;',
      ' vec2 m=uMouse/uRes; m.x*=aspect; vec2 dm=p-m; float md=length(dm);',
      ' float infl=exp(-md*md*2.8); vec2 dir=dm/(md+1e-3); vec2 sw=vec2(-dm.y,dm.x);',
      ' p += (dir*0.45 + sw*0.6)*infl*0.28*uMouseOn;',
      ' vec2 pp=(p+uSeed)*3.7;',
      ' vec2 wander=vec2(sin(t*0.5+uSeed.x*0.5)+sin(t*0.21+uSeed.y),cos(t*0.33+uSeed.y*0.5)+cos(t*0.16+uSeed.x))*0.42;',
      ' vec2 q=vec2(fbm(pp+wander+vec2(0.0,t)),fbm(pp-wander.yx+vec2(5.2,1.3)-t*0.8));',
      ' vec2 r2=vec2(fbm(pp+uTurb*1.1*q+vec2(1.7,9.2)+t*0.5),fbm(pp+uTurb*1.1*q+vec2(8.3,2.8)-t*0.45));',
      ' float f=fbm(pp+uTurb*1.3*r2+wander*0.4);',
      ' float u=toUniform(f); vec3 col=colorFromField(u);',
      ' float sheen=clamp(length(r2-q)*0.6,0.0,1.0); col+=sheen*0.02;',
      ' return col;',
      '}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/uRes; vec2 px=1.0/uRes; float rad=uFrost;',
      ' vec3 col=fieldColor(uv)*0.36;',
      ' col+=fieldColor(uv+vec2(rad,0.0)*px)*0.16;',
      ' col+=fieldColor(uv+vec2(-rad,0.0)*px)*0.16;',
      ' col+=fieldColor(uv+vec2(0.0,rad)*px)*0.16;',
      ' col+=fieldColor(uv+vec2(0.0,-rad)*px)*0.16;',
      ' col=mix(col,vec3(dot(col,vec3(0.333))),uHaze*0.5);',
      ' col=col*(1.0-uHaze*0.4)+uHaze*0.32;',
      ' col=(col-0.5)*uContrast+0.5;',
      ' col*=uBright;',
      ' float vig=smoothstep(0.25,1.3,length(uv-0.5)*2.0); col=mix(col,uBg,vig*uVignette);',
      ' if(uGrain>0.5){ col += hash(gl_FragCoord.xy+uTime)*0.035-0.0175; }',
      ' col=mix(uBg,col,uOpacity);',
      ' gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n');
    const prog = gl.createProgram();
    gl.attachShader(prog, this._compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, this._compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    this.u = {
      uRes: U('uRes'), uTime: U('uTime'), uMouse: U('uMouse'),
      uColors: U('uColors[0]'), uStops: U('uStops[0]'), uCount: U('uCount'),
      uFlow: U('uFlow'), uTurb: U('uTurb'), uBg: U('uBg'), uVignette: U('uVignette'),
      uGrain: U('uGrain'), uSeed: U('uSeed'), uMouseOn: U('uMouseOn'),
      uFrost: U('uFrost'), uBright: U('uBright'), uContrast: U('uContrast'), uHaze: U('uHaze'), uOpacity: U('uOpacity')
    };
    this._pal = this.buildPalette();
    this._seed = this.seedFor(this.seedStr);
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
    return true;
  }
  resize() {
    const c = this.canvas, scale = 0.6; this._dpr = scale;
    const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    c.width = Math.max(1, Math.floor(w * scale));
    c.height = Math.max(1, Math.floor(h * scale));
    this.gl.viewport(0, 0, c.width, c.height);
  }
  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    const gl = this.gl, u = this.u; if (!gl) return;
    const now = performance.now();
    if (this._lastDraw != null && now - this._lastDraw < 22) return;   // ~30fps cap
    this._lastDraw = now;
    const time = (now - this._t0) / 1000;
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uMouse, this.canvas.width * 0.5, this.canvas.height * 0.5);
    gl.uniform3fv(u.uColors, this._pal.flat);
    gl.uniform1fv(u.uStops, this._pal.stops);
    gl.uniform1i(u.uCount, this._pal.count);
    gl.uniform1f(u.uFlow, 3);
    gl.uniform1f(u.uTurb, 0.7);
    gl.uniform2f(u.uSeed, this._seed[0], this._seed[1]);
    gl.uniform1f(u.uMouseOn, 0);
    const bg = this.hexToRgb('#0a0a12');
    gl.uniform3f(u.uBg, bg[0], bg[1], bg[2]);
    gl.uniform1f(u.uVignette, 0.6);
    gl.uniform1f(u.uGrain, 1);
    gl.uniform1f(u.uFrost, 10);
    gl.uniform1f(u.uBright, 1.6);
    gl.uniform1f(u.uContrast, 1);
    gl.uniform1f(u.uHaze, 0);
    gl.uniform1f(u.uOpacity, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    const gl = this.gl;
    if (gl) { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) try { ext.loseContext(); } catch (e) {} }
  }
}

// ── the celebration ──────────────────────────────────────────────────────────
class GoalCelebration {
  constructor(opts) {
    this.iso = (opts.iso || '').toLowerCase();
    this.teamName = opts.teamName || '';
    this.playerName = opts.playerName || '';
    this.minute = opts.minute;
    this.speed = +(opts.speed ?? 0.3) || 0.3;
    this.phase = 'idle';
    this.dismissReady = false;
    this._timers = [];
    this._cannonRaw = null;
  }

  // ── palette helpers ──
  paletteW() {
    const colors = COLORS[this.iso] || FALLBACK_COLORS;
    return { colors, weights: WEIGHTS[this.iso] };
  }
  palette() { return COLORS[this.iso] || FALLBACK_COLORS; }
  pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  pickWeighted(colors, weights) {
    if (!weights || weights.length !== colors.length) return this.pick(colors);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, acc = 0;
    for (let i = 0; i < colors.length; i++) { acc += weights[i]; if (r <= acc) return colors[i]; }
    return colors[colors.length - 1];
  }
  hexA(hex, a) {
    hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  shade(hex, f) {
    hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    const h = x => ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2);
    return '#' + h(r) + h(g) + h(b);
  }
  paletteSorted() {
    const pw = this.paletteW();
    const cols = pw.colors, w = pw.weights || cols.map(() => 1);
    return cols.map((c, i) => [c, w[i] != null ? w[i] : 1]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  cannonUrl() {
    if (!this._cannonRaw) return '';
    const f = this.paletteSorted();
    const c0 = f[0], c1 = f[1 % f.length], c2 = f[2 % f.length], c3 = f[3 % f.length];
    const map = {
      '#FED93F': c0, '#A85B1E': this.shade(c0, 0.6), '#FFF200': this.shade(c0, 1.12), '#48B74A': this.shade(c0, 0.55),
      '#EF3F23': c1, '#A42911': this.shade(c1, 0.6), '#D90025': c1,
      '#1763AF': c2, '#064591': this.shade(c2, 0.6), '#4788C8': this.shade(c2, 1.25), '#A8CEDE': this.shade(c2, 1.5),
      '#0F4C84': this.shade(c2, 0.7), '#4860AC': c2, '#00ADE4': this.shade(c2, 1.3), '#006EA7': this.shade(c2, 0.7), '#00173D': this.shade(c2, 0.4),
      '#38195E': c3, '#0F0017': this.shade(c3, 0.5),
      '#AB614C': 'none', '#B77D98': 'none'
    };
    let svg = this._cannonRaw;
    for (const k in map) { svg = svg.split(k).join(map[k]); svg = svg.split(k.toLowerCase()).join(map[k]); }
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ── lifecycle ──
  mount() {
    injectKeyframes();
    ensureInter();
    const code = this.iso || 'fr';
    const c = { speed: this.speed, vig: 0.8, bar: -8, glow: 0.8, barScale: 1.55, stampScale: 1.1 };
    const dur = b => (b / 1000 / c.speed).toFixed(3) + 's';
    const flagUrl = `url("${FLAG_DIR}${code}.svg")`;
    const a1 = (0.80 * c.vig).toFixed(2), a2 = Math.min(1, 0.95 * c.vig).toFixed(2);
    const pw = this.paletteW();

    // container — fixed, above everything (nav 51, popups 60); pointer-events none
    const cont = document.createElement('div');
    this.node = cont;
    cont.setAttribute('role', 'alert');
    cont.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;';

    // flag-fluid background, revealed by an expanding clip-path
    const fluidWrap = document.createElement('div');
    fluidWrap.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;'
      + `background:radial-gradient(ellipse at 50% 45%, ${this.hexA(this.palette()[0], 0.5)}, rgba(5,5,10,0.95));`
      + 'clip-path:circle(0% at 50% 45%);-webkit-clip-path:circle(0% at 50% 45%);'
      + 'transition:clip-path .9s cubic-bezier(.22,.7,.2,1),-webkit-clip-path .9s cubic-bezier(.22,.7,.2,1),opacity .5s ease;';
    const fluidCanvas = document.createElement('canvas');
    fluidCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    fluidWrap.appendChild(fluidCanvas);
    cont.appendChild(fluidWrap);
    this._fluidWrap = fluidWrap;

    // stage — the dark scrim + screen-shake; holds all the foreground layers
    const stage = document.createElement('div');
    this._stage = stage;
    const vars =
      `--bar:${c.bar}deg;--glow:${c.glow};--barImg:${flagUrl};`
      + `--barH:calc(clamp(150px,22vh,260px) * ${c.barScale});--barTile:calc(var(--barH) * 4 / 3);`
      + `--barScrollAnim:gcbarscroll ${dur(4200)} linear var(--barDur) infinite;`
      + `--barTop:calc(50% + ${(-60 * Math.sin(c.bar * Math.PI / 180)).toFixed(3)}vw - var(--barH) / 2);`
      + `--stampScale:${c.stampScale};`
      + `--flashDur:${dur(350)};--spotDur:${dur(850)};--barDur:${dur(620)};`
      + `--cannonDur:${dur(550)};--cannonDelay:calc(var(--stampDur)*0.18);`
      + `--stampDur:${dur(720)};--subDur:${dur(600)};`
      + `--shakeDur:${dur(580)};--shockDur:${dur(720)};--raysDur:${dur(900)};`;
    stage.style.cssText = 'position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;'
      + `background:radial-gradient(ellipse 70% 70% at 50% 45%, rgba(8,3,5,${a1}), rgba(2,1,2,${a2}));`
      + 'animation:gcshake var(--shakeDur) cubic-bezier(.36,.07,.19,.97) calc(var(--stampDur)*0.28) both;'
      + vars;

    // flashes / spotlight / rays / shockwaves
    stage.appendChild(div('position:absolute;inset:0;background:#fff;animation:gcflash var(--flashDur) ease-out forwards;'));
    stage.appendChild(div('position:absolute;left:50%;top:45%;width:120vw;height:120vh;background:radial-gradient(ellipse 42% 48% at 50% 50%,rgba(255,255,255,.18),rgba(255,255,255,.04) 38%,rgba(0,0,0,0) 62%);animation:gcspot var(--spotDur) ease-out both;'));
    stage.appendChild(div('position:absolute;left:50%;top:50%;width:150vmax;height:150vmax;pointer-events:none;background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.055) 0deg 5deg,transparent 5deg 17deg);mix-blend-mode:screen;opacity:0;transform:translate(-50%,-50%);animation:gcraysin var(--raysDur) ease-out calc(var(--stampDur)*0.42) both,gcrays 30s linear infinite;'));
    stage.appendChild(div('position:absolute;left:50%;top:50%;width:84vmax;height:84vmax;border-radius:50%;border:4px solid rgba(255,255,255,.6);box-shadow:0 0 50px rgba(255,255,255,.35),inset 0 0 40px rgba(255,255,255,.25);pointer-events:none;transform:translate(-50%,-50%) scale(.04);animation:gcshock var(--shockDur) cubic-bezier(.1,.62,.2,1) calc(var(--stampDur)*0.30) both;'));
    stage.appendChild(div('position:absolute;left:50%;top:50%;width:120vmax;height:120vmax;border-radius:50%;border:2px solid rgba(255,255,255,.4);pointer-events:none;transform:translate(-50%,-50%) scale(.04);animation:gcshock calc(var(--shockDur)*1.25) cubic-bezier(.1,.62,.2,1) calc(var(--stampDur)*0.42) both;'));
    stage.appendChild(div('position:absolute;inset:0;background:#fff;pointer-events:none;animation:gcflash2 calc(var(--flashDur)*0.8) ease-out calc(var(--stampDur)*0.28) both;'));

    // back particle canvas
    const back = document.createElement('canvas');
    this._canvas = back;
    back.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    stage.appendChild(back);

    // banner sweep (flag tile) + edge gradient
    const barWrap = div('position:absolute;left:-10%;top:var(--barTop);width:120%;height:var(--barH);overflow:hidden;transform-origin:left center;transform:rotate(var(--bar)) scaleX(0);animation:gcbar var(--barDur) cubic-bezier(.16,.84,.24,1) both;');
    barWrap.appendChild(div('position:absolute;left:0;top:0;height:100%;width:calc(100% + var(--barTile));background-image:var(--barImg);background-repeat:repeat-x;background-size:auto 100%;background-position:left center;transform:translateX(0);will-change:transform;backface-visibility:hidden;animation:var(--barScrollAnim,none);'));
    stage.appendChild(barWrap);
    stage.appendChild(div('position:absolute;left:-10%;top:var(--barTop);width:120%;height:var(--barH);transform-origin:left center;transform:rotate(var(--bar)) scaleX(0);pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.18) 10%,transparent 22%,transparent 78%,rgba(0,0,0,.18) 90%,rgba(0,0,0,.72) 100%);animation:gcbar var(--barDur) cubic-bezier(.16,.84,.24,1) both;'));

    // center column: team line · GOAL! · underline · scorer line · Dismiss
    const col = div('position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;');
    const teamLine = div('font-family:Inter,system-ui,-apple-system,sans-serif;font-size:clamp(36px,5vw,80px);font-weight:800;letter-spacing:10px;color:rgba(255,255,255,.88);text-transform:uppercase;animation:gcsub var(--subDur) ease-out calc(var(--stampDur)*0.5) both;');
    teamLine.textContent = this._teamLabel();
    col.appendChild(teamLine);
    const stamp = div("--glow:0.8;position:relative;display:inline-flex;overflow:visible;font-family:'Anton',sans-serif;font-size:calc(clamp(150px,27vw,470px) * var(--stampScale));line-height:.9;color:#fff;margin-top:10px;padding:0 6px;animation:gcstamp var(--stampDur) cubic-bezier(.2,.85,.3,1) both,gcglow calc(var(--stampDur)*2.3) ease-in-out var(--stampDur) infinite;");
    stamp.textContent = 'GOAL!';
    col.appendChild(stamp);
    col.appendChild(div('margin-top:20px;height:3px;width:clamp(220px,28vw,420px);background:#fff;transform:scaleX(0);transform-origin:center;animation:gcwipe var(--subDur) ease-out calc(var(--stampDur)*0.66) both;'));
    const scorerLine = div('font-family:Inter,system-ui,-apple-system,sans-serif;font-size:clamp(16px,2vw,30px);font-weight:700;letter-spacing:4px;color:rgba(255,255,255,.92);text-transform:uppercase;margin-top:18px;animation:gcsub var(--subDur) ease-out calc(var(--stampDur)*0.8) both;');
    const scorerTxt = this._scorerLabel();
    if (scorerTxt) scorerLine.textContent = scorerTxt; else scorerLine.style.visibility = 'hidden';
    col.appendChild(scorerLine);

    const btn = document.createElement('button');
    this._dismissEl = btn;
    btn.type = 'button';
    btn.textContent = 'Dismiss';
    btn.style.cssText = 'position:relative;overflow:hidden;pointer-events:none;cursor:default;'
      + "font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;"
      + 'display:inline-flex;align-items:center;gap:9px;margin-top:44px;color:#16171c;background:#fff;border:none;border-radius:999px;padding:14px 30px;'
      + 'box-shadow:0 6px 22px rgba(0,0,0,.35);transition:transform .16s cubic-bezier(.2,.8,.3,1);will-change:transform;animation:gcdimfade .5s ease-out var(--stampDur) both;';
    const HS = 1.08;
    btn.addEventListener('mouseenter', () => { if (this.dismissReady) btn.style.transform = `scale(${HS})`; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
    btn.addEventListener('mousedown', () => { if (this.dismissReady) btn.style.transform = 'scale(0.94)'; });
    btn.addEventListener('mouseup', () => { if (this.dismissReady) btn.style.transform = `scale(${HS})`; });
    btn.addEventListener('click', () => this.dismiss());
    col.appendChild(btn);
    stage.appendChild(col);

    // cannons (recolored flag art), bottom corners, mirrored
    const cannonBase = 'position:absolute;bottom:0;width:max(150px, min(18vw, 240px));aspect-ratio:368 / 303;height:auto;z-index:4;pointer-events:none;filter:drop-shadow(0 8px 18px rgba(0,0,0,.55));';
    const cl = document.createElement('img'); cl.alt = '';
    cl.style.cssText = cannonBase + 'left:0;transform-origin:center bottom;animation:gccannonin var(--cannonDur) cubic-bezier(.2,.9,.3,1) var(--cannonDelay) both;';
    const cr = document.createElement('img'); cr.alt = '';
    cr.style.cssText = cannonBase + 'right:0;transform:scaleX(-1);transform-origin:center bottom;animation:gccannoninR var(--cannonDur) cubic-bezier(.2,.9,.3,1) var(--cannonDelay) both;';
    this._cannonImgs = [cl, cr];
    stage.appendChild(cl); stage.appendChild(cr);

    // front particle canvas (over the stamp / button)
    const front = document.createElement('canvas');
    this._canvasF = front;
    front.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    stage.appendChild(front);

    cont.appendChild(stage);
    document.body.appendChild(cont);
    this.phase = 'in';

    // start the WebGL fluid background
    this._fluid = new FlagFluid(fluidCanvas, { colors: pw.colors, weights: pw.weights, seedStr: code });
    this._fluid.mount();

    // reveal the fluid (clip-path) on the next frame so the transition fires
    requestAnimationFrame(() => {
      if (!this.node) return;
      fluidWrap.style.opacity = '1';
      fluidWrap.style.clipPath = 'circle(150% at 50% 45%)';
      fluidWrap.style.webkitClipPath = 'circle(150% at 50% 45%)';
    });

    // start canvas particle FX
    this.startFx();

    // fetch + recolor the cannon art, then paint both cannons
    fetch(CANNON_URL).then(r => r.text()).then(t => {
      this._cannonRaw = t;
      if (!this.node) return;
      const src = this.cannonUrl();
      this._cannonImgs.forEach(img => { img.src = src; });
    }).catch(() => {});

    // Dismiss becomes interactive once the stamp has landed (matches the CSS fade)
    const stampDurS = (720 / 1000) / c.speed;
    const readyMs = (stampDurS * 1.0 + 0.5) * 1000;
    this._timers.push(setTimeout(() => {
      this.dismissReady = true;
      if (this._dismissEl) { this._dismissEl.style.pointerEvents = 'all'; this._dismissEl.style.cursor = 'pointer'; }
    }, readyMs));

    // Esc also dismisses (keyboard users aren't trapped by the stay-until-dismiss)
    this._onKey = (e) => { if (e.key === 'Escape') this.dismiss(); };
    window.addEventListener('keydown', this._onKey);

    return this;
  }

  _teamLabel() {
    const t = (this.teamName || '').trim();
    return t ? t.toUpperCase() : (this.iso || '').toUpperCase();
  }
  _scorerLabel() {
    const p = (this.playerName || '').trim();
    const min = (this.minute == null ? '' : String(this.minute)).replace(/['′\s]+$/, '');
    if (p && min) return `${p} · ${min}'`;
    if (p) return p;
    if (min) return `${min}'`;
    return '';
  }

  dismiss() {
    if (!this.dismissReady || this.phase === 'out') return;
    this._clearTimers();
    this.phase = 'out';
    if (this.node) this.node.style.transition = 'opacity .55s ease';
    if (this.node) this.node.style.opacity = '0';
    if (this._fluidWrap) { this._fluidWrap.style.opacity = '0'; }
    this._timers.push(setTimeout(() => this.destroy(), 560));
  }

  destroy() {
    this._clearTimers();
    this.stopFx();
    if (this._fluid) { this._fluid.destroy(); this._fluid = null; }
    if (this._onKey) { window.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    this.node = null;
    if (_active === this) _active = null;
  }
  _clearTimers() { this._timers.forEach(clearTimeout); this._timers = []; }

  // ── particle-FX engine (port of the design's canvas loop) ──
  startFx() {
    if (this._raf || !this._canvas) return;
    this.resizeFx();
    this._parts = []; this._shells = []; this._bok = []; this._conf = [];
    this._stars = []; this._glitter = [];
    this._accFw = 0; this._accSt = 0;
    this._prev = performance.now(); this._curMode = null;
    this._burstAt = performance.now() + 288 / (this.speed || 1);
    const sp = this.speed || 1;
    const cannonDelayS = (0.72 / sp) * 0.18;
    const cannonDurS = 0.55 / sp;
    this._cannonFireAt = performance.now() + (cannonDelayS + cannonDurS * 0.78) * 1000;
    this._cannonFired = false;
    this._onFxResize = () => this.resizeFx();
    window.addEventListener('resize', this._onFxResize);
    const loop = (now) => { this._raf = requestAnimationFrame(loop); this.stepFx(now); };
    this._raf = requestAnimationFrame(loop);
  }
  stopFx() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._onFxResize) window.removeEventListener('resize', this._onFxResize);
    const cv = this._canvas;
    if (cv) { const x = cv.getContext('2d'); x && x.clearRect(0, 0, cv.width, cv.height); }
  }
  resizeFx() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
    this._W = window.innerWidth; this._H = window.innerHeight;
    [this._canvas, this._canvasF].forEach(cv => {
      if (!cv) return;
      cv.width = Math.floor(this._W * dpr);
      cv.height = Math.floor(this._H * dpr);
      cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  stepFx(now) {
    const cv = this._canvas; if (!cv) return;
    const ctx = cv.getContext('2d');
    const cf = this._canvasF; const ctxF = cf ? cf.getContext('2d') : null;
    const W = this._W, H = this._H;
    let dt = (now - (this._prev || now)) / 1000; this._prev = now;
    if (dt > 0.05) dt = 0.05;
    const mode = 'Grand Finale';
    const pw = this.paletteW();
    const pal = pw.colors;
    if (mode !== this._curMode) {
      this._parts = []; this._shells = []; this._bok = []; this._conf = [];
      this._stars = []; this._glitter = [];
      this._accFw = 0; this._accSt = 0;
      this._curMode = mode;
    }
    ctx.clearRect(0, 0, W, H);
    if (ctxF) ctxF.clearRect(0, 0, W, H);
    const usesFW = true, usesFC = false, usesCNF = true;
    // source-over confetti first (under the additive FX)
    ctx.globalCompositeOperation = 'source-over';
    this.stepConfetti(ctx, W, H, dt, pw, 100);
    // additive FX on top
    ctx.globalCompositeOperation = 'lighter';
    this.emitFireworks(ctx, W, H, dt, pal, 0.42);
    if (this._burstAt && now >= this._burstAt) { this._burstAt = 0; this.emitImpactBurst(W, H); }
    this.emitCannons(W, H, dt, pal);
    if (ctxF) ctxF.globalCompositeOperation = 'lighter';
    this.drawParticles(ctx, ctxF, dt);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (ctxF) { ctxF.globalAlpha = 1; ctxF.globalCompositeOperation = 'source-over'; }
  }
  emitFireworks(ctx, W, H, dt, pal, interval) {
    this._accFw = (this._accFw || 0) + dt;
    if (this._accFw > interval) {
      this._accFw = 0;
      this.launchShell(W, H, pal);
      if (Math.random() < 0.45) this.launchShell(W, H, pal);
    }
    ctx.lineCap = 'round';
    for (let i = this._shells.length - 1; i >= 0; i--) {
      const s = this._shells[i];
      s.vy += 200 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 9) s.trail.shift();
      for (let j = 0; j < s.trail.length - 1; j++) {
        const a = j / s.trail.length;
        ctx.strokeStyle = s.color; ctx.globalAlpha = a * 0.85;
        ctx.lineWidth = 2.6 * a + 0.4;
        ctx.beginPath(); ctx.moveTo(s.trail[j].x, s.trail[j].y); ctx.lineTo(s.trail[j + 1].x, s.trail[j + 1].y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (s.vy >= -30 || s.y <= s.targetY) { this.explode(s.x, s.y, s.colors); this._shells.splice(i, 1); }
    }
  }
  launchShell(W, H, pal) {
    const targetY = H * (0.05 + Math.random() * 0.17);
    const v = Math.sqrt(2 * 200 * (H - targetY)) * (0.96 + Math.random() * 0.08);
    const c1 = this.pick(pal), c2 = Math.random() < 0.5 ? c1 : this.pick(pal);
    this._shells.push({
      x: W * (0.12 + Math.random() * 0.76), y: H + 12,
      vx: (Math.random() - 0.5) * 50, vy: -v,
      targetY, trail: [], color: c1, colors: [c1, c2]
    });
  }
  explode(x, y, colors) {
    const rings = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let r = 0; r < rings; r++) {
      const n = 46 + Math.floor(Math.random() * 38);
      const base = (120 + Math.random() * 130) * (1 + r * 0.55);
      const off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + off;
        const sp = base * (0.55 + Math.random() * 0.6);
        this._parts.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          life: 1, decay: 0.42 + Math.random() * 0.5,
          col: this.pick(colors), size: 1.4 + Math.random() * 1.7,
          px: x, py: y, flick: Math.random() < 0.35, type: 'spark', grav: 105
        });
      }
    }
    this._parts.push({ x, y, vx: 0, vy: 0, life: 1, decay: 3.2, col: '#fff', size: 22, px: x, py: y, type: 'flash', grav: 105 });
  }
  emitImpactBurst(W, H) {
    const pw = this.paletteW();
    const pal = pw.colors;
    const cx = W * 0.5, cy = H * 0.46;
    this.explode(cx, cy, [this.pick(pal), '#ffffff', this.pick(pal)]);
    this.explode(W * 0.30, H * 0.32, [this.pick(pal), this.pick(pal)]);
    this.explode(W * 0.70, H * 0.32, [this.pick(pal), this.pick(pal)]);
    const n = 120;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 340 + Math.random() * 560;
      this._parts.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 90,
        life: 1, decay: 0.42 + Math.random() * 0.4,
        col: this.pickWeighted(pw.colors, pw.weights),
        size: 1.8 + Math.random() * 2.4,
        px: cx, py: cy, flick: Math.random() < 0.3, type: 'spark', grav: 260
      });
    }
  }
  emitCannons(W, H, dt, pal) {
    if (this._cannonFireAt && performance.now() < this._cannonFireAt) return;
    const justFired = !this._cannonFired;
    this._cannonFired = true;
    const dw = Math.max(150, Math.min(W * 0.18, 240));
    const dh = dw * 303 / 368;
    const yTop = H - dh;
    const p1 = [0.820, 0.071], p2 = [0.920, 0.375];
    const cannons = [
      { ang: -0.46, mirror: false },
      { ang: -Math.PI + 0.46, mirror: true }
    ];
    for (const cn of cannons) {
      const n = justFired ? 26 : 9;
      for (let i = 0; i < n; i++) {
        const t = 0.12 + Math.random() * 0.76;
        const fx = p1[0] + (p2[0] - p1[0]) * t;
        const fy = p1[1] + (p2[1] - p1[1]) * t;
        const x = cn.mirror ? (W - dw) + (1 - fx) * dw : fx * dw;
        const y = yTop + fy * dh;
        const ang = cn.ang + (Math.random() - 0.5) * 0.5;
        const sp = (280 + Math.random() * 430) * (justFired ? 1.28 : 1);
        const warm = Math.random();
        const col = warm < 0.48 ? '#fffee8' : warm < 0.72 ? '#ffd78a' : this.pick(pal);
        this._parts.push({
          x: x + (Math.random() - 0.5) * 4, y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          life: 1, decay: 1.7 + Math.random() * 1.2,
          col, size: 1.4 + Math.random() * 2.2,
          px: x, py: y, flick: true, type: 'spark', grav: 200
        });
      }
    }
  }
  stepConfetti(ctx, W, H, dt, pw, maxCount) {
    while (this._conf.length < maxCount) {
      this._conf.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
        vy: 90 + Math.random() * 140, vx: (Math.random() - 0.5) * 50,
        w: 6 + Math.random() * 8, h: 9 + Math.random() * 11,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 7,
        sway: Math.random() * 6.28, ss: 1 + Math.random() * 2.4,
        col: this.pickWeighted(pw.colors, pw.weights)
      });
    }
    for (let i = this._conf.length - 1; i >= 0; i--) {
      const c = this._conf[i];
      c.sway += c.ss * dt; c.rot += c.vr * dt;
      c.x += c.vx * dt + Math.sin(c.sway) * 20 * dt; c.y += c.vy * dt;
      if (c.y > H + 30) { this._conf.splice(i, 1); continue; }
      const flip = Math.abs(Math.cos(c.sway * 1.2));
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.globalAlpha = 0.92; ctx.fillStyle = c.col;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * flip + 1);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  drawParticles(ctxBack, ctxFront, dt) {
    ctxBack.lineCap = 'round';
    if (ctxFront) ctxFront.lineCap = 'round';
    for (let i = this._parts.length - 1; i >= 0; i--) {
      const p = this._parts[i];
      p.px = p.x; p.py = p.y;
      const g = p.grav !== undefined ? p.grav : 100;
      p.vy += g * dt; p.vx *= (1 - 1.05 * dt); p.vy *= (1 - 1.05 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0) { this._parts.splice(i, 1); continue; }
      const ctx = (p.front && ctxFront) ? ctxFront : ctxBack;
      if (p.type === 'flash') {
        const r = p.size * (2 - p.life);
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, 'rgba(255,255,255,' + (0.85 * p.life) + ')');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.fill();
        continue;
      }
      let a = p.life;
      if (p.flick) a *= (0.45 + 0.55 * Math.sin(performance.now() * 0.025 + i));
      a = Math.max(0, a);
      ctx.globalAlpha = a * (p.front ? 0.34 : 0.28); ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.4, 0, 6.3); ctx.fill();
      ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.75, 0, 6.3); ctx.fillStyle = p.col; ctx.fill();
      if (p.front) {
        const hx = p.x - p.size * 0.3, hy = p.y - p.size * 0.34;
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, p.size * 1.0);
        hg.addColorStop(0, 'rgba(255,255,255,' + (0.95 * a).toFixed(3) + ')');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = a; ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, p.size * 1.0, 0, 6.3); ctx.fill();
      }
    }
    ctxBack.globalAlpha = 1;
    if (ctxFront) ctxFront.globalAlpha = 1;
  }
}

// small DOM helper
function div(cssText) { const d = document.createElement('div'); d.style.cssText = cssText; return d; }

// ── module-level singleton (one celebration at a time) ───────────────────────
let _active = null;

export function playGoalCelebration(opts = {}) {
  try {
    if (_active) { _active.destroy(); _active = null; }
    _active = new GoalCelebration(opts);
    _active.mount();
    return _active;
  } catch (err) {
    console.warn('[goal-celebration] failed to play:', err);
    return null;
  }
}

export function dismissGoalCelebration() {
  if (_active) { _active.destroy(); _active = null; }
}

export function isGoalCelebrationActive() { return !!_active; }
