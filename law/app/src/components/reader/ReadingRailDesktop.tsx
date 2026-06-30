import type { EnrichedNode } from '@/lib/law-data';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SaveButton } from '@/components/reader/SaveButton';
import { AnnotateDialog } from '@/components/reader/AnnotateDialog';
import { CopyCiteButton } from '@/components/reader/CopyCiteButton';
import { OfficialSourceLink } from '@/components/reader/OfficialSourceLink';
import { DisplayOptionsPopover } from '@/components/reader/DisplayOptionsPopover';

interface Props {
  node: EnrichedNode;
}

export function ReadingRailDesktop({ node }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col items-center gap-1 pt-32 w-12">
        <SaveButton node={node} variant="desktop" />
        <AnnotateDialog node={node} variant="desktop" />
        <CopyCiteButton node={node} variant="desktop" />
        <OfficialSourceLink node={node} variant="desktop" />
        <DisplayOptionsPopover variant="desktop" />
      </div>
    </TooltipProvider>
  );
}
