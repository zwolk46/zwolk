# Kaggle — sources

- **Fetched:** 2026-06-20
- **API docs (landing):** https://www.kaggle.com/docs/api  (client-rendered; see CLI README below)
- **CLI README (authoritative, server-rendered):** https://raw.githubusercontent.com/Kaggle/kaggle-api/main/docs/README.md
- **Datasets commands:** https://raw.githubusercontent.com/Kaggle/kaggle-api/main/docs/datasets.md
- **REST base URL:** https://www.kaggle.com/api/v1
- **Credentials page:** https://www.kaggle.com/settings/api
- **OpenAPI / Swagger:** https://github.com/Kaggle/kaggle-api (repo includes the API client + spec, `KaggleSwagger.yaml`)

## Datasets used
- Elo: https://www.kaggle.com/datasets/afonsofernandescruz/2026-fifa-world-cup-historical-elo-ratings
- Results (1872–present): https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017
- Elo upstream: https://www.eloratings.net/ (TSV files: `<YYYY>.tsv`, `World.tsv`, `en.teams.tsv`)

## Fetch method
- `https://www.kaggle.com/docs/api` is **JavaScript-rendered** (returned only the page
  shell to a server-side fetch). The authoritative content was captured from the Kaggle
  CLI **README.md** and **datasets.md** on GitHub raw (server-rendered, full text).
- The public-download path was **verified live** on 2026-06-20:
  `GET https://www.kaggle.com/api/v1/datasets/download/martj42/international-football-results-from-1872-to-2017`
  returned HTTP 302 → a signed `storage.googleapis.com/kaggle-data-sets/...` zip URL
  **with no API key**, confirming public datasets download keyless.
- Dataset slugs and the eloratings.net upstream are cross-checked against
  `wc/data/enrichment/manifest.json`, `ENRICHMENT_HANDOFF.md`, and
  `wc/data/enrichment/elo/README.md`.
