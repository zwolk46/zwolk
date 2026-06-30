// Scans a paragraph of legal text and emits an array of plain strings and
// matched citations. The renderer (LinkifiedText) turns matches into <Link>s
// (when resolved) or muted spans (when not).

import {
  resolveCitation,
  type CiteCorpus,
} from './citationLookup';
import type { CorpusLike } from './lawClient';

export interface CiteToken {
  kind: 'cite';
  label: string;       // the original text as it appeared (preserves subsection suffixes)
  href: string | null; // null when the corpus is not shipped
  resolved: boolean;   // true when href points somewhere meaningful
}

export type LinkifyPart = string | CiteToken;

// Combined alternation, three forms:
//   (1) Formal USC: "9 U.S.C. § 1(a)"             → groups 1 (title), 2 (section+subs)
//   (2) Formal CFR: "40 C.F.R. § 261.4"           → groups 3 (title), 4 (section)
//   (3) USC narrative: "section 1 of Title 5"      → groups 5 (section), 6 (title)
// The narrative form is the one actually used in USC body text; without it the
// linkifier rarely activates on real content.
const PATTERN =
  /(\d{1,2})\s+U\.S\.C\.\s+§\s+(\d+[A-Za-z]?(?:[–—-]\d+[A-Za-z]?)?(?:\([a-z0-9]+\))*)|(\d{1,2})\s+C\.F\.R\.\s+§\s+(\d+\.\d+(?:[A-Za-z\-]*)?)|section\s+(\d+[A-Za-z]?(?:[–—-]\d+[A-Za-z]?)?(?:\([a-z0-9]+\))*)\s+of\s+[Tt]itle\s+(\d{1,2})/g;

export function linkifyCitations(
  text: string,
  availableJurIds: Set<string>,
  loadedCorpusByJur: (jurId: string) => CorpusLike | null
): LinkifyPart[] {
  if (!text) return [];

  const parts: LinkifyPart[] = [];
  let lastIndex = 0;

  // Reset because the regex is module-level + stateful.
  PATTERN.lastIndex = 0;

  let m: RegExpExecArray | null;
  while ((m = PATTERN.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    let corpus: CiteCorpus;
    let titleNum: number;
    if (m[1]) {
      // Formal USC: "9 U.S.C. § 1"
      corpus = 'us-usc';
      titleNum = Number(m[1]);
    } else if (m[3]) {
      // Formal CFR: "40 C.F.R. § 261.4"
      corpus = 'us-cfr';
      titleNum = Number(m[3]);
    } else {
      // USC narrative: "section 1 of Title 5"  →  always USC.
      corpus = 'us-usc';
      titleNum = Number(m[6]);
    }
    const label = m[0];

    const targetJurId = `${corpus}-t${titleNum}`;
    const loaded = loadedCorpusByJur(targetJurId);
    const resolved = resolveCitation(corpus, titleNum, label, availableJurIds, loaded);

    parts.push({
      kind: 'cite',
      label,
      href: resolved?.href ?? null,
      resolved: !!resolved?.resolved,
    });

    lastIndex = end;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
