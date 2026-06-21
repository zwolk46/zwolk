# Apify — API Reference (Transfermarkt Scraper actor)

> **Role in this app:** player **market values / clubs / transfers**. A one-time (paid)
> sweep runs the **`solidcode/transfermarkt-scraper`** actor on Apify to scrape
> Transfermarkt; `scripts/fetch-players-apify.mjs` runs it and downloads the dataset,
> then `scripts/merge-players.mjs` normalizes it into `data/players.json` /
> `players-by-team.json` and recomputes `teams.json` market-value totals.
> **Auth:** Apify API **token** (query param). **Fetched:** 2026-06-20.

---

## Base URL & identifiers

- **API base:** `https://api.apify.com/v2`
- **Actor:** `solidcode/transfermarkt-scraper` (API id form `solidcode~transfermarkt-scraper`;
  internal actor id `p24cwRyUdWtBqLDxT`)
- **Console / docs:** https://apify.com/solidcode/transfermarkt-scraper
- **Apify API reference:** https://docs.apify.com/api/v2

## Authentication

- **Personal API token**, passed as the **`token` query parameter** on every call:
  `?token=<YOUR_API_TOKEN>` (tokens look like `apify_api_…`).
- Obtain it in Apify Console → **Settings → API & Integrations → Personal API token**.
- In this project the token is read from env `APIFY_TOKEN` or from
  `wc/data/enrichment/keys.local.json` under `{ "apify": { "token": "apify_api_…" } }`
  (**gitignored — never commit**). Alternatively Apify supports the
  `Authorization: Bearer <token>` header.

## Endpoints used (Run-actor pattern)

### 1. Run the actor (async)

```
POST https://api.apify.com/v2/acts/solidcode~transfermarkt-scraper/runs?token=<TOKEN>
Content-Type: application/json
<actor input JSON in the body>
```

- Returns a **run object**; capture `data.id` (run id) and `data.defaultDatasetId`.
- Tip: adding `&method=POST` lets this be triggered via GET (for webhooks).

### 2. Poll the run until finished

```
GET https://api.apify.com/v2/actor-runs/<runId>?token=<TOKEN>
```

- Poll (project uses ~60s) until `data.status` is `SUCCEEDED` (or `FAILED`/`ABORTED`/
  `TIMED-OUT`). Other statuses: `READY`, `RUNNING`.

### 3. Download dataset items

```
GET https://api.apify.com/v2/datasets/<defaultDatasetId>/items?format=json&clean=true&token=<TOKEN>
```

- `format=json` (also `csv`, `xlsx`, `jsonl`); `clean=true` drops empty/hidden fields.
- Useful item params: `offset`, `limit`, `fields`, `omit`, `desc`.

### Run synchronously (alternative)

```
POST https://api.apify.com/v2/acts/solidcode~transfermarkt-scraper/run-sync-get-dataset-items?token=<TOKEN>
```

Runs and returns dataset items in one call (POST to pass input). Best for small/quick
runs; the project uses the async run + poll + download flow instead.

### Get actor metadata

```
GET https://api.apify.com/v2/acts/solidcode~transfermarkt-scraper?token=<TOKEN>
```

## Actor input schema

Paste any Transfermarkt URL — the scraper auto-detects page type (player profile, club
squad, competition table, etc.). Documented input example:

```json
{
  "startUrls": [
    "https://www.transfermarkt.com/erling-haaland/profil/spieler/418560",
    "https://www.transfermarkt.com/manchester-city/startseite/verein/281"
  ],
  "recordType": "auto",
  "maxResults": 1000,
  "language": "com",
  "includeMarketValueHistory": true,
  "includeTransferHistory": true,
  "includeAchievements": false,
  "includeInjuries": false,
  "includeClubSquad": false,
  "includeCompetitionClubs": false
}
```

| Field | Type | Notes |
|---|---|---|
| `startUrls` | string[] | Any Transfermarkt URLs (player/club/competition). |
| `recordType` | string | `auto` detects page type. |
| `maxResults` | int | Cap on records returned. |
| `language` | string | TM domain/language (`com`, `us`, `de`, …); 20+ supported. |
| `includeMarketValueHistory` | bool | Per-player MV history series. |
| `includeTransferHistory` | bool | Transfer records. |
| `includeAchievements` | bool | Honours. |
| `includeInjuries` | bool | Injury history. |
| `includeClubSquad` | bool | Expand a club/competition to its squad players. |
| `includeCompetitionClubs` | bool | Expand a competition to its clubs. |

**This project's input** (`fetch-players-apify.mjs`): the WC participants URL
`https://www.transfermarkt.us/weltmeisterschaft/teilnehmer/pokalwettbewerb/FIWC/saison_id/2025`
with `includeClubSquad: true`. **Fallback:** if the run returns **< 100 records**, the
national-team competition expansion didn't fire — switch the input to the **48 individual
squad pages** (`…/{slug}/kader/verein/{id}/saison_id/2025`).

## Output (dataset items)

- The dataset is an array of player/club records (exact keys depend on the actor
  version and the input flags). The project's `merge-players.mjs` treats the schema
  **defensively** — it prints a sample record's keys and an unmatched-name report so the
  field getters can be tuned in one place.
- **Normalization target** (what the app stores in `data/players.json`, per
  `data/schema.md`): `tmId` (string id, extracted from the profile URL `/spieler/<id>`),
  `name`, `nationalTeam`, `position`, `currentClub`, `marketValueEur` (integer),
  `marketValueHistory[]`, `tmUrl`.

## Status codes & errors

- Standard Apify HTTP codes: `201` (run created), `200` (reads), `400` (bad input),
  `401` (bad/missing token), `404` (unknown actor/run/dataset), `429` (rate limited).
- Error body shape: `{ "error": { "type": "...", "message": "..." } }`.

## Rate limits & quotas

- Apify API is rate-limited per token (generally **30 requests/sec** for most
  resources; run-creation endpoints lower). Returns `429` with `Retry-After` on
  breach — back off and retry. The project polls every ~60s, well within limits.

## Pricing / plan tiers

- This actor is **pay-per-result: from $1.00 / 1,000 results** (rental/usage on top of
  your Apify plan). Project estimate: **≈ $1–3 for ~1,250 players.**
- Apify platform plans (separate): **Free** (monthly usage credit), **Starter**,
  **Scale**, **Business**, **Enterprise**. The free tier's monthly credit can cover a
  small run.

## Gotchas

- It **scrapes Transfermarkt** — respect Transfermarkt's terms and don't over-run it.
- The actor's exact output keys can change between versions; keep all field access in
  one normalizer (`merge-players.mjs`) and verify against a sample record.
- Watch the **< 100 records** signal → use the per-squad-page fallback input.
- Keep the token server-side / out of git (`keys.local.json` is gitignored).
- Transfermarkt itself has **no official public API** — Apify (a scraper) is the access
  path; see `transfermarkt-source.md` notes in `source.md`.
