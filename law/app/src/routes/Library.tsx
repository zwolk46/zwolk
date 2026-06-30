import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookmarkSimple, X as XIcon, MagnifyingGlass, BookOpen } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSaved } from '@/hooks/useSaved';
import type { SavedItem } from '@/lib/law-data';
import { cn } from '@/lib/utils';

function nodePath(nodeId: string): string {
  const [jurId, ...rest] = nodeId.split(':');
  return `/j/${jurId}/n/${rest.join(':')}`;
}

function formatDate(iso: string): string {
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

export default function Library() {
  const { items, unsave } = useSaved();
  const [filter, setFilter] = useState('');

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      ),
    [items]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        (s.citation || '').toLowerCase().includes(q) ||
        (s.heading || '').toLowerCase().includes(q) ||
        (s.note || '').toLowerCase().includes(q)
    );
  }, [sorted, filter]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Library
        </p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Saved sections</h1>
        <p className="text-sm text-muted-foreground">
          Sections you've bookmarked from the reader. Notes attached to each section show below the
          citation.
        </p>
      </header>

      {items.length > 0 && (
        <div className="relative">
          <MagnifyingGlass
            size={14}
            weight="regular"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="text"
            placeholder="Filter by citation, heading, or note…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 h-9"
            aria-label="Filter saved sections"
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">
          No saved sections match "<span className="font-mono">{filter}</span>".
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-b border-border">
          {filtered.map((item) => (
            <SavedRow key={item.nodeId} item={item} onRemove={() => unsave(item.nodeId)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedRow({ item, onRemove }: { item: SavedItem; onRemove: () => void }) {
  return (
    <li className="group py-4 flex items-start gap-3">
      <BookmarkSimple
        size={18}
        weight="fill"
        className="text-foreground/80 mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <Link
          to={nodePath(item.nodeId)}
          className={cn(
            'block group/link',
            'hover:[&_.cite]:text-foreground transition-colors duration-(--dur-1)'
          )}
        >
          {item.citation && (
            <p className="cite font-mono text-xs tabular-nums text-muted-foreground transition-colors">
              {item.citation}
            </p>
          )}
          <p className="font-sans text-sm leading-snug">
            {item.heading || item.nodeId}
          </p>
        </Link>
        {item.note && (
          <p className="font-serif text-sm text-muted-foreground leading-snug pt-1 whitespace-pre-wrap">
            {item.note}
          </p>
        )}
        <p className="font-mono text-[0.7rem] text-muted-foreground">
          Saved {formatDate(item.savedAt)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label="Remove from library"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 transition-opacity duration-(--dur-1)"
      >
        <XIcon size={14} weight="regular" />
      </Button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
      <BookOpen size={28} weight="regular" />
      <p className="text-sm">Nothing saved yet.</p>
      <p className="text-xs">
        Open any section and press the bookmark icon to add it here.
      </p>
    </div>
  );
}
