// Use the full Railway-hosted OmniConvert server if configured & reachable,
// otherwise fall back to the Vercel serverless API on the same origin.
//
// To point at the full server, add this to the page:
//   <meta name="omniconvert-server" content="https://your-app.up.railway.app">
const FULL_SERVER_BASE = (
  document.querySelector('meta[name="omniconvert-server"]')?.content || ''
).replace(/\/$/, '');
const VERCEL_API = '/api/omniconvert';

let useFullServer = false;

const zoneEl      = document.getElementById('zone');
const fileInput   = document.getElementById('file-input');
const fileRow     = document.getElementById('file-row');
const fileBadge   = document.getElementById('file-badge');
const badgeExt    = document.getElementById('badge-ext');
const fileNameEl  = document.getElementById('file-name');
const fileMetaEl  = document.getElementById('file-meta');
const clearBtn    = document.getElementById('clear-btn');
const divider     = document.getElementById('divider');
const controlsEl  = document.getElementById('controls');
const formatSel   = document.getElementById('format-select');
const convertBtn  = document.getElementById('convert-btn');
const btnLabel    = document.getElementById('btn-label');
const noConvEl    = document.getElementById('no-conv');
const noConvMsg   = document.getElementById('no-conv-msg');
const statusEl    = document.getElementById('status');
const convGrid    = document.getElementById('conv-grid');

let selectedFile = null;
let caps = null;
let statusTimer = null;

// ─── Format metadata ───────────────────────────────────────────────────────

const FORMAT_META = {
  // Images
  png:  { label: 'PNG',        group: 'Images',    cat: 'image'    },
  jpg:  { label: 'JPEG',       group: 'Images',    cat: 'image'    },
  jpeg: { label: 'JPEG',       group: 'Images',    cat: 'image'    },
  webp: { label: 'WebP',       group: 'Images',    cat: 'image'    },
  avif: { label: 'AVIF',       group: 'Images',    cat: 'image'    },
  gif:  { label: 'GIF',        group: 'Images',    cat: 'image'    },
  bmp:  { label: 'BMP',        group: 'Images',    cat: 'image'    },
  tiff: { label: 'TIFF',       group: 'Images',    cat: 'image'    },
  tif:  { label: 'TIFF',       group: 'Images',    cat: 'image'    },
  heic: { label: 'HEIC',       group: 'Images',    cat: 'image'    },
  heif: { label: 'HEIF',       group: 'Images',    cat: 'image'    },
  ico:  { label: 'ICO',        group: 'Images',    cat: 'image'    },
  svg:  { label: 'SVG',        group: 'Images',    cat: 'image'    },
  // Audio
  mp3:  { label: 'MP3',        group: 'Audio',     cat: 'audio'    },
  wav:  { label: 'WAV',        group: 'Audio',     cat: 'audio'    },
  flac: { label: 'FLAC',       group: 'Audio',     cat: 'audio'    },
  aac:  { label: 'AAC',        group: 'Audio',     cat: 'audio'    },
  m4a:  { label: 'M4A',        group: 'Audio',     cat: 'audio'    },
  ogg:  { label: 'Ogg',        group: 'Audio',     cat: 'audio'    },
  opus: { label: 'Opus',       group: 'Audio',     cat: 'audio'    },
  // Video
  mp4:  { label: 'MP4',        group: 'Video',     cat: 'video'    },
  mkv:  { label: 'MKV',        group: 'Video',     cat: 'video'    },
  webm: { label: 'WebM',       group: 'Video',     cat: 'video'    },
  mov:  { label: 'MOV',        group: 'Video',     cat: 'video'    },
  avi:  { label: 'AVI',        group: 'Video',     cat: 'video'    },
  // Data
  json: { label: 'JSON',       group: 'Data',      cat: 'data'     },
  yaml: { label: 'YAML',       group: 'Data',      cat: 'data'     },
  yml:  { label: 'YAML',       group: 'Data',      cat: 'data'     },
  xml:  { label: 'XML',        group: 'Data',      cat: 'data'     },
  csv:  { label: 'CSV',        group: 'Data',      cat: 'data'     },
  xlsx: { label: 'Excel',      group: 'Data',      cat: 'data'     },
  // Documents
  pdf:  { label: 'PDF',        group: 'Documents', cat: 'document' },
  docx: { label: 'Word',       group: 'Documents', cat: 'document' },
  doc:  { label: 'Word',       group: 'Documents', cat: 'document' },
  odt:  { label: 'ODT',        group: 'Documents', cat: 'document' },
  txt:  { label: 'Text',       group: 'Documents', cat: 'document' },
  rtf:  { label: 'RTF',        group: 'Documents', cat: 'document' },
  pptx: { label: 'PowerPoint', group: 'Documents', cat: 'document' },
  epub: { label: 'EPUB',       group: 'Documents', cat: 'document' },
  mobi: { label: 'MOBI',       group: 'Documents', cat: 'document' },
  // Markup
  html: { label: 'HTML',       group: 'Markup',    cat: 'markup'   },
  htm:  { label: 'HTML',       group: 'Markup',    cat: 'markup'   },
  md:   { label: 'Markdown',   group: 'Markup',    cat: 'markup'   },
  // Archives
  zip:  { label: 'ZIP',        group: 'Archives',  cat: 'archive'  },
  '7z': { label: '7-Zip',      group: 'Archives',  cat: 'archive'  },
  tar:  { label: 'TAR',        group: 'Archives',  cat: 'archive'  },
  tgz:  { label: 'TAR.GZ',     group: 'Archives',  cat: 'archive'  },
};

