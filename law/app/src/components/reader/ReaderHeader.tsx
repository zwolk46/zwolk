import type { EnrichedNode } from '@/lib/law-data';
import { StatusBadge } from '@/components/reader/StatusBadge';

interface Props {
  node: EnrichedNode;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ReaderHeader({ node }: Props) {
  const asOf = formatDate(node.source?.retrievedAt);
  return (
    <header className="pt-8 pb-6 space-y-3">
      <p className="font-mono text-sm tabular-nums text-muted-foreground">{node.citation}</p>
      <h1 className="font-sans text-3xl font-semibold tracking-tight leading-tight">
        {node.heading}
      </h1>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <StatusBadge status={node.status} />
        {asOf && (
          <span className="font-mono text-muted-foreground">
            As of {asOf}
          </span>
        )}
      </div>
    </header>
  );
}
