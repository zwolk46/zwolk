// Compose a section-specific "official source" URL from a normalized node.
// The ingest pipeline currently sets `source.sourceUrl` to the corpus-level
// URL (e.g., https://www.ecfr.gov/current/title-1) — which lands users on the
// title, not the section they were reading. Until the ingest side deep-links
// each node, synthesize the section URL from the citation.

import type { EnrichedNode } from '@/lib/law-data';

function uscDeepLink(node: EnrichedNode): string | null {
  // citation: "1 U.S.C. § 7" — extract title + section
  const cit = node.citation || '';
  const m = cit.match(/^(\d+[A-Za-z]?)\s+U\.S\.C\.\s+§\s+([^\s]+)/i);
  if (!m) return null;
  const title = m[1];
  const section = m[2].replace(/\s+/g, '');
  return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${title}-section${section}&num=0&edition=prelim`;
}

function cfrDeepLink(node: EnrichedNode): string | null {
  // citation: "10 CFR § 490.3" — extract title + section
  const cit = node.citation || '';
  const m = cit.match(/^(\d+)\s+CFR\s+§\s+([^\s]+)/i);
  if (!m) return null;
  const title = m[1];
  const section = m[2].replace(/\s+/g, '');
  return `https://www.ecfr.gov/current/title-${title}/section-${section}`;
}

export function officialSourceUrl(node: EnrichedNode): string | null {
  // If the ingest layer stored a real permalink, prefer it. Corpus-level
  // sourceUrls (e.g. https://www.ecfr.gov/current/title-1) don't count as
  // permalinks for section-level nodes — those get synthesized below.
  const stored = node.source?.permalink;
  if (stored && !isCorpusLevel(stored)) return stored;

  const corpus = (node as { corpus?: string }).corpus || '';
  if (node.kind === 'section') {
    if (corpus === 'us-usc') return uscDeepLink(node) || node.source?.sourceUrl || null;
    if (corpus === 'us-cfr') return cfrDeepLink(node) || node.source?.sourceUrl || null;
  }
  return node.source?.sourceUrl || null;
}

// Heuristic: eCFR corpus-level URLs end with `/title-N` with no further path.
// uscode.house.gov corpus URLs end with `/browse/prelim@titleN` or similar.
function isCorpusLevel(url: string): boolean {
  if (/\.ecfr\.gov\/current\/title-\d+\/?$/i.test(url)) return true;
  if (/uscode\.house\.gov\/browse\/prelim@title\d+/i.test(url)) return true;
  return false;
}