const CAT_COLOR = {
  image:    '#3b82f6',
  audio:    '#f59e0b',
  video:    '#ef4444',
  document: '#6366f1',
  data:     '#10b981',
  markup:   '#0ea5e9',
  archive:  '#8b5cf6',
  default:  '#52525b',
};

const GROUP_ORDER = ['Images', 'Documents', 'Markup', 'Data', 'Audio', 'Video', 'Archives'];

const CONVERTER_DISPLAY = {
  // Vercel serverless converters
  images:   { title: 'Images',         formatsNote: 'PNG ↔ JPEG ↔ WebP ↔ AVIF' },
  yaml:     { title: 'JSON & YAML',    formatsNote: 'JSON ↔ YAML' },
  xlsx:     { title: 'Spreadsheets',   formatsNote: 'CSV ↔ Excel (XLSX)' },
  markdown: { title: 'Markup',         formatsNote: 'Markdown ↔ HTML' },
  docx:     { title: 'Word Documents', formatsNote: 'DOCX → HTML, DOCX → Text' },
  pdf:      { title: 'PDF',            formatsNote: 'PDF → Text' },
  // Railway full-server converters
  ffmpeg:       { title: 'Audio & Video', formatsNote: 'MP4 ↔ MKV ↔ WebM · MP3 ↔ WAV ↔ FLAC ↔ AAC' },
  imagemagick:  { title: 'Images',        formatsNote: 'PNG ↔ JPEG ↔ WebP ↔ AVIF ↔ BMP ↔ TIFF · HEIC, ICO' },
  libreoffice:  { title: 'Documents',     formatsNote: 'DOCX ↔ ODT ↔ PDF · PPTX → PDF · XLSX ↔ ODS' },
  pandoc:       { title: 'Markup',        formatsNote: 'Markdown ↔ DOCX ↔ HTML ↔ LaTeX ↔ EPUB' },
  inkscape:     { title: 'Vector',        formatsNote: 'SVG → PNG · SVG → PDF · SVG → EPS' },
  calibre:      { title: 'Ebooks',        formatsNote: 'EPUB ↔ MOBI ↔ AZW3 ↔ FB2 ↔ PDF' },
  ghostscript:  { title: 'PDF / PostScript', formatsNote: 'PDF ↔ PostScript · PDF → PNG/JPEG' },
  '7zip':       { title: 'Archives',      formatsNote: 'ZIP ↔ 7Z ↔ TAR ↔ TAR.GZ ↔ BZ2 ↔ XZ' },
  'builtin-data': { title: 'Data',        formatsNote: 'JSON ↔ YAML ↔ XML · CSV ↔ XLSX' },
};

// ─── Init ──────────────────────────────────────────────────────────────────

detectAvailableAPI();
wireZone();
clearBtn.addEventListener('click', clearFile);
convertBtn.addEventListener('click', doConvert);

// ─── Zone wiring ───────────────────────────────────────────────────────────

function wireZone() {
  zoneEl.addEventListener('click', () => fileInput.click());
  zoneEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  zoneEl.addEventListener('dragover', e => {
    e.preventDefault();
    zoneEl.classList.add('drag-over');
  });
  zoneEl.addEventListener('dragleave', e => {
    if (!zoneEl.contains(e.relatedTarget)) zoneEl.classList.remove('drag-over');
  });
  zoneEl.addEventListener('drop', e => {
    e.preventDefault();
    zoneEl.classList.remove('drag-over');
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) setFile(f);
    fileInput.value = '';
  });
}

// ─── File state ────────────────────────────────────────────────────────────

function setFile(f) {
  selectedFile = f;
  renderFileState();
}

function clearFile() {
  selectedFile = null;
  renderFileState();
}

