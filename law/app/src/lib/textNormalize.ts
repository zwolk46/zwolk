// Frontend-side rescue for two data-layer bugs that would otherwise require a
// full re-ingest of every corpus. This normalization is applied as we render
// section body text and search excerpts, so users see clean text immediately.
// The upstream ingest pipeline (scripts/ingest-usc.mjs, scripts/ingest-ecfr.mjs)
// should still be fixed so the underlying JSON is correct — this is a safety
// net, not a permanent home.

// Named HTML entities we actually encounter in CFR text. `&amp;`/`&lt;`/`&gt;`
// need to come last so we don't double-decode.
const NAMED_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&sect;': '§',
  '&para;': '¶',
  '&middot;': '·',
  '&bull;': '•',
  '&deg;': '°',
  '&cent;': '¢',
  '&pound;': '£',
  '&yen;': '¥',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
};

function decodeEntities(text: string): string {
  if (!text) return text;
  // Numeric entities: &#x2014; and &#8212; both point at em-dash.
  let out = text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    });
  for (const [name, ch] of Object.entries(NAMED_ENTITIES)) {
    if (out.includes(name)) out = out.split(name).join(ch);
  }
  return out;
}

// USC/USLM extraction sometimes elides the space that separates a subsection
// designator from the sentence it introduces ("(a)For the purposes…") and the
// space after a semicolon inside enumerations ("things;words importing…").
// These regexes recover the most common cases without touching legitimate
// content like URLs, compound identifiers, or citation ranges.
function fixUscSpacing(text: string): string {
  if (!text) return text;
  return (
    text
      // "words;words" → "words; words" — but NOT before whitespace, ), or ]
      .replace(/([a-zA-Z0-9]);(?=[A-Za-z])/g, '$1; ')
      // "text.(A)" or "text.(a)" or "text.(1)" — a period tight against a
      // paren-wrapped designator has an implicit sentence break
      .replace(/([a-zA-Z0-9])\.\(([A-Za-z0-9]{1,4})\)/g, '$1. ($2)')
      // "words(a)" (no space) → "words (a)" when the paren looks like a
      // single- or double-letter/digit designator
      .replace(
        /([a-zA-Z])\(([A-Za-z]|[0-9]{1,3})\)/g,
        '$1 ($2)'
      )
      // ")For" — closing paren followed immediately by a capital letter (start
      // of a sentence): insert a space
      .replace(/\)([A-Z][a-z])/g, ') $1')
      // "text,or" or "text,and" without space — very common in USC extraction
      .replace(/,(and|or|but|nor)\b/g, ', $1')
  );
}

export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return fixUscSpacing(decodeEntities(text));
}

// Excerpts in search-docs.json go through the same normalization; they were
// built with the same broken pipeline so they suffer both bugs.
export function normalizeExcerpt(text: string | null | undefined): string {
  return normalizeText(text);
}
