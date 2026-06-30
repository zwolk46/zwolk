import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CaretRight } from '@phosphor-icons/react';
import type { EnrichedNode, LawNode } from '@/lib/law-data';
import { law } from '@/lib/lawClient';
import { StatusBadge } from '@/components/reader/StatusBadge';

interface Props {
  node: EnrichedNode;
}

export function ContainerView({ node }: Props) {
  const jurId = node.id.includes(':') ? node.id.split(':')[0] : '';
  const [children, setChildren] = useState<LawNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    law
      .getChildren(node.id)
      .then((c) => {
        if (cancelled) return;
        setChildren(c);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node.id]);

  return (
    <div className="space-y-6 pb-24">
      <header className="space-y-3">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          {node.structureType}
        </p>
        <p className="font-mono text-sm tabular-nums text-muted-foreground">{node.citation}</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight leading-tight">
          {node.heading}
        </h1>
      </header>

      <section aria-labelledby="children-heading" className="space-y-3">
        <h2 id="children-heading" className="text-xs uppercase tracking-widest text-muted-foreground">
          Contents
        </h2>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-danger">Couldn't load children.</p>}
        {!loading && !error && children && (
          children.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No child sections.</p>
          ) : (
            <ul className="border-t border-border">
              {children.map((child) => {
                const splat = child.id.includes(':') ? child.id.split(':')[1] : child.id;
                return (
                  <li key={child.id}>
                    <Link
                      to={`/j/${jurId}/n/${splat}`}
                      className="flex items-baseline gap-3 py-3 border-b border-border hover:bg-muted/40 transition-colors duration-(--dur-1) px-1"
                    >
                      {child.designation && (
                        <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0 w-12">
                          {child.kind === 'section' ? '§ ' : ''}
                          {child.designation}
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block font-sans text-sm">
                          {child.heading || child.id}
                        </span>
                      </span>
                      <StatusBadge status={child.status} />
                      <CaretRight
                        size={14}
                        weight="regular"
                        className="text-muted-foreground shrink-0"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </section>
    </div>
  );
}
