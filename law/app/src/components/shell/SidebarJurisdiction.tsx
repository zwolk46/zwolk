import { useEffect } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useToc } from '@/hooks/useToc';
import { SidebarTocTree } from '@/components/shell/SidebarTocTree';
import type { CorpusMeta } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface Props {
  meta: CorpusMeta;
  expanded: boolean;
  onToggle: () => void;
  activeNodeId: string | null;
  isActiveJur: boolean;
}

export function SidebarJurisdiction({ meta, expanded, onToggle, activeNodeId, isActiveJur }: Props) {
  // Only fetch TOC once the jurisdiction is expanded for the first time.
  const { data, loading, error } = useToc(expanded ? meta.jurisdictionId : null);

  // Auto-expand when the active route is inside this jurisdiction.
  useEffect(() => {
    if (isActiveJur && !expanded) onToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveJur]);

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger
        title={meta.name}
        className={cn(
          'flex w-full min-w-0 items-center gap-2 py-1.5 px-3 rounded-md text-left',
          'text-[0.8125rem] leading-tight text-sidebar-foreground',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          'transition-colors duration-(--dur-1)',
          '[&>svg]:transition-transform [&>svg]:duration-(--dur-1)',
          'data-[state=open]:[&>svg]:rotate-90'
        )}
      >
        <CaretRight size={12} weight="regular" className="shrink-0" />
        <span className="truncate flex-1 min-w-0">{meta.name}</span>
        <span className="font-mono tabular-nums text-[0.65rem] text-muted-foreground shrink-0">
          {meta.sectionCount.toLocaleString('en-US')}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {loading && (
          <div className="space-y-1.5 px-3 py-2">
            <Skeleton className="h-3 w-3/4 ml-6" />
            <Skeleton className="h-3 w-2/3 ml-6" />
            <Skeleton className="h-3 w-4/5 ml-6" />
          </div>
        )}
        {error && (
          <p className="px-3 py-2 text-[0.7rem] text-danger">Couldn't load table of contents.</p>
        )}
        {!loading && !error && data && (
          <SidebarTocTree nodes={data} jurId={meta.jurisdictionId} activeNodeId={activeNodeId} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
