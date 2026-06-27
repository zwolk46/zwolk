# Loading & Transition Standardization Plan — `/wc`

> **Status:** Proposal for review. Nothing in here is deployed.
> **Goal:** Make loading and page-to-page motion happen in *exactly the same
> anticipated way* for every URL under `zwolk.com/wc` — on first load, on reload,
> on direct URL entry, on in-app navigation, and on every in-page state change —
> so the app reads as a single, deliberate, state-of-the-art product instead of a
> set of pages that each animate (or snap) differently.

---

## 0. The thesis (read this first)

Today the `/wc` app already has good *ingredients* — cross-document View
Transitions, a scroll-reveal system, a skeleton shimmer component, spring-animated
popups, a slide-in drawer, and speculation-rules prefetch. The problem is **not a
lack of motion; it's a lack of one shared model.** The same conceptual event looks
different depending on which page you're on:

- Opening a route shows a **spinner** on Fixtures/Groups/Bracket/Stakes, **nothing
  then a snap** on Players/Game/Team/Player, a **"Finding the live match…" boot
  line** on Live, and **instant static** on Info.
- In-page changes (segment tabs, day select, filter, **Live idle→active**) mostly
  **snap** with no transition, while cross-page navigation *does* cross-fade.
- The skeleton component (`.wc-skel`) exists but is barely used; spinners and
  "Loading…" text are used instead.

The fix is to define a **small, closed vocabulary of transition archetypes** and
route *every* interaction in the app through exactly one of them, from one shared
place in code. After that, "what happens when I open / reload / click" has a single
answer everywhere. That is the whole point of the project: **predictability and
standardization**, delivered with the current industry-standard primitives.

**Five archetypes cover the entire app:**

| # | Archetype | When it fires | What the user sees (always the same) |
|---|-----------|---------------|--------------------------------------|
| 1 | **BOOT** | First paint of any route (incl. direct URL / reload) | Instant chrome → standardized **skeleton silhouette** → one "content-in" reveal when data resolves |
| 2 | **PAGE** | Cross-document navigation between routes | Cross-document VT: **fade-through** for siblings, **shared-element drill** for list→detail (and reverse on Back) |
| 3 | **SWAP** | Same-route content replacement (tab/segment, day, filter, re-render) | `startViewTransition` **fade-through of the content region only**; chrome holds still |
| 4 | **PROMOTE** | A surface changes role in place | `startViewTransition` where the **new state rises/scales into the old one's box** (Live idle→active, Next→Live, scheduled→FT) |
| 5 | **OVERLAY** | A transient layer over the page | One open/close choreography for **popups, drawer, sheets, toasts**; inner load = skeleton, not spinner |

Everything below specifies these five, maps every interaction to one of them, and
gives an ordered, shippable rollout.

---

## 1. Goal & success criteria

**Primary goal:** identical, anticipated loading/transition behavior for every
possible `/wc` URL and every interaction type, regardless of page.

Concretely, the project is done when all of the following are true:

1. **One boot experience.** Direct-entering `/wc/fixtures`, `/wc/groups`,
   `/wc/players`, `/wc/live`, `/wc/game/123`, `/wc/team/BRA`, `/wc/player/…`,
   `/wc/bracket`, `/wc/stakes`, `/wc/info` all show the same *shape* of load:
   chrome instantly, a skeleton matched to that page, then a single reveal. No
   page snaps blank-then-full; no page uses a bare spinner or boot text.
2. **One navigation grammar.** Sibling-to-sibling nav always looks like X;
   list→detail always looks like Y; Back always reverses Y. No exceptions.
3. **No "dead" state changes.** Every same-document content swap (tabs, day,
   filter, live idle→active, live re-render) animates through SWAP or PROMOTE —
   none snap.
4. **One loading indicator.** Skeletons everywhere; spinners and ad-hoc "Loading…"
   strings removed from the standard path.
5. **Graceful everywhere.** Reduced-motion users get instant, non-animated
   equivalents; non-Chromium browsers (Firefox until VT ships, older Safari) fall
   back to plain swaps with no breakage; nothing added increases the wc2026api
   request budget.
6. **No regressions** to the off-limits goal-celebration system, the icon policy,
   the dark/light theming, or the live data pipeline.

**Non-goals:** changing data sources, content, or page layouts; rewriting the live
broadcast animations; introducing a build step or a framework.

---

## 2. Research synthesis — what the modern standard actually is

