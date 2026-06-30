import { ArrowSquareOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EnrichedNode } from '@/lib/law-data';

interface Props {
  node: EnrichedNode;
  variant?: 'desktop' | 'mobile';
}

export function OfficialSourceLink({ node, variant = 'desktop' }: Props) {
  const href = node.source?.permalink || node.source?.sourceUrl;
  if (!href) return null;

  const btn = (
    <Button
      variant="ghost"
      size={variant === 'desktop' ? 'icon' : 'icon-sm'}
      asChild
      aria-label="View official source"
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ArrowSquareOut size={variant === 'desktop' ? 18 : 20} weight="regular" />
      </a>
    </Button>
  );

  if (variant === 'mobile') return btn;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="left">View official source</TooltipContent>
    </Tooltip>
  );
}
