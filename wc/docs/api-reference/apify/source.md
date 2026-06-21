# Apify (Transfermarkt Scraper) — sources

- **Fetched:** 2026-06-20
- **Actor page:** https://apify.com/solidcode/transfermarkt-scraper
- **HTTP API tab (endpoints captured here):** https://apify.com/solidcode/transfermarkt-scraper/api
- **Input schema:** https://apify.com/solidcode/transfermarkt-scraper/input-schema
- **Pricing:** https://apify.com/solidcode/transfermarkt-scraper/pricing  ($1.00 / 1,000 results)
- **OpenAPI (actor-specific):** https://apify.com/solidcode/transfermarkt-scraper/api/openapi
- **Apify platform API reference:** https://docs.apify.com/api/v2
- **Apify API OpenAPI spec:** https://docs.apify.com/api/openapi.json

## Data source behind the actor — Transfermarkt

- **Transfermarkt has no official public API.** The actor scrapes
  `https://www.transfermarkt.{com,us,de,…}`.
- Project entry URL: https://www.transfermarkt.us/weltmeisterschaft/teilnehmer/pokalwettbewerb/FIWC/saison_id/2025
- Player id is parsed from the profile URL path `/spieler/<id>`.
- Respect Transfermarkt's terms of use and avoid over-scraping.

## Fetch method

- The actor's HTTP API tab is server-rendered; the **Run / Run-sync / Get-actor**
  endpoints, the documented **input JSON example**, and the **$1/1K** pricing were
  captured directly on 2026-06-20.
- Endpoint usage cross-checked against `wc/scripts/fetch-players-apify.mjs` (the POST
  run, the `actor-runs/<id>` poll, and the `datasets/<id>/items?format=json&clean=true`
  download) and `wc/scripts/merge-players.mjs` (normalization).
- The actor's exact **output** field list is not formally published; the project's
  merge step is intentionally defensive and prints a sample record's keys.