(Condensed from the View Transitions specs and the Chrome/MDN docs, CSS-Tricks'
real-world cross-document write-up, the Carbon/Material motion guidelines, the
perceived-performance literature, and the Speculation Rules rollouts. Full source
list at the end.)

**A. View Transitions API is the state-of-the-art primitive — and the app is
already on it.**
- *Cross-document* (MPA) transitions opt in purely via CSS `@view-transition {
  navigation: auto; }` on both pages — no JS, no build. The old
  `<meta name="view-transition">` is dead; ignore any tutorial that uses it.
- *Same-document* transitions wrap a DOM change: `document.startViewTransition(()
  => updateDOM())`. As of 2025 these are reaching Baseline (Interop 2025; Firefox
  144), with `view-transition-class`, **`view-transition-name: match-element`**
  (auto-name many list items without inventing hundreds of names — same-document
  only), **view transition *types*** + `:active-view-transition-type()` (different
  animation per navigation kind), and **nested groups** (Chrome 140) for clipping.
- Keep the `startViewTransition` callback **minimal** — the gap between old/new
  snapshots is a visible freeze, so do heavy work *before* calling it.

**B. The cross-document gotchas that bite real MPAs (all apply to us):**
- **The silent 4-second timeout.** If the new page isn't "renderable" within 4s of
  navigation starting (TTFB + render), the transition is dropped with no warning.
  Mitigations: be fast to first paint, and/or `<link rel="expect" href="#main"
  blocking="render">` to hold the snapshot until key content exists. *Our
  skeleton-first BOOT model makes first paint data-free and near-instant, which
  structurally defeats this timeout.*
- **Image "taffy."** VT animates *snapshots*, defaulting to `object-fit: fill`, so
  flags/crests/portraits stretch mid-morph. Fix: `::view-transition-old(name),
  ::view-transition-new(name){ object-fit: cover }`.
- **`pageswap`** (outgoing) and **`pagereveal`** (incoming) are the only way the
  two documents coordinate — use them to assign just-in-time shared-element names
  and to pick a direction; always `if (!e.viewTransition) return` and clean up
  names on `viewTransition.finished`.

**C. Perceived performance: skeletons beat spinners.** Users perceive
skeleton-screen pages as meaningfully faster than identical spinner pages because
progress is visible; sequence the reveal **most-stable-first** (chrome/header) →
**most-important-last** (the body content). Tolerance: ~1s of blank before "is it
broken?", abandonment climbs after ~3s. (Caveat: skeletons only help when they
mirror the real layout — vague gray blobs don't.)

**D. Choreography (Carbon / Material):** stagger list entrances **≤20ms apart**;
**scale duration to the distance/size** a thing travels (small move = short, large
move = longer); use **entrance easing (decelerate)** for things arriving,
**exit easing (accelerate)** for things leaving, **standard easing** for things
that stay. This is exactly what a token set should encode.

**E. Speculation Rules make the *next* navigation instant.** `prefetch` downloads
the next document; `prerender` fully renders it in the background so it appears
instantly (Shopify/Google report large p75 LCP wins). We already `prefetch /wc/*`
at `moderate` eagerness; **prerender is the available next step** and pairs well
with cross-document VT.

**F. Best-in-class references studied (the implementations the field copies):**
the Chrome team's own View Transitions demo suite (`view-transitions.chrome.dev` —
the canonical `match-element` list and shared-element card→detail patterns),
Shopify's platform-wide speculation-rules deployment, and Google Search's
prefetch-on-results — i.e. *the same two primitives this plan standardizes on
(View Transitions + Speculation Rules), used exactly this way.*

---

## 3. Current state — what exists vs. what's inconsistent

**Backbone (verified in code):**
- Every page: inline no-flash theme script → render-blocking `lib/shell.css` (the
  design-system source of truth: tokens, keyframes, `@view-transition`, reveal,
  skeleton) → `injectShell()` builds nav/drawer/watermark and calls
  `injectSpeculationRules()` (prefetch `/wc/*`, `moderate`).
- Cross-document VT is **on**: `@view-transition{navigation:auto}`, root cross-fade
  `.34s`, named groups for `wc-nav`/`wc-hero-logo`/`wc-watermark` `.28s`;
  `pagereveal` sets `html.wc-vt-in` to suppress the `wc-page-in` `.42s` body fade
  that plays on a no-VT first load.
