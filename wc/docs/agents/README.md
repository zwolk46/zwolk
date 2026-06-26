# World Cup 2026 App — Agent Documentation Hub

**Every agent working on the World Cup app should start here.** This file is the
router. It tells you, by task, which document to read so you have enough context to
work safely without re-deriving the app from the code.

> The same routing table is mirrored at the top of `wc/CLAUDE.md` (which auto-loads into
> every agent's context), so you usually don't even need to open this file — you'll have
> been routed already. **Open the ONE doc whose triggers match your task; add
> `ARCHITECTURE.md` only for structural/cross-cutting work. Don't read all of them.**

The World Cup app is the `/wc` section of the `zwolk` monorepo. It lives entirely in
`wc/` and is served at `https://www.zwolk.com/wc`.

---

## How this documentation is organized

There are two tiers of docs, plus this router:

**Durable reference (this `docs/agents/` folder) — read by purpose:**

| Doc | Read it when you are… | One-line summary |
|---|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | doing **anything** non-trivial | The mental model: how the app is built, the file map, request lifecycle, and conventions. The "all agents read this" doc. |
| [`PAGES.md`](./PAGES.md) | changing a **page or route** | Per-page reference: every URL, its entry HTML, the modules it imports, and the data it reads. Your "where do I change X" map. |
| [`DATA.md`](./DATA.md) | touching **data, joins, or enrichment** | The data model: static vs. live split, every data file's shape, the join keys, the enrichment layer, the refresh pipeline, and the Apify blocker. |
| [`LIVE_DATA.md`](./LIVE_DATA.md) | touching **live scores or the live page** | The live pipeline: the wc2026api proxy + budget, the FIFA/ESPN/SofaScore sources, polling cadences, and response normalization. **Read before changing any polling.** |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | doing **any styling/UI** work | The durable design spec: tokens, components, dark/light theming, icons, fonts, responsive rules, and the two banned "AI tells". |

**Source-of-truth files already in the repo (kept; this hub points to them):**

| File | What it covers |
|---|---|
| `wc/CLAUDE.md` | Auto-loaded project instructions. Live-API field shapes, the normalization layer, polling rules, design-system pointer. Authoritative for data shapes. |
| `wc/data/schema.md` | Field-by-field schema for the six core data files. |
| `wc/scripts/README.md` | The data pipeline / refresh scripts, credentials, scheduling, and the Apify blocker. |
| `wc/docs/api-reference/` | Per-source API notes (wc2026api, FIFA, ESPN-adjacent, Forvo, Kaggle, Open-Meteo, TheSportsDB, etc.). `INDEX.md` lists them. |
| `wc/data/enrichment/ENRICHMENT_HANDOFF.md` + `manifest.json` | The eight enrichment sources, their schemas, and live record counts. |
| Root `CLAUDE.md` + `AGENTS.md` | Repo-wide rules: the deploy/push flow and when to auto-deploy. |

> The `wc/.handoff/` folder holds gitignored, time-stamped redesign handoffs and a
> visual design-system preview. It is historical scratch — useful color, but
> `DESIGN_SYSTEM.md` here is the durable version. Don't rely on `.handoff/` surviving.

---

## Fast routes by task

- **"Change how a page looks"** → `DESIGN_SYSTEM.md` (tokens + rules) then the page row in `PAGES.md`.
- **"Add/fix a fixture, group, or bracket feature"** → `PAGES.md` + `DATA.md` (joins) + `LIVE_DATA.md` (if scores are involved).
- **"The live match page / scores / clock"** → `LIVE_DATA.md` first, then `PAGES.md` (live row). Note `lib/goal-celebration.js` is **off-limits**.
- **"Player or team page"** → `PAGES.md` + `DATA.md` (player/squad shapes, the Apify market-value blocker).
- **"Refresh or rebuild data"** → `DATA.md` + `wc/scripts/README.md`.
- **"Deploy my change"** → root `CLAUDE.md` (the clone-and-push flow; do **not** push secrets).

---

## Five things that are true of the whole app (the short version)

1. **No build step.** Plain HTML + ES modules, served static. No npm/bundler in `wc/`.
   Edit a file, it ships. (Deploy = push to `main`; see root `CLAUDE.md`.)
2. **Static spine + live overlay.** Almost everything (teams, schedule, squads,
   enrichment) is checked-in JSON read at load. Only **scores, phase, standings, and
   match stats** are fetched live. See `DATA.md` / `LIVE_DATA.md`.
3. **Two live worlds.** The schedule/groups/bracket/game pages use **wc2026api.com**
   through a budgeted proxy (`/api/wc2026`, 490/day cap). The **live match page**
   (`/wc/live`) uses **FIFA/ESPN/SofaScore** directly. Don't confuse them.
4. **One design system.** `lib/shell.css` holds all tokens + components for dark and
   light themes. Never hardcode a hex color. See `DESIGN_SYSTEM.md`.
5. **Graceful degradation everywhere.** Live sources fall back to checked-in samples
   or on-device models so a flaky API never white-screens the app.

---

## Keeping these docs honest

When you change something structural — a new page, a new data file, a changed polling
cadence, a renamed module — update the relevant doc here in the same change. These docs
are only useful to the next agent if they match the code. If you find a doc that's
already wrong, fix it; note the correction in your summary.
