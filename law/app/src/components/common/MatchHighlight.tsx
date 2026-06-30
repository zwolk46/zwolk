import { useMemo } from 'react';

interface Props {
  text: string;
  query: string;
  className?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Wraps every match of `query`'s whitespace-split terms in <mark>. Case-insensitive.
// Returns a fragment of plain strings + <mark> elements.
export function MatchHighlight({ text, query, className }: Props) {
  const parts = useMemo(() => {
    if (!query.trim() || !text) return [text];
    const terms = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegex);
    if (terms.length === 0) return [text];
    const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
    return text.split(pattern);
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
