import type { EnrichedNode } from '@/lib/law-data';
import { ReadingRailDesktop } from '@/components/reader/ReadingRailDesktop';
import { ReadingRailMobile } from '@/components/reader/ReadingRailMobile';

interface Props {
  node: EnrichedNode;
  /** 'desktop' renders only the vertical rail, 'mobile' only the bottom toolbar. */
  variant: 'desktop' | 'mobile';
}

export function ReadingRail({ node, variant }: Props) {
  return variant === 'desktop' ? (
    <ReadingRailDesktop node={node} />
  ) : (
    <ReadingRailMobile node={node} />
  );
}
