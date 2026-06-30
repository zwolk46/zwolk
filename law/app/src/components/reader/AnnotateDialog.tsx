import { useEffect, useRef, useState } from 'react';
import { PencilSimple, X as XIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAnnotations } from '@/hooks/useAnnotations';
import type { EnrichedNode } from '@/lib/law-data';

interface Props {
  node: EnrichedNode;
  variant?: 'desktop' | 'mobile';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AnnotateDialog({ node, variant = 'desktop' }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const { items: notes, add, remove } = useAnnotations(node.id);

  useEffect(() => {
    if (open) {
      setDraft('');
      setTimeout(() => taRef.current?.focus(), 50);
    }
  }, [open, node.id]);

  const addNote = () => {
    const note = draft.trim();
    if (!note) return;
    add(node.id, { note });
    setDraft('');
  };

  const removeNote = (id: string) => {
    remove(id);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      addNote();
    }
  };

  const trigger = (
    <Button
      variant="ghost"
      size={variant === 'desktop' ? 'icon' : 'icon-sm'}
      aria-label="Notes on this section"
    >
      <PencilSimple size={variant === 'desktop' ? 18 : 20} weight="regular" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'desktop' ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="left">Notes on this section</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-sans font-semibold">Notes</DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            {node.citation}
          </DialogDescription>
        </DialogHeader>

        {notes.length > 0 && (
          <ul className="max-h-60 overflow-y-auto space-y-3 border-t border-b border-border py-3">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm whitespace-pre-wrap break-words">{n.note}</p>
                  <p className="font-mono text-[0.7rem] text-muted-foreground mt-1">
                    {formatTime(n.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeNote(n.id)}
                  aria-label="Remove note"
                >
                  <XIcon size={12} weight="regular" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note about this section…"
          onKeyDown={onKey}
          rows={4}
          className="font-serif"
        />

        <DialogFooter className="sm:justify-between">
          <p className="font-mono text-[0.7rem] text-muted-foreground self-center">
            ⌘/Ctrl+Enter to save
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button size="sm" onClick={addNote} disabled={!draft.trim()}>
              Save note
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
