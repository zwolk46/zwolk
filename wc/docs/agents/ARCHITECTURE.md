# Architecture — the mental model

> **Read this if** you're adding a feature, refactoring, deploying, or new to the app.
> **If your task is narrower, bounce now:** one page's wiring → [`PAGES.md`](./PAGES.md) ·
> the data model → [`DATA.md`](./DATA.md) · live scores/polling →
> [`LIVE_DATA.md`](./LIVE_DATA.md) · styling/theming → [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

Read this before any non-trivial change. It is the shared map the other docs hang off.
For data shapes see [`DATA.md`](./DATA.md); for the live pipeline see
[`LIVE_DATA.md`](./LIVE_DATA.md); for styling see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md);
for the per-page wiring see [`PAGES.md`](./PAGES.md).

## What the app is

A World Cup 2026 web app covering all **48 teams, 104 matches, 16 venues, and ~1,250
players** across the group stage and the knockouts (round of 32 → 16 → quarters →
semis → final). It shows the schedule, live scores, group tables, the knockout bracket,
team and player pages, and a broadcast-style live match view.

It is the `/wc` area of the larger `zwolk` personal monorepo. Production:
`https://www.zwolk.com/wc` (redirects to `/wc/fixtures`).

## Tech & constraints

- **Plain static HTML + vanilla ES modules. No build toolchain, no bundler, no npm
  inside `wc/`.** Browsers load the `.html` pages and `import` the `.js` modules
  directly. What you write is what ships.
- **No app backend of its own.** The only server-side code is the monorepo's
  `middleware.js` (auth + two inlined API proxies) and a couple of unrelated
  serverless functions elsewhere in the repo. All app logic is client-side.
- **Deployed on Vercel via GitHub.** A push to `main` on `zwolk46/zwolk` auto-deploys
  to production. The agent push flow (clone to scratch, commit surgically, push with
  the gitignored token) is documented in the **root `CLAUDE.md`** — follow it exactly;
  never print or commit the token.
- **Module style:** every page is a thin `.html` shell with one inline
  `<script type="module">` that imports from `lib/`. Shared logic lives in `lib/*.js`;
  pages stay small.

## The layered model

```
┌────────────────────────────────────────────────────────────────────┐
│  PAGES (thin HTML entry points)                                     │
│  fixtures · groups · bracket · players · info · game · team ·       │
│  player · live   (+ color-sim dev tool)                            │
└───────────────┬────────────────────────────────────────────────────┘
                │ import
┌───────────────▼────────────────────────────────────────────────────┐
│  lib/  — shared modules                                             │
│                                                                     │
│  Shell & UI      shell.js / shell.css (nav, theme, design system)   │
│                  icons.js · flags.js · format.js · popup.js          │
│  Renderers       render-game · render-team · render-player ·         │
│                  render-players · render-live · live-page            │
│  Data access     data.js (static JSON loaders + indices)            │
│  Live clients    api.js (wc2026api, normalized)                     │
│                  fifa.js · espn.js · sofa.js  (live-match sources)   │
│  Live analytics  analytics.js (on-device xG/momentum/win-prob)      │
│  Effects         goal-celebration.js  ⚠ OFF-LIMITS                  │
└───────────────┬───────────────────────────────┬────────────────────┘
                │ static fetch                   │ live fetch
┌───────────────▼──────────────┐   ┌─────────────▼────────────────────┐
│  data/  (checked-in JSON)     │   │  Live sources                     │
│  teams · matches · groups ·   │   │  wc2026api.com  (via /api/wc2026  │
│  stadiums · players ·         │   │     proxy in middleware.js)       │
│  players-by-team              │   │  api.fifa.com   (CORS-open, keyless)│
│  data/enrichment/* (8 sources)│   │  ESPN, SofaScore (via /api/sofa)  │
└───────────────────────────────┘   └───────────────────────────────────┘
```

## Directory map (`wc/`)

