import { useEffect, useState } from 'react';
import type { TocNode } from '@/lib/law-data';
import { law } from '@/lib/lawClient';

export function useToc(jurId: string | null) {
  const [data, setData] = useState<TocNode[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!jurId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    law
      .getToc(jurId)
      .then((toc) => {
        if (cancelled) return;
        setData(toc);
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

  return { data, loading, error };
}