- Motion tokens: `--dur-1:.12s --dur-2:.2s --dur-3:.34s`; eases `--ease-out
  --ease-spring --ease-press`. **Missing:** entrance/exit-specific eases and a
  long-distance duration.
- `[data-reveal]` scroll-reveal (`.wc-pre`→`[data-seen]`) via `revealVisible()`.
- `.wc-skel` shimmer + `.wc-empty` exist; **under-used.**
- Popups: bespoke keyframes (panel scale+fade `.42s` spring in / `.22s` out; scrim
  `.28s`/`.22s`; mobile = full-screen slide-up), focus trap, scroll-lock,
  stack-of-1, inner `.wc-popup-loading` **spinner**. Not VT-based.
- Drawer: transform slide `.32s --ease-out` + scrim `.25s`.
- `startViewTransition` is used in **exactly one** place: the theme toggle.

**The inconsistency inventory (what this plan eliminates):**

| Surface | Today | Problem |
|---|---|---|
| Fixtures / Groups / Bracket / Stakes boot | `.loading` text + CSS spinner → content snaps in | Spinner, not skeleton; arrival snaps |
| Players boot | "Loading 1,248 players…" → snap/cascade | Different indicator again |
| Game / Team / Player boot | shell only → in-render `.xx-loading` spinner → snap | Blank-ish then snap; spinner |
| Live boot | "Finding the live match…" boot line → module import → render | Bespoke boot text |
| Info boot | static instant | Fine, but inconsistent with the rest |
| **Live idle → active** | container **snaps** countdown→scoreboard | The single most jarring transition in the app |
| Segment/tab switch (Stakes) | `#view.innerHTML` replaced, **snaps** | No motion |
| Day select (Fixtures) | smooth-scroll + re-render **snaps** | Content snaps |
| Filter expand (Fixtures) | bespoke chip spring + max-width tween | One-off animation, not shared vocabulary |
| Group accordion (Groups) | `max-height` tween | OK but ad-hoc easing/timing |
| List re-render on live poll | `innerHTML` rebuild, **snaps** | Scores/rows pop |
| Popup inner load | spinner | Should be skeleton |
| Cross-page nav | root cross-fade only | No direction, no shared elements |

---

## 4. The unified model (the heart of the plan)

### 4.1 One motion vocabulary (tokens + named VT animations)

Add to `shell.css :root` (names illustrative):

```css
:root{
  /* existing: --dur-1:.12s --dur-2:.2s --dur-3:.34s */
  --dur-4:.5s;                         /* large-distance / promote moves */
  --ease-entrance:cubic-bezier(0,0,.2,1);   /* decelerate — things arriving */
  --ease-exit:cubic-bezier(.4,0,1,1);       /* accelerate — things leaving  */
  /* --ease-out stays the "standard" ease for things that persist */
}
```

Define the **five archetypes' animations once**, keyed by view-transition *type*,
so the same CSS drives every page:

```css
/* SWAP — content-region fade-through (chrome untouched) */
html:active-view-transition-type(swap)::view-transition-group(content){…}
/* DRILL — directional + shared element; PROMOTE — rise/scale into box; etc. */
html:active-view-transition-type(drill-forward)::view-transition-old(root){…}
html:active-view-transition-type(drill-back)::view-transition-old(root){…}
/* snapshot taffy guard for all shared media */
::view-transition-old(*.wc-shared),::view-transition-new(*.wc-shared){object-fit:cover}
```

All of it lives behind the existing `@media (prefers-reduced-motion:reduce)` block
so every archetype degrades to instant in one place.

### 4.2 One shared transition helper — `lib/transitions.js` (new)

The single choke-point every page calls so behavior can't drift:

```js
// reduced-motion-safe, name-cleanup-safe wrapper used for SWAP & PROMOTE
export function viewSwap(update, { type } = {}) {
  if (!document.startViewTransition || prefersReduced()) { update(); return Promise.resolve(); }
  const vt = document.startViewTransition({ update, types: type ? [type] : [] });
  vt.finished.catch(()=>{}).finally(cleanupTransientNames);
  return vt.finished;
}
```

Every in-page state change becomes `viewSwap(() => rerender(), { type:'swap' })`
instead of a bare `innerHTML =`. That one substitution is most of the SWAP/PROMOTE
work.

### 4.3 One skeleton library — `lib/skeleton.js` (new)

Builders that return `.wc-skel` DOM in the *silhouette of each archetype's real
content* (so skeletons mirror layout, per the research):

