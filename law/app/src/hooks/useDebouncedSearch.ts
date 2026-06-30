import { useEffect, useRef, useState } from 'react';
import type { SearchDoc, SearchOptions } from '@/lib/law-data';
import { law } from '@/lib/lawClient';

// Tracks whether the (very large) search-docs.json has been fetched at least
// once in this session. Lives at module scope so it persists across mounts.
let indexEverLoaded = false;

export function useDebouncedSearch(query: string, opts?: SearchOptions) {
  const [results, setResults] = useState<SearchDoc[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [indexLoading, setIndexLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      setIndexLoading(false);
      setError(null);
      return;
    }

    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    if (!indexEverLoaded) setIndexLoading(true);

    const t = setTimeout(async () => {
      try {
        const res = await law.search(trimmed, opts ?? {});
        if (mine !== seq.current) return; // newer query in flight
        setResults(res.results);
        setTotal(res.total);
        indexEverLoaded = true;
        setIndexLoading(false);
        setLoading(false);
      } catch (err) {
        if (mine !== seq.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIndexLoading(false);
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [query, opts]);

  return { results, total, loading, indexLoading, error };
}
