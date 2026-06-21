# Kaggle — Datasets API Reference

> **Role in this app:** one-time download of two public datasets that power enrichment:
> **Elo** → `elo-ratings.json` (Kaggle `afonsofernandescruz/2026-fifa-world-cup-historical-elo-ratings`)
> and **all-time results / head-to-head / records** → `head-to-head.json`,
> `team-all-time-records.json` (Kaggle `martj42/international-football-results-from-1872-to-2017`).
> Raw CSVs are kept under `data/enrichment/elo/` and `data/enrichment/results/`.
> **Public dataset downloads need NO key** (confirmed live 2026-06-20). **Fetched:** 2026-06-20.

---

## Base URL

- **REST API base:** `https://www.kaggle.com/api/v1`
- **CLI:** `pip install kaggle` → `kaggle ...`
- **Docs:** https://www.kaggle.com/docs/api

## Authentication

Most write/list calls need credentials; **downloading public datasets does not** (the
download endpoint 302-redirects to a signed Google Cloud Storage URL).

Credential options (from the Kaggle CLI docs):
1. **OAuth:** `kaggle auth login` (web flow).
2. **Env var:** `export KAGGLE_API_TOKEN=…` (token from https://www.kaggle.com/settings/api).
3. **API token file:** `~/.kaggle/access_token`.
4. **Legacy `kaggle.json`:** `{ "username": "...", "key": "..." }` at `~/.kaggle/kaggle.json`
   (chmod 600). Legacy REST calls use **HTTP Basic auth** (username + key).

This project stores Kaggle creds (if used) under `data/enrichment/keys.local.json`
(gitignored) — but for these **public** datasets no key is required.

## Endpoints / commands used

### Download a whole dataset (REST)
```
GET https://www.kaggle.com/api/v1/datasets/download/<owner>/<dataset-slug>
```
- Returns the dataset as a **zip** (302 → signed `storage.googleapis.com/...` URL).
  Public datasets: no auth needed. Example (confirmed working 2026-06-20):
  `https://www.kaggle.com/api/v1/datasets/download/martj42/international-football-results-from-1872-to-2017`
- Single file: append `?datasetVersionNumber=N` and/or use the CLI `-f <file>` form, or
  `…/datasets/download/<owner>/<slug>/<file-name>`.

### CLI equivalents
```bash
# whole dataset, unzipped into ./data
kaggle datasets download afonsofernandescruz/2026-fifa-world-cup-historical-elo-ratings -p data --unzip
kaggle datasets download martj42/international-football-results-from-1872-to-2017 -p data --unzip

# list files in a dataset
kaggle datasets files martj42/international-football-results-from-1872-to-2017
```
Useful `download` options: `-f/--file` (one file), `-p/--path`, `--unzip`,
`-o/--force`, `-q/--quiet`. `datasets list` supports `--search`, `--file-type`,
`--license`, `--tags`, `--sort-by`, `--min-size/--max-size`, `--page`, `--csv`.

## Datasets used by this project

| Dataset (owner/slug) | Powers | Notes |
|---|---|---|
| `afonsofernandescruz/2026-fifa-world-cup-historical-elo-ratings` | `elo-ratings.json` | per-team current/peak Elo; upstream is **eloratings.net** (see below) |
| `martj42/international-football-results-from-1872-to-2017` | `head-to-head.json`, `team-all-time-records.json` | all international results 1872–present (results.csv etc.) |

### Elo upstream — eloratings.net
The Kaggle Elo dataset derives from **World Football Elo Ratings (eloratings.net,
Lange)**. The raw upstream files (TSV, documented in `data/enrichment/elo/README.md`):
- `https://www.eloratings.net/<YYYY>.tsv` — end-of-year snapshot per year (1901–2025)
- `https://www.eloratings.net/World.tsv` — current-day snapshot (live row)
- `https://www.eloratings.net/en.teams.tsv` — team-code → name mapping
Country codes there are mostly ISO-3166-1 alpha-2 with site quirks (`EN` England,
`SQ` Scotland, `KR` South Korea).

## Status codes & errors

- `200`/`302` for downloads (redirect to signed GCS URL). `401`/`403` if a private
  resource needs auth. `404` for unknown owner/slug. Standard Kaggle JSON errors on
  authenticated endpoints.

## Rate limits & quotas

- Kaggle applies per-account API throttling (not publicly enumerated). These are
  **one-time** downloads, so limits are not a concern for this app.

## Pricing / plan tiers

- **Free.** A Kaggle account is free; the API and public dataset downloads are free.
  Datasets carry their own licenses — check each dataset page before redistribution.

## Gotchas

- **No key needed for public dataset downloads** — the project notes this explicitly.
- The CLI requires **Python 3.11+**.
- These are **static one-time** fetches; the CSVs are vendored under
  `data/enrichment/elo/` and `data/enrichment/results/` for reproducibility (not loaded
  by the app at runtime).
- Respect each dataset's license/attribution (e.g. credit eloratings.net for Elo).
