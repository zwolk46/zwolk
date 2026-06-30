import { CaretRight } from '@phosphor-icons/react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SidebarJurisdiction } from '@/components/shell/SidebarJurisdiction';
import { useSidebarState } from '@/hooks/useSidebarState';
import type { CorpusMeta } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface Props {
  groupKey: string;
  label: string;
  items: CorpusMeta[];
  expanded: boolean;
  onToggle: () => void;
  activeJurId: string | null;
  activeNodeId: string | null;
}

export function SidebarGroup({
  groupKey,
  label,
  items,
  expanded,
  onToggle,
  activeJurId,
  activeNodeId,
}: Props) {
  const { expandedJurs, toggleJur } = useSidebarState();

  return (
    <div data-group={groupKey}>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger
          className={cn(
            'flex w-full items-center gap-2 py-2 px-3 rounded-md text-left',
            'text-xs font-medium uppercase tracking-widest text-muted-foreground',
            'hover:text-sidebar-foreground',
            'transition-colors duration-(--dur-1)',
            '[&>svg]:transition-transform [&>svg]:duration-(--dur-1)',
            'data-[state=open]:[&>svg]:rotate-90'
          )}
        >
          <CaretRight size={11} weight="regular" />
          <span className="truncate flex-1">{label}</span>
          <span className="font-mono tabular-nums text-[0.65rem] normal-case tracking-normal">
            {items.length}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-px pb-2">
            {items.map((meta) => (
              <li key={meta.jurisdictionId}>
                <SidebarJurisdiction
                  meta={meta}
                  expanded={expandedJurs.has(meta.jurisdictionId)}
                  onToggle={() => toggleJur(meta.jurisdictionId)}
                  activeNodeId={activeNodeId}
                  isActiveJur={meta.jurisdictionId === activeJurId}
                />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
