# flagcdn (Flagpedia) — Flag Image API / CDN Reference

> **Role in this app:** country **flag images**. Used app-wide (e.g. `flags/` usage and
> `countries.json` `flag.svg` / `flag.png_w320` / `flag.png_w640`), and as the fallback
> flag source for teams missing elsewhere (e.g. Jordan, absent from TheSportsDB).
> **Auth:** none. **Cost:** free. **Fetched:** 2026-06-20.

---

## What it is

`flagcdn.com` is a free flag image CDN by **Flagpedia.net**, served over Cloudflare
HTTP/2. Covers all 254 country flags, 50 U.S. state flags, plus EU & UN. Vector source
from Wikimedia Commons; PNG, WebP, SVG, or JPEG. No API key, no auth. The provider
**requests a backlink to https://flagpedia.net** (attribution, not strictly enforced).

## Base URL & path patterns

Base: `https://flagcdn.com`. Country code = **ISO-3166-1 alpha-2**, lowercase
(e.g. `us`, `br`, `fr`). Sub-region/special codes use a hyphen (e.g. `gb-eng` England,
`gb-sct` Scotland — both used in this project).

### SVG (vector — what this project mostly uses)
```
https://flagcdn.com/<code>.svg
# e.g. https://flagcdn.com/br.svg , https://flagcdn.com/gb-eng.svg
```

### PNG / WebP / JPEG (raster, by size)
- **Fixed width × height** (4:3 icons):
  `https://flagcdn.com/<WxH>/<code>.png` — e.g. `https://flagcdn.com/48x36/us.png`
  - Sizes: `16x12, 20x15, 24x18, 28x21, 32x24, 36x27, 40x30, 48x36, 56x42, 60x45,
    64x48, 72x54, 80x60, 84x63, 96x72, 108x81, 112x84, 120x90, 128x96, 144x108,
    160x120, 192x144, 224x168, 256x192`
- **Fixed width, variable height:** `https://flagcdn.com/w<width>/<code>.png`
  - Widths: `w20, w40, w80, w160, w320, w640, w1280, w2560`
- **Fixed height, variable width:** `https://flagcdn.com/h<height>/<code>.png`
  - Heights: `h20, h24, h40, h60, h80, h120, h240`
- Swap the extension for other formats: `.png`, `.webp`, `.jpg`. SVG only supports the
  bare `https://flagcdn.com/<code>.svg` form.

### Responsive embed example
```html
<img src="https://flagcdn.com/16x12/ua.png"
     srcset="https://flagcdn.com/32x24/ua.png 2x, https://flagcdn.com/48x36/ua.png 3x"
     width="16" height="12" alt="Ukraine">
```

### Codes list (JSON)
```
https://flagcdn.com/<lang>/codes.json    # e.g. https://flagcdn.com/en/codes.json
```
Returns a map of code → localized name (countries, U.S. states, EU & UN).

## Response / status

- Each URL returns the **image bytes** with the matching content-type
  (`image/svg+xml`, `image/png`, `image/webp`, `image/jpeg`); `codes.json` returns JSON.
- Unknown code/size → HTTP `404`.

## Rate limits / pricing

- **Free**, no key, no documented rate limit (Cloudflare CDN, fair use). Backlink to
  flagpedia.net appreciated.

## Gotchas

- Codes are **lowercase ISO-3166-1 alpha-2**; this project keys most data by **FIFA
  alpha-3** code, so map FIFA→alpha-2 before building a flagcdn URL.
- Home nations use special codes: `gb-eng` (England), `gb-sct` (Scotland).
- Flags update over time ("always up-to-date") — fine for a CDN `<img>`, but if you
  vendor copies, refresh occasionally.
- It serves **images only** — country metadata comes from `countries.json` /
  REST Countries sources.
