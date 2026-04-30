# zwolk

Personal web-app collection deployed on Vercel at `zwolk.com`.

This repository is intentionally simple: most apps are standalone static HTML files in route-named folders, with a small number of Vercel serverless API routes and middleware. Prefer small, local edits over introducing a framework or build pipeline unless the task clearly requires it.

## Project Goals

- Keep a lightweight personal site with multiple focused tools under one domain.
- Make each app independently maintainable and easy to deploy.
- Preserve fast iteration: edit HTML/CSS/JS directly, commit, push, and deploy.
- Avoid global changes that could break unrelated apps.

## Top-Level Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Main landing page with links to apps. |
| `styles.css` | Older/shared homepage-style CSS. Some apps use inline CSS instead. |
| `favicon.svg` | Root favicon. Many app folders have their own favicon copy. |
| `vercel.json` | Vercel config. Currently enables clean URLs and disables trailing slashes. |
| `middleware.js` | Password-gate middleware for the site except `/login` and `/api/login`. |
| `api/login.js` | Password login endpoint that sets the `zwolk_auth` cookie. |
| `api/countdowns.js` | GET/PUT API for countdown data backed by Vercel Edge Config. |
| `api/countdowns-active.js` | GET/PUT API for the selected countdown backed by Vercel Edge Config. |
| `api/ipa-sessions.js` | GET/PUT API for IPA saved sessions backed by Vercel Edge Config. |
| `api/wage-settings.js` | GET/PUT API for the wage timer's persisted hourly wage. |
| `api/socratic-graph.js` | GET/PUT API for Socratic graph autosave state. |
| `en_US.txt` | IPA dictionary used by the IPA app. Large text asset. |
| `01_recording_script.txt` | Pronunciation script/reference text used with the IPA app. |

## Apps

### `/ipa`

Path: `ipa/index.html`

IPA Pronunciation Error Tracker. This is currently the most actively edited app.

Core behavior:

- Uploads text-like files (`.txt`, `.docx`, `.pdf`, `.rtf`, `.md`, `.doc`).
- Cleans the displayed text before annotation.
- Lets the user select a subset of uploaded text before annotation.
- Displays words with IPA phonemes immediately above/below their corresponding words.
- Lets users flag phonemes by severity, add notes, and override IPA symbols.
- Saves completed sessions to backend storage via `api/ipa-sessions.js`.
- Exports results to CSV.

Important implementation notes:

- The app is a single HTML file with inline CSS and vanilla JS.
- `en_US.txt` is loaded at runtime for dictionary lookups.
- The annotation view has a viewport-centered focus effect. The first and last text lines need enough top/bottom scroll padding to pass through the screen center.
- IPA glyphs must never be visually compressed. Phoneme chips should keep natural width and wrap if needed.
- Be careful with date/time or text parsing shortcuts. This app is correctness-sensitive.
- Saved sessions are no longer browser-local; they persist through the backend API.

### `/socratic`

Path: `socratic/index.html`

Socratic Argument Mapper. A standalone React-based argument mapping tool delivered as a static HTML page via ESM CDN imports.

Core behavior:

- React Flow canvas for argument nodes and edges.
- Node types: Fact/Premise, Sub-Conclusion, Main Conclusion, Unstated Assumption, Flaw/Socratic Question.
- Text input box can send highlighted text to the canvas as a premise.
- Double-click nodes to edit.
- Directed edges represent reasoning flow.
- Autosaves graph state to backend storage via `api/socratic-graph.js`.

Important implementation notes:

- This is not a Vite/Next build despite using React. It uses dynamic ESM imports from `esm.sh` because the repo has no build system.
- React Flow requires `ReactFlowProvider`, not `ReactFlow.Provider`.
- The file includes a visible boot-error overlay so CDN/module failures do not look like a silent black screen.
- If this app grows substantially, consider converting it into a real built app, but do that deliberately because it changes the repo deployment model.

### `/countdowns`

Path: `countdowns/index.html`

Countdown management/display app.

Backend:

- `api/countdowns.js`
- `api/countdowns-active.js`
- Uses Vercel Edge Config via these environment variables:
  - `EC_ID`
  - `EC_TOKEN`
  - `EC_TEAM_ID`
  - `EC_WRITE_TOKEN`

The API sanitizes incoming countdown objects. Keep that validation intact when changing the data model.

## Persistent Storage

All app state that should survive a browser restart is backend-backed. Do not add new `localStorage` or `sessionStorage` save paths for durable app state unless the user explicitly asks for browser-only behavior.