| Path | What's there |
|---|---|
| `*.html` | The page entry points (one per route). See `PAGES.md`. |
| `lib/` | All shared JS + the design system (`shell.css`). The heart of the app. |
| `api/wc2026-client.js` | **Legacy/unused.** Superseded by `lib/api.js`. Don't wire new code to it. |
| `data/` | The six core JSON files + `schema.md` + `enrichment/`. |
| `data/enrichment/` | Eight supplementary sources + `manifest.json` + `ENRICHMENT_HANDOFF.md`. |
| `flags/` | 48 country flag SVGs, named by ISO-2 (`flags.js` maps FIFA code → file). |
| `assets/` | Emblem + goal-cannon SVGs. |
| `scripts/` | The data-refresh pipeline (Node `.mjs`) + launchd scheduling. See `scripts/README.md`. |
| `docs/api-reference/` | Per-source API notes. |
| `docs/agents/` | **This documentation hub.** |
| `.handoff/` | Gitignored redesign scratch + visual design preview (historical). |
| `CLAUDE.md` | Auto-loaded source-of-truth for data shapes + the normalization layer. |

## Request lifecycle (what happens on a page load)

1. The `.html` shell sets the theme from `localStorage['wc-theme']` (a tiny inline
   no-flash script) before any paint, loads fonts + `shell.css`, and module-preloads
   `shell.js`.
2. Its inline module imports `shell.js` and calls `injectShell({ active, subtitle })`,
   which builds the nav, the collapsing hero logo, the theme toggle, and the mobile
   drawer, and injects `SHELL_CSS`.
3. The page imports its renderer / data modules and fetches what it needs:
   - **Static** data through `lib/data.js` (cached `fetch` with `cache:'no-cache'`).
   - **Live** data through `lib/api.js` (schedule/groups/bracket/game) or the
     `fifa/espn/sofa` clients (live match page).
4. Renderers build DOM, wire up popups (`popup.js` delegates clicks on
   `data-popup-team/player/game`), and (where relevant) start a polling loop gated on
   whether a match is live and the tab is visible.

## Routing (Vercel `vercel.json`, repo root)

`cleanUrls` is on, so `/wc/fixtures` serves `wc/fixtures.html`. Plus:

- `/wc` and `/wc/` → redirect to `/wc/fixtures`.
- `/wc/game/:id` → rewrite to `wc/game.html` (the page parses the id from the URL).
- `/wc/team/:code` → `wc/team.html`.
- `/wc/player/:tmId` → `wc/player.html`.

So detail pages are real shareable URLs; the page reads its id/code from
`location.pathname`. The same renderers also power in-page **popups** (no navigation).

## Auth & the proxies (`middleware.js`, repo root)

The whole site sits behind a session-cookie password, **except**: the landing page and
a few public sections, and — importantly — **preview/branch deploys open `/wc` and its
data proxies** (`VERCEL_ENV !== 'production'`) so the app is testable without the
password. Production is unaffected.

Two API proxies are **inlined into `middleware.js`** (to stay under Vercel's Hobby
12-function cap) and run only after the auth check:

- `/api/wc2026/*` → `api.wc2026api.com` with the Bearer key, a **490/day hard cap**,
  and a ~25s KV cache. Details in `LIVE_DATA.md`.
- `/api/sofa/*` → `api.sofascore.com` with browser-like headers + a short cache,
  best-effort.

FIFA and ESPN are **CORS-open and keyless**, so the live page calls them directly from
the browser with no proxy.

## Conventions worth knowing

- **Join key is the FIFA 3-letter code** (`fifa_code` / `code`, e.g. `FRA`, `USA`) for
  team-level enrichment; the live API's name spellings are mapped to codes via
  `TEAM_NAME_ALIASES` in `lib/data.js`. Player/squad joins are by **country name** with
  fuzzy fallbacks. See `DATA.md`.
- **All kickoff times display in US Eastern** (`America/New_York`) — the tournament is
  in North America. Formatters live in `lib/format.js`.
- **Market values** are EUR integers; format via `format.js` (`€80m`, `€750k`, `—`).
- **Never hardcode colors.** Use design tokens (`DESIGN_SYSTEM.md`).
- **`lib/goal-celebration.js` and its `celebrateGoal*` triggers are off-limits** — the
  hand-built goal celebration must not be modified.
- **`api/wc2026-client.js` is dead code** — `lib/api.js` is the live client.

## Deploy reminder

Frontend/route/runtime changes auto-deploy (root `CLAUDE.md`). **Documentation-only
changes (like edits in this folder) do not deploy** and don't need to. The recurring
production failure mode is *new files created locally but never committed* — before
finishing, confirm every new/edited file is in the commit and that production serves it.
