# Live data — proxies, sources, polling, normalization

> **Read this if** you're touching live scores/standings/match-stats, any polling
> cadence, or the live match page. **Bounce if instead** it's static data files/joins →
> [`DATA.md`](./DATA.md) · a page's layout → [`PAGES.md`](./PAGES.md) · styling →
> [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

**Read this before changing anything that polls or fetches live data.** The biggest
operational risk in this app is burning the wc2026api daily budget and getting the key
auto-disabled. There are two distinct live worlds; don't confuse them.

## The two live worlds

| World | Used by | Source | Auth | Budget |
|---|---|---|---|---|
| **Schedule/standings** | fixtures, groups, bracket, game (`/wc/game/:id`) | **wc2026api.com** via the `/api/wc2026` proxy, wrapped by `lib/api.js` | Bearer key (server-side, in `middleware.js`) | **490 req/day hard cap** |
| **Live match** | `/wc/live` (`live-page.js`) and the in-play overlay | **FIFA** (`api.fifa.com`) + **ESPN** + **SofaScore** | FIFA/ESPN keyless & CORS-open; Sofa via `/api/sofa` proxy | No hard cap; tuned cadences |

## World 1 — wc2026api.com (`lib/api.js` + the proxy)

### The proxy (`middleware.js`, inlined)

- Path: `/api/wc2026/*` → `https://api.wc2026api.com/*`, only after the auth check
  (so anonymous users can't burn the budget). The Bearer key never leaves the function.
- **`WC_DAILY_CAP = 490`** (under the 500/day Pro key's auto-disable threshold),
  tracked per UTC day in Upstash KV via `INCR`. Over the cap → `429`.
- **KV response cache**: ~25s for `/matches`, `/groups`, `/matches/:id`; 20s for stats;
  5s for the test match; ~600s for teams/stadiums. **Cache hits don't count against the
  cap.** If KV is down, the proxy fails *open* (serves rather than denies).
- Allowed upstream paths only: `/teams`, `/matches`, `/matches/:id`,
  `/matches/:id/stats`, `/groups`, `/stadiums`, `/test/match`.

### The client (`lib/api.js`) — always go through it

Exports: `getTeams`, `getStadiums`, `getMatches(opts)`, `getLiveMatches`,
`getMatch(id)`, `getMatchStats(id)`, `getGroups`, `getTestMatch`, plus the pure
normalizers `normalizeMatch`, `normalizeStatus`, `normalizeRound`, `normalizeGroups`.

It exists because **the real API differs from the original spec**. The normalization it
applies (also documented in `wc/CLAUDE.md`):

| Upstream reality | Normalized to | Why |
|---|---|---|
| `status: "completed"` | `"finished"` | The whole UI checks `finished` |
| penalty finish = `phase:"FT"` + `home_pen`/`away_pen` | `phase: "FT_PEN"` | UI shows "(pens)" only on `FT_PEN` |
| `/groups` returns membership only (`{id,name,teams}`) | `{ group_name, teams, standings:null }`; standings **computed from matches** | API has no table |
| knockout slots: null teams, no source text | `home_team_source`/`away_team_source` **backfilled from `data/matches.json` by `match_number`** | live & static use different ids; lets the bracket show "Winner Group A" |
| short round codes `R32/R16/QF/SF/3rd` | long codes `round_of_32`… via `normalizeRound()` | app + static schedule use long codes; without this the bracket only rendered the Final |

`/matches/:id/stats` returns `{ stats, timeline:[{team:CODE,type,minute,player}] }` with
`type ∈ goal, own_goal, yellow_card, red_card`; the golden boot is aggregated from these.

### Polling budget — the rule

- **On load:** fetch `/matches` once (returns every match → all scores at once); fetch
  `/groups` once. Don't loop these.
- **Decide the live window from data already in memory:** any match `status==='live'`,
  or `phase ∈ {1H,2H,ET1,ET2,PEN}`, or a kickoff imminent.
- **Outside a live window: do not poll on a timer.** Refresh on load / user action only.
- **Inside a live window:** poll the **collection** endpoint (`getMatches`), never
  `getMatch(id)` per match. `fixtures.html` uses **75s** (`POLL_LIVE_MS`), gated by
  `shouldPollLive()` and `document.hidden`. The proxy's 490/day cap + 25s cache are the
  backstop.
- **Do not drop to 30s.** The original spec's "30s live" would blow a 500/day key over
  an 8-hour match day. 75s is deliberate. Keep cadence constants in one config object.
- Develop before kickoff against `GET /test/match` (`getTestMatch()`) — a fictional
  match that cycles every phase in real time.

## World 2 — the live match page (`live-page.js`, `fifa.js`, `espn.js`, `sofa.js`)

The `/wc/live` page is a separate, richer pipeline. FIFA is the spine; ESPN and
SofaScore enrich it; an on-device model (`analytics.js`) is the floor. **Every external
call resolves to `null`/`[]` on failure so a flaky source never breaks the page.**

### Sources

| Client | Source | Auth | Provides | Join |
|---|---|---|---|---|
| `fifa.js` | `api.fifa.com/api/v3` (competition `17`, season `285023`) | **none, CORS-open, no proxy** | Live score, clock, events, timeline, lineups, standings, team form, calendar | By **MatchNumber** = `matches.json.match_number`; country ids are FIFA codes (line up with `teams-48`) |
| `espn.js` | `site.api.espn.com/.../soccer/fifa.world` | none, CORS-open | Live text commentary, richer box score, pre-match odds (→ win-prob prior), team colors | By date + team 3-letter codes (`ESPN_CODE_ALIASES` for the few that differ) |
| `sofa.js` | `api.sofascore.com` via **`/api/sofa`** proxy | proxy adds browser-like headers + short cache | Official xG, attack momentum, full stats table, shotmap | Discover event by date + codes/names |
| `analytics.js` | none (on-device) | — | xG model, momentum, win probability, baselines | computes from FIFA timeline |

> SofaScore sits behind Cloudflare and may refuse the datacenter IP even through the
> proxy. That's expected; the page falls back to the on-device model.

### Polling cadences (`CFG` in `live-page.js`)

| Stream | Constant | Cadence |
|---|---|---|
| FIFA score/clock/events (live) | `FIFA_MS` | **1s** |
| FIFA when frozen (HT/FT) | `FIFA_MS_FROZEN` | 20s |
| ESPN commentary + box score | `ESPN_MS` | 7s |
| SofaScore xG/momentum | `SOFA_MS` | 20s |
| Local clock re-render | `CLOCK_MS` | 250ms (4×/s, seconds roll smoothly) |
| "updated …" freshness badge | `FRESH_MS` | 500ms |
| Idle re-scan for a kickoff | `EMPTY_MS` | 30s |
| Keep showing a match after FT | `POST_FT_LIVE_MS` | 15 min |

The 1s FIFA cadence is fine — FIFA is keyless and uncapped, and frozen periods slow to
20s. The page never hardcodes a match id: `findLiveMatch()` scans the FIFA calendar for
whatever is in-play, or takes `?m=<matchNumber>`. The local clock ticks every 250ms but
is corrected to the feed's minute on each poll.

### Off-limits

`lib/goal-celebration.js` and its `celebrateGoal*` triggers in `live-page.js` are the
hand-built goal celebration — **do not modify them.** You can read the top comment for
the trigger signature (`playGoalCelebration({iso, teamName, playerName, minute, speed})`).

## If you're adding or changing live behavior

1. Decide which world you're in. Schedule/group/bracket/game → `lib/api.js` + the
   budget rules. Live match page → the FIFA/ESPN/Sofa clients.
2. Never call wc2026api directly with `fetch` from page code — go through `lib/api.js`.
3. Never raise wc2026api call volume or lower the 75s fixtures cadence without checking
   the 490/day math.
4. Keep every external call best-effort with a fallback. Test against `/test/match` and
   `/wc/game/mock` / `/wc/live` before real matches.
5. Update the cadence table above if you change a constant.
