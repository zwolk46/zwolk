import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowSquareOut,
  BookOpen,
  CaretRight,
  Clock,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToc } from '@/hooks/useToc';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useRecent } from '@/hooks/useRecent';
import type { CorpusMeta } from '@/lib/law-data';
import { law } from '@/lib/lawClient';

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

function corpusLabel(corpus: string, lawType?: string): string {
  if (corpus === 'us-usc') return 'Federal · Statutes';
  if (corpus === 'us-cfr') return 'Federal · Regulations';
  return `${corpus} · ${lawType ?? ''}`.trim().replace(/·\s*$/, '');
}

function tocPath(jurId: string, id: string): string {
  const splat = id.includes(':') ? id.split(':')[1] : id;
  return `/j/${jurId}/n/${splat}`;
}

export default function JurisdictionLanding() {
  const { jurId } = useParams<{ jurId: string }>();
  const [meta, setMeta] = useState<CorpusMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<Error | null>(null);

  useEffect(() => {
    if (!jurId) return;
    let cancelled = false;
    setMetaLoading(true);
    setMetaError(null);
    law
      .getJurisdiction(jurId)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setMetaLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setMetaError(err instanceof Error ? err : new Error(String(err)));
        setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jurId]);

  const { data: tocData, loading: tocLoading } = useToc(jurId ?? null);
  const recent = useRecent({ jurId: jurId ?? undefined }).slice(0, 5);
  const [query, setQuery] = useState('');
  const search = useDebouncedSearch(query, jurId ? { jurId } : undefined);
  const showSearch = query.trim().length >= 2;

  const topLevel = useMemo(() => tocData ?? [], [tocData]);

  if (!jurId) return null;

  if (metaLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 space-y-3">
        <p className="font-sans text-sm">
          Jurisdiction <span className="font-mono text-xs">{jurId}</span> isn't ingested into Law
          Hub yet.
        </p>
        <p className="text-xs text-muted-foreground">
          This typically means the place has a digital source (e.g., municode, amlegal,
          ecode360) but the ingestion pipeline hasn't pulled it in yet. Federal corpora (USC,
          CFR) are fully ingested; state and municipal are rolling in.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link to="/" className="text-sm text-foreground underline underline-offset-4">
            Home
          </Link>
          <Link
            to="/coverage"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Coverage
          </Link>
          <Link
            to="/map"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Map
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-12">
      {/* Header */}
      <header className="space-y-3">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          {corpusLabel(meta.corpus, meta.lawType)}
        </p>
        <h1 className="font-display text-5xl leading-tight tracking-tight">{meta.name}</h1>
        <p className="text-sm text-muted-foreground">
          {meta.sectionCount.toLocaleString()} sections · {meta.nodeCount.toLocaleString()} total
          nodes (titles, chapters, parts, sections).
        </p>
      </header>

      {/* Search within */}
      <section className="space-y-3" aria-label="Search within jurisdiction">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            weight="regular"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="text"
            placeholder={`Search ${meta.name}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10"
            aria-label="Search within this jurisdiction"
          />
        </div>
        {showSearch && (
          <div className="space-y-1">
            {search.indexLoading && (
              <p className="text-xs text-muted-foreground py-2">
                Loading search index (~48 MB, one-time)…
              </p>
            )}
            {!search.indexLoading && search.loading && (
              <p className="text-xs text-muted-foreground py-2">Searching…</p>
            )}
            {!search.loading && !search.indexLoading && (
              <>
                <p className="text-xs text-muted-foreground">
                  {search.total.toLocaleString()} match{search.total === 1 ? '' : 'es'} in {meta.name}
                </p>
                <ul className="divide-y divide-border border-t border-b border-border">
                  {search.results.slice(0, 10).map((doc) => {
                    const splat = doc.id.includes(':') ? doc.id.split(':')[1] : doc.id;
                    return (
                      <li key={doc.id}>
                        <Link
                          to={`/j/${jurId}/n/${splat}`}
                          className="flex items-baseline gap-3 py-3 hover:bg-muted/40 transition-colors duration-(--dur-1) px-2 -mx-2 rounded-md"
                        >
                          <span className="font-mono tabular-nums text-[0.7rem] text-muted-foreground shrink-0">
                            {doc.citation}
                          </span>
                          <span className="font-sans text-sm truncate">{doc.heading}</span>
                        </Link>
                      </li>
                    );
                  })}
                  {search.total > 10 && (
                    <li className="py-3 text-xs">
                      <Link
                        to={`/search?q=${encodeURIComponent(query.trim())}&jurId=${jurId}`}
                        className="text-foreground underline underline-offset-4"
                      >
                        Show all {search.total.toLocaleString()} results →
                      </Link>
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {/* Table of contents — top level */}
      <section className="space-y-3" aria-labelledby="toc-heading">
        <h2 id="toc-heading" className="text-xs uppercase tracking-widest text-muted-foreground">
          Contents
        </h2>
        {tocLoading && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        )}
        {!tocLoading && topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No table of contents available.</p>
        )}
        {!tocLoading && topLevel.length > 0 && (
          <ul className="divide-y divide-border border-t border-b border-border">
            {topLevel.map((n) => (
              <li key={n.id}>
                <Link
                  to={tocPath(jurId, n.id)}
                  className="flex items-baseline gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors duration-(--dur-1)"
                >
                  <BookOpen
                    size={14}
                    weight="regular"
                    className="text-muted-foreground shrink-0 self-center"
                  />
                  {n.designation && (
                    <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0 w-14">
                      {n.structureType === 'title' ? 'Title' : ''} {n.designation}
                    </span>
                  )}
                  <span className="flex-1 font-sans text-sm truncate">
                    {n.heading || n.designation}
                  </span>
                  <CaretRight size={14} weight="regular" className="text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recently viewed in this corpus */}
      {recent.length > 0 && (
        <section className="space-y-3" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
            <Clock size={12} weight="regular" />
            Recently viewed in {meta.name}
          </h2>
          <ul className="divide-y divide-border border-t border-b border-border">
            {recent.map((r) => {
              const splat = r.nodeId.includes(':') ? r.nodeId.split(':')[1] : r.nodeId;
              return (
                <li key={r.nodeId}>
                  <Link
                    to={`/j/${jurId}/n/${splat}`}
                    className="flex items-baseline gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors duration-(--dur-1)"
                  >
                    <span className="font-mono tabular-nums text-[0.7rem] text-muted-foreground shrink-0">
                      {r.citation}
                    </span>
                    <span className="flex-1 font-sans text-sm truncate">{r.heading}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Metadata footer */}
      <section className="space-y-3" aria-labelledby="meta-heading">
        <h2 id="meta-heading" className="text-xs uppercase tracking-widest text-muted-foreground">
          Source &amp; metadata
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Corpus key</dt>
          <dd className="font-mono">{meta.corpus}</dd>
          <dt className="text-muted-foreground">Law type</dt>
          <dd className="capitalize">{meta.lawType}</dd>
          <dt className="text-muted-foreground">Sections</dt>
          <dd className="font-mono tabular-nums">{meta.sectionCount.toLocaleString()}</dd>
          <dt className="text-muted-foreground">Nodes (total)</dt>
          <dd className="font-mono tabular-nums">{meta.nodeCount.toLocaleString()}</dd>
          <dt className="text-muted-foreground">Ingested via</dt>
          <dd className="font-mono">
            {(meta as { via?: string }).via ?? 'open-legal-codes'}
          </dd>
          {meta.sourceUrl && (
            <>
              <dt className="text-muted-foreground">Official source</dt>
              <dd>
                <a
                  href={meta.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4 inline-flex items-center gap-1"
                >
                  {new URL(meta.sourceUrl).hostname}
                  <ArrowSquareOut size={12} weight="regular" />
                </a>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">As of</dt>
          <dd className="font-mono text-xs">
            {formatDate((meta as { generatedAt?: string }).generatedAt) || '—'}
          </dd>
        </dl>
      </section>
    </div>
  );
}
