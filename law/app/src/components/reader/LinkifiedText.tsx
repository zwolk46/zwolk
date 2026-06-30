import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useJurisdictions } from '@/hooks/useJurisdictions';
import { getLoadedCorpusSync, loadCorpus, type CorpusLike } from '@/lib/lawClient';
import { linkifyCitations } from '@/lib/linkify';
import { cn } from '@/lib/utils';

interface Props {
  text: string;
  currentJurId: string;
}

export function LinkifiedText({ text, currentJurId }: Props) {
  const { data } = useJurisdictions();
  const availableJurIds = useMemo(
    () => new Set((data?.items ?? []).map((m) => m.jurisdictionId)),
    [data]
  );

  // Eagerly load the current corpus from our parallel cache so same-corpus
  // citation resolution finds nodesById. This costs one extra fetch per
  // corpus the user reads; cached after first hit.
  const [, force] = useState(0);
  useEffect(() => {
    if (!currentJurId) return;
    let cancelled = false;
    loadCorpus(currentJurId).then(() => {
      if (!cancelled) force((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [currentJurId]);

  const parts = useMemo(() => {
    return linkifyCitations(text, availableJurIds, (jurId: string): CorpusLike | null =>
      getLoadedCorpusSync(jurId)
    );
  }, [text, availableJurIds]);

  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>;
        if (p.resolved && p.href) {
          return (
            <Link
              key={i}
              to={p.href}
              className={cn(
                'font-mono underline underline-offset-4 decoration-foreground/30',
                'hover:decoration-foreground transition-colors duration-(--dur-1)'
              )}
            >
              {p.label}
            </Link>
          );
        }
        // Unresolved — still visually distinct (mono + muted) so the cite stands out.
        return (
          <span key={i} className="font-mono text-muted-foreground" title="Citation outside our corpus">
            {p.label}
          </span>
        );
      })}
    </>
  );
}
