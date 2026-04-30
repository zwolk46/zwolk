# Deploying OmniConvert for Maximum Format Support

The full OmniConvert server supports **50+ file formats** with automatic tool detection. This guide shows how to deploy it.

## Option 1: Railway.app (Recommended - Simplest)

Railway automatically detects Dockerfiles and deploys them. Takes ~2 minutes.

### Steps:

1. **Sign in to Railway**: https://railway.app (connect with GitHub)

2. **Create new project** → **Deploy from GitHub repo**
   - Select: `zachs-projects/zwolk`
   - Select: `omniconvert` as the root directory (optional, it can find the Dockerfile)

3. **Configure environment**:
   - Railway will detect `Dockerfile` and use it
   - Set environment variables:
     ```
     HOST=0.0.0.0
     PORT=3099
     NODE_ENV=production
     ```
   - Railway automatically exposes `PORT` from the Dockerfile

4. **Deploy** - Click the deploy button. Railway builds and deploys in ~2 minutes.

5. **Get your URL**:
   - After deploy completes, Railway shows a public URL (e.g., `https://omniconvert-production-xxxx.up.railway.app`)
   - This is your `OMNICONVERT_SERVER_URL`

### Configure the Website:

Once deployed, the website at https://zwolk.com/omniconvert will **automatically detect** the full server and use it. The frontend tries:

1. Check if full server is accessible (via environment variable or URL you provide)
2. Fall back to Vercel serverless if full server isn't available

**To explicitly set the server URL** (optional - add to Vercel env vars):

```bash
OMNICONVERT_SERVER_URL=https://omniconvert-production-xxxx.up.railway.app
```

Then redeploy Vercel with this env var.

---

## Option 2: Render.com

Render also supports Docker deployments.

### Steps:

1. Sign in to https://render.com

2. **New** → **Web Service** → **Deploy existing Dockerfile from GitHub**
   - Repository: `zachs-projects/zwolk`
   - Root directory: `omniconvert`

3. **Configuration**:
   - Instance type: Standard
   - Region: Choose closest to you
   - Environment variables:
     ```
     NODE_ENV=production
     ```

4. **Create** and wait ~5 minutes for build

5. Get your public URL from the dashboard

---

## Option 3: Fly.io

Supports Docker deployments with persistent storage.

### Steps:

1. Install Fly CLI: `brew install flyctl` (macOS) or [https://fly.io/docs/hands-on/install-flyctl/](https://fly.io/docs/hands-on/install-flyctl/)

2. Sign in: `flyctl auth login`

3. Deploy:
   ```bash
   cd omniconvert
   flyctl launch --dockerfile Dockerfile
   ```

4. Answer prompts:
   - App name: `omniconvert-yourname`
   - Region: Choose one
   - Postgres: No
   - Redis: No

5. Deploy: `flyctl deploy`

6. Get URL: `flyctl info` shows your public URL

---

## What Gets Deployed

The Docker container installs and configures:

- **Node.js 24** (LTS)
- **FFmpeg** - Video/audio conversion (MP4, MKV, WebM, MP3, WAV, FLAC, AAC, OGG, Opus, etc.)
- **ImageMagick** - Image conversion (PNG, JPEG, WebP, AVIF, BMP, TIFF, ICO, PSD, etc.)
- **LibreOffice** - Document conversion (DOCX ↔ ODT ↔ PDF, PPTX → PDF, XLSX ↔ ODS, etc.)
- **Pandoc** - Markup conversion (MD ↔ DOCX ↔ HTML, RST, LaTeX, etc.)
- **Inkscape** - Vector conversion (SVG → PNG, SVG → PDF)
- **Calibre** - Ebook conversion (EPUB ↔ MOBI, AZW3, FB2, etc.)
- **Ghostscript** - PDF/PostScript processing (PDF ↔ PS, page rasterization)
- **7-Zip** - Archive handling (ZIP, 7Z, TAR, TAR.GZ, etc.)

Fastify web server runs on port 3099 with:
- `/api/health` - Health check
- `/api/capabilities` - List available conversions (with auto-detection)
- `/api/jobs` - Upload file, get job ID
- `/api/jobs/:id` - Check conversion status
- `/api/jobs/:id/download` - Download result

---

## Local Testing

To test locally before deploying:

```bash
cd omniconvert
docker build -t omniconvert .
docker run --rm -p 3099:3099 omniconvert
```

Then visit http://localhost:3099

---

## Scaling & Limits

- **Typical file sizes**: 100 MB - 2 GB depending on platform and format
- **Conversion time**: 10 seconds - 5 minutes depending on format/size
- **Storage**: Temporary files cleaned up after download

For Railway:
- Starter ($5/month): 8 GB RAM, suitable for most conversions
- Standard ($12/month): 16 GB RAM, recommended for 4K video
- Pro: Custom sizing

---

## Connecting Frontend to Backend

Once deployed, the frontend **automatically detects** the full server:

1. Checks `OMNICONVERT_SERVER_URL` environment variable (if set on Vercel)
2. Tries to ping the full server at `/api/health`
3. Falls back to Vercel serverless if not available

**You can**:
- Let it auto-detect (no changes needed)
- Explicitly set `OMNICONVERT_SERVER_URL` on Vercel for guaranteed routing

---

## Monitoring & Logs

### Railway:
Dashboard shows live logs. Redeploy from GitHub with a single click.

### Render:
Dashboard shows build & runtime logs. Connect GitHub for auto-deploys.

### Fly.io:
```bash
flyctl logs
```

---

## Troubleshooting

**"Full server unavailable"**: Check that the deployed URL is accessible and `/api/health` returns `{"ok":true}`

**Conversion timeout (10 min)**: Large files or slow servers. Increase instance size or optimize input.

**"Out of memory"**: Upgrade to larger instance or split large files.

**Docker build fails**: Ensure all system tools install correctly. SSH into container and verify:
```bash
ffmpeg -version
convert -version  # ImageMagick
soffice --help    # LibreOffice
```
