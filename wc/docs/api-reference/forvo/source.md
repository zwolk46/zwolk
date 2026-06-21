# Forvo — sources

- **Fetched:** 2026-06-20
- **Docs index:** https://api.forvo.com/documentation/
- **General information & terms:** https://api.forvo.com/documentation/general-information/
- **Word pronunciations (endpoint used):** https://api.forvo.com/documentation/word-pronunciations/
- **Attribution & branding (required):** https://api.forvo.com/documentation/branding/
- **Plans & pricing:** https://api.forvo.com/plans-and-pricing/
- **Demo:** https://api.forvo.com/demo/
- **API host:** https://apifree.forvo.com  (audio at https://apifree.forvo.com/audio/...)
- **License / privacy:** https://forvo.com/license/ · https://forvo.com/privacy/

## OpenAPI / Postman
- None published by Forvo (path-style REST documented per-action on the docs site).

## Fetch method
- Forvo docs index, **general-information**, **word-pronunciations**, and **branding**
  pages fetched 2026-06-20 (server-rendered; full text captured): auth (`key` path
  segment), required/optional params for `word-pronunciations`, formats (xml/json/js-tag),
  the daily-limit-resets-22:00-UTC rule, the **2-hour audio link lifetime + no-caching**
  rule, and the three accepted attribution badges/text.
- Plan/quota specifics (Non-Profit $24/yr, 500/day, 68 used) cross-checked against
  `wc/data/enrichment/manifest.json` (`_forvo` note) and `keys.local.json` field names.
