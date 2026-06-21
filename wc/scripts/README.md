# WC2026 data pipeline

This folder is the **repeatable data system** for the app. The app reads six static
files in `wc/data/` plus live data from `wc2026api.com`. These scripts (re)build the
static files from public, mostly-keyless sources, so the app is fully populated even
when the live API is unavailable.

## Data architecture

| Layer | Source | How |
|---|---|---|
| **Tournament backbone** (teams, schedule, results, groups, stadiums, squads) | **openfootball** (public domain), checked into `data/enrichment/` | `build-static.mjs` (no network) |
| **Live** scores / phase / standings / match stats | **wc2026api.com** (key in env, proxied by `middleware.js`) | runtime, client-side |
| **Player market value / transfers / caps** | **Transfermarkt via Apify** (paid, ~$1–3) | `fetch-players-apify.mjs` → `merge-players.mjs` |
| **Weather** per match day | **Open-Meteo** (keyless) | `refresh-weather.mjs` |
| **Enrichment** (Elo, FIFA rank, H2H, all-time records, SportsDB, countries, pronunciations) | Kaggle / FIFA / TheSportsDB / mledoze / Forvo | pre-baked in `data/enrichment/` |

## Scripts (run from repo root)

```bash
# 1. Build the six static files from the openfootball backbone (no network, safe to re-run)
node wc/scripts/build-static.mjs

# 2. Refresh match-day weather from Open-Meteo (keyless)
node wc/scripts/refresh-weather.mjs

# 3. Player market values etc. (needs an Apify token — see below)
APIFY_TOKEN=apify_api_xxx node wc/scripts/fetch-players-apify.mjs
node wc/scripts/merge-players.mjs
```

`build-static.mjs` writes: `teams.json` (48), `matches.json` (104, with goals),
`groups.json` (12, standings computed from finished group matches), `stadiums.json` (16),
`players.json` (~1,248), `players-by-team.json` (48).

Player ids: openfootball players carry `tmId: null`, so the UI links them by name.
After the Apify merge, each player gets a real numeric Transfermarkt id and the UI
links by that id; `teams.json` market-value totals are recomputed.

## Apify hand-off (one-time, by Zach)

The Transfermarkt sweep is the only piece that needs a paid account. To enable it:

1. Sign up: <https://console.apify.com/sign-up> (free tier includes monthly credit).
2. Token: **Settings → API & Integrations → Personal API token** → copy it.
3. Add it to `wc/data/enrichment/keys.local.json` (gitignored):
   ```json
   { "apify": { "token": "apify_api_…" } }
   ```
4. Run steps 3 above. Cost ≈ $1–3 for ~1,250 players. The actor is
   `solidcode/transfermarkt-scraper`. If it returns < 100 records, the national-team
   expansion didn't fire — switch the input to the 48 individual squad pages
   (`…/{slug}/kader/verein/{id}/saison_id/2025`).

The merge script's field getters are defensive but the actor's exact output schema
may differ — it prints a sample record's keys and an unmatched-name report so the
getters in `merge-players.mjs` can be tuned in one place.

## One-command refresh (`refresh-data`) — the maintenance-free entry point

`scripts/refresh-data` is the single idempotent orchestrator. Run it anytime:

```bash
bash wc/scripts/refresh-data        # safe to re-run; reads creds from .env.local
```

What it does each run (failures in any one step are non-fatal and logged):

| Step | Script | Behaviour |
|---|---|---|
| Static backbone | `build-static.mjs` | **skip-if-present** — only rebuilds if `data/teams.json`/`players.json` are missing |
| Player market values | `fetch-players-apify.mjs` → `merge-players.mjs` | only if `APIFY_TOKEN` is set (see blocker below) |
| Match-day weather | `refresh-weather.mjs` | **overwrite** — Open-Meteo; the 16-day forecast window moves daily (8s per-request timeout) |
| FIFA live ranking | `refresh-fifa.mjs` | **overwrite** — live rank/points; the official snapshot is preserved frozen |
| Golden boot / scorers | `build-scorers.mjs` | **overwrite** — aggregates `wc2026api.com /matches/:id/stats` timelines (needs `WC_API_KEY`) |
| Fallback player photos | `build-player-thumbs.mjs` | **resumable** — extends TheSportsDB thumbnail coverage a batch at a time |
| Manifest | `build-manifest.mjs` | rebuilds `data/enrichment/manifest.json` from what's on disk |

### Credentials (read from env / `.env.local`, never hardcoded)

| Var / key | Where | Used by | Required? |
|---|---|---|---|
| `WC_API_KEY` | `zwolk/.env.local` | live API proxy (runtime) + `build-scorers.mjs` | yes for live scores + golden boot |
| `thesportsdb.key` | `wc/data/enrichment/keys.local.json` (default `123`) | `build-player-thumbs.mjs` | demo key works |
| `forvo.key` | `keys.local.json` | pronunciations (pre-baked) | present |
| `APIFY_TOKEN` | `.env.local` (absent) | Transfermarkt player sweep | **blocker — see below** |
| (keyless) | — | Open-Meteo, FIFA, openfootball, REST Countries, Kaggle public | no key needed |

## Scheduling (daily, user-scoped launchd — no sudo)

The plist `scripts/com.zwolk.wc2026.refresh-data.plist` runs `refresh-data` daily at
06:30 local. Install / remove:

```bash
bash wc/scripts/install-refresh-launchd.command     # installs into ~/Library/LaunchAgents and loads it
bash wc/scripts/uninstall-refresh-launchd.command   # unloads and deletes it
launchctl list | grep com.zwolk.wc2026.refresh-data # verify
# logs: wc/scripts/refresh-data.log
```

## ⚠️ Open blocker — Transfermarkt player market values & photos

`players.json` carries the full 1,248-player rosters (from openfootball) but **market
values, peak values, transfer history, caps, Transfermarkt IDs, and official photos
are empty** because the Apify Transfermarkt sweep has never run — there is **no
`APIFY_TOKEN`** in `.env.local`. To unblock: add `APIFY_TOKEN=apify_api_…` to
`zwolk/.env.local` (sign-up needs email verification, so it can't be automated), then
run `node wc/scripts/fetch-players-apify.mjs && node wc/scripts/merge-players.mjs`.
Until then the UI degrades gracefully (values show "—", photos fall back to
TheSportsDB thumbnails / initials).

## Sources & terms

openfootball is public domain. wc2026api.com is an unofficial fan API (respect its
~500/day cap — enforced by `middleware.js`). Transfermarkt scraping is via Apify;
respect Transfermarkt's terms and don't over-run. Open-Meteo & FIFA public endpoints
and TheSportsDB are free for non-commercial use. This app is personal/non-commercial.