`skelDaystripAndList()` (Fixtures), `skelStandingsTable()` (Groups),
`skelBracket()` (Bracket), `skelCardGrid(n)` (Players/Stakes),
`skelDetailHero()` (Game/Team/Player + popup body), `skelLiveScoreboard()` (Live).

These paint with **no data**, so BOOT first-paint is instant and the 4s VT timeout
never triggers.

### 4.4 One loading-indicator standard

Skeleton is the default everywhere. The CSS spinner (`wc-spin`) is retired from the
standard path (it may remain only for a truly sub-second micro-wait *inside* an
already-rendered surface, which in practice we won't need). `.wc-popup-loading`'s
spinner is replaced by `skelDetailHero()`.

---

## 5. Interaction → archetype mapping (the full matrix)

Every interaction the project must cover, and the single standardized behavior it
gets. "Type" = the view-transition-type tag.

| Interaction | Archetype | Type | Standard behavior |
|---|---|---|---|
| Direct URL / reload of **any** route | BOOT | — | chrome instant → matched skeleton → content-in reveal (stable→body, ≤20ms stagger) |
| Nav pill: Fixtures↔Groups↔Stakes↔Bracket↔Players | PAGE | `sibling` | cross-document fade-through; nav/logo/watermark persist |
| Info / Live from nav or drawer | PAGE | `sibling` | same fade-through |
| Match card → Game detail (full nav) | PAGE | `drill-forward` | card morphs into detail hero (shared name) + forward fade |
| Player row → Player detail (full nav) | PAGE | `drill-forward` | portrait morphs into player hero |
| Team crest → Team detail (full nav) | PAGE | `drill-forward` | crest morphs into team hero |
| Browser **Back** from any detail | PAGE | `drill-back` | reverse of drill-forward |
| Match/team/player **popup** open & close | OVERLAY | `overlay` | scrim fade + panel rise/scale (entrance-in/exit-out); **skeleton** body |
| Mobile menu **drawer** open/close | OVERLAY | `overlay` | same scrim + slide choreography, shared tokens |
| Stakes **segment** switch (Games/Teams/Guide) | SWAP | `swap` | content-region fade-through; segmented thumb slides |
| Fixtures **day** select | SWAP | `swap` | schedule region fade-through; day-strip pill via `match-element` |
| Fixtures **filter** apply/expand | SWAP | `swap` | list re-renders through the same fade-through (chips keep their reveal) |
| Groups **accordion** expand/collapse | SWAP | `swap`* | height tween retained but on shared tokens (*VT optional here) |
| Live-poll **list re-render** (Fixtures/Groups/Bracket) | SWAP | `swap` | rows use `match-element`+`view-transition-class`; scores cross-fade, rows ease on reorder |
| **Live idle → active** (countdown → scoreboard) | PROMOTE | `promote` | scoreboard rises/scales into the countdown's box |
| Nav **"Next" → "Live"** button flip | PROMOTE | `promote` | label/flags promote in place (no snap) |
| Card **scheduled → FT / live** status change | PROMOTE | `promote` | status badge + score promote in place |
| Live **goal celebration** | (unchanged) | — | `lib/goal-celebration.js` stays **off-limits** |
| Theme toggle | (keep) | — | already a `startViewTransition`; fold into the shared helper |
| Scroll into view | (keep) | — | `[data-reveal]` retained; becomes the BOOT body reveal mechanism too |

---

## 6. Shared infrastructure to build (once)

1. **`shell.css` token + VT-vocabulary additions** (§4.1): `--dur-4`,
   `--ease-entrance`, `--ease-exit`, the per-type `::view-transition-*` rules, the
   `object-fit:cover` taffy guard, all inside the existing reduced-motion guard.
2. **`lib/transitions.js`** (§4.2): `viewSwap()`, a `prefersReduced()` re-export,
   `cleanupTransientNames()`, and `nameShared(el, name)` / `clearShared()` helpers
   for drill shared-elements.
3. **`lib/skeleton.js`** (§4.3): the silhouette builders.
4. **`shell.js` upgrades:**
   - `pageswap`/`pagereveal` handlers extended from "swallow promises" to also
     **choose the PAGE type** (sibling vs drill) from
     `e.activation.navigationType` + source/destination URL, and **assign the
     shared-element name** on the clicked element (set in `enablePopupLinks`'
     click path / a `data-vt-shared` hook) and on the destination hero.
   - Upgrade speculation rules from `prefetch` → add a conservative **`prerender`**
     rule for same-section links (decision flagged in §13) so PAGE navigations can
     be instant *and* transition.
5. **`lib/popup.js`:** swap the inner spinner for `skelDetailHero()`; align panel
   timings to the new tokens; (optional, phase 6) move open/close into `viewSwap`
   with the `overlay` type for one unified choreography.

---

## 7. Per-archetype implementation detail

### 7.1 BOOT (every route's first paint)

**Pattern, identical on every page bootstrap:**
1. `injectShell(...)` (already instant).
2. **Immediately** render the page's skeleton silhouette into the content root
   (`skelX()`), *before* awaiting any data. This is the new "anticipated" state and
   replaces today's spinner / boot-text / blank.
3. `await` data (static JSON and/or live API, unchanged).
4. Replace skeleton → real content inside `viewSwap(..., {type:'swap'})` so the
   handoff is a clean fade-through rather than a snap; tag the top content
   sections `[data-reveal]` so the existing reveal sequences body content
   stable-first.
5. Add `<link rel="expect" href="#wc-main" blocking="render">` (and id the content
   root `#wc-main`) so inbound cross-document VTs hold for the skeleton — which is
   instant — eliminating the 4s-timeout failure mode.

**Files:** `fixtures.html`, `groups.html`, `bracket.html`, `stakes.html`,
`players.html` (+`render-players.js`), `game.html` (+`render-game.js`),
`team.html` (+`render-team.js`), `player.html` (+`render-player.js`),
`live.html` (+`live-page.js`), `info.html` (add a no-op skeleton path or mark it
intentionally static). Each change is local: delete the `.loading`/boot markup,
call the matching skeleton builder, wrap the final render in `viewSwap`.

### 7.2 PAGE (cross-document navigation)

- Keep `@view-transition{navigation:auto}`. Add **types** so direction is
  expressed: in `pageswap`, read `e.activation.navigationType` (`push`/`traverse`)
  and the destination URL; set `document.documentElement` VT type to `sibling` or
  `drill-forward`; on `traverse` back, `drill-back`.
- **Shared elements:** when a list item links to a detail page, mark it
  `data-vt-shared="hero"` (card, portrait, crest). In `pageswap` give that element
  `view-transition-name: wc-hero` + class `wc-shared`; on the detail page's hero do
  the same in `pagereveal`. Clean up on `finished`. Result: card→hero morph
  forward, reverse on Back — the same everywhere.
- Apply the `object-fit:cover` snapshot guard to `.wc-shared` so flags/crests/
  portraits don't warp.
- This is purely additive and CSS/JS-guarded; unsupported browsers just navigate.

### 7.3 SWAP (same-route content replacement)

- Give each page's content region `view-transition-name: content` (scoped to the
  swapped container, not the chrome).
