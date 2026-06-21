# openfootball / worldcup.json — Data Repository Reference

> **Role in this app:** the **tournament backbone**. The 48-team field, 104-match
> schedule/results, 12 groups, 16 stadiums, and full squads are derived from
> openfootball (public domain) and checked into `data/enrichment/`
> (`teams-48.json`, `worldcup-history/2026.*.json`, etc.). `scripts/build-static.mjs`
> builds the six static `data/*.json` files from this backbone with **no network call**
> (the openfootball JSON is already vendored).
> **Type:** GitHub public-domain data repo (no API key, no auth).
> **Fetched:** 2026-06-20.

---

## What it is

`openfootball/worldcup.json` is free, **public-domain (CC0-1.0)** football data for the
World Cups (national teams & clubs) in JSON, incl. Canada/USA/Mexico 2026, USA 2025,
Qatar 2022, Russia 2018 and earlier. **No API key required.**

- Repo: `https://github.com/openfootball/worldcup.json`
- The JSON datasets are **auto-generated** from an upstream Football.TXT source
  (`openfootball/worldcup`, file `2026--usa/cup.txt` + `cup_finals.txt`) via a GitHub
  Action on commit. **Do not edit the JSON directly** — edit the upstream text.
- Updates are **manual, not live** (maintainer updates ~once a day, CEST). For
  faster-moving mirrors see `upbound-web/worldcup-live.json` (community).

## "API" access — raw GitHub files (no key)

There is no REST API; you read the **raw** JSON files served by GitHub:

```
https://raw.githubusercontent.com/openfootball/worldcup.json/master/<YEAR>/worldcup.json
```

Example:

```
curl https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

Use the `raw.githubusercontent.com` host (the `github.com/.../blob/...` URL returns the
formatted HTML page, not JSON).

## Repository file/folder layout

Top level = one folder per tournament year:

```
1930/  1934/  1938/  1950/  1954/  1958/  1962/  1966/  1970/  1974/
1978/  1982/  1986/  1990/  1994/  1998/  2002/  2006/  2010/  2014/
2018/  2022/  2025/  2026/
LICENSE.md   README.md
```

- Each `<YEAR>/` contains `worldcup.json` (national-team World Cups).
- `2025/` contains `clubworldcup.json` (Club World Cup).
- The project vendors the 2026 file (and 2010–2022 for history) under
  `wc/data/enrichment/worldcup-history/` and derives `teams-48.json`,
  `2026.teams.json`, `2026.stadiums.json`, `2026.groups.json`, `2026.squads.json`.

## Data schema / format

### `<YEAR>/worldcup.json` — national teams

Top level: `{ "name": <string>, "matches": [ <match>, ... ] }`

A **match** object:

```json
{
  "round": "Matchday 1",
  "date": "2026-06-11",
  "time": "13:00 UTC-6",
  "team1": "Mexico",
  "team2": "South Africa",
  "score": { "ft": [2, 0], "ht": [1, 0] },
  "goals1": [
    { "name": "Julián Quiñones", "minute": "9" },
    { "name": "Raúl Jiménez", "minute": "67" }
  ],
  "goals2": [],
  "group": "Group A",
  "ground": "Mexico City"
}
```

Field notes:
- `round` — e.g. `"Matchday 1"`…`"Matchday 8"` for the group stage; `"Final"`, etc. for
  knockout. (The project remaps these to its own `round`/`match_number` in
  `build-static.mjs`; openfootball knockout entries carry a `num`.)
- `date` — `YYYY-MM-DD`. `time` — local kickoff string, may include a UTC offset
  (e.g. `"13:00 UTC-6"`).
- `team1` / `team2` — team **name** strings. Undecided knockout slots use placeholder
  codes like `"W101"` / `"W102"` (winner of match 101/102).
- `score` — present once played. Sub-keys: `ft` (full time `[h,a]`), `ht` (half time),
  and for knockouts decided later `et` (after extra time) and `p` (penalties). A
  scheduled match omits `score`/`goals*`.
- `goals1` / `goals2` — scorer arrays for team1 / team2: `{ name, minute }`, with
  optional `"penalty": true` and own-goal flags. Minutes can be stoppage-time strings
  like `"90+9"`.
- `group` — e.g. `"Group A"`. Omitted for knockout matches.
- `ground` — venue/city label (the project maps `ground` → official stadium name by
  city in `build-static.mjs`; also a join key to `stadium-weather.json`).

### `2025/clubworldcup.json` — clubs

Same envelope; `team1`/`team2` carry club names with a country code suffix, e.g.
`"Al Ahly SC (EGY)"`, `"Inter Miami CF (USA)"`. May have `round` like `"Group A"`.

## Authentication / rate limits / pricing

- **Auth:** none. **Pricing:** free (public domain, CC0-1.0).
- **Rate limits:** none documented by openfootball; you are subject to
  `raw.githubusercontent.com` (GitHub) fair-use limits. Since the project vendors the
  files and builds offline, runtime calls are unnecessary.

## Gotchas

- Data is **wiki-style and manually updated — not live.** Don't rely on it for
  in-match scores (that's wc2026api.com's job).
- Edit upstream Football.TXT, never the generated JSON.
- Knockout participants appear as `W101`/`L#`-style placeholders until decided.
- `score` keys vary (`ft`/`ht`/`et`/`p`); guard for missing keys.
- License: **CC0-1.0 (public domain)** — use freely.
