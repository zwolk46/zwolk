# FIFA World Rankings — API Reference (unofficial public endpoint)

> **Role in this app:** official FIFA men's ranking → `data/enrichment/fifa-rankings.json`
> (per team: official rank/points snapshot, live rank/points, movement, confederation,
> rated matches), keyed by FIFA code. Paired with `elo-ratings.json` for a
> predictive-vs-official contrast. **One of two files that benefit from a refresh**
> (official frozen 2026-06-11 → next update ~2026-07-19; live values move during the
> tournament).
> **Fetched:** 2026-06-20.
> **Status:** FIFA publishes **no official developer documentation** for this endpoint —
> it is the public JSON feed that powers fifa.com's ranking pages, used directly by the
> project. The contract below is captured from the project's stored data + the endpoint
> string recorded in the enrichment manifest.

---

## Base URL & endpoint

- **Endpoint:** `https://api.fifa.com/api/v3/fifarankings/rankings/live`
- **Query params (as used):**
  - `gender=1` → men (2 = women)
  - `sportType=0` → football (soccer)
  - `locale=en` → language (commonly required)
  - (optional) `dateId=<id>` → a specific historical ranking edition; omitting it
    returns the latest/live edition. `count`/`pageSize` may be honored for paging.

Example:
```
https://api.fifa.com/api/v3/fifarankings/rankings/live?gender=1&sportType=0&locale=en
```

## Authentication

- **None** (public). No API key. Note: the host is fronted by a CDN/WAF that can be
  picky about request headers (see Gotchas).

## Response shape (as consumed by the project)

A JSON object with a ranking list (FIFA's feed uses a `rankings` array of entries; each
entry carries a country object and rank/points fields). The project maps, **per team
keyed by FIFA code (`IdCountry`)**:

| Project field | Source field (FIFA feed) | Meaning |
|---|---|---|
| `fifa_code` | `IdCountry` (3-letter) | join key |
| `team_name` | country name | display |
| `official_rank` | `PreviousRank` | last **official** rank (2026-06-11 snapshot) |
| `official_points` | `PreviousPoints` | last official points |
| `live_rank` | `Rank` | live/mid-tournament rank (fluctuates) |
| `live_points` | `TotalPoints` | live points |
| `ranking_movement` | derived (`PreviousRank − Rank`) | up/down/flat |
| `confederation` | confederation field | AFC/CAF/CONMEBOL/… |
| `rated_matches` | matches-rated field | count behind the rating |

> The project deliberately reads `PreviousRank`/`PreviousPoints` as the **official**
> (frozen) values and `Rank`/`TotalPoints` as the **live** values, because between
> official editions FIFA exposes provisional live movement on the same feed.

`fifa-rankings.json` also carries a `_meta` block recording the source endpoint, the
`official_snapshot_date` (2026-06-11), `next_official_update` (~2026-07-19), and
`live_as_of`.

## Status codes & errors

- `200` + JSON on success. The endpoint may return `403`/empty to clients whose headers
  look non-browser-like (CDN/WAF), even though no auth is required.

## Rate limits & quotas

- None documented (it is an undocumented public feed). Treat gently; this project
  fetches it occasionally (refresh during the tournament), not in a loop.

## Pricing

- Free / public. No formal terms for the JSON feed (it backs fifa.com's public pages).

## Gotchas

- **Undocumented / unofficial:** field names and the path can change without notice —
  re-verify on each refresh.
- **CDN/WAF sensitivity:** a plain server-side fetch may return empty/403; a real
  browser (or appropriate `Accept`/`User-Agent` headers) is usually needed to retrieve
  the JSON. The 2026-06-20 build captured it successfully; a server-side re-fetch this
  session returned no body.
- **Refresh cadence matters:** `official_*` is frozen between editions
  (2026-06-11 → ~2026-07-19); `live_*` drifts during the tournament. Refresh
  `fifa-rankings.json` nearer to / during the event.
- Join by **FIFA code (`IdCountry`)**, consistent with the rest of the enrichment set.
