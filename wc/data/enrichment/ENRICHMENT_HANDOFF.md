# World Cup 2026 — Enrichment Data Handoff

**For the coding agent integrating this data into the WC2026 app.**
Generated 2026-06-20. All files live in `wc/data/enrichment/`.

This package adds eight supplementary data sources on top of the core app data
(`wc/data/teams.json`, `matches.json`, etc.). It is static, pre-baked JSON the app
loads at startup — except two files that benefit from a refresh (weather forecast,
FIFA live ranking; flagged below).

---

## 0. Read this first — two things that affect every join

**(a) The core app data is still SAMPLE data.** `wc/data/teams.json` (12 of 48
teams) and `wc/data/stadiums.json` (6 of 16) are illustrative samples (see
`wc/data/SAMPLE_DATA_NOTICE.md`). The enrichment here is built for the **full 48
teams / 16 venues**, derived from openfootball — see `teams-48.json`. When you swap
in the real `wc2026api.com /teams` response, the enrichment will join straight to it.

**(b) Join by FIFA code, not by name.** Every per-team enrichment file is an object
**keyed by the FIFA 3-letter code** (e.g. `"BRA"`, `"NED"`, `"KOR"`), which equals
`teams.json.code`. Country names differ across sources ("USA" vs "United States",
"Türkiye" vs "Turkey", "Korea Republic" vs "South Korea") and the real API's names
are unknown, so **code is the reliable key**. Every record also carries `team_name`
for display. Build your lookup once:

```js
// teams.json from wc2026api.com has { code: "BRA", name: "Brazil", ... }
const countries = await fetch('data/enrichment/countries.json').then(r=>r.json());
const c = countries[team.code];      // -> enrichment record, or undefined
```

For head-to-head, the key is the **sorted code pair** joined by `_`, e.g.
`"ARG_BRA"` (alphabetical), with `first_*`/`second_*` referring to `pair[0]`/`pair[1]`.

---

## 1. File-by-file reference

### `teams-48.json`  — the backbone
The full 48-team list derived from openfootball. Array of:
`{ id, name, name_normalised, fifa_code, group, confed, continent, flag_emoji }`.
Use it if you need the real 48-team field before the live API is wired in.

