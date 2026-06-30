import type { ReactNode } from 'react';

interface RightRailProps {
  content: ReactNode | null;
}

// Slot host for the contextual right rail. The Reader publishes its rail
// content via the outlet context's `setRailContent`. Other routes pass null,
// and the slot collapses (no visible width on the desktop layout).
export function RightRail({ content }: RightRailProps) {
  if (!content) return null;
  return (
    <aside
      className="hidden lg:block fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-12 z-20"
      aria-label="Section actions"
    >
      {content}
    </aside>
  );
}
