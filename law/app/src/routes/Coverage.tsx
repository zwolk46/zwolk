import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CaretRight, ArrowSquareOut, Warning } from '@phosphor-icons/react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCoverageSummary, useStateCoverage } from '@/hooks/useCoverage';
import { STATES } from '../../../lib/geo.js';
import type { StateRec } from '@/lib/law-data';
import { cn } from '@/lib/utils';

function statePct(usps: string, summary: ReturnType<typeof useCoverageSummary>['data']): {
  ingested: number;
  available: number;
  gap: number;
  total: number;
} {
  const s = summary?.states?.[usps] as
    | { ingested?: number; available?: number; gap?: number }
    | undefined;
  const ingested = (s as { ingested?: number })?.ingested ?? 0;
  const available = s?.available ?? 0;
  const gap = (s as { gap?: number })?.gap ?? 0;
  return { ingested, available, gap, total: ingested + available + gap };
}

export default function Coverage() {
  const { data: summary, loading, error } = useCoverageSummary();
  const [openState, setOpenState] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'ingested' | 'available'>('available');

  const rows = useMemo(() => {
    const list = STATES.filter((s) => s.fips.length === 2 && Number(s.fips) <= 56).map(
      (s) => ({
        ...s,
        ...statePct(s.usps, summary),
      })
    );
    if (sortBy === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'ingested') return list.sort((a, b) => b.ingested - a.ingested);
    return list.sort((a, b) => b.available + b.ingested - (a.available + a.ingested));
  }, [summary, sortBy]);

  const national = summary?.national as
    | { ingested?: number; available?: number; gap?: number; states?: number }
    | null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-10">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Coverage
        </p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">
          What's covered, and what's still missing
        </h1>
        <p className="text-sm text-muted-foreground max-w-prose">
          Federal law (U.S. Code + CFR) is ingested in full. State and municipal codes are being
          added incrementally; this dashboard shows what's available, what's already ingested
          into Law Hub's normalized store, and where the gaps are. Updated whenever the coverage
          scan re-runs.
        </p>
      </header>

      {/* National card */}
      <section
        aria-labelledby="national-heading"
        className="border border-border rounded-md p-6 space-y-3 bg-card"
      >
        <h2 id="national-heading" className="text-xs uppercase tracking-widest text-muted-foreground">
          National
        </h2>
        {loading && (
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
        {error && <p className="text-sm text-danger">Couldn't load coverage summary.</p>}
        {!loading && !error && national && (
          <div className="grid grid-cols-3 gap-6">
            <Stat label="Ingested" value={national.ingested ?? 0} accent="success" />
            <Stat label="Available" value={national.available ?? 0} accent="warning" />
            <Stat label="Gaps" value={national.gap ?? 0} accent="danger" />
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-2">
          <span className="font-mono">Ingested</span> = stored in Law Hub's read tree;{' '}
          <span className="font-mono">available</span> = a digital source exists (e.g., municode,
          amlegal) but hasn't been ingested yet; <span className="font-mono">gap</span> = no
          known digital source.
        </p>
      </section>

      {/* States table */}
      <section className="space-y-4" aria-labelledby="states-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="states-heading" className="text-xs uppercase tracking-widest text-muted-foreground">
            By state
          </h2>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground mr-1">Sort:</span>
            {(
              [
                { v: 'name', l: 'Name' },
                { v: 'ingested', l: 'Ingested' },
                { v: 'available', l: 'Coverage' },
              ] as const
            ).map((s) => (
              <button
                key={s.v}
                onClick={() => setSortBy(s.v)}
                className={cn(
                  'h-7 px-2 rounded-md',
                  sortBy === s.v
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {s.l}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {!loading && (
          <ul className="divide-y divide-border border-t border-b border-border">
            {rows.map((s) => (
              <StateRow
                key={s.usps}
                state={s}
                open={openState === s.usps}
                onToggle={() => setOpenState(openState === s.usps ? null : s.usps)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Footer / honest "more coming" note */}
      <section className="text-xs text-muted-foreground space-y-1 border-t border-border pt-6">
        <p>
          Coverage data is generated by{' '}
          <span className="font-mono">scripts/scan-coverage.mjs</span> against the Open Legal Codes
          catalog. Gaps are real (some places have no digital code; some have only paper).
        </p>
        <p>
          Federal jurisdictions are 100% ingested ({national?.states ?? 1} entries in the summary
          reflect state-level scans only; federal corpora are tracked separately and visible in
          the sidebar).
        </p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'success' | 'warning' | 'danger';
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-display text-3xl tabular-nums',
          accent === 'success' && 'text-success',
          accent === 'warning' && 'text-warning',
          accent === 'danger' && 'text-danger'
        )}
      >
        {value.toLocaleString('en-US')}
      </p>
    </div>
  );
}

function StateRow({
  state,
  open,
  onToggle,
}: {
  state: StateRec & ReturnType<typeof statePct>;
  open: boolean;
  onToggle: () => void;
}) {
  const { ingested, available, gap, total } = state;
  const hasAny = total > 0;
  return (
    <li>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors duration-(--dur-1) text-left"
        aria-expanded={open}
      >
        <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0 w-10">
          {state.usps}
        </span>
        <span className="flex-1 font-sans text-sm">{state.name}</span>
        {hasAny ? (
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-muted-foreground">
            {ingested > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success" />
                {ingested}
              </span>
            )}
            {available > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning" />
                {available}
              </span>
            )}
            {gap > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-danger" />
                {gap}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Not yet scanned</span>
        )}
        <CaretRight
          size={14}
          weight="regular"
          className={cn(
            'text-muted-foreground transition-transform duration-(--dur-1)',
            open && 'rotate-90'
          )}
        />
      </button>
      {open && hasAny && <StateExpand usps={state.usps} />}
    </li>
  );
}

function StateExpand({ usps }: { usps: string }) {
  const { data, loading, error } = useStateCoverage(usps);

  useEffect(() => {
    // no-op — the hook handles loading
  }, [usps]);

  if (loading) {
    return (
      <div className="space-y-2 pl-12 py-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="pl-12 py-2 text-xs text-danger">Couldn't load {usps} coverage detail.</p>
    );
  }
  if (!data || data.places.length === 0) {
    return (
      <p className="pl-12 py-2 text-xs text-muted-foreground italic">
        No places enumerated yet.
      </p>
    );
  }

  const byStatus: Record<string, typeof data.places> = { ingested: [], available: [], gap: [] };
  for (const p of data.places) {
    const key =
      p.status === 'ingested' ? 'ingested' : p.status === 'available' ? 'available' : 'gap';
    byStatus[key].push(p);
  }

  return (
    <div className="pl-12 pr-2 py-3 space-y-4 bg-muted/20">
      {(['ingested', 'available', 'gap'] as const).map((status) =>
        byStatus[status].length > 0 ? (
          <div key={status}>
            <p className="text-[0.7rem] uppercase tracking-widest text-muted-foreground font-mono mb-2">
              {status} · {byStatus[status].length}
            </p>
            <ul className="space-y-1">
              {byStatus[status].slice(0, 12).map((p) => (
                <li key={p.fips} className="flex items-baseline gap-2 text-xs">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                      status === 'ingested' && 'bg-success',
                      status === 'available' && 'bg-warning',
                      status === 'gap' && 'bg-danger'
                    )}
                  />
                  <span className="flex-1 truncate">
                    {p.name}
                    {p.jurisdictionId && status === 'ingested' && (
                      <Button asChild variant="link" size="xs" className="ml-2 h-auto p-0">
                        <Link to={`/j/${p.jurisdictionId}`}>open →</Link>
                      </Button>
                    )}
                  </span>
                  {p.sourceUrl && (
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <ArrowSquareOut size={10} weight="regular" />
                    </a>
                  )}
                </li>
              ))}
              {byStatus[status].length > 12 && (
                <li className="text-[0.7rem] text-muted-foreground italic pl-3 pt-1">
                  + {byStatus[status].length - 12} more
                </li>
              )}
            </ul>
          </div>
        ) : null
      )}
      {(byStatus.gap.length > 0 || byStatus.available.length > 0) && (
        <p className="text-[0.7rem] text-muted-foreground pt-2 inline-flex items-start gap-1.5">
          <Warning size={11} weight="regular" className="mt-0.5 shrink-0" />
          <span>
            Gaps mean no known digital source. Available means a source exists but hasn't been
            ingested into Law Hub yet.
          </span>
        </p>
      )}
    </div>
  );
}