### `countries.json`  — country/languages panel
Object keyed by FIFA code. Per team:
```
fifa_code, team_name, name_common, name_official, cca2, cca3,
capital, region, subregion, area_km2,
population: { value, year, source },
languages: ["Portuguese"], currencies: [{ code, name, symbol }],
borders: ["ARG","BOL",...](cca3 list),
timezone_capital, capital_coords:{lat,lng},
flag: { svg, png_w320, png_w640 }, flag_emoji
```
Join: `countries[team.code]`. Powers a country profile / languages panel.
Source: mledoze/countries (keyless upstream of REST Countries) + World Bank
population + Open-Meteo capital timezone + flagcdn flag URLs.
Note: REST Countries' own API (v3.1) was deprecated mid-2026 and v5 now needs a
free key; the identical data was sourced keyless. England/Scotland are manual
records (home nations aren't in the ISO dataset).

### `stadium-weather.json`  — match-day weather  ⚠ refresh forecast at build time
Top level: `{ generated_at, note, forecast_window:{start,end}, stadiums:{...} }`.
`stadiums` is keyed by **stadium name**; each:
```
name, city, country, cc, capacity, coords:{lat,lng}, timezone, num_matches,
matches: [ { date, time, round, group, team1, team2,
             weather: { temp_max_c, temp_min_c, precip_mm,
                        precip_prob_max_pct, wind_max_kmh, uv_index_max },
             weather_source: "observed"|"forecast"|"beyond_forecast_window" } ]
```
Join to a fixture by stadium name (and date). `weather_source`:
`observed` = past match (reanalysis), `forecast` = within the 16-day window from
`generated_at`, `beyond_forecast_window` = too far out (`weather` is null — refetch
nearer the date). **Re-run the Open-Meteo fetch at build time** as the window moves.

### `worldcup-history/`  — historical context for team pages
`2026.json, 2022.json, 2018.json, 2014.json, 2010.json` = full openfootball match
results per tournament (`{ name, matches:[{ round, date, time, team1, team2,
score:{ft,ht}, goals1[], goals2[], group, ground }] }`).
Plus 2026 reference: `2026.teams.json`, `2026.stadiums.json`, `2026.groups.json`,
`2026.squads.json` (squads = `[{ name, fifa_code, group, players:[{number,pos,name,
club:{name,country}, date_of_birth}] }]`). Public domain.

### `elo-ratings.json`  — predictive strength  (pairs with FIFA ranking)
Object keyed by FIFA code:
```
fifa_code, team_name, current_rating, current_rank, snapshot_date,
peak_rating, peak_rating_year, best_rank, confederation, is_host
```
Source: Kaggle (afonsofernandescruz 2026 Elo). Show alongside `fifa-rankings.json`
as a predictive-vs-official contrast.

### `fifa-rankings.json`  — official ranking  ⚠ benefits from refresh
`_meta` + object keyed by FIFA code:
```
fifa_code, team_name, official_rank, official_points (2026-06-11 snapshot),
live_rank, live_points (mid-tournament, fluctuates), ranking_movement,
confederation, rated_matches
```
Source: FIFA public endpoint. `official_*` is frozen at 2026-06-11 until the next
official update (~2026-07-19); `live_*` moves during the tournament. Refresh nearer
to / during the event for current values.

### `head-to-head.json`  — pre-game H2H block (the live API can't provide this)
`_meta` + object keyed by sorted code pair (`"ARG_BRA"`):
```
pair:[first,second], first_name, second_name, played,
first_wins, second_wins, draws, first_goals, second_goals,
last5:[{ date, home, away, score, tournament, neutral }]
```
1128 pairings (835 have history; the rest are `played:0`). Source: martj42
(1872–present). Look up by sorting the two teams' codes and joining with `_`.

### `team-all-time-records.json`  — all-time record per team
Keyed by FIFA code: `played, wins, draws, losses, gf, ga, gd, win_pct, first, last`.

### `sportsdb-teams.json`  — badges, stadium imagery, socials, RSS
Keyed by FIFA code: `idTeam, sportsdb_name, badge (URL), stadium, stadium_thumb,
location, website, rss, facebook, instagram, twitter, youtube, description_en,
league`. Coverage **47/48** — Jordan (`JOR`) has no senior team in the free DB
(`idTeam:null`); fall back to `countries.json`/flagcdn for its flag. Source:
TheSportsDB v1 free demo key (`123`).

### `pronunciations.json`  — tap-to-hear name audio  (Forvo)
`{ _meta, countries:{...}, players:{...} }`. Both `countries` and `players` are
keyed by name; each value is `{ word, mp3, language, country, hits }` or `null`
where Forvo has no recording. Powers tap-to-hear on player/country pages.
Coverage: **46/48 country names** (Bosnia & Herzegovina, DR Congo have none) and
**14/20** of the sample squads' top players (only 4 teams have player data yet).
Re-run for the full ~240-player set once real Transfermarkt market values are
loaded. **Forvo attribution must be displayed** (see api.forvo.com/documentation/branding).

### `keys.local.json`  — GITIGNORED, do not commit
Holds the API keys/credentials (TheSportsDB demo key, Forvo key once paid). Already
added to `wc/.gitignore`.

---

## 2. Suggested load pattern

```js
const ENR = 'data/enrichment/';
const [countries, elo, fifa, h2h, records, sportsdb, weather] = await Promise.all([
  'countries','elo-ratings','fifa-rankings','head-to-head',
  'team-all-time-records','sportsdb-teams','stadium-weather'
].map(f => fetch(ENR+f+'.json').then(r=>r.json())));

const teamEnrichment = (code) => ({
  country: countries[code], elo: elo[code], fifa: fifa[code],
  record: records[code], sportsdb: sportsdb[code]
});
const h2hKey = (a,b) => [a,b].sort().join('_');   // -> h2h[h2hKey('ARG','BRA')]
```

All files are static; load once at startup. Only `stadium-weather.json` (forecast
portion) and `fifa-rankings.json` (live values) benefit from periodic re-fetch.

## 3. Refresh cadence summary
| File | Refresh |
|---|---|
| countries, elo-ratings, head-to-head, team-all-time-records, worldcup-history, sportsdb-teams | static |
| stadium-weather.json | **re-fetch forecast at build time** (16-day window moves) |
| fifa-rankings.json | re-fetch nearer/during tournament (official frozen to 2026-06-11) |
| pronunciations.json | static once fetched |
