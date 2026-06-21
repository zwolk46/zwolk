# REST Countries (+ keyless substitutes) — sources

- **Fetched:** 2026-06-20

## Official REST Countries API
- **Home / live request sample:** https://restcountries.com/
- **Docs:** https://restcountries.com/docs
- **API versions:** https://restcountries.com/docs/api-versions
- **Data sources:** https://restcountries.com/docs/data-sources
- **Legacy (v3.1) deprecation:** https://restcountries.com/docs/legacy-api-deprecation
- **Plans:** https://restcountries.com/plans
- **Base URL:** https://api.restcountries.com/countries/v5  (Bearer auth; demo key `rc_live_demo`)
- **Free flag CDN:** https://restcountries.com/flags

## Keyless sources actually used by the project
- **mledoze/countries:** https://github.com/mledoze/countries
  - Raw: https://raw.githubusercontent.com/mledoze/countries/master/countries.json (ODbL)
- **World Bank population:** https://api.worldbank.org/v2/country/<ISO>/indicator/SP.POP.TOTL?format=json&mrnev=1
  - API docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
- **Open-Meteo geocoding:** https://geocoding-api.open-meteo.com/v1/search (capital tz/coords)
- **flagcdn:** https://flagcdn.com (flag URLs)

## OpenAPI / Postman
- REST Countries: interactive docs at /docs (no public openapi.json link surfaced on the
  landing page; capture from /docs if a future agent needs the machine-readable spec).

## Fetch method
- restcountries.com landing page fetched 2026-06-20 (server-rendered): captured the v5
  base URL, Bearer auth + `rc_live_demo` demo key, the sample record (fields incl.
  `codes.fifa`), the 12 documented query patterns (search/filter/fields/paging), the
  deprecation note for v3.1/v5-key, and the plans link.
- The keyless source endpoints are cross-checked against `wc/data/enrichment/manifest.json`
  and `ENRICHMENT_HANDOFF.md`, which state countries.json was built from mledoze + World
  Bank + Open-Meteo + flagcdn.
