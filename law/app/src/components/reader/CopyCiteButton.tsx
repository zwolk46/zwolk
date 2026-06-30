import { Copy } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EnrichedNode } from '@/lib/law-data';

interface Props {
  node: EnrichedNode;
  variant?: 'desktop' | 'mobile';
}

export function CopyCiteButton({ node, variant = 'desktop' }: Props) {
  const onClick = async () => {
    const cite = node.citation || '';
    try {
      await navigator.clipboard.writeText(cite);
      toast.success('Citation copied', { description: cite });
    } catch {
      toast.error('Copy failed', { description: 'Clipboard access blocked.' });
    }
  };

  const btn = (
    <Button
      variant="ghost"
      size={variant === 'desktop' ? 'icon' : 'icon-sm'}
      onClick={onClick}
      aria-label="Copy citation"
    >
      <Copy size={variant === 'desktop' ? 18 : 20} weight="regular" />
    </Button>
  );

  if (variant === 'mobile') return btn;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="left">Copy citation</TooltipContent>
    </Tooltip>
  );
}
