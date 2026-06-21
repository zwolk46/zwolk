# REST Countries — API Reference (+ keyless sources actually used)

> **Role in this app:** the country/languages panel — `data/enrichment/countries.json`
> (capital, population, area, region, languages, currencies, borders, flag URLs,
> capital timezone/coords), keyed by FIFA code.
> **Important:** the project does **not** call the live REST Countries API at runtime.
> REST Countries v3.1 was **deprecated** mid-2026 and v5 now needs a free account key,
> so the identical fields were sourced **keyless** from **mledoze/countries** + **World
> Bank** (population) + **Open-Meteo** (capital tz) + **flagcdn** (flag URLs). Both the
> official API and the actual keyless sources are documented here.
> **Fetched:** 2026-06-20.

---

## A. Official REST Countries API (current = v5)

### Base URL & versions
- **Base:** `https://api.restcountries.com`
- **Current endpoint family:** `/countries/v5`
- **Docs:** https://restcountries.com/docs · **API versions:** https://restcountries.com/docs/api-versions
- **Legacy v3.1** (`https://restcountries.com/v3.1/...`) is **deprecated** — see
  https://restcountries.com/docs/legacy-api-deprecation

### Authentication
- **Bearer API key** in the `Authorization` header: `Authorization: Bearer rc_live_…`
- A public demo key `rc_live_demo` exists for trying requests.
- Get a key: https://restcountries.com/sign-up

```javascript
const res = await fetch('https://api.restcountries.com/countries/v5?limit=1',
  { headers: { Authorization: 'Bearer rc_live_demo' } });
```

### Endpoints / query patterns
All against `/countries/v5`:

| Pattern | Purpose |
|---|---|
| `/countries/v5` | list all (use `limit`/`offset` to page) |
| `/countries/v5?q=<text>` | full-text fuzzy search (name, capital, code) |
| `/countries/v5?<filter>` | filter by region, currency, leader, membership (e.g. EU, G7) |
| `/countries/v5?response_fields=<a,b,c>` | trim payload to chosen fields |
| `/countries/v5?<omit heavy subfields>` | keep record, drop bulky sub-objects |

Common query params: `q` (search), `limit`, `offset` (paging), `response_fields`
(field selection), region/currency/membership filters. ~250+ countries, 80+ fields
each; data synced from 35+ sources every ~4 hours.

### Response — one record (trimmed sample)

```json
{
  "names": { "common": "Canada", "official": "Canada",
             "native": { "eng": { "common": "Canada", "official": "Canada" }, "fra": { } } },
  "codes": { "alpha_2": "CA", "alpha_3": "CAN", "ccn3": "124", "fifa": "CAN", "cioc": "CAN" },
  "capitals": [{ "name": "Ottawa", "primary": true, "coordinates": { "lat": 45.42, "lng": -75.7 } }],
  "flag": { "emoji": "🇨🇦", "url_svg": "https://flags.restcountries.com/v5/svg/ca.svg",
            "url_png": "https://flags.restcountries.com/v5/w640/ca.png" },
  "region": "Americas", "subregion": "North America",
  "area": { "kilometers": 9984670, "miles": 3855101.1 },
  "borders": ["USA"], "calling_codes": ["1"],
  "currencies": [{ "code": "CAD", "name": "Canadian dollar", "symbol": "$" }],
  "languages": [{ "name": "English", "bcp47": "en" }, { "name": "French", "bcp47": "fr" }],
  "leaders": [ { "name": "Mark Carney", "title": "Prime Minister",
                 "attributes": { "head_of_government": true, "head_of_state": false } } ],
  "memberships": { "un": true, "nato": true, "g7": true, "g20": true, "commonwealth": true, "oecd": true },
  "population": 38005238,
  "timezones": ["UTC-08:00", "UTC-07:00", "UTC-06:00", "UTC-05:00", "UTC-04:00", "UTC-03:30"],
  "tlds": [".ca"], "uuid": "189581ed-44b0-47d7-9849-6b097401a7d6"
}
```

Full record ≈ 80+ fields across groups: `names`, `codes`, `currencies`, `languages`,
`geography`, `borders`, `leaders`, `demographics`, `calendars`, `time zones`, plus
hidden groups (cars, classification, continents, coordinates, date, demonyms, economy,
government_type, landlocked, links, number_format, parent, postal_code). Use
`response_fields=` to select.

### Errors / status
- Standard HTTP codes; `401` if the Bearer key is missing/invalid. Returns JSON.

### Pricing / plan tiers
- Free tier covers most prototypes/small apps; paid plans add volume — see
  https://restcountries.com/plans. Free demo key: `rc_live_demo`.

### Rate limits
- Per-plan (not publicly enumerated on the landing page); the free tier is the
  open/demo allowance. See plans/docs for current numbers.

---

## B. Keyless sources actually used by this project

Because v3.1 is gone and v5 needs a key, `countries.json` was built keyless from:

### 1. mledoze/countries (upstream dataset of REST Countries)
- **Repo:** https://github.com/mledoze/countries (ODbL license)
- **Raw JSON (all countries):**
  `https://raw.githubusercontent.com/mledoze/countries/master/countries.json`
- No key, no rate limit beyond GitHub raw fair-use. Provides name(s), cca2/cca3, ccn3,
  **fifa code**, capital, region/subregion, languages, currencies, borders (cca3),
  area, latlng, etc. — the same underlying data REST Countries serves.
- **England & Scotland** are **manual** records (home nations aren't in the ISO dataset).

### 2. World Bank — population
- **Indicator API (keyless):**
  `https://api.worldbank.org/v2/country/<ISO>/indicator/SP.POP.TOTL?format=json&mrnev=1`
  (most-recent non-empty value). Returns `[ <metadata>, [ { country, date, value } ] ]`.
- Stored as `population: { value, year, source }` in `countries.json`.

### 3. Open-Meteo geocoding — capital timezone & coords
- See `../open-meteo/reference.md` (Geocoding API). Supplies `timezone_capital` and
  `capital_coords`.

### 4. flagcdn — flag URLs
- See `../flagcdn/reference.md`. Supplies `flag.svg` / `flag.png_w320` / `flag.png_w640`.

### `countries.json` record shape (project output)
```
fifa_code, team_name, name_common, name_official, cca2, cca3,
capital, region, subregion, area_km2,
population: { value, year, source },
languages: ["Portuguese"], currencies: [{ code, name, symbol }],
borders: ["ARG","BOL", …],            // cca3 list
timezone_capital, capital_coords: { lat, lng },
flag: { svg, png_w320, png_w640 }, flag_emoji
```
Join: `countries[team.code]` (FIFA 3-letter code).

## Gotchas
- Do **not** wire the live REST Countries API expecting v3.1 — it's deprecated; v5
  needs a Bearer key. The project deliberately avoids the key by using mledoze + World
  Bank (keyless), so `countries.json` is a **static** file (population refreshes ~yearly).
- Join everything by **FIFA code**, not country name (names differ across sources).
