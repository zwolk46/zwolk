import { useEffect, useState } from 'react';
import type { CoverageSummary, StateCoverage } from '@/lib/law-data';
import { geo } from '@/lib/geoClient';

// Note: types pulled via the law-data re-export are actually defined in the
// geo .d.ts; we re-use them here without an extra import surface.

export function useCoverageSummary() {
  const [data, setData] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    geo
      .coverageSummary()
      .then((s) => {
        if (cancelled) return;
        setData(s);
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

export function useStateCoverage(usps: string | null) {
  const [data, setData] = useState<StateCoverage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!usps) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    geo
      .coverageForState(usps)
      .then((s) => {
        if (cancelled) return;
        setData(s);
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
  }, [usps]);

  return { data, loading, error };
}
