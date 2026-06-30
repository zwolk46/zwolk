import { useEffect, useRef, useState } from 'react';
import { PencilSimple } from '@phosphor-icons/react';
import type { EnrichedNode } from '@/lib/law-data';
import { LinkifiedText } from '@/components/reader/LinkifiedText';
import { useReaderDisplayOptions } from '@/hooks/useReaderDisplayOptions';

interface Props {
  node: EnrichedNode;
  /** Called with the selected text when the user clicks the floating annotate button. */
  onAnnotateSelection?: (text: string) => void;
}

interface SelectionFloater {
  text: string;
  x: number;
  y: number;
}

export function ReaderBody({ node, onAnnotateSelection }: Props) {
  const { fontSize, measure } = useReaderDisplayOptions();
  const text = node.text || '';
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const articleRef = useRef<HTMLElement | null>(null);
  const [floater, setFloater] = useState<SelectionFloater | null>(null);

  // The jurId for cross-ref resolution within the same corpus.
  const jurId = node.id.includes(':') ? node.id.split(':')[0] : '';

  // Show a floating "Add note" button when the user selects text inside the
  // article. Hide on mousedown anywhere (clearing selection) or on Escape.
  useEffect(() => {
    if (!onAnnotateSelection) return;
    const onMouseUp = () => {
      // Defer so the selection is finalized.
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setFloater(null);
          return;
        }
        const raw = sel.toString().trim();
        if (!raw || raw.length < 4) {
          setFloater(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const article = articleRef.current;
        if (!article || !article.contains(range.commonAncestorContainer)) {
          setFloater(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        setFloater({
          text: raw.length > 600 ? raw.slice(0, 600) + '…' : raw,
          x: rect.left + rect.width / 2 + window.scrollX,
          y: rect.top + window.scrollY - 8,
        });
      }, 10);
    };
    const onMouseDown = (e: MouseEvent) => {
      // Don't dismiss if click is on the floater itself.
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-floater]')) return;
      setFloater(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFloater(null);
    };
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onAnnotateSelection]);

  if (paragraphs.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground italic">
        No body text on this section.
      </p>
    );
  }

  return (
    <>
      <article
        ref={articleRef}
        className="font-serif leading-[1.65] space-y-6 selection:bg-foreground/10"
        style={{
          fontSize: `${fontSize}px`,
          maxWidth: `${measure}ch`,
        }}
      >
        {paragraphs.map((p, i) => (
          <p key={i}>
            <LinkifiedText text={p} currentJurId={jurId} />
          </p>
        ))}
      </article>
      {floater && onAnnotateSelection && (
        <div
          data-floater
          style={{
            position: 'absolute',
            left: floater.x,
            top: floater.y,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-40"
        >
          <button
            onClick={() => {
              if (onAnnotateSelection) onAnnotateSelection(floater.text);
              setFloater(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-popover text-popover-foreground border border-border shadow-md text-xs hover:bg-muted transition-colors duration-(--dur-1)"
          >
            <PencilSimple size={14} weight="regular" />
            Add note
          </button>
        </div>
      )}
    </>
  );
}
