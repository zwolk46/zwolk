import { Link } from 'react-router';
import { CaretRight } from '@phosphor-icons/react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { TocNode } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface SidebarTocTreeProps {
  nodes: TocNode[];
  jurId: string;
  depth?: number;
  activeNodeId: string | null;
}

export function SidebarTocTree({ nodes, jurId, depth = 0, activeNodeId }: SidebarTocTreeProps) {
  return (
    <ul className="space-y-px">
      {nodes.map((n) => (
        <SidebarTocNode key={n.id} node={n} jurId={jurId} depth={depth} activeNodeId={activeNodeId} />
      ))}
    </ul>
  );
}

function SidebarTocNode({
  node,
  jurId,
  depth,
  activeNodeId,
}: {
  node: TocNode;
  jurId: string;
  depth: number;
  activeNodeId: string | null;
}) {
  const indent = { paddingLeft: `calc(0.5rem + 0.75rem * ${depth + 1})` };
  const isSection = node.structureType === 'section';
  const isActive = activeNodeId === node.id;
  const splat = node.id.includes(':') ? node.id.split(':')[1] : node.id;

  if (isSection || !node.children?.length) {
    return (
      <li>
        <Link
          to={`/j/${jurId}/n/${splat}`}
          style={indent}
          className={cn(
            'flex items-baseline gap-2 py-1 pr-3 rounded-md',
            'text-[0.8125rem] leading-tight',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'transition-colors duration-(--dur-1)',
            isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          )}
        >
          {node.designation && (
            <span className="font-mono tabular-nums text-[0.7rem] text-muted-foreground shrink-0">
              §{node.designation}
            </span>
          )}
          <span className="truncate">{node.heading || node.designation || node.id}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger
          style={indent}
          className={cn(
            'flex w-full items-center gap-1.5 py-1 pr-3 rounded-md text-left',
            'text-[0.8125rem] leading-tight text-sidebar-foreground',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'transition-colors duration-(--dur-1)',
            '[&>svg]:transition-transform [&>svg]:duration-(--dur-1)',
            'data-[state=open]:[&>svg]:rotate-90'
          )}
        >
          <CaretRight size={12} weight="regular" />
          {node.designation && (
            <span className="font-mono tabular-nums text-[0.7rem] text-muted-foreground shrink-0">
              {node.designation}
            </span>
          )}
          <span className="truncate">{node.heading || node.id}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarTocTree
            nodes={node.children ?? []}
            jurId={jurId}
            depth={depth + 1}
            activeNodeId={activeNodeId}
          />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
