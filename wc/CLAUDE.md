# CLAUDE.md — World Cup 2026 App

> **Read this file before writing any code.** It is the single source of truth for
> data shapes, the live API, polling rules, and how the files relate.

---

## ⚠️ Data status: SAMPLE data is checked in (not the real dataset)

The files in `data/` currently hold **small, illustrative samples** so you can build
and test against a realistic structure. They are **not** the full tournament data:
12 of 48 teams, 5 of 104 matches, 4 teams with 5-player squads each. Group draws,
scores, and all market values are invented for illustration. See
`data/SAMPLE_DATA_NOTICE.md` and `data/schema.md`.

**Confirmed vs. inferred field names:**

- **Confirmed** against the live wc2026api.com response: the `matches` fields
  (`id`, `match_number`, `round`, `group_name`, `home_team`, `away_team`, `stadium`,
  `kickoff_utc`, `status`, `phase`). Note they are **snake_case**.
- **Inferred** (verify against the first real response): the `teams`, `groups`, and
  `stadiums` shapes, the match `home_score` / `away_score` / `home_team_source` /
  `away_team_source` fields, and the entire Transfermarkt `players` shape (that one
  follows our normalization spec, not a raw API).

When you fetch real data (see the last section), reconcile field names first, then
adjust the loaders and `data/schema.md`.

---

## Section 1 — Project overview

A World Cup 2026 web app tracking all **48 teams, 104 matches, and ~1,250 players**
across the group stage and the knockout rounds (round of 32 → round of 16 →
quarterfinals → semifinals → final).

- Standalone **HTML/JS** app: **no build toolchain, no npm, no bundler**.
- The app has **no backend** — all API calls are made client-side.
- Planned pages: tournament bracket/schedule, team pages, player pages, group
  standings, match detail view.

> Note on rounds: the API's confirmed `round` value for group matches is `"group"`.
> The knockout `round` values (e.g. `round_of_32`, `round_of_16`, `quarter_final`,
> `semi_final`, `final`) are **placeholders** in the sample — confirm the exact
> strings against a real `/matches` response before hardcoding them.

---

## Section 2 — Static data files

These six files are **loaded once at startup and kept in memory**. They never need
to be re-fetched from Transfermarkt. The **only** data needing live network calls is
match/score/phase/standings data from wc2026api.com (Section 3).

| File | Contents |
|---|---|
| `data/teams.json` | Array of the 48 national teams. |
| `data/matches.json` | Array of all 104 fixtures/results. |
| `data/groups.json` | Group standings (12 groups). Also fetched live during the tournament. |
| `data/stadiums.json` | The 16 host venues. |
| `data/players.json` | Flat array of every player (one entry per player). |
| `data/players-by-team.json` | Players grouped by country, sorted by market value desc. |

Full field-by-field documentation is in **`data/schema.md`**. Key shapes:

**`teams.json`** — `[{ id, name, code, group, flag, totalMarketValueEur, averageMarketValueEur }]`
- `code` is the 3-letter country code (e.g. `"FRA"`).
- `totalMarketValueEur` / `averageMarketValueEur` are **pre-computed** from the
  team's players (see Section 5). They are `null` for any team without player data.

**`matches.json`** — confirmed snake_case shape:
```json
{
  "id": 11,
  "match_number": 11,
  "round": "group",
  "group_name": "C",
  "home_team": "France",
  "away_team": "Spain",
  "stadium": "MetLife Stadium",
  "kickoff_utc": "2026-06-14T21:00:00.000Z",
  "status": "live",
  "phase": "2H",
  "home_score": 1,
  "away_score": 1,
  "home_team_source": null,
  "away_team_source": null
}
```
- `home_team` / `away_team` are **team name strings** (not ids) and are `null` for
  undecided knockout slots — in which case `home_team_source` / `away_team_source`
  describe how the slot fills (e.g. `"Winner Group A"`, `"Winner of Match 14"`).
  Surface the source text in the UI wherever participants are shown.

