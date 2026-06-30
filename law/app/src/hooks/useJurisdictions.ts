import { useEffect, useState } from 'react';
import type { CorpusMeta } from '@/lib/law-data';
import { law } from '@/lib/lawClient';

export function useJurisdictions() {
  const [data, setData] = useState<{ count: number; items: CorpusMeta[] } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    law
      .listJurisdictions()
      .then((res) => {
        if (cancelled) return;
        setData(res);
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
  }, []);

  return { data, loading, error };
}
