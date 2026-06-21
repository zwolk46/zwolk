# wc2026api.com — API Reference

> **Role in this app:** the **live core**. Scores, match `phase`/`status`, group
> standings, and match stats change as the tournament runs and are fetched live from
> this API. Everything else in `data/` is static.
> **Fetched:** 2026-06-20.
> **Capture note:** the live docs at `https://api.wc2026api.com/docs` render as a
> client-side **Swagger UI**, and `/openapi.json` returned no body to a server-side
> fetch (JS-gated); the browser tool was unavailable this session. The contract below
> is reconciled from the project's own verified sources — `wc/CLAUDE.md` (which marks
> the `matches` fields as **confirmed against the live response**), `api/wc2026-client.js`,
> `lib/api.js`, and the proxy whitelist in `middleware.js`. Re-capture `/openapi.json`
> via a JS-capable browser when available to fill in the inferred shapes.

---

## Base URL & environment

- **Upstream base URL:** `https://api.wc2026api.com`
- **Interactive docs:** `https://api.wc2026api.com/docs` (Swagger UI)
- **OpenAPI spec (to verify):** `https://api.wc2026api.com/openapi.json`
- **In-app access:** the browser **never** calls the upstream directly. All calls go
  through a same-origin Vercel proxy at **`/api/wc2026/*`** (implemented in
  `middleware.js`), which injects the Bearer key server-side, enforces a hard daily
  cap, and short-caches responses. Page code imports `api/wc2026-client.js` /
  `lib/api.js`.

## Authentication

- **Method:** HTTP Bearer token. Every upstream request must send
  `Authorization: Bearer <YOUR_KEY>`.
- **Where the key lives:** server-side only, in env var **`WC_API_KEY`** (read by
  `middleware.js`). The key is never exposed to the browser; the proxy adds the header.
- **Plan:** "Pro" tier, **~500 requests/day**, and **the key auto-disables if the
  daily limit is exceeded.** The proxy enforces a hard ceiling of **490/day** (under
  the 500 auto-disable threshold) to protect the key.

## Endpoints

All paths are relative to `https://api.wc2026api.com`. All are **GET**. All require the
`Authorization: Bearer <key>` header (added by the proxy). The proxy whitelist mirrors
this exact set; calling anything else returns a 404 from the proxy (not upstream).

| Client function | Method & path | Query params | Notes |
|---|---|---|---|
| `getTeams()` | `GET /teams` | — | All 48 national teams. |
| `getMatches(opts)` | `GET /matches` | `team` (3-letter code, e.g. `NED`), `status`, `round`, `group` | All matches, or a filtered subset. `team` filters home OR away. |
| `getLiveMatches()` | `GET /matches?status=live` | — | Convenience filter for the polling loop. |
| `getMatch(id)` | `GET /matches/:id` | — | One match by integer id. |
| `getMatchStats(id)` | `GET /matches/:id/stats` | — | Possession, shots, corners, fouls, cards + minute-by-minute timeline. Meaningful once a match has started. |
| `getGroups()` | `GET /groups` | — | Live standings for all 12 groups. |
| `getStadiums()` | `GET /stadiums` | — | The 16 host venues. |
| `getTestMatch()` | `GET /test/match` | — | Dev-only simulated match (see below). |

Proxy path regexes (from `middleware.js`, authoritative whitelist):
`^/teams$`, `^/matches$`, `^/matches/\d+$`, `^/matches/\d+/stats$`, `^/groups$`,
`^/stadiums$`, `^/test/match$`.

### Query parameter values

- `team` — 3-letter FIFA code, e.g. `NED`, `BRA`, `USA`.
- `status` — one of `scheduled` | `live` | `finished`.
- `round` — confirmed value for group matches is `"group"`. Knockout round strings
  (e.g. `round_of_32`, `round_of_16`, `quarter_final`, `semi_final`, `final`) are
  **placeholders** in the project sample — confirm exact strings against a real
  `/matches` response before hardcoding.
- `group` — group letter, e.g. `F`.

## Request / response schemas

### `GET /matches` — match object (confirmed snake_case shape)

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

Field notes:
- `home_team` / `away_team` are **team name strings** (not ids). They are `null` for
  undecided knockout slots — in which case `home_team_source` / `away_team_source`
  describe how the slot fills, e.g. `"Winner Group A"`, `"Winner of Match 14"`.
  Surface that source text in the UI wherever participants are shown.
- `home_score` / `away_score` appear on live/finished matches.
- **To verify on first real call:** whether unfiltered `/matches` returns a bare array
  `[ {...} ]` or a wrapper like `{ "data": [ ... ] }`, and exactly when
  `home_score`/`away_score` are present.

