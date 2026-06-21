# ⚠️ THIS IS SAMPLE DATA — NOT THE REAL TOURNAMENT DATASET

Every `.json` file in this folder contains a **small, hand-built illustrative
sample** whose only purpose is to show the *shape* of the data so the app (and
any AI coding agent) can be built against a realistic structure **before** the
real data is fetched.

**What is NOT real here:**

- Only **12 of 48 teams** and **5 matches of 104** are present.
- Only **4 teams** (France, Argentina, Brazil, United States) have player squads,
  and each has only **5 players** (20 of ~1,250 total).
- **Group assignments, kickoff times, scores, and standings are invented** for
  illustration. The real 2026 group draw and schedule come from the API.
- **Player market values, caps, goals, transfer fees, and Transfermarkt IDs are
  illustrative** — plausible but not live Transfermarkt figures. Do not cite them
  as fact.
- `flag` URLs point at a generic free flag CDN (flagcdn.com) as placeholders.

**Field names that ARE confirmed against the live API:** the `matches` fields
(`id`, `match_number`, `round`, `group_name`, `home_team`, `away_team`,
`stadium`, `kickoff_utc`, `status`, `phase`) were taken from the official
wc2026api.com response example. Everything else (teams / groups / stadiums shape,
and the `home_score` / `away_score` / `*_source` match fields) is **inferred** and
should be reconciled against the first real response — see `schema.md`.

## How to replace this with real data

See **`../CLAUDE.md` → "Replacing the sample data with real data"** for the exact
endpoints and the Apify steps. In short:

1. `GET https://api.wc2026api.com/teams|matches|groups|stadiums` with your
   `Authorization: Bearer <key>` header → overwrite the four tournament files.
2. Run the `solidcode/transfermarkt-scraper` Apify actor → normalize into
   `players.json`, build `players-by-team.json`, then recompute each team's
   `totalMarketValueEur` / `averageMarketValueEur`.
