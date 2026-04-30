# OmniConvert: Full Format Support Setup (10 Minutes)

## What You're Getting

- **50+ file formats** (vs 6 on serverless)
- **8 professional conversion tools** pre-installed
- **Task queue** for large files
- **Auto-detection** of what tools are available

## The Fastest Path: Railway.app

Railway is the simplest because it auto-detects Docker and deploys in 2 minutes.

### 1. Go to Railway.app
```
https://railway.app
```
Sign in with GitHub.

### 2. Click "New Project"
- Select "Deploy from GitHub repo"
- Choose `zachs-projects/zwolk`

### 3. Configure
When asked where to deploy from, click "Dockerfile" → it's in `/omniconvert/Dockerfile`

### 4. Click Deploy
That's it. Railway builds automatically (takes ~2 min).

### 5. Copy Your URL
Once deployed, Railway shows you the public URL. It looks like:
```
https://omniconvert-production-xxxx.up.railway.app
```

### 6. (Optional) Update Vercel
If you want to explicitly point the website to your server, add this to Vercel env vars:
```
OMNICONVERT_SERVER_URL=https://omniconvert-production-xxxx.up.railway.app
```

Then redeploy Vercel from the dashboard. (But the website will auto-detect anyway.)

---

## What Happens Now

The website (https://zwolk.com/omniconvert) will:

1. **Check if your full server is running** (via `/api/health` ping)
2. **If yes**: Use it for all conversions (50+ formats)
3. **If no**: Fall back to Vercel serverless (6 formats)

You can test this by:
- Uploading a video (MP4) - serverless doesn't support this
- Uploading an ebook (EPUB) - serverless doesn't support this
- Uploading an audio file (WAV) - serverless doesn't support this

---

## Tools That Will Work

Once deployed, all these conversions become available:

| Format | Tool | Examples |
|--------|------|----------|
| **Video** | FFmpeg | MP4 ↔ MKV ↔ WebM, + convert codecs |
| **Audio** | FFmpeg | MP3 ↔ WAV ↔ FLAC ↔ Opus ↔ AAC |
| **Images** | ImageMagick | PNG ↔ JPEG ↔ WebP ↔ AVIF (+ 20 more) |
| **Documents** | LibreOffice | DOCX ↔ PDF ↔ ODT ↔ PPTX ↔ XLSX |
| **Markup** | Pandoc | Markdown ↔ DOCX ↔ HTML ↔ LaTeX |
| **Vector** | Inkscape | SVG → PNG, SVG → PDF |
| **Ebooks** | Calibre | EPUB ↔ MOBI ↔ AZW3 ↔ FB2 |
| **PDF** | Ghostscript | PDF ↔ PostScript, PDF → images |
| **Archives** | 7-Zip | ZIP ↔ 7Z ↔ TAR.GZ ↔ BZ2 |

---

## Troubleshooting

**Q: How do I know if it's working?**
A: Try uploading a file that Vercel doesn't support (like MP4). If it converts, your server is running.

**Q: I don't see the new formats**
A: Click "Clear file" and try again. The browser caches the capabilities.

**Q: Can I deploy to a different platform?**
A: Yes! See `DEPLOY.md` for Render and Fly.io instructions.

**Q: What if I want to run it locally?**
A: Run locally to test first:
```bash
cd omniconvert
docker build -t omniconvert .
docker run -p 3099:3099 omniconvert
```
Then visit http://localhost:3099

---

## Next Steps

1. ✅ Deploy to Railway (2 min)
2. ✅ Test a complex conversion (2 min)
3. ✅ Done!

The website works as-is. The server auto-integrates.

**Questions?** See `DEPLOY.md` for detailed guides.
