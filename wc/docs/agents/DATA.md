# Data model — files, joins, enrichment, refresh

> **Read this if** you're touching data files, joins, squads, players, market values,
> enrichment, or the refresh pipeline. **Bounce if instead** it's about how live scores
> are fetched/polled → [`LIVE_DATA.md`](./LIVE_DATA.md) · a page's UI →
> [`PAGES.md`](./PAGES.md) · styling → [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

The single most important idea: **a checked-in static spine + a thin live overlay.**
Almost everything is JSON in the repo, read once at load. Only scores/phase/standings/
match-stats are live. This doc is the map of what's where and how it joins. For exact
field-by-field shapes, `wc/data/schema.md` and `wc/CLAUDE.md` are authoritative; for the
rebuild scripts, `wc/scripts/README.md`. For how the live data is fetched and normalized,
see [`LIVE_DATA.md`](./LIVE_DATA.md).

## Two layers

| Layer | Lives in | Loaded by | Refreshed |
|---|---|---|---|
| **Static spine** — teams, schedule, squads, stadiums, all enrichment | `wc/data/*.json` + `wc/data/enrichment/*` | `lib/data.js` (`fetch`, `cache:'no-cache'`, in-memory cache) | At build/refresh time, not at runtime |
| **Live overlay** — scores, `phase`, `status`, standings, match stats | wc2026api.com (+ FIFA/ESPN/Sofa on the live page) | `lib/api.js` and the live clients | At runtime, polled |

`lib/data.js` is the static loader: one exported getter per file, plus the built
indices (`resolveTeam`, `teamByCode`, `computeGroupStandings`, `squadFor`, `h2hKey`,
`pronounce`, `TEAM_NAME_ALIASES`). Use these rather than re-`fetch`-ing JSON.

## The six core files (`wc/data/`)

| File | Records | Shape (key fields) | Powers |
|---|---|---|---|
| `teams.json` | 48 | `{ id, name, code, group, flag, totalMarketValueEur, averageMarketValueEur }` | Team lists, value totals (pre-computed — don't re-sum) |
| `matches.json` | 104 | snake_case `{ id, match_number, round, group_name, home_team, away_team, stadium, kickoff_utc, status, phase, home_score, away_score, home_team_source, away_team_source }` | Schedule/results **fallback** + knockout placeholder text + goals |
| `groups.json` | 12 | group membership + sample standings | Group-table **fallback** |
| `stadiums.json` | 16 | the host venues | Venue list |
| `players.json` | 1,248 | flat array, one per player: `tmId, name, nationality, position, positionGroup, currentClub, marketValueEur, marketValuePeak, marketValueHistory[], tmUrl` | Player pages, squad lists |
| `players-by-team.json` | 48 keys | object keyed by **country name** → players sorted by value desc | Team squad lists |

Notes:
- `matches.json` `home_team`/`away_team` are **name strings** (not ids), and are `null`
  for undecided knockout slots — then `home_team_source`/`away_team_source` carry text
  like `"Winner Group A"` / `"Winner of Match 14"`. Surface that text in the UI.
- `round` values: `group`, `round_of_32`, `round_of_16`, `quarter_final`, `semi_final`,
  `third_place`, `final` (the app's long codes; the live API uses short codes that
  `lib/api.js` normalizes — see `LIVE_DATA.md`).
- These checked-in files are the **fallback** at runtime; live values come from
  wc2026api. The build/refresh scripts regenerate them from the openfootball backbone.

## The enrichment layer (`wc/data/enrichment/`)

Pre-baked supplementary data the live API can't provide. Live record counts live in
`manifest.json` (regenerated each refresh); full schemas in `ENRICHMENT_HANDOFF.md`.
Loaded via the getters in `lib/data.js`.

| File | Join key | Powers | Class |
|---|---|---|---|
| `teams-48.json` | FIFA code | The 48-team backbone + name/code index (`resolveTeam`) | static |
| `countries.json` | code | Country panel: capital, population, languages, currencies, flags, tz | static |
| `head-to-head.json` | sorted code pair `ARG_BRA` | Pre-game H2H block (1,128 pairings) | static |
| `elo-ratings.json` | code | Predictive strength | static |
| `fifa-rankings.json` | code | Official FIFA rank (live values refresh during tournament) | **refreshable** |
| `team-all-time-records.json` | code | All-time W/D/L per team | static |
| `stadium-weather.json` | stadium name + date | Match-day weather forecast | **refreshable** (16-day window moves daily) |
| `sportsdb-teams.json` | code | Team badges, stadium imagery, socials, RSS (47/48; Jordan absent) | static |
| `sportsdb-player-thumbs.json` | player name | Fallback player photos (resumable, extends each run) | **refreshable** |
| `tournament-scorers.json` | code / name | Golden boot + per-team scorers, built from live match timelines | **live-derived** |
| `pronunciations.json` | name (under `countries`/`players` sub-keys; use `pronounce()`) | Tap-to-hear name audio (Forvo; attribution required) | static |
| `worldcup-history/{year}.json` | — | Historical tournament context on team pages | static |
| `team-colors.json` | code | Team colors for the live page / color-sim | static |

There are also raw/intermediate artifacts in `enrichment/` (`transfermarkt-raw.json`,
`tm-clubs.json`, `elo/`, `results/`, etc.) used only by the build scripts — not read by
the app at runtime.

## Join conventions (get these right or things silently mismatch)

- **Team-level enrichment joins by FIFA 3-letter code** (`teams-48.json.fifa_code` =
  `teams.json.code`). Head-to-head joins by the **sorted code pair** (`h2hKey(a,b)`).
- **The live API's name spellings differ** (`Czechia`, `Korea Republic`,
  `Côte d'Ivoire`, `IR Iran`, `Congo DR`, `Cabo Verde`, `Bosnia-Herzegovina`,
  `Türkiye`, …). `TEAM_NAME_ALIASES` in `lib/data.js` maps them to canonical codes.
  When you see a join fail on a team name, add the alias there — don't patch call sites.
- **Player/squad joins go by country name** with fuzzy fallbacks (`squadFor()` handles
  `&`↔`and` and accent/punctuation drift between sources). Use it rather than indexing
  `players-by-team` directly.
- **Group standings are computed, not stored.** `computeGroupStandings(matches, group)`
  accumulates W/D/L/GF/GA/points from finished matches, because the live `/groups`
  endpoint returns membership only.
- Build a `Map(tmId → player)` once for O(1) player lookups; don't re-sum team values
  at runtime (they're pre-computed in `teams.json`).

## Refresh pipeline (`wc/scripts/`)

`scripts/refresh-data` is one idempotent orchestrator (run `bash wc/scripts/refresh-data`).
A user-level **launchd** agent runs it daily at 06:30 local. Each step is non-fatal if it
fails. Full detail + credentials table in `wc/scripts/README.md`. Summary:

| Step | Script | Behavior |
|---|---|---|
| Static backbone | `build-static.mjs` | Skip-if-present; rebuilds the six core files from openfootball (no network) |
| Player market values | `fetch-players-apify.mjs` → `merge-players.mjs` | **Only if `APIFY_TOKEN` set — currently blocked** (see below) |
| Match-day weather | `refresh-weather.mjs` | Overwrite (Open-Meteo, keyless) |
| FIFA live ranking | `refresh-fifa.mjs` | Overwrite live rank; official snapshot kept frozen |
| Golden boot | `build-scorers.mjs` | Overwrite, from wc2026api `/matches/:id/stats` (needs `WC_API_KEY`) |
| Player photos | `build-player-thumbs.mjs` | Resumable, extends TheSportsDB coverage per run |
| Manifest | `build-manifest.mjs` | Rebuilds `manifest.json` from disk |

Credentials are read from `zwolk/.env.local` and `wc/data/enrichment/keys.local.json`
(**both gitignored — never commit keys**).

## Player market values — the Apify sweep HAS run (manifest/README are stale)

Older docs (`scripts/README.md`, `data/enrichment/manifest.json`, the top of
`wc/CLAUDE.md`) describe an open blocker: "no `APIFY_TOKEN`, so `players.json` has
rosters but no market values / Transfermarkt ids / photos." **As of the 2026-06-26
data, that is no longer true** — verify on disk before trusting the blocker text:

- `players.json` (~5.7 MB): **96% of players (1,204 / 1,248)** have a real numeric
  `tmId`, a populated `marketValueEur`, `marketValuePeak`, `marketValueHistory[]`, and a
  real `tmUrl` (`transfermarkt.com/...`).
- `teams.json`: **all 48** `totalMarketValueEur` / `averageMarketValueEur` are populated.

So the Transfermarkt sweep clearly ran at some point. The ~4% without values are players
Transfermarkt didn't match; the UI still degrades gracefully there (values show `—`,
link by name, photos fall back to TheSportsDB thumbnails or initials). **If you re-run
`refresh-data`, be aware its `fetch-players-apify.mjs` step is still gated on
`APIFY_TOKEN` and will skip if the token isn't in `.env.local`** — that won't erase the
already-merged values, but you can't refresh them without the token. If you touch this
area, update `manifest.json` / `scripts/README.md` so they stop claiming the data is empty.
