# Agent Instructions

Deploy every completed change to Vercel by default when it affects the site's or apps' frontend, backend, routes, assets, middleware, configuration, or runtime behavior.

Do not deploy housekeeping-only edits that do not affect the live site or apps, such as local handoff folders, zip files, notes, agent instruction files, gitignore-only changes for ignored local artifacts, or other repo-local documentation/metadata changes.

Other exceptions should be rare and explicit. Do not auto-deploy when the change is an overhaul-type change, destructive, knowingly broken, missing required secrets, or the user asks not to deploy. If deployment is skipped, say exactly why and what must happen before deploying.

---

## How agents work in this repo (start here)

This repo is deployed on **Vercel via GitHub** (`zwolk46/zwolk`, branch `main`). A push to `main` auto-deploys to production (`www.zwolk.com`). There is no separate build step for the static apps.

**Deploying / pushing as an agent.** The sandbox cannot push with in-place git (the mount blocks deleting git lock files, and there are no creds in the env). The working pattern that succeeds:
1. `git clone https://github.com/zwolk46/zwolk.git` into a scratch dir (e.g. `/tmp`).
2. Copy your changed files into the clone, commit them (surgical — one concern per commit).
3. Read the token from the gitignored `.env.local` (`GITHUB_TOKEN=…`, a fine-grained PAT with Contents:read/write) and push: `git push https://x-access-token:$TOKEN@github.com/zwolk46/zwolk.git HEAD:main`. Never print or commit the token; redact it from any output.
4. Verify on production (load the page, check console/network) before calling it done.

**Recurring failure mode to watch for:** new files created locally but never committed. This has caused multiple production outages (`render-live.js`, the `middleware.js` wc2026api proxy). Symptom: a file 503s/404s in prod though it exists locally; a static ES-module import of a missing file white-screens every page that imports it. Before finishing, confirm every new/edited file is actually in the commit and that production serves it.

**Where the app's context lives.** For any World Cup (`/wc`) work, the **doc dispatcher at the top of `wc/CLAUDE.md`** (mirrored in `wc/docs/agents/README.md`) routes you to the one doc your task needs — open that, don't infer from code. `wc/CLAUDE.md` itself stays the source of truth for live-API data shapes + the normalization layer; `wc/docs/agents/` holds the task-specific docs (architecture, pages, data, live pipeline, design system); `wc/data/enrichment/ENRICHMENT_HANDOFF.md` and `wc/docs/api-reference/` have the enrichment + per-source API notes.

**Keeping the tree clean.** A whole-tree Vercel deploy ships every uncommitted change, so don't leave unrelated work-in-progress in the working tree if a broad deploy might happen. Prefer the surgical clone-and-push flow above. Local-only scratch (handoff folders, scratch files) stays out of git via `.gitignore`.

**Requesting changes (for the human).** The most reliable brief names: (1) the page or area (`/wc/groups`, the player detail popup, the nav), (2) what's wrong or wanted, and (3) any constraint (don't blow the wc2026api 500/day budget, keep the dark theme). An agent without prior context can act on that because the per-app `CLAUDE.md` supplies the rest. Cross-browser note: verify in the browser you actually use — Chrome and Arc differ (Arc's built-in blocking, tab sleeping).