Storage is partitioned by authenticated role. Public and admin sessions read and write different Edge Config keys by prefixing the base key with `public:` or `admin:`. Admin reads fall back to the legacy unprefixed key if an admin-prefixed key has not been created yet, preserving existing private data without exposing it to public logins.

Current base storage map:

- `/countdowns`: countdown list in `countdowns`; selected countdown in `countdowns:active-id:v1`.
- `/ipa`: saved pronunciation sessions in `ipa:sessions:v1`, including text, flags, notes, and IPA symbol overrides.
- `/socratic`: graph autosave in `socratic:graph:v1`.
- `/wage`: hourly wage preference in `wage:hourly-v1`.

This currently uses Vercel Edge Config because the repo already has it configured. For very large IPA histories or many users, Vercel Blob, Postgres, or KV would be a better long-term store than Edge Config.

### `/wage`

Path: `wage/index.html`

Standalone wage counter/calculator app.

Persistence:

- The hourly wage value is persisted through `api/wage-settings.js`.

### `/login`

Path: `login/index.html`

Login page for the site password gate. It posts to `/api/login`.

Backend:

- `api/login.js`
- Requires:
  - `GUEST_SITE_PASSWORD`
  - `ADMIN_SITE_PASSWORD`
  - `GUEST_SESSION_TOKEN`
  - `ADMIN_SESSION_TOKEN`

## Deployment Model

This repo is deployed to Vercel as a static site with serverless functions.

Current Vercel config:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

Clean URLs mean folders like `ipa/index.html` are reachable as `/ipa`.

Typical deployment workflow:

```sh
git status --porcelain=v1
git add <changed-files>
git commit -m "Short descriptive message"
git push
vercel ls
```

If the Git integration does not show a fresh deployment, explicitly deploy:

```sh
vercel deploy --prod
```

This project has previously been deployed directly with `vercel deploy --prod`, which aliases the result to `https://www.zwolk.com` when successful.

## Authentication

`middleware.js` protects all routes except:

- `/login`
- `/api/login`

Authenticated access is based on an HTTP-only `zwolk_auth` cookie whose value must match either `GUEST_SESSION_TOKEN` or `ADMIN_SESSION_TOKEN`.

Data APIs call `api/_auth.js` directly and choose storage keys from the authenticated role. Do not rely only on frontend checks or middleware for data separation.

Do not expose site passwords, session tokens, Edge Config tokens, or other secrets in frontend files.

## Development Notes for Agents

- Check `git status --porcelain=v1` before edits.
- Avoid reverting user changes.
- Prefer `rg` for searches.
- Use `apply_patch` for manual edits.
- Keep each app isolated unless the requested change is global.
- Do not add a package manager, bundler, or framework casually. The current repo does not require `npm install` for normal edits.
- For static HTML apps, a lightweight validation command is often enough:

```sh
node -e "const fs=require('fs'); const html=fs.readFileSync('ipa/index.html','utf8'); const js=html.split('<script>')[1].split('</script>')[0]; new Function(js); console.log('JS OK');"
```

Adjust the file path and script extraction if the page has multiple scripts or module scripts.

## UI and Style Conventions

- Existing apps use dark, compact, utilitarian interfaces.
- Many app styles are inline in their `index.html`; preserve that style unless refactoring is explicitly requested.
- Keep text legible and avoid layout shifts.
- On the IPA app, precise typography matters because users are reading phonetic symbols.
- On tool apps, prioritize workflow efficiency over marketing-style presentation.

## Known Sharp Edges

- `/socratic` depends on CDN-hosted modules. If it fails to load, inspect the visible boot-error message first.
- `/ipa` contains a lot of state in one file. When changing annotation behavior, check results export, saved sessions, and render state together.
- `middleware.js` can block all routes if environment variables are missing or cookies do not match.
- `api/countdowns.js` reads/writes external Vercel Edge Config and may need valid production environment variables to test fully.

## Quick Route Inventory

- `/` - app index
- `/ipa` - IPA Pronunciation Error Tracker
- `/socratic` - Socratic Argument Mapper
- `/countdowns` - Countdown app
- `/wage` - Wage counter
- `/login` - Login page
- `/api/login` - login API
- `/api/countdowns` - countdown data API
- `/api/countdowns-active` - selected countdown API
- `/api/ipa-sessions` - IPA saved sessions API
- `/api/wage-settings` - wage preference API
- `/api/socratic-graph` - Socratic graph API
