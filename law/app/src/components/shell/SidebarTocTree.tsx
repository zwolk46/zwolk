import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CaretRight } from '@phosphor-icons/react';
import type { TocNode } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface SidebarTocTreeProps {
  nodes: TocNode[];
  jurId: string;
  depth?: number;
  activeNodeId: string | null;
  autoOpenAncestors?: Set<string>;
}

// Walk the TOC and, given the active node id, return the set of ids that
// appear on the ancestor chain — those containers auto-open so the section
// is visible in the tree on deep-link load.
function computeAncestorChain(nodes: TocNode[], activeId: string | null): Set<string> {
  const chain = new Set<string>();
  if (!activeId) return chain;
  const walk = (n: TocNode, ancestors: string[]): boolean => {
    if (n.id === activeId) {
      ancestors.forEach((a) => chain.add(a));
      return true;
    }
    if (n.children?.length) {
      for (const c of n.children) {
        if (walk(c, [...ancestors, n.id])) return true;
      }
    }
    return false;
  };
  for (const root of nodes) walk(root, []);
  return chain;
}

export function SidebarTocTree({
  nodes,
  jurId,
  depth = 0,
  activeNodeId,
  autoOpenAncestors,
}: SidebarTocTreeProps) {
  // Root call computes the ancestor chain once and threads it down so every
  // node in the subtree can decide independently whether to open.
  const computed = useMemo(
    () => computeAncestorChain(nodes, activeNodeId),
    [nodes, activeNodeId]
  );
  const ancestorSet = autoOpenAncestors ?? computed;

  return (
    <ul className="space-y-px">
      {nodes.map((n) => (
        <SidebarTocNode
          key={n.id}
          node={n}
          jurId={jurId}
          depth={depth}
          activeNodeId={activeNodeId}
          autoOpenAncestors={ancestorSet}
        />
      ))}
    </ul>
  );
}

function SidebarTocNode({
  node,
  jurId,
  depth,
  activeNodeId,
  autoOpenAncestors,
}: {
  node: TocNode;
  jurId: string;
  depth: number;
  activeNodeId: string | null;
  autoOpenAncestors: Set<string>;
}) {
  const indent = { paddingLeft: `calc(0.5rem + 0.75rem * ${depth + 1})` };
  const isSection = node.structureType === 'section';
  const isActive = activeNodeId === node.id;
  const splat = node.id.includes(':') ? node.id.split(':')[1] : node.id;
  const label = node.heading || node.designation || node.id;
  const shouldAutoOpen = autoOpenAncestors.has(node.id);
  const [manuallyOpen, setManuallyOpen] = useState<boolean | null>(null);
  const open = manuallyOpen !== null ? manuallyOpen : shouldAutoOpen;

  if (isSection || !node.children?.length) {
    return (
      <li className="min-w-0">
        <Link
          to={`/j/${jurId}/n/${splat}`}
          title={label}
          style={indent}
          className={cn(
            'flex items-baseline gap-2 py-1 pr-3 rounded-md min-w-0',
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
          <span className="truncate flex-1 min-w-0">{label}</span>
        </Link>
      </li>
    );
  }

  // Container row: two touch targets — the caret expands/collapses the
  // subtree without navigating; the rest of the row is a link that navigates
  // to the container's ContainerView. Previously containers were expand-only,
  // so users clicking a Title got a silent no-op in the main pane.
  return (
    <li className="min-w-0">
      <div
        style={indent}
        className={cn(
          'group flex items-center gap-1 pr-3 rounded-md min-w-0',
          'text-[0.8125rem] leading-tight text-sidebar-foreground',
          'transition-colors duration-(--dur-1)',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setManuallyOpen((prev) => !(prev !== null ? prev : shouldAutoOpen));
          }}
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
          className={cn(
            'shrink-0 h-6 w-5 -ml-1 flex items-center justify-center rounded',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'transition-colors duration-(--dur-1)'
          )}
        >
          <CaretRight
            size={12}
            weight="regular"
            className={cn('transition-transform duration-(--dur-1)', open && 'rotate-90')}
          />
        </button>
        <Link
          to={`/j/${jurId}/n/${splat}`}
          title={label}
          className={cn(
            'flex items-baseline gap-1.5 py-1 flex-1 min-w-0 rounded-md',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'transition-colors duration-(--dur-1)'
          )}
        >
          {node.designation && (
            <span className="font-mono tabular-nums text-[0.7rem] text-muted-foreground shrink-0">
              {node.designation}
            </span>
          )}
          <span className="truncate flex-1 min-w-0">{label}</span>
        </Link>
      </div>
      {open && node.children && (
        <SidebarTocTree
          nodes={node.children}
          jurId={jurId}
          depth={depth + 1}
          activeNodeId={activeNodeId}
          autoOpenAncestors={autoOpenAncestors}
        />
      )}
    </li>
  );
}
