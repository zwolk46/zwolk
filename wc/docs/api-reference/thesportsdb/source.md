# TheSportsDB — sources

- **Fetched:** 2026-06-20
- **Free API landing:** https://www.thesportsdb.com/free_sports_api
- **Full documentation:** https://www.thesportsdb.com/documentation
- **Pricing:** https://www.thesportsdb.com/pricing
- **Artwork types/sizes:** https://www.thesportsdb.com/docs_artwork
- **Base URLs:** v1 `https://www.thesportsdb.com/api/v1/json/<key>/` · v2 `https://www.thesportsdb.com/api/v2/json/`
- **Free key:** `123`
- **Images CDN:** https://r2.thesportsdb.com

## OpenAPI / Postman / MCP
- v1 OpenAPI: https://www.thesportsdb.com/api/spec/v1/openapi.yaml  (≈113 KB YAML; published — download directly when a machine-readable spec is needed)
- v2 OpenAPI: https://www.thesportsdb.com/api/spec/v2/openapi.yaml
- v1 Postman: https://www.postman.com/thedatadb/thesportsdb/collection/0t5rbv8/thesportsdb-v1-api
- v2 Postman: https://www.postman.com/thedatadb/thesportsdb/collection/d7hdb1o/thesportsdb-v2-api
- Readme.io: https://thedatadb.readme.io/

## Fetch method
- `documentation` page fetched 2026-06-20 (server-rendered): captured base URLs, v1 path
  auth (key `123`) and v2 header auth (`X-API-KEY`), the full v1 + v2 endpoint catalog
  with params and free/premium limits, image preview suffixes, rate limits (30/100/120
  per min), pricing, and the OpenAPI/Postman/MCP links above.
- v1 `openapi.yaml` confirmed published and reachable (≈113 KB); not inlined here due to
  size — fetch from the URL above. Endpoint usage cross-checked against
  `wc/data/enrichment/manifest.json` / `ENRICHMENT_HANDOFF.md` (sportsdb-teams.json built
  with the v1 free demo key).
