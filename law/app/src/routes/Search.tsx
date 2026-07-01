import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  MagnifyingGlass,
  Funnel,
  X as XIcon,
  CircleNotch,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MatchHighlight } from '@/components/common/MatchHighlight';
import { useJurisdictions } from '@/hooks/useJurisdictions';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { law } from '@/lib/lawClient';
import type { SearchDoc, SearchOptions } from '@/lib/law-data';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

type LawTypeFilter = '' | 'statute' | 'regulation';
type StatusFilter = '' | 'active' | 'repealed' | 'reserved';

interface Filters {
  jurId: string;
  lawType: LawTypeFilter;
  status: StatusFilter;
}

function readFilters(sp: URLSearchParams): Filters {
  return {
    jurId: sp.get('jurId') ?? '',
    lawType: (sp.get('lawType') as LawTypeFilter) || '',
    status: (sp.get('status') as StatusFilter) || '',
  };
}

function nodePath(nodeId: string): string {
  const [jurId, ...rest] = nodeId.split(':');
  return `/j/${jurId}/n/${rest.join(':')}`;
}

function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.jurId) n++;
  if (f.lawType) n++;
  if (f.status) n++;
  return n;
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const filters = readFilters(params);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [queryDraft, setQueryDraft] = useState(initialQ);
  const [results, setResults] = useState<SearchDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [indexLoading, setIndexLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Whenever query or filters change in the URL, reset and fetch the first page.
  const q = (params.get('q') ?? '').trim();
  const filtersKey = `${filters.jurId}|${filters.lawType}|${filters.status}`;

  useEffect(() => {
    setQueryDraft(initialQ);
  }, [initialQ]);

  useEffect(() => {
    if (!q) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      setIndexLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Heuristic: assume the index is uncached on the FIRST search this session
    // by checking results length. We can't introspect the data layer cleanly.
    setIndexLoading(results.length === 0);
    const opts: SearchOptions = { limit: PAGE_SIZE, offset: 0 };
    if (filters.jurId) opts.jurId = filters.jurId;
    if (filters.lawType) opts.lawType = filters.lawType;
    if (filters.status) opts.status = filters.status;
    law
      .search(q, opts)
      .then((res) => {
        if (cancelled) return;
        setResults(res.results);
        setTotal(res.total);
        setLoading(false);
        setIndexLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        setIndexLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filtersKey]);

  const loadMore = async () => {
    if (loadingMore || loading) return;
    if (results.length >= total) return;
    setLoadingMore(true);
    const opts: SearchOptions = { limit: PAGE_SIZE, offset: results.length };
    if (filters.jurId) opts.jurId = filters.jurId;
    if (filters.lawType) opts.lawType = filters.lawType;
    if (filters.status) opts.status = filters.status;
    try {
      const res = await law.search(q, opts);
      setResults((prev) => [...prev, ...res.results]);
    } catch {
      // ignore — user can scroll back and try again
    } finally {
      setLoadingMore(false);
    }
  };

  // IntersectionObserver for infinite scroll.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length, total, loading]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    next.set('q', queryDraft.trim());
    setParams(next, { replace: false });
  };

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v as string);
    else next.delete(k);
    setParams(next, { replace: false });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    next.delete('jurId');
    next.delete('lawType');
    next.delete('status');
    setParams(next, { replace: false });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <form onSubmit={onSubmit} className="space-y-2 mb-8">
        <label htmlFor="search-input" className="sr-only">
          Search statutes and regulations
        </label>
        <div className="relative">
          <MagnifyingGlass
            size={16}
            weight="regular"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            id="search-input"
            type="search"
            placeholder="Search statutes, regulations, sections…"
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            className="pl-9 h-11 text-base"
            autoFocus
          />
        </div>
      </form>

      <div className="flex items-start gap-6 lg:gap-10">
        {/* Filter rail — desktop */}
        {isDesktop && (
          <aside className="w-64 shrink-0 sticky top-20 self-start">
            <FilterRail filters={filters} setFilter={setFilter} clear={clearFilters} />
          </aside>
        )}

        <div className="flex-1 min-w-0 space-y-4">
          {/* Result meta + mobile filter trigger */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {q ? (
                loading ? (
                  'Searching…'
                ) : (
                  <>
                    <span className="font-mono tabular-nums text-foreground">
                      {total.toLocaleString('en-US')}
                    </span>{' '}
                    {total === 1 ? 'match' : 'matches'} for{' '}
                    <span className="font-mono text-foreground">"{q}"</span>
                  </>
                )
              ) : (
                'Type a query above to search.'
              )}
            </p>
            {!isDesktop && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Funnel size={14} weight="regular" />
                    Filters
                    {activeFilterCount(filters) > 0 && (
                      <span className="font-mono text-[0.65rem] tabular-nums">
                        ({activeFilterCount(filters)})
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pb-4">
                    <FilterRail filters={filters} setFilter={setFilter} clear={clearFilters} />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

          {/* Index-loading state */}
          {q && indexLoading && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-2 py-2">
              <CircleNotch size={12} weight="regular" className="animate-spin" />
              Loading search index (~48 MB, one-time)…
            </p>
          )}

          {/* Loading skeleton */}
          {loading && !indexLoading && (
            <ul className="divide-y divide-border border-t border-b border-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="py-4 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </li>
              ))}
            </ul>
          )}

          {/* Error */}
          {error && (
            <div className="py-8 text-sm">
              <p className="text-danger">Couldn't search. {error.message}</p>
            </div>
          )}

          {/* No-results */}
          {!loading && !error && q && total === 0 && (
            <NoResults q={q} hasFilters={activeFilterCount(filters) > 0} onClear={clearFilters} />
          )}

          {/* Empty (no query) */}
          {!loading && !error && !q && (
            <EmptyState />
          )}

          {/* Results list */}
          {!loading && !error && results.length > 0 && (
            <ul className="divide-y divide-border border-t border-b border-border">
              {results.map((doc) => (
                <ResultRow key={doc.id} doc={doc} q={q} />
              ))}
            </ul>
          )}

          {/* Sentinel for infinite scroll + loading-more indicator */}
          {results.length > 0 && results.length < total && (
            <div ref={sentinelRef} className="py-6 text-center text-xs text-muted-foreground">
              {loadingMore ? (
                <span className="inline-flex items-center gap-2">
                  <CircleNotch size={12} weight="regular" className="animate-spin" />
                  Loading more…
                </span>
              ) : (
                `Scroll for more (${results.length}/${total.toLocaleString('en-US')})`
              )}
            </div>
          )}

          {results.length > 0 && results.length >= total && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              All {total.toLocaleString('en-US')} results shown.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter rail ─────────────────────────────────────────────────────────────

function FilterRail({
  filters,
  setFilter,
  clear,
}: {
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  clear: () => void;
}) {
  const { data: jurData } = useJurisdictions();
  const jurOptions = jurData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Filters</h2>
        {activeFilterCount(filters) > 0 && (
          <button
            onClick={clear}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <XIcon size={12} weight="regular" /> Clear
          </button>
        )}
      </div>

      <FilterGroup label="Jurisdiction">
        <select
          value={filters.jurId}
          onChange={(e) => setFilter('jurId', e.target.value)}
          className={cn(
            'w-full h-9 px-2 rounded-md border border-input bg-background text-sm',
            'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30'
          )}
        >
          <option value="">All jurisdictions</option>
          {jurOptions.map((j) => (
            <option key={j.jurisdictionId} value={j.jurisdictionId}>
              {j.name}
            </option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Law type">
        <RadioRow
          options={[
            { value: '', label: 'Any' },
            { value: 'statute', label: 'Statute' },
            { value: 'regulation', label: 'Regulation' },
          ]}
          value={filters.lawType}
          onChange={(v) => setFilter('lawType', v as LawTypeFilter)}
        />
      </FilterGroup>

      <FilterGroup label="Status">
        <RadioRow
          options={[
            { value: '', label: 'Any' },
            { value: 'active', label: 'Active' },
            { value: 'repealed', label: 'Repealed' },
            { value: 'reserved', label: 'Reserved' },
          ]}
          value={filters.status}
          onChange={(v) => setFilter('status', v as StatusFilter)}
        />
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{label}</p>
      {children}
    </div>
  );
}

function RadioRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value || 'any'}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 px-2.5 rounded-md text-xs transition-colors duration-(--dur-1) border',
              on
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'bg-background text-foreground border-border hover:bg-muted'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Result row ──────────────────────────────────────────────────────────────

function ResultRow({ doc, q }: { doc: SearchDoc; q: string }) {
  return (
    <li>
      <Link
        to={nodePath(doc.id)}
        className="block group py-4 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors duration-(--dur-1)"
      >
        <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
          <MatchHighlight text={doc.citation || ''} query={q} />
        </p>
        <p className="font-sans text-sm pt-1 leading-snug">
          <MatchHighlight text={doc.heading || doc.id} query={q} />
        </p>
        {doc.excerpt && (
          <p className="font-serif text-sm text-muted-foreground pt-1.5 line-clamp-2 leading-snug">
            <MatchHighlight text={doc.excerpt} query={q} />
          </p>
        )}
      </Link>
    </li>
  );
}

function NoResults({ q, hasFilters, onClear }: { q: string; hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-12 text-center space-y-3">
      <p className="text-sm">
        No matches for <span className="font-mono">"{q}"</span>
        {hasFilters && ' with those filters'}.
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center text-muted-foreground space-y-2">
      <MagnifyingGlass size={28} weight="regular" className="mx-auto" />
      <p className="text-sm">Type above to search 100,000+ federal sections.</p>
      <p className="font-mono text-[0.7rem]">
        Tip: press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">/</kbd> anywhere
        for the ⌘K palette.
      </p>
    </div>
  );
}
