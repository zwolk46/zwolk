# API Reference Index — World Cup 2026 App

Exact, faithful copies of the **current official documentation** for every external API
the project uses, captured so future agents know precisely how each works. One folder
per provider, each with `reference.md` (structured docs), `source.md` (URLs + fetch date
+ any OpenAPI/Postman links), and raw spec captures where downloadable.

**All docs fetched: 2026-06-20.** (Re-check the "Fetched" date before trusting staleness-
sensitive details like pricing or rate limits.)

| API | Role in this app (data files / pages it feeds) | Auth + `.env` / key var | Live / one-time / refreshable | Official docs URL | Fetched |
|---|---|---|---|---|---|
| **wc2026api.com** | Live scores, `phase`/`status`, group standings, match stats → consumed at runtime by `api/wc2026-client.js` + `lib/api.js` via the `/api/wc2026` proxy; feeds `fixtures.html`, `groups.html`, `bracket.html`, `game.html` | Bearer; env **`WC_API_KEY`** (server-side, injected by `middleware.js`) | **Live (polled)** | https://api.wc2026api.com/docs | 2026-06-20 |
| **Apify** (`solidcode/transfermarkt-scraper`) | Player market values / clubs / transfers → `data/players.json`, `players-by-team.json`, recomputed `teams.json` totals; player pages | API token; env **`APIFY_TOKEN`** or `keys.local.json` → `apify.token` | **One-time** (paid, ≈$1–3) | https://apify.com/solidcode/transfermarkt-scraper | 2026-06-20 |
| **Open-Meteo** | Match-day weather → `data/enrichment/stadium-weather.json`; venue/match views | None (keyless) | **Refreshable** (re-fetch forecast at build time; 16-day window moves) | https://open-meteo.com/en/docs | 2026-06-20 |
| **Kaggle** | Elo + all-time results → `elo-ratings.json`, `head-to-head.json`, `team-all-time-records.json`; team pages | None for **public** dataset downloads (creds optional via `keys.local.json` → `kaggle`) | **One-time** (static CSVs vendored) | https://www.kaggle.com/docs/api | 2026-06-20 |
| **openfootball/worldcup.json** | Tournament backbone (48 teams, 104 matches, 12 groups, 16 stadiums, squads) → `teams-48.json`, `worldcup-history/*`; built into `data/*.json` by `scripts/build-static.mjs` | None (public domain, CC0) | **One-time** (static; 2026 results edit-updatable) | https://github.com/openfootball/worldcup.json | 2026-06-20 |
| **TheSportsDB** | Badges, stadium imagery, socials, RSS, descriptions → `sportsdb-teams.json` (47/48); team pages | v1 free demo key **`123`** in URL path (`keys.local.json` → `thesportsdb`) | **One-time / static** | https://www.thesportsdb.com/documentation | 2026-06-20 |
| **FIFA World Rankings** | Official + live ranking → `fifa-rankings.json`; team pages | None (public, undocumented feed) | **Refreshable** (official frozen 2026-06-11 → ~2026-07-19; live moves) | *(no official docs)* https://api.fifa.com/api/v3/fifarankings/rankings/live | 2026-06-20 |
| **REST Countries** *(project uses keyless mledoze + World Bank)* | Country/languages panel → `countries.json`; team/country pages | Official v5 = Bearer key; **project path is keyless** (mledoze + World Bank) | **One-time / static** (population ~yearly) | https://restcountries.com/docs | 2026-06-20 |
| **Forvo** | Native-speaker name pronunciation audio → `pronunciations.json`; player/country pages | API key (`keys.local.json` → `forvo`); **attribution required** | **Static** once fetched (audio links expire 2h; re-fetch at play, no caching) | https://api.forvo.com/documentation/ | 2026-06-20 |
| **flagcdn** (Flagpedia) | Country flag images → `countries.json` flag URLs + app-wide flags (Jordan fallback) | None (free CDN; backlink requested) | **Live CDN** (static images) | https://flagpedia.net/download/api | 2026-06-20 |

## Which sources are polled vs. fetched once vs. refreshed

- **Polled live (runtime):** **wc2026api.com** only — scores/phase/standings/stats. All
  calls go through the `/api/wc2026` proxy (Bearer key server-side, hard **490/day** cap
  under the 500/day auto-disable, ~25s response cache). Poll the **collection** endpoint
  every 60–90s **only inside a live window**; otherwise refresh on load/user action.
- **One-time / static fetches (build the vendored `data/` files, then never re-called at
  runtime):** **openfootball** (backbone), **Apify/Transfermarkt** (player values),
  **Kaggle** (Elo + results CSVs), **TheSportsDB** (badges/socials), **REST Countries
  path** (mledoze + World Bank → countries), **Forvo** (pronunciation links).
- **Benefit from periodic refresh (closer to / during the tournament):**
  - **Open-Meteo forecast** in `stadium-weather.json` — the ~16-day forecast window
    moves; re-run `scripts/refresh-weather.mjs` at build time (past days use the archive
    API and stay stable).
  - **FIFA rankings** in `fifa-rankings.json` — `official_*` is frozen 2026-06-11 until
    ~2026-07-19; `live_*` drifts during the tournament.

## Per-provider folders

`wc2026api/` · `apify/` · `open-meteo/` · `kaggle/` · `openfootball/` · `thesportsdb/` ·
`fifa-world-rankings/` · `rest-countries/` · `forvo/` · `flagcdn/`

## Capture caveats (see each `source.md`)

- **wc2026api.com** `/openapi.json` and **FIFA** `/fifarankings/rankings/live` are
  JavaScript-/WAF-gated and returned no body to a server-side fetch this session (the
  browser tool was unresponsive). Both are documented faithfully from the project's own
  **verified** contracts (`CLAUDE.md`, the API client, `middleware.js`, and the
  enrichment manifest/handoff). Each `source.md` lists the exact live URL and a TODO to
  re-capture the raw spec/response with a JS-capable browser.
- **TheSportsDB** publishes a full OpenAPI spec (`/api/spec/v1/openapi.yaml`, ≈113 KB);
  its URL is recorded in `thesportsdb/source.md` rather than inlined due to size.
