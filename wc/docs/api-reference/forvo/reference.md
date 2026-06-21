# Forvo — Pronunciation API Reference

> **Role in this app:** native-speaker **MP3 pronunciations** of country/player names →
> `data/enrichment/pronunciations.json` (keyed by name; `null` where Forvo has none).
> Powers tap-to-hear on player/country pages. **Forvo attribution is required.**
> Coverage: 46/48 country names + 14/20 sample players. Plan: **Non-Profit ($24/yr)**.
> **Fetched:** 2026-06-20.

---

## Base URL & request formats

- **API host:** `https://apifree.forvo.com` (free/non-commercial plans) — also
  referenced as `https://api.forvo.com`. Audio files are served from
  `https://apifree.forvo.com/audio/...`.
- Requests are built as **path segments** (`/param/value/param/value/...`) in any
  order, e.g.:
  ```
  https://apifree.forvo.com/key/<YOUR_KEY>/format/json/action/word-pronunciations/word/<word>/language/<lang>
  ```

## Authentication

- **API key** passed as the `key` path segment (`/key/<YOUR_KEY>/...`).
- One application uses **exactly one API key**; creating multiple keys to get more
  requests is forbidden. Key/credentials live in `data/enrichment/keys.local.json`
  (gitignored).

## Endpoint used: `word-pronunciations`

**What it does:** returns all pronunciations for a word.

**Required params:**
- `key` — your API key.
- `action` — `word-pronunciations`.
- `format` — `xml` | `json` (jsonp via `callback`/function name) | `js-tag` (returns a
  script tag per pronunciation rendering a play icon).
- `word` — the word to look up.

**Optional params:**
- `language` — restrict to a language (see Forvo language codes list).
- `country` — restrict to speakers from a country (**ISO-3166-1 alpha-3**).
- `username` — only a specific user's recording.
- `sex` — `m` | `f`.
- `rate` — minimum rating (integer).
- `order` — `date-desc` | `date-asc` | `rate-desc` | `rate-asc`.
- `limit` — max pronunciations returned (integer).
- `group-in-languages` — `true` | `false` (default `false`).

**Examples** (from the docs):
```
# cat, English, XML
https://apifree.forvo.com/key/<KEY>/format/xml/action/word-pronunciations/word/cat/language/en
# cat by a specific user, js-tag
https://apifree.forvo.com/key/<KEY>/format/js-tag/action/word-pronunciations/word/cat/username/Sugarmetal
# barcelona, grouped by language
https://apifree.forvo.com/key/<KEY>/format/xml/action/word-pronunciations/word/barcelona/group-in-languages/true
```

**Response (JSON, shape):** an `items` array of pronunciations; each entry includes the
word, language, country, the MP3/OGG audio URL(s), rating, and the contributing
username. The project stores the distilled record `{ word, mp3, language, country,
hits }` (or `null` when no recording exists).

Other available actions (not used here): `standard-pronunciation`, `language-list`,
`language-popular`, `pronounced-words-search`, `words-search`, `popular-pronounced-words`.

## Status / errors

- `200` with the requested format on success. Errors come back in the requested format
  (e.g. JSON with an error/limit message); exceeding the daily limit returns a
  limit-reached error rather than data.

## Rate limits & quotas

- **Per-plan daily request limit, reset every day at 22:00 UTC.** Check live usage in
  your Forvo account. This project's **Non-Profit** plan allows **500 requests/day**
  (the build on 2026-06-20 used 68/500).
- A **"request"** = any API call **and** every play of an audio file from your app.

## Audio-link lifetime (critical)

- Audio URLs returned by the API are valid for **only 2 hours**. After that they stop
  working — re-request to get fresh links.
- **Caching audio pronunciations is NOT allowed.** (So `pronunciations.json` stores the
  link/metadata for tap-to-hear; the audio itself must be fetched fresh from Forvo, not
  cached/rehosted.)

## Pricing / plan tiers

- Tiers range from **free/Non-Profit** (this project: **$24/yr**, non-commercial,
  share-alike, attribution required) up to paid **commercial** plans (which lift the
  non-commercial/share-alike requirement and raise limits). See
  https://api.forvo.com/plans-and-pricing/

## Attribution & branding (REQUIRED)

Free/Non-Profit use **requires crediting Forvo**. Accepted forms (link to
`https://forvo.com/`):
- Blue badge: `<img src="https://api.forvo.com/byforvoblue.gif" width="120" height="40" alt="Pronunciations by Forvo">`
- Standard badge: `https://api.forvo.com/byforvo.gif`
- Text only: `Pronunciations by Forvo` linking to https://forvo.com/

Docs: https://api.forvo.com/documentation/branding/

## Gotchas

- **Non-commercial + share-alike + attribution** unless on a commercial plan.
- **Never cache the audio**; links expire in **2 hours**.
- Daily quota resets **22:00 UTC** (not local midnight).
- `country` uses **alpha-3** codes (most of the rest of this project keys by FIFA code —
  don't confuse them).
- Coverage gaps: 2/48 country names (Bosnia & Herzegovina, DR Congo) have no recording;
  re-run for the full ~240-player set once real Transfermarkt data is loaded.
