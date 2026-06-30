import { useCallback, useEffect, useState } from 'react';
import type { EnrichedNode, LiteNode } from '@/lib/law-data';
import { law } from '@/lib/lawClient';
import { recordRecent } from '@/hooks/useRecent';

// The data layer (lib/data.js:89) returns `breadcrumb: node.ancestors || []`
// verbatim, but the on-disk ancestor shape is {id, num, level, heading} — not
// the LiteNode shape declared by the .d.ts. Normalize here so consumers see
// the same LiteNode contract as parent/prevSibling/nextSibling.
type OnDiskAncestor = { id: string; num: string; level: string; heading: string };

function normalizeBreadcrumb(crumbs: unknown): LiteNode[] {
  if (!Array.isArray(crumbs)) return [];
  return crumbs.map((c): LiteNode => {
    const a = c as Partial<OnDiskAncestor> & Partial<LiteNode>;
    return {
      id: String(a.id ?? ''),
      designation: a.designation ?? a.num ?? null,
      structureType: a.structureType ?? a.level ?? null,
      heading: a.heading ?? null,
      citation: a.citation ?? null,
    };
  });
}

export function useNode(nodeId: string | null) {
  const [node, setNode] = useState<EnrichedNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState<number>(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!nodeId) {
      setNode(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    law
      .getNode(nodeId)
      .then((n) => {
        if (cancelled) return;
        if (!n) {
          setNode(null);
        } else {
          setNode({ ...n, breadcrumb: normalizeBreadcrumb(n.breadcrumb) });
          // Only track sections in the recents shelf — containers are
          // navigational waypoints, not destinations users return to.
          if (n.kind === 'section') {
            recordRecent(n.id, n.citation ?? null, n.heading ?? null);
          }
        }
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
  }, [nodeId, nonce]);

  return { node, loading, error, refetch };
}