**`players.json`** — one entry per player; normalized fields documented in `schema.md`.
The important ones: `tmId` (string id), `name`, `nationalTeam`, `position`,
`currentClub`, `marketValueEur` (integer), `marketValueHistory[]`, `tmUrl`.

**`players-by-team.json`** — object keyed by **country name** (matching `teams.json`
`name` exactly); each value is that team's players sorted by `marketValueEur` desc.

---

## Section 3 — Live data (wc2026api.com)

Scores, match `phase`, `status`, and group standings change as the tournament
progresses and **must be fetched live** from wc2026api.com. Everything in Section 2
is static and never needs re-fetching.

- **Base URL:** `https://api.wc2026api.com`
- **Auth:** every request needs the header `Authorization: Bearer <YOUR_KEY>`
- **Always go through `api/wc2026-client.js`** — never call `fetch` to the API directly
  from page code.
- Interactive docs: `https://api.wc2026api.com/docs`

### 🚨 Rate limit — design polling around this FIRST

The Pro plan is **~500 requests per DAY**, and **the key auto-disables if you exceed
it.** This makes naive polling dangerous:

- "Poll every 30s" = 120 req/hour → the daily budget is gone in **~4 hours**, key disabled.
- Even "poll every 3 min, 24/7" = **480 req/day** → the entire budget, leaving nothing.

**Budget-safe strategy (use this):**

1. **On app load:** fetch `/matches` once (and `/groups` once) before rendering. One
   `/matches` call returns every match, so it refreshes all scores at once.
2. **Decide if you're in a live window** from the data already in memory: are any
   matches `status === 'live'`, or is any `phase` one of `1H, 2H, ET1, ET2, PEN`?
   You can also derive upcoming windows from `kickoff_utc` in `matches.json`.
3. **Outside a live window:** do **not** poll on a timer. Refresh on user action /
   page load only, or at most a few times a day.
4. **Inside a live window:** poll the **collection** endpoint (`getMatches()` /
   `getLiveMatches()`) **once every 60–90 seconds** — never `getMatch(id)` per match.
   At 90s, an 8-hour match day ≈ 320 requests; comfortably under 500.
5. If you genuinely need 30-second live updates, **upgrade to the 3,000/day tier**
   rather than risking the key.

> The original task spec suggested "3 min normal / 30s live." That 30s figure will
> disable a 500/day key — the strategy above is the corrected version. Keep all
> polling-cadence constants in one config object so they're easy to tune.

### Develop before kickoff with `/test/match`

Real matches start **June 11, 2026**. Until then, build and test all live-update UI
against `GET /test/match` (via `getTestMatch()`): a fictional Brazil vs Argentina
match that cycles through every `phase` in real time. Works with any valid key.

### Endpoints

All paths are relative to `https://api.wc2026api.com`. All are `GET`. All require the
`Authorization: Bearer <key>` header.

| Function in client | Method & path | Query params | Notes |
|---|---|---|---|
| `getTeams()` | `GET /teams` | — | All 48 teams. |
| `getMatches(opts)` | `GET /matches` | `team` (code, e.g. `NED`), `status`, `round`, `group` | Returns all matches, or a filtered subset. |
| `getLiveMatches()` | `GET /matches?status=live` | — | Convenience filter for the polling loop. |
| `getMatch(id)` | `GET /matches/:id` | — | One match. |
| `getMatchStats(id)` | `GET /matches/:id/stats` | — | Possession, shots, corners, fouls, cards + minute-by-minute timeline. Meaningful once a match has started. |
| `getGroups()` | `GET /groups` | — | Live standings for all 12 groups. |
| `getStadiums()` | `GET /stadiums` | — | 16 venues. |
| `getTestMatch()` | `GET /test/match` | — | Dev-only simulated match. |

