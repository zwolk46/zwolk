// Resolves textual citations ("9 U.S.C. § 1", "40 C.F.R. § 261.4") to either
// a specific node id (when the same-corpus exact section is in our cache) or
// to a jurisdiction landing (when we ship that corpus but the exact section
// isn't cached). Returns null when the corpus isn't shipped.

import type { CorpusLike } from './lawClient';

export type CiteCorpus = 'us-usc' | 'us-cfr';

export function jurIdFor(corpus: CiteCorpus, titleNumber: number): string {
  return `${corpus}-t${titleNumber}`;
}

export interface ResolvedCite {
  href: string;
  resolved: boolean; // false = jurisdiction landing only / not shipped
}

export function resolveCitation(
  corpus: CiteCorpus,
  titleNumber: number,
  citationText: string,
  availableJurIds: Set<string>,
  loadedCorpus: CorpusLike | null
): ResolvedCite | null {
  const jurId = jurIdFor(corpus, titleNumber);
  if (!availableJurIds.has(jurId)) {
    // We don't ship this title; render as unresolved muted text.
    return null;
  }

  // Try to find the exact section in the cached corpus.
  if (loadedCorpus) {
    const target = normalize(citationText);
    for (const id in loadedCorpus.nodesById) {
      const n = loadedCorpus.nodesById[id];
      if (n.kind === 'section' && n.citation && normalize(n.citation) === target) {
        const splat = id.includes(':') ? id.split(':')[1] : id;
        return { href: `/j/${jurId}/n/${splat}`, resolved: true };
      }
    }
  }

  // Fallback: link to the jurisdiction landing.
  return { href: `/j/${jurId}`, resolved: true };
}

function normalize(s: string): string {
  // Collapse whitespace, strip subsection suffixes for comparison.
  return s.replace(/\s+/g, ' ').replace(/\([a-z0-9]+\)/gi, '').trim().toLowerCase();
}
