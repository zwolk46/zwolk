import type { EnrichedNode } from '@/lib/law-data';
import { LinkifiedText } from '@/components/reader/LinkifiedText';
import { useReaderDisplayOptions } from '@/hooks/useReaderDisplayOptions';

interface Props {
  node: EnrichedNode;
}

export function ReaderBody({ node }: Props) {
  const { fontSize, measure } = useReaderDisplayOptions();
  const text = node.text || '';
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // The jurId for cross-ref resolution within the same corpus.
  const jurId = node.id.includes(':') ? node.id.split(':')[0] : '';

  if (paragraphs.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground italic">
        No body text on this section.
      </p>
    );
  }

  return (
    <article
      className="font-serif leading-[1.65] space-y-6"
      style={{
        fontSize: `${fontSize}px`,
        maxWidth: `${measure}ch`,
      }}
    >
      {paragraphs.map((p, i) => (
        <p key={i}>
          <LinkifiedText text={p} currentJurId={jurId} />
        </p>
      ))}
    </article>
  );
}