function renderFileState() {
  const hasFile = !!selectedFile;
  setStatus('');
  zoneEl.hidden    = hasFile;
  fileRow.hidden   = !hasFile;
  divider.hidden   = !hasFile;

  if (!hasFile) {
    controlsEl.hidden = true;
    noConvEl.hidden   = true;
    return;
  }

  const fromId = inferFormat(selectedFile.name);
  const meta   = fromId ? FORMAT_META[fromId] : null;
  const cat    = meta?.cat ?? 'default';
  const label  = meta?.label ?? (fromId ? fromId.toUpperCase() : 'Unknown');
  const ext    = fromId ?? (selectedFile.name.split('.').pop() ?? '');

  // Badge
  fileBadge.style.setProperty('--badge-bg', CAT_COLOR[cat] ?? CAT_COLOR.default);
  badgeExt.textContent = ext.slice(0, 5).toUpperCase();

  // Info
  fileNameEl.textContent = selectedFile.name;
  fileMetaEl.textContent = `${prettyBytes(selectedFile.size)} · ${label}`;

  // Targets
  const targets = getTargets(fromId);

  if (targets.length === 0) {
    controlsEl.hidden = true;
    noConvEl.hidden   = false;
    noConvMsg.textContent =
      `No serverless conversions are available for ${label} files on zwolk.com.`;
    return;
  }

  noConvEl.hidden   = true;
  controlsEl.hidden = false;
  convertBtn.disabled = false;
  populateSelect(targets);
}

function getTargets(fromId) {
  if (!caps?.pairs || !fromId) return [];
  const set = new Set();
  for (const p of caps.pairs) {
    if (p.from === fromId) set.add(p.to);
  }
  return [...set];
}

function populateSelect(targetIds) {
  formatSel.innerHTML = '';

  const byGroup = new Map();
  for (const id of targetIds) {
    const m     = FORMAT_META[id];
    const group = m?.group ?? 'Other';
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push({ id, label: m?.label ?? id.toUpperCase() });
  }

  const groupNames = [...byGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  for (const gName of groupNames) {
    const items = byGroup.get(gName);
    const useGroups = groupNames.length > 1;
    const parent = useGroups
      ? (() => { const og = document.createElement('optgroup'); og.label = gName; return og; })()
      : formatSel;

    for (const { id, label } of items) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${label} (.${id})`;
      parent.appendChild(opt);
    }
    if (useGroups) formatSel.appendChild(parent);
  }
}

// ─── Conversion ────────────────────────────────────────────────────────────

async function doConvert() {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  convertBtn.classList.add('is-loading');
  btnLabel.textContent = 'Converting…';

  try {
    if (useFullServer) {
      await doConvertViaFullServer();
    } else {
      await doConvertViaVercel();
    }
  } catch (err) {
    setStatus(String(err?.message ?? err), 'error');
  } finally {
    btnLabel.textContent = 'Convert';
    convertBtn.disabled  = false;
    convertBtn.classList.remove('is-loading');
  }
}

async function doConvertViaVercel() {
  const to   = formatSel.value;
  const from = inferFormat(selectedFile.name);
  const buf  = await selectedFile.arrayBuffer();

  const url = new URL(`${VERCEL_API}/convert`, location.origin);
  url.searchParams.set('to', to);
  if (from) url.searchParams.set('from', from);
  url.searchParams.set('filename', selectedFile.name);

  setStatus('Converting…');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-filename': selectedFile.name },
    body: buf,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Server error (${res.status})`);
  }

  const blob    = await res.blob();
  const cd      = res.headers.get('content-disposition') ?? '';
  const outName = parseFilename(cd) || suggestName(selectedFile.name, selectedFile.name.split('.').pop());
  downloadBlob(blob, outName);
  setStatus(`Done — ${outName} downloaded.`, 'success');
  clearStatusAfter(5000);
}

