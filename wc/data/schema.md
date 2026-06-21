# Data schema reference

Field-by-field reference for every file in `data/`. Types are JavaScript types.

**Legend:** ✅ = field name confirmed against the live wc2026api.com response ·
⚠️ = inferred/sample shape, verify against the first real response (see
`SAMPLE_DATA_NOTICE.md`). The Transfermarkt `players` files follow our normalization
spec (from the project task), not a raw API, so they have no "confirmed" status.

---

## `teams.json` — `Array<Team>`  ⚠️ shape inferred

| Field | Type | Example | Description |
|---|---|---|---|
| `id` | number | `4` | Stable team id. |
| `name` | string | `"France"` | Full country name. **Join key** to `players-by-team.json` and to `home_team`/`away_team` in matches. |
| `code` | string | `"FRA"` | 3-letter country code (display/flags only — not a join key). |
| `group` | string | `"C"` | Group letter the team is drawn into. |
| `flag` | string (URL) | `"https://flagcdn.com/w320/fr.png"` | Flag/crest image URL (sample uses a placeholder CDN). |
| `totalMarketValueEur` | number \| null | `425000000` | Pre-computed sum of squad `marketValueEur`; `null` if no player data. |
| `averageMarketValueEur` | number \| null | `85000000` | Pre-computed mean of squad `marketValueEur`; `null` if no player data. |

---

## `matches.json` — `Array<Match>`  ✅ core fields confirmed

| Field | Type | Example | Description |
|---|---|---|---|
| `id` | number | `11` | ✅ Unique match id (use with `GET /matches/:id`). |
| `match_number` | number | `11` | ✅ Official fixture number (1–104). |
| `round` | string | `"group"` | ✅ Stage. `"group"` confirmed; knockout strings are sample placeholders. |
| `group_name` | string \| null | `"C"` | ✅ Group letter; `null` for knockout matches. |
| `home_team` | string \| null | `"France"` | ✅ Home team **name**; `null` if knockout slot undecided. |
| `away_team` | string \| null | `"Spain"` | ✅ Away team **name**; `null` if knockout slot undecided. |
| `stadium` | string | `"MetLife Stadium"` | ✅ Venue **name** (join to `stadiums.json` `name`). |
| `kickoff_utc` | string (ISO 8601) | `"2026-06-14T21:00:00.000Z"` | ✅ Kickoff in UTC. |
| `status` | string | `"live"` | ✅ One of `scheduled` \| `live` \| `finished`. |
| `phase` | string | `"2H"` | ✅ Match phase — see CLAUDE.md Section 4 for all values. |
| `home_score` | number \| null | `1` | ⚠️ Home goals; `null` before kickoff. Confirm on a finished match. |
| `away_score` | number \| null | `1` | ⚠️ Away goals; `null` before kickoff. Confirm on a finished match. |
| `home_team_source` | string \| null | `"Winner Group A"` | ⚠️ How an undecided home slot fills; `null` once `home_team` is set. |
| `away_team_source` | string \| null | `"Runner-up Group B"` | ⚠️ How an undecided away slot fills; `null` once `away_team` is set. |

---

## `groups.json` — `Array<Group>`  ⚠️ shape inferred

| Field | Type | Example | Description |
|---|---|---|---|
| `group_name` | string | `"A"` | Group letter. |
| `standings` | array | `[ {…} ]` | Ordered standings rows (best first). |

Each `standings` row:

| Field | Type | Example | Description |
|---|---|---|---|
| `rank` | number | `1` | Current position in the group. |
| `team` | string | `"Mexico"` | Team **name** (join to `teams.json`). |
| `played` | number | `1` | Matches played. |
| `won` | number | `1` | Wins. |
| `drawn` | number | `0` | Draws. |
| `lost` | number | `0` | Losses. |
| `gf` | number | `2` | Goals for. |
| `ga` | number | `1` | Goals against. |
| `gd` | number | `1` | Goal difference (`gf - ga`). |
| `points` | number | `3` | Points. |

> Standings are also available **live** from `GET /groups` and change as matches finish.

---

