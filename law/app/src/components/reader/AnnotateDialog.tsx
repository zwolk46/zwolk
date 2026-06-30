import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
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
  /** Don't render the trigger button (use the ref's openWithQuote() instead). */
  hideTrigger?: boolean;
}

export interface AnnotateDialogHandle {
  /** Open the dialog with the selected text prefilled as a quote. */
  openWithQuote(text: string): void;
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

export const AnnotateDialog = forwardRef<AnnotateDialogHandle, Props>(function AnnotateDialog(
  { node, variant = 'desktop', hideTrigger = false },
  ref
) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const { items: notes, add, remove } = useAnnotations(node.id);

  useImperativeHandle(ref, () => ({
    openWithQuote(text: string) {
      setQuote(text);
      setDraft('');
      setOpen(true);
    },
  }));

  useEffect(() => {
    if (open) {
      setTimeout(() => taRef.current?.focus(), 50);
    } else {
      // Clear the quote on close so a subsequent open-without-quote starts clean.
      setQuote(null);
      setDraft('');
    }
  }, [open, node.id]);

  const addNote = () => {
    const note = draft.trim();
    if (!note && !quote) return;
    add(node.id, { note: note || null, quote });
    setDraft('');
    setQuote(null);
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
      {!hideTrigger && (
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
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-sans font-semibold">
            {quote ? 'Annotate selection' : 'Notes'}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            {node.citation}
          </DialogDescription>
        </DialogHeader>

        {!quote && notes.length > 0 && (
          <ul className="max-h-60 overflow-y-auto space-y-3 border-t border-b border-border py-3">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {n.quote && (
                    <blockquote className="font-serif text-xs text-muted-foreground italic mb-1 border-l-2 border-border pl-2">
                      "{n.quote}"
                    </blockquote>
                  )}
                  {n.note && (
                    <p className="font-serif text-sm whitespace-pre-wrap break-words">{n.note}</p>
                  )}
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

        {quote && (
          <blockquote className="font-serif text-sm text-muted-foreground italic border-l-2 border-border pl-3 py-1 max-h-32 overflow-y-auto">
            "{quote}"
          </blockquote>
        )}

        <Textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={quote ? 'Add a note about the selection…' : 'Add a note about this section…'}
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
            <Button
              size="sm"
              onClick={addNote}
              disabled={!draft.trim() && !quote}
            >
              Save note
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
