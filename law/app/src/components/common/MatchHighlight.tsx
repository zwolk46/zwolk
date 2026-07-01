import { useMemo } from 'react';
import { normalizeExcerpt } from '@/lib/textNormalize';

interface Props {
  text: string;
  query: string;
  className?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Wraps every match of `query`'s whitespace-split terms in <mark>. Case-insensitive.
// Returns a fragment of plain strings + <mark> elements. Text is decoded from
// legacy HTML entities and cleaned of USC/USLM spacing quirks first — the
// upstream search-docs excerpt builder skips both.
export function MatchHighlight({ text, query, className }: Props) {
  const parts = useMemo(() => {
    const clean = normalizeExcerpt(text);
    if (!query.trim() || !clean) return [clean];
    const terms = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegex);
    if (terms.length === 0) return [clean];
    const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
    return clean.split(pattern);
  }, [text, query]);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-transparent text-foreground underline underline-offset-2 decoration-foreground/40 font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