Sample `GET /matches?team=NED` (scheduled match, confirmed shape):

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

### `GET /matches/:id/stats`

Possession, shots, corners, fouls, cards, plus a minute-by-minute event timeline
(goals/bookings with player + minute). Meaningful once a match has started. (Exact
field layout is inferred in the project — verify against a live response.)

### `GET /teams`, `GET /groups`, `GET /stadiums`

- `/teams` — all 48 teams. Live team shape is **inferred** in the project; the app's
  `teams.json` records carry `{ id, name, code, group, flag, totalMarketValueEur,
  averageMarketValueEur }`. Reconcile against the real response.
- `/groups` — live standings for all 12 groups (shape inferred; see
  `data/groups.json` / `data/schema.md`).
- `/stadiums` — the 16 venues (shape inferred; see `data/stadiums.json`).

### `GET /test/match` (develop before kickoff)

Real matches start **June 11, 2026**. Until then, build/test live-update UI against
`/test/match`: a fictional **Brazil vs Argentina** match that cycles through every
`phase` in real time. Works with any valid key.

## Enum reference

### `phase` (per match) — confirmed values

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

### `status` values

`scheduled` · `live` · `finished`

**Live-window trigger:** treat `phase ∈ {1H, 2H, ET1, ET2, PEN}` **or**
`status === 'live'` as the trigger for the live-polling window.

### Knockout null-team behavior

Knockout matches may have `home_team` / `away_team` as `null` until the qualifying
teams are decided. When null, read `home_team_source` / `away_team_source`
(e.g. `"Winner Group A"`, `"Winner of Match 14"`) and display that placeholder text
wherever teams would appear (bracket, schedule, match detail).

## Errors

- Client wrappers (`api/wc2026-client.js`, `lib/api.js`) throw an `Error` including the
  HTTP status and path on any non-2xx response, e.g.
  `wc2026api error 429 on /matches`.
- The proxy returns JSON `{ "error": "..." }` bodies for its own conditions:
  - `404` `{ "error": "Unknown wc2026 endpoint", "path": ... }` — path not in whitelist.
  - `429` `{ "error": "Daily wc2026api.com request cap reached", "cap": 490, "count": N, "resets": "next UTC day" }` with header `X-WC-Cap`.
  - `500` `{ "error": "WC_API_KEY not configured" }`.
  - `502` `{ "error": "Upstream fetch failed", "detail": ... }`.
- Proxy response headers: `X-WC-Cache: HIT|MISS`, `X-WC-Cap: <count>/490`.

## Rate limits & quotas — design polling around this FIRST

- **Upstream Pro plan:** ~**500 requests/DAY**; **key auto-disables if exceeded.**
- **Proxy hard cap:** **490/day** (per UTC day, tracked in KV), plus a short response
  cache (`/matches`, `/groups`, `/matches/:id` ≈ 25s; `/stats` ≈ 20s; `/test/match`
  ≈ 5s). Cache hits do **not** burn the daily cap.

**Budget-safe polling strategy:**
1. **On app load:** fetch `/matches` once and `/groups` once before rendering. One
   `/matches` call refreshes every match's score at once.
2. **Decide if in a live window** from in-memory data (any `status === 'live'`, or any
   `phase ∈ {1H,2H,ET1,ET2,PEN}`); upcoming windows derive from `kickoff_utc`.
3. **Outside a live window:** do **not** poll on a timer — refresh on user action /
   page load only, or a few times a day.
4. **Inside a live window:** poll the **collection** endpoint (`getMatches()` /
   `getLiveMatches()`) **once every 60–90s** — never `getMatch(id)` per match. At 90s,
   an 8-hour match day ≈ 320 requests, comfortably under 500.
5. If you truly need 30-second updates, **upgrade to the 3,000/day tier** rather than
   risk the key. (The original "30s live" suggestion will disable a 500/day key.)

Keep all polling cadence constants (`LOAD`, `IDLE`, `LIVE_INTERVAL_MS`) in one config
object so the budget is easy to tune.

## Pricing / plan tiers

- **Pro:** ~500 requests/day (current plan; key auto-disables on overage).
- **Higher tier:** ~3,000 requests/day (recommended if 30-second live polling is
  required). Confirm exact tier names/prices on the live `/docs` or the provider site.

## Gotchas

- Unofficial fan project — **not affiliated with FIFA**; personal/non-commercial use;
  respect terms and rate limits.
- snake_case fields (unlike the camelCase used elsewhere in the app's normalized data).
- Several shapes (`teams`, `groups`, `stadiums`, `/stats`, score fields) are **inferred**
  in the project and must be reconciled on the first real response.
- Never call `fetch` to the upstream directly from page code — always go through the
  client module / proxy so the key, cap, and cache are respected.
