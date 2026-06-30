import { useEffect, useState } from 'react';
import { BookmarkSimple } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { law } from '@/lib/lawClient';
import type { EnrichedNode } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface Props {
  node: EnrichedNode;
  variant?: 'desktop' | 'mobile';
}

export function SaveButton({ node, variant = 'desktop' }: Props) {
  const [saved, setSaved] = useState<boolean>(() => law.isSaved(node.id));

  // Refresh whenever the node changes (re-derive state for new node).
  useEffect(() => {
    setSaved(law.isSaved(node.id));
  }, [node.id]);

  const toggle = () => {
    if (saved) {
      law.unsave(node.id);
      setSaved(false);
    } else {
      law.save(node.id, {
        citation: node.citation ?? null,
        heading: node.heading ?? null,
      });
      setSaved(true);
    }
  };

  const label = saved ? 'Remove from library' : 'Save to library';

  const btn = (
    <Button
      variant="ghost"
      size={variant === 'desktop' ? 'icon' : 'icon-sm'}
      onClick={toggle}
      aria-label={label}
      aria-pressed={saved}
    >
      <BookmarkSimple
        size={variant === 'desktop' ? 18 : 20}
        weight={saved ? 'fill' : 'regular'}
        className={cn(saved && 'text-foreground')}
      />
    </Button>
  );

  if (variant === 'mobile') return btn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
