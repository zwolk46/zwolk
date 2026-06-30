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

export function ReadingRailMobile({ node }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed bottom-0 inset-x-0 h-14 z-30 border-t border-border bg-background/95 backdrop-blur flex items-center justify-around px-4 lg:hidden">
        <SaveButton node={node} variant="mobile" />
        <AnnotateDialog node={node} variant="mobile" />
        <CopyCiteButton node={node} variant="mobile" />
        <OfficialSourceLink node={node} variant="mobile" />
        <DisplayOptionsPopover variant="mobile" />
      </div>
    </TooltipProvider>
  );
}