async function doConvertViaFullServer() {
  const to = formatSel.value;

  // Prepare multipart form
  const form = new FormData();
  form.append('file', selectedFile, selectedFile.name);
  form.append('to', to);

  setStatus('Uploading…');

  // Upload file and get job ID
  let res = await fetch(`${FULL_SERVER_BASE}/api/jobs`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Upload failed (${res.status})`);
  }

  const jobData = await res.json();
  if (!jobData.ok) throw new Error(jobData.error || 'Job creation failed');

  const jobId = jobData.job.id;
  setStatus(`Converting… (${jobId})`);

  // Poll for completion
  let completed = false;
  let finalJob = null;

  for (let attempt = 0; attempt < 1200; attempt++) {
    await sleep(500); // Poll every 500ms
    res = await fetch(`${FULL_SERVER_BASE}/api/jobs/${jobId}`);

    if (!res.ok) {
      throw new Error(`Failed to check job status (${res.status})`);
    }

    const jobStatus = await res.json();
    if (!jobStatus.ok) throw new Error(jobStatus.error || 'Job status check failed');

    finalJob = jobStatus.job;
    if (finalJob.status === 'succeeded') {
      completed = true;
      break;
    }
    if (finalJob.status === 'failed' || finalJob.status === 'cancelled') {
      throw new Error(finalJob.error || `Conversion ${finalJob.status}`);
    }
  }

  if (!completed) throw new Error('Conversion timeout (10 minutes)');

  // Download result
  setStatus('Downloading…');
  res = await fetch(`${FULL_SERVER_BASE}/api/jobs/${jobId}/download`);

  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const blob    = await res.blob();
  const cd      = res.headers.get('content-disposition') ?? '';
  const outName = parseFilename(cd) || suggestName(selectedFile.name, to);
  downloadBlob(blob, outName);
  setStatus(`Done — ${outName} downloaded.`, 'success');
  clearStatusAfter(5000);
}

// ─── Capabilities ──────────────────────────────────────────────────────────

function capabilitiesUrl() {
  return useFullServer
    ? `${FULL_SERVER_BASE}/api/capabilities`
    : `${VERCEL_API}/capabilities`;
}

async function detectAvailableAPI() {
  if (FULL_SERVER_BASE) {
    try {
      const res = await fetch(`${FULL_SERVER_BASE}/api/health`, { method: 'GET' });
      if (res.ok) {
        useFullServer = true;
        console.log('Using full OmniConvert server:', FULL_SERVER_BASE);
      }
    } catch {
      console.log('Full server unreachable; falling back to Vercel serverless.');
    }
  }
  loadCaps();
}

async function loadCaps() {
  try {
    const res = await fetch(capabilitiesUrl());
    caps = normalizeCaps(await res.json());
  } catch {
    caps = null;
  }
  renderCaps();
  if (selectedFile) renderFileState();
}

// Normalize between Vercel & Railway response shapes:
//   Vercel:  { pairs: [...], converters: [{ id, label, ok }] }
//   Railway: { formats, converters: [{ id, label, availability: {ok}, pairs }] }
function normalizeCaps(raw) {
  if (!raw || !Array.isArray(raw.converters)) return raw;
  const allPairs = Array.isArray(raw.pairs) ? raw.pairs.slice() : [];
  const converters = raw.converters.map(c => {
    const ok = c.ok ?? c.availability?.ok ?? false;
    if (!Array.isArray(raw.pairs) && Array.isArray(c.pairs) && ok) {
      for (const p of c.pairs) allPairs.push(p);
    }
    return { id: c.id, label: c.label, ok };
  });
  return { ...raw, pairs: allPairs, converters };
}

function renderCaps() {
  if (!caps?.converters) {
    convGrid.innerHTML = '<p class="caps-loading">Failed to load capabilities.</p>';
    return;
  }
  convGrid.innerHTML = '';
  for (const c of caps.converters) {
    const d    = CONVERTER_DISPLAY[c.id] ?? { title: c.label, formatsNote: '' };
    const card = document.createElement('div');
    card.className = `conv-card${c.ok ? '' : ' unavail'}`;
    card.innerHTML = `
      <div class="conv-card-head">
        <span class="conv-card-title">${esc(d.title)}</span>
        <span class="conv-badge ${c.ok ? 'ok' : 'missing'}">${c.ok ? 'Ready' : 'Missing'}</span>
      </div>
      <p class="conv-card-formats">${esc(d.formatsNote)}</p>
    `;
    convGrid.appendChild(card);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function inferFormat(name) {
  const lower = String(name ?? '').toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tgz';
  const dot = lower.lastIndexOf('.');
  if (dot === -1) return null;
  return lower.slice(dot + 1) || null;
}

function prettyBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function parseFilename(cd) {
  return (/filename="([^"]+)"/i.exec(cd ?? '') ?? [])[1] ?? null;
}

function suggestName(inputName, to) {
  const base = String(inputName || 'file').replace(/[/\\]/g, '').replace(/\.[^.]+$/, '');
  return `${base}.${to}`;
}

function downloadBlob(blob, filename) {
  const a   = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function setStatus(msg, state = '') {
  clearTimeout(statusTimer);
  statusEl.textContent = msg;
  statusEl.className   = `status${state ? ' ' + state : ''}`;
}

function clearStatusAfter(ms) {
  statusTimer = setTimeout(() => setStatus(''), ms);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
