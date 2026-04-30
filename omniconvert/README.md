# OmniConvert

Convert “as many files as possible” by combining a plugin-based conversion engine with whatever best-in-class converters you have installed locally (FFmpeg, ImageMagick, LibreOffice, Pandoc, etc.), plus a few built-in JS converters (JSON/YAML, CSV/XLSX).

This repo gives you:
- A local web app (`http://localhost:3099`) for drag/drop upload + download
- A CLI (`omniconvert`) for scripting
- A converter/plugin architecture that auto-detects which external tools are available and only advertises conversions it can actually run

## Quick start

```bash
cd omniconvert
npm install
npm run dev
```

Open `http://localhost:3099`.

## Docker (includes many converters)

```bash
cd omniconvert
docker build -t omniconvert .
docker run --rm -p 3099:3099 omniconvert
```

Open `http://localhost:3099`.

## Install optional converters (recommended)

OmniConvert will work “best effort” with what you have installed. To dramatically increase coverage, install some of these:

### macOS (Homebrew)

```bash
brew install ffmpeg imagemagick pandoc ghostscript
brew install --cask libreoffice
brew install calibre
brew install inkscape
```

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg imagemagick pandoc ghostscript libreoffice calibre inkscape
```

### Windows

- FFmpeg: `choco install ffmpeg`
- ImageMagick: `choco install imagemagick`
- Pandoc: `choco install pandoc`
- Ghostscript: `choco install ghostscript`
- LibreOffice: `choco install libreoffice-fresh`

## What formats are supported?

The app exposes *available* conversions at runtime at:
- `GET /api/capabilities` (converters + supported format pairs)
- `GET /api/targets?filename=...` (targets for a given filename)

In practice:
- **Images**: most common raster formats via ImageMagick (`magick`)
- **Audio/Video**: most common codecs/containers via FFmpeg (`ffmpeg`)
- **Office docs**: common conversions (docx/pptx/xlsx → pdf, etc.) via LibreOffice (`soffice`)
- **Docs/Markup**: markdown/html/docx/rtf/… conversions via Pandoc (`pandoc`)
- **PDF tooling**: some pdf→image/ps conversions via Ghostscript (`gs`)
- **Ebooks**: many ebook conversions via Calibre (`ebook-convert`)
- **Vector**: svg→png/pdf via Inkscape (`inkscape`) when available
- **Built-in** (no external tools): JSON↔YAML, CSV↔XLSX

OmniConvert is intentionally conservative: it only claims a conversion if a converter plugin explicitly supports it *and* the needed executable(s) exist.

To add more coverage, implement additional plugins: `docs/ADDING_CONVERTERS.md`.

## CLI

```bash
# build once
npm run build

# convert a file
./node_modules/.bin/omniconvert ./example.docx --to pdf
```

## Server API (high level)

- `POST /api/jobs` multipart form:
  - file field: `file`
  - text field: `to` (target format id, e.g. `pdf`, `png`, `mp3`)
  - optional text field: `converter` (force a converter id)
- `GET /api/jobs/:id` job status + logs
- `GET /api/jobs/:id/download` download result
- `POST /api/jobs/:id/cancel` cancel a running job

## Notes / boundaries

- “Any file to any file” is not possible in a deterministic way. This project maximizes breadth by delegating to best-in-class converters when available and making the supported matrix explicit.
- Some conversions are lossy by nature (e.g. video → gif, docx → txt).
- For huge files, prefer running the CLI or increasing limits via env vars (see `.env.example`).
