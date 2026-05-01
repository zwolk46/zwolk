// Static requires (wrapped in try/catch) so Vercel's bundler can trace and
// bundle these dependencies with the function. Dynamic require(varName) is
// not statically analyzable and gets stripped from the deployment package.
function safe(loader) {
  try { return { ok: true, mod: loader() }; }
  catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
}

function tryRequire(name) {
  switch (name) {
    case 'js-yaml':   return safe(() => require('js-yaml'));
    case 'xlsx':      return safe(() => require('xlsx'));
    case 'marked':    return safe(() => require('marked'));
    case 'turndown':  return safe(() => require('turndown'));
    case 'mammoth':   return safe(() => require('mammoth'));
    case 'pdf-parse': return safe(() => require('pdf-parse'));
    case 'sharp':     return safe(() => require('sharp'));
    default:          return { ok: false, error: `Unknown module: ${name}` };
  }
}

function addPairs(pairs, fromList, toList) {
  for (const from of fromList) {
    for (const to of toList) {
      if (from === to) continue;
      pairs.push({ from, to });
    }
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const yaml = tryRequire('js-yaml');
  const xlsx = tryRequire('xlsx');
  const marked = tryRequire('marked');
  const turndown = tryRequire('turndown');
  const mammoth = tryRequire('mammoth');
  const pdfParse = tryRequire('pdf-parse');
  const sharp = tryRequire('sharp');

  const pairs = [];
  const converters = [];

  if (yaml.ok) {
    addPairs(pairs, ['json', 'yaml'], ['json', 'yaml']);
    converters.push({ id: 'yaml', label: 'YAML/JSON', ok: true });
  } else {
    converters.push({ id: 'yaml', label: 'YAML/JSON', ok: false, error: yaml.error });
  }

  if (xlsx.ok) {
    pairs.push({ from: 'csv', to: 'xlsx' });
    pairs.push({ from: 'xlsx', to: 'csv' });
    converters.push({ id: 'xlsx', label: 'CSV/XLSX', ok: true });
  } else {
    converters.push({ id: 'xlsx', label: 'CSV/XLSX', ok: false, error: xlsx.error });
  }

  if (marked.ok && turndown.ok) {
    pairs.push({ from: 'md', to: 'html' });
    pairs.push({ from: 'html', to: 'md' });
    converters.push({ id: 'markdown', label: 'Markdown/HTML', ok: true });
  } else {
    converters.push({
      id: 'markdown',
      label: 'Markdown/HTML',
      ok: false,
      error: [marked.ok ? null : marked.error, turndown.ok ? null : turndown.error].filter(Boolean).join(' | ')
    });
  }

  if (mammoth.ok) {
    pairs.push({ from: 'docx', to: 'html' });
    pairs.push({ from: 'docx', to: 'txt' });
    converters.push({ id: 'docx', label: 'DOCX', ok: true });
  } else {
    converters.push({ id: 'docx', label: 'DOCX', ok: false, error: mammoth.error });
  }

  if (pdfParse.ok) {
    pairs.push({ from: 'pdf', to: 'txt' });
    converters.push({ id: 'pdf', label: 'PDF', ok: true });
  } else {
    converters.push({ id: 'pdf', label: 'PDF', ok: false, error: pdfParse.error });
  }

  if (sharp.ok) {
    addPairs(pairs, ['png', 'jpg', 'jpeg', 'webp', 'avif'], ['png', 'jpg', 'jpeg', 'webp', 'avif']);
    converters.push({ id: 'images', label: 'Images (sharp)', ok: true });
  } else {
    converters.push({ id: 'images', label: 'Images (sharp)', ok: false, error: sharp.error });
  }

  // Formats shown in the UI (union of inputs/outputs we advertise).
  const formatIds = new Set();
  for (const p of pairs) {
    formatIds.add(p.from);
    formatIds.add(p.to);
  }

  return res.status(200).json({
    ok: true,
    formats: [...formatIds].sort(),
    pairs,
    converters
  });
};