- Replace every `container.innerHTML = …` / re-render call on tab/day/filter/
  poll-refresh with `viewSwap(() => rerender(), { type:'swap' })`.
- For lists that reorder on live refresh, set `view-transition-name:
  match-element; view-transition-class: row` on rows so moves/score changes animate
  consistently without hand-naming.
- Keep callbacks lean: compute the new model *before* `viewSwap`, only do DOM
  writes inside.

### 7.4 PROMOTE (role change in place) — including Live idle→active

- The idle countdown container and the active scoreboard container share one
  `view-transition-name` (e.g. `live-stage`); the state change runs through
  `viewSwap(() => swapStage(), { type:'promote' })`, so the scoreboard scales/rises
  into the countdown's footprint instead of snapping. Same mechanism for the nav
  **Next→Live** flip and **scheduled→FT** card status.
- Live high-frequency updates (clock tick, possession) stay as cheap text writes —
  **not** wrapped in VT (too frequent); only *discrete role/score changes* promote.
  The goal-celebration system is untouched.

### 7.5 OVERLAY (popups, drawer, future sheets/toasts)

- Phase 1 (low-risk): keep the current popup/drawer animations but (a) move their
  durations/eases onto `--ease-entrance`/`--ease-exit`/`--dur-*` tokens, and (b)
  replace the popup spinner with `skelDetailHero()`.
- Phase 6 (optional): re-express open/close via `viewSwap(..., {type:'overlay'})`
  so overlays share the exact same engine as everything else. Even if we keep the
  bespoke CSS, the *timings and feel* are now tokenized and identical.

---

