# wc2026api.com — sources

- **Fetched:** 2026-06-20
- **Live docs URL (Swagger UI):** https://api.wc2026api.com/docs
- **OpenAPI spec URL (to capture):** https://api.wc2026api.com/openapi.json
- **Base URL:** https://api.wc2026api.com

## Fetch method & status

- `https://api.wc2026api.com/docs` → returned a client-rendered **Swagger UI** shell
  (title only) to a server-side fetch; the spec loads via JavaScript.
- `https://api.wc2026api.com/openapi.json` → **no body** returned to a server-side
  fetch (JS-gated / non-HTML). A JavaScript-capable browser is required to capture the
  raw spec; the in-session browser tool was unresponsive on 2026-06-20.
- **Therefore** `reference.md` was reconciled from the project's own authoritative,
  verified sources rather than a raw spec capture:
  - `wc/CLAUDE.md` — Section 3 "Live data (wc2026api.com)" and Section 4
    "Phase & status reference" (the `matches` fields are marked **confirmed against the
    live response**).
  - `wc/api/wc2026-client.js` and `wc/lib/api.js` — the exported endpoint wrappers.
  - `wc/middleware.js` — the proxy whitelist (authoritative endpoint set), daily cap,
    and cache TTLs.

## TODO to reach full live fidelity

Re-fetch `https://api.wc2026api.com/openapi.json` with a JS-capable browser (or
`curl`/HTTPie in an environment that holds a valid key) and overwrite `openapi.json`
here, then reconcile the inferred `teams` / `groups` / `stadiums` / `/stats` shapes and
the knockout `round` enum strings in `reference.md`.