**Sample `/matches?team=NED` response (confirmed shape, snake_case):**
```json
{
  "id": 11,
  "match_number": 11,
  "round": "group",
  "group_name": "F",
  "home_team": "Netherlands",
  "away_team": "Japan",
  "stadium": "AT&T Stadium",
  "kickoff_utc": "2026-06-14T21:00:00.000Z",
  "status": "scheduled",
  "phase": "PRE"
}
```
> Confirm whether the unfiltered `/matches` returns a bare array `[ {...} ]` or a
> wrapper like `{ "data": [ ... ] }`, and whether finished matches add `home_score` /
> `away_score`, on the first real call. Adjust the client/loaders accordingly.

**Sample `/groups` and `/stadiums` shapes** are inferred — see `data/groups.json`,
`data/stadiums.json`, and `data/schema.md`. Verify against the live response.

---

## Section 4 — Phase & status reference

`phase` (per match) — confirmed values:

| Value | Meaning |
|---|---|
| `PRE` | Pre-match, not yet kicked off |
| `1H` | First half in progress |
| `HT` | Halftime break |
| `2H` | Second half in progress |
| `ET1` | First period of extra time |
| `ET2` | Second period of extra time |
| `PEN` | Penalty shootout in progress |
| `FT` | Full time, finished in 90 minutes |
| `FT_PEN` | Full time, decided by penalties |

`status` values: `scheduled`, `live`, `finished`.

**Treat `phase ∈ {1H, 2H, ET1, ET2, PEN}` (or `status === 'live'`) as the trigger for
the live-polling window** (Section 3).

**Knockout slots:** knockout matches may have `home_team` / `away_team` as `null`
until the qualifying teams are decided. When null, read `home_team_source` /
`away_team_source` (e.g. `"Winner Group A"`, `"Winner of Match 14"`) and display that
placeholder text wherever teams would appear (bracket, schedule, match detail).

---

## Section 5 — Data relationships (how to join the files)

- `matches.json` → `home_team` / `away_team` (name strings) → match by `name` in
  `teams.json`. (Knockout: may be `null`; fall back to `*_source` text.)
- `matches.json` → `stadium` (name string) → match by `name` in `stadiums.json`.
- `matches.json` → `group_name` → match by `group` in `teams.json` / `group_name`
  in `groups.json`.
- `teams.json` → `name` → key in `players-by-team.json` (exact string match).
- `players.json` → `nationalTeam` → key in `players-by-team.json`.
- `players.json` can be indexed by `tmId` for **O(1)** player lookups — build a
  `Map(tmId → player)` once at startup.
- `teams.json` → `totalMarketValueEur` and `averageMarketValueEur` are
  **pre-computed** — do **not** re-sum player values at runtime.

> Join key is the **country name string**, so it must match byte-for-byte across
> files (e.g. `"United States"` everywhere, not `"USA"`). `code` (`"USA"`) is for
> display/flags, not joining.

---

## Section 6 — Architecture notes

- Load all six static JSON files at app startup; store them in a single global state
  object (e.g. `const DB = { teams, matches, groups, stadiums, players, playersByTeam }`).
  Also build `DB.playerById = new Map(players.map(p => [p.tmId, p]))`.
- All wc2026api.com calls go through `api/wc2026-client.js` (ES module: `import { getMatches } from './api/wc2026-client.js'`).
- Transfermarkt data is complete for the tournament once fetched — **no re-fetching**.
- **Market value formatting:** values are EUR integers (e.g. `80000000` = €80M).
  Format for display by magnitude: `>= 1_000_000` → `"€Xm"` (e.g. `"€80m"`);
  `< 1_000_000` → `"€Xk"`. Example helper:
  ```js
  function formatEur(v) {
    if (v == null) return "—";
    if (v >= 1_000_000) return `€${+(v / 1_000_000).toFixed(1)}m`.replace(".0m", "m");
    if (v >= 1_000)     return `€${Math.round(v / 1_000)}k`;
    return `€${v}`;
  }
  ```
- If building multiple HTML pages, each can load the same static JSON files and import
  the same client module.
- Keep all polling cadence values (`LOAD`, `IDLE`, `LIVE_INTERVAL_MS`) in one config
  object so the rate-limit budget is easy to tune.

---

## Replacing the sample data with real data

