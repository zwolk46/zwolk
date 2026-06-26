# Design system — tokens, components, themes, rules

> **Read this if** you're doing any styling, UI, or theming work. **Bounce if instead**
> you need a page's structure/data wiring → [`PAGES.md`](./PAGES.md) · live data →
> [`LIVE_DATA.md`](./LIVE_DATA.md) · the data model → [`DATA.md`](./DATA.md).

The whole app runs on a **token-driven design system with dark + light themes**, defined
once in `lib/shell.css`. That file is the single source of truth for tokens, base
styles, the themed nav/hero/drawer, and a reusable `.wc-*` component library.

**The one rule that matters most: never hardcode a hex color. Use a token so both
themes work.** Everything below is the durable version of the redesign spec (the
original, gitignored, lives at `wc/.handoff/REDESIGN_SPEC.md` with a visual preview).

## Theming mechanics

- The active theme is `data-theme="dark"|"light"` on `<html>`.
- Every page `<head>` runs a tiny inline no-flash script that sets it from
  `localStorage['wc-theme']`, else the device's `prefers-color-scheme`. Keep that script.
- `shell.js` adds the sun/moon **theme toggle** (nav on desktop, drawer on mobile) that
  flips the attribute via a View Transition and persists the choice.
- Tokens are defined in `:root` / `:root[data-theme="dark"]`, overridden in
  `:root[data-theme="light"]`, with a `prefers-color-scheme: light` fallback for
  `:root:not([data-theme])`.
- **Dark is the brand default, but always check light too** — a token that looks fine in
  dark can fail contrast in light. The gold accent is the classic trap (see `--accent`
  vs `--accent-text` below).

## Token vocabulary (all in `shell.css`)

Use these; don't invent literals. Families:

- **Surfaces:** `--bg` (page), `--surface-1` (cards/rows), `--surface-2`
  (raised/hover/sticky header/inputs), `--surface-3` (popover/nested), `--surface-4`
  (modal), `--surface-sunken` (de-emphasized, e.g. finished matches). `--scrim` = overlay dim.
- **Borders:** `--border`, `--border-strong`, `--border-subtle`.
- **Text:** `--text`, `--text-2`, `--text-3`, `--text-disabled`.
- **Gold accent (two distinct roles):**
  - `--accent` = gold **FILL** background, with `--on-accent` for text on top of it.
  - `--accent-text` = gold **TEXT/icon** color (rendered dark-gold in light theme so it
    stays legible). Plus `--accent-hover`, `--accent-quiet` (tint bg), `--accent-line`
    (gold border).
  - Picking the wrong one is the most common theming bug: gold text via `--accent`
    disappears in light mode. Fills → `--accent`; text/icons → `--accent-text`.
- **Status:** `--success`(`-text`/`-quiet`), `--warning`(`-quiet`),
  `--danger`(`-text`/`-quiet`), `--live`(`-quiet`/`-ink`), and `--away`(`-text`/`-quiet`)
  — the **blue** "second side" in head-to-head comparisons.
- **Fonts:** `--f-display` (Anton — display caps + big numbers), `--f-body` (Archivo),
  `--f-mono` (JetBrains Mono — scores/clocks/values; add `font-variant-numeric:tabular-nums`).
- **Scale:** radius `--r-xs/sm/md/lg/xl/pill` (5/9/13/17/24/999), spacing `--sp-1..7`
  (4/8/12/16/24/32/48), shadow `--sh-1..4`, motion `--dur-1/2/3` (.12/.2/.34s) +
  `--ease-out`/`--ease-spring`/`--ease-press`.

## Reusable components (`.wc-*` in `shell.css`)

Reuse these or match them visually; don't rebuild from scratch:

`wc-btn` (+`primary`/`ghost`), `wc-chip` (+`on`, `.n` count), `wc-seg` (segmented; needs
a `wc-seg-thumb` div + a little JS to slide it), `wc-badge`
(`group`/`ko`/`ft`/`sched`/`live`, with a `.d` dot), `wc-card`, `wc-search`,
`wc-stats`/`wc-stat` (`.v`/`.v.y`/`.v.g`/`.l`), `wc-daystrip`/`wc-day`
(`.dow`/`.dnum`/`.dct`, `.on`, `.today`), `wc-splitbar` (flat solid comparison bar — `.a`
gold / `.b` away), `wc-avatar`, `wc-skel` (skeleton), `wc-empty` (`.ic`/`h4`/`p`),
`wc-flag` (+`tbd`). The nav/drawer/live-button internals (`wc-nav-pill`, `wc-drawer*`,
`wc-live-btn`, `wc-theme-btn`, etc.) are owned by `shell.js` — don't reimplement them.

Page-specific class names are fine **as long as they use tokens and match these
visually.**

## Icons — real Lucide only (`lib/icons.js`)

`import { icon } from './icons.js'` (or `/wc/lib/icons.js` from an inline page module),
then `icon(name, { size, stroke, label })`. There's also `hydrateIcons(root)` to fill
`<i data-icon="name">`. **Never hand-draw `<svg>` glyphs.** Common names: search,
volume-2 (pronunciation), calendar-days, git-fork, radio, users, user, info,
sliders-horizontal, list-filter, chevron-{down,right,left}, x, menu, external-link,
map-pin (stadium), clock (kickoff), trophy, sun, moon, cloud-rain/sun, droplets, wind,
thermometer, trending-up/down, star, chart-line, scan-search, shield, globe, flag.

## The two banned "AI tells"

The user specifically dislikes these — do **not** use them:

1. **Gradient progress/comparison bars.** Use flat solid fills (`wc-splitbar`) instead.
2. **Left-edge colored accent stripes** on rows/cards. Use full-row tints, colored
   numbers, or badges instead.

Also: flat surfaces, crisp 1px token borders, restrained `--sh-*` shadows, tasteful
micro-interactions (hover lift `translateY(-2/-3px)`, press `scale(.95)`,
`:focus-visible` outlines) using the motion tokens, and `tabular-nums` on every
score/stat number.

## Responsive

Mobile is a website, not an app — a hamburger → slide-in drawer, **not** a bottom tab
bar (`shell.js` owns this). Design and check at desktop (1240), tablet (768), and mobile
(390 & 360); breakpoints used across the app are 480/768/1024/1440. Several pages have
specific compact layouts below ~760px (e.g. the fixtures match row collapses to 4 cols,
the bracket switches to a round-tab view) — preserve those.

## Accessibility

Real `<button>`/`<a>`/semantic tags, `aria-label` on icon-only controls, `<table>` for
tabular standings, alt/aria on flags where meaningful, visible `:focus-visible`. The
popup system (`popup.js`) already provides a focus trap, `aria-modal`, return-focus, and
scroll-lock — reuse it rather than rolling your own modal.

## When styling, in order

1. Read this doc + the relevant page row in [`PAGES.md`](./PAGES.md).
2. Use tokens for **every** color. Mentally check the light theme too.
3. Reuse `.wc-*` components; match them if you must make page-specific ones.
4. Use Lucide via `icons.js`. No hand-drawn SVG.
5. No gradient bars, no left-edge stripes.
6. Keep behavior, the `injectShell` bootstrap, the `<style id="…">` placeholders, and
   (on the live page) the goal-celebration trigger intact. This is a restyle, not a
   logic rewrite.
