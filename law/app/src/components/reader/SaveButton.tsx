import { BookmarkSimple } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSaved } from '@/hooks/useSaved';
import type { EnrichedNode } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface Props {
  node: EnrichedNode;
  variant?: 'desktop' | 'mobile';
}

export function SaveButton({ node, variant = 'desktop' }: Props) {
  const { isSaved, save, unsave } = useSaved();
  const saved = isSaved(node.id);

  const toggle = () => {
    if (saved) {
      unsave(node.id);
    } else {
      save(node.id, {
        citation: node.citation ?? null,
        heading: node.heading ?? null,
      });
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
