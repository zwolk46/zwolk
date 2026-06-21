# Open-Meteo — API Reference (Forecast, Archive, Geocoding)

> **Role in this app:** match-day **weather** for the 16 venues. `scripts/refresh-weather.mjs`
> fills `data/enrichment/stadium-weather.json` — past match days use the **Archive
> (historical/reanalysis)** API; upcoming days inside the ~16-day horizon use the
> **Forecast** API. The **Geocoding** API is the third Open-Meteo API the project's
> stack relies on (capital timezones/coords in `countries.json`).
> **Auth:** none (keyless, free tier). **Fetched:** 2026-06-20.

---

## Base URLs

| API | Base URL | Used for |
|---|---|---|
| Forecast | `https://api.open-meteo.com/v1/forecast` | upcoming match-day weather (≤16-day horizon) |
| Historical / Archive | `https://archive-api.open-meteo.com/v1/archive` | past match-day weather (observed/reanalysis) |
| Geocoding (search) | `https://geocoding-api.open-meteo.com/v1/search` | resolve place → lat/lng/timezone |
| Geocoding (by id) | `https://geocoding-api.open-meteo.com/v1/get?id=<id>` | resolve a GeoNames id |
| Commercial (all APIs) | `https://customer-api.open-meteo.com/...&apikey=<key>` | paid tier (same syntax + `apikey`) |

## Authentication

- **Free / non-commercial:** **no API key.** Just call the URL.
- **Commercial:** subscribe for a key, switch host to `customer-api.open-meteo.com`,
  and add `&apikey=<key>`. All parameters/response formats are otherwise identical.

## Forecast & Archive — request

Both accept a single point and a set of daily/hourly variables. The project uses the
**daily** block for one date at a time.

Common URL parameters:

| Param | Required | Notes |
|---|---|---|
| `latitude`, `longitude` | yes | WGS84 decimal degrees. (Multiple comma-separated coords supported.) |
| `daily` | — | comma-separated daily variables (see below). |
| `hourly` | — | comma-separated hourly variables. |
| `current` | — | current-conditions variables (forecast API). |
| `timezone` | — | IANA tz (e.g. `America/New_York`) or `auto`; affects day boundaries. |
| `start_date`, `end_date` | — | `YYYY-MM-DD` range (used by the project, one day at a time). |
| `forecast_days` | — | forecast API: number of days (default 7, up to 16). |
| `past_days` | — | forecast API: include up to 92 past days. |
| `temperature_unit`, `wind_speed_unit`, `precipitation_unit`, `timeformat` | — | unit/format overrides. |

**Daily variables used by `refresh-weather.mjs`** (`DAILY` set):
`temperature_2m_max`, `temperature_2m_min`, `precipitation_sum`,
`precipitation_probability_max`, `wind_speed_10m_max`, `uv_index_max`.

Example (forecast, one venue, one day):

```
https://api.open-meteo.com/v1/forecast?latitude=40.81&longitude=-74.07&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max&timezone=America%2FNew_York&start_date=2026-06-14&end_date=2026-06-14
```

Example (archive / past day): same querystring against
`https://archive-api.open-meteo.com/v1/archive`.

## Forecast & Archive — response

JSON with echoed metadata plus a `daily` object whose values are **arrays aligned by
index** to `daily.time`:

```json
{
  "latitude": 40.81, "longitude": -74.07,
  "timezone": "America/New_York", "timezone_abbreviation": "EDT",
  "elevation": 3.0,
  "daily_units": { "time": "iso8601", "temperature_2m_max": "°C", "precipitation_sum": "mm", "...": "..." },
  "daily": {
    "time": ["2026-06-14"],
    "temperature_2m_max": [28.4],
    "temperature_2m_min": [18.1],
    "precipitation_sum": [2.3],
    "precipitation_probability_max": [40],
    "wind_speed_10m_max": [17.2],
    "uv_index_max": [7.1]
  }
}
```

