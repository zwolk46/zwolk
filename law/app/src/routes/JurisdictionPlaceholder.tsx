import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import type { CorpusMeta } from '@/lib/law-data';
import { law } from '@/lib/lawClient';

export default function JurisdictionPlaceholder() {
  const { jurId } = useParams<{ jurId: string }>();
  const [meta, setMeta] = useState<CorpusMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!jurId) return;
    let cancelled = false;
    setLoading(true);
    law
      .getJurisdiction(jurId)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
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
  }, [jurId]);

  if (loading) {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-sm text-muted-foreground">Loading…</div>;
  }

  if (error || !meta) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 space-y-3">
        <p className="font-sans text-sm">Jurisdiction not found.</p>
        <Link to="/" className="text-sm text-foreground underline underline-offset-4">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{meta.corpus}</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">{meta.name}</h1>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Law type</dt>
        <dd>{meta.lawType}</dd>
        <dt className="text-muted-foreground">Sections</dt>
        <dd className="font-mono tabular-nums">{meta.sectionCount.toLocaleString()}</dd>
        <dt className="text-muted-foreground">Nodes</dt>
        <dd className="font-mono tabular-nums">{meta.nodeCount.toLocaleString()}</dd>
        {meta.sourceUrl && (
          <>
            <dt className="text-muted-foreground">Source</dt>
            <dd>
              <a
                href={meta.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                {new URL(meta.sourceUrl).hostname}
              </a>
            </dd>
          </>
        )}
      </dl>
      <p className="font-mono text-xs text-muted-foreground">
        The full jurisdiction landing (overview, search-within, entry into the tree) ships in a
        future plan. Browse the corpus from the sidebar tree, or open any section directly.
      </p>
    </div>
  );
}
