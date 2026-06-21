# FIFA World Rankings — sources

- **Fetched:** 2026-06-20
- **Endpoint:** https://api.fifa.com/api/v3/fifarankings/rankings/live?gender=1&sportType=0&locale=en
- **Public ranking pages:** https://inside.fifa.com/fifa-world-ranking/men
- **OpenAPI / Postman:** none (FIFA publishes no developer docs for this feed).

## Fetch method & status

- A server-side fetch of
  `https://api.fifa.com/api/v3/fifarankings/rankings/live?gender=1&sportType=0&locale=en`
  on 2026-06-20 returned **no body** (the host is behind a CDN/WAF that gates non-browser
  requests). A JS-capable browser / browser-like headers are needed to capture the raw
  JSON; the in-session browser tool was unresponsive this session.
- `reference.md` is therefore reconciled from:
  - `wc/data/enrichment/manifest.json` — records the exact endpoint string and the
    `IdCountry` / `Rank` / `TotalPoints` / `PrevRank` / `PrevPoints` field mapping.
  - `wc/data/enrichment/ENRICHMENT_HANDOFF.md` — the `fifa-rankings.json` field list and
    the official-vs-live snapshot semantics.
  - `wc/data/enrichment/fifa-rankings.json` `_meta` (source, snapshot dates).

## TODO to reach full live fidelity

Re-capture the live JSON with a JS-capable browser (or a fetch sending browser-like
`User-Agent`/`Accept` headers) and save the raw response as `raw-response.json` here,
then confirm the current field names against `reference.md`.
