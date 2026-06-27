// lib/match-snapshot.js — persist the live match-detail payload so a finished
// match keeps its events/stats/scorers after full-time, when the live feed
// stops returning per-match detail.
//
// Background: the game page (render-game.js) and the live page pull match
// detail live (the /matches/:id/stats timeline + box-score). At full-time that
// detail evaporates from the feed, so the post-match page falls back to the
// empty "No events recorded yet" / "Stats unavailable" states even though the
// data existed moments earlier. We snapshot the detail to localStorage the
// moment a match is observed finished WHILE the feed still carries it, and load
// it back when a finished match's live detail comes back empty.
//
// Design goals:
//  • Best-effort & resilient — every entry point is wrapped in try/catch and
//    NEVER throws into the render path (save/load return undefined / null on
//    any failure, quota error, disabled storage, JSON error, etc.).
//  • Size-guarded — oversized payloads are skipped so we don't trip the ~5MB
//    localStorage quota or evict other keys.
//  • Extensible — the stored object is a shallow envelope { v, id, ts, ... }.
//    Today render-game saves { score, stats, scorers, events }; the live page
//    can later add formations / xG / momentum / lineups under their own keys
//    without changing this module. load() returns the whole envelope, so new
//    consumers just read the extra keys when present.

const PREFIX = 'wc-match-snap-';
const VERSION = 1;
// Per-match cap (~280 KB). A stats timeline + box-score is a few KB; this leaves
// generous headroom for richer payloads (formations/momentum) while staying far
// under the localStorage quota even with many matches snapshotted.
const MAX_BYTES = 280 * 1024;

function keyFor(id) { return PREFIX + String(id); }

function store() {
  // Access can throw (privacy mode / disabled storage) — caller guards via try/catch.
  return (typeof localStorage !== 'undefined') ? localStorage : null;
}

// Rough UTF-16 byte estimate without allocating a Blob (kept dependency-free).
function approxBytes(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return n;
}

/**
 * Persist a match-detail snapshot. Best-effort: returns true on success, false
 * (or undefined) on any failure. Never throws.
 *
 * @param {string|number} id   match id (the id render-game fetched detail for)
 * @param {object} data        detail to persist, e.g.
 *   { score:{home,away,phase,status}, stats, scorers, events,
 *     // future: formations, xg, momentum, lineups }
 * @returns {boolean}
 */
export function save(id, data) {
  try {
    if (id == null || !data || typeof data !== 'object') return false;
    const s = store();
    if (!s) return false;
    const envelope = { v: VERSION, id: String(id), ts: Date.now(), ...data };
    let json;
    try { json = JSON.stringify(envelope); } catch { return false; }
    if (!json || approxBytes(json) > MAX_BYTES) return false; // size guard
    s.setItem(keyFor(id), json);
    return true;
  } catch {
    // Quota exceeded, storage disabled, serialization edge case — swallow.
    return false;
  }
}

/**
 * Load a previously-saved snapshot envelope, or null if none/invalid.
 * Returns the full envelope { v, id, ts, score, stats, scorers, events, ... }
 * so callers can read whatever detail keys are present (including future ones).
 *
 * @param {string|number} id
 * @returns {object|null}
 */
export function load(id) {
  try {
    if (id == null) return null;
    const s = store();
    if (!s) return null;
    const raw = s.getItem(keyFor(id));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch {
    return null;
  }
}

/** Remove a stored snapshot (best-effort). */
export function clear(id) {
  try {
    const s = store();
    if (s) s.removeItem(keyFor(id));
  } catch { /* no-op */ }
}
