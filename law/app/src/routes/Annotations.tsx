import { useMemo } from 'react';
import { Link } from 'react-router';
import { PencilSimple, X as XIcon, NotePencil } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useSaved } from '@/hooks/useSaved';
import type { Annotation } from '@/lib/law-data';
import { formatDateTime as formatTime } from '@/lib/format';

function nodePath(nodeId: string): string {
  const [jurId, ...rest] = nodeId.split(':');
  return `/j/${jurId}/n/${rest.join(':')}`;
}

export default function Annotations() {
  const { items, remove } = useAnnotations();
  const { items: saved } = useSaved();

  // Build a lookup of nodeId → {citation, heading} from the user's saved list.
  // For annotated sections not in the saved list, we fall back to nodeId.
  const meta = useMemo(() => {
    const m = new Map<string, { citation?: string | null; heading?: string | null }>();
    saved.forEach((s) => m.set(s.nodeId, { citation: s.citation, heading: s.heading }));
    return m;
  }, [saved]);

  // Group annotations by nodeId so the same section's notes cluster together.
  const groups = useMemo(() => {
    const byNode = new Map<string, Annotation[]>();
    [...items]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((ann) => {
        const arr = byNode.get(ann.nodeId) ?? [];
        arr.push(ann);
        byNode.set(ann.nodeId, arr);
      });
    return Array.from(byNode.entries()).map(([nodeId, notes]) => ({ nodeId, notes }));
  }, [items]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Annotations
        </p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Notes</h1>
        <p className="text-sm text-muted-foreground">
          Notes you've attached to sections, grouped by the section they belong to.
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-8">
          {groups.map(({ nodeId, notes }) => {
            const m = meta.get(nodeId);
            return (
              <li key={nodeId} className="space-y-2 border-b border-border pb-6 last:border-b-0">
                <Link to={nodePath(nodeId)} className="block group">
                  {m?.citation && (
                    <p className="font-mono text-xs tabular-nums text-muted-foreground group-hover:text-foreground transition-colors duration-(--dur-1)">
                      {m.citation}
                    </p>
                  )}
                  <p className="font-sans text-sm leading-snug">
                    {m?.heading || (
                      <span className="font-mono text-xs text-muted-foreground">{nodeId}</span>
                    )}
                  </p>
                </Link>
                <ul className="space-y-3 pt-2">
                  {notes.map((ann) => (
                    <li
                      key={ann.id}
                      className="group/note flex items-start gap-3 pl-3 border-l-2 border-border"
                    >
                      <div className="flex-1 min-w-0">
                        {ann.quote && (
                          <blockquote className="font-serif text-sm text-muted-foreground italic mb-1">
                            "{ann.quote}"
                          </blockquote>
                        )}
                        {ann.note && (
                          <p className="font-serif text-sm whitespace-pre-wrap leading-snug">
                            {ann.note}
                          </p>
                        )}
                        <p className="font-mono text-[0.7rem] text-muted-foreground mt-1">
                          {formatTime(ann.createdAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => remove(ann.id)}
                        aria-label="Remove note"
                        className="opacity-0 group-hover/note:opacity-100 focus:opacity-100 shrink-0 transition-opacity duration-(--dur-1)"
                      >
                        <XIcon size={12} weight="regular" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
      <NotePencil size={28} weight="regular" />
      <p className="text-sm">No notes yet.</p>
      <p className="text-xs">
        Open any section and press <PencilSimple size={12} weight="regular" className="inline align-baseline" /> in the reading rail to attach a note.
      </p>
    </div>
  );
}
