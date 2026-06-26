# Pages & routes — the "where do I change X" map

> **Read this if** you're changing a specific page or route (its layout, sections, or
> which module renders it). **Bounce if instead** it's about colors/components →
> [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) · live scores/polling →
> [`LIVE_DATA.md`](./LIVE_DATA.md) · data shapes/joins → [`DATA.md`](./DATA.md) · a new
> cross-cutting feature → [`ARCHITECTURE.md`](./ARCHITECTURE.md).

Every page is a thin `.html` shell in `wc/` whose inline `<script type="module">`
imports from `lib/` and calls one entry function. To change a page, edit its HTML shell
and/or the renderer module(s) it uses. Shared chrome (nav, theme, mobile drawer) is
always `shell.js` + `shell.css`.

For the modules themselves see [`ARCHITECTURE.md`](./ARCHITECTURE.md); for data joins
see [`DATA.md`](./DATA.md); for the live match page internals see
[`LIVE_DATA.md`](./LIVE_DATA.md).

## Route table

| URL | Serves | Entry module(s) | Live data? | Purpose |
|---|---|---|---|---|
| `/wc` → `/wc/fixtures` | redirect | — | — | Default landing. |
| `/wc/fixtures` | `fixtures.html` | inline (uses `api.js`, `data.js`, `flags`, `format`, `icons`, `popup`) | wc2026api | Schedule: a sticky horizontal **day strip** + per-day match rows, with a within-day status filter. Polls live while a match is on. |
| `/wc/groups` | `groups.html` | inline (`api.js`, `data.js` incl. `computeGroupStandings`, `popup`, `icons`) | wc2026api | The 12 group tables as sortable semantic `<table>`s; standings **computed from matches** (the live API returns membership only). |
| `/wc/bracket` | `bracket.html` | inline (`api.js`, `data.js`, `flags`, `format`, `popup`, `icons`) | wc2026api | Knockout bracket with real connector lines (desktop) + a round-tab view (mobile). Renders `*_source` placeholders for undecided slots. |
| `/wc/players` | `players.html` | `render-players.js` (`renderPlayersInto`) + `popup` | static only | Tournament-wide player hub: most-valuable XI, leaderboards, position grids. Reads `players.json`. |
| `/wc/info` | `info.html` | inline + `icons.hydrateIcons` | static | "Data sources" / about page. |
| `/wc/game/:id` | `game.html` → `render-game.js` (`renderGameInto(el, id, {fullPage:true})`) | wc2026api | Match detail: scoreboard, H2H, standings, stats. `:id` is a numeric match id; `test`/`mock` render demo views. Also opens as a popup. |
| `/wc/team/:code` | `team.html` → `render-team.js` (`renderTeamInto`) | wc2026api + static | Team profile: crest, record, squad, fixtures, scorers. `:code` is the FIFA 3-letter code. Also a popup. |
| `/wc/player/:tmId` | `player.html` → `render-player.js` (`renderPlayerInto`) | static | Player dossier: bio, career, market-value chart, honours. `:tmId` is the player id (Transfermarkt id once the Apify sweep runs; otherwise name-based). Also a popup. |
| `/wc/live` | `live.html` → `live-page.js` (`renderLivePage`) | FIFA/ESPN/Sofa | The broadcast-style **live match** experience. Auto-discovers the in-play match; falls back to a countdown when nothing is live. **Different data world** — see `LIVE_DATA.md`. |
| `/wc/color-sim` | `color-sim.html` | inline | none | **Dev tool**, not a user page: previews team color pairings against the theme. |

## How a thin page wires up (pattern)

Every page head runs the same no-flash theme script, loads the Google fonts +
`shell.css`, and module-preloads `shell.js`. The body is a `<main>` with a
`.hero-spacer` (clears the fixed collapsing logo) and a content root. The inline module
then:

```js
import { SHELL_CSS, injectShell } from '/wc/lib/shell.js';
document.getElementById('shell-css').textContent = SHELL_CSS;   // (detail pages also fill #detail-css with the renderer's CSS string)
injectShell({ active: '<navKey>', subtitle: '<page subtitle>' });
// …then import the renderer/data and render into the content root.
```

`injectShell({ active })` highlights the right nav item. Active-state convention for
detail pages: **game → `fixtures`, player → `players`, team → none.**

## Renderer modules and where they're used

| Module | Exports | Used by | Notes |
|---|---|---|---|
| `render-game.js` | `gameCss`, `renderGameInto(el, id, opts)` | `game.html`, `popup.js` | Match detail; delegates to the live overlay when the match is in-play. |
| `render-team.js` | `teamCss`, `renderTeamInto(el, code)` | `team.html`, `popup.js` | Team profile; joins squads + enrichment. |
| `render-player.js` | `playerCss`, `renderPlayerInto(el, id)` | `player.html`, `popup.js` | Player dossier; responsive value chart. |
| `render-players.js` | `playersCss`, `renderPlayersInto(el)` | `players.html` | Tournament-wide leaderboards; static data only. |
| `render-live.js` | `liveCss`, `renderLiveInto(...)` | `render-game.js`, live flows | In-play overlay (stats, timeline). |
| `live-page.js` | `renderLivePage(root)` | `live.html` | The full `/wc/live` app; manages all live polling. ~186 KB. |
| `popup.js` | `enablePopupLinks()` | every page with clickable teams/players/games | Delegated click → modal using the same renderers; focus trap + scroll lock + return-focus. |
| `shell.js` | `SHELL_CSS`, `injectShell`, `revealVisible` | every page | Nav, theme toggle, mobile drawer, scroll-reveal, live/next countdown button. |

## Editing rules for pages

- The restyle agents were told **not to modify** `shell.css`, `shell.js`, `icons.js`,
  `data.js`, `format.js`, `api.js`, `flags.js`, `analytics.js`, `espn.js`, `fifa.js`,
  `sofa.js`, or `goal-celebration.js` from a page task. If your task is genuinely about
  one of those shared modules, that's fine — but a *page* change usually shouldn't touch
  them, and `goal-celebration.js` is **always** off-limits.
- Keep the `<style id="shell-css">` / `<style id="detail-css">` / `<style id="players-css">`
  placeholders and the `injectShell` bootstrap intact — they're load-bearing.
- Don't increase live-API call volume from a page (the wc2026api budget — `LIVE_DATA.md`).
- Verify in the browser you actually use; Chrome and Arc differ (Arc's tab sleeping +
  built-in blocking have bitten this app before).