## 8. Phased rollout (each phase is independently shippable)

Ordered so value lands early and risk stays low. Per repo rules, each phase is a
surgical commit set, verified on production before the next.

- **Phase 0 — Foundations (no visible change):** add tokens + the per-type VT CSS
  vocabulary to `shell.css`; add `lib/transitions.js` and `lib/skeleton.js`; fold
  the theme toggle into `viewSwap`. *Ship.* (Pure addition; nothing routes through
  it yet.)
- **Phase 1 — BOOT standardization:** convert all 10 routes to skeleton-first +
  `viewSwap` handoff; add `#wc-main` + `rel=expect`. *Ship.* This alone removes the
  biggest inconsistency (every open/reload now matches) and hardens the VT timeout.
- **Phase 2 — SWAP:** wrap tab/day/filter/accordion/poll re-renders in `viewSwap`;
  add `match-element` to live-refreshed lists. *Ship.*
- **Phase 3 — PROMOTE (Live idle→active + status flips):** the marquee fix. *Ship.*
- **Phase 4 — PAGE types + shared elements:** directional cross-document VT +
  card/portrait/crest morphs + taffy guard. *Ship.*
- **Phase 5 — Speculation prerender (optional, §13):** upgrade prefetch→prerender
  for same-section links so PAGE feels instant. *Ship behind the §13 decision.*
- **Phase 6 — OVERLAY unification (optional):** migrate popup/drawer onto the
  shared engine. *Ship.*

Phases 0–4 deliver full standardization; 5–6 are polish/maximization.

---

## 9. Accessibility, performance, cross-browser, budget

