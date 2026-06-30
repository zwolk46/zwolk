import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  MagnifyingGlass,
  BookmarkSimple,
  Clock,
  MapTrifold,
  Bell,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useJurisdictions } from '@/hooks/useJurisdictions';
import { useSaved } from '@/hooks/useSaved';
import { useRecent } from '@/hooks/useRecent';

function nodePath(nodeId: string): string {
  const [jurId, ...rest] = nodeId.split(':');
  return `/j/${jurId}/n/${rest.join(':')}`;
}

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data: jurData } = useJurisdictions();
  const { items: saved } = useSaved();
  const recent = useRecent();

  const total = jurData?.items.length ?? 0;
  const sections = jurData?.items.reduce((sum, j) => sum + j.sectionCount, 0) ?? 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 space-y-16">
      {/* Hero */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h1 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight">
            Read the law.
          </h1>
          <p className="font-serif text-lg lg:text-xl text-muted-foreground max-w-2xl leading-snug">
            {sections > 0 ? (
              <>
                Search{' '}
                <span className="font-mono tabular-nums text-foreground">
                  {sections.toLocaleString()}
                </span>{' '}
                sections of federal statutes and regulations — and growing.
              </>
            ) : (
              'Federal statutes and regulations, with state and municipal coming.'
            )}
          </p>
        </div>
        <form onSubmit={onSubmit} className="max-w-2xl">
          <label htmlFor="home-search" className="sr-only">
            Search statutes and regulations
          </label>
          <div className="relative">
            <MagnifyingGlass
              size={18}
              weight="regular"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="home-search"
              type="search"
              placeholder="Search citations, headings, body text…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-11 h-12 text-base"
              autoFocus
            />
          </div>
          <p className="font-mono text-[0.7rem] text-muted-foreground pt-2">
            Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Enter</kbd> for full results, or{' '}
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">/</kbd> anywhere for the ⌘K palette.
          </p>
        </form>
      </section>

      {/* Map placeholder (Phase 7 fills this) */}
      <section aria-labelledby="map-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="map-heading" className="text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
            <MapTrifold size={12} weight="regular" />
            Browse by jurisdiction
          </h2>
          <Link
            to="/coverage"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            See coverage →
          </Link>
        </div>
        <div className="relative h-72 lg:h-96 rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center">
          <div className="text-center space-y-2 text-muted-foreground">
            <MapTrifold size={32} weight="regular" className="mx-auto" />
            <p className="text-sm">US map coming next</p>
            <p className="text-xs">
              {total > 0 ? `${total} federal corpora live; ` : ''}state & municipal codes coming
              in.
            </p>
          </div>
        </div>
      </section>

      {/* Shelf */}
      <section aria-labelledby="shelf-heading" className="space-y-4">
        <h2 id="shelf-heading" className="text-xs uppercase tracking-widest text-muted-foreground">
          Your shelf
        </h2>
        <div className="grid gap-10 lg:grid-cols-2">
          <ShelfColumn
            title="Recently viewed"
            icon={<Clock size={14} weight="regular" />}
            empty="Sections you read will show up here."
            link={recent.length > 0 ? { to: '/library', label: 'See all' } : undefined}
          >
            {recent.slice(0, 8).map((r) => (
              <ShelfRow
                key={r.nodeId}
                to={nodePath(r.nodeId)}
                citation={r.citation}
                heading={r.heading || r.nodeId}
              />
            ))}
          </ShelfColumn>

          <ShelfColumn
            title="Saved"
            icon={<BookmarkSimple size={14} weight="regular" />}
            empty="Bookmarks you save will show up here."
            link={saved.length > 0 ? { to: '/library', label: 'See all' } : undefined}
          >
            {saved.slice(0, 8).map((s) => (
              <ShelfRow
                key={s.nodeId}
                to={nodePath(s.nodeId)}
                citation={s.citation}
                heading={s.heading || s.nodeId}
              />
            ))}
          </ShelfColumn>
        </div>
      </section>

      {/* Jurisdictions overview (loading-aware) */}
      <section aria-labelledby="jurs-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="jurs-heading" className="text-xs uppercase tracking-widest text-muted-foreground">
            Federal corpora
          </h2>
          {jurData && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {total} total
            </span>
          )}
        </div>
        {!jurData ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {(['us-usc', 'us-cfr'] as const).map((corpus) => {
              const items = jurData.items.filter((j) => j.corpus === corpus);
              if (items.length === 0) return null;
              const label = corpus === 'us-usc' ? 'U.S. Code' : 'CFR';
              return (
                <Link
                  key={corpus}
                  to={`/j/${items[0].jurisdictionId}`}
                  className="border border-border rounded-md p-4 hover:bg-muted/40 transition-colors duration-(--dur-1) flex flex-col gap-2"
                >
                  <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                    Federal · {corpus === 'us-usc' ? 'Statutes' : 'Regulations'}
                  </p>
                  <p className="font-sans text-base font-semibold">{label}</p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {items.length} titles ·{' '}
                    {items.reduce((s, j) => s + j.sectionCount, 0).toLocaleString()} sections
                  </p>
                </Link>
              );
            })}
            <div className="border border-dashed border-border rounded-md p-4 flex flex-col gap-2 text-muted-foreground">
              <p className="font-mono text-[0.7rem] uppercase tracking-widest">
                State &amp; municipal
              </p>
              <p className="font-sans text-base">Coming</p>
              <p className="font-mono text-xs">
                Ingestion pipeline lives in <span className="font-mono">law/scripts/</span>.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Changes feed (placeholder) */}
      <section aria-labelledby="changes-heading" className="space-y-3">
        <h2 id="changes-heading" className="text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
          <Bell size={12} weight="regular" />
          What's changed
        </h2>
        <div className="border border-border rounded-md p-6 text-center text-sm text-muted-foreground space-y-2">
          <p>Amendments and new bills will surface here.</p>
          <p className="text-xs">
            Backend pipeline (Federal Register · Congress.gov · state bills) lands in a future
            plan.
          </p>
        </div>
      </section>
    </div>
  );
}

function ShelfColumn({
  title,
  icon,
  empty,
  link,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  link?: { to: string; label: string };
  children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children : [children];
  const filled = rows.filter(Boolean).length > 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {link && filled && (
          <Button asChild variant="link" size="xs" className="h-auto p-0">
            <Link to={link.to}>{link.label}</Link>
          </Button>
        )}
      </div>
      {filled ? (
        <ul className="divide-y divide-border border-t border-b border-border">{children}</ul>
      ) : (
        <p className="text-xs text-muted-foreground italic py-4">{empty}</p>
      )}
    </div>
  );
}

function ShelfRow({
  to,
  citation,
  heading,
}: {
  to: string;
  citation: string | null;
  heading: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="block py-2.5 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors duration-(--dur-1)"
      >
        {citation && (
          <p className="font-mono tabular-nums text-[0.7rem] text-muted-foreground">{citation}</p>
        )}
        <p className="font-sans text-sm leading-snug truncate">{heading}</p>
      </Link>
    </li>
  );
}
