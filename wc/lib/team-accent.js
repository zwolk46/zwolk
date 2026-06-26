// lib/team-accent.js — team accent colours (luminance-corrected so they read on
// both dark and light themes). Same logic the live page uses, shared so the game
// page can tint its stakes UI with the two teams' real colours.

let COLORS = null, _loading = null;
export function loadColors() {
  if (COLORS) return Promise.resolve(COLORS);
  if (!_loading) _loading = fetch('/wc/data/enrichment/team-colors.json', { cache: 'force-cache' })
    .then((r) => r.json()).then((j) => (COLORS = j || { teams: {}, accentOverrides: {} }))
    .catch(() => (COLORS = { teams: {}, accentOverrides: {} }));
  return _loading;
}
function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function relLum(h) { const [r, g, b] = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function mix(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

// Mid-luminance accent that's legible on either theme.
export function accentFor(code) {
  const C = COLORS || { teams: {}, accentOverrides: {} };
  if (!code) return '#f5c712';
  const ov = C.accentOverrides && C.accentOverrides[code];
  if (ov) return '#' + ov;
  const pair = (C.teams && C.teams[code]) || ['F5C712', 'FFFFFF'];
  for (const h of pair) { const L = relLum('#' + h); if (L >= 0.16 && L <= 0.72) return '#' + h; }
  const h = '#' + pair[0], L = relLum(h);
  return L > 0.72 ? mix(h, '#0a0e0c', 0.34) : mix(h, '#ffffff', 0.42);
}
export function rgbStr(hex) { return hexToRgb(hex).join(','); }

// Set --home/--away (+ rgb) on an element from two team codes (loads colours first).
export async function applyTeamVars(node, homeCode, awayCode) {
  await loadColors();
  const h = accentFor(homeCode), a = accentFor(awayCode);
  node.style.setProperty('--home', h); node.style.setProperty('--home-rgb', rgbStr(h));
  node.style.setProperty('--away', a); node.style.setProperty('--away-rgb', rgbStr(a));
}
