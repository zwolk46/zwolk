# flagcdn (Flagpedia) — sources

- **Fetched:** 2026-06-20
- **Landing:** https://flagcdn.com/
- **API / embed usage docs:** https://flagpedia.net/download/api
- **Base URL:** https://flagcdn.com
- **Codes JSON:** https://flagcdn.com/en/codes.json
- **Attribution:** backlink requested to https://flagpedia.net
- **OpenAPI / Postman:** none (simple path-based image CDN).

## Fetch method
- flagcdn.com landing page and the flagpedia.net `/download/api` usage page fetched
  2026-06-20 (server-rendered, full text): captured the PNG/WebP/JPEG/SVG path patterns,
  the complete fixed-size / `w<width>` / `h<height>` size lists, the responsive `<img>`
  embed pattern, and the `codes.json` endpoint.
- Usage in this project confirmed via grep (e.g. `https://flagcdn.com/<cc>.svg`, incl.
  `gb-eng.svg` / `gb-sct.svg`) and `countries.json` flag fields.
