# TheSportsDB — API Reference

> **Role in this app:** team **badges, stadium imagery, socials, RSS, descriptions** →
> `data/enrichment/sportsdb-teams.json` (keyed by FIFA code; 47/48 teams — Jordan
> absent from the free DB). Built with the **v1 API + free demo key `123`**. Images are
> served from `r2.thesportsdb.com`.
> **Fetched:** 2026-06-20.

---

## Base URLs

```
v1 Base URL = https://www.thesportsdb.com/api/v1/json
v2 Base URL = https://www.thesportsdb.com/api/v2/json
```

Images CDN: `https://r2.thesportsdb.com/images/media/...`

## Authentication

- **v1 (used by this project):** key is a path segment after the base URL. The **free
  key is `123`**; premium keys replace it.
  - Free: `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=Arsenal`
  - Premium: `…/api/v1/json/<YOUR_KEY>/searchteams.php?t=Arsenal`
- **v2 (premium only):** key sent in the **`X-API-KEY` header**; returns standard HTTP
  status codes.

## v1 endpoints (the version this project uses)

All are `GET` under `…/api/v1/json/123/`. Selected endpoints (free-tier limits noted):

### Search
| Endpoint | Params | Free limit | Purpose |
|---|---|---|---|
| `searchteams.php` | `t` (name) | 1 (free key limited to "Arsenal") | search team by name → `idTeam`, badges, etc. |
| `searchplayers.php` | `p` (name) | 1 | search person by name |
| `searchevents.php` | `e`, opt `s`/`d`/`f` | 1 | search event by title/season/date/filename |
| `searchvenues.php` | `v` (name) | 1 | search venue |

### Lookup (by id — faster)
| Endpoint | Param | Purpose |
|---|---|---|
| `lookupteam.php` | `id` (idTeam) | full team details (badge, stadium, socials, description, RSS) |
| `lookupplayer.php` | `id` (idPlayer) | player details |
| `lookuptable.php` | `l` (idLeague), opt `s` | league standings table |
| `lookupevent.php` | `id` (idEvent) | event details |
| `lookuplineup.php` / `lookuptimeline.php` / `lookupeventstats.php` | `id` (idEvent) | lineup / timeline / stats |
| `lookupvenue.php` | `id` | venue details |

### List
| Endpoint | Params | Purpose |
|---|---|---|
| `all_countries.php` | — | all countries |
| `all_leagues.php` | — | all leagues |
| `search_all_teams.php` | `l` (league) or `s`+`c` (sport+country) | teams in a league/country |
| `lookup_all_players.php` | `id` (idTeam) | all players for a team |
| `search_all_seasons.php` | `id` (idLeague), opt `poster`/`badge` | seasons for a league |

### Schedule / Video
- `eventsnext.php?id=` / `eventslast.php?id=` (team), `eventsnextleague.php?id=` /
  `eventspastleague.php?id=` (league), `eventsday.php?d=YYYY-MM-DD[&s=][&l=]`,
  `eventsseason.php?id=&s=`, `eventstv.php?...`, `eventshighlights.php?d=...`.

**Project relevance:** `sportsdb-teams.json` carries `idTeam, sportsdb_name, badge
(URL), stadium, stadium_thumb, location, website, rss, facebook, instagram, twitter,
youtube, description_en, league` — i.e. the fields returned by team search/lookup
(`searchteams.php` / `lookupteam.php`).

## v2 endpoints (premium; not used here)

Under `…/api/v2/json/` with `X-API-KEY` header. Families: `search/{league|team|player|
event|venue}/<text>`, `lookup/{league|team|player|event|venue|…}/<id>`,
`list/{teams|seasons|players}/<id>`, `filter/tv/...`, `all/{countries|sports|leagues}`,
`schedule/{next|previous|full}/...`, and **`livescore/{sport|<idLeague>|all}`**
(2-minute livescores — premium only).

## Images / artwork

- Access any image via the URL in the JSON. Append a size suffix for previews:
  `/medium` (500px), `/small` (250px), `/tiny` (50px). Original is the bare URL (≤720px).
  Example: `https://r2.thesportsdb.com/images/media/league/fanart/xpwsrw1421853005.jpg/small`
- Two types: JPEG fanart and transparent PNG (badges/logos). See
  https://www.thesportsdb.com/docs_artwork

## Status codes & errors

- **v1** returns `200` with a JSON object; a missing match yields `null` arrays (e.g.
  `{ "teams": null }`) rather than an error.
- **v2** returns standard HTTP status codes (incl. `429` on rate-limit breach).

## Rate limits

| Tier | Limit |
|---|---|
| Free (key `123`) | **30 requests/minute** |
| Premium | 100 requests/minute |
| Business | 120 requests/minute |

On breach you get HTTP `429`; wait ~1 minute. Free tier also caps results per method
(e.g. `searchteams` free is limited to "Arsenal"; many list/lookup methods have small
free caps as noted above) — premium raises these.

## Pricing / plan tiers

- **Free:** key `123`, core v1 methods, smaller limits, no livescores/video.
- **Premium ($9/month "supporter"):** dedicated production key, larger limits, **v2 API**,
  2-minute livescores, video highlights. Business tier above that.
  https://www.thesportsdb.com/pricing

## OpenAPI / Postman / MCP

- **v1 OpenAPI:** https://www.thesportsdb.com/api/spec/v1/openapi.yaml
- **v2 OpenAPI:** https://www.thesportsdb.com/api/spec/v2/openapi.yaml
- **v1 Postman:** https://www.postman.com/thedatadb/thesportsdb/collection/0t5rbv8/thesportsdb-v1-api
- **v2 Postman:** https://www.postman.com/thedatadb/thesportsdb/collection/d7hdb1o/thesportsdb-v2-api
- **Readme.io mirror:** https://thedatadb.readme.io/
- **MCP:** v1 https://www.thesportsdb.com/api/spec/v1/MCP/index.js · v2 `/v2/MCP/index.js`

## Gotchas

- The free key `123` is shared/public and **abused historically** → several methods
  restricted and tightly rate-limited; test before relying on a method.
- v1 puts the key **in the URL** (visible) — fine for this free/static use, but don't
  treat it as secret. v2 uses the `X-API-KEY` header.
- Coverage gaps: **Jordan (JOR)** has no senior team in the free DB (`idTeam: null`) →
  fall back to `countries.json`/flagcdn for its flag.
- Append `/medium|/small|/tiny` to image URLs to avoid pulling full-size art.