## `stadiums.json` — `Array<Stadium>`  ⚠️ shape inferred

| Field | Type | Example | Description |
|---|---|---|---|
| `id` | number | `1` | Stable venue id. |
| `name` | string | `"MetLife Stadium"` | Venue name (join target for match `stadium`). |
| `city` | string | `"East Rutherford"` | Host city. |
| `country` | string | `"United States"` | Host country (USA / Mexico / Canada). |
| `capacity` | number | `82500` | Approximate seating capacity. |

---

## `players.json` — `Array<Player>`  (normalized from Transfermarkt)

| Field | Type | Example | Description |
|---|---|---|---|
| `tmId` | string | `"342229"` | Transfermarkt player id (from profile URL `/spieler/<id>`). Unique key for O(1) lookups. |
| `name` | string | `"Kylian Mbappé"` | Full name. |
| `shortName` | string \| null | `"Mbappé"` | Short/display name. |
| `dateOfBirth` | string (ISO date) | `"1998-12-20"` | Date of birth. |
| `age` | number | `27` | Age in years. |
| `nationality` | string | `"France"` | Primary nationality. |
| `secondNationality` | string \| null | `"Cameroon"` | Second nationality if any. |
| `height` | number \| null | `178` | Height in cm. |
| `preferredFoot` | string \| null | `"right"` | `"left"` \| `"right"` \| `"both"`. |
| `position` | string | `"Centre-Forward"` | Playing position as returned. |
| `currentClub` | string | `"Real Madrid"` | Current club name. |
| `currentClubId` | string \| null | `"418"` | Transfermarkt club id. |
| `currentLeague` | string \| null | `"LaLiga"` | Current league name. |
| `shirtNumber` | number \| null | `9` | Shirt number if present. |
| `contractUntil` | string \| null | `"2029-06-30"` | Contract end date. |
| `marketValueEur` | number | `180000000` | Current market value, EUR integer. |
| `marketValuePeak` | number | `200000000` | All-time peak market value, EUR integer. |
| `marketValueHistory` | array | `[ { "date": "2024-12-01", "valueEur": 180000000 } ]` | Time series of `{ date, valueEur }`. |
| `nationalTeam` | string | `"France"` | National team / WC country (**join key** to `players-by-team.json`). |
| `internationalCaps` | number \| null | `90` | Senior international caps. |
| `internationalGoals` | number \| null | `50` | Senior international goals. |
| `transferHistory` | array | `[ { "season": "2024/25", "fromClub": "Paris Saint-Germain", "toClub": "Real Madrid", "feeEur": 0, "feeDisplay": "Free transfer" } ]` | Career transfers. `feeEur` is `0` for free transfers; `feeDisplay` is the human-readable fee. |
| `achievements` | array<string> | `["FIFA World Cup 2018"]` | Trophy strings (empty if none / not scraped). |
| `tmUrl` | string (URL) | `"https://www.transfermarkt.us/kylian-mbappe/profil/spieler/342229"` | Full Transfermarkt profile URL. |

`marketValueHistory[]` item:

| Field | Type | Example | Description |
|---|---|---|---|
| `date` | string (ISO date) | `"2024-12-01"` | Valuation date. |
| `valueEur` | number | `180000000` | Market value on that date, EUR integer. |

`transferHistory[]` item:

| Field | Type | Example | Description |
|---|---|---|---|
| `season` | string | `"2024/25"` | Season of the transfer. |
| `fromClub` | string | `"Paris Saint-Germain"` | Selling club. |
| `toClub` | string | `"Real Madrid"` | Buying club. |
| `feeEur` | number \| null | `0` | Fee in EUR (`0` = free; `null` = undisclosed/loan). |
| `feeDisplay` | string | `"Free transfer"` | Human-readable fee label. |

---

## `players-by-team.json` — `Record<countryName, Array<Player>>`

- **Keys** are country names matching `teams.json` `name` exactly (e.g. `"United States"`).
- **Values** are arrays of the same `Player` objects as `players.json`, **sorted by
  `marketValueEur` descending**.
- Use for team-page squad lists; use `players.json` (or a `tmId` map) for single-player lookups.