When you're ready to swap the samples for the full dataset, run these once and write
the results into `data/`. (Do this in your own environment with your own keys — never
commit keys.)

### 1. Tournament data (wc2026api.com)

```
GET https://api.wc2026api.com/teams     -H "Authorization: Bearer <WC_KEY>"  → data/teams.json
GET https://api.wc2026api.com/matches   -H "Authorization: Bearer <WC_KEY>"  → data/matches.json
GET https://api.wc2026api.com/groups    -H "Authorization: Bearer <WC_KEY>"  → data/groups.json
GET https://api.wc2026api.com/stadiums  -H "Authorization: Bearer <WC_KEY>"  → data/stadiums.json
```
Mind the 500/day limit — four calls is nothing, but don't loop these.

### 2. Player data (Transfermarkt via Apify)

Use the **`solidcode/transfermarkt-scraper`** actor (~$1 per 1,000 results; it scrapes
Transfermarkt, so respect their terms and don't over-run it).

1. `POST https://api.apify.com/v2/acts/solidcode~transfermarkt-scraper/runs?token=<APIFY_TOKEN>`
   with the WC participants URL
   (`https://www.transfermarkt.us/weltmeisterschaft/teilnehmer/pokalwettbewerb/FIWC/saison_id/2025`)
   and `includeClubSquad: true`. Save the `id` and `defaultDatasetId`.
2. Poll `GET …/runs/<runId>?token=…` every 60s until `status` is `SUCCEEDED`/`FAILED`.
3. Download `GET https://api.apify.com/v2/datasets/<defaultDatasetId>/items?format=json&token=…`.
4. If you get **< 100 records**, the national-team competition expansion didn't fire —
   fall back to scraping the **48 individual squad pages** instead
   (`…/{slug}/kader/verein/{id}/saison_id/2025`).

### 3. Normalize & enrich

- Map each raw player into the `players.json` shape in `data/schema.md` (extract
  `tmId` from the profile URL `/spieler/<id>`).
- Build `players-by-team.json` keyed by `nationalTeam`, each list sorted by
  `marketValueEur` desc.
- For each team, set `totalMarketValueEur = sum(player.marketValueEur)` and
  `averageMarketValueEur = mean(...)`, then rewrite `teams.json`.

Then update `data/schema.md` and the "Confirmed vs. inferred" note at the top of this
file to reflect the real field names you observed.

---

*wc2026api.com is an unofficial fan project (not affiliated with FIFA). This app is
for personal/non-commercial use; respect both APIs' terms and rate limits.*

---

## Enrichment Data (`data/enrichment/`)

Eight supplementary, pre-baked data sources sit in `data/enrichment/`. Full schemas,
examples, and integration notes are in **`data/enrichment/ENRICHMENT_HANDOFF.md`** and
**`data/enrichment/manifest.json`**. Summary:

> **Join convention:** every per-team enrichment file is an object **keyed by FIFA
> 3-letter code** (= `teams.json.code`), not by name — names differ across sources.
> Head-to-head is keyed by the sorted code pair, e.g. `"ARG_BRA"`. The 48-team field
> and 16 venues were derived from openfootball (`teams-48.json`) because the checked-in
> `teams.json`/`stadiums.json` are still the 12-team/6-venue sample.

| File | What it powers | Join | Refresh |
|---|---|---|---|
| `countries.json` | country/languages panel (capital, population, languages, currencies, flags, borders, tz) | by code | static |
| `head-to-head.json` | pre-game H2H block the live API can't provide (1128 pairings) | sorted code pair | static |
| `elo-ratings.json` + `fifa-rankings.json` | predictive-vs-official strength contrast | by code | FIFA: refresh during tournament (official frozen 2026-06-11) |
| `team-all-time-records.json` | all-time W/D/L per team | by code | static |
| `stadium-weather.json` | match-day weather per venue | by stadium name + date | **refresh forecast at build time** (16-day window) |
| `worldcup-history/{year}.json` | historical tournament context on team pages | — | static |
| `sportsdb-teams.json` | team badges, stadium imagery, socials, RSS news (47/48; Jordan absent) | by code | static |
| `pronunciations.json` | tap-to-hear player/country name audio (Forvo, attribution required) | by name | static (46/48 countries + 14/20 sample players have audio) |

Sources: REST Countries data via the keyless mledoze upstream + World Bank (v3.1 was
deprecated mid-2026); Elo + head-to-head from Kaggle (no key needed for public
downloads); openfootball (public domain); Open-Meteo (keyless); TheSportsDB (free demo
key `123`); FIFA public ranking endpoint (no key); Forvo (paid Non-Profit plan).

**`data/enrichment/keys.local.json` holds API keys and is gitignored — never commit it.**
The **weather forecast** and **FIFA ranking** files are the two that benefit from a
refresh closer to / during the tournament.

---

## Live API: real response shapes (verified) + the normalization layer

The live wc2026api.com responses differ from the original spec above, so **all live
calls are normalized in `lib/api.js`** (every page imports this; `api/wc2026-client.js`
is unused). Verified differences and how they're handled:

| Area | Real live response | Normalized to |
|---|---|---|
| `match.status` | `scheduled` / `live` / **`completed`** | `completed` → **`finished`** (the value the whole UI checks) |
| Penalty finish | `phase:"FT"` + `home_pen`/`away_pen` | `phase:"FT_PEN"` so the UI shows "(pens)" |
| `/groups` | `{ id, name, teams:[{name,code}] }` — **membership only, no table** | `{ group_name, teams, standings:null }`; standings **computed from matches** via `data.computeGroupStandings()` |
| Knockout slots | null teams, **no source text** | `home_team_source`/`away_team_source` backfilled from `data/matches.json` **by `match_number`** (live & static use different `id`s) |
| Team names | `Czechia`, `Korea Republic`, `Côte d'Ivoire`, `IR Iran`, `Congo DR`, `Cabo Verde`, `Bosnia-Herzegovina` | resolved via `TEAM_NAME_ALIASES` in `lib/data.js` → canonical FIFA code |

`/matches/:id/stats` returns `{ stats, timeline:[{team:CODE,type,minute,player}] }` —
`type ∈ goal, own_goal, yellow_card, red_card`. Golden boot is aggregated from these.

> Polling: `fixtures.html` polls the **collection** endpoint every **75s** while a match
> is live (gated by `shouldPollLive()` + `document.hidden`), fresh-on-load otherwise.
> This is deliberately **not** the 30s from the original spec — at 30s an 8-hour match
> day would blow the 500/day key. The proxy adds a 490/day hard cap + ~25s cache.

## Enrichment the UI now reads (added in Task B)

- `tournament-scorers.json` — golden boot / per-team scorers (team page "Tournament
  scorers" section), rebuilt from live timelines by `scripts/build-scorers.mjs`.
- `sportsdb-player-thumbs.json` — fallback player photos (player portrait), keyed by
  name, extended by `scripts/build-player-thumbs.mjs`.

## Staying current with no upkeep

`scripts/refresh-data` (idempotent) re-fetches the refreshable sources, and a daily
user-level **launchd** agent runs it (install via
`scripts/install-refresh-launchd.command`, remove via the `uninstall-` twin). Full
table of what's static vs refreshable, the credentials each source needs, and the
**Apify player-value blocker** are in **`scripts/README.md`**. The manifest
(`data/enrichment/manifest.json`) is rebuilt every run and is the source of truth for
record counts and refresh classes.

---

## Design system & theming (2026 UI redesign) — READ BEFORE STYLING ANYTHING

The whole app was moved onto a **token-driven design system with dark + light themes**.
`lib/shell.css` is now the single source of truth for tokens, base styles, the themed
nav/hero/drawer, AND a reusable component library. **Never hardcode a hex color again** —
use a token so both themes work. A faithful component reference lives at
`.handoff/wc26-design-system-preview.html` (gitignored) and the research library at
`.handoff/ui-research/` (8 cited files).

**Theming.** `data-theme="dark"|"light"` on `<html>`. Every page `<head>` runs a tiny
inline no-flash script that sets it from `localStorage['wc-theme']`, else the device's
`prefers-color-scheme` (default per the user). `shell.js` adds a sun/moon **theme toggle**
(nav on desktop, in the drawer on mobile) that flips it via a View Transition and persists.
Dark is the brand default; light must always be checked too.

**Tokens (in `shell.css` `:root` / `[data-theme=…]`).** Surfaces `--bg`,
`--surface-1..4`, `--surface-sunken`, `--scrim`. Borders `--border(-strong/-subtle)`.
Text `--text`, `--text-2`, `--text-3`, `--text-disabled`. Gold `--accent` (FILLS, with
`--on-accent` text on top) vs `--accent-text` (gold TEXT/icons — dark-gold in light so it
stays legible), `--accent-hover`, `--accent-quiet`, `--accent-line`. Status
`--success(-text/-quiet)`, `--warning(-quiet)`, `--danger(-text/-quiet)`,
`--live(-quiet/-ink)`, `--away(-text/-quiet)` (the BLUE 2nd side in comparisons). Fonts
`--f-display` (Anton), `--f-body` (Archivo), `--f-mono` (JetBrains Mono — scores/clocks,
`tabular-nums`). Plus `--r-*` radius, `--sp-*` spacing, `--sh-*` shadow, `--dur-*`/`--ease-*` motion.

**Reusable components (`.wc-*` in shell.css):** `wc-btn` (+`primary`/`ghost`), `wc-chip`,
`wc-seg` (segmented + `wc-seg-thumb`), `wc-badge` (`group`/`ko`/`ft`/`sched`/`live`),
`wc-card`, `wc-search`, `wc-stats`/`wc-stat`, `wc-daystrip`/`wc-day`, `wc-splitbar`
(flat solid comparison bar — **no gradient bars**), `wc-avatar`, `wc-skel`, `wc-empty`,
`wc-flag`(+`tbd`). Two banned "AI tells": **gradient progress/comparison bars** and
**left-edge accent stripes** on rows/cards. Use flat fills + full-row tints + colored
numbers instead.

**Icons — real Lucide only (`lib/icons.js`).** `import { icon } from './icons.js'`,
`icon(name,{size,stroke,label})`. Never hand-draw `<svg>` glyphs.

**Nav (`shell.js`).** Builds the live/next countdown button, desktop pills, info button,
theme toggle, and a mobile **hamburger → slide-in drawer** (this is a website, not an app
— no bottom tab bar). Collapsing hero logo + cross-document View Transitions + scroll-reveal
preserved. Detail-page nav active: game→`fixtures`, player→`players`, team→none.

**Per-page structural changes:** Fixtures = horizontal **day-selector strip** (replaced the
vertical all-days stack) + a 5-col match row (teams anchored, score centered) that goes
compact ≤760px. Groups = real semantic **sortable `<table>`** with full P/W/D/L/GF/GA/GD/PTS
and qualification by row-tint + colored position. Bracket = dropped its bespoke green theme,
added real **connector lines** (desktop) + **round-tab** view (≤860px mobile). Player =
responsive value chart (no more `preserveAspectRatio="none"` distortion). Popup (`popup.js`)
= focus trap + `aria-modal` + return-focus + scroll-lock compensation. The live page keeps
its team-colored broadcast identity; only the surrounding chrome was tokenized.

**`lib/api.js` round normalization (added):** the live API returns short knockout round
codes (`R32`/`R16`/`QF`/`SF`/`3rd`); `normalizeRound()` maps them to the long codes the app
+ static schedule use (`round_of_32`…). Without this the bracket only rendered the Final.

**`middleware.js` preview bypass:** branch/preview deployments (`VERCEL_ENV !== 'production'`)
open `/wc` + the data proxies without the site password so the redesign is testable; production
is unaffected. Safe to keep.

**Off-limits:** `lib/goal-celebration.js` (the hand-made goal celebration) and its
`celebrateGoal*` triggers in `live-page.js` must not change.
