const mime = require('mime-types');

function getQuery(req) {
  const url = new URL(req.url, 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}

function extOf(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tgz';
  const idx = lower.lastIndexOf('.');
  if (idx < 0) return '';
  return lower.slice(idx + 1).trim();
}

function baseName(name) {
  const n = String(name || 'file').split('/').pop().split('\\').pop();
  const dot = n.lastIndexOf('.');
  const raw = dot > 0 ? n.slice(0, dot) : n;
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'file';
}

async function readBodyBuffer(req, maxBytes) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error(`File too large (max ${maxBytes} bytes)`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + '\n';
}

function normalizeText(buf) {
  return Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const q = getQuery(req);
    const to = String(q.to || '').trim().toLowerCase();
    const filename = String(req.headers['x-filename'] || q.filename || 'upload');
    const from = String(q.from || extOf(filename) || '').trim().toLowerCase();
    if (!to) return res.status(400).json({ ok: false, error: 'Missing `to`' });
    if (!from) return res.status(400).json({ ok: false, error: 'Missing `from` (or provide x-filename)' });

    const maxBytes = Number(process.env.OMNICONVERT_MAX_BYTES || 20_000_000);
    const input = await readBodyBuffer(req, maxBytes);

    const outBase = baseName(filename);
    const outName = `${outBase}.${to}`;

    let outputBuffer = null;
    let outputText = null;

    // JSON <-> YAML
    if (from === 'json' && to === 'yaml') {
      const yaml = require('js-yaml');
      const obj = JSON.parse(normalizeText(input));
      outputText = yaml.dump(obj, { noRefs: true, lineWidth: 120 });
    } else if (from === 'yaml' && to === 'json') {
      const yaml = require('js-yaml');
      const obj = yaml.load(normalizeText(input));
      outputText = JSON.stringify(obj, null, 2) + '\n';
    }

    // CSV <-> XLSX
    else if (from === 'csv' && to === 'xlsx') {
      const XLSX = require('xlsx');
      const csv = normalizeText(input);
      const wb = XLSX.read(csv, { type: 'string' });
      outputBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    } else if (from === 'xlsx' && to === 'csv') {
      const XLSX = require('xlsx');
      const wb = XLSX.read(input, { type: 'buffer' });
      const name = wb.SheetNames[0];
      if (!name) throw new Error('XLSX has no sheets');
      const ws = wb.Sheets[name];
      outputText = XLSX.utils.sheet_to_csv(ws);
    }

    // Markdown <-> HTML
    else if (from === 'md' && to === 'html') {
      const { marked } = require('marked');
      outputText = marked.parse(normalizeText(input));
    } else if (from === 'html' && to === 'md') {
      const TurndownService = require('turndown');
      const td = new TurndownService({ codeBlockStyle: 'fenced' });
      outputText = td.turndown(normalizeText(input)) + '\n';
    }

    // DOCX -> HTML/TXT
    else if (from === 'docx' && (to === 'html' || to === 'txt')) {
      const mammoth = require('mammoth');
      const result = await mammoth.convertToHtml({ buffer: input });
      if (to === 'html') outputText = result.value || '';
      else outputText = stripHtml(result.value || '');
    }

    // PDF -> TXT
    else if (from === 'pdf' && to === 'txt') {
      const pdf = require('pdf-parse');
      const out = await pdf(input);
      outputText = String(out && out.text ? out.text : '').trim() + '\n';
    }

    // Images (sharp)
    else if (['png', 'jpg', 'jpeg', 'webp', 'avif'].includes(to)) {
      // Allow sharp to sniff input format for many common images.
      const sharp = require('sharp');
      const fmt = to === 'jpg' ? 'jpeg' : to;
      outputBuffer = await sharp(input).toFormat(fmt).toBuffer();
    }

    else {
      return res.status(400).json({ ok: false, error: `Unsupported conversion: ${from} -> ${to}` });
    }

    const contentType = mime.contentType(to) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);

    if (outputBuffer) return res.status(200).send(outputBuffer);
    return res.status(200).send(Buffer.from(outputText || '', 'utf8'));
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};

