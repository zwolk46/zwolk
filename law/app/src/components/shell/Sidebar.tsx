import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarFilter } from '@/components/shell/SidebarFilter';
import { SidebarGroup } from '@/components/shell/SidebarGroup';
import { useJurisdictions } from '@/hooks/useJurisdictions';
import { useSidebarState } from '@/hooks/useSidebarState';
import type { CorpusMeta } from '@/lib/law-data';

// Map corpus key → human group label. New corpora (state, municipal) are added
// here as they're ingested.
const GROUP_LABELS: Record<string, string> = {
  'us-usc': 'Federal · U.S. Code',
  'us-cfr': 'Federal · CFR',
};

function corpusLabel(corpus: string): string {
  return GROUP_LABELS[corpus] ?? corpus.toUpperCase();
}

// Order: USC then CFR; anything else alphabetical after.
const GROUP_ORDER = ['us-usc', 'us-cfr'];
function corpusOrder(corpus: string): number {
  const i = GROUP_ORDER.indexOf(corpus);
  return i === -1 ? GROUP_ORDER.length + corpus.charCodeAt(0) : i;
}

interface SidebarProps {
  /** Set in mobile drawer mode so internal click handlers can close it. */
  onNavigate?: () => void;
}

export function Sidebar(_props: SidebarProps = {}) {
  const { expandedGroups, toggleGroup } = useSidebarState();
  const { data, loading, error } = useJurisdictions();
  const [filter, setFilter] = useState('');

  const params = useParams();
  const location = useLocation();
  const activeJurId = params.jurId ?? null;

  // Compose active nodeId from the URL splat if we're in a reader route.
  const activeNodeId = useMemo(() => {
    if (!activeJurId) return null;
    const m = location.pathname.match(/^\/j\/[^/]+\/n\/(.+)$/);
    if (!m) return null;
    return `${activeJurId}:${m[1]}`;
  }, [activeJurId, location.pathname]);

  const groups = useMemo(() => {
    if (!data?.items) return [];
    const byCorpus = new Map<string, CorpusMeta[]>();
    for (const item of data.items) {
      const arr = byCorpus.get(item.corpus) ?? [];
      arr.push(item);
      byCorpus.set(item.corpus, arr);
    }
    const list = Array.from(byCorpus.entries())
      .map(([corpus, items]) => ({
        groupKey: corpus,
        label: corpusLabel(corpus),
        items: [...items].sort((a, b) =>
          a.jurisdictionId.localeCompare(b.jurisdictionId, undefined, { numeric: true })
        ),
      }))
      .sort((a, b) => corpusOrder(a.groupKey) - corpusOrder(b.groupKey));

    if (!filter) return list;
    return list
      .map((g) => ({
        ...g,
        items: g.items.filter((m) => m.name.toLowerCase().includes(filter)),
      }))
      .filter((g) => g.items.length > 0);
  }, [data, filter]);

  return (
    <nav
      className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
      aria-label="Jurisdictions"
    >
      <SidebarFilter onChange={setFilter} />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading && (
            <div className="space-y-2 px-3 py-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3 ml-3" />
              <Skeleton className="h-3 w-3/4 ml-3" />
              <Skeleton className="h-3 w-2/3 ml-3" />
            </div>
          )}
          {error && (
            <p className="px-3 py-4 text-xs text-danger">
              Couldn't load jurisdictions. Refresh to retry.
            </p>
          )}
          {!loading && !error && groups.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground">
              {filter ? `No matches for "${filter}".` : 'No jurisdictions yet.'}
            </p>
          )}
          {!loading &&
            !error &&
            groups.map((g) => (
              <SidebarGroup
                key={g.groupKey}
                groupKey={g.groupKey}
                label={g.label}
                items={g.items}
                expanded={expandedGroups.has(g.groupKey) || filter.length > 0}
                onToggle={() => toggleGroup(g.groupKey)}
                activeJurId={activeJurId}
                activeNodeId={activeNodeId}
              />
            ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
