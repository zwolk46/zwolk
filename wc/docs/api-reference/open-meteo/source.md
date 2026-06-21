# Open-Meteo — sources

- **Fetched:** 2026-06-20
- **Docs (Forecast):** https://open-meteo.com/en/docs
- **Docs (Historical/Archive):** https://open-meteo.com/en/docs/historical-weather-api
- **Docs (Geocoding):** https://open-meteo.com/en/docs/geocoding-api
- **Pricing / rate limits:** https://open-meteo.com/en/pricing
- **License:** https://open-meteo.com/en/licence (data CC BY 4.0; server AGPLv3)
- **Base URLs:**
  - Forecast: https://api.open-meteo.com/v1/forecast
  - Archive: https://archive-api.open-meteo.com/v1/archive
  - Geocoding: https://geocoding-api.open-meteo.com/v1/search
  - Commercial: https://customer-api.open-meteo.com/ (+ `apikey`)
- **OpenAPI / Postman:** No official OpenAPI for the free endpoints. Geocoding protobuf
  `.proto`: https://github.com/open-meteo/geocoding-api/blob/main/Sources/App/api.proto
  Server source: https://github.com/open-meteo/open-meteo

## Fetch method

- Forecast docs page fetched 2026-06-20 (large client-rendered page; parameter set
  cross-checked against `wc/scripts/refresh-weather.mjs`, which hard-codes the exact
  base URLs and the `DAILY` variable list used).
- Geocoding API doc and Pricing page fetched 2026-06-20 (server-rendered tables
  captured in full — parameters, response schema, error shape, and rate-limit/plan
  tables are quoted directly).