- **Reduced motion:** every archetype must no-op to instant. `viewSwap` checks
  `prefers-reduced-motion` and runs the update synchronously; all new VT CSS sits
  in the existing `@media (prefers-reduced-motion:reduce)` kill-block; skeletons
  still show (they're not motion), but their shimmer is already disabled under
  reduced motion. (The literature is explicit: motion can cause nausea — this is
  non-negotiable.)
- **Performance:** animate only `opacity`/`transform` (VT does this); keep
  `startViewTransition` callbacks to DOM writes only; skeletons are data-free so
  first paint is instant and the **4s cross-document timeout is structurally
  avoided**; verify **no CLS** between skeleton and content (skeleton silhouettes
  must reserve the real content's dimensions).
- **Cross-browser:** VT is Chromium + Safari 18.2+; Firefox rolling out. Every hook
  is guarded (`if (document.startViewTransition)` / `HTMLScriptElement.supports`),
  so unsupported browsers get plain swaps — no breakage. **Test in Arc** explicitly
  (tab-sleeping + built-in blocking differ from Chrome, per repo notes).
- **API budget:** all changes are client-side rendering/animation. **Zero new
  wc2026api requests**; polling cadences (75s list / 1s live / proxy 490-day cap)
  are untouched.

---

## 10. Verification / QA matrix

A change isn't done until this passes (manual matrix + a scripted check where
possible; use a subagent for a final review pass per repo practice):

1. **Boot parity:** direct-load and hard-reload all 10 routes; confirm identical
   shape (chrome → skeleton → reveal), no spinner/boot-text, no blank-then-snap, no
   layout shift. Throttle to Slow 4G to confirm the skeleton (not a blank) shows.
2. **Navigation grammar:** every nav pill; every list→detail (full nav) forward +
   Back; confirm sibling fade vs drill morph and that Back reverses.
3. **In-page:** Stakes tabs, Fixtures day + filter, Groups accordion, and a live
   re-render (use `__wcLiveNavDemo`/test feeds) — none snap.
4. **PROMOTE:** drive Live idle→active via `GET /test/match` (the Brazil–Argentina
   simulator) and confirm the scoreboard promotes, not snaps; confirm nav
   Next→Live flip.
5. **Reduced motion:** repeat 1–4 with `prefers-reduced-motion: reduce`; everything
   instant, nothing broken.
6. **Cross-browser:** Chrome, Arc, Safari, and a non-VT browser (Firefox stable if
   VT absent) — graceful everywhere.
7. **VT health:** `pagereveal` listener logs no `TimeoutError`; flags/crests/
   portraits don't warp; DevTools Animations panel shows clean transitions.
8. **Regression:** goal celebration, theme persistence, popup focus-trap/scroll-
   lock, and live polling all still work.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| 4s cross-document VT timeout drops transitions in prod (cold CDN, slow API) | Skeleton-first BOOT = data-free instant paint; `rel=expect` on `#wc-main`; `pagereveal` timeout logging |
| Shared-element names leak and break the next transition | `viewSwap` always cleans transient names on `finished`; names assigned just-in-time in `pageswap`/`pagereveal` only |
| Image/flag "taffy" on morphs | `object-fit:cover` guard on `.wc-shared` snapshots |
| Skeleton/content size mismatch → CLS | Silhouette builders reserve real dimensions; CLS checked in QA |
| Over-animation feels slow/busy | Durations scale to distance; SWAP stays short (`--dur-2/3`); honor reduced-motion; calm fade-through default |
| Whole-tree Vercel deploy ships unrelated WIP | Keep tree clean; surgical clone-and-push per phase (repo rule) |
| Arc blocking / tab-sleeping differs | Explicit Arc test in QA |
| Firefox/older browsers lack VT | All hooks guarded; plain swaps as fallback |

---

## 12. Constraints honored

- **Off-limits:** `lib/goal-celebration.js` and its `celebrateGoal*` triggers are
  not touched.
- **Icons:** no Unicode glyphs / hand-drawn SVG introduced; any new control uses
  `lib/icons.js` (skeletons are token-driven boxes, no icons needed).
- **Design system:** everything is token-driven (new tokens added to `shell.css`,
  no hardcoded hex); dark + light both verified.
- **Docs/data dispatcher:** styling work routes through `docs/agents/DESIGN_SYSTEM.md`;
  live-pipeline behavior unchanged (`docs/agents/LIVE_DATA.md`).
- **Deploy:** this document is docs-only and is **not** deployed. Implementation
  phases follow the repo's "merge to `main`, verify on production" rule, one
  surgical commit set per phase.

---

## 13. Open decisions for you

These are the only forks where your preference changes the recommendation. My
default is in **bold**; the plan works either way.

1. **Aesthetic register for PAGE/DRILL.** **(a) Calm & minimal** — fast
   fade-through + subtle shared-element morphs (recommended for a data/sports app;
   reads as "fast and precise"). (b) **Expressive** — larger directional slides and
   zoomier morphs (more cinematic, slightly slower). I recommend **(a)**.
2. **Speculation `prerender` (Phase 5).** **(a) Adopt** prerender for same-section
   links → genuinely instant next-page + transition (best-in-class feel), at the
   cost of some background rendering. (b) **Stay on `prefetch`** (current) — safer,
   already good. I recommend **(a)**, conservatively scoped.
3. **OVERLAY engine (Phase 6).** **(a) Tokenize the existing popup/drawer CSS** and
   stop there (lowest risk, already consistent). (b) **Migrate overlays into the VT
   engine** for one unified mechanism. I recommend **(a) now, (b) later**.
4. **Scope of this engagement.** **(a) Plan only** (this document) and you review.
   (b) **Proceed to implement** starting at Phase 0/1. (Per your request this is
   delivered as a plan; say the word and I'll build it phase by phase.)

---

## References

- MDN — *Using the View Transition API* / *View Transition API*:
  https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using ·
  https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Chrome for Developers — *Cross-document view transitions for MPAs*:
  https://developer.chrome.com/docs/web-platform/view-transitions/cross-document
- Chrome for Developers — *Same-document view transitions for SPAs*:
  https://developer.chrome.com/docs/web-platform/view-transitions/same-document
- Chrome for Developers — *What's new in view transitions (2025)*:
  https://developer.chrome.com/blog/view-transitions-in-2025
- CSS-Tricks — *Cross-Document View Transitions: The Gotchas Nobody Mentions*:
  https://css-tricks.com/cross-document-view-transitions-part-1/
- web.dev — *View transitions for single page applications*:
  https://web.dev/learn/css/view-transitions-spas
- MDN — *Speculation Rules API* / *Speculative loading*:
  https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API ·
  https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Speculative_loading
- Chrome for Developers — *Prerender pages for instant navigations*:
  https://developer.chrome.com/docs/web-platform/prerender-pages
- Carbon Design System — *Motion: choreography*:
  https://carbondesignsystem.com/elements/motion/choreography/
- Material Design — *Easing and duration* / *Choreography*:
  https://m3.material.io/styles/motion/easing-and-duration
- Perceived-performance (skeleton vs spinner): NN/g-aligned summaries via
  ui-deploy.com and uxdesign.cc (see search trail).