The project reads index `[0]` of each array (one date per call) and stores
`{ temp_max_c, temp_min_c, precip_mm, precip_prob_max_pct, wind_max_kmh, uv_index_max }`
with `weather_source` = `"observed"` (archive) or `"forecast"`.

## Geocoding — request & response

Endpoint: `https://geocoding-api.open-meteo.com/v1/search`

| Param | Format | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | yes | — | Search term; 1 char → empty, 2 chars → exact match, 3+ → fuzzy. Name or postal code. |
| `count` | int | no | `10` | Up to 100 results. |
| `format` | string | no | `json` | Or `protobuf`. |
| `language` | string | no | `en` | Localized results, lower-cased. |
| `countryCode` | string | no | — | ISO-3166-1 alpha-2 filter. |
| `apikey` | string | no | — | Commercial only (prefix host with `customer-`). |

Success response:

```json
{
  "results": [
    {
      "id": 2950159, "name": "Berlin",
      "latitude": 52.52437, "longitude": 13.41053, "elevation": 74.0,
      "feature_code": "PPLC", "country_code": "DE",
      "timezone": "Europe/Berlin", "population": 3426354,
      "country": "Deutschland", "country_id": 2921044,
      "admin1": "Berlin", "admin1_id": 2950157,
      "postcodes": ["10967", "13347"]
    }
  ]
}
```

Empty fields are omitted. IDs resolve via `…/v1/get?id=<id>`.

## Status codes & errors

- `200` with a JSON body on success.
- On a bad parameter, a **`400`** with: `{ "error": true, "reason": "Parameter count must be between 1 and 100." }`
  (the `reason` text varies by error). The same `{error,reason}` shape is used across
  the weather APIs.

## Rate limits & quotas (Free / Open-Access)

| Window | Free limit |
|---|---|
| Per minute | 600 calls/min |
| Per hour | 5,000 calls/hour |
| Per day | 10,000 calls/day |
| Per month | 300,000 calls/month |

- One HTTP request is normally **1 API call**, but heavy requests cost more: >10
  weather variables **or** >2 weeks of data for a single location count as multiple
  (fractional) calls (e.g. 2 weeks × 15 vars = 1.5 calls).
- The project's usage (16 venues × match days, 6 daily vars, one day per call) is a
  tiny fraction of the free budget.

## Pricing / plan tiers

| Plan | Commercial | Limits | Notes |
|---|---|---|---|
| Free / Open-Access | ❌ | 600/min · 5k/hr · 10k/day · 300k/mo | non-commercial, attribution required, no uptime guarantee |
| API Standard | ✅ | unlimited rate, 1M calls/mo | dedicated `customer-api` endpoint + key, 99.9% uptime |
| API Professional | ✅ | unlimited rate, 5M calls/mo | adds Historical/Climate/Ensemble/Satellite APIs |
| API Enterprise | ✅ | unlimited rate, >50M calls/mo | custom solutions, priority support |

- Commercial endpoint: `customer-api.open-meteo.com` with `&apikey=...`. Historical,
  climate, ensemble & satellite-radiation APIs require **Professional** or higher (they
  are also available on the free/open-access tier for non-commercial use).

## Attribution / license

- Weather data is **CC BY 4.0** — attribution required (credit Open-Meteo and indicate
  modifications). Server code is open-source (AGPLv3).
- Geocoding: location data based on **GeoNames**.

## Gotchas

- The forecast horizon (~16 days) **moves** — re-run `refresh-weather.mjs` at build
  time. Days beyond the horizon return null weather (`weather_source:
  "beyond_forecast_window"` in the project file); refetch nearer the date. Past days
  use the **archive** host, not the forecast host.
- `daily.*` are index-aligned arrays parallel to `daily.time` — never assume scalar.
- `timezone` changes day-boundary bucketing; the project passes the venue's tz.
- Free tier is **non-commercial only**; this app is personal/non-commercial.
